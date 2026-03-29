# 12. Availability in Numbers: SLA (Service Level Agreement) & Nines Explained

---

## TL;DR

Availability = uptime as a percentage. Each additional "nine" = 10x less downtime but roughly 10x more cost and complexity. Sequential components multiply availability (always worse). Parallel redundancy dramatically improves it. Set SLA (Service Level Agreement) targets *below* your measured availability to leave a buffer.

> **Cheat Sheet**: 99.9% = 8.7h/year | 99.99% = 52min/year | 99.999% = 5.3min/year | Sequential: multiply | Parallel: `1 - (1-A₁)(1-A₂)` | Measure end-to-end, not component-by-component

---

## ELI5 — Explain Like I'm 5

Imagine airline on-time performance.

- **99% on-time** sounds great — but that's **3–4 delays/year** if you fly weekly
- Now your **connecting flight** is also 99%: end-to-end = 99% × 99% = **98%**. Each leg multiplies the risk.
- But if the airline has **two planes ready** at the gate (redundancy): probability both are unavailable = 1% × 1% = 0.01% → effectively **99.99% on-time**

That's how availability math works: **dependencies chain together (worse), redundancy stacks together (better)**.

---

## The Analogy

> Airline on-time performance: each connection multiplies failure risk, but a backup plane at the gate squares your reliability. Each additional nine = 10x less downtime but costs exponentially more.

---

## Core Concept

```
Availability = Uptime / (Uptime + Downtime)
```

Expressed in "nines notation":

```
┌─────────────┬───────────────┬───────────────────┬──────────────────────────────────┐
│ Availability│  Name         │  Annual Downtime   │  What it takes                   │
├─────────────┼───────────────┼───────────────────┼──────────────────────────────────┤
│ 99%         │ Two nines     │  87.6 hours/year   │ Single region, basic backups     │
│ 99.9%       │ Three nines   │  8.7 hours/year    │ Multi-AZ, DB replication         │
│ 99.99%      │ Four nines    │  52 min/year       │ Multi-region, automated failover │
│ 99.999%     │ Five nines    │  5.3 min/year      │ Active-active global, chaos eng. │
└─────────────┴───────────────┴───────────────────┴──────────────────────────────────┘

Each step = 10x less downtime, ~10x more cost and operational complexity
```

---

## The Math

### Formula 1 — Basic Availability

```
Availability = Uptime / (Uptime + Downtime)

Example: 3 hours downtime last month (720 hours total)
  = 717 / 720 = 99.58% ≈ "two and a half nines"
  = ~30 hours/year if pattern continues
```

### Formula 2 — Sequential Components (multiply, always worse)

```
Availability_total = A₁ × A₂ × A₃ × ... × Aₙ

Example: Load Balancer(99.95%) → API (Application Programming Interface) Gateway(99.9%) → Service(99.9%) → DB(99.99%)
  = 0.9995 × 0.999 × 0.999 × 0.9999
  = 99.74%  ← worse than every individual component!

5 microservices each at 99.9%:
  = 0.999⁵ = 99.5%   ← lost 0.5% = ~44 extra hours of downtime/year
```

> **Key insight**: Every extra network hop in the request path multiplies risk. This is why microservices can REDUCE total availability even if each service is reliable.

### Formula 3 — Parallel Redundancy (exponential improvement)

```
Availability_total = 1 - (1 - A₁) × (1 - A₂) × ... × (1 - Aₙ)

Example: 2 load balancers each at 99.9%
  = 1 - (0.001 × 0.001)
  = 1 - 0.000001
  = 99.9999%  ← six nines from two three-nine components!

3 load balancers:
  = 1 - (0.001)³ = 99.9999999%  ← nine nines

⚠️ Only works if failures are INDEPENDENT (no shared power/network/config)
```

### Formula 4 — Convert Availability to Downtime

```
Downtime = Total_Time × (1 - Availability)

99.95% SLA (Service Level Agreement), annual:
  = 8760 hours × 0.0005 = 4.38 hours/year = ~22 minutes/month

This is your "error budget" — how much downtime you can have before breaching SLA (Service Level Agreement)
```

