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

## Q108: What is the difference between RTO and RPO in disaster recovery?

### ELI5

Imagine your laptop crashes and Burns. **RPO** (Recovery Point Objective) is "how far back in time is the last backup I can restore from?" — it measures *how much data you can afford to lose*. **RTO** (Recovery Time Objective) is "how long until the laptop is working again?" — it measures *how long the system can be down*. Low RPO = frequent backups. Low RTO = fast recovery. Both cost money, so you pick a balance.

### Visual Diagram

```
Timeline:
----------+----------+----------+----------+---------+---------->
          |          |          |          |         |
         Last      Incident   System     System     NOW
        backup      hits      detected   restored
          |          |                   |
          |<-- RPO -->|                  |
          |  (data loss window)          |
                     |<------- RTO ----->|
                     |  (downtime window)|

Example numbers:
  RPO = 1 hour  --> last backup was taken 1 hour before crash
                --> you lose at most 1 hour of data
  RTO = 4 hours --> system must be running again within 4 hours
```

### Code Example

```javascript
// Practical Node.js patterns that improve RPO and RTO

// ----- IMPROVING RPO -----
// 1. Continuous WAL shipping to S3 (PostgreSQL) or point-in-time recovery
//    Configured in database -- not Node.js code.
//    RPO with Aurora: ~1 second (continuous log shipping)
//    RPO with daily RDS snapshot: up to 24 hours of data loss

// 2. Write-ahead pattern: persist to durable store BEFORE confirming to client
app.post('/order', async (req, res) => {
  // Write to DB first (durable), then enqueue async work
  const order = await db.orders.create(req.body);      // durable write
  await sqs.send(new SendMessageCommand({               // async side effect
    QueueUrl: process.env.ORDER_QUEUE,
    MessageBody: JSON.stringify({ orderId: order.id }),
  }));
  res.json({ orderId: order.id });  // confirm only after durable write
});

// ----- IMPROVING RTO -----
// 3. Health check endpoint that load balancer polls
app.get('/health', async (req, res) => {
  try {
    await db.raw('SELECT 1');   // check DB connectivity
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: err.message });
    // LB marks instance unhealthy, routes traffic to standby region
  }
});

// 4. Graceful shutdown — drain in-flight requests before process exits
//    Helps RTO by ensuring the new instance starts clean
process.on('SIGTERM', async () => {
  server.close(async () => {       // stop accepting new connections
    await db.destroy();            // close DB pool cleanly
    process.exit(0);
  });
  // Force-kill after 10s if shutdown hangs
  setTimeout(() => process.exit(1), 10_000);
});

// DR strategy cost vs RTO/RPO tradeoff reference:
const DR_STRATEGIES = [
  { name: 'Backup & Restore',   rpo: '24h',    rto: '24h',    costFactor: '$'    },
  { name: 'Pilot Light',        rpo: '1h',     rto: '4h',     costFactor: '$$'   },
  { name: 'Warm Standby',       rpo: 'minutes', rto: 'minutes', costFactor: '$$$' },
  { name: 'Multi-Site Active',  rpo: 'seconds', rto: 'seconds', costFactor: '$$$$' },
];
```

### Step-by-Step Explanation

1. **RPO defined**: the maximum acceptable amount of data loss measured in time. If your RPO is 1 hour, you must take backups at least every hour so no more than 1 hour of transactions are lost in a disaster.
2. **RTO defined**: the maximum acceptable downtime. If your RTO is 4 hours, the system must be fully operational within 4 hours of an incident being declared.
3. **Backup & Restore**: cheapest. Daily snapshots to S3. RPO = up to 24h, RTO = hours (restore from snapshot, warm up caches). Fine for non-critical workloads.
4. **Pilot Light**: DR region has a minimal core running (database replica, no app servers). On disaster, start app servers from AMI/ECS and point DNS at DR. RPO = minutes (continuous replication), RTO = 10–30 min.
5. **Warm Standby**: scaled-down but fully functional copy in DR region handles a small % of traffic. On disaster, scale up and shift 100% of traffic. RPO = seconds, RTO = minutes.
6. **Multi-Site Active-Active**: both regions serve live traffic all the time. No DR switchover needed — the healthy region absorbs the failed region's traffic. RPO and RTO approach zero but cost doubles.
7. **AWS tools**: RDS Multi-AZ (automatic failover, RTO ~60s, RPO ~seconds), Aurora Global Database (RPO < 1s, RTO < 1 min), Route 53 health checks + failover routing, S3 cross-region replication.

### Complexity

| DR Strategy | RPO | RTO | Cost Factor | AWS Services |
|-------------|-----|-----|-------------|--------------|
| Backup & Restore | ~24h | ~24h | $ | RDS snapshots, S3 |
| Pilot Light | ~1h | ~1-4h | $$ | RDS read replica, Route 53 |
| Warm Standby | minutes | minutes | $$$ | Aurora Global, ALB, ASG |
| Multi-Site Active | seconds | seconds | $$$$ | Aurora Global, Route 53 latency |

---

## Q109: How do you implement structured logging in Node.js for AWS CloudWatch?

### ELI5

Instead of printing "something went wrong", you write a JSON receipt for every event: what happened, which user, which request ID, how long it took. CloudWatch can then search millions of receipts instantly with filter expressions — like asking a searchable database instead of grepping through raw text.

### Visual Diagram

```
Node.js App
  |
  | logger.info({ requestId, userId, duration, status })
  v
[pino / winston]  -- JSON line per event -->  stdout
  |
  v
[ECS / Lambda stdout]
  |
  v
[CloudWatch Logs Agent / FireLens]
  |
  v
[CloudWatch Log Group: /app/production]
  |
  +-- [Metric Filter]  errors per minute  --> CloudWatch Alarm
  |
  +-- [Insights Query] avg latency by route --> Dashboard
  |
  +-- [Log Insights]   find requestId=xyz  --> Debug trace
```

### Code Example

```javascript
// 1. Install pino (fast JSON logger)
// npm install pino pino-http

const pino = require('pino');
const pinoHttp = require('pino-http');

// Create the base logger — outputs newline-delimited JSON to stdout
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',  // control verbosity via env var
  base: {
    service: 'order-api',                  // always include service name
    env: process.env.NODE_ENV,             // always include environment
  },
  // In production, leave redact to strip sensitive fields
  redact: ['req.headers.authorization', 'body.password', 'body.creditCard'],
  timestamp: pino.stdTimeFunctions.isoTime, // ISO 8601 timestamp
});

// 2. HTTP request middleware — auto-logs every request + response
const httpLogger = pinoHttp({
  logger,
  customLogLevel(res, err) {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage(res) {
    return `${res.req.method} ${res.req.url} ${res.statusCode}`;
  },
  // adds req.id (correlation ID) to every log in the request lifecycle
  genReqId(req) {
    return req.headers['x-request-id'] || require('crypto').randomUUID();
  },
});

app.use(httpLogger);

// 3. Child logger — bind context to a specific request
app.post('/order', async (req, res) => {
  const log = req.log.child({ userId: req.user.id, orderId: req.body.orderId });

  log.info('Processing order');

  try {
    const result = await orderService.place(req.body);
    log.info({ result }, 'Order placed successfully');
    res.json(result);
  } catch (err) {
    log.error({ err }, 'Order placement failed');   // err.stack auto-serialized
    res.status(500).json({ error: 'Order failed' });
  }
});

// 4. CloudWatch Insights query (run in AWS console or via SDK)
// Find all errors in the last hour with response time > 1s:
/*
  fields @timestamp, requestId, userId, err.message, responseTime
  | filter level = 'error' and responseTime > 1000
  | sort @timestamp desc
  | limit 50
*/

// 5. CloudWatch Metric Filter (defined in CloudFormation / CDK)
// Pattern: { $.level = "error" }  --> Metric: ErrorCount
// Alarm: ErrorCount > 10 in 5 minutes --> SNS alert
```

### Step-by-Step Explanation

1. **JSON over plain text**: CloudWatch Logs Insights can parse JSON fields natively. With plain text you can only do substring matching; with JSON you can filter and aggregate on any field (userId, statusCode, duration).
2. **Correlation ID (requestId)**: generate or forward a unique request ID on every incoming HTTP request. Attach it to every log line produced during that request. Later you can query all logs for a single user journey across multiple services.
3. **Child loggers**: `req.log.child({ userId })` creates a new logger that inherits all parent fields and adds the given context. Every subsequent log in that request automatically includes userId without repeating it.
4. **Log levels**: use `trace`/`debug` for development only (`LOG_LEVEL=debug`), `info` for normal business events, `warn` for recoverable issues, `error` for exceptions that need investigation. CloudWatch pricing is by GB ingested so avoid verbose debug logs in production.
5. **Redaction**: never log Authorization headers, passwords, or PII. pino's `redact` option removes fields before serialization — the safest approach.
6. **CloudWatch Logs Agent / FireLens**: in ECS, stdout goes to the container log driver. Use `awslogs` driver (simplest) or FireLens with Fluent Bit (for routing to multiple destinations, filtering, enrichment).
7. **Metric Filters**: create a filter pattern like `{ $.level = "error" }` on a log group. CloudWatch turns matching lines into a numeric metric. Wire that metric to an alarm that pages your team.
8. **CloudWatch Insights**: query language like SQL. `stats avg(responseTime) by route` gives you P50 latency per endpoint without exporting to another system.

### Complexity

| Aspect | Detail |
|--------|--------|
| Logger library | pino (fastest), winston (most flexible) |
| Throughput | pino: ~100k logs/sec; winston: ~10k logs/sec |
| CW Insights query cost | $0.005 per GB scanned |
| CW Logs ingestion cost | $0.50 per GB |
| Redaction overhead | Negligible with pino path-based redact |
| Cold start impact (Lambda) | Pino adds ~5ms cold start vs ~30ms for winston |

---

## Q110: What does AWS X-Ray trace, and how do you use it to debug distributed systems?

### ELI5

Imagine a pizza delivery app. You order on the website, the kitchen app picks it up, the driver app gets notified. If your pizza arrives cold, how do you know which step was slow? AWS X-Ray is like attaching a GPS tracker to your order — you can see exactly how long each kitchen step, each handoff, each driver detour took, all stitched together into one timeline.

### Visual Diagram

```
Incoming Request
      |
      v
[API Gateway]  -- trace header X-Amzn-Trace-Id -->
      |
      v
[Lambda: order-handler]
  Segment: order-handler
    |
    +-- Subsegment: DynamoDB.GetItem       (5ms)
    |
    +-- Subsegment: HTTP call -> inventory (120ms) <-- slow!
    |       |
    |       v
    |   [Lambda: inventory-service]
    |     Segment: inventory-service
    |       +-- Subsegment: RDS query     (115ms) <-- root cause
    |
    +-- Subsegment: SQS.SendMessage       (8ms)

Total trace: 148ms
X-Ray Service Map shows the full call graph visually
```

### Code Example

```javascript
// npm install aws-xray-sdk-core aws-xray-sdk-express

const AWSXRay = require('aws-xray-sdk-core');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));  // auto-trace all AWS SDK calls
const express = require('express');
const app = express();

// 1. Middleware: open + close a segment for every HTTP request
app.use(AWSXRay.express.openSegment('order-api'));  // segment name

// 2. Custom subsegment — trace a block of your own code
app.post('/order', async (req, res) => {
  // AWSXRay.captureAWS already traces DynamoDB, S3, SQS, etc. automatically
  // For your own logic (HTTP calls, DB queries via knex), add manual subsegments:

  const segment = AWSXRay.resolveSegment();  // get current segment

  const dbResult = await AWSXRay.captureAsyncFunc('fetchInventory', async (subseg) => {
    try {
      const result = await db.query('SELECT stock FROM inventory WHERE sku = ?', [req.body.sku]);
      subseg.addAnnotation('sku', req.body.sku);        // searchable indexed key
      subseg.addMetadata('result', result);             // non-indexed debug data
      return result;
    } catch (err) {
      subseg.addError(err);     // marks subsegment as faulted
      throw err;
    } finally {
      subseg.close();           // MUST close or trace hangs
    }
  });

  // 3. Capture outgoing HTTP call
  const https = AWSXRay.captureHTTPs(require('https'));  // wraps https module
  // Every https.request() is now auto-traced as a subsegment

  res.json({ orderId: 'abc' });
});

app.use(AWSXRay.express.closeSegment());   // must be last middleware

// 4. Lambda: X-Ray is enabled via function config (TracingConfig: Active)
//    The Lambda service creates the root segment automatically
//    You only need to add subsegments for your own code:
exports.handler = async (event) => {
  return await AWSXRay.captureAsyncFunc('processEvent', async (subseg) => {
    subseg.addAnnotation('eventType', event.source);
    const result = await doWork(event);
    subseg.close();
    return result;
  });
};

// 5. Propagate trace header in outgoing HTTP calls (manual, without SDK wrapper)
// X-Amzn-Trace-Id: Root=1-abc123;Parent=def456;Sampled=1
const traceHeader = AWSXRay.resolveSegment()?.trace_id;
axios.get('http://other-service/api', {
  headers: { 'X-Amzn-Trace-Id': traceHeader },
});
```

### Step-by-Step Explanation

1. **Trace**: a single end-to-end request journey across all services. X-Ray assembles it from segments and subsegments using a shared trace ID.
2. **Segment**: one service's contribution to a trace (e.g., the Lambda function or ECS container). Created automatically for Lambda and API Gateway when tracing is enabled.
3. **Subsegment**: a unit of work within a segment — an AWS SDK call, a database query, an outgoing HTTP request. `captureAWS()` creates these automatically for all AWS SDK v2 calls.
4. **Annotations**: indexed key-value pairs you can filter in the X-Ray console. Use them for things you want to search: `userId`, `orderId`, `errorCode`. Low cardinality fields only.
5. **Metadata**: arbitrary non-indexed data (e.g., full request body). Can store large objects. Not searchable but visible in the trace detail.
6. **Service Map**: X-Ray builds a visual graph of all services, showing call direction, latency, and error rate on each edge. You can immediately see which service is slow or erroring.
7. **Sampling**: by default X-Ray traces 5% of requests (reservoir + fixed rate). For production debugging, you can increase sampling for specific routes using sampling rules. Full tracing at high volume is expensive.
8. **X-Ray vs CloudWatch**: X-Ray = distributed tracing (spans, call graphs, latency waterfall). CloudWatch = metrics and logs. Use both together: a CloudWatch alarm triggers, you drill into X-Ray to find which downstream call caused the latency spike.

### Complexity

| Feature | Detail |
|---------|--------|
| Auto-instrumentation | captureAWS() covers all AWS SDK v2 calls |
| Manual subsegments | captureAsyncFunc() wraps any async operation |
| Trace storage cost | $5 per million traces recorded |
| Default sampling rate | 5% of requests (1 req/s reservoir + 5% of remainder) |
| Latency overhead | ~1ms per subsegment creation |
| Integration | API Gateway, Lambda, ECS, EC2, App Mesh |

---

## Q111: How do GitHub Actions environments with protection rules work?

### ELI5

Think of environments as gates in a theme park. The "staging" gate anyone can walk through. The "production" gate has a security guard (required reviewer) who checks your ticket, and you can only enter between 9am–5pm (deployment window). GitHub Actions environments enforce these gates automatically before any job can deploy to that environment.

### Visual Diagram

```
Workflow: deploy.yml
      |
      v
[Job: deploy-staging]
  environment: staging       <-- no protection rules
      |
      v
  (deploy to staging automatically)
      |
      v
[Job: deploy-production]
  environment: production    <-- PROTECTED
      |
      v
  +------ Protection checks ------+
  | Required reviewers: @alice    |
  | Wait timer: 5 minutes         |
  | Allowed branches: main only   |
  +-------------------------------+
      |  (Alice approves in GitHub UI)
      v
  (deploy to production)
      |
      v
[Deployment recorded in GitHub]
  Status: success / failure
  URL: https://prod.example.com
```

### Code Example

```yaml
# .github/workflows/deploy.yml

name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test

  deploy-staging:
    needs: test                    # only runs if test passes
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.example.com   # shown in GitHub deployments tab
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to staging
        run: ./scripts/deploy.sh staging
        env:
          DEPLOY_KEY: ${{ secrets.STAGING_DEPLOY_KEY }}   # env-scoped secret

  deploy-production:
    needs: deploy-staging          # only runs if staging deploy passes
    runs-on: ubuntu-latest
    environment:
      name: production             # triggers protection rules:
                                   # - required reviewers check
                                   # - wait timer (if configured)
                                   # - branch policy (main only)
      url: https://example.com
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to production
        run: ./scripts/deploy.sh production
        env:
          DEPLOY_KEY: ${{ secrets.PROD_DEPLOY_KEY }}      # different secret scoped to production env

  # Protection rules are configured in GitHub repo Settings > Environments:
  # production:
  #   Required reviewers: ['alice', 'bob']  (at least 1 must approve)
  #   Wait timer: 5 minutes after approval
  #   Deployment branches: Selected branches -> main
  #   Prevent self-review: true (deployer cannot be their own reviewer)
```

```javascript
// Checking deployment status via GitHub API (Node.js)
const { Octokit } = require('@octokit/rest');
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function getDeploymentStatus(owner, repo, environment) {
  const { data: deployments } = await octokit.repos.listDeployments({
    owner,
    repo,
    environment,
    per_page: 1,
  });

  if (!deployments.length) return null;

  const { data: statuses } = await octokit.repos.listDeploymentStatuses({
    owner,
    repo,
    deployment_id: deployments[0].id,
    per_page: 1,
  });

  return { deployment: deployments[0], status: statuses[0]?.state };
  // state: 'success' | 'failure' | 'error' | 'pending' | 'in_progress'
}
```

### Step-by-Step Explanation

1. **Environment definition**: create environments under repo Settings > Environments. Each environment is a named target (staging, production, canary) with its own set of secrets and protection rules.
2. **Required reviewers**: up to 6 people or teams must approve the deployment before the job proceeds. The workflow pauses at the environment gate until approval arrives. Approvers are notified by GitHub.
3. **Wait timer**: even after approval, the job waits N minutes before starting. Useful for change freeze windows or to allow cancel notifications to reach on-call teams.
4. **Deployment branches**: restrict which branches can deploy to this environment. Setting "main only" prevents feature branches from deploying to production.
5. **Environment-scoped secrets**: `secrets.PROD_DEPLOY_KEY` is only accessible in jobs that reference the `production` environment. A compromised staging pipeline cannot read production secrets.
6. **Deployment history**: every run that uses an `environment:` key creates a deployment record in GitHub. You can see which SHA is live in each environment, when it deployed, and who approved it.
7. **Manual approval flow**: reviewer gets email + GitHub notification. They see the diff, can add comments, and approve or reject. Rejection terminates the workflow.
8. **Environment URL**: the `url:` field appears as a clickable link in the GitHub deployments dashboard and in PR checks — easy one-click access to the deployed environment.

### Complexity

