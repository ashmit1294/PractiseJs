# Rate Limiting: Protecting Your API from Overload

> **Module 5 — Application Architecture**  
> Source: https://layrs.me/course/hld/05-application-architecture/rate-limiting

---

## ELI5 — Explain Like I'm 5

Imagine a theme park ride that can only safely carry 1,000 guests per hour. The operator puts a turnstile at the entrance that lets exactly 1,000 people through each hour and turns everyone else away (or asks them to wait).

Rate limiting is that turnstile: it controls **how many requests a client can make in a time window**, protecting the backend from overload or abuse.

---

## Analogy

| Theme Park | Rate Limiter |
|---|---|
| Turnstile counts guests per hour | Counter tracked per user per time window |
| "Sorry, ride is full for this hour" | HTTP 429 Too Many Requests |
| VIP pass: extra capacity | Premium tier: higher request quota |
| Emergency: freeze all entry | Global rate limit (DDoS protection) |

---

## Core Concept

Rate limiting is applied to:
- **Per user / API key** — prevents one client from monopolising resources
- **Per IP** — prevents bots / DDoS from a single source
- **Per endpoint** — expensive endpoints get tighter limits
- **Global** — protects the whole system under extreme load

```
Client A sends 1001 requests in 1 minute (limit = 1000/min):
  Request 1–1000: HTTP 200 OK
  Request 1001:   HTTP 429 Too Many Requests
                  Retry-After: 42
                  X-RateLimit-Limit: 1000
                  X-RateLimit-Remaining: 0
                  X-RateLimit-Reset: 1720000060
```

---

## Algorithm 1: Fixed Window Counter

Divide time into fixed windows (e.g., 0–60s, 60–120s). Count requests per window.

```
Window: 12:00:00 – 12:00:59
  Request counter: 0 ──► 999 ──► 1000 (LIMIT!) ──► REJECT

Window: 12:01:00 – 12:01:59
  Request counter: 0 (reset) ──► allow again
```

**Boundary problem (critical flaw)**:
```
12:00:59: 1000 requests (end of window 1) → all allowed
12:01:00: 1000 requests (start of window 2) → all allowed
Result: 2000 requests in 2 seconds — violates 1000/min intent
```

Simple to implement but vulnerable to burst at window boundaries.

---

## Algorithm 2: Sliding Window Log

Keep a log of every request timestamp. On each request, remove entries older than the window and count the rest.

```
Window: last 60 seconds (sliding)
  Log: [12:00:01, 12:00:10, 12:00:45, 12:00:58]
  Request at 12:01:02: remove entries < 12:00:02
  Count remaining: 3. Limit = 1000. ALLOW. Add 12:01:02.
```

| Pros | Cons |
|---|---|
| Accurate to the millisecond | High memory: stores every request timestamp |
| No boundary burst problem | With millions of clients, memory grows unboundedly |

---

## Algorithm 3: Sliding Window Counter (Recommended)

Approximate the sliding window using two fixed window counters. Weighted average based on how far into the current window we are.

```
current_time = 12:01:45 (45s into the 12:01 window)
prev_window  = 12:00: 800 requests
curr_window  = 12:01: 600 requests so far

weight of prev window = (60 - 45) / 60 = 0.25

estimated count = 800 × 0.25 + 600 = 200 + 600 = 800

Limit = 1000. ALLOW.
```

**Trade-off**: slight approximation error (<1%) in exchange for O(1) memory per user per window.

---

## Algorithm 4: Token Bucket

A bucket holds tokens (capacity N). Tokens are added at a fixed rate (R per second). Each request consumes 1 token.

```
Bucket capacity: 100 tokens
Refill rate: 10 tokens/second

State at t=0: 100 tokens (full)
  Burst: 100 requests in 1 second ──► 100 tokens consumed ──► all allowed
  Request 101: 0 tokens ──► REJECT

State at t=10: 100 tokens (refilled)
  Normal: 10 req/s long-term ──► always allowed (matches refill rate)
```

**Key property**: allows bursts up to bucket capacity, then throttles to the refill rate.  
Used by: **Stripe** (base 100 req/s, burst 1000 tokens).

---

## Algorithm 5: Leaky Bucket

Requests enter a queue (bucket). Processed at a fixed output rate. Excess overflow = rejected.

