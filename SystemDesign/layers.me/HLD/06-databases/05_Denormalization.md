# T05 — Denormalization

---

## 1. ELI5

Imagine a library where each book's author information is stored in one place — an "Authors" file cabinet. Every time someone wants to know "who wrote Harry Potter?", the librarian walks to the Authors cabinet, finds J.K. Rowling's info, then walks back.

Now imagine 10,000 people asking this EVERY SECOND. The poor librarian is sprinting constantly.

Denormalization says: **just write the author's name on the book cover itself**. Yes, you store the same info in two places. Yes, if J.K. Rowling changes her name, you update it in many places. But now 10,000 reads happen instantly — no cabinet trips.

That's denormalization — trading **write complexity** for **read speed**.

---

## 2. Analogy

**Restaurant Menu vs Kitchen Clipboard**

**Normalized** (database normal form): The kitchen has one master clipboard with all ingredient prices. Every time a chef needs to calculate dish cost, they look up each ingredient on the clipboard. Accurate but slow.

**Denormalized**: The menu already has the calculated price printed: "Pasta Carbonara — $18". The price is derived from ingredient costs, but it's pre-printed so waiters can answer instantly. If ingredient costs change, someone must reprint the menu.

Denormalization = pre-computing and pre-storing answers to common questions.

---

## 3. Core Concept

### What is Normalization?

Normalization eliminates data redundancy by splitting data into separate related tables with no repeated information. It prioritizes **write correctness** — update one place, all references stay consistent.

```sql
-- Normalized schema (3NF):
CREATE TABLE users        (user_id, name, email);
CREATE TABLE orders       (order_id, user_id, product_id, amount, created_at);
CREATE TABLE products     (product_id, name, category, price);

-- To get order details: 3-table JOIN
SELECT u.name, p.name, o.amount
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN products p ON o.product_id = p.id
WHERE o.order_id = 12345;
-- ↑ Correct, but 3-table JOIN = expensive at scale
```

### What is Denormalization?

Intentionally introducing redundancy into tables to eliminate expensive JOINs on read paths.

```sql
-- Denormalized orders table:
CREATE TABLE orders (
  order_id      BIGINT,
  user_id       BIGINT,
  user_name     VARCHAR,    -- ← REDUNDANT: also in users table
  user_email    VARCHAR,    -- ← REDUNDANT
  product_id    BIGINT,
  product_name  VARCHAR,    -- ← REDUNDANT: also in products table
  product_price DECIMAL,    -- ← REDUNDANT
  amount        DECIMAL,
  created_at    TIMESTAMP
);

-- To get order details: single table read, NO JOIN
SELECT user_name, product_name, amount
FROM orders
WHERE order_id = 12345;
-- ↑ Single B-tree lookup = 1–3ms, regardless of user/product count
```

---

## 4. ASCII Architecture

### Normalized Read Path (with JOINs)

```
Request: "Show order details for order 12345"

┌────────────┐
│orders table│  order_id=12345, user_id=789, product_id=456
└─────┬──────┘
      │ JOIN users WHERE id = 789
      ▼
┌────────────┐
│ users table│  id=789, name="Alice", email="alice@co.com"
└─────┬──────┘
      │ JOIN products WHERE id = 456
      ▼
┌──────────────┐
│products table│  id=456, name="Laptop", price=999.99
└──────────────┘

Total: 3 B-tree index lookups (different tables, possibly different pages)
Buffer pool: 3 separate cache checks + potential disk reads
Latency: 5–30ms under load
```

### Denormalized Read Path

```
Request: "Show order details for order 12345"

┌────────────────────────────────────────────────────────────┐
│orders table (denormalized)                                  │
│order_id=12345 | user_name="Alice" | product_name="Laptop"  │
│user_email="alice@co.com" | amount=999.99 | created_at=...  │
└────────────────────────────────────────────────────────────┘

Total: 1 B-tree lookup
Latency: 1–3ms

Write cost: when user changes name → must UPDATE orders table too
```

### Materialized Views (DB-Managed Denormalization)

```
                Raw tables:
┌──────────┐   ┌──────────┐   ┌──────────┐
│  orders  │   │  users   │   │ products │
└────┬─────┘   └────┬─────┘   └────┬─────┘
     │              │              │
     └──────────────┼──────────────┘
                    │ DB computes JOIN once
                    ▼
          ┌─────────────────────┐
          │  order_details_mv   │  ← Materialized View
          │  (precomputed JOIN) │
          │  Refreshed by DB    │
          └─────────────────────┘
                    │
              Fast reads ✅
              
PostgreSQL: CREATE MATERIALIZED VIEW order_details AS SELECT ...;
Refresh:    REFRESH MATERIALIZED VIEW order_details;  (manual or scheduled)
PostgreSQL 9.4+: REFRESH MATERIALIZED VIEW CONCURRENTLY (no read lock)
```