| Feature | Detail |
|---------|--------|
| Max required reviewers | 6 people or teams |
| Wait timer range | 0–43,200 minutes (30 days) |
| Secret isolation | Env secrets accessible only in jobs referencing that env |
| Audit trail | Full deployment history with approver names and timestamps |
| Branch restriction | Wildcards supported (e.g., release/*) |
| Self-review prevention | Configurable — prevents deployer from approving own deploy |

---

## Q112: How do you handle secrets in a GitHub Actions CI/CD pipeline securely?

### ELI5

Secrets are like passwords taped to your office door — if they show up in logs or code, anyone can steal them. GitHub Actions lets you store secrets in a locked vault (encrypted at rest). Your workflow reads them as environment variables, and GitHub automatically masks them in logs so they never appear in plain text.

### Visual Diagram

```
Developer / Admin
      |
      | (one-time setup)
      v
GitHub repo Settings > Secrets & Variables
  [PROD_DB_URL]       = postgres://...  (encrypted)
  [AWS_ACCESS_KEY_ID] = AKIA...         (encrypted)
  [DOCKER_PASSWORD]   = secret123       (encrypted)
      |
      | (injected at runtime, never visible in logs)
      v
[GitHub Actions Runner]   (isolated sandbox)
  env:
    PROD_DB_URL:       ${{ secrets.PROD_DB_URL }}      --> masked in logs: ***
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }} --> masked in logs: ***
      |
      v
[Your deploy script]   reads process.env.PROD_DB_URL
      |
      v
[Deployed app]   -- secret never leaves the runner --
```

### Code Example

```yaml
# .github/workflows/ci-cd.yml

name: CI/CD

on:
  push:
    branches: [main]

env:
  # Repository-level secrets (available to all jobs)
  REGISTRY: ghcr.io

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write    # needed to push to GHCR
    steps:
      - uses: actions/checkout@v4

      # Use OIDC (recommended) instead of long-lived AWS keys
      - name: Configure AWS credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/github-actions-role
          aws-region: us-east-1
          # No AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY needed!
          # GitHub exchanges a short-lived OIDC token for temporary AWS creds

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}   # auto-provided by GitHub, no setup

      - name: Build and push Docker image
        run: |
          docker build -t ghcr.io/${{ github.repository }}:${{ github.sha }} .
          docker push  ghcr.io/${{ github.repository }}:${{ github.sha }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: production    # env-scoped secrets only accessible here
    steps:
      - name: Deploy
        run: ./scripts/deploy.sh
        env:
          # environment-scoped secret — NOT accessible from other jobs
          DB_URL:        ${{ secrets.PROD_DB_URL }}
          STRIPE_KEY:    ${{ secrets.PROD_STRIPE_SECRET_KEY }}

      # NEVER do this — prints secret in logs:
      # - run: echo ${{ secrets.PROD_DB_URL }}   # BAD
      # - run: echo "$DB_URL"                    # ALSO BAD (shows masked ***)
      # Masking only works if the secret value > 3 chars and is not split across lines
```

```javascript
// Validating secrets are present at startup (Node.js app)
// Fail fast if required env vars are missing — never silently use undefined
const REQUIRED_SECRETS = ['DB_URL', 'STRIPE_SECRET_KEY', 'JWT_SECRET'];

for (const key of REQUIRED_SECRETS) {
  if (!process.env[key]) {
    // Log the MISSING KEY NAME, never the value
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}
```

### Step-by-Step Explanation

1. **GitHub encrypted secrets**: stored encrypted using libsodium sealed boxes. Only decrypted during job execution on the runner. GitHub employees cannot read them.
2. **Automatic masking**: GitHub scans every log line and replaces any occurrence of a secret value with `***`. Works even if the secret appears in error messages or stack traces.
3. **Secret scoping levels**: repository secrets (all workflows), environment secrets (only jobs referencing that environment), organization secrets (all repos in org, with repo access policy). Use the narrowest scope possible.
4. **OIDC (OpenID Connect)**: the gold standard for AWS integration. No long-lived AWS keys stored anywhere. GitHub generates a short-lived JWT, AWS IAM verifies it, and issues temporary credentials valid for ~1 hour. If keys are leaked, they expire automatically.
5. **GITHUB_TOKEN**: GitHub auto-creates this token for every workflow run. Use it for authenticating against the GitHub API, pushing packages to GHCR, creating releases — no manual setup needed.
6. **Secrets in pull requests**: repository secrets are **not** passed to workflows triggered by pull requests from forks (to prevent secret theft via malicious PRs). Use environments with protection rules for trusted contributors.
7. **Rotation**: secrets should be rotated regularly. GitHub has no built-in expiry — integrate with AWS Secrets Manager or HashiCorp Vault for automatic rotation, then sync to GitHub via their API.
8. **What NOT to do**: never print secrets in `run:` steps, never commit `.env` files, never use secrets as branch names or in URLs where they appear in logs.

### Complexity

| Practice | Risk Level | Recommendation |
|----------|-----------|----------------|
| Long-lived AWS keys in secrets | Medium | Replace with OIDC |
| Repo-level secrets | Low-Medium | Use env-scoped when possible |
| GITHUB_TOKEN for GHCR | Low | Built-in, use freely |
| OIDC for AWS | Very Low | Preferred approach |
| Printing secrets in logs | Critical | Never do this |
| Secrets in public fork PRs | High | Blocked by GitHub automatically |

---

## Q113: Why does a multi-stage Docker build reduce image size, and how do you write one?

### ELI5

Imagine building a house. Construction needs a full toolbox — hammers, saws, drills. But once the house is built, the homeowners don't keep the toolbox inside. Multi-stage Docker builds keep the "toolbox" (compiler, dev dependencies, build tools) in a temporary build stage. The final stage only contains the finished house (the compiled binary and runtime dependencies). No toolbox included — smaller, faster, safer.

### Visual Diagram

```
Stage 1: builder
+------------------------------+
| FROM node:20                 |  full Node.js image (~1.1 GB)
| COPY package*.json .         |
| RUN npm ci                   |  dev + prod deps (~300 MB)
| COPY . .                     |
| RUN npm run build            |  TypeScript -> dist/
|                              |
| Result: ~1.4 GB image        |  <-- NEVER shipped to production
+------------------------------+
            |
            | COPY --from=builder dist/ and node_modules (prod only)
            v
Stage 2: production
+------------------------------+
| FROM node:20-alpine          |  slim Alpine image (~170 MB)
| COPY --from=builder dist/ .  |  compiled JS only
| RUN npm ci --only=production |  prod deps only (~50 MB)
| CMD ["node", "dist/server"]  |
|                              |
| Result: ~220 MB image        |  <-- what you ship
+------------------------------+

Size saved: ~1.2 GB (85% reduction)
```

### Code Example

```dockerfile
# Dockerfile

# =====================
# Stage 1: Build
# =====================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (layer caching — only reinstall when these change)
COPY package.json package-lock.json ./

# Install ALL dependencies including devDependencies (TypeScript, etc.)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to JavaScript
RUN npm run build      # outputs to /app/dist/

# =====================
# Stage 2: Production
# =====================
FROM node:20-alpine AS production

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only the compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Copy package files to install prod-only deps
COPY package.json package-lock.json ./

# Install production dependencies only (no TypeScript, no jest, etc.)
RUN npm ci --omit=dev --ignore-scripts \
  && npm cache clean --force   # removes npm cache from layer

# Copy any static assets or config if needed
COPY --from=builder /app/src/config ./config

# Set secure, minimal environment
ENV NODE_ENV=production \
    PORT=3000

USER appuser    # switch to non-root

EXPOSE 3000

# Use exec form (avoids shell wrapper, passes signals correctly)
CMD ["node", "dist/server.js"]
```

```yaml
# .github/workflows/docker-build.yml
# Build the image efficiently in CI

- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Build and push (with cache)
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: ghcr.io/org/app:${{ github.sha }}
    cache-from: type=gha          # GitHub Actions cache
    cache-to:   type=gha,mode=max # persist layer cache between runs
    # cache-from means Docker reuses unchanged layers from last build
    # Benefit: npm ci layer cached unless package-lock.json changes
```

### Step-by-Step Explanation

1. **Stage isolation**: Docker executes each `FROM` statement as a separate, throwaway filesystem. Anything built in Stage 1 exists only in that stage's layers unless explicitly `COPY --from`'d into later stages.
2. **What gets excluded**: devDependencies (TypeScript, Jest, ESLint, ts-node), build caches, source map files (if omitted), temporary build artifacts, `.git` directory, test files.
3. **Alpine base image**: `node:20-alpine` uses musl libc and is ~5x smaller than `node:20` (Debian). Use it for production. Use `node:20` for the build stage if devDependencies have native module compilation issues.
4. **Layer caching**: `COPY package*.json ./` then `RUN npm ci` before `COPY src/` means the expensive npm install layer is cached as long as `package-lock.json` hasn't changed — even if source code changes.
5. **Non-root user**: running as `root` inside a container means a container escape bug gives full host access. RUN `adduser` and `USER appuser` removes this attack surface.
6. **`npm ci --omit=dev`**: installs only `dependencies` from `package.json`, skipping `devDependencies`. Avoids shipping TypeScript compiler, test runners, and linters to production.
7. **Signal handling**: `CMD ["node", "dist/server.js"]` (exec form) means Node.js receives SIGTERM directly, enabling graceful shutdown. `CMD node dist/server.js` (shell form) creates a sh wrapper that swallows signals.
8. **BuildKit cache mounts**: for even faster builds, use `RUN --mount=type=cache,target=/root/.npm npm ci` to cache the npm download cache between builds without adding it to image layers.

### Complexity

| Factor | Single Stage | Multi-Stage |
|--------|-------------|------------|
| Image size (typical Node.js) | ~1.4 GB | ~200-300 MB |
| Build time (cached) | ~60s | ~15s (node_modules layer cached) |
| Security surface | All devDeps included | Production deps only |
| Attack surface | Large (compilers, build tools) | Minimal |
| Complexity | Simple Dockerfile | Slightly more complex |

---

## Q114: How do you implement automatic rollback after a failed deployment?

### ELI5

You push new code. It's broken. Without auto-rollback, your site stays broken until someone notices and manually reverts. Auto-rollback is like a smoke detector that automatically reopens the old door when it smells fire in the new room. The system detects that the new deployment is unhealthy and switches back to the last known good version without human intervention.

### Visual Diagram

```
Deploy new version v2
        |
        v
[Health Check / Smoke Tests]
        |
   +----+----+
   |         |
PASS        FAIL
   |         |
   v         v
Keep v2    Trigger Rollback
live         |
             v
      [Rollback to v1]
             |
             v
      [Alert on-call team]
             |
             v
      v1 serving traffic again
      (RTO < 2 minutes)

Signals that trigger rollback:
  - Health check returns non-200 for N consecutive checks
  - Error rate > threshold (CloudWatch Alarm)
  - Deployment smoke tests fail
  - CodeDeploy lifecycle hook exits non-zero
```

### Code Example

```yaml
# .github/workflows/deploy-with-rollback.yml

name: Deploy with Auto-Rollback

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1

      # Store current task definition before deploying (for rollback)
      - name: Get current ECS task definition (rollback target)
        id: current-task
        run: |
          CURRENT=$(aws ecs describe-services \
            --cluster my-cluster \
            --services my-service \
            --query 'services[0].taskDefinition' \
            --output text)
          echo "task_def=$CURRENT" >> $GITHUB_OUTPUT

      # Deploy new version
      - name: Deploy new ECS task definition
        id: deploy
        run: |
          # Register new task definition with updated image
          NEW_TASK=$(aws ecs register-task-definition \
            --cli-input-json file://task-definition.json \
            --query 'taskDefinition.taskDefinitionArn' \
            --output text)
          
          # Update ECS service to use new task definition
          aws ecs update-service \
            --cluster my-cluster \
            --service my-service \
            --task-definition $NEW_TASK \
            --force-new-deployment
          
          echo "new_task=$NEW_TASK" >> $GITHUB_OUTPUT

      # Wait for deployment to stabilize (or fail)
      - name: Wait for deployment
        id: wait
        run: |
          aws ecs wait services-stable \
            --cluster my-cluster \
            --services my-service \
            --cli-connect-timeout 300
          echo "stable=true" >> $GITHUB_OUTPUT
        continue-on-error: true   # don't fail the step, handle it below

      # Run smoke tests against the new deployment
      - name: Run smoke tests
        id: smoke
        if: steps.wait.outputs.stable == 'true'
        run: |
          RESPONSE=$(curl -sf -o /dev/null -w "%{http_code}" https://api.example.com/health)
          if [ "$RESPONSE" != "200" ]; then
            echo "Smoke test failed: HTTP $RESPONSE" >&2
            exit 1
          fi
        continue-on-error: true

      # Rollback if deployment failed OR smoke tests failed
      - name: Rollback on failure
        if: steps.wait.outputs.stable != 'true' || failure()
        run: |
          echo "Deployment failed — rolling back to ${{ steps.current-task.outputs.task_def }}"
          aws ecs update-service \
            --cluster my-cluster \
            --service my-service \
            --task-definition ${{ steps.current-task.outputs.task_def }}
          
          # Alert the team
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-type: application/json' \
            -d '{"text":"ROLLBACK: Production deployment failed. Reverted to previous version."}'
          
          exit 1   # mark the workflow as failed

      - name: Notify success
        if: success()
        run: echo "Deployment successful — v2 is live"
```

```javascript
// Node.js health check endpoint (what the smoke test hits)
// Returns 200 only when all critical dependencies are healthy
app.get('/health', async (req, res) => {
  const checks = await Promise.allSettled([
    db.raw('SELECT 1'),                        // database connectivity
    redis.ping(),                              // cache connectivity
    fetch('https://stripe.com/v1').then(r => r.ok),  // external dependency
  ]);

  const allHealthy = checks.every(c => c.status === 'fulfilled');

  if (allHealthy) {
    res.status(200).json({ status: 'ok', version: process.env.APP_VERSION });
  } else {
    const failures = checks
      .map((c, i) => c.status === 'rejected' ? ['db', 'redis', 'stripe'][i] : null)
      .filter(Boolean);
    res.status(503).json({ status: 'degraded', failures });
  }
});
```

### Step-by-Step Explanation

1. **Capture rollback target first**: before deploying, record the current task definition ARN. If the deploy fails, you have a known-good reference to restore to immediately.
2. **`aws ecs wait services-stable`**: polls the ECS service every 15 seconds until all tasks are running (or 10-minute timeout). If new tasks fail their health checks and ECS reverts them, `wait` exits non-zero.
3. **`continue-on-error: true`**: lets the step "fail" without killing the job. The next step checks the output and decides whether to rollback. This is how you branch on failure in GitHub Actions.
4. **Smoke tests**: even if ECS reports stable, run a real HTTP health check. A task can be "healthy" at the load-balancer level but return errors on business-critical routes.
5. **Rollback mechanism**: re-run `update-service` pointing at the previous task definition. ECS drains the new tasks and starts the old version. No new build needed.
6. **CodeDeploy alternative**: if using CodeDeploy with `DeploymentConfig.ECSCanary`, set `AutoRollbackConfiguration.Events: [DEPLOYMENT_FAILURE, DEPLOYMENT_STOP_ON_ALARM]` — CodeDeploy handles rollback automatically including weighted target group cleanup.
7. **CloudWatch Alarm rollback**: create an alarm on error rates (e.g., 5xx > 1% for 5 minutes). Wire the alarm to an SNS topic that triggers a Lambda, which calls `update-service` to roll back.
8. **Notification**: alert the on-call team immediately — rollbacks are production incidents. Include the commit SHA, PR link, and which check failed.

### Complexity

| Rollback Method | Trigger | Speed | Automation Level |
|----------------|---------|-------|-----------------|
| ECS update-service (previous ARN) | Manual or scripted | 1-3 min | High (in workflow) |
| CodeDeploy auto-rollback | Alarm or hook failure | 1-2 min | Full (CodeDeploy managed) |
| Blue/Green LB switch | Health check failure | Seconds | Full (ALB) |
| Kubernetes rollout undo | Readiness probe failure | 30-60 sec | Full (k8s controller) |

---

## Q115: What is the difference between `needs` and `if` in GitHub Actions jobs?

### ELI5

`needs` is about **order**: "Job B can only *start* after Job A finishes." `if` is about **decision**: "Job B *should run at all* only when this condition is true." You can use `needs` to sequence jobs in a pipeline, and `if` to skip jobs entirely based on branch names, previous job results, or event types.

### Visual Diagram

```
`needs` — controls execution ORDER
=======================================

  [test]
     |
     | (needs: test)
     v
  [build]
     |
     +------> [deploy-staging]   (needs: build)
                    |
                    | (needs: deploy-staging)
                    v
              [deploy-prod]      (needs: deploy-staging)

All jobs in parallel unless `needs` creates a dependency edge.

-----------------------------------------------

`if` — controls WHETHER a job runs
=======================================

  [build]
     |
     +------> [deploy-staging]
     |          if: github.ref == 'refs/heads/main'
     |
     +------> [deploy-prod]
                if: startsWith(github.ref, 'refs/tags/v')
                   AND needs.build.result == 'success'

Push to main   -> deploy-staging runs, deploy-prod SKIPPED
Push tag v1.2  -> deploy-prod runs, deploy-staging SKIPPED
Push PR branch -> both SKIPPED
```

### Code Example

```yaml
# .github/workflows/pipeline.yml

name: Full Pipeline

on: [push, pull_request]

jobs:
  # 1. Always runs (no needs, no if)
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test

  # 2. `needs` only — runs after test, on ALL branches
  build:
    needs: test                           # waits for test to complete
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run build

  # 3. `needs` + `if` — runs after build, only on main branch
  deploy-staging:
    needs: build                          # must wait for build
    if: github.ref == 'refs/heads/main'   # only when push is to main
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: echo "Deploying to staging"

  # 4. Multiple needs + complex if
  deploy-prod:
    needs: [build, deploy-staging]        # waits for BOTH build AND deploy-staging
    # `if` with `needs.*.result` — run even if deploy-staging was skipped
    if: |
      github.ref == 'refs/heads/main' &&
      needs.build.result == 'success' &&
      (needs.deploy-staging.result == 'success' || needs.deploy-staging.result == 'skipped')
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: echo "Deploying to production"

  # 5. `needs` with always() — run cleanup even when previous jobs failed
  notify:
    needs: [test, build, deploy-staging, deploy-prod]
    if: always()                          # runs regardless of other jobs' results
    runs-on: ubuntu-latest
    steps:
      - name: Send Slack notification
        run: |
          # Check outcomes of all needed jobs
          if [[ "${{ needs.deploy-prod.result }}" == "success" ]]; then
            MSG="Deployment succeeded"
          else
            MSG="Pipeline failed: test=${{ needs.test.result }} build=${{ needs.build.result }}"
          fi
          echo "$MSG"

  # 6. Conditional matrix — skip expensive job on draft PRs
  integration-tests:
    needs: build
    if: |
      github.event_name == 'push' ||
      (github.event_name == 'pull_request' && !github.event.pull_request.draft)
    strategy:
      matrix:
        node: [18, 20, 22]
    runs-on: ubuntu-latest
    steps:
      - run: node --version
```

### Step-by-Step Explanation

1. **`needs` creates a DAG**: GitHub Actions jobs run in parallel by default. `needs: [jobA, jobB]` creates a directed acyclic graph edge meaning "wait for A and B before starting this job."
2. **`needs` failure propagation**: if a job in `needs` fails, the dependent job is skipped (not failed) unless you override with `if: always()` or `if: failure()`.
3. **`if` evaluates expressions**: uses GitHub Actions expression syntax (`${{ }}` context). Available contexts: `github` (event data), `env`, `vars`, `secrets`, `needs` (results of dependency jobs), `matrix`.
4. **`needs.jobName.result`**: possible values are `success`, `failure`, `cancelled`, `skipped`. Use these in `if` conditions to build conditional pipelines.
5. **`always()`**: special function that short-circuits the default "skip if dependency failed" behavior. Use it for notification jobs that must run regardless of pipeline outcome.
6. **`failure()`**: runs the job only if at least one depended-on job failed. Use for emergency rollback or incident notification steps.
7. **Branch/tag checks**: `github.ref == 'refs/heads/main'` for branch. `startsWith(github.ref, 'refs/tags/')` for any tag. `github.event_name == 'pull_request'` for PRs only.
8. **Skipped vs failed**: a job that does not meet its `if` condition is **skipped** — it appears greyed out in the UI and does not cause dependent jobs to fail (unless you explicitly check `needs.job.result != 'skipped'`).

### Complexity

| Feature | `needs` | `if` |
|---------|---------|------|
| Purpose | Execution order / dependency | Conditional execution |
| Default behavior without it | All jobs run in parallel | Job always runs |
| Can reference | Job names | GitHub context, needs results, env vars |
| Multiple values | Array: `needs: [a, b, c]` | Boolean expression |
| Failure handling | Skips dependents if dep fails | `failure()` / `always()` functions |
| Typical use | Build pipeline DAG | Branch-specific or event-specific gates |

--- End of Section 12 ---

---

# Section 13: SQL vs NoSQL

## Q116: What are the ACID properties? Give a real example for each.

### ELI5

ACID is the guarantee your bank gives you when you transfer money. **Atomicity**: the transfer either fully happens or fully doesn't — you never lose money into thin air. **Consistency**: the bank's rules (no negative balance) always hold before and after. **Isolation**: two transfers happening at the same time don't interfere with each other — they act as if they took turns. **Durability**: once the transfer is confirmed, even a power cut can't erase it.

### Visual Diagram

```
Bank transfer: Alice sends $100 to Bob

ATOMICITY
---------
  BEGIN TRANSACTION
    UPDATE accounts SET balance = balance - 100 WHERE user = 'Alice'   -- step 1
    UPDATE accounts SET balance = balance + 100 WHERE user = 'Bob'     -- step 2
  COMMIT
  If step 2 crashes --> ROLLBACK both steps (Alice keeps her $100)
  Result: ALL or NOTHING

CONSISTENCY
-----------
  Rule: balance >= 0
  Alice has $50, tries to send $100
  Transaction violates constraint --> ABORTED
  DB never moves to invalid state

ISOLATION
---------
  T1: reads Alice balance = $500 (before deduct)
  T2: reads Alice balance = $500 (concurrent read)
  T1 commits: balance = $400
  T2 commits: balance = $400   <-- WRONG without isolation!
  With SERIALIZABLE isolation: T2 sees T1's write, calculates $300

DURABILITY
----------
  COMMIT acknowledged --> written to WAL (Write-Ahead Log) on disk
  Power cut 1ms after COMMIT --> DB replays WAL on restart
  Transaction survives crash
```

### Code Example

```javascript
// Node.js + pg (PostgreSQL) — all 4 ACID properties in one transaction

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DB_URL });

async function transferMoney(fromId, toId, amount) {
  const client = await pool.connect();  // get dedicated connection for transaction

  try {
    await client.query('BEGIN');   // start transaction (ISOLATION starts here)

    // CONSISTENCY check: read current balance with row lock
    const { rows } = await client.query(
      'SELECT balance FROM accounts WHERE id = $1 FOR UPDATE',  // lock the row
      [fromId]
    );
    const current = rows[0].balance;

    if (current < amount) {
      throw new Error('Insufficient funds');  // CONSISTENCY: reject invalid state
    }

    // ATOMICITY: both writes happen inside the same transaction
    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [amount, fromId]
    );
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [amount, toId]
    );

    // Simulate a crash mid-transaction:
    // if (Math.random() < 0.5) throw new Error('crash');
    // --> ROLLBACK would fire, neither UPDATE persists (ATOMICITY)

    await client.query('COMMIT');  // DURABILITY: written to WAL, survives crash
    return { success: true };

  } catch (err) {
    await client.query('ROLLBACK');  // ATOMICITY: undo all changes
    throw err;
  } finally {
    client.release();  // return connection to pool
  }
}

// ISOLATION level example
async function setIsolationLevel(client) {
  // READ COMMITTED (default in PostgreSQL): each statement sees committed rows
  // REPEATABLE READ: rows read in transaction don't change mid-transaction
  // SERIALIZABLE: full isolation, transactions act as if they ran one-by-one
  await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
}
```

### Step-by-Step Explanation

1. **Atomicity — all or nothing**: a transaction is a single unit of work. If any statement inside it fails, the entire transaction is rolled back. PostgreSQL uses an undo log (MVCC) to revert partial changes. Real example: charging a card AND creating an order must both succeed or both fail.
2. **Consistency — rules always hold**: the database enforces constraints (NOT NULL, UNIQUE, CHECK, FOREIGN KEY) at transaction commit time. No transaction can leave the database in a state that violates defined rules. Real example: `balance >= 0` constraint rejects overdrafts.
3. **Isolation — concurrent transactions don't interfere**: isolation levels control visibility of in-progress writes. `FOR UPDATE` lock prevents two concurrent transfers from both reading the same balance and applying separate debits. Real example: two simultaneous ticket purchases can't both get the last seat.
4. **Durability — committed data survives crashes**: PostgreSQL writes transactions to a Write-Ahead Log (WAL) on disk before acknowledging COMMIT. On crash, it replays the WAL to restore committed state. Real example: confirmed payment is never lost even if the server reboots 1ms after acknowledgement.
5. **MVCC (Multi-Version Concurrency Control)**: PostgreSQL implements isolation without locking reads — each transaction sees a snapshot of the DB at its start time. Readers don't block writers; writers don't block readers.
6. **Trade-offs**: strict ACID (especially SERIALIZABLE) reduces throughput because of locking overhead. Many apps use READ COMMITTED (weaker isolation, higher throughput) and handle edge cases in application code.

### Complexity

| Property | Mechanism in PostgreSQL | Real failure if missing |
|----------|------------------------|------------------------|
| Atomicity | Rollback / undo log (MVCC) | Partial money transfer (funds disappear) |
| Consistency | Constraints checked at COMMIT | Negative bank balance allowed |
| Isolation | MVCC + row-level locks | Double booking, lost updates |
| Durability | WAL (Write-Ahead Log) on disk | Committed payment lost on crash |

---

## Q117: When would you choose PostgreSQL over MongoDB for a new project?

### ELI5

MongoDB is a big box of drawers — each drawer can hold anything in any shape. PostgreSQL is a binder with strict columns and tabs. The box is great when you don't know what shape your stuff will be. The binder is great when your stuff is interconnected, needs rules, and must never get messy. Choose the binder (PostgreSQL) when data integrity, complex queries, or relationships matter; choose the box (MongoDB) when schema flexibility or horizontal write scale is the top priority.

### Visual Diagram

```
PostgreSQL                         MongoDB
==========                         =======
Tables + rows                      Collections + documents
Strict schema (DDL)                Flexible schema (schemaless)
JOINs across tables                Embed related data in documents
ACID transactions                  Multi-doc transactions (since 4.0)
Foreign keys / constraints         No FK enforcement
B-tree / GiST / GIN indexes        B-tree / compound / text indexes
Vertical scale (read replicas)     Horizontal shard scale
Best for: financial, ERP,          Best for: catalogs, CMS,
  user profiles, analytics           real-time feeds, IoT

Decision Tree:
  Need complex JOINs?              --> PostgreSQL
  Data shape changes constantly?   --> MongoDB
  Strict referential integrity?    --> PostgreSQL
  High write throughput at scale?  --> MongoDB (sharding)
  Full-text search primary?        --> Either + Elasticsearch
  ACID across multiple collections?  --> PostgreSQL (easier)
```

### Code Example

```javascript
// Example: e-commerce product catalog
// MongoDB fits because:
//   - Products have wildly different fields (shoes: size/color; TVs: resolution/HDR)
//   - Schema evolves as categories are added
//   - No cross-document joins needed

// MongoDB document (flexible):
const shoeDoc = {
  _id: ObjectId('...'),
  name: 'Air Runner',
  category: 'shoes',
  attributes: { sizes: [8, 9, 10], color: 'red', material: 'mesh' },
  price: 120,
  stock: 50,
};

const tvDoc = {
  _id: ObjectId('...'),
  name: '65" OLED',
  category: 'electronics',
  attributes: { resolution: '4K', HDR: true, refreshRate: 120 },
  price: 1200,
};

// -------------------------------------------------------
// Example: financial ledger
// PostgreSQL fits because:
//   - Every transaction links accounts, users, categories
//   - Must never allow negative balances (CHECK constraint)
//   - Auditors need SQL reports with GROUP BY, window functions
//   - JOINs across accounts, transactions, users are daily queries

// PostgreSQL schema:
/*
CREATE TABLE accounts (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id),
  balance     NUMERIC(12,2) NOT NULL CHECK (balance >= 0),
  currency    CHAR(3) NOT NULL DEFAULT 'USD'
);

CREATE TABLE transactions (
  id          BIGSERIAL PRIMARY KEY,
  from_acct   INT REFERENCES accounts(id),
  to_acct     INT REFERENCES accounts(id),
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reporting query impossible in MongoDB without $lookup (slow):
SELECT u.name, SUM(t.amount) AS total_sent
FROM transactions t
JOIN accounts a ON t.from_acct = a.id
JOIN users u ON a.user_id = u.id
WHERE t.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.name
ORDER BY total_sent DESC;
*/

// Node.js: when to use transactions (PostgreSQL strength)
const client = await pool.connect();
await client.query('BEGIN');
await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [100, fromId]);
await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [100, toId]);
await client.query('COMMIT');

// MongoDB equivalent requires Change Streams + Sessions (more complex):
const session = client.startSession();
session.startTransaction();
await accounts.updateOne({ _id: fromId }, { $inc: { balance: -100 } }, { session });
await accounts.updateOne({ _id: toId },   { $inc: { balance: 100 } },  { session });
await session.commitTransaction();
// Works, but FK constraints, CHECK constraints, and reporting are all manual
```

### Step-by-Step Explanation

1. **Choose PostgreSQL when**: your data has clear relationships (orders -> line items -> products -> users), you need JOINs in queries, referential integrity (foreign keys) matters, you need complex aggregations (window functions, CTEs), or you're in a regulated domain (finance, healthcare) requiring ACID.
2. **Choose MongoDB when**: each record can have a different shape (product catalog with varied attributes), you're prototyping and the schema isn't settled yet, you need horizontal write scaling via sharding, or you're storing document-like data (blog posts, log events) where embedding related data avoids joins entirely.
3. **Schema flexibility trade-off**: MongoDB's schemaless nature is great early in a project but becomes a maintenance hazard in production — you can end up with inconsistent documents. Use Mongoose schema validation or MongoDB JSON Schema validation to enforce structure.
4. **ACID in MongoDB**: since MongoDB 4.0, multi-document ACID transactions are supported but have significant performance overhead and are harder to use than PostgreSQL's built-in transactions. For anything finance-related, PostgreSQL is simpler.
5. **Scaling**: PostgreSQL scales reads via read replicas (Patroni, Aurora). Writes are bounded by a single primary node (vertical scaling). MongoDB's sharding distributes writes across shards — better for very high write throughput at the cost of query complexity.
6. **JSON support**: PostgreSQL supports native JSONB columns with GIN indexes. You can have the best of both worlds — relational tables for core data plus flexible JSON columns for variable attributes.
7. **Operational maturity**: both are production-grade. PostgreSQL has 30+ years of battle-testing. RDS PostgreSQL and Aurora PostgreSQL have excellent AWS support.

### Complexity

| Factor | PostgreSQL | MongoDB |
|--------|-----------|---------|
| Schema | Strict (DDL required) | Flexible (optional validation) |
| Joins | First-class SQL JOINs | $lookup (aggregation, slower) |
| ACID multi-table | Native, simple | Supported (v4.0+), more complex |
| Horizontal write scale | Limited without Citus | Native sharding |
| Best query type | Relational, analytical | Document retrieval, embedded data |
| Referential integrity | Foreign keys enforced | Manual, application-level |

---

## Q118: What is eventual consistency, and give a real scenario where it is acceptable?

### ELI5

Imagine updating your profile picture on a social network. Your friends in New York see the old picture for a few seconds while your friends in London already see the new one. Eventually all data centers catch up and everyone sees the new picture. This short window of inconsistency is "eventual consistency." It's acceptable here because nobody cares if their friend's profile photo takes 2 seconds to update everywhere.

### Visual Diagram

```
STRONG CONSISTENCY (synchronous replication)
---------------------------------------------
  Write to Primary
       |
       | (wait for all replicas to confirm)
       v
  [Replica EU] -- ACK
  [Replica APAC] -- ACK
       |
       v
  Confirm write to client
  Latency: 150-300ms (cross-region round trip)
  ALL reads see new value immediately

EVENTUAL CONSISTENCY (async replication)
-----------------------------------------
  Write to Primary
       |
       | confirm immediately to client (fast!)
       |
       | (replicate async in background)
       +-------> [Replica EU]   (lag: 50ms)
       +-------> [Replica APAC] (lag: 200ms)

  t=0ms:  Primary has new value, replicas have old value
  t=50ms: EU replica catches up
  t=200ms: APAC replica catches up
  t=200ms+: ALL nodes consistent

  Read during lag window: may return old (stale) value
```

### Code Example

```javascript
// --- Scenario 1: Shopping cart item count in a badge ---
// Acceptable eventual consistency: showing "3 items" vs "4 items" for
// a fraction of a second is fine. Nobody loses money.

// DynamoDB with eventual read (default, cheaper, faster)
const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const dynamo = new DynamoDBClient({ region: 'us-east-1' });

async function getCartCount(userId) {
  const result = await dynamo.send(new GetItemCommand({
    TableName: 'Carts',
    Key: { userId: { S: userId } },
    ConsistentRead: false,   // eventual consistency — cheaper, faster (50% cost vs strongly consistent)
  }));
  return result.Item?.itemCount?.N ?? 0;
}

// --- Scenario 2: View counter on a YouTube video ---
// Video has 1,234,567 views. If a read replica shows 1,234,560 for 100ms, nobody cares.
// Counter is updated async; all replicas catch up within seconds.

// Redis with async replication (eventual consistency)
async function incrementViewCount(videoId) {
  await redis.incr(`views:${videoId}`);  // write to primary
  // Redis replica may lag by a few ms — acceptable for view counts
}

// --- Scenario 3: WHERE eventual consistency is NOT acceptable ---
// Bank account balance
// If Alice reads her balance from a stale replica right before a transfer
// completes, she might think she has enough money when she doesn't.

// WRONG — reads from replica, may be stale:
async function checkBalanceWrong(accountId) {
  return await readReplica.query(
    'SELECT balance FROM accounts WHERE id = $1', [accountId]
  );
}

// CORRECT — reads from primary for financial operations:
async function checkBalanceCorrect(accountId) {
  return await primaryDb.query(
    'SELECT balance FROM accounts WHERE id = $1 FOR UPDATE', [accountId]
    // FOR UPDATE locks the row, ensures we read the latest committed value
  );
}

// --- Scenario 4: DynamoDB strongly consistent read (when needed) ---
async function getOrderStatus(orderId) {
  const result = await dynamo.send(new GetItemCommand({
    TableName: 'Orders',
    Key: { orderId: { S: orderId } },
    ConsistentRead: true,  // strongly consistent — reads from leader node
    // 2x cost but guaranteed to see the latest write
  }));
  return result.Item;
}
```

### Step-by-Step Explanation

1. **Eventual consistency defined**: a storage system guarantees that, if no new updates are made to a value, eventually all reads will return the last written value. During the propagation window, different nodes may return different versions.
2. **The CAP theorem link**: in a distributed system you can have at most 2 of: Consistency, Availability, Partition-tolerance. Eventual consistency is the AP choice — stay available during network partitions at the cost of temporary inconsistency.
3. **Acceptable scenarios**: user profile photos, video view counts, social media like counts, product recommendation scores, news feed ordering, real-time dashboards (approximate values), DNS propagation. These are "eventually correct" use cases.
4. **Unacceptable scenarios**: bank balances during transfers, inventory counts during checkout (overselling), authentication sessions (login/logout must be immediate), payment processing, medical records. These require strong consistency.
5. **DynamoDB consistency options**: `ConsistentRead: false` (eventual, 1 read unit per 4KB) vs `ConsistentRead: true` (strong, 2 read units per 4KB). 2x cost for strong consistency — only pay when you need it.
6. **Read-your-own-writes**: a common middle ground. The node that performed the write guarantees it returns the new value to the same client, even if other nodes are still replicating. Feels consistent to the user without requiring global sync.
7. **Conflict resolution**: when two clients write to the same key during a network partition, the system must resolve the conflict on reconnect. Strategies: Last-Write-Wins (timestamp), vector clocks, CRDT (Conflict-free Replicated Data Types for counters/sets).

### Complexity

| Scenario | Consistency Level | Why |
|----------|------------------|-----|
| Profile picture update | Eventual | Cosmetic, no financial impact |
| Like counts / views | Eventual | Approximate value acceptable |
| E-commerce cart item count | Eventual | Cosmetic badge |
| Checkout — last unit in stock | Strong | Prevents overselling |
| Bank transfer | Strong (+ transaction) | Prevents double-spend |
| Auth token revocation | Strong | Security requirement |
| DNS record propagation | Eventual (by design) | Global TTL-based cache |

---

## Q119: How does a B-tree database index work, and why does column order in a composite index matter?

### ELI5

A B-tree index is like a sorted dictionary. To find the word "Zebra" in a sorted dictionary, you open to the Z section immediately — you don't read every page. The database maintains a sorted tree of index values so it can do a binary-search-style lookup in O(log n) instead of scanning every row O(n). Column order in a composite index matters because the index sorts by the first column, then by the second — like sorting by last name, then first name.

### Visual Diagram

```
Table: orders (1 million rows)
Columns: id, customer_id, status, created_at

B-tree index on (customer_id):
                 [500000]
                /        \
         [250000]          [750000]
          /    \             /    \
     [125000][375000]  [625000][875000]
       ...    ...        ...    ...

Query: WHERE customer_id = 42
  1. Start at root [500000] -> 42 < 500000, go left
  2. [250000] -> 42 < 250000, go left
  3. [125000] -> 42 < 125000, go left
  4. [leaf] -> found! fetch row pointers -> heap fetch
  Cost: O(log n) = ~20 comparisons for 1M rows

COMPOSITE INDEX: (customer_id, status, created_at)
  Sorted by customer_id first, then status, then created_at
  
  customer_id=42, status=NULL, created_at=NULL
  = can use the index (left-prefix rule)
  
  customer_id=42, status='pending', created_at=NULL
  = can use the index
  
  customer_id=42, status='pending', created_at > '2024-01-01'
  = can use all 3 columns (range on last column is fine)
  
  status='pending' (no customer_id)
  = CANNOT use this index (missing leading column)
  = full table scan
```

### Code Example

```javascript
// Node.js + pg -- understanding index usage via EXPLAIN ANALYZE

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DB_URL });

// --- Create indexes ---
/*
-- Single column index (good for: WHERE customer_id = ?)
CREATE INDEX idx_orders_customer ON orders (customer_id);

-- Composite index (good for: WHERE customer_id = ? AND status = ?)
CREATE INDEX idx_orders_customer_status ON orders (customer_id, status);

-- Composite with range (good for: WHERE customer_id = ? AND created_at > ?)
CREATE INDEX idx_orders_lookup ON orders (customer_id, status, created_at DESC);

-- Partial index (only index rows matching condition -- smaller, faster)
CREATE INDEX idx_pending_orders ON orders (customer_id, created_at)
  WHERE status = 'pending';
-- Great if 95% of queries filter on status='pending'

-- Covering index: includes all columns the query needs (avoids heap fetch)
CREATE INDEX idx_orders_covering ON orders (customer_id, status)
  INCLUDE (total_amount, created_at);
-- Query: SELECT total_amount FROM orders WHERE customer_id=42 AND status='paid'
-- Fetches everything from the index -- no table access needed (Index-Only Scan)
*/

