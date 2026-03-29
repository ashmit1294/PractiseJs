# 02 — CDN Overview

> **Source**: https://layrs.me/course/hld/03-networking-dns/cdn-overview  
> **Level**: Intermediate | **Read time**: ~12 min  
> **Module**: M3 — Networking & DNS

---

## TL;DR

A CDN (Content Delivery Network) is a geographically distributed network of edge servers that cache and serve content closer to users. Instead of every user hitting your origin server in San Francisco across a 200 ms round-trip, a CDN edge in Tokyo serves the same content in ~20 ms.

**Key metric**: Cache hit ratio (80–95% typical). Only cache misses reach the origin.

**One-liner for interviews**: *"A CDN places cached copies of your content close to users worldwide, turning a 200 ms origin round-trip into a 20 ms edge response — the trade-off is CDN cost vs. infrastructure savings and revenue impact."*

---

## ELI5 — Explain Like I'm 5

Imagine a single pizza kitchen in San Francisco. Every time someone anywhere in the world wants pizza, they have to wait for delivery from San Francisco — Tokyo gets cold pizza after a very long wait.

Now imagine a **franchise chain** with kitchens in New York, London, Tokyo, Sydney. Each kitchen stocks popular toppings (cached content). New York customers get hot pizza fast. Tokyo customers get hot pizza fast. If a location doesn't have an unusual topping, it calls the San Francisco HQ (origin server) to get the recipe, then keeps it in stock for next time.

That's a CDN — smaller kitchens (edge PoPs — Points of Presence) closer to customers, so delivery is fast.

---

## The Analogy — Franchise Restaurant Chain

```
WITHOUT CDN:
  User in Tokyo ──────────────────────→ Origin Server (San Francisco)
                   ~200 ms round-trip        ↑ handles ALL traffic
  User in Mumbai ──────────────────────→ Origin Server
  User in London ──────────────────────→ Origin Server

WITH CDN:
  User in Tokyo ──→ Edge Tokyo (~20 ms)  ──→ (cache miss only) Origin SF
  User in Mumbai ──→ Edge Mumbai (~20 ms) ──→ (cache miss only) Origin SF
  User in London ──→ Edge London (~20 ms) ──→ (cache miss only) Origin SF
                                                 ↑ 90% less traffic
```

The edge servers ARE the franchise branches — pre-stocked, local, fast.

---

## Core Concept — CDN Architecture

### Three Layers

```
┌─────────────────────────────────────────────────────────┐
│  USERS                                                  │
│  Tokyo user / London user / Mumbai user                 │
└───────────────────────┬─────────────────────────────────┘
                        ↓ DNS routes to nearest edge
┌─────────────────────────────────────────────────────────┐
│  EDGE LAYER (Tier 1) — PoPs (Points of Presence)        │
│  Smallest cache (~10 GB). Lowest latency for users.     │
│  Tokyo PoP / Osaka PoP / London PoP / Paris PoP         │
└───────────────────────┬─────────────────────────────────┘
                        ↓ on miss
┌─────────────────────────────────────────────────────────┐
│  REGIONAL CACHE (Tier 2) — Shield Caches                │
│  Larger cache (~100 GB). Aggregates misses from edges.  │
│  Asia-Pacific regional / Europe regional                │
└───────────────────────┬─────────────────────────────────┘
                        ↓ on miss
┌─────────────────────────────────────────────────────────┐
│  ORIGIN SERVER — Source of Truth                        │
│  San Francisco / AWS us-east-1. Serves only ~5–10%      │
│  of total traffic after caching.                        │
└─────────────────────────────────────────────────────────┘
```

### Cache Hit vs Cache Miss

```
Cache HIT (90% of requests):
  User → Edge Tokyo → content in local cache → serve (~20 ms)

Cache MISS (10% of requests):
  User → Edge Tokyo → not cached → fetch from origin (~200 ms)
                                → store with TTL → serve (~220 ms)
  All subsequent requests → cache hit (~20 ms) until TTL expires
```

---

## CDN Routing Strategies

### DNS-Based Routing (GeoDNS)

```
User in Tokyo queries cdn.example.com
→ GeoDNS returns 203.0.113.10  (Tokyo edge IP)

User in London queries cdn.example.com
→ GeoDNS returns 198.51.100.20 (London edge IP)

✓ Simple, fine-grained control, easy traffic shaping
✗ DNS TTL (Time To Live) delays = 30–300 s failover time
✗ DNS resolver location ≠ actual user location
```

### Anycast Routing

```
All regions advertise the SAME IP: 192.0.2.1 via BGP (Border Gateway Protocol)
→ Internet routing automatically directs packets to topologically nearest edge

User in Tokyo → BGP routes to Tokyo edge (192.0.2.1)
User in London → BGP routes to London edge (192.0.2.1, same IP!)

✓ Instant failover (no DNS TTL delay)
✓ Automatic optimal routing
✓ Excellent DDoS (Distributed Denial of Service) mitigation
✗ Complex BGP (Border Gateway Protocol) configuration
✗ Requires Autonomous System (AS) numbers
✗ Less fine-grained traffic control
```

