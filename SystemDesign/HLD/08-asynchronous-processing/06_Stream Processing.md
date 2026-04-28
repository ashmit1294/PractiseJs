# Stream Processing: Real-Time Data at Scale

> **Source**: https://layrs.me/course/hld/08-asynchronous-processing/stream-processing  
> **Difficulty**: Advanced | **Read time**: 16 min

---

## ELI5

Think of **batch processing** like watching a DVD — you collect all the movie data first, then watch it in one go. **Stream processing** is like live TV — data flows continuously and you react to it as it arrives, in real time, without waiting for it all to arrive first.

---

## Analogy — Air Traffic Control

Air traffic control can't wait until all planes land to check for collisions. They monitor a **continuous stream** of radar pings, compute each plane's position in real time, detect conflicts using sliding time windows, and respond within seconds. That is stream processing: unbounded data + stateful computations + continuous output.

---

## Core Concept

**Stream vs Batch**:

| Dimension | Batch Processing | Stream Processing |
|---|---|---|
| Data | Bounded (finite dataset) | Unbounded (infinite flow) |
| Trigger | Scheduled job (hourly/daily/weekly) | Each event as it arrives |
| Latency | Minutes to hours | Milliseconds to seconds |
| State | Stored in files/DB between runs | Maintained in operator state (RocksDB) |
| Use case | Daily reports, ETL, ML training | Fraud detection, live dashboards, alerting |
| Examples | Hadoop MapReduce, Spark batch | Kafka Streams, Flink, Spark Streaming |

---

## 3-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     STREAM PROCESSING PIPELINE                       │
│                                                                       │
│  ┌──────────────┐    ┌──────────────────────┐    ┌───────────────┐  │
│  │  INGESTION   │    │      PROCESSING      │    │    OUTPUT     │  │
│  │              │    │                      │    │               │  │
│  │  Kafka       │───▶│  Flink / Kafka       │───▶│  Redis        │  │
│  │  Kinesis     │    │  Streams DAG         │    │  Cassandra    │  │
│  │  Pub/Sub     │    │                      │    │  Snowflake    │  │
│  │              │    │  Operators:          │    │  Elasticsearch│  │
│  │  Partitioned │    │  - Filter            │    │  PostgreSQL   │  │
│  │  log-based   │    │  - Map / FlatMap     │    │  Lambda       │  │
│  │  storage     │    │  - KeyBy             │    │  (webhook)    │  │
│  └──────────────┘    │  - Window            │    └───────────────┘  │
│                       │  - Aggregation       │                       │
│                       │  - Join              │                       │
│                       │                      │                       │
│                       │  State: RocksDB      │                       │
│                       │  (local, fast)       │                       │
│                       └──────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Windowing

Windows group infinite events into finite, manageable chunks for aggregation.

### Types

```
TUMBLING WINDOW (5 min, non-overlapping):
  ├─── [0:00 - 0:05) ─── 1 window ───┤
                           ├─── [0:05 - 0:10) ─── 1 window ───┤
                                          ├─── [0:10 - 0:15) ──┤

SLIDING WINDOW (5 min window, 1 min slide):
  ├── [0:00 - 0:05) ──┤
      ├── [0:01 - 0:06) ──┤
          ├── [0:02 - 0:07) ──┤
              (overlapping — same event appears in 5 windows)

SESSION WINDOW (30s inactivity gap):
  [click, scroll, buy]  {30s silence}  [click] {30s silence} [view]
  ├────── session 1 ─────┤              ├─ s2 ─┤              ├─ s3 ─┤
  (window closes on inactivity)

GLOBAL WINDOW (never closes, custom trigger):
  [event, event, event, ... infinite ...]
  (trigger fires when count > 1000 or time > 1 min)
```

