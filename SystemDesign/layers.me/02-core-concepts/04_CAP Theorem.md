# 04 — CAP Theorem Explained with Real-World Examples

**Module:** Core Concepts & Trade-offs | **Level:** Intermediate

---

## ELI5 Summary

- Distributed systems (many computers sharing data) can only promise **2 of 3 things** at once:
  - **C**onsistency — every reader sees the latest write
  - **A**vailability — every request gets a response
  - **P**artition tolerance — system works even when the network breaks between nodes
- Networks **always** break eventually → Partition tolerance isn't optional for distributed systems
- So in reality: **you choose CP or AP** when a partition happens
- **CA systems don't truly exist** in distributed environments — claiming otherwise is naive

---

## The Restaurant Analogy

- Chain restaurant across a city, each location has its own menu board (replica)
- Phone lines go down between branches = **network partition**
- **CP choice**: Close the branches that can't sync with HQ — serve no one, but menus stay accurate
- **AP choice**: Keep all branches open with yesterday's menu — serve everyone, but some data is stale
- You can't do both when the phones are down

---

## Core Concept

```
CAP Triangle:
         Consistency (C)
         Linearizability
         /            \
        /    IMPOSSIBLE \
       /      all 3      \
 Availability (A) ——— Partition Tolerance (P)
  Every request          System works despite
  gets response          network failures

Real choice: P is mandatory → Choose C or A during partitions
```

- **C** = every read gets the **most recent write or an error** (linearizability)
- **A** = every operational node **always responds** (may return stale data)
- **P** = survives **arbitrary message loss** between nodes

---

## Flowchart: Partition Forcing CP vs AP Decision

```
BEFORE PARTITION:
  Client A → Node 1 (X=10) ←───sync───→ Node 2 (X=10) ← Client B
  Normal operation: C + A + P all met ✓

PARTITION OCCURS:
  Node 1 ←── ⚡ NETWORK BREAK ──→ Node 2
  Client A writes X=30 to Node 1
  Client B reads from Node 2 — which can't see X=30

  Choose:
  ┌─────────────────────────────────────────────┐
  │ CP Mode (HBase, Zookeeper)                  │
  │ Node 2 rejects read → returns 503 error     │
  │ ✓ Correct data  ✗ Unavailable               │
  ├─────────────────────────────────────────────┤
  │ AP Mode (Cassandra, DynamoDB)               │
  │ Node 2 returns stale X=10                   │
  │ ✓ Always responds  ✗ Stale data             │
  └─────────────────────────────────────────────┘
```

---

## The Spectrum: Tunable Consistency (Cassandra Example)

> **MERN dev note — why Cassandra, not MongoDB for this?**
> As a MERN dev you know MongoDB lets you set `writeConcern: { w: 'majority' }` per operation — that's the same idea. Cassandra just exposes MORE levels (`ONE`, `QUORUM`, `LOCAL_QUORUM`, `ALL`) and defaults to AP (eventual). MongoDB defaults to CP (majority). When you need AP by default with optional consistency per query (e.g., IoT writes at 500k/sec where some staleness is fine), Cassandra is the go-to. Use MongoDB when you need JSON-style documents, rich queries (`$lookup`, aggregation pipelines), or ACID transactions.

```
 < MORE AP                                MORE CP >
 ┌──────────────────────────────────────────────────┐
 │ consistency=ONE   │ QUORUM      │ ALL            │
 │ Write to 1 node   │ Write to    │ Write to all   │
 │ Async replicate   │ majority    │ before ACK     │
 │ Fastest ✓         │ Balanced    │ Slowest        │
 │ Stale possible    │             │ Strongest C    │
 └──────────────────────────────────────────────────┘
```

- CAP is **not binary** — systems offer **tunable consistency per operation**
- DynamoDB: eventual reads (AP) vs strongly consistent reads (CP) — your choice per query
- During **normal operation**, systems provide C + A + P simultaneously. CAP only constrains **during partitions**

---

## System Classification

| System | Classification | Why |
|---|---|---|
| **HBase** | CP | Rejects requests during partition to stay consistent |
| **ZooKeeper** | CP | Leader quorum required; rejects requests without quorum |
| **MongoDB** (majority write concern) | CP | Rejects writes without quorum; single primary handles all writes |
| **Cassandra** | AP (tunable) | No primary — every node accepts writes; eventual consistency by default; configure quorum per-op |
| **DynamoDB** | AP (tunable) | Eventually consistent by default; strong reads optional |
| **Riak** | AP | Serves all requests; reconciles after partition |
| **Spotify Playlists** | AP | Always add songs; sync later |
| **Uber Dispatch** | CP | Never double-assign a driver; reject if no quorum |
| **Netflix Watch Progress** | AP | Always resume; slight rewind during partition is OK |
| **Stripe Payments** | CP | Reject transaction if can't confirm; no double charges |
| **PostgreSQL (single-node)** | CA | Fine until a partition makes it unavailable entirely |

