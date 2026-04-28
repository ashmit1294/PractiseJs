# T06 — SQL Tuning

---

## 1. ELI5

Imagine you're looking for a specific book in a library. You could walk every single aisle reading every spine until you find it — that's a **full table scan**. Or, you could check the card catalog (index) to find the exact shelf location — that's an **index lookup**. 

SQL tuning is the art of making sure your database uses the card catalog instead of walking every aisle. It's also about finding and fixing the librarian habits that waste time — like asking "what's on shelf 3?" 1000 times in a loop (N+1 problem), or asking the librarian to reorganize the entire library every time you make a request.

---

## 2. Analogy

**Car Mechanic's Diagnostic Tool**

A good mechanic doesn't just gas up the car faster. They plug in a diagnostic tool (EXPLAIN/EXPLAIN ANALYZE) to see which system is actually malfunctioning. Then they fix the root cause — timing belt, clogged filter, wrong gear ratio. 

SQL tuning = plug in the diagnostic (EXPLAIN), read the output, identify the bottleneck (Seq Scan? Sort? Nested Loop?), apply the targeted fix (add index, rewrite query, add materialized view). Don't guess — diagnose.

---

## 3. Core Concept

### The Query Execution Pipeline

```
SQL Query Text
      │
      ▼
┌─────────────────┐
│  Parser         │  Parses SQL → AST (Abstract Syntax Tree)
└────────┬────────┘
         ▼
┌─────────────────┐
│  Planner /      │  Estimates costs, chooses execution strategy
│  Optimizer      │  Uses table statistics (row counts, distributions)
└────────┬────────┘
         ▼
┌─────────────────┐
│  Plan Tree      │  ← EXPLAIN shows THIS
│  (what DB will  │    Sequential Scan, Index Scan, Hash Join, etc.
│   actually do)  │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Executor       │  Runs the plan, reads pages from buffer pool / disk
└─────────────────┘
```

### EXPLAIN and EXPLAIN ANALYZE

```sql
-- EXPLAIN: shows the PLAN (estimated costs, no execution)
EXPLAIN SELECT * FROM orders WHERE user_id = 123;

-- EXPLAIN ANALYZE: executes query + shows actual timings
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;
-- ⚠️ This actually runs the query — use SELECT, not DELETE/UPDATE blindly
```

**Reading EXPLAIN output:**

```
Seq Scan on orders  (cost=0.00..84521.00 rows=1000000 width=120)
│           │              │         │              │        └── avg row size (bytes)
│           │              │         └── estimated rows returned
│           │              └── estimated total cost (arbitrary units)
│           └── estimated startup cost
└── Operation type

"cost" units: roughly proportional to page reads
  Sequential page read: cost = 1
  Random page read:     cost = 4
  CPU per row:          cost = 0.01
```

---

## 4. Red Flags in Execution Plans

### Red Flag 1: Sequential Scan on Large Tables

```
EXPLAIN output:
  Seq Scan on orders  (cost=0.00..845210.00 rows=3000000)
                                       ↑
                           HIGH COST! Reads ALL rows

What it means: No usable index. DB reads every page.
Fix: Add an index on the WHERE/JOIN column.

BEFORE:
  SELECT * FROM orders WHERE user_id = 123;
  → Seq Scan: reads 3M rows, finds 500 matching

AFTER: CREATE INDEX idx_orders_user_id ON orders(user_id);
  → Index Scan: reads index, finds 500 matching rows directly
  → Cost: 500 random reads vs 3M sequential reads
```

### Red Flag 2: Sort Method: external merge

```
Sort  (cost=... rows=100000)
  Sort Key: created_at DESC
  Sort Method: external merge  Disk: 24576kB
                               ^^^^
                    Spilling to disk! RAM insufficient for sort
                    
Fix options:
  1. Add index on (created_at DESC) → DB uses index order, no sort needed
  2. Increase work_mem (PostgreSQL config) for in-memory sort
  3. Reduce result set with stricter WHERE before sorting
```

