# Back-of-the-Envelope Estimation for System Design

> **Source:** https://layrs.me/course/hld/01-introduction/back-of-the-envelope-estimation
> **Level:** Beginner | **Read:** ~10 min

---

## TL;DR (Cheat Sheet)

| Formula | Rule of Thumb |
|---|---|
| **QPS avg** | DAU × actions ÷ 86,400 |
| **QPS peak** | QPS avg × 10 |
| **Storage** | records × size × retention × 3 (replication) × 1.3 (overhead) |
| **Bandwidth** | QPS × response_size_bytes × 8 |
| **1M req/day** | ≈ 12 QPS avg, ≈ 120 QPS peak |

> **Memory is ~1,000x faster than SSD. SSD is ~100x faster than disk. Network is ~100,000x slower than RAM.**

---

## The Analogy — Chef Tasting a Dish

- A chef doesn't use lab equipment to measure sodium — they taste and adjust
- You don't need exact bytes — you need **directional correctness**
- Goal: know if you need **10 servers or 10,000 servers**, not the exact CPU utilization
- **"Good enough in 2 minutes" beats "precise in 20 minutes"** in interviews

---

## Core Concept

Back-of-the-envelope estimation turns "design Twitter" into concrete numbers:
- 500M DAU × 10 timeline loads/day = 5B reads/day = **57,870 read QPS avg** → **578,700 QPS peak**
- 200M tweets/day × 300 bytes = 60 GB/day raw → **~328 TB total** (3x replication, 5yr retention)
- These numbers drive decisions — not intuition

---

## Flowchart 1 — Estimation Workflow

```
System Design Problem (e.g., "Design Twitter")
        ↓
1. Clarify Scale Assumptions
   → DAU: 500M users
   → Actions: 10 timeline loads/day
   → Read:Write ratio: 100:1
        ↓
2. Calculate QPS
   → Daily requests: 500M × 10 = 5B
   → Average QPS: 5B ÷ 86,400 = 57,870
   → Peak QPS (×10): 578,700
        ↓
3. Estimate Storage
   → Data/request: 15 KB (timeline)
   → Daily writes: 200M tweets × 300B
   → Total (5yr, 3x replication): 328 TB
        ↓
4. Calculate Bandwidth
   → Response: 15 KB
   → Peak QPS: 578,700
   → Bandwidth: 578,700 × 15KB × 8 = 69.4 Gbps
        ↓
5. Validate Against Constraints
   → Latency budget: 200ms total
   → DB query: 50ms — within budget?
   → Cache hit rate needed: 80%?
        ↓
Design Feasible?
  → YES → Validated Design ✅
  → NO  → Adjust: Add caching, sharding, read replicas
```

---

## Power-of-Two Reference

| Unit | Value | Quick Math |
|---|---|---|
| **KB** | 2^10 ≈ 1 Thousand | 500M × 1KB = 500 GB (not 488.28 GB) |
| **MB** | 2^20 ≈ 1 Million | 200M tweets × 300B = 60 GB/day |
| **GB** | 2^30 ≈ 1 Billion | 1B req/day ÷ 100K sec = 10K QPS |
| **TB** | 2^40 ≈ 1 Trillion | |
| **PB** | 2^50 ≈ 1 Quadrillion | |

> **3% error between 1,000 and 1,024 doesn't change architecture decisions. Use 1,000.**

---

## Latency Numbers Every Engineer Must Know

| Operation | Latency | Design Implication |
|---|---|---|
| **L1 Cache** | 0.5 ns | |
| **L2 Cache** | 7 ns | |
| **RAM / Memory** | 100 ns | Cache hot data here — 1,000x faster than SSD |
| **SSD Read** | 150 μs (150,000 ns) | Use SSD-backed DBs |
| **Disk Seek** | 10 ms (10,000,000 ns) | Avoid spinning disks for latency-sensitive paths |
| **Network (same DC)** | 0.5 ms (500,000 ns) | Minimize inter-service calls |
| **Cross-continent** | 150 ms (150,000,000 ns) | Use CDN for global users |

> **Rule:** RAM is ~1,000x faster than SSD. Network is ~100,000x slower than RAM. These ratios explain **why caching exists and why CDNs exist**.

---

## Key Principles

### 1. Power-of-Two Approximations
- Treat 1,024 as 1,000 — it's fast and good enough
- Twitter: 200M tweets/day × 300B = 60 GB/day → 60 × 3 (replication) × 365 × 5 = **328 TB total**

### 2. Standard Latency Numbers
- If Netflix needs a 50ms recommendation response — they can't query disk (10ms seek per query)
- Must use in-memory cache (100ns RAM access) → justifies EVCache investment

