# T11 — Data Lakes and Warehouses

---

## 1. ELI5

Imagine two types of storage:

**Data Lake** = giant garage. You throw EVERYTHING in there — raw, unorganized: boxes, loose screws, holiday decorations from 2003, old paint cans, tax returns. It's cheap, holds anything, but finding something specific takes time.

**Data Warehouse** = organized filing cabinet system. Everything converted to the same format, labelled, indexed, organized by category. Finding anything is instant. But it only holds what someone carefully prepared and filed.

- **Lake**: store first, figure out what it means later
- **Warehouse**: define the structure first, then load the data

Most real companies have BOTH: pour raw data into the lake, refine important data into the warehouse.

---

## 2. Analogy

**Oil Refinery**

Crude oil (raw data) comes out of the ground and goes into **storage tanks** (data lake) — cheap, large, unrefined. Then a refinery (ETL/ELT pipeline) takes specific crude oil batches, processes them → gasoline, jet fuel, diesel (clean, queryable data) → goes into the **gas station storage** (data warehouse) where drivers (analysts, dashboards) can access exactly what they need, instantly.

You can't run a car on crude oil. You can't analyze raw logs directly. Both need refinement.

---

## 3. Core Concept

### OLTP vs OLAP

The fundamental distinction underlying all of this:

```
┌─────────────────────────────────────────────────────────────────────┐
│              OLTP vs OLAP Comparison                                │
├──────────────────────┬──────────────────────┬───────────────────────┤
│ Property             │ OLTP                 │ OLAP                  │
├──────────────────────┼──────────────────────┼───────────────────────┤
│ Purpose              │ Transactional ops    │ Analytical queries    │
│ Operation            │ INSERT/UPDATE/DELETE │ SELECT aggregations   │
│ Pattern              │ Many small, fast ops │ Few large, slow scans │
│ Row count per query  │ 1–100 rows           │ millions–billions     │
│ Storage layout       │ Row-oriented         │ Column-oriented       │
│ Index type           │ B-tree (lookup)      │ Min/max + bloom       │
│ Schema               │ Normalized (3NF)     │ Denormalized (star)   │
│ Examples             │ PostgreSQL, MySQL    │ Snowflake, BigQuery   │
│ Latency target       │ < 10ms               │ seconds–minutes       │
│ Concurrency          │ Thousands writers    │ Tens of analysts      │
└──────────────────────┴──────────────────────┴───────────────────────┘
```

### Row-Oriented vs Column-Oriented Storage

Why it matters for analytics:

```sql
-- OLAP query: What was total revenue per category last quarter?
SELECT category, SUM(revenue) FROM orders WHERE date > '2024-01-01' GROUP BY category;

Row-oriented (PostgreSQL):
  [user_id, date, category, revenue, status, shipping_addr, ...]  ← read ALL fields per row
  [user_id, date, category, revenue, status, shipping_addr, ...]
  → Must read 10 columns to get 2 (category, revenue)
  → 100M rows × 200 bytes = 20GB read for a query needing 10GB of actual data

Column-oriented (Snowflake):
  [revenue, revenue, revenue, revenue, ...]                        ← only revenue column
  [category, category, category, category, ...]                    ← only category column
  → Scan ONLY the 2 needed columns
  → 100M rows × 8 bytes (revenue float) = 800MB read
  → Plus: similar values compress 10x → 80MB compressed scan!
  
Result: Columnar = 20GB vs 80MB = 250× less I/O = much faster analytics
```

---

## 4. Data Lake Architecture

