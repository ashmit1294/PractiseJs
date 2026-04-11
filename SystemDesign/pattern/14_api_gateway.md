# Pattern 14 — API Gateway

---

## ELI5 — What Is This?

> Think of a huge office building with one front door and a security desk.
> Every visitor (API request) must pass through that desk.
> The guard checks your ID (authentication),
> checks if you have been here too many times today (rate limiting),
> looks at your badge to see which floor you are allowed on (routing),
> and stamps your form so everyone inside knows you were verified (request transformation).
> Without the front desk, every single room on every floor would need its own guard,
> its own visitor log, its own security camera.
> The API Gateway IS that front desk.

---

## Glossary

| Word | ELI5 Meaning |
|---|---|
| **API Gateway** | A single entry point (URL) that all clients talk to. It forwards requests to the right internal service after applying cross-cutting concerns like auth and rate limiting. |
| **Reverse Proxy** | A server that stands in front of other servers. Clients talk to the proxy; the proxy forwards to the real server. Clients never know the real server's address. |
| **Authentication** | Proving who you are. "I am User 123, here is my token." The gateway verifies the token before letting the request through. |
| **Authorization** | Proving you are ALLOWED to do this. "User 123 is verified, but are they allowed to access /admin endpoint?" A different check from authentication. |
| **JWT (JSON Web Token)** | A compact token containing user info, signed by the server. The signature proves the token was not tampered with. The gateway verifies the signature without calling the auth database. |
| **Rate Limiting** | Capping how many requests a user or IP can make per time window. Prevents abuse. "Only 1000 requests per hour per API key." |
| **Circuit Breaker** | A protection switch. If service X has been failing 50% of the time, stop sending it requests for 30 seconds. Avoids piling up requests on a broken service. |
| **Load Balancing** | Spreading requests across multiple instances of the same service. Like a traffic officer directing cars to different lanes so no single lane is jammed. |
| **Request Transformation** | Changing a request before forwarding it. For example, adding an internal header, renaming a query parameter, or converting XML to JSON. |
| **Service Discovery** | A registry where services register their current IP address. The gateway looks here to find where to send requests instead of using hardcoded addresses. |
| **Observability** | The ability to understand what is happening inside your system by looking at logs, metrics, and traces without changing the code. |
| **TLS Termination** | The gateway receives encrypted HTTPS traffic, decrypts it, and forwards plain HTTP to internal services. Internal services do not need to handle encryption — the gateway does it centrally. |
| **Canary Deployment** | Routing 5% of traffic to a new version of a service while 95% still goes to the old version. If the new version is broken, only 5% of users are affected. |
| **Health Check** | A periodic ping to a service endpoint (usually GET /health). If the endpoint stops responding, the gateway removes that service instance from its routing pool. |

---

## Component Diagram

```mermaid
graph TB
    subgraph CLIENTS["Clients"]
        WEB["Web Browser"]
        MOB["Mobile App"]
        PARTNER["Partner API Client"]
        INTERNAL["Internal Microservice"]
    end

    subgraph GW["API Gateway Cluster — horizontally scaled"]
        LB["Global Load Balancer — anycast DNS"]
        GW1["Gateway Node 1"]
        GW2["Gateway Node 2"]
        GW3["Gateway Node 3"]
    end

    subgraph CROSS["Cross-Cutting Concerns — applied in order"]
        TLS["1. TLS Termination — decrypt HTTPS"]
        AUTH["2. Authentication — verify JWT or API key"]
        AUTHZ["3. Authorization — check RBAC permissions"]
        RL["4. Rate Limiting — check Redis counter"]
        TRANSFORM["5. Request Transform — add internal headers"]
        ROUTE["6. Route to target service"]
    end

    subgraph SERVICES["Upstream Microservices"]
        USER_SVC["User Service — port 8001"]
        ORDER_SVC["Order Service — port 8002"]
        PRODUCT_SVC["Product Service — port 8003"]
        PAYMENT_SVC["Payment Service — port 8004"]
    end

    subgraph INFRA["Supporting Infrastructure"]
        REDIS["Redis — rate limit counters and circuit breaker state"]
        SERVICE_DISC["Consul — service registry with health check"]
        METRICS["Prometheus — request count, latency, error rate metrics"]
        LOGS["Elasticsearch — structured request logs with correlation IDs"]
        TRACE["Jaeger — distributed traces across multiple services"]
    end

    WEB & MOB & PARTNER & INTERNAL --> LB
    LB --> GW1 & GW2 & GW3
    GW1 --> TLS --> AUTH --> AUTHZ --> RL --> TRANSFORM --> ROUTE
    ROUTE --> USER_SVC & ORDER_SVC & PRODUCT_SVC & PAYMENT_SVC
    GW1 --> REDIS & SERVICE_DISC & METRICS & LOGS & TRACE
```

