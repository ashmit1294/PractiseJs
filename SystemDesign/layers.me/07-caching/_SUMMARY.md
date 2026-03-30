# M7 — Caching: Quick-Review Summary

> 13 topics | Covers: All cache strategies, eviction policies, invalidation, CDN + client + DB + app-level caching

---

## Topics at a Glance

| # | Topic | Core Insight |
|---|---|---|
| T01 | Caching Overview | Hit = skip DB; hit ratio determines value; each tier has ~10× latency difference |
| T02 | Cache-Aside | App manages cache manually; lazy load on miss; most flexible pattern |
| T03 | Write-Through | Write cache + DB together; zero staleness; higher write latency |
| T04 | Write-Behind (Write-Back) | Write cache only → ACK → async flush to DB; fastest writes; data loss on cache crash |
| T05 | Refresh-Ahead | Proactively refresh hot entries before TTL expires; zero miss even for popular keys |
| T06 | Client-Side Caching | HTTP headers (Cache-Control, ETag) + Service Workers; reduces server load to zero for cached assets |
| T07 | CDN Caching | Edge PoPs cache static + dynamic content near users; TTL + purge API for invalidation |
| T08 | Web Server Caching | Nginx / Varnish cache full HTTP responses at reverse proxy layer |
| T09 | Database Caching | Buffer pool (InnoDB/pg) caches data pages in RAM; avoid repeatedly hitting disk |
| T10 | Application-Level Caching | Redis / Memcached; in-process L1 + distributed L2; use Redis data structures |
| T11 | Cache Eviction Policies | LRU / LFU / ARC / FIFO / Random / TTL — different access pattern winners |
| T12 | Cache Invalidation | Hardest problem in CS; TTL vs event-based vs tag-based; thundering herd risk |
| T13 | Read-Through Cache | Cache library handles DB fetches transparently; app only talks to cache |

---

## T01 — Caching Overview

**Why cache?** RAM access ≈ 100ns; SSD ≈ 100μs (1000×); remote DB ≈ 1–10ms (10,000×+).

```
Hit path:  Request → Cache HIT → return value   (100μs)
Miss path: Request → Cache MISS → DB read → write to cache → return (5–50ms)
```

### Cache Hit Ratio
```
Hit Ratio = Cache Hits / (Cache Hits + Cache Misses)

Hit ratio 80% → 80% of requests skip the DB
Hit ratio 95% → DB gets only 5% of traffic — critical for scale

Cold start: ratio low (0%) → warm up period needed
```

### Latency Reference Table (Phil's numbers)

| Store | Read Latency |
|---|---|
| CPU L1 cache | ~0.5 ns |
| CPU L2 cache | ~7 ns |
| RAM (in-process cache) | ~100 ns |
| Redis / Memcached | ~200 μs (network) |
| SSD sequential read | ~100 μs |
| Database query (warm) | ~1–5 ms |
| Database query (cold) | ~10–100 ms |
| Network request (same DC) | ~500 μs |

### Multi-Tier Cache Architecture
```
Browser Cache (L0)
    → CDN Edge / PoP (L1)
        → Reverse Proxy Cache / Nginx (L2)
            → App In-Process Cache — Map<string, value> (L3)
                → Redis / Memcached Cluster (L4)
                    → Database (disk) — last resort
```

---

## T02 — Cache-Aside (Lazy Loading)

**Application** manages cache reads and writes. Cache is just a dumb store.

### Read Path
```
1. Check cache for key
2. HIT  → return value ✅
3. MISS → query database
4.        write result to cache with TTL
5.        return value
```

### Write Path
```
Option A: Delete (invalidate) cache key after DB write ← preferred
Option B: Update cache on DB write ← risky (race conditions)
```

### Code Pattern
```javascript
async function getUser(userId) {
  const cacheKey = `user:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);           // HIT

  const user = await db.users.findById(userId);   // MISS → DB
  await redis.setex(cacheKey, 3600, JSON.stringify(user)); // populate
  return user;
}

