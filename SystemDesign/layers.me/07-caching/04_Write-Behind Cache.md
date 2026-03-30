# T04 — Write-Behind Cache (Write-Back)

---

## 1. ELI5

Imagine you're taking notes in class. The **slow way** (write-through) is: write every word in your notebook AND immediately text it to a friend. Each sentence pauses for the "message sent" confirmation.

The **fast way** (write-behind) is: keep writing furiously in your notebook, and every 5 minutes your phone auto-sends everything you've written. Your writing never pauses. But if your phone crashes before the 5-minute send? Those notes are gone.

**Write-behind** = write fast to cache, send to database later. Maximum write speed, minimum durability guarantee.

---

## 2. Analogy

**Bank ATM offline mode:**

During a network outage, some ATMs allow deposits locally — they record your deposit in local storage (the cache) and confirm immediately. Later when connectivity restores, the ATM syncs all deposits to the central bank system (the database).

If the ATM is stolen/destroyed before syncing — those deposits are lost. That's the write-behind risk. The ATM manufacturer reduces this risk by also writing to a local encrypted log (like Redis AOF) before confirming.

**Another analogy — browser localStorage:**

A web app auto-saves your draft to `localStorage` every 2 seconds (fast, local). A background job every 30 seconds POSTs the draft to the server. If your browser crashes between saves → draft is lost from server but localStorage has the last 2-second autosave. The server gets the 30-second version.

---

## 3. Core Concept

### Write-Behind Flow

```
Application → WRITE operation

  App Server
      │
      ▼ (< 1ms)
  ┌──────────────────────────────────────────────────┐
  │  Cache (Redis)                                   │
  │  Step 1: cache.set(key, value) → ACK instantly   │
  └──────────────────────────────────────────────────┘
      │  Returns SUCCESS to application immediately
      ▼
  Application continues (no DB wait)

  Meanwhile, asynchronously:
  ┌──────────────────────────────────────────────────┐
  │  Background Worker / Queue Processor             │
  │                                                  │
  │  Every N milliseconds OR every N operations:     │
  │  - Drain write queue                             │
  │  - Batch INSERT / UPDATE to database             │
  │  - 100 cache writes → 1 bulk DB operation        │
  └──────────────────────────────────────────────────┘
      │
      ▼ (async, batched, DB not on critical path)
  Database

  Write latency: < 1ms (cache only)
  DB latency:    10-50ms (async, spread over time)
```

### Data Loss Window

```
  t=0:  cache.set("counter:page_views", 1050001)  → ACK
  t=1:  cache.set("counter:page_views", 1050002)  → ACK
  t=2:  cache.set("counter:page_views", 1050003)  → ACK
        ... (write queue grows)
  t=5:  Background job runs: INSERT/UPDATE 1050001-1050003 to DB
  
  If Redis crashes at t=3 (before background job):
    DB still has 1050000 (last synced value)
    In-memory writes 1050001-1050003 are LOST forever
    
  This 3-second window = data loss window
  For page view counters: acceptable (off by a few counts)
  For financial balances: NEVER acceptable
```

---

## 4. Batching Math

$$\text{DB writes saved} = \frac{N_{\text{cache writes}}}{N_{\text{batch size}}}$$

```
Example: e-commerce cart updates
  User updates cart: 20 times in 10 seconds
    Cache: 20 SET operations (< 1ms each = 0ms felt latency)
    DB: 1 batch UPSERT at end of checkout (or every 10s)
    
  DB reduction: 20× fewer write operations
  
Example: analytics event tracking
  100,000 events/second
  Batch flush every 1 second
  → 100,000 individual INSERTs → 1 bulk INSERT (1,000× fewer DB calls)
  → PostgreSQL bulk INSERT performance: 100,000 rows in ~100ms
  → vs 100,000 individual INSERTs: ~100+ seconds (blocked on row-level locks)
  
This is why Kafka/Kinesis consumers batch writes to databases:
  Write-behind is the core pattern behind stream processing to DB sinks
```

---

## 5. Durability Strategies

```
Risk: cache crash before async write → data loss
Mitigation stack (each adds durability):

Level 1 — Redis Persistence (cheap)
  Redis AOF (Append-Only File): every write logged to disk
  Config: appendonly yes  +  appendfsync everysec
  Data loss window: up to 1 second (last un-fsynced writes)
  
Level 2 — Redis Replication (medium)
  Primary: write → immediately replicate to replica
  If primary crashes: replica has the data
  Data loss: may lose last few ms if replication lag exists
  
Level 3 — Persistent Queue (reliable)
  Write-behind queue stored in Kafka or SQS (not just in-process)
  If cache crashes: queue still has pending writes
  Consumer retries from queue until DB confirms
  Data loss: near-zero (Kafka persists to disk)
  
Level 4 — Distributed Transaction Log (strongest)
  Write to WAL (Write-Ahead Log) before acknowledging to app
  If crash: WAL replay restores all pending writes
  AWS ElastiCache Serverless uses this model
  
Most common production setup:
  Redis AOF + SQS/Kafka queue = two layers of durability
```

