# Indexing Strategies & Query Optimization

## Why Indexing Matters

**WHAT**: What happens without indexes, and why are they essential?

**THEORY**:
- **Without index**: MongoDB must scan every document (COLLSCAN) → O(n) query time
- **With index**: MongoDB uses B-tree to locate documents (IXSCAN) → O(log n) query time
- **Index overhead**: takes memory, slows writes (must update index too)
- **Selective indexing**: index only frequently-queried fields
- **Index statistics**: use `explain()` to verify index usage

```javascript
// Without index: scan every document
db.users.find({ email: "john@example.com" }).explain("executionStats");
// Result: executionStats.executionStages.stage = "COLLSCAN"
//         examined: 1000000 documents (slow!)

// Create index
db.users.createIndex({ email: 1 });

// With index: B-tree lookup
db.users.find({ email: "john@example.com" }).explain("executionStats");
// Result: executionStats.executionStages.stage = "IXSCAN"
//         examined: 1 document (fast!)
```

---

## Index Types

### Single Field Index

```javascript
// Most common: index for direct field queries
db.users.createIndex({ email: 1 });  // ascending
db.users.createIndex({ age: -1 });   // descending

// Query: benefits from email index
db.users.find({ email: "john@example.com" });

// Query performance
// Without index: O(n) collection scan
// With index: O(log n) b-tree lookup
```

### Compound Index (Multi-Field)

**WHAT**: How do I optimize queries on multiple fields?

**THEORY**:
- **Compound index** indexes multiple fields in specific order
- **Index order matters** for queries using multiple fields
- **Selectivity order**: index on most selective field first (narrows down results most)
- **Sort order**: ascending/descending affects range queries
- **Index intersection**: MongoDB can combine multiple indexes (MongoDB 4.4+)

```javascript
// Create compound index: email ascending, createdAt descending
db.users.createIndex({ email: 1, createdAt: -1 });

// Benefits these queries:
db.users.find({ email: "john@example.com" });
db.users.find({ email: "john@example.com", createdAt: { $gt: date } });
db.users.find({ email: "john@example.com" }).sort({ createdAt: -1 });

// Does NOT benefit: query missing leading field
db.users.find({ createdAt: { $gt: date } });  // createdAt alone NOT indexed

// Index field order matters: Most selective first
// Ratio of distinct values: email (100%) > status (10%) > country (50%)
// GOOD: { email: 1, country: 1, status: 1 }
// BAD: { status: 1, email: 1, country: 1 }

// Ascending vs descending matters for sort
db.users.find({ email: "john@example.com" }).sort({ createdAt: -1 });
// Benefits from index { email: 1, createdAt: -1 } (no SORT stage)
// Does NOT benefit from { email: 1, createdAt: 1 }
```

**Compound Index Best Practices**:
- Order: Equality fields → Range fields → Sort fields (ESR rule)
- Example: `{ status: 1, age: { $gt: 30 }, createdAt: -1 }`
  - Index: `{ status: 1, age: 1, createdAt: -1 }`

### Array Index (Multikey)

```javascript
// Index array fields for element query
db.users.createIndex({ tags: 1 });

// Queries benefit
db.users.find({ tags: "javascript" });  // any element = "javascript"
db.users.find({ tags: { $in: ["js", "python"] } });

// Performance: O(log n) for "javascript" in tags array
// Index entry for each array element
```

### Geospatial Index

```javascript
// Index location coordinates for proximity queries
db.stores.createIndex({ location: "2dsphere" });

// 2dsphere: supports queries on Earth sphere coordinates
db.stores.insertOne({
  _id: 1,
  name: "Store SF",
  location: { type: "Point", coordinates: [-122.4194, 37.7749] }
});

// Find stores within 5000 meters of point
db.stores.find({
  location: {
    $near: {
      $geometry: { type: "Point", coordinates: [-122.4194, 37.7749] },
      $maxDistance: 5000
    }
  }
});
```

### Text Search Index

```javascript
// Index for full-text search
db.articles.createIndex({ title: "text", content: "text" });

// Text search query
db.articles.find({ $text: { $search: "mongodb performance" } });

// Indexes content for performance
```

---

## Index Strategies for Experienced Teams

### Strategy 1: ESR Rule (Equality, Sort, Range)

```javascript
// Query: Find users by status, sort by createdAt, range on age
db.users.find({
  status: "active",
  age: { $gt: 25, $lt: 65 },
  createdAt: { $gt: date }
}).sort({ createdAt: -1 });

// ESR Index: Equality → Sort → Range
// ❌ WRONG: { age: 1, status: 1, createdAt: -1 }
// ✅ CORRECT: { status: 1, createdAt: -1, age: 1 }

// Execution with correct index:
// 1. Use index equality → find all status="active"
// 2. Order by createdAt (already sorted in index)
// 3. Filter age range in memory (small result set)
```

