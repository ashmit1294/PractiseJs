# T07 — Key-Value Store

---

## 1. ELI5

A key-value store is the simplest database possible: a giant dictionary. You store something with a name (key), and retrieve it by that name (value). That's it.

Think of a coat check at a restaurant:
- You hand in your coat → get a numbered ticket (key)
- Later, show the ticket → instantly get your coat back (value)

The coat check attendant doesn't know what's inside your coat. They just store it and give it back. That's exactly how a key-value store works — blindingly fast, no questions asked.

---

## 2. Analogy

**Post Office Box System**

Each PO Box has a unique number (key). You put mail in a specific box (write). Anyone with the box number can retrieve the contents (read). The post office doesn't care what's inside — letters, packages, anything. No need to describe the content structure. Lookups are O(1) — you go directly to box 347, no searching.

That's Redis or DynamoDB: `GET box:347` → immediate return.

---

## 3. Core Concept

### What is a Key-Value Store?

A key-value store is a data store providing two primary operations:
- `PUT(key, value)` — store a value associated with a key
- `GET(key)` → value — retrieve by key
- `DELETE(key)` — remove a key

The value is opaque — the DB doesn't parse or index it (in most implementations). This simplicity enables extreme performance.

### Key-Value Store Categories

```
┌────────────────────────────────────────────────────────────┐
│               Key-Value Store Spectrum                      │
├────────────────┬───────────────────────────────────────────┤
│ In-Memory      │ Redis, Memcached                          │
│ (Cache Layer)  │ μs reads, data fits in RAM, volatile      │
├────────────────┼───────────────────────────────────────────┤
│ Persistent     │ DynamoDB, RocksDB, BadgerDB               │
│ (Primary Store)│ ms reads, survives restarts, unlimited    │
├────────────────┼───────────────────────────────────────────┤
│ Wide-Column    │ Cassandra, HBase                          │
│ (Extended KV)  │ Value = multiple named columns, sorted    │
└────────────────┴───────────────────────────────────────────┘
```

---

## 4. LSM-Tree Architecture (How Persistent KV Stores Work)

All major persistent key-value stores (RocksDB, Cassandra, HBase, DynamoDB) use **Log-Structured Merge-Tree (LSM-Tree)** storage.

### Why Not B-Trees?

```
B-Tree write: find leaf node → modify in place → write dirty page
  - Random I/O: HD 5–10ms per write, SSD 0.1ms
  - Write amplification: 10–30× (B-tree rebalancing, WAL, data pages)

LSM-Tree write: append to sequential log + in-memory update
  - Sequential I/O: HD 100MB/s, SSD 500MB/s (vs random 4KB writes)
  - Write amplification: 10× for leveled, 3-5× for size-tiered
  - Trade: slightly slower reads (must search multiple levels)
```

### LSM-Tree Write Path

```
Write: PUT("user:123", "{name: 'Alice'}")

Step 1: Append record to WAL (Write-Ahead Log on disk)
        → crash durability: if process dies, WAL replays on restart

Step 2: Insert into MemTable (in-memory skip list or red-black tree)
        → O(log n) insertion
        → immediately visible to readers (read-your-own-writes)

When MemTable reaches size threshold (typically 64MB):
Step 3: Freeze MemTable → write sorted SSTable to disk (immutable file)
        → Sequential write: fast! O(n) pass through sorted skip list
        → SSTable = Sorted String Table: sorted key-value pairs + Bloom filter + index

┌─────────┐     WRITE      ┌───────────┐   flush   ┌─────────────────┐
│ Client  │ ──────────────►│ MemTable  │ ─────────►│  SSTable L0     │
│         │                │ (in-RAM)  │           │  SSTable L0     │
└─────────┘                └───────────┘           │  SSTable L0     │
                                │                  └─────────────────┘
                             WAL write                    │ compaction
                           (disk, sync)                   ▼
                                                 ┌─────────────────┐
                                                 │  SSTable L1     │
                                                 │  SSTable L1     │
                                                 └─────────────────┘
                                                          │ compaction
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  SSTable L2     │  (larger)
                                                 └─────────────────┘
```

### LSM-Tree Read Path

