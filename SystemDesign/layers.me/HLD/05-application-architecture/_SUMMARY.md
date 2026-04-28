# M5 — Application Architecture: Quick-Review Summary

> 9 topics | Covers: App Layer, Microservices, Service Discovery, BG Jobs, EDA, Scheduling, Async Results, API Gateway, Rate Limiting

---

## Topics at a Glance

| # | Topic | Core Insight |
|---|---|---|
| T01 | Application Layer Overview | 3-tier architecture; stateless app tier is the key to horizontal scaling |
| T02 | Microservices Architecture | Decompose by business domain; solve team independence, not just technical problems |
| T03 | Service Discovery | Logical name → live IP list; replaces hardcoded IPs for ephemeral services |
| T04 | Background Jobs | Offload slow/risky work out of the request cycle via queue + worker pool |
| T05 | Event-Driven Architecture | Emit events (facts); consumers react independently via broker |
| T06 | Schedule-Driven Architecture | Timer-triggered work; needs leader election to prevent duplicate execution |
| T07 | Returning Results | 4 async result patterns: Polling, Long-Poll, Webhook, WebSockets |
| T08 | API Gateway | Single entry point; centralises auth, rate limiting, SSL, routing |
| T09 | Rate Limiting | Control request rate per user/IP/endpoint to protect against overload/abuse |

---

## T01 — Application Layer Overview

### Three-Tier Architecture
```
Client → Web Tier (Nginx/ALB) → Application Tier (business logic) → Data Tier (DB + Cache)
```

**Why separate?** Scale app tier independently; swap data tier without touching logic; keep HTTP concerns out of business code.

### Stateless vs Stateful

| | **Stateless** | **Stateful** |
|---|---|---|
| Session data | External store (Redis, JWT) | Server memory |
| Load balancing | Any server handles any request | Requires sticky sessions |
| Horizontal scaling | ✅ Trivial | ❌ Complex |
| Default choice | ✅ Always prefer | Only when required (e.g. WebSocket) |

```
❌ Session in server RAM → Load balancer sends req to different server → "Who are you?"
✅ Session in Redis → Any server reads same session → Works perfectly
```

---

## T02 — Microservices Architecture

**Definition**: Decompose app into small, independently deployable services, each owning its own data, logic, and API.

```
❌ WRONG — Decompose by technical layer (distributed monolith):
  API Service → Business Logic Service → Database Service (all still coupled)

✅ CORRECT — Decompose by business domain:
  Order Service (owns: order DB + order logic + order API)
  Payment Service (owns: payment DB + payment logic + payment API)
  Each deploys independently, fails independently
```

### When Microservices Make Sense
| ✅ Use | ❌ Don't Use |
|---|---|
| Multiple teams owning distinct domains | Single small team |
| Independent scaling needs (video encoding vs auth) | Early-stage product (premature optimization) |
| Polyglot tech requirements (ML in Python, API in Go) | Simple domain with few interactions |

### Costs of Microservices
- **Network latency** — cross-service calls add 1–50ms each hop
- **Distributed transactions** — no ACID across services; use Saga pattern
- **Operational complexity** — N services = N deployment pipelines, N health dashboards
- **Data consistency** — eventual consistency between services is the norm

> **Monolith first** is a valid pattern. Decompose when teams step on each other, not on day one.

---

## T03 — Service Discovery

**Problem**: Services are ephemeral — they scale, restart, get replaced. Hardcoded IPs break immediately.

```
Without discovery: Order Service → "10.0.1.42:8080" (hardcoded) → instance rotates → FAIL
With discovery:    Order Service → "payment-service" (logical) → Registry resolves to live IPs
```

### Two Discovery Patterns

| | Client-Side Discovery | Server-Side Discovery |
|---|---|---|
| Who queries registry? | Client service | Load balancer / gateway |
| Client knows IPs? | Yes — picks one | No — asks LB |
| Example | Netflix Eureka + Ribbon | Kubernetes Service |
| Complexity | Higher (client logic) | Lower for client |