---

## Request Lifecycle Flow

```mermaid
sequenceDiagram
    participant C as Client App
    participant GW as API Gateway
    participant REDIS as Rate Limit Redis
    participant AUTH as Auth Service (JWT validation cache)
    participant ORDER as Order Service
    participant TRACE as Jaeger Tracing

    C->>GW: GET /api/orders/123  Authorization: Bearer eyJhbG...
    GW->>GW: TLS decryption done — plain HTTP internally
    GW->>GW: Extract JWT from Authorization header
    GW->>AUTH: Verify JWT signature — check expiry — decode claims
    AUTH-->>GW: valid  userId=U1  roles=[customer]  exp=in 1 hour
    GW->>REDIS: INCR ratelimit:U1:2026041214  (minute bucket)
    REDIS-->>GW: 47  (47th request this minute)
    GW->>GW: 47 < 100 allowed — proceed
    GW->>GW: Add headers  X-User-Id: U1  X-Request-Id: req-abc  X-Roles: customer
    GW->>TRACE: Start trace span  traceId=tr-999  service=order-service
    GW->>ORDER: GET /orders/123  (with injected headers)
    ORDER-->>GW: 200 OK  JSON order data
    GW->>TRACE: End span  duration=45ms  status=200
    GW->>GW: Strip internal headers from response
    GW-->>C: 200 OK  JSON order data  X-Request-Id: req-abc
```

---

## Circuit Breaker State Machine

```mermaid
flowchart TD
    CLOSED["CLOSED — Normal operation — requests pass through to service"]
    OPEN["OPEN — Service is broken — requests fail immediately with 503"]
    HALF_OPEN["HALF-OPEN — Probe mode — allow 1 request per 10 seconds to test recovery"]

    CLOSED --> |"Error rate exceeds 50% in 30s window"| OPEN
    OPEN --> |"30 seconds timeout expires"| HALF_OPEN
    HALF_OPEN --> |"Test request succeeds"| CLOSED
    HALF_OPEN --> |"Test request fails"| OPEN
```

---

## Routing Decision Logic

```mermaid
flowchart TD
    A["Incoming request  GET /api/orders/123"] --> B{"Match route table"}
    B -- "/api/orders/*  stable version" --> C["Route to Order Service v1  90% traffic"]
    B -- "/api/orders/*  canary" --> D["Route to Order Service v2  10% traffic"]
    B -- "/api/users/*" --> E["Route to User Service"]
    B -- No match --> F["Return 404 Not Found"]

    C --> G{"Circuit Breaker State for Order Service v1?"}
    G -- CLOSED --> H["Forward request — choose healthy instance from Consul"]
    G -- OPEN --> I["Return 503 Service Unavailable — circuit is open"]
    H --> J{"Response received within timeout 5000ms?"}
    J -- Yes --> K["Forward response to client"]
    J -- Timeout --> L["Return 504 Gateway Timeout to client  close circuit breaker if threshold exceeded"]
```

---

## Bottlenecks — Every Point Explained

| # | Bottleneck | Why It Hurts | Fix |
|---|---|---|---|
| 1 | **JWT verification on every request** | Verifying a JWT signature takes 1-2ms of CPU per request. At 100,000 RPS, this adds up. | Cache valid JWT claims in Redis for the token's remaining validity period. First request does the crypto; subsequent requests are cache lookups. |
| 2 | **Rate limit Redis as a single point of failure** | If Redis is down, the gateway cannot check rate limits. Choose to either block all traffic (safe) or let all traffic through (unsafe). | Redis Sentinel with auto-failover. Accept fail-open for rate limits (let traffic through) during Redis downtime rather than blocking all users. |
| 3 | **Gateway becomes a single bottleneck** | All traffic funnels through the gateway cluster. A bug in gateway code can take down 100% of your site. | Run multiple gateway nodes behind a hardware load balancer. Use immutable infrastructure: never change a running gateway node — deploy new ones and shift traffic. |
| 4 | **Latency added by each middleware step** | Each cross-cutting concern (auth, rate limit, logging) adds latency in series. 6 steps × 2ms each = 12ms overhead per request. | Async steps for non-blocking concerns (logging, tracing). Cache everything that can be cached. Keep gateway logic thin — complex business logic belongs inside services. |
| 5 | **Service discovery cache staleness** | Consul has a healthy instance registered. Instance crashes. Gateway still routes to it for up to 10 seconds (health check interval). | Short health check intervals (5s). Gateway-level connection health: if a TCP connection fails, immediately mark that instance as potentially unhealthy and reduce its weight. |

---

## What Happens When Each Part Fails?

