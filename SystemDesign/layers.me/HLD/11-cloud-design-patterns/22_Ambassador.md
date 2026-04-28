# T22 — Ambassador Pattern: Offload Proxy Tasks

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/ambassador

---

## ELI5 (Explain Like I'm 5)

You're a CEO who needs to talk to international partners. Instead of learning every language, legal system, and protocol yourself, you hire an ambassador who sits in your office and handles all that complexity. The ambassador translates messages, retries failed communications, and monitors relationship health. You just say what you want; the ambassador handles the messy details. That's an Ambassador proxy — it sits next to your app and handles all the networking complexity so your app focuses on business logic.

---

## Analogy

**A diplomatic ambassador**: Your application speaks its native "language" (simple HTTP to localhost). The ambassador proxy speaks the complex protocols, adds required headers, handles authentication, tracks failures, and retries failed communications — all transparently. Your app never needs to know whether the payment service is running gRPC, requires mTLS certificates, or needs circuit breakers.

---

## Core Concept

The Ambassador pattern deploys a **helper proxy co-located with your application** (on the same host or in the same Kubernetes pod) that intercepts outbound network requests and handles cross-cutting networking concerns: retries, circuit breaking, rate limiting, TLS termination, service discovery, metrics, and distributed tracing.

**Key distinction from API gateway**: An API gateway sits at the network perimeter and handles inbound requests. An Ambassador runs co-located with each application instance and handles outbound requests. The Ambassador adds only microseconds of overhead (localhost IPC) vs. the milliseconds added by a remote gateway.

**Why it matters**: In polyglot microservices (Java, Python, Go, Node.js), you'd otherwise implement retry logic, circuit breakers, and distributed tracing in every language — inconsistently, with version drift, and with enormous maintenance burden. Ambassador centralizes this in one battle-tested proxy (Envoy, Linkerd) that every service uses regardless of language.

---

## ASCII Diagrams

```
AMBASSADOR REQUEST FLOW:

  Application                Ambassador Proxy             Service Registry
  (Business Logic)           (Envoy/Linkerd)
       │                           │                            │
       │── POST localhost:8080/pay─►│                            │
       │                           │── Query healthy instances──►│
       │                           │◄── [10.0.1.5, 6, 7]        │
       │                           │
       │                     [Enrichment]
       │                     + Tracing headers (X-B3-TraceId)
       │                     + mTLS certificate
       │                     + Check circuit breaker state
       │                     + Apply retry config
       │                     + Select instance (round-robin)
       │                           │
       │                           │── HTTPS (mTLS) ──────► Payment Service
       │                           │◄──────────── 200 OK ───────────────────
       │                           │
       │                     [Observability]
       │                     Record metrics: 45ms, 200 OK
       │                     Emit Zipkin span
       │                           │
       │◄── Response ──────────────│

CIRCUIT BREAKER STATE (10-second window):
  Requests: 50    Errors: 30 (60%)   → Circuit OPENS (>50% threshold)
  Requests: 15    Errors: 10 (67%)   → Circuit CLOSED (below 20 req minimum)
  Requests: 100   Errors: 49 (49%)   → Circuit CLOSED (just below 50% threshold)

LATENCY MATH (5 sequential service calls):
  App logic:                                20ms
  Ambassador overhead per call (1.5ms × 5): 7.5ms  
  Network per call (2ms × 5):              10ms
  Service latency per call (50ms × 5):    250ms
  Total sequential:                        287.5ms
  
  With parallelization:
  App logic + Ambassador + Network (once): 23.5ms
  max(service latency):                    50ms
  Total parallel:                          73.5ms ← 74% reduction
```

---

## How It Works (Step by Step)

1. **Application makes local request**: App calls `http://localhost:8080/payment-service`. Simple, local, no networking complexity in app code.

2. **Ambassador intercepts and enriches**: Adds distributed tracing headers, injects auth/mTLS, applies rate limiting, consults configuration (dynamic or static) for this specific route's retry policy and timeout.

3. **Service discovery**: Ambassador queries Consul/Kubernetes DNS to get current list of healthy instances `[10.0.1.5, 10.0.1.6, 10.0.1.7]`. Applies load balancing (round-robin, least-connections, weighted).

4. **Resilience patterns**: Checks circuit breaker state. If open → fail fast immediately. If closed → send request with configured timeout. If fails → retry with exponential backoff (100ms, 200ms, 400ms). Track success/failure rates, update circuit breaker state.

5. **Response and observability**: Records latency percentiles (p50, p95, p99), error rates, request volumes. Emits distributed tracing spans. Logs structured data. Returns response in simple format to application.

