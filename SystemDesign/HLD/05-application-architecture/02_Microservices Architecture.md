# Microservices Architecture: Benefits & Trade-offs

> **Module 5 — Application Architecture**  
> Source: https://layrs.me/course/hld/05-application-architecture/microservices

---

## ELI5 — Explain Like I'm 5

One big shopping mall with every store under one roof = **monolith**.  
Lots of separate specialty stores, each with its own owner and delivery truck = **microservices**.

When one store runs out of stock (service crash), the entire mall doesn't close.  
Each store can renovate independently without shutting down the others.  
But now you need a map (service discovery), parking management (load balancing), and security across every entrance (auth at gateway or per-service).

---

## Analogy

| | **Monolith** | **Microservices** |
|---|---|---|
| Analogy | One restaurant with everything made in one kitchen | A food court with specialized stalls |
| Deploy one feature | Shut the whole kitchen, re-open | Swap out only the sushi stall |
| A bug in one feature | Could crash everything | Isolated blast radius |
| Team independence | Everyone queues for the same codebase | Each team owns their stall end-to-end |

---

## Core Concept

**Microservices architecture** decomposes an application into small, independently deployable services organized around **business domains** (not technical layers).

```
WRONG — Decompose by technical layer (creates distributed monolith):
  API Service ──► Business Logic Service ──► Database Service
  (all tightly coupled; any deploy requires coordination)

CORRECT — Decompose by business domain:
  Order Service   (owns order DB, order logic, order API)
  Payment Service (owns payment DB, payment logic, payment API)
  User Service    (owns user DB, user logic, user API)
  (each deploys independently, fails independently)
```

**The key organizational insight**: microservices solve **team independence** more than technical problems.  
If you don't have multiple teams, a well-structured monolith is simpler.

---

## The Problem Microservices Solve

In a monolith at scale:
- Teams block each other (merge conflicts, shared schema changes)
- A bug in the recommendations engine can crash the payment checkout
- You can only scale everything together — can't scale just the video transcoding
- Single language/framework forces poor fit for some problems (e.g., ML in Java)
- 30+ minute build times

```
Monolith coupling cascade:
  Billing team changes users table → 
  breaks profile team schema → 
  breaks order team query →
  all three teams must coordinate deploy simultaneously
```

---

## How It Works — 5 Steps

### Step 1: Identify Bounded Contexts (Domain-Driven Design)

Ask: "Can this capability change independently?"  
If payment processing evolves without affecting trip matching → separate services.

**Uber's domains**: riders, drivers, trips, payments, routing, notifications.

### Step 2: Define Service APIs and Contracts

Each service exposes a versioned contract (REST, gRPC, or event schema):
```
Trip Service:
  POST /trips         ← create a trip
  GET  /trips/{id}    ← get trip details
  Event: TripCompleted {tripId, riderId, driverId, fare}
```

**Critical**: services own their data exclusively. No other service may `JOIN` across the boundary.  
If Payment Service needs trip data → call the Trip Service API, not the trips table directly.

### Step 3: Inter-Service Communication

**Synchronous (request-response)**:
- REST/HTTP: familiar, easy to debug
- gRPC: binary, typed, faster — good for internal high-throughput

**Asynchronous (events)**:
- Kafka, RabbitMQ, SQS: producer doesn't wait; consumers react independently
- When trip completes → publish `TripCompleted` → Payment + Analytics + Notifications each react

```
Synchronous (blocks, fast):
  Trip Service ──gRPC──► Pricing Service (wait for response)
  Trip Service ──gRPC──► Routing Service (wait for response)

Async / Event-driven (non-blocking):
  Trip Service ──Kafka──► TripCompleted event
                                ├──► Payment Service (deducted asynchronously)
                                ├──► Analytics Service (updated asynchronously)
                                └──► Notification Service (receipt sent async)
```

### Step 4: Deploy and Scale Independently

```
Routing Service: deploy 10× per day (algo updates)
Payment Service: deploy weekly (compliance review)

Rush hour:  scale Routing Service ×30 independently
Off-peak:    scale down Routing Service, keep Payment at baseline
```

### Step 5: Handle Cross-Cutting Concerns with Service Mesh

Sidecar pattern: an Envoy/Istio proxy is deployed alongside each service pod.  
The sidecar handles: retries, timeouts, mutual TLS (mTLS), distributed tracing, circuit breaking.

Result: each service's code focuses on business logic; the mesh handles infrastructure concerns.

---

## Variants

| Variant | Description | Use case |
|---|---|---|
| **Domain microservices** | Services per bounded context; each owns data | Default pattern (Uber, Amazon) |
| **BFF** (Backend for Frontend) | Separate gateway per client type (iOS vs web) | Mobile needs aggressive aggregation; web needs richer data |
| **Micro-frontends** | Teams own both backend service and UI components | Very large orgs wanting end-to-end ownership |
| **Modular monolith** | Single deployable; strict internal module boundaries | Small-medium teams wanting isolation without distributed complexity |

---

## Trade-offs

