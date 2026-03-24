# Caching Strategies & Message Queues
> Resume Signal: Redis Pub/Sub, horizontal scaling

---

## STAR Interview Answer

| | |
|---|---|
| **Situation** | A Node.js API was making redundant DB queries on every request for relatively static data (user profiles, product catalog, config). Under horizontal scaling, each new instance had no awareness of what others had already fetched, multiplying DB load linearly. |
| **Task** | Reduce DB read pressure and enable event propagation across all horizontally-scaled instances without coupling them directly. |
| **Action** | Implemented Cache-Aside pattern with Redis for user profiles (1-hour TTL, `del` on write). Added cache stampede protection with a Redis `SET NX` mutex for hot keys. Used Redis Pub/Sub for cross-instance cache invalidation — when user data changed, a publish to `cache-invalidation` channel caused all instances to evict their local copy. For async jobs (email, webhooks), used Bull queues backed by Redis with retry logic and a dead-letter queue. |
| **Result** | DB read load reduced ~65%. Horizontal scaling no longer caused DB connection storms. Cache hit rate reached 89% for read-heavy endpoints. Bull queue provided reliable retry — zero lost jobs during a Redis restart after enabling AOF persistence. |

---

## ELI5 — Caching

A cache is a cheat sheet. Instead of doing the full calculation every time, you write the answer down the first time and just read the cheat sheet after. The risk: the cheat sheet goes stale. The art is knowing when to update it.

## ELI5 — Message Queues vs Pub/Sub

A queue is a to-do list with one worker — tasks pile up, one worker picks them off in order. Pub/Sub is a radio broadcast — one sender, many listeners, all receive the same signal simultaneously.

---

## Caching Strategies

### Cache-Aside (Lazy Loading) — most common

Application code owns the cache logic: **check cache → miss → read DB → populate cache**.

```
Read flow:
  App → Cache hit?  YES → return cached value
                    NO  → App reads DB → App writes to cache → return value

Write flow:
  App writes DB → App DELETES (or updates) cache key
```

```javascript
async function getUserById(id) {
  const cacheKey = `user:${id}`;

  // 1. Check cache
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // 2. Cache miss — fetch from DB
  const user = await db.users.findById(id);
  if (!user) return null;

  // 3. Populate cache with TTL (seconds)
  await redis.setex(cacheKey, 3600, JSON.stringify(user));
  return user;
}

async function updateUser(id, updates) {
  await db.users.updateOne({ _id: id }, updates);
  // Invalidate so next read fetches fresh data
  await redis.del(`user:${id}`);
}
```

**Pros:** Only caches what's actually read. Simple. Cache failures are non-fatal (fall through to DB).  
**Cons:** First request always misses (cold start). Risk of stale data if invalidation is missed.

---

### Write-Through

**Every write goes to cache AND DB simultaneously.** Cache is always up to date.

```
Write flow:
  App → write to Cache → Cache synchronously writes to DB → confirm

Read flow:
  App → always hits cache (always populated after writes)
```

```javascript
async function updateUserProfile(id, updates) {
  // Write to DB first (source of truth)
  const updated = await db.users.findByIdAndUpdate(id, updates, { new: true });

  // Immediately update cache
  await redis.setex(`user:${id}`, 3600, JSON.stringify(updated));
  return updated;
}
```

**Pros:** Cache always consistent with DB. No stale reads.  
**Cons:** Write latency doubles (two writes). Cache fills with data that may never be read.

---

### Write-Behind (Write-Back)

Write to cache only, return immediately. Background worker flushes to DB asynchronously.

**Pros:** Ultra-low write latency (in-memory only).  
**Cons:** Risk of data loss if cache crashes before flush. Complex to implement correctly.  
**Use for:** High-frequency counters (view counts, likes), metric aggregation.

---

### Cache Comparison

| Strategy | Write latency | Read latency | Consistency | Best for |
|----------|--------------|--------------|-------------|----------|
| Cache-Aside | Low (DB only) | Miss: high, Hit: low | Eventual | Read-heavy, general purpose |
| Write-Through | High (DB + cache) | Always low | Strong | Profiles, configs; read-heavy |
| Write-Behind | Very low (cache only) | Always low | Eventual (async) | Counters, metrics, leaderboards |
| Read-Through | Low | Miss: high, Hit: low | Eventual | Transparent caching layer |

---

## Eviction Policies

When the cache is full, something must go. Redis eviction policies:

| Policy | Behaviour | Use when |
|--------|-----------|----------|
| `allkeys-lru` | Evict least-recently-used from ALL keys | General-purpose caching |
| `volatile-lru` | LRU from keys WITH a TTL | Mix of permanent + cached data |
| `allkeys-lfu` | Evict least-frequently-used | Skewed access patterns |
| `volatile-ttl` | Evict key with shortest remaining TTL | Expire soonest first |
| `noeviction` | Return error when full | When losing data is unacceptable |

```bash
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
```

---

## Cache Failure Patterns

### Cache Stampede (Thundering Herd)

