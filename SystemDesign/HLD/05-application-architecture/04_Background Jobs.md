# Background Jobs: Offloading Work Out of the Request Cycle

> **Module 5 — Application Architecture**  
> Source: https://layrs.me/course/hld/05-application-architecture/background-jobs-overview

---

## ELI5 — Explain Like I'm 5

You order a pizza online. The website doesn't make the pizza while you're watching — it just says "Order received!" and you get on with your day. The kitchen does the work in the background.

That's a background job: work that is **too slow, too risky, or not needed immediately** gets handed off to a separate worker so the web request can return instantly.

---

## Analogy

| Web Request | Background Job |
|---|---|
| Waiter takes your order | Takes the ticket to the kitchen |
| Pizza is assembled and baked | Long work done separately |
| You get a "ready" text later | Push notification / email when done |

Web request = fast acknowledgment.  
Background job = all the slow/heavy processing that follows.

---

## Core Concept

When a request handler does slow work (>200ms), users wait, CPUs stay busy, and a crash loses all progress.

**Solution**: decompose into:
1. **Request handler** — validates input, enqueues a job, returns `202 Accepted` immediately.
2. **Job queue** — durable buffer between producers (web servers) and consumers (workers).
3. **Worker pool** — stateless processes that pull jobs and execute them.
4. **Scheduler** — triggers time-based jobs (cron / Airflow / Bull `repeat` option).

```
User Request
    │
    ▼
 Web Server ──► Job Queue ──► Worker Pool ──► Result (DB update, email, webhook)
(202 Accepted)   [Redis/SQS]   (3 workers)
                                    │
                              Retry on failure
                              Dead Letter Queue (DLQ) after N retries
```

---

## When to Offload to a Background Job

| Condition | Example |
|---|---|
| Execution time > 200ms | Video transcoding, PDF generation |
| Work is non-critical-path | Sending welcome email after signup |
| Batch processing | Nightly billing aggregation |
| Rate-limited third-party calls | Sending SMS via Twilio |
| Retries needed | Webhook delivery |
| Fan-out to many services | "User liked post" → notify 50k followers |

---

## Job Queue Internals

### Lifecycle

```
ENQUEUED ──► ACTIVE (worker picks up)
                │
              success ──► COMPLETED
                │
              failure ──► WAIT (exponential backoff: 1s→2s→4s→8s→…→60s cap)
                │           │
             max retries ──► DEAD LETTER QUEUE (DLQ)
```

### Delivery Semantics

| Semantic | How | Implication |
|---|---|---|
| **At-most-once** | Acknowledge before processing | No retries; possible data loss |
| **At-least-once** | Acknowledge after processing | Retries possible → **must be idempotent** |
| **Exactly-once** | Distributed transactions / dedup | Complex; avoid if possible |

**At-least-once is the standard choice.** Build idempotent workers by checking if work was already done (dedup key in DB or Redis).

### Idempotency Pattern

```js
async function processJob(job) {
  const key = `email:sent:${job.data.userId}:${job.data.type}`;
  const alreadySent = await redis.get(key);
  if (alreadySent) return;           // already processed, skip

  await sendEmail(job.data);
  await redis.set(key, '1', 'EX', 86400); // mark done (24h TTL)
}
```

---

## Priority Queues

Multiple queues with different worker allocations:

```
HIGH queue   ──── 8 workers   (payment failures, security alerts)
DEFAULT queue ─── 4 workers   (order confirmations)
LOW queue    ──── 1 worker    (analytics, cleanup tasks)
```

Workers are configured to drain HIGH before DEFAULT, DEFAULT before LOW.

---

## Queue Technology Trade-offs

| Queue | Latency | Durability | Best for |
|---|---|---|---|
| **Redis (Bull/BullMQ)** | <1ms | Survives restart (AOF) | General-purpose; MERN default |
| **RabbitMQ** | ~1ms | Durable queues, dead-letter exchanges | Complex routing, enterprise |
| **AWS SQS** | 10–100ms | Fully managed, guaranteed durable | Serverless / AWS-native infra |
| **Kafka** | 1–10ms | Replicated log, replay possible | High-throughput streaming |
| **In-memory only** | <0.1ms | Lost on restart | Testing, non-critical tasks |

---

## Scheduling Background Jobs

```
              ┌─────────────────────────────────┐
              │         Scheduler               │
              │  cron: "0 2 * * *" (2AM daily)  │
              │  cron: "*/15 * * * *" (every 15m)│
              └─────────────────────────────────┘
                              │
                         enqueues job
                              │
                         Worker Pool
```

