# System Design — Interview Revision Summary

> **Target:** 7+ year Full Stack MERN / AI Developer | **Files:** 9

## Table of Contents

1. [01_microservices_architecture.md — Monolith vs Microservices](#sd-microservices)
2. [02_caching_message_queues.md — Cache Patterns & Redis Pub/Sub](#sd-caching)
3. [03_realtime_communication.md — WebSockets, SSE, Long Polling](#sd-realtime)
4. [04_database_design.md — SQL vs NoSQL, Indexing, Sharding](#sd-databases)
5. [05_scalability_patterns.md — Docker, Kubernetes, CI/CD](#sd-scalability)
6. [06_api_design.md — REST, GraphQL, Rate Limiting, JWT](#sd-api)
7. [07_vector_databases.md — Embeddings, RAG Pipeline](#sd-vectors)
8. [08_ai_system_design.md — LLM Orchestration, Prompt Engineering](#sd-ai)
9. [09_multi_tenancy_design.md — Tenant Isolation, SaaS Patterns](#sd-multitenancy)

---

<a id="sd-microservices"></a>
## 01 — Microservices Architecture

**STAR:** Monolith hitting limits at 10K users → split to stateless microservices → Redis for session, K8s HPA, API Gateway → 10K+ sustained, 22% infra cost reduction.

| | Monolith | Microservices |
|--|--|--|
| Deploy | All-or-nothing | Each service independently |
| Failure | One bug crashes everything | Fault isolated to service |
| Scale | Scale everything together | Scale hot services only |
| Complexity | Low initially | Higher — need service mesh, tracing |

**Stateless design:** Move session from in-process memory → Redis. Every instance reads from Redis so any pod can handle any request.

**Circuit Breaker pattern (opossum):**
- Closed → requests pass through normally
- Open → requests fail fast (skip the downstream call) after failure threshold
- Half-open → test request allowed; success → Closed; failure → Open again

**API Gateway responsibilities:** auth/JWT validation, rate limiting, request routing, request aggregation.

**Inter-service communication:**
- Sync: HTTP/REST or gRPC (when you need a response immediately)
- Async: Message queue / event bus (when you fire-and-forget; decouples services)

---

<a id="sd-caching"></a>
## 02 — Caching & Message Queues

**STAR:** Redundant DB queries across horizontal instances → Cache-Aside + Redis Pub/Sub invalidation → 65% DB load reduction, 89% cache hit rate.

| Strategy | Write path | Read path | When to use |
|--|--|--|--|
| Cache-Aside | App writes DB only | App checks cache first, fills on miss | General read-heavy |
| Write-Through | App writes cache + DB together | Cache always current | Strong consistency |
| Write-Behind | App writes cache; async flush to DB | Fast writes | Write-heavy, eventually consistent OK |

**Eviction policies:**
- `LRU` (Least Recently Used) — evict least recently accessed → general best choice
- `LFU` (Least Frequently Used) — evict least popular → good for content delivery
- `TTL` — evict after fixed time → session data, auth tokens

**Cache failure patterns:**
- **Cache Stampede:** Many concurrent misses → all hit DB simultaneously. Fix: mutex lock on cache fill.
- **Cache Penetration:** Queries for non-existent keys → all hit DB. Fix: cache null results with short TTL.
- **Cache Avalanche:** Mass expiry at same time. Fix: jitter on TTL.

**Redis Pub/Sub for cache invalidation:** When one instance updates data, it publishes to Redis channel; all other instances subscribe and drop their local cache copy for that key.

**Queue vs Pub/Sub:**
- Queue: one-to-one, message consumed once (job processing)
- Pub/Sub: one-to-many, all subscribers receive message (cache invalidation, events)

---

<a id="sd-realtime"></a>
## 03 — Real-time Communication

**STAR:** Polling 2–3s latency → Socket.IO + Redis adapter → sub-100ms, 85% fewer HTTP requests.

| Protocol | Connection | Direction | Use case |
|--|--|--|--|
| WebSocket | Persistent TCP | Bidirectional | Chat, live collaboration, gaming |
| SSE | HTTP keep-alive | Server → client only | Live feeds, notifications |
| Long Polling | HTTP request held open | Server → client | Fallback for restricted environments |

**WebSocket upgrade flow:** Client sends `Connection: Upgrade; Upgrade: websocket` → server responds `101 Switching Protocols` → TCP connection repurposed for full-duplex frames.

**Socket.IO horizontal scaling:** Without Redis adapter, two servers can't relay events between clients on different servers. Redis Pub/Sub bridges them — publish on Server A → all servers receive → broadcast to their local clients.

**Rooms pattern:** Server-side groups of sockets. Client joins room, server emits `to(roomId)` — only that room's sockets receive it. Used for chat channels, document collaboration, game lobbies.

---

<a id="sd-databases"></a>
## 04 — Database Design

**STAR:** 8M MongoDB documents, 2–4s queries → compound indexes (ESR rule), pre-aggregated summaries, read replicas → 55% query reduction, 3.8s → 0.4s dashboard load.

| | SQL (Postgres) | NoSQL (MongoDB) |
|--|--|--|
| Schema | Rigid, enforced | Flexible, per-document |
| Joins | Native, performant | `$lookup` (expensive at scale) |
| ACID | Full transactions | Multi-doc transactions (4.0+) |
| Scale | Vertical first | Horizontal (sharding built-in) |
| Best for | Complex relations, financials | Flexible schema, high write throughput |

**ESR indexing rule:** Equality fields → Sort fields → Range fields. Index field order matters.

**Index types:**
- Compound: multiple fields, first field must be in query (left-prefix rule)
- Partial: only index documents matching a filter (e.g. `status: 'active'`)
- TTL: auto-delete documents after expiry (sessions, logs)
- Text: full-text search on string fields

**Sharding strategies:**
- Hash sharding: even distribution, no range queries
- Range sharding: range queries efficient, risk of hot shards at boundaries
- Compound shard key: adds a second field to reduce hot spots

**Read replicas:** Secondary nodes replicate the primary asynchronously. `readPreference: 'secondaryPreferred'` routes reads to replicas, freeing the primary for writes.

---

<a id="sd-scalability"></a>
## 05 — Scalability Patterns

**STAR:** 45-minute manual deploys → Docker + K8s CI/CD pipeline → 60% faster deployments, zero-downtime releases.

| | Vertical (Scale Up) | Horizontal (Scale Out) |
|--|--|--|
| How | Bigger CPU/RAM | More instances |
| Limit | Hardware ceiling | Near-infinite |
| Downtime | Often | None |
| State | Easy | Must be external (Redis, DB) |

**Multi-stage Docker builds:** Two `FROM` statements — builder stage installs all deps + compiles; production stage copies only compiled output + prod deps. Reduces image size from ~850MB to ~120MB.

**Rolling update:** Pods replaced incrementally. `maxSurge` = extra pods allowed during update; `maxUnavailable` = pods that can be offline. Rollback: `kubectl rollout undo`.

**Blue-green deployment:** Two identical environments. Service selector points to `slot: blue`. Deploy green silently, run smoke tests, then patch Service selector to `slot: green` (atomic). Instant rollback = patch selector back.

**HPA (Horizontal Pod Autoscaler):** Watches CPU/memory metrics, scales pod count between `minReplicas` and `maxReplicas`. Uses `stabilizationWindowSeconds` to prevent flapping.

**GitHub Actions CI/CD stages:** lint → test → docker build → push to ECR → `kubectl set image` → `kubectl rollout status`.

---

<a id="sd-api"></a>
## 06 — API Design

**STAR:** Bad clients causing CPU spikes, mobile needing 4–6 requests per screen → Redis sliding-window rate limiting + GraphQL → eliminated incidents, 40% P95 improvement.

| | REST | GraphQL |
|--|--|--|
| Data shape | Fixed by server | Client specifies fields |
| Overfetching | Common | Eliminated |
| Caching | Trivial (HTTP GET + CDN) | Complex (POST, varies by query) |
| Best for | Public APIs, CDN-cached | Mobile/SPA, data-heavy screens |

**Rate limiting algorithms:**
- **Fixed window:** Counter reset each minute. Spike risk at window boundary.
- **Sliding window log:** Timestamp per request, count within rolling window. Precise.
- **Token bucket:** Bucket refills at rate R, each request consumes 1 token. Allows bursts.
- **Leaky bucket:** Queue drains at fixed rate. Strict smooth output. Best for regulated outbound calls.

**JWT pattern:**
- Access token: short-lived (15m), JWT, stateless. Validated on every request.
- Refresh token: long-lived (7d), opaque random string, stored in DB + rotated on use.
- Refresh token stored in `httpOnly; Secure; SameSite=strict` cookie — not accessible to JS.

**GraphQL safety guards:** `graphql-depth-limit` (reject deeply nested queries) + `graphql-query-complexity` (reject high-cost queries). Never expose a GraphQL API without these.

---

<a id="sd-vectors"></a>
## 07 — Vector Databases & RAG

**STAR:** Keyword search returning wrong documents for FAQ → RAG pipeline with Pinecone → 54% → 88% answer accuracy, near-zero hallucination rate.

| Concept | What it is |
|--|--|
| Embedding | Float vector (1536 dims) representing semantic meaning |
| Cosine similarity | Score 0–1 between two vectors. > 0.75 = semantically relevant |
| HNSW | Approximate nearest-neighbour index algorithm. O(log n) search |
| Chunking | Split documents into smaller segments before embedding |
| RAG | Retrieve relevant chunks → inject as LLM context → grounded answer |

**RAG pipeline flow:**
1. **Ingestion:** Document → chunk (512 tokens, 50 overlap) → embed → upsert to vector DB with metadata
2. **Query:** User message → embed → similarity search (top-k=5, score > 0.75) → inject chunks into prompt → LLM answers from context only

**Chunking best practice:** `RecursiveCharacterTextSplitter` with 512 tokens + 50 overlap. Overlap preserves context at chunk boundaries.

**Vector DB comparison:**
- **Pinecone:** Managed cloud, billions of vectors, production
- **ChromaDB:** Self-hosted, millions of vectors, local dev / privacy
- **pgvector:** Postgres extension, no new infrastructure, tens of millions of vectors

**Why RAG over fine-tuning:** RAG retrieves at inference time (always current data). Fine-tuning bakes knowledge in at training time (stale). RAG is also auditable — you can see which chunks were retrieved.

---

<a id="sd-ai"></a>
## 08 — AI System Design

**STAR:** $0.12 per conversation, inconsistent outputs → LLM gateway with model routing + prompt caching + structured output → $0.03/conversation (75% reduction), zero JSON parse errors.

| Challenge | Solution |
|--|--|
| Cost | Model routing (GPT-3.5 for simple, GPT-4o for complex) |
| Latency | Streaming responses; async parallel tool calls |
| Hallucination | RAG grounding; temperature=0; output validation |
| Unstructured output | `zodResponseFormat` — schema-validated JSON from API |
| Context limits | Sliding window + summarise old turns |
| Reliability | Retry with exponential backoff; fallback to cheaper model |

**LLM Gateway pattern:** Single module wrapping all OpenAI calls. Adds: retry (429 → exponential backoff), model fallback, audit logging (tokens, cost, latency), structured output validation.

**Model routing heuristics:** Short query + FAQ-pattern → `gpt-3.5-turbo`. Complex reasoning, multi-step → `gpt-4o`. Saves ~10x on token cost for qualifying requests.

**Prompt caching (OpenAI):** First 1024+ tokens of identical prefix are cached at 50% cost. Put static content (product catalogue, policies) at the START of the system prompt.

**LangChain.js agents vs chains:**
- Chain: deterministic steps defined at code time (prompt → LLM → parse → next)
- Agent: LLM decides which tool to call next based on previous result. Flexible, harder to debug.

**Structured output:** `zodResponseFormat(schema, 'name')` — OpenAI SDK validates LLM output against Zod schema before returning. Model returns wrong shape = SDK throws.

---

<a id="sd-multitenancy"></a>
## 09 — Multi-Tenancy Design

**STAR:** SaaS platform for CES Limited → schema-per-tenant in Postgres → strict isolation, 200+ tenants on single DB, 100ms tenant provisioning.

| Model | Isolation | Cost | Max scale |
|--|--|--|--|
| DB per tenant | Complete | Very high | Hundreds |
| Schema per tenant | Strong | Medium | ~10,000 |
| Shared DB + tenantId | Logical | Low | Millions |

**Schema-per-tenant:** Each tenant gets own Postgres schema (`tenant_{id}`). `SET search_path = "tenant_{id}"` scopes all queries. Cross-tenant leakage architecturally impossible with correct search_path.

**Shared DB + RLS:** All tables have `tenant_id` column. Postgres Row-Level Security policy: `USING (tenant_id = current_setting('app.current_tenant_id')::uuid)`. DB engine enforces isolation even if application forgets `WHERE tenant_id = ?`.

**Tenant middleware:** Extract `tenantId` from JWT → lookup tenant from Redis cache → attach to `req.tenant` → all downstream queries scoped to that tenant.

**Noisy neighbour prevention:**
- Per-tenant DB connection limits
- Statement timeout (`SET statement_timeout`)
- App-level rate limiting by tenantId
- Heavy queries routed to read replica

**Onboarding flow:** Sign up → create row in global `tenants` table → background job creates schema + runs migrations (100ms) → status → `active` → first JWT issued.

**Offboarding:** Schema renamed to `archived_` prefix (data retained for GDPR retention period), then dropped after retention window.
