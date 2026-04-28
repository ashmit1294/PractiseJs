# 01 — DNS Fundamentals

> **Source**: https://layrs.me/course/hld/03-networking-dns/dns-fundamentals  
> **Level**: Intermediate | **Read time**: ~16 min  
> **Module**: M3 — Networking & DNS

---

## TL;DR

DNS (Domain Name System) is the internet's distributed directory service that translates human-readable domain names (e.g. `www.netflix.com`) into IP (Internet Protocol) addresses (e.g. `52.85.151.23`). It works through a hierarchy of servers — root → TLD (Top-Level Domain) → authoritative — with aggressive multi-layer caching controlled by TTL (Time To Live) values.

**One-liner for interviews**: *"DNS is a globally distributed, hierarchical key-value store that maps domain names → IP addresses. Caching via TTL makes it fast; eventual consistency means changes aren't instant."*

---

## ELI5 — Explain Like I'm 5

You want to call your friend "Netflix". You don't know their phone number by heart, so you:

1. Ask your **phonebook** (browser/OS cache) — not there.
2. Call **directory assistance** (recursive resolver) — they start asking around.
3. Directory assistance calls the **city operator** (root server) — "ask the .com operator."
4. The **.com operator** (TLD server) says — "ask Netflix's own office."
5. **Netflix's office** (authoritative nameserver) finally gives you the number (IP address).
6. You write it in **your phonebook** for next time (cached with TTL, e.g. 60 s).

Next time you call Netflix within 60 seconds? You go straight from your phonebook. No hierarchy needed.

---

## The Analogy — Directory Assistance Before Smartphones

Before smartphones, calling 411 (directory assistance) to find a business number was the norm:

- You: "I need the number for Joe's Pizza on Main Street."
- **Operator** (recursive resolver): "Let me check the hierarchy for you."
- **City directory** (root server): "I know .com numbers, not specific restaurants."
- **Street directory** (TLD server): "I know pizza joints in this city — here's the listing."
- **Specific business listing** (authoritative NS): "Joe's Pizza: 555-1234."

The operator writes down frequently-called numbers (caching). You keep a list too (browser cache).

---

## Core Concept — How DNS Works

DNS is a **globally distributed, hierarchical database** invented in 1983 to replace manually maintained `HOSTS.TXT` files. It handles **trillions of queries daily** using a combination of hierarchical delegation and aggressive caching.

### DNS Resolution Flow

```
Browser                OS Cache         Recursive Resolver       Root Server
   |                      |                     |                     |
   |--- check cache ----→ |                     |                     |
   |  (miss)              |                     |                     |
   |←--- miss ----------- |                     |                     |
   |--- query OS ----------→|                   |                     |
   |  (miss)                |                   |                     |
   |            DNS query --→ recursive resolver |                     |
   |                                 |--- query root NS → "ask .com" --|
   |                                 |--- query .com TLD  → "ask netflix.com NS"
   |                                 |--- query netflix.com NS → IP: 52.85.151.23 (TTL: 60s)
   |                                 |← cache result (60s)
   |←------- IP: 52.85.151.23 ------+
   |--- Connect to 52.85.151.23
```

### The Hierarchy

```
                    [ ROOT SERVERS ]
                    13 addresses (hundreds of physical servers via Anycast)
                    Know about all TLDs (Top-Level Domains)
                          |
          ┌───────────────┼───────────────┐
        [.com]          [.org]          [.net]
        (Verisign)      (PIR)           (Verisign)
          |
   ┌──────┴──────┐
[netflix.com NS]  [stripe.com NS]
 (AWS Route 53)   (ns1.stripe.com)
      |
  Actual A/AAAA/CNAME records
  (e.g., www → 52.85.151.23)
```

### Multi-Layer Caching

Each layer caches DNS results to avoid repeating the full hierarchy walk:

| Cache Layer | Typical TTL (Time To Live) | Who Benefits |
|---|---|---|
| Browser cache | 1–5 minutes | Your current tab |
| OS (Operating System) cache | 1–2 minutes | All apps on your machine |
| Recursive resolver (ISP / 1.1.1.1 / 8.8.8.8) | Whatever TTL the record says | All users of that resolver |
| Authoritative NS (Nameserver) cache | Zone reload interval | Upstream resolvers |

Cloudflare's `1.1.1.1` resolver answers **1.5 trillion queries/day** — but only ~5% require a full recursive lookup. The other 95% are cache hits.

---

## Key Principles

| Principle | What it means |
|---|---|
| **Hierarchical Delegation** | Each level delegates authority to the next. Netflix controls its own NS (Nameserver) records without coordinating with `.com` or root servers. |
| **Multi-Layer Caching** | Caching at browser, OS, recursive resolver. Makes DNS fast despite multi-hop resolution. |
| **Eventual Consistency via TTL** | DNS accepts eventual consistency. Different resolvers see changes at different times as TTL expires. |
| **Redundancy at Every Level** | Root servers use Anycast. TLD operators run multiple servers. Domain owners should run ≥ 2 authoritative NS in different data centers. |
| **Separation of Roles** | Recursive resolvers (8.8.8.8) serve clients. Authoritative NS (ns1.google.com) answer only for domains they control. Never mix these roles. |

