# 08 — Strong Consistency in Distributed Systems Explained

**Module:** Core Concepts & Trade-offs | **Level:** Intermediate

---

## ELI5 Summary

- **Strong consistency** = every client sees the **exact same data at the exact same time**, as if the system is one single machine
- After a write completes, **every subsequent read returns that value** — no stale reads, ever
- The cost: writes must wait for **multiple replicas to confirm** before returning success → higher latency
- Achieved via **consensus protocols** (Raft, Paxos) and **quorum-based replication**
- Essential for: bank balances, inventory, payments, Kubernetes config — where wrong data = disaster

---

## The Google Docs Analogy

- Shared Google Doc: every keystroke **instantly visible to all viewers**
- Alice types "Hello" → Bob refreshes 1ms later → he sees "Hello", never a blank doc
- Email = eventual consistency (your message may take seconds to arrive)
- Strong consistency **pays the coordination price** to ensure perfect agreement

---

## Core Concept: How It Works

```
WRITE FLOW (Strong Consistency, 3 replicas, quorum=2):
  Client → Leader
  Leader → Replica 1 (sync) → ACK ✓
  Leader → Replica 2 (sync) → ACK ✓
  Write success returned to client only after quorum (2/3) confirmed

  Duration: 10–100ms (vs 1–10ms for eventual)

READ FLOW:
  Client reads from any quorum of 2 replicas
  At least 1 of the 2 read replicas overlaps with write quorum
  → GUARANTEED to see latest write (no stale read possible)
```

---

## Quorum Overlap: Why It Works

```
3 replicas: Node A, Node B, Node C
Write quorum = 2 (any 2 must confirm)
Read quorum  = 2 (read from any 2)

Write succeeds on: A + B
Read hits:         B + C   ← B overlaps! Returns latest value ✓

Write succeeds on: A + B
Read hits:         A + C   ← A overlaps! Returns latest value ✓

Write succeeds on: A + B
Read hits:         A + B   ← both overlap ✓

Guarantee: read quorum ∩ write quorum ≥ 1
           (R + W > N ensures overlap)
```

---

## Latency Comparison: Strong vs Eventual

```
EVENTUAL (3ms):                  STRONG (66ms):
  Client → Any Replica            Client → Leader
  Local write (1ms)               Leader → Replica 1 (cross-DC: 20ms + ACK 20ms)
  ACK (2ms)                       Leader → Replica 2 (cross-DC: 25ms + ACK 25ms)
  Async replicate (background)    Quorum reached → ACK to client
  Total: ~3ms                     Total: ~66ms  (22x slower)
```

---

## Key Consistency Models (Strongest → Weakest)

| Model | Guarantee | Example |
|---|---|---|
| **Strict Serializability** | Linearizable + serializable transactions | Google Spanner |
| **Linearizability** | Single-object ops appear atomic; real-time order | etcd, ZooKeeper |
| **Serializability** | Multi-object transactions; any serial order OK | PostgreSQL (SERIALIZABLE) |
| **Sequential Consistency** | All clients see ops in same order; not real-time | Some older systems |
| **Causal Consistency** | Only causal ops ordered | MongoDB (causal sessions) |
| **Eventual Consistency** | Replicas converge eventually | DynamoDB, Cassandra |

---

## Consensus Protocols

### Raft (used by etcd, CockroachDB)
```
1. Leader election → one leader handles all writes
2. Client writes → Leader appends to log
3. Leader replicates log entry to followers
4. Quorum (majority) ACKs → commit
5. Leader sends commit notice → followers apply

Fault tolerance: N=3 → tolerate 1 failure
                N=5 → tolerate 2 failures
Formula: can tolerate f failures with 2f+1 nodes
```

### Paxos (used by Google Spanner, Zookeeper)
- Similar concept — leader proposes, majority accepts, commit when quorum agrees
- More general but harder to implement than Raft

---

## Google Spanner: Global Strong Consistency

```
Regions: US-East, Europe, Asia (3 Paxos groups)

Transaction:
  1. Read from local Paxos group
  2. Write → 2-Phase Commit across all regions
  3. TrueTime assigns commit timestamp (GPS + atomic clocks, ±7ms uncertainty)
  4. Wait 7ms uncertainty window
  5. Commit with timestamp T → all later transactions see this commit

Latency: 100–500ms cross-region writes
Used for: AdWords billing, Google Play transactions
"If A commits before B starts anywhere in the world → A's timestamp < B's"
```

---

## Linearizability vs Serializability (Senior+ distinction)

| | Linearizability | Serializability |
|---|---|---|
| **Scope** | Single object/key | Multi-object transactions |
| **Real-time order** | Required | Not required |
| **Example** | etcd key read/write | Bank transfer (debit + credit) |
| **Analogy** | Atomic compare-and-swap | Database transaction |

**Strict serializability** = both (Spanner provides this globally)

