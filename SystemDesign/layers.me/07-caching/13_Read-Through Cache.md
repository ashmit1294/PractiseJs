# T13 — Read-Through Cache

---

## 1. ELI5

Imagine you're asking your smart assistant (Alexa/Siri) "What's the weather today?"

- First time: Alexa doesn't know, so she checks the Weather app and tells you.
- Second time (within the hour): Alexa already knows from before — she answers instantly without checking the app.
- Third time next morning: the weather info is stale, so she automatically checks the app again and gives you fresh info.

You only ever talk to Alexa — she handles all the "going to get the information" part transparently. That's **read-through caching**: you talk to the cache, the cache handles fetching from the source if needed.

Compare to **cache-aside** (T02): that's like YOU checking the Weather app yourself, and manually telling Alexa to remember it for next time. More control, but you do the work.

---

## 2. Analogy

**Research assistant at a library:**

You ask a research assistant for books. They:
1. Check their personal notes first (cache)
2. If not in notes: go to the library shelf, retrieve the book, write notes about it, then give it to you
3. Next time you ask for the same book: they hand it to you instantly from their notes

You never go to the shelf yourself. The research assistant's "notes" = the cache. The "going to the shelf" = the loader/populator function. The interface is unified — you just ask, they handle everything.

With **cache-aside** (the alternative): you'd go to the shelf yourself on every miss, then tell the assistant to write it down. More steps, but you control when and what gets written.

---

## 3. Core Concept

### Cache-Aside vs Read-Through

```
Cache-Aside (Application Controls Everything):
  
  Application code:
    const cached = await redis.get(`product:${id}`);
    if (cached) return JSON.parse(cached);
    
    const data = await db.find(id);         // app handles miss
    await redis.set(`product:${id}`, data); // app populates cache
    return data;

  → Application has 3 responsibilities: check cache, fetch DB, populate cache

Read-Through (Cache Library Controls Miss Handling):
  
  Application code:
    const data = await cache.get(`product:${id}`);
    return data;  // that's it — ONE LINE

  Cache library internally:
    if (cache.has(key)) return cache.get(key);
    const data = loaderFn(key);        // configured loader function
    cache.set(key, data);              // automatic population
    return data;
    
  → Application has 1 responsibility: call cache.get()
```

### Read-Through Architecture

```
     Application
         │
         │ cache.get('product:123')  ← single interface
         ▼
  ┌─────────────────────────────────────────────────┐
  │               Cache Layer                       │
  │  (library: Spring Cache, NestJS CacheManager,  │
  │   Guava LoadingCache, Cacheable npm, etc.)      │
  │                                                 │
  │  HIT:  return cached value immediately          │
  │                                                 │
  │  MISS: call loader function (configured once)   │
  │        store result in cache                    │
  │        return result                            │
  └──────────────────┬──────────────────────────────┘
                     │ only on MISS
                     ▼
              Database / API
```

---

## 4. Loader Function Pattern

```javascript
// Read-through setup: configure the loader function ONCE
// All cache.get() calls automatically use it on misses

const ReadThroughCache = require('cacheable');

const productCache = new ReadThroughCache({
  // Loader function: called on every cache miss
  // Cache library calls this, stores result, returns to caller
  load: async (key) => {
    const productId = key.replace('product:', '');
    const product = await db.query(
      'SELECT * FROM products WHERE id = $1',
      [productId]
    );
    return product.rows[0] || null;
  },
  ttl: 300,        // 5 minute cache TTL
  maxSize: 10000   // max entries in cache
});

// Usage — application code is clean, single line:
router.get('/products/:id', async (req, res) => {
  const product = await productCache.get(`product:${req.params.id}`);
  // ^ Cache checks → if miss: loader runs → DB queried → result cached → returned
  
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json(product);
});
```

---

## 5. Read-Through vs Cache-Aside — Trade-Offs

