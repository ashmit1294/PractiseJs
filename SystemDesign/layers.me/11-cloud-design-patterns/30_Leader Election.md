# Leader Election Pattern: Coordinating Distributed Nodes

**Module**: M11 — Cloud Design Patterns  
**Topic**: T30 of 37  
**Difficulty**: Advanced  
**Read Time**: ~30 min

---

## 1. ELI5 (Explain Like I'm 5)

Imagine your teacher is absent and the class needs to pick one student to be in charge. You hold a vote. Whoever gets the most votes becomes the class leader. If that leader leaves, you hold another quick vote. The key rule: there's always exactly ONE leader at any time — never zero, never two.

**Leader Election** in distributed systems is this classroom vote — multiple computers pick exactly one to be the "boss" for critical tasks. If the boss crashes, survivors automatically pick a new one within seconds.

---

## 2. The Analogy

A **ship's captain election after the captain goes overboard**. The first mate takes charge. But if the first mate and third mate both think they're in charge simultaneously (**split-brain**), they give contradictory orders and the ship crashes. The election protocol guarantees exactly one captain at all times — and the crew doesn't operate without one.

---

## 3. Why This Matters in Interviews

Leader Election is a classic distributed systems question that reveals depth of understanding. It's core to:
- Database replication (MongoDB replica sets, PostgreSQL streaming replication)
- Distributed consensus (Raft, Paxos) 
- Any coordination task: Kafka partition leadership, Kubernetes controller election, ZooKeeper itself

**Red flag detection**: Candidates who say "just use a database flag" don't understand distributed systems. The right answer involves explaining the split-brain problem, quorums, and why you need consensus algorithms.

This topic appears in FAANG interviews, particularly when designing distributed databases, messaging systems, or any system requiring exactly-once execution.

---

## 4. Core Concept

Leader Election is a pattern where **distributed nodes execute a protocol to designate exactly one node as the coordinator (leader) for tasks that require centralized decision-making**. The elected leader handles critical operations (state management, partition assignment, scheduling) while followers process read/non-critical requests.

The fundamental challenge: in a distributed network with unreliable communication, nodes cannot reliably distinguish between "the leader crashed" and "I can't reach the leader" (network partition). This creates the **split-brain problem** — two nodes both believe they are leader simultaneously. Split-brain in a database means inconsistent writes; in a payment system, it means double-charging customers.

The solution: **quorum**. A leader is only valid when supported by `floor(N/2) + 1` nodes (simple majority). In a 5-node cluster, you need 3 votes. If the network splits 3-2, only the partition with 3 nodes can elect a leader. The 2-node partition cannot reach quorum, so it refuses to elect a leader and becomes unavailable. This is the **CAP theorem trade-off**: **choose consistency over availability** during a network partition.

---

## 5. ASCII Diagrams

### Normal Leader Election (5-node cluster)
```
Initial state: No leader
─────────────────────────────
Node A (timeout): "I'm starting election"
  A → B, C, D, E: "Vote for me! My term=1"
  
  B responds: "OK, I vote A (haven't voted term 1)"
  C responds: "OK, I vote A"
  D responds: "OK, I vote A"
  E: [unreachable — crashed]
  
A receives 3 votes (majority of 5): BECOMES LEADER
A → B, C, D: "I am leader for term=1"

┌────────────────────────────────────────────────┐
│  Cluster: A(LEADER), B(follower), C(follower)  │
│           D(follower), E(CRASHED)              │
│  Quorum: 3/5 nodes healthy ✅                  │
└────────────────────────────────────────────────┘
```

### Split-Brain Prevention with Quorum
```
Network partition splits 5 nodes into 3 + 2:

  Partition 1 (3 nodes)     Partition 2 (2 nodes)
  ─────────────────         ─────────────────────
     A, B, C                      D, E
     
     Election timeout              Election timeout
     A gets 3 votes ✅             D gets 2 votes ❌
     A becomes leader              Can't reach quorum!
                                   D stays follower
                                   
  Partition 1: AVAILABLE    Partition 2: UNAVAILABLE
  (can elect, can write)    (refuses operations)

Consistency preserved. No split-brain.
```

