# 09 — Availability Patterns: Active-Active & Failover

**Module:** Core Concepts & Trade-offs | **Level:** Intermediate

---

## ELI5 Summary

- Systems fail — hardware crashes, networks break, data centers lose power
- **Availability patterns** = strategies to keep the system running despite failures
- Three building blocks: **Redundancy** (multiple copies) + **Failover** (auto-switch on failure) + **Replication** (keep copies in sync)
- **Active-Passive**: one server works, one waits. Simple and cheap but slow to recover
- **Active-Active**: all servers work simultaneously. Fast recovery but complex and expensive
- You pick the pattern based on **uptime SLA + cost of downtime vs cost of redundancy**

---

## The Hospital Analogy

```
Main power grid = Primary server
Diesel generator = Standby (hot backup)
Battery backup   = Cache/CDN layer

Life support machines → Active-Active (multiple power sources simultaneously)
Hallway lights        → Active-Passive (generator kicks in after delay)

The hospital PAYS for this redundancy because downtime costs lives.
In system design: how much does YOUR downtime cost?
```

---

## Core Building Blocks

```
┌──────────────────────────────────────────────────────────────┐
│               HIGH AVAILABILITY REQUIRES ALL 3:              │
│                                                              │
│  REDUNDANCY          FAILOVER           REPLICATION          │
│  Multiple copies  +  Auto-switch     +  Keep in sync         │
│  of components       on failure         across copies        │
│                                                              │
│  Without any one of these, availability guarantee breaks.    │
└──────────────────────────────────────────────────────────────┘
```

- **RTO** (Recovery Time Objective) = time between failure and restored service
- **RPO** (Recovery Point Objective) = amount of data you can lose during a failure
- Sync replication → RPO ≈ 0 (zero data loss), but adds latency
- Async replication → RPO > 0 (may lose recent writes), but faster

---

## Active-Passive vs Active-Active

```
ACTIVE-PASSIVE:
  Load Balancer → Primary (all traffic) ←──sync──→ Standby (idle)
                                                 ↑
                                      Promoted when primary fails
  RTO: 30s–5min   Cost: 50% utilization   Consistency: Simple ✓

ACTIVE-ACTIVE:
  Load Balancer → Server 1 (50% traffic)
              → Server 2 (50% traffic)
  RTO: ~0s    Cost: 100% utilization   Consistency: Complex ⚠️
```

---

## Comparison Table

| Dimension | Active-Passive | Active-Active |
|---|---|---|
| **RTO** | 30s – 5min | Near-zero |
| **Infrastructure utilization** | 50% (standby is idle) | 100% |
| **Cost** | Lower ($) | Higher ($$–$$$) |
| **Consistency** | Simple (1 writer) | Complex (conflict resolution) |
| **Throughput** | Limited to primary | Multiplied across nodes |
| **Failover** | Promote standby | Remove failed node from pool |
| **When to use** | Moderate SLA, financial/strong-consistency workloads | High SLA, high-volume, eventual consistency acceptable |

---

## Active-Passive Variants

| Type | Description | Warm-up Time |
|---|---|---|
| **Hot Standby** | Backup running and ready, not taking traffic | 30s (detect + route) |
| **Warm Standby** | Backup provisioned but not running | 5–10min |
| **Cold Standby** | Backup must be provisioned from scratch | 10–30min |

---

## Geographic Active-Active Architecture

```
Global DNS (routes to nearest healthy region)
        │
   ┌────┼────┐
   │    │    │
US-East EU  Asia-Pacific
   │    │    │
 App  App  App
 DB   DB   DB
 (Primary A-M) (Primary N-Z) (Read Replica)
 Cache  Cache  Cache
   │    │    │
   └────┴────┘
     async cross-region replication (50–200ms)

Users connect to nearest region → low latency
If one region fails → DNS routes to next nearest → ~instant recovery
```

---

## Hybrid Pattern: Uber Example

```
     Rider request
           │
  Global Load Balancer
     /              \
DISPATCH (Active-Active)    PAYMENT (Active-Passive)
  Zone A | Zone B | Zone C     Primary only
  All zones serve traffic      Strong consistency required
  Async replication OK         Sync replication (zero data loss)
  If zone fails → 2s failover  If primary fails → 30s promote standby

Why? Dispatch downtime = lost trips (very expensive)
     Payment double-charge = regulatory disaster (choose consistency)
```

---

## Real-World Examples

### Uber — Trip Dispatch
- **Active-Active** across 3 availability zones per region
- Each zone has full dispatch service + DB replica
- Load balancer detects failure in **2 seconds**, reroutes immediately
- **BUT** payments use active-passive: sync replication to standby, 30s RTO

### Discord — Message Storage

