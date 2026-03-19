# Interview Q&A & Scenarios for 7+ Years Experience

## Scenario 1: Design E-Commerce Order System

**CONTEXT**: Build MongoDB schema for e-commerce platform handling 100K orders/day, need real-time inventory management and historical order tracking.

**QUESTIONS**:
1. How do you model orders with items? Embed or reference?
2. How do you prevent overselling inventory?
3. How do you optimize historical order queries?
4. What indexing strategy would you use?

**SOLUTION**:

```javascript
// SCHEMA DESIGN: Orders collection with embedded items (fast queries)
db.createCollection("orders", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["customerId", "items", "total", "status"],
      properties: {
        _id: { bsonType: "objectId" },
        customerId: { bsonType: "objectId" },
        items: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["productId", "quantity", "price"],
            properties: {
              productId: { bsonType: "objectId" },
              productName: { bsonType: "string" },
              quantity: { bsonType: "int", minimum: 1 },
              price: { bsonType: "double" },
              discount: { bsonType: "double" }
            }
          }
        },
        shippingAddress: {
          bsonType: "object",
          properties: {
            street: { bsonType: "string" },
            city: { bsonType: "string" },
            country: { bsonType: "string" }
          }
        },
        totalBeforeTax: { bsonType: "double" },
        tax: { bsonType: "double" },
        total: { bsonType: "double" },
        status: { enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"] },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
});

// INVENTORY: Separate collection (high frequency updates)
db.createCollection("inventory", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["productId", "stock"],
      properties: {
        _id: { bsonType: "objectId" },
        productId: { bsonType: "objectId" },
        stock: { bsonType: "int", minimum: 0 },
        reserved: { bsonType: "int", minimum: 0 },
        lastRestockedAt: { bsonType: "date" }
      }
    }
  }
});

// ATOMIC OPERATION: Order creation + inventory update (prevent overselling)
const session = db.getMongo().startSession();
session.startTransaction();

try {
  // 1. Create order
  const orderResult = db.orders.insertOne({
    customerId: customerId,
    items: [{ productId: productId, quantity: 5, price: 100 }],
    total: 500,
    status: "pending",
    createdAt: new Date()
  }, { session });

  // 2. Deduct inventory (atomic check-and-set)
  const updateResult = db.inventory.updateOne(
    {
      productId: productId,
      stock: { $gte: 5 }  // ensure sufficient stock
    },
    {
      $inc: { stock: -5, reserved: 5 }
    },
    { session }
  );

  if (updateResult.matchedCount === 0) {
    throw new Error("Insufficient inventory");
  }

  session.commitTransaction();
  console.log("Order created successfully");
} catch (error) {
  session.abortTransaction();
  console.error("Order failed:", error.message);
} finally {
  session.endSession();
}

// INDEXING STRATEGY
db.orders.createIndex({ customerId: 1, createdAt: -1 });  // customer order history
db.orders.createIndex({ status: 1, createdAt: -1 });      // active orders
db.orders.createIndex({ "items.productId": 1 });          // product orders
db.inventory.createIndex({ productId: 1 }, { unique: true });

// QUERY 1: Get recent orders for customer (uses index)
db.orders.find({ customerId: customerId }).sort({ createdAt: -1 }).limit(25);

// QUERY 2: Track order status
db.orders.findOne({ _id: orderId }, { projection: { status: 1, updatedAt: 1 } });

// QUERY 3: Revenue analysis by date (aggregation)
db.orders.aggregate([
  { $match: { status: "delivered", createdAt: { $gte: startDate } } },
  { $group: {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
      dailyRevenue: { $sum: "$total" },
      orderCount: { $sum: 1 }
    }
  },
  { $sort: { _id: -1 } }
]);
```

