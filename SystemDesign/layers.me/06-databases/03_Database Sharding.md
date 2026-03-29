# T03 — Database Sharding

---

## 1. ELI5

Imagine a library with 10 million books. One librarian can't handle everyone. So you split the books:
- Librarian A handles books A–E
- Librarian B handles books F–L
- Librarian C handles books M–R
- Librarian D handles books S–Z

Each librarian only manages a subset. If you want "Harry Potter", you go to librarian H. That's sharding — splitting one giant database into smaller, manageable pieces called **shards**.

---

## 2. Analogy

**Post Office Sorting System**

When a letter arrives at a central post office, it gets routed to a regional sorting office based on the ZIP code. NYC letters go to the East facility; LA letters go to the West facility. Each regional facility only handles its ZIP codes.

- ZIP code = **shard key**
- Regional facility = **shard**
- Letter routing = **shard routing function**
- If NYC gets too many letters → subdivide NYC into Manhattan and Brooklyn facilities = **resharding**

---

## 3. Core Concept

### What is Sharding?

Sharding (horizontal partitioning) splits rows of a large table across multiple database instances. Each shard is an independent database holding a subset of the data.

```
WITHOUT SHARDING:                    WITH SHARDING:
┌──────────────────┐                 ┌──────────┐  ┌──────────┐  ┌──────────┐
│   users table    │                 │  Shard A  │  │  Shard B  │  │  Shard C  │
│  1 billion rows  │       →         │ 333M rows │  │ 333M rows │  │ 334M rows │
│  1 machine       │                 │ 1 machine │  │ 1 machine │  │ 1 machine │
└──────────────────┘                 └──────────┘  └──────────┘  └──────────┘
  500K QPS max                          3 × 500K = 1.5M QPS capacity
```

### Shard Key

The shard key is the field used to determine which shard owns a record.

```
shard_id = hash(shard_key) % num_shards     ← simple modulo hashing

Example: shard_id = hash("user_123") % 4
  hash("user_123") = 2847392847102
  2847392847102 % 4 = 2
  → User "user_123" goes to Shard 2
```

**Ideal shard key properties:**
- High cardinality (many distinct values)
- Uniform distribution (no hotspots)
- Immutable (changing shard key = moving the record)
- Used in almost every query (avoid cross-shard queries)

---

## 4. Sharding Strategies

### Strategy 1 — Hash-Based Sharding
```
shard_id = hash(user_id) % N

┌─────────────┐    hash(uid) % 4    ┌─────────────────────────┐
│  user_id    │──────────────────►  │ Shard 0: uid 0,4,8,12...│
│  (any value)│                     │ Shard 1: uid 1,5,9,13...│
└─────────────┘                     │ Shard 2: uid 2,6,10,14..│
                                    │ Shard 3: uid 3,7,11,15..│
                                    └─────────────────────────┘
✅ Even distribution
✅ Simple to implement
❌ Range queries require scatter-gather (scan all shards)
❌ Resharding moves ~all data when N changes
```

### Strategy 2 — Range-Based Sharding
```
Shard 0: user_id 1         → 1,000,000
Shard 1: user_id 1,000,001 → 2,000,000
Shard 2: user_id 2,000,001 → 3,000,000

┌─────────────────────┐
│ Router / Config srv │ ← knows ranges: "shard 1 owns ID 1–1M"
└──────────┬──────────┘
           │
    ┌──────┼──────┐
    ▼      ▼      ▼
  Shard0 Shard1 Shard2

✅ Range queries efficient (single shard)
✅ Easy to understand/debug
❌ Data hotspots (new users always hit latest shard)
❌ Uneven distribution if data is not uniform
```

### Strategy 3 — Consistent Hashing
```
Hash ring: 0 ──────────────────────── 2^32

       0          2^10         2×2^10      3×2^10
       │           │             │           │
───────●───────────●─────────────●───────────●──────► wraps back to 0
     Node A      Node B         Node C      Node D

Lookup: hash(user_id) → position P on ring
        walk clockwise → first node encountered = owner

Adding a new node E between A and B:
  Only data between A and E moves (from B to E)
  NOT all data reshuffled ← key advantage
```

