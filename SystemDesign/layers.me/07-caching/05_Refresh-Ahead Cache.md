# T05 — Refresh-Ahead Cache

---

## 1. ELI5

Imagine your coffee machine pre-heats at 7:55 AM every morning because you always get coffee at 8:00 AM. It doesn't wait for you to press the button and THEN heat up (causing you to wait 3 minutes). It anticipates your request and is **ready before you ask**.

**Refresh-ahead** works the same way: the cache system predicts that a cache entry is about to expire, and refreshes it **before** the expiration — so users never experience a cache miss. You always get hot coffee (fresh cache data) instantly.

---

## 2. Analogy

**Newspaper delivery service (pre-fetch):**

The newspaper delivery person doesn't wait for you to open your door and ask "is the paper here?" If they know you read the paper every morning at 7:00 AM, they deliver it at 6:50 AM. By the time you walk to the door, the paper is already there.

Cache-aside = you open the door, find no paper (miss), call the printing press yourself, wait 10 minutes for delivery. That's the latency spike at cache expiry.

Refresh-ahead = the delivery person (background job) checks: "this paper expires in 5 minutes, I should pre-fetch the next edition now." You open the door → fresh paper → no wait.

---

## 3. Core Concept

### Refresh-Ahead Flow

```
Normal Cache (cache-aside TTL experience):
  t=0:   entry cached with TTL = 60s
  t=60:  TTL expires → MISS on next request
         user waits 50ms while DB is queried
         cache repopulated
  t=61:  next user gets cache hit
  
  → One user always gets slow response at TTL boundary (latency spike)

Refresh-Ahead Cache:
  t=0:   entry cached with TTL = 60s
  t=48:  background job detects: TTL < 20% remaining (< 12s)
         → async DB query begins
  t=49:  DB query completes → cache updated with new value + fresh TTL
  t=60:  TTL expires... but cache already has NEW data from t=49
  
  → Zero misses, zero latency spikes, continuous cache warmth
  
  Refresh trigger: TTL_remaining < threshold (e.g., 20% of original TTL)
```

### Trigger Mechanisms

```
Mechanism 1 — Access-triggered (most common):
  On every cache.get(key):
    if (remainingTTL / totalTTL < 0.2):   // < 20% TTL remaining
      if (not already refreshing):          // avoid stampede
        background_refresh(key)            // async, non-blocking
    return cached_value                    // still returns current (slightly stale but valid)

Mechanism 2 — Timer-based (scheduled):
  Every 10 seconds:
    Scan hot keys in cache
    For any key with TTL < 15s: background_refresh(key)

Mechanism 3 — Probability-based early expiration (XFetch):
  On cache.get(key):
    beta = 1.0  // controls aggressiveness (higher = earlier refresh)
    delta = time_to_recompute   // how long DB query takes (e.g., 50ms)
    rand = -delta * beta * ln(random())  // exponential distribution
    if (currentTime - rand >= expiryTime):
      refresh now (probabilistic — each request has small chance to refresh early)
    else:
      return cached value
      
  XFetch invented by Mignet et al. — used by SimCity servers
```

---

## 4. Types of Refresh-Ahead

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Access-Based Refresh                              │
│                                                                      │
│  Triggered by actual cache.get() calls when TTL drops below threshold│
│  ✅ Only refreshes data that is actually being accessed              │
│  ✅ No wasted DB queries for inactive keys                           │
│  ⚠️ First request after threshold triggers refresh (async) —        │
│     response still returns old value                                 │
│  ⚠️ Requires TTL remaining check on every cache.get()               │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                    Scheduled Background Refresh                      │
│                                                                      │
│  Cron or background thread scans known hot keys on a schedule        │
│  ✅ Guaranteed refresh even if traffic is light during refresh window│
│  ✅ Can batch multiple DB queries efficiently                        │
│  ⚠️ Must maintain "known hot keys" list (or refresh everything)     │
│  ⚠️ Wastes DB queries on keys that may have gone cold               │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                    Predictive Refresh                                │
│                                                                      │
│  ML model predicts next access time based on historical patterns     │
│  Refresh M minutes before predicted access time                      │
│  ✅ Most efficient: zero wasted queries, zero misses                 │
│  ⚠️ Complex — requires ML pipeline; overkill for most systems       │
│  Used by: Netflix recommendation pre-computation, CDN prefetch       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Refresh-Ahead vs Other Strategies

