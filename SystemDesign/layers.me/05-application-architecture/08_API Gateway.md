# API Gateway: The Front Door to Your Microservices

> **Module 5 — Application Architecture**  
> Source: https://layrs.me/course/hld/05-application-architecture/api-gateway

---

## ELI5 — Explain Like I'm 5

Imagine a hotel with 200 rooms. Guests don't walk directly into each room — they all go through the **front desk**. The front desk checks IDs, hands out key cards, directs guests to the right floor, and keeps a log of everything.

An API Gateway is that front desk: it's the **single entry point** that all external requests go through before reaching any microservice behind it.

---

## Analogy

| Hotel Front Desk | API Gateway |
|---|---|
| Checks guest ID | Validates JWT / API key |
| Limits guests to their rooms only | Authorization (you can only access your data) |
| Sends guest to the right floor | Routes request to the correct microservice |
| Records all check-ins | Access logging / audit trail |
| Has a daily guest limit | Rate limiting |
| "Do not disturb" sign → reroutes | Circuit breaking / fallback |

---

## Core Concept

Without an API Gateway, every microservice must independently implement auth, rate limiting, SSL, logging, and routing — duplicated N times.

```
WITHOUT API Gateway (duplicated concerns):
  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
  │ User Service│  │OrderService │  │SearchService│
  │  Auth ✗    │  │  Auth ✗    │  │  Auth ✗    │
  │  Rate limit │  │  Rate limit │  │  Rate limit │
  │  SSL       │  │  SSL       │  │  SSL       │
  └─────────────┘  └─────────────┘  └─────────────┘
         ▲                ▲                ▲
  Client calls each service directly (exposed IPs!)

WITH API Gateway (centralised):
  Client ──► [API Gateway] ──► User Service
                       └──────► Order Service
                       └──────► Search Service
  Auth / Rate Limit / SSL / Logging: handled ONCE in the gateway
```

---

## 6-Stage Request Pipeline

```
Incoming HTTPS request
        │
        ▼
1. TLS Termination
   Gateway decrypts HTTPS → internal plain HTTP (services in private VPC)
        │
        ▼
2. JWT / API Key Validation
   Decode + verify token signature; reject if expired/invalid (HTTP 401)
        │
        ▼
3. Rate Limit Check
   Redis: has this client exceeded their quota? (HTTP 429 if yes)
        │
        ▼
4. Service Discovery + Routing
   Resolve "payment-service" → healthy instance via registry
        │
        ▼
5. Upstream Request
   Gateway calls microservice(s) — sometimes in parallel (aggregation)
        │
        ▼
6. Response Aggregation + Cache
   Merge results from multiple services; apply response transforms; cache if cacheable
        │
        ▼
   Response to client
```

---

## Gateway Variants

### 1. Single Gateway

One gateway → all services. Simplest. Risk: single bottleneck and SPOF.

```
Mobile ─────────────┐
Web Browser ─────────┤──► API Gateway ──► Services
Third-party API ─────┘
```

### 2. BFF — Backend for Frontend

Separate gateways per client type, each optimised for that client's needs.

```
Mobile App ──────────► Mobile BFF ──────► Auth Service
                        (compact JSON,    Order Service
                         batched queries) Shipping Service

Web Browser ──────────► Web BFF ──────────► Auth Service
                        (rich queries,     Product Service
                         SSR data)         Recommendation

Third-party ──────────► Public API GW ────► (versioned, stable)
```

Netflix: 800+ device types each with their own data shape — BFF was essential.

### 3. Micro-Gateway / Sidecar

A small gateway runs as a sidecar container alongside each service.  
Handles service-to-service auth, retries, circuit breaking (Envoy, Linkerd).  
Sits at the east-west layer (service mesh), not north-south (external traffic).

### 4. GraphQL Gateway

Instead of multiple REST endpoints, a single GraphQL schema sits at the gateway.  
Client specifies exactly what data it needs. Gateway resolves across multiple services.

---

## API Gateway vs Service Mesh

| | API Gateway | Service Mesh |
|---|---|---|
| Traffic direction | North-south (external → internal) | East-west (service → service) |
| Concerns | Auth, rate limiting, routing, versioning | mTLS, retries, circuit breaking, observability |
| Examples | Kong, AWS API Gateway, Nginx, Express | Istio, Envoy, Linkerd |
| When to use | Always (for public APIs) | Large systems with many service-to-service calls |

**Large systems need both**: API Gateway for the front door, Service Mesh for internal traffic.

---

## API Versioning at the Gateway

