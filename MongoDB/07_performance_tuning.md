# Performance Tuning & Production Optimization

## Memory & Cache: Working Set

**WHAT**: How does MongoDB use memory, and what's the "working set"?

**THEORY**:
- **Working Set**: subset of data accessed frequently (should fit in RAM)
- MongoDB uses **memory mapping** (OS page cache)
- Data not in cache = disk read (1000× slower)
- **Rule**: working set + indexes + 25% buffer < available RAM
- Monitor: track `page-faults` (disk reads = bad)

```javascript
// Check working set size and memory stats
db.stats();
// Result:
{
  "db": "mydb",
  "collections": 42,
  "dataSize": 10737418240,           // 10 GB total data
  "indexSize": 2147483648,           // 2 GB indexes
  "storageSize": 14294967296,        // 14 GB on disk
  "avgObjSize": 1024                 // average doc size
}

// Memory metrics (in mongod)
db.serverStatus().mem;
// Result:
{
  "bits": 64,
  "resident": 8192,                  // 8 GB in RAM
  "virtual": 16384,                  // 16 GB virtual memory
  "mapped": 14294967296              // memory-mapped size
}

// Page faults indicate working set too large
db.serverStatus().extra_info;
// Result:
{
  "page_faults": 5000                // disk reads (bad if high)
}
```

**For experienced teams**:
- "High" page faults: > 100 per second = performance issue
- If working set > RAM: add RAM or shard data

---

## Query Performance Metrics

```javascript
// Every find() operation provides performance data
const result = db.orders.find({ status: "completed" }).explain("executionStats");

result.executionStats = {
  "executionStages": {
    "stage": "IXSCAN",                // Index scan (good)
    "nReturned": 5000,                // 5000 documents returned
    "totalKeysExamined": 5050,        // 5050 index keys examined
    "totalDocsExamined": 5000,        // 5000 collection docs examined
    "executionTimeMillis": 45
  }
};

// Efficiency metric: nReturned / totalDocsExamined
// Should be close to 1.0 (every examined doc is returned)
const efficiency = 5000 / 5000;  // 1.0 = perfect!

// Inefficient query example
{
  "nReturned": 100,                 // 100 results returned
  "totalDocsExamined": 500000       // but 500K docs examined!
}
// Efficiency: 100/500000 = 0.0002 (needs index!)
```

---

## Batch Size & Network Optimization

```javascript
// Default: 16 MB batches per query
db.orders.find({ status: "pending" });

// Control batch size for memory efficiency
db.orders.find({ status: "pending" }).batchSize(1000);

// Performance implications
// Larger batches: fewer round trips, better throughput, more memory
// Smaller batches: lower latency, less memory

// Rule of thumb:
// - Default (16 MB): good for most cases
// - Aggregation: use batchSize(10000) for large pipelines
// - Streaming: use batchSize(100) for low latency
```

---

## Slow Query Log Profiling

**WHAT**: How do I find slow queries?

**THEORY**:
- **Profiler** logs queries exceeding threshold
- Useful for identifying optimization targets
- Three levels: off (0), slow queries (1), all queries (2)
- Monitor regularly, identify patterns

```javascript
// Enable profiler: log queries slower than 100ms
db.setProfilingLevel(1, { slowms: 100 });

// Query the profiler results
db.system.profile.find({ millis: { $gt: 100 } }).limit(10).pretty();

// Result: shows slow queries with timing breakdown
{
  "op": "query",
  "ns": "mydb.orders",
  "command": {
    "find": "orders",
    "filter": { "status": "pending", "createdAt": { "$gt": new Date(...) }}
  },
  "millis": 250,                     // 250 ms query time
  "execStats": {
    "executionStages": { "stage": "COLLSCAN" },  // ❌ Full scan!
    "totalDocsExamined": 1000000,
    "nReturned": 5000
  }
}

// Action: create index on {status: 1, createdAt: 1}

// Disable profiler
db.setProfilingLevel(0);
```

---

## Connection Pooling

