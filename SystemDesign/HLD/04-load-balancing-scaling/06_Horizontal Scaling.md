# Horizontal Scaling

> **Module 4 — Load Balancing & Scaling**  
> Source: https://layrs.me/course/hld/04-load-balancing-scaling/horizontal-scaling

---

## ELI5 — Explain Like I'm 5

Your lemonade stand sells so much that you can't keep up.

**Vertical scaling** = hire a bigger, stronger you (get a faster CPU, more RAM).  
But eventually you hit the limit of how strong one person can be.

**Horizontal scaling** = open 5 more lemonade stands with the same recipe. A sign-pointer (load balancer) directs customers to whichever stand has the shortest queue.  
If one stand burns down, the others keep serving. You can open more stands overnight.

---

## Analogy

| Scaling type | Real-world analogy |
|---|---|
| **Vertical (scale-up)** | Upgrade your 1 chef to a superhuman chef — eventually hits human limits |
| **Horizontal (scale-out)** | Hire 10 identical chefs, put a host at the door to divide customers |

---

## Core Concept

**Horizontal scaling** = add more servers (nodes) to the pool.  
**Vertical scaling** = upgrade the existing server (more CPU, RAM, disk).

```
Vertical Scaling (hits hard limit):
  Server: 4 CPU → 8 CPU → 16 CPU → ... → 448 vCPU (largest AWS instance)
          (costs grow exponentially; still a SPOF)

Horizontal Scaling (theoretically unlimited):
  Server ×1 → ×2 → ×10 → ×1000
              LB distributes traffic evenly
              1 server down = 1/N capacity loss, NOT total outage
```

**Fundamental trade-off**: horizontal scaling requires **stateless applications**
(non-negotiable) but provides unlimited growth and fault tolerance.

---

## How It Works — 5 Steps

### Step 1: Deploy identical stateless instances
All servers run the same code, same config, same capabilities.
Each is interchangeable — none is "special."

### Step 2: Load balancer distributes traffic
Load balancer sits in front, routes requests to healthy servers (health checks every N seconds).

### Step 3: Externalize ALL state

This is the critical requirement:

```
WRONG — Stateful server:
  User A → Server 1 → session stored in Server 1 memory
  User A → Server 2 → "Who are you? Session not found!" → 500

CORRECT — Stateless server:
  User A → Server 1 → fetch session from Redis → OK
  User A → Server 2 → fetch session from Redis → OK (same state)
```

| State type | External store |
|---|---|
| User sessions | **Redis** / Memcached |
| Uploaded files | **S3** / GCS / Azure Blob |
| Background jobs | **RabbitMQ** / Kafka / SQS |
| Persistent data | **PostgreSQL** / MongoDB |
| Real-time counters | Redis |

### Step 4: Add capacity dynamically

```
Manual scaling:  kubectl scale deployment api --replicas=20
Auto-scaling:    CPU > 70% for 3 min → +1 server
                 CPU < 30% for 10 min → -1 server
```

Cloud auto-scaling: AWS Auto Scaling Groups, GKE Horizontal Pod Autoscaler (HPA),
Azure VM Scale Sets.

**Scaling lag**: provisioning a new instance takes 2–5 minutes → need to scale *before* the spike.
Stripe mitigates this by over-provisioning 50% at all times (predictable bursts > cost savings).

### Step 5: Handle failures gracefully

```
Health check interval: 30 s
Server fails:          removed from rotation (no action required from ops)
Server recovers:       added back after N consecutive successful checks
Users experience:      zero disruption (next request goes to a healthy server)
```

---

## Stateless Architecture Deep Dive

### Why statelessness is non-negotiable

With a load balancer, consecutive requests from the same user may hit different servers.  
Any server-local state is invisible to all other servers.

```
With sticky sessions (anti-pattern):
  → Creates pseudo-statefulness by routing users to the same server
  → If that server fails, session lost
  → Autoscaler can't remove the server while active sessions exist
  → Load distribution is uneven (popular users → one server overwhelmed)

Without sticky sessions (correct):
  → Any server can handle any request
  → Server failures have zero session impact (state is in Redis)
  → Autoscaling is instantaneous (no draining needed)
```

### JWT vs Server-side sessions

| | **JWT (JSON Web Token)** | **Redis sessions** |
|---|---|---|
| Session data location | Inside the token (client-side) | Server-side in Redis |
| Revocation | Cannot revoke until expiry | Instant (delete from Redis) |
| Token size | Grows with payload | Constant cookie (session ID) |
| Latency | 0 ms (no network call) | ~1 ms Redis lookup |
| Best for | Stateless APIs, short-lived tokens | Full apps needing instant logout |

---

## Scaling Variants

### Auto-scaling
```
AWS Auto Scaling Group:
  Min capacity:     2 servers  (always on for HA)
  Max capacity:     50 servers (cost cap)
  Desired:          5 servers  (current)
  Scale-out policy: CPU > 70% for 2 min → add 2 servers
  Scale-in policy:  CPU < 30% for 10 min → remove 1 server
```

**Trade-off**: ~2–5 min provisioning lag → may miss sudden spikes.  
Mitigation: predictive scaling (look at traffic history, scale proactively).

### Manual scaling
- Fixed server count, adjusted by ops team
- Good for: predictable traffic, on-premises hardware, tight cost control

