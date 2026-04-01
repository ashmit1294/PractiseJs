# 03 — Circuit Breaker Pattern

> **Module**: M12 — Reliability Patterns  
> **Section**: Section 1 — Resiliency Patterns  
> **Source**: https://layrs.me/course/hld/12-reliability-patterns/circuit-breaker  
> **Difficulty**: Intermediate | 12 min read

---

## 1. ELI5 — Explain Like I'm 5

Think of an electrical circuit breaker in your home. When a wire overloads, the breaker trips and cuts power to that circuit — protecting the house from catching fire. When it's safe, you flip it back on.

Software circuit breakers work the same way: when a service keeps failing, the circuit "opens" and stops sending it requests — protecting your system from wasting resources. After a cooldown period, it tests if the service has recovered.

---

## 2. The Analogy

**Circuit Breaker = Home electrical circuit breaker.**

- **Closed** (normal): electricity flows (requests pass through)
- **Open** (fault detected): circuit cuts power (requests rejected immediately — no network call)  
- **Half-Open** (testing): let a small current through to see if it's safe (probe a few requests)

A payment service calling a fraud API that starts timing out at 30s:
- Without circuit breaker: every payment blocks 30s → 200 threads exhausted in 2s → payment service crashes
- With circuit breaker: after 5 failures, circuit opens → payments fail in <1ms → thread pool stays healthy → fraud API gets breathing room to recover

---

## 3. Core Concept

The **Circuit Breaker pattern** prevents cascading failures by monitoring failure rates of external dependencies and fast-failing requests when the failure rate exceeds a threshold, instead of waiting for individual timeouts.

### State Machine (3 States):
```
CLOSED → (failure threshold exceeded) → OPEN → (cooldown elapsed) → HALF_OPEN
   ↑                                              ↓
CLOSED ← (probes succeed) ←──────────────── HALF_OPEN
OPEN   ← (probes fail)   ←──────────────── HALF_OPEN
```

| State | Behavior | Transition |
|-------|---------|-----------|
| **Closed** | All requests pass through; track failures | → Open when failure rate ≥ threshold |
| **Open** | All requests fail immediately (<1ms); no network call | → Half-Open after cooldown period |
| **Half-Open** | Allow limited probe requests | → Closed if probes succeed; → Open if fail |

### The Core Problem (Optimistic Blocking):
Callers assume dependencies respond quickly → block threads/connections → dependency degrades → timeouts → resource exhaustion → cascading failure.
Circuit breakers switch to **pessimistic fast-failing** as soon as pattern detected.

---

## 4. ASCII Architecture

### Circuit Breaker State Machine

```
             5 failures in 10s window
    CLOSED ──────────────────────────────→ OPEN
     │                                      │
     │  Normal operation                    │  All requests fast-fail (<1ms)
     │  Track success/failure               │  No network calls made
     │                                      │  Return fallback
     ←────────────────────────────         ↓ after 30s cooldown
    (probes succeed)             HALF-OPEN
                                    │
                              1-3 probe requests
                                    │
                          ┌─── succeed ───┐
                          ↓               ↓
                        CLOSED           OPEN (reset timer)
```

### With vs Without Circuit Breaker

```
WITHOUT: Fraud API → DB overloaded → 30s timeout
         Payment: POST /payment → check fraud → TIMEOUT (30s) → 200 threads blocked IN 2s → crash

WITH: Fraud API → DB overloaded → 30s timeout
      5 failures detected in 5s → Circuit OPENS
      Payment: POST /payment → check fraud → CircuitBreakerOpen (<1ms) → fallback: allow small payments
      Thread pool: stays healthy (0 threads blocked)
      Fraud API: gets breathing room (no traffic), recovers in 20-30s
      After 30s: HALF-OPEN → probe → succeeds → CLOSED → normal flow resumes
```

---

## 5. How It Works

**Step 1: Normal Operation (Closed)**
Requests pass through. Circuit breaker tracks outcomes in a sliding window (10s rolling): `[success, success, failure, success, success]`. At 20% failure rate, circuit remains Closed.

**Step 2: Degradation Detected**
Sliding window fills with failures: `[fail, fail, success, fail, fail, fail]` → 83% failure rate. Exceeds 50% threshold → circuit **trips to Open**.

**Step 3: Fast-Fail Protection (Open)**
All new requests receive `CircuitBreakerOpenException` immediately — no network call. Payment service can return fallback: "use cached stock" or "allow transactions under $50." Thread pool stays healthy. Failing service receives zero traffic → breathing room to recover.

