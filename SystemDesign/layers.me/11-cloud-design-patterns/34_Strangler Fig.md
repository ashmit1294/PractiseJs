# 34 — Strangler Fig Pattern

> **Module**: M11 — Cloud Design Patterns  
> **Section**: Design & Implementation Patterns  
> **Source**: https://layrs.me/course/hld/11-cloud-design-patterns/strangler-fig  
> **Difficulty**: Intermediate | 29 min read

---

## 1. ELI5 — Explain Like I'm 5

You're renovating your house while still living in it. You can't move out for a year, so you renovate one room at a time — kitchen first, then living room, then bedrooms. You sleep and cook throughout. When every room is done, the old house is gone and a new one stands in its place.

The **Strangler Fig** pattern does the same for software — you replace a legacy system piece by piece while it keeps running, until the old system is fully "strangled" and replaced.

---

## 2. The Analogy

A strangler fig is a tropical plant that grows around a host tree. Over years, it wraps the tree, takes root, and eventually the host tree dies — leaving only the fig. The old tree is replaced without anyone pulling it out; the new plant simply takes over gradually.

In software: the legacy system is the host tree. The new implementation is the strangler fig. A **routing layer** (the facade) sits in front of both. As more features migrate to the new system, the old one shrinks. Eventually you decommission the legacy system entirely.

---

## 3. Core Concept

**Strangler Fig** is a migration strategy for modernizing legacy systems **incrementally** — building new functionality alongside a running legacy system using a routing layer, then gradually shifting traffic.

### Three Phases:
1. **Transform** — Build new capability alongside legacy (0% traffic to new)
2. **Coexist** — Route traffic gradually from legacy to new (1% → 100%)
3. **Eliminate** — Decommission legacy system when 100% migrated

### Key Properties:
- **No "migration day"** — changes are continuous and incremental
- **Reversible at every step** — can route back to legacy instantly
- **Business continuity** — the system never goes offline during migration
- Named by Martin Fowler (2004), inspired by the botanical strangler fig plant

---

## 4. ASCII Architecture

### Phase Overview

```
Phase 1: Transform
  Client → [Routing Facade] → [LEGACY system] (100%)
                          ↘  [NEW service] (0%, built but idle)

Phase 2: Coexist (gradual shift)
  Client → [Routing Facade] → [LEGACY] (80%)
                          ↘  [NEW]    (20%, dual-write active)

Phase 3: Eliminate
  Client → [Routing Facade] → [NEW]    (100%)
                               [LEGACY] (decommissioned)
```

### Traffic Rollout Timeline

```
Week 1:  ████░░░░░░ 5%  → new
Week 2:  ████████░░ 10% → new
Week 4:  ██████████ 25% → new
Week 8:  ████████████ 50% → new
Week 12: ████████████████ 100% → new (legacy decommissioned later)
```

### Data Sync During Coexistence

```
                ┌──── Dual Write ────┐
App Write ──→  [Legacy DB]     [New DB]
                     │               │
                     └── CDC/Stream ─┘
                    Reconciliation Job
                   (detects discrepancies)
```

---

## 5. How It Works

### Step-by-Step

**Step 1: Deploy the Routing Layer**
- Reverse proxy, API gateway, or application router in front of legacy
- 100% of traffic passes through to legacy — validates routing layer itself causes no issues
- Netflix used Zuul as this facade during AWS migration

**Step 2: Identify Migration Candidates**
- Prioritize: bounded domain, low risk, high value
- Good first: read-heavy features with clear boundaries (product catalog, user profiles)
- Bad first: deeply coupled transactional workflows, authentication, payments

**Step 3: Build New Implementation**
- Full feature parity with legacy including edge cases
- Comprehensive tests validating identical behavior
- GitHub spent months ensuring Spanner matched MySQL behavior before routing traffic

**Step 4: Dual-Write / Data Sync**
- Application writes to BOTH legacy and new datastores
- OR use Change Data Capture (CDC) to stream legacy changes to new DB
- Goal: new system has all data it needs to serve requests

**Step 5: Route Traffic Incrementally**
- Start at 1–5%, use feature flags or routing rules (user ID hash, geography, tier)
- Increase: 5% → 10% → 25% → 50% → 100%
- Pause and validate at each stage before going further

