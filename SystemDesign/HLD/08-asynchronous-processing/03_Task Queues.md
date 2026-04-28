# Task Queues: Celery, Sidekiq & Job Processing

> **Source**: https://layrs.me/course/hld/08-asynchronous-processing/task-queues  
> **Difficulty**: Intermediate | **Read time**: 15 min

---

## ELI5

A task queue is a specialised mailbox for background chores. The restaurant (API server) doesn't peel vegetables during rush hour — it writes "peel 20 carrots" on a ticket and drops it in the chore box. Kitchen assistants (workers) pick up tickets when free, do the work, and mark them done. If a worker quits mid-task, the ticket goes back in the box.

---

## Analogy — Helpdesk Ticket System

Task queues are like Jira for machine work:
- **Producer** = developer filing a bug ticket (API server enqueuing a job)
- **Queue** = Jira backlog (Redis or RabbitMQ)
- **Worker** = engineer assigned to it (worker process)
- **DLQ** = tickets closed as "Won't Fix" after failed attempts

Jira tracks state (Open → In Progress → Done → Won't Fix). So does a task queue.

---

## Core Concept

Task queues optimise for **job completion semantics**, not just delivery:
- Track individual task state (pending → running → completed / failed)
- Retry with exponential backoff
- Route to specialised workers (CPU vs I/O, GPU vs lightweight)
- Dead-letter queue for permanently failed tasks
- Priority levels across separate queues

**Task queue vs message queue:**
| | Task Queue | Message Queue |
|---|---|---|
| Focus | Job execution + lifecycle | Message delivery |
| Retries | Built-in with backoff, DLQ | Manual (if at all) |
| State tracking | Yes — pending/running/done/failed | No |
| Result storage | Yes — fetch result by task ID | No |
| Priority | Queue-level priority | Routing-based |

---

## Architecture

```
                                  Result Backend
API Server (Producer)             (Redis / DB)
  │                                    ▲
  │  enqueue({task, payload, prio})    │ store result
  ▼                                    │
Queue Broker (Redis / RabbitMQ)        │
  ├─ critical_queue ──────────► Worker 1 ─────┘
  ├─ high_queue     ──────────► Worker 2
  ├─ default_queue  ──────────► Worker 3
  └─ delayed_tasks             Worker 4
       (sorted set, zrangebyscore)
       ↓ moved to queue when eta reached
```

### Task Lifecycle

```
PENDING → RUNNING → COMPLETED
             │
             └──► FAILED → retry #1 → retry #2 → retry #3 → DEAD (DLQ)
```

---

## Priority Queues Implementation

```
Redis-backed priority (Sidekiq / Bull pattern):
  BRPOP critical_queue high_queue default_queue low_queue 1
  (blocks up to 1s; pops from leftmost non-empty queue)

RabbitMQ-backed: native priority messages (0–255), heap-sorted; O(log N) insert, O(1) pop
```

Worker allocation (Airbnb pattern): 20% workers → critical, 80% → low-priority

---

## Exponential Backoff Retry

```
attempt 1 at t=0s    → fails
attempt 2 at t=1s    → fails   delay = 1s × 2^1 = 2s
attempt 3 at t=3s    → fails   delay = 1s × 2^2 = 4s
attempt 4 at t=7s    → fails   delay = 1s × 2^3 = 8s
attempt 5 at t=15s   → fails   → DEAD LETTER QUEUE
              ───────────────────────────────────────
Formula: delay = base_delay × (2 ^ retry_count) + random_jitter(±10%)
Cap: max_delay (e.g. 1 hour for Stripe webhooks)
```

**Jitter** prevents thundering herd: if 100 workers all failed and all retry at `t+2s`, DB gets slammed simultaneously. Random ±10% desynchronises them.

---

## Worker Pool Patterns

### Fixed vs Dynamic Sizing
- **Fixed**: 20 workers/machine; predictable RAM (200MB × 20 = 4GB); size for P80 load
- **Dynamic**: autoscale 10–50 workers based on queue depth; handles spikes, adds startup complexity

### Health Monitoring
- Workers send heartbeat every 30s
- If no heartbeat in >30s → consider crashed → re-enqueue in-flight task
- `terminationGracePeriodSeconds: 60` in Kubernetes = finish current task before shutdown

### Concurrency Models
| Model | Best for | Example |
|---|---|---|
| Process-per-worker | CPU-bound (video encode) | Celery (fork) |
| Thread-per-worker | I/O-bound (API calls, DB) | Sidekiq (25 threads) |
| Async/event-loop | High-concurrency I/O | BullMQ (Node.js async) |

---

## Technology Comparison

| | Celery (Python) | Sidekiq (Ruby) | Bull/BullMQ (Node.js) | Step Functions (AWS) |
|---|---|---|---|---|
| Broker | Redis / RabbitMQ | Redis | Redis | DynamoDB internals |
| Throughput | ~10K jobs/s | 1M jobs/hr (50 workers) | ~50K jobs/s | Orchestration scale |
| Scheduling | Celery Beat (cron-like) | Sidekiq Cron | BullMQ Scheduler | State machine |
| Workflows | Chains, chords, groups | Basic chaining | Job dependencies | Full DAGs |
| Best for | Python, complex workflows | Ruby/Rails | Node.js | Multi-step AWS workflows |

---

## Delayed / Scheduled Tasks

```
Redis sorted set (ZADD with execution timestamp as score):
ZADD delayed_tasks 1743300000 "task:abc-123"  ← score = Unix timestamp

Scheduler (runs every 1s):
ZRANGEBYSCORE delayed_tasks 0 {now}           ← get tasks due
→ RPUSH main_queue "task:abc-123"             ← move to main queue
```

---

## Task Acknowledgment — Exactly-Once Safety

```
Pull task → task becomes INVISIBLE for visibility_timeout (e.g. 5 min)
   If worker ACKs:   → removed permanently ✅
   If worker crashes: → re-appears after timeout → redelivered to another worker
```
→ Tasks **must be idempotent** (re-running has same effect as once).

---

## Performance Reference

| Broker | Throughput | Pickup Latency | Notes |
|---|---|---|---|
| Redis (Sidekiq/Bull) | 10K–50K tasks/s | 1–10ms | BRPOP blocking pop |
| RabbitMQ | 5K–20K tasks/s | 10–100ms | Durable queues |
| AWS SQS | Millions/s (auto-scales) | 100–1000ms | Higher latency |

Scaling: add worker machines; I/O-bound → 10–20 workers/core; CPU-bound → 1 worker/core

---

## MERN Dev Notes

```javascript
// BullMQ (Node.js + Redis) — production task queue
import { Queue, Worker } from 'bullmq';

const imageQueue = new Queue('image-processing', { connection: redisClient });

// API layer — enqueue on upload
app.post('/upload', async (req, res) => {
  const job = await imageQueue.add('resize', 
    { imageUrl: req.file.url, userId: req.user.id },
    { priority: 2, attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
  );
  res.status(202).json({ jobId: job.id });
});

// Worker process (separate dyno/pod)
const worker = new Worker('image-processing', async (job) => {
  const { imageUrl, userId } = job.data;
  await resizeImage(imageUrl, [100, 200, 400]);
  await db.users.update(userId, { avatarStatus: 'ready' });
}, { connection: redisClient, concurrency: 10 });

// Poll job status
app.get('/jobs/:id', async (req, res) => {
  const job = await imageQueue.getJob(req.params.id);
  res.json({ state: await job.getState(), progress: job.progress });
});
```

> **MERN note**: BullMQ is the modern successor to Bull (same API, TypeScript-first, better performance). Redis is mandatory as the broker.

---

## Real-World Examples

| Company | System | Details |
|---|---|---|
| Airbnb | Background jobs (Celery) | Queues: critical/high/default/low; GPU workers for image processing; 30% infra cost reduction via specialised routing |
| Stripe | Webhook delivery | Go workers + Redis; exponential backoff (immediate → 1h → 6h → 24h → 72h); idempotency keys; auto-disable endpoints with <50% success rate |
| Reddit | Write buffer | RabbitMQ; all write operations (upvotes, comments) enqueued before DB write; 10x traffic spike (2013 Boston Marathon bombing) handled without DB overload |

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| What is the difference between a task queue and a message queue? | Task queues optimise for job execution semantics: state tracking, retry/DLQ, priority, result storage. Message queues focus on reliable message delivery between services |
| Explain exponential backoff retry | delay = base × 2^attempt + jitter; prevents thundering herd when downstream fails; cap at max_delay (e.g. 1 hour) |
| How do you design a webhook delivery system? | Enqueue delivery task; exponential backoff retries (immediate→1h→6h→24h→72h); idempotency key in headers; DLQ after exhaustion; monitor per-endpoint success rate |
| What happens when a worker crashes mid-task? | Visibility timeout expires → task reappears in queue → another worker claims it; requires idempotent task design |
| How do you prioritise urgent tasks? | Separate queues per priority (critical/high/default/low); workers use BRPOP checking critical first; dedicate a fixed percentage of workers to critical queue |
| How do you handle a task queue DLQ in production? | Monitor DLQ depth (alert on > N messages); root cause analysis; fix bug; replay from DLQ back to main queue |
| Why use jitter in retry backoff? | Without jitter, all N failed workers retry at the same time (e.g. t+4s), overwhelming the recovering service; jitter ±10% desynchronises retries |

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Task queue** | Queue specialised for job execution with retries, priority, and state tracking |
| **Worker pool** | Set of processes that pull and execute tasks |
| **Exponential backoff** | Retry delay doubles each attempt to avoid thundering herd |
| **Jitter** | Random ±% added to backoff delay to desynchronise retries |
| **DLQ (Dead Letter Queue)** | Queue for tasks that exhausted all retries |
| **Priority queue** | Multiple queues checked in order; urgent tasks preempt routine ones |
| **Visibility timeout** | Time a task is hidden after delivery; re-appears if no ACK |
| **Idempotent task** | Task that can safely run multiple times with same effect |
| **BRPOP** | Redis blocking pop command; waits until an item appears in ≥1 of listed queues |
| **Celery Beat** | Celery's periodic task scheduler (cron-like) |
| **BullMQ** | TypeScript-first Redis-backed task queue for Node.js |
| **Graceful shutdown** | Worker finishes in-flight tasks before exiting on SIGTERM |
