# Multi-Tenancy Design
> Resume Signal: Multi-tenant SaaS platform (CES Limited), tenant data isolation, role-based access

---

## STAR Interview Answer

| | |
|---|---|
| **Situation** | Building a SaaS platform for CES Limited where each customer organisation (tenant) should have completely isolated data, their own users with roles, and separate configuration — but all running on a shared infrastructure to keep operational costs manageable. |
| **Task** | Design a multi-tenancy architecture that enforces strict data isolation (no tenant can see another tenant's data), supports per-tenant configuration, and scales to hundreds of tenants without managing hundreds of databases. |
| **Action** | Chose shared-database, separate-schema strategy (Postgres schema-per-tenant): each tenant gets their own Postgres schema with identical table structures, but all schemas live in one database instance. Connection pool uses `SET search_path = tenant_{id}` to scope every query. Middleware extracts `tenantId` from JWT, sets it on the request context; all DB queries go through a tenant-scoped repository layer. Added row-level security (RLS) as a defence-in-depth safety net. API keys and JWT claims carry tenantId so every auth check is tenant-aware. |
| **Result** | Strict isolation — connection to wrong schema is architecturally impossible once `search_path` is set. Zero cross-tenant data leaks. Onboarding a new tenant is a 100ms schema migration. Single DB instance handles 200+ tenants. Audit logging captures every write action with tenantId. |

---

## ELI5

Imagine a block of flats (apartment building). **Single-tenant** = each tenant owns their own house with their own utilities, garden, and key. Fully isolated — expensive. **Multi-tenant shared database** = everyone in one flat, same fridge, just labelled shelves — cheap, but you might accidentally grab someone else's food. **Multi-tenant schema-per-tenant** = one building, separate locked flats — same building infrastructure (cheaper), but your flat is your own locked space. Only your key opens your door.

---

## Multi-Tenancy Models Comparison

| Model | Data isolation | Cost | Complexity | Onboarding | Best for |
|--|--|--|--|--|--|
| Database per tenant | Complete | Very high (1 DB per customer) | High (connection pools scale with tenants) | Slow (provision DB) | Regulated industries, large enterprise customers |
| Schema per tenant | Strong | Medium (1 schema per customer, shared DB) | Medium | Fast (run migration) | Mid-market SaaS, 10–1000 tenants |
| Shared DB + `tenantId` column | Logical only | Low | Low initially, risky at scale | Instant | Early-stage, small datasets, hundreds of thousands of tenants |

---

## Schema-per-Tenant (Postgres)

### Tenant provisioning

```sql
-- Create a new tenant schema (run at onboarding time)
CREATE SCHEMA IF NOT EXISTS tenant_abc123;

-- Copy table structure from template schema
CREATE TABLE tenant_abc123.users        (LIKE _template.users        INCLUDING ALL);
CREATE TABLE tenant_abc123.projects     (LIKE _template.projects     INCLUDING ALL);
CREATE TABLE tenant_abc123.audit_logs   (LIKE _template.audit_logs   INCLUDING ALL);

-- Indexes are included via INCLUDING ALL
-- Foreign keys must be added separately if they reference other tables in the schema
```

```javascript
// Tenant provisioning service
async function provisionTenant(tenant) {
  const schemaName = `tenant_${tenant.id.replace(/-/g, '_')}`;

  await db.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

  // Run schema migrations for this tenant
  await runMigrations(schemaName);

  await db.tenants.insert({
    id:         tenant.id,
    name:       tenant.name,
    schemaName,
    plan:       tenant.plan,
    createdAt:  new Date(),
  });

  return { schemaName };
}
```

### Connection scoping with search_path

```javascript
// db.js — tenant-scoped query function
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Every query for a tenant goes through this — sets search_path before executing
async function tenantQuery(tenantId, sql, params = []) {
  const client = await pool.connect();
  try {
    const schema = await getSchemaName(tenantId);     // lookup from cache
    await client.query(`SET search_path = "${schema}", public`);
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

// Usage — no cross-tenant leakage possible: wrong tenantId → different schema
const users = await tenantQuery(req.tenantId, 'SELECT * FROM users WHERE role = $1', ['admin']);
```

---

## Shared DB + tenantId Column (Simpler Alternative)

All tenants share the same tables; every row has a `tenant_id` column.

```sql
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),   -- always present
  email      TEXT NOT NULL,
  role       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite index: always query within a tenant
CREATE INDEX users_tenant_id_email_idx ON users (tenant_id, email);

-- Row-Level Security — DB enforces isolation even if application bug forgets WHERE clause
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

```javascript
// Set tenant context at the start of every DB transaction
async function withTenantContext(tenantId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// RLS now enforces tenant isolation at the DB level
// Even if application code forgets WHERE tenant_id = $1, DB policy blocks it
await withTenantContext(req.tenantId, async (client) => {
  return client.query('SELECT * FROM users');  // RLS filters to current tenant automatically
});
```

---

## Tenant Middleware (Express)

```javascript
// Extracts and validates tenantId on every request
async function tenantMiddleware(req, res, next) {
  // tenantId comes from JWT claim (B2B: from API key lookup, subdomain, or org claim)
  const tenantId = req.auth?.tenantId;
  if (!tenantId) return res.status(401).json({ error: 'Missing tenant context' });

  const tenant = await tenantCache.get(tenantId);    // Redis cache — avoid DB on every request
  if (!tenant) return res.status(403).json({ error: 'Tenant not found or inactive' });
  if (tenant.status !== 'active') {
    return res.status(403).json({ error: 'Tenant account suspended' });
  }

  req.tenant = tenant;    // available to all downstream handlers
  next();
}

// All protected routes use tenant middleware
router.use('/api', authenticate, tenantMiddleware);

// Repository layer always scoped to tenant
class UserRepository {
  constructor(tenantId) {
    this.tenantId = tenantId;
  }

  async findAll() {
    return tenantQuery(this.tenantId, 'SELECT * FROM users ORDER BY created_at DESC');
  }

  async findById(userId) {
    const result = await tenantQuery(
      this.tenantId,
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0] ?? null;
  }
}

// In handler
const users = new UserRepository(req.tenant.id);
const allUsers = await users.findAll();
```

---

## Per-Tenant Configuration

```javascript
// Tenant settings stored in shared tenants table
// Fetched once, cached in Redis with TTL

const TENANT_CONFIG_TTL = 300;  // 5 minutes

async function getTenantConfig(tenantId) {
  const cacheKey = `tenant:config:${tenantId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const tenant = await db.tenants.findById(tenantId);
  const config = {
    id:           tenant.id,
    name:         tenant.name,
    plan:         tenant.plan,          // 'free' | 'pro' | 'enterprise'
    features:     tenant.features,      // { advancedReports: true, apiAccess: false }
    rateLimits:   PLAN_LIMITS[tenant.plan],
    logoUrl:      tenant.logoUrl,
    primaryColor: tenant.primaryColor,
  };

  await redis.setex(cacheKey, TENANT_CONFIG_TTL, JSON.stringify(config));
  return config;
}

// Feature flag enforcement
function requireFeature(featureName) {
  return (req, res, next) => {
    if (!req.tenant.features[featureName]) {
      return res.status(403).json({
        error: `Feature '${featureName}' not available on your plan`,
        upgradeUrl: '/billing/upgrade',
      });
    }
    next();
  };
}

router.get('/reports/advanced', requireFeature('advancedReports'), advancedReportsHandler);
```

---

## Audit Logging

```javascript
// Every write operation logged per tenant — critical for SaaS compliance
async function auditLog({ tenantId, userId, action, resource, resourceId, changes }) {
  await tenantQuery(tenantId,
    `INSERT INTO audit_logs (tenant_id, user_id, action, resource, resource_id, changes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [tenantId, userId, action, resource, resourceId, JSON.stringify(changes)]
  );
}

// Middleware: auto-log all mutations
function auditMiddleware(action, resource) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400) {
        auditLog({
          tenantId:   req.tenant.id,
          userId:     req.auth.sub,
          action,
          resource,
          resourceId: body?.id ?? req.params.id,
          changes:    req.body,
        }).catch(console.error);   // fire-and-forget — don't block response
      }
      return originalJson(body);
    };
    next();
  };
}

