# Message Queues: Kafka, RabbitMQ & SQS Guide

> **Source**: https://layrs.me/course/hld/08-asynchronous-processing/message-queues  
> **Difficulty**: Intermediate | **Read time**: 17 min

---

## ELI5

A message queue is like a postal sorting office between two departments in a company. The Sales team (producer) drops order forms in a tray. The Fulfilment team (consumer) picks them up when ready. If Fulfilment is slow, orders stack in the tray — but Sales never blocks. If Fulfilment crashes over lunch, the forms are still there when they return.

---

## Analogy — Restaurant Ticket Rail

The waiter (producer) pins a docket to the kitchen rail (queue). The chef (consumer) takes dockets in order, cooks, and discards the docket. If the kitchen gets slammed, dockets pile up — but the waiter keeps seating customers. The rail is the queue; the docket is the message.

---

## Core Concepts

### Four Components

| Component | Role |
|---|---|
| **Producer** | Serialises message, publishes to broker |
| **Broker** | Persists messages to durable storage, manages metadata |
| **Queue / Topic** | Ordered, durable storage of messages (log or fifo) |
| **Consumer** | Pulls messages, processes them, acknowledges completion |

### Message Lifecycle
```
Producer                  Broker           Consumer
  │                          │                │
  │── Publish message ───►  │                │
  │                          │── Persist ──►  │ (disk / replicas)
  │◄── ACK (durable) ──────  │                │
  │                          │── Deliver ──►  │
  │                          │   (in-flight)  │── Process ──►
  │                          │◄── ACK ───────  │
  │                          │── Delete ──►   │
  │                          │  (or advance   │
  │                          │   offset)      │
```

---

## Delivery Guarantees

| Guarantee | Mechanism | Duplicates? | Data Loss? | Performance |
|---|---|---|---|---|
| **At-most-once** | Send + forget, no ACK | ❌ Never | ✅ Possible | ⚡ Fastest |
| **At-least-once** | ACK required; redeliver on timeout | ✅ Possible | ❌ Never | ⚡ Fast |
| **Exactly-once** | Idempotent producer + transactional consumer | ❌ Never | ❌ Never | 🐢 30% slower |

> **Rule of thumb**: Use at-least-once + idempotent consumers for most systems. Exactly-once only when you can't tolerate duplicates AND have transactional infrastructure.

### Visibility Timeout (at-least-once)
```
Consumer pulls message → broker marks "in-flight" for 30s
  If ACK arrives:      → message deleted ✅
  If no ACK in 30s:    → message becomes visible again → redelivered to another consumer
```
→ Requires **idempotent consumers** to handle re-delivery.

---

## Message Ordering

| Strategy | How | Trade-off |
|---|---|---|
| **FIFO (single partition)** | Total global order | Only 1 consumer; ~1K–10K msg/s max |
| **Partition-based order** | Same key → same partition → FIFO within key | Parallel across keys; order within key only |
| **Priority queue** | Higher priority messages pulled first | Max throughput; no ordering guarantee |

```
Kafka Partition-Based (Uber dispatch — partitioned by city):
  SF rides → Partition 0 → Consumer 1  (FIFO within SF)
  NY rides → Partition 1 → Consumer 2  (FIFO within NY)
  LA rides → Partition 2 → Consumer 3  (FIFO within LA)
  ─ all 3 consumers run in parallel, 3x throughput ─
```

---

## Dead Letter Queue (DLQ)

```
Message fails processing → retry #1 → retry #2 → retry #3 → MOVE TO DLQ
                                                                    ↓
                                                           Alert + manual review
                                                           Fix root cause + replay
```

**Poison messages** = messages that always crash the consumer (malformed JSON, invalid FK, downstream service down).  
DLQ prevents one bad message from blocking the entire queue indefinitely.

---

## Technology Comparison

| | Kafka | RabbitMQ | AWS SQS |
|---|---|---|---|
| **Model** | Distributed commit log; consumer tracks offset | Traditional queue; broker manages delivery | Managed cloud queue |
| **Throughput** | 1M+ msg/s per cluster | 5–50K msg/s | Auto-scales (millions/s) |
| **Latency** | 10–50ms (optimised for throughput) | 5–10ms | 20–100ms |
| **Message retention** | Configurable retention (days/weeks) | Deleted after ACK | 1 min – 14 days |
| **Message replay** | ✅ Yes (reset consumer offset) | ❌ No | ❌ No |
| **Ordering** | Per-partition FIFO | Queue FIFO | Best-effort (FIFO queue option) |
| **Exactly-once** | ✅ With transactions | ❌ | ❌ (FIFO queue deduplication only) |
| **Routing** | By topic/partition | Flexible exchanges (topic, direct, fanout, headers) | Simple; separate queues |
| **Ops overhead** | High (Kafka cluster, ZooKeeper/KRaft) | Moderate (cluster setup) | Zero (fully managed) |
| **Best for** | High-throughput streaming, event replay, analytics | Complex routing, low-latency delivery | Zero-ops, AWS ecosystem, unpredictable scale |

---

## Kafka Internals

