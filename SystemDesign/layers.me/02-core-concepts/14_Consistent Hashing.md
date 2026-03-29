# 14 — Consistent Hashing

> **Source**: https://layrs.me/course/hld/02-core-concepts/consistent-hashing  
> **Level**: Intermediate | **Read time**: ~10 min

---

## TL;DR

Consistent hashing maps both data keys **and** server nodes onto the same circular hash space (0 → 2³²-1). When you add or remove a node, only **K/N** keys need to move — not everything. Virtual nodes (vnodes) solve the load-imbalance problem by giving each physical server multiple positions on the ring.

**One-liner for interviews**: *"Instead of `hash(key) % N` — which breaks when N changes — consistent hashing puts keys and servers on a ring; only the affected segment migrates on topology changes."*

---

## ELI5 — Explain Like I'm 5

Imagine a clock with numbers 0 – 360. Your friends (servers) and your toys (data keys) each get a random number on that clock.

When you want to put a toy away, you walk **clockwise** until you hit a friend — that friend stores the toy.

Now a new friend joins at 180°. **Only the toys between 90° and 180° need to move to the new friend**. All other toys stay exactly where they are.

That's consistent hashing — a **ring** where adding/removing nodes disturbs as little data as possible.

---

## The Analogy — Circular Study Building

Think of consistent hashing like assigning students to study rooms in a **circular building**:

- Each room has a number (0–360°)
- Each student gets assigned based on their student-ID hash
- When you add a new room at 180°, only students between 90° and 180° need to move

Now imagine each room has **100 doors scattered around the building** (virtual nodes). This prevents one room getting all students with IDs 0–180 while another room sits empty.

---

## The Problem With Naive Hashing

```
server = hash(key) % N
```

Works fine — until N changes.

| Scenario | Keys that move |
|---|---|
| Add 1 server to a 10-node cluster (mod 10 → mod 11) | **~91%** of all keys |
| Remove 1 server from a 10-node cluster (mod 10 → mod 9) | **~89%** of all keys |
| Add 1 server with consistent hashing | **~9%** ( = 1/N ) |
| Remove 1 server with consistent hashing | **~9%** ( = 1/N ) |

A cache cluster of 100 servers + naive hashing = **massive cache stampede** on every scale event.

---

## Core Concept — The Hash Ring

The hash ring is a **circular address space** (0 to 2³²-1 = 4,294,967,295). Both server nodes **and** data keys are placed on this ring using the same hash function.

### Step-by-Step

```
Step 1 — Place servers on ring
  hash("ServerA IP") = 100  →  Server A at position 100
  hash("ServerB IP") = 500  →  Server B at position 500
  hash("ServerC IP") = 900  →  Server C at position 900

Step 2 — Store a key
  hash("user:123") = 350
  Walk clockwise from 350 …
  First server hit = Server B (pos 500) → user:123 lives on Server B

Step 3 — Add Server D at position 700
  Only keys in range (500, 700] move from C → D
  Everything else is untouched

Step 4 — Remove Server B (pos 500)
  Keys in range (100, 500] move to Server D (next clockwise)
  Everything else is untouched
```

### ASCII Ring Diagram

```
                    0 / 2³²
                    Server A (100)
                   /
    900 ----------/---------- 100
   Server C      /           Server A
      |         /               |
      |       RING              |
      |         \               |
   500 ----------\---------- 500
   Server B       \
                   \
                    Server B (500)

Key "user:123" hashes to 350 → walks clockwise → hits Server B (500) ✓
Key "user:456" hashes to  50 → walks clockwise → wraps ring → hits Server A (100) ✓
Key "user:789" hashes to 750 → walks clockwise → hits Server C (900) ✓
```

### After Adding Server D (pos 700)

```
Before:                         After:
  A owns: (900–100]               A owns: (900–100]   ✅ unchanged
  B owns: (100–500]               B owns: (100–500]   ✅ unchanged
  C owns: (500–900]               C owns: (700–900]   ⚠️ lost 500–700
                                  D owns: (500–700]   ✨ new keys only

Only keys in the 500–700 band move. ~25% of total if evenly distributed.
With naive mod-N: ~75–91% of all keys would remap.
```

---

## Virtual Nodes — Solving Load Imbalance

### The Problem

Real hash functions are not perfectly uniform for small N. With 3 physical servers you might get:

