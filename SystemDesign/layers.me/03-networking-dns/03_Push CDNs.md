# 03 — Push CDNs

> **Source**: https://layrs.me/course/hld/03-networking-dns/push-cdns  
> **Level**: Intermediate | **Read time**: ~9 min  
> **Module**: M3 — Networking & DNS

---

## TL;DR

Push CDNs require you to **proactively upload content** to the CDN provider, which then replicates it to all edge locations **before** any user requests arrive. You control exactly when content is deployed; the trade-off is paying for storage across all edges, but origin server load drops to **zero** after the push.

**One-liner for interviews**: *"Push CDN = you pre-load every edge with content. Best for infrequently updated, predictable, high-demand content. You pay for storage everywhere; you get zero origin traffic and guaranteed edge presence."*

---

## ELI5 — Explain Like I'm 5

Imagine you run a chain of vending machines across a city. **Every morning**, before anyone arrives, you drive to **every single machine** and fill it with snacks.

- When customers arrive, everything is already there — zero waiting.
- Your warehouse (origin) stays completely quiet during the day.
- You pay for space in every machine, even if Tokyo's machine never sells the snack you stocked there.

That's a Push CDN — pre-stock everything, everywhere, before demand arrives.

A **Pull CDN** is like on-demand delivery: you only restock a machine when a customer actually orders something.

---

## The Analogy — Pre-Stocking Vending Machines Overnight

```
Push Model (pre-stock):
  Night: You → fill ALL machines across the city
  Day: Customers → instant service from all machines
  Origin: silent, zero traffic after push completes

Pull Model (on-demand):
  Day: Customer orders → machine calls warehouse → warehouse ships it
  Origin: handles every first request to each machine
```

---

## Core Concept — How Push CDNs Work

### The Push Workflow

```
Step 1 — Upload
  Developer / CI/CD (Continuous Integration/Continuous Delivery) pipeline
    → uploads to CDN API (Application Programming Interface) endpoint
      (e.g. S3-compatible endpoint, rsync, proprietary upload tool)

Step 2 — Replicate
  CDN origin validates content
    → initiates replication job to ALL edge locations
      Edge US-East ← copy (completes t=5 min)
      Edge EU-West ← copy (completes t=20 min)
      Edge APAC ← copy (completes t=45 min)
      ... 200+ locations total

Step 3 — Serve
  User requests content
    → edge serves from local storage
    → ZERO origin involvement

Step 4 — Update
  You upload a new version → replication repeats
  Old version stays cached during transition (if versioned URLs used)
```

### Comparison: Push CDN vs. Pull CDN Cost Model

```
Push CDN:
  Cost = Storage × edge count
  Example: 50 GB content × 150 edges = 7,500 GB-months storage
  Cost: ~$750/month FIXED (regardless of whether it's 100 requests or 1 billion)

Pull CDN:
  Cost = Bandwidth transferred
  Low traffic (1 TB transfer): ~$80/month
  High traffic (50 TB transfer): ~$4,000/month
```

**Crossover point**: When high request volumes amortize the fixed storage cost, Push CDN wins.

---

## Key Principles

| Principle | What it means |
|---|---|
| **Explicit content lifecycle management** | You control what exists at the edge and when it changes. No automatic cache warming, no origin fallback. If you don't push it, it doesn't exist at the edge. |
| **Storage-bandwidth trade-off** | Push CDN charges primarily for **storage** (GB-months across all edges), not bandwidth per request. High-traffic content = push is cheap per request. Low-traffic content = push is wasteful. |
| **Zero origin load post-deployment** | After replication completes, your origin servers receive **zero traffic** for that content. They can even be taken offline for maintenance. |

---

## When to Use Push CDN

```
✓ USE PUSH CDN when:
  • Updates are infrequent (daily / weekly releases)
  • Traffic is predictable and high
  • Origin capacity is constrained or expensive
  • Content size is manageable (<100 GB total)
  • You need guaranteed edge presence before traffic hits
    (e.g. marketing campaign launch at exact time T)

✗ AVOID PUSH CDN when:
  • Content changes more than once per hour
  • Traffic is unpredictable / long-tail (most files rarely accessed)
  • Content catalog is huge (millions of user-generated files)
  • Origin has excess capacity
```

---

## Propagation Delay Problem

Replication to 200+ edges takes **15–60 minutes**. This creates a deployment trap:

```
❌ WRONG: Deploy app code before replication completes
  t=0:  Upload logo-v2.png to CDN API
  t=10min: Deploy new app HTML (references logo-v2.png)
  t=10min: US edge has logo-v2.png ✓
  t=10min: APAC edge still replicating → GET logo-v2.png → 404 Not Found!

✓ CORRECT: Wait for replication confirmation
  t=0:  Upload logo-v2.png to CDN API
  t=45min: CDN API confirms replication complete across all edges
  t=46min: Deploy new app HTML (references logo-v2.png)
  → All edges serve logo-v2.png ✓
```

**Solution**: Use **versioned URLs** so old and new content coexist during transitions:
```
logo-v1.png — still cached at edges fulfilling old HTML requests ✓
logo-v2.png — replicated to edges; new HTML references v2 ✓
```

---

## Real-World Examples

### Netflix — Open Connect CDN (OCA)

