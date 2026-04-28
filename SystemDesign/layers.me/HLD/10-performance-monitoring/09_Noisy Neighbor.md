# Noisy Neighbor

## ELI5
In an apartment building, one tenant plays bass music at 3 AM. Everyone else can't sleep. That's the noisy neighbor problem in cloud infrastructure — one tenant monopolizes shared CPU, memory, or network, degrading service for all other tenants on the same host.

## Analogy
A shared highway with no lanes: one truck carrying 50 tons blocks everyone. The solution is dedicated lanes (isolation tiers) and per-vehicle speed limits (rate limiting / quotas).

---

## Core Concept
**Noisy Neighbor** occurs in multi-tenant systems when one tenant's resource consumption negatively impacts other tenants sharing the same infrastructure. More subtle than a single point of failure — the system is still "up" but SLAs are violated for other tenants.

### Why It's Hard to Debug
```
Symptom:  User A complains of high latency at 2 PM
Root cause: User B ran a batch job at 2 PM, maxing CPU on shared host
Detection: Without per-tenant metrics, you only see aggregate system metrics

Requires:  Per-tenant CPU/memory/query-time attribution
           (tagging through entire stack: API gateway → app → DB)
```

---

## Detection Strategy

```
Every metric must be tagged with tenant_id:

Metric                         Tagging
─────────────────────────────  ───────────────────────────────
api_request_duration           tenant_id, endpoint, method
db_query_duration              tenant_id, query_type
cache_hit_rate                 tenant_id
cpu_seconds_used               tenant_id (via eBPF or cgroup tagging)

Alert example:
  Single tenant using > 80% CPU for > 2 minutes → Noisy Neighbor alert
  "Tenant X consuming 40× their fair share of I/O bandwidth"
```

---

## Mitigation Layers

### 1. Rate Limiting (Application Layer)
```javascript
// Token bucket: 100 req/s for standard, 10,000 req/s for premium
const tokens = new Map();  // per tenant token bucket

function rateLimit(tenantId, tier) {
  const limits = { standard: 100, premium: 10000 };
  const limit = limits[tier] || limits.standard;

  let bucket = tokens.get(tenantId) || { tokens: limit, lastRefill: Date.now() };

  // Refill based on elapsed time
  const elapsed = (Date.now() - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(limit, bucket.tokens + elapsed * limit);
  bucket.lastRefill = Date.now();

  if (bucket.tokens < 1) {
    return { allowed: false, retryAfter: Math.ceil(1 / limit * 1000) };
  }
  bucket.tokens -= 1;
  tokens.set(tenantId, bucket);
  return { allowed: true };
}

// Express middleware
app.use((req, res, next) => {
  const { allowed, retryAfter } = rateLimit(req.tenantId, req.tenantTier);
  if (!allowed) {
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  next();
});
```

### 2. Resource Quotas (Infrastructure Layer)
```yaml
# Kubernetes: Resource limits per tenant namespace
apiVersion: v1
kind: LimitRange
metadata:
  name: tenant-limits
  namespace: tenant-abc  # per-tenant namespace
spec:
  limits:
  - type: Container
    max:
      cpu: "2000m"        # 2 CPU cores max
      memory: "4Gi"       # 4GB RAM max
    default:
      cpu: "500m"
      memory: "512Mi"
```

```
cgroups (Linux) enforce resource limits at kernel level:
  cpu.cfs_quota_us: max CPU microseconds per period
  memory.limit_in_bytes: hard memory limit → OOM kill if exceeded
  io.max: I/O throttle (bytes/sec per device)
```

### 3. Database Quotas
```sql
-- PgBouncer: per-tenant connection limits
[tenantA]
pool_size = 10           -- max 10 connections for tenant A
pool_mode = transaction

-- PostgreSQL: per-user resource limits
ALTER USER tenant_a_user SET work_mem = '64MB';     -- limit sort memory
ALTER USER tenant_a_user CONNECTION LIMIT 10;        -- max connections
```

### 4. Circuit Breaker (Per Tenant)
```javascript
// Open circuit after 10 violations in 60s window
class TenantCircuitBreaker {
  constructor(tenantId, maxViolations = 10, windowMs = 60000) {
    this.tenantId = tenantId;
    this.violations = [];
    this.maxViolations = maxViolations;
    this.windowMs = windowMs;
    this.openUntil = null;
  }

  recordViolation() {
    const now = Date.now();
    this.violations = this.violations.filter(t => now - t < this.windowMs);
    this.violations.push(now);
    if (this.violations.length >= this.maxViolations) {
      this.openUntil = now + 300_000;  // open for 5 minutes
    }
  }

  isOpen() {
    return this.openUntil && Date.now() < this.openUntil;
  }
}
```

---

## Isolation Tiers (Cost vs SLA Trade-off)

```
Tier              Shared Pool with Quotas  Pooled Isolation     Complete Isolation
──────────────── ─────────────────────────  ──────────────────  ──────────────────────
Cost/tenant/mo    $1                         $5-10               $100+
Resource util     85%                        60%                 25%
SLA               99%                        99.5-99.9%          99.95%+
LTV threshold     < $1K                      $1K-$10K            > $10K
Infrastructure    All on shared hosts        Dedicated DB/pool   Separate cluster
Cross-tenant      Possible                   Reduced             Eliminated
  impact
```

---

