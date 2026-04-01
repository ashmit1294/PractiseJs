# T08 — High Availability: Design for 99.99% Uptime

## 1. ELI5 (Explain Like I'm 5)
Imagine your favourite toy breaks. You cry because you can't play. But what if your parents bought you TWO of the same toy? If one breaks, you grab the second one and keep playing — it doesn't matter that one broke! **High Availability** is designing your computer systems so there's always a second (or third) copy ready to take over if one part breaks. The goal isn't "never break" — it's "keep working even when something breaks."

---

## 2. Analogy
Think of high availability like a **hospital's emergency power system**. When the main power grid fails, backup generators kick in automatically so life-support machines never stop. The hospital doesn't need 100% perfect power — that's impossible — but it needs enough redundancy that patients never notice an outage. Similarly, HA systems use redundant components and automatic failover so users experience continuous service even when individual servers crash. Just as hospitals balance generator costs against criticality (ICU gets triple redundancy, storage closets don't), you balance HA investment against business impact.

---

## 3. Core Concept

**High Availability (HA)** is the practice of designing systems to remain operational and accessible even when components fail. It's measured in "nines" and achieved through redundancy, failover mechanisms, and eliminating single points of failure.

HA differs fundamentally from:
- **Disaster Recovery**: focuses on recovering from catastrophic failures over hours/days; HA operates at seconds-to-minutes scale
- **Fault Tolerance**: aims for zero downtime (99.999%+); HA accepts brief interruptions (99.9–99.99%)
- **Reliability**: focuses on correctness; HA focuses on uptime

```
The "Nines" Table (Annual Downtime):
┌──────────────┬───────────────────────────────┐
│ Availability │ Annual Downtime               │
├──────────────┼───────────────────────────────┤
│ 90%          │ 36.5 days                     │
│ 99%          │ 3.65 days                     │
│ 99.9%        │ 8.76 hours                    │
│ 99.99%       │ 52.6 minutes                  │
│ 99.999%      │ 5.26 minutes                  │
│ 99.9999%     │ 31.5 seconds                  │
└──────────────┴───────────────────────────────┘
Each additional nine roughly multiplies cost by 10×
```

---

## 4. ASCII Architecture Diagrams

### HA Architecture Overview
```
Without HA:
┌────────────┐     failure      ┌──────────┐
│   Client   │ ─────────────▶  │  Server  │ ← SPOF
└────────────┘                  └──────────┘
                                    💥 DOWN = OUTAGE

With HA (Active-Active):
                 ┌────────────────┐
                 │  Load Balancer │ (redundant)
                 └───────┬────────┘
              ┌──────────┴──────────┐
              ▼                     ▼
        ┌──────────┐         ┌──────────┐
        │ Server 1 │ Active  │ Server 2 │ Active
        └──────────┘         └──────────┘
              │                     │
        ┌─────▼─────────────────────▼─────┐
        │      Database (Multi-AZ)        │
        │  Primary ←sync→ Standby(AZ-2)  │
        └─────────────────────────────────┘

With HA (Active-Passive):
        ┌──────────┐ ←── all traffic
        │ PRIMARY  │
        └────┬─────┘
             │ sync replication
        ┌────▼─────┐ ←── standby (promoted on failure)
        │ STANDBY  │
        └──────────┘
```

### Availability Math
```
Serial System (dependencies chain): multiply availabilities
  A (99.99%) → B (99.9%) → C (99.95%)
  System = 0.9999 × 0.999 × 0.9995 = 99.84%  ← WORSE than weakest link

Parallel System (redundancy): compound probabilities
  Two servers at 99.9% each:
  System = 1 - (1 - 0.999) × (1 - 0.999)
         = 1 - (0.001 × 0.001)
         = 1 - 0.000001
         = 99.9999%  ← BETTER by 3 nines!

MTBF/MTTR formula:
  Availability = MTBF / (MTBF + MTTR)
  Example: fails once/month (MTBF=720h), 1h to fix → 99.86%
  Path to higher HA: ↑MTBF (fewer failures) OR ↓MTTR (faster recovery)
```

---

## 5. How It Works (Step-by-Step)

**Step 1: Identify Single Points of Failure (SPOFs)**
Map every component: load balancers, app servers, databases, caches, message queues. A single database instance is a classic SPOF. Goal: eliminate or mitigate every SPOF through redundancy.

**Step 2: Implement Redundancy at Each Layer**
- Multiple app servers across availability zones behind a load balancer
- Database replicas across AZs
- Redundant load balancers with failover IPs
- Key principle: failures should be isolated to smallest possible blast radius

**Step 3: Add Health Checks and Monitoring**
Active health checks continuously probe each component (HTTP endpoints, DB connections, cache responsiveness). They test *actual functionality*, not just "is the process running?" A database that accepts connections but can't execute queries is effectively down.

**Step 4: Configure Automatic Failover**
When health checks detect failures, automatically route traffic away—no human intervention. Load balancers stop sending requests to unhealthy servers. Database clients auto-connect to replicas. The failover time (failure detection → recovery) directly impacts your HA SLA.

