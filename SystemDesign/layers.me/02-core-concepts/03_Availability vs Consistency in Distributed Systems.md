# 03 — Availability vs Consistency in Distributed Systems

**Module:** Core Concepts & Trade-offs | **Level:** Intermediate

---

## ELI5 Summary

- **Availability** = the system always answers you, even if the answer is a bit old
- **Consistency** = every answer you get is the freshest, most up-to-date version
- The problem: when the network breaks between servers, you can't have both at the same time
- You must **pick one** to sacrifice during failures — and that choice should come from **business rules**, not technical preference

---

## The Restaurant Analogy

- Imagine a chain restaurant with many branches
- **Consistency** = every branch must have the exact same menu — if HQ changes a price, all branches freeze until they get the update
- **Availability** = each branch serves customers with their current menu, even if it's slightly outdated
- When phone lines go down (network partition), you choose:
  - Keep serving with stale menus → **Availability**
  - Close until communication is restored → **Consistency**

---

## Core Concept

```
The Conflict:
─────────────────────────────────────────────────────
Write arrives at Replica A
       ↓
A tries to propagate to B and C
       ↓
Network between A and B FAILS (partition!)
       ↓
Replica B must choose:
  ├── Serve old data → AVAILABLE (stale but responsive)
  └── Refuse requests → CONSISTENT (correct but down)
─────────────────────────────────────────────────────
```

- **Availability guarantee**: "I will respond to every request" (not necessarily with fresh data)
- **Consistency guarantee**: "Every response is the most recent write" (may timeout or error)
- This trade-off is exactly what **CAP Theorem** codifies

---

## Flowchart: Network Partition Forcing a Choice

```
      Data Center A          Data Center B
      ┌──────────┐           ┌──────────┐
      │ Replica A│◄──────────►│ Replica B│
      │ Primary  │  NETWORK   │ Secondary│
      │balance=100│  BREAK!   │balance=50│
      └──────────┘           └──────────┘
           ↑                       ↑
       Client A               Client B
         write                  read?
       balance=100
                   Two Options for B:
                   ┌──────────────────────────────┐
                   │ A) Return stale data (50)     │
                   │    → AVAILABILITY             │
                   ├──────────────────────────────┤
                   │ B) Return error / wait        │
                   │    → CONSISTENCY              │
                   └──────────────────────────────┘
```

---

## The Spectrum (not a binary choice!)

```
EVENTUAL CONSISTENCY ◄──────────────────────► STRONG CONSISTENCY
   (Availability)                               (Consistency)
       │                                               │
  DNS (Domain Name System) updates          Cassandra        Google Spanner │
  Social feeds         DynamoDB         Bank transfers │
  Like counters        (tunable)        Medical records│
  1-5ms latency        quorum reads     50-100ms writes│
```

| System | Model | Why |
|---|---|---|
| **DNS (Domain Name System)** | Eventual | Stale IP is better than no resolution |
| **Cassandra / DynamoDB** | Tunable | Configure per-operation |
| **Facebook News Feed** | Eventual | Seconds of delay is fine |

> **MERN dev note — why Cassandra and not MongoDB here?**
> Cassandra is listed alongside DynamoDB as "tunable" because both are **masterless, AP-first** systems designed for massive write throughput at global scale. MongoDB defaults to a single-primary replica set (CP) — great for flexible JSON queries and ACID transactions, but all writes must route through one primary. Cassandra has **no primary** — every node is equal and accepts writes. When you need to write from 5 global regions simultaneously at millions of writes/second, Cassandra scales linearly; MongoDB would bottleneck at the single primary.
| **Facebook Social Graph** | Strong | Half-friendship = privacy violation |
| **Google Spanner** | Strong | Atomic clocks + global consensus |
| **Stripe Payments** | Strong | Exact ledger entries required |
| **Stripe Dashboard** | Eventual | 30s delay in charts = fine |

---

## Hybrid Design: One App, Multiple Consistency Levels

```
         User Request
              │
       Request Router
       ┌──────┴──────┐
  Strong Domain    Eventual Domain
  ┌────────────┐   ┌────────────────┐
  │ Login/Auth │   │  Activity Feed │
  │ Payment    │   │  Analytics     │
  │ Inventory  │   │  Product Page  │
  └────────────┘   └────────────────┘
  Quorum writes    Last-write-wins / TTL (Time To Live)
  10-50ms latency  1-5ms latency
```

- Pay the coordination cost **only where business logic demands it**
- Called **"Consistency à la carte"**

---

## Conflict Resolution Strategies (for Eventual Consistency)

