# Pattern 07 — Distributed Cache (Redis / Memcached)

---

## ELI5 — What Is This?

> Every time you ask "what is 99 × 99?" your brain calculates it.
> But after the first time, you just remember the answer — 9801.
> You cached it. A distributed cache is millions of such remembered answers
> shared across many servers so the database never has to answer the same question twice.

---

## Glossary

| Word | ELI5 Meaning |
|---|---|
| **Cache** | A fast temporary storage that holds the answer to a recent question so you do not have to re-compute it or re-fetch it from the slow database. |
| **TTL (Time To Live)** | An expiry date on a cached answer. After 1 hour the sticky note is thrown away and the next request fetches fresh from the database. Like milk with a best-before date. |
| **Cache Miss** | The sticky note is not on the board. You have to go to the filing cabinet (DB), get the answer, and put a new sticky note up. |
| **Cache Hit** | The sticky note is there. Answer in under 1ms. |
| **LRU (Least Recently Used)** | When the board is full, remove the sticky note that has not been looked at the longest. Like clearing your desk — toss what you haven't touched in months. |
| **LFU (Least Frequently Used)** | When full, remove the note that was looked at the fewest times. Keeps popular notes even if not looked at recently. |
| **Cache-Aside** | App checks cache first. If miss, fetches from DB, writes to cache, returns result. The app drives the cache. Most common pattern. |
| **Write-Through** | Every DB write also writes to cache. Cache is always current. Slower writes but always consistent. |
| **Write-Behind** | Write to cache only, write to DB later asynchronously. Fastest writes, risk of data loss if cache dies. |
| **Thundering Herd** | Many requests all miss the cache at the same moment and hammer the database simultaneously. Like hundreds of people knocking on a door at once. |
| **Cache Stampede** | Same as thundering herd but specifically when a popular item's TTL expires and everyone tries to rebuild it at the same time. |
| **Mutex** | A lock that only one person can hold at a time. In cache context: only one thread rebuilds the cache entry while others wait or serve stale data. |
| **Redis Sentinel** | A monitoring system that watches Redis and automatically promotes a replica to primary if the primary dies. |
| **Redis Cluster** | Splits data across multiple Redis nodes (shards). Each node owns a portion of the 16384 hash slots. |
| **Hash Slot** | Redis Cluster divides all possible keys into 16384 buckets. Each bucket is assigned to a node. Your key's bucket is calculated by running a math function (CRC16) on the key name. |

---

## Component Diagram

```mermaid
graph TB
    subgraph APPS["Application Services"]
        SVC1["User Service"]
        SVC2["Product Service"]
        SVC3["Feed Service"]
    end

    subgraph L1["L1 — Local In-Process Cache — per server, sub-millisecond"]
        LC["Caffeine or node-lru-cache — 100MB per server, fastest possible"]
    end

    subgraph L2["L2 — Distributed Cache — shared across all servers, ~1ms"]
        R1["Redis Node 1"]
        R2["Redis Node 2"]
        R3["Redis Node 3"]
        SENTINEL["Redis Sentinel — monitors all nodes, triggers failover automatically"]
    end

    subgraph DB["Source of Truth — slowest, most reliable"]
        PG["PostgreSQL or MongoDB — always has the correct answer"]
    end

    SVC1 & SVC2 & SVC3 --> LC
    LC -- L1 miss --> R1 & R2 & R3
    R1 & R2 & R3 -- L2 miss --> PG
    SENTINEL --> R1 & R2 & R3
```

---

## Cache Patterns Compared

```mermaid
flowchart LR
    subgraph ASIDE["Cache-Aside"]
        A1["Read: check cache"] --> A2{"Hit?"}
        A2 -- yes --> A3["Return cached"]
        A2 -- no --> A4["Read from DB"] --> A5["Write to cache with TTL"] --> A6["Return result"]
        B1["Write: update DB"] --> B2["Delete old cache entry"]
    end

    subgraph THROUGH["Write-Through"]
        C1["Write: update cache"] --> C2["Cache writes to DB synchronously"]
        C3["Both always in sync — slower writes"]
    end

    subgraph BEHIND["Write-Behind"]
        D1["Write: update cache only"] --> D2["Queue DB write for later"]
        D3["Fastest writes — risk: cache crash before DB write = data lost"]
    end
```

---

## Request Flow — Cache-Aside Pattern

```mermaid
sequenceDiagram
    participant SVC as Application Service
    participant Cache as Redis
    participant DB as PostgreSQL

    SVC->>Cache: GET user:123
    alt Cache Hit
        Cache-->>SVC: user object  served in under 1ms
    else Cache Miss
        Cache-->>SVC: null
        SVC->>DB: SELECT * FROM users WHERE id=123
        DB-->>SVC: user row
        SVC->>Cache: SET user:123 serialised-user  EX 3600
        Cache-->>SVC: OK
        SVC-->>SVC: serve user object
    end

    Note over SVC,DB: When user is updated
    SVC->>DB: UPDATE users SET name=Alice WHERE id=123
    DB-->>SVC: updated
    SVC->>Cache: DEL user:123
    Cache-->>SVC: OK  cache invalidated
    Note over SVC,DB: Next read will miss and fetch fresh from DB
```

