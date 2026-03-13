# Azure: Databases

## Azure Database for PostgreSQL — Flexible Server

```
Managed Postgres on Azure.
Azure handles: patching, backups, HA failover, monitoring.
You handle: schema, queries, connection pooling.

Flexible Server features:
  High Availability: Zone-redundant (standby in different AZ) — same endpoint
  Read Replicas: up to 5 replicas for read scaling
  PITR: Point-in-Time Restore — restore DB to any point in the last 35 days
  Backup: automatic daily backups, geo-redundant option
  Connection pool: built-in PgBouncer connection pooler
```

```bash
# Create a Flexible Server
az postgres flexible-server create \
  --resource-group rg-my-app-prod \
  --name mydb-postgres-prod \
  --location eastus \
  --admin-user pgadmin \
  --admin-password "$(openssl rand -base64 32)" \  # generate strong random password
  --tier GeneralPurpose \
  --sku-name Standard_D4s_v3 \         # 4 vCPU, 16 GB RAM
  --version 16 \                        # PostgreSQL 16
  --storage-size 128 \                  # 128 GB SSD
  --high-availability ZoneRedundant \   # automatic failover to standby AZ
  --vnet my-vnet \
  --subnet db-subnet                    # put DB in private subnet — no public access

# Store admin password in Key Vault (never leave it in shell history)
az keyvault secret set \
  --vault-name my-keyvault \
  --name postgres-admin-password \
  --value "$(az postgres flexible-server show-connection-string ...)"

# Allow only the App Service's VNet to connect (Private Endpoint)
az postgres flexible-server create \
  --private-dns-zone mydb-postgres-prod.private.postgres.database.azure.com
# ↑ App code connects using the private DNS name — traffic stays inside VNet
```

---

## Cosmos DB — Multi-Model Globally Distributed Database

```
Azure Cosmos DB is a fully managed NoSQL database.
Key capabilities:
  - Single-digit millisecond reads and writes at global scale
  - Automatic horizontal sharding (partition key = shard key)
  - 5 consistency levels (from strong to eventual) — trade consistency for latency
  - Multi-region writes (active-active) — write to any region, data replicated globally
  - Multiple APIs: NoSQL (JSON), MongoDB, Cassandra, Gremlin (graph), Table

Think of it as: Microsoft's version of AWS DynamoDB with more API choices.
```

---

```javascript
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

// Connect using Managed Identity (no connection string with secrets)
const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,          // https://my-cosmos.documents.azure.com:443/
  aadCredentials: new DefaultAzureCredential(),    // uses Managed Identity or Azure CLI
});

const { database } = await cosmosClient.databases.createIfNotExists({ id: 'my-db' });
const { container } = await database.containers.createIfNotExists({
  id: 'users',
  partitionKey: { paths: ['/countryCode'] },   // choose a high-cardinality partition key
  // BAD partition key: /status (only 3-4 values → hot partitions)
  // GOOD partition key: /userId, /countryCode, /tenantId (many unique values)
});

// ── Create an item ────────────────────────────────────────────────────────
async function createUser(user) {
  const { resource } = await container.items.create({
    id: user.id,                     // MUST provide unique id within the partition
    countryCode: user.countryCode,   // the partition key value
    name: user.name,
    email: user.email,
    createdAt: new Date().toISOString(),
    // Cosmos DB automatically stores system fields like _ts (timestamp), _rid, _etag
  });
  return resource;
}

// ── Read an item by id and partition key ──────────────────────────────────
// Reading by id + partition key = cheapest & fastest — single lookup
async function getUser(userId, countryCode) {
  const { resource } = await container.item(userId, countryCode).read();
  return resource;
}

// ── Query with SQL-like syntax ────────────────────────────────────────────
async function getUsersByCountry(countryCode) {
  const { resources } = await container.items.query({
    query: 'SELECT * FROM c WHERE c.countryCode = @countryCode ORDER BY c.createdAt DESC',
    parameters: [{ name: '@countryCode', value: countryCode }],  // parameterized — prevents injection
  }).fetchAll();
  return resources;
}

// ── Upsert (insert or replace) ────────────────────────────────────────────
async function upsertUser(user) {
  const { resource } = await container.items.upsert(user);
  return resource;
}
```

---

## Cosmos DB Consistency Levels

