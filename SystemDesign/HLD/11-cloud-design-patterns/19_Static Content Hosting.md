# T19 — Static Content Hosting Pattern: CDN & Blob Storage

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/static-content-hosting

---

## ELI5 (Explain Like I'm 5)

Imagine a restaurant. Every time you want a glass of water, the chef comes out, fills a glass, and brings it to you personally. That's expensive and slow. Now imagine a self-serve water station with pre-filled cups near the door. You grab your water in 2 seconds without involving any chef.

Serving static files (images, JavaScript, CSS) through your application server is the chef model. Static content hosting is the water station — files served directly from fast object storage and CDN without touching your application servers at all.

---

## Analogy

**A vending machine vs a restaurant**: A restaurant needs staff, a kitchen, and utilities to serve every item — even sealed snacks. A vending machine requires no staff, runs 24/7, and can serve thousands simultaneously at near-zero marginal cost. Don't hire a chef to hand you a sealed water bottle. Don't spin up an EC2 instance to serve a JPEG that never changes.

---

## Core Concept

Static Content Hosting stores **unchanging files** (HTML, CSS, JavaScript, images, videos, fonts, PDFs) in **object storage** (S3, Azure Blob, GCS) and serves them through a **CDN** — completely bypassing application servers.

**Economics**: Serving 1TB/month through application servers costs $500–$2,000 (EC2 instances + bandwidth). The same 1TB from S3 + CloudFront costs ~$90–$950. At 10TB/month, the difference is $10K vs $8.5K — with zero server management overhead and infinite automatic scaling.

**Why it works**: HTML, CSS, JavaScript bundles, images — none of these change per-request. They're identical for every user. There's no reason for your application server to handle them. CDN edge locations cache them globally; users get sub-10ms responses from nearby edges instead of 100-200ms round trips to your origin.

---

## ASCII Diagrams

### Traditional vs Static Content Hosting Architecture

```
TRADITIONAL (everything through app server):
  User → App Server → App Server forwards → S3/disk
  → 500MB video upload goes UP through app server → FORWARD to storage
  ❌ App server bandwidth cost (every byte costs CPU + bandwidth)
  ❌ App server becomes bottleneck
  ❌ Cannot auto-scale for file serving
  
STATIC CONTENT HOSTING (bypass app server):
  User → CloudFront CDN Edge → S3 (only on cache miss)
  
  1. Build: Webpack output → main.a3f2b1c.js (content-hashed)
  2. Upload: CI/CD deploys to S3 bucket
  3. CDN: CloudFront caches at 200+ edge locations
  4. User request: CDN edge returns in 5-50ms (vs 100-300ms from origin)
  → 90%+ requests served from CDN edge (never hit S3 at all)
  → 10% cache misses → hit S3, cache response at edge for next request
```

### Content Hashing + Cache Strategy

```
DEPLOYMENT V1: main.a3f2b1c.js
  index.html: Cache-Control: max-age=300 (5 min — short, entry point changes)
  main.a3f2b1c.js: Cache-Control: max-age=31536000, immutable (1 year!)
  
DEPLOYMENT V2 (bug fix):
  index.html: now loads main.f7e9d2a.js (new hash!)
  main.f7e9d2a.js: Cache-Control: max-age=31536000 (new file, new cache)
  main.a3f2b1c.js: still cached (for users mid-session with old page open)
  
RESULT:
  ✅ Users in active sessions: continue using v1 JS (no breakage)
  ✅ New users: get v2 JS immediately (index.html expired, loads new page)
  ✅ No CDN invalidation needed for JS/CSS (new hash = new file)
  ❌ Without content hashing: must invalidate CDN on every deploy (5-15 min)
```

### CDN Cache Flow

