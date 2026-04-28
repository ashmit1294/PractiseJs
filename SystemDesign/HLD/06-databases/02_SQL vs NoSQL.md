# T02 — SQL vs NoSQL

---

## 1. ELI5

Imagine you have two kinds of notebooks:

- **SQL notebook**: Pre-printed forms with strict fields. Every entry looks the same. You can cross-reference between notebooks instantly with tabs.
- **NoSQL notebook**: Blank pages. Write whatever you want. Easy to duplicate pages into many binders. Cross-referencing requires you to walk between binders yourself.

SQL is the pre-printed form — rigid but powerful. NoSQL is the blank page — flexible but you give up some guarantees.

---

## 2. Analogy

**SQL = Spreadsheet at a bank branch**
Every row: AccountID | Name | Balance | Date. Always the same columns. Transfers require updating two rows atomically — the bank won't let one row update without the other.

**NoSQL = Post-it notes on a whiteboard**
Each post-it can have whatever content you want (user profile with or without phone number). Stick them anywhere. Copy them to five whiteboards instantly. But "transfer between two post-its" requires you to coordinate manually.

---

## 3. Core Concept

### The Fundamental Trade-off Triangle

```
         STRONG CONSISTENCY
               /\
              /  \
             /    \
            /  SQL \
           /________\
          /            \
COMPLEX    \            /   SIMPLE
QUERIES     \  NoSQL   /    QUERIES
             \        /
              \      /
               \    /
        VERTICAL \/ HORIZONTAL
         SCALING     SCALING
```

### SQL (Relational Databases)

| Property | Detail |
|----------|--------|
| Schema | Fixed, enforced at DB level |
| Scaling | Vertical (bigger machine) |
| Consistency | ACID — strong |
| Joins | Native, efficient |
| Query language | SQL — powerful, standardized |
| Transactions | Multi-row, multi-table |
| Examples | PostgreSQL, MySQL, Oracle, SQL Server |

**ACID = The 4 Laws of SQL Correctness**
```
A — Atomicity   : All-or-nothing. Transfer $100 deducts AND credits, or neither.
C — Consistency : DB always moves from one valid state to another.
I — Isolation   : Concurrent transactions don't see each other's partial work.
D — Durability  : Committed data survives crashes (written to disk via WAL).
```

### NoSQL (Non-Relational Databases)

| Property | Detail |
|----------|--------|
| Schema | Flexible (schema-on-read or none) |
| Scaling | Horizontal (add more machines) |
| Consistency | Eventual (BASE model) |
| Joins | No native joins — denormalize or app-level |
| Query language | Varies per DB |
| Transactions | Usually single-document/row |
| Examples | MongoDB, Cassandra, DynamoDB, Redis, Neo4j |

**BASE = The 3 Laws of NoSQL Availability**
```
BA — Basically Available  : System responds even during partial failures.
S  — Soft State           : Data may be in transition between replicas.
E  — Eventually Consistent: All replicas will converge... eventually.
```

---

## 4. ACID vs Eventual Consistency — Under the Hood

### Synchronous Replication (SQL default for single-master)
```
Client → Master DB
              ↓ Write
         Replica 1 ← fsync + ACK
         Replica 2 ← fsync + ACK  ← Master waits for ALL ACKs
              ↓
         Return success to client

Latency: +2–10ms per write (network round trip to replicas)
Guarantee: All replicas have data before client gets "success"
```

### Asynchronous Replication (NoSQL default)
```
Client → Primary Node
              ↓ Write → Return success immediately (< 1ms)
              ↓
         Replica 1 ← replicates in background (50–500ms lag)
         Replica 2 ← replicates in background (50–500ms lag)
         Replica 3 ← replicates in background (50–500ms lag)

Read from replica: might get STALE data during lag window
```

---

## 5. CAP Theorem Positioning

```
           Consistency
               /\
              /  \
             / CP \         ← CockroachDB, Spanner, HBase, ZooKeeper
            /------\
           /   CA   \       ← PostgreSQL, MySQL (single master, no partitions)
          /----------\
         /     AP     \     ← Cassandra, DynamoDB, CouchDB
        /______________\
      Availability    Partition Tolerance
```

