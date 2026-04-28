# Visualization and Alerts

## ELI5
A dashboard shows your system's health like a car's instrument cluster. The speedometer (requests/second), fuel gauge (queue depth), temperature (CPU), and warning lights (alerts) — each tells a different story. Alerts are the warning lights: only turn on when something needs immediate attention, not for every bump in the road.

## Analogy
Air traffic control uses different displays for different roles: radar screens for controllers (real-time, high density), simple status boards for airlines (availability summary), and historical graphs for analysts (trend analysis). Same data, different views for different audiences.

---

## Core Concept
**Visualization and alerts** transform raw metrics, logs, and traces into actionable information. Dashboards are for investigation; alerts are for intervention. Good alerts wake people up for the right reason; bad alerts cause fatigue and get ignored.

---

## Service vs Resource Metrics

```
RED METHOD (Services — what the service does for users)
─────────────────────────────────────────────────────────────────
  R — Rate:    Requests per second (throughput)
  E — Errors:  Error rate (% of requests failing)
  D — Duration: Latency distribution (p50, p95, p99)

USE METHOD (Resources — what the infrastructure consumes)
─────────────────────────────────────────────────────────────────
  U — Utilization: % time resource is busy (CPU %, disk bandwidth %)
  S — Saturation:  Queue depth, pending work (DB connection wait queue)
  E — Errors:      Device errors, dropped packets

Apply RED to: HTTP APIs, databases (as service), message queues (throughput)
Apply USE to: CPUs, memory, disks, network interfaces, thread pools
```

---

## The Alert Pyramid

```
WHAT TO ALERT ON vs INVESTIGATE IN DASHBOARDS:

                        ┌───────────────────────┐
                        │   USER IMPACT (ALERT) │  PAGE ON-CALL
                        │  "Error rate > 1%"    │
                        │  "Checkout unavail."   │
                        ├───────────────────────┤
                        │  APPLICATION (TICKET) │  INVESTIGATE
                        │  "API p99 > 500ms"    │
                        │  "DB query slow"       │
                        ├───────────────────────┤
                        │   INFRASTRUCTURE      │  DASHBOARD ONLY
                        │  (CPU, memory, disk)  │  Never page on this
                        │  "CPU at 75%"          │
                        └───────────────────────┘

RULE: Alert on SYMPTOMS (checkout broken) not CAUSES (CPU high).
      A user can't check out = page someone.
      CPU at 80% with happy users = just a dashboard metric.
```

---

## Dashboard Types by Audience

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ AUDIENCE          │ DASHBOARD TYPE  │ METRICS              │ UPDATE FREQ   │
├───────────────────┼─────────────────┼──────────────────────┼───────────────┤
│ Executive         │ Business Health │ Availability score,  │ 5 minutes     │
│                   │                 │ Revenue/hour,        │               │
│                   │                 │ Active users         │               │
├───────────────────┼─────────────────┼──────────────────────┼───────────────┤
│ On-call Engineer  │ Service Health  │ RED metrics,         │ 10 seconds    │
│ (incident)        │                 │ Error rate, p99,     │               │
│                   │                 │ Upstream/downstream  │               │
├───────────────────┼─────────────────┼──────────────────────┼───────────────┤
│ SRE               │ Infrastructure  │ USE metrics,         │ 1 minute      │
│                   │                 │ Saturation, capacity │               │
├───────────────────┼─────────────────┼──────────────────────┼───────────────┤
│ Developer         │ Exploratory     │ Ad-hoc, high-card.,  │ On-demand     │
│ (debugging)       │                 │ trace search         │               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Alert Types with Examples

```javascript
// 1. THRESHOLD ALERT (static)
const thresholdAlert = {
  condition: "error_rate > 0.01",  // > 1%
  for: "5 minutes",                // must persist
  severity: "critical",
  action: "page via PagerDuty"
};

// 2. COMPOSITE ALERT (multiple conditions — prevents false positives)
const compositeAlert = {
  condition: "error_rate > 0.01 AND request_rate > 100",
  // Why: if traffic = 1 req/s and 1 fails → 100% error rate (false alarm)
  // With composite: only alert if there's meaningful traffic
  for: "3 minutes",
  severity: "critical"
};

// 3. ADAPTIVE / DYNAMIC ALERT (deviates from baseline)
const adaptiveAlert = {
  condition: "actual_latency > baseline_p99 × 2",  // 2σ from expected
  // Netflix Atlas uses this to catch latency spikes relative to normal
  for: "5 minutes",
  severity: "warning"
};

// 4. RATE-OF-CHANGE ALERT (trend-based)
const trendAlert = {
  condition: "increase(error_count[1h]) > increase(error_count[1h] offset 1d) × 2",
  // Alert if error rate TODAY is 2× higher than same time yesterday
  severity: "warning"
};

// 5. HEARTBEAT ALERT (absence of signal)
const heartbeatAlert = {
  condition: "absent(up{job='payment-api'}) for 2 minutes",
  // Alert if no metrics received — service might be completely down
  severity: "critical"
};
```

---

## Severity Tiers: Page vs Ticket vs Dashboard

```
CRITICAL → PAGE (PagerDuty, immediate human response)
  Trigger: User impact NOW
  Examples: Checkout broken; payment API down; data loss
  SLA: Acknowledge in 5 minutes
  Required: Every critical alert must have runbook URL!

WARNING → TICKET (Jira, business hours investigation)
  Trigger: Not urgent, but needs investigation
  Examples: SSL cert expires in 30 days; DB disk at 70%
  SLA: Investigate within 24 hours

INFO → DASHBOARD ONLY
  Trigger: Informational, no action needed
  Examples: Deployment succeeded; scheduled maintenance
  Never send notifications for INFO

Stripe pattern:
  EVERY critical alert shows:
  1. Technical metric (error rate %)
  2. Business impact ($/min affected)
  3. Link to runbook
```