```
Sources (raw, diverse):
  Application logs    ──┐
  Click events        ──┤
  IoT sensor data     ──┤──► Object Storage (S3 / Azure Blob / GCS)
  CRM exports         ──┤     ├── /raw/logs/2024/01/15/*.gz
  Database replicas   ──┘     ├── /raw/events/clickstream/...
                              ├── /raw/iot/sensor-data/...
                              └── /raw/crm/customers.csv

Properties:
  ✅ Any format: JSON, CSV, Parquet, Avro, video, images
  ✅ Cost: $0.023/GB/month (S3 Standard 2024)
  ✅ No schema required at write time (schema-on-read)
  ✅ Unlimited retention
  
  ❌ No SQL directly on raw files (must use Spark/Presto/Athena)
  ❌ Query performance: whole-file scan by default
  ❌ Data quality: "garbage in" → inconsistent formats, missing fields
  ❌ "Data swamp" risk: pile without catalog → nobody can find anything
```

---

## 5. Data Warehouse Architecture

```
Data Warehouse (e.g., Snowflake, BigQuery, Redshift):

┌─────────────────────────────────────────────────────────────┐
│                    Data Warehouse                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               Columnar Storage                       │   │
│  │  fact_orders      fact_sessions    fact_events       │   │
│  │  dim_users        dim_products     dim_dates         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Auto-clustering  │  Micro-partitioning  │  Result cache   │
│  Query optimizer  │  SQL interface       │  BI connectors  │
└─────────────────────────────────────────────────────────────┘

Properties:
  ✅ SQL interface: analysts use familiar SQL
  ✅ Column-oriented storage: analytics 10–100× faster than row-oriented
  ✅ Automatic scaling (Snowflake virtual warehouses, BigQuery slots)
  ✅ Schema enforced: data quality guaranteed
  
  ❌ Cost: $23/TB/month Snowflake compute (vs $0.023/TB S3 storage)
  ❌ Limited flexibility: schema changes require migrations
  ❌ Not for raw/unstructured data
```

---

## 6. Star Schema vs Snowflake Schema

### Star Schema (Default Choice)

```
                    ┌──────────────────────┐
                    │     fact_orders       │
                    │  (central fact table) │
                    │  order_id FK          │
                    │  user_id FK ──────────┼──► dim_users
                    │  product_id FK ───────┼──► dim_products
                    │  date_id FK ──────────┼──► dim_dates
                    │  store_id FK ─────────┼──► dim_stores
                    │  revenue              │
                    │  quantity             │
                    └──────────────────────┘

Fact table: measures/metrics (revenue, quantity, clicks)
Dimension tables: descriptive attributes (who, what, when, where)
→ DENORMALIZED dimensions: all user attributes in one dim_users table
→ Single JOIN from fact → each dimension → simple, fast SQL

Example:
  SELECT p.category, SUM(o.revenue)
  FROM fact_orders o
  JOIN dim_products p ON o.product_id = p.product_id
  WHERE d.year = 2024
  GROUP BY p.category
  → 1 JOIN only → fast
```

### Snowflake Schema (Normalized Dimensions — Rare)

```
                    ┌──────────┐    ┌──────────┐
                    │dim_products│──►│dim_brands│
                    └────┬─────┘    └──────────┘
                         │
         ┌───────────────▼────────────┐
         │        fact_orders         │
         └───────────┬────────────────┘
                     │
              ┌──────▼──────┐    ┌──────────┐
              │  dim_dates  │──► │dim_months│
              └─────────────┘    └──────────┘

Dimensions further normalized (brand in separate table, months in separate table)
→ Multiple JOINs required: fact → dim_products → dim_brands
→ Slower queries, more complex SQL
→ Use ONLY when dimension data changes independently and frequently
→ Default: always use star schema
```

---

## 7. Medallion Architecture (Modern Data Lake)