**Step 4: Recovery Testing (Half-Open)**
After cooldown (30s), circuit → Half-Open. Next request sent as probe. If success → circuit Closed immediately. If fail → circuit re-opens, cooldown timer resets.

**Step 5: Full Recovery or Re-trip**
Success: slow ramp-up (some implementations: 10% → 25% → 50% → 100% traffic) to avoid thundering herd.

### Threshold Configuration:
```
Baseline error rate: 0.1% (service SLO: 99.9%)
Acceptable degradation: 50× = 5%
→ Failure threshold: 5%
Minimum requests: 20 (at 100 req/s, this is 0.2s of samples)
Rolling window: 10s (fraud API P99 is 3s → window should be ~3× P99)
Cooldown: 60s (fraud API recovery: 30-45s → add buffer)
Probes: 3, requiring 2 successes
```

---

## 6. Variants

### Count-Based Circuit Breaker
- Track last N requests (e.g., 100), trip when X fail (e.g., 50)
- Simple: ring buffer implementation
- Downside: doesn't account for time (50 failures in 1s ≠ 50 failures in 10 min)
- **Netflix Hystrix** uses this variant

### Time-Based Circuit Breaker
- Track failure % within sliding time window (e.g., 50% failure rate in 10s)
- More adaptive to varying traffic patterns
- Requires more complex bookkeeping (HdrHistogram or time-bucketed counters)
- **Resilience4j** implements this variant

### Adaptive Circuit Breaker
- Dynamically adjusts thresholds based on observed baseline error rate
- If dependency normally has 2% errors → trip at 10%; if drops to 0.5% → trip at 5%
- Requires statistical process control or ML
- Google's SRE teams use adaptive thresholds for internal services

### Per-Endpoint Circuit Breaker
- Separate circuit states for different endpoints of same service (`/inventory/check` vs `/inventory/reserve`)
- More precise: one bad endpoint doesn't affect others
- Higher memory and configuration overhead
- **Stripe** uses per-endpoint breakers for payment APIs

### Gradual Recovery Circuit Breaker
- Half-Open allows traffic incrementally: 10% → 25% → 50% → 100%
- Prevents thundering herd when service recovers under full load
- **Uber** uses gradual recovery for critical path services

---

## 7. Trade-offs

### Aggressive vs Conservative Thresholds
| | Aggressive (low %, short window) | Conservative (high %, long window) |
|--|---|---|
| Detection speed | Fast | Slow |
| False positive risk | High (transient blips trip circuit) | Low |
| Use for | Critical path (payment, auth) | Non-critical (recommendations) |

### Fast Recovery vs Thundering Herd
- Short cooldown + single probe: recovers quickly but risks overwhelming fragile service
- Long cooldown + multiple probes: gradual recovery, delays return to normal
- Match cooldown to dependency's recovery profile (stateless = short; stateful = longer)

### Client-Side vs Server-Side Breakers
| | Client-Side | Server-Side |
|--|---|---|
| Response time | Fast (no network round-trip) | Slower (adds latency + failure point) |
| State consistency | Inconsistent across clients | Centralized, consistent |
| Use | Default — low latency | When global coordination needed |

### Granularity vs Complexity
- Service-level: simple, but one bad endpoint trips all
- Per-endpoint: precise, but complex and more memory
- Start service-level, add per-endpoint only when one endpoint takes down others

---

## 8. When to Use / When to Avoid

### ✅ Use When:
- Synchronous calls to external dependencies with variable latency
- Call chain depth ≥ 3 (A → B → C → D) where C failure cascades back
- Dependencies can fail slowly (timeouts, not just immediate errors)
- You can provide meaningful fallbacks (stale data, defaults, partial results)

### ❌ Avoid When:
- Failures are always fast and transient (immediate 503, recovers in milliseconds) — just retry
- Writes where data loss is unacceptable (financial transactions) — use retries with idempotency or queue writes
- Traffic too low to accumulate samples (< 1 req/minute)
- Internal in-process calls (no network boundary) — overkill

---

## 9. MERN Dev Notes

### Full Circuit Breaker with Fallback (Node.js)

