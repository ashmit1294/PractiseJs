# Retry Storm

## ELI5
A busy restaurant has a 5-minute wait. Instead of waiting, every customer immediately leaves and comes back — and every time they see a wait, they leave and come back again. The restaurant is overwhelmed by returning customers BEFORE it can serve any of them. Retries without backoff turn a brief outage into a sustained avalanche.

## Analogy
1,000 people all simultaneously hammer a jammed door, preventing it from ever opening. The solution is to spread out their attempts over time (backoff) with some randomness (jitter).

---

## Core Concept
**Retry Storm** is a failure mode where retries by multiple clients amplify a transient failure into a sustained cascade, overwhelming the originally-failing service.

### The Amplification Math
```
Scenario: Single failure through 3 service layers
Each service retries 3 times on failure:

Amplification = (retries + 1) ^ layers = (3 + 1)^3 = 64×

1,000 concurrent user failures
  × 64× retry amplification
= 64,000 requests hitting the already-struggling DB

The service that was briefly slow is now crushed.
```

---

## Exponential Backoff Formula

```
delay = min(base_delay × 2^attempt, max_delay)

Example:
  Attempt 0: delay = min(100ms × 2^0) = 100ms
  Attempt 1: delay = min(100ms × 2^1) = 200ms
  Attempt 2: delay = min(100ms × 2^2) = 400ms
  Attempt 3: delay = min(100ms × 2^3) = 800ms
  Attempt 4: min(100ms × 2^4, 30,000ms) = 1,600ms
  ...
  Max delay cap: 30 seconds (prevent unbounded wait)
```

---

## Jitter Formula (Prevents Synchronized Retries)

```javascript
// PROBLEM without jitter:
// 1,000 clients all back off to exactly 400ms → synchronized thundering herd

// Full jitter (Netflix recommendation):
function withJitter(delay) {
  return Math.random() * delay;  // random between 0 and delay
}

// Decorrelated jitter (gRPC recommendation):
let prevDelay = BASE_DELAY;
function decorrelatedJitter(baseDelay, maxDelay) {
  const delay = Math.min(maxDelay, Math.random() * prevDelay * 3);
  prevDelay = delay;
  return Math.max(baseDelay, delay);
}

// Effect of jitter:
// 1,000 synchronized retries at 400ms → spread over 400ms window
// → ~100 requests per 100ms window instead of 1,000 at once (10× peak reduction)
```

---

## Circuit Breaker Pattern

```
States:
  CLOSED (normal)  →  OPEN (failure)  →  HALF-OPEN (recovery test)
       ↑___________________________________|

CLOSED:
  All requests pass through
  Track error rate in sliding window
  Transition to OPEN when: error_rate > 50% AND min 20 requests in window

OPEN:
  ALL requests fail immediately (fail-fast, no actual call)
  Return cached response or error
  After timeout (e.g., 60s), transition to HALF-OPEN

HALF-OPEN:
  Allow limited requests (e.g., 10 per second) to probe service
  If ≥10 consecutive successes → CLOSED
  If any failure → back to OPEN
```

```javascript
class CircuitBreaker {
  constructor({ threshold = 0.5, minRequests = 20, timeout = 60000 } = {}) {
    this.state = 'CLOSED';
    this.failures = 0;
    this.requests = 0;
    this.openedAt = null;
    this.threshold = threshold;
    this.minRequests = minRequests;
    this.timeout = timeout;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker OPEN — failing fast');
      }
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
    this.requests++;
    if (this.state === 'HALF_OPEN') this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    this.requests++;
    const errorRate = this.failures / this.requests;
    if (this.requests >= this.minRequests && errorRate >= this.threshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}
```

---

## Retry Budget (Token Bucket)

```javascript
class RetryBudget {
  constructor({ total = 100, refillRate = 10 } = {}) {
    this.tokens = total;
    this.refillRate = refillRate;  // tokens/second
    this.lastRefill = Date.now();
  }

  canRetry() {
    this._refill();
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }

  _refill() {
    const elapsed = (Date.now() - this.lastRefill) / 1000;
    this.tokens = Math.min(100, this.tokens + elapsed * this.refillRate);
    this.lastRefill = Date.now();
  }
}

// Only retry errors 5xx and network timeouts, NEVER 4xx:
function isRetriable(error) {
  if (error.response) {
    return error.response.status >= 500;  // NEVER retry 4xx
  }
  return error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
}
```

---

## Retry Decision Flow

```
Error occurs
    │
    ▼
Is error retriable? (5xx / network timeout)
    │ NO → Fail immediately, return error to caller
    │ YES
    ▼
Has request deadline been exceeded?
    │ YES → Fail immediately (no point retrying past deadline)
    │ NO
    ▼
Is circuit breaker OPEN?
    │ YES → Fail fast, return cached response if available
    │ NO
    ▼
Is retry budget available?
    │ NO → Return 429-like error ("Retry budget exhausted")
    │ YES
    ▼
Calculate backoff + jitter
Sleep(delay)
Make retry attempt
```

