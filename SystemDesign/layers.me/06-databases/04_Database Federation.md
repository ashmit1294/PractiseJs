# T04 — Database Federation

---

## 1. ELI5

Imagine one giant company cafeteria kitchen that handles everything — breakfast, lunch, dinner, salads, desserts, all 5,000 employees. It's chaos. Every chef blocks others. The dessert chef can't reach the stove because the soup chef is there.

So you split it: **Kitchen A** only makes salads. **Kitchen B** only makes hot meals. **Kitchen C** only makes desserts. Each kitchen operates independently, has its own staff, own equipment, own schedule. No blocking.

That's database federation — instead of one database for everything, split by **business function**.

---

## 2. Analogy

**Government Departments**

The government doesn't have one mega-database for everything. There's:
- Department of Motor Vehicles → handles drivers, vehicles
- IRS → handles tax records
- Social Security → handles citizen benefits
- Post Office → handles addresses, deliveries

Each department runs its own systems. They occasionally share data via official channels (API calls, periodic file transfers). No department can directly query another's database — they must go through defined interfaces.

Federation = same principle for your company's databases.

---

## 3. Core Concept

### What is Database Federation?

Database federation (also called **functional partitioning**) splits one monolithic database into multiple smaller databases, each responsible for a specific business domain.

```
MONOLITHIC DATABASE:
┌─────────────────────────────────────────────────────┐
│  users     orders    products    payments    reviews │
│  sessions  coupons   inventory   shipping    ratings │
│  ← everything in one PostgreSQL instance →          │
│  Single writer → bottleneck at 50K writes/sec max   │
└─────────────────────────────────────────────────────┘

FEDERATED DATABASES:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  users_db    │  │  orders_db   │  │ products_db  │  │ payments_db  │
│  users       │  │  orders      │  │  products    │  │  payments    │
│  sessions    │  │  coupons     │  │  inventory   │  │  settlements │
│  profiles    │  │  shipping    │  │  categories  │  │  refunds     │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
Each DB owned by a different team. Each scales independently.
```

### Key Difference from Sharding

| Feature | Sharding | Federation |
|---------|---------|-----------|
| Split by | **Rows** (same table, different machines) | **Function** (different tables on different machines) |
| What moves | Rows of one table across shards | Whole tables/domains to separate DBs |
| Use case | One table too big for one machine | One DB too busy with multiple domains |
| Cross-query cost | Scatter-gather across shards | API call or event (no direct SQL) |

---

## 4. ASCII Architecture

### Monolith → Federation Migration

```
BEFORE FEDERATION:
                    ┌──────────────────────┐
  All services ───► │   PostgreSQL monolith │
                    │   users + orders +    │
                    │   products + payments │
                    └──────────────────────┘
                             ▲
                    Single bottleneck: CPU, I/O, connections
                    Schema changes require cross-team coordination

AFTER FEDERATION:
                    ┌─────────────────────────────────────────────┐
                    │              API Gateway / BFF               │
                    └──────┬──────────┬───────────┬───────────────┘
                           │          │           │
              ┌────────────▼┐  ┌──────▼──┐  ┌────▼──────────┐
              │  User Svc   │  │Order Svc│  │ Payment Svc   │
              └──────┬──────┘  └────┬────┘  └───────┬───────┘
                     │              │               │
              ┌──────▼──┐    ┌──────▼──┐    ┌──────▼──┐
              │ users_db│    │order_db │    │  pay_db │
              │ PgSQL   │    │ PgSQL   │    │ PgSQL   │
              └─────────┘    └─────────┘    └─────────┘

Each team: owns their DB, deploys independently, scales independently
```

### Cross-Database Reference (No Direct SQL JOIN)

