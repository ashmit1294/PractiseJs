# M2 — Core Concepts: Quick-Review Summary

> 17 topics | Covers: Consistency, Availability, CAP, Distributed Algorithms

---

## Topics at a Glance

| # | Topic | Core Insight |
|---|---|---|
| T01 | Performance vs Scalability | Slow for 1 = performance; slow at scale = scalability |
| T02 | Latency vs Throughput | Little's Law: Throughput = Concurrency / Latency |
| T03 | Availability vs Consistency | When network breaks, you MUST choose one to sacrifice |
| T04 | CAP Theorem | P is mandatory; real choice is CP vs AP |
| T05 | Consistency Patterns | Spectrum: Weak → Eventual → Causal → Strong |
| T06 | Weak Consistency | Best-effort, no guarantees — sub-1ms writes |
| T07 | Eventual Consistency | Guaranteed convergence; inconsistency window exists |
| T08 | Strong Consistency | Every read sees latest write; quorum required |
| T09 | Availability Patterns | Redundancy + Failover + Replication = HA |
| T10 | Failover | Auto-switch from failed primary to healthy standby |
| T11 | Replication | Multiple data copies: master-slave or master-master |
| T12 | Availability in Numbers | Nines notation; sequential = multiply, parallel = 1-(1-A)ⁿ |
| T13 | Bloom Filters | Probabilistic membership — "definitely not" or "probably yes" |
| T14 | Consistent Hashing | Ring-based routing; only K/N keys move on topology change |
| T15 | Merkle Trees | Root hash = fingerprint; find diff in O(d × log n) |
| T16 | PACELC Theorem | CAP + the normal-operation latency vs consistency trade-off |
| T17 | Quorum | W+R>N = strong consistency; W+R≤N = eventual |

---

## T01 — Performance vs Scalability

| Problem | Symptom | Fix |
|---|---|---|
| **Performance** | Slow for 1 user | Optimize code, add index, fix query |
| **Scalability** | Fast for 1, broken at 1000 | Distribute load, horizontal scaling |

```
Vertical Scaling (performance): 4 CPU → 16 CPU → hits hard limit
Horizontal Scaling (scalability): ×1 → ×2 → ×10 → theoretically unlimited
```
> Requires **stateless** applications for horizontal scaling.

---

## T02 — Latency vs Throughput

