# Master Interview Q&A - Part 4
# Source: questions.txt
# Section 11 remainder (Q99-Q104) + Sections 12-15 (Q105-Q157)
# Rules: plain-text headers, ASCII-only diagrams, one Q per commit, update progress.md after each Q

---

# Section 11 continued: SYSTEM DESIGN (Q99-Q104)

---

## Q99: How would you design a real-time notification system for 50 million users?

### ELI5

Imagine a newspaper but instead of printing one big batch, you want to whisper the latest headline directly in each person's ear the moment it happens. 50 million ears. You cannot ring everyone personally — you set up local radio towers (WebSocket servers) in every city, subscribe groups of users to channels (topics), and when news breaks you broadcast the topic. People actively listening get it instantly. People whose phone is off get it when they next connect (push queue). The trick: never send message person-by-person — broadcast to a topic and let infrastructure fan it out.

### Visual Diagram

```
Event source (order placed, comment posted, etc.)
     |
     v
+------------------+
| Event Producer   |  (API server publishes event)
+------------------+
     |  Redis PUBLISH / Kafka produce
     v
+------------------+
| Message Bus      |  Redis Pub/Sub (low latency) or Kafka (durable, replay)
| channel: user.123|
+------------------+
     |
     +---fan-out---+---fan-out---+
     v             v             v
+----------+  +----------+  +----------+
| WS Node1 |  | WS Node2 |  | WS Node3 |  <-- many WebSocket server instances
| ~50k conn|  | ~50k conn|  | ~50k conn|      each holds up to 50k connections
+----------+  +----------+  +----------+
     |
     v WebSocket push
  User browser / mobile app receives notification in <100ms

---- Offline users path ----
event --> Message Bus --> Notification Worker --> FCM/APNs (mobile push)
                                               --> Email queue (SES)
                                               --> Redis INCR unread:userId

---- Scale math: 50M users, 10% online at peak ----
  5M concurrent WebSocket connections
  / 50k per WS node = 100 WS server instances needed
  Redis single PUBLISH broadcasts to all 100 nodes simultaneously
```

### Code Example

```javascript
// ----- WebSocket notification server (one of many instances) -----
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const redis = require('ioredis');

const server = createServer();
const wss = new WebSocketServer({ server });

// Each WS server subscribes to Redis channel — receives ALL notification events
const subscriber = new redis(process.env.REDIS_URL);
// Map userId -> ws for THIS node's connected users only
const userSockets = new Map();

subscriber.subscribe('user-notifications');

subscriber.on('message', (_channel, message) => {
  const { userId, payload } = JSON.parse(message);
  const ws = userSockets.get(userId);
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload)); // deliver only if user is on THIS node
  }
});

wss.on('connection', (ws, req) => {
  const userId = getUserIdFromRequest(req); // decode JWT from query/header
  userSockets.set(userId, ws);
  ws.on('close', () => userSockets.delete(userId));
});

server.listen(process.env.PORT || 8080);

// ----- API server: send notification -----
const publisher = new redis(process.env.REDIS_URL);

async function sendNotification(userId, payload) {
  // 1. Persist to DB for history / inbox
  await db.notifications.insert({ userId, payload, read: false, createdAt: new Date() });

  // 2. Fast unread badge counter in Redis
  await publisher.incr(`unread:${userId}`);

  // 3. Fan-out to all WS nodes — whichever holds userId's socket will deliver it
  await publisher.publish('user-notifications', JSON.stringify({ userId, payload }));

  // 4. Offline fallback: push via FCM/APNs if user is not connected
  const online = await publisher.exists(`ws:online:${userId}`);
  if (!online) {
    await mobilePushQueue.add({ userId, title: payload.title, body: payload.body });
  }
}
```

### Step-by-Step Explanation

1. **Event source** publishes to Redis Pub/Sub (or Kafka topic) — decoupled from delivery.
2. **All WS nodes** subscribe to the same Redis channel. A single `PUBLISH` broadcasts to every node.
3. **Each WS node** checks its local `userSockets` map — if the user is connected there, push; otherwise the message is ignored (another node will deliver it).
4. **Offline users** get FCM (Android) or APNs (iOS) push notifications delivered via a separate worker queue.
5. **Unread counts** are stored as `INCR unread:userId` in Redis — O(1), no DB query for badge numbers. Reset to 0 when user opens inbox.
6. **Sticky sessions**: the load balancer must route WebSocket upgrade requests consistently to the same server (IP hash or cookie-based affinity) so that a reconnect lands on the same node.
7. **Notification history**: persisted in DB with `(userId, createdAt)` compound index for paginated inbox queries.
8. **Scaling**: WS servers are stateless for business logic — scale horizontally. Add Redis Cluster if Pub/Sub throughput becomes a bottleneck.

### Complexity

| Component | Target | Solution |
|-----------|--------|---------|
| Concurrent WS connections | 5M (10% of 50M) | 100 nodes x 50k each |
| Redis Pub/Sub fan-out | 100 WS nodes | Single PUBLISH to all |
| Delivery latency | <100ms | Redis in-memory Pub/Sub |
| Offline users | 45M | FCM/APNs via worker queue |
| Unread counts | High-read frequency | Redis INCR/GET O(1) |
| Notification history | Paginated inbox | DB + (userId, createdAt) index |

---

## Q100: How does consistent hashing work in distributed caching?

### ELI5

Imagine you have 4 lockers in a row and you want to know which locker to put each item in, even if you add or remove lockers later. Normal assignment (item number mod 4) breaks when you add a 5th locker - everything reshuffles. Consistent hashing puts all lockers on a circular ring (like a clock face) and maps each item to the nearest locker clockwise. When you add a locker, only the items between the new locker and its predecessor move - all others stay put. This means adding or removing a server in a cache cluster only moves a fraction of the data instead of all of it.

### Visual Diagram

```
Consistent Hash Ring (0 to 2^32):

           0
           |
   Node C  |   Node A
     270---+---90
           |
          180
         Node B

Keys are hashed to a position on the ring.
Each key is stored on the FIRST node clockwise from its hash position.

Example:
  key "user:123" hashes to position 120
  --> clockwise: next node is Node B (180) --> stored on Node B

  key "product:42" hashes to position 200
  --> clockwise: next node is Node C (270) --> stored on Node C

Adding Node D at position 210:
  Before: "product:42" (pos 200) went to Node C (270)
  After:  "product:42" (pos 200) goes to Node D (210) -- only this segment moved
  All other keys unchanged

Without consistent hashing:
  4 nodes: key = hash % 4
  Add 1 node: key = hash % 5 --> ~80% of ALL keys reassign (thundering herd)

With consistent hashing:
  Add 1 node: only ~1/N keys move (1/5 = 20% in a 5-node cluster)

Virtual Nodes (vnodes):
  Each physical node gets 150 points on the ring
  Distributes load evenly, handles heterogeneous node sizes
```