Netflix's Open Connect is the gold standard push CDN implementation:

- **OCAs (Open Connect Appliances)** installed **inside ISP (Internet Service Provider) networks** worldwide
- Each OCA: 100–200 TB (Terabytes) of storage
- **Nightly push** during off-peak hours (2–8 AM local): new movies, TV (Television) episodes, updated content
- **100% of streaming** traffic comes from local OCA storage during the day — zero origin traffic
- Push model justified because: new releases are known in advance; each movie is watched **thousands of times** → massive request volume amortizes storage cost
- Only "long-tail" content (rarely watched titles) falls back to regional pulls

### Fastly — Push for Documentation Sites

- Customers upload content via API during CI/CD (Continuous Integration/Continuous Delivery) pipelines
- Example: Documentation site, 10 GB content pushed weekly
  - Push CDN storage: 10 GB × 50 edges = 500 GB-months → ~$50/month fixed
  - Same content with Pull CDN at $0.08/GB bandwidth: 10 million requests × 1 KB avg = 10 GB/month → $0.80 in bandwidth
  - At higher traffic: 1 billion requests → Pull CDN = $80/month but push = $50/month (push wins!)
- Used for content on known release cycles: documentation updates, marketing campaigns

---

## MERN Dev Notes

> **MERN dev note — Static assets in MERN stack**: When you run `npm run build` for your React app, Vite/Webpack outputs `dist/assets/` with content-hashed filenames (e.g. `main.abc123.js`). These are naturally push-CDN-compatible: upload your entire `dist/` folder to CDN after each build. Use a 1-year TTL (Time To Live) for `dist/assets/` files (they're versioned) and a short TTL (60 s) for `index.html` (which references the new bundle names). This is exactly how Netlify and Vercel work under the hood.

> **MERN dev note — Why Netflix doesn't use MongoDB for video**: Netflix video files are binary blobs (MKV/MP4 (MPEG-4) containers), not documents. MongoDB/GridFS would be absurdly expensive for 200 TB per OCA. They use specialized video encoding pipelines and custom storage. This highlights a core MERN lesson: MongoDB is for **document data** (user profiles, watch history, recommendations), not for large binary media.

---

## Common Pitfalls

| Pitfall | Why it happens | How to avoid |
|---|---|---|
| Pushing frequently-changing content | Treating push like pull; uploading every change | Reserve push CDN for content with known release cycles (daily/weekly); use pull for anything that changes hourly |
| Ignoring propagation delays | Assuming pushed content is instantly global | Wait for replication confirmation from CDN API before deploying app code that references new assets. Use versioned URLs. |
| Over-provisioning edge storage | Pushing all content to all edges "just in case" | Use selective replication: match content geography with user geography. Japanese-language content doesn't need to be in South American edges. |
| Not monitoring replication status | Assuming push succeeded | Use CDN provider's replication status API; set up alerts for failed replication jobs. |

---

## Interview Cheat Sheet

**When would you choose push CDN over pull CDN?**
> When updates are infrequent (daily or less), traffic is predictable and high, origin capacity is limited, or you need guaranteed edge presence before traffic arrives. Classic example: Netflix pre-positioning video content during off-peak hours.

**What are the cost implications of pushing 100 GB to 200 edges?**
> 100 GB × 200 edges = 20,000 GB-months of storage. At $0.10/GB-month = $2,000/month fixed cost regardless of request volume. Justified only when high request counts amortize this (e.g., 1 billion requests/month → $0.000002/request).

**How do you handle content updates without downtime?**
> Versioned URLs: `logo-v1.png` stays cached for old HTML; `logo-v2.png` is the new push. Deploy in order: push new assets → wait for replication → update HTML to reference new assets.

**What happens if replication fails to some edges?**
> Those edges return 404 (Not Found) for the new content. Mitigation: versioned URLs (old version still works), replication monitoring with alerts, fallback to regional pull from a tier-2 cache if the edge misses.

---

## Keywords / Glossary

| Term | Full Form / Meaning |
|---|---|
| Push CDN | CDN where YOU upload content proactively; edges pre-stocked before requests arrive |
| Pull CDN | CDN where edges fetch content from origin on first request (see T04) |
| OCA | Open Connect Appliance — Netflix's custom CDN hardware inside ISP networks |
| Replication | Process of copying content from CDN origin to all edge locations |
| Propagation delay | Time for content to replicate to all edges (15–60 min for push CDNs) |
| Versioned URL | URL with content hash (e.g. `style.abc123.css`) making each version unique |
| Cache busting | Using versioned URLs to force new cache entries, bypassing old TTL |
| CI/CD | Continuous Integration / Continuous Delivery — automated build and deploy pipeline |
| ISP | Internet Service Provider |
| TB | Terabyte — 1,000 GB |
| GB | Gigabyte — unit of storage |
| TTL | Time To Live — cache expiry duration |
| API | Application Programming Interface |
| CDN | Content Delivery Network |
| PoP | Point of Presence — a CDN edge location |
| Origin server | Your authoritative content source |
| Zero origin load | After push completes, origin receives no traffic for that content |
| Selective replication | Pushing content only to specific geographic edges, not all edges globally |
| Long-tail content | Files that are rarely requested; push CDN is inefficient for these |
