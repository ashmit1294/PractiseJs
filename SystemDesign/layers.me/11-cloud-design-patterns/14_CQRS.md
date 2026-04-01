# T14 — CQRS: Command Query Responsibility Segregation

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/cqrs

---

## ELI5 (Explain Like I'm 5)

Imagine a library. There are two different desks: one desk for **checking out books** (commands — write operations), and a completely different desk with a catalog and recommendations for **finding what to read** (queries — read operations). The checkout desk just logs what's checked out. The catalog desk has a beautiful organized view. They talk to each other, but they're separate.

CQRS = separate desks for writing vs. reading. Each desk is optimized for its own job.

---

## Analogy

A **restaurant POS system**: The kitchen (write model) gets orders, marks items ready, deducts inventory — it only cares about what's happening *now*. The manager's dashboard (read model) shows a beautiful report of sales by hour, popular dishes, table turnover — completely different view, different format, updated from the same orders. You wouldn't send "the manager wants to see the sales report" directly to the kitchen. Two separate systems; one source of events.

---

## Core Concept

CQRS separates the **write model** (Commands) from the **read model** (Queries):

- **Command side**: Handle creates/updates/deletes. Enforces business rules. Updates canonical data store. Publishes events.
- **Query side**: Denormalized read models. Pre-joined, aggregated, shaped exactly for each UI view. Never mixed with write operations.

**Why the separation matters**: The data shape ideal for writes (normalized, consistent, rule-enforcing) is completely different from the shape ideal for reads (denormalized, pre-aggregated, fast). Trying to serve both from the same model means compromising both.

---

## ASCII Diagrams

### CQRS Core Architecture

```
                 ┌─────────────────────────────────────────────────┐
                 │              COMMAND SIDE (Write)                 │
                 │                                                   │
  PlaceOrder ──► │  Command Handler ──► Business Rules Validation   │
  CancelOrder    │        │                     │                   │
  UpdateProfile  │        ▼              Update Canonical DB        │
                 │  Publish Events   (PostgreSQL / SQL Server)      │
                 └──────────────┬──────────────────────────────────┘
                                │ Events stream (Kafka / SQS)
                                │ OrderPlaced, InventoryReserved
                                │ PaymentProcessed, OrderCancelled
                 ┌──────────────▼──────────────────────────────────┐
                 │              QUERY SIDE (Read)                   │
                 │                                                   │
                 │  Event Handlers ──► Update Read Models           │
                 │                    (100-300ms lag typical)       │
                 │                                                   │
                 │  ┌─────────────────────────────────────────┐    │
                 │  │ Read Models (each shaped for a UI view)  │    │
                 │  │  • order_summary_view (dashboard)        │    │
                 │  │  • user_notifications_view               │    │
                 │  │  • inventory_status_view                 │    │
                 │  │  • search_index (Elasticsearch)          │    │
                 │  └─────────────────────────────────────────┘    │
                 └──────────────────────────────────────────────────┘
                 
 UI: GET /orders/summary → Query Handler → directly hits read model
     (no joins, no business logic, pre-aggregated, < 5ms response)
```

### Data Flow Example — PlaceOrder

```
User clicks "Buy"
       │
       ▼
POST /orders (Command: PlaceOrderCommand)
  { productId: 123, qty: 2, userId: 456 }
       │
       ▼
Command Handler:
  1. Validate user has funds        [ Write DB read: SELECT balance ]
  2. Validate inventory available   [ Write DB read: SELECT stock ]
  3. Begin transaction
  4. INSERT orders (status: PENDING)
  5. UPDATE inventory (stock - 2)
  6. COMMIT
  7. Publish: OrderPlaced, InventoryReserved, PaymentProcessed
       │
       │   (Kafka events, async)
       │
  ┌────┴─────────────────────────────────────┐
  ▼                ▼                         ▼
Update         Update                  Update
dashboard    notifications            Elasticsearch
read model    read model               search index
(~100ms)      (~150ms)                 (~300ms)
       │                                    │
       ▼                                    ▼
GET /orders/dashboard → return pre-built JSON (< 5ms)
GET /search?q=order → Elasticsearch (< 20ms)
```

