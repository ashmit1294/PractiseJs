# Static Content Hosting Implementation Guide

**Module**: M11 — Cloud Design Patterns  
**Topic**: T33 of 37  
**Difficulty**: Intermediate  
**Read Time**: ~30 min

---

## 1. ELI5 (Explain Like I'm 5)

Imagine your school has one printer that makes copies for everyone. But for your most popular worksheets that never change, you pre-print 1,000 copies and stack them near every classroom door. Students grab what they need instantly instead of waiting in the printer queue. The photocopier (your server) is now free for the actual unique work.

**Static Content Hosting** is those pre-printed stacks: your files (CSS, images, JavaScript, videos) are stored at storage services and served directly from edge locations worldwide — the server never has to run code to serve them.

---

## 2. The Analogy

A **vending machine vs. a restaurant**. A restaurant (traditional web server) has chefs who prepare each order on demand — flexible but expensive and slow during rushes. A vending machine (static hosting) pre-packages everything and serves it instantly with zero wait time. You can't customize your order, but for standardized items (CSS files, product images, JavaScript bundles), the vending machine is 100x cheaper and serves thousands simultaneously.

Just like vending machines can be placed everywhere, your static content gets closer to users automatically through CDN edge locations.

---

## 3. Why This Matters in Interviews

This pattern appears in virtually every system design interview involving web applications, media platforms, or content delivery. Interviewers use it to assess whether you understand the fundamental cost/performance tradeoffs in modern architectures.

**What they're looking for**:
- Proactively suggest offloading static assets from application servers
- Explain CDN integration and cache hit rates
- Discuss cache invalidation strategies (content hashing)
- Calculate cost savings

**Senior candidates** discuss security (signed URLs, CORS, WAF), versioning strategies, and hybrid edge+static approaches. This pattern comes up when discussing Netflix, YouTube, Airbnb, or any high-traffic application.

---

## 4. Core Concept

Static content hosting stores **unchanging resources** (HTML, CSS, JavaScript bundles, images, videos, PDFs) in cloud object storage and serves them directly to clients — without passing through application servers.

The economic and performance implications are profound:
- A typical app server: $50-500/month, handles ~1,000 RPS
- S3: $0.023/GB stored + $0.09/GB transferred, effectively unlimited capacity
- For 10TB of images monthly: traditional hosting ~$5,000 vs S3 + CloudFront ~$900

The pattern works because ~80% of bytes transferred are static assets that change infrequently. By separating concerns architecturally, you optimize each independently: static content gets object storage (durability, scale, cost) + CDN (edge caching, global distribution), while app servers focus on what they're good at.

**The immutability insight**: `app.a3f8d9e2.js` is named by content hash. When code changes, the filename changes. Old URL keeps serving old version forever. New URL serves new version. Cache TTL = 1 year. No invalidation needed.

---

## 5. ASCII Diagrams

### Static Content Request Flow
```
User: GET /app.a3f8d9e2.js
            │
            ▼
         DNS / Route53
            │
            ▼
  ┌──────────────────────┐
  │  CloudFront CDN Edge │  ← Nearest edge location (200+ worldwide)
  │  Tokyo POP           │
  └────────┬─────────────┘
           │ Cache HIT (95%): serve immediately < 10ms
           │ Cache MISS (5%):  fetch from origin
           ▼
  ┌──────────────────────┐
  │  S3 Bucket           │  ← Origin storage, single region OK
  │  us-east-1           │
  └──────────────────────┘

Result: User in Tokyo → 10ms (edge cache hit) vs 300ms (origin roundtrip)
```

### Content-Addressed Versioning
```
Build Process:
  app.js → hash → app.a3f8d9e2.js (immutable, served forever)
  styles.css → hash → styles.7b2c4f1a.css (immutable)
  index.html → references hashed assets (short TTL: 5 min)

Deploy:
  1. Upload new app.b4e9f3a1.js (new hash = new filename)
  2. Upload new index.html (references new hash)
  3. Invalidate only index.html in CloudFront (cheap, fast)
  4. Old browsers still serving from old hash — no breakage

Cache headers:
  app.a3f8d9e2.js    → Cache-Control: public, max-age=31536000, immutable
  index.html          → Cache-Control: public, max-age=300
```

