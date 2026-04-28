# Gateway Routing Pattern: Route Requests to Services

**Module**: M11 — Cloud Design Patterns  
**Topic**: T29 of 37  
**Difficulty**: Intermediate  
**Read Time**: ~27 min

---

## 1. ELI5 (Explain Like I'm 5)

Imagine a large hospital with ONE main entrance. When you arrive, the receptionist asks about your needs and directs you to the right department: cardiology on floor 3, radiology in building B, emergency room through the red doors. You don't need to know the hospital's internal layout. The receptionist handles all that complexity.

**Gateway Routing** is this receptionist. Your client sends requests to one address; the gateway figures out which backend service handles each request and routes it there automatically.

---

## 2. The Analogy

A **hospital receptionist at the main entrance**. You tell them what you need, they direct you to the right department. If the hospital reorganizes departments or adds new wings, you still go to the same main entrance — the receptionist's routing logic just updates behind the scenes.

Key distinction: A **load balancer** distributes visitors between 5 identical receptionists on the same floor. A **gateway router** sends cardiology patients to floor 3 and radiology patients to building B — different services entirely.

---

## 3. Why This Matters in Interviews

Gateway Routing appears in virtually every microservices design discussion. It's a litmus test for microservices maturity:

- **Junior engineers** confuse it with a simple reverse proxy
- **Senior engineers** discuss routing strategies, version migration patterns, and failure isolation
- **Staff+ engineers** discuss when to use service mesh vs centralized gateway, organizational implications

Expect this topic when designing APIs, discussing service mesh architectures, or explaining how clients interact with distributed systems. The depth of your answer reveals whether you've actually built production microservices.

---

## 4. Core Concept

Gateway Routing is a design pattern where a **single gateway component receives all client requests and routes them to appropriate backend services based on request attributes**. Unlike a load balancer that distributes requests across multiple instances of the same service, a routing gateway directs requests to **entirely different services** based on URL paths, HTTP headers, query parameters, or request content.

This pattern emerged as a response to microservices proliferation. When Netflix transitioned to hundreds of microservices, clients couldn't reasonably maintain connections to every service. The gateway provides a **unified entry point** — clients make one connection to `api.netflix.com`, and the gateway routes `/recommendations` to the recommendation service, `/playback` to the streaming service, and `/billing` to the payment service.

The gateway maintains a **routing table** that maps request patterns to backend service endpoints. When a request arrives, the gateway evaluates routing rules in order, finds the first match, and forwards the request to the corresponding service. This decouples clients from your internal service topology.

---

## 5. ASCII Diagrams

### Gateway Routing — Core Flow
```
Client: GET /users/123/orders
             │
             ▼
    ┌─────────────────────────────────────────┐
    │           API GATEWAY                   │
    │   Routing Table:                        │
    │   /api/users/**  → user-service         │
    │   /api/orders/** → order-service        │
    │   /api/products? → product-service      │
    │   /api/auth/**   → auth-service         │
    └──────────────────┬──────────────────────┘
                       │ Match: /users/123/orders → order-service
                       │ Service discovery → [3 healthy instances]
                       ▼
             ┌──────────────────┐
             │   Order Service  │ ← load balanced across instances
             │   Instances:     │
             │   :3001, :3002,  │
             │   :3003          │
             └──────────────────┘
```

### Routing Strategies
```
PATH-BASED (most common)      
/api/users/**  → user-svc     
/api/orders/** → order-svc    
/api/products  → product-svc  

HEADER-BASED (versioning)     
API-Version: v2 → new-service  
API-Version: v1 → legacy-svc  
User-Agent: Mobile → mobile-svc

WEIGHTED (canary releases)    
95% → stable-version          
5%  → canary-version          

GEOGRAPHIC (compliance)       
EU users       → eu-datacenter 
US users       → us-datacenter 
```