| Strategy | How | Data Loss? | Example |
|---|---|---|---|
| **Last-Write-Wins (LWW)** | Timestamp decides winner | Yes — other write is dropped | Simple caches |
| **Multi-Value** | Keep both conflicting versions | No — user reconciles | Amazon shopping cart |
| **CRDT** | Deterministic math merge | No — always converges | Collaborative editors |

### LWW (Last-Write-Wins)
Every write is tagged with a **timestamp** (wall clock or logical clock). When two conflicting versions are compared, the one with the **later timestamp wins** — the other is silently discarded.
- **Risk**: clock skew on distributed nodes can cause a newer write to lose
- **Use when**: data loss is acceptable and simplicity matters (DNS TTL refresh, simple caches, leaderboards)
- **Used by**: Cassandra (default conflict resolution), Redis (TTL-based eviction)

### Multi-Value (Siblings / Vector Clocks)
When two replicas diverge, **both versions are preserved** as siblings. The conflict is surfaced to the **application or user** to resolve on next read ("merge on read").
- **Risk**: accumulating siblings if not regularly reconciled
- **Use when**: no write should be silently dropped (shopping carts, user preferences)
- **Used by**: Amazon DynamoDB (original Dynamo paper), Riak

### CRDT (Conflict-free Replicated Data Type)
A data structure mathematically designed so that **all replicas can accept writes independently and always merge to the same final state** — no coordination or conflict resolution logic needed.
- The merge function is **associative, commutative, and idempotent** — order of merges doesn't matter
- **Types**:
  - **G-Counter** (Grow-only Counter): each node tracks its own increment; total = sum of all. Used for distributed like/view counts.
  - **PN-Counter**: two G-Counters (increments + decrements). Used for inventory deltas.
  - **G-Set / 2P-Set**: grow-only set; or a set with a separate tombstone set for deletions.
  - **LWW-Register**: single-value CRDT using timestamps (a formal CRDT version of LWW).
  - **OR-Set (Observed-Remove Set)**: handles add/remove with unique tags — avoids the "removed then re-added" race condition.
- **Use when**: real-time collaboration, offline-first apps, distributed counters that must never lose an increment
- **Used by**: Redis (HyperLogLog, CRDT mode in Redis Enterprise), Figma (collaborative canvas), Riak, Yjs, Automerge

```
Example — G-Counter CRDT across 3 nodes after network partition and merge:

  [Partition]
  Node A: {A:3, B:0, C:0}   ← incremented 3 times
  Node B: {A:0, B:5, C:0}   ← incremented 5 times
  Node C: {A:0, B:0, C:2}   ← incremented 2 times

  [Merge — take max per node]
  Merged: {A:3, B:5, C:2}  → Total = 10  ✓ no writes lost
```

---

## Key Principles

- **Availability ≠ uptime** — it means every non-failing node responds (even with stale data)
- **Consistency ≠ speed** — means coordination, which adds latency
- **Network partitions are inevitable** at scale — you must decide in advance
- **Business requirements drive technical choices**, not the other way around

---

## Real-World Examples

### Facebook
- **Social Graph** (friend relationships) → **Strong Consistency**
  - You can't be "half-friends" — privacy rules demand immediate correctness
  - 10–50ms latency on writes
- **News Feed / Like Counters** → **Eventual Consistency**
  - Post visible after a few seconds = acceptable UX
  - 1–5ms latency, serve from nearest datacenter

### Amazon / DynamoDB
- **Shopping cart** → **Availability** (tunable consistency per-operation)
  - Add on phone + add on laptop during partition → **both items appear after merge**
  - Vector clocks track causality; "merge on read" strategy
  - Business reason: cart downtime costs revenue; stale cart is minor inconvenience

---

## Trade-off Dimensions

| Dimension | Strong Consistency | Eventual Consistency |
|---|---|---|
| **Latency** | 50–100ms (coordination) | <5ms (local replica) |
| **Availability** | May fail during partition | Stays up, diverges temporarily |
| **Dev complexity** | Simple model, complex ops | Simple ops, complex app logic |
| **Failure handling** | Error/timeout on partition | Continues, reconciles later |

---

## Common Pitfalls

- **Defaulting to strong consistency everywhere** — hidden cost is latency + availability loss
- **Treating this as binary** — a rich middle ground exists (causal, session, read-your-writes consistency)
- **No conflict resolution plan** — choosing eventual consistency without designing merge logic = data loss

---

## Interview Cheat Sheet

