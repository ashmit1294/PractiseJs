# Health Monitoring

## ELI5
Your phone has a "Do Not Disturb" mode — it's alive (liveness) but not accepting calls (readiness). Kubernetes liveness probes check if a process is alive (if not, restart it). Readiness probes check if it is ready to serve traffic (if not, route traffic elsewhere without restarting).

## Analogy
A restaurant kitchen is "live" (the building exists, people are inside) but not "ready" (the chef is still prepping). You don't demolish the kitchen — you just don't send customers yet.

---

## Core Concept
**Health monitoring** determines whether a service instance is in a state to receive and handle traffic. It drives two critical decisions: restart dead instances and route traffic only to healthy instances.

---

## Liveness vs Readiness

```
┌────────────────────────────────────────────────────────────────┐
│   LIVENESS PROBE            │   READINESS PROBE                │
│   "/healthz"                │   "/ready"                       │
├─────────────────────────────┼──────────────────────────────────┤
│ "Is this process alive?"    │ "Can it serve traffic right now?"│
│                             │                                  │
│ Fail → RESTART pod          │ Fail → REMOVE from load balancer │
│                             │   (do NOT restart)               │
│ Shallow check only:         │ Deep check:                      │
│   - Process running?        │   - DB connection pool OK?       │
│   - Not in deadlock?        │   - Cache warmed up?             │
│   - Not OOM-killed?         │   - Startup finished?            │
│                             │   - Dependent services OK?       │
│ Response time: < 10ms       │ Response time: 50–200ms          │
│ Never checks dependencies   │ Checks all critical dependencies │
└─────────────────────────────┴──────────────────────────────────┘

⚠️  Never use same endpoint for both!
    If DB goes down, deep check fails liveness → restart loop
    (Restarting doesn't fix a DB problem)
```

---

## Health Check Types

```
1. SHALLOW (Liveness)    < 10ms
   ─────────────────────────────────────────────────
   GET /healthz → 200 OK immediately
   No external calls — hardcoded response
   Use for: detecting frozen/deadlocked processes

2. DEEP (Readiness)      50–200ms
   ─────────────────────────────────────────────────
   GET /ready → checks DB pool, cache, etc.
   Returns degraded status for soft dependencies
   Use for: routing decisions, startup completeness

3. SYNTHETIC (End-to-End)   1–5 min interval
   ─────────────────────────────────────────────────
   Automated transaction: "login → search → checkout"
   External probe from multiple geographic locations
   Use for: catching integration failures, SLA validation
```

---

## Health Check Response Format

```json
// GET /ready — Deep readiness check
{
  "status": "healthy",         // healthy | degraded | unhealthy
  "timestamp": "2024-01-15T14:32:00Z",
  "uptime_seconds": 86400,
  "checks": {
    "database": {
      "status": "healthy",
      "latency_ms": 3,
      "connection_pool": { "active": 12, "idle": 38, "max": 50 }
    },
    "redis_cache": {
      "status": "healthy",
      "latency_ms": 1,
      "hit_rate": 0.94
    },
    "surge_pricing_service": {
      "status": "degraded",    // ← soft dependency, still HEALTHY overall
      "latency_ms": 800,
      "message": "High latency but non-critical"
    }
  }
}
```

---

## Pull vs Push Models

```
PULL-BASED (Load Balancer / Kubernetes polling)
────────────────────────────────────────────────────────
  Load Balancer ──GET /healthz──► Service
  Every 5–30 seconds
  Load Balancer decides: include or exclude from pool
  
  Pros: Simple, LB controls timing
  Cons: Can be 30s stale; adds QPS load to service

PUSH-BASED (Service heartbeats to registry)
────────────────────────────────────────────────────────
  Service ──heartbeat──► Consul/Eureka/etcd
  Every 5–30 seconds
  Registry considers unhealthy if heartbeat missed >3×

  Pros: Service declares its own health
  Cons: Network partition = false evictions

PASSIVE / INFERRED (Traffic outcome, Envoy/Istio)
────────────────────────────────────────────────────────
  Sidecar proxy observes: "this backend returned 5 errors in 30s"
  Automatically ejects instance from rotation
  
  Pros: Zero probe overhead, uses real traffic
  Cons: Requires real traffic; detection lag
```

---

## Hysteresis (Prevents Flapping)

```javascript
class HealthStateMachine {
  constructor() {
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.healthy = true;
  }

  // Called on each health check result
  record(isSuccess) {
    if (isSuccess) {
      this.consecutiveFailures = 0;
      this.consecutiveSuccesses++;
      // Recover: require 3 successes before declaring healthy
      if (!this.healthy && this.consecutiveSuccesses >= 3) {
        this.healthy = true;
        console.log('Service recovered → back in rotation');
      }
    } else {
      this.consecutiveSuccesses = 0;
      this.consecutiveFailures++;
      // Fail: require 3 failures before declaring unhealthy (prevent flapping)
      if (this.healthy && this.consecutiveFailures >= 3) {
        this.healthy = false;
        console.log('Service unhealthy → removed from rotation');
      }
    }
  }
}

// 2-3 consecutive failures → unhealthy
// 2-3 consecutive successes → healthy
// Prevents a single blip from triggering rotation changes
```

