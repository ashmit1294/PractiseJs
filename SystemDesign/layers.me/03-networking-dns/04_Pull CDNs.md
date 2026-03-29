# 04 — Pull CDNs

> **Source**: https://layrs.me/course/hld/03-networking-dns/pull-cdns  
> **Level**: Intermediate | **Read time**: ~10 min  
> **Module**: M3 — Networking & DNS

---

## TL;DR

Pull CDNs use **lazy loading** — content only reaches edge locations when a user actually requests it. On a cache miss, the edge fetches from origin, caches it with a TTL (Time To Live), and serves all future requests from cache. This is the *default CDN model* for most websites.

**One-liner for interviews**: *"Pull CDN = origin on-demand. First user gets origin latency; every subsequent user gets edge speed. Ideal for large catalogs, unpredictable traffic, and frequently changing content — you pay bandwidth per miss, not storage everywhere."*

---

## ELI5 — Explain Like I'm 5

Imagine a library branch that doesn't stock every book upfront.

- You ask for a book → librarian says "let me order it from the main library."
- It arrives in a few minutes. They put it on the shelf AND give it to you.
- Next person who wants the same book? It's already on the shelf — instant.
- After a few weeks nobody borrows it → librarian returns it to make room (TTL expires).

That's a Pull CDN — only stock what people actually ask for. Don't pre-fill every shelf with every book just in case (that would be Push CDN).

---

## The Analogy — Library Branch on Demand

```
Pull CDN workflow:
  User 1 in Tokyo requests image.jpg
    → Edge Tokyo: "do I have image.jpg?" → CACHE MISS
    → Edge Tokyo fetches from origin (200 ms)
    → Stores in cache with TTL=24h
    → Serves image.jpg to user (~220 ms total first time)

  User 2 in Tokyo requests image.jpg (same day)
    → Edge Tokyo: "do I have image.jpg?" → CACHE HIT
    → Serves image.jpg directly (~20 ms)

  User 3 in London requests image.jpg
    → Edge London: "do I have image.jpg?" → CACHE MISS (different PoP!)
    → Edge London fetches from origin (200 ms)
    → Cached for London's users going forward
```

Each geographic edge warms up independently, based on actual local demand.

---

## Core Concept — How Pull CDNs Work

### Pull Flow Diagram

```
User in Tokyo        Tokyo Edge PoP          Origin Server (us-east-1)
     |                    |                          |
     |-- GET /image.jpg →  |                          |
     |                    |-- cache miss              |
     |                    |-- GET /image.jpg ------→  |
     |                    |                    ←------|  200 OK + Cache-Control
     |                    |-- store (TTL=24h)         |
     |←-- 200 OK image ---|                           |  (~220 ms first request)
     |                    |                           |
     |-- GET /image.jpg →  |                          |
     |                    |-- CACHE HIT               |
     |←-- 200 OK image ---|                           |  (~20 ms all subsequent)
```

### Cache Revalidation (Conditional GET)

When TTL expires, the edge doesn't blindly re-download the whole file:

```
Edge → Origin: GET /image.jpg
               If-Modified-Since: [last cached date]
               If-None-Match: [ETag value]

Origin → Edge: 304 Not Modified (content unchanged, TTL refreshed)
      OR
Origin → Edge: 200 OK + new content (content changed, re-cached)
```

This saves bandwidth — most static content doesn't change, so 304s are common.

---

## Multi-Tier Pull CDN with Origin Shielding

**The Problem**: When 200 edge locations simultaneously miss cache for the same popular content, they all hit origin at once = **thundering herd** = origin overload.

**The Solution**: Origin Shielding — a mid-tier regional cache sits between edges and origin.

```
Without shielding (thundering herd):
  Tokyo edge  → origin  ←┐
  Osaka edge  → origin   ├─── 200 requests hit origin SIMULTANEOUSLY
  Mumbai edge → origin   │    for the same viral video
  Singapore   → origin  ←┘    Origin gets overwhelmed 🔥

With origin shielding:
  Tokyo edge  → Asia-Pacific Shield Cache ──→ origin (only 1 request!)
  Osaka edge  → Asia-Pacific Shield Cache ┘   "I'll get it for all of you"
  Mumbai edge → Asia-Pacific Shield Cache ┘
  Singapore   → Asia-Pacific Shield Cache ┘
  
  200 edge requests → 1 origin request
  Origin receives load proportional to NUMBER OF SHIELD TIERS, not edge count
```

Akamai's three-tier pull model: **Edge PoPs → Regional Aggregation → Origin** reduces origin requests by 95%.

---

## TTL Configuration Strategy

| Content Type | Recommended TTL | Why |
|---|---|---|
| HTML pages | 60–300 s | Needs to be fresh; updates frequently |
| CSS (Cascading Style Sheets) / JS (JavaScript) with versioned URLs | 1 year (31,536,000 s) | Hash in filename = new file on change; no invalidation needed |
| Images (product photos, blog images) | 24 hours | Rarely change; freshness within a day is fine |
| User-generated content | 0 s (no cache) | Personalized; cache would expose user A's data to user B |
| API (Application Programming Interface) responses (public, non-personalized) | 60–300 s | May change but can tolerate brief staleness |
| News article text | 5 minutes | Breaking news needs fast updates |
| News article images | 24 hours | Images don't change after publish |

