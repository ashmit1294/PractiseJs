# AWS: RDS, DynamoDB, and ElastiCache

## RDS — Relational Database Service

```
RDS is a managed relational database.
AWS handles: provisioning, patching, backups, failover, and monitoring.
You handle: schema design, queries, connection pooling.

Supported engines: PostgreSQL, MySQL, MariaDB, Oracle, SQL Server, Aurora
```

---

## RDS Setup Considerations

```
Multi-AZ Deployment:
  Primary instance writes/reads in AZ-a
  Standby replica in AZ-b (synchronous replication)
  If primary fails → automatic failover to standby (~60s downtime)
  DNS name stays the same — application reconnects automatically

Read Replicas (horizontal read scaling):
  Asynchronous replication from primary to read replicas
  Up to 15 read replicas per instance
  Use for reporting, analytics — not for writes
  Can be promoted to standalone primary if needed
```

---

## Connecting to RDS from Node.js (PostgreSQL)

```javascript
// Production PostgreSQL connection with connection pooling
// NEVER hard-code credentials — use environment variables from AWS Secrets Manager
const { Pool } = require('pg');

// Connection pool is shared across all invocations in the same Node.js process.
// pg Pool manages multiple connections — reuses them instead of opening a new
// TCP + TLS + auth handshake for every query.
const pool = new Pool({
  host:     process.env.DB_HOST,       // RDS endpoint, e.g. mydb.abc123.us-east-1.rds.amazonaws.com
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,   // from AWS Secrets Manager (via env injection)
  ssl: {
    rejectUnauthorized: true,          // verify RDS TLS certificate
    ca: process.env.RDS_CA_CERT,       // AWS RDS CA bundle (downloaded from AWS)
  },
  max: 10,                             // max connections in pool
  idleTimeoutMillis: 30_000,           // close idle connections after 30s
  connectionTimeoutMillis: 5_000,      // fail fast if can't get a connection in 5s
});

// Query helper — automatically acquires and releases a connection from the pool
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);  // params array prevents SQL injection
  console.log('Query executed', { text, duration: Date.now() - start, rows: res.rowCount });
  return res;
}

// Transaction helper — wraps multiple queries in BEGIN/COMMIT/ROLLBACK
async function withTransaction(fn) {
  const client = await pool.connect();  // take one connection and hold it for the transaction
  try {
    await client.query('BEGIN');
    const result = await fn(client);   // pass the dedicated client to the caller
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');    // undo all changes if anything fails
    throw err;
  } finally {
    client.release();                  // ALWAYS return connection to pool
  }
}

// Usage example:
async function transferMoney(fromId, toId, amount) {
  return withTransaction(async (client) => {
    // Both updates in the same transaction — atomic
    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1',
      [amount, fromId]
    );
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [amount, toId]
    );
  });
}
```

---

## RDS Proxy (for Lambda + RDS)

```
Problem: Lambda can scale to thousands of concurrent executions.
Each Lambda tries to open its own DB connection.
RDS PostgreSQL supports ~100–500 connections max.
→ Lambda scales to 500 connections → DB is overwhelmed.

Solution: RDS Proxy sits between Lambda and RDS.
It maintains a SMALL pool of actual DB connections and multiplexes
thousands of Lambda connections through them (connection pooling as a service).
```

```javascript
// No code changes needed! Just point to the RDS Proxy endpoint instead of RDS directly.
// The Proxy handles connection pooling transparently.
const pool = new Pool({
  host: process.env.DB_PROXY_HOST,  // e.g., mydb.proxy-abc123.us-east-1.rds.amazonaws.com
  // ↑ This is the Proxy endpoint, not the RDS endpoint
  // Everything else is the same
});
```

---

## DynamoDB — NoSQL Key-Value + Document Store

```
DynamoDB is a fully managed, serverless NoSQL database.
No servers to manage, no capacity planning (on-demand mode).
Scales to millions of requests per second.
Single-digit millisecond latency at any scale.

Data model:
  Table → contains Items (like rows but schema-less)
  Item  → a collection of Attributes (key-value pairs)
  Primary Key:
    - Partition Key (PK) alone — simple table (e.g., userId)
    - Partition Key + Sort Key — composite key (e.g., userId + createdAt)
```

---

## DynamoDB Access Patterns

```javascript
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand,
        UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

// DocumentClient handles marshalling/unmarshalling DynamoDB types automatically
const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION }),
);

const TABLE = process.env.DYNAMODB_TABLE;

// ── Get a single item by primary key ──────────────────────────────────────
async function getUser(userId) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLE,
    Key: { pk: `USER#${userId}` },   // Prefixing keys avoids collisions with other entity types
    ConsistentRead: true,            // strongly consistent read (higher cost; default is eventual)
  }));
  return result.Item;
}

