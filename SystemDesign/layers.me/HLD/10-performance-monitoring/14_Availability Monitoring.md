# Availability Monitoring

## ELI5
Availability is the percentage of time your service actually works. If your service is down for 43 minutes this month out of 43,200 minutes total, that's 99.9% availability. Availability monitoring measures this continuously across all regions.

## Analogy
A store's availability is its open-hours percentage. A store open 8am–10pm has 58% availability. If it closes unexpectedly twice a month for 30 minutes, your SLA target determines whether that's acceptable.

---

## Core Concept
**Availability monitoring** continuously measures whether your service is reachable and functioning correctly for real users, calculates uptime against SLO targets, and burns down error budgets to inform release velocity decisions.

---

## Availability Formula

```
Availability = Uptime / (Uptime + Downtime) × 100

"Nines" Table:
────────────────────────────────────────────────────────────────
SLA Target  │ Downtime/Month │ Downtime/Year │ Infrastructure Cost
────────────┼────────────────┼───────────────┼───────────────────
99%         │ 7.2 hours      │ 87.6 hours    │ 1×
99.9%       │ 43.2 minutes   │ 8.7 hours     │ 3×
99.99%      │ 4.32 minutes   │ 52 minutes    │ 10×
99.999%     │ 26 seconds     │ 5.26 minutes  │ 30–100×
────────────────────────────────────────────────────────────────

Cost reality: Each nine costs roughly 10× more infrastructure.
99.999% requires redundant hardware in multiple AZs/regions,
zero-downtime deployments, and 24/7 on-call rotation.
```

---

## Serial Dependency Multiplication

```
If your service calls 4 downstream services in sequence:

  User → API Gateway → Auth → Payment → DB

  API Gateway:  99.95% available
  Auth:         99.9%  available
  Payment:      99.9%  available
  DB:           99.95% available

End-to-end availability:
  0.9995 × 0.999 × 0.999 × 0.9995
  = 0.997 = 99.7%
  = 129.6 minutes downtime per month!

Even though every individual service meets 99.9%+,
the end-to-end user experience only gets 99.7%.

Fix: Cache responses, graceful degradation,
     circuit breakers, reduce dependency chain depth.
```

---

## Error Budget

```javascript
function calculateErrorBudget(sloPercent, monthlyMinutes = 43200) {
  const budgetMinutes = monthlyMinutes * (1 - sloPercent / 100);
  return {
    budgetMinutes,
    budgetSeconds: budgetMinutes * 60,
    message: `You can afford ${budgetMinutes.toFixed(1)} minutes of downtime this month`
  };
}

// SLO = 99.9% → budget = 43.2 minutes
// SLO = 99.99% → budget = 4.32 minutes

function budgetConsumed(actualDowntimeMinutes, sloPercent) {
  const budget = calculateErrorBudget(sloPercent);
  const consumed = actualDowntimeMinutes / budget.budgetMinutes;
  return {
    consumed: (consumed * 100).toFixed(1) + '%',
    remaining: ((1 - consumed) * 100).toFixed(1) + '%',
    // Business decision: if > 100%, freeze releases until next month
    releaseFreeze: consumed > 1.0
  };
}
```

---

## Monitoring Types

```
1. SYNTHETIC MONITORING (Active Probing)
   ─────────────────────────────────────────────────────────
   External agents hit your service from 20+ global locations
   Every 30-60 seconds
   Catches outages even before any user hits them
   Tools: Pingdom, New Relic Synthetics, AWS CloudWatch Canaries

2. REAL USER MONITORING — RUM (Passive)
   ─────────────────────────────────────────────────────────
   JavaScript snippet in browser captures actual user experience
   Includes CDN, DNS, browser render time
   Ground truth: what real users actually experience
   Not available for APIs/mobile backends

3. SLA-BASED CALCULATION
   ─────────────────────────────────────────────────────────
   Aggregate synthetic + RUM data into monthly availability %
   Compare against SLO/SLA targets
   Report to customers and executives

4. MULTI-DIMENSIONAL BREAKDOWN
   ─────────────────────────────────────────────────────────
   Availability.by_region, .by_tier, .by_feature, .by_customer
   Prevents aggregation masking: global 99.9% might hide Europe 99.5%
```

---

## Multi-Location Monitoring

```
WHY MULTIPLE LOCATIONS?

Scenario A (single probe):
  San Francisco probe says: "Service down!" (99% uptime alert fires)
  Reality: SF's network issue, not your service → FALSE POSITIVE

Scenario B (multi-location):
  SF probe: "Service down!"
  London probe: "Service up"
  Tokyo probe: "Service up"
  → Infer: SF network issue, not your service

  SF probe: "Service down!"
  London probe: "Service down!"
  Tokyo probe: "Service down!"
  → Your service is definitely down

Rule: Alert only when 2+ locations confirm failure
```

---

## ASCII: Availability Calculation Pipeline

