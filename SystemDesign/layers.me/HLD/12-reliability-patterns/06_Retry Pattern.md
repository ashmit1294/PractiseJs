# 06 — Retry Pattern: Exponential Backoff & Jitter

> **Module**: M12 — Reliability Patterns  
> **Section**: Section 1 — Resiliency Patterns  
> **Source**: https://layrs.me/course/hld/12-reliability-patterns/retry  
> **Difficulty**: Intermediate | 9 min read

---

## 1. ELI5 — Explain Like I'm 5

When you knock on a door and no one answers, you don't immediately knock 100 times in a row. You wait a moment, try again, wait a bit longer, try again. And if it seems like no one is home, you eventually give up.

That's the retry pattern: try, wait, try again — but wait a little longer each time. And don't keep trying if the door is clearly broken.

---

## 2. The Analogy

**Retry + Exponential Backoff = Redial with increasing patience.**

You call a doctor's office, line is busy:
- Attempt 1: call immediately
- Attempt 2: wait 2 min (it was briefly busy)
- Attempt 3: wait 5 min (maybe a long call)
- Attempt 4: wait 10 min (office might be having a problem)

If 100 people all tried to call whose line was busy at 9:00 AM, they'd all redial at 9:02, jam the lines again, redial at 9:04... The solution is **jitter**: each person waits a *slightly random* amount between 2-3 minutes. "Thundering herd" avoided.

---

## 3. Core Concept

The **Retry pattern** automatically re-attempts failed operations to handle transient failures (network blips, brief throttling, temporary unavailability). Three mechanisms make it safe:

1. **Exponential backoff** — doubles wait time between attempts; gives service time to recover
2. **Jitter** — randomizes exact wait time; prevents all clients retrying simultaneously ("thundering herd")
3. **Retry budget** — caps total retry traffic; prevents a wave of retries from causing a cascade

### What to Retry (and What NOT to):
| Error | Retry? | Reason |
|-------|--------|--------|
| 503 Service Unavailable | ✅ | Transient overload |
| 429 Too Many Requests | ✅ | Rate limit — wait and retry |
| 408 Request Timeout | ✅ | Network glitch |
| 500 Internal Server Error | ✅ only if idempotent | Server bug — might repeat |
| 400 Bad Request | ❌ | Invalid input — retry won't fix it |
| 401 Unauthorized | ❌ | Auth failure — retry won't get credentials |
| 404 Not Found | ❌ | Resource missing — won't appear on retry |

---

## 4. ASCII Architecture

### Retry Timeline with Exponential Backoff + Jitter

```
Base delay: 100ms | Max delay: 32s | Jitter: ×(0.5–1.0)

t=0ms    Attempt 1 ───────────────────────→ TIMEOUT (100ms)
t=150ms  Wait (100ms base, jitter: 150ms)
t=250ms  Attempt 2 ───────────────────────→ 503 (200ms timeout)
t=550ms  Wait (200ms base, jitter: 300ms)
t=850ms  Attempt 3 ───────────────────────→ 200 OK ✅
         Done in < 1s; user barely noticed

t=5000ms Overall deadline: STOP retrying (regardless of attempts remaining)
```

### Retry Storm (Without Budget) vs Controlled (With Budget)

```
WITHOUT budget — Retry Storm:
1000 clients → service degrades, 50% fail → each retries ×5 → 3500 req/s
                                                                 ↓
                             Service overloaded at 350% → NEVER RECOVERS

WITH budget — Controlled:
1000 clients → service degrades, 50% fail → retry budget: 20% → only 200 retries
                                                                   ↓
                             Total: 1200 req/s → service recovers
```

---

## 5. How It Works

**Step 1: Classify the Failure**
Inspect error type. Retry transient (503, 429, 408). Never retry client errors (400, 401, 404). For 500, only retry if operation is idempotent. Uber's API gateway maintains a whitelist of retryable status codes per service, updated from production incident analysis.

**Step 2: Calculate Backoff Delay**
```
delay = min(max_delay, base_delay × 2^attempt)
actual_delay = delay × (0.5 + random(0, 0.5))  // jitter between 50% – 100%
```
base=100ms, max=32s → Attempt 1: 100ms, 2: 200ms, 3: 400ms, 4: 800ms, ... 9+: 32s

