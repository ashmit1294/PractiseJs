# T09 — Deployment Stamps Pattern: Multi-Region Scale-Out

## 1. ELI5
Imagine a restaurant so popular it can't fit more customers. Instead of making the kitchen bigger (which costs a fortune and is hard), the owner opens identical restaurants in different neighborhoods. Now each neighborhood has its own kitchen, staff, and inventory — when one location is busy, customers go to the next one. Deployment stamps work the same way: instead of scaling one massive deployment, you deploy identical copies of your entire app and split users across them.

---

## 2. Analogy
Think of deployment stamps like **franchise restaurant locations**. Instead of building one massive restaurant serving an entire city (vertical scaling), you open multiple identical franchise locations across different neighborhoods (horizontal scaling via stamps). Each location has its own kitchen, staff, and inventory (independent resources), serving customers in its area (tenant assignment), and operates independently — if one location has a kitchen fire, the others keep serving customers. When demand grows, you don't expand existing restaurants; you open new franchises. This is exactly how Spotify scales: each "stamp" serves millions of users, and they add new stamps as they grow globally.

---

## 3. Core Concept

**Deployment Stamps pattern** (also called "scale units" or "cells") deploys multiple independent, self-contained copies of your entire application stack, each serving a bounded subset of users or tenants. Instead of scaling individual services within a single deployment, stamps replicate the entire stack — load balancers, app servers, databases, caches, message queues, everything. Each stamp operates as a self-contained unit with its own resources, data stores, and failure domain.

Key insight: **Each stamp must be completely independent with no shared runtime dependencies** (separate databases, caches, queues, etc.). This ensures that one stamp's failure doesn't cascade to others.

```
Stamp Architecture:
┌──────────────────────────────────────────────────────────┐
│                  Global Routing Layer (Stateless)         │
│            Maps tenant → stamp assignment                 │
└─────────────────┬──────────────────────┬─────────────────┘
                  │                      │
        ┌─────────▼──────────┐  ┌────────▼─────────────┐
        │   Stamp 1          │  │   Stamp 2           │
        ├──────────────────┤  ├──────────────────┤
        │ Load Balancer    │  │ Load Balancer    │
        │ App Servers (×4) │  │ App Servers (×4) │
        │ PostgreSQL Prime │  │ PostgreSQL Prime │
        │ Redis Cache      │  │ Redis Cache      │
        │ Message Queue    │  │ Message Queue    │
        └──────────────────┘  └──────────────────┘
        (1M users)             (1M users)
        
        ✅ Complete independence
        ✅ Separate databases
        ✅ No cross-stamp dependencies
```

---

## 4. ASCII Architecture & Diagrams

### Request Flow Through Stamp Architecture
```
User Request (tenant_id: acme-corp)
         │
         ▼
   [Global Router]
         │
    SELECT stamp_id WHERE tenant='acme-corp'  ← lookup table (DynamoDB)
         │
         ▼
    stamp_id: stamp-2
         │
    Forward request to stamp-2.example.com
         │
         ▼
    [Stamp-2 Load Balancer]
         │
    ┌────┴────┬─────────┬──────────┐
    ▼         ▼         ▼          ▼
  [App-1]  [App-2]   [App-3]   [App-4]  ← Thread pool isolation
    │         │         │          │
    └─────────┴─────────┴──────────┘
              │
              ▼
    [PostgreSQL Primary (Stamp-2)]
              │
         INSERT INTO orders
              │
              ▼
    [Redis Cache (Stamp-2)] ← Async replication to other stamps
```

### Stamp Capacity Planning
```
Variables:
  T = Target tenants per stamp
  R_tenant = Average requests/sec per tenant
  Q = Database queries per request
  L = Latency SLA (seconds)
  P = Peak multiplier (3-5x)

Formula:
  RPS_stamp = T × R_tenant × P
  QPS_db = RPS_stamp × Q
  Connections_required = QPS_db × L (Little's Law)

Example: Project Management SaaS
  1,000 tenants/stamp × 5 req/sec/tenant × 4x peak = 20,000 RPS
  20,000 RPS × 8 queries/req = 160,000 QPS
  160,000 QPS × 0.2s latency = 32,000 DB connections needed
```