**Key insight**: In real distributed systems, **Partition Tolerance is mandatory** (networks fail). So the real choice is **CP vs AP**.

- **CP**: Refuse writes during partition → no stale reads but system may be unavailable
- **AP**: Accept writes during partition → system stays up but replicas may diverge

---

## 6. ASCII Architecture Diagrams

### SQL Architecture (Single Master + Read Replicas)
```
                    ┌─────────────────┐
  Writes ──────────►│   Master DB     │
                    │  PostgreSQL     │
                    └────────┬────────┘
                             │ binary replication log (WAL stream)
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Replica 1│  │ Replica 2│  │ Replica 3│
        └──────────┘  └──────────┘  └──────────┘
              ▲              ▲              ▲
              └──────────────┴──────────────┘
                           Reads

Writes: 1 node   │  Reads: scale horizontally
Schema: fixed    │  Joins: efficient
ACID: ✅         │  Max practical: ~10TB, ~50K writes/sec
```

### NoSQL Architecture (Cassandra Ring)
```
         ┌──────────────────────────────────┐
         │         Hash Ring (0–2^32)       │
         │                                  │
         │    Node A         Node B         │
         │   (token 0)    (token 2^10)      │
         │      ●──────────────●            │
         │     /│              │\           │
         │    / │              │ \          │
         │   /  │              │  \         │
         │  ●   │    Ring      │   ●        │
         │ Node D              │  Node C    │
         │(token 3×2^10)  (token 2×2^10)   │
         │  ●───────────────────●           │
         └──────────────────────────────────┘

Each write replicates to N nodes (replication factor = 3)
Coordinator picks closest nodes → no single master
Reads: quorum (R + W > N) = tunable consistency
```

---

## 7. When to Use SQL vs NoSQL

### Choose SQL When:

| Signal | Example |
|--------|---------|
| ACID transactions required | Bank transfers, e-commerce orders, inventory updates |
| Complex JOIN queries (3+ tables) | Analytics dashboards, reporting, admin panels |
| Data < 10TB | Most startups, mid-size businesses |
| Strong consistency required | Billing, payments, user account state |
| Schema is stable & known | Compliance-driven systems |

**Real-world SQL users**: Stripe (PostgreSQL, vertical scaling, no NoSQL for core payments), Shopify (MySQL, sharded by shop_id), GitHub (MySQL, millions of repos)

### Choose NoSQL When:

| Signal | Example |
|--------|---------|
| Massive scale: >100TB, >1M writes/sec | Netflix viewing history, LinkedIn activity feed |
| Eventual consistency acceptable | Social feeds, notification counters, analytics |
| Flexible/evolving schema | Product catalogs, user-generated content |
| Time-series / append-only writes | IoT sensor data, log storage, chat messages |
| Simple access patterns (key lookups, scans) | Shopping cart, session storage, rate limiting |

**Real-world NoSQL users**: Netflix (Cassandra, 420TB viewing history), DoorDash (Cassandra, orders+delivery), Uber (Schemaless — NoSQL interface on MySQL)

---

## 8. Concrete Decision Framework

```
START: Do you need this system?
         │
         ▼
Is data relational (JOIN between entities)?
├── YES → Does data fit on one machine (<10TB)?
│            ├── YES → PostgreSQL or MySQL ✅
│            └── NO  → Shard SQL (Vitess) or NewSQL (CockroachDB)
│
└── NO  → What's your primary access pattern?
              ├── Key lookups (GET/SET)       → Redis / DynamoDB
              ├── Document queries            → MongoDB
              ├── Time-series / append-only   → Cassandra / HBase
              ├── Full-text search            → Elasticsearch
              ├── Graph traversals            → Neo4j / Neptune
              └── Analytics (read-heavy OLAP) → Snowflake / BigQuery
```

### The Schema Migration Problem (SQL Tax)

```sql
-- Adding a column to 1 billion rows in PostgreSQL:
ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10,2);
-- ^ Rewrites entire table. Duration: HOURS. Table LOCKED during operation.

-- NoSQL (MongoDB): no migration needed
// Just start writing new documents with discountAmount field
// Old documents: field simply absent (schema-on-read)
```

