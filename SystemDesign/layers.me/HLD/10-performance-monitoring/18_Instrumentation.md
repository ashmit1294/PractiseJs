# Instrumentation

## ELI5
Instrumentation is adding measurement devices to your code. A doctor instruments a patient with sensors (heart rate, blood pressure, temperature) to understand what's happening inside. You instrument your app to emit metrics, logs, and traces so you can understand what's happening while it runs.

## Analogy
Aircraft black boxes record flight data (metrics), cockpit audio (logs), and flight path (traces). Instrumentation in software is adding these recording devices — manually writing the code yourself, or using agents that auto-insert them.

---

## Core Concept
**Instrumentation** is the act of adding code (or agents) to a system to emit observability data. Having the right data available when an incident occurs is worth far more than scrambling to add instrumentation after the fact.

---

## Three Pillars and Their Tradeoffs

```
┌──────────────────────────────────────────────────────────────────────────┐
│   PILLAR      │ COST    │ FORMAT          │ USE FOR                      │
├───────────────┼─────────┼─────────────────┼──────────────────────────────┤
│ Metrics       │ Cheap   │ number + labels │ Trends, dashboards, alerts   │
│               │         │ (float64)       │ WHAT happened + WHEN         │
├───────────────┼─────────┼─────────────────┼──────────────────────────────┤
│ Logs          │ Expensive│ structured JSON │ Individual event details    │
│               │         │ (free-form)     │ WHY failed + WHO triggered   │
├───────────────┼─────────┼─────────────────┼──────────────────────────────┤
│ Traces        │ Moderate│ spans + tags    │ Request path across services │
│               │ (sampled)│                │ WHERE is latency coming from │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Instrumentation Approaches

```
1. MANUAL INSTRUMENTATION
   ──────────────────────────────────────────────────────────────────
   Developer explicitly adds metric/log/trace calls in business logic
   Most control, highest effort
   Required for: custom business metrics, domain-specific events

   Example (Prometheus in Node.js):
   const counter = new Counter({ name: 'orders_created_total', help: '...' });
   // In your order creation function:
   counter.inc({ status: 'success', product_type: 'digital' });

2. AUTO-INSTRUMENTATION (opentelemetry-auto-instrumentations)
   ──────────────────────────────────────────────────────────────────
   OpenTelemetry agents instrument frameworks automatically
   Zero code change needed for HTTP, DB, cache, message queue spans
   Best for: framework-level tracing (Express routes, mongoose queries)

   Example (Node.js):
   // Just add at startup — instruments express, pg, redis, etc. automatically
   const { NodeSDK } = require('@opentelemetry/sdk-node');
   const sdk = new NodeSDK({ traceExporter });
   sdk.start();

3. BYTECODE INSTRUMENTATION (Java agents, eBPF)
   ──────────────────────────────────────────────────────────────────
   Modifies bytecode at load time or uses kernel tracing
   Instruments code you don't own (third-party libraries, OS calls)
   eBPF: zero runtime overhead, Linux kernel-level tracing
   Best for: legacy code, vendor libraries, infrastructure-level metrics
```

---

## OpenTelemetry Architecture

```
Your Application (emits OTLP)
       │
       │  OTLP (both gRPC and HTTP supported)
       ▼
┌──────────────────────────────────────────────┐
│         OpenTelemetry Collector               │
│  Receives → Processes → Routes               │
│  ┌─────────────────────────────────────────┐ │
│  │ Pipeline:                               │ │
│  │  receiver → processor → exporter        │ │
│  │  (OTLP)    (batch, filter, sample)      │ │
│  └─────────────────────────────────────────┘ │
└──────────┬─────────────────────┬─────────────┘
           │                     │
     ┌─────▼─────┐         ┌─────▼─────┐
     │ Prometheus │         │   Jaeger  │
     │ (metrics)  │         │  (traces) │
     └─────┬─────┘         └─────┬─────┘
           │                     │
     ┌─────▼─────┐         ┌─────▼─────┐
     │  Grafana  │         │ Grafana   │
     │ Dashboards│         │  Tempo    │
     └───────────┘         └───────────┘
           │
     ┌─────▼─────┐
     │   Loki    │  ← logs via Promtail/alloy
     │  (logs)   │
     └───────────┘