### Service Registry Lifecycle
```
1. Service starts → registers: { name, IP, port, health-check-path }
2. Registry sends health probe every 10s → 3 failures → deregisters
3. Consumer queries registry → gets live IP list
4. Consumer picks one (round-robin, least-conn, etc.)
5. Service shuts down → deregisters (or TTL expires)
```

> Modern default: **Kubernetes Services** — built-in service discovery via DNS (`payment-service.default.svc.cluster.local`).

---

## T04 — Background Jobs

**Pattern**: Web request returns `202 Accepted` instantly; slow work runs in a background worker.

```
User Request (e.g. upload video)
        ↓
Web Server validates + enqueues job → returns 202 Accepted (< 50ms)
        ↓
Job Queue (Redis/SQS/RabbitMQ) — durable buffer
        ↓
Worker Pool pulls jobs and executes (may take minutes)
        ↓
On success → update DB; on failure → retry; after N retries → Dead Letter Queue (DLQ)
```

### When to Offload to Background

| Condition | Example |
|---|---|
| Execution > 200ms | Video transcoding, PDF generation, image resize |
| Non-critical-path | Welcome email, push notifications |
| Retries needed | Webhook delivery, third-party API calls |
| Batch/periodic | Nightly billing, report generation |
| Rate-limited external calls | SMS via Twilio, emails via SendGrid |

### Reliability Patterns
- **Idempotency**: jobs may run more than once (at-least-once delivery) — design workers to be idempotent
- **DLQ (Dead Letter Queue)**: after N failures, move to DLQ for human inspection — never silently discard
- **Job deduplication**: use unique job IDs; skip if already processed
- **Priority queues**: critical jobs (password reset) skip ahead of bulk (weekly newsletter)

---

## T05 — Event-Driven Architecture (EDA)

**Core concept**: Producer emits an **event** (immutable fact) into a broker; consumers subscribe and react independently.

```
REST (tight coupling):
  OrderService → PaymentService → InventoryService → EmailService (slow, coupled, one failure = all fail)

EDA (loose coupling):
  OrderService emits: { "event": "OrderPlaced", "orderId": "abc123" }
                ↓
        Message Broker (Kafka / RabbitMQ)
          ↓         ↓         ↓
     Payment   Inventory   Email
     Service   Service     Service
     (each reacts independently, in parallel, at its own pace)
```

### Event vs Command
- **Event** = past-tense fact: `OrderPlaced`, `PaymentProcessed`, `UserSignedUp` ✅
- **Command** = imperative instruction: `ProcessOrder`, `SendEmail` ❌ (these are RPC calls)

### Two Core EDA Patterns

| | Pub-Sub | Event Streaming |
|---|---|---|
| Example systems | RabbitMQ, SNS | Kafka, Kinesis |
| Retention | Fire-and-forget | Retained (configurable) |
| Replay | No | Yes — replay events from any offset |
| Consumers | Each consumer gets a copy | Consumer groups share partition load |
| Best for | Notifications, fan-out | Audit trail, analytics, replay |

### EDA Trade-offs
- **Advantage**: loose coupling, independent scaling, natural async, resilient to consumer failures
- **Disadvantage**: harder to debug (no single call trace), eventual consistency, requires idempotent consumers

---

## T06 — Schedule-Driven Architecture

**Problem**: Standard cron on every server instance = all N instances fire the job at 2AM = N duplicate executions.

**Solutions**:

| Solution | How | Example |
|---|---|---|
| **Leader election** | Only leader fires the job | ZooKeeper/Redis distributed lock |
| **Dedicated scheduler** | One node is the scheduler; others are workers | Airflow, k8s CronJob |
| **Distributed job table** | Each job has a status in DB; only one worker can claim it | Bull queue with `repeat` option |

```
With leader election:
  Leader (Instance A): fires at 2AM → executes ✅
  Instance B: detects it's not leader → skips ✅
  Instance C: detects it's not leader → skips ✅
```

