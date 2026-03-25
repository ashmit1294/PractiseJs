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

---

## ELI5: Actions Explained

> Every action taken in the STAR story above, explained like you're 5 years old.

| Action | ELI5 Explanation |
|--------|-----------------|
| **Profiled with `explain("executionStats")` to identify missing indexes** | Put a GPS tracker on your slow queries to see exactly what route they took through the data. Did the query read every single file in the cabinet (full scan = bad)? Or did it jump straight to the right drawer using the labels (index = good)? The `explain` report shows you the map of the journey so you know exactly where to add signposts. |
| **Added compound indexes in ESR order (Equality → Sort → Range)** | Like building a super-organised filing cabinet. First group files by customer name (equality = exact match), then sort each customer's files by date (sort), then allow filtering within that date shelf (range). If you put the labels in the wrong order, the cabinet becomes nearly as slow as having no labels at all — the order matters. |
| **Pre-aggregated daily totals into a `daily_summaries` collection** | Instead of recounting every apple sold this year every time a manager asks, you write down the daily total on a chalkboard at midnight. When the manager asks "what was my revenue last month?", you just add up 30 numbers from the chalkboard — not 8 million individual apple records. The dashboard reads 365 numbers instead of walking through millions of rows. |
| **Added read replicas, routing analytical queries to secondary via `readPreference: 'secondary'`** | Make a photocopy of the library's most popular reference book. Readers who just want to look things up use the copy — the original is reserved for new additions (writes). The primary server stops doing double duty, its CPU drops from 78% to 31%, and both the writers and the readers get faster service. |

---

## ELI5 Complex Keywords Glossary

| Term | ELI5 Explanation |
|------|-----------------|
| **Index** | A shortcut for finding data quickly. Without an index, the database reads every row (like reading a whole book to find one word). With an index, it jumps straight to the right page — like a book's index at the back. |
| **Compound Index** | An index built on multiple fields together. Like an alphabetically ordered phonebook sorted by last name, then first name — perfect for lookups that use both fields. |
| **COLLSCAN (Collection Scan)** | The slow path — the database reads every single document to find matches. Like searching for a name by reading every page of the phonebook. You want to avoid this with proper indexes. |
| **IXSCAN (Index Scan)** | The fast path — the database uses an index to jump directly to matching records. Like using the phonebook's alphabetical tabs to find the right section instantly. |
| **ESR Rule** | A recipe for ordering fields in a compound index: Equality fields first, Sort fields second, Range fields last. Following this order makes queries as fast as possible. |
| **B-tree** | The data structure used internally by database indexes. Like a family tree of sorted values — you start at the root and follow branches to find what you need in O(log n) steps instead of scanning everything. |
| **Aggregation Pipeline** | A series of transformation steps applied to your data one after another, like an assembly line. Each stage (filter, group, sort, reshape) processes the output of the previous stage. |
| **$match** | A pipeline stage that filters documents — like a WHERE clause in SQL. Only documents satisfying the condition pass through to the next stage. |
| **$group** | A pipeline stage that groups documents and computes summaries — like GROUP BY in SQL. Groups all orders by date and sums up the revenue. |
| **$merge** | A pipeline stage that writes the aggregation result into another collection (upsert). Used to pre-compute summaries into a separate "summary" collection. |
| **Sharding** | Splitting a database across multiple servers (shards) horizontally. Like splitting a giant phonebook into regional volumes (A–H on server 1, I–P on server 2). Allows write scale beyond one machine. |
| **Shard Key** | The field used to decide which shard a document lives on. Choose poorly and all writes go to one shard (hot shard). Choose a high-cardinality, evenly distributed key like a hashed userId. |
| **Hot Shard** | When one shard gets far more traffic than others because the shard key is poorly chosen. Like all new orders going to the same server because you sharded by date and today's date is always on one shard. |
| **Hashed Shard Key** | MongoDB hashes the shard key value before assigning the document to a shard. This spreads documents evenly — even if the key values are sequential. |
| **mongos (Query Router)** | The entry point to a sharded MongoDB cluster. It receives queries, figures out which shard(s) have the relevant data, and combines the results — transparent to your app. |
| **Read Replica** | A copy of the database that accepts only read queries. Offloads reporting and analytics from the primary database. Like a photocopy of the official record — everyone can read the copy, only authorized people update the original. |
| **Read Preference (secondary)** | A setting that tells your MongoDB driver to send read queries to a replica (secondary) instead of the primary. Reduces load on the primary, which is busy with writes. |
| **Primary Node** | The main database server that accepts all write operations. In a replica set there's exactly one primary at any time — it's the source of truth. |
| **Replica Set** | A group of MongoDB servers that keep identical copies of the data. One is primary (accepts writes), others are secondaries (replicate and serve reads). If the primary dies, a secondary is automatically elected as the new primary. |
| **ACID** | Four guarantees for database transactions: Atomicity (all or nothing), Consistency (valid state before and after), Isolation (concurrent transactions don't interfere), Durability (committed data survives crashes). |
| **Eventual Consistency** | A weaker guarantee than ACID — all nodes will *eventually* agree on the same value, but there might be a short window where different nodes show different data. Acceptable for things like view counts, not for bank balances. |
| **Pre-aggregation** | Computing expensive summaries in advance (e.g. daily revenue totals) and storing the results. Dashboard reads the small pre-computed table (365 rows) instead of crunching 8 million raw records on every page load. |
| **explain("executionStats")** | A MongoDB command that shows exactly how a query was executed — did it use an index? How many docs were examined vs returned? Essential for diagnosing slow queries before adding indexes. |
| **Partial Index** | An index that only covers a subset of documents matching a filter (e.g. only active users). Smaller, faster, and cheaper to maintain than a full index when you only query a subset. |
| **TTL Index** | A special index that automatically deletes documents after a set time period (e.g. 24 hours). Perfect for session data, temporary logs, or anything with a natural expiry. |
| **Denormalization** | Deliberately storing duplicated data to avoid expensive JOINs. Instead of a separate "author" table, you embed the author's name inside each post document. Faster reads, but updates must touch multiple places. |