// --- Check with EXPLAIN ANALYZE ---
async function explainQuery(query, params) {
  const { rows } = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${query}`, params);
  rows.forEach(r => console.log(r['QUERY PLAN']));
}

// Uses index: "Index Scan using idx_orders_customer_status on orders"
await explainQuery(
  'SELECT id, total_amount FROM orders WHERE customer_id = $1 AND status = $2',
  [42, 'pending']
);

// Does NOT use index: sequential scan (missing leading column)
await explainQuery(
  'SELECT id FROM orders WHERE status = $1',
  ['pending']
);
// Fix: add separate index on (status) or restructure the composite index

// --- Common index mistakes ---
/*
// MISTAKE 1: Function on indexed column prevents index use
WHERE LOWER(email) = 'alice@example.com'   -- full scan!
-- Fix: CREATE INDEX idx_email_lower ON users (LOWER(email));  -- functional index

// MISTAKE 2: Implicit type cast prevents index use
WHERE user_id = '42'    -- user_id is INT, '42' is text --> cast needed --> no index
-- Fix: always pass the correct type: WHERE user_id = 42

// MISTAKE 3: Leading wildcard kills B-tree
WHERE name LIKE '%alice%'   -- can't use B-tree (no prefix to seek)
-- Fix: use GIN index with pg_trgm extension for substring search
-- CREATE INDEX idx_name_trgm ON users USING GIN (name gin_trgm_ops);

// MISTAKE 4: OR across columns often prevents composite index
WHERE customer_id = 42 OR status = 'pending'  -- may cause bitmap scan or seq scan
-- Fix: rewrite as UNION ALL of two indexed queries
*/
```

### Step-by-Step Explanation

1. **B-tree structure**: a self-balancing tree where each internal node has N-1 keys and N child pointers (N = branching factor, typically 100+). Leaf nodes contain the actual indexed values plus pointers (TID = table row ID) to the heap pages.
2. **Index seek**: the query planner traverses from root to leaf in O(log n) comparisons — typically 3–4 levels deep even for tables with millions of rows. Then it fetches the actual row from the heap using the TID.
3. **Index only scan**: if all columns in the SELECT are in the index (covering index), PostgreSQL skips the heap fetch entirely. This is 2–3x faster for read-heavy queries.
4. **Left-prefix rule**: a composite index on (A, B, C) supports queries filtering on A, A+B, or A+B+C. It does NOT support B alone or C alone because the tree is sorted by A first.
5. **Range column placement**: put equality columns before range columns in composite indexes. `(customer_id, status, created_at)` efficiently handles `WHERE customer_id=42 AND status='pending' AND created_at > '2024-01-01'`. A range on a middle column breaks the sort order for subsequent columns.
6. **Partial indexes**: index only the rows that matter. `CREATE INDEX ON orders (customer_id) WHERE status = 'active'` is much smaller than a full index if 90% of orders are closed. Queries with `WHERE status = 'active'` can use it.
7. **When NOT to create an index**: high-cardinality filters that return >10% of table rows (full scan may be cheaper), write-heavy tables (every INSERT/UPDATE/DELETE must update all indexes), very small tables (sequential scan is faster).

### Complexity

| Index Type | Use Case | Lookup Cost | Write Overhead |
|-----------|---------|-------------|---------------|
| B-tree (default) | Equality, range, sort | O(log n) | Medium |
| Hash | Equality only | O(1) | Low |
| GIN | Array contains, JSONB, full-text | O(log n + results) | High |
| GiST | Geometric, range types | O(log n) | Medium |
| BRIN | Very large tables with sorted data (timestamps) | O(n/pages) | Very low |

---

## Q120: Why is connection pooling critical in a Node.js + PostgreSQL application?

### ELI5

Every time your app talks to PostgreSQL without a pool, it's like hiring a new taxi driver for every single trip — finding the driver, paperwork, handshake, then firing them at the end. With a connection pool, you keep a small fleet of taxis on standby. Requests hop in and out instantly. PostgreSQL can only manage ~100–200 total connections before performance collapses, so reusing connections is essential.

### Visual Diagram

```
WITHOUT POOL (naive)
=====================
Request 1  --> [new TCP connection] --> PostgreSQL (connection 1)
Request 2  --> [new TCP connection] --> PostgreSQL (connection 2)
Request 3  --> [new TCP connection] --> PostgreSQL (connection 3)
...
Request N  --> [new TCP connection] --> PostgreSQL (connection N)

Problems:
  - Each new connection takes ~10-50ms (TLS handshake, auth)
  - PostgreSQL default max_connections = 100
  - 100 concurrent requests = PostgreSQL refuses new connections
  - Each connection uses ~5-10MB of RAM on the server

WITH POOL (pg-pool)
=====================
[Pool: 10 connections max]
  conn-1 (idle)
  conn-2 (busy: request 7)
  conn-3 (idle)
  ...
  conn-10 (busy: request 2)

Request 1  --> borrow conn-1 --> query --> return conn-1 to pool
Request 2  --> borrow conn-10 --> query (in progress)
Request 3  --> wait in queue (all 10 busy) --> conn-1 freed --> borrow conn-1

PostgreSQL sees: max 10 connections always open, regardless of traffic
```

### Code Example

```javascript
// npm install pg

const { Pool } = require('pg');

// --- 1. Create a single pool (module-level singleton) ---
const pool = new Pool({
  host:             process.env.DB_HOST,
  port:             parseInt(process.env.DB_PORT) || 5432,
  database:         process.env.DB_NAME,
  user:             process.env.DB_USER,
  password:         process.env.DB_PASSWORD,
  ssl:              { rejectUnauthorized: true },  // always TLS in production

  // Pool sizing:
  max:              10,    // max open connections (tune based on DB max_connections)
  min:              2,     // keep at least 2 warm (avoid cold start latency)
  idleTimeoutMillis: 30_000,  // close idle conn after 30s
  connectionTimeoutMillis: 5_000,  // throw if no conn available within 5s
  // Rule of thumb: pool size = (core_count * 2) + effective_spindle_count
  // For a typical API server with 4 CPUs: max ~10 connections
});

// Listen for pool errors (connection dropped, etc.)
pool.on('error', (err) => {
  console.error('Unexpected pool error', err);  // don't crash — pool auto-reconnects
});

// --- 2. Simple query (auto borrows + returns connection) ---
async function getUserById(id) {
  // pool.query() borrows a connection, runs the query, returns the connection
  // No need to manually acquire/release for single queries
  const { rows } = await pool.query(
    'SELECT id, name, email FROM users WHERE id = $1',
    [id]    // parameterized query -- prevents SQL injection
  );
  return rows[0];
}

// --- 3. Transaction (must use explicit client to keep same connection) ---
async function transferFunds(fromId, toId, amount) {
  const client = await pool.connect();  // borrow a dedicated connection
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [amount, fromId]
    );
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [amount, toId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();  // CRITICAL: always release back to pool
    // Forgetting release() causes pool exhaustion — all requests hang
  }
}

// --- 4. Pool health check ---
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      pool: {
        total:   pool.totalCount,    // total connections in pool
        idle:    pool.idleCount,     // connections waiting to be used
        waiting: pool.waitingCount,  // requests waiting for a connection
      },
    });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: err.message });
  }
});

// --- 5. Graceful shutdown (return all connections) ---
process.on('SIGTERM', async () => {
  await pool.end();   // drains all connections cleanly
  process.exit(0);
});

// --- 6. With PgBouncer (external connection pooler) ---
// PgBouncer sits between your app and PostgreSQL
// Your app pool: max=50 connections to PgBouncer
// PgBouncer maintains: max=10 connections to PostgreSQL (transaction mode)
// Transaction mode: DB connection returned after each transaction (not each query)
// This allows thousands of app connections to share a small set of DB connections
```

### Step-by-Step Explanation

1. **Connection cost**: establishing a new PostgreSQL connection requires TCP handshake, TLS negotiation, authentication, and session initialization — typically 10–50ms and ~5–10MB RAM on the server. Multiplied by hundreds of requests/sec, this becomes a bottleneck.
2. **max_connections limit**: PostgreSQL has a hard limit (default 100–200). Exceeding it causes new connections to fail with "too many connections" errors. A pool keeps a fixed, small number of connections open permanently.
3. **Pool sizing formula**: `N = (core_count * 2) + effective_spindle_count`. For a typical 4-core app server: ~10 connections per instance. For multiple app instances: divide `max_connections - 10 (reserved for admin)` by the number of instances.
4. **Why NOT max=100**: a large pool doesn't help — PostgreSQL's performance degrades with many concurrent queries due to lock contention, context switching, and buffer cache pressure. Keep pools small.
5. **Transaction isolation**: always use `pool.connect()` + `client.release()` for multi-statement transactions. `pool.query()` may use different connections for each call, breaking transaction context.
6. **Connection leak**: forgetting `client.release()` exhausts the pool. All subsequent requests queue up indefinitely. Use `try/finally` to guarantee release even on errors.
7. **PgBouncer**: an external connection pooler. In "transaction mode", a DB connection is checked in/out per transaction (not per app connection). Allows thousands of app instances to share 10–20 DB connections. Essential for serverless environments (Lambda).
8. **Serverless special case**: Lambda functions each create their own pool. 1000 concurrent Lambda invocations = 1000 pools * N connections = potential max_connections breach. Solution: use RDS Proxy (AWS-managed PgBouncer equivalent) between Lambda and RDS.

### Complexity

| Scenario | Connections to PostgreSQL | Notes |
|----------|--------------------------|-------|
| Single app instance, pool=10 | 10 | Ideal |
| 5 app instances, pool=10 each | 50 | Fine with max_connections=100 |
| 100 Lambda invocations, no pool | 100 | Hits limit immediately |
| 100 Lambda + RDS Proxy | 10-20 | Proxy multiplexes connections |
| idleTimeoutMillis too short | Many reconnects | Set to 30s+ |
| Forgetting client.release() | Pool exhaustion | All requests hang |

---

## Q121: How does Aurora Multi-AZ automatic failover work?

### ELI5

Aurora Multi-AZ is like a hospital with a primary surgeon and two backup surgeons in the same building. If the primary surgeon has a heart attack mid-operation, one of the backups takes over in under 30 seconds — the patient (your app) barely notices. The backup was already watching and had all the patient notes (data) in real time.

### Visual Diagram

```
Aurora Cluster (Multi-AZ, 3 AZs)
===================================

  Writer Instance (Primary)      -- handles all writes
       |
       | Aurora Storage (shared, 6-way replicated across 3 AZs)
       |   AZ-a: 2 copies
       |   AZ-b: 2 copies     <-- data written here simultaneously
       |   AZ-c: 2 copies
       |
  Reader Instance (AZ-b)         -- handles read queries
  Reader Instance (AZ-c)         -- handles read queries

  Cluster Endpoint:    cluster.xyz.us-east-1.rds.amazonaws.com  --> Writer
  Reader Endpoint:     cluster.ro.xyz.us-east-1.rds.amazonaws.com --> Readers (load balanced)

FAILOVER SEQUENCE:
==================
  t=0:   Primary (AZ-a) fails (hardware fault, AZ outage)
  t=0:   Aurora detects failure via heartbeat
  t=15s: Aurora promotes Reader in AZ-b to Writer
         (no data loss -- shared storage already had latest writes)
  t=30s: Cluster endpoint DNS record updated to point at new Primary
  t=30s: App reconnects (if using cluster endpoint + retry logic)
  t=30s: Old primary becomes a Reader (if AZ recovers)

  RTO: ~15-30 seconds
  RPO: 0 (no data loss -- shared storage architecture)
```

### Code Example

```javascript
// node-postgres (pg) with Aurora cluster endpoint + retry logic

const { Pool } = require('pg');
const pool = new Pool({
  // ALWAYS use the cluster endpoint (not individual instance endpoints)
  // The cluster endpoint automatically points to the current Writer
  host:     process.env.AURORA_CLUSTER_ENDPOINT,   // e.g., cluster.xyz.rds.amazonaws.com
  port:     5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      { rejectUnauthorized: true },

  max:                    10,
  idleTimeoutMillis:      30_000,
  connectionTimeoutMillis: 5_000,
});

// Retry wrapper for transient connection errors during failover
async function queryWithRetry(text, params, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { rows } = await pool.query(text, params);
      return rows;
    } catch (err) {
      lastError = err;

      // Retry on connection errors -- these happen during ~30s failover window
      const isTransient = [
        'ECONNREFUSED',       // connection refused
        'ENOTFOUND',          // DNS not yet updated
        '57P01',              // admin_shutdown (instance being replaced)
        '08006',              // connection failure
        '08001',              // cannot connect
      ].some(code => err.code === code || err.message.includes(code));

      if (!isTransient || attempt === maxRetries) break;

      const delay = Math.min(1000 * 2 ** attempt, 10_000);  // exponential backoff
      console.warn(`DB connection error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));

      // Force pool to discard stale connections (they point to old primary)
      // pg-pool auto-removes errored connections, but you can also:
      // await pool.end(); pool = new Pool({...});  // full reset if needed
    }
  }
  throw lastError;
}

// Read queries: use the reader endpoint for scale + cost
const readerPool = new Pool({
  host:     process.env.AURORA_READER_ENDPOINT,  // load-balanced across all readers
  // ... same config
});

async function getProductCatalog() {
  return queryWithRetry(
    'SELECT id, name, price FROM products WHERE active = true',
    [],
    // routed to reader -- reduces load on writer
  );
}

// Write queries: always go to the writer via the cluster endpoint
async function createOrder(order) {
  return queryWithRetry(
    'INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING id',
    [order.userId, order.total]
  );
}

// Aurora-specific: monitoring failover events via RDS Event Subscriptions
// Subscribe to: RDS-EVENT-0006 (failover started)
//               RDS-EVENT-0007 (failover completed)
// Triggers SNS notification --> Lambda --> alert on-call via PagerDuty
```

### Step-by-Step Explanation

1. **Shared storage architecture**: unlike standard RDS Multi-AZ (which replicates at the block device level to a standby), Aurora has a distributed storage layer shared by all instances. Writes go directly to the 6-copy storage — no replication lag between primary and replicas.
2. **6-way replication**: Aurora writes to 6 storage nodes across 3 AZs (2 per AZ). A write is acknowledged after 4/6 nodes confirm it (`quorum write`). This makes Aurora durable against simultaneous failure of an entire AZ.
3. **Failover trigger**: Aurora monitors the primary with a heartbeat. If the primary fails to respond within ~10–15 seconds, Aurora initiates failover. One of the existing Aurora Replicas (reader instances) is promoted to primary.
4. **RPO=0**: because all instances share the same storage, the promoted replica is already at 100% of the data — there is no replication lag to catch up. No data is lost.
5. **RTO~30s**: Aurora DNS flips within 30 seconds. Applications using the cluster endpoint don't need to change their connection string — DNS update handles it. However, the app must handle the brief connection disruption with retries (see code above).
6. **Cluster endpoint vs instance endpoint**: NEVER hardcode individual instance endpoints in your application. Instance endpoints change during failover. The cluster endpoint is stable — it always points to the current writer.
7. **Reader endpoint**: routes read-only queries across all available reader instances using round-robin. This distributes read load and reduces cost.
8. **Aurora Serverless v2**: an alternative that auto-scales the instance itself (0.5 to 128 ACUs) in seconds. No need to manage instance sizes. Failover still occurs but serverless scaling adds another layer of elasticity.

### Complexity

| Factor | Aurora Multi-AZ | RDS Multi-AZ |
|--------|----------------|--------------|
| Failover time (RTO) | ~15-30 seconds | ~60-120 seconds |
| Data loss (RPO) | 0 (shared storage) | Seconds (block-level sync) |
| Read scaling | Yes (up to 15 readers) | No (standby not readable) |
| Replication lag | None (shared storage) | Milliseconds (standby) |
| Cost vs single-AZ | ~2x | ~2x |
| Storage replication | 6 copies in 3 AZs | 2 copies in 2 AZs |

---

## Q122: How do you implement read/write splitting in a Node.js application?

### ELI5

A database writer is the boss who makes all the decisions (INSERT/UPDATE/DELETE). Readers are assistants who can answer questions (SELECT) from a copy of the boss's notes. By sending "questions" to the assistants and only bothering the boss with "decisions," you reduce the boss's load and make the whole office faster. In Node.js, read/write splitting means having two connection pools — one to the primary (writer) and one or more to the replicas (readers).

### Visual Diagram

```
Node.js App
    |
    +------[Write operations]------> [Primary DB] (Writer)
    |       INSERT, UPDATE, DELETE       ^
    |       BEGIN/COMMIT                  |
    |                                     | replication
    +------[Read operations]-------> [Replica 1] (Reader)
            SELECT queries          [Replica 2] (Reader)
                                    (load balanced)

                         Replication lag: 1-100ms
                         Reads may see data 1-100ms old

Read/Write Router in Node.js:
  query.type === 'write' OR query.inTransaction
    --> primaryPool
  else
    --> replicaPool (round-robin or random)
```

### Code Example

```javascript
// npm install pg

const { Pool } = require('pg');

// --- 1. Two pools: primary (writer) and replica (reader) ---
const primaryPool = new Pool({
  host:     process.env.DB_PRIMARY_HOST,    // Aurora cluster endpoint (writer)
  port:     5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      { rejectUnauthorized: true },
  max:      10,
});

const replicaPool = new Pool({
  host:     process.env.DB_REPLICA_HOST,    // Aurora reader endpoint (reader)
  port:     5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      { rejectUnauthorized: true },
  max:      20,    // readers can handle more concurrent queries
});

// --- 2. Smart query router ---
// Heuristic: if the query starts with SELECT and we're not in a transaction,
// route it to the replica. Everything else goes to primary.
function selectPool(sql, { writeTx = false } = {}) {
  const normalized = sql.trim().toUpperCase();
  if (writeTx) return primaryPool;                          // inside transaction
  if (/^SELECT\b/.test(normalized)) return replicaPool;    // read-only query
  return primaryPool;                                       // write, DDL, etc.
}

async function query(sql, params, options = {}) {
  const pool = selectPool(sql, options);
  const { rows } = await pool.query(sql, params);
  return rows;
}

// --- 3. Usage examples ---

// Read -> goes to replica pool
async function getUserById(id) {
  return query(
    'SELECT id, name, email FROM users WHERE id = $1',
    [id]
  );
}

// Write -> goes to primary pool
async function updateUserName(id, name) {
  return query(
    'UPDATE users SET name = $1 WHERE id = $2 RETURNING id',
    [name, id]
  );
}

// --- 4. Transactions: ALWAYS on primary, even for SELECTs inside them ---
async function transferWithReadCheck(fromId, toId, amount) {
  const client = await primaryPool.connect();  // always primary for transactions
  try {
    await client.query('BEGIN');

    // This SELECT is inside a transaction -- must use primary to see own writes
    const { rows } = await client.query(
      'SELECT balance FROM accounts WHERE id = $1 FOR UPDATE',
      [fromId]
    );

    if (rows[0].balance < amount) throw new Error('Insufficient funds');

    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]
    );
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// --- 5. Read-after-write consistency issue ---
// Problem: user updates their profile, then immediately reads it.
// If the read goes to a replica with a 50ms lag, they see the OLD data.
//
// Solution option A: route read to primary for 1-2 seconds after a write
// Solution option B: pass a "read-my-writes" flag

async function updateAndReadProfile(userId, newName) {
  // Write to primary
  await query(
    'UPDATE users SET name = $1 WHERE id = $2', [newName, userId]
  );

  // Read from primary (not replica) to see the write immediately
  const [user] = await query(
    'SELECT id, name FROM users WHERE id = $1', [userId],
    { writeTx: true }   // forces primary pool
  );
  return user;
}

// --- 6. Metrics: monitor both pools ---
setInterval(() => {
  console.log('Primary pool:', {
    total: primaryPool.totalCount,
    idle: primaryPool.idleCount,
    waiting: primaryPool.waitingCount,
  });
  console.log('Replica pool:', {
    total: replicaPool.totalCount,
    idle: replicaPool.idleCount,
    waiting: replicaPool.waitingCount,
  });
}, 60_000);
```

### Step-by-Step Explanation

1. **Why split reads**: write load (INSERT/UPDATE/DELETE + index maintenance) stays on the primary. Reads (SELECT) are distributed to one or more replicas. Replicas are cheap and can be scaled horizontally — add more readers as read traffic grows.
2. **Replication lag**: async replication means replicas may be 1–100ms behind. The application must tolerate stale reads on the replica, or fall back to the primary for latency-sensitive reads.
3. **Transaction routing**: ALL statements within a transaction must use the same connection to the primary. If you send a SELECT inside BEGIN/COMMIT to a replica, it runs outside the transaction context entirely.
4. **Read-after-write problem**: a user writes data, then immediately reads it. If the read hits the replica before replication completes, they see stale data. Solution: route reads to the primary for 1–2 seconds after a write, or always read from the primary on the same request that just wrote.
5. **Aurora reader endpoint**: AWS Aurora provides a single reader endpoint that load-balances across all available read replicas. You don't need to manage multiple replica URLs — just point your replica pool at the reader endpoint.
6. **Knex or Sequelize**: ORM-level read/write splitting is possible with Knex (`knex.js` with `replication` config) or Sequelize (`dialectOptions.replication`). They handle pool selection automatically based on query type.
7. **Middleware approach**: for Express apps, attach `req.db = { write: primaryPool, read: replicaPool }` in middleware so route handlers always have access to both pools.

### Complexity

| Traffic Pattern | Primary Pool Load | Replica Pool Load | Notes |
|----------------|-----------------|------------------|-------|
| 90% reads / 10% writes | Low | High | Ideal use case for splitting |
| 50/50 reads/writes | Medium | Medium | Still beneficial |
| All writes (OLTP) | High | Unused | Consider CQRS instead |
| After read/write split | -70% primary load | +reads spread | Allows 3-5x more total throughput |

--- End of Section 13 ---

---

# Section 14: TypeScript

## Q123: What is the difference between `type` and `interface` in TypeScript, and when should you use each?

### ELI5
Imagine you are labeling boxes. A `type` label is like a sticker you can put on ANY box -- a simple box, a box with extra tape, or even two boxes glued together. An `interface` label is specifically for describing boxes with named slots (objects). Both labels tell you what is inside the box, but `interface` labels can be extended later (someone can add more slots), while `type` stickers are fixed once printed. In a team project, if you are describing data shapes that others will extend, use `interface`. For everything else -- unions, tuples, computed types -- use `type`.

### Visual Diagram
```
TYPE ALIAS                        INTERFACE
-----------                       ---------
type Point = {                    interface Point {
  x: number;                        x: number;
  y: number;                        y: number;
};                                }

Can alias anything:               Can only describe object shape:
  type ID = string | number;        interface Admin extends User { role: string }
  type Pair = [string, number];
  type Callback = () => void;

Declaration merging:              Declaration merging: YES
  type X = { a: number };           interface Window { myProp: string }
  type X = { b: number }; // ERROR  interface Window { myProp: string } // MERGED

Computed / conditional:           No conditional types:
  type Keys = keyof User;           interface -- cannot use keyof inline
  type Maybe<T> = T | null;
```

### Code Example
```typescript
// --- INTERFACE: use for extendable object shapes ---

interface Animal {
  name: string;
  speak(): string;
}

// Extending an interface (class-style inheritance)
interface Dog extends Animal {
  breed: string;
}

// Declaration merging: TypeScript merges both declarations
interface Dog {
  microchipId?: number; // automatically merged into Dog
}

const rex: Dog = {
  name: "Rex",
  breed: "Labrador",
  speak: () => "Woof",
  microchipId: 12345,
};

// --- TYPE ALIAS: use for unions, tuples, computed, primitives ---

// Union type -- impossible with interface
type ID = string | number;

// Tuple type
type Coordinates = [number, number];

// Conditional type -- impossible with interface
type NonNullable<T> = T extends null | undefined ? never : T;

// Intersection (similar to extends, but inline)
type AdminUser = { role: string } & { id: number; name: string };

// Mapped type (transforms existing type)
type ReadOnly<T> = { readonly [K in keyof T]: T[K] };

type ReadOnlyDog = ReadOnly<Dog>;
// ReadOnlyDog.name = "Max"; // ERROR: read-only

// --- When you MUST use type ---
type StringOrNumber = string | number;    // union
type Triple = [string, number, boolean];  // tuple
type Getter<T, K extends keyof T> = () => T[K]; // generic computed

// --- When you MUST use interface ---
// 1. Augmenting third-party types (declaration merging)
declare module "express" {
  interface Request {
    userId?: string; // adds custom property to Express Request
  }
}

// 2. Class implementation contracts
interface Serializable {
  serialize(): string;
  deserialize(data: string): void;
}

class Config implements Serializable {
  private data: Record<string, unknown> = {};
  serialize() { return JSON.stringify(this.data); }
  deserialize(data: string) { this.data = JSON.parse(data); }
}
```

### Step-by-Step Explanation
1. **Both describe object shapes**: For a plain object type `{ name: string; age: number }`, either `type` or `interface` works identically at the type level — the compiled JS is the same.
2. **interface supports declaration merging**: You can declare the same `interface` name twice and TypeScript merges them. This is how `@types/express` lets you add `req.userId` — you merge into the existing `Request` interface. `type` does NOT support this; redeclaring a `type` alias is an error.
3. **type supports unions and intersections inline**: `type Status = "active" | "inactive"` cannot be an `interface`. Similarly, tuples, conditional types, and mapped types all require `type`.
4. **extends vs intersection**: Both achieve composition. `interface Child extends Parent` is cleaner for OOP hierarchies. `type Child = Parent & { extra: string }` is better for one-off compositions.
5. **Performance**: TypeScript's compiler caches `interface` shapes more aggressively than `type` aliases. In huge codebases with thousands of types, `interface` can give slightly faster incremental compilation, but this is rarely noticeable in practice.
6. **Team convention (Google, Airbnb style guides)**: Use `interface` for public API shapes (things exported for others to extend). Use `type` for internal types, unions, utilities, and anything that is not a plain object shape.

### Complexity

| Feature | type | interface |
|-----------------------|------|-----------|
| Object shapes | YES | YES |
| Union types | YES | NO |
| Tuple types | YES | NO |
| Declaration merging | NO | YES |
| Class implements | YES | YES |
| Conditional types | YES | NO |
| Mapped types | YES | NO |
| Extends (inheritance) | Via & intersection | Via extends keyword |
| Module augmentation | NO | YES |

## Q124: What is the difference between `any` and `unknown` in TypeScript, and why is `unknown` safer?

### ELI5
Think of `any` as a master key that opens every lock -- it disables ALL safety checks. TypeScript just trusts you and lets you do anything with an `any` value, including calling methods that don't exist. `unknown` is like receiving a mystery box: you know SOMETHING is in there, but you must check what it is before using it. TypeScript forces you to narrow the type (check with `typeof`, `instanceof`, or a type guard) before you can use an `unknown` value. The result: `unknown` gives you flexibility without sacrificing safety, while `any` silently hides bugs.

### Visual Diagram
```
  any                            unknown
  ---                            -------
  Accepts anything:              Accepts anything:
    let x: any = 42;               let x: unknown = 42;
    x = "hello";      OK           x = "hello";      OK
    x = { a: 1 };    OK           x = { a: 1 };     OK

  But lets you do ANYTHING:     Forces you to NARROW first:
    x.toUpperCase()   OK (no    x.toUpperCase()    ERROR
    x.foo.bar.baz()   OK  err)  x.foo.bar          ERROR

  Assignable everywhere:         Only assignable to unknown or any:
    let s: string = x;  OK       let s: string = x; ERROR

  Safe to use? NO               Safe to use? YES (after narrowing)

  Narrowing needed? NO          Narrowing needed? YES
    if (typeof x === "string")    if (typeof x === "string") {
      x.toUpperCase(); // needed    x.toUpperCase(); // OK now
                                  }
```

### Code Example
```typescript
// ============================================================
// WHY any IS DANGEROUS
// ============================================================

function processAny(value: any) {
  // TypeScript does not complain -- but this will CRASH at runtime
  // if value is not a string
  return value.toUpperCase().trim(); // no type error, but runtime bomb
}

processAny(42);       // TypeError: value.toUpperCase is not a function
processAny(null);     // TypeError: Cannot read properties of null
processAny("hello");  // "HELLO" - only this works

// Spreads silently: any infects surrounding types
const result: string = processAny(42); // TypeScript ACCEPTS this -- silent bug

// ============================================================
// WHY unknown IS SAFER
// ============================================================

function processUnknown(value: unknown): string {
  // TypeScript FORCES you to check before using
  if (typeof value === "string") {
    return value.toUpperCase().trim(); // OK -- narrowed to string
  }
  if (typeof value === "number") {
    return value.toFixed(2);           // OK -- narrowed to number
  }
  if (value instanceof Date) {
    return value.toISOString();        // OK -- narrowed to Date
  }
  return String(value);                // fallback: explicit conversion
}

// unknown cannot be assigned to string without narrowing
// const s: string = someUnknown; // ERROR

// ============================================================
// REAL-WORLD USE CASE: parsing external data
// ============================================================

// BAD -- any erases all type safety on parsed JSON
function parseConfigBad(json: string): any {
  return JSON.parse(json);
  // caller can do .nonExistentProp.deep.nested -- no error
}

// GOOD -- unknown forces validation before use
function parseConfigGood(json: string): unknown {
  return JSON.parse(json);
}

// Type guard narrows unknown to a known type
interface Config {
  apiUrl: string;
  timeout: number;
}

function isConfig(value: unknown): value is Config {
  return (
    typeof value === "object" &&
    value !== null &&
    "apiUrl" in value &&
    "timeout" in value
  );
}

const raw = parseConfigGood('{"apiUrl":"https://api.example.com","timeout":5000}');

if (isConfig(raw)) {
  console.log(raw.apiUrl);   // TypeScript knows it is Config
  console.log(raw.timeout);  // fully typed
}

// ============================================================
// another pattern: try/catch with unknown (TS 4.0+ default)
// ============================================================

try {
  JSON.parse("invalid json{{{");
} catch (err: unknown) {
  // err is unknown -- force you to check
  if (err instanceof Error) {
    console.error("Parse error:", err.message); // safe
  } else {
    console.error("Unknown error:", String(err));
  }
}
```

### Step-by-Step Explanation
1. **`any` opts out of type checking**: When you annotate a value as `any`, TypeScript treats it like plain JavaScript -- no property checks, no method checks, no assignability checks. It is a complete escape hatch.
2. **`any` is contagious**: A variable inferred from an `any` value also becomes `any`. Call a function that returns `any`, store the result -- everything downstream loses types silently.
3. **`unknown` is the type-safe counterpart**: `unknown` accepts any value on assignment (like `any`), but TypeScript REFUSES to let you use the value until you narrow its type with `typeof`, `instanceof`, or a custom type guard.
4. **Narrowing resolves `unknown`**: Inside an `if (typeof x === "string")` block, TypeScript narrows `x` to `string` and enables all string methods. Without the check, calling `.toUpperCase()` is a compile-time error.
5. **Assignability rules**:
   - `any` is assignable to every type (including `string`, `number`, `object`).
   - `unknown` is only assignable to `unknown` or `any` without a type assertion.
   - This means `any` silently breaks downstream types; `unknown` does not.
6. **When to use each**:
   - `unknown`: JSON.parse results, catch block errors (`catch(err: unknown)`), function parameters that accept anything, API response bodies before validation.
   - `any`: Migration from JavaScript to TypeScript (temporary), interop with untyped third-party libraries that have no `@types`, or as an explicit escape hatch when you truly need dynamic behaviour.

### Complexity

| Aspect | any | unknown |
|------------------------|-----|---------|
| Accepts any value | YES | YES |
| Requires narrowing | NO | YES |
| Assignable to string | YES (unsafe) | NO (safe) |
| Catches bugs at compile | NO | YES |
| Type inference preserved | NO (lost) | YES (after narrowing) |
| Recommended for new code | NO | YES |
| Use in catch block | Legacy | YES (TS 4.0+ default) |

## Q125: How do you implement a `DeepPartial<T>` utility type from scratch in TypeScript?

### ELI5
The built-in `Partial<T>` makes all top-level properties optional. But if you have a nested object like `{ user: { address: { city: string } } }`, `Partial<T>` only makes `user` optional -- `address` and `city` are still required. `DeepPartial<T>` digs all the way down recursively and makes EVERY property at EVERY level optional. It is like handing back a form where you can leave any field blank, even inside sub-forms.

### Visual Diagram
```
  Original type (User):          Partial<User>:          DeepPartial<User>:
  ---------------------          -------------           ------------------
  {                              {                       {
    id: number           -->       id?: number    -->      id?: number
    name: string                   name?: string           name?: string
    address: {                     address?: {             address?: {
      street: string                 street: string           street?: string
      city: string                   city: string             city?: string
      zip: string                    zip: string              zip?: string
    }                              }                        }
  }                              }                       }

  Partial only makes             DeepPartial recurses
  top-level optional             into nested objects too