```mermaid
flowchart TD
    F1["Gateway Node Crashes — Traffic Spike or OOM Kill"]
    F2["Auth Service Is Down — Cannot Validate JWT Tokens"]
    F3["Upstream Service Times Out — Order Service Is Slow"]
    F4["Redis Rate Limit Store Is Unreachable"]
    F5["SSL Certificate Expires — HTTPS Breaks for All Clients"]

    F1 --> R1["API Gateway runs as a cluster of 3+ nodes.
    Load balancer health check runs every 5 seconds.
    If node 1 crashes: health check fails three times in 15 seconds.
    Load balancer removes node 1 from rotation.
    All traffic redistributes to nodes 2 and 3.
    Each node handles 2x normal load during this period.
    Auto-scaling monitor detects high CPU on nodes 2 and 3.
    Spins up replacement node 4 within 60-90 seconds.
    Total user impact: potentially 5-15 seconds of elevated latency on some requests.
    Zero requests fail due to LB health check and multi-node cluster."]

    F2 --> R2["JWT validation does not call Auth Service on every request.
    JWT signature is verified cryptographically using the public key stored in the gateway.
    Auth Service is only needed to ISSUE JWTs (login) and to REVOKE them (logout/ban).
    If Auth Service is down:
    - Login requests FAIL — users cannot get new tokens
    - Existing valid unexpired JWTs continue to work fine
    The gateway validates tokens using locally cached public keys.
    To handle token revocation during Auth Service downtime:
    Cache a token blocklist in Redis. Check blocklist on each request.
    If Redis is also down: accept risk of blocked tokens working for up to 1 hour
    (typical JWT expiry) — log all such requests for post-recovery audit."]

    F3 --> R3["Gateway applies a per-request timeout (default 5000ms to Order Service).
    If Order Service does not respond within 5 seconds:
    Gateway returns 504 Gateway Timeout to the client.
    Gateway logs the timeout with traceId, serviceId, and timestamp.
    Circuit breaker monitors error rate: if 50% of requests to Order Service
    timeout or error within a 30-second window, circuit OPENS.
    Subsequent requests to /api/orders/* immediately get 503 without waiting.
    This prevents threads from piling up waiting for a broken service.
    After 30 seconds, circuit moves to HALF-OPEN and sends one probe request.
    If Order Service recovered, circuit CLOSES — normal operation resumes."]

    F4 --> R4["Rate limiting Redis becomes unreachable.
    Gateway implements fail-open policy: when Redis is down, do not rate limit.
    This prevents legitimate users from being blocked due to infrastructure failure.
    Risk: a malicious actor could spam requests during this window.
    Mitigation: WAF (Web Application Firewall) upstream provides IP-level rate limiting
    independent of the Redis-based per-user rate limiting.
    The two layers ensure that even with Redis down, raw request flooding is still blocked.
    Alert fires the moment Redis becomes unreachable — oncall restores within minutes."]

    F5 --> R5["SSL certificate expiry is the #1 embarrassing but easily preventable outage.
    All browsers show 'Not Secure' and refuse to connect.
    Prevention: Let's Encrypt with auto-renewal every 60 days.
    Use AWS ACM (Certificate Manager) which auto-renews and deploys certificates.
    Monitor with: certificate expiry check in Prometheus 30 days before expiry.
    PagerDuty alert 30 days out (warning) and 7 days out (critical).
    Emergency fix if expired: ACM renews in under 5 minutes once triggered.
    Recovery time after manual trigger: 5-10 minutes.
    Do NOT use self-signed certificates in production — all clients will reject them."]
```

---

## How It All Works Together

Imagine you are sending a letter through a massive post office. The API Gateway is that post office.

**Step 1 — You arrive:** Your request hits the Global Load Balancer which is just like traffic lights routing cars. It picks a healthy Gateway Node and sends your request there.

**Step 2 — Security check:** The gateway unwraps your HTTPS envelope (TLS Termination), reads your ID card (JWT), confirms it is genuine by checking the signature, then looks up your permissions (Authorization).

**Step 3 — Speed enforcement:** It checks Redis to see how many requests you made this minute. If you are within the limit, it stamps "approved" and adds internal labels (request transformation headers) so downstream services know who you are without checking themselves.

**Step 4 — Finding the right department:** The gateway looks at your request URL, matches it against routing rules, consults Consul (the service registry) to find a healthy instance of the target service, and forwards your request.

**Step 5 — Recording everything:** While this happens, every step creates an entry in logs (Elasticsearch), increments a counter in Prometheus (how many requests, how long they took), and adds a trace span to Jaeger (so you can see the full journey of the request end-to-end).