```
Server A → position    10
Server B → position    50
Server C → position   990
```

Server C owns the band (50 → 990) = **94% of the ring**. This is a hot spot.

### The Solution — Vnodes

Each physical server gets **Q positions** (virtual nodes) scattered uniformly around the ring.

```
Physical Server A → Vnode A-1 (pos 25), A-2 (pos 200), A-3 (pos 400), … A-150
Physical Server B → Vnode B-1 (pos 75), B-2 (pos 300), B-3 (pos 550), … B-150
Physical Server C → Vnode C-1 (pos 125), C-2 (pos 450), C-3 (pos 700), … C-150
```

Result: positions interleave, each server owns many small independent arcs instead of one big arc.

```
Before vnodes (3 arcs)          After 150 vnodes (450 arcs)
B owns 94% → hot spot           Each server: 33% ± 3%  ✓
A owns 4%  → cold               No hot spots            ✓
C owns 2%  → cold
```

**LinkedIn Voldemort research**: 150 vnodes → load variance drops from **40% → under 3%**.  
**Cassandra default**: 256 vnodes per physical node, achieving <5% variance.

---

## Key Principles

| Principle | What It Means |
|---|---|
| **Minimal Redistribution** | Adding/removing 1 node moves only 1/N of keys |
| **Monotonicity** | Keys never move "backwards"; a new node only takes keys from its clockwise neighbor |
| **Load Balance via Vnodes** | 150+ vnodes per server achieves <5% load variance |
| **Replication via Ring Walk** | To replicate: store on the next R distinct physical nodes clockwise |

---

## Math & Formulas

### Keys Moved When Adding a Node

$$\text{Keys moved} = \frac{K}{N + 1}$$

Where K = total keys, N = current node count.

**Example**: 1M keys, 10 nodes → adding 1 node moves 1,000,000/11 ≈ **90,909 keys (9%)**.  
Naive mod-N: 1,000,000 × (10/11) ≈ **909,091 keys (91%)** — 10× worse.

### Load Variance With Q Virtual Nodes

$$\text{Variance} \approx \sqrt{\frac{1}{Q}}$$

| Q (vnodes) | Variance |
|---|---|
| 1  | 100% (naive) |
| 10 | ~31.6% |
| 50 | ~14.1% |
| 150 | ~8.2% |
| 256 | ~6.3% (Cassandra default) |

### Ring Lookup Time

```
Implementation          Lookup       Notes
Sorted array            O(log N)     Binary search — standard choice for <10k nodes
Hash table range map    O(1)         Higher memory; overkill for most systems
Jump Hash               O(1)         Google 2014; only works if node IDs are sequential
```

### Worked Example

> Cluster: 10 servers, 1 million keys, Q = 150 vnodes/server. Add server 11.

```
Keys moved    = 1,000,000 / 11 ≈  90,909  (9%)
Keys per node = 1,000,000 / 11 ≈  90,909
Variance      = sqrt(1/150)    ≈   8.2%
Buffer range  = 90,909 ± 7,454 keys per server    ← acceptable
```

---

## MERN Dev Context — Cassandra & DynamoDB vs MongoDB Sharding

### Cassandra (256 vnodes)

> **MERN dev note — why Cassandra / DynamoDB use consistent hashing, not MongoDB's approach?**
>
> MongoDB shards data using **range-based** or **hashed shard keys** — you manually define a shard key and MongoDB maps ranges to shards. This works well but MongoDB's `mongos` router uses a config server to track chunk ownership; **adding a shard requires a chunk migration process** that can briefly impact write latency.
>
> Cassandra uses **consistent hashing with 256 vnodes by default**. There is no central config server — every node knows the entire ring via the Gossip protocol. Adding a node is **transparent and gradual**: it automatically claims its vnode arcs, data streams in, and the node becomes live with zero downtime. This is why Cassandra is the default for systems that need **horizontal write scaling at millions of events/sec** with no maintenance window.
>
> **Rule of thumb for interviews**:  
> - "Multi-region write-heavy, 1M+ writes/sec, no downtime scaling" → Cassandra / DynamoDB (consistent hashing ring)  
> - "Rich queries, ACID transactions, flexible aggregations, team already on MERN" → MongoDB with hashed shard key on `_id` or a business key

