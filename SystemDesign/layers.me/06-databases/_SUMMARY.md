# M6 — Databases: Quick-Review Summary

> 16 topics | Covers: DB types, SQL vs NoSQL, Sharding, Federation, Indexing, Replication, Search, WAL, Vectors

---

## Topics at a Glance

| # | Topic | Core Insight |
|---|---|---|
| T01 | Databases Overview | 9 DB categories; ACID vs BASE trade-off |
| T02 | SQL vs NoSQL | Fixed schema + JOINs vs flexible + horizontal scale |
| T03 | Database Sharding | Split rows across machines; only 1/N keys move on resize |
| T04 | Database Federation | Split by business function; each domain owns its DB |
| T05 | Denormalization | Pre-store answers to common queries; trade write complexity for read speed |
| T06 | SQL Tuning | EXPLAIN first, then fix: indexes, query rewrites, schema changes |
| T07 | Key-Value Store | Dictionary: GET/PUT/DELETE by key — μs latency |
| T08 | Document Store | Self-contained JSON docs: flexible schema, no JOIN needed |
| T09 | Wide Column Store | Row key + column family + timestamp; built for time-series + write-heavy |
| T10 | Graph Databases | Nodes + edges as first-class; relationship traversal is O(1) per hop |
| T11 | Data Lakes & Warehouses | Lake = raw dump; Warehouse = refined, queryable; OLTP vs OLAP |
| T12 | Database Indexing | B-tree for range; hash for equality; composite order matters |
| T13 | Database Replication | Master-slave (one writer); master-master (conflict resolution needed) |
| T14 | Search Systems | Inverted index: term → posting list → O(log N) ranked full-text search |
| T15 | Write-Ahead Log (WAL) | Log before change; replay on crash = durability guarantee |
| T16 | Vector Databases | Embeddings → semantic similarity search; ANN over high-dim vectors |

---

## T01 — Databases Overview

### 9 Database Categories

| Category | Examples | Best For |
|---|---|---|
| **RDBMS** | PostgreSQL, MySQL | ACID, structured, complex JOINs |
| **Key-Value** | Redis, DynamoDB | Sessions, caches, counters |
| **Document** | MongoDB, Couchbase | Flexible JSON, user profiles |
| **Wide Column** | Cassandra, HBase | Time-series, IoT, write-heavy |
| **Graph** | Neo4j, Neptune | Social graphs, fraud detection |
| **NewSQL** | CockroachDB, Spanner | ACID + horizontal scale |
| **Time-Series** | InfluxDB, TimescaleDB | Metrics, sensor data |
| **Search** | Elasticsearch | Full-text search |
| **Analytical** | Snowflake, BigQuery | OLAP, data warehouses |

### ACID vs BASE

| ACID (SQL) | BASE (NoSQL distributed) |
|---|---|
| **A**tomicity — all or nothing | **B**asically Available |
| **C**onsistency — valid state after | **S**oft state (can be stale) |
| **I**solation — concurrent = serial | **E**ventually Consistent |
| **D**urability — survives crash | — |

> ACID = correctness (banking, inventory). BASE = availability (social feeds, analytics).

---

## T02 — SQL vs NoSQL

| Property | SQL (Relational) | NoSQL |
|---|---|---|
| Schema | Fixed, enforced at DB level | Flexible, per-document |
| Scaling | Vertical (bigger machine) | Horizontal (more machines) |
| Consistency | ACID — strong | BASE — eventual |
| Joins | Native, efficient | Application-level (denormalize) |
| Transactions | Multi-table, multi-row | Typically single-document only |
| Best for | Financial, inventory, user auth | Social feeds, catalogs, IoT |
| Examples | PostgreSQL, MySQL | MongoDB, Cassandra, DynamoDB |

### When to Choose SQL
- Complex JOINs across multiple entities
- ACID transactions required (payments, booking systems)
- Schema is stable and well-defined
- Reporting and analytics on structured data

