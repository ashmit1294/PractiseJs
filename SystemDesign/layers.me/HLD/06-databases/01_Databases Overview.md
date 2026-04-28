# M6-T01 — Databases Overview

> **Source**: https://layrs.me/course/hld/06-databases/databases-overview  
> **Module**: 06 — Databases  
> **Difficulty**: Intermediate

---

## 1. ELI5 — Explain Like I'm 5

A database is just a super smart, organized filing cabinet. When you want to save your Minecraft progress, it goes in a drawer labeled with your name. When you want it back, the cabinet knows exactly which drawer to open — super fast!

There are DIFFERENT kinds of filing cabinets:
- **Relational (SQL)** — Everything in neat labeled folders with rules (bank records, school rosters)
- **Key-Value** — Giant dictionary: look up a word, get a definition instantly
- **Document** — Each drawer holds a self-contained "packet" (like a JSON object)
- **Wide Column** — Rows with DIFFERENT columns per row (great for sparse/IoT data)
- **Graph** — Everything connected by strings; follow the strings to find relationships

---

## 2. Analogy

**The Library Analogy:**
- **SQL / RDBMS** = Traditional library with catalog cards, strict Dewey Decimal rules, cross-references between books (JOIN = checking multiple shelves)
- **NoSQL** = A warehouse — dump books anywhere, fast at "fetch this one thing," not good for "find all mystery books published before 1990 by female authors in Boston"
- **NewSQL** = A smart warehouse that ALSO has Dewey Decimal — Google Spanner, CockroachDB

---

## 3. Core Concept

### Database Categories

| Category | Examples | Best For |
|---|---|---|
| **RDBMS** | PostgreSQL, MySQL, Oracle | ACID, structured data, complex JOINs |
| **Key-Value** | Redis, DynamoDB | Sessions, caching, counters |
| **Document** | MongoDB, Couchbase | Flexible JSON, user profiles, content |
| **Wide Column** | Cassandra, HBase | Time-series, IoT, sparse, write-heavy |
| **Graph** | Neo4j, Amazon Neptune | Social graphs, recommendations, fraud |
| **NewSQL** | CockroachDB, Google Spanner | ACID + horizontal scale |
| **Time-Series** | InfluxDB, TimescaleDB | Metrics, sensor data |
| **Search** | Elasticsearch | Full-text search |
| **Analytical** | Snowflake, BigQuery | OLAP, data warehouses |

### ACID vs BASE

```
ACID (Relational)                   BASE (NoSQL Distributed)
─────────────────                   ────────────────────────
Atomicity  → all or nothing         Basically Available
Consistency → valid state after     Soft state (can be stale)
Isolation  → concurrent = serial    Eventually Consistent
Durability → survives crash
```

**ACID** is about correctness (banking, inventory).  
**BASE** is about availability (social feeds, analytics).

### Scaling Progression

```
Step 1: Single DB
         [App] → [DB]   works until ~10K QPS

Step 2: Add Read Replicas
         [App] → [Primary DB]
                   ↓ replicate
              [Replica 1] [Replica 2]  (scale reads)

Step 3: Sharding
         hash(user_id) % 4 → routes to one of 4 shards
         (scale writes)

Step 4: NoSQL / Polyglot
         Use the right DB for each workload
```

### Decision Tree

```
ACID required?
  Yes → RDBMS (PostgreSQL, MySQL)
  No  → continue...
    
Global distribution + ACID?
  Yes → NewSQL (CockroachDB, Spanner)
  No  → continue...
    
Single-key fast lookup?
  Yes → Key-Value (Redis, DynamoDB)
  No  → continue...
    
Flexible JSON documents?
  Yes → Document (MongoDB)
  No  → continue...
    
Time-series / sparse / write-heavy?
  Yes → Wide Column (Cassandra)
  No  → continue...
    
Graph traversal (3+ hops)?
  Yes → Graph (Neo4j)
  No  → probably RDBMS is fine
```

---

## 4. ASCII Diagrams

```
┌─────────────────────────────────────────────────────────┐
│                 DATABASE LANDSCAPE                       │
├─────────────────┬───────────────────────────────────────┤
│   RELATIONAL    │  PostgreSQL, MySQL, Oracle             │
│   (RDBMS)       │  ✓ ACID  ✓ JOINs  ✗ Horizontal scale │
├─────────────────┼───────────────────────────────────────┤
│   KEY-VALUE     │  Redis, DynamoDB                       │
│                 │  ✓ O(1) reads  ✓ Horizontal  ✗ Queries│
├─────────────────┼───────────────────────────────────────┤
│   DOCUMENT      │  MongoDB, Couchbase                    │
│                 │  ✓ Flexible schema  ✓ JSON  ✗ JOINs   │
├─────────────────┼───────────────────────────────────────┤
│   WIDE COLUMN   │  Cassandra, HBase                      │
│                 │  ✓ Sparse  ✓ 1M writes/s  ✗ Queries   │
├─────────────────┼───────────────────────────────────────┤
│   GRAPH         │  Neo4j, Neptune                        │
│                 │  ✓ Traversals  ✗ Analytics  ✗ Bulk    │
├─────────────────┼───────────────────────────────────────┤
│   NEW SQL       │  CockroachDB, Spanner                  │
│                 │  ✓ ACID  ✓ Distributed  ✗ Cost        │
└─────────────────┴───────────────────────────────────────┘

POLYGLOT PERSISTENCE (Netflix):
  Billing     → MySQL         (ACID, money)
  ViewHistory → Cassandra     (1B writes/day, time-series)
  Search      → Elasticsearch (full-text)
```

