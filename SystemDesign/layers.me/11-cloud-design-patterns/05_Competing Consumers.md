# T05 — Competing Consumers Pattern: Parallel Message Processing

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/competing-consumers

---

## ELI5 (Explain Like I'm 5)

Imagine a pizza shop with one phone and a huge rush of orders. One person answering phones can't keep up — orders pile up, customers wait forever.

Now imagine hiring 10 phone operators. Each one grabs the next incoming call, handles it, and is immediately available for the next call. No one tells them which call to take — they just all compete to answer the next ringing phone. This is Competing Consumers: multiple workers competing to pick up the next item from the queue.

---

## Analogy

**Checkout lanes in a supermarket**: There's one queue of customers (message queue). Multiple cashiers (competing consumers) are open. Each cashier takes the next customer in line. No one coordinates which cashier gets which customer — they just compete to serve the next person. Add more cashiers when lines are long; close lanes when it's quiet.

---

## Core Concept

The Competing Consumers pattern enables **multiple concurrent workers to process messages from the same queue**, with each message handled by **exactly one consumer**. The message broker handles distribution — consumers "compete" to pull the next message.

Key properties:
- **Automatic load balancing**: fast consumers process more, slow consumers process fewer
- **Horizontal scalability**: add workers to increase throughput; remove when quiet
- **Fault tolerance**: if one worker crashes, others continue
- **No coordination code**: the broker handles distribution, not your application

This pattern is the foundation of modern event-driven architectures. Netflix (video encoding), Uber (trip matching), and Stripe (webhook delivery) all rely on competing consumers at massive scale.

---

## ASCII Diagrams

### The Core Problem

```
WITHOUT COMPETING CONSUMERS:
  Queue: [msg1][msg2][msg3]...[msg10000]
    │
    └──► Single Consumer (1,000 msg/s capacity)
         Queue grows by 9,000 messages/second → unbounded backlog!

WITH COMPETING CONSUMERS:
  Queue: [msg1][msg2][msg3]...[msg10000]
    │
    ├──► Consumer 1 (1,000 msg/s)  ┐
    ├──► Consumer 2 (1,000 msg/s)  │  All 10 consumers = 10,000 msg/s total
    ├──► Consumer 3 (1,000 msg/s)  │  Queue stays empty! Low latency.
    ├──► ...                        │
    └──► Consumer 10 (1,000 msg/s) ┘
```

### Visibility Timeout / Message Locking

```
QUEUE                CONSUMER A           CONSUMER B
  │                      │                    │
  │── deliver msg1 ──────►│                   │
  │   (start 30s timeout) │                   │
  │                       │── processing...   │
  │── deliver msg2 ────────────────────────►  │
  │   (start 30s timeout)                     │── processing...
  │                       │── ACK msg1 ───────►│
  │                       │   (delete msg1)   │
  │                               ── CRASH! ──│
  │── (30s expires, msg2 becomes visible again)
  │── deliver msg2 ──────►│ (Consumer A picks it up, retries)
  │── msg2: 3rd failure ───────────────────────────────► Dead Letter Queue
```

### Dynamic Auto-Scaling

```
9 AM (low load):   Queue: 100 msgs   → 3 consumers   healthy
12 PM (peak):      Queue: 10,000 msgs → scale up → 30 consumers
12:05 PM (stable): Queue: 2,000 msgs  → 30 consumers draining
3 PM (declining):  Queue: 50 msgs     → scale down → 5 consumers

Scaling trigger: queue depth / messages per consumer > threshold
```

### Kafka Consumer Groups (Partition-Based)

```
Kafka Topic: "playlist-updates" (4 partitions)
  P0 [UserA, UserE, UserI msgs] ──► Consumer 1
  P1 [UserB, UserF, UserJ msgs] ──► Consumer 2
  P2 [UserC, UserG, UserK msgs] ──► Consumer 3
  P3 [UserD, UserH, UserL msgs] ──► Consumer 4 (or shared with Consumer 3)

✓ Ordering guaranteed WITHIN each partition (all UserA msgs in order)
✓ Parallelism ACROSS partitions (different users processed simultaneously)
✗ Maximum consumers = number of partitions (can't add 5th consumer to 4 partitions)
```

---

## How It Works (Step by Step)

1. **Queue setup**: Messages arrive at shared queue (SQS/RabbitMQ/Kafka). 10,000 playlist updates/second at peak.

2. **Consumer polling**: 50 containers running identical code all poll the queue. Broker uses internal locking to ensure only one consumer gets each message (SQS: visibility timeout; RabbitMQ: prefetch + ACK; Kafka: consumer group coordination).

3. **Message distribution**: Consumer A pulls msg1 → broker marks it "in-flight" (30s visibility timeout). Consumer B pulls msg2. Consumer C pulls msg3. All 50 work in parallel on different messages.

