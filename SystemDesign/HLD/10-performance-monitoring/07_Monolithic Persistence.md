# Monolithic Persistence

## ELI5
Your startup uses one database for everything: user profiles, order history, chat messages, analytics, search. As you scale, teams argue over schema changes, the DB becomes the bottleneck for everything, and a slow analytics query freezes the user-facing API. Monolithic persistence is using one database system for all your different data needs when they have fundamentally different requirements.

## Analogy
Using one all-purpose knife for surgery, cooking, and woodworking. Each task works *fine* at first, but as you need to scale each task, a specialist tool is immensely better. You eventually need a scalpel, chef's knife, and chisel — each optimized for its domain.

---

## Core Concept
**Monolithic Persistence** occurs when a single database:
1. Serves all read and write traffic (bottlenecks both)
2. Stores all data domains (schema coordination tax)
3. Uses one data model for all access patterns (square peg, round hole)
4. Creates org bottleneck — all teams fight over the same DB schema

---

## When to Decompose

```
Decompose when ANY of these are true:
  ├─ DB CPU sustained > 70%
  ├─ Schema changes require coordinating 10+ teams
  ├─ One domain's access pattern conflicts with another
  │    (e.g., analytics full-table-scans block user-facing reads)
  └─ One business domain can tolerate data loss that another cannot
```

---

## Solutions (Decomposition Strategies)

### 1. Read Replicas (First Step)
```
Primary (writes) ──replication──► Replica 1 (dashboard queries)
                                 ► Replica 2 (analytics)
                                 ► Replica 3 (app reads)

Acceptable replication lag: 1-5s for non-critical reads
Not suitable: anything requiring fresh data (e.g., payment balance)
```

### 2. Sharding (Horizontal Write Scale)
```javascript
// Consistent hashing: co-locate related data on same shard
function getShard(userId, numShards = 16) {
  return hash(userId) % numShards;
}

// Users table sharded by userId:
// Shard 0: users 0, 16, 32, 48...
// Shard 1: users 1, 17, 33, 49...

// ⚠️ Cross-shard queries are expensive (scatter-gather):
// "Get all users who purchased product X" = query all shards
```

### 3. Database-per-Service
```
Each bounded context owns its own DB:
  User Service         → PostgreSQL (users, prefs)
  Order Service        → PostgreSQL (orders, items)
  Inventory Service    → PostgreSQL (products, stock)
  Chat Service         → Cassandra (write-heavy time-series)
  Search Service       → Elasticsearch (full-text)
  Session Service      → Redis (sub-ms key-value)

API-only cross-service data access (no direct DB joins across services)
```

### 4. CQRS (Command Query Responsibility Segregation)
```
Write path:                    Read path:
─────────────────             ─────────────────────────────
Command (write)               Read Model (optimized)
     │                              ↑
     ▼                              │ Denormalized
PostgreSQL ──CDC──► Kafka ──►  Elasticsearch (text search)
(normalized,        (event       Redis (user feed, sub-ms)
 ACID, writes)       stream)      Snowflake (analytics)
                                   Read Replica (dashboards)

CDC = Change Data Capture (e.g., Debezium reads Postgres WAL)
```

### 5. Polyglot Persistence
```
Choose the right DB for each access pattern:

PostgreSQL   ACID transactions, complex queries, relationships
Cassandra    Write-heavy time-series (IoT, events), high availability
Redis        Sub-millisecond key-value, caching, pub/sub
Elasticsearch Full-text search, log analytics
MongoDB      Flexible schema, document-oriented, BSON
Snowflake    Analytics, data warehouse, columnar
InfluxDB     Time-series metrics
```

---

## ASCII: Monolith vs Polyglot

```
MONOLITHIC PERSISTENCE
───────────────────────────────────────────────────────
All Services → [Single PostgreSQL]
               CPU: 95%
               Schema: 200+ tables owned by 20+ teams
               Analytics queries blocking API reads

POLYGLOT (after decomposition)
───────────────────────────────────────────────────────
User API      → PostgreSQL (user data, ACID)
Order API     → PostgreSQL (orders, transactions)
Chat API      → Cassandra (messages, write-heavy)
Search API    → Elasticsearch (product search)
Cache Layer   → Redis (sessions, hot data, feeds)
Analytics     → Snowflake (read from CDC stream)
               ↑
               All fed by CDC (Debezium/Kafka) from source DBs
```

---

## Migration Strategy (4 Phases)

