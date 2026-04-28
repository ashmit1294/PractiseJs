# T01 — Caching Overview

---

## 1. ELI5

Your brain is a cache. When someone asks "what's 12 × 12?", you don't re-derive multiplication from scratch — you instantly recall "144" from memory. That's a **cache hit**.

Now if they ask "what's 1247 × 3891?", you don't know immediately — that's a **cache miss**. You have to calculate it (expensive). If they're likely to ask again, you write it down on a sticky note (populate the cache).

Databases are the "slow calculation". RAM/Redis is the "sticky note on your desk". Everything scalable uses this principle at every layer.

---

## 2. Analogy

**McDonald's vs custom restaurant:**

McDonald's keeps 100 burgers pre-made under heat lamps (cache). When you order a Big Mac, you get it in 30 seconds (cache hit). They pre-made what they predicted would be popular.

A custom restaurant (no cache) cooks everything fresh on order — takes 20 minutes per meal.

If McDonald's runs out of Big Macs (cache miss), they cook fresh (database query) — 20 minutes. Then they make more (cache population).

**Key insight**: McDonald's needs to predict demand correctly (eviction policy, TTL), keep food fresh (TTL, invalidation), and handle rush hours (scaling, warmup). Same problems exist in caching.

---

## 3. Core Concept

### Cache Hit vs Cache Miss

```
Request for data (key: user:123)
           │
           ▼
    ┌─────────────┐
    │   Cache     │──── HIT ────► Return data (< 1ms) ✅
    │  (Redis)    │
    └──────┬──────┘
           │ MISS
           ▼
    ┌─────────────┐
    │  Database   │──── Query ──► Return data (~50ms)
    └──────┬──────┘
           │
           ▼
    Store in cache (TTL: 300s)
           │
           ▼
    Return to client

Hit ratio = cache_hits / (cache_hits + cache_misses) × 100%
Target: ≥ 80% for meaningful benefit
90% hit ratio = 10× reduction in database load
99% hit ratio = 100× reduction in database load
```

### Latency Hierarchy

```
Storage Layer          │ Latency       │ Relative Speed
───────────────────────┼───────────────┼────────────────
L1 CPU cache           │ ~0.5 ns       │ 1× (baseline)
L2 CPU cache           │ ~7 ns         │ 14×
RAM (process memory)   │ ~100 ns       │ 200×
SSD (local NVMe)       │ ~100 μs       │ 200,000×
Network (same DC)      │ ~500 μs       │ 1,000,000×
Redis (cluster, local) │ < 1 ms        │ fast enough
Database (disk query)  │ 10 – 100 ms   │ 20,000,000×
Database (cross-DC)    │ 100 – 500 ms  │ too slow at scale

Caching converts database-speed operations → memory-speed operations
```

---

## 4. Caching Layers (Multi-Tier Reality)

```
                    ┌──────────────┐
  User Request ────►│   Browser    │──── Cache-Control, ETags, Service Workers
                    └──────┬───────┘     TTL: hours–days (static assets)
                           │ miss
                           ▼
                    ┌──────────────┐
                    │     CDN      │──── Edge nodes worldwide (CloudFront, Cloudflare)
                    │ (Edge Cache) │     TTL: minutes–hours
                    └──────┬───────┘
                           │ miss (~10% of requests)
                           ▼
                    ┌──────────────┐
                    │  Load Balancer│─── SSL session cache, rate-limit counters
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  App Server  │──── In-process cache (LRU map, hot config data)
                    │  + Redis     │     Application cache: API responses, sessions
                    └──────┬───────┘     TTL: seconds–minutes
                           │ miss (~1–5%)
                           ▼
                    ┌──────────────┐
                    │  Database    │──── Buffer pool, query cache (InnoDB buffer pool)
                    │  (PostgreSQL)│     Internal, transparent, auto-managed
                    └──────────────┘

Each layer reduces load on downstream layers exponentially.
Shopify: CDN absorbs 90% of traffic; DB only sees checkout/admin writes.
Netflix: CDN for video chunks (90%+ hit); EVCache for metadata; DB rarely hit.
```

