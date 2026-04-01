# T02 — Async Request-Reply Pattern

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/async-request-reply

---

## ELI5 (Explain Like I'm 5)

Imagine you order a pizza. The restaurant doesn't make you stand at the counter waiting — they give you a **receipt with an order number** and you go sit down. You can come back and check "is my pizza ready?" or they can call your number. Either way, the restaurant's kitchen is free to cook without keeping you standing there forever.

Async Request-Reply is the same: your app sends a request, gets a **ticket number** (correlation ID) immediately, and checks back later for the result.

---

## Analogy

**Airport baggage claim**: You hand over your luggage (request), get a baggage tag (correlation ID + 202 Accepted). You go through security, grab food, board the plane. You don't stand at the counter while your bag is loaded. When you land, you use the tag to retrieve your bag (poll or callback delivers result). The airport (backend) processed your bag independently without blocking you.

---

## Core Concept

The Async Request-Reply pattern **decouples long-running backend operations from frontend clients** by:
1. Returning an immediate `202 Accepted` with a **correlation ID** + status URL
2. Processing the request asynchronously (queue + workers)
3. Delivering results via **polling** (client checks status endpoint) or **callbacks** (backend POSTs to webhook URL)

This prevents clients from blocking while waiting for operations like video transcoding, report generation, ML inference, or payment processing that take seconds to minutes.

### Three Phases

```
Phase 1 — Submit:   POST /api/job    → 202 Accepted + { id, status_url }
Phase 2 — Process:  Worker processes → updates status DB (PENDING → PROCESSING → COMPLETED)
Phase 3 — Retrieve: GET /api/job/:id → { status: "COMPLETED", result_url: "..." }
           OR Callback: backend POSTs to client webhook when done
```

---

## ASCII Diagrams

### Full Async Request-Reply Architecture

```
CLIENT              API GATEWAY          MESSAGE QUEUE        WORKER(S)
  │                     │                     │                   │
  │── POST /api/job ────►│                     │                   │
  │                     │── Publish message ──►│                   │
  │                     │── Insert PENDING ───►│ Status DB         │
  │◄── 202 Accepted ────│                     │                   │
  │    { id, url }      │                     │── Consume ────────►│
  │                     │                     │                   │── Update PROCESSING
  │                     │                     │                   │── Do work...
  │                     │                     │                   │── Store result (S3)
  │                     │                     │                   │── Update COMPLETED
  │                     │                     │                   │
  │── GET /api/job/id ──►│                     │                   │
  │                     │── Query status DB ──►│                   │
  │◄── { COMPLETED } ───│                     │                   │
  │── GET result_url ───►│ (fetch from S3)     │                   │
```

### Polling with Exponential Backoff

```
t=0s:   POST request → 202 Accepted
t=1s:   GET status → PROCESSING (45%)
t=2s:   GET status → PROCESSING (80%)
t=4s:   GET status → COMPLETED → fetch result
(1s, 2s, 4s, 8s... exponential backoff reduces server load)
```

### Idempotency Flow

```
Request 1:  POST /api/job  Idempotency-Key: abc-123
  → Cache miss → store abc-123 → uuid-456 → return 202 { id: uuid-456 }

Request 2:  POST /api/job  Idempotency-Key: abc-123  (retry — client thinks it failed)
  → Cache HIT → return 202 { id: uuid-456 }  (same response, no duplicate work)
```

---

## Variants

| Variant | How It Works | Best For |
|---------|-------------|----------|
| **Polling** | Client repeatedly GETs status endpoint | Simple browser/mobile clients, no endpoint exposure needed |
| **Webhook Callback** | Backend POSTs result to client-provided URL | Server-to-server, efficiency matters (Stripe, Twilio, GitHub) |
| **Hybrid** | Supports both polling + optional webhooks | Public APIs serving diverse client types |
| **Result Caching** | Completed results stored in blob storage; pre-signed URL returned | Large results (videos, reports); clients may download multiple times |

---

## Trade-offs

| Dimension | Async Request-Reply | Synchronous API |
|-----------|-------------------|-----------------|
| **Complexity** | Higher (correlation IDs, status DB, polling/webhooks) | Lower (one request, one response) |
| **Responsiveness** | Better for long ops (client not blocked) | Immediate (for fast ops) |
| **Resource use** | Efficient (no idle connections) | Wasteful for long ops (connection held open) |
| **Debugging** | Harder (distributed state) | Easier |
| **Use when** | Operations take >5 seconds | Operations complete in <1 second |

### Polling vs Webhooks

| Aspect | Polling | Webhooks |
|--------|---------|---------|
| Client infrastructure | None needed | Client must expose public endpoint |
| Security complexity | Low | High (signature verification, replay protection) |
| Latency | Slightly higher (wait for next poll) | Near-instant notification |
| Use for | Browsers, mobile apps, behind firewalls | Server-to-server integrations |
| Overhead | Polling traffic to status endpoint | Zero polling overhead |

---

## How It Works (Step by Step)

1. **Client initiates**: `POST /api/reports` → API gateway validates, generates UUID (correlation ID), publishes message to queue, inserts `{ id, PENDING }` in Status DB, returns `202 Accepted { id, status_url }` in <100ms.

2. **Backend processes**: Worker consumes message, updates status to `PROCESSING`, generates report (30-60s), stores PDF in S3, updates status to `COMPLETED` with `result_url`.

3. **Client retrieves (polling)**: `GET /api/reports/:id` → Status DB lookup → returns `{ status: PROCESSING, progress: 45 }` → later `{ status: COMPLETED, result_url: "/download/..." }`.

4. **OR Client retrieves (webhook)**: Backend POSTs `{ id, result_url }` to `callback_url` from original request.