**Step 3: Check Retry Budget (Token Bucket)**
Before retrying, verify retry budget not exceeded:
```
retry_budget_tokens = normal_rps × budget_percentage × time_window
For 1000 req/s, 20% budget, 10s window → 2000 tokens
Each retry consumes 1 token. Empty bucket = fail fast (don't retry)
```

**Step 4: Idempotency Token for Non-Idempotent Operations**
For POST/payment operations: generate unique `idempotency-key` on first attempt. Reuse it on all retries. Server checks key → returns cached result if already processed. Prevents double charges.

**Step 5: Timeout per Attempt + Overall Deadline**
```
request_timeout = backoff_delay × 0.75  // shorter than wait interval
overall_deadline = first_request_time + max_total_duration (e.g., 5s)
```
Stop all retries at overall deadline, regardless of remaining attempts.

**Step 6: Integrate with Circuit Breaker**
Monitor failure rate across original + retry requests. If circuit is OPEN → don't retry at all. Return cached/degraded response immediately. Retries against an open circuit waste resources and delay failure detection.

---

## 6. Variants

### Fixed Delay Retry
- Same interval between all attempts (e.g., always 1s)
- Simple; use when recovery time is predictable (DB reconnect = exactly 500ms)
- Avoid for general network calls where failure duration is unknown

### Linear Backoff
- Increase by constant amount each attempt: 100ms, 200ms, 300ms
- Slower growth → more attempts within deadline vs exponential
- Use when expecting quick recovery but wanting more attempts

### Retry with Fallback
- After exhausting retries, return cached data or degraded result (vs failing hard)
- Netflix: stale recommendations from cache when recommendation service is down
- Use when partial functionality > complete failure

### Hedged Requests
- Send duplicate request to a second replica after P95 latency to reduce tail latency
- Whichever responds first is used; duplicate cancelled
- Google Search uses this between replicas
- Requires idempotent reads; careful resource management

### Adaptive Retry
- Adjust backoff parameters based on observed failure patterns
- If 90% of retries succeed on attempt 2 → reduce max attempts to 3
- Requires rich telemetry + careful tuning

---

## 7. Trade-offs

### Retry Aggressiveness vs Resource Consumption
- 10 retries at 1000 req/s = 10,000 req/s total under failure — can destroy recovery
- Aggressive retry: critical user-facing requests with **strong idempotency guarantees**
- Conservative retry: background jobs, or when downstream lacks circuit breakers

### Immediate vs Delayed First Retry
- Immediate retry after connection error (not server error) is sometimes OK for attempt #1
- Always use backoff for subsequent retries and for any server errors (503+)

### Client-Side vs Server-Side Retry
| | Client-Side | Server-Side |
|--|--|--|
| Control | Client decides | Centralized |
| Consistency | Varies by client | Uniform |
| Use for | Public APIs | Internal services you control |

### Synchronous vs Asynchronous
- Synchronous: blocks caller, immediate feedback, ties resources
- Asynchronous (via queue): frees caller, but requires durable storage
- Sync for user-facing; async for background jobs (see Queue-Based Load Leveling)

---

## 8. When to Use / When to Avoid

### ✅ Use When:
- Calling over unreliable networks (cross-region, public APIs)
- Transient failures are common (rate limits, temporary overload)
- Operations are idempotent (GET, PUT) OR you can add idempotency tokens (POST)
- Downstream has capacity for modest retry traffic

### ❌ Avoid When:
- Client errors (400, 401) — won't be fixed by retry
- Non-idempotent operations without idempotency keys — causes duplicates
- Downstream is critically overloaded — use circuit breaker instead
- Strict latency requirements (real-time gaming)
- Operation can use async queue with delayed reprocessing instead

### Anti-Patterns:
- ❌ Retry without backoff or jitter — hammers struggling service
- ❌ Infinite retries without max attempts or overall deadline
- ❌ Retry non-idempotent operations without tokens
- ❌ No retry budget — allows uncapped retry storms
- ❌ No circuit breaker coordination — retries against permanently failed service

---

## 9. MERN Dev Notes

### Retry with Exponential Backoff + Jitter + Budget (Node.js)