**Step 5: Implement Graceful Degradation**
Not all failures require complete outage. If recommendation engine crashes → show popular items. If cache is down → query database directly (slower but functional). "Partial availability" is better than hard failure.

**Step 6: Test Failure Scenarios Continuously**
HA only works if failover mechanisms function under pressure. Chaos engineering — randomly kill servers, partition networks, fill disks. Netflix's Chaos Monkey pioneered this. Regular failure testing exposes hidden dependencies and misconfigured health checks.

---

## 6. Variants

### Active-Active (Multi-Master)
- All redundant instances **actively serve traffic simultaneously**
- Load distributed across them; failure → others absorb traffic
- Highest availability and best resource utilization
- Requires distributed consensus / conflict resolution for writes
- Cassandra: active-active replication across datacenters

### Active-Passive (Master-Standby)
- One instance handles all traffic; others remain idle as standbys
- Simpler to reason about; works well for stateful systems
- Wasted capacity + failover time (promotion takes seconds to minutes)
- Classic MySQL replication pattern

### N+1 Redundancy
- Run N instances for load + 1 extra for redundancy
- If any single instance fails, remaining N still handle full capacity
- Only tolerates single failures
- AWS Auto Scaling Groups use this: desired = needed + 1

### Geographic Redundancy (Multi-Region)
- Complete system replicas across geographically distributed regions
- Protects against datacenter fires, natural disasters, regional network outages
- Netflix: three AWS regions (us-east-1, us-west-2, eu-west-1), each handles 100% of global traffic
- Challenge: data consistency across regions

### Availability Zones (Multi-AZ)
- Isolated datacenters within same metropolitan area
- Independent power, cooling, networking but low-latency (<2ms)
- AWS RDS Multi-AZ: synchronous replication, failover in 60-120 seconds
- Default HA pattern: sweet spot of cost vs. reliability

---

## 7. Trade-offs

| Dimension | Trade-off |
|-----------|-----------|
| **Availability vs. Consistency** | CAP theorem: during partitions choose availability (eventual consistency, like DynamoDB) or consistency (reject writes, like traditional RDBMS) |
| **Availability vs. Latency** | Sync replication to 3 AZs adds 2-5ms/write; cross-region adds 50-200ms; more checks = more overhead |
| **Availability vs. Cost** | Each nine multiplies cost ~10×; 99.999% demands multi-region, chaos engineering, dedicated SRE teams |
| **Automation vs. Control** | Auto-failover = fast recovery but misconfigured health checks can cause cascading failures; manual = slower but controlled |
| **Simplicity vs. Resilience** | More redundancy = more components, configs, failure modes; start simple, add complexity when downtime costs justify it |

---

## 8. When to Use / When to Avoid

### Use When:
- User-facing services where downtime = lost revenue (e-commerce, payment processing)
- SLAs require 99.9%+ uptime explicitly
- Single region deployment is inadequate for user geography or compliance
- You have traffic patterns that justify redundancy costs
- Database is a known SPOF in your current architecture

### Avoid (or Scale Back) When:
- Internal admin tools with no SLA requirements
- Development/staging environments where brief outages are acceptable
- Very early-stage product where feature velocity > reliability
- Budget constraints that make full HA infrastructure prohibitive
- System is simple enough that a single, well-monitored instance suffices

---

## 9. MERN Dev Notes

### Node.js/Express HA Setup
```javascript
// health check endpoint (from T05 pattern, applied here)
app.get('/health/ready', async (req, res) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkQueue()
  ]);
  
  const results = {
    status: checks.every(c => c.status === 'fulfilled' && c.value.healthy) ? 'healthy' : 'unhealthy',
    checks: {
      database: checks[0].status === 'fulfilled' ? checks[0].value : { healthy: false, error: checks[0].reason?.message },
      redis:    checks[1].status === 'fulfilled' ? checks[1].value : { healthy: false, error: checks[1].reason?.message },
      queue:    checks[2].status === 'fulfilled' ? checks[2].value : { healthy: false, error: checks[2].reason?.message }
    },
    timestamp: new Date().toISOString()
  };
  
  res.status(results.status === 'healthy' ? 200 : 503).json(results);
});

// availability calculation helper
function calculateAvailability(components) {
  // serial: multiply
  const serial = components.reduce((acc, a) => acc * a, 1);
  
  // parallel: 1 - product of (1 - availability)
  const parallel = 1 - components.reduce((acc, a) => acc * (1 - a), 1);
  
  return { serial, parallel };
}

// Example: Load balancer (99.99%) → App servers in parallel (99.9% each, 2 instances) → DB (99.95%)
const appServerParallel = 1 - (0.001 * 0.001); // 99.9999%
const systemAvailability = 0.9999 * appServerParallel * 0.9995; // ~99.94%
console.log(`System availability: ${(systemAvailability * 100).toFixed(4)}%`);
```

