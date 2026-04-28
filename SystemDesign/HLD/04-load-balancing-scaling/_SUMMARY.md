# M4 — Load Balancing & Scaling: Quick-Review Summary

> 7 topics | Covers: LB, Reverse Proxy, Algorithms, L4/L7, Horizontal Scaling, Forward Proxy

---

## Topics at a Glance

| # | Topic | Core Insight |
|---|---|---|
| T01 | Load Balancers Overview | Distribute requests, health-check, remove SPOFs, enable horizontal scale |
| T02 | LB vs Reverse Proxy | LB = which server? Reverse Proxy = how to process? |
| T03 | Load Balancing Algorithms | Round-robin, Least Connections, IP Hash, Consistent Hashing |
| T04 | Layer 4 Load Balancing | Routes by IP+port only — blindingly fast, no app awareness |
| T05 | Layer 7 Load Balancing | Routes by URL/header/cookie — smart, content-aware, higher overhead |
| T06 | Horizontal Scaling | Add more identical servers + stateless; theoretically unlimited scale |
| T07 | Forward Proxy | Sits in front of clients; server doesn't know who the real client is |

---

## T01 — Load Balancers Overview

**Definition**: A LB distributes incoming requests across backend servers to prevent overload, eliminate SPOFs, and enable horizontal scaling.

### Four Core Features

**1. Traffic Distribution** — Spread requests across servers using an algorithm.

**2. Health Checks & Failover**
```
Every 10s: GET /health
  → 200 OK  → server stays in rotation ✅
  → timeout → failure 1 of 2 ⚠️
  → timeout → failure 2 of 2 → REMOVED from pool ❌
  → 200 OK → success 1 of 2 → success 2 of 2 → RESTORED ✅
```

**3. SSL/TLS Termination** — LB decrypts HTTPS; internal traffic uses plain HTTP. Offloads crypto from app servers.

**4. Session Persistence (Sticky Sessions)** — Same client always routes to same server (needed for stateful apps; avoid by externalizing state to Redis instead).

### LB in the Stack
```
Internet
  ↓
DNS Load Balancer (Tier 0) — geographic routing
  ↓
Network LB (Tier 1, L4) — high-throughput TCP routing
  ↓
Application LB (Tier 2, L7) — smart HTTP routing
  ↓
App Servers → DB + Cache
```

> Without LB: single server = SPOF + overload. With LB: any server failure = zero user impact.

---

## T02 — LB vs Reverse Proxy

| | **Load Balancer** | **Reverse Proxy** |
|---|---|---|
| **10-word test** | "Which server gets this request?" | "How should I process this request?" |
| **Minimum backends** | 2+ (meaningless with 1) | 1 (useful from day one) |
| **OSI layer** | L4 or L7 | L7 (application layer) |
| **Caching** | Rarely | Core feature |
| **SSL/TLS** | Optional | Primary use case |
| **Request modification** | Limited (adds X-Forwarded-For) | Extensive: URL rewrite, headers, compress |
| **Examples** | AWS ALB/NLB, HAProxy | Nginx (proxy mode), Varnish, CloudFront |

> **Key rule**: A reverse proxy adds value even with a single backend. A load balancer is meaningless with only one backend.

> Modern tools (Nginx, HAProxy) do **both** — the conceptual distinction matters for design decisions, not tool selection.

---

## T03 — Load Balancing Algorithms

### Static Algorithms (no runtime state)

| Algorithm | How | Best for |
|---|---|---|
| **Round-Robin** | Rotate through servers sequentially; `server = req_count % N` | Homogeneous servers, uniform request cost |
| **Weighted Round-Robin** | Server A:weight=4, B:weight=1 → A gets 80% of traffic | Heterogeneous server capacity |
| **IP Hash** | `server = hash(client_IP) % N` | Session affinity without sticky sessions |
| **Random** | Pick a random server | Surprisingly competitive for uniform workloads |

