# Performance Antipatterns Overview

## ELI5
If your program works fine with 10 users but completely falls apart with 10,000 users, you probably have a performance antipattern hiding inside. Antipatterns are structural mistakes embedded deep in architecture or code—not obvious bugs. They look fine in dev, then go catastrophic at scale.

## Analogy
Imagine a coffee shop where the barista takes orders **and** makes drinks **and** runs to the back for supplies **and** handles payments one customer at a time. With 5 customers, it's slow but workable. With 500, it's a disaster. The antipattern is the process design—not a broken espresso machine.

---

## Core Concept
A **performance antipattern** is a recurring structural problem in design, code, or operations that causes degradation under load. Unlike bugs (which break once), antipatterns *work* in development and *fail* systematically at production scale.

### The 10 Core Antipatterns (this module)
| # | Antipattern | Root Problem |
|---|---|---|
| T02 | Busy Database | DB doing too much (logic, compute) |
| T03 | Busy Frontend | Main thread blocked by heavy work |
| T04 | Chatty I/O | Excessive small network calls |
| T05 | Extraneous Fetching | Fetching more data than needed |
| T06 | Improper Instantiation | Expensive objects created per-request |
| T07 | Monolithic Persistence | Single DB bottleneck for all domains |
| T08 | No-Caching | Repeating expensive computations/queries |
| T09 | Noisy Neighbor | Multi-tenant resource contention |
| T10 | Retry Storm | Retries amplify failures exponentially |
| T11 | Synchronous I/O | Thread blocks while waiting on I/O |

---

## Antipattern Taxonomy

### By Layer
```
Layer               Examples
─────────────────── ─────────────────────────────────
Data Access         Busy DB, No-Caching, Extraneous Fetching
Service Comm        Chatty I/O, Retry Storm, Synchronous I/O
Compute             Improper Instantiation, Busy Frontend
Infrastructure      Monolithic Persistence, Noisy Neighbor
```

### By Impact
```
Impact Type         Symptoms
─────────────────── ─────────────────────────────────
Latency             High p99, timeouts, slow user experience
Throughput          Low RPS, backpressure, queue depth growing
Resource            CPU/memory exhaustion, OOM crashes
Reliability         Cascading failures, retry storms, circuit open
```

---

## Amplification Cascade (Why This Matters)

```
API Gateway
  └─ Chatty (M=50 service calls per page load)
       └─ Each service has N+1 queries (N=100 items)
            └─ Total DB queries = M × N = 50 × 100 = 5,000 per page load

At 1,000 concurrent users → 5,000,000 DB queries per second
```

Even one antipattern cascades into catastrophic load. **Two antipatterns compound exponentially.**

---

## Antipattern Lifecycle

```
State Diagram:
INTRODUCED → DORMANT → SYMPTOMATIC → DETECTED → DIAGNOSED → REMEDIATED
                ↑
         (most dangerous:
          works fine in dev,
          hides until scale)
```

The **Dormant** phase is the most dangerous — it gives false confidence during development and testing.

---

## Detection Approach

The three prerequisites for detecting antipatterns in production:

```
Distributed Tracing      Surfaces chatty I/O, N+1 queries, slow DB calls
     +
Metrics (RED: Rate/Error/Duration)  Surfaces latency, throughput, error spike
     +
Log Aggregation          Surfaces error context, retry counts, GC pauses
     =
Antipattern Detection
```

---

## MERN Developer Perspective

**Where antipatterns appear in MERN stack:**

| Component | Common Antipatterns |
|---|---|
| React | Busy Frontend (heavy JS in component render) |
| Express/Node | Synchronous I/O, Chatty I/O (many sequential awaits) |
| MongoDB queries | N+1 (missing populate batching), Extraneous Fetching (no projection) |
| Node process | Improper Instantiation (new MongoClient() per request) |
| Single Atlas cluster | Monolithic Persistence |

```javascript
// ANTIPATTERN: Synchronous + Chatty I/O
const results = [];
for (const id of userIds) {
  const user = await db.users.findOne({ _id: id }); // N separate queries
  results.push(user);
}

// FIXED: Batched query
const results = await db.users.find({ _id: { $in: userIds } }).toArray();
```

---

## Real-World Examples

| Company | Antipattern | Impact | Fix |
|---|---|---|---|
| Netflix | Multiple antipatterns → Chaos Engineering invented | 100ms latency = 1% revenue | Microservices + CDN |
| Uber | Busy Database (PostgreSQL) 2016 | Cascading failures company-wide | PostgreSQL → Cassandra + in-memory |
| Amazon | N+1 chatty I/O across services | DynamoDB invented as alternative | DAX cache + DynamoDB |
| Twitter | Retry Storm 2013 | 2hr outage from 5-min DB blip | Exponential backoff + circuit breaker |

**Business impact benchmark:** Netflix estimated 100ms of added latency costs 1% in revenue. That's millions of dollars per 100ms.

---

## Interview Cheat Sheet

**Q: What is a performance antipattern? Give an example.**

> A: A structural problem in architecture or code that works in development but degrades catastrophically at scale. Unlike a bug, it doesn't throw an error—it creates hidden latency. Example: the N+1 query problem—fetching a list of 100 users then loading each user's profile in a separate query = 101 DB calls instead of 2.

**Q: How do you detect antipatterns in production?**

> A: Three tools form the foundation: (1) distributed tracing to visualize request flows and spot chatty I/O or slow DB calls, (2) RED metrics (request rate / error rate / duration percentiles) to detect latency and throughput degradation, (3) log aggregation to correlate error context with specific request patterns.

**Q: Why do antipatterns only appear at scale?**

> A: In development: 10 users, in-memory caches are hot, DB is fast because it has no real data, network is local (sub-millisecond). At production scale: DB has 100M rows, cache misses hit cold storage, 1,000 concurrent users trigger connection pool exhaustion. The problem existed all along—it was just below the threshold where symptoms appear.

**Q: What's the antipattern lifecycle and why does it matter?**

> A: Introduced → Dormant → Symptomatic → Detected → Diagnosed → Remediated. The Dormant phase is most dangerous—the antipattern is present but invisible because load isn't high enough. Engineers get false confidence ("it works fine") until scale exposure.

**Q: How do you prioritize which antipattern to fix first?**

> A: Fix the one with the highest blast radius first. Use distributed tracing to find the largest latency contributor. Usually the data-layer antipatterns (busy DB, no-caching) have the most cascading impact because every other layer depends on data access.

**Q: What's the prevention strategy?**

> A: Prevention beats remediation: (1) code review checklists for known antipatterns (reject N+1 PRs), (2) automated performance tests in CI, (3) architectural guardrails (no business logic in DB stored procedures), (4) error budgets that force reliability work when budget is burned.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **Performance antipattern** | A structural problem that causes degradation under load; works in dev, fails at scale |
| **N+1 query problem** | Loading N child records in N separate queries instead of one batched query |
| **Amplification cascade** | One antipattern triggers another, multiplying the load effect exponentially |
| **Dormant antipattern** | Antipattern that exists but produces no symptoms yet because load is below threshold |
| **Blast radius** | Scope of impact if a failure or antipattern is triggered |
| **Error budget** | Allowed failure rate (SLO budget) that signals when to prioritize reliability |
| **RED metrics** | Rate / Error rate / Duration — the three key service health metrics |
| **Distributed tracing** | Recording request flows across multiple services to identify bottlenecks |
| **Architectural guardrail** | Design rule that prevents entire categories of antipatterns (e.g., no stored procedures) |
