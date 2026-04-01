# Gateway Aggregation Pattern: Combine API Calls

**Module**: M11 — Cloud Design Patterns  
**Topic**: T27 of 37  
**Difficulty**: Intermediate  
**Read Time**: ~22 min

---

## 1. ELI5 (Explain Like I'm 5)

Imagine you need to buy a complete outfit: shoes, pants, shirt, jacket, and accessories — all from different stores in a mall. You could either:
- **Visit each store yourself (5 trips)**, or  
- **Hire a personal shopper** who runs to all 5 stores at once, collects everything, and brings it back in one trip.

Gateway Aggregation is the personal shopper. Your client makes **1 request**, the gateway fans out to **N services** in parallel, combines the results, and returns **1 unified response**.

---

## 2. The Analogy

A **personal shopper at a mall**. Instead of you visiting 5 different stores to buy a complete outfit, you tell the personal shopper what you need once. They run to all 5 stores **simultaneously**, collect everything, and bring it back to you in one trip. You saved 4 round trips, and you don't need to know which stores exist or where they're located.

The personal shopper is your gateway aggregator — handling the complexity of multiple vendors while giving you a simple, unified experience.

---

## 3. Why This Matters in Interviews

Gateway Aggregation comes up in **mobile API design**, microservices architecture, and performance optimization discussions. Interviewers want to see if you understand:
- The cost of network calls (especially on mobile)
- When aggregation makes sense vs creating a bottleneck
- How to handle partial failures gracefully

This pattern frequently appears in questions about designing mobile backends for apps like Instagram, Uber, or Netflix where a single screen needs data from 5–10 different services.

Strong candidates discuss the tradeoff between aggregation (fewer calls, more gateway complexity) and direct service calls (more calls, simpler gateway), and mention GraphQL as an alternative approach.

---

## 4. Core Concept

Gateway Aggregation is a design pattern where an API gateway **consolidates multiple backend service calls into a single client request**. In microservices architectures, a single user action often requires data from multiple services — user profile, recommendations, notifications, settings, etc.

Without aggregation, mobile or web clients would need to make 5–10 separate HTTP requests, each with connection overhead, authentication, and round-trip latency. This creates terrible user experience, especially on mobile networks.

The gateway acts as an intelligent proxy that fetches data from multiple microservices **in parallel**, combines results into a unified payload, and returns it to the client. This:
- Reduces network round trips from **N to 1**
- Cuts total latency by **parallelizing** calls instead of sequencing them
- **Decouples clients** from internal service topology

---

## 5. ASCII Diagrams

### Basic Gateway Aggregation (Fan-Out / Fan-In)
```
Client: GET /api/home-feed (1 request)
            │
            ▼
    ┌───────────────────┐
    │    API GATEWAY    │
    │  (Aggregation)    │
    └──┬──┬──┬──┬──┬───┘
       │  │  │  │  │   Parallel fan-out
       ▼  ▼  ▼  ▼  ▼
  ┌──────┐┌───┐┌─────┐┌─────┐┌───┐
  │User  ││Con││Recom││Notif││Ads│
  │Svc   ││Svc││Svc  ││Svc  ││Svc│
  │100ms ││120││150ms││80ms ││200│
  └──────┘└───┘└─────┘└─────┘└───┘
       │  │  │  │  │
       └──┴──┴──┴──┴───►  Aggregated Response
                            Total: 210ms (max + overhead)
                            vs 650ms sequential
```

### Latency Calculation
```
Sequential:  100 + 120 + 150 + 80 + 200 = 650ms
Parallel:    max(100, 120, 150, 80, 200) + 10ms overhead = 210ms
Improvement: (650-210)/650 = 68% faster
```

### Data Criticality Tiers
```
CRITICAL (must succeed)          IMPORTANT (should succeed)
┌──────────────────────┐        ┌──────────────────────────┐
│ Auth Service         │        │ Content Service           │
│ User Profile         │        │ → retry or use cache      │
│ Timeout: 1000ms      │        └──────────────────────────┘
└──────────────────────┘
                                OPTIONAL (can fail gracefully)
                                ┌──────────────────────────┐
                                │ Recommendations           │
                                │ Ads Service               │
                                │ → return empty if timeout │
                                └──────────────────────────┘
```

