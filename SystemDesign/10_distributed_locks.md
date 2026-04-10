# Distributed Locks
> Resume Signal: Redis distributed locks, Redlock, DB row-level locking, race condition prevention in horizontally scaled services

---

## STAR Interview Answer

| | |
|---|---|
| **Situation** | A Node.js payment service was horizontally scaled to 5 instances. Under concurrent load, two instances would simultaneously read the same order as "pending", both charge the card, and both mark it "paid" — resulting in double charges. |
| **Task** | Ensure a single order is processed by exactly one instance at a time, with zero double-charges, across all running instances. |
| **Action** | Introduced a Redis distributed lock using `SET NX PX` with a unique per-holder token. Wrapped the critical section (read → charge → update) inside the lock. Used a Lua script for atomic check-and-delete on release so no instance could accidentally release another's lock. Set a TTL to prevent deadlocks if a process crashed mid-operation. |
| **Result** | Zero double-charge incidents post-deploy. Lock acquisition added <1ms latency to payment processing. System handled 2,000 concurrent payment requests without a single race condition under load testing. |

---

## ELI5

Imagine 10 cashiers sharing one physical cash drawer. Without a rule, two cashiers could open it at the same moment, both grab change for the same "last $20", and give it out twice. A distributed lock is like a physical key on a hook — only the cashier holding the key can open the drawer. When they're done, they hang the key back. Everyone else waits. The key lives in a place all 10 cashiers can see (Redis / the DB) — not in any one cashier's pocket (in-memory mutex only helps within one process).

---

## Why Distributed Locks Are Needed

A regular in-process `Mutex` only works within **one Node.js process**. When you scale horizontally (multiple servers / containers), each process has its own memory — they cannot share a Mutex.

```
Without distributed lock (3 instances):

  Instance A:  reads order #99 → status = "pending" ──┐
  Instance B:  reads order #99 → status = "pending" ──┤  RACE
  Instance C:  reads order #99 → status = "pending" ──┘
  
  All 3 proceed → 3 charges → disaster

With distributed lock:

  Instance A:  acquires lock:order:99 ✅ → processes → releases
  Instance B:  tries lock:order:99 ❌ → waits / returns error
  Instance C:  tries lock:order:99 ❌ → waits / returns error
```

---

## Level 1 — Cache-Level Locking (Redis)

Redis is the most common distributed lock store because:
- **Single-threaded** command processing = atomicity guaranteed
- **`SET NX PX`** is an atomic "set only if not exists + TTL" in one command
- Sub-millisecond latency
- Works across all services, languages, machines

### Basic lock (SET NX PX)

```javascript
const redis = require('ioredis');
const crypto = require('crypto');
const client = new redis(process.env.REDIS_URL);

/**
 * Acquire a Redis distributed lock.
 * Returns the lock token (string) if acquired, null if already locked.
 *
 * NX  = Set only if Not eXists (atomic — no TOCTOU race)
 * PX  = Expire in milliseconds (prevents deadlock if holder crashes)
 * token = random UUID per lock holder (prevents foreign release)
 */
async function acquireLock(lockKey, ttlMs = 5000) {
  const token = crypto.randomUUID();
  const result = await client.set(lockKey, token, 'NX', 'PX', ttlMs);
  return result === 'OK' ? token : null;  // null = already locked
}

/**
 * Release a lock ONLY if we still own it.
 * Lua script makes the check-then-delete atomic.
 * Without atomicity: lock could expire between our GET and DEL,
 * letting another holder acquire it, then we'd delete their lock.
 */
async function releaseLock(lockKey, token) {
  const luaScript = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;
  return client.eval(luaScript, 1, lockKey, token);
}

// ── Usage ─────────────────────────────────────────────────────────────────────
async function processPayment(orderId) {
  const lockKey = `lock:order:${orderId}`;
  const token = await acquireLock(lockKey, 10_000); // 10s TTL

  if (!token) {
    throw new Error('Order is already being processed — try again');
  }

  try {
    // ── CRITICAL SECTION ────────────────────────────────────────────────────
    const order = await db.findOne({ _id: orderId });
    if (order.status !== 'pending') throw new Error('Already processed');
    await chargeCard(order);
    await db.updateOne({ _id: orderId }, { $set: { status: 'paid' } });
    // ── END CRITICAL SECTION ────────────────────────────────────────────────
  } finally {
    await releaseLock(lockKey, token); // always release, even on error
  }
}
```