// ── Put (create/replace) an item ──────────────────────────────────────────
async function createUser(user) {
  await dynamo.send(new PutCommand({
    TableName: TABLE,
    Item: {
      pk: `USER#${user.id}`,         // partition key
      sk: 'PROFILE',                  // sort key (for single-table design)
      ...user,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    ConditionExpression: 'attribute_not_exists(pk)',  // fail if item already exists (prevents overwrite)
  }));
}

// ── Update specific attributes (not a full replace) ───────────────────────
async function updateUserEmail(userId, newEmail) {
  // UpdateExpression: only touch the specified attributes
  // ExpressionAttributeNames: needed for reserved words (name, status, etc.)
  await dynamo.send(new UpdateCommand({
    TableName: TABLE,
    Key: { pk: `USER#${userId}`, sk: 'PROFILE' },
    UpdateExpression: 'SET #email = :email, updatedAt = :now',
    ExpressionAttributeNames: { '#email': 'email' },   // 'email' is not reserved but good practice
    ExpressionAttributeValues: {
      ':email': newEmail,
      ':now': new Date().toISOString(),
    },
    ConditionExpression: 'attribute_exists(pk)',         // fail if item doesn't exist
  }));
}

// ── Query all orders for a user (partition key = USER#123, SK begins with ORDER#) ──
async function getUserOrders(userId) {
  const result = await dynamo.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':skPrefix': 'ORDER#',
    },
    ScanIndexForward: false,       // false = descending sort key order (newest first)
    Limit: 20,                     // max items to return per page
  }));
  return result.Items;
}
```

---

## DynamoDB Single-Table Design

```javascript
// Single-table design: store ALL entity types in ONE table using PK/SK conventions.
// Access patterns are designed up front — model data around queries, not entities.

// Example table layout:
//
// PK             | SK               | Data
// ─────────────────────────────────────────────────────────────────────
// USER#u1        | PROFILE          | { name, email, createdAt }
// USER#u1        | ORDER#o1         | { total, status, createdAt }
// USER#u1        | ORDER#o2         | { total, status, createdAt }
// PRODUCT#p1     | DETAILS          | { name, price, stock }
// ORDER#o1       | ITEM#i1          | { productId, qty, price }
//
// Access patterns:
//   Get user profile:   PK=USER#u1,  SK=PROFILE
//   Get all user orders: PK=USER#u1, SK begins_with ORDER#
//   Get product:        PK=PRODUCT#p1, SK=DETAILS
```

---

## ElastiCache — Managed Redis / Memcached

```
ElastiCache is managed Redis or Memcached.
Typical uses:
  - Session storage (JWT → session ID mapping)
  - Query result caching (expensive DB query cached for 60 seconds)
  - Rate limiting (sliding window counters)
  - Pub/Sub messaging
```

```javascript
const Redis = require('ioredis');

// Connect to ElastiCache Redis cluster endpoint
// Production: use Cluster Mode for horizontal sharding
const redis = new Redis.Cluster(
  [{ host: process.env.CACHE_HOST, port: 6379 }],
  {
    redisOptions: {
      tls: {},               // ElastiCache in-transit encryption
      enableOfflineQueue: false,
    },
    enableReadyCheck: true,
  }
);

// ── Cache-aside pattern ──────────────────────────────────────────────────
// 1. Check cache first
// 2. On miss: query DB, store in cache, return
// 3. On hit: return cached data immediately
async function getUserCached(userId) {
  const cacheKey = `user:${userId}`;

  // Step 1: check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);    // cache HIT — DB not touched
  }

  // Step 2: cache miss — fetch from DB
  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

  // Step 3: store in cache with a TTL (Time To Live) of 5 minutes
  // TTL prevents the cache from serving stale data forever
  await redis.set(cacheKey, JSON.stringify(user), 'EX', 300);   // EX = seconds

  return user;
}

// ── Cache invalidation ────────────────────────────────────────────────────
async function updateUser(userId, updates) {
  await db.query('UPDATE users SET ... WHERE id = $1', [userId]);
  // Remove the cached entry so the next read fetches fresh data
  await redis.del(`user:${userId}`);
}
```

---

## Interview Questions

**Q: When would you choose DynamoDB over PostgreSQL (RDS)?**
> DynamoDB: unlimited scale with consistent latency, fully serverless, great for high-throughput key-value access (user sessions, product lookups, IoT events). No joins — all access patterns must be known upfront and modelled via keys and indexes.
> PostgreSQL: complex queries with joins, ad-hoc queries, strong ACID transactions, relational data model. Better for applications where data relationships are complex or evolving.

**Q: What is DynamoDB single-table design?**
> Storing multiple entity types (Users, Orders, Products) in ONE DynamoDB table using structured PK/SK conventions. Enables fetching multiple entity types in a SINGLE query (e.g., all orders for a user). Avoids N+1 issues. Requires designing access patterns upfront. Complex to understand initially but critical for DynamoDB performance.

**Q: What is the cache-aside pattern?**
> Application checks cache first. On a miss, queries the database, stores the result in cache with a TTL, returns it. On subsequent requests, cache serves the data directly. Also called "lazy loading". When data changes, explicitly delete or update the cache entry. Simple to implement; data may be stale until TTL expires.

**Q: What is RDS Multi-AZ and how is it different from a Read Replica?**
> Multi-AZ: synchronous standby replica in another AZ for high availability. Both primary and standby always have the same data. If primary fails, automatic failover within ~60s. Cannot serve read traffic.
> Read Replica: asynchronous copy for read scaling. Can serve SELECT queries. Used for read-heavy workloads like reporting. Not a failover target by default.

**Q: Why do you need RDS Proxy for Lambda?**
> Lambda scales to thousands of concurrent executions — each opening a DB connection. RDS/Aurora have a hard connection limit (dozens to hundreds). RDS Proxy maintains a fixed pool of actual DB connections and multiplexes thousands of Lambda connections through them, preventing connection exhaustion without any code changes.