### MongoDB HA with Replica Sets
```javascript
const mongoose = require('mongoose');

// Connect to replica set for HA
mongoose.connect('mongodb://host1:27017,host2:27017,host3:27017/mydb', {
  replicaSet: 'rs0',
  readPreference: 'secondaryPreferred',  // Read from replicas when possible
  w: 'majority',                          // Ensure writes reach majority of nodes
  wtimeoutMS: 5000,                       // Write timeout
  readConcern: { level: 'local' },
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 10000            // Replica set health check frequency
});

// Handle replica set failover events
mongoose.connection.on('reconnected', () => {
  console.log('Reconnected after failover');
});

mongoose.connection.on('disconnected', () => {
  console.log('Disconnected — attempting reconnection');
});
```

### Error Budget Calculation
```javascript
function calculateErrorBudget(slaPercent, periodDays) {
  const downtimeAllowedMinutes = (1 - slaPercent / 100) * periodDays * 24 * 60;
  return {
    sla: `${slaPercent}%`,
    periodDays,
    downtimeAllowedMinutes: Math.round(downtimeAllowedMinutes * 100) / 100,
    downtimeAllowedHours: Math.round(downtimeAllowedMinutes / 60 * 10) / 10
  };
}

console.log(calculateErrorBudget(99.9, 30));   // ~43.2 minutes/month
console.log(calculateErrorBudget(99.99, 30));  // ~4.3 minutes/month
```

---

## 10. Real-World Examples

### Netflix: Multi-Region Active-Active Architecture
- 200M+ subscribers, streams across 190 countries with 99.99% availability
- Every service runs in 3+ AWS availability zones (per region)
- Complete replicas across 3 AWS regions (US-East, US-West, Europe), each handles 100% of global traffic
- **Chaos Monkey**: randomly terminates production instances during business hours, forcing resilient design
- When AWS US-East-1 had major outage in 2021, Netflix users experienced no disruption
- Cassandra: multi-master replication across regions for content metadata (eventual consistency)

### Stripe: Zone-Aware Database Sharding
- Processes billions of dollars in payments with 99.99% availability
- Zone-aware sharding: each shard has primary in one AZ + synchronous replicas in 2 other AZs
- Zone-aware routing: app servers connect to database shards in same AZ (low latency), fail over to other zones when needed
- Read-your-writes consistency guaranteed even during failover

### Amazon Route 53: Shuffle Sharding
- Achieves 100% availability SLA (never had complete outage)
- Shuffle sharding: each customer assigned to random subset of 4 servers from pool of 100
- Probability of 2 customers sharing same 4 servers: ~1 in 3.9 million combinations
- Complete outages mathematically improbable

---

## 11. Interview Cheat Sheet

| Question | Key Points |
|----------|------------|
| Design for 99.99% | Eliminate SPOFs, redundancy across AZs, health checks, automatic failover, canary deployments, provision N-1 capacity |
| HA vs Fault Tolerance | HA: brief interruptions OK, fast recovery; FT: zero interruptions, hot standbys, 3-5× cost |
| Calculate system availability | Serial: multiply all (decreases); Parallel: 1 - product of failures (increases dramatically) |
| Database as SPOF | Managed service (RDS Multi-AZ), synchronous replication, automatic failover, read replicas |
| Test HA setup | Chaos engineering: kill instances, simulate zone failures, exhaust connection pools, automate continuously |

**Key formulas:**
- `Availability = (Total Time - Downtime) / Total Time × 100%`
- `Serial: A_sys = A1 × A2 × A3`
- `Parallel: A_sys = 1 - (1-A1) × (1-A2) × (1-A3)`
- `Availability = MTBF / (MTBF + MTTR)`
- `Error Budget = (1 - SLA_Target) × Period`

---

## 12. Red Flags + Keywords/Glossary

### Red Flags in Interviews
- "We'll achieve 99.999% by adding more servers" — five nines requires multi-region, chaos engineering, dedicated SRE
- "High availability means the system never goes down" — HA accepts brief interruptions, not zero downtime
- "We don't need to test failover because we have redundancy" — untested failover is false security
- "We'll use synchronous replication everywhere" — adds latency, can reduce availability during partitions
- "Health checks return 200 if the process is running" — superficial checks miss real failure modes

### Glossary
| Term | Definition |
|------|-----------|
| SPOF (Single Point of Failure) | Any component whose failure causes complete system outage |
| MTBF (Mean Time Between Failures) | Average time between consecutive failures |
| MTTR (Mean Time To Recovery) | Average time to recover from a failure |
| Error Budget | Allowable downtime given an SLA (1 - SLA%) × period |
| Active-Active | All redundant instances serve traffic simultaneously |
| Active-Passive | One instance serves traffic; others stay on standby |
| N+1 Redundancy | N instances for load + 1 extra for fault tolerance |
| Multi-AZ | Multiple availability zones (isolated datacenters in same metro) |
| Multi-Region | Redundant deployments in geographically separate regions |
| Chaos Engineering | Deliberately injecting failures to test resilience |
| Graceful Degradation | Continuing core functionality when non-critical components fail |
| Shuffle Sharding | Assigning customers to random subsets of servers to limit blast radius |