**Virtual Nodes** improve balance:
```
Physical node A → virtual nodes: A1 @ 100, A2 @ 500, A3 @ 900
Physical node B → virtual nodes: B1 @ 250, B2 @ 700, B3 @ 1100

Ring: 0──A1──B1──A2──B2──A3──B3──... → 2^32

Each physical node owns many small ranges → balanced even with uneven data
Adding/removing a node: only adjacent virtual nodes' data migrates
```

---

## 5. ASCII Architecture: Sharded Database

```
                         ┌──────────────────────┐
                         │   Application Layer   │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │    Shard Router       │
                         │  (Proxy / App logic)  │
                         │  hash(user_id) % N    │
                         └──┬────────┬───────────┬──┘
                            │        │           │
               ┌────────────▼┐  ┌────▼────┐  ┌──▼──────────┐
               │   Shard 0   │  │ Shard 1 │  │   Shard 2   │
               │  + Replica  │  │ + Repl  │  │  + Replica  │
               │  users 0–33M│  │ 33–66M  │  │  66–100M    │
               └─────────────┘  └─────────┘  └─────────────┘

Each shard has:  primary + 1-2 replicas
Writes → primary │  Reads → primary or replica
```

---

## 6. Cross-Shard Queries — The Big Problem

```
SELECT u.name, COUNT(o.id) AS order_count
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE u.signup_date > '2024-01-01'
GROUP BY u.id;

If users and orders are on DIFFERENT shards:
  → Scatter-gather: send query to ALL shards
  → Each shard returns partial results
  → Coordinator merges results
  
Cost: latency × num_shards + merge overhead
      10ms × 10 shards = 100ms (vs 10ms single-shard)
      
Rule: Shard key MUST be the join key for co-location
  users.user_id sharded → orders.user_id sharded by same key
  → user + their orders always on same shard = no scatter-gather
```

---

## 7. Resharding — The Nightmare

When a shard grows too large or traffic spikes, you must reshard.

### Dual-Write Strategy (Safest)
```
Phase 1: DUAL WRITE
  App writes to OLD shards AND NEW shards simultaneously
  New shards are write-ahead of reads

Phase 2: BACKFILL
  Mirror all existing data from old to new shards
  Background process, hours/days for large datasets

Phase 3: VERIFY
  Compare checksums: old shard vs new shard
  Until data is consistent

Phase 4: CUT OVER READS
  Route reads to new shards
  Monitor for errors

Phase 5: STOP WRITING TO OLD
  Remove old shards

Timeline: days to weeks for billion-row tables
Risk: double storage cost during migration
```

### Virtual Shards Strategy (Instagram Model)
```
Instead of 4 physical shards, create 10,000 LOGICAL shards

Logical → Physical mapping:
  Logical shards 0–2499    → Physical DB 1
  Logical shards 2500–4999 → Physical DB 2
  Logical shards 5000–7499 → Physical DB 3
  Logical shards 7500–9999 → Physical DB 4

Resharding = remapping logical → physical
  "Move logical shards 0–1249 from Physical DB 1 to new Physical DB 5"
  Only ~12.5% of data moves, not 50%
  
Instagram uses exactly this: 10,000 logical shards → N physical DBs
```

---

## 8. Common Shard Key Mistakes

### Hotspot Key — The Celebrity Problem
```
BAD: shard key = created_at (timestamp)
  All new writes go to the "latest" shard
  Old shards idle, latest shard overwhelmed

BAD: shard key = user_id for celebrity users
  Beyoncé (10M followers) → 10M notification writes to single shard
  Regular user → 100 notifications

FIX (Fan-out): 
  Normal users: shard on user_id
  VIP users: replicate to ALL shards, scatter-gather reads
  OR: composite key = (user_id % shard_count) + suffix
```

### Unshardable Queries
```
// Can't be efficiently sharded:
SELECT * FROM users ORDER BY created_at DESC LIMIT 20;
// "Latest 20 users" → must scan ALL shards → O(shards × N)

// Can be sharded:
SELECT * FROM users WHERE user_id = 'abc123';
// hash('abc123') → shard 2 → query only shard 2 = O(1)
```