```
┌─────────────────────┬──────────────┬──────────────┬──────────────┐
│ Property            │ Refresh-Ahead│ Cache-Aside  │ Read-Through │
├─────────────────────┼──────────────┼──────────────┼──────────────┤
│ Cache misses        │ Near-zero ✅ │ On TTL expiry│ On TTL expiry│
│ Latency spikes      │ None ✅      │ On every miss│ On every miss│
│ Stale data served   │ Brief (async)│ No (always   │ No           │
│                     │ refresh      │ refetches)   │              │
│ Wasted DB queries   │ Possible ⚠️  │ No           │ No           │
│ Memory efficiency   │ High         │ Lazy (hot)   │ Lazy (hot)   │
│ Complexity          │ High ❌      │ Low ✅       │ Medium       │
│ Best for            │ Latency-     │ General      │ Simple       │
│                     │ sensitive hot│ purpose      │ read-heavy   │
│                     │ data         │              │              │
└─────────────────────┴──────────────┴──────────────┴──────────────┘

Stale window in refresh-ahead:
  Brief staleness possible between refresh trigger and completion
  (async refresh takes 50ms → for those 50ms, old data is served)
  TTL is fresh so users keep hitting cache with old value
  → Usually acceptable; if not, use write-through instead
```

---

## 6. The Refresh Stampede Problem

```
Anti-pattern: if ALL requests trigger background refresh at the same TTL threshold

  t=48: 10,000 req/sec all see TTL < 20%
        → 10,000 background DB queries fire simultaneously
        → DB receives 10,000 identical queries
        → Identical to cache stampede, just async

Prevention — background refresh with single-flight lock:

  In-flight tracking via Redis SETNX or local flag:
  
  async function maybeRefresh(key, ttlRemaining, totalTTL) {
    if (ttlRemaining / totalTTL > 0.2) return;       // not needed yet
    
    const lockKey = `refresh_lock:${key}`;
    const acquired = await redis.set(lockKey, '1', 'NX', 'EX', 30); // 30s lock
    
    if (!acquired) return;                            // another worker is refreshing
    
    try {
      const freshData = await db.fetch(key);          // single DB query
      await redis.set(key, JSON.stringify(freshData), 'EX', totalTTL);
    } finally {
      await redis.del(lockKey);                       // release lock
    }
  }
```

---

## 7. Node.js Implementation

```javascript
// Refresh-Ahead Cache Wrapper
class RefreshAheadCache {
  constructor(redis, options = {}) {
    this.redis = redis;
    this.refreshThreshold = options.refreshThreshold || 0.2; // 20% TTL remaining
    this.defaultTTL = options.defaultTTL || 300;             // 5 minutes
    this.inFlight = new Set();                               // prevent duplicate refreshes
  }
  
  async get(key, fetchFn) {
    const pipeline = this.redis.pipeline();
    pipeline.get(key);
    pipeline.ttl(key);
    const [[, value], [, ttl]] = await pipeline.exec();
    
    if (value !== null) {
      // Check if we should proactively refresh
      const remainingRatio = ttl / this.defaultTTL;
      if (remainingRatio < this.refreshThreshold && !this.inFlight.has(key)) {
        this._backgroundRefresh(key, fetchFn); // fire-and-forget
      }
      return JSON.parse(value); // return current value immediately
    }
    
    // Cache miss — synchronous fetch (unavoidable on cold start)
    return this._synchronousFetch(key, fetchFn);
  }
  
  async _backgroundRefresh(key, fetchFn) {
    this.inFlight.add(key);
    try {
      const freshData = await fetchFn(key);
      if (freshData) {
        await this.redis.set(key, JSON.stringify(freshData), 'EX', this.defaultTTL);
      }
    } catch (err) {
      console.error(`Background refresh failed for ${key}:`, err.message);
      // Don't throw — background refresh failure is non-fatal
    } finally {
      this.inFlight.delete(key);
    }
  }
  
  async _synchronousFetch(key, fetchFn) {
    const data = await fetchFn(key);
    if (data) {
      await this.redis.set(key, JSON.stringify(data), 'EX', this.defaultTTL);
    }
    return data;
  }
}

// USAGE
const cache = new RefreshAheadCache(redis, {
  refreshThreshold: 0.15, // refresh when < 15% TTL remains
  defaultTTL: 300
});

router.get('/products/:id', async (req, res) => {
  const product = await cache.get(
    `product:${req.params.id}`,
    (key) => db.findProduct(req.params.id)  // loader function
  );
  
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json(product);
  // Users never wait for DB query on TTL expiry — background refresh handles it
});
```