---

## 5. How It Works (Step-by-Step)

**Step 1: Define the Stamp Blueprint**
Create infrastructure-as-code template (Terraform, CloudFormation) defining complete stack: all services, databases, caches, load balancers, networking. Blueprint parameterized so identical stamps can be deployed with different identifiers and in different regions. Example: Stripe's stamp includes PostgreSQL clusters, Redis instances, app servers, dedicated monitoring — everything to process payments independently.

**Step 2: Implement the Routing Layer**
Build stateless global routing service mapping tenants to stamps. Maintains mapping table (DynamoDB, Spanner) recording which stamp serves which tenant. When request arrives, router looks up tenant ID, determines assigned stamp, forwards request. Router must be highly available and low-latency (critical path for every request). GitHub's routing uses GeoDNS for region selection + consistent hashing for stamp distribution.

**Step 3: Deploy Initial Stamps**
Provision first set of stamps across target regions, each with sufficient capacity for assigned load + headroom for growth and spikes. For US/EU expansion: 2 stamps in us-east-1, 2 in us-west-2, 2 in eu-west-1. Each completely independent — separate databases, deployments, monitoring.

**Step 4: Assign Tenants to Stamps**
Assign tenants based on available capacity + data residency constraints. New tenants typically assigned to stamp with most available capacity in required region. Assignment recorded in routing layer's mapping table (source of truth). Some systems use consistent hashing; others use explicit assignment with control plane service.

**Step 5: Monitor Stamp Health and Capacity**
Each stamp reports utilization metrics (CPU, memory, DB connections, queue depth) + business metrics (requests/sec, active users, data volume). Central monitoring aggregates metrics, identifies stamps approaching capacity (70-80% threshold signals provisioning needed). When stamp reaches 70%, provision new stamp; by 80%, new stamp must be ready.

**Step 6: Scale by Adding Stamps**
When capacity increases, deploy new stamps using infrastructure-as-code blueprint. New stamp goes through deployment and validation, then registered with routing layer for new tenant assignments. Existing tenants stay on current stamp (unless tenant migration capability implemented). This scaling is independent of existing stamps — no in-place modifications affecting users.

**Step 7: Handle Stamp Failures Gracefully**
When stamp fails (deployment failure, infrastructure outage, cascading failure), only assigned tenants affected. Routing layer detects unhealthy stamps via health checks, either retries same stamp (transient issues) or redirects to backup stamp (if multi-stamp redundancy for critical tenants). Other stamps continue normally — partial outage, not total.

---

## 6. Variants

### Geographic Stamps
Deploy stamps in different geographic regions serving users with low latency; each region has 1+ stamps. Users routed to nearest region; load balanced across stamps within region. Common for global SaaS with data residency requirements. Spotify: stamps in North America, Europe, Asia, other regions; users assigned by region. Routing uses GeoDNS. Advantage: compliance (data stays in-country), low latency. Disadvantage: operational complexity (multi-region infrastructure, region-specific quirks).

### Tenant-Tier Stamps
Different stamp types for different customer tiers (free, standard, premium, enterprise). Isolates noisy neighbors — free tier can't impact enterprise. Salesforce: per-edition stamps (different resource allocations). Premium stamps: larger DB instances, aggressive caching, strict rate limits. Advantage: service differentiation, cost optimization. Disadvantage: operational complexity (multiple stamp types).

### Functional Stamps
Partition by functionality, not by tenant. API stamps vs. batch processing stamps vs. analytics stamps. Each optimized for workload type. Twitter: real-time delivery ≠ batch analytics. Advantage: workload isolation + optimization. Disadvantage: complex routing (function-based), data sync challenges.

