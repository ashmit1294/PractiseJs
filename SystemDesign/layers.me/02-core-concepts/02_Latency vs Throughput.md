# Latency vs Throughput: System Design Trade-offs

> **Source:** https://layrs.me/course/hld/02-core-concepts/latency-vs-throughput
> **Level:** Intermediate | **Read:** ~10 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 | Unit |
|---|---|---|
| **Latency** | How long does ONE request take? | milliseconds (ms) |
| **Throughput** | How many requests can the system handle per second? | RPS / QPS / TPS |

> **Key Formula — Little's Law:** `Throughput = Concurrency / Latency`
>
> **Batching** → ↑ Throughput, ↑ Latency
> **Parallelism (horizontal scale)** → ↑ Throughput, ↓ or same Latency

---

## The Analogy — Highway Toll Booth

- **Latency** = how long it takes one car to get through (30 seconds)
- **Throughput** = how many cars are processed per hour (120 cars/hr)
- Make the attendant faster → lower latency
- Batch-process payments for multiple cars → higher throughput, but each car waits longer
- **Best solution: add more toll booths (horizontal scaling)** → low latency AND high throughput

---

## Core Concept

- **Latency** = total request lifecycle: network + queueing + processing + DB + serialization
- **Throughput** = how many requests can be processed concurrently and efficiently
- They are **often inversely related** — what improves one can degrade the other
- Different systems have different priorities:
  - **Stock trading** → ultra-low latency (microseconds), accepts lower throughput
  - **Batch analytics** → maximum throughput, latency doesn't matter per item
  - **User-facing APIs** → balance both, prioritize p99 latency

---

## Flowchart 1 — Latency Components (Where Time Goes)

```
Client
  ↓ 1. Network transmission      1–5 ms (same DC) | 50–200 ms (cross-region)
Load Balancer
  ↓ 2. Queue wait time           0–100 ms+ (grows fast under load)
Application Server
  ↓ 3. Processing time           10–1,000 ms
  ↓ 4. Database query            1–100 ms
  ↓ 5. Result serialization      1–10 ms
  ↓ 6. Response transmission     1–5 ms
Client

Total Latency = sum of all components
Example: 5ms + 20ms + 50ms + 30ms + 5ms + 5ms = 115ms
```

> **Key insight:** Under load, **queueing latency often dominates** everything else. Optimize the queue, not just the code.

---

## Flowchart 2 — Batching: The Throughput vs Latency Trade-off

```
WITHOUT BATCHING (Low Throughput, Low Latency per request)
─────────────────────────────────────────────────────────
Request 1 → network call (5ms) → Server → Result
Request 2 → network call (5ms) → Server → Result
Request 3 → network call (5ms) → Server → Result

100 requests = 100 network calls
Throughput: 100 RPS
Latency: 5ms per request

WITH BATCHING (High Throughput, Higher Latency)
────────────────────────────────────────────────
Request 1 → waits 10ms in buffer ─┐
Request 2 → waits  9ms in buffer  ├→ 1 network call (5ms) → Server → Result
Request 100 → waits 0ms          ─┘

100 requests = 1 network call
Throughput: 10,000 RPS (100x improvement)
Latency: 0–15ms (first request waits longest)
```

> Kafka producers use this: batch 100 messages per 10ms → 10x throughput gain, up to 10ms added latency.

---

## Flowchart 3 — Little's Law Applied

```
Little's Law:  Throughput = Concurrency / Latency

Scenario 1: Add Caching (Win-Win)
  Before: Latency=100ms, Concurrency=100 → Throughput = 1,000 RPS
  After:  Latency=50ms,  Concurrency=100 → Throughput = 2,000 RPS ✅

Scenario 2: Increase Concurrency (Horizontal Scale)
  Before: Latency=100ms, Concurrency=100  → Throughput = 1,000 RPS
  After:  Latency=100ms, Concurrency=500  → Throughput = 5,000 RPS ✅

Scenario 3: Batching Trade-off
  Before: Latency=10ms,  Concurrency=100 → Throughput = 10,000 RPS
  After:  Latency=60ms,  Concurrency=100 → Throughput = 1,667 RPS ⚠️
  (But 10x fewer DB operations — much more efficient per batch)
```

---

## Flowchart 4 — Queueing Theory: Latency Explodes Near Capacity

```
System Utilization vs Latency:

30% → Latency: 10ms   (no queue — requests hit idle servers)
50% → Latency: 12ms   (minimal queueing)
70% → Latency: 20ms   (moderate queueing)
85% → Latency: 50ms   (heavy queueing — "knee of the curve")
95% → Latency: 200ms+ (near collapse — queue >> processing time)

             [ Safe zone ] | [ Danger zone ]
                            ↑
                  Keep prod utilization ≤ 60–70%
                  (Netflix targets this for latency-sensitive services)
```

> Latency grows **exponentially**, not linearly, as you approach capacity. Test at realistic load, not 30%.

---

## Key Principles

| Principle | ELI5 | Example |
|---|---|---|
| **Measure what matters** | User-facing = p99 latency; batch jobs = throughput | Google Search: p99 < 200ms; Google MapReduce: max TB/hr |
| **Batching trades latency for throughput** | Wait to group requests → fewer, bigger operations | Uber batches driver location writes every 100ms (10K tx per batch) |
| **Parallelism improves both** | More workers = more done, faster | Netflix API gateway: 100 concurrent connections → 100x throughput at same latency (until DB contention hits) |

