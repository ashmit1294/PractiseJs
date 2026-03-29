# 13. Bloom Filters: Space-Efficient Membership Testing

---

## TL;DR

A Bloom filter answers "Have I seen this before?" with two responses: **"definitely not"** or **"probably yes"**. It uses a bit array + multiple hash functions for 90–95% space savings vs a hash set. False positives possible, false negatives impossible. Tune: ~10 bits/element for 1% FPR.

> **Cheat Sheet**: Insert → hash k times → set k bits | Query → check all k bits → any 0 = definitely absent, all 1 = probably present | No deletions in standard variant | `m = -1.44 × n × ln(p)` | `k = 0.693 × (m/n)` | Rebuild when >50% bits set

---

## ELI5 — Explain Like I'm 5

Imagine a bouncer at an exclusive club with a **fuzzy memory and a tiny notepad**.

Instead of writing down every name, the bouncer checks three things:
1. "Are you wearing the VIP wristband?"
2. "Did you arrive in a black car?"
3. "Do you have the secret handshake?"

- If **any check fails** → "You're NOT on the list" (100% certain)
- If **all three match** → "You're PROBABLY on the list" (but could be a coincidence)

The notepad only has checkboxes, not names. MUCH smaller. But occasionally someone coincidentally passes all 3 checks without being on the list — that's a **false positive**. The bouncer trades perfect accuracy for a tiny notepad.

---

## The Analogy

> Bouncer with a fuzzy memory: checks 3 traits instead of a full list. Any failed check = definitely not on list. All pass = probably on list (small chance of false positive). Trades perfect accuracy for a notepad vs. a database.

---

## Core Concept

**Problem**: "Have I seen this item before?" — millions of times per second, minimal memory.

**Naive solution**: Hash set — exact, but stores every element. 10M URLs = 80 MB.

**Bloom filter**: A **fixed-size bit array** + **k hash functions**.
- Stores only probabilistic **evidence** of elements, not the elements themselves  
- 10M URLs → 12 MB at 1% FPR = **85% space savings**

```
Bit array (m bits), initially all 0:
  [0][0][0][0][0][0][0][0][0][0]...[0]

Insert "user_12345" with k=3 hash functions:
  h1("user_12345") = 42   → bit[42] = 1
  h2("user_12345") = 137  → bit[137] = 1
  h3("user_12345") = 901  → bit[901] = 1

Query "user_12345":
  Check bits 42, 137, 901 → all 1 → "PROBABLY present" ✓

Query "user_99999":
  h1("user_99999") = 15  → bit[15] = 0 → STOP
  → "DEFINITELY NOT present" ✓ (skip DB lookup)
```

---

## How It Works — Step by Step

```
Step 1: Initialize
  Bit array of size m, all zeros

Step 2: Choose k hash functions
  Fast, independent: MurmurHash3, xxHash (NOT SHA-256 — too slow)
  Trick: derive all k from just 2: hᵢ(x) = (h₁(x) + i × h₂(x)) mod m

Step 3: Insert element x
  Compute h₁(x)...hₖ(x) → get k positions
  Set all k bits to 1
  Time: O(k) ≈ O(1) since k is small constant

Step 4: Query element y
  Compute h₁(y)...hₖ(y)
  If ANY bit = 0 → "DEFINITELY NOT present" (true negative, 100% certain)
  If ALL bits = 1 → "PROBABLY present" (verify with DB if needed)

Step 5: Handle false positives
  Bloom filter says "probably yes" → do the expensive DB lookup to confirm
  Bloom filter eliminates 95–99% of lookups entirely
  10ms DB call vs 0.01ms bit check → massive win even with 1% FPR

Step 6: Monitor saturation
  When >50% of bits are set → FPR degrades rapidly → REBUILD
```

---

## The Math

### Optimal Bit Array Size

```
m = -n × ln(p) / (ln 2)²  ≈  -1.44 × n × ln(p)

n = elements to store
p = desired false positive rate (decimal)

Example: 1 million elements, 1% FPR
  m = -1.44 × 1,000,000 × ln(0.01)
  m = -1.44 × 1,000,000 × (-4.605)
  m ≈ 9,600,000 bits = 1.2 MB

  Compare: hash set of 1M 64-bit integers = 8 MB  →  85% savings
```

### Optimal Number of Hash Functions

```
k = (m/n) × ln(2)  ≈  0.693 × (m/n)

Example (from above, m=9.6M, n=1M):
  k = 0.693 × (9,600,000 / 1,000,000) = 0.693 × 9.6 ≈ 6.65 → round to k=7
```

### Verify Actual FPR

```
p = (1 - e^(-kn/m))^k

With m=9.6M, n=1M, k=7:
  p = (1 - e^(-7×1,000,000/9,600,000))^7
  p = (1 - e^(-0.729))^7
  p ≈ (0.518)^7 ≈ 0.0098 ≈ 1%  ✓
```