---

## 6. Write-Behind vs Write-Through vs Cache-Aside

```
┌─────────────────────┬──────────────┬──────────────┬──────────────┐
│ Property            │ Write-Behind │ Write-Through│ Cache-Aside  │
├─────────────────────┼──────────────┼──────────────┼──────────────┤
│ Write latency       │ < 1ms ✅     │ 11-21ms ⚠️   │ 10-20ms ⚠️  │
│ Read after write    │ Cache hit ✅ │ Cache hit ✅ │ Cache miss 📍│
│ Data durability     │ At risk ⚠️   │ Strong ✅    │ Strong ✅    │
│ DB write load       │ Low ✅       │ Full ❌      │ Full ❌      │
│ Complexity          │ High ❌      │ Medium       │ Low ✅       │
│ Memory usage        │ Unbounded ⚠️│ All writes ❌│ Hot reads ✅ │
│ Good for            │ Analytics,   │ Social graph,│ Read-heavy,  │
│                     │ gaming, IoT  │ payments     │ news feeds   │
└─────────────────────┴──────────────┴──────────────┴──────────────┘

📍 = miss only until first read, then cached
```

---

## 7. Coalescing: Handling Rapid Updates to Same Key

```
Write-behind bonus: coalescing avoids redundant DB writes

  User updates profile bio: 5 times in 3 seconds
  Write-behind queue:
    [user:123 → "bio v1"]
    [user:123 → "bio v2"]  ← overwrites v1 in queue
    [user:123 → "bio v3"]  ← overwrites v2
    [user:123 → "bio v4"]  ← overwrites v3
    [user:123 → "bio v5"]  ← final value
    
  Background flush (every 5s):
    DB: UPDATE users SET bio='bio v5' WHERE id=123
    → Only 1 DB write! Intermediate values coalesced
    
  vs Write-Through: 5 DB UPDATEs (one per keystroke)
  
  Implementation:
    Queue = HashMap<key, latestValue>
    On flush: drain hashmap → bulk DB write
    Coalescing is automatic because keys are unique in hashmap
```

---

## 8. Node.js Implementation

```javascript
// Write-Behind cache with batched DB flush
class WriteBehindCache {
  constructor(redis, db) {
    this.redis = redis;
    this.db = db;
    this.pendingWrites = new Map(); // coalesced write buffer
    this.flushIntervalMs = 5000;   // flush every 5 seconds
    
    // Start background flush job
    this.flushTimer = setInterval(() => this._flush(), this.flushIntervalMs);
  }
  
  async set(key, value) {
    // Step 1: Write to cache immediately (< 1ms)
    await this.redis.set(key, JSON.stringify(value), 'EX', 3600);
    
    // Step 2: Enqueue for DB write (coalesced — last write wins)
    this.pendingWrites.set(key, { value, timestamp: Date.now() });
    
    // No DB write here — return immediately
    return value;
  }
  
  async get(key) {
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);
    
    // Fallback to DB (miss)
    const result = await this.db.findByKey(key);
    if (result) {
      await this.redis.set(key, JSON.stringify(result), 'EX', 3600);
    }
    return result;
  }
  
  async _flush() {
    if (this.pendingWrites.size === 0) return;
    
    // Snapshot and clear (don't block incoming writes during flush)
    const snapshot = new Map(this.pendingWrites);
    this.pendingWrites.clear();
    
    try {
      // Bulk write to DB
      const entries = Array.from(snapshot.entries());
      await this.db.bulkUpsert(entries); // single DB roundtrip
      console.log(`Flushed ${entries.length} writes to DB`);
    } catch (err) {
      // On failure: re-enqueue (newer value takes priority if key exists again)
      console.error('Flush failed, re-queuing', err);
      for (const [key, val] of snapshot) {
        if (!this.pendingWrites.has(key)) {
          this.pendingWrites.set(key, val); // restore only if not overwritten
        }
      }
    }
  }
  
  shutdown() {
    clearInterval(this.flushTimer);
    return this._flush(); // final flush on graceful shutdown
  }
}

// USAGE: Analytics view counter (write-behind ideal — eventual is fine)
const writeCache = new WriteBehindCache(redis, db);

app.post('/events/page-view', async (req, res) => {
  const key = `views:${req.body.pageId}`;
  const current = await writeCache.get(key) || 0;
  await writeCache.set(key, current + 1);  // < 1ms — fire and forget to DB
  res.json({ ok: true });
});

// CAUTION: Graceful shutdown — flush remaining writes before process exit
process.on('SIGTERM', async () => {
  await writeCache.shutdown(); // drain pending writes to DB
  process.exit(0);
});
```

