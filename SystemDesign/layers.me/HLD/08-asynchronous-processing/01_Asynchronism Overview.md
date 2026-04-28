# Asynchronous Processing in System Design

> **Source**: https://layrs.me/course/hld/08-asynchronous-processing/asynchronism-overview  
> **Difficulty**: Intermediate | **Read time**: 12 min

---

## ELI5

Imagine you go to a restaurant and order a pizza. The **synchronous** approach: you stand at the counter staring at the oven until the pizza is ready — blocking everyone behind you. The **asynchronous** approach: you get a buzzer, sit down, do other things, and come back only when it buzzes. Same result, radically better throughput.

---

## Analogy — The Post Office

Synchronous = hand-delivering every letter yourself, waiting at each doorstep for the recipient to read it and respond.  
Asynchronous = drop letters in a post box. The postal system (queue) delivers them in your absence. You continue with your day.

The **queue** is the key artefact — it decouples *when you send* from *when the recipient processes*.

---

## Core Concept

**Asynchronous processing** separates *when work is requested* from *when work is performed*. The producer submits a task and returns immediately; one or more consumers process it later, independently.

### Three Decoupling Dimensions

| Dimension | What it means | Benefit |
|---|---|---|
| **Spatial** | Producer and consumer don't know each other's location | Independent deployment, team autonomy |
| **Temporal** | Producer and consumer don't run at the same time | Elastic scaling, offline consumers OK |
| **Failure isolation** | Consumer crash doesn't crash producer | Resilience, bounded blast radius |

### Synchronous vs Asynchronous

```
SYNCHRONOUS (blocks API server):
User → API → Encode video (5 min) → DB → 200 OK
                 ↑ thread blocked for 5 minutes

ASYNCHRONOUS (returns immediately):
User → API → Queue job → 202 Accepted   (milliseconds)
                ↓
          Worker Pool → Encode video → DB → send webhook/notification
```

---

## The Three Async Territories

### 1. Message Queues
- Independent, discrete messages between services
- Delivery guarantees: at-least-once / exactly-once
- Natural back-pressure through queue depth monitoring
- Examples: SQS, RabbitMQ, Kafka (queue mode)
- Use for: order events, notifications, microservice communication

### 2. Task Queues
- Background job execution with retries, priority, scheduling
- Optimise for **job completion semantics**: track state, retry, dead-letter
- Examples: Celery (Python), Sidekiq (Ruby), Bull/BullMQ (Node.js)
- Use for: image resize, email send, PDF generation, webhook delivery

### 3. Stream Processing
- Infinite, continuous event flows with temporal semantics
- Events are retained and replayable; multiple consumers at different offsets
- Examples: Kafka Streams, Apache Flink, Spark Streaming
- Use for: real-time analytics, fraud detection, recommendations, trending

```
Complexity & Richness:
Message Queue (simple discrete tasks)
    → Task Queue (adds workflow: retries, priority, scheduling)
        → Stream Processing (adds time: windows, watermarks, stateful aggregations)
```

---

## When to Go Async

| Scenario | Async? | Reason |
|---|---|---|
| Operation > 200ms | ✅ | Blocks HTTP workers if sync |
| Failure-prone (external API call) | ✅ | Queue buffers; retry hides failures |
| Variable timing (batch job) | ✅ | Decouple from request lifecycle |
| Search query returning result | ❌ | User needs immediate result |
| Auth token validation | ❌ | Fast, critical path |
| Real-time price lookup | ❌ | Low-latency synchronous is fine |

---

## Back-Pressure Overview

When producers outrun consumers, queues grow unbounded → OOM crash. Back-pressure signals the producer to slow down.

```
Producer (10K/sec) → Queue (bounded: 100K) → Consumer (5K/sec)
                          ↑ fills in 20 sec
                          ↓ back-pressure fires
                      Producer slows / returns 503
```

See topic `04_Backpressure.md` for full strategies.

---

## Idempotency Is Mandatory

Because async systems use **at-least-once delivery**, consumers will see the same message more than once. Operations **must** be idempotent:

> *f(x) = f(f(x))* — running the operation twice has the same effect as running it once.

See topic `05_Idempotent Operations.md` for implementation patterns.

---

## MERN Dev Notes