### Eventual Consistency — Read Your Own Writes

```
WITHOUT read-your-own-writes strategy:
  t=0    POST /orders → OrderPlaced published
  t=100ms  Read model update arrives (async)
  t=50ms   User immediately GETs /orders/my-orders
           → order NOT in read model yet → "where's my order?" → 😡

WITH read-your-own-writes strategy:
  Option 1 — Return write result to client:
    POST /orders → returns created order directly from write model
    Client already has the order; no need to re-query

  Option 2 — Version tokens:
    POST /orders → returns { orderId: 789, version: 42 }
    GET /orders/789?version=42
      → Read model at version < 42: "still syncing" (poll again)
      → Read model at version >= 42: return order data ✅
```

---

## How It Works (Step by Step)

1. **Client sends command**: `PlaceOrderCommand { userId, productId, quantity }`. Command is explicit intention to change state.

2. **Command handler validates**: Enforces ALL business rules (sufficient inventory, valid payment method, active user). Rejections return immediately with error — no event published.

3. **Write model updates**: Insert/update canonical store (relational DB, event store, or both). This is the authoritative state.

4. **Events published**: `OrderPlaced`, `InventoryReserved` events go to message broker (Kafka, SNS, EventBridge). Each event is immutable fact about what happened.

5. **Read model projections update asynchronously**: Each projection subscribes to relevant events. Updates read model storage (denormalized SQL view, Elasticsearch, Redis, etc.) optimized for its specific query patterns.

6. **Queries hit read models directly**: No joins, no business logic, no write model touched. Pre-aggregated, pre-denormalized. Typically < 5ms.

---

## Variants

| Variant | Architecture | Complexity | Use When |
|---------|-------------|------------|----------|
| **Basic CQRS** | Shared DB, logical separation only (separate repositories/services for reads and writes) | Low | Starting point; different read/write rate; same team |
| **CQRS + Separate Stores** | PostgreSQL for writes, Elasticsearch for reads | Medium | Different query shapes needed; full-text search; analytics |
| **CQRS + Event Sourcing** | Write model = event store, read models built by replaying events | High | Full audit trail, temporal queries, event-driven microservices |
| **Multi-Model** | One write model → feeds SQL queries + Elasticsearch search + Neo4j graph + Redis cache simultaneously | Very High | Large platform with fundamentally different access patterns per feature |

---

## Trade-offs

| Dimension | CQRS | Traditional CRUD |
|-----------|------|-----------------|
| **Read performance** | Excellent (pre-aggregated, denormalized) | Moderate (joins, indexes, same schema) |
| **Write performance** | Good (focused write model) | Good |
| **Consistency** | Eventual (100-300ms lag typical) | Immediate |
| **Complexity** | High (separate models, sync, lag) | Low |
| **Schema flexibility** | Very high (each read model has its own shape) | Limited (one schema serves all uses) |
| **Team scaling** | Good (separate teams for read/write) | Poor (all teams compete on same models) |

**Eventual consistency lag** at Netflix: 100-300ms between write and read model update. Acceptable because showing a "recommended item" 200ms late is fine. Not acceptable for financial transactions.

---

## When to Use (and When Not To)

**Use when:**
- Read:write ratio exceeds 10:1 — CQRS lets you scale read models independently
- Queries require different data shapes (e.g., full-text search cannot be expressed as a relational JOIN efficiently)
- Different teams own read vs. write logic — cleaner ownership boundaries
- Multiple consumers need same data in different formats simultaneously
- Audit trail is required (natural fit with Event Sourcing on the write side)

