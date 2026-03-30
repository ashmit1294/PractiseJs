# Backpressure in Distributed Systems Explained

> **Source**: https://layrs.me/course/hld/08-asynchronous-processing/back-pressure  
> **Difficulty**: Intermediate | **Read time**: 14 min

---

## ELI5

Imagine a water hose (producer) filling a bucket (queue) that has a small hole (consumer processing). If the hose runs faster than the hole drains, the bucket overflows — things crash. **Back-pressure** is a float valve inside the bucket: when water reaches 80%, the valve partially closes the hose, preventing overflow. When the bucket drains, it opens again.

---

## Analogy — Traffic Light Ahead of a Bottleneck

A motorway narrows from 4 lanes to 1 (slow consumer). Without control, all cars drive at full speed into the bottleneck and pile up. Back-pressure = sensors trigger traffic signals 5km before the bottleneck, metering cars in at the rate the bottleneck can absorb. No pile-up. The metering signal IS the back-pressure.

---

## Core Concept

**Back-pressure** is a **reactive** flow control mechanism:
- **Rate limiting** = *proactive* — fixed cap regardless of actual consumer speed
- **Back-pressure** = *reactive* — responds to actual consumer capacity in real-time

```
Rate Limiting (proactive):
  Client sends 1500/s → Rate Limiter caps at 1000/s → rejects 500 (429)
  Even if service can handle 2000/s, it still rejects at 1000

Back-pressure (reactive):
  Producer sends 3000/s → Queue fills → Consumer doing 500/s
  → Queue signals: "I'm 80% full" → Producer throttles to ~500/s
  → Queue drains → Producer resumes full speed
```

> **Use both**: rate limiting prevents abuse; back-pressure handles legitimate overload.

---

## How It Works — 4-Stage Lifecycle

```
Stage 1 — DETECTION
  Queue monitor detects buffer ≥ 80% capacity threshold

Stage 2 — SIGNALING  
  Signal propagates to producer:
    TCP:              receive window shrinks to 0 → sender blocks
    Message queue:    QueueFull error / basic.nack returned
    Reactive Streams: consumer sends request(N) demand signal
    HTTP:             503 Service Unavailable + Retry-After header

Stage 3 — PRODUCER RESPONSE
  Producer must choose from:
    Block   → wait until space frees (preserves all data, adds latency)
    Drop    → discard overflow messages (loses data, maintains throughput)
    Buffer  → store locally (shifts problem to producer's RAM)
    Error   → return 503 to upstream clients (propagate back-pressure up the chain)

Stage 4 — RECOVERY
  Consumer catches up → queue drains below threshold → back-pressure releases
  Producer resumes full speed → steady state
```

---

## Back-Pressure Strategies

| Strategy | Mechanism | Data Loss? | Latency Impact | Use For |
|---|---|---|---|---|
| **Blocking** | Producer thread blocks until space available | ❌ Never | ⬆️ High | Payments, order processing, critical data |
| **Buffering** | Add intermediate buffer/reservoir to absorb spikes | ❌ (until buffer full) | ⬆️ Moderate | Flash sales, temporary spikes |
| **Dropping** | Discard overflow messages | ✅ Yes | ⬇️ None | Metrics, logs, real-time telemetry, video frames |
| **Signaling** | Reactive Streams request(N) protocol | ❌ Never | ⬆️ Minimal | In-process streams (Akka, RxJava) |

### Decision Matrix

```
                    Can you lose this data?
                    YES                 NO
                ┌───────────────┬────────────────────┐
Latency         │               │                    │
spike OK?  YES  │  Buffer+TTL   │  Blocking          │
                │  (logs, 7d    │  (payments, orders)│
                │   retention)  │                    │
           NO   │  Drop         │  Buffer+Auto-scale │
                │  (metrics,    │  (flash sale with  │
                │   live video) │   elastic workers) │
                └───────────────┴────────────────────┘
```

### Specific Policies for Dropping

| Policy | Rule | Use When |
|---|---|---|
| **Tail drop** | Drop newest messages | Old data still valuable (logs) |
| **Head drop** | Drop oldest messages | Fresh data preferred (location, sensor readings) |
| **Random Early Detection (RED)** | Probabilistically drop as queue fills | Avoid synchronised collapse |
| **Priority-based** | Drop low-priority first | Mixed workloads (drop analytics, keep checkout) |

---

## Back-Pressure Propagation — It Cascades

```
Database (slow) → back-pressures → Inventory Service
                                       │
                                       v
                  back-pressures → Message Queue
                                       │
                                       v
                  back-pressures → Order API Server
                                       │
                                       v
                  back-pressures → Load Balancer (503s)
                                       │
                                       v
                  back-pressures → Client (Retry-After)
```

**Each layer must honour the signal.** A layer that ignores back-pressure (unbounded queue, unbounded thread pool) becomes the point of collapse.

---

## Key Principles