---

## 5. Key Metrics

### Hit Ratio

$$\text{Hit Ratio} = \frac{\text{cache hits}}{\text{cache hits} + \text{cache misses}} \times 100\%$$

```
Hit ratio  │ DB load reduction │ Verdict
───────────┼───────────────────┼────────────────────
99%        │ 100×              │ Excellent
95%        │ 20×               │ Very good 
90%        │ 10×               │ Good (target minimum)
80%        │ 5×                │ Acceptable
70%        │ 3.3×              │ Needs investigation
< 70%      │ < 3×              │ Cache is under-performing; fix key design

"Monitor hit ratios per endpoint. Drops are production incidents." — Reddit SRE
```

### Time-To-Live (TTL) Selection

```
Data type                     │ Typical TTL    │ Reasoning
──────────────────────────────┼────────────────┼──────────────────────────────────
Session tokens                │ 30 min–24 hrs  │ Security: expire with sessions
User profile (static info)    │ 1–24 hrs       │ Rarely changes; long TTL = good hit ratio
Product prices                │ 1–5 min        │ Must be accurate; can't be stale
Product descriptions          │ 1–12 hrs       │ Changes infrequently
Real-time inventory           │ 0 (no cache)   │ Must be exact; cache = oversell risk
Social feed items             │ 5–30 min       │ Eventual consistency fine
Static assets (CSS/JS)        │ 1 year         │ Content-hash versioning enables long TTL
Rate limit counters           │ 1 second       │ Auto-expire per time window
Recommendation scores         │ 15–60 min      │ Expensive to compute; some lag acceptable
```

---

## 6. Core Problems Caching Solves & Introduces

### Problems Solved

```
1. Latency:    100ms DB query → <1ms cache hit (100× speedup)
2. Throughput: 1 DB node handles 5K QPS → with cache, same traffic hits DB at 500 QPS
3. Cost:       Fewer DB queries → smaller DB instance → lower cloud bill
4. Resilience: Cache absorbs reads during DB maintenance/failure window
```

### Problems Introduced

```
1. Consistency / Staleness:
   Cache may serve old data after a write until TTL expires or explicit invalidation
   "There are only two hard things in CS: cache invalidation and naming things" — Phil Karlton

2. Cold Start / Cache Stampede:
   Empty cache → all requests miss → database flood → DB falls over
   Solution: cache warming, request coalescing (only 1 request fetches, others wait)

3. Memory pressure:
   Cache is finite. Eviction policies (LRU, LFU) determine what stays and what goes
   Wrong eviction policy → low hit ratios

4. Complexity:
   Two sources of truth (cache + DB). Invalidation logic adds code surface.
   Distributed caches add network hop, serialization, connection pool management.
```

---

## 7. Cache Strategies Overview (Map to Later Topics)

```
READ strategies:
  Cache-Aside (T02):    App checks cache → miss → app queries DB → app populates cache
  Read-Through (T13):   App checks cache → miss → cache library auto-fetches DB → returns
  
WRITE strategies:
  Write-Through (T03):  Write to CACHE + DB synchronously → guaranteed consistency, +latency
  Write-Behind (T04):   Write to CACHE → ack → async DB write → fast writes, durability risk
  Refresh-Ahead (T05):  Proactively refresh cache before TTL expires → no cold start, wasteful

  
Most common: Cache-Aside for reads + Write-Through/invalidation for writes
```

---

## 8. Cache Stampede (Thundering Herd)

