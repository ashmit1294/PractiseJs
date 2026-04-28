# Layer 7 Load Balancing

> **Module 4 — Load Balancing & Scaling**  
> Source: https://layrs.me/course/hld/04-load-balancing-scaling/layer-7-load-balancing

---

## ELI5 — Explain Like I'm 5

A **Layer 7 load balancer** opens every package it receives, reads the address *and the letter inside*,
then decides where to send it based on what the letter says.

If the letter says "I want pizza" → pizza kitchen.  
If it says "I want cake" → bakery.  
If it says "I'm cancelling my order" → customer service.

All three might arrive at the same front door (port 443) but get routed to completely different places.

---

## Analogy

L7 LB = **smart airport gate agent**:
- Scans your boarding pass (URL)
- Checks your passport (headers / auth token)
- Routes you to Gate 32A (API server), Gate 11B (admin portal), or lounge (CDN) based on ticket type

L4 LB = baggage conveyor: moves all bags by destination code stamped on outside — has no idea what's inside.

---

## Core Concept

Layer 7 refers to **OSI Layer 7 — the Application Layer**, where HTTP/HTTPS, WebSocket, gRPC operate.

An L7 load balancer:
1. **Terminates** the client TCP connection (and TLS if HTTPS)
2. **Parses** the HTTP request (method, path, headers, cookies, body)
3. **Evaluates routing rules** against parsed content
4. **Forwards** to the selected backend via a *new* (or pooled) connection

```
Client ──HTTPS──► L7 LB ──HTTP──► Backend pool A (/api/users)
                        ──HTTP──► Backend pool B (/api/orders)
                        ──HTTP──► Backend pool C (/admin)
```

This is fundamentally different from L4: the LB is a **full HTTP proxy**, not a packet forwarder.

---

## Architecture

```
            Client HTTPS Request
                    │
         ┌──────────▼──────────┐
         │    L7 Load Balancer  │
         │                      │
         │  ① Connection Handler│  ← TCP accept + TLS handshake
         │  ② HTTP Parser       │  ← extract path, headers, cookies
         │  ③ Routing Engine    │  ← evaluate rules → select backend pool
         │  ④ Health Checker    │  ← GET /health every 5s per backend
         │  ⑤ Connection Pool   │  ← reuse TCP connections to backends
         │  ⑥ Response Processor│  ← add headers, compress, log
         └──────────┬──────────┘
                    │ Plain HTTP (or HTTPS if re-encrypt)
            ┌───────┴────────┐
            ▼                ▼
       Backend A         Backend B
       /api/users/*      /api/orders/*
```

The LB maintains **two separate TCP connections**:
- Client → LB (HTTPS)
- LB → Backend (typically plain HTTP, over trusted internal network)

---

## Content-Based Routing (The Killer Feature)

### Path-based routing
```
GET /api/users/123   → User Service pool
GET /api/orders      → Order Service pool
GET /static/logo.png → CDN origin pool
GET /admin/dashboard → Admin Backend (separate security policy)
```

### Host-based routing (Virtual Hosting)
```
Host: api.company.com        → API servers
Host: www.company.com        → Web servers
Host: customer1.saas.com     → Customer 1 isolated pool
Host: customer2.saas.com     → Customer 2 isolated pool
```
One LB IP, hundreds of domains, zero tenant bleed.

### Header-based routing
```
User-Agent: Mobile/*         → Mobile-optimised backend (smaller payloads)
X-Canary: true               → Canary servers (new release)
X-Internal-User: 1           → Internal service pool (skip rate limiting)
Authorization: Bearer <jwt>  → Validate + route to tenant-specific backend
```

### Cookie-based routing
```
Cookie: SERVER_ID=backend-3  → Always route to backend-3 (sticky sessions)
Cookie: experiment=variant-b → A/B test backend
```

### Weighted routing (Canary Deployments)
```
/api/users → 95% → stable servers
           →  5% → canary servers
```
Gradually increase canary percentage while monitoring error rates.
If canary shows elevated 5xx → instantly route 100% back to stable.

---

## SSL/TLS Termination

```
Client TLS Handshake:
  RSA-2048 key exchange  → 1–3 ms
  ECDSA P-256            → 0.5–1 ms
  TLS session resumption → < 1 ms  (session ticket reuse)
  AES-GCM symmetric enc  → ~free  (AES-NI hardware acceleration)
```