### DynamoDB Partition Key

> **MERN dev note — DynamoDB partition key = consistent hashing under the hood**
>
> When you choose a DynamoDB `partitionKey`, AWS (Amazon Web Services) internally hashes it and maps it onto a consistent hashing ring. You never see the ring, but it's why:
> - Choosing a **high-cardinality partition key** (e.g., `userId`) matters — low cardinality clumps keys on few ring segments
> - Hot partition errors happen when too many requests hash to the same ring segment
>
> In MongoDB this maps to **choosing a shard key with high cardinality** — same reasoning, different implementation.

---

## Implementation Skeleton (JavaScript)

```js
const crypto = require('crypto');

class ConsistentHashRing {
  constructor(vnodes = 150) {
    this.vnodes = vnodes;
    this.ring = new Map();       // position → serverName
    this.sortedKeys = [];        // sorted positions for binary search
  }

  _hash(key) {
    return parseInt(crypto.createHash('md5').update(key).digest('hex').slice(0, 8), 16);
  }

  addServer(name) {
    for (let i = 0; i < this.vnodes; i++) {
      const pos = this._hash(`${name}:vnode:${i}`);
      this.ring.set(pos, name);
      this.sortedKeys.push(pos);
    }
    this.sortedKeys.sort((a, b) => a - b);
  }

  removeServer(name) {
    for (let i = 0; i < this.vnodes; i++) {
      const pos = this._hash(`${name}:vnode:${i}`);
      this.ring.delete(pos);
    }
    this.sortedKeys = this.sortedKeys.filter(k => this.ring.has(k));
  }

  getServer(key) {
    if (this.sortedKeys.length === 0) throw new Error('No servers');
    const hash = this._hash(key);
    // Binary search for first position >= hash
    let lo = 0, hi = this.sortedKeys.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.sortedKeys[mid] < hash) lo = mid + 1;
      else hi = mid;
    }
    // Wrap around: if hash > all positions, take index 0
    const idx = this.sortedKeys[lo] >= hash ? lo : 0;
    return this.ring.get(this.sortedKeys[idx]);
  }
}

// Usage
const ring = new ConsistentHashRing(150);
ring.addServer('cache-1');
ring.addServer('cache-2');
ring.addServer('cache-3');

console.log(ring.getServer('user:123'));   // deterministic server
console.log(ring.getServer('session:abc'));
```

---

## Variants Comparison

| Variant | Positions/server | Lookup | Load balance | Use case |
|---|---|---|---|---|
| **Basic Consistent Hashing** | 1 | O(log N) | Poor (40%+ variance) | Academic examples, early Memcached |
| **Virtual Nodes** | 100–500 | O(log N) | Excellent (<5%) | **Cassandra, DynamoDB, production default** |
| **Bounded Load** | 100–500 | O(log N) | Excellent + max cap | Google Maglev LB, CDN (Content Delivery Network) viral content |
| **Jump Hash** | N/A (sequential IDs) | O(1) | Good | Google internal, stateless LBs |
| **Rendezvous Hashing** | N/A | O(N) | Excellent | Small clusters, K8s consistent routing |

---

## Real-World Examples

### Amazon DynamoDB
- Each partition key is hashed onto a consistent ring
- 100–200 vnodes per physical storage node
- 3 replicas: walk clockwise to find next 2 distinct physical nodes
- Result: millions of req/sec with automatic sharding — customers never manually shard

### Apache Cassandra
- 256 vnodes default; configurable per node
- No central coordinator — Gossip protocol propagates ring state to all nodes
- Adding a node: Cassandra streams the vnode arcs automatically
- Result: linear horizontal scalability, zero-downtime cluster expansion

> **MERN dev note**: Cassandra's gossip-based ring means **no single point of failure in routing**. MongoDB's `mongos` router + config server is more straightforward to operate but adds a routing layer that can become a bottleneck at hundreds of thousands of writes/sec.

### Akamai CDN (Content Delivery Network)
- HTTP request URL hashed → ring position → nearest edge server clockwise
- New edge PoP only affects URLs in that server's ring segment
- Bounded load variant: once a server hits 120% of avg load, overflow to next server
- Result: viral video traffic isolated; other content unaffected

