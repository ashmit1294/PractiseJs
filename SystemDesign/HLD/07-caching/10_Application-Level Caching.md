# T10 — Application-Level Caching

---

## 1. ELI5

Application-level caching is when your code (Node.js, Python, etc.) decides to remember things so it doesn't have to do slow work twice.

Think of a math student who calculates that `17 × 23 = 391` once and writes it on a sticky note. Next time they need `17 × 23`, they check the sticky note instead of recalculating. The sticky note IS the application cache — your code stores the result so it doesn't have to go to the database (recalculate) again.

The sticky note can be:
- On your desk (in-process cache — only you see it)
- On the classroom whiteboard (Redis — everyone in the class sees it)

---

## 2. Analogy

**Chef's prep work:**

Before dinner service, a chef:
1. Pre-chops vegetables (precomputes) and keeps them in a bowl on the counter (in-process cache / L1)
2. Writes the day's reservations on a shared whiteboard (Redis / L2 cache) so all kitchen staff know
3. Runs to the pantry only when something isn't prepped (cache miss → DB query)

Two-tier caching = bowl on counter (L1, tiny + instant) + whiteboard (L2, shared + larger).

---

## 3. Redis — The Standard for Application-Level Caching

### Why Redis Over Memcached?

```
┌──────────────────────┬────────────────────────┬────────────────────────┐
│ Feature              │ Redis                  │ Memcached              │
├──────────────────────┼────────────────────────┼────────────────────────┤
│ Data structures      │ String, List, Set,     │ String (key-value)     │
│                      │ Sorted Set, Hash,      │ only                   │
│                      │ Bitmap, HyperLogLog    │                        │
│ Persistence          │ RDB snapshots + AOF    │ None (in-memory only)  │
│ Replication          │ Built-in primary/replica│ Client-side sharding  │
│ Clustering           │ Redis Cluster (native) │ Client-side sharding  │
│ Pub/Sub              │ Yes (built-in)         │ No                     │
│ Lua scripting        │ Yes (atomic operations)│ No                     │
│ Transactions         │ MULTI/EXEC             │ No                     │
│ Single-threaded?     │ Single-threaded core   │ Multi-threaded         │
│ Throughput           │ ~1M ops/sec            │ ~1M+ ops/sec (multi-T) │
│ Best for             │ Everything             │ Simple string KV at    │
│                      │                        │ extreme scale          │
└──────────────────────┴────────────────────────┴────────────────────────┘

Verdict: Use Redis unless you specifically need Memcached's multi-threaded
         performance for pure string KV operations at extreme scale (rare).
```

### Key Redis Data Structures for Caching

```
STRING — basic cache
  SET user:123 '{"name":"Alice"}' EX 3600
  GET user:123
  
HASH — object fields (avoid serialize/deserialize overhead)
  HSET user:123 name "Alice" email "alice@example.com" age "30"
  HGET user:123 name
  HGETALL user:123
  → Update single field: HSET user:123 age "31" (no need to serialize entire object)
  
LIST — queues, recent activity
  LPUSH recent:views:user123 "product:456"
  LRANGE recent:views:user123 0 9  → last 10 viewed products
  LTRIM recent:views:user123 0 99  → keep only last 100
  
SET — unique memberships
  SADD product:456:viewers "user:123"
  SCARD product:456:viewers  → count unique viewers
  SISMEMBER active_sessions "session:abc123"  → O(1) session check
  
SORTED SET — leaderboards, ranked lists
  ZADD leaderboard 9500 "player:alice"
  ZADD leaderboard 8200 "player:bob"
  ZRANGE leaderboard 0 9 REV WITHSCORES  → top 10 players with scores
  ZRANK leaderboard "player:alice"        → get rank of a player
  → O(log N) operations — perfect for any ranked/scored data
  
BITMAP — compact boolean flags for millions of users
  SETBIT user:active:20250101 123 1   → user 123 active on Jan 1
  BITCOUNT user:active:20250101       → total active users that day
  → 1M users = 125KB (extremely compact)
```

---

## 4. In-Process Cache (L1 Cache)

