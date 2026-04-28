# T11 — Cache Eviction Policies

---

## 1. ELI5

Your cache can only hold a limited number of things — like a small whiteboard. When it's full and you want to write something new, you have to **erase something old first**.

Which thing do you erase? That's the **eviction policy** — the rule for deciding which cached item gets kicked out when the cache is full.

Common rules:
- **LRU**: erase the thing nobody has touched in the longest time ("Least Recently Used")
- **LFU**: erase the thing that was asked for the fewest times ("Least Frequently Used")
- **FIFO**: erase the oldest thing written, regardless of how often it's used
- **Random**: erase something at random

The best policy depends on what kind of data you're caching.

---

## 2. Analogy

**Your desk workspace:**

- **LRU** — files you haven't touched in a week get moved to a drawer. Whatever you've been using lately stays on the desk. (Most popular desk policy.)

- **LFU** — you count how many times you've used each file this month. The file you opened only once gets moved to the drawer. The file you open daily stays forever.

- **FIFO** — the oldest file on your desk gets moved away first, regardless of how often you use it. (Not great — you might move away a critical contract just because you've had it for a while.)

- **Random** — you pick a random file to move. Surprisingly effective when all files are roughly equally important.

---

## 3. Core Concept: Policy Comparison

```
┌─────────────────┬──────────────────────────────────────────────────────────────┐
│ Policy          │ Description + Characteristics                                │
├─────────────────┼──────────────────────────────────────────────────────────────┤
│ LRU             │ Evict the entry that was LEAST RECENTLY ACCESSED              │
│ (Least Recently │ Implementation: doubly-linked list + hashmap = O(1) get/set  │
│  Used)          │ Most effective for temporal locality (recent = likely needed) │
│                 │ Redis: allkeys-lru, volatile-lru                              │
│                 │ Good for: news feed, user sessions, recently viewed items     │
├─────────────────┼──────────────────────────────────────────────────────────────┤
│ LFU             │ Evict entry with LOWEST ACCESS FREQUENCY                     │
│ (Least          │ Tracks count of accesses per key                             │
│  Frequently     │ Frequency decays over time (stale counts reduced gradually)  │
│  Used)          │ Redis: allkeys-lfu, volatile-lfu (added in Redis 4.0)        │
│                 │ Good for: product catalog, music library, static resources   │
│                 │ (popularity is long-term, not just recent)                  │
├─────────────────┼──────────────────────────────────────────────────────────────┤
│ FIFO            │ Evict oldest INSERTED entry regardless of access pattern     │
│ (First In       │ Simple but usually poor hit ratios                           │
│  First Out)     │ Doesn't account for recency OR frequency                    │
│                 │ Rarely used for general caches; useful in stream buffers     │
├─────────────────┼──────────────────────────────────────────────────────────────┤
│ Random          │ Evict a randomly selected entry                              │
│                 │ O(1) eviction with minimal bookkeeping                       │
│                 │ Surprisingly competitive for uniform access patterns         │
│                 │ Redis uses randomized approximation for LRU/LFU (efficient)  │
├─────────────────┼──────────────────────────────────────────────────────────────┤
│ TTL-based       │ Entries expire automatically after set time period           │
│                 │ Redis volatile-ttl: evict soonest-expiring key first         │
│                 │ Acts as both invalidation AND eviction                       │
│                 │ Always pair with other policies as safety net               │
├─────────────────┼──────────────────────────────────────────────────────────────┤
│ ARC             │ Adaptive Replacement Cache                                   │
│ (Adaptive       │ Combines LRU + LFU, dynamically adjusts split               │
│  Replacement)   │ Self-tuning: adapts to workload changes automatically       │
│                 │ Used by: ZFS filesystem, enterprise storage arrays           │
│                 │ Complex to implement; not available in Redis                 │
└─────────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 4. LRU — Implementation Deep-Dive

```
LRU Data Structure: Doubly Linked List + HashMap

  HashMap:  key → node pointer (O(1) lookup)
  DLL:      ordered by recency (head = MRU, tail = LRU)

  GET "user:123":
    1. HashMap lookup: find node pointer O(1)
    2. Move node to head of list (mark as most recently used)
    3. Return value
    
  SET "product:456" (cache full):
    1. Remove node from tail (LRU entry)
    2. Delete from HashMap
    3. Insert new node at head
    4. Add to HashMap

  All operations: O(1)

  Visual:
  HEAD ←→ [product:X] ←→ [product:Y] ←→ [user:123] ←→ [product:Z] → TAIL
          ^                                                            ^
    Most Recently Used                                       Least Recently Used
    (accessed latest)                                       (will be evicted if full)
```

### LRU in JavaScript

```javascript
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map(); // JS Map preserves insertion order
    // Using Map's iteration order as the LRU order (last iteration = most recent)
  }
  
  get(key) {
    if (!this.map.has(key)) return -1;
    
    // Move to end (most recently used)
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value); // re-insert at end
    return value;
  }
  
  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key); // remove old position
    } else if (this.map.size >= this.capacity) {
      // Evict LRU: first key in Map (oldest insertion)
      this.map.delete(this.map.keys().next().value);
    }
    this.map.set(key, value); // insert at end (most recent)
  }
}

