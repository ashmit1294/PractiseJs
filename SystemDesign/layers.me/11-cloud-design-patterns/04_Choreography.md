# T04 — Choreography Pattern: Saga & Event-Driven Coordination

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/choreography

---

## ELI5 (Explain Like I'm 5)

Imagine a dance performance. In **orchestration**, there's a director shouting at everyone: "You step left! You spin! You bow!" One person controls everything. If the director gets sick, the show stops.

In **choreography**, everyone knows their part. When the music plays (an event), each dancer knows what to do next — no one tells them. If one dancer is sick, others keep dancing. The performance happens through everyone reacting to the music, not through a director giving orders.

---

## Analogy

**Restaurant Kitchen vs. Relay Race:**
- **Orchestration** = Head chef telling every station exactly what to do. Clear control, but the chef is a bottleneck.
- **Choreography** = Relay race — when the runner finishes their leg (publishes an event), the next runner knows to start (subscribes to the event). No coach needed mid-race. The workflow emerges from independent reactions.

---

## Core Concept

**Choreography** is a distributed coordination pattern where services communicate through events without a central controller. Each service:
- **Listens** for domain events it cares about
- **Performs** its work independently
- **Publishes** new events for others to consume

The business process **emerges** from independent service interactions. No single service owns or orchestrates the workflow.

### The Problem It Solves
In microservices, multi-step workflows (order fulfillment: inventory → payment → shipping → notification) can be coordinated two ways:
- **Direct service calls** → tight coupling, cascading failures
- **Central orchestrator** → god service that knows too much, becomes a bottleneck, changes ripple out
- **Choreography** → services react to events, each owns only its domain, evolve independently

### How Choreography Works

```
Order Service:      publishes "OrderCreated" → job done, no waiting
Inventory Service:  listens for "OrderCreated" → reserves stock → publishes "InventoryReserved"
Payment Service:    listens for "InventoryReserved" → charges card → publishes "PaymentCompleted"
Shipping Service:   listens for "PaymentCompleted" → creates shipment → publishes "ShipmentCreated"
Notification Svc:   listens for "PaymentCompleted" → sends email (parallel with shipping)
Order Service:      listens for "ShipmentCreated" → updates status to SHIPPED
```

No service calls another directly. No service knows the complete workflow. Coordination emerges from events.

---

## ASCII Diagrams

### Choreography Architecture

```
                  Message Broker (Kafka / RabbitMQ)
                  Topics: order-events, inventory-events, payment-events, shipping-events
                         │
         ┌───────────────┼────────────────┬──────────────────┐
         ▼               ▼                ▼                  ▼
  Order Service    Inventory Service  Payment Service   Shipping Service
  Pub: OrderCreated  Pub: InvReserved  Pub: PayComplete   Pub: ShipCreated
  Sub: ShipCreated   Sub: OrderCreated Sub: InvReserved   Sub: PayComplete
       PayFailed          PayFailed
```

### Choreographed E-commerce Order Flow

```
Customer ──► Order Service ──► [OrderCreated] ──► Message Broker
                                                        │
                                                        ├──► Inventory Service ──► [InventoryReserved]
                                                        │                                    │
                                                        │                           Message Broker
                                                        │                                    │
                                                        │                           ├──► Payment Service ──► [PaymentCompleted]
                                                        │                                               │
                                                        │                                      Message Broker
                                                        │                                               │
                                                        │                                    ┌──────────┴──────────┐
                                                        │                                    ▼                     ▼
                                                        │                             Shipping Svc          Notification Svc
                                                        │                             (parallel)            (parallel)
                                                        │                                 │
                                                        │                          [ShipmentCreated]
                                                        │                                 │
                                                        └──────────────────────────► Order Service
                                                                                     (update SHIPPED)
```

### Compensation Flow (Saga Pattern)

```
HAPPY PATH:
  OrderCreated → InventoryReserved → PaymentCompleted → ShipmentCreated

FAILURE PATH (payment fails):
  OrderCreated → InventoryReserved → PaymentFailed
                                            │
                         ┌──────────────────┤
                         ▼                  ▼
                  InventoryReleased    OrderCancelled
                  (Inventory Service  (Order Service
                   undoes reservation) updates status)

Each service knows how to UNDO its own work when it sees failure events.
```

### Choreography vs. Orchestration

```
ORCHESTRATION (hub-and-spoke):
  Orchestrator ──► Inventory Service
       │
       └──► Payment Service
       │
       └──► Shipping Service
  [Single failure point; single place to change workflow logic]

CHOREOGRAPHY (decentralized):
  Inventory ──► [InvReserved] ──► Payment
  Payment   ──► [PayComplete] ──► Shipping
  Payment   ──► [PayComplete] ──► Notification  (added without touching anything)
  Payment   ──► [PayFailed]  ──► Inventory (compensation)
  [No bottleneck; add services by subscribing to existing events]
```