```
What: local HashMap/LRU cache within a single Node.js process
      No network round-trip → sub-microsecond latency
      
When to use:
  - Config data (feature flags, app settings) — changes rarely, read constantly
  - Static lookup tables (country codes, currency rates updated hourly)
  - Frequently-accessed, rarely-changing reference data
  
Limitations:
  - NOT shared across instances (10 Node.js pods = 10 separate caches)
  - Memory limit: process heap (don't store large objects)
  - On pod restart: cache is cold (all data lost)
  
Node.js in-process cache libraries:
  - node-cache: simple TTL-based hashmap
  - lru-cache: LRU eviction policy, O(1) operations
  - quick-lru: faster implementation
  
Implementation:
  const LRU = require('lru-cache');
  const L1 = new LRU({
    max: 500,           // max 500 entries
    ttl: 1000 * 60 * 5 // 5 minutes TTL
  });
```

---

## 5. Two-Tier Caching (L1 + L2)

```
Optimal architecture for high-traffic, low-latency systems:

  Request
    │
    ▼
  L1 Cache (in-process, < 0.1ms)
  tiny: 100-500 entries, very hot data only
    │ MISS
    ▼
  L2 Cache (Redis, < 1ms)
  larger: millions of entries, all hot data
    │ MISS
    ▼
  Database (10-100ms)
  source of truth

  ┌─────────────────┬──────────────────┬──────────────────┐
  │ Layer           │ Size             │ Latency          │
  ├─────────────────┼──────────────────┼──────────────────┤
  │ L1 in-process   │ 100-500 entries  │ < 0.1ms          │
  │ L2 Redis        │ 10M+ entries     │ 0.5-1ms          │
  │ DB              │ Unlimited        │ 10-100ms         │
  └─────────────────┴──────────────────┴──────────────────┘
  
Popular data: served from L1 (0.1ms) without Redis network hop
Less popular data: served from L2 Redis (1ms) without DB query
Tail/uncached data: DB query (100ms) + populate both L1 and L2
```

### Two-Tier Implementation

```javascript
const LRU = require('lru-cache');

const L1 = new LRU({ max: 500, ttl: 1000 * 60 }); // 1 min L1 TTL (shorter — keeps it fresh)

async function getProduct(productId) {
  const key = `product:${productId}`;
  
  // L1: in-process (< 0.1ms)
  const l1 = L1.get(key);
  if (l1) return l1;
  
  // L2: Redis (< 1ms)
  const l2 = await redis.get(key);
  if (l2) {
    const data = JSON.parse(l2);
    L1.set(key, data);   // populate L1
    return data;
  }
  
  // DB (10-100ms)
  const data = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
  if (data) {
    await redis.set(key, JSON.stringify(data), 'EX', 300); // 5 min L2 TTL
    L1.set(key, data);
  }
  return data;
}
```

---

## 6. Redis Cluster — Horizontal Scaling

```
Single Redis: ~1M ops/sec, ~100GB usable RAM
  Sufficient for most applications
  
Redis Cluster: when you need more

  Hash slot distribution:
    Total: 16384 hash slots
    Cluster of 3 masters: each handles ~5461 slots
    
    HASH_SLOT = CRC16(key) mod 16384
    
    Key "user:123" → CRC16("user:123") mod 16384 = 3218 → shard 1
    Key "product:456" → CRC16("product:456") mod 16384 = 10987 → shard 3
    
  Setup: each master has ≥1 replica for HA
    master-1 (slots 0-5460)     + replica-1
    master-2 (slots 5461-10922) + replica-2
    master-3 (slots 10923-16383)+ replica-3
    
  Automatic failover:
    Master fails → Sentinel/Cluster detects in <10s
    Replica promoted to master automatically
    
  Hash tags — co-locate keys on same shard:
    {user:123}:cart and {user:123}:profile → same shard (braces force slot by "user:123")
    Needed for MULTI/EXEC transactions (must be on same shard)
    
Node.js Cluster setup:
  const Redis = require('ioredis');
  const cluster = new Redis.Cluster([
    { host: '127.0.0.1', port: 7000 },
    { host: '127.0.0.1', port: 7001 },
    { host: '127.0.0.1', port: 7002 }
  ]);
```