100 requests hit simultaneously at the same expired key → all miss → all hammer DB.

```javascript
// Fix: probabilistic early expiry + mutex lock
async function getWithLock(key, fetchFn, ttl = 3600) {
  const val = await redis.get(key);
  if (val) return JSON.parse(val);

  const lockKey = `lock:${key}`;
  const acquired = await redis.set(lockKey, '1', 'NX', 'PX', 5000); // 5s lock

  if (!acquired) {
    // Another instance is fetching — wait briefly and retry from cache
    await new Promise(r => setTimeout(r, 200));
    const retry = await redis.get(key);
    return retry ? JSON.parse(retry) : null;
  }

  try {
    const data = await fetchFn();
    await redis.setex(key, ttl, JSON.stringify(data));
    return data;
  } finally {
    await redis.del(lockKey);
  }
}
```

### Cache Penetration

Queries for keys that **never exist** (null results) bypass cache every time → DB hammered.

```javascript
// Fix: cache null results with a short TTL
const result = await db.users.findById(id);
const value = result ?? '__NULL__';  // sentinel value
await redis.setex(`user:${id}`, result ? 3600 : 60, value); // 60s for nulls
```

### Cache Avalanche

Many keys expire at the same time → mass DB hits simultaneously.

```javascript
// Fix: jitter the TTL
const ttl = 3600 + Math.floor(Math.random() * 300); // 3600–3900s
await redis.setex(key, ttl, value);
```

---

## Message Queues vs Pub/Sub

| Dimension | Message Queue | Pub/Sub |
|-----------|--------------|---------|
| Delivery | **One consumer** receives each message | **All subscribers** receive each message |
| Pattern | Task distribution (work queue) | Event broadcast |
| Message retention | Until consumed (or DLQ) | Usually ephemeral (fire-and-forget) |
| Consumer scaling | Add workers to parallelise processing | Each subscriber independently receives all messages |
| Use case | Email sending, video encoding, payment processing | Notifications, cache invalidation, real-time feeds |
| Examples | SQS, RabbitMQ, Bull | Redis Pub/Sub, SNS, Kafka topics with consumer groups |

```
Queue (SQS / Bull):                    Pub/Sub (Redis / SNS):

Producer → [msg1, msg2, msg3]          Publisher → broadcast
               ↓         ↓                ↓         ↓          ↓
           Worker A   Worker B         Sub A      Sub B      Sub C
           (gets msg1) (gets msg2)    (ALL get   (ALL get   (ALL get
                                       msg)       msg)       msg)
```

---

## Redis Pub/Sub (practical)

```javascript
// publisher.js
import Redis from 'ioredis';
const pub = new Redis(process.env.REDIS_URL);

export async function publishOrderEvent(event) {
  await pub.publish('order-events', JSON.stringify(event));
}

// subscriber.js (runs on every service instance that cares)
import Redis from 'ioredis';
const sub = new Redis(process.env.REDIS_URL);

sub.subscribe('order-events');

sub.on('message', (channel, message) => {
  const event = JSON.parse(message);
  switch (event.type) {
    case 'ORDER_PLACED':  handleOrderPlaced(event.data);  break;
    case 'ORDER_SHIPPED': handleOrderShipped(event.data); break;
  }
});
```

**Redis Pub/Sub limitations:** no persistence, no consumer groups, messages lost if subscriber is offline. For durability use **Redis Streams** or **Kafka**.

---

## When to Use What

| Scenario | Solution |
|----------|----------|
| Send email after purchase | Queue (SQS/Bull) — one worker sends one email |
| Invalidate cache on N servers | Pub/Sub — all servers receive and clear their local cache |
| Process video upload | Queue — one worker, retries on failure, DLQ for dead jobs |
| Real-time order status updates | Pub/Sub → WebSocket push to client |
| User activity event log (replay) | Kafka Streams — ordered, durable, replayable |
| Rate-limit counter | Redis INCR + EXPIRE — atomic in-memory counter |

---

## Key Interview Q&A

**Q: You use Redis for caching AND Pub/Sub. Isn't that risky putting all eggs in one basket?**
> Yes — separate Redis instances for cache and Pub/Sub in production. A Pub/Sub message spike shouldn't evict cached data. Use Redis Cluster or separate `maxmemory` policies.

**Q: How did your Redis Pub/Sub + horizontal scaling work?**
> Each new Node.js instance subscribes to Redis channels on startup. When an order event fires, Redis broadcasts to every subscriber simultaneously. Each instance handles the message for its own connected WebSocket clients. This way horizontal scaling doesn't require sticky sessions — all instances are equal.

**Q: What happens to messages if a Redis subscriber goes down?**
> They're lost — Redis Pub/Sub is at-most-once. For at-least-once delivery, use Redis Streams (consumer groups with ACKs) or SQS with visibility timeout and DLQ.

**Q: Cache-Aside vs Write-Through — which did you use?**
> Cache-Aside for user profiles and query results — read-heavy, acceptable stale window. Write-Through for session tokens and feature flags — must always reflect latest state.
