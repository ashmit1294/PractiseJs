# T09 — Database Caching

---

## 1. ELI5

Your database is like a huge library with millions of books stored on distant shelves (disk). Every time someone asks for a book, a librarian has to walk to the shelf, find the book, and bring it to the front desk. This is slow.

Smart libraries have a **front-desk reading shelf** — the most popular books sit right at the front desk. The librarian just grabs them instantly without walking to the shelves.

**Database caching = that reading shelf.** Databases automatically keep frequently-used data in RAM so they don't have to read from disk every time. Your applications can add additional caching layers (Redis) on top for even faster access.

---

## 2. Analogy

**Chef's mise en place (kitchen prep station):**

A professional chef doesn't store everything in the walk-in freezer (disk). They pre-cut vegetables, pre-measured ingredients, and prepared sauces sit right on the prep station (RAM buffer). During service, 90% of what they need is within arm's reach. Only for unusual orders do they go to the freezer.

Databases do this automatically (buffer pool). You can also help by putting the most-asked-for data in Redis (a second prep station right next to the chef).

---

## 3. Layers of Database Caching

```
┌──────────────────────────────────────────────────────────────────────┐
│ Layer 1: Application Redis Cache                                     │
│ (built by you — fastest, most flexible)                              │
│ What: computed results, joins, aggregations, session data            │
│ Speed: < 1ms                                                         │
├──────────────────────────────────────────────────────────────────────┤
│ Layer 2: Database Connection Pool (pgBouncer, HikariCP)              │
│ (reduces connection overhead — quasi-cache)                          │
│ What: persistent connections reused across requests                  │
│ Speed: connection reuse saves 50-200ms connection setup time         │
├──────────────────────────────────────────────────────────────────────┤
│ Layer 3: Database Buffer Cache (automatic, managed by DB engine)     │
│ InnoDB Buffer Pool (MySQL) / Shared Buffers (PostgreSQL)             │
│ What: data pages + index pages cached in RAM                         │
│ Speed: RAM access (< 0.1ms) vs disk (1-5ms)                         │
├──────────────────────────────────────────────────────────────────────┤
│ Layer 4: OS Page Cache                                               │
│ (automatic — OS keeps recently-accessed disk pages in RAM)           │
│ What: file-level read caching before data reaches DB                 │
│ Speed: transparent to DB                                             │
├──────────────────────────────────────────────────────────────────────┤
│ Layer 5: Storage Hardware Cache                                       │
│ SSD write cache / RAID controller cache                              │
│ What: recent writes buffered in hardware before disk commit          │
│ Speed: hardware-level, transparent                                   │
└──────────────────────────────────────────────────────────────────────┘

Developer focus: Layers 1-3 (control and configure these)
```

---

## 4. InnoDB Buffer Pool (MySQL)

```
Default: 128MB (designed for tiny databases in 2001 — absurdly small for 2025)
Recommended: 70-80% of available RAM

Configuration:
  # /etc/mysql/mysql.conf.d/mysqld.cnf
  innodb_buffer_pool_size = 12G    # For 16GB RAM server (75%)
  innodb_buffer_pool_instances = 8  # Divide into 8 pools (reduce mutex contention)

What it caches:
  - Data pages (16KB blocks of table data)
  - Index pages (B-tree index nodes)
  - Database page metadata
  
  When buffer pool full: LRU eviction (Least Recently Used page evicted)
  
How to check utilization:
  SHOW ENGINE INNODB STATUS;
  
  Key metrics:
    Buffer pool hit rate: target > 99% (less than 1% disk reads)
    Pages read:    total pages read from disk (high = buffer pool too small)
    Pages written: total pages written to disk
    
  Formula:
    hit_rate = (buffer_pool_reads - physical_disk_reads) / buffer_pool_reads
    If hit_rate < 99% → increase innodb_buffer_pool_size

Memory anatomy for 16GB server:
  12GB: innodb_buffer_pool (data + indexes)
  1GB:  sort buffer + join buffer (per-connection)
  1GB:  innodb_log_buffer (WAL before disk)
  2GB: OS + system overhead
```

