# 16 — PACELC Theorem

> **Source**: https://layrs.me/course/hld/02-core-concepts/pacelc-theorem  
> **Level**: Intermediate | **Read time**: ~9 min  
> **Author**: Daniel Abadi (2010)

---

## TL;DR

**CAP** tells you what to do during a network partition (choose Availability or Consistency). But partitions are **rare** — systems spend 99.9%+ of time running normally. **PACELC adds the normal-operation question**:

> **"If there is a Partition → choose A or C.  
> Else (normal operation) → choose Latency or Consistency."**

This creates 4 buckets:

| Class | Partition | Normal | Examples |
|---|---|---|---|
| **PA/EL** | Available | Low Latency | Cassandra, DynamoDB, Riak |
| **PA/EC** | Available | Consistent | **MongoDB** (majority writes), Cosmos DB |
| **PC/EL** | Consistent | Low Latency | Rare (odd profile) |
| **PC/EC** | Consistent | Consistent | PostgreSQL/MySQL (sync replication), HBase, Google Spanner |

**One-liner for interviews**: *"CAP ignores the 99.9% of time there's no partition. PACELC fills that gap: even in normal operation you can't have both low latency and strong consistency."*

---

## ELI5 — Explain Like I'm 5

CAP is like a fire drill: *"If the fire alarm goes off, do you evacuate with incomplete info or wait until everyone is safely accounted for?"*

PACELC asks: *"Great — but what about the other 350 days a year when there's no fire drill? Do you send emails instantly (fast but maybe someone's inbox is briefly out of sync) or wait for confirmation from everyone before sending (consistent but slower)?"*

That second question — the everyday one — affects **every single user request**. That's why it often matters more.

---

## The Analogy — Restaurant Chain

| Scenario | Decision | PACELC |
|---|---|---|
| Supply chain disruption (partition) | Serve whatever's in stock (A) or close the location (C) | PA vs PC |
| Normal operations, truck arrived | Serve fast with eventual menu sync across locations (L) | EL |
| Normal operations, truck arrived | Wait for all locations to confirm identical menus before opening (C) | EC |

McDonald's = fast service + eventual sync = **PA/EL**.  
Michelin restaurant group = consistent menu across all locations, even if it means slower rollout = **PA/EC or PC/EC**.

---

## Core Concept — The Two-Stage Decision

```
                        Distributed System Request
                                    │
                        ┌───────────┴──────────┐
                        ▼                      ▼
               Network Partition?          No Partition
               (rare: ~0.1% time)     (normal: ~99.9% time)
                        │                      │
              ┌─────────┴────────┐   ┌─────────┴────────┐
              ▼                  ▼   ▼                   ▼
    PA: Stay Available     PC: Reject    EL: Low Latency   EC: Consistent
    (stale data OK)        (return err)  (async replication)(sync replication)
              │                  │            │                    │
       PA/EL  │          PC/EC   │     PA/EL + │           PA/EC   │
       PA/EC  │          PC/EL   │     PC/EL   │           PC/EC   │
```

### The Math That Makes "E" More Important Than "P"

```
System with 1 billion requests/day, 1 partition/month affecting 1000 requests:

EL vs EC choice: affects 1,000,000,000 operations per day
PA vs PC choice: affects                 1,000 operations per month

The E choice is ~30,000× more impactful on user experience.
Optimize for the common case.
```

---

## The Four Categories in Detail

### PA/EL — Available During Partition, Low Latency Normally

```
Write flow (Cassandra, DynamoDB):

Client → Coordinator
              │
              ├──→ Replica A [ACK in 2ms]
              ├──→ Replica B [ACK in 2ms] ← quorum met, return success
              └──→ Replica C         [ACK arrives later, async]

Total write latency: 2–5ms
Trade-off: Replica C may be briefly stale
```

Best for: session stores, metrics, activity logs, shopping carts, user recommendations, time-series data — anything where **brief staleness is tolerable** and **throughput / availability matter more**.

### PA/EC — Available During Partition, Consistent Normally

```
Write flow (MongoDB, majority write concern):

Client → Primary
            │
            ├──→ Secondary A [ACK in 10ms] ← majority met, return success
            ├──→ Secondary B [ACK in 10ms]
            └──→ Secondary C [ACK in 12ms]

Total write latency: 10–30ms (depends on replica lag + geography)
Trade-off: Higher latency, but once ACK received → durable and visible
```

Best for: **user profiles, content management, read-your-writes requirements** — you want to stay up during failures but can't tolerate users seeing their own writes disappear.

