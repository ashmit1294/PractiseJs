# T09 — Wide Column Store

---

## 1. ELI5

Imagine a massive spreadsheet where:
- Each row has a unique ID (row key)
- But each row can have COMPLETELY DIFFERENT columns
- You have billions of rows
- You can add new columns to ANY row without affecting others

Bob's row: { name, email, last_login, premium_since }  
Alice's row: { name, email, city, favorite_color, newsletter_opt_in }  
Carol's row: { name, created_at }  

It's like a spreadsheet where every person can customize their own columns — sparse, flexible, yet blazingly fast for key-based lookups. That's a wide column store.

---

## 2. Analogy

**Hotel Guest Registry with Custom Check-In Forms**

Each guest's registration card is unique:
- Business traveler: name, company, expense_account, early_checkout_preference
- Family: name, number_of_kids, extra_bed_request, pool_access
- International: name, passport_number, visa_expiry, translator_needed

The hotel can look up ANY guest instantly by their room number (row key). Within a guest's record, fields are grouped into "column families" — like sections on the form (personal info section, preferences section, billing section).

In Cassandra/HBase: row_key = room number, column families = form sections, columns = individual form fields.

---

## 3. Core Concept

### The Three-Dimensional Data Model

Wide column stores use a **3D addressing scheme**:

```
(row_key, column_key, timestamp) → value

row_key:    identifies the row (like a primary key)
column_key: identifies the specific column within the row
timestamp:  version of the value (enables time-travel, MVCC)

Example — User activity in Cassandra:
  ("user:123", "login:2024-01-15T09:00", T1) → "mobile_app"
  ("user:123", "login:2024-01-15T18:30", T2) → "web_browser"
  ("user:123", "purchase:2024-01-15T19:00", T3) → "order_456"
  ("user:456", "login:2024-01-15T10:00", T4) → "tv_app"
                 ↑
            column = event_type + timestamp embedded in key
```

### Wide Column vs Other DB Types

```
┌─────────────────────────────────────────────────────────────────┐
│  Comparison: Relational vs Document vs Key-Value vs Wide Column  │
├────────────────────┬────────────────────────────────────────────┤
│ Relational (SQL)   │ All rows same schema; JOINs; ACID          │
│ Document (MongoDB) │ Flexible per-doc schema; nested JSON; B-tree│
│ Key-Value (Redis)  │ Single value per key; opaque; O(1)         │
│ Wide Column        │ Flexible columns per row; sparse; sorted;  │
│ (Cassandra/HBase)  │ time-series native; LSM-tree; 1M+ writes/s │
└────────────────────┴────────────────────────────────────────────┘

Wide Column ≠ Columnar Database!
  Columnar (BigQuery/Redshift): stores data column-by-column on disk → OLAP analytics
  Wide Column (Cassandra):  stores data row-by-row but with flexible, sparse columns → OLTP at massive scale
```

---

## 4. Cassandra Architecture Deep Dive

### Data Distribution (Ring Model)

```
Cassandra uses consistent hashing ring:

       0                     2^64
       │                       │
       ▼                       ▼
───────●──────────●────────────●──────────●──────────► (wraps)
     Node A      Node B       Node C     Node D
    token 0    token 2B      token 4B   token 6B

Partition key → Murmur3 hash → token → closest node clockwise

Replication factor = 3 means:
  Node A is primary for token range [0, 2B)
  Node B and C also hold replicas of Node A's data
  → Any node can go down; 2 copies remain
```

### Write Path

```
Client write: INSERT INTO user_events (user_id, event_ts, event_type) VALUES (...)

Step 1: Client contacts any coordinator node (any node can coordinate)
        Coordinator hashes partition key → finds correct replica nodes

Step 2: Coordinator sends write to N replica nodes (based on consistency level)
        Write consistency:
          ONE:    1 replica ACKs  → fast, risk of stale reads
          QUORUM: (N/2 + 1) ACKs → balanced (default: N=3, need 2 ACKs)
          ALL:    all N replicas  → slow, max durability

Step 3: On each replica node:
  3a. Append to CommitLog (WAL) → durability: survives crash
  3b. Write to MemTable (memory) → immediately visible

Step 4: When MemTable full → flush to SSTable (disk, immutable)

Step 5: Periodic compaction merges SSTables

Total write latency: < 1ms (ONE) to 5ms (QUORUM) — very fast
Write throughput: 500K–1M writes/sec per node (NVMe SSD)
```

### Read Path