router.post('/users',     auditMiddleware('CREATE', 'user'),     createUser);
router.patch('/users/:id', auditMiddleware('UPDATE', 'user'),    updateUser);
router.delete('/users/:id', auditMiddleware('DELETE', 'user'),   deleteUser);
```

---

## Key Interview Q&A

**Q: Why schema-per-tenant instead of just a tenantId column?**
> Schema-per-tenant gives architectural isolation — once `search_path` is set, a query on `users` can only see that tenant's schema. There is no `WHERE tenant_id = ?` clause to accidentally omit. Indexes are also tenant-scoped, so a large tenant doesn't cause index bloat that affects other tenants. Trade-off: Postgres has a practical limit around 10,000 schemas, so this model works for hundreds to thousands of tenants.

**Q: How do you run database migrations across hundreds of tenant schemas?**
> Tenant migration script: fetch all active tenant schema names, then run each migration SQL inside `SET search_path = "{schema}"`. Done in sequence (or in small parallel batches with a semaphore) using a migration framework. New schemas always get full migrations applied at provisioning time. Rolled out with a feature flag: migrate 1 schema, verify, then run all others.

**Q: How do you prevent one tenant's heavy queries from affecting others (noisy neighbour)?**
> At the DB level: per-tenant connection limits (Postgres `LIMIT` on user), statement timeout (`SET statement_timeout = 10000`), and query cost limits. At the app level: rate limit by tenantId (not just by IP). For heavy reporting queries, route to a read replica or a separate analytics DB. Larger plan tenants can be given dedicated replica capacity.

**Q: How does onboarding a new tenant work end-to-end?**
> (1) User signs up → record created in global `tenants` table with status `provisioning`; (2) Background job creates Postgres schema, runs all migrations (~100ms); (3) Status updated to `active`; (4) First JWT issued with `tenantId` claim. No new database, no new server, no config deploy needed. Offboarding: schema renamed to `archived_` prefix (retained for 30 days per GDPR data retention policy), then dropped.