### Quick Reference — Bits Per Element

```
FPR       Bits/element   m for 10M elements
─────────────────────────────────────────────
10%       4.8            60 MB
1%        9.6            12 MB
0.1%      14.4           18 MB
0.01%     19.2           24 MB

Rule: each 10x reduction in FPR costs ~4.8 more bits/element
```

### Saturation Formula

```
fraction_bits_set = 1 - e^(-kn/m)

Rule: when >50% of bits are set → rebuild or scale
At saturation 75% → FPR jumps ~3–5x above target
```

---

## Error Guarantees — The Key Asymmetry

```
                     Bloom Filter Says:
                  ABSENT          PRESENT
               ┌──────────────┬────────────────┐
Actual  IS     │ FALSE NEG.   │ TRUE POSITIVE  │
present        │ IMPOSSIBLE ✓ │ (correct) ✓    │
               ├──────────────┼────────────────┤
Actual NOT     │ TRUE NEG.    │ FALSE POSITIVE │
present        │ (correct) ✓  │ (verify needed)│
               └──────────────┴────────────────┘

If it says NO  → trust it 100%  (no false negatives, ever)
If it says YES → verify with DB (could be a false positive)

USE Bloom filters when:
  ✓ False positives are cheap to verify (DB lookup, API call with fallback)
  ✓ False negatives are unacceptable (web dedup, security pre-filter)
  ✓ You have millions of elements and memory is constrained

DON'T USE when:
  ✗ Security-critical decisions (false positive = unauthorized access)
  ✗ Small datasets (<10K elements) — hash set is fine
  ✗ Need to retrieve actual element (Bloom only answers yes/no)
  ✗ Frequent deletions needed (standard variant has no delete)
```

---

## Variants

| Variant | Delete? | Memory | Use Case |
|---|---|---|---|
| **Standard** | No | 9.6 bits/elem (1% FPR) | Static datasets, append-only |
| **Counting** | Yes | 38.4 bits/elem (4× overhead) | Dynamic data with deletions |
| **Scalable** | No | ~10% overhead | Unknown/unbounded n |
| **Cuckoo Filter** | Yes | ~12 bits/elem | Delete + better performance |
| **Blocked** | No | ~10 bits/elem | CPU cache efficiency (CDN) |

> **MERN dev note**: Think of a standard Bloom filter like a MongoDB `Set` in memory but compressed — you can add and check presence, but you can't remove an entry or get the value back. A Counting Bloom filter is like MongoDB's `$inc` — decrement on delete. But at 4× cost, only worth it when deletions are frequent.

---

## Real-World Examples

### Google Chrome — Malicious URL Detection
- Filter contains ~2M known malicious URL hashes, 0.1% FPR, k=10, **3.6 MB total**
- 99.9% of URLs: bit check in <1ms → "definitely safe" → load page
- 0.1% false positives + actual malicious URLs → API call to Google Safe Browsing
- Saves **millions of API calls per second globally**

### Medium — Article Recommendation Dedup
- Each user has a Bloom filter for read article IDs (sized for 10K articles, 1% FPR = 120 KB)
- Check filter before generating recommendations → 95% fewer DB queries
- Recommendation latency: 200ms → 50ms
- Time-partitioned (last 30/31–90/90+ days) with decreasing FPR as history ages

### Cassandra / HBase — SSTable Lookup Optimization
- Every SSTable (immutable data file on disk) has a Bloom filter of its row keys
- Read request → check Bloom filter first
- "Definitely not in this SSTable" → skip disk seek entirely
- Eliminates majority of unnecessary disk I/Os for read-heavy workloads

> **MERN dev note — why Cassandra here (not MongoDB)?**
> Cassandra stores data in **SSTables** (immutable sorted files on disk) — a read must potentially scan many files. Bloom filters eliminate 99% of those scans. MongoDB uses **B-tree indexes** instead — already good at point lookups without a Bloom filter. Bloom filters are most valuable with LSM-tree storage engines (Cassandra, RocksDB, LevelDB) where data is spread across many immutable files.

### Akamai CDN — Edge Cache Membership
- Blocked Bloom filter (512-bit cache-line-aligned blocks), 0.5% FPR, fits in L3 cache
- Initial check: ~10ns vs ~100ns hash table lookup → 60% faster cache decision
- Rebuilt every 5 minutes to stay in sync with cache evictions

---

## Common Pitfalls