**Avoid when:**
- Simple CRUD application — the complexity is not justified by a straightforward read/write workload
- Team lacks distributed systems experience — eventual consistency bugs are subtle and hard to debug
- Strict read-after-write consistency is required and cannot be handled via read-your-own-writes pattern
- Small team — maintaining two models is expensive; start simple, migrate to CQRS when pain is real

---

## MERN Developer Notes

```javascript
// CQRS with Node.js + PostgreSQL write + Elasticsearch read

// ===== COMMAND SIDE =====

// commands/placeOrder.js
const { publishEvent } = require('../eventBus');

async function placeOrderCommand({ userId, productId, quantity }, db) {
  // 1. Validate business rules
  const inventory = await db.query('SELECT stock FROM products WHERE id = $1', [productId]);
  if (inventory.rows[0].stock < quantity) {
    throw new Error('Insufficient inventory');
  }

  // 2. Update write model (canonical DB)
  const order = await db.query(
    'INSERT INTO orders (user_id, product_id, quantity, status) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, productId, quantity, 'PENDING']
  );

  // 3. Publish domain events (async — read models update independently)
  await publishEvent('OrderPlaced', {
    orderId: order.rows[0].id,
    userId,
    productId,
    quantity,
    timestamp: new Date().toISOString()
  });

  // 4. Return write result directly (solves read-your-own-writes)
  return order.rows[0];
}

// ===== EVENT BUS =====

// eventBus.js — simple in-memory for illustration; use Kafka/SNS in production
const handlers = {};
function subscribe(eventType, handler) {
  handlers[eventType] = handlers[eventType] || [];
  handlers[eventType].push(handler);
}
async function publishEvent(eventType, payload) {
  (handlers[eventType] || []).forEach(h => h(payload).catch(console.error));
}

// ===== READ SIDE — Projection Builder =====

// projections/orderSummaryProjection.js
const elasticClient = require('../elasticClient');

subscribe('OrderPlaced', async (event) => {
  // Update read model — denormalized for dashboard queries
  await elasticClient.index({
    index: 'order_summaries',
    id: event.orderId,
    body: {
      orderId: event.orderId,
      userId: event.userId,
      productId: event.productId,
      quantity: event.quantity,
      status: 'PENDING',
      timestamp: event.timestamp
    }
  });
});

// ===== QUERY SIDE =====

// queries/getOrderSummaries.js
async function getOrderSummaries({ userId, dateFrom, dateTo }) {
  // Query directly against read model — no write DB touched
  const result = await elasticClient.search({
    index: 'order_summaries',
    body: {
      query: {
        bool: {
          must: [
            { term: { userId } },
            { range: { timestamp: { gte: dateFrom, lte: dateTo } } }
          ]
        }
      },
      sort: [{ timestamp: 'desc' }]
    }
  });
  return result.hits.hits.map(h => h._source);
}

// ===== ROUTES =====
// router.post('/orders', (req, res) => placeOrderCommand(req.body, db).then(order => res.json(order)))
// router.get('/orders/summary', (req, res) => getOrderSummaries(req.query).then(data => res.json(data)))
```

---

## Real-World Examples

