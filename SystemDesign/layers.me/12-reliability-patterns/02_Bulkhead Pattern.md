# 02 — Bulkhead Pattern

> **Module**: M12 — Reliability Patterns  
> **Section**: Section 1 — Resiliency Patterns  
> **Source**: https://layrs.me/course/hld/12-reliability-patterns/bulkhead  
> **Difficulty**: Intermediate | 14 min read

---

## 1. ELI5 — Explain Like I'm 5

Think of a submarine with separate compartments. If one section floods, the watertight doors close and only that section fills with water — the rest of the submarine stays dry and keeps moving.

Bulkheads in software do the same thing: each part of your app gets its own "compartment" of resources (threads, connections). If one part goes crazy and exhausts its compartment, the others keep working fine.

---

## 2. The Analogy

**Bulkhead = Ship compartments preventing a single breach from sinking the vessel.**

A traditional server is like an open-hull ship: one breach floods everything. A ship with bulkheads is like isolated compartments: breach in bow → only bow floods, stern stays afloat.

In software: without bulkheads, one slow API (recommendations taking 30s) exhausts your shared thread pool of 200 threads → payments (which was working fine) starts failing with "no threads available."

With bulkheads: recommendations get 100 threads, payments get 50, profiles get 50. Recommendations exhaust their 100 → only recommendations fail. Payments and profiles untouched.

---

## 3. Core Concept

The **Bulkhead pattern** isolates system components into independent resource pools so that failures in one area cannot cascade and exhaust resources needed by others.

Named after ship compartments that prevent a single hull breach from sinking the entire vessel. Partitions are enforced via:
- **Thread pools** (per service, within same process)
- **Connection pools** (per database/external service)
- **Process / Container boundaries** (OS-level isolation)
- **Cluster separation** (dedicated hardware)

### The Core Problem (Resource Exhaustion Without Bulkheads):
```
API Server: 200 shared threads
Services:   User Profile (20ms), Recommendations (500ms → 30s during outage), Payment (100ms)

Recommendations starts timing out at 30s:
- 100 req/s × 30s = need 3000 threads to handle → reality has 200
- All 200 threads blocked on recommendations
- Payments: "No threads available!" ❌ (was completely healthy)
```

---

## 4. ASCII Architecture

### Without Bulkheads vs With Bulkheads

```
WITHOUT BULKHEADS
Client (1000 req/s)
    ↓
Thread Pool: 200 threads (SHARED)
    ├── User Profile (20ms): 20 threads OK
    ├── Recommendations (30s timeout!): 160 threads BLOCKED
    └── Payment (100ms): ❌ No threads! (was healthy)

WITH BULKHEADS
Client (1000 req/s)
    ↓
    ├── Profile Bulkhead: 50 threads → User Profile ✓ (200 req/s)
    ├── Recommendations Bulkhead: 100 threads → exhausted → reject (500 req/s REJ)
    └── Payment Bulkhead: 50 threads → Payment ✓ (300 req/s)
    
Recommendations fails → ONLY recommendations fail
Profile and Payment completely unaffected
```

### Thread Pool Bulkhead Implementation Flow

```
1. GET /recommendations → try acquire thread from REC pool
2. Pool has 20/20 threads active + queue 5/5 full → REJECTED immediately
3. → 503 + fallback (cached recommendations)

4. POST /payment → try acquire thread from PAYMENT pool
5. Pool has 5/50 threads active → ACQUIRED ✓
6. → Process payment normally
7. → Release thread back to PAYMENT pool
```

---

## 5. How It Works

**Step 1: Identify Failure Domains**
Map your dependencies by failure characteristics:
- Latency profile (10ms vs 500ms vs 2s)
- Criticality (payment = critical; recommendations = nice-to-have)
- Failure modes (timeout vs error vs connection refused)

Netflix groups: account services, content discovery, playback — each a separate bulkhead.

**Step 2: Size Thread Pool Bulkheads**
Use **Little's Law**: `threads_needed = requests_per_second × p99_latency_seconds`
- 100 req/s × 500ms = 50 threads minimum
- Add 20-30% buffer for variance → 60-65 threads
- Most systems use 10-50 threads per service

**Step 3: Implement Thread Pool Isolation**
Each service gets a dedicated `ExecutorService` / `ThreadPoolExecutor`. When pool exhausted → reject immediately (fail-fast), not queue indefinitely.