```javascript
class RetryClient {
  constructor({
    maxAttempts = 3,
    baseDelayMs = 100,
    maxDelayMs = 32000,
    retryBudgetPercent = 0.2, // 20%
    budgetWindowMs = 10000
  } = {}) {
    this.maxAttempts = maxAttempts;
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.retryBudgetPercent = retryBudgetPercent;
    this.budgetWindowMs = budgetWindowMs;
    this.originalRequests = 0;
    this.retryRequests = 0;
    this.windowStart = Date.now();
  }
  
  _calcDelay(attempt) {
    const exponential = Math.min(this.maxDelayMs, this.baseDelayMs * Math.pow(2, attempt));
    return exponential * (0.5 + Math.random() * 0.5); // 50%–100% jitter
  }
  
  _isRetryable(error) {
    const RETRYABLE_CODES = new Set([408, 429, 500, 503, 504]);
    return error?.status ? RETRYABLE_CODES.has(error.status) : true; // network errors
  }
  
  _checkBudget() {
    const now = Date.now();
    if (now - this.windowStart > this.budgetWindowMs) {
      // Reset window
      this.originalRequests = 0;
      this.retryRequests = 0;
      this.windowStart = now;
    }
    const budget = this.originalRequests * this.retryBudgetPercent;
    return this.retryRequests < budget;
  }
  
  async execute(fn, { idempotencyKey = null, overallDeadlineMs = 5000 } = {}) {
    this.originalRequests++;
    const deadline = Date.now() + overallDeadlineMs;
    
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      if (Date.now() > deadline) {
        throw new Error(`Deadline exceeded after ${attempt} attempts`);
      }
      
      try {
        const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
        return await fn(headers);
      } catch (err) {
        const isLastAttempt = attempt === this.maxAttempts - 1;
        
        if (isLastAttempt || !this._isRetryable(err)) throw err;
        if (!this._checkBudget()) throw new Error('Retry budget exhausted — fail fast');
        
        const delay = this._calcDelay(attempt);
        console.warn(`[Retry] Attempt ${attempt + 1} failed (${err.status ?? 'network'}), waiting ${Math.round(delay)}ms`);
        this.retryRequests++;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
}

// Usage
const retryClient = new RetryClient({ maxAttempts: 3, baseDelayMs: 100 });
const { v4: uuidv4 } = require('uuid');

router.post('/charge', async (req, res) => {
  const { userId, amount } = req.body;
  const idempotencyKey = req.headers['idempotency-key'] || uuidv4();
  
  try {
    const result = await retryClient.execute(
      (headers) => paymentService.charge(userId, amount, headers),
      { idempotencyKey, overallDeadlineMs: 5000 }
    );
    res.json({ chargeId: result.id, status: 'charged' });
  } catch (err) {
    res.status(503).json({ error: 'Payment failed after retries', detail: err.message });
  }
});
```

### Backoff Formula Reference

```javascript
// Exponential backoff formula
const calcBackoff = (attempt, base = 100, max = 32000) =>
  Math.min(max, base * Math.pow(2, attempt));

// Jitter variants:
// Equal jitter (50-100% of exponential):
const equalJitter = (delay) => delay * (0.5 + Math.random() * 0.5);

// Full jitter (0-100% of exponential — max spread):
const fullJitter = (delay) => delay * Math.random();

// Decorrelated jitter (AWS recommended — avoids synchronization):
let prev = 100;
const decorrelatedJitter = (base, max) => {
  const next = Math.min(max, base + Math.random() * (prev * 3 - base));
  prev = next;
  return next;
};

// Retry budget token bucket
class RetryBudget {
  constructor(normalRps, budgetPercent, windowMs) {
    this.maxTokens = normalRps * budgetPercent * (windowMs / 1000);
    this.tokens = this.maxTokens;
    setInterval(() => { this.tokens = this.maxTokens; }, windowMs);
  }
  tryConsume() {
    if (this.tokens <= 0) return false;
    this.tokens--;
    return true;
  }
}
```

---

## 10. Real-World Examples

### Uber — Retry Budget at Load Balancer Level
- Dispatch service retries driver assignment; 15% retry budget; unique request IDs as idempotency tokens
- **2019 incident**: retry budget bug disabled → datacenter network issue → retries spiked to 400% normal load → recovery blocked for 45 minutes
- Fix: enforce retry budgets at **load balancer level** as hard limit (not just app-level guidance)