### Cache TTL Impact on Cost
```
Strategy         Cache Hit Rate   Origin Transfer   Monthly Cost
──────────────────────────────────────────────────────────────────
Long TTL (1yr)   98%             200 GB (2% miss)  $850
Hybrid (best)    96%             400 GB             $900  ← recommended
Short TTL (5min) 85%             1.5 TB (15% miss) $1,350

Metric: 10TB monthly traffic, CloudFront pricing $0.085/GB
```

---

## 6. How It Works — Step by Step

**Step 1: Choose Object Storage**  
Upload assets to S3 (AWS), Azure Blob Storage, or GCS. Enable static website hosting. Configure `index.html` as index document, error document for 404s. Set CORS policies for cross-origin requests. Set bucket policies for public read access (or signed URLs for private content).

**Step 2: Place CDN in Front**  
Create a CloudFront distribution with the S3 bucket as origin. Set up custom domain, SSL certificate via ACM. Configure cache behaviors: long TTLs for hashed assets, short TTLs for HTML. Now `https://assets.company.com/app.a3f8d9e2.js` resolves to nearest edge.

**Step 3: Implement Content-Addressed Naming**  
Configure build tool (Webpack/Vite) to generate content hashes in asset filenames. `app.js` → `app.a3f8d9e2.js`. Enables 1-year TTLs with instant updates on new deploys.

**Step 4: Invalidation Strategy on Deploy**  
CI/CD pipeline: build → upload hashed assets → update `index.html` referencing new hashes → invalidate only `index.html` path in CloudFront. Total invalidation cost: ~$0.005 per path.

**Step 5: Optimize Delivery**  
Enable gzip/brotli compression at CDN level (reduces text assets 70-90%). Use WebP/AVIF image formats with JPEG fallbacks. Implement responsive images with `srcset`. Set HTTP/2 at CDN for multiplexing.

**Step 6: Monitor and Optimize Costs**  
Track S3 storage, request, and data transfer costs. A 5% improvement in cache hit rate halves origin transfer costs. Apply S3 lifecycle policies: standard (0-90 days) → infrequent access → Glacier.

---

## 7. Variants / Types

### 1. Pure Static Hosting (S3 Website)
S3 bucket directly with static website hosting. No CDN.  
**Pros**: Zero config complexity, pennies per month  
**Cons**: No HTTPS, no custom domain, no edge caching, single region  
**Use**: Prototypes, internal tools, documentation for small teams

### 2. CDN-Fronted Static Hosting (CloudFront + S3)
Production standard. CDN provides TLS, custom domain, 200+ edge locations, DDoS protection.  
**Pros**: Sub-10ms latency globally, 95%+ cache hit rates, HTTPS, DDoS protection  
**Cons**: CDN configuration complexity, cache invalidation handling  
**Use**: Any production application — this is the default choice for 90% of cases

### 3. Static Site Generation (SSG)
Build tool (Next.js, Gatsby) pre-renders dynamic-looking content at build time into static HTML.  
**Pros**: SEO-friendly, personalization via APIs, fast performance, simple deployment  
**Cons**: Build time grows with content; updates require rebuild; not real-time  
**Use**: Documentation, blogs, marketing sites, Jamstack apps  
**Example**: Stripe's documentation — Next.js SSG for thousands of API reference pages

### 4. Hybrid Static + Serverless Edge
Static HTML/CSS/JS cached aggressively + edge functions (Lambda@Edge, Cloudflare Workers) for personalization/auth.  
**Pros**: Static performance where possible, dynamic logic where needed, all at the edge  
**Cons**: Cold starts, complex debugging, cost monitoring needed  
**Example**: New York Times — static HTML articles at edge, edge functions inject paywalls and personalized recommendations

### 5. Multi-CDN
Multiple CDN providers (CloudFront, Cloudflare, Fastly) with DNS-based intelligent routing.  
**Pros**: Redundancy, optimize per-region performance, negotiating leverage  
**Cons**: Multiple configs, multiple cache invalidations, operational complexity  
**Use**: $50K+/month CDN spend; regions where one provider significantly underperforms; mission-critical uptime