### Hybrid Stamps
Combine multiple strategies: geographic + tenant-tier. US-East (standard + premium) + US-West (standard + premium) + EU (standard + premium). GitHub: geographic + repository-size-based (large repos get dedicated stamps). Advantage: fine-grained control. Disadvantage: high complexity.

### Ephemeral Stamps
Short-lived stamps for testing, staging, or temporary capacity. Spin up, run tests, tear down. Example: Stripe deploys ephemeral stamps for load testing at scale. Advantage: cost efficiency. Disadvantage: deployment latency (not for rapid response).

---

## 7. Trade-offs

| Dimension | Trade-off |
|-----------|-----------|
| **Stamp Size** | Large (10K+ tenants): efficient costs but bigger blast radius. Small (1K tenants): better isolation but higher per-tenant cost. **Decision**: large for cost efficiency if mature + reliable; small for early-stage/high-value |
| **Routing Strategy** | Static assignment (permanent, simple): vs Dynamic (load-based, auto-balance but complex). **Decision**: static when migration is expensive; dynamic when tenants are small/stateless |
| **Data Architecture** | Stamp-local (complete isolation): vs Globally replicated (cross-tenant features). **Decision**: local when isolation paramount; global when need cross-tenant search/analytics |
| **Deployment Strategy** | All-at-once (fast, consistent): vs Progressive (safer but slower). **Decision**: all-at-once for high confidence; progressive for risky changes |
| **Tenant Migration** | Enabled (flexibility): vs Disabled (simpler). **Decision**: enable when must rebalance load/decommission stamps; disable when migration hard |

---

## 8. When to Use / When to Avoid

### Use When:
- Multi-tenant SaaS needing fault isolation between tenants (Stripe, Shopify)
- Hitting practical limits of single-deployment scaling (DB too large, deployment too slow, blast radius too big)
- Data residency requirements (GDPR, data sovereignty laws)
- 100K+ users / 1K+ tenants with clear tenant boundaries
- Want near-linear horizontal scaling

### Avoid When:
- <100K users or <1K tenants (stamps add unnecessary complexity)
- Single-tenant systems (just use multi-region active-active)
- Tenants highly interconnected (stamps break this)
- Migration across data stores prohibitively expensive
- Team lacks infrastructure-as-code + DevOps maturity

---

## 9. MERN Dev Notes

### Routing Layer Implementation
```javascript
// Global routing service determining stamp assignment
class TenantStampRouter {
  constructor(dynamoDBClient) {
    this.dynamo = dynamoDBClient;
    this.cache = new Map(); // Local cache for quick lookups
  }

  async getStampForTenant(tenantId) {
    // Check local cache first
    if (this.cache.has(tenantId)) {
      const cached = this.cache.get(tenantId);
      if (Date.now() - cached.timestamp < 60000) { // 60s TTL
        return cached.stamp;
      }
    }

    // Query DynamoDB mapping table
    const result = await this.dynamo.get({
      TableName: 'TenantStampMapping',
      Key: { tenantId: { S: tenantId } }
    }).promise();

    if (!result.Item) {
      // New tenant: assign to least-loaded stamp
      const stamp = await this.assignNewTenant(tenantId);
      return stamp;
    }

    const stamp = result.Item.stampId.S;
    this.cache.set(tenantId, { stamp, timestamp: Date.now() });
    return stamp;
  }

  async assignNewTenant(tenantId) {
    // Get all stamps and their utilization
    const stamps = await this.getStampUtilization();
    
    // Find stamp with lowest utilization
    const assigned = stamps.reduce((best, current) =>
      current.utilization < best.utilization ? current : best
    );

    // Record assignment
    await this.dynamo.put({
      TableName: 'TenantStampMapping',
      Item: {
        tenantId: { S: tenantId },
        stampId: { S: assigned.stampId },
        region: { S: assigned.region },
        assignedAt: { N: Date.now().toString() }
      }
    }).promise();

    return assigned.stampId;
  }

  async getStampUtilization() {
    // Fetch metrics from CloudWatch or custom monitoring
    const stamps = [
      { stampId: 'stamp-1', region: 'us-east-1', utilization: 0.65 },
      { stampId: 'stamp-2', region: 'us-east-1', utilization: 0.72 },
      { stampId: 'stamp-3', region: 'eu-west-1', utilization: 0.45 }
    ];
    return stamps;
  }
}

module.exports = TenantStampRouter;
```

