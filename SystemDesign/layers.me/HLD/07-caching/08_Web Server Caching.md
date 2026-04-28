# T08 — Web Server Caching

---

## 1. ELI5

Imagine a busy restaurant with a chef (your Node.js app) and a waiter (Nginx) at the front. Every time a customer asks "What's today's special?", the waiter previously ran to the kitchen, the chef cooked the answer, and the waiter ran back.

Then someone put up a **whiteboard at the front desk**: the waiter writes "Today's special: Salmon" on it. For the next hour, whenever someone asks, the waiter reads the whiteboard — the chef never gets disturbed. After an hour, the waiter erases it and asks the chef again.

**Web server cache = the whiteboard in front of the kitchen.** Nginx or Varnish caches full HTTP responses between the internet and your application servers.

---

## 2. Analogy

**Hotel concierge with a notebook:**

A hotel concierge (Nginx/Varnish) handles guest questions. "What time does the gym open?" — They look it up the first time and write it in their notebook. For the next 8 hours, anyone asking gets the answer from the notebook, not from calling the gym manager (your app server).

If the gym changes hours, the manager tells the concierge: "Cross that out" (cache purge). The concierge scratches the old answer and re-calls the gym next time someone asks.

---

## 3. Core Concept

### Position in the Stack

```
Without web server cache:

  Internet → [Load Balancer] → [Nginx] → [Node.js app] → [Redis] → [DB]
                                                ▲ Every request
                                                hits the app

With Nginx proxy_cache:

  Internet → [Load Balancer] → [Nginx proxy_cache] ──────(cache HIT)──→ Response
                                        │
                               (cache MISS only)
                                        ▼
                               [Node.js app] → [Redis] → [DB]
                               
  Node.js app CPU load: reduced 60-90% for cacheable routes
  Response time: 5-50ms (from Nginx cache) vs 50-500ms (through app)
```

### Common Web Server Cache Tools

```
┌──────────────────┬──────────────────────────────────────────────────┐
│ Tool             │ Characteristics                                  │
├──────────────────┼──────────────────────────────────────────────────┤
│ Nginx            │ Built-in proxy_cache module                      │
│ proxy_cache      │ Disk + memory cache                              │
│                  │ Cache key = URL + selected headers               │
│                  │ Configured in nginx.conf                         │
│                  │ Most widely deployed web server (~35% market)    │
├──────────────────┼──────────────────────────────────────────────────┤
│ Varnish Cache    │ Specialized HTTP reverse proxy cache              │
│                  │ 100% in-memory (no disk — ultra-fast)            │
│                  │ VCL (Varnish Configuration Language) — very      │
│                  │ flexible (custom logic, rewrite, ACL)            │
│                  │ BAN mechanism for powerful cache invalidation    │
│                  │ Powers: Wikipedia, Drupal, large-scale sites     │
├──────────────────┼──────────────────────────────────────────────────┤
│ Apache mod_cache │ Similar to nginx proxy_cache                     │
│                  │ Less commonly used today                         │
├──────────────────┼──────────────────────────────────────────────────┤
│ HAProxy cache    │ Basic HTTP caching in load balancer              │
│                  │ Suitable for simple use cases                    │
└──────────────────┴──────────────────────────────────────────────────┘
```

---

## 4. Nginx `proxy_cache` Configuration

```nginx
# /etc/nginx/nginx.conf

# Define cache zone: 
#   path = /var/cache/nginx       (disk storage)
#   levels=1:2                    (directory structure: 2-level hash)
#   keys_zone=api_cache:10m       (zone name + 10MB for keys in memory)
#   max_size=10g                  (total disk cache size: 10GB)
#   inactive=60m                  (purge entries not accessed in 60 min)
#   use_temp_path=off             (write directly to cache path — faster)
proxy_cache_path /var/cache/nginx 
    levels=1:2 
    keys_zone=api_cache:10m 
    max_size=10g 
    inactive=60m 
    use_temp_path=off;

server {
    listen 80;
    server_name api.example.com;
    
    location /api/products {
        proxy_pass http://nodejs_app;
        
        # Enable caching for this route
        proxy_cache            api_cache;
        proxy_cache_valid      200 10m;    # Cache 200 responses for 10 min
        proxy_cache_valid      404 1m;     # Cache 404 responses for 1 min
        proxy_cache_use_stale  error timeout updating http_500;  # serve stale if app down
        proxy_cache_lock       on;         # Prevent stampede: only 1 upstream request per key
        proxy_cache_min_uses   2;          # Only cache after 2 requests (filter one-off requests)
        
        # Cache key: URL + Accept header + Accept-Encoding (vary by content type/encoding)
        proxy_cache_key "$scheme$request_method$host$request_uri$http_accept_encoding";
        
        # Add cache status header to response (for debugging)
        add_header X-Cache-Status $upstream_cache_status;
        # Values: HIT, MISS, BYPASS, EXPIRED, REVALIDATED, UPDATING, STALE
    }
    
    # Routes that should NEVER be cached (user-specific or write endpoints)
    location /api/user {
        proxy_pass http://nodejs_app;
        proxy_no_cache 1;       # Don't cache
        proxy_cache_bypass 1;   # Don't serve from cache
    }
    
    location /api/checkout {
        proxy_pass http://nodejs_app;
        proxy_no_cache 1;
        proxy_cache_bypass 1;
    }
    
    upstream nodejs_app {
        server 127.0.0.1:3000;
        server 127.0.0.1:3001;
    }
}
```