5. **Cleanup**: Status records retained for 24-48 hours, then purged. Workers set max processing time (e.g., 5 min); mark `TIMEOUT`/`FAILED` if exceeded.

---

## MERN Developer Notes

This is the pattern you should use when your Express route triggers a long-running job:

```javascript
// ❌ BAD — blocking handler (times out for long ops)
app.post('/api/generate-report', async (req, res) => {
  const report = await generateReport(req.body); // 30s — times out!
  res.json(report);
});

// ✅ GOOD — async request-reply
app.post('/api/generate-report', async (req, res) => {
  const jobId = uuid();

  // Check idempotency key first
  const existingId = await cache.get(req.headers['idempotency-key']);
  if (existingId) return res.status(202).json({ id: existingId, status_url: `/api/jobs/${existingId}` });

  // Enqueue and return immediately
  await db.jobs.create({ id: jobId, status: 'PENDING' });
  await queue.publish({ jobId, params: req.body });
  if (req.headers['idempotency-key']) {
    await cache.set(req.headers['idempotency-key'], jobId, { ttl: 86400 });
  }

  res.status(202).json({ id: jobId, status_url: `/api/jobs/${jobId}` });
});

// Status endpoint — cheap DB lookup
app.get('/api/jobs/:id', async (req, res) => {
  const job = await db.jobs.findById(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ status: job.status, progress: job.progress, result_url: job.result_url });
});
```

**Tools in Node.js ecosystem:**
- `bull` / `bullmq` — Redis-backed job queues with status tracking
- `AWS SQS` + `AWS Lambda` — fully managed async processing
- `express-async-errors` — proper error propagation in async handlers

---

## Real-World Examples

| Company | System | Implementation |
|---------|--------|---------------|
| **Stripe** | Payment Processing API | Create payment intent → `status: requires_action` → webhook when settled. Supports `Idempotency-Key` header for safe retries. |
| **AWS Lambda** | Async Invocation | `202 Accepted` + request ID immediately. Configurable destination (SQS/SNS/EventBridge) for success/failure. Auto-retries twice with exponential backoff. |
| **Azure Durable Functions** | Orchestration | `202 Accepted` + status URLs; framework handles correlation IDs, checkpointing, retries. Can run days/weeks. |
| **YouTube** | Video Processing | Upload → immediate confirmation + processing ID → poll or email notification when encoding completes. |

---

## Interview Cheat Sheet

### Q: Why use async request-reply instead of WebSockets or SSE?
**A:** Async request-reply works over standard HTTP — no persistent connections, firewall-friendly, simple to implement. WebSockets are better for real-time bidirectional communication. SSE is for server-push streams. Async request-reply is for one-time long-running operations.

### Q: How do you prevent clients from polling too frequently?
**A:** Rate limit the status endpoint. Return a `Retry-After` header suggesting the next poll interval. Document exponential backoff in API docs. Start at 1s and double each poll (1s, 2s, 4s, 8s...).

### Q: What happens if the backend crashes while processing?
**A:** The message queue retains the work item (at-least-once delivery). Another worker picks it up. Status remains `PROCESSING` until the new worker updates it. This is why idempotency is critical — the operation might execute multiple times.

### Q: How long should you retain completed status records?
**A:** Balance client retrieval needs vs. storage costs. Stripe retains webhook events for 30 days. AWS Lambda keeps logs 7 days by default. Typical range: 24-48 hours for result retrieval, then TTL-based expiry.

### Q: How do you handle idempotency?
**A:** Client provides an `Idempotency-Key` header (UUID) with the request. Gateway checks a cache/DB for that key. On first request, store key→jobId. On duplicate, return cached response. TTL the key for 24 hours. Workers also check status before starting work to skip already-processed jobs.

### Q: What HTTP status codes are used?
**A:** `202 Accepted` — request queued, processing not yet complete. `200 OK` — status check returning current state. `303 See Other` with `Location` header — redirect to result when complete. Never `201 Created` — that implies immediate completion.

### Red Flags to Avoid
- Claiming async is always better than synchronous (adds complexity only justified for long-running ops)
- Not implementing timeouts (zombie requests that run forever consuming resources)
- Polling without exponential backoff (unnecessary server load)
- Forgetting idempotency (duplicate processing when retries occur)
- Storing large results in the status table instead of blob storage (DB bloat)
- Not providing a cancellation mechanism (wasto resources on unwanted work)

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Correlation ID** | Unique identifier (UUID) linking an async request to its eventual response across time and service boundaries |
| **202 Accepted** | HTTP status code indicating the request was received and queued but processing hasn't completed yet |
| **Polling** | Client repeatedly checking a status endpoint at intervals to learn when an async operation finishes |
| **Webhook** | HTTP callback — the server POSTs to a client-provided URL to deliver results (push model) |
| **Idempotency Key** | Client-provided unique token that prevents duplicate processing on retried requests |
| **Dead Letter Queue (DLQ)** | Queue that receives messages that failed processing after N retries — for investigation/replay |
| **Exponential Backoff** | Retry strategy where wait time doubles each attempt (1s, 2s, 4s…) to reduce system load |
| **Status DB** | Persistent store (PostgreSQL, DynamoDB) tracking the state (PENDING/PROCESSING/COMPLETED/FAILED) of each async job |
| **Visibility Timeout** | SQS mechanism — message invisible to other consumers for N seconds while being processed; if not ACK'd, becomes visible again |
| **Pre-signed URL** | Time-limited URL (e.g., S3) granting temporary access to a resource without exposing credentials |
| **Saga** | Pattern for managing distributed transactions with compensating actions on failure [→ Full detail: T04 Choreography] |