### Common pitfalls with simple SET NX

| Pitfall | What goes wrong | Fix |
|---|---|---|
| No TTL | Process crashes → lock held forever (deadlock) | Always set `PX` TTL |
| No owner token | Process A's lock expires, B acquires it, A releases B's lock | Store unique token per acquire, use Lua to check before delete |
| TTL too short | Critical section takes longer than TTL → two holders simultaneously | Set TTL generously (3–5× expected execution time) |
| Plain `DEL` on release | Deletes another process's lock (foreign release) | Lua check-then-delete (see above) |
| Single Redis node | Redis node crashes → lock lost or unavailable | Use Redlock (multi-node) for critical workloads |

---

## Level 1b — Cache-Level: Redlock (Multi-Node, Production Grade)

Single-node Redis has a split-brain risk: if Redis crashes after granting a lock but before the TTL, the lock is gone but the holder thinks they have it, AND a new holder can acquire it on a fresh Redis node.

**Redlock** solves this by acquiring the lock on **N/2+1 nodes (majority)**:

```
3 Redis nodes:

  Instance A acquires lock on node1 ✅, node2 ✅, node3 ✅ → valid (majority)
  
  If node2 crashes after acquire:
  Instance B tries node1 ❌, node2 (down) —, node3 ❌ → cannot reach majority → lock NOT granted
```

```javascript
const Redlock = require('redlock');
const Redis = require('ioredis');

// Multiple independent Redis instances (NOT Redis Cluster)
const redis1 = new Redis({ host: 'redis-1', port: 6379 });
const redis2 = new Redis({ host: 'redis-2', port: 6379 });
const redis3 = new Redis({ host: 'redis-3', port: 6379 });

const redlock = new Redlock([redis1, redis2, redis3], {
  driftFactor: 0.01,   // clock drift tolerance (1%)
  retryCount: 3,        // retry 3 times before giving up
  retryDelay: 200,      // wait 200ms between retries
  retryJitter: 100,     // +/- 100ms random jitter to prevent retry storms
});

async function bookTicket(ticketId, userId) {
  // acquire lock across majority of Redis nodes
  const lock = await redlock.acquire([`lock:ticket:${ticketId}`], 10_000);

  try {
    const ticket = await db.findOne({ _id: ticketId });
    if (ticket.bookedBy) throw new Error('Ticket already booked');
    await db.updateOne({ _id: ticketId }, { $set: { bookedBy: userId } });
  } finally {
    await lock.release();
  }
}
```

**When to use Redlock vs single-node:**
| | Single-node Redis lock | Redlock |
|---|---|---|
| Setup complexity | Simple | Requires 3-5 Redis nodes |
| Fault tolerance | Fails if Redis goes down | Survives minority node failures |
| Latency | Sub-ms | Slightly higher (must contact N nodes) |
| Use case | Most web apps, non-critical locking | Financial transactions, ticket booking, inventory |

---

## Level 2 — Database-Level Locking

### Pessimistic Locking — SELECT FOR UPDATE (PostgreSQL / MySQL)

Locks the row at the DB level. No other transaction can read-for-update or modify the row until the lock is released (transaction committed or rolled back).

```sql
-- PostgreSQL: lock the row for the duration of this transaction
BEGIN;

SELECT * FROM orders
WHERE id = $1
FOR UPDATE;           -- acquires row-level lock immediately

-- Now safely read and mutate
UPDATE orders SET status = 'paid' WHERE id = $1;

COMMIT;               -- lock released
```

```javascript
// Node.js with PostgreSQL (pg / Sequelize)
async function processOrderPG(client, orderId) {
  await client.query('BEGIN');
  try {
    const { rows } = await client.query(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );
    const order = rows[0];
    if (order.status !== 'pending') throw new Error('Already processed');

    await client.query(
      'UPDATE orders SET status = $1 WHERE id = $2',
      ['paid', orderId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
```

