# Performance Monitoring

## ELI5
Imagine timing every lap around a racetrack and recording the results. The average lap time is misleading — most laps are fast but a few are very slow. You care about: how many laps (traffic), how many mistakes (errors), the slowest 1% of laps (p99 latency), and how close you are to running out of fuel (saturation).

## Analogy
A hospital measures ER wait times by percentile: 50% of patients are seen in 15 min, 95% in 45 min, 99% in 2 hours. The average (20 min) is misleading — it hides that 1 in 100 patients waits 2 hours.

---

## Core Concept
**Performance monitoring** tracks the speed, correctness, and capacity of your service to detect degradation before users notice and attribute slowdowns to specific code paths.

---

## The Four Golden Signals (Google SRE)

```
┌────────────────────────────────────────────────────────────────────┐
│                    FOUR GOLDEN SIGNALS                             │
├────────────────────────────────────────────────────────────────────┤
│  1. LATENCY                                                        │
│     How long requests take.                                        │
│     Track p50, p95, p99 — NOT averages.                           │
│     Distinguish success latency from error latency.               │
│                                                                    │
│  2. TRAFFIC                                                        │
│     How much demand: requests/second, bytes/second.               │
│     Baseline for relative error rates and saturation.             │
│                                                                    │
│  3. ERRORS                                                         │
│     Rate of explicitly failed requests (5xx) +                    │
│     implicitly failed requests (200 OK but wrong data).           │
│                                                                    │
│  4. SATURATION                                                     │
│     "How full is the tank?" — CPU %, memory %, queue depth.       │
│     High saturation predicts future degradation.                  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Why Percentiles, Not Averages

```
Response times for 10 requests:
  [50ms, 48ms, 52ms, 49ms, 51ms, 47ms, 53ms, 50ms, 50ms, 10,000ms]

  Average = (50+48+52+49+51+47+53+50+50+10,000) / 10 = 1,045ms ← MISLEADING!

  p50 (median)  = 50ms     ← half of users experience this or better
  p95           = 53ms     ← 95% of users experience this or better
  p99           = 10,000ms ← 1 in 100 experiences 10 seconds

  LESSON: The average masks the painful tail. p99 tells you about
  real user suffering. SLOs are written on p99, not averages.
```

---

## Alert on Symptoms, Not Causes

```
BAD (causes — may not affect users):
  ✗ "CPU > 80%" — might be fine, might not matter
  ✗ "DB connections > 900" — connection pool ≠ user pain
  ✗ "Memory > 85%" — GC might be running fine

GOOD (symptoms — directly indicates user pain):
  ✓ "Payment API p99 latency > 1s"
  ✓ "Checkout error rate > 0.5%"
  ✓ "Homepage availability < 99.9% in last 5 minutes"

Alert only on conditions users feel.
Put causes in dashboards for investigation.
```

---

## Multi-Window Alerting

```
PROBLEM: Single-window alerts fire on normal traffic spikes