```
Read: GET("user:123")

1. Check MemTable          → O(log n) skip list lookup → may find it
2. Check frozen MemTables  → O(log n) each → may find it
3. Check Bloom Filter for each SSTable level
   → Bloom filter: 99% accurate "definitely not in this file" check
   → Skip 99% of SSTable disk reads with zero I/O
4. Binary search index for each SSTable containing key
   → SSTable sparse index: one entry per 64KB data block
5. Read data block from disk
   → Decompress (Snappy/LZ4/ZSTD) → scan 64KB for exact key

Performance:
  MemTable hit: 10–100μs (RAM)
  1 SSTable hit: 1–5ms (SSD) or 5–20ms (HDD)
  Miss (Bloom filter): ~0.1ms (bloom lookup, no disk I/O)
```

---

## 5. Bloom Filters — The Read Performance Secret

```
Bloom filter: probabilistic data structure
  - Query "is key K in this SSTable?"
  - Response: "Definitely NO" OR "Probably YES"
  - No false negatives | ~1% false positive rate (tunable)

How it works:
  k hash functions each mapping key to a bit position
  Set bits on INSERT
  Check if ALL bits set on QUERY

  Insert "user:123":
    hash1("user:123") = bit 7   → set bit 7
    hash2("user:123") = bit 23  → set bit 23
    hash3("user:123") = bit 51  → set bit 51
    
  Query "user:456":
    hash1("user:456") = bit 7   → bit 7 is set ✓
    hash2("user:456") = bit 15  → bit 15 is NOT set ✗
    → "Definitely NOT in this SSTable" → skip disk read

Impact:
  Without Bloom filters: every GET requires reading ALL SSTables
  With Bloom filters: only read SSTable where key definitely exists
  → 10–100× read speedup for key misses
```

---

## 6. Compaction — Managing SSTable Growth

Over time, SSTables accumulate. Multiple versions of same key exist across levels. Compaction merges and cleans them up.

### Size-Tiered Compaction (Write-Optimized)

```
Strategy: merge N SSTables of similar size into one larger SSTable

L0: [4MB] [4MB] [4MB] [4MB]  → compact → [16MB SSTable in L1]
L1: [16MB] [16MB] [16MB] → compact → [64MB SSTable in L2]
L2: [64MB] [64MB] [64MB] → compact → [256MB SSTable in L3]

Pros:
  ✅ Less I/O during writes (few, large compaction events)
  ✅ Good write throughput

Cons:
  ❌ SSTables within same level can have overlapping key ranges
  ❌ Reads may need to check MULTIPLE SSTables per level
  ❌ Space amplification: temporarily uses 2× space during compaction
```

### Leveled Compaction (Read-Optimized) — Used by RocksDB, Cassandra default

```
Strategy: each SSTable at L1+ covers NON-OVERLAPPING key ranges

L0: [any range, can overlap] — up to 4 files before trigger
L1: [A-C][D-F][G-L][M-R][S-Z] — 10 files, each ~10MB, no overlap
L2: [A-...][...][...-Z] — 100 files, each ~10MB, no overlap
L3: 1000 files...

Compaction: pick L1 file, merge with overlapping L2 files → new L2 files

Pros:
  ✅ Within each level: at most 1 SSTable contains any given key
  ✅ Reads need at most 1 file from each level → O(levels) disk reads
  ✅ Low space amplification (10:1 size ratio between levels)

Cons:
  ❌ Write amplification: 10–30× (data rewritten many times during compaction)
  ❌ Higher write I/O than size-tiered
```

---

## 7. Redis — In-Memory Key-Value Store

```
Redis architecture:
  - Single-threaded event loop (I/O multiplexing)
  - All data in RAM: reads/writes = 1–100μs
  - Persistence: RDB snapshots + AOF (append-only file) optional
  - Replication: master-replica async
  - Cluster: hash slots (0–16383), 16384 slots / N nodes

Data structures (not just strings):
  String:  SET user:123:name "Alice"
  Hash:    HSET user:123 name "Alice" age 30
  List:    LPUSH queue:jobs "task1"  (deque/queue)
  Set:     SADD online:users user:123
  Sorted Set: ZADD leaderboard 1500 user:123  (score + member)
  TTL:     EXPIRE session:abc 3600  (auto-expire after 1 hour)
  
Performance: 100,000–1,000,000 ops/sec single node
             p99 < 1ms (vs 5–20ms for PostgreSQL)
```