---

## 8. Real-World Examples

### Facebook — Celebrity Profile Refresh-Ahead

```
Problem:
  Beyoncé's profile is read millions of times/second
  Profile data: bio, follower count, verified status
  TTL = 10 minutes (to limit staleness)
  
  At t=10min without refresh-ahead:
  → All 8 million req/min hit cache MISS simultaneously
  → Cache stampede → MySQL death
  
Refresh-ahead solution:
  At t=9min 30sec (5% TTL remaining):
    Single background refresh fires
    DB query: SELECT * FROM users WHERE id=beyonce → 50ms
    Cache updated: new TTL = 10 more minutes
    
  t=10min: TTL "expires" but cache already has fresh data from t=9:30
  Result: zero misses, continuous 8M req/min served from cache
  
Combined with lease mechanism (from T02):
  Even if background refresh is in flight at exact expiry,
  lease prevents stampede on the brief gap
```

### Netflix — Home Page Row Pre-Computation

```
Data: "Trending Now", "Top 10 in Your Country", "Continue Watching"
  These are expensive to compute (aggregation over billions of events)
  Each row TTL = 5 minutes

Refresh-ahead schedule (cron-based):
  Every 4 minutes → pre-compute all home page rows for active users
    (users active in last 24 hours)
    
Result: when you open Netflix → home page loads in < 100ms
  Rows are always fresh (pre-computed < 1 minute ago)
  No user ever waits for real-time computation (would take seconds)
  
Memory cost: 200M active users × 10 rows × ~1KB = ~2TB of row cache
  → Netflix uses EVCache (modified Memcached) across hundreds of nodes
```

### CDN Prefetch for Video Content

```
    CDN doesn't wait for user to request video chunk
    Analytics: "Game of Thrones Season 8 premiere tonight → 50M viewers"
    CDN pre-warms all edge nodes with the first 3 episodes at 5 PM
    (before the 9 PM premiere air time)

    Refresh-ahead for video chunks:
    Each 4-second video segment has a 24-hour TTL
    At 23.5 hours (CDN monitors TTL): re-fetch from origin
    → Content never goes cold on popular edge nodes
```

---

## 9. Interview Cheat Sheet

**Q: What is refresh-ahead caching?**
> The cache system proactively refreshes hot entries before their TTL expires, typically when remaining TTL drops below a threshold (e.g., 20%). Users always get a cache hit; nobody waits for a synchronous DB fetch at TTL boundary. Trade-off: slightly stale data during async refresh, and wasted DB queries if refreshed data is never re-accessed.

**Q: When is refresh-ahead useful?**
> Extremely popular, latency-sensitive reads: celebrity profiles, home page content, trending lists, video content pre-fetch. Anywhere a cache miss causes a latency spike that's unacceptable. If even one user in a million sees a 200ms delay due to cache miss, refresh-ahead eliminates that.

**Q: What is the XFetch algorithm?**
> A probabilistic early expiration algorithm: each `get()` call has a random probability of triggering an early refresh, weighted by how close the TTL is to expiry and how long the DB recomputation takes. Prevents coordinated stampede — not all requests trigger at exactly the same threshold. Used in Redis via HGET + manual TTL logic.

**Q: What's the difference between refresh-ahead and read-through?**
> Read-through: synchronous — on cache miss, cache layer fetches DB and user waits. Refresh-ahead: async — background refresh fires before miss; user always served from cache. Refresh-ahead requires predicting/detecting that a key is about to expire; read-through is purely reactive.

---

## 10. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Refresh-Ahead** | Proactively refresh cache entry before TTL expires based on access frequency / TTL threshold |
| **TTL Threshold** | Percentage of TTL remaining that triggers background refresh (e.g., < 20% remaining) |
| **Background Refresh** | Async DB query that updates cache without blocking current user request |
| **XFetch** | Probabilistic early-expiration algorithm — random refresh trigger weighted by TTL closeness |
| **Single-Flight** | Pattern to ensure only ONE background refresh fires per key, preventing stampede |
| **In-Flight Set** | Record of keys currently being refreshed — prevents duplicate refresh calls |
| **Cold Start** | First cache.get() with no existing entry — synchronous DB fetch unavoidable |
| **EVCache** | Netflix's distributed cache (Memcached variant) used for refresh-ahead at massive scale |
| **Latency Spike** | The burst of slow response times that occurs when cache entries expire en masse |
| **Predictive Refresh** | ML-driven refresh-ahead — refreshes exactly M minutes before predicted next access |