---

## 8. Trade-offs

### Cache TTL Duration

| | Long TTL (1 year) | Short TTL (5 min) |
|---|---|---|
| **Cache hit rate** | 98% | 85% |
| **Update latency** | Instant (new filename) | 5 min from deploy |
| **Cache invalidation cost** | ~$0 (new filename) | $0.005/path × frequency |
| **Best for** | Versioned assets (hashed filenames) | HTML, HTML-only files |

**Hybrid strategy**: Long TTLs for all hashed JS/CSS/images, short TTLs for `index.html`. This is standard practice at Stripe, Airbnb, Netflix.

### Public vs. Private Content (Signed URLs)

| | Public | Private (Signed URLs) |
|---|---|---|
| **Cache hit rate** | Up to 100% (same URL shared) | Lower (unique URL per user) |
| **Security** | Anyone with URL can access | Time-limited, cryptographically signed |
| **Latency** | None | Extra API call to generate URL |
| **Use** | Marketing assets, docs, open media | User uploads, premium content, invoices |

**Signed URL tip**: Use longer expiration (hours) for better CDN cache hit rates. Multiple requests from same user during the valid window all hit edge cache.

### CDN: Single vs. Multi

Start single CDN. Evaluate multi-CDN only when: $50K+/month CDN costs, serving users in regions where one provider significantly underperforms, or when CDN downtime cost exceeds operational overhead. Most companies never need multi-CDN.

---

## 9. When to Use / When to Avoid

### ✅ Use When
- 80%+ of your bytes transferred are static files (CSS, JS, images)
- Global user base needing low latency worldwide
- High traffic causing application server CPU bottleneck on file serving
- Static assets are versioned and don't change frequently

### ❌ Avoid When
- Content is truly dynamic, personalized per-user at the HTML level (use SSR then)
- Content is real-time (live scores, stock tickers) — use WebSockets/SSE
- Assets need strict access control for every request (e.g., HIPAA PHI) without signed URL support

---

## 10. MERN Dev Notes

### S3 + CloudFront Setup with Node.js Deployment

```javascript
// deploy/upload-assets.js
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const { createReadStream, statSync, readdirSync } = require('fs');
const path = require('path');
const crypto = require('crypto');
const mime = require('mime-types');

const s3 = new S3Client({ region: process.env.AWS_REGION });
const cf = new CloudFrontClient({ region: 'us-east-1' });

const BUCKET = process.env.S3_BUCKET;
const DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID;
const BUILD_DIR = './dist';

// Determine cache headers based on filename pattern
function getCacheControl(filename) {
  // Hashed assets — immutable, 1 year
  if (/\.[a-f0-9]{8,}\.(js|css|png|jpg|webp|woff2)$/.test(filename)) {
    return 'public, max-age=31536000, immutable';
  }
  // HTML — short TTL for quick updates
  if (filename.endsWith('.html')) {
    return 'public, max-age=300, must-revalidate';
  }
  // Other static assets — 1 hour
  return 'public, max-age=3600';
}

async function uploadFile(localPath, s3Key) {
  const contentType = mime.lookup(s3Key) || 'application/octet-stream';
  const cacheControl = getCacheControl(s3Key);
  const fileSize = statSync(localPath).size;
  
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: createReadStream(localPath),
    ContentType: contentType,
    CacheControl: cacheControl,
    // Security headers via metadata
    Metadata: {
      'x-deploy-time': new Date().toISOString()
    }
  }));
  
  console.log(`Uploaded: ${s3Key} [${contentType}, ${cacheControl}]`);
}

async function deploy() {
  // Walk build directory and upload all files
  function walkDir(dir, prefix = '') {
    const items = readdirSync(dir, { withFileTypes: true });
    const uploads = [];
    
    for (const item of items) {
      const localPath = path.join(dir, item.name);
      const s3Key = prefix ? `${prefix}/${item.name}` : item.name;
      
      if (item.isDirectory()) {
        uploads.push(...walkDir(localPath, s3Key));
      } else {
        uploads.push({ localPath, s3Key });
      }
    }
    return uploads;
  }
  
  const files = walkDir(BUILD_DIR);
  console.log(`Uploading ${files.length} files...`);
  
  // Upload in batches of 10 (S3 rate limit)
  for (let i = 0; i < files.length; i += 10) {
    const batch = files.slice(i, i + 10);
    await Promise.all(batch.map(f => uploadFile(f.localPath, f.s3Key)));
  }
  
  // Invalidate only HTML files (hashed assets don't need invalidation)
  const htmlFiles = files
    .filter(f => f.s3Key.endsWith('.html'))
    .map(f => `/${f.s3Key}`);
  
  if (htmlFiles.length > 0) {
    await cf.send(new CreateInvalidationCommand({
      DistributionId: DISTRIBUTION_ID,
      InvalidationBatch: {
        CallerReference: Date.now().toString(),
        Paths: { Quantity: htmlFiles.length, Items: htmlFiles }
      }
    }));
    console.log(`Invalidated ${htmlFiles.length} HTML files in CloudFront`);
  }
  
  console.log('Deployment complete!');
}

deploy().catch(console.error);
```

