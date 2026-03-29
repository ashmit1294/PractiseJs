# LB vs Reverse Proxy

> **Module 4 — Load Balancing & Scaling**  
> Source: https://layrs.me/course/hld/04-load-balancing-scaling/lb-vs-reverse-proxy

---

## ELI5 — Explain Like I'm 5

A **load balancer** is like a host at a restaurant who decides *which table* (server) you go to.
A **reverse proxy** is like the waiter who *takes your order, handles special requests, and brings food back* — even if there's only one chef.

You need the host only when there are multiple tables.  
You benefit from the waiter even with a single chef.

---

## Analogy

| Role | Analogy | Primary Job |
|---|---|---|
| **Load Balancer** | Traffic cop routing cars to open lanes | *Where* does this request go? |
| **Reverse Proxy** | Secretary who transforms requests before forwarding | *How* should this request be handled? |

---

## Core Concept

### The Key Distinction — 10-word test

> **Load Balancer** = "Which server gets this request?"  
> **Reverse Proxy** = "How should I process this request?"

```
Load Balancer Architecture:
Client ──► Load Balancer ──► Server 1  (health checks, failover)
                         ──► Server 2
                         ──► Server 3

Reverse Proxy Architecture:
Client ──► Reverse Proxy ──► Single (or multiple) backend
            (SSL, cache,
             rate limit,
             URL-rewrite)
```

### Single Server Test (clearest distinction)
- **Reverse proxy** adds value even with **1 backend** (SSL offload, caching, security)
- **Load balancer** is only meaningful with **2+ backends** (nothing to fail over to otherwise)

---

## Side-by-Side Feature Comparison

| Feature | Load Balancer | Reverse Proxy |
|---|---|---|
| **Primary purpose** | Traffic distribution + failover | Request transformation + caching + security |
| **Minimum servers needed** | 2+ (point of load balancing) | 1 (useful from day one) |
| **OSI layer** | L4 (TCP/UDP) **or** L7 | Primarily L7 (application layer) |
| **Caching** | Rarely | Core feature |
| **SSL/TLS termination** | Optional add-on | Primary use case |
| **Request modification** | Limited (adds `X-Forwarded-For`) | Extensive: URL rewrite, header inject, compress |
| **Session persistence** | Core feature (sticky sessions) | Supported but secondary |
| **Health checking** | Sophisticated (active + passive) | Basic (assumes backends are up) |
| **Typical examples** | AWS ALB/NLB, HAProxy, Nginx (LB mode) | Nginx (proxy mode), Varnish, CloudFront |

---

## Deep Analysis

### Load Balancer: The Traffic Conductor

Solves the **routing problem**: which of N healthy servers handles this request?

Core mechanism:
1. Maintain pool of backend servers
2. Continuous health checks (active probes)
3. Apply distribution algorithm (round-robin, least-connections, consistent hashing)
4. **Automatic failover** — remove unhealthy server, no manual intervention

```
Pool: [Server A ✅, Server B ✅, Server C ✗ (failed health check)]
Routing: distribute only to A and B
         → C gets no traffic until recovery
```

Netflix's Zuul routes across thousands of microservice instances removing unhealthy
ones based on real-time error rates and latency percentiles (P99 / P99.9).

### Reverse Proxy: The Request Handler

Solves the **middleware problem**: how do we optimally process requests before they
reach application servers?

Core features:

```
Client HTTPS req
    │
    ▼
Reverse Proxy
  ├── SSL termination  (decrypt once here, forward plain HTTP)
  ├── Cache check      (serve static assets directly)
  ├── Rate limit       (200 req/min per IP)
  ├── Auth check       (validate JWT before forwarding)
  ├── Compression      (gzip response)
  └── URL rewrite      (/api/v1 → /v1)
    │
    ▼
Backend server (plain HTTP, much less load)
```

**The killer stat**: Cloudflare's reverse proxies cache 60–80% of typical website traffic —
the origin server never sees most requests. Value even with a single backend!

### The Convergence

Modern tools (Nginx, HAProxy) do **both**. Deploy the same tool with different *purpose*:

```
Edge (reverse proxy role):
  Nginx ← SSL termination, static caching, rate limiting

Internal (load balancer role):
  Nginx (or HAProxy) → distribute among 10 app servers, health-check each 5s
```

Cloud LBs (AWS ALB) blur lines further — they offer SSL termination and path routing
(reverse proxy features) but primary purpose is traffic distribution.

---

## Capacity Impact of Reverse Proxy Caching

```
WITHOUT reverse proxy (1,000 req/s incoming):
  → 1,000 req/s hit app servers → need 10 servers @ 100 RPS each

WITH reverse proxy (70% cache hit rate, 1,000 req/s):
  → 700 req/s served from cache → 0 compute
  → 300 req/s hit app servers  → need 3 servers @ 100 RPS each

Saving: 7 fewer servers, or: same 3 servers handle 3,300 req/s total
```

---

## Decision Framework

### When to use a Load Balancer
- You have **2+ backend servers** and need traffic distribution with automatic failover
- High availability is critical; you need sophisticated health checking
- You need session persistence (sticky sessions)
- You're scaling horizontally by adding more servers

