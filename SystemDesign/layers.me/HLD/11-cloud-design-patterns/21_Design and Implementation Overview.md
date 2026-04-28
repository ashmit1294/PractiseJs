# T21 — Design & Implementation Patterns: Overview

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/design-and-implementation

---

## ELI5 (Explain Like I'm 5)

Imagine building a LEGO city. You wouldn't just dump all the bricks in a pile and hope for the best. You'd plan neighborhoods, roads, and where utilities run. Design and implementation patterns are like official blueprints and construction rules for cloud systems — they tell you how to organize your code, where responsibilities live, and how different parts fit together so the whole city doesn't collapse.

---

## Analogy

**Urban city planning**: A city planner doesn't build randomly — they zone neighborhoods, plan utilities, establish building codes and maintenance access. Design patterns do the same for software. Separation of concerns = zoning. Stable interfaces = building codes. Incremental evolution = urban renewal without demolishing the whole city.

---

## Core Concept

Design and implementation patterns are **structural blueprints** addressing how you organize, build, and deploy cloud systems. Unlike behavioral patterns (Circuit Breaker, Retry) which focus on runtime interactions, these concern code organization, component boundaries, deployment topology, and development workflow.

They answer questions like:
- How do I structure services? (Sidecar, BFF, Anti-Corruption Layer)
- Where do cross-cutting concerns live? (Ambassador, External Config Store)
- How do I integrate with legacy systems? (Strangler Fig, Anti-Corruption Layer)
- How do I serve different client types efficiently? (Backends for Frontends)

These patterns emerged from collective industry experience at Netflix, Amazon, and Google — where certain structural approaches consistently led to faster development cycles, easier testing, clearer ownership, and reduced operational complexity.

**Pattern application workflow**:
1. Identify the structural problem (service boundaries, cross-cutting concerns, client diversity, legacy integration)
2. Select the appropriate pattern
3. Adapt to your context (team size, scale, operational maturity)
4. Implement with clear boundaries and explicit contracts
5. Monitor, evolve, and refine
6. Document and socialize (runbooks, architecture diagrams)

---

## ASCII Diagrams

```
DESIGN PATTERN APPLICATION WORKFLOW:

     ┌─────────────────────────────────┐
     │   Identify Structural Problem    │
     └──────────────┬──────────────────┘
                    │
         ┌──────────▼──────────┐
         │ Service Boundaries?  │──► Sidecar, BFF
         │ Cross-Cutting?       │──► Ambassador, External Config
         │ Client Diversity?    │──► Backends for Frontends
         │ Legacy Integration?  │──► Strangler Fig, ACL
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │  Select Pattern     │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │  Adapt to Context   │ ← team size, scale, maturity
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐      ┌─────────────────┐
         │ Implement w/ Clear  │      │ Monitor & Evolve │
         │ Boundaries          │─────►│ (feedback loop)  │
         └──────────┬──────────┘      └─────────────────┘
                    │
         ┌──────────▼──────────┐
         │ Document & Socialize│
         └─────────────────────┘
```

---

## How It Works (Step by Step)

1. **Separation of concerns**: Each component has a single, well-defined responsibility. Sidecar separates cross-cutting concerns from business logic. BFF separates client-specific logic from core services. When Spotify built microservices, each service owned one domain concept; cross-cutting concerns lived in sidecars.

2. **Encapsulation and abstraction**: Hide implementation details behind stable interfaces. Anti-Corruption Layer hides legacy complexity. Gateway patterns encapsulate backend from clients. Amazon's API Gateway abstracts hundreds of microservices behind a unified API.

3. **Reusability and composability**: Build components that can be reused. Sidecar pattern — write logging sidecar once, deploy everywhere. External Config Store — centralize shared configuration. Google's infrastructure built from composable building blocks (Stubby, Chubby, Borgmon).

4. **Incremental evolution**: The Strangler Fig codifies this principle. LinkedIn's monolith-to-microservices migration took years, carefully extracting one service at a time. Change one thing at a time, validate, move to next.

