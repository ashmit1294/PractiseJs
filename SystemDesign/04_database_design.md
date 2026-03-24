# Database Design
> Resume Signal: MongoDB aggregation, compound indexing, 55% query reduction

---

## STAR Interview Answer

| | |
|---|---|
| **Situation** | A Node.js/MongoDB application was running slow aggregation queries (2–4s) on a growing orders collection (8M+ documents). Compound queries on `userId + status + createdAt` were doing full collection scans; the dashboard aggregation pipeline was recalculating from raw data on every page load. |
| **Task** | Reduce query latency and CPU load without migrating databases or the application schema. |
| **Action** | Profiled with `explain("executionStats")` to identify missing indexes. Added compound indexes matching query predicates in ESR order (Equality → Sort → Range). Pre-aggregated daily totals into a `daily_summaries` collection using a scheduled pipeline, so the dashboard read from 365 documents instead of 8M. Added read replicas for analytical queries, routing all aggregations to the secondary via `readPreference: 'secondary'`. |
| **Result** | Dashboard load time dropped from 3.8s to 0.4s. Query execution dropped by 55% measured via Atlas monitoring. Primary node CPU utilisation fell from 78% to 31% during peak hours. |

---

## ELI5

A phonebook without alphabetical order means reading every name to find one. An index is the alphabet tabs on the side — you jump straight to the right section. Sharding is splitting one giant phonebook into regional volumes. Read replicas are photocopies of the phonebook — let multiple people read simultaneously without tearing the original.

---

## SQL vs NoSQL Decision

| Dimension | SQL (PostgreSQL, MySQL) | NoSQL (MongoDB, DynamoDB, Cassandra) |
|-----------|------------------------|--------------------------------------|
| Schema | Rigid, enforced at DB level | Flexible, enforced at app level |
| Relationships | JOINs — powerful, native | Denormalize / embed, or `$lookup` |
| Transactions | Full ACID, multi-table | MongoDB: multi-doc ACID; others: eventual |
| Scaling | Vertical first; horizontal via read replicas + sharding (harder) | Horizontal-first design |
| Query language | SQL — expressive, declarative | MQL, DynamoDB expressions, CQL |
| Best for | Financial data, complex reporting, relational integrity | Flexible schemas, high write throughput, hierarchical documents |

**Decision framework:**

```
Does the data have strong relational integrity requirements?
  YES (orders → line items → products → inventory) → SQL

Does the schema change frequently or vary per record?
  YES (user-generated content, product catalogs with varying attributes) → NoSQL

Do you need horizontal write scaling from day one?
  YES (IoT events, user activity, social feed) → NoSQL (Cassandra, DynamoDB)

Do you need complex aggregation / reporting?
  YES → SQL OR MongoDB aggregation pipeline
```

---

## Indexing

### How indexes work

MongoDB (and SQL) store indexes as B-trees. A query without an index scans every document (COLLSCAN). An index lets the engine jump to matching entries in O(log n).

### ESR Rule for compound indexes

Order fields in compound indexes: **E**quality → **S**ort → **R**ange

```javascript
// Query: find orders for a user, sorted by date, within a date range
db.orders.find({
  userId: 'u123',          // Equality
  createdAt: { $gte: start, $lte: end }  // Range
}).sort({ createdAt: -1 }) // Sort
```

```javascript
// ✅ Correct index — ESR order
db.orders.createIndex({ userId: 1, createdAt: -1 });
//                       Equality   Sort+Range together

// ❌ Wrong order — Sort before Range breaks index efficiency
db.orders.createIndex({ createdAt: -1, userId: 1 });
```

### Diagnosing index usage

```javascript
// Always check executionStats before and after adding indexes
const plan = await db.orders.find({ userId: 'u123' })
  .explain('executionStats');

console.log(plan.executionStats.executionStages.stage);
// COLLSCAN = full scan = add an index
// IXSCAN   = index scan = ✅

console.log(plan.executionStats.nReturned);          // docs returned
console.log(plan.executionStats.totalDocsExamined);  // docs read — should be close to nReturned
```

### Index types

| Type | Syntax | Use case |
|------|--------|----------|
| Single field | `{ field: 1 }` | Simple equality/range queries |
| Compound | `{ a: 1, b: -1 }` | Multi-field queries, ESR rule |
| Text | `{ content: 'text' }` | Full-text keyword search |
| Partial | `{ status: 1 }, { partialFilterExpression: { status: 'active' } }` | Index only a subset (sparse) |
| TTL | `{ createdAt: 1 }, { expireAfterSeconds: 86400 }` | Auto-delete documents (sessions, logs) |
| Wildcard | `{ '$**': 1 }` | Dynamic/unknown field names |