This is why NoSQL wins for rapidly evolving products with unknown schemas.

---

## 9. Math & Formulas

### Throughput Capacity

```
SQL (single master):
  Write capacity = single_db_writes_per_sec
                 ≈ 1,000–50,000 writes/sec

SQL (with read replicas):
  Read capacity = single_db_qps × (1 + num_replicas)
  If single DB = 10K QPS, 5 replicas → 60K read QPS

NoSQL (Cassandra, N nodes, replication_factor = 3):
  Write capacity = (N / replication_factor) × writes_per_node
  If 30 nodes, rf=3, 50K writes/node → 500K writes/sec
```

### Replication Lag Formula (Async)

```
Perceived_staleness = time_since_write × async_lag_factor
Typical async lag   = 50–500ms under normal load
During burst writes = 2–5 seconds lag possible
```

### CAP Quorum (Cassandra tuning)

```
N = replication factor (e.g., 3)
W = nodes that must ACK a write
R = nodes that must respond to a read

For STRONG consistency: R + W > N
  → W=2, R=2, N=3: strong (1 overlap guaranteed)
  
For EVENTUAL consistency: W=1, R=1
  → maximum throughput, may read stale

Default Cassandra: W=1, R=1 (AP mode)
Tuned for CP:     W=2, R=2 (N=3)
```

---

## 10. MERN Stack Dev Notes

### MongoDB (NoSQL) in MERN
```javascript
// Flexible schema — no migration needed for new field
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, required: true, unique: true },
  // Can add 'preferences' later without migration
  preferences: {
    theme: String,
    notifications: Boolean
  }
}, { strict: false }); // strict:false allows unknown fields

// Aggregation pipeline replaces SQL JOINs
const result = await Order.aggregate([
  { $match: { userId: ObjectId(userId) } },
  { $lookup: {
      from: 'products',        // JOIN to products collection
      localField: 'productId',
      foreignField: '_id',
      as: 'productDetails'
  }},
  { $unwind: '$productDetails' },
  { $group: { _id: '$userId', totalSpent: { $sum: '$amount' } } }
]);
// ⚠️ $lookup is SLOW at scale — denormalize if queried frequently
```

### Node.js — When to use which DB
```javascript
// Use PostgreSQL (via pg or Sequelize) for:
// - User accounts, billing, orders → ACID required
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Use Redis for:
// - Sessions, rate limiting, pub/sub, real-time leaderboards
const redis = require('ioredis');
const client = new redis(process.env.REDIS_URL);
await client.setex(`session:${userId}`, 3600, JSON.stringify(sessionData));

// Use MongoDB for:
// - Product catalogs, user-generated content, flexible metadata
// Use Cassandra/DynamoDB for:
// - Activity feeds, time-series, 1M+ writes/sec
```

### Express API — Database selection pattern
```javascript
// Polyglot persistence in a single Express service
app.post('/checkout', async (req, res) => {
  const session = await pgPool.connect();
  try {
    await session.query('BEGIN');
    await session.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2',
                        [amount, fromAccount]);
    await session.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2',
                        [amount, toAccount]);
    await session.query('COMMIT');
    // ✅ ACID transaction — PostgreSQL
    
    // Log activity to MongoDB (eventual, OK to fail)
    await activityLog.insertOne({ userId, action: 'checkout', amount, ts: new Date() });
    
    // Invalidate Redis cache
    await redis.del(`cart:${userId}`);
    
    res.json({ success: true });
  } catch (err) {
    await session.query('ROLLBACK');
    throw err;
  } finally {
    session.release();
  }
});
```

---

## 11. Real-World Case Studies

### Instagram — Hybrid SQL + NoSQL
```
Problem: 1B+ users, millions of photos/day, social graph queries

Solution:
  PostgreSQL (sharded by user_id)  ← users, photos, relationships
    → ACID for follow/unfollow (can't double-follow)
    → 12 logical shards → thousands of physical shards
    
  Cassandra  ← feeds, likes, notifications
    → 1B+ writes/day, append-only, never need JOINs
    → Row key = user_id, column = timestamp
    → Eventual consistency acceptable (feed slightly stale = fine)

Key decision: "If data loss = money lost → SQL. If data loss = UX glitch → NoSQL"
```

