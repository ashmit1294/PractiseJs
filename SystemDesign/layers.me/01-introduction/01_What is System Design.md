# What is System Design? A Complete Guide

> **Source:** https://layrs.me/course/hld/01-introduction/what-is-system-design
> **Level:** Beginner | **Read:** ~13 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **System Design** | Blueprint for building software that works for millions of people |
| **Scalability** | Can your system grow without breaking? |
| **Reliability** | Does it still work when parts break? |
| **Availability** | Is it up when users need it? |
| **Maintainability** | Can engineers change it without pain? |

> **Key Insight:** System design = making smart choices about **how** components talk to each other so things don't explode at scale. It's not about writing code — it's about architecture decisions *before* you write code.

---

## The Analogy — City Infrastructure

- **Small town** → single road, one power plant, volunteer fire dept. Fine for 1,000 people
- **City of millions** → highway networks, multiple power grids, distributed fire stations
- **You can't just widen the road** — you need a *fundamentally different architecture*
- System design = planning that city *before* it grows, not after it collapses

---

## Why This Matters in Interviews

- **Companies ask this** because algorithms alone tell them nothing about real production thinking
- **What interviewers want to see:**
  - Can you break ambiguous requirements into concrete decisions?
  - Do you understand trade-offs (consistency vs availability, latency vs throughput)?
  - Can you estimate capacity quantitatively?
- **Junior:** "just add more servers" ❌
- **Mid-level:** knows cache/sharding/replication patterns ✅
- **Senior:** justifies trade-offs with *numbers* ✅✅
- **Staff+:** anticipates failure modes, connects architecture to business outcomes ✅✅✅

> **Red flags in interviews:** buzzwords without reasoning, skipping requirements, not discussing failure scenarios

---

## Core Concept

### What It Is

- **HLD (High-Level Design):** Define the big boxes — web servers, databases, caches, message queues, and how they connect
- **Data Model & Flow:** What entities exist? How does data move when a user clicks something?
- **Non-Functional Requirements:** The quality attributes that determine if it *actually works* in production

### The 4 Pillars

| Pillar | ELI5 | Real Example |
|---|---|---|
| **Scalability** | Can it handle 1M users, not just 1K? | Instagram: started monolith → sharded PostgreSQL → Redis → distributed storage |
| **Reliability** | Does it survive crashes gracefully? | Netflix Chaos Monkey: randomly kills servers to test resilience |
| **Availability** | Is it up 99.999% of the time? | DynamoDB: replicates across zones, leaderless model, ~5 mins downtime/year |
| **Maintainability** | Easy to add features / debug? | Stripe: API versioning, full observability, strong typing |

> **Critical tension:** These 4 pillars conflict with each other. Designing for all of them simultaneously is impossible — you pick the right trade-offs for your requirements.

---

## Flowchart 1 — System Design Decision Layers

```
Requirements (Functional & Non-Functional)
         ↓
High-Level Design (Architecture & Components)
         ↓
Data Model & Flow (Entities & Interactions)
         ↓
Non-Functional Requirements → Scalability / Reliability / Availability / Maintainability
         ↑_____________________________↑  (feedback loops shape entire design)
```

---

## Flowchart 2 — Architecture Evolves with Scale

```
1K Users     → Single Server (App + DB)                   ~10 req/sec
     ↓
10K Users    → Bigger instance + Read Replica + Redis Cache
     ↓
100K Users   → Load Balancer + 3 App Servers + Redis Cluster + CDN for static assets
     ↓
1M+ Users    → API Gateway + Microservices + Kafka + DB Shards + Distributed Cache (multi-region)
```

> Key rule: **You can't just add more servers at each stage.** Each order of magnitude requires *rethinking* the architecture.

---

## Flowchart 3 — CAP Theorem: Consistency vs Availability

```
Network Partition Occurs (nodes can't sync)
         ↓
   ┌─────────────────────────────────────┐
   │ Choice A: Prioritize Consistency    │
   │ → Return error (can't verify latest)│
   │ → Used by: Banking systems          │
   └─────────────────────────────────────┘
         OR
   ┌─────────────────────────────────────┐
   │ Choice B: Prioritize Availability   │
   │ → Return stale data (v1 not v2)     │
   │ → Used by: Social media feeds       │
   └─────────────────────────────────────┘
```

> **CAP Theorem says:** In a distributed system during a network partition, you MUST pick one — you can't have both consistency AND availability simultaneously.

---

## Flowchart 4 — Uber Ride Request Flow (Simplified)

```
Rider App
  → API Gateway
  → Location Service (geospatial query — quadtree index for nearby drivers)
  → Driver Matching Engine (optimize: distance, rating, ETA)
  → Dispatch to Driver
  → Driver Accepts
  → Trip in Progress
  → Payment Service (ACID transaction — strong consistency)
  → Receipt to Rider
```

> Different parts use **different consistency models**: payments = strong consistency; trip history = eventual consistency.

