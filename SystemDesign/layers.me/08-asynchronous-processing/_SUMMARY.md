# M8 — Asynchronous Processing: Quick-Review Summary

> 6 topics | Covers: Async design patterns, message queues, task queues, backpressure, idempotency, stream processing

---

## Topics at a Glance

| # | Topic | Core Insight |
|---|---|---|
| T01 | Asynchronism Overview | Decouple caller from callee across space, time, and failure — let work happen off the critical path |
| T02 | Message Queues | Durable broker-mediated async communication; at-least-once delivery; Kafka for streaming, SQS for tasks |
| T03 | Task Queues | Schedule background jobs with priority, retry, and dead-letter handling; Bull/BullMQ in Node.js |
| T04 | Backpressure | When consumer is slower than producer — signal upstream to slow down before the system explodes |
| T05 | Idempotent Operations | f(x) = f(f(x)) — design operations so retries are safe; deduplication keys are the pattern |
| T06 | Stream Processing | Continuous computation on unbounded data; windowing + event-time + watermarks + checkpointing |

---

## T01 — Asynchronism Overview

**Core idea**: separate the moment a request is made from the moment it is fulfilled.

```
SYNCHRONOUS (blocking):
  Client → API → [waits 5s] → DB writes, email sends, thumbnail generates → Response
  Client blocked for entire duration ❌

ASYNCHRONOUS (non-blocking):
  Client → API → queue task → Response (jobId) immediately ✅
                    ↓
               Worker picks up → DB writes, email sends, thumbnail generates
               (Client polls or webhook notifies)
```

### Three Decoupling Dimensions

| Dimension | Meaning | Example |
|---|---|---|
| **Spatial** | Caller doesn't know which worker handles it | Any of 50 workers can process a video |
| **Temporal** | Caller doesn't wait for result | Enqueue at 2am, process at 3am |
| **Failure isolation** | Producer failure ≠ consumer failure | If worker crashes, message stays in queue |

### When to Go Async

| Scenario | Decision | Reason |
|---|---|---|
| User-facing page load | ❌ Sync | User is waiting |
| Send confirmation email | ✅ Async | Irrelevant to immediate response |
| Resize uploaded image | ✅ Async | CPU-heavy, not blocking |
| Charge payment | ⚠️ Hybrid | Enqueue + poll / webhook for status |
| Report generation | ✅ Async | Long-running, return jobId |

---

## T02 — Message Queues

**A broker stores messages durably until a consumer is ready to process them.**

```
Producer → [Broker: Kafka / RabbitMQ / SQS] → Consumer

Message lifecycle:
  published → stored (durable) → delivered → processed → acknowledged → deleted/committed
```

### Delivery Guarantees

| Guarantee | Meaning | Risk | Example |
|---|---|---|---|
| At-most-once | Delivered 0 or 1 time | Data loss possible | Fire-and-forget logs |
| At-least-once | Delivered 1+ times | Duplicates possible | Most queues default |
| Exactly-once | Delivered exactly 1 time | Expensive (2PC) | Kafka transactions |

### Dead-Letter Queue (DLQ)

```
Consumer fails message 3× → message moves to DLQ → alert engineers
                                                  → inspect + replay or discard

maxReceiveCount = 3 (SQS) → moves to DLQ automatically
```

### Broker Comparison

| | Kafka | RabbitMQ | SQS |
|---|---|---|---|
| **Model** | Distributed log (partitioned) | Broker-queue (AMQP) | Managed simple queue |
| **Throughput** | 1M+ msgs/sec | 20–50K msgs/sec | 3,000 msgs/sec standard |
| **Retention** | Days to forever | Until ACK'd | Up to 14 days |
| **Replay** | ✅ Yes (seek offset) | ❌ No | ❌ No |
| **Best for** | Event streaming, audit log | Routing, work queues | Simple AWS tasks |

### Kafka Internals in 4 Lines

```
Topic → N Partitions → each partition is an append-only log
Each message has offset (immutable, monotonically increasing)
Consumer group tracks per-partition offset → each partition consumed by 1 consumer in group
Replication factor R → R-1 broker failures tolerated without data loss
```

---

## T03 — Task Queues