> **MERN dev note — where MongoDB sits in PACELC**
>
> MongoDB is **PA/EC** by default when you use `writeConcern: { w: "majority" }`:
> - **PA**: During a primary failure, MongoDB allows reads from secondaries (can be stale), keeping the app available
> - **EC**: During normal operation, `writeConcern: majority` waits for a quorum of secondaries to confirm before returning success → strong guarantees
>
> If you use default `writeConcern: 1` (ack from primary only), MongoDB behaves more like **PA/EL** — fast but secondaries might lag.
>
> This is why MongoDB is the MERN default for most apps: **best of both worlds for typical web workloads** — available during failures, consistent when healthy.

### PC/EL — Consistent During Partition, Low Latency Normally

Rare in practice. Choosing to **reject requests during a partition** (PC) but still prioritize **low latency during normal operation** (EL) is an odd profile — you're unavailable during failures AND you're cutting corners on consistency during normal operation. Uncommon in production.

### PC/EC — Consistent During Partition, Always Consistent Normally

```
Write flow (PostgreSQL synchronous replication, HBase):

Client → Primary
            │
            ├──→ Sync Replica [MUST ACK before commit]
            └──→ (reject if cannot reach quorum)

Total write latency: 10–50ms (up to hundreds ms cross-datacenter)
Trade-off: Higher latency on every write, but: ACID, linearizable reads, no stale reads ever
```

Best for: **financial transactions, inventory management, order processing, compliance-critical data** — correctness violations have real business or legal consequences.

---

## Live Latency Impact

```
EL write: 2–5ms     EC write: 10–50ms   (5–10× difference)
EL read:  1–2ms     EC read:  5–10ms

At 1M requests/day:
  EL: 1M × 3ms avg   = 3,000 seconds wasted in latency
  EC: 1M × 20ms avg  = 20,000 seconds wasted in latency

At 1B requests/day (typical large service):
  The gap compounds to millions of CPU-seconds and direct user UX impact.
```

This is why services like Amazon, Netflix, and Twitter default to **EL systems** for non-critical paths — the latency difference is product-critical, not just engineering preference.

---

## MERN Dev Context — Choosing the Right Database by PACELC

> **MERN dev note — practical PACELC for the MERN stack developer**
>
> As a MERN developer you likely use MongoDB as your primary database. Here's how to reason about when to swap or augment:
>
> | Data type | PACELC need | Best fit | Why |
> |---|---|---|---|
> | User profiles, settings | PA/EC | **MongoDB** (majority writes) | Read-your-writes; available during outage |
> | Session / JWT tokens | PA/EL | Redis or DynamoDB | Speed > consistency; sessions can be re-issued |
> | Activity logs / metrics | PA/EL | Cassandra or InfluxDB | High write throughput; stale reads fine |
> | Financial transactions | PC/EC | PostgreSQL or CockroachDB | ACID; correctness non-negotiable |
> | Shopping cart | PA/EL | DynamoDB | Availability critical; conflict resolution = last write wins |
> | Real-time inventory | PA/EC or PC/EC | MongoDB (majority) or PostgreSQL | Overselling = business problem |
>
> You don't need to switch away from MongoDB for every use case. But PACELC tells you **when MongoDB's PA/EC profile is the right choice vs. when you need something else**.

---

## Cassandra Tunable Consistency — Bridging PA/EL ↔ PA/EC

Cassandra exposes PACELC as a dial via Consistency Level settings:

```
Write: CL=ONE    → EL  (fast, quorum = 1 node)
Write: CL=QUORUM → EC  (majority must ACK, higher latency)
Write: CL=ALL    → strong EC (all nodes must ACK, very slow, fragile)

Read: CL=ONE  → stale possible
Read: CL=QUORUM → tunable strong consistency
```

> **MERN dev note — why this matters**:  
> DynamoDB has the same concept: `ConsistentRead: false` (EL) vs `ConsistentRead: true` (EC, but uses more RCUs and is slower). You pay for consistency in both latency and $$.

---

## Comparison With CAP

| Dimension | CAP | PACELC |
|---|---|---|
| Scenarios covered | Partition only | Partition + Normal operation |
| Normal operation | Not addressed | EL vs EC trade-off |
| System categories | 3 (CA, CP, AP) | 4 (PA/EL, PA/EC, PC/EL, PC/EC) |
| Practical guidance | Limited (partitions are rare) | More actionable for day-to-day choices |
| Introduced | Brewer 2000 | Abadi 2010 |

CAP is still useful as a mental model. PACELC is more useful for **actual database selection**.

---

## System Classification Reference

