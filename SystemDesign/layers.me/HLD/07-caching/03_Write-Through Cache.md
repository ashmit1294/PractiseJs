# T03 — Write-Through Cache

---

## 1. ELI5

Imagine a bank with two ledgers: one fast notebook on the counter (cache) and one secure vault ledger (database). 

**Write-through** means: every time you write a transaction, the bank clerk updates BOTH the counter notebook AND the vault ledger **at the same time**, before telling you "transaction confirmed."

You never get "done!" until both are updated. This means the notebook is **always perfectly in sync** with the vault. Anyone reading from the fast notebook always gets current data.

The cost: every transaction takes a bit longer because you're waiting for both writes.

---

## 2. Analogy

**Google Docs auto-sync:**

When you type in Google Docs, it saves to your browser (cache) AND uploads to Google's servers (DB) simultaneously before showing the checkmark "All changes saved." 

You never see "saved locally" — it's BOTH or NOTHING. If the server save fails, it retries until it succeeds. This is write-through: writes are only confirmed when both stores have the data.

Compare to cache-aside where you'd write to the server first and the browser copy might be slightly stale.

---

## 3. Core Concept

### Write-Through Flow

```
Application → WRITE operation

    App Server
        │
        ▼
  ┌──────────────────────────────────────────────┐
  │              Write-Through Layer              │
  │  (could be cache library or app logic)        │
  │                                               │
  │  Step 1: Write to CACHE (Redis)               │
  │  Step 2: Write to DATABASE (synchronously)    │
  │  Step 3: When BOTH confirm → return success   │
  └──────────────────────────────────────────────┘
        │
        ▼
  Application receives SUCCESS

Result: cache and DB are always in sync (no staleness window)

READ after write:
  cache.get(key) → HIT immediately with fresh data → < 1ms
  No need to fetch from DB — write already populated the cache
```

### Comparison: Cache-Aside vs Write-Through

```
┌──────────────────┬──────────────────────────┬──────────────────────────┐
│ Property         │ Cache-Aside              │ Write-Through            │
├──────────────────┼──────────────────────────┼──────────────────────────┤
│ Write path       │ App: write DB → del cache│ Write cache + DB sync    │
│ Read path        │ App: check cache → miss  │ Always hits cache        │
│                  │ → DB → populate cache    │ (write already put it in)│
│ Consistency      │ Eventual (brief stale)   │ Strong (always in sync)  │
│ Write latency    │ Baseline (DB only)       │ Higher (+1-2ms cache RTT)│
│ Cache coldness   │ Miss until first read    │ Populated on every write │
│ Failed cache?    │ Degraded but functional  │ Write FAILS (blocking)   │
│ Memory usage     │ Only read data cached    │ ALL written data cached  │
│                  │ (hot data via lazy load) │ (even if never re-read)  │
│ Best for         │ Read-heavy, read > write │ Write-heavy, consistency │
└──────────────────┴──────────────────────────┴──────────────────────────┘
```

---

## 4. Write-Through + Read-Through (Common Pairing)

```
Write-Through on WRITES: data always reaches cache
Read-Through on READS:  app talks only to cache; cache fetches DB on miss

  ┌────────────────────────────────────────────────────────────────────┐
  │                     Application                                    │
  └───────────────────────────┬────────────────────────────────────────┘
                              │ All reads AND writes
                              ▼
  ┌────────────────────────────────────────────────────────────────────┐
  │                  Cache Library / Proxy                             │
  │    (e.g., Cache2k, NCache, custom Redis wrapper)                  │
  │                                                                    │
  │  WRITE: cache.set(key, value) ──► also writes to DB (sync)        │
  │  READ:  cache.get(key)        ──► if miss: auto-fetches from DB   │
  └───────────────────────────┬────────────────────────────────────────┘
                              │ Only on write / read miss
                              ▼
  ┌────────────────────────────────────────────────────────────────────┐
  │                     Database                                       │
  └────────────────────────────────────────────────────────────────────┘

App never directly calls the DB.
App always has up-to-date data in cache.
```

---

## 5. Write Latency Math

$$\text{Write latency} = \text{DB write latency} + \text{Cache write latency (parallel or serial)}$$

