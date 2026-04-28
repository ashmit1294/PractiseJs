# T09 — Queue-Based Load Leveling Pattern

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/queue-based-load-leveling

---

## ELI5 (Explain Like I'm 5)

Imagine a water reservoir. Heavy rain (traffic spike) fills the reservoir. A water treatment plant downstream processes water at a steady pace regardless of how hard it's raining. Without the reservoir, a big rainstorm would flood and crash the plant. The reservoir *absorbs the spike* so the plant works at a safe, constant rate.

Queue-based load leveling is the reservoir for your system: incoming requests pile up safely in a queue, and your downstream service processes them at its own sustainable pace.

---

## Analogy

**Post office mail room**: Thousands of packages arrive on Black Friday. The mail room queues them. Sorters process packages at a steady rate — not faster just because 100 packages arrived at once. Customers get a "we received your package" confirmation immediately; actual processing takes time.

---

## Core Concept

Queue-based load leveling **inserts a durable message queue between producers and consumers**, decoupling request arrival rate from processing rate. Producers write to the queue and return immediately. Consumers pull from the queue at their own sustainable capacity.

**The key insight**: temporary queue buildup is acceptable as long as messages are eventually processed within SLA requirements. Instead of "how do we handle 10,000 req/sec right now?", the question becomes "how do we process 10,000 messages over the next few minutes?"

**Mathematical sizing**: 
- Spike: 1,000 msg/sec for 5 minutes = 300,000 total messages
- Consumer processes: 200 msg/sec each
- Net accumulation: (1,000 - 200) × 300s = 240,000 messages
- Queue capacity needed: 240,000 × 2 (safety margin) = 480,000

---

## ASCII Diagrams

### Before Queue (Synchronous Failure)

```
Flash Sale: 10,000 req/sec
  
  [Client x10000] ──── HTTP POST ────► [Web Service] ──── sync call ────► [Payment Service]
                                                                           50 req/sec LIMIT
                                                                           ████████████ OVERLOADED
                                                                           → Connection pool full
                                                                           → 503 errors
                                                                           → Database exhausted
```

### After Queue (Buffered Processing)

```
Flash Sale: 10,000 req/sec

  [Client x10000] ──► [Web Service] ──► [Queue (SQS/Kafka)] ──► [Consumer x10]
                           │                                         │
                      202 Accepted                            50 msg/sec each
                      (5-20ms)                                = 500 msg/sec total

Queue depth grows: [████░░░░░░] 40% → [██████████] 90% → triggers auto-scale
Auto-scaler reads: ApproximateNumberOfMessages CloudWatch metric
Scales consumers: 10 → 100 instances → drains queue within SLA
```

### Queue Sizing Calculation

```
Input Parameters:
  Peak Rate: 1,000 msg/sec
  Spike Duration: 5 min (300s)
  Consumer Rate: 50 msg/sec each
  SLA: Process within 10 min (600s)

Total spike messages: 1,000 × 300 = 300,000
Processing capacity: 50 msg/s × N consumers

Required consumers to drain in SLA:
  Messages to drain = 300,000
  Time: 600s
  300,000 / (50 × 600) = 10 consumers needed

Scale-up threshold: 50 msg/s × 600s = 30,000 messages
Scale-down threshold: < 1,000 messages for 10+ minutes (prevent thrashing)
Queue capacity needed: 300,000 × 2 = 600,000 (2x safety margin)
```

---

## How It Works (Step by Step)

1. **Producer publishes to queue (5-20ms)**: Rather than making a synchronous call, the web service writes a message to the queue and immediately returns `202 Accepted` to the client. The producer's responsibility ends here — it doesn't wait for processing.

2. **Queue buffers messages durably**: Queue stores messages persistently. Depth grows during spikes (100 → 10,000 → 50,000). Queue depth is a visible health metric — monitoring it gives early warning of overload.

3. **Consumers pull at sustainable rate**: Each consumer polls the queue and processes at its natural capacity (50 msg/sec). Consumer rate is independent of how fast producers are adding messages. Failed messages are retried (with backoff) then moved to DLQ.

4. **Auto-scale based on queue depth**: Monitor `queue_depth` and `oldest_message_age`. When depth > 30,000 OR age > SLA_minutes, scale up consumers. Scale down when depth < 1,000 for 10+ minutes (hysteresis prevents thrashing).