---

## 5. PostgreSQL Shared Buffers

```
Default: 128MB (also too small)
Recommended: 25% of RAM (PostgreSQL relies heavily on OS page cache for the rest)

Configuration:
  # postgresql.conf
  shared_buffers = 4GB          # 25% of 16GB RAM
  effective_cache_size = 12GB   # hint to query planner: OS page cache size
  work_mem = 256MB              # per-sort/join operation (careful: N connections × work_mem)
  
  # PostgreSQL vs MySQL: PostgreSQL uses OS page cache MORE aggressively
  # OS page cache (mmap) acts as a second buffer layer
  # Total effective RAM cache = shared_buffers + OS page cache

PostgreSQL pg_buffercache extension:
  SELECT count(*), reldatabaseid
  FROM pg_buffercache
  GROUP BY reldatabaseid;
  -- Shows which databases are taking up buffer space
  
  SELECT schemaname, tablename, count(*) as buffers
  FROM pg_buffercache JOIN pg_class ON relfilenode = relfilenode
  GROUP BY 1,2 ORDER BY 3 DESC LIMIT 10;
  -- Shows which tables are most buffer-resident (hot tables)
```

---

## 6. Query Result Cache (MySQL — Deprecated Warning)

```
MySQL Query Cache (removed in MySQL 8.0):
  Cached results of SELECT queries keyed by exact SQL text
  
  Why it was removed:
  1. Single global mutex: every read OR write must lock the query cache
     → At high concurrency, cache becomes bottleneck (worse than no cache)
  2. Any table write → ALL queries on that table invalidated
     → Write-heavy tables = constant cache invalidation → 0 hit ratio
  3. SQL must be byte-identical (even whitespace differences = miss)
  
  Lesson: application-level Redis caching is ALWAYS better than DB query cache
  → You control the invalidation granularity
  → No global mutex
  → Works for any query result, even complex joins

PostgreSQL has NO query cache (by design — rely on Redis for this)
  → Connection overhead reduced with PgBouncer
  → Data cached by shared_buffers + OS page cache
  → Application responsible for caching query results via Redis
```

---

## 7. Connection Pooling (pgBouncer / HikariCP)

```
Problem: Each PostgreSQL connection = dedicated OS process (~10MB RAM + 50ms setup)
  100 Node.js instances × 10 connections each = 1,000 DB connections = 10GB RAM on DB server
  Connection setup on each request: 50-200ms (TCP + TLS + auth handshake)
  
Solution — Connection Pooler:
  pgBouncer sits between app and PostgreSQL
  Maintains a pool of 20-100 persistent connections to PostgreSQL
  Multiplexes thousands of app requests over those 20 connections
  
  [App instance 1] → ─┐
  [App instance 2] → ─┤   pgBouncer (20 persistent connections)   PostgreSQL
  [App instance 3] → ─┼─►────────────────────────────────────────► (20 processes)
  [App instance 4] → ─┤   pools: transaction / session / statement
  [App instance N] → ─┘
  
  Pool modes:
    Transaction pooling: connection released back to pool after each transaction
      (most efficient — 1000s of app requests share 20 connections)
    Session pooling: connection held for entire user session
      (less efficient but needed for session-level features like advisory locks)

pgBouncer install:
  apt install pgbouncer
  
  /etc/pgbouncer/pgbouncer.ini:
  [databases]
  myapp = host=127.0.0.1 port=5432 dbname=myapp
  
  [pgbouncer]
  pool_mode = transaction
  max_client_conn = 10000
  default_pool_size = 25
  
  Node.js connects to pgBouncer:5432 instead of PostgreSQL:5432
  
Performance gain:
  Before: 5,432 connections → PostgreSQL at capacity (OOM)
  After: 5,432 app connections → pgBouncer → 25 PostgreSQL connections → smooth
```