| Window Type | Memory | Use Case |
|---|---|---|
| **Tumbling** | O(keys) | Hourly totals, per-minute metrics |
| **Sliding** | O(keys × overlap_count) | Rolling averages, moving fraud scores |
| **Session** | O(keys × sessions) | User session analytics, bot detection |
| **Global** | O(total events in window) | Custom micro-batching |

---

## Event Time vs Processing Time

```
EVENT TIME:    When the event actually occurred        ← on the device  
PROCESSING TIME: When the system received the event   ← at the server

Network delay, retries, clock skew → these diverge

Mobile app offline: 
  User taps at 14:30 (event time), phone reconnects at 17:00 → server receives at 17:00 (processing time)
  Gap = 2.5 hours

Why it matters:
  Compute "revenue per minute at 14:30" → must use event time or mobile users aren't counted
  If using processing time → revenue attributed to 17:00 → wrong analytics

Flink example:
  .assignTimestampsAndWatermarks(
    WatermarkStrategy
      .<Event>forBoundedOutOfOrderness(Duration.ofMinutes(5))  // watermark
      .withTimestampAssigner((event, ts) -> event.getEventTime())
  )
```

---

## Watermarks

**Watermark** = a timestamp `W(t)` that asserts: "all events with event time ≤ t have arrived."

```
Stream: events at t=1, t=3, t=7, t=2 (late), t=5, t=11 ...

Watermark heuristic: W = max_observed_event_time − safety_margin (e.g., 5 minutes)

Timeline:
  observe t=7 → W = 7 - 5 = W(2) → window [0,5) still open
  observe t=11 → W = 11 - 5 = W(6) → window [0,5) CLOSES → emit result

Events after W(6) with t < 5 → LATE DATA
```

### Late Data Handling

| Policy | Behaviour | Trade-off |
|---|---|---|
| **Drop** | Discard events arriving after window closes | Simple; guaranteed latency; data lost |
| **Update results** | Re-emit corrected aggregation | More accurate; multiple outputs for same window |
| **Side output** | Route late events to separate stream for reprocessing | Full flexibility; operational complexity |

---

## Checkpointing & Fault Tolerance

### Chandy-Lamport Algorithm (Flink's approach)

```
Normal stream:         e1 → e2 → e3 → e4 → e5 → ...
With checkpoint barriers:  e1 → e2 → |BARRIER_1| → e3 → e4 → ...

When operator sees BARRIER_1:
  1. Snapshot all in-memory state to durable storage (S3/HDFS)
  2. Pass barrier downstream
  3. Continue processing

After all operators snapshot → checkpoint is COMPLETE

Failure at t+10ms:
  → Restore state from last complete checkpoint
  → Reset Kafka consumer offset to matching offset
  → Replay from there
  → Exactly-once semantics achieved
```

```
State backend options:
  HashMapStateBackend : in JVM heap (fast, limited by memory)
  RocksDBStateBackend : local SSD + incremental checkpoints to S3 (recommended for large state)
```

---

## Exactly-Once Semantics

```
At-most-once:  → events may be lost on failure (fast, simple)
At-least-once: → events processed at least once, duplicates on failure (common)
Exactly-once:  → each event processed exactly once (requires coordination)

Cost of exactly-once:
  - 10–30% throughput overhead
  - Requires: idempotent producers + distributed transactions (2PC) on sink
  - Common practical choice: at-least-once + idempotent operations on sink side
    (cheaper than true 2PC, effectively exactly-once behaviour)
```

### Exactly-Once in Kafka → Flink → PostgreSQL

```
1. Kafka producer: enable.idempotence=true + transactional.id set
2. Flink checkpoint: captures Kafka offset + operator state atomically
3. PostgreSQL sink: use UPSERT (ON CONFLICT DO UPDATE) so duplicates are no-ops
→ Net effect: exactly once, without 2PC overhead
```

---

## Technology Comparison