> **MERN dev note — why Cassandra over MongoDB for Discord messages?**
> Discord handles **billions of messages** with write bursts across many regions simultaneously (active-active). MongoDB's architecture designates one primary per replica set — all writes must go through it, so cross-region writes incur latency AND the primary becomes a single point of write failure. Cassandra is **peer-to-peer with no primary** — every node in every region accepts writes at local speed. Discord's access pattern (`SELECT messages WHERE channel_id = X ORDER BY timestamp`) maps perfectly to Cassandra's partitioned wide-column model. MongoDB would win if Discord needed full-text search across messages or complex joins — that's where MongoDB's aggregation pipeline shines.

- **Active-Active Cassandra** with quorum writes (W=2, R=2 out of 3 replicas)
- Write succeeds if 2/3 replicas acknowledge → tolerates 1 failure
- Read requests 2 replicas → returns most recent version
- WebSocket gateways: active-active across regions → clients reconnect in 5s on failure

### Netflix — Streaming
- **Active-Active across 3 AWS regions** (US-East, US-West, EU)
- Automated failover; analytics only needs 99% availability
- Streaming needs 99.99% → active-active is justified
- Discovered DNS was a single point of failure → now uses **multiple DNS providers**

---

## Availability Pattern Decision Framework

```
What's your uptime SLA?
├── 99% (7.3h/month downtime OK)
│     → Single server + backups is probably fine
├── 99.9% (43min/month OK)
│     → Active-Passive, hot standby, single region
├── 99.99% (4min/month OK)
│     → Active-Active, multi-AZ
└── 99.999% (26s/month OK)
      → Active-Active, multi-region + chaos engineering

Strong consistency required?
├── Yes → Active-Passive (one writer = no conflicts)
└── No  → Active-Active (eventual consistency OK)
```

---

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| **"Redundancy = availability"** | Redundancy alone isn't enough — you need failover detection AND auto-switching |
| **Correlated failures** | Multiple servers in same DC? One power failure takes all down. Use multi-AZ / multi-region. |
| **Over-engineering** | "Active-active multi-region" sounds impressive but may cost millions for a 99.9% SLA problem |
| **Forgetting the LB itself** | Load balancer = single point of failure too. Make it redundant (VRRP, AWS ELB). |
| **Theoretical RTO ≠ actual RTO** | Always test failover with chaos engineering; measure real recovery time |

---

## Interview Cheat Sheet

| Level | Expectation |
|---|---|
| **Mid** | Explain active-passive vs active-active with examples; identify SPOFs; know RTO concept; know failover needs health checks |
| **Senior** | Pick pattern based on SLA + consistency needs; quantify cost vs downtime; discuss correlated failures; mention RTO/RPO tradeoffs; hybrid designs |
| **Staff+** | Quantify ROI of redundancy; design hybrid patterns per component; reference Uber/Netflix/Discord examples; address operational complexity (split-brain, fencing); chaos engineering |

**Common Questions:**
- "Design a highly available system for X" → Ask SLA first → choose pattern → justify
- "Active-passive vs active-active — when to use each?" → RTO: near-zero vs 30–300s; cost vs consistency
- "99.99% availability — what does that mean for architecture?" → 4 min downtime/month → multi-AZ active-active, instant failover
- "Consistency implications of active-active?" → Multi-master writes → potential conflicts → need conflict resolution

**Red Flags:**
- Active-active everywhere without considering cost or business need
- Not asking about SLA before choosing a pattern
- Forgetting the load balancer is also a SPOF
- "Redundancy alone = high availability" (need failover and replication too)

---

## Key Takeaways

1. **3 pillars of availability**: Redundancy + Failover + Replication — all required
2. **Active-Passive**: 1 primary + 1 standby → simple, cheap, 30s–5min RTO
3. **Active-Active**: all nodes serve traffic → near-zero RTO, but complex + expensive
4. **Match pattern to SLA**: 99.9% → active-passive; 99.99%+ → active-active
5. **Consistency constraint**: financial/inventory → active-passive; social/analytics → active-active
6. **Hybrid is common**: active-active for stateless API/dispatch + active-passive for payments/DB
7. **Test failover regularly** — theoretical RTO means nothing without validation
8. **Correlated failures**: avoid same DC/zone/provider — geographic spread is mandatory for true HA

---

## Keywords

`availability patterns` `active-passive` `active-active` `hot standby` `warm standby` `cold standby` `failover` `replication` `single point of failure (SPOF)` `RTO` `RPO` `health checks` `load balancer redundancy` `multi-AZ` `multi-region` `geographic redundancy` `correlated failures` `chaos engineering` `99.99% availability` `SLA` `master-slave` `multi-master` `quorum writes`
