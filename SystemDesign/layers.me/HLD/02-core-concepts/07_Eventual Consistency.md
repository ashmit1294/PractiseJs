# 07 — Eventual Consistency: How It Works with Examples

**Module:** Core Concepts & Trade-offs | **Level:** Intermediate

---

## ELI5 Summary

- **Eventual consistency** = all replicas *will* agree on the same data... just not immediately
- A write is acknowledged after updating **one replica**; the rest catch up asynchronously
- During propagation, different readers may see different versions (**inconsistency window**)
- **Guaranteed to converge** — this is the key difference from weak consistency (which makes no such promise)
- When updates conflict, a **deterministic conflict resolution** rule picks the winner
- Best for: high-availability at global scale — DynamoDB, Cassandra, DNS (Domain Name System), Netflix, Amazon

---

## The Group Chat Analogy

- You send: "Changed meeting to 3pm" then "Never mind, keep it at 2pm"
- Friends with poor network see messages in different orders temporarily
- Eventually, everyone catches up and figures out the final state
- **Strong consistency** = wait for everyone to acknowledge each message before sending next → grinding halt if anyone is offline
- **Eventual consistency** = send and propagate; catch up eventually

---

## Core Concept

```
WRITE FLOW (Eventual Consistency):
  Client → Replica A → ✓ ACK (10ms)
                         ↓ async (background)
                      Replica B ← update (50ms later)
                      Replica C ← update (50ms later)

Inconsistency window: ~50ms (e.g., t0 → t50ms)
  - Read at t10ms from Replica B → returns OLD value (stale)
  - Read at t100ms from Replica B → returns NEW value (converged) ✓

Convergence is GUARANTEED (unlike weak consistency)
```

---

## Convergence Timeline

```
T=0ms   Client writes value=v1 to Replica A
T=10ms  Client2 reads from Replica B → gets v0 (stale)  ← inconsistency window
T=50ms  Async replication: Replica B receives v1
T=50ms  Async replication: Replica C receives v1
T=100ms Client2 reads from Replica B → gets v1 ✓ (converged)
```

---

## DynamoDB Multi-Region Example

```
us-east-1 (Primary)     eu-west-1 (Replica)     ap-southeast-1 (Replica)
      │                        │                           │
  t=0ms: write                 │                           │
  Add to cart ✓                │                           │
  ACK: 10ms                    │                           │
      │──── async replication ─►│ (arrives ~100ms later)    │
      │──── async replication ──────────────────────────────►│ (150ms)
      │                        │                           │
  t=75ms: EU user reads cart   │                           │
  → sees stale (item missing)  │                           │
  t=200ms: EU user reads again │                           │
  → sees updated cart ✓        │                           │

Prime Day: millions TPS (Transactions Per Second); accepts ~200ms inconsistency window
```

---

## Conflict Resolution Strategies

When two clients write to the **same key concurrently** on different replicas:

| Strategy | How | Data Loss? | Use When |
|---|---|---|---|
| **Last-Write-Wins (LWW)** | Highest timestamp wins; other write dropped | ✅ Yes | Simple overwrites acceptable; immutable data |
| **Vector Clocks** | Track causality; expose conflicts to application | ❌ No — app decides | Shopping carts, complex objects |
| **CRDT** | Mathematical structures that merge deterministically | ❌ No — math guarantees | Collaborative editing; counters; sets |

### CRDT Types

```
G-Counter (grow-only):  [R1: 5, R2: 3, R3: 7] → merge = max each → total = 15
PN-Counter (±):         [incr-counter, decr-counter] → merge both
OR-Set (add/remove):    Add item A on device1; remove item A on device2
                        → conflict → show both? keep add? per-business-logic
```

### Vector Clock Example

```
Replica A writes v1: clock = {A:1, B:0, C:0}
Replica B receives, writes v2: clock = {A:1, B:1, C:0}   ← sequential (B > A, no conflict)
Replica C writes concurrently: clock = {A:0, B:0, C:1}   ← concurrent with v2!
                                                           ← neither vector dominates
                                                           → TRUE CONFLICT → app resolves
```

---

## Amazon Shopping Cart: Classic Example

```
Network partition:
  Device1 (phone): adds "Headphones" → Replica X
  Device2 (laptop): adds "Keyboard" → Replica Y
  [partition heals]
  → Both replicas sync

LWW:    Keeps "Keyboard" (newer timestamp) → "Headphones" LOST ✗
Vector: Both versions exposed → app merges
CRDT:   OR-Set union → Cart = ["Headphones", "Keyboard"] ✓

Amazon chose: UNION (additions preserved) — losing an add costs more revenue
              than showing an item user tried to remove
```

---

## Overselling: Why Inventory Needs Strong Consistency

```
Replica A: inventory=1    Replica B: inventory=1 (stale)

Client1 reads Replica A → sees 1 available → buys → success (inventory=0)
Client2 reads Replica B → sees 1 available (stale!) → buys → success (inventory=0)

Convergence: both replicas set to 0... but 2 items were sold ✗

Fix: Use strong consistency for inventory OR reserved inventory pattern
     (reserve immediately, reconcile later with compensation)
```

---

## Real-World Examples