```
Client read: SELECT * FROM user_events WHERE user_id = 'user:123'

Step 1: Coordinator routes to correct replica(s) based on partition key

Step 2: On replica node:
  2a. Check MemTable → O(log n) skip list lookup
  2b. Check frozen MemTables
  2c. Check Bloom filter for each SSTable
       → "Definitely NO" → skip SSTable (no disk I/O)
       → "Maybe YES" → proceed to disk read
  2d. Check partition summary (sparse index in RAM)
  2e. Binary search partition index in SSTable
  2f. Read data block from disk

Read consistency:
  ONE:    fastest, may return stale data from a lagging replica
  QUORUM: read from 2+ replicas, return most recent (highest timestamp)

Full read path: 1–5ms (SSD, QUORUM)
```

---

## 5. Row Key Design — Everything in Cassandra

The row key (partition key) determines:
1. Which node stores the data (routing)
2. What data is co-located (affects query pattern)
3. Whether range queries are possible (use clustering columns)

### Bad Row Key Design

```sql
-- BAD: monotonically increasing key → all writes to ONE node (hotspot!)
CREATE TABLE events (
  id BIGINT PRIMARY KEY,    -- ← AUTO INCREMENT → tokens cluster at one node
  user_id TEXT,
  event_type TEXT,
  created_at TIMESTAMP
);

-- Also BAD: user_id alone (returns ALL events for user without time filtering)
```

### Good Row Key Design (Compound Partition + Clustering)

```sql
-- GOOD: Composite key for user activity by month
CREATE TABLE user_events (
  user_id  TEXT,
  month    TEXT,              -- "2024-01" bucket
  event_ts TIMESTAMP,         -- clustering column (sort order within partition)
  event_type TEXT,
  metadata MAP<TEXT, TEXT>    -- flexible column
) WITH CLUSTERING ORDER BY (event_ts DESC);

-- Partition key: (user_id, month) → locates correct node
-- Clustering key: event_ts → SORTED within partition → range scans fast

-- Queries:
-- All events for user in Jan 2024:
SELECT * FROM user_events WHERE user_id = 'alice' AND month = '2024-01';
-- → Single partition lookup → O(1) routing + O(range) scan within partition

-- Recent 10 events:
SELECT * FROM user_events 
WHERE user_id = 'alice' AND month = '2024-01' 
ORDER BY event_ts DESC LIMIT 10;
-- → Index scan (clustering column sorted DESC) → fast
```

---

## 6. Tombstones — Wide Column Deletes

```
Wide column stores can't update SSTables (immutable). Deletes use tombstones:

DELETE FROM user_events WHERE user_id = 'alice' AND month = '2024-01';

→ Writes a tombstone record: { partition_key, deletion_timestamp }
→ Tombstone masks the data during reads (row appears deleted)
→ Actual data purged during compaction after gc_grace_seconds (default: 10 days)
   → 10 days allows replica nodes time to receive the tombstone before purge
   → If you read BEFORE grace period: tombstone hides old data → correct
   → If you read AFTER purge but replica missed tombstone → data "resurrects"!

Tombstone anti-patterns:
  ❌ High delete rate → many tombstones → reads must scan ALL tombstones → slow
  ✅ TTL instead of DELETE: data expires automatically, tombstone auto-written
  CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT
  ) WITH default_time_to_live = 3600; -- auto-expire after 1 hour
```

---

## 7. MVCC via Timestamps

```
Cassandra uses timestamps for conflict resolution (no locks):

Node A writes: (user:123, email, T=1000) → "alice@old.com"
Node B writes: (user:123, email, T=1050) → "alice@new.com"

Read with QUORUM:
  Reply from Node A: T=1000 → "alice@old.com"
  Reply from Node B: T=1050 → "alice@new.com"
  
  Coordinator: 1050 > 1000 → use "alice@new.com" (Last Write Wins)

This is LWWC (Last-Write-Wins Conflict Resolution)
Uses wall-clock time → NTP synchronization matters!
Time drift between nodes → wrong winner on conflict

Alternative: CRDT (Conflict-free Replicated Data Types)
  Counters: cassandra.increment(+1) → always correct regardless of order
  Sets: add-wins sets, remove-wins sets
```

---

## 8. Wide Column vs Relational for Time-Series

```
Time-series use case: IoT sensor data
  - 1M sensors × 1 reading/sec = 1M inserts/sec
  - Query: "last 24h readings for sensor S"
  - Query: "all readings in range [T1, T2] for sensor S"

Relational approach:
  sensors(id, name, location)
  readings(id, sensor_id, timestamp, value)
  
  SELECT * FROM readings WHERE sensor_id = 'S001' AND timestamp > NOW() - INTERVAL '24h'
  → Index on (sensor_id, timestamp): B-tree range scan
  → PostgreSQL: works up to ~100M rows (1-2 shards)
  → 1B+ rows: partition table by month → complex management

Wide Column approach (Cassandra):
  CREATE TABLE readings (
    sensor_id  TEXT,
    day        TEXT,          -- bucket by day: "2024-01-15"
    recorded_at TIMESTAMP,    -- clustering column
    value       DOUBLE
  );
  
  SELECT * FROM readings WHERE sensor_id = 'S001' AND day = '2024-01-15'
  → Single partition lookup → O(log n) → <5ms for 86,400 rows/day
  → 1M sensors × 365 days = 365M partitions → handled naturally
  → Add more nodes → linear throughput increase
  Range queries need spanning buckets:
    day IN ('2024-01-14', '2024-01-15') → 2 partition queries, merge client-side
```

