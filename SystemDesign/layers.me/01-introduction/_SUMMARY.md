# M1 — Introduction: Quick-Review Summary

> 3 topics | ~37 min total | Covers: What, How, Math

---

## Topics at a Glance

| # | Topic | One-Liner |
|---|---|---|
| T01 | What is System Design | Blueprint for building software that works for millions — architecture decisions, not code |
| T02 | How to Approach Interviews | 6-step framework: Requirements → Estimate → API → HLD → Deep Dive → Bottlenecks |
| T03 | Back-of-the-Envelope Estimation | Turn DAU into QPS/Storage/Bandwidth in 2 minutes with directional math |

---

## T01 — What is System Design

**Definition**: Making smart choices about how components connect so things don't explode at scale.  
Not about writing code — about architecture decisions *before* code.

### The 4 Pillars

| Pillar | ELI5 | Trade-off |
|---|---|---|
| **Scalability** | Can it handle 1M users, not just 1K? | Complexity ↑ |
| **Reliability** | Does it survive crashes gracefully? | Cost ↑ |
| **Availability** | Is it up 99.999% of the time? | Consistency risk ↑ |
| **Maintainability** | Easy to change / debug? | Design time ↑ |

> These 4 conflict with each other. Good design = right trade-offs for the requirements.

### Decision Layers
```
Requirements (Functional & Non-Functional)
        ↓
High-Level Design (Architecture & Components)
        ↓
Data Model & Flow
        ↓
Non-Functional Requirements → Scalability / Reliability / Availability / Maintainability
```

### Interview Level Signals
- **Junior**: "just add more servers" ❌
- **Mid**: knows cache/sharding/replication patterns ✅
- **Senior**: justifies trade-offs with *numbers* ✅✅
- **Staff+**: anticipates failure modes, connects to business outcomes ✅✅✅

---

## T02 — How to Approach System Design Interviews

### The 6-Step Framework

| Step | Time | Action |
|---|---|---|
| **1. Requirements** | 5–8 min | Clarify functional + non-functional; define scope |
| **2. Capacity Estimation** | 3–5 min | QPS, storage, bandwidth |
| **3. API Design** | 3–5 min | REST/RPC endpoints — the contract |
| **4. High-Level Design** | 10–15 min | Draw the big boxes: LB → App → DB + Cache |
| **5. Deep Dive** | 15–20 min | Interviewer picks a component; go deep |
| **6. Bottlenecks** | 5–8 min | Failure points, trade-offs, mitigations |

### Requirements Gathering (Split Always)

| Functional (what it does) | Non-Functional (how well) |
|---|---|
| Generate short URLs | Scale: 100M DAU |
| Redirect to original | Availability: 99.9% |
| Custom aliases (optional) | Latency: <100ms redirect |
| Analytics tracking | Read:Write = 100:1 |
| ❌ URL editing (out of scope) | Data retention: 5 years |

> **Red flags**: buzzwords without reasoning, skipping requirements, ignoring failure scenarios.

---

## T03 — Back-of-the-Envelope Estimation

### Critical Formulas

```
Average QPS = (DAU × actions_per_user) ÷ 86,400
Peak QPS    = Average QPS × 10

Storage     = records × size_per_record × retention_days × 3 (replication) × 1.3 (overhead)

Bandwidth   = QPS × avg_response_size_bytes × 8

Cache size  = total_data_size × 0.20   (80/20 rule: 20% data = 80% reads)
```

### Quick Unit Reference

| Unit | Value | Rule |
|---|---|---|
| 1 KB | 10³ bytes | 1M req/day ≈ 12 QPS avg |
| 1 MB | 10⁶ bytes | Peak = avg × 10 |
| 1 GB | 10⁹ bytes | 3× for replication |
| 1 TB | 10¹² bytes | Storage × 1.3 overhead |

### Latency Numbers Every Engineer Must Know

| Operation | Latency | Design Implication |
|---|---|---|
| L1 Cache | 0.5 ns | — |
| RAM Access | 100 ns | Cache hot data — 1,000× faster than SSD |
| SSD Read | 150 μs | Use SSD-backed DBs |
| Disk Seek | 10 ms | Avoid for latency-sensitive paths |
| Network (same DC) | 0.5 ms | Minimize inter-service calls |
| Cross-continent | 150 ms | Use CDN for global users |

> RAM is ~1,000× faster than SSD. Network is ~100,000× slower than RAM. This explains why caching and CDNs exist.

### Availability Nines

| Uptime | Downtime/Year | What It Takes |
|---|---|---|
| 99% (2 nines) | 87.6 hours | Single region, basic backups |
| 99.9% (3 nines) | 8.7 hours | Multi-AZ, DB replication |
| 99.99% (4 nines) | 52 min | Multi-region, automated failover |
| 99.999% (5 nines) | 5.3 min | Active-active global, chaos engineering |

### Twitter-Scale Example

```
500M DAU × 10 timeline loads/day = 5B reads/day
Average read QPS:  5B ÷ 86,400 = 57,870
Peak read QPS:     57,870 × 10 = 578,700

200M tweets/day × 300B = 60 GB/day raw
5-year storage (3× replication): 60 × 365 × 5 × 3 = 328 TB
```

---

## Interview Cheat Sheet — M1

| Question | Answer |
|---|---|
| What is system design? | Architecture decisions (not code) about how components connect to handle scale |
| First thing in interview? | Ask clarifying questions — functional AND non-functional requirements |
| How to handle vague scope? | "I'll assume X for now — let me know if you want a different scope" |
| Peak QPS rule of thumb? | Average QPS × 10 |
| 99.99% availability = how much downtime? | 52 min/year |
| How to size a cache? | Total data × 0.20 (80/20 rule handles 80% of reads) |
| Why does RAM beat SSD? | 1,000× faster — justifies caching investment |

---

## Keywords

`HLD` · `scalability` · `reliability` · `availability` · `maintainability` · `SPOF` · `QPS` · `DAU` · `latency` · `throughput` · `nines` · `SLA` · `capacity estimation` · `back-of-the-envelope` · `80/20 rule`