### LinkedIn Voldemort
- Built Dynamo-inspired store for user profiles and social graph
- 150 vnodes/server → variance from 40% (basic) → under 3%
- "Hinted handoff": if a node is down, next ring node stores temporarily; auto-returns on recovery

### Redis Cluster
- Uses **16,384 hash slots** (a finite-ring variant) instead of 2³² ring
- `CRC16(key) % 16384` → slot → node assignment
- Virtual-node equivalent: multiple slots per node
- Difference from classic consistent hashing: redistribution is slot-granular, not key-granular

---

## Interview Cheat Sheet

### The Core Trade-Off Table

| Aspect | Naive `hash % N` | Consistent Hashing |
|---|---|---|
| Keys moved on node add | ~(N-1)/N ≈ 91% | 1/N ≈ 9% |
| Keys moved on node remove | ~(N-1)/N ≈ 89% | 1/N ≈ 9% |
| Load balance (no vnodes) | Perfect (math) | Poor (hash function gaps) |
| Load balance (with vnodes) | N/A | Excellent <5% variance |
| Routing complexity | Trivial modulo | Binary search O(log N) |
| Scale-out downtime | High (stampede) | Zero (gradual migration) |

### Common Interview Questions & Answers

**Q: "How would you distribute 1 million cache keys across 100 servers?"**  
A: Consistent hashing with 150 vnodes/server. On any topology change, only K/N ≈ 1% of keys migrate. Naive mod-N would move 99%.

**Q: "What happens when you add a server?"**  
A: Hash the new server ID(s) onto the ring at Q positions. Each vnode position takes keys from its clockwise neighbor only. Total keys moved ≈ K/(N+1).

**Q: "Why not just use mod N?"**  
A: Changing N causes nearly all keys to remap → cache miss storm / massive DB migration.

**Q: "How do you ensure even load distribution?"**  
A: Virtual nodes. Q = 150 gives <8.2% variance; Q = 256 (Cassandra) gives <6.3%.

**Q: "One server is 2× more powerful than others?"**  
A: Weighted consistent hashing — assign 2× more vnodes to the powerful server.

**Q: "How does replication work?"**  
A: After finding the primary server (first clockwise), continue walking to find R-1 more **distinct physical nodes** (skip vnodes belonging to the same physical server).

### Red Flags to Avoid

- Saying "all keys move when a node is added" — that's naive hashing, not consistent hashing
- Not mentioning virtual nodes when asked about load balancing
- Implementing O(N) linear scan instead of O(log N) binary search
- Forgetting to handle ring wrap-around (key hash > max server position → wrap to first)
- Finding only 1 server instead of R servers for replication

---

## Related Concepts

| Concept | Why it connects |
|---|---|
| **CAP Theorem** | Consistent hashing gives each key a deterministic home → availability during partitions |
| **Replication** | The ring walk naturally extends to multi-replica placement |
| **Bloom Filters** | Often co-located in Cassandra/DynamoDB nodes to skip disk reads for absent keys |
| **Load Balancing** | Bounded-load consistent hashing used in Google Maglev and CDN (Content Delivery Network) routing |
| **Database Sharding** | Consistent hashing is one of two standard sharding strategies (the other: range-based) |

---

## Key Takeaways

1. **Minimal redistribution**: adding/removing 1 node moves only K/N keys (not all of them)
2. **Hash ring**: both keys and servers hash to positions 0 → 2³²-1; each key belongs to the first server clockwise
3. **Virtual nodes**: 150–256 vnodes per physical server reduces load variance to <5–8%
4. **O(log N) lookup**: store ring positions in a sorted array; binary search to find the first position ≥ key hash
5. **Replication**: walk clockwise from primary to find R-1 additional distinct physical nodes
6. **Real systems**: DynamoDB partition keys, Cassandra vnodes (256), Redis Cluster (16,384 slots), Akamai CDN (Content Delivery Network) routing

---

## Keywords

`consistent hashing` · `hash ring` · `virtual nodes` · `vnodes` · `minimal redistribution` · `K/N` · `load variance` · `binary search ring` · `ring wrap-around` · `DynamoDB partition key` · `Cassandra 256 vnodes` · `Redis Cluster hash slots` · `Akamai CDN (Content Delivery Network)` · `hinted handoff` · `weighted consistent hashing` · `bounded load` · `jump hash` · `rendezvous hashing` · `horizontal scaling` · `cache stampede`
