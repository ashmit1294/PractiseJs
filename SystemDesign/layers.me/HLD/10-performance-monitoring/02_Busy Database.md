# Busy Database

## ELI5
Your database is like a chef in a restaurant. If the chef is not only cooking but also taking orders, washing dishes, and doing accounting — eventually the kitchen grinds to a halt. A busy database is one that's being asked to do too much: running business logic inside stored procedures, crunching analytics inline, handling thousands of connections from every app server directly. The solution is to let the database be a database — store and retrieve data — and push everything else elsewhere.

## Analogy
Imagine a librarian who not only finds your books but also performs the analysis you need from them, types up your essay, and manages 500 other students simultaneously. The solution isn't a faster librarian — it's separating the concerns.

---

## Core Concept
A **Busy Database** antipattern occurs when:
1. Business logic runs inside the DB (stored procedures, triggers)
2. Write-heavy or read-heavy load overwhelms a single instance
3. N+1 queries overload the DB with redundant small queries
4. Too many application connections exhaust the connection pool

### Symptoms
```
Metric                  Warning Threshold    Critical Threshold
────────────────────    ─────────────────    ──────────────────
DB CPU utilization      > 70%                > 85%
Query p95 latency       > 200ms              > 500ms
Query p99 latency       > 500ms              > 2s
Connection pool util    > 80%                > 95%
Replication lag         > 1s                 > 5s
Buffer pool hit rate    < 97%                < 95%
```

---

## The N+1 Problem (Most Common Root Cause)

```javascript
// ANTIPATTERN: 1 query for cart + N queries for each product
const cart = await Cart.findOne({ userId });          // 1 query
for (const item of cart.items) {
  const product = await Product.findById(item.productId); // N queries
  // ...
}
// Total: 1 + N queries, e.g. 31 queries for 30-item cart

// FIXED: Batched query = 2 total queries
const cart = await Cart.findOne({ userId });
const productIds = cart.items.map(i => i.productId);
const products = await Product.find({ _id: { $in: productIds } });
// 31 queries → 2 queries = 15× speedup
```

---

## 3-Phase Solution

```
Phase 1: OPTIMIZE (fastest ROI, 5-10× improvement)
  └─ Add missing indexes (EXPLAIN ANALYZE to find seq scans)
  └─ Fix N+1 queries → batch queries
  └─ Move business logic out of DB (stored procs → app layer)
  └─ Use query projections (SELECT id, name not SELECT *)

Phase 2: OFFLOAD (scale reads, 2-5× improvement)
  └─ Add read replicas for read-heavy queries
  └─ Introduce caching layer (Redis) for hot data
  └─ CDN for static/semi-static data

Phase 3: ARCHITECTURAL REFACTORING (horizontal scale)
  └─ Connection pooler (PgBouncer/ProxySQL)
  └─ Move analytics to separate DB (Snowflake, BigQuery)
  └─ CQRS: separate read model from write model
  └─ Sharding if data volume is the bottleneck
```

> ⚠️ **Always do Phase 1 before Phase 2/3. Sharding before optimizing is a red flag.**

---

## ASCII: Busy DB vs Optimized Flow

```
BEFORE (Busy Database)
────────────────────────────────────────────────
App Server 1 ──┐
App Server 2 ──┼──► Single PostgreSQL ◄── analytics
App Server 3 ──┤    CPU: 95%              ◄── business logic
App Server 4 ──┘    connections: full     ◄── N+1 queries

AFTER (Optimized)
────────────────────────────────────────────────
App Server 1 ──┐          ┌─► Replica 1 (reads)
App Server 2 ──┼── Pool ──┤
App Server 3 ──┤   (PgBouncer) ──►  Primary (writes only)
App Server 4 ──┘          │
                           ├─► Redis (hot cache)
                           └─► Snowflake (analytics)
```

---

## MERN Developer Notes