---

## 9. Math & Formulas

### Partition Size Rule

$$\text{partition size} = \text{rows per partition} \times \text{avg row bytes}$$

Cassandra recommendation: each partition < **100MB**, ideally < 10MB
- 1M rows × 100 bytes = 100MB → boundary condition
- 10M rows × 100 bytes = 1GB → **DANGEROUS** → split by time bucket

Hotspot threshold:
$$\text{if one partition} > 3 \times \text{avg partition size} \rightarrow \text{hotspot resharding needed}$$

### Throughput Per Cluster

$$\text{cluster throughput} = \text{nodes} \times \frac{\text{throughput per node}}{\text{replication factor}}$$

30 nodes, 500K writes/sec/node, RF=3:
$$= 30 \times \frac{500K}{3} = 5\text{M writes/sec sustained}$$

### Consistency Level Latency

```
Write latency at different consistency levels (N=3, same DC):
  ONE:    ~0.5ms  (nearest replica ACK)
  QUORUM: ~1.5ms  (2 replicas must ACK)
  ALL:    ~5ms    (all 3 replicas must ACK — slowest replica dominates)
  
Cross-DC (LOCAL_QUORUM):
  ~15–50ms (network latency to remote datacenter)
```

---

## 10. MERN Stack Dev Notes

### Node.js + Cassandra (cassandra-driver)

```javascript
const cassandra = require('cassandra-driver');

const client = new cassandra.Client({
  contactPoints: ['cassandra-1', 'cassandra-2', 'cassandra-3'],
  localDataCenter: 'us-east',
  keyspace: 'myapp',
  pooling: {
    coreConnectionsPerHost: {
      [cassandra.types.distance.local]: 2,
      [cassandra.types.distance.remote]: 1
    }
  }
});

// Write: user event
const insertQuery = `
  INSERT INTO user_events (user_id, month, event_ts, event_type, metadata)
  VALUES (?, ?, ?, ?, ?)
  USING TTL 7776000  -- 90 days TTL
`;
await client.execute(insertQuery,
  ['alice', '2024-01', new Date(), 'page_view', { page: '/dashboard' }],
  { prepare: true }  // ← prepare: true = parse once, execute many; critical for performance
);

// Read: last 20 events this month
const selectQuery = `
  SELECT event_ts, event_type, metadata
  FROM user_events
  WHERE user_id = ? AND month = ?
  ORDER BY event_ts DESC
  LIMIT 20
`;
const result = await client.execute(selectQuery,
  ['alice', '2024-01'],
  { prepare: true, consistency: cassandra.types.consistencies.localQuorum }
);
const events = result.rows;
```

### Batch Writes (Use Sparingly in Cassandra)

```javascript
// Cassandra BATCH — for atomicity within SAME partition only
// ⚠️ Multi-partition batch = expensive! Coordinator must contact multiple nodes

// GOOD batch: same partition key
const batch = [
  {
    query: 'INSERT INTO user_events (user_id, month, event_ts, event_type) VALUES (?, ?, ?, ?)',
    params: ['alice', '2024-01', new Date(t1), 'login']
  },
  {
    query: 'INSERT INTO user_events (user_id, month, event_ts, event_type) VALUES (?, ?, ?, ?)',
    params: ['alice', '2024-01', new Date(t2), 'view_dashboard']
  }
];
await client.batch(batch, { prepare: true });

// BAD: Don't batch across partition keys for performance
// Use async parallel inserts instead:
await Promise.all(events.map(e => client.execute(insertQuery, e.params, { prepare: true })));
```

---

## 11. Real-World Case Studies

### Netflix — Viewing History (420TB, 1000+ nodes)

```
Scale: 230M subscribers, 1B+ view events/day

Table design:
  CREATE TABLE viewing_history (
    user_id     UUID,
    content_id  INT,        -- clustering column
    watched_at  TIMESTAMP,
    progress    FLOAT,      -- 0.0 to 1.0 (percentage watched)
    device_type TEXT,
    PRIMARY KEY ((user_id), content_id)
  );

Access patterns:
  1. "Resume watching": GET user:123 + content:456 → single row lookup
  2. "Continue Watching" row: SELECT all for user:123
  3. Update: every 30 seconds of playback → progress update

Why it works:
  - Partition key = user_id → all user content co-located (one partition)
  - Clustering key = content_id → binary search within partition
  - 1B+ writes/day → 500K writes/sec → LSM-tree handles perfectly
  - 420TB total, replicated 3×, ~130TB raw → 1000+ nodes at 200GB each
```