---

## Little's Law — Capacity Planning

```
Formula: Throughput = Concurrency / Latency

Example: Design checkout API for 10,000 RPS at 100ms latency
  Concurrency = 10,000 RPS × 0.1s = 1,000 concurrent connections needed

If you add caching and reduce latency to 50ms:
  Concurrency = 10,000 × 0.05 = 500 connections (half the infra cost!)

If DB slows to 200ms:
  Concurrency = 10,000 × 0.2 = 2,000 connections (double cost!)
```

> **Reducing latency reduces infra cost for the same throughput.** This is why caching is the #1 optimization.

---

## Latency Types (Know These for Interviews)

| Type | What It Measures |
|---|---|
| **Network latency** | Packet travel time (1–5ms DC, 50–200ms cross-continent) |
| **Processing latency** | Time executing business logic |
| **Queueing latency** | Wait time in buffers under load — often the killer |
| **p50 latency** | Median — 50% of requests are faster than this |
| **p95 / p99 latency** | The slowest 5% / 1% of requests — what users actually feel |
| **Tail latency** | p99.9+ — extreme outliers from GC pauses, retries, network hiccups |

> **Never use average latency for SLAs.** A 10ms average with 500ms p99 = users are suffering.

---

## Decision Framework

| Use Case | Optimize For | Why |
|---|---|---|
| User-facing APIs (checkout, search) | **Latency (p99)** | Users notice delays; bad UX |
| Matching / dispatch (Uber) | **Both** | Batch geo queries; 1–2s delay acceptable |
| Batch analytics / ETL | **Throughput** | Total job time matters, not per-record time |
| Video encoding (Netflix) | **Throughput** | Hours per job OK; max concurrency = cost efficiency |
| Trading / financial | **Latency** | Microseconds matter; revenue impact |

---

## Trade-offs Reference

| Strategy | Latency | Throughput | When to Use |
|---|---|---|---|
| Synchronous processing | ↓ Low | ↗ Medium | User-facing APIs, payments |
| Async batching | ↑ Higher | ↑↑ High | Background jobs, analytics, logs |
| Caching | ↓↓ Very Low | ↑ Higher | Read-heavy workloads (80/20 rule) |
| Horizontal scaling | → Same or ↓ | ↑↑ High | General scale-out |
| Connection pooling | ↓ (less queue) | ↑ Higher | DB-heavy services |
| Write batching (Kafka) | ↑ Slightly | ↑↑ High | Event streaming, metrics |

---

## Real-World Examples

| Company | System | Trade-off Made |
|---|---|---|
| **Google Search** | Query serving | Speculative execution (queries to multiple DCs, use fastest) — wastes compute to guarantee p99 < 200ms |
| **Uber** | Dispatch | Batch geospatial queries → 10x throughput gain, +1–2s latency — acceptable for riders |
| **Netflix** | Video encoding | Hours per job (high latency) is fine; encode thousands concurrently (max throughput) on spot instances |
| **Kafka** | Message brokers | Batch 100 msgs per 10ms → 10x throughput, +10ms latency |

---

## Common Pitfalls

| Pitfall | Reality | Fix |
|---|---|---|
| **Optimizing average latency** | Averages hide p99/p99.9 outliers from GC, retries, slow queries | Always set SLAs on percentiles, not averages |
| **Ignoring queueing theory near capacity** | At 90% utilization, latency can hit 10x vs 70% | Load test at realistic peak; keep prod ≤ 60–70% utilization |
| **Confusing bandwidth with latency** | High bandwidth ≠ low latency (satellite: 50 Mbps, 600ms latency) | Use CDN/edge to reduce distance, not just bandwidth |
| **"Add more servers"** | Doesn't automatically reduce latency if bottleneck is DB or logic | Identify the bottleneck first — use profiling and percentile metrics |

---

## Interview Cheat Sheet

**Common Questions + Answers:**
- "How to improve throughput for write-heavy DB?" → Batching, write-behind caching, sharding
- "p99 is 2s but avg is 50ms — what's wrong?" → Tail latency: look for GC pauses, slow queries, retries
- "Need 50K RPS at 20ms — how many connections?" → 50,000 × 0.02 = **1,000 connections**
- "When to optimize throughput over latency?" → Batch jobs, analytics, background tasks

**Red Flags:**
- "We can optimize both without trade-offs" — shows no real-world experience
- Using average latency for SLAs
- Not asking which metric matters more for the use case
- "Just add more servers" without explaining the mechanism

---

## Key Takeaways

- **Latency** = time per request (ms); **Throughput** = requests per time (RPS) — fundamentally different metrics
- **Little's Law:** `Throughput = Concurrency / Latency` — use it for capacity planning
- **Batching** ↑ throughput by amortizing fixed costs, but ↑ latency for individual requests
- **Parallelism** (horizontal scale, connection pools) can improve both simultaneously
- **Use p95/p99 latency** not averages — tail latencies are what users actually experience
- **Queueing latency explodes non-linearly** near capacity — keep prod utilization ≤ 60–70%
- Different systems need different optimizations: **user-facing = latency, batch = throughput**