---

## DNS Record Types

| Record | Full Name | Purpose | Example |
|---|---|---|---|
| **A** | Address | Maps name → IPv4 (Internet Protocol version 4) address | `www.stripe.com → 54.187.174.169` |
| **AAAA** | IPv6 Address | Maps name → IPv6 (Internet Protocol version 6) address | `www.example.com → 2001:db8::1` |
| **CNAME** | Canonical Name | Alias — points one name to another | `blog.stripe.com → stripe.ghost.io` |
| **MX** | Mail Exchange | Routes email with priority | `MX 10 mail1.google.com` |
| **TXT** | Text | Domain verification, SPF (Sender Policy Framework), DKIM | `v=spf1 include:google.com` |
| **NS** | Nameserver | Delegating authority for a domain | `ns-1234.awsdns-12.com` |
| **SOA** | Start of Authority | Zone metadata: primary NS, admin email, serial number | One per zone |
| **PTR** | Pointer | Reverse DNS — IP → name. Used for email reputation | `23.151.85.52.in-addr.arpa → www.netflix.com` |
| **SRV** | Service | Service discovery with hostname + port | Used in Kubernetes and microservices |

### Zone Apex CNAME Problem

You **cannot** use a CNAME at the zone apex (`example.com` itself) — it conflicts with required SOA and NS records. Solutions:

- **Route 53 Alias records** — behave like CNAME but return A records to clients
- **Cloudflare CNAME flattening** — same concept, different implementation

---

## TTL (Time To Live) Trade-offs

| TTL Setting | Propagation Speed | Query Volume | Use Case |
|---|---|---|---|
| **60–300 s** (short) | Fast — changes visible within minutes | High — 12–24× more queries | Netflix during deployments / failover |
| **3600 s = 1 hour** | Medium | Medium | Semi-stable services |
| **86400 s = 24 hours** | Slow — changes can take a full day | Low — 99% fewer queries | Corporate websites that rarely change |

**Golden rule**: Lower TTL to 60 s *at least one full TTL period before* a planned change. After the change stabilizes, raise it back.

---

## DNS-Based Load Balancing vs. Application-Level Load Balancing

```
DNS Load Balancing (Geographic):
  User in US  → DNS returns 52.85.151.23 (US data center)
  User in EU  → DNS returns 13.224.78.12 (EU data center)
  User in Asia → DNS returns 13.35.12.45 (Asia data center)

  ✓ Simple, works at network layer
  ✗ Clients cache one IP → imbalanced load
  ✗ Can't detect real-time server health

Application-Level Load Balancer (within a region):
  US users → DNS returns ELB (Elastic Load Balancer) IP
  ELB distributes to Server-1, Server-2, Server-3 based on health checks

  ✓ Fine-grained health checking
  ✓ Real-time traffic distribution
  ✗ Extra network hop + potential SPOF (Single Point of Failure)
```

**Best practice**: Use DNS for geographic distribution, application load balancers within each region.

---

## Real-World Examples

### Netflix — Route 53 GeoDNS (Geolocation DNS)

- Authoritative NS managed by AWS (Amazon Web Services) Route 53
- Returns different IP addresses based on your geographic location → directs to nearest Open Connect CDN (Content Delivery Network) node
- TTL = 60 s → enables rapid traffic shifting during deployments
- Handles **100 million DNS queries/hour** at peak
- Weighted routing for gradual CDN node rollouts: 1% → 5% → 25% traffic
- Health checks auto-remove failed nodes from DNS within 60 s

### Cloudflare — 1.1.1.1 Recursive Resolver

- 1.5 trillion queries/day via Anycast from 275+ data centers
- 95%+ cache hit rate
- Offers DNS-over-HTTPS (DoH) and DNS-over-TLS (DoT) to encrypt queries (prevents ISP (Internet Service Provider) from snooping)
- Mitigated a 2 Tbps (Terabits per second) DDoS (Distributed Denial of Service) attack in 2021 with zero customer downtime

### AWS Route 53 — Managed DNS

- Name "Route 53" = TCP (Transmission Control Protocol)/UDP (User Datagram Protocol) port 53
- Provides 4 nameservers per hosted zone across different AWS regions
- Health checking + automatic failover
- Alias records = CNAME-like at zone apex without performance penalty
- Integrates with ECS (Elastic Container Service), EKS (Elastic Kubernetes Service) for automatic container DNS updates
- Pricing: $0.50/month per hosted zone + $0.40/million queries

---

## MERN Dev Notes

