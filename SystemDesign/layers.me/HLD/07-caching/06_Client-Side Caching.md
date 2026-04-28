# T06 — Client-Side Caching

---

## 1. ELI5

Your browser is a mini hard drive. Every time you visit a website, your browser saves copies of images, CSS files, and JavaScript files locally. Next time you visit, instead of downloading those files again from the internet, your browser uses the saved copy. It's like keeping a photocopy of a textbook at home rather than going to the library every time you need to look something up.

The website tells your browser: "This logo doesn't change for 1 year — save it locally. This news feed changes every minute — always check for updates."

---

## 2. Analogy

**Library book "hold" system:**

When you borrow a book from a library (website), you get a stamped due date on the return card (TTL / `max-age`). 

- **Within due date**: you have a valid copy at home. You can re-read it without going to the library. (Browser serves from cache.)
- **Past due date**: you return the book and the librarian checks: "is there a new edition?" If not, they stamp a new due date and you take the same book home again (304 Not Modified). If yes, they give you the new edition (200 OK with new content).
- **"Do not lend" sticker** (`no-store`): library never lets you take this book home — sensitive document, must read in-library only. (Never cached.)

---

## 3. Core Concept: HTTP Caching Headers

### Cache-Control Header (Primary Control)

```
Directive          │ Meaning
─────────────────────────────────────────────────────────────────────
max-age=3600       │ Cache this response for 3600 seconds (1 hour)
                   │ After 1 hour: browser must revalidate with server
s-maxage=86400     │ Like max-age but for shared caches (CDN/proxy only)
                   │ Overrides max-age for CDNs
no-cache           │ Must revalidate BEFORE using — still caches, but
                   │ always asks server "is this still valid?" (conditional GET)
no-store           │ NEVER cache this response anywhere
                   │ Use for: passwords, banking data, secrets
public             │ Can be cached by browser AND shared caches (CDNs)
private            │ Only browser can cache — CDN/proxy must not
                   │ Use for: user-specific data (profile page, cart)
immutable          │ Content will NEVER change during max-age period
                   │ Browser won't revalidate even on page reload
must-revalidate    │ Must check with server after max-age expires
                   │ (never serve stale, even if server unreachable)
stale-while-       │ Serve stale while background revalidation runs
  revalidate=60    │ User gets instant response; fresh version arrives next req
```

### ETag and Conditional Requests (Revalidation)

```
Initial request:
  GET /api/products/123
  ← 200 OK
  ← ETag: "abc123def456"      (fingerprint of response)
  ← Cache-Control: max-age=300

After 300 seconds (cache expired):
  GET /api/products/123
  → If-None-Match: "abc123def456"    (browser sends back the ETag)
  
  Server checks: has product 123 changed since ETag "abc123def456"?
  
  If NOT changed:
  ← 304 Not Modified   (no body — saves bandwidth!)
  ← ETag: "abc123def456"
  Browser: use the cached version, reset TTL
  
  If CHANGED:
  ← 200 OK
  ← {new product data...}
  ← ETag: "xyz789ghi"         (new fingerprint)
  Browser: replace cache with new version

Bandwidth saved = response body size (e.g., 50KB product JSON → only 200 bytes for 304)
```

### Last-Modified Header (Older Alternative to ETag)

```
Initial response:
  ← Last-Modified: Wed, 01 Jan 2025 12:00:00 GMT

Revalidation request:
  → If-Modified-Since: Wed, 01 Jan 2025 12:00:00 GMT

Response:
  ← 304 Not Modified (if unchanged)  OR  200 OK (if changed)

ETag is preferred: more precise, handles edge cases (file timestamp changes without content changes)
```

---

## 4. Caching Strategy Per Asset Type

```
┌─────────────────────────────────────────────────────────────────────┐
│ Asset Type       │ Recommended Headers           │ Why              │
├──────────────────┼───────────────────────────────┼──────────────────┤
│ JS/CSS bundles   │ Cache-Control: max-age=31536000│ 1 year — safe   │
│ (hashed names)   │ immutable                     │ because filename │
│ e.g. app.a3f.js  │                               │ changes on update│
├──────────────────┼───────────────────────────────┼──────────────────┤
│ Images/fonts     │ Cache-Control: max-age=604800  │ 1 week — usually│
│ (content hash)   │ immutable                     │ don't change     │
├──────────────────┼───────────────────────────────┼──────────────────┤
│ HTML             │ Cache-Control: no-cache        │ Always check for │
│ (index.html)     │                               │ new JS/CSS refs  │
├──────────────────┼───────────────────────────────┼──────────────────┤
│ API responses    │ Cache-Control: private,        │ User-specific,  │
│ (user data)      │ max-age=60                    │ short TTL        │
├──────────────────┼───────────────────────────────┼──────────────────┤
│ Public API       │ Cache-Control: public,         │ Same for all    │
│ (product list)   │ max-age=300, s-maxage=3600    │ users; CDN too  │
├──────────────────┼───────────────────────────────┼──────────────────┤
│ Sensitive data   │ Cache-Control: no-store,       │ Never cache:    │
│ (bank balance,   │ Pragma: no-cache              │ security risk   │
│  passwords)      │                               │                 │
└──────────────────┴───────────────────────────────┴─────────────────┘
```