### Formula 5 — Composite System (mixed serial/parallel)

```
Real architecture:
  Layer 1: 2× Load Balancers (parallel)    → 1 - (0.001)²  = 99.9999%
  Layer 2: API (Application Programming Interface) Gateway (single component)  →                = 99.95%   ← BOTTLENECK
  Layer 3: 3× App Servers (parallel)       → 1 - (0.001)³  = 99.9999999%
  Layer 4: 2× DB Replicas (parallel)       → 1 - (0.0001)² = 99.999999%

Total = 0.999999 × 0.9995 × 0.999999999 × 0.99999999
      = 99.95%

The single API (Application Programming Interface) Gateway at 99.95% is the BOTTLENECK.
No amount of redundancy elsewhere can overcome it.
Fix: add a second API (Application Programming Interface) Gateway → total jumps to ~99.9999%
```

---

## Sequential vs Parallel — Visual

```
Sequential (multiply → worse):
  [LB 99.95%] → [API (Application Programming Interface) GW 99.9%] → [Service 99.9%] → [DB 99.99%]
  
  Total: 0.9995 × 0.999 × 0.999 × 0.9999 = 99.74%
  Each arrow = multiplied risk

Parallel (redundancy formula → better):
  Request
    ├──► [DB Replica 1: 99.9%]
    └──► [DB Replica 2: 99.9%]
  
  Total: 1 - (0.001 × 0.001) = 99.9999%
  Both must fail simultaneously → much rarer
```

---

## Key Principles

### 1. Sequential Components Chain Failure Risk
Five microservices at 99.9% each = 99.5% end-to-end. Netflix found that adding more microservices *decreased* availability until they added aggressive circuit breaking and fallback mechanisms.

### 2. Redundancy Provides Exponential Gains — IF Failures Are Independent
Two 99% components in parallel = 99.99%. Three = 99.9999%. But if both share the same power supply, network switch, or software version, they will fail together — defeating the calculation. Always map **shared dependencies** (Google SRE discovered "independent" load balancers sharing one config management system — a single point of failure).

### 3. Each Additional Nine Costs ~10x More

| Move | What you need | Cost multiplier |
|---|---|---|
| 99% → 99.9% | DB replication, basic monitoring | ~10x |
| 99.9% → 99.99% | Multi-AZ, automated failover | ~100x |
| 99.99% → 99.999% | Active-active multi-region, 24/7 on-call, chaos engineering | ~1000x |

### 4. Measure End-to-End, Not Component-by-Component
Your database might have 99.99% uptime, but users could experience 99.1% availability due to CDN (Content Delivery Network) failures, DNS (Domain Name System) problems, slow queries, client-side JS errors. Use **synthetic monitoring** — automated scripts that simulate real user journeys from multiple locations.

> Netflix: primary metric is "stream starts per second" — not whether backend services respond to health checks.

### 5. Planned Maintenance Counts (Unless Explicitly Excluded)
4 hours/month for DB upgrades = 99.4% availability. High-availability systems invest in zero-downtime deployments: blue-green deployments, rolling updates, online schema migrations.

---

## Availability Types

| Type | What it measures | Used By |
|---|---|---|
| **Service-Level** | Single component uptime | Individual microservice SLOs |
| **End-to-End** | Full user journey success rate | Uber: "request ride → trip complete" |
| **Regional** | Availability per geographic zone | Netflix: tracks per AWS (Amazon Web Services) region |
| **Weighted** | Critical paths get higher targets | Stripe: payment API (Application Programming Interface)=99.99%, analytics=99.9% |

---

## MERN Dev Parallel — MongoDB Availability

