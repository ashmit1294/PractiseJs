# Load Balancers Overview

> **Module 4 — Load Balancing & Scaling**  
> Source: https://layrs.me/course/hld/04-load-balancing-scaling/load-balancers-overview

---

## ELI5 — Explain Like I'm 5

Imagine a busy restaurant with one cashier. Eventually a huge queue forms and people leave.
Now imagine the restaurant hires 5 cashiers and puts a **host (load balancer)** at the entrance
who tells each customer "go to cashier 3" or "go to cashier 1 — they're free."
If cashier 2 falls asleep (server crash), the host skips them automatically.
No single cashier overloads, and the restaurant keeps serving even if one cashier is out.

---

## Analogy

A load balancer is a **traffic cop** at an intersection.
Cars (requests) arrive, and the cop routes each one down a lane (server) that isn't jammed.
If a lane is closed (server down), the cop stops sending cars there — automatically.

---

## Core Concept

A **load balancer** distributes incoming client requests across a pool of backend servers to:
1. **Prevent overload** — no single server gets all traffic
2. **Eliminate single points of failure (SPOFs)** — if one server dies, others handle traffic
3. **Enable horizontal scaling** — add servers without changing client config
4. **Provide a single entry point** — clients always hit one IP/domain

```
Without LB:                     With LB:
                               ┌──────────────────────────────────┐
Client ──► Single Server ──►  │  Client 1 ─┐                      │
           (SPOF, overload)   │  Client 2 ─┼──► Load Balancer ──► │ Server 1
                               │  Client N ─┘        │             │ Server 2
                               │               (health checks)     │ Server 3
                               └──────────────────────────────────┘
                                 Failure of Server 2 = no user impact
```

---

## Four Core Features

### 1. Traffic Distribution
Requests are spread across the server pool using an algorithm (round-robin, least-connections, etc.).
Avoids "hot spots" where some servers drown while others idle.

### 2. Health Checks & Failover

```
Load Balancer sends probe every 10s:
  GET /health → 200 OK  ✅ server stays in rotation
  GET /health → timeout  ✗  failure 1/2
  GET /health → timeout  ✗  failure 2/2  → REMOVED from pool
  (server recovers)
  GET /health → 200 OK  ✅ success 1/2
  GET /health → 200 OK  ✅ success 2/2  → RESTORED (gradual ramp-up)
```

**Active health checks** — LB sends periodic probes  
**Passive health checks** — LB watches real request error rates

Config knobs: `interval` (how often), `timeout` (how long to wait), `threshold` (how many failures = unhealthy)

### 3. SSL (Secure Sockets Layer) / TLS Termination
The LB handles HTTPS (decrypts incoming, forwards plain HTTP to backends).
- Offloads CPU-intensive crypto from application servers
- Centralises certificate management (1 cert on LB vs N certs on N servers)
- **Trade-off**: LB-to-backend traffic is unencrypted — must trust the internal network

### 4. Session Persistence (Sticky Sessions)
Stateful apps that store session data locally need all requests from one user to hit
the same server.

| Method | How | Downside |
|---|---|---|
| Cookie-based | LB sets `LB_SERVER=A` cookie | Requires Layer 7 |
| IP hash | Hash client IP → same server | Breaks with NAT / mobile |
| External sessions (best) | Store sessions in Redis | Requires app refactor |

---

## Layer 4 vs Layer 7

| | **Layer 4** | **Layer 7** |
|---|---|---|
| OSI layer | Transport (TCP/UDP) | Application (HTTP/HTTPS) |
| Inspects | IP + port only | URL, headers, cookies, body |
| Routing | IP/port-based | Content-based (path, host, header) |
| Latency | ~50–500 µs | ~1–5 ms |
| SSL termination | No | Yes |
| Use when | Protocol-agnostic, max speed | Microservices, content routing |

---

## High Availability for the LB Itself

A single LB is itself a SPOF. Solutions:

```
Active-Passive:          Active-Active:
 Primary LB ◄─── VIP     LB1 ─┐
   │      ↑ VRRP          LB2 ─┼──► backends
 Standby LB (idle)        LB3 ─┘  (DNS round-robin / anycast)
```

Cloud LBs (AWS ALB / ELB) run across multiple Availability Zones (AZs) automatically.

---

## Load Balancer Landscape

| Type | Examples | Cost | Ops Overhead |
|---|---|---|---|
| **Hardware** | F5 BIG-IP, Citrix NetScaler | $20k–$100k+ | High |
| **Software** | HAProxy, Nginx | Free (OSS) | Medium |
| **Cloud-managed** | AWS ALB/NLB, GCP Cloud LB, Azure LB | Pay-per-use | Low |
| **Service mesh** | Envoy (Istio), Linkerd | Free (OSS) | Very high |