---

## 5. Types of Denormalization

### 1. Stored (Computed) Columns

```sql
-- Instead of computing at read time:
SELECT item_price * quantity AS line_total FROM order_items;

-- Store computed result:
ALTER TABLE order_items ADD COLUMN line_total DECIMAL
  GENERATED ALWAYS AS (item_price * quantity) STORED;
-- DB auto-updates on every INSERT/UPDATE. Indexed for fast queries.
```

### 2. Duplicated Columns (Copy Frequently Accessed Foreign Data)

```sql
-- Post table stores author_name to avoid JOIN:
CREATE TABLE posts (
  post_id     BIGINT,
  author_id   BIGINT,
  author_name VARCHAR,   -- ← copied from users table
  title       VARCHAR,
  content     TEXT,
  created_at  TIMESTAMP
);
-- Tradeoff: if author changes username → must UPDATE all their posts
```

### 3. Pre-aggregated Totals

```sql
-- Instead of COUNT(*) at query time:
SELECT COUNT(*) FROM posts WHERE user_id = 123;  -- scans all posts

-- Store counter:
CREATE TABLE users (
  user_id     BIGINT,
  post_count  INT DEFAULT 0   -- ← pre-aggregated
);
-- On new post: UPDATE users SET post_count = post_count + 1 WHERE id = 123;
-- On delete:   UPDATE users SET post_count = post_count - 1 WHERE id = 123;
```

### 4. Pre-joined (Nested/Embedded) Documents (NoSQL)

```javascript
// MongoDB: embed comments in post to avoid $lookup
{
  _id: ObjectId("post123"),
  title: "Database Denormalization",
  author: {
    id: "user456",
    name: "Alice",         // ← embedded, no join needed
    avatar: "/alice.jpg"
  },
  // First 3 comments embedded; rest loaded via separate query
  commentPreview: [
    { user: "Bob", text: "Great post!", ts: "2024-01-15" },
    { user: "Carol", text: "Very helpful", ts: "2024-01-15" }
  ],
  commentCount: 47          // ← pre-aggregated
}
// Single document fetch = all data for rendering post card
```

---

## 6. Consistency Strategies

### Strategy 1: Synchronous Updates (Strong Consistency)

```javascript
// Update all copies in same transaction
async function updateProductPrice(productId, newPrice) {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    // Update source of truth
    await client.query('UPDATE products SET price = $1 WHERE id = $2',
                       [newPrice, productId]);
    // Update denormalized copies
    await client.query('UPDATE order_items SET product_price = $1 WHERE product_id = $2',
                       [newPrice, productId]);
    await client.query('UPDATE cart_items SET product_price = $1 WHERE product_id = $2',
                       [newPrice, productId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
// ✅ Perfect consistency
// ❌ Write latency multiplied by number of denormalized tables
// ❌ Tables are tightly coupled — adding a new denormalized table requires code change
```

### Strategy 2: Asynchronous via Queue (Eventual Consistency)

```
Product price updated in products table
     ↓
Emit: ProductPriceUpdated event → Kafka topic
     ↓
Consumer 1: order_items table → update price
Consumer 2: cart_items table → update price
Consumer 3: price_history table → append audit record
Consumer 4: search index → reindex product

Benefits:
  ✅ Write to products table returns immediately (no JOIN overhead)
  ✅ Adding new consumers (new denormalized tables) = no code change to writer
  ✅ If consumer fails → replay from Kafka
  
Cost:
  ❌ 50–500ms window where cart shows old price
  ❌ Kafka cluster required
  ❌ Consumer idempotency needed (process same event twice = same result)
```

---

## 7. When to Denormalize

### The Read:Write Ratio Rule

```
Read : Write ratio     Action
───────────────────    ──────────────────────────────────────────
1:1  to  10:1         Stay normalized (joins are fast enough)
10:1 to  100:1        Consider denormalization for hot paths
100:1 and above       Denormalize aggressively

Most read-heavy systems:
  Twitter timeline:     1,000:1 (1B reads, 1M writes/day)
  News feed:            500:1
  Product catalog read: 200:1
```

### Signals to Denormalize

```
❶ Query appears in top-10 slowest queries (EXPLAIN shows expensive JOIN)
❷ Table with 3+ JOINs queried >10K times/minute
❸ JOIN involves a table that never changes (reference data)
❹ Aggregation (COUNT, SUM) over entire table scanned repeatedly
❺ Real-time feed: precomputing is cheaper than compute-on-read
```