---

## Health Check Overhead Calculation

```
QPS = N × F × C
  N = number of service instances
  F = check frequency (checks/second)
  C = number of checking agents (load balancers)

Example:
  N = 1,000 instances
  F = 0.1/s (every 10 seconds)
  C = 3 load balancers

  QPS = 1,000 × 0.1 × 3 = 300 health check requests/second
  CPU cost = 300 req/s × 50ms each = 15 CPU-equivalent cores

Deploy a dedicated lightweight health-check handler (not your full app stack).
```

---

## ASCII: Kubernetes Probe Lifecycle

```
POD STARTS
    │
    ▼
┌───────────────────────────────────────────────┐
│  initialDelaySeconds: 15s (wait for startup)  │
│  │                                            │
│  ▼                                            │
│  LIVENESS PROBE checks every 10s             │
│  3 failures → restart pod                    │
│                                               │
│  READINESS PROBE checks every 5s             │
│  1 failure  → remove from Service endpoints  │
│  1 success  → add back to endpoints          │
└───────────────────────────────────────────────┘

Startup sequence:
  0s ──────────────── 15s ──────────── 30s ──────────────
  [initializing]      [first probe]    [in rotation]
  (not in rotation)   (readiness fail) (readiness pass)
```

---

## Graceful Degradation

```json
// Uber surge pricing service down — DON'T fail the whole ride request
{
  "status": "healthy",          // still serving traffic
  "degraded_features": [
    "surge_pricing"             // not core, skip it
  ],
  "message": "Core ridematching operational; surge pricing unavailable"
}

// Health check hierarchy:
//   CRITICAL dependencies  → unhealthy if down (core DB, auth)
//   OPTIONAL dependencies  → degraded but healthy (surge pricing, recommendations)

// Rule: Only fail readiness if the instance CANNOT do its primary job
```

---

## Real-World Examples

| Company | Implementation | Key Detail |
|---|---|---|
| Kubernetes | Liveness + Readiness probes | `initialDelaySeconds` prevents premature restarts during slow startup |
| AWS ALB | Target group health checks | 2 consecutive successes/failures before state change (hysteresis) |
| Netflix Eureka | Self-preservation mode | If <85% of instances send heartbeats, stop evicting (network partition assumption) |
| Uber | Graduated health responses | Report `degraded` for non-critical services to allow partial functionality |

---

## Interview Cheat Sheet

**Q: What's the difference between liveness and readiness probes? Why does it matter?**

> A: Liveness = "Is this process alive?" — failure triggers a restart. Readiness = "Can it serve traffic?" — failure removes it from load balancer rotation but does NOT restart. The critical difference: if your DB goes down and your liveness probe checks the DB, every pod fails liveness → cascading restart loop. The DB is still down, all pods keep restarting, everything is worse. Liveness should only check if the process itself is alive (no deadlocks, not OOM); readiness checks whether it can handle requests.

**Q: How do you prevent a slow external dependency from causing a restart loop?**

> A: Never check slow/external dependencies in the liveness probe — only in readiness. If the dependency is optional, respond with `{"status":"degraded"}` in readiness but still return 200 OK to stay in rotation. Use explicit timeouts (50-100ms) on dependency checks in readiness probes so a slow dependency doesn't cause the probe to time out. Add circuit breakers around external dependency calls in health checks.

**Q: What is health check "flapping" and how do you prevent it?**

> A: Flapping is when a service rapidly alternates between healthy and unhealthy, causing it to be constantly added and removed from load balancer rotation — which disrupts active connections. Prevention: require N consecutive failures to mark unhealthy (typically 2-3), and M consecutive successes to mark healthy again. This is called hysteresis. AWS ALB does this by default with 2 threshold counts for both healthy/unhealthy transitions.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **Liveness probe** | Checks if a process is alive; failure triggers a pod/instance restart |
| **Readiness probe** | Checks if an instance can serve traffic; failure removes it from load balancer rotation |
| **Deep health check** | Checks all critical dependencies (DB, cache) — used for readiness |
| **Shallow health check** | Checks only the process itself, no external calls — used for liveness |
| **Hysteresis** | Requiring consecutive failures/successes before state change — prevents flapping |
| **Graceful degradation** | Continuing to serve core functionality even when optional dependencies are down |
| **Self-preservation mode** | Netflix Eureka: stop evicting instances when >15% are missing heartbeats (assumes network issue) |
| **Synthetic monitoring** | Automated transactions that simulate real user flows to verify end-to-end behavior |
| **Health status hierarchy** | healthy → degraded → unhealthy; degraded = running but with reduced capability |
| **Heartbeat** | Periodic signal sent by a service to indicate it is still alive |
