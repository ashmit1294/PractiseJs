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

---

## ELI5: Actions Explained

> Every action taken in the STAR story above, explained like you're 5 years old.

| Action | ELI5 Explanation |
|--------|-----------------|
| **Chose shared-database, separate-schema strategy (schema-per-tenant)** | One apartment building (shared database), but each tenant gets their own locked flat with a complete set of rooms (tables). The building infrastructure is shared (cheaper than one house per person), but everything inside your flat belongs only to you. Onboarding a new tenant is just copying the flat blueprint — it takes 100 milliseconds, not hours of provisioning a new building. |
| **Connection pool uses `SET search_path = tenant_{id}` before every query** | Like putting on a name badge when you enter the building that says which flat you belong to. Every door (database table) you try to open automatically sends you to your own floor. No code logic needed to "remember" to filter by tenant — the database connection itself is locked to the right scope. You *cannot* accidentally walk into a neighbour's flat. |
| **Middleware extracts `tenantId` from JWT and sets it on the request context** | The doorman reads your wristband (JWT) the moment you walk in and stamps your hand with your tenant ID. Every action after that automatically carries the stamp. No part of the application can forget who you are or act on behalf of the wrong tenant — the stamp is on the hand from the first step. |
| **Added Row-Level Security (RLS) as a defence-in-depth safety net** | Even if a bug somehow bypasses the `search_path` safeguard, Postgres itself enforces a rule at the database engine level: "this database user can only read or write rows where the `tenantId` column matches their identity." It's the deadbolt on the inside of the flat door — a last-resort backup you hope you never need, but it's there if everything else fails. |

---

## ELI5 Complex Keywords Glossary

| Term | ELI5 Explanation |
|------|-----------------|
| **Multi-Tenancy** | One application serving multiple separate customers (tenants) on shared infrastructure. Like one apartment building with many tenants — everyone shares the pipes and electricity, but each flat is their own private space. |
| **Tenant** | One customer organisation using your SaaS platform. Company A is one tenant, Company B is another. Each should only ever see their own data. |
| **Single-Tenant** | Each customer gets their own dedicated infrastructure (their own database, their own servers). Maximum isolation. Maximum cost. Like every customer having their own private house. |
| **Database-per-Tenant** | Each tenant has a completely separate database. Ultimate isolation — a bug in one tenant's DB can't affect another. But: operationally painful and expensive to run hundreds of databases. |
| **Schema-per-Tenant** | All tenants share one database, but each gets their own named "schema" (a folder/namespace inside the DB) with its own copy of all tables. One DB, many isolated namespaces. Good balance of cost and isolation. |
| **Shared DB + tenantId Column** | All tenants' data is in the same tables. Every row has a `tenant_id` column. Cheapest to operate. Riskiest — a missing `WHERE tenant_id = ?` in one query leaks data across tenants. |
| **Postgres Schema** | A namespace within a Postgres database. `tenant_abc.users` and `tenant_xyz.users` are completely separate tables even though they're in the same database. Changing the `search_path` changes which schema your queries see. |
| **search_path** | A Postgres setting that controls which schema is searched when you write `SELECT * FROM users` (without specifying a schema). Set `search_path = tenant_abc` and every query is automatically scoped to that tenant's tables. |
| **RLS (Row-Level Security)** | A Postgres feature that enforces access rules at the database level. Even if application code has a bug and forgets the `tenant_id` filter, the database itself blocks the query from returning rows from the wrong tenant. Defence-in-depth. |
| **Defence-in-Depth** | Using multiple layers of security so that no single mistake causes a disaster. Application code filters by tenant, AND row-level security filters by tenant, AND schema isolation filters by tenant — three independent barriers. |
| **Connection Pool** | A pre-established pool of reusable database connections. Opening a new DB connection is slow (~100ms). A pool keeps connections open and lends them out quickly — like a parking garage of ready connections. |
| **Tenant Middleware** | An Express middleware function that runs on every request to extract the tenant's identity from the JWT, look up their account status, and attach it to the request object so all downstream handlers know which tenant they're serving. |
| **Repository Layer** | A code abstraction that wraps all database queries. Instead of scattering `tenantQuery(tenantId, ...)` everywhere, you instantiate a `UserRepository(tenantId)` and call `.findAll()`. Tenant scoping is baked in once — every method inherits it. |
| **Tenant Provisioning** | The automated process of setting up a new tenant's isolated environment when they sign up: create their schema, run migrations to create tables, create their first admin user. Should take milliseconds, not hours. |
| **Noisy Neighbour** | When one tenant's heavy usage (large queries, bulk uploads) slows down the database for all other tenants sharing the same infrastructure. Mitigated with statement timeouts, per-tenant connection limits, and routing heavy queries to replicas. |
| **Statement Timeout** | A Postgres setting that automatically kills a query if it runs longer than N milliseconds. Prevents one tenant's accidental full-table-scan from locking resources for everyone. |
| **Feature Flag (per-tenant)** | A setting that enables or disables specific features for a particular tenant based on their plan. Free plan: basic reports only. Enterprise plan: advanced reports, API access, custom branding. Enforced by middleware. |
| **Audit Log** | A permanent record of every action taken: who did what, to which resource, at what time. Required for compliance (GDPR, SOC2). In multi-tenant systems, every audit entry includes the `tenantId` so activity can be scoped per customer. |
| **GDPR (General Data Protection Regulation)** | European law requiring companies to protect personal data and give users the right to access or delete their data. In SaaS: you must be able to export or delete all of one tenant's data on request. |
| **SaaS (Software as a Service)** | Delivering software as a subscription service over the internet. The vendor runs the infrastructure; customers access it via browser or API. Salesforce, Slack, and GitHub are all SaaS. Multi-tenancy is the standard architecture. |
| **JWT Claim (tenantId)** | The `tenantId` embedded inside the user's JWT token at login time. Every API request includes the JWT, so every handler can instantly know which tenant the request belongs to without an extra database lookup. |
| **B2B (Business-to-Business)** | Selling software to companies rather than individual consumers. In B2B SaaS, each company is a tenant — Company X has its own users, data, and configuration, all isolated from Company Y. |
| **Schema Migration** | A script that alters the database structure (add table, add column, add index). For schema-per-tenant, migrations must be run against every tenant's schema when upgrading the platform — automated with a loop through all active schemas. |