---

## 5. Content-Addressed Caching (Cache Busting)

```
Problem: max-age=1year means browser won't check for updates for 1 year
         But you deploy a new JavaScript version tomorrow!
         
         Old way (bad): add query string ?v=2 → browsers may not cache based on query strings
         Also bad: change filename to app_v2.js → need to update HTML reference

Modern solution — Content Hashing (Webpack / Vite):
  Build generates: app.[contenthash].js
  
  v1: app.a3f9c2.js → cached for 1 year → safe
  v2: app.b7e1d4.js → new filename → browser never saw it → fresh download
      (old file app.a3f9c2.js remains in browser cache, but index.html
       now references app.b7e1d4.js so it's never used)

Result:
  ✅ Perfect caching: assets never expire (immutable)
  ✅ Instant updates: new filename = new resource = instant re-download
  ✅ No cache busting needed — content hash IS the version
  
Vite config:
  build: { rollupOptions: { output: { entryFileNames: 'assets/[name].[hash].js' } } }
  
Combined headers:
  Cache-Control: max-age=31536000, immutable, public
```

---

## 6. Service Worker Cache (Offline Caching)

```
Service workers intercept ALL fetch requests — programmable proxy in browser

┌──────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Page (JavaScript)                                           │ │
│  │   fetch('/api/user') ──────────────────────────────────────►│ │
│  └─────────────────────────┬───────────────────────────────────┘ │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐ │
│  │ Service Worker (sw.js)                                      │ │
│  │ Intercepts every fetch → decides: cache or network?         │ │
│  │                                                             │ │
│  │ Strategies:                                                 │ │
│  │  Cache-First: check cache → if miss, fetch network         │ │
│  │  Network-First: fetch network → if fail, fallback to cache │ │
│  │  Stale-While-Revalidate: return cache + update in bg       │ │
│  │  Cache-Only: offline only                                  │ │
│  └──────────┬──────────────────────────────────────────────────┘ │
│             │                                                    │
└─────────────│────────────────────────────────────────────────────┘
              │
              ▼
         Network / API Server
```

### Stale-While-Revalidate (Service Worker Strategy)

```javascript
// sw.js — Stale-While-Revalidate for API responses
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open('api-cache-v1');
  const cachedResponse = await cache.match(request);
  
  // Start network fetch in parallel (regardless of cache hit)
  const networkFetch = fetch(request).then((networkResponse) => {
    cache.put(request, networkResponse.clone()); // update cache in background
    return networkResponse;
  }).catch(() => null);
  
  // Return cached version immediately if available (no latency)
  // Background fetch updates cache for NEXT request
  return cachedResponse || networkFetch;
}
```

---

## 7. Client-Side Caching Limitations

```
1. No server-push invalidations
   - Browser is fully in control of its cache
   - Server CANNOT tell browser "delete this cached version NOW"
   - Only options: let TTL expire, or change URL (new filename/hash)
   
2. Cache varies by user
   - 1 million users = 1 million separate browser caches
   - Cannot selectively invalidate "all users' cache for product 123"
   - Must use short TTL or URL versioning
   
3. Private data must not be cached by CDN
   - Cache-Control: private → browser only, not CDN nodes
   - Vary: Authorization → CDN won't cache (prevents leaking private data across users)
   
4. HTTPS responses still cached
   - Cache-Control: no-store is the ONLY way to prevent caching sensitive data
   - HTTPS alone doesn't prevent caching
   
5. Browser cache limits
   - Chrome: ~80% of remaining disk space (capped)
   - Evicts LRU when storage fills
   - Cannot guarantee data is still cached when user returns
```

---

## 8. Next.js / React Caching Implementation