```javascript
// Application uses connection pool to MongoDB
const client = new MongoClient(uri, {
  maxPoolSize: 100,           // max 100 connections
  minPoolSize: 10,            // min 10 idle connections
  maxIdleTimeMS: 45000,       // close idle after 45s
  waitQueueTimeoutMS: 10000   // wait max 10s for connection
});

// Performance tuning:
// - maxPoolSize: increase if hitting "connection pool exhausted"
// - minPoolSize: ensure warmth, but costs memory
// - Connections under load with default pool:
//   100 connections × 1 MB overhead = 100 MB

// Monitor connection pool health
const poolStats = client.topology.poolStats();
```

---

## Write Performance Optimization

### Bulk Operations

```javascript
// ❌ SLOW: individual inserts (100 round trips)
for (let i = 0; i < 100; i++) {
  db.logs.insertOne({ level: "info", message: "...", timestamp: new Date() });
}
// Each operation: network latency + server processing

// ✅ FAST: bulk insert (1 round trip)
db.logs.insertMany([
  { level: "info", message: "...", timestamp: new Date() },
  { level: "info", message: "...", timestamp: new Date() },
  // ... 100 documents
], { ordered: false });  // parallel processing

// Performance improvement: 100× for insert operations

// Bulk update operations
const bulk = db.logs.initializeUnorderedBulkOp();
bulk.find({ processed: false }).update({ $set: { processed: true } });
bulk.find({ error: null }).update({ $set: { status: "complete" } });
bulk.execute();
```

### Write Concern Trade-off

```javascript
// ❌ MAXIMUM safety: wait for majority + journal
db.orders.insertOne(order, {
  writeConcern: { w: "majority", j: true }
});
// Latency: 50-100 ms (disk sync required)

// ✅ BALANCED: wait for primary only
db.orders.insertOne(order, {
  writeConcern: { w: 1 }
});
// Latency: 5-10 ms (memory only)

// ⚡ FAST: don't wait for acknowledgment
db.orders.insertOne(order, {
  writeConcern: { w: 0 }
});
// Latency: < 1 ms (returns immediately)
// Risk: doesn't know if write succeeded

// Best practice for logs/analytics
db.analytics_logs.insertOne(logEntry, {
  writeConcern: { w: 0 }  // fire and forget
});

// Best practice for orders/money
db.orders.insertOne(order, {
  writeConcern: { w: "majority", j: true }  // guaranteed durability
});
```

---

## Real-World Performance Optimization Checklist

| Issue | Symptom | Solution |
|-------|---------|----------|
| Missing index | COLLSCAN in explain, slow queries | Create appropriate index |
| Too many indexes | Slow writes, memory bloat | Remove unused indexes |
| Working set > RAM | High page faults | Add more RAM or shard |
| Hot shard | One shard always busy | Rebalance data or change shard key |
| Long transactions | Timeouts, locks | Break into smaller transactions |
| Large batches | Memory pressure | Reduce batchSize |
| Write concern too strong | Slow writes | Use {w: 1} for logs |
| No read scaling | Primary overloaded | Use read preference: secondary |

---

## Time Complexity: Optimization Impact

| Optimization | Query Time | Example Impact |
|--------------|-----------|-----------------|
| Add index | O(n) → O(log n) | 1M docs: 1000ms → 10ms |
| Compound index | O(n log n) sort → O(log n) | Range query: 500ms → 10ms |
| Increase RAM | Disk I/O × 1000 | 50ms → 5μs per miss |
| Connection pooling | Round trip × N → Round trip × 1 | 100× throughput gain |
| Bulk operations | N × latency → Single latency | 100 ops: 5000ms → 50ms |
| Read secondary | Primary contention | 10× read throughput |

---

## Production Monitoring

```javascript
// Key metrics to monitor continuously
db.serverStatus().opcounters;  // operation counts
{
  "insert": 50000,
  "query": 1000000,
  "update": 30000,
  "delete": 5000,
  "getmore": 100000
}

db.serverStatus().connections;  // connection health
{
  "current": 450,          // active connections
  "available": 550,        // available slots
  "totalCreated": 10000    // All connections created so far
}

db.serverStatus().network;  // network traffic
{
  "bytesIn": 10737418240,  // incoming bytes
  "bytesOut": 5368709120,  // outgoing bytes
  "requests": 500000       // requests count
}
```
