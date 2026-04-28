# M3 — Networking & DNS: Quick-Review Summary

> 4 topics | Covers: DNS Resolution, CDN Architecture, Push vs Pull CDNs

---

## Topics at a Glance

| # | Topic | Core Insight |
|---|---|---|
| T01 | DNS Fundamentals | Hierarchical distributed KV store; maps names → IPs via caching with TTL |
| T02 | CDN Overview | Edge PoPs serve cached content near users; 200ms → 20ms |
| T03 | Push CDNs | Pre-load every edge; zero origin traffic; pay for storage everywhere |
| T04 | Pull CDNs | Lazy load on first request per PoP; pay bandwidth per miss |

---

## T01 — DNS Fundamentals

**One-liner**: DNS is a globally distributed, hierarchical key-value store: domain name → IP address. Eventual consistency via TTL.

### Resolution Flow
```
Browser cache → OS cache → Recursive Resolver → Root Server → TLD Server → Authoritative NS
                                (your ISP/8.8.8.8)  (.com registry)  (netflix.com)
```

1. Browser checks local cache (TTL not expired?)
2. OS resolver checks its cache
3. Recursive resolver queries **root** → root says "ask .com"
4. Resolver asks **.com TLD** → "ask netflix.com's NS"
5. **Authoritative NS** returns IP (e.g., 52.85.151.23) + TTL
6. Result cached at every layer with TTL

### Key Record Types

| Record | Purpose | Example |
|---|---|---|
| **A** | domain → IPv4 | `api.example.com → 1.2.3.4` |
| **AAAA** | domain → IPv6 | `api.example.com → 2001:db8::1` |
| **CNAME** | alias → domain | `www → example.com` |
| **MX** | mail server | `example.com → mail.example.com` |
| **TXT** | verification/SPF | various |
| **NS** | name server for zone | `example.com NS ns1.provider.com` |

### TTL Trade-offs

| TTL | Benefit | Cost |
|---|---|---|
| Short (30–60s) | Fast IP change propagation | More resolver queries, higher DNS load |
| Long (3600s+) | Fewer queries, faster resolution | Slow failover — clients stuck on old IP |

**DNS load balancing**: multiple A records for same domain → clients rotate. Dirt-simple but no health checks.

> DNS changes are **eventually consistent** — old TTL must expire everywhere before propagation completes.

---

## T02 — CDN Overview

**Problem**: Origin server in San Francisco → Tokyo user gets 200ms latency.  
**Solution**: CDN edge PoP in Tokyo → 20ms latency (10× improvement).

### CDN Architecture (3 Tiers)
```
Users (Tokyo / London / Mumbai)
        ↓ DNS routes to nearest edge
Edge Layer (Tier 1 PoPs) — ~10 GB cache, lowest latency
        ↓ on miss
Regional Cache (Tier 2 Shields) — ~100 GB, aggregates Tier 1 misses
        ↓ on miss
Origin Server — handles only cache misses
```

### How It Works
1. User DNS query → DNS returns IP of **nearest PoP** (via Anycast or geo-DNS)
2. PoP checks local cache → **HIT**: return directly (~20ms)
3. Miss → PoP fetches from origin → stores with `Cache-Control` TTL → serves user
4. All subsequent users at that PoP get instant responses

### Key Metrics
- **Cache hit ratio**: 80–95% typical; only misses reach origin
- HTTP `Cache-Control` headers control what/how long CDN caches
- `Surrogate-Control` header: CDN-only TTL (overrides browser caching)

### What CDNs Cache

| ✅ Cache (static/slow-changing) | ❌ Don't cache (dynamic/private) |
|---|---|
| JS/CSS/images/fonts | Shopping cart, user sessions |
| Video chunks (.m3u8, .ts) | Checkout, payment APIs |
| HTML pages (short TTL) | Real-time data, personalized content |

---

## T03 — Push CDNs

**Model**: Publisher pushes content to ALL edges **before** any user requests it.

### Push Flow
```
CI/CD pipeline → API upload to CDN origin
CDN replicates to ALL 200+ edge locations (takes minutes)
Users arrive → served from edge immediately (zero origin traffic)
```