**Step 4: Size Connection Pool Bulkheads**
Connection pools should be 1.5–2× thread pool size:
`connections = threads × (1 + reuse_factor)` where reuse_factor ≈ 0.5–1.0
Set `connectionTimeout: 250ms` — if pool exhausted, fail fast.

**Step 5: Process-Level Bulkheads**
Kubernetes: each service in its own pod with CPU/memory limits. A recommendation service getting 2 CPU / 4GB RAM can't affect other pods even if it leaks memory.

**Step 6: Monitor Bulkhead Health**
Instrument per bulkhead: active threads, queue depth, rejection rate, latency.
Alert at 90% thread utilization. Rejection > 1% → investigate.

---

## 6. Variants

### Thread Pool Bulkheads (Most Common)
- Dedicated thread pool per downstream service within single process
- Libraries: **Hystrix** (Netflix, maintenance mode), **Resilience4j** (JVM), custom `ExecutorService`
- Pros: fine-grained isolation, low overhead, easy to implement
- Cons: in-process only, doesn't protect against memory leaks or CPU spikes
- **Use for**: I/O-bound operations calling different downstream services

### Semaphore Bulkheads
- Counting semaphore limits concurrent executions (e.g., max 20 concurrent calls)
- Requests execute on caller's thread — no thread pool overhead
- Pros: lower memory (no thread stack allocation), good for CPU-bound
- Cons: doesn't isolate thread blocking — if call blocks, caller's thread blocks
- **Use for**: fast, non-blocking operations where concurrency limiting matters

### Connection Pool Bulkheads
- Separate DB/HTTP connection pools per downstream service
- Each service gets dedicated pool of 50 connections
- Pros: prevents connection exhaustion, works at I/O layer
- Cons: doesn't isolate CPU or memory
- **Use for**: database connection exhaustion is the primary failure mode

### Process/Container Bulkheads
- Each component in separate container with CPU/memory limits (Kubernetes)
- Pros: strongest isolation, protects against memory leaks and CPU spikes
- Cons: highest overhead, requires inter-process communication
- **Use for**: critical services needing maximum fault isolation

### Cluster Bulkheads
- Dedicated hardware clusters per workload type
- Critical services (payments) on isolated hardware from non-critical (analytics)
- Pros: physical isolation, no noisy-neighbor problems
- Cons: expensive (duplicate infra), complex management
- **Use for**: regulatory requirements, financial services isolation

---

## 7. Trade-offs

### Isolation vs Resource Utilization
- Without bulkheads: 200 threads dynamically allocated → 100% efficient
- With bulkheads (50 threads × 4 services): idle service wastes 50 threads
- Netflix accepts **60-70% average utilization** for isolation guarantees
- Decision: dedicated pools for critical services; shared pools for homogeneous, non-critical workloads

### Granularity vs Complexity
- Fine-grained (one per service): better isolation, 50+ pools to size/monitor/tune
- Coarse-grained (one per domain): simpler but failures can spread within domain
- Netflix grew from 10 → 50+ bulkheads as failure patterns became clear
- Start coarse, split only when failures spread within a domain

### Fail-Fast vs Queueing
- Fail-fast (queue size 0-5): clear failure signals, prevents cascading delays, increases client-visible errors
- Queueing (10-20): smooths brief spikes, hides problems, increases latency
- Never unbounded queues — defeat the purpose (allow exhaustion through memory)

### Static vs Dynamic Sizing
- Static: fixed sizes, simple to reason about; potentially wasteful
- Dynamic: adjust based on observed latency; more efficient but complex, risky instability
- Most companies (including Netflix) use **static sizing** for operational simplicity

---

## 8. When to Use / When to Avoid

### ✅ Use When:
- Calling 3+ downstream services with **different failure characteristics**
- One slow/failing service can exhaust shared resources (threads, connections)
- Critical services must remain available even when non-critical fail
- You've had incidents where one service failure caused widespread outages
- Your monitoring shows thread pool exhaustion during partial failures

### ❌ Avoid When:
- Homogeneous workloads where all requests have similar resource needs
- Fewer than 3 distinct failure domains → overhead not justified
- Using as a substitute for fixing underlying slow services
- Creating too many bulkheads (50+ for a small system) without clear failure patterns

### Anti-patterns:
- Bulkhead too large (consumes 80% of system resources) → failures still cascade
- Bulkheads without monitoring → won't know when they're protecting or rejecting legitimate traffic
- No circuit breakers alongside bulkheads → no failure detection, just containment