5. **Operational simplicity**: Favor designs easy to operate, monitor, and debug. Stripe philosophy: boring technology, straightforward design. For each design decision ask: "How do we deploy, monitor, debug at 3 AM?" If you can't answer clearly — simplify.

---

## Variants (Covered in Detail in T22–T35)

| Pattern | Problem Solved | Key Trade-off |
|---------|---------------|---------------|
| **Ambassador** | Outbound networking concerns (retries, circuit breaking) | Process isolation vs latency |
| **Anti-Corruption Layer** | Legacy/external system integration | Architecture purity vs performance |
| **Backends for Frontends** | Different clients need different data shapes | Code duplication vs optimization |
| **Compute Resource Consolidation** | Underutilized infrastructure | Density vs blast radius |
| **External Config Store** | Config embedded in code/artifacts | Flexibility vs external dependency |
| **Gateway Aggregation** | Multiple backend calls per client request | Coupling vs chattiness reduction |
| **Gateway Offloading** | Cross-cutting concerns in every service | Single point of failure vs duplication |
| **Gateway Routing** | API versioning, A/B tests, canary deploys | Routing complexity vs flexibility |
| **Leader Election** | Coordination in distributed systems | Operational complexity vs simplicity |
| **Pipes and Filters** | Sequential data processing pipeline | Composition vs inter-stage overhead |
| **Sidecar** | Cross-cutting concerns without code changes | Deployment complexity vs language agnosticism |
| **Static Content Hosting** | Serving static assets through CDN | Cache invalidation vs performance/cost |
| **Strangler Fig** | Incremental legacy system migration | Dual-system maintenance vs big-bang risk |

---

## Trade-offs

| Dimension | Detail |
|-----------|--------|
| **Centralization vs Decentralization** | Centralize when consistency matters most (security, rate limiting). Decentralize when teams need independence (client-specific logic). Netflix centralizes auth at edge, decentralizes data aggregation in BFFs |
| **Abstraction vs Performance** | ACL and Gateway add latency (1-5ms). Acceptable for user-facing APIs, unacceptable for real-time trading. Measure actual impact |
| **Reusability vs Optimization** | Sidecar and Consolidation favor reuse. BFF favors optimization. Spotify split into BFFs when mobile needed 80% less data than web — generic API too slow |
| **Operational Simplicity vs Architectural Purity** | Sidecar adds deploy complexity but simplifies app code. Small teams: favor simplicity. Large orgs with platform teams: invest in architectural purity |

---

## When to Use (and When Not To)

**Use design patterns when:**
- You feel the pain they solve (not speculatively)
- You have at least two concrete use cases before abstracting
- Your team has the operational maturity to manage the added complexity
- The pattern solves a real problem today, not a hypothetical future problem

**Avoid when:**
- Pattern-driven design rather than problem-driven design ("we should use all microservices patterns!")
- No concrete problem yet — don't build an ACL before you have legacy systems to integrate with
- Team isn't ready for operational overhead (Sidecar, Leader Election)
- Following patterns dogmatically without considering context

---

## MERN Developer Notes

```javascript
// Example: Organizing cross-cutting concerns using middleware (simplified Sidecar concept)
// Instead of putting retry, logging, auth in every service handler:

// logging middleware (cross-cutting concern — separated)
const loggingMiddleware = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log({ method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start });
  });
  next();
};

// auth middleware (offloaded from business logic)
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  // validate token...
  next();
};

// Business logic route (clean, focused on domain)
app.get('/orders', authMiddleware, async (req, res) => {
  // Pure business logic — no auth boilerplate, no logging noise
  const orders = await orderService.getOrders(req.user.id);
  res.json(orders);
});

// BFF concept — client-specific aggregation
async function getMobileHomeFeed(userId) {
  const [profile, orders, recommendations] = await Promise.all([
    userService.getProfile(userId, { fields: 'name,avatar,tier' }), // minimal fields
    orderService.getRecentOrders(userId, { limit: 3 }),
    recommendationService.get(userId, { limit: 10 })
  ]);
  return { profile, orders, recommendations }; // optimized for mobile
}

async function getWebHomeFeed(userId) {
  const [profile, orders, recommendations, analytics] = await Promise.all([
    userService.getProfile(userId), // full profile for web dashboard
    orderService.getFullHistory(userId),
    recommendationService.get(userId, { limit: 50 }),
    analyticsService.getDashboardData(userId)
  ]);
  return { profile, orders, recommendations, analytics };
}
```