### Raft Election Timeline
```
           Node A (Candidate)     Node B (Follower)     Node C (Follower)
Term 1:    Leader ────────────── heartbeat ──────────── heartbeat ─────►
           
Network partition (Leader A unreachable)
           
Term 2:    ...                   [timeout ≥ 150ms]
                                 Start election
                                 Send RequestVote(term=2) ──────────────►
           ...                   receive RequestVote(term=2) ◄───────────
                                 Vote(yes) ────────────────────────────►
                                 receive Vote(yes) ◄────────────────────
                                 Majority reached!
           ...                   B becomes leader ─── AppendEntries ────►
```

### Lease-Based Leader (ZooKeeper Ephemeral Nodes)
```
Leader acquisition:
  Node A: Create /services/db/leader (ephemeral) ─ SUCCESS
  Node B: Create /services/db/leader ─ FAIL (already exists)
  Node C: Create /services/db/leader ─ FAIL (already exists)
  
Leader watch:
  B, C watch /services/db/leader deletion
  
Leader failure:
  Node A crashes → session expires (after 30s) → ephemeral node DELETED
  B, C notified of deletion → both attempt to create new node
  B creates first → B is new leader
  C's creation fails → C is follower
  
Total failover time: session_timeout + election_time = ~35 seconds
```

---

## 6. How It Works — Step by Step

### Raft Election (Most Common Production Algorithm)

**Step 1: Timeout Detection**  
Each follower maintains an election timeout (randomized 150-300ms). When follower doesn't receive heartbeat from the leader, it increments its **term** number and transitions to **candidate** state.

**Step 2: Vote Request**  
Candidate sends `RequestVote(term, lastLogIndex, lastLogTerm)` to all other nodes. The term ensures stale candidates can't win. The lastLogIndex/LastLogTerm ensures only up-to-date candidates win — a node won't vote for a candidate whose log is behind its own.

**Step 3: Vote Collection**  
Each node can vote for only one candidate per term (persist vote to disk to survive crashes). Candidate waits to collect `floor(N/2) + 1` votes. If no majority after timeout, increment term and retry.

**Step 4: Leader Announcement**  
Once candidate reaches quorum, sends `AppendEntries(term, [], ...) ` heartbeat with empty entries — this serves as both leader announcement and log replication initialization.

**Step 5: Leader Responsibilities**  
Leader sends periodic heartbeats (every 50ms). Processes all write requests. Replicates log entries to followers. Committed only when acknowledged by quorum (majority). Followers serve reads (consistency varies by configuration).

**Step 6: Failure Handling**  
If leader fails to send heartbeats, followers time out. With randomized timeouts, one candidate tends to win before others even start (avoids vote splitting). Old leader that was partitioned and returns will discover a higher term number and immediately steps down to follower.

---

## 7. Variants / Types

### 1. Bully Algorithm
Node with highest ID claims leadership. When a node notices leader is missing, broadcasts to all higher-ID nodes. If no response, declares itself leader. If higher-ID node responds, yields.  
**Pros**: Simple to implement and understand  
**Cons**: High message complexity O(n²); high-ID node becomes bottleneck; message storms  
**Use**: Educational; small clusters; not production distributed databases

### 2. Ring Algorithm
Nodes arranged in logical ring. Election message with candidate ID passed around. If received ID is higher than current, forward updated message; else discard. Full loop = highest-ID wins.  
**Pros**: Message efficient O(n) per election  
**Cons**: Ring topology must be maintained; failure of node in ring blocks election  
**Use**: Token ring networks; not widely used in cloud systems

### 3. Raft
Consensus algorithm designed for understandability. Term-based elections with randomized timeouts. Leader replicates log to majority before committing.  
**Pros**: Understandable, proven correct, excellent tooling  
**Cons**: Requires an odd number of nodes for optimal quorum (3, 5, 7...)  
**Use**: etcd, CockroachDB, TiKV, Consul — the industry standard