---

## 6. How It Works — Step by Step

**Step 1: Client sends a single aggregated request**  
The mobile app sends `GET /api/home-feed`. This represents a composite resource requiring data from multiple services. The client doesn't know or care about internal topology.

**Step 2: Gateway parses and identifies required services**  
Gateway examines the request and determines which backends to call — User Service, Content Service, Recommendation Service, Notification Service, Ad Service.

**Step 3: Gateway fans out parallel requests**  
Fires off all requests simultaneously using async I/O or thread pools. If each service takes 100ms, parallel execution takes 100ms total instead of 500ms sequential. Gateway includes auth tokens, correlation IDs, and timeout configs per call.

**Step 4: Gateway waits for responses with timeout protection**  
Collects responses as they arrive, with a timeout (e.g., 500ms) to prevent slow services from blocking the entire request. Error handling strategy matters here — is the notification count critical or optional?

**Step 5: Gateway aggregates and transforms the data**  
Combines responses into a single unified payload. May involve renaming fields, filtering sensitive data, computing derived values, or reshaping nested objects.

**Step 6: Gateway returns the unified response**  
Client receives one response with all needed data. Complexity of multiple services, parallel execution, and data aggregation is completely hidden.

---

## 7. Variants / Types

### 1. Simple Aggregation (Fan-Out / Fan-In)
Parallel calls to multiple independent services, combined into one response.  
**Use when**: Services are independent and don't need each other's data.  
**Example**: Netflix fetches user profile, viewing history, and recommendations in parallel for the home screen.