```
Cosmos DB offers 5 consistency levels (choose per-operation or at account level):

  Strong          → reads always see the latest write (like a relational DB)
                    Highest consistency, highest latency, 2x RU cost
                    Use: financial transactions, inventory counts

  Bounded Staleness → reads may lag writes by at most K versions or T seconds
                    Good: apps that need predictable staleness (e.g., news feed)

  Session (default) → consistency within a single session/client
                    Reads see writes made in the same session
                    Good: most web apps — user sees their own changes immediately

  Consistent Prefix → reads never see out-of-order writes (no "reply before question")
                    Good: social feeds, comment threads

  Eventual        → weakest — reads may see stale data, eventually consistent
                    Lowest latency, cheapest RU cost
                    Good: "likes" counts, analytics, cache invalidation
```

---

## Azure SQL — Managed SQL Server

```
Azure SQL is a fully managed SQL Server database.
Best if your app already uses SQL Server or T-SQL.
Azure handles: backups, patching, HA, failover, security.

Tiers:
  DTU-based    → simple combined measure of CPU+IO+memory
  vCore-based  → choose CPUs separately (Serverless auto-pause when idle = cost savings)
  Hyperscale   → up to 100 TB, near-instant snapshots, up to 30 replicas
```

---

## Azure Cache for Redis

```
Managed Redis on Azure.
Use cases: session storage, query caching, pub/sub, rate limiting.
Tiers: Basic (dev/test, no SLA), Standard (HA replica pair), Premium (clustering, persistence)
```

```javascript
const { createClient } = require('redis');

// Connect to Azure Cache for Redis with TLS (always required)
const redisClient = createClient({
  url: `rediss://${process.env.REDIS_HOST}:6380`,  // rediss:// = TLS, port 6380
  password: process.env.REDIS_KEY,                  // primary access key from Azure portal
  socket: {
    tls: true,
    rejectUnauthorized: true,
  },
});

await redisClient.connect();

// ── Session cache pattern ─────────────────────────────────────────────────
async function setSession(sessionId, userId, ttlSeconds = 3600) {
  // EX sets expiry in seconds — session expires after 1 hour of inactivity
  await redisClient.setEx(`session:${sessionId}`, ttlSeconds, String(userId));
}

async function getSession(sessionId) {
  const userId = await redisClient.get(`session:${sessionId}`);
  if (!userId) return null;               // session expired or doesn't exist

  // Refresh TTL on each access ("sliding expiry" pattern)
  await redisClient.expire(`session:${sessionId}`, 3600);
  return userId;
}

// ── Cache-aside query result ───────────────────────────────────────────────
async function getProductCached(productId) {
  const cacheKey = `product:${productId}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const product = await db.findProduct(productId);
  if (product) {
    await redisClient.setEx(cacheKey, 300, JSON.stringify(product));  // cache 5 min
  }
  return product;
}
```

---

## Interview Questions

**Q: What is the Cosmos DB partition key and how do you choose a good one?**
> The partition key determines how Azure distributes items across physical partitions. A good partition key: high cardinality (many unique values — userId, tenantId), evenly distributed (no "hot" partitions with most traffic), included in most query filters (so queries hit one partition, not all). Bad choices: createdAt (time-clustering → hot partition), status (only 3 values → 3 partitions max → bottleneck).

**Q: What are the Cosmos DB consistency levels and which do you use by default?**
> Session consistency is the default and covers most web apps — a user always reads what they wrote in the same session. Strong consistency ensures every read sees the latest write but has higher latency and cost. Eventual is cheapest/fastest but data may be stale. Choose based on business requirements — financial systems need Strong, social feeds are fine with Eventual.

**Q: What is Azure SQL Serverless compute tier?**
> A tier that auto-pauses the database after a configurable idle period (saving costs to near-zero) and auto-resumes on the first connection (with a few seconds of cold start). Ideal for dev/test databases or apps with unpredictable, intermittent usage. Not suitable for latency-sensitive production workloads where that startup delay is unacceptable.

**Q: Why does Cosmos DB charge "RUs" instead of traditional DB pricing?**
> RU (Request Unit) is a normalized measure of CPU, memory, and I/O consumed by an operation. A 1KB document read = 1 RU. A write = ~5 RU. A complex query = hundreds of RU. You provision or auto-scale RU/s on a container. This abstraction lets Cosmos DB scale horizontally and bill consistently regardless of which physical server runs your query.

**Q: When would you choose Cosmos DB over Azure Database for PostgreSQL?**
> Cosmos DB: global distribution, single-digit ms latency at any scale, schema-less documents, IoT data, user profiles, session data, gaming leaderboards. No complex joins — all access patterns via partition key + id lookups.
> PostgreSQL: complex relational queries with joins, strong ACID transactions, reporting, evolving data model. Easier to start with; schema migrations are straightforward with standard SQL tools.