### Code Example

```javascript
const crypto = require('crypto');

// ----- Simple consistent hash ring implementation -----
class ConsistentHashRing {
  constructor(nodes = [], replicaCount = 150) {
    this.ring = new Map();      // position -> nodeId
    this.sortedKeys = [];       // sorted ring positions
    this.replicaCount = replicaCount; // virtual nodes per physical node

    for (const node of nodes) {
      this.addNode(node);
    }
  }

  // Hash a string to a 32-bit number
  _hash(key) {
    return parseInt(crypto.createHash('md5').update(key).digest('hex').slice(0, 8), 16);
  }

  // Add a physical node: create replicaCount virtual nodes spread around the ring
  addNode(nodeId) {
    for (let i = 0; i < this.replicaCount; i++) {
      const virtualKey = `${nodeId}:vnode:${i}`;
      const position = this._hash(virtualKey);
      this.ring.set(position, nodeId);
    }
    // Re-sort positions after adding (ring must stay ordered)
    this.sortedKeys = [...this.ring.keys()].sort((a, b) => a - b);
  }

  // Remove a physical node: delete all its virtual nodes
  removeNode(nodeId) {
    for (let i = 0; i < this.replicaCount; i++) {
      const virtualKey = `${nodeId}:vnode:${i}`;
      const position = this._hash(virtualKey);
      this.ring.delete(position);
    }
    this.sortedKeys = [...this.ring.keys()].sort((a, b) => a - b);
  }

  // Get the node responsible for a given cache key
  getNode(key) {
    if (this.sortedKeys.length === 0) throw new Error('Ring is empty');

    const keyPosition = this._hash(key);

    // Find the first ring position >= keyPosition (first node clockwise)
    const idx = this.sortedKeys.findIndex(pos => pos >= keyPosition);

    // If no position found, wrap around to the first node (circular ring)
    const ringPos = idx === -1 ? this.sortedKeys[0] : this.sortedKeys[idx];
    return this.ring.get(ringPos);
  }
}

// ----- Usage: route cache reads/writes to correct Redis shard -----
const redis0 = require('ioredis')({ host: 'redis-0' });
const redis1 = require('ioredis')({ host: 'redis-1' });
const redis2 = require('ioredis')({ host: 'redis-2' });

const nodes = { 'redis-0': redis0, 'redis-1': redis1, 'redis-2': redis2 };
const ring = new ConsistentHashRing(Object.keys(nodes));

async function cacheGet(key) {
  const nodeId = ring.getNode(key);       // determine which shard
  return nodes[nodeId].get(key);          // read from that Redis instance
}

async function cacheSet(key, value, ttl = 3600) {
  const nodeId = ring.getNode(key);       // same key always maps to same node
  return nodes[nodeId].setex(key, ttl, value);
}

// Adding a new shard: only ~1/4 of keys need to move
ring.addNode('redis-3');
nodes['redis-3'] = require('ioredis')({ host: 'redis-3' });
```

### Step-by-Step Explanation

1. All nodes and keys are mapped onto a **circular hash space** (0 to 2Â³Â²-1) using a consistent hash function (MD5, SHA-1, or MurmurHash).
2. Each cache **key** is hashed and placed on the ring. It is stored on the **first node clockwise** from its position.
3. When a **node is added**, only the keys between the new node and its predecessor (counter-clockwise) need to migrate - approximately 1/N of all keys.
4. When a **node is removed**, only its keys migrate to the next node clockwise - again ~1/N keys.
5. **Virtual nodes (vnodes)**: each physical server is represented by multiple positions on the ring (150-300 vnodes). This distributes load evenly and handles nodes of different capacities.
6. Without consistent hashing, adding 1 node to an N-node cluster using `hash % N` moves `(N-1)/N` keys - catastrophic for large caches.
7. Used in production by: Amazon DynamoDB, Apache Cassandra, Redis Cluster (though Redis uses slot-based sharding), Memcached clients.
8. **Replication**: for high availability, a key can be stored on the next K nodes clockwise (replication factor K).

### Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| getNode(key) | O(log N) | Binary search on sorted ring positions |
| addNode | O(R log R) | R = vnode count, must re-sort |
| removeNode | O(R log R) | R = vnode count, must re-sort |
| Keys moved on add/remove | O(1/N) fraction | Only adjacent segment migrates |
| Load balance variance | Low with vnodes | 150+ vnodes reduces hot-spot risk |

---

## Q101: What is the Saga pattern? When would you use it over a traditional transaction?

### ELI5

You're booking a holiday online: flight ticket + hotel + car rental. All three must succeed or you cancel everything. A traditional database transaction is like doing all three in one locked room - if anything fails, everything rolls back instantly. But these are three different companies' systems. You can't lock all three simultaneously. The Saga pattern is the alternative: book each step one at a time, and if any step fails, run a series of "undo" bookings to cancel everything already done. Each step is a mini-transaction with its own matching cancellation step.

### Visual Diagram

```
SAGA: Order checkout (distributed services)

--- Choreography (event-driven) ---

OrderService        PaymentService       InventoryService      ShippingService
     |                    |                     |                    |
     | OrderCreated ------>|                     |                    |
     |                 charge()                  |                    |
     |                    | PaymentSuccess ------>|                    |
     |                    |                  reserveStock()           |
     |                    |                     | StockReserved ------>|
     |                    |                     |                  scheduleShip()
     |                    |                     |                    | ShipScheduled
     |<----OrderComplete--+---------------------+--------------------+

FAILURE scenario (inventory out of stock):
     |                    |                     |
     | OrderCreated ------>|                     |
     |                charge()                  |
     |                    | PaymentSuccess ------>|
     |                    |                  reserveStock() FAILS
     |                    |<--- StockFailed ------+
     |              refundPayment()
     |                    | PaymentRefunded
     |<---- OrderFailed --+

--- Orchestration (central coordinator) ---

SagaOrchestrator
  1. --> PaymentService.charge()      [SUCCESS]
  2. --> InventoryService.reserve()   [FAIL]
  3. --> PaymentService.refund()      [compensating tx]
  4. Mark saga as failed
```