### When to Choose NoSQL
- Flexible/evolving schema (e.g. user-generated content)
- Massive write throughput (millions/sec)
- Horizontal scale is a hard requirement
- Data naturally fits one model (key-value, document, graph)

---

## T03 — Database Sharding

**Definition**: Split rows of a large table across multiple database instances (shards). Each shard is an independent DB owning a subset of rows.

```
Without sharding:
  users table: 1 billion rows on 1 machine → 500K QPS max

With sharding (3 shards):
  Shard A: users with id hash % 3 = 0  → 333M rows
  Shard B: users with id hash % 3 = 1  → 333M rows
  Shard C: users with id hash % 3 = 2  → 334M rows
  Total capacity: 3 × 500K = 1.5M QPS
```

### Shard Key Selection
- **High cardinality** — many distinct values prevent hot shards
- **Even distribution** — avoid celebrity problem (user_id better than country)
- **Query locality** — shard key should appear in most queries
- ❌ **Avoid**: monotonically increasing IDs (all new writes hit the last shard)

### Shard Key Strategies

| Strategy | How | Trade-off |
|---|---|---|
| **Hash-based** | `shard = hash(key) % N` | Even distribution; no range queries |
| **Range-based** | Users A–E → Shard 1, F–L → Shard 2 | Range queries easy; hot shards possible |
| **Directory** | Lookup table: key → shard | Most flexible; lookup is extra hop |
| **Consistent hashing** | Ring-based; move only K/N on resize | Best for dynamic scaling |

### Sharding Costs
- **Cross-shard JOINs**: not supported natively; must be done in application
- **Cross-shard transactions**: no ACID spans shards; use Saga pattern
- **Resharding**: moving data when adding shards is painful; consistent hashing minimises this

### Sharding vs Replication

| | Sharding | Replication |
|---|---|---|
| Purpose | Increase write capacity, reduce data per node | Increase read capacity, add fault tolerance |
| Data | Split across nodes (each owns a subset) | Copies on multiple nodes (each owns all data) |
| Writes | Each shard accepts writes for its range | Only primary accepts writes |

---

## T04 — Database Federation

**Definition**: Split one monolithic DB into multiple smaller DBs, each responsible for a specific **business domain**. Also called **functional partitioning**.

```
Monolith:  one PostgreSQL → users, orders, products, payments, reviews (bottleneck)

Federated:
  users_db    → users, sessions, profiles
  orders_db   → orders, coupons, shipping
  products_db → products, inventory, categories
  payments_db → payments, settlements, refunds
```

### Federation vs Sharding

| | Sharding | Federation |
|---|---|---|
| Split by | **Rows** (same table structure) | **Function** (different tables) |
| Query type affected | Queries on one table hitting many machines | Queries that JOIN across domains |
| Scale target | Write throughput + storage | Team independence + blast radius isolation |

### Federation Costs
- **Cross-DB JOINs**: must be done at application level (load both datasets, join in code)
- **Cross-DB transactions**: no ACID across DBs; use eventual consistency
- **Operational overhead**: N databases → N backup jobs, N monitoring configs

---

## T05 — Denormalization

**Definition**: Intentionally add redundancy to eliminate expensive JOINs on read paths. Trade write complexity for read speed.

```sql
-- Normalized (3 table JOIN every read):
SELECT u.name, p.name, o.amount
FROM orders o JOIN users u ON o.user_id = u.id JOIN products p ON o.product_id = p.id;

-- Denormalized (no JOIN needed):
SELECT user_name, product_name, amount FROM orders_denormalized WHERE order_id = 123;
-- user_name and product_name are stored redundantly in the orders table
```

