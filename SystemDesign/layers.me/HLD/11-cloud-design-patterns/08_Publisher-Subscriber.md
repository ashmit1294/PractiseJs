# T08 — Publisher-Subscriber Pattern: Fan-Out Messaging

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/publisher-subscriber

---

## ELI5 (Explain Like I'm 5)

Think of a newspaper. The printing press (publisher) prints one edition. Thousands of subscribers each get their own copy. The publisher has no idea who is reading — it just prints. Subscribers don't know who else is getting the paper — they just read.

In systems: one service publishes an event ("order placed"). Dozens of services — inventory, shipping, billing, notifications — each receive their own copy independently. They all react without the publisher knowing about any of them.

---

## Analogy

**TV broadcast**: A TV station broadcasts a signal. Every TV in range receives it. The station doesn't connect to each TV individually. When a new TV is installed, it just starts receiving the broadcast — no change at the station. That's pub/sub.

Contrast with **direct call (request/response)**: calling someone on the phone requires knowing their number. Pub/sub doesn't require knowing who's listening.

---

## Core Concept

The Publisher-Subscriber (Pub/Sub) pattern **decouples event producers from event consumers** through an intermediary topic/channel. Publishers fire events without knowing who listens. Subscribers consume events without knowing who published.

**Key mechanics:**
- **Publishers** → write to a **Topic** (named event channel)
- **Topic (Broker)** → stores and fans out to all subscribers
- **Subscribers** → each receive their own independent copy of each event
- **Fan-out ratio**: 1 message → N independent consumers (N copies created by broker)

**Critical delivery model distinction:**
- **Push (SNS, Webhooks)**: Broker delivers messages to subscriber's endpoint. Subscriber must be available. Higher coupling.
- **Pull (Kafka, SQS)**: Subscriber polls the broker. Subscriber controls its consumption rate. Better for backpressure. Preferred for most systems.

---

## ASCII Diagrams

### Core Fan-Out Architecture

```
Publisher:
  [Order Service] ──────────────────────────► Topic: "order-placed"
  [User Service] ────────────────────────────► Topic: "user-updated"
    (publishers know NOTHING about subscribers)

Broker:
  ┌─────────────────────────────────────────────┐
  │  Topic: "order-placed"                      │
  │    [msg1] [msg2] [msg3] [msg4] ...           │
  │                                             │
  │  Subscriptions:                             │
  │    → inventory-sub   (offset: 3)            │
  │    → billing-sub     (offset: 2)            │
  │    → shipping-sub    (offset: 4)            │
  │    → notification-sub (offset: 3)           │
  │    → analytics-sub   (offset: 1)            │
  └─────────────────────────────────────────────┘
              │
              ▼ Fan-out: each subscriber gets independent copy
  [InventoryService] ← its own copy
  [BillingService]   ← its own copy
  [ShippingService]  ← its own copy
  [NotifService]     ← its own copy
  [AnalyticsService] ← its own copy
```

### Push vs Pull Delivery

```
PUSH MODEL (SNS/Webhooks):
  Broker ──PUSH──► Subscriber Endpoint
         (subscriber must be UP at delivery time)
  
  + Low latency (immediate delivery)
  - No backpressure (broker overwhelms slow subscriber)
  - Subscriber must be HA (no graceful lag handling)

PULL MODEL (Kafka/SQS):
  Subscriber ──POLL──► Broker ──► delivers messages
  
  + Consumer controls rate (natural backpressure)
  + Consumer can pause and resume
  + Consumer can replay from any offset
  - Slightly higher latency (poll interval adds latency)
  
HYBRID (SNS → SQS):
  Publisher → SNS (push) → SQS Queue per subscriber (buffer)
            ► Subscriber polls SQS (pull)
  
  Best of both: reliable fan-out + backpressure per subscriber
```

### Fan-Out Challenge: 1M Follower Problem

```
Naive O(N) fan-out (PROBLEMATIC):
  User A posts tweet → loop over 1M followers → write to each feed
  → 1M database writes synchronously → 60s to complete
  
SOLUTION: Partitioned async fan-out

User A posts (1M followers)
    │
    ▼
[Fan-out Orchestrator]
    │
    ├──► Partition 1 (followers 0-100K)  → Worker 1
    ├──► Partition 2 (followers 100K-200K) → Worker 2
    ├──► ...
    └──► Partition 10 (followers 900K-1M) → Worker 10

Each worker processes 100K fan-outs in parallel.
Total time: O(N/P) instead of O(N)
```

---

## How It Works (Step by Step)

1. **Publisher sends event**: `orderService.publish('order-placed', { orderId, userId, items, total })`. No code that references `InventoryService`, `BillingService`, or any consumer. The publisher's job ends here.

