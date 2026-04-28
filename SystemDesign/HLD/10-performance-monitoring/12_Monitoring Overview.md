# Monitoring Overview

## ELI5
Your car has warning lights (monitoring), but a mechanic can diagnose why the light turned on by looking at all the data (observability). You need warning lights AND a mechanic. Monitoring tells you THAT something is wrong; observability tells you WHY.

## Analogy
An airplane cockpit has alerts for engine failure (monitoring) and instruments showing pressure, temperature, RPM (observability). Alerts keep pilots alive; instruments let them diagnose and fix the issue.

---

## Core Concept
**Monitoring** is the practice of collecting, processing, and acting on data about your system's health and performance. Without monitoring, you hear about outages from angry users.

### The Three Pillars

```
                    ┌─────────────────────────────────────────────┐
                    │           MONITORING PILLARS                │
                    └─────────────────────────────────────────────┘

  METRICS          LOGS              TRACES
  ─────────        ─────────         ─────────
  Aggregated       Discrete          Request
  numbers          events            flows

  "99% of          "User X           "Request #abc
  requests <200ms" failed login      took 450ms:
                   at 14:32:05"      DB=400ms,
                                     App=50ms"

  WHAT + WHEN      WHY + WHO         WHERE (latency)
  ─────────        ─────────         ─────────
  Cheap            Expensive         Moderate cost
  (numbers)        (raw text)        (sampled)

  Retention:       Retention:        Retention:
  13 months        7-30 days         7 days (sampled)

  Tools:           Tools:            Tools:
  Prometheus,      ELK, Loki,        Jaeger,
  Atlas, Datadog   Splunk, CloudWatch Zipkin, Tempo
```

---

## Monitoring vs Observability

```
┌─────────────────────────────────────────────────────────────┐
│              MONITORING             │      OBSERVABILITY     │
├─────────────────────────────────────┼────────────────────────┤
│ Known failures only                 │ Unknown unknowns too   │
│ Pre-defined metrics                 │ Exploratory queries    │
│ Predefined alerts                   │ High-cardinality data  │
│ "alert when CPU > 80%"              │ "why is user A slow?"  │
│ Dashboard view                      │ Ad-hoc investigation   │
└─────────────────────────────────────┴────────────────────────┘

You need BOTH:
  Monitoring → catch known failure modes fast
  Observability → debug novel/unknown issues
```

---

## Monitoring Layers

```
LAYER 4: Business
  Revenue, conversion rate, DAU, cart abandonment
  "Checkout success rate dropped 0.5% → $50K/hour impact"

LAYER 3: Application
  Error rates, latency percentiles, request throughput
  "Payment service p99 latency > 1s for 500 req/s"

LAYER 2: Service
  Connection pools, queue depths, cache hit ratios
  "DB pool exhausted, 847 queued connections"

LAYER 1: Infrastructure
  CPU, memory, disk I/O, network throughput
  "Web server EC2 instances at 94% memory"

Alert on SYMPTOMS (Layer 4/3): users notice
Investigate with CAUSES (Layer 2/1): find root cause
```

---

## Incident Investigation Flow

```
1. ALERT FIRES
   "Payment API error rate > 1%"
         │
         ▼
2. QUERY METRICS
   Which endpoint? Which region? Trending up or down?
   → /api/checkout ERROR RATE: 4.2% in us-east-1, spiking
         │
         ▼
3. SEARCH LOGS
   Filter: service=payment, level=ERROR, time=last 15min
   → "DB connection timeout: connect ETIMEDOUT 10.0.1.5:5432"
         │
         ▼
4. PULL TRACES
   Find traces for slow requests, examine each span
   → Span: postgres_query duration=29,847ms (should be <100ms)
         │
         ▼
5. ROOT CAUSE
   DB read replica unreachable due to network partition
```

---

## Cardinality vs Cost

```
Approach            Storage/month    Use Case
─────────────────────────────────────────────────────────
Per-user metrics    500 TB ← impractical for 10M users
Per-endpoint        50 TB  ← feasible with sampling
Aggregate only      5 TB   ← cheapest, limited debugging

Sampling strategy:
  Normal requests: sample 1% for traces
  Error requests:  sample 100% (always keep) ← critical insight
  P99 slow reqs:   sample 100% (tail-based sampling)
```

---

## ASCII: Data Flow

```
Application
Services
    │
    │ emit
    ▼
┌──────────────────────────────────────────────────────┐
│  Metrics → Prometheus/Atlas scrape every 15s          │
│  Logs    → structured JSON → Kafka → ELK/Loki         │
│  Traces  → OpenTelemetry SDK → Jaeger/Zipkin collector │
└──────────────────────────────────────────────────────┘
    │                     │                   │
    ▼                     ▼                   ▼
Grafana              Kibana/Loki        Jaeger UI
Dashboards           Log search         Trace waterfall
Alert rules          Log-based alerts   Service maps
```

---

## Real-World Examples

| Company | Scale | Key Fact |
|---|---|---|
| Netflix Atlas | 2 billion metrics/minute | Custom in-memory time-series DB; metrics expire in 1-3 hours for real-time use |
| Uber | 100M+ traces/minute across 4,000+ services | Adaptive sampling with Jaeger |
| Stripe | 1,000+ metrics per service | Every service required to expose /metrics endpoint |

---

## Interview Cheat Sheet

**Q: What are the three pillars of observability, and when do you use each?**

> A: Metrics, Logs, and Traces. Metrics are aggregated numbers (e.g., "99th percentile latency = 450ms over last 5 minutes") — cheap, answer WHAT and WHEN, used for dashboards and alerting. Logs are discrete events (e.g., "User X's payment failed with error code E503 at 14:32:05") — expensive, answer WHY and WHO, used for root-cause debugging. Traces follow a request across services (e.g., "This API call took 450ms: DB=400ms, App=50ms") — moderately expensive (sampled), answer WHERE latency lives in a distributed request.

**Q: What is the difference between monitoring and observability?**

> A: Monitoring watches for known failure modes using predefined metrics and alerts — it tells you THAT something is wrong. Observability is the ability to understand WHY something is wrong by exploring high-cardinality data in novel ways — it handles unknown unknowns. You need both: monitoring catches incidents fast; observability lets engineers debug complex, distributed failures they've never seen before.

**Q: Why alert on symptoms rather than causes?**

> A: Causes (CPU 80%, DB connections 900/1000) may not affect users at all, causing alert fatigue. Symptoms (checkout error rate > 0.1%, P99 latency > 1s) directly indicate user impact and always warrant investigation. A server can be at 90% CPU with users perfectly happy, or at 30% CPU with 5% requests timing out — only symptom-based alerts would catch the latter.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **Metrics** | Aggregated numeric measurements over time (counters, gauges, histograms) |
| **Logs** | Timestamped discrete event records (structured JSON preferred over plain text) |
| **Traces** | Records of a request's journey across services — visualized as waterfall spans |
| **Observability** | Ability to understand internal system state from external outputs (metrics/logs/traces) |
| **SLO** | Service Level Objective — internal target (e.g., "99.9% of requests < 200ms") |
| **SLA** | Service Level Agreement — external contract with penalties for violations |
| **Error budget** | Time/requests you're allowed to fail before SLO breach (100% - SLO%) |
| **Cardinality** | Number of unique values in a dimension (user_id = millions = high cardinality) |
| **Sampling** | Keeping only a fraction of traces to reduce cost; always keep 100% of errors |
| **Alert fatigue** | On-call burnout from too many low-value alerts; leads to alert blindness |