### Stamp Deployment Template (Terraform)
```hcl
# variables.tf
variable "stamp_id" {
  type = string
  description = "Unique identifier for this stamp"
}

variable "region" {
  type = string
  default = "us-east-1"
}

variable "tenant_count_target" {
  type = number
  default = 1000
}

# main.tf
resource "aws_rds_cluster" "stamp_db" {
  cluster_identifier      = "stamp-${var.stamp_id}-db"
  engine                  = "aurora-postgresql"
  database_name           = "tenantdb"
  master_username         = "admin"
  master_password         = random_password.db_password.result
  backup_retention_period = 7
  preferred_backup_window = "03:00-04:00"
  
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.stamp_pgparams.name
  
  tags = {
    StampId = var.stamp_id
    Environment = "production"
  }
}

resource "aws_elasticache_cluster" "stamp_redis" {
  cluster_id           = "stamp-${var.stamp_id}-cache"
  engine               = "redis"
  node_type            = "cache.r6g.xlarge"
  num_cache_nodes      = 3
  parameter_group_name = "default.redis7"
  engine_version       = "7.0"
  port                 = 6379
  
  subnet_group_name            = aws_elasticache_subnet_group.stamp_subnet.name
  security_group_ids           = [aws_security_group.stamp_redis.id]
  automatic_failover_enabled   = true
  multi_az_enabled             = true
  
  tags = {
    StampId = var.stamp_id
  }
}

resource "aws_sqs_queue" "stamp_queue" {
  name                      = "stamp-${var.stamp_id}-queue"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 1209600 # 14 days
  receive_wait_time_seconds = 20 # Long polling
  
  tags = {
    StampId = var.stamp_id
  }
}
```

### Capacity Planning Calculation
```javascript
function calculateStampCapacity(config) {
  const {
    tenantsPerStamp = 1000,
    requestsPerSecPerTenant = 5,
    queriesPerRequest = 8,
    latencySLASeconds = 0.2,
    peakMultiplier = 4
  } = config;

  const rpsPerStamp = tenantsPerStamp * requestsPerSecPerTenant * peakMultiplier;
  const qpsDatabase = rpsPerStamp * queriesPerRequest;
  const connectionsRequired = qpsDatabase * latencySLASeconds;
  
  // Storage calculation: initial + growth over 24 months
  const dataPerTenantGB = 50;
  const growthRateMonthly = 0.1;
  const months = 24;
  const storageNeeded = tenantsPerStamp * dataPerTenantGB * Math.pow(1 + growthRateMonthly, months);

  return {
    rpsPerStamp: Math.round(rpsPerStamp),
    qpsDatabase: Math.round(qpsDatabase),
    dbConnectionsNeeded: Math.round(connectionsRequired),
    storageNeededGB: Math.round(storageNeeded),
    costPerMonth: {
      compute: 5000, // Estimate
      database: 3000,
      cache: 1000,
      networking: 500,
      total: 9500
    }
  };
}

console.log(calculateStampCapacity({}));
/* Output:
{
  rpsPerStamp: 20000,
  qpsDatabase: 160000,
  dbConnectionsNeeded: 32000,
  storageNeededGB: 492,
  costPerMonth: { compute: 5000, database: 3000, cache: 1000, networking: 500, total: 9500 }
}
*/
```

---

## 10. Real-World Examples