```
Request flow for user in Tokyo accessing app hosted in us-east-1 S3:

WITHOUT CDN:
  Tokyo → us-east-1 S3 (180ms RTT × 3 handshakes) = 540ms first byte ❌

WITH CloudFront:
  Tokyo → Tokyo CDN edge (5ms RTT)
    → CDN HIT (90%): serve from edge in 20ms total ✅
    → CDN MISS (10%): edge fetches from S3 (faster internal route), caches, serves ~200ms
    
  Average: 0.9 × 20ms + 0.1 × 200ms = 38ms ← 14× faster than direct S3
```

---

## How It Works (Step by Step)

1. **Build and bundle**: Build tool (Webpack, Vite, Next.js static export) outputs optimized files. Content-hash filenames (`main.a3f2b1c.js`) for all assets except entry points.

2. **Upload to object storage**: CI/CD syncs build output to S3 bucket. Set `Cache-Control` headers:
   - Hashed assets: `max-age=31536000, immutable`
   - `index.html`: `max-age=300` (or `no-cache` for always-fresh)
   - Large media: `max-age=86400` (1 day)

3. **CDN layer**: CloudFront distribution points at S3 as origin. Configure Origin Access Identity (OAI) so S3 bucket is private — only CloudFront can read it. CDN applies security headers (HSTS, CSP), gzip/brotli compression, HTTP/2.

4. **DNS + SSL**: CNAME your domain to CloudFront. SSL/TLS handled by CDN (AWS Certificate Manager). Users connect HTTPS to CDN, CDN fetches from S3 over AWS internal network.

5. **Cache invalidation on deploy**: Upload new build. Only invalidate `index.html` (and any non-hashed files). Hashed JS/CSS don't need invalidation — new hash = new URL = automatic cache-bypass for new users. Old URLs still serve old files for in-flight sessions.

6. **Monitor CDN cache hit rate**: Should be > 90%. Track origin request rates (should be < 10% of total requests). Optimize TTLs if hit rate is low.

---

## Variants

| Variant | How | Use When |
|---------|-----|---------|
| **Public Static Website** | S3 public-read + CloudFront | Public marketing sites, open-source docs |
| **Private with Signed URLs** | Private S3 + app generates signed URLs | User uploads, premium content, authenticated downloads |
| **CDN with Origin Shield** | Extra caching layer between edges and S3 | High-traffic; collapses many edge misses into one S3 request |
| **Edge Compute + Static** | CloudFront Functions / Cloudflare Workers + static files | A/B testing, personalization, JWT validation at edge |
| **Multi-CDN** | Multiple CDN providers with DNS-based routing | Mission-critical apps, CDN redundancy |

---

## Trade-offs

| Dimension | Static Content Hosting | Traditional App Server |
|-----------|---------------------|----------------------|
| **Cost at scale** | ~$90/TB with CDN | $500–$2,000/TB with app servers |
| **Latency** | 5–50ms (from CDN edge) | 100–300ms (from origin) |
| **Scaling** | Infinite (CDN global capacity) | Limited by server count |
| **Server load** | Zero (files bypass app servers) | High (every byte = CPU cycle) |
| **Freshness control** | Managed via TTL + invalidate | Immediate (served per-request) |
| **Per-user dynamic content** | Not possible (static = same for all) | Possible (server-rendered) |

**Edge compute hybrid**: For near-static but slightly personalized content (A/B test variant, geolocation-based banners), deploy edge functions (CloudFront Functions, Cloudflare Workers). Sub-millisecond personalization without origin server involvement.

---

## When to Use (and When Not To)

**Use when:**
- Content is truly static — HTML, CSS, JS, images, videos, PDFs that don't change per user
- You have a SPA (React/Vue/Angular) frontend — compile to static files, serve from S3
- Read:write ratio for files is enormous — files uploaded once, downloaded millions of times
- Global users requiring low latency — CDN edge locations serve from nearby geography

**Avoid when:**
- Content is server-rendered per-user (personalized HTML, authenticated dynamic content) — need SSR
- Files require server-side processing on download (real-time image resize, DRM enforcement) — use a proxy
- Compliance requires all data through audited servers — bypass not permitted
- Very small files (<1KB) where CDN round-trip overhead exceeds benefit — serve inline or inline as base64

