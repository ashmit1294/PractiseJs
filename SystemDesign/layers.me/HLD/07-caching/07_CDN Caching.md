# T07 — CDN Caching

---

## 1. ELI5

Imagine a pizza chain. If there's only one pizza shop in New York, someone in Los Angeles has to wait 5+ hours for delivery. That's terrible.

A smart pizza chain opens stores in every city. When someone in LA orders a pepperoni pizza (the most popular kind), the LA store serves it instantly because they already made some. Only for exotic custom orders does the LA store call New York for the recipe.

**CDN = a network of pizza stores (edge servers) in every city globally.** Your website is the New York headquarters (origin server). Static files (images, CSS, JS) are the pepperoni pizzas — made once, distributed everywhere, served locally from the nearest edge node.

---

## 2. Analogy

**Book publisher with regional warehouses:**

Publishers don't ship every book directly from the main print facility. They distribute to regional warehouses in major cities. When a bookstore orders a Harry Potter book (ultra-popular), the regional warehouse has it ready to ship same-day. Only for obscure books (cache miss) does the order go back to the main facility (origin server).

CDN edge nodes = regional warehouses.
Origin server = main printing facility.
Cache hit = warehouse has the book.
Cache miss = must order from the printing facility (origin fetch).

---

## 3. Core Concept

### CDN Architecture

```
User (Tokyo)                                   Origin Server
     │                                          (New York)
     │ Request: GET /images/hero.jpg           
     ▼                                         
┌─────────────────┐                            
│  CDN Edge Node  │ ←────── Cache HIT ─────── │ hero.jpg cached
│  Tokyo PoP      │         (< 20ms RTT)       │ from earlier request
│  (Point of      │                            │
│   Presence)     │                            │
└─────────────────┘                            
     │                                         
     │ Cache MISS: hero.jpg not yet cached      
     │                                         
     └──────────────── Origin Fetch ──────────►│
                       (150ms RTT NY→Tokyo)    │ GET /images/hero.jpg
                                               │ ← 200 OK + Cache-Control headers
     ◄────────────────────────────────────────┘
     │ hero.jpg now cached at Tokyo PoP        
     │ TTL set per Cache-Control header        
     ▼                                         
User receives image
(cached for all future Tokyo users)

Next Tokyo user requesting same file:
  CDN → Cache HIT → < 20ms → No origin fetch needed
```

### PoP Distribution

```
Major CDN providers and their PoP counts (2025):
  Cloudflare:    300+ PoPs globally (250+ cities)
  Akamai:        4,200+ servers in 1,000+ cities (largest)
  AWS CloudFront: 600+ PoPs
  Fastly:        90+ PoPs in 60+ markets
  
PoP selection: DNS-based GeoDNS routes users to nearest PoP
  User in Mumbai → Mumbai/Chennai PoP (5ms RTT)
  Without CDN: same user → Virginia origin server (200ms RTT)
  
Latency reduction: 200ms → 5ms = 97.5% latency improvement for static assets
```

---

## 4. CDN vs Browser Cache Directives

```
┌────────────────────────────────────────────────────────────────────┐
│ Header                  │ Who respects it?        │ Use case       │
├─────────────────────────┼─────────────────────────┼────────────────┤
│ Cache-Control: max-age  │ Browser + CDN           │ General TTL    │
│ Cache-Control: s-maxage │ CDN ONLY (not browser)  │ CDN-specific   │
│ Cache-Control: private  │ CDN skips, browser caches│ User-specific │
│ Cache-Control: public   │ Browser + CDN + proxies │ Public content │
│ Surrogate-Control       │ CDN ONLY (Fastly/Varnish)│ CDN control   │
│ CDN-Cache-Control       │ Cloudflare specific     │ Cloudflare TTL │
└─────────────────────────┴─────────────────────────┴────────────────┘

Pattern: serve user-specific pages through CDN without CDN caching them
  Cache-Control: private, max-age=60
  → Browser caches 60s
  → CDN passes through (does NOT cache)
  → No data leakage between users

Pattern: long CDN TTL, short browser TTL
  Cache-Control: public, max-age=60, s-maxage=86400
  → Browser: 60 seconds (user sees fresh data within 1 minute)
  → CDN: 24 hours (CDN doesn't re-fetch from origin constantly)
  → CDN serves cached response to all users; each user browser TTL is 60s
```

---

## 5. Cache Invalidation on CDN