### Stripe: Payment Processing Stamps
Stripe uses "cells" (stamps) to scale payment processing globally. Each stamp: PostgreSQL clusters, Redis caches, application servers, background processors. ~10,000 merchants per stamp. Stripe sizes stamps on transaction volume (not just merchant count); high-volume merchants (Shopify, Lyft) get dedicated stamps. When stamp approaches 70% capacity, provisions new stamp; new merchants assigned to it. Architecture enables 99.99% uptime while serving millions of businesses. European merchants routed to EU stamps (data never leaves EU). Routing layer: globally distributed mapping with <10ms lookup latency.

### GitHub: Repository Stamps
GitHub partitions infrastructure using stamps where repositories assigned to specific stamps ("repository clusters"). Each stamp: web servers, Git storage, MySQL databases, Redis caches, search indexes. Repositories assigned via consistent hashing on repo ID; very large repos (Linux kernel, Chromium) get dedicated stamps. ~~Interesting~~ Benefits: feature flags per-stamp (test features on subset of repos), discovered Git LFS bug affecting only one stamp (others unaffected). Stamp-level feature flags enabled safe testing. Migration to new datacenter simpler: move one stamp at a time, verify each. Routing: GeoDNS → nearest region + repo-to-stamp mapping in globally replicated MySQL.

### Shopify: Multi-Tenant E-commerce Stamps
Multiple stamps serve thousands of stores per stamp (not millions like Netflix). Each stamp: Rails app servers, MySQL (sharded within stamp), Redis, background job processors. Stores assigned at creation based on capacity. Shopify Plus (enterprise): dedicated stamp instances for guaranteed capacity. Challenge: Black Friday 10-50× traffic spikes concentrated in hours. Solution: Ephemeral stamps deployed week before, handle spike, decommissioned after. Geographic expansion (Australia): stamps in Sydney with in-country data residency. Routing: GeoDNS (region) + store-to-stamp mapping (handles 1M+ lookups/sec during peak). Saved millions vs. over-provisioning globally year-round.

---

## 11. Interview Cheat Sheet

| Question | Answer |
|----------|---------|
| **When use stamps vs. sharding** | Stamps replicate entire stack; sharding partitions data. Stamps for tenant isolation; sharding for data scaling. |
| **Stamp sizing** | T × R_tenant × P (tenants × req/sec × peak multiplier) = RPS. Then QPS = RPS × queries/req. DB connections = QPS × Latency. |
| **Cost vs availability** | Large stamps: cost-efficient ($15/tenant) but higher blast radius. Small stamps: better isolation but $20/tenant. Choose based on downtime cost. |
| **Cross-stamp operations** | Use event streaming (Kafka) for global search. Data warehouse for analytics. Distributed user service for auth. Never sync queries in request path. |
| **Tenant migration** | Replicate data to dest → dual-write → swap reads → verify → cleanup. Or accept maintenance window for large tenants. Stripe/GitHub: explicit tool control. |

---

## 12. Red Flags + Keywords/Glossary

### Red Flags
- "All stamps share database for efficiency" — defeats fault isolation; hidden single point of failure
- "Stamps solve all scaling problems" — adds operational complexity; overkill for <100K users
- "We'll query across stamps in real-time" — creates dependencies, defeats isolation; use async patterns
- "Configuration customized per-stamp" — configuration drift; breaks consistency; use infrastructure-as-code

### Glossary
| Term | Definition |
|------|-----------|
| **Scale Unit** | Synonym for stamp; independent application stack copy |
| **Cell** | Stripe's term for stamps |
| **Blast Radius** | Set of users affected when stamp fails |
| **Tenant Assignment** | Process of determining which stamp serves which tenant |
| **Routing Layer** | Global service mapping tenants to stamps |
| **Data Affinity** | Data has "home" region, written/read primarily there |
| **Bounded Capacity** | Explicit limit per stamp (e.g., 10K tenants, 50K rps) |
| **Configuration Drift** | Stamps diverge from template (anti-pattern) |
| **Ephemeral Stamp** | Temporary stamp for testing or peak load; then torn down |
| **Consistent Hashing** | Algorithm for distributing requests across stamps |
| **Geographic Stamps** | Separate stamps per region for low latency + data residency |