### Code Example

```javascript
// ----- Saga Orchestrator pattern using Bull queue -----
// Each step is handled by a worker; compensating transactions undo previous steps

const Queue = require('bull');
const sagaQueue = new Queue('checkout-saga', process.env.REDIS_URL);

// ----- Saga state stored in DB -----
// saga: { id, status, steps: [{name, status, result}] }

async function startCheckoutSaga(orderId, customerId, items) {
  const saga = await db.sagas.create({
    id: `saga:${orderId}`,
    orderId,
    customerId,
    items,
    status: 'STARTED',
    steps: [],
  });

  // Kick off first step
  await sagaQueue.add('charge-payment', { sagaId: saga.id });
  return saga.id;
}

// ----- Step 1: Charge payment -----
sagaQueue.process('charge-payment', async (job) => {
  const { sagaId } = job.data;
  const saga = await db.sagas.findById(sagaId);

  try {
    const chargeResult = await paymentService.charge(saga.customerId, saga.totalAmount);

    // Record step success
    await db.sagas.addStep(sagaId, { name: 'payment', status: 'SUCCESS', chargeId: chargeResult.id });

    // Advance to next step
    await sagaQueue.add('reserve-inventory', { sagaId });
  } catch (err) {
    // Payment failed - no compensation needed (nothing to undo yet)
    await db.sagas.update(sagaId, { status: 'FAILED', failedStep: 'payment', reason: err.message });
  }
});

// ----- Step 2: Reserve inventory -----
sagaQueue.process('reserve-inventory', async (job) => {
  const { sagaId } = job.data;
  const saga = await db.sagas.findById(sagaId);

  try {
    await inventoryService.reserve(saga.items);
    await db.sagas.addStep(sagaId, { name: 'inventory', status: 'SUCCESS' });

    // Advance to next step
    await sagaQueue.add('schedule-shipping', { sagaId });
  } catch (err) {
    // Inventory failed - compensate: refund payment
    await db.sagas.addStep(sagaId, { name: 'inventory', status: 'FAILED' });
    await sagaQueue.add('compensate-payment', { sagaId }); // trigger compensation
  }
});

// ----- Compensating transaction: refund payment -----
sagaQueue.process('compensate-payment', async (job) => {
  const { sagaId } = job.data;
  const saga = await db.sagas.findById(sagaId);
  const paymentStep = saga.steps.find(s => s.name === 'payment' && s.status === 'SUCCESS');

  if (paymentStep) {
    // Compensating transaction: reverse the payment
    await paymentService.refund(paymentStep.chargeId);
    await db.sagas.update(sagaId, { status: 'COMPENSATED' });
  }
});
```

### Step-by-Step Explanation

1. **Problem**: a multi-service operation (order: payment + inventory + shipping) cannot use a single ACID transaction because each service has its own database.
2. **Saga**: break the operation into a sequence of **local transactions**, each in a single service. If any step fails, run **compensating transactions** for all already-completed steps.
3. **Choreography**: no central orchestrator - each service publishes events and other services react. Simple to implement, but hard to trace the overall saga progress.
4. **Orchestration**: a central coordinator (SagaOrchestrator) tells each service what to do in sequence. Easier to track state and debug, but adds a central service.
5. **Compensating transactions** must be idempotent and must always succeed (retry with backoff). They cannot "lock" - they are semantically undoing a committed action.
6. **Use Saga when**: operations span multiple microservices or databases; long-running workflows; you can tolerate temporary inconsistency between steps.
7. **Use traditional ACID transaction when**: all data in one DB; strict consistency required without any intermediate visible state; short-lived operations.
8. **Saga drawback**: intermediate state (e.g. payment taken but shipping not yet scheduled) is visible to other parts of the system - requires careful UI handling ("order processing").

### Complexity

| Aspect | Traditional Transaction | Saga |
|--------|------------------------|------|
| Consistency | Immediate, strong | Eventually consistent |
| Scope | Single DB | Multiple services/DBs |
| Failure recovery | Automatic rollback | Manual compensating transactions |
| Intermediate state visible | No | Yes |
| Implementation effort | Low | High (compensations required) |
| Best for | Single-DB operations | Distributed microservice workflows |

---

## Q102: How do you implement idempotency in a payment API?

### ELI5

Imagine paying for a coffee. The card machine freezes after you tap, and you can't tell if the payment went through. You tap again - did you just pay twice? An idempotent payment API solves this: you send a unique receipt number along with every payment request. If the cashier has already seen that receipt number, they hand you back your receipt without charging you again. The idempotency key is that unique receipt number - the server stores "this request was already processed with this result" and returns the same result if you send the same key again.

### Visual Diagram

```
Client sends payment request with Idempotency-Key: "order-123-attempt-1"

First request:
  Client ----POST /charge (key: "order-123-attempt-1")----> API Server
  API Server: key not seen before
    - Process payment --> Stripe
    - Store result: { key: "order-123-attempt-1", response: { chargeId: "ch_xyz", status: "success" } }
    - Return 200 { chargeId: "ch_xyz" }

Network timeout - client retries:
  Client ----POST /charge (key: "order-123-attempt-1")----> API Server
  API Server: key ALREADY SEEN
    - Return stored result: 200 { chargeId: "ch_xyz" }  <-- no new charge!

Different payment (new key):
  Client ----POST /charge (key: "order-456-attempt-1")----> API Server
  API Server: key not seen
    - Process new payment normally

--- Idempotency Key storage ---
Redis:
  SET idempotency:order-123-attempt-1 '{"status":200,"body":{...}}' EX 86400
  (expires after 24h - client must retry within this window)
```

### Code Example