```
GET /api/orders/order_456/full-details

Order Service receives request:
  1. Fetch order from orders_db
     SELECT * FROM orders WHERE id = 'order_456'
     → { order_id, user_id: 'user_123', product_id: 'prod_789', amount: 49.99 }
  
  2. API call to User Service (NOT a SQL JOIN)
     GET http://user-service/users/user_123
     → { name: 'Alice', email: 'alice@example.com', address: '...' }
  
  3. API call to Product Service
     GET http://product-service/products/prod_789
     → { name: 'Wireless Headphones', category: 'Electronics' }
  
  4. Assemble and return combined response
  
Cost: 3 network round-trips vs 1 SQL JOIN
      ~3–15ms overhead but enables independent scaling
```

---

## 5. Data Consistency in Federation

### Problem: No Distributed Transactions Across DBs

```
// MONOLITH — ACID transaction across tables:
BEGIN;
  INSERT INTO orders(user_id, amount) VALUES ('123', 99.99);
  UPDATE inventory SET quantity = quantity - 1 WHERE product_id = 'P1';
  INSERT INTO payments(order_id, amount) VALUES (lastval(), 99.99);
COMMIT;
// ← All-or-nothing. If payment fails → order and inventory rollback.

// FEDERATION — No cross-DB transactions:
// Order Service: INSERT into orders_db
// Inventory Service: UPDATE inventory_db
// Payment Service: INSERT into payments_db
// ← If payment fails AFTER order was inserted → INCONSISTENCY
```

### Solution: Saga Pattern (Distributed Compensation)

```
Saga = sequence of local transactions with compensating transactions on failure

HAPPY PATH:
  1. Order Svc: INSERT order (state = 'pending')       → orders_db
  2. Inventory Svc: RESERVE inventory                  → inventory_db
  3. Payment Svc: CHARGE card                          → payments_db
  4. Order Svc: UPDATE order (state = 'confirmed')     → orders_db

FAILURE (payment declined at step 3):
  3. Payment fails → emit PaymentFailed event
  Compensate step 2: Inventory Svc RELEASES reservation
  Compensate step 1: Order Svc UPDATE order (state = 'cancelled')

Result: Eventual consistency — system converges to valid state
        NOT atomic — other services see 'pending' order briefly
```

### Eventual Consistency via Events

```
User changes shipping address → users_db updated
    ↓
UserAddressUpdated event → message queue (Kafka/SQS)
    ↓
Order Service consumes event → updates denormalized address in orders_db
    ↓
Shipping Service consumes event → updates shipping_db

Window of inconsistency: event propagation delay (50–500ms)
Acceptable for: "show user their address" → slightly stale = fine
NOT acceptable for: payment amount → must be real-time
```

---

## 6. Polyglot Persistence — Best DB per Domain

Federation enables choosing the best database type per service:

```
┌─────────────────────┬──────────────────────────────────────────────┐
│ Domain              │ Best DB + Reason                             │
├─────────────────────┼──────────────────────────────────────────────┤
│ User profiles       │ PostgreSQL — ACID, structured, complex queries│
│ Session data        │ Redis — TTL-based expiry, O(1) lookups       │
│ Product catalog     │ MongoDB — flexible schema, nested attributes  │
│ Orders / Payments   │ PostgreSQL — ACID transactions required       │
│ Activity feed       │ Cassandra — time-series, 1M+ writes/sec      │
│ Search              │ Elasticsearch — full-text, faceted search     │
│ Recommendations     │ Neo4j — graph traversal for relationships     │
│ Analytics/reporting │ Snowflake/BigQuery — OLAP, columnar           │
└─────────────────────┴──────────────────────────────────────────────┘
```

---

## 7. Math & Formulas

### Write Throughput Gains

```
Monolith: 1 DB handles all writes
  Max throughput ≈ 50,000 writes/sec (typical PostgreSQL)

After federation into 4 DBs (users, orders, products, payments):
  Each DB independently handles writes for its domain
  
  If 50K total writes/sec split as:
    users_db:    5K  (10%)
    orders_db:   20K (40%)
    products_db: 5K  (10%)
    payments_db: 20K (40%)
  
  Max capacity now = 4 × 50K = 200K writes/sec
  But: actual gain = avoiding the 50K bottleneck, not 4× raw throughput
  
Rule: Federation parallelizes writes across domains
      Sharding parallelizes writes within one domain
```