**A specialised message queue for scheduling discrete jobs with lifecycle management** (priority, retry, dead-letter).

```
Task lifecycle:
  PENDING → ACTIVE (worker picks up) → COMPLETED ✅
                                     → FAILED (retry with backoff)
                                     → DEAD (max retries exhausted → DLQ)
```

### Exponential Backoff Formula

```
delay = base × 2^attempt + jitter(±10%)

attempt 1: 30s × 2^1 = 60s  (± 6s)
attempt 2: 30s × 2^2 = 120s (± 12s)
attempt 3: 30s × 2^3 = 240s (± 24s)

Jitter prevents thundering herd on retry storms.
```

### Worker Pool Patterns

| Model | When to use |
|---|---|
| Fixed pool | Predictable load; each worker = 1 DB connection |
| Dynamic (auto-scale) | Spiky load; cloud VMs/containers |
| Process-per-worker | CPU-bound (transcoding, ML inference) |
| Thread-per-worker | I/O-bound (DB queries, HTTP calls) |
| Async event loop | High-I/O, low-CPU (Node.js BullMQ) |

### Bull/BullMQ Quick Reference (Node.js)

```javascript
import { Queue, Worker } from 'bullmq';

const emailQueue = new Queue('emails', { connection: redis });

// Producer
await emailQueue.add('welcome', { userId }, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 30000 },
  removeOnComplete: 100,   // keep last 100
  removeOnFail: 500,
});

// Worker
new Worker('emails', async (job) => {
  await sendWelcomeEmail(job.data.userId);
}, { connection: redis, concurrency: 10 });
```

---

## T04 — Backpressure

**Backpressure is the mechanism by which a slow consumer signals the producer to slow down.**

```
Without backpressure:
  Producer 10K msg/s → Consumer 1K msg/s → Buffer fills → OOM crash 💥

With backpressure:
  Producer 10K msg/s → Consumer 1K msg/s → Consumer signals "SLOW DOWN"
                                          → Producer drops to 1K msg/s ✅
```

### Backpressure ≠ Rate Limiting

| | Backpressure | Rate Limiting |
|---|---|---|
| **Who signals** | Downstream consumer | Upstream gateway / server |
| **Trigger** | Consumer processing speed | Client request frequency |
| **Purpose** | Protect internal pipeline | Protect service from external abuse |

### Four Strategies

| Strategy | Mechanism | Use when |
|---|---|---|
| **Blocking / flow control** | Consumer blocks producer (TCP window, BullMQ limiter) | In-process, same system |
| **Buffering** | Accept into queue, process when ready | Temporary bursts OK |
| **Dropping** | Discard excess messages | Latency matters > completeness (metrics, telemetry) |
| **Load shedding / signalling** | Return 429 / 503 to producer | External clients; at the API edge |

### Cascade Prevention

```
Without bulkhead:
  ServiceA slow → RequestsB pile up → ServiceB OOM → ServiceC timeout → full cascade 💥

With bulkhead (Hystrix / resilience4j):
  ServiceA slow → circuit opens → fast-fail ServiceB requests → ServiceC healthy ✅
```

---

## T05 — Idempotent Operations

**An operation is idempotent if:** `f(x) = f(f(x))`
> Executing it multiple times produces the same result as executing it once.

### Why Needed

```
Network call → server succeeds → ACK lost → client retries → DUPLICATE side-effect 💥

Occurs due to:
  - Network timeouts (client retries on no ACK)
  - At-least-once message delivery (same message arrives 2×)
  - Load balancer / API gateway auto-retries
```

### Idempotency Key Flow

```
Client generates UUID per logical operation:
  POST /payments
  Header: Idempotency-Key: uuid-7f3d9a2b

Server:
  1. SELECT FROM idempotency_keys WHERE key=? AND created_at > NOW()-24h
  2. Not found → INSERT status='processing' → process → UPDATE status='completed', result=...
  3. Found + completed → return cached result (no reprocessing) ✅
  4. Found + processing → 409 Conflict (concurrent duplicate)
```

### Deduplication Table Schema

