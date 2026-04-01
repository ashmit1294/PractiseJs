# 01 — Resiliency Overview

> **Module**: M12 — Reliability Patterns  
> **Section**: Section 1 — Resiliency Patterns  
> **Source**: https://layrs.me/course/hld/12-reliability-patterns/resiliency-overview  
> **Difficulty**: Intermediate | 13 min read

---

## 1. ELI5 — Explain Like I'm 5

Imagine a ship that's divided into compartments. If the hull is breached in one section, water only fills that compartment — not the whole ship. The ship keeps sailing.

Resiliency is like those compartments for your software. When one part breaks, the rest keeps working. You plan for things to go wrong and make sure a small problem never becomes a huge disaster.

---

## 2. The Analogy

**Resiliency = A hospital during a crisis.**

A hospital has emergency protocols: triage separates critical cases from minor ones (isolation), nurses follow fallback procedures when equipment fails (recovery), vitals monitors detect problems early (detection), and administrators shed non-urgent appointments during overload (coordination).

Without these protocols, a single broken MRI machine could paralyze the whole hospital. With them, care continues even when parts of the system fail.

---

## 3. Core Concept

**Resiliency** is a system's ability to detect, absorb, and recover from failures while maintaining acceptable service levels. It's broader than:
- **High Availability (HA)**: measures uptime (99.9%, 99.99%) — what percentage of time is the system operational
- **Fault Tolerance**: system continues operating correctly when components fail, typically through redundancy
- **Resiliency**: encompasses detection, containment, recovery, and learning from failures

> A system can be highly available through luck (no failures happened) but not resilient (no failure handling). A resilient system actively manages failures.

### Four Pillars:

| Pillar | What It Does | Examples |
|--------|-------------|---------|
| **Isolation** | Prevent failures from spreading | Bulkhead, Circuit Breaker, Rate Limiting |
| **Recovery** | Bounce back from failures | Retry + Backoff, Fallback, Timeout |
| **Detection** | Identify failures quickly | Health Checks, Heartbeat, Distributed Tracing |
| **Coordination** | Manage system-wide response | Load Shedding, Graceful Degradation, Leader Election |

### The Business Case:
- Amazon: every 100ms of latency costs 1% in sales
- Google: 500ms delay reduces traffic by 20%
- Companies that invest in resiliency survive incidents competitors don't

---

## 4. ASCII Architecture

### Cascading Failure Without Resiliency

```
Without Resiliency
Request → Service A (no timeout)
               → Service B (no circuit breaker)
                     → Service C (SLOW/FAILING)

Result: ❌ All threads in A and B blocked
        ❌ 30s user timeout
        ❌ Failure cascades upstream
        ❌ Entire system goes down


With Resiliency Patterns
Request → Service A (bulkhead + 1s timeout)
               → Service B (circuit breaker)
                     → Service C (SLOW)
                            🔴 Circuit OPENS after 5 failures
                     → Service B returns fallback (cached data)
               → Service A returns in ~1s

Result: ✓ Isolated thread pool (only B affected)
        ✓ 1s response time maintained
        ✓ Graceful degradation for user
        ✓ Service C gets breathing room to recover
```

### Resiliency Defense Layers (Timescale)

```
milliseconds  │ Isolation:  Bulkhead, Circuit Breaker → Stop failures spreading NOW
              │
seconds       │ Recovery:   Retry + Backoff, Fallback → Try to recover automatically
              │
seconds-mins  │ Detection:  Health Checks, Monitoring → Identify when recovery fails
              │
minutes       │ Coordination: Load Shedding, Degradation → Manage sustained problems
```

---

## 5. How It Works

**Isolation Patterns** (first line of defense):
- **Bulkhead**: partition resources (thread pools, connection pools) per service — one slow dependency cannot exhaust all threads
- **Circuit Breaker**: detect failure rate threshold, stop calling failing services immediately (fast-fail)
- **Rate Limiting**: protect services from being overwhelmed by too many requests

**Recovery Patterns**:
- **Retry with Exponential Backoff**: handle transient failures (network glitches) by retrying after progressively longer waits — MUST add jitter to avoid thundering herd
- **Fallback**: degrade gracefully when primary fails (cached data, simpler algorithm, backup service)
- **Timeout**: prevent hanging indefinitely; essential for every external call

**Detection Patterns**:
- **Health Checks**: HTTP endpoints (`/health`) probed by load balancers to route away from failing instances
- **Heartbeats**: periodic signals proving a process is alive; absent heartbeat = failure
- **Distributed Tracing**: identify where failures occur in complex call chains (Jaeger, Zipkin, X-Ray)

