# Forward Proxy

> **Module 4 — Load Balancing & Scaling**  
> Source: https://layrs.me/course/hld/04-load-balancing-scaling/forward-proxy

---

## ELI5 — Explain Like I'm 5

You want to order pizza but your parents won't let you call strangers.  
So your older sister makes the call for you. The pizza restaurant only knows *her* number, not yours.

That's a **forward proxy** — it sits in front of *you* (the client), makes requests on your behalf, and the destination never knows your real identity.

A **reverse proxy** is the opposite: it sits in front of *the server*. You call the pizza place's main number; a receptionist picks up and routes you to the right kitchen without you knowing which kitchen is handling it.

---

## Analogy

| | **Forward Proxy** | **Reverse Proxy** |
|---|---|---|
| Sits in front of | The **client** | The **server** |
| Who configures it | The **client** (must opt in) | The **server owner** (transparent) |
| Restaurant analogy | Your assistant calls on your behalf | Restaurant's call-routing system |
| Knows your identity? | Server does **not** know the real client | Client does **not** know the real server |
| Examples | Corporate proxy, Squid, Cloudflare WARP | Nginx, AWS ALB, Cloudflare CDN |

---

## Core Concept

```
Without proxy:
  Your browser ──────────────────────────────► Website
  (website sees YOUR IP)

With forward proxy:
  Your browser ──► Forward Proxy ──────────► Website
  (website sees the PROXY's IP, not yours)

Compare: reverse proxy:
  Your browser ─────────────────► Reverse Proxy ──► Server
  (you see the proxy's IP, not the server's)
```

**Key characteristic**: The **client must be configured** to use a forward proxy.
The proxy is not transparent — the browser or OS must have a proxy address set.

---

## Three Core Use Cases

### 1. Corporate Content Filtering

```
Employee laptop ──► Corporate Proxy ──► Internet
                       │
                       ├── Blocks: social media, gaming, adult content
                       ├── Logs: all URLs, timestamps, user identities
                       └── SSL inspection: decrypts HTTPS to scan content
```

Flow:
- Employee browses `instagram.com`
- Proxy checks against blocklist → **deny**, return block page
- Employee browses `github.com` → allow, forward request, log it
- For HTTPS: proxy performs **SSL interception** (see below)

### 2. Privacy / Anonymity (Consumer proxies)

- Hide real IP address from destination servers
- Bypass geographic restrictions (access content only available in other countries)
- Journalists, activists, privacy-conscious users

```
Attacker/tracker sees:  Proxy IP (shared by thousands of users)
Does NOT see:           Your real IP
```

> Important misconception: anonymity ≠ zero traceability.  
> The **proxy itself** sees and can log everything. Only anonymous if you trust the proxy operator.

### 3. Bandwidth Optimization (Caching proxy)

```
50 employees request google.com/logo.png

Without proxy:  50 × HTTP requests to Google → 50 × network costs

With caching proxy:
  Request 1:  Cache MISS → fetch from Google → cache locally
  Requests 2–50: Cache HIT → served from proxy (no external traffic)

Result: 98% of repeat requests served locally
        External bandwidth used for 1 request instead of 50
```

Used in: ISPs, university networks, large enterprises.

---

## How a Forward Proxy Handles HTTPS

HTTPS creates a problem: the proxy can't read encrypted traffic.  
Two solutions:

### SSL Interception (Corporate / Enterprise)

```
Client ──TLS──► Proxy ──TLS──► Server
                  │
                  ├── Proxy generates a fake cert for the website
                  ├── Proxy decrypts content (can inspect / block / log)
                  └── Re-encrypts before forwarding to server

Requirement: Client must trust the proxy's root CA certificate
             (deployed via Group Policy in corporate environments)
```

**Security implication**: the proxy sees all HTTPS plaintext — passwords, PII, banking.
Employees should assume zero HTTPS privacy on corporate networks.