### Amazon DynamoDB
- Default reads = eventually consistent (any replica, <1s lag)
- Strongly consistent reads = optional (+10ms, queries leader)
- **99.9% of operations tolerate staleness** → optimize for eventual; handle exceptions with strong
- Prime Day: millions TPS (Transactions Per Second), ~200ms inconsistency window accepted

### Netflix — Viewing History
- Pause on California device → write to local DC → async propagation to Europe
- Switch to London phone → might see older position for seconds
- Resolves conflict by **taking max watch position** (skip ahead > rewatch)
- p99 replication lag: < 50ms; nearly invisible to users

### Apache Cassandra

> **MERN dev note — why Cassandra over MongoDB for IoT sensor data?**
> IoT sensors can generate **100k–1M writes/second**. MongoDB uses a single-primary replica set — all writes queue at the primary. Under that write load, the primary becomes the bottleneck and replication lag spikes. Cassandra is a **multi-master, ring-based** system — every node accepts writes independently. Add 5 more nodes → write capacity scales linearly with zero reconfiguration. MongoDB is the better pick when you need rich queries like `find all sensors where temp > 90 AND location = 'NYC'` — Cassandra's CQL is limited for that. Use Cassandra when write speed and scale trump query flexibility.

- Tunable: write with `ONE` (AP) or `QUORUM` (balanced) or `ALL` (CP)
- Read repair + anti-entropy (Merkle trees + gossip) = guaranteed convergence
- Sensor data (IoT): write `ONE`, read `QUORUM` → balance freshness + availability

### DNS (Domain Name System)
- Update A record → authoritative nameservers propagate
- Recursive resolvers cache old IP until TTL (Time To Live) expires (seconds to hours)
- **TTL (Time To Live) controls upper bound on inconsistency window**
- Convergence guaranteed; timing not

---

## Trade-offs Summary

| Dimension | Eventual | Strong |
|---|---|---|
| **Write latency** | 1–10ms (local only) | 50–200ms (coordination) |
| **Read freshness** | Potentially stale (ms–seconds) | Always current |
| **Availability** | High (AP in CAP) | Lower (CP — may reject during partition) |
| **Conflict handling** | App must implement merge | Prevented by coordination |
| **Scalability** | Massive horizontal | Limited by coordination overhead |

---

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| **"Eventual = never converges"** | It's a mathematical guarantee — measure p99 replication lag; set SLOs (e.g., 99% converge in 100ms) |
| **No conflict resolution plan** | Silence LWW silently loses data; design merge logic per data type |
| **Mixing eventual + strong without isolation** | Don't let eventually consistent reads feed into strongly consistent writes (e.g., inventory oversell) |
| **No monitoring** | Track replication lag, conflict rates; alert on SLO (Service Level Objective) violations; design UI for stale states |

---

## Interview Cheat Sheet

| Level | Expectation |
|---|---|
| **Mid** | Define eventual consistency; contrast with weak (convergence guarantee) and strong; give 2 use cases; explain LWW pitfall (data loss) |
| **Senior** | Design shopping cart with explicit conflict resolution; explain vector clocks; discuss quorum tuning in Cassandra/DynamoDB; quantify replication lag impact; describe compensation strategies for oversell |
| **Staff+** | Architect multi-region eventual consistency; discuss CALM theorem; design CRDT-based collaborative editor; migrate strong→eventual in production without data loss; hybrid consistency models |

**Common Questions:**
- "How does eventual consistency differ from weak?" → Eventual guarantees convergence; weak does not
- "Design a shopping cart with eventual consistency" → Union-based merge (Amazon approach); discuss LWW tradeoffs
- "Why does DNS (Domain Name System) use eventual consistency?" → Global scale, high availability, staleness acceptable for name resolution
- "How do you monitor eventual consistency?" → Replication lag metrics (p50/p99), conflict rate, convergence SLOs
- "When to choose strong over eventual?" → Financial transactions, inventory, auth — where inconsistency causes business harm

**Red Flags:**
- "Eventual = eventually strong" — misunderstanding; they're different models
- Defaulting to LWW without acknowledging data loss risk
- Ignoring inconsistency window ("it's negligible") without measuring
- Same consistency for all data without analysis

---

## Key Takeaways

1. **Convergence is guaranteed** — all replicas reach same state eventually (different from weak consistency)
2. **Async replication** = write fast, propagate later → inconsistency window during propagation
3. **Conflict resolution is mandatory** — choose LWW (simple, loses data), vector clocks (app decides), or CRDT (math merge, no loss)
4. **Measure replication lag** — "eventually" = usually milliseconds to seconds; set SLOs and alert
5. Choose when **availability > immediate consistency**: feeds, caches, recommendations, DNS (Domain Name System)
6. Avoid for **operations where inconsistency causes harm**: payments, inventory, auth
7. **Hybrid systems**: eventual for high-volume reads, strong for critical writes — per data type, not per system
8. DynamoDB, Cassandra = tunable per operation → the spectrum is real and practical

---

## Keywords

`eventual consistency` `async replication` `convergence` `inconsistency window` `last-write-wins (LWW)` `vector clocks` `CRDT` `conflict resolution` `replication lag` `DynamoDB` `Cassandra` `DNS (Domain Name System)` `gossip protocol` `quorum` `read repair` `anti-entropy` `Merkle trees` `hinted handoff` `optimistic replication` `OR-Set` `G-Counter` `PN-Counter` `Netflix` `Amazon Dynamo paper`
