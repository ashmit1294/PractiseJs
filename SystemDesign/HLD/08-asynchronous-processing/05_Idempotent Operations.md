# Idempotent Operations: Safe Retries in Distributed Systems

> **Source**: https://layrs.me/course/hld/08-asynchronous-processing/idempotent-operations  
> **Difficulty**: Intermediate | **Read time**: 11 min

---

## ELI5

Imagine a vending machine. You press B3, the snack comes out. If you press B3 again, another snack comes out — that is **not idempotent**. Now imagine a "Set temperature to 20°C" button. Press it once: AC adjusts to 20°C. Press it a hundred times: still 20°C. That **is idempotent** — repeating has the same effect as doing it once.

---

## Analogy — Bank Teller

You hand a teller a cheque to deposit. The network hiccups, you don't get a receipt. You hand the same cheque again. An **idempotent** teller notices the same cheque number and says "already processed, here is your original receipt." A **non-idempotent** teller deposits it twice. Cheque number = **idempotency key**.

---

## Core Concept

**Idempotency**: an operation *f* is idempotent if:
> *f(x) = f(f(x)) = f(f(f(x)))* — executing it multiple times has the same effect as executing it once

**Why it's mandatory in distributed systems:**
1. Networks fail silently — request succeeds on server, ACK is lost → client retries
2. Message queues deliver **at-least-once** → consumer sees the same message 2+ times
3. Load balancer retries, API gateway retries, mobile SDK retries — all trigger duplicate executions

**Consequence of non-idempotency at scale:**
- Double-charge on payment
- Two orders created for one click
- Duplicate confirmation emails
- Corrupted inventory count

---

## Three Approaches

### 1. Natural Idempotency (free — no infrastructure required)

| Operation | Idempotent? | Why |
|---|---|---|
| `GET /users/123` | ✅ | Read-only, no side effects |
| `PUT /users/123 { email: "x@x.com" }` | ✅ | Sets to absolute value |
| `DELETE /users/123` | ✅ | Repeated deletes are no-ops |
| `POST /payments` | ❌ | Creates new resource each time |
| `PATCH /cart { quantity: +1 }` | ❌ | Relative update, each call increments |

**Best when**: read operations, absolute updates (set to value), delete operations.

### 2. Idempotency Keys (explicit deduplication)

Client generates a UUID for each logical operation. Server stores it; duplicates return cached result.

```
Request 1: POST /payments { amount: 25.00 }
           Header: Idempotency-Key: idem_7f3d9a2b-4c8e-4f1a-9b2d-6e5c8a1f3d9b

           → Server: INSERT INTO idempotency_keys (key, status) ...
           → Process payment → charge_id: ch_123
           → UPDATE status='completed', result='{"charge_id":"ch_123"}'
           → 200 OK { charge_id: "ch_123" }

ACK lost — client retries:
Request 2: POST /payments { amount: 25.00 }
           Header: Idempotency-Key: idem_7f3d9a2b-4c8e-4f1a-9b2d-6e5c8a1f3d9b

           → Server: SELECT * FROM idempotency_keys WHERE key=...
           → Found: status='completed', result='{"charge_id":"ch_123"}'
           → Return 200 OK { charge_id: "ch_123" }   ← NO second charge
```

### 3. Conditional Updates (versioning / optimistic locking)

```sql
-- Only updates if no concurrent modification happened
UPDATE orders
   SET status = 'shipped', version = version + 1
 WHERE id = 123
   AND version = 5;       -- precondition check

-- If returns 0 rows: version changed → concurrent update happened → retry
```

Good for: state machines, inventory management, collaborative editing.

---

## Idempotency Key Implementation

### Flow

```
Client generates UUID → includes in request header

Server:
  1. SELECT key FROM idempotency_keys WHERE key=? AND created_at > NOW()-INTERVAL 24h
  
  2a. Not found: INSERT key with status='processing'
      → Process operation
      → UPDATE status='completed', result=<serialized response>
      → Return response

  2b. Found, status='completed': return cached result immediately (no reprocessing)

  2c. Found, status='processing': another in-flight request with same key
      → Wait for completion OR return HTTP 409 Conflict

  2d. Found, status='failed': return cached error (don't retry automatically)
```

### DB Schema

```sql
CREATE TABLE idempotency_keys (
  key        VARCHAR(255) PRIMARY KEY,           -- unique constraint prevents races
  status     ENUM('processing','completed','failed') NOT NULL,
  result     TEXT,                               -- serialized JSON response
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  INDEX idx_created_at (created_at)              -- for TTL cleanup queries
);
```

### Handling Concurrent Duplicate Requests (Race Condition)

```
Request A (t=0ms): INSERT key='idem_abc' status='processing' → SUCCESS
Request B (t=5ms): INSERT key='idem_abc' status='processing' → UNIQUE CONSTRAINT VIOLATION
                   → SELECT status, result WHERE key='idem_abc'
                   → status='completed' → return cached result
```

### TTL & Cleanup