// Usage
const cache = new LRUCache(3);
cache.set('a', 1);  // [a]
cache.set('b', 2);  // [a, b]
cache.set('c', 3);  // [a, b, c]
cache.get('a');     // [b, c, a] — 'a' moved to end (MRU)
cache.set('d', 4);  // [c, a, d] — 'b' evicted (LRU)
```

---

## 5. LFU — How Frequency Counting Works

```
Problem with naive LFU: frequency counts never decrease
  If product X was viral yesterday (1M accesses), it stays in cache forever
  Even though nobody cares about it today
  "Cache pollution" — stale popular items crowd out current hot items
  
Solution: frequency decay (aging)
  Redis LFU implementation: uses probabilistic counter (Morris counter)
  Counter: 0-255 (8 bits) — logarithmic, not linear
  
  Formula for counter increment:
    p = 1 / (current_count × lfu_log_factor + 1)
    Increment counter with probability p
    → Counter increments fast when count is low, slowly when high
    → Approximates log(access_frequency) efficiently with just 8 bits
    
  Formula for decay:
    Every lfu_decay_time minutes: counter -= (minutes_since_last_access / lfu_decay_time)
    Keys not accessed recently have decreasing counters
    
  Redis config:
    lfu-log-factor 10       # default: higher = less steep counter growth
    lfu-decay-time 1        # default: 1 minute decay interval
    
  Result: LFU counter reflects RECENT frequency (not all-time frequency)
  Product X: popular yesterday (count=200) → not accessed today → count decays to 170, 140... → eventually evicted
  Product Y: newly popular today (count=50 after first hour) → counter growing → stays in cache
```

---

## 6. Redis `maxmemory-policy` Options

```
Redis eviction only activates when maxmemory is reached

Config (redis.conf):
  maxmemory 4gb                 # Redis uses max 4GB RAM
  maxmemory-policy allkeys-lru  # Evict any key using LRU when full

