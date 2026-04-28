# 35 — CQRS Implementation: Code & Architecture Guide

> **Module**: M11 — Cloud Design Patterns  
> **Section**: Design & Implementation Patterns  
> **Source**: https://layrs.me/course/hld/11-cloud-design-patterns/cqrs-impl  
> **Difficulty**: Intermediate | 30 min read

---

## 1. ELI5 — Explain Like I'm 5

Imagine a school with a **principal's office** (write side) and a **bulletin board** (read side). When a teacher grades a paper, they tell the principal (command). The principal updates the records and posts a summary on the bulletin board (read model). Students only read the bulletin board — they don't bother the principal every time they want to know their grade.

**CQRS**: Commands (write) and Queries (read) use different models so each can be optimized for what it does best.

---

## 2. The Analogy

Think of CQRS like a restaurant kitchen vs. the dining room menu board:
- The **kitchen** (write model) handles complex order processing: ingredient tracking, cooking workflows, inventory management
- The **menu board** (read model) shows a simple, optimized view of dishes with prices
- When a dish sells out, the kitchen updates inventory (command), and the menu board reflects this (query model sync)

The kitchen doesn't need to know how the menu is displayed. Customers don't need to understand food preparation. Each side is optimized for its purpose, communicating through events.

---

## 3. Core Concept

**CQRS** (Command Query Responsibility Segregation) separates write operations (commands) from read operations (queries) using **different models**, and often different databases. This enables:
- Independent scaling of reads and writes
- Optimized data schemas for each operation type
- Multiple read models, each tuned for specific query patterns

### The Split:
- **Commands** — modify state, return void/acknowledgment (not data)
- **Queries** — return data, never modify state (no side effects)

### Scale It Applies To:
| Variant | Complexity | When |
|---------|-----------|------|
| Single DB, separate code paths | Low | Starting out; logical separation |
| Separate databases | Medium | Read:write ratio > 10:1 |
| With Event Sourcing | High | Full audit trail needed |
| Microservices CQRS | Very High | Multiple teams, polyglot persistence |

---

## 4. ASCII Architecture

### CQRS Request Flow

```
Commands (Write Path)
─────────────────────
Client
  │
  ▼ POST /orders
Write API (Command Handler)
  │ validate & persist
  ▼
[Write DB] (PostgreSQL — normalized, ACID)
  │
  ▼ publish event: OrderCreated
[Event Bus] (Kafka)
  │
  ▼ consume event
Event Projector (Read Model Updater)
  │ denormalize & upsert
  ▼
[Read DB] (MongoDB — denormalized document)

Queries (Read Path)
───────────────────
Client
  │
  ▼ GET /orders/:id
Read API (Query Handler)
  │
  ▼ fetch single document
[Read DB]
  │
  ▼ return 200 OK
Client
```

### Single DB vs. Separate DB

```
── Single Database CQRS ──────────────────────
  Write: ORM → PostgreSQL (normalized tables)
  Read:  SQL → PostgreSQL (materialized views)
  Sync:  immediate (same transaction or trigger)

── Separate Databases CQRS ───────────────────
  Write: App → PostgreSQL
                 │ Kafka events
                 ▼
  Read:  MongoDB / Redis / Elasticsearch
         (each optimized for its query pattern)
```

### Write Model vs. Read Model Schemas

```
Write Model (normalized)         Read Model (denormalized)
─────────────────────────        ──────────────────────────
orders table                     order document (MongoDB)
  order_id                       {
  user_id                          order_id,
  total                            user_name,
                                   user_email,
order_items table                  items: [
  item_id                            { name, qty, price }
  order_id (FK)                    ],
  product_id (FK)                  total,
  quantity                         createdAt
                                 }

(3 tables, joins required)       (1 document, sub-10ms retrieval)
```

---

## 5. How It Works

**Step 1: Command Processing**
- Client sends command (CreateOrder, UpdateInventory) to write model
- Write model validates against business rules (order total > 0, inventory cannot go negative)
- On pass: persists to write DB, publishes event to event bus
- Returns acknowledgment (success/failure), NOT data

**Step 2: Event Propagation**
- Event bus (Kafka, RabbitMQ, AWS EventBridge) delivers event to subscribers
- Events are immutable facts — "OrderCreated", "PaymentReceived"
- Write model doesn't know or care how many read models exist
- At-least-once delivery → handlers must be idempotent

