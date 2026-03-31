# Improper Instantiation

## ELI5
Imagine building and throwing away a house every time you need somewhere to sleep instead of just keeping one and reusing it. That's improper instantiation — creating expensive objects (DB connections, HTTP clients) on every request instead of creating them once and reusing them via a pool.

## Analogy
One taxi company: instead of a taxi fleet (pool), they build a new car, hire a driver, train them, and then dismantle the car after every single ride. The overhead of building/destroying exceeds the cost of the actual ride.

---

## Core Concept
**Improper Instantiation** means creating expensive-to-construct objects inside request handlers instead of creating them once and reusing via pooling patterns.

### The Cost Math
```
Per-request DB connection:
  TCP handshake:      3ms
  Auth overhead:      20ms
  SSL negotiation:    27ms
  Total per connect:  ~50ms overhead

At 1,000 req/s:
  CPU cost:  50ms × 1,000 = 50 CPU-seconds/second
  Memory:    64KB per connection × 1,000 = 64MB/s heap pressure
  GC storms: heap fills → GC pause → all request latency spikes
```

---

## The Four Object Pooling Patterns

### 1. Singleton (Stateless Objects)
For thread-safe, stateless objects created once at startup.
```javascript
// Target: HTTP clients, JSON serializers, regex patterns, logger instances

// BAD: New Axios instance per request
app.get('/proxy', async (req, res) => {
  const axios = require('axios').create({ timeout: 5000 }); // recreated each time!
  const data = await axios.get('https://external-api.com/data');
  res.json(data);
});

// GOOD: Singleton — created once at module level
const apiClient = require('axios').create({
  baseURL: 'https://external-api.com',
  timeout: 5000,
  headers: { 'Authorization': `Bearer ${process.env.API_KEY}` }
});

app.get('/proxy', async (req, res) => {
  const data = await apiClient.get('/data');  // reuse singleton
  res.json(data);
});
```

### 2. Connection Pool (Stateful Resources)
For resources with connection state that must be acquired, used, and returned.
```javascript
// MongoDB: Pool created at startup
const client = new MongoClient(uri, {
  maxPoolSize: 50,    // max 50 concurrent connections
  minPoolSize: 10,    // keep 10 warm to avoid cold start
  maxIdleTimeMS: 30000,  // close idle connections after 30s
  waitQueueTimeoutMS: 5000,  // throw if no connection available in 5s
});

// Pool sizing via Little's Law:
// concurrent_connections = request_rate × query_latency
// At 1000 req/s × 50ms avg query = 50 concurrent connections needed
// Set min=50, max=100 (2× buffer for spikes)

await client.connect(); // once at startup, not per request!

// Each request acquires from pool
app.get('/data', async (req, res) => {
  const db = client.db('mydb');  // no new connection — uses pool
  const docs = await db.collection('items').find({}).toArray();
  res.json(docs);
});
```

### 3. Object Pool (Stateful but Resettable)
For objects that are expensive to create and can be reset between uses.
```javascript
// Pattern: checkout → use → reset state → return to pool
class BufferPool {
  constructor(size, bufferSize) {
    this.pool = Array.from({ length: size }, () => Buffer.alloc(bufferSize));
    this.available = [...this.pool];
  }

  acquire() {
    if (!this.available.length) throw new Error('Pool exhausted');
    return this.available.pop();
  }

  release(buf) {
    buf.fill(0);  // reset before returning
    this.available.push(buf);
  }
}
```

### 4. Lazy Initialization (Expensive One-Time Setup)
```javascript
// Defer expensive initialization until first access
let mlModel = null;

async function getMLModel() {
  if (!mlModel) {
    mlModel = await loadLargeMLModel('./model.json'); // ~5s startup
  }
  return mlModel;
}

app.post('/predict', async (req, res) => {
  const model = await getMLModel();  // subsequent calls return instantly
  const result = model.predict(req.body.features);
  res.json({ result });
});
```

---

## Pool Health Indicators
```
Healthy: 60-80% pool utilization
Alert:   > 90% utilization → add capacity (increase maxPoolSize)
Waste:   < 30% utilization → reduce minPoolSize (paying for idle connections)

Wait time for connection:
  < 1ms    → Pool is healthy
  1-10ms   → Monitor, may need to increase max
  > 10ms   → Alert: requests are queuing for connections
```

---

## ASCII: Per-Request vs Pooled

```
PER-REQUEST INSTANTIATION (broken)
──────────────────────────────────────────────────────────
Request 1: [new DB conn (50ms)][query (5ms)][close conn]
Request 2: [new DB conn (50ms)][query (5ms)][close conn]
Request 3: [new DB conn (50ms)][query (5ms)][close conn]
1000 req/s → 50,000ms CPU/s just on connection setup!

CONNECTION POOL (correct)
──────────────────────────────────────────────────────────
Startup:    [init pool: 10 connections ready]
Request 1: [acquire conn ~0ms][query (5ms)][return conn]
Request 2: [acquire conn ~0ms][query (5ms)][return conn]
Request 3: [acquire conn ~0ms][query (5ms)][return conn]
1000 req/s → ~0ms overhead on connection
```