| Company | Write Model | Read Models | Lag | Key Insight |
|---------|------------|-------------|-----|-------------|
| **Netflix** | Microservices → Cassandra (viewing history, ratings, preferences) | EVCache (hot data for homepage), Redshift (analytics warehouse), Elasticsearch (search) | 100–500ms | All read models built from same domain events; each optimized for its use case |
| **Uber** | MySQL (trip state, driver assignments) — writes via strong ACID | Redis (driver location, ETA — P99 < 100ms), Cassandra (trip history), Kafka Streams (analytics) | < 200ms | "Surge pricing" query reads from Cassandra aggregate; write side is clean MySQL |
| **Stack Overflow** | SQL Server (question/answer writes, votes) | Elasticsearch (full-text search across 50M+ questions), Redis (top questions, hot views), denormalized SQL (tag browsing) | < 1s | Same tagged questions: relational write, Elasticsearch read, Redis hot cache — 3 different read models |
| **LinkedIn** | Espresso (LinkedIn's distributed DB) for member profile writes | Galene (search index), PYMK (People You May Know graph), profile view read model | ~500ms | Profile update event fans out to completely different read models — search, graph, analytics — each with their own schema |

---

## Interview Cheat Sheet

### Q: How is CQRS different from a read replica?
**A:** A read replica duplicates the **same schema** — it's just a copy for load distribution. CQRS creates **different schemas** optimized per use case. A read replica can't give you full-text search from a relational schema. CQRS lets the read model be a completely different technology (Elasticsearch, Redis, Cassandra) with a completely different data shape (denormalized, pre-aggregated, keyword-indexed). CQRS enables — read replicas just scale.

### Q: How do you handle eventual consistency? What if users see stale data?
**A:** Two main strategies: (1) **Return write result directly** — after a command succeeds, return the created/updated object to the client from the write model. Client already has fresh data; no re-query needed. (2) **Version tokens** — command returns a version number; client passes it on the next read; read model returns "still syncing" until version is met, then returns data. For most use cases, 100-300ms lag is imperceptible — users don't notice 200ms stale data. For financial or high-stakes data: don't use CQRS or use a synchronous projection for that specific query.

### Q: Does CQRS require Event Sourcing?
**A:** No. CQRS and Event Sourcing are separate patterns that compose well together. Basic CQRS can use a regular SQL write DB — it just updates tables. Event Sourcing adds the write model being an event store (append-only). The combination is powerful but also more complex. Start with basic CQRS (logical separation, shared DB) before adding event sourcing.

### Q: When should you NOT use CQRS?
**A:** Simple CRUD apps, small teams, when read-after-write consistency is hard requirement, or when the team is unfamiliar with distributed systems. The overhead of maintaining two models, handling eventual consistency bugs, and synchronizing projections is significant. Only worthwhile when data access pattern divergence is real.

---

## Red Flags to Avoid

- Saying CQRS is just "using stored procedures for reads vs writes" — it's architectural separation of models, not just implementation separation
- Ignoring eventual consistency — if you say "it's fine because it's async" without explaining how you handle it, that's a red flag
- Conflating CQRS and Event Sourcing — they're separate; CQRS doesn't require event sourcing
- Not knowing what "read model" means — it's not just a SQL view; it's a purpose-built data store shaped for that specific query
- Using CQRS for a simple CRUD API with one developer — over-engineering kills small projects

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **CQRS** | Command Query Responsibility Segregation — separate models for writes (commands) vs. reads (queries) |
| **Command** | Explicit intent to change state: PlaceOrderCommand, CancelOrderCommand. Has one handler. |
| **Query** | Request to retrieve data. Never modifies state. Multiple can run in parallel. |
| **Write Model** | Canonical data store enforcing business rules; source of truth; normalized |
| **Read Model** | Denormalized projection optimized for specific query patterns; not source of truth |
| **Projection** | Process that consumes domain events and updates read models |
| **Eventual Consistency** | Write and read models synchronize asynchronously; brief (ms to seconds) lag window |
| **Read-Your-Own-Writes** | Strategy to solve immediate consistency: return write result directly; or use version tokens |
| **Version Token** | Write returns version number; read polls until that version is available in read model |
| **Event Handler** | Subscribes to events from the write side, updates read models |
| **Denormalization** | Intentionally duplicating data across tables/documents to avoid joins in read queries |
| **Domain Event** | Immutable fact that something happened: OrderPlaced, PaymentProcessed |
| **Multi-Model** | One write model feeding multiple different read model technologies (SQL, Elasticsearch, Redis, Neo4j) |
| **Idempotent Projection** | Projection that safely processes the same event multiple times without incorrect side effects |
