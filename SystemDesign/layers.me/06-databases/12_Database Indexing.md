# T12 — Database Indexing

---

## 1. ELI5

Imagine a library with 1 million books but NO catalog. To find a book about dinosaurs you'd have to open every single book, one by one. That's a **full table scan** — checking every row.

Now add a **card catalog**: alphabetical by topic, each card says "Dinosaurs → Shelf 7B, Row 3". You walk directly to the book. That's an **index** — a separate data structure that lets the database jump to exactly the right rows without reading everything.

The catch: every time a new book arrives, a librarian must also update the card catalog. That extra work is the **write overhead** of indexes.

---

## 2. Analogy

**Book index vs table of contents:**

- **Table of contents** (beginning of book) = clustered index → rows physically stored in order; one per table
- **Book index** (back of book) = secondary index → separate structure, points to page numbers; many per table

If you tear out the back-of-book index and store it separately with page pointers, that's a **non-clustered index**. The pointer from index entry → actual data page is an extra hop called a **key lookup** or **bookmark lookup** — costly if done millions of times.

---

## 3. Core Concepts

### B-Tree Index (Default for RDBMS)

```
100 million rows, B-tree height ~ 4-5 levels:

                    [Root Node]
                   /     |     \
            [50M]     [100M]    [150M]        ← Internal nodes (key ranges)
           /    \    /    \    /    \
        [...]  [...]        [...]  [...]       ← More internal nodes
                                    |
                       ┌────────────────────┐
                       │  Leaf Nodes (Linked)│
                       │  [key|ptr][key|ptr] │ ←→ [key|ptr][key|ptr] 
                       └────────────────────┘
                              ↓
                         Data Pages

Properties:
  Height:    log(base fan-out)(N rows) ≈ 4-5 levels for 100M rows
             (fan-out = 100-200 keys per node in 16KB pages)
  Lookup:    O(log N) → 4-5 I/Os for any point query
  Range:     Walk leaf nodes (linked list) → O(log N + K) for K results
  Insert:    O(log N) — may trigger page splits, propagate up
  Fill factor: 90% (leave 10% space to avoid frequent splits on insert)
```

### Hash Index

```
Key ──→ hash(key) ──→ Bucket ──→ [row_ptr, row_ptr, ...]

employees:
  hash("Alice") = bucket 42 → row_ptr → {id:1, name:"Alice", dept:"Eng"}
  hash("Bob")   = bucket 17 → row_ptr → {id:2, name:"Bob", dept:"HR"}

Pros:
  ✅ O(1) exact-match lookup — 20-30% faster than B-tree for equality
  ✅ Simple structure — no tree traversal
  
Cons:
  ❌ No range queries:  WHERE age > 30  ← impossible (hash destroys order)
  ❌ No sorting:        ORDER BY age    ← impossible
  ❌ No prefix queries: WHERE name LIKE 'A%' ← impossible
  ❌ Poor cache locality on collisions
  
Use: Redis key lookups; PostgreSQL hash index (equality-only columns)
     Rare in RDBMS — B-tree handles equality AND ranges
```

### Bitmap Index (OLAP Only)

```
Column: subscription_tier (values: FREE, PRO, ENTERPRISE)

           Row:  1  2  3  4  5  6  7  8
  FREE:         [1, 0, 1, 0, 1, 0, 0, 1]  ← bit vector
  PRO:          [0, 1, 0, 1, 0, 1, 0, 0]
  ENTERPRISE:   [0, 0, 0, 0, 0, 0, 1, 0]

Query: WHERE tier = 'FREE' AND country = 'US'
  → FREE bitmap AND US bitmap = bitwise AND in one CPU instruction
  → 10-100× compression vs B-tree for low-cardinality columns (few distinct values)

Pros:
  ✅ Blazing fast AND/OR/NOT operations (bitwise CPU ops)
  ✅ 10-100× storage compression vs B-tree
  ✅ Perfect for low-cardinality columns (gender, tier, status)
  
Cons:
  ❌ Write-hostile: UPDATE locks the ENTIRE bitmap for that value
  ❌ Concurrent writes cause contention → deadlocks at scale
  ❌ Useless for high-cardinality (email, user_id → 1-bit-per-value = huge)
  
Use: OLAP warehouses (Redshift, Druid, Elasticsearch); never in OLTP
```

---

## 4. Advanced Index Types

### Covering Index (Index-Only Scan)

