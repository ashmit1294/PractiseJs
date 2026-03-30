# T13 — Database Replication

---

## 1. ELI5

Imagine you have one notebook where you write down every customer order. If that notebook is lost or damaged, you lose everything. Now imagine you have a photocopier: every time you write in the main notebook, the photocopier immediately makes copies and sends them to 3 backup notebooks in different drawers.

- The **original notebook** = primary / master
- The **backup notebooks** = replicas / secondaries / slaves
- The **photocopying process** = replication

Anyone can READ from any notebook (load spread across all). But only the original accepts new WRITES (single source of truth). If the original is lost, you promote a backup to be the new original.

---

## 2. Analogy

**Google Docs with sync:**

You type in the main document (primary). Google instantly syncs your changes to servers in 3 data centers (replicas). Your colleague in Tokyo can read the document from the nearby Tokyo replica (low-latency read). If the main data center loses power, the Tokyo replica is promoted to primary — no data loss because it was in sync.

Sync replication = Google waits for all copies to confirm before showing "Saved"
Async replication = Google shows "Saved" immediately, copies update in the background (rare edge case: if main crashes in that millisecond, last change is lost)

---

## 3. Core Concept

### Master-Slave (Primary-Replica) Replication

```
                    ┌─────────────┐
  All WRITES ──────►│   Primary   │
                    │  (Master)   │
                    └──────┬──────┘
                    WAL/binlog stream
              ┌────────────┴────────────┐
              ▼                         ▼
     ┌────────────────┐       ┌────────────────┐
     │   Replica 1    │       │   Replica 2    │
     │  (Read only)   │       │  (Read only)   │
     └────────────────┘       └────────────────┘
              │
              ▼
     ┌────────────────┐
     │   Replica 3    │   ← can cascade from Replica 1
     │  (Read only)   │      (cascading replication)
     └────────────────┘

Reads scale: sent to any replica
Writes: all go to primary
```

### How the Log Stream Works

```
PostgreSQL WAL (Write-Ahead Log):
  1. Primary writes change to WAL buffer
  2. WAL record: {LSN: 4829301, table: orders, op: INSERT, data: {...}}
  3. Replica's WAL receiver process connects to primary
  4. Streams WAL records in real time (TCP persistent connection)
  5. Replica's WAL applicator replays records to its data files

MySQL Binlog:
  Same concept, different format (statement-based or row-based binlog)
  Row-based = replicates actual row changes (default, safer, larger files)
  Statement-based = replicates SQL statements (compact, but non-deterministic functions risky)

MongoDB Oplog:
  Capped collection on primary storing all write operations
  Secondaries tail the oplog and replay operations
  Same mechanism, different implementation
```

---

## 4. Replication Modes

### Synchronous Replication

```
Client                Primary              Replica
  │                      │                    │
  │──── WRITE ──────────►│                    │
  │                      │──── replicate ────►│
  │                      │◄─── ACK ──────────│
  │◄─── SUCCESS ─────────│                    │
  
  + Write confirmed ONLY after Replica ACKs
  + Zero data loss (RPO = 0)
  + Replica is always consistent with primary
  - +2-10ms latency per write (network round-trip to replica)
  - If replica is slow/down → primary write is blocked or must be reconfigured

Use: financial systems (never lose a transaction); payment writes
```

### Asynchronous Replication

```
Client                Primary              Replica
  │                      │                    │
  │──── WRITE ──────────►│                    │
  │◄─── SUCCESS ─────────│                    │
  │                      │──── replicate ────►│  (happens after)
  
  + Fastest write path — no waiting for replica
  + Replica unavailability doesn't block writes
  - Replication lag: 50-500ms typical; can spike to seconds under load
  - If primary crashes before replica applies: data loss possible (small window)

Use: most OLTP applications; social networks; product catalogs
Typical default: MySQL async replication, PostgreSQL async
```

### Semi-Synchronous Replication (MySQL Default)

```
Wait for at least ONE replica to RECEIVE (write to its relay log) but NOT apply
  → Durable on 2 nodes (primary + 1 replica disk)
  → Not waiting for RAM → disk write = safety net
  → Replica may still lag in applying, but data is not lost
  
  + Better durability than pure async
  - One extra network round-trip vs async
  - If no replica available within timeout → fallback to async automatically
```

### Comparison Table