| | **Kafka Streams** | **Apache Flink** | **Spark Streaming** |
|---|---|---|---|
| **Architecture** | Library (embeds in app) | Standalone cluster or Kubernetes | Spark cluster |
| **Latency** | Sub-100ms | Sub-100ms (true stream) | 1–2s (micro-batch) |
| **Processing model** | True stream | True stream | Micro-batch |
| **State** | RocksDB embedded | RocksDB + external | In-memory / Spark memory |
| **Event time** | Basic | Full support (watermarks, allowed lateness) | Basic (in structured streaming) |
| **Exactly-once** | Yes (Kafka-only source & sink) | Yes (any source/sink with transactions) | Yes (structured streaming) |
| **Deployment** | No cluster needed | Cluster required | Spark cluster required |
| **Best for** | Kafka-native pipelines, simpler ops | Complex stateful processing, event time-sensitive | Existing Spark users, batch + stream unification |

---

## Architecture Patterns

### Lambda Architecture (dual pipeline)

```
Raw events
    │
    ├──▶  Batch Layer  (Spark, Hadoop)  →  complete, correct data  (high latency)
    │
    └──▶  Speed Layer (Kafka Streams)  →  approximate, recent data  (low latency)
                         │
                         ▼
                   Serving Layer  →  merge results  →  user query
```

**Problem**: two codebases, two sets of bugs, results must be merged.

### Kappa Architecture (stream-only)

```
Raw events stored in Kafka (long retention: 7–90 days)
    │
    └──▶  Stream Processor (Flink)  →  always-on streaming  →  output store

Reprocessing (historical):
    Use bounded Kafka source with same Flink code → same results
    → No separate batch pipeline

Advantages: single codebase, single deploy, simpler to maintain
Best for: when streaming logic can backfill historical data
```

---

## MERN Dev Notes

```javascript
// Kafka consumer with Flink-like stateful aggregations in Node.js (simplified)
import { Kafka } from 'kafkajs';
import Redis from 'ioredis';

const kafka = new Kafka({ clientId: 'stream-app', brokers: ['localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'stream-group' });
const redis = new Redis();

// Tumbling window: count page views per minute
await consumer.run({
  eachMessage: async ({ message }) => {
    const { userId, page, timestamp } = JSON.parse(message.value!.toString());

    // Bucket = minute boundary (event time windowing, simplified)
    const bucket = Math.floor(timestamp / 60000) * 60000;
    const key = `views:${page}:${bucket}`;

    // Atomic increment — idempotent if same message arrives twice
    await redis.incr(key);
    await redis.expire(key, 7200);    // 2h TTL for old windows

    // Trigger action if window threshold crossed
    const count = await redis.get(key);
    if (Number(count) > 1000) {
      console.log(`Viral page detected: ${page} at minute ${new Date(bucket)}`);
    }
  },
});
```

> **MERN note**: For production, use a dedicated stream processor (Flink, Kafka Streams in JVM) for strong exactly-once and event-time guarantees. Node.js consumers are suitable for simple stateless or Redis-backed aggregations, but not for complex stateful pipelines with backpressure and checkpointing.

---

## Real-World Examples