### When to use a Reverse Proxy
- **Single server** but need SSL termination, caching, security
- Caching is a priority (reduce backend load)
- You need request/response transformation (headers, compression, URL rewriting)
- Centralize authentication or rate limiting

### When to use Both (Layered Architecture — Production standard)

```
Internet
    │
    ▼
Edge Nginx (Reverse Proxy):
  → SSL termination
  → Static asset caching
  → Rate limiting
    │
    ▼
Internal HAProxy/Nginx (Load Balancer):
  → Distribute across 10 app servers
  → Health-check every 5 s
  → Failover within 10 s
```

### Decision Tree
```
Do you have 2+ backend servers?
  No → Use reverse proxy (SSL, caching, security)
  Yes → Do you need caching or request transformation?
          No  → Use load balancer only
          Yes → Use both (layered architecture)
```

---

## Common Anti-Patterns

| Anti-pattern | Problem |
|---|---|
| LB with a single server | Adds complexity, no failover benefit |
| Skipping the edge reverse proxy | App servers waste CPU on SSL and static assets |
| Saying "I'll use Nginx" without explaining *which role* | Ambiguous; signals shallow thinking |
| Over-engineering an MVP | Start with reverse proxy; add LB when you actually scale |

---

## Real-World Examples

### Cloudflare — Reverse Proxy at Global Scale
- 300+ data centers running Nginx as reverse proxy
- Terminates SSL, caches 60–80% of requests, filters DDoS
- **The insight**: Cloudflare doesn't care if your origin has 1 server or 10.  
  Reverse proxy value is independent of backend count.

### Netflix — Load Balancing Across Microservices
- Zuul routes across thousands of microservice instances
- Health checks based on error rates and P99.9 latency
- Primary purpose: traffic distribution (load balancing)

### Stripe — Layered Architecture (The Gold Standard)
```
Internet
    │
    ▼
Nginx (2× Reverse Proxy) — Keepalived VIP for HA
  → SSL termination (reduces CPU on API servers)
  → Per-customer rate limiting
    │
    ▼
HAProxy (2× Load Balancer) — Active-Passive
  → Least-connections distributes to API servers
  → Health-check every 5 s (TCP + HTTP probes)
    │
    ▼
API Servers (N×) → PostgreSQL (Primary + Replicas)
```

Each layer optimised independently. Can swap one without touching the other.

---

## MERN Dev Notes

| Scenario | Recommended setup |
|---|---|
| Development | Direct `localhost:3000` — no proxy needed |
| Production single server | Nginx as reverse proxy (SSL, gzip, static assets) |
| Production multi-server | Nginx reverse proxy (edge) + Nginx/HAProxy LB (internal) |
| Next.js static assets | Nginx serves `_next/static/` directly (no Node.js hit) |
| Express sessions | Externalize to Redis — required once LB is involved |
| MongoDB Atlas | Atlas handles its own LB internally — your app doesn't add one |

**Nginx as reverse proxy for Express (simple)**:
```nginx
server {
  listen 443 ssl;
  ssl_certificate /etc/ssl/cert.pem;
  ssl_certificate_key /etc/ssl/key.pem;

  # Serve Next.js static assets directly (no Node.js)
  location /_next/static/ {
    alias /var/www/app/.next/static/;
    expires 1y;
  }

  # Everything else → Express
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| Key difference? | LB = *where* traffic goes; RP = *how* traffic is handled |
| Can you use RP with 1 server? | Yes — SSL, caching, security work without multiple backends |
| Can RP do load balancing? | Yes (Nginx `upstream {}`) — distinction is *primary purpose*, not capability |
| Can LB do reverse proxy? | Partially — AWS ALB has SSL + path routing, but no content caching |
| Layered architecture? | Reverse proxy at edge (SSL/cache), LB internally (distribute/failover) |
| Cache hit rate savings? | 70% cache hit = 3.3× capacity or 70% backend cost reduction |

**Red flags to avoid**:
- Saying "they're the same thing" without qualification
- Claiming RP needs 2+ servers (it doesn't)
- Not mentioning caching as the killer RP feature
- Forgetting that both RP and LB can be SPOFs and need redundancy

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Reverse proxy** | Server-side intermediary: sits in front of backends, transparent to clients |
| **Forward proxy** | Client-side intermediary: sits in front of clients, transparent to servers |
| **SSL/TLS termination** | Decrypting HTTPS at the proxy; backend receives plain HTTP |
| **Cache hit ratio** | % of requests served from cache without hitting the backend |
| **VRRP** (Virtual Router Redundancy Protocol) | Protocol for active-passive HA failover |
| **Keepalived** | Linux tool implementing VRRP for Nginx/HAProxy HA |
| **Varnish** | High-performance HTTP accelerator (reverse proxy focused on caching) |
| **WAF** (Web Application Firewall) | Reverse proxy feature that filters malicious HTTP requests |
| **PAC** (Proxy Auto-Configuration) file | JS file that tells browsers how to find the proxy |