**Step 6: Validate and Monitor**
- Compare responses from legacy vs new (shadow mode)
- Track: error rates, latency p50/p99, data consistency, business KPIs
- Set alerts on discrepancies; auto-rollback if error threshold exceeded

**Step 7: Decommission Legacy**
- Once 100% traffic flows to new AND validated over weeks/months
- Remove routing logic for that feature, delete old code, shut down infrastructure
- Shopify took 5 years to fully migrate; each step reduced monolith footprint

**Step 8: Repeat**
- Move to next feature/module; earlier migrations build tooling that accelerates later ones

---

## 6. Variants / Types

### 1. Proxy-Based Strangler (Infrastructure Layer)
- **How**: NGINX, Envoy, or API Gateway routes by URL pattern or header
- **When to use**: Migrating between different tech stacks (PHP → Node.js)
- **Pros**: Tech-agnostic, clean separation, easy to monitor
- **Cons**: Limited to request-level routing, can't route on business logic
- **Example**: Route `/api/products/*` to new Node.js service, rest to PHP legacy

### 2. Application-Level Strangler (Code Layer)
- **How**: Feature flags or conditional logic within application code
- **When to use**: Migrating within same codebase, business-logic-based routing (user ID % 10)
- **Pros**: Fine-grained control, no extra infrastructure
- **Cons**: Routing logic couples to app code, creates complex conditionals

### 3. Event-Driven Strangler (Async Layer)
- **How**: Legacy publishes events to Kafka/EventBridge; new service consumes and builds its own state
- **When to use**: Async/event-driven systems, avoiding tight coupling
- **Pros**: Loose coupling, natural fit for event-driven architectures
- **Cons**: Eventual consistency, complex event schema evolution

### 4. Database-Level Strangler (Data Layer)
- **How**: CDC streams legacy DB changes to new DB; app gradually shifts reads/writes
- **When to use**: Primary challenge is data migration (SQL → NoSQL, on-prem → cloud)
- **Pros**: Focuses on the hardest part (data); enables independent app/data migration
- **Example**: PostgreSQL → DynamoDB using AWS DMS for continuous replication

### 5. Branch by Abstraction (Code Refactoring)
- **How**: Add interface in code; implement with legacy first; then add new impl; switch gradually
- **When to use**: Library/framework replacement within single codebase (old ORM → new ORM)
- **Pros**: Type-safe routing, compiler helps, clear abstraction
- **Cons**: Requires changes throughout codebase, tedious for large systems

---

## 7. Trade-offs

### Gradual Migration vs. Big-Bang Rewrite

| Factor | Strangler Fig | Big-Bang Rewrite |
|--------|--------------|-----------------|
| Risk | Low (incremental validation) | High (all-or-nothing) |
| Timeline | 1–5 years | 12–18 months (usually 2–3× over) |
| Feature velocity | Continuous delivery throughout | Halted during rewrite |
| Rollback | Easy (route back to legacy) | Very difficult |
| Business impact | Minimal | Revenue risk if rewrite fails |

### Proxy vs. App-Level Routing

| Factor | Proxy-Based | App-Level |
|--------|-------------|-----------|
| Routing granularity | Request attributes (URL, headers) | Business logic (user type, account tier) |
| Coupling | No coupling to app code | Routing logic in application |
| Visibility | Centralized, easy to monitor | Scattered across codebase |
| Use case | Tech stack migration | Feature flag rollout within codebase |

### Dual-Write vs. CDC

| Factor | Dual-Write | CDC |
|--------|-----------|-----|
| Consistency | Strong (immediate) | Eventual (seconds–minutes lag) |
| App changes required | Yes | No |
| Complexity | Transaction handling needed | Replication pipeline needed |
| Best for | Critical paths, strong consistency | Bulk data, avoiding app changes |

---

## 8. When to Use / When to Avoid

### ✅ Use Strangler Fig When:
- Migrating a live revenue-generating system that cannot afford downtime
- Moving from monolith to microservices incrementally
- Migrating to cloud from on-premises
- Replacing legacy databases (MySQL → Spanner)
- Your team can maintain momentum over months/years
- You need continuous feature delivery during migration