6. **Background health monitoring**: Continuously checks `/health` endpoints of downstream services. Removes unhealthy instances from load balancing pool automatically.

---

## Variants

| Variant | Description | When to Use |
|---------|-------------|-------------|
| **Sidecar Ambassador** | Runs as sidecar container in same Kubernetes pod (shares network namespace) | K8s microservices; Istio auto-injection. Strongest isolation. 1 proxy per pod |
| **Host-Level (DaemonSet)** | One Ambassador per host serving all applications on that host | VM-based deployments; too expensive to run per-pod. Netflix Zuul 2 style |
| **Library-Based** | Ambassador logic embedded as library in same process | Ultra-low latency required; single language shop; Netflix Hystrix approach |
| **Centralized (Remote)** | Shared Ambassador service over the network | Serverless functions; edge devices that can't run sidecars |
| **Protocol-Specific** | Handles specific protocols (MySQL via ProxySQL, Kafka) | Connection pooling, query routing, read/write splitting |

**Resource math**: Envoy uses ~50MB RAM + ~10KB per active connection. 600 pods × 51MB = 30.6GB. On 50-node cluster (3.2TB RAM total) = 1% overhead. Typically acceptable.

---

## Trade-offs

| Dimension | Library Approach | Ambassador (Out-of-Process) |
|-----------|-----------------|----------------------------|
| **Latency** | Zero IPC overhead | 1–2ms per hop |
| **Language support** | Language-specific implementations | Language-agnostic |
| **Update independence** | Must redeploy app to update | Independent lifecycle |
| **Crash isolation** | Ambassador crash kills app | Ambassador crash doesn't kill app |
| **Complexity** | Simpler (just a dep) | More ops complexity |

**Decision**: Use libraries for latency-critical paths with single language and acceptable coupling. Use proxies for polyglot envs, legacy apps, or when operational independence needed. 1-2ms overhead is negligible vs. 10-100ms network latency.

**Sidecar vs DaemonSet break-even**: Envoy = 50MB RAM. 20 pods/host → sidecars = 1GB vs DaemonSet = 50MB. But sidecars give isolation and simpler per-pod configuration.

---

## When to Use (and When Not To)

**Use when:**
- Polyglot microservices needing uniform retry/circuit-breaker/tracing behavior
- Legacy apps that can't be modified but need modern capabilities (circuit breaking, mTLS)
- Need to update networking policies (retry thresholds, timeouts) without redeploying apps
- Compliance requires mTLS everywhere and app teams shouldn't handle cert management

**Avoid when:**
- Single-language shop where in-process library suffices
- Ultra-low-latency system where 1-2ms Ambassador overhead exceeds budget
- Team doesn't have operational maturity to manage additional deployment complexity
- Simple service-to-service calls where retry/circuit-breaker are overkill

---

## MERN Developer Notes

```javascript
// Without Ambassador: App implements retry logic manually (duplicated across services)
const callPaymentService = async (payload) => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data } = await axios.post('https://payment-service.prod:443/charge', payload, {
        timeout: 500,
        headers: { 'Authorization': `Bearer ${await getServiceToken()}` } // must manage this too
      });
      return data;
    } catch (err) {
      lastError = err;
      await sleep(100 * Math.pow(2, attempt)); // exponential backoff
    }
  }
  throw lastError;
};

// With Ambassador: App calls localhost, Ambassador handles everything
const callPaymentService = async (payload) => {
  // Ambassador at localhost:8080 handles: retries, circuit-breaking, mTLS, tracing, metrics
  const { data } = await axios.post('http://localhost:8080/payment-service/charge', payload, {
    timeout: 1000 // overall budget only
  });
  return data;
};

// Ambassador config (Envoy-style YAML — managed by platform team, NOT app team):
/*
static_resources:
  listeners:
  - name: payment_service
    address: { socket_address: { address: 0.0.0.0, port_value: 8080 } }
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          route_config:
            virtual_hosts:
            - routes:
              - match: { prefix: "/payment-service" }
                route:
                  cluster: payment_cluster
                  retry_policy:
                    retry_on: "5xx,connect-failure"
                    num_retries: 3
                    per_try_timeout: 0.5s
  clusters:
  - name: payment_cluster
    circuit_breakers:
      thresholds:
      - max_connections: 1000
        max_pending_requests: 1000
    health_checks:
    - timeout: 1s
      interval: 5s
      http_health_check: { path: "/health" }
*/

// CRITICAL: Ambassador retries must only be enabled for idempotent operations!
// For POST /charge (non-idempotent), add idempotency key:
const chargeCard = async (amount, userId) => {
  const idempotencyKey = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { data } = await axios.post('http://localhost:8080/payment/charge', {
    amount, userId, idempotencyKey
  });
  return data;
  // Ambassador can now safely retry — payment service deduplicates by idempotencyKey
};
```