```
Bucket capacity: 40 units
Processing rate: 2 units/second

t=0: 40 units arrive instantly ──► fill bucket ──► all enter queue
t=0–20: 2 units/sec processed (steady drain)
t=0: unit 41 arrives ──► bucket full ──► REJECT

Output: smooth, predictable rate regardless of input burst
```

**Key property**: strict, smooth output rate. Spikes are absorbed by the queue; excess is dropped.  
Used by: **Shopify** (cost-based: GET=1 unit, complex mutation=10 units, bucket capacity=40).

---

## Algorithm Comparison

| Algorithm | Burst handling | Memory | Accuracy | Best for |
|---|---|---|---|---|
| Fixed window | ❌ Boundary bursts | ✅ O(1) | ❌ Low | Simple internal rate limiting |
| Sliding window log | ✅ Perfect | ❌ O(n) requests | ✅ Exact | Low-volume, high-accuracy needs |
| Sliding window counter | ✅ Good (~1% error) | ✅ O(1) | ✅ High | **Standard choice — most APIs** |
| Token bucket | ✅ Burst-friendly | ✅ O(1) | ✅ Good | Payment APIs (Stripe), user-facing APIs |
| Leaky bucket | ❌ Absorbs, not allows, bursts | ✅ O(queue) | ✅ Good | Strict output-rate control (Shopify) |

---

## Distributed Rate Limiting (Multi-Server)

Without coordination, 10 servers each allowing 1000 req/min = 10,000 req/min total.

**Solution**: centralised counter in Redis.

```
Fixed Window (Redis INCR):
  INCR ratelimit:{user_id}:{window_start}
  EXPIRE ratelimit:{user_id}:{window_start} 60
  if count > limit: REJECT

Token Bucket (atomic Lua script — prevents race conditions):
  -- atomically read bucket, check, update
  local key      = KEYS[1]
  local capacity = tonumber(ARGV[1])
  local rate     = tonumber(ARGV[2])
  local now      = tonumber(ARGV[3])
  local bucket   = redis.call('HMGET', key, 'tokens', 'last_refill')
  local tokens   = tonumber(bucket[1]) or capacity
  local last     = tonumber(bucket[2]) or now
  local elapsed  = now - last
  local refill   = math.min(capacity, tokens + elapsed * rate)
  if refill < 1 then return 0 end — rejected
  redis.call('HMSET', key, 'tokens', refill - 1, 'last_refill', now)
  return 1 — allowed
```

**Key format**: `ratelimit:{user_id}:{window}` or `ratelimit:{ip}:{endpoint}:{window}`

---

## HTTP Response Headers

Always return rate limit context to clients so they can self-throttle:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 42                    ← seconds until client can retry
X-RateLimit-Limit: 1000            ← quota per window
X-RateLimit-Remaining: 0           ← remaining in current window
X-RateLimit-Reset: 1720000060      ← Unix timestamp when window resets
```

---

## Fail-Open Strategy

When Redis (the rate limit store) is down:

```
Option 1 — Fail closed: reject all requests  ← DON'T DO THIS (100% outage)
Option 2 — Fail open:   allow all requests   ← Risky but available
Option 3 — Fail safe:   use local in-memory limiter at 10× normal limits
                         (temporary protection; better than full outage)
```

Stripe and most large-scale APIs use **fail open with local fallback**.

---

## Real-World Examples

| Company | Algorithm | Details |
|---|---|---|
| **Stripe** | Token bucket | 100 req/s base rate per API key. Burst capacity: 1000 tokens. Heavy API users get higher base rates with SLA agreements |
| **Shopify** | Leaky bucket | Cost-based: simple GET = 1 cost unit; complex mutations = 10 units. Bucket capacity = 40 units; drains at 2 units/sec. Prevents expensive GraphQL queries from monopolising processing |
| **Twitter** | Hybrid | Fixed window for write operations (tweet creation: 300/3hrs); sliding window counter for read API calls. Different limits per endpoint |
| **GitHub** | Fixed window + Token bucket | Unauthenticated: 60 req/hr per IP. Authenticated: 5000 req/hr. GitHub Actions: separate higher limits |

---

## MERN Dev Notes

```
npm install express-rate-limit          # Simple fixed-window rate limiting
npm install rate-limit-redis            # Redis store for distributed rate limiting
npm install ioredis                     # Redis client
```

```js
// Distributed rate limiting with express-rate-limit + Redis
const rateLimit  = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis      = require('ioredis');
const redis      = new Redis(process.env.REDIS_URL);