**Benefits**:
- One SSL certificate on the LB, not N on N servers
- Backend servers offload TLS CPU (can serve 3–5× more requests)
- LB can inspect decrypted traffic for WAF, logging, routing

**Security trade-off**:
- LB sees ALL traffic in plaintext  
- LB-to-backend unencrypted (mitigated by network isolation / mTLS if needed)
- LB becomes a high-value target — must be hardened

---

## HTTP Routing Rule Engines

**Nginx** `location` blocks (longest prefix match):
```nginx
location /api/users/ { proxy_pass http://user_service_pool; }
location /api/orders/ { proxy_pass http://order_service_pool; }
location /static/    { proxy_pass http://cdn_origin_pool; }
location /           { proxy_pass http://default_pool; }
```

**HAProxy** ACL (Access Control List):
```
acl is_api     path_beg /api
acl is_mobile  hdr(User-Agent) -i -m sub Mobile
acl is_canary  hdr(X-Canary) -i true

use_backend canary_servers  if is_canary
use_backend mobile_backends if is_mobile
use_backend api_servers     if is_api
default_backend web_servers
```

**AWS ALB** listener rules (priority-ordered):
- Conditions: path, host, header, query string, source IP
- Actions: forward, redirect, return fixed response, authenticate (Cognito / OIDC)

---

## Connection Pooling

Without pooling: every request incurs TCP handshake (1–2 ms) + slow-start penalty.

```
Without pooling:
  Request 1 → new TCP conn → handshake 1.5ms → HTTP → close
  Request 2 → new TCP conn → handshake 1.5ms → HTTP → close
  Overhead: 3 ms wasted per req

With pooling:
  Request 1 → reuse conn  → HTTP → keep-alive
  Request 2 → reuse conn  → HTTP → keep-alive
  Overhead: ~0 ms per req (50–70% latency reduction for backends)
```

HTTP/2 to backends adds **multiplexing** — hundreds of concurrent requests on 1 TCP connection.

Memory: each active connection = 10–50 KB (buffers + TLS state).  
100,000 connections = 1–5 GB RAM just for connection state.

---

## Performance Characteristics

| Metric | Value |
|---|---|
| **LB-added latency** | 5–20 ms (TLS + HTTP parsing + routing) |
| **CPU vs L4** | 3–5× higher (same traffic volume) |
| **Throughput (NGINX/HAProxy)** | 50–100K req/s (small reqs, simple rules) |
| **Complex routing** | 20–40K req/s |
| **AWS ALB baseline latency** | 10–20 ms (higher than self-hosted but auto-scales) |

---

## L4 vs L7 Trade-offs

| | **L4** | **L7** |
|---|---|---|
| Latency | 50–500 µs | 5–20 ms |
| CPU per req | ~100 ns | ~3–6 ms |
| Content routing | ❌ | ✅ |
| SSL termination | ❌ | ✅ |
| WAF | ❌ | ✅ |
| Non-HTTP protocols | ✅ any TCP/UDP | ❌ HTTP only (+ gRPC/WS) |
| Good for | Max perf, DB, gaming, streaming | Microservices, APIs, A/B testing |

---

## When to Use L7

- **Microservices** — single entry point routing 50+ API endpoints to 20+ services
- **A/B testing / canary deploys** — weighted routing by cookie or header
- **SSL termination** — offload crypto from backends
- **Multi-tenant SaaS** — host-based routing to isolated pools
- **WAF / auth** — enforce at the edge, not in every service

**Avoid L7 when**:
- Latency is sub-ms critical (HFT, real-time gaming) → use L4
- Non-HTTP protocols (PostgreSQL, Kafka, MQTT, custom TCP) → use L4
- Performance overhead not justified by routing needs

**Hybrid approach**: L4 at edge (DDoS + raw throughput) → L7 internally (intelligent routing).

---

## Real-World Examples