### Connection Pool Math

```
Monolith: 1 DB, max_connections = 100
  50 services × 2 connections each = 100 connections → saturated

Federation: 4 DBs × 100 connections = 400 total connections
  Each service only connects to relevant DBs
  users_service connects to users_db only (2 connections)
  Not every service connects to every DB → realistic connection counts
```

---

## 8. MERN Stack Dev Notes

### Node.js — Multiple Database Connections per Service
```javascript
// Each microservice connects ONLY to its own database
// user-service/db.js
const { Pool } = require('pg');
const userDb = new Pool({
  connectionString: process.env.USERS_DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000
});

module.exports = userDb;

// order-service/db.js
const orderDb = new Pool({
  connectionString: process.env.ORDERS_DATABASE_URL,
  max: 20  // orders service might need more connections
});

// ✅ No single service can access another's DB directly
// ✅ Each service's DB credentials are separate
```

### Cross-Service Data Fetching (API composition)
```javascript
// order-service/routes/orders.js
const axios = require('axios');

app.get('/orders/:orderId/details', async (req, res) => {
  const { orderId } = req.params;
  
  // Fetch order from own DB
  const order = await orderDb.query(
    'SELECT * FROM orders WHERE id = $1', [orderId]
  );
  if (!order.rows[0]) return res.status(404).json({ error: 'Not found' });
  
  // Fetch related data via inter-service HTTP calls
  // Use Promise.all for parallel fetching
  const [user, product] = await Promise.all([
    axios.get(`${process.env.USER_SERVICE_URL}/users/${order.rows[0].user_id}`,
              { headers: { 'x-internal-token': process.env.INTERNAL_TOKEN } }),
    axios.get(`${process.env.PRODUCT_SERVICE_URL}/products/${order.rows[0].product_id}`)
  ]);
  
  res.json({
    ...order.rows[0],
    user: user.data,
    product: product.data
  });
  // ⚠️ 2 extra network calls vs 1 SQL JOIN — acceptable for federated arch
});
```

### Event-Driven Eventual Consistency (with Kafka/Redis Streams)
```javascript
// user-service: emit event on address update
app.put('/users/:userId/address', async (req, res) => {
  await userDb.query(
    'UPDATE users SET address = $1 WHERE id = $2',
    [req.body.address, req.params.userId]
  );
  
  // Publish event for other services that cache user address
  await kafka.send({
    topic: 'user.address.updated',
    messages: [{
      key: req.params.userId,
      value: JSON.stringify({
        userId: req.params.userId,
        newAddress: req.body.address,
        updatedAt: new Date().toISOString()
      })
    }]
  });
  
  res.json({ success: true });
});

// order-service: consume address update event
kafka.subscribe({ topic: 'user.address.updated' }, async ({ message }) => {
  const { userId, newAddress } = JSON.parse(message.value);
  // Update denormalized copy of address in orders DB
  await orderDb.query(
    'UPDATE orders SET shipping_address = $1 WHERE user_id = $2 AND status != $3',
    [newAddress, userId, 'delivered']
  );
});
```

---

## 9. Real-World Case Studies

### Netflix — Federation by Brand + Function
```
Scale: 230M+ subscribers, 190+ countries
Strategy: Functional + geographic federation

Databases:
  content_metadata_db  (MySQL sharded)   ← titles, genres, languages
  viewing_history_db   (Cassandra)       ← 420TB, 1B+ events/day
  recommendation_db    (Cassandra)       ← pre-computed vectors
  billing_db           (MySQL/CockroachDB) ← payments, invoices
  user_profile_db      (MySQL Vitess)    ← preferences, settings
  asset_db             (S3 + PostgreSQL) ← video files + metadata

Design principles:
  - Each team owns one DB, deploys on own schedule
  - Cross-service: REST APIs or Kafka events (no direct SQL)
  - Eventual consistency: recommendation updates lag by hours = fine
  - Billing DB: near-real-time consistency enforced via sync API calls
```