**Important**: With multiple web server instances, a naive cron will fire N times (once per instance) — use distributed locking or a dedicated scheduler process.

---

## Real-World Examples

| Company | Use case | Details |
|---|---|---|
| **Shopify** | Black Friday job processing | 10M+ jobs/minute via Sidekiq (Ruby + Redis). 3 priority queues (critical, high, low). Idempotent handlers identified by `job_id` |
| **Airbnb** | Booking workflows | All booking confirmation steps are background jobs with idempotency keyed by `booking_id` so double-processing never charges twice |
| **Netflix** | Video encoding | Upload → 202 Accepted immediately. Encoding job runs on AWS Batch + SQS. Multiple resolution/codec variants produced in parallel workers |
| **GitHub** | Webhooks | Delivery is a background job. If the consumer URL is down, GitHub retries with exponential backoff for up to 3 days. Each delivery has a unique `X-GitHub-Delivery` UUID for idempotency |

---

## MERN Dev Notes

```
Dependencies:
  npm install bull ioredis node-cron
  # BullMQ (newer API, TypeScript-native):
  npm install bullmq ioredis
```

```js
// queue.js — shared queue definition
const Bull = require('bull');
const emailQueue = new Bull('email', { redis: { host: 'localhost', port: 6379 } });
module.exports = { emailQueue };

// producer.js — API route (Express)
const { emailQueue } = require('./queue');

router.post('/signup', async (req, res) => {
  const user = await User.create(req.body);
  // Enqueue welcome email — don't await
  await emailQueue.add(
    { userId: user._id, email: user.email, type: 'welcome' },
    { attempts: 5, backoff: { type: 'exponential', delay: 2000 } }
  );
  res.status(202).json({ message: 'Account created' });
});

// worker.js — standalone process (node worker.js)
const { emailQueue } = require('./queue');

emailQueue.process(async (job) => {
  const { userId, email, type } = job.data;
  // Idempotency check
  const key = `email:sent:${userId}:${type}`;
  if (await redis.get(key)) return;
  await sendMailViaNodemailer(email, type);
  await redis.set(key, '1', 'EX', 86400);
});

emailQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed: ${err.message}`);
});
```

```js
// Scheduled job with Bull repeat (distributed-safe if only one scheduler process)
emailQueue.add(
  { type: 'daily-digest' },
  { repeat: { cron: '0 8 * * *' } }   // 8AM every day UTC
);
```

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| Why offload to background jobs? | Requests return fast; CPU freed for new requests; crash-safe retries; fan-out without blocking |
| Delivery semantics to use? | At-least-once (durable, retryable). Always make workers idempotent |
| How to prevent duplicate job execution? | Dedup key in Redis or DB; check before acting (idempotency guard) |
| Priority queue implementation? | Multiple queues — workers consume HIGH first; Bull supports `priority` field |
| What goes in DLQ? | Jobs that exceeded max retries; requires human/automated investigation and replay |
| Job queue vs message broker? | Queue = work distribution (one worker processes each job). Broker = pub-sub (multiple consumers see same message) |
| Redis vs SQS for job queue? | Redis: ultra-low latency, single AZ risk. SQS: fully managed, multi-AZ, at-least-once, 12h visibility timeout |

**Red flags**:
- Doing slow work synchronously in a route handler (blocks event loop in Node.js)
- Not implementing idempotency in workers
- Single worker with no retry logic (silent failures = lost jobs)
- Using a global in-memory queue (lost on restart)

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Background job** | Unit of work executed outside the HTTP request-response cycle |
| **Job queue** | Durable data structure that buffers jobs between producers and consumers |
| **Worker** | Process that pulls jobs from the queue and executes them |
| **Dead Letter Queue (DLQ)** | Storage for jobs that exhausted retries; enables investigation and replay |
| **Idempotency** | Property where executing an operation multiple times produces the same result as once |
| **At-least-once delivery** | Guarantee that a job will be delivered at least once; duplicates possible |
| **Exactly-once delivery** | Guarantee of single delivery; requires distributed transactions or deduplication |
| **Exponential backoff** | Retry delay doubles each attempt (e.g., 1s, 2s, 4s, 8s, 16s, cap at 60s) |
| **Bull** | Node.js job queue library backed by Redis |
| **BullMQ** | Improved rewrite of Bull with TypeScript support and better concurrency model |
| **SQS** (Simple Queue Service) | AWS managed message queue with at-least-once delivery guarantees |
| **Scheduler** | Component that enqueues jobs on a time-based trigger (cron expression) |