### Signed URL Generation for Private Content

```javascript
// api/signed-url.js
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({ region: process.env.AWS_REGION });

async function generateSignedUrl(s3Key, expiresInSeconds = 3600) {
  const command = new GetObjectCommand({
    Bucket: process.env.PRIVATE_S3_BUCKET,
    Key: s3Key
  });
  
  // URL valid for 1 hour — balance between security and CDN cache hit rate
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

// Express endpoint
app.get('/api/files/:fileId/download', authenticate, async (req, res) => {
  const file = await File.findById(req.params.fileId);
  
  if (!file) return res.status(404).json({ error: 'Not found' });
  if (file.userId.toString() !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const signedUrl = await generateSignedUrl(file.s3Key, 3600);
  
  // Return URL for client to fetch directly from S3/CDN — no bandwidth through our servers
  res.json({
    url: signedUrl,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
  });
});
```

---

## 11. Real-World Examples

### Netflix: 250M+ Hours of Video Daily via CDN
Netflix serves video entirely through CDN edge caches pulling from S3-equivalent object storage. Application servers handle API requests, authentication, recommendations — zero video bytes flow through app servers.

**Key detail**: Netflix uses server-pushed HTTP/2 for critical assets, pre-warming edge caches for new releases (push assets to all POPs before launch day), automatic tiering: new releases get standard storage, older content automatically moves to cheaper tiers. Their OpenConnect CDN (Netflix's own) is embedded directly in ISP networks — eliminates the final network hop entirely. Result: 95%+ cache hit rate, sub-second video startup globally.

### Airbnb: Dynamic Image Variant Generation at the Edge
Airbnb hosts millions of property photos. Original images uploaded to S3, then Lambda functions generate multiple variants (thumbnails, mobile, desktop, fullsize) in WebP and JPEG formats. CloudFront serves from 200+ edge locations.

**Key detail**: Airbnb uses CloudFront origin request policies for **on-demand variant generation** — if a new size is requested (new device resolution), Lambda@Edge intercepts the cache miss, generates the variant from the S3 original, caches it at the edge, serves it transparently. This reduced pre-generation storage costs by 60% while maintaining performance.

### Stripe: Documentation with Hashed Assets + Edge Injection
Stripe's developer docs use Next.js SSG — thousands of API reference pages pre-rendered at build time, deployed to S3, CloudFront caches with 1-hour TTLs for HTML and 1-year for hashed JS/CSS.

**Key detail**: Stripe uses **edge workers to inject personalized content** (user's own API keys in code examples, account-specific dashboard links) into the statically cached HTML at the edge layer — without hitting origin servers. The base HTML is shared, personalization is injected per-user in < 1ms. Stripe uses 1-year TTLs on all JS/CSS bundles (hashed names), 5-minute TTLs on HTML — allowing instant updates to which bundles are loaded without invalidating the expensive-to-cache assets.

---

## 12. Interview Cheat Sheet

### The 30-Second Answer
> "Static content hosting stores unchanging assets in object storage (S3, Azure Blob, GCS) and serves them through CDN edge locations. S3 can cost $0.023/GB stored vs $500/month for an equivalent app server. CDN cache hit rates of 95%+ mean most requests never reach origin. Key pattern: use content-addressed filenames (content hash in filename) for 1-year cache TTLs with instant updates — when code changes, the filename changes, so browsers and CDNs automatically fetch the new version."

### Cost Calculation
```
Monthly transfer: 10 TB
Without CDN:      10,000 GB × $0.09 = $900 + server costs
With CloudFront:  10,000 GB × 0.05 (5% miss) × $0.085 = $42.50 origin transfer
                  + 10,000 GB × 0.85 CDN = $850 CDN transfer
Total with CDN:   ~$892 — comparable, but CDN adds global performance + DDoS protection

Break-even: ~1 TB/month. Above that, CDN often cheaper AND faster.
```

### Cache Strategy Quick Reference
```
Hashed assets (app.abc123.js)  → max-age=31536000, immutable  (never invalidate)
HTML files (index.html)         → max-age=300                  (invalidate on deploy)
API responses                   → no-cache (always fresh)
Images with stable URLs         → max-age=86400                (1 day)
```

### Key Interview Questions

**Q: How do you handle cache invalidation for a new deploy?**  
Use content hashing for all JS/CSS/images → filename changes on content change → cache miss naturally → 1-year TTL, no invalidation needed. HTML files reference versioned assets and have 5-minute TTL — or use explicit CloudFront invalidation on `index.html` only ($0.005/path). Cost: near zero, time: < 60 seconds for HTML propagation.

**Q: How do you design static hosting for a global e-commerce site with 100TB/month images?**  
S3 origin → CloudFront 200+ edges. On upload: Lambda generates variants (thumbnail, mobile, desktop, WebP+JPEG). Content hash in path. Lifecycle: standard → infrequent access at 90 days → Glacier at 1 year. Target 95%+ cache hit rate. Improve from 90% → 95%: halves origin transfer costs. Signed URLs for user-uploaded content (1-hour expiry for cache effectiveness). Monitor cache hit rate; alert if drops below 93%.

### Red Flags to Avoid

| Red Flag | Why Wrong | Say Instead |
|----------|-----------|-------------|
| "Store images in MongoDB/PostgreSQL" | Adds unnecessary load to DB, much more expensive | "Store in S3/object storage, serve via CDN — that's what object storage is for" |
| "Invalidate all cached files on every deploy" | Expensive ($0.005/path × 1000s of files), creates mixed-version state | "Content-hash filenames eliminate the need for invalidation. Only HTML needs invalidation" |
| "CDNs are too expensive" | CDN transfer ($0.085/GB) vs direct S3 ($0.09/GB) — comparable cost, CDN adds global performance | "CDNs break even at ~1TB/month and provide global performance, DDoS protection, reduced origin load" |
| "Static hosting is only for simple websites" | Netflix serves 250M+ hours of video this way | "Static hosting works for any application where UI can be decoupled from data. SPA + static hosting + API is a best-practice architecture" |

### Keywords / Glossary

| Term | Definition |
|------|------------|
| **Object storage** | Cloud key-value file storage (S3, Azure Blob, GCS) — cheap, durable, scalable |
| **CDN (Content Delivery Network)** | Globally distributed caching layer with 200+ edge locations near users |
| **Cache hit rate** | % of requests served from CDN edge without hitting origin |
| **Content-addressed naming** | Embedding content hash in filename — enables 1-year TTL without risk of stale content |
| **Cache invalidation** | Signal to CDN to discard cached version and re-fetch from origin |
| **Cache-Control headers** | HTTP headers controlling how long browsers and CDNs cache responses |
| **Signed URL** | Time-limited, cryptographically signed URL granting temporary access to private content |
| **CORS** | Cross-Origin Resource Sharing — HTTP headers allowing browsers to fetch resources cross-domain |
| **Origin** | The authoritative source (S3 bucket) that CDN fetches from on cache miss |
| **Edge location (POP)** | CDN data center geographically close to users |
| **SSG (Static Site Generation)** | Pre-rendering dynamic content to static HTML at build time |