### Dynamic Algorithms (use runtime metrics)

| Algorithm | How | Best for |
|---|---|---|
| **Least Connections** | Route to server with fewest active connections | Variable-duration requests, WebSockets, DB connections |
| **Least Response Time** | Route to server with lowest avg response time | Mixed server performance |
| **Power of Two** | Pick 2 random servers, send to the less-loaded one | Large clusters (avoids lock contention of global minimum) |

> **Round-robin's flaw**: ignores that a 500ms request and a 1ms request get equal slots. Least connections is better when request duration varies.

---

## T04 — Layer 4 Load Balancing

**OSI Layer**: Transport (TCP/UDP). Routes by **5-tuple** only:
```
Source IP | Destination IP | Source Port | Destination Port | Protocol
```
Never inspects HTTP headers, URLs, cookies, or TLS payload.

### Architecture
```
Client SYN → VIP (Virtual IP: 203.0.113.10:443)
  → L4 LB extracts 5-tuple
  → Hash to connection table → Server 1 (same server for all packets in TCP session)
  → NAT/DSR forwards packets
```

### Two Forwarding Modes
| | NAT | DSR (Direct Server Return) |
|---|---|---|
| Return traffic | Through LB | Directly to client (bypasses LB) |
| LB bandwidth needed | Both directions | Inbound only |
| Throughput | Limited by LB | Very high |

### When to Use L4

| ✅ Use L4 | ❌ Avoid L4 |
|---|---|
| Millions of connections/sec needed | Need URL-based routing |
| Non-HTTP (MySQL, SMTP, RTMP, gRPC raw TCP) | Need cookie/JWT inspection |
| TLS passthrough | Need request modification |
| Game servers, financial trading | Need A/B testing or canary deploys |

---

## T05 — Layer 7 Load Balancing

**OSI Layer**: Application (HTTP/HTTPS/gRPC/WebSocket). **Fully parses** the request before routing.

### How It Works
```
Client HTTPS → L7 LB (TLS termination → parse HTTP → evaluate rules → forward to backend pool)
```

### Content-Based Routing Examples
```
/api/users    → User Service pool    (3 servers)
/api/orders   → Order Service pool   (5 servers)
/admin        → Admin pool           (2 servers, internal only)
/static       → S3 / CDN redirect
Header: X-Beta: true → Canary pool (10% traffic)
Cookie: ab=B  → Variant B pool
```

### L7 Exclusive Features

| Feature | How | Why Important |
|---|---|---|
| **Path-based routing** | Match URL prefix/pattern | Route to correct microservice |
| **A/B testing / canary** | Split % of traffic by header/cookie | Safe deploys |
| **WebSocket upgrade** | Detect `Upgrade: websocket` header | Correct persistent connections |
| **Request/response transform** | Add headers, rewrite URLs | Auth injection (`X-User-Id`) |
| **Rate limiting** | Per-IP or per-user limit | DDoS protection |
| **Request buffering** | Buffer slow clients, send complete req to backend | Protect backend from slow clients |

### L4 vs L7 Comparison

| | L4 | L7 |
|---|---|---|
| Speed | Faster (packet-level) | Slower (parse HTTP) |
| Intelligence | None (no app context) | Full (headers, cookies, body) |
| SSL | Passthrough or terminate | Always terminates |
| Routing granularity | IP:port | URL, header, cookie, method |
| Examples | AWS NLB, HAProxy TCP mode | AWS ALB, Nginx, Envoy |

---

## T06 — Horizontal Scaling

**Definition**: Add more identical servers to the pool instead of upgrading one server.

```
Vertical (hits limit): 4 CPU → 8 → 16 → 128 → 448 vCPU max (exponential cost)
Horizontal (unlimited): ×1 → ×10 → ×1000 servers (each adds linear capacity)
```

### 5 Requirements for Horizontal Scaling