**SELECT FOR UPDATE SKIP LOCKED** — used for job queues (claim a pending job without blocking):

```sql
-- Worker picks the next unclaimed job without waiting on locked rows
SELECT * FROM jobs
WHERE status = 'pending'
ORDER BY created_at
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

### Optimistic Locking — Version / ETag

No lock held during read. At write time, check the version hasn't changed. If it has, another writer got there first — retry or fail.

```javascript
// MongoDB: optimistic locking with a version field
async function updateWithOptimisticLock(orderId, expectedVersion, newData) {
  const result = await Order.updateOne(
    { _id: orderId, __v: expectedVersion },  // only update if version matches
    { $set: newData, $inc: { __v: 1 } }      // bump version on write
  );

  if (result.matchedCount === 0) {
    throw new Error('Conflict: order was modified by another process — retry');
  }
}

// PostgreSQL equivalent
const result = await client.query(
  'UPDATE orders SET status = $1, version = version + 1 WHERE id = $2 AND version = $3',
  ['paid', orderId, knownVersion]
);
if (result.rowCount === 0) {
  throw new Error('Optimistic lock conflict — retry');
}
```

### Atomic DB Operations (No Lock Needed)

When you can express the entire check-and-update as one atomic DB command, you don't need a separate lock:

```javascript
// MongoDB: atomic decrement — only succeeds if stock > 0
const result = await Item.findOneAndUpdate(
  { _id: itemId, stock: { $gt: 0 } },    // condition + fetch
  { $inc: { stock: -1 } },               // atomic decrement
  { new: true }
);
if (!result) throw new Error('Out of stock');

// PostgreSQL: atomic conditional update
const { rowCount } = await client.query(
  'UPDATE inventory SET stock = stock - 1 WHERE item_id = $1 AND stock > 0',
  [itemId]
);
if (rowCount === 0) throw new Error('Out of stock');
```

This is the **fastest option** — no round-trip for a separate lock acquire, no lock-table overhead.

---

## Level 3 — Application-Level Locking

### In-Process Mutex (single Node.js process)

Works when you have **one server** or want to prevent concurrency within a single process (e.g., testing, scripts, single-replica deployments):

```javascript
class Mutex {
  constructor() {
    this._queue = [];
    this._locked = false;
  }

  acquire() {
    return new Promise(resolve => {
      if (!this._locked) {
        this._locked = true;
        resolve(() => this._release());
      } else {
        this._queue.push(resolve);
      }
    });
  }

  _release() {
    if (this._queue.length > 0) {
      const next = this._queue.shift();
      next(() => this._release()); // hand lock to next waiter
    } else {
      this._locked = false;
    }
  }
}

const mutex = new Mutex();

async function criticalSection() {
  const release = await mutex.acquire();
  try {
    // only one caller runs this at a time (within this process)
    await doWork();
  } finally {
    release();
  }
}
```

**Limitation:** Does NOT work across multiple Node.js instances. Use Redis lock for multi-instance setups.

### Job Queue Serialisation

Offload concurrent requests to a queue — a single worker processes them sequentially, eliminating the need for any lock:

```javascript
const { Queue, Worker } = require('bullmq');

const purchaseQueue = new Queue('purchases', { connection: redis });

// Producer: enqueue, don't process inline
app.post('/purchase', async (req, res) => {
  await purchaseQueue.add('buy', { userId: req.user.id, itemId: req.body.itemId });
  res.json({ status: 'queued' });
});