### Do NOT Denormalize When

```
✗ Business logic requires guaranteed consistency (payment amounts, inventory counts)
✗ Data changes very frequently (denormalization amplifies write cost)
✗ Small dataset (<1M rows) — JOINs are fast, premature optimization
✗ Read:write ratio is low (<10:1)
✗ Compliance requires single source of truth
```

---

## 8. Math & Formulas

### Write Amplification

$$\text{writes\_per\_update} = 1 + \text{number\_of\_denormalized\_copies}$$

If user updates their name and you have 5 denormalized tables copied the name:
$$\text{writes} = 1 + 5 = 6 \text{ writes per user name change}$$

### Read Speedup Estimate

$$\text{speedup} = \frac{\text{normalized\_latency}}{\text{denormalized\_latency}} = \frac{N \times \text{table\_lookup\_cost}}{\text{single\_lookup\_cost}}$$

3-table join at 10ms each = 30ms vs single lookup at 2ms = **15× faster**

### Storage Overhead

$$\text{storage\_overhead} = \sum_{\text{copied columns}} \text{column\_size} \times \text{row\_count}$$

Copying `user_name` (50 bytes avg) into `orders` table with 1B rows:
$$= 50 \text{ bytes} \times 10^9 = 50 \text{ GB extra storage}$$

---

## 9. MERN Stack Dev Notes

### MongoDB — Embed vs Reference

Always ask: "Will I always need this data together?"

```javascript
// EMBED (denormalize into same document) when:
// - Data is always read with the parent
// - Data doesn't change independently
// - Small array size (<100 items)

const postSchema = new Schema({
  title: String,
  author: {              // ← embedded (user rarely changes name)
    id: String,
    name: String,
    avatar: String,
  },
  tags: [String],       // ← embedded (always shown with post)
  recentComments: [{    // ← partial embed (only last 3 for preview)
    userId: String,
    text: String,
    createdAt: Date
  }],
  commentCount: Number  // ← pre-aggregated counter
});

// REFERENCE (normalize) when:
// - Data is large and changes frequently
// - Data is read independently
// - Data is shared across many documents (user profile)
const orderSchema = new Schema({
  userId: { type: ObjectId, ref: 'User' }, // ← reference, not embed
  items: [{ productId: ObjectId, qty: Number, price: Number }]
  // store price AT TIME OF ORDER (snapshot) — not reference to current price
});
```

### React/Next.js — Cache Denormalized Data

```javascript
// On the frontend, denormalize data before storing in state
// so components don't need to look up related data

// BAD: normalized store → components do lookups
const store = {
  users: { 'user1': { name: 'Alice' } },
  posts: { 'post1': { authorId: 'user1', title: 'Hello' } }
};
// Every post needs: store.users[post.authorId].name ← per-render lookup

// GOOD: denormalized data in API response
// Backend sends combined response:
const post = {
  id: 'post1',
  title: 'Hello',
  authorName: 'Alice',     // ← pre-joined
  authorAvatar: '/alice.jpg',
  commentCount: 47         // ← pre-aggregated
};
// Component renders instantly, no secondary lookup
```

### Express — Handling Denormalization In-Code

```javascript
// When user changes their name, update all denormalized references
app.put('/users/:userId/profile', async (req, res) => {
  const { userId } = req.params;
  const { name } = req.body;
  
  // Update source of truth
  await User.findByIdAndUpdate(userId, { name });
  
  // Fire-and-forget: update denormalized copies asynchronously
  // (eventual consistency — slight delay is acceptable)
  setImmediate(async () => {
    try {
      await Post.updateMany({ 'author.id': userId }, { 'author.name': name });
      await Comment.updateMany({ 'author.id': userId }, { 'author.name': name });
    } catch (err) {
      // Log and queue for retry — don't fail the main request
      logger.error('Denormalization update failed', { userId, err });
      await retryQueue.add({ type: 'UPDATE_USER_NAME', userId, name });
    }
  });
  
  res.json({ success: true }); // Return immediately
});
```

---

## 10. Real-World Case Studies

### Twitter — Fan-Out on Write (Denormalized Feed)

