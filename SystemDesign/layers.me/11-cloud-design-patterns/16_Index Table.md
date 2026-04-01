# T16 — Index Table Pattern: Secondary Index in NoSQL

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/index-table

---

## ELI5 (Explain Like I'm 5)

Imagine your school has a giant list of all students, sorted by student ID number. If a teacher wants to find a student named "Alice", she'd have to read every single name until she found it — that takes forever. 

An index table is like having a **separate alphabetical list of names** that says "Alice → ID 123". The teacher looks up Alice in the alphabetical list (1 second), gets the ID, then finds the full record by ID (1 second). Two quick looks instead of reading 2 billion names.

---

## Analogy

**A book's index**: The book's content (main table) is organized by chapters. But the index in the back maps topics → page numbers. Instead of reading the whole book to find "photosynthesis", you look it up in the index (O(1)), get the page number, and flip directly there. Index tables are that back-of-book index, but for your database.

---

## Core Concept

Most databases optimize for **primary key** lookups. The Index Table pattern creates separate tables that map **non-primary-key attributes → primary keys**, enabling fast lookups without table scans.

**The canonical problem**: Instagram has 2 billion users stored with `user_id` as primary key. Users log in with *email*. Without an index table: scan 2 billion rows for the email. With an index table `users_by_email(email → user_id)`: O(1) lookup in 1–2ms.

**The trade-off**: Pay 2x writes and 2x storage to get O(1) reads instead of O(n) scans. For read:write ratios > 10:1, this trade-off is almost always worth it.

---

## ASCII Diagrams

### Full Table Scan vs Index Table Lookup

```
WITHOUT INDEX TABLE (30 minutes):
  Login: email='alice@example.com'
  → Scan users table (2 BILLION rows)
  → check row 1: not a match
  → check row 2: not a match
  → ...
  → check row 1,500,000,000: MATCH! user_id=123
  → Total: ~30 minutes ❌

WITH INDEX TABLE (2-5ms):
  Login: email='alice@example.com'
  → Query users_by_email WHERE email='alice@example.com' → user_id=123  (1-2ms)
  → Query users WHERE user_id=123 → full profile                         (1-2ms)
  → Total: 2-5ms ✅
```

### Write Flow — 4-Table Write on Registration

```
POST /register { username: 'alice', email: 'alice@ex.com', phone: '+1234' }
  │
  ├─ INSERT users (user_id=123, username, email, phone, ...)     ← main table
  ├─ INSERT users_by_username ('alice' → 123)                   ← index table 1
  ├─ INSERT users_by_email ('alice@ex.com' → 123)               ← index table 2
  └─ INSERT users_by_phone ('+1234' → 123)                      ← index table 3

Write amplification: 1 logical write → 4 physical writes
Latency: 5ms → 15-20ms (atomic write across all 4)

Index tables are cheap rows: ~100 bytes each × 2B users × 3 indexes = 600GB
Source of truth: main users table only
```

### Index Table Variants

```
Simple Index:
  users_by_email: (email → user_id)
  One-to-one. Common for unique attributes.

Composite Index:
  users_by_country_date: ((country, signup_date) → user_id)
  Enables range queries: "all US users who signed up in January 2024"

Denormalized Index:
  users_by_email: (email → {user_id, username, profile_pic_url})
  Single hop! No need to query main table at all.
  Cost: must update index when any denormalized field changes.

Inverted Index:
  posts_by_hashtag: (hashtag → [post_id_1, post_id_2, ...])
  Many-to-many. Essential for tags, categories, full-text features.
```

---

## How It Works (Step by Step)

1. **Design index tables**: Identify query patterns. For each non-primary-key attribute you need to search by, create a lookup table: `search_attribute → primary_key`.

2. **Write to all tables atomically**: On every insert/update, write to the main table AND all relevant index tables. DynamoDB: wrap in a transaction. Cassandra: use batch write.

3. **Two-hop read**: Query `users_by_email` with email → get `user_id` → query `users` with `user_id` → return full record. 2–5ms total.

4. **Handle attribute updates**: If a user changes their email: (1) DELETE old email from `users_by_email`, (2) UPDATE main table, (3) INSERT new email into `users_by_email`. Three writes per email change.

5. **Handle partial failures**: If main table write succeeds but index write fails, index is stale. Run nightly reconciliation jobs (Netflix approach) to rebuild indexes from source of truth.

---

## Variants