```
Problem: query needs columns A, B, C but index only has column A
→ Index finds the rows, then jumps to data page for B and C
→ Each key lookup = extra I/O → 1M result rows = 1M extra I/Os = slow

Solution: include all query columns IN the index

Regular index on (user_id):
  SELECT user_id, created_at, status, fare
  FROM rides
  WHERE user_id = 123 AND created_at > '2024-01-01'
  → Index scan on user_id → 500 rows found → 500 key lookups for created_at/status/fare
  → 500 data page I/Os

Covering index on (user_id, created_at, status, fare):
  → Index has ALL needed columns
  → Index-only scan: never touch data pages
  → 50-90% latency reduction; no data page I/O at all

CREATE INDEX idx_rides_covering
ON rides (user_id, created_at)
INCLUDE (status, fare);        ← INCLUDE = stored in leaf but not sorted by

Cost: 2-3× larger index size vs single-column index
```

### Composite Index — Left-Prefix Rule

```
CREATE INDEX idx_composite ON orders (country, status, created_at);

This index CAN satisfy:
  ✅ WHERE country = 'US'
  ✅ WHERE country = 'US' AND status = 'pending'
  ✅ WHERE country = 'US' AND status = 'pending' AND created_at > '2024-01-01'
  ✅ WHERE country = 'US' AND created_at > '2024-01-01'  (country used; skip status)

This index CANNOT satisfy (no left prefix):
  ❌ WHERE status = 'pending'            ← skips country
  ❌ WHERE created_at > '2024-01-01'     ← skips country and status
  ❌ WHERE status = 'pending' AND created_at > '2024-01-01'  ← no country

Column order rule:
  1. Equality filters first (country = 'US', status = 'pending')
  2. Range filter last (created_at > X) — range stops the index scan
  3. High-selectivity first (fewer distinct values first = more rows filtered early)
```

### Partial Index (Filter Index)

```
-- Only index rows where status = 'pending' (10% of table)
CREATE INDEX idx_pending_orders
ON orders (created_at)
WHERE status = 'pending';

90% smaller than full index
Fast for common query: WHERE status = 'pending' ORDER BY created_at
Useless for: WHERE status = 'completed'

Use: soft-delete patterns (WHERE deleted_at IS NULL)
     active records (WHERE is_active = true)
```

---

## 5. Write Overhead Math

$$\text{Write cost} = \text{base write} + \sum_{i=1}^{n} \text{index}_i\text{ update cost}$$

```
Empirical measurements (PostgreSQL):
  Table with 0 indexes:  INSERT 100K rows → 1.2s
  Table with 1 index:    INSERT 100K rows → 1.4s  (+17%)
  Table with 5 indexes:  INSERT 100K rows → 2.1s  (+75%)
  Table with 10 indexes: INSERT 100K rows → 3.6s  (+200%)

Storage overhead:
  Table: 10GB
  + 5 B-tree indexes on various columns → ~15-30GB total
  
Recommendation:
  OLTP tables: max 5-7 indexes
  Read-heavy tables: up to 10 indexes acceptable
  Write-heavy tables (events, logs): 0-2 indexes maximum
  Audit tables: consider NO indexes beyond PK
```

### Index Selectivity

$$\text{Selectivity} = \frac{\text{distinct values}}{\text{total rows}}$$

```
High selectivity (→ 1.0): email, user_id, UUID → index is very useful
  → email in 1M users: 1M distinct / 1M rows = 1.0 selectivity
  → Index lookup finds exactly 1 row

Low selectivity (→ 0): boolean, status with 3 values → index often useless
  → is_active (true/false) in 1M users: 2 distinct / 1M rows = 0.000002
  → WHERE is_active = true returns 500K rows → full scan faster than index

Rule of thumb: index useful when query returns < 15-20% of rows
  If a query returns more: query optimizer will skip index → full scan
```

---

## 6. ASCII: Index Access Paths