> **MERN dev note — DNS in your Node.js apps**: Node.js uses the OS DNS resolver. If you're in a Docker container, it uses Docker's built-in DNS (at `127.0.0.11`). In Kubernetes, pods use CoreDNS for service discovery — every service name like `my-service.default.svc.cluster.local` resolves to the service's ClusterIP. This is the same DNS hierarchy, just scoped to your cluster.

> **MERN dev note — MongoDB Atlas DNS**: When you connect to Atlas using a `mongodb+srv://` URI, that's an SRV (Service) DNS record lookup under the hood. The SRV record returns the actual replica set member hostnames. Atlas handles all DNS updates when nodes change — you just keep the same connection string.

---

## Common Pitfalls

| Pitfall | Why it happens | How to avoid |
|---|---|---|
| Forgetting DNS propagation during deployments | Engineers update records and expect instant changes | Lower TTL 1× TTL period before change. Monitor both old and new endpoints during transition. |
| CNAME at zone apex | DNS spec prohibits it — conflicts with SOA and NS records | Use Route 53 Alias or Cloudflare CNAME flattening at zone apex |
| Single authoritative nameserver | Cost-cutting → if it goes down, entire domain unreachable | Always run ≥ 2 authoritative NS in different data centers or availability zones |
| Ignoring DNS query volume in capacity planning | DNS seems cheap → then a DDoS or viral event generates billions of queries | Monitor query volume, use longer TTLs for stable records, implement rate limiting |
| Exposing internal infrastructure via public DNS | Engineers create `db.internal.company.com` in public DNS | Use split-horizon DNS: public zones for internet-facing services, private zones for internal infra |

---

## Interview Cheat Sheet

**Walk me through what happens when I type `www.netflix.com` into a browser:**
> Browser cache miss → OS cache miss → Recursive resolver (ISP / 1.1.1.1) → Root server → `.com` TLD server → `netflix.com` authoritative NS → IP returned → cached at resolver (TTL 60 s) → browser connects.

**Your TTL is 3600 s and you need emergency failover:**
> You're stuck waiting up to 1 hour for cached entries to expire. That's why you pre-lower TTL to 60 s at least 1 hour before any change. For true emergencies: update the record, wait for TTL, accept some stale traffic.

**DNS load balancing vs. application load balancer:**
> DNS = geographic distribution (US/EU/Asia). App LB (Load Balancer) = within-region health-checked distribution. Use both in tandem.

**Why can't you CNAME the zone apex?**
> CNAME conflicts with required SOA/NS records at the zone root. Use Alias (Route 53) or CNAME flattening (Cloudflare) instead.

---

## Keywords / Glossary

| Term | Full Form / Meaning |
|---|---|
| DNS | Domain Name System — translates domain names to IP addresses |
| IP | Internet Protocol address (e.g. `52.85.151.23`) |
| TTL | Time To Live — how long a DNS record is cached before re-querying |
| TLD | Top-Level Domain — the `.com`, `.org`, `.net` part of a domain |
| NS | Nameserver — a server authoritative for a domain's DNS records |
| SOA | Start of Authority — zone metadata record (serial, TTL, admin) |
| CNAME | Canonical Name — DNS alias pointing one name to another |
| MX | Mail Exchange — DNS record routing email for a domain |
| TXT | Text record — arbitrary text, used for SPF, DKIM, domain verification |
| PTR | Pointer — reverse DNS lookup, IP → domain name |
| SRV | Service record — hostname + port for service discovery |
| GeoDNS | Geolocation DNS — returns different IPs based on user location |
| Anycast | Routing technique: same IP announced from multiple locations; BGP routes to nearest |
| BGP | Border Gateway Protocol — internet routing protocol used by Anycast |
| SPOF | Single Point of Failure — one component whose failure brings down the whole system |
| ISP | Internet Service Provider |
| DoH | DNS-over-HTTPS — encrypts DNS queries to prevent snooping |
| DoT | DNS-over-TLS — another DNS encryption standard |
| SPF | Sender Policy Framework — email anti-spoofing TXT record |
| DKIM | DomainKeys Identified Mail — email signing standard |
| DMARC | Domain-based Message Authentication — email policy standard |
| Recursive Resolver | A DNS server that performs the full hierarchy walk on behalf of a client (e.g. 1.1.1.1, 8.8.8.8) |
| Authoritative NS | A DNS server that holds the actual records for a domain — the source of truth |
| ELB | Elastic Load Balancer — AWS application-level load balancer |
| CDN | Content Delivery Network — geographically distributed cache servers |
| AWS | Amazon Web Services |
| ECS | Elastic Container Service — AWS container orchestration |
| EKS | Elastic Kubernetes Service — managed Kubernetes on AWS |
| DDoS | Distributed Denial of Service — attack flooding a service with traffic |
| UDP | User Datagram Protocol — connectionless protocol; DNS uses this for speed |
| TCP | Transmission Control Protocol — connection-oriented; DNS falls back to this for large responses |