| Company | Setup | Scale |
|---|---|---|
| Netflix | Flink for personalization + anomaly detection; 500B events/day; petabytes of operator state; **24-hour allowed lateness** (mobile devices reconnect after a day) | 500B events/day |
| LinkedIn | Kafka Streams for member feed ranking + notification deduplication; same Kafka infrastructure; sub-500ms p99 latency | 1T events/day |
| Twitter | Sliding windows + **Count-Min Sketch** (space-efficient probabilistic structure) for hashtag trending — counts occurrences with fixed memory regardless of distinct hashtag count | 500M tweets/day |

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| What is stream processing? | Processing unbounded, continuous data as it arrives — applying stateful computations, aggregations, and transformations in real time rather than batching and reprocessing |
| What is the difference between event time and processing time? | Event time = when event occurred on the source device; processing time = when the server received the event. They diverge due to network delays, offline mobile clients, clock skew |
| What is a watermark? | A heuristic timestamp W(t) that asserts "all events with event time ≤ t have arrived." Used to decide when to close a window and emit results, allowing for bounded late arrival |
| What are the three types of windows? | Tumbling (fixed, non-overlapping), Sliding (overlapping, event appears in multiple windows), Session (closes after inactivity gap — user session-based) |
| How does Flink achieve fault tolerance? | Chandy-Lamport checkpointing: barrier markers injected into data stream; each operator snapshots state to S3/HDFS when barrier passes; on failure, restore snapshot + replay from Kafka offset |
| What is the cost of exactly-once processing? | 10–30% throughput overhead due to distributed transactions (2PC). Common alternative: at-least-once delivery + idempotent sink operations — effectively exactly-once at lower cost |
| Kafka Streams vs Flink? | Kafka Streams is a library (no separate cluster, Kafka-only sources), simpler to operate. Flink is a dedicated cluster with full event-time support, richer windowing, and any-source exactly-once. Use Kafka Streams for simpler pipelines, Flink for complex stateful event-time processing |
| What is Kappa Architecture? | A stream-only architecture that eliminates the Lambda batch pipeline. Kafka stores all raw events with long retention; the same Flink code handles both real-time and historical reprocessing using bounded Kafka reads |
| How did Netflix handle mobile events arriving hours late? | Configured Flink's **allowed lateness** to 24 hours — windows stay open for 24h past watermark; late mobile events still included in correct window aggregation |
| How does Twitter count trending hashtags with fixed memory? | Count-Min Sketch: a probabilistic hash-based data structure; frequency approximated with bounded error; requires constant memory regardless of the number of distinct hashtags |

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Stream processing** | Continuous computation on unbounded, real-time event data |
| **Batch processing** | Processing bounded, finite data sets in scheduled jobs |
| **Windowing** | Grouping infinite events into finite time-bounded or count-bounded segments for aggregation |
| **Tumbling window** | Non-overlapping fixed-size windows; each event belongs to exactly one window |
| **Sliding window** | Overlapping windows; each event may appear in multiple windows |
| **Session window** | Window that closes after a configurable inactivity gap |
| **Event time** | The time an event actually occurred (embedded in event payload) |
| **Processing time** | The time the event was received by the processing system |
| **Watermark** | Estimate of event-time progress; triggers window closure when advanced past window end |
| **Allowed lateness** | Window stays open for N time past watermark to accept late events |
| **Chandy-Lamport** | Distributed snapshot algorithm using barrier markers for consistent state capture |
| **Checkpoint** | Snapshot of all operator state + Kafka offsets; enables recovery to consistent point |
| **Exactly-once** | Each event processed exactly one time; requires distributed transactions + idempotent sinks |
| **2PC (Two-Phase Commit)** | Distributed atomic commit protocol: coordinator sends Prepare → all participants vote Yes/No → only if ALL vote Yes does coordinator send Commit. Guarantees all-or-nothing across nodes at the cost of 10–30% throughput overhead. |
| **At-least-once** | Events may be processed multiple times on failure; simpler than exactly-once |
| **RocksDB** | LSM-tree embedded key-value store used by Flink/Kafka Streams for local operator state |
| **Kafka Streams** | Java library for stateful stream processing; embedded, Kafka-native |
| **Apache Flink** | Dedicated stream + batch processing cluster with full event-time and exactly-once support |
| **Kappa architecture** | Stream-only architecture: eliminates batch pipeline by using Kafka for all historical reprocessing |
| **Lambda architecture** | Dual-pipeline: batch layer (accurate, slow) + speed layer (approximate, fast) merged at serving |
| **Count-Min Sketch** | Probabilistic data structure for frequency estimation in constant memory |
| **Backpressure** | Mechanism by which slow downstream operators slow down upstream ingestion |