async function updateUser(userId, updates) {
  await db.users.update(userId, updates);          // DB first
  await redis.del(`user:${userId}`);               // then invalidate
}
```

### Pros & Cons
| ✅ Pros | ❌ Cons |
|---|---|
| Only cache what's requested | Cache miss penalty (extra DB call) |
| Cache failure doesn't break writes | Risk of stale data between write and invalidate |
| App controls TTL and invalidation | Cache stampede on cold start or TTL expiry |

---

## T03 — Write-Through Cache

**Application writes to cache AND database in the same request** (synchronously). Cache is always in sync.

### Write Path
```
1. Write to cache AND database (atomic or in sequence)
2. Return success to client
```

```
Client → App → Cache.set(key, value) + DB.write(key, value) → ACK
```

### Pros & Cons
| ✅ Pros | ❌ Cons |
|---|---|
| Cache is always up-to-date (no stale reads) | Every write hits DB — higher write latency |
| Simple to reason about | Cache warms only with written data (cold cache on new keys still causes read miss) |
| Good for read-after-write consistency | Wasted cache space for data never read |

### Combination with Cache-Aside
Most systems combine write-through writes with cache-aside reads for best of both worlds.

---

## T04 — Write-Behind (Write-Back) Cache

**Write to cache only → ACK to client immediately → flush to DB asynchronously**.

```
Client → App → Cache.set("order:123", data)  → ACK immediately (< 1ms)
                  ↓ (async, batched)
              DB.write (100–500ms later)
```

### Async Flush Mechanism
- Background thread or scheduled job flushes dirty cache entries to DB
- Entries marked "dirty" flag on write, "clean" after flush
- Can **batch** many writes into one DB round-trip (e.g. 50 writes → 1 bulk INSERT)

### Pros & Cons
| ✅ Pros | ❌ Cons |
|---|---|
| Fastest possible write ACK | Data loss if cache crashes before flush |
| DB gets batched writes (less I/O) | Stale data in DB until flush |
| Absorbs write spikes | Complex to implement (dirty write tracking, retry on flush failure) |

> Best for: high-write, loss-tolerant (analytics counters, view counts, social likes).

---

## T05 — Refresh-Ahead Cache

**Proactively refresh cache entries before TTL expires**, based on predicted demand.

```
Entry written → TTL = 60s
At TTL × 0.8 (48s), background job sees "last_accessed < 5s ago" → fetch fresh data from DB
→ TTL reset, zero user-facing miss even when TTL expires
```

### Trigger Strategies
- **Time-based**: refresh at % of TTL remaining (e.g. 80% through)
- **Access-based**: if key was accessed recently, it's likely to be accessed again
- **Event-based**: DB change on upstream source triggers pre-fetch

### Pros & Cons
| ✅ Pros | ❌ Cons |
|---|---|
| Zero miss latency for popular keys | Extra background DB load (even for cold keys prefetched) |
| Smooth latency P99 (no TTL spike) | Complexity of tracking "hot" vs "cold" entries |
| Prevents thundering herd on popular TTL expirations | Stale data gap if refresh is slower than TTL expiry |

---

## T06 — Client-Side Caching

**Browser / Mobile caches assets locally** — server doesn't send the same bytes twice.

### HTTP Cache Headers

| Header | Purpose | Example |
|---|---|---|
| `Cache-Control: max-age=3600` | Cache for 1 hour; no re-validation needed | Static images |
| `Cache-Control: no-cache` | Must revalidate with server before use | HTML, API responses |
| `Cache-Control: no-store` | Never store (private data, banking) | Sensitive payloads |
| `ETag: "abc123"` | Content fingerprint | Send `If-None-Match: "abc123"` → 304 Not Modified |
| `Last-Modified` | Date-based revalidation | Send `If-Modified-Since` → 304 if unchanged |
| `Vary: Accept-Encoding` | Cache separately per encoding (gzip vs br) | Compressed responses |

### Revalidation Flow
```
Browser has cached response + ETag "v1"
  → GET /api/user/1 { If-None-Match: "v1" } →  Server checks if data changed
     HIT (unchanged):   ← 304 Not Modified, no body (0 bytes data transfer)
     MISS (changed):    ← 200 OK with new ETag "v2" and full body
