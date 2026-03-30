# 11. Replication in System Design: Master-Slave & Peer

---

## TL;DR

Replication creates multiple copies of data across different servers to improve availability, performance, and disaster recovery. Master-slave = one writer, many readers. Master-master = multiple writers with conflict resolution. Synchronous = consistent but slow. Asynchronous = fast but stale reads possible.

> **Cheat Sheet**: Master-Slave = simple, consistent, single point of write failure | Master-Master = complex, available, conflict resolution needed | Sync = consistent but slow | Async = fast but stale reads possible | P(stale_read) = (lag × write_rate) / replica_count

---

## ELI5 — Explain Like I'm 5

Imagine a restaurant chain. **Corporate HQ** (master) creates the menu and sends copies to all franchise locations (slaves).

- Customers can **order from any location** (read from any replica)
- Only **HQ can change the menu** (write only to master)
- When HQ updates a dish → it sends the new menu to all franchises

**Synchronous**: HQ waits for EVERY franchise to confirm they got the new menu before announcing it. Safe, but slow.

**Asynchronous**: HQ sends the update and moves on. Some locations might serve yesterday's menu for an hour. Fast, but stale.

**Master-Master**: Multiple regional offices can all change the menu. But if two offices change the same dish differently on the same day — conflict! You need rules to resolve it.

---

## The Analogy

> **Restaurant chain**: HQ = master, franchises = slaves, menu = data
> - **Sync**: Wait for all franchises to confirm receipt before publishing
> - **Async**: Send updates and move on — some locations might be briefly out of sync
> - **Master-Master**: Multiple offices modify the menu simultaneously → need conflict resolution

---

## Core Concept

Replication = maintaining **multiple copies of data** on different servers for:
- **Higher availability** — if one server dies, others still serve data
- **Better read performance** — distribute reads across replicas
- **Fault tolerance** — survive hardware failures, AZ outages

**Core challenge**: Maintaining consistency across copies while minimizing latency.

Every replication strategy trades off:
- **How fast data propagates** (consistency)
- **How many replicas must ACK writes** (availability)
- **Whether multiple nodes can write** (complexity)

---

## How It Works

### Master-Slave (Primary-Replica / Leader-Follower)

```
Client (write)                  Client (read)    Client (read)
      │                               │                │
      ▼                               ▼                ▼
  [Master DB]  ──async replicate──► [Slave 1]       [Slave 2]
  Write node                         Read replica    Read replica
      │                              [Slave 3]
      └──────────────────────────► Read replica

Flow:
  1. Client sends write to master
  2. Master applies change locally
  3. Master sends change to slaves (via replication log/stream)
  4. Slaves apply changes
  5. Reads distributed across slaves

  ✓ Simple — one source of truth
  ✓ No write conflicts
  ✗ Master = single point of write failure
  ✗ Slaves may lag behind (eventual consistency)
```

### Master-Master (Multi-Master / Active-Active)

```
  Client A (Region US)    Client B (Region EU)
         │                        │
         ▼                        ▼
    [Master US]   ◄──async──► [Master EU]
  accepts writes               accepts writes
  replicates to EU             replicates to US

Conflict scenario:
  t=10:00:00.000  Master US: UPDATE user SET status='active'
  t=10:00:00.050  Master EU: UPDATE user SET status='inactive'
  
  Both apply locally, then replicate to each other → CONFLICT!
  Resolution: Last-Write-Wins (timestamp) → 'inactive' wins (later timestamp)

  ✓ Higher write availability — any master can accept writes
  ✓ Lower latency for geographically distributed writes
  ✗ Conflict resolution required
  ✗ Operationally complex
```

---

## Synchronous vs Asynchronous Replication