### 2. Chained Aggregation (Sequential Dependencies)
Some services depend on data from others. Call Service A first, then use its data to call Service B.  
**Use when**: Service B needs output of Service A (e.g., fetch user ID, then fetch user's orders).  
**Example**: Uber ride request — validate payment method first, then check driver availability in that payment region, then create ride request.

### 3. Conditional Aggregation (Smart Routing)
Gateway decides which services to call based on request parameters or user context. Premium users get personalized recommendations; free users get generic content.  
**Use when**: Different user segments need different data.  
**Example**: Spotify calls the high-quality audio service only for premium subscribers.

### 4. Batch Aggregation (Request Collapsing)
Multiple clients request similar data within a short time window → batch into a single backend call.  
**Use when**: High request volume for the same data.  
**Example**: Facebook's DataLoader — if 50 users load the same profile page simultaneously, it makes one database query instead of 50.

### 5. GraphQL-Style Aggregation (Client-Driven)
Clients specify exactly what fields they need. Gateway parses and fetches only the requested fields from backends.  
**Use when**: Diverse clients with different data needs; avoid endpoint proliferation.  
**Example**: GitHub's GraphQL API lets clients request specific repository fields, avoiding N+1 queries.

---

## 8. Trade-offs

### Aggregation Location

| Option | Pros | Cons | Use When |
|--------|------|------|----------|
| **Gateway Aggregation** (centralized) | Centralizes logic, reduces client complexity, works for all clients | Gateway bottleneck/SPOF, complex branching | Multiple client types needing similar aggregations |
| **Backend for Frontend (BFF)** | Optimized per client, team autonomy, independent scaling | Code duplication, more services | Mobile/web have very different data needs |
| **Client-Side** | No gateway bottleneck, simple backend | Poor mobile performance, exposes topology | Internal admin tools only |

### Synchronous vs Asynchronous

| | Synchronous | Asynchronous |
|---|---|---|
| Model | Wait for all responses | Return immediately, push updates via WebSocket/SSE |
| UX | Simple request/response | Fast initial load, progressive enhancement |
| Use | All data critical and displayed together | Some data critical (show immediately), other optional |

### Caching Strategy

| | Gateway Cache | Service Cache |
|---|---|---|
| What | Aggregated final response | Individual service data |
| Hit Rate | Maximum (aggregated result) | Medium |
| Invalidation | Complex (which service changed?) | Fine-grained |
| Use | Trending content, popular profiles | Different cache lifetimes per piece |

---

## 9. When to Use / When to Avoid

### ✅ Use When
- Mobile clients with bandwidth/battery constraints (each HTTP call costs 50–200ms)
- Multiple services always called together (home feed needs user + posts + notifications)
- Want to shield clients from backend topology changes
- Services decompose but clients should stay simple

### ❌ Avoid When
- Services are rarely used together (no point aggregating for 10% of requests)
- Aggregation logic is complex and changes frequently (gateway maintenance burden)
- Different clients need radically different shapes (use BFF instead)
- Very few backend calls (no meaningful benefit)

---

## 10. MERN Dev Notes

### Node.js Gateway Aggregation

```javascript
// gateway-aggregation.js
const express = require('express');
const router = express.Router();

// Helper: call with timeout, fail safe
async function callWithTimeout(fn, timeoutMs, fallback = null) {
  return Promise.race([
    fn(),
    new Promise(resolve => setTimeout(() => resolve(fallback), timeoutMs))
  ]);
}

// Home feed aggregation endpoint
router.get('/home-feed', async (req, res) => {
  const userId = req.user.id;
  
  // Fan out all calls in parallel with different criticality
  const [profile, posts, recommendations, notifications, ads] = await Promise.allSettled([
    // CRITICAL - fail if unavailable
    callWithTimeout(() => userService.getProfile(userId), 1000),
    // IMPORTANT - retry or cache fallback
    callWithTimeout(() => contentService.getFeed(userId), 1000),
    // OPTIONAL - gracefully degrade
    callWithTimeout(() => recommendationService.getSuggestions(userId), 200, []),
    callWithTimeout(() => notificationService.getCount(userId), 200, 0),
    callWithTimeout(() => adService.getAds(userId), 200, [])
  ]);

  // Critical services must succeed
  if (profile.status === 'rejected' || !profile.value) {
    return res.status(503).json({ error: 'Service unavailable' });
  }

  // Aggregate response
  res.json({
    user: profile.value,
    feed: posts.status === 'fulfilled' ? posts.value : [],
    recommendations: recommendations.value ?? [],
    notifications: notifications.value ?? 0,
    ads: ads.value ?? [],
    // metadata for debugging
    meta: {
      degraded: [posts, recommendations, notifications, ads]
        .filter(r => r.status === 'rejected' || r.value === null)
        .length > 0
    }
  });
});
```

### React: Progressive Loading Pattern

```jsx
// HomeFeed.jsx — show critical content immediately, load optional async
import { useState, useEffect } from 'react';

function HomeFeed() {
  const [feed, setFeed] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  
  useEffect(() => {
    // Load critical feed first
    fetch('/api/home-feed?critical=true')
      .then(r => r.json())
      .then(data => {
        setFeed(data);
        // Load optional data asynchronously
        fetch('/api/recommendations')
          .then(r => r.json())
          .then(recs => setRecommendations(recs))
          .catch(() => {}); // fail silently
      });
  }, []);
  
  if (!feed) return <Spinner />;
  
  return (
    <div>
      <UserProfile user={feed.user} />
      <FeedPosts posts={feed.feed} />
      {recommendations.length > 0 && (
        <Recommendations items={recommendations} />
      )}
    </div>
  );
}
```

### DataLoader: Batch Aggregation (N+1 Prevention)

```javascript
// dataloader-example.js
const DataLoader = require('dataloader');

// Batch function called with array of keys
const userLoader = new DataLoader(async (userIds) => {
  // Single DB query for all requested users
  const users = await db.collection('users')
    .find({ _id: { $in: userIds } })
    .toArray();
  
  // Return in same order as keys
  return userIds.map(id => users.find(u => u._id.toString() === id));
});

// Each resolver call batches behind the scenes
async function resolvePosts(posts) {
  return Promise.all(
    posts.map(post => userLoader.load(post.authorId))
  );
  // Instead of N queries, DataLoader batches into 1 query
}
```

---

## 11. Real-World Examples

### Netflix: Zuul Gateway for Streaming API
Netflix's Zuul gateway aggregates data from over 100 microservices. When you open the Netflix app, `GET /api/home` fetches your viewing history, personalized recommendations, trending content, continue watching list, and new releases — all from different services — in a single API call. Zuul uses **RxJava for non-blocking parallel execution**, making 10–15 backend calls in ~200ms total.

Interesting detail: Zuul implements **dynamic routing** where the gateway decides which recommendation service to call based on A/B test assignments. If you're in the "new algorithm" group, Zuul routes to the experimental recommendation service — testing new features without changing client code.

### Uber: Mobile API Gateway for Ride Requests
When you request a ride, `POST /v1/ride/request` fans out to: User Service, Location Service, Pricing Service, Driver Service, Promotion Service, Surge Service — all in parallel.

Interesting detail: Uber uses **conditional aggregation** — if the Promotion Service times out, the ride request still succeeds without the discount code. But if the Payment Service fails, the entire request fails. They also implement **request collapsing**: if 100 users in the same area request rides simultaneously, it batches location queries to the Driver Service, reducing database load by 100x.

### Instagram: Feed Aggregation with Partial Failures
Instagram's feed API aggregates posts from Graph Service, Content Service, Media Service, and Ad Service in parallel.

Interesting detail: Instagram uses **tiered aggregation with graceful degradation** — if the Ad Service is slow or down, the feed still loads with organic content; ads are injected asynchronously. Popular celebrity profiles are cached at the gateway for 60 seconds, reducing backend load by 95% during viral moments. When a post goes viral with 1M simultaneous viewers, the gateway serves from Redis instead of hammering backend services.

---

## 12. Interview Cheat Sheet

### The 30-Second Answer
> "Gateway Aggregation consolidates multiple backend service calls into 1 client request. The gateway fans out to N services in parallel, aggregates responses, and returns 1 unified payload. This is critical for mobile apps — 5 services at 100ms each = 110ms parallel vs 500ms sequential. The key is designing for partial failures: critical data must succeed, important data gets retried, optional data fails gracefully."

### Key Interview Questions

**Q: When to use Gateway Aggregation vs BFF vs client-side?**  
- Gateway Aggregation: multiple client types, bandwidth-constrained clients, services always called together  
- BFF: mobile and web need very different data shapes, separate teams per platform  
- Client-side: only internal admin tools / same-datacenter

**Q: How do you handle partial failures?**  
Classify data as critical/important/optional. Use `Promise.allSettled()`. Set different timeouts per tier. Circuit breakers for unhealthy services. Minimum viable response = feed without ads beats no feed at all.

**Q: How do you prevent gateway from being a bottleneck?**  
Scale horizontally, use async I/O (non-blocking), cache aggregated responses in Redis, connection pool to backends, monitor P99 latency per service.

### Calculation: Latency Comparison
```
Sequential (5 services × 100ms each):  500ms
Parallel (max service + 10ms overhead): 110ms  → 78% reduction

With 1 slow service at 300ms:
Parallel: max(100, 100, 300, 100, 100) + 10 = 310ms
→ slowest service determines total latency
→ set aggressive timeouts per tier
```

---

## Red Flags to Avoid

| Red Flag | Why Wrong | Say Instead |
|----------|-----------|-------------|
| "Aggregate everything into one giant endpoint" | Over-fetching, 500KB mobile payloads | "Profile which fields are used; use field selection" |
| "Retry all failed services until they work" | Cascading failures, no timeout limits | "Timeout per tier; circuit breaker; partial response" |
| "Push as always better than pull for aggregation" | More calls = more gateway complexity | "Fan-out parallel, not push" |
| "All data is equally critical" | Ads down = no feed | "Classify critical/important/optional; minimum viable response" |

### Keywords / Glossary

| Term | Definition |
|------|------------|
| **Fan-out** | Gateway sends multiple parallel requests to different services |
| **Fan-in** | Gateway collects and combines parallel responses |
| **Request collapsing** | Batching multiple identical requests into one backend call |
| **DataLoader** | Pattern (popularized by Facebook) for batching and deduplicating data fetching |
| **Chatty interface** | Too many fine-grained API calls; aggregation solves this |
| **Minimum viable response** | Smallest set of data that still provides user value |
| **Circuit breaker** | Stops calling a failing service for a cooldown period |
| **Progressive loading** | Show critical content first, load optional content asynchronously |