```

### Content-Addressable URLs
```html
<!-- Cache forever with hash in filename — file changes = new URL = new cache entry -->
<script src="/static/app.abc123def.js" />  → Cache-Control: max-age=31536000, immutable
```

---

## T07 — CDN Caching

**CDN Edge PoP (Point of Presence)** serves requests nearest to the user, caching origin responses.

### Request Flow
```
User in Tokyo → CDN PoP Tokyo
   HIT: served locally (< 5ms)
   MISS: PoP fetches from Origin (Singapore) → stores locally → serves → next request is HIT
```

### Static vs Dynamic CDN Caching

| | Static Assets | Dynamic Content |
|---|---|---|
| Examples | Images, JS, CSS, fonts | API responses, personalized pages |
| TTL | Long (1 day – 1 year) | Short (1s – 60s) or no cache |
| Invalidation | Deploy new file with new URL (hash) | API purge call on content update |
| Cache key | URL path | URL + query params + headers (Vary) |

### Cache Invalidation via Purge
```
Content updated → call CDN Purge API with URL/tag/prefix
→ CDN invalidates matching cached entries across all PoPs
→ Next requests hit origin and warm the cache fresh
```

### CDN Headers
```http
Cache-Control: public, max-age=86400, s-maxage=604800
# s-maxage overrides max-age for CDN/proxy; max-age still applies to browsers
```

---

## T08 — Web Server Caching

**Reverse proxy (Nginx, Varnish) caches full HTTP responses** for identical requests.

```
Request → Nginx
  HIT:  return cached response (no app server touch)
  MISS: forward to App Server → App → DB → response → Nginx stores it → return
```

### Nginx Cache Config
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g;

server {
  location /api/ {
    proxy_cache my_cache;
    proxy_cache_valid 200 60s;           # cache 200 responses for 60s
    proxy_cache_key "$uri$is_args$args"; # cache key = URL + query
    proxy_pass http://app_server;
  }
}
```

### Varnish
- Purpose-built HTTP cache (all in RAM)
- VCL (Varnish Configuration Language) for fine-grained control
- Can handle 100K+ RPS on commodity hardware

### When to Use Web Server Cache
- Static HTML pages or API responses that are identical for many users
- High-traffic endpoints generating the same content
- Reduce app server and DB load without code changes

---

## T09 — Database Caching

DB engines cache data pages in RAM to avoid slow disk I/O.

### Buffer Pool / Shared Buffers

| DB | Cache Name | Setting |
|---|---|---|
| PostgreSQL | `shared_buffers` | Typically 25% of system RAM |
| MySQL / InnoDB | `innodb_buffer_pool_size` | Typically 50–75% of system RAM |
| MySQL (legacy) | `query_cache` | **Deprecated and removed in MySQL 8** (caused contention) |

```
DB reads data page from disk → stores in buffer pool
Subsequent reads → served from RAM (μs not ms)
Rule: Larger buffer pool = higher DB hit ratio = fewer disk reads
```

### Application-Side DB Caching
```
App → Redis (check for cached query result)
   HIT: return deserialized result
   MISS: execute DB query → store result in Redis with TTL → return
```

> Cache aggregations, slow cross-table joins, frequently-read reference data (country list, category list).

---

## T10 — Application-Level Caching

**App explicitly manages Redis or Memcached** to cache computed or fetched data.

### Redis vs Memcached