---

## GC Debugging Flow
```
Alert: GC pause >50ms
  → Check GC logs (Node.js: --expose-gc + v8-profiler)
  → Heap profiler snapshot (two snapshots: before/after load)
  → Find allocation hotspots (objects growing between snapshots)
  → Is an expensive constructor in the hot request path?
  → Implement pooling or singleton
  → Canary deploy
  → Target: 90% allocation reduction for that object type
```

---

## MERN Developer Notes

```javascript
// ❌ Anti-pattern: Create expensive objects per-request
app.post('/send-email', async (req, res) => {
  const transporter = nodemailer.createTransport({  // TCP connection per request!
    host: 'smtp.gmail.com',
    auth: { user: process.env.EMAIL, pass: process.env.PASS }
  });
  await transporter.sendMail({ to: req.body.email, subject: '...', text: '...' });
  res.json({ sent: true });
});

// ✅ Singleton: Create transporter once
const emailTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  pool: true,          // enables connection pool for SMTP
  maxConnections: 5,
  auth: { user: process.env.EMAIL, pass: process.env.PASS }
});

app.post('/send-email', async (req, res) => {
  await emailTransporter.sendMail({ ... });  // reuses pool
  res.json({ sent: true });
});
```

---

## Real-World Examples

| Company | Problem | Fix | Result |
|---|---|---|---|
| Stripe | Kafka producer created per event | Singleton Kafka producer per process | P99 200ms→20ms; GC 150ms→30ms |
| Netflix Zuul | HTTP connection per request to downstream services | HTTP connection pool (10K sockets → pooled) | P99 800ms→50ms; 10K sockets eliminated |
| Uber | Geospatial index (200MB) loaded per request | Object pool × CPU count, pre-loaded | 5s→50ms for driver lookup |

---

## Interview Cheat Sheet

**Q: Why is creating a new DB connection per request a problem?**

> A: Three costs: (1) CPU — TCP+auth+SSL handshake takes 50ms at 1,000 req/s = 50 CPU-seconds/second wasted. (2) Memory — 64KB per connection × 1,000 = 64MB/s of heap pressure triggers GC. (3) DB limit — PostgreSQL max_connections is typically 100-500; per-request creation exhausts it instantly.

**Q: How do you size a connection pool using Little's Law?**

> A: L = λW. Concurrent connections (L) = request rate (λ) × avg query latency (W). Example: 500 req/s × 20ms = 10 concurrent connections needed. Set min=10 (keep warm), max=50 (2-5× buffer for spikes). Monitor pool utilization: 60-80% is healthy; >90% needs increase; <30% needs decrease.

**Q: What objects should be singletons vs. per-request?**

> A: Singletons (stateless, thread-safe): HTTP clients, DB pools, JSON serializers, regex patterns, logger instances, config objects. Per-request (stateful, request-scoped): request context, user identity, transaction objects, response builders.

**Q: What's the difference between a connection pool and an object pool?**

> A: Connection pool: manages stateful network connections (DB connections, HTTP keep-alive) — acquire/release. Object pool: manages expensive-to-construct stateful objects (buffers, protocol parsers) — checkout, reset state, return. Connection pools are a special case of object pools, commonly provided by drivers (MongoDB, PostgreSQL). Object pools are general-purpose (Apache Commons Pool, custom implementations).

**Q: A service has a 150ms GC pause every 30 seconds. What's causing it?**

> A: Likely improper instantiation — an expensive object is being created per-request (or per-batch), filling heap, then GC kicks in. Profile with heap snapshots two minutes apart. Look for objects with high allocation rates (count × size in allocations/minute). The culprit is usually in the hot request path. Once found, apply singleton or object pool.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **Improper Instantiation** | Creating expensive objects per-request instead of reusing via pool or singleton |
| **Connection pool** | Pre-created set of DB/network connections, acquired per request and returned when done |
| **Singleton** | Object created once at startup, shared across all requests (must be stateless) |
| **Object pool** | Pool of reusable stateful objects — checkout, use, reset, return |
| **GC storm** | Garbage collection triggered by rapid heap allocation — causes latency spikes |
| **Little's Law** | L = λW — pool size = request rate × average service time |
| **Heap pressure** | Rapid object allocation causing frequent garbage collection |
| **Lazy initialization** | Deferring expensive construction until first access |
| **TCP handshake** | 3-way network negotiation required for every new connection (~3ms) |
| **HikariCP** | Java's high-performance JDBC connection pool (reference implementation) |