### 3. Peak-to-Average Ratio
- Apply **10x multiplier** for instantaneous peak (viral events, New Year's Eve, breaking news)
- Design for peak, not average
- Uber: 10,000 avg QPS → must handle **100,000 QPS** on New Year's Eve

---

## Estimation Formulas

### QPS
```
Average QPS = (DAU × actions_per_user) ÷ 86,400
Peak QPS    = Average QPS × 10
```

### Storage
```
Storage = records × size_per_record × retention_days × replication_factor (3) × overhead (1.3)
```

### Bandwidth
```
Bandwidth_bps = QPS × avg_response_size_bytes × 8
```

### Availability (Nines)
```
Allowed downtime = total_time × (1 - availability%)

99%    = 2 nines → 3.65 days/year downtime
99.9%  = 3 nines → 8.76 hours/year
99.99% = 4 nines → 52.6 minutes/year
99.999%= 5 nines → 5.26 minutes/year

Redundancy formula: 1 - (1 - 0.999)^2 = 99.9999% with 2 independent DBs
```

---

## Flowchart 2 — URL Shortener Full Estimation (100M URLs/month)

```
Input: 100M URLs/month, Read:Write = 100:1, 500 bytes/URL

Write QPS:
  100M ÷ 30 days ÷ 86,400 = 38 writes/sec avg → 380 peak (10x)

Read QPS:
  38 × 100 = 3,800 reads/sec avg → 38,000 peak

Storage:
  Monthly raw: 100M × 500B = 50 GB/month
  10-year total: 50 GB × 12 months × 10 years × 3 replication = 18 TB

Bandwidth:
  Egress avg: 3,800 × 500B × 8 = 15.2 Mbps
  Egress peak: 38,000 × 500B × 8 = 152 Mbps peak

Architecture Decisions:
  38K peak read QPS > 10K single DB limit
  → Need Redis cache OR read replicas

Cache sizing (80/20 rule):
  18 TB × 20% = 3.6 TB cache → handles 80% of reads from memory
```

---

## Flowchart 3 — Latency Budget Validation

```
Target SLA: 100ms total

Component               Latency
─────────────────────────────────
Network (client → GW)   10 ms
Cache lookup (Redis)     1 ms
DB query (user data)    10 ms
DB query (posts)        10 ms    ← sequential
DB query (followers)    10 ms    ← sequential
Business logic          20 ms
Network (GW → client)   10 ms
─────────────────────────────────
Total:                  71 ms ✅ Within budget

If you add 2 more sequential DB calls:
  71 + 20 ms = 91 ms ✅ still OK
  71 + 30 ms = 101 ms ❌ FAILED

Solution: Parallelize DB queries OR cache more data
```

---

## Real-World Examples

| Company | System | Key Math |
|---|---|---|
| **Netflix** | Video Streaming | 250M hours/day → 144 Gbps avg bandwidth; 5,000 titles × 600 GB/title (120 formats) = 3 PB video storage → drove Open Connect CDN build |
| **Twitter** | Timeline Generation | 578,700 peak read QPS × 15 KB/timeline = 69.4 Gbps; fan-out would take 10s (1,000 DB queries × 10ms) → forced pre-computed Redis timelines (5ms for 1,000 keys) |
| **Uber** | Location Tracking | 5M drivers updating every 4s = 1.25M writes/sec; PostgreSQL max ~50K writes/sec → need 25+ shards → justified Schemaless → Cassandra migration |
| **Instagram** | Photo Storage | 100M photos/day × 2 MB × 1.3 overhead × 3 replication × 365 × 10yr = **8.5 PB** → justifies S3 not custom storage |

---

## Common Pitfalls

| Pitfall | Why It Happens | Fix |
|---|---|---|
| **Forgetting replication × overhead** | Calculate raw size only | Always ×3 (replication) ×1.3 (overhead) — state it explicitly |
| **Using average QPS for capacity** | 1K avg QPS system collapses at 10K peak | Always apply 10x peak multiplier |
| **Ignoring latency budget** | Designing 5 sequential DB calls for 100ms SLA | Create latency budget breakdown: total = sum of all hops |
| **Using exact numbers** | 1,024 instead of 1,000 slows math | Power-of-two shortcuts only in interviews |
| **Refusing to make assumptions** | Waiting for exact numbers | State assumptions out loud: "I'll assume 1KB per record" |

---

## Interview Cheat Sheet by Level

| Level | What They Expect |
|---|---|
| **Mid-Level** | Basic QPS + storage from DAU; knows power-of-two; accounts for replication |
| **Senior** | Full QPS + storage + bandwidth + latency budget validation; applies peak multiplier unprompted; challenges architecture with numbers |
| **Staff+** | Multi-dimensional: adds cost analysis, availability math, growth projections; identifies network bandwidth limits and connection pool exhaustion |

**Common Interview Questions:**
- "How many servers do we need to handle this load?"
- "What's total storage for 5 years of data?"
- "Calculate bandwidth cost for this video service"
- "If we cache 20% of data, what's cache size and hit rate?"
- "How many DB shards do we need for this write throughput?"

**Red Flags:**
- Refusing to estimate without exact input numbers
- Missing replication/overhead in storage estimates
- Designing for average load, ignoring peak
- Not validating latency budget against SLA
- Slowing yourself down with exact math (1,024 vs 1,000)

---

## Key Takeaways

- **Power-of-two shortcuts:** 2^10 ≈ 1K, 2^20 ≈ 1M, 2^30 ≈ 1B — 3% error never changes your architecture
- **Always apply 10x peak multiplier** — average load systems collapse when Twitter sends you a viral tweet
- **Latency hierarchy:** RAM (100ns) → SSD (150μs) → Disk (10ms) → Network (0.5ms DC, 150ms cross-continent) — these ratios explain why caches and CDNs exist
- **Storage formula:** raw × 3 (replication) × 1.3 (overhead) × retention — missing a multiplier = 3–10x underestimate
- **Validate against latency budget** — 5 sequential 10ms DB queries for a 50ms SLA fails before you write a line of code
