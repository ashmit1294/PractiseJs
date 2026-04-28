# 05 — Health Endpoint Monitoring

> **Module**: M12 — Reliability Patterns  
> **Section**: Section 1 — Resiliency Patterns  
> **Source**: https://layrs.me/course/hld/12-reliability-patterns/health-endpoint-monitoring  
> **Difficulty**: Intermediate | 15 min read

---

## 1. ELI5 — Explain Like I'm 5

Imagine if every shop had a sign in the window that said "Open" or "Closed" — not just for the front door, but also showing "kitchen working ✅, coffee machine ✅, cash register ✅." Then your delivery app could check that sign automatically and not send orders to a shop if the kitchen is down.

Health endpoint monitoring is that sign for your service: an API your load balancer and Kubernetes can check to know "can this service handle traffic right now?"

---

## 2. The Analogy

**Health Endpoints = A hospital triage system.**

- **Liveness check**: Is the doctor alive? (Is the process running at all?)
- **Readiness check**: Is the doctor available to see patients? (Can this instance accept traffic — is its database connected, medication system working?)
- **Startup check**: Is the doctor still getting dressed? (Is the service still initializing before it can see anyone?)

If a doctor fails liveness → they need to be replaced.  
If they fail readiness → remove them from the schedule, but don't fire them — they may recover.  
If they fail startup → give them more time to get ready before sending patients.

---

## 3. Core Concept

**Health Endpoint Monitoring** exposes standardized HTTP endpoints that external systems query to verify service health, enabling automated failure detection and traffic routing.

### Three Probe Types:

| Probe | Endpoint | Question | Failure Action |
|-------|----------|----------|----------------|
| **Liveness** | `/health/live` | Is the process alive? | Restart the pod/instance |
| **Readiness** | `/health/ready` | Can it accept traffic? | Remove from load balancer |
| **Startup** | `/health/startup` | Has initialization completed? | Wait (don't restart yet) |

### Response Codes:
- **200** → healthy (route traffic)
- **503** → unhealthy (stop routing)

### Key Rule: Never use the same endpoint for both liveness and readiness.
Using one endpoint for both causes Kubernetes to **restart** pods when a database goes down (readiness failure), rather than just removing them from rotation — creating restart loops.

---

## 4. ASCII Architecture

### Probe Type Decision Tree

```
What are you checking?
├── Is the process alive (no deadlock, no crash)?
│     → Liveness Probe /health/live
│       - HTTP server responds
│       - No thread deadlock
│       - Memory < warn threshold
│       - Response: < 50ms
│       - Frequency: every 10s
│       - Failure action: RESTART
│
├── Can this instance accept traffic?
│     → Readiness Probe /health/ready  
│       - Database connection pool has capacity
│       - Cache (Redis) responds within 100ms
│       - Queue (Kafka) reachable
│       - Disk space > 10%
│       - Response: < 500ms
│       - Frequency: every 5-10s
│       - Failure action: REMOVE FROM LB rotation
│
└── Has initialization finished?
      → Startup Probe /health/startup
        - DB migrations run
        - Config loaded
        - Caches warmed
        - Response: < 5s
        - Frequency: every 5s during startup only
        - Failure action: RESTART after timeout (e.g., 60s)
```

### Load Balancer Integration

```
LB polls every 5s → GET /health/ready
  Instance 1: 200 OK → in rotation
  Instance 2: 503 (3×) → removed from rotation
  Instance 3: 200 OK → in rotation

DB connection pool recovers on Instance 2:
  Instance 2: 200 OK (2×) → restored to rotation

Threshold config: fail after 3 consecutive failures; restore after 2 successes
```

---

## 5. How It Works

**Step 1: Implement Three Distinct Endpoints**
- `/health/live`: Minimal — verify HTTP server responds and critical threads aren't deadlocked (<50ms)
- `/health/ready`: Comprehensive — check DB, cache, queue with strict timeouts; aggregate with dependency policy
- `/health/startup`: Initialization — DB migrations done, config loaded, caches warmed (only during startup)

**Step 2: Aggregate Dependency Health**
- Run dependency checks in parallel (not sequential) to keep response time low
- Each check has a strict timeout: DB 100ms, Cache 50ms, Queue 100ms
- Use circuit breakers for each dependency: if CB is open → return `degraded` (known-bad, don't hammer it)
- Policy: all **critical** dependencies must be healthy; **optional** dependencies only warn

**Step 3: Configure Load Balancer**
- Poll readiness endpoint every 5-10s with a **2s timeout** (shorter than interval)
- Remove after **3-5 consecutive failures** (prevents flapping on transient network blips)
- Restore after **1-2 successes** (fast recovery when instance heals)

**Step 4: Graceful Degradation on Readiness Failure**
- When readiness fails: stop accepting new requests immediately; return 503 to LB
- Continue processing in-flight requests to completion
- Set maximum graceful shutdown: 30-60s, then forcibly terminate

**Step 5: Monitor Health Check Metrics**
- Track: check duration (P50/P99), failure rates by dependency, time-to-recovery
- Alert if: DB health checks spike from 10ms to 200ms across ALL instances (early DB degradation signal)
- Cross-correlate: if health checks fail but requests succeed → checks too sensitive; if requests fail but checks pass → checks too shallow

---

## 6. Variants

### Shallow vs Deep Health Checks
- **Shallow**: verify only the service's own health (process alive, no deadlock); <50ms; for **liveness probes**
- **Deep**: validate all dependencies; 200-500ms; for **readiness probes** at lower frequency (every 10-30s)
- Shallow catches crashes fast; deep provides full dependency picture

### Synchronous vs Asynchronous Health Checks
- **Synchronous**: run all validation when endpoint is called; always current; can block under load
- **Asynchronous**: background threads continuously run checks and cache results; endpoint returns instantly with last known status; can return stale if background check hangs
- Google uses async with 1-second refresh intervals → health endpoints return in <10ms even checking dozens of dependencies

### Binary vs Graduated Health Status
- **Binary** (200/503): simple for load balancers; either route or don't
- **Graduated** (healthy/degraded/unhealthy): route preferentially to healthy; use degraded when healthy capacity exhausted
- AWS ALB: binary only; Istio service mesh: graduated with weighted routing
- Use binary for simple deployments; graduated for fine-grained control during partial failures

---

## 7. Trade-offs

### Check Frequency vs System Load
- 1000 instances × 5 dependencies × every 2s = **2500 req/s per dependency**
- High-frequency (every 1-2s): sub-10s failure detection, but significant load on dependencies
- Low-frequency (every 30-60s): minimal load; acceptable for batch jobs; not user-facing services
- Best practice: 5-10s for readiness; 30-60s for deep dependency checks with cached async results

### Comprehensive vs Minimal Dependency Checks
- Comprehensive: validates all dependencies, complete picture, but tight coupling — your health depends on theirs
- Minimal: validates only critical path, fast (<100ms), independent — misses some issues
- Uber's approach: readiness checks validate only dependencies required for the **next request**, not all possible

### Fail-Fast vs Fail-Tolerant
- Fail-fast: return 503 immediately on any critical dependency failure → fast removal but can thrash
- Fail-tolerant: circuit breakers + grace period → stable but potentially serves degraded traffic longer
- Use fail-fast for financial transactions (correctness > availability)
- Use fail-tolerant for social feeds (availability > perfect correctness)

---

## 8. When to Use / When to Avoid

### ✅ Use When:
- Multiple service instances behind load balancers or Kubernetes (basically: always)
- Service has complex dependencies (DB, cache, downstream APIs)
- You need automated traffic routing without manual intervention
- Services restart frequently (Kubernetes, rolling deploys)

### ❌ Avoid / Anti-Patterns:
- **Don't check downstream service health endpoints** — creates dependency graph where one failure marks everything unhealthy
- **Don't perform expensive operations in health checks** (full DB scans, cache warming)
- **Don't use same endpoint for liveness and readiness** — causes restart loops during dependency failures
- **Don't set health check timeout ≥ interval** — slow checks pile up and exhaust resources
- **Don't ignore health check failures in dev** — they will fail in prod too

---

## 9. MERN Dev Notes

### Complete Health Check Implementation (Express + Node.js)

```javascript
const express = require('express');
const mongoose = require('mongoose');
const Redis = require('ioredis');

const app = express();
const redis = new Redis({ host: process.env.REDIS_HOST });

// Dedicated health check connection pool (separate from app pool)
// This prevents health checks from competing with app traffic for connections
const healthCheckMongoPool = mongoose.createConnection(process.env.MONGO_URI, {
  maxPoolSize: 2  // Small dedicated pool for health checks
});

// ──── LIVENESS PROBE ────
// Checks: HTTP server alive, no deadlock
// Almost never fails — only if process is truly broken
app.get('/health/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    ts: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ──── READINESS PROBE ────
// Checks: DB, Redis, disk space
// Must complete within 500ms (Kubernetes default readiness deadline)
app.get('/health/ready', async (req, res) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkDiskSpace()
  ]);
  
  const results = {
    database: checks[0].status === 'fulfilled' ? checks[0].value : { status: 'unhealthy', error: checks[0].reason?.message },
    cache:    checks[1].status === 'fulfilled' ? checks[1].value : { status: 'unhealthy', error: checks[1].reason?.message },
    disk:     checks[2].status === 'fulfilled' ? checks[2].value : { status: 'unhealthy', error: checks[2].reason?.message }
  };
  
  // Policy: database is critical; others are optional
  const isCriticalHealthy = results.database.status === 'healthy';
  const httpStatus = isCriticalHealthy ? 200 : 503;
  
  res.status(httpStatus).json({
    status: isCriticalHealthy ? 'ready' : 'not_ready',
    ts: new Date().toISOString(),
    checks: results
  });
});

// ──── STARTUP PROBE ────
// Checks: migrations run, config loaded, no extra initialization pending
let startupComplete = false;

app.get('/health/startup', (req, res) => {
  if (startupComplete) {
    return res.status(200).json({ status: 'started' });
  }
  res.status(503).json({ status: 'initializing' });
});

// Mark startup complete after caches warm, migrations run
async function bootstrap() {
  await runMigrations();
  await warmCaches();
  startupComplete = true;
}

// ──── Check Helpers ────

async function checkDatabase() {
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('DB timeout')), 100));
  await Promise.race([healthCheckMongoPool.db.admin().ping(), timeout]);
  return { status: 'healthy', latencyMs: Date.now() };
}

async function checkRedis() {
  const start = Date.now();
  await Promise.race([
    redis.ping(),
    new Promise((_, rej) => setTimeout(() => rej(new Error('Redis timeout')), 50))
  ]);
  return { status: 'healthy', latencyMs: Date.now() - start };
}

async function checkDiskSpace() {
  const { execSync } = require('child_process');
  const out = execSync("df / | awk 'NR==2{print $5}'").toString().trim();
  const usedPct = parseInt(out, 10);
  if (usedPct > 90) return { status: 'degraded', usedPercent: usedPct };
  return { status: 'healthy', usedPercent: usedPct };
}
```

### Kubernetes Probe Configuration

```yaml
# deployment.yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 2        # Must be < periodSeconds
  failureThreshold: 3      # Restart after 3 consecutive failures

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 2
  failureThreshold: 3      # Remove from LB after 3 failures
  successThreshold: 2      # Restore after 2 successes (default: 1)

startupProbe:
  httpGet:
    path: /health/startup
    port: 3000
  periodSeconds: 5
  failureThreshold: 12     # Up to 60s to start (12 × 5s)
  timeoutSeconds: 3
```

---

## 10. Real-World Examples

### LinkedIn — Separate Health Check Connection Pools
- Readiness checks: validate DB connection pool, Kafka producer health, downstream circuit breaker states
- **Lesson learned (incident)**: health checks competed with app traffic for DB connections → health checks failed → instances removed → concentrated load → cascade
- Fix: dedicated health check connection pool (10% of total pool size) with separate credentials
- LB threshold: 3 consecutive failures before removal, 1 success for restore
- **Startup probe insight**: new code versions took 30s to warm caches → health checks failed → rollback triggered before service was ready. Solution: startup probes with 60s timeout, separate from 10s readiness checks

### Netflix (Eureka) — Push-Based Health + Self-Preservation Mode
- Services push health status to Eureka registry every 30s (vs Eureka polling)
- Rich health payload: overall health + per-dependency health + load metrics + capability flags (read-only? writes ok? cached data available?)
- **Self-preservation mode**: if >15% of all instances fail health checks simultaneously → assume **the health checks are broken**, NOT the services → continue routing traffic to all instances
- Prevents: monitoring system failure → marks everything unhealthy → zero traffic

### Stripe — Weighted Dependency Health + Grace Period
- Health check SLA: liveness <50ms, readiness <200ms (failures if exceeded)
- Weighted health score: critical dependency (DB) = weight 1.0; optional (analytics) = weight 0.3
- Instance marked healthy only if weighted sum of healthy dependencies > 0.8
- **Grace period insight**: DB failover takes 10-15s → health checks failed immediately → all instances removed. Fix: return last-known healthy status for 30s after critical dependency failure → reduced unnecessary instance removals by 80% during maintenance

---

## 11. Interview Cheat Sheet

### One-Liner
> "Health endpoint monitoring exposes `/health/live` (is process alive?), `/health/ready` (can accept traffic?), and `/health/startup` (finished initializing?) for automated load balancer and orchestrator decisions. Run dependency checks in parallel with strict timeouts and use circuit breakers to prevent health checks from overwhelming failed dependencies."

### Numbers to Know:
- LB poll interval: **5-10s** for readiness
- Remove after: **3-5 consecutive failures** (prevents transient-blip flapping)
- Restore after: **1-2 successes** (fast recovery)
- Health check timeout: **< poll interval** (e.g., 2s timeout on 5s interval)
- Liveness response: **< 50ms** | Readiness response: **< 500ms**
- DB check timeout: **100ms** | Cache check timeout: **50ms**
- Startup failureThreshold × periodSeconds = max startup window (e.g., 12 × 5s = 60s)

### Critical Distinction (Interviewers Ask):
| | Liveness | Readiness |
|--|--|--|
| Checks | Process is alive | Can accept traffic |
| Response | <50ms | <500ms |
| Failure action | **Restart** the pod | **Remove from LB** only |
| Frequency | Every 10s | Every 5-10s |
| Fails when | Thread deadlock, OOM | DB down, cache unavailable |

---

## 12. Red Flags + Keywords

### Red Flags to Avoid

❌ **"Same endpoint for liveness and readiness"** — DB going down → liveness fails → pod restarts → DB still down → infinite restart loop

❌ **"Health checks validate downstream health endpoints"** — Creates dependency cascade; validates reachability only, not downstream health

❌ **"Health check timeout ≥ poll interval"** — Slow checks pile up, exhausting threads; timeout must be shorter than interval

❌ **"Health checks perform DB scans or cache warming"** — Must be lightweight; verify responsiveness, not performance

❌ **"One check threshold for all dependencies"** — Critical vs optional dependencies need different policies (all-critical-must-pass vs warn-on-optional-fail)

### Keywords / Glossary

| Term | Meaning |
|------|---------|
| **Liveness Probe** | Checks if process is alive; failure triggers restart |
| **Readiness Probe** | Checks if instance can accept traffic; failure removes from LB |
| **Startup Probe** | Checks if initialization is complete; prevents premature restarts during slow starts |
| **Shallow Check** | Validates service's own health only (<50ms); for liveness |
| **Deep Check** | Validates all dependencies; 200-500ms; for readiness |
| **Binary Health** | Two states: healthy (200) or unhealthy (503) |
| **Graduated Health** | Multiple states: healthy/degraded/unhealthy with weighted routing |
| **Graceful Degradation** | Return cached/partial data when non-critical dependencies fail |
| **Self-Preservation Mode** | Eureka pattern: if too many instances fail simultaneously, assume monitors are broken |
| **Grace Period** | Time window to return last-known-healthy status while dependency failovers |
| **Thundering Herd** | All instances retry failed health dependencies simultaneously → further overloads them |
| **Flapping** | Instance rapidly oscillates between healthy/unhealthy; prevented by failure threshold |
| **Dedicated Health Check Pool** | Separate connection pool for health checks to avoid competing with app traffic |
| **Asynchronous Health Check** | Background thread runs checks continuously, endpoint returns cached latest result |
| **Failure Threshold** | Number of consecutive failures before removal from rotation |
| **Success Threshold** | Number of consecutive successes to restore instance to rotation |