---

## 5. Math / Formulas

```
Read Capacity with Replicas:
  total_read_qps = single_db_qps × (1 + num_replicas)
  e.g., 1000 QPS × 4 nodes = 4000 read QPS

Shard Distribution:
  shard_id = hash(entity_id) % num_shards
  
  Good key: user_id (high cardinality, random)
  Bad key:  created_at (time-based → hotspot on latest shard)

Storage Estimate:
  1KB/row × 100M rows = 100GB per table
  With replication factor 3: 300GB total
```

---

## 6. MERN Dev Notes

```javascript
// Which database for which use case in a MERN app:

// MongoDB (document) — user profiles, content
const userProfile = {
  _id: 'user_123',
  name: 'Alice',
  preferences: { theme: 'dark', language: 'en' },
  address: { city: 'NYC', zip: '10001' }
};

// Redis (key-value) — sessions, caching
await redis.set(`session:${sessionId}`, JSON.stringify(userData), 'EX', 3600);
const session = JSON.parse(await redis.get(`session:${sessionId}`));

// PostgreSQL (relational) — orders, payments
// SELECT o.id, u.name, p.amount
// FROM orders o JOIN users u ON o.user_id = u.id
// JOIN payments p ON o.payment_id = p.id
// WHERE o.status = 'pending'

// Polyglot approach in Node.js services:
const pgPool   = new pg.Pool(pgConfig);       // ACID data
const mongoose = require('mongoose');          // flexible docs
const redis    = require('ioredis');           // fast cache
```

---

## 7. Real-World Examples

### Netflix — Polyglot Persistence
| Workload | Database | Why |
|---|---|---|
| Billing, subscriptions | MySQL | ACID, money can't be lost |
| Viewing history (200M users) | Cassandra | 1B+ writes/day, time-series |
| Search | Elasticsearch | Full-text, typo-tolerant |
| Content metadata | PostgreSQL | Complex queries, structured |

### Uber — RDBMS → Hybrid
- Started with PostgreSQL for everything
- Hit write limits → built Schemaless (NoSQL interface on sharded MySQL)
- Key insight: MySQL but with JSON blobs + shard-by-`entity_id`

### Stripe — RDBMS Only
- PostgreSQL for EVERYTHING (payments, ledgers, charges)
- Vertical scaling + careful indexing
- Refused NoSQL for payments: "eventual consistency = lost money"

---

## 8. Interview Cheat Sheet

| Question | Answer |
|---|---|
| ACID vs BASE? | ACID = correctness (atomicity/consistency/isolation/durability). BASE = availability (basically-available/soft-state/eventually-consistent) |
| When NoSQL? | >100TB, 1M+ writes/sec, eventual consistency OK, flexible schema |
| When RDBMS? | ACID needed, complex JOINs, schema stable, <10TB |
| NewSQL? | CockroachDB/Spanner — ACID guarantees AND horizontal scaling |
| Polyglot persistence? | Use multiple DB types, each optimized for its specific workload |
| Cassandra vs MongoDB? | Cassandra = write-heavy, time-series, sparse, no JOINs. MongoDB = flexible JSON docs, moderate writes |
| Why not NoSQL for payments? | Eventual consistency can mean money is double-spent or lost |

### Common Pitfalls
- Using one DB type for everything ("hammer and nails")
- Choosing NoSQL because it's "web-scale" (start simple!)
- Forgetting that JOIN-less NoSQL pushes complexity to the application layer
- Using a sharded NoSQL for a problem that fits in a single PostgreSQL instance

---

## 9. Keywords / Glossary

| Term | Definition |
|---|---|
| **RDBMS** | Relational Database Management System (PostgreSQL, MySQL) |
| **ACID** | Atomicity, Consistency, Isolation, Durability — correctness guarantees |
| **BASE** | Basically Available, Soft state, Eventually consistent — availability guarantees |
| **NewSQL** | Distributed databases with ACID guarantees (CockroachDB, Spanner) |
| **Polyglot Persistence** | Using multiple database types within one system |
| **Sharding** | Horizontal partitioning of data across multiple servers |
| **Replication** | Copying data to multiple servers for read scaling + fault tolerance |
| **CAP Theorem** | Pick 2 of: Consistency, Availability, Partition Tolerance |
| **OLTP** | Online Transaction Processing — operational, writes, point lookups |
| **OLAP** | Online Analytical Processing — analytical, scans, aggregations |