```javascript
class CircuitBreaker {
  constructor(name, {
    failureThreshold = 5,
    successThreshold = 2,
    cooldownMs = 30000,
    windowMs = 10000
  } = {}) {
    this.name = name;
    this.state = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
    this.failures = 0;
    this.successInHalfOpen = 0;
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.cooldownMs = cooldownMs;
    this.windowMs = windowMs;
    this.nextAttempt = 0;
    this.windowStart = Date.now();
  }
  
  async call(fn, fallback = null) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        console.warn(`[CB:${this.name}] OPEN - fast failing`);
        if (fallback) return fallback();
        throw new Error(`CircuitBreakerOpen: ${this.name}`);
      }
      // Cooldown expired → try Half-Open
      this.state = 'HALF_OPEN';
      this.successInHalfOpen = 0;
      console.info(`[CB:${this.name}] → HALF_OPEN (testing recovery)`);
    }
    
    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      if (this.state === 'OPEN' && fallback) return fallback();
      throw err;
    }
  }
  
  _onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successInHalfOpen++;
      if (this.successInHalfOpen >= this.successThreshold) {
        this.state = 'CLOSED';
        this.failures = 0;
        console.info(`[CB:${this.name}] → CLOSED (recovered)`);
      }
    } else {
      // Reset failure count in window
      if (Date.now() - this.windowStart > this.windowMs) {
        this.failures = 0;
        this.windowStart = Date.now();
      }
    }
  }
  
  _onFailure() {
    this.failures++;
    if (this.failures >= this.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.cooldownMs;
      console.error(`[CB:${this.name}] → OPEN (${this.failures} failures), cooldown ${this.cooldownMs}ms`);
    }
  }
  
  getState() { return { name: this.name, state: this.state, failures: this.failures }; }
}

// Usage with Express route
const inventoryBreaker = new CircuitBreaker('inventory', {
  failureThreshold: 5,
  cooldownMs: 30000
});

router.get('/product/:id', async (req, res) => {
  const { id } = req.params;
  
  const inventory = await inventoryBreaker.call(
    () => fetchInventory(id),                                    // Primary call
    () => getCachedInventory(id) || { stock: null, cached: true } // Fallback
  );
  
  res.json({ productId: id, ...inventory });
});

// Monitor breaker state
router.get('/health/breakers', (req, res) => {
  res.json([inventoryBreaker.getState()]);
});
```

### Threshold Calculation Utility

```javascript
/**
 * Calculate circuit breaker thresholds for a dependency
 * @param {object} config - dependency characteristics
 */
const calcCircuitBreakerConfig = ({
  sloPercent,        // e.g., 99.9 for 99.9% SLO
  criticality,       // 'critical' | 'important' | 'optional'
  peakRps,           // peak requests per second
  p99LatencyMs,      // P99 latency in ms
  recoveryTimeMs     // expected recovery time in ms
}) => {
  const baselineError = (100 - sloPercent) / 100;  // e.g., 0.001
  const multipliers = { critical: 10, important: 50, optional: 100 };
  const failureRateThreshold = baselineError * multipliers[criticality];
  
  return {
    failureThreshold: Math.max(5, Math.round(peakRps * 0.2)),  // min 20% of rps
    failureRateThreshold: Math.min(failureRateThreshold, 0.5), // cap at 50%
    windowMs: p99LatencyMs * 3,                                // 3× P99
    cooldownMs: recoveryTimeMs * 1.5,                          // 1.5× recovery time
    minRequests: Math.max(5, Math.round(peakRps * 0.1))        // at least 10% of rps
  };
};

// Example: fraud API
const fraudBreakerConfig = calcCircuitBreakerConfig({
  sloPercent: 99.9,
  criticality: 'critical',
  peakRps: 100,
  p99LatencyMs: 3000,
  recoveryTimeMs: 30000
});
// → { failureRateThreshold: 0.01, windowMs: 9000, cooldownMs: 45000, ... }
```

---

## 10. Real-World Examples

### Netflix — Hystrix Streaming API
- API gateway aggregates data from dozens of services (profile, recommendations, continue watching, trending)
- Recommendations circuit breaker: 50% failure rate over 10s window → OPEN
- Fallback: return generic recommendations or empty carousel immediately
- Result: Reduced P99 latency by **40% during incidents**, prevented 3 major outages in 2014
- Now migrated from Hystrix → **Resilience4j** and **Envoy** (service mesh)