5. **Queue drains below threshold**: As consumers process faster than new arrivals, depth decreases. System scales back down. End-to-end flow: spike absorbed → backlog processed → system returns to steady state.

---

## Variants

| Variant | Description | When to Use |
|---------|-------------|-------------|
| **Priority Queue Leveling** | Multiple queues per priority level; dedicated consumers per tier | VIP customers need <1min SLA; standard need <10min |
| **Batch Processing Leveling** | Consumers pull batches (100 msgs) and process as a bulk insert | High-throughput analytics, ETL — throughput >> individual latency |
| **Adaptive Rate Limiting** | When queue depth > 80% capacity, return HTTP 429 to producers | When queue itself could overflow during extreme spikes |

---

## Trade-offs

| Dimension | Queue-Based | Synchronous |
|-----------|------------|-------------|
| **Latency** | Seconds–minutes (acceptable for async ops) | Milliseconds (required for user-facing) |
| **Throughput** | High — handles 100x spikes | Limited by downstream capacity |
| **Resilience** | Downstream can be down for minutes; no request loss | Downstream down = requests fail |
| **Complexity** | Queue infra, DLQ, idempotency, monitoring | Simple direct call |
| **Visibility** | Queue depth = explicit load indicator | Latency/error rate only signal |

**Scaling metric**: Scale on **queue depth**, NOT CPU. CPU on the consumer instance will be low when the queue is empty; it's not predictive of upcoming load.

---

## When to Use (and When Not To)

**Use when:**
- Traffic spikes are 5-100x above baseline (flash sales, viral content, batch job submissions)
- Operations are asynchronous — user doesn't need immediate result (order processing, email, export, analytics)
- Downstream services have limited capacity that can't scale instantly (legacy DBs, 3rd-party API rate limits)
- Multiple consumers need to process the same events at different rates

**Avoid when:**
- User expects immediate feedback (login, search, page render) — added latency breaks UX
- Low-traffic systems with predictable load — complexity outweighs benefits (<100 req/sec, no spikes)
- Message ordering is critical and your queue can't guarantee it (most queues: best-effort only)
- Latency SLA is sub-second — queue adds inherent latency that may violate requirements

**Anti-patterns:**
- Sizing queues for average traffic (will overflow during spikes — size for 99th-percentile peak × 2x)
- No idempotency in consumers (duplicate message delivery causes data corruption)
- Scaling consumers on CPU instead of queue depth (wrong metric)
- No DLQ for poison messages (one bad message blocks the queue)

---

## MERN Developer Notes

```javascript
// Producer — publishes to SQS, returns 202 immediately
app.post('/checkout', async (req, res) => {
  const orderId = generateUUID();
  
  await sqs.sendMessage({
    QueueUrl: process.env.CHECKOUT_QUEUE_URL,
    MessageBody: JSON.stringify({ orderId, userId: req.user.id, cart: req.body.cart }),
    MessageDeduplicationId: orderId,  // idempotency for FIFO queues
    MessageGroupId: req.user.id       // FIFO ordering per user if needed
  }).promise();
  
  res.status(202).json({ orderId, message: 'Order queued for processing' });
  // Done. No waiting for payment processing.
});

// Consumer — processes at sustainable rate
async function processQueue() {
  const { Messages } = await sqs.receiveMessage({
    QueueUrl: process.env.CHECKOUT_QUEUE_URL,
    MaxNumberOfMessages: 10,       // batch pull: up to 10 at once
    WaitTimeSeconds: 20            // long polling: wait up to 20s for messages
  }).promise();

  for (const msg of Messages || []) {
    const order = JSON.parse(msg.Body);
    
    try {
      // Idempotency check — safe to process twice
      const processed = await redis.get(`order-processed:${order.orderId}`);
      if (!processed) {
        await paymentService.charge(order);
        await inventoryService.reserve(order);
        await redis.set(`order-processed:${order.orderId}`, '1', 'EX', 86400);
      }
      
      await sqs.deleteMessage({
        QueueUrl: process.env.CHECKOUT_QUEUE_URL,
        ReceiptHandle: msg.ReceiptHandle
      }).promise();
    } catch (err) {
      // Don't delete — SQS will make message visible again after visibility timeout
      // After N failures: auto-moves to DLQ
      console.error('Processing failed:', err);
    }
  }
}

// Auto-scaling trigger (Lambda or CloudWatch Alarm → ASG policy)
// Scale up metric: ApproximateNumberOfMessages > 30000
// Scale down metric: ApproximateNumberOfMessages < 1000 for 10 min
```