```
┌────────────────────┬─────────────────┬─────────────────┬──────────────────────┐
│ Mode               │ Write Latency   │ Data Loss Risk  │ Typical Use          │
├────────────────────┼─────────────────┼─────────────────┼──────────────────────┤
│ Synchronous        │ +2-10ms         │ None (RPO=0)    │ Finance, payments    │
│ Asynchronous       │ +0ms            │ Small window    │ Social, catalog, app │
│ Semi-sync (MySQL)  │ +1-3ms          │ Minimal         │ General MySQL OLTP   │
└────────────────────┴─────────────────┴─────────────────┴──────────────────────┘
```

---

## 5. Read Capacity Scaling

$$\text{Read QPS} = \text{base\_QPS} \times (1 + N_{\text{replicas}})$$

```
Example:
  Single DB handles 5,000 reads/sec
  Add 4 replicas: 5,000 × (1 + 4) = 25,000 reads/sec
  
  BUT: writes still bottleneck on single primary
  Write QPS = primary's write capacity only (not scaled by replicas)

Read/write split:
  Application routes to primary or replica based on query type:
  
  // Node.js with pg pool — read/write splitting
  const writePool = new Pool({ host: 'primary.db.internal' });
  const readPool = new Pool({ 
    hosts: ['replica1.db.internal', 'replica2.db.internal'],
    loadBalance: 'round-robin'
  });
  
  // Use writePool for mutations; readPool for reads
  // Caveat: reads after writes may see stale data (replication lag)
```

---

## 6. Replication Lag

```
Replication lag = time between primary write and replica's applied state

Causes:
  1. Network: primary → replica RTT (same DC: 1-2ms; cross-region: 50-200ms)
  2. Replica I/O: slow disk; competition with read queries
  3. Long transactions on primary: replica can't apply until primary commits
  4. Large batch operations: replica serializes what primary ran in parallel

Measuring (PostgreSQL):
  SELECT
    application_name,
    state,
    write_lag,          -- time to write WAL to replica
    flush_lag,          -- time to flush to disk on replica
    replay_lag          -- time to apply to data files
  FROM pg_stat_replication;

Impact on reads:
  User posts comment → reads from replica → comment missing (lag < 500ms)
  
Solutions:
  a. Read from primary after write (sticky reads): route same user to primary for 1 second
  b. Wait-on-read: check replica LSN matches primary LSN before reading (sync point)
  c. Accept eventual consistency (most social apps do)
  d. SLA: remove replica from pool if lag > threshold (Instagram: lag > 1 second → remove)
```

---

## 7. Failover Process

```
Normal state:
  Primary ── WAL stream ──► Replica 1 (sync, hot standby)
                          ► Replica 2 (async)
                          ► Replica 3 (async)

Primary failure detected (health check times out × 3):
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 1: Select best replica                                     │
  │   Pick replica with highest LSN (most up-to-date WAL position) │
  │   If sync replica: LSN matches primary → promote immediately   │
  │   If async: there may be a small gap (data loss window)        │
  │                                                                 │
  │ Step 2: Fence the old primary (prevent split-brain)            │
  │   STONITH: Shoot The Other Node In The Head                    │
  │   Power off / block network / send SIGKILL                     │
  │   Prevents old primary from accepting stale writes             │
  │                                                                 │
  │ Step 3: Promote selected replica to new primary                │
  │   PostgreSQL: pg_ctl promote                                   │
  │   Now accepts writes                                           │
  │                                                                 │
  │ Step 4: Update DNS/proxy                                       │
  │   HAProxy / AWS Route53 / PgBouncer updated                    │
  │   Applications reconnect to new primary                        │
  │                                                                 │
  │ Step 5: Reconfigure remaining replicas                         │
  │   Point to new primary, re-sync from new primary's WAL         │
  └─────────────────────────────────────────────────────────────────┘
  
Timeline: 10-30 seconds typical for automated failover
          Planned switchover: 0-5 seconds (graceful) 
          
Tools: Patroni (PostgreSQL), Orchestrator (MySQL), Atlas (MongoDB)
```

### Split-Brain and STONITH

