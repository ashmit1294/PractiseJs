# Event-Driven Architecture: Decoupled Systems That React

> **Module 5 — Application Architecture**  
> Source: https://layrs.me/course/hld/05-application-architecture/event-driven-architecture

---

## ELI5 — Explain Like I'm 5

Imagine a radio station. The station broadcasts a song — that's the **event**. Thousands of people with their radios tuned to the station all hear it simultaneously. The station doesn't know who's listening, and it doesn't wait for any listener to finish before broadcasting the next song.

That's event-driven architecture: components **emit events** into a **broker**, and **consumers react** independently — without direct knowledge of each other.

---

## Analogy

| Traditional (Request-Response) | Event-Driven |
|---|---|
| Waiter goes to each table, takes order, delivers to kitchen directly | Customer puts order slip on a belt; kitchen grabs it when ready |
| Caller waits on the phone until done | Caller leaves a voicemail; recipient handles it later |
| Order service directly calls payment, inventory, email, notifications | Order service emits "OrderPlaced"; each service reacts on its own |

**Key difference**: in EDA, the producer doesn't know or care what happens after it emits an event.

---

## Core Concept

A **request** is a command (imperative, expects a result now).  
An **event** is a fact (past-tense, immutable: "this thing happened").

```
REST (Request-Response):
  POST /process-order  ──►  OrderService ──► PaymentService ──► InventoryService ──► EmailService
  (all coupled, one slow step blocks all)

Event-Driven:
  OrderService emits:  { "event": "OrderPlaced", "orderId": "abc123", "ts": 1720000000 }
                                       │
                               Message Broker (Kafka / RabbitMQ)
                               ┌───────┼───────┐
                               ▼       ▼       ▼
                          Payment  Inventory  Email
                          Service  Service    Service
                        (each processes independently, in parallel)
```

Events are **past-tense** (describing what happened):  
✅ `OrderPlaced`, `PaymentProcessed`, `UserSignedUp`, `PostLiked`  
❌ `ProcessOrder`, `DoPayment`, `SendEmail` (these are commands, not events)

---

## Key Patterns

### 1. Pub-Sub (Publish-Subscribe)

Producer publishes to a **topic**. Every subscribing consumer receives a copy.

```
Publisher: PostLiked event ──► Kafka topic: "user-actions"
                                    │
                  ┌─────────────────┼───────────────────┐
                  ▼                 ▼                   ▼
          Notification           Analytics          Feed Ranking
          Consumer               Consumer            Consumer
```

Examples: Kafka topics, RabbitMQ fanout exchanges, AWS SNS.

---

### 2. Event Sourcing

**The event log is the source of truth.** Current state is derived by replaying all events.

```
Events (append-only log):
  1. AccountCreated   { userId: "u1", name: "Alex" }
  2. MoneyDeposited   { userId: "u1", amount: 1000 }
  3. MoneyWithdrawn   { userId: "u1", amount: 200 }
  4. MoneyDeposited   { userId: "u1", amount: 500 }

Current state = replay: balance = 0 + 1000 - 200 + 500 = 1300

Benefits: full audit trail, time-travel debugging, replay to fix bugs
Trade-offs: eventual consistency, snapshot optimization needed for long histories
```

---

### 3. CQRS (Command Query Responsibility Segregation)

Separate the **write model** (accepts commands, emits events) from the **read model** (optimized for queries).

```
Write side:  POST /orders ──► Command Handler ──► emits OrderPlaced event
                                                         │
                                                   Event Store (Kafka / EventStoreDB)
                                                         │
Read side:   Projection builds optimized read model ◄───┘
             GET /orders/:id ──► Read Model (denormalized, fast)
```

Scales read and write independently. Typical: write: 1K req/s, read: 100K req/s.

---

### 4. Event Streaming

Unlike traditional queues (consume = delete), **event streams are persistent logs**. Consumers can rewind to any offset.

```
Kafka Topic (30-day retention):
  Offset: 0────1────2────3────4────5────6────7────8──► (new events)
                         ▲                    ▲
                     Consumer A           Consumer B
                     (at offset 3)        (at offset 8, real-time)

Consumer A is catching up (re-processing or recovery).
Consumer B is real-time.
```

---

### 5. Saga Pattern (Distributed Transactions)

Long-running transactions across multiple services, where each step emits an event that triggers the next.

**Choreography** (simple 3–4 steps): services react to each other's events autonomously.

```
OrderPlaced ──► PaymentService.reserve()
    PaymentReserved ──► InventoryService.reserve()
        InventoryReserved ──► ShippingService.schedule()
            ShipmentScheduled ──► OrderService.markComplete()
```

**Orchestration** (complex 5+ steps): a central Saga Orchestrator issues commands and handles compensating transactions on failure.

```
SagaOrchestrator:
  1. Command: PaymentService.reserve() ──► success
  2. Command: InventoryService.reserve() ──► FAIL
  3. Compensation: PaymentService.cancel()  ← rollback in reverse order
```

---

## Delivery Semantics in EDA

At-least-once delivery is standard → every consumer **must be idempotent**:
```
Each event carries a unique event ID.
Consumer checks: "Have I processed event_id X?"
  YES → skip (already handled)
  NO  → process + record event_id in idempotency store
```

