# Replication & Sharding: Scaling MongoDB

## Replication: High Availability

**WHAT**: How does MongoDB ensure data survives server failure?

**THEORY**:
- **Replica Set**: 3+ MongoDB instances (Primary, Secondary, Arbiter)
- **Primary**: handles writes, replicates to secondaries
- **Secondaries**: read-only copies, automatic failover candidates
- **Replication lag**: secondaries lag behind primary (milliseconds to seconds)
- **Arbiter**: lightweight voting member, no data storage

```
Replica Set Architecture:
┌──────────────────────────────────────────────────┐
│              Replica Set: "rs0"                  │
├──────────────────────────────────────────────────┤
│  Primary              Secondary          Arbiter │
│  (writes)             (read-only)        (vote)  │
│  mongodb-1            mongodb-2          arb-1   │
│  /data/db1            /data/db2          (10MB)  │
│  8GB RAM              8GB RAM            512MB   │
│                                                   │
│  Replication:                                     │
│  Write → Primary → Oplog → Secondary replicates │
│              ↓                                    │
│        Acknowledgment to client                   │
└──────────────────────────────────────────────────┘

Node Roles:
- Primary: Leader, accepts all writes
- Secondary: Replicas are read-only, eligible for promotion
- Arbiter: Votes only (cheap server, doesn't store data)
```

---

## Write Concern & Read Preference

### Write Concern: Durability Guarantees

```javascript
// Default write concern: {w: 1} (Primary acknowledged)
db.orders.insertOne({ orderId: 1, amount: 500 });
// Returns when primary writes to memory (fast, risky)

// Stronger guarantee: {w: "majority"}
db.orders.insertOne(
  { orderId: 1, amount: 500 },
  { writeConcern: { w: "majority", j: true } }
);
// Returns when majority of nodes have durable write (safe but slow)

// Comparison
Write Concern      | Latency | Durability | Use Case
{w: 1}             | Fast    | Low        | Logs, analytics
{w: "majority"}    | Slow    | High       | Financial transactions
{w: 3, j: true}    | Slowest | Highest    | Critical data
```

**WHAT**: When should I specify write concern?

**THEORY**:
- Trade-off: **latency vs durability**
- `{w: 1}` returns fast but data might be lost if primary crashes
- `{w: "majority"}` slower but guarantees data persists across failure
- Journal (`j: true`) forces disk write (durable on server restart)

```javascript
// Application-level write concern
const client = new MongoClient(uri, {
  writeConcern: { w: "majority" }
});

// Or per-operation
db.collection("orders").insertOne(
  { amount: 1000 },
  { writeConcern: { w: "majority", j: true, wtimeout: 5000 } }
);
```

### Read Preference: Where to Read

```javascript
// Default: Read from Primary (strongest consistency)
const result = db.users.findOne({ email: "john@example.com" });

// Read from Secondary (scales reads, weaker consistency)
const result = db.users.findOne(
  { email: "john@example.com" },
  { readPreference: "secondary" }
);

// Read Preference Options
"primary"              → Always primary (consistent, bottleneck at scale)
"primaryPreferred"     → Primary, fallback to secondary
"secondary"            → Secondary only (scales reads, stale data)
"secondaryPreferred"   → Secondary, fallback to primary
"nearest"              → Closest network latency node
```

**Example: Analytics Dashboard**
```javascript
// Analytics can tolerate stale data (read from cheap secondary)
db.collection("events").aggregate([
  { $match: { date: { $gte: yesterday } } },
  { $group: { _id: "$category", count: { $sum: 1 } } }
], { readPreference: "secondary" }).toArray();

// Financial dashboard needs consistent data (read from primary)
db.collection("accounts").find({ accountId: accountId }, {
  readPreference: "primary"
}).toArray();
```

---

## Sharding: Horizontal Scaling

**WHAT**: How do I split data across multiple servers?

**THEORY**:
- **Sharding** distributes data by shard key across replica sets
- Each shard stores subset of data (shard key range)
- **Shard Key**: field determining data distribution (must be indexed)
- **Query router**: determines which shard(s) to query
- **Config servers**: metadata (shard key ranges, chunk locations)