```
Asynchronous:
  Client ──write──► Master
                      │ 1. Write to disk
                      │ 2. Confirm to client ← immediately
                      │ 3. Send to replicas (background, no wait)
                      ▼
                   Slave 1, Slave 2 (may lag behind)

  ✓ Low write latency    ✓ High availability
  ✗ Replication lag      ✗ Potential data loss if master crashes before replicating

Synchronous:
  Client ──write──► Master
                      │ 1. Write to disk
                      │ 2. Send to ALL replicas, WAIT for ACK
                      │     Slave 1 ──ACK──►
                      │     Slave 2 ──ACK──►
                      │ 3. Confirm to client ← only after ALL ACKs
  
  ✓ Strong consistency    ✓ Data on multiple nodes
  ✗ High write latency    ✗ Reduced availability (blocks if replica slow/unreachable)

Semi-Synchronous (middle ground):
  Wait for ACK from ONE replica (data on 2 nodes), not all replicas
  → Durability guarantee without full latency penalty
  → Used by GitHub for critical data
```

---

## Replication Variants

| Variant | How It Works | Used By | Best For |
|---|---|---|---|
| **Master-Slave** | One writer, many readers | MySQL, PostgreSQL, Redis, **MongoDB** | Read-heavy, consistency needed |
| **Master-Master** | Multiple writers | Cassandra, DynamoDB, CouchDB | Geo-distributed writes |
| **Chain Replication** | Writes at head, reads at tail (linear chain) | LinkedIn Espresso | Strong read consistency |
| **Quorum-Based** | W + R > N for tunable consistency | Cassandra, DynamoDB | Tunable trade-offs |

> **MERN dev note — MongoDB vs Cassandra replication:**
> MongoDB uses **Master-Slave** (called Replica Set) — one primary handles all writes, secondaries replicate and handle reads. This is simple, consistent, and great for most apps. Cassandra uses **Master-Master** (called multi-master / peer-to-peer ring) — every node can write, no single primary. Choose MongoDB (Master-Slave) when you need ACID transactions, complex queries, and flexible schema. Choose Cassandra (Master-Master) when you need to write from multiple datacenters simultaneously at massive scale (millions of writes/sec) and can tolerate eventual consistency.
| **Statement-Based** | Replicate SQL statements (INSERT, UPDATE) | MySQL (mode) | Smaller logs |
| **Row-Based** | Replicate actual data row changes | MySQL (default), PostgreSQL | Deterministic, larger logs |
| **Logical Replication** | High-level change descriptions | PostgreSQL | Allows schema differences |

### Chain Replication

```
Write Client        Read Client
     │                    │
     ▼                    ▼
[Head Node]          [Tail Node]
 Accepts writes       Serves reads
     │                  ↑
     ▼                  │
[Middle Node 1]         │
     │                  │
     ▼                  │
[Middle Node 2] ────────┘
     │
     ▼
[Tail Node]

Writes: head → middle1 → middle2 → tail (sequential, strong consistency at tail)
Reads: always from tail (has all committed writes)
Trade-off: write latency grows with chain length
```

---

## GitHub's Hybrid Strategy

```
                  Write Client (git push)
                        │
                        ▼
               [Master DB] (Availability Zone 1)
                 │ semi-sync replication (wait for 1 ACK)
                 │─────────────────────────────────────────────►[Semi-Sync Replica AZ2]
                 │─────────────────────────────────────────────►[Semi-Sync Replica AZ3]
                 │ async replication (no wait)
                 │──────────────►[Async Read Replica] (read traffic)
                 │──────────────►[Async Read Replica] (read traffic)
                 │──────────────►[Async Read Replica] (read traffic)

Critical reads (permissions) → Master (strong consistency)
Non-critical reads (star counts) → Replicas (performance)
Master failure → Semi-sync replica promoted in ~30 seconds (data durability guaranteed)
```

---

## Replication Lag — The Key Metric

**Replication lag** = delay between write committing on master and becoming visible on replicas

```
Stale Read Probability Formula:

P(stale_read) = (replication_lag × write_rate) / replica_count

Example:
  write_rate = 1,000 writes/second
  replication_lag = 100ms = 0.1 seconds
  replica_count = 5

  P(stale_read) = (0.1 × 1000) / 5 = 100 / 5 = 20 in-flight writes per replica

  At 10,000 reads/second → 200 stale reads/second → 2% stale read rate

To reduce stale reads:
  Option A: Reduce lag (50ms → 1% stale reads)
  Option B: Add replicas (10 replicas → 1% stale reads)
  Option C: Route critical reads to master (sacrifice read scaling)
  Option D: Use synchronous replication for critical writes
```