---

## Trade-offs

| | Synchronous (REST/gRPC) | Event-Driven |
|---|---|---|
| Coupling | Tight (caller knows callee) | Loose (emitter doesn't know consumers) |
| Latency | Low (immediate response) | Higher (async by nature) |
| Observability | Easy (request-response traceable) | Hard (event chains span many services) |
| Error handling | Simple try/catch | Requires DLQ + saga compensation |
| Throughput | Limited (chain slows on weakest link) | High (consumers scale independently) |
| Order guarantee | Implicit | Depends on broker (Kafka: per-partition order) |

---

## Real-World Examples

| Company | Event | Consumers |
|---|---|---|
| **LinkedIn** | `PostLiked` | 4 parallel consumers: notification service, analytics, post author feed, trending engine |
| **Uber** | `TripStateChanged` | Event sourcing for trip lifecycle: each state change is an event; state derived by replay |
| **Slack** | `MessageSent` | Choreography: message delivery, notifications, search indexer, read receipt — all react to same event |
| **Amazon** | `OrderPlaced` | Orchestration saga for complex order fulfillment: payment → fraud check → inventory → warehouse → shipping |

---

## MERN Dev Notes

```
npm install kafkajs      # Apache Kafka client for Node.js
npm install amqplib      # RabbitMQ AMQP client
npm install bullmq       # Redis-backed job queue as lightweight EDA
```

```js
// Kafka Producer (Node.js / Express route)
const { Kafka } = require('kafkajs');
const kafka = new Kafka({ clientId: 'order-service', brokers: ['localhost:9092'] });
const producer = kafka.producer();

router.post('/orders', async (req, res) => {
  const order = await Order.create(req.body);
  await producer.send({
    topic: 'order-events',
    messages: [
      {
        key: order._id.toString(),          // same key → same Kafka partition → ordering preserved
        value: JSON.stringify({
          eventType: 'OrderPlaced',
          eventId:   uuidv4(),              // for idempotency
          orderId:   order._id,
          payload:   order,
          ts:        Date.now(),
        }),
      },
    ],
  });
  res.status(202).json({ orderId: order._id });
});
```

```js
// Kafka Consumer (payment-service/worker.js)
const consumer = kafka.consumer({ groupId: 'payment-service' });
await consumer.subscribe({ topic: 'order-events', fromBeginning: false });

await consumer.run({
  eachMessage: async ({ message }) => {
    const event = JSON.parse(message.value.toString());
    if (event.eventType !== 'OrderPlaced') return;

    // Idempotency guard
    const processed = await ProcessedEvent.findOne({ eventId: event.eventId });
    if (processed) return;

    await chargeCustomer(event.payload);
    await ProcessedEvent.create({ eventId: event.eventId });
    // Emit PaymentProcessed event for next saga step
  },
});
```

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| What is an event? | Immutable fact describing something that happened (past-tense, carries its own data) |
| Pub-Sub vs point-to-point? | Pub-Sub: multiple consumers each get a copy. P2P: one consumer processes each message (job queue) |
| Choreography vs Orchestration? | Choreography: services react autonomously (simple flows). Orchestration: central coordinator drives each step (complex flows, easier to rollback) |
| Event sourcing trade-off? | Full audit trail + time travel, but eventual consistency + snapshot complexity for long histories |
| How to ensure idempotency? | Each event has a UUID; consumer records processed IDs; before processing, check if already handled |
| How does Kafka guarantee ordering? | Within a single partition. Use the same partition key (e.g., `userId`) for events that must be ordered |
| What if a consumer fails? | Kafka retains the offset. Consumer group re-reads from the last committed offset after restart |

**Red flags**:
- Publishing events with commands not facts ("ProcessPayment" instead of "OrderPlaced")
- Not implementing idempotency in consumers
- Using a single Kafka partition for all events (bottleneck)
- Lack of observability tooling (distributed tracing, event correlation IDs)

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Event** | Immutable fact recording that something happened, with a timestamp and payload |
| **Producer / Publisher** | Service that emits events |
| **Consumer / Subscriber** | Service that reacts to events |
| **Message broker** | Middleware that routes events between producers and consumers (Kafka, RabbitMQ, AWS SNS/SQS) |
| **Pub-Sub** | Pattern where one event is delivered to all subscribed consumers |
| **Event Sourcing** | Pattern where the event log is the source of truth; state is derived by replay |
| **CQRS** | Command Query Responsibility Segregation — separate write and read models |
| **Saga** | Pattern for distributed transactions; coordinates multi-service workflows via events |
| **Choreography** | Each service reacts to events autonomously; no central coordinator |
| **Orchestration** | Central coordinator directs each step; handles compensating transactions |
| **Idempotency** | Producing the same result when an operation is applied multiple times |
| **Offset** | Position of a message in a Kafka partition log |
| **Consumer group** | Set of consumers sharing the processing of a Kafka topic's partitions |
| **DLQ** (Dead Letter Queue) | Storage for events that failed all retry attempts |
| **Correlation ID** | Unique identifier threaded through all events in a workflow for distributed tracing |
