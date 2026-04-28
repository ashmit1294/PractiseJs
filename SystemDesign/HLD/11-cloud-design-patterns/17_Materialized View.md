# T17 — Materialized View Pattern: Pre-computed Query Results

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/materialized-view

---

## ELI5 (Explain Like I'm 5)

You have a homework assignment: total up all the purchases in a 1,000-page receipt book, then tell your teacher the daily totals. Option A: every time the teacher asks, you add up all 1,000 pages from scratch. Option B: you calculate all the totals once and write them on a single summary sheet. Next time the teacher asks, you just read the summary sheet (1 second).

Materialized views are that summary sheet — pre-computed answers stored so you don't recalculate them on every request.

---

## Analogy

**A newspaper's "Top Stories" section**: A newspaper doesn't figure out which stories are most popular each time someone reads it. Editors curate the top stories once and print them prominently. The printing is the expensive pre-computation step. Millions of readers see the pre-computed result instantly. If a big story breaks, they print a new edition (refresh the view). Most readers see a slightly stale view, which is fine.

---

## Core Concept

Materialized views are **pre-computed, physically stored query results** that trade storage and update complexity for dramatically faster reads.

**The fundamental problem**: Normalized databases give write integrity, but make reads slow. A single analytics dashboard query — "show daily active users by region" — might JOIN `events (1B rows) + users (10M rows) + regions (1K rows)` and aggregate by day. This query takes 5–30 seconds on raw tables. Your SLA demands < 100ms.

**The solution**: Pre-compute this JOIN + aggregation during quiet periods. Store the result in `daily_active_users_by_region`. Your dashboard queries this pre-built table in 50ms. The expensive computation runs once (or on a schedule), not on every dashboard load.

---

## ASCII Diagrams

### Normalized Query vs Materialized View

```
NORMALIZED QUERY (5-30 seconds):
  SELECT region, date, COUNT(DISTINCT user_id) as dau
  FROM events e
  JOIN users u ON e.user_id = u.id
  JOIN regions r ON u.region_id = r.id
  WHERE date >= '2024-01-01'
  GROUP BY region, date
  
  → Scans 1B events rows
  → JOINs 10M users rows
  → Aggregates by day + region
  → Returns result after 30 seconds ❌

MATERIALIZED VIEW QUERY (50-100ms):
  SELECT * FROM daily_active_users_by_region
  WHERE date = '2024-01-15' AND region = 'US'
  
  → Hits pre-computed table (indexed by date + region)
  → Returns result in 50ms ✅
  → Pre-computation ran once at 2am during quiet period
```

### Materialized View Lifecycle

```
PHASE 1: DEFINE
  CREATE MATERIALIZED VIEW daily_active_users_by_region AS
    SELECT region, date, COUNT(DISTINCT user_id) as dau
    FROM events e JOIN users u JOIN regions r
    GROUP BY region, date;

PHASE 2: INITIAL MATERIALIZATION (one-time bulk compute, may take hours)
  Run source query → store results in physical table

PHASE 3: REFRESH (keeps view synchronized with source data)
  
  Full Refresh         Incremental Refresh        Streaming Refresh
  (simple, expensive)  (complex, efficient)       (real-time, most complex)
  
  Recompute ALL rows   Track changes since last    Process each event as
  on schedule (daily)  refresh (CDC); update       it arrives (Kafka/Flink)
  Cost: O(source size) only affected rows          Lag: seconds
  Lag: up to 24 hours  Cost: O(changed rows)       Cost: highest infra overhead

PHASE 4: SERVE
  App queries materialized view directly — no joins, no aggregations
  Pre-aggregated → fast (50-100ms vs 30s)
```

### Write Amplification — Multiple Views from One Source

```
Source: UPDATE users SET last_login = NOW() WHERE user_id = 123
  │
  ├─ Update: daily_active_users_by_region   ← view 1
  ├─ Update: user_engagement_scores         ← view 2
  ├─ Update: login_frequency_by_region      ← view 3
  ├─ Update: user_retention_cohorts         ← view 4
  └─ Update: recommendation_signals        ← view 5 (more)
  
1 source write → N view updates
At 10K user updates/sec × 10 views = 100K view updates/sec
ACCEPTABLE if read/write ratio > 100:1 (each view read 1000x/sec)
NOT ACCEPTABLE if write-heavy workload
```

---

## How It Works (Step by Step)

1. **Define the view query**: Identify slow, frequently-run queries. Write the materialized query (JOIN + aggregation).

2. **Initial bulk materialization**: Execute the full query against source tables. Store results in new physical table. May take hours for large datasets — run during off-peak.