Available policies:
┌──────────────────────┬────────────────────────────────────────────────┐
│ Policy               │ Behavior                                       │
├──────────────────────┼────────────────────────────────────────────────┤
│ noeviction (default) │ Return OOM error on write when full            │
│                      │ ⚠️ Dangerous: app crashes if not handled       │
├──────────────────────┼────────────────────────────────────────────────┤
│ allkeys-lru          │ Evict any key LRU regardless of TTL            │
│                      │ ✅ Recommended for general caching             │
├──────────────────────┼────────────────────────────────────────────────┤
│ volatile-lru         │ Evict LRU key ONLY from keys WITH TTL set      │
│                      │ Keys without TTL: never evicted                │
│                      │ Use: mix of permanent + TTL keys in same Redis │
├──────────────────────┼────────────────────────────────────────────────┤
│ allkeys-lfu          │ Evict any key LFU (frequency-based)            │
│                      │ ✅ Better than LRU for catalog-style data      │
├──────────────────────┼────────────────────────────────────────────────┤
│ volatile-lfu         │ Evict LFU key only from keys WITH TTL          │
├──────────────────────┼────────────────────────────────────────────────┤
│ allkeys-random       │ Evict random key                               │
│                      │ Use: uniform access pattern, minimal overhead  │
├──────────────────────┼────────────────────────────────────────────────┤
│ volatile-random      │ Evict random key only from keys WITH TTL       │
├──────────────────────┼────────────────────────────────────────────────┤
│ volatile-ttl         │ Evict key with shortest remaining TTL first    │
│                      │ Use: want keys expiring soon to be evicted     │
└──────────────────────┴────────────────────────────────────────────────┘

Most common choice: allkeys-lru (simple, effective, handles all keys)
Alternative: allkeys-lfu (better for long-lived popularity patterns like music/product catalogs)
```

---

## 7. Monitoring Evictions

```
Redis INFO stats output:
  evicted_keys: 0           # total keys evicted since server start
                             # Should be near 0; rising = cache too small
  
  keyspace_hits: 1000000    # total successful cache hits
  keyspace_misses: 50000    # total cache misses
  
  Hit ratio = hits / (hits + misses) = 1000000 / 1050000 = 95.2%

  expired_keys: 200000      # keys removed by TTL expiry (normal, expected)
  
Alert thresholds:
  evicted_keys per second > 0 for extended period → increase maxmemory or add nodes
  hit_rate < 90% → either cache too small, TTLs too short, or wrong data being cached

Redis CLI monitoring:
  redis-cli monitor         # stream of all Redis commands (high overhead, debug only)
  redis-cli info stats      # stats snapshot
  redis-cli info keyspace   # key counts and TTLs per DB index
  
  # Track evictions in real-time
  watch "redis-cli info stats | grep evicted_keys"