---

## Key Principles

### 1. Replication Lag Determines Consistency Guarantees
Lag = time between master write and replica visibility. Creates "read-your-writes" violations.

> **Instagram**: Posts write to master, reads from replicas. After posting, Instagram routes your OWN profile reads to master for 5 seconds → you see your post immediately. Everyone else might see it slightly later.

### 2. Write Patterns Dictate Topology
- **95%+ reads** → master-slave with many read replicas (scale reads linearly)
- **Heavy writes in multiple regions** → master-master (avoid routing all writes to one region)
- **Complex data with conflicts** → master-slave (simpler consistency)

> **Netflix viewing history**: 99% reads, 1% writes → master-slave with dozens of global replicas. **Google Docs**: Users across regions write simultaneously → master-master with operational transform for conflict merge.

### 3. Replication ≠ Both Availability AND Consistency
- Async replication → high availability + eventual consistency
- Sync replication → stronger consistency + reduced availability
- CAP theorem in action: during partition, choose availability (keep accepting writes, resolve conflicts later) OR consistency (reject writes until partition heals)

> **DynamoDB**: Async multi-master → availability (never stops writes). **Banking systems**: Sync replication → consistency (reject transactions during partitions rather than risk conflicting balances).

---

## Common Pitfalls

### Pitfall 1: Ignoring Replication Lag in Application Logic
- **Cause**: Dev assumes data written to DB is immediately visible everywhere
- **Bug**: User writes a post, refreshes → hits stale replica → "my post disappeared!"
- **Fix**: Route reads to master for 5 seconds after writes (read-your-writes consistency). Monitor replication lag, alert if > 1–5 seconds.

### Pitfall 2: Underestimating Master-Master Conflict Rates
- **Cause**: Testing with low traffic — conflicts seem rare. At 0.1% rate + scale = thousands/day
- **Fix**: Use CRDTs (Conflict-free Replicated Data Types), append-only logs, or partition data so masters own different subsets. Build comprehensive conflict monitoring from day one.

### Pitfall 3: Cascading Failures from Slow Replicas
- **Sync replication**: One slow replica blocks ALL writes → system grind to halt
- **Async replication**: Slow replica accumulates unbounded replication backlog → disk exhaustion
- **Fix**: Semi-synchronous with quorum (wait for N of M, not all). Timeout on ACKs, degrade to async if replica slow. Auto-remove lagged replicas, alert for manual re-sync.

---

## Real-World Examples

### Twitter — Master-Slave (Async)
- Tweets write to master, replicated to dozens of global read replicas (<100ms lag normally)
- Acceptable: users don't expect tweets in their timeline INSTANTLY — app refresh latency masks replication lag
- Read-your-writes: author's profile reads route to master for 5 seconds after posting
- Result: 99% of reads served by replicas, authors always see their own tweets immediately

### Uber — Master-Master (Async, Schemaless)
- Each data center is a master for its region → low write latency for local users
- Trip data naturally partitioned by trip_id → rare conflicts across regions
- Conflicts resolved via last-write-wins (timestamp) — acceptable since drivers operate in one region
- Brief inconsistency (~150ms) across regions is acceptable for driver location data

### GitHub — Master-Slave + Semi-Sync
- Semi-synchronous replication to one replica per AZ → survives zone failures
- Async read replicas for read traffic at scale
- Permission checks → master (strong consistency). Star counts → replicas (performance OK)
- Master failure → semi-sync replica promoted in ~30 seconds (guaranteed durability)

---

## Trade-off Summary

| Dimension | Master-Slave | Master-Master |
|---|---|---|
| **Consistency** | Simple (single writer) | Complex (conflict resolution) |
| **Write Availability** | Single point of failure | Multiple writers available |
| **Operational Complexity** | Low | High |
| **Conflict Resolution** | Not needed | Required |
| **Best Fit** | Consistent data, read-heavy | Geo-distributed writes |