## Quota Types

```
Hard Quota:    Reject immediately when limit reached
               → HTTP 429, fail fast

Soft Quota:    Allow bursting above limit temporarily
               Token bucket with burst capacity:
               "100 req/s sustained, burst to 200 for 5s"

Adaptive:      Dynamically tighten at high system load
               At CPU > 80%: reduce all tenant quotas to 50%
               At CPU < 50%: restore normal quotas
```

---

## ASCII: Noisy Neighbor + Isolation

```
WITHOUT ISOLATION (Noisy Neighbor)
──────────────────────────────────────────────────────────
  Tenant A (batch job)  [████████████████████████] 80% CPU
  Tenant B (normal)     [████                      ] 20% CPU ← SLA violated!
  Tenant C (normal)     [                           ]  0% CPU ← starved!

  Shared Host CPU: 100% → Tenants B, C see 5x normal latency

WITH TOKEN BUCKET + K8s LIMITS
──────────────────────────────────────────────────────────
  Tenant A (batch job)  [████████                  ] 30% CPU (quota enforced)
  Tenant B (normal)     [████████                  ] 30% CPU ← SLA met ✓
  Tenant C (normal)     [████████                  ] 30% CPU ← SLA met ✓

  Shared Host CPU: 90% → Fair share enforced
```

---

## MERN Developer Notes

```javascript
// Multi-tenant Express app with per-tenant rate limiting
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

// Tier-based limits using Redis
const createRateLimiter = (tier) => {
  const limits = { free: 60, pro: 600, enterprise: 6000 };  // per minute
  return rateLimit({
    windowMs: 60 * 1000,
    max: limits[tier] || limits.free,
    keyGenerator: (req) => req.user.tenantId,  // per-tenant key
    store: new RedisStore({ client: redis }),   // distributed (multi-server)
    handler: (req, res) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
      });
    }
  });
};

// Apply tier-specific limiter per route
app.use((req, res, next) => {
  const limiter = createRateLimiter(req.user.tier);
  limiter(req, res, next);
});
```

---

## Real-World Examples

| Company | Problem | Detection | Fix | Result |
|---|---|---|---|---|
| Netflix | 5% of containers using 40% of I/O bandwidth (excessive logging) | eBPF kernel-level attribution | Sampling: 1% log rate for offending services | Evened out I/O across fleet |
| Stripe | Black Friday: large merchants monopolizing shared infra | Per-merchant metrics | K8s clusters per merchant tier; dynamic upgrade during events | 99.95% SLA for enterprise tier |
| Google Cloud SQL | One query from tenant A slowing all tenants on same instance | cgroups + query timeout attribution | Automatic time limits + isolation for premium | P99 -60% |

---

## Interview Cheat Sheet

**Q: How do you detect a noisy neighbor without per-tenant metrics?**

> A: You can't reliably. The first step is adding tenant_id as a dimension to all metrics (API latency, DB query time, CPU seconds). Use eBPF for kernel-level attribution when you need to go below the application layer. Without per-tenant tagging, you only see aggregate system metrics — you know something is wrong but not which tenant caused it.

**Q: Explain token bucket rate limiting vs. fixed window rate limiting.**

> A: Fixed window: count requests in each time window (e.g., 100 per minute). Simple but allows 2× burst at window boundaries (100 at end of window 1 + 100 at start of window 2 = 200 in 1 second). Token bucket: bucket holds N tokens, refills at rate R. Each request costs 1 token. Allows natural bursting up to bucket size, but sustained rate is capped at refill rate. More sophisticated and burst-friendly.

**Q: What's the trade-off between isolation tiers?**

> A: Shared pool ($1/mo): 85% resource utilization but tenants affect each other. Pooled isolation ($5-10/mo): dedicated DB and app pool per tier, 60% utilization, noisy neighbor reduced. Complete isolation ($100+/mo): separate cluster per tenant, 25% utilization (paying for headroom), zero cross-tenant impact, 99.95%+ SLA. The decision is LTV-driven: complete isolation makes economic sense when tenant LTV exceeds the infrastructure cost.

**Q: A large enterprise tenant is slowing down all other tenants. Immediate fix?**

> A: Immediate: apply rate limiting to that tenant's API calls (HTTP 429 with Retry-After). Short-term: move them to a dedicated pool (separate DB connections, dedicated app instances). Long-term: offer them a dedicated tier with SLA pricing. This is the business model of tiered SaaS.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **Noisy Neighbor** | One tenant's resource consumption degrading other tenants in shared infrastructure |
| **Multi-tenancy** | Multiple customers (tenants) sharing the same infrastructure |
| **Token bucket** | Rate limiting algorithm: bucket refills at fixed rate; requests consume tokens |
| **cgroups** | Linux control groups — kernel-enforced resource limits (CPU, memory, I/O) |
| **Resource quota** | Hard limit on how much of a resource a tenant can consume |
| **Burst capacity** | Allowance to exceed normal quota temporarily (within token bucket capacity) |
| **Adaptive quota** | Quota that tightens automatically when overall system is under high load |
| **eBPF** | Extended Berkeley Packet Filter — kernel-level observability with minimal overhead |
| **Tenant isolation tier** | Shared pool / pooled isolation / complete isolation — progressively stronger separation |
| **Fair share scheduling** | Distributing resources proportionally among tenants based on their quotas |