### Testing the Cache

```bash
# First request — MISS
curl -I https://api.example.com/api/products
→ X-Cache-Status: MISS

# Second request — HIT
curl -I https://api.example.com/api/products
→ X-Cache-Status: HIT

# After 10 minutes — EXPIRED (re-fetches from app)
→ X-Cache-Status: EXPIRED

# When app server is down — STALE (serves old cache)
→ X-Cache-Status: STALE
```

---

## 5. Varnish Cache

### VCL Configuration (Varnish Configuration Language)

```vcl
# /etc/varnish/default.vcl

# Define backend (your Node.js app)
backend nodejs {
    .host = "127.0.0.1";
    .port = "3000";
    .probe = {          # Health check
        .url = "/health";
        .interval = 5s;
        .timeout = 1s;
        .threshold = 3;
    }
}

# Request processing — decide whether to cache
sub vcl_recv {
    # Never cache POST/PUT/PATCH/DELETE
    if (req.method != "GET" && req.method != "HEAD") {
        return (pass);  # bypass cache
    }
    
    # Never cache user-specific routes
    if (req.url ~ "^/api/user" || req.url ~ "^/api/cart") {
        return (pass);
    }
    
    # Never cache if user has session cookie
    if (req.http.Cookie ~ "session_id=") {
        return (pass);
    }
    
    # Add grace: serve stale while backend fetches new version
    set req.grace = 30s;
    
    return (hash);  // proceed to cache lookup
}

# Backend response processing — decide what to store
sub vcl_backend_response {
    # Products: cache 10 minutes
    if (bereq.url ~ "^/api/products") {
        set beresp.ttl = 10m;
        set beresp.grace = 1h;    # serve stale for 1hr while refreshing
    }
    
    # Public homepage: cache 5 minutes
    if (bereq.url == "/") {
        set beresp.ttl = 5m;
    }
    
    # Remove cookies from cached responses (prevents caching contamination)
    unset beresp.http.Set-Cookie;
}

# Deliver response to user
sub vcl_deliver {
    if (obj.hits > 0) {
        set resp.http.X-Cache = "HIT";
    } else {
        set resp.http.X-Cache = "MISS";
    }
}
```

### Varnish BAN — Powerful Cache Invalidation

```
Varnish BAN invalidates entries matching a VCL condition (not just a specific URL)

# Invalidate all product pages containing "electronics"
varnishadm "ban req.url ~ /products/.*electronics"

# Invalidate by custom tag header
# Response header: X-Cache-Tags: product:123 category:electronics
varnishadm "ban obj.http.X-Cache-Tags ~ product:123"

# From application code via Varnish admin interface
const varnish = require('varnish-admin');
await varnish.ban('obj.http.X-Cache-Tags ~ product:123');
// All cached responses tagged product:123 are invalidated instantly

vs Nginx: must delete specific cache files by key (no regex invalidation without modules)
Varnish BAN: O(1) invalidation of arbitrary sets of cache entries — much more powerful
```

---

## 6. Cache Stampede Prevention

```
Problem: 10,000 req/sec all hit cache MISS simultaneously
         → 10,000 requests go to app → app overloaded

Nginx: proxy_cache_lock on
  First request acquires lock and fetches from upstream
  All other requests WAIT for first to complete
  When first gets response: all waiters receive it
  → Only 1 upstream request per unique cache key

Varnish: grace period
  When entry expires: ONE request fetches fresh from backend
  All other requests during refresh: served STALE (old cached version)
  → Zero waiting, zero stampede
  set beresp.grace = 30s;  // serve stale for 30s during refresh
  
Most effective strategy: serve stale while fetching fresh (grace)
  vs: locking (users wait) or no protection (stampede)
```

---

## 7. Web Server Cache vs Redis Cache