| Dimension | Synchronous | Asynchronous | Semi-Sync |
|---|---|---|---|
| **Write Latency** | 2–10x slower | Low (just master commit) | Moderate |
| **Consistency** | Strong | Eventual | Moderate (at least 1 replica) |
| **Availability** | Lower (blocks on slow replicas) | High | Good |
| **Data Loss Risk** | None | Yes (if master crashes before replication) | Very low |
| **Best Fit** | Financials, inventory | Social media, feeds | Critical data (GitHub) |

---

## Interview Cheat Sheet

### Mid-Level Expectations
- Explain master-slave vs master-master, with concrete examples
- Describe sync vs async replication trade-offs
- Draw write propagation flow and explain replication lag
- Identify when each pattern makes sense based on read/write ratio

### Senior Expectations
- Calculate replication lag impact using `P(stale_read) = (lag × write_rate) / replica_count`
- Design conflict resolution strategies for master-master
- Justify replication strategy based on CAP theorem implications
- Handle failure scenarios: slow replicas, master crash, network partition

### Staff+ Expectations
- Explain replication log formats (statement-based vs row-based, logical vs physical)
- Design hybrid strategies (sync within region, async cross-region, separate analytics replicas)
- Discuss zero-downtime migration between replication strategies
- Reference specific technologies: MySQL Group Replication, PostgreSQL logical replication, Kafka CDC

---

## Common Interview Questions

1. **How do you handle replication lag so users see their own writes?**
   - Read-your-writes consistency: route reads to master for X seconds after writes, or track replication position

2. **What happens if master fails in master-slave? How do you promote a slave?**
   - Failover: detect via heartbeat, promote slave with most recent replication position, update routing (30–60s RTO (Recovery Time Objective))

3. **How do you resolve conflicts in master-master replication?**
   - Last-write-wins (timestamps), CRDTs, application-level merge (Google Docs OT), or partitioning to avoid conflicts

4. **When synchronous over asynchronous?**
   - Financial transactions, inventory (stale reads cause real problems) → sync
   - Social feeds, analytics, recommendations → async acceptable

5. **How does replication interact with caching?**
   - Cache from replicas risks stale cache (double staleness: replica lag + cache TTL (Time To Live))
   - For strong consistency: cache at master layer, use short TTLs, invalidate on write

6. **What metrics to monitor for healthy replication?**
   - Replication lag (ms), replica count behind master, replication errors, disk usage for replication logs

---

## Red Flags to Avoid

- ❌ Claiming replication provides BOTH perfect consistency AND availability (violates CAP)
- ❌ Not mentioning replication lag or assuming replicas are always up-to-date
- ❌ Choosing master-master without explaining conflict resolution strategy
- ❌ Ignoring failure scenarios (what when master or replica fails?)
- ❌ Not considering network partitions between master and replicas
- ❌ Proposing synchronous replication without acknowledging latency impact
- ❌ Confusing replication (duplicate full data) with sharding (partition data) or caching (temporary)

---

## Key Takeaways

- **Replication** = multiple copies of data → availability + read performance, but introduces consistency challenges via replication lag
- **Master-Slave**: one writer, many readers — simple, consistent, single write failure point
- **Master-Master**: multiple writers — higher write availability, but conflict resolution required
- **Sync**: wait for replicas before ACK → strong consistency, higher latency
- **Async**: ACK immediately → low latency, eventual consistency, data loss risk on master crash
- **P(stale_read) = (lag × write_rate) / replica_count** — quantify and justify your trade-offs
- Design for replication lag from day one; implement read-your-writes consistency, monitor lag, plan for slow/failed replicas

---

## Keywords

`replication` `master-slave` `primary-replica` `leader-follower` `master-master` `multi-master` `active-active` `read replica` `replication lag` `synchronous replication` `asynchronous replication` `semi-synchronous` `eventual consistency` `read-your-writes` `conflict resolution` `last-write-wins` `CRDT` `chain replication` `quorum replication` `statement-based replication` `row-based replication` `logical replication` `replication log` `binlog` `WAL (Write-Ahead Log)` (Write-Ahead Log) `change data capture` (CDC) `Kafka CDC` `split-brain` (see Failover) `failover promotion` `read scaling` `ACID (Atomicity, Consistency, Isolation, Durability)`
