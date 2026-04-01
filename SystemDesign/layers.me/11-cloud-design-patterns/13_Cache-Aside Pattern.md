# T13 — Cache-Aside Pattern: Redis Lazy Loading

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/cache-aside-pattern

---

## ELI5 (Explain Like I'm 5)

You're a student doing homework. Instead of running to the library every time you need a fact, you keep a notepad next to you. First time you need a fact → run to the library (database), write it on the notepad (cache). Next time you need the same fact → check your notepad first. If it's there: use it. If your notes get old: erase and refresh from the library.

Cache-aside is that notepad system for your application.

---

## Analogy

**Bookmarked websites**: You visit a website every day. Instead of typing the URL every time, you save a bookmark (cache). When the website changes significantly, you refresh the bookmark. The bookmark is "aside" — it's your personal shortcut, not the website itself. The website (DB) is always the source of truth.

---

## Core Concept

Cache-aside (lazy loading) puts the **application in control** of cache management. Unlike write-through or write-behind (where the cache is in the write path), cache-aside treats the cache as a pure optimization layer:

- **Source of truth**: database always
- **Cache role**: speed optimization for reads only
- **On reads**: check cache → miss? → query DB → store in cache
- **On writes**: update DB → invalidate (or update) cache key

**Why this is the most common pattern** at Amazon, Facebook, Netflix: simplicity + graceful failure. If Redis is down, reads fall back to the DB automatically (slower but correct). Writes are never blocked by cache failures.

---

## ASCII Diagrams

### Read Flow: Hit vs Miss

```
CACHE HIT (1ms):
  User → App → [GET product:12345] → Redis: HIT → return cached JSON
  
CACHE MISS (50ms):
  User → App → [GET product:67890] → Redis: MISS
                                          │
                                          ▼
                                    PostgreSQL query (50ms)
                                          │
                                          ▼
                              [SET product:67890 {json} EX 300]  → Redis
                                          │
                                          ▼
                                    Return to user

At 10,000 req/s with 95% hit rate:
  9,500 req/s served at 1ms from Redis
  500 req/s hit the database at 50ms
  = saves 9,500 DB queries per second
```

### Write Flow: Invalidation

```
Inventory update: product 12345 stock 47 → 46

  App → [UPDATE products SET stock=46 WHERE id=12345] → PostgreSQL (20ms)
      → [DEL product:12345] → Redis (1ms)
      
Brief stale window: if a read hits between UPDATE and DEL:
  t=0ms  PostgreSQL updated (stock=46)
  t=10ms  READ arrives → still in cache (stock=47) ← stale!
  t=20ms  DEL product:12345 completes
  t=21ms  Next read: MISS → fetches stock=46 from DB ✅

TTL is safety net: even if DEL fails, data expires automatically.
```

### Cache Stampede Problem and Prevention

```
STAMPEDE (without prevention):
  t=0    product:12345 TTL expires
  t=1ms  1,000 concurrent requests arrive
  All → Redis MISS → all 1,000 query PostgreSQL simultaneously
  → Database CPU spikes → P99 latency explodes

PREVENTION 1: Probabilistic Early Expiration
  TTL = 300s remaining
  Request at TTL=25s: random() < 0.1 → proactively refresh
  10% of requests in last 30s refresh cache before expiration
  Other requests keep hitting warm cache → no stampede

PREVENTION 2: Lease-Based Locking (Facebook approach)
  First miss: SETNX product:12345:computing 1 EX 10
    → gets lease, queries DB, updates cache, DEL lock
  Concurrent misses: see lock exists
    → wait 50ms or return stale data
  Result: Only 1 DB query per expiry (vs 1,000)
  Reduced DB load by 25% during viral spikes at Facebook
```

---

## How It Works (Step by Step)

1. **Read — cache hit**: App generates key `product:12345`. Redis returns JSON in 1ms. No DB involved.

2. **Read — cache miss**: Redis returns nil. App queries PostgreSQL (50ms). App executes `SET product:12345 {json} EX 300` (5-min TTL). Returns data to user.

3. **Write — invalidation**: App executes UPDATE in PostgreSQL. Then executes `DEL product:12345`. TTL is a safety net for failed DELs.

4. **Cache key design**: Key must include ALL parameters that affect query result.
   - Product: `product:{id}`
   - User cart: `cart:user:{userId}`
   - Paginated search: `search:iphone:page:2:sort:price`
   - Netflix recs: `recs:user:123:device:tv:hour:2024010115` (includes time bucket for freshness)

