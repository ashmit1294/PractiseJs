# Techno-Managerial Round — Complete Q&A Preparation Guide

> **Format:** 60% Technical + 40% Managerial | Covers System Design, APIs, Frontend, Databases, Cloud/DevOps, Security, Behavioral, Scenarios, Java/Spring Boot, and STAR Stories.

---

## Table of Contents
1. [System Design](#1-system-design)
2. [API & Backend](#2-api--backend)
3. [Frontend — React / Next.js](#3-frontend--react--nextjs)
4. [Databases](#4-databases)
5. [Cloud & DevOps](#5-cloud--devops)
6. [Security](#6-security)
7. [Managerial & Behavioral](#7-managerial--behavioral)
8. [Scenario-Based Questions](#8-scenario-based-questions)
9. [Java & Spring Boot Basics](#9-java--spring-boot-basics)
10. [STAR Stories Framework](#10-star-stories-framework)

---

## 1. System Design

### Core JD Questions

---

**Q1. Design a multi-tenant SaaS platform with REST APIs and microservices.**

**A:** Start by clarifying requirements — number of tenants, isolation level, data residency needs.

**Architecture:**
- **Tenant isolation strategies:**
  - *Silo* — separate DB per tenant (highest isolation, expensive)
  - *Pool* — shared DB with `tenant_id` column (cost-effective, most common)
  - *Bridge* — separate schema per tenant in shared DB instance
- **Auth layer:** OAuth2 / OIDC with tenant context in JWT (`tenant_id` claim). Use an IDP like Auth0, Keycloak, or Azure AD B2C.
- **API Gateway:** Single entry point — routes by subdomain (`acme.app.com`) or header (`X-Tenant-ID`). Handles rate limiting per tenant, auth token validation.
- **Microservices:** Each service reads `tenant_id` from request context and scopes all DB queries to that tenant.
- **Row-level security (RLS):** In PostgreSQL, enforce at DB layer so even a miscoded service can't leak cross-tenant data.
- **Config service:** Per-tenant feature flags, plan limits, and branding stored in a fast store (Redis or DynamoDB).
- **Observability:** Structured logs always include `tenant_id`; alerts can fire per-tenant SLA breach.

**Bottlenecks & scaling:**
- Noisy neighbour — enforce per-tenant rate limits at gateway + DB connection pool limits
- Schema migrations — use flyway/liquibase with feature flags so migration is backward-compatible
- Hot tenant scaling — consider dedicated pods/DB for enterprise tenants

---

**Q2. How would you architect a workflow engine with third-party integrations?**

**A:**

**Core components:**
- **Workflow definition store:** BPMN/JSON DSL stored in DB. Each workflow is a DAG of steps.
- **Execution engine:** State machine — each step has `pending → running → success/failure → retry` states. Persist state after each transition (idempotent).
- **Trigger service:** Handles cron triggers, webhook triggers, and event-bus triggers (SQS/EventBridge).
- **Worker pool:** Task runners pull from a job queue (SQS/RabbitMQ). Workers are stateless and horizontally scalable.
- **Integration adapters:** Each third-party (Salesforce, SAP, Stripe) gets its own adapter implementing a `execute(context) → result` interface. Adapters handle auth, retry logic, and circuit breaking.
- **Retry & DLQ:** Exponential backoff with jitter. Failed steps after N retries go to a DLQ for manual inspection.
- **Compensation logic (Saga):** For multi-step workflows that touch external systems, define compensating actions for rollback.

**Key design decisions:**
- Make every step idempotent — use idempotency keys on external API calls
- Store integration credentials in Secrets Manager, never in workflow config
- Emit step-level events for audit trail and observability

---

**Q3. Design a CI/CD pipeline for a Node.js + React app on AWS/Azure.**

**A:**

```
Code Push (GitHub/Azure Repos)
  → Trigger CI (GitHub Actions / Azure DevOps Pipeline)
      → Install deps (npm ci)
      → Lint + Unit Tests (Jest, ESLint)
      → Build (tsc, webpack/vite)
      → Security scan (Snyk, OWASP Dependency Check)
      → Docker build + tag (git SHA)
      → Push to ECR / ACR
  → CD (on main branch merge)
      → Deploy to Staging (Helm upgrade / kubectl apply)
      → Run smoke tests / E2E (Playwright)
      → Manual approval gate (for prod)
      → Blue/Green or Rolling deploy to Prod
      → Post-deploy health check
      → Notify Slack / Teams
```

**Key practices:**
- Separate pipelines per service in a monorepo (path-based triggers)
- Immutable image tags — never use `:latest` in prod
- Environment-specific config injected at deploy time via Secrets Manager / Key Vault, not baked into image
- Rollback = `helm rollback` or re-deploy previous tagged image

---

**Q4. How do you handle IDP integration (OAuth2, SAML, SSO)?**

**A:**

**OAuth2/OIDC flow (most common for modern apps):**
1. App redirects user to IDP (Azure AD, Okta, Auth0) with `client_id`, `redirect_uri`, `scope=openid profile email`
2. User authenticates at IDP
3. IDP redirects back with `authorization_code`
4. App backend exchanges code for `access_token` + `id_token` (PKCE for SPAs)
5. App validates JWT signature using IDP's JWKS endpoint
6. `access_token` sent in `Authorization: Bearer` header on all subsequent API calls

**SAML (older enterprise systems):**
- IDP sends signed XML assertion to your Service Provider (SP)
- SP validates signature against IDP metadata, extracts user attributes
- Use libraries like `passport-saml` (Node.js) or `spring-security-saml`

**SSO across microservices:**
- Token validation at API Gateway — downstream services trust the gateway
- Or use a token exchange pattern (OAuth2 token exchange RFC 8693) for service-to-service auth

**Key security points:**
- Always validate `iss`, `aud`, `exp` claims in JWT
- Never decode JWT without signature verification
- Use short-lived access tokens (15–60 min) + refresh token rotation

---

### 20 Additional System Design Questions

---

**Q5. What is the difference between horizontal and vertical scaling? When do you choose each?**

**A:** Vertical scaling (scale-up) adds more CPU/RAM to an existing server — simple but has a ceiling and single point of failure. Horizontal scaling (scale-out) adds more instances — requires stateless services, a load balancer, and distributed session management, but no ceiling and higher availability. Choose vertical for single-server databases that are hard to shard early on; choose horizontal for stateless API servers and read replicas.

---

**Q6. Explain the CAP theorem with a real-world example.**

**A:** A distributed system can guarantee at most two of: Consistency (all nodes see the same data at the same time), Availability (every request receives a response), and Partition Tolerance (the system works despite network splits). Partition tolerance is non-negotiable in real distributed systems, so the real trade-off is CP vs AP. Example — DynamoDB in AP mode returns stale data during a partition but remains available. PostgreSQL (single master) is CP — a network split can make replicas refuse reads to avoid returning stale data.

---

**Q7. What is an event-driven architecture and when is it appropriate?**

**A:** Services communicate by publishing and consuming events (Kafka, SNS/SQS, EventBridge) rather than direct API calls. Appropriate when: you need loose coupling between services; processing can be asynchronous; you need an audit trail of state changes (event sourcing); or fan-out (one event triggers many consumers) is needed. Not ideal for synchronous request-response flows where the caller needs an immediate result.

---

**Q8. Explain CQRS and when you'd apply it.**

**A:** Command Query Responsibility Segregation splits the write model (commands that change state) from the read model (queries). Write side persists to a normalized DB and emits events; read side materializes denormalized views optimised for queries. Useful when read and write loads are very different, or when read views require complex aggregations. Adds operational complexity — only justified at scale or when read/write models genuinely diverge.

---

**Q9. How would you design a rate-limiting system for a public API?**

**A:** Use a token bucket or sliding-window algorithm. Store counters in Redis (fast, atomic INCR + TTL). At the API Gateway layer, check `rate_limit:{api_key}:{window}` key per request. Return `429 Too Many Requests` with `Retry-After` header when limit exceeded. For distributed gateways, use Redis cluster or a central rate-limit service. Tiers: different limits per plan (free/pro/enterprise) stored in a config service.

---

**Q10. What is a circuit breaker pattern and why is it important in microservices?**

**A:** When a downstream service is failing, the circuit breaker trips (opens) after N consecutive failures, and subsequent calls fail fast without hitting the failing service. After a timeout, it goes to half-open state — tries one request; if it succeeds, it closes; if it fails, it re-opens. Libraries: Resilience4j (Java), `opossum` (Node.js), or Istio service mesh handles it transparently. Important because without it, a single slow service causes thread/connection pool exhaustion upstream, cascading the failure.

---

**Q11. How would you design a notification system that needs to deliver emails, SMS, and push notifications?**

**A:** 
- **Producer:** Services publish notification events to a queue/topic (SQS/Kafka) with payload `{type, recipient, templateId, data}`
- **Notification service:** Consumes events, resolves user preferences (does user prefer email or push?), and routes to channel-specific senders
- **Channel adapters:** Email (SES/SendGrid), SMS (Twilio/SNS), Push (FCM/APNs) — each is a separate adapter
- **Template engine:** Templates stored in DB; rendered server-side — never trust user-supplied template strings
- **Deduplication:** Idempotency key per notification to avoid double-sends on retry
- **Delivery tracking:** Store delivery status per channel; retry failed sends with exponential backoff

---

**Q12. Explain the Saga pattern for distributed transactions.**

**A:** In microservices, you can't use a 2-phase commit across services. The Saga pattern breaks the transaction into a sequence of local transactions, each publishing an event triggering the next step. Two variants:
- **Choreography:** Each service listens to events and decides what to do — decentralised but hard to trace
- **Orchestration:** A central saga orchestrator tells each service what to do — easier to reason about, single source of truth
Failed steps trigger compensating transactions (e.g., cancel a reservation if payment fails). Suitable for long-running business processes like order fulfilment.

---

**Q13. How do you design for zero-downtime deployments?**

**A:**
- **Blue/Green:** Two identical environments; switch traffic to green after validation; blue is instant rollback
- **Rolling update:** Replace instances one at a time — no extra infra cost but brief mixed-version state
- **Canary:** Route 5% of traffic to new version; monitor error rate; expand or rollback
- **Feature flags:** Deploy code dark, enable per user/tenant via config — decouple deploy from release
- DB migrations must be backward-compatible: add columns before removing old ones, use expand-contract pattern

---

**Q14. What is an API Gateway and what responsibilities should it own?**

**A:** A single entry point for all client requests to backend services. Responsibilities: auth token validation, rate limiting, request routing, SSL termination, request/response transformation, logging, and tracing. Should NOT contain business logic. Examples: AWS API Gateway, Kong, NGINX, Azure API Management. The gateway decouples clients from service topology changes.

---

**Q15. How would you handle database schema migrations in a CD pipeline with zero downtime?**

**A:** Use the expand-contract pattern:
1. **Expand phase:** Add new columns/tables (backward-compatible). Deploy new app version that writes to both old and new columns.
2. **Migrate phase:** Backfill data in batches (avoid long-lock migrations).
3. **Contract phase:** Remove old columns after all services have been updated.
Use Flyway or Liquibase to version migrations. Never run destructive migrations without a tested rollback script. Run migrations as a pre-deploy step in the pipeline, validated on staging first.

---

**Q16. Explain eventual consistency and how you handle it in practice.**

**A:** In distributed systems, after a write, replicas may take time to converge — reads during this window may return stale data. Handling strategies:
- **Read-your-writes:** Route the same user's reads to the primary for a short window after a write
- **Versioning/ETags:** Client sends the version it last saw; server rejects stale updates
- **UI optimistic updates:** Show the user their change immediately, correct if the server responds with a conflict
- **Conflict resolution:** Last-write-wins (LWW), CRDT, or application-level merge logic
Document to stakeholders which flows are eventually consistent and what the acceptable staleness window is.

---

**Q17. How would you design a search feature for a large dataset?**

**A:** For simple prefix/full-text search on small datasets, PostgreSQL full-text search (tsvector/tsquery) suffices. At scale, use Elasticsearch or OpenSearch — index documents, use inverted indexes for fast full-text search, support faceting/filtering. Design considerations:
- Sync data to search index via CDC (Change Data Capture) from the primary DB using Debezium/DynamoDB Streams
- Keep search index eventually consistent — don't write to it synchronously in the request path
- Support pagination with `search_after` (not offset-based) for deep pagination on large result sets

---

**Q18. What is service mesh and when would you introduce one?**

**A:** A service mesh (Istio, Linkerd) injects a sidecar proxy (Envoy) alongside each service pod. The mesh handles: mutual TLS (mTLS) for service-to-service auth, observability (distributed tracing, metrics) without code changes, traffic management (canary, retries, circuit breaking), and policy enforcement. Introduce it when you have 10+ microservices and cross-cutting concerns (security, observability) are becoming repetitive boilerplate in each service. Adds operational overhead — evaluate against simpler alternatives like a shared SDK first.

---

**Q19. How do you design a system for high availability (HA)?**

**A:** HA = eliminating single points of failure + fast recovery.
- **Multi-AZ deployment:** DB replicas, app servers across availability zones
- **Health checks + auto-restart:** Kubernetes liveness/readiness probes, ASG health checks
- **Load balancer:** Distributes traffic, removes unhealthy instances
- **Database HA:** RDS Multi-AZ, Postgres streaming replication, MongoDB replica sets
- **Graceful degradation:** Feature flags to disable non-critical features under load
- **Chaos engineering:** Regularly test failure scenarios (Netflix Chaos Monkey approach)
- **RTO/RPO objectives:** Define acceptable recovery time and data loss to drive architecture decisions

---

**Q20. Explain the Strangler Fig pattern for monolith decomposition.**

**A:** Rather than rewriting the monolith big-bang style (high risk), you incrementally replace functionality. Steps:
1. Put a router/facade in front of the monolith (e.g., an API Gateway or reverse proxy)
2. Identify a bounded context to extract (e.g., user auth, billing)
3. Build the new microservice alongside the monolith
4. Route traffic for that context to the new service
5. Delete the corresponding monolith code
6. Repeat for the next context
The monolith "strangles" over time. You never have a big-bang cutover and can roll back individual services independently.

---

**Q21. How would you handle inter-service communication — sync vs async?**

**A:**
- **Synchronous (REST/gRPC):** Use when the caller needs an immediate response (e.g., auth check, payment validation). Tightly couples availability — if the downstream service is down, the call fails.
- **Asynchronous (queues/events):** Use when the caller doesn't need an immediate result (e.g., send email, generate report, notify downstream systems). Decouples availability — messages queue up if consumer is slow/down.
- **Rule of thumb:** Default async for cross-domain calls; use sync only within a bounded context or when the business logic requires immediate feedback.

---

**Q22. What is the difference between an orchestrator and a choreographer in microservices?**

**A:** 
- **Orchestrator:** A central service (e.g., order service) explicitly calls each downstream service in sequence. Easy to trace, single point of control, but creates coupling to the orchestrator.
- **Choreographer:** Each service reacts to events from others — no central coordinator. Loose coupling, more resilient, but harder to trace the overall business flow end-to-end; requires good observability tooling.
Choreography suits event-driven systems with clear domain events. Orchestration suits complex multi-step processes where the flow logic needs to be visible and manageable in one place.

---

**Q23. How do you handle configuration management across environments (dev/staging/prod)?**

**A:**
- Store config in environment variables (12-factor app principle) — never hardcode
- Sensitive values (DB passwords, API keys) in Secrets Manager / Key Vault — injected at runtime, never in code or env files checked into git
- Non-sensitive config (feature flags, timeouts) in a config service (AWS Parameter Store, Azure App Config) — hot-reload without redeploy where possible
- Enforce config schema validation on startup — fail fast if required config is missing
- Use `.env.example` (with no real values) checked into git as documentation

---

**Q24. Explain load balancing strategies — round robin, least connections, IP hash.**

**A:**
- **Round robin:** Requests distributed sequentially across servers. Simple, works well when servers are homogeneous and requests take similar time.
- **Least connections:** New request goes to the server with the fewest active connections. Better for long-lived or variable-length requests.
- **IP hash:** Client IP is hashed to always route to the same server — provides session affinity (sticky sessions) without server-side session storage. Downside: uneven distribution if many users share IP (NAT).
- **Weighted:** Assign weights to servers — useful when servers have different capacities (e.g., during a rolling upgrade with mixed old/new instances).

---

**Q25. What strategies do you use for logging and observability in a distributed system?**

**A:** Three pillars:
- **Logs:** Structured JSON logs with `trace_id`, `span_id`, `tenant_id`, `user_id`, `service_name`. Centralised in ELK stack, CloudWatch Logs, or Azure Monitor. Use log levels (ERROR/WARN/INFO/DEBUG) — never log sensitive data.
- **Metrics:** RED (Rate, Errors, Duration) per endpoint. Prometheus + Grafana or CloudWatch Metrics. Alertmanager for PagerDuty/Slack alerts on SLO breaches.
- **Traces:** Distributed tracing with OpenTelemetry → Jaeger/Zipkin/X-Ray. Propagate `traceparent` header across all service calls to reconstruct end-to-end request journey.
Always correlate logs and traces via the same `trace_id`.


---

## 2. API & Backend

### Core JD Questions

---

**Q1. REST vs GraphQL vs SOAP — when to use which?**

**A:**

| | REST | GraphQL | SOAP |
|---|---|---|---|
| **Transport** | HTTP | HTTP | HTTP/SMTP/etc |
| **Format** | JSON/XML | JSON | XML |
| **Contract** | OpenAPI/Swagger | Schema (SDL) | WSDL |
| **Flexibility** | Fixed endpoints | Single endpoint, client-defined queries | Fixed contract |
| **Best for** | Public APIs, CRUD, microservices | Mobile/complex UIs needing varied data shapes | Enterprise legacy, banking, B2B integrations |
| **Caching** | HTTP cache headers work natively | Complex — requires persisted queries | Mostly no |

- Choose **REST** when your API is public, consumed by many clients, and resources map cleanly to CRUD operations.
- Choose **GraphQL** when clients (mobile apps, dashboards) need different data shapes, and over-fetching/under-fetching is a pain.
- Choose **SOAP** when integrating with existing enterprise systems (SAP, banking) that mandate it, or when you need formal WS-Security and ACID-like guarantees.

---

**Q2. How do you secure APIs?**

**A:** Defence in depth — multiple layers:
- **Authentication:** OAuth2/OIDC with JWT. Validate token signature, `iss`, `aud`, `exp` on every request. Never trust unsigned tokens.
- **Authorization:** RBAC or ABAC enforced server-side — never rely on the client to restrict access. Check resource ownership (`user_id` matches).
- **Rate limiting:** Per API key/IP at the gateway level. Return `429` with `Retry-After` header.
- **Input validation:** Validate and sanitise all inputs — reject unexpected fields (strict schema validation). Use libraries like Joi, Zod, express-validator.
- **API Gateway:** Single entry point — centralises auth, rate limiting, logging, SSL termination.
- **Transport security:** HTTPS everywhere, HSTS headers, TLS 1.2+ only.
- **Secrets:** API keys/tokens never in URLs (logs capture URLs) — always in `Authorization` header.
- **CORS:** Restrict `Access-Control-Allow-Origin` to known client origins.

---

**Q3. Node.js event loop internals and how you handle CPU-bound tasks.**

**A:** Node.js is single-threaded. The event loop processes callbacks from multiple queues in order:

```
1. Timers phase        → setTimeout / setInterval callbacks
2. Pending I/O         → I/O callbacks deferred to next iteration
3. Idle/prepare        → Internal use
4. Poll                → Retrieve new I/O events; blocks here if queue empty
5. Check               → setImmediate callbacks
6. Close callbacks     → e.g., socket.on('close')
```

Between each phase: `process.nextTick` and Promise microtasks run (they can starve the loop if overused).

**CPU-bound tasks BLOCK the event loop.** Solutions:
- **Worker threads** (`worker_threads` module): Run CPU-heavy code (e.g., image processing, crypto, ML inference) in a separate thread; communicate via `postMessage`.
- **Child processes** (`child_process.fork`): Spin up a new Node.js process; suitable for one-off CPU-heavy jobs.
- **Offload to a queue:** Push the work to a background job queue (BullMQ + Redis); a separate worker process handles it asynchronously.
- **Native addons (N-API):** For extreme performance, write the CPU-heavy path in C++.

---

**Q4. Microservices vs monolith trade-offs.**

**A:**

| | Monolith | Microservices |
|---|---|---|
| **Deployment** | Single unit — simple | Per-service — complex orchestration |
| **Dev velocity (small team)** | Fast — no network calls, shared code | Slow initially — infra overhead |
| **Scaling** | Scale whole app | Scale only the bottleneck service |
| **Fault isolation** | One bug can crash everything | Failures contained per service |
| **Data** | Simple — shared DB | Complex — each service owns its data |
| **Technology** | Forced single stack | Polyglot possible |
| **When to choose** | Early stage, small team, unclear domain boundaries | Clear bounded contexts, large teams, scale requirement |

Real-world answer: "We started with a modular monolith. When the notification and billing modules had completely different scaling needs and separate team ownership, we extracted them as microservices using the Strangler Fig pattern."

---

### 20 Additional API & Backend Questions

---

**Q5. What is idempotency and why does it matter in API design?**

**A:** An operation is idempotent if making the same request multiple times produces the same result. GET, PUT, DELETE are idempotent by definition. POST is not. For non-idempotent operations (payment, order creation), use an `Idempotency-Key` header — server stores the result keyed to that ID and returns the cached response on duplicate calls. Critical for reliability: clients can safely retry on network failure without causing double-charges or duplicate records.

---

**Q6. How do you version APIs without breaking existing clients?**

**A:** Options:
- **URL versioning** (`/api/v1/`, `/api/v2/`) — most common, explicit, easy to route
- **Header versioning** (`Accept: application/vnd.app.v2+json`) — cleaner URLs but less discoverable
- **Query param** (`?version=2`) — simple but pollutes query strings

Best practices: Never break existing `v1` contracts — add, never remove fields (deprecate with warnings first). Maintain old versions for a documented sunset period. Use API Gateway routing to direct traffic to the right service version.

---

**Q7. Explain JWT structure and its vulnerabilities.**

**A:** JWT = `base64url(header).base64url(payload).signature`. Header declares algorithm (`alg`); payload contains claims (`sub`, `iss`, `aud`, `exp`, custom). Signature ensures integrity.

**Vulnerabilities:**
- `alg: none` attack — strip signature; always enforce algorithm server-side, never trust the header's `alg` claim
- Weak secret — brute-forceable `HS256` with a short key; use long random secrets or `RS256`/`ES256` asymmetric keys
- Missing claim validation — always check `exp`, `iss`, `aud`
- Sensitive data in payload — JWT is base64 *encoded* not encrypted; anyone can decode it — never put passwords or PII in JWT (use JWE if confidentiality is needed)

---

**Q8. What is the difference between authentication and authorisation?**

**A:** Authentication (AuthN) — verifying identity ("Who are you?") — handled by OAuth2/OIDC, password check, MFA. Authorisation (AuthZ) — verifying permissions ("Are you allowed to do this?") — handled by RBAC, ABAC, permission checks in your code. Common mistake: checking authentication but skipping authorisation — a logged-in user must not be able to access another user's data just because they're authenticated. Always authorise at the resource level.

---

**Q9. How would you implement pagination in a REST API?**

**A:** Three approaches:
- **Offset pagination** (`?page=2&limit=20`) — simple but inconsistent when data changes; expensive for deep pages (`OFFSET 10000` scans 10k rows)
- **Cursor pagination** (`?after=cursor_value`) — based on a stable, indexed column (timestamp, ID). Fast for any page depth. No duplicates or skips if data changes. Use this for infinite scroll / feeds.
- **Keyset pagination** — similar to cursor; use `WHERE id > last_seen_id ORDER BY id LIMIT 20` — efficient with an index.

Return `totalCount` + `nextCursor` / `hasNextPage` in the response so the client knows whether to fetch more.

---

**Q10. What is gRPC and when would you use it over REST?**

**A:** gRPC is a high-performance RPC framework using HTTP/2 and Protobuf (binary serialisation). Advantages: strongly typed contracts (`.proto` files), 5–10x faster than JSON/REST for internal service calls, built-in streaming (client, server, bidirectional), code generation for multiple languages. Use for internal microservice communication where performance matters, or when you need streaming (e.g., real-time telemetry). Not ideal for public APIs (browser support limited, harder to debug without tooling).

---

**Q11. How do you handle long-running operations in a REST API?**

**A:** Don't block the HTTP connection. Pattern:
1. Client POSTs request; server accepts it and returns `202 Accepted` with a `job_id` in the response.
2. Server processes the job asynchronously (queue + worker).
3. Client polls `GET /jobs/{job_id}` for status (`pending/running/complete/failed`) — or use WebSocket/SSE to push completion notification.
4. On completion, response includes result or a link to fetch the result.
This prevents gateway timeouts, allows clients to retry status checks safely, and keeps the API responsive.

---

**Q12. Explain CORS and how to configure it correctly.**

**A:** CORS (Cross-Origin Resource Sharing) is a browser security mechanism. When a frontend at `app.com` calls `api.com`, the browser first sends a preflight `OPTIONS` request. Your API must respond with:
- `Access-Control-Allow-Origin: https://app.com` (not `*` for credentialled requests)
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE`
- `Access-Control-Allow-Headers: Content-Type, Authorization`
- `Access-Control-Allow-Credentials: true` (if cookies/auth headers are sent)

Common mistake: setting `*` with credentials — browsers reject this. In production always whitelist specific origins; use an environment variable to define the allowed origins list.

---

**Q13. What is an API Gateway vs a reverse proxy vs a service mesh?**

**A:**
- **Reverse proxy** (NGINX): Forwards client requests to backend servers. Handles SSL termination, load balancing, static file serving. No application-layer intelligence.
- **API Gateway** (Kong, AWS API Gateway): Adds API-specific features — auth, rate limiting, request transformation, API versioning, analytics. Sits at the edge for external clients.
- **Service mesh** (Istio, Linkerd): Handles service-to-service communication *inside* the cluster — mTLS, observability, traffic management via sidecar proxies. No edge-facing role.
In practice, you use all three: reverse proxy at the CDN edge, API Gateway for external API management, service mesh for internal service reliability.

---

**Q14. How do you implement health checks in a Node.js API?**

**A:**
```javascript
// Basic health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Deep health check — includes dependency status
app.get('/health/ready', async (req, res) => {
  const dbOk = await checkDbConnection();
  const redisOk = await checkRedisConnection();
  const status = dbOk && redisOk ? 200 : 503;
  res.status(status).json({ db: dbOk, redis: redisOk });
});
```
Kubernetes uses `/health` for liveness (is the process alive?) and `/health/ready` for readiness (is it ready to serve traffic?). Never fail liveness on dependency issues — only readiness. Failing liveness triggers a pod restart; failing readiness just removes it from load balancer rotation.

---

**Q15. What is the difference between synchronous and asynchronous error handling in Node.js?**

**A:**
- **Sync** — use try/catch: any thrown error is caught
- **Async (Promise/async-await)** — unhandled promise rejections crash the process in Node 15+; always `await` in a `try/catch` or attach `.catch()` to promise chains
- **Express** — async route handlers need a wrapper or express 5.x (which auto-catches Promise rejections); in express 4.x use: `const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`
- **Global fallback:** `process.on('unhandledRejection', ...)` for logging before graceful shutdown — not for recovery
- **Operational vs programmer errors:** Operational errors (DB connection failed) → handle gracefully. Programmer errors (null reference) → crash and restart (let process manager / Kubernetes restart the pod).

---

**Q16. How would you design a webhook system?**

**A:**
- When an event occurs, publish it to a queue (SQS, BullMQ).
- A webhook delivery service dequeues events and POSTs to the customer's registered endpoint with a signed payload (HMAC-SHA256 signature in header so receiver can verify authenticity).
- Retry with exponential backoff on non-2xx responses (up to N attempts).
- After max retries, mark the webhook as failed and alert the customer.
- Customer-facing UI to view delivery history and manually retry.
- Security: sign every payload; document the signature verification process; protect against SSRF (validate that the webhook URL is not an internal IP).

---

**Q17. How do you prevent API abuse and DDoS at the application layer?**

**A:** Rate limiting per IP and per API key at the gateway. Bot detection (Cloudflare, AWS WAF rules). Request body size limits. Complexity limiting for GraphQL queries (max query depth/cost). Account-level throttling in addition to IP-based limits (since IPs rotate). Geographic blocking if your service has no users in certain regions. All of these complement but don't replace network-level DDoS protection (AWS Shield, Azure DDoS Protection).

---

**Q18. What is OpenAPI specification and why is it important?**

**A:** OpenAPI (formerly Swagger) is a machine-readable API description format (YAML/JSON). Benefits: auto-generate interactive documentation (Swagger UI, Redoc), generate client SDKs in multiple languages, generate server stubs, validate requests against the schema in a middleware, use contract testing to catch breaking changes before deployment. Treat the OpenAPI spec as a first-class artifact — review it in PRs the same way you review code. Tools: `openapi-generator`, `swagger-codegen`, `zod-to-openapi` for TypeScript.

---

**Q19. Explain connection pooling and why it matters for database-backed APIs.**

**A:** Opening a new DB connection per request is expensive (TCP handshake, auth, memory allocation). A connection pool maintains a set of reusable connections. When a request arrives, it borrows a connection; when done, it returns it. Key settings: `min` (always-open connections), `max` (ceiling — new requests queue if all are in use), `idleTimeoutMillis` (close idle connections). In Node.js: `pg-pool` for PostgreSQL, mongoose's `poolSize`. With containerised apps, ensure `max * number_of_pods` doesn't exceed the DB's `max_connections` — use PgBouncer as a connection pooler in front of PostgreSQL at scale.

---

**Q20. How do you handle file uploads securely in a Node.js API?**

**A:**
- Use `multipart/form-data`; parse with `multer` (Node.js)
- **Validate file type by magic bytes** (not just extension or MIME type from client — easily spoofed); use `file-type` library
- **Enforce file size limit** on the parser (not only the frontend)
- **Rename uploaded files** — never use the original filename (path traversal risk)
- **Do NOT store uploads on the API server filesystem** — use S3/Azure Blob with a pre-signed URL pattern: client uploads directly to S3 using a short-lived pre-signed URL; your API is never in the upload data path
- **Virus scan:** For user-uploaded content, run through ClamAV or a cloud-based scanner (AWS Guardduty malware protection)
- Serve uploaded files through a CDN, not directly from S3 with public access — control access via signed URLs

---

**Q21. What is the difference between PUT and PATCH?**

**A:** `PUT` replaces the entire resource — the client must send the full representation. If you omit a field, it gets deleted/nulled. `PATCH` applies a partial update — only the fields sent are modified. In practice, PATCH is more useful for APIs where clients update a single field. However, PATCH must be implemented carefully to be idempotent (applying the same PATCH twice should give the same result). Use JSON Patch (RFC 6902) or JSON Merge Patch (RFC 7396) for a standardised PATCH format.

---

**Q22. How do you implement request tracing across microservices in Node.js?**

**A:** Use OpenTelemetry:
1. Instrument each service with `@opentelemetry/sdk-node` and auto-instrumentation for HTTP, Express, and DB clients.
2. On incoming requests, extract the `traceparent` header (W3C Trace Context standard) if present; otherwise create a new trace.
3. Propagate `traceparent` (and baggage if needed) on all outgoing HTTP calls and queue messages.
4. Export spans to Jaeger, Zipkin, or a cloud provider (AWS X-Ray, Azure Monitor).
5. In structured logs, always include the current `traceId` and `spanId` so logs can be correlated to traces.

---

**Q23. How do you document an API that multiple teams consume?**

**A:** OpenAPI spec in the repo, reviewed in PRs. Auto-publish Swagger UI / Redoc on every merge to main (deploy to an internal docs site). Maintain a changelog (`CHANGELOG.md`) with semantic versioning. For breaking changes, communicate via a deprecation notice in the response headers (`Deprecation`, `Sunset`) before removing. Run contract tests (Pact) between provider (API) and consumers — consumer-driven contracts catch breaking changes in CI before they reach staging.

---

**Q24. What is backpressure in Node.js streams and how do you handle it?**

**A:** Backpressure occurs when a writable stream can't consume data as fast as a readable stream produces it, causing memory to grow unbounded. Node.js streams signal this via the return value of `write()` — it returns `false` when the internal buffer is full. You should pause the readable stream and resume when the writable emits `drain`. Using `pipe()` or the `pipeline()` utility handles this automatically. Real-world impact: streaming large file uploads to S3, processing CSV exports, or server-sent event streams — always use `pipeline()` to avoid OOM crashes.


---

## 3. Frontend — React / Next.js

### Core JD Questions

---

**Q1. CSR vs SSR vs ISR in Next.js — when does each matter for performance?**

**A:**

| | CSR | SSR | ISR |
|---|---|---|---|
| **When HTML is built** | Browser (JS runs client-side) | Server on every request | Server at build time + revalidation intervals |
| **Time to first byte (TTFB)** | Fast (empty shell) | Slower (wait for server render) | Fast (pre-built) |
| **SEO** | Poor (crawler sees empty HTML) | Excellent | Excellent |
| **Data freshness** | Always fresh (client fetches) | Always fresh (per-request) | Stale up to revalidate interval |
| **Best for** | Dashboards, admin panels, auth-gated pages | Product pages, personalised pages, real-time data | Blog posts, marketing pages, catalogue pages |

**Next.js specifics:**
- `getServerSideProps` → SSR (runs on every request)
- `getStaticProps` with `revalidate` → ISR (rebuild page in background after N seconds)
- `getStaticProps` without revalidate → SSG (build-time only)
- App Router: `fetch(..., { next: { revalidate: 60 } })` for ISR, `{ cache: 'no-store' }` for SSR behaviour

---

**Q2. React state management at scale — Redux vs Zustand vs Context API.**

**A:**

| | Context API | Zustand | Redux Toolkit |
|---|---|---|---|
| **Boilerplate** | Low | Low | Medium (RTK reduced it significantly) |
| **Performance** | Re-renders all consumers on any context change | Subscription-based, granular re-renders | Selector-based, optimised |
| **DevTools** | None | Basic | Excellent (Redux DevTools) |
| **Async** | Manual | Built-in via middleware | RTK Query / createAsyncThunk |
| **Best for** | Themes, auth state, simple shared state | Small-medium apps, fast setup needed | Large apps, complex state, team consistency |

**Rule of thumb:**
- Local UI state → `useState` / `useReducer`
- Shared UI state in a subtree → Context
- Global client state (cart, user prefs) → Zustand
- Server cache state (API responses) → React Query / RTK Query — these aren't really "state", they're cache
- Complex global state with time-travel debugging needed → Redux Toolkit

---

**Q3. Core Web Vitals optimisation.**

**A:** The three metrics Google uses for ranking and UX quality:

- **LCP (Largest Contentful Paint) — < 2.5s:** Measures load performance. Fix: preload the hero image (`<link rel="preload">`), use `next/image` with `priority`, reduce server response time, use a CDN.
- **CLS (Cumulative Layout Shift) — < 0.1:** Measures visual stability. Fix: always define `width` and `height` on images and iframes, avoid injecting content above existing content, reserve space for ads/embeds.
- **FID / INP (Interaction to Next Paint) — < 200ms:** Measures interactivity. Fix: reduce JS bundle size (code splitting, tree shaking), defer non-critical scripts, move long tasks to Web Workers or break them up with `scheduler.postTask`.

**Next.js built-in wins:** Automatic image optimisation, font optimisation (`next/font`), code splitting per route, prefetching links in viewport.

---

**Q4. Accessibility (WCAG) basics that come up in interviews.**

**A:**
- **Semantic HTML:** Use `<button>` not `<div onClick>` — keyboard navigation and screen readers depend on it
- **Alt text:** All meaningful images need descriptive alt text; decorative images use `alt=""`
- **Focus management:** After a modal opens, move focus inside it; after it closes, return focus to the trigger element
- **ARIA only when needed:** ARIA attributes supplement, not replace, semantic HTML. `role="button"` on a `<div>` is the last resort.
- **Colour contrast:** 4.5:1 ratio for normal text, 3:1 for large text (WCAG AA)
- **Keyboard navigation:** All interactive elements reachable by Tab, operable by Enter/Space; no keyboard traps
- **Announcements for dynamic content:** Use `aria-live="polite"` regions to announce status messages (form errors, loading states) to screen readers

---

### 20 Additional Frontend Questions

---

**Q5. Explain React's reconciliation algorithm and the role of keys.**

**A:** React uses a virtual DOM. On state change, it renders a new virtual DOM tree and diffs it against the previous one (reconciliation). The diffing algorithm assumes: (1) different element types produce different trees, (2) keys identify which items in a list have changed. Without keys (or with index as key), React can't tell if a list item was added, removed, or reordered — it re-renders all items. With stable, unique keys, React can surgically update only changed items. Never use array index as a key for lists that can reorder or have items removed — it causes subtle state bugs.

---

**Q6. What are React Server Components (RSC) and how do they work?**

**A:** RSCs run exclusively on the server — they have zero client-side JavaScript. They can directly access the database, filesystem, or server-side secrets. They don't have state or lifecycle hooks. The output is a serialised component tree streamed to the client and painted into the page without shipping their code to the browser. In Next.js App Router, all components are Server Components by default; you opt into client-side behaviour with `'use client'`. Use RSCs for data-fetching, heavy components (markdown rendering, syntax highlighting); use Client Components for interactivity, event handlers, browser APIs.

---

**Q7. How does React's `useEffect` work and what are common pitfalls?**

**A:** `useEffect` runs after the browser has painted. The dependency array controls when: `[]` = once on mount; `[a, b]` = on mount and whenever `a` or `b` change; omitted = after every render. Common pitfalls:
- **Missing dependencies:** ESLint exhaustive-deps rule catches this; missing deps cause stale closures — you read an old value.
- **Infinite loops:** Setting state inside an effect that has that state as a dependency.
- **Race conditions with async effects:** If `userId` changes before the fetch completes, you may set state with stale data. Fix: use an `AbortController` or a cleanup flag.
- **Over-use:** Derived values (computed from state) should be `useMemo`, not an effect that sets new state.

---

**Q8. How do you optimise a React app that's re-rendering too often?**

**A:** Profile first with React DevTools Profiler — identify which components are re-rendering unnecessarily. Then:
- `React.memo(Component)` — skip re-render if props are shallowly equal
- `useMemo(fn, deps)` — memoise expensive computations
- `useCallback(fn, deps)` — memoise function references passed as props (otherwise child with `React.memo` still re-renders because the function reference changes)
- Move state down — state that only one subtree cares about should live as low as possible
- Context splitting — split a large Context into smaller ones; consumers only re-render when their slice changes
- Virtualise long lists — `react-window` or `react-virtual` for thousands of rows

---

**Q9. What is hydration in Next.js and what causes hydration errors?**

**A:** Hydration is the process of attaching React event handlers to server-rendered HTML. React re-renders the component tree on the client and expects it to match the server-rendered HTML exactly. A mismatch (hydration error) occurs when:
- Using `Date.now()`, `Math.random()`, or `window` directly in render (different values on server vs client)
- User has a browser extension that modifies the DOM before React hydrates
- Nesting `<p>` inside `<p>` or invalid HTML
Fix: use `useEffect` for client-only code, `suppressHydrationWarning` for unavoidable mismatches (timestamps), or use `dynamic(() => import(...), { ssr: false })` for components that should only render on the client.

---

**Q10. What is code splitting and how do you implement it in React/Next.js?**

**A:** Code splitting breaks the JS bundle into smaller chunks loaded on demand instead of one large bundle. In React: `React.lazy(() => import('./Component'))` + `<Suspense fallback={...}>`. In Next.js: automatic — each page is its own chunk; dynamic imports with `next/dynamic` for components. Route-based splitting is free in Next.js. Split large libraries (chart.js, moment.js) that are only used on specific pages — import them dynamically, not at the top of the file. Measure with `next build` output or a bundle analyser (`@next/bundle-analyzer`).

---

**Q11. Explain the difference between controlled and uncontrolled components.**

**A:** A controlled component stores its value in React state — the React component is the single source of truth; every keystroke triggers a re-render. An uncontrolled component stores its value in the DOM — accessed via a `ref`. Controlled components are easier to validate, format, and test; they're the React-idiomatic approach. Uncontrolled components are simpler for integrating with non-React code or for performance-critical forms with many fields. React Hook Form takes an uncontrolled approach for performance, then reads values on submit.

---

**Q12. How do you handle authentication state in a Next.js app?**

**A:** Use NextAuth.js (Auth.js) — it handles OAuth providers, JWTs, and session management. Session can be stored as a JWT (stateless, no DB lookup) or in a DB (revocable, more secure). Protect routes:
- App Router: check session in Server Components or middleware (`middleware.ts` with `auth()` from NextAuth)
- API routes: use `getServerSession(req, res, authOptions)` to read the session server-side
- Never rely on client-side route guards alone — they're easily bypassed. Always validate on the server.

---

**Q13. What is React Query and when would you use it over Redux?**

**A:** React Query (TanStack Query) manages *server state* — data that lives on the server and is cached on the client. It handles: fetching, caching, background refetching, stale-while-revalidate, deduplication, pagination, mutations with optimistic updates. Redux manages *client state* — UI state that isn't fetched from a server (sidebar open, theme, wizard step). Most apps that use Redux for API data can replace that slice entirely with React Query, keeping Redux only for true local client state. React Query dramatically reduces boilerplate for data-fetching patterns.

---

**Q14. How do you implement infinite scroll in React efficiently?**

**A:** Use the Intersection Observer API to detect when a sentinel element (at the bottom of the list) enters the viewport, then fetch the next page. React Query's `useInfiniteQuery` handles cursor/page management, caching of loaded pages, and deduplication. Virtualise the list with `react-virtual` or `react-window` if the rendered DOM nodes become very large — rendering 10,000 actual DOM nodes causes layout thrashing. The virtualiser renders only the visible rows, reusing DOM nodes as the user scrolls.

---

**Q15. What are the performance implications of `useContext` at scale?**

**A:** Every component that calls `useContext(MyContext)` re-renders whenever any value in the context changes — even if the component only uses a small part of the context. At scale, a single user preference change can cascade re-renders across the app. Solutions: split contexts (AuthContext, ThemeContext, NotificationsContext separately), use `useMemo` on context values (`value={useMemo(() => ({a, b}), [a, b])}`), or move to Zustand/Redux which have selector-based subscriptions so components only re-render when their specific slice changes.

---

**Q16. How does Next.js middleware work and what are its use cases?**

**A:** Next.js middleware (`middleware.ts` at root) runs on the Edge Runtime (V8 isolate, no Node.js APIs) before a request hits a page or API route. Use cases:
- Authentication guards — redirect unauthenticated users to `/login` without a client-side flash
- A/B testing — set a cookie and rewrite to variant A or B
- Geo-routing — redirect based on country header
- Bot protection — block known bot user-agents
- Request header manipulation — add `X-User-ID` for downstream routes
Middleware runs on every request matching its pattern — keep it fast; avoid DB calls (use JWT validation or edge-compatible token validation).

---

**Q17. Explain React's Suspense and how it enables streaming SSR.**

**A:** `<Suspense>` allows React to show a fallback while waiting for async work (lazy-loaded component, async data in RSC). In Next.js App Router, Suspense enables *streaming* — the server sends the HTML shell immediately (fast TTFB), then streams in each Suspense boundary's content as it resolves. The user sees content progressively instead of waiting for the slowest data fetch. Use Suspense boundaries around data-dependent sections (e.g., wrap a "User Activity" section that fetches separately from the main page content) to allow the page shell to render immediately.

---

**Q18. What is the purpose of `next/image` and how does it optimise images?**

**A:** `next/image` automatically: resizes images to the exact size needed by the browser, converts to modern formats (WebP/AVIF), lazy-loads images by default (only load when in viewport), prevents CLS by reserving space (requires `width`/`height` or `fill` prop). The optimization happens on the Next.js server (or Vercel CDN) on-the-fly — original images are served transformed. Always use `priority` on the LCP image (above-the-fold hero image) to preload it. Use `fill` for images in dynamic-size containers with `object-fit: cover`.

---

**Q19. How do you implement optimistic updates in React?**

**A:** Optimistic updates show the expected result immediately in the UI before the server confirms the action, making the app feel faster. With React Query's `useMutation`:
1. `onMutate` — update the cache immediately with the expected value; save the previous cache value as a rollback
2. `onError` — restore the previous cache value (the mutation failed)
3. `onSettled` — invalidate the query to refetch fresh data from the server

Example: liking a post — instantly show the like count + 1; if the server returns an error, revert.

---

**Q20. What is the difference between `layout.tsx` and `page.tsx` in Next.js App Router?**

**A:** `page.tsx` is the unique UI for a route — it's replaced on navigation. `layout.tsx` wraps its child pages and persists across navigations within that segment — it is **not** re-rendered when navigating between pages that share it (state is preserved). This enables persistent UI (sidebars, navigation, persistent media players) without re-mounting. `layout.tsx` receives `children` as a prop — it renders both the layout UI and the current `page.tsx` via `{children}`. RootLayout wraps the entire app and is the place to put `<html>`, `<body>`, global fonts, and providers.

---

**Q21. How do you handle environment variables securely in Next.js?**

**A:** Next.js has two types: `NEXT_PUBLIC_` prefixed variables are embedded into the client bundle at build time (safe for public config like API base URLs). Variables without the prefix are server-only — only available in Server Components, API routes, `getServerSideProps`, and middleware. Never put secrets (API keys, DB passwords) in `NEXT_PUBLIC_` variables — they are visible in the browser. Use `.env.local` for local dev (gitignored), and inject production secrets via your cloud provider's secrets service at build/runtime. Validate required env vars on startup with Zod.

---

**Q22. What is Turbopack and how does it compare to Webpack in Next.js?**

**A:** Turbopack is the Rust-based bundler that replaces Webpack in Next.js (stable in Next.js 15 for dev). It's significantly faster for incremental builds because it only recompiles changed modules (Webpack recompiles larger dependency graphs). On large projects, cold start and hot module replacement (HMR) times can be 10x faster. The API and configuration surface is intentionally compatible with Webpack. For production builds, Webpack is still used in many setups, with Turbopack production support rolling out. If you're on Next.js 14+, enable Turbopack for dev with `next dev --turbo`.

---

**Q23. How do you test React components effectively?**

**A:**
- **Unit tests (React Testing Library):** Test component behaviour from the user's perspective — query by accessible roles/text, not internal implementation. Fire events with `userEvent`. Mock dependencies.
- **Avoid:** Testing implementation details (internal state, private methods), testing library internals
- **Integration tests:** Render a feature subtree with its real child components; mock only external I/O (API calls with MSW — Mock Service Worker)
- **E2E tests (Playwright/Cypress):** Test full user flows in a real browser against a running app. Slower but highest confidence.
- Coverage target: focus on critical paths, not 100% line coverage. A well-tested component tests all user-facing behaviours, not all branches of its implementation.

---

**Q24. What are React Portals and when do you use them?**

**A:** `ReactDOM.createPortal(children, domNode)` renders `children` into a different DOM node than the component's parent, while keeping them in the React component tree. Used for: modals (need to escape overflow:hidden and z-index stacking contexts of parent), tooltips (need to render at the `<body>` level), and notification toasts. The portal's children still participate in React's event bubbling (events bubble up the React tree, not the DOM tree), so you can still catch modal close events in a parent component.


---

## 4. Databases

### Core JD Questions

---

**Q1. SQL schema design + query optimisation — indexing strategies and EXPLAIN plans.**

**A:**

**Schema design principles:**
- Normalise to 3NF to eliminate redundancy; denormalise strategically for read-heavy tables
- Use surrogate keys (UUID or BIGSERIAL) as primary keys; use natural keys as unique constraints
- Apply proper constraints: `NOT NULL`, `UNIQUE`, `FOREIGN KEY`, `CHECK`
- Partition large tables (range/list/hash) to improve query performance

**Indexing strategies:**
- **B-tree indexes** (default): Equality and range queries. Index columns used in `WHERE`, `JOIN ON`, `ORDER BY`
- **Composite indexes**: Order matters — `(country, city)` supports `WHERE country = ?` and `WHERE country = ? AND city = ?` but NOT `WHERE city = ?` alone (leftmost-prefix rule)
- **Partial indexes**: Index only rows matching a condition (`WHERE status = 'active'`) — smaller, faster
- **Covering indexes**: Include all columns needed by a query so the DB never touches the table (index-only scan)
- **GIN indexes**: For full-text search, JSONB columns in PostgreSQL

**Reading EXPLAIN / EXPLAIN ANALYZE:**
- `Seq Scan` — full table scan; acceptable on small tables, a red flag on large ones
- `Index Scan` — using an index; good
- `Index Only Scan` — covering index; best
- `Nested Loop` / `Hash Join` — join strategies; check row estimates (planner misestimation causes bad plans)
- Look for high `cost`, huge row estimate mismatches, and unnecessary sorts

---

**Q2. When to choose MongoDB vs PostgreSQL vs Redis.**

**A:**

| | PostgreSQL | MongoDB | Redis |
|---|---|---|---|
| **Data model** | Relational (tables, rows) | Document (JSON-like) | Key-value / data structures |
| **Transactions** | Full ACID | Multi-document ACID (4.0+) | Transactions on single node |
| **Query flexibility** | Very high (SQL, JOINs) | Rich query language, aggregations | Limited (key lookups, range scans) |
| **Schema** | Strict (migrations needed) | Flexible (schema-on-read) | Schemaless |
| **Use when** | Financial data, complex relationships, reporting, existing SQL tooling | Content with variable structure, catalogs, logs, read-heavy | Caching, session storage, rate limiting, leaderboards, pub/sub |

**Decision framework:**
- If you have relationships and need JOINs → PostgreSQL
- If schema evolves rapidly and structure is irregular → MongoDB
- If you need sub-millisecond reads and data fits in memory → Redis

---

**Q3. Data integrity across distributed services — eventual consistency and transactions.**

**A:**

**Within one service (single DB):** Use ACID transactions. In PostgreSQL, wrap multi-step operations in `BEGIN ... COMMIT`. Use `SELECT ... FOR UPDATE` for row-level locking.

**Across services (distributed):**
- **Saga pattern:** Sequence of local transactions with compensating actions on failure (see System Design Q12)
- **Outbox pattern:** Write the event to an `outbox` table in the same DB transaction as the domain change. A CDC process (Debezium) reads the outbox and publishes to the message broker — guarantees at-least-once event delivery without a 2-phase commit
- **Idempotent consumers:** Since messages can be delivered more than once, process events idempotently (check processed message IDs)
- **Eventual consistency trade-offs:** Be explicit about which operations are eventually consistent in your API contracts; design UX that handles brief inconsistency gracefully (e.g., "your order is being processed")

---

### 20 Additional Database Questions

---

**Q4. What is the N+1 query problem and how do you solve it?**

**A:** N+1 occurs when you fetch a list of N records, then for each record make an additional DB query to fetch related data — resulting in N+1 queries instead of 1 or 2. In SQL: use `JOIN` or eager loading. In ORMs (Sequelize, TypeORM): use `include`/`relations`. In GraphQL: use DataLoader to batch and deduplicate DB calls within a single request. In MongoDB: use `$lookup` aggregation or populate selectively. Always check your ORM's query log for N+1 patterns in development.

---

**Q5. Explain database transactions and isolation levels.**

**A:** A transaction is a unit of work that is atomic — all steps commit or all roll back. Isolation levels control how transactions see each other's in-progress changes:
- **READ UNCOMMITTED:** See uncommitted data (dirty reads) — almost never used
- **READ COMMITTED:** Only see committed data; default in PostgreSQL
- **REPEATABLE READ:** Same query returns same results within a transaction — prevents non-repeatable reads
- **SERIALIZABLE:** Strictest — transactions execute as if serial; prevents phantom reads

Higher isolation = fewer anomalies but more locking/contention. Use `READ COMMITTED` for most OLTP workloads; `SERIALIZABLE` for financial operations where phantom reads would cause correctness issues.

---

**Q6. What is database sharding and when is it needed?**

**A:** Sharding horizontally partitions data across multiple database instances (shards). Each shard holds a subset of rows — typically by a shard key (user_id modulo N, geographic region, tenant_id). Use when a single DB instance can no longer handle the write throughput or data volume, even with optimised queries, read replicas, and vertical scaling. Downsides: cross-shard queries are complex/expensive, no cross-shard transactions, operational complexity. Most applications never need sharding — explore vertical scaling, read replicas, caching, and query optimisation first. MongoDB, CockroachDB, and Amazon Aurora offer built-in sharding/distribution.

---

**Q7. How do you optimise a slow MongoDB query?**

**A:**
1. Use `explain('executionStats')` to see if the query uses an index
2. Look for `COLLSCAN` (collection scan) — indicates missing index
3. Add an index on the query fields: `db.collection.createIndex({ field: 1 })`
4. For compound queries, create compound indexes matching the query and sort fields
5. Use projection to return only needed fields (reduces data transfer)
6. Use aggregation pipeline efficiently — `$match` and `$sort` early to filter before expensive `$lookup` stages
7. Check query selectivity — an index on a low-cardinality field (e.g., boolean) may not help
8. Use sparse and partial indexes for optional fields or filtered queries

---

**Q8. Explain the difference between SQL JOINs.**

**A:**
- **INNER JOIN:** Returns rows with matching values in both tables
- **LEFT JOIN:** All rows from left table + matching rows from right; unmatched right rows are NULL
- **RIGHT JOIN:** Opposite of LEFT JOIN (rarely used; just swap table order and use LEFT JOIN)
- **FULL OUTER JOIN:** All rows from both tables; non-matching rows have NULLs on the missing side
- **CROSS JOIN:** Cartesian product — every row from left × every row from right (exponentially large)
- **SELF JOIN:** A table joined to itself (e.g., employee → manager where both are in the same `employees` table)

---

**Q9. What is a database index and how does a B-tree index work internally?**

**A:** An index is a separate data structure that speeds up data retrieval at the cost of additional storage and slower writes (index must be updated on INSERT/UPDATE/DELETE). A B-tree (Balanced Tree) index stores sorted key values in a tree where all leaves are at the same depth. Searching: traverse from root to leaf in O(log N) comparisons — far faster than a full scan of O(N). Leaves store the key value + a pointer to the heap (actual table row). Composite indexes store multiple columns as a tuple in each leaf; the leftmost prefix rule applies.

---

**Q10. What is connection pooling and how do you size it?**

**A:** Connection pooling reuses established DB connections. PostgreSQL allows a limited number of `max_connections` (typically 100–200 on default config). Formula to think about: `pool_size_per_pod × number_of_pods < db_max_connections`. A common mistake is setting `pool_max = 100` per pod with 20 pods — that's 2,000 connections overwhelming the DB. Use PgBouncer (transaction-mode pooling) in front of PostgreSQL to multiplex thousands of app connections onto a small pool of real DB connections. For MongoDB: driver manages a single pool; default `maxPoolSize = 100` per `MongoClient` instance.

---

**Q11. What is Redis and what data structures does it support?**

**A:** Redis is an in-memory data store. Data structures:
- **String:** Caching (`GET`/`SET`/`EXPIRE`), counters (`INCR`/`DECR`)
- **Hash:** Object storage (`HSET`/`HGET`) — per-user session data
- **List:** Queues, activity feeds (`LPUSH`/`RPOP`)
- **Set:** Unique memberships, tagging (`SADD`/`SMEMBERS`/`SISMEMBER`)
- **Sorted Set (ZSet):** Leaderboards, priority queues (`ZADD`/`ZRANGE`) — members with scores
- **Bitmap:** Efficient boolean tracking (daily active users, feature flags per user)
- **Stream:** Append-only log for event sourcing, similar to Kafka but simpler

---

**Q12. How do you implement full-text search in PostgreSQL?**

**A:** PostgreSQL has built-in full-text search:
```sql
-- Add a tsvector column
ALTER TABLE articles ADD COLUMN search_vector tsvector;

-- Update with document content
UPDATE articles SET search_vector = to_tsvector('english', title || ' ' || body);

-- Create a GIN index for fast search
CREATE INDEX articles_fts ON articles USING GIN(search_vector);

-- Query
SELECT * FROM articles
WHERE search_vector @@ to_tsquery('english', 'nodejs & performance')
ORDER BY ts_rank(search_vector, to_tsquery('english', 'nodejs & performance')) DESC;
```
Suitable for basic full-text search. For advanced needs (fuzzy matching, relevance tuning, multiple languages, faceting), use Elasticsearch/OpenSearch.

---

**Q13. What is the difference between OLTP and OLAP databases?**

**A:**
- **OLTP (Online Transaction Processing):** Optimised for low-latency reads/writes of individual records. Normalised schema, row-oriented storage, short transactions. Examples: PostgreSQL, MySQL, MongoDB.
- **OLAP (Online Analytical Processing):** Optimised for complex aggregations over large datasets. Denormalised (star/snowflake schema), columnar storage, long-running queries. Examples: Redshift, BigQuery, Snowflake, ClickHouse.

In practice, don't run heavy analytics queries on your OLTP DB — they acquire locks and degrade performance. Use a separate analytics warehouse; populate it via ETL/ELT pipelines from the OLTP DB.

---

**Q14. How do you handle database migrations safely in production?**

**A:**
- Use migration tools (Flyway, Liquibase, Knex migrations, Prisma migrate)
- Make migrations backward-compatible (expand-contract pattern): add column → deploy code → backfill → remove old column in a later release
- Avoid long-running locks: `ADD COLUMN DEFAULT NULL` is instant in PostgreSQL; `ADD COLUMN DEFAULT non_null` requires a table rewrite in older versions
- Test migrations on a copy of production data
- Always write a rollback/undo migration
- Run migrations in CI on staging before production
- For very large tables, use `pg_repack` or online schema change tools to avoid locking

---

**Q15. Explain write-ahead logging (WAL) in PostgreSQL.**

**A:** WAL is PostgreSQL's durability mechanism. Before any data change is written to the actual data files, it's first written to the WAL (sequential log on disk). On crash, PostgreSQL replays the WAL to restore a consistent state. Benefits: crash recovery, point-in-time recovery (PITR), streaming replication (replicas replay the WAL stream from the primary). WAL is the foundation of PostgreSQL's ACID guarantees and replication. Tuning `wal_level`, `max_wal_senders`, and `archive_mode` affects replication and backup capabilities.

---

**Q16. What is database denormalization and when is it acceptable?**

**A:** Denormalization intentionally introduces redundancy (duplicating data across tables) to avoid expensive JOINs on hot query paths. Acceptable when: a query is critically latency-sensitive and the JOIN cost is measurable, you have clear ownership of keeping the denormalized copy in sync (via triggers or application logic), and the data changes infrequently. Examples: storing `username` and `avatarUrl` on a `comments` table instead of joining to `users` on every comment fetch. Always document denormalized columns and the synchronisation strategy to prevent stale data bugs.

---

**Q17. How do you implement soft deletes and why?**

**A:** Soft delete marks records as deleted (add `deleted_at TIMESTAMP NULL` column) instead of physically removing them. Benefits: audit trail, ability to recover deleted data, referential integrity (foreign keys to the deleted record don't break). Implementation: add `WHERE deleted_at IS NULL` to all queries (or use a DB view). In ORMs: Sequelize `paranoid: true`, TypeORM `@DeleteDateColumn()`. Pitfalls: unique constraints break (a "deleted" email can't be reused for a new account) — solve with partial unique index (`WHERE deleted_at IS NULL`). Performance: index on `deleted_at` or use a partial index.

---

**Q18. What is a composite index and when does the order of columns matter?**

**A:** A composite index on `(a, b, c)` can be used for queries filtering on `a`, `a + b`, or `a + b + c` — but NOT for queries filtering on `b` or `c` alone (leftmost prefix rule). Column order in the index should match the most common query patterns. Put high-selectivity columns first (columns that filter out many rows). If you also need to sort, include the sort column in the index: `(tenant_id, created_at DESC)` supports `WHERE tenant_id = ? ORDER BY created_at DESC` with an index-only scan.

---

**Q19. How does Redis handle persistence?**

**A:** Two persistence mechanisms:
- **RDB (Redis Database):** Periodic point-in-time snapshots to disk. Fast restore from snapshot. Data loss between snapshots on crash. Good for backups and disaster recovery.
- **AOF (Append Only File):** Logs every write operation. On restart, replays the log. Minimal data loss (configurable: `appendfsync always/everysec/no`). Slower than RDB, larger files, but `everysec` is a good trade-off.
- **RDB + AOF together:** Best of both — RDB for fast recovery, AOF for minimising data loss.
For purely ephemeral caching, you can disable persistence entirely.

---

**Q20. What is read replica and how do you use it in your application?**

**A:** A read replica is a copy of the primary DB that receives changes via replication and serves read traffic. Benefits: offload read-heavy queries (reports, dashboards) from the primary, reduce primary load, geographic distribution. Configuration in the app: use the read replica connection string for `SELECT` queries; always use the primary for writes and for reads that must reflect recent writes (read-your-writes consistency). In Node.js ORMs: configure `replication.read` and `replication.write` in Sequelize; use `readPreference: 'secondaryPreferred'` in MongoDB driver.

---

**Q21. How do you detect and resolve deadlocks?**

**A:** A deadlock occurs when two transactions each hold a lock the other needs, and both wait indefinitely. DBs detect deadlocks automatically and abort one transaction (the victim). In PostgreSQL, the `deadlock_timeout` setting triggers detection (default 1s). To resolve:
- Ensure all code acquires locks in the same order (e.g., always lock `accounts` in ascending `id` order)
- Keep transactions short — acquire locks as late as possible and release them quickly
- Use `SELECT ... FOR UPDATE SKIP LOCKED` for queue-like patterns (avoids deadlocks from multiple workers competing for the same row)
- Log deadlock events and investigate the query patterns causing them

---

**Q22. What is the difference between TRUNCATE, DELETE, and DROP?**

**A:**
- `DELETE FROM table WHERE ...` — removes specific rows; logged (can be rolled back in a transaction); triggers fire; slower for large deletes; doesn't reset sequences
- `TRUNCATE TABLE` — removes all rows (no WHERE clause); minimally logged (very fast); resets sequences; no row-level triggers; cannot be rolled back in some DBs (PostgreSQL allows rollback within a transaction)
- `DROP TABLE` — removes the table structure and all data permanently; cannot be rolled back outside an explicit transaction

For clearing a table in a dev/test environment, `TRUNCATE` is fastest. In production, never use `TRUNCATE` casually — always use `DELETE` with conditions or with a transaction.


---

## 5. Cloud & DevOps

### Core JD Questions

---

**Q1. Docker + Kubernetes — pod scaling, health checks, rolling deployments.**

**A:**

**Pod scaling:**
- **Manual:** `kubectl scale deployment my-app --replicas=5`
- **HPA (Horizontal Pod Autoscaler):** Scales pods based on CPU/memory or custom metrics (e.g., queue depth). `kubectl autoscale deployment my-app --min=2 --max=10 --cpu-percent=70`
- **VPA (Vertical Pod Autoscaler):** Adjusts the pod's resource requests/limits automatically
- **KEDA (Kubernetes Event-Driven Autoscaling):** Scales to zero based on event sources (SQS queue depth, Kafka lag)

**Health checks:**
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 20

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```
- **Liveness:** Is the container alive? Failure → restart the container
- **Readiness:** Is the container ready to receive traffic? Failure → remove from Service endpoints (no traffic sent)
- **Startup probe:** For slow-starting apps — gives extra time before liveness kicks in

**Rolling deployments:**
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # Can have 1 extra pod during update
    maxUnavailable: 0  # Zero downtime — always full capacity
```
Kubernetes replaces pods one by one. With `maxUnavailable: 0`, it brings up the new pod first, waits for it to pass readiness, then terminates the old one.

---

**Q2. CI/CD pipeline design — GitHub Actions, Jenkins, Azure DevOps.**

**A:**

**GitHub Actions example:**
```yaml
name: CI/CD
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --coverage
      - run: npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build & push Docker image
        run: |
          docker build -t $ECR_REGISTRY/my-app:$GITHUB_SHA .
          docker push $ECR_REGISTRY/my-app:$GITHUB_SHA
      - name: Deploy to Kubernetes
        run: |
          helm upgrade --install my-app ./chart \
            --set image.tag=$GITHUB_SHA \
            --namespace production
```

**Key principles across all CI/CD tools:**
- Separate CI (build/test on every PR) from CD (deploy on main merge)
- Use secrets as environment variables — never hardcode credentials
- Run security scans (SAST, dependency audit) in the pipeline
- Require status checks to be green before merge
- Deploy to staging first, then require manual approval for production

---

**Q3. Cloud cost optimisation strategies on AWS/Azure.**

**A:**

| Strategy | AWS | Azure |
|---|---|---|
| **Right-sizing** | AWS Compute Optimizer | Azure Advisor |
| **Reserved/committed use** | Reserved Instances (1/3-year) | Reserved VM Instances |
| **Spot/Preemptible** | Spot Instances (70-90% cheaper) | Spot VMs / Azure Spot |
| **Auto-scaling** | ASG, ECS FARGATE, Lambda | VMSS, AKS cluster autoscaler |
| **Storage tiering** | S3 Intelligent Tiering, Glacier | Blob Storage tiers (hot/cool/archive) |
| **Rightsizing DBs** | Aurora Serverless v2 | Azure SQL serverless |
| **Savings analysis** | Cost Explorer, Trusted Advisor | Cost Management + Azure Advisor |

**Practical steps:**
- Enable billing alerts and budgets to catch runaway costs early
- Delete unused resources (idle EC2/VMs, unattached EBS volumes, old snapshots)
- Use Lambda/Functions for low-traffic workloads — pay per invocation, not idle time
- Review data transfer costs — egress between regions/AZs is expensive; keep services in the same AZ where possible
- Use CDN for static assets to reduce origin data transfer

---

### 20 Additional Cloud & DevOps Questions

---

**Q4. What is Infrastructure as Code (IaC) and what tools support it?**

**A:** IaC defines infrastructure (VMs, networks, databases, IAM roles) in declarative configuration files that can be version-controlled, reviewed, and applied automatically. Benefits: reproducible environments, drift detection, code review for infra changes, disaster recovery (rebuild from code). Tools:
- **Terraform:** Cloud-agnostic HCL; declarative; plan/apply workflow. Most widely used.
- **AWS CDK / Pulumi:** Infrastructure in a real programming language (TypeScript, Python) — better abstractions for complex logic
- **AWS CloudFormation / Azure ARM / Bicep:** Native cloud-specific; no extra dependencies
- **Ansible:** Configuration management (not just provisioning) — idempotent playbooks for OS-level setup

---

**Q5. Explain the difference between Docker image layers and how they affect build speed.**

**A:** Each instruction in a Dockerfile creates a read-only layer. Layers are cached — if a layer hasn't changed since the last build, Docker reuses the cached layer. This means layer order matters for build speed. Put frequently-changing instructions (COPY source code) AFTER rarely-changing ones (installing dependencies):
```dockerfile
COPY package*.json ./     # Layer 1 — changes rarely
RUN npm ci                 # Layer 2 — cached if package.json unchanged
COPY . .                   # Layer 3 — changes every build
RUN npm run build          # Layer 4 — only runs when source changes
```
If you put `COPY . .` before `RUN npm ci`, every source change invalidates the npm install layer.

---

**Q6. What is a Kubernetes ConfigMap vs Secret?**

**A:** Both inject configuration into pods. ConfigMap stores non-sensitive config (app settings, feature flags, config files) as key-value pairs or file content. Secret stores sensitive data (passwords, API keys, TLS certs) — stored base64-encoded in etcd (base64 is NOT encryption; use encryption at rest for etcd + Sealed Secrets or external secrets operator for real security). Both can be mounted as environment variables or as files in a volume. Never commit Secrets to git — use External Secrets Operator (pulls from AWS Secrets Manager / Azure Key Vault) so actual secrets never live in the cluster config files.

---

**Q7. How does Kubernetes Service Discovery work?**

**A:** Every Service in Kubernetes gets a stable DNS name: `{service-name}.{namespace}.svc.cluster.local`. The `kube-dns` (CoreDNS) component resolves these names to the Service's ClusterIP. The ClusterIP is a virtual IP that `kube-proxy` (iptables/IPVS rules on each node) load-balances to the healthy pod IPs behind the service. No hard-coded IPs needed — services find each other by name. In practice, within the same namespace: `http://user-service:3000`; across namespaces: `http://user-service.auth.svc.cluster.local:3000`.

---

**Q8. What is the difference between a Kubernetes Deployment, StatefulSet, and DaemonSet?**

**A:**
- **Deployment:** Manages stateless pods — any pod can replace any other; pods are interchangeable. Pod names are random (`my-app-7d8f4c-xkq2n`). Use for web servers, API services.
- **StatefulSet:** Manages stateful pods that need stable identity — each pod has a stable hostname (`db-0`, `db-1`) and its own persistent volume. Pods scale up/down in order. Use for databases, Kafka, ZooKeeper.
- **DaemonSet:** Ensures one pod runs on every node (or selected nodes). Use for log collectors (Fluentd), metrics agents (Prometheus node-exporter), network plugins.

---

**Q9. How do you manage secrets in Kubernetes securely?**

**A:** Native Kubernetes Secrets are base64-encoded in etcd — not encrypted by default. Best practices:
1. **Enable etcd encryption at rest** (EncryptionConfiguration) — encrypts secrets in etcd
2. **External Secrets Operator:** Pull secrets from AWS Secrets Manager / Azure Key Vault / HashiCorp Vault into Kubernetes Secrets automatically. Secret values never in git.
3. **Sealed Secrets (Bitnami):** Encrypt secrets with a cluster public key; the encrypted `SealedSecret` is safe to commit to git; the controller decrypts it inside the cluster
4. **Vault Agent Injector:** Hashicorp Vault injects secrets directly into pod filesystems via a sidecar — secrets never touch Kubernetes secrets at all

---

**Q10. Explain Helm and when you would use it.**

**A:** Helm is a package manager for Kubernetes. A chart is a collection of YAML templates + a `values.yaml` file. On `helm install`, Helm renders the templates with the provided values, producing Kubernetes manifests that are applied to the cluster. Benefits: parameterise deployments (different values for dev/staging/prod), version charts, rollback (`helm rollback`), share reusable charts (Helm Hub). Use Helm when you manage multiple environments with the same manifests but different config, or when consuming community charts (ingress-nginx, cert-manager, prometheus-stack). For simple single-service deployments, raw kustomize may be simpler.

---

**Q11. What is GitOps and how does it differ from traditional CI/CD?**

**A:** GitOps uses a Git repository as the single source of truth for the desired state of infrastructure and applications. A GitOps controller (Argo CD, Flux) continuously watches the Git repo and reconciles the cluster state to match it — if someone manually changes something in the cluster, the controller reverts it. Traditional CI/CD: pipeline pushes to the cluster (`kubectl apply` in the pipeline). GitOps: pipeline updates the Git repo; the cluster pulls from Git. Benefits: full audit trail (all changes are git commits), easy rollback (revert the commit), drift detection, seperated deployment permission model.

---

**Q12. What is a multi-stage Docker build and why is it important?**

**A:** A multi-stage build uses multiple `FROM` instructions in one Dockerfile. Each stage can use a different base image. The final `FROM` is what you ship — you copy only the build artefacts from intermediate stages:
```dockerfile
# Build stage — has all dev tools
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage — minimal, no dev tools
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/server.js"]
```
The production image doesn't contain source code, dev dependencies, or build tools — smaller, fewer vulnerabilities.

---

**Q13. How do you monitor Kubernetes workloads in production?**

**A:** 
- **Metrics:** Prometheus scrapes pod/node metrics; Grafana dashboards. Use kube-state-metrics for cluster-level metrics (deployment replicas, pod states). Define alerting rules (pod crash-looping, HPA at max replicas, high latency).
- **Logs:** Fluentd/Fluent Bit as DaemonSet ships logs to Elasticsearch (ELK) or CloudWatch / Azure Monitor. Always use structured JSON logging.
- **Traces:** OpenTelemetry SDK in each service → Jaeger/Zipkin or cloud tracing service.
- **Events:** `kubectl get events` for debugging; pipe events to alerting. Event Exporter to ship events to monitoring.
- **Uptime:** External blackbox probes (Prometheus blackbox exporter) hitting public endpoints from outside the cluster.

---

**Q14. What is an Ingress in Kubernetes and how does it work?**

**A:** An Ingress is an API object that manages external HTTP/HTTPS access to services within the cluster. An Ingress Controller (nginx-ingress, Traefik, AWS ALB Ingress Controller) watches Ingress resources and configures the underlying load balancer/proxy. The Ingress resource defines routing rules: by host (`api.example.com` → api-service), by path (`/v1/` → v1-service, `/v2/` → v2-service), TLS termination. Without an Ingress, you'd need a LoadBalancer service per application (expensive — each gets its own cloud load balancer). An Ingress consolidates traffic through a single controller.

---

**Q15. How do you implement blue/green deployments in Kubernetes?**

**A:** 
1. Deploy green version alongside existing blue: `kubectl apply -f deployment-green.yaml` (adds pods labelled `version: green`)
2. Run smoke tests against green directly (via ClusterIP service selecting green pods)
3. Switch traffic: patch the main Service selector from `version: blue` to `version: green` — atomic switch, instant rollback by patching back
4. Delete blue deployment once green is stable

With Argo Rollouts or Flagger, automate this flow: gradual traffic shift, automatic analysis of metrics, auto-promotion or rollback based on error rate thresholds.

---

**Q16. What is Container Registry and image scanning?**

**A:** A container registry stores Docker images (ECR, ACR, Docker Hub, GCR). In a CI/CD pipeline: build image → tag with git SHA → push to registry → reference that tag in deployment. Image scanning: run `trivy`, `Snyk`, or `ECR enhanced scanning` on every pushed image to detect known CVEs in OS packages and app dependencies. Gate the pipeline — fail the build if critical/high CVEs are found. In Kubernetes, use an admission controller (OPA/Kyverno) to reject pods that reference unscanned or non-registry images (enforcing image provenance).

---

**Q17. Explain AWS Lambda cold starts and how to mitigate them.**

**A:** A cold start occurs when Lambda needs to provision a new execution environment — download the function code, start the runtime, run the init code. This adds latency (100ms–5s depending on runtime and package size). Mitigation:
- **Provisioned concurrency:** Keep N warm instances pre-initialized (costs money even with zero traffic)
- **Reduce package size:** Smaller zip = faster init; use tree-shaking, avoid bundling unnecessary dependencies
- **Choose a lean runtime:** JavaScript/Python have faster cold starts than Java/C# (JVM startup is slow)
- **Keep init code outside handler:** DB connections, config loading in module scope are reused across invocations; only pay for it once
- **SnapStart (for Java):** Lambda takes a snapshot of the initialized runtime — restores it instead of re-initializing

---

**Q18. What is an ALB vs NLB vs CLB on AWS?**

**A:**
- **CLB (Classic):** Legacy — supports HTTP/HTTPS/TCP. No longer recommended.
- **ALB (Application Load Balancer):** Layer 7 (HTTP/HTTPS). Content-based routing (by path, header, host). WebSocket support. Native integration with ECS, Cognito, WAF. Use for web apps and microservices.
- **NLB (Network Load Balancer):** Layer 4 (TCP/UDP/TLS). Extremely low latency (sub-millisecond). Static IP per AZ. Use for TCP workloads, game servers, financial trading apps, or when you need a static IP for allowlisting.

---

**Q19. How do you implement zero-downtime deployments on ECS?**

**A:** On ECS with rolling updates: configure the service with `minimumHealthyPercent: 100` (don't terminate old tasks before new ones are healthy) and `maximumPercent: 200` (allow up to 2x tasks during deployment). The ALB health check must pass on the new task before the old task is drained. Draining: ALB stops sending new connections to the deregistering task and waits for in-flight requests to complete (`deregistrationDelay`). For blue/green: use CodeDeploy with ECS — deploys new task set, shifts traffic via ALB weighted listener rules, then removes old task set.

---

**Q20. What is the purpose of resource requests and limits in Kubernetes?**

**A:**
```yaml
resources:
  requests:
    cpu: "100m"
    memory: "256Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"
```
- **Requests:** What the container is guaranteed. Used by the scheduler to decide which node to place the pod on.
- **Limits:** The maximum a container can use. Exceeding CPU limit → throttled. Exceeding memory limit → OOMKilled (pod restarted).

Always set both. Without requests, the scheduler may overcommit nodes causing evictions under load. Without limits, one noisy container can starve others on the same node. Use VPA to automatically tune requests based on observed usage.

---

**Q21. How do you handle secret rotation in a running Kubernetes cluster?**

**A:** If using External Secrets Operator: update the secret in AWS Secrets Manager / Azure Key Vault; the operator syncs the rotation to the Kubernetes Secret automatically on the configured refresh interval. The app then needs to detect the change — if secrets are mounted as env vars, you must restart the pod; if mounted as files, the kubelet updates the file in-place and the app can watch for file changes. Best practice: mount secrets as files and use a file watcher or periodic cache refresh in the app so rotation doesn't require a pod restart.

---

**Q22. Explain Kubernetes namespaces and how they provide isolation.**

**A:** Namespaces provide logical partitioning within a cluster — separate teams/environments can share a cluster without interfering. Resource quotas limit CPU/memory per namespace. NetworkPolicies restrict pod-to-pod traffic across namespaces. RBAC roles are namespace-scoped — a developer with access to `namespace/dev` can't accidentally modify `namespace/prod`. Names are unique within a namespace but can repeat across namespaces. Typical setup: `default`, `kube-system`, `monitoring`, `dev`, `staging`, `prod` — or one namespace per team with shared cluster infrastructure.

---

**Q23. What is observability as code?**

**A:** Defining dashboards, alerts, and SLOs in code (alongside application code) rather than clicking through UIs. Dashboard-as-code: Grafonnet (generate Grafana dashboards from Jsonnet), Terraform provider for Grafana, Pulumi for Datadog. Alert-as-code: Prometheus alerting rules in YAML checked into the repo, reviewed in PRs. Benefits: version history, team review, reproducible observability config across environments, catch regressions when deleting a metric that an alert depends on. Aligns with GitOps principles — the monitoring state is driven from the repo.

---

**Q24. How do you implement distributed caching with Redis in a Node.js app?**

**A:**
```javascript
// Cache-aside pattern
async function getUserById(id) {
  const cacheKey = `user:${id}`;
  
  // 1. Check cache
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // 2. Cache miss - fetch from DB
  const user = await db.users.findById(id);
  
  // 3. Populate cache with TTL
  await redis.setex(cacheKey, 300, JSON.stringify(user)); // 5 min TTL
  
  return user;
}

// On update/delete - invalidate cache
async function updateUser(id, data) {
  await db.users.updateById(id, data);
  await redis.del(`user:${id}`);
}
```
Use consistent cache key naming conventions. Set appropriate TTLs — never cache indefinitely for user data. Consider cache stampede protection (use distributed lock on cache miss, or background refresh before expiry). For multi-node Redis, use Redis Cluster or Redis Sentinel for HA.


---

## 6. Security

### Core JD Questions

---

**Q1. OWASP Top 10 — awareness for a full-stack developer.**

**A:**

| # | Vulnerability | Prevention |
|---|---|---|
| A01 | **Broken Access Control** | Enforce auth/authz server-side on every request; test with unauthorised users |
| A02 | **Cryptographic Failures** | Use TLS 1.2+; never roll your own crypto; encrypt PII at rest; no MD5/SHA1 for passwords |
| A03 | **Injection (SQL, NoSQL, OS)** | Use parameterised queries / ORMs; never concatenate user input into queries |
| A04 | **Insecure Design** | Threat model during design; secure-by-default; defence in depth |
| A05 | **Security Misconfiguration** | Disable default accounts; remove unused endpoints; security headers; minimal permissions |
| A06 | **Vulnerable Components** | `npm audit`, Snyk in CI; keep dependencies updated; use dependabot |
| A07 | **Auth & Session Failures** | Strong passwords; MFA; short-lived JWTs; secure cookie flags; rate-limit login |
| A08 | **Software Integrity Failures** | Verify package integrity (lockfiles); use trusted registries |
| A09 | **Logging & Monitoring Failures** | Log security events; alert on anomalies; never log credentials |
| A10 | **SSRF** | Validate and allowlist URLs; block internal IP ranges; use network-level egress controls |

---

**Q2. How do you implement Role-Based Access Control (RBAC)?**

**A:**

**Conceptual model:**
- **User** → has one or more **Roles**
- **Role** → has one or more **Permissions**
- **Permission** → `action:resource` (e.g., `read:reports`, `delete:user`, `write:invoice`)

**Implementation pattern (Node.js + JWT):**
1. On login, include user roles in JWT: `{ sub: userId, roles: ['admin', 'editor'] }`
2. Middleware reads JWT, extracts roles, attaches to `req.user`
3. Route-level guard checks permissions:
```javascript
const requirePermission = (permission) => (req, res, next) => {
  if (!req.user?.permissions?.includes(permission)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

router.delete('/users/:id', requirePermission('delete:user'), deleteUserHandler);
```
4. Resource-level check (ownership): even if the user has `read:report`, check they own the specific report:
```javascript
const report = await Report.findById(req.params.id);
if (report.ownerId !== req.user.id && !req.user.roles.includes('admin')) {
  return res.status(403).json({ error: 'Forbidden' });
}
```
**Pitfalls:** Never check authorisation only on the frontend. Always enforce server-side.

---

**Q3. Secrets management in cloud environments.**

**A:**

**What NOT to do:**
- Hardcode secrets in code
- Store in `.env` files committed to git
- Pass via environment variables baked into Docker images

**What TO do:**
- **AWS Secrets Manager / Azure Key Vault:** Store and rotate secrets; applications retrieve them at runtime using IAM role permissions (no access key needed)
- **Kubernetes:** External Secrets Operator syncs from Secrets Manager / Key Vault into Kubernetes Secrets; never store raw secrets in Helm values or kustomize overlays in git
- **Docker/CI:** Inject secrets as environment variables from your secret store via CI/CD pipeline; never print them in logs (mask in CI settings)
- **Application level:** Load secrets into memory at startup, not from disk. Cache with a short TTL to support rotation. Use short-lived credentials (IAM roles, workload identity) over long-lived API keys wherever possible.

---

### 20 Additional Security Questions

---

**Q4. What is SQL injection and how do you prevent it?**

**A:** SQL injection occurs when user-supplied input is concatenated directly into a SQL query, allowing an attacker to modify the query logic.
```javascript
// VULNERABLE
const query = `SELECT * FROM users WHERE username = '${req.body.username}'`;

// Input: ' OR '1'='1
// Resulting query: SELECT * FROM users WHERE username = '' OR '1'='1'
// Returns ALL users

// SAFE — parameterised query
const query = 'SELECT * FROM users WHERE username = $1';
const result = await db.query(query, [req.body.username]);
```
Prevention: always use parameterised queries or prepared statements. ORMs abstract this correctly. Never build queries by string concatenation with user input. Apply the same principle to NoSQL (MongoDB: never pass unsanitised objects directly to `find()`).

---

**Q5. What is XSS (Cross-Site Scripting) and how do you prevent it?**

**A:** XSS occurs when an attacker injects malicious scripts into web pages viewed by other users. Types:
- **Reflected:** Script in URL; server echoes it in response
- **Stored:** Script saved to DB; served to all users who view that content
- **DOM-based:** JavaScript reads from URL/storage and writes unsafe HTML

Prevention:
- **Output encoding:** React does this by default (JSX escapes); use `textContent` not `innerHTML`; never use `dangerouslySetInnerHTML` with user data
- **Content Security Policy (CSP):** HTTP header restricting what scripts can execute (`Content-Security-Policy: default-src 'self'`)
- **Input sanitisation:** For rich text (CKEditor content), use `DOMPurify` server-side before storing
- **HttpOnly cookies:** Prevent JavaScript from reading session cookies

---

**Q6. What is CSRF and how do you prevent it?**

**A:** CSRF (Cross-Site Request Forgery) tricks a logged-in user's browser into making an unintended authenticated request to your server (e.g., submitting a form from a malicious site that changes the victim's email).

Prevention:
- **SameSite cookie attribute:** `SameSite=Strict` or `SameSite=Lax` prevents the browser from sending cookies on cross-site requests — the most effective mitigation for cookie-based auth
- **CSRF tokens:** Server issues a random token per session; it must be included in every mutating request (form hidden field or custom header); attacker can't read the token so they can't include it
- **Custom headers:** For APIs using `Authorization: Bearer`, CSRF is not possible because attackers can't set custom headers cross-origin (CORS restriction)

---

**Q7. What is HTTPS and why is it not optional?**

**A:** HTTPS = HTTP + TLS. TLS provides: confidentiality (data is encrypted; man-in-the-middle can't read it), integrity (data can't be tampered in transit), and authentication (the certificate proves the server's identity). Without HTTPS: session tokens are visible on the network, enabling session hijacking; login credentials sent in clear text; attackers can inject code into responses.

Beyond encryption: set `Strict-Transport-Security` (HSTS) header to prevent protocol downgrade attacks. Redirect all HTTP traffic to HTTPS. Use TLS 1.2+ only — disable TLS 1.0/1.1 and weak cipher suites.

---

**Q8. How do you secure a Node.js application against common attacks?**

**A:**
- **Helmet.js:** Sets security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.) in one middleware
- **express-rate-limit:** Prevent brute force on login/API endpoints
- **Input validation (Zod/Joi):** Reject requests with invalid data at the boundary before any processing
- **SQL/NoSQL injection:** Parameterised queries, never raw user input in queries
- **Dependencies:** `npm audit --production` in CI; automate updates with Dependabot
- **Error messages:** Never expose stack traces or DB errors to clients; log them server-side only
- **CORS:** Whitelist specific origins; don't use `*` for authenticated endpoints
- **Secrets:** Never in code or committed files; use environment variables injected from secrets manager

---

**Q9. What is a Content Security Policy (CSP) and how do you write one?**

**A:** CSP is an HTTP response header that tells the browser which sources of content (scripts, styles, images, fonts, frames) are trusted. It prevents XSS by blocking inline scripts and third-party scripts not on the allowlist.
```
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' https://cdn.trusted.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.myapp.com;
  frame-ancestors 'none';
```
Start with `Content-Security-Policy-Report-Only` header in report mode — logs violations without blocking — to identify needed sources before enforcement. `frame-ancestors 'none'` is equivalent to `X-Frame-Options: DENY`.

---

**Q10. How do you protect API keys in a frontend application?**

**A:** You can't truly hide a secret in client-side code — any API key you embed will be visible to anyone who inspects the source or network traffic. The correct approach: never put secrets in the frontend. Instead:
- Proxy through your backend — the frontend calls your own API, your backend adds the secret header before forwarding to the third-party service
- Use frontend-safe public keys (publishable keys like Stripe's) which are designed to be public and restricted by domain
- For Mapbox, Google Maps, etc.: restrict the key by HTTP referrer (only your domain can use it) and by API type in the provider's console
- Use server-side rendering for pages that require secret API calls

---

**Q11. What is OAuth2 and how does PKCE work?**

**A:** OAuth2 is an authorisation framework. PKCE (Proof Key for Code Exchange) is an extension for public clients (SPAs, mobile apps) that can't keep a secret.

PKCE flow:
1. Client generates a random `code_verifier` and derives `code_challenge = base64url(sha256(code_verifier))`
2. Client sends `code_challenge` with the authorisation request
3. IDP stores `code_challenge`, returns `authorization_code`
4. Client exchanges `authorization_code` + original `code_verifier` for tokens
5. IDP hashes the verifier and checks it matches the stored challenge — proves the same client started the flow

This prevents authorisation code interception attacks (even if an attacker steals the `authorization_code`, they can't exchange it without the `code_verifier`).

---

**Q12. What are security headers and which ones should every web app have?**

**A:**

| Header | Purpose |
|---|---|
| `Strict-Transport-Security` | Force HTTPS; prevent downgrade to HTTP |
| `Content-Security-Policy` | Restrict content sources; prevent XSS |
| `X-Content-Type-Options: nosniff` | Prevent MIME-type sniffing |
| `X-Frame-Options: DENY` | Prevent clickjacking (or use CSP `frame-ancestors`) |
| `Referrer-Policy: strict-origin-when-cross-origin` | Limit referrer info leaked to third parties |
| `Permissions-Policy` | Disable browser features you don't use (microphone, camera, geolocation) |
| `Cache-Control: no-store` | For sensitive responses (auth, user data) — prevent caching |

Use `Helmet.js` in Node.js to apply all of these with sensible defaults in one line.

---

**Q13. What is Server-Side Request Forgery (SSRF) and how do you prevent it?**

**A:** SSRF occurs when an attacker can make your server issue HTTP requests to arbitrary URLs — including internal services, cloud metadata endpoints (`http://169.254.169.254/latest/meta-data/` on AWS), and local services not exposed publicly. Example: webhook or URL-fetching features where the user supplies the URL.

Prevention:
- Validate and **allowlist** the schema (only `https://`) and domain (only specific external domains)
- Block requests to private IP ranges (RFC 1918: 10.x, 172.16.x, 192.168.x) and link-local (169.254.x)
- Use network-level egress controls — NAT gateway with restrictive security group rules
- Don't follow redirects, or validate after redirect resolution
- Use dedicated libraries like `ssrf-filter` (Node.js)

---

**Q14. How do you securely store passwords?**

**A:** Never store plaintext passwords. Use a slow, salted hashing algorithm designed for passwords:
- **bcrypt:** Work factor (cost) parameter makes it slow to brute-force; built-in salt. Default choice for most apps. `bcrypt.hash(password, 12)` in Node.js.
- **Argon2id:** OWASP's current recommendation; winner of the Password Hashing Competition; memory-hard (resists GPU-based attacks).

**Never use:** MD5, SHA1, SHA256 — too fast for password hashing; rainbow tables and GPUs can crack them in seconds.

Add a site-wide **pepper** (a secret value stored outside the DB) in addition to the per-user salt for defence-in-depth.

---

**Q15. What is rate limiting and how do you implement it to prevent abuse?**

**A:** Rate limiting restricts how many requests a client can make in a time window.

Implementation strategies:
- **Fixed window:** Count requests per key in a fixed minute window. Simple but susceptible to burst at window boundary.
- **Sliding window:** Count requests in a rolling window — fairer distribution.
- **Token bucket:** Tokens added at a fixed rate; each request consumes a token. Allows bursts up to bucket size.

In Node.js with Redis:
```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP
  store: new RedisStore({ client: redisClient }),
  message: 'Too many login attempts'
}));
```
Apply tighter limits to sensitive endpoints (login, password reset, OTP) than general API endpoints.

---

**Q16. What is the principle of least privilege in the context of cloud applications?**

**A:** Every identity (user, service, Lambda, EC2 instance) should have only the permissions required to do its job — no more. In practice:
- IAM roles instead of root/admin credentials for any automated task
- Service-specific roles: the API service role can read S3 but not delete; the backup job can write to S3 but not read user data
- Avoid `*` resources in IAM policies — specify exact ARNs
- Regularly audit and remove unused permissions (AWS Access Advisor shows last-used dates)
- For humans: temporary elevated access via JIT (Just-In-Time) tools like AWS IAM Identity Center session policies, rather than permanent admin roles

---

**Q17. How do you implement audit logging for compliance?**

**A:** Audit logs record who did what to which resource and when. Requirements:
- Log: `timestamp`, `userId`, `action`, `resource_type`, `resource_id`, `before/after values`, `IP address`, `outcome`
- Write to an **append-only** destination (CloudTrail, a separate DB table with no DELETE permission for the app, WORM storage on S3)
- Do NOT allow the application to modify or delete audit logs — separate write-only log sink
- Protect audit logs with separate access controls — even admins shouldn't be able to delete them
- Retain per compliance requirements (SOC2, HIPAA, PCI-DSS have specific periods)
- Alert on suspicious patterns: multiple failures, unusual access hours, high-volume data exports

---

**Q18. What is a WAF (Web Application Firewall) and when do you use it?**

**A:** A WAF inspects HTTP(S) traffic and blocks requests matching known attack patterns (SQLi, XSS, LFI, scanner signatures, bot traffic). Examples: AWS WAF, Azure Front Door WAF, Cloudflare WAF. Deploy in front of your API Gateway or ALB. Use managed rule sets (AWS Managed Rules, OWASP Core Rule Set) that are kept updated by the provider. Supplement your application's input validation — not a replacement. Set to `COUNT` mode first to observe what would be blocked before switching to `BLOCK` to avoid false positives.

---

**Q19. What is penetration testing and how does it fit into a SDLC?**

**A:** Penetration testing is an authorised simulated attack on your system to find exploitable vulnerabilities before real attackers do. Types:
- **DAST (Dynamic Application Security Testing):** Tools like OWASP ZAP, Burp Suite scan a running application
- **SAST (Static Application Security Testing):** Analyse source code for patterns (SonarQube, Semgrep, CodeQL)
- **Manual pen test:** Human tester attempts to exploit the system — higher quality findings

In SDLC: SAST in CI/CD (every PR), DAST on staging regularly, manual pen test before major releases or at least annually. Treat findings as bugs — track in your issue tracker, prioritise by CVSS score.

---

**Q20. How do you handle authentication in a microservices architecture?**

**A:** Two main patterns:
- **Validate at each service:** Each microservice independently validates the JWT (checks signature, expiry, claims). No single point of trust failure; gateway outage doesn't affect internal auth. Every service needs access to the JWK endpoint.
- **Validate at the gateway:** API Gateway validates the token and passes user claims in trusted headers (e.g., `X-User-ID`, `X-User-Roles`) to downstream services. Internal services trust the gateway headers. Simpler for services, but all auth bypasses the gateway if someone can reach internal services directly.

In Kubernetes: use network policies to ensure internal services can only be reached through the gateway, then gateway-level validation is safe.

---

**Q21. What is input validation vs sanitisation — what is the difference?**

**A:**
- **Validation:** Checking that input conforms to expected format, type, length, range. Reject invalid input with a `400 Bad Request` and informative error. Use Zod, Joi, express-validator.
- **Sanitisation:** Transforming input to remove or escape potentially dangerous content (e.g., stripping HTML tags, encoding special characters). Use after validation if you need to store/render user-supplied content.

Always validate at system boundaries (API entry points) — never trust client data. Validation should be the first thing a handler does. Sanitise for the specific context: SQL context (parameterised queries), HTML context (DOMPurify), file system context (path normalisation + allowlist).

---

**Q22. What is Zero Trust security and how does it apply to microservices?**

**A:** Zero Trust means "never trust, always verify" — no implicit trust based on network location (even inside the firewall). Every request must be authenticated and authorised regardless of where it originates. Applied to microservices:
- **mTLS (mutual TLS):** Both client and server present certificates; every service-to-service call is authenticated at the transport layer. A service mesh (Istio) handles this transparently.
- **Service accounts:** Each microservice has its own identity (Kubernetes ServiceAccount); access policies specify exactly which services can call which endpoints
- **No hardcoded trust:** A compromised pod on the internal network shouldn't be able to call any arbitrary service
- **Minimum network exposure:** NetworkPolicies in Kubernetes allow only defined pod-to-pod communication paths


---

## 7. Managerial & Behavioral

### Core JD Questions

---

**Q1. How do you handle conflicting requirements from a client?**

**A:** This is about structured communication and managing expectations.

**Approach:**
1. **Acknowledge and understand:** Before forming an opinion, fully understand both requirements and why the client considers each important. Ask: "Can you help me understand the business outcome you're driving with each?"
2. **Clarify the conflict:** Sometimes conflicting requirements aren't actually conflicting — they appear so due to differing assumptions or terminology. Make the conflict explicit: "Requirement A says real-time updates; Requirement B says all changes must be reviewed before going live — these appear to be in tension."
3. **Quantify trade-offs:** Present options with concrete trade-offs: "If we prioritise real-time, here's what we gain and what we lose. If we prioritise review workflows, here's the reverse."
4. **Bring data:** Stakeholder preferences without data are just opinions. Bring estimates, prototypes, or benchmarks to anchor the conversation.
5. **Escalate when necessary:** If the conflict is between two equally authoritative stakeholders and you can't resolve it at your level, surface it to decision-makers with a clear problem statement and your recommendation.
6. **Document the decision:** Once resolved, document what was decided, who decided it, and what was deprioritised — prevents revisiting the same debate and sets scope expectations.

---

**Q2. How do you mentor a junior dev struggling with performance issues?**

**A:**
1. **Diagnose together:** Don't hand them the answer. Sit alongside them and walk through the problem: "Where would you look first? What does the profiler show?" Guide the methodology.
2. **Teach the tools:** Show them how to use the Chrome DevTools Performance tab, Node.js `--prof`, `EXPLAIN ANALYZE`, or React DevTools Profiler. The skill transfers beyond the specific issue.
3. **Ask questions, don't lecture:** "What do you think the bottleneck is? Why?" Forces them to think, not passively receive.
4. **Small, deliberate improvements:** Have them make one change, measure the impact, then iterate. This builds intuition about cause-effect.
5. **Code review their solution:** Review their fix thoroughly — check if they solved the symptom or the root cause.
6. **Positive framing:** Performance work is detective work — frame it as interesting, not as them having done something wrong. Confidence matters.

---

**Q3. You have 2 weeks but 4 weeks of work — how do you prioritise?**

**A:** This is a scope management and stakeholder communication question.

**Framework — MoSCoW:**
1. **Must have:** Features without which the delivery has no value. Ship these.
2. **Should have:** Important but not critical. Include if time permits.
3. **Could have / Nice-to-have:** Defer to the next iteration.
4. **Won't have (this release):** Explicitly descoped and documented.

**Process:**
- Collaborate with the product owner to agree on the must-haves — don't decide alone
- Communicate early: "We have confirmed scope for 2 weeks; here's what I'll deliver, here's what moves to the next release" — no surprises at the deadline
- Consider effort-to-value ratio: sometimes a 20% effort item delivers 80% of business value
- Document deferred items with context so whoever picks them up later has full background

---

**Q4. How would you estimate effort for a new integration feature?**

**A:** 
**Steps:**
1. **Break it down (WBS):** Decompose into tasks: discovery/spike, API contract agreement, auth implementation, data mapping, error handling, retry logic, tests, documentation.
2. **Three-point estimation:** For each task: optimistic, most-likely, pessimistic. Use PERT formula: `(O + 4M + P) / 6`
3. **Account for unknowns:** Add a buffer (10–20% for known-unknowns; more for first-time integrations with unfamiliar systems). Integrations are notorious for hidden complexity — incomplete documentation, undocumented rate limits, auth edge cases.
4. **Include non-coding time:** Code reviews, QA testing cycles, deployment, stakeholder demos, bug fixes.
5. **Set review gates:** Share the estimate with a peer for sanity check before committing.
6. **Commit ranges, not points:** "3–5 days" is more honest than "4 days" and reflects real uncertainty. Set the expectation that the estimate refines after the discovery spike.

---

**Q5. Tell me about a production issue you caused and how you resolved it.**

**A (example structured response using STAR):**

**Situation:** We launched a feature that added a new compound index to a high-traffic MongoDB collection in a CI/CD pipeline. The migration ran automatically on deployment to production.

**Task:** The index build time was not accounted for — MongoDB was building the index in the foreground (locking the collection) during peak traffic.

**Action:**
- Detected the issue within 3 minutes via Grafana dashboard showing query latency spike
- Immediate mitigation: rolled back the deployment to remove the migration step; queried latency returned to normal within 2 minutes
- Root cause analysis: the index creation was not using `{ background: true }` (MongoDB 4.0) and ran in a period of peak load
- Fix: Re-ran the index creation during off-peak hours in background mode; added a `waitForIndexBuild` check in the migration script
- Post-mortem: Updated our migration playbook to require background index creation for all collection-level operations, and added a deployment timing policy to exclude major migrations from peak-hours deploys

**Result:** Zero data loss; ~8 minutes of elevated latency for a fraction of users. Full SLA recovery in under 10 minutes. Migration playbook updated to prevent recurrence.

---

**Q6. How do you align frontend and backend teams on API contracts?**

**A:**
1. **Contract-first design:** Before any implementation, agree on the API contract (OpenAPI spec). Both teams write/review the spec together before coding begins.
2. **Consumer-driven contract testing (CDC):** Frontend teams define the shape of responses they need (using Pact); backend API must satisfy those contracts. Tests fail in CI if the backend breaks a consumer's expectations.
3. **Shared schema types:** In a TypeScript monorepo, share request/response type definitions between frontend and backend so type mismatches are compile-time errors, not runtime bugs.
4. **Change process:** Propose API contract changes as PRs to the spec; tag both teams for review. Breaking changes require a versioning plan.
5. **Mocking:** Frontend works against a mock server (MSW, Prism) while the backend is in development — parallel development without blocking.

---

### 20 Additional Managerial & Behavioral Questions

---

**Q7. How do you handle a situation where a team member is consistently missing deadlines?**

**A:** Address it directly and early — don't let it become a pattern or affect the whole team's delivery.

1. **Private conversation first:** "I've noticed the last three tasks have run over schedule. Can you walk me through what's been happening?" — seek to understand before judging. There may be a blocker, a skill gap, or a personal issue.
2. **Root cause:** Is it a workload problem? Unclear requirements? Technical complexity they're not sharing? Or time management?
3. **Concrete plan:** Agree on smaller tasks with intermediate check-in points rather than one large deadline. This surfaces blockers early.
4. **Escalate if pattern continues:** After two coaching cycles without improvement, involve the engineering manager.
5. **Document your conversations:** Not for punitive purposes, but so there's a record of support offered if escalation becomes necessary.

---

**Q8. Describe how you handle on-call and production incidents.**

**A:**
- **Detection:** Monitoring alerts (PagerDuty/Opsgenie) page me; I acknowledge within 5 minutes
- **Assessment:** Is the service down? Is data being corrupted? What's the blast radius? Severity determines urgency.
- **Communication:** Immediately post status in the incident Slack channel: "Investigating latency spike on checkout service, started [time]." Keep stakeholders updated every 10–15 minutes.
- **Mitigation first, root cause later:** Roll back the last deployment, scale up, enable a circuit breaker — restore service quickly. Deep investigation can wait.
- **Post-incident:** After the fire is out, write a blameless post-mortem: timeline, contributing factors, impact, action items with owners and due dates. Post-mortems are for learning, not blame.

---

**Q9. How do you introduce a new technology to the team?**

**A:**
1. **Justify the need:** Don't introduce it because it's trendy. Document what problem it solves and why existing tools don't solve it adequately.
2. **Proof of concept on a non-critical path:** Build a spike in a branch to validate assumptions before advocating the switch.
3. **Team buy-in:** Present the findings to the team; invite critique. The best approach often emerges from the discussion.
4. **Documented decision (ADR — Architecture Decision Record):** Record the decision, alternatives considered, and the rationale. Future team members will benefit.
5. **Runbook + training:** New tech adoption fails when only the champion understands it. Pair program with teammates, write docs, do a team demo.
6. **Gradual rollout:** Use it on one service/feature first; expand after the team has gained confidence.

---

**Q10. How do you ensure code quality in your team?**

**A:**
- **Coding standards:** ESLint/Prettier configuration in the repo; enforced in CI so linting issues never reach review.
- **Code reviews:** Every PR reviewed by at least one other engineer. Reviews focus on correctness, clarity, security, and maintainability — not style (that's automatable).
- **Testing requirements:** PRs must include tests for new behaviour; code coverage is a guide, not a strict gate (focus on critical path coverage).
- **Definition of Done:** A shared checklist (tested, linted, documented, reviewed, monitored) that PRs must satisfy before merge.
- **Lead by example:** Quality standards are set by what you demonstrate and what you let pass in reviews — not by what you tell people to do.

---

**Q11. What is your approach to technical debt?**

**A:** Technical debt is a deliberate or accidental trade-off between short-term delivery speed and long-term maintainability. Approach:
- **Make it visible:** Track technical debt items in the backlog, not just in developers' heads. Label them. Estimate their cost.
- **Categorise:** Intentional debt (accepted consciously for a release deadline) vs. accidental debt (discovered later). Both are valid; neither should be ignored.
- **Allocate time:** Reserve a portion of each sprint (10–20%) for debt reduction. Don't let it accumulate until it becomes an emergency.
- **Prioritise by impact:** Debt in hot paths (payment flow, auth) costs more than debt in rarely-touched admin screens.
- **Business framing:** "This module needs a rewrite" doesn't get prioritised. "This module causes 40% of production incidents and the refactor would take 2 sprints" does.

---

**Q12. How do you handle a stakeholder asking for a feature that you believe is a bad idea technically?**

**A:**
1. **Listen fully first** — understand the business need driving the request, not just the proposed solution.
2. **Separate the what from the how:** The stakeholder defines the business goal; the engineering team designs the solution. Sometimes you can satisfy the goal with a better technical approach.
3. **Present trade-offs clearly:** "This approach works but has these risks/costs. An alternative would be X — here's why I'd recommend it."
4. **Defer with data:** Build a proof of concept if the disagreement is about feasibility. Data wins arguments.
5. **Disagree and commit:** If the stakeholder understands the trade-offs and still decides to proceed, support the decision professionally. Document your concern and the decision made.
6. **Avoid "that's technically impossible"** — nearly everything is possible; it's a question of cost, time, and risk.

---

**Q13. How do you onboard a new team member efficiently?**

**A:**
- **Pre-boarding:** Send system access requests, repo access, and welcome docs before day one — no wasted time on arrival.
- **First week:** Pair them with a buddy (experienced team member). No solo tasks in week one — observe, ask questions, run the app locally.
- **First task:** Pick a well-defined, low-risk task with a clear acceptance criteria. Success builds confidence.
- **Documented onboarding checklist:** Dev environment setup, coding conventions, deployment process, team norms, who to ask about what.
- **Regular check-ins:** 30/60/90-day structured conversations about what's going well, what's confusing, and what they'd like to learn.
- **Psychological safety:** Explicitly say "there are no stupid questions here" — new team members who can ask freely ramp up faster.

---

**Q14. Describe your approach to giving and receiving code review feedback.**

**A:**
**Giving:**
- Be specific ("This query will do a full table scan on large datasets because there's no index on `status`") not vague ("This is slow")
- Ask questions rather than decree ("Have you considered using a partial index here?")
- Separate blocking from non-blocking: mark suggestions as `nit:` to indicate they're optional
- Acknowledge what's done well — reviews shouldn't only surface problems
- Review for correctness and security — not personal preferences (use linting for that)

**Receiving:**
- Assume positive intent — reviewer is trying to improve the code, not criticise you
- Ask for clarification if feedback is unclear before defending
- Don't take it personally — the code is being reviewed, not you
- Acknowledge good points quickly; push back politely on points you disagree with, with reasoning
- Update the PR with a brief summary of what you changed and what you didn't and why

---

**Q15. How do you manage multiple priorities when everything is "urgent"?**

**A:**
1. **Challenge the urgency:** Are all things genuinely urgent, or have they been labelled that way to jump the queue? Ask: "What breaks if this waits 24 hours?"
2. **Eisenhower Matrix:** Urgent + Important → Do now. Important + Not urgent → Schedule. Urgent + Not important → Delegate. Neither → Drop.
3. **Communicate proactively:** When you take on a new urgent item, explicitly tell the requestors of the other items: "I'm reprioritising to X. Y will slip from Thursday to Friday — is that okay?"
4. **One thing at a time:** Context-switching is expensive for engineering work. Complete a task before starting the next.
5. **Protect deep work time:** Block focused engineering time on your calendar; handle interruptions in designated slots.

---

**Q16. Tell me about a time you had to deliver bad news to a client or stakeholder.**

**A (structure — use STAR format):**
**Approach regardless of specifics:**
- Deliver it early — bad news that ages is worse news
- Own it: don't deflect blame to teammates or external factors even if they contributed
- Come with context: "We discovered X, which means Y is not possible in the original timeframe"
- Come with options: never just the problem — bring what you can still deliver, the revised timeline, or an alternative approach
- Follow up in writing after the conversation — a verbal "understood" can diverge in memory over time

---

**Q17. How do you ensure your team follows security best practices?**

**A:**
- Security is in the Definition of Done, not bolted on at the end
- Run SAST tools (Snyk, CodeQL, Semgrep) in the CI pipeline — security issues block merge
- Run `npm audit` and dependency checks as a pipeline step
- Include security checks in code review — watch for SQL injection, hardcoded secrets, missing auth checks
- Regular threat modelling sessions for new features with significant attack surface
- Lunch-and-learn sessions on common vulnerabilities (OWASP Top 10) — education is the foundation
- Rotate security champion role among the team — everyone builds security awareness, not just "the security person"

---

**Q18. How do you stay current with rapidly evolving technology?**

**A:**
- **Curated sources:** Follow specific engineers and orgs on X/LinkedIn, not algorithmic feeds. Engineering blogs (Stripe, Cloudflare, Netflix Tech Blog) for depth.
- **Newsletters:** bytes.dev (JS), This Week in React, DevOps Weekly, TLDR Tech — skimmable, high signal
- **Build small projects:** Reading about technology is shallow; building something forces understanding of trade-offs
- **Conferences/meetups:** JSConf, KubeCon, re:Invent — talks, and importantly the hallway track conversations
- **Deliberate learning vs. FOMO:** Not every new technology is worth learning. Evaluate: "Does this solve a real problem I have, or is it just new?"
- **Share with the team:** What you learn, you reinforce by teaching. Present a tech on a team call after exploring it.

---

**Q19. How do you handle disagreement within the engineering team about a technical approach?**

**A:**
1. **Get both sides at the table:** Private venting doesn't resolve technical disagreements. Have a structured discussion with both advocates present.
2. **Define the evaluation criteria first:** What matters? Performance? Developer experience? Operational simplicity? Prior team familiarity? Agree on these criteria before arguing positions.
3. **Time-box the discussion:** Endless debate is expensive. Set a timeframe (e.g., 1 week PoC from each side) and a decision date.
4. **Make a decision:** Someone (tech lead / architect) owns the decision. Consensus is ideal but not always achievable — avoid deadlock. Document the decision with the ADR.
5. **Commit as a team:** Once decided, the whole team supports the chosen approach. "I disagreed but I'm on board" is professional; "I told you so" when it struggles is not.

---

**Q20. What does a good sprint planning meeting look like to you?**

**A:** Pre-requisites: backlog is groomed (stories are estimated, acceptance criteria are clear, dependencies noted). During planning:
- Product owner presents the goal for the sprint — the *why* before the *what*
- Team pulls stories from the top of the backlog, confirms understanding of each, and commits to what they can deliver given velocity and capacity
- Stories are broken into tasks; each task should be completable in 1–2 days (reveals hidden complexity early)
- Dependencies and risks are surfaced, not buried
- Outcome: a realistic sprint goal with team buy-in, not a list of tasks assigned top-down. The team should feel ownership over the commitment.

---

**Q21. How do you handle a deployment that goes wrong in production?**

**A:**
1. **Assess impact immediately:** Is it a complete outage or degraded functionality? Who's affected?
2. **Rollback first:** If a deployment caused the issue, rolling back is the fastest mitigation. Don't try to fix forward under pressure unless rollback itself is risky.
3. **Communicate:** Stakeholders need a status update within minutes — even if the update is "we're investigating"
4. **RCA after recovery:** Don't start root cause analysis while the service is still down. Restore, then investigate.
5. **No-blame culture:** Identify what in the process allowed the issue to reach production — better tests, staging parity, canary deploys — not who wrote the bug.

---

**Q22. How do you balance speed and quality when under deadline pressure?**

**A:**
- **Never skip tests on critical paths:** Tests on auth, payment, data integrity are not optional regardless of deadline. Bugs there are more expensive than the deadline.
- **Skip tests on non-critical paths:** Decide consciously and log it as technical debt.
- **Communicate the trade-off:** "We can ship on Friday if we skip e2e tests on the admin dashboard. The admin dashboard is low-traffic but there's a risk of issues post-deploy. Alternatively, we ship Monday with full test coverage. Your call." Let stakeholders make the risk decision.
- **Feature flags:** Ship the feature behind a flag — deploy to production but only visible to internal/beta users until fully validated. Decouples deployment from public release.

---

**Q23. How do you ensure knowledge sharing in the team so you avoid hero developers?**

**A:**
- **No single-person ownership of critical modules:** All critical systems must have at least two people who understand them deeply
- **Pair programming / mob programming on complex features:** Knowledge transfer happens naturally
- **Documentation as a team norm:** README, runbooks, ADRs, and API docs are delivery requirements, not optional extras
- **Bus factor reviews:** Identify areas where only one person can handle incidents. Proactively run pairing sessions to transfer knowledge.
- **Tech talks / demos:** Team members present solutions/learnings to the group monthly
- **Rotate on-call:** Everyone handles on-call, not just the "ops-minded" people — builds broad system understanding

---

**Q24. Tell me about a time you proactively identified a risk in a project.**

**A (use STAR structure in your actual response):**
**What interviewers are assessing:**
- Whether you think beyond your assigned ticket
- Whether you communicate risks early vs. silently watching problems grow
- Whether you can back up a risk with evidence and a recommendation, not just a vague concern

**Key elements to include:**
- Specific observable signal that triggered your concern (performance test results, reading the third-party API docs, noticing a dependency version)
- Who you raised it to and how (not just "I mentioned it once")
- What action was taken as a result
- What would have happened if you hadn't raised it


---

## 8. Scenario-Based Questions

### Core JD Questions

---

**Q1. "We need to integrate our app with Salesforce/SAP/a payment gateway — walk me through your approach."**

**A:**

**Phase 1 — Discovery (2–3 days)**
- Read the official API documentation end-to-end before writing a line of code. Identify: authentication mechanism (OAuth2, API key, client certificate), rate limits, webhook support, sandbox environment availability, known quirks/limitations.
- Evaluate whether there's a maintained Node.js SDK — if so, use it; don't reinvent auth and retry logic.
- For Salesforce: review Connected App config, understand the OAuth2 flow (JWT Bearer for server-to-server), field mapping between your data model and Salesforce objects.
- For payment gateways (Stripe, Braintree): understand PCI-DSS requirements — in modern gateway integrations, your server never touches raw card data; the gateway's JS SDK tokenises on the client and sends a token to your server.

**Phase 2 — Design**
- Create an **integration layer** (adapter pattern) — an isolated module/service that owns all interaction with the external system. Your domain code should not know it's talking to Salesforce specifically.
- Define the data contract: what fields map to what. Centralise the mapping logic in the adapter — don't scatter it across the codebase.
- Design for failures: the external system will go down. Your integration needs: retry with exponential backoff, circuit breaker, a DLQ for failed operations that need manual inspection.
- Store integration state (last sync time, IDs of synced records) in your DB for idempotent re-runs.

**Phase 3 — Implementation & Testing**
- Develop against the sandbox. Write integration tests that run against the sandbox in CI.
- Test failure scenarios explicitly: what happens when the external API returns 429, 500, 401 (token expired)?
- Implement **idempotency**: use the external ID to prevent creating duplicate records on retry.

**Phase 4 — Operational Readiness**
- Structured logs for every external API call: duration, status code, correlation ID.
- Alerts on error rate spike for the integration.
- Runbook: what to do when the integration is failing (how to pause it, how to re-sync, who to contact at the vendor).

---

**Q2. "How would you migrate a monolith to microservices without downtime?"**

**A:**

**Strategy: Strangler Fig Pattern — incremental extraction**

**Step 1 — Understand the monolith**
- Map bounded contexts (user management, billing, notifications, inventory). These become service candidates.
- Identify heavily used vs. rarely changed modules. Start with the right candidate, not the biggest or most complex.

**Step 2 — Introduce a routing layer**
- Put an API Gateway or reverse proxy in front of the monolith. All traffic still goes through the monolith for now. This is the future routing point — no functional change yet.

**Step 3 — Extract the first service (low-risk bounded context)**
- Build the new service alongside the monolith. Both read from the same database initially (acceptable short-term for read paths).
- Route traffic for that domain to the new service via the gateway.
- Run both in parallel briefly (dark launch): new service receives shadowed traffic; its responses are compared to the monolith's but not returned to the client.
- Verify parity → cut over.

**Step 4 — Data separation**
- The new service should own its data. Migrate the schema — use an intermediate event sync while both run, then cut the data feed.
- This is the hardest step — don't rush it.

**Step 5 — Repeat**
- Extract the next bounded context. With each extraction, the monolith shrinks.

**Key rules:**
- Never a big-bang rewrite. Always have a rollback path (re-route gateway back to monolith).
- Deployment and service communication infrastructure (Docker, Kubernetes, service discovery, CI/CD per service) must be ready before you start extracting.

---

**Q3. "A client reports their dashboard is slow — how do you debug and fix it end-to-end?"**

**A:**

**Structured debugging — work from the top down:**

**1. Reproduce and measure (5 min)**
- Ask: slow for all users or specific users? All dashboards or specific ones? Always or intermittently?
- Open Chrome DevTools → Network tab → hard refresh. Note: total load time, TTFB, largest resource, waterfall bottlenecks.
- Use Lighthouse to get CWV metrics.

**2. Identify the layer (Frontend / Network / Backend / Database)**

*If TTFB is slow (>500ms):* The problem is server-side.
- Check APM (Datadog, New Relic) or server logs for the dashboard API endpoint response time.
- If slow: check database query time, cache hit rate, N+1 queries in query logs.

*If TTFB is fast but page loads slow:* The problem is frontend.
- Check bundle size (is a large library being loaded for this page?).
- Check waterfall: are there sequential API calls that could be parallelised?
- Check render time: React DevTools Profiler — any expensive component re-renders?

**3. Fix (based on findings)**

| Finding | Fix |
|---|---|
| Slow DB query | Add index, rewrite query, use EXPLAIN to find full scans |
| N+1 queries | Use JOIN/eager loading, or DataLoader if GraphQL |
| Large JS bundle | Code split the chart library, lazy load on this route only |
| Sequential API calls | Parallelise with Promise.all or create an aggregation endpoint |
| Missing caching | Add Redis cache for dashboard aggregate data with 60s TTL |
| Missing pagination | Dashboard loads 5,000 rows — implement server-side pagination |

**4. Validate**
- Measure again after each fix — never apply multiple fixes at once; you won't know which helped.
- Check in production with real data (staging rarely replicates production data volume).

**5. Prevent recurrence**
- Add a budget alert for the dashboard API endpoint (alert if p95 > 300ms).
- Add a Lighthouse CI check in the pipeline for this page.

---

### 20 Additional Scenario-Based Questions

---

**Q4. "A critical bug is found in production 30 minutes before a major client demo. What do you do?"**

**A:**
1. **Assess severity:** Does it directly affect the demo flow? If yes — severity 1. If it's in a peripheral feature — continue and log the bug.
2. **Decide fast:** Rollback to previous release (if the bug was introduced in a recent deploy) or apply a feature flag to disable the broken feature for the demo.
3. **Communication:** Immediately notify the relevant stakeholders (account manager, client success) so they can stall or adjust the demo agenda if needed.
4. **Don't hotfix under pressure:** Rushed fixes introduce new bugs. Prefer rollback or disabling the feature.
5. **Post-demo:** Full root cause analysis, proper fix, regression test.

---

**Q5. "The team is unable to agree on a technology for a new project. How do you break the deadlock?"**

**A:** Run a structured technical evaluation: define the decision criteria (performance, team familiarity, community support, cost, deployment complexity), have each advocate evaluate each option against the criteria, use a weighted score matrix. Time-box: no more than 1 week of evaluation with a PoC. The decision owner (tech lead / architect) makes the final call using the data. Document the decision in an ADR. If the stakes are high and the team is split 50/50, use a reversible decision — pick the one with the easier exit strategy.

---

**Q6. "You discover a security vulnerability in production code that's been live for 6 months. What do you do?"**

**A:**
1. **Severity assessment:** Can the vulnerability be exploited remotely? What data is at risk? Is there any evidence of exploitation in the logs?
2. **Contain first:** If actively exploitable, deploy a WAF rule or feature flag to block the vulnerable endpoint while building the fix.
3. **Notify:** Depending on severity and compliance requirements (GDPR, HIPAA), you may have a legal obligation to notify users and/or regulators within a specific timeframe.
4. **Fix and deploy:** Build a proper fix, test it, deploy with expedited review (security fixes should have an emergency deployment path).
5. **Incident report:** Document what was vulnerable, since when, who was potentially affected, what was done, and what prevents recurrence.
6. **Don't hide it:** Concealing a known breach compounds the legal and reputational damage.

---

**Q7. "You need to scale from 100 users to 100,000 users in 3 months. What's your plan?"**

**A:**
1. **Measure current bottlenecks:** Load test the current system to find where it breaks (API layer? DB? cache?). Profile before guessing.
2. **Quick wins (Week 1–2):** Add caching (Redis) for expensive reads; add DB read replicas; optimise the top 5 slowest queries; ensure DB connection pooling is correctly configured.
3. **Infrastructure scaling (Week 2–4):** Move to horizontal scaling for API servers (Docker + Kubernetes or autoscaling ECS/EC2); add CDN for static assets.
4. **Database scaling (Month 2):** Evaluate whether read replicas handle the load; consider partitioning hot tables; evaluate caching layer adequacy.
5. **Architecture changes (Month 2–3, if needed):** Extract high-load services (e.g., file uploads to async background processing); introduce message queue for async operations.
6. **Load test at each stage:** Validate improvements with realistic load tests (k6, Locust) before the traffic actually arrives.

---

**Q8. "A third-party API your system depends on is down. How do you handle it?"**

**A:**
- **Detect:** Monitoring alerts on error rate spike for calls to the third-party service. Structured logs with service name let you isolate quickly.
- **Circuit breaker trips:** After N failures, stop calling the service and fail fast with a clear error.
- **Graceful degradation:** What's the fallback? Return cached data (stale is better than nothing)? Disable the feature? Display a user-friendly message?
- **Queue for eventual processing:** If the third-party call is async (send notification, sync data), queue the failed operations for retry once the service recovers.
- **Communicate proactively:** If the outage affects user-facing features, post a status update (status page, in-app notification). Don't wait for users to report it.
- **Post-incident:** Review whether there's an alternative provider or whether a more robust fallback is needed.

---

**Q9. "You are asked to add a feature that requires storing sensitive PII. How do you approach it?"**

**A:**
1. **Do you really need it?** Challenge the requirement — sometimes businesses collect data out of habit, not necessity. Less data stored = less liability.
2. **Legal basis:** Confirm you have a legal basis to collect and process this data under GDPR/CCPA — consent, legitimate interest, or contract.
3. **Encryption at rest:** Encrypt PII fields in the database (column-level encryption or application-level encryption with keys in a KMS).
4. **Encryption in transit:** HTTPS always.
5. **Access control:** Only services/roles that need PII should access it. Log all access.
6. **Retention policy:** Define how long you keep PII and implement automated deletion/anonymisation after that period.
7. **Data minimisation:** Store only what's needed, not the full PII record.
8. **Audit trail:** Who accessed or modified PII, when, and why.

---

**Q10. "How do you handle a situation where your team is blocked waiting for another team?"**

**A:**
1. **Escalate early:** Don't wait a week before flagging. Raise the dependency in the daily stand-up immediately.
2. **Quantify the impact:** "We're blocked on Team X's API. This delays our sprint goal by 3 days."
3. **Unblock yourself where possible:** Can you build against a mock? Can you work on a different part of the story while waiting?
4. **Escalation path:** If the dependency isn't resolved via direct conversation with the other team, escalate to the respective team leads or a cross-team dependency forum.
5. **Plan B:** If the dependency is truly stuck, is there a simpler approach that avoids it? Sometimes a creative architecture change removes a blocker entirely.

---

**Q11. "You're joining a new project with messy, undocumented legacy code. How do you start?"**

**A:**
1. **Read → run → read:** Get the app running locally first. Reading code you can't run is harder.
2. **Trace a hotpath:** Pick the most critical user journey and trace it through the code. This is faster than reading every file sequentially.
3. **Write tests for existing behaviour:** Unit and integration tests for the critical paths. This creates a safety net for future changes AND deepens your understanding.
4. **Document as you go:** Write READMEs and inline comments as you learn. You're the last person who'll be as confused as you are now — leave breadcrumbs.
5. **Don't refactor immediately:** Resist the urge to clean everything up week one. Understand the system before changing it.
6. **Find the local expert:** There's usually someone who knows one piece very well. Ask targeted questions.

---

**Q12. "A key engineer on your team quits unexpectedly. How do you manage the impact?"**

**A:**
1. **Assess knowledge gaps:** What critical knowledge did they have? What systems are only they able to maintain?
2. **Immediate knowledge capture:** While the engineer is still in notice period, have focused sessions to document: runbooks, deployment processes, context on complex systems they owned.
3. **Redistribute carefully:** Don't overload the remaining team. Reprioritise the backlog — what can wait?
4. **Communicate to stakeholders:** Adjust timeline expectations where needed. Early communication is better than missed deadlines with no warning.
5. **Hiring pipeline:** Start the hiring process immediately — good hiring takes longer than expected.
6. **Post-mortem on knowledge concentration:** Why did one person own so much knowledge? Implement pairing and documentation practices to prevent recurrence.

---

**Q13. "How would you respond to a client asking for a 50% scope increase with no timeline change?"**

**A:** This is a scope management conversation, not a yes/no answer.
1. **Acknowledge the request:** "I understand you'd like to include [feature X]. That's a valuable addition."
2. **Quantify the impact:** "Our current estimate for [feature X] is [N] days. This would move the delivery date from [date A] to [date B] unless we reduce scope elsewhere."
3. **Offer options:** "We have three options: (1) extend the timeline; (2) add resources (if they'd be effective at this stage); (3) deprioritise [other feature Y] to accommodate this."
4. **Ask the business question:** "What's the business driver for having this in the first release vs. the next one?"
5. **Document the outcome** — whichever option is chosen.

---

**Q14. "How do you decide when to build vs. buy for a feature?"**

**A:** Framework:
- **Is it a core differentiator?** If it's your competitive advantage — build it. If it's a commodity — buy/use a service.
- **Build cost vs. SaaS cost over 3 years:** Include maintenance, infrastructure, and engineering time in the build cost, not just initial dev time.
- **Time-to-market:** Can you ship a SaaS integration in days vs. 3 months to build? What's the cost of the delay?
- **Compliance and control:** Some regulated industries can't send data to SaaS providers. Sometimes you must build.
- **Team expertise:** Can your team realistically build and maintain this (search engine, email infrastructure, video processing) or will quality suffer?

Example: "Build your own payment processing to save Stripe fees" is almost always wrong — PCI compliance alone would cost more than Stripe does.

---

**Q15. "How do you handle scope creep in an Agile project?"**

**A:**
- **Prevention:** Have a clear, written Definition of Done and acceptance criteria for each story before sprint starts. Scope creep enters when acceptance criteria are vague.
- **Detection:** Any new request mid-sprint that wasn't in the sprint planning is new scope — even if it "only takes 10 minutes."
- **Response:** "That's a great idea. Let me add it to the product backlog and we'll prioritise it in the next sprint." Don't absorb it silently.
- **Protect the sprint goal:** Mid-sprint changes should be the exception, not the norm. If a request is genuinely urgent enough to change the sprint, do a formal sprint scope change with the product owner, documenting what was dropped to accommodate the new item.

---

**Q16. "Walk me through how you would plan a major release."**

**A:**
1. **Feature freeze date:** Define the point at which no new features enter the release.
2. **QA window:** Block time for systematic QA — functional, regression, performance, security testing.
3. **Staging environment validation:** Full end-to-end test in staging with production-like data and traffic.
4. **Rollback plan:** Document how to roll back if something goes wrong. Test the rollback procedure.
5. **Communication plan:** Notify customers of any downtime/behaviour changes. Prepare a release blog post or changelog.
6. **Monitoring plan:** What metrics to watch in the first 30 minutes post-deploy. Who is on standby.
7. **Deployment runbook:** Step-by-step deployment instructions so any engineer can execute the deployment consistently.

---

**Q17. "How do you handle a situation where your architecture decision turned out to be wrong?"**

**A:**
1. **Acknowledge it quickly:** The longer you wait, the more technical debt compounds on top of a wrong decision.
2. **Quantify the impact:** "This decision is causing us X incidents per month / costs Y extra in infrastructure / blocks feature Z."
3. **Propose a migration path:** Document options to correct course and their costs. Present to the team.
4. **Blameless post-mortem:** What information was missing at decision time? What would have led to a better decision? (This is a process improvement, not blame assignment.)
5. **Update the ADR:** Record what was learned and the corrected approach.
6. **Move forward:** Don't dwell. The team that spots and corrects architectural mistakes is healthier than the team that doubles down to avoid admitting the mistake.

---

**Q18. "How do you build rapport with a difficult client?"**

**A:**
- **Understand their frustration:** Often a "difficult" client became difficult because their trust was broken by missed deliveries or miscommunications in the past. Understand the root before labelling them difficult.
- **Consistent, proactive communication:** Don't wait for them to ask for an update. Regular, predictable status updates reduce anxiety.
- **Honour small commitments:** Trust is built through consistent follow-through on small things before asking for trust on big things.
- **Face-to-face (video) over async for difficult conversations:** Tone is easily misread in text.
- **Empathy over defensiveness:** When they're frustrated, lead with acknowledgement ("I understand this is frustrating for your team") before jumping to solutions or explanations.

---

**Q19. "You're given ownership of a system that has been neglected — outdated dependencies, no tests, no docs. How do you proceed?"**

**A:**
1. **Stabilise first:** Get visibility — add basic logging, metrics, and alerting so you know when it's broken. You can't improve what you can't measure.
2. **Don't refactor without tests:** Write a test suite for current behaviour before touching anything. The tests define what "working" means.
3. **Update dependencies incrementally:** Don't update everything at once. Group minor and patch updates; treat major updates individually with testing.
4. **Document as you learn:** You'll never be as unfamiliar with the system as you are right now. Write the README and architecture doc for the person who comes after you.
5. **Prioritise high-risk areas:** Focus your effort on the parts of the system that are most likely to cause incidents — high traffic paths, payment flows, auth.
6. **Communicate the plan:** Let stakeholders know the system needs investment. Frame it in risk terms: "Without these improvements, we can't add features X and Y safely."

---

**Q20. "How would you design the technical onboarding for a client on your SaaS platform?"**

**A:** This tests both product thinking and technical depth.

**Onboarding steps:**
1. **API key / credentials provisioning:** Automated — instantly available after account creation. No manual ticket.
2. **Sandbox environment:** Fully functional, isolated environment for integration testing. Clear distinction between sandbox and production.
3. **Documentation:** Well-structured API reference (OpenAPI-based), getting-started guides, code examples in multiple languages.
4. **SDKs:** Official SDKs (Node.js, Python, Java) reduce integration friction.
5. **Webhooks:** Clear webhook event documentation, a webhook test tool in the dashboard to replay events.
6. **Dashboard:** Self-service portal where the client can see API usage, logs of events, manage API keys, and invite team members.
7. **Support:** In-context help (contextual docs embedded in the dashboard), chatbot for common questions, escalation path to engineering for complex issues.
8. **Monitoring:** Client-facing status page for the API; email alerts when their integration errors spike.

---

**Q21. "Two senior engineers on your team disagree on a critical architecture decision and it's becoming personal. How do you handle it?"**

**A:**
1. **Separate the people from the problem immediately:** Privately speak to each person. "I notice this is getting heated. I want us to resolve the technical question, not win an argument."
2. **Bring it back to data and criteria:** In a group session, reframe: "Let's agree on what we're optimising for. Then evaluate each approach against those criteria."
3. **Bring in a neutral third party:** An architect or senior engineer not involved in the debate can provide an objective view.
4. **Make the decision, document it, move on:** A delayed decision is often worse than an imperfect one. After the ADR is written, the team commits — no relitigating.
5. **Address the interpersonal dynamic separately:** The technical disagreement is resolved. The personal tension may not be. Address that 1:1 with each engineer — possibly with HR involvement if it's significantly affecting team health.


---

## 9. Java & Spring Boot Basics

> **Context:** The JD lists Java/Spring Boot. You may be asked even if Node.js is your primary. These answers focus on what a senior full-stack developer is expected to know — not deep Java internals.

---

**Q1. What is Spring Boot and how does it differ from the Spring Framework?**

**A:** The Spring Framework is a comprehensive Java application framework providing IoC (Inversion of Control), DI (Dependency Injection), AOP, data access abstractions, and more — but requires extensive XML or Java config. Spring Boot is an opinionated layer on top of Spring that provides: auto-configuration (sensible defaults based on classpath), embedded servers (Tomcat, Jetty — no WAR deployment needed), starter dependencies (one dependency includes all required transitive dependencies), Actuator (health/metrics endpoints). Spring Boot dramatically reduces boilerplate — a working REST API can be created in minutes.

---

**Q2. Explain Dependency Injection in Spring.**

**A:** Dependency Injection is when the framework provides dependencies to a class instead of the class creating them. In Spring: you annotate a class with `@Service`, `@Component`, or `@Repository`; Spring manages its lifecycle (Singleton by default). When another class needs it, Spring injects the instance:

```java
@RestController
public class UserController {
    private final UserService userService;

    // Constructor injection — preferred
    public UserController(UserService userService) {
        this.userService = userService;
    }
}
```
Constructor injection is preferred over field injection (`@Autowired` on a field) because: easier to test (can inject mock via constructor), dependencies are explicit, and immutability is possible with `final`.

---

**Q3. What is the difference between `@Controller` and `@RestController`?**

**A:** `@Controller` is a Spring MVC annotation that returns views (HTML templates via Thymeleaf, JSP). Methods return a view name, and the template engine processes it. `@RestController` = `@Controller` + `@ResponseBody` on every method — it serialises the return value directly to JSON/XML in the HTTP response body. For REST APIs, always use `@RestController`. If you need a method in a `@RestController` to return a view, explicitly annotate it with `@ResponseBody`.

---

**Q4. How does Spring Boot handle REST APIs?**

**A:**
```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        User user = userService.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return ResponseEntity.ok(user);
    }

    @PostMapping
    public ResponseEntity<User> createUser(@Valid @RequestBody CreateUserRequest request) {
        User created = userService.create(request);
        URI location = URI.create("/api/users/" + created.getId());
        return ResponseEntity.created(location).body(created);
    }
}
```
HTTP methods → `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`. `@Valid` triggers Bean Validation (JSR-380). `ResponseEntity` gives explicit control over status code and headers.

---

**Q5. What is JPA / Hibernate and how do you use it in Spring Boot?**

**A:** JPA (Jakarta Persistence API) is the standard ORM specification for Java. Hibernate is the most widely used JPA implementation. Spring Data JPA wraps Hibernate and provides repository interfaces:

```java
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private String email;
}

// Repository — zero boilerplate for CRUD
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    
    @Query("SELECT u FROM User u WHERE u.createdAt > :since")
    List<User> findRecentUsers(@Param("since") LocalDateTime since);
}
```
Spring Data generates the SQL at startup. Custom queries use JPQL (HQL) or native SQL. The `@Transactional` annotation wraps service methods in a database transaction.

---

**Q6. What is Spring Security and how do you secure a REST API with JWT?**

**A:** Spring Security handles authentication and authorisation for Spring applications. For JWT:

1. Add dependency: `spring-boot-starter-security` + JWT library (JJWT or Nimbus JOSE)
2. Disable session (stateless REST doesn't need HttpSession)
3. Add a filter that reads the `Authorization: Bearer` header, validates the JWT, and populates `SecurityContextHolder`
4. Configure route permissions:

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/auth/**").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/products/**").permitAll()
            .anyRequest().authenticated()
        )
        .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
        .build();
}
```

---

**Q7. What is `@Transactional` and when should you use it?**

**A:** `@Transactional` wraps a method in a database transaction — if the method throws an unchecked exception, the transaction rolls back. Apply at the service layer (not the repository or controller):

```java
@Service
public class OrderService {
    @Transactional
    public Order createOrder(CreateOrderRequest request) {
        Order order = orderRepository.save(new Order(request));
        inventoryService.reserve(request.getItems()); // Both or neither
        return order;
    }
}
```
Key attributes: `readOnly = true` for read-only transactions (performance hint to Hibernate), `propagation` controls what happens when a transactional method is called from another transactional method (REQUIRED = join existing; REQUIRES_NEW = always start new), `rollbackFor` to explicitly roll back on checked exceptions (Spring only rolls back on unchecked by default).

---

**Q8. How does Spring Boot's auto-configuration work?**

**A:** Spring Boot uses `@EnableAutoConfiguration` (included via `@SpringBootApplication`). At startup, it scans `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` in all jars on the classpath. For each autoconfiguration class, it evaluates `@ConditionalOnClass`, `@ConditionalOnMissingBean`, `@ConditionalOnProperty` annotations. For example, if `DataSource` is on the classpath and no `DataSource` bean is defined, Spring Boot auto-configures one using `spring.datasource.*` properties. You can override any auto-configured bean by defining your own `@Bean` of the same type.

---

**Q9. What is the difference between `@Bean`, `@Component`, `@Service`, `@Repository`?**

**A:** All four register a Spring-managed bean but differ in semantic meaning and features:
- `@Component`: Generic component. Base annotation.
- `@Service`: Marks a service class (business logic). Semantically distinct from `@Component`; no additional behaviour in base Spring but some AOP tools use it for targeting.
- `@Repository`: Marks a data access layer class. Spring automatically wraps it in a persistence exception translation proxy (converts JPA/JDBC exceptions to Spring's `DataAccessException` hierarchy).
- `@Bean`: Used in `@Configuration` classes to declare a bean manually. Useful for beans from third-party libraries you can't add `@Component` to.

---

**Q10. How do you handle exceptions globally in a Spring Boot REST API?**

**A:**
```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("NOT_FOUND", ex.getMessage()));
    }
    
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationErrors(
            MethodArgumentNotValidException ex) {
        List<String> errors = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .collect(Collectors.toList());
        return ResponseEntity.badRequest()
            .body(new ErrorResponse("VALIDATION_FAILED", errors.toString()));
    }
    
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneral(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.internalServerError()
            .body(new ErrorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
}
```

---

### 20 Additional Java & Spring Boot Questions

---

**Q11. What is the difference between checked and unchecked exceptions in Java?**

**A:** Checked exceptions (extend `Exception`) must be declared in the method signature (`throws IOException`) or caught explicitly. They represent recoverable conditions the caller should handle. Unchecked exceptions (extend `RuntimeException`) don't need to be declared or caught — they represent programming errors or unrecoverable states. In Spring, `@Transactional` only rolls back on unchecked exceptions by default. Best practice in modern Java: prefer unchecked exceptions for most application errors; use checked exceptions only for I/O and operations where the caller genuinely has a recovery strategy.

---

**Q12. Explain the Spring Bean scopes.**

**A:**
- `singleton` (default): One instance per Spring ApplicationContext. Shared across all injections. Suitable for stateless services.
- `prototype`: New instance on every injection. Suitable for stateful beans.
- `request`: One instance per HTTP request (web apps only).
- `session`: One instance per HTTP session (web apps only).
- `application`: One instance per ServletContext.
Pitfall: injecting a `prototype` bean into a `singleton` bean — the prototype instance is captured at startup and never refreshed. Solution: use `ApplicationContext.getBean()` or `@Lookup` methods.

---

**Q13. What is Spring Boot Actuator?**

**A:** Actuator exposes operational endpoints over HTTP (or JMX) for monitoring and managing the app. Key endpoints:
- `/actuator/health` — up/down status + custom health indicators (DB, Redis)
- `/actuator/metrics` — app metrics (JVM memory, GC, request counts, custom meters)
- `/actuator/info` — app version, git commit info
- `/actuator/env` — environment properties (be careful — restrict this endpoint)
- `/actuator/loggers` — dynamically change log levels at runtime without restart

In production: expose only `health` and `info` publicly; protect or disable `env`, `beans`, `mappings` behind Spring Security. Prometheus can scrape `/actuator/prometheus` for metrics.

---

**Q14. How does Spring Boot support microservices?**

**A:** Spring Boot is the foundation; Spring Cloud adds microservice capabilities:
- **Service discovery:** Spring Cloud Netflix Eureka or Consul — services register and discover each other
- **Client-side load balancing:** Spring Cloud LoadBalancer (replaced Ribbon) — distribute requests across instances
- **API Gateway:** Spring Cloud Gateway — reactive API gateway with routing, filters, rate limiting
- **Config management:** Spring Cloud Config Server — centralised config served to all services from a Git repo
- **Circuit breaker:** Resilience4j integration via Spring Cloud CircuitBreaker
- **Distributed tracing:** Spring Cloud Sleuth + Zipkin (now migrating to OpenTelemetry)

---

**Q15. What is the difference between `RestTemplate` and `WebClient`?**

**A:** `RestTemplate` is the classic synchronous HTTP client in Spring — each call blocks the calling thread until the response arrives. `WebClient` (from Spring WebFlux) is non-blocking and reactive — returns `Mono<T>` or `Flux<T>`. In a traditional (servlet-based) Spring Boot app with low HTTP client usage, `RestTemplate` is fine. For high-concurrency apps making many downstream calls, `WebClient` is more efficient (fewer threads blocked). `RestTemplate` is officially in maintenance mode — new projects should use `WebClient` or `OpenFeign`. `Feign` (declarative HTTP client) is often the most ergonomic choice for microservice clients.

---

**Q16. How do you write unit tests in Spring Boot?**

**A:**
```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    
    @Mock
    private UserRepository userRepository;
    
    @InjectMocks
    private UserService userService;
    
    @Test
    void shouldReturnUserById() {
        User expected = new User(1L, "john@example.com");
        when(userRepository.findById(1L)).thenReturn(Optional.of(expected));
        
        User result = userService.findById(1L);
        
        assertThat(result.getEmail()).isEqualTo("john@example.com");
        verify(userRepository).findById(1L);
    }
}
```
For integration tests: `@SpringBootTest` loads the full application context. `@WebMvcTest` loads only the web layer. `@DataJpaTest` loads only JPA components with an in-memory H2 DB. Use `@MockBean` to replace Spring beans with Mockito mocks in slicetests.

---

**Q17. What is Maven / Gradle and how do you manage dependencies?**

**A:** Maven and Gradle are Java build tools. Maven uses `pom.xml` (XML); Gradle uses `build.gradle` (Groovy/Kotlin DSL). Dependencies are defined with group:artifact:version and downloaded from Maven Central or private repositories. Spring Boot's parent POM (or Spring Boot Gradle plugin) manages compatible dependency versions — you include a starter without specifying a version (`spring-boot-starter-web`) and the parent resolves the compatible version. Run `mvn dependency:tree` or `gradle dependencies` to see the full dependency graph and identify conflicts. Use `dependencyManagement` (Maven) or `platform()` (Gradle) for BOM imports.

---

**Q18. What is the N+1 problem in Hibernate and how do you fix it?**

**A:** When loading entities with lazy-loaded relationships, Hibernate issues 1 query to load the parent entities, then N queries — one per entity — to load the related collection when it's first accessed. Fix:
- **JPQL JOIN FETCH:** `SELECT u FROM User u JOIN FETCH u.orders WHERE u.id = :id` — loads user and orders in a single query
- **EntityGraph:** Declare which associations to eagerly load on a per-query basis without modifying the entity mapping
- **`@BatchSize`:** Hibernate loads related entities in batches rather than one at a time
- **DTO projections:** For read-only queries, use JPQL to project directly to a DTO — no entity loaded, no lazy collection accessed

---

**Q19. How do you configure multiple data sources in Spring Boot?**

**A:**
```yaml
spring:
  datasource:
    primary:
      url: jdbc:postgresql://localhost/db_primary
    secondary:
      url: jdbc:postgresql://localhost/db_secondary
```
Create two `@Bean` DataSource, EntityManagerFactory, and TransactionManager configs annotated with `@Primary` for the default and the secondary explicitly qualified. Use `@Qualifier("secondary")` when injecting the non-primary beans. JPA repositories must specify which EntityManagerFactory they use via `@EnableJpaRepositories(entityManagerFactoryRef = ...)`. This pattern is common in multi-tenant setups or when combining relational + NoSQL access.

---

**Q20. What are common performance bottlenecks in Spring Boot applications?**

**A:**
- **N+1 queries:** Hibernate lazy loading (fix: JOIN FETCH, batch size)
- **No connection pool tuning:** Default HikariCP settings may not match your traffic pattern — tune `maximumPoolSize`
- **Overfetching:** Loading entire entities when you only need 2 fields — use DTO projections
- **Missing indexes:** Queries on unindexed columns; check hibernate's SQL log (`spring.jpa.show-sql=true`) for slow queries
- **Synchronous downstream calls in hot paths:** Use async (`@Async`), caching, or parallel execution with `CompletableFuture`
- **Large JSON serialisation:** Circular references in entity graph cause infinite serialisation loops; use `@JsonIgnore`, DTOs, or `@JsonManagedReference`/`@JsonBackReference`
- **Memory leaks:** Prototype beans stored in singletons, large objects in `HttpSession`, unclosed streams

---

**Q21. Explain Spring AOP (Aspect-Oriented Programming).**

**A:** AOP allows cross-cutting concerns (logging, security, transactions, metrics) to be applied declaratively across multiple classes without modifying them. Key concepts:
- **Aspect:** A class containing cross-cutting logic
- **Advice:** The code to run (`@Before`, `@After`, `@Around`, `@AfterReturning`, `@AfterThrowing`)
- **Pointcut:** A predicate that matches which methods the advice applies to
- **JoinPoint:** The method being intercepted

```java
@Aspect
@Component
public class LoggingAspect {
    @Around("@annotation(Audited)")
    public Object logAudit(ProceedingJoinPoint pjp) throws Throwable {
        log.info("Calling {}", pjp.getSignature());
        Object result = pjp.proceed(); // Execute the actual method
        log.info("Completed {}", pjp.getSignature());
        return result;
    }
}
```
Spring uses proxy-based AOP — limitations: only works on Spring-managed beans, and only on public methods called from outside the bean (self-invocation doesn't trigger the proxy).

---

**Q22. What is reactive programming in Spring (WebFlux)?**

**A:** Spring WebFlux is the reactive alternative to Spring MVC. It uses Project Reactor (`Mono<T>` = 0 or 1 item, `Flux<T>` = 0 to N items). In reactive programming, operations are non-blocking — instead of blocking a thread waiting for a DB response, you register a callback and the thread is freed to handle other requests. WebFlux scales better under I/O-heavy loads with fewer threads. Trade-offs: harder to debug (reactive stack traces), harder to integrate with blocking code (must use `subscribeOn(Schedulers.boundedElastic())`), and the reactor paradigm has a learning curve. Use for high-concurrency applications with many simultaneous I/O-bound operations; stick with Spring MVC + virtual threads (JDK 21) for most CRUD applications.

---

**Q23. How do you externalise configuration in Spring Boot?**

**A:** Spring Boot reads configuration from multiple sources in priority order:
1. Command-line arguments
2. `SPRING_*` environment variables
3. `application-{profile}.properties/yaml` (profile-specific)
4. `application.properties/yaml`

For production secrets: use Spring Cloud Config Server (Git-backed), AWS Parameter Store/Secrets Manager via Spring Cloud AWS, or Azure App Config/Key Vault via Spring Cloud Azure. Access config values with `@Value("${property.name}")` or `@ConfigurationProperties(prefix = "myapp")` (preferred — type-safe, group related properties). Never hardcode environment-specific values — always externalise them.

---

**Q24. What is Spring Boot's embedded server and how do you configure it?**

**A:** Spring Boot includes Tomcat (default), Jetty, or Undertow as embedded servers — no need to deploy a WAR to an external container. The server starts when you run `java -jar app.jar`. Configuration in `application.properties`:
```properties
server.port=8080
server.compression.enabled=true
server.compression.mime-types=application/json,text/html
server.tomcat.threads.max=200
server.tomcat.connection-timeout=30000
server.ssl.key-store=classpath:keystore.p12
server.ssl.key-store-password=${SSL_PASSWORD}
```
To switch from Tomcat to Undertow: exclude `spring-boot-starter-tomcat` and include `spring-boot-starter-undertow` in your dependencies. Useful for containerised deployments where a lighter server reduces startup time and memory footprint.


---

## 10. STAR Stories Framework

> **Purpose:** The STAR format (Situation, Task, Action, Result) is how you structure behavioral and scenario answers convincingly. Below are 3 reusable STAR templates — customise with your real project details (savl, warehouse management, ClawdBot, etc.).

---

### STAR Template 1 — Delivery Under Pressure

**Theme:** Delivering a complex feature/project under tight deadline or unexpected constraints.

---

**Sample Question:** *"Tell me about a time you delivered under significant pressure."*

**Answer Template:**

**Situation:**  
*[Project name]* was approaching its launch date. Two weeks before the deadline, [describe the unexpected complication — e.g., a third-party integration had breaking API changes / key team member went on sick leave / scope was significantly increased by the client].

**Task:**  
My responsibility was [your specific role — e.g., lead the backend integration / ensure the Node.js service was complete and tested / coordinate between frontend and backend teams]. The non-negotiable constraint was [timeline or client commitment].

**Action:**
1. Immediately ran a triage meeting to assess what was contractually committed vs. what could be deferred. Used MoSCoW to re-scope.
2. [Specific technical action — e.g., redesigned the integration to use a polling approach instead of webhooks, which removed the dependency on the third-party timeline]
3. Increased communication cadence — daily standups moved to twice-daily, and I sent a brief written update to the client PM at end of each day so there were no surprises.
4. [Another action — e.g., wrote the integration adapter + tests myself over a weekend to unblock the team; added feature flag to ship the feature disabled and enable post-testing]

**Result:**  
Delivered on the committed date with [X% / all must-have features] complete. Deferred [specific features] to the next sprint with the client's full awareness and agreement. Post-launch: [quantify — e.g., no production incidents in first two weeks / client onboarded 5 enterprise accounts on the feature within a month].

**Reflection:**  
[What you'd do differently — e.g., earlier third-party API discovery would have surfaced the breaking change 2 weeks sooner; now we include a verification step against the sandbox in sprint planning for any integration story]

---

### STAR Template 2 — Client Handling / Conflict Resolution

**Theme:** Managing a difficult client situation, conflicting requirements, or a breakdown in communication.

---

**Sample Question:** *"Describe a challenging client interaction and how you handled it."*

**Answer Template:**

**Situation:**  
During [project/phase], the client [describe the challenge — e.g., changed a fundamental requirement after development was 60% complete / was dissatisfied with the progress demo / had two stakeholders with conflicting priorities from the same organisation].

**Task:**  
My role was [e.g., technical lead and the primary client-facing contact for our engineering team]. I needed to [resolve the conflict without derailing the project / rebuild trust after missed expectations].

**Action:**
1. Requested a call with both stakeholders together (not separately — I'd already tried both separately and it wasn't resolving). I opened with: "I want to make sure I understand what success looks like for both of you, so let's get aligned today."
2. Used the data from the original requirements document to ground the conversation: "On [date], we agreed to X because of Y. Has the business need changed, or has the desired implementation approach changed?"
3. [If conflicting requirements:] When the conflict became clear, I reframed: "The business goal you both want is Z. There are two technical approaches — Option A delivers Z but has this trade-off; Option B does it differently. Which trade-off is more acceptable?"
4. Documented the agreed decisions and sent a written summary to both stakeholders within 24 hours. This created an accountable record.

**Result:**  
[Outcome — e.g., stakeholders aligned on Option B within that call; project resumed without scope change; client noted on the retrospective that the communication improved significantly after that point / client relationship improved and they subsequently agreed to extend the engagement for Phase 2].

**Reflection:**  
[What you learned — e.g., earlier stakeholder alignment sessions (not just project kickoff) would have caught the diverging expectations sooner; requirement sign-offs with named approvers are now part of our project initiation process]

---

### STAR Template 3 — Technical Trade-off Decision

**Theme:** A significant architectural or technical decision you made, the reasoning behind it, and the outcome.

---

**Sample Question:** *"Tell me about a significant technical decision you made and the trade-offs involved."*

**Answer Template:**

**Situation:**  
On [project], we needed to [describe the problem — e.g., handle high-volume asynchronous notifications / migrate from a monolith to support independent service deployments / add real-time collaborative features]. Our current architecture [describe the constraint — e.g., was polling a DB table every 5 seconds / was a monolith with all teams deploying together / had no real-time capability].

**Task:**  
I was responsible for evaluating and recommending the technical approach. The key constraints were [timeline / team familiarity / operational load / cost].

**Action:**
1. Defined the evaluation criteria: [e.g., throughput at peak load, developer experience, operational simplicity given a 2-person ops team, cost at current scale]
2. Evaluated 3 options:
   - **Option A** (e.g., polling-based): Simple, no new infra, but would not scale past [X req/s] and added DB load
   - **Option B** (e.g., Redis pub/sub): Fast, familiar to the team, good for our scale, no persistent message guarantee
   - **Option C** (e.g., AWS SQS + Lambda): Fully managed, persistent, scales to any volume, slightly higher complexity and latency

3. Built a small PoC for Option B and Option C — measured throughput and latency under simulated peak load.
4. Presented findings to the team with a recommendation: Option B for the current phase (we're at [X] daily active users; Redis pub/sub handles this comfortably with much lower ops overhead), with Option C as the planned migration path when we exceed [Y] concurrent connections.
5. Documented the decision as an ADR.

**Result:**  
Option B was implemented in [timeframe]. It has been running in production for [X months] handling [Y events/day] with [Z% uptime]. When we scaled past the anticipated threshold [if applicable: we migrated to SQS / the Redis approach scaled further than estimated with a horizontal scale-out of Redis workers].

**Reflection:**  
[What you'd do differently or what you learned — e.g., the PoC saved us from choosing Option A which would have required a rearchitecture 3 months later / defining the scaling thresholds explicitly in the ADR meant the migration trigger was clear and unambiguous]

---

### Quick STAR Answer Checklist

Before any behavioral answer, run through this checklist:

| Check | Question |
|---|---|
| **Specific** | Have I given a real, specific example (not a hypothetical)? |
| **Your role** | Is it clear what *I* specifically did (not "we")? |
| **Quantified** | Have I included at least one number (timeframes, metrics, scale)? |
| **Complete** | Have I included all four parts: Situation, Task, Action, Result? |
| **Concise** | Is the answer under 3 minutes? (If longer, you've lost them) |
| **Reflection** | Have I shown self-awareness — what I'd do differently? |

---

### Common STAR Question → Story Mapping

| Question | Story Theme to Use |
|---|---|
| "Tell me about a time you delivered under pressure" | Delivery under pressure template |
| "Describe a production incident" | Use Template 1 (delivery) with incident context |
| "Tell me about a conflict with a stakeholder/client" | Client handling template |
| "Describe a technical decision you'd make differently" | Technical trade-off template, honest reflection |
| "Tell me about a time you took initiative" | Any story where you identified a risk/opportunity and acted without being asked |
| "Describe a time you mentored someone" | Use a specific mentoring moment from your experience |
| "Tell me about a failure" | Use any story; front the failure clearly; focus on the learning |
| "How do you handle ambiguous requirements?" | Use a story where requirements were unclear, then describe how you clarified them |

---

### Project Case Studies (Fill In Your Own Projects)

Use this structure when asked "Walk me through a project you're most proud of":

**Project:** [savl / ClawdBot / Warehouse Management System]

| Dimension | Your Answer |
|---|---|
| **Problem** | What business problem was this solving? |
| **Your role** | What were you specifically responsible for? |
| **Architecture** | What tech stack? Why those choices? |
| **Biggest challenge** | What was the hardest technical/process problem? |
| **Decision you made** | Key trade-off you navigated |
| **Outcome** | Business result (users, performance, revenue, etc.) |
| **Learnings** | What would you do differently? |

---

*End of Techno-Managerial Round Q&A Guide*

---

> **Quick Study Priority (Day before interview):**
> 1. Re-read System Design Q1–Q4 and practice explaining verbally
> 2. Review your STAR stories and time yourself (aim for 2–3 min each)
> 3. Scan Security OWASP table and RBAC implementation
> 4. Re-read Managerial Q3 (scope trade-off) and Q6 (API alignment) — highest probability in a techno-managerial round