```javascript
// Bad: Raw connection per request
app.get('/products', async (req, res) => {
  const client = new MongoClient(uri);   // new connection every request!
  await client.connect();
  const products = await client.db().collection('products').find().toArray();
  await client.close();
  res.json(products);
});

// Good: Shared pool (single MongoClient for the process lifetime)
const client = new MongoClient(uri, {
  maxPoolSize: 50,     // max connections in pool
  minPoolSize: 10,     // keep connections warm
});
await client.connect(); // once at app startup

app.get('/products', async (req, res) => {
  const products = await client.db().collection('products').find(
    {},
    { projection: { name: 1, price: 1, category: 1 } }  // projection, not SELECT *
  ).toArray();
  res.json(products);
});
```

---

## Real-World Examples

| Company | Problem | Fix | Result |
|---|---|---|---|
| Uber 2016 | PostgreSQL for geospatial dispatch — CPU >90% | Moved driver locations to in-memory Go R-tree | 50× speedup |
| GitHub | N+1 queries on repo metadata pages | Composite indexes + PgBouncer | Top 10% repos = 90% of page views optimized |
| Stack Overflow | Single DB for everything | Strategic caching + read replicas | Handles millions of req/day with 1 primary DB |

---

## Interview Cheat Sheet

**Q: Your API p99 latency suddenly spiked from 100ms to 3s. How do you diagnose a Busy DB issue?**

> A: Check DB CPU and connection pool utilization first. If CPU >80% or connections saturated, run `EXPLAIN ANALYZE` on high-frequency queries in the slow query log. Look for sequential scans (missing indexes), N+1 patterns (same table queried hundreds of times per second), and large read result sets. Check if business logic or aggregations are running inside DB views or triggers.

**Q: When would you add a read replica vs. adding an index?**

> A: Index first — it solves the root cause (inefficient query) and helps all replicas. A read replica reduces CPU/IO by distributing reads, but if the underlying query is doing a full table scan, each replica does the same expensive scan. Only after optimizing queries should you add replicas for traffic volume.

**Q: What's the correct order to solve a Busy Database?**

> A: Phase 1: Optimize — fix indexes, fix N+1, remove business logic from DB. Phase 2: Offload — caching, read replicas. Phase 3: Rewrite — CQRS, sharding. Jumping to Phase 3 first (e.g., sharding) without optimizing is a red flag that wastes months.

**Q: Why is connection pool exhaustion dangerous?**

> A: Each new TCP connection to PostgreSQL/MySQL has 50ms overhead. At 1,000 req/s, creating new connections consumes 50 CPU-seconds/second. When the pool maxes out, new requests queue up then timeout, causing cascading failures. PgBouncer as a connection multiplexer reduces 1,000 app connections to 50 actual DB connections.

**Q: How do you calculate the right pool size?**

> A: Little's Law: concurrent_connections = request_rate × query_time. At 500 req/s with average query latency of 20ms: 500 × 0.020 = 10 active connections. Set min=10, max=50 (5× buffer for spikes). Never set max connection = CPU cores — DB overhead per connection is larger than thread overhead.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **Busy Database** | DB overloaded with compute, logic, or too many concurrent connections |
| **N+1 query problem** | Fetching N child records in separate sequential queries instead of one batch |
| **EXPLAIN ANALYZE** | PostgreSQL command to show query execution plan and actual timing |
| **Sequential scan** | Full table scan — usually indicates a missing index |
| **Connection pool** | Pre-created DB connections reused across requests (avoid per-request connect) |
| **PgBouncer** | PostgreSQL connection pooler — multiplexes many app connections to few DB connections |
| **Read replica** | DB copy that forwards to primary for writes, serves reads independently |
| **CQRS** | Command Query Responsibility Segregation — separate models for reads and writes |
| **Little's Law** | L = λW — pool size = request_rate × latency |
| **Replication lag** | Delay between primary write and replica visibility — acceptable up to ~5s for non-critical reads |
