# MongoDB — Interview Revision Summary

> **Target:** 7+ year Full Stack MERN Developer | **Files:** 9

## Table of Contents

1. [01_core_concepts_bson.md — What is MongoDB & BSON?](#mongodb-core-concepts-bson) 
2. [02_data_modeling_schema.md — Schema Design Patterns](#mongodb-data-modeling-schema) 
3. [03_indexing_query_optimization.md — Indexing Strategy](#mongodb-indexing-query-optimization) 
4. [04_aggregation_pipeline.md — Analytics at Scale](#mongodb-aggregation-pipeline) 
5. [05_transactions_acid.md — ACID Compliance](#mongodb-transactions-acid) 
6. [06_replication_sharding.md — Horizontal Scaling](#mongodb-replication-sharding) 
7. [07_performance_tuning.md — Production Optimization](#mongodb-performance-tuning) 
8. [08_security.md — Authentication & Authorization](#mongodb-security) 
9. [09_interview_qa_scenarios.md — Real-World Scenarios](#mongodb-interview-qa-scenarios)

---

<a id="mongodb-core-concepts-bson"></a>
## 01_core_concepts_bson.md — What is MongoDB & BSON?

MongoDB is a **document-oriented NoSQL database** storing data as **BSON** (Binary JSON).

**Key Concepts**:
- **Document**: JSON-like object (contains multiple fields)
- **Collection**: group of documents (like SQL table)
- **BSON**: binary format supporting Date, ObjectId, Binary, Code, etc.
- **Flexible schema**: documents in same collection can have different structures
- **ObjectId**: 12-byte unique identifier (timestamp + machine + counter)

**BSON Advantage**:
```javascript
// BSON supports types beyond JSON
{ 
  name: "John",
  createdAt: Date("2024-01-01"),      // native Date type
  _id: ObjectId("507f1f77bcf86cd799439011"),
  tags: ["dev", "mongodb"],
  metadata: Binary("..."),             // native Binary type
  code: Code("function() { return 1; }")
}
```

**Time Complexity**:
| Operation | Complexity |
|-----------|-----------|
| Insert | O(1) |
| Find (no index) | O(n) |
| Find (indexed) | O(log n) |
| Update | O(log n) |

---

<a id="mongodb-data-modeling-schema"></a>
## 02_data_modeling_schema.md — Schema Design Patterns

Design influenced by **access patterns**, not normalization rules.

**Document Relationship Patterns**:

| Type | Strategy | Example |
|------|----------|---------|
| 1:1 | Embed | User + Profile in one document |
| 1:few | Embed | User + 5 addresses in one document |
| 1:many | Reference or bucket | Blog + 1000+ comments = separate collection |
| many:many | Separate junction | Student + Course enrollments = enrollments collection |

**Embedding Rule**:
- ✅ DO embed: data queried together, bounded size, denormalization acceptable
- ❌ DON'T embed: unbounded arrays, separate query patterns, > 16 MB document

**Denormalization Example**:
```javascript
// Order stores customer name (denormalized)
{
  _id: ObjectId(),
  customerName: "John Doe",           // copy from customers collection
  customerEmail: "john@example.com",
  items: [...]
}

// Why? Printing invoices doesn't need live customer lookup
// Trade-off: updates don't sync in real-time (eventual consistency)
```

---

<a id="mongodb-indexing-query-optimization"></a>
## 03_indexing_query_optimization.md — Indexing Strategy

**Index Impact**:
- COLLSCAN (no index): O(n) — examine ALL documents
- IXSCAN (indexed): O(log n) — use B-tree to find documents

**Compound Index (ESR Rule)**:
- **E**quality fields first (narrow results most)
- **S**ort fields next (for ordering)
- **R**ange fields last (for filtering)

```javascript
// Query: status="active", date descending, age > 25
// ✅ CORRECT: { status: 1, date: -1, age: 1 }
// ❌ WRONG: { age: 1, status: 1, date: -1 }
```

**Advanced Patterns**:
- **Sparse index**: only indexes documents with field present
- **Partial index**: only indexes documents matching condition
- **Covered query**: returns result from index only (no document fetch)

**Index Performance**:
| Scenario | Without Index | With Index | Improvement |
|----------|---------------|-----------|-------------|
| Find 1 in 1M | O(1M) | O(20) | 50,000× |
| Range query | O(1M log M) | O(10K) | 100,000× |

---

<a id="mongodb-aggregation-pipeline"></a>
## 04_aggregation_pipeline.md — Analytics at Scale

**Pipeline**: series of stages processing documents server-side.

```javascript
db.orders.aggregate([
  { $match: { status: "completed" } },      // Filter
  { $group: { _id: "$customerId", total: { $sum: "$amount" } } },  // Aggregate
  { $sort: { total: -1 } },                 // Sort
  { $limit: 10 }                            // Limit
]);
```

**Key Stages**:
- `$match`: filter documents (uses indexes!)
- `$group`: aggregate by field
- `$project`: select/rename/compute fields
- `$unwind`: expand arrays into separate documents
- `$lookup`: join other collections
- `$sort`, `$skip`, `$limit`: pagination

**Optimization**: `$match` early to reduce documents before expensive stages

---

<a id="mongodb-transactions-acid"></a>
## 05_transactions_acid.md — ACID Compliance

**Transactions**: all-or-nothing semantics for multiple documents.

**When to use**:
- ✅ Money transfer (debit + credit atomic)
- ✅ Order + inventory deduction
- ❌ READ-ONLY queries (no atomicity needed)
- ❌ Large batch updates (use bulk operations)

**Example**:
```javascript
session.startTransaction();
db.accounts.updateOne({ _id: "A" }, { $inc: { balance: -100 } }, { session });
db.accounts.updateOne({ _id: "B" }, { $inc: { balance: 100 } }, { session });
session.commitTransaction();

// Guarantee: both updates or none (no partial state)
```

**Isolation**: SNAPSHOT (transaction sees consistent view at start time)

---

<a id="mongodb-replication-sharding"></a>
## 06_replication_sharding.md — Horizontal Scaling

### Replication (HA)
- **Replica Set**: Primary + Secondaries + Arbiter
- **Replication lag**: secondaries lag behind primary (acceptable)
- **Write concern** {w: "majority"}: durability guarantee
- **Read preference**: read from primary/secondary (consistency tradeoff)

### Sharding (Scale-out)
- **Shard**: subset of data (partitioned by shard key)
- **Mongos**: router determining which shard(s) to query
- **Shard key**: must have high cardinality, even distribution

**Shard Key Selection**:
- ✅ GOOD: userId, email (high cardinality, random)
- ❌ BAD: country (low cardinality, hot spots), timestamp (sequential)

**Query Impact**:
- Targeted query (shard key present): hits 1 shard (O(log n))
- Broadcast query (no shard key): hits all shards (O(log n × m))

---

<a id="mongodb-performance-tuning"></a>
## 07_performance_tuning.md — Production Optimization

**Working Set**: frequently accessed data (should fit in RAM).

**Optimization Checklist**:
| Issue | Solution |
|-------|----------|
| Missing index | Create appropriate index (50,000× speedup) |
| Query scanning docs | Add index or change query |
| High memory usage | Add RAM, shard, or reduce working set |
| Hot shard | Rebalance data or change shard key |
| Slow writes | Increase write concern or batch operations |

**Bulk Operations**:
- 100 individual inserts: 100 round trips, ~5000ms
- 1 bulk insert: 1 round trip, ~50ms
- **Speedup**: 100×

---

<a id="mongodb-security"></a>
## 08_security.md — Authentication & Authorization

**Authentication**: SCRAM-SHA-256, LDAP, X.509

**Authorization**: Role-based (RBAC)
- Built-in: `read`, `readWrite`, `dbOwner`, `backup`, `root`
- Custom: specific collection + action permissions

**Principle of Least Privilege**:
- API service: `readWrite` on app DB only
- Analytics: `read` on analytics DB only
- Backup: `backup` role only

**Security Practices**:
- ✅ TLS enabled (in-transit encryption)
- ✅ Authentication required
- ✅ Connection strings in environment variables
- ✅ Parameterized queries (prevent injection)
- ✅ Audit logging enabled

---

<a id="mongodb-interview-qa-scenarios"></a>
## 09_interview_qa_scenarios.md — Real-World Scenarios

**Scenario 1**: E-commerce orders with inventory (transaction, indexing)

**Scenario 2**: Real-time dashboard (time-series buckets, aggregation)

**Scenario 3**: Hot shard problem (hash shard key, distributed)

**Scenario 4**: Eventual consistency (Change Streams, batch jobs)

**Common Questions**:
- Multi-tenant SaaS schema design
- Scaling write-heavy workloads
- Event sourcing architecture
- Payment system (idempotency, concurrency)
- Time-series data at massive scale

---

## Key Takeaways for 7+ Years

1. **Design for access patterns**, not normalization
2. **Embed for speed**, reference for consistency
3. **Indexes are essential** (50,000× speedup possible)
4. **Transactions for critical operations** only, not everything
5. **Sharding by high-cardinality field** to avoid hot spots
6. **Time-series buckets** for massive event data
7. **Denormalization acceptable** if eventual consistency tolerable
8. **Security from day one**: auth, roles, TLS, audit logs
9. **Monitor working set, indexes, hot shards** continuously
10. **ACID vs Performance trade-off**: choose based on requirements

---

## MongoDB vs SQL

| Aspect | MongoDB | SQL |
|--------|---------|-----|
| Model | Document (JSON-like) | Relational (tables) |
| Schema | Flexible | Rigid |
| Joins | Embedding + $lookup | Foreign keys + JOIN |
| Horizontal scaling | Sharding (easy) | Sharding (complex) |
| Transactions | Multi-document (4.0+) | ACID always |
| Indexing | B-tree + text + geo | B-tree |
| Best for | Flexible data, high scale | Complex queries, ACID critical |

---

## When to Choose MongoDB

- ✅ Flexible/evolving schema
- ✅ High write throughput
- ✅ Horizontal scaling required
- ✅ Denormalized data acceptable
- ✅ Real-time analytics at massive scale

**When NOT to choose MongoDB**:
- ❌ Complex multi-table joins
- ❌ Data consistency critical (financial systems)
- ❌ Strong ACID requirements
- ❌ Small dataset fitting in SQL
- ❌ Team experienced only with SQL
