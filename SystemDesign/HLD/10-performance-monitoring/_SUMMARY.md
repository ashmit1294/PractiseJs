# M10 — Performance & Monitoring: Summary

## Module Overview
This module covers two interconnected disciplines: **performance antipatterns** (what breaks systems at scale) and **monitoring** (how to detect, understand, and respond to those failures). Understanding antipatterns helps you build correctly; monitoring helps you operate confidently.

---

## Part 1: Performance Antipatterns (T01–T11)

### The Big Picture
Performance antipatterns are recurring design mistakes that degrade system performance at scale. They often work fine in development but collapse under production load.

| # | Antipattern | Core Problem | Fix in One Line |
|---|---|---|---|
| T01 | Overview | 11 antipatterns that kill cloud performance | Measure before optimizing; understand request lifecycle |
| T02 | Busy Database | App logic running in SQL queries | Move computation to app layer; use indexes for filtering only |
| T03 | Busy Frontend | Too much work on the client | Move computation to server; use CDN for static, lazy load |
| T04 | Chatty I/O | 100s of tiny requests instead of one batch | Batch requests; N+1 queries → single JOIN or DataLoader |
| T05 | Extraneous Fetching | Fetching data you don't need | Projection queries (SELECT specific columns), pagination, sparse fieldsets |
| T06 | Improper Instantiation | Creating new DB/HTTP clients per request | Create once at startup; reuse connections via pool |
| T07 | Monolithic Persistence | One database for all workloads | Polyglot persistence: PostgreSQL + Redis + Elasticsearch per use case |
| T08 | No-Caching | Same expensive computation repeated | Add cache at every layer: CDN, API gateway, app, DB |
| T09 | Noisy Neighbor | One tenant consuming resources for all | Separate resource pools per tier; request quotas; fair scheduling |
| T10 | Retry Storm | Retries amplify transient failures (64× in 3-layer system) | Exponential backoff + full jitter + circuit breaker + retry budget |
| T11 | Synchronous I/O | Threads blocked during I/O (6.25% CPU utilization) | Async I/O: event loop, reactive streams, goroutines |

### Critical Formulas

```
Retry amplification:  (retries + 1) ^ service_layers = (3+1)^3 = 64×
Backoff delay:        min(base_delay × 2^attempt, max_delay)
Jitter:               random(0, delay)   ← full jitter (Netflix)
Circuit breaker:      error_rate > 50% + min 20 requests → OPEN
Thread efficiency:    cpu_time / (cpu_time + io_wait_time)
Async max_rps:        cpu_cores × threads_per_core / cpu_time_per_req
```

---

## Part 2: Monitoring (T12–T19)

### The Three Pillars

```
METRICS     = aggregated numbers (WHAT + WHEN)    → Prometheus
LOGS        = discrete events (WHY + WHO)          → ELK / Loki
TRACES      = request flows (WHERE latency)        → Jaeger / Zipkin
```

### Monitoring Topic Map

| # | Topic | Core Concept | Key Rule |
|---|---|---|---|
| T12 | Overview | Metrics + Logs + Traces | Alert on symptoms, investigate with causes |
| T13 | Health Monitoring | Liveness vs Readiness probes | Never share endpoints: liveness uses shallow, readiness uses deep |
| T14 | Availability Monitoring | Uptime %, error budgets, SLOs | Serial dependencies multiply: 4 × 99.9% = 99.6% end-to-end |
| T15 | Performance Monitoring | Four Golden Signals: Latency, Traffic, Errors, Saturation | Track p99, never averages |
| T16 | Security Monitoring | Never sample security events; detect multi-stage attacks | Log 100% of auth + authorization + data access events |
| T17 | Usage Monitoring | Lambda architecture: Redis (real-time) + Spark (batch) | Never sample billing events; async emit, never block API |
| T18 | Instrumentation | Three pillars + OpenTelemetry + context propagation | Overhead target <5%; cardinality = ∏(dimensions) |
| T19 | Visualization & Alerts | RED (services) vs USE (resources) | Alert on user impact symptoms; never on infrastructure causes |

### Critical Rules