**1. Bounded buffers are non-negotiable**  
Unbounded queues hide problems until memory exhausts and the process crashes. Bounded queues force an explicit decision: what do you do when full? Make that decision deliberately.

**2. Monitor back-pressure as a leading indicator**  
Frequent back-pressure events = system operating near capacity = signal to scale consumers BEFORE outage. Set alerts at 80% queue fullness, not 100%.

**3. Choose strategy per data type**  
- Financial transactions → blocking  
- Flash sale orders → buffer + auto-scale  
- Metrics/counters → drop (lossy is fine)  
- Real-time video frames → head-drop (stale frames are worse than dropped frames)

**4. Back-pressure ≠ rate limiting**  
Rate limiting caps throughput proactively. Back-pressure responds to actual capacity reactively. Your system needs both.

---

## Real-World Examples

### Amazon API Gateway
Returns HTTP `429 Too Many Requests` + `Retry-After` header when burst limit exceeded. Token bucket smooths traffic before it hits Lambda. Client forced to implement exponential backoff. Result: Lambda protected from stampede.

### Netflix Hystrix / Resilience4j
Each downstream service gets a dedicated thread pool (bulkhead). When pool is exhausted (threads blocked on slow responses), new requests fail fast with fallback. Circuit breaker opens after N failures — requests immediately fail until service recovers.

### Uber — Surge Pricing
Pricing service overloaded → rides queue up (clients see "Finding a driver…"). Blocking back-pressure: orders held, never dropped — because dropping = wrong price applied to a ride.

### Uber — Driver Location Updates
Real-time location updates use **head-drop**: if consumer is slow, old locations discarded, newest kept. Stale data is worse than slightly delayed data for mapping accuracy.

---

## MERN Dev Notes

```javascript
// BullMQ — bounded queue with back-pressure
import { Queue } from 'bullmq';

const queue = new Queue('orders', {
  connection: redisClient,
  defaultJobOptions: {
    removeOnComplete: 100,   // keep only last 100 completed
    removeOnFail: 500,       // keep last 500 failed for debugging
  }
});

// Check queue depth before enqueuing (soft back-pressure at API layer)
app.post('/orders', async (req, res) => {
  const waiting = await queue.getWaitingCount();
  if (waiting > 50_000) {                          // bounded check
    return res.status(503).json({
      error: 'System busy',
      retryAfter: 30
    });
  }
  await queue.add('process-order', req.body);
  res.status(202).json({ queued: true });
});
```

> **MERN dev note**: Redis `XLEN` (streams) or BullMQ `getWaitingCount()` gives real-time queue depth. Wire this to your `/health` endpoint — downstream API gateways can check it before routing.

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| What is back-pressure? | Reactive flow control: when a consumer can't keep up, it signals producers to slow down; prevents unbounded queue growth and OOM crashes |
| Back-pressure vs rate limiting? | Rate limiting is proactive (fixed cap regardless of capacity); back-pressure is reactive (responds to actual consumer speed). Both are needed: rate limiting prevents abuse, back-pressure handles legitimate overload |
| What are the 4 back-pressure strategies? | Blocking (preserve data, add latency), Buffering (absorb temporary spikes), Dropping (lose data, maintain throughput), Signaling (reactive streams request(N)) |
| When would you drop messages instead of block? | When data is ephemeral/redundant: metrics, logs, real-time sensor readings, video frames. Never for financial transactions or state-changing operations |
| What are unbounded queues and why are they dangerous? | Queues with no size limit; hide back-pressure problems until RAM exhausts and process crashes; always use bounded queues with explicit overflow policy |
| How does back-pressure propagate? | Cascades upstream: slow DB → back-pressures API → back-pressures load balancer → 503s to clients; each layer must honour the signal |
| What is a leading indicator of back-pressure? | Queue depth / buffer fill ratio; monitor at 80% threshold; frequent back-pressure events signal need to scale consumers before full outage |

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Back-pressure** | Reactive signal from slow consumer to fast producer to reduce send rate |
| **Rate limiting** | Proactive cap on throughput regardless of consumer capacity |
| **Bounded buffer** | Queue with a hard size limit that enforces overflow policy |
| **Blocking** | Producer waits (thread-blocks) until buffer space is available |
| **Dropping** | Discarding messages when buffer is full; accepts data loss |
| **Tail drop** | Drop newest messages when full (keep existing) |
| **Head drop** | Drop oldest messages when full (keep fresh) |
| **RED (Random Early Detection)** | Probabilistic dropping before buffer completely fills; prevents synchronised collapse |
| **Bulkhead pattern** | Dedicated thread pool per downstream service; prevents one slow service from consuming all threads |
| **Circuit breaker** | Fails fast when a service is unhealthy; pairs with back-pressure to prevent cascade |
| **request(N)** | Reactive Streams protocol: consumer signals how many items it can process next |
| **Thundering herd** | Many processes simultaneously hit a recovering service; jitter and backoff prevent this |