---

## Real-World Examples

| Company | Implementation | Key Detail |
|---------|---------------|-----------|
| **Lyft** | Created Envoy in 2016 for polyglot microservices (Python, Go, C++) | Envoy dynamically configurable via xDS API — update retry policies across 1,000+ services in seconds without redeploying anything. Lyft's solution became foundation for Istio, AWS App Mesh |
| **Netflix** | Zuul 2 as host-level Ambassador on EC2 instances | Handles millions of req/sec with Netty async I/O (10K+ concurrent connections per instance). Used for auth, rate limiting, routing, observability at edge |
| **Stripe** | Envoy sidecars for payment processing pipeline | Per-route retry logic: idempotent ops (card validity check) → retry aggressively. Non-idempotent (charge) → never auto-retry; return idempotency key to client instead |
| **Uber** | Envoy sidecars + Istio control plane for canary deploys | Control plane updates Ambassador to send 5% traffic to new service version. Monitors error rates; auto-rolls back if new version shows higher errors. Reduced incident rate 40% |

---

## Interview Cheat Sheet

### Q: How does Ambassador differ from an API Gateway?
**A:** API gateway sits at the **network perimeter** handling inbound requests from external clients — one per system. Ambassador runs **co-located** with each application instance handling outbound requests — one per pod/host. Ambassador overhead is microseconds (localhost IPC vs milliseconds for network hop). API gateway centralizes policies for ingress; Ambassador centralizes policies for egress.

### Q: Why use Ambassador instead of a library like Hystrix?
**A:** Three reasons: (1) **Language agnosticism** — one Ambassador serves all languages without per-language implementations. (2) **Independent lifecycle** — update retry policies without redeploying application. (3) **Process isolation** — Ambassador crash doesn't crash the application. The 1-2ms overhead is negligible vs. 10-100ms network latency. For single-language shops with tight latency budgets, libraries (Hystrix, Resilience4j) remain valid.

### Q: What's the biggest pitfall with Ambassador retries?
**A:** Retrying non-idempotent operations. If Ambassador retries a payment charge on 5xx, the customer gets double-charged. Solution: Only enable retries for idempotent operations (GET, or POST with idempotency keys). Use HTTP status codes correctly: 503 Service Unavailable = retriable, 400 Bad Request = NOT retriable. Implement idempotency keys at the application level for non-idempotent endpoints.

---

## Red Flags to Avoid

- "Sidecars are always better than libraries" — ignores operational cost; libraries are simpler for single-language shops
- Saying Ambassador adds "negligible" latency without measuring — it compounds across fan-out (5 services × 1.5ms = 7.5ms)
- Enabling retries on non-idempotent operations — duplicate payments, double inventory deductions
- Not setting resource limits on Ambassador containers — memory grows unbounded under load (OOM kills app)
- Using Ambassador but not integrating its logs/metrics into central monitoring — invisible in incidents

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Ambassador Pattern** | Co-located proxy handling cross-cutting networking concerns for an application |
| **Sidecar** | Container running alongside main app in same pod; Ambassador is a specialized sidecar |
| **Envoy** | Open-source L7 proxy by Lyft; became standard Ambassador implementation |
| **Istio** | Service mesh built on Envoy; provides automatic Ambassador injection, mTLS, and traffic management |
| **xDS Protocol** | Envoy's API for dynamic configuration from a control plane |
| **Circuit Breaker** | Pattern that stops sending requests to failing service (prevents cascading failures) |
| **mTLS** | Mutual TLS: both client and server authenticate each other; standard in service meshes |
| **Service Discovery** | Finding network locations of service instances dynamically (Consul, K8s DNS) |
| **Idempotency Key** | Unique identifier for an operation; allows safe retries without duplicates |
| **DaemonSet** | Kubernetes workload that runs one pod per node; used for host-level Ambassadors |
| **Transparent Interception** | iptables rules redirect traffic to Ambassador without application code changes |
| **Explicit Proxying** | Application explicitly calls localhost:8080 knowing it's a proxy |
| **Control Plane** | System that pushes configuration updates to Ambassador instances (Istio Pilot, Consul) |
| **xDS** | Envoy discovery service API: endpoint discovery (EDS), cluster (CDS), route (RDS), listener (LDS) |