```
Scenario: cache entry for popular product expires at 12:00:00.000
  12:00:00.001 — 10,000 concurrent requests → all miss → 10,000 DB queries
  DB crashes → cache never warms → more misses → more DB queries → death spiral

Solutions:

1. Request Coalescing / Locking:
   First miss gets a lock and queries DB; all others wait for the lock
   Facebook: "lease" mechanism — only the lease-holder queries MySQL
   
2. Probabilistic Early Expiration (PER):
   As TTL approaches 0, increase probability of early refresh
   Prevents synchronized expiration across 1000s of servers
   
3. Short Jitter on TTL:
   TTL = base + random(0, base × 0.1)
   Desynchronizes expiration → stampedes split across time window
   
4. Cache Warming:
   Pre-populate cache before expiration on a schedule
   Works for predictable hot data (home page, celebrity profiles)
```

---

## 9. MERN Dev Notes

```javascript
// Redis cache utility — Node.js (ioredis)
const Redis = require('ioredis');
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  // Connection pool — critical for multi-threaded Node.js workers
  maxRetriesPerRequest: 3,
  enableReadyCheck: true
});

// Generic cache-aside helper
async function getCached(key, ttl, fetchFn) {
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached);          // ← cache hit: < 1ms
    }
  } catch (err) {
    logger.warn('Redis read failed, falling back to DB', { err });
    // Non-fatal: cache miss is acceptable; don't let Redis down = app down
  }
  
  const data = await fetchFn();           // ← cache miss: query DB
  
  if (data !== null && data !== undefined) {
    try {
      await redis.set(key, JSON.stringify(data), 'EX', ttl);
    } catch (err) {
      logger.warn('Redis write failed', { err });  // non-fatal
    }
  }
  
  return data;
}

// Usage in Express controller
app.get('/api/products/:id', async (req, res) => {
  const product = await getCached(
    `product:${req.params.id}`,     // ← cache key
    3600,                           // ← TTL: 1 hour
    () => Product.findById(req.params.id)  // ← DB fetch fn
  );
  
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json(product);
});

// Monitor hit ratio per endpoint
// Track in Prometheus / Datadog:
// cache_hits_total{endpoint="/api/products/:id"} counter
// cache_misses_total{endpoint="/api/products/:id"} counter
// hit_ratio = cache_hits / (cache_hits + cache_misses)
```

---

## 10. Real-World Case Studies

### Netflix — Multi-Tier Caching at 50M+ RPS

```
Scale: 250M subscribers, 50M+ requests/second peak

Architecture (3 tiers):
  L0: CloudFront CDN — video chunks, static assets; 90%+ hit ratio
  L1: In-process cache on each App Server — hot config, thumbnail metadata; < 1ms, no network
  L2: EVCache (Memcached-based distributed cache) — movie metadata, user preferences, 
      recommendation scores; 1-2ms, hundreds of nodes
  L3: Cassandra (database) — source of truth; only seen on L2 miss (~1% of requests)

TTL strategy:
  Movie metadata: 5-15 min (changes rarely; long TTL)
  User preferences: 1 min (critical for personalization)
  Subscription status: no cache / event-based invalidation (financial data)
  
Impact:
  Database load reduction: 100× during peak hours
  P99 latency: < 50ms globally for metadata requests (without cache: 500ms+)
  Infrastructure cost: estimated $50M/year savings vs no-cache architecture
```

### Twitter — Pre-Computed Timeline Cache

```
Challenge: loading your timeline by querying 1000 followed accounts' latest tweets = impossible

Architecture:
  Write-heavy cache: when someone you follow tweets → fanout service updates
                     your cached timeline in Redis (key: timeline:{user_id})
  
  Read path: GET /timeline → check Redis → return pre-computed list (<1ms)
  Write path: new tweet → push to all follower timelines in Redis (fan-out-on-write)
  
  Celebrity exception: accounts with >1M followers use "fan-out on read"
    → cache the celebrity's tweets separately
    → merge at read time (avoids updating 100M timelines per celebrity tweet)
    
  Eviction: timelines expire after 7 days of inactivity (LRU + TTL)
  Warming:  user logs in after absence → background job rebuilds timeline in Redis
            while serving partial cached version immediately
```