Key benefit: vendor-neutral. Swap backends without changing app code.
```

---

## Context Propagation

```
How trace_id flows across microservices:

Client Request
    │
    │  HTTP: POST /api/place-order
    ▼
┌──────────────────────────────────────────┐
│  API Gateway                             │
│  Generates: trace_id = abc123            │
│             span_id  = g1                │
│  Injects into outbound headers:          │
│    traceparent: 00-abc123-g1-01          │ ← W3C Trace Context standard
└──────┬───────────────────────────────────┘
       │
       │  HTTP call to Order Service
       │  Header: traceparent: 00-abc123-g1-01
       ▼
┌──────────────────────────────────────────┐
│  Order Service                           │
│  Reads trace_id: abc123 from header      │
│  Creates child span: span_id = g2        │
│  parent_span: g1                         │
│  Propagates trace_id to DB call          │
└──────┬───────────────────────────────────┘
       │  DB call carries trace_id
       ▼
  PostgreSQL (if APM agent installed)

Resulting trace:
  trace_id: abc123
    span g1: API Gateway   0ms → 450ms
      span g2: Order Service 5ms → 445ms
        span g3: DB query   10ms → 410ms  ← 400ms bottleneck found!
```

---

## Overhead Calculation

```
Formula:
  Overhead% = (Instrumented_Performance - Baseline) / Baseline × 100

Example:
  Baseline throughput:        10,000 req/s
  Instrumented throughput:    9,600 req/s

  Overhead = (10,000 - 9,600) / 10,000 × 100 = 4%

Targets:
  < 5%   = acceptable for production
  5-15%  = review and reduce verbosity
  > 15%  = significant problem — reduce metric cardinality or sampling rate

Reduction strategies:
  - Increase sampling rate threshold (only trace requests > 100ms)
  - Aggregate metrics in-process before sending
  - Use tail-based sampling (decide AFTER request completes)
  - Batch export (send every 10s instead of every request)
```

---

## Sampling Strategies

```
HEAD-BASED SAMPLING (decide at start of request):
  Pros: Simple, deterministic; agent makes one decision
  Cons: Can't keep only "interesting" requests — decided upfront
  Use: 1% uniform random sample for baseline volume

TAIL-BASED SAMPLING (decide after request completes):
  Pros: Keep 100% of errors and slow requests; sample normal ones
  Cons: Must buffer all spans in memory until root span finishes
  Use: errors → 100%, >1s latency → 100%, normal → 1%

  Rate formula:
  sample_rate = target_volume / total_volume
              = 1,000 traces/s / 100,000 req/s
              = 1% base rate
  Then: errors override to 100% regardless of rate
```

---

## Cardinality Management

```
Formula:
  Total series = ∏(unique values per dimension)

LOW CARDINALITY (good for always-on metrics):
  service(10) × region(5) × status_code(10)
  = 500 metric series → completely manageable

HIGH CARDINALITY (only in traces/logs, not metrics):
  Add user_id: 10M users → 10M × 10 × 5 = 500M series
  → PromQL breaks, Prometheus OOM

RULE:
  Metric labels: only low-cardinality (service, region, method, status)
  Trace tags: any cardinality OK (user_id, order_id, request_id)
  Log fields: any cardinality OK (indexed carefully)

Stripe policy: hard limit of 1,000 unique label combinations per metric.
```

---

## Metric Naming Convention

```
Format: namespace.subsystem.metric_name.unit

Examples:
  http_server_requests_total           (counter)
  http_server_request_duration_seconds (histogram)
  db_connection_pool_active_connections (gauge)
  cache_hit_rate_ratio                  (gauge, 0.0-1.0)

Mandatory labels (low-cardinality only):
  {service="payment-api", region="us-east-1", version="v2.1.0"}