### API Versioning Through Routing
```
GET /charges + Stripe-Version: 2023-01-15 ──► Legacy Service (v1)
GET /charges + Stripe-Version: 2024-06-01 ──► Modern Service (v2)
GET /charges (no version header)           ──► Default/Latest Service

Same endpoint URL, different backends based on version header.
Clients don't know when Stripe refactors their billing service.
```

### Canary Release with Weighted Routing
```
Production Traffic (1000 users)
         │
    ┌────▼────────────────┐
    │    API GATEWAY       │
    │    Routing Rule:     │
    │    95% → stable      │
    │    5%  → canary      │
    └────┬────────┬────────┘
         │95%     │5%
    ┌────▼──┐  ┌──▼──────────┐
    │Stable │  │Canary v1.6.0│
    │v1.5.0 │  │Monitor:     │
    │18 inst│  │Error: 0.3%  │
    └───────┘  └─────────────┘
```

---

## 6. How It Works — Step by Step

**Step 1: Client Request Arrives**  
Client sends HTTP request to the gateway's public endpoint (`https://api.company.com/users/123/orders`). Behind a load balancer distributing across multiple gateway instances for HA.

**Step 2: Route Evaluation**  
Gateway evaluates routing rules against incoming request in priority order:
1. `/users/{id}/orders` → orders-service
2. `/users/{id}/profile` → user-service  
3. `/users/**` → user-service (catch-all)  
First matching rule wins.

**Step 3: Service Discovery**  
Gateway queries service registry (Consul, Eureka, Kubernetes DNS) to get current healthy instances, e.g., `[orders-service-1:8080, orders-service-2:8080, orders-service-3:8080]`. Dynamic — no hardcoded IPs.

**Step 4: Request Transformation**  
Gateway may add authentication headers, strip sensitive info, rewrite URLs, inject tracing headers. Crucial for maintaining backward compatibility when backend APIs evolve.

**Step 5: Backend Invocation**  
Forwards transformed request to one healthy instance (load balancing picks which). Sets per-call timeouts. If no response within timeout → fail fast.

**Step 6: Response Processing**  
Gateway receives backend response, may transform it (CORS headers, remove internal fields), then sends to client.

**Step 7: Observability**  
Throughout: logs request count, latency, error rates per route. Participates in distributed tracing (propagates trace IDs). Essential for understanding traffic patterns and debugging.

---

## 7. Variants / Types

### 1. Path-Based Routing (Most Common)
Match URL paths to services. A rule like `/api/users/**` → user-service sends all user-related requests to one service.  
**Pros**: Intuitive, easy to debug, works with HTTP caching  
**Cons**: Can lead to overly granular services; doesn't handle cross-cutting concerns well  
**Example**: Amazon API Gateway maps path prefixes to Lambda functions or backend services

### 2. Header-Based Routing
Route based on HTTP headers — API version, User-Agent, X-Tenant-ID.  
**Pros**: Flexible, enables gradual rollouts, supports multi-tenancy  
**Cons**: Harder to debug (logic not visible in URL), requires client cooperation  
**Example**: Salesforce routes enterprise customers to dedicated infrastructure via header; smaller customers to shared infra — same API endpoint

### 3. Content-Based Routing
Gateway inspects request bodies or query parameters. A payment gateway routes credit card transactions to one processor and ACH to another based on `payment_method` field.  
**Pros**: Fine-grained routing, works well with GraphQL  
**Cons**: Must parse request bodies (slower), harder to cache  
**Example**: Shopify's GraphQL gateway routes queries touching product data to catalog service, order data to fulfillment service

### 4. Weighted Routing (Canary Releases)
Distribute traffic between service versions based on percentages. 95% stable, 5% canary.  
**Pros**: Safe deployments, easy rollback, real production validation  
**Cons**: Requires sophisticated monitoring to detect issues in small traffic percentage  
**Example**: Google shifts traffic from 1% → 5% → 25% → 100% over hours/days, monitoring at each step

### 5. Geographic Routing
Route requests to different backend regions based on client location.  
**Pros**: Lower latency, regulatory compliance (GDPR data residency), cost optimization  
**Cons**: Multi-region infrastructure, data consistency complexity  
**Example**: Netflix geographic routing directs users to nearest CDN; EU data stays in EU