---

## Choreography vs. Orchestration: Decision Matrix

| Dimension | Choose Choreography | Choose Orchestration |
|-----------|--------------------|--------------------|
| **Coupling** | Services owned by different teams | Single team owns all services |
| **Scalability** | Need millions of events/sec | Moderate workflow volume |
| **Visibility** | Invest in distributed tracing | Need simple workflow inspection |
| **Failure handling** | Each service handles independently | Complex centralized decision logic |
| **Change frequency** | Workflow changes often; add new consumers easily | Stable workflow; stakeholders need to see it |
| **Examples** | Uber trip lifecycle, Netflix encoding | Driver onboarding, returns processing |

---

## Variants

| Variant | Description | Use When |
|---------|-------------|---------|
| **Saga Choreography** | Success + compensation events at each step; services undo their work on failure events | Distributed transactions needing ACID-like guarantees without 2-phase commit |
| **Event Sourcing Choreography** | Events are the primary source of truth; services rebuild state by replaying events | Regulatory compliance, audit trails, time-travel debugging |
| **Hybrid** | Critical path uses orchestration (visibility); ancillary reactions use choreography | Need both workflow control and extensibility |

---

## Trade-offs

| Aspect | Benefit | Cost |
|--------|---------|------|
| **Decoupling** | Services deploy independently; new services add by subscribing | No single place to see/understand the full workflow |
| **Scalability** | Each service scales independently; no orchestrator bottleneck | Debugging requires distributed tracing across services |
| **Flexibility** | Add new reactions without modifying publishers (Netflix added anomaly detection with zero changes to producers) | Maintaining consistency across eventual-consistency systems is hard |
| **Resilience** | No single point of failure (no orchestrator to go down) | Failure handling logic distributed across services — requires discipline |

---

## When to Use (and When Not To)

**Use choreography when:**
- Services span **organizational boundaries** (different teams/companies)
- **Workflow changes frequently** — add new reactions without touching core services
- Need **extreme scale** (Uber trip events, Netflix viewing events — millions/second)
- Services represent **distinct bounded contexts** (DDD — payment, inventory, shipping are separate domains)

**Avoid choreography when:**
- **Strict ordering** required (use orchestration for explicit sequence control)
- **Debugging must be straightforward** (non-technical stakeholders; no distributed tracing infrastructure)
- **Compensation logic is complex** — centralized decision ("retry payment OR cancel order?") is clearer in orchestrator
- **Few services** (3-5) owned by a single team — overhead of events + tracing not justified

---

## MERN Developer Notes

```javascript
// Choreography with Kafka (kafkajs)
const { Kafka } = require('kafkajs');

const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'inventory-service' });

// Inventory Service — listens for OrderCreated, publishes InventoryReserved
async function runInventoryService() {
  await consumer.subscribe({ topic: 'order-events', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const event = JSON.parse(message.value.toString());

      if (event.type !== 'OrderCreated') return; // only care about this event

      const { orderId, customerId, items } = event.payload;

      try {
        // Check and reserve stock
        await db.inventory.reserveItems(orderId, items);

        // Publish success event — don't call Payment Service directly!
        await producer.send({
          topic: 'inventory-events',
          messages: [{
            key: orderId,  // ensures ordering within an order
            value: JSON.stringify({
              type: 'InventoryReserved',
              correlationId: event.correlationId,  // propagate for tracing
              payload: { orderId, reservedItems: items }
            })
          }]
        });
      } catch (err) {
        // Publish failure event for compensation
        await producer.send({
          topic: 'inventory-events',
          messages: [{
            key: orderId,
            value: JSON.stringify({
              type: 'InventoryInsufficient',
              correlationId: event.correlationId,
              payload: { orderId, reason: err.message }
            })
          }]
        });
      }
    }
  });
}
```

**Critical practices:**
- Always propagate `correlationId` through all events (enables distributed tracing)
- Partition by `orderId` (ensures all events for one order go to same partition → ordering preserved)
- Each service must be **idempotent** — same event processed twice must produce same result
- Implement dead letter queues for poison events
- Use a schema registry (Confluent Schema Registry) for event schema evolution

---

## Real-World Examples