```javascript
// Next.js API Route — proper caching headers
export default async function handler(req, res) {
  const products = await getPublicProducts();
  
  // Public API: cache in browser (60s) + CDN (10 min)
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=600, stale-while-revalidate=120');
  res.json(products);
}

// Next.js fetch with built-in caching (App Router)
async function getProducts() {
  const res = await fetch('https://api.example.com/products', {
    next: { revalidate: 300 }  // ISR: revalidate every 5 minutes
  });
  return res.json();
}

// For user-specific data — private, short TTL
export async function getUser(req, res) {
  const user = await getCurrentUser(req);
  res.setHeader('Cache-Control', 'private, max-age=60, no-store');
  res.json(user);
}

// Express.js — static assets with long TTL + ETag support
app.use('/static', express.static('public', {
  maxAge: '1y',           // max-age=31536000
  etag: true,             // generate ETags for conditional requests
  lastModified: true,
  immutable: true         // Cache-Control: immutable (don't revalidate until max-age expires)
}));
```

---

## 9. Real-World Examples

### Shopify — Static Asset CDN Caching

```
All theme assets (CSS, JS, images) served via Shopify's CDN
  Cache-Control: public, max-age=31536000, immutable
  URL: cdn.shopify.com/s/files/1/0001/theme.a3f9c2.css
  
Content hash in filename:
  On each theme save: new hash generated → new CDN URL
  Previous URL still cached (harmless — unused)
  
Result:
  99.9% cache hit ratio on CDN
  Shop loads in < 1s on repeat visits (all assets from browser cache)
  New theme changes appear instantly (new hash = new URL)
```

### Gmail — API Response Caching

```
Gmail uses Service Worker (Workbox):
  Email list: stale-while-revalidate
    → Opens instantly showing last known inbox
    → Background fetch updates with new emails
    → New email badge appears 2-3 seconds later
    
  Email body: cache-first (emails don't change after sent)
    → Previously opened email: instant load from cache
    → Never re-fetches from server (immutable content)
    
  Offline support:
    → Read cached emails with no internet connection
    → Compose queued to outbox (sent when online)
```

---

## 10. Interview Cheat Sheet

**Q: What is Cache-Control: no-cache vs no-store?**
> `no-cache`: cached locally, but must revalidate with server before use (sends conditional GET). `no-store`: never stored anywhere — not browser, not CDN. Use `no-store` for passwords, tokens, financial data. Use `no-cache` for frequently-changing content where you want conditional validation (304 optimization).

**Q: How does ETag work?**
> Server sends `ETag: "abc123"` fingerprint with response. Browser caches the response + ETag. After max-age expires, browser resends `If-None-Match: "abc123"`. If content unchanged → server returns 304 Not Modified (no body) → browser uses cached version. Saves bandwidth while ensuring freshness.

**Q: How do you invalidate browser caches on deploy?**
> Use content-addressed filenames: build tools (Webpack/Vite) append content hash to filename (`app.[hash].js`). New deploy = new hash = new URL = browsers download immediately. HTML can use `no-cache` so it always gets latest JS/CSS references. Old hashed assets can be cached for 1 year since they're immutable.

**Q: What can Service Workers do that HTTP headers can't?**
> Programmable caching strategy: cache-first, network-first, stale-while-revalidate. Offline mode: serve cached content with no internet. Background sync: queue writes until connectivity is restored. Push notifications. HTTP headers only express INTENTIONS; Service Workers actively intercept and respond to requests.

---

## 11. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Cache-Control** | HTTP header controlling caching behavior for browsers and CDNs |
| **max-age** | Seconds the response is considered fresh — browser serves from cache during this period |
| **s-maxage** | Like max-age but for shared caches (CDNs/proxies) only |
| **no-store** | Never cache — most strict; use for sensitive data |
| **no-cache** | Cache but always revalidate before use; not "don't cache" |
| **immutable** | Content won't change during max-age; browser won't revalidate even on reload |
| **ETag** | Entity tag — server-generated fingerprint of response content, used for conditional requests |
| **304 Not Modified** | Server response meaning "use your cached version" — no body, saves bandwidth |
| **Content Hash** | MD5/SHA of file content appended to filename; changes on file change → cache bust |
| **Service Worker** | Browser-side JavaScript proxy that intercepts network requests; enables offline caching |
| **stale-while-revalidate** | Return stale cache immediately; update cache in background for next request |
| **Cache Busting** | Technique forcing browsers to download new version (URL change, query string, content hash) |
| **Vary** | HTTP header telling CDN to cache separate versions per specified request field (e.g., Accept-Language) |