---

## 9. MERN Dev Notes

### Thread Pool Bulkhead with p-limit (Node.js)

```javascript
// Node.js is single-threaded, but we can implement bulkhead-style
// concurrency limits on async operations using p-limit or custom semaphores

import pLimit from 'p-limit'; // npm install p-limit

// Create separate concurrency limits per service (simulates bulkheads)
const bulkheads = {
  inventory: pLimit(20),    // Max 20 concurrent calls to inventory
  payments:  pLimit(10),    // Max 10 concurrent calls to payment processor
  profiles:  pLimit(30),    // Max 30 concurrent calls to profile service
  recommendations: pLimit(15) // Max 15 concurrent calls to recommendations
};

// Usage: each call is limited to the service's bulkhead
const checkInventory = async (productId) => {
  return bulkheads.inventory(async () => {
    const resp = await fetch(`${INVENTORY_URL}/check/${productId}`);
    if (!resp.ok) throw new Error(`Inventory check failed: ${resp.status}`);
    return resp.json();
  });
};

const getRecommendations = async (userId) => {
  try {
    return await bulkheads.recommendations(async () => {
      const resp = await fetch(`${RECS_URL}/user/${userId}`);
      return resp.json();
    });
  } catch (err) {
    if (err.message === 'queue is full' || err.message.includes('concurrency')) {
      console.warn('Recommendations bulkhead exhausted, using fallback');
      return getCachedRecommendations(userId) || []; // Fallback
    }
    throw err;
  }
};

// Monitor bulkhead utilization
const getBulkheadMetrics = () => ({
  inventory: { active: bulkheads.inventory.activeCount, pending: bulkheads.inventory.pendingCount },
  payments:  { active: bulkheads.payments.activeCount, pending: bulkheads.payments.pendingCount },
  recommendations: { active: bulkheads.recommendations.activeCount, pending: bulkheads.recommendations.pendingCount }
});

// Alert if any bulkhead is > 80% utilized
setInterval(() => {
  const metrics = getBulkheadMetrics();
  for (const [service, m] of Object.entries(metrics)) {
    const limit = bulkheads[service].concurrency;
    if (m.active / limit > 0.8) {
      console.warn(`Bulkhead alert: ${service} at ${(m.active/limit*100).toFixed(0)}% utilization`);
    }
  }
}, 5000);
```

### Connection Pool Bulkhead (Mongoose/MongoDB)

```javascript
// Separate Mongoose connections per purpose = connection pool bulkhead
const mongoose = require('mongoose');

// User-facing operations: limited pool for fast, user-blocking queries
const userConn = mongoose.createConnection(process.env.MONGODB_URI, {
  maxPoolSize: 20,          // Bulkhead: 20 connections for user operations
  serverSelectionTimeoutMS: 3000,
  socketTimeoutMS: 5000
});

// Background/analytics operations: separate pool, won't starve user requests
const analyticsConn = mongoose.createConnection(process.env.MONGODB_URI, {
  maxPoolSize: 10,          // Isolated analytics pool
  serverSelectionTimeoutMS: 10000, // Analytics can wait longer
  socketTimeoutMS: 30000
});

// Models bound to specific connections
const UserModel = userConn.model('User', userSchema);
const AnalyticsModel = analyticsConn.model('Analytics', analyticsSchema);

// If analytics queries run slow or exhaust their pool, user queries are unaffected
```

### Sizing Calculation Helper

```javascript
// Little's Law: threads = requests_per_second × avg_latency_seconds
const sizeBulkhead = ({ peakRps, p99LatencyMs, buffer = 0.2, critical = false }) => {
  const baseThreads = Math.ceil(peakRps * (p99LatencyMs / 1000));
  const bufferMultiplier = critical ? 1.3 : 1 + buffer;
  return Math.ceil(baseThreads * bufferMultiplier);
};

// Examples
console.log(sizeBulkhead({ peakRps: 100, p99LatencyMs: 500, critical: false }));  // 60
console.log(sizeBulkhead({ peakRps: 200, p99LatencyMs: 100, critical: true  }));  // 27
```

---

## 10. Real-World Examples

### Netflix — Hystrix Bulkheads (API Gateway)
- 50+ thread pools protecting each backend service in their API gateway
- User profile (fast, critical): 20 threads; Recommendations (slow, non-critical): 100 threads
- **2014 Incident**: recommendation service outage hit 100-thread bulkhead → exhausted → rejecting recs requests; OTHER 49 services continued completely unaffected
- Netflix estimated bulkheads prevented $10M+ in lost revenue in that incident
- Open-sourced **Hystrix** → became de facto standard for JVM bulkheads