```
Typical numbers (same data center):
  DB write:    10-20ms
  Redis write: 0.5-1ms (same DC)
  
  Serial:   20ms + 1ms = 21ms   (1ms overhead — usually acceptable)
  Parallel: max(20ms, 1ms) = 20ms  (write cache + DB concurrently — same latency)
  
If cache is in another region (cross-DC):
  Redis write: 50-200ms  → significant overhead
  → Write-through not recommended across regions; use async replication instead
  
In-process cache (no network):
  Write to local map + DB: negligible overhead
```

---

## 6. Key Decision: Parallel vs Serial Write

```
Option A — Serial (simpler, safer):
  1. Write to cache
  2. Write to DB
  3. If DB fails: rollback cache + return error
  
  Problem: if step 1 succeeds but step 2 fails → cache has data DB doesn't
  Solution: wrap in distributed transaction OR delete from cache on DB failure

Option B — Parallel (faster):
  1. Write to cache AND DB simultaneously (Promise.all)
  2. If either fails: attempt rollback of the other
  
  Problem: partial failure — cache succeeds, DB fails (or vice versa) →
           inconsistent state until TTL expires
  Solution: idempotent retries + TTL as safety net

Option C — DB first (most consistent):
  1. Write to DB (source of truth)
  2. Write to cache
  3. If cache fails: return error OR accept stale cache (TTL will fix)
  
  Safest: DB is always authoritative; cache failure ≠ data loss
  This is close to hybrid with cache-aside write path
  ← Recommended for most production use cases

Facebook's TAO uses option C: DB write first → cache update → consistency guaranteed
```

---

## 7. Problem: Stale Cache on Write Failure

```
Scenario (serial write, cache-first):
  t=0: cache.set("user:123", dataA) → SUCCESS
  t=1: db.write(dataA) → FAILS (DB timeout)
  
  Now: cache has dataA, DB still has old data
  Next read: cache HIT → returns dataA (but DB doesn't have it!)
  If cache expires: next read → DB → returns OLD data
  → Data appears to disappear
  
Mitigation:
  1. DB-first write order (Option C above)
  2. On DB failure: delete from cache (don't leave stale data)
  3. TTL as safety net: even if cache failure, data expires and falls through to DB
  4. Use Redis MULTI/EXEC or Lua script for atomic cache + DB-pointer update
```

---

## 8. Write Amplification Problem

```
Write-through caches ALL writes to both cache AND DB:
  Even data that will NEVER be read again gets cached
  
Example: bulk import 1 million products at midnight (batch job)
  Write-through: 1M cache.set() + 1M db.insert()
  Cache now holds 1M products (most of which won't be accessed today)
  → Wastes cache memory; evicts actually-hot data
  
Solution: Write-through selective:
  Only apply write-through for data likely to be read soon
  Batch imports → skip cache (bypass write-through)
  User-triggered writes (profile update, order creation) → use write-through

Or: use write-behind (T04) for bulk writes — buffer and write async
```

---

## 9. Node.js Implementation

```javascript
// Write-Through wrapper for user service
class UserCacheService {
  constructor(redis, db) {
    this.redis = redis;
    this.db = db;
    this.TTL = 3600; // 1 hour
  }
  
  async getUser(userId) {
    const cacheKey = `user:${userId}`;
    
    // Read-through: cache handles miss automatically
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    
    const user = await this.db.query('SELECT * FROM users WHERE id=$1', [userId]);
    if (user) {
      await this.redis.set(cacheKey, JSON.stringify(user), 'EX', this.TTL);
    }
    return user;
  }
  
  async updateUser(userId, updates) {
    // Write-Through: Step 1 — write to DB first (source of truth)
    const updatedUser = await this.db.query(
      'UPDATE users SET name=$1, bio=$2 WHERE id=$3 RETURNING *',
      [updates.name, updates.bio, userId]
    );
    
    // Write-Through: Step 2 — update cache immediately (strong consistency)
    const cacheKey = `user:${userId}`;
    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(updatedUser),
        'EX',
        this.TTL
      );
    } catch (cacheErr) {
      // Cache write failure: delete stale entry (safer than leaving wrong data)
      logger.warn('Cache write failed after DB update, deleting stale entry', { userId });
      await this.redis.del(cacheKey).catch(() => {}); // best-effort delete
    }
    
    return updatedUser;
  }
}

// Example: write-through for shopping cart (strong consistency required)
async function updateCart(userId, cartItems) {
  await db.transaction(async (trx) => {
    await trx.query('DELETE FROM cart_items WHERE user_id=$1', [userId]);
    for (const item of cartItems) {
      await trx.query(
        'INSERT INTO cart_items(user_id, product_id, qty) VALUES($1,$2,$3)',
        [userId, item.productId, item.qty]
      );
    }
  });
  
  // After DB commit: update cache atomically
  const key = `cart:${userId}`;
  await redis.set(key, JSON.stringify(cartItems), 'EX', 1800); // 30 min
  // Next GET /cart → cache hit with fresh data immediately
}
```