SOLUTION: Require condition to persist across multiple windows:

  1-minute window:  For immediate detection of severe spikes
  5-minute window:  For sustained degradation (confirms it's real)
  1-hour window:    For trend-based SLO erosion detection

Rule: Only page when condition spans ALL three windows
  → eliminates transient 30-second spikes from waking anyone up

Grafana example:
  alert_condition:
    - "error_rate > 1% for 1 minute"   AND
    - "traffic > 100 rps"              (composite — avoids false positives)
```

---

## Monitoring Types

```
INFRASTRUCTURE MONITORING
  What: CPU, memory, disk I/O, network I/O
  When: Alerts for capacity planning, not for user-visible issues
  Tools: Datadog, CloudWatch, Prometheus node_exporter

APM (Application Performance Monitoring)
  What: Code-level traces, slow function calls, DB query timings
  When: Finding WHERE in code the latency lives
  Overhead: 1-5% CPU/memory; instrument at framework level
  Tools: Datadog APM, New Relic, Dynatrace

RUM (Real User Monitoring)
  What: Browser/mobile performance from actual users
  When: "What does the user actually experience?"
  Captures: DNS, TCP, TLS handshake, content download, render time
  Tools: Lighthouse CI, Datadog RUM, Elastic RUM

SYNTHETIC MONITORING
  What: Scripted transactions run every 1-5 minutes from 20+ locations
  When: Proactive — finds issues before users do
  Examples: "Login → Search → Add to Cart → Checkout"
  Tools: Pingdom, New Relic Synthetics, Checkly

DISTRIBUTED TRACING
  What: End-to-end request trace across microservices
  When: "Which service is adding latency to this request?"
  Sampling: 1-10% normal requests; 100% errors/slow requests
  Tools: Jaeger, Zipkin, AWS X-Ray, Grafana Tempo

LOG AGGREGATION
  What: Structured event logs aggregated, indexed, searchable
  When: "What error message appeared for failed requests?"
  Tools: ELK (Elasticsearch/Logstash/Kibana), Grafana Loki, Splunk
```

---

## Push vs Pull Metrics Collection

```
PULL (Prometheus model):
  Prometheus server scrapes /metrics endpoint every 15s
  Works when: services are long-lived, in stable network
  Works for: Kubernetes services, microservices

  Service ← GET /metrics ── Prometheus
  Service ── metrics data →─ Prometheus

PUSH (Statsd/CloudWatch model):
  Services emit metrics to collector
  Works when: serverless, ephemeral (Lambda, containers), short-lived
  Works for: Lambda functions (no stable target to scrape)

  Lambda function ──►  CloudWatch Metrics  ──► Alarms
```

---

## SLOs and Error Budgets for Performance

```javascript
// SLO Example:
// "99.9% of API requests will complete in < 200ms over a 30-day window"

// Error budget = allowed violations:
//   30 days × 24h × 60min × 60s × rps = total requests
//   budget = total_requests × 0.001 (0.1%)

// Practice: Track SLO compliance as a metric
const performance_slo = {
  metric: "api_request_duration_p99",
  target: 200,     // ms
  percentile: 99,  // 99% of requests
  window: "30d",
  slo: 99.9        // percentage
};

// SLO compliance:
// compliance = (requests_meeting_target / total_requests) × 100
// error_budget_remaining = (allowed_violations - actual_violations) / allowed_violations
```

---

## ASCII: Performance Monitoring Stack

```
Application
    │
    │ Instrument with OpenTelemetry
    ▼
┌─────────────────────────────────────────────────────────┐
│  Metrics ──────────────────────► Prometheus             │
│  (counters, histograms,           │                     │
│   p50/p95/p99 auto-computed)      ▼                     │
│                               Grafana Dashboards        │
│                               Alert Rules               │
│                                   │                     │
│  Traces ───────────────────────► Jaeger / Tempo         │
│  (spans per service)              │                     │
│                               Trace waterfall view      │
│                               Service maps              │
│                                                         │
│  Logs ─────────────────────────► Loki / ELK             │
│  (structured JSON events)         │                     │
│                               Log explorer              │
│                               Correlate with traces     │
└─────────────────────────────────────────────────────────┘
```

---

## Real-World Examples

| Company | Problem | Solution | Result |
|---|---|---|---|
| Uber | 100M+ metric events/second across 4,000 microservices | Custom aggregation pipeline + Jaeger tracing | Real-time p99 latency alerts per service |
| Netflix | Streaming quality impacts revenue directly | Real-time rebuffering ratio per user + segment | Instant CDN routing decisions |
| Shopify | Intermittent checkout slowness | APM traces across checkout flow | One DB query adding 200ms for 5% of requests |
| Airbnb | Inconsistent latency hard to debug | Enforce /metrics + tracing on every service | Root cause in 5 min vs 2 hours |

---

## Interview Cheat Sheet

**Q: Why should you track p99 latency instead of average latency?**

> A: Averages are statistically dominated by the majority of fast requests and mask the tail. If 99% of requests complete in 50ms and 1% take 10s, the average is ~150ms — which sounds moderate but hides that 1 customer in 100 is waiting 10 seconds. p99 tells you the worst experience a meaningful fraction of users has. For high-volume services (10M req/day), p99 represents 100,000 users/day experiencing that worst case. SLOs are defined on percentiles, not averages.

**Q: What are Google's Four Golden Signals and which is most important?**

> A: Latency (how long requests take), Traffic (how much demand), Errors (failure rate), and Saturation (resource fullness). No single one is "most important" — they form a diagnostic matrix. Latency spike with normal errors = performance issue. Error spike with normal latency = logic/configuration failure. High saturation with normal latency = pre-failure warning. For user-facing services, error rate and latency most directly indicate user impact.

**Q: How does APM differ from infrastructure monitoring?**

> A: Infrastructure monitoring tracks hardware/OS resources — CPU, memory, network at the host or container level. APM (Application Performance Monitoring) instruments code itself — tracking individual function execution times, database query durations, external service call latency, and creates distributed traces linking these across service boundaries. Infrastructure monitoring tells you a server is busy; APM tells you which SQL query or function call is causing the slowness. Both are needed.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **Four Golden Signals** | Google SRE's core metrics: Latency, Traffic, Errors, Saturation |
| **p99 latency** | The response time that 99% of requests complete within (1% are slower) |
| **APM** | Application Performance Monitoring — code-level instrumentation and tracing |
| **RUM** | Real User Monitoring — capturing performance from actual users' browsers/apps |
| **Distributed tracing** | Recording a request's entire path across multiple services as linked spans |
| **Synthetic monitoring** | Scripted tests run proactively against your service — finds issues before users |
| **Saturation** | Measure of how full a resource is — high saturation predicts future failure |
| **SLO burn rate** | How fast error budget is being consumed; high burn rate = SLO breach upcoming |
| **Span** | A single timed operation within a distributed trace (e.g., one DB query) |
| **Tail latency** | Latency at high percentiles (p95, p99) — most important for user experience |