---

## 8. Trade-offs

### Centralized vs. Distributed Routing

| | Centralized Gateway | Service Mesh (Istio/Linkerd) |
|---|---|---|
| **Control** | Single control point | Distributed sidecars |
| **Scale** | Can bottleneck at 100K+ RPS | No central bottleneck |
| **Debugging** | Simple (one place) | Complex (routing scattered) |
| **Infrastructure** | Simpler to start | Needs Kubernetes expertise |
| **Use at** | < 100K RPS, starting out | > 100K RPS, deep K8s expertise |

**Example**: Spotify migrated from centralized Nginx to distributed Envoy service mesh as they scaled to millions RPS.

### Static vs. Dynamic Routing Rules

| | Static | Dynamic |
|---|---|---|
| **Config** | File/IaC, redeploy to change | Updated via admin API at runtime |
| **Predictability** | High | Medium |
| **Experimentation** | Slow (deployment needed) | Instant (A/B tests, emergency changes) |
| **Risk** | Low | Misconfiguration → immediate P0 |
| **Use** | Stable, well-understood routes | Frequent experiments, emergency routing |

### Smart vs. Dumb Gateway

| | Smart Gateway | Dumb Gateway |
|---|---|---|
| **What it does** | Aggregation, transformation, caching | Just routes + enforces policies |
| **Flexibility** | High (tailors per client) | Low |
| **Maintenance** | Every new feature = gateway update | Push to services |
| **Use when** | Control the clients (mobile apps) | Public APIs, diverse clients |

---

## 9. When to Use / When to Avoid

### ✅ Use When
- Microservices architecture needing a unified entry point
- Clients should be decoupled from internal service topology
- Multiple services need to be exposed through one hostname
- API versioning coexistence needed
- Canary deployments / A/B testing required
- Migrating from monolith to microservices (Strangler Fig pattern)

### ❌ Avoid / Be Careful When
- Routing all internal service-to-service traffic through gateway (bottleneck + SPOF)
- Using regex for all routing rules (slow, error-prone — use prefix matching first)
- Smart gateway with aggregation logic that changes frequently
- Scale > 1M RPS without distributed routing strategy

---

## 10. MERN Dev Notes

### Express Gateway Routing

```javascript
// gateway/routes.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const consul = require('consul')();

// Service discovery — cache with TTL
const serviceCache = new Map();
const CACHE_TTL = 5000; // 5 seconds

async function getServiceUrl(serviceName) {
  const cached = serviceCache.get(serviceName);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.url;
  
  const services = await consul.health.service({ service: serviceName, passing: true });
  if (!services.length) throw new Error(`No healthy instances of ${serviceName}`);
  
  // Round-robin load balancing
  const service = services[Math.floor(Math.random() * services.length)][1];
  const url = `http://${service.Address}:${service.Port}`;
  serviceCache.set(serviceName, { url, ts: Date.now() });
  return url;
}

function createRoute(path, serviceName, options = {}) {
  return createProxyMiddleware({
    router: async () => getServiceUrl(serviceName),
    changeOrigin: true,
    pathRewrite: options.pathRewrite,
    timeout: options.timeout || 5000,
    on: {
      error: (err, req, res) => {
        res.status(503).json({ error: 'Service unavailable' });
      }
    }
  });
}

module.exports = (app) => {
  // Path-based routing
  app.use('/api/users', createRoute('/api/users', 'user-service'));
  app.use('/api/orders', createRoute('/api/orders', 'order-service'));
  app.use('/api/products', createRoute('/api/products', 'product-service'));
  
  // Header-based routing (API versioning)
  app.use('/api/payments', async (req, res, next) => {
    const version = req.headers['api-version'] || 'v1';
    const serviceName = version === 'v2' ? 'payment-service-v2' : 'payment-service';
    createRoute('/api/payments', serviceName)(req, res, next);
  });
};
```

### Weighted Routing for Canary Deployments

```javascript
// gateway/canary-router.js
class CanaryRouter {
  constructor(stableUrl, canaryUrl, canaryPercent = 5) {
    this.stableUrl = stableUrl;
    this.canaryUrl = canaryUrl;
    this.canaryPercent = canaryPercent;
  }
  
