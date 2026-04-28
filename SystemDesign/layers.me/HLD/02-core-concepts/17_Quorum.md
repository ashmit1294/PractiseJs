# 17 — Quorum

> **Source**: https://layrs.me/course/hld/02-core-concepts/quorum  
> **Level**: Intermediate | **Read time**: ~11 min

---

## TL;DR

Quorum consensus ensures consistency in distributed systems by requiring a **minimum number of nodes (W for writes, R for reads)** to agree on each operation.

**The formula that matters**:

$$W + R > N \Rightarrow \text{Strong Consistency}$$
$$W + R \leq N \Rightarrow \text{Eventual Consistency}$$

| Config | Consistency | Availability | Latency |
|---|---|---|---|
| W=1, R=1 | Eventual | Maximum | Minimum |
| W=2, R=2, N=3 (QUORUM/QUORUM) | **Strong** | Tolerates 1 failure | Moderate |
| W=ALL, R=1 | Strongest | Low (fails if any node down) | Slow writes |

**One-liner for interviews**: *"Write to W nodes, read from R nodes; if W + R > N, read + write quorums always overlap — you're guaranteed to see the latest write."*

---

## ELI5 — Explain Like I'm 5

Imagine 5 friends (nodes) who all keep a copy of your phone number. You want to update it.

- You tell 3 friends (W=3). Three of them now have the new number.
- Later, your mom asks 3 friends (R=3) for your number.
- 3 + 3 = 6 > 5 → **at least 1 friend she asks was in your update group** → she always gets the new number. ✓

If you only told 1 friend (W=1) and your mom asked 1 friend (R=1), she might ask the wrong one. That's eventual consistency.

---

## The Analogy — Board Meeting

5 directors must approve a budget change.

- Require 3 signatures to approve (W=3)
- Require 3 directors to confirm before anyone executes (R=3)
- 3+3 > 5 → at least 1 director in the execution group definitely signed off ✓

If a director is sick, **sloppy quorum** = get a temporary signature from an alternate, with a sticky note ("give to the real director when they return") → **hinted handoff**.

---

## Core Concept — N, W, R

```
N = total replicas (replication factor)
W = write quorum (must ACK before write returns to client)
R = read quorum (must respond before read returns to client)

           Write                         Read
Client → Coordinator                  Client → Coordinator
              │                                   │
              ├──→ Replica 1 [ACK ✓]              ├──→ Replica 1 [v2, t2 ✓]
              ├──→ Replica 2 [ACK ✓] ← W=2 met   ├──→ Replica 2 [v2, t2 ✓] ← R=2 met
              └──→ Replica 3 [async]              └──→ Replica 3 [v1, t1] (stale)

              ✓ Return success                    ✓ Return highest timestamp: v2
```

### Why W+R > N Guarantees Consistency

```
N=5 replicas, W=3, R=3

Write quorum hits:  Replicas 1, 2, 3  (all have v2)
Read quorum hits:   Replicas 3, 4, 5

Overlap = W + R - N = 3 + 3 - 5 = 1 node
Replica 3 is in BOTH groups → returns v2 → coordinator picks highest version ✓

Even if 2 replicas return stale v1, at least 1 always returns v2.
```

---

## Quorum Configurations at a Glance

| N | W | R | W+R | Consistency | Failures tolerated |
|---|---|---|---|---|---|
| 3 | 1 | 1 | 2 | Eventual | Any |
| 3 | 2 | 1 | 3 | **Strong** | 1 write failure |
| 3 | 1 | 2 | 3 | **Strong** | 1 read failure |
| 3 | 2 | 2 | 4 | **Strong** | 1 failure either side |
| 3 | 3 | 1 | 4 | Strongest writes | 0 write failures (fragile) |
| 5 | 3 | 3 | 6 | **Strong** | 2 failures either side |
| 5 | 2 | 2 | 4 | Eventual | N/A |

**Rule of thumb**: QUORUM = ⌊N/2⌋ + 1 = majority. For N=3: QUORUM = 2. For N=5: QUORUM = 3.

**Fault tolerance**: a quorum system tolerates **min(N-W, N-R)** node failures.