---

## 10. Real-World Examples

### Facebook TAO — Write-Through for Social Graph

```
Data: friendships, likes, comments, post metadata
Pattern: Write-through + event-based cache invalidation

Write flow:
  User likes a post:
  1. Write to MySQL (source of truth)  ← DB first
  2. Write to TAO cache (all shards holding post:X like count)
  3. Broadcast invalidation to other TAO nodes
  
Result:
  - Cache always reflects DB state (strong consistency)
  - 99%+ read hit ratio (write-through eliminates cold reads)
  - TAO processes trillions of requests/day
  
Key advantage of write-through here:
  Social graph has extreme read skew — one post = millions of reads
  Write-through means the cache is warm the instant the post is created
  No cold start: creator's post is cached before the first reader arrives
```

### Amazon Product Catalog — Write-Through for Listings

```
Problem: product listings are written rarely but read millions of times
         Any product update should be immediately visible everywhere
         
Pattern: write-through with TTL safety net
  Seller updates price:
  1. DB write → price confirmed
  2. Cache updated immediately → next read sees new price
  TTL = 15 minutes (safety net if cache update silently fails)
  
Without write-through (pure cache-aside):
  Price update → DB write → cache DEL → next buyer reads MISS → DB → fresh price
  Problem: if cache DEL fails silently → 15 min of stale price = potential wrong charge
  Write-through is more reliable for consistency-sensitive data
```

---

## 11. Interview Cheat Sheet

**Q: What is write-through caching?**
> Every write is applied to both cache and database synchronously before returning success. Guarantees strong consistency: cache always reflects DB state. Trade-off: writes are slower (+1-2ms for cache write), and all written data consumes cache memory even if never re-read.

**Q: When does write-through beat cache-aside?**
> When consistency matters more than write performance. Use write-through for: financial data (cart totals, prices), anything where a user writes then immediately reads (profile update → reload profile page), social graph data with high read skew (millions of reads per write). Cache-aside is better for read-heavy workloads where brief staleness is acceptable.

**Q: What's the downside of write-through?**
> (1) Write amplification: every write hits both cache + DB, even bulk imports of data nobody will read soon. (2) Cache is unavailable = writes fail (in strict implementations). (3) Memory waste: caches everything written, not just hot data. Solution: be selective — only use write-through for frequently-read data; bypass cache for bulk operations.

**Q: Write-through vs write-behind — key difference?**
> Write-through: synchronous — both cache and DB updated before success is returned; no data loss risk but adds latency. Write-behind: asyncronous — write to cache first, DB update happens later; lowest write latency but risk of data loss if cache fails before async write completes.

---

## 12. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Write-Through** | Cache + DB updated synchronously on every write |
| **Strong Consistency** | Cache always reflects current DB state — no stale reads |
| **Write Amplification** | Each write goes to multiple stores (cache + DB) — more work per write |
| **Cache Warm on Write** | Write-through ensures cache is populated the moment data is written |
| **Read-Through** | Cache fetches DB automatically on read miss (often paired with write-through) |
| **Write-Behind** | Async write: cache first, DB updated later (T04) |
| **Serial Write** | Cache then DB sequentially — simpler but slower |
| **Parallel Write** | Cache + DB simultaneously — faster but harder to handle partial failures |
| **DB-First Write** | DB write before cache update — safest: DB is always authoritative |
| **TAO** | Facebook's write-through distributed cache for the social graph |
| **Write Bypass** | For bulk imports: skip cache write-through to avoid pollution |