### Red Flag 3: Nested Loop with High Row Estimates

```
Nested Loop  (cost=... rows=5000000)
  → Seq Scan on orders (rows=100000)
  → Seq Scan on users (1000 rows scanned per order row)

Nested Loop complexity: O(N × M) = 100,000 × 1000 = 100M operations!

Fix:
  Hash Join or Merge Join should be used instead.
  Add index on the join key → optimizer chooses Index Nested Loop (O(N log M))
  Or: let DB gather better statistics → ANALYZE orders users;
```

### Red Flag 4: High Rows Estimate vs Actual

```
EXPLAIN ANALYZE:
  Seq Scan  (cost=... rows=100)   ← estimated: 100 rows
            (actual time=... rows=50000 width=...)  ← actual: 50,000 rows

Huge discrepancy = stale statistics → optimizer made bad plan

Fix:
  ANALYZE table_name;  (updates statistics)
  Possibly: adjust default_statistics_target for specific columns
```

---

## 5. Common Anti-Patterns & Fixes

### Anti-Pattern 1: N+1 Queries

```javascript
// BAD: 1 query to get posts, then 1 query per post for author
const posts = await db.query('SELECT * FROM posts LIMIT 100');
for (const post of posts) {  // 100 iterations
  const author = await db.query(
    'SELECT name FROM users WHERE id = $1', [post.author_id]
  );
  post.authorName = author.rows[0].name;
}
// → 1 + 100 = 101 queries!

// GOOD: Single JOIN query
const posts = await db.query(`
  SELECT p.*, u.name AS author_name
  FROM posts p
  JOIN users u ON p.author_id = u.id
  ORDER BY p.created_at DESC
  LIMIT 100
`);
// → 1 query. The JOIN uses u.id index → fast.

// ALSO GOOD: Use IN() lookup (useful when entities are from different services)
const authorIds = posts.map(p => p.author_id); // [1, 2, 3, ...]
const authors = await db.query(
  'SELECT id, name FROM users WHERE id = ANY($1)', [authorIds]
);
const authorMap = Object.fromEntries(authors.rows.map(a => [a.id, a.name]));
posts.forEach(p => p.authorName = authorMap[p.author_id]);
// → 2 queries regardless of post count. O(N) not O(N²).
```

### Anti-Pattern 2: SELECT * (Fetching Unnecessary Columns)

```sql
-- BAD: fetches all columns including large TEXT/BLOB fields
SELECT * FROM users WHERE id = 123;
-- If users has bio TEXT (avg 2KB), profile_image BYTEA (avg 50KB):
-- → 52KB per row, clogs buffer pool, slower network transfer

-- GOOD: fetch only what you need
SELECT id, name, email, avatar_url FROM users WHERE id = 123;
-- → ~200 bytes transferred. Potentially covered by index (index-only scan).
```

### Anti-Pattern 3: Functions on Indexed Columns (Index Nullifier)

```sql
-- BAD: function on indexed column makes index unusable
SELECT * FROM orders WHERE DATE(created_at) = '2024-01-15';
-- DATE() is applied to every row → forces Seq Scan despite index on created_at

-- GOOD: use range comparison instead
SELECT * FROM orders 
WHERE created_at >= '2024-01-15' AND created_at < '2024-01-16';
-- → B-tree range scan on index: only reads matching rows

-- BAD: LOWER() on indexed email column
SELECT * FROM users WHERE LOWER(email) = 'alice@example.com';

-- GOOD: use citext extension or functional index
CREATE INDEX idx_users_email_lower ON users(LOWER(email));
SELECT * FROM users WHERE LOWER(email) = 'alice@example.com';
-- OR: store emails pre-lowercased; enforce at application layer
```

### Anti-Pattern 4: Implicit Type Conversions

```sql
-- BAD: user_id is INTEGER but passing VARCHAR
SELECT * FROM orders WHERE user_id = '123';
-- → DB must cast every row's user_id to VARCHAR to compare
-- → Index on user_id (INTEGER) is NOT used → full seq scan

-- GOOD: match types exactly
SELECT * FROM orders WHERE user_id = 123;
-- → Integer comparison, uses index
```