---

## 7. Redis Sorted Sets for Leaderboards

```javascript
// Real-time leaderboard with Redis Sorted Sets

class LeaderboardService {
  constructor(redis) {
    this.redis = redis;
    this.key = 'game:leaderboard';
  }
  
  // Update score — O(log N)
  async updateScore(playerId, score) {
    await this.redis.zadd(this.key, score, `player:${playerId}`);
  }
  
  // Get top N players — O(log N + N)
  async getTopPlayers(n = 10) {
    const results = await this.redis.zrange(this.key, 0, n - 1, 'REV', 'WITHSCORES');
    return this._parseResults(results);
  }
  
  // Get rank of a specific player — O(log N)
  async getPlayerRank(playerId) {
    const rank = await this.redis.zrevrank(this.key, `player:${playerId}`);
    return rank !== null ? rank + 1 : null; // 1-indexed
  }
  
  // Get players around a specific player (± 5 positions) — O(log N)
  async getPlayerNeighbors(playerId, spread = 5) {
    const rank = await this.redis.zrevrank(this.key, `player:${playerId}`);
    if (rank === null) return [];
    
    const from = Math.max(0, rank - spread);
    const to = rank + spread;
    const results = await this.redis.zrange(this.key, from, to, 'REV', 'WITHSCORES');
    return this._parseResults(results);
  }
  
  _parseResults(results) {
    const parsed = [];
    for (let i = 0; i < results.length; i += 2) {
      parsed.push({ player: results[i], score: parseFloat(results[i + 1]) });
    }
    return parsed;
  }
}
```

---

## 8. Serialization Considerations

```
Every cache.get() → deserialize (parse JSON → object)
Every cache.set() → serialize (object → JSON string)

Performance profiling shows:
  JSON.parse of 10KB object: ~0.1ms
  JSON.stringify of 10KB object: ~0.05ms
  redis.get() round-trip: ~0.5ms
  Total: ~0.65ms (parse dominates for large objects)
  
Optimization 1 — Keep objects small
  Cache only necessary fields (not entire DB row)
  User cache: { id, name, avatar } NOT { id, name, email, bio, address, preferences... }
  
Optimization 2 — MessagePack instead of JSON
  MessagePack: binary format, 2-3× smaller than JSON, 2× faster to parse
  Library: msgpack5, @msgpack/msgpack
  
  // Benchmark: 100KB JSON object
  JSON.stringify: 0.5ms, size: 100KB
  msgpack.encode: 0.2ms, size: 42KB
  
  Trade-off: not human-readable (harder to debug in Redis CLI)
  
Optimization 3 — Redis HASH instead of serialized JSON
  HGET user:123 name  → no deserialization needed for single field access
  vs GET user:123 → parse entire JSON → read .name
  
  But: HGETALL still serializes (though to multiple strings, not complex JSON)
```

---

## 9. Real-World Examples

### Twitter — Redis Sorted Sets for Trending Topics

```
Problem: "What's trending?" requires ranking millions of tweets by engagement velocity
  Naive: SELECT hashtag, COUNT(*), ... GROUP BY ... WHERE created_at > NOW()-INTERVAL '1h'
         → Scanning 500M tweets/hour → 30 seconds per query
         
Redis Sorted Set solution:
  On each tweet: ZINCRBY trending:2025010115 1 "#SuperBowl"  (increment score)
  Trending query: ZRANGE trending:2025010115 0 9 REV WITHSCORES  → < 1ms
  
  Write path: tweet service → Redis ZINCRBY (< 1ms, non-blocking)
  Read path:  trending widget → Redis ZRANGE (< 1ms)
  
  TTL: each trending:YYYYMMDDHH key expires after 2 hours
  Background: hourly aggregation job merges adjacent windows for "past 24h" view
  
  Result: trending 100M+ users see updates in real-time with zero DB load
```

### Discord — Redis Pub/Sub for Message Fanout