| Company | L7 System | Key Detail |
|---|---|---|
| **Netflix** | Zuul API Gateway | Routes `/browse` → Catalog, `/play` → Streaming, `/account` → Billing; custom Groovy filter plugins deployable without restart; 1M+ req/s per instance (async I/O) |
| **Uber** | Envoy-based gateway | Routes 2,000+ API endpoints to 100s of services; header-based routing separates rider (low latency SLA) from driver (relaxed SLA) requests |
| **AWS** | Application Load Balancer | Managed L7; auto-scales from 10 to 100+ nodes in <5 min; AWS Certificate Manager auto-renews SSL; integrates with WAF and Cognito auth |
| **Stripe** | Nginx (edge RP) + HAProxy (internal LB) | Nginx terminates SSL + rate-limits; HAProxy does least-connections to API servers |

---

## MERN Dev Notes

| Scenario | Implementation |
|---|---|
| Express API routing via Nginx | Nginx `location /api/` proxy_pass to Node.js pool |
| Next.js static assets | Nginx serves `_next/static/` directly (no Node.js) |
| SSL offload | Nginx handles HTTPS; Express only binds to `localhost:3000` (HTTP) |
| Path-based multi-service | `/api/users` → user-service Node.js, `/api/payments` → payments-service |
| A/B testing | Nginx `split_clients` or AWS ALB weighted target groups |
| Health endpoint | `GET /health` returns `200 { status: 'ok', db: 'connected' }` |

**Nginx L7 Multi-service routing**:
```nginx
upstream user_service   { server 10.0.1.10:3001; server 10.0.1.11:3001; }
upstream order_service  { server 10.0.1.20:3002; server 10.0.1.21:3002; }
upstream static_origin  { server 10.0.1.30:3003; }

server {
  listen 443 ssl;
  ssl_certificate     /etc/ssl/cert.pem;
  ssl_certificate_key /etc/ssl/key.pem;

  location /_next/static/ { proxy_pass http://static_origin; }
  location /api/users/    { proxy_pass http://user_service;  }
  location /api/orders/   { proxy_pass http://order_service; }
  location /              { proxy_pass http://user_service;  }  # SSR fallback
}
```

**Security headers via Nginx L7**:
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
```

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| How does L7 differ from L4? | L7 terminates TCP+TLS, parses HTTP, routes by content; L4 forwards packets by IP/port |
| Why is L7 slower? | Connection termination + TLS handshake + HTTP parsing = 5–20 ms vs 50–500 µs |
| What is SSL termination? | LB decrypts HTTPS once; backends receive plain HTTP; centralises cert mgmt |
| Content routing example? | `/api/users` → user-service, `/api/orders` → order-service through single port 443 |
| Canary deployment? | Route 5% via header/cookie to new version; monitor; scale up; rollback if errors spike |
| When to avoid L7? | Sub-ms latency requirements, non-HTTP protocols |

**Red flags**:
- "L7 is always better than L4" — ignores latency/CPU overhead
- "L7 forwards packets like L4" — no, it terminates connections (full HTTP proxy)
- "L7 can handle any protocol" — HTTP-specific (+ gRPC/WS); not MySQL, Kafka, MQTT
- "SSL termination is free" — TLS handshake is expensive (RSA 1–3 ms)

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **OSI Layer 7** | Application layer — where HTTP, HTTPS, gRPC, WebSocket operate |
| **Connection termination** | LB establishes separate connections to client and backend (unlike L4 packet forwarding) |
| **Path-based routing** | Route based on URL path (e.g., `/api/*` → API servers) |
| **Host-based routing** | Route based on `Host` header (virtual hosting / multi-tenancy) |
| **Header-based routing** | Route based on custom HTTP headers (canary, mobile, auth) |
| **TLS session resumption** | Reuse previous TLS session to avoid full handshake (< 1 ms vs 1–3 ms) |
| **AES-NI** | CPU hardware instruction set for fast AES encryption (symmetric part of TLS) |
| **Connection pool** | Reused persistent HTTP connections from LB to backends |
| **WAF** (Web Application Firewall) | L7 feature filtering malicious requests (SQLi, XSS, OWASP Top 10) |
| **Zuul** | Netflix's custom L7 API gateway load balancer |
| **Envoy** | High-performance open-source L7 proxy (used in Istio service mesh and Uber) |
| **ALB** (Application Load Balancer) | AWS managed L7 load balancer |
| **LCU** (Load Balancer Capacity Unit) | AWS ALB billing unit (connections + requests + bandwidth combined) |