---

## Bottlenecks — Every Point Explained

| # | Bottleneck | Why It Hurts | Fix |
|---|---|---|---|
| 1 | **Thundering Herd** | A popular cache entry expires at 14:00:00 exactly. 50,000 requests per second all miss at the same moment and hit the database. DB gets 50,000 queries in a 100ms window — it collapses. | Jitter the TTL: instead of exact 3600 seconds, use 3600 + random(0, 300). Entries expire at different times. |
| 2 | **Hot Key** | A celebrity's profile is fetched millions of times per second. All requests hash to the same Redis slot on the same node. That single node's CPU hits 100%. | Replicate the hot key: store as `user:123:copy1`, `user:123:copy2`... on different nodes. Client reads from a random copy. |
| 3 | **Cache Stampede** | A popular product page takes 500ms to compute from the database. While one thread is rebuilding it, 999 other threads also detect a miss and also start rebuilding — 1000 identical DB queries. | Mutex lock: first thread acquires lock and rebuilds. Others see the lock and either wait or serve the stale (slightly outdated) version for 500ms. |
| 4 | **Memory Pressure** | Cache is full. Redis starts evicting entries aggressively. Hot data gets evicted. Cache hit rate drops from 95% to 60%. DB sees a sudden 10x load spike. | Monitor Redis memory. Alert at 80% usage. Scale vertically or add cluster shards. Use LFU eviction to keep truly popular items. |
| 5 | **Consistency** | DB is updated. Cache is not invalidated (code bug or race condition). Users read stale data for up to the TTL duration. | Always explicitly DELETE the cache key on any write. Do not rely solely on TTL for correctness. |

---

## What Happens When Each Part Fails?

```mermaid
flowchart TD
    F1["Redis Primary Node Crashes"]
    F2["Application Cannot Reach Redis Network Partition"]
    F3["Cache Holds Wrong Data Bugs or Race Condition"]
    F4["Redis Memory Full OOM Error"]
    F5["Cascading Failure Cache Down Then DB Collapses"]

    F1 --> R1["Redis Sentinel detects failure via heartbeat in 10-30 seconds.
    Sentinel votes among itself and promotes the replica with most recent data.
    During those 10-30 seconds every request misses cache and goes to DB.
    If DB is not sized for this traffic it may overload.
    Prevention: DB must be able to handle 2-3x normal traffic for short periods.
    Redis Cluster handles this faster — under 1 second automatic failover."]

    F2 --> R2["Circuit breaker opens after 5 consecutive Redis failures.
    Application falls back to reading directly from DB.
    Local L1 cache absorbs some traffic.
    Latency spikes from under 1ms to 5-10ms.
    Application logs a warning and ops is alerted.
    When Redis becomes reachable again, circuit breaker half-opens, tests with one request,
    then fully reopens."]

    F3 --> R3["Explicitly DEL the key using admin tooling.
    Next read fetches fresh from DB and re-populates cache.
    To prevent recurrence: version your cache keys.
    Example: user:123:v2 after a schema change.
    When you deploy, bump the version prefix — old stale v1 keys are automatically ignored."]

    F4 --> R4["Redis OOM — new writes are rejected or old entries evicted unexpectedly.
    Cache hit rate drops, DB load spikes.
    Immediate fix: FLUSHDB with caution to clear cache and let it rebuild,
    or increase Redis maxmemory config.
    Long term: add more Redis nodes to the cluster, distribute the keyspace further."]

    F5 --> R5["This is the most dangerous scenario.
    Cache dies. All traffic hits DB. DB overloads. Services start timing out.
    Everything falls over — cascade.
    Prevention layers:
    1. DB connection pool has a hard max size. Requests queue rather than open infinite connections.
    2. Load shedding: return HTTP 503 for non-critical requests when DB queue is full.
    3. Gradually restore: re-enable cache first, let hit rate climb back, then ease load.
    4. Circuit breakers on every DB caller prevent runaway retry storms."]
```

---

## Cache Sizing Formula

> **Rule of thumb:** Top 20% of your data handles 80% of your reads.
> Cache just that 20%.
>
> `Cache size = total data size × 0.20`
>
> Example: 10 million user profiles × 1 KB each = 10 GB total.
> Cache = 10 GB × 0.20 = **2 GB Redis** handles 80% of reads.

---

## Key Numbers

| Metric | Value |
|---|---|
| Redis single-node throughput | ~1 million ops/second |
| Redis GET latency | Under 1ms (P99) |
| Cache hit rate target | 95%+ |
| Thundering herd TTL jitter | 0 to 300 seconds random |
| Redis Sentinel failover time | 10-30 seconds |
| Redis Cluster failover time | Under 1 second |