```javascript
// ❌ Synchronous — blocks event loop
app.post('/send-email', async (req, res) => {
  await sendEmailAPI(req.body); // 500ms external call
  res.json({ ok: true });       // user waits 500ms
});

// ✅ Asynchronous — enqueue job, return immediately
app.post('/send-email', async (req, res) => {
  await emailQueue.add({ to: req.body.email, subject: '...' });
  res.status(202).json({ ok: true, message: 'Email queued' });
});
// Worker (separate process):
emailQueue.process(async (job) => {
  await sendEmailAPI(job.data); // retried automatically on failure
});
```

> **BullMQ** (Node.js + Redis) is the de-facto task queue for MERN stacks. Drop-in for any operation > 200ms or requiring retries.

---

## Real-World Examples

### Netflix — Video Encoding Pipeline
- Upload → API returns 202 immediately → enqueues encoding job
- Workers encode at 4K, 1080p, 720p, mobile simultaneously
- Step Functions orchestrate multi-step workflow (validate → encode → thumbnail → CDN distribute)
- Processes **billions of encoding jobs annually** with zero user-blocking

### Spotify — Event-Driven Architecture
- 500M users, hundreds of microservices, all communicating via async Kafka events
- Song play → recommendation engine update + royalty tracking + analytics pipeline, all async
- Processing time: **millions of events/second** without any service blocking another

### Shopify — Flash Sale Smoothing
- Checkout spikes from flash sales go into task queues
- Order processing runs at sustainable consumer rate
- Queue depth metric replaces "is my service down?" panic

---

## ASCII Flow — Async Layers

```
                   ┌─────────────────────────────┐
  USER REQUEST     │  API Server (HTTP)           │
  ─────────────►   │  - Validates input           │
                   │  - Enqueues job/event        │
                   │  - Returns 202 Accepted      │
                   └──────────┬──────────────────┘
                              │ publishes message
                              ▼
                   ┌─────────────────────────────┐
  QUEUE / BROKER   │  Message/Task Queue          │
                   │  - Durable storage           │
                   │  - Delivery guarantees       │
                   │  - Backpressure signaling    │
                   └──────────┬──────────────────┘
                              │ pulled by workers
                              ▼
                   ┌─────────────────────────────┐
  WORKERS          │  Consumer / Worker Pool      │
                   │  - Process job               │
                   │  - Retry with backoff        │
                   │  - DLQ on exhaustion         │
                   └──────────┬──────────────────┘
                              │
                              ▼
                   Database / Cache / External API
```

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| When should you choose async over sync? | Operations > 200ms, failure-prone, variable timing, or cases where user doesn't need immediate result |
| What are the 3 decoupling dimensions async provides? | Spatial (no location coupling), Temporal (no simultaneous operation), Failure isolation (crash isolation) |
| Message queue vs task queue vs stream processor? | MQ: discrete messages + delivery guarantees; TQ: job execution + retries + priority; Stream: continuous, stateful, temporal aggregation |
| What is back-pressure? | Reactive signal from slow consumer to fast producer to slow down; prevents queue overflow and OOM |
| Why must async operations be idempotent? | Queues deliver at-least-once → consumers see duplicates → non-idempotent ops cause double charges, duplicate emails, corrupted state |
| What is temporal decoupling? | Producer and consumer don't need to be active simultaneously; enables elastic scaling and offline processing |
| Anti-pattern: "I'd use Kafka for everything" | Red flag — Kafka adds complexity; SQS/Redis task queue is right for simple background jobs; Kafka shines for high-throughput streaming |

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Asynchronous processing** | Separating work request from work execution across time |
| **Temporal decoupling** | Producer and consumer run independently in time |
| **Spatial decoupling** | Producer and consumer don't know each other's location |
| **Message queue** | Durable store of discrete messages consumed-and-deleted |
| **Task queue** | Message queue specialised for job execution with retries/priority |
| **Stream processor** | System for continuous, stateful computation on unbounded data |
| **Back-pressure** | Flow control signal from consumer to producer to slow down |
| **At-least-once delivery** | Every message delivered, but duplicates possible |
| **Idempotency** | Operation can safely execute multiple times with same result |
| **Dead-letter queue (DLQ)** | Queue for messages that exhausted retries |
| **Strangler fig pattern** | Gradually replace sync with async, incrementally routing traffic |