  route(userId) {
    // Consistent hashing — same user always goes to same version
    const hash = this._hash(userId) % 100;
    return hash < this.canaryPercent ? this.canaryUrl : this.stableUrl;
  }
  
  _hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
  
  updateCanaryPercent(percent) {
    this.canaryPercent = percent;
    console.log(`Canary traffic updated to ${percent}%`);
  }
}

// Usage in gateway middleware
const canaryRouter = new CanaryRouter(
  'http://checkout-service-stable:3000',
  'http://checkout-service-canary:3000',
  5 // 5% canary
);

app.use('/api/checkout', (req, res, next) => {
  const target = canaryRouter.route(req.user?.id || req.ip);
  
  createProxyMiddleware({
    target,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq) => {
        // Label for metrics
        proxyReq.setHeader('X-Served-By', 
          target.includes('canary') ? 'canary' : 'stable');
      }
    }
  })(req, res, next);
});
```

### Circuit Breaker for Gateway Routes

```javascript
// gateway/circuit-breaker.js
class CircuitBreaker {
  constructor(threshold = 5, cooldownMs = 30000) {
    this.failures = {};
    this.state = {}; // 'closed' | 'open' | 'half-open'
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
  }
  
  async call(serviceKey, fn) {
    if (this.state[serviceKey] === 'open') {
      const failedAt = this.failures[serviceKey]?.lastFailure;
      if (Date.now() - failedAt < this.cooldownMs) {
        throw new Error(`Circuit open for ${serviceKey}`);
      }
      this.state[serviceKey] = 'half-open';
    }
    
    try {
      const result = await fn();
      if (this.state[serviceKey] === 'half-open') {
        this.state[serviceKey] = 'closed';
        this.failures[serviceKey] = { count: 0 };
      }
      return result;
    } catch (err) {
      const failures = this.failures[serviceKey] || { count: 0 };
      failures.count++;
      failures.lastFailure = Date.now();
      this.failures[serviceKey] = failures;
      
      if (failures.count >= this.threshold) {
        this.state[serviceKey] = 'open';
        console.warn(`Circuit OPENED for ${serviceKey} after ${failures.count} failures`);
      }
      throw err;
    }
  }
}
```

---

## 11. Real-World Examples

### Netflix: Zuul API Gateway
Netflix built Zuul to handle routing for their microservices architecture. When a Netflix client makes a request, Zuul routes to over 500 backend services using path-based routing combined with dynamic filters.

**Key detail**: Zuul implements **dynamic routing rules that can be updated without redeployment**. During incidents, Netflix engineers can instantly reroute traffic away from failing services or redirect to cached responses. Zuul also handles A/B testing — route a percentage of users to experimental versions based on user IDs. Netflix open-sourced Zuul; it became the foundation for Spring Cloud Gateway.

### Stripe: API Versioning Through Routing
Stripe's gateway enables seamless API versioning. `Stripe-Version: 2023-10-16` header routes to legacy service; `Stripe-Version: 2024-06-01` routes to refactored microservice. The gateway handles **request/response transformation** to maintain backward compatibility: translate new field names to old ones for legacy clients.

**Key detail**: Stripe's gateway logs which API versions are being used, helping identify when it's safe to deprecate old versions. They stated < 1% of traffic uses versions older than 2 years, informing deprecation policy. Same endpoint URL, different backends — completely transparent to clients who don't upgrade.

### Shopify: GraphQL Gateway with Schema Stitching
Shopify's gateway routes GraphQL queries to multiple backend services based on **which fields are requested**. A query for product and order data → gateway parses the query → routes sub-queries to catalog service and fulfillment service → stitches responses together.

**Key detail**: Shopify's gateway implements **intelligent batching** — if multiple clients request the same product data within a 10ms window, it batches those requests into a single backend call. Published result: batching reduces backend queries by 60% during peak traffic. Additionally, field-level caching: frequently requested fields (product titles) cached at gateway layer; dynamic fields (inventory counts) always hit backend.

---

## 12. Interview Cheat Sheet

### The 30-Second Answer
> "Gateway Routing consolidates multiple backend services behind a single entry point, directing requests based on URL paths, headers, or content. Unlike load balancing (which distributes across instances of the same service), routing sends requests to entirely different services. This decouples clients from your internal topology — when you reorganize services, client code doesn't change. Key failure handling: health checks, circuit breakers, timeouts, and fallbacks."

### Routing vs. Load Balancing
```
ROUTING: GET /users → user-service
         GET /orders → order-service
         → Different SERVICES based on request attributes