### Cron Expression Reference
```
┌────── minute (0–59)
│ ┌──── hour (0–23)
│ │ ┌── day of month (1–31)
│ │ │ ┌ month (1–12)
│ │ │ │ ┌ day of week (0–7)

0 2 * * *    → every day at 2:00 AM
*/15 * * * * → every 15 minutes
0 9 * * 1    → every Monday at 9:00 AM
```

### DST and Clock Change Risks
- A `2:30 AM` job fires **twice** when clocks fall back (two 2:30 AMs exist)
- A `2:30 AM` job is **skipped** when clocks spring forward (2:30 AM doesn't exist)
- Fix: use UTC for all scheduled jobs; never schedule in local timezone

---

## T07 — Returning Results (Async Patterns)

After returning `202 Accepted`, how does the client get the result?

### Pattern 1: Polling
```
Client → GET /jobs/abc123 → { status: "pending" } (repeated with backoff)
Client → GET /jobs/abc123 → { status: "complete", result: "..." }
```
- **Simple** but wastes requests and adds latency
- Use **exponential backoff**: 1s → 2s → 4s → 8s → 32s cap

### Pattern 2: Long-Polling
```
Client → GET /jobs/abc123 (server holds connection open for 30s)
Server returns when either: job completes OR timeout reached → client re-connects immediately
```
- Reduces wasted requests vs polling
- Server holds open connections; ~30s timeout must be set to avoid proxy cuts

### Pattern 3: Webhooks
```
Client registers: POST /webhooks { url: "https://myapp.com/result", events: ["job.complete"] }
Server calls client URL when job finishes: POST https://myapp.com/result { jobId, result }
```
- **Best for**: server-to-server; client must be publicly addressable
- Client must respond with `200 OK` within 10s or server retries
- **Idempotent handlers** required (webhook may be retried)

### Pattern 4: WebSockets
```
Client ←→ Persistent bidirectional connection ←→ Server
Server pushes result the instant it's ready (no polling, no waiting)
```
- Best real-time UX; maintains open TCP connection
- Use for: chat, live dashboards, real-time notifications
- Not suitable for: simple request/response, fire-and-forget tasks

### Comparison

| | Polling | Long-Polling | Webhook | WebSocket |
|---|---|---|---|---|
| **Direction** | Client pulls | Client pulls (held) | Server pushes | Bidirectional |
| **Latency** | High (poll interval) | Low | Low | Lowest |
| **Wasted requests** | High | Low | None | None |
| **Client needs public URL** | No | No | Yes | No |
| **Best for** | Simple status checks | Light real-time | Server→server callbacks | Real-time UI |

---

## T08 — API Gateway

**Definition**: Single entry point for all external requests to microservices. Centralises cross-cutting concerns.

```
Without API Gateway:
  Each of N services independently implements auth, rate limiting, SSL, logging → duplicated N times

With API Gateway:
  Client → [API Gateway] → User Service
                      ↓ → Order Service
                      ↓ → Search Service
  Auth / SSL / Rate Limit / Logging → handled ONCE in the gateway
```

### 6-Stage Request Pipeline
```
1. TLS Termination — decrypt HTTPS → internal HTTP
2. Authentication — validate JWT / API Key → reject 401 if invalid
3. Authorization — check permissions → reject 403 if unauthorized
4. Rate Limiting — check quotas → reject 429 if exceeded
5. Routing — match path/header rules → select backend microservice
6. Load Balancing — distribute across service instances
```

### What Belongs in the Gateway vs Services

| API Gateway | Individual Services |
|---|---|
| JWT validation, API key checking | Business-specific authorization rules |
| Global rate limiting | Service-specific circuit breaking |
| SSL termination | Domain logic, data validation |
| Request/response logging | Service-level health metrics |
| Protocol translation (REST ↔ gRPC) | Data persistence |

> **Examples**: AWS API Gateway, Kong, Nginx (configured as gateway), Envoy, Traefik.

---

## T09 — Rate Limiting

**Purpose**: Control how many requests a client can make in a time window. Prevent abuse, protect backend.

### Four Rate Limiting Algorithms

**1. Fixed Window Counter** — Count requests per fixed window (e.g., 0–60s).
```
Window 12:00–12:00:59: requests 0→1000 (limit) → REJECT
Window 12:01–12:01:59: counter resets → allow again
❌ Flaw: 1000 requests at :59 + 1000 at :01 = 2000 in 2 seconds
```

**2. Sliding Window Log** — Store timestamp of every request; count in last N seconds.
```
New request at T=100: count all timestamps in [T-60, T] → if ≥ limit → reject
✅ No boundary bug. ❌ High memory (store every timestamp).
```

**3. Sliding Window Counter** — Weighted average of current + previous window.
```
Count = (prev_window_count × overlap_ratio) + current_window_count
✅ Accurate approximation. ✅ O(1) memory per user.
```

**4. Token Bucket** — Tokens refill at rate R; each request consumes 1 token.
```
Bucket capacity: 100 tokens
Refill rate: 10 tokens/second
Request arrives: take 1 token → OK; bucket empty → 429
✅ Allows bursting up to bucket capacity. ✅ Smooth rate.
```

**5. Leaky Bucket** — Requests enter a queue; processed at fixed rate R.
```
Queue size: 100. Processing rate: 10 req/sec.
Burst fills queue → subsequent overflow → 429
✅ Smooth output rate (no bursting). ✅ Backend sees uniform load.
```

### Distributed Rate Limiting
```
Redis INCR + TTL (atomic, works across all instances):
  INCR user:123:window:1720000060
  EXPIRE user:123:window:1720000060 60
  if count > limit → return 429
```

### Response Headers
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1720000060
Retry-After: 42   (on 429 response)
```

---

## Interview Cheat Sheet — M5

| Question | Answer |
|---|---|
| Why separate app tier from web and data tiers? | Independent scaling, swap implementations, clean separation of concerns |
| What is the #1 requirement for horizontal scaling? | Stateless application — all state maintained externally in Redis/DB |
| What problem do microservices really solve? | Team independence — not primarily a technical problem |
| When should you NOT use microservices? | Small team, early product stage, simple domain — start with a monolith |
| What's the difference between an event and a command? | Event = past-tense fact (thing that happened); Command = imperative instruction (do this thing) |
| Why does cron on every server cause problems? | All N instances fire the job simultaneously → duplicate execution; fix with leader election |
| What is a DLQ? | Dead Letter Queue — where jobs go after N failed retries, for manual inspection |
| Polling vs Webhook — when to use each? | Polling = simple status checks; Webhook = server-to-server push when client has public URL |
| What is the API gateway's main benefit? | Centralises cross-cutting concerns (auth, rate limit, SSL, logging) so each service doesn't duplicate them |
| Which rate limiting algorithm allows bursting? | Token Bucket — allows bursting up to bucket capacity, then smooths out |
| What Redis command enables distributed rate limiting? | `INCR key` + `EXPIRE key TTL` — atomic increment with auto-expiry per window |
| What does `202 Accepted` mean? | "I received your request and am processing it" — used with background jobs; result not ready yet |

---

## Keywords

`three-tier` · `stateless` · `horizontal scaling` · `microservices` · `bounded context` · `DDD` · `service discovery` · `Consul` · `Eureka` · `Kubernetes Services` · `background jobs` · `job queue` · `DLQ` · `idempotency` · `event-driven` · `pub-sub` · `Kafka` · `RabbitMQ` · `event streaming` · `leader election` · `cron` · `schedule-driven` · `polling` · `long-polling` · `webhook` · `WebSocket` · `API gateway` · `rate limiting` · `token bucket` · `leaky bucket` · `sliding window` · `fixed window` · `429 Too Many Requests`