```
Client sends: POST /v1/payments  (old request format)
              or
              POST /v2/payments  (new request format)

Gateway strategy:
  Route /v1 → transform request to modern format → Payment Service
            ← transform response back to v1 format ←
  Route /v2 → forward directly to Payment Service

Result: Legacy clients work unchanged. Service only maintains one modern version.
```

Stripe uses this pattern — they maintain backward compatibility for API versions going back years.

---

## Real-World Examples

| Company | Gateway | Detail |
|---|---|---|
| **Netflix** | Zuul (custom) | Processes millions of requests per second. 800+ device types each get different response shapes. A/B testing via routing config (10% of traffic to new service version) in real time |
| **Stripe** | Custom Express gateway | API versioning via request/response transformation (requests to `/v2019-01-01` are transformed and forwarded to same modern backend). Idempotency keys enforced at gateway layer |
| **AWS** | AWS API Gateway | Serverless-native — automatically scales, no servers to manage. Integrates with Lambda, ECS, ALB. Supports REST, HTTP, WebSocket APIs. Caches responses at gateway level |
| **Shopify** | Kong | Plugin-based gateway; rate limiting, analytics, and auth plugins wired in outside app code |

---

## MERN Dev Notes

**Option 1 — Custom Express gateway (simple, full control)**

```js
// gateway/index.js
const express    = require('express');
const httpProxy  = require('http-proxy-middleware');
const rateLimit  = require('express-rate-limit');
const jwt        = require('jsonwebtoken');

const app = express();

// 1. Rate limiting
app.use(rateLimit({ windowMs: 60000, max: 100 }));

// 2. Auth middleware
app.use((req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// 3. Route to microservices
app.use('/api/users',   httpProxy.createProxyMiddleware({ target: 'http://user-service:3001',    changeOrigin: true }));
app.use('/api/orders',  httpProxy.createProxyMiddleware({ target: 'http://order-service:3002',   changeOrigin: true }));
app.use('/api/products',httpProxy.createProxyMiddleware({ target: 'http://product-service:3003', changeOrigin: true }));

app.listen(3000);
```

**Option 2 — Kong (recommended for production)**

```yaml
# kong.yml — declarative config
services:
  - name: order-service
    url: http://order-service:3002
    routes:
      - name: order-routes
        paths: ["/api/orders"]
    plugins:
      - name: jwt
      - name: rate-limiting
        config: { minute: 100 }
```

**Option 3 — AWS API Gateway (serverless)**

```
API Gateway ──► Lambda function (Node.js)
              or
              ──► ALB (Application Load Balancer) → ECS containers
```

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| Why use an API Gateway? | Single entry point: centralises auth, rate limiting, SSL, logging, routing — no duplication across N services |
| BFF vs single gateway? | BFF: different gateway per client type, each optimised for that client's data shape. Single: simpler, one gateway for all clients |
| Gateway vs service mesh? | Gateway = north-south (external clients). Mesh = east-west (between services). Large systems need both |
| How does Netflix do 800+ device types? | BFF pattern — each device category has a gateway that transforms responses into the shape that device needs |
| How does API versioning work? | Gateway transforms old request format → modern service → transforms response back to old format. Old clients work unchanged |
| Gateway as SPOF? | Deploy gateway as a cluster with multiple instances behind a load balancer. No single gateway node |

**Red flags**:
- Business logic in the API Gateway (it should route/auth/limit, not compute)
- No circuit breaker at gateway (one failing service can cascade through gateway to all callers)
- Single gateway instance (SPOF)
- Hardcoded service IP addresses in gateway config (use service discovery)

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **API Gateway** | Single entry point that handles auth, routing, rate limiting, and aggregation for microservices |
| **BFF** (Backend for Frontend) | Pattern of having separate gateways optimised per client type (mobile, web, third-party) |
| **TLS Termination** | Decrypting HTTPS at the gateway; services inside the cluster communicate via plain HTTP on a private network |
| **JWT** (JSON Web Token) | Stateless token containing signed claims (user ID, roles); validated at the gateway without hitting a database |
| **Rate limiting** | Restricting requests per time window per client (handled at gateway to protect all services) |
| **Service Mesh** | Infrastructure layer for east-west (service-to-service) communication (mTLS, retries, circuit breaking) |
| **North-south traffic** | Requests flowing from external clients into the cluster (API Gateway territory) |
| **East-west traffic** | Requests flowing between services inside the cluster (Service Mesh territory) |
| **Kong** | Popular open-source API Gateway with plugin-based extensibility |
| **Envoy** | High-performance proxy used as sidecar in service meshes (Istio) |
| **Circuit breaker** | Pattern where the gateway stops forwarding requests to a failing service to prevent cascade failures |
| **A/B testing via gateway** | Routing a percentage of traffic to a new service version at the gateway level without any code change |