---

## Aggregation Pipeline

MongoDB's aggregation pipeline processes documents through stages. Each stage transforms the dataset.

```javascript
// Pre-aggregate daily revenue — run as a scheduled job, write to summaries collection
const pipeline = [
  // Stage 1: Filter only completed orders in the target date range
  {
    $match: {
      status: 'completed',
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    }
  },

  // Stage 2: Group by date bucket and compute totals
  {
    $group: {
      _id: {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        category: '$category'
      },
      totalRevenue: { $sum: '$amount' },
      orderCount:   { $sum: 1 },
      avgOrderValue: { $avg: '$amount' }
    }
  },

  // Stage 3: Sort for easier reading
  { $sort: { '_id.date': -1 } },

  // Stage 4: Write to a summary collection (replaces existing docs)
  {
    $merge: {
      into: 'daily_summaries',
      on: '_id',
      whenMatched: 'replace',
      whenNotMatched: 'insert'
    }
  }
];

await db.orders.aggregate(pipeline).toArray();
```

```javascript
// Dashboard reads from 365 rows instead of 8M documents
const summary = await db.daily_summaries.find({
  '_id.date': { $gte: '2026-01-01', $lte: '2026-12-31' }
}).sort({ '_id.date': -1 }).toArray();
```

---

## Sharding

Distributes data across multiple servers (shards). Each shard holds a horizontal slice of the collection.

```
Without sharding:          With sharding (hash on userId):
  Single server              Shard 1: userId hash 0–33%
  All 100M docs              Shard 2: userId hash 33–66%
                             Shard 3: userId hash 66–100%

mongos (query router) directs queries to the correct shard(s)
```

### Shard key selection

| Pattern | Key | Pros | Cons |
|---------|-----|------|------|
| **Hashed** | `{ userId: 'hashed' }` | Even distribution | Range queries hit all shards |
| **Range** | `{ createdAt: 1 }` | Range queries target one shard | Hot shard if writes are always new dates |
| **Compound** | `{ tenantId: 1, userId: 1 }` | Queries scoped to tenant hit one shard | Must include tenantId in all queries |

**Hot shard anti-pattern:**
```javascript
// ❌ Monotonically increasing shard key — all new writes go to highest shard
{ _id: ObjectId() }   // ObjectId is time-based — causes hot shard
{ createdAt: 1 }      // Same problem

// ✅ Use hashed shard key to distribute writes evenly
db.runCommand({ shardCollection: 'orders', key: { userId: 'hashed' } });
```

---

## Read Replicas

Route read-heavy queries (reports, analytics, search) to replicas. Primary handles writes only.

```javascript
import mongoose from 'mongoose';

const conn = await mongoose.connect(process.env.MONGODB_URI, {
  replicaSet: 'rs0',
  readPreference: 'secondaryPreferred', // default: try secondary, fallback primary
});

// Analytical / reporting queries: explicitly use secondary
const stats = await Order.find({ status: 'completed' })
  .read('secondary')
  .lean();

// Write operations always go to primary (automatic)
await new Order(data).save();
```

---

## Key Interview Q&A

**Q: How did you achieve a 55% reduction in queries?**
> Three levers: (1) Added compound indexes matching query predicates in ESR order — eliminated COLLSCAN on the most frequent queries. (2) Pre-aggregated daily summaries via a scheduled pipeline so the dashboard read 365 rows instead of 8M documents. (3) Routed all analytical reads to a secondary replica so they no longer competed with write traffic on the primary.

**Q: When would you choose SQL over MongoDB?**
> When the domain has strong relational integrity — e.g. financial ledgers where a debit must always have a matching credit, or when the team needs to write complex ad-hoc reports with JOINs across many tables. MongoDB shines when the schema varies per record (e.g. product catalogs with heterogeneous attributes) or when horizontal write scale is needed from the start.

**Q: What's a hot shard and how do you fix it?**
> A hot shard gets disproportionate write traffic — typically because the shard key is monotonically increasing (ObjectId, timestamp). Fix: switch to a hashed shard key to distribute writes uniformly, or add a high-cardinality prefix (hash of userId) to a compound key.

**Q: How do compound indexes work with sort?**
> MongoDB can use an index to satisfy both a filter AND a sort in one pass — but only if the index prefix matches the filter fields and the sort direction matches the index direction. Mismatched sort directions force an in-memory sort (SORT stage) which has a 100MB memory limit before it fails.
