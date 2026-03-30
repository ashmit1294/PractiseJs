# 05 — Consistency Patterns in Distributed Systems

**Module:** Core Concepts & Trade-offs | **Level:** Intermediate

---

## ELI5 Summary

- **Consistency pattern** = the rule your system follows about when a write to one server becomes visible to reads from other servers
- **Weak** = best-effort, no guarantees (like leaving a verbal note — easily forgotten)
- **Eventual** = "we'll sync up... eventually" (like calendar apps that sync when you get WiFi)
- **Strong** = everyone sees the same thing immediately (like one shared whiteboard)
- Stronger consistency = more coordination = **higher latency + lower availability**
- Different parts of the same system can (and usually should) use **different consistency levels**

---

## The Family Calendar Analogy

| Model | Analogy | Trade-off |
|---|---|---|
| **Strong** | One physical calendar on the wall — everyone sees same thing; only one person writes at a time | Slow and limited but always correct |
| **Eventual** | Each family member has their own calendar app that syncs when online — might briefly show conflicts | Fast and flexible; can work offline |
| **Weak** | Verbal agreements, no written record | Super fast; might miss events |

---

## The Consistency Spectrum

```
WEAK ◄─────────────────────────────────────────────────► STRONG
  │                                                           │
  No guarantees                                  Linearizability
  │                                                           │
Memcached     DNS (Domain Name System)     DynamoDB    Cassandra    Spanner  PostgreSQL
              │      (eventual)  (tunable)           (single node)
              │
         Eventual: guaranteed convergence, no order guarantees

Middle Ground (between eventual and strong):
  ┌────────────────────────────────────────────────────────────┐
  │ Causal Consistency     — if A caused B, everyone sees A → B │
  │ Read-Your-Writes       — YOU always see your own writes      │
  │ Monotonic Reads        — time never goes backwards for you   │
  └────────────────────────────────────────────────────────────┘
```

---

## How It Works: Write Flow Comparison

```
EVENTUAL CONSISTENCY:
  Client → Any Replica → ✓ ACK (1-10ms)
                ↓ async (later)
           Replica A, Replica B ... (may lag seconds)

STRONG CONSISTENCY:
  Client → Leader → sync → Replica A ──→ ACK
                  → sync → Replica B ──→ ACK
           ← Success only after ALL ACKs (50-200ms)
```

- Eventual = **write fast, pay the correctness cost later** (async replication)
- Strong = **pay the coordination cost now**, get correctness immediately

---

## Consistency Models Explained

| Model | Guarantee | Example Systems | When to Use |
|---|---|---|---|
| **Weak** | No guarantees after write | Memcached | Cache invalidations, best-effort |
| **Eventual** | All replicas converge eventually | DynamoDB, Cassandra, DNS (Domain Name System) | Social feeds, analytics, view counts |
| **Causal** | Cause-effect order preserved | MongoDB (causal sessions) | Chat (reply after message), comments |
| **Read-Your-Writes** | You always see your own writes | Most session-based systems | Profile updates, user settings |
| **Monotonic Reads** | Never see older data than you saw before | RSS feeds, news | Avoid time-reversal confusion |
| **Strong (Linearizability)** | Every read sees most recent write | Spanner, PostgreSQL, HBase | Payments, inventory, auth |

---

## Decision Framework

```
What are the consequences of stale data?
         │
   ┌─────┴────────────────────────────────────┐
   │ Severe (financial/legal/safety)          │  → Strong Consistency
   └──────────────────────────────────────────┘
   │ Moderate — user sees their own change    │  → Read-Your-Writes
   └──────────────────────────────────────────┘
   │ Moderate — cause-effect must be clear    │  → Causal Consistency
   └──────────────────────────────────────────┘
   │ Low — eventual convergence is enough     │  → Eventual Consistency
   └──────────────────────────────────────────┘
```

---

## Hybrid Consistency: E-Commerce Example

```
                    User
                     │
          ┌──────────┼──────────────┐
          │          │              │
    Browse          Cart         Checkout
  (Eventual)     (Eventual)     (Strong)
  CDN (Content Delivery Network)/Cache      DynamoDB      PostgreSQL
  Stale OK       Sync later    ACID txn ✓
                                 ↓
                             Inventory DB
                             (Strong — prevent overselling)
```