```
Problem: new app version deployed, but CDN caches old JS/CSS for 24h

Solution 1 — Content Hashing (best):
  app.a3f9c2.js → new deploy → app.b7e1d4.js
  CDN caches both URLs separately; old URL simply unused
  Zero invalidation needed; no purge API calls
  
Solution 2 — CDN Purge API:
  AWS CloudFront:
    aws cloudfront create-invalidation \
      --distribution-id EXDIS1234 \
      --paths "/api/products/*"
    Propagation: 1-5 minutes to all 600+ PoPs
    Cost: $0.005 per invalidation path (first 1000/month free)
    
  Cloudflare:
    curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache" \
      --data '{"files": ["https://example.com/api/products/"]}'
    Propagation: < 150ms globally (Cloudflare's superfast purge)
    
  Fastly:
    Surrogate-Key (cache tags) mechanism:
      Response header: Surrogate-Key: product:123 category:electronics
      Purge by tag: PURGE /api with Surrogate-Key: product:123
      All responses tagged product:123 purged instantly globally

Solution 3 — Short s-maxage:
  s-maxage=60 → CDN caches only 60 seconds → "stale" for max 60s
  No purge needed; just wait for TTL
  Use for dynamic content that changes frequently (product prices)
```

---

## 6. Vary Header — Caching Multiple Variants

```
Problem: same URL, different responses for different users/contexts:
  GET /api/products → English for US users, French for FR users
  Without Vary: CDN caches first response, serves it to everyone
  
Solution — Vary header:
  Response: Vary: Accept-Language
  CDN creates separate cache entries per language:
    /api/products (Accept-Language: en-US) → cached separately
    /api/products (Accept-Language: fr-FR) → cached separately

Common Vary use cases:
  Vary: Accept-Encoding    → separate gzip/brotli/plain responses
  Vary: Accept-Language    → multi-language sites
  Vary: Accept             → separate JSON/HTML responses same URL
  
Warning — Vary: User-Agent (BAD):
  Thousands of different user agents → thousands of cache keys
  86% CDN hit ratio drops to < 5% hit ratio
  NEVER vary by User-Agent unless absolutely necessary
  
Better solution than Vary: Accept-Language:
  Use URL-based language routing:
    /en/products   → English (cached separately naturally)
    /fr/products   → French (separate URL = separate cache entry)
```

---

## 7. CDN Cache Miss Ratio and Efficiency

```
Cache Hit Ratio = cache_hits / total_requests × 100%

Target:
  Static assets (JS/CSS/images): > 95% hit ratio
  Dynamic API responses:          30-60% hit ratio (depends on TTL)
  
Factors that hurt CDN hit ratio:
  1. Too many unique URLs (e.g., query string ?timestamp=...)
     → CDN treats each as different resource → never reuses
  2. Short TTLs → frequent origin fetches
  3. Low traffic volume → cold cache (each PoP needs its own warm-up)
  4. Vary: User-Agent → fragments cache too granularly

Netflix CDN strategy:
  Goal: 0 origin requests for video chunks (all served from CDN)
  TTL: video chunks = 24 hours
  Hit ratio: > 99% for popular content
  Architecture: Netflix builds its own CDN (Open Connect)
    Partners with ISPs to place CDN appliances INSIDE ISP data centers
    User's request: ISP-level CDN (< 1ms RTT) → even faster than commercial CDN
    
Shopify CDN metrics:
  90% of storefront requests served by CDN (no origin hit)
  Only checkout and cart bypass CDN (dynamic user-specific)
```

---

## 8. Dynamic Content Caching

```
CDNs don't only cache static files — edge computing enables dynamic caching

Cloudflare Workers (Edge Computing):
  Run JavaScript at CDN edge before request reaches origin
  
  Use case: personalized homepage (dynamic but partially cacheable)
  
  Strategy:
    1. Fetch user session at edge (cookie check)
    2. Fetch shared content from CDN cache (cache hit)
    3. Merge: shared_content + user-specific_data
    4. Return personalized page without hitting origin server
    
  Before Workers: personalized = always origin = high latency
  After Workers: personalized = edge computation = low latency

CDN ESI (Edge Side Includes):
  Varnish/Akamai support splitting page into cacheable fragments
  <esi:include src="/nav" /> →  cached at CDN for 1 hour
  <esi:include src="/cart" /> → NOT cached (user-specific)
  → Most of page served from CDN; only cart fragment bypasses
```

---

## 9. Node.js / Express — Setting CDN Cache Headers

