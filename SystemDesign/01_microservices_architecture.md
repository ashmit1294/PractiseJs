# Microservices Architecture
> Resume Signal: Node.js microservices, 10K+ concurrent users

---

## STAR Interview Answer

| | |
|---|---|
| **Situation** | A monolithic Node.js backend was hitting CPU/memory limits under peak load (~10K concurrent users). A single crashed process took down all features simultaneously. |
| **Task** | Re-architect to independently deployable services so each domain could scale, fail, and deploy without affecting others. |
| **Action** | Split the monolith into stateless microservices (User, Order, Payment, Notification). Introduced an API Gateway for routing, JWT validation, and rate limiting. Used Redis for shared session state so any instance could serve any request. Deployed via Kubernetes with HPA auto-scaling on CPU and RPS metrics. |
| **Result** | Sustained 10K+ concurrent users. Individual services scaled independently — Payment service ran at 10 replicas during peak; User service at 3. Total infrastructure cost dropped 22% vs over-provisioned monolith. Zero-downtime rolling deploys replaced scheduled maintenance windows. |

---

## ELI5

A monolith is like a single giant kitchen that cooks everything — if the grill breaks, the whole restaurant closes. Microservices split that kitchen into independent stations: one for burgers, one for salads, one for drinks. Each station runs on its own, scales independently, and a problem in one doesn't crash the others. They talk to each other through well-defined windows (APIs or message queues).

---

## Core Concept: Monolith vs Microservices

| Dimension | Monolith | Microservices |
|-----------|----------|---------------|
| Deployment | Single unit | Independent per service |
| Scaling | Scale whole app | Scale hotspots only |
| Team ownership | Shared codebase | Per-team per-service |
| Failure blast radius | Full app | Single service |
| Latency | In-process calls | Network hops |
| Data | Single DB | DB-per-service |
| Complexity | Low start, high growth | High start, manageable growth |

---

## Stateless Design

**Principle:** a service instance holds zero user/session state. Any instance can handle any request.

**Why it matters:**
- Horizontal scaling works — add 10 more instances, all are equivalent
- No sticky sessions required
- Crash of one instance loses nothing; load balancer routes to others

**Where state lives instead:**

| State Type | Storage |
|------------|---------|
| Session / auth | Redis (TTL-backed) |
| User data | Database |
| File uploads | S3 / Blob Storage |
| Distributed locks | Redis `SET NX PX` |
| Feature flags | LaunchDarkly / config service |

```javascript
// ❌ Stateful — breaks horizontal scaling
const activeSessions = new Map(); // lives in-process memory

app.post('/login', (req, res) => {
  activeSessions.set(req.body.userId, { token: 'abc', loginTime: Date.now() });
  res.json({ token: 'abc' });
});

// ✅ Stateless — any instance can validate the token
import redis from 'ioredis';
const cache = new redis(process.env.REDIS_URL);

app.post('/login', async (req, res) => {
  const token = generateJWT(req.body.userId);         // signed, self-contained
  await cache.setex(`session:${token}`, 3600, req.body.userId); // optional server-side revocation
  res.json({ token });
});

app.get('/profile', verifyJWT, async (req, res) => {
  // req.user comes from JWT payload — no DB lookup needed for auth
  const profile = await db.users.findById(req.user.id);
  res.json(profile);
});
```

---

## Service Discovery

When Service A needs to call Service B, it must find B's address. In dynamic environments (Kubernetes, ECS) instances come and go — hardcoding IPs breaks.

### Discovery Patterns

| Pattern | How it works | Used by |
|---------|-------------|---------|
| **Client-side discovery** | Client queries registry, picks instance, calls directly | Netflix Eureka |
| **Server-side discovery** | Client calls load balancer; LB queries registry | AWS ALB + ECS, K8s Service |
| **DNS-based** | Service name resolves via DNS to healthy IPs | Kubernetes (CoreDNS), Consul |
| **Service mesh** | Sidecar proxy intercepts all traffic, handles discovery | Istio, Linkerd |

**Kubernetes (most common in practice):**
```yaml
# Service B exposes itself under a stable DNS name
apiVersion: v1
kind: Service
metadata:
  name: payment-service       # DNS name inside cluster
spec:
  selector:
    app: payment
  ports:
    - port: 3001
```