```javascript
const express = require('express');
const redis = require('ioredis');
const Stripe = require('stripe');

const app = express();
const cache = new redis(process.env.REDIS_URL);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(express.json());

// ----- Idempotency middleware -----
// Checks Redis for a stored response for the idempotency key
// If found: return cached response immediately (no re-processing)
// If not found: process request, store result, return result
async function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required for payment requests' });
  }

  const redisKey = `idempotency:${idempotencyKey}`;

  // Check if we already processed this request
  const cached = await cache.get(redisKey);
  if (cached) {
    const { statusCode, body } = JSON.parse(cached);
    console.log(`Idempotent replay for key: ${idempotencyKey}`);
    return res.status(statusCode).json(body);
  }

  // Intercept res.json to capture the response before sending
  // This allows us to store the response in Redis after it's generated
  const originalJson = res.json.bind(res);
  res.json = async (body) => {
    // Only cache successful or deterministic error responses (not 500s)
    if (res.statusCode < 500) {
      await cache.setex(redisKey, 86400, JSON.stringify({ statusCode: res.statusCode, body }));
    }
    return originalJson(body);
  };

  next();
}

// ----- Payment charge route -----
app.post('/payments/charge', idempotencyMiddleware, async (req, res, next) => {
  const { customerId, amount, currency, paymentMethodId, orderId } = req.body;

  try {
    // Step 1: Check if order already has a charge (DB-level idempotency as backup)
    const existingCharge = await db.charges.findByOrderId(orderId);
    if (existingCharge) {
      return res.status(200).json({ chargeId: existingCharge.stripeChargeId, status: 'already_charged' });
    }

    // Step 2: Call Stripe with its own idempotency key
    // Stripe guarantees the same chargeId for the same idempotency key
    const charge = await stripe.paymentIntents.create(
      {
        amount,
        currency,
        customer: customerId,
        payment_method: paymentMethodId,
        confirm: true,
      },
      {
        idempotencyKey: `stripe-${orderId}`, // Stripe-level idempotency
      }
    );

    // Step 3: Write to DB
    await db.charges.insert({ orderId, stripeChargeId: charge.id, amount, status: 'success' });

    res.status(200).json({ chargeId: charge.id, status: 'success' });
  } catch (err) {
    // Do NOT cache 500 errors - they may be transient
    next(err);
  }
});

const db = {
  charges: {
    findByOrderId: async () => null,
    insert: async () => {},
  },
};
```

### Step-by-Step Explanation

1. **Client generates an idempotency key** - a unique UUID per request attempt, stored client-side. For retries of the same operation, the same key is reused.
2. **Server checks Redis** for the key before processing. If found, returns the cached response without running the business logic again.
3. **If not found**, the server processes the request, completes the operation, and stores the result in Redis with a TTL (24 hours is standard).
4. **Scope**: idempotency keys should be scoped to the operation (e.g. `order-123-payment-attempt-1`) - not global. The TTL defines the retry window.
5. **Stripe's own idempotency**: pass `idempotencyKey` to Stripe so that even if your server crashes after Stripe charges but before writing to your DB, a retry won't double-charge. Stripe returns the same `chargeId` for the same key.
6. **Database-level backstop**: check if an order already has a charge record before calling the payment gateway - protects against race conditions if two requests arrive simultaneously before either caches the key.
7. **What NOT to cache**: 5xx errors - they may be transient (DB down, deployment in progress). Cache only successful (2xx) and deterministic client error (4xx) responses.
8. **Concurrency**: use Redis `SET NX` (set if not exists) atomically to prevent two simultaneous requests with the same key from both processing.

### Complexity

| Concern | Solution |
|---------|---------|
| Double charge prevention | Idempotency key in Redis + Stripe's own key |
| Network timeout retries | Same key reused - Redis returns cached result |
| Redis miss after DB write | DB-level check as secondary guard |
| Concurrent duplicate requests | Redis SET NX (atomic) before processing |
| Key storage TTL | 24h - standard retry window |
| Key generation | UUID v4 client-side, sent as Idempotency-Key header |

---

## Q103: What are the trade-offs between message queues (SQS) and event streams (Kafka)?

### ELI5

A message queue (SQS) is like a post office inbox: letters arrive, you pick them up and process them, and once you're done the letter is gone. Perfect for task delegation. An event stream (Kafka) is like a recorded radio broadcast stored on tape: you can replay any part of the broadcast at any time, and many different listeners can listen to the same tape independently from wherever they left off. Kafka keeps the events forever (or for a configured duration). SQS deletes messages once consumed. Choose the post office for tasks; choose the recording for event history, replay, and multiple independent consumers.

### Visual Diagram

```
SQS (Message Queue):
  Producer --> [Queue] --> Consumer A
                              |
                         message deleted
  Consumer B cannot read the same message

Kafka (Event Stream):
  Producer --> [Topic: orders] --> Consumer Group A (offset: 15000)
                               --> Consumer Group B (offset: 14990)
                               --> Consumer Group C (offset: 15000)
                 messages retained (configurable: 7 days default)
                 each group reads independently at its own offset

+--------------------+--------------------+---------------------+
| Feature            | SQS                | Kafka               |
+--------------------+--------------------+---------------------+
| Message retention  | Until consumed     | Time/size based     |
| Replay             | No                 | Yes (seek to offset)|
| Multi-consumer     | No (competing)     | Yes (consumer groups|
| Throughput         | High               | Extremely high      |
| Delivery guarantee | At-least-once      | At-least-once       |
|                    | (FIFO: exactly-once)| (idempotent prod.) |
| Ordering           | FIFO queue only    | Per-partition       |
| Ops complexity     | Zero (managed)     | High (cluster mgmt) |
| Best for           | Task delegation    | Event sourcing,     |
|                    | Work queues        | audit log, pipelines|
+--------------------+--------------------+---------------------+
```

### Code Example