```sql
CREATE TABLE idempotency_keys (
  key        VARCHAR(255) PRIMARY KEY,
  status     ENUM('processing','completed','failed'),
  result     TEXT,
  created_at TIMESTAMP,
  INDEX idx_created_at (created_at)      -- for TTL cleanup
);
-- Unique constraint prevents race: second INSERT → constraint violation → return cached
```

### Four Variants

| Pattern | How | Best for |
|---|---|---|
| Natural idempotency | HTTP PUT/DELETE; absolute value | Read ops, absolute updates |
| Idempotency keys | Client UUID + dedup table | Any POST/mutating operation |
| Conditional update | `WHERE version = N` | State machines, inventory |
| Bloom filter | Probabilistic seen-before check | High-throughput streaming dedup |

---

## T06 — Stream Processing

**Processing unbounded, continuous event data in real time** — no waiting to collect a full dataset first.

```
Batch:   [collect all data] → schedule job → process → results (minutes–hours later)
Stream:  event arrives → process immediately → results (milliseconds–seconds later)
```

### 3-Layer Architecture

```
Ingestion (Kafka/Kinesis) → Processing (Flink/Kafka Streams) → Output (Redis/Cassandra/Snowflake)
```

### Windowing

| Type | Shape | Memory | Use case |
|---|---|---|---|
| **Tumbling** | Fixed, non-overlapping | O(keys) | Hourly totals |
| **Sliding** | Overlapping (event in N windows) | O(keys × overlap) | Rolling averages |
| **Session** | Closes after inactivity gap | O(keys × sessions) | User session analytics |

### Event Time vs Processing Time

```
Event time    = when event occurred on the device
Processing time = when the server received it

Mobile app offline → events arrive hours late
→ use event time for correct analytics
→ watermarks: W(t) = max_observed_event_time − safety_margin
→ window closes when watermark advances past window end
```

### Fault Tolerance (Chandy-Lamport)

```
Operator state → barrier marker injected into stream → each operator snapshots to S3
On failure: restore snapshot + reset Kafka offset → replay from there
= exactly-once semantics at the cost of 10–30% throughput
Common shortcut: at-least-once + idempotent sink (cheaper, effectively exactly-once)
```

### Framework Comparison

| | Kafka Streams | Apache Flink | Spark Streaming |
|---|---|---|---|
| Architecture | Library (no cluster) | Full cluster | Spark cluster |
| Latency | Sub-100ms | Sub-100ms | 1–2s (micro-batch) |
| Event time | Basic | Full (watermarks) | Basic |
| Best for | Kafka-native pipelines | Complex stateful, event-time | Existing Spark users |

---

## Cross-Topic Connections

```
Message Queues (T02) ──► feed into ──► Task Queues (T03) [jobs from MQ]
                    ──► feed into ──► Stream Processing (T06) [event streams in Kafka]

Backpressure (T04) ◄── required by ──── all three (MQ, TQ, Stream)
                        when consumer slower than producer

Idempotency (T05) ◄── required by ──── all three
                        because all use at-least-once delivery

Asynchronism (T01) = the philosophy that unifies T02–T06
```

---

## Interview Rapid-Fire Answers

| Q | A |
|---|---|
| When to go async? | When the caller doesn't need the result immediately: email, resize, report, charge-then-notify |
| Kafka vs SQS? | Kafka: replay, high-throughput, stream processing. SQS: simple managed queue, AWS-native, no replay |
| What is backpressure? | Consumer signals producer to slow down when queue depth / processing lag exceeds threshold |
| What is idempotency? | f(x) = f(f(x)) — duplicate executions produce the same result; required because networks and queues retry |
| How do you implement idempotency? | Client UUID as Idempotency-Key header; server stores key in dedup table with TTL; duplicates return cached result |
| Event time vs processing time? | Event time = when occurred; processing time = when received; diverge due to offline mobile / network delay |
| What is a watermark? | Heuristic W(t): asserts all events with event time ≤ t have arrived; used to close windows |
| Exactly-once cost? | 10–30% throughput overhead; use at-least-once + idempotent sink as cheaper alternative |
| What is a DLQ? | Dead-letter queue: messages that exceeded max retries are parked here for inspection and replay |
| Session vs tumbling window? | Tumbling: fixed clock interval. Session: closes after user inactivity gap — event-driven boundary |