- **Catalog**: Eventual → enables CDN (Content Delivery Network) caching + high read throughput
- **Checkout**: Strong → prevents double-charging and overselling
- **Analytics**: Eventual → massive volume, hours of lag OK

---

## Trade-offs Summary

| Dimension | Weak/Eventual | Strong |
|---|---|---|
| **Latency** | 1–10ms | 50–200ms (cross-region) |
| **Throughput** | 100K+ writes/sec | ~10K writes/sec |
| **Availability** | High (AP in CAP) | Lower (CP in CAP) |
| **Conflict Resolution** | Required (LWW, CRDT, etc.) | Not needed (coordination prevents it) |
| **Dev complexity** | Complex app logic | Simple model, complex infra |

---

## Real-World Examples

### Amazon DynamoDB
- Default = **eventual consistency** (any replica, <1s staleness)
- Optional **strongly consistent reads** → query leader, ~10ms extra
- Shopping cart = eventual; Checkout = strong
- → Consistency is a **per-operation** choice, not a system-wide setting

### Facebook
- **Social graph** (friend/privacy relationships) → **Strong** (you can't be half-friends; privacy violations if inconsistent)
- **News feed / likes / comments** → **Eventual** (1–2s delay invisible to users; allows 100K+ writes/sec)

### Google Spanner
- **External consistency** (stronger than linearizability) across global DCs
- Uses **TrueTime** (GPS + atomic clocks, +/- 7ms uncertainty) + 2-phase commit
- 5–10ms latency cost per transaction
- Used for: AdWords billing, Google Play — correctness is non-negotiable

---

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| "Just use strong consistency everywhere" | Kills performance; 10x latency, reduced availability — only use where needed |
| "Eventual = milliseconds" | May be seconds or minutes under load/partition — measure replication lag; set SLAs (Service Level Agreements) |
| Applying one model to entire system | Use a **consistency matrix** per data type; polyglot persistence |
| Confusing consistency models with isolation levels | Consistency = cross-replica sync; Isolation = concurrent access on same node — independent choices |

---

## Interview Cheat Sheet

| Level | Expectation |
|---|---|
| **Mid** | Name the 3 models; give 1 use case each; understand that stronger = slower; map consistency to CAP choices |
| **Senior** | Design hybrid systems (which component gets which model, why); discuss causal/RYW/monotonic; estimate performance impact; tie to replication strategies |
| **Staff+** | Design custom models; discuss Paxos/Raft for strong consistency; know CRDTs; quantify SLA (Service Level Agreement) impact; challenge over-engineering |

**Common Questions:**
- "Design a distributed counter at 100K increments/sec" → Eventual, CRDT (G-Counter), explain why
- "How do you implement read-your-writes on an eventually consistent DB?" → Sticky sessions / session tokens with version tracking
- "Compare DynamoDB, Cassandra, Spanner consistency" → Tunable | Tunable (with quorum) | External consistency (Spanner wins on guarantees, loses on latency)

**Red Flags:**
- Treating consistency as binary (just consistent vs inconsistent)
- No conflict resolution plan for eventual consistency
- Same consistency model everywhere without justification
- Confusing consistency patterns with transaction isolation levels

---

## Key Takeaways

1. Consistency = **spectrum**, not binary (weak → eventual → strong)
2. Stronger consistency = **more coordination = higher latency + lower availability**
3. Different data types in the **same system** should use **different models**
4. **"Eventually" is not "milliseconds"** — monitor replication lag; set SLAs (Service Level Agreements)
5. Modern DBs (DynamoDB, Cassandra) offer **tunable consistency per operation**
6. Strong consistency is possible globally (Spanner) but costs 5–10ms latency + infrastructure
7. Eventual consistency requires an explicit **conflict resolution strategy**

---

## Keywords

`consistency patterns` `weak consistency` `eventual consistency` `strong consistency` `linearizability` `causal consistency` `read-your-writes` `monotonic reads` `replication lag` `tunable consistency` `DynamoDB` `Cassandra` `Google Spanner` `TrueTime` `CRDT` `conflict resolution` `CAP theorem` `polyglot persistence` `consistency matrix` `synchronous replication` `asynchronous replication` `ACID (Atomicity, Consistency, Isolation, Durability)` `BASE (Basically Available, Soft state, Eventually consistent)` `2PC (Two-Phase Commit)`