---

## 8. What to Cache in Redis (Application Layer)

```
✅ Cache these with Redis:
  - Expensive JOINs across multiple tables
    e.g., user + orders + order_items + products (5-table join → 50ms → Redis < 1ms)
    
  - Aggregations (COUNT, SUM, AVG over large tables)
    e.g., total revenue this month: SUM(order.total) — recalculate rarely
    
  - Full-text search results (before hitting Elasticsearch for common queries)
  
  - Paginated results (page 1 of products — millions of users request this)
  
  - User session data (auth tokens, cart, preferences) 
    → DB read on every authenticated request = expensive
    → Redis: every request fast
    
  - ML model results / recommendation scores
    (inference is expensive — cache recommendations per user with 15min TTL)

❌ Don't cache in Redis (already handled by DB buffer):
  - Raw row reads by primary key (already in InnoDB buffer pool at nanosecond speed)
  - Index-backed lookups on frequently-queried columns (already in memory)
  - Simple single-row reads that the DB's own buffer handles efficiently
  
  Caching raw rows in Redis when they're already in the DB buffer pool:
  → Double serialization overhead (DB → object → JSON → Redis → JSON → object)
  → Net result: SLOWER than just querying the DB directly
```

---

## 9. Node.js Implementation

```javascript
// Pattern: intelligently cache expensive DB operations
class ProductRepository {
  constructor(pg, redis) {
    this.pg = pg;
    this.redis = redis;
  }
  
  // Simple PK lookup — DON'T cache (InnoDB buffer handles this)
  async findById(productId) {
    // db buffer pool already has this in RAM — Redis would add overhead
    return this.pg.query('SELECT * FROM products WHERE id = $1', [productId]);
  }
  
  // Expensive join + aggregation — CACHE this
  async getProductWithStats(productId) {
    const key = `product:stats:${productId}`;
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);
    
    // This join takes 80ms — worth caching
    const result = await this.pg.query(`
      SELECT p.*, 
             COUNT(r.id) as review_count,
             AVG(r.rating) as avg_rating,
             COUNT(DISTINCT o.id) as order_count
      FROM products p
      LEFT JOIN reviews r ON r.product_id = p.id
      LEFT JOIN order_items oi ON oi.product_id = p.id
      LEFT JOIN orders o ON o.id = oi.order_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [productId]);
    
    await this.redis.set(key, JSON.stringify(result.rows[0]), 'EX', 300); // 5 min
    return result.rows[0];
  }
  
  // Aggregation — CACHE this
  async getCategoryRevenue(categoryId) {
    const key = `revenue:category:${categoryId}`;
    const cached = await this.redis.get(key);
    if (cached) return parseFloat(cached);
    
    const result = await this.pg.query(`
      SELECT SUM(oi.price * oi.quantity) as total
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE p.category_id = $1
        AND oi.created_at > NOW() - INTERVAL '30 days'
    `, [categoryId]);
    
    const revenue = result.rows[0].total;
    await this.redis.set(key, revenue.toString(), 'EX', 3600); // 1 hour
    return revenue;
  }
}

// pgBouncer + PostgreSQL connection setup
const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',      // pgBouncer address (not PostgreSQL directly)
  port: 6432,            // pgBouncer default port
  database: 'myapp',
  user: 'appuser',
  password: process.env.DB_PASSWORD,
  max: 10,               // App-level pool (multiplied by pgBouncer)
  idleTimeoutMillis: 30000,
});
```

---

## 10. Real-World Examples

### Stack Overflow — Heavily Optimized DB Caching

```
SQL Server + aggressive in-memory caching:
  Stack Overflow serves 1.5 billion pageviews/month on just 9 web servers
  SQL Server (2 servers, primary + replica)
  
  Key insight: most DB data fits in SQL Server buffer pool
    Question data: billions of posts, but HOT data (recent/popular) = ~50GB
    SQL Server buffer pool: 256GB RAM
    → 90%+ of reads served from memory (in-process buffer)
    
  Stack Overflow also uses Redis for:
    - Leaderboard / reputation scores
    - User preferences and settings (avoid repeated profile queries)
    - Tag top-question lists (expensive sort)
    
  Lesson: don't add Redis for everything — let DB buffer pool work
    Redis only where DB buffer pool can't keep up (large computed datasets)