### ❌ Avoid When:
- Legacy system is **truly unsalvageable** — security vulnerabilities, nobody understands it, can't be safely kept running
- Building something **fundamentally different** (e.g., monolithic desktop app → SaaS with different user model — feature parity doesn't apply)
- **Small system** (<5,000 LOC) where dual-system overhead exceeds rewrite effort
- Business requirements have changed so much that feature parity with legacy **doesn't serve users**
- **Organizational discipline is absent** — team can't maintain momentum over months

---

## 9. MERN Dev Notes (Node.js / Express)

### Express Router as Strangler Fig Facade

```javascript
// routing-facade.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const FeatureFlags = require('./featureFlags');

const app = express();

// Feature flag-based traffic split
function routeRequest(req, res, next) {
  const userId = req.user?.id || req.headers['x-user-id'];
  const isNewService = FeatureFlags.isEnabled('new-product-service', userId);
  
  if (isNewService) {
    req.headers['x-routed-to'] = 'new';
    return next(); // fallthrough to new service proxy
  }
  
  // Route to legacy
  req.headers['x-routed-to'] = 'legacy';
  legacyProxy(req, res);
}

// Legacy proxy (existing monolith)
const legacyProxy = createProxyMiddleware({
  target: process.env.LEGACY_URL,
  changeOrigin: true,
  onProxyRes: (proxyRes, req) => {
    // Log for comparison
    console.log(`[legacy] ${req.method} ${req.path} → ${proxyRes.statusCode}`);
  }
});

// New service proxy
const newServiceProxy = createProxyMiddleware({
  target: process.env.NEW_SERVICE_URL,
  changeOrigin: true,
  onProxyRes: (proxyRes, req) => {
    console.log(`[new] ${req.method} ${req.path} → ${proxyRes.statusCode}`);
  }
});

// Product routes with gradual rollout
app.use('/api/products', routeRequest, newServiceProxy);

// All other routes still go to legacy
app.use('/', legacyProxy);
```

### Feature Flag with Percentage Rollout

```javascript
// featureFlags.js
class FeatureFlags {
  static rolloutPercentage = {
    'new-product-service': 10, // 10% of users
  };

  static isEnabled(flag, userId) {
    const percentage = this.rolloutPercentage[flag] ?? 0;
    if (percentage === 0) return false;
    if (percentage === 100) return true;
    
    // Deterministic: same user always gets same bucket
    const bucket = this._hashUser(userId) % 100;
    return bucket < percentage;
  }

  static _hashUser(userId) {
    let hash = 0;
    const str = String(userId);
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
```

### Dual-Write Pattern (MongoDB + New DB)

```javascript
// dual-write.js
async function createOrder(orderData) {
  // Write to legacy (MongoDB monolith)
  const legacyOrder = await LegacyOrderModel.create(orderData);

  // Attempt write to new service
  try {
    await newOrderService.createOrder({
      ...orderData,
      legacyId: legacyOrder._id.toString()
    });
  } catch (err) {
    // Log failure but don't fail the request
    // Legacy is source of truth during coexistence
    console.error('[dual-write] Failed to write to new service:', err.message);
    metrics.increment('dual_write_failure', { service: 'order' });
  }

  return legacyOrder;
}
```

### Shadow Mode (Compare Responses)

```javascript
// shadow-mode.js
async function shadowRequest(req, legacyHandler, newHandler) {
  // Execute legacy (blocking — this is the real response)
  const legacyResult = await legacyHandler(req);

  // Execute new (non-blocking — for comparison only)
  newHandler(req)
    .then(newResult => compareResponses(legacyResult, newResult, req.path))
    .catch(err => metrics.increment('shadow_error', { path: req.path }));

  return legacyResult; // Return legacy result to client
}

function compareResponses(legacy, newResult, path) {
  const match = JSON.stringify(legacy) === JSON.stringify(newResult);
  metrics.increment('shadow_comparison', {
    path,
    matched: match ? 'yes' : 'no'
  });
  if (!match) {
    console.warn(`[shadow] Mismatch at ${path}`, {
      legacy: legacy,
      new: newResult
    });
  }
}
```

---

## 10. Real-World Examples

### Shopify — Rails Monolith → Microservices (2015–2020)
- Monolith grew to millions of LOC, hard to scale
- Used Strangler Fig over **5 years**; started with **gift cards** (clear bounded domain)
- Built internal tool "Resiliency" that auto-compared monolith vs. new service responses
- Grew from $100M → $1B+ revenue during migration — proving you can modernize while scaling
- Key: treated migration as a **product** with dedicated teams and metrics

### Netflix — Datacenter → AWS (2008–2016)
- Major DB corruption in 2008 triggered cloud migration decision
- Used **Zuul** as routing facade between datacenter and AWS
- Started with non-critical services (encoding, recommendations), ended with billing/streaming
- Ran hybrid for years with sophisticated traffic shaping
- Completedmigration in 2016; Netflix went from 20M → 200M subscribers during migration

### GitHub — MySQL → Google Cloud Spanner (2021–2023)
- Sharded MySQL infrastructure reaching scale limits at 100M+ repositories
- **Dual-write** to both MySQL and Spanner; background jobs compared data
- Ran in **shadow mode** for months, comparing query results for correctness
- Traffic shift: 1% → 5% → 10% → 50% → 100% over many months
- Maintained MySQL failback capability for months after 100% cutover
- Took 2+ years of patient, incremental work

---

## 11. Interview Cheat Sheet

### One-Liner
> "Strangler Fig is an incremental legacy migration strategy using a routing facade to gradually shift traffic from old to new while keeping the system live."

### When Interviewers Bring This Up:
- System design: "How would you migrate this monolith to microservices?"
- Tech debt: "How do you modernize a legacy system without risking downtime?"
- Migration strategy: "What's your approach to big system rewrites?"

### Key Points to Hit:
1. **Three phases**: Transform → Coexist → Eliminate
2. **Routing facade** controls traffic split (proxy, feature flags, or app-level)
3. **Data sync** is the hardest part: dual-write vs. CDC
4. **Gradual rollout**: 1% → 5% → 10% → 25% → 50% → 100%
5. **Shadow mode**: run both systems, compare responses before routing real traffic
6. **Rollback capability**: keep legacy alive and synced after 100% cutover
7. **Migration order**: start with low-risk, bounded features to build muscle

### Math: Timeline Estimation
```
Total Time = (features × avg_time_per_feature) / (team_size × parallel_factor)

Example: 40 features × 4 weeks / (6 engineers × 0.6 parallelism) ≈ 11 months
Add 20-30% buffer = 13–15 months realistic
```

### Blast Radius Calculation
```
Affected_Requests = Total_Requests × Traffic_% × (New_Error_Rate - Legacy_Error_Rate)

At 5% traffic, new system 2% error rate vs 0.1% legacy:
= 10M req/day × 0.05 × 0.019 = 9,500 extra failures/day
```

---

## 12. Red Flags + Keywords

### Red Flags to Avoid

❌ **"We'll do a big-bang rewrite in 6 months"**
→ Rewrites almost always take 2–3× longer, halt feature dev, risk catastrophic failure

❌ **"We'll migrate everything at once to avoid running two systems"**
→ Dual systems = cost of safe migration. Accepting this is the whole point

❌ **"We don't need monitoring, we'll just test thoroughly"**
→ Tests can't catch everything. Production traffic reveals edge cases tests miss

❌ **"We'll migrate the most critical features first"**
→ Critical = highest blast radius. Start with low-risk to build patterns and muscle

❌ **"Data migration is just copying the database"**
→ Data migration is 40–50% of the effort. Legacy DBs have years of quirks and implicit relationships

### Keywords / Glossary

| Term | Meaning |
|------|---------|
| **Strangler Fig** | Migration pattern: incremental replacement of legacy system |
| **Facade** | Routing layer in front of both legacy and new systems |
| **Big-Bang Rewrite** | Risky all-or-nothing replacement approach |
| **Shadow Mode** | Running both systems, comparing outputs without routing production traffic to new |
| **Dual-Write** | Writing to both legacy and new datastores simultaneously |
| **CDC** | Change Data Capture — streaming changes from legacy DB to new DB |
| **Feature Flag** | Runtime toggle to route specific users to new implementation |
| **Traffic Shift** | Percentage-based routing increase: 1% → 5% → 10% → 100% |
| **Blast Radius** | Scope of impact if the new system has bugs at a given traffic percentage |
| **Branch by Abstraction** | Code-level variant: introduce interface, implement with both old and new |
| **Coexistence Phase** | Period when both legacy and new systems run simultaneously |
| **Decommission** | Shutting down legacy system after 100% migration is validated |