### 4. Paxos
Original consensus algorithm by Lamport. Two-phase protocol: Prepare (establish ballot) then Accept (distribute value). More complex but highly generalized.  
**Pros**: Proven reliable; highly flexible; powers Google Spanner/Chubby  
**Cons**: Notoriously difficult to implement correctly; many subtle edge cases  
**Use**: Google Chubby (Zookeeper equivalent), Apache Cassandra leader election

### 5. ZooKeeper Ephemeral Nodes
Not an election algorithm itself; an infrastructure. Leader writes ephemeral ZNode. Followers watch for deletion. On deletion, all candidates create node; first writer wins.  
**Pros**: Leverages existing ZK infrastructure; simple client code  
**Cons**: Session timeout delay in detecting failure (typically 10-30s); ZK becomes critical dependency  
**Use**: Kafka controller election, Hadoop NameNode HA, legacy microservices

### 6. Kubernetes Lease API
Kubernetes `coordination.k8s.io/v1 Lease` objects. Leader creates/renews Lease with TTL. Controller Manager, cloud-controller-manager use this.  
**Pros**: Built into Kubernetes; no external dependencies; audit trail  
**Cons**: Only works in Kubernetes environments; API server becomes SPOF for election  
**Use**: All cloud-native Kubernetes controllers; your custom controllers too

---

## 8. Trade-offs

### Availability vs. Consistency During Partition

| | Strict Quorum (default) | Relaxed Quorum |
|---|---|---|
| **Partition behavior** | Minority partition unavailable | Allow writes everywhere |
| **Consistency** | Strong (no split-brain) | Risk concurrent conflicting writes |
| **Example** | Raft default | Multi-primary MySQL (dangerous) |
| **Use** | Financial data, config stores | User preference data (merge conflicts OK) |

### Failover Speed vs. False Positives

| | Short Timeout (1-5s) | Long Timeout (30-60s) |
|---|---|---|
| **Recovery speed** | Fast failover | Slow failover |
| **False elections** | High (slow network = spurious election) | Low |
| **Cluster stability** | Lower | Higher |
| **ZooKeeper default** | — | ~30s |
| **etcd default** | ~5s | — |
| **Use** | Real-time systems | Batch processing, stability critical |

### Number of Nodes

| Cluster Size | Fault Tolerance | Quorum Required | 
|---|---|---|
| 1 | 0 failures | 1 |
| 3 | 1 failure | 2 |
| 5 | 2 failures | 3 |
| 7 | 3 failures | 4 |
| N | floor(N/2) | floor(N/2) + 1 |

**Rule**: Odd number of nodes for maximum fault tolerance per node added. 4-node cluster tolerates 1 failure (same as 3-node) but uses more resources.

---

## 9. When to Use / When to Avoid

### ✅ Use When
- **Exactly-once execution** required: scheduled jobs, partition leadership assignment
- **Coordination** across distributed nodes: config distribution, lock management
- **High availability** with consistency: primary-replica databases
- **Single coordinator** prevents write conflicts: Kafka controller, primary shard assignment

### ❌ Avoid When
- **All-active (multi-leader) acceptable**: many CRDT-based data structures, user presence tracking
- **Database already handles it**: use Postgres primary failover rather than reinventing
- **Single node is sufficient**: don't distribute for distribution's sake
- **Consistency can be relaxed**: use eventual consistency with conflict resolution instead

---

## 10. MERN Dev Notes

### Kubernetes Lease-Based Leader Election (Node.js)

