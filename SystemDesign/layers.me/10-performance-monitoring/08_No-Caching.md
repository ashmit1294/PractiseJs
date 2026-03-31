# No-Caching

## ELI5
Every time someone asks "What's 2+2?" you go to the library and look it up, instead of just remembering. The answer never changes. Caching means remembering answers so you don't have to recalculate them. A system with no caching recalculates everything every time — even when the result hasn't changed.

## Analogy
A restaurant where the chef makes every dish from scratch — growing vegetables, milling flour, slaughtering livestock — for every single order instead of using a prep station with pre-made bases.

---

## Core Concept
**No-Caching** means repeatedly executing expensive operations (DB queries, API calls, computations) whose results could be reused.

### The Capacity Multiplier Formula
```
effective_capacity = origin_capacity / (1 - hit_rate)

90% cache hit rate → effective_capacity = origin_capacity / 0.10 = 10× origin
95% cache hit rate → effective_capacity = origin_capacity / 0.05 = 20× origin
99% cache hit rate → effective_capacity = origin_capacity / 0.01 = 100× origin

Example:
  DB can handle 1,000 req/s
  With 95% cache hit rate: 1,000 / 0.05 = 20,000 effective req/s
  The cache multiplied DB capacity by 20× for free
```

---

## Multi-Layer Caching

```
Layer           Tool              TTL            Hit Rate     Latency
──────────────  ────────────────  ─────────────  ──────────   ──────
Browser cache   Cache-Control     static: 1yr    varies       ~0ms
                                  dynamic: 60s
CDN edge        Cloudflare, CF    1hr - 1day     85-95%       ~10ms
App/Redis       Redis, Memcached  5min - 24hr    80-95%       ~1ms
DB buffer pool  auto (InnoDB/PG)  auto           >95% target  ~1ms

Each layer reduces load on lower layers.
Browser cache miss → CDN hit (doesn't reach origin)
CDN miss → Redis hit (doesn't reach DB)
Redis miss → DB hit (fully cold path)
```

---

## The Four Caching Patterns

### 1. Cache-Aside (Most Common)
```javascript
async function getUser(userId) {
  // Step 1: Check cache
  const cached = await redis.get(`user:${userId}`);
  if (cached) return JSON.parse(cached);  // cache HIT ~1ms

  // Step 2: Cache miss — fetch from DB
  const user = await User.findById(userId);  // ~20ms

  // Step 3: Store in cache
  await redis.setex(`user:${userId}`, 300, JSON.stringify(user)); // TTL: 5 min

  return user;
}

// On write: invalidate cache
async function updateUser(userId, updates) {
  await User.findByIdAndUpdate(userId, updates);
  await redis.del(`user:${userId}`);  // invalidate to force fresh read
}
```

### 2. Write-Through (Always Fresh)
```javascript
// Write to cache AND DB synchronously
async function updateUserProfile(userId, profile) {
  await db.users.update({ _id: userId }, profile);           // write DB
  await redis.setex(`user:${userId}`, 3600, JSON.stringify(profile)); // write cache
  // Cache always stays in sync
  // Trade-off: adds write latency (~1ms extra for Redis write)
}
// Best for: session data, user preferences, shopping cart
```

### 3. Write-Behind (Lowest Write Latency)
```
Write to cache IMMEDIATELY, async write to DB later

Client → Redis (instant return ~1ms)
           └─async (every 100ms/on flush)─► DB write

Pros: Lowest write latency
Cons: Data loss risk if cache crashes before DB write
Use: High-frequency updates where some loss acceptable (view counts, metrics)
```

### 4. Read-Through (Transparent Cache)
```
Cache is in the read path — auto-populates on miss

Client → Varnish/Redis
  Hit: return cached value
  Miss: cache fetches from DB, stores, returns
  App code never talks to DB directly

Pros: Cleaner application code
Cons: First request is always cold; complex cache backend
Use: CDN behavior (Varnish, Cloudflare)
```

---

## Cache Stampede Prevention

```
Problem: TTL expires at peak time → 10,000 users hit DB simultaneously
         while cache is being refilled

Solutions:
1. Probabilistic early expiration:
   With probability p(t) = expires_in < threshold, refresh before expiry
   "Soft TTL" — proactively warm before expiry

2. Request coalescing (cache lock):
   Only ONE request goes to DB on cache miss; others wait for result
   Mutex with timeout:
     const lock = await redis.set(`lock:user:${id}`, 1, 'NX', 'EX', 5);
     if (lock) { /* fetch DB, fill cache, release lock */ }
     else { /* wait and retry */ }

3. Cache warming:
   Pre-populate cache at startup or before TTL expiry
   Background job refreshes high-traffic cache keys before they expire
```

---

## ASCII: No-Cache vs Multi-Layer Cache