| Company | System | Details |
|---------|--------|---------|
| **Uber** | Trip Lifecycle Management | 50+ microservices react independently to trip events. "TripRequested" → surge pricing, driver matching, fraud detection, ETA calculation — all in parallel, no orchestrator. Built "Trip Observability" team to visualize event flows via distributed tracing. |
| **Netflix** | Content Encoding Pipeline | "ContentUploaded" → encoding (4K, 1080p, 720p), quality analysis, thumbnail generation, CDN distribution — all parallel, all choreographed. Added new analysis steps without touching upload service. Built "Encoding Dashboard" reconstructing pipeline state from event logs. |
| **Stripe** | Webhook Delivery System | Payment events trigger: balance update, fraud check, accounting, webhook delivery. Customer systems then react to Stripe's webhooks with their own choreography. Provides event logs + replay tools to address visibility challenges. |

---

## Interview Cheat Sheet

### Q: When would you choose choreography over orchestration?
**A:** When services span team boundaries, when workflows change frequently (add consumers without modifying publishers), when you need extreme scale (no orchestrator bottleneck), or when services represent distinct bounded contexts (DDD). Avoid choreography when debugging must be straightforward or workflows require strict ordering.

### Q: How do you handle failures in choreographed workflows?
**A:** Each service: (1) implements **idempotency** to handle duplicate events, (2) uses **dead letter queues** for poison messages, (3) publishes **compensation events** when its operation fails, (4) relies on eventual consistency. Distributed tracing with correlation IDs helps debug failures. No one service sees the whole picture.

### Q: How do you maintain visibility in choreographed systems?
**A:** Use distributed tracing with correlation IDs (Jaeger, Zipkin, AWS X-Ray) to reconstruct workflows from event logs. Maintain an **event catalog** documenting all events and their consumers. Build dashboards aggregating event states by correlation ID. Some teams build "workflow reconstruction" tools querying event logs to show business process state.

### Q: How do you evolve event schemas without breaking consumers?
**A:** Use schema registry to version events. Maintain **backward compatibility** — add optional fields, never remove required ones. Use separate event types for breaking changes. Follow Postel's Law: be conservative in what you publish, liberal in what you accept. Coordinate via API contracts.

### Q: What is a Saga pattern and how does it relate to choreography?
**A:** A Saga is a sequence of local transactions where each step publishes an event. If a step fails, compensation events trigger previous steps to undo their work. Choreography-based sagas distribute this logic — each service knows how to compensate when it sees failure events. No distributed transaction (2-phase commit) needed.

### Red Flags to Avoid
- Claiming choreography is always better than orchestration
- Not addressing failure handling (compensation events, idempotency, DLQs)
- Ignoring observability — "choreography is hard to debug" is not a reason to avoid it, but you MUST invest in distributed tracing
- Confusing choreography with simple pub/sub notifications (choreography coordinates multi-step workflows)
- Designing choreographed workflows without considering event schema evolution
- Not having correlation IDs in all events

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Choreography** | Decentralized distributed coordination via events — no central controller; workflow emerges from service reactions |
| **Orchestration** | Centralized workflow coordination where an orchestrator commands service steps in explicit sequence |
| **Saga** | Pattern for distributed transactions using a sequence of local transactions with compensating actions on failure |
| **Compensation Event** | Event published when a step fails, signaling that previous steps should undo their work |
| **Compensation Transaction** | Action that undoes the effect of a previous successful step (e.g., release reserved inventory) |
| **Event-Driven Architecture** | System design where services communicate exclusively through events, enabling loose coupling |
| **Bounded Context** | DDD (Domain-Driven Design) concept — explicit boundary within which a domain model is defined and consistent |
| **DDD** (Domain-Driven Design) | Software design approach modeling systems around business domains and their boundaries |
| **Correlation ID** | Unique identifier propagated through all events in a workflow to enable end-to-end tracing |
| **Distributed Tracing** | Observability technique tracking requests/events as they flow across multiple services |
| **Schema Registry** | Central store (Confluent Schema Registry) for event schema versions; validates compatibility |
| **Idempotency** | Processing the same event multiple times produces the same result as processing it once |
| **Poison Message** | Message that repeatedly causes consumer failures; routed to DLQ after N retries |
| **Dead Letter Queue (DLQ)** | Queue receiving messages that couldn't be processed after N retries |
| **Fan-out** | One event triggering multiple independent consumer reactions in parallel |
| **ACID** (Atomicity, Consistency, Isolation, Durability) | Properties of reliable database transactions; hard to achieve across distributed services |
| **2-Phase Commit (2PC)** | Protocol for distributed transactions; avoided in microservices due to coupling and blocking |
| **Domain Event** | An event representing something significant that happened in the business domain (e.g., "OrderCreated") |