```
Topic: "ride-requests" (3 partitions, replication factor 3)

Partition 0: [ msg0 | msg1 | msg3 | msg6 ]  offset: 0 → 3
Partition 1: [ msg2 | msg4 | msg7 ]         offset: 0 → 2
Partition 2: [ msg5 | msg8 | msg9 ]         offset: 0 → 2

Consumer Group A (real-time matching):
  Consumer 1 → Partition 0, offset 3
  Consumer 2 → Partition 1, offset 2
  Consumer 3 → Partition 2, offset 1 ← behind, lagging

Consumer Group B (analytics):
  Consumer 1 → All partitions, offset 0 (replaying history)
```

- Messages **never deleted until retention period** — multiple consumer groups read independently
- **Producer deduplication**: each message has `producer_id + sequence_number` → broker deduplicates

---

## Performance Numbers

| | Single broker throughput | p99 latency |
|---|---|---|
| Kafka | 100K+ msg/s (batching + compression) | 50ms |
| RabbitMQ | 20–50K msg/s (persistent) | 5–10ms |
| AWS SQS | 3K msg/s (300 without batch) — auto-scales | 20–100ms |
| Redis Lists | 50K+ msg/s | <1ms |

---

## When to Use

**Use message queues when:**
- Components operate at different speeds (load levelling)
- Operations are too slow for synchronous request cycle
- Resilient inter-service communication (service unavailability should not cascade)
- Fan-out: one event triggers multiple independent consumers

**Avoid when:**
- Synchronous response required (use HTTP/gRPC instead)
- Sub-millisecond latency required (use shared memory or Redis pub/sub)
- Long-term data storage needed (use a database)
- High-throughput event processing with stateful aggregations (use stream processor)

**Technology selection:**
- Need replay + high throughput + exactly-once → **Kafka**
- Need flexible routing + low latency → **RabbitMQ**
- Need zero ops + AWS ecosystem → **SQS**
- Need sub-ms + can tolerate loss → **Redis**

---

## MERN Dev Notes

```javascript
// Bull (Node.js) — Redis-backed task/message queue
const Queue = require('bull');
const emailQueue = new Queue('email', { redis: { host: 'localhost', port: 6379 } });

// Producer (API layer)
emailQueue.add({ to: 'user@example.com', subject: 'Welcome!' });

// Consumer (worker process)
emailQueue.process(async (job) => {
  await sendEmail(job.data); // retried automatically on throw
});

// For pub/sub fan-out, use Redis pub/sub or Kafka (kafkajs)
const { Kafka } = require('kafkajs');
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();
await producer.send({ topic: 'order-placed', messages: [{ value: JSON.stringify(order) }] });
```

---

## Real-World Examples

| Company | System | Implementation |
|---|---|---|
| Uber | Dispatch | Kafka, partitioned by city; multiple consumer groups (matching, ETA, fare, notifications) |
| Slack | Push notifications | SQS; exponential backoff via visibility timeout extension; DLQ after 3 days |
| Netflix | Video encoding | Custom SQS + S3; 12-hour visibility timeout for long encodes; 1M+/day |

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| At-least-once vs exactly-once? | At-least-once: ACK protocol, no loss, duplicates possible → need idempotent consumers; Exactly-once: idempotent producer + transactional consumer, 30% slower |
| What is a dead letter queue? | Queue for messages that failed all retries; prevents poison messages blocking the main queue; triggers alerts for manual review |
| How does Kafka maintain ordering? | Per-partition FIFO; messages with the same key go to the same partition → order within that key guaranteed |
| Kafka vs SQS — when to choose? | Kafka: replay, >100K msg/s, exactly-once, complex consumers; SQS: zero ops, AWS ecosystem, unpredictable burst scale |
| What is a visibility timeout? | Time the broker hides a message after delivery; if no ACK by deadline, message reappears for redelivery |
| How does Kafka differ from RabbitMQ fundamentally? | Kafka = distributed commit log (consumers track offsets, messages retained); RabbitMQ = traditional queue (broker tracks delivery, messages deleted after ACK) |
| What is consumer group lag? | Difference between latest offset and consumer's current offset; monitoring metric indicating processing backlog |
| RabbitMQ vs Kafka for routing? | RabbitMQ: exchanges (direct, topic, fanout, headers) enable complex routing; Kafka: routing only by topic + partition key |

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Broker** | Server that manages queues/topics, message persistence, and delivery |
| **Topic** | Named channel in Kafka; messages published here, consumers subscribe |
| **Partition** | Unit of parallelism in Kafka; physically separate ordered log within a topic |
| **Consumer group** | Set of consumers sharing work; each partition assigned to one member |
| **Offset** | Position in a Kafka partition; each consumer group tracks its own offset |
| **Visibility timeout** | Time a message is hidden from other consumers after being delivered (SQS, RabbitMQ) |
| **At-least-once** | Every message delivered ≥ 1 time; duplicates possible |
| **Exactly-once** | Every message processed exactly once; requires transactions across producer + consumer |
| **DLQ** | Dead Letter Queue — receives messages after retry exhaustion |
| **Poison message** | Message that always fails processing, repeatedly crashing consumers |
| **Fan-out** | One message → multiple consumers (e.g. fanout exchange in RabbitMQ, multiple consumer groups in Kafka) |
| **Commit log** | Kafka's core abstraction: append-only, immutable, retained log |