```
NO CACHING
────────────────────────────────────────────────────
1,000 req/s → [DB] 100% of requests hit DB
              CPU: 95%, response time: 200ms, DB at limit

MULTI-LAYER CACHING
────────────────────────────────────────────────────
1,000 req/s →  Browser cache    (30% served)
           →   CDN cache        (40% served)  ─────► 890 req/s absorbed
           →   Redis cache      (20% served)
           →   [DB]             (10% hit DB) = 100 req/s  ← 10x reduction
```

---

## What NOT to Cache

```
❌ Real-time financial data (stock prices, payment balances)
❌ Unique per-request responses (no reuse value)
❌ Low-traffic data (caching overhead > benefit)
❌ High-write, rarely-read data (cache constantly invalidated)
❌ When DB is underutilized (< 20% CPU) — no ROI
```

---

## MERN Developer Notes

```javascript
// Redis caching middleware for Express
const cache = (ttl) => async (req, res, next) => {
  const key = `cache:${req.url}`;
  const cached = await redis.get(key);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(JSON.parse(cached));
  }
  // Override res.json to cache the response
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    redis.setex(key, ttl, JSON.stringify(data));
    res.setHeader('X-Cache', 'MISS');
    return originalJson(data);
  };
  next();
};

// Usage: 5-minute cache for product listing
app.get('/products', cache(300), async (req, res) => {
  const products = await Product.find({}).lean();
  res.json(products);
});

// HTTP cache headers (browser + CDN)
app.get('/static-content', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 24hr CDN cache
  res.json(data);
});
```

---

## Real-World Examples

| Company | Problem | Fix | Result |
|---|---|---|---|
| Dropbox | All metadata from DB every request | Multi-layer Memcached | 99% metadata served from cache; 100× DB reduction |
| Twitter | Timeline for 500M users generated per request | Precomputed timelines + fan-out service in Redis | 500K timeline req/s at 95% hit rate |
| Stripe | Idempotency checks hit DB every payment | ETags + Redis 60s TTL for cached responses | 85% cached; 200ms→20ms for repeated lookups |

---

## Interview Cheat Sheet

**Q: What's the difference between cache-aside and write-through?**

> A: Cache-aside: app checks cache first; on miss, reads DB and populates cache; on write, invalidates cache key. Best for read-heavy workloads. Write-through: app writes to both cache and DB synchronously; cache always stays fresh but adds write latency. Best for data that's frequently read right after writes (session, cart, user profile).

**Q: What is cache stampede and how do you prevent it?**

> A: Cache stampede (thundering herd): multiple cached keys expire simultaneously, sending all traffic to the DB at once. Prevention: (1) Add jitter to TTL — `ttl = base_ttl + random(0, 0.2 * base_ttl)` so expiries spread out. (2) Request coalescing — use a Redis lock so only one request hits the DB; others wait for it to populate the cache. (3) Probabilistic early refresh — background job refreshes keys before expiry based on access frequency.

**Q: At what cache hit rate does caching become worthwhile?**

> A: Break even is roughly 70-80%. At 90%+, you see 10× effective capacity amplification. Below 50%, caching adds complexity with minimal benefit. If your cache hit rate is low, the issue is likely high cardinality keys (too many unique cache keys, each accessed rarely) — reconsider what you're caching.

**Q: How do you handle cache invalidation?**

> A: There are two strategies: time-based (TTL) and event-based (explicit delete on write). Event-based is more immediate but risks inconsistency if the delete fails before the DB write (use write-through to solve). TTL is simpler but means stale data for up to TTL period. Most systems combine both: short TTL as safety net + explicit invalidation on writes.

**Q: How do you decide what TTL to set?**

> A: Match TTL to data volatility. User profile: 5-30 min. Product catalog: 1-24 hr. Static config: could be hours. Session: match session timeout. Analytics aggregates: 1hr. Rule of thumb: if data changes less than your cache TTL, you'll serve stale data. If it changes more often, caching gives little benefit. Also consider business impact of stale data — financial data needs shorter TTL than blog content.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **Cache hit rate** | % of requests served from cache vs. total requests |
| **Cache-aside** | App checks cache; miss = fetch DB + populate cache; write = invalidate key |
| **Write-through** | Write to cache and DB synchronously — always fresh, adds write latency |
| **Write-behind** | Write to cache immediately, async flush to DB — lowest latency, risk of data loss |
| **TTL** | Time To Live — how long a cache entry remains valid before expiry |
| **Cache stampede** | Many concurrent requests hitting DB simultaneously when a cache key expires |
| **Request coalescing** | Using a lock so only one request fetches from DB on cache miss; others wait |
| **Cache warming** | Pre-populating cache before it's needed to avoid cold-start latency |
| **Eviction policy** | LRU (Least Recently Used), LFU (Least Frequently Used) — how cache handles full memory |
| **CDN** | Content Delivery Network — geographically distributed cache layer for static/semi-static content |
