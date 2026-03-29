# Application Layer Overview

> **Module 5 — Application Architecture**  
> Source: https://layrs.me/course/hld/05-application-architecture/application-layer-overview

---

## ELI5 — Explain Like I'm 5

Imagine a restaurant:
- **Front-of-house (web tier)** — the host/waiter who talks to customers and takes orders.
- **Kitchen (application tier)** — the chefs who do the actual cooking (business logic).
- **Pantry/cold storage (data tier)** — where ingredients are kept (database/cache).

The kitchen never talks to the customers directly; the chefs never go shopping in real-time.
Each "room" can be upgraded independently. More chefs for busy nights. Bigger pantry for more stock.

---

## Analogy

| Real world | System design |
|---|---|
| The host takes your order | Web tier parses the HTTP request |
| The chef executes the recipe | Application tier runs business logic |
| Pantry/fridge | Data tier (DB + cache) |
| Order ticket between host and chef | API contract between web and app tier |

---

## Core Concept

The **application layer** (app tier) is where business rules live.  
It sits between the web tier (HTTP handling) and the data tier (persistence).

```
Three-Tier Architecture:

Client        Web Tier           Application Tier                Data Tier
  │         ┌──────────┐       ┌──────────────────┐       ┌────────────┐
  │──HTTP──►│  Nginx   │──────►│  App Servers     │──────►│ PostgreSQL │
  │         │  AWS ALB │       │  (Business Logic)│       │ Redis      │
  │         └──────────┘       └──────────────────┘       │ MongoDB    │
  │                                     │                  └────────────┘
  └─────────────────────────────────────┘
```

**Why separate tiers?**
- Scale the app tier independently of the web tier
- Keep business logic away from HTTP concerns (authentication, routing)
- Replace the data tier (e.g., migrate from MySQL to Postgres) without touching app logic

---

## Key Areas

### 1. Stateless vs Stateful Design

| | **Stateless** | **Stateful** |
|---|---|---|
| Session data | External store (Redis, JWT) | Server memory |
| Load balancing | Any server handles any request | Sticky sessions required |
| Horizontal scaling | ✅ Trivial | ❌ Complex |
| Example | Twitter timeline API | WebSocket chat server |

**Rule of thumb**: Default to stateless. Use stateful only when required (e.g., real-time bidirectional connections).

```
Stateful WRONG — session in server memory:
  User → Server 1 → session saved in Server 1 RAM
  User → Server 2 → "Who are you?" ← 500 Error

Stateless CORRECT — session in Redis:
  User → Server 1 → GET session from Redis → OK
  User → Server 2 → GET session from Redis → OK (same data)
```

### 2. Horizontal Scaling Patterns

```
Each app server handles: Rreq/server
Total target:            Ttotal req/sec
Servers needed:          ceil(Ttotal / Rper_server × 1.2)  ← +20% safety buffer

Example: 50,000 RPS, 1,000 RPS per server, 20% headroom → 60 servers
```

- **Auto-scaling group** (AWS ASG / GKE HPA): scale out at CPU > 70%, scale in at CPU < 30%
- Health checks drop unhealthy instances from LB rotation within seconds

### 3. Separation of Concerns

```
                   ┌─────────────────────────────────────────────────┐
Web tier:          │  Parse HTTP · TLS termination · Rate limiting   │
                   │  Authentication · Static files · Request routing│
                   └─────────────────────────────────────────────────┘
                                        │
                   ┌─────────────────────────────────────────────────┐
Application tier:  │  Business logic · Validation · Orchestration   │
                   │  Aggregation · Error handling · Domain rules    │
                   └─────────────────────────────────────────────────┘
                                        │
                   ┌─────────────────────────────────────────────────┐
Data tier:         │  Persistence · Replication · Caching · Backup  │
                   └─────────────────────────────────────────────────┘
```

Uber example: Node.js API gateway (web tier) → Go microservices (app tier) → Postgres/Cassandra (data tier)

### 4. Service Boundaries — Monolith vs Microservices

| | **Monolith** | **Microservices** |
|---|---|---|
| Deployment | One deploy | Independent per service |
| Scaling | All-or-nothing | Granular |
| Team size | < 10 engineers | Multiple teams (3+ per service) |
| Examples | Instagram (early), Shopify | Netflix, Uber, Amazon |

**Two-pizza rule** (Amazon): service owned by a team small enough to feed with two pizzas (~6–10 engineers).