```
┌────────────────────────┬──────────────────────────┬──────────────────────────┐
│ Property               │ Read-Through             │ Cache-Aside              │
├────────────────────────┼──────────────────────────┼──────────────────────────┤
│ Application code       │ Simple (just cache.get)  │ More complex (3 steps)   │
│ Miss handling          │ Cache library does it    │ Application does it      │
│ Consistency logic      │ Centralized in loader    │ Scattered across app     │
│ Custom miss logic      │ Hard (library restricts) │ Full flexibility         │
│ Partial caching        │ Hard                     │ Easy (cache only fields) │
│ Multi-source fallback  │ Hard (loader = 1 source) │ Easy (try source 1,2,3)  │
│ Testing                │ Mock cache library       │ Mock cache + db calls    │
│ Framework support      │ Spring @Cacheable, NestJS│ Manual (any framework)   │
│                        │ CacheManager, etc.       │                          │
│ Stampede on cold start │ Library handles (usually)│ Application must handle  │
└────────────────────────┴──────────────────────────┴──────────────────────────┘

Choose Read-Through when:
  ✅ Cache-aside boilerplate is repetitive across many services
  ✅ Using a framework with built-in cache support (Spring, NestJS)
  ✅ Cache miss logic is simple (single DB query, no conditional logic)
  ✅ Want centralized TTL and population logic in one place

Choose Cache-Aside when:
  ✅ Need flexible miss handling (try Redis → try DB → try fallback API)
  ✅ Want to cache only specific fields, not entire DB rows
  ✅ Different TTLs per data type for same key pattern
  ✅ Building from scratch without a caching framework
  ✅ Need precise control over what goes into cache
```

---

## 6. Framework Implementations

### Spring Boot `@Cacheable` (Java)

```java
// Read-Through via annotation — loader is the method body
@Service
public class ProductService {
  
  @Cacheable(
    value = "products",           // cache name
    key = "#productId",           // cache key
    unless = "#result == null"    // don't cache null results
  )
  public Product getProduct(Long productId) {
    // This method body = the loader function
    // Only called on cache MISS; Spring handles HIT transparently
    return productRepository.findById(productId).orElse(null);
  }
  
  @CacheEvict(value = "products", key = "#product.id")
  public void updateProduct(Product product) {
    productRepository.save(product);
    // @CacheEvict: invalidates cache entry on write
  }
}
// Spring Cache + Redis config: application.yml
// spring.cache.type: redis
// spring.data.redis.host: localhost
// spring.cache.redis.time-to-live: 5m
```

### NestJS `CacheManager`

```typescript
// Read-Through via NestJS built-in CacheManager
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@Controller('products')
@UseInterceptors(CacheInterceptor) // automatic read-through for all routes
export class ProductsController {
  
  @Get(':id')
  @CacheKey('product')
  @CacheTTL(300)  // 5 minutes
  async getProduct(@Param('id') id: string) {
    // Interceptor checks cache first
    // If miss: this method runs, result is cached automatically
    return this.productsService.findById(id);
  }
}
```

### Node.js — `cacheable` / `cache-manager` Libraries

```javascript
const cacheManager = require('cache-manager');
const redisStore = require('cache-manager-ioredis');

const cache = cacheManager.caching({
  store: redisStore,
  host: 'localhost',
  port: 6379,
  ttl: 300
});

// Read-through wrapper function
async function getOrSet(key, fetchFn, ttl = 300) {
  return cache.wrap(key, fetchFn, { ttl });
  // cache.wrap:
  //   1. Check cache for key
  //   2. If MISS: await fetchFn() → store result → return
  //   3. If HIT: return cached value
}

// Usage: dead simple
router.get('/users/:id', async (req, res) => {
  const user = await getOrSet(
    `user:${req.params.id}`,
    () => db.findUser(req.params.id),  // loader — only called on miss
    600  // 10 minute TTL
  );
  res.json(user);
});
```

---

## 7. Read-Through + Write-Through (Full Transparent Cache)

```
The ultimate "transparent cache" pattern:
  - Read: cache handles misses automatically (read-through)
  - Write: cache updates DB automatically (write-through)
  - Application: only talks to cache, never to DB directly
  
  Application:
    cache.get('product:123')    → read-through handles miss
    cache.set('product:123', v) → write-through updates DB

  Cache library:
    on get: returns cache or fetches DB and caches
    on set: writes to cache AND DB synchronously
    
  Used in: NCache, Memorystore, Hazelcast, Apache Ignite
           (distributed in-memory data grids that sit in front of DB)
  
  Benefit: DB is completely hidden from application developers
  Risk: cache library becomes a critical dependency
       → If cache library has bug: both reads AND writes may be wrong
  
  Most practical setup: read-through for reads + explicit cache-aside invalidation for writes
  (write-through can be overkill — DEL on write is safer and simpler)
```

---

## 8. Cold Start Problem