---

## 9. Math & Formulas

### Data Distribution

$$\text{ideal rows per shard} = \frac{\text{total rows}}{N}$$

$$\text{hotspot ratio} = \frac{\text{rows on busiest shard}}{\text{ideal rows per shard}}$$

Hotspot ratio > 3 = problem. Target < 1.5.

### Consistent Hashing — Data Movement on Reshard

```
Simple modulo: hash(k) % N
  Add 1 shard (N → N+1): fraction of keys that move = N/(N+1) ≈ ~100% for small N

Consistent hashing:
  Add 1 shard to ring of N: fraction of keys that move = 1/(N+1)
  100 shards + 1 = only ~1% of data moves ← dramatic improvement
```

### Capacity Planning

$$\text{shards needed} = \left\lceil \frac{\text{total data size}}{\text{max shard size}} \right\rceil$$

$$\text{shards needed} = \max\left(\lceil\text{data shards}\rceil, \lceil\text{QPS shards}\rceil\right)$$

If 10TB data, 1TB max per shard → 10 shards  
If 500K QPS, 50K QPS per shard → 10 shards  
Take the max → 10 shards satisfies both constraints.

---

## 10. MERN Stack Dev Notes

### Node.js — Shard Router Pattern
```javascript
// Simple hash-based shard router
const NUM_SHARDS = 4;
const shardConnections = [db0, db1, db2, db3]; // 4 PostgreSQL pools

function getShardForUser(userId) {
  // FNV hash or any fast hash
  const hash = userId.split('').reduce((acc, char) => {
    return ((acc << 5) + acc) + char.charCodeAt(0);
  }, 5381);
  return Math.abs(hash) % NUM_SHARDS;
}

async function getUserById(userId) {
  const shardIndex = getShardForUser(userId);
  const db = shardConnections[shardIndex];
  return db.query('SELECT * FROM users WHERE user_id = $1', [userId]);
}

// ⚠️ Never do: SELECT * FROM users (no shard key)
// → Would require querying ALL shards
```

### MongoDB Sharding (Atlas / Self-hosted)
```javascript
// MongoDB handles sharding transparently via mongos router
// You set the shard key; application code is unchanged

// Enable sharding on collection (admin operation):
// sh.shardCollection("mydb.users", { "user_id": "hashed" })

// Application code is IDENTICAL to non-sharded:
const user = await User.findOne({ user_id: userId });
// ↑ mongos automatically routes to correct shard
// ↑ no application-level routing needed

// ⚠️ Avoid queries without shard key (broadcast queries):
await User.find({ email: 'user@example.com' }); // goes to ALL shards
await User.find({ user_id: userId }); // goes to ONE shard ✅
```

### Express Middleware — Shard-Aware Connection
```javascript
// Middleware that attaches the right DB connection based on userId
app.use('/api/users/:userId', (req, res, next) => {
  const shardIndex = getShardForUser(req.params.userId);
  req.db = shardConnections[shardIndex]; // inject correct shard
  next();
});

app.get('/api/users/:userId/orders', async (req, res) => {
  // Co-located: users and orders share same shard key (user_id)
  const orders = await req.db.query(
    'SELECT * FROM orders WHERE user_id = $1',
    [req.params.userId]
  );
  res.json(orders.rows);
});
```

---

## 11. Real-World Case Studies

### Instagram — Virtual Shards
```
Scale: 1B+ users, 100M photos/day
Shard key: user_id

Architecture:
  - 10,000 logical shards (Postgres schemas)
  - Distributed across ~hundreds of physical PostgreSQL servers
  - Maps stored in ZooKeeper: { logical_shard_id → physical_server_id }

Data co-location:
  - user_id % 10000 = logical shard ID
  - user's followers, likes, comments → same shard as user
  - No cross-shard JOINs for user-centric queries

Resharding a physical server:
  - Move subset of logical shards (not real data migration)
  - Update ZooKeeper mapping
  - Backfill in background while still serving old server
  - Dual-read from both until consistent
  - Toggle mapping → done
```

