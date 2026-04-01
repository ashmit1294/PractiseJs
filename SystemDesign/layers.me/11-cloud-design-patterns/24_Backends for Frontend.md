# T24 — Backends for Frontends (BFF) Pattern

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/backends-for-frontend

---

## ELI5 (Explain Like I'm 5)

A restaurant has one kitchen (your microservices) but different service windows: drive-through (fast, limited menu), formal dining room (full table service), and catering (bulk delivery). All windows serve food from the same kitchen, but they present it differently based on what each customer type needs. The BFF pattern does the same for your APIs — mobile app, web app, and smart TV all get their own "service window" optimized for their specific needs.

---

## Analogy

**Restaurant service interfaces**: You don't send customers directly to the kitchen. The drive-through (Mobile BFF) gives you a compact, fast-order format. The dining room (Web BFF) gives you elaborate presentation and extra options. The catering service (IoT BFF) handles bulk and scheduled orders. Same kitchen, completely different presentation optimized per context.

---

## Core Concept

The Backend for Frontend pattern creates **dedicated backend services for each client type** (web, mobile, IoT) instead of forcing all clients to use one general-purpose API.

Introduced by Sam Newman in 2015. The key problem: a mobile app on 4G needs minimal payloads and can't afford chatty multi-round-trip APIs. A web dashboard needs rich data for complex visualizations. An IoT device has severe memory constraints. A single "general-purpose" API forces painful compromises — every field becomes optional, filtering parameters multiply, and frontend teams constantly fight over API changes.

**The critical insight is organizational, not just technical**: When frontend teams own their BFFs, they can iterate quickly without coordinating with backend teams. BFF deploys independently, optimized for that specific user experience.

---

## ASCII Diagrams

```
WITHOUT BFF: One general API, all clients compromised
  Mobile App ─────────────────────────────────► General API
  Web App     ─────────────────────────────────► General API
  IoT Device  ─────────────────────────────────► General API
  
  ❌ Mobile gets 365KB payload when it needs 10KB
  ❌ API changes require all frontend teams to coordinate
  ❌ Bloated optional fields for every use case

WITH BFF: Each client gets optimized backend
  Mobile App───► Mobile BFF (10KB, Unix timestamps, short field names)
                      │── User Service (5 fields)
                      │── Order Service (last 3 only)
                      └── Rec Service (10 items)
  
  Web App  ────► Web BFF (50KB, ISO timestamps, full field names)
                      │── User Service (full profile)
                      │── Order Service (full history)
                      └── Rec Service (50 items)
  
  IoT      ────► IoT BFF (2KB, binary-optimized)
  
  ✅ Each client gets exactly what it needs
  ✅ Frontend teams deploy independently
  ✅ Backend services remain stable

LATENCY COMPARISON (mobile app, 4G, 4 service calls):
  Sequential client calls:   4 × 150ms = 600ms
  Parallel client calls:     max(150ms) + overhead ≈ 200-250ms
  BFF aggregation:           120ms client-BFF + 35ms server-side-parallel + 10ms = 165ms
  → BFF reduces latency 72% vs sequential, 27% vs parallel
  
BANDWIDTH SAVINGS:
  Without BFF: User(15KB) + Orders(50KB) + Recs(200KB) + Inventory(100KB) = 365KB
  With BFF:    User(2KB) + Orders(5KB) + Recs(20KB) + Inventory(3KB) = 30KB
  → 92% bandwidth reduction → 0.54 sec faster on 4G
  → 10M DAU × 335KB saved × 30 days = 100.5TB/month = ~$10K/month CDN savings
```

---

## How It Works (Step by Step)

1. **Client makes single request**: Mobile app calls `GET /api/mobile/home-feed` — one endpoint designed for that exact screen.

2. **BFF fans out in parallel**: BFF calls User Service (profile fields needed by mobile), Order Service (last 3 orders), Recommendation Service (top 10), Inventory Service (availability flags) — all in parallel using datacenter network (1-5ms RTT).

3. **Aggregation and transformation**: As responses arrive, BFF merges into single payload. Transforms data: ISO timestamps → Unix epochs (mobile preference), filters 50-field user profile down to 5 needed fields, resizes image URLs for mobile screen dimensions.

4. **Optimized response**: Returns 10KB mobile-optimized JSON (vs. 50KB web version). Field names shortened, cache headers set for cellular networks.

5. **Graceful degradation**: If Recommendation Service is down, BFF returns the rest of the feed without recommendations — partial response, still 200 OK. Users sees feed without recommendations rather than error screen.

6. **Independent evolution**: Mobile team adds "stories" to home screen → modifies only Mobile BFF to fetch story data. Web BFF unchanged. Backend services unaware.

---

## Variants