**Step 3: Read Model Update**
- Projectors consume events and update denormalized read databases
- One event can update multiple read models: order history, fulfillment queue, analytics dashboard
- Each read model optimized for its query pattern (document in MongoDB, sorted set in Redis, columnar in Snowflake)

**Step 4: Query Execution**
- Client queries read model directly, bypassing write model entirely
- Pre-computed, denormalized → fast
- Usually eventually consistent (milliseconds to seconds behind write)

**Step 5: Consistency Management**
- Read models track last processed event sequence number
- Clients can use version numbers in commands for optimistic locking
- UI handles lag: "processing" states, optimistic updates, timestamps

---

## 6. Variants / Types

### Variant 1: Single Database CQRS
- One DB, separate read/write models in code
- Commands use ORM/repository; queries use raw SQL or materialized views
- **Pros**: Simple, strong consistency, no new infra
- **Cons**: Reads/writes compete for resources, can't scale independently
- **Use when**: Starting out; moderate scale

### Variant 2: Separate Databases
- Write: PostgreSQL/MySQL (ACID)
- Read: MongoDB (documents), Redis (cache), Elasticsearch (search)
- Sync via event streaming (Kafka) or CDC (Debezium)
- **Pros**: Independent scaling, technology choice per workload
- **Cons**: Eventual consistency, complex deployment, debugging across systems
- **Use when**: Read:write ratio > 10:1

### Variant 3: CQRS with Event Sourcing
- Write model stores sequence of events, not current state
- Current state derived by replaying events
- Read models are projections built from event stream
- **Pros**: Complete audit trail, time-travel queries, replay events to rebuild state
- **Cons**: Increased complexity, event schema evolution, potential replay performance issues
- **Use when**: Audit requirements, temporal queries, "how did we get here?" matters

### Variant 4: Microservices CQRS
- Write and read models are separate services
- Commands go to write service; queries to read service
- Teams can own their models independently
- **Pros**: Team autonomy, independent deployment, polyglot persistence
- **Cons**: Distributed system complexity, network latency, operational overhead
- **Example**: Amazon orders — separate services for creation, history, tracking, analytics

### Variant 5: Hybrid CQRS
- CQRS for complex/high-scale domains; CRUD for simple domains
- **Example**: E-commerce uses CQRS for product catalog + orders; plain CRUD for user profiles
- Most pragmatic for migrating existing systems

---

## 7. Trade-offs

### Consistency vs. Performance

| | Strong Consistency | Eventual Consistency |
|--|---|---|
| **How** | Synchronous read model updates | Async event-driven updates |
| **Latency** | Higher (waits for read model) | Lower (write returns immediately) |
| **Availability** | Lower (read model down = write blocked) | Higher (paths independent) |
| **Mental model** | Simple | Complex |
| **Use when** | Financial, inventory, correctness > speed | Social feeds, recommendations, analytics |

### Simplicity vs. Optimization

| | Single DB | Separate DBs |
|--|---|---|
| Scaling | Shared resources | Independent |
| Tech choice | One for both | Each optimized |
| Operational cost | Low | High |
| Start here? | ✅ Yes | Only when metrics show it's needed |

### Event Granularity

| | Fine-Grained Events | Coarse-Grained Events |
|--|---|---|
| Example | ItemAddedToCart, ItemRemoved | CartUpdated (full state) |
| Flexibility | High (precise projections) | Low |
| Complexity | High (event storms possible) | Low |
| Volume | High | Low |

---

## 8. When to Use / When to Avoid

### ✅ Use CQRS When:
- **Read:write ratio > 10:1** (social media feeds, e-commerce catalogs)
- Different read and write workloads have distinct characteristics
- Need **multiple read models** for different consumers (mobile app, admin dashboard, analytics)
- **Complex business logic** on writes that makes traditional CRUD unwieldy
- Need to **scale reads and writes independently**

### ❌ Avoid When:
- Simple CRUD domain with balanced read/write and straightforward validation
- Strong consistency required for ALL operations (no eventual consistency tolerable)
- Small team without distributed systems experience — operational overhead > benefits
- System doesn't need multiple different query patterns
- Can't articulate a concrete benefit — "it's best practice" is not enough