```

---

## 8. When to Use Each Policy

```
LRU (allkeys-lru):
  ✅ User sessions (recent sessions = active sessions)
  ✅ Product pages (recently viewed products more likely re-viewed)
  ✅ News articles (yesterday's news becomes cold quickly)
  ✅ API response cache (recent endpoints likely called again)
  ✅ DEFAULT CHOICE for most web application caches

LFU (allkeys-lfu):
  ✅ Music/video streaming catalog (Spotify: Taylor Swift stays popular for months)
  ✅ Product catalog (bestsellers stay popular across time, not just recently)
  ✅ Static reference data (country codes, tax rates — accessed constantly, not just recently)
  ✅ When popular items have LONG-TERM popularity (weeks/months, not just today)

TTL-based (volatile-ttl):
  ✅ Mixed permanent + temporary data in same Redis
  ✅ Rate limiting keys (short TTL by nature)
  ✅ Session tokens with explicit expiry

Random (allkeys-random):
  ✅ Uniform access pattern (every item equally likely to be accessed)
  ✅ When minimal overhead is priority and access pattern is unknown
  ✅ Surprisingly competitive: studies show random ≈ LRU within 5% hit ratio for uniform access

FIFO:
  ✅ Stream buffers where time-ordering matters
  ✅ Job queues
  ❌ Not suitable for general caching (poor hit ratios for real-world skewed access)
```

---

## 9. Real-World Examples

### Spotify — LRU vs LFU Decision

```
Problem: 80 million songs in catalog
  Taylor Swift's songs: accessed 50M times/day (long-term popularity)
  New song by unknown artist: accessed 1M times/day for first week, then near zero
  
  With LRU:
    New viral songs spike in recency → push Taylor Swift's songs out
    Next day: Taylor Swift = cache miss (she's accessed 50M/day but wasn't "recent")
    → Wrong: LRU treats Taylor Swift as cold data
    
  With LFU:
    Taylor Swift: frequency score 255 (maximum — accessed billions of times total, decays slowly)
    Viral song: frequency starts at 0, grows to ~100 during viral week, then decays
    Taylor Swift always stays in LFU cache; viral song evicted after frequency decays
    → Correct: LFU respects long-term popularity
    
  Spotify lesson: LFU for content catalog, LRU for user activity data (sessions, recent plays)
```

### Redis Default — The noeviction Problem

```
Common production mistake:
  maxmemory 4gb
  maxmemory-policy noeviction   ← DEFAULT

  App runs normally... cache fills up to 4GB...
  Next write: Redis returns OOM error (ERR command not allowed when used memory > 'maxmemory')
  
  If app doesn't handle OOM error:
    → Unhandled exception → 500 errors → cascade failure
    
Prevention:
  1. Set allkeys-lru as default policy (safe: Redis degrades gracefully)
  2. Alert on evicted_keys > 0 (it means cache is too small)
  3. Set maxmemory to 80% of available RAM (leave 20% for Redis operations / replication)
```

---

## 10. Interview Cheat Sheet

**Q: What are the main cache eviction policies?**
> LRU (Least Recently Used): evict oldest-accessed entry — best for temporal patterns. LFU (Least Frequently Used): evict lowest-count entry — best for catalog/popularity patterns. FIFO: evict oldest-inserted — simple but poor hit ratio. Random: evict randomly — minimal overhead, surprisingly effective for uniform access. TTL-based: auto-expire by time — always use as safety net.

**Q: LRU vs LFU — which to use for a music catalog?**
> LFU. Music catalogs have long-term popularity bias (Taylor Swift is popular for months, not hours). LRU would evict her songs if something temporarily more recent comes along. LFU gives higher frequency scores to items accessed consistently over time. With frequency decay, recently-popular-but-fading items naturally lose cache space.

**Q: What happens if Redis maxmemory-policy is set to noeviction?**
> Redis returns OOM errors on writes when maxmemory limit is reached. If the application doesn't handle these errors, it causes 500 errors and potential cascade failures. Set `allkeys-lru` or `allkeys-lfu` instead to allow Redis to gracefully evict cold keys rather than hard-failing.

**Q: How does Redis implement O(1) approximate LRU?**
> Redis uses randomized approximate LRU — it samples 5 random keys (configurable `maxmemory-samples`) and evicts the LRU among those samples. True LRU requires a doubly-linked list with O(1) per operation; Redis's approximation trades slight accuracy for lower memory overhead (no 16-byte pointer per key). In practice, quality is close to true LRU with sample size ≥ 5.

---

## 11. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Cache Eviction** | Removing entries from a full cache to make room for new entries |
| **LRU** | Least Recently Used — evict the cache entry not accessed for the longest time |
| **LFU** | Least Frequently Used — evict the entry with the lowest access frequency counter |
| **FIFO** | First In First Out — evict the oldest inserted entry regardless of access pattern |
| **ARC** | Adaptive Replacement Cache — self-tuning hybrid of LRU + LFU |
| **maxmemory** | Redis config: total RAM limit; eviction activates when this is reached |
| **maxmemory-policy** | Redis config: which eviction algorithm to use when maxmemory is exceeded |
| **allkeys-lru** | Redis: apply LRU eviction to ALL keys (not just those with TTL) |
| **volatile-lru** | Redis: apply LRU eviction ONLY to keys that have a TTL set |
| **allkeys-lfu** | Redis: apply LFU eviction to all keys |
| **Frequency Decay** | LFU: reduce access frequency counters over time to prevent stale hot items |
| **evicted_keys** | Redis stat: keys forcibly removed due to memory pressure (should be near 0) |
| **Morris Counter** | Probabilistic logarithmic counter used by Redis for LFU — 8 bits per key |
| **Cache Pollution** | When rarely-needed items occupy cache space and evict genuinely hot items |