| Type | Focus | Example |
|------|-------|---------|
| **Aggregation BFF** | Reduce round trips by merging N backend calls into 1 | Spotify mobile `/home` merges profile + playlists + recommendations → startup time -40% |
| **Transformation BFF** | Adapt backend data formats to client needs | Netflix TV BFF transforms 50-field movie metadata to 5 fields for TV UI → 50KB → 5KB |
| **Protocol Translation BFF** | Bridge REST ↔ gRPC, or REST → GraphQL | Airbnb GraphQL BFF: web uses GraphQL queries, backend services use REST — no backend rewrites |
| **Security/Auth BFF** | Handle client-specific auth flows | Uber Rider BFF: OAuth + token refresh for mobile. Web BFF: session cookies. Both translate to same internal JWT |
| **Caching BFF** | Client-specific caching strategies | Twitter mobile BFF: stale for 30s (cellular). Web BFF: stale for 5s (freshness priority) |

**BFF count rule**: Group clients by actual needs, not platform. iOS and Android with identical UI → share 1 BFF. If needs diverge → split. You need 2-3 BFFs max, not one per platform. SoundCloud: 5 BFFs → consolidated to 2 (90% overlap between mobile variants).

---

## Trade-offs

| Dimension | Shared API | BFF |
|-----------|-----------|-----|
| **Code duplication** | None | Some orchestration logic repeated across BFFs |
| **Client optimization** | Compromised for all | Perfect for each |
| **Team autonomy** | Blocked by shared team | Frontend team deploys 10-20×/day independently |
| **Operational complexity** | 1 service to manage | N BFF services to manage, monitor, scale |
| **API stability** | One team controls | Each team deploys independently — no coordination |
| **Single point of failure** | Shared API is a SPOF | Each BFF is a SPOF for its own client only |

**GraphQL vs BFF**: GraphQL is flexible for similar clients needing query customization. BFF provides REST simplicity + client-specific orchestration. Best combo: GraphQL BFF (exposes GraphQL to clients, handles orchestration internally). GitHub uses GraphQL for web, separate BFFs for mobile.

---

## When to Use (and When Not To)

**Use when:**
- Client types have fundamentally different data needs (mobile 10KB vs web 50KB)
- Frontend teams need to move at different speeds without backend coordination
- Clients are on different network conditions (cellular vs. broadband)
- You have mature DevOps practices where frontend teams can own services

**Avoid when:**
- All client types are similar enough that one optimized API suffices
- Team doesn't have operational maturity to own and operate services
- You're creating BFFs speculatively before the pain of shared API is real
- Creating a BFF per platform variant (iOS + Android) when they have identical needs (over-splitting)

---

## MERN Developer Notes

```javascript
// Mobile BFF — Node.js (frontend team comfortable with JS)
const express = require('express');
const axios = require('axios');
const CircuitBreaker = require('opossum');

const app = express();

// Circuit breaker for each dependency
const recommendationBreaker = new CircuitBreaker(
  (userId) => axios.get(`http://recommendation-service/recommendations/${userId}`),
  { timeout: 500, errorThresholdPercentage: 50, resetTimeout: 10000 }
);

// Mobile-optimized home feed endpoint
app.get('/api/mobile/home-feed', authenticate, async (req, res) => {
  const { userId } = req.user;
  
  // Fan out to backends in parallel (BFF orchestration)
  const [profileResult, ordersResult, recsResult, inventoryResult] = await Promise.allSettled([
    axios.get(`http://user-service/users/${userId}`, { 
      params: { fields: 'id,name,avatar,tier' } // request only needed fields
    }),
    axios.get(`http://order-service/orders`, {
      params: { userId, limit: 3, sort: '-createdAt' }
    }),
    recommendationBreaker.fire(userId).catch(() => ({ data: { items: [] } })), // fallback if circuit open
    axios.get(`http://inventory-service/availability`, {
      params: { userId }
    })
  ]);
  
  // Aggregate with graceful degradation
  const profile = profileResult.status === 'fulfilled' 
    ? transformProfile(profileResult.value.data) // transform to mobile format
    : null;
  
  if (!profile) return res.status(503).json({ error: 'Core service unavailable' }); // profile is required
  
  const orders = ordersResult.status === 'fulfilled'
    ? transformOrders(ordersResult.value.data)
    : []; // optional: return empty if unavailable
  
  const recommendations = recsResult.status === 'fulfilled'
    ? recsResult.value.data.items.slice(0, 10)
    : []; // optional: degrade gracefully
  
  // Transform to mobile-optimized format
  const response = {
    usr: profile,                             // shortened field name for bandwidth
    orders,
    recs: recommendations,
    ts: Math.floor(Date.now() / 1000)        // Unix timestamp, not ISO
  };
  
  // Mobile-specific cache headers
  res.set('Cache-Control', 'private, max-age=30');
  res.json(response);
});

// Field transformation for mobile (filters and renames fields)
function transformProfile(user) {
  return {
    id: user.id,
    name: user.displayName,
    avatar: resizeImageUrl(user.avatarUrl, 'mobile'), // mobile-sized images
    tier: user.subscriptionTier
    // Drops: birthDate, email, phoneNumber, billingAddress, etc.
  };
}