### Anti-Pattern 5: OFFSET Pagination (Deep Pages)

```sql
-- BAD: OFFSET for pagination
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 10000;
-- → DB reads 10,020 rows, discards first 10,000, returns 20
-- → O(offset) work grows with every page deeper

-- GOOD: Cursor-based pagination (keyset pagination)
-- Store last seen (created_at, id) from previous page
SELECT * FROM posts
WHERE created_at < $last_seen_ts
   OR (created_at = $last_seen_ts AND id < $last_seen_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
-- → Uses (created_at DESC, id DESC) index → O(1) regardless of page depth
```

---

## 6. ASCII: Query Execution Flow

```
Client sends: SELECT * FROM orders WHERE user_id = 123 AND created_at > '2024-01-01'

                    ┌─────────────────────────────────────────┐
                    │        PostgreSQL Query Planner          │
                    │                                          │
                    │  Available indexes:                      │
                    │    idx_orders_user_id (user_id)          │
                    │    idx_orders_created_at (created_at)    │
                    │    idx_orders_composite (user_id,        │
                    │                          created_at)     │
                    │                                          │
                    │  Statistics: user_id=123 → ~500 rows     │
                    │              created_at > 2024 → ~30K rows│
                    │                                          │
                    │  Decision: use composite index           │
                    │  (user_id + created_at both filtered)    │
                    └──────────────────┬──────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────┐
                    │       Index Scan: idx_orders_composite   │
                    │  1. B-tree: find rows where user_id=123  │
                    │  2. Within those: filter created_at > T  │
                    │  3. Follow heap pointers for row data    │
                    │  → ~500 index reads + ~500 heap fetches  │
                    │  → vs 3M rows for Seq Scan               │
                    └─────────────────────────────────────────┘
```

---

## 7. Index Tuning Guide

```sql
-- Composite index: column order matters
-- Query: WHERE user_id = ? AND status = ? AND created_at > ?

-- GOOD composite index (high selectivity first, range last)
CREATE INDEX idx_orders_user_status_dt 
ON orders(user_id, status, created_at DESC);
--         ↑        ↑        ↑
--   equality  equality   range
-- B-tree: equality columns must come before range column

-- COVERING INDEX: include all columns for index-only scan
CREATE INDEX idx_orders_covering
ON orders(user_id, created_at DESC)
INCLUDE (amount, status);  -- PostgreSQL 11+
-- → Query: SELECT amount, status FROM orders WHERE user_id=? ORDER BY created_at
-- → Uses index only (no heap access) = faster

-- PARTIAL INDEX: only index rows matching a condition
CREATE INDEX idx_orders_pending
ON orders(created_at) WHERE status = 'pending';
-- → 90% order rows are 'completed'; index only covers 10% 'pending' rows
-- → 10× smaller index = faster inserts + faster pending-order queries
```

---

## 8. Math & Formulas

### Index Selectivity

$$\text{selectivity} = \frac{\text{rows matching condition}}{\text{total rows}}$$

$$\text{selectivity} < 0.1 \text{ (10\%) → index useful}$$
$$\text{selectivity} > 0.3 \text{ (30\%) → seq scan may be faster}$$

At 30% selectivity, random I/O from index lookups exceeds sequential scan cost.

### Write Overhead Per Index

```
Each INSERT/UPDATE/DELETE requires updating ALL indexes.

Table with 5 indexes, INSERT rate 10K/sec:
  Total index writes = 10K × 5 = 50K leaf page writes/sec
  
    + B-tree rebalancing (splits)
    + WAL writes for each index update
    
Rule: every index adds ~10–30% write latency
      Table with 10 indexes: 2–3× slower writes than no indexes
```

### EXPLAIN ANALYZE Cost Interpretation