### Uber — Geographic Sharding
```
Scale: Millions of trips/day per city
Shard key: city_id (geographic partition)

Architecture:
  - Each city = its own shard (NYC, LA, London, etc.)
  - Schemaless (NoSQL interface on MySQL) per city
  - Sharding by city solves the data co-location problem:
    - Trip matches rider ↔ driver in same city → same shard
    - No cross-city JOIN ever needed for matching
  
  city_shard = cityId;  // direct mapping, no hash needed
  
Trade-offs:
  ✅ No scatter-gather for any trip operation
  ✅ City isolation (NYC incident doesn't affect London)
  ❌ City size imbalance: NYC >> rural city (hotspot risk)
  Fix: Large cities split into zones (Manhattan, Brooklyn, Queens)
```

### Pinterest — Resharding via Dual-Write
```
Problem: Grew from MySQL single instance to needing sharding
Timeline: 2012 resharding project

Approach: Dual-write
  Phase 1: Start writing new records to BOTH old DB and new sharded DBs
  Phase 2: Backfill existing data to sharded DBs
  Phase 3: Verify checksums for each user's data
  Phase 4: Cut over reads user-by-user (1% → 10% → 50% → 100%)
  Phase 5: Stop writing to old DB

Result: 8 shards → 64 logical shards → can remap physical without data migration
Lesson: Build virtual shard layer from day 1; resharding is painful
```

---

## 12. Interview Cheat Sheet

**Q: What is database sharding?**
> Horizontal partitioning: splitting rows of a table across multiple database instances based on a shard key. Each shard is an independent DB holding a subset of the data. Increases write capacity and reduces per-node dataset size.

**Q: How do you choose a shard key?**
> Choose a field that: (1) has high cardinality, (2) distributes writes uniformly, (3) is used in almost every query, (4) is immutable. Avoid timestamps (hotspots), low-cardinality fields (country with 200 values → 200 shards max), and mutable fields (moving data is expensive).

**Q: What's the difference between sharding and partitioning?**
> Partitioning splits data within a single DB instance (PostgreSQL table partitioning). Sharding splits across multiple separate DB instances. Partitioning improves query performance within one machine; sharding increases overall system capacity.

**Q: What are the downsides of sharding?**
> (1) Cross-shard queries are expensive (scatter-gather). (2) No cross-shard JOINs or transactions. (3) Resharding is operationally complex. (4) Application-level routing logic needed. (5) Hotspot risk if shard key chosen poorly.

**Q: How does consistent hashing help with resharding?**
> Simple modulo (hash % N) requires ~N/(N+1) ≈ 100% of data to move when adding one shard. Consistent hashing (hash ring) only moves 1/(N+1) ≈ 1% of data when adding one shard to a 100-shard ring. Virtual nodes further improve balance.

**Q: What would you shard on for a social media app?**
> Shard on user_id. Co-locate a user's posts, comments, likes, and followers on the same shard → no cross-shard queries for any user-centric operation. Use consistent hashing with virtual nodes to handle uneven growth.

---

## 13. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Shard** | An independent database instance holding a subset of total data |
| **Shard Key** | Field used to determine which shard owns a record |
| **Hash Sharding** | `shard = hash(key) % N`; uniform distribution, bad for ranges |
| **Range Sharding** | Records split by value range; good for ranges, risks hotspots |
| **Consistent Hashing** | Hash ring where adding/removing shards moves only 1/(N+1) data |
| **Virtual Nodes** | Multiple ring positions per physical node for better balance |
| **Scatter-Gather** | Fan-out query to all shards, then merge; expensive |
| **Co-location** | Keeping related records on the same shard to avoid cross-shard queries |
| **Hotspot** | One shard receives disproportionately more traffic than others |
| **Resharding** | Redistributing data across a new set of shards; expensive operation |
| **Dual-Write** | Writing to old and new shards simultaneously during migration |
| **Logical Shard** | Abstract partition layer remapped to physical DBs (Instagram model) |
| **Broadcast Query** | Query without shard key that must go to all shards |
| **Rebalancing** | Redistributing data after adding/removing shards to restore balance |