### CONNECT Tunneling (Privacy proxies)

```
Client ─► Proxy: "CONNECT api.example.com:443 HTTP/1.1"
Proxy ─► Client: "200 Connection Established"
Client ←──── encrypted tunnel ────► Server
            (proxy is just piping bytes, cannot read content)
```

Proxy creates a blind tunnel — it only knows the destination hostname, not the content.
Used by: consumer VPN-like proxies, SOCKS5 proxies, Tor.

---

## Client Configuration Methods

Unlike a reverse proxy (transparent), a forward proxy requires explicit client-side setup:

| Method | Scope |
|---|---|
| **Browser settings** | Per-browser (Firefox has its own proxy settings) |
| **OS-level proxy** (Windows: Internet Options → LAN Settings) | All OS network traffic |
| **PAC file** (Proxy Auto-Configuration) | DNS-like script that routes per-URL |
| **WPAD** (Web Proxy Auto-Discovery Protocol) | Network broadcasts proxy config to all clients |
| **Environment variables** (`HTTP_PROXY`, `HTTPS_PROXY`) | CLI tools, Docker, build systems |

---

## Forward Proxy vs VPN

| | **Forward Proxy** | **VPN** |
|---|---|---|
| OSI layer | Layer 7 (application) | Layer 3 (network) |
| Scope | HTTP/HTTPS traffic only | ALL network traffic (TCP, UDP, DNS) |
| IP masking | Yes (for proxied requests) | Yes (for everything) |
| Encryption | Not inherently (just forwarding) | Yes (IPSec, WireGuard, OpenVPN) |
| Speed | Faster (no encryption overhead) | Slower (encryption CPU cost) |
| Use case | Content filtering, HTTP caching | Full anonymity, network-level access |

**Key distinction**: A forward proxy is an application-layer intermediary.
A VPN is a network-level tunnel that redirects *all* traffic and encrypts it end-to-end.

---

## High Availability Setup

A single proxy is a SPOF (Single Point Of Failure).

```
              ┌─────────────────────────────────┐
              │  HAProxy (proxy load balancer)  │
              └──────────┬──────────────────────┘
            ┌────────────┘       └────────────┐
   ┌────────▼───────┐           ┌─────────────▼──────┐
   │  Proxy Node 1  │           │   Proxy Node 2      │
   │  (Squid/WARP)  │           │   (Squid/WARP)      │
   └────────────────┘           └─────────────────────┘
          │                               │
          └──────── Shared Redis Cache ───┘
              (hot objects: tier 1)
              SSD disk cache: tier 2
```

**Three-node cluster** (quorum-based): any single node can fail without downtime.

---

## Real-World Examples

| Product | Type | Details |
|---|---|---|
| **Squid** | Open-source caching proxy | Most common enterprise forward proxy; supports ACLs, SSL bump (interception), LDAP auth |
| **Blue Coat / Symantec Web Security** | Enterprise | Hardware + software proxy; deep content inspection; compliance logging |
| **Zscaler** | Cloud forward proxy | Zero-trust network access; all traffic routed through Zscaler globally |
| **Cloudflare WARP** | Consumer forward proxy | Uses WireGuard under the hood; forwards HTTP/3; DNS-over-HTTPS; encrypts DNS; ~10% faster than plain internet |
| **Tor** | Anonymizing relay network | Multi-hop onion routing; not a traditional forward proxy but similar client-proxy model |

---

## MERN Dev Notes

Forward proxies are less common in MERN apps but appear in specific scenarios:

### Server-to-server proxy (Axios)

When your Node.js API makes outbound HTTP requests through a corporate network:

```js
const axios  = require('axios');
const tunnel = require('tunnel');

// E.g.: Route Node.js outbound traffic through corporate HTTP proxy
const agent = tunnel.httpsOverHttp({
  proxy: { host: 'corporate-proxy.company.com', port: 8080 },
});

const response = await axios.get('https://api.third-party.com/data', {
  httpsAgent: agent,
  proxy:      false, // disable axios auto-proxy so we use the tunnel agent
});
```