### Stripe — Mandatory Idempotency Keys
- All POST mutation requests require `Idempotency-Key` header; stored for 24 hours
- 40% of integration bugs: developers disabling retries or writing custom retry logic violating idempotency
- If same key seen more than 10 times → API fails the request (forces investigation)
- SDK default: 3 attempts, exponential backoff capped at 60s

### AWS SDK — Adaptive Retry + Decorrelated Jitter
- DynamoDB throttling (ProvisionedThroughputExceededException): SDK uses exponential + full jitter, tracks token bucket for retry capacity
- **Lambda cold-start incident**: 1000s of concurrent Lambdas all hit DynamoDB simultaneously → throttled → all retried in sync (same jitter seed)
- Fix: per-execution jitter seed based on request ID → decorrelated retries → P99 latency reduced 60% during traffic spikes

---

## 11. Interview Cheat Sheet

### One-Liner
> "Retry with exponential backoff and jitter handles transient failures by re-attempting with increasing delays. Jitter prevents thundering herds. Retry budgets cap total retry traffic. Idempotency keys prevent duplicate side effects. Circuit breakers stop retries when failures are systemic."

### Formulas:
```
delay = min(max_delay, base_delay × 2^attempt)
actual = delay × (0.5 + random(0, 0.5))
budget = normal_rps × budget_percent × window_seconds
```

### Retry vs Circuit Breaker:
| | Retry | Circuit Breaker |
|--|--|--|
| For | Transient failures (ms–seconds) | Systemic failures (service down) |
| Action | Re-attempt with backoff | Stop sending requests entirely |
| Complements | Circuit breaker detects pattern | Retry handles individual |
| Together | Retry → failure pattern detected → CB opens → stop retrying |

### Why Jitter?
Without jitter: all 1000 clients retry at t=100ms → synchronized thundering herd.
With jitter: clients spread retries between 50ms and 100ms → 1000/50ms = 20 retries/ms smoothed burst.

---

## 12. Red Flags + Keywords

### Red Flags to Avoid

❌ **"Retry without backoff or jitter"** — Hammer the struggling service into the ground; thundering herd; must have both

❌ **"Retry all error types indiscriminately"** — Don't retry 400 Bad Request, 401 Unauthorized — these won't succeed on retry

❌ **"No idempotency for POST operations"** — Retries can double-charge customers, create duplicate records; mandatory

❌ **"No retry budget"** — 10 retries × 1000 req/s = 10,000 req/s under failure; cascades the cascade

❌ **"No circuit breaker integration"** — Retrying against a permanently failed service wastes all resources; must coordinate

❌ **"Timeouts ≥ backoff intervals"** — Slow response delays next retry; per-attempt timeout must be shorter than backoff

### Keywords / Glossary

| Term | Meaning |
|------|---------|
| **Exponential Backoff** | Double the wait time with each retry attempt |
| **Jitter** | Random variance applied to delays to prevent synchronized retries |
| **Thundering Herd** | All clients retry simultaneously → amplify load on struggling service |
| **Retry Budget** | Max ratio of retry requests to original requests (e.g., 20%) |
| **Token Bucket** | Algorithm to enforce retry budget: add tokens per original request, consume per retry |
| **Idempotency Key** | Unique token attached to request so duplicate retries return cached result |
| **Idempotent Operation** | Same operation executed N times = same result (GET, PUT) |
| **Transient Failure** | Brief fault that resolves on its own (<seconds): network blip, rate limit |
| **Retry Storm** | Cascade where retries amplify load on a recovering service |
| **Retry Budget** | Cap on total retry traffic to prevent storms (e.g., max 20% of normal) |
| **Overall Deadline** | Max duration for all retry attempts; stop retrying after this regardless of count |
| **Decorrelated Jitter** | AWS technique: `min(max, random(base, prev × 3))` — avoids synchronization |
| **Full Jitter** | `random(0, delay)` — maximum spread, prevents all synchronized retries |
| **Equal Jitter** | `delay × (0.5 + random)` — between 50% and 100% of exponential |
| **Hedged Request** | Duplicate requests sent after P95 latency to reduce tail latency |
| **Adaptive Retry** | Adjust parameters based on observed failure patterns and success rates |
