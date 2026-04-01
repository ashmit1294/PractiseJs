# T12 — Data Management Patterns in Cloud Architecture: Overview

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/data-management-overview

---

## ELI5 (Explain Like I'm 5)

Imagine a giant library with millions of books. You need to decide: where to put the books so people can find them fast (storage), which librarians handle new books vs. who helps readers find books (access), and how many backup copies to keep so the library never runs out (consistency/replication).

Data management patterns are the rules for building that library for your software — how to store data, how to access it efficiently, and how to keep multiple copies synchronized.

---

## Analogy

**Restaurant operations**: The kitchen (write side) prepares food fresh; the display menu (read side) shows pre-printed items fast. The food inventory (storage) tracks what's available. The cashier (consistency) ensures what you ordered matches what's in stock. Each area is optimized differently — it would be chaotic if the cashier had to look in the kitchen for every price check.

---

## Core Concept

Data management patterns address how distributed systems **store, access, and maintain data** across multiple nodes while balancing three competing forces:

- **Consistency** — all nodes see the same data at the same time
- **Availability** — the system responds even during failures  
- **Performance** — reads and writes are fast at scale

**The CAP theorem** (pick 2 of 3: Consistency, Availability, Partition tolerance) constrains every pattern decision. For distributed systems, network partitions are inevitable — so the real trade-off is **CP** (consistent, may be temporarily unavailable) vs **AP** (always available, may be temporarily inconsistent).

---

## Pattern Taxonomy Diagram

```
Data Management Patterns
├── ACCESS PATTERNS (how data flows)
│   ├── CQRS — Separate read/write models (different schemas, different DBs)
│   ├── Cache-Aside — Lazy loading; app checks cache first, DB on miss
│   └── Materialized Views — Pre-computed aggregations stored as tables
│
├── CONSISTENCY PATTERNS (how data synchronizes)
│   ├── Strong Consistency (CP) — Every read reflects latest write
│   │   └── Use for: bank balances, inventory reservations
│   ├── Eventual Consistency (AP) — Replicas catch up asynchronously
│   │   └── Use for: social likes, feed counts, shopping cart
│   └── Causal Consistency — Cause-effect ordering preserved
│
└── STORAGE PATTERNS (physical organization)
    ├── Event Sourcing — Store events (history), derive current state
    ├── Sharding — Horizontal partitioning across multiple nodes
    └── Replication — Copy data to multiple nodes for HA/read scale
```

---

## Pattern Selection Matrix

| Workload | Consistency | Best Patterns |
|----------|-------------|---------------|
| Read-heavy (90%+ reads) | Eventual OK | Cache-Aside, Materialized Views, CQRS async projections, CDN |
| Read-heavy (90%+ reads) | Strong required | Read replicas + CQRS sync projections |
| Write-heavy (IOT, logs) | Eventual OK | Event Sourcing, Write-Behind cache, Async replication |
| Write-heavy | Strong required | Sharding (single-leader per shard), synchronous replication |
| Complex queries (analytics) | Eventual OK | CQRS + separate OLAP store, Materialized Views |
| Financial transactions | Strong required | Synchronous replication, avoid async patterns entirely |

**Decision flow**:
1. What's the read:write ratio? → determines whether to optimize reads or writes
2. Can you tolerate stale data? → determines consistency model
3. What's the query complexity? → determines whether to pre-compute or query dynamically

---

## Key Areas

### 1. Access Pattern Optimization
Read-heavy systems benefit from caching and denormalized read models. Write-heavy systems need append-optimized storage. Complex queries need pre-aggregated materialized views or separate OLAP stores.

**CQRS formalizes this**: writes go to normalized transactional store, reads come from denormalized projections. Uber's trip data: writes update the authoritative trip record; rider/driver apps read from separate views.

### 2. Consistency Models
- **Linearizability (strong)**: every read sees the latest write — requires coordination; limits throughput
- **Eventual consistency**: replicas temporarily diverge, converge later — Instagram likes (99 vs 100 = fine)
- **Read-your-writes**: you always see your own updates — user submits form, immediately sees confirmation
- **Causal consistency**: if A caused B, all nodes see A before B — document editing

### 3. Data Partitioning
- **Range sharding** (user ID 1-1,000 = shard 1): enables range queries but risks hotspots
- **Hash sharding**: distributes evenly but complicates range queries
- Twitter: shards user data by user ID, but celebrity accounts (millions of followers) need special handling

### 4. Event-Driven Data
Events as first-class data: Event Sourcing stores full history of state changes. CQRS often pairs with it — commands generate events → events update write model → projections consume events for read models.

### 5. Caching Strategies
- **Cache-Aside** (lazy loading): populate cache on read miss — simplest, most common
- **Write-Through**: update cache synchronously with writes — consistent but slower writes
- **Write-Behind**: buffer writes in cache, async flush — fast but complex failure modes

---

## How Things Connect

