# 10. Failover in System Design: Active-Passive Guide

---

## TL;DR

Failover automatically switches traffic from a failed primary system to a standby backup, ensuring continuous service. Active-passive uses a hot standby that takes over when primary fails. Active-active distributes load across multiple live systems. Detection via heartbeats + health checks triggers the switch.

> **Cheat Sheet**: Active-Passive = one handles traffic, one waits | Active-Active = both handle traffic | Detection via heartbeat + health checks | Watch for split-brain (both think they're primary) | RTO (Recovery Time Objective) depends on cold vs hot standby

---

## ELI5 — Explain Like I'm 5

Imagine you're flying in a plane. The pilot is flying the plane (primary). The co-pilot sits next to them doing nothing — but they're **watching** the pilot every 2 seconds asking: "You okay?"

- If the pilot says "yes" → everything is normal
- If no response for 15 seconds → co-pilot immediately grabs the controls

That's **failover**. Hot standby = co-pilot already seated and ready. Cold standby = co-pilot needs to be called from the back of the plane first.

**Active-Active** = both pilot AND co-pilot are actively flying together. If one falls sick, the other is already in control — seamless.

---

## The Analogy

> Think of failover like a backup pilot on a commercial flight.
> - **Active-Passive**: Co-pilot monitors but only takes over if captain is incapacitated — brief transition
> - **Active-Active**: Both pilots fly together; one getting sick doesn't affect anything
> - **Heartbeat**: The co-pilot constantly asking "Are you okay?" — takes over the moment there's no response

---

## Core Concept

Failover = availability pattern that maintains service by **automatically redirecting traffic** from a failed component to a healthy backup.

Three components:
1. **Primary** — handles all production traffic
2. **Standby(s)** — ready to take over (idle or read-only)
3. **Detection mechanism** — monitors health and triggers the switch

The hard parts:
- How **quickly** you detect failure
- How **seamlessly** you transfer state
- How you **prevent split-brain** (both nodes thinking they're primary)

---

## How It Works

```
Normal Operation:
  Clients → Load Balancer → [Primary Server] → Shared DB
                              ↓ heartbeat every 2s
                           Monitoring System ← Standby (replicating)

Primary Fails:
  1. Heartbeat stops arriving
  2. Monitoring waits 10–30 seconds (grace period for transient blips)
  3. After 3 missed heartbeats → declare primary failed
  4. Trigger: promote standby
     - Verify data sync
     - Promote to primary
     - Update routing config (DNS / Load Balancer)
  5. Clients → Load Balancer → [Standby (now primary)]

Total RTO (Recovery Time Objective): 15–45 seconds (hot standby)
```

### Detection Timeline

```
[Primary Healthy]
      │
      ▼
  Send heartbeat every 2s
      │
  Heartbeat received? ──No──► Increment miss counter
      │                              │
     Yes                     Missed >= 3?
      │                        │       │
  Reset counter               No      Yes
                               │       │
                           Wait grace  Run health checks
                           period      (TCP, HTTP, App-level)
                                           │       │
                                      All pass?   Fail
                                         │         │
                                    False alarm   FAILOVER
                                    Reset counter  Promote standby
```

> **Trade-off**: Short timeout = faster recovery but more false positives. Long timeout = fewer false alarms but longer outages.

---

## Active-Passive vs Active-Active

```
Active-Passive:
  Load Balancer
       │ 100% traffic
       ▼
  [Primary Server]  ──replication──►  [Standby Server]
  Handles all writes                  Idle / Read-only
                                      (takes over on failure)

Active-Active:
  Load Balancer
   │ 50%         │ 50%
   ▼             ▼
[Node 1]  ⟷  [Node 2]
Handles writes  Handles writes
       ↕  cross-replication
```

| Dimension | Active-Passive | Active-Active |
|---|---|---|
| **Recovery Time** | 10–30s (hot standby), 5–10m (cold) | 1–2s (just stop routing) |
| **Resource Efficiency** | 50% waste (standby idle) | 100% utilization |
| **Consistency** | Single writer — simple | Concurrent writes — complex |
| **Best For** | Databases, stateful services | Stateless APIs, read-heavy |
| **Cost** | Pay for idle capacity | All capacity active |

---

## Standby Types

| Type | Startup Time | Resource Cost | Typical RTO (Recovery Time Objective) |
|---|---|---|---|
| **Hot Standby** | Already running, data warm | High (full capacity) | 10–30 seconds |
| **Warm Standby** | Running minimal processes | Medium | 1–5 minutes |
| **Cold Standby** | Powered off, must boot | Low | 5–10 minutes |

> Production rule: Hot standbys for critical paths, cold standbys for non-critical components.

---

## The Split-Brain Problem

```
Split-Brain (DANGEROUS):
  ❌ Network Partition between Primary and Standby

  Client A          Client B
     │                  │
     ▼                  ▼
  [Primary]          [Standby]
  balance=$100       balance=$50
  (thinks it's       (thinks it's
   primary)           primary)

  → Two conflicting writes → Data corruption
```

### Prevention Mechanisms

**1. Quorum-Based Writes (Cassandra, Raft)**
```
Write request must reach majority (2 of 3) replicas:
  Primary → Replica 1 ✓
  Primary → Replica 2 ✓    ← Quorum achieved (2/3)
  Primary → Replica 3 ✗ (network partition)

  Value commits ✓ (quorum reached)
  If only 1 replica reachable → write REJECTED
```

**2. Distributed Lock / Lease (etcd, ZooKeeper)**
```
  Primary ──renew lease──► Consensus System (etcd)
                                 │
  Standby ──request lease──►  DENIED (primary has it)
                                 │
  lease expires after timeout → Standby can acquire
```

**3. STONITH** (Shoot The Other Node In The Head)
- Forcibly powers down the old primary via hardware/API (Application Programming Interface)
- Ensures only one primary can operate

---

## Key Principles

### 1. Health Detection Accuracy
Use multiple signals to distinguish real failures from transient blips:
- **Heartbeat** (network pulse): Is the node reachable?
- **Health check endpoints** (HTTP 200?): Is the app responding?
- **Resource metrics** (CPU/memory): Is the system healthy?

> Discord voice servers: heartbeat every 2s + audio encoding check, 15s timeout. Catches server crashes without triggering on brief network blips.

### 2. State Synchronization
Standby must have recent-enough state to take over:
- **Synchronous replication** = zero data loss, higher write latency
- **Asynchronous replication** = possible data loss, lower latency

> Twitter timeline service: async replication, accepts 1–2s lag. Small risk of re-fetching recent tweets — acceptable trade-off for latency.

### 3. Fencing / Split-Brain Prevention
Old primary MUST NOT continue operating after failover.
- Use distributed consensus (etcd, ZooKeeper) for lease-based primary election
- Use STONITH to forcibly terminate old primary
- Use quorum for writes (Cassandra: 2 of 3 replicas must agree)

---

## Common Pitfalls

### Pitfall 1: Split-Brain
- **Cause**: Network partition — both nodes declare themselves primary
- **Fix**: Quorum writes, distributed locks, STONITH

### Pitfall 2: Cascading Failures During Failover
- **Cause**: New primary overwhelmed by cold caches + full traffic spike → it also crashes
- **Fix**: Keep standbys warm (serve reads), gradual traffic shift (10% → 50% → 100%), circuit breakers

### Pitfall 3: Stale DNS (Domain Name System) Caching
- **Cause**: DNS (Domain Name System) TTL (Time To Live) too high (hours) → clients keep hitting old primary IP
- **Fix**: Low TTL (30–60s) for critical services, OR use **load balancer failover** (no DNS (Domain Name System) changes needed)

---

## Real-World Examples

### Netflix — Cassandra (Active-Active, Multi-AZ)

> **MERN dev note — why Cassandra over MongoDB for Netflix watch state?**
> Netflix needs to write viewing activity (pause position, play history) from **all 3 global regions simultaneously** — true active-active. MongoDB Atlas does support multi-region clusters, but writes still route to a single primary (typically in one region); cross-region writes add 50–150ms. Cassandra is **masterless**: the US, EU, and Asia nodes are all equal — each region writes locally at <5ms. For Netflix's query pattern (`GET watch_position WHERE user_id = X AND content_id = Y`), Cassandra's partition key model is a direct match. MongoDB would be the better pick for Netflix's metadata service (movie details, search) where queries need flexible filtering — that's exactly what MongoDB's query engine excels at.

- 3 AWS (Amazon Web Services) availability zones, each with full data replica
- AZ failure → load balancer stops routing there instantly
- Cassandra quorum reads/writes (2 of 3) → strong consistency even during failures
- Sub-second failover, 99.99% availability

### Discord — Voice Servers (Active-Passive, Hot Standby)
- Heartbeat every 2s, 3 missed = 6s timeout → promote standby
- Standby sends reconnection signals → clients reconnect in ~10 seconds
- Cost-effective: standbys cheaper than full active-active for voice

### Stripe — Payment API (Active-Active, Multi-DC)
- All data centers can handle full load
- Health checks on error rate + latency → failed DC removed in 5 seconds
- Idempotency keys allow safe retries across data centers
- 99.99%+ availability with strong consistency for payments

---

## Netflix-Style Multi-Region Architecture

```
  Global Load Balancer (Route 53)
    │                │                │
    ▼                ▼                ▼
us-east-1         us-west-2        eu-west-1
 60% traffic       30% traffic      10% traffic
[App][Redis]      [App][Redis]     [App][Redis]
[Cassandra R1] [Cassandra R2] [Cassandra R3]
       ↕ quorum replication ↕         ↕

us-east-1 (AZ-1c) fails:
  Regional LB removes from pool in 5s
  Global LB rebalances: us-east-1 40%, us-west-2 40%, eu-west-1 20%
```

---

## RTO (Recovery Time Objective) Calculation

```
RTO (Recovery Time Objective) = Detection Time + Promotion Time + Routing Update Time

DNS (Domain Name System)-based failover (TTL=60s):
  Detection:   10–30s
  Promotion:   5–10s
  DNS (Domain Name System) TTL (Time To Live):     up to 60s
  ─────────────────────
  Total RTO (Recovery Time Objective):   ~75–100 seconds

Load Balancer-based failover (hot standby):
  Detection:   10–30s
  Promotion:   5–10s
  LB update:   1–2s
  ─────────────────────
  Total RTO (Recovery Time Objective):   ~15–45 seconds

Active-Active (load redistribution):
  Detection:   1–5s (health check interval)
  No promotion needed
  LB reroute:  1–2s
  ─────────────────────
  Total RTO (Recovery Time Objective):   ~2–7 seconds
```

---

## Interview Cheat Sheet

### Mid-Level Expectations
- Explain active-passive vs active-active with examples
- Describe heartbeat detection and typical timeout values
- Trade-off: recovery time vs false positive rate
- Identify which components need failover in a design

### Senior Expectations
- Handle edge cases: split-brain, cascading failures, partial partitions
- Calculate RTO (Recovery Time Objective): detection + promotion + DNS (Domain Name System)/LB propagation
- Integrate with replication (sync vs async) and its consistency implications
- Discuss fail-back (returning to original primary after recovery)

### Staff+ Expectations
- Multi-region strategies: balance latency, cost, data residency
- Consensus-based (Raft/Paxos) failover for distributed systems
- Zero-downtime failover: sync replication + connection draining + gradual traffic shift
- Chaos engineering to test failover at scale

---

## Common Interview Questions

1. **How do you implement failover for stateful database vs. stateless API (Application Programming Interface) server?**
   - DB: sync/async replication, promote standby, point writes to new primary
   - API (Application Programming Interface): stateless, active-active trivial — just remove from LB pool

2. **What if the network between primary and standby breaks but both are healthy?**
   - Split-brain scenario → quorum (only majority partition can accept writes) or STONITH

3. **Active-passive vs active-active for a payment system?**
   - Payments need strong consistency → active-passive (single writer)
   - UNLESS you use idempotency keys + quorum reads (Stripe's approach)

4. **DNS (Domain Name System)-based vs LB-based failover — what's the RTO (Recovery Time Objective) difference?**
   - DNS (TTL=60s): ~75–100s. LB-based: ~15–45s. Active-Active: ~2–7s

5. **How do you test failover without causing a production outage?**
   - Chaos engineering in staging, then gradual production chaos (like Netflix's Chaos Monkey)
   - Kill non-critical replicas, verify LB reroutes correctly

---

## Red Flags to Avoid

- ❌ Not mentioning split-brain or assuming it can't happen
- ❌ Claiming failover is instant (ignoring detection + promotion + routing update time)
- ❌ Choosing active-active for strongly consistent systems without explaining conflict resolution
- ❌ Not accounting for idle standby cost vs cost of downtime
- ❌ Forgetting that failover itself can cause cascading failures if not careful

---

## Key Takeaways

- **Active-Passive**: 10–30s RTO (hot standby), single writer = simpler consistency
- **Active-Active**: 1–2s RTO (just stop routing), but complex coordination for writes
- **Detection**: heartbeat + health checks with 10–30s timeout; balance false positives vs latency
- **Split-brain** is the most dangerous failure mode → fencing, quorum, or STONITH
- **Hot standby** wastes 50% capacity; calculate cost of downtime vs cost of redundancy
- **Always test failover** — untested mechanisms fail when you need them most (chaos engineering)

---

## Keywords

`failover` `active-passive` `active-active` `hot standby` `cold standby` `heartbeat` `health check` `split-brain` `STONITH` `fencing` `quorum` `RTO (Recovery Time Objective)` (Recovery Time Objective) `RPO (Recovery Point Objective)` (Recovery Point Objective) `DNS (Domain Name System) failover` `TTL (Time To Live)` `replication lag` `etcd` `ZooKeeper` `Raft` `Paxos` `circuit breaker` `cascading failure` `chaos engineering` `fail-back` `promotion` `master-slave` `master-master` `connection draining`
