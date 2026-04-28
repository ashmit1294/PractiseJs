# T12 — Cache Invalidation

---

## 1. ELI5

Imagine you took a photo of your friend's whiteboard full of answers (that's your cache — a snapshot). You use your photo for quick reference. But when your friend erases and rewrites some answers, your photo is now **wrong** — it shows old information.

**Cache invalidation = figuring out when to tear up your old photo and take a new one.**

The hard part: knowing EXACTLY when the original whiteboard changed so you can discard the specific wrong parts of your photo, not all of it. If you throw away everything, that's wasteful (like clearing the entire cache every time). If you keep the old photo too long, you're working with wrong data.

> "There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton (Bell Labs)

---

## 2. Analogy

**Library book status system:**

A library catalog says "Pride & Prejudice is on Shelf 3-A." You take note of that (you've cached it). But the librarian might have:
- Moved it to Shelf 5-B (data changed)
- Loaned it out (data unavailable)
- Bought a new edition (data changed)

You won't know until you walk there and find it missing. That's a **cache miss after stale data** — the worst kind because your data was wrong, not just absent.

Good cache invalidation = the library sends you a text every time they move a book you have in your notes. That text = an invalidation event.

---

## 3. Invalidation Strategies

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Strategy 1: TTL-Based (Passive Expiry)                                     │
│                                                                            │
│ Every cache entry has a time-to-live; auto-expires and falls through to DB │
│ ✅ Simplest — no invalidation logic needed                                │
│ ✅ Always use as safety net (even with explicit invalidation)             │
│ ⚠️ May serve stale data for up to TTL duration                           │
│ ⚠️ No immediate freshness guarantee after data update                   │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ Strategy 2: Event-Based Invalidation (Active)                              │
│                                                                            │
│ App publishes invalidation event on write; consumers delete cache entry   │
│ ✅ Immediate freshness: cache cleared at same time data changes           │
│ ✅ Precise: only invalidates affected keys, not the entire cache          │
│ ⚠️ Complex: requires event bus, consumers, idempotency                  │
│ ⚠️ Risk: if delete event lost → stale data until TTL (TTL is backup)    │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ Strategy 3: Write-Through (Implicit — No Invalidation Needed)              │
│                                                                            │
│ Every write updates both cache and DB simultaneously                       │
│ ✅ Cache always reflects current DB state — no staleness window           │
│ ⚠️ Higher write latency (see T03)                                        │
│ Used by: Facebook TAO, financial systems                                   │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ Strategy 4: Cache-Aside with DELETE (Common Pattern)                       │
│                                                                            │
│ On write: write to DB → delete cache key (not update)                     │
│ Next read: cache miss → DB fetch → repopulate                             │
│ ✅ Simpler than write-through (no cache write on every DB write)          │
│ ✅ Cache automatically contains fresh data on next read                   │
│ ⚠️ One cache miss after every write (user who reads first does the work)  │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ Strategy 5: Cache Tags / Surrogate Keys (Group Invalidation)               │
│                                                                            │
│ Tag related cache entries; invalidate entire group in one operation       │
│ ✅ Most powerful: invalidate all pages referencing product X in one call  │
│ ⚠️ Requires tag tracking infrastructure                                  │
│ Used by: Varnish BAN, Fastly surrogate keys, Cloudflare cache tags        │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Why DELETE is Better than UPDATE on Invalidation

```
Pattern A — UPDATE cache on write (bad):
  app: db.update(product_id, newData)
  app: cache.set('product:123', newData)   ← update cache
  
  Race condition with concurrent reads:
  
  T1 (Writer A):   db.update(product_id, v2)
  T2 (Writer B):   db.update(product_id, v3)
  T3 (Writer B):   cache.set('product:123', v3)   ← arrives first
  T4 (Writer A):   cache.set('product:123', v2)   ← arrives second (network reorder)
  
  Result: DB = v3 (correct), Cache = v2 (STALE! Writer A's update won the cache race)
  
Pattern B — DELETE cache on write (correct):
  app: db.update(product_id, newData)
  app: cache.del('product:123')            ← just delete; don't put v2 in cache
  
  Next read: cache miss → DB fetch → fresh v3 from DB → cache populated with correct value
  
  Race condition:
  T1: db.update(v2) → cache.del('product:123')
  T2: db.update(v3) → cache.del('product:123')
  T3: read → miss → DB fetch → gets v3 (latest)
  
  Result: Delete is idempotent (del twice = same result). Safe under concurrency.
```

---

## 5. Event-Based Invalidation with Redis Pub/Sub

```
Architecture:

  Product Service (writes)
    │
    ▼ On product update:
  1. db.update(product) — DB write
  2. redis.publish('invalidate:products', productId)  — publish event
  
  ─────────────────────────────────────────
  
  API Server 1 (subscribed):          API Server 2 (subscribed):
  redis.subscribe('invalidate:products')  redis.subscribe('invalidate:products')
  On message: cache.del('product:'+id)    On message: cache.del('product:'+id)
  
  All API servers receive invalidation simultaneously
  All local in-process caches cleared for that product ID
  
  Node.js implementation:
  
  // Publisher (product update service)
  async function updateProduct(productId, data) {
    await db.updateProduct(productId, data);
    await redisPub.publish('cache:invalidate', JSON.stringify({
      type: 'product',
      id: productId
    }));
  }
  
  // Subscriber (all API server instances)
  const redisSub = redis.duplicate(); // separate connection for subscribe
  await redisSub.subscribe('cache:invalidate');
  redisSub.on('message', (channel, message) => {
    const { type, id } = JSON.parse(message);
    if (type === 'product') {
      localL1Cache.del(`product:${id}`);
      // Note: Redis L2 cache del happens at publisher (or here too for belt+suspenders)
    }
  });
```

---

## 6. Distributed Invalidation Challenge

```
Problem: 100 Redis nodes in a cluster. Product 123 updated.
         All 100 nodes may have cached "product:123".
         
Options:
  1. Delete from all nodes:
     for (node of allRedisNodes) { node.del('product:123') }
     Problems:
       - 100 operations / invalidation event
       - If 1 node fails: stale entry persists until TTL
       - Increases with cluster size
       
  2. Use Redis Cluster (hash-slot routing): 
     cluster.del('product:123')  → automatically routed to correct shard
     ✅ Only 1 node actually holds the key (by hash)
     ✅ One DEL operation regardless of cluster size
     But: doesn't invalidate in-process L1 caches on other servers
     
  3. Redis Pub/Sub broadcast:
     All servers subscribe; publish invalidation event → all L1 caches cleared
     ✅ Handles L1 (in-process) invalidation across N pods
     ✅ Scales to any number of pods
     ⚠️ Redis Pub/Sub: message delivered once, not persisted
         If a server is down during publish: misses the invalidation event
     Solution: TTL is the backstop (server comes back up → serves stale data → TTL expires → fresh)
     
  4. Version-based cache keys (strong approach):
     Store version number in DB with every entity
     Cache key: product:123:v5 (version number included)
     On update: update version in DB to v6
     Cache key: product:123:v6 → automatic miss (old key never found)
     Old key: product:123:v5 → TTL cleans it up
     ✅ No explicit invalidation needed — version change = new key
     ⚠️ Key proliferation: many old keys accumulate (TTL manages cleanup)
```

---

## 7. Cache Tags (Group Invalidation)

```
Problem: one product change may affect MANY cached responses:
  - Product detail page: /products/123
  - Category page: /products?category=electronics (lists product 123)
  - Search results: /search?q=headphones (includes product 123)
  - Homepage featured items: / (if product 123 is featured)
  
  When product 123 updates: need to invalidate ALL of the above URLs
  Without tags: must track each URL explicitly — unmaintainable
  
Solution — Cache Tags:
  On cache.set() for each URL, tag it with relevant entities:
  
  cache.set('/products/123', data, {
    ttl: 300,
    tags: ['product:123', 'category:electronics']
  });
  
  cache.set('/products?category=electronics', data, {
    ttl: 300,
    tags: ['category:electronics']
  });
  
  cache.set('/', data, {
    ttl: 60,
    tags: ['featured', 'product:123']    // if product 123 is on homepage
  });
  
  On product 123 update:
  cache.invalidateByTag('product:123')
  → ALL entries tagged 'product:123' invalidated in one operation
  → 3 URLs cleared simultaneously
  
  Tag storage: Redis SET for each tag containing all cache keys with that tag
    SMEMBERS tags:product:123 → ['/products/123', '/', '/api/products/123']
    Then: DEL each key + DEL tags:product:123
    
  Varnish BAN: same concept natively in VCL
  Fastly: Surrogate-Key header on responses
  Cloudflare: Cache-Tag header
```

---

## 8. Thundering Herd After Mass Invalidation

```
Scenario: deploy new version → clear ALL caches for safety
  t=0: redis.flushall()  — all 10M cache entries wiped
  t=1: 100,000 req/sec hit the service
       ALL requests = cache miss → ALL query the DB
       DB: designed for 5,000 queries/sec → receives 100,000/sec → DB dies

Prevention strategies:

1. TTL Jitter (most important):
   // Instead of: TTL = 3600 for all entries
   // Use: TTL = 3600 + random(0, 600) // spread expiry over 10 minutes
   const ttl = 3600 + Math.floor(Math.random() * 600);
   await redis.set(key, value, 'EX', ttl);
   → Mass invalidation spreads cache misses over 10 minutes instead of 1 second
   
2. Staggered re-warming (after planned invalidation):
   After flushall: run a cache warming script that pre-populates top-1000 keys from DB
   before opening traffic
   
3. Cache Stampede lock (per-key):
   On miss: check if another request is already fetching this key
   If yes: wait for that request to complete and use its result
   Nginx: proxy_cache_lock on
   Redis: SETNX-based lock (as in T05 refresh-ahead)
   
4. Probabilistic (XFetch style):
   Random early refresh prevents synchronized expiry in the first place
   (See T05 Refresh-Ahead for full XFetch implementation)
```

---

## 9. Node.js Implementation — Full Invalidation Pattern

```javascript
class CacheManager {
  constructor(redis) {
    this.redis = redis;
  }
  
  // Set with TTL + jitter (prevent synchronized stampede)
  async set(key, value, baseTtl = 300) {
    const jitter = Math.floor(Math.random() * (baseTtl * 0.1)); // ±10%
    const ttl = baseTtl + jitter;
    await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
  }
  
  // Delete single key
  async invalidate(key) {
    await this.redis.del(key);
  }
  
  // Delete all keys matching a pattern (use with caution — SCAN not KEYS)
  async invalidatePattern(pattern) {
    let cursor = '0';
    do {
      const [newCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys); // batch delete
      }
    } while (cursor !== '0');
    // Never use KEYS pattern in production — SCAN is non-blocking alternative
  }
  
  // Tag-based invalidation
  async setWithTags(key, value, tags = [], ttl = 300) {
    const pipeline = this.redis.pipeline();
    pipeline.set(key, JSON.stringify(value), 'EX', ttl + 60); // +60s for tag cleanup delay
    
    for (const tag of tags) {
      pipeline.sadd(`tag:${tag}`, key);          // add key to tag set
      pipeline.expire(`tag:${tag}`, ttl + 3600); // tag expires after entries do
    }
    
    await pipeline.exec();
  }
  
  async invalidateByTag(tag) {
    const keys = await this.redis.smembers(`tag:${tag}`);
    if (keys.length === 0) return;
    
    const pipeline = this.redis.pipeline();
    pipeline.del(...keys);       // delete all tagged keys
    pipeline.del(`tag:${tag}`);  // delete the tag index
    await pipeline.exec();
  }
}

// Usage
const cache = new CacheManager(redis);

// Product service
async function updateProduct(productId, updates) {
  await db.updateProduct(productId, updates);
  
  // Strategy: DELETE (not UPDATE) — safe under concurrency
  await cache.invalidate(`product:${productId}`);
  
  // Also invalidate category page (product appears in listing)
  await cache.invalidateByTag(`product:${productId}`);
  
  // Event-based: notify other servers to clear their L1 caches
  await redis.publish('cache:invalidate', JSON.stringify({
    type: 'product',
    id: productId
  }));
}
```

---

## 10. Real-World Examples

### Facebook TAO — Multi-Tier Invalidation

```
Facebook's social graph cache (TAO) handles invalidation at massive scale:

  Like event: User A likes Post B
  1. MySQL write (source of truth)
  2. TAO leader cache updated (write-through for this entity)
  3. Invalidation message broadcast to all TAO follower caches
     Each data center's TAO nodes: receive invalidation → del(post:B:likes)
  
  Scale: trillions of reads/day; hundreds of billions of invalidations/day
  
  Challenge: 100+ data centers × millions of cache entries × rapid writes
  Solution:
    - Async invalidation with at-least-once delivery (may invalidate twice — idempotent DEL)
    - 60-second TTL as backstop (if invalidation message lost → stale for max 60s)
    - Leader/follower cache topology for ordered invalidation
```

### Stripe — Event-Based Customer Data Invalidation

```
When customer payment method updated:
  1. DB write (customer object version bumped)
  2. Redis cache: DEL customer:{customerId}  (immediate)
  3. Event published to internal event bus:
     { type: 'customer.updated', id: customerId }
  4. Payment processing service: subscribes → invalidates local in-process cache
  5. API gateway: invalidates cached customer validation responses
  
  Result: all 5 Stripe microservices using customer data are invalidated
  within < 100ms of the update

  Why DELETE not UPDATE:
    Version bump in DB: v42 → v43
    If cache SET races with another read between steps 1 and 2:
    → DEL ensures next read gets v43 from DB
    → SET might store v42 (stale) if write arrives after a fresh DB read
```

---

## 11. Interview Cheat Sheet

**Q: What are the main cache invalidation strategies?**
> (1) TTL-based: auto-expire — always use as safety net. (2) Event-based: publish invalidation event on write → all consumers DEL the key. (3) Write-through: implicit — cache always current, no separate invalidation needed. (4) Cache-aside delete: on DB write, DEL cache key (not SET) — safe under concurrency. (5) Cache tags: group related keys, invalidate group in one call.

**Q: Why delete from cache on write rather than update?**
> Race condition safety. If two writers race: last writer's SET wins in cache regardless of which write landed in DB first. DELETE is idempotent and order-independent: two DEL calls = same result. After DEL, the next reader fetches from DB and gets the actual latest value.

**Q: What is a cache stampede and how do you prevent it?**
> Mass cache expiry (or flushall) causes all requests to miss simultaneously, flooding the DB beyond capacity. Prevention: (1) TTL jitter — randomize TTLs to spread expirations; (2) single-flight lock — only one request fetches from DB per key; (3) grace period — serve stale while one request refreshes (Varnish style); (4) cache warm-up script before opening traffic after planned invalidation.

**Q: How does tag-based invalidation work?**
> Each cache entry is tagged with the entity IDs it represents (e.g., product:123, category:electronics). A Redis SET stores all cache keys for each tag. On entity update, invalidate the tag → DEL all keys in the tag's SET. One operation wipes all cached responses that reference a changed entity regardless of URL.

---

## 12. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Cache Invalidation** | Process of removing or updating stale cache entries when underlying data changes |
| **TTL** | Time To Live — cache entry auto-expires after this duration; always use as backstop |
| **Event-Based Invalidation** | Publish event on data change → subscriber deletes cache entry |
| **Thundering Herd** | Mass simultaneous cache misses flooding the database |
| **TTL Jitter** | Randomize TTL values to spread expiry times and prevent synchronized stampede |
| **Cache Tags** | Labels on cache entries enabling group invalidation by entity type/ID |
| **Surrogate Key** | HTTP response header (Fastly) = cache tag for CDN-level group invalidation |
| **BAN** | Varnish mechanism: invalidate all cache entries matching a VCL boolean expression |
| **Single-Flight** | Pattern: only one concurrent fetch per cache key; all others wait for first result |
| **Write-Through** | Implicit invalidation: cache updated synchronously on every write |
| **Cache-Aside Delete** | On write: DEL cache entry (not SET) — safe under concurrent writes |
| **Stale Data** | Cache serving outdated information because the underlying data has changed |
| **Race Condition** | Two concurrent operations yielding different results depending on execution order |
| **SCAN** | Redis non-blocking iteration over keys (use instead of KEYS in production) |