---

## 8. Math & Formulas

### Write Throughput

$$\text{write throughput} = \frac{\text{MemTable size}}{\text{MemTable flush time}} \approx 50\text{K–500K writes/sec per node}$$

RocksDB on NVMe SSD: ~500K writes/sec (single-threaded), ~1M/sec (parallel)

### Bloom Filter False Positive Rate

$$p = \left(1 - e^{-kn/m}\right)^k$$

Where:
- $k$ = number of hash functions
- $n$ = number of elements inserted
- $m$ = number of bits in filter

With $k=3$, $n/m = 0.01$ (1 bit per 100 elements): $p \approx 1\%$ false positive rate

Typical: 10 bits per key → <1% FP rate (negligible extra disk I/O from false positives)

### LSM-Tree Read Complexity

$$\text{reads in worst case} = O(\text{levels} \times \log(\text{SSTable size}))$$

With leveled compaction and 4 levels: reads check ≤ 4 SSTables = bounded I/O

---

## 9. MERN Stack Dev Notes

### Node.js + Redis (ioredis)

```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

// === Basic K-V Operations ===
await redis.set('user:123:profile', JSON.stringify({ name: 'Alice' }));
const profile = JSON.parse(await redis.get('user:123:profile'));

// === TTL (Session management) ===
await redis.setex('session:abc123', 3600, JSON.stringify({ userId: '123', role: 'admin' }));
// auto-deletes after 1 hour

// === Atomic Counter (like counts, view counts) ===
await redis.incr('post:456:likes');  // atomic; thread-safe
const likes = await redis.get('post:456:likes');

// === Rate Limiting ===
const key = `rate:${userId}:${Math.floor(Date.now() / 60000)}`; // per-minute bucket
const requests = await redis.incr(key);
await redis.expire(key, 60);
if (requests > 100) return res.status(429).json({ error: 'Too many requests' });

// === Caching Aside Pattern ===
async function getUser(userId) {
  const cacheKey = `user:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  const user = await pgPool.query('SELECT * FROM users WHERE id = $1', [userId]);
  await redis.setex(cacheKey, 300, JSON.stringify(user.rows[0])); // 5-min TTL
  return user.rows[0];
}
```

### DynamoDB (AWS SDK v3)

```javascript
const { DynamoDBClient, GetItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });

// GET by key (O(1) lookup)
const response = await client.send(new GetItemCommand({
  TableName: 'Users',
  Key: marshall({ userId: 'user_123' }),
  ConsistentRead: false  // Eventually consistent = cheaper
}));
const user = unmarshall(response.Item);

// PUT (upsert)
await client.send(new PutItemCommand({
  TableName: 'Users',
  Item: marshall({
    userId: 'user_123',
    name: 'Alice',
    email: 'alice@example.com',
    updatedAt: new Date().toISOString()
  }),
  ConditionExpression: 'attribute_not_exists(userId)' // Prevent overwrite
}));
```

---

## 10. Real-World Case Studies

### Netflix — Cassandra for Viewing History (420TB, 1000+ nodes)

```
Problem: 230M subscribers × viewing history × rewind/resume data

Key design:
  Row key: (user_id, content_id)
  Value: { progress_pct, last_watched_ts, resume_position_ms, device }

Access pattern:
  GET user:123:content:456 → resume position when user reopens show
  SCAN user:123:* → fetch all viewing history for "Continue Watching" row

Why key-value (Cassandra) and NOT PostgreSQL:
  - 1B+ write operations/day (resume-position updates every 30sec of playback)
  - 420TB total across 1000+ nodes = horizontal scale only
  - No JOINs needed: each lookup is single (user, content) pair
  - Eventual consistency acceptable: resume point 1-2 seconds stale = fine

Write path: log-structured → 500K writes/sec per node
Bloom filters: prevent disk reads for non-existent (user, content) pairs (cold content)
```

### Amazon — DynamoDB for Shopping Cart (20M+ req/sec)

```
Problem: Shopping cart must survive mid-checkout → user adds items, closes laptop,
         reopens hours later → cart must still be there