2. **Broker receives and stores**: Topic `order-placed` receives the message. Broker stores it (Kafka: durable sequential log; SNS: in-memory push). Broker assigns each registered subscription a copy.

3. **Fan-out to subscribers**: Broker delivers to each subscription independently. If `billing-sub` is slow, it doesn't block `inventory-sub`. Each has its own offset/position in the message stream.

4. **Subscriber processes independently**: `BillingService` consumes, charges the card. `InventoryService` consumes, decrements stock. They run at their own pace. Neither knows the other exists.

5. **At-least-once delivery**: Most pub/sub systems deliver at least once (Kafka, SNS/SQS). Message may arrive twice (retry after network failure). Subscribers **must be idempotent** — processing the same event twice must produce the same result.

6. **Handle failures**: If `BillingService` fails to process: DLQ after N retries. Other subscribers (Inventory, Shipping) are unaffected — they have independent subscriptions.

---

## Variants

| Variant | Description | Example |
|---------|-------------|---------|
| **Topic-Based** | All events on a topic go to all subscribers | Kafka topics, basic SNS |
| **Content-Based** | Subscribers declare filters; only matching events delivered | AWS EventBridge rules (`detail.type = "payment-failed"`) |
| **Hierarchical Topics** | Topics nested in a tree (`/sensors/us-east/temperature`) | MQTT for IoT devices |
| **Durable Subscriptions** | Messages retained while subscriber is offline; delivered on reconnect | Kafka consumer groups with committed offsets |
| **Ephemeral Subscriptions** | Messages lost if subscriber is offline | WebSocket push, Redis pub/sub |

---

## Trade-offs

| Consideration | Detail |
|---------------|--------|
| **Decoupling** | Publisher and subscribers evolve independently — add new subscriber with zero publisher changes |
| **At-least-once delivery** | Subscribers must be idempotent (use event ID to dedup) |
| **Exactly-once** | Hard to achieve; Kafka transactions + transactional outbox help. Needed for billing, inventory |
| **Fan-out cost** | 10M subscribers × large message = enormous broker storage; use claim-check pattern (publish reference pointing to S3, not actual payload) |
| **Message ordering** | Within a partition: guaranteed. Across partitions: not guaranteed. For ordered processing, use partition key = entity ID |
| **Debugging complexity** | Event-driven systems are harder to trace; require correlation IDs and distributed tracing |

---

## When to Use (and When Not To)

**Use when:**
- Multiple independent consumers need to react to the same event
- Publisher and consumers should evolve independently (different teams, deployment schedules)
- Building event-driven architecture where downstream reactions can happen asynchronously
- Fan-out required (one event → many services notified)

**Avoid when:**
- Publisher needs to know the result of processing (use request/response instead)
- Only one consumer exists and it will always be only one (overkill)
- Strong ordering guarantee required across all subscribers (use synchronous chain instead)
- Exactly-once is critical and you don't have infrastructure for transactional pub/sub

---

## MERN Developer Notes

```javascript
// Express.js order service — pure publisher, no consumer knowledge
const eventBus = new EventBridgeClient({ region: 'us-east-1' });

app.post('/orders', async (req, res) => {
  const order = await db.orders.create(req.body);
  
  // Publish event — no knowledge of who listens
  await eventBus.send(new PutEventsCommand({
    Entries: [{
      Source: 'order-service',
      DetailType: 'order-placed',
      Detail: JSON.stringify({ orderId: order.id, userId: order.userId, total: order.total }),
      EventBusName: 'default'
    }]
  }));
  
  res.json({ orderId: order.id });
  // Order service is DONE — doesn't wait for inventory/billing/shipping
});

// Subscriber: inventory service — completely independent
// EventBridge rule routes 'order-placed' events to this Lambda
exports.handler = async (event) => {
  const { orderId, items } = event.detail;
  const idempotencyKey = `inventory-deduct-${orderId}`;
  
  // Idempotency guard — safe to process same orderId twice
  const alreadyProcessed = await redis.get(idempotencyKey);
  if (alreadyProcessed) return;
  
  await inventory.deductStock(items);
  await redis.set(idempotencyKey, '1', 'EX', 86400); // 24h TTL
};

// Content-based filtering with AWS EventBridge
// Only deliver high-risk payment events to fraud service
{
  "source": ["payment-service"],
  "detail-type": ["payment-processed"],
  "detail": {
    "riskScore": [{ "numeric": [">", 0.8] }]  // EventBridge filter pattern
  }
}
```

**Kafka Node.js consumer with durable subscription:**
```javascript
const consumer = kafka.consumer({ groupId: 'inventory-service' });
await consumer.subscribe({ topic: 'order-placed', fromBeginning: false });

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const event = JSON.parse(message.value.toString());
    await processOrderPlaced(event); // must be idempotent
    // Kafka auto-commits offset after successful processing
  }
});
```