---

## Key Principles

1. **CA systems are mythical** in distributed contexts — PostgreSQL "CA" really means it becomes **fully unavailable** during partition (never a true distributed choice)
2. **Partition tolerance is mandatory** — networks fail; switches crash; cables break. Not optional
3. **CAP only activates during partitions** — normal operation gives you all 3 for free
4. **Business requirements drive CP vs AP** — not technical elegance

---

## CP vs AP Trade-off Summary

| Dimension | CP | AP |
|---|---|---|
| **Data correctness** | Always correct or error | Sometimes stale |
| **Availability during partition** | Reduced (some nodes refuse) | Full |
| **Latency** | Higher (quorum coordination) | Lower (local replica) |
| **Dev complexity** | Simple (data = correct) | Complex (conflict resolution needed) |
| **When to use** | Payments, inventory, bookings | Feeds, caches, analytics |

---

## Real-World Examples

### Spotify — AP
- Add a song to playlist → accepted immediately, async replicated
- During partition: different devices see slightly different playlists for seconds
- **Business logic**: availability ("can't add song" error) is worse than 2-second sync delay

### Uber Dispatch — CP
- Driver assignment must be exact — no double-booking allowed
- During partition: rejects trip requests if quorum unreachable
- **Business logic**: two drivers at one customer = operationally catastrophic; temporary unavailability is preferable

### Netflix — AP
- Watch progress stored locally, synced eventually
- During partition: might restart 5 minutes back instead of current position
- **Business logic**: "cannot play" error is far worse than slight rewind

---

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| "CAP applies all the time" | CAP only constrains during partitions — design for normal operation first |
| "We'll prevent partitions" | Partitions are inevitable at scale — partition tolerance is not optional |
| "Just use CA" | CA doesn't exist in distributed systems; single-node PostgreSQL isn't distributed |
| Confusing eventual consistency with CAP's C | CAP's C = **linearizability**; eventual consistency = an AP choice (weaker) |
| Choosing CP/AP without business context | Always ask: is stale data worse than no data? |

---

## Interview Cheat Sheet

| Level | Expectation |
|---|---|
| **Mid** | Define C, A, P correctly; explain why CA doesn't work; classify Cassandra/HBase/PostgreSQL; use CAP in a cache design |
| **Senior** | Discuss partition probability; explain tunable consistency in DynamoDB/Cassandra; critique "CA systems" claim; use PACELC mention |
| **Staff+** | Challenge CAP limits; reference Spanner's TrueTime (external consistency > CAP's C); quantify quorum math; design graceful degradation for CP systems |

**Common Questions:**
- "Why can't we have all three CAP properties?"
  - During partition, nodes can't communicate → impossible to guarantee freshness AND response
- "Is DynamoDB CP or AP?"
  - Tunable — eventual reads = AP, strongly consistent reads ≈ CP
- "When would you choose CP over AP?"
  - When incorrect data causes business harm (payments, inventory)
- "How does Cassandra handle partitions?"
  - AP — all nodes respond; last-write-wins or timestamps reconcile after healing

**Red Flags:**
- "CA systems exist in distributed environments"
- "We'll just prevent partitions"
- Choosing CP/AP without business context
- Confusing eventual consistency with CAP's linearizability

---

## PACELC Extension (Staff+)

CAP only covers partition scenarios. **PACELC** adds: even without partitions, you trade **Latency (L)** vs **Consistency (C)**. Example: Google Spanner pays 50–100ms latency for global strong consistency even on healthy networks.

---

## Key Takeaways

1. CAP = can only have **2 of 3** during network partition
2. **P is mandatory** → real choice is CP or AP
3. **CA = myth** in distributed systems
4. **CP** = reject requests during partition (HBase, Zookeeper, Stripe)
5. **AP** = serve stale data during partition (Cassandra, DynamoDB, Netflix)
6. CAP applies **only during partitions** — normal operation → all 3 are fine
7. Use **tunable consistency** (Cassandra, DynamoDB) to make per-operation decisions
8. Always drive choice from **business requirements**: stale data vs downtime — which is worse?

---

## Keywords

`CAP theorem` `consistency` `availability` `partition tolerance` `linearizability` `CP systems` `AP systems` `CA systems` `HBase` `ZooKeeper` `Cassandra` `DynamoDB` `tunable consistency` `quorum` `network partition` `split-brain` `PACELC` `vector clocks` `conflict resolution` `Eric Brewer`