Metric types:
  Counter:   Only increases (total requests, total errors)
  Gauge:     Up or down (current connections, memory usage)
  Histogram: Distribution buckets (request duration → p50/p95/p99)
  Summary:   Pre-calculated quantiles (less flexible than histogram)
```

---

## Mandatory Service Endpoints

```
Every service must expose:

GET /metrics          Prometheus scrape endpoint
  Content-Type: text/plain; version=0.0.4
  Returns: all registered metrics in Prometheus format

GET /health           Liveness probe (shallow)
  Returns: 200 OK always if process is alive
  Body: {"status": "healthy", "uptime": 3600}

GET /ready            Readiness probe (deep)
  Returns: 200 if can serve traffic, 503 if not
  Body: {"status": "healthy", "checks": {...}}

These must exist BEFORE any business routes.
Airbnb enforces via CI/CD pipeline checks.
```

---

## Real-World Examples

| Company | Approach | Key Detail |
|---|---|---|
| Netflix | Adaptive sampling (Mantis) | Dynamically adjusts from 1% normal → 100% during incidents without redeployment |
| Uber | Jaeger for 4,000+ microservices | Context propagation across all service boundaries enables complete trace reconstruction |
| Airbnb | Enforced via code review + CI | Every PR checked: does service expose /metrics, /health, and trace context propagation? |
| Datadog | Auto-instrumentation agents | Agent installed alongside process instruments all common frameworks without code changes |

---

## Interview Cheat Sheet

**Q: What is OpenTelemetry and why has it become the standard?**

> A: OpenTelemetry is a vendor-neutral instrumentation framework providing APIs, SDKs, and wire protocol (OTLP) for emitting metrics, logs, and traces. The key insight: instrument your code once against the OTel API, and route data to any backend (Prometheus, Jaeger, Datadog, New Relic) by reconfiguring the OpenTelemetry Collector — without changing application code. This solves vendor lock-in: previously, switching from Datadog to Prometheus required rewriting all instrumentation. OTel is now the CNCF standard and supported by all major observability vendors.

**Q: What is distributed trace context propagation and why is it hard?**

> A: When a request enters your API gateway, generate a trace_id and span_id, then inject them into outbound HTTP headers (W3C standard: `traceparent`). Every downstream service reads these headers, creates a child span (with parent_span_id = caller's span_id), and continues propagating. The challenge: every service boundary, every queue message, every async job must correctly forward these headers — one gap breaks the trace chain. Libraries, thread pools, and async code can drop context. OpenTelemetry SDK handles most of this automatically for common frameworks.

**Q: How do you manage metric cardinality to prevent Prometheus OOM?**

> A: Cardinality is the product of unique values across all label dimensions. Adding a `user_id` label to a metric transforms 500 series into 500 million — Prometheus runs out of memory. Rule: only low-cardinality labels in metrics (service, region, status_code, version). For high-cardinality analysis (per-user, per-order), use traces and logs which are indexed differently. Stripe enforces a hard limit of 1,000 unique label combinations per metric in their CI pipeline.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **Instrumentation** | Adding measurement code/agents to emit metrics, logs, and traces from an application |
| **OpenTelemetry (OTel)** | CNCF vendor-neutral framework for instrumentation; produces OTLP data routable to any backend |
| **OTLP** | OpenTelemetry Protocol — wire format for transmitting metrics/logs/traces to collectors |
| **Auto-instrumentation** | OTel agent that instruments frameworks automatically without code changes |
| **Context propagation** | Forwarding trace_id + span_id across service boundaries via HTTP headers |
| **W3C Trace Context** | Standard HTTP headers for trace propagation: `traceparent` and `tracestate` |
| **Head-based sampling** | Sampling decision made at the start of a request — simple but blind to outcome |
| **Tail-based sampling** | Sampling decision made after request completes — can keep all errors, sample normals |
| **Cardinality** | Number of unique metric time series — high cardinality crashes metric stores |
| **eBPF** | Linux kernel technology for zero-overhead infrastructure instrumentation |
