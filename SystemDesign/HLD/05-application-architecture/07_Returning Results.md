# Returning Results from Async Operations

> **Module 5 — Application Architecture**  
> Source: https://layrs.me/course/hld/05-application-architecture/returning-results

---

## ELI5 — Explain Like I'm 5

You drop your car off for service and get a receipt. Now you need to know when it's ready. You have four options:

1. **Keep calling** every 30 minutes (polling)
2. **Give them your number** and they call you when done (webhook)
3. **Stay on hold** on the phone (long-polling)
4. **Have a live conversation** back and forth (WebSockets)

Same problem for async backend work: after a background job starts, how does the client find out when it finishes?

---

## The Core Problem

```
Client ──► POST /video/upload ──► 202 Accepted + { jobId: "abc123" }
                                         │
                                  Video encoding runs in background (10 minutes)
                                         │
                               How does the client get the result?
```

Four patterns, each with different trade-offs:

```
                    ┌──────────────────────────────────────────────────────┐
                    │                                                      │
      Polling       │   Long-Polling   │   Webhooks   │   WebSockets      │
  (client asks)     │  (client waits)  │  (server     │  (persistent      │
                    │                  │   calls back) │   channel)        │
                    └──────────────────────────────────────────────────────┘
```

---

## Pattern 1: Polling

Client repeatedly asks "is it done yet?" on a timer.

```
Client ──► GET /jobs/abc123 ──► { status: "pending" }   (t=0s)
Client ──► GET /jobs/abc123 ──► { status: "pending" }   (t=5s)
Client ──► GET /jobs/abc123 ──► { status: "pending" }   (t=10s)
Client ──► GET /jobs/abc123 ──► { status: "complete", result: "..." }  (t=600s)
```

**Exponential backoff** to reduce wasted requests:

```
Attempt 1: wait 1s
Attempt 2: wait 2s
Attempt 3: wait 4s
Attempt 4: wait 8s
…
Cap at 60s per attempt
```

| Pros | Cons |
|---|---|
| Works with any client (mobile, browser, CLI) | Wasted requests (99% return "pending") |
| Simple to implement | Higher latency (polling interval = added delay) |
| Stateless — client can reconnect anytime | Server load scales with polling frequency × clients |

**Best for**: tasks that take >10 seconds; batch processing results; simple clients without persistent connections.

---

## Pattern 2: Webhooks

Instead of the client asking, the **server calls the client's URL** when the job finishes.

```
Client ──► POST /video/upload { callbackUrl: "https://myapp.com/webhooks/video" }
                │
         Job completes
                │
Server ──► POST https://myapp.com/webhooks/video
           {
             "event":   "VideoEncodingComplete",
             "jobId":   "abc123",
             "videoUrl": "https://cdn.example.com/abc123.mp4"
           }
```

**Security**: always verify the HMAC signature — any unauthenticated endpoint accepting webhooks can be spoofed.

```
Server signs payload: HMAC-SHA256(secret, payload_body)
Client verifies:      computed_sig === header["X-Signature"]
```

**Retry strategy**: server retries with exponential backoff if webhook delivery fails.  
Stripe retries for 3 days. GitHub retries for webhooks labeled "redeliver".

| Pros | Cons |
|---|---|
| No wasted polling requests | Client must have a stable, publicly reachable HTTPS URL |
| Near-instant notification | Not usable from mobile apps or browsers (no stable callback URL) |
| Scales well for many jobs | Must handle retries + deduplication (webhook may fire twice) |

**Best for**: server-to-server integrations (CI/CD triggers, payment confirmation, Stripe, GitHub Actions).

---

## Pattern 3: Long-Polling

Client makes a request, server **holds the connection open** until the job is done or a timeout fires.

```
Client ──► GET /jobs/abc123?timeout=30s
                    │
           Server holds connection open
                    │
           30s passes, job still running:
                    │
           Server responds: { status: "pending" }
                    │
Client reconnects immediately ──► GET /jobs/abc123?timeout=30s
                    │
           Job completes at t=45s:
                    │
           Server responds: { status: "complete", result: "..." }
```

**Multi-server problem**: long-poll request may land on Server B while the job result is published by Server A.  
**Solution**: use Redis Pub/Sub to broadcast completion across all servers:

```
Server A: job finishes ──► PUBLISH job:abc123:done → { result: ... }

Server B: SUBSCRIBE job:abc123:done
           receives message ──► sends response to waiting long-poll client
```

| Pros | Cons |
|---|---|
| Near-real-time (1–5ms after job done) | Keeps server connections open (connection count stays high) |
| Works in browsers (no persistent socket) | Needs Redis pub/sub for multi-server coordination |
| Client handles reconnection naturally | Timeout management adds complexity |

**Best for**: jobs completing in 0.5–10s; browser clients; dashboards.

---

## Pattern 4: WebSockets

Persistent bidirectional connection. Server pushes updates instantly.

```
Client                                         Server
   │──── HTTP Upgrade: WebSocket ────────────────►│
   │◄─── 101 Switching Protocols ─────────────────│
   │                    (persistent connection)    │
   │──── { "subscribe": "job:abc123" } ───────────►│
   │◄─── { "status": "processing", "progress": 20% }│
   │◄─── { "status": "processing", "progress": 60% }│
   │◄─── { "status": "complete",   "videoUrl": "..." }│
```

**Scale challenge**: WebSocket connections are stateful. Client on Server A must receive the push from Server A.  
**Solution**: sticky sessions (route same client to same server) or Redis pub/sub for cross-server push.

| Pros | Cons |
|---|---|
| Lowest latency (<100ms) | Stateful → harder to scale horizontally |
| Bidirectional (client sends updates too) | Connection overhead (thousands of open sockets) |
| Rich real-time UX (progress bars, live edits) | Reconnect + re-subscribe logic needed |

