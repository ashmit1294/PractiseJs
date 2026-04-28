# T18 — Sharding Pattern: Partition Data for Scale

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/sharding-pattern

---

## ELI5 (Explain Like I'm 5)

Imagine a library with one million books — one librarian can't handle everyone coming in at once. So you split the books across 10 different buildings: A-F authors go to building 1, G-M to building 2, N-Z to building 3. Each building has its own librarians and shelves. Twice as many people can be served at the same time. When you need a book, you know exactly which building to go to.

Sharding = splitting your database across multiple machines, each holding a piece of the data.

---

## Analogy

**A multi-branch bank**: One bank branch can serve ~500 people/day. Chase has 5,000 branches — they serve millions per day. Each branch holds the accounts of customers in its neighborhood. To find your account, the main routing system tells you which branch to visit. Transfers between branches require a bit more coordination, but the parallel capacity is unlimited.

---

## Core Concept

Sharding **horizontally partitions** data across multiple independent database instances (shards), where each shard holds a **distinct subset** of rows using the **same schema**.

Unlike **replication** (every server has all data), sharding distributes *different data* to *different servers*. This scales **write throughput** and **storage capacity** — not just reads.

**When sharding becomes necessary**: Your user table hits 500M rows. Write throughput exceeds 100K writes/sec. Dataset no longer fits on one machine's disk. Indexes don't fit in RAM. Query latency degrades despite all other optimizations.

**Rule**: Sharding is your **last resort** — exhaust vertical scaling, read replicas, caching, and query optimization first. Once you shard, you take on distributed system complexity forever.

---

## ASCII Diagrams

### Single-Shard vs Cross-Shard Query

```
SINGLE-SHARD QUERY (fast):
  GET user_id=500,000
  → Shard Router: hash(500000) % 3 = 0 → Shard 1
  → Query Shard 1 only
  → Return result in 5ms ✅

CROSS-SHARD QUERY (expensive):
  GET "top 10 posts globally"
  → Must query ALL 3 shards in parallel
  → Shard 1: top 10 | Shard 2: top 10 | Shard 3: top 10
  → Merge 30 results in application layer → return global top 10
  → Latency = slowest shard + merge time ⚠️
```

### Sharding Strategies Comparison

```
RANGE-BASED: user_id 1-1M → Shard1, 1M-2M → Shard2, 2M-3M → Shard3
  ✅ Efficient range queries (user_id 500K-600K hits 1 shard)
  ❌ Hotspot: new users get highest IDs → shard N receives all writes
  Use for: time-series data (timestamp ranges), naturally balanced keys

HASH-BASED: shard = hash(user_id) % num_shards
  ✅ Even distribution across shards
  ❌ Range queries impossible (hash scatters consecutive IDs)
  ❌ Resharding expensive: changing num_shards remaps most keys
  Use for: point lookups (user profiles, sessions)

CONSISTENT HASHING: keys + shards mapped onto ring (0 → 2^32-1)
  ✅ Even distribution
  ✅ Only 1/N keys move when adding a shard (vs most with hash %)
  ✅ Virtual nodes improve balance
  Use for: when you expect frequent resharding (Cassandra uses this)

DIRECTORY-BASED: lookup table: user_id range → shard
  ✅ Maximum flexibility: assign any key to any shard
  ✅ Handle hotspots: move celebrity accounts to dedicated shards
  ❌ Directory = critical dependency + potential bottleneck
  Use for: fine-grained control needed (Google Bigtable uses this)

GEOGRAPHIC: users → EU shard (EU data); US users → US shard
  ✅ Latency: data close to users
  ✅ GDPR/data residency compliance
  ❌ Users crossing regions; imbalanced shard sizes
  Use for: regulated industries, global apps with strict latency SLAs
```

### Co-location: Entity-Type vs User-Centric Sharding

```
POOR DESIGN: Shard by entity type
  users → Users Shard
  posts → Posts Shard
  likes → Likes Shard
  comments → Comments Shard
  
  To load a feed: query 4 different shards + application-level JOIN
  = 4x round trips, no transactions across shards, complex ❌

GOOD DESIGN: Shard by user_id (co-locate related data)
  User 12345's profile, posts, likes, comments → all on SAME shard
  
  To load user 12345's feed: query 1 shard
  = single-shard query, single-shard transaction ✅
  Instagram uses this approach
```

---

## How It Works (Step by Step)

1. **Choose the sharding key**: Must distribute data evenly AND align with common query patterns. Bad key → hotspots (one shard overloaded). For user-centric apps: `user_id`. For time-series: `timestamp`. For multi-tenant: `tenant_id`.

2. **Apply sharding function**: Maps key → shard number. Three approaches: range, hash, or directory lookup.

3. **Route queries to correct shard**: App/routing proxy computes shard from key, sends query to that specific shard only. This is the single-shard query — ideal case.