```
Sharded Cluster Architecture:
┌─────────────────────────────────────────────┐
│         Client Application                  │
└────────────────┬────────────────────────────┘
                 │ Connection
┌─────────────────────────────────────────────┐
│  Mongos (Query Router) × 2 for HA           │
│  Routes queries to correct shard            │
└─┬─────────────────────────┬─────────────────┘
  │                         │
  │ Shard Selection         │
  ↓                         ↓
┌─────────────────┐  ┌─────────────────┐
│   Shard 1       │  │   Shard 2       │
│ (Replica Set)   │  │ (Replica Set)   │
│ Primary+2ndary  │  │ Primary+2ndary  │
│                 │  │                 │
│ userId: 1-500K  │  │ userId: 500K-1M │
└─────────────────┘  └─────────────────┘

Config Servers (metadata):
├─ Shard ranges
├─ Chunk locations
└─ Cluster state
```

---

## Shard Key Selection (Critical Decision)

**WHAT**: How do I choose a good shard key?

**THEORY**:
- **Good shard key**: evenly distributes data, enables targeted queries
- **Bad shard key**: causes hot shards, scattered queries
- **Immutable**: cannot change shard key after sharding (major limitation)
- **Cardinality**: needs high cardinality (many distinct values)

```javascript
// Example: E-commerce with users from USA (100M users)

// ❌ BAD shard key: country (only 1 value: "USA")
db.users.collection.createIndex({ country: 1 });
db.adminCommand({ shardCollection: "ecom.users", key: { country: 1 } });
// Result: ALL data goes to one shard (no scaling!)

// ❌ BAD shard key: createdAt (always new values → scattered queries)
db.adminCommand({ shardCollection: "ecom.users", key: { createdAt: 1 } });
// Problem: sequential timestamp values concentrate in one shard
// Query range: createdAt > 2024 still hits one shard

// ✅ GOOD shard key: userId (high cardinality, random distribution)
db.adminCommand({ shardCollection: "ecom.users", key: { userId: 1 } });
// Result: Users evenly distributed across shards

// ✅ GOOD shard key: email (high cardinality, random)
db.adminCommand({ shardCollection: "ecom.users", key: { email: 1 } });

// Query implications:
// Targeted query (best): find({email: "john@example.com"})
// → Mongos knows exact shard, 1 shard response

// Broadcast query: find({country: "USA", createdAt: {$gt: date}})
// → Mongos queries ALL shards (slow)
```

---

## Sharding Patterns for 7+ Years Architects

### Pattern 1: Hash Shard Key

```javascript
// Hash shard key: better distribution than lexicographic
db.adminCommand({
  shardCollection: "ecom.products",
  key: { productId: "hashed" }  // Hash function applied
});

// Benefits: random uniform distribution
// Drawback: range queries not efficient (hash destroys order)
```

### Pattern 2: Compound Shard Key

```javascript
db.adminCommand({
  shardCollection: "ecom.orders",
  key: { customerId: 1, createdAt: -1 }
});

// Benefits:
// - Targeted for queries with customerId
// - Within customer shard, ordered by date

// Query: find({customerId: 123}).sort({createdAt: -1})
// → One shard, pre-sorted (efficient!)
```

### Pattern 3: Directory Table (Hot Spot Solution)

```javascript
// Problem: userId 1-10 too active (hits same shard = bottleneck)
// Solution: Indirection table

// Directory collection: userId → physical location
db.directory.insertMany([
  { userId: 1, shard: "shard1" },
  { userId: 2, shard: "shard2" },
  // ...
]);

// App reads directory first, then queries appropriate shard
const location = db.directory.findOne({ userId: 1 });
// Result: { shard: "shard1" }

// Application routes query to shard1
// (Mongos does this automatically with shard key)
```

---

## Replication vs Sharding

| Aspect | Replication | Sharding |
|--------|-------------|----------|
| Purpose | High availability | Horizontal scaling |
| Copies data? | Yes (3+ copies) | No (splits data) |
| Write capacity | Same (primary only) | Scales linearly |
| Storage | 3× cost | Single copy |
| Latency | Replica lag (seconds) | Variable (routing) |
| Best for | Small busy database | Large dataset |

**Scaled Architecture**:
```
├─ Replication: 3-node replica set per shard (HA)
├─ Sharding: 3-5 shards (scalable across servers)
└─ Config servers: 3-node replica set (metadata)

Total: ~20 MongoDB instances for enterprise
```

---

## Time Complexity: Replication & Sharding Impact

| Operation | Replicated | Sharded | Notes |
|-----------|-----------|---------|-------|
| Write (targeted) | O(log n) | O(log n) per shard | Same speed, different purpose |
| Write (broadcast) | O(log n) | O(log n × m) | m = shard count (slow) |
| Read (targeted) | O(log n) | O(log n) on 1 shard | Fast, single shard lookup |
| Read (broadcast) | O(log n) | O(log n × m) | Scatter-gather (slow) |