### When to Use Push CDNs

| ✅ Push | ❌ Don't Push |
|---|---|
| Small, predictable content set | Large unknown catalog |
| High but predictable demand | Long-tail, infrequent access |
| Content updated rarely | Frequently changing content |
| Critical: must be at edge before traffic spike | Unknown where users are |

**Examples**: Software downloads (GitHub releases), game patches, firmware updates, marketing campaign assets.

**Trade-off**: Pay for **storage** at every edge even for content nobody requests there.  
**Benefit**: Zero origin traffic, guaranteed edge presence, cold start solved.

---

## T04 — Pull CDNs

**Model**: Edge fetches from origin **only when** a user in that region actually requests the content (lazy loading).

### Pull Flow
```
User 1 requests image.jpg (Tokyo edge)
  → CACHE MISS → edge fetches from origin (220ms) → stores TTL=24h → serves
User 2 requests image.jpg (Tokyo edge)
  → CACHE HIT → serves from edge (20ms)
User 3 requests image.jpg (London edge)
  → CACHE MISS → London fetches its own copy (different PoP!)
```

### When to Use Pull CDNs

| ✅ Pull | ❌ Don't Pull |
|---|---|
| Large/unpredictable content catalog | Pre-launch content needing global warmup |
| Geographically diverse, unpredictable traffic | Critical assets that MUST be at edge |
| Content changes frequently | Single-region content delivery |
| E-commerce product images (millions of SKUs) | Software downloads (known, huge demand) |

**Trade-off**: First user in each region gets origin latency (cache miss).  
**Benefit**: Only pay bandwidth per miss; storage only where content is actually requested.

### Cache-Control Headers (Critical for Correct CDN Behavior)

```
Cache-Control: max-age=86400          → cache for 24h
Cache-Control: no-store               → never cache
Cache-Control: s-maxage=3600          → CDN-only TTL (overrides max-age for CDNs)
Cache-Control: stale-while-revalidate=60 → serve stale up to 60s while refreshing
ETag: "abc123"                        → fingerprint; 304 Not Modified if unchanged
```

---

## Push vs Pull — Master Comparison

| Dimension | Push CDN | Pull CDN |
|---|---|---|
| **Origin traffic** | Near zero after push | Only on cache misses |
| **First-user latency** | Excellent (pre-loaded) | Poor (origin round-trip) |
| **Storage cost** | High (all content at all edges) | Low (only requested content) |
| **Implementation** | Complex (upload pipeline) | Simple (set Cache-Control headers) |
| **Content updates** | Manual re-push required | Automatically stale on TTL expiry |
| **Cache warming** | Immediate (pre-pushed) | Gradual (warms as users request) |
| **Best for** | Predictable, critical, small volume | Large catalog, unpredictable demand |

---

## Interview Cheat Sheet — M3

| Question | Answer |
|---|---|
| DNS resolution steps? | Browser → OS → Resolver → Root → TLD → Authoritative |
| How does DNS achieve load balancing? | Multiple A records for same domain; clients rotate |
| Why are DNS changes slow? | TTL must expire everywhere; eventual consistency |
| CDN cache miss flow? | Edge fetches from origin → stores with TTL → serves → all future hits are local |
| Push vs Pull CDN key difference? | Push = pre-load everywhere; Pull = lazy-load on first request |
| When would you use push CDN? | Small known content, critical demand, predictable usage |
| What's a CDN shield/shield cache? | Intermediate Tier 2 cache between edges and origin — reduces origin hits further |
| How does CDN routing work? | DNS returns nearest PoP IP via Anycast or geo-DNS routing |

---

## Keywords

`DNS` · `recursive resolver` · `authoritative nameserver` · `TTL` · `A record` · `CNAME` · `CDN` · `PoP` · `edge server` · `cache hit ratio` · `push CDN` · `pull CDN` · `shield cache` · `Cache-Control` · `ETag` · `Anycast` · `geo-DNS` · `origin server` · `content delivery` · `CDN warming` · `cache miss` · `s-maxage`
