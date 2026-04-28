# M11 — Cloud Design Patterns: Complete Summary

> **Module**: 11 — Cloud Design Patterns  
> **Topics**: 37 topics across 4 sections  
> **Source**: https://layrs.me/course/hld/cloud-design-patterns  

---

## Quick Navigation

| Section | Topics | Theme |
|---------|--------|-------|
| [1. Messaging Patterns](#1-messaging-patterns) | T01–T11 | Async communication between services |
| [2. Data Management Patterns](#2-data-management-patterns) | T12–T20 | Storage, caching, query optimization |
| [3. Design and Implementation Patterns](#3-design-and-implementation-patterns) | T21–T35 | Architecture, deployment, infrastructure |
| [4. Cloud Infrastructure Patterns](#4-cloud-infrastructure-patterns) | T36–T37 | Containers, serverless runtime models |

---

## 1. Messaging Patterns

**Core theme**: How services communicate reliably without being tightly coupled.

### T01 — Messaging Patterns Overview
- **What**: Survey of asynchronous communication patterns in distributed systems
- **Key insight**: Async decoupling is the foundation of all cloud-native architectures; choose between event-driven, queue-based, and pub-sub based on your coupling and delivery requirements

### T02 — Async Request-Reply
- **What**: Fire-and-forget request with a polling or callback mechanism for eventual response
- **Key insight**: Converts synchronous client expectations (request→response) into async processing without blocking; use correlation IDs to match replies to original requests
- **Example**: Long-running export job — client gets `202 Accepted` with a status URL, polls until complete

### T03 — Claim Check
- **What**: Store large message payload externally (S3/Blob); pass only a reference (claim check token) through the message bus
- **Key insight**: Message brokers have payload limits (SQS: 256KB); offload large data to object storage and pass the pointer. Consumer fetches full payload only when ready to process
- **Example**: Video processing pipeline — upload video to S3, send only S3 key in SQS message

### T04 — Choreography
- **What**: Services react independently to events; no central coordinator
- **Key insight**: Services publish domain events; other services subscribe and react without knowing each other. Scales well but distributed tracing is essential (correlation IDs + OpenTelemetry)
- **vs Orchestration**: Choreography = each service knows what to do; Orchestration = one service tells others
- **Example**: Order placed → Inventory Service, Payment Service, Notification Service all react independently

### T05 — Competing Consumers
- **What**: Multiple consumers pull from the same queue; each message processed by exactly one consumer
- **Key insight**: Horizontal scale-out pattern for message throughput. Add more consumers to increase processing speed. Each consumer competes to claim messages (visibility timeout mechanism)
- **Example**: Image resize service — 10 Lambda functions consuming a single SQS queue of resize jobs

### T06 — Pipes and Filters
- **What**: Process messages through a sequence of independent transformation stages (filters) connected by channels (pipes)
- **Key insight**: Each filter does one thing; filters are unaware of each other. Compose complex processing from simple reusable components. Easy to reorder, add, or remove stages
- **Example**: ETL pipeline — read → validate → transform → enrich → write (each is an independent step)

### T07 — Priority Queue
- **What**: Use multiple queues with different SLA that consumers process in priority order
- **Key insight**: Single queue treats all messages equally. Priority queues ensure urgent work (payment processing) isn't stuck behind batch analytics. Implement via dedicated queues + consumer polling logic
- **Example**: Premium users get faster order processing than free-tier users

### T08 — Publisher-Subscriber (Pub/Sub)
- **What**: Publisher sends events to a topic; multiple subscribers receive independently
- **Key insight**: True one-to-many broadcast. Publisher doesn't know subscribers; subscribers self-register. Unlike queues (competing consumers), ALL subscribers receive every message
- **Example**: Order placed → sends to SNS topic → [Email Service, Inventory Service, Analytics] all receive it

### T09 — Queue-Based Load Leveling
- **What**: Place a queue between producer and consumer to absorb traffic spikes
- **Key insight**: Producers and consumers operate at different rates. Queue buffers excess demand during peaks; consumers process at sustainable rate. Prevents downstream service overload
- **Example**: Black Friday spike of 100K req/min → SQS absorbs burst → downstream service processes at 1K/min continuously

### T10 — Scheduling Agent Supervisor
- **What**: Three-component pattern: Scheduler (dispatches tasks), Agent (executes with retry), Supervisor (monitors and recovers stalled jobs)
- **Key insight**: Distributed task execution is unreliable. Supervisor detects agent failures and reschedules. Ensures tasks never silently drop even when agents crash mid-execution
- **Example**: Distributed batch job system where any worker node can fail

### T11 — Sequential Convoy
- **What**: Process related messages in strict sequence while allowing unrelated messages to proceed concurrently
- **Key insight**: Standard queues don't guarantee ordering. Sequential Convoy ensures all messages for a given entity (e.g., one user's orders) are processed in order, without blocking all other entities
- **Example**: Bank transactions per account must process in sequence; different accounts process concurrently

---

## 2. Data Management Patterns

**Core theme**: How to store, retrieve, partition, and protect data efficiently at scale.

### T12 — Data Management Overview
- **What**: Survey of patterns for managing state in distributed systems
- **Key insight**: No single storage solution fits all access patterns. Choose from relational (ACID), key-value (speed), document (flexibility), wide-column (scale), graph (relationships) based on query patterns, not familiarity

### T13 — Cache-Aside Pattern
- **What**: Application code is responsible for loading data into cache; cache does not auto-populate
- **Key insight**: Cache-aside = lazy loading. On miss: load from DB, write to cache, return data. Cache acts as a performance layer, not a system of record. Handle cache invalidation explicitly on writes
- **Pattern flow**: `Read → cache hit? return | cache miss? → read DB → write to cache → return`
- **Example**: User profile: check Redis → miss → query MongoDB → cache for 15 min

### T14 — CQRS (Read/Write Separation Overview)
- **What**: Separate the model for read operations (queries) from the model for write operations (commands)
- **Key insight**: Write model enforces business rules and emits events; read model is optimized for query patterns (denormalized, pre-aggregated). Enables independent scaling of reads vs. writes
- **Example**: E-commerce — write to normalized DB on order creation; read from denormalized projection for product listing page

### T15 — Event Sourcing
- **What**: Store all changes as an immutable sequence of events rather than current state
- **Key insight**: Current state = replay of all past events. Provides full audit trail, temporal queries, and rebuild of read models. Pairs naturally with CQRS. Risk: event schema evolution is hard
- **Example**: Bank account balance = sum of all credit/debit events (not a single "balance" column)

### T16 — Index Table
- **What**: Create secondary indexes over frequently queried attributes not in the primary key
- **Key insight**: NoSQL (DynamoDB) optimizes for primary key lookups. Secondary indexes trade write amplification (extra storage and write cost) for fast alternative access paths
- **Example**: DynamoDB GSI on `email` for user lookup when primary key is `userId`

### T17 — Materialized View
- **What**: Pre-compute and store query results as a physical table/document; update on data change
- **Key insight**: Complex queries (aggregations, joins) are expensive at read time. Materialized views shift cost to write time. Best when reads are far more frequent than writes
- **Example**: Product listing page = materialized view with product details, price, inventory — updated via event when any source changes

### T18 — Sharding Pattern
- **What**: Partition data horizontally across multiple nodes; each shard holds a subset of the total data
- **Key insight**: Vertical scaling has limits. Shard key choice is critical — bad shard key causes hotspots (all writes to one shard). Cards: range sharding (date ranges), hash sharding (even distribution), directory sharding (lookup table)
- **Example**: User data sharded by region; orders sharded by hash of `customerId`

### T19 — Static Content Hosting
- **What**: Serve static assets (HTML, CSS, JS, images) directly from object storage or CDN, not application servers
- **Key insight**: Application servers are expensive CPU-bound resources; serving static files wastes capacity. S3 + CloudFront offloads 90%+ of web traffic to cheap, globally distributed edge nodes
- **Example**: React SPA — `npm run build` → S3 → CloudFront with edge caching

### T20 — Valet Key
- **What**: Issue clients a temporary, scoped credential (signed URL / SAS token) to access storage directly
- **Key insight**: Routing file uploads/downloads through application servers creates a bottleneck. Valet keys let clients interact with S3/Azure Blob directly; server generates the signed credential but doesn't handle the data transfer
- **Example**: Video upload: POST `/upload` → server returns S3 pre-signed URL → client uploads directly to S3

---

## 3. Design and Implementation Patterns

**Core theme**: How to structure, deploy, and evolve cloud-native application components.

### T21 — Design and Implementation Overview
- **What**: Survey of structural patterns for building maintainable cloud services
- **Key insight**: Architecture patterns solve recurrent structural problems. Selecting the right pattern early avoids costly refactoring; most patterns involve explicit trade-offs between flexibility, simplicity, and operational complexity

### T22 — Ambassador
- **What**: Proxy sidecar that handles cross-cutting concerns (retries, circuit breaking, logging) on behalf of a service
- **Key insight**: Offload operational concerns from application code into a co-deployed proxy. Service talks to local ambassador (localhost), ambassador handles communication complexity. Enables language-agnostic reliability features
- **Example**: Envoy sidecar in Kubernetes handles circuit breaking and retries for Node.js service

### T23 — Anti-Corruption Layer (ACL)
- **What**: Translation layer that isolates your domain model from a legacy or third-party system's model
- **Key insight**: Integrating with legacy systems (or external APIs) pollutes your domain model if done directly. ACL maps between the external model (legacy speak) and your clean domain model. Enables incremental migration
- **Example**: Adapter translating legacy XML inventory API responses into clean TypeScript domain objects

### T24 — Backends for Frontends (BFF)
- **What**: Create a dedicated backend per client type (web BFF, mobile BFF) instead of one generic API
- **Key insight**: Mobile clients need fewer fields, smaller payloads; web needs aggregated data. One shared API makes compromises for everyone. BFF exposes exactly what each client needs — reduces over-fetching and round trips
- **Example**: `/api/mobile/product/:id` returns 3 fields; `/api/web/product/:id` returns 15 fields with related data

### T25 — Compute Resource Consolidation
- **What**: Consolidate multiple small, underutilized tasks into fewer compute units to improve efficiency
- **Key insight**: Many small tasks = high overhead per-task (startup, memory, scheduling). Batch them into fewer larger executions. Opposite impulse from microservices decomposition — apply when tasks are small and frequent
- **Example**: Lambda: process 10 DynamoDB records per invocation instead of one per invocation

### T26 — External Configuration Store
- **What**: Store configuration outside the application/deployment artifact in a centralized service
- **Key insight**: Hard-coded config or .env files don't work across environments and require redeployment on change. External config (AWS Parameter Store, App Config, HashiCorp Vault) enables runtime changes, secret rotation, and environment-specific values without code changes
- **Example**: Feature flags and DB connection strings in AWS Parameter Store, read at startup

### T27 — Gateway Aggregation
- **What**: API Gateway calls multiple backend services and aggregates their responses into one client response
- **Key insight**: Mobile/web clients shouldn't make N calls for a single screen. Gateway does fan-out (N calls in parallel) + merge results. Reduces client-round-trips and simplifies client code
- **Example**: Product page gateway call → aggregates product + inventory + pricing + reviews into one response

### T28 — Gateway Offloading
- **What**: Offload cross-cutting concerns (auth, SSL termination, rate limiting, logging, compression) to the gateway
- **Key insight**: Every service implementing auth/rate-limiting independently = code duplication and inconsistency. Central gateway handles it once. Services receive clean, verified requests
- **Example**: Kong/AWS API Gateway handles JWT verification, rate limiting, and request logging before request reaches Node.js services

### T29 — Gateway Routing
- **What**: Gateway routes requests to different backend services based on path, headers, or content
- **Key insight**: Single entry point for clients; backend services evolve independently. Enables blue-green deployments, A/B testing, and gradual migrations at the routing layer without client changes
- **Example**: `/v1/*` → legacy service, `/v2/*` → new service; 10% traffic canary via weighted routing

### T30 — Leader Election
- **What**: Distributed coordination mechanism to elect one node as leader for tasks requiring single execution
- **Key insight**: Multiple instances of a service cause duplicate execution of tasks meant to run once (cron jobs, cleanup). Leader election ensures exactly one instance acts as leader. Implement via distributed lock (Redis, ZooKeeper, etcd)
- **Example**: Only the elected leader runs the daily billing job; others stand by

### T31 — Pipes and Filters Implementation
- **What**: Implementation patterns for building Pipes and Filters with code examples
- **Key insight**: Implementation concerns: async vs sync pipelines, error handling per filter, observability (trace each stage), backpressure when a filter is slow. Node.js streams are a natural fit

### T32 — Sidecar
- **What**: Co-deploy a helper container alongside your primary service container in the same pod
- **Key insight**: Concerns like service mesh, log shipping, secret rotation, and TLS are infrastructure—not application concerns. Sidecar containers handle these without modifying app code. Kubernetes native with multi-container pods
- **Example**: App container + Envoy sidecar (service mesh) + Fluentd sidecar (log shipping) in same Pod

### T33 — Static Content Hosting Implementation
- **What**: Implementation guide for deploying SPAs and static sites to S3 + CloudFront with CI/CD
- **Key insight**: Implementation details: S3 bucket policy (block public, use OAC), CloudFront distributions, custom domain via Route 53, cache invalidation on deploy, security headers (CSP, HSTS) via Lambda@Edge

### T34 — Strangler Fig
- **What**: Incrementally migrate from a legacy monolith to microservices by intercepting and redirecting traffic
- **Key insight**: Named after the Strangler Fig tree that grows around a host tree. Route traffic through a façade; redirect migrated features to new services while legacy handles the rest. Migration completed when legacy handles zero traffic
- **Steps**: 1. Create façade/proxy 2. Migrate one feature 3. Route that feature's traffic 4. Repeat until done
- **Example**: NGINX proxy routes `/users/*` to new Node.js service while all other paths hit the Rails monolith

### T35 — CQRS Implementation
- **What**: Implementation guide for Command Query Responsibility Segregation with event sourcing
- **Key insight**: Commands mutate state, emit events; queries read from optimized projections (denormalized views). Read model can lag behind write model (eventual consistency) — must communicate this to users. MongoDB for documents, Redis for hot data, Elasticsearch for search

---

## 4. Cloud Infrastructure Patterns

**Core theme**: Runtime models for deploying and running services in the cloud.

### T36 — Containerization and Orchestration
- **What**: Package applications in containers (Docker); orchestrate with Kubernetes for scaling, healing, and deployment
- **Key insight**: Containers solve "works on my machine"; Kubernetes solves "who should run this container and what happens when it dies?" Key K8s concepts: Pods, Deployments, Services, Ingress, HPA (horizontal pod autoscaler)
- **MERN context**: Dockerize each service (MongoDB, Node.js API, React) with multi-stage builds; deploy to EKS/GKE with resource limits and liveness/readiness probes
- **Example**: Node.js API — `RollingUpdate` strategy, HPA based on CPU → 3 to 20 replicas automatically

### T37 — Serverless Architecture
- **What**: Write functions that execute on-demand, pay per invocation; provider handles all infrastructure
- **Key insight**: FaaS (Lambda) + BaaS (DynamoDB, S3, Cognito). Stateless execution; cold starts (100ms–3s, mitigate with provisioned concurrency or faster runtimes). Break-even vs. EC2 at ~16M req/month. Scales to 0 (no idle cost) but max 15 min execution
- **MERN context**: Lambda as Express-compatible handler, MongoDB Atlas connection reuse across warm invocations, SQS for async decoupling (avoid Lambda→Lambda chains)
- **Example**: Nordstrom auto-scales 10K→500K req/min on Black Friday without pre-provisioning

---

## Pattern Selection Guide

### When to Use Which Messaging Pattern

| Scenario | Pattern |
|----------|---------|
| Long-running API response (> 5s) | Async Request-Reply (T02) |
| Large message payloads (> 256KB) | Claim Check (T03) |
| Services need to react autonomously | Choreography (T04) |
| Parallel processing of same queue | Competing Consumers (T05) |
| Multi-step ETL transformation | Pipes and Filters (T06/T31) |
| Different SLA for different users | Priority Queue (T07) |
| Broadcast to multiple subscribers | Publisher-Subscriber (T08) |
| Absorb traffic spikes | Queue-Based Load Leveling (T09) |
| Distributed tasks with failure recovery | Scheduling Agent Supervisor (T10) |
| Ordered processing per entity | Sequential Convoy (T11) |

### When to Use Which Data Pattern

| Scenario | Pattern |
|----------|---------|
| Slow queries on frequently read data | Cache-Aside (T13) |
| High read:write ratio, different models | CQRS (T14/T35) |
| Full audit trail required | Event Sourcing (T15) |
| Unindexed query in NoSQL | Index Table (T16) |
| Expensive aggregation at read time | Materialized View (T17) |
| Dataset too large for one node | Sharding (T18) |
| HTML/CSS/JS/images serving | Static Content Hosting (T19/T33) |
| File uploads without bottlenecking | Valet Key (T20) |

### When to Use Which Infrastructure Pattern

| Scenario | Pattern |
|----------|---------|
| Multi-language service reliability | Ambassador (T22) |
| Integrating with legacy/external API | Anti-Corruption Layer (T23) |
| Web vs. mobile need different APIs | BFF (T24) |
| Many small tasks, high overhead | Compute Resource Consolidation (T25) |
| Config changes without redeployment | External Config Store (T26) |
| Multiple backend calls for one page | Gateway Aggregation (T27) |
| Cross-cutting concerns (auth, rate limit) | Gateway Offloading (T28) |
| Route to different backend versions | Gateway Routing (T29) |
| Singleton task in multi-instance service | Leader Election (T30) |
| Infrastructure concerns without code change | Sidecar (T32) |
| Migrating monolith incrementally | Strangler Fig (T34) |
| Variable traffic, event-driven workloads | Serverless (T37) |
| Sustained traffic, resource control | Containerization (T36) |

---

## Key Architecture Rules (Exam / Interview Quick Reference)

1. **Queues decouple; topics broadcast** — SQS = competing consumers (one receiver), SNS = pub-sub (all receivers)
2. **CQRS + Event Sourcing are separate patterns** — use them independently; CQRS doesn't require ES; ES makes CQRS natural
3. **Sidecar vs. Ambassador** — Sidecar is any helper container co-deployed; Ambassador specifically is an outbound proxy sidecar
4. **BFF reduces over-fetching** — API Gateway Aggregation reduces round trips; both solve client complexity but at different layers
5. **Cache-Aside requires explicit invalidation** — no magic; stale reads possible during TTL window
6. **Strangler Fig requires a façade** — can't intercept traffic without an entry point that routes to old and new
7. **Serverless cold starts are inherent** — provisioned concurrency eliminates them but adds cost
8. **Sharding shard key is irreversible** — wrong choice causes hotspots; test distribution before production
9. **Leader election is not a load balancer** — exactly one leader, not load-distributed
10. **Claim Check solves broker payload limits, not security** — for security use pre-signed URLs (Valet Key)