- Standard TTL: **24 hours** (Stripe), **7 days** for operations with manual retries
- Cleanup: daily cron drops partitions/deletes rows older than TTL
- Redis alternative: `SET idem_key_... "{status, result}" EX 86400`

---

## Idempotency in Message Queues

```
SQS / Kafka at-least-once → consumer sees message twice:

Non-idempotent consumer:
  message → sendEmail(user@x.com)   ← email 1
  (same message) → sendEmail(user@x.com) ← email 2   💥

Idempotent consumer:
  message_id = "msg_abc123"
  1. SELECT FROM processed_messages WHERE id='msg_abc123'
  2. Not found → process → INSERT id='msg_abc123'
  3. Same message → SELECT → found → skip ✅
```

---

## Variants

| Pattern | How | Pros | Cons |
|---|---|---|---|
| **Natural idempotency** | Use PUT/DELETE; absolute value updates | No infra needed | Only for specific operations |
| **Idempotency keys** | Client UUID + deduplication DB table | Works for any operation | Latency (extra DB query), storage |
| **Conditional updates** | WHERE version = N | No separate table | Requires version column; client handles conflicts |
| **Bloom filter** | Probabilistic set membership check | Constant O(1) memory | False positives possible; no result caching |

---

## MERN Dev Notes

```javascript
// Express middleware for idempotency key enforcement
async function idempotencyMiddleware(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key) return next();                             // optional for non-mutating routes

  const existing = await redis.get(`idem:${key}`);
  if (existing) {
    const { status, body } = JSON.parse(existing);
    return res.status(status).json(body);              // return cached result
  }

  // Capture response to cache it
  const originalJson = res.json.bind(res);
  res.json = async (body) => {
    await redis.setex(`idem:${key}`, 86400,            // 24h TTL
      JSON.stringify({ status: res.statusCode, body }));
    return originalJson(body);
  };
  next();
}

// Route using it
app.post('/payments', idempotencyMiddleware, async (req, res) => {
  const charge = await stripe.charges.create({ amount: req.body.amount });
  res.json({ chargeId: charge.id });
});
```

> **MERN note**: This pattern is essential for any POST endpoint called by a mobile client (unreliable network = frequent retries) or consumed via a message queue (at-least-once delivery guaranteed).

---

## Real-World Examples

| Company | Implementation | Scale |
|---|---|---|
| Stripe | `Idempotency-Key` header required for all mutating operations; Redis cache 24h TTL; validate request params hash (reusing key with different amount → 400) | $640B+ processed annually |
| Uber | Trip completion: UUID tied to trip_id + payment attempt; entire workflow (charge + notify + receipt) idempotent on same key; PostgreSQL partitioned by date for TTL cleanup | Millions of rides/day |
| Airbnb | Booking: stores hash of booking params (dates, property, guest count) with key; reusing key with different params → rejected | Prevents malicious key reuse |

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| What is idempotency? | An operation is idempotent if executing it multiple times produces the same result as executing it once: f(x) = f(f(x)) |
| Why is idempotency required in distributed systems? | Network failures cause silent retries; at-least-once message delivery causes duplicates; API gateways and SDKs auto-retry — all lead to duplicate executions |
| How do you implement an idempotency key? | Client generates UUID per logical operation; server stores key in deduplication table with TTL; on duplicate key → return cached result without re-processing |
| What is the difference between idempotency and exactly-once processing? | Idempotency: operation can execute multiple times, same result each time. Exactly-once: operation executes exactly one time (requires distributed transactions, expensive) |
| How do you handle two requests with the same key arriving simultaneously? | DB unique constraint on key column; first INSERT succeeds and processes; second gets constraint violation → waits or returns 409 Conflict |
| How long should idempotency keys be stored? | 24 hours is standard (Stripe); 7 days for operations with long retry windows or manual retries |
| Can you make a counter increment idempotent? | Not naturally, but using conditional update: `SET count = 5 WHERE count = 4` — if count changed, skip (idempotent by precondition) |
| How does idempotency relate to message queues? | At-least-once delivery guarantees duplicates; make consumers check a deduplication table (by message_id) before processing |

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Idempotency** | Property: executing an operation N times = executing it once |
| **Idempotency key** | Client-generated UUID identifying a unique logical operation |
| **Deduplication table** | DB table mapping idempotency keys to their result + status + TTL |
| **Natural idempotency** | Operations that are inherently safe to repeat (GET, PUT, DELETE) |
| **Conditional update** | `UPDATE ... WHERE version = N` — rejects if precondition fails |
| **At-least-once delivery** | Message queue guarantee: every message delivered ≥ 1 time; duplicates possible |
| **Exactly-once** | Delivers message exactly 1 time; requires distributed transactions; expensive |
| **Bloom filter** | Probabilistic data structure: can check "seen before?" in O(1) constant memory; false positives possible |
| **Optimistic locking** | Version-based concurrency: read version, update only if version unchanged |
| **Poisoned message** | Message that always causes processing to fail; idempotency doesn't help here — DLQ does |