4. **Acknowledgment**: After processing, Consumer A sends ACK → broker permanently deletes msg1. If Consumer A crashes before ACK, timeout expires → msg2 becomes visible → another consumer retries.

5. **Poison messages**: If msg5 causes Consumer D to crash 3x → broker moves it to Dead Letter Queue (DLQ) for investigation. Prevents one bad message from blocking the pipeline.

6. **Auto-scaling**: Queue depth grows from 1K to 10K → auto-scaler launches 50 more consumers → throughput doubles. Load drops → consumers terminate. No code changes.

**Capacity formula**: consumers needed = (arrival rate × processing time per message) × 1.2 (20% overhead for retries/failures)
- Example: 10,000 msg/s, 100ms/message → need 1,000 consumers. With overhead: 1,200.

---

## Variants

| Variant | Description | When |
|---------|-------------|------|
| **Consumer Groups (Kafka-style)** | Broker partitions queue across group members; each partition assigned to one consumer; ordering within partition | Need parallelism + per-entity ordering |
| **Prefetch-based Distribution (RabbitMQ-style)** | Each consumer specifies prefetch count (N unacknowledged messages max); fast consumers get more | Variable processing time per message |
| **Priority Consumers** | Consumers pull from high-priority queues first; fall back to normal queues when empty | SLA tiers (premium vs free users) |

---

## Trade-offs

| Dimension | Decision |
|-----------|---------|
| **Throughput vs. Ordering** | No ordering → max throughput (use for commutative, idempotent operations). Need ordering → Kafka partitioning (balance both). |
| **At-least-once vs. Exactly-once** | At-least-once: simpler, faster, requires idempotent handlers. Exactly-once: complex, slower, use for financial transactions. |
| **Consumer count vs. Cost** | More consumers = lower latency + higher cost. Calculate: cost per message vs. latency SLA. |

---

## When to Use (and When Not To)

**Use Competing Consumers when:**
- Queue depth grows faster than single consumer can handle
- Message processing is stateless or idempotent
- Need horizontal scalability (add consumers = linearly more throughput)
- Message ordering is not critical (or can be partitioned)
- Variable load patterns (scale up/down dynamically)

**Avoid Competing Consumers when:**
- **Strict global ordering** required (use single consumer or event sourcing)
- **Complex message dependencies** (msg B requires results from A and C — use workflow orchestration)
- **Bottleneck is downstream**, not the consumer (100 DB writes/sec limit → more consumers = more DB contention)
- **Processing is not idempotent** and can't be made idempotent (duplicates → data corruption)

---

## MERN Developer Notes

```javascript
// Competing Consumers with SQS (AWS SDK v3, Node.js)
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand,
        ChangeMessageVisibilityCommand } = require('@aws-sdk/client-sqs');

const sqs = new SQSClient({ region: 'us-east-1' });
const QUEUE_URL = process.env.QUEUE_URL;
const MAX_PROCESSING_TIME_MS = 25000; // extend visibility if processing takes longer

// Worker — run N instances of this for competing consumers
async function processMessages() {
  while (true) {
    const { Messages } = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 10,       // batch up to 10 (reduces API calls)
      VisibilityTimeout: 30,          // 30 seconds to process before redelivery
      WaitTimeSeconds: 20             // long polling (reduces empty responses)
    }));

    if (!Messages?.length) continue;

    await Promise.all(Messages.map(async (msg) => {
      const data = JSON.parse(msg.Body);

      // MUST be idempotent — this message may be delivered multiple times
      const alreadyProcessed = await redis.get(`processed:${msg.MessageId}`);
      if (alreadyProcessed) {
        await deleteMessage(msg.ReceiptHandle); // delete duplicate, don't reprocess
        return;
      }

      try {
        await processPlaylistUpdate(data);
        await redis.set(`processed:${msg.MessageId}`, '1', { EX: 86400 }); // 24h dedup
        await deleteMessage(msg.ReceiptHandle);
      } catch (err) {
        console.error('Processing failed:', err);
        // Don't delete — let visibility timeout expire → automatic retry
        // After maxReceiveCount retries → SQS auto-moves to DLQ
      }
    }));
  }
}

async function deleteMessage(receiptHandle) {
  await sqs.send(new DeleteMessageCommand({ QueueUrl: QUEUE_URL, ReceiptHandle: receiptHandle }));
}
```

**Key metrics to monitor:**
- `ApproximateNumberOfMessages` — queue depth (primary scaling trigger)
- `ApproximateAgeOfOldestMessage` — how long oldest message has been waiting
- DLQ depth — if growing, you have systematic processing failures
- Consumer lag (Kafka) — how far behind each consumer group is

**Kubernetes HPA based on queue depth:**
```yaml
# Scale on SQS queue depth via KEDA
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
spec:
  triggers:
    - type: aws-sqs-queue
      metadata:
        queueURL: "https://sqs.us-east-1.amazonaws.com/..."
        queueLength: "50"   # scale up when > 50 messages/consumer
```