---

## ASCII: Quorum Overlap (N=5, W=3, R=3)

```
                ┌───────────────────────────┐
                │  N = 5 Total Replicas     │
                │                           │
                │  [1] [2] [3] [4] [5]      │
                │   │   │   │   │   │       │
                │   └───┴───┘   │   │       │
                │  Write Q:    W=3           │
                │  R1, R2, R3 got v2        │
                │                           │
                │       └───┴───┘           │
                │      Read Q:  R=3         │
                │      R3, R4, R5 queried   │
                │                           │
                │  OVERLAP: R3              │
                │  W+R-N = 3+3-5 = 1 node  │
                └───────────────────────────┘

Coordinator reads R3 (v2), R4 (v1), R5 (v1) → picks highest → returns v2 ✓
```

---

## Fault Tolerance Table

| N | W | R | Max node failures tolerated |
|---|---|---|---|
| 3 | 2 | 2 | **1** (standard setup) |
| 5 | 3 | 3 | **2** (critical data) |
| 7 | 4 | 4 | **3** (extreme durability) |

Each extra replica doubles storage cost but adds one failure tolerance unit. Choose N=3 for cost efficiency, N=5 for critical data (DynamoDB global tables), N=7+ for mission-critical (financial ledgers).

---

## Math & Formulas

### Core Formulas

$$\text{Strong consistency: } W + R > N$$

$$\text{Majority quorum: } QUORUM = \left\lfloor \frac{N}{2} \right\rfloor + 1$$

$$\text{Fault tolerance: } \min(N - W, \; N - R)$$

$$\text{Write latency: } \max(\text{latency of W slowest replicas})$$

$$\text{Read latency: } \max(\text{latency of R slowest replicas})$$

### Worked Example

> Design a user profile service for 100M users. Need strong consistency, tolerate 1 AZ failure.

```
Choose: N=3 (one replica per AZ), W=2, R=2

Check strong consistency: W+R = 2+2 = 4 > N=3 ✓
Fault tolerance:          min(3-2, 3-2) = 1 AZ failure tolerated ✓

Latency: AZ latencies = [5ms, 10ms, 50ms (distant AZ)]
  Write: wait for 2 fastest = max(5ms, 10ms) = 10ms  ✓
  Read:  wait for 2 fastest = max(5ms, 10ms) = 10ms  ✓
  (Slow 50ms AZ won't block quorum — graceful degradation)

Storage: 100M users × 10KB × 3 replicas = 3 TB total
```

### Write Quorum Mode Trade-offs

```
W=ALL → all 3 must ACK before success
  ✅ Maximum durability
  ❌ Write fails if ANY node is down. Fragile.

W=QUORUM (W=2) → 2 of 3 must ACK
  ✅ Tolerate 1 failure
  ✅ Reasonable latency (fastest 2 of 3)
  ✅ Common production default

W=ONE → 1 must ACK
  ✅ Fastest, most available
  ❌ Eventual consistency only
  Use: high-throughput logging, metrics
```

---

## Strict vs Sloppy Quorum

### Strict Quorum

Write must succeed on **exactly the designated replica set** (the N replicas that own this key range). If one is down → write fails or blocks until it recovers.

```
Designated replicas: R1, R2, R3
R3 is DOWN.

W=2: can still write to R1 + R2 ✓
W=3: write FAILS — cannot reach 3 designated replicas ✗
```

Use for: **financial transactions, inventory, anything where split-brain writes are catastrophic**.

### Sloppy Quorum + Hinted Handoff

If a designated replica is down, write to **any healthy node** in the cluster with a **hint** (a note: "this data belongs to R3, hand it over when R3 returns").

```
R3 is DOWN.

Write to R1, R2, R4 (R4 is NOT designated but is healthy)
  → R4 stores data + hint: "forward to R3 when it comes back"
  → Write succeeds ✓

R3 comes back online:
  → R4 hands off the data and deletes the hint ✓
```

**Cassandra hint TTL (Time To Live)**: default 3 hours. If R3 doesn't recover within 3 hours, hint is dropped → use Merkle tree anti-entropy repair to catch up.