```javascript
// Express middleware: cache headers per route type
const cacheMiddleware = {
  // Public, static-ish content — long CDN TTL
  public: (maxAge = 3600, cdnMaxAge = 86400) => (req, res, next) => {
    res.set('Cache-Control', `public, max-age=${maxAge}, s-maxage=${cdnMaxAge}, stale-while-revalidate=3600`);
    next();
  },
  
  // User-specific content — no CDN caching
  private: (maxAge = 60) => (req, res, next) => {
    res.set('Cache-Control', `private, max-age=${maxAge}`);
    next();
  },
  
  // No caching (sensitive data)
  noCache: () => (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }
};

// Product catalog: public + long CDN TTL (prices might change)
app.get('/api/products', cacheMiddleware.public(60, 3600), async (req, res) => {
  const products = await getProducts();
  res.json(products);
  // Browser: fresh 60s, CDN: fresh 1hr
  // After CDN TTL: CDN re-fetches from origin (updates price data)
});

// User profile: private (CDN bypasses)
app.get('/api/user/profile', authenticate, cacheMiddleware.private(120), async (req, res) => {
  const profile = await getUserProfile(req.user.id);
  res.json(profile);
  // CDN does NOT cache (Cache-Control: private)
  // Browser caches for 2 minutes only
});

// Surrogate-Key (cache tags) for targeted CDN purge (Fastly/Varnish)
app.get('/api/products/:id', async (req, res) => {
  res.set('Surrogate-Key', `product:${req.params.id} category:${product.category}`);
  res.set('Cache-Control', 'public, s-maxage=3600');
  res.json(product);
});

// On product update: purge all CDN entries tagged with this product
async function onProductUpdate(productId) {
  await fastly.purgeByTag(`product:${productId}`); // Fastly API
  // All CDN entries for this specific product purged globally in < 150ms
}
```

---

## 10. Real-World Examples

### Shopify — 90% CDN Offload

```
Challenge: millions of storefronts; flash sales = massive traffic spikes
  Without CDN: 50,000 req/sec spike → origin servers die

Solution — CDN-first architecture:
  Product pages:  Cache-Control: public, s-maxage=120 (2 min)
  Images:         Cache-Control: public, max-age=31536000, immutable
  Cart/Checkout:  Cache-Control: private, no-store (bypass CDN)
  
  Result: 90% cache hit ratio
    45,000 of 50,000 req/sec → CDN (no origin hit)
    5,000 req/sec → origin servers (manageable)
    
  Flash sale strategy: pre-warm CDN with product pages
    Before flash sale: trigger CDN warm-up requests from all PoPs
    Flash sale starts: all 300+ PoPs already have the product page cached
```

### AWS CloudFront + API Gateway — Cached Responses

```
Use case: public weather API — same response for all users in same city
  Without CDN: 100,000 req/min to Lambda → 100,000 Lambda invocations → $$$
  
  With CloudFront:
    Cache-Control: public, max-age=300 (5 min)
    CloudFront cache key: URL + city query param  
    
  Result:
    First request per city per PoP: Lambda invoked → response cached
    Next 999,999 requests (5 min window): CloudFront serves from cache
    Lambda invocations reduced by 99.9%
    Latency: 200ms Lambda → 5ms CloudFront edge
```

---

## 11. Interview Cheat Sheet

**Q: What is a CDN and how does CDN caching work?**
> CDN = network of edge servers (PoPs) geographically distributed globally. On first request, edge node fetches content from origin and caches it per Cache-Control TTL. All subsequent requests from nearby users hit the edge cache, not origin. Reduces latency (200ms → 5ms for static assets), reduces origin load, and improves availability (CDN serves during origin outages if stale-ok).

**Q: How do you invalidate CDN caches after a deploy?**
> Best strategy: content-addressed filenames with long TTLs (hash changes URL on deploy). For dynamic content: CDN purge API (CloudFront invalidation, Cloudflare purge, Fastly surrogate-key purge). For gradual rollouts: short s-maxage (60-300s) trades freshness against origin load.

**Q: What is s-maxage vs max-age?**
> `max-age` applies to both browser and CDN. `s-maxage` overrides `max-age` for shared caches (CDN/proxies) only — browser ignores `s-maxage`. Use `s-maxage=86400, max-age=60` to give CDN a 24-hour TTL while browsers recheck every 60 seconds.

**Q: Why is Vary: User-Agent a bad idea on CDN?**
> Creates thousands of cache variants (one per unique user agent string). CDN hit ratio drops dramatically because each variant is almost never reused. Instead, use content negotiation via URL routing or feature detection in JavaScript.

---

## 12. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **CDN** | Content Delivery Network — globally distributed edge servers that cache content near users |
| **PoP** | Point of Presence — single edge node location (e.g., Tokyo PoP, London PoP) |
| **Origin Server** | The primary application server; CDN fetches from here on cache miss |
| **Origin Fetch** | CDN retrieving content from origin server to populate its cache |
| **Cache Hit Ratio** | % of requests served from CDN cache (not origin); target > 95% for static assets |
| **s-maxage** | CDN-specific max-age; overrides max-age for shared caches |
| **Surrogate-Key** | Cache tag mechanism (Fastly/Varnish) enabling group purge of related cache entries |
| **Edge Computing** | Running code at CDN PoP (e.g., Cloudflare Workers) before request reaches origin |
| **GeoDNS** | DNS routes user to nearest PoP based on geographic IP location |
| **CDN Warm-up** | Proactively seeding CDN caches before high-traffic event (flash sales) |
| **Cache Variant** | Separate CDN cache entry per Vary header dimension (language, encoding, etc.) |
| **Open Connect** | Netflix's private CDN — appliances placed inside ISP data centers for ultra-low latency |