```
QUERY: SELECT * FROM orders WHERE user_id = 42 AND created_at > '2024-01-01'

Path 1 — Full Table Scan (no useful index):
  ┌──────────────────────────────────────────────────────────┐
  │  Seq Scan → read ALL 50M rows → filter → 200 results    │
  │  Cost: 50M × 0.01ms = 500 seconds                       │
  └──────────────────────────────────────────────────────────┘

Path 2 — Index on (user_id):
  ┌─────────────────────────────────────────────────────────────┐
  │  Index Scan (user_id=42) → 5000 rows → filter created_at   │
  │  → 5000 key lookups → 200 results                          │
  │  Cost: 5000 × 0.1ms = 500ms                                │
  └─────────────────────────────────────────────────────────────┘

Path 3 — Composite Index on (user_id, created_at):
  ┌──────────────────────────────────────────────────────────────────┐
  │  Index Scan (user_id=42 AND created_at > X) → 200 rows directly │
  │  → 200 key lookups → 200 results                               │
  │  Cost: 200 × 0.1ms = 20ms                                      │
  └──────────────────────────────────────────────────────────────────┘

Path 4 — Covering Index on (user_id, created_at) INCLUDE (status, fare):
  ┌───────────────────────────────────────────────────────────────────┐
  │  Index-Only Scan → 200 results directly from index               │
  │  → 0 key lookups                                                 │
  │  Cost: 200 × 0.01ms = 2ms                                       │
  └───────────────────────────────────────────────────────────────────┘
```

---

## 7. MERN Stack Dev Notes

### MongoDB Index Patterns

```javascript
// MongoDB uses B-tree indexes under the hood (WiredTiger)

// Single field
db.rides.createIndex({ userId: 1 });          // 1 = ascending, -1 = descending

// Compound index (same left-prefix rule as SQL)
db.rides.createIndex({ userId: 1, createdAt: -1 });
// ✅ queries on { userId }
// ✅ queries on { userId, createdAt }
// ❌ queries on { createdAt } alone

// Covering index — include all projected fields
db.rides.createIndex(
  { userId: 1, createdAt: -1 },
  { name: "idx_rides_covering" }
);
// If query projects only userId + createdAt → index-only scan (no document fetch)

// Partial index — only index active rides
db.rides.createIndex(
  { createdAt: -1 },
  { partialFilterExpression: { status: "active" } }
);

// Check if queries use indexes
db.rides.find({ userId: "abc123" }).explain("executionStats");
// Look for: "IXSCAN" (good) vs "COLLSCAN" (bad = full collection scan)
// Check: "totalDocsExamined" should ≈ "totalDocsReturned"

// WRONG — missing index, causes COLLSCAN on large collection:
await Ride.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20);
// Fix: ensure compound index { userId: 1, createdAt: -1 } exists
```

### PostgreSQL Index in Node.js Context

```javascript
// Knex.js migration — add covering index
exports.up = (knex) =>
  knex.schema.table('rides', (t) => {
    // Composite covering index for the most common query pattern
    t.index(
      ['user_id', 'created_at'],
      'idx_rides_user_created',
      { storageEngineIndexType: 'btree' }
    );
  });

// Check for missing indexes in development (pg-specific)
// Run EXPLAIN ANALYZE and look for:
//   Seq Scan on rides (cost=0.00..5432.00 rows=250000)  ← BAD
//   Index Scan using idx_rides_user_created on rides    ← GOOD
//   Index Only Scan using idx_rides_covering on rides   ← BEST
```

---

## 8. Real-World Case Studies

### Uber — Composite + Covering Index

```
Problem: Driver-partner earnings page loaded in 8 seconds
Query: Get all rides for user_id=X from last 30 days, show fare + status + tip

Table: 500M rows, no useful compound index
  → Existing index: (user_id) only
  → Query: WHERE user_id = ? AND created_at > ? → 5000 rows examined per user
  → Key lookup for status, fare, tip on every row → 5000 data page reads
  → p99: 8s

Fix:
  CREATE INDEX idx_rides_covering
  ON rides (user_id, created_at DESC)
  INCLUDE (status, fare, tip);
  → Now: index-only scan → zero key lookups
  → p99: 120ms (66× improvement)

Write overhead: +15-20% on INSERT (acceptable for read-heavy rides table)
Ongoing: Uber runs "index advisor" jobs weekly — removes unused indexes
```

### Stripe — Index Pruning (Fewer is Better)

```
2019 audit: Stripe's payments table had 12 indexes
  → Write latency increased from 5ms → 30ms over 2 years
  → Reason: each INSERT updated 12 B-trees
  
Audit process:
  1. pg_stat_user_indexes: track index usage count over 30 days
  2. Indexes with idx_scan = 0 → not used by any query → DROP candidates
  3. Indexes with idx_scan < 100/day → review if still needed
  
Result: pruned to 5 indexes (dropped 7)
  → INSERT latency: 30ms → 8ms
  → Disk usage: -40%
  → Kept: PK index, unique constraint indexes, 3 high-traffic query indexes

Lesson: don't add indexes "just in case"; measure, then act
```