Use for: **high-availability systems that can tolerate brief eventual consistency during failures** (session stores, user activity, recommendations).

---

## MERN Dev Context

> **MERN dev note — how MongoDB's writeConcern maps to quorum**
>
> MongoDB uses quorum internally for its replica set writes. The `writeConcern` option is your quorum dial:
>
> | writeConcern | Behavior | PACELC class |
> |---|---|---|
> | `{ w: 1 }` (default) | Only primary ACKs | PA/EL — fast, eventual for secondaries |
> | `{ w: "majority" }` | Quorum of replicas ACK | PA/EC — strong consistency |
> | `{ w: 3 }` | All 3 replicas ACK | PC/EC — strongest, fragile |
> | `{ w: 0 }` | Fire-and-forget | Eventual, risky |
>
> **Recommendation for MERN apps**:
> - User data (profiles, orders, payments): `writeConcern: "majority"` — you want strong consistency
> - Logs, analytics, activity events: `writeConcern: 1` — speed over consistency
> - Session tokens: Redis with `SET NX` — not MongoDB's job
>
> MongoDB's replica set has N=3 by default (1 primary + 2 secondaries). With `w: majority` you're doing W=2, R=1 (reads from primary) — which satisfies W+R > N (2+1 = 3 = N, not >N!) wait, no — MongoDB primary reads are actually "read from the node that did the write" so you always read the written value. For true quorum-style consistent reads use `readConcern: "majority"` (R=majority).

> **MERN dev note — why Cassandra does quorum differently than MongoDB**
>
> MongoDB: one **primary** does all writes, secondaries replicate. Quorum is about how many secondaries must confirm durability before ACK.
>
> Cassandra: **no primary** — coordinator picks any node. Every node is equal. Quorum here means "at least W out of the N ring-assigned nodes must ACK." Because there's no single authoritative replica, the W+R overlap proof is what gives you correctness.
>
> This is why Cassandra's CL=QUORUM gives you real quorum overlap guarantees, while MongoDB's `w: majority` is technically "at least majority of replica set must confirm write persistence" — slightly different semantics but similar effect for most production use cases.

---

## Read Repair & Anti-Entropy

Quorum reads only query R nodes, leaving N-R potentially stale. Catch-up mechanisms:

| Mechanism | When | How |
|---|---|---|
| **Read Repair** | During a read | Coordinator updates stale replicas it detected during quorum read |
| **Anti-Entropy (Merkle Trees)** | Background | Periodic Merkle tree comparison; streams only differing keys |
| **Hinted Handoff** | On node recovery | Temporary holder hands off hints to recovered node |

In Cassandra: read repair runs on a configurable % of reads (default 10%). Schedule `nodetool repair` weekly for active data.

---

## Real-World Examples

### Apache Cassandra (Tunable, Sloppy Quorum)

Netflix uses Cassandra N=3, `LOCAL_QUORUM` (W=2, R=2 within one region) for viewing history:
- Strong consistency within datacenter
- Async cross-DC replication for global availability
- A/B test assignments: W=ONE, R=ONE — fastest, eventual consistency fine

Cassandra hinted handoff TTL (Time To Live) = 3 hours by default. Monitor hint queues to detect prolonged outages.

### Amazon DynamoDB (N=3, Strict AZ Quorum)

- W=2, R=2 for strongly consistent reads (opt-in)
- W=2, R=1 for eventually consistent reads (default, lower latency + cost)
- Cross-AZ quorum: survived a 2015 AZ failure — 2 healthy AZs maintained quorum
- Global tables: async cross-region replication + LWW conflict resolution

### Uber Schemaless (MySQL Quorum)

- N=3 MySQL replicas per shard, W=2 required before confirming to app
- Reads from 2 replicas, pick highest version (timestamp)
- Later added async cross-region replication for international scale

---

## Interview Cheat Sheet

### Design Scenarios

**Scenario: 5 replicas, tolerate 2 failures, strong consistency**  
Answer: Need W+R > 5 and N-W ≥ 2, N-R ≥ 2 → W=3, R=3. 3+3=6>5 ✓. Tolerates 2 failures each side ✓.