---

## Real-World Examples

| Company | System | Details |
|---------|--------|---------|
| **Netflix** | Video Encoding | Videos split into chunks → SQS queue. Hundreds of EC2 instances. Scales to thousands during new season releases. Priority queues: premium content encoded first. Processes 1 PB/day. |
| **Uber** | Trip Matching | Each ride request = Kafka message. Kafka partitioning by geographic region → locality + parallelism. Consumer count adjusts by time of day and location (500 consumers Friday night Manhattan vs. 5 Tuesday morning small city). |
| **Stripe** | Webhook Delivery | Each webhook = SQS message. Consumers make HTTP POST to merchant endpoints. Slow merchant doesn't block others. Dedicated consumer pools per high-volume merchant (Amazon, Shopify). |
| **Spotify** | Playlist Generation | Collaborative playlist changes → recommendation recompute jobs. Variable load requires dynamic scaling. Partitioned by playlist ID for ordering. |

---

## Interview Cheat Sheet

### Q: How does a message broker ensure each message processed by only one consumer?
**A:** SQS: **visibility timeout** — message becomes invisible when received; becomes visible again after timeout if no ACK. RabbitMQ: **acknowledgments** + prefetch — broker tracks unacknowledged messages per consumer. Kafka: **consumer group coordination** — partition leader assigns each partition to exactly one consumer in group.

### Q: What is a poison message and how do you handle it?
**A:** A message that repeatedly causes consumer failures (malformed data, unhandleable state). Handle with: (1) retry limit (3-5 attempts), (2) move to Dead Letter Queue after limit exceeded, (3) alert on DLQ depth, (4) investigate + fix or manually discard.

### Q: How do you make message processing idempotent?
**A:** (1) Track processed message IDs in cache/DB (deduplication). (2) Design naturally idempotent operations (SET vs. INCREMENT, upsert vs. insert). (3) Use database constraints (unique index) that fail silently on duplicates. (4) Include a sequence number — skip if already seen a higher sequence.

### Q: What's wrong with using CPU utilization (instead of queue depth) to scale consumers?
**A:** High CPU = consumers are busy, but might mean they're all stuck on one slow message. Low CPU + growing queue = consumers finishing fast but not enough of them. Queue depth directly measures "how long until this message gets processed" — the metric that matters for latency SLAs.

### Q: 1,000 consumers but throughput isn't increasing linearly. Why?
**A:** (1) Downstream bottleneck — DB can only do 100 writes/sec regardless of consumer count. (2) Message skew — a few "expensive" messages monopolize consumers. (3) Consumer group rebalancing overhead (Kafka). (4) Network saturation. (5) Broker becoming the bottleneck. Profile at each layer.

### Red Flags to Avoid
- Claiming competing consumers guarantee exactly-once (they provide at-least-once by default)
- Not mentioning idempotency requirements for at-least-once delivery
- Ignoring poison message handling (one bad message can block the entire queue)
- Assuming linear scalability without checking downstream bottlenecks
- Using CPU utilization (instead of queue depth) as scaling trigger

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Competing Consumers** | Multiple independent worker instances pulling from the same queue; each message processed by exactly one |
| **Visibility Timeout** | SQS mechanism — message invisible to other consumers for N seconds while being processed; redelivered if not ACK'd |
| **Message Acknowledgment (ACK)** | Signal from consumer to broker confirming successful processing; broker permanently deletes message after ACK |
| **Dead Letter Queue (DLQ)** | Queue receiving messages that failed processing after maxReceiveCount retries |
| **Prefetch Count** | RabbitMQ setting — max unacknowledged messages delivered to one consumer at a time |
| **Consumer Group** | Kafka concept — named group of consumers; each partition assigned to exactly one consumer in group |
| **Partition** | Sub-division of a Kafka topic enabling parallelism; ordering guaranteed within partition |
| **Poison Message** | Message that repeatedly causes consumer crashes; should be moved to DLQ for investigation |
| **Idempotency** | Processing the same message multiple times produces the same result as once |
| **At-least-once Delivery** | Guarantee that messages are delivered ≥1 times; may duplicate on consumer crash before ACK |
| **Exactly-once Delivery** | Guarantee that messages processed precisely once; requires distributed transactions or deduplication |
| **Auto-scaling** | Automatically adding/removing consumers based on queue depth metrics |
| **Long Polling** | SQS feature: connection stays open (up to 20s) waiting for messages — reduces empty responses and cost |
| **KEDA** (Kubernetes Event-Driven Autoscaling) | Kubernetes component that scales deployments based on external metrics like SQS queue depth |
| **Consumer Lag** | Kafka metric: difference between latest message offset and consumer's current offset |
| **Backpressure** | Mechanism to signal upstream producers to slow down when consumers are overwhelmed [→ Full detail: T01 Messaging Patterns Overview] |