3. **Establish refresh strategy**: Choose based on staleness tolerance:
   - **Full refresh** (daily cron job): Simple; recomputes all rows. Good for weekly/daily analytics.
   - **Incremental refresh** (CDC-based): Track which rows changed, update only those. Good for hourly metrics.
   - **Streaming refresh** (Kafka + Flink): Update in real-time as events flow. Good for near-live dashboards.

4. **Applications query the view**: Direct SELECT on the pre-computed table. No joins. Sub-100ms response.

5. **Monitor refresh health**: Track last successful refresh timestamp. Alert when staleness exceeds SLA. Keep metadata table with refresh audit log.

---

## Variants

| Variant | Implementation | Best For |
|---------|---------------|---------|
| **Database-Native** | PostgreSQL `CREATE MATERIALIZED VIEW ... REFRESH MATERIALIZED VIEW` | Single DB, simple setup, moderate scale |
| **Application-Managed** | Custom table populated by your app's refresh job | Full control, multi-source joins, scales beyond single DB (Airbnb Riverbed) |
| **Stream-Processed** | Kafka + Flink maintains view in near-real-time | Sub-minute freshness; real-time dashboards (LinkedIn feed scores) |

---

## Trade-offs

| Dimension | Materialized Views | Raw Table Queries |
|-----------|------------------|--------------------|
| **Read performance** | Excellent: 50-100ms on pre-aggregated data | Poor: 5-30s on 1B-row joins |
| **Data freshness** | Eventual (minutes to hours behind) | Always current |
| **Storage** | High: pre-aggregated data + original tables | Minimal |
| **Write load** | Write amplification (N views × write rate) | Only write to source tables |
| **Complexity** | High (refresh scheduling, failure handling) | Low |

**Freshness vs complexity decision**:
- Daily analytics (24h acceptable lag): full refresh with cron job. Simple.
- Hourly dashboards (5-min acceptable lag): incremental refresh via CDC. Moderate complexity.
- Real-time feeds (seconds acceptable lag): streaming refresh via Kafka. High complexity.

**Cost**: At Airbnb scale, Riverbed processes 2.4B events/day maintaining materialized views for search ranking and pricing. The storage cost pays for itself many times over by eliminating 30-second queries from user-facing paths.

---

## When to Use (and When Not To)

**Use when:**
- Queries frequently run against large datasets with complex joins/aggregations
- Read:write ratio > 100:1 — views are read thousands of times yet only refreshed hourly
- Consistent, predictable query patterns — dashboards, recommendation scores, search rankings
- Some staleness is acceptable (analytics, recommendations, search)

**Avoid when:**
- Strong consistency required: financial transactions, inventory management — stale data unacceptable
- Query patterns are dynamic and unpredictable (ad-hoc analytics → use data warehouse instead)
- Storage costs dominate (materialized views can use more storage than source tables at extreme scale)
- Write rate is so high that view maintenance consumes more resources than it saves

**Rule of thumb**: if a query takes > 500ms AND runs > 10 times/minute, it's a materialized view candidate.

---

## MERN Developer Notes

```javascript
// PostgreSQL database-native example
// Materialized view for daily active users per region

// DEFINE (run once to create the view)
const createView = `
  CREATE MATERIALIZED VIEW daily_active_users_by_region AS
    SELECT
      r.region_name,
      DATE(e.timestamp) AS event_date,
      COUNT(DISTINCT e.user_id) AS dau
    FROM events e
    JOIN users u ON e.user_id = u.id
    JOIN regions r ON u.region_id = r.id
    WHERE e.timestamp >= NOW() - INTERVAL '90 days'
    GROUP BY r.region_name, DATE(e.timestamp)
    ORDER BY event_date DESC, dau DESC;

  CREATE UNIQUE INDEX ON daily_active_users_by_region(region_name, event_date);
`;

// REFRESH (run on schedule — nightly cron or hourly)
// CONCURRENTLY: users can still read the old view while refresh runs
const refreshView = `REFRESH MATERIALIZED VIEW CONCURRENTLY daily_active_users_by_region;`;

// QUERY (fast — pre-computed)
const queryView = `
  SELECT region_name, event_date, dau
  FROM daily_active_users_by_region
  WHERE event_date = CURRENT_DATE - 1
  ORDER BY dau DESC
  LIMIT 20;