```
Phase 1: Identify Bounded Contexts (2-4 weeks)
  └─ Domain decomposition: users / orders / inventory / search / chat
  └─ Map team ownership to domain boundaries

Phase 2: Extract Read Models with CDC (4-8 weeks)
  └─ Set up Debezium to capture changes from primary DB
  └─ Build Elasticsearch index for search domain
  └─ Build Redis cache for hot read paths
  └─ Dual-read: try new model, fall back to primary

Phase 3: Dual Writes (4-8 weeks)
  └─ Write to both old monolith and new service DB
  └─ Run consistency checks between the two
  └─ Feature flag to switch read traffic gradually

Phase 4: Migrate Writes Gradually (2-4 weeks per service)
  └─ Move write traffic to new service
  └─ Keep monolith as source of truth for 3-6 months (rollback)
  └─ Feature flags for gradual cutover

Cross-service data (ongoing):
  ├─ Non-critical (driver_name on ride): eventual consistency via events
  └─ Critical (charge_card): synchronous API call to payment service
```

---

## MERN Developer Notes

```javascript
// Single MongoDB cluster → decomposing to polyglot
// Before: One MongoClient for everything
const db = client.db('app');
const users = db.collection('users');
const logs = db.collection('event_logs');  // high write volume!
const products = db.collection('products');

// After: Separate clients per domain
const userDb = new MongoClient(USER_DB_URI, { maxPoolSize: 20 });
const logDb = new MongoClient(LOG_DB_URI, { maxPoolSize: 100 });  // Cassandra?
const searchClient = new Client({ node: ELASTICSEARCH_URL });
const redisCache = new Redis(REDIS_URL);

// Cross-service: No direct DB joins — use API calls or CDC
async function getOrderWithUserName(orderId) {
  const order = await orderDb.collection('orders').findOne({ _id: orderId });
  // Call user service API, not user DB directly:
  const user = await userServiceClient.getUser(order.userId);
  return { ...order, userName: user.name };
}
```

---

## Real-World Examples

| Company | Problem | Fix | Result |
|---|---|---|---|
| Airbnb | Monolithic MySQL serving all 100+ domains | 18-month DB decomposition with Saga pattern | Independent scaling per domain; 100+ microservices |
| Uber | PostgreSQL for everything (including rides) | Cassandra for time-series (driver locations) | Write throughput 10s of millions/sec |
| Netflix | Single DB → chaos engineering born from this | DB-per-service + Chaos Monkey killing DB instances | Verified graceful degradation at scale |

---

## Interview Cheat Sheet

**Q: What's the main risk of sharding too early?**

> A: Cross-shard queries (scatter-gather) become expensive. If your most common queries span multiple shards (e.g., "get all orders for user X" when orders shard by product_id, not user_id), you've made queries harder and gained nothing. Shard on the dimension of your most common query. Also: sharding before optimizing queries and adding replicas is almost always premature.

**Q: Explain CQRS and when to use it.**

> A: CQRS separates the write model (normalized, ACID, PostgreSQL) from read models (denormalized, optimized per query pattern). Changes flow from write model via CDC (Debezium reads the DB transaction log) → Kafka → specialized read stores (Elasticsearch for search, Redis for feeds). Use CQRS when your read and write access patterns are fundamentally different — e.g., high-frequency writes normalized in PostgreSQL but reads need full-text search or millisecond latency.

**Q: How do you handle cross-service transactions after DB decomposition?**

> A: Two patterns: (1) Eventual consistency via events — for non-critical data (display driver name on a completed ride), publish an event after the write and denormalize asynchronously. (2) Saga pattern — for distributed transactions requiring rollback (booking flow: reserve car → charge payment → confirm). Each step publishes an event; if a step fails, compensating transactions run in reverse.

**Q: What's the difference between read replicas and CQRS?**

> A: Read replicas duplicate the same data model for read loads. CQRS creates differentiated read models — each optimized for a specific query type (Elasticsearch for text search, Redis for millisecond lookups, Snowflake for analytics). Use replicas when you need the same query pattern at higher throughput. Use CQRS when different consumers need fundamentally different data structures.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **Monolithic Persistence** | Single database serving all domains and access patterns |
| **Polyglot persistence** | Using different DB technologies for different access patterns |
| **CQRS** | Command Query Responsibility Segregation — separate write and read models |
| **CDC** | Change Data Capture — capturing DB change events from the transaction log |
| **Debezium** | Open-source CDC tool that reads PostgreSQL/MySQL WAL and publishes to Kafka |
| **Bounded context** | DDD concept — a domain with a clear ownership boundary and its own data |
| **Sharding** | Horizontal partitioning — distributing rows across multiple DB instances by a shard key |
| **Scatter-gather** | Query that must hit all shards and aggregate results — expensive in sharded systems |
| **Saga pattern** | Distributed transaction pattern — sequence of local transactions with compensating rollbacks |
| **Consistent hashing** | Sharding algorithm that minimizes data movement when shards are added/removed |