---

## MERN Developer Notes

```javascript
// CI/CD deployment script for static frontend to S3 + CloudFront invalidation

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const fs = require('fs');
const path = require('path');
const { lookup: getMimeType } = require('mime-types');

const s3 = new S3Client({ region: 'us-east-1' });
const cf = new CloudFrontClient({ region: 'us-east-1' });

const BUCKET = 'my-app-frontend';
const CF_DISTRIBUTION_ID = 'E1234EXAMPLE';
const BUILD_DIR = './dist';

// Upload all build files to S3 with correct cache headers
async function uploadBuildToS3(dir, prefix = '') {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const s3Key = prefix ? `${prefix}/${file}` : file;
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      await uploadBuildToS3(filePath, s3Key);
      continue;
    }
    
    const fileContent = fs.readFileSync(filePath);
    const mimeType = getMimeType(file) || 'application/octet-stream';
    
    // Cache strategy based on file type
    const isEntryPoint = file === 'index.html' || file === 'service-worker.js';
    const isContentHashed = /\.[a-f0-9]{8,}\.(js|css)$/.test(file);
    
    let cacheControl;
    if (isEntryPoint) {
      cacheControl = 'no-cache'; // Always revalidate entry points
    } else if (isContentHashed) {
      cacheControl = 'max-age=31536000, immutable'; // 1 year for hashed assets
    } else {
      cacheControl = 'max-age=86400'; // 1 day for other assets
    }
    
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: mimeType,
      CacheControl: cacheControl,
      // Enable compression (CloudFront will serve gzip/brotli if client supports)
    }));
    
    console.log(`Uploaded ${s3Key} (${cacheControl})`);
  }
}

// Invalidate only non-hashed files (index.html, sitemap.xml, etc.)
async function invalidateCDN() {
  await cf.send(new CreateInvalidationCommand({
    DistributionId: CF_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: `deploy-${Date.now()}`,
      Paths: {
        Quantity: 2,
        Items: ['/index.html', '/manifest.json'] // only non-hashed files
        // Hashed JS/CSS = new URL on each deploy; no invalidation needed
      }
    }
  }));
  console.log('CDN cache invalidated for index.html and manifest.json');
}

async function deploy() {
  console.log('Deploying to S3...');
  await uploadBuildToS3(BUILD_DIR);
  console.log('Invalidating CDN...');
  await invalidateCDN();
  console.log('Deployment complete!');
}

deploy().catch(console.error);

// CloudFront Distribution config excerpt (in Terraform/CDK):
/*
  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_identity = aws_cloudfront_origin_access_identity.frontend.id
  }
  
  default_cache_behavior {
    compress = true                   # gzip/brotli
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id = "CachingOptimized"  # respect Cache-Control headers
  }
  
  price_class = "PriceClass_All"     # all edge locations globally
*/
```

---

## Real-World Examples

| Company | Implementation | Key Detail |
|---------|---------------|-----------|
| **Netflix** | Web player assets in private S3 → CloudFront OAI | S3 bucket direct-access is denied; only CloudFront can read it (OAI). CloudFront applies rate limiting, geo-blocking, DDoS protection. Saved millions annually by eliminating EC2 for static serving |
| **Instagram** | Photo uploads via S3 pre-signed URLs + downloads via **CloudFront signed cookies** | Instead of per-photo signed URL (millions/sec), one signed cookie grants 1-hour access to all feed photos for that user. Reduced API server load **40%**, improved feed load time by **200ms**. Single cookie vs millions of URL tokens |
| **Airbnb** | S3 buckets in us-east-1, eu-west-1, ap-southeast-1 + CloudFront multi-region | Origin failover: if primary region fails, CloudFront fetches from secondary. Achieves < 100ms TTFB globally even for cache misses. S3 Transfer Acceleration for uploads |
| **Stripe** | React SPA dashboard → S3 + CloudFront | API servers handle transactions, never touched by static file requests. Traffic spike on Black Friday → CDN absorbs frontend load horizontally; API servers scale independently based on transaction volume |