| | Redis | Memcached |
|---|---|---|
| Data structures | String, Hash, List, Set, Sorted Set, Stream | String only |
| Persistence | AOF + RDB snapshots | No (RAM only) |
| Clustering | Native Redis Cluster (hash slots) | Client-side sharding |
| Lua scripting | Yes (atomic multi-step ops) | No |
| Pub/Sub | Yes | No |
| Use case | Rich caching, sessions, queues, leaderboards | Simple string caching, high-volume |

### Two-Tier L1 + L2 Cache
```
In-process hashmap (L1) — 1μs access, bounded size (e.g. 1000 entries)
    ↓ miss
Redis cluster (L2) — 200μs, large/shared across all app instances
    ↓ miss
Database (L3) — 5–50ms
```
> L1 prevents Redis stampede on ultra-hot keys. Invalidate L1 via TTL (short, ~30s).

---

## T11 — Cache Eviction Policies

When cache is full, the eviction policy decides which entry to remove.

| Policy | Full Name | Rule | Best For |
|---|---|---|---|
| **LRU** | Least Recently Used | Remove entry accessed least recently | General-purpose; temporal locality |
| **LFU** | Least Frequently Used | Remove entry accessed least often | Long-lived data with clear hot/cold split |
| **ARC** | Adaptive Replacement Cache | Balances LRU and LFU automatically | Unpredictable access patterns |
| **FIFO** | First In, First Out | Remove oldest entry | Simple; queue-like data |
| **Random** | Random | Remove random entry | Simple; surprisingly competitive |
| **TTL** | Time-To-Live | Remove expired entries | Any cache with freshness requirements |

### Redis `maxmemory-policy` Options
```
noeviction       — return error when memory full (default; dangerous)
allkeys-lru      — evict any key by LRU ← most common
volatile-lru     — evict keys with TTL by LRU
allkeys-lfu      — evict any key by LFU
volatile-lfu     — evict keys with TTL by LFU
allkeys-random   — evict random key
volatile-ttl     — evict key with shortest remaining TTL
```