```
When user sends a message to a server (guild):
  All members currently online need to receive it instantly
  
Pattern:
  1. Message stored in Cassandra (persistent)
  2. Redis PUBLISH to channel: PUBLISH guild:12345 <message_payload>
  3. All Discord gateway servers SUBSCRIBED to guild:12345
     → receive message via Redis Pub/Sub
  4. Gateway servers push to connected WebSocket clients
  
  Scale: Discord has 19M+ concurrent users
  Each guild channel = 1 Redis channel
  Gateway servers: each subscribes to channels for connected users
  Redis Pub/Sub: zero message persistence (fire-and-forget) → appropriate
  
  vs Kafka: Redis Pub/Sub has no persistence/replay; Kafka does
  Discord uses Redis Pub/Sub for ephemeral real-time fanout
    (message history = Cassandra; real-time delivery = Redis)
```

### Instagram — Multi-Tier L1 + L2 Cache for Feed

```
Feed generation complexity:
  Follow 500 people → merge 500 streams → sort by time → paginate
  
Instagram approach:
  L1 (in-process, per API server):
    Last N feed items for last M active users
    Hot users: Beyoncé's followers = always in L1 across all API servers
    
  L2 (Redis Cluster):
    Pre-computed feed per user (post IDs only, not full data)
    Updated when: followed user posts, unfollow event, TTL expiry
    
  L3 (Cassandra):
    Full post data + media URLs
    
  Read path:
    GET /feed → L1 (HIT 45%) → L2 (HIT 50%) → recompute from Cassandra (5%)
    
  95% of feed reads never touch full post computation
```

---

## 10. Interview Cheat Sheet

**Q: Redis vs Memcached — when do you use each?**
> Redis in nearly all cases: richer data structures (sorted sets, hashes, pub/sub), persistence (AOF/RDB), native clustering, Lua scripting. Memcached only when you need pure string KV at extreme throughput AND your team has expertise in client-side sharding. Today, Redis handles even those cases with Redis Cluster.

**Q: What is two-tier caching and why use it?**
> L1 (in-process LRU, < 0.1ms) + L2 (Redis, < 1ms). Extremely hot data (top 1%) never needs a Redis network hop — served from L1 in sub-millisecond. L2 handles the long tail of hot data. DB handles cache misses. Typical impact: 45% hit at L1, 50% at L2, only 5% reach DB.

**Q: How do Redis Sorted Sets support leaderboards?**
> ZADD stores `(score, member)` pairs; ZRANGE/ZREVRANK give top-N and player rank in O(log N). Any leaderboard, ranking, or priority queue maps to a Sorted Set. Updates are atomic — no race conditions. Compare to DB: SQL `ORDER BY score DESC LIMIT 10` requires full table scan; Redis ZRANGE is O(log N + K) where K is results returned.

**Q: What's the difference between in-process cache and Redis?**
> In-process: sub-microsecond, zero network, not shared (each pod has separate copy). Redis: ~1ms network RTT, shared across all pods, survives pod restarts. Use in-process for config/flags/reference data that all pods need identically. Use Redis for user-specific data, large datasets, or anything written by one pod and read by another.

---

## 11. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Redis** | In-memory data structure store; primary tool for application-level caching |
| **Memcached** | Pure in-memory KV store; multi-threaded; less feature-rich than Redis |
| **L1 Cache** | In-process (local) cache — sub-microsecond, not shared across instances |
| **L2 Cache** | Shared network cache (Redis) — ~1ms, shared by all app servers |
| **Sorted Set** | Redis data structure: scored members; O(log N) rank operations |
| **Hash** | Redis data structure: field-value pairs; update single fields without full serialization |
| **Pub/Sub** | Redis messaging: publish to channel → all subscribers receive immediately |
| **Redis Cluster** | Horizontal sharding across 16384 hash slots; automatic failover |
| **Hash Slot** | Redis Cluster partition: CRC16(key) mod 16384 determines which shard holds the key |
| **Hash Tag** | {tag} in Redis key forces co-location on same shard: `{user:123}:cart` and `{user:123}:orders` |
| **MessagePack** | Binary serialization format; 2-3× smaller and faster than JSON |
| **In-Flight** | Keys currently being fetched/refreshed (tracked to prevent duplicate DB calls) |