```
cost=X..Y — not milliseconds! Just relative cost units
  Actual execution time → look at "actual time=X..Y ms"
  
For accurate timings:
  Run EXPLAIN ANALYZE multiple times → first run cold (disk), subsequent warm (cache)
  Meaningful timing = warm cache run for OLTP queries
```

---

## 9. MERN Stack Dev Notes

### Mongoose — Add Indexes to Schema

```javascript
const orderSchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true }, // single field index
  status:    { type: String, enum: ['pending', 'completed', 'cancelled'] },
  createdAt: { type: Date, default: Date.now }
});

// Compound index for common query pattern
orderSchema.index({ userId: 1, createdAt: -1 });
// → Handles: db.orders.find({ userId }).sort({ createdAt: -1 }).limit(20)

// Partial index (MongoDB 3.2+)
orderSchema.index(
  { createdAt: 1 },
  { partialFilterExpression: { status: 'pending' } }
);

// EXPLAIN equivalent in MongoDB
await Order.find({ userId, status: 'pending' }).explain('executionStats');
// → Check: "stage": "IXSCAN" (good) vs "stage": "COLLSCAN" (bad)
// → Check: totalDocsExamined vs nReturned (ratio should be close to 1)
```

### Node.js / PostgreSQL — Query Profiling

```javascript
// Log slow queries (> 100ms) in development
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const originalQuery = pool.query.bind(pool);
pool.query = async function(text, params) {
  const start = Date.now();
  const result = await originalQuery(text, params);
  const duration = Date.now() - start;
  if (duration > 100) {
    console.warn('SLOW QUERY', { duration, text: text.substring(0, 200) });
  }
  return result;
};

// In PostgreSQL config (postgresql.conf):
// log_min_duration_statement = 100   ← log all queries > 100ms
// auto_explain.log_min_duration = 0  ← log EXPLAIN for slow queries
```

### Prisma — N+1 Detection

```javascript
// BAD: N+1 in Prisma
const posts = await prisma.post.findMany({ take: 100 });
for (const post of posts) {
  const author = await prisma.user.findUnique({ where: { id: post.authorId } });
}
// → 101 queries

// GOOD: Use include (Prisma JOIN)
const posts = await prisma.post.findMany({
  take: 100,
  include: { author: { select: { id: true, name: true, avatar: true } } }
});
// → 1 query with JOIN

// ALSO GOOD: select to limit fields
const posts = await prisma.post.findMany({
  take: 100,
  select: { id: true, title: true, createdAt: true,
            author: { select: { name: true } } }
});
```

---

## 10. Real-World Case Studies

### Shopify — Query Performance Budget

```
Problem: Checkout flow was slow; no single query stood out
Solution: Query performance budget

Rules enforced at code review:
  1. Max 5 queries per HTTP request
  2. No unbounded queries (must have LIMIT)
  3. No JOINs without covering index on join key
  4. All WHERE clauses must use indexed columns
  
Process: Added 12 missing indexes after audit; prioritized 4 critical for checkout
  Result: Checkout p99 latency: 800ms → 120ms
  
Tools: Rack Mini Profiler (shows query count per request in dev)
       "Query wall of shame" (internal page listing top offending queries)
```

### Stack Overflow — Full-Text Search Tuning

```
Problem: Tag search was slow (LIKE '%javascript%' = full scan)

BEFORE:
  SELECT * FROM posts WHERE body LIKE '%javascript%';
  → Seq Scan, 50M rows → 30+ seconds

AFTER:
  1. Added tsvector full-text column:
     ALTER TABLE posts ADD COLUMN body_tsv tsvector
       GENERATED ALWAYS AS (to_tsvector('english', body)) STORED;
  
  2. Added GIN index:
     CREATE INDEX idx_posts_body_fts ON posts USING GIN(body_tsv);
  
  3. GIN query:
     SELECT * FROM posts WHERE body_tsv @@ to_tsquery('javascript');
     → Index Scan: 50ms vs 30s → 600× improvement
  
Lesson: LIKE '%...%' is always a seq scan. Use tsvector + GIN for text search.
```