**Startup path**: Cloud LB → self-hosted Nginx/HAProxy at scale → custom (Netflix Zuul)

---

## Health Check Trade-off

```
Aggressive (short interval, low threshold):
  + Detects failure fast (< 10 s)
  - False positives during GC pauses / transient slowdowns

Conservative (long interval, high threshold):
  + Fewer false positives
  - Failed servers stay in rotation longer
```

For 99.9% SLA (43 min/month downtime) → 30 s detection acceptable  
For 99.99% SLA (4 min/month downtime) → sub-10 s detection required

---

## Real-World Examples

| Company | LB Used | Details |
|---|---|---|
| **Netflix** | Zuul (custom L7) | Routes 1B+ API reqs/day; A/B testing, canary deploys |
| **AWS** | ELB: ALB (L7), NLB (L4), Classic (legacy) | Trillions of reqs/yr, auto-scales |
| **Cloudflare** | Edge LBs at 200+ DCs | Geographic routing + DDoS mitigation |
| **Reddit / Stack Overflow** | HAProxy | Open-source, high-performance |

**Netflix multi-tier architecture**:
```
User → Route 53 (DNS) → AWS ELB (geographic) → Zuul (L7 routing)
                                                      → Ribbon (client-side LB between microservices)
```

---

## MERN Dev Notes

| Scenario | Tool |
|---|---|
| Node.js/Express behind LB | Nginx `upstream {}` block or AWS ALB |
| Next.js static assets | Serve via CDN (CloudFront), Not through LB |
| MongoDB sessions | Externalize to Redis (required for stateless LB) |
| Health endpoint | `app.get('/health', (req, res) => res.json({ status: 'ok' }))` |
| Real IP logging | Read `X-Forwarded-For` header (set by LB) |

**Example Nginx LB config (basic)**:
```nginx
upstream express_app {
  least_conn;
  server 10.0.1.10:3000;
  server 10.0.1.11:3000;
  server 10.0.1.12:3000;
}

server {
  listen 443 ssl;
  location / {
    proxy_pass http://express_app;
    proxy_set_header X-Forwarded-For $remote_addr;
  }
}
```

---

## Interview Cheat Sheet

| Question | One-liner answer |
|---|---|
| What does a LB do? | Distributes traffic across servers; health-checks; prevents SPOF |
| LB vs no LB? | Enables horizontal scaling; without it you're stuck with vertical |
| How does failover work? | Health check fails N times → removed; passes M times → restored (gradual ramp-up) |
| L4 vs L7? | L4 = fast, IP/port only; L7 = slower but content-aware |
| LB SPOF issue? | Deploy active-passive (VRRP) or active-active; or use cloud-managed LB |
| Sticky sessions trade-off? | Simplifies stateful apps but breaks even load distribution + complicates autoscaling |
| SSL termination trade-off? | Offloads crypto but LB-to-backend is plaintext — must trust network |

**Red flags to avoid**:
- Saying "a LB is just for HA" — it also *enables* horizontal scaling
- Drawing single LB without asking about the LB's own redundancy
- Confusing LB with reverse proxy (overlapping tools, different primary purposes)
- Proposing L7 for everything without discussing latency/CPU overhead
- Not mentioning health checks when discussing fault tolerance

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **SPOF** (Single Point Of Failure) | Component whose failure causes total outage |
| **VIP** (Virtual IP) | Shared IP address owned by load balancer, not any one server |
| **SSL/TLS** (Secure Sockets Layer / Transport Layer Security) | Encryption protocol for HTTPS |
| **SSL termination** | LB decrypts HTTPS, forwards plain HTTP to backends |
| **Sticky sessions** | Routing the same client to the same server consistently |
| **Health check** | Periodic probe to verify a backend is serving correctly |
| **VRRP** (Virtual Router Redundancy Protocol) | Protocol for active-passive LB failover |
| **ECMP** (Equal-Cost Multi-Path) | Network-level distribution across multiple LBs |
| **LCU** (Load Balancer Capacity Unit) | AWS ALB billing unit (connections + requests + bandwidth) |
| **Zuul** | Netflix's custom L7 load balancer / API gateway |
| **HAProxy** | High Availability Proxy — popular open-source LB |
| **ALB** (Application Load Balancer) | AWS L7 managed load balancer |
| **NLB** (Network Load Balancer) | AWS L4 managed load balancer |
