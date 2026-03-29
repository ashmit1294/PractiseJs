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

## Key Takeaways

1. **Availability** = always respond (possibly stale). **Consistency** = always correct (possibly slow/unavailable)
2. During a **network partition** you cannot guarantee both — CAP Theorem
3. The choice is **business-driven**: finance → consistency, social media → availability
4. Use **hybrid models**: pay consistency cost only where it matters
5. Eventual consistency **requires a conflict resolution strategy** (LWW, CRDT, multi-value)
6. Strong consistency = **higher latency + may become unavailable**; Eventual = **stays up + needs complex app logic**

---

## Keywords

`availability` `consistency` `CAP theorem` `network partition` `eventual consistency` `strong consistency` `linearizability` `quorum` `vector clocks` `CRDT` `last-write-wins` `tunable consistency` `causal consistency` `read-your-writes` `DynamoDB` `Cassandra` `Google Spanner` `replication lag` `conflict resolution` `merge on read`