**Best for**: latency requirement <100ms; Slack, Figma, multiplayer games, live trading dashboards.

---

## Decision Flowchart

```
How long does the job take?
       │
  >10 seconds ──────────────────────────► Polling (simple, stateless)
       │
  >1 second, server-to-server ──────────► Webhooks (push to stable URL)
       │
  >500ms, browser client ────────────────► Long-polling (near-real-time, no socket)
       │
  <100ms, real-time UX needed ───────────► WebSockets (persistent, lowest latency)
```

---

## Real-World Examples

| Company | Pattern | Details |
|---|---|---|
| **GitHub** | Webhooks | CI/CD triggers on push events. Retries for 3 days with exponential backoff. Unique `X-GitHub-Delivery` UUID in each request (idempotency key) |
| **Stripe** | Webhooks | Payment confirmation webhooks. Retries for 3 days. Recommends verifying `Stripe-Signature` HMAC header on all webhook endpoints |
| **Slack** | WebSockets | Desktop app: WebSocket for real-time messages (<100ms). Mobile: push notifications (APNs/FCM) = webhook from Apple/Google to device |
| **YouTube** | Polling + Long-Polling | Upload status: polling with backoff. Live chat: long-polling (browser compatibility) |
| **Figma** | WebSockets | Live collaborative editing — all cursors and edits broadcast via WebSocket using Redis pub/sub for multi-server push |

---

## MERN Dev Notes

```js
// POLLING — Express endpoint to check job status
router.get('/jobs/:jobId', async (req, res) => {
  const job = await Job.findById(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ status: job.status, result: job.result || null });
});

// Client polling with exponential backoff:
async function pollJobResult(jobId) {
  let delay = 1000;
  while (true) {
    const { data } = await axios.get(`/api/jobs/${jobId}`);
    if (data.status === 'complete') return data.result;
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 2, 60000);  // cap at 60s
  }
}
```

```js
// WEBHOOKS — receiving with HMAC verification (Express)
const crypto = require('crypto');

app.post('/webhooks/video', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-signature'];
  const computed = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');

  if (sig !== `sha256=${computed}`) return res.status(403).json({ error: 'Invalid signature' });

  const event = JSON.parse(req.body);
  // Idempotency: check if event.jobId was already processed
  res.status(200).send('OK');  // must respond 200 quickly or sender will retry
});
```

```js
// LONG-POLLING — Express with Redis pub/sub
const redis     = require('ioredis');
const subscriber = new redis();

router.get('/jobs/:jobId/wait', async (req, res) => {
  const { jobId } = req.params;
  const timeout = 30000;  // 30s timeout

  const job = await Job.findById(jobId);
  if (job?.status === 'complete') return res.json(job);

  await subscriber.subscribe(`job:${jobId}:done`);

  const timer = setTimeout(() => {
    subscriber.unsubscribe(`job:${jobId}:done`);
    res.json({ status: 'pending' });   // client will reconnect
  }, timeout);

  subscriber.once('message', (channel, message) => {
    clearTimeout(timer);
    subscriber.unsubscribe(channel);
    res.json({ status: 'complete', result: JSON.parse(message) });
  });
});
```

```js
// WEBSOCKETS — with socket.io + Redis adapter (multi-server)
const { Server }      = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');

const io = new Server(httpServer);
io.adapter(createAdapter(pubClient, subClient));  // Redis pub/sub for multi-server push

io.on('connection', (socket) => {
  socket.on('subscribe', (jobId) => {
    socket.join(`job:${jobId}`);
  });
});

// When job completes (in worker):
io.to(`job:${jobId}`).emit('jobComplete', { status: 'complete', result });
```

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| Polling trade-off? | Simple, works everywhere; wasteful (N clients × every Xs = many requests). Use exponential backoff |
| Webhook security? | HMAC-SHA256 signature verification. Never trust unauthenticated webhook body |
| Long-polling vs WebSockets? | Long-poll: no persistent socket, simpler, browser-safe. WebSocket: bidirectional, lower latency, statefulness complexity |
| Multi-server WebSocket/Long-poll? | Redis pub/sub broadcasts completion to all servers so any can respond to the waiting client |
| When to use each? | >10s → polling. Backend-backend → webhooks. Browser, ~1–5s → long-poll. <100ms → WebSockets |
| Webhook delivery failure handling? | Retry with exponential backoff. Webhook must respond 200 quickly. Consumer must be idempotent (use delivery UUID as dedup key) |

**Red flags**:
- Unverified webhook endpoint (security OWASP A07)
- Responding to webhook after long processing (webhook sender will time out and retry)
- No Redis adapter for multi-server WebSocket deployments
- Synchronous polling without backoff (hammers server unnecessarily)

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Polling** | Client periodically asks server for status |
| **Exponential backoff** | Retry delay doubles each attempt to reduce unnecessary requests |
| **Webhook** | HTTP callback where the server POSTs to a client-provided URL on completion |
| **HMAC** (Hash-based Message Authentication Code) | Signature computed with shared secret to verify webhook authenticity |
| **Long-polling** | HTTP request held open by server until result is ready or timeout fires |
| **WebSocket** | Protocol for persistent bidirectional TCP connection with low overhead |
| **SSE** (Server-Sent Events) | Unidirectional server → client event stream over HTTP (simpler than WebSocket) |
| **Redis pub/sub** | Publish-subscribe mechanism used to broadcast messages across server instances |
| **Sticky session** | Load balancer always routes a client to the same server (needed for stateful WebSocket without Redis adapter) |
| **Idempotency key** | Unique ID per webhook delivery; consumer uses it to skip duplicate processing |