| Pitfall | Why it happens | Fix |
|---|---|---|
| **Bit saturation ignored** | Sized for initial n, keep inserting beyond it → FPR jumps 10× | Monitor fill rate; alert at 40%; rebuild at 50% |
| **Cryptographic hash functions** | Using SHA-256 for "security" → 100× slower, no benefit | Use MurmurHash3 or xxHash (10–50ns vs 500–1000ns) |
| **Correlated hash functions** | h₂(x) = h₁(x) + 1 → collisions cluster → actual FPR >> expected | Use double hashing: `hᵢ(x) = (h₁(x) + i×h₂(x)) mod m` |
| **Used for auth/security** | False positive = unauthorized access | Always verify with authoritative source for security paths |
| **Inconsistent distributed impl** | Each service independently implements (diff seeds, diff lib) → cross-service false negatives | Standardize hash function + seeds across all services |

---

## Interview Cheat Sheet

| Level | What to demonstrate |
|---|---|
| **Mid** | What it is + asymmetric error guarantees; calculate m and k from n and p; real examples (Chrome, Cassandra); know when NOT to use it |
| **Senior** | Variants (counting, scalable, cuckoo); saturation monitoring; distributed Bloom filter designs; cost analysis (memory saved vs false positive cost) |
| **Staff+** | Multi-tier filter architecture (L1 local, L2 distributed, L3 persistent); SIMD/cache optimizations; learned Bloom filters; org-level standardization |

---

## Common Interview Questions

1. **"How would you avoid duplicate URL crawling with a Bloom filter?"**
   - Size for expected URLs (100M URLs, 1% FPR = 120 MB, k=7)
   - Normalize URLs first (lowercase, sort params)
   - Check before queuing; insert after adding to queue
   - Partition by time-window to enable expiration; rebuild at 50% saturation
   - Distribute via hash-range partitioning for multi-node crawlers

2. **"When would you NOT use a Bloom filter?"**
   - Security/auth decisions (false positive = unauthorized access)
   - Small datasets (<10K elements) — overhead not worth it
   - Need to retrieve actual values
   - Very frequent deletions (use counting or cuckoo filter instead)
   - False positive verification is more expensive than memory savings

3. **"How do you handle deletions?"**
   - Option A: **Counting Bloom filter** — 4-bit counters, increment on insert, decrement on delete (4× memory)
   - Option B: **Time-partitioned filters** — separate filter per time window, drop whole filter on expiry
   - Option C: **Periodic rebuild** from authoritative source (nightly batch)
   - Option D: **Cuckoo filter** — native deletion, better performance than counting

4. **"How do you choose m and k?"**
   - Start with n (elements) and p (target FPR)
   - `m = -1.44 × n × ln(p)` → `k = 0.693 × (m/n)`
   - Round k to nearest integer; verify with `p = (1 - e^(-kn/m))^k`
   - Monitor saturation in production; rebuild when >50% bits set

5. **"Design a distributed Bloom filter"**
   - Small filter (<100 MB): replicate to all nodes, broadcast inserts via gossip
   - Large filter (>1 GB): partition by hash range, each node owns a shard (replicate 3×)
   - Hybrid: local filter per node (hot path) + global partitioned filter (cold path)
   - Consistency: eventual usually fine (temporary false negatives during propagation are acceptable since system is already probabilistic)

---

## Red Flags to Avoid

- ❌ "Bloom filters guarantee no false positives" — backwards! No false **negatives**, false positives are expected
- ❌ "More hash functions = lower FPR always" — past optimal k (`0.693 × m/n`), more k → HIGHER FPR (faster saturation)
- ❌ "Use SHA-256 for hash functions" — 100× too slow; cryptographic strength is irrelevant here
- ❌ "Bloom filters are always better than hash sets" — for small datasets, hash set is simpler and the memory difference is negligible
- ❌ "Use a Bloom filter for auth checks" — false positive = unauthorized access; never for security decisions

---

## Key Takeaways

- **"Definitely not" or "probably yes"** — false negatives impossible, false positives tunable (0.1%–5%)
- **`m = -1.44 × n × ln(p)`, `k = 0.693 × m/n`** — calculate and know these by heart
- **~10 bits/element at 1% FPR** vs 64 bits for a hash set → 85% space savings
- **No deletions** in standard variant — use counting, time-partitioned, or cuckoo filters
- **Rebuild when >50% bits set** — FPR degrades exponentially past that threshold
- **Fast hashes only** — MurmurHash3 / xxHash, not SHA-256
- Real uses: Chrome Safe Browsing, Medium dedup, Cassandra SSTable, Akamai CDN

---

## Keywords

`bloom filter` `probabilistic data structure` `bit array` `false positive` `false negative` `membership testing` `deduplication` `hash functions` `MurmurHash` `xxHash` `double hashing` `false positive rate (FPR)` `bit saturation` `counting bloom filter` `scalable bloom filter` `cuckoo filter` `blocked bloom filter` `quotient filter` `space-time tradeoff` `negative cache` `LSM tree` `SSTable` `HyperLogLog` `Count-Min Sketch` `approximate membership query (AMQ)` `web crawler dedup` `cache pre-filter`