```
Split-brain: both old primary AND new primary accept writes simultaneously
             → two sources of truth → data divergence → disaster

Prevention:
  1. STONITH (Shoot The Other Node In The Head):
     - When failover triggers, FIRST power off or network-isolate old primary
     - Only then promote replica
     - Ensures only 1 primary ever accepts writes
     
  2. Lease/epoch mechanism:
     - Primary holds a distributed lease (Zookeeper/etcd)
     - Lease expires automatically if primary doesn't renew
     - New primary obtains new lease before accepting writes
     - Old primary cannot renew → stops accepting writes
     
  3. Quorum-based writes:
     - Write only proceeds if majority of nodes ACK
     - If isolated node can't reach majority → refuses writes
```

---

## 8. Cascading Replication

```
Why: Primary can only handle so many streaming connections
     100 replicas × WAL stream = significant CPU overhead on primary

Solution: intermediate replication hubs

  Primary
    │
    ├──► Replica Group A (hub)
    │         ├──► Replica A1
    │         ├──► Replica A2
    │         └──► Replica A3
    │
    └──► Replica Group B (hub)
              ├──► Replica B1
              ├──► Replica B2
              └──► Replica B3

Primary → 2 connections only
Each hub → 3 connections
Total: 6 replicas, 2 primary connections

Lag: each hop adds ~1-2ms additional lag
Instagram used cascading for 10+ read replicas with limited primary CPU impact
```

---

## 9. Master-Master Replication (Multi-Primary)

```
                ┌──────────┐     bidirectional replication     ┌──────────┐
  Writes ──────►│ Primary 1│◄──────────────────────────────────►│ Primary 2│◄──── Writes
                └──────────┘                                    └──────────┘

Both nodes accept writes — appears to solve write scaling.

The conflict problem:
  User A (on P1): UPDATE balance SET amount = 100 WHERE user_id = 5
  User B (on P2): UPDATE balance SET amount = 50  WHERE user_id = 5
  → Both commit locally → which wins? → CONFLICT
  
Resolution options (all bad):
  Last-write-wins: whoever committed later wins → arbitrary based on clock skew
  Merge: application-defined merge → only works for CRDTs (counters, sets)
  Manual: surface conflict to application → extremely complex
  
Outcome: extremely complex, error-prone; not recommended for RDBMS
Use cases:
  ✅ Geographic active-active (write to local region; eventual sync; last-write-wins)
  ✅ NoSQL that supports conflict-free data types (DynamoDB, Cassandra)
  ❌ Financial ledgers, inventory, any system requiring strict consistency
```

---

## 10. MERN Dev Notes

### Node.js — Mongoose + Read Replicas

```javascript
// Connect to replica set — Mongoose handles replica set automatically
mongoose.connect('mongodb://primary:27017,replica1:27017,replica2:27017/mydb', {
  replicaSet: 'rs0',
  readPreference: 'secondaryPreferred'  // reads go to replica when available
});

// Per-query read preference for read-after-write consistency
const user = await User.findById(userId)
  .read('primary');  // force read from primary after write

// Pattern for read-after-write in API:
app.post('/api/profile', async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: req.body },
    { new: true }
  ).read('primary');  // must read from primary to see just-committed write
  
  res.json(user);
});

// Reads that don't need freshness:
app.get('/api/products', async (req, res) => {
  const products = await Product.find({ active: true })
    .read('secondaryPreferred');  // replica read = lower latency, cheaper
  res.json(products);
});

// Monitor replication lag in MongoDB:
// rs.printSlaveReplicationInfo() or db.adminCommand({ replSetGetStatus: 1 })
```

---

## 11. Real-World Case Studies

### Instagram — 10+ Replicas, Cascading, Async

```
Scale: 2B users; billions of reads/day; heavily read-skewed (100:1 read/write)

Architecture:
  1 Primary PostgreSQL → 3 primary replicas (hot standby, promoted on failure)
                       → each primary replica → 3-4 secondary replicas
  Total: 12-15 read replicas per major DB shard

Mode: Async by default
  → Replication lag SLA: remove replica from pool if lag > 1 second
  → Django ORM read/write splitting: reads → replica pool; writes → primary
  
Failover: Patroni (Python-based Postgres HA)
  → Automated: health check every 2 seconds; failover in < 30 seconds
  → Fencing: STONITH + Consul for distributed lease

Cascading for scale:
  3 primary replica streams from master (not 15)
  Each primary replica serves 4 secondaries
  → Consistent lag even at large fanout
```

### Dropbox — Regional Replicas, Semi-Sync