Or via environment variables (many HTTP libraries respect these automatically):
```bash
HTTP_PROXY=http://proxy.company.com:8080
HTTPS_PROXY=http://proxy.company.com:8080
NO_PROXY=localhost,127.0.0.1,internal.company.com
```

### Docker / CI proxy setup
```dockerfile
ENV HTTP_PROXY="http://proxy.corp:8080"
ENV HTTPS_PROXY="http://proxy.corp:8080"
ENV NO_PROXY="localhost,*.internal.corp"
```

### Next.js API routes making external calls
- Same `HTTPS_PROXY` env var works for `node-fetch` and `axios`
- Watch out: browser-side `fetch` does **not** use server-side proxy env vars

---

## Architecture Comparison Cheat Sheet

```
Forward Proxy Flow:
  [Client] → (configured by client) → [Forward Proxy] → [Internet/Server]
  Server sees:  proxy IP
  Client sees:  real server content

Reverse Proxy Flow:
  [Client] → [Reverse Proxy] ← (hides servers) → [Server Pool]
  Client sees: proxy IP
  Server sees: proxy IP (or real client via X-Forwarded-For)

Both in a corporate environment:
  [Employee Browser]
       │
       ▼ (proxy configured on laptop)
  [Corporate Forward Proxy]  ← filters, logs, caches, inspects SSL
       │
       ▼
  [Internet]
       │
       ▼
  [Company's Web App behind Reverse Proxy (Nginx)]
       │
       ▼
  [App Server Pool]
```

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| Forward vs Reverse proxy? | Forward: client-side, client configures it, hides client from server. Reverse: server-side, transparent to client, hides servers. |
| Why can't a forward proxy handle HTTPS by default? | Traffic is encrypted. Must either do CONNECT tunneling (blind) or SSL interception (requires trusted root cert on client). |
| Forward proxy vs VPN? | Proxy = L7 HTTP only, no encryption. VPN = L3 all traffic, encrypted tunnel. |
| How does corporate proxy control HTTPS? | SSL interception: generates fake cert (trusted via Group Policy), decrypts, inspects, re-encrypts. |
| Does a forward proxy guarantee anonymity? | No. The proxy operator can log everything. Only as private as you trust the proxy. |
| What is Cloudflare WARP? | A forward proxy using WireGuard that routes HTTP traffic through Cloudflare's network for performance + security. |

**Anti-patterns**:
- Treating forward proxy as a VPN (different security models, different OS-level scope)
- Not configuring `NO_PROXY` — proxy chains can break internal service calls
- Single proxy node without HA → SPOF for all outbound traffic

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Forward proxy** | Client-side intermediary that makes requests on behalf of the client |
| **Transparent proxy** | Proxy that intercepts traffic without client configuration (forward proxy is NOT transparent) |
| **SSL interception** (SSL bumping) | Corporate proxy decrypts HTTPS by presenting a fake cert signed by a trusted root CA |
| **CONNECT method** | HTTP method clients send to request a TCP tunnel through the proxy for HTTPS |
| **PAC file** (Proxy Auto-Configuration) | JavaScript file that browsers execute to decide per-URL whether to use a proxy |
| **WPAD** (Web Proxy Auto-Discovery) | Protocol to automatically discover PAC file location on the network |
| **Squid** | Popular open-source HTTP/HTTPS forward caching proxy |
| **Zscaler** | Cloud-based Zero Trust security proxy service (all traffic routed through cloud) |
| **SOCKS5** | Protocol for a generic TCP-level proxy tunnel (Layer 5, not just HTTP) |
| **SPOF** (Single Point Of Failure) | Component whose failure causes total outage |
| **ACL** (Access Control List) | Rules defining what the proxy permits or denies |