```
The solution to "data swamp" — structured refinement layers:

BRONZE (Raw Layer)
  Location: s3://data/bronze/
  Format: Original format (JSON, CSV, logs as-is)
  Schema: None or inferred
  Purpose: Exact copy of source; audit/compliance; reprocess later
  Retention: Forever (cheap S3 Glacier)
  
  ↓ Spark/dbt ETL job

SILVER (Cleaned Layer)
  Location: s3://data/silver/
  Format: Parquet (columnar, compressed)
  Schema: Enforced; nulls handled; deduped; standardized types
  Transformations: JSON parsed → typed columns; outliers removed
  Purpose: Trusted intermediate; used by data scientists
  
  ↓ Aggregation jobs

GOLD (Business Layer)
  Location: s3://data/gold/ OR directly in Snowflake
  Format: Read-optimized tables/Parquet
  Schema: Business-aligned (revenue_by_day, user_cohorts, etc.)
  Purpose: Dashboards, executive reports, BI tools (Tableau, Looker)
  SLA: Data must be fresh within 1 hour of source
```

---

## 8. ETL vs ELT

```
ETL (Extract, Transform, Load) — Traditional approach:
  Extract: Pull data from source
  Transform: Clean/transform in separate compute (Spark cluster)
  Load: Insert cleaned data into warehouse
  
  Sources → [Spark Transform] → Warehouse
  
  Cost: Maintain separate Spark cluster ($$$)
  Latency: Batch jobs; hours of lag
  Use when: Source data is very dirty or needs ML preprocessing

ELT (Extract, Load, Transform) — Modern approach (warehouse is compute):
  Extract: Pull raw data from source
  Load:    Dump raw into warehouse (or data lake layer first)
  Transform: Use SQL within the warehouse (dbt)
  
  Sources → Raw layer → [SQL in Warehouse] → Clean tables
  
  Cost: Warehouse compute (pay per query)
  Latency: Near real-time with incremental dbt models
  Use when: Warehouse is powerful enough (BigQuery, Snowflake)
  
Modern stack: ELT + dbt + Snowflake/BigQuery
  Fivetran (extract/load) → Snowflake (raw tables) → dbt (transform with SQL) → Tableau
```

---

## 9. Math & Storage Cost Comparison

### Storage Costs (2024)

$$\text{S3 Standard} = \$0.023/\text{GB/month}$$
$$\text{S3 Glacier} = \$0.004/\text{GB/month (archive)}$$
$$\text{Snowflake storage} = \$23/\text{TB/month} = \$0.023/\text{GB/month}$$
$$\text{BigQuery storage} = \$0.02/\text{GB/month (active)}$$

**Compute comparison** (why data lakes are cheaper for storage but warehouses for queries):
```
100TB of logs:
  Store in S3:     100TB × $0.023 = $2,300/month storage
  Athena query:    $5/TB scanned → full scan = $500/query
  
Store in Snowflake:
  Storage:         100TB × $23 = $2,300/month (same storage cost!)  
  Query 100TB:     ~1TB effective scan (columnar compression 10x) → much cheaper/faster
  
Insight: For frequent analytics, warehouse is more cost-effective despite same storage price
         For rare access on huge datasets, S3 + Athena (pay-per-scan) is cheaper
```

### Columnar Compression Ratios

```
Data type         │ Compression  │ Typical ratio
──────────────────┼──────────────┼──────────────
Timestamps        │ Delta + RLE  │ 20:1
Enum/category     │ Dictionary   │ 100:1  
NULL-heavy cols   │ Sparse enc.  │ 50:1
Free text         │ LZ4/ZSTD     │ 3:1
Numbers (random)  │ ZSTD         │ 2:1
```

---

## 10. MERN Stack Dev Notes

### Node.js — Writing Events to Data Lake

```javascript
// Application writes events to S3 (data lake) via Kinesis Firehose
const AWS = require('@aws-sdk/client-firehose');
const firehose = new AWS.FirehoseClient({ region: 'us-east-1' });

async function trackEvent(userId, eventType, properties) {
  const event = {
    userId,
    eventType,
    properties,
    timestamp: new Date().toISOString(),
    sessionId: req.session.id,
    userAgent: req.headers['user-agent']
  };
  
  // Kinesis Firehose buffers → auto-writes to S3 as Parquet
  // Batches: 128MB or 5 minutes (configurable)
  await firehose.send(new AWS.PutRecordCommand({
    DeliveryStreamName: 'app-events-stream',
    Record: { Data: Buffer.from(JSON.stringify(event) + '\n') }
  }));
  // ← fire-and-forget; don't await in hot path (1ms impact)
}

// Usage in Express route
app.post('/products/:id/view', async (req, res) => {
  await Product.findById(req.params.id);
  
  // Non-blocking event tracking
  trackEvent(req.user.id, 'product_view', { productId: req.params.id })
    .catch(err => logger.warn('Event tracking failed', { err }));
  
  res.json({ success: true });
});
```