```javascript
// ----- SQS: Fire-and-forget task queue -----
// Good for: sending emails, resizing images, processing orders
const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const sqs = new SQSClient({ region: 'us-east-1' });

// Producer: enqueue a task
async function enqueueEmailTask(userId, template) {
  await sqs.send(new SendMessageCommand({
    QueueUrl: process.env.EMAIL_QUEUE_URL,
    MessageBody: JSON.stringify({ userId, template }),
    MessageDeduplicationId: `email-${userId}-${template}`, // FIFO queue dedup
    MessageGroupId: 'emails',
  }));
}

// Consumer: poll and process - message is DELETED after processing
async function processEmailQueue() {
  const { Messages } = await sqs.send(new ReceiveMessageCommand({
    QueueUrl: process.env.EMAIL_QUEUE_URL,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20, // long polling
  }));

  for (const message of Messages || []) {
    const { userId, template } = JSON.parse(message.Body);
    await sendEmail(userId, template); // process the task

    // Delete the message - it's gone, no other consumer can read it
    await sqs.send(new DeleteMessageCommand({
      QueueUrl: process.env.EMAIL_QUEUE_URL,
      ReceiptHandle: message.ReceiptHandle,
    }));
  }
}

// ----- Kafka: Event stream with replay and multiple consumers -----
// Good for: audit logs, event sourcing, feeding multiple downstream services
const { Kafka } = require('kafkajs');
const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER] });

// Producer: publish an event to a topic (message is RETAINED)
const producer = kafka.producer();
async function publishOrderEvent(order) {
  await producer.connect();
  await producer.send({
    topic: 'orders',
    messages: [
      {
        key: order.id,          // partition key - same orderId always goes to same partition
        value: JSON.stringify({ event: 'ORDER_CREATED', order }),
      },
    ],
  });
}

// Consumer Group A: shipment service reads order events
const shippingConsumer = kafka.consumer({ groupId: 'shipping-service' });
async function startShippingConsumer() {
  await shippingConsumer.connect();
  await shippingConsumer.subscribe({ topic: 'orders', fromBeginning: false });

  await shippingConsumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const { event, order } = JSON.parse(message.value.toString());
      if (event === 'ORDER_CREATED') {
        await scheduleShipment(order); // independent of Consumer Group B
      }
      // Kafka does NOT delete the message - Consumer Group B reads it independently
    },
  });
}

// Consumer Group B: analytics service reads the SAME events independently
// Can run behind or ahead of Consumer Group A - Kafka tracks offsets per group
const analyticsConsumer = kafka.consumer({ groupId: 'analytics-service' });
```

### Step-by-Step Explanation

1. **SQS semantics**: message is stored until a consumer picks it up, processes it, and explicitly deletes it. After deletion, it's gone - no other consumer can read it. Perfect for distributing work among competing workers.
2. **Kafka semantics**: messages are appended to an immutable log (topic/partition). They are retained for a configurable duration (days to weeks). Consumer groups each maintain their own read offset - independent consumers read at their own pace.
3. **Replay**: Kafka allows consumers to seek to any offset and reprocess historical events (e.g. reprocessing all orders to rebuild a read model). SQS cannot replay - once deleted, gone.
4. **Multiple independent consumers**: Kafka consumer groups each read the full event stream independently. SQS competing consumers share the queue - one processes each message.
5. **Throughput**: Kafka handles millions of messages/second via partitioning (horizontal scale). SQS scales automatically but with lower raw throughput per queue.
6. **Ordering**: SQS FIFO guarantees order within a MessageGroupId. Kafka guarantees order within a partition (key-based routing maintains per-entity order).
7. **Operational complexity**: SQS is fully managed - zero ops. Kafka requires cluster management (brokers, ZooKeeper/KRaft, replication). MSK (Amazon Managed Kafka) reduces ops burden.
8. **Choose SQS for**: email sending, image resizing, job queues, microservice task delegation. **Choose Kafka for**: event sourcing, audit trails, CDC (change data capture), feeding multiple analytics/ML pipelines from the same event stream.

### Complexity

| Dimension | SQS | Kafka |
|-----------|-----|-------|
| Max retention | 14 days | Unlimited (disk-bound) |
| Replay | No | Yes |
| Consumer isolation | No (competing) | Yes (consumer groups) |
| Throughput | ~3000 msg/s standard; FIFO lower | Millions/s |
| Ordering guarantee | FIFO queue: yes | Per partition: yes |
| Operational overhead | Zero (AWS managed) | High (or use MSK) |
| Latency | ~1ms-20ms | ~5ms-50ms |

---

## Q104: How would you design a URL shortener that handles 10 billion redirects per day?

### ELI5

A URL shortener takes a long web address and creates a short code (like `sho.rt/abc123`). When someone visits the short URL, you look up the code, find the original URL, and redirect them. Easy for one person. For 10 billion redirects per day (115,000 per second), you need to make that lookup nearly instant and never go to the database on every request. The trick: cache every short code in Redis. Once it's in Redis, it's a sub-millisecond lookup. The database is only hit the very first time a code is seen.

### Visual Diagram

```
Write path (shorten a URL):
  Client --> POST /shorten { url: "https://very-long-url.com" }
       --> Generate 7-char code (Base62 from auto-increment ID or hash)
       --> Write to Postgres: { code: "abc1234", url: "...", clicks: 0 }
       --> Write to Redis:    SET short:abc1234 "https://..." EX 2592000
       <-- Return: { shortUrl: "sho.rt/abc1234" }

Read path (redirect):
  Client --> GET /abc1234
    Step 1: Redis GET short:abc1234
      HIT  --> 301/302 redirect (instant, no DB)
      MISS --> Postgres SELECT + Redis SET + redirect

Scale: 10B/day = 115,741 req/s
  Redis: ~100k-500k GET/s per node --> 1-3 Redis nodes sufficient
  CDN: pre-warm popular short codes at edge (cache 301 at CDN level)

+---+      +-----+     +-------+     +----------+
|CDN| MISS |LB   | --> | App   | --> |Redis     |
|   | -----+     |     |Server |     |short:xyz |  HIT -> redirect
+---+      +-----+     |       |     +----------+
                       |       | MISS      |
                       |       | -------> +----------+
                       |       |          | Postgres |
                       |       |          +----------+
                       +-------+
```

### Code Example