| Variant | Structure | Use When |
|---------|-----------|---------|
| **Simple Index** | `(attr → primary_key)` | Login by email/phone; any unique attribute lookup |
| **Composite Index** | `((attr1, attr2) → primary_key)` | Range queries on multiple filtered dimensions |
| **Denormalized Index** | `(attr → {primary_key, field1, field2})` | Eliminate second lookup hop when main table load is high |
| **Inverted Index** | `(attr → [primary_key_1, primary_key_2, ...])` | Tags, hashtags, categories — one attribute maps to many records |
| **Partial Index** | Index only records matching criteria | 80/20 rule: most queries target active users/recent orders |

---

## Trade-offs

| Dimension | Index Tables | No Index Tables |
|-----------|-------------|-----------------|
| **Read latency** | O(1): 2–5ms | O(n): minutes on large tables |
| **Write latency** | Higher: 5ms → 15ms (4 writes) | Lower: 1 write |
| **Storage** | 2x+ (duplicate key data) | 1x |
| **Consistency** | Eventual (unless transactional) | N/A |
| **Operational overhead** | Reconciliation jobs, monitoring | Minimal |

**Write amplification math**: 5 index tables → 1 logical write = 6 physical writes. At 10K writes/sec → 60K physical writes/sec. Still viable if read/write ratio > 10:1 (common in CRUD apps).

---

## When to Use (and When Not To)

**Use when:**
- Database lacks native secondary indexes (DynamoDB, Cassandra, HBase) and you need non-primary-key queries
- Read:write ratio > 10:1 — query latency is the bottleneck
- You need custom consistency models (synchronous for auth, eventually consistent for search)
- Query patterns are stable and predictable (you know which attributes to index)

**Avoid when:**
- Database has efficient built-in secondary indexes (PostgreSQL, MySQL) — use those first
- Write volume is extremely high (logging, metrics) — write amplification kills performance
- Query patterns are unpredictable (ad-hoc analytics) — index tables won't match unknown query patterns
- Data changes frequently — index maintenance overhead may exceed read benefit

**Anti-pattern**: Creating index tables for every attribute "just in case." Over-indexing slows every write. Add indexes only when measurements prove query performance is insufficient.

---

## MERN Developer Notes

```javascript
// Index Table pattern with DynamoDB (Node.js AWS SDK v3)
const { DynamoDBClient, TransactWriteItemsCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });

// WRITE: Register user — atomic write to main + index tables
async function registerUser({ userId, username, email, phone }) {
  // All 4 writes in one DynamoDB transaction (all or nothing)
  const command = new TransactWriteItemsCommand({
    TransactItems: [
      // 1. Main table
      {
        Put: {
          TableName: 'users',
          Item: marshall({ userId, username, email, phone, createdAt: Date.now() }),
          ConditionExpression: 'attribute_not_exists(userId)' // prevent overwrites
        }
      },
      // 2. Username index
      {
        Put: {
          TableName: 'users_by_username',
          Item: marshall({ username, userId }),
          ConditionExpression: 'attribute_not_exists(username)' // enforce uniqueness
        }
      },
      // 3. Email index
      {
        Put: {
          TableName: 'users_by_email',
          Item: marshall({ email, userId }),
          ConditionExpression: 'attribute_not_exists(email)'
        }
      },
      // 4. Phone index
      {
        Put: {
          TableName: 'users_by_phone',
          Item: marshall({ phone, userId }),
          ConditionExpression: 'attribute_not_exists(phone)'
        }
      }
    ]
  });
  
  await client.send(command);
  return { userId };
}

// READ: Two-hop lookup — email → userId → full profile
async function getUserByEmail(email) {
  // Hop 1: index table lookup (1-2ms)
  const indexResult = await client.send(new QueryCommand({
    TableName: 'users_by_email',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: marshall({ ':email': email })
  }));
  
  if (!indexResult.Items?.length) return null;
  const { userId } = unmarshall(indexResult.Items[0]);
  
  // Hop 2: main table fetch (1-2ms)
  const userResult = await client.send(new QueryCommand({
    TableName: 'users',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: marshall({ ':userId': userId })
  }));
  
  return userResult.Items?.length ? unmarshall(userResult.Items[0]) : null;
}

// UPDATE: Change email — delete old index entry, insert new
async function updateEmail(userId, oldEmail, newEmail) {
  await client.send(new TransactWriteItemsCommand({
    TransactItems: [
      // Delete old index entry
      { Delete: { TableName: 'users_by_email', Key: marshall({ email: oldEmail }) } },
      // Insert new index entry
      {
        Put: {
          TableName: 'users_by_email',
          Item: marshall({ email: newEmail, userId }),
          ConditionExpression: 'attribute_not_exists(email)' // new email must not be taken
        }
      },
      // Update main table
      {
        Update: {
          TableName: 'users',
          Key: marshall({ userId }),
          UpdateExpression: 'SET email = :newEmail',
          ExpressionAttributeValues: marshall({ ':newEmail': newEmail })
        }
      }
    ]
  }));
}

// RECONCILIATION: Nightly job to verify index consistency
async function reconcileEmailIndex(batchOfUsers) {
  for (const user of batchOfUsers) {
    const indexed = await getUserByEmail(user.email);
    if (!indexed || indexed.userId !== user.userId) {
      console.error(`Index stale for user ${user.userId}, email ${user.email} — rebuilding`);
      // Re-insert index entry
      await client.send(new TransactWriteItemsCommand({
        TransactItems: [{
          Put: { TableName: 'users_by_email', Item: marshall({ email: user.email, userId: user.userId }) }
        }]
      }));
    }
  }
}
```