```javascript
// leader-election/k8s-lease.js
const k8s = require('@kubernetes/client-node');

class KubernetesLeaderElector {
  constructor({ namespace, leaseName, identity, leaseDuration = 15, renewDeadline = 10 }) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    this.leaseClient = kc.makeApiClient(k8s.CoordinationV1Api);
    this.namespace = namespace;
    this.leaseName = leaseName;
    this.identity = identity;
    this.leaseDuration = leaseDuration;  // seconds
    this.renewDeadline = renewDeadline;
    this.isLeader = false;
    this.onLeaderCallbacks = [];
    this.onFollowerCallbacks = [];
  }
  
  onBecomeLeader(callback) { this.onLeaderCallbacks.push(callback); }
  onBecomeFollower(callback) { this.onFollowerCallbacks.push(callback); }
  
  async start() {
    while (true) {
      const acquired = await this._tryAcquireLease();
      if (acquired && !this.isLeader) {
        this.isLeader = true;
        console.log(`[${this.identity}] Became leader`);
        this.onLeaderCallbacks.forEach(cb => cb());
        this._startRenewing();
      } else if (!acquired && this.isLeader) {
        this.isLeader = false;
        console.log(`[${this.identity}] Lost leadership`);
        this.onFollowerCallbacks.forEach(cb => cb());
      }
      await new Promise(r => setTimeout(r, this.leaseDuration * 1000 / 3));
    }
  }
  
  async _tryAcquireLease() {
    const now = new Date();
    const expiry = new Date(now.getTime() + this.leaseDuration * 1000);
    
    try {
      const existing = await this.leaseClient.readNamespacedLease(
        this.leaseName, this.namespace
      );
      const lease = existing.body;
      const holderExpiry = new Date(lease.spec.renewTime);
      holderExpiry.setSeconds(holderExpiry.getSeconds() + (lease.spec.leaseDurationSeconds || this.leaseDuration));
      
      // Lease is still valid — check if we're the holder
      if (holderExpiry > now) {
        return lease.spec.holderIdentity === this.identity;
      }
      
      // Lease expired — try to take over
      lease.spec.holderIdentity = this.identity;
      lease.spec.renewTime = now.toISOString();
      lease.spec.leaseDurationSeconds = this.leaseDuration;
      lease.spec.acquireTime = now.toISOString();
      
      await this.leaseClient.replaceNamespacedLease(this.leaseName, this.namespace, lease);
      return true;
    } catch (err) {
      if (err.response?.statusCode === 404) {
        // Create new lease
        await this.leaseClient.createNamespacedLease(this.namespace, {
          metadata: { name: this.leaseName, namespace: this.namespace },
          spec: {
            holderIdentity: this.identity,
            leaseDurationSeconds: this.leaseDuration,
            acquireTime: now.toISOString(),
            renewTime: now.toISOString(),
          }
        });
        return true;
      }
      if (err.response?.statusCode === 409) return false; // Optimistic lock failed — someone else got it
      throw err;
    }
  }
  
  _startRenewing() {
    const interval = setInterval(async () => {
      if (!this.isLeader) { clearInterval(interval); return; }
      try {
        await this._tryAcquireLease();
      } catch (err) {
        this.isLeader = false;
        clearInterval(interval);
        this.onFollowerCallbacks.forEach(cb => cb());
      }
    }, this.renewDeadline * 1000);
  }
}

// Usage
const elector = new KubernetesLeaderElector({
  namespace: 'default',
  leaseName: 'scheduler-leader',
  identity: process.env.POD_NAME, // Unique per pod
  leaseDuration: 15,
  renewDeadline: 10,
});

elector.onBecomeLeader(() => {
  console.log('Starting job scheduler...');
  startScheduler();
});

elector.onBecomeFollower(() => {
  console.log('Stopping job scheduler...');
  stopScheduler();
});

elector.start();
```

### Redis-Based Leader Election (Distributed Lock)