```javascript
const express = require('express');
const redis = require('ioredis');
const { Pool } = require('pg');
const { customAlphabet } = require('nanoid');

const app = express();
app.use(express.json());

const cache = new redis(process.env.REDIS_URL);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Base62 alphabet for short codes - 7 chars = 62^7 = ~3.5 trillion combinations
const generateCode = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 7);

const CACHE_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
const REDIRECT_CACHE_KEY = (code) => `short:${code}`;

// ----- Write path: shorten a URL -----
app.post('/shorten', async (req, res, next) => {
  const { url, customCode } = req.body;

  if (!isValidUrl(url)) return res.status(400).json({ error: 'Invalid URL' });

  try {
    const code = customCode || generateCode();

    // Write to Postgres (source of truth)
    const { rows } = await pool.query(
      `INSERT INTO urls (code, long_url, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (code) DO NOTHING
       RETURNING code`,
      [code, url]
    );

    if (rows.length === 0 && customCode) {
      return res.status(409).json({ error: 'Custom code already taken' });
    }

    // Write-through: populate Redis immediately so first redirect is fast
    await cache.setex(REDIRECT_CACHE_KEY(code), CACHE_TTL, url);

    res.json({ shortUrl: `${process.env.BASE_URL}/${code}`, code });
  } catch (err) {
    next(err);
  }
});

// ----- Read path: redirect -----
// This is the hot path - must be as fast as possible
app.get('/:code', async (req, res, next) => {
  const { code } = req.params;

  // Validate code format to prevent injection / unnecessary DB lookups
  if (!/^[a-zA-Z0-9]{4,10}$/.test(code)) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    // Step 1: Redis cache (sub-millisecond)
    const cachedUrl = await cache.get(REDIRECT_CACHE_KEY(code));
    if (cachedUrl) {
      // Increment click counter asynchronously - don't block the redirect
      cache.incr(`clicks:${code}`).catch(() => {}); // fire and forget
      return res.redirect(301, cachedUrl); // 301 = permanent (browser caches too)
    }

    // Step 2: Cache miss - hit Postgres
    const { rows } = await pool.query(
      'SELECT long_url FROM urls WHERE code = $1',
      [code]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Short URL not found' });

    const longUrl = rows[0].long_url;

    // Repopulate cache (cache-aside)
    await cache.setex(REDIRECT_CACHE_KEY(code), CACHE_TTL, longUrl);

    // Async click tracking
    cache.incr(`clicks:${code}`).catch(() => {});

    res.redirect(301, longUrl);
  } catch (err) {
    next(err);
  }
});

function isValidUrl(str) {
  try { new URL(str); return true; } catch { return false; }
}

app.listen(3000);
```

### Step-by-Step Explanation

1. **Short code generation**: use Base62 (digits + lowercase + uppercase = 62 chars). 7 characters = 62â· â‰ˆ 3.5 trillion unique codes - sufficient for decades.
2. **Write path**: generate code â†’ insert into Postgres (unique constraint) â†’ write-through to Redis. Postgres is the source of truth; Redis is the fast lookup layer.
3. **Read path (hot)**: `GET /code` â†’ Redis lookup in ~0.5ms â†’ 301 redirect. No DB hit on cache hit.
4. **Read path (cold)**: Redis miss â†’ Postgres query â†’ repopulate Redis (cache-aside) â†’ redirect. Only ~1% of requests after warm-up.
5. **Click tracking**: fire-and-forget `INCR` in Redis - never blocks the redirect response. Flush to Postgres periodically (background job).
6. **CDN layer**: 301 responses are cached by browsers AND CDN edge nodes. Popular links never even reach your servers on subsequent visits from the same user or edge PoP.
7. **Scaling the read path**: Redis can handle ~100k-500k GET/s per node. For 115k req/s, a 2-node Redis cluster is sufficient with room to spare.
8. **Database schema**: `urls(code VARCHAR(10) PK, long_url TEXT NOT NULL, created_at TIMESTAMP, click_count INT DEFAULT 0)`. Index on `code` is the primary key - O(log N) lookup.

### Complexity

| Component | Metric | Solution |
|-----------|--------|---------|
| Redirect latency (cache hit) | ~0.5-2ms | Redis GET |
| Redirect latency (cache miss) | ~5-20ms | Postgres + Redis SET |
| Write throughput | ~1k URLs/s | Postgres + Redis write-through |
| Read throughput | 115k req/s | 2-3 Redis nodes |
| Code space | 3.5 trillion | 7-char Base62 |
| Cache hit rate | ~99% | Write-through + 30d TTL |

--- End of Section 11 ---

---


# Section 12: AWS & DEVOPS (Q105-Q115)

---

## Q105: What is the difference between ECS and EKS? When would you choose each?

### ELI5

ECS (Elastic Container Service) is like a managed apartment complex where Amazon handles all the building maintenance — you just say "I need 3 apartments running this app" and they appear. EKS (Elastic Kubernetes Service) is like buying a plot of land with a blueprint (Kubernetes) — you get full control over the building's design, layout and plumbing, but you also have to understand and manage more of the infrastructure. ECS is simpler and AWS-native; EKS is more powerful and portable (runs the same way on Azure, GCP, or on-prem).

### Visual Diagram

```
ECS Architecture:
  [ECS Cluster]
    |-- Task Definition (what container to run, CPU/memory, env vars)
    |-- Service (how many copies, load balancer, auto-scaling)
    |-- Launch Type:
        |-- Fargate: AWS manages EC2 instances entirely (serverless)
        |-- EC2: You manage the underlying EC2 instances

EKS Architecture:
  [EKS Cluster]
    |-- Control Plane (AWS manages: API server, etcd, scheduler)
    |-- Worker Nodes (you manage: EC2 or Fargate)
    |-- Workloads:
        |-- Deployment (desired replicas)
        |-- Service (networking)
        |-- Ingress (HTTP routing)
        |-- ConfigMap / Secret
        |-- HPA (Horizontal Pod Autoscaler)

+------------------------+--------------------+--------------------+
| Feature                | ECS (Fargate)      | EKS                |
+------------------------+--------------------+--------------------+
| Setup complexity       | Low                | High               |
| AWS integration        | Deep (IAM, ALB...) | Good (via add-ons) |
| Portability            | AWS only           | Multi-cloud / hybrid|
| K8s ecosystem (Helm,   | No                 | Yes                |
| Operators, etc.)       |                    |                    |
| Auto-scaling           | Service auto-scale | HPA + KEDA         |
| Cost (per task)        | Per vCPU/mem used  | Per node + mgmt fee|
| Learning curve         | Low                | High               |
+------------------------+--------------------+--------------------+
```

### Code Example

```yaml
# ----- ECS Task Definition (simplified) -----
# Defines what container to run — AWS handles scheduling
{
  "family": "api-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",       # 0.5 vCPU
  "memory": "1024",   # 1 GB RAM
  "containerDefinitions": [
    {
      "name": "api",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/api:latest",
      "portMappings": [{ "containerPort": 3000 }],
      "environment": [{ "name": "NODE_ENV", "value": "production" }],
      "secrets": [
        { "name": "DB_PASSWORD", "valueFrom": "arn:aws:ssm:us-east-1:...:parameter/db-pass" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/api-service",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

```yaml
# ----- EKS Deployment (Kubernetes manifest) -----
# Same app on Kubernetes — more verbose but fully portable
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-service
  template:
    metadata:
      labels:
        app: api-service
    spec:
      containers:
        - name: api
          image: 123456789.dkr.ecr.us-east-1.amazonaws.com/api:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: production
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: password
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "500m"
              memory: "1Gi"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-service
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### Step-by-Step Explanation

1. **ECS** is AWS's proprietary container orchestrator. You define a Task Definition (container image, CPU, memory, env) and a Service (desired count, load balancer integration). AWS handles scheduling.
2. **Fargate launch type** (ECS or EKS): AWS manages the underlying EC2 instances entirely. You pay per task vCPU/memory-second. No EC2 patching, no cluster node management.
3. **EKS** runs the Kubernetes control plane managed by AWS (API server, scheduler, etcd). You still manage worker nodes (EC2 or Fargate) and configure Kubernetes workloads.
4. **Choose ECS when**: team is small, AWS-only deployment, you want simplicity and fast setup, no requirement for K8s ecosystem (Helm, Operators), or you're already deep in AWS native services.
5. **Choose EKS when**: need Kubernetes portability (multi-cloud or on-prem hybrid), existing K8s tooling (Helm charts, ArgoCD, Istio), complex workloads (StatefulSets, custom schedulers, CRDs), or a large team with K8s expertise.
6. **IAM integration**: ECS has native IAM task roles (simple). EKS uses IRSA (IAM Roles for Service Accounts) — more setup but same security model.
7. **Cost**: EKS charges $0.10/hour for the control plane on top of worker node costs. ECS Fargate charges only for task resources — cheaper for sporadic workloads.
8. **Migration**: ECS tasks and EKS pods use the same Docker container image — migration is a config change, not a code change.

### Complexity

| Factor | ECS (Fargate) | EKS |
|--------|--------------|-----|
| Time to first deploy | ~15 min | ~30-60 min cluster setup |
| Ops burden | Very low | Medium-high |
| Ecosystem | AWS native only | Full K8s ecosystem |
| Portability | AWS only | Any cloud / on-prem |
| Auto-scaling | Service scaling | HPA, VPA, KEDA, Karpenter |
| Best team size | Small to medium | Medium to large |

---

---

## Q106: How does a Blue/Green deployment differ from a Canary deployment?

### ELI5

Imagine you run a restaurant. **Blue/Green**: you build a brand-new identical kitchen (Green), cook a test meal, then flip the sign from "Blue Kitchen" to "Green Kitchen" all at once. If the Green kitchen catches fire you flip the sign back instantly. **Canary**: you keep one chef trying new recipes while the other 99 chefs keep the old menu. If the new recipe gets good reviews, you slowly give it to more chefs — 5%, 25%, 50%, 100%. Blue/Green is a big switch; Canary is a slow drip.

### Visual Diagram

```
BLUE / GREEN
============

  [Load Balancer]
        |
   +----+----+
   v         v
[Blue v1]  [Green v2]  <-- both running
   (live)   (idle/test)

  Switch:  LB points 100% traffic to Green
  Rollback: LB re-points 100% traffic to Blue

-----------------------------------------------

CANARY
======

  [Load Balancer]   (weighted routing)
        |
   +----+----------+
   v               v
[Stable v1]    [Canary v2]
 95% traffic    5% traffic
                    |
             (monitor errors/latency)
                    |
            if OK --> 25% --> 50% --> 100%
            if BAD --> 0%  (cut off canary)
```

### Code Example

```javascript
// Simulating weighted routing decision (as a load-balancer rule)
// In AWS this is done with ALB weighted target groups or Route 53 weighted records

// --- Blue/Green via AWS CDK (conceptual) ---
// You swap the ALB listener's default action from blue TG to green TG
const blueTargetGroup = elbv2.ApplicationTargetGroup(...);
const greenTargetGroup = elbv2.ApplicationTargetGroup(...);

// Before deploy: listener points to blue
listener.addAction('default', { action: ListenerAction.forward([blueTargetGroup]) });

// After green passes smoke tests, update listener:
listener.addAction('default', { action: ListenerAction.forward([greenTargetGroup]) });
// Rollback = swap back to blue — instant, no new deploy needed

// --- Canary via GitHub Actions + AWS CodeDeploy ---
// appspec.yml (CodeDeploy config)
/*
version: 0.0
Resources:
  - TargetService:
      Type: AWS::ECS::Service
      Properties:
        TaskDefinition: <TASK_DEFINITION>
        LoadBalancerInfo:
          ContainerName: "app"
          ContainerPort: 3000
Hooks:
  - BeforeAllowTraffic: "validate-canary-health"
  - AfterAllowTraffic:  "run-integration-tests"
*/

// GitHub Actions step — trigger CodeDeploy canary
// deployment config: CodeDeployDefault.ECSCanary10Percent5Minutes
// = 10% traffic to new version for 5 minutes, then 90% if no alarms

const deploymentConfig = 'CodeDeployDefault.ECSCanary10Percent5Minutes';
// Stage 1: 10% → wait 5 min → check CloudWatch alarms
// Stage 2: 100% → done
// Rollback: if alarm triggers, CodeDeploy auto-reverts to old task definition

// --- Simulating weighted routing in Node.js (unit-test / mock) ---
function routeTraffic(canaryPercent) {
  // Returns which version handles this request
  const roll = Math.random() * 100;      // 0–100
  return roll < canaryPercent ? 'v2-canary' : 'v1-stable';
}

console.log(routeTraffic(5));   // ~5% chance of 'v2-canary'
console.log(routeTraffic(50));  // 50/50 split during gradual rollout
```

### Step-by-Step Explanation

1. **Blue/Green core idea**: maintain two identical production environments (Blue = current live, Green = new version). Deploy the new version to Green, run smoke tests, then redirect 100% of traffic from Blue to Green in one atomic switch.
2. **Instant rollback**: because Blue is still running and unchanged, rollback is just flipping the load balancer target back — takes seconds rather than a new deployment.
3. **Cost trade-off**: Blue/Green requires double the infrastructure during the transition window. Canary runs a small split (5–10%) so the extra cost is minimal.
4. **Canary core idea**: route a small percentage of real production traffic to the new version. Monitor error rates, latency, and business metrics. Gradually increase the percentage as confidence grows. Cut off the canary instantly if metrics degrade.
5. **Risk profile**: Blue/Green exposes *all* users to the new version at once (just for a moment). Canary limits blast radius — only the 5% canary users see a bug before you catch it.
6. **AWS tooling**: CodeDeploy supports both strategies natively for ECS, Lambda, and EC2. ALB weighted target groups and Route 53 weighted records enable Canary at the DNS level.
7. **Feature flags vs Canary**: Feature flags are code-level routing (same binary, different path). Canary is infrastructure-level routing (different deployments). They can be combined: canary the deployment *and* gate features inside it.
8. **When to use Blue/Green**: stateless services, database migrations already applied, team needs simple rollback, or compliance requires zero-downtime cut-over.
9. **When to use Canary**: high-risk changes to critical paths (checkout, auth), when you want real-user validation before full rollout, or when paired with automated rollback on CloudWatch alarms.

### Complexity

| Factor | Blue/Green | Canary |
|--------|-----------|--------|
| Rollback speed | Instant (LB switch) | Near-instant (weight to 0%) |
| Blast radius on bad deploy | 100% users (brief) | Small % users |
| Infrastructure cost | 2x during transition | ~1.05x to 1.1x |
| Complexity to set up | Low-medium | Medium-high |
| Real-user testing before full rollout | No | Yes |
| DB migration compatibility needed | Yes (backward compat) | Yes (both versions run) |

---

## Q107: How do you auto-scale ECS tasks based on both CPU utilization and SQS queue depth?

### ELI5

Your restaurant has two warning lights: one for "kitchen is too hot" (CPU) and one for "too many orders waiting" (queue). You hire extra chefs when either light turns on, and fire — er, let go of — chefs when both lights are off. ECS Application Auto Scaling watches both signals and adds or removes tasks automatically so your app never falls behind.

### Visual Diagram

```
SQS Queue
  |
  | ApproximateNumberOfMessagesVisible
  v
[CloudWatch Metric] --+
                      |
[ECS CPU Metric] -----+---> [Target Tracking / Step Scaling Policy]
                      |              |
                      |      Desired count UP / DOWN
                      |              |
                      v              v
              [ECS Service]  <-- [Application Auto Scaling]
              [Task 1]
              [Task 2]
              [Task N]  <-- new tasks added when alarm fires
```

### Code Example

```javascript
// Infrastructure-as-Code example (AWS CDK, TypeScript/JS-style pseudocode)

// 1. Register ECS service as a scalable target
const scalableTarget = new appscaling.ScalableTarget(this, 'EcsScalable', {
  serviceNamespace: appscaling.ServiceNamespace.ECS,
  resourceId: `service/${cluster.clusterName}/${service.serviceName}`,
  scalableDimension: 'ecs:service:DesiredCount',
  minCapacity: 1,     // never scale below 1 task
  maxCapacity: 20,    // never exceed 20 tasks
});

// 2. CPU-based target tracking — keep average CPU at 60%
scalableTarget.scaleToTrackMetric('CpuScaling', {
  targetValue: 60,    // percent
  predefinedMetric: appscaling.PredefinedMetric.ECS_SERVICE_AVERAGE_CPU_UTILIZATION,
  scaleInCooldown: Duration.seconds(60),   // wait 60s before scaling in
  scaleOutCooldown: Duration.seconds(30),  // scale out fast
});

// 3. SQS queue depth — custom metric
// backlogPerTask = QueueDepth / RunningTaskCount
// Target: each task handles at most 10 messages at a time
const backlogPerTask = new cloudwatch.MathExpression({
  expression: 'queueDepth / taskCount',
  usingMetrics: {
    queueDepth: queue.metricApproximateNumberOfMessagesVisible(),
    taskCount:  service.metricCpuUtilization().with({ statistic: 'SampleCount' }),
    // SampleCount of CPU metric ≈ number of running tasks
  },
});

scalableTarget.scaleToTrackMetric('QueueScaling', {
  targetValue: 10,              // 10 messages per task
  customMetric: backlogPerTask,
  scaleInCooldown: Duration.seconds(120),
  scaleOutCooldown: Duration.seconds(15),  // queue growing = scale out fast
});

// 4. In your Node.js worker (the ECS task)
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const sqs = new SQSClient({ region: process.env.AWS_REGION });

async function poll() {
  while (true) {
    const { Messages = [] } = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: process.env.QUEUE_URL,
      MaxNumberOfMessages: 10,   // process up to 10 at once
      WaitTimeSeconds: 20,       // long-polling — reduces empty receives
    }));

    for (const msg of Messages) {
      await processJob(JSON.parse(msg.Body));   // your business logic
      await sqs.send(new DeleteMessageCommand({
        QueueUrl: process.env.QUEUE_URL,
        ReceiptHandle: msg.ReceiptHandle,        // only delete after success
      }));
    }
  }
}

poll().catch(console.error);
```

### Step-by-Step Explanation

1. **Register a scalable target**: tell Application Auto Scaling about your ECS service, its min/max task count, and the dimension to adjust (`DesiredCount`).
2. **CPU target tracking**: ASG continuously measures average CPU across all tasks. If CPU rises above 60%, it adds tasks. If it drops well below 60%, it removes tasks after the cooldown period. AWS handles the math — you just set the target.
3. **Queue depth metric**: `ApproximateNumberOfMessagesVisible` measures backlog. The key ratio is *backlog per task* — if you want each task to handle 10 messages, set target = 10. When queue grows, ASG adds tasks proportionally.
4. **Multiple policies**: both policies are active simultaneously. ASG takes the *maximum* desired count suggested by any active policy — so CPU pressure or queue pressure, whichever demands more tasks, wins.
5. **Long-polling**: your Node.js worker uses `WaitTimeSeconds: 20` to avoid spinning in empty-queue loops, which would inflate CPU metrics and cause false scale-outs.
6. **Delete-after-success**: never delete a message before processing is confirmed. If the task crashes mid-job, the message stays in the queue and another task picks it up.
7. **Cooldowns**: scale-out cooldown is short (15–30s) so you react quickly to spikes. Scale-in cooldown is longer (60–120s) to avoid flapping (adding/removing tasks repeatedly).
8. **Fargate vs EC2 launch type**: with Fargate, new tasks start in ~30–60s. With EC2, you may also need an EC2 Auto Scaling group to provision nodes before ECS can place tasks — adding latency.

### Complexity

| Aspect | Detail |
|--------|--------|
| Scale-out trigger | Either CPU > target OR backlog/task > target |
| Scale-in trigger | Both metrics below target for cooldown period |
| Min / Max tasks | Configurable per service (e.g., 1 min, 20 max) |
| Fargate new task start time | ~30-60 seconds |
| Long-poll cost saving | Up to 95% fewer empty ReceiveMessage API calls |
| Policy conflict resolution | ASG picks the highest desired count across all policies |

---