Most CDNs use **DNS-based routing** for simplicity; **Cloudflare uses Anycast** for performance.

---

## Cache Invalidation Strategies

Invalidation = making edges forget cached content so they fetch a fresh copy.

### Strategy 1 — TTL-Based Expiration (Simplest)

```
Upload style.css with header: Cache-Control: max-age=3600
→ Edges cache for 1 hour
→ After 1 hour, next request fetches fresh copy from origin

✓ Automatic, no coordination needed
✗ Can't force immediate update before TTL expires
✗ Stale content served for up to TTL duration
```

### Strategy 2 — Explicit Purge

```
Upload new style.css to origin
→ Issue purge API call to CDN provider
→ CDN propagates invalidation to all edges (5–30 seconds)
→ Next request fetches fresh version

✓ You control update timing
✓ Works with long TTLs
✗ Propagation takes 5–30 s (not instant)
✗ Requires API integration in deployment pipeline
```

### Strategy 3 — Versioned URLs / Cache Busting (Best for JS/CSS)

```
Old: /assets/style.css → /assets/style.v1.css  (cached for 1 year)
New: /assets/style.css → /assets/style.v2.css  (new file, fresh cache)

→ Old version remains cached, harmlessly
→ New HTML references v2 → treated as brand new content → instant
→ Rollback: just point HTML back to v1

✓ Instant "invalidation" (new URL = new object)
✓ No propagation delay
✓ Rollback friendly
✗ Requires build pipeline to generate unique filenames
✗ Stores multiple versions in storage
```

**Twitter** uses versioned URLs for JS/CSS bundles. **News sites** like CNN use short TTLs (60–300 s) for article text while using long TTLs (24 h) for article images.

---

## Key Metrics

| Metric | What it measures | Typical value |
|---|---|---|
| **Cache hit ratio** | % of requests served from edge (not origin) | 80–95% for static assets |
| **P95 latency** | 95th percentile (P95) latency at edge | < 30 ms for cached content (Cloudflare) |
| **Origin offload %** | % of traffic NOT hitting origin | 85–95% |
| **CDN cost per GB** | Transfer cost billed by CDN | $0.08–0.20/GB typical |

### Cache Hit Ratio Impact Example

```
Total traffic: 10 million requests/day

  Hit ratio 85% → 1.5 million requests hit origin
  Hit ratio 95% → 500,000 requests hit origin

  Improvement: 67% reduction in origin traffic
  At $0.05/request to serve from origin: saves $50,000/day
```

---

## Trade-offs

### Cost vs. Performance

| Scenario | Recommendation |
|---|---|
| Geographically distributed users, >30% static content | **Use CDN** |
| Internal tool, users co-located with origin | **Skip CDN** |
| Highly dynamic personalized content | **Skip CDN** (low cache hit potential) |
| Very low traffic (<1 million requests/month) | **Skip CDN** (cost > benefit) |
| Video streaming / large files | **Use CDN** + carefully manage per-GB costs |

### TTL Configuration

| Content type | Recommended TTL | Rationale |
|---|---|---|
| Immutable assets (versioned URLs) | 1 year (31,536,000 s) | Never changes; maximize cache |
| CSS (Cascading Style Sheets) / JS (JavaScript) | 1–24 hours | Changes infrequently |
| HTML pages | 60–300 s | May update frequently |
| API (Application Programming Interface) responses | 0 s or very short | Usually dynamic/personalized |
| Images | 24 hours | Rarely changes |

### Single CDN vs. Multi-CDN

| Approach | When to use |
|---|---|
| **Single CDN** | Starting out; <10 TB/month; team without CDN ops experience |
| **Multi-CDN** | >10 TB/month (negotiate rates); need 99.99%+ uptime; CDN outages unacceptable |

Spotify uses multi-CDN (Fastly + Google Cloud CDN + Cloudflare) with real-time performance-based routing, reducing costs 20–30% while maintaining sub-50 ms P95 latency globally.

---

## Real-World Examples

### Netflix — Open Connect CDN (Custom-Built)

Netflix accounts for ~15% of global internet bandwidth. Commercial CDNs couldn't handle this economically, so they built their own:

- **Open Connect Appliances (OCAs)** — hardware deployed **inside ISP (Internet Service Provider) networks**, physically co-located with subscribers
- Each OCA stores 100–200 TB (Terabytes) of content
- **Push model** during off-peak hours: popular shows pre-loaded nightly
- **95%+ cache hit ratio** — origin never serves video directly to subscribers
- **5–10 ms** latency for subscribers (content is inside your ISP's own network!)
- Control plane on AWS (Amazon Web Services) handles routing decisions, health checks, and content placement

### Cloudflare — 300+ PoP Anycast Network

- **50 million HTTP requests/second** globally
- Anycast routing across 300+ edge locations in 100+ countries
- **P95 latency < 30 ms** for cached content
- Workers platform: runs JavaScript edge functions without origin round-trips
- Tiered caching: edge → upper-tier → origin
- Example: e-commerce site uses Workers for personalized product recommendations at the edge (10 ms vs 200 ms from origin)

### Spotify — Multi-CDN Audio Streaming

- 500+ million users, 5 billion hours streamed monthly
- Uses Fastly + Google Cloud CDN + Cloudflare
- Traffic management monitors real-time latency, error rates, throughput per CDN
- Audio files: multiple bitrates (96 kbps — kilobits per second, 160 kbps, 320 kbps), TTL = 30 days (music rarely changes)
- Client apps auto-retry/fallback across CDNs on failure
- **99.99% availability** despite individual CDN outages

---

## MERN Dev Notes

> **MERN dev note — CDN for Next.js/React**: Next.js static assets (JS/CSS bundles, images) are automatically CDN-friendly. Vercel's global CDN is built in. For self-hosted Next.js, configure your CDN's origin to your Node.js server and set long TTLs for `/_next/static/` paths (they use content-hash versioning by default). Use short or zero TTL for HTML pages since those change on deploy.

> **MERN dev note — MongoDB GridFS vs CDN**: Don't serve large files through MongoDB GridFS through your Express API — it routes everything through your Node.js process and origin server. Store files in S3/Cloudflare R2, then serve via CDN. Your Node.js server only handles auth checks and redirect URLs.

---

## Common Pitfalls

| Pitfall | Why it happens | How to avoid |
|---|---|---|
| Caching personalized content | Engineers miss `Vary` headers; user A's cart served to user B | Use explicit `Cache-Control: private` for personalized responses; use cache keys that exclude user IDs |
| Ignoring cache invalidation latency | Assuming purge = instant | Purge takes 5–30 s globally; use versioned URLs for critical assets |
| Underestimating CDN costs for video | CDN is per-GB; 1 TB video = $80–200 | Use specialized video CDNs (Cloudflare Stream, Fastly) or hybrid approaches |
| Cache fragmentation from query strings | `image.jpg?user=123` and `image.jpg?user=456` = separate cache entries | Normalize cache keys; strip irrelevant query params (UTM tracking params) |
| Not monitoring cache hit ratio | Assuming CDN is working | Set up alerts: if hit ratio drops below 70%, TTLs may be too short or cache key is broken |

---

## Interview Cheat Sheet

**How does a CDN reduce latency?**
> Physical distance = latency (speed-of-light limit). CDN edge servers near users eliminate 10,000+ km of travel. 200 ms → 20 ms.

**What is cache hit ratio and why does it matter?**
> % of requests served from edge vs. fetching from origin. 90% hit ratio = 10× less origin load, lower cost, faster responses. Key optimization lever.

**DNS-based routing vs. Anycast:**
> DNS routing: different IPs per location via GeoDNS — simple, minor TTL delay on failover. Anycast: same IP from everywhere, BGP auto-routes — instant failover, complex setup. Cloudflare uses Anycast.

**How do you handle cache invalidation?**
> Three options: wait for TTL (simple, no control), explicit purge (5–30 s propagation), or versioned URLs (instant, preferred for JS/CSS). Use versioned URLs for critical assets; purge for content that can't be versioned.

**When NOT to use a CDN?**
> Internal tools with co-located users, highly dynamic personalized responses with near-zero cache hit potential, or very low-traffic sites where CDN fee > origin cost.

---

## Keywords / Glossary

| Term | Full Form / Meaning |
|---|---|
| CDN | Content Delivery Network — distributed edge servers caching content near users |
| PoP | Point of Presence — a CDN edge location / data center |
| Edge server | A CDN server at a PoP — serves cached content to nearby users |
| Origin server | The authoritative source of content (your own server / S3 bucket) |
| Cache hit | Request served from edge cache without contacting origin |
| Cache miss | Edge doesn't have the content; must fetch from origin |
| Cache hit ratio | % of requests served from cache (not origin); target 80–95% |
| TTL | Time To Live — how long cached content is considered valid |
| Purge | Explicitly invalidating cached content at CDN edges |
| Cache busting | Using versioned URLs to force new cache entries |
| GeoDNS | Geolocation DNS — returns different IPs based on user geographic location |
| Anycast | Same IP advertised from multiple locations; BGP routes to nearest |
| BGP | Border Gateway Protocol — internet routing protocol |
| P95 | 95th percentile — 95% of users get this latency or better |
| OCA | Open Connect Appliance — Netflix's custom CDN hardware inside ISP networks |
| ISP | Internet Service Provider |
| DDoS | Distributed Denial of Service — flooding attack; CDNs absorb these |
| AWS | Amazon Web Services |
| API | Application Programming Interface |
| JS | JavaScript |
| CSS | Cascading Style Sheets |
| TTL | Time To Live — cache expiry duration |
| RTT | Round-Trip Time — total latency for a request + response |
| HTTP | Hypertext Transfer Protocol |
| HTTPS | HTTP Secure — encrypted HTTP using TLS |
| TLS | Transport Layer Security — encryption protocol for HTTPS |
| Cache-Control | HTTP response header that tells CDN/browser how long to cache content |