5. **TTL configuration**: Safety net for missed invalidations. Product details: 5-min TTL (stock changes). Product descriptions: 1-hour TTL (rarely changes). Session: 30-min. Financial data: 60-second max.

---

## Variants

| Variant | How It Works | Pros | Cons |
|---------|-------------|------|------|
| **Standard Invalidation (Delete on Write)** | Write DB → `DEL cache_key` | Safest; no stale data post-write | Write causes cache miss; stampede risk on hot keys |
| **Write-Through Update** | Write DB → `SET cache_key new_value` | No cache miss after writes; warm cache | Race conditions with concurrent writes |
| **Refresh-Ahead** | Background process refreshes popular keys before TTL expires | Eliminates misses on hot keys | Complex; wasted refreshes for unpopular keys |
| **Versioned Keys** | Write to `product:12345:v2` and update pointer | Atomic; rollback support | Storage overhead; pointer indirection |

---

## Trade-offs

| Dimension | Cache-Aside | Write-Through | Write-Behind |
|-----------|------------|---------------|--------------|
| **Write speed** | Unaffected by cache | Slower (cache in write path) | Fastest (async flush) |
| **Read consistency** | Stale window after writes | Strong (immediate) | May serve very stale data |
| **Cache failure impact** | Reads slow, writes unaffected | Writes fail if cache down | Writes may be lost on crash |
| **Complexity** | Simple (most common) | Moderate | High (complex failure modes) |

**Cost vs hit rate**: At Amazon scale, 1% cache hit improvement on product pages → millions in DB cost savings. For a startup: cache top 10% hot keys with short TTLs. Don't over-cache.

---

## When to Use (and When Not To)

**Use when:**
- Read:write ratio is 10:1 or higher (product catalogs, user profiles, config data, CMS)
- Eventual consistency is acceptable — stale data window of milliseconds to minutes is fine
- You need cache failures to not break writes (graceful degradation)
- You control the data access layer (ORM/application layer)

**Avoid when:**
- Read-after-write consistency required (user updates profile, must see update immediately)
- Write volume equals read volume (cache invalidation overhead > benefit)
- Data has complex dependencies (updating one table should invalidate keys from 5 different tables — use event-driven invalidation or CDC instead)
- Framework/library handles DB access opaquely (hard to inject cache logic)

---

## MERN Developer Notes

```javascript
// Redis cache-aside with Node.js
const redis = require('redis').createClient();
const db = require('./db');

// READ — cache-aside
async function getProduct(productId) {
  const cacheKey = `product:${productId}`;
  
  // 1. Check cache
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached); // cache hit: 1ms
  
  // 2. Cache miss — query DB
  const product = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
  if (!product) return null;
  
  // 3. Populate cache with TTL (5 minutes)
  await redis.setEx(cacheKey, 300, JSON.stringify(product));
  
  return product; // 50ms total
}

// WRITE — delete-on-write invalidation
async function updateProductStock(productId, newStock) {
  // 1. Update DB (source of truth)
  await db.query('UPDATE products SET stock = $1 WHERE id = $2', [newStock, productId]);
  
  // 2. Invalidate cache (TTL is safety net if this fails)
  try {
    await redis.del(`product:${productId}`);
  } catch (cacheErr) {
    // Log but don't fail the write — TTL will expire stale data
    console.warn('Cache invalidation failed:', cacheErr.message);
  }
}

// STAMPEDE PREVENTION — lease-based locking
async function getProductSafe(productId) {
  const cacheKey = `product:${productId}`;
  const lockKey = `${cacheKey}:computing`;
  
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Try to acquire lease (NX = only set if not exists)
  const acquired = await redis.set(lockKey, '1', { NX: true, EX: 10 });
  
  if (!acquired) {
    // Another instance is computing — wait and retry or return stale
    await new Promise(resolve => setTimeout(resolve, 100));
    const retry = await redis.get(cacheKey);
    return retry ? JSON.parse(retry) : getProductFromDB(productId);
  }
  
  try {
    const product = await getProductFromDB(productId);
    await redis.setEx(cacheKey, 300, JSON.stringify(product));
    return product;
  } finally {
    await redis.del(lockKey); // release lease
  }
}

// Cache key builder — include ALL query parameters
function buildCacheKey(type, params) {
  const sorted = Object.keys(params).sort().map(k => `${k}:${params[k]}`).join(':');
  return `${type}:${sorted}`;
}
// buildCacheKey('search', { q: 'iphone', page: 2, sort: 'price' })
// → 'search:page:2:q:iphone:sort:price'
```

---

## Real-World Examples