**Coordination Patterns**:
- **Load Shedding**: deliberately drop low-priority requests when overloaded; preserve capacity for critical operations
- **Backpressure**: propagate overload signals upstream so producers slow down
- **Graceful Degradation**: disable non-essential features to keep core functionality working

**Chaos Engineering** (validate everything):
- Netflix Chaos Monkey: randomly terminates production instances
- Gremlin: inject network latency, CPU exhaustion, disk failures
- Game Days: team simulates major failures (losing a region) to validate runbooks

---

## 6. Variants (Maturity Levels)

### Level 1 — Basic Resiliency
- Timeouts on every external call
- Retry with exponential backoff for idempotent operations  
- Simple health checks
- *Most monolithic apps need at least this*

### Level 2 — Intermediate Resiliency
- Circuit breakers on external dependencies
- Bulkheads to isolate thread/connection pools
- Fallback responses for non-critical features
- *Required for microservices architectures*

### Level 3 — Advanced Resiliency
- Multi-region deployment with automated failover
- Chaos engineering in production (Chaos Monkey)
- Error budgets with automatic feature freezes (Google SRE model)
- Cell-based architecture with blast radius isolation
- *Required at Netflix/Amazon/Google scale*

---

## 7. Trade-offs

| Pattern | Benefit | Cost |
|---------|---------|------|
| Retry | Handle transient failures | Amplifies load 3-4× on failing service; risk thundering herd |
| Circuit Breaker | Fast-fail, protect resources | False positives; fallback complexity required |
| Bulkhead | Contain failures | Lower resource utilization (60-70% vs 90%+) |
| Fallback | User sees degraded not broken | Stale/incomplete data; code complexity |
| Load Shedding | Preserves critical capacity | Some requests fail intentionally |

**Resiliency vs Latency**: every retry, fallback, and circuit breaker check adds latency. Balance based on SLA requirements.

**Testing Cost**: untested resiliency patterns often fail when needed. Chaos engineering requires significant investment.

---

## 8. When to Use / When to Avoid

### ✅ Always Apply:
- Timeouts on every network call (even internal)
- Retry + backoff for idempotent read operations
- Health check endpoints on every service
- Structured logging with correlation IDs for tracing

### ✅ Apply for Microservices:
- Circuit breakers on all external/downstream service calls
- Bulkheads if one slow dependency could exhaust shared resources
- Fallbacks for non-critical features

### ❌ Don't Over-Engineer:
- Don't use sagas for simple, transaction-safe workflows
- Don't add circuit breakers for in-process library calls (no network boundary)
- Don't implement chaos engineering before you have observability

---

## 9. MERN Dev Notes

### Timeout + Retry with Exponential Backoff (Node.js)

```javascript
// Resilient fetch with timeout + exponential backoff + jitter
const fetchWithResilience = async (url, options = {}, maxRetries = 3) => {
  const timeout = options.timeout || 5000;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok && response.status >= 500 && attempt < maxRetries) {
        throw new Error(`HTTP ${response.status}`); // Retry on 5xx
      }
      return response;
      
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (attempt === maxRetries) throw err;
      
      // Exponential backoff + jitter to avoid thundering herd
      const baseDelay = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms
      const jitter = Math.random() * 100;
      const delay = baseDelay + jitter;
      
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Usage pattern with fallback
const getProductData = async (productId) => {
  try {
    const response = await fetchWithResilience(
      `${PRODUCT_SERVICE_URL}/products/${productId}`,
      { timeout: 3000 }
    );
    return await response.json();
  } catch (err) {
    console.error('Product service unavailable, using fallback', { productId });
    // Fallback: return cached or default data
    return getCachedProduct(productId) || { id: productId, available: false };
  }
};
```

### Simple In-Memory Circuit Breaker (Node.js)

```javascript
class CircuitBreaker {
  constructor(name, { failureThreshold = 5, cooldownMs = 30000 } = {}) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.failures = 0;
    this.state = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
    this.nextAttempt = Date.now();
  }
  
  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit OPEN: ${this.name} is unavailable`);
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }
  
  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.cooldownMs;
      console.error(`Circuit OPENED: ${this.name}, cooldown until ${new Date(this.nextAttempt)}`);
    }
  }
}

// Usage
const inventoryBreaker = new CircuitBreaker('inventory-service', {
  failureThreshold: 5,
  cooldownMs: 30000
});