---

## Real-World Examples

| Company | Index Table | Key Detail |
|---------|------------|-----------|
| **Instagram** | `users_by_username`, `users_by_email`, `users_by_phone` | Username changes use **two-phase commit**: reserve new username atomically (prevents collision), update main table, then 14-day redirect from old username before releasing it |
| **Uber** | `drivers_by_geohash((lat, lng, geohash) → driver_id)` | Driver location updates every 4 seconds → billions of index writes/day. Uses **eventual consistency** (4-second staleness acceptable). Batches index updates; uses Bloom filters to reduce write amplification |
| **Netflix** | `content_by_genre((genre, year, rating) → content_id)` | **Rebuilds indexes nightly** from source of truth rather than maintaining transactionally. Eventual consistency (up to 24h stale) acceptable for content metadata. Nightly rebuilds also auto-heal index drift |

---

## Interview Cheat Sheet

### Q: How is the Index Table pattern different from a database secondary index?
**A:** A database secondary index is maintained automatically by the DB engine synchronously on every write. An index table is an explicit table you write to manually, giving you control over the consistency model (synchronous vs async), the storage format, and the refresh strategy. Use database secondary indexes when available and sufficient. Use index tables when your database doesn't support them (DynamoDB, Cassandra), or when you need custom consistency models (synchronous for uniqueness-critical lookups, async for eventually-consistent search).

### Q: What happens if the main table write succeeds but the index write fails?
**A:** The index is stale — it no longer reflects the main table state. Three mitigation strategies: (1) Transactions if the DB supports them (DynamoDB TransactWriteItems), (2) Idempotent writes with retry logic for eventual consistency cases, (3) Periodic reconciliation jobs that scan the main table and rebuild any stale index entries (Netflix does this nightly). Also log write failures so failures don't silently persist.

### Q: How do you handle a hot partition in an index table?
**A:** Hot partitions occur when many records share the same index key (e.g., thousands of users with country='US'). Solutions: (1) Composite index (country + signup_date) to spread load, (2) Random suffix sharding: write to `hashtag:trending:0` through `hashtag:trending:9` and read from all shards + merge, (3) Caching: cache the hot index value in Redis to avoid hitting the DB repeatedly.

---

## Red Flags to Avoid

- "Just add an index" without discussing write amplification or storage costs
- Not considering partial write failure scenarios — interviewers always ask this
- Proposing synchronous updates for all indexes without discussing latency impact
- Creating indexes for every attribute without analyzing actual query patterns
- Not mentioning reconciliation or consistency verification strategies for eventually-consistent indexes

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Index Table** | Separate table mapping a non-primary-key attribute to the primary key |
| **Two-Hop Lookup** | Query index table for primary key, then query main table with that key |
| **Write Amplification** | Ratio of physical writes to logical writes; 5 indexes = 6 physical writes per logical write |
| **Full Table Scan** | O(n) operation — checking every row in a table; catastrophically slow at scale |
| **Composite Index** | Index table keyed by multiple attributes; enables range queries on combinations |
| **Denormalized Index** | Index table that stores extra fields beyond the primary key; single-hop read |
| **Inverted Index** | Maps one value to many primary keys; used for tags, hashtags, full-text search |
| **Partial Index** | Index covering only a subset of records (e.g., only active users) |
| **Eventual Consistency** | Index may lag behind main table for a brief period; acceptable for non-critical lookups |
| **Reconciliation Job** | Background process that compares index to main table and repairs stale entries |
| **Geohash** | String encoding of geographic coordinates; used as partition key for location-based indexes |
| **Two-Phase Commit** | Protocol ensuring all-or-nothing across multiple writes; prevents partial failures |
| **Hot Partition** | Overloaded index partition where many reads/writes concentrate on one key |