```

### Code Example
```typescript
// ============================================================
// DeepPartial<T> from scratch
// ============================================================

// The key technique: conditional + mapped + recursive type
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }  // recurse into each value
  : T;                                        // primitive: return as-is

// How it works:
// 1. If T is an object, map over its keys
//    - [K in keyof T]? makes each key optional (?:)
//    - DeepPartial<T[K]> recurses into the value type
// 2. If T is a primitive (string, number, boolean, etc.), just return T

// ============================================================
// Usage example
// ============================================================

interface Address {
  street: string;
  city: string;
  zip: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  address: Address;
  roles: string[];
}

// DeepPartial<User> makes everything optional recursively
type PartialUser = DeepPartial<User>;
// Equivalent to:
// {
//   id?: number;
//   name?: string;
//   email?: string;
//   address?: {
//     street?: string;
//     city?: string;
//     zip?: string;
//   };
//   roles?: string[];   <-- arrays become (string[] | undefined)
// }

// Typical use case: merge/patch updates
function updateUser(existing: User, patch: DeepPartial<User>): User {
  return {
    ...existing,
    ...patch,
    address: {
      ...existing.address,
      ...(patch.address ?? {}),  // merge nested address
    },
  };
}

const user: User = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  address: { street: "123 Main St", city: "Springfield", zip: "12345" },
  roles: ["admin"],
};

const updated = updateUser(user, {
  name: "Alice Smith",          // only change name
  address: { city: "Shelbyville" }, // only change city in address
});
// updated.address.street is still "123 Main St"
// updated.address.city   is now "Shelbyville"

// ============================================================
// Handling arrays inside DeepPartial
// ============================================================

// Note: arrays are objects, so DeepPartial<string[]> becomes:
// { [K in keyof string[]]?: DeepPartial<string[K]> }
// which produces a weird result for array indices
// Common fix: exclude arrays from recursion

type DeepPartialSafe<T> = T extends Array<infer Item>
  ? Array<DeepPartialSafe<Item>>       // keep array, recurse into element type
  : T extends object
  ? { [K in keyof T]?: DeepPartialSafe<T[K]> }
  : T;

type SafePartialUser = DeepPartialSafe<User>;
// roles?: string[]  <-- array stays as string[], not weird mapped type

// ============================================================
// Test: verifying types
// ============================================================

const patch: DeepPartialSafe<User> = {
  address: {
    city: "Chicago",  // only city -- street and zip are optional
  },
  roles: ["viewer"],  // full array replacement (not per-element optional)
};
```

### Step-by-Step Explanation
1. **`Partial<T>` limitation**: The built-in `Partial<T>` is `{ [K in keyof T]?: T[K] }`. It only adds `?` at the top level. Nested object types (`T[K]` when it is an object) remain required inside.
2. **Conditional type as the entry point**: `T extends object` checks if `T` is an object type. If yes, we recurse. If no (primitive), we return `T` unchanged. This is the base case that stops infinite recursion.
3. **Mapped type with `?`**: `{ [K in keyof T]?: DeepPartial<T[K]> }` iterates over every key `K` of `T`, marks it optional with `?`, and recursively applies `DeepPartial` to the value type `T[K]`.
4. **Recursion terminates**: TypeScript's type system is lazy -- it only resolves types when needed. Recursion terminates because eventually `T[K]` is a primitive (string, number, boolean), which hits the `else` branch and returns `T` unchanged.
5. **Array edge case**: Plain `DeepPartial` treats arrays as objects and maps over their numeric indices. The safe version adds an `Array<infer Item>` check first, preserving the array structure while recursing into the element type.
6. **Use cases**: `DeepPartial` is used for patch endpoints (HTTP PATCH body types), Redux selectors, test fixtures (you only need to specify some fields), and configuration merging.

### Complexity

| Operation | Type-level cost | Runtime cost |
|------------------------|-----------------|--------------|
| Type resolution | O(depth * keys) | Zero (erased) |
| Compile-time check | Once per usage | N/A |
| Object spread merge | O(n) properties | O(n) |
| Deep merge (recursive) | O(depth * keys) | O(depth * keys) |
| Array handling | O(length) indices | Preserved |

## Q126: How do you implement a fully type-safe `DeepMerge<T, U>` function in TypeScript?

### ELI5
Imagine T is your base settings file and U is your override file. `DeepMerge` produces a new object that combines both -- wherever U has a value, it wins; wherever T has a value and U does not, T stays. But unlike `Object.assign`, DeepMerge digs inside nested objects too, so overriding one property inside an address object does not wipe out the other address properties. The type `DeepMerge<T, U>` tells TypeScript exactly what the result looks like after the merge.

### Visual Diagram
```
  T = {                  U = {                 DeepMerge<T, U> = {
    a: number              b: string               a: number       (from T)
    nested: {              nested: {               b: string       (from U)
      x: number              y: string             nested: {
      z: boolean           }                           x: number   (from T)
    }                    }                              y: string  (from U)
  }                                                     z: boolean (from T)
                                                    }
                                                  }

  Keys in both T and U ---> both kept (U wins for primitives, merged for objects)
  Keys only in T       ---> carried over from T
  Keys only in U       ---> carried over from U
```

### Code Example
```typescript
// ============================================================
// DeepMerge utility type
// ============================================================

// Step 1: For each key, determine the merged type
// - If the key exists in BOTH T and U and both values are objects -> recurse
// - If the key exists only in T -> take T[K]
// - If the key exists only in U -> take U[K]
// - If the key exists in both but one is a primitive -> U wins (override)

type DeepMerge<T, U> = {
  // Keys present in BOTH T and U
  [K in keyof T & keyof U]: T[K] extends object
    ? U[K] extends object
      ? DeepMerge<T[K], U[K]>   // both objects: recurse
      : U[K]                     // U is primitive: U wins
    : U[K];                      // T is primitive: U wins
} & {
  // Keys only in T (not in U)
  [K in Exclude<keyof T, keyof U>]: T[K];
} & {
  // Keys only in U (not in T)
  [K in Exclude<keyof U, keyof T>]: U[K];
};

// Flatten the intersection for cleaner hover tooltips
type Flatten<T> = { [K in keyof T]: T[K] };
type DeepMergeFull<T, U> = Flatten<DeepMerge<T, U>>;

// ============================================================
// Runtime implementation
// ============================================================

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function deepMerge<T extends object, U extends object>(
  base: T,
  override: U
): DeepMergeFull<T, U> {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(override) as (keyof U & string)[]) {
    const baseVal = result[key];
    const overrideVal = override[key] as unknown;

    if (isObject(baseVal) && isObject(overrideVal)) {
      // Both are plain objects: recurse
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>
      );
    } else {
      // Primitive or array: override wins
      result[key] = overrideVal;
    }
  }

  return result as DeepMergeFull<T, U>;
}

// ============================================================
// Usage
// ============================================================

const defaultConfig = {
  server: {
    host: "localhost",
    port: 3000,
    tls: false,
  },
  db: {
    host: "localhost",
    port: 5432,
    name: "myapp",
  },
  logLevel: "info",
};

const productionOverride = {
  server: {
    host: "prod.example.com",
    tls: true,
    // port is NOT in override -- keeps 3000 from default
  },
  logLevel: "warn",
  newFeatureFlag: true, // key only in U, added to result
};

const config = deepMerge(defaultConfig, productionOverride);

// TypeScript infers the exact merged type:
config.server.host;         // "prod.example.com" (from override)
config.server.port;         // 3000 (from default, kept)
config.server.tls;          // true (from override)
config.db.name;             // "myapp" (from default, unchanged)
config.logLevel;            // "warn" (from override)
config.newFeatureFlag;      // true (new key from override)
```

### Step-by-Step Explanation
1. **Three-zone merge**: The `DeepMerge<T, U>` type splits all keys into three groups: shared keys (`keyof T & keyof U`), T-only keys (`Exclude<keyof T, keyof U>`), and U-only keys (`Exclude<keyof U, keyof T>`). Each group is handled separately with an intersection (`&`).
2. **Shared key rule**: For keys in both T and U, we check if BOTH values are object types. If yes, we recursively apply `DeepMerge`. If either side is a primitive, `U[K]` wins (override semantics).
3. **`Flatten`**: Intersecting three mapped types produces `{ a: 1 } & { b: 2 } & { c: 3 }` which is structurally correct but ugly in hover tooltips. `Flatten<T>` re-maps it into a single clean object type.
4. **Runtime `deepMerge` function**: Spreads `base` into `result`, then iterates over `override`'s keys. For each key, if both sides are plain objects (not arrays, not null), it recurses. Otherwise it overwrites. The return type is cast to `DeepMergeFull<T, U>`.
5. **Array handling decision**: Deep-merging arrays is ambiguous (concatenate? replace? merge by index?). This implementation treats arrays as primitive values -- the override always replaces the base. If you need array merging, add a custom strategy (e.g., `concat` mode) before the object check.
6. **Real use cases**: Configuration layering (default -> env -> user), Redux state patching, JSON schema merging, theme customization in design systems.

### Complexity

| Operation | Time | Space |
|--------------------|----------|-------|
| deepMerge runtime | O(d * k) | O(d * k) |
| d = nesting depth | - | - |
| k = keys per level | - | - |
| Type resolution | O(d * k) | compile-time only |
| Array handling | O(1) replace | O(n) if concat |

## Q127: What is a discriminated union in TypeScript and how do you use one in a real-world API state example?

### ELI5
When you fetch data from an API, the response can be in one of three states: loading, success, or error. A discriminated union is a way to describe all three states in ONE type, but with a special "tag" property (the discriminant) that tells TypeScript which state you are in. Once you check `if (state.status === "success")`, TypeScript automatically knows all the other properties that exist -- you do not need to cast or check for undefined. It is like having three different envelopes, each labeled, and once you see the label you know exactly what is inside.

### Visual Diagram
```
  Discriminated Union (tag = "status" field)

  LoadingState        SuccessState            ErrorState
  ------------        ------------            ----------
  {                   {                       {
    status: "loading"   status: "success"       status: "error"
                        data: User[]            error: Error
                        total: number           code: number
  }                   }                       }

  type ApiState = LoadingState | SuccessState | ErrorState

  switch (state.status) {
    case "loading"  -> TypeScript knows: no data, no error
    case "success"  -> TypeScript knows: data and total exist
    case "error"    -> TypeScript knows: error and code exist
  }

  Exhaustiveness check with never:
    default: const _: never = state; // compile error if new state added
```

### Code Example
```typescript
// ============================================================
// Define the discriminated union
// ============================================================

interface LoadingState {
  status: "loading";
}

interface SuccessState<T> {
  status: "success";
  data: T;
  total: number;
  page: number;
}

interface ErrorState {
  status: "error";
  error: Error;
  code: number;
  retryable: boolean;
}

// The union -- "status" is the discriminant
type ApiState<T> = LoadingState | SuccessState<T> | ErrorState;

interface User {
  id: number;
  name: string;
  email: string;
}

// ============================================================
// React component using the discriminated union
// ============================================================

function renderUserList(state: ApiState<User[]>): string {
  switch (state.status) {
    case "loading":
      // TypeScript knows: state has NO data, NO error
      return "<Spinner />";

    case "success":
      // TypeScript knows: state.data is User[], state.total is number
      return state.data
        .map((u) => `<li>${u.name} (${u.email})</li>`)
        .join("\n");

    case "error":
      // TypeScript knows: state.error is Error, state.code is number
      return `<ErrorBoundary message="${state.error.message}" code="${state.code}" />`;

    default:
      // Exhaustiveness check: if you add a new union member and forget
      // to handle it, TypeScript raises a compile error here
      const _exhaustive: never = state;
      throw new Error("Unhandled state: " + JSON.stringify(_exhaustive));
  }
}

// ============================================================
// Custom hook pattern (React simulation)
// ============================================================

async function fetchUsers(page: number): Promise<ApiState<User[]>> {
  // Initially: loading
  const loading: LoadingState = { status: "loading" };
  void loading; // just showing the type

  try {
    const res = await fetch(`/api/users?page=${page}`);
    if (!res.ok) {
      return {
        status: "error",
        error: new Error(`HTTP ${res.status}`),
        code: res.status,
        retryable: res.status >= 500,
      };
    }
    const json = await res.json() as { data: User[]; total: number };
    return {
      status: "success",
      data: json.data,
      total: json.total,
      page,
    };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err : new Error(String(err)),
      code: 0,
      retryable: true,
    };
  }
}

// ============================================================
// Narrowing with a helper function (type guard)
// ============================================================

function isSuccess<T>(state: ApiState<T>): state is SuccessState<T> {
  return state.status === "success";
}

async function printUsers() {
  const state = await fetchUsers(1);
  if (isSuccess(state)) {
    // TypeScript narrows to SuccessState<User[]>
    console.log("Total users:", state.total);
    state.data.forEach((u) => console.log(u.name));
  }
}
```

### Step-by-Step Explanation
1. **Discriminant property**: Every member of the union must have a LITERAL type for the shared property (the discriminant). Here `status: "loading"` | `"success"` | `"error"` are all literal string types. TypeScript uses this to uniquely identify which union member applies.
2. **Narrowing via `switch` or `if`**: Once you check `state.status === "success"`, TypeScript's control flow narrows the type from `ApiState<T>` down to `SuccessState<T>`. All properties unique to that state become available with full type safety.
3. **No `undefined` checks needed**: Without discriminated unions, you might define `{ data?: User[]; error?: Error; isLoading: boolean }` and manually check `if (data !== undefined)`. With discriminated unions, TypeScript guarantees which properties exist in each branch.
4. **Exhaustiveness checking**: The `default: const _: never = state` pattern ensures that if you add a new union member (e.g., `RefreshingState`) but forget to add a `case` for it, TypeScript emits a compile error because `state` would not be `never` in the default branch.
5. **Generic discriminated unions**: `ApiState<T>` makes the success payload generic. You reuse the same state machine pattern for any resource type (`User[]`, `Product`, `Order`).
6. **Real-world applications**: React data fetching hooks, Redux action types, event systems (WebSocket message types), parser AST nodes, compiler IR nodes.

### Complexity

| Aspect | Without disc. union | With disc. union |
|---------------------------|---------------------|------------------|
| Type safety in branches | Optional prop checks | Guaranteed narrow |
| Risk of missing state | High | Compile error |
| Code readability | if/else with undefs | switch on literal |
| Exhaustiveness guarantee | Manual | Compiler-enforced |
| Generic payload support | Casting needed | Built-in generics |

## Q128: What is the `infer` keyword in TypeScript, and how do you implement `ReturnType<T>` from scratch?

### ELI5
`infer` is TypeScript's way of saying "match this pattern and capture the type that goes here into a variable". It is only used inside conditional types. Think of it like a regex capture group: you write a pattern (`T extends (...args: any[]) => infer R`), and TypeScript "fills in" what `R` must be based on the actual type `T`. If the pattern matches, you get `R`. Use this to extract hidden type information -- like "what does this function return?" or "what is the first argument of this function?".

### Visual Diagram
```
  Conditional type with infer:

  T extends (...args: any[]) => infer R
  |         |                    |
  |         pattern to match     captured type variable
  |                              "R" = the return type
  the type we are checking

  Examples:

  T = () => string
  T extends () => infer R          R = string   -> resolves to string

  T = (x: number) => boolean
  T extends (...args: any[]) => infer R    R = boolean  -> resolves to boolean

  T = string  (not a function)
  T extends (...args: any[]) => infer R    no match -> resolves to never

  Multiple infers:
  T extends (first: infer F, ...rest: infer Rest) => any
      F = first arg type
      Rest = rest args as tuple
```

### Code Example
```typescript
// ============================================================
// Build ReturnType<T> from scratch using infer
// ============================================================

type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
//                               ^-- function pattern    ^-- captured return type

// Test it:
function greet(name: string): string {
  return `Hello, ${name}!`;
}

function add(a: number, b: number): number {
  return a + b;
}

async function fetchUser(id: number): Promise<{ name: string; age: number }> {
  return { name: "Alice", age: 30 };
}

type T1 = MyReturnType<typeof greet>;   // string
type T2 = MyReturnType<typeof add>;     // number
type T3 = MyReturnType<typeof fetchUser>; // Promise<{ name: string; age: number }>
type T4 = MyReturnType<string>;         // never (string is not a function)

// ============================================================
// More infer patterns
// ============================================================

// Extract the first argument type
type FirstArg<T> = T extends (first: infer F, ...args: any[]) => any ? F : never;

type FA1 = FirstArg<(x: number, y: string) => void>; // number
type FA2 = FirstArg<() => void>;                      // never

// Extract Promise<T>'s inner type (unwrap a promise)
type Awaited_<T> = T extends Promise<infer U> ? Awaited_<U> : T;
// (TypeScript 4.5+ has built-in Awaited<T> but this shows the technique)

type A1 = Awaited_<Promise<string>>;                  // string
type A2 = Awaited_<Promise<Promise<number>>>;         // number (recursive!)
type A3 = Awaited_<string>;                           // string (not a promise)

// Extract array element type
type ElementType<T> = T extends (infer U)[] ? U : never;

type E1 = ElementType<string[]>;   // string
type E2 = ElementType<number[]>;   // number
type E3 = ElementType<string>;     // never

// ============================================================
// Practical: PromiseReturnType -- unwrap async function return
// ============================================================

type AsyncReturnType<T extends (...args: any[]) => Promise<any>> =
  T extends (...args: any[]) => Promise<infer R> ? R : never;

type FetchuserResult = AsyncReturnType<typeof fetchUser>;
// { name: string; age: number }  (Promise wrapper removed)

// ============================================================
// Practical: extract constructor parameter types
// ============================================================

type ConstructorParams<T> = T extends new (...args: infer P) => any ? P : never;

class MyService {
  constructor(public db: string, public port: number) {}
}

type ServiceParams = ConstructorParams<typeof MyService>;
// [db: string, port: number]  (tuple of constructor arguments)
```

### Step-by-Step Explanation
1. **`infer` is only valid inside conditional types**: `T extends SomePattern<infer X> ? X : never`. Outside a conditional type, `infer` is a syntax error. The pattern on the left of `extends` describes the shape you expect, with `infer X` as a placeholder that captures the "unknown" part.
2. **How TypeScript resolves it**: When evaluating `MyReturnType<typeof greet>`, TypeScript checks: does `typeof greet` (which is `(name: string) => string`) match `(...args: any[]) => infer R`? Yes -- so `R` is inferred as `string`, and the conditional resolves to `string`.
3. **`never` for non-matches**: If `T` does not match the pattern, TypeScript takes the `else` branch. Using `never` as the fallback means "this type cannot exist" -- which is semantically correct (a non-function has no return type).
4. **Union distribution**: If `T` is a union, the conditional type distributes over each member. `MyReturnType<(() => string) | (() => number)>` becomes `string | number`.
5. **Multiple `infer` in one type**: You can use multiple `infer` variables in a single pattern: `T extends (a: infer A, b: infer B) => infer R`. Each captures a different part of the matched type.
6. **Built-in utilities that use `infer`**: TypeScript's own `ReturnType<T>`, `InstanceType<T>`, `Parameters<T>`, `ConstructorParameters<T>`, and `Awaited<T>` are all implemented using `infer`. Understanding `infer` lets you build your own custom extractors.

### Complexity

| Pattern | What it extracts |
|---------------------------------|------------------------|
| `T extends () => infer R` | Return type |
| `T extends (infer A, ...) => any` | First parameter |
| `T extends (...args: infer P) => any` | All params as tuple |
| `T extends Promise<infer U>` | Promise inner type |
| `T extends (infer U)[]` | Array element type |
| `T extends new (...args: infer P) => any` | Constructor params |

## Q129: What are the differences between `Partial`, `Required`, `Pick`, `Omit`, and `Record` in TypeScript?

### ELI5
These are TypeScript's built-in "transformer" utilities -- they take an existing type and produce a new one. Partial makes everything optional. Required makes everything mandatory. Pick keeps only the keys you name. Omit removes the keys you name. Record builds an object type from a set of keys. Think of them as scissors, glue, and highlighters for your types -- you take an existing shape and reshape it without rewriting from scratch.

### Visual Diagram
```
  Original: User = { id: number; name: string; email: string; age?: number }

  Partial<User>         Required<User>        Pick<User,"id"|"name">
  ---------------       ---------------       ----------------------
  {                     {                     {
    id?:    number        id:    number          id:   number
    name?:  string        name:  string          name: string
    email?: string        email: string        }
    age?:   number        age:   number        -- only named keys kept
  }                     }
  -- all optional       -- age is now required

  Omit<User,"age">      Record<"a"|"b","val">
  ----------------      ---------------------
  {                     {
    id:    number         a: "val"
    name:  string         b: "val"
    email: string       }
  }                     -- builds object from
  -- age removed          key union + value type
```

### Code Example
```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
  role: "admin" | "user" | "viewer";
}

// ============================================================
// Partial<T> -- make all properties optional
// ============================================================
// Implementation: { [K in keyof T]?: T[K] }

type UpdateUserDto = Partial<User>;
// All fields become optional -- great for PATCH request bodies
function updateUser(id: number, dto: Partial<User>) {
  // only the provided fields are updated
}
updateUser(1, { name: "Bob" });           // OK -- only name
updateUser(1, { email: "b@example.com" }); // OK -- only email

// ============================================================
// Required<T> -- make all properties required (remove ?)
// ============================================================
// Implementation: { [K in keyof T]-?: T[K] }
// The -? modifier removes optionality

type StrictUser = Required<User>;
// age is now number (not number | undefined)

// ============================================================
// Pick<T, K> -- keep only named keys
// ============================================================
// Implementation: { [P in K]: T[P] }

type UserSummary = Pick<User, "id" | "name">;
// { id: number; name: string }

// Great for API responses that expose only safe fields
function getUserSummary(user: User): UserSummary {
  return { id: user.id, name: user.name };
}

// ============================================================
// Omit<T, K> -- remove named keys
// ============================================================
// Implementation: Pick<T, Exclude<keyof T, K>>

type CreateUserDto = Omit<User, "id">;
// { name: string; email: string; age?: number; role: "admin"|"user"|"viewer" }
// id is excluded because it is DB-generated

function createUser(dto: CreateUserDto): User {
  return { id: Math.random(), ...dto };
}

// Combining Omit + Partial for update DTOs:
type PatchUserDto = Partial<Omit<User, "id">>;
// id is required, all others optional

// ============================================================
// Record<K, V> -- build object type from key union + value type
// ============================================================
// Implementation: { [P in K]: V }

// Map role to permission set
type RolePermissions = Record<"admin" | "user" | "viewer", string[]>;
const permissions: RolePermissions = {
  admin:  ["read", "write", "delete"],
  user:   ["read", "write"],
  viewer: ["read"],
};

// Map user IDs to user objects (cache)
type UserCache = Record<number, User>;
const cache: UserCache = {};
cache[1] = { id: 1, name: "Alice", email: "a@e.com", role: "admin" };

// Record with string keys (like a dictionary)
type HttpHeaders = Record<string, string>;
const headers: HttpHeaders = {
  "Content-Type": "application/json",
  Authorization:  "Bearer abc123",
};

// ============================================================
// Composition patterns in real code
// ============================================================

// Request/response shaping for an API
type CreateRequest  = Omit<User, "id">;
type UpdateRequest  = Partial<Omit<User, "id">>;
type UserResponse   = Omit<User, "role">;        // don't expose role externally
type AdminResponse  = User;                      // admin sees everything

// Lookup tables
type StatusMessages = Record<"success" | "error" | "pending", string>;
const messages: StatusMessages = {
  success: "Operation completed",
  error:   "Something went wrong",
  pending: "Processing...",
};
```

### Step-by-Step Explanation
1. **`Partial<T>`**: Adds `?` to every key using the mapped type modifier. Useful for PATCH endpoints where only changed fields are sent. Internally: `{ [K in keyof T]?: T[K] }`.
2. **`Required<T>`**: Removes `?` from every key using the `-?` (remove optional) modifier. Forces all fields to be provided. The `-?` syntax is unique to mapped types.
3. **`Pick<T, K>`**: Creates a new type with ONLY the keys listed in `K`. `K` must be a subset of `keyof T`. Great for projecting large types into smaller DTOs or exposing only safe fields.
4. **`Omit<T, K>`**: The inverse of `Pick`. Creates a new type with the listed keys REMOVED. Internally implemented as `Pick<T, Exclude<keyof T, K>>` -- it picks everything except the omitted keys.
5. **`Record<K, V>`**: Creates an object type where ALL keys come from `K` (usually a string literal union) and ALL values are type `V`. Unlike an index signature `{ [key: string]: V }`, `Record<"a"|"b", V>` is exhaustive -- you MUST provide both `a` and `b`.
6. **Composition**: These utilities are most powerful when combined: `Partial<Omit<T, "id">>` (update DTO), `Required<Pick<T, "name"|"email">>` (required subset), `Record<Status, Message>` (exhaustive enum map).

### Complexity

| Utility | Keys affected | Optional change | Example use case |
|------------|---------------|-----------------|------------------------|
| Partial<T> | All keys | Adds ? | PATCH request body |
| Required<T> | All keys | Removes ? | Form validation model |
| Pick<T,K> | Named subset | Unchanged | Safe API response |
| Omit<T,K> | All except K | Unchanged | Create DTO without id |
| Record<K,V> | Defines keys | None (required) | Lookup / enum map |

## Q130: How do you write a generic function with constraints using `extends keyof` in TypeScript?

### ELI5
Imagine you want a function that reads a property from any object, but you want TypeScript to guarantee that the property actually exists on that object. Without constraints, TypeScript cannot verify this. `extends keyof` is the constraint: it says "K must be one of the known keys of T". This gives you a function where both the input key AND the return type are fully type-checked based on the actual object you pass in.

### Visual Diagram
```
  Generic function with constraint:

  function getProperty<T, K extends keyof T>(obj: T, key: K): T[K]
                        |   |                 |    |          |
                        |   K must be a key of T   |          return type =
                        |                      actual object   value at key K
                        T = type of object

  Example:
    const user = { id: 1, name: "Alice", age: 30 };
    getProperty(user, "name")  -> TypeScript knows return is string
    getProperty(user, "id")    -> TypeScript knows return is number
    getProperty(user, "xyz")   -> COMPILE ERROR: "xyz" not in keyof typeof user

  Without constraint:          With constraint:
  function get(obj, key) {     function get<T, K extends keyof T>(
    return obj[key];             obj: T, key: K
  }                            ): T[K] { return obj[key]; }
  -- return type: any          -- return type: exactly T[K]
```

### Code Example
```typescript
// ============================================================
// Basic: getProperty with extends keyof
// ============================================================

function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
  // TypeScript knows: obj[key] is exactly T[K] -- fully typed
}

const user = { id: 1, name: "Alice", age: 30, active: true };

const name   = getProperty(user, "name");   // type: string
const id     = getProperty(user, "id");     // type: number
const active = getProperty(user, "active"); // type: boolean

// getProperty(user, "xyz"); // ERROR: Argument of type '"xyz"' is not assignable
//                           // to parameter of type '"id" | "name" | "age" | "active"'

// ============================================================
// setProperty -- write a value, ensuring the value type matches
// ============================================================

function setProperty<T, K extends keyof T>(obj: T, key: K, value: T[K]): void {
  obj[key] = value;
}

setProperty(user, "name", "Bob");   // OK -- value is string
setProperty(user, "age", 25);       // OK -- value is number
// setProperty(user, "age", "25"); // ERROR -- string is not number

// ============================================================
// pluck: extract multiple properties by key array
// ============================================================

function pluck<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    result[key] = obj[key];
  }
  return result;
}

const summary = pluck(user, ["id", "name"]);
// summary: { id: number; name: string }
// summary.age would be a TypeScript error

// ============================================================
// Practical: safe event emitter with typed events
// ============================================================

interface AppEvents {
  login:   { userId: number; timestamp: Date };
  logout:  { userId: number };
  error:   { message: string; code: number };
}

class TypedEmitter<Events extends Record<string, unknown>> {
  private handlers: {
    [K in keyof Events]?: Array<(payload: Events[K]) => void>;
  } = {};

  // K extends keyof Events ensures only valid event names are used
  on<K extends keyof Events>(
    event: K,
    handler: (payload: Events[K]) => void
  ): void {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event]!.push(handler);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.handlers[event]?.forEach((h) => h(payload));
  }
}

const emitter = new TypedEmitter<AppEvents>();

// TypeScript knows the shape of each event's payload
emitter.on("login", ({ userId, timestamp }) => {
  console.log(`User ${userId} logged in at ${timestamp}`);
});

emitter.emit("login", { userId: 42, timestamp: new Date() }); // OK
// emitter.emit("login", { userId: "wrong" });                 // ERROR: userId must be number
// emitter.on("typo", () => {});                               // ERROR: "typo" not in AppEvents