**Key Formula (Little's Law)**:
$$\text{Throughput} = \frac{\text{Concurrency}}{\text{Latency}}$$

| Technique | Effect on Latency | Effect on Throughput |
|---|---|---|
| **Caching** | ↓ (faster responses) | ↑ |
| **Batching** | ↑ (first req waits) | ↑↑ (far fewer operations) |
| **Horizontal scaling** | same or ↓ | ↑↑ |

> Latency components: Network + Queue wait + Processing + DB query + Serialization.  
> Under load, **queue wait dominates**. Optimize the queue, not just the code.

---

## T03 — Availability vs Consistency

During a **network partition**, replicas must choose:
- Serve stale data → **Availability** (still responsive)
- Refuse requests → **Consistency** (accurate but down)

| Use Case | Model | Why |
|---|---|---|
| DNS, social feeds, like counters | Eventual | Stale OK; speed critical |
| Cassandra, DynamoDB | Tunable | Configure per-operation |
| Bank transfers, inventory, payments | Strong | Wrong data = catastrophe |
| Facebook Social Graph | Strong | Half-friendship = privacy violation |

> Design principle: **"Consistency à la carte"** — pay the coordination cost only where business logic demands it.

---

## T04 — CAP Theorem

```
         Consistency (C)
         /     ↑      \
        /   IMPOSSIBLE  \
       /   to have all 3  \
Availability (A) ——— Partition Tolerance (P)
```

- **P is mandatory** for distributed systems (networks always fail eventually)
- Real choice: **CP** (reject requests during partition) vs **AP** (serve stale data during partition)
- "CA" systems = single-node databases; unavailable during partitions

| System | Classification | Behaviour during partition |
|---|---|---|
| HBase, ZooKeeper | CP | Rejects requests |
| MongoDB (majority write) | CP | Rejects writes without quorum |
| Cassandra, Riak | AP | Serves stale data |
| DynamoDB | AP (tunable) | Eventual by default; strong reads optional |
| PostgreSQL (single-node) | CA | Fully unavailable during partition |

---

## T05-T08 — Consistency Spectrum

```
WEAK ←──────────────────────────────────────────► STRONG
  No guarantees    Eventual    Causal    Read-Your-Writes    Linearizability
  Memcached        DynamoDB   MongoDB  Session-based          Spanner
                   Cassandra  sessions  systems               PostgreSQL
```

| Model | Guarantee | Use When |
|---|---|---|
| **Weak** | No guarantees after write | VoIP, live video, caches, metrics |
| **Eventual** | All replicas converge; inconsistency window | Social feeds, analytics, view counts |
| **Causal** | Cause precedes effect for all observers | Chat (reply after message), comments |
| **Read-Your-Writes** | YOU always see your own writes | Profile updates, user settings |
| **Monotonic Reads** | Time never goes backward for you | RSS feeds, news |
| **Strong** | Every read returns most recent write | Payments, inventory, auth |

> Stronger consistency = more coordination = higher latency + lower availability.

### Write Flow Comparison
```
Eventual (10ms): Client → Any Replica → ACK  then async to others
Strong (66ms):   Client → Leader → sync ALL replicas → quorum met → ACK
```

---

## T09-T11 — Availability Patterns

### Three Building Blocks
| Component | Role |
|---|---|
| **Redundancy** | Multiple copies of components |
| **Failover** | Auto-switch on failure |
| **Replication** | Keep copies in sync |

### Active-Passive vs Active-Active

| Dimension | Active-Passive | Active-Active |
|---|---|---|
| RTO | 30s – 5min | Near-zero |
| Utilization | 50% (standby idle) | 100% |
| Cost | Lower | Higher |
| Consistency | Simple (1 writer) | Complex (conflict resolution) |

> **RTO** (Recovery Time Objective) = time to restored service  
> **RPO** (Recovery Point Objective) = max acceptable data loss

### Replication Types

| Type | Consistency | Performance | RPO |
|---|---|---|---|
| **Synchronous** | Strong — all replicas ACK before success | Slower writes | ≈ 0 (no data loss) |
| **Asynchronous** | Eventual — ACK immediately, replicate later | Faster writes | > 0 (may lose recent writes) |

---

## T12 — Availability in Numbers (Nines)

| Uptime | Downtime/Year | Cost Level |
|---|---|---|
| 99% | 87.6 h | $ |
| 99.9% | 8.7 h | $$ |
| 99.99% | 52 min | $$$ |
| 99.999% | 5.3 min | $$$$ |

**Sequential components** (chain = always worse):
$$A_{total} = A_1 \times A_2 \times A_3$$

**Parallel redundancy** (always better):
$$A_{parallel} = 1 - (1 - A_1)(1 - A_2)$$

> Two 99.9% components in parallel → 99.9999%

---

## T13 — Bloom Filters

**Purpose**: "Have I seen this before?" — sub-millisecond, minimal memory.

```
Insert "user_123":  hash3 functions → set 3 bits in bit array
Query  "user_123":  check 3 bits → all 1 → "PROBABLY present"
Query  "user_456":  check 3 bits → one 0 → "DEFINITELY NOT present"
```

- **False positives**: possible (bit collisions)
- **False negatives**: IMPOSSIBLE
- 10M URLs → 12 MB at 1% FPR (vs 80 MB hash set = 85% space savings)

**Formulas**:
$$m = -1.44 \times n \times \ln(p)$$
$$k = 0.693 \times \frac{m}{n}$$

> Use: DB existence checks (Cassandra, HBase, DynamoDB), URL deduplication, spam filtering, CDN cache existence.

---

## T14 — Consistent Hashing

**Problem with naive hashing**: `hash(key) % N` → when N changes, ~90% of keys must move → cache stampede.

**Solution**: Place both keys and servers on a circular ring (0 to 2³²-1). A key goes to the first server clockwise.

| Event | Keys that move |
|---|---|
| Add server (naive `% N`) | ~90% |
| **Add server (consistent hashing)** | **~1/N only** |

**Virtual nodes (vnodes)**: Each physical server gets 100–200 positions on ring → prevents hot spots from uneven distribution.

> Used in: DynamoDB, Cassandra, Redis Cluster, Memcached, CDN routing.

---

## T15 — Merkle Trees

**Purpose**: Efficiently find *what* differs between two replicas — not just *that* they differ.

```
Root Hash = fingerprint of entire dataset
Verify 1 item out of N: O(log N) hash comparisons (not O(N))
Find diff between replicas: O(d × log N) where d = number of differing items
```

> Used in: Bitcoin (SPV wallets), Git (commit integrity), Cassandra anti-entropy repair, DynamoDB cross-AZ sync.

---

## T16 — PACELC Theorem

**CAP** covers partitions (rare). **PACELC** adds the normal-operation trade-off:

> "If Partition → choose A or C. **Else** (normal) → choose Latency or Consistency."

| Class | Partition | Normal | Examples |
|---|---|---|---|
| **PA/EL** | Available | Low Latency | Cassandra, DynamoDB |
| **PA/EC** | Available | Consistent | MongoDB (majority writes) |
| **PC/EC** | Consistent | Consistent | PostgreSQL, HBase, Spanner |

> EL vs EC choice affects **every single request**. PA vs PC affects ~0.1% during partitions. Optimize for the common case.

---

## T17 — Quorum

$$W + R > N \Rightarrow \text{Strong Consistency}$$
$$W + R \leq N \Rightarrow \text{Eventual Consistency}$$

| Config (N=3) | W | R | Consistency | Latency |
|---|---|---|---|---|
| Max availability | 1 | 1 | Eventual | Minimum |
| **Standard (QUORUM)** | **2** | **2** | **Strong** | Moderate |
| Max consistency | 3 | 1 | Strongest | Slow writes |

**Why it works**: W+R > N guarantees the read quorum always overlaps with the write quorum by at least 1 node, which must have the latest value.

> Used in: DynamoDB (W+R), Cassandra (tunable), Zookeeper (leader quorum), PostgreSQL synchronous replication.

---

## Master Comparison: When to Use What

| If you need… | Use |
|---|---|
| Always respond, stale OK | AP system (Cassandra/DynamoDB eventual) |
| Never serve wrong data | CP system (Zookeeper/HBase/strong MongoDB) |
| Low write latency, OK with stale reads | Async replication |
| Zero data loss on crash | Sync replication |
| Membership check at high RPS, low memory | Bloom filter |
| Cache cluster rebalancing without stampede | Consistent hashing |
| Replica sync detection efficiently | Merkle trees |
| Normal-ops latency vs consistency choice | PACELC model |

---

## Interview Cheat Sheet — M2

| Question | Answer |
|---|---|
| CAP: what's the real choice? | P is mandatory; choose CP or AP |
| Eventual vs weak consistency? | Eventual GUARANTEES convergence; weak does not |
| Strong consistency write latency? | 10–100ms (vs 1–10ms eventual) due to quorum sync |
| Quorum formula? | W + R > N guarantees strong consistency |
| Bloom filter false negatives? | IMPOSSIBLE — they only have false positives |
| Consistent hashing advantage? | Only K/N keys move when a node joins/leaves |
| PACELC over CAP? | CAP only covers partitions (rare); PACELC also covers normal ops |
| Active-Passive vs Active-Active? | AP = simpler, cheaper, 30s RTO; AA = zero RTO, costly, needs conflict resolution |

---

## Keywords

`CAP` · `PACELC` · `eventual consistency` · `strong consistency` · `linearizability` · `quorum` · `W+R>N` · `bloom filter` · `consistent hashing` · `virtual nodes` · `merkle tree` · `anti-entropy` · `active-passive` · `active-active` · `RTO` · `RPO` · `replication` · `failover` · `sync replication` · `async replication` · `Little's Law` · `throughput` · `latency` · `performance` · `scalability`