```
Challenge: cross-region durability without high write latency

Architecture:
  US primary → semi-sync to 1 US secondary (same DC)
             → async to EU replica  
             → async to APAC replica

Logic:
  Semi-sync to US secondary: ensures data on 2 disks in same DC before ACK
  → Extra latency: +1-2ms (same DC round-trip)
  → Data loss protection: primary dies → US secondary takes over with no data loss
  
  EU/APAC async: best-effort (acceptable 50-200ms lag for cross-region)
  Users in EU read from EU replica (low latency) — slight staleness acceptable

Outcome: RPO = 0 for DC-level failure (semi-sync US secondary);
         latency impact < 2ms for writers
```

### GitHub — Lag-Aware Proxy + 2018 Incident

```
Normal architecture:
  Spokes (primary) → 5 GitHub replicas (async) → Octopus proxy
  Octopus proxy: monitors lag, routes reads to any replica with lag < 100ms
  
2018 incident (45 minutes of degraded service):
  Network partition between US East data centers
  Automated failover promoted a lagging replica to primary
  Lag at time of promotion: ~40 minutes of unapplied data
  Result: internal tools read from new primary; users saw missing data
  
Root cause: automated failover didn't fence old primary fast enough
           New primary was missing 40 minutes of writes

Lesson: 
  Never automate failover without consulting humans for large lag gaps
  GitHub added: "lag budget" check — failover pauses and pages on-call
                if replica lag > 30 seconds before promotion
  
  Rule: automated failover is safe; automated failover of lagging replicas → NOT safe
```

---

## 12. Interview Cheat Sheet

**Q: What is database replication and why use it?**
> Replication continuously copies data from a primary to one or more replicas. Benefits: (1) Read scale — replicas handle read traffic; (2) High availability — replica promotes to primary on failure; (3) Geographic distribution — regional replicas reduce read latency; (4) Disaster recovery — replica in separate DC survives data-center failure.

**Q: What is replication lag and how do you handle it?**
> Replication lag is the delay between a write committing on the primary and being applied on a replica. Typical: 50-500ms async, 0 sync. Mitigations: (1) Sticky reads — route same user to primary for short window after write; (2) Read from primary for critical read-after-write paths; (3) Monitor lag and remove slow replicas from pool; (4) Accept eventual consistency where appropriate (social feeds don't need perfect consistency).

**Q: What is split-brain and how do you prevent it?**
> Split-brain is when two nodes both believe they are primary and accept writes simultaneously, creating two divergent data versions. Prevention: (1) STONITH — fence (power off/isolate) the old primary BEFORE promoting the new one; (2) Distributed leases (etcd/Zookeeper) — primary must hold a lease to accept writes; expired lease = no writes accepted; (3) Quorum writes — write rejected if node can't reach a majority.

**Q: Sync vs async replication trade-off?**
> Sync: wait for replica ACK before confirming write → zero data loss, +2-10ms latency, replica slowness blocks writes. Async: confirm immediately, replicate in background → fastest writes, small data-loss window if primary crashes. Semi-sync: wait for replica to RECEIVE (not apply) → good durability/latency middle ground (MySQL default).

---

## 13. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Primary / Master** | The node that accepts writes; source of truth |
| **Replica / Secondary / Slave** | Read-only copy that receives WAL stream from primary |
| **WAL** | Write-Ahead Log — stream of changes replicated from primary |
| **Binlog** | MySQL's equivalent of WAL; row-based or statement-based |
| **Oplog** | MongoDB's capped collection of write operations for replication |
| **LSN** | Log Sequence Number — monotonic position in WAL stream |
| **Replication Lag** | Delay between primary write and replica applying it |
| **Sync Replication** | Write confirmed only after replica ACKs; RPO = 0 |
| **Async Replication** | Write confirmed immediately; replica catches up later |
| **Semi-sync** | Wait for replica to RECEIVE (not apply) the change |
| **Failover** | Promoting a replica to primary when primary fails |
| **Split-Brain** | Two nodes both believe they are primary — catastrophic |
| **STONITH** | Shoot The Other Node In The Head — fencing mechanism |
| **Cascading Replication** | Replica replicates to further replicas (reduces primary load) |
| **RPO** | Recovery Point Objective — max acceptable data loss (sync = RPO 0) |
| **RTO** | Recovery Time Objective — max acceptable downtime during failover |
| **Read/Write Split** | Application routes writes to primary, reads to replicas |
| **Hot Standby** | Replica that serves read queries while staying in sync |
| **Patroni** | Python HA tool for PostgreSQL automated failover |