4. **Handle cross-shard operations**: When query needs data from multiple shards (global aggregations, search across all users): fan out query to all shards in parallel, merge results in application layer. Latency = slowest shard + merge overhead.

5. **Manage shard metadata**: Source of truth for "which shard owns which key range." Lives in ZooKeeper, a config service, or the routing layer. Must be updated atomically when shards are added.

6. **Plan for resharding**: When adding shards, use dual-write periods (write to both old and new location) or online migration. Never stop-the-world unless maintenance window is acceptable. Verify data consistency post-migration.

---

## Variants (Sharding Strategies)

| Strategy | Distribution | Range Queries | Resharding | Hotspot Risk |
|----------|-------------|---------------|------------|--------------|
| **Range-based** | Uneven (skewed to recent) | Efficient | Easy (split ranges) | High (recent data) |
| **Hash-based** | Even | Impossible | Expensive (remap most keys) | Low |
| **Consistent hashing** | Even | Impossible | Cheap (1/N keys move) | Low |
| **Directory-based** | Fully flexible | Depends | Flexible | Manageable |
| **Geographic** | By region | Within region | Moderate | Imbalanced regions |
| **Entity group** | By parent entity | Within group | Moderate | Large entities |

---

## Trade-offs

| Dimension | Sharded | Non-Sharded |
|-----------|---------|-------------|
| **Write throughput** | N × single-shard throughput | Limited by single machine |
| **Read throughput** | N × single-shard read | Limited (depends on replicas) |
| **Cross-shard JOINs** | Application-layer (expensive) | Native DB JOINs (fast) |
| **Transactions** | Limited to single shard | Full ACID across all data |
| **Operational complexity** | N-fold (N monitors, N backups, N upgrades) | Single DB |
| **Schema changes** | Must coordinate across all shards | Single migration |

**When to shard**: Write throughput maxed out, dataset > single machine disk, query latency degraded despite all optimizations. Reject premature sharding — Uber, Facebook, Instagram all started on single DB and only sharded under real load.

---

## When to Use (and When Not To)

**Use when:**
- Write volume truly exceeds single-machine capacity (confirmed by metrics, not speculation)
- Dataset size exceeds what a single machine + its replicas can efficiently serve
- You've already exhausted: vertical scaling, read replicas, caching, query optimization, archiving cold data
- You have clear, stable query patterns that align with a good shard key

**Avoid when:**
- Data fits comfortably on a single machine — over-engineering is expensive
- Your workload is read-heavy — add read replicas and caching first (far simpler)
- You have many cross-shard query requirements — sharding will make those worse
- Team lacks experience with distributed systems — sharding bugs are subtle

---

## MERN Developer Notes

```javascript
// Sharding router for user data with hash-based sharding

const { Pool } = require('pg');

// Shard configuration — each shard is a separate Postgres instance
const shards = [
  new Pool({ host: 'shard-0.db.example.com', database: 'app_users' }),
  new Pool({ host: 'shard-1.db.example.com', database: 'app_users' }),
  new Pool({ host: 'shard-2.db.example.com', database: 'app_users' }),
  new Pool({ host: 'shard-3.db.example.com', database: 'app_users' }),
];

const NUM_SHARDS = shards.length;

// Consistent hash function (FNV-1a for even distribution)
function hashShardKey(userId) {
  let hash = 2166136261;
  const str = String(userId);
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime
  }
  return hash % NUM_SHARDS;
}

// Get the shard pool for a given user
function getShardForUser(userId) {
  return shards[hashShardKey(userId)];
}

// SINGLE-SHARD QUERY: Get user profile (fast — one shard)
async function getUserProfile(userId) {
  const shard = getShardForUser(userId);
  const result = await shard.query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0] || null;
}

// SINGLE-SHARD WRITE: Create user
async function createUser({ id, username, email }) {
  const shard = getShardForUser(id);
  await shard.query(
    'INSERT INTO users (id, username, email, created_at) VALUES ($1, $2, $3, NOW())',
    [id, username, email]
  );
}

// CROSS-SHARD QUERY: Search users (requires fan-out — use sparingly)
async function searchUsers(query, limit = 10) {
  // Fan out to all shards in parallel
  const shardResults = await Promise.all(
    shards.map(shard =>
      shard.query(
        'SELECT id, username FROM users WHERE username ILIKE $1 LIMIT $2',
        [`%${query}%`, limit]
      )
    )
  );
  
  // Merge and sort results from all shards
  const allResults = shardResults.flatMap(r => r.rows);
  return allResults
    .sort((a, b) => a.username.localeCompare(b.username))
    .slice(0, limit);
}

// CO-LOCATION: Store posts on same shard as user
// Important: posts table must use userId as part of partition key
async function createPost({ postId, userId, content }) {
  // Post goes to SAME shard as the user — enables single-shard user feed
  const shard = getShardForUser(userId);
  await shard.query(
    'INSERT INTO posts (id, user_id, content, created_at) VALUES ($1, $2, $3, NOW())',
    [postId, userId, content]
  );
}

async function getUserFeed(userId) {
  // Single-shard: user + all their posts on same shard
  const shard = getShardForUser(userId);
  const result = await shard.query(
    `SELECT u.username, p.content, p.created_at 
     FROM users u JOIN posts p ON p.user_id = u.id
     WHERE u.id = $1 ORDER BY p.created_at DESC LIMIT 20`,
    [userId]
  );
  return result.rows;
}
```