**Rule of thumb**: Match TTL to *how often the content meaningfully changes*.

---

## TTL Jitter — Solving the Thundering Herd on Expiration

Same problem: if ALL edges cached content at the same moment, TTL expiration happens simultaneously = 200 edges hit origin at once.

```
Without jitter:
  All edges cached at T=0, TTL=3600s
  At T=3600s → 200 concurrent revalidation requests → origin overloaded 🔥

With TTL jitter (± 300s random variance):
  Edge 1: TTL expires at T=7150s
  Edge 2: TTL expires at T=7230s
  Edge 3: TTL expires at T=7180s
  ...
  → Revalidation spread over 10 minutes → origin handles smoothly ✓
```

Also use **stale-while-revalidate**: serve slightly stale content while background revalidation completes — users never see slow responses.

---

## Pull CDN Variants

```
1. Single-Tier Pull (simple):
   Edge locations pull directly from origin
   ✓ Simple setup
   ✗ Origin load ∝ number of edge locations

2. Multi-Tier with Origin Shields (production standard):
   Edge → Regional Shield → Origin
   ✓ 90%+ reduction in origin requests
   ✓ Cross-region bandwidth savings
   ✗ Slightly more latency for cache misses

3. Hybrid Pull-Push:
   Critical assets → pushed to edges proactively
   Long-tail content → pulled on demand
   ✓ Best of both worlds
   ✓ Used by Amazon CloudFront (Lambda@Edge pre-warming)
   ✗ More operational complexity

4. Hierarchical Pull (parent-child PoPs):
   Small edges pull from larger regional edges → pull from origin
   ✓ Natural load distribution through hierarchy
   Example: CDN has 500 small edge PoPs → 50 regional hubs → origin
```

---

## Cold-Start Problem

The pull CDN's biggest weakness: the very **first user** at each geographic edge gets the **origin round-trip latency** (~200 ms+), not the fast edge response (~20 ms).

**Mitigations:**

```
1. Cache warming — proactively request content through CDN before traffic arrives
   Netflix: edge servers pull predicted popular content overnight
   E-commerce: warm caches with predicted hot products 2 hours before sale

2. Multi-tier shielding — at least the shield is warm even if edge misses
   Edge misses → hits regional shield → shield is likely warm → fast

3. Stale-while-revalidate — serve slightly expired content while refreshing
   Users see fast response even at TTL boundary

4. Prefetching — push select "hot" content, pull everything else (hybrid)
```

---

## Real-World Examples

### Akamai — Three-Tier Pull CDN

- 300,000+ edge servers, three-tier pull model
- ML (Machine Learning) models analyze traffic patterns → predictive cache warming
- Black Friday example for e-commerce: warmed caches with predicted hot products 2 hours before sale → **98% cache hit rate from the first second**
- Origin shield reduced origin requests by 95%: **50 million RPS (Requests Per Second) total**, only **2.5 million/s** hit customer origins

### Amazon CloudFront — AWS Pull CDN

- Uses "Regional Edge Caches" as origin shield layer
- Singapore edge miss → pulls from Asia-Pacific Regional Cache → pulls from S3 (Simple Storage Service) only if needed (not all the way to us-east-1)
- Viral video example: 0 → 10 million views in 2 hours
  - 200 edges missed → Regional Cache served all of them → only **12 requests** hit origin S3
  - Subsequent requests: **99.8% cache hit rate**
- Lambda@Edge: custom logic at edge for cache warming, A/B testing, cache key normalization

---

## MERN Dev Notes

> **MERN dev note — CloudFront in front of Express/Node.js**: If you put CloudFront in front of your Express API, be careful with default caching behavior. Express APIs often return `200 OK` without explicit `Cache-Control` headers. CloudFront will cache these responses by default with a TTL it chooses! Always return explicit `Cache-Control: no-store` for personalized or stateful API responses. Only allow caching for truly public, non-personalized endpoints (like `GET /public/products`).

> **MERN dev note — Mongoose and CDN**: MongoDB-served data (via Mongoose queries in Express) should generally **NOT** be cached by CDN for user-specific data. But for catalog data (product lists, blog posts, public data), you can cache the API JSON (JavaScript Object Notation) response at the CDN layer. Set `Cache-Control: public, max-age=300` and your CDN stores the JSON. This turns `300 MongoDB reads/minute` into `1 MongoDB read per 5 minutes`. Huge win for read-heavy public data.

---

## Push vs. Pull Decision Framework