---

## Real-World Examples

| Company | Implementation | Key Detail |
|---------|---------------|-----------|
| **Airbnb** | Booking pipeline during event spikes | Paris Olympics announcement → 60x spike, queue grew from 500 to 30,000 messages in 10 min. Consumers scaled 10→100 instances over 15 min, processed backlog within 5-min SLA. Estimated $200K saved vs. keeping synchronous peak capacity. |
| **Stripe** | Webhook delivery | Queue buffers webhooks for merchant endpoints. During 2023 cloud outage: 2M webhooks buffered for 6h, auto-drained as endpoints recovered. Zero event loss → maintained 99.99% delivery SLA. Retry with exponential backoff (1min, 5min, 30min). |
| **Netflix** | Video encoding | Uploads published to priority queues (urgent: new releases; standard: catalog). During major series launch, urgent queue grew to 50,000 jobs. 80% encoding capacity allocated to urgent queue. Standard work deferred to off-peak. |

---

## Interview Cheat Sheet

### Q: Calculate queue sizing — system receives 10,000 req/sec during spikes
**A:** Need spike duration and consumer rate. Example: 10K req/sec for 5 min, consumer processes 100 msg/sec each:
- Total messages: 10,000 × 300s = 3,000,000
- To drain in 10 min: 3,000,000 / 600s = 5,000 msg/sec needed
- Consumers needed: 5,000 / 100 = 50 consumers
- Queue capacity: 3,000,000 × 2 (safety) = 6,000,000
- Scale-up threshold: 100 msg/s × 600s = 60,000 messages

### Q: What happens if the queue fills up completely?
**A:** Three options: (1) Adaptive rate limiting — return HTTP 429 to producers with `Retry-After` header; (2) increase queue capacity (SQS: effectively unlimited; Kafka: more disk); (3) shed low-priority messages (drop analytics, keep payments). The right answer depends on whether data loss is acceptable.

### Q: When would you choose a queue over a load balancer?
**A:** Queue for asynchronous work with unpredictable spikes (order processing, email, report generation). Load balancer for synchronous requests where the user waits for a response (search, login, page load). They're not mutually exclusive — load balancer distributes traffic to web tier, queue decouples web tier from background processing tier.

### Q: How do you handle messages that fail repeatedly (poison messages)?
**A:** Dead-Letter Queue strategy: max retry attempts (3–5x) with exponential backoff (30s, 1m, 5m). After max retries, move to DLQ. Alert on-call engineer. Preserve original message + error context for debugging. Never silently drop — DLQ is your safety net for data integrity audit.

---

## Red Flags to Avoid

- Sizing queues for average load (spike sizing is what matters)
- No idempotency in consumers ("what happens if this message is delivered twice?")
- Scaling consumers based on CPU rather than queue depth
- No DLQ strategy for poison messages
- Using queues for synchronous user-facing operations
- Ignoring message age metric (queue depth alone misses delayed processing)

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Queue-Based Load Leveling** | Pattern using a queue to buffer work between producers and consumers, decoupling arrival rate from processing rate |
| **Temporal Coupling** | When producer send rate directly dictates required consumer processing rate — the problem this pattern solves |
| **Queue Depth** | Number of messages currently in a queue; primary metric for auto-scaling consumer instances |
| **Message Age** | How long the oldest unprocessed message has been waiting; signals when consumers aren't keeping up with SLA |
| **Visibility Timeout** | SQS concept: when a consumer starts processing a message, it becomes invisible to other consumers for N seconds; if not deleted, it reappears for retry |
| **Dead-Letter Queue (DLQ)** | Destination queue for messages that exceeded max retry attempts; used for investigation and alerting |
| **Idempotency** | Processing the same message N times produces the same result; required because at-least-once delivery may duplicate messages |
| **Hysteresis** | Using separate scale-up and scale-down thresholds (30K up, 1K down) to prevent thrashing (rapid scaling oscillation) |
| **Long Polling** | Consumer polls queue and waits up to 20s for a message to arrive (vs. immediate return if empty); reduces cost and CPU |
| **202 Accepted** | HTTP status returned to client when request is queued but not yet processed; communicates async processing |
| **Backpressure** | Mechanism where queue depth → producers slow down (HTTP 429) versus crashing downstream service |
| **Poison Message** | Message that consistently fails processing (corrupt data, logic error); must be DLQ'd to prevent blocking |