### Uber — Trip State Columns

```
Uber stores trip state changes as columns in a wide-column store:

Row key: trip_id
Columns (one per state change):
  { "state:requested:1620000100": "{ driver_id: null, rider: 'alice' }" }
  { "state:driver_assigned:1620000200": "{ driver_id: 'driver_bob' }" }
  { "state:trip_started:1620000500": "{ lat: 40.7, lng: -74.0 }" }
  { "state:trip_completed:1620001800": "{ fare: 18.50, distance: 3.2 }" }

Each column = one state transition snapshot
Columns are SORTED by key → entire trip history in time order
No UPDATE needed: each state = new column (append-only)
Row kept for 30 days (TTL), then automatically purged

Benefit: Complete audit trail per trip, no JOINs, sorted by time
```

### Apple — iCloud Metrics (Billions per Day)

```
Apple uses HBase for operational metrics from iOS devices

Table: device_metrics
Row key: (device_id + date_bucket)  → e.g., "device123:2024-01-15"
Column families:
  battery:    { "10:00": 87, "11:00": 82, "12:00": 75 }
  network:    { "10:00": "wifi", "11:00": "5G" }
  crashes:    { "10:30": "app_id_123", "11:45": "app_id_456" }

Benefits:
  - Sparse: not every device reports every metric every hour
  - Time-range queries: scan one row = all metrics for a device on a day
  - Scale: billions of inserts/day → HBase LSM handles via region servers
  - Each region server handles subset of row key range
```

---

## 12. Interview Cheat Sheet

**Q: What is a wide column store?**
> A database where each row can have different columns, addressed by `(row_key, column_key, timestamp) → value`. Unlike relational DBs, columns are sparse (each row has only columns it needs). Examples: Cassandra, HBase. Uses LSM-tree for massive write throughput.

**Q: How is a wide column store different from a columnar database?**
> Wide column store (Cassandra, HBase): rows with flexible, sparse columns; row-oriented storage; OLTP at massive scale; designed for high write throughput and key-based lookups. Columnar database (BigQuery, Redshift, Parquet): stores data column-by-column for analytics; OLAP; efficient full-column scans and aggregations; not designed for point inserts.

**Q: What is a partition key and clustering column in Cassandra?**
> Partition key: determines which node stores the data (via hashing). All rows with the same partition key are on the same node. Clustering column: determines sort order within a partition; enables range scans. Design rule: partition key = what you GROUP BY, clustering column = what you ORDER BY or range-filter.

**Q: What are tombstones and why do they matter?**
> Tombstones mark deleted rows without immediately removing data (SSTables are immutable). They're purged during compaction after gc_grace_seconds (default 10 days). Problem: many tombstones slow reads (must be scanned). Solution: use TTL instead of DELETE — data auto-expires with a system-generated tombstone that's optimized.

**Q: Why can't you do JOINs in Cassandra?**
> Cassandra distributes data across nodes by partition key. A JOIN between two tables requires data from multiple partitions (potentially on different nodes). There's no distributed join operator. Solution: model data to serve the query — denormalize at write time, or use ALLOW FILTERING (full scan, avoid in production).

---

## 13. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Wide Column Store** | DB where each row has different sparse columns; 3D address space |
| **Partition Key** | Determines which node stores data; consistent hashing |
| **Clustering Column** | Determines sort order within a partition; enables range queries |
| **LSM-Tree** | Log-Structured Merge-Tree; write-optimized; powers Cassandra/HBase |
| **CommitLog** | Cassandra WAL; append-only; durability guarantee |
| **MemTable** | In-memory structure for recent writes; flushed to SSTable |
| **SSTable** | Immutable on-disk sorted file; compacted periodically |
| **Tombstone** | Delete marker in LSM-tree; purged after gc_grace_seconds |
| **Consistency Level** | ONE/QUORUM/ALL — how many replicas must ACK read/write |
| **Last Write Wins** | Cassandra conflict resolution via timestamps |
| **MVCC** | Multi-Version Concurrency Control via timestamps; no locks |
| **Time Bucket** | Pre-partitioning strategy; group rows by day/month in partition key |
| **Region Server** | HBase node managing a contiguous range of row keys |
| **Compaction** | Merging SSTables; removes tombstones; reclaims space |
| **Replication Factor** | N copies per piece of data across N nodes |
| **gc_grace_seconds** | Period before tombstones are purged (default: 10 days) |