// ============================================================
// Utility: pick with type inference from a list of keys
// ============================================================

function selectFields<T extends object, K extends keyof T>(
  records: T[],
  fields: K[]
): Pick<T, K>[] {
  return records.map((r) => pluck(r, fields));
}

const users: typeof user[] = [user, { id: 2, name: "Bob", age: 25, active: false }];
const summaries = selectFields(users, ["id", "name"]);
// summaries: Array<{ id: number; name: string }>
```

### Step-by-Step Explanation
1. **`keyof T` produces a union of all keys**: For `{ id: number; name: string }`, `keyof T` is `"id" | "name"`. This is the key set TypeScript uses for property access checks.
2. **`K extends keyof T` constrains the type parameter**: Without this constraint, `K` could be any type, including `"xyz"` which does not exist on `T`. With the constraint, TypeScript validates the key at compile time.
3. **`T[K]` is an indexed access type**: Once TypeScript knows `K extends keyof T`, it can look up the value type at key `K` using `T[K]`. If `K` is `"name"` and `T["name"]` is `string`, the return type becomes exactly `string`.
4. **Generic inference**: TypeScript infers both `T` and `K` from the call site. When you write `getProperty(user, "name")`, TypeScript infers `T = typeof user` and `K = "name"`, automatically narrowing the return type to `string`.
5. **Mapped types extend this pattern**: The same technique powers `Pick<T, K>`: `{ [P in K]: T[P] }` where `K extends keyof T`. The constraint ensures only valid keys can be used.
6. **Real applications**: Type-safe property accessors, generic form field handlers, event systems, ORM field projection (SELECT specific columns), Redux selector utilities.

### Complexity

| Pattern | Safety | Return Type | Notes |
|------------------------------------------|---------|-------------|-------|
| `function get(obj: any, key: string)` | None | any | Unsafe |
| `function get<T>(obj: T, key: keyof T)` | Key safe | T[keyof T] | Widened return |
| `function get<T, K extends keyof T>` | Full | T[K] | Exact return type |
| Mapped `{ [K in keyof T]: T[K] }` | Full | Per-key | Most flexible |

## Q131: How do you use `as const` in TypeScript to derive a union type from a const array?

### ELI5
Normally when you write `const directions = ["left", "right", "up", "down"]`, TypeScript infers the type as `string[]` -- too wide. `as const` tells TypeScript "freeze this -- every value is its exact literal type, and the array is read-only". Now TypeScript knows the array is exactly `["left", "right", "up", "down"]` and you can extract `"left" | "right" | "up" | "down"` from it. This means you define your source of truth ONCE as a const array and derive both the runtime array and the compile-time union type from it -- no duplication.

### Visual Diagram
```
  Without as const:
    const directions = ["left", "right", "up", "down"];
    type:  string[]    <-- too wide, loses literal info

  With as const:
    const directions = ["left", "right", "up", "down"] as const;
    type:  readonly ["left", "right", "up", "down"]   <-- exact tuple
    [number]:  "left" | "right" | "up" | "down"       <-- union via [number]

  Deriving the union:
    type Direction = (typeof directions)[number];
    // = "left" | "right" | "up" | "down"

  Object as const:
    const STATUS = { ACTIVE: "active", INACTIVE: "inactive" } as const;
    type Status = (typeof STATUS)[keyof typeof STATUS];
    // = "active" | "inactive"
```

### Code Example
```typescript
// ============================================================
// Basic: array as const + union derivation
// ============================================================

const DIRECTIONS = ["left", "right", "up", "down"] as const;
// Type: readonly ["left", "right", "up", "down"]

// Derive the union type from the array
type Direction = (typeof DIRECTIONS)[number];
// = "left" | "right" | "up" | "down"

function move(direction: Direction): void {
  console.log(`Moving ${direction}`);
}

move("left");   // OK
move("right");  // OK
// move("diagonal"); // ERROR: not in union

// DIRECTIONS is also usable at runtime as the canonical list
const isValidDirection = (s: string): s is Direction =>
  (DIRECTIONS as readonly string[]).includes(s);

// ============================================================
// Object as const + value union
// ============================================================

const HTTP_STATUS = {
  OK:                  200,
  CREATED:             201,
  BAD_REQUEST:         400,
  UNAUTHORIZED:        401,
  NOT_FOUND:           404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Derive key union
type HttpStatusKey = keyof typeof HTTP_STATUS;
// = "OK" | "CREATED" | "BAD_REQUEST" | ...

// Derive value union
type HttpStatusCode = (typeof HTTP_STATUS)[HttpStatusKey];
// = 200 | 201 | 400 | 401 | 404 | 500

function handleStatus(code: HttpStatusCode): string {
  if (code === HTTP_STATUS.OK) return "Success";
  if (code === HTTP_STATUS.NOT_FOUND) return "Not found";
  return "Other";
}

// ============================================================
// Practical: route definitions (React Router / Express)
// ============================================================

const ROUTES = {
  HOME:       "/",
  USERS:      "/users",
  USER_DETAIL: "/users/:id",
  SETTINGS:   "/settings",
} as const;

type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
// = "/" | "/users" | "/users/:id" | "/settings"

// ============================================================
// Event names -- single source of truth
// ============================================================

const EVENTS = [
  "user:created",
  "user:updated",
  "user:deleted",
  "order:placed",
  "order:shipped",
] as const;

type AppEvent = (typeof EVENTS)[number];
// = "user:created" | "user:updated" | "user:deleted" | "order:placed" | "order:shipped"

// Typed event handler map
type EventHandlers = Partial<Record<AppEvent, () => void>>;

const handlers: EventHandlers = {
  "user:created": () => console.log("New user!"),
  "order:placed": () => console.log("New order!"),
};

// ============================================================
// Why this is better than a TypeScript enum
// ============================================================

// Enum problem: numeric enums have weird runtime behavior
enum Direction2 { Left, Right, Up, Down }
Direction2[0]; // "Left" -- reverse mapping, can be surprising

// as const gives you simple string/number literals:
// - no reverse mapping
// - trees-shakeable (const arrays are just JS arrays)
// - the values ARE the types -- no extra indirection
// - works with JSON serialization naturally
```

### Step-by-Step Explanation
1. **Without `as const`, literals widen**: TypeScript widens `"left"` to `string` and `[...]` to `string[]` by default for mutability. `as const` tells the compiler to treat every literal as its narrowest possible type and mark the structure as `readonly`.
2. **`(typeof ARRAY)[number]`**: `typeof ARRAY` gives the tuple type `readonly ["left", "right", ...]`. Indexing it with `number` produces the union of all element types. This is the standard pattern for deriving unions from const arrays.
3. **`(typeof OBJ)[keyof typeof OBJ]`**: For objects, `keyof typeof OBJ` gives the key union. Indexing the object type with that union gives the value union. Both keys and values can be extracted this way.
4. **Single source of truth**: You define the array/object ONCE. The runtime array is used for iteration, validation, and rendering. The derived type is used for type-checking. No need to maintain a separate `type Direction = "left" | "right" | ...` definition.
5. **`as const` vs `enum`**: TypeScript enums have quirks -- numeric enums have reverse mapping, `const enum` inlines values but breaks across module boundaries, and both add runtime weight. `as const` gives you simple literal unions with zero runtime overhead beyond the array/object itself.
6. **`readonly` arrays**: `as const` marks arrays as `readonly`. If you need a mutable copy, spread it: `[...DIRECTIONS]`. Pass `as readonly string[]` to functions that only read.

### Complexity

| Approach | Single source | Runtime usable | Type safety | Tree-shakeable |
|---------------------|---------------|----------------|-------------|----------------|
| Explicit union type | No (2 places) | No | YES | N/A |
| TypeScript enum | YES | YES | YES | No |
| as const array | YES | YES | YES | YES |
| as const object | YES | YES | YES | YES |

## Q132: How do you write a `Getters<T>` mapped type in TypeScript?

### ELI5
A mapped type takes every key in an existing type and transforms it -- changing the key name, value type, or adding/removing modifiers. `Getters<T>` is a mapped type that takes every property of `T` and produces a new type where each property becomes a getter function (`getName()` instead of `name`). This is a common pattern in Vue 3 (computed getters), class-based designs, and proxy wrappers. It shows how mapped types can reshape a whole type without listing keys manually.

### Visual Diagram
```
  Input type T:         Getters<T>:
  -------------         -----------
  {                     {
    name: string   -->    getName: () => string
    age:  number   -->    getAge:  () => number
    active: boolean -->   getActive: () => boolean
  }                     }

  Mapped type formula:
    { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] }
    |         |                  |                              |
    iterates  |    key remapping with template literal          value: function
    all keys  original key capitalized and prefixed with "get"
```

### Code Example
```typescript
// ============================================================
// Getters<T> mapped type
// ============================================================

// Capitalize<S> is a built-in TypeScript string manipulation type
// It uppercases the first character: Capitalize<"name"> = "Name"