> **ACID (Atomicity, Consistency, Isolation, Durability)** — the four guarantees of a safe database transaction. **A**tomicity: all steps succeed or all are rolled back. **C**onsistency: DB stays in a valid state. **I**solation: concurrent writes don’t corrupt each other. **D**urability: committed data survives crashes. Payments require ACID — a $200 charge must either fully succeed or fully roll back, never left half-done. [Full breakdown → M6-T01: Databases Overview]

---

## Flowchart 5 — Netflix Architecture (Simplified)

```
User Device (Web/Mobile/TV)
  → Zuul API Gateway (routing & auth)
  → Auth Service / Profile Service / Recommendation (ML) / Playback Service
  → EVCache (distributed Memcached) ← reduces DB load by 99%
  → Cassandra (viewing history — eventual consistency OK here)
  → AWS S3 (video storage)
  → Open Connect CDN (ISP-level edge caching — where actual video streams from)
```

---

## Deep Dive — Scale Progression

| Scale | Problem | Solution |
|---|---|---|
| **1K users** | Nothing breaks | Monolith on one server |
| **10K users** | DB queries slow | Add read replicas + Redis cache |
| **100K users** | Web server overloaded | Load balancer + multiple app servers |
| **1M users** | DB is bottleneck | DB sharding + CDN for static files |
| **10M+ users** | Everything is distributed | Microservices + Kafka + multi-region |

---

## Architectural Evolution

- **Monolith** → Single codebase, one deployment. Fast to build. Right for early-stage.
- **SOA (Service-Oriented Architecture)** → Split into coarse-grained services (user, payment, inventory)
- **Microservices** → Fine-grained, each service has its own DB + deployment
  - **Benefits:** Independent scaling, team autonomy
  - **Costs:** Distributed tracing, service discovery, eventual consistency, operational overhead

> Rule: **Architecture should match your org size and scale needs**, not follow trends.

---

## Trade-offs Reference

| Trade-off | Option A | Option B | How to Decide |
|---|---|---|---|
| **Consistency vs Availability** | Strong (banks, payments) | Eventual (social feeds, analytics) | Based on business requirement |
| **Latency vs Throughput** | Low latency (gaming, video calls) | High throughput (data pipelines, batch jobs) | User-facing = latency; background = throughput |

---

## Common Pitfalls

- **Premature Optimization** — Designing for 1B users when you have 1K. Start simple. *Instagram was a monolith until millions of users.*
- **Ignoring Operational Complexity** — "Microservices!" sounds great until you're debugging across 15 services with no tracing. Always ask: *who's on-call when this breaks?*
- **Designing Without Requirements** — Never draw boxes before asking: How many users? Read/write ratio? Acceptable latency? Consistency needs?

---

## Real-World Examples

| Company | System | Key Design Choices |
|---|---|---|
| **Netflix** | Video Streaming | CDN inside ISPs, EVCache (99% DB load reduction), Cassandra for eventual consistency, replicated across AWS regions |
| **Uber** | Ride Matching | Quadtree for geospatial, Kafka for demand spikes, ACID for payments, Redis for driver locations |
| **Facebook** | News Feed | TAO cache (serves 99% reads), fan-out-on-write, MySQL sharded by user ID, eventual consistency for likes/comments |

---

## Interview Cheat Sheet

| Level | What They Expect |
|---|---|
| **Mid-Level** | Know load balancers, cache, DB replication, horizontal scaling. Design URL shortener or basic feed. |
| **Senior** | Quantitative estimates (req/sec, storage), multiple solution options with trade-offs, failure scenarios, monitoring |
| **Staff+** | System evolution strategy, org impact, cost implications, subtle failure modes (split-brain), business outcome linkage |

**Common Questions:**
- Design a URL shortener (CRUD, DB design, scaling)
- Design Instagram (image storage, feed, caching)
- Design Uber (geospatial, real-time, consistency)
- Design a rate limiter (distributed algorithms)
- Design Netflix (CDN, streaming, global distribution)

---

## Key Takeaways

- System design = **architecture decisions** so systems don't crash under load
- The **4 pillars** (scalability, reliability, availability, maintainability) drive all decisions — you can't max all four, choose based on requirements
- Architecture **must match scale** — 1K users ≠ 1M users design
- Every decision is a **trade-off**: consistency ↔ availability, latency ↔ throughput, simplicity ↔ flexibility
- In interviews: **requirements first → estimate → trade-offs → failure scenarios**

---

## Keywords

`system design` `scalability` `reliability` `availability` `maintainability` `latency` `throughput` `horizontal scaling` `vertical scaling` `ACID (Atomicity, Consistency, Isolation, Durability)` `BASE` `CAP theorem` `consistency` `eventual consistency` `strong consistency` `load balancer` `API gateway` `CDN (Content Delivery Network)` `cache` `relational database` `NoSQL` `microservices` `monolith` `replication` `sharding` `fault tolerance` `quadtree` `EVCache` `Kafka` `Redis` `TAO`