---

## Real-World Examples

| Company | Implementation | Key Detail |
|---------|---------------|-----------|
| **Netflix** | Viewing events → 30+ subscribers | Subscribers: recommendations engine, billing (for intro billing model), A/B experiment tracking, trending detection, thumbnail personalization, continue-watching update. 10M events/sec. Adding a new subscriber = zero Netflix publisher changes. |
| **Uber** | Trip lifecycle events | Content-based routing to geographic regions (only deliver NYC trip events to NYC consumers). Result: 90% traffic reduction vs. broadcast to all. Durable subscriptions: drivers momentarily offline still receive events on reconnect. |
| **GCP Cloud Logging** | Log streaming | 500M messages/sec. Exactly-once delivery for billing events (Pub/Sub Lite with Kafka-style semantics). At-least-once for monitoring observability (idempotent — double-counting a metric is acceptable). |
| **Instagram** | 1M follower fan-out | Celery task queue for fan-out. When Kim Kardashian posts, partitioned fan-out job pushes to N Celery workers each handling a follower partition. Cold cache: pull from DB. Warm cache: read from user's personalized Redis feed list. |

---

## Interview Cheat Sheet

### Q: How does pub/sub differ from point-to-point messaging (like a standard queue)?
**A:** In point-to-point (SQS), one producer sends to one queue, and exactly one consumer processes each message — competing consumers. In pub/sub, one publisher sends to a topic, and **all subscribers** get their own independent copy. Use point-to-point for work distribution (e.g., job queue). Use pub/sub for event notification where multiple services need to react.

### Q: What does "at-least-once delivery" mean and what is required of subscribers?
**A:** At-least-once means the broker guarantees every message will be delivered to each subscriber, but may deliver it more than once due to retries or network failures. Subscribers **must be idempotent**: processing the same event twice must produce the same result. Implement with a deduplication key (event ID) stored in Redis/DB — check before processing, mark as done after.

### Q: How would you design fan-out for a user with 10 million followers?
**A:** Don't do synchronous fan-out inline (O(N) database writes). Partition followers into buckets (e.g., 100 buckets × 100K followers each). Publish a fan-out task per bucket to a work queue. Worker processes each partition in parallel — O(N/P) time. For celebrity accounts (>10M followers), use lazy fan-out: don't pre-fan-out; merge celebrity's latest post at read time (hybrid push/pull).

### Q: When would you use content-based filtering (AWS EventBridge) vs. multiple separate topics?
**A:** Use content-based filtering when events are structurally similar (same `OrderEvent` type) but subscribers only care about subsets (fraud service only wants `riskScore > 0.8`). EventBridge filter patterns avoid subscriber-side filtering logic. Use separate topics when event types are fundamentally different in structure — separate `order-placed` and `payment-failed` topics.

---

## Red Flags to Avoid

- Non-idempotent subscribers (ask: "what happens if this event is delivered twice?")
- Ignoring the fan-out cost for very large subscriber counts (ask: "how will you handle 1M follower fan-out?")
- No dead-letter queue for failed subscriber processing
- Mixing concerns: publisher code with imports/references to subscriber services (defeats decoupling)
- Not addressing distributed tracing (how do you debug when event flows through 10 services?)

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Publisher** | Service that creates and publishes events to a topic; has no knowledge of subscribers |
| **Subscriber** | Service that declares interest in a topic; receives and processes events independently |
| **Topic** | Named event channel; events are published to topics, subscribers subscribe to topics |
| **Fan-out** | One message delivered to all N subscribers independently; N copies created by broker |
| **At-least-once Delivery** | Every message is delivered to each subscriber, possibly more than once |
| **Exactly-once Delivery** | Each message delivered to each subscriber exactly once; requires Kafka transactions or equivalent |
| **Idempotency** | Processing the same event twice produces the same result; required for at-least-once systems |
| **Durable Subscription** | Subscriber retains its position; messages accumulate while offline and delivered on reconnect |
| **Ephemeral Subscription** | Messages lost if subscriber is offline; no persistence |
| **Push Delivery** | Broker actively delivers to subscriber endpoint (SNS, WebSockets) |
| **Pull Delivery** | Subscriber polls broker for messages (Kafka, SQS) — better for backpressure |
| **Content-Based Filtering** | Subscriber declares message attribute rules; only matching events are delivered (EventBridge) |
| **Fan-out Orchestrator** | Service responsible for distributing an event to many destinations in parallel |
| **Offset** | Kafka term: subscriber's current read position within a topic partition; enables replay |
| **Consumer Group** | Kafka concept: multiple subscriber instances sharing work on a topic, each message processed by exactly one |