type Getters<T> = {
  // Key remapping with "as" clause:
  // - iterate over every key K in T
  // - remap it to `get${Capitalize<string & K>}` (e.g. "name" -> "getName")
  // - value type: a zero-argument function returning T[K]
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

// ============================================================
// Usage
// ============================================================

interface User {
  name: string;
  age: number;
  email: string;
  active: boolean;
}

type UserGetters = Getters<User>;
// Equivalent to:
// {
//   getName:   () => string;
//   getAge:    () => number;
//   getEmail:  () => string;
//   getActive: () => boolean;
// }

// ============================================================
// Runtime implementation of the mapped type
// ============================================================

function createGetters<T extends object>(obj: T): Getters<T> {
  const getters = {} as Getters<T>;

  for (const key of Object.keys(obj) as (keyof T & string)[]) {
    const getterName = `get${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof Getters<T>;
    // Assign a function that reads the CURRENT value of obj[key]
    (getters as Record<string, unknown>)[getterName as string] = () => obj[key];
  }

  return getters;
}

const user: User = { name: "Alice", age: 30, email: "a@e.com", active: true };
const userGetters = createGetters(user);

console.log(userGetters.getName());   // "Alice"
console.log(userGetters.getAge());    // 30
console.log(userGetters.getEmail());  // "a@e.com"
console.log(userGetters.getActive()); // true

// ============================================================
// Variations: Setters<T>
// ============================================================

type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

type UserSetters = Setters<User>;
// {
//   setName:   (value: string)  => void;
//   setAge:    (value: number)  => void;
//   setEmail:  (value: string)  => void;
//   setActive: (value: boolean) => void;
// }

// ============================================================
// Variation: MethodMap -- wrap values in functions (Vue-style reactive)
// ============================================================

// Filter only certain value types (only wrapping primitives)
type PrimitiveKeys<T> = {
  [K in keyof T]: T[K] extends string | number | boolean ? K : never;
}[keyof T];

type GettersPrimitive<T> = {
  [K in PrimitiveKeys<T> as `get${Capitalize<string & K>}`]: () => T[K];
};

// ============================================================
// Variation: remove optional + prefix with "get"
// ============================================================

type RequiredGetters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]-?: () => NonNullable<T[K]>;
};
```

### Step-by-Step Explanation
1. **Standard mapped type**: `{ [K in keyof T]: T[K] }` is the identity mapped type -- iterates all keys, value stays the same. Adding a transformation to the key or value makes it useful.
2. **Key remapping with `as`**: TypeScript 4.1+ supports `[K in keyof T as NewKey]` syntax. `NewKey` can be any template literal type. `as false` or `as never` removes the key entirely (filtering).
3. **`Capitalize<S>`**: A built-in intrinsic string type that uppercases the first character. `Capitalize<"name">` = `"Name"`. This is what enables `getname` -> `getName`.
4. **`string & K`**: `keyof T` can be `string | number | symbol`. `string & K` narrows it to only string keys, which is necessary for template literal interpolation.
5. **Value type `() => T[K]`**: The value at each key becomes a zero-argument function that returns `T[K]`. TypeScript inferences the exact return type per key.
6. **Real applications**: Vue 3 computed property maps, Proxy handler generators, ORM column accessor builders, mock/spy factory utilities (generate getter stubs for testing), code generation tools.

### Complexity

| Mapped type pattern | Key transform | Value transform | Filtering |
|-----------------------------|----------------|-----------------|-----------|
| Identity `[K in keyof T]` | None | None | No |
| Getters<T> | Prefix + Capitalize | Wrap in fn | No |
| Setters<T> | Prefix + Capitalize | Add param | No |
| Optional keys filter | None | None | Yes (as never) |
| Readonly<T> | None | Add readonly | No |
| Mutable<T> | None | Remove readonly | No |

## Q133: What are template literal types in TypeScript and what is a real-world use case?

### ELI5
Template literal types are like template strings (backtick strings) but for TYPES. Instead of building a string at runtime like `"get" + "Name"`, you build a TYPE like `` `get${Capitalize<K>}` `` at compile time. TypeScript evaluates this and produces the exact string literal type (or a union of them). The real power is that when you combine template literals with unions, TypeScript automatically creates the cross-product of all combinations -- so `` `${"left"|"right"}_${"top"|"bottom"}` `` produces `"left_top" | "left_bottom" | "right_top" | "right_bottom"` with zero manual work.

### Visual Diagram
```
  Basic template literal type:
    type Greeting = `Hello, ${string}`;
    // matches: "Hello, Alice", "Hello, Bob", "Hello, " etc.

  Union cross-product:
    type Side   = "top" | "bottom";
    type Axis   = "left" | "right";
    type Corner = `${Axis}_${Side}`;
    // = "left_top" | "left_bottom" | "right_top" | "right_bottom"

  With mapped type (Getters pattern from Q132):
    type Getters<T> = {
      [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K]
    }

  CSS property completions:
    type CSSProperty = `margin-${"top"|"right"|"bottom"|"left"}`;
    // = "margin-top" | "margin-right" | "margin-bottom" | "margin-left"

  Event listener type safety:
    type EventName<T extends string> = `on${Capitalize<T>}`;
    EventName<"click">  = "onClick"
    EventName<"submit"> = "onSubmit"
```

### Code Example
```typescript
// ============================================================
// Basic template literal types
// ============================================================

type Greeting = `Hello, ${string}`;
const g1: Greeting = "Hello, Alice";   // OK
const g2: Greeting = "Hello, World";   // OK
// const g3: Greeting = "Hi there";    // ERROR

// Union cross-product
type Direction = "top" | "right" | "bottom" | "left";
type CSSPadding = `padding-${Direction}`;
// = "padding-top" | "padding-right" | "padding-bottom" | "padding-left"

// ============================================================
// REAL-WORLD USE CASE: Type-safe CSS-in-JS style builder
// ============================================================

type StyleValue = string | number;
type SpacingProp = `${"margin"|"padding"}-${"top"|"right"|"bottom"|"left"}`;

// This generates 8 exact property names:
// "margin-top" | "margin-right" | "margin-bottom" | "margin-left"
// "padding-top" | "padding-right" | "padding-bottom" | "padding-left"

type SpacingStyles = Partial<Record<SpacingProp, StyleValue>>;

function applySpacing(styles: SpacingStyles): Record<string, StyleValue> {
  return styles as Record<string, StyleValue>;
}

applySpacing({ "margin-top": 16, "padding-left": "auto" }); // OK
// applySpacing({ "border-top": 1 });  // ERROR: "border-top" not in SpacingProp

// ============================================================
// REAL-WORLD USE CASE: Type-safe event bus
// ============================================================

type EntityEvent<
  Entity extends string,
  Action extends "created" | "updated" | "deleted"
> = `${Entity}:${Action}`;

type UserEvents  = EntityEvent<"user", "created" | "updated" | "deleted">;
type OrderEvents = EntityEvent<"order", "created" | "updated" | "deleted">;
type AppEvents2  = UserEvents | OrderEvents;
// = "user:created" | "user:updated" | "user:deleted"
//   | "order:created" | "order:updated" | "order:deleted"

// Extract entity from event name
type ExtractEntity<T extends string> =
  T extends `${infer Entity}:${string}` ? Entity : never;

type E = ExtractEntity<AppEvents2>;
// = "user" | "order"

// Extract action from event name
type ExtractAction<T extends string> =
  T extends `${string}:${infer Action}` ? Action : never;

type A = ExtractAction<AppEvents2>;
// = "created" | "updated" | "deleted"

// ============================================================
// REAL-WORLD USE CASE: Type-safe i18n translation keys
// ============================================================

type Translations = {
  "user.name": string;
  "user.email": string;
  "order.id": string;
  "order.total": string;
};

// Build a type that only allows valid translation keys starting with a namespace
type NamespaceKeys<
  T extends Record<string, string>,
  NS extends string
> = {
  [K in keyof T]: K extends `${NS}.${string}` ? K : never;
}[keyof T];

type UserTranslationKeys  = NamespaceKeys<Translations, "user">;
// = "user.name" | "user.email"

type OrderTranslationKeys = NamespaceKeys<Translations, "order">;
// = "order.id" | "order.total"

// ============================================================
// String intrinsic utilities
// ============================================================

type U = Uppercase<"hello">;     // "HELLO"
type L = Lowercase<"WORLD">;     // "world"
type C = Capitalize<"alice">;    // "Alice"
type UC = Uncapitalize<"Alice">; // "alice"

// Combine with mapped types:
type UppercaseKeys<T> = {
  [K in keyof T as Uppercase<string & K>]: T[K];
};

interface Config { host: string; port: number }
type UpperConfig = UppercaseKeys<Config>;
// { HOST: string; PORT: number }
```

### Step-by-Step Explanation
1. **Syntax**: Template literal types use the same syntax as JavaScript template strings but appear in type position: `` type T = `prefix_${OtherType}` ``. The interpolated type can be any string/number/boolean literal type or union.
2. **Union distribution**: When you interpolate a union, TypeScript automatically creates the cross-product. `` type T = `${"a"|"b"}_${"x"|"y"}` `` produces `"a_x" | "a_y" | "b_x" | "b_y"` -- four types, generated automatically.
3. **`infer` inside template literals**: You can use `infer` inside template literal patterns to extract portions of a string type: `` T extends `prefix_${infer Rest}` ? Rest : never ``. This is powerful for parsing event names, route params, namespace keys.
4. **Built-in string utilities**: TypeScript ships `Uppercase<S>`, `Lowercase<S>`, `Capitalize<S>`, `Uncapitalize<S>` -- all work only at the type level for string literal types.
5. **Mapped type + template literal = code generation equivalent**: The `Getters<T>` pattern from Q132 is template literals + mapped types working together. It generates an entire type (with N methods) from a single declaration.
6. **Real applications**: CSS property names, i18n translation key systems, event bus type safety, URL route generation, API endpoint naming conventions, Redux action type constants.

### Complexity

| Feature | Compile-time | Runtime | Notes |
|----------------------------|--------------|---------|-------|
| Template literal type | YES | No | Type-only |
| Union cross-product | YES | No | Auto-generated |
| infer in template | YES | No | Type extraction |
| String intrinsics | YES | No | Uppercase etc. |
| Mapped + template combo | YES | Runtime object | Most powerful |

## Q134: How do you implement a type-safe Builder pattern in TypeScript?

### ELI5
The Builder pattern lets you build a complex object step by step instead of passing all values at once to a constructor. The problem with a naive builder in TypeScript is that you could call `.build()` before setting required fields -- and TypeScript would not catch it. A type-safe Builder uses TypeScript's type system to track WHICH fields have been set. If a required field is missing, calling `.build()` is a compile-time error. It is like a checklist: TypeScript enforces you tick every required box before finalising the object.

### Visual Diagram
```
  Naive builder (unsafe):          Type-safe builder:
  ----------------------           -----------------
  new QueryBuilder()               new QueryBuilder()
    .setTable("users")               .setTable("users")     <- tracks "table" set
    .build()            OK           .build()               <- COMPILE ERROR
    // missing WHERE --              // "where" not set yet!
    // runtime error possible

  Type parameter tracks progress:
    QueryBuilder<{}>               -> no fields set
    .setTable("users")
    QueryBuilder<{ table: true }>  -> "table" is recorded
    .setWhere("id = 1")
    QueryBuilder<{ table: true, where: true }> -> both set
    .build()                       -> OK (all required fields present)
```

### Code Example
```typescript
// ============================================================
// Type-safe SQL Query Builder
// ============================================================

// A phantom type parameter T tracks which fields have been set.
// We use an object type where keys are "set" fields.

type Has<T, K extends string> = K extends keyof T ? true : false;

// The builder class carries a phantom type T (never used at runtime)
// that records which methods have been called.
class QueryBuilder<T extends object = {}> {
  private table_: string = "";
  private where_: string = "";
  private columns_: string[] = ["*"];
  private limit_: number | undefined;

  // setTable is always available, but after calling it, the returned type
  // has "table" in T -- recording that the table has been set.
  setTable(table: string): QueryBuilder<T & { table: true }> {
    this.table_ = table;
    return this as unknown as QueryBuilder<T & { table: true }>;
  }

  setColumns(columns: string[]): QueryBuilder<T & { columns: true }> {
    this.columns_ = columns;
    return this as unknown as QueryBuilder<T & { columns: true }>;
  }

  setWhere(where: string): QueryBuilder<T & { where: true }> {
    this.where_ = where;
    return this as unknown as QueryBuilder<T & { where: true }>;
  }

  setLimit(limit: number): QueryBuilder<T & { limit: true }> {
    this.limit_ = limit;
    return this as unknown as QueryBuilder<T & { limit: true }>;
  }

  // build() is ONLY available when BOTH "table" and "where" are set.
  // TypeScript enforces this via the conditional type on T.
  build(
    this: Has<T, "table"> extends true
      ? Has<T, "where"> extends true
        ? this
        : "ERROR: call setWhere() before build()"
      : "ERROR: call setTable() before build()"
  ): string {
    const cols = this.columns_.join(", ");
    const whereClause = this.where_ ? ` WHERE ${this.where_}` : "";
    const limitClause = this.limit_ !== undefined ? ` LIMIT ${this.limit_}` : "";
    return `SELECT ${cols} FROM ${this.table_}${whereClause}${limitClause}`;
  }
}

// OK -- all required fields set
const query1 = new QueryBuilder()
  .setTable("users")
  .setWhere("active = true")
  .setColumns(["id", "name", "email"])
  .setLimit(10)
  .build();
// "SELECT id, name, email FROM users WHERE active = true LIMIT 10"

// ERROR at compile time -- missing setWhere
// new QueryBuilder()
//   .setTable("users")
//   .build();  // TypeScript error: 'this' context is wrong type

// ERROR at compile time -- missing setTable
// new QueryBuilder()
//   .setWhere("id = 1")
//   .build();  // TypeScript error

// ============================================================
// Simpler variation: using object accumulation
// ============================================================

// Alternative approach: builder returns new type on each call
interface EmailConfig {
  to: string;
  subject: string;
  body: string;
  cc?: string;
}

class EmailBuilder<T extends Partial<EmailConfig> = {}> {
  constructor(private config: T = {} as T) {}

  to(to: string): EmailBuilder<T & { to: string }> {
    return new EmailBuilder({ ...this.config, to });
  }

  subject(subject: string): EmailBuilder<T & { subject: string }> {
    return new EmailBuilder({ ...this.config, subject });
  }

  body(body: string): EmailBuilder<T & { body: string }> {
    return new EmailBuilder({ ...this.config, body });
  }

  cc(cc: string): EmailBuilder<T & { cc: string }> {
    return new EmailBuilder({ ...this.config, cc });
  }

  // build() only available when to + subject + body are all set
  build(
    this: EmailBuilder<{ to: string; subject: string; body: string } & Partial<EmailConfig>>
  ): EmailConfig {
    return this.config as EmailConfig;
  }
}

const email = new EmailBuilder()
  .to("alice@example.com")
  .subject("Hello!")
  .body("Hi Alice, ...")
  .cc("bob@example.com")
  .build();

// const broken = new EmailBuilder()
//   .to("alice@example.com")
//   .build(); // ERROR: missing subject and body
```

### Step-by-Step Explanation
1. **Phantom type parameter**: The Builder class carries a type parameter `T` that is NEVER used by any actual variable at runtime -- it exists only at the type level. TypeScript uses it to track which fields have been configured.
2. **Intersection accumulation**: Each setter method returns `QueryBuilder<T & { fieldName: true }>`. The `&` adds a new "marker" to `T`. After calling `setTable`, `T` becomes `{ table: true }`. After `setWhere`, it becomes `{ table: true; where: true }`.
3. **Conditional `this` type on `build()`**: The `build()` method has a `this:` parameter that expresses the required type. If `T` does not have `table` and `where` properties, the `this` type is a string literal error message -- TypeScript cannot assign the actual `this` to a string, so it raises an error at the call site.
4. **Alternative immutable approach**: The `EmailBuilder` variation creates a new builder instance at each step (`new EmailBuilder({ ...this.config, to })`). This is immutable and allows branching (store intermediate builders for reuse).
5. **Runtime overhead**: The phantom type parameter `T` is completely erased at runtime -- `tsc` removes it. The runtime only sees the mutations or immutable object spreads. No performance penalty.
6. **Real applications**: SQL query builders (TypeORM, Knex), HTTP request builders (axios config chains), test fixture factories, configuration builders in serverless frameworks.

### Complexity

| Approach | Compile check | Immutable | Branching | Notes |
|---------------------------|---------------|-----------|-----------|-------|
| Naive builder (no type) | No | No | No | Unsafe |
| Phantom type + mutation | YES | No | No | Simple |
| Phantom type + new() | YES | YES | YES | Preferred |
| Zod schema (Q136) | YES | YES | YES | Runtime too |

## Q135: How do you share types between a React frontend and a Node.js backend in a monorepo?

### ELI5
In a monorepo (one Git repo, multiple packages), you have a React frontend and a Node.js backend. Both need to agree on the shape of data -- like what a User looks like, or what the API response format is. Instead of copying types into both projects (and getting them out of sync), you create a THIRD package that holds only shared types. Both the frontend and backend depend on it. When you change a type in one place, TypeScript immediately shows errors in every project that uses it -- preventing mismatches before they reach production.

### Visual Diagram
```
  Monorepo layout:

  /packages/
    shared-types/         <- single source of truth
      src/
        user.ts           <- User, UserRole, CreateUserDto
        order.ts          <- Order, OrderStatus
        api.ts            <- ApiResponse<T>, PaginatedResponse<T>
        index.ts          <- re-exports everything
      package.json        <- name: "@acme/shared-types"
      tsconfig.json

    frontend/             <- React app
      src/
        api/users.ts      <- imports User from "@acme/shared-types"
      package.json        <- deps: "@acme/shared-types": "workspace:*"
      tsconfig.json

    backend/              <- Node.js/Express
      src/
        routes/users.ts   <- imports User from "@acme/shared-types"
      package.json        <- deps: "@acme/shared-types": "workspace:*"
      tsconfig.json

  Change User in shared-types --> TypeScript errors in BOTH frontend + backend
```

### Code Example
```typescript
// ============================================================
// /packages/shared-types/src/user.ts
// ============================================================

export type UserRole = "admin" | "user" | "viewer";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string; // ISO 8601
}

// DTOs -- what the wire carries (no id on create)
export type CreateUserDto = Omit<User, "id" | "createdAt">;
export type UpdateUserDto = Partial<Omit<User, "id" | "createdAt">>;
export type UserSummary   = Pick<User, "id" | "name" | "email">;

// ============================================================
// /packages/shared-types/src/api.ts
// ============================================================

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  success: false;
  error: string;
  code: number;
  details?: Record<string, string[]>; // validation errors
}

// ============================================================
// /packages/shared-types/src/index.ts
// ============================================================

export * from "./user";
export * from "./api";
// export * from "./order";

// ============================================================
// /packages/backend/src/routes/users.ts  (Node.js/Express)
// ============================================================

import type { User, CreateUserDto, ApiResponse, PaginatedResponse } from "@acme/shared-types";
import express from "express";

const router = express.Router();

router.get("/users", async (req, res) => {
  const users: User[] = await getUsersFromDb();
  const response: PaginatedResponse<User> = {
    data: users,
    total: 100,
    page: 1,
    pageSize: 20,
    hasMore: true,
    success: true,
  };
  res.json(response);
  // TypeScript validates that response matches PaginatedResponse<User>
});

router.post("/users", async (req, res) => {
  const dto: CreateUserDto = req.body; // typed -- NOT any
  const user: User = await createUserInDb(dto);
  const response: ApiResponse<User> = { data: user, success: true };
  res.status(201).json(response);
});

// ============================================================
// /packages/frontend/src/api/users.ts  (React)
// ============================================================

import type { User, CreateUserDto, PaginatedResponse } from "@acme/shared-types";

async function fetchUsers(page: number): Promise<PaginatedResponse<User>> {
  const res = await fetch(`/api/users?page=${page}`);
  return res.json() as Promise<PaginatedResponse<User>>;
  // TypeScript knows the exact shape -- same type as backend response
}

async function createUser(dto: CreateUserDto): Promise<User> {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  const json = await res.json() as { data: User; success: boolean };
  return json.data;
}

// ============================================================
// /packages/shared-types/package.json
// ============================================================
/*
{
  "name": "@acme/shared-types",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
*/

// ============================================================
// Root package.json (pnpm/yarn/npm workspaces)
// ============================================================
/*
{
  "name": "acme-monorepo",
  "workspaces": ["packages/*"],
  "devDependencies": {
    "typescript": "^5.x"
  }
}
*/

// /packages/frontend/package.json:
// "dependencies": { "@acme/shared-types": "workspace:*" }

// /packages/backend/package.json:
// "dependencies": { "@acme/shared-types": "workspace:*" }
```

### Step-by-Step Explanation
1. **Monorepo structure**: Tools like pnpm workspaces, Yarn workspaces, npm workspaces, Nx, or Turborepo let you have multiple `packages/` in a single repo. Each package has its own `package.json` but they can reference each other using the `workspace:*` protocol.
2. **Shared-types package**: A minimal package that exports ONLY TypeScript interfaces, types, and enums -- no runtime code (or very little). It has a `tsconfig.json` that targets `declaration: true` so it emits `.d.ts` files.
3. **`workspace:*` dependency**: When you add `"@acme/shared-types": "workspace:*"` to a package, the package manager symlinks it to the local `packages/shared-types/` directory. No npm publish needed during development.
4. **Type import vs value import**: Use `import type { ... }` instead of `import { ... }` for types-only imports. This ensures zero runtime overhead and makes the intent clear. TypeScript 3.8+ supports `import type`.
5. **API contract enforcement**: When the backend changes `User.email` to `User.emailAddress`, TypeScript shows errors in BOTH the backend routes AND the frontend API calls immediately during compilation -- before any deployment.
6. **Build order in CI**: Shared-types must be built BEFORE frontend and backend. Turborepo/Nx handle this with dependency graphs. Configure `"dependsOn": ["^build"]` in `turbo.json` to ensure correct build order.

### Complexity

| Concern | Without shared types | With shared types package |
|------------------------|----------------------|--------------------------|
| Type consistency | Manual / copy-paste | Enforced by compiler |
| Mismatch detection | Runtime crash | Compile-time error |
| Refactoring safety | Error-prone | Compiler finds all usages |
| Build complexity | Simple | Needs build order |
| Team scalability | Breaks easily | Single source of truth |

## Q136: How does Zod infer TypeScript types from a schema, and when should you use it?

### ELI5
TypeScript types exist only at compile time -- they are erased when your code runs. Zod is a runtime validation library that lets you describe the shape of data ONCE and get BOTH a TypeScript type AND a runtime validator from the same declaration. When data arrives from an API, a form, or an environment variable, Zod parses it and either gives you a fully typed, validated object or throws a detailed error. Think of it as the missing link between the TypeScript type system and the real world of untrusted external data.

### Visual Diagram
```
  Without Zod:
    interface User { id: number; name: string; email: string }
    const data = JSON.parse(body) as User;  // <-- DANGEROUS: no runtime check
    data.name.toUpperCase();                // possible crash if name is missing

  With Zod:
    const UserSchema = z.object({
      id:    z.number(),
      name:  z.string(),
      email: z.string().email(),
    });

    type User = z.infer<typeof UserSchema>;
    // TypeScript type: { id: number; name: string; email: string }
    // SAME as writing an interface manually -- but also validates at runtime!

  Flow:
    Raw JSON string
        |
        v
    UserSchema.parse(data)
        |            |
        v            v
    Valid User   ZodError (with path + message per field)
    (typed)      thrown on invalid data
```

### Code Example
```typescript
import { z } from "zod";

// ============================================================
// Define schema + infer TypeScript type from it
// ============================================================

const UserRoleSchema = z.enum(["admin", "user", "viewer"]);
type UserRole = z.infer<typeof UserRoleSchema>;
// = "admin" | "user" | "viewer"

const UserSchema = z.object({
  id:        z.number().int().positive(),
  name:      z.string().min(1).max(100),
  email:     z.string().email(),
  role:      UserRoleSchema,
  age:       z.number().int().min(0).max(150).optional(),
  createdAt: z.string().datetime(), // ISO 8601 format
});

// Infer the TypeScript type -- no need to write an interface!
type User = z.infer<typeof UserSchema>;
// {
//   id: number;
//   name: string;
//   email: string;
//   role: "admin" | "user" | "viewer";
//   age?: number | undefined;
//   createdAt: string;
// }

// ============================================================
// Parse + validate at runtime
// ============================================================

// .parse() throws ZodError on invalid data
function parseUser(raw: unknown): User {
  return UserSchema.parse(raw); // throws if invalid
}

// .safeParse() returns { success: true, data } or { success: false, error }
function tryParseUser(raw: unknown): { ok: true; user: User } | { ok: false; errors: string[] } {
  const result = UserSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, user: result.data };
  }
  // result.error.issues is an array of { path, message } objects
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );
  return { ok: false, errors };
}

// ============================================================
// Express route with Zod validation
// ============================================================

const CreateUserSchema = UserSchema.omit({ id: true, createdAt: true });
type CreateUserDto = z.infer<typeof CreateUserSchema>;
// { name: string; email: string; role: "admin"|"user"|"viewer"; age?: number }

function createUserRoute(req: { body: unknown }, res: { status: (c: number) => { json: (d: unknown) => void } }) {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: "Validation failed",
      details: result.error.issues,
    });
    return;
  }
  const dto: CreateUserDto = result.data; // fully typed, validated
  // ... proceed to create user
  res.status(201).json({ id: 1, ...dto, createdAt: new Date().toISOString() });
}

// ============================================================
// Environment variable validation (very common use case)
// ============================================================

const EnvSchema = z.object({
  PORT:          z.string().transform(Number).pipe(z.number().int().min(1024)),
  DATABASE_URL:  z.string().url(),
  JWT_SECRET:    z.string().min(32),
  NODE_ENV:      z.enum(["development", "production", "test"]),
  LOG_LEVEL:     z.enum(["debug", "info", "warn", "error"]).default("info"),
});

type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:");
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    });
    process.exit(1);
  }
  return result.data;
}

const env = loadEnv();
// env.PORT is number (Zod transformed the string)
// env.NODE_ENV is "development" | "production" | "test"

// ============================================================
// Composable schemas
// ============================================================

const AddressSchema = z.object({
  street: z.string(),
  city:   z.string(),
  zip:    z.string().regex(/^\d{5}$/),
});

const FullUserSchema = UserSchema.extend({
  address: AddressSchema.optional(),
  tags:    z.array(z.string()).default([]),
});

type FullUser = z.infer<typeof FullUserSchema>;
```

### Step-by-Step Explanation
1. **Single source of truth**: You define the schema once. `z.infer<typeof Schema>` extracts the TypeScript type at compile time. No interface to keep in sync -- the schema IS the type definition.
2. **Runtime vs compile-time**: TypeScript types are erased at runtime. Zod runs at runtime and validates actual values. This covers the gap where TypeScript assumes `JSON.parse()` returns a type it cannot actually verify.
3. **`.parse()` vs `.safeParse()`**: `parse()` throws a `ZodError` with detailed per-field error info. `safeParse()` returns a discriminated union `{ success: true, data } | { success: false, error }` -- better for API handlers that need to return 400 responses instead of crashing.
4. **ZodError format**: Each issue has `path` (array of keys to the failing field), `message`, and `code`. This makes it easy to build user-friendly validation error responses.
5. **Schema composition**: Zod schemas are composable with `.extend()`, `.pick()`, `.omit()`, `.partial()`, `.merge()` -- all mirroring TypeScript utility types. Any change to a schema automatically updates the inferred type everywhere.
6. **When to use Zod**: Always use it at system boundaries: API request bodies, query params, environment variables, WebSocket messages, localStorage data, CSV imports. Avoid it for internal function calls where TypeScript already guarantees types.

### Complexity

| Scenario | TypeScript alone | Zod + TypeScript |
|--------------------------|------------------|---------------------------------|
| Compile-time type check | YES | YES (inferred from schema) |
| Runtime validation | NO | YES |
| Error messages | N/A | Detailed per-field messages |
| Schema composition | Via utilities | .extend, .omit, .partial |
| Single source of truth | No (type + guard) | YES (schema = type + validator) |
| Performance overhead | Zero | ~microseconds per parse |

## Q137: How do you write a custom type guard in TypeScript for a User object?

### ELI5
TypeScript sometimes narrows types automatically (like when you write `if (typeof x === "string")`), but for custom shapes it needs your help. A custom type guard is a function that does a runtime check and returns `value is SomeType` instead of `boolean`. When you call it inside an `if`, TypeScript knows that inside the `if` block the value IS that type -- it narrows automatically. Without type guards, you would be casting (`as User`) which is unsafe because it skips runtime checks.

### Visual Diagram
```
  Without type guard:
    function process(value: unknown) {
      const user = value as User;       // UNSAFE: no check, cast blindly
      console.log(user.name.trim());    // possible crash
    }

  With type guard:
    function isUser(value: unknown): value is User {
      // returns boolean, but TypeScript sees the "value is User" predicate
      return typeof value === "object" && value !== null
        && "id"    in value && typeof (value as any).id    === "number"
        && "name"  in value && typeof (value as any).name  === "string"
        && "email" in value && typeof (value as any).email === "string";
    }

    function process(value: unknown) {
      if (isUser(value)) {
        // TypeScript narrows value to User inside this block
        console.log(value.name.trim()); // safe!
      }
    }

  Return type syntax:
    function isXxx(v: unknown): v is SomeType
                                ^-- type predicate
                                    tells TS: if this returns true,
                                    narrow v to SomeType
```

### Code Example
```typescript
// ============================================================
// The type we want to guard
// ============================================================

type UserRole = "admin" | "user" | "viewer";

interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  age?: number;
}

// ============================================================
// Basic type guard function
// ============================================================

function isUser(value: unknown): value is User {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  // Check required fields exist and have correct primitive types
  if (typeof obj["id"]    !== "number") return false;
  if (typeof obj["name"]  !== "string") return false;
  if (typeof obj["email"] !== "string") return false;

  // Check enum value
  const validRoles: UserRole[] = ["admin", "user", "viewer"];
  if (!validRoles.includes(obj["role"] as UserRole)) return false;

  // Check optional fields if present
  if (obj["age"] !== undefined && typeof obj["age"] !== "number") return false;

  return true;
}

// ============================================================
// Usage: narrowing from unknown to User
// ============================================================

function processApiResponse(raw: unknown): void {
  if (isUser(raw)) {
    // TypeScript narrows: raw is User
    console.log(`User ${raw.id}: ${raw.name} <${raw.email}>`);
    console.log(`Role: ${raw.role}`);
    // raw.age is number | undefined (optional)
    if (raw.age !== undefined) {
      console.log(`Age: ${raw.age}`);
    }
  } else {
    console.warn("Invalid user data:", raw);
  }
}

processApiResponse({ id: 1, name: "Alice", email: "a@e.com", role: "admin" }); // OK
processApiResponse({ id: "wrong" }); // logs warning

// ============================================================
// Array type guard: isUserArray
// ============================================================

function isUserArray(value: unknown): value is User[] {
  return Array.isArray(value) && value.every(isUser);
}

// ============================================================
// Generic type guard factory
// ============================================================

// Build a type guard for any object shape
function createObjectGuard<T extends object>(
  guards: { [K in keyof T]: (v: unknown) => v is T[K] }
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    if (typeof value !== "object" || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (Object.keys(guards) as (keyof T)[]).every((key) =>
      guards[key](obj[key as string])
    );
  };
}

// Helper primitives
const isString = (v: unknown): v is string => typeof v === "string";
const isNumber = (v: unknown): v is number => typeof v === "number";

// Build a guard for a simple shape
interface Address {
  street: string;
  city:   string;
  zip:    string;
}

const isAddress = createObjectGuard<Address>({
  street: isString,
  city:   isString,
  zip:    isString,
});

// ============================================================
// Class-based type guard (instanceof)
// ============================================================

class ApiError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

try {
  throw new ApiError(404, "Not found");
} catch (err: unknown) {
  if (isApiError(err)) {
    console.log(err.code, err.message); // TypeScript knows: err is ApiError
  }
}

// ============================================================
// Assertion functions (alternative to type guards, TS 3.7+)
// ============================================================

// assertIsUser throws if not valid, instead of returning false
function assertIsUser(value: unknown): asserts value is User {
  if (!isUser(value)) {
    throw new Error(`Expected User, got: ${JSON.stringify(value)}`);
  }
}

// After calling assertIsUser, TypeScript narrows WITHOUT an if block
function requireUser(raw: unknown) {
  assertIsUser(raw);  // throws if invalid
  return raw.name;    // TypeScript knows: raw is User here
}
```

### Step-by-Step Explanation
1. **Type predicate syntax**: The return type `value is User` is called a type predicate. It is a special TypeScript construct that tells the compiler: "if this function returns `true`, narrow `value` to type `User` in the surrounding scope."
2. **The function is a boolean function at runtime**: TypeScript erases the `is User` predicate -- at runtime it is just a function returning `true` or `false`. The narrowing only happens at compile time.
3. **Checking nested structure safely**: Always cast to `Record<string, unknown>` before accessing properties -- accessing `(value as any).prop` works but accessing `value.prop` on `unknown` is a TS error. Use `"key" in obj` combined with `typeof obj["key"] === "number"` for safe runtime checks.
4. **Array guards with `.every()`**: Combine `Array.isArray()` with `.every(itemGuard)` to validate arrays. This is composable -- `isUserArray` reuses `isUser`.
5. **`asserts value is T` functions**: TypeScript 3.7+ supports `asserts` return type on void functions. After calling an assertion function, TypeScript narrows in the rest of the function scope without needing an `if`. Useful for entry-point validation.
6. **Type guards vs Zod**: Use manual type guards for simple shapes or when you cannot add a Zod dependency. Use Zod (Q136) for complex, composable validation with automatic type inference. Zod internally uses type predicates in its `parse` implementation.

### Complexity

| Approach | Runtime check | Type narrowing | Error details | Library needed |
|---------------------------|---------------|----------------|---------------|----------------|
| `as User` cast | NO (unsafe) | YES (unsound) | None | No |
| Manual type guard | YES | YES | Custom | No |
| Assertion function | YES | YES (no if) | Custom | No |
| Zod safeParse | YES | YES | Detailed | zod |
| io-ts / valibot | YES | YES | Detailed | io-ts/valibot |

--- End of Section 14 ---

---

# Section 15: JavaScript DSA (Data Structures & Algorithms)

## Q138: Implement `debounce` from scratch in JavaScript.

### ELI5
Debounce is like a "settle down" timer. Imagine you are typing in a search box and you want to fetch results -- but not on EVERY keystroke, only after you STOP typing for 500ms. Debounce wraps your function and says: "wait until the user stops calling me for N milliseconds, then fire once." Every new call resets the timer. If you type 10 characters fast, the function fires only ONCE, 500ms after the last keystroke.

### Visual Diagram
```
  Calls:    A    B    C              D    E
  Time: ----|----|----|----|----|----|----|----|----|--->
                          ^                   ^
                       debounced            debounced
                       A,B,C fires         D,E fires
                       (500ms after C)     (500ms after E)

  Implementation:
    debounce(fn, 500)
    |
    returns wrapper function
      |
      on each call: clearTimeout(timer)
                    timer = setTimeout(fn, 500)
```

### Code Example
```javascript
/**
 * Creates a debounced version of fn.
 * The debounced function delays invoking fn until after `delay` ms
 * have elapsed since the last time it was invoked.
 *
 * @param {Function} fn - function to debounce
 * @param {number} delay - milliseconds to wait
 * @returns {Function} debounced function
 */
function debounce(fn, delay) {
  let timerId = null;

  function debounced(...args) {
    // Cancel any pending timer
    if (timerId !== null) {
      clearTimeout(timerId);
    }

    // Schedule fn to run after delay
    timerId = setTimeout(() => {
      fn.apply(this, args); // preserve `this` context
      timerId = null;
    }, delay);
  }

  // Allow consumers to cancel the pending invocation
  debounced.cancel = function () {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  // Allow consumers to flush (invoke immediately, cancel timer)
  debounced.flush = function (...args) {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
      fn.apply(this, args);
    }
  };

  return debounced;
}

// ============================================================
// Usage: search input
// ============================================================

function fetchResults(query) {
  console.log("Fetching:", query);
  // expensive API call here
}

const debouncedFetch = debounce(fetchResults, 500);

// Simulate rapid keystrokes
debouncedFetch("h");
debouncedFetch("he");
debouncedFetch("hel");
debouncedFetch("hell");
debouncedFetch("hello");
// Only ONE call to fetchResults("hello") fires, 500ms after last call

// Cancel before it fires
debouncedFetch("x");
debouncedFetch.cancel(); // fetchResults("x") never runs

// ============================================================
// Leading-edge variant (fire immediately, then ignore for delay)
// ============================================================

function debounceLeading(fn, delay) {
  let timerId = null;

  return function (...args) {
    const callNow = timerId === null;

    // Reset the cooldown timer
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(() => {
      timerId = null; // cooldown expired: next call will fire immediately
    }, delay);

    // Only call fn on the FIRST invocation, not trailing ones
    if (callNow) {
      fn.apply(this, args);
    }
  };
}

// Leading: fires immediately on first call, then ignores for 500ms
const leadingFetch = debounceLeading(fetchResults, 500);
leadingFetch("h"); // fires immediately: "Fetching: h"
leadingFetch("he"); // ignored (within 500ms)
leadingFetch("hel"); // ignored
// 500ms later: next call fires immediately again
```

### Step-by-Step Explanation
1. **`clearTimeout` on every call**: Each new call to the debounced function cancels the previous timer with `clearTimeout(timerId)`. This ensures only the LAST call in a burst eventually fires.
2. **`setTimeout` reschedules**: After clearing, we schedule `fn` to run `delay` ms in the future. Each call pushes the execution further into the future until the burst stops.
3. **`fn.apply(this, args)`**: Using `.apply` preserves the `this` context (important for methods) and spreads `args` as individual arguments. Using an arrow function inside `setTimeout` means `this` refers to the outer function's context.
4. **`cancel()` method**: Exposed so consumers can cancel a pending debounce (e.g., on component unmount in React to prevent calling setState on an unmounted component).
5. **`flush()` method**: Forces immediate invocation and clears the pending timer. Useful when you want "debounce OR component destroy, whichever comes first".
6. **Leading vs trailing**: Default (trailing) fires AFTER the burst. Leading fires on the FIRST call and suppresses subsequent calls during cooldown. Leading is useful for "prevent double-click submit".

### Complexity

| Operation | Time | Space |
|-------------------|------|-------|
| debounce() setup | O(1) | O(1) |
| Each call | O(1) | O(1) |
| cancel() | O(1) | O(1) |
| flush() | O(1) | O(1) |
| Timer slots used | 1 | O(1) |

## Q139: Implement `throttle` from scratch in JavaScript.

### ELI5
Throttle is like a speed limiter. While debounce waits for silence, throttle says "you can call me as many times as you like, but I will only run the real function ONCE per N milliseconds -- no matter what." It is used for scroll events, resize events, or game loops where you want regular execution but need to limit how often it runs. Debounce = run after silence. Throttle = run at most once per interval.

### Visual Diagram
```
  Calls:    A  B  C  D  E     F  G  H
  Time: ----|--|--|--|--|------|--|--|--|----|--->
            ^                 ^
         fires              fires
         (A fires            (F fires
          B,C,D,E ignored)    G,H ignored)

  Timeline with 300ms throttle:
  t=0:   A fires -- sets lastRun=0
  t=50:  B called -- 50ms < 300ms -- IGNORED
  t=100: C called -- 100ms < 300ms -- IGNORED
  t=300: D called -- 300ms >= 300ms -- fires, sets lastRun=300
  t=350: E called -- 50ms < 300ms -- IGNORED
```

### Code Example
```javascript
/**
 * Creates a throttled version of fn.
 * fn will be called at most once per `limit` milliseconds.
 * Uses a time-based approach (no trailing call by default).
 *
 * @param {Function} fn - function to throttle
 * @param {number} limit - minimum ms between invocations
 * @returns {Function} throttled function
 */
function throttle(fn, limit) {
  let lastRun = 0;

  return function throttled(...args) {
    const now = Date.now();

    if (now - lastRun >= limit) {
      lastRun = now;
      fn.apply(this, args);
    }
    // else: ignore this call (within the throttle window)
  };
}

// ============================================================
// Usage: scroll handler
// ============================================================

function onScroll(event) {
  console.log("Scroll position:", window.scrollY);
  // expensive layout calculation here
}

const throttledScroll = throttle(onScroll, 200);
// window.addEventListener("scroll", throttledScroll);
// Fires at most once every 200ms, regardless of scroll speed

// ============================================================
// Throttle with trailing call (fires once more after last burst)
// ============================================================

function throttleWithTrailing(fn, limit) {
  let lastRun = 0;
  let trailingTimer = null;

  return function throttled(...args) {
    const now = Date.now();

    if (now - lastRun >= limit) {
      // Immediate fire
      lastRun = now;
      if (trailingTimer) {
        clearTimeout(trailingTimer);
        trailingTimer = null;
      }
      fn.apply(this, args);
    } else {
      // Schedule a trailing call for the end of the window
      if (trailingTimer) clearTimeout(trailingTimer);
      const remaining = limit - (now - lastRun);
      const capturedThis = this;
      trailingTimer = setTimeout(() => {
        lastRun = Date.now();
        trailingTimer = null;
        fn.apply(capturedThis, args);
      }, remaining);
    }
  };
}

// ============================================================
// Throttle with requestAnimationFrame (for animations)
// ============================================================

function throttleRAF(fn) {
  let rafId = null;

  return function throttled(...args) {
    if (rafId !== null) return; // already queued for next frame

    rafId = requestAnimationFrame(() => {
      fn.apply(this, args);
      rafId = null;
    });
  };
}

// ============================================================
// Debounce vs Throttle comparison
// ============================================================

// Debounce: waits for N ms of SILENCE, then fires once
// Throttle: fires immediately, then BLOCKS for N ms

// Rapid calls: A B C D E (each 50ms apart), limit=200ms

// Debounce(200): fires ONCE -- 200ms after E
// Throttle(200): fires A immediately, then D (first after 200ms from A)

// Use debounce for: search input, form validation, resize-end
// Use throttle for: scroll, mouse-move, game loop, real-time position update
```

### Step-by-Step Explanation
1. **`lastRun` timestamp**: We store when `fn` last ran. On each call, we check `Date.now() - lastRun >= limit`. If enough time has passed, we run `fn` and update `lastRun`.
2. **Time-based vs timer-based**: The simple version uses `Date.now()` (pure timestamp comparison, no setTimeout). This is the most common interview answer. The trailing variant uses setTimeout to schedule one final call.
3. **Trailing call**: Without trailing, if the last call in a burst falls inside the throttle window, it is silently dropped. With trailing, the LAST call is always guaranteed to fire (scheduled for when the window expires).
4. **`requestAnimationFrame` throttle**: For DOM animations, throttling to 60fps (one call per `~16ms` frame) via `requestAnimationFrame` is better than `setTimeout(fn, 16)` because the browser optimises RAF calls to sync with the display refresh rate.
5. **`this` and `args` preservation**: The throttled wrapper uses `fn.apply(this, args)` to forward both context and arguments. This matters for event handlers where `this` is the DOM element.
6. **Debounce vs Throttle rule of thumb**: Debounce = "I only care about the FINAL value after the user stops." Throttle = "I need REGULAR updates, but not too fast."

### Complexity

| Operation | Throttle (time-based) | Throttle (trailing) |
|----------------|----------------------|---------------------|
| Setup | O(1) | O(1) |
| Each call | O(1) | O(1) |
| Memory | O(1) -- 1 timestamp | O(1) -- 1 timer + 1 ts |
| Guaranteed fire | First in window | First + last in burst |

## Q140: Implement `deepClone` without using `JSON.parse` / `JSON.stringify`.

### ELI5
`JSON.parse(JSON.stringify(obj))` is the quick-and-dirty way to deep clone, but it breaks on `Date` objects (converts to strings), `undefined` values (drops them), functions (drops them), circular references (throws), `RegExp`, `Map`, `Set`, and `Symbol` keys. A real deep clone function handles all these cases recursively -- for each value it encounters, it checks what type it is and handles it appropriately.

### Visual Diagram
```
  Input: {
    name: "Alice",
    dob: new Date("1990-01-01"),
    tags: ["admin", "user"],
    address: { city: "NYC", zip: "10001" },
    callback: function() {},     // JSON.stringify drops this
    pattern: /\d+/g,             // JSON.stringify -> {}
    meta: undefined,             // JSON.stringify drops this
  }

  deepClone recursion tree:
    object { name, dob, tags, address, callback, pattern, meta }
    |-- "name"    -> string    -> copy value directly
    |-- "dob"     -> Date      -> new Date(value.getTime())
    |-- "tags"    -> Array     -> recurse: copy each element
    |-- "address" -> object    -> recurse: copy each key
    |-- "callback"-> Function  -> copy reference (functions are not cloned)
    |-- "pattern" -> RegExp    -> new RegExp(src, flags)
    |-- "meta"    -> undefined -> copy value directly
```

### Code Example
```javascript
/**
 * Deep clones a value, handling:
 * - Primitives (string, number, boolean, undefined, null, symbol, bigint)
 * - Date
 * - RegExp
 * - Array
 * - Plain objects
 * - Map and Set
 * - Circular references (via a WeakMap seen cache)
 * Functions are copied by REFERENCE (functions are not clonable)
 *
 * @param {*} value - value to clone
 * @param {WeakMap} [seen] - circular reference cache (internal)
 * @returns {*} deep clone
 */
function deepClone(value, seen = new WeakMap()) {
  // Primitives and null: return as-is
  if (value === null || typeof value !== "object" && typeof value !== "function") {
    return value;
  }

  // Functions: return reference (functions are intentionally not deep-cloned)
  if (typeof value === "function") {
    return value;
  }

  // Circular reference check
  if (seen.has(value)) {
    return seen.get(value);
  }

  // Date
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  // RegExp
  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags);
  }

  // Map
  if (value instanceof Map) {
    const clonedMap = new Map();
    seen.set(value, clonedMap);
    for (const [k, v] of value) {
      clonedMap.set(deepClone(k, seen), deepClone(v, seen));
    }
    return clonedMap;
  }

  // Set
  if (value instanceof Set) {
    const clonedSet = new Set();
    seen.set(value, clonedSet);
    for (const item of value) {
      clonedSet.add(deepClone(item, seen));
    }
    return clonedSet;
  }

  // Array
  if (Array.isArray(value)) {
    const clonedArr = [];
    seen.set(value, clonedArr); // register BEFORE recursing (handles circulars)
    for (let i = 0; i < value.length; i++) {
      clonedArr[i] = deepClone(value[i], seen);
    }
    return clonedArr;
  }

  // Plain object (and class instances -- prototype is preserved)
  const clonedObj = Object.create(Object.getPrototypeOf(value));
  seen.set(value, clonedObj); // register BEFORE recursing (handles circulars)

  for (const key of Reflect.ownKeys(value)) {
    // Reflect.ownKeys includes symbol keys, unlike Object.keys
    clonedObj[key] = deepClone(value[key], seen);
  }

  return clonedObj;
}

// ============================================================
// Tests
// ============================================================

// Primitives
console.log(deepClone(42));           // 42
console.log(deepClone("hello"));      // "hello"
console.log(deepClone(null));         // null
console.log(deepClone(undefined));    // undefined

// Date (must be a new Date instance, same time value)
const d = new Date("2024-01-15");
const dClone = deepClone(d);
console.log(dClone.toISOString());    // "2024-01-15T00:00:00.000Z"
console.log(dClone === d);            // false (different object)

// Nested object
const original = { a: 1, nested: { b: 2, arr: [3, 4] } };
const clone = deepClone(original);
clone.nested.b = 99;
clone.nested.arr.push(5);
console.log(original.nested.b);      // 2 (unchanged)
console.log(original.nested.arr);    // [3, 4] (unchanged)

// Circular reference
const circObj = { name: "root" };
circObj.self = circObj;
const circClone = deepClone(circObj);
console.log(circClone.self === circClone); // true (circular preserved correctly)

// Map and Set
const m = new Map([["a", 1], ["b", { x: 2 }]]);
const mClone = deepClone(m);
mClone.get("b").x = 99;
console.log(m.get("b").x);           // 2 (unchanged -- deep clone)

// Symbol keys
const sym = Symbol("id");
const withSym = { [sym]: 42, name: "test" };
const symClone = deepClone(withSym);
console.log(symClone[sym]);           // 42 (symbol key preserved)
```

### Step-by-Step Explanation
1. **Primitives first**: `null`, `undefined`, `number`, `string`, `boolean`, `bigint`, `symbol` are all immutable -- return them directly. Only `object` and `function` types need special handling.
2. **Circular reference prevention**: `WeakMap seen` maps each visited object to its clone. Before recursing into an object's keys, we register `seen.set(value, clonedObj)`. On the next visit, `seen.has(value)` returns the in-progress clone -- breaking the cycle.
3. **Type dispatch order matters**: Check `Date` and `RegExp` BEFORE the generic object branch, because they are instances of `Object` and would otherwise be cloned as plain objects (losing their prototype methods).
4. **`Reflect.ownKeys`**: Unlike `Object.keys()` (only string, enumerable) or `Object.getOwnPropertyNames()` (string, all), `Reflect.ownKeys()` returns ALL own property keys including `Symbol` keys.
5. **`Object.create(Object.getPrototypeOf(value))`**: Preserves the prototype chain for class instances. A plain `{}` would lose prototype methods. This way `clone instanceof MyClass` still returns `true`.
6. **Functions by reference**: Functions are not deep-cloned because they contain executable code and closures -- cloning them is neither meaningful nor straightforward. Returning the same reference is the correct approach.

### Complexity

| Type | Time | Space | Notes |
|------------|------|-------|-------|
| Primitives | O(1) | O(1) | Direct return |
| Date/RegExp | O(1) | O(1) | Single constructor |
| Array | O(n) | O(n) | n = total elements |
| Object | O(k) | O(k) | k = total key count |
| Nested | O(d*k) | O(d*k) | d = depth |
| Circular | O(nodes) | O(nodes) | WeakMap prevents infinite loop |

## Q140: Implement `deepClone` without using `JSON.parse` / `JSON.stringify`.

### ELI5
`JSON.parse(JSON.stringify(obj))` is the quick-and-dirty way to deep clone, but it breaks on `Date` objects (converts to strings), `undefined` values (drops them), functions (drops them), circular references (throws), `RegExp`, `Map`, `Set`, and `Symbol` keys. A real deep clone function handles all these cases recursively -- for each value it encounters, it checks what type it is and handles it appropriately.

### Visual Diagram
```
  Input: {
    name: "Alice",
    dob: new Date("1990-01-01"),
    tags: ["admin", "user"],
    address: { city: "NYC", zip: "10001" },
    callback: function() {},     // JSON.stringify drops this
    pattern: /\d+/g,             // JSON.stringify -> {}
    meta: undefined,             // JSON.stringify drops this
  }

  deepClone recursion tree:
    object { name, dob, tags, address, callback, pattern, meta }
    |-- "name"    -> string    -> copy value directly
    |-- "dob"     -> Date      -> new Date(value.getTime())
    |-- "tags"    -> Array     -> recurse: copy each element
    |-- "address" -> object    -> recurse: copy each key
    |-- "callback"-> Function  -> copy reference (functions are not cloned)
    |-- "pattern" -> RegExp    -> new RegExp(src, flags)
    |-- "meta"    -> undefined -> copy value directly
```

### Code Example
```javascript
/**
 * Deep clones a value, handling:
 * - Primitives (string, number, boolean, undefined, null, symbol, bigint)
 * - Date
 * - RegExp
 * - Array
 * - Plain objects
 * - Map and Set
 * - Circular references (via a WeakMap seen cache)
 * Functions are copied by REFERENCE (functions are not clonable)
 *
 * @param {*} value - value to clone
 * @param {WeakMap} [seen] - circular reference cache (internal)
 * @returns {*} deep clone
 */
function deepClone(value, seen = new WeakMap()) {
  // Primitives and null: return as-is
  if (value === null || typeof value !== "object" && typeof value !== "function") {
    return value;
  }

  // Functions: return reference (functions are intentionally not deep-cloned)
  if (typeof value === "function") {
    return value;
  }

  // Circular reference check
  if (seen.has(value)) {
    return seen.get(value);
  }

  // Date
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  // RegExp
  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags);
  }

  // Map
  if (value instanceof Map) {
    const clonedMap = new Map();
    seen.set(value, clonedMap);
    for (const [k, v] of value) {
      clonedMap.set(deepClone(k, seen), deepClone(v, seen));
    }
    return clonedMap;
  }

  // Set
  if (value instanceof Set) {
    const clonedSet = new Set();
    seen.set(value, clonedSet);
    for (const item of value) {
      clonedSet.add(deepClone(item, seen));
    }
    return clonedSet;
  }

  // Array
  if (Array.isArray(value)) {
    const clonedArr = [];
    seen.set(value, clonedArr); // register BEFORE recursing (handles circulars)
    for (let i = 0; i < value.length; i++) {
      clonedArr[i] = deepClone(value[i], seen);
    }
    return clonedArr;
  }

  // Plain object (and class instances -- prototype is preserved)
  const clonedObj = Object.create(Object.getPrototypeOf(value));
  seen.set(value, clonedObj); // register BEFORE recursing (handles circulars)

  for (const key of Reflect.ownKeys(value)) {
    // Reflect.ownKeys includes symbol keys, unlike Object.keys
    clonedObj[key] = deepClone(value[key], seen);
  }

  return clonedObj;
}

// ============================================================
// Tests
// ============================================================

// Primitives
console.log(deepClone(42));           // 42
console.log(deepClone("hello"));      // "hello"
console.log(deepClone(null));         // null
console.log(deepClone(undefined));    // undefined

// Date (must be a new Date instance, same time value)
const d = new Date("2024-01-15");
const dClone = deepClone(d);
console.log(dClone.toISOString());    // "2024-01-15T00:00:00.000Z"
console.log(dClone === d);            // false (different object)

// Nested object
const original = { a: 1, nested: { b: 2, arr: [3, 4] } };
const clone = deepClone(original);
clone.nested.b = 99;
clone.nested.arr.push(5);
console.log(original.nested.b);      // 2 (unchanged)
console.log(original.nested.arr);    // [3, 4] (unchanged)

// Circular reference
const circObj = { name: "root" };
circObj.self = circObj;
const circClone = deepClone(circObj);
console.log(circClone.self === circClone); // true (circular preserved correctly)

// Map and Set
const m = new Map([["a", 1], ["b", { x: 2 }]]);
const mClone = deepClone(m);
mClone.get("b").x = 99;
console.log(m.get("b").x);           // 2 (unchanged -- deep clone)

// Symbol keys
const sym = Symbol("id");
const withSym = { [sym]: 42, name: "test" };
const symClone = deepClone(withSym);
console.log(symClone[sym]);           // 42 (symbol key preserved)
```

### Step-by-Step Explanation
1. **Primitives first**: `null`, `undefined`, `number`, `string`, `boolean`, `bigint`, `symbol` are all immutable -- return them directly. Only `object` and `function` types need special handling.
2. **Circular reference prevention**: `WeakMap seen` maps each visited object to its clone. Before recursing into an object's keys, we register `seen.set(value, clonedObj)`. On the next visit, `seen.has(value)` returns the in-progress clone -- breaking the cycle.
3. **Type dispatch order matters**: Check `Date` and `RegExp` BEFORE the generic object branch, because they are instances of `Object` and would otherwise be cloned as plain objects (losing their prototype methods).
4. **`Reflect.ownKeys`**: Unlike `Object.keys()` (only string, enumerable) or `Object.getOwnPropertyNames()` (string, all), `Reflect.ownKeys()` returns ALL own property keys including `Symbol` keys.
5. **`Object.create(Object.getPrototypeOf(value))`**: Preserves the prototype chain for class instances. A plain `{}` would lose prototype methods. This way `clone instanceof MyClass` still returns `true`.
6. **Functions by reference**: Functions are not deep-cloned because they contain executable code and closures -- cloning them is neither meaningful nor straightforward. Returning the same reference is the correct approach.

### Complexity

| Type | Time | Space | Notes |
|------------|------|-------|-------|
| Primitives | O(1) | O(1) | Direct return |
| Date/RegExp | O(1) | O(1) | Single constructor |
| Array | O(n) | O(n) | n = total elements |
| Object | O(k) | O(k) | k = total key count |
| Nested | O(d*k) | O(d*k) | d = depth |
| Circular | O(nodes) | O(nodes) | WeakMap prevents infinite loop |

## Q141: Implement `Promise.all` from scratch.

### ELI5
`Promise.all` takes an array of promises and returns a single new promise. That new promise resolves when EVERY promise in the array has resolved -- it collects all the results and gives you an array of them in the same order. But if ANY single promise rejects, the whole thing immediately rejects with that one error. Think of it like a relay race: every runner must finish for the team to win, but one trip and the whole team is disqualified.

### Visual Diagram
```
  promises = [p1, p2, p3]

  p1 -----> resolve("a")  ----+
  p2 -------> resolve("b") --+---> ["a","b","c"]  all done -> resolve
  p3 -> resolve("c")      ---+

  If one rejects:
  p1 -----> resolve("a")
  p2 --> REJECT("err")  ----> reject("err") immediately
  p3 -> still pending        (p3 ignored -- already rejected)

  Internal counters:
  results = []   (pre-sized to match input length)
  resolved = 0   (incremented on each success)
  When resolved === promises.length -> resolve(results)
```

### Code Example
```javascript
/**
 * Custom implementation of Promise.all
 *
 * @param {Iterable} promises - iterable of values or promises
 * @returns {Promise<Array>} resolves with array of resolved values (in order)
 *                          or rejects with the first rejection reason
 */
function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    // Convert iterable to array so we can use index and length
    const items = Array.from(promises);

    // Edge case: empty input resolves immediately with []
    if (items.length === 0) {
      return resolve([]);
    }

    const results = new Array(items.length); // preserve order
    let resolvedCount = 0;

    items.forEach((item, index) => {
      // Wrap non-promise values with Promise.resolve so we can
      // handle plain values and thenables uniformly
      Promise.resolve(item).then(
        (value) => {
          results[index] = value;    // store at same index as input
          resolvedCount++;

          if (resolvedCount === items.length) {
            // All promises resolved
            resolve(results);
          }
        },
        (reason) => {
          // First rejection short-circuits the whole thing
          reject(reason);
        }
      );
    });
  });
}

// ============================================================
// Tests
// ============================================================

// All resolve
promiseAll([
  Promise.resolve(1),
  Promise.resolve(2),
  Promise.resolve(3),
]).then(console.log); // [1, 2, 3]

// Mix of values and promises
promiseAll([
  42,                          // plain value -- wrapped automatically
  Promise.resolve("hello"),
  new Promise((res) => setTimeout(() => res("async"), 100)),
]).then(console.log); // [42, "hello", "async"]

// One rejects
promiseAll([
  Promise.resolve("ok"),
  Promise.reject(new Error("boom")),
  Promise.resolve("also ok"),
]).catch((err) => console.error(err.message)); // "boom"

// Empty array
promiseAll([]).then(console.log); // []

// Order is preserved even with different timing
promiseAll([
  new Promise((res) => setTimeout(() => res("slow"), 200)),
  new Promise((res) => setTimeout(() => res("fast"), 50)),
]).then(console.log); // ["slow", "fast"] -- index order, not arrival order

// ============================================================
// Bonus: promiseAllSettled (all promises run to completion,
// no short-circuit on rejection)
// ============================================================
function promiseAllSettled(promises) {
  const items = Array.from(promises);
  return promiseAll(
    items.map((item) =>
      Promise.resolve(item).then(
        (value) => ({ status: "fulfilled", value }),
        (reason) => ({ status: "rejected", reason })
      )
    )
  );
}
// promiseAllSettled([p1, p2, p3]) ->
// [
//   { status: "fulfilled", value: 1 },
//   { status: "rejected", reason: Error },
//   { status: "fulfilled", value: 3 },
// ]
```

### Step-by-Step Explanation
1. **Wrap in `new Promise`**: We need to be able to call `resolve` / `reject` ourselves, so we create a wrapping executor.
2. **Convert to Array**: The spec says `Promise.all` accepts any iterable (array, Set, generator). `Array.from` normalises it and gives us `.length` and numeric indices.
3. **Empty case first**: If there are 0 items, resolve immediately with `[]`. Without this guard, the `resolvedCount === items.length` check would never trigger (0 === 0 is true but we'd never enter the `.then` callback because nothing is pending).
4. **`Promise.resolve(item)`**: Wraps plain values and ensures consistent `.then` calling. Also handles theables (objects with a `.then` method that are not native Promises).
5. **Preserve order via index**: Results are stored at `results[index]`, NOT pushed in arrival order. The last promise to settle might be at index 0 -- we want the output to mirror the input order.
6. **Short-circuit on first rejection**: The first `.catch` callback that fires calls `reject(reason)` on the outer promise. Subsequent rejections or resolutions are ignored because a Promise can only be settled once.
7. **Memory**: `results` grows to `items.length` entries. Once resolved, both `results` and `items` are GC-able.

### Complexity

| Operation | Time | Space | Notes |
|-----------|------|-------|-------|
| Overall | O(n) | O(n) | n = number of promises |
| Per-promise | O(1) | O(1) | Constant overhead per .then |
| Waiting | O(max(t_i)) | - | Wall-clock = slowest promise |

## Q142: Implement an `EventEmitter` class with `on`, `off`, `emit`, and `once`.

### ELI5
An EventEmitter is like a radio station. You tune in (`on`) to a specific channel (event name) and give a callback function to run when that event happens. The station broadcasts (`emit`) an event, and everyone tuned in gets called. You can stop listening with `off`. The `once` method is like a one-time coupon: the callback runs the first time the event fires, then automatically unsubscribes itself.

### Visual Diagram
```
  EventEmitter internal state:
  this.listeners = {
    "click":  [ fn1, fn2 ],
    "data":   [ fn3 ],
    "close":  []
  }

  .on("click", fn3)        -> listeners["click"] = [fn1, fn2, fn3]
  .off("click", fn1)       -> listeners["click"] = [fn2, fn3]
  .emit("click", arg1)     -> fn2(arg1), fn3(arg1)
  .once("data", fn4)       -> wraps fn4 in wrapper that:
                              1. calls fn4
                              2. calls .off("data", wrapper)
  .emit("data", payload)   -> fn3(payload), wrapper(payload) -> fn4(payload) + off
  .emit("data", payload2)  -> fn3(payload2)  (fn4 gone)
```

### Code Example
```javascript
class EventEmitter {
  constructor() {
    // Map of event name -> array of listener functions
    this._events = new Map();
  }

  /**
   * Register a listener for an event.
   * @returns {this} for chaining
   */
  on(event, listener) {
    if (!this._events.has(event)) {
      this._events.set(event, []);
    }
    this._events.get(event).push(listener);
    return this;
  }

  /**
   * Remove a previously registered listener.
   * No-op if the listener was never registered.
   * @returns {this} for chaining
   */
  off(event, listener) {
    if (!this._events.has(event)) return this;

    const filtered = this._events.get(event).filter((l) => l !== listener);
    this._events.set(event, filtered);
    return this;
  }

  /**
   * Emit an event, calling all registered listeners with ...args.
   * Listeners are called in registration order.
   * @returns {boolean} true if there were listeners, false otherwise
   */
  emit(event, ...args) {
    if (!this._events.has(event)) return false;

    const listeners = this._events.get(event).slice(); // copy so off() during emit is safe
    for (const listener of listeners) {
      listener(...args);
    }
    return listeners.length > 0;
  }

  /**
   * Register a one-time listener. Automatically removed after first call.
   * @returns {this} for chaining
   */
  once(event, listener) {
    // Wrapper calls the real listener then unregisters itself
    const wrapper = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    // Store reference to original on the wrapper so callers can off() using
    // the original function reference if needed (mirrors Node.js behaviour)
    wrapper._original = listener;
    this.on(event, wrapper);
    return this;
  }

  /**
   * Remove ALL listeners for an event (or all events if no arg).
   */
  removeAllListeners(event) {
    if (event === undefined) {
      this._events.clear();
    } else {
      this._events.delete(event);
    }
    return this;
  }

  /**
   * Return current listener count for an event.
   */
  listenerCount(event) {
    return this._events.has(event) ? this._events.get(event).length : 0;
  }
}

// ============================================================
// Tests
// ============================================================

const emitter = new EventEmitter();

// on / emit
emitter.on("data", (x) => console.log("listener1:", x));
emitter.on("data", (x) => console.log("listener2:", x));
emitter.emit("data", 42);
// listener1: 42
// listener2: 42

// off
const fn = (x) => console.log("removable:", x);
emitter.on("data", fn);
emitter.emit("data", 1);   // listener1: 1, listener2: 1, removable: 1
emitter.off("data", fn);
emitter.emit("data", 2);   // listener1: 2, listener2: 2  (fn removed)

// once
emitter.once("connect", () => console.log("connected!"));
emitter.emit("connect"); // connected!
emitter.emit("connect"); // (nothing -- listener already removed)

// chaining
const ee2 = new EventEmitter();
ee2
  .on("a", () => console.log("a1"))
  .on("a", () => console.log("a2"))
  .emit("a"); // a1, a2

// listenerCount
console.log(emitter.listenerCount("data")); // 2

// removeAllListeners
emitter.removeAllListeners("data");
emitter.emit("data", 99); // returns false, no listeners called
```

### Step-by-Step Explanation
1. **`Map` over plain object**: `Map` avoids prototype pollution issues (__proto__, constructor etc. as event names would break `{}`). It also provides `.has`, `.delete`, `.clear` cleanly.
2. **`on`**: Lazily creates the listener array the first time any event is registered. Pushes the listener to preserve order.
3. **`off`**: Filters the array immutably (`filter`) rather than splicing in-place. This is important because `emit` iterates the array -- mutating it mid-iteration would cause skipped or double-called listeners.
4. **`emit`**: Takes a `.slice()` snapshot of the listener array before iterating. This means if a listener calls `off` on itself (or `once` wrappers do), the copy being iterated is unaffected.
5. **`once` wrapper pattern**: Creates a closure `wrapper` that: (a) calls the original `listener`, (b) calls `this.off(event, wrapper)`. Stores `wrapper._original = listener` so external code can cancel a `once` with the original reference.
6. **Spread args**: `emit(event, ...args)` and `listener(...args)` allow any number of event arguments without having to package them into an array.

### Complexity

| Operation | Time | Space | Notes |
|-----------|------|-------|-------|
| on | O(1) | O(1) | Array push |
| off | O(n) | O(n) | n = listeners for that event (filter creates new array) |
| emit | O(n) | O(n) | n = listeners; slice + loop |
| once | O(1) | O(1) | Just registers wrapper |
| removeAll | O(1) | O(1) | Map.clear or Map.delete |

## Q142: Implement an `EventEmitter` class with `on`, `off`, `emit`, and `once`.

### ELI5
An EventEmitter is like a radio station. You tune in (`on`) to a specific channel (event name) and give a callback function to run when that event happens. The station broadcasts (`emit`) an event, and everyone tuned in gets called. You can stop listening with `off`. The `once` method is like a one-time coupon: the callback runs the first time the event fires, then automatically unsubscribes itself.

### Visual Diagram
```
  EventEmitter internal state:
  this.listeners = {
    "click":  [ fn1, fn2 ],
    "data":   [ fn3 ],
    "close":  []
  }

  .on("click", fn3)        -> listeners["click"] = [fn1, fn2, fn3]
  .off("click", fn1)       -> listeners["click"] = [fn2, fn3]
  .emit("click", arg1)     -> fn2(arg1), fn3(arg1)
  .once("data", fn4)       -> wraps fn4 in wrapper that:
                              1. calls fn4
                              2. calls .off("data", wrapper)
  .emit("data", payload)   -> fn3(payload), wrapper(payload) -> fn4(payload) + off
  .emit("data", payload2)  -> fn3(payload2)  (fn4 gone)
```

### Code Example
```javascript
class EventEmitter {
  constructor() {
    // Map of event name -> array of listener functions
    this._events = new Map();
  }

  /**
   * Register a listener for an event.
   * @returns {this} for chaining
   */
  on(event, listener) {
    if (!this._events.has(event)) {
      this._events.set(event, []);
    }
    this._events.get(event).push(listener);
    return this;
  }

  /**
   * Remove a previously registered listener.
   * No-op if the listener was never registered.
   * @returns {this} for chaining
   */
  off(event, listener) {
    if (!this._events.has(event)) return this;

    const filtered = this._events.get(event).filter((l) => l !== listener);
    this._events.set(event, filtered);
    return this;
  }

  /**
   * Emit an event, calling all registered listeners with ...args.
   * Listeners are called in registration order.
   * @returns {boolean} true if there were listeners, false otherwise
   */
  emit(event, ...args) {
    if (!this._events.has(event)) return false;

    const listeners = this._events.get(event).slice(); // copy so off() during emit is safe
    for (const listener of listeners) {
      listener(...args);
    }
    return listeners.length > 0;
  }

  /**
   * Register a one-time listener. Automatically removed after first call.
   * @returns {this} for chaining
   */
  once(event, listener) {
    // Wrapper calls the real listener then unregisters itself
    const wrapper = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    // Store reference to original on the wrapper so callers can off() using
    // the original function reference if needed (mirrors Node.js behaviour)
    wrapper._original = listener;
    this.on(event, wrapper);
    return this;
  }

  /**
   * Remove ALL listeners for an event (or all events if no arg).
   */
  removeAllListeners(event) {
    if (event === undefined) {
      this._events.clear();
    } else {
      this._events.delete(event);
    }
    return this;
  }

  /**
   * Return current listener count for an event.
   */
  listenerCount(event) {
    return this._events.has(event) ? this._events.get(event).length : 0;
  }
}

// ============================================================
// Tests
// ============================================================

const emitter = new EventEmitter();

// on / emit
emitter.on("data", (x) => console.log("listener1:", x));
emitter.on("data", (x) => console.log("listener2:", x));
emitter.emit("data", 42);
// listener1: 42
// listener2: 42

// off
const fn = (x) => console.log("removable:", x);
emitter.on("data", fn);
emitter.emit("data", 1);   // listener1: 1, listener2: 1, removable: 1
emitter.off("data", fn);
emitter.emit("data", 2);   // listener1: 2, listener2: 2  (fn removed)

// once
emitter.once("connect", () => console.log("connected!"));
emitter.emit("connect"); // connected!
emitter.emit("connect"); // (nothing -- listener already removed)

// chaining
const ee2 = new EventEmitter();
ee2
  .on("a", () => console.log("a1"))
  .on("a", () => console.log("a2"))
  .emit("a"); // a1, a2

// listenerCount
console.log(emitter.listenerCount("data")); // 2

// removeAllListeners
emitter.removeAllListeners("data");
emitter.emit("data", 99); // returns false, no listeners called
```

### Step-by-Step Explanation
1. **`Map` over plain object**: `Map` avoids prototype pollution issues (__proto__, constructor etc. as event names would break `{}`). It also provides `.has`, `.delete`, `.clear` cleanly.
2. **`on`**: Lazily creates the listener array the first time any event is registered. Pushes the listener to preserve order.
3. **`off`**: Filters the array immutably (`filter`) rather than splicing in-place. This is important because `emit` iterates the array -- mutating it mid-iteration would cause skipped or double-called listeners.
4. **`emit`**: Takes a `.slice()` snapshot of the listener array before iterating. This means if a listener calls `off` on itself (or `once` wrappers do), the copy being iterated is unaffected.
5. **`once` wrapper pattern**: Creates a closure `wrapper` that: (a) calls the original `listener`, (b) calls `this.off(event, wrapper)`. Stores `wrapper._original = listener` so external code can cancel a `once` with the original reference.
6. **Spread args**: `emit(event, ...args)` and `listener(...args)` allow any number of event arguments without having to package them into an array.

### Complexity

| Operation | Time | Space | Notes |
|-----------|------|-------|-------|
| on | O(1) | O(1) | Array push |
| off | O(n) | O(n) | n = listeners for that event (filter creates new array) |
| emit | O(n) | O(n) | n = listeners; slice + loop |
| once | O(1) | O(1) | Just registers wrapper |
| removeAll | O(1) | O(1) | Map.clear or Map.delete |

## Q143: Implement an LRU (Least Recently Used) Cache using `Map`.

### ELI5
An LRU cache is like a small desk with limited space. When the desk is full and you need to bring in something new, you throw away the item you used longest ago. "Least Recently Used" means the oldest item (in terms of last access) gets evicted first. JavaScript's `Map` preserves insertion order, so we exploit that: delete-then-reinsert an entry on every access to bump it to the "most recently used" end of the Map. The first entry of the Map is always the LRU.

### Visual Diagram
```
  capacity = 3

  put(1,"a")  Map: {1:"a"}
  put(2,"b")  Map: {1:"a", 2:"b"}
  put(3,"c")  Map: {1:"a", 2:"b", 3:"c"}

  get(1)      delete 1, reinsert at end
              Map: {2:"b", 3:"c", 1:"a"}  <- 1 is now MRU

  put(4,"d")  FULL -- evict first entry (LRU = 2)
              delete 2, insert 4
              Map: {3:"c", 1:"a", 4:"d"}

  get(2)      -> -1 (evicted)
  get(3)      -> "c",  reinsert: Map: {1:"a", 4:"d", 3:"c"}

  Map.keys() order:    LRU  <---------->  MRU
                       first              last
```

### Code Example
```javascript
class LRUCache {
  /**
   * @param {number} capacity - max number of entries
   */
  constructor(capacity) {
    if (capacity < 1) throw new RangeError("capacity must be >= 1");
    this.capacity = capacity;
    this._cache = new Map(); // Map preserves insertion order
  }

  /**
   * Get value by key. Returns -1 if not found.
   * Moves accessed entry to Most Recently Used position.
   * O(1) average
   */
  get(key) {
    if (!this._cache.has(key)) return -1;

    // Move to end (MRU) by delete + reinsert
    const value = this._cache.get(key);
    this._cache.delete(key);
    this._cache.set(key, value);
    return value;
  }

  /**
   * Insert or update a key. Evicts LRU entry if over capacity.
   * O(1) average
   */
  put(key, value) {
    if (this._cache.has(key)) {
      // Update existing: delete first so reinsert puts it at MRU end
      this._cache.delete(key);
    } else if (this._cache.size >= this.capacity) {
      // Evict: Map.keys().next().value is the FIRST key (LRU)
      const lruKey = this._cache.keys().next().value;
      this._cache.delete(lruKey);
    }
    this._cache.set(key, value);
  }

  /** Current number of entries */
  get size() {
    return this._cache.size;
  }

  /** Peek without updating recency (useful for debugging) */
  peek(key) {
    return this._cache.get(key) ?? -1;
  }
}

// ============================================================
// Tests
// ============================================================

const cache = new LRUCache(3);

cache.put(1, "a");
cache.put(2, "b");
cache.put(3, "c");

console.log(cache.get(1));   // "a" -- 1 is now MRU, order: 2,3,1

cache.put(4, "d");           // evict LRU (2) -- order: 3,1,4

console.log(cache.get(2));   // -1 (evicted)
console.log(cache.get(3));   // "c" -- 3 is MRU, order: 1,4,3

cache.put(5, "e");           // evict LRU (1) -- order: 4,3,5

console.log(cache.get(1));   // -1 (evicted)
console.log(cache.get(4));   // "d", order: 3,5,4
console.log(cache.get(5));   // "e", order: 3,4,5

// Update existing key
cache.put(3, "C");           // update 3 (already exists) -> delete+reinsert at MRU
console.log(cache.get(3));   // "C"  -- order: 4,5,3

// LeetCode-style interface check
// LRUCache capacity=2
const lru = new LRUCache(2);
lru.put(1, 1);
lru.put(2, 2);
console.log(lru.get(1));   // 1
lru.put(3, 3);             // evict 2
console.log(lru.get(2));   // -1
lru.put(4, 4);             // evict 1
console.log(lru.get(1));   // -1
console.log(lru.get(3));   // 3
console.log(lru.get(4));   // 4
```

### Step-by-Step Explanation
1. **Why `Map` works for O(1) LRU**: JavaScript's `Map` maintains insertion order as a doubly-linked list under the hood. Deleting a key and re-inserting it moves it to the tail (MRU end). The head (first key) is always the LRU.
2. **`get`**: Check existence in O(1). If found, delete + re-set to "touch" the entry (make it MRU). Return the value.
3. **`put` -- existing key**: Must delete before re-setting so the entry moves to the MRU position. Simply overwriting with `set(key, newValue)` keeps the entry at its old position in Map order.
4. **`put` -- new key but full**: Retrieve the LRU key via `this._cache.keys().next().value` -- the iterator starts from the first-inserted (LRU) entry. Delete it, then insert the new entry.
5. **`keys().next()`**: `Map.prototype.keys()` returns an iterator. `.next().value` is the very first key without building an array, making eviction O(1).
6. **Alternative with doubly-linked list**: Production LRU caches (like the `lru-cache` npm package) use an explicit doubly-linked list + hashmap for guaranteed O(1) with no iterator overhead. The Map approach is simpler and still O(1) amortized for JS engines that optimize Map order.

### Complexity

| Operation | Time | Space | Notes |
|-----------|------|-------|-------|
| get | O(1) | O(1) | Map lookup + delete + set |
| put | O(1) | O(1) | Map delete + set + eviction |
| Space total | - | O(capacity) | Map holds at most `capacity` entries |

## Q143: Implement an LRU (Least Recently Used) Cache using `Map`.

### ELI5
An LRU cache is like a small desk with limited space. When the desk is full and you need to bring in something new, you throw away the item you used longest ago. "Least Recently Used" means the oldest item (in terms of last access) gets evicted first. JavaScript's `Map` preserves insertion order, so we exploit that: delete-then-reinsert an entry on every access to bump it to the "most recently used" end of the Map. The first entry of the Map is always the LRU.

### Visual Diagram
```
  capacity = 3

  put(1,"a")  Map: {1:"a"}
  put(2,"b")  Map: {1:"a", 2:"b"}
  put(3,"c")  Map: {1:"a", 2:"b", 3:"c"}

  get(1)      delete 1, reinsert at end
              Map: {2:"b", 3:"c", 1:"a"}  <- 1 is now MRU

  put(4,"d")  FULL -- evict first entry (LRU = 2)
              delete 2, insert 4
              Map: {3:"c", 1:"a", 4:"d"}

  get(2)      -> -1 (evicted)
  get(3)      -> "c",  reinsert: Map: {1:"a", 4:"d", 3:"c"}

  Map.keys() order:    LRU  <---------->  MRU
                       first              last
```

### Code Example
```javascript
class LRUCache {
  /**
   * @param {number} capacity - max number of entries
   */
  constructor(capacity) {
    if (capacity < 1) throw new RangeError("capacity must be >= 1");
    this.capacity = capacity;
    this._cache = new Map(); // Map preserves insertion order
  }

  /**
   * Get value by key. Returns -1 if not found.
   * Moves accessed entry to Most Recently Used position.
   * O(1) average
   */
  get(key) {
    if (!this._cache.has(key)) return -1;

    // Move to end (MRU) by delete + reinsert
    const value = this._cache.get(key);
    this._cache.delete(key);
    this._cache.set(key, value);
    return value;
  }

  /**
   * Insert or update a key. Evicts LRU entry if over capacity.
   * O(1) average
   */
  put(key, value) {
    if (this._cache.has(key)) {
      // Update existing: delete first so reinsert puts it at MRU end
      this._cache.delete(key);
    } else if (this._cache.size >= this.capacity) {
      // Evict: Map.keys().next().value is the FIRST key (LRU)
      const lruKey = this._cache.keys().next().value;
      this._cache.delete(lruKey);
    }
    this._cache.set(key, value);
  }

  /** Current number of entries */
  get size() {
    return this._cache.size;
  }

  /** Peek without updating recency (useful for debugging) */
  peek(key) {
    return this._cache.get(key) ?? -1;
  }
}

// ============================================================
// Tests
// ============================================================

const cache = new LRUCache(3);

cache.put(1, "a");
cache.put(2, "b");
cache.put(3, "c");

console.log(cache.get(1));   // "a" -- 1 is now MRU, order: 2,3,1

cache.put(4, "d");           // evict LRU (2) -- order: 3,1,4

console.log(cache.get(2));   // -1 (evicted)
console.log(cache.get(3));   // "c" -- 3 is MRU, order: 1,4,3

cache.put(5, "e");           // evict LRU (1) -- order: 4,3,5

console.log(cache.get(1));   // -1 (evicted)
console.log(cache.get(4));   // "d", order: 3,5,4
console.log(cache.get(5));   // "e", order: 3,4,5

// Update existing key
cache.put(3, "C");           // update 3 (already exists) -> delete+reinsert at MRU
console.log(cache.get(3));   // "C"  -- order: 4,5,3

// LeetCode-style interface check
// LRUCache capacity=2
const lru = new LRUCache(2);
lru.put(1, 1);
lru.put(2, 2);
console.log(lru.get(1));   // 1
lru.put(3, 3);             // evict 2
console.log(lru.get(2));   // -1
lru.put(4, 4);             // evict 1
console.log(lru.get(1));   // -1
console.log(lru.get(3));   // 3
console.log(lru.get(4));   // 4
```

### Step-by-Step Explanation
1. **Why `Map` works for O(1) LRU**: JavaScript's `Map` maintains insertion order as a doubly-linked list under the hood. Deleting a key and re-inserting it moves it to the tail (MRU end). The head (first key) is always the LRU.
2. **`get`**: Check existence in O(1). If found, delete + re-set to "touch" the entry (make it MRU). Return the value.
3. **`put` -- existing key**: Must delete before re-setting so the entry moves to the MRU position. Simply overwriting with `set(key, newValue)` keeps the entry at its old position in Map order.
4. **`put` -- new key but full**: Retrieve the LRU key via `this._cache.keys().next().value` -- the iterator starts from the first-inserted (LRU) entry. Delete it, then insert the new entry.
5. **`keys().next()`**: `Map.prototype.keys()` returns an iterator. `.next().value` is the very first key without building an array, making eviction O(1).
6. **Alternative with doubly-linked list**: Production LRU caches (like the `lru-cache` npm package) use an explicit doubly-linked list + hashmap for guaranteed O(1) with no iterator overhead. The Map approach is simpler and still O(1) amortized for JS engines that optimize Map order.

### Complexity

| Operation | Time | Space | Notes |
|-----------|------|-------|-------|
| get | O(1) | O(1) | Map lookup + delete + set |
| put | O(1) | O(1) | Map delete + set + eviction |
| Space total | - | O(capacity) | Map holds at most `capacity` entries |

## Q144: Two Sum -- find two indices that add up to a target (O(n) solution).

### ELI5
Given an array of numbers and a target sum, find two numbers in the array that together equal the target and return their indices. The naive way is to check every pair -- O(n^2). The fast way uses a hash map: as you scan each number, check if its "complement" (target minus the current number) is already in the map. If yes, you found the pair. If no, store the current number so a future element can find it.

### Visual Diagram
```
  nums = [2, 7, 11, 15],  target = 9

  i=0: num=2,  complement = 9-2 = 7  -> not in map
       store map: { 2: 0 }

  i=1: num=7,  complement = 9-7 = 2  -> FOUND in map at index 0
       return [0, 1]

  Hash map lookup is O(1), so overall O(n).

  Visual:
  index:   0    1    2    3
  nums:  [ 2,   7,  11,  15 ]
           ^    ^
           |    found complement (2) at index 0
           stored as "I exist, my index is 0"
```

### Code Example
```javascript
/**
 * Two Sum (LeetCode #1)
 * Returns indices [i, j] such that nums[i] + nums[j] === target.
 * Assumes exactly one solution exists.
 *
 * @param {number[]} nums
 * @param {number} target
 * @returns {number[]} [i, j]
 */
function twoSum(nums, target) {
  // Map: number value -> its index in nums
  const seen = new Map();

  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];

    if (seen.has(complement)) {
      // Found the pair
      return [seen.get(complement), i];
    }

    // Store current number so future elements can find it
    seen.set(nums[i], i);
  }

  // No solution found (should not happen per problem constraints)
  return [];
}

// ============================================================
// Tests
// ============================================================

console.log(twoSum([2, 7, 11, 15], 9));    // [0, 1]  (2+7)
console.log(twoSum([3, 2, 4], 6));         // [1, 2]  (2+4)
console.log(twoSum([3, 3], 6));            // [0, 1]  (3+3)
console.log(twoSum([1, 5, 3, 7, 2], 9));   // [1, 3]  (5+... wait: 7+2? -> [3,4])
// Let's be precise: 5+4 no, 1+8 no, 5+3=8 no, 3+7=10 no, but 7+2=9 -> [3,4]
console.log(twoSum([1, 5, 3, 7, 2], 9));   // [3, 4]

// Edge case: duplicate values
console.log(twoSum([0, 4, 3, 0], 0));      // [0, 3]  (0+0)

// ============================================================
// Variation: return VALUES instead of indices
// ============================================================
function twoSumValues(nums, target) {
  const seen = new Set();
  for (const num of nums) {
    const complement = target - num;
    if (seen.has(complement)) return [complement, num];
    seen.add(num);
  }
  return null;
}
console.log(twoSumValues([2, 7, 11, 15], 9)); // [2, 7]

// ============================================================
// Variation: all pairs (there may be multiple)
// ============================================================
function twoSumAll(nums, target) {
  const seen = new Map(); // value -> first index
  const pairs = [];
  for (let i = 0; i < nums.length; i++) {
    const comp = target - nums[i];
    if (seen.has(comp)) {
      pairs.push([seen.get(comp), i]);
    }
    // Only store first occurrence so we don't use same index twice
    if (!seen.has(nums[i])) {
      seen.set(nums[i], i);
    }
  }
  return pairs;
}
console.log(twoSumAll([1, 2, 3, 4, 3], 6)); // [[1,3],[2,4]]  (2+4, 3+3)
```

### Step-by-Step Explanation
1. **Why O(n^2) is slow**: A nested loop checks every pair (i,j). For n=10000, that is 50 million comparisons.
2. **Complement insight**: If `a + b = target`, then `b = target - a`. So for each element `a`, we just need to know "has `target - a` appeared before?"
3. **One-pass hash map**: We maintain a map of `{ value: index }`. For each element, if its complement is already in the map, we've found the answer. Otherwise, we add the element to the map and continue.
4. **Why store BEFORE checking won't work with same-index**: We store AFTER checking, which prevents using the same index twice. If `nums = [3, 3], target = 6`: at i=0, complement=3 not in map yet, store `{3:0}`. At i=1, complement=3 found at index 0 -- we correctly return `[0, 1]`.
5. **Map vs Object**: `Map` handles all key types correctly (numbers as keys would work in `{}` too, but Map is more semantically correct and avoids prototype collisions).

### Complexity

| Approach | Time | Space | Notes |
|----------|------|-------|-------|
| Brute force (nested loops) | O(n^2) | O(1) | Check every pair |
| Hash map (this solution) | O(n) | O(n) | One pass, map holds up to n entries |

## Q145: Longest substring without repeating characters (sliding window).

### ELI5
Imagine you are walking along a string of characters with two fingers: a left finger (start of window) and a right finger (current character). You keep expanding the right finger. Whenever you hit a character that already exists between your two fingers, you slide the left finger forward past the first occurrence of that duplicate -- shrinking the window just enough to remove the duplicate. Track the maximum window size seen at any point.

### Visual Diagram
```
  s = "abcabcbb"

  Window: [ left ... right ]
  Use a Map: { char -> last seen index }

  right=0: 'a' not in window  -> window=[a]           size=1  max=1
  right=1: 'b' not in window  -> window=[a,b]         size=2  max=2
  right=2: 'c' not in window  -> window=[a,b,c]       size=3  max=3
  right=3: 'a' IN window at 0 -> move left to max(left, 0+1)=1
                                  window=[b,c,a]       size=3  max=3
  right=4: 'b' IN window at 1 -> move left to max(left, 1+1)=2
                                  window=[c,a,b]       size=3  max=3
  right=5: 'c' IN window at 2 -> move left to max(left, 2+1)=3
                                  window=[a,b,c]       size=3  max=3
  right=6: 'b' IN window at 4 -> move left to max(left, 4+1)=5
                                  window=[c,b]         size=2  max=3
  right=7: 'b' IN window at 6 -> move left to max(left, 6+1)=7
                                  window=[b]           size=1  max=3

  Answer: 3  ("abc")
```

### Code Example
```javascript
/**
 * Longest Substring Without Repeating Characters (LeetCode #3)
 *
 * @param {string} s
 * @returns {number} length of the longest substring with all unique chars
 */
function lengthOfLongestSubstring(s) {
  // Map: character -> its most recently seen index
  const lastSeen = new Map();
  let maxLen = 0;
  let left = 0; // left boundary of current valid window

  for (let right = 0; right < s.length; right++) {
    const ch = s[right];

    if (lastSeen.has(ch) && lastSeen.get(ch) >= left) {
      // char is inside the current window -- shrink window from left
      // move left to just PAST the previous occurrence
      left = lastSeen.get(ch) + 1;
    }

    // Update the last seen index for this character
    lastSeen.set(ch, right);

    // Update max window size
    maxLen = Math.max(maxLen, right - left + 1);
  }

  return maxLen;
}

// ============================================================
// Tests
// ============================================================

console.log(lengthOfLongestSubstring("abcabcbb")); // 3  ("abc")
console.log(lengthOfLongestSubstring("bbbbb"));    // 1  ("b")
console.log(lengthOfLongestSubstring("pwwkew"));   // 3  ("wke")
console.log(lengthOfLongestSubstring(""));         // 0
console.log(lengthOfLongestSubstring("dvdf"));     // 3  ("vdf")
console.log(lengthOfLongestSubstring("abcdef"));   // 6  (whole string)
console.log(lengthOfLongestSubstring("aab"));      // 2  ("ab")

// ============================================================
// Variation: return the actual substring, not just its length
// ============================================================
function longestSubstring(s) {
  const lastSeen = new Map();
  let maxLeft = 0, maxRight = -1;
  let left = 0;

  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (lastSeen.has(ch) && lastSeen.get(ch) >= left) {
      left = lastSeen.get(ch) + 1;
    }
    lastSeen.set(ch, right);
    if (right - left > maxRight - maxLeft) {
      maxLeft = left;
      maxRight = right;
    }
  }
  return s.slice(maxLeft, maxRight + 1);
}
console.log(longestSubstring("abcabcbb")); // "abc"
console.log(longestSubstring("pwwkew"));   // "wke"
```

### Step-by-Step Explanation
1. **Sliding window concept**: Maintain a window `[left, right]` guaranteed to contain no duplicates. Expand `right` each iteration. Contract `left` only when a duplicate is found inside the window.
2. **`lastSeen.get(ch) >= left` check**: This is crucial. The character might appear in `lastSeen` but at an index BEFORE `left` (meaning it was evicted from the current window). We must ignore those stale entries. The `>= left` guard ensures we only jump left when the previous occurrence is actually inside the current window.
3. **O(n) guarantee**: Each character is visited once by `right`. The `left` pointer only ever moves forward, never backward. So total work across all iterations is O(n).
4. **Why Map over Set**: A Set would tell us IF a char is in the window but not WHERE. With a Map we know the index of the last occurrence, so we can jump `left` forward directly in O(1) instead of sliding one step at a time.
5. **Window size formula**: At any `right`, the window is `s[left..right]` (inclusive), size = `right - left + 1`.

### Complexity

| | Time | Space | Notes |
|-|------|-------|-------|
| This solution | O(n) | O(min(n, charset)) | Map holds at most alphabet size entries |
| Brute force | O(n^3) | O(n) | Every pair of indices, check uniqueness |
| Sliding + Set | O(n) | O(min(n, charset)) | Same complexity, but Set requires 2-pointer advancement |

## Q145: Longest substring without repeating characters (sliding window).

### ELI5
Imagine you are walking along a string of characters with two fingers: a left finger (start of window) and a right finger (current character). You keep expanding the right finger. Whenever you hit a character that already exists between your two fingers, you slide the left finger forward past the first occurrence of that duplicate -- shrinking the window just enough to remove the duplicate. Track the maximum window size seen at any point.

### Visual Diagram
```
  s = "abcabcbb"

  Window: [ left ... right ]
  Use a Map: { char -> last seen index }

  right=0: 'a' not in window  -> window=[a]           size=1  max=1
  right=1: 'b' not in window  -> window=[a,b]         size=2  max=2
  right=2: 'c' not in window  -> window=[a,b,c]       size=3  max=3
  right=3: 'a' IN window at 0 -> move left to max(left, 0+1)=1
                                  window=[b,c,a]       size=3  max=3
  right=4: 'b' IN window at 1 -> move left to max(left, 1+1)=2
                                  window=[c,a,b]       size=3  max=3
  right=5: 'c' IN window at 2 -> move left to max(left, 2+1)=3
                                  window=[a,b,c]       size=3  max=3
  right=6: 'b' IN window at 4 -> move left to max(left, 4+1)=5
                                  window=[c,b]         size=2  max=3
  right=7: 'b' IN window at 6 -> move left to max(left, 6+1)=7
                                  window=[b]           size=1  max=3

  Answer: 3  ("abc")
```

### Code Example
```javascript
/**
 * Longest Substring Without Repeating Characters (LeetCode #3)
 *
 * @param {string} s
 * @returns {number} length of the longest substring with all unique chars
 */
function lengthOfLongestSubstring(s) {
  // Map: character -> its most recently seen index
  const lastSeen = new Map();
  let maxLen = 0;
  let left = 0; // left boundary of current valid window

  for (let right = 0; right < s.length; right++) {
    const ch = s[right];

    if (lastSeen.has(ch) && lastSeen.get(ch) >= left) {
      // char is inside the current window -- shrink window from left
      // move left to just PAST the previous occurrence
      left = lastSeen.get(ch) + 1;
    }

    // Update the last seen index for this character
    lastSeen.set(ch, right);

    // Update max window size
    maxLen = Math.max(maxLen, right - left + 1);
  }

  return maxLen;
}

// ============================================================
// Tests
// ============================================================

console.log(lengthOfLongestSubstring("abcabcbb")); // 3  ("abc")
console.log(lengthOfLongestSubstring("bbbbb"));    // 1  ("b")
console.log(lengthOfLongestSubstring("pwwkew"));   // 3  ("wke")
console.log(lengthOfLongestSubstring(""));         // 0
console.log(lengthOfLongestSubstring("dvdf"));     // 3  ("vdf")
console.log(lengthOfLongestSubstring("abcdef"));   // 6  (whole string)
console.log(lengthOfLongestSubstring("aab"));      // 2  ("ab")

// ============================================================
// Variation: return the actual substring, not just its length
// ============================================================
function longestSubstring(s) {
  const lastSeen = new Map();
  let maxLeft = 0, maxRight = -1;
  let left = 0;

  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (lastSeen.has(ch) && lastSeen.get(ch) >= left) {
      left = lastSeen.get(ch) + 1;
    }
    lastSeen.set(ch, right);
    if (right - left > maxRight - maxLeft) {
      maxLeft = left;
      maxRight = right;
    }
  }
  return s.slice(maxLeft, maxRight + 1);
}
console.log(longestSubstring("abcabcbb")); // "abc"
console.log(longestSubstring("pwwkew"));   // "wke"
```

### Step-by-Step Explanation
1. **Sliding window concept**: Maintain a window `[left, right]` guaranteed to contain no duplicates. Expand `right` each iteration. Contract `left` only when a duplicate is found inside the window.
2. **`lastSeen.get(ch) >= left` check**: This is crucial. The character might appear in `lastSeen` but at an index BEFORE `left` (meaning it was evicted from the current window). We must ignore those stale entries. The `>= left` guard ensures we only jump left when the previous occurrence is actually inside the current window.
3. **O(n) guarantee**: Each character is visited once by `right`. The `left` pointer only ever moves forward, never backward. So total work across all iterations is O(n).
4. **Why Map over Set**: A Set would tell us IF a char is in the window but not WHERE. With a Map we know the index of the last occurrence, so we can jump `left` forward directly in O(1) instead of sliding one step at a time.
5. **Window size formula**: At any `right`, the window is `s[left..right]` (inclusive), size = `right - left + 1`.

### Complexity

| | Time | Space | Notes |
|-|------|-------|-------|
| This solution | O(n) | O(min(n, charset)) | Map holds at most alphabet size entries |
| Brute force | O(n^3) | O(n) | Every pair of indices, check uniqueness |
| Sliding + Set | O(n) | O(min(n, charset)) | Same complexity, but Set requires 2-pointer advancement |

## Q146: Reverse a linked list -- iterative and recursive.

### ELI5
A singly linked list is a chain of nodes where each node points to the next one. To reverse it, imagine you are standing in the middle of the chain and you need to flip every arrow. Iteratively: hold three pointers (previous, current, next), flip one arrow per step, advance all three. Recursively: trust that the rest of the list is already reversed, then fix the one connection at the current node.

### Visual Diagram
```
  Original:  1 -> 2 -> 3 -> 4 -> 5 -> null
  Reversed:  5 -> 4 -> 3 -> 2 -> 1 -> null

  Iterative step-by-step:
  prev=null  curr=1  next=2
  Step 1:  1.next = null   (flip arrow)  prev=1  curr=2  next=3
  Step 2:  2.next = 1      (flip arrow)  prev=2  curr=3  next=4
  Step 3:  3.next = 2      (flip arrow)  prev=3  curr=4  next=5
  Step 4:  4.next = 3      (flip arrow)  prev=4  curr=5  next=null
  Step 5:  5.next = 4      (flip arrow)  prev=5  curr=null  -> done
  New head = prev = 5

  Recursive mental model:
  reverseList(1->2->3->4->5)
    reverseList(2->3->4->5)        <- trust this returns 5->4->3->2
      ...
      returns new head = 5
    now: 2.next.next = 1  (5->4->3->2->1)
         2.next = null    (break old link from 2)
    return new head = 5
```

### Code Example
```javascript
// Node definition (shared by both implementations)
class ListNode {
  constructor(val, next = null) {
    this.val = val;
    this.next = next;
  }
}

// Helper: build list from array
function buildList(arr) {
  let head = null;
  for (let i = arr.length - 1; i >= 0; i--) {
    head = new ListNode(arr[i], head);
  }
  return head;
}

// Helper: convert list to array for testing
function toArray(head) {
  const result = [];
  while (head) { result.push(head.val); head = head.next; }
  return result;
}

// ============================================================
// Iterative reversal -- O(n) time, O(1) space
// ============================================================
function reverseListIterative(head) {
  let prev = null;
  let curr = head;

  while (curr !== null) {
    const nextNode = curr.next; // save next before overwriting
    curr.next = prev;           // flip the arrow
    prev = curr;                // advance prev
    curr = nextNode;            // advance curr
  }

  return prev; // prev is now the new head
}

// ============================================================
// Recursive reversal -- O(n) time, O(n) space (call stack)
// ============================================================
function reverseListRecursive(head) {
  // Base case: empty list or single node is already reversed
  if (head === null || head.next === null) return head;

  // Recurse: reverse everything from head.next onward
  // newHead is the last node of the original list (the new head)
  const newHead = reverseListRecursive(head.next);

  // head.next still points to the node AFTER head in the original list.
  // That node's .next should now point back to head.
  head.next.next = head;

  // Disconnect head from what comes after it (avoids a cycle)
  head.next = null;

  return newHead;
}

// ============================================================
// Tests
// ============================================================

const list1 = buildList([1, 2, 3, 4, 5]);
console.log(toArray(reverseListIterative(list1))); // [5,4,3,2,1]

const list2 = buildList([1, 2, 3, 4, 5]);
console.log(toArray(reverseListRecursive(list2))); // [5,4,3,2,1]

// Edge cases
console.log(toArray(reverseListIterative(null)));            // []
console.log(toArray(reverseListIterative(buildList([1]))));  // [1]
console.log(toArray(reverseListIterative(buildList([1,2])))); // [2,1]
```

### Step-by-Step Explanation
**Iterative:**
1. Start with `prev=null, curr=head`.
2. Save `curr.next` before overwriting it (otherwise we lose the rest of the list).
3. Set `curr.next = prev` -- this reverses the pointer.
4. Advance: `prev = curr`, `curr = savedNext`.
5. Repeat until `curr === null`. `prev` is the new head.

**Recursive:**
1. Base case: one node or empty -- already reversed, return as-is.
2. Recursively reverse `head.next`. This returns the NEW head of the reversed tail.
3. After recursion, `head.next` still points to the last node of the tail (which is now the second-to-last in the reversed list). Set `head.next.next = head` to make that node point back to `head`.
4. Set `head.next = null` to terminate the list (otherwise `head` still points forward creating a cycle).
5. Return `newHead` all the way up the call stack.

### Complexity

| Approach | Time | Space | Notes |
|----------|------|-------|-------|
| Iterative | O(n) | O(1) | Constant extra space |
| Recursive | O(n) | O(n) | O(n) call stack depth |

## Q146: Reverse a linked list -- iterative and recursive.

### ELI5
A singly linked list is a chain of nodes where each node points to the next one. To reverse it, imagine you are standing in the middle of the chain and you need to flip every arrow. Iteratively: hold three pointers (previous, current, next), flip one arrow per step, advance all three. Recursively: trust that the rest of the list is already reversed, then fix the one connection at the current node.

### Visual Diagram
```
  Original:  1 -> 2 -> 3 -> 4 -> 5 -> null
  Reversed:  5 -> 4 -> 3 -> 2 -> 1 -> null

  Iterative step-by-step:
  prev=null  curr=1  next=2
  Step 1:  1.next = null   (flip arrow)  prev=1  curr=2  next=3
  Step 2:  2.next = 1      (flip arrow)  prev=2  curr=3  next=4
  Step 3:  3.next = 2      (flip arrow)  prev=3  curr=4  next=5
  Step 4:  4.next = 3      (flip arrow)  prev=4  curr=5  next=null
  Step 5:  5.next = 4      (flip arrow)  prev=5  curr=null  -> done
  New head = prev = 5

  Recursive mental model:
  reverseList(1->2->3->4->5)
    reverseList(2->3->4->5)        <- trust this returns 5->4->3->2
      ...
      returns new head = 5
    now: 2.next.next = 1  (5->4->3->2->1)
         2.next = null    (break old link from 2)
    return new head = 5
```

### Code Example
```javascript
// Node definition (shared by both implementations)
class ListNode {
  constructor(val, next = null) {
    this.val = val;
    this.next = next;
  }
}

// Helper: build list from array
function buildList(arr) {
  let head = null;
  for (let i = arr.length - 1; i >= 0; i--) {
    head = new ListNode(arr[i], head);
  }
  return head;
}

// Helper: convert list to array for testing
function toArray(head) {
  const result = [];
  while (head) { result.push(head.val); head = head.next; }
  return result;
}

// ============================================================
// Iterative reversal -- O(n) time, O(1) space
// ============================================================
function reverseListIterative(head) {
  let prev = null;
  let curr = head;

  while (curr !== null) {
    const nextNode = curr.next; // save next before overwriting
    curr.next = prev;           // flip the arrow
    prev = curr;                // advance prev
    curr = nextNode;            // advance curr
  }

  return prev; // prev is now the new head
}

// ============================================================
// Recursive reversal -- O(n) time, O(n) space (call stack)
// ============================================================
function reverseListRecursive(head) {
  // Base case: empty list or single node is already reversed
  if (head === null || head.next === null) return head;

  // Recurse: reverse everything from head.next onward
  // newHead is the last node of the original list (the new head)
  const newHead = reverseListRecursive(head.next);

  // head.next still points to the node AFTER head in the original list.
  // That node's .next should now point back to head.
  head.next.next = head;

  // Disconnect head from what comes after it (avoids a cycle)
  head.next = null;

  return newHead;
}

// ============================================================
// Tests
// ============================================================

const list1 = buildList([1, 2, 3, 4, 5]);
console.log(toArray(reverseListIterative(list1))); // [5,4,3,2,1]

const list2 = buildList([1, 2, 3, 4, 5]);
console.log(toArray(reverseListRecursive(list2))); // [5,4,3,2,1]

// Edge cases
console.log(toArray(reverseListIterative(null)));            // []
console.log(toArray(reverseListIterative(buildList([1]))));  // [1]
console.log(toArray(reverseListIterative(buildList([1,2])))); // [2,1]
```

### Step-by-Step Explanation
**Iterative:**
1. Start with `prev=null, curr=head`.
2. Save `curr.next` before overwriting it (otherwise we lose the rest of the list).
3. Set `curr.next = prev` -- this reverses the pointer.
4. Advance: `prev = curr`, `curr = savedNext`.
5. Repeat until `curr === null`. `prev` is the new head.

**Recursive:**
1. Base case: one node or empty -- already reversed, return as-is.
2. Recursively reverse `head.next`. This returns the NEW head of the reversed tail.
3. After recursion, `head.next` still points to the last node of the tail (which is now the second-to-last in the reversed list). Set `head.next.next = head` to make that node point back to `head`.
4. Set `head.next = null` to terminate the list (otherwise `head` still points forward creating a cycle).
5. Return `newHead` all the way up the call stack.

### Complexity

| Approach | Time | Space | Notes |
|----------|------|-------|-------|
| Iterative | O(n) | O(1) | Constant extra space |
| Recursive | O(n) | O(n) | O(n) call stack depth |

## Q147: Detect a cycle in a linked list (Floyd's algorithm).

### ELI5
Floyd's cycle detection is the "tortoise and hare" trick. Two runners start at the head: the slow runner (tortoise) moves one step at a time, the fast runner (hare) moves two steps at a time. If there is NO cycle, the fast runner will reach the end (null) -- no cycle. If there IS a cycle, the fast runner will eventually lap the slow runner and they will meet at the same node. Think of a circular running track -- a faster runner will eventually lap a slower one.

### Visual Diagram
```
  No cycle:
  1 -> 2 -> 3 -> 4 -> 5 -> null
  slow: 1, 2, 3, 4, 5, null  -> done, no cycle

  Cycle example:
  1 -> 2 -> 3 -> 4 -> 5
                 ^         |
                 |         v
                 +-------- 6  (6.next = 3, cycle at node 3)

  Steps:
  slow  fast
  1     1
  2     3     (fast skips 2 -> lands on 3)
  3     5
  4     4     (fast skips 6 -> 3 -> lands on... wait, 5.next=6, 6.next=3)
  Let's trace: fast after each step:
  start: fast=1
  step1: fast=1.next.next = 3
  step2: fast=3.next.next = 5
  step3: fast=5.next.next = 3   (5->6->3)
  step4: fast=3.next.next = 5   (3->4->5)
  Meanwhile slow:
  step1: slow=2
  step2: slow=3
  step3: slow=4
  step4: slow=5        <- slow==fast==5  CYCLE DETECTED

  Finding cycle entry point: (optional)
  Reset one pointer to head, keep other at meeting point,
  both advance one step -- they meet at the cycle start node.
```

### Code Example
```javascript
class ListNode {
  constructor(val, next = null) {
    this.val = val;
    this.next = next;
  }
}

// ============================================================
// hasCycle: returns true/false
// O(n) time, O(1) space
// ============================================================
function hasCycle(head) {
  let slow = head;
  let fast = head;

  while (fast !== null && fast.next !== null) {
    slow = slow.next;           // advance 1 step
    fast = fast.next.next;      // advance 2 steps

    if (slow === fast) {
      return true; // they met -- cycle detected
    }
  }

  return false; // fast reached end -- no cycle
}

// ============================================================
// detectCycleStart: returns the node where the cycle begins
// (or null if no cycle)
// Floyd's phase 2: after finding the meeting point,
// reset one pointer to head, advance both one step at a time.
// They will meet at the cycle entry node.
// ============================================================
function detectCycleStart(head) {
  let slow = head;
  let fast = head;
  let hasCycleDetected = false;

  // Phase 1: find meeting point
  while (fast !== null && fast.next !== null) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) {
      hasCycleDetected = true;
      break;
    }
  }

  if (!hasCycleDetected) return null;

  // Phase 2: find cycle entry
  // Reset slow to head; fast stays at meeting point
  slow = head;
  while (slow !== fast) {
    slow = slow.next;
    fast = fast.next; // both move ONE step now
  }

  return slow; // cycle entry node
}

// ============================================================
// Tests
// ============================================================

// Build list: 1 -> 2 -> 3 -> 4 -> 5 -> null  (no cycle)
const n1 = new ListNode(1);
const n2 = new ListNode(2);
const n3 = new ListNode(3);
const n4 = new ListNode(4);
const n5 = new ListNode(5);
n1.next = n2; n2.next = n3; n3.next = n4; n4.next = n5;
console.log(hasCycle(n1)); // false

// Add cycle: n5.next = n3  (cycle: 3 -> 4 -> 5 -> 3)
n5.next = n3;
console.log(hasCycle(n1));                    // true
console.log(detectCycleStart(n1).val);        // 3

// Cycle at head (entire list is a loop)
const a = new ListNode(1);
const b = new ListNode(2);
a.next = b; b.next = a;
console.log(hasCycle(a));                     // true
console.log(detectCycleStart(a).val);         // 1

// Single node, no cycle
const solo = new ListNode(1);
console.log(hasCycle(solo));   // false

// Single node, self-loop
solo.next = solo;
console.log(hasCycle(solo));   // true
```

### Step-by-Step Explanation
1. **Why two pointers?**: Using a Set to track visited nodes would also work (O(n) time, O(n) space). Floyd's algorithm achieves O(1) space by leveraging pointer math.
2. **Termination without cycle**: If there is no cycle, the fast pointer will reach `null` or a node with no `.next`. The while condition `fast !== null && fast.next !== null` catches both cases.
3. **Meeting guaranteed**: If there is a cycle of length L, and the fast pointer enters the cycle k steps before the slow pointer, the gap between them decreases by 1 each step (fast gains 1 step on slow per iteration). So they must meet within L steps of slow entering the cycle.
4. **Phase 2 math (cycle entry)**: If the head is `F` steps from the cycle entry, and the meeting point is `k` steps into the cycle from the entry, then: `2*F + 2*k = F + k + m*L` (fast lapped slow). This simplifies to `F = m*L - k`, meaning a pointer from the head will meet a pointer from the meeting point (both moving at speed 1) exactly at the cycle entry after F steps.
5. **`fast.next !== null` guard**: Needed because `fast.next.next` would throw if `fast.next` is `null` (we can't access `.next` on null).

### Complexity

| Approach | Time | Space | Notes |
|----------|------|-------|-------|
| Floyd's (hasCycle) | O(n) | O(1) | No extra data structures |
| Hash Set approach | O(n) | O(n) | Store all visited nodes |
| detectCycleStart | O(n) | O(1) | Two phases, both O(n) |