---

## Real-World Examples

### Google Spanner
- Global ACID transactions using **TrueTime** (GPS + atomic clocks)
- Waits out ±7ms clock uncertainty before committing
- 100–500ms cross-region write latency accepted
- Use: AdWords billing, Play Store — **double-charging is unacceptable**

### etcd (Kubernetes control plane)
- Uses **Raft** for cluster state (pods, services, deployments)
- Delete a pod → all K8s components see it deleted immediately (no ghost scheduling)
- 5–20ms per operation; correctness > performance for config changes
- Split-brain = two schedulers placing same pod on two nodes = catastrophic

### Stripe (Payment Processing)
- **PostgreSQL** with synchronous replication + **idempotency keys**
- Client retries same payment → Stripe checks key in strongly consistent DB → returns original result, no double charge
- 10–20ms latency accepted on payment path
- Analytics events = eventual consistency; payments = always strong

---

## Trade-offs Summary

| Dimension | Strong Consistency | Eventual Consistency |
|---|---|---|
| **Latency** | 10–500ms (coord. overhead) | 1–10ms (local) |
| **Availability during partition** | May reject requests (CP) | Always responds (AP) |
| **Throughput** | ~10K–100K writes/sec (leader bottleneck) | Millions writes/sec |
| **Scalability** | Limited by quorum; sharding needed for scale | Horizontal by adding replicas |
| **Dev simplicity** | Simple: data is always correct | Complex: handle stale reads, conflicts |

---

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| "Strong consistency is free" | Always benchmark latency in your topology — cross-DC adds ms per region |
| Confusing "strong" with "serializable" | Linearizability = single-object real-time; serializability = multi-object txn |
| Ignoring availability impact | 3 nodes, quorum=2: lose 2 nodes → system unavailable. Plan for this. |
| Applying strong consistency everywhere | Use hybrid — strong for payments, eventual for feeds |

---

## Quorum Math (Senior must know)

```
N = total replicas
W = write quorum (must confirm)
R = read quorum (must agree)

For strong consistency: W + R > N  (ensures overlap)

Common configurations:
  N=3, W=2, R=2 → tolerate 1 failure   (e.g., Cassandra QUORUM)
  N=5, W=3, R=3 → tolerate 2 failures
  N=3, W=3, R=1 → strong writes, fast reads (but W=3 = no tolerance)

Fault tolerance formula: f = ⌊(N-1)/2⌋ failures tolerated for consensus
```

---

## Interview Cheat Sheet

| Level | Expectation |
|---|---|
| **Mid** | Define strong consistency; explain quorum; give 2 use cases (bank, Kubernetes); contrast with eventual (latency/availability tradeoff) |
| **Senior** | Distinguish linearizability vs serializability; explain Raft flow; quantify latency (5–10x); discuss hybrid designs; quorum math |
| **Staff+** | Design global consistency (Spanner / TrueTime approach); hybrid consistency; Jepsen testing; lease-based reads; strict serializability; CAP trade-off articulation |

**Common Questions:**
- "Difference between linearizability and serializability?" → Linear = single-object real-time; Serial = multi-object txn any order
- "How does Raft achieve strong consistency?" → Leader election → log replication to quorum → commit after majority ACK
- "Why is strong consistency slower?" → Synchronous replication + quorum waits = network round-trips
- "When NOT to use strong consistency?" → Social feeds, analytics, view counts — high throughput + staleness acceptable
- "How to test for consistency violations?" → Jepsen (injects partitions, detects stale reads / lost writes)

**Red Flags:**
- "Strong consistency is always better" — it costs 5–10x latency + availability loss
- Confusing consistency with durability (written to disk) or replication (multiple copies)
- Not knowing the CAP implication (CP = availability sacrifice during partition)
- Can't explain quorum overlap requirement

---

## Key Takeaways

1. Strong consistency = **linearizability**: single-machine illusion for distributed system
2. **Quorum writes**: write succeeds only after majority of replicas confirm (W + R > N)
3. **Consensus protocols** (Raft/Paxos) implement strong consistency via leader + log replication
4. Costs **5–20x more latency** than eventual consistency; reduces availability (CP in CAP)
5. Use when: **correctness matters more than speed** — payments, inventory, config stores
6. **Spanner** = strictest (global linearizability + serializability via TrueTime)
7. **etcd** = Raft-based, used for Kubernetes cluster state
8. Hybrid systems: strong for critical paths, eventual for high-volume reads

---

## Keywords

`strong consistency` `linearizability` `serializability` `strict serializability` `Raft` `Paxos` `quorum` `leader election` `consensus` `replication log` `two-phase commit (2PC)` `TrueTime` `Google Spanner` `etcd` `ZooKeeper` `CockroachDB` `synchronous replication` `quorum reads` `idempotency` `split-brain` `Jepsen` `CAP theorem CP` `atomic operations`