`;

// Application-managed view (Node.js)
const refreshScheduler = require('node-cron');
const db = require('./db');
const redis = require('./redis');

// Track refresh metadata
async function refreshMaterializedView() {
  const startTime = Date.now();
  try {
    // Incremental: only process rows changed since last refresh
    const lastRefresh = await redis.get('view:dau:last_refresh') || '2024-01-01';
    
    await db.query(`
      INSERT INTO daily_active_users_by_region (region_name, event_date, dau)
      SELECT r.region_name, DATE(e.timestamp) AS event_date, COUNT(DISTINCT e.user_id) AS dau
      FROM events e
      JOIN users u ON e.user_id = u.id
      JOIN regions r ON u.region_id = r.id
      WHERE e.timestamp > $1
      GROUP BY r.region_name, DATE(e.timestamp)
      ON CONFLICT (region_name, event_date) DO UPDATE SET dau = EXCLUDED.dau
    `, [lastRefresh]);
    
    await redis.set('view:dau:last_refresh', new Date().toISOString());
    await redis.set('view:dau:last_refresh_ms', Date.now() - startTime);
    console.log(`View refreshed in ${Date.now() - startTime}ms`);
    
  } catch (err) {
    console.error('View refresh failed:', err.message);
    // Alert monitoring — staleness may exceed SLA
  }
}

// Run every 5 minutes
refreshScheduler.schedule('*/5 * * * *', refreshMaterializedView);

// QUERY the pre-computed view
async function getDashboardStats(region, date) {
  const result = await db.query(
    'SELECT dau FROM daily_active_users_by_region WHERE region_name=$1 AND event_date=$2',
    [region, date]
  );
  return result.rows[0]?.dau || 0;
}
```

---

## Real-World Examples

| Company | View | How It's Refreshed | Key Detail |
|---------|------|-------------------|-----------|
| **Airbnb (Riverbed)** | Search ranking scores, dynamic pricing views | Incremental micro-batch: processes Kafka events in batches, updates only affected rows | 2.4B events/day → maintains multiple views at different granularities (hourly, daily, weekly). Recomputing weekly aggregations from raw events would be cost-prohibitive |
| **Netflix** | Per-user viewing history (Continue Watching row) | Streaming: events flow through Kafka → update per-user view in seconds | Views partitioned by `user_id`; time-based expiration auto-drops data older than 90 days keeping views bounded even as raw events grow indefinitely |
| **Stripe** | Revenue analytics (monthly recurring revenue, customer LTV, payment success rates) | Incremental: background job triggered by payment events updates related views | Maintain both current and previous version during refresh → zero-downtime reads during refresh. Queries that took 30s on raw JOIN tables complete in < 100ms |

---

## Interview Cheat Sheet

### Q: What's the difference between a materialized view and a cache?
**A:** A cache is an application-layer construct managed imperatively (you set/invalidate cache entries). A materialized view is a data-layer construct — a physical DB table managed with declarative refresh logic. Views typically have stronger consistency guarantees (managed by infrastructure), while caches rely on application code for invalidation. Caches store individual objects; views store pre-computed queries (aggregations, JOINs). You can query a view with SQL; you can't query a cache like a table.

### Q: How do you handle a materialized view refresh that takes 6 hours but needs to run hourly?
**A:** Switch from full refresh to incremental refresh. Use CDC (Change Data Capture) to track which rows changed since the last successful refresh timestamp. Only recompute affected partitions/rows. Also partition the view by date — refresh only today's partition, not 90 days of history. At extreme scale, use streaming refresh (Kafka + Flink) to maintain the view continuously with second-level latency instead of batch refresh entirely.

### Q: What happens if a refresh fails?
**A:** The view becomes stale. Mitigation: (1) Log failures immediately, (2) Track staleness in a metadata table — alert when staleness exceeds SLA (e.g., "view is >30 minutes behind"), (3) Fallback strategy: if staleness is critical, fall back to querying source tables directly (slower but correct), (4) Implement idempotent refresh logic so retries don't cause double-write issues.

---

## Red Flags to Avoid

- Claiming materialized views are always faster without discussing refresh costs and write amplification
- Not discussing staleness tolerance — every view needs an explicit freshness SLA
- Proposing full refresh for large datasets without mentioning incremental alternatives
- Ignoring storage costs — at scale, views can consume more storage than source tables
- Not discussing monitoring: refresh latency, staleness, failure rate must all be tracked in production

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Materialized View** | Pre-computed query result stored as physical table; queried like a regular table |
| **Full Refresh** | Recompute all rows from scratch; simple but expensive for large datasets |
| **Incremental Refresh** | Update only changed rows since last refresh; requires change tracking |
| **Streaming Refresh** | Near-real-time view maintenance via stream processing (Kafka + Flink) |
| **Write Amplification** | One source write triggers N view updates; multiplies write load |
| **Staleness** | How far behind the view is from source data; measured in minutes, hours |
| **CDC (Change Data Capture)** | Track row-level changes in source DB; used for incremental refresh |
| **View Partition** | Sub-section of view by date/region; allows partial refresh without full recomputation |
| **RocksDB** | Embedded key-value store used by Flink for stateful stream processing of view aggregations |
| **Refresh Idempotency** | Refresh can run multiple times safely without double-counting or corrupting results |
| **Query Rewriting** | DB automatically routes base-table queries to materialized view when possible (DB-native views) |
| **DAG-based Refresh** | When views depend on other views, topological sort determines refresh order |
