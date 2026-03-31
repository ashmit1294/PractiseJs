# Usage Monitoring

## ELI5
Usage monitoring is like a phone carrier tracking your data plan: how much data you've used today (real-time quota), your monthly bill (accurate billing), and which apps use the most data (product analytics). These three needs are different: billing needs to be exact, quota checks need to be fast, and analytics need long-term history.

## Analogy
A utility company reads your meter in real-time (quota: don't exceed limits), bills you monthly (batch: exact charges), and studies usage patterns by neighborhood (analytics: capacity planning). Three separate systems, same underlying data.

---

## Core Concept
**Usage monitoring** tracks WHAT is used, HOW MUCH, and BY WHOM to enable: billing, quota enforcement, capacity planning, and product analytics. Unlike performance monitoring, billing and quota events are NEVER sampled — every API call must be counted exactly.

---

## Three Use Cases Requiring Different Architectures

```
┌─────────────────────────────────────────────────────────────────────┐
│   USE CASE        │ LATENCY  │ ACCURACY │ RETENTION │ SYSTEM       │
├───────────────────┼──────────┼──────────┼───────────┼──────────────┤
│ Quota Enforcement │ <100ms   │ Approx.  │ Current   │ Redis        │
│                   │ (inline) │ OK ±2%   │ period    │ sliding win  │
├───────────────────┼──────────┼──────────┼───────────┼──────────────┤
│ Billing           │ Hours    │ Exact    │ 7 years   │ Kafka+Spark  │
│                   │ (batch)  │ required │ (finance) │ (batch)      │
├───────────────────┼──────────┼──────────┼───────────┼──────────────┤
│ Product Analytics │ Minutes  │ Approx.  │ Forever   │ ClickHouse   │
│                   │ (stream) │ OK       │ (trends)  │ (columnar)   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Lambda Architecture for Usage

```
                     ┌─────────────────────────────────────────┐
API Request          │         SPEED LAYER (Real-time)         │
    │                │  Redis sliding window                   │
    ├───────────────►│  • Check quota before serving           │
    │ enforce?       │  • ZADD user:X:requests timestamp score │
    │                │  • ZREMRANGEBYSCORE (remove old entries) │
    │ yes/no         │  • ZCARD (count) vs quota limit         │
    │◄───────────────│  Latency: < 1ms                        │
    │                └─────────────────────────────────────────┘
    │
    │ serve request
    │
    ├── emit event to Kafka (async, non-blocking)
    │   {user_id, endpoint, bytes, timestamp, status}
    │
    ▼                ┌─────────────────────────────────────────┐
"200 OK"            │         BATCH LAYER (Nightly)           │
(user doesn't wait  │  Spark job processes Kafka events       │
 for billing to    │  • Exactly-once semantics               │
 complete)          │  • Aggregate by tenant, product, period │
                    │  • Write to billing DB                  │
                    │  • Generate invoices                    │
                    │  Accuracy: exact (re-processable)       │
                    └─────────────────────────────────────────┘
```

---

## Redis Quota Implementation

```javascript
// Sliding window rate limiting with Redis sorted sets
// Key: "usage:{userId}:{windowKey}"
// Value: sorted set of (timestamp → request_id entries)

async function checkAndRecordUsage(userId, endpoint, quotaLimit) {
  const now = Date.now();
  const windowStart = now - 60 * 1000; // 1-minute sliding window
  const key = `usage:${userId}:${endpoint}`;

  const pipeline = redis.pipeline();
  pipeline.zadd(key, now, `${now}-${Math.random()}`);          // record request
  pipeline.zremrangebyscore(key, '-inf', windowStart);          // remove old entries
  pipeline.zcard(key);                                          // count current window
  pipeline.expire(key, 120);                                    // TTL cleanup

  const results = await pipeline.exec();
  const currentCount = results[2][1]; // zcard result

  if (currentCount > quotaLimit) {
    return { allowed: false, currentCount, limit: quotaLimit };
  }
  return { allowed: true, currentCount, limit: quotaLimit };
}
```

---

## Async Event Emission (Never Block API Response)

```javascript
class UsageEventEmitter {
  constructor(kafkaProducer) {
    this.producer = kafkaProducer;
    this.buffer = [];
    this.flushInterval = 100; // ms
    this.circuitOpen = false;

    setInterval(() => this.flush(), this.flushInterval);
  }

  emit(event) {
    // NEVER await this in API handler — don't block user response
    this.buffer.push({
      userId: event.userId,
      endpoint: event.endpoint,
      timestamp: Date.now(),
      responseBytes: event.bytes,
      statusCode: event.status,
    });
  }

  async flush() {
    if (this.circuitOpen || this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);
    try {
      await this.producer.sendBatch({
        topicMessages: [{ topic: 'usage-events', messages: batch }]
      });
    } catch (err) {
      // Circuit breaker: if Kafka is down, don't crash API
      this.circuitOpen = true;
      setTimeout(() => { this.circuitOpen = false; }, 30000);
      // Optionally: write to local disk as fallback
    }
  }
}

// In Express middleware:
app.use((req, res, next) => {
  res.on('finish', () => {
    usageEmitter.emit({
      userId: req.user?.id,
      endpoint: `${req.method} ${req.route?.path}`,
      bytes: parseInt(res.get('Content-Length')) || 0,
      status: res.statusCode,
    });
  });
  next();
});
```

---

## Multi-Dimensional Aggregation

```
Dimensions: tenant × endpoint × region × status_code × date

Pre-aggregated (cheap to query, limited flexibility):
  daily_totals: { tenant: "acme", endpoint: "/api/v1/orders", count: 48,000 }

On-demand (flexible, expensive):
  SELECT tenant, endpoint, SUM(count) FROM usage_events
  WHERE date >= '2024-01-01' GROUP BY tenant, endpoint
  → Use ClickHouse / BigQuery for columnar scan speed

Cardinality management:
  1,000 tenants × 50 endpoints = 50,000 combinations (manageable)
  Add user_id = 10M+ combinations → pre-aggregate impossible → sample analytics
```

---

## Data Retention Strategy

```
RAW EVENTS (Kafka → S3)
  Retention: 7-30 days
  Use: dispute resolution ("you charged me wrong!")
  Format: compressed JSON (10× size reduction with zstd)

HOURLY AGGREGATES (ClickHouse)
  Retention: 1 year
  Use: billing calculations, monthly invoices
  Format: columnar (Parquet), 10× cheaper than row-based

DAILY AGGREGATES (Data warehouse)
  Retention: forever
  Use: capacity planning, trend analysis, product decisions
  Format: ClickHouse / BigQuery / Snowflake

GDPR Compliance:
  Hash user_ids before long-term storage: sha256(user_id + salt)
  Purpose limitation: usage data ≠ marketing data — separate pipelines
  Right to erasure: delete raw events; aggregates anonymized so deletion N/A
```

---

## Fail Open vs Fail Closed for Quotas

```
Scenario: Quota service is unavailable for 30 seconds

FAIL OPEN (allow requests, risk overages):
  Pro: Users experience no interruption
  Con: Could allow 2× billed usage by paying customers
  Use when: Outage is brief and overages are correctable

FAIL CLOSED (reject requests):
  Pro: Strict enforcement, no overages
  Con: 100% of users blocked even though quota service may be fine
  Use when: Hard limits (security-critical, pay-as-you-go overage risk)

BEST PRACTICE:
  Use fail-open for brief outages (<30s) with overage detection
  Use fail-closed after extended outage (signal: something is wrong)
  Offer quota forgiveness for confirmed platform outage periods
```

---

## Real-World Examples

| Company | Architecture | Key Fact |
|---|---|---|
| Stripe | Redis (real-time) + Kafka/Flink (streaming) + Spark (batch) | S3 raw logs kept 7 days for payment dispute resolution |
| Netflix | Multi-resolution: per-second (A/B tests), per-minute (monitoring), per-hour (capacity), per-day (content) | 4 different aggregation time windows for different use cases |
| AWS CloudWatch | Hierarchical: resource → account → organization | Custom namespaces for customer applications |
| Twilio | Kafka event stream → real-time quota + nightly billing | Idempotent message keys prevent double-billing on retries |

---

## Interview Cheat Sheet

**Q: Why do billing systems use batch processing while quota systems use real-time?**

> A: Billing requires exact counts with exactly-once semantics — a Spark batch job can re-process Kafka events idempotently and generate perfectly accurate invoices. Real-time systems like Redis sliding windows are approximate (±2%) due to race conditions at scale. Billing waits hours for this exactness; quota enforcement needs sub-millisecond decisions that happen inline with every API request. Speed requirement vs. accuracy requirement drive the architecture choice.

**Q: How do you avoid blocking API responses while still tracking every request?**

> A: Use async event emission with a local in-memory buffer. The API handler records usage in a local buffer (non-blocking, <1μs). A background interval (every 100ms) flushes the buffer to Kafka as a batch. The API response returns to the user while the Kafka write happens asynchronously. Add a circuit breaker: if Kafka is unavailable, stop trying and accept that some events may be lost during the outage, recovering from raw access logs later.

**Q: What's a sliding window and why use it for quota enforcement?**

> A: A sliding window tracks requests in the most recent N seconds (e.g., last 60 seconds). Unlike a fixed window (which resets at :00 every minute, allowing 2× burst across a boundary), sliding windows provide consistent enforcement: at any point in time, the count of requests in the last 60 seconds cannot exceed the limit. Implementation: Redis sorted set with timestamps as scores; add new requests, remove entries older than 60s, count remaining.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **Lambda architecture** | Combining real-time (speed) layer with batch layer — accuracy of batch + speed of real-time |
| **Sliding window** | Rate limiting technique tracking requests in the last N seconds — no boundary burst |
| **Quota enforcement** | Blocking requests that exceed allowed usage limits; requires real-time Redis lookup |
| **Exactly-once semantics** | Guarantee that each event is processed exactly once — critical for billing accuracy |
| **Idempotency key** | Unique identifier ensuring re-processing produces the same result — prevents double billing |
| **ClickHouse** | Columnar database optimized for analytics on time-series aggregates — 10× cheaper than row-based |
| **Fail open** | Allowing requests when quota system is unavailable — accepts risk of overages |
| **Fail closed** | Blocking requests when quota system is unavailable — accepts degraded user experience |
| **Cardinality explosion** | Adding high-cardinality dimensions (user_id) to aggregations makes pre-aggregation impractical |
| **Circuit breaker** | Stops emitting to Kafka if it's unavailable, preventing API slowdown during Kafka outages |