Key design:
  PK: user_id (partition key)
  SK: item_id (sort key)
  → Composite key: (user_id, item_id)

Operations:
  PUT cart/{userId}/{itemId} ← add item
  GET cart/{userId}/          ← get all cart items (single partition scan)
  DELETE cart/{userId}/{itemId} ← remove item

Why DynamoDB:
  - 20M+ requests/sec during peak (Black Friday) = hash-distributed across nodes
  - Single-digit ms latency guaranteed by SLA
  - No schema migration for new item attributes (flexible value structure)
  - Auto-scaling: capacity adjusts automatically
  
Scale: Amazon uses DynamoDB internally for >10K services
```

### Pinterest — HBase for User Graph

```
Pinterest social graph: 500M users, each following @50 accounts = 25B edges

Key design:
  Row key: user_id
  Column family: follows (each column = followed user_id)
  → GET user:123 → returns all user IDs that user:123 follows

HBase vs Neo4j choice:
  - Neo4j: 5+ hop traversal (great for recommendations)
  - HBase: 1-2 hop lookups at billion-scale (follows/followers)
  - Pinterest primarily needs: "who does user X follow?" (1 hop)
  - HBase: row-key lookup → O(1) + column scan within row → fast and cheap

2-degree connections (suggestions):
  Precomputed offline (Spark batch job every 6h)
  Result cached in HBase as separate column family 'suggestions'
```

---

## 11. Interview Cheat Sheet

**Q: What is an LSM-Tree and why do key-value stores use it?**
> Log-Structured Merge-Tree: writes go to an in-memory structure (MemTable) + sequential WAL, then flush as immutable on-disk files (SSTables). Compaction periodically merges files. Advantages: sequential writes are 10–100× faster than B-tree random writes; great for write-heavy workloads. Trade-off: reads are slightly slower (may search multiple files).

**Q: What are Bloom filters and why are they critical for LSM reads?**
> Bloom filters are probabilistic bit-array structures that answer "is this key definitely NOT in this file?" with zero false negatives. 99% of "miss" lookups are identified without disk I/O. Without Bloom filters, every GET for a missing key would require reading ALL SSTables on disk.

**Q: When would you choose a key-value store over a relational database?**
> When: access pattern is always key-based (no JOINs or aggregations needed), you need massive write throughput (>100K/sec), horizontal scaling is required, or you need sub-millisecond latency (Redis). Examples: session storage, distributed caching, shopping carts, rate limiting counters, real-time leaderboards.

**Q: What is the difference between Redis and DynamoDB?**
> Redis: in-memory only (optional persistence), microsecond latency, rich data structures (sorted sets, pub/sub), single-node max ~256GB RAM. DynamoDB: fully persistent, unlimited scale (distributed by AWS), millisecond latency, simpler data model (items with attributes), serverless/managed. Use Redis for caching and real-time; DynamoDB for primary storage at scale.

---

## 12. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **LSM-Tree** | Log-Structured Merge-Tree: write-optimized storage engine |
| **MemTable** | In-memory sorted structure (skip list) holding recent writes |
| **WAL** | Write-Ahead Log: durability guarantee; replayed on crash recovery |
| **SSTable** | Sorted String Table: immutable on-disk sorted key-value file |
| **Compaction** | Merging SSTables, removing old versions and tombstones |
| **Bloom Filter** | Probabilistic structure: "definitely NOT in this file" check |
| **Tombstone** | Marker for deleted keys; purged during compaction |
| **Leveled Compaction** | Non-overlapping SSTables per level; read-optimized |
| **Size-Tiered Compaction** | Merge same-size SSTables; write-optimized |
| **Write Amplification** | One logical write causes multiple physical writes during compaction |
| **Space Amplification** | Extra disk space due to multiple versions before compaction |
| **TTL** | Time-To-Live: auto-expire keys after N seconds (Redis EXPIRE) |
| **Consistent Hashing** | DynamoDB/Cassandra routing: which node owns each key |
| **Partition Key** | DynamoDB term for shard key — routes to specific partition |
| **Read-Your-Own-Writes** | After a write, immediately reads the updated value |