```
Read-through caches start cold (empty on first deploy or restart)
All initial requests = cache miss → loader function called → DB query

Cold start scenarios:
  1. New deployment: 0 cached entries → first N minutes: all DB queries
  2. Cache server restart: cache emptied → sudden DB load spike
  3. New cache node added: empty node → more misses until warm
  
Mitigation:

Strategy 1 — Cache warming script (pre-deployment):
  Before deploy: script pre-populates hot keys
  node scripts/warmCache.js --top-products=1000
  → Top 1000 products cached before first user request arrives
  
Strategy 2 — Staggered deployment:
  Deploy 1 pod at a time (rolling update)
  Each pod starts cold but only handles fraction of traffic
  First pod: warms up → other pods reuse same Redis L2 cache
  
Strategy 3 — Write-through + read-through:
  Any write immediately populates the cache
  Non-written data: cold until first read (acceptable for tail data)
  
Strategy 4 — Persistence (Redis RDB/AOF):
  Redis saves snapshot to disk; on restart: reloads from snapshot
  Redis restarts warm (data from before restart)
  → No cold start for Redis restarts
  Configure: save 900 1 (save every 900sec if ≥1 key changed)
```

---

## 9. Real-World Examples

### Java / Spring at LinkedIn — `@Cacheable` at Scale

```
LinkedIn uses Spring Cache extensively with Redis backend
  
  Profile service:
    @Cacheable("profile") + @CacheEvict on profile update
    
  Result: 99%+ cache hit ratio for profile reads
  Profile views: 1.5 billion/day → ~15M cache misses/day (1%)
  → only 15M DB reads/day instead of 1.5B
  
  Key advantage of @Cacheable:
    Developers don't think about cache — they just annotate the method
    Consistent caching behavior across 200+ microservices
    Cache config (TTL, eviction) managed centrally in Spring config
```

### Guava LoadingCache (Java — In-Process Read-Through)

```
Used at Google internally for in-process caching:

  LoadingCache<String, User> userCache = CacheBuilder.newBuilder()
    .maximumSize(10_000)
    .expireAfterWrite(5, TimeUnit.MINUTES)
    .refreshAfterWrite(1, TimeUnit.MINUTES)  // also does refresh-ahead!
    .build(CacheLoader.from(userId -> userRepository.findById(userId)));
  
  userCache.get("user:123");  // read-through on miss
  
  Note: refreshAfterWrite = built-in refresh-ahead
    After 1 minute: next access triggers async refresh
    User never waits for synchronous DB query (after first access)
    
  Guava LoadingCache combines read-through + refresh-ahead in one library
```

---

## 10. Interview Cheat Sheet

**Q: What is read-through caching?**
> The application only interacts with the cache. On a cache miss, the cache library automatically calls a configured loader function to fetch data from the database, stores the result, and returns it. Application code is simplified to a single `cache.get(key)` call with no explicit miss-handling logic.

**Q: Read-through vs cache-aside — when to use each?**
> Read-through: when using a caching framework (Spring @Cacheable, NestJS CacheInterceptor) or when miss logic is simple and centralized. Cache-aside: when you need flexibility — different fallback sources, partial caching, or non-standard TTL logic per case. Cache-aside is more prevalent because it gives more control; read-through is popular with frameworks that abstract it away.

**Q: What is the cold start problem in read-through caches?**
> On new deployment or cache restart, the cache is empty. All initial requests miss → DB is queried directly. If traffic is high, the DB receives full traffic temporarily. Solutions: pre-warming scripts (populate hot keys before traffic), Redis persistence (cache survives restart), rolling deploys (previous pods warm the shared Redis cache for new pods), or write-through (writes automatically populate cache).

**Q: How does NestJS CacheInterceptor implement read-through?**
> The interceptor checks Redis before the route handler runs. On cache hit: returns cached value directly (handler never runs). On miss: handler runs normally, result is stored in Redis with configured TTL, then returned. The route handler becomes the "loader function" transparently.

---

## 11. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Read-Through** | Cache handles misses: on get() miss, cache library fetches DB, stores result, returns data |
| **Loader Function** | Callback configured in cache library, called on every cache miss to fetch from source |
| **@Cacheable** | Spring annotation implementing read-through: method body = loader, result auto-cached |
| **CacheInterceptor** | NestJS equivalent of @Cacheable — check cache before route handler, store after |
| **cache.wrap()** | node cache-manager method: check cache → if miss: run fetchFn → store → return |
| **LoadingCache** | Guava (Java) cache with built-in loader function — also supports refreshAfterWrite |
| **Cold Start** | Initial state where cache is empty; all requests miss until cache warms up |
| **Cache Warming** | Pre-populating hot cache keys before serving traffic (script or background job) |
| **Full Transparent Cache** | Read-through + write-through combined: DB completely hidden from application |
| **CacheLoader** | Guava concept: function that automatically loads values for missing keys |
| **refreshAfterWrite** | Guava: async background refresh triggered on access after time period (refresh-ahead) |
| **Rolling Deployment** | Deploy one pod at a time; each new pod gets warm cache from existing pods sharing Redis |