// Consumer: single worker, sequential processing — inherently race-free
new Worker('purchases', async (job) => {
  const { userId, itemId } = job.data;
  const item = await Item.findOne({ _id: itemId });
  if (item.stock <= 0) throw new Error('Out of stock');
  await Item.updateOne({ _id: itemId }, { $inc: { stock: -1 } });
  await Order.create({ userId, itemId });
}, { connection: redis, concurrency: 1 }); // concurrency: 1 = no parallel jobs
```

---

## Level 4 — Consensus-Based Locking (ZooKeeper / etcd)

Used internally by distributed systems (Kubernetes, Kafka, HBase). Not typically used directly in application code, but important to know for system design interviews.

| System | Mechanism | Used By |
|---|---|---|
| **ZooKeeper** | Ephemeral znodes — node disappears if session dies, releasing lock | HBase, Kafka (pre-KRaft), older Hadoop |
| **etcd** | Lease-based key — lease TTL expires if holder dies | Kubernetes (leader election, controller manager) |
| **Consul** | Session + KV lock | HashiCorp stack, service mesh locking |

**etcd lease example (conceptual):**
```
1. Create lease with TTL = 10s
2. PUT "lock/resource" with lease attached (atomic)
3. Hold lock, keep-alive the lease every ~5s
4. DELETE "lock/resource" on release
5. If process dies → lease expires → key deleted → lock released automatically
```

**Kubernetes internals:** The controller manager uses a `Lease` object in etcd as a distributed lock to ensure only ONE controller instance is the active leader at a time.

---

## Level 5 — Other Locking Mechanisms

### Advisory Locks (PostgreSQL pg_advisory_lock)

Application-level locks stored in the DB but not tied to a specific row. Useful when you don't have a natural row to lock.

```sql
-- Acquire named advisory lock (integer ID, app-defined meaning)
SELECT pg_advisory_lock(12345);

-- ... critical section ...

SELECT pg_advisory_unlock(12345);
```

```javascript
// Node.js advisory lock helper
async function withAdvisoryLock(client, lockId, fn) {
  await client.query('SELECT pg_advisory_lock($1)', [lockId]);
  try {
    return await fn();
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
  }
}

// Usage — lock based on a hash of the resource name
const lockId = hashStringToInt('cron:daily-report');
await withAdvisoryLock(pgClient, lockId, () => runDailyReport());
```

**Advantage:** Works across processes without Redis. **Disadvantage:** Shares DB connection pool; lock held until explicitly released or connection drops.

### File System Locks (single-machine / container)

```javascript
const lockfile = require('proper-lockfile');

async function withFileLock(filePath, fn) {
  const release = await lockfile.lock(filePath);
  try {
    return await fn();
  } finally {
    await release();
  }
}
```

Used for: CLI tools, cron jobs on a single machine, preventing concurrent migration scripts on one container.

---

## Choosing the Right Lock — Decision Matrix

```
Is your workload on a SINGLE process / server?
  YES → In-process Mutex (JS Mutex class)

Is the critical section a SINGLE DB operation?
  YES → Atomic DB operation ($inc with condition, UPDATE WHERE ... AND stock > 0)
        No lock needed at all — fastest option

Does the critical section span MULTIPLE steps within ONE DB?
  YES → DB transaction + SELECT FOR UPDATE (pessimistic)
      OR → Optimistic locking with version field (better for low-contention)

Do you need to lock ACROSS MULTIPLE SERVICES or MICROSERVICES?
  YES → Redis distributed lock (SET NX PX + Lua release)
  
Do you need HIGH AVAILABILITY / FAULT TOLERANCE for the lock store?
  YES → Redlock (3-5 Redis nodes, majority quorum)

Is high write contention RARE (reads >> writes)?
  YES → Optimistic locking (no held locks, just retry on conflict)

Do you need to schedule EXACTLY ONE WORKER running a cron job?
  YES → Redis lock OR pg_advisory_lock

Are you using ZooKeeper / etcd / Consul already for service mesh?
  YES → Use their native locking primitives