1. **Stateless application** — no local session memory. Move state to Redis/DB.
2. **Load balancer** in front to distribute traffic.
3. **Shared external state** — DB, Redis, object storage all accessible by any instance.
4. **Health checks** — LB probes each instance, removes unhealthy ones.
5. **Auto-scaling** — provision/terminate instances based on CPU/QPS metrics (AWS ASG, K8s HPA).

### Making App Stateless
```
❌ WRONG: sessions in server RAM
  User → Server 1 (saves session) → User → Server 2 → "Who are you?" → 500 Error

✅ CORRECT: sessions in Redis
  User → Server 1 → Redis (saves session)
  User → Server 2 → Redis (reads same session) → 200 OK
```

> Horizontal scaling is the basis of cloud-native architecture. Statelessness is non-negotiable.

---

## T07 — Forward Proxy

**Definition**: Sits in front of *clients*. Destination server sees only the **proxy's IP**, not the client's.

```
Without proxy: Client → Website (website sees client IP)
With forward proxy: Client → Proxy → Website (website sees proxy IP only)
Compare reverse proxy: Client → Reverse Proxy → Server (client sees proxy IP only)
```

### Three Core Use Cases

| Use Case | How | Example |
|---|---|---|
| **Corporate filtering** | Inspect and block URLs | Block social media; log all traffic |
| **Anonymization** | Mask client IPs | VPN services, Tor |
| **Caching (egress)** | Cache repeated requests to same external URL | Squid caching proxy |

> **Key distinction**: The **client must be configured** to use a forward proxy (it's not transparent). A reverse proxy is transparent to the client.

---

## LB & Scaling Architecture Cheat Sheet

```
Global Traffic Entry
        ↓
Route53 / Anycast DNS (geographic routing)
        ↓
AWS NLB / HAProxy (L4) — TCP-level, high connections/sec
        ↓
AWS ALB / Nginx (L7) — URL routing, SSL term, rate limiting
        ↓
Auto-scaled stateless app pods
        ↓
Redis (session + cache) + RDS (database)
```

---

## Interview Cheat Sheet — M4

| Question | Answer |
|---|---|
| What does a load balancer do? | Distributes requests across backend pool, health checks, removes SPOFs, enables horizontal scale |
| LB vs reverse proxy — key difference? | LB routes *where* (which server); reverse proxy handles *how* (SSL, caching, auth, transform) |
| Can you use a reverse proxy with one server? | Yes — it adds SSL termination, caching, rate limiting even without multiple backends |
| L4 vs L7 LB main difference? | L4 routes by IP+port only (fast, no app context); L7 parses HTTP and routes by URL/header/cookie |
| When use L4 over L7? | Non-HTTP protocols, millions connections/sec, financial trading, TLS passthrough |
| What algorithm for WebSocket long connections? | Least Connections — accounts for connection duration |
| Why does horizontal scaling require stateless apps? | Any server must handle any request; server-local state would break requests hitting a different instance |
| How to make an app stateless? | Move sessions/state to Redis or a shared database accessible by all instances |
| Forward proxy vs reverse proxy? | Forward = in front of client, client knows about it; Reverse = in front of server, client is unaware |
| What is sticky sessions and why avoid it? | Routes same client to same server — breaks horizontal scaling; prefer externalizing state to Redis |
| What is Power of Two Choices algorithm? | Pick 2 random servers, send to less-loaded one — better than global minimum without lock contention |

---

## Keywords

`load balancer` · `SPOF` · `health check` · `SSL termination` · `sticky sessions` · `reverse proxy` · `forward proxy` · `L4` · `L7` · `round-robin` · `least connections` · `consistent hashing` · `horizontal scaling` · `vertical scaling` · `stateless` · `auto-scaling` · `ASG` · `HPA` · `VIP` · `NAT` · `DSR` · `canary deploy` · `A/B testing` · `content-based routing` · `Nginx` · `HAProxy` · `AWS ALB` · `AWS NLB`