---

## 9. Real-World Examples

### Riot Games — Game Leaderboards (League of Legends)

```
Data: player scores updated every second during matches
Volume: millions of score updates per minute globally
Pattern: write-behind + Redis Sorted Sets

Write path:
  Match ends → ZADD leaderboard <score> <playerId> (< 1ms)
  Background job (every 10s): batch sync top scores to MySQL
  
Benefits:
  1. No DB write on critical path (game match completion is latency-sensitive)
  2. ZADD + ZRANGE give real-time leaderboard from Redis (no DB query needed)
  3. Batch DB sync only stores final standings (intermediate score updates coalesced)
  
Acceptable data loss: if Redis crashes, last 10s of scores reset to DB-synced state
  → Scoreboard shows 10-second-old data; acceptable for leaderboards
```

### IoT Sensor Data Ingestion

```
Pattern: time-series write-behind with Kafka buffer

  10,000 IoT sensors → 1 reading/second each → 10,000 writes/sec

  Write-behind:
  1. Sensor POST → write to Redis (< 1ms ACK to device)
  2. Redis Streams (XADD) → Kafka consumer → batch write to TimescaleDB
     Every 5 seconds: flush 50,000 readings in one COPY command
     
  Without batching:
  10,000 INSERT/sec → PostgreSQL max ~5,000-10,000 inserts/sec → overload
  
  With write-behind batching:
  2 bulk writes/sec of 25,000 rows → well within DB capacity
```

### Shopping Cart — Pre-Checkout Buffer

```
User dragging items in/out of cart rapidly:
  Each drag = cart update event
  Write-through would: 10 DB UPDATE calls for 10 drags (all redundant)
  Write-behind: 10 cache updates, 1 DB write when user hits Checkout
  
  Key requirement: on "Add to Cart" button click → synchronous DB write
  (because payment depends on official cart state)
  Intermediate drag events = write-behind (only final state matters)
```

---

## 10. When to Use / Avoid

```
✅ USE WRITE-BEHIND FOR:
  - Analytics / telemetry (metrics, counters, events) — eventual is fine
  - Leaderboards / rankings — last 5s of data is acceptable
  - Shopping cart drafts (not final checkout)
  - IoT sensor data / time-series ingestion
  - Rate limiting counters (off by a few = fine)
  - User activity logs (views, clicks)
  - Any write-heavy, read-later pattern

❌ AVOID WRITE-BEHIND FOR:
  - Financial transactions (bank balance, payments) — zero data loss tolerance
  - Inventory levels (oversell risk if stock cached but not persisted)
  - User authentication / sessions (crash = logged-out users)
  - Anything requiring ACID guarantees
  - Write-once data (registration, order confirmation)
  - Legal / compliance records (must be durable immediately)
```

---

## 11. Interview Cheat Sheet

**Q: What is write-behind (write-back) caching?**
> Write to cache only → ACK immediately → background job async-writes to DB. Provides lowest write latency because DB is not on the critical path. Risk: if cache crashes before async write, unsynced data is lost.

**Q: How do you reduce write-behind data loss risk?**
> Three layers: (1) Redis AOF/persistence → survives process crash; (2) Redis replication → survives node crash; (3) Kafka/SQS queue for pending writes → survives cache cluster crash. Most production setups combine AOF + a persistent queue.

**Q: What is write coalescing and why does it matter?**
> When the same key is written multiple times before the async flush, only the latest value needs to be written to DB — intermediate values are discarded. A key-based buffer (HashMap) naturally coalesces: 100 updates to `user:123` → 1 DB write. This multiplies the DB write reduction beyond simple batching.

**Q: Write-behind vs write-through — when to pick each?**
> Write-through: strong consistency required, moderate write volume, data loss unacceptable (payments, profiles). Write-behind: extreme write throughput needed, eventual consistency acceptable, data is regenerable or loss is low-stakes (counters, logs, leaderboards).

---

## 12. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Write-Behind** | Write to cache → ACK → async DB write later (also called write-back) |
| **Async Write** | DB write happens in background, not on critical path |
| **Data Loss Window** | Time between last cache write and last DB sync — data in this window lost on crash |
| **Coalescing** | Merging multiple writes for the same key into one DB write (only latest value) |
| **AOF** | Redis Append-Only File — persistence mode that logs every write command to disk |
| **Batch Flush** | Periodic drain of write buffer to DB as single bulk operation |
| **Write Buffer** | In-memory queue of pending DB writes waiting for async flush |
| **Write Amplification** | Opposite applies here — write-behind REDUCES DB write load vs write-through |
| **Graceful Shutdown** | Process on SIGTERM drains pending write buffer before exit — critical for write-behind |
| **Durability** | Guarantee that committed data survives failures — write-behind is low-durability by default |