```

---

## Redis Lock vs DB Lock — Full Comparison

| Dimension | Redis Distributed Lock | DB Row Lock (SELECT FOR UPDATE) | Optimistic (Versioning) |
|---|---|---|---|
| **Speed** | Sub-millisecond | Slower (transaction overhead) | Fastest (no lock on read) |
| **Cross-service** | ✅ Works across microservices | ❌ Only within DB clients | ✅ Via DB version check |
| **TTL auto-expiry** | ✅ Built-in (`PX`) | ❌ Held until COMMIT/ROLLBACK | N/A |
| **Deadlock risk** | Low (TTL prevents) | Medium (transactions can deadlock) | None |
| **Contention handling** | Fail-fast or retry | Block and wait | Retry on conflict |
| **Consistency guarantee** | Strong (single lock holder) | ACID | Eventual on retry |
| **Infrastructure needed** | Redis instance | DB already present | DB already present |
| **Best for** | Microservices, rate limiting, job dedup, cross-service critical sections | Single-service inventory, financial operations, multi-step DB mutations | Low-contention updates, read-heavy with rare writes |

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Correct Approach |
|---|---|---|
| `SET NX` without TTL | Process crash = deadlock forever | Always set `PX` TTL |
| `redis.del(lockKey)` on release (no token check) | Deletes another process's lock after your TTL expired | Lua script: check token then delete |
| Too-short TTL | Lock expires while critical section runs — two holders simultaneously | TTL = 3–5× expected execution time |
| In-process Mutex for multi-instance | Mutex only blocks within own process; other instances unaffected | Redis distributed lock |
| Holding DB lock across external API calls | DB lock blocks connection pool for the duration of the HTTP call | Acquire lock → read → release → call API → reacquire → write |
| Forgetting `finally` on lock release | Exception mid-section = lock never released | Always `try { ... } finally { releaseLock() }` |
| No retry strategy | First contention = permanent failure | Implement exponential backoff + max retries |

---

## Interview Rapid-Fire Q&A

**Q: What is a distributed lock?**
A: A mechanism that ensures only ONE process across multiple servers executes a critical section at a time, using a shared external store (Redis, DB, etcd) as the coordination point.

**Q: Why can't you use a regular JS Mutex for distributed locking?**
A: A Mutex lives in process memory. Multiple Node.js instances each have their own Mutex instance — they don't see each other's lock state.

**Q: What does SET NX PX do in Redis?**
A: Sets a key only if it doesn't exist (NX = Not eXists), with a millisecond expiry (PX). Both are applied atomically in one command — no race between the check and the set.

**Q: Why do you store a random token when acquiring a Redis lock?**
A: So only the original lock holder can release it. If your TTL expires, another process acquires the lock with a different token. When you finally call release, the Lua script checks the token — since yours no longer matches, it doesn't delete the new holder's lock.

**Q: What is Redlock and when do you need it?**
A: An algorithm that acquires a lock on N/2+1 independent Redis nodes. Needed when a single Redis node failure would cause lock correctness issues (split-brain). Overkill for most web apps; appropriate for financial/booking systems.

**Q: What is SELECT FOR UPDATE?**
A: A SQL clause that adds a row-level lock to a SELECT query inside a transaction. No other transaction can modify or SELECT FOR UPDATE the same rows until the lock is released (COMMIT/ROLLBACK).

**Q: Pessimistic vs optimistic locking — when to use each?**
A: **Pessimistic** — high contention, cannot tolerate conflicts, short critical sections (inventory, payments). **Optimistic** — low contention, reads >> writes, conflicts are rare and retrying is acceptable (user profile updates, collaborative documents).

**Q: How does Kubernetes use distributed locking?**
A: The controller manager uses a `Lease` object in etcd. Only the instance that holds the lease is the active leader and processes events. If it dies, the lease expires and another instance claims it.

**Q: What is pg_advisory_lock?**
A: A PostgreSQL feature that lets applications acquire named locks stored in the DB but not tied to any table row. Useful for preventing concurrent cron job execution across multiple app instances that share a DB but don't have a Redis instance.

**Q: What happens if a process dies while holding a Redis lock?**
A: The TTL ensures the lock automatically expires. Any waiting process can then acquire it. This is why TTL is mandatory — it's the deadlock-prevention mechanism.

**Q: What is lock fencing / fencing token?**
A: When a lock expires and a new holder acquires it with a higher-numbered token (fencing token), the storage system rejects writes from the old holder if their token is lower. This prevents stale processes from corrupting data even after their lock expired. Used in etcd leases and advanced Redlock implementations.