// Web BFF handles same data completely differently
// (different service, different team, different deployment)
```

---

## Real-World Examples

| Company | BFF Strategy | Key Detail |
|---------|-------------|-----------|
| **Netflix** | TV BFF + Mobile BFF + Web Player BFF (Node.js, owned by UI teams) | TV BFF pre-fetches next 5 movies you might hover over based on navigation. Mobile BFF minimizes payload for cellular. Each BFF deploys 10-20×/day independently. Includes A/B test logic — different data shapes to user cohorts without touching backends |
| **SoundCloud** | Mobile BFF in Go (rebuilt from 15-20 API calls → 1 `/mobile/home` endpoint) | Reduced home screen load time 3.4s → 1.1s. Multi-level caching: user profile 5min, streams 30s, recommendations 2min. Backend load -60% |
| **Uber** | Rider BFF (100× more traffic than Driver BFF) + Driver BFF | Rider BFF: polls every 2-3s for ride search. Driver BFF: WebSocket push for instant ride requests. If pricing service slow → Rider BFF returns historical estimates (optimistic UI) |
| **Airbnb** | GraphQL BFF for web | Mobile search aggregates data from 10+ services → 8s → 2s load time. GraphQL flexibility for web without rewriting REST backend services |
| **Twitter** | BFF with partial timeline fallbacks | Returns partial timeline when some services are slow; never fails entire request |

---

## Interview Cheat Sheet

### Q: When would you choose BFF over a single shared API?
**A:** When client types have fundamentally different data needs and when coordination overhead exceeds duplication cost. Mobile needs 10KB minimal payload for cellular; web dashboard needs 50KB rich dataset — forcing both to use one API creates compromises for both. Also when frontend teams need to move independently at different deployment speeds. Counter: if clients have 90% data overlap, shared API + feature flags is simpler; avoid BFF explosion.

### Q: Who should own the BFF — frontend team or backend team?
**A:** Frontend team. This is the organizational superpower of BFF. Mobile team owns Mobile BFF, writes it in Node.js or whatever they're comfortable with, deploys 10-20× per day without filing tickets to backend team. When they want to add a "stories" feature, they change their BFF. Backend team remains focused on stable, versioned service APIs. Inversely, if backend team owns BFFs, you recreate the coordination bottleneck BFF was meant to solve.

### Q: How do you prevent BFF explosion?
**A:** Group by actual needs, not platform. iOS + Android with identical UI → share 1 Mobile BFF. Web desktop + web mobile with similar needs → 1 Web BFF. The question is: "Does this client need fundamentally different data, orchestration, or optimization?" If no → same BFF + feature flags for minor differences. Target: 2-3 BFFs for most products. SoundCloud consolidated from 5 BFFs → 2 when they found mobile and web had 90% overlap.

---

## Red Flags to Avoid

- "Create a BFF per client variant (iOS, Android, web desktop, web mobile, TV, voice)" — BFF explosion. Group by needs, not platform
- Business logic in BFFs — BFFs orchestrate, they don't decide. Discount calculation belongs in Pricing Service, not BFF
- BFFs without circuit breakers — one slow backend service will take down entire BFF response without circuit breakers + partial response fallbacks
- Treating BFFs as "just thin wrappers" with no monitoring — instrument BFF-specific metrics (aggregation latency, cache hit rate, partial failure rate)
- "GraphQL replaces BFF" — they're complementary; GraphQL BFF is a valid pattern (Airbnb does this)

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **BFF (Backends for Frontends)** | Dedicated backend service per client type; owned by frontend team; optimizes data for that client |
| **Aggregation** | BFF combines N backend calls into 1 client response server-side |
| **Transformation** | BFF converts backend data format to client-optimized format (ISO → Unix timestamp, 50 fields → 5) |
| **Team Autonomy** | Frontend teams own and deploy BFFs independently without backend team coordination |
| **Graceful Degradation** | Return partial response (without recommendations) when non-critical backend is down |
| **Over-fetching** | Getting more data than needed — the problem shared APIs create for mobile clients |
| **Under-fetching** | Not getting enough data in one request, requiring additional calls — the other shared API problem |
| **GraphQL BFF** | BFF that exposes GraphQL API to clients, handles orchestration internally |
| **Consumer-Driven Contract** | Approach where client (BFF) defines what it needs from backend, backend tests to that contract |
| **Chatty API** | API requiring many small requests to assemble a view — the anti-pattern BFF solves |
| **Feature Flags** | Configuration toggles used within BFF to handle minor platform differences without creating new BFFs |
| **Partial Response** | BFF returns what it can when some backend dependencies fail; critical services required, optional degrade gracefully |
| **BFF Explosion** | Anti-pattern: too many BFFs (one per platform) with 90% code duplication and high operational overhead |