```
Problem: User opens Twitter timeline. Should see tweets from 1000 followed accounts.

Normalized approach (fan-in on read):
  SELECT tweets FROM users WHERE user_id IN (list of 1000 followed users)
  ORDER BY created_at DESC LIMIT 20
  → Cross-shard scatter-gather on 1000 user_ids → 500ms+ latency

Twitter's solution: Fan-out on WRITE (denormalized):
  When any user posts a tweet:
    1. Insert tweet into tweets table
    2. For EACH of their followers (up to 5M):
       INSERT INTO timeline_cache (follower_id, tweet_id) VALUES (...)
    
  When a user opens their timeline:
    SELECT tweet_id FROM timeline_cache WHERE follower_id = ? ORDER BY ts DESC LIMIT 20
    → Single shard lookup → <5ms
    
Cost: 1 tweet by user with 1M followers = 1M write operations (fan-out)
Exception: Celebrities (>1M followers) → fan-in on read (pre-compute would be too slow)
  When you open timeline: 95% from cache + 5% merged from celebrity feeds
```

### Netflix — Viewing History as Denormalized JSON Blob

```
Normalized would be:
  SELECT * FROM viewing_history WHERE user_id = ? ORDER BY watched_at DESC

At 230M users × avg 50 shows watched:
  11.5B rows in viewing_history table → JOINs with show metadata = untenable

Netflix solution: Cassandra + denormalized blob
  Row key: user_id
  Column: show_id
  Value: { 
    show_title: "Stranger Things",    ← denormalized from shows table
    episode_title: "The Vanishing",  ← denormalized  
    progress_pct: 67,
    last_watched: "2024-01-15T...",
    thumbnail_url: "/st-s4-thumb.jpg" ← denormalized
  }
  
Single Cassandra read returns all viewing history with full display data
No JOINs required — 1ms reads for 420TB of data
```

### Stripe — Invoice Denormalization

```
Invoice contains: customer name, address, line items with product names & prices

Normalized: invoice JOINs customer + line_items + products
Problem: customer might update address; product price changes over time

Stripe's approach: SNAPSHOT denormalization
  At invoice creation time → snapshot all data into invoice JSON
  Invoice permanently stores:
    customer_snapshot: { name, address, tax_id }  ← at billing time
    line_items: [{ product_name, unit_price, quantity }]  ← at billing time
    
  Even if customer changes address → old invoice retains original address
  This is CORRECT behavior for legal/accounting purposes
  
Lesson: For financial records, denormalized snapshots are the RIGHT model
        (audit trail, legal compliance)
```

---

## 11. Interview Cheat Sheet

**Q: What is denormalization and when would you use it?**
> Intentionally storing redundant data to eliminate expensive JOINs on read paths. Use when: read:write ratio >100:1, query latency is a bottleneck due to multi-table JOINs, data being duplicated changes infrequently relative to how often it's read. Trade-off: faster reads, slower/more complex writes.

**Q: How do you keep denormalized copies consistent?**
> Two approaches: (1) Synchronous — update all copies in one transaction; strong consistency but higher write latency and tight coupling. (2) Asynchronous via events/queues — update copies via event consumers; eventual consistency with milliseconds delay, but decoupled and scalable. Choose based on how stale data can tolerate being.

**Q: What's a materialized view and how does it relate to denormalization?**
> A materialized view is database-managed denormalization — the DB precomputes and stores a query result (including JOINs and aggregations). Unlike regular views (recomputed on each query), materialized views persist on disk and are refreshed periodically or on-demand. PostgreSQL supports `REFRESH MATERIALIZED VIEW CONCURRENTLY` for zero-downtime refreshes.

**Q: Twitter example — explain fan-out on write vs fan-in on read.**
> Fan-out on write: when someone tweets, pre-insert that tweet ID into every follower's timeline cache. Read is O(1) — just fetch from cache. Write is O(followers). Fan-in on read: at read time, query tweets from all followed accounts and merge. Read is O(following_count), write is O(1). Twitter uses fan-out for normal users (fast reads), fan-in for celebrities (too many followers to fan-out).

---

## 12. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Normalization** | Eliminating redundancy by splitting data into related tables |
| **Denormalization** | Intentionally adding redundancy to speed up reads |
| **Write Amplification** | One logical update requires writes to multiple physical tables |
| **Materialized View** | DB-managed precomputed query result stored on disk |
| **Fan-Out on Write** | Precomputing results for all consumers at write time |
| **Fan-In on Read** | Computing results from multiple sources at read time |
| **Snapshot Denormalization** | Storing a point-in-time copy of data (used in invoices) |
| **Pre-aggregation** | Storing computed counts/sums instead of computing at query time |
| **Embedded Document** | MongoDB pattern for denormalizing related data into same document |
| **Eventual Consistency** | Denormalized copies converge to truth via async updates |
| **Read:Write Ratio** | Key signal: >100:1 favors denormalization |
| **Computed Column** | DB-generated column that auto-computes a derived value |