---

## 9. MERN Dev Notes (Node.js / Express)

### Command Handler

```javascript
// commandHandler.js
const { EventBus } = require('./eventBus');
const OrderRepository = require('./repositories/orderRepository');

async function createOrder(command) {
  // 1. Validate business rules
  if (!command.userId || !command.items?.length) {
    throw new Error('Invalid order: missing userId or items');
  }
  const total = command.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  if (total <= 0) throw new Error('Order total must be positive');

  // 2. Persist to write DB (PostgreSQL — normalized)
  const order = await OrderRepository.create({
    userId: command.userId,
    items: command.items,
    total,
    status: 'PENDING'
  });

  // 3. Publish event (write returns BEFORE read model updates)
  await EventBus.publish('OrderCreated', {
    orderId: order.id,
    userId: order.userId,
    items: order.items,
    total: order.total,
    createdAt: order.createdAt
  });

  // 4. Return acknowledgment, NOT data
  return { orderId: order.id, status: 'ACCEPTED' };
}
```

### Event Projector (Read Model Updater)

```javascript
// orderProjector.js
const OrderReadModel = require('./models/orderReadModel'); // MongoDB

EventBus.subscribe('OrderCreated', async (event) => {
  // Idempotency: skip if already processed
  const existing = await OrderReadModel.findOne({ orderId: event.orderId });
  if (existing) return;

  // Denormalize: embed user data, item details in single document
  const user = await UserService.getUser(event.userId);
  
  await OrderReadModel.create({
    orderId: event.orderId,
    // Embed for fast reads (no joins needed)
    userId: event.userId,
    userName: user.name,
    userEmail: user.email,
    items: event.items,
    total: event.total,
    status: 'PENDING',
    createdAt: event.createdAt,
    // Track event sequence for lag monitoring
    eventSequence: event.sequence
  });
});
```

### Query Handler

```javascript
// queryHandler.js
const OrderReadModel = require('./models/orderReadModel');

async function getOrder(orderId) {
  // Queries hit read model directly — no joins, sub-10ms
  const order = await OrderReadModel.findOne({ orderId });
  
  if (!order) {
    // Might be in transit (eventual consistency)
    return { status: 'PROCESSING', message: 'Order is being processed' };
  }
  
  return order;
}

async function getOrdersByUser(userId, page = 1, limit = 20) {
  return OrderReadModel
    .find({ userId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
}
```

### Express Routes — Separate Command/Query Endpoints

```javascript
// routes/orders.js
const router = require('express').Router();
const { createOrder } = require('../commandHandler');
const { getOrder, getOrdersByUser } = require('../queryHandler');

// COMMAND route (write)
router.post('/', async (req, res) => {
  try {
    const result = await createOrder(req.body);
    res.status(201).json(result); // Returns ID, not full order
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// QUERY routes (read)
router.get('/:orderId', async (req, res) => {
  const order = await getOrder(req.params.orderId);
  res.json(order);
});

router.get('/user/:userId', async (req, res) => {
  const orders = await getOrdersByUser(req.params.userId);
  res.json(orders);
});
```

### Read Model Lag Monitor (Express middleware)

```javascript
// lagMonitor.js
const EventBus = require('./eventBus');
const OrderReadModel = require('./models/orderReadModel');

// Track read model lag
async function measureLag() {
  const latestEvent = await EventBus.getLatestSequence('OrderCreated');
  const latestProcessed = await OrderReadModel.findOne({})
    .sort({ eventSequence: -1 })
    .select('eventSequence');

  const lag = latestEvent - (latestProcessed?.eventSequence || 0);
  
  if (lag > 1000) {
    console.error(`[CQRS] Read model lag: ${lag} events behind`);
    // Trigger alert
  }
  
  return lag;
}

// Run every 30 seconds
setInterval(measureLag, 30000);
```

---

## 10. Real-World Examples

### Netflix — Content Recommendation System
- **Write model**: PostgreSQL for content uploads, metadata — strict ACID, audit trail
- **Read models**: Cassandra (user recommendations), Elasticsearch (search), Graph DB (relationship queries)
- When content metadata changes → Kafka events flow to all read models
- **Blue-green read model rebuild**: every night, read models rebuilt from write model and validated; traffic switches to new model only after validation
- Result: sub-100ms recommendation serving to 200M+ users