### Pinterest — Bitmap Indexes in Druid

```
Pinterest's feed analytics: 10B+ events/day in Apache Druid (OLAP)

Query: "How many users with tier=FREE AND country=US AND device=mobile 
        clicked a pin of category=food in the last 7 days?"

Four low-cardinality filter columns:
  tier:     4 distinct values (FREE, PRO, BUSINESS, ENTERPRISE)
  country:  250 distinct values
  device:   5 distinct values (mobile, desktop, tablet, app, other)
  category: 500 distinct values

B-tree approach (Postgres): 4 separate indexes, each requires row-by-row filtering → merge
Bitmap approach (Druid):    4 bit vectors → bitwise AND in single CPU pass

Result:
  Query latency:  B-tree: 4.2s → Bitmap: 18ms (233× faster)
  Storage:        B-tree: terabytes → Bitmap: 250GB (compressed bit vectors)
  
Trade-off: Druid is read-only (ingestion, not CRUD) → bitmap write-contention is non-issue
```

---

## 9. Interview Cheat Sheet

**Q: What is a database index and why does it have a write overhead?**
> An index is a separate data structure (usually B-tree) that maps column values to row locations, enabling O(log N) lookups instead of O(N) full scans. Write overhead occurs because every INSERT/UPDATE/DELETE must also update all relevant index structures. Each index adds ~10-30% write cost; a table with 10 indexes can be 3× slower at writes.

**Q: What is a covering index?**
> An index that includes all columns needed by a query — the query result can be served entirely from the index without ever touching the actual data pages ("index-only scan"). Reduces I/O by 50-90% for covered queries. Trade-off: 2-3× larger index size vs single-column index.

**Q: Explain the left-prefix rule for composite indexes.**
> A composite index on (A, B, C) can only be used when query predicates start with A. It satisfies: A alone, A+B, A+B+C. It cannot satisfy: B alone, C alone, or B+C. This is because the index is sorted by A first, then B within each A group, then C within each B group. Without A, the index has no useful sort order for the query.

**Q: When would you NOT add an index?**
> (1) Write-heavy tables (event logs, audit trails) — index overhead slows INSERT-dominant workloads. (2) Low-cardinality columns where queries return > 20% of rows — optimizer skips the index anyway and does a full scan. (3) Small tables (< 10,000 rows) — full scan is faster than index + key lookup I/O overhead. (4) Columns never used in WHERE, JOIN, or ORDER BY.

**Q: What's the difference between clustered and non-clustered index?**
> A clustered index defines the physical storage order of rows (one per table; defaults to primary key in MySQL InnoDB). A non-clustered (secondary) index is a separate structure with a pointer back to the data row. Key lookup on a non-clustered index requires an extra hop to the data page — covering indexes eliminate this hop.

---

## 10. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **B-Tree** | Self-balancing tree; default index; O(log N) lookup + range scans |
| **Hash Index** | O(1) exact-match only; no range or sort support |
| **Bitmap Index** | Bit vector per value; bitwise AND/OR; OLAP only; write-hostile |
| **Covering Index** | Index includes all query columns; enables index-only scan |
| **Composite Index** | Multi-column index; left-prefix rule applies |
| **Partial Index** | Filtered index (WHERE clause); smaller, faster for specific patterns |
| **Clustered Index** | Defines physical row order; one per table; PK in InnoDB |
| **Non-Clustered Index** | Separate structure with row pointer; key lookup required |
| **Index-Only Scan** | Query served entirely from index; no data page access |
| **Key Lookup** | Hop from index entry → data page to fetch non-indexed columns |
| **Full Table Scan** | Read every row; faster when query returns > 15-20% of rows |
| **Selectivity** | distinct_values / total_rows; high = index useful; low = skip it |
| **Fill Factor** | % of B-tree page used (default 90%); space for future inserts |
| **Index Bloat** | B-tree grows from deletions leaving dead pages; needs REINDEX |
| **EXPLAIN ANALYZE** | PostgreSQL: shows actual query plan + timing; use to find full scans |
| **pg_stat_user_indexes** | PostgreSQL: tracks index usage statistics; find unused indexes |