### Uber — Connection Pool Bulkheads
- Discovered without connection pool bulkheads, a single city's traffic spike could exhaust the GLOBAL database connection pool → dispatch failures worldwide
- Solution: 50 connections per city as separate bulkheads
- São Paulo traffic surge during Carnival → zero impact on dispatch in other cities
- Formula used: `connections = 2 × (peak_concurrent_requests / avg_request_duration_ms × 1000)`, minimum 20 per pool

### Amazon — Cell-Based Architecture (Cluster Bulkheads)
- EC2, S3, DynamoDB each run on dedicated hardware clusters
- Within each service: customer data partitioned into isolated cells
- Failure in one cell affects only a subset of customers
- Run EC2 at **60-70% average utilization** (not 90%+) to guarantee isolation headroom
- **2017 S3 outage (typo in a command)**: bulkhead architecture confined impact to S3 in us-east-1; EC2, Lambda, other services continued normally

---

## 11. Interview Cheat Sheet

### One-Liner
> "The Bulkhead pattern isolates components into dedicated resource pools so that a single failing dependency can only exhaust its own resources, not bring down unrelated services. Thread pools are the most common implementation; size them using Little's Law."

### Key Formula:
```
Thread pool size = (peak req/s) × (p99 latency in seconds) × (1 + buffer)
= 100 req/s × 0.5s p99 × 1.2 = 60 threads

Connection pool size = thread pool × 1.5-2.0
= 60 threads × 1.5 = 90 connections
```

### Bulkhead vs Circuit Breaker (Interviewers Always Ask):
| | Bulkhead | Circuit Breaker |
|--|---|---|
| **Purpose** | Contain failures (isolation) | Detect + stop failures (fast-fail) |
| **Mechanism** | Resource partitioning (threads/connections) | State machine (Closed/Open/Half-Open) |
| **Effect** | Limits blast radius | Prevents wasted resources |
| **Interaction** | Contains the problem | Detects and stops calling the problem |
| **Together** | Defense-in-depth (use both!) | |

### Sizing Decision:
1. Measure `peak_rps` and `p99_latency` per dependency
2. Apply `L = λ × W` (Little's Law) + 20-30% buffer
3. Critical services: 30% buffer; Non-critical: 20% buffer
4. Total threads across all bulkheads must not exceed system thread budget

---

## 12. Red Flags + Keywords

### Red Flags to Avoid

❌ **"Use a bulkhead to fix slow services"** — Fix the root cause; bulkheads contain blast radius, not performance

❌ **"Bulkheads eliminate cascading failures"** — They need circuit breakers too; isolation ≠ detection

❌ **"Use unbounded queues to avoid rejections"** — Unbounded queues allow resource exhaustion through memory; defeat the purpose

❌ **"More bulkheads = better"** — 50+ bulkheads for a small system adds operational complexity without benefit

❌ **"Only use thread pool bulkheads"** — Connection pools, containers, and clusters are equally important at different scales

### Keywords / Glossary

| Term | Meaning |
|------|---------|
| **Bulkhead** | Isolation pattern: dedicated resource pool per service/component |
| **Thread Pool Bulkhead** | Separate executor per downstream service; most common variant |
| **Connection Pool Bulkhead** | Separate DB/HTTP connection pool per service |
| **Process Bulkhead** | Separate OS process or container per component |
| **Little's Law** | `L = λ × W` — threads = requests_per_second × avg_latency |
| **Fail-Fast** | Reject request immediately when bulkhead exhausted, not queue |
| **Resource Exhaustion** | All threads/connections consumed; new requests fail even for healthy services |
| **Hystrix** | Netflix's circuit breaker + bulkhead library (now maintenance mode) |
| **Resilience4j** | JVM resiliency library (modern Hystrix alternative) |
| **Concurrency Limiter** | Semaphore-based bulkhead for async Node.js/Python systems |
| **Noisy Neighbor** | A component consuming disproportionate shared resources |
| **Blast Radius** | The scope of damage when a component fails |
| **Static Sizing** | Fixed thread pool sizes (simpler, preferred over dynamic) |
| **Dynamic Sizing** | Auto-adjusting pool sizes based on observed latency (complex, risky) |