**KEY INSIGHTS**:
- ✅ Embed items in order (always queried together)
- ✅ Separate inventory collection (high update frequency)
- ✅ Use transaction to prevent race condition (overselling)
- ✅ Strategic indexes for common queries (customer, status)
- ✅ Aggregation for analytics (doesn't slow transactional queries)

> **ELI5:** Embed items in orders is like keeping receipts with the invoice. Separate inventory is like a stock counter.
> Transactions are like booking a seat - you check availability and claim it immediately so nothing double-books.

---

## Scenario 2: Real-Time Dashboard with High Data Volume

**CONTEXT**: Build real-time analytics dashboard processing 50K events/second. Users query dashboards on-demand. Need response time < 500ms.

**CHALLENGE**: Raw event data (50K/sec × 86400 sec = 4.3 billion events/day) would be too much to query directly.

**SOLUTION** (Time-Series Optimization):

```javascript
// TIME-SERIES BUCKETS: aggregate data during insertion
// Instead of storing 4B events, store 4B/3600 = 1.2M hourly summaries

db.createCollection("event_summaries");

// HOURLY aggregation at write time
function logEvent(eventType, userId, metadata) {
  const now = new Date();
  const hourBucket = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

  db.event_summaries.updateOne(
    {
      hour: hourBucket,
      eventType: eventType,
      userId: userId
    },
    {
      $inc: { count: 1, value: metadata.value || 0 },
      $max: { maxValue: metadata.value },
      $min: { minValue: metadata.value },
      $push: { samples: { $each: [metadata], $slice: -100 } }  // keep last 100 samples
    },
    { upsert: true }
  );
}

// Index for dashboard queries
db.event_summaries.createIndex({ hour: 1, eventType: 1 });
db.event_summaries.createIndex({ userId: 1, hour: -1 });

// Dashboard query: Get last 24 hours
db.event_summaries.find({
  hour: { $gte: new Date(Date.now() - 24 * 3600000) }
}).sort({ hour: 1 });

// Response: 24 documents (1 per hour) vs 4B raw events!
// Query time: < 10ms vs potentially minutes on raw data
```

> **ELI5:** Bucketing is like binning data - instead of counting every grain of sand individually, you dump groups into buckets and count buckets.
// This is way faster for analytics than looking at each individual event.

**TIME-SERIES INSIGHTS**:
- ✅ Bucket/aggregate during write (tradeoff: write latency for read performance)
- ✅ Store histograms instead of raw data (count, sum, min, max)
- ✅ Keep samples for anomaly detection (last 100 values)
- ✅ Use time-series indexes (hour + eventType)
- ✅ Auto-delete old buckets (TTL index)

---

## Scenario 3: Handling Hot Shard Problem

**CONTEXT**: User IDs are sequential (1, 2, 3...). When shard key is userId, all new users go to last shard (hot spot). Active users always on same shard = bottleneck.

**PROBLEM**:
```
Shard 1: userId 1-333M (cold)
Shard 2: userId 333M-666M (cold)
Shard 3: userId 666M-1B (HOT! all active users)
```

**SOLUTIONS**:

```javascript
// SOLUTION 1: Hash shard key (random distribution)
db.adminCommand({
  shardCollection: "mydb.users",
  key: { userId: "hashed" }  // hash distributes randomly
});

// Result: sequential userIds now hash to different shards
// userId 1 → hash → shard 1
// userId 2 → hash → shard 2
// userId 3 → hash → shard 3
// Active users (1000, 2000, 3000...) also distributed

// SOLUTION 2: Compound shard key (if you need range queries)
db.adminCommand({
  shardCollection: "mydb.users",
  key: { region: 1, userId: "hashed" }
});

// Benefit: region-based locality + hash distribution within region
// Query by region: hits one shard
// Query by userId: scattered (but data is balanced)

// SOLUTION 3: Monitor and rebalance
// MongoDB auto-balances, but monitor hot shards
db.stats(1000000);  // stats every 1MB
// If one shard has 2× data of others = rebalancing happening

// Check shard sizes
db.adminCommand({ listShards: 1 });
```

**EXPERT DECISION**:
- Use **hash** for sequential IDs with random access patterns
- Use **compound key** if you need geographic or category locality
- Monitor with `currentOp()` to find hot spots
- Consider **chunk splitting** if one shard still hot after hashing

---

## Scenario 4: Eventual Consistency with Denormalization

**CONTEXT**: User profiles denormalized in posts collection (name, avatar, verified status). When user updates profile, posts must reflect changes (but delays acceptable).

**CHALLENGE**: Keep denormalized data fresh without real-time consistency requirements.

**SOLUTION** (Change Streams + Background Jobs):

```javascript
// APPROACH 1: Change Streams (reactive)
// Monitor user profile changes, update posts in real-time

const changeStream = db.users.watch([
  { $match: { "operationType": ["update", "replace"] } }
]);

changeStream.on("change", async (change) => {
  const userId = change.documentKey._id;
  const updatedFields = change.updateDescription.updatedFields;

  // If profile changed, update posts
  if (updatedFields.name || updatedFields.avatar || updatedFields.verified) {
    const profile = await db.users.findOne({ _id: userId });

    db.posts.updateMany(
      { authorId: userId },
      { 
        $set: {
          authorName: profile.name,
          authorAvatar: profile.avatar,
          authorVerified: profile.verified,
          denormUpdateTime: new Date()
        }
      }
    );
  }
});

// APPROACH 2: Scheduled batch job (periodic)
// Every 5 minutes, update stale denormalized data

schedule.every('5m').do(async () => {
  // Find posts with stale denormalized data (> 1 hour old)
  const oldPosts = db.posts.find({
    denormUpdateTime: { $lt: new Date(Date.now() - 3600000) }
  }).limit(10000);

  for (const post of oldPosts) {
    const user = db.users.findOne({ _id: post.authorId });
    db.posts.updateOne(
      { _id: post._id },
      { 
        $set: {
          authorName: user.name,
          authorAvatar: user.avatar,
          denormUpdateTime: new Date()
        }
      }
    );
  }
});

// APPROACH 3: Event-driven (webhooks)
// User updates profile → trigger webhook → update posts

// API endpoint for user profile update
app.put("/api/users/:id", async (req, res) => {
  const result = db.users.updateOne(
    { _id: req.params.id },
    { $set: req.body }
  );

  // Trigger webhook
  await publishEvent("user.updated", {
    userId: req.params.id,
    changes: req.body
  });

  res.json(result);
});

// Message queue handler
messageQueue.subscribe("user.updated", async (event) => {
  const user = db.users.findOne({ _id: event.userId });

  db.posts.updateMany(
    { authorId: event.userId },
    { $set: { authorName: user.name, authorAvatar: user.avatar } }
  );
});
```

**DECISION**:
- ✅ Use **Change Streams** for reactive updates (real-time, resource-intensive)
- ✅ Use **Scheduled jobs** for periodic sync (simpler, higher latency)
- ✅ Use **Event webhooks** for event-driven architecture (decoupled, eventual consistency)
- ✅ **Accept eventual consistency**: denormalized data lags 5-60 minutes (user sees old avatar briefly = acceptable)

> **ELI5:** Denormalization is like copying someone's name on your notes instead of looking it up each time (fast but stale).
// Change Streams are live reality TV, Scheduled jobs are replay shows, Webhooks are sending notifications.

---

## Common Interview Questions

**Q1**: "Design a MongoDB schema for a multi-tenant SaaS application."
- A: Embed tenant data, use tenant ID as shard key, isolate collections by tenant

> **ELI5:** Multi-tenant is like an apartment building - each tenant (customer) has their own apartment (data), but they share the building (server).
**Q2**: "How do you scale write-heavy workloads?"
- A: Sharding by most selective field, increase write concern safety, use bulk operations

> **ELI5:** Write-heavy is like a bank with lots of deposits. Instead of one teller, open multiple branches (shards).
**Q3**: "What's the tradeoff between embedding and referencing?"
- A: Embed for joins/performance, reference for consistency/update flexibility. Choose based on query patterns.

> **ELI5:** Embedding is like keeping a photo in your wallet (easy access, but stale if they change). Referencing is like writing a phone number (always fresh, but slow to call).
**Q4**: "How do you prevent data loss during network partition?"
- A: Use write concern {w: "majority"}, enable journaling, replica set with 3+ nodes

> **ELI5:** Write concern with majority means "don't tell me it's saved until at least 2 out of 3 copies have it". Like getting 2 witnesses to sign a contract.
**Q5**: "Design an event sourcing system with MongoDB."
- A: Immutable event log collection, snapshot collection (periodic cache), replay for state reconstruction

> **ELI5:** Event sourcing is like a bank statement - every deposit/withdrawal is recorded. You never erase a transaction, you just add new ones.
**Q6**: "How do handle time-series data at massive scale?"
- A: Pre-aggregate during writes (hourly/daily), TTL indexes for retention, time-series buckets pattern

> **ELI5:** Time-series at scale is like a weather station - instead of recording every temperature every second (too much data), record hourly averages.
**Q7**: "You have a query running 10 seconds. How do you optimize?"
- A: Check explain() for COLLSCAN, add index, use projection, consider denormalization if embedded

> **ELI5:** A slow query is like searching a library without a card catalog - you have to check every book. An index is like a card catalog.
**Q8**: "Design a payment system ensuring no duplicate charges."
- A: Idempotency key, transaction + charge logging, periodic reconciliation, error handling

> **ELI5:** "Idempotency is like pressing the elevator button - pressing it 10 times goes up once, not 10 times.
> In payments, the same request (same ID) should charge once, not multiple times (even if resubmitted).