```

### GitHub — MySQL Buffer Pool + Redis

```
GitHub's MySQL setup:
  innodb_buffer_pool_size: 400GB (on high-memory servers)
  Most of the hot code repository data fits in buffer pool
  
  Redis use cases at GitHub:
    - Pull request cache (expensive: involves diff computation + comment counts)
    - CI/CD job status (high write rate — Redis first, MySQL async)
    - Repository statistics (stars, forks, watchers — costly aggregations)
    
  What NOT in Redis at GitHub:
    - Repository blobs (Git object storage is separate — not in RDBMS)
    - Simple row lookups — MySQL buffer pool handles these at sub-millisecond speed
```

---

## 11. Interview Cheat Sheet

**Q: What is the InnoDB buffer pool?**
> MySQL's in-memory cache for data pages and index pages. Reducing disk I/O is the #1 performance lever. Should be set to 70-80% of available RAM. A hit rate below 99% means the buffer pool is too small and the DB is doing excessive disk reads. Like a cache inside the database engine itself.

**Q: Why was MySQL query cache removed in MySQL 8.0?**
> The query cache used a global mutex that all reads and writes competed for. At high concurrency, it became a bottleneck worse than no cache. Additionally, any write to a table invalidated ALL cached queries for that table — write-heavy tables had 0 effective hit ratio. Application-level Redis provides better performance with developer-controlled invalidation.

**Q: What is pgBouncer and why is it used?**
> Connection pooler for PostgreSQL. Maintains a small pool of real PostgreSQL connections (e.g., 25) and multiplexes thousands of application connections across them. Eliminates the 50-200ms connection setup overhead and prevents OOM from too many PostgreSQL processes. Critical for Node.js apps that create many short-lived connections.

**Q: What should and should not be cached in Redis vs letting the DB handle it?**
> Cache: expensive JOINs, aggregations (SUM/COUNT/AVG over large tables), paginated results, ML scores/recommendations. Do NOT redundantly cache: simple PK lookups that InnoDB buffer pool already serves from RAM (adding Redis adds JSON serialization overhead and is actually slower).

---

## 12. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Buffer Pool** | InnoDB's in-RAM cache for data and index pages; set to 70-80% of available RAM |
| **Shared Buffers** | PostgreSQL's equivalent of InnoDB buffer pool; set to 25% of RAM |
| **Buffer Pool Hit Rate** | % of data reads served from RAM vs disk; target > 99% |
| **OS Page Cache** | OS-level file cache; PostgreSQL relies on it heavily as a second memory tier |
| **Query Cache** | MySQL feature (deprecated in 8.0) that cached SELECT results; caused mutex bottleneck |
| **pgBouncer** | Connection pooler for PostgreSQL; multiplexes app connections over small DB connection pool |
| **Connection Pooling** | Maintaining persistent DB connections for reuse, eliminating per-request connection setup |
| **HikariCP** | High-performance Java JDBC connection pool (used with Spring Boot) |
| **innodb_buffer_pool_size** | MySQL config: total RAM allocated to InnoDB buffer pool |
| **work_mem** | PostgreSQL config: RAM per sort/join operation (multiply by # connections for total impact) |
| **effective_cache_size** | PostgreSQL planner hint: estimate of OS page cache size available for caching |
| **Page Eviction** | When buffer pool is full: evict LRU page to make room for new page from disk |