---

## Interview Cheat Sheet

### Q: How does cache invalidation work when you deploy new code?
**A:** The key is **content hashing**. All JavaScript/CSS bundles get content-hash suffixes (`main.a3f2b1c.js`). When you deploy new code, the filename changes (`main.f7e9d2a.js`). New users fetching `index.html` (which has a short TTL or no-cache) get the updated HTML that references the new bundle filename — automatic cache bypass. Old bundles stay cached for in-flight users (no breakage). You only need to invalidate `index.html` and any non-hashed files. This eliminates 95%+ of invalidation overhead and CDN invalidation costs.

### Q: How do you handle private files (premium content, user uploads)?
**A:** Keep S3 bucket private (block all public access). Use the Valet Key pattern — your application server generates time-limited signed URLs (S3 pre-signed URL, 15-min expiry, scoped to one object) and returns them to authenticated clients. Clients download directly from S3 using the URL; your app server never touches the file bytes. For download-heavy content with many concurrent users, use CloudFront signed URLs with signed cookies (Instagram approach for feed photos).

### Q: When would you NOT use CDN + object storage for serving content?
**A:** When content requires per-request server processing — real-time image resizing (use ImageMagick on-request or Lambda@Edge), per-user personalized HTML (use SSR), DRM enforcement mid-stream (audio/video decryption servers), compliance requiring all data through audited systems, or when file sizes are tiny (<1KB) and the CDN overhead exceeds direct inline delivery.

---

## Red Flags to Avoid

- Serving static assets through application servers without mention of cost/bottleneck implications
- Setting long TTL on `index.html` — it's the entry point; must be short to pick up new hashed filenames
- Exposing the S3 bucket publicly when using CloudFront — all traffic should flow through CDN only (set up OAI)
- Not mentioning content hashing — "we'll just invalidate the CDN on every deploy" is expensive and slow
- Ignoring CORS configuration — frontend on `app.example.com` calling `api.example.com` requires CORS headers on the API

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Static Content** | Files that don't require server-side processing: HTML, CSS, JS bundles, images, fonts, PDFs |
| **Object Storage** | Cloud file storage: S3, Azure Blob, GCS — high durability, cheap, HTTP-accessible |
| **CDN (Content Delivery Network)** | Global network of edge servers that cache content close to users |
| **Edge Location** | CDN server in a specific geographic region; serves cached content with minimal latency |
| **Cache Hit** | Request served from CDN edge cache (no origin request); fast (5–20ms) |
| **Cache Miss** | Content not in CDN cache; CDN fetches from origin (S3), caches it, serves response |
| **Cache-Control** | HTTP header specifying how long content should be cached (max-age, no-cache, immutable) |
| **Content Hashing** | Including content hash in filename (`main.a3f2b1c.js`); when file changes, filename changes |
| **CDN Invalidation** | Purging cached content from CDN before its TTL expires; costly, takes 5–15 min to propagate |
| **OAI (Origin Access Identity)** | CloudFront credential that allows CloudFront to access private S3 buckets |
| **Origin Shield** | Extra CDN caching layer between edges and origin; reduces origin request volume |
| **CloudFront Functions** | Sub-millisecond JavaScript executed at the CDN edge; for A/B testing, header manipulation |
| **Brotli** | Advanced compression algorithm (better than gzip for CSS/JS); supported by all modern browsers |
| **SPA (Single-Page App)** | React/Vue/Angular app compiled to static HTML/CSS/JS; perfect for S3 + CDN hosting |
| **TTFB (Time to First Byte)** | Latency until first byte of response arrives at client; CDN reduces from 300ms to < 20ms |