### Discord — MongoDB → Cassandra Migration
```
Problem: 100M+ messages, MongoDB struggling with large collections

Why MongoDB failed for messages:
  - Random reads/writes across large collection = poor cache utilization
  - No natural time-range queries without secondary index (slow)
  - As collection grew: 90th pct query time exceeded 100ms

Why Cassandra worked:
  - Row key: (channel_id, bucket) where bucket = month
  - Column key: message_id (time-UUID → naturally sorted by time)
  - Range queries: scan a bucket → adjacent on disk → fast
  - Append-only writes: no UPDATE/DELETE hot spots
  - Result: p99 read latency dropped from 100ms → 5ms
```

### Uber Schemaless — NoSQL Interface on MySQL
```
Problem: Need NoSQL flexibility + MySQL operational maturity

Solution: Schemaless
  Physical: Sharded MySQL with a single blob column (LONGBLOB)
  Logical:  NoSQL API (get, put, scan by key)
  
  Schema:
    added_id  BIGINT AUTO_INCREMENT  (global ordering)
    entity_id VARCHAR(255)           (the "row key")
    entity_body LONGBLOB             (JSON blob)
    
  Benefits:
    ✅ MySQL durability/replication (known ops)
    ✅ Schema flexibility (JSON blob)
    ✅ Horizontal sharding by entity_id
  
  Cost:
    ❌ No SQL JOINs (must do in application)
    ❌ No secondary indexes on JSON fields
```

---

## 12. Interview Cheat Sheet

**Q: When would you choose NoSQL over SQL?**
> High write throughput (>100K/sec), horizontal scaling needs, flexible/evolving schema, eventual consistency acceptable, simple access patterns (key lookups or time-range scans). Example: social activity feeds, IoT sensor data, session storage.

**Q: Can you have ACID transactions in NoSQL?**
> Yes, with limitations. MongoDB 4.0+ supports multi-document ACID transactions (slower, use sparingly). DynamoDB supports single-item transactions natively, and cross-item with TransactWriteItems. But at scale, design your data model to avoid needing cross-document transactions.

**Q: What is the CAP theorem and why does it matter?**
> Distributed systems can guarantee only 2 of: Consistency, Availability, Partition Tolerance. Since network partitions are unavoidable, the real choice is CP (refuse writes during partition → strong consistency) vs AP (accept writes → eventual consistency). PostgreSQL = CA (not distributed by default). Cassandra = AP. CockroachDB = CP.

**Q: How does eventual consistency cause bugs?**
> User updates their email → async replication takes 200ms → reads from replica → gets old email. Fix: read-your-own-writes (route user's reads to same replica they wrote to, or use sync replication for own profile data).

**Q: SQL vs NoSQL for a payment system?**
> Always SQL. ACID transactions are non-negotiable: deducting from one account and crediting another must be atomic. NoSQL's eventual consistency could mean double-spending or lost transactions. Stripe, PayPal, and banks all use SQL for core payment tables.

---

## 13. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **ACID** | Atomicity, Consistency, Isolation, Durability — SQL correctness guarantees |
| **BASE** | Basically Available, Soft state, Eventually consistent — NoSQL availability model |
| **CAP Theorem** | Distributed systems: choose 2 of Consistency, Availability, Partition Tolerance |
| **Strong Consistency** | All reads return the most recent write; synchronous replication |
| **Eventual Consistency** | All replicas converge to same state; asynchronous replication |
| **Replication Lag** | Time between a write on master and its visibility on replicas (50–500ms) |
| **Schema Migration** | Altering table structure in SQL; costly on large tables |
| **Schema-on-Read** | NoSQL: no schema enforced at write; validated when data is read |
| **Quorum** | In distributed systems: majority of nodes must agree (R + W > N) |
| **Polyglot Persistence** | Using multiple database types in one system; different DB per use case |
| **Denormalization** | Storing redundant data to avoid JOINs; common in NoSQL |
| **Scatter-Gather** | Fan-out query to all shards, merge results; expensive in NoSQL |
| **Read Replica** | Copy of database that serves reads; reduces master load |
| **Write Amplification** | One logical write causes multiple physical writes (replication × replicas) |