### Facebook — 99%+ Hit Ratio at Petabyte Scale

```
TAO: Facebook's cache layer in front of MySQL for social graph data
  Caches: friendships, likes, comments, post metadata
  Pattern: write-through (writes go to cache + MySQL synchronously)
  Invalidation: event-based → write broadcasts invalidation to all TAO shards
  Result: 99%+ hit ratio; MySQL only processes ~1% of reads
  
Memcached (legacy feed/profile cache):
  99% of profile reads served from Memcached — MySQL never touched
  Lease mechanism prevents stampede: only one request gets the lease to query MySQL
  
Lesson: a well-designed cache with 99% hit ratio means MySQL can be sized
        for writes only — dramatically cheaper infrastructure
```

---

## 11. Interview Cheat Sheet

**Q: What is caching and why does it matter?**
> Caching stores frequently-accessed data in fast temporary storage (usually RAM) to reduce latency and database load. Reading from Redis takes < 1ms; reading from disk/network takes 10-100ms. At scale, caching isn't optional — without it, you need 10-100× more database capacity for the same traffic.

**Q: What is cache hit ratio and what's a good target?**
> Hit ratio = cache_hits / (hits + misses) × 100%. Aim for ≥ 80%. 90% hit ratio = 10× DB load reduction. Monitor per endpoint; drops below 80% should be production alerts. A 60% hit ratio adds caching complexity without meaningful benefit — investigate key design or TTL configuration.

**Q: What are the main cache layers in a typical web application?**
> Browser cache (HTTP headers, service workers) → CDN/edge (static/semi-static content) → Application cache (Redis/Memcached for API responses, sessions) → Database internal cache (buffer pool). Each layer reduces load on the layer below it. Most production systems use all four simultaneously.

**Q: What is a cache stampede and how do you prevent it?**
> A stampede occurs when a popular cache entry expires, causing thousands of simultaneous cache misses that flood the database. Prevention: (1) Request coalescing — only one request fetches from DB while others wait; (2) TTL jitter — randomize expiration times to desynchronize; (3) Probabilistic early expiration — refresh before expiry; (4) Cache warming — proactively refresh popular entries before they expire.

---

## 12. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Cache** | Fast temporary storage (usually RAM) for frequently-accessed data |
| **Cache Hit** | Request served from cache — fast (< 1ms) |
| **Cache Miss** | Data not in cache; must query source (DB) — slow (10-100ms) |
| **Hit Ratio** | % of requests served from cache; target ≥ 80% |
| **TTL** | Time-To-Live — expiry duration for cached entries |
| **Cache Eviction** | Removing entries when cache memory is full (LRU, LFU, etc.) |
| **Cache Invalidation** | Explicitly removing/updating stale entries after source data changes |
| **Cache Warming** | Pre-populating cache before traffic arrives (avoids cold start) |
| **Cold Start** | Empty cache; every request is a miss; DB gets full traffic load |
| **Cache Stampede** | Thundering herd — many simultaneous misses flood the DB |
| **Request Coalescing** | Let only one request fetch from DB; others wait for the result |
| **Cache-Aside** | App manages cache explicitly: check, miss, fetch, populate |
| **Write-Through** | Write to cache + DB synchronously on every write |
| **Write-Behind** | Write to cache first; async persist to DB later |
| **Read-Through** | Cache library auto-fetches DB on miss (app just reads from cache) |
| **Refresh-Ahead** | Proactively refresh hot entries before TTL expires |
| **EVCache** | Netflix's distributed Memcached-based caching system |
| **TAO** | Facebook's write-through distributed cache for social graph data |
| **Redis** | Dominant in-memory data store used for application-level caching |
| **Memcached** | Simpler, faster key-value cache; limited to strings, no persistence |