### Hybrid scaling
- Baseline of vertical servers for steady traffic + horizontal burst capacity for peaks
- Retail example: 10 powerful servers year-round + 50 smaller servers on Black Friday

---

## Trade-offs Summary

| Concern | Horizontal | Vertical |
|---|---|---|
| **Fault tolerance** | ✅ N-1 capacity on failure | ❌ Single point of failure |
| **Scalability limit** | ✅ Unlimited (add nodes) | ❌ Largest AWS = 448 vCPU / 24 TB RAM |
| **Cost efficiency** | ✅ Commodity hardware | ❌ Exponential for high-end |
| **Operational complexity** | ❌ Distributed systems: LB, service discovery, state mgmt | ✅ One server to manage |
| **Latency per request** | ❌ Extra network hops + Redis calls | ✅ In-process, sub-ms |
| **Deployment** | ✅ Zero-downtime (rolling deploy) | ❌ Restart needed |

---

## Horizontal Scaling and Databases

A common mistake: horizontally scale the app tier but leave a single DB.

```
              ┌──────────────────────────────────┐
App tier: ✅  │  App ×10 behind LB               │
DB tier:  ❌  │  Single PostgreSQL → bottleneck  │
              └──────────────────────────────────┘
```

Solutions:
| Need | Solution |
|---|---|
| More read throughput | Read replicas (PostgreSQL streaming replication) |
| More write throughput | Horizontal DB sharding |
| Scalable document store | **MongoDB Atlas auto-scaling** (horizontal by default) |
| Session / cache | Redis cluster (consistent hashing across nodes) |

---

## Real-World Examples

| Company | Scale | Details |
|---|---|---|
| **Netflix** | 1,000s of EC2 instances | Stateless video delivery; Chaos Monkey terminates random servers in production to validate horizontal scaling; auto-scales nightly |
| **Facebook** | 10,000s of PHP web servers | Sessions in Memcached; deploy new releases by rolling across servers — 1% → 10% → 100% |
| **Stripe** | Auto-scaling API servers | 50% over-provisioned at all times to handle traffic spikes without provisioning lag |

**Netflix Chaos Monkey**: deliberately and randomly kills servers in production.  
If your horizontal scaling is correct, users notice nothing. If they do — you find the bug in a controlled way rather than during a real outage.

---

## MERN Dev Notes

| Concern | Implementation |
|---|---|
| Sessions | `express-session` + `connect-redis` (never in-memory) |
| File uploads | Store in **S3**, not local disk |
| Background jobs | **Bull** queue with Redis, or AWS SQS |
| MongoDB | Use **MongoDB Atlas** — horizontal sharding built-in, M10+ tiers auto-scale |
| Health endpoint | Must return `200` quickly; check DB + Redis connectivity |
| Stateless JWT auth | `jsonwebtoken` — no server-side session state |

**Express stateless session (Redis)**:
```js
const redis  = require('redis').createClient({ url: process.env.REDIS_URL });
const store  = new (require('connect-redis')(session))({ client: redis });

app.use(session({
  store,
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie:            { secure: true, httpOnly: true, maxAge: 3600_000 },
}));
```

**Next.js horizontal scaling checklist**:
- ✅ Build output in Docker image (not local FS)
- ✅ No `fs.writeFile` in API routes (use S3)
- ✅ Redis for session / rate-limiting state
- ✅ `NEXT_PUBLIC_*` env vars baked at build time (not per-instance)

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| Vertical vs horizontal? | Vertical = bigger server (hits limits, SPOF); Horizontal = more servers (unlimited, resilient) |
| Requirement for horizontal scaling? | **Stateless** application servers — externalize all state |
| What if a server crashes? | LB detects via health check → removes from pool → zero user impact |
| When to avoid horizontal scaling? | MVP stage, strong consistency requirements, inherently single-threaded workloads |
| How do you size servers? | If each handles 1,000 RPS and you need 50,000 RPS with 30% failure headroom: `50,000 / 1,000 / 0.7 ≈ 72 servers` |
| Autoscaling lag problem? | Over-provision 30–50% baseline; use predictive scaling for daily patterns |

**Red flags**:
- "Stateful in-memory sessions are fine behind a LB" — fatal for horizontal scaling
- "Just horizontal scale the DB too" — DB scaling requires different strategy (sharding, replicas)
- "Horizontal scaling is always better than vertical" — vertical is simpler for bounded workloads
- Not mentioning load balancer when describing horizontal scaling

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Horizontal scaling (scale-out)** | Adding more servers to handle increased load |
| **Vertical scaling (scale-up)** | Upgrading an existing server with more resources |
| **Stateless server** | Server that keeps no user-specific state between requests |
| **Externalized state** | Application state stored outside the server in shared systems (Redis, S3, DB) |
| **Auto-scaling** | Automatically adding/removing servers based on metrics (CPU, RPS) |
| **Auto Scaling Group (ASG)** | AWS mechanism for managing a pool of EC2 instances with auto-scaling policies |
| **HPA** (Horizontal Pod Autoscaler) | Kubernetes mechanism for scaling pod replicas based on CPU/custom metrics |
| **Chaos Monkey** | Netflix tool that randomly terminates servers in production to test resilience |
| **JWT** (JSON Web Token) | Self-contained token storing signed session data client-side (no server state) |
| **Rolling deploy** | Replacing servers one by one with new code — no downtime |
| **SPOF** (Single Point Of Failure) | Component whose failure causes total system outage |