**Scenario: High availability, accept eventual consistency, 3 replicas**  
Answer: W=1, R=1. Write=fastest node, read=fastest node, W+R=2≤3=N → eventual consistency.

**Scenario: User profile updates — read-your-writes guarantee, 3 replicas**  
Answer: W=2, R=2. W+R=4>3 ✓. User always reads their own latest update because quorum overlaps.

**Scenario: p99 write latency is high. One replica is consistently slow. Fix?**  
Answer: Quorum waits for only W fastest nodes. Investigate why the slow node is lagging (disk, network, load). Since quorum already excludes the slow node from the critical path, this shouldn't affect p99. Check if the slow node is being included in quorum by chance.

### Common Interview Q&A

**Q: What's the difference between quorum and Raft/Paxos?**  
A: Quorum is a simpler voting mechanism for reads and writes — no leader election, no log replication protocol. Raft/Paxos are **consensus algorithms** for leader election and log replication in systems that need total ordering. Quorum = "how many nodes must agree per write/read". Raft = "how does a cluster elect a single leader and replicate an ordered log".

**Q: Why is N usually odd?**  
A: Maximizes fault tolerance for a given majority quorum. N=4 with QUORUM=3 tolerates 1 failure (same as N=3). N=5 with QUORUM=3 tolerates 2 failures. Odd N gets you one more failure tolerance at the same quorum cost.

**Q: What happens during a split-brain with sloppy quorum?**  
A: Both sides can accept writes (each side has healthy nodes). When partition heals → conflicting versions. Resolve with: LWW (last-write-wins), vector clocks (expose siblings to app), or CRDTs (merge-friendly data structures). This is why strict quorum is required for financial data.

### Red Flags to Avoid

- "Quorum always provides strong consistency" → only if W+R > N
- Not knowing the formula W+R > N or unable to use it to solve quorum sizing
- Confusing quorum with Raft/Paxos (different levels of abstraction)
- "All replicas must update synchronously" → misses the whole point (quorum < N)
- Ignoring that quorum waits for the **W-th or R-th slowest** required node — matters for latency design
- Forgetting sloppy quorum + hinted handoff when asked about availability during node failures

---

## Connecting to Other Concepts

| Concept | Connection |
|---|---|
| **CAP Theorem** | Strict quorum = CP (consistency during partition). Sloppy quorum = AP (availability during partition) |
| **PACELC** | W=QUORUM, R=QUORUM = EC (consistent during normal operation, higher latency). W=1, R=1 = EL |
| **Replication** | N is the replication factor. Quorum decides how many replicas must confirm before ACK |
| **Merkle Trees** | Anti-entropy mechanism that catches replicas that missed quorum writes long-term |
| **Consistent Hashing** | The ring determines WHICH N nodes own each key. Quorum decides HOW MANY must ACK |
| **Eventual Consistency** | W+R ≤ N → writes may not be visible to subsequent reads immediately |

---

## Key Takeaways

1. **W+R > N = strong consistency**: read and write quorums always share ≥1 node that has the latest write
2. **W+R ≤ N = eventual consistency**: no guaranteed overlap, reads may be stale
3. **QUORUM = ⌊N/2⌋+1**: standard majority quorum, typical production default
4. **Fault tolerance = min(N-W, N-R)**: how many node failures you can survive
5. **Sloppy quorum + hinted handoff**: write to any healthy node during failures, hand off when designated node returns — Cassandra's default for high availability
6. **Latency = max(W or R slowest required nodes)**: slow replicas don't block if they're not in your quorum
7. **Read Repair + Anti-Entropy**: fill in the N-R stale nodes after quorum reads; use Merkle trees for background sync

---

## Keywords

`quorum` · `W+R>N` · `write quorum` · `read quorum` · `N replicas` · `majority quorum` · `strict quorum` · `sloppy quorum` · `hinted handoff` · `read repair` · `anti-entropy` · `tunable consistency` · `fault tolerance` · `Cassandra LOCAL_QUORUM` · `DynamoDB consistent reads` · `writeConcern majority` · `readConcern majority` · `split brain` · `LWW last write wins` · `vector clocks` · `CRDT` · `quorum intersection`