### Uber — Trips + Drivers + Riders + Payments Split
```
Scale: 100M+ trips/month, global
Strategy: Domain-based federation

  trips_db      (Schemaless on MySQL, sharded by city)
  drivers_db    (PostgreSQL + Redis for real-time location)
  riders_db     (PostgreSQL, user profiles + payment methods)
  payments_db   (PostgreSQL, transactions + receipts)
  
Cross-domain coordination (trip completion):
  1. trips_db: UPDATE trip SET status = 'completed', fare = $X
  2. payments_db: CHARGE rider
  3. payments_db: CREDIT driver (minus Uber commission)
  
Uses Saga pattern:
  If payment fails → trip stored as 'payment_failed'
  Background job retries payment up to 3 times
  If all fail → trigger manual review queue
```

### Shopify — Two-Level Federation
```
Scale: 1.7M+ merchants
Strategy:
  Level 1: Shard by shop_id (horizontal) → thousands of shards
  Level 2: Within each shop shard, federate by domain:
    - Core shop data (products, inventory)
    - Orders DB (transactions, line items)
    - Analytics DB (read-only replica + aggregations)
    
Benefit:
  Each merchant's data is isolated (shop_id shard)
  Within a merchant, heavy analytics don't compete with order writes
  Team autonomy: checkout team owns checkout DB independently
```

---

## 10. Interview Cheat Sheet

**Q: What is database federation?**
> Functional partitioning — splitting a monolithic database into multiple smaller databases, each responsible for a specific business domain. E.g., users_db, orders_db, products_db, payments_db. Each scales independently and is owned by a separate team.

**Q: How does federation differ from sharding?**
> Sharding splits rows of the same table across machines (horizontal partitioning). Federation splits different tables/domains across machines (vertical/functional partitioning). You often combine both: federate first by domain, then shard each domain's database if it grows large.

**Q: How do you handle cross-service queries in a federated architecture?**
> (1) API composition: join data in application layer via parallel API calls. (2) Denormalization: copy frequently needed foreign data into each service's DB. (3) Event-driven sync: services publish events; consumers update their own denormalized copies. Never use cross-database SQL JOINs.

**Q: How do you maintain consistency without distributed transactions?**
> Use the Saga pattern: sequence of local transactions with compensating transactions on failure. Accept eventual consistency — services converge to a consistent state via events. For critical operations (payments), use a synchronous 2-phase approach or idempotent retry queues.

**Q: What are the downsides of federation?**
> (1) Cross-domain queries require multiple network calls (latency). (2) No atomic transactions across DBs (use Saga instead). (3) Operational complexity: N databases to monitor, backup, tune. (4) Eventual consistency windows. (5) Schema coordination for shared identifiers.

---

## 11. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Federation** | Splitting one DB into multiple by business function |
| **Functional Partitioning** | Same as federation — split by domain/function |
| **Polyglot Persistence** | Using different database types for different services |
| **Saga Pattern** | Distributed transaction using local txns + compensating rollbacks |
| **Compensating Transaction** | Undo a previous step in a failed Saga |
| **Eventual Consistency** | All replicas/services converge to consistent state, with lag |
| **API Composition** | Fetching data from multiple services and assembling in app layer |
| **Denormalization** | Copying data from one service's DB to another to avoid API calls |
| **Event-Driven Sync** | Services publish events; consumers update their own copies |
| **Cross-DB Join** | SQL JOIN across two separate databases — NOT possible, use API instead |
| **Service Boundary** | Each microservice owns exactly one database — no direct DB access across services |
| **Vertical Partitioning** | Splitting columns/domains (federation) vs rows (sharding = horizontal) |
| **Team Autonomy** | Each team owns, deploys, scales their own DB independently |