```javascript
// leader-election/redis-lock.js
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

class RedisLeaderElector {
  constructor({ redisUrl, lockKey, ttlMs = 10000, renewIntervalMs = 3000 }) {
    this.redis = new Redis(redisUrl);
    this.lockKey = lockKey;
    this.ttlMs = ttlMs;
    this.renewIntervalMs = renewIntervalMs;
    this.token = uuidv4(); // Unique ID for this instance
    this.isLeader = false;
    this.renewInterval = null;
  }
  
  async tryBecomeLeader() {
    // SET NX PX — atomic, only sets if doesn't exist
    const result = await this.redis.set(
      this.lockKey, 
      this.token, 
      'NX',    // Only set if not exists
      'PX',    // Expiry in millis
      this.ttlMs
    );
    
    if (result === 'OK') {
      this.isLeader = true;
      this._startRenewing();
      return true;
    }
    return false;
  }
  
  async _renewLease() {
    // Lua script: Only extend if we're still the leader (token matches)
    // Atomic check-and-set prevents renewing someone else's lease
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    const renewed = await this.redis.eval(luaScript, 1, this.lockKey, this.token, this.ttlMs);
    if (!renewed) {
      this.isLeader = false;
      clearInterval(this.renewInterval);
      console.log('Lost leadership — could not renew lease');
    }
  }
  
  async releaseLeadership() {
    // Lua script: Only delete if we own the lock
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.eval(luaScript, 1, this.lockKey, this.token);
    this.isLeader = false;
    clearInterval(this.renewInterval);
  }
  
  _startRenewing() {
    this.renewInterval = setInterval(
      () => this._renewLease(), 
      this.renewIntervalMs
    );
  }
}

// Usage
const elector = new RedisLeaderElector({
  redisUrl: process.env.REDIS_URL,
  lockKey: 'cron-leader',
  ttlMs: 10000,   // 10s TTL
  renewIntervalMs: 3000,  // Renew every 3s
});

// Periodic election check
setInterval(async () => {
  if (!elector.isLeader) {
    const won = await elector.tryBecomeLeader();
    if (won) console.log('Became leader, starting cron jobs');
  }
}, 5000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (elector.isLeader) await elector.releaseLeadership();
  process.exit(0);
});
```

---

## 11. Real-World Examples

### Kafka: Controller Election via ZooKeeper (and KRaft)
Apache Kafka uses a **controller broker** to manage partition leadership and replica assignment. Originally used ZooKeeper ephemeral nodes: whichever broker successfully creates `/controller` znode becomes the controller. All other brokers watch for deletion to trigger re-election.

**Key detail**: Kafka's migration from ZooKeeper to KRaft (Kafka Raft) in Kafka 3.x replaced external coordination dependency with an **internal Raft-based quorum of controller nodes** — a dedicated pool of 3-5 nodes dedicated to metadata management. This reduced broker startup time from minutes (waiting for ZK sync) to seconds. Also eliminated the ZooKeeper bottleneck — a single ZK cluster managing a large Kafka deployment became a scaling constraint.

### MongoDB Replica Sets: Election Protocol
MongoDB replica set election triggers when: primary steps down, primary is unreachable for >10s, or primary becomes aware it no longer has quorum. A secondary initiates election by incrementing its term and requesting votes from peers.

**Key detail**: MongoDB's election protocol considers **replica priority and optime** (how current the node's log is). A secondary with higher optime (more recent data) has a better chance of winning. MongoDB 4.0+ elections typically complete in < 2 seconds thanks to pre-vote optimization: before starting a real election, a candidate does a dry-run vote to estimate if it can win, preventing unnecessary elections.

### Kubernetes: Leader Election for Controllers
Kubernetes controller-manager, scheduler, and cloud-controller-manager all use leader election. Multiple replicas run, but only the leader actively reconciles. Built on the `coordination.k8s.io/v1` Lease API.

**Key detail**: Kubernetes leader election uses an **optimistic concurrency leasing mechanism** — the leader continuously updates the Lease object's `renewTime`. If it fails to renew within `leaseDuration` (default 15s), followers consider the lease expired and compete to acquire it. The concurrent update uses resource version for optimistic locking — only one update succeeds, preventing split-brain at the Kubernetes API level. Custom controllers built with `controller-runtime` can enable leader election with a single flag.

---

## 12. Interview Cheat Sheet