### Uber — Adaptive Fraud API Protection
- Payment service calls fraud API; 2018 incident: fraud DB overloaded → 30s timeouts
- Without circuit breaker: all payment threads would exhaust → all payments fail
- With circuit breaker: detected 80% failure rate in 5s → tripped to Open
- Fallback: allow transactions under $50 without fraud checks → 90% payments keep flowing
- During peak hours (Friday nights): thresholds more sensitive (lower threshold %) than off-peak

### Amazon — DynamoDB Client-Side Breakers
- DynamoDB throttles hot partitions → 400 errors
- Without circuit breaker: clients retry aggressively → amplify throttling → worse
- DynamoDB SDK detects 50% throttle rate over 1s → opens circuit for that partition key
- Other partitions continue normally
- Result: reduces retry storms by **70%**, improves P99 latency by **60%** during throttling events

---

## 11. Interview Cheat Sheet

### One-Liner
> "Circuit breakers prevent cascading failures by detecting aggregate failure rates and fast-failing requests (Open state) instead of waiting for individual timeouts. Three states: Closed (normal) → Open (fast-fail) → Half-Open (test recovery)."

### Always Know These Numbers:
- **Closed → Open**: failure rate ≥ threshold (set based on SLO baseline × multiplier)
- **Open → Half-Open**: after cooldown period (match to recovery time × 1.5)
- **Half-Open → Closed**: probe probes succeed (2-3 probes recommended)
- **Half-Open → Open**: probes fail → reset cooldown

### Circuit Breaker vs Timeout (Interviewers Ask):
- **Timeout**: handles individual request hanging (sets deadline per call)
- **Circuit Breaker**: handles aggregate failure patterns (acts on rate of failures)
- You need **both**: timeout cuts individual hanging calls; circuit breaker stops calling a failing service at all

### Circuit Breaker vs Retry:
- **Retry**: handles transient failures (temporary network glitch)
- **Circuit Breaker**: handles systemic failures (service is down for minutes)
- When retries keep failing → circuit breaker trips → stop retrying → protect resources

### Threshold Formula:
```
failure_threshold = baseline_error_rate × acceptable_degradation_multiplier
critical:  1× SLO error → 10-20× = 1-2%
important: 1× SLO error → 50×   = 5%
optional:  1× SLO error → 100×  = 10%
```

---

## 12. Red Flags + Keywords

### Red Flags to Avoid

❌ **"Circuit breakers eliminate the need for timeouts"** — You need both; timeouts for individual requests, circuit breakers for aggregate pattern detection

❌ **"Circuit breakers handle all failures"** — They fast-fail; you still MUST design fallbacks for degraded behavior

❌ **"Set circuit breaker threshold to 1% failure rate always"** — Calibrate to your SLO baseline; too aggressive → false positives; too lenient → delayed detection

❌ **"All instances share one circuit breaker state"** — Client-side breakers are per-instance by default; needs coordination for global shared state

❌ **"Half-Open = send 100% traffic immediately"** — Thundering herd risk; use 1-3 probes or gradual ramp-up (10% → 25% → 50% → 100%)

### Keywords / Glossary

| Term | Meaning |
|------|---------|
| **Circuit Breaker** | State machine that fast-fails requests to unhealthy dependencies |
| **Closed State** | Normal operation; requests pass through; failures tracked |
| **Open State** | Fast-fail mode; all requests rejected immediately; no network call |
| **Half-Open State** | Recovery testing; limited probe requests allowed |
| **Failure Threshold** | % of requests that must fail to trip circuit (e.g., 50%) |
| **Cooldown Period** | Time circuit stays Open before allowing probe requests |
| **Probe Request** | Test request sent in Half-Open to verify recovery |
| **Thundering Herd** | All clients retry simultaneously when service recovers → overwhelm it |
| **Fast-Fail** | Reject request immediately (<1ms) without making a network call |
| **Cascading Failure** | Failure in one service propagates upstream via blocked threads |
| **Rolling Window** | Time window over which failure rate is measured |
| **Count-Based CB** | Track last N requests (Hystrix approach) |
| **Time-Based CB** | Track failure % within time window (Resilience4j approach) |
| **Adaptive CB** | Adjust thresholds based on observed baseline error rates |
| **Hystrix** | Netflix's circuit breaker + bulkhead library (now in maintenance) |
| **Resilience4j** | JVM resiliency library, modern Hystrix replacement |
| **False Positive** | Circuit trips when service is actually healthy |
| **False Negative** | Circuit doesn't trip when service is genuinely failing |