---

## Real-World Examples

| Company | Pattern Used | Impact |
|---------|-------------|--------|
| **Netflix** | Sidecar (Prana) for polyglot services | <2ms p99 overhead; uniform Netflix OSS capabilities across JVM + non-JVM services |
| **Uber** | External Config Store (uConfig) for 4,000+ microservices | 10M+ config reads/sec at <5ms p99; contained 2017 incident in 30 seconds via config flag |
| **Shopify** | Strangler Fig migration Rails→microservices | 3-year migration; 99.99% uptime maintained; 80% of functionality migrated |
| **Netflix (BFF)** | TV, mobile, and web BFFs | TV BFF prefetches 10-foot viewing assets; mobile BFF minimizes payload; load time 8s→2s |
| **SoundCloud** | Consolidated from 5 BFFs to 2 | iOS and Android had 90% overlap; maintenance burden halved |

---

## Interview Cheat Sheet

### Q: How do you decide which design pattern to use?
**A:** Problem-driven, not pattern-driven. First identify the specific structural pain: Is it coordination across services? (CQRS, Leader Election). Is it legacy integration? (ACL, Strangler Fig). Is it serving multiple client types? (BFF). Is it cross-cutting concerns across polyglot services? (Ambassador, Sidecar). Match pattern to problem, not the other way around.

### Q: What's the organizational impact of BFF vs shared API?
**A:** BFF enables frontend team autonomy — they own, deploy, and modify their BFFs without backend team coordination. Shared API requires all teams to coordinate on every change, creating a velocity bottleneck. The technical trade-off is code duplication vs. optimization; the organizational trade-off is autonomy vs. coordination overhead. Use BFF when teams need to move at different speeds.

### Q: Why do companies use Sidecar instead of just importing a library?
**A:** Three reasons: (1) Language agnosticism — import once, serve Python, Go, Java equally. (2) Independent updates — update observability without redeploying application code. (3) Process isolation — Sidecar crash doesn't kill the application. Libraries couple the cross-cutting concern lifecycle to the application lifecycle. Netflix's Prana (Sidecar) added Netflix OSS capabilities to non-JVM services with under 2ms p99 latency.

---

## Red Flags to Avoid

- "We should implement all microservices patterns" — pattern proliferation without governance creates chaos
- "Sidecars are always better than libraries" — ignores operational cost and latency; libraries are simpler for single-language shops
- "ACL everywhere" — only needed at genuine semantic boundaries, not every service-to-service call
- "Put it all in the API gateway" — thin gateways route/offload; business logic belongs in services; fat gateways become bottlenecks

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Design Pattern** | Proven structural solution to a recurring architectural problem |
| **Separation of Concerns** | Each component has exactly one, well-defined responsibility |
| **Sidecar** | Auxiliary process deployed alongside main app handling cross-cutting concerns |
| **Ambassador** | Proxy co-located with app handling outbound network complexity |
| **Anti-Corruption Layer (ACL)** | Translation boundary preventing external model pollution |
| **Backends for Frontends (BFF)** | Client-specific backend services owned by frontend teams |
| **Strangler Fig** | Incremental legacy migration by gradually routing traffic to new system |
| **External Config Store** | Centralized configuration service allowing runtime changes |
| **Gateway Patterns** | Aggregation (merge calls), Offloading (centralize cross-cutting), Routing (traffic splitting) |
| **Operational Maturity** | Team's ability to deploy, monitor, debug, and operate complex infrastructure |
| **Architectural Decision Record (ADR)** | Document recording which pattern is used, why, and what alternatives were considered |
| **Ubiquitous Language** | Domain-Driven Design term: shared vocabulary used by developers and domain experts |
| **Bounded Context** | DDD boundary where a specific domain model and ubiquitous language apply |