const limiter = rateLimit({
  windowMs:         60 * 1000,          // 1 minute window
  max:              100,                 // 100 requests per window per key
  standardHeaders:  true,               // Return X-RateLimit-* headers
  legacyHeaders:    false,
  keyGenerator:     (req) => req.user?.id || req.ip, // per user, fallback to IP
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  handler: (req, res) => {
    res.status(429).json({
      error:   'Too many requests',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000 - Date.now() / 1000),
    });
  },
  skip: (req) => {         // fail-open: if Redis is down, allow request
    return !redis.status === 'ready';
  },
});

// Apply globally
app.use('/api/', limiter);

// Tighter limit on expensive endpoint
const heavyLimiter = rateLimit({ windowMs: 60000, max: 10, store: ... });
app.post('/api/export', heavyLimiter, exportHandler);
```

```js
// Redis Lua token bucket (atomic, race-condition-safe)
const BUCKET_SCRIPT = `
  local key      = KEYS[1]
  local capacity = tonumber(ARGV[1])
  local rate     = tonumber(ARGV[2])
  local now      = tonumber(ARGV[3])
  local bucket   = redis.call('HMGET', key, 'tokens', 'last_refill')
  local tokens   = tonumber(bucket[1]) or capacity
  local last     = tonumber(bucket[2]) or now
  local elapsed  = now - last
  local refill   = math.min(capacity, tokens + elapsed * rate)
  if refill < 1 then
    redis.call('HSET', key, 'tokens', refill, 'last_refill', now)
    return 0
  end
  redis.call('HMSET', key, 'tokens', refill - 1, 'last_refill', now)
  redis.call('EXPIRE', key, 3600)
  return 1
`;

async function checkTokenBucket(userId) {
  const result = await redis.eval(
    BUCKET_SCRIPT, 1,
    `ratelimit:${userId}`,   // key
    100,                      // capacity
    10,                       // rate (tokens/second)
    Date.now() / 1000         // now
  );
  return result === 1;  // true = allowed
}
```

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| What is the boundary problem in fixed window? | Client sends 1000 at :59 + 1000 at :00 = 2000 in 2s despite a 1000/min limit |
| Sliding window counter trade-off? | ~1% accuracy error using weighted prev+current window average; in exchange for O(1) memory. Best general solution |
| Token bucket vs leaky bucket? | Token: burst-friendly (bucket absorbs spikes). Leaky: smooth output rate (strict drip regardless of input) |
| Why Redis Lua for token bucket? | Atomicity: check-and-update must be atomic or parallel requests all see stale token count → over-allow |
| What to return on 429? | `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |
| Rate limit key format? | `ratelimit:{user_id}:{window}` — scope by user (not just IP to avoid shared NAT blocking) |
| Fail-open or fail-closed? | Fail-open with local in-memory fallback limiter at 10× limits. Never reject all traffic because Redis is down |

**Red flags**:
- In-memory rate limiting per server (10 servers = 10× the intended limit)
- No `Retry-After` header (clients don't know when to retry → they immediately retry, causing more 429s)
- Using only IP-based limiting (shared corporate NAT → all employees blocked)
- No rate limiting on internal microservice APIs (insider abuse, misconfigured clients)

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Rate limiting** | Controlling how many requests a client can make in a given time window |
| **Fixed window** | Time divided into equal buckets; counter resets at window boundary |
| **Sliding window log** | Exact count within a rolling time window using a timestamp log |
| **Sliding window counter** | Approximation using two fixed windows weighted by elapsed time; O(1) memory |
| **Token bucket** | Tokens added at fixed rate; requests consume tokens; allows bursts up to capacity |
| **Leaky bucket** | Queue of fixed capacity; empties at fixed rate; smooth output, excess dropped |
| **HTTP 429** | "Too Many Requests" — the correct status code for rate limit exceeded |
| **Retry-After** | HTTP header indicating how many seconds before client can retry |
| **Fail-open** | When rate limit store (Redis) is unavailable, allow rather than reject traffic |
| **Lua script** | Atomic Redis script that reads + updates state in one indivisible operation |
| **Cost-based limiting** | Requests have different costs (Shopify: GET=1, mutation=10); bucket depletes by cost |
| **DDoS** (Distributed Denial of Service) | Flooding with requests from many sources to overwhelm the server |