const checkInventory = async (productId) => {
  try {
    return await inventoryBreaker.call(() => 
      fetch(`${INVENTORY_URL}/check/${productId}`).then(r => r.json())
    );
  } catch (err) {
    if (err.message.includes('Circuit OPEN')) {
      return { available: null, reason: 'inventory-check-unavailable' }; // Fallback
    }
    throw err;
  }
};
```

---

## 10. Real-World Examples

### Netflix — Chaos Engineering Pioneer
- Created **Chaos Monkey** (randomly terminates production instances) after moving to AWS
- Expanded to **Simian Army**: Chaos Gorilla (AZ failure), Chaos Kong (region failure)
- Pattern: embrace failure, test continuously in production rather than hope it never happens
- Result: Netflix can lose entire AWS regions and continue streaming

### Uber — Graceful Degradation Layers
- Primary matching algorithm fails → fall back to simpler algorithm
- Real-time pricing fails → use cached prices
- Map service slow → show simplified map
- During S3 outage that affected many companies: Uber stayed operational via fallbacks
- New Year's Eve: use load shedding to prioritize ride requests over ride history

### Stripe — Idempotency for Financial Resiliency
- Idempotency keys make retries safe for payment operations
- Exponential backoff + jitter for payment processor calls
- Fallback payment processors for primary processor issues
- Result: 99.99%+ availability despite depending on less-reliable external networks

### Google — Error Budgets (SRE Model)
- Each service gets a budget for downtime (99.9% SLA = 43 min/month)
- If budget exceeded: feature development stops until reliability improves
- MTTD (Mean Time to Detect) often more important than MTTR
- DiRT (Disaster Recovery Testing): deliberately break production to validate recovery

---

## 11. Interview Cheat Sheet

### One-Liner
> "Resiliency is the ability to detect, isolate, and recover from failures. It's broader than HA: availability measures uptime, fault tolerance masks failures through redundancy, but resiliency encompasses detection, containment, recovery, and learning from incidents."

### Key Distinctions (Interviewers Love This):
- **HA**: 99.9% uptime measurement
- **Fault Tolerance**: redundancy masks failures (no downtime)
- **Resiliency**: system handles ANY failure mode gracefully, with or without redundancy

### Always Mention in System Design:
1. Timeouts on all external calls
2. Retry + exponential backoff + jitter for idempotent operations
3. Circuit breakers for critical dependencies
4. Health checks for load balancer routing
5. Bulkheads if multiple dependencies share resources

### Retry Math (Important!):
```
3 retries × 100 req/s = 400 req/s to downstream service
= 4× amplification on a service that's already struggling
→ Always rate-limit retries; circuit breakers stop retry storms
```

### Cascade Prevention:
```
Service A → B → C → D (C starts timing out at 30s)
Without: all threads in A and B exhaust → system-wide failure
With circuit breaker at C: fast-fail after 5 failures, threads released
With bulkhead at B: C's threads isolated, A and B continue for other requests
```

---

## 12. Red Flags + Keywords

### Red Flags to Avoid

❌ **"Assume the happy path works"** — Always design for failure; distributed systems WILL fail

❌ **"Just use retries"** — Unlimited retries without backoff = thundering herd = make failures worse

❌ **"Circuit breakers prevent all failures"** — They fast-fail; you still need fallbacks for degraded functionality

❌ **"Resiliency and high availability are the same thing"** — HA = uptime metric; resiliency = failure handling approach

❌ **"Our system is resilient because we have redundancy"** — Redundancy is fault tolerance; resiliency requires active failure handling + recovery patterns

### Keywords / Glossary

| Term | Meaning |
|------|---------|
| **Resiliency** | System's ability to detect, absorb, and recover from failures |
| **High Availability (HA)** | Uptime measurement (99.9%, 99.99%, etc.) |
| **Fault Tolerance** | Continued operation despite failures, via redundancy |
| **Cascading Failure** | A failure in one component causes failures in dependent components |
| **Blast Radius** | Scope of impact when a component fails |
| **Bulkhead** | Partition resources into isolated pools to contain failures |
| **Circuit Breaker** | Detect failure patterns and fast-fail requests during outages |
| **Retry Storm / Thundering Herd** | Many clients retrying simultaneously, amplifying load on recovering service |
| **Exponential Backoff** | Increasing wait time between retries (100ms, 200ms, 400ms...) |
| **Jitter** | Random variance added to backoff delay to desynchronize retries |
| **Fallback** | Degraded but functional alternative when primary fails |
| **Load Shedding** | Intentionally drop low-priority requests to preserve critical capacity |
| **Graceful Degradation** | Disable non-essential features to keep core functionality working |
| **Chaos Engineering** | Deliberately inject failures to test resiliency in production |
| **Error Budget** | Allowed downtime per SLA period; Google SRE model |
| **MTTD** | Mean Time to Detect — how long before failure is noticed |
| **MTTR** | Mean Time to Repair — how long before failure is resolved |
| **Idempotency** | Same operation executes multiple times with same result (safe to retry) |
| **Observability** | Ability to understand internal system state from external outputs |