| System | Partition choice | Normal operation | Class | Notes |
|---|---|---|---|---|
| Apache Cassandra | A (all nodes writable) | L (async replication, tunable) | **PA/EL** | Default CL=ONE; tunable to EC |
| Amazon DynamoDB | A (serve from healthy AZs) | L (eventual consistency default) | **PA/EL** | Opt-in strongly consistent reads |
| Redis Cluster | A | L | **PA/EL** | Can lose writes in failover |
| Riak | A | L | **PA/EL** | Vector clocks for conflict resolution |
| **MongoDB** | A (secondary reads) | C (majority write concern) | **PA/EC** | MERN default; solid middle ground |
| Cosmos DB | A | Tunable (L or C) | **PA/EL or PA/EC** | 5 consistency levels |
| Google Spanner | C | C | **PC/EC** | TrueTime, 5–10ms commit |
| HBase | C | C | **PC/EC** | ZooKeeper-dependent |
| PostgreSQL (sync) | C | C | **PC/EC** | Synchronous standby |
| MySQL (async replica) | A | L | **PA/EL** | Async replica lag |

---

## Real-World Design: Polyglot PACELC

A production e-commerce system uses each database for what it's best at:

```
User Request
      │
      ├── Activity logs / click events   → Cassandra (PA/EL) — 1ms writes, stale reads fine
      │
      ├── User session / auth token      → Redis (PA/EL)    — sub-ms, re-issuable
      │
      ├── Product catalog / profile      → MongoDB (PA/EC)  — consistent reads, tolerable latency
      │
      └── Payment processing             → PostgreSQL (PC/EC) — ACID, never wrong
```

Trade-off rationale:
- Metrics: 10M writes/day → need EL or infrastructure cost explodes
- Payments: 100K txns/day → correctness is worth the PC/EC latency premium
- Profiles: 50M reads/day → MongoDB majority reads at 15ms is fine; users expect profile freshness

---

## Interview Cheat Sheet

### Quick Classification

```
Always consistent + high latency → PC/EC
Available + fast + eventual      → PA/EL
Available + consistent normally  → PA/EC    ← MongoDB's sweet spot
```

### Common Questions & Answers

**Q: How does PACELC extend CAP?**  
A: CAP only covers partition scenarios (rare). PACELC adds the Else branch: during normal operation a system must still choose between low latency (async replication) and strong consistency (sync replication). This matters because normal operation is 99.9%+ of all requests.

**Q: Why is E more important than P?**  
A: Partitions might affect 1,000 requests/month. EL vs EC choice affects 1 billion requests/day. Optimize for the common case — the E branch is 30,000× more impactful.

**Q: Is MongoDB PA/EL or PA/EC?**  
A: **PA/EC** with `writeConcern: majority`. Available during partitions (secondaries become readable), but during normal operation it waits for quorum acknowledgment (EC = higher latency but strong guarantees). With `writeConcern: 1` it behaves closer to PA/EL.

**Q: Can a system shift between EL and EC?**  
A: Yes — tunable consistency systems (Cassandra, DynamoDB, Cosmos DB) let you set consistency per operation. You pay more latency for EC operations, which is the fundamental trade-off.

**Q: Why is strong consistency more expensive?**  
A: EC requires synchronous replication — the write doesn't return until a quorum of nodes has durably stored it. This coordination adds network round-trips, and the latency of the slowest required node determines write latency. This is not a performance bug — it's the cost of the guarantee.

### Red Flags to Avoid

- Saying "PA always means EL" — MongoDB is PA/EC, proving they're independent choices
- Focusing only on partition scenarios in a DB design interview — discuss EL vs EC as the primary daily driver
- "We can have low latency AND strong consistency" — pick one; coordination costs latency
- Using defaults blindly — DynamoDB's default is EL (eventual consistency); opt into EC for critical reads
- Treating PACELC as binary — Cassandra's tunable CL is a dial, not a switch

---

## Key Takeaways

1. **PACELC = CAP + normal operation**: Partition → choose A or C; Else → choose L or C
2. **The E is often more important**: 99.9% of time is normal operation — every request hits EL vs EC
3. **4 categories**: PA/EL (Cassandra, DynamoDB), PA/EC (MongoDB), PC/EL (rare), PC/EC (PostgreSQL, HBase, Spanner)
4. **EC costs latency**: synchronous replication means waiting for the slowest required node — fundamental, not fixable
5. **Tunable systems**: Cassandra CL=QUORUM, DynamoDB `ConsistentRead: true` let you pay for EC on demand
6. **MongoDB = PA/EC**: the MERN stack's default DB is available-during-partition + consistent-during-normal — a solid middle ground for most web applications

---

## Keywords

`PACELC` · `Daniel Abadi` · `CAP theorem extension` · `PA/EL` · `PA/EC` · `PC/EC` · `latency-consistency trade-off` · `normal operation` · `synchronous replication` · `asynchronous replication` · `tunable consistency` · `DynamoDB PA/EL` · `MongoDB PA/EC` · `Cassandra tunable` · `Spanner PC/EC` · `HBase PC/EC` · `writeConcern majority` · `strongly consistent reads` · `eventual consistency` · `quorum` · `partition tolerance` · `polyglot persistence`