```
                   UPDATE FREQUENCY?
                  ┌────────────────────┐
         Frequent │  PULL CDN          │ Infrequent
         (hourly+)│  lazy loading      │ (daily/weekly)
                  │  handles updates   │    ↓
                  └────────────────────┘  TRAFFIC PREDICTABLE?
                                         ┌──────────────────┐
                                 Yes, high│   PUSH CDN       │ No, unpredictable
                                 & steady │   pre-distribute │     ↓
                                         └──────────────────┘   PULL CDN
                                                                 (pay per use)

CATALOG SIZE?
  Huge (millions of assets, most rarely accessed) → PULL CDN (pay only for what's fetched)
  Small (thousands of assets, all popular)        → PUSH CDN (fixed storage amortized)

ORIGIN CAPACITY?
  Constrained / expensive → PUSH CDN (zero origin traffic)
  Ample / cheap           → PULL CDN (origin handles misses)

REAL-WORLD RULE:
  Most websites → Pull CDN (default)
  Netflix video / marketing campaign assets → Push CDN or Hybrid
```

---

## Common Pitfalls

| Pitfall | Why it happens | How to avoid |
|---|---|---|
| **Thundering herd on cache expiration** | All edges cached at same time → TTL expires simultaneously → 200 requests hit origin at once | Add TTL jitter (±10% random variance); implement `stale-while-revalidate` |
| **Poor cache key design** | `image.jpg?user=123` and `image.jpg?user=456` create separate cache entries even if identical | Normalize cache keys; strip irrelevant query params (UTM tracking, session IDs) |
| **Under-provisioning origin for cache misses** | Team sizes origin for 95% cache-hit steady state → viral event causes 20× origin traffic spike | Provision origin for **at least 20% of total traffic** (not 5%); implement origin rate limiting; use auto-scaling |
| **Caching personalized content accidentally** | Missing `Vary` header or `Cache-Control: private` on personalized responses | Always mark user-specific responses with `Cache-Control: private, no-store`; test with multiple user sessions |
| **Ignoring cold-start latency** | Assuming all users get edge speed immediately | Implement cache warming for predictable traffic spikes; use origin shielding to reduce miss latency |

---

## Interview Cheat Sheet

**When would you choose pull CDN over push CDN?**
> When content updates frequently, traffic is unpredictable, the content catalog is large (most files rarely accessed), or origin has ample capacity. In most cases, pull CDN is the default and correct choice.

**How do you handle the cold-start problem?**
> Cache warming: proactively request content through CDN before real traffic. For predictable spikes (product launches, sports events), warm caches 1–2 hours in advance. For unpredictable traffic, multi-tier shielding ensures shield caches are warm even if edge misses.

**What happens when TTL expires? Why does it matter for system design?**
> Edge revalidates with origin using conditional GET (If-Modified-Since / ETag). If unchanged: 304 = refreshed TTL, no re-download. If changed: 200 = new content cached. Matters because if all edges expire simultaneously, origin gets thundering herd. Solution: TTL jitter and stale-while-revalidate.

**How do you prevent origin overload in a pull CDN?**
> Three layers: (1) origin shielding (regional mid-tier cache consolidates requests), (2) TTL jitter (stagger expiration across edges), (3) stale-while-revalidate (serve slightly stale content during background refresh). Also over-provision origin for cache-miss scenarios, not just steady-state cache-hit scenario.

**Bandwidth vs. storage in pull vs. push:**
> Pull: you pay per-GB bandwidth fetched from origin on each miss. Efficient when most content is rarely accessed (pay only for what's fetched). Push: you pay for storage × edge count, fixed cost. Efficient when content is accessed very frequently (fixed cost amortized over millions of requests).

---

## Keywords / Glossary

| Term | Full Form / Meaning |
|---|---|
| Pull CDN | CDN model where edges fetch content from origin on first request (lazy loading) |
| Push CDN | CDN model where you proactively upload content to all edges before requests |
| Cache miss | Request where edge doesn't have the content; must fetch from origin |
| Cache hit | Request served from edge cache; no origin contact |
| TTL | Time To Live — cache expiry duration |
| Origin shielding | Mid-tier cache layer between edges and origin; prevents thundering herd |
| Thundering herd | Many nodes simultaneously requesting same resource, overwhelming origin |
| TTL jitter | Adding random variance to TTL to prevent simultaneous mass expiration |
| Stale-while-revalidate | Serving expired/stale content while fetching fresh version in background |
| ETag | Entity Tag — HTTP (Hypertext Transfer Protocol) header for cache validation |
| Conditional GET | HTTP request with If-Modified-Since or If-None-Match for cache revalidation |
| Cold-start | First-request latency penalty in pull CDN before content is cached at an edge |
| Cache warming | Proactively requesting content through CDN before real user traffic arrives |
| Cache busting | Using versioned URLs to force edge to treat new version as uncached content |
| PoP | Point of Presence — a CDN edge location |
| RPS | Requests Per Second — query throughput metric |
| ML | Machine Learning |
| CDN | Content Delivery Network |
| API | Application Programming Interface |
| JSON | JavaScript Object Notation — common format for API responses |
| CSS | Cascading Style Sheets |
| JS | JavaScript |
| AWS | Amazon Web Services |
| S3 | Simple Storage Service — AWS object storage |
| OCA | Open Connect Appliance — Netflix's custom CDN hardware |
| ISP | Internet Service Provider |
| Bandwidth | Data transferred (GB/TB); billed by pull CDNs per transfer |
| Storage | Disk space (GB-months); billed by push CDNs per edge |