```
1. HEALTH:        Liveness = shallow (<10ms); Readiness = deep (50-200ms)
                  Different endpoints — never mix!

2. AVAILABILITY:  Availability = Uptime / (Uptime + Downtime)
                  99.9% = 43.2 min/month budget

3. PERFORMANCE:   Alert on p99, not average
                  Four Golden Signals: Latency, Traffic, Errors, Saturation

4. SECURITY:      NEVER sample security logs
                  Correlate by user_id + correlation_id across all services

5. USAGE:         Speed layer (Redis, <100ms) for quotas
                  Batch layer (Spark) for exact billing

6. INSTRUMENTATION: target <5% overhead
                    Cardinality = product of unique values per dimension

7. ALERTING:      Alert on SYMPTOMS (user pain) not CAUSES (CPU high)
                  Every critical alert MUST have a runbook
```

---

## How the Pieces Connect

```
                    ANTIPATTERNS → create performance issues
                          │
                          │  Monitoring detects these issues:
                          ▼
         ┌────────────────────────────────────────┐
         │                                        │
    Chatty I/O ──► High request rate (TRAFFIC)    │
    Busy Database ► High p99 latency (LATENCY)    │
    No-Caching ──► Consistent DB overload         │
    Retry Storm ──► Error rate spike (ERRORS)     │
    Sync I/O ────► Thread saturation (SATURATION) │
         │                                        │
         │       The Four Golden Signals          │
         └────────────────────────────────────────┘
                          │
               Instrumentation captures it
                      (OTel SDK)
                          │
              Visualization surfaces it
                    (Grafana/Kibana)
                          │
               Alerts wake the right person
                  (PagerDuty / Slack)
                          │
              Runbook guides the response
                          │
                    Post-mortem documents
                   what antipattern caused it
```

---

## Key Technologies

| Layer | Technology | Purpose |
|---|---|---|
| Metrics collection | Prometheus | Pull-based scraping, time-series storage |
| Metrics visualization | Grafana | Dashboards, alert rules |
| Distributed tracing | Jaeger / Zipkin | Trace storage and visualization |
| Log aggregation | ELK / Grafana Loki | Log indexing and search |
| Instrumentation SDK | OpenTelemetry | Vendor-neutral OTLP emitter |
| Real-time quota | Redis sorted sets | Sub-millisecond sliding window |
| Usage billing | Kafka + Spark | Exactly-once event processing |
| Health checks | Kubernetes probes | Liveness + readiness |
| Alerting | PagerDuty + Slack | Severity-tiered notifications |
| Security analysis | Kafka + Flink | Real-time event correlation |

---

## Interview Quick Reference

### Performance Antipatterns
- **Chatty I/O**: N+1 queries; fix with DataLoader or eager loading
- **Improper Instantiation**: New pool per request; fix with singleton pattern
- **Retry Storm**: (retries+1)^layers amplification; fix with backoff + jitter + CB
- **Synchronous I/O**: 6.25% CPU efficiency with 150ms I/O; fix with async model

### Monitoring
- **Liveness ≠ Readiness**: liveness → restart; readiness → route traffic
- **Error budget**: 99.9% SLO → 43.2 min/month allowed downtime
- **Never sample**: security events (forensic), billing events (exact counts)
- **Alert pyramid**: symptom (page) > application (ticket) > infrastructure (dashboard)
- **RED**: services; **USE**: resources
- **OTel cardinality**: metrics = low-cardinality labels; traces = any cardinality OK

---

## Files in This Module

| File | Topic |
|---|---|
| 01_Performance Antipatterns Overview.md | Module intro, 11 antipatterns map |
| 02_Busy Database.md | Logic in DB, ORM abuse |
| 03_Busy Frontend.md | Client overload |
| 04_Chatty IO.md | N+1 queries, batching |
| 05_Extraneous Fetching.md | Over-fetching data |
| 06_Improper Instantiation.md | Connection pool per request |
| 07_Monolithic Persistence.md | One DB for everything |
| 08_No-Caching.md | Cache strategy |
| 09_Noisy Neighbor.md | Multi-tenant resource isolation |
| 10_Retry Storm.md | Backoff, jitter, circuit breakers |
| 11_Synchronous IO.md | Async models, event loops |
| 12_Monitoring Overview.md | Three pillars, observability vs monitoring |
| 13_Health Monitoring.md | Liveness vs readiness probes |
| 14_Availability Monitoring.md | Uptime %, error budgets, nines |
| 15_Performance Monitoring.md | Golden signals, p99, SLOs |
| 16_Security Monitoring.md | Auth logs, detection latency |
| 17_Usage Monitoring.md | Quota, billing, lambda architecture |
| 18_Instrumentation.md | OTel, sampling, cardinality |
| 19_Visualization and Alerts.md | RED/USE, alert pyramid, runbooks |
