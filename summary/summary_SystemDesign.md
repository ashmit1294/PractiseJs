# System Design — Interview Revision Summary

> **Target:** 7+ year Full Stack MERN / AI Developer | **Files:** 9 (excludes layers.me/, techno-managerial Q&A.md)

## Table of Contents

1. [01 — Microservices Architecture](#sd-microservices)
2. [02 — Caching & Message Queues](#sd-caching)
3. [03 — Real-time Communication](#sd-realtime)
4. [04 — Database Design](#sd-databases)
5. [05 — Scalability Patterns](#sd-scalability)
6. [06 — API Design](#sd-api)
7. [07 — Vector Databases & RAG](#sd-vectors)
8. [08 — AI System Design](#sd-ai)
9. [09 — Multi-Tenancy Design](#sd-multitenancy)

---

<a id="sd-microservices"></a>
## 01 — Microservices Architecture

**STAR:** Monolith hitting CPU/memory limits at ~10K concurrent users → split into stateless microservices (User, Order, Payment, Notification) → API Gateway for routing/JWT/rate-limiting, Redis for session state, K8s HPA → sustained 10K+ users, 22% infra cost reduction, zero-downtime rolling deploys.

### Monolith vs Microservices

| Dimension | Monolith | Microservices |
|--|--|--|
| Deployment | Single unit | Independent per service |
| Scaling | Scale whole app | Scale hotspots only |
| Team ownership | Shared codebase | Per-team per-service |
| Failure blast radius | Full app | Single service |
| Latency | In-process calls | Network hops |
| Data | Single DB | DB-per-service |
| Complexity | Low start, high growth | High start, manageable growth |

**When NOT to use microservices:** Early-stage products with small teams — operational overhead (service discovery, distributed tracing, inter-service auth, per-service pipelines) outweighs benefits.

### Stateless Design

Move all session state out of process memory → Redis (TTL-backed). Any instance can handle any request. State types:

| State Type | Storage |
|--|--|
| Session / auth | Redis |
| User data | Database |
| File uploads | S3 / Blob Storage |
| Distributed locks | Redis `SET NX PX` |

### Service Discovery

| Pattern | How it works | Used by |
|--|--|--|
| Client-side | Client queries registry, picks instance | Netflix Eureka |
| Server-side | Client → load balancer → registry | AWS ALB + ECS, K8s Service |
| DNS-based | Service name resolves via DNS to healthy IPs | Kubernetes (CoreDNS), Consul |
| Service mesh | Sidecar proxy intercepts all traffic | Istio, Linkerd |

**Kubernetes:** Services get stable DNS names (`http://payment-service:3001`). No IP hardcoding.

### API Gateway

Single entry point for all clients. Handles: TLS termination, JWT validation, rate limiting, request routing, response aggregation (BFF pattern), centralised logging/tracing. Individual downstream services speak plain HTTP internally.

### Inter-Service Communication

| Style | Protocol | When to use |
|--|--|--|
| Synchronous | HTTP/REST, gRPC | Need immediate response |
| Asynchronous | SQS, RabbitMQ, Kafka | Fire-and-forget, long-running work |
| Event streaming | Kafka, Kinesis | Ordered event log, replay, fan-out |

### Circuit Breaker (opossum)

- **Closed** → requests pass through normally
- **Open** → fail fast after error threshold exceeded (skip downstream call)
- **Half-open** → one test request; success → Closed; failure → Open again
- Has a `fallback` — e.g. queue the charge instead of failing the user

### Distributed Transactions — Saga Pattern

Each step is a local transaction with a **compensating transaction** (undo) if a subsequent step fails.
- **Choreography:** each service reacts to events independently (event-driven, no central director)
- **Orchestration:** central coordinator tells each service what to do in sequence

**Service-to-service auth:** mTLS (mutual TLS) for service mesh trust, or short-lived internal JWTs signed by shared secret. Gateway validates user tokens; downstream services trust the gateway's forwarded identity header.

### Key Q&A

> **Q: How did you handle 10K+ concurrent users?**
> Stateless instances behind load balancer. Session state in Redis. K8s HPA on CPU/RPS. API Gateway handles TLS and rate limiting upstream.

> **Q: What's the hardest part of microservices?**
> Distributed data consistency — each service owns its DB, can't do JOINs or 2-phase commits. Solutions: event sourcing, Saga, eventual consistency with idempotent consumers.

---

<a id="sd-caching"></a>
## 02 — Caching & Message Queues

**STAR:** Redundant DB queries across horizontal instances → Cache-Aside + Redis Pub/Sub cross-instance invalidation + Bull queues → 65% DB load reduction, 89% cache hit rate, zero lost jobs.

### Caching Strategies

| Strategy | Write path | Read path | Consistency | Best for |
|--|--|--|--|--|
| Cache-Aside | App writes DB only | Check cache → miss → fetch DB → fill cache | Eventual | General read-heavy |
| Write-Through | App writes cache + DB simultaneously | Cache always populated | Strong | Profiles, configs |
| Write-Behind | App writes cache only; async flush to DB | Always low latency | Eventual (async) | Counters, metrics, leaderboards |
| Read-Through | App writes DB; cache layer fetches on miss | Transparent | Eventual | Transparent caching layer |

**Cache-Aside invalidation:** On write, `redis.del(key)` — next read fills fresh from DB.

### Eviction Policies

| Policy | Behaviour | Use when |
|--|--|--|
| `allkeys-lru` | Evict least-recently-used from ALL keys | General-purpose caching |
| `volatile-lru` | LRU from keys WITH a TTL | Mix of permanent + cached data |
| `allkeys-lfu` | Evict least-frequently-used | Skewed access patterns |
| `volatile-ttl` | Evict key with shortest remaining TTL | Expire soonest first |
| `noeviction` | Return error when full | When losing data is unacceptable |

### Cache Failure Patterns

| Pattern | What happens | Fix |
|--|--|--|
| **Cache Stampede** | Many concurrent misses → all hit DB simultaneously | Redis `SET NX` mutex lock on cache fill; only one instance fetches |
| **Cache Penetration** | Queries for non-existent keys bypass cache every time | Cache null results with short TTL (e.g. 60s) using sentinel value `'__NULL__'` |
| **Cache Avalanche** | Mass key expiry at same time → mass DB hits | Jitter TTL: `3600 + Math.random() * 300` |

### Message Queues vs Pub/Sub

| Dimension | Queue (SQS/Bull) | Pub/Sub (Redis/SNS) |
|--|--|--|
| Delivery | **One consumer** per message | **All subscribers** receive each message |
| Pattern | Task distribution / work queue | Event broadcast |
| Message retention | Until consumed or DLQ | Usually ephemeral |
| Use case | Email, video encoding, payment processing | Cache invalidation, real-time feeds, notifications |

**Redis Pub/Sub limitation:** No persistence, no consumer groups — messages lost if subscriber is offline. For durability use **Redis Streams** (consumer groups + ACKs) or **Kafka**.

### When to Use What

| Scenario | Solution |
|--|--|
| Send email after purchase | Queue (one worker, one email) |
| Invalidate cache on N servers | Pub/Sub (all servers receive and clear) |
| Process video upload | Queue (retry + DLQ) |
| User activity event log with replay | Kafka Streams |
| Rate-limit counter | Redis `INCR + EXPIRE` |

### Key Q&A

> **Q: Redis for caching AND Pub/Sub — risky single point?**
> Yes — separate Redis instances in production. Pub/Sub spikes shouldn't evict cached data. Use Redis Cluster or separate `maxmemory` policies.

> **Q: Cache-Aside vs Write-Through — which did you use?**
> Cache-Aside for user profiles (read-heavy, acceptable stale window). Write-Through for session tokens and feature flags (must always reflect latest state).

---

<a id="sd-realtime"></a>
## 03 — Real-time Communication

**STAR:** Long polling at 2–3s latency → Socket.IO + Redis adapter (`@socket.io/redis-adapter`) + rooms → sub-100ms end-to-end, ~85% fewer HTTP requests, seamless horizontal scaling across 3 instances.

### Protocol Comparison

| | WebSocket | SSE | Long Polling |
|--|--|--|--|
| Direction | Bidirectional | Server → Client only | Server → Client (per request) |
| Connection | Persistent TCP | Persistent HTTP | Request per message |
| Overhead | Low (frames) | Low (HTTP headers once) | High (full HTTP headers each time) |
| Auto-reconnect | Manual (Socket.IO handles) | Native browser | Client implements |
| Proxies/CDN | Needs upgrade support | Standard HTTP — works everywhere | Standard HTTP |
| Binary data | ✅ Native | ❌ Text only | ❌ Text only |
| Horizontal scaling | Needs sticky session OR Redis adapter | Needs sticky session | Stateless, easy |
| Use case | Chat, live collab, gaming | Live feeds, notifications | Legacy fallback |

### WebSocket Upgrade Flow

```
Client → HTTP GET /ws (Connection: Upgrade; Upgrade: websocket)
Server → 101 Switching Protocols
Both   → Persistent TCP full-duplex frames (no HTTP headers per message)
```

### Socket.IO Key Features Over Raw WebSockets

- Automatic fallback to long polling when WebSocket is blocked (corporate proxies)
- Built-in rooms, namespaces, reconnection logic, middleware
- Redis adapter for horizontal scaling (built-in)

### Horizontal Scaling — Redis Adapter

Without Redis adapter: client on Server A doesn't receive events emitted on Server B. With `@socket.io/redis-adapter`: emit → Redis PUBLISH → all servers subscribe → broadcast to their local clients. End-to-end: ~60–90ms.

### Rooms Pattern

Server-side groups of sockets. `socket.join('dashboard:123')`. `io.to('dashboard:123').emit(...)` — only that room's sockets receive it. Used for chat channels, document collaboration, game lobbies.

### Heartbeat + Reconnect

Server pings every 10s (`pingInterval`). If client doesn't reply within timeout (`pingTimeout: 20000`), connection is marked dead and cleaned up. Client `reconnection: true` with exponential backoff (`reconnectionDelayMax: 5000`).

**`lastEventId` pattern:** On reconnect, client sends last received event ID — server replays missed events.

### When to Use Each

| Requirement | Choose |
|--|--|
| Client sends AND receives live | WebSocket |
| Server pushes only (notifications, scores, CI logs) | SSE |
| Must work through all corporate proxies | SSE |
| Simple stateless fallback | Long Polling |

### Key Q&A

> **Q: SSE vs WebSocket for a live notification feed?**
> SSE — server-to-client only, simpler, works through all HTTP/2 proxies, browser auto-reconnects natively. WebSocket is overkill unless client also sends data.

> **Q: What happens to WebSocket messages during a server restart?**
> Connections drop. Clients reconnect within 1–5s. Messages during that window are lost unless buffered server-side (Redis list, SQS) and replayed on reconnect via `lastEventId`.

---

<a id="sd-databases"></a>
## 04 — Database Design

**STAR:** 8M+ MongoDB orders collection, 2–4s dashboard queries → `explain("executionStats")`, compound indexes (ESR order), pre-aggregated daily summaries (`$merge`), read replicas (`readPreference: 'secondary'`) → dashboard 3.8s → 0.4s, 55% query reduction, primary CPU 78% → 31%.

### SQL vs NoSQL Decision

| Dimension | SQL (Postgres) | NoSQL (MongoDB) |
|--|--|--|
| Schema | Rigid, DB-enforced | Flexible, app-enforced |
| Relationships | JOINs — native, performant | Denormalize / embed, or `$lookup` (expensive at scale) |
| Transactions | Full ACID, multi-table | Multi-doc ACID (4.0+) |
| Scaling | Vertical first; horizontal via read replicas | Horizontal-first (sharding built-in) |
| Best for | Financial data, complex reporting, relational integrity | Flexible schemas, high write throughput, hierarchical docs |

**Decision shortcuts:**
- Strong relational integrity (orders → line items → products) → **SQL**
- Schema varies per record (product catalogues, user-generated content) → **NoSQL**
- Horizontal write scale from day one (IoT, social feed) → **NoSQL (Cassandra/DynamoDB)**

### ESR Indexing Rule

Order fields in compound indexes: **E**quality → **S**ort → **R**ange

```js
// Query: orders for a user, sorted by date, within a date range
// ✅ Correct ESR order:
db.orders.createIndex({ userId: 1, createdAt: -1 });
//                       Equality   Sort + Range together

// ❌ Wrong — Sort before Equality breaks index efficiency
db.orders.createIndex({ createdAt: -1, userId: 1 });
```

**Diagnose with:** `explain('executionStats')` — look for `COLLSCAN` (bad) vs `IXSCAN` (good). `totalDocsExamined` should be close to `nReturned`.

### Index Types

| Type | Use case |
|--|--|
| Single field | Simple equality/range |
| Compound | Multi-field queries (ESR rule) |
| Text | Full-text keyword search |
| Partial | Index only subset matching a filter (e.g. `status: 'active'`) — smaller, faster |
| TTL | Auto-delete documents after expiry (sessions, logs) |
| Wildcard | Dynamic/unknown field names |

### Pre-Aggregation Pattern

Run a scheduled pipeline that writes daily totals into a `daily_summaries` collection using `$merge`. Dashboard reads 365 rows instead of 8M documents on every page load.

### Sharding Strategies

| Pattern | Shard Key | Pros | Cons |
|--|--|--|--|
| Hashed | `{ userId: 'hashed' }` | Even distribution | Range queries hit all shards |
| Range | `{ createdAt: 1 }` | Range queries target one shard | Hot shard on monotonic keys |
| Compound | `{ tenantId: 1, userId: 1 }` | Queries for one tenant hit one shard | Must include tenantId in all queries |

**Hot shard anti-pattern:** Monotonically increasing shard key (ObjectId, timestamp) sends all new writes to one shard. Fix: use hashed shard key.

### Read Replicas

`readPreference: 'secondaryPreferred'` routes reads to secondaries. Analytical/reporting queries explicitly use `.read('secondary')`. Primary handles writes only. Replication is asynchronous — slight stale read risk.

### Key Q&A

> **Q: How did you achieve 55% query reduction?**
> (1) ESR compound indexes eliminated COLLSCAN on frequent queries. (2) Pre-aggregated daily summaries — dashboard reads 365 rows not 8M. (3) Analytical reads routed to secondary replica — stops competing with write traffic on primary.

> **Q: What's a hot shard and how do you fix it?**
> Hot shard = disproportionate write traffic — typically monotonically increasing shard key (ObjectId, timestamp). Fix: hashed shard key for even distribution.

---

<a id="sd-scalability"></a>
## 05 — Scalability Patterns

**STAR:** 45-min manual SSH deploys → Docker multi-stage builds + K8s rolling updates + blue-green + GitHub Actions CI/CD → 18-min automated pipeline, zero-downtime releases, rollback in <2 minutes.

### Vertical vs Horizontal Scaling

| | Vertical (Scale Up) | Horizontal (Scale Out) |
|--|--|--|
| How | Bigger CPU/RAM on same machine | More instances of same size |
| Limit | Hardware ceiling | Near-infinite (cloud) |
| Downtime | Often requires restart | None |
| Cost | Diminishing returns at high end | Linear, can scale down |
| Failure | Single point of failure | Instances fail independently |
| State | Easy — one machine | Hard — must be external (Redis, DB) |

### Docker Multi-Stage Builds

Two `FROM` statements:
1. **Builder stage** — `npm ci` (all deps), `npm run build` (compile TypeScript)
2. **Production stage** — `npm ci --omit=dev` (prod deps only), `COPY --from=builder /app/dist` (compiled output only), run as **non-root user**

Result: ~120MB production image vs ~850MB single-stage naive build.

### Kubernetes — Deployment Patterns

**Rolling Update (default):**
- `maxSurge: 2` — allow 2 extra pods during update
- `maxUnavailable: 1` — at most 1 pod offline at any time
- `kubectl rollout undo` — instant rollback

**Blue-Green:**
1. Deploy `green` (new version, `slot: green` label) — receives **0% traffic**
2. Verify green healthy, run smoke tests
3. `kubectl patch service` — update selector from `slot: blue` to `slot: green` (atomic)
4. Instant rollback = patch selector back to `slot: blue`

**Use cases:** Rolling for most services (lower resource cost). Blue-green for public API + payment service (atomic switch = zero requests hit new version until tests pass).

**Readiness vs Liveness Probes:**
- **Readiness:** "is pod ready for traffic?" — fails → removed from load balancer, NOT restarted. Prevents traffic to warming-up pods.
- **Liveness:** "is pod alive?" — fails → pod killed and restarted. Handles deadlocks/infinite loops.

### HPA (Horizontal Pod Autoscaler)

Watches CPU/memory metrics, scales pod count between `minReplicas` and `maxReplicas`. **Flapping risk:** rapid scale-up/down cycles — fix with `stabilizationWindowSeconds` (prevent scale-down for 5+ minutes after scale-up). HPA uses `requests` as denominator for utilisation math — set them accurately.

### GitHub Actions CI/CD Pipeline

```
push to main → lint → test (coverage) → docker build → push to ECR → 
kubectl set image → kubectl rollout status --timeout=5m
```

Uses `aws-actions/configure-aws-credentials` with `role-to-assume` (not static keys). Image tagged with `github.sha` for traceability.

### Key Q&A

> **Q: Blue-green vs rolling — when do you use which?**
> Rolling for most services (lower resource cost — no duplicate env). Blue-green for public API / payment — atomic traffic switch means zero requests hit new version until smoke tests pass.

> **Q: What's the risk of aggressive HPA?**
> Flapping — rapid scale-up/scale-down wastes resources and causes instability. Fix: `stabilizationWindowSeconds` and accurate CPU requests.

---

<a id="sd-api"></a>
## 06 — API Design

**STAR:** Bad clients causing CPU spikes, mobile needing 4–6 requests/screen → layered rate limiting (Nginx IP + Redis sliding-window per API key) + GraphQL with depth/complexity guards → incidents eliminated, 4–6 round-trips → 1, 40% P95 improvement.

### REST vs GraphQL

| | REST | GraphQL |
|--|--|--|
| Data shape | Fixed by server | Client specifies fields |
| Overfetching | Common | Eliminated |
| Underfetching / N+1 | Multiple requests for related data | One request with nested fields + DataLoader |
| Caching | Trivial (HTTP GET + CDN by URL) | Complex (POST, varies by query — use persisted queries) |
| Versioning | `/v1/` → `/v2/` URL | Schema evolve with `@deprecated` directive |
| Best for | Public APIs, CDN-cached, simple CRUD | Mobile/SPA data-heavy screens, aggregation |

**Keep REST alongside GraphQL:** REST + HTTP caching for public/CDN endpoints. GraphQL for high-cardinality data screens. Migrating existing partner integrations would break them.

### REST Best Practices

- Methods: `GET` (200), `POST` (201 + Location header), `PATCH` (200 partial), `DELETE` (204 No Content)
- Consistent error shape: `{ error: { code, message, timestamp } }`
- **Cursor-based pagination** for large sets: `?cursor=<encoded>&limit=20` — no skip/offset; reliable on fast-changing data

### GraphQL Safety Guards

Always add before exposing a GraphQL API:
- `depthLimit(7)` — reject deeply nested queries (user → posts → user → posts...)
- `createComplexityLimitRule(1000)` — reject high-cost queries. Lists multiply cost by `listFactor`.
- `formatError` — never leak stack traces to clients

**DataLoader (N+1 prevention):** Batches all resolver calls for the same loaders type within one tick → 1 DB query for N authors instead of N individual queries.

### Rate Limiting Algorithms

| Algorithm | Burst allowed | Smoothness | Use case |
|--|--|--|--|
| Fixed window | Yes — spike at boundary | Poor | Simple, low-stakes |
| Sliding window log | Precise | Good | API gateways |
| Token bucket | Yes — up to bucket size | Moderate | Most APIs |
| Leaky bucket | No — strict smooth output | Excellent | Video/audio streams, regulated outbound calls |

**Implementation:** Redis `ZADD + ZREMRANGEBYSCORE + ZCARD` sliding window per API key. Tiered limits: free (60 rpm), pro (600 rpm), enterprise (6000 rpm). Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### JWT Auth Pattern

- **Access token:** short-lived (15m), JWT, stateless. Validated on every request via `Authorization: Bearer`.
- **Refresh token:** long-lived (7d), opaque random hex (not JWT!), stored in DB, rotated on every use.
- Stored in `httpOnly; Secure; SameSite=strict` cookie — inaccessible to JavaScript (XSS-safe).
- **Rotation:** old refresh token deleted when used; if reuse detected → all sessions invalidated (token theft detection).

**Why not localStorage?** XSS risk — any injected script can read localStorage and exfiltrate the token.

### API Versioning Strategies

| Strategy | Example | Notes |
|--|--|--|
| URL path | `/v1/users`, `/v2/users` | Simple, cacheable, clutters URLs |
| Header | `Accept: application/vnd.api+json;version=2` | Clean URLs, less discoverable |
| GraphQL `@deprecated` | `@deprecated(reason: "Use fullName")` | Gradual, no hard cut |

### Key Q&A

> **Q: How did you protect against a bad client taking down the service?**
> Two layers: Nginx rate limits at IP level (coarse, fast), then Redis sliding-window per API key in Node middleware. Tiered limits — free clients get 60 rpm ceiling. Bad client gets 429s; all others are unaffected.

> **Q: Token bucket vs leaky bucket?**
> Token bucket: bucket holds N tokens, refills at fixed rate, each request consumes one — allows bursting up to bucket size. Leaky bucket: requests queue, drain at fixed rate — no bursting, perfectly smooth output. Use leaky bucket for strictly even outbound calls to a third-party with a hard rate limit.

---

<a id="sd-vectors"></a>
## 07 — Vector Databases & RAG

**STAR:** Keyword search (Elasticsearch) returning semantically wrong documents — "car insurance" missed "vehicle coverage" → RAG pipeline (Pinecone + GPT-4o) → answer accuracy 54% → 88%, near-zero hallucination rate.

### Core Concepts

| Concept | What it is |
|--|--|
| Embedding | Dense float vector (e.g. 1536 dims) representing semantic meaning |
| Cosine similarity | $\text{cosine}(A, B) = \frac{A \cdot B}{\|A\| \cdot \|B\|}$ — Score 1.0 = identical, >0.75 = relevant, <0.5 = unrelated |
| HNSW | Hierarchical Navigable Small World — Approximate Nearest Neighbour index, O(log n) search |
| Chunking | Splitting documents into smaller segments before embedding |
| RAG | Retrieve relevant chunks → inject as LLM context → grounded answer (open-book exam) |
| Hallucination | LLM inventing facts not in context — prevented by grounding |

### RAG Pipeline Architecture

**Ingestion:**
```
Document → Chunk (512 tokens, 50 overlap) → Embed (text-embedding-ada-002)
→ Upsert to Vector DB (with metadata: docId, type, date, text)
```

**Query:**
```
User question → Embed query → Similarity search (top-k=5, score > 0.75)
→ Filter by metadata → Inject chunks into prompt
→ LLM (temperature=0): "Answer ONLY from provided context"
→ Grounded answer + source attribution
```

### Chunking Strategies

| Strategy | Boundary | Pros | Cons |
|--|--|--|--|
| Fixed size | Every N tokens | Predictable | May cut mid-sentence |
| Sentence | Sentence endings | Preserves meaning | Variable size |
| **Recursive character** | `\n\n` → `\n` → `. ` → ` ` | Respects document structure | Slightly more complex |
| Semantic | Embedding drift threshold | Best coherence | Expensive |
| Document sections | Headers / `## ` | Preserves document intent | Requires parseable structure |

**Default best practice:** `RecursiveCharacterTextSplitter`, 512 tokens, 50 overlap. Overlap preserves context at chunk boundaries.

### Vector DB Comparison

| | Pinecone | ChromaDB | pgvector |
|--|--|--|--|
| Hosting | Managed cloud | Self-host or cloud | Your Postgres |
| Scale | Billions of vectors | Millions (single node) | Tens of millions |
| Setup | API key, instant | Docker or local | Add extension to PG |
| Cost | Pay per index/query | Free self-hosted | Storage only |
| Best for | Production, large scale | Dev, prototyping, privacy | Already using Postgres |

### RAG vs Fine-Tuning

| | RAG | Fine-Tuning |
|--|--|--|
| Data freshness | Always current (retrieval at inference time) | Stale (baked in at training time) |
| Auditability | ✅ See which chunks were retrieved | ❌ Black box |
| Update cost | Re-embed and upsert changed docs | Full retraining |
| Use for | Up-to-date factual knowledge | Changing model behaviour/style/tone |

**Handling changing documents:** Re-embed and upsert with same IDs (idempotent). Deleted docs: delete all chunk vectors with that docId prefix. Large re-indexing: build shadow index offline, swap atomically.

### Key Q&A

> **Q: What happens if the answer spans multiple chunks?**
> Overlap helps at chunk boundaries. Increase `top-k` for long answers. For inter-dependent documents, use parent-child retrieval: embed small chunks for precision, retrieve the full parent section as context.

> **Q: How did you measure 88% accuracy?**
> Test set of 100 questions with gold-standard answers. Scored fully/partially/wrong. Compared to keyword search baseline (54%). Tuned chunk size, overlap, top-k on validation set before measuring on held-out test set.

---

<a id="sd-ai"></a>
## 08 — AI System Design

**STAR:** Customer-facing AI assistant, $0.12/conversation, inconsistent outputs → LLM gateway (retry, model routing, prompt caching) + Zod structured output + context compression → $0.03/conversation (75% reduction), zero JSON parse errors, fully auditable.

### Key Challenges & Solutions

| Challenge | Problem | Solution |
|--|--|--|
| Cost | GPT-4o charges per token | Model routing, prompt compression, caching |
| Latency | LLM responses 1–10s | Streaming, async parallel tool calls |
| Hallucination | Model invents facts | RAG grounding, temperature=0, output validation |
| Structured output | Model returns prose not JSON | Zod `zodResponseFormat` |
| Context limits | 128K tokens — still costs money | Summarise old turns, sliding window |
| Reliability | 429/500 errors | Retry with exponential backoff, fallback model |
| Prompt drift | Prompts change silently → regressions | Version prompts, run evals against golden set |

### LLM Gateway Pattern

Single module wrapping all OpenAI calls. Centralises:
- **Retry:** 429 → exponential backoff (`2^attempt * 1000ms`)
- **Fallback:** if `smart` (gpt-4o) 500s → retry with `mini` (gpt-4o-mini)
- **Model aliases:** `fast` = gpt-3.5-turbo, `smart` = gpt-4o, `mini` = gpt-4o-mini
- **Audit log:** model, prompt tokens, completion tokens, latency, cost per call
- **Cost calculation:** `(promptTokens / 1000 * inputPrice) + (completionTokens / 1000 * outputPrice)`

### Model Routing

Route to cheaper model based on heuristics:
- Short query (<15 words) + FAQ pattern (`/^(what is|how do)/i`) → `fast` (gpt-3.5-turbo, ~10x cheaper)
- Complex reasoning, multi-step → `smart` (gpt-4o)
- ~70% of queries qualified as simple → saved $0.09/conversation

### Structured Output (Zod)

```js
const schema = z.object({
  intent: z.enum(['billing', 'technical_support', 'cancellation', 'general_question']),
  urgency: z.enum(['low', 'medium', 'high']),
  requiresHumanAgent: z.boolean(),
});
// options.response_format = zodResponseFormat(schema, 'output')
// → response.choices[0].message.parsed (typed, validated)
// → SDK throws if shape wrong — no manual JSON.parse needed
```

### Context Window Management (Sliding Window + Summarisation)

Keep last 6 messages always. When token count exceeds threshold (6000+), summarise oldest messages into a compact `summary` string using `fast` model, then drop them. Next call includes summary as a system message prefix.

### Prompt Caching (OpenAI)

First 1024+ tokens of identical prefix cached at **50% cost**. Put static content (product catalogue, policies) at the **START** of the system prompt (before dynamic content). Dynamic content (user message) goes at the END, after the cached prefix.

### LangChain.js — Chains vs Agents

- **Chain:** deterministic sequence of steps defined at code time (prompt → LLM → parse → next). Predictable, easy to debug.
- **Agent:** LLM decides which tool to call next based on previous tool output. `createToolCallingAgent` + `AgentExecutor`. Flexible, harder to debug. Use for open-ended tasks where number of steps isn't known in advance.

**Tool definition:** `tool(asyncFn, { name, description, schema: z.object(...) })` — schema tells the LLM what arguments are required.

### Key Q&A

> **Q: How did you reduce LLM cost by 75%?**
> (1) Model routing — 70% of queries go to GPT-3.5 (~10x cheaper). (2) Prompt caching — static system prompt cached by OpenAI, ~40% input token savings for cached requests. (3) Context compression — summarising old turns reduces prompt length on long conversations.

> **Q: How do you handle hallucination in production?**
> RAG grounding (model answers from retrieved text, not memory). Structured output (harder to "make up" fields). temperature=0 for factual tasks. Validation: verify claims against source data where possible (e.g. order numbers must exist in DB).

> **Q: LangChain chain vs agent?**
> Chain: deterministic, defined at code time. Agent: LLM decides which tool next — flexible for open-ended tasks, harder to predict/debug.

---

<a id="sd-multitenancy"></a>
## 09 — Multi-Tenancy Design

**STAR:** SaaS platform for CES Limited → schema-per-tenant in Postgres (`SET search_path`) + RLS defence-in-depth → zero cross-tenant leaks, 200+ tenants on one DB instance, 100ms tenant provisioning.

### Multi-Tenancy Models

| Model | Isolation | Cost | Complexity | Max tenants | Best for |
|--|--|--|--|--|--|
| DB per tenant | Complete | Very high | High | Hundreds | Regulated industries, large enterprise |
| **Schema per tenant** | Strong | Medium | Medium | ~10,000 | Mid-market SaaS |
| Shared DB + tenantId | Logical only | Low | Low (risky at scale) | Millions | Early-stage, small datasets |

### Schema-per-Tenant (Postgres)

```sql
CREATE SCHEMA IF NOT EXISTS tenant_abc123;
-- Copy table structure from template schema
CREATE TABLE tenant_abc123.users (LIKE _template.users INCLUDING ALL);
```

**Connection scoping:** Acquire a client from the pool, run `SET search_path = "tenant_{id}", public`, then execute all queries. Release client. Cross-tenant leakage architecturally impossible once `search_path` is set — `SELECT * FROM users` automatically goes to the right tenant schema.

**Practical limit:** Postgres handles ~10,000 schemas before performance degrades.

### Shared DB + Row-Level Security (RLS)

Every table has `tenant_id UUID NOT NULL`. Composite index: `(tenant_id, key_field)`.

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

Set before every transaction: `SET LOCAL app.current_tenant_id = '{tenantId}'`. DB engine enforces isolation even if application bug forgets `WHERE tenant_id = ?`. **Defence-in-depth** — RLS is the last resort layer after `search_path` or application filtering.

### Tenant Middleware (Express)

1. Extract `tenantId` from JWT claim
2. Lookup tenant from Redis cache (TTL: 5 min) — avoid DB on every request
3. Check `tenant.status === 'active'`
4. Attach `req.tenant` — all downstream handlers use this

```
router.use('/api', authenticate, tenantMiddleware);
```

**Repository layer:** `new UserRepository(req.tenant.id)` — scoping baked in once, all methods inherit it.

### Per-Tenant Configuration & Feature Flags

```js
// From Redis cache (TTL 300s)
const config = { plan, features: { advancedReports: true, apiAccess: false }, rateLimits }

// Middleware enforcement
function requireFeature(name) {
  return (req, res, next) => {
    if (!req.tenant.features[name]) return res.status(403).json({ upgradeUrl: '/billing/upgrade' });
    next();
  };
}
```

### Audit Logging

Every write action logged per tenant: `tenantId, userId, action, resource, resourceId, changes, created_at`. Auto-logged via middleware that wraps `res.json` — fire-and-forget (doesn't block response).

### Noisy Neighbour Prevention

- Per-tenant DB connection limits
- `SET statement_timeout = 10000` per query
- App-level rate limiting by `tenantId`
- Heavy reporting queries routed to read replica or separate analytics DB
- Larger plan tenants can get dedicated replica capacity

### Tenant Lifecycle

**Onboarding (100ms):**
1. Sign up → row created in global `tenants` table (status: `provisioning`)
2. Background job creates Postgres schema + runs all migrations
3. Status updated to `active` → first JWT issued with `tenantId` claim

**Offboarding:**
Schema renamed to `archived_` prefix (retained per GDPR data retention period), then dropped after window.

**Migrations across N schemas:** Loop through all active tenant schema names, run migration SQL inside `SET search_path = "{schema}"`. Done with a semaphore for controlled parallelism. New schemas always get full migrations at provisioning time.

### Key Q&A

> **Q: Why schema-per-tenant instead of tenantId column?**
> Architectural isolation — `search_path` scopes everything, no `WHERE tenant_id = ?` to accidentally omit. Indexes are tenant-scoped so a large tenant doesn't cause index bloat affecting others. Trade-off: ~10,000 schema limit.

> **Q: How do you prevent noisy neighbour?**
> Per-tenant connection limits, statement timeout at DB level, app-level rate limiting by tenantId, heavy queries to read replica. Larger plan tenants get dedicated replica capacity.

> **Q: Schema-per-tenant practical limit?**
> Postgres handles to ~10,000 schemas. Beyond that, use shared DB + RLS or database-per-large-tenant for biggest customers.