> For caching workloads, use `allkeys-lru` (never insert keys without TTL, or the eviction policy won't fire).

---

## T12 — Cache Invalidation

> "There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton

### Strategies

| Strategy | Mechanism | Best For |
|---|---|---|
| **TTL-based** | Key expires automatically after N seconds | Acceptable stale window |
| **Event-based** | DB update triggers DEL/SET on cache | Real-time freshness needed |
| **Write-through** | Every write updates cache + DB | Critical consistency |
| **Cache tags** | Group keys by tag; invalidate whole tag | Complex relationships (invalidate all "user:123:*") |

### Thundering Herd (Cache Stampede)
```
Popular key TTL expires at T+0
100 concurrent requests all get MISS at T+0
All 100 hit DB simultaneously → DB overwhelmed

Fixes:
1. Probabilistic early expiry — rebuild cache slightly before TTL (Refresh-Ahead)
2. Mutex / distributed lock — only 1 thread fetches from DB, others wait
3. Stale-while-revalidate — serve stale immediately, rebuild async
4. Short jitter on TTL — don't expire all keys at same moment
```

### Stale-While-Revalidate
```
Cache-Control: max-age=60, stale-while-revalidate=30
→ Serve stale for up to 30s after expiry while background fetch updates cache
→ User never waits; background fetch prevents gap
```

---

## T13 — Read-Through Cache

**Cache library (not application code) handles DB fetches on cache miss**.

### Flow
```
App calls: cache.get("user:123")
  HIT:  cache returns value directly ← same as cache-aside
  MISS: cache calls configured loader function → DB.query → stores result → returns value
```

### Read-Through vs Cache-Aside

| | Read-Through | Cache-Aside |
|---|---|---|
| Who fetches on miss? | Cache library / middleware | Application code |
| Code simplicity | App only talks to cache | App manually handles miss logic |
| Flexibility | Loader function is fixed per key type | Different logic per code path |
| First-request latency | Same (DB hit on cold entry) | Same |
| Error handling | Cache handles retry | App handles retry |

### Libraries That Implement Read-Through
- **Java**: Caffeine, Ehcache (with `CacheLoader`)
- **Node.js**: `cacheman`, `node-cache` with loader
- **Python**: `cachetools` with factory function
- **Redis clients**: Custom loader callbacks or look-aside helpers

---

## Cache Strategy Selection Guide

| Scenario | Strategy |
|---|---|
| DB is the bottleneck for reads | Cache-Aside or Read-Through |
| Cannot serve stale data | Write-Through |
| Extreme write throughput needed | Write-Behind / Write-Back |
| Popular keys causing stampede on TTL | Refresh-Ahead |
| Static files (JS/CSS/images) | Client-Side + CDN Caching |
| Identical API responses for many users | Web Server / Reverse Proxy Cache |
| DB data fits in RAM | Database Buffer Pool tuning |
| Caching complex computed objects | Application-Level (Redis) |

---

## Interview Cheat Sheet — M7

| Question | Answer |
|---|---|
| What is a cache hit ratio and why does it matter? | Fraction of requests served from cache without hitting DB; higher ratio = less DB load; 95% hit ratio means DB sees only 5% of traffic |
| What is cache-aside pattern? | App checks cache first; on miss fetches from DB and populates cache; on write deletes cache key after updating DB |
| Write-through vs write-behind — difference? | Write-through: write cache + DB synchronously (no data loss, higher latency); write-behind: write cache only, flush DB async (fast ACK, data loss risk on crash) |
| What is the thundering herd / cache stampede problem? | When a hot key's TTL expires, many concurrent requests all miss and hit DB simultaneously, overwhelming it |
| How do you prevent cache stampede? | Use mutex/lock so only one thread refreshes; refresh-ahead (proactive refresh before expiry); stale-while-revalidate; TTL jitter |
| LRU vs LFU — when to use each? | LRU: general-purpose, good when recent access predicts future access; LFU: better when some keys are consistently hot over long time |
| What is cache invalidation and why is it hard? | Deciding when to remove/update stale cache entries; hard because write + invalidate is not atomic, so race conditions can leave stale data |
| What does `Cache-Control: no-cache` mean? | Must revalidate with server before use — not "never cache"; opposite of `no-store` which means truly never cache |
| What is an ETag and how does it save bandwidth? | Server fingerprint for a response; browser sends `If-None-Match: ETag` → server returns 304 Not Modified (no body) if unchanged |
| What does `stale-while-revalidate` do? | Serves stale cached content immediately while background fetch updates cache; user never waits; freshness eventually maintained |
| Read-through vs cache-aside — difference? | Cache-aside: app code handles miss/load logic; read-through: cache library handles miss via configured loader function (simpler app code) |
| What is the Redis maxmemory-policy for caching? | `allkeys-lru` — evict any key by LRU when memory is full; never use `noeviction` for caches |
| What is a buffer pool in databases? | In-memory page cache inside the DB engine (InnoDB: `innodb_buffer_pool_size`, PostgreSQL: `shared_buffers`); caches data pages from disk for fast repeated reads |
| Write-behind vs write-through trade-off summary? | Write-through: consistency, higher latency, safe; write-behind: speed, lower latency, risk of data loss on crash |

---

## Keywords

`cache hit ratio` · `cache miss` · `cache warm-up` · `cache-aside` · `lazy loading` · `write-through` · `write-behind` · `write-back` · `refresh-ahead` · `read-through` · `thundering herd` · `cache stampede` · `mutex lock` · `stale-while-revalidate` · `TTL` · `ETag` · `Cache-Control` · `304 Not Modified` · `CDN` · `PoP` · `nginx proxy_cache` · `Varnish VCL` · `buffer pool` · `innodb_buffer_pool_size` · `shared_buffers` · `Redis` · `Memcached` · `allkeys-lru` · `LRU` · `LFU` · `ARC` · `eviction policy` · `cache invalidation` · `cache tags` · `L1 L2 cache` · `two-tier caching`