### React + Embedded Analytics (Query Warehouse)

```javascript
// Server-side: query Snowflake via REST API for dashboard
app.get('/api/analytics/revenue', async (req, res) => {
  const { startDate, endDate, groupBy } = req.query;
  
  // Use parameterized queries to prevent SQL injection
  const result = await snowflake.execute({
    sqlText: `
      SELECT 
        DATE_TRUNC(:groupBy, order_date) AS period,
        SUM(revenue) AS total_revenue,
        COUNT(DISTINCT customer_id) AS unique_customers
      FROM gold.fact_orders
      WHERE order_date BETWEEN :startDate AND :endDate
      GROUP BY 1
      ORDER BY 1
    `,
    binds: { groupBy, startDate, endDate }
  });
  
  // Cache expensive queries in Redis (analytics rarely need real-time)
  const cacheKey = `analytics:revenue:${startDate}:${endDate}:${groupBy}`;
  await redis.setex(cacheKey, 3600, JSON.stringify(result)); // 1 hour TTL
  
  res.json(result);
});
```

---

## 11. Real-World Case Studies

### Netflix — 500TB/day to S3

```
Scale: 230M subscribers, 100M+ streaming hours/day
Data: Playback quality events, A/B test results,
      recommendation training data, infrastructure metrics

Architecture:
  Collection: Apache Kafka → 500TB/day raw events
  Lake:       S3 (indefinite retention, organized by date/type)
  Processing: Apache Spark (petabyte-scale batch jobs)
  Models:     Spark ML trains recommendation models on full history
  Warehouse:  Internal columnar store → Tableau dashboards for executives
  
Retention tiering:
  S3 Standard: 90 days (recent events, frequent analysis)
  S3 Glacier:  7+ years (compliance, model retraining)
  Warehouse:   90 days (curated business metrics only)
  
Tooling: Apache Iceberg (table format on S3 — enables ACID on data lake)
  → Analysts query S3 data with SQL as if it's a table
  → Time-travel: audit queries against data as it was 30 days ago
```

### Amazon — Star Schema at Petabyte Scale

```
Amazon Redshift powers internal Amazon analytics:
  fact_orders: order_id, customer_id, product_id, date_id, seller_id, revenue
  dim_products: product_id, name, category, brand, weight, dimensions
  dim_customers: customer_id, cohort_date, country, prime_status
  dim_dates: date_id, year, quarter, month, day, is_holiday

Scale: petabytes; 50+ column product dimension table
Distribution key: order_id or customer_id (depends on most common join)
Sort key: date_id (most queries filter by date range)

Performance tricks:
  - Materialized views for common aggregations (refresh nightly)
  - Query result caching (identical query → <1ms from cache)
  - Concurrency scaling (auto-add capacity during analyst rush hours)
  
Key pattern: star schema + sort key on date_id
  → Analytics team's most common query: "this week's revenue vs last week"
  → Date filter hits sort key → skip old partitions → fast
```

### Uber — ELT with dbt

