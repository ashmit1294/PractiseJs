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

---

## ELI5 Complex Keywords Glossary

| Term | ELI5 Explanation |
|------|-----------------|
| **Microservices** | Instead of one giant app doing everything, you split it into small apps — one for users, one for payments, one for emails. Each runs on its own and can be updated without touching the others. |
| **Monolith** | One big app that handles everything. Like a Swiss Army knife — handy at first, but if you break one blade the whole knife is in the shop. |
| **Stateless** | The server doesn't remember you between requests. Every request carries all the info the server needs (like showing your ID every time you enter a building instead of them memorising your face). |
| **HPA (Horizontal Pod Autoscaler)** | A Kubernetes robot that watches how busy your app is. If it gets too busy, it automatically adds more copies of your app. If it quiets down, it removes them to save money. |
| **API Gateway** | The front door of your entire system. All requests come here first. It checks who you are, blocks bad actors, then forwards your request to the right internal service — like a hotel concierge. |
| **JWT (JSON Web Token)** | A small, tamper-proof digital ID card you get when you log in. You show it on every request. The server can verify it's real without asking the database — it just checks the signature, like a passport stamp. |
| **Redis** | An in-memory database that's extremely fast (microseconds). Think of it as a whiteboard next to your desk — much faster to look at than going into a filing cabinet (regular database). |
| **TTL (Time To Live)** | An expiry timer attached to a piece of data. Like milk with a use-by date — after the TTL expires the data is automatically deleted so old/stale data doesn't pile up. |
| **Load Balancer** | A traffic cop standing in front of your servers. It spreads incoming requests evenly across all available servers so no single one gets overwhelmed. |
| **Service Discovery** | A phonebook for services. Since servers in the cloud come and go with random IP addresses, services register themselves in a directory. Other services look them up by name instead of hardcoding an IP. |
| **Circuit Breaker** | Protects your app from a failing service. Like a household fuse — if one service keeps failing, the circuit "opens" (stops trying) for a while instead of flooding it with calls and making things worse. |
| **Saga Pattern** | A way to do multi-step tasks across different services safely. Each step has an "undo" action. If step 3 fails, the system automatically runs the undos for steps 1 and 2 — like reversing a chain of dominoes. |
| **Distributed Transaction** | Trying to do one atomic operation (all-or-nothing) across multiple databases/services. Hard because if the network dies mid-way you don't know what succeeded — Saga pattern is the practical alternative. |
| **mTLS (Mutual TLS)** | Both sides of a connection prove who they are, not just the server. Like two people showing ID to each other before talking — used between internal services so a rogue service can't pretend to be a trusted one. |
| **Service Mesh** | A layer of infrastructure (like Istio or Linkerd) that handles all service-to-service communication: auth, retries, tracing, encryption. Tiny "sidecar" proxies sit next to each service and manage traffic automatically. |
| **Sidecar Proxy** | A helper container that runs alongside your main service container. It handles networking concerns (security, logging, retries) so your app code doesn't have to. Like having a personal assistant manage your calls. |
| **BFF (Backend for Frontend)** | A dedicated API layer built specifically for one type of client (e.g., mobile app or web app). It aggregates data from multiple services into one perfect response for that client — so mobile gets exactly what mobile needs. |
| **gRPC** | A faster, more efficient way for services to talk to each other compared to REST. Uses a binary format (smaller messages) and a defined contract (proto file) — like services speaking a tightly agreed shorthand code. |
| **Idempotent** | Doing the same operation multiple times gives the same result as doing it once. Like pressing an elevator button 10 times — it only calls the elevator once. Critical for retries so you don't double-charge a customer. |
| **TLS Termination** | The API Gateway decrypts the incoming HTTPS traffic and forwards plain HTTP internally. Like a secure mailroom that opens the encrypted envelope and passes the plain letter inside to the right department. |
| **RPS (Requests Per Second)** | How many requests your system handles every second. A useful measure of load — e.g., "we scale out when we exceed 1000 RPS" means the autoscaler kicks in at high traffic. |
| **Compensating Transaction** | The "undo" step in a Saga. If you booked a flight and the hotel booking failed, the compensating transaction cancels the flight. It reverses what was already done to keep the system consistent. |
| **Choreography vs Orchestration** | Two styles of coordinating services. Choreography: each service reacts to events independently (like a flash mob — no director). Orchestration: a central coordinator tells each service what to do (like a conductor in an orchestra). |
| **Cascade Failure** | When one failing service causes other services that depend on it to also fail, which then causes their dependents to fail — a domino effect that can take down the entire system. Circuit breakers prevent this. |
| **Replica** | An identical copy of a running service instance. Running 3 replicas means 3 copies of the same service, all handling requests. More replicas = more capacity + higher availability. |