| Company | Implementation | Key Detail |
|---------|---------------|-----------|
| **Amazon** | Product catalog (millions req/sec) | Key: `product:{asin}`, TTL: 5 min. ProbabilisticEarly expiration for viral products during flash sales (first request with TTL <30s refreshes). |
| **Facebook** | News feed post data (Memcached) | Key: `post:{postId}`. Lease system (SETNX computing flag): reduces DB load by 25% during viral spikes. Concurrent misses wait briefly vs. all hammering DB. |
| **Stripe** | API response caching (Redis) | Key: `api:customer:{id}:v{schemaVersion}`. 60-second TTL (financial data). Write-through update (not delete) for customer objects — write already has new state, eliminates post-write miss. Improved P99 latency by 40ms for update+read sequences. |
| **Netflix** | Movie metadata (EVCache) | Key: `recs:user:{id}:device:{type}:hour:{bucket}`. Time-bucket key prevents all users refreshing simultaneously. 30-second staleness acceptable (user won't notice slightly stale descriptions). |

---

## Interview Cheat Sheet

### Q: Why invalidate (DEL) instead of updating (SET) the cache on writes?
**A:** Three reasons: (1) Simplicity — DEL is always safe regardless of whether the write succeeded. (2) Race condition prevention — if two writes arrive in sequence, DEL+miss on next read always returns the latest DB value; UPDATE+UPDATE on cache could apply in the wrong order. (3) Wasted effort — if the data won't be read soon, updating the cache wastes compute; lazy loading (fill on next miss) is more efficient.

### Q: What happens if cache invalidation fails after a write?
**A:** TTL is the safety net. If `DEL product:12345` fails (Redis timeout, network error), the key will auto-expire when its TTL runs out. The maximum stale window = remaining TTL at the time of the failed invalidation. Log the failure, alert if invalidation failure rate exceeds threshold, but don't fail the write operation — the DB update already succeeded.

### Q: How do you prevent cache stampedes at scale?
**A:** Two main approaches: (1) Probabilistic early expiration: when TTL drops below 30s, 10% of requests proactively refresh. Prevents the synchronized expiry of many concurrent users. (2) Lease-based locking (Facebook): first miss acquires a lock (SETNX), queries the DB, updates cache, releases lock. Concurrent misses see the lock and wait or return stale data. Only one DB query per cache miss event.

### Q: How do you choose TTL values?
**A:** Balance staleness tolerance vs. hit rate. Short TTL → frequent misses and fresh data. Long TTL → high hit rate but potentially stale data. Rule: TTL should be less than the maximum acceptable staleness. Product stock: 5 minutes (tolerable stale window). Product description: 1 hour (changes very rarely). Financial data: 60 seconds maximum. Session data: match session timeout.

---

## Red Flags to Avoid

- Not mentioning TTL as safety net for failed invalidations
- Claiming cache-aside provides strong consistency (it doesn't — there's always a stale window)
- Ignoring cache stampede problem — this causes real production incidents
- Poor cache key design (missing query parameters means wrong cache key, wrong result)
- Using cache-aside for write-heavy workloads (invalidation overhead exceeds cache benefit)
- "If Redis is down, users see errors" — cache failure should gracefully fall back to DB

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Cache-Aside** | Application explicitly manages cache: check on read, populate on miss, invalidate on write |
| **Lazy Loading** | Populate cache only when data is actually requested (not pre-loaded) — same as cache-aside |
| **Cache Hit** | Requested data found in cache; served without DB query |
| **Cache Miss** | Requested data not in cache; must query DB and populate cache |
| **TTL (Time-To-Live)** | Expiration time for cached data; safety net for missed invalidations |
| **Cache Stampede** | Thundering herd when popular cache key expires — many requests simultaneously query DB |
| **Probabilistic Early Expiration** | Refresh cache before TTL expires (with some probability); prevents synchronized expiry |
| **Lease-Based Locking** | First cache miss acquires exclusive lock; concurrent misses wait vs. all querying DB |
| **Cache Key** | Unique identifier for cached data; must include ALL parameters affecting the result |
| **Invalidation** | Deleting or updating cached entry after source data changes |
| **Write-Through** | Cache is in the WRITE path — DB and cache updated synchronously; stronger consistency |
| **Write-Behind** | Write to cache immediately; async flush to DB; fastest writes but complex failure modes |
| **Cache Warming** | Pre-populating cache on startup to avoid cold-start stampede |
| **EVCache** | Netflix's distributed Memcached-based caching system |
| **Cold Start** | Period after deployment when cache is empty; all reads miss and hit the DB |