### 5. Resilience Patterns

| Pattern | What it does |
|---|---|
| **Circuit breaker** | After N failures, stop calling the failing service; return fallback |
| **Retry with exponential backoff** | 1s → 2s → 4s retries for transient failures |
| **Timeout** | Don't let a slow service hang your request indefinitely |
| **Bulkhead** | Isolate resources per service (separate thread pools) |

```
Circuit breaker state machine:
  CLOSED (healthy) → [N consecutive failures] → OPEN (failing fast)
  OPEN → [60s cooldown] → HALF-OPEN → [1 test request succeeds] → CLOSED
                                                ↓ fails
                                              OPEN
```

Netflix's Hystrix (now Resilience4j) popularized these patterns in JVM microservices.

---

## How Things Connect

```
Application Layer connects to everything:
  ← HTTP requests from web tier
  → Service calls to database, cache, message queues
  → Downstream microservices via service discovery
  → Background jobs via task queues (Bull/SQS)
  → APIs exposed through API gateway
```

Choosing **stateless** enables horizontal scaling → requires load balancer → impacts latency/availability.  
Choosing **microservices** requires service discovery, API gateways, distributed tracing.

---

## Real-World Context

| Company | Stage | Architecture choice | Reason |
|---|---|---|---|
| **Instagram** | Early (small team) | Django monolith | Speed of iteration, no penalty at seed stage |
| **Amazon** | 500+ engineers | Microservices (2002) | Organizational scaling — too many teams on one codebase |
| **Netflix** | High scale | Microservices (~2009) | Video encoding vs recommendation vs auth — wildly different scaling |
| **Shopify** | Mature monolith | Modular monolith | Rails with strict module boundaries — monolith can scale with discipline |
| **Stripe** | Financial compliance | Synchronous microservices (critical path) + async background jobs (receipts) | Strong consistency for payments, flexibility for non-critical |

---

## MERN Dev Notes

| Concern | Implementation |
|---|---|
| Web tier | Express.js or Next.js API routes |
| App tier | Business logic in `services/` layer; controllers are thin |
| Auth | JWT in Authorization header (stateless) or `connect-redis` sessions |
| Circuit breaker | `opossum` package (Node.js circuit breaker) |
| Retry | `axios-retry` or manual exponential backoff |
| Health check | `GET /health` returning 200 and DB/Redis ping |
| Separation | `routes/` → `controllers/` → `services/` → `models/` |

```
Express 3-layer pattern:
  routes/user.js        → define HTTP endpoints
  controllers/user.js   → parse request, call service, format response
  services/user.js      → business logic, DB calls, validation
  models/User.js        → Mongoose schema + queries
```

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| What belongs in the application tier? | Business rules, validation, orchestration, data aggregation |
| Why separate web from application tier? | Independent scaling; web tier handles HTTP concerns, app tier focuses on logic |
| When to use stateless vs stateful? | Stateless by default; stateful only for real-time bidirectional (WebSocket, live games) |
| When is a monolith better than microservices? | Small teams (<10), unclear domain boundaries, startup phase |
| How do you handle a downstream service failure? | Circuit breaker + fallback + retry with backoff |
| What is the application layer bottleneck before the database? | Usually CPU (serialization) or blocking I/O — solve with async, worker threads, or horizontal scaling |

**Red flags**:
- "We'll add stateful sessions; sticky sessions will handle it" — breaks horizontal scaling
- Defaulting to microservices with no justification (day-1 startup) — builds distributed monolith
- Putting business logic in routes/controllers instead of a services layer
- Not calculating capacity — "we'll just add more servers"

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Application tier** | Layer executing business logic, sitting between web and data tiers |
| **Web tier** | Layer handling HTTP, TLS, routing, authentication |
| **Data tier** | Persistence layer: databases, caches, object stores |
| **Three-tier architecture** | Web → Application → Data; each independently scalable |
| **Stateless server** | No user-specific state stored locally; any server can handle any request |
| **Circuit breaker** | Pattern stopping calls to a failing service after N failures |
| **Bulkhead** | Isolating resources so one service's failures don't starve others |
| **Monolith** | All application code in a single deployable unit |
| **Modular monolith** | Monolith with strict internal module boundaries; Shopify pattern |
| **Two-pizza team** | Amazon rule: teams should be small enough to feed with 2 pizzas |
| **HPA** (Horizontal Pod Autoscaler) | Kubernetes scaling mechanism based on CPU/custom metrics |