### The 30-Second Answer
> "Leader Election designates exactly one node as coordinator for tasks requiring centralized decision-making. The key challenge is split-brain — two nodes thinking they're leader simultaneously. The solution is quorum: a leader needs `floor(N/2) + 1` votes. During a network partition, the minority partition can't reach quorum and becomes unavailable rather than risking inconsistent writes. Production systems use Raft (etcd, CockroachDB), ZooKeeper ephemeral nodes (Kafka legacy), or Kubernetes Lease objects for cloud-native workloads."

### Formula Reference
```
Quorum:   Q = floor(N/2) + 1
Fault tolerance: f = floor(N/2)  (can tolerate f node failures)

Election timeout: T_election ≥ (HeartbeatInterval × SafetyFactor) + NetworkP99
                  (typically 3x heartbeat interval minimum)

Recommended cluster sizes: 3, 5, 7 (odd numbers)
4-node cluster: tolerates 1 failure (same as 3-node — wasteful)
```

### Quorum Quick Reference
```
3 nodes: need 2 votes, tolerate 1 failure
5 nodes: need 3 votes, tolerate 2 failures
7 nodes: need 4 votes, tolerate 3 failures
```

### Key Interview Questions

**Q: Explain the split-brain problem and how to prevent it**  
Two partitioned nodes both believe they're leader → both accept writes → data corruption/inconsistency. Prevention via quorum: minor partition can't get majority votes → refuses to elect a leader. Secondary prevention: fencing tokens (leader includes monotonic token in writes; storage rejects writes from stale leader).

**Q: Design a distributed cron scheduler with leader election**  
Multiple scheduler instances use Redis `SET NX PX` lock (or Kubernetes Lease). Only the leader runs the scheduler. Heartbeat renews the lock every 3s with 10s TTL. Graceful handoff on `SIGTERM`. Monitor: job execution count (if it drops to 0, election failed). Failure detection: lock expires after 10s → new leader within 10s. Set up alerting if no leader for >30s.

**Q: Kafka controller fails. What happens?**  
1. Remaining brokers detect ephemeral znode deletion (ZK watch fires)  
2. All eligible brokers race to create `/controller` znode  
3. First successful creator becomes new controller  
4. New controller reads full state from ZooKeeper and begins reassigning leaders to under-replicated partitions  
5. Total unavailability window: ZK session timeout (30s default) + election + state loading (~35-45s typically)  
That's why KRaft (Kafka's internal Raft) reduces this — no ZK dependency.

### Common Pitfalls / Red Flags

| Pitfall | Why It's Wrong | Correct Approach |
|---------|---------------|------------------|
| Skip formal election — use DB flag | DB is also distributed; flag update isn't atomic across failure | Use consensus algorithms or distributed locks with fencing |
| Short election timeout (< 100ms) | Network hiccup → spurious election → instability | timeout ≥ 3× heartbeat interval + network jitter |
| Even number of nodes | 4-node fails 1, same as 3-node. 6-node fails 2, same as 5-node | Use odd numbers: 3, 5, 7 |
| Trust stale leader | Partitioned-then-rejoined old leader might still think it leads | Epoch/term numbers: any response with higher term forces step-down |
| Election without fencing | Two leaders overlap for a moment → split-brain writes | Fencing tokens: monotonic counter, storage server rejects lower tokens |

### Keywords / Glossary

| Term | Definition |
|------|------------|
| **Term / Epoch** | Monotonically increasing round counter; higher term always wins |
| **Quorum** | `floor(N/2) + 1` nodes required to make decisions |
| **Split-brain** | Two nodes simultaneously believe they are the leader |
| **Fencing token** | Monotonic counter included in write requests; storage rejects stale tokens |
| **Raft** | Consensus algorithm optimized for understandability; used in etcd, CockroachDB |
| **Paxos** | Classic consensus algorithm; more general but complex; used in Google Chubby |
| **Ephemeral node** | ZooKeeper node automatically deleted when creating session ends |
| **Lease** | Time-bounded leadership lock; must be renewed before expiry |
| **Pre-vote** | Raft optimization: dry-run vote before real election to prevent unnecessary disruption |
| **Election timeout** | Random delay before a follower starts an election; scatters elections to prevent splits |