---

## Cardinality and Storage Cost

```
High-cardinality metric explosion:
  50 endpoints × 5 regions × 10 status codes = 2,500 time series
  × 8,640 data points/day (15s sample, 24h)
  = 21,600,000 data points/day

After rollup (aggregate by endpoint only):
  50 endpoints × 8,640 points/day = 432,000 data points/day
  = 50× storage reduction

Grafana rollup strategy:
  Keep raw (15s) for: last 6 hours
  Keep 1-minute rollups for: last 7 days
  Keep 1-hour rollups for: last 90 days
  Keep daily rollups for: forever
```

---

## Alert Fatigue Prevention

```
An alert is good ONLY if it is ALL of these:
  ✓ Actionable: "what do I do?" has a clear answer
  ✓ Urgent: needs human attention NOW (not in 2 hours)
  ✓ Linked to runbook: every alert has step-by-step response guide

ANTI-PATTERNS (causes fatigue):
  ✗ Infrastructure cause alerts (CPU > 80%) → dashboard only
  ✗ No for-duration clause → single spike fires alert
  ✗ No runbook → engineer wastes 20min figuring out what to do
  ✗ FP rate > 10% → alerts start getting silenced

MAINTENANCE:
  Weekly: Review which alerts fired without action → delete or raise threshold
  After every incident: Update runbook for affected alert
  Quarterly: Alert audit — remove stale, add missing
```

---

## ASCII: On-Call Dashboard Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  SERVICE HEALTH DASHBOARD          Last updated: 10s ago               │
├──────────────────────────────────────────────────────────────────────────┤
│  REQUEST RATE         ERROR RATE         P99 LATENCY      SATURATION    │
│  ┌───────────┐        ┌───────────┐     ┌───────────┐    ┌───────────┐  │
│  │ 2,847 rps │        │  0.12%  ✓ │     │  186ms  ✓ │    │  CPU 67%  │  │
│  └───────────┘        └───────────┘     └───────────┘    └───────────┘  │
├──────────────────────────────────────────────────────────────────────────┤
│  UPSTREAM SERVICES                 DOWNSTREAM SERVICES                  │
│  API GW:     🟢 healthy            DB Pool:    🟡 92% used              │
│  Auth:       🟢 healthy            Redis:      🟢 healthy               │
│  Payment:    🔴 elevated errors    Kafka:      🟢 healthy               │
├──────────────────────────────────────────────────────────────────────────┤
│  ACTIVE ALERTS                                                           │
│  🔴 Payment service error rate 4.2% > 1% threshold  [Runbook] [Silence] │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Real-World Examples

| Company | Approach | Key Insight |
|---|---|---|
| Netflix Atlas | Adaptive thresholds (2σ from expected) + blast radius | 100K+ affected users = critical page; 10K = Slack notification |
| Stripe | Business impact alongside technical metrics | Shows $/min affected during incidents to prioritize triage |
| Google SRE | Runbooks required for every critical alert | Runbooks updated after every postmortem — living documentation |
| Airbnb | Alert audit: FP rate tracking | Any alert with >20% FP gets raised threshold or deleted |

---

## Interview Cheat Sheet

**Q: What's the difference between RED and USE metrics and when do you use each?**

> A: RED is for services: Rate (throughput), Errors (failure rate), Duration (latency). It answers "how is this service performing for users?" USE is for resources: Utilization (how busy), Saturation (queue depth), Errors (device errors). It answers "how healthy is this infrastructure component?" Use RED on your APIs and databases to alert on user impact; use USE on your CPUs, disks, and network for capacity planning and root-cause investigation. Alert on RED; investigate with USE.

**Q: How do you prevent alert fatigue on an on-call rotation?**

> A: Three practices: (1) Alert only on user-facing symptoms, never infrastructure causes — CPU at 90% goes on a dashboard, not a page. (2) Require for-duration clauses on all alerts (condition must persist 5+ minutes) — eliminates single-spike noise. (3) Require runbooks for every critical alert — if there's no runbook, the alert isn't actionable enough to page someone. Measure FP rate weekly; any alert with >10% FP gets threshold raised or deleted. Google SRE updates runbooks after every postmortem.

**Q: What is composite alerting and why is it important?**

> A: A composite alert requires multiple conditions simultaneously: e.g., "error_rate > 1% AND traffic > 100 rps". Without the traffic condition, if you receive 1 request and it fails, error rate = 100% — a spurious critical page. The composite prevents false positives during low-traffic periods (nights, right after deployment) while ensuring you still get paged when there's meaningful user impact. It's especially important for error rate and latency alerts.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **RED metrics** | Service metrics: Rate, Errors, Duration — measure user-facing service behavior |
| **USE metrics** | Resource metrics: Utilization, Saturation, Errors — measure infrastructure health |
| **Alert fatigue** | On-call burnout from too many low-value/false-positive alerts; leads to ignoring alerts |
| **Composite alert** | Alert requiring multiple conditions simultaneously — prevents false positives |
| **For-duration clause** | Requiring a condition to persist for N minutes before alerting — prevents transient spikes |
| **Runbook** | Step-by-step incident response guide linked to every critical alert |
| **Adaptive threshold** | Alert threshold based on historical baseline (e.g., 2σ) rather than static number |
| **Blast radius** | Number of users affected by an incident — determines severity tier |
| **Rollup** | Aggregating fine-grained metrics into coarser time buckets to reduce storage cost |
| **Heartbeat alert** | Alert that fires when an expected signal goes absent — detects complete service death |