| Level | Expectation |
|---|---|
| **Mid** | Define both, give one example each (DNS / banking), explain CAP link |
| **Senior** | Map business requirements to consistency models; design hybrid systems; discuss failure scenarios |
| **Staff+** | Quantify: "5 replicas, quorum = 3, tolerate 2 failures"; name Spanner/Cassandra/Raft; design CRDT-based conflict resolution |

**Common Questions:**
- "What happens during a network partition between data centers?"
- "How do you decide availability vs consistency for a given feature?"
- "How do you handle conflicting writes in an eventually consistent system?"

**Red Flags:**
- "We can have both perfect availability AND consistency" (violates CAP)
- Choosing consistency model before understanding business requirements
- No conflict resolution strategy for eventual consistency

---

## ACID Transactions — Why They Matter Here

> Referenced throughout this topic: MongoDB supports multi-document ACID; Cassandra opts for BASE by default. Understanding ACID is a prerequisite for the consistency trade-off debate.

**ACID** = the four guarantees that make database write operations safe and reliable:

```
A — Atomicity   → "all-or-nothing" execution: every step in a transaction succeeds, or ALL are
                  rolled back — preventing partial updates from ever being written
                  "Charge $200 + create order" → both happen together, or neither happens
                  If step 2 of 3 fails → step 1 is undone; DB is unchanged

C — Consistency → a transaction transforms the DB from one valid state to another valid state
                  ALL predefined rules, constraints, triggers, and foreign keys are enforced
                  No transaction can leave the DB in a structurally corrupt or rule-breaking state
                  e.g. bank balance can't go below 0 if that rule exists — even mid-transaction

I — Isolation   → concurrent transactions do not interfere with each other — they execute
                  as if they were running sequentially, one after another
                  prevents: dirty reads (reading uncommitted data), lost updates, phantom reads
                  Alice and Bob both buying the last concert ticket → exactly one succeeds

D — Durability  → once a transaction is committed, it remains permanent — even in the event of
                  a system crash, power loss, or hardware failure
                  data is written to disk / WAL (Write-Ahead Log) BEFORE "Payment confirmed" is sent
                  no committed write can be "forgotten" by the database
```

**BASE** (distributed NoSQL default) — the counterpart to ACID:

| Letter | Meaning | What It Sacrifices |
|---|---|---|
| **B**asically Available | System stays up and serves every request, even during node failures | May return stale or partial data |
| **S**oft state | State may change over time even without new input | Replicas temporarily diverge |
| **E**ventually Consistent | All replicas converge to the same value — eventually | No guarantee on *when* they will converge |

### Why ACID is Difficult in Distributed Systems

```
ACID Isolation → every write must coordinate with ALL concurrent writes across replicas
              → during a network partition → coordinator must WAIT (block) or FAIL
              → sacrifices Availability to preserve Consistency

BASE          → accept temporary divergence → stay available during partitions
              → reconcile replicas later → sacrifices Consistency temporarily

→ This exact trade-off is precisely what CAP Theorem formalises (next topic: T04)
```

| Property | ACID Systems | BASE Systems |
|---|---|---|
| **Typical DBs** | PostgreSQL, MySQL, MongoDB (multi-doc), Google Spanner | Cassandra, DynamoDB (default), Redis |
| **Best for** | Payments, inventory management, financial ledgers | Social feeds, IoT streams, analytics, caching |
| **During partition** | Block or return error — never serve inconsistent data | Stay available and serve (possibly stale) data |
| **Write throughput** | Lower (coordination overhead) | Higher (no cross-replica locks) |

> **Full ACID breakdown with code examples** → M6-T01: Databases Overview

---

## Key Takeaways

1. **Availability** = always respond (possibly stale). **Consistency** = always correct (possibly slow/unavailable)
2. During a **network partition** you cannot guarantee both — CAP Theorem
3. The choice is **business-driven**: finance → consistency, social media → availability
4. Use **hybrid models**: pay consistency cost only where it matters
5. Eventual consistency **requires a conflict resolution strategy** (LWW, CRDT, multi-value)
6. Strong consistency = **higher latency + may become unavailable**; Eventual = **stays up + needs complex app logic**

---

## Keywords

`availability` `consistency` `CAP theorem` `network partition` `eventual consistency` `strong consistency` `linearizability` `quorum` `vector clocks` `CRDT` `last-write-wins` `tunable consistency` `causal consistency` `read-your-writes` `DynamoDB` `Cassandra` `Google Spanner` `replication lag` `conflict resolution` `merge on read` `ACID (Atomicity, Consistency, Isolation, Durability)` `BASE (Basically Available, Soft state, Eventually consistent)` `Atomicity` `Isolation` `Durability` `WAL (Write-Ahead Log)`