```
┌─────────────────────┬──────────────────────────┬──────────────────────────┐
│ Property            │ Nginx/Varnish (Web Layer) │ Redis (App Layer)        │
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ Position            │ Before app server         │ Between app + DB         │
│ What is cached?     │ Full HTTP responses        │ Data/objects/queries     │
│ Cache key           │ URL + headers             │ Custom key (e.g. user:123│
│ Granularity         │ Per URL                   │ Per data entity          │
│ CPU savings         │ Entire app server skipped │ DB query skipped         │
│ Flexibility         │ URL-based only            │ Any granularity          │
│ Hot miss handling   │ Nginx lock / Varnish grace│ App-level logic          │
│ Invalidation        │ Purge URLs / BAN patterns │ DEL key / TTL expiry     │
│ User-specific data  │ Hard (private URLs needed)│ Easy (key per user)      │
│ Best for            │ Public, URL-cacheable APIs│ Complex queries, objects │
└─────────────────────┴──────────────────────────┴──────────────────────────┘

They complement each other — use BOTH:
  Web cache: catches 80% of public traffic before it touches Node.js
  Redis: handles remaining queries with user-specific data at app level
```

---

## 8. Real-World Examples

### Wikipedia — Varnish at Massive Scale

```
Wikipedia serves 25 billion pageviews/month
  ~80% served by Varnish without touching MediaWiki PHP apps
  
Architecture:
  User → Varnish (edge) → Varnish (second tier) → MediaWiki → MySQL
  
  Page edits: BAN triggered → all cached variants invalidated globally in < 2s
  Cache TTL: 24 hours for stable pages; 10 minutes for actively edited pages
  
  Without Varnish: Wikipedia would need 10× more PHP app servers
  With Varnish: 600M users served by ~50 cache workers + ~100 app workers
```

### Drupal + Varnish — Full-Page Caching for CMS

```
Drupal pattern:
  Authenticated user → bypass Varnish (private content)
  Anonymous user →    Varnish serves full page

  Response headers from Drupal:
    X-Drupal-Cache-Tags: node:123 user:456 block:navigation
    Cache-Control: public, max-age=300
    
  On content update:
    Drupal calls Varnish BAN: obj.http.X-Drupal-Cache-Tags ~ "node:123"
    All pages containing node 123 invalidated across all Varnish nodes
    
  Result: 95%+ Varnish hit rate on anonymous traffic
  Server handles only logged-in users and cache misses
```

---

## 9. Interview Cheat Sheet

**Q: What is web server caching (e.g., Nginx proxy_cache)?**
> Nginx/Varnish sits between the internet and your app servers. It caches full HTTP responses (HTML/JSON) keyed by URL + headers. On cache hit, the response is returned without touching your Node.js/Python app at all — saving CPU and reducing latency from 200ms to 5ms. Cache miss: request passes through to app, response is stored in cache for future requests.

**Q: Nginx proxy_cache vs Redis — what's the difference?**
> Nginx caches full HTTP responses before they reach your app (URL-level). Redis caches data objects inside your app layer. Nginx saves CPU (app is never invoked on hit). Redis saves DB queries. For high-traffic public APIs, combine both: Nginx for cacheable endpoints, Redis for complex queries behind private endpoints.

**Q: How does Varnish BAN work?**
> Unlike URL-specific cache purging (delete exactly `/products/123`), BAN invalidates all entries matching a VCL boolean expression — e.g., all entries with response header containing `node:123`. This enables powerful tag-based invalidation: update product 123 → BAN all pages that reference product 123 regardless of URL.

**Q: How does Nginx proxy_cache_lock prevent thundering herd?**
> When multiple requests arrive simultaneously for the same expired/missing cache key, only the first request acquires a lock and fetches from the upstream app. All other requests WAIT. When the first completes, all waiters receive the cached response. Prevents N simultaneous identical app requests.

---

## 10. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Reverse Proxy Cache** | Layer sitting between users and origin app servers; caches HTTP responses |
| **proxy_cache** | Nginx module that caches upstream responses to disk + memory |
| **proxy_cache_lock** | Nginx stampede prevention: only 1 upstream fetch per cache key at a time |
| **proxy_cache_use_stale** | Nginx: serve cached (stale) response if upstream is slow/down |
| **Varnish** | Specialized in-memory HTTP cache with powerful VCL configuration language |
| **VCL** | Varnish Configuration Language — custom logic for cache rules, routing, rewriting |
| **BAN** | Varnish: invalidate all cache entries matching a boolean VCL expression |
| **Grace Period** | Varnish: period after TTL expiry where stale content is served while refresh runs |
| **Cache Key** | Unique identifier for a cache entry (typically URL + selected request headers) |
| **X-Cache-Status** | Response header showing HIT/MISS/BYPASS — useful for CDN/proxy cache debugging |
| **Surrogate Key** | Response header tags enabling group invalidation (Fastly/Varnish) — same as cache tags |
| **Full-Page Caching** | Caching entire rendered pages at proxy layer (e.g., Varnish for Drupal/WordPress) |