```javascript
// Service A calls Service B using the stable DNS name — no IP hardcoding
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3001';

async function chargeUser(userId, amount) {
  const res = await fetch(`${PAYMENT_URL}/charge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amount }),
  });
  if (!res.ok) throw new Error(`Payment failed: ${res.status}`);
  return res.json();
}
```

---

## API Gateway Pattern

A single entry point for all clients. Handles cross-cutting concerns so individual services don't have to.

```
Client (browser / mobile / third-party)
           |
    ┌──────▼──────┐
    │ API Gateway  │  ← auth, rate-limit, TLS termination,
    │              │    request routing, response aggregation,
    └──────┬───────┘    logging, tracing
           |
    ┌──────┴────────────────────────┐
    │              │                │
    ▼              ▼                ▼
User Service   Order Service   Payment Service
  :3001          :3002            :3003
```

**What the gateway handles (so services don't have to):**

| Concern | Gateway handles it |
|---------|--------------------|
| TLS termination | ✅ Single cert, services speak plain HTTP internally |
| JWT validation | ✅ Reject unauthenticated before hitting services |
| Rate limiting | ✅ Per-API-key or per-IP quotas |
| Request routing | ✅ `/api/users → user-service`, `/api/orders → order-service` |
| Response aggregation | ✅ BFF pattern — one request → fan-out → merged response |
| Observability | ✅ Centralized request logs, latency metrics, tracing |

```javascript
// Express-based API Gateway (simplified)
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { verifyJWT } from './auth.js';

const app = express();

// Global: rate limit all requests
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

// Global: validate JWT for /api routes
app.use('/api', verifyJWT);

// Route: proxy to downstream services
app.use('/api/users',   createProxyMiddleware({ target: 'http://user-service:3001',    changeOrigin: true }));
app.use('/api/orders',  createProxyMiddleware({ target: 'http://order-service:3002',   changeOrigin: true }));
app.use('/api/payments',createProxyMiddleware({ target: 'http://payment-service:3003', changeOrigin: true }));

app.listen(8080);
```

---

## Inter-Service Communication

| Style | Protocol | When to use |
|-------|----------|-------------|
| **Synchronous** | HTTP/REST, gRPC | Need immediate response (user-facing, read operations) |
| **Asynchronous** | Message queue (SQS, RabbitMQ, Kafka) | Fire-and-forget, long-running work, decouple services |
| **Event streaming** | Kafka, Kinesis | Ordered event log, replay, fan-out to many consumers |

**Circuit Breaker (prevent cascade failure):**
```javascript
import CircuitBreaker from 'opossum';

const options = {
  timeout: 3000,          // fail if > 3s
  errorThresholdPercentage: 50,  // open circuit if >50% fail
  resetTimeout: 10000,    // try again after 10s
};

const breaker = new CircuitBreaker(chargeUser, options);

breaker.fallback((userId, amount) => {
  // Queue the charge for later processing instead of failing user
  return paymentQueue.add({ userId, amount });
});

// Usage is identical to calling chargeUser directly
const result = await breaker.fire(userId, amount);
```

---

## Key Interview Q&A

**Q: How do you handle distributed transactions across microservices?**
> Use the Saga pattern. Each step is a local transaction with a compensating transaction (undo) if a subsequent step fails. Either choreography (event-driven) or orchestration (central coordinator) style.

**Q: How did you handle 10K+ concurrent users?**
> Stateless Node.js instances behind a load balancer. Session state in Redis. Horizontal scaling via Kubernetes HPA triggered on CPU/RPS metrics. API Gateway handles TLS and rate limiting upstream so services receive clean traffic.

**Q: What's the hardest part of microservices?**
> Distributed data consistency. Each service owns its DB — you can't do a JOIN or a 2-phase commit across services. Solutions: event sourcing, Saga pattern, eventual consistency with idempotent consumers.

**Q: When would you NOT use microservices?**
> Early-stage products with a small team. The operational overhead (service discovery, distributed tracing, inter-service auth, deployment pipelines per service) outweighs the benefits until the team and product are large enough to justify it.

**Q: How do services authenticate with each other internally?**
> mTLS (mutual TLS) for service-to-service trust in a service mesh, or short-lived internal JWTs signed by a shared secret. API Gateway validates user tokens; downstream services trust the gateway's forwarded identity header.