> As a MERN dev, when you run `mongoose.connect()` to a MongoDB **Replica Set**, here's what's happening availability-wise:
>
> - Your 3-node replica set: Primary(99.95%) + 2 Secondaries
> - Reads can go to secondaries (parallel for reads)
> - Writes MUST go to primary (sequential single point)
> - Primary election on failure: ~10–30s downtime during failover
>
> MongoDB Atlas handles this automatically — but understanding the math explains WHY Atlas charges more for multi-region clusters (it's adding parallel layers to reduce that single-primary bottleneck). A 3-node Atlas cluster across 3 AZs gives you `1 - (0.0005)³ ≈ 99.9999999%` for reads, but write availability is still limited by primary promotion time (your failover RTO (Recovery Time Objective)).

---

## Real-World Examples

### Amazon S3 — 99.99% SLA (Service Level Agreement)
- Internal target: 99.995% (buffer for unexpected incidents)
- SLA (Service Level Agreement) is set *below* measured performance so they can always exceed it
- 2017 outage: 4 hours, triggered by a maintenance command typo that removed too many servers
- Fix: gradual rollouts for all maintenance ops + strict server-per-command limits

### Netflix — 99.99% Streaming Availability
- Serves 200M+ subscribers across multiple AWS (Amazon Web Services) regions
- Measure **"stream starts per second"** as primary availability metric (user perspective)
- Discovered gap: component uptime showed 99.99%, users experienced 99.95% (client-side, CDN (Content Delivery Network), ISP routing failures)
- Response: synthetic monitoring + client-side telemetry + measure from user perspective

### Stripe — Tiered Availability

| Endpoint | Target | Why |
|---|---|---|
| Payment processing API (Application Programming Interface) | 99.99% | Every minute down = millions lost |
| Reporting / analytics API (Application Programming Interface) | 99.9% | Merchants can tolerate 30min delay |
| Enterprise customers | 99.995% | Dedicated infrastructure |
| Standard customers | 99.99% | Shared infrastructure |

---

## Setting Realistic SLA (Service Level Agreement) Targets

```
SLA_target = Measured_Availability - Safety_Buffer

Example: System achieves 99.97% over 6 months
  → Set SLA (Service Level Agreement) at 99.95%
  → Buffer = 0.02% = ~1.75 hours/year

Why? Accounts for: black swan events, seasonal spikes, measurement gaps

AWS (Amazon Web Services) pattern: Set SLA (Service Level Agreement) 0.01–0.05% below measured availability
```

---

## Availability vs Cost Decision Framework

```
What's each hour of downtime worth to your business?

                      High ($100K+/hour)    Medium ($10K/hour)    Low (internal tool)
                      ───────────────────   ──────────────────    ───────────────────
Target:               99.99%                99.9%                 99%
Architecture:         Multi-region active-  Multi-AZ + DB         Single-zone + backups
                      active + chaos eng.   replication
Approx annual cost:   $500K                 $50K                  $5K

ROI check (if downtime = $100K/hour):
  99.9% → 8.7h/year = $870K in downtime
  99.99% → 52min/year = $87K in downtime
  Cost of extra nine: $450K → saves $783K/year ✓ justified
```

---

## Common Pitfalls

### Pitfall 1: Component Uptime ≠ User Availability
- DB at 99.99% but checkout success at 99.5%? Check: load balancer, API (Application Programming Interface) gateway, CDN (Content Delivery Network), DNS (Domain Name System), client JS errors
- Fix: synthetic monitoring simulating complete user journeys

### Pitfall 2: Correlated Failures in "Redundant" Systems
- Both DB replicas on same physical rack/power supply/software version
- When the shared dependency fails → all "redundant" nodes fail together
- Fix: map ALL shared deps; use chaos engineering to actually verify independence

### Pitfall 3: "Five Nines" Without Knowing What It Costs
- PM demands 99.999%; team doesn't realize it needs multi-region active-active + chaos eng + 24/7 SRE on-call
- Fix: build a cost-benefit matrix; ask "what's the ROI of each additional nine?"

### Pitfall 4: Availability Is a Rate, Not a Permanent State
- 99.99% yearly ≠ 99.99% during Black Friday
- Fix: measure per time window (hourly, daily, monthly); track p99 not just average; provision for peak

### Pitfall 5: Treating All Downtime Equally
- 5 min at 3AM ≠ 5 min during peak (Uber Friday night vs Tuesday morning)
- Fix: weighted by concurrent users — track "user-minutes of downtime", not just clock-minutes

---

## Interview Cheat Sheet

| Level | What you need to demonstrate |
|---|---|
| **Mid** | Basic formula; convert percentages to downtime; sequential multiply, parallel redundancy formula; know that microservices reduce availability |
| **Senior** | Calculate composite availability; explain correlated failure risk; justify availability target via cost-benefit; know 5 types of availability; set SLA (Service Level Agreement) with buffer |
| **Staff+** | Design company-wide SLA (Service Level Agreement) frameworks; ROI of reliability investments; org culture (blameless post-mortems, error budgets, on-call rotation); handle incidents and derive systemic improvements |

---

## Common Interview Questions

1. **"Design a system for 99.99% availability"**
   - Eliminate all single points of failure via redundancy at every layer
   - Multi-AZ minimum; multi-region for 99.99%+
   - Automated health checks + failover; circuit breakers against cascades
   - Synthetic monitoring for end-to-end measurement
   - Set internal target at 99.995% (buffer for unexpected)

2. **"3 microservices in sequence, each 99.9%. What's total availability?"**
   - 0.999³ = 99.7% → worse than any individual service
   - Fix: redundancy per service, async communication to decouple, circuit breakers with fallbacks

3. **"How do you decide 99.9% vs 99.99% for a new feature?"**
   - Calculate: cost of downtime per hour × hours of downtime/year at each tier
   - Compare to infra cost of achieving that tier
   - Also consider: dependency ceiling (can't exceed your weakest dependency's availability)

4. **"DB is 99.99% uptime but users report 99.5% availability. What's wrong?"**
   - Network issues, CDN (Content Delivery Network) serving stale/corrupted content, DNS (Domain Name System) failures, API (Application Programming Interface) rate limiting, client-side JS errors, slow queries timing out
   - Fix: synthetic monitoring from user perspective, not just health check pings

5. **"How to improve availability without increasing costs?"**
   - Reduce sequential deps (fewer microservice hops → async where possible)
   - Circuit breakers + fallbacks (fail fast, degrade gracefully)
   - Better monitoring → MTTD (mean time to detect) drives recovery time
   - Optimize slow queries that cause timeouts
   - Runbooks for common incidents → reduce MTTR (Mean Time To Recovery)

---

## Red Flags to Avoid

- ❌ "Our DB is 99.99% so our system is 99.99%" — confusing component uptime with end-to-end availability
- ❌ "More microservices = better availability" — they multiply failure risk unless you add redundancy per service
- ❌ "Just add redundancy everywhere for five nines" — redundancy only works if failures are independent; also costs 1000x more
- ❌ "Availability is the ops team's problem" — it's owned by architecture, code quality, AND operations
- ❌ "We hit 99.99% last month so we'll promise it" — one month is insufficient; set SLA (Service Level Agreement) below measured with a buffer

---

## Key Takeaways

- **99.9% = 8.7h/year, 99.99% = 52min/year, 99.999% = 5.3min/year** — each nine = 10x less downtime
- **Sequential**: multiply availabilities → always worse than the weakest component
- **Parallel**: `1 - (1-A₁)(1-A₂)` → dramatically better, but only if failures are independent
- **Measure user-facing availability**, not just component uptime — use synthetic monitoring
- **SLA (Service Level Agreement) target = measured availability − safety buffer** — never promise what you've only barely achieved
- **Each additional nine costs ~10x more** — justify via business cost of downtime vs infrastructure cost

---

## Keywords

`availability` `nines` `SLA (Service Level Agreement)` (Service Level Agreement) `SLO (Service Level Objective)` (Service Level Objective) `SLI (Service Level Indicator)` (Service Level Indicator) `uptime` `downtime` `error budget` `sequential availability` `parallel redundancy` `composite availability` `MTTR (Mean Time To Recovery)` (Mean Time to Recover) `MTTD (Mean Time To Detect)` (Mean Time to Detect) `MTBF (Mean Time Between Failures)` (Mean Time Between Failures) `synthetic monitoring` `end-to-end availability` `correlated failure` `shared dependency` `single point of failure` `multi-AZ` `multi-region` `active-active` `chaos engineering` `zero-downtime deployment` `blue-green deployment` `rolling update` `planned maintenance` `error budget burn rate`