LOAD BALANCING: GET /users → user-service-instance-1
                            user-service-instance-2
                            user-service-instance-3
                → Same SERVICE, different INSTANCES (scaling)
```

### Key Interview Questions

**Q: Design gateway routing for monolith-to-microservices migration**  
Strangler Fig: Deploy gateway in front of monolith. Route all traffic to monolith initially. As services are extracted, add routing rules for specific paths to new services. Use weighted routing for safe cutover (5% → monitor → 100%).

**Q: Gateway bottleneck at 100K RPS. How do you scale?**  
1. Profile: CPU, memory, network I/O per route  
2. Optimize: cache service discovery results (5-10s TTL), connection pooling, async logging, trie-based route matching  
3. Horizontal scale: stateless instances behind L4 load balancer  
4. At extreme scale: consider service mesh (Istio sidecars) to eliminate central bottleneck  

**Q: Implement canary releases with gateway routing**  
Weighted routing (95% stable / 5% canary). Consistent hash of user ID (same user always hits same version). Monitor error rate + latency at each step. Feature flags for instant rollback without redeployment.

### Capacity Planning
```
Given: 50K RPS peak, 2ms routing, 100ms backend, 5s timeout

Concurrent connections = RPS × (routing + backend time)
= 50,000 × 0.102 = 5,100 (normal)
= 50,000 × 5 = 250,000 (worst case, all timeout)

Instances needed (for connections) = 250,000 / 10,000 per instance = 25
With 30% headroom: 33 instances
```

---

## Red Flags to Avoid

| Red Flag | Why Wrong | Say Instead |
|----------|-----------|-------------|
| "Routing and load balancing are the same" | Routing = different services; LB = same service, different instances | "Complementary: gateway routes to service; LB distributes across service instances" |
| "Route all internal traffic through gateway" | Bottleneck + SPOF; internal services should talk directly | "Gateway handles edge traffic; internal services use direct calls or service mesh" |
| "Use regex for all routing rules" | O(n), error-prone, hard to debug | "Prefix matching for 95% of routes; regex only for complex edge cases" |
| "Smart gateway should aggregate all data" | Coupling to all services; Gateway becomes monolith | "Aggregation in dedicated BFF services; gateway stays thin router" |

### Keywords / Glossary

| Term | Definition |
|------|------------|
| **Route table** | Map of request patterns to backend services maintained by gateway |
| **Service discovery** | Dynamic lookup of healthy service instances (Consul, Eureka, K8s DNS) |
| **Path-based routing** | Route based on URL path prefix (`/users/**` → user-service) |
| **Header-based routing** | Route based on request headers (API version, tenant ID, user agent) |
| **Weighted routing** | Send X% to one backend, Y% to another (canary deployments) |
| **Circuit breaker** | Stop calling a failing service after threshold; retry after cooldown |
| **Service mesh** | Distributed routing at sidecar level (Istio, Linkerd, Envoy) |
| **Path rewriting** | Transform URL before forwarding (`/api/v2/users` → `/users`) |
| **Strangler Fig** | Incremental monolith migration using gateway routing to redirect paths |