```
Uber's analytics stack:
  Sources: MySQL (trips), Cassandra (driver history), Kafka (real-time events)
  Load: Fivetran + custom connectors → Presto (Hive metastore on S3)
  Transform: dbt SQL models → clean tables in Presto
  Serve: Presto/Spark → Apache Superset (Uber's internal BI)

dbt model example (in Uber's warehouse):
  -- models/silver/trips_cleaned.sql
  SELECT
    trip_id,
    COALESCE(rider_id, 'unknown') AS rider_id,
    driver_id,
    TIMESTAMP_TRUNC(started_at, HOUR) AS trip_hour,
    distance_miles,
    fare_usd,
    city_id
  FROM raw.trips
  WHERE started_at >= '2022-01-01'     -- partition filter
    AND fare_usd > 0                   -- exclude test/cancelled
  -- dbt incremental: only processes new rows each run
  {% if is_incremental() %}
  AND started_at > (SELECT MAX(trip_hour) FROM {{ this }})
  {% endif %}

Cadence: dbt runs every 15 min for key business metrics
         Full refresh for historical models: nightly
```

---

## 12. Interview Cheat Sheet

**Q: What's the difference between a data lake and a data warehouse?**
> Data lake: raw, any-format data in cheap object storage (S3); schema-on-read; flexible but unstructured; good for ML training data and long-term archive. Data warehouse: cleaned, structured, columnar data with SQL interface; schema-on-write; fast analytics via column-oriented storage; expensive compute but fast query. Modern architectures combine both: lake for raw storage, warehouse for curated analytics.

**Q: Why is columnar storage better for analytics?**
> OLAP queries typically access 2–5 columns out of 50 in a table. Row-oriented storage reads all columns for every row (wasted I/O). Columnar storage reads only the queried columns. Plus: values in the same column have similar types → compression ratios of 10–100× (RLE for categories, delta for timestamps). Result: 10–100× less I/O for typical analytics queries.

**Q: What is the Medallion Architecture?**
> Three-layer data lake pattern: Bronze (raw, as-is), Silver (cleaned, typed, deduplicated), Gold (business-aggregated, ready for BI dashboards). Enables: clear data quality progression, data reprocessing from bronze on bugs, separation of concerns between data engineers (silver) and analysts (gold).

**Q: What is dbt and where does it fit?**
> Data Build Tool — a SQL-based transformation framework for ELT pipelines. Analysts write SQL models that transform data within the warehouse/lake. Features: incremental materialization (only processes new rows), data lineage visualization, testing (not-null, unique, custom assertions), version control for analytics code. Used after data is loaded into the warehouse.

**Q: Star schema vs snowflake schema — which to use?**
> Default: star schema. Dimension tables are denormalized into one flat table per dimension. Single JOIN from fact to each dimension → simple, fast SQL. Snowflake schema normalizes dimension tables further (brand in separate table, months split out). Use only when dimension sub-tables change independently (e.g., product categories are managed separately from products). Complexity cost usually outweighs the storage savings.

---

## 13. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **OLTP** | Online Transaction Processing — fast, many small operations; PostgreSQL |
| **OLAP** | Online Analytical Processing — slow, few large aggregations; Snowflake |
| **Data Lake** | Raw data in cheap object storage (S3); schema-on-read |
| **Data Warehouse** | Structured, columnar analytics DB; schema-on-write; SQL |
| **Columnar Storage** | Data stored column-by-column; only needed columns read for queries |
| **Star Schema** | Fact table + denormalized dimension tables; single JOINs |
| **Snowflake Schema** | Normalized dimensions; multiple JOINs; rarely preferred |
| **Fact Table** | Central table with metrics/measures (revenue, clicks, quantity) |
| **Dimension Table** | Descriptive attributes (user, product, date, location) |
| **ETL** | Extract, Transform, Load — transform before loading warehouse |
| **ELT** | Extract, Load, Transform — load raw first, transform in warehouse via SQL |
| **dbt** | Data Build Tool — SQL-based ELT transformation framework |
| **Medallion Architecture** | Bronze → Silver → Gold data refinement layers |
| **Data Swamp** | Data lake without catalog/governance — unusable mess |
| **Parquet** | Columnar file format; default for data lakes; 10× compression |
| **Iceberg** | Table format enabling ACID, time-travel, schema evolution on S3 |
