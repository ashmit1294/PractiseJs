# T02 — Cache-Aside (Lazy Loading)

---

## 1. ELI5

You're a student looking up facts for a homework assignment.

- First you check your **desk notes** (cache). If the fact is there → use it instantly.
- If not on your desk → go to the **library** (database) and look it up.
- After finding it, write it on your desk note so you don't have to go to the library next time.
- When the fact changes (e.g., a country's population) → **throw away the old desk note** so next time you fetch the fresh data from the library.

That's cache-aside. **You** are in charge of checking, populating, and discarding cache entries. The library doesn't know or care about your desk notes.

---

## 2. Analogy

**Personal assistant with a sticky-note system:**

Your assistant has a folder of sticky notes for common answers. You ask "What's the CEO's phone number?" — they check sticky notes first. If found → instant answer. If not → they call HR (database), write the answer on a sticky note, and give you the answer. When the CEO changes their number → they rip out the old sticky note. Next request fetches fresh from HR.

Key detail: the *assistant* manages the sticky notes, not HR. HR doesn't know about the notes. This is "cache-aside" — the **application** manages the cache, not the database.

---

## 3. Core Concept

### Read Path

```
App checks cache:

  cache.get("user:123")
         │
    ┌────┴─────┐
    │  Cache   │
    │  (Redis) │
    └────┬─────┘
    HIT  │  MISS
    ◄────┘    │
 (<1ms)       ▼
           db.query("SELECT * FROM users WHERE id=123")
              │
              ▼                         (~50ms)
           cache.set("user:123", data, TTL=3600)
              │
              ▼
           return data to application

Subsequent requests: HIT → < 1ms (50-100× speedup)
```

### Write Path — Delete, NOT Update

```
User updates their profile:
  
  WRONG (race condition):
    db.update(user)
    cache.set("user:123", newData)   ← DANGER: concurrent write may overwrite with stale data
    
  CORRECT:
    db.update(user)        ← source of truth updated first
    cache.delete("user:123")         ← wipe stale entry
    
    Next read: cache miss → fresh DB fetch → cache.set()
    
Why delete and not update?
  Two concurrent writes at t=0 and t=1:
    Write A: DB update → cache.set(valueA)    ← set at 10ms
    Write B: DB update → cache.set(valueB)    ← set at 9ms (faster)
  Result: cache has valueA (older!) because A's cache.set arrived AFTER B's
  → STALE DATA permanently until TTL
  
  With delete: same scenario → both delete → next read = fresh DB fetch → correct
```

---

## 4. Implementation

### Node.js — Full Pattern with Error Handling

```javascript
const redis = require('ioredis');
const cache = new redis({ host: process.env.REDIS_HOST });

// READ: Cache-aside
async function getUser(userId) {
  const cacheKey = `user:${userId}`;
  
  // Step 1: Check cache (non-fatal if Redis is down)
  try {
    const cached = await cache.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached);                    // Cache HIT → < 1ms
    }
  } catch (err) {
    logger.warn('Cache read failed, falling back to DB', { err, cacheKey });
    // Cache is optimization, NOT requirement — continue to DB
  }
  
  // Step 2: Cache MISS — query database
  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (!user) return null;
  
  // Step 3: Populate cache
  try {
    await cache.set(cacheKey, JSON.stringify(user), 'EX', 3600);  // TTL: 1 hour
  } catch (err) {
    logger.warn('Cache write failed', { err, cacheKey });          // Non-fatal
  }
  
  return user;
}

// WRITE: Invalidate after DB update
async function updateUserBio(userId, newBio) {
  // Step 1: Write to source of truth first
  await db.query('UPDATE users SET bio = $1 WHERE id = $2', [newBio, userId]);
  
  // Step 2: Invalidate cache entry (delete, not update)
  try {
    await cache.del(`user:${userId}`);
  } catch (err) {
    logger.error('Cache invalidation failed', { err, userId });
    // Consider: retry queue (Bull) for guaranteed eventual invalidation
    // Without retry: stale data until TTL naturally expires
  }
}

// BATCH READ: Multi-get optimization
async function getUsersBatch(userIds) {
  const cacheKeys = userIds.map(id => `user:${id}`);
  
  // Single round-trip to Redis for all keys
  const cachedValues = await cache.mget(...cacheKeys);
  
  // Identify misses
  const missingIds = userIds.filter((id, i) => cachedValues[i] === null);
  
  if (missingIds.length > 0) {
    // Fetch missing in one DB query (IN clause, not N+1)
    const dbUsers = await db.query(
      'SELECT * FROM users WHERE id = ANY($1)',
      [missingIds]
    );
    
    // Backfill cache with pipeline (single network round-trip)
    const pipeline = cache.pipeline();
    for (const user of dbUsers) {
      pipeline.set(`user:${user.id}`, JSON.stringify(user), 'EX', 3600);
    }
    await pipeline.exec();
  }
  
  // Merge cached + fresh data
  return userIds.map((id, i) => 
    cachedValues[i] ? JSON.parse(cachedValues[i]) : 
    dbUsers?.find(u => u.id === id) || null
  );
}
```

---

## 5. ASCII Flow Diagrams

```
CACHE-ASIDE READ (first request — cache miss):

Client ──► App Server ──► cache.get("user:123") ──► Redis
                                                      │ null (miss)
                          ◄────────────────────────────
                          │
                          ├──► db.query(...) ──► PostgreSQL
                          │                       │ {id:123, name:"Alice", ...}
                          │    ◄──────────────────
                          │
                          ├──► cache.set("user:123", data, EX 3600)
                          │
Client ◄── {id:123, ...} ─┘       Total: ~55ms

─────────────────────────────────────────────────────

CACHE-ASIDE READ (subsequent request — cache hit):

Client ──► App Server ──► cache.get("user:123") ──► Redis
                          ◄── {id:123, name:"Alice"} ──┘   Total: < 1ms

─────────────────────────────────────────────────────

CACHE-ASIDE WRITE (invalidation):

Client ──► App Server ──► db.update(bio="New bio") ──► PostgreSQL
                          ◄── OK ───────────────────────
                          │
                          ├──► cache.del("user:123") ──► Redis
                          │    (entry wiped)
Client ◄── 200 OK ────────┘

Next read: cache miss → fresh DB fetch → correct data
```

---

## 6. Variants

### Write-Around (Ignore Cache on Write)

```
On write:  update DB only — don't touch cache
           Let TTL expire naturally
           
Use when:  data changes are not immediately visible (e.g. tweet impression counts)
           Twitter accepts minutes of staleness for non-critical stats
Downside:  stale data for up to TTL duration after writes
```

### Refresh-Ahead with Cache-Aside

```
Hot entry (e.g., celebrity profile) accessed millions of times:
  When TTL drops to < 20% of original:
    On any access → trigger ASYNC background refresh
    Serve current (slightly stale) cached value immediately
    Background job: fetch fresh DB data → cache.set() with new TTL
    
  Result: cache is perpetually warm; users never see a miss
  Cost: occasional extra DB query for hot data
  Facebook: explicit refresh for accounts with > 1M followers
```

---

## 7. When to Use / Avoid

```
✅ USE CACHE-ASIDE WHEN:
  ● Read-heavy workload: read:write > 10:1 (profiles, product pages, feeds)
  ● Eventual consistency is acceptable: users can see slightly stale data
  ● Power-law access: 10% of data = 90% of traffic (hot data self-selects into cache)
  ● Resilience matters: if cache down → graceful fallback to DB
  ● Fine-grained control needed: custom cache keys, partial caching, selective TTLs

❌ AVOID CACHE-ASIDE WHEN:
  ● Strong consistency required: financial transactions, inventory (oversell = disaster)
  ● Read:write ratio ≈ 1:1: constant churn → high miss rate → cache adds complexity, no gain
  ● Uniform access patterns: every record equally likely to be accessed → no hot data → cache wastes memory
  ● Very small dataset: if all data fits in DB response cache → simpler solutions exist

Anti-Patterns:
  ❌ No TTL + rely solely on invalidation → invalidation bug → stale forever
  ❌ Update cache instead of deleting on write → race conditions → wrong data
  ❌ Let cache exceptions propagate to users → cache is non-critical; catch and fallback
  ❌ Cache raw DB rows with all columns → cache huge objects when you need 3 fields → memory waste
```

---

## 8. Real-World Examples

### Facebook — Memcached + Lease Mechanism

```
Scale: billions of profile views/day; 99% served from Memcached

Basic cache-aside: too simple → stampede problem
  If Taylor Swift's profile cache expires → thousands of simultaneous misses →
  thousands of MySQL queries → MySQL overloads

Facebook's solution — lease mechanism:
  First miss: Memcached grants a "lease token" to one request
  That request: queries MySQL using the lease
  Other requests: Memcached returns "wait" (not null) → they wait ~ms
  Lease holder: sets cache with lease token → Memcached accepts → all waiters get data

Result: 
  1 MySQL query per cache miss (not N)
  Cache serves billions of requests; MySQL serves only writes + rare misses
  
Facebook also uses "stale leases": if a write invalidates the entry while a lease is held,
Memcached returns stale data rather than null → prevents consistent misses
```

### Instagram — Feed Cache with Async Invalidation

```
Problem: Instagram feed involves posts from 1000s of followed accounts
         Recomputing per request = impossible

Pattern: pre-computed feed cache per user
  key: feed:{user_id}
  value: JSON array of ranked post IDs (50-200 IDs)
  TTL: 5 minutes

Write path: new post published → fanout service → async queue
            queue consumers: cache.del("feed:{follower_id}") for each follower
            (async — doesn't block the post write)
            
Read path: cache.get("feed:{user_id}") → hit (95%) → return immediately
           miss → compute feed (expensive ML ranking) → cache.set() → return

Impact: 95% cache hit ratio; DB/ML ranking only for 5% of feed views
        During peak hours: 20× reduction in ML ranking calls
```

### Stripe — Rate Limiting via Cache-Aside

```
Per API key, per second rate limits:
  key: "ratelimit:{api_key}:{unix_timestamp_seconds}"
  value: request count (integer)
  TTL: 1 second (auto-expires, no cleanup needed)

Logic (cache-aside variation):
  count = cache.incr("ratelimit:{api_key}:{now}") or 1 if miss (cache.set with TTL=1)
  if count > limit → reject with 429
  else → allow request
  
Benefits:
  Only tracks ACTIVE API keys (lazy: key created on first request per second)
  No memory wasted on inactive keys
  TTL auto-expiry = no cleanup jobs needed
  Redis INCR is atomic → no race conditions
  
This is cache-aside in a non-obvious form: the "data" is a counter, not a DB row
```

---

## 9. Interview Cheat Sheet

**Q: Explain cache-aside pattern — read and write paths.**
> Read: (1) check cache, (2) if hit → return immediately, (3) if miss → query DB, (4) store result in cache with TTL, (5) return to caller. Write: (1) write to DB first, (2) delete (not update) cache entry. On next read, cache repopulates with fresh data from DB.

**Q: Why delete cache on write instead of updating it?**
> Updating the cache creates a race condition: if two writes happen concurrently, whichever cache.set() arrives last "wins" in the cache, even if it represents the older write due to network timing. Deletion is safe: the worst case is one extra cache miss, after which the next reader fetches fresh data. "Delete is idempotent; concurrent updates are not."

**Q: How does cache-aside handle cache failure?**
> Cache-aside degrades gracefully: wrap all Redis calls in try-catch; treat cache errors as non-fatal; fall back to DB for every request. The system is slower but stays up. This is a key advantage over write-through: when the cache is unavailable, write-through blocks writes, but cache-aside just bypasses the cache.

**Q: What is the cold-start problem?**
> After restart or deployment, the cache is empty → all requests miss → DB sees full traffic load → potential overload. Mitigation: (1) cache warming — pre-populate before routing traffic; (2) gradual traffic ramp-up; (3) TTL jitter on existing entries to prevent synchronized expiry.

---

## 10. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Cache-Aside** | App explicitly manages cache: check → miss → fetch → populate |
| **Lazy Loading** | Only cache data that is actually requested (vs pre-populate everything) |
| **Cache Invalidation** | Deleting stale cache entry after source data changes |
| **TTL Safety Net** | Always set TTL; even if invalidation fails, entry eventually expires |
| **Race Condition** | Concurrent writes producing inconsistent cache state |
| **Lease Mechanism** | Facebook's anti-stampede: only one "lease holder" queries DB |
| **Write-Around** | Skip cache invalidation on write; let TTL expire naturally |
| **Refresh-Ahead** | Async background refresh when hot entry's TTL is near expiry |
| **Graceful Degradation** | Cache failure → fall back to DB; system slower but functional |
| **Power-Law Distribution** | 80/20 rule — 20% of data = 80% of traffic; cache naturally captures hot items |
| **Pipeline** | Redis command batching — single network round-trip for multiple operations |
| **MGET** | Redis multi-get — fetch many keys in single round-trip |