### When to Denormalize
- Read:write ratio is high (>10:1)
- JOINs are a proven bottleneck (`EXPLAIN` shows nested loop on large tables)
- Data changes infrequently (user_name, product_name rarely change)
- Horizontal scaling is needed (sharded DBs can't do cross-shard JOINs)

### Denormalization Costs
- Multiple places to update when data changes → inconsistency risk
- More storage (data repeated)
- Application must maintain multiple copies on write

---

## T06 — SQL Tuning

**Golden Rule**: `EXPLAIN` first. Never guess. Fix what the plan tells you.

### `EXPLAIN` Output Reading
```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- Bad: Seq Scan on orders (cost=0..50000, rows=1M)  ← full table scan
-- Good: Index Scan using idx_user_id (cost=0..8, rows=5)  ← index used
```

### Tuning Hierarchy (cheapest → most invasive)
| Step | Action | Impact |
|---|---|---|
| 1 | Add missing index | O(n) → O(log n) — biggest win |
| 2 | Rewrite query | Eliminate N+1, avoid `SELECT *`, use `EXISTS` vs `IN` |
| 3 | Composite index tuning | Column order in compound index must match query filter order |
| 4 | Connection pooling | PgBouncer reduces connection overhead |
| 5 | Materialized views | Pre-compute expensive aggregations |
| 6 | Partitioning | Range-partition large tables (e.g. by date) |
| 7 | Denormalize | Eliminate JOINs in hot query paths |
| 8 | Schema redesign | Last resort — NoSQL migration or federate |

### N+1 Problem (most common bug)
```javascript
// N+1 WRONG: 1 query to get orders + N queries for each user
const orders = await Order.findAll();
for (const order of orders) {
  order.user = await User.findById(order.userId); // N queries!
}

// FIXED: 1 JOIN query or eager load
const orders = await Order.findAll({ include: ['user'] });
```

---

## T07 — Key-Value Store

**Model**: `GET(key) → value`, `PUT(key, value)`, `DELETE(key)` — blindingly fast, O(1).

| Category | Examples | Characteristics |
|---|---|---|
| In-Memory | Redis, Memcached | μs reads; data in RAM; volatile unless persisted |
| Persistent | DynamoDB, RocksDB | ms reads; survives restarts; unlimited storage |
| Wide-Column (Extended KV) | Cassandra, HBase | Value = multiple named columns; sorted; billions of rows |

### Redis Extras (beyond basic KV)
| Data Structure | Command | Use Case |
|---|---|---|
| String | `SET user:1 "alice"` | Counters, flags, strings |
| List | `LPUSH / LRANGE` | Message queues, activity feeds |
| Hash | `HSET user:1 name "alice"` | User profiles, session data |
| Sorted Set | `ZADD leaderboard 9500 "alice"` | Leaderboards, trending topics |
| Pub/Sub | `PUBLISH / SUBSCRIBE` | Real-time notifications |

### When to Use Key-Value
- Sessions, auth tokens, feature flags
- Rate limit counters
- Caching query results
- Shopping cart (short-lived)
- Real-time leaderboards (Redis Sorted Set)

---

## T08 — Document Store

**Model**: Store semi-structured, self-contained JSON/BSON documents. Schema is flexible per document.

```json
// Each document has only what it needs — no NULLs, no schema migration
{ "_id": "1", "name": "Alice", "address": { "street": "123 Oak", "city": "NYC" } }
{ "_id": "2", "name": "Bob", "isPremium": true }
{ "_id": "3", "name": "Carol" }
```

### Eliminates Object-Relational Impedance Mismatch
JavaScript objects map directly to BSON — no ORM gymnastics.

### When to Use Documents
| ✅ Good fit | ❌ Bad fit |
|---|---|
| Flexible/evolving schema | Complex JOINs across many entities |
| Hierarchical data (order + line items) | Strict ACID across entities |
| User profiles, product catalogs, CMS | Financial transactions |
| Read-heavy with full-document access | Highly relational data |

---

## T09 — Wide Column Store

**3D address**: `(row_key, column_key, timestamp) → value`

```
("user:123", "login:2024-01-15T09:00", T1) → "mobile_app"
("user:123", "purchase:2024-01-15T19:00", T3) → "order_456"
```

- **Row key** = partition key (determines which node owns this row)
- **Column family** = group of related columns stored together on disk
- Each row can have completely different columns
- Optimized for: write-heavy, time-series, sparse data, never JOIN

### Cassandra vs HBase

| | Cassandra | HBase |
|---|---|---|
| Architecture | Masterless (AP by default) | Master-slave (CP by default) |
| Language | CQL (similar to SQL) | Java API / Thrift |
| Best for | Write-heavy, high availability | Hadoop integration, strong consistency |

---

## T10 — Graph Databases

**Model**: Nodes (entities) + Edges (relationships, first-class citizens with properties).

```
SQL (2-hop friends query): 3x JOINs, 10,000 rows scanned for 1M users × 100 friends
Graph DB (2-hop friends): O(1) per hop — follow edges directly, no table scans
```

### When to Use Graph DBs
- Social networks (friends-of-friends)
- Fraud detection (connected transactions)
- Recommendations (users who liked X also liked Y)
- Knowledge graphs, org charts, supply chains
- Anything where relationships ARE the data

> **Not for**: simple CRUD, high-volume writes, data that doesn't have complex relationships.

---

## T11 — Data Lakes & Warehouses

| | Data Lake | Data Warehouse |
|---|---|---|
| Data type | Raw, unprocessed (any format) | Clean, structured, transformed |
| Schema | Schema-on-read | Schema-on-write |
| Storage | Cheap (S3, HDFS) | Expensive (columnar, indexed) |
| Query | Slow (scan raw files) | Fast (optimized for analytics) |
| Examples | S3 + Glue, HDFS + Spark | Snowflake, BigQuery, Redshift |

### OLTP vs OLAP

| | OLTP | OLAP |
|---|---|---|
| Purpose | Transactional (INSERT/UPDATE) | Analytical (SELECT aggregations) |
| Rows per query | 1–100 rows | Millions–billions |
| Storage | Row-oriented | Column-oriented |
| Schema | Normalized (3NF) | Denormalized (star schema) |
| Latency | < 10ms | Seconds–minutes |
| Examples | PostgreSQL, MySQL | Snowflake, BigQuery |

**Column-oriented storage** compresses dramatically (same type per column) and skips irrelevant columns entirely — key to OLAP speed.

---

## T12 — Database Indexing

**Purpose**: Jump directly to matching rows without full table scan. Like a card catalog vs walking every aisle.

### Index Types

| Type | Data Structure | Use Case | Lookup |
|---|---|---|---|
| **B-tree** | Balanced tree | Range queries, ORDER BY, inequality | O(log N) |
| **Hash** | Hash table | Exact equality only (`WHERE id = 123`) | O(1) |
| **GIN / Inverted** | Inverted index | Array contains, full-text search | — |
| **GiST / Spatial** | R-tree | Geo queries (`ST_Within`) | — |
| **Partial** | B-tree on subset | Only index active records | Smaller, faster |
| **Composite** | B-tree on multiple cols | Multi-column WHERE clauses | Col order matters! |

### B-Tree Properties
```
100M rows → height ≈ 4–5 levels (fan-out ~100–200 keys per node)
Point query: 4–5 I/Os to any row
Range query: walk leaf linked list — O(log N + K) for K results
```

### Composite Index Column Order Rule
```sql
-- Index: (status, created_at) → Works for:
WHERE status = 'active' AND created_at > '2024-01-01'  ✅ (leading column used)
WHERE status = 'active'                                  ✅ (prefix match)
WHERE created_at > '2024-01-01'                         ❌ (no leading column match)
```

### Indexes Are Not Free
- Every write must also update all indexes
- Too many indexes → slow inserts/updates
- **Rule**: index columns used in WHERE, JOIN ON, ORDER BY, GROUP BY

---

## T13 — Database Replication

### Master-Slave (Primary-Replica)
```
All WRITES → Primary
                ↓ WAL/binlog stream (sync or async)
         Replica 1 (read only)
         Replica 2 (read only)
         Replica 3 (cascading from Replica 1)
```

| | Sync Replication | Async Replication |
|---|---|---|
| Primary waits for replica ACK? | Yes | No |
| Write latency | Higher (replica RTT added) | Lower (ACK immediately) |
| Data loss on primary crash | None (RPO ≈ 0) | Possible (RPO > 0) |
| Read consistency | Strong | Eventual (replica lag) |

### Master-Master (Multi-Master)
- Both nodes accept writes simultaneously
- Requires **conflict resolution**: last-write-wins, vector clocks, or application logic
- Risk: split-brain (both think they're primary, diverge)
- Use for: geo-distributed writes (one master per region)

### Replication Lag
```
Replica lag = time between primary write and replica applying it
Symptom: read-your-writes failure (write to primary, read stale from replica)
Fix: route reads to primary for critical data, OR use sync replication for those reads
```

---

## T14 — Search Systems

**Core data structure**: Inverted Index — maps each unique term → sorted list of document IDs that contain it.

```
"dragon"  → [(doc4, freq=3, positions=[12,45,89]), (doc17, freq=1, ...)]
"magic"   → [(doc4, freq=2, ...), (doc892, freq=4, ...)]

Query "dragon AND magic": intersect posting lists → {doc4, doc892}
```

### Why Not SQL LIKE?
```sql
WHERE body LIKE '%dragon%'  -- full table scan, O(N), no ranking, no typo tolerance
```
Elasticsearch: O(log N) lookup, TF-IDF/BM25 ranking, fuzzy matching, facets, aggregations.

### Relevance Scoring (BM25)
- **TF (Term Frequency)**: how often the term appears in the document
- **IDF (Inverse Document Frequency)**: how rare the term is across all documents
- **BM25** = improved TF-IDF with length normalization

### Elasticsearch Architecture
```
Index → multiple Shards (primary + replica per shard)
Write: Primary shard → replicas (near real-time, ~1s delay)
Read:  Can hit primary or any replica
Aggregations: distributed across shards, merged at coordinator
```

---

## T15 — Write-Ahead Log (WAL)

**The Rule**: **Always write to the log BEFORE modifying data**.

### Why It's Necessary
```
Without WAL — crash mid-write corrupts data:
  Transfer $100: deduct Alice ✓ → CRASH → Bob never credited → money lost

With WAL:
  1. WAL: "BEGIN: subtract $100 Alice, add $100 Bob" (sequential append, fast)
  2. Modify Alice's page in RAM
  3. Modify Bob's page in RAM
  4. WAL: "COMMIT" (fsync — flush to disk)
  5. Confirm to client
  CRASH at step 5? Replay WAL on restart → transaction redone ✓
```

### WAL Enables
| Feature | How WAL helps |
|---|---|
| **Crash recovery** | Replay WAL from last checkpoint |
| **Replication** | Ship WAL stream to replicas (PostgreSQL WAL, MySQL binlog) |
| **Point-in-time recovery** | Replay WAL to any past timestamp |
| **Change Data Capture** | Read WAL to stream DB changes to Kafka/event bus |

### Performance Trick: Group Commit
```
Transaction 1: write WAL entry → wait for fsync
Transaction 2: write WAL entry → wait for fsync  } ONE fsync covers all 3
Transaction 3: write WAL entry → wait for fsync
→ Group commit: batch WAL entries, single fsync, much higher throughput
```

---

## T16 — Vector Databases

**Problem**: Regular DB can't answer "find me things SIMILAR to this." No exact match for similarity.

**Solution**: Convert everything to vectors (embeddings) → similarity = proximity in N-dimensional space.

```
"The cat sat on the mat"   → [0.23, -0.87, 0.14, ..., -0.31]  (1536 floats)
"A feline rested on a rug" → [0.22, -0.85, 0.15, ..., -0.29]  ← nearby vector!
"The stock market crashed" → [-0.45, 0.63, -0.77, ...]         ← far away vector

cosine_similarity(cat sentence, feline sentence) ≈ 0.92
cosine_similarity(cat sentence, stock market)    ≈ 0.11
```

### ANN Algorithms (Approximate Nearest Neighbor)
| | Exact KNN | HNSW | IVF |
|---|---|---|---|
| Accuracy | 100% | ~95–99% | ~90–98% |
| Speed | O(N × d) | Very fast | Fast |
| Index build | None | Slow (hours for millions) | Moderate |
| Memory | Low | High | Moderate |

> HNSW (Hierarchical Navigable Small World) is the most popular — used by Pinecone, Weaviate, pgvector.

### RAG Architecture (Retrieval-Augmented Generation)
```
User query → embed query → vector DB search (top-K docs) → inject into LLM prompt → response
```

> Use cases: semantic search, recommendation engines, image similarity, RAG for LLMs.

---

## Master DB Selection Guide

| Need | Choose |
|---|---|
| ACID transactions, complex JOINs | PostgreSQL / MySQL |
| Flexible JSON, evolving schema | MongoDB |
| Extreme write throughput, wide distribution | Cassandra |
| Sub-millisecond reads, caching | Redis |
| Complex relationship traversal | Neo4j / Neptune |
| Full-text search with ranking | Elasticsearch |
| Time-series metrics/sensors | InfluxDB / TimescaleDB |
| Analytics on petabytes | BigQuery / Snowflake |
| Semantic similarity / AI features | Pinecone / pgvector / Weaviate |
| ACID + horizontal scale | CockroachDB / Spanner |

---

## Interview Cheat Sheet — M6

| Question | Answer |
|---|---|
| What is ACID? | Atomicity (all or nothing), Consistency (valid state), Isolation (concurrent = serial), Durability (survives crash) |
| SQL vs NoSQL — when to use each? | SQL: complex JOINs, ACID, stable schema; NoSQL: flexible schema, massive scale, horizontal growth |
| What is a shard key and what makes a good one? | Field used to determine which shard holds a record; good = high cardinality, even distribution, appears in most queries |
| Sharding vs federation — difference? | Sharding splits by rows (same table type); federation splits by business function (different tables) |
| What does EXPLAIN show? | The query execution plan — whether the DB does a sequential scan or uses an index, and estimated cost |
| What is the N+1 problem? | 1 query to get N records, then N queries for related data; fix with JOIN/eager loading |
| Master-slave vs master-master replication? | Master-slave: one writer, many readers; master-master: multiple writers with conflict resolution |
| What is replication lag and how to handle it? | Delay between write on primary and replica applying it; fix by routing critical reads to primary |
| What is the WAL? | Write-Ahead Log — log changes before applying them; enables crash recovery by replaying the log |
| What is an inverted index? | Maps term → list of document IDs that contain it; backbone of full-text search engines |
| What enables vector similarity search? | Embeddings (vectors of floats) where semantic similarity = geometric proximity; ANN algorithms like HNSW find nearest vectors |
| Row-oriented vs column-oriented storage? | Row = good for OLTP (fetch whole record); Column = good for OLAP (scan one field across millions of rows) |
| When to denormalize? | High read:write ratio, JOINs are a bottleneck, data changes infrequently, horizontal scaling needed |
| What is a composite index column order rule? | Leading column must appear in the query filter; index (status, date) won't help a query filtering only by date |

---

## Keywords

`ACID` · `BASE` · `RDBMS` · `NoSQL` · `sharding` · `shard key` · `consistent hashing` · `federation` · `functional partitioning` · `denormalization` · `EXPLAIN` · `N+1` · `B-tree` · `hash index` · `composite index` · `WAL` · `replication` · `replication lag` · `master-slave` · `master-master` · `inverted index` · `posting list` · `BM25` · `Elasticsearch` · `vector database` · `embeddings` · `ANN` · `HNSW` · `RAG` · `OLTP` · `OLAP` · `columnar storage` · `data lake` · `data warehouse`