**The beauty:** Every service behind the gateway gets a pre-verified, pre-labelled request. Services do NOT need to know anything about JWT parsing, rate limiting, or TLS. They just receive plain HTTP with identity headers already attached. The gateway handles all of that in one place.

---

## ELI5 — Explain to a 5-Year-Old

> **API Gateway** = The teacher at the classroom door who decides who gets inside.
>
> **JWT** = Your school ID card. Once issued, any teacher can check it is real without calling the office.
>
> **Rate Limiting** = "You already asked 100 questions today. Go sit down quietly."
>
> **Circuit Breaker** = Like a power switch. If the toaster keeps sparking, flip the switch OFF so it does not burn the house down. Flip it back ON once it cools down.
>
> **TLS Termination** = The gateway opens your sealed letter, reads it, then sends the message inside through the building's internal mail (plain HTTP). No one outside the building can read it.
>
> **Canary Deployment** = Give 10 students the new lunch menu and 90 students the old one. If the 10 kids all feel sick, throw away the new menu. If they are fine, switch everyone.
>
> **Service Discovery** = A school directory. Instead of memorising every teacher's room number, you look up "Math teacher" in the directory and it tells you Room 12B.

---

## Tradeoffs

| Decision | Option A | Option B | When to Pick A | When to Pick B |
|---|---|---|---|---|
| **JWT validation** | Validate locally with cached public key (fast, no network call) | Call Auth Service on every request (always fresh, can check revocations) | High traffic where latency matters; accept 1-hour revocation lag | Financial apps where instant revocation of stolen tokens is critical |
| **Rate limit on fail** | Fail-open: allow all traffic when Redis is down | Fail-closed: block all traffic when Redis is down | Consumer apps — user experience matters | Security-critical APIs where abuse during an outage is unacceptable |
| **Circuit breaker** | Open circuit after 50% errors in 30s (aggressive) | Open circuit after 80% errors in 60s (tolerant) | Fast-fail to protect system overall | Tolerate temporary spikes without tripping |
| **Gateway complexity** | Thin gateway: only routing + auth | Fat gateway: business logic, aggregation, response caching | Microservices architecture — services own logic | BFF (Backend For Frontend) pattern where gateway tailors responses per client |
| **TLS** | Terminate at gateway, plain HTTP inside | End-to-end TLS (re-encrypt before forwarding) | Trusted internal network (VPC) | Zero-trust network where internal traffic is also encrypted |
| **Single gateway** | One centralized gateway | Per-team or per-service sidecar proxy (service mesh) | Small teams wanting simplicity | Large organizations where teams need independent deployment of gateway rules |

---

## Cross Questions

**Q1: Why not just put all the auth logic inside each microservice instead of a gateway?**
> Every service would need to implement JWT validation, rate limiting, and logging. That means the same code in 20 services. Any security update must be deployed to all 20 simultaneously. A gateway centralizes this: fix once, affects all. The downside is the gateway becomes a critical single point — hence you run it as a cluster.

**Q2: What is the difference between a Load Balancer and an API Gateway?**
> A Load Balancer distributes traffic across identical instances of the same service — purely traffic distribution. An API Gateway does routing (different URLs to different services), auth, rate limiting, transformation, and observability. In practice, you have BOTH: a load balancer in front of the gateway cluster, and the gateway distributing to individual services.

**Q3: If the gateway is stateless, where does session state live?**
> JWTs are self-contained — the token itself carries the user's identity. The gateway does not need to look up a session in a database. This is why JWTs are preferred over opaque session tokens for gateway-level auth. The only stateful thing is the rate limit counter (in Redis) and the circuit breaker state (in Redis).

**Q4: How would you route a request differently for mobile vs web clients?**
> Use the User-Agent header or a custom X-Client-Type header. The gateway inspects this and routes to a mobile-optimized BFF (Backend For Frontend) service that returns smaller payloads, while web clients go to a different BFF that returns richer data. Alternatively, use GraphQL which lets clients specify exactly which fields they need.

**Q5: How do you debug a request that failed inside a microservice, given you only have the gateway logs?**
> The gateway injects an X-Request-Id (correlation ID) header into every request. The same ID appears in gateway logs, in each service's logs, and in the distributed trace in Jaeger. You can take a single request ID from a user complaint, search across all log sources, and reconstruct the full journey of that request.

---

## Key Numbers

| Metric | Value |
|---|---|
| Gateway overhead per request | 5-15 ms (auth check + rate limit) |
| JWT validation (local with cache) | Under 1 ms |
| Circuit breaker threshold | 50% error rate in 30-second window |
| Circuit breaker open duration | 30 seconds before half-open probe |
| Health check interval | Every 5 seconds |
| TLS handshake overhead | ~5ms (amortized with connection keep-alive) |
| Rate limit storage | Redis — O(1) per request |