### GitHub — Trigram Indexes for Code Search

```
Problem: Users search for code snippets like "def authenticate" across millions of repos
LIKE '%def authenticate%' requires full scan

Solution: pg_trgm extension + GIN index
  CREATE EXTENSION pg_trgm;
  CREATE INDEX idx_code_content_trgm ON code_files USING GIN(content gin_trgm_ops);
  
  SELECT * FROM code_files WHERE content LIKE '%def authenticate%';
  → GIN trigram index decomposes query into trigrams: 'def', 'ef ', 'f a', ...
  → PostgreSQL intersects posting lists to find matching rows
  → 10-100× faster than seq scan
  
Additional: CTEs (WITH clause) for complex PR diff queries
  → Shared reference; PostgreSQL 12+ CTEs not always materialized (prefer MATERIALIZED hint if needed)
```

---

## 11. Interview Cheat Sheet

**Q: What is EXPLAIN ANALYZE and what do you look for?**
> `EXPLAIN ANALYZE` executes the query and shows the actual execution plan with real timings. Look for: (1) `Seq Scan` on large tables — add an index. (2) `Sort Method: external merge Disk:` — query is sorting more data than fits in RAM; add index on ORDER BY column or increase work_mem. (3) High estimated rows vs actual rows — run ANALYZE to update statistics.

**Q: What is the N+1 query problem?**
> When code executes 1 query to fetch N records, then N more queries (one per record) to fetch related data. Total: N+1 database round trips. Fix: use JOIN or IN() lookup to fetch all related data in 1-2 queries regardless of N.

**Q: Why does putting a function in a WHERE clause hurt performance?**
> `WHERE LOWER(email) = 'alice@example.com'` — the DB must call LOWER() on every row to compute a transformed value before comparing. This prevents using the B-tree index on `email`. Fix: create a functional index `ON table(LOWER(email))`, or store data pre-transformed.

**Q: What is cursor-based pagination and why is it better than OFFSET?**
> OFFSET N forces the DB to fetch and discard N rows before returning results. For deep pages (OFFSET 100000), this is O(100000) wasted work. Cursor-based pagination uses a WHERE clause with the last seen value: `WHERE created_at < $lastTs`. This uses the index directly — O(log N) regardless of page depth.

**Q: What's a covering index?**
> An index that contains all columns needed to satisfy a query — the DB can answer the query from the index alone without accessing the heap (table). Example: `CREATE INDEX ON orders(user_id, created_at) INCLUDE (amount, status)` covers `SELECT amount, status FROM orders WHERE user_id = ? ORDER BY created_at`. 50-90% faster than non-covering equivalent.

---

## 12. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **EXPLAIN** | Shows query execution plan without running the query |
| **EXPLAIN ANALYZE** | Runs query and shows actual execution plan with timings |
| **Seq Scan** | Sequential table scan — reads every row; slow for large tables |
| **Index Scan** | Uses B-tree index to directly locate rows; fast |
| **N+1 Problem** | 1 query to fetch records + N queries for related data |
| **Covering Index** | Index containing all queried columns — no heap access needed |
| **Partial Index** | Index only covering rows matching a condition; smaller and faster |
| **Composite Index** | Index on multiple columns; left-prefix rule applies |
| **Index Selectivity** | Fraction of rows matching condition — lower = better index candidate |
| **Cursor-Based Pagination** | Using WHERE to skip rows, not OFFSET; O(log N) not O(N) |
| **Write Amplification** | Each index adds overhead to every INSERT/UPDATE/DELETE |
| **Functional Index** | Index on a function result: ON table(LOWER(email)) |
| **GIN Index** | Generalized Inverted Index — used for arrays, full-text, JSON in PostgreSQL |
| **Statistics** | Histograms of column data distributions used by query planner |
| **ANALYZE** | Updates table statistics used by planner; run after bulk imports |
| **work_mem** | PostgreSQL per-query memory for sorts/hash joins; increase for sort spills |