---

## Real-World Examples

| Company | Sharding Key | Strategy | Key Insight |
|---------|-------------|----------|------------|
| **Instagram** | `user_id` (entity group sharding) | User-centric co-location: all user's posts, likes, comments on same shard | Started with 16 shards; grew to hundreds. Single-shard queries for all user-scoped operations. |
| **Discord** | `message_id` (hash-based) | Hash-based for even distribution of message storage across shards | Message IDs are large random-ish numbers — hash distribution is nearly perfect. |
| **Facebook** | `user_id` (MySQL shards) | Range-based within each shard pool | Resharded their MySQL infrastructure multiple times as they grew from thousands → billions of users. 5-year projects. |
| **Uber** | `(city_id, timestamp)` for trips | Geographic + time prefix | Keeps all trips for a city together for efficient dispatch queries; time prefix prevents hotspot on newest data. |
| **Cassandra** | Any partition key (consistent hashing) | Consistent hashing on token ring | Add new nodes → only 1/N data migrates. Virtual nodes improve balance. No single master. |

---

## Interview Cheat Sheet

### Q: How do you choose a shard key?
**A:** The shard key must satisfy two criteria: (1) **Even distribution** — no key should cause one shard to hold significantly more data or traffic than others. (2) **Alignment with access patterns** — the most common queries should be single-shard queries using the shard key. For user-centric apps: `user_id`. For time-series: `timestamp` (watch hotspots on recent data — add bucket prefix). For multi-tenant SaaS: `tenant_id`. Bad keys: auto-increment IDs (new writes all go to last shard), low-cardinality keys (country, status — massive hotspots).

### Q: How would you handle resharding (adding a new shard)?
**A:** Online migration in 4 phases: (1) Launch new shard, update directory/config to show new target. (2) Dual-write: ALL writes go to both old AND new shard. (3) Background migration: copy data from old to new shard, verify checksums. (4) Flip reads to new shard once data verified. Decommission old shard. Consistent hashing minimizes step 3 — only 1/N keys need to migrate. Never stop-the-world for production unless maintenance window is acceptable.

### Q: What happens to cross-shard transactions?
**A:** You lose single-DB ACID transactions. Options: (1) Design to avoid cross-shard transactions by co-locating related data (Instagram approach), (2) Two-phase commit for unavoidable cross-shard operations — slow and adds coordinator failure mode, (3) Saga pattern — sequence of local shard transactions with compensating transactions on failure, (4) Accept eventual consistency — most social features tolerate it.

---

## Red Flags to Avoid

- "We'll add sharding from day one" — premature optimization; start with one DB, shard under real load
- Not considering cross-shard query implications when choosing a shard key
- Choosing a low-cardinality shard key (country, status) → guarantees hotspots
- Not addressing how to handle resharding in the future
- "Sharding solves read performance" — no, sharding solves writes and storage; use replicas for reads

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Shard** | Independent database instance holding a distinct subset of the total dataset |
| **Shard Key** | Attribute used to determine which shard a row belongs to |
| **Sharding Function** | Maps shard key value to a specific shard (range, hash, directory) |
| **Range-Based Sharding** | Continuous ranges of key space assigned to each shard |
| **Hash-Based Sharding** | `hash(key) % num_shards` determines the shard; even distribution |
| **Consistent Hashing** | Keys and shards on a hash ring; adding shards moves only 1/N keys |
| **Directory-Based Sharding** | Lookup table maps specific keys to shards; maximum flexibility |
| **Geographic Sharding** | Data routed to shards based on user's geographic region |
| **Entity Group Sharding** | Related entities (user + posts + likes) co-located on same shard |
| **Cross-Shard Query** | Query requiring data from multiple shards; expensive fan-out |
| **Co-location** | Storing related data on the same shard to enable single-shard queries |
| **Hotspot** | Shard receiving disproportionate traffic due to skewed key distribution |
| **Virtual Nodes** | Each physical shard has multiple positions on hash ring; improves balance |
| **Resharding** | Moving data when adding/removing shards; major operational undertaking |
| **Dual-Write** | Period during resharding when new data written to both old and new shard |
| **Online Migration** | Resharding without downtime; dual-write + background copy + flip |