### LinkedIn — Social Graph + Feed
- **Write model**: Relational DB for connection requests/accepts, profile updates (strongly consistent)
- **Read models**: Voldemort (key-value, feed pre-computed by fan-out), Graph DB (People You May Know), search engine
- **Hybrid fan-out**: influencers with millions of followers use fan-out-on-read; regular users use fan-out-on-write
- Demonstrates CQRS implementations can be adaptive based on scale

### Uber — Trip Management
- **Write model**: PostgreSQL for trip lifecycle (requested → accepted → started → completed)
- **Read models**: Redis (current trip status, sub-second updates), separate for driver earnings/history, Vertica (analytics), billing model
- **Geospatial read model**: updates GPS coordinates every few seconds, enables "show all active trips in San Francisco"
- Write model doesn't need to know about these geospatial query requirements

---

## 11. Interview Cheat Sheet

### One-Liner
> "CQRS separates write and read models with different schemas and often different databases — writes optimize for consistency and business rules, reads optimize for query performance."

### When to Bring It Up:
- System design with high read:write ratio (social media, e-commerce catalog, feeds)
- Scaling bottlenecks where read and write have different requirements
- Multiple consumers needing different views of the same data

### Key Points to Hit:
1. **Commands** change state, return acknowledgment; **Queries** return data, no side effects
2. **Eventual consistency** — UI must handle it: optimistic updates, "processing" states, timestamps
3. **Read models are denormalized** — no joins, data duplicated, pre-computed for specific patterns
4. **Event-driven sync** is preferred: decouple write from read, support multiple read models
5. **Idempotent event handlers** required — at-least-once delivery means duplicate processing
6. **Start simple**: single DB logical separation, then separate DBs when metrics justify it

### When NOT to use CQRS (important!):
- Simple CRUD with balanced read/write
- Strong consistency required for all operations
- Small team without distributed systems expertise
- Can't articulate concrete benefit

### Math: Read Model Lag
```
Lag = event_publish_time + queue_delay + processing_time + db_write_time
    = 2ms + 50ms + 10ms + 15ms = 77ms (normal)
    = 2ms + 500ms + 10ms + 15ms = 527ms (high load)
→ Design UI to handle up to 1 second of lag
```

### Math: Read Model Scaling
```
Required instances = (events/sec × processing_ms) / (target_lag_sec × 1000)
= (5000 × 20) / (1 × 1000) = 100 instances
```

---

## 12. Red Flags + Keywords

### Red Flags to Avoid

❌ **"CQRS is always better than CRUD"**
→ CQRS adds significant complexity. For simple domains, CRUD is better

❌ **"Eventual consistency is not a problem"**
→ It has real UI, business logic, and correctness implications — must be designed for

❌ **"Just use event sourcing with CQRS"**
→ They're independent patterns; event sourcing adds significant complexity, use only when you need audit trails or temporal queries

❌ **"Read models should be normalized like write models"**
→ The whole point is denormalization. If read model requires joins, it's not properly optimized

❌ **"CQRS eliminates the need for caching"**
→ CQRS optimizes the data model; caching optimizes delivery. They're complementary

### Keywords / Glossary

| Term | Meaning |
|------|---------|
| **CQRS** | Command Query Responsibility Segregation — separate write/read models |
| **Command** | Intent to change state; returns acknowledgment, not data |
| **Query** | Request for data; no side effects, no state changes |
| **Write Model** | Normalized schema, enforces business rules, ACID database |
| **Read Model** | Denormalized projection, optimized for specific query patterns |
| **Projector** | Component that consumes events and updates read models |
| **Eventual Consistency** | Read models lag behind write model (milliseconds to seconds) |
| **Idempotent Handler** | Processes same event multiple times with same result |
| **Event Sourcing** | Storing events instead of current state (complement to CQRS, not required) |
| **Fan-out** | Broadcasting an event to all followers' read models |
| **Shadow Mode** | Running both old and new implementations, comparing results |
| **Read Model Lag** | Time between write event and read model reflecting the change |
| **Optimistic Update** | UI shows change immediately before read model confirms |
| **Schema Registry** | Centralized management and validation of event schemas |
| **CDC** | Change Data Capture — streaming DB changes to other systems |