```
┌───────────────────────────────────────────────────────────────┐
│                         CAP Theorem                           │
│  CP (consistent + partition-tolerant)                         │
│    → Use: synchronous replication, distributed transactions   │
│  AP (available + partition-tolerant)                          │
│    → Use: async replication, multi-leader, CRDTs              │
└───────────────────────┬───────────────────────────────────────┘
                        │ constrains
                        ▼
┌───────────────────────────────────────────────────────────────┐
│                    Pattern Interactions                        │
│  CQRS ←→ Event Sourcing: complementary (commands→events→projections)
│  Cache-Aside ←→ Consistency: TTL cache = AP; write-through = CP
│  Sharding ←→ Replication: shard for write scale, replicate for reads
│  Materialized Views ←→ CQRS: MV = database-level CQRS projection
└───────────────────────────────────────────────────────────────┘
```

**Key rule**: caching + strong consistency is hard. If you use lazy cache invalidation (TTL), you implicitly chose AP. If you need strong consistency, you either skip caching or use synchronous write-through.

---

## Real-World Examples

| Company | Architecture | Patterns Used |
|---------|-------------|---------------|
| **Netflix** | Content catalog (230M users) | CQRS (write: master DB → read: Elasticsearch + Cassandra). Event Sourcing for viewing history (play/pause/stop events). EVCache + CDN for caching. Async replication. 90%+ cache hit rate. |
| **Uber** | Trip data | Sharding (by city), Cache-Aside (Redis, 1s TTL for driver locations), Materialized Views (trip history = hourly batch ETL), sync replication for receipts (financial), async for analytics. |
| **Twitter** | Timeline architecture | Evolved: read-time aggregation → write-time fanout (now hybrid). Write-fanout for normal users (Event Sourcing pattern), read-aggregation for celebrities (>1M followers). |
| **Amazon** | DynamoDB / Shopping cart | Eventual consistency: cart uses last-write-wins. Inventory uses optimistic locking. Session data uses write-behind. 20M req/sec, single-digit millisecond latency — explicit AP tradeoff. |
| **Stripe** | Payment processing | CP for authorization (sync replication, NO async cache). CQRS for analytics (transactions → Kafka → analytical DB). Strict CP/AP separation by subdomain. |

---

## Interview Cheat Sheet

### Q: How would you design a system needing both strong consistency writes and high read throughput?
**A:** CQRS: use a strongly-consistent write model (sync replication, no cache in write path). Serve reads from separate read models (read replicas, denormalized projections). The write model is small and CP; the read model scales horizontally as AP. You accept that reads may be slightly stale — the "read your own writes" problem is solved at the UX layer (return write result directly without querying read model).

### Q: When would you choose eventual consistency over strong consistency?
**A:** When data represents opinions/counts rather than facts/balances: social media likes, follower counts, feed positions, shopping cart additions. Business question: "What's the cost of showing a user 99 instead of 100 likes for 500ms?" For likes: zero cost. For bank balance: potential fraud → must be strong.

### Q: What's the difference between CQRS and read replicas?
**A:** Read replicas duplicate the *same* schema. CQRS creates *fundamentally different* data models for reads and writes. A read replica of a normalized orders table still requires JOINs to answer "user's order history." A CQRS read model would have a denormalized `user_order_history` table with everything pre-joined. CQRS enables query-specific schemas, technology (Elasticsearch for search), and independent scaling.

---

## Red Flags to Avoid

- Defaulting to "strong consistency everywhere" without considering the availability trade-off
- Proposing Event Sourcing / CQRS for simple CRUD apps (over-engineering = red flag)
- "We'll use microservices with separate DBs" without explaining consistency across service boundaries
- "Caching solves everything" without explaining invalidation strategy
- Not asking about read/write ratio and consistency requirements before proposing a solution
- Running 5 different database technologies without acknowledging operational complexity

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **CAP Theorem** | Distributed systems can guarantee at most 2 of 3: Consistency, Availability, Partition tolerance |
| **CP System** | Consistent + Partition-tolerant; sacrifices availability during network failures (Google Spanner) |
| **AP System** | Available + Partition-tolerant; sacrifices strong consistency; tolerates temporary divergence (Cassandra, DynamoDB) |
| **Linearizability** | Strongest consistency: every read reflects the most recent write across all nodes |
| **Eventual Consistency** | Replicas temporarily diverge but will converge given no new writes |
| **Read-Your-Writes** | Guarantee that a user sees their own updates immediately, even in eventually-consistent systems |
| **CQRS** | Command Query Responsibility Segregation — separate models for writes (commands) and reads (queries) |
| **Event Sourcing** | Store all state changes as immutable events; derive current state by replaying events |
| **Materialized View** | Pre-computed, stored query result; refreshed periodically or on-demand |
| **Sharding** | Horizontal partitioning: split data across multiple nodes by a shard key |
| **Replication** | Copying data to multiple nodes for availability and/or read scaling |
| **Cache-Aside** | Lazy loading pattern: check cache first; populate from DB on miss |
| **Write-Through** | Update cache synchronously with database writes — stronger consistency |
| **Write-Behind** | Write to cache immediately; async flush to DB — faster writes, complex failure modes |
| **Hotspot** | Single shard or node receiving disproportionate traffic; a sharding anti-pattern |
| **Projection (CQRS)** | Denormalized read model built by consuming write-side events |