### Strategy 2: Sparse & Partial Indexes

```javascript
// SPARSE: Only index documents with field present
db.users.createIndex({ email: 1 }, { sparse: true });

// Benefit: smaller index, ignores null/missing values
// Use case: optional fields (email for some users)

// PARTIAL: Only index documents matching condition
db.users.createIndex(
  { email: 1 },
  { partialFilterExpression: { active: true } }
);

// Benefit: much smaller index, only active users indexed
// Query: find active users by email (uses partial index)
db.users.find({ email: "john@example.com", active: true });
```

### Strategy 3: Index Size & Performance

```javascript
// Large index = memory pressure = performance degradation
// Rule: indexes should fit in RAM (working set)

// Check index size
db.users.aggregate([
  { $indexStats: {} }
]);

// Output example:
// [
//   {
//     name: "email_1",
//     key: { email: 1 },
//     size: 1024000,  // 1 MB
//     accesses: { ops: 15000, since: ISODate(...) }
//   }
// ]

// Delete unused indexes (0 accesses over time)
db.users.dropIndex("email_1");
```

### Strategy 4: Covered Queries

**WHAT**: How do I query without touching documents?

**THEORY**:
- **Covered query**: both query and projection fields are in index
- MongoDB returns result entirely from index, **doesn't access document**
- Dramatic performance improvement (1000+ times faster for large result sets)
- Requirement: must exclude `_id` or include it in index

```javascript
// Create compound index: email, name, status
db.users.createIndex({ email: 1, name: 1, status: 1 });

// COVERED query: returns user email, name, status from index only
db.users.find(
  { email: "john@example.com" },
  { projection: { email: 1, name: 1, status: 1, _id: 0 } }
).explain("executionStats");

// Result: IXSCAN, 0 documents examined in collection stage
// Entire result from index!

// NOT covered: result includes fields not in index
db.users.find(
  { email: "john@example.com" },
  { projection: { email: 1, avatar: 1, _id: 0 } }  // avatar not in index
);
// IXSCAN + FETCH: uses index to find document, then fetches avatar
```

---

## Query Optimization: explain() Deep Dive

```javascript
// Comprehensive query analysis
const explanation = db.users.find({
  status: "active",
  age: { $gt: 25 }
}).explain("executionStats");

// Key metrics:
explanation.executionStats.executionStages.stage;
// "IXSCAN" = using index ✅
// "COLLSCAN" = full collection scan ❌

explanation.executionStats.totalDocsExamined;  // docs examined
explanation.executionStats.totalKeysExamined;  // index keys examined
explanation.executionStats.nReturned;          // docs returned

// Efficiency ratio (should be close to 1.0)
const efficiency = explanation.executionStats.nReturned /
                   explanation.executionStats.totalDocsExamined;
// 1.0 = perfect (every doc examined is returned)
// >1 = problem (examining many docs, returning few)

// Example: query is inefficient
{
  "executionStats": {
    "totalKeysExamined": 100000,
    "totalDocsExamined": 100000,
    "nReturned": 10,
    "executionStages": { "stage": "COLLSCAN" }
  }
}
// Efficiency: 10/100000 = 0.0001 (BAD!)
// Needs better index or query adjustment
```

---

## Common Index Mistakes to Avoid

| Mistake | Impact | Solution |
|---------|--------|----------|
| Index on low-cardinality field (status: active/inactive) | Huge index, little benefit | Use compound index or partial index |
| Too many indexes | Write slowdown, memory pressure | Only index frequently-queried fields |
| Wrong index order | Query doesn't use index | Use ESR rule |
| Index on every field | Memory bloat | Selective indexing (top 20% queries) |
| Missing index for sort | In-memory sort on result set | Add index matching sort order |
| Not monitoring index usage | Dead indexes wasting memory | Use $indexStats periodically |

---

## Time Complexity: Indexing Impact

| Scenario | Without Index | With Index | Improvement |
|----------|---------------|-----------|-------------|
| Find 1 doc in 1M | O(1,000,000) | O(20) | 50,000× |
| Range query (1M→1K docs) | O(1,000,000) | O(10,000) | 100× |
| Sorted range (1M docs) | O(1M log M) sort | O(10K) index | 100,000× |
| Covered query (full scan) | O(1M) | O(1K) from index | 1000× |