| Concern | Microservices | Monolith |
|---|---|---|
| **Deployment independence** | ✅ Each service deploys autonomously | ❌ Every change requires full deploy |
| **Granular scaling** | ✅ Scale only what needs it | ❌ All-or-nothing scaling |
| **Fault isolation** | ✅ One service crashes; others continue | ❌ One crash can take down all |
| **Operational complexity** | ❌ Kubernetes, tracing, mesh, 50+ pipelines | ✅ One server, one pipeline |
| **Data consistency** | ❌ Distributed transactions (saga pattern) | ✅ Simple SQL ACID transactions |
| **Team productivity (small)** | ❌ Overhead slows small teams | ✅ Fast iteration |
| **Team productivity (large)** | ✅ Teams work autonomously | ❌ Coordination overhead grows quadratically |

---

## Anti-Patterns

| Anti-pattern | Why it's bad |
|---|---|
| **Distributed monolith** | Split code into services but still share DBs and synchronous call chains → worst of both worlds |
| **Chatty services** | Order → Inventory → Pricing → Discount = 4 synchronous hops = 400ms latency compounded |
| **Shared database** | Two services writing to the same table = tight coupling despite separate code |
| **Premature decomposition** | Starting with microservices day one before understanding domain = constant schema migrations |
| **No team ownership** | "Platform team" owns all services = microservices complexity without team autonomy benefit |

---

## When to Use

**Use microservices when**:
- 3+ teams need to deploy independently without coordination
- Parts of the system have wildly different scaling characteristics (video encoding vs auth API)
- You have operational maturity (CI/CD, Kubernetes, monitoring, on-call)

**Don't use microservices when**:
- Startup finding product-market fit (overhead > speed)
- Team < 10 engineers
- Domain boundaries are unclear (you'll refactor forever)
- No DevOps maturity

---

## Real-World Examples

| Company | Scale | Key detail |
|---|---|---|
| **Netflix** | 700+ microservices, 200M+ subscribers, deployed 1000s of times/day | Built Hystrix (circuit breaker), Eureka (service discovery), Spinnaker (CD) because no existing tooling worked at their scale |
| **Uber** | 2,200+ microservices (migrated from Python monolith 2014–2018) | Built Jaeger for distributed tracing; each city semi-independently deployed for local regulations |
| **Amazon** | Pioneered microservices (~2002); Bezos mandate: "all teams expose APIs, no direct DB access" | Driven by organizational scaling needs — 500+ engineers couldn't share a codebase |

---

## MERN Dev Notes

| Decision | Guidance |
|---|---|
| To microservice or not? | For most MERN apps: start with a well-organized monolith (`routes/` → `services/` → `models/`) |
| If you do split | Start with clear boundaries: User Service (Express) + separate Product Service |
| Communication | Axios/fetch for REST between services; Bull + Redis for async jobs |
| Database | Each service its own DB collection or separate MongoDB Atlas cluster |
| Service discovery | Docker Compose (dev), Kubernetes Services (prod) |
| Distributed tracing | OpenTelemetry + Jaeger or Datadog |

**Conway's Law applies to MERN teams**: if you have two separate squads (Auth team + Product team), microservices make sense. If you're a 3-person team — keep it a monolith.

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| Microservices vs monolith? | Microservices = team/deployment independence at the cost of distributed systems complexity |
| How to draw service boundaries? | Domain-Driven Design bounded contexts — "can this capability change independently?" |
| Distributed transactions? | Saga pattern (choreography or orchestration); NOT 2-phase commit |
| Cascading failures? | Circuit breakers, bulkheads, timeouts; Netflix Hystrix model |
| Database-per-service? | Non-negotiable for true independence; services call APIs/events, not direct DB |
| When not to use? | Startups, small teams, unclear domain, no DevOps — starts as distributed monolith |

**Red flags**:
- "We'll use microservices because Netflix does" — no team/scale justification
- Decomposing by technical layer (API service, DB service)
- Suggesting two-phase commit (2PC) for distributed transactions
- Not knowing Conway's Law: architecture mirrors org structure

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Microservice** | Small, independently deployable service owning a specific business capability |
| **Bounded context** | DDD concept: explicit boundary within which a model is defined and applicable |
| **Database-per-service** | Each microservice owns its own database; others access data only via its API/events |
| **Conway's Law** | Systems designed by organizations will mirror the communication structure of those organizations |
| **Service mesh** | Infrastructure layer handling service-to-service communication (mTLS, retries, tracing) via sidecar proxies |
| **BFF** (Backend for Frontend) | Separate API gateway per client type (web, mobile, TV) |
| **Distributed monolith** | Services that are split in code but tightly coupled in deployment and data — worst of both worlds |
| **Saga pattern** | Sequence of local transactions with compensating transactions on failure (no 2PC) |
| **2PC** (Two-Phase Commit) | Distributed transaction protocol — avoid in microservices (slow, couples services) |
| **DDD** (Domain-Driven Design) | Software design approach focused on business domains and bounded contexts |
| **mTLS** (Mutual TLS) | Bidirectional TLS — each service authenticates the other; used in service meshes |
| **Sidecar** | A proxy container deployed alongside each service pod to handle cross-cutting concerns |