---

## ASCII: Without vs With Backoff

```
WITHOUT BACKOFF (Retry Storm)
─────────────────────────────────────────────────────────
Time: 0s       DB hiccup    Retries     DB overwhelmed
C1 ──────────────▼──────────▼▼▼───────────▼▼▼─────► Never recovers
C2 ──────────────▼──────────▼▼▼───────────▼▼▼─────► Never recovers
C3 ──────────────▼──────────▼▼▼───────────▼▼▼─────► Never recovers
[1,000 clients × 3 retries = 4,000 concurrent requests]

WITH EXPONENTIAL BACKOFF + JITTER
─────────────────────────────────────────────────────────
Time:    0s         0.1s        0.3s        0.7s
C1 ──────▼──────────────────────────────────────►retry→success!
C2 ─────────▼────────────────────────────►retry→success!
C3 ──────────────▼───────────────────►retry→success!
[Load spreads over time → service recovers before blizzard returns]
```

---

## MERN Developer Notes

```javascript
// Axios with retry (axios-retry)
const axiosRetry = require('axios-retry');

axiosRetry(apiClient, {
  retries: 3,
  retryCondition: (error) => {
    // Only retry 5xx and network errors, never 4xx
    return axiosRetry.isNetworkError(error) ||
           (error.response && error.response.status >= 500);
  },
  retryDelay: (retryCount) => {
    const base = 100;
    const max = 30000;
    const exp = Math.min(base * Math.pow(2, retryCount), max);
    // Add jitter: ±25%
    return exp * (1 + (Math.random() * 0.5 - 0.25));
  },
});
```

---

## Real-World Examples

| Company | Incident | Root Cause | Fix | Result |
|---|---|---|---|---|
| Twitter 2013 | 2-hour outage | 5-min DB hiccup → mobile clients retried aggressively | Backoff 1s-60s + CB at 25% error + 15% retry budget | Isolated to 5 min outage |
| Netflix | Cascading microservice failures | Synchronous retries amplified single slowdown | Hystrix: full jitter + 50% error threshold + startup grace | Bounded blast radius |
| Stripe | Risk of duplicate charges on retry | Non-idempotent payment retry | Idempotency keys + retry budget token bucket | Zero duplicate charges |

---

## Interview Cheat Sheet

**Q: A service is slow and retries are making it worse — how do you diagnose?**

> A: Check if retry logic has exponential backoff and jitter. Look at request volume to the slow service: if it's growing rather than decreasing during a slowdown, retries are amplifying. Check circuit breaker state (if any). Calculate amplification: if there are 3-4 service layers each retrying 3 times, that's (3+1)^4 = 256× amplification.

**Q: Why is jitter critical in exponential backoff?**

> A: Without jitter, all clients back off to the same exact delay (e.g., 400ms), then all retry simultaneously — a synchronized thundering herd that hits the recovering service in a coordinated wave. Jitter spreads retries randomly across the delay window. Full jitter (random 0 to delay) reduces peak pressure by ~20-30×.

**Q: What errors should you never retry?**

> A: Never retry 4xx client errors — they indicate the request itself is invalid (400 Bad Request, 401 Unauthorized, 403 Forbidden, 422 Unprocessable) and will fail again regardless of how many retries. Only retry 5xx server errors and network-level failures (timeout, connection reset). Special case: 429 (Rate Limited) should be retried ONLY after the `Retry-After` delay.

**Q: What's the difference between a circuit breaker and retry budget?**

> A: Circuit breaker: tracks error rate for a specific service; when error rate exceeds threshold, breaks the circuit and fails all requests fast without attempting real calls. Recovers by testing with limited traffic. Scope: per-dependency. Retry budget: limits total retry volume across all requests; when budget is exhausted, any new retry is rejected. Prevents one bad period from consuming all capacity. Scope: global or per-service.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **Retry storm** | Retries by many clients amplifying a transient failure into a cascade |
| **Exponential backoff** | Delay doubles with each retry attempt (+ max cap) |
| **Jitter** | Random variation added to retry delay to desynchronize clients |
| **Circuit breaker** | Pattern that fails fast when error rate exceeds threshold — prevents retry amplification |
| **Retry budget** | Token bucket limiting total retry volume — prevents over-retrying |
| **Thundering herd** | Many clients hitting the same resource simultaneously after a synchronized pause |
| **Request deadline** | Maximum time allotted for a request — stop retrying when deadline exceeded |
| **Idempotency key** | Client-generated unique key ensuring repeated requests have same effect as one |
| **Half-open state** | Circuit breaker state that probes service with limited traffic before fully closing |
| **Fail-fast** | Return error immediately instead of blocking — improves overall system responsiveness |