```
External Probes                Your Service
(20+ global locations)
  │                                │
  │  GET /health every 30s         │
  │───────────────────────────────►│
  │◄───────────────────────────────│
  │  200 OK (or timeout)           │

Results feed into:
  ┌──────────────────────────────────────────────┐
  │  Availability Calculation Engine             │
  │                                              │
  │  Uptime counter: UP   ─── +30s               │
  │  Downtime counter: DOWN ── +30s              │
  │                                              │
  │  Availability = uptime / (uptime + downtime) │
  │  Error Budget = monthly_minutes × (1 - SLO)  │
  │  Budget burned = downtime / error_budget     │
  └──────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
    Dashboard            Alert system
    (availability %)     (SLO breach warning)
```

---

## Alerting Strategy

```
THRESHOLD ALERT:
  "Alert when availability < 99.9% in last 5 minutes"
  Fast: catches immediate outages

TREND ALERT:
  "Alert when availability degrading 0.1%/day for 3 consecutive days"
  Catches slow erosion before total SLO breach

ERROR BUDGET BURN ALERT (SRE approach):
  "Alert when burning budget 14× faster than normal"
  (1 hour of 100× burn rate = 6.25% of 30-day budget gone)
  Predicts SLO breach before it happens
  Google SRE: 14.4× burn = page; 6× burn = ticket
```

---

## Health Monitoring vs Availability Monitoring

```
┌────────────────────────────────────────────────────────────┐
│   HEALTH MONITORING         │  AVAILABILITY MONITORING     │
├─────────────────────────────┼──────────────────────────────┤
│ Current state                │ Historical uptime           │
│ Routing decisions            │ SLA compliance              │
│ "Is this instance ready?"    │ "Were we at 99.9% this month?"│
│ Drives: restarts, routing    │ Drives: engineering priority │
│ Real-time (seconds)          │ Aggregate (minutes/months)  │
│ Internal (within cluster)    │ External (multi-region)     │
└─────────────────────────────┴──────────────────────────────┘
```

---

## Real-World Examples

| Company | Implementation | Key Insight |
|---|---|---|
| Netflix | 50+ global probe locations, every 30s | Aggregate 99.9% masked Europe at 99.5% during peaks → drove CDN investment |
| Stripe | Payment API probed every 10s from multiple locations | Separate availability tracking per payment method (cards, ACH, SEPA) |
| AWS | Multi-AZ health checks for every service | Health checks drive route table failover automatically |
| PagerDuty | Synthetic transactions every minute | Monitors the monitoring tool from a separate, independent infrastructure |

---

## Interview Cheat Sheet

**Q: Your service reports 99.99% availability, but customers are complaining. How is that possible?**

> A: Several explanations: (1) Aggregation masking — global 99.99% average might hide one region at 99% that has 50% of your customers. (2) Measurement gap — 99.99% uptime at the load balancer doesn't include CDN outages, DNS failures, or last-mile network issues. (3) Error definition — you might be counting HTTP 500s as "up" if the server responds, but customers get wrong data. Fix: measure from multiple external locations, track by region, define availability as "correct response within SLA latency", and use Real User Monitoring.

**Q: What is an error budget and how does it influence engineering decisions?**

> A: Error budget = the allowed downtime derived from your SLO. SLO = 99.9% → budget = 43.2 minutes/month. If you've consumed 80% of your budget by day 15 (21.6 min/month gone) → slow down releases, focus on reliability. If you consumed only 5% by end of month → release velocity is fine, you can take more risk. Error budgets transform availability from an abstract target into a concrete engineering constraint that drives the speed-vs-stability tradeoff.

**Q: Why does serial dependency multiplication matter for availability design?**

> A: Each additional hop in a synchronous call chain multiplies your availability fractions. Four services each at 99.9% chained together yields only 99.6% end-to-end — that's 259 minutes of downtime per month, far exceeding any individual service's SLA. Solutions: reduce sync dependency chains, use async patterns (queues), cache downstream responses, implement graceful degradation so a down dependency doesn't fail the entire request.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **Availability** | Percentage of time a service correctly handles requests: uptime / (uptime + downtime) |
| **Error budget** | Allowed downtime derived from SLO: monthly_minutes × (1 - SLO_decimal) |
| **Synthetic monitoring** | Active probing from external agents to measure availability before users notice |
| **RUM** | Real User Monitoring — capturing actual browser/app performance data from end users |
| **SLO** | Service Level Objective — internal target ("99.9% requests succeed") |
| **SLA** | Service Level Agreement — external contract with customers; SLO should be stricter than SLA |
| **Nines** | Shorthand for availability targets: "four nines" = 99.99% |
| **Budget burn rate** | Rate at which error budget is consumed; 14× = page immediately |
| **Aggregation masking** | A high-level average hiding poor performance for a subset of users or regions |
| **Error budget freeze** | Halting releases when error budget is exhausted to focus solely on reliability |
