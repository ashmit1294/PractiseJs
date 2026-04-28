# 15 — Merkle Trees

> **Source**: https://layrs.me/course/hld/02-core-concepts/merkle-trees  
> **Level**: Advanced | **Read time**: ~33 min

---

## TL;DR

A Merkle tree is a binary (or n-ary) hash tree where each leaf = hash of a data block, and each parent = hash of its children. The **root hash** is a cryptographic fingerprint of the **entire dataset**.

Key wins:
- Verify **1 item** out of n with only **O(log n) hashes** (not the whole dataset)
- Find **exactly which items differ** between two replicas in O(d × log n) hash exchanges (d = diff count)
- Used in Bitcoin (SPV wallets), Git (commit integrity), Cassandra (anti-entropy repair), DynamoDB (cross-AZ sync)

**One-liner for interviews**: *"Root hash = fingerprint of everything. Proof for one item = log(n) sibling hashes. Diff detection = top-down tree walk, prune matching subtrees."*

---

## ELI5 — Explain Like I'm 5

Imagine a school report made of 8 paragraphs. Your teacher hashes each paragraph (stamps it with a unique code). Then she hashes **pairs of stamps**, then pairs of pairs, until she has **one master stamp** at the top.

Later, if someone secretly changes one paragraph, their master stamp won't match yours. But you don't have to re-read all 8 paragraphs to find the changed one — you just follow the mismatched stamps down the tree until you land on the changed paragraph. That's a Merkle tree.

---

## The Analogy — Corporate Org Chart

Every manager's **signature is derived from their team's signatures**.

```
CEO Signature  ← H( Division A sig || Division B sig )
    |
Division A Sig ← H( Dept A1 sig || Dept A2 sig )
    |
Dept A1 Sig    ← H( Alice badge || Bob badge )
```

To verify Alice works here? You don't need the full org chart. Just provide:
- Alice's badge
- Bob's badge (Alice's peer)
- Dept A1's sibling (Dept A2)
- Division A's sibling (Division B)

4 items for a company of thousands. That's O(log n).

When two companies merge, compare CEO signatures first. Match → identical. No match → compare division heads → narrow down → never compare every employee.

---

## The Problem Merkle Trees Solve

Two replicas of a 1-million-key database diverge. How do you sync them?

| Approach | Data transferred |
|---|---|
| Copy everything | ~1 GB |
| Compare every key | 1M key comparisons |
| Compare all hashes | 32 MB of hash data |
| **Merkle tree** | **~2 KB of hashes + only the differing data** |

Without this, distributed databases would flood the network on every repair cycle.

---

## Core Concept — Hash Tree Structure

```
HEIGHT 3 (ROOT)
                   ┌─────────────────────┐
                   │    ROOT HASH        │
                   │  H(AB || CD)        │
                   └──────┬──────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
    ┌─────┴──────┐                 ┌──────┴─────┐
    │  H(A || B) │                 │  H(C || D) │
    └──┬─────────┘                 └──────┬─────┘
       │                                  │
    ┌──┴──┐  ┌──────┐            ┌──────┐  ┌──────┐
    │H(A) │  │H(B)  │            │H(C)  │  │H(D)  │
    └─────┘  └──────┘            └──────┘  └──────┘
      A         B                   C          D
   (data)    (data)               (data)    (data)

If Block C changes to C':
  H(C) → H(C') → H(C'||D) changes → ROOT changes
  Any change in any leaf = root hash changes (avalanche effect)
```

---

## Step-by-Step: Build, Verify, Sync

### Build (Bottom-Up)

```
1. Hash each data block: H(A), H(B), H(C), H(D)
2. Pair + hash: H(A||B), H(C||D)
3. Pair + hash: ROOT = H(H(A||B) || H(C||D))

Odd number of nodes at any level?
  Bitcoin approach: duplicate the last node (hash it with itself)
  Alternative: promote the unpaired node up unchanged
```

### Verify One Item (Merkle Proof)

To prove Block C is in the dataset with root R:
```
Client needs:
  1. Block C itself
  2. H(D)         ← sibling of C
  3. H(A||B)      ← uncle of C

Client recomputes:
  H(C) → H(C||D) → H(H(A||B) || H(C||D)) → check vs known ROOT ✓
```

For n=8 blocks → need 3 sibling hashes (log₂ 8 = 3). For n=1M → need 20 hashes.

### Sync Two Replicas

```
Step 1: Exchange root hashes
        Replica A root = 0xABCD
        Replica B root = 0xEFGH → ❌ differ

Step 2: Exchange children hashes (level 1)
        Left child: A=0x1234, B=0x1234 ✅ match → prune entire left subtree
        Right child: A=0x5678, B=0x9012 ❌ differ → descend right

Step 3: Exchange level 2 of right subtree
        Right.Left: match ✅ → prune
        Right.Right: no match → descend

...continue recursively until leaf...

Result: With 1M keys, 100 different → only examined ~2,000 nodes, not 1M
```

---

## Key Principles

| Principle | Detail |
|---|---|
| **Incremental Verification** | Verify any single item with O(log n) sibling hashes, not the entire dataset |
| **Tamper Evidence** | One-bit change → root hash changes entirely (hash avalanche effect) |
| **Efficient Diff Detection** | Prune matching subtrees → O(d × log n) for d differences |
| **Space-Time Trade-off** | Store O(n) hashes → enable O(log n) verification + sync |
| **Composability** | Nest Merkle trees; Ethereum does state root + tx root + receipts root in one header |

---

## Math & Formulas

### Merkle Proof Size

$$\text{Proof size} = \lceil \log_2(n) \rceil \times 32 \text{ bytes}$$

| n (items) | Proof hashes | Proof size |
|---|---|---|
| 2,000 (Bitcoin block) | 11 | 352 bytes |
| 1,000,000 | 20 | 640 bytes |
| 1,000,000,000 | 30 | 960 bytes |

vs. downloading everything: 2,000 txns ≈ 1–2 MB → **Merkle proof = 3,000× smaller**.

### Sync Bandwidth (d differences in n items)

$$\text{Bandwidth} \approx d \times \lceil \log_2(n) \rceil \times 32 \text{ bytes} + d \times \text{block\_size}$$

**Example**: 1M keys, 100 differ, 1 KB each:
```
Hash exchange = 100 × 20 × 32 bytes = 64 KB
Data transfer  = 100 × 1 KB         = 100 KB
Total                                = 164 KB

vs. naive compare-all: 1M × 1KB = 1 GB → 6,000× reduction
```

### Update Cost

$$\text{Update cost} = \lceil \log_2(n) \rceil \text{ hash operations}$$

1M items → 20 hashes per update ≈ **2.5 μs** (negligible per write).

### Storage Overhead

$$\text{Overhead} = (2n - 1) \times 32 \text{ bytes} \approx 64n \text{ bytes}$$

1M items at 1 KB each → tree adds **64 MB** on top of **1 GB** data = **6.4% overhead**.

### Collision Probability (SHA-256)

$$P(\text{collision}) \approx \frac{n^2}{2^{257}}$$

With n = 2⁶⁴ inputs: P ≈ 2⁻¹²⁹ ≈ 10⁻³⁹. Practically zero.  
**Never use MD5 for security-critical Merkle trees** — it has known collision attacks.

---

## Variants Comparison

| Variant | Structure | Best For |
|---|---|---|
| **Binary Merkle Tree** | 2 children per node, depth = log₂(n) | Simple systems; Bitcoin; block-level integrity |
| **N-ary Merkle Tree** | N children per node (N=16 or 256), depth = log_N(n) | High-latency networks; Cassandra (fewer round trips) |
| **Merkle Patricia Trie** | Prefix tree + Merkle hashing | Key lookups + non-existence proofs; Ethereum state |
| **Merkle DAG** | Nodes can have multiple parents; content-addressable | Deduplication; IPFS; Git |
| **Sparse Merkle Tree** | Fixed 2²⁵⁶ key space, empty leaves = default hash | Proving non-membership (key does NOT exist) |

### Branching Factor Impact

```
n = 1,000,000 keys:

Binary tree (b=2):   depth = log₂(1M)   = 20 → 20 round trips during sync
16-ary tree (b=16):  depth = log₁₆(1M)  =  5 → 5 round trips during sync

Cost: 5 round trips × 16 hashes/level = 80 hashes vs 20 round trips × 2 hashes = 40 hashes
Trade-off: fewer round trips but more hashes per level. Use 16-ary for cross-DC sync.
```

---

## Update Strategies

| Strategy | Write overhead | Tree freshness | Used by |
|---|---|---|---|
| **Eager (per write)** | O(log n) per write | Always current | Blockchain, Git commits |
| **Lazy (periodic rebuild)** | Zero per write | Snapshot-based (may be stale) | Cassandra (hourly repair), DynamoDB |
| **Batched** | O(log n) amortized | Current after batch | Log-structured storage segments |

### When to Use Which

```
Immutable data (blockchain, Git):  Eager — build once, never update
Read-heavy with sparse writes:     Eager — minimal write cost
Write-heavy (Cassandra insert storm): Lazy — rebuild at repair time, avoid write-path overhead
Append-only segments (LSM trees):  Batched per segment at flush time
```

---

## MERN Dev Context — Cassandra vs MongoDB Replication

> **MERN dev note — why does Cassandra use Merkle trees for sync but MongoDB doesn't?**
>
> **MongoDB** replicates via **oplog** (operation log): every write appended to oplog → secondaries tail the oplog and replay operations in order. Syncing a lagged secondary = replaying the oplog from the last applied operation. This is simple and works perfectly for single-primary topologies.
>
> **Cassandra** has no primary — every node is equal (masterless). There is no central oplog. If a node goes down for 30 minutes, comes back, and needs to figure out what it missed, there is no single "replay from here" channel — all N nodes could have received writes. Cassandra uses **anti-entropy repair** with Merkle trees: snapshot the token range, build a tree, compare with peers, stream only the differing keys. This works regardless of whether the node missed 100 writes or 10 million.
>
> **Rule of thumb for interviews**:  
> - "Multi-master, no primary, eventual consistency, how do nodes sync?" → Merkle tree anti-entropy (Cassandra / DynamoDB style)  
> - "Single primary + secondaries, strong or eventual consistency?" → Oplog tailing (MongoDB / MySQL replication style)

> **MERN dev note — Cassandra anti-entropy detail**
>
> Cassandra builds Merkle trees **lazily** — NOT on every write. During a scheduled repair (default: every 10 days, recommended: every `GC grace seconds` ≈ 10 days), it:
> 1. Snapshots the token range
> 2. Builds a Merkle tree from the snapshot (configurable depth, default 15 levels)
> 3. Compares trees with each replica node
> 4. Streams only mismatched key ranges
>
> This means writes have **zero Merkle overhead** at write time. Trade-off: trees can be stale between repair cycles. Cassandra's hinted handoff + read repair handle most short-term inconsistencies; Merkle tree repair catches long-term drift.
>
> MongoDB has no equivalent concept because its oplog-based replication doesn't drift the same way (secondaries always know exactly what they missed).

---

## Implementation Skeleton (JavaScript)

```js
const crypto = require('crypto');

function hashBlock(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function buildMerkleTree(blocks) {
  if (blocks.length === 0) throw new Error('No blocks');
  
  // Leaf layer
  let layer = blocks.map(b => hashBlock(b));

  const levels = [layer];

  // Build up
  while (layer.length > 1) {
    const nextLayer = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left  = layer[i];
      const right = layer[i + 1] ?? layer[i]; // duplicate last if odd
      nextLayer.push(hashBlock(left + right));
    }
    layer = nextLayer;
    levels.push(layer);
  }

  return { root: layer[0], levels };
}

function getMerkleProof(blocks, index) {
  const { levels } = buildMerkleTree(blocks);
  const proof = [];
  
  let idx = index;
  for (let lvl = 0; lvl < levels.length - 1; lvl++) {
    const layer = levels[lvl];
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    const sibling = layer[siblingIdx] ?? layer[idx]; // odd-node edge case
    proof.push({ hash: sibling, position: idx % 2 === 0 ? 'right' : 'left' });
    idx = Math.floor(idx / 2);
  }
  return proof;
}

function verifyProof(block, proof, root) {
  let current = hashBlock(block);
  for (const { hash, position } of proof) {
    current = position === 'right'
      ? hashBlock(current + hash)
      : hashBlock(hash + current);
  }
  return current === root;
}

// Usage
const blocks = ['txA', 'txB', 'txC', 'txD'];
const { root } = buildMerkleTree(blocks);
const proof = getMerkleProof(blocks, 2); // prove txC exists

console.log('Root:', root);
console.log('Proof valid:', verifyProof('txC', proof, root)); // true
console.log('Tampered?:', verifyProof('txC_tampered', proof, root)); // false
```

---

## Real-World Examples

### Bitcoin (Binary Merkle Tree)
- 1,000–3,000 transactions per block → depth ≈ 11–12
- Block header (80 bytes) contains Merkle root
- **SPV Client**: download only headers (4 MB total history) + request Merkle proof per transaction
- SPV proof for 2,000 txns: 11 × 32 = **352 bytes** vs downloading all txns: **~1–2 MB** → 3,000× smaller
- Quirk: Bitcoin duplicates last tx hash when count is odd — same root for [A,B,C] and [A,B,C,C]

### Apache Cassandra (N-ary, Lazy)
- One Merkle tree **per token range**
- Built from **snapshot at repair time** (not live data)
- Configurable depth (default 15 levels) and branching factor
- Repair protocol: compare roots → exchange subtree hashes → stream only mismatched segments

> **MERN dev note**: Cassandra's Merkle repair is for **eventual consistency maintenance** — it's the safety net that catches inconsistencies that hinted handoff missed. Think of it as the background vacuum. MongoDB's equivalent is the oplog + initial sync (full data copy on first join).

### Git (Merkle DAG)
- Every blob (file), tree (dir), commit → content-addressed by SHA-1 hash
- Commit hash = Merkle root of entire repo state at that point
- Identical file in two directories → **same blob hash → stored once** (deduplication)
- Migrating from SHA-1 → SHA-256 is complex because commit hashes are embedded everywhere
- `git fsck` = verify the entire Merkle DAG's integrity

### Amazon DynamoDB (Lazy, MD5, Per-Partition)
- Merkle trees built asynchronously per partition, synced across AZs
- Uses **MD5** (not SHA-256) — faster, fine for trusted internal replicas
- Small partition optimization: skip Merkle tree and compare keys directly if n is small
- Same core concept as Cassandra, different implementation details

### IPFS (Merkle DAG)
- Files split into chunks → each chunk hashed → DAG root = "content address"
- Request data by hash from any peer → automatic integrity verification on receipt
- Two directories containing same file share the same blob node → zero duplicate storage

---

## Interview Cheat Sheet

### Comparison Table

| Aspect | Hash List | Merkle Tree |
|---|---|---|
| Verify 1 item | O(n) — need all hashes | O(log n) sibling hashes |
| Verify entire dataset | O(n) | O(1) — check root only |
| Find differences | O(n) — compare each hash | O(d × log n) recursive descent |
| Storage | n × 32 bytes | 2n × 32 bytes (~2× more) |
| Implementation | Trivial | Moderate |
| Best for | Full-dataset verification | Partial verification + sync |

### Common Q&A

**Q: How do you sync two replicas with Merkle trees?**  
A: Exchange root hashes. If match → done. If not → exchange children hashes, prune matching subtrees, recurse into differing subtrees until leaf level, stream differing key-value pairs only.

**Q: What's the proof size for 1 million items?**  
A: log₂(1M) = 20 sibling hashes × 32 bytes = 640 bytes.

**Q: Can you prove a key does NOT exist?**  
A: Not with standard Merkle trees. Use **sparse Merkle tree**: fixed 2²⁵⁶ key space, empty leaves have default hash. Proof of non-membership = path to an empty leaf.

**Q: Eager vs lazy tree updates?**  
A: Eager (update on every write) = O(log n) write overhead, tree always current → good for blockchain/Git. Lazy (rebuild at repair time) = zero write overhead, stale between syncs → good for Cassandra/DynamoDB write-heavy workloads.

**Q: Why binary vs n-ary?**  
A: Binary is simpler (2 round trips per level). N-ary is shallower (log_N(n) levels × N hashes/level) → better for high-latency cross-DC sync. Cassandra uses configurable branching factor.

### Red Flags to Avoid

- "Merkle trees make writes faster" — they add overhead (O(log n) for eager updates)
- "Just compare root hashes to find what differs" — roots tell you IF data differs, not WHERE; need recursive descent for WHERE
- "Merkle trees guarantee consistency" — they DETECT inconsistencies, not RESOLVE them; need separate conflict resolution (LWW, vector clocks, quorum)
- "Any hash function works" — use SHA-256 for adversarial contexts (blockchain), non-cryptographic (xxHash) is fine for trusted internal replicas
- "Always better than direct comparison" — for small datasets (<1,000 items) or low-latency LANs, direct comparison is simpler and fast enough

---

## Summary of Use Cases

| System | Type | Update | Hash fn | Why Merkle? |
|---|---|---|---|---|
| Bitcoin | Binary | Eager (build once) | SHA-256 | SPV lightweight clients |
| Cassandra | N-ary, per token range | Lazy (repair time) | Varies | Anti-entropy between masterless nodes |
| DynamoDB | Per partition | Lazy (async) | MD5 | Cross-AZ replica sync |
| Git | Merkle DAG | Eager (per commit) | SHA-1/SHA-256 | Integrity + deduplication |
| IPFS | Merkle DAG | Eager (per add) | SHA-256 | Content addressing + dedup |
| Ethereum | Merkle Patricia Trie | Eager (per block) | Keccak-256 | State proofs + non-membership |

---

## Key Takeaways

1. **Root hash = fingerprint**: any data change, anywhere, changes the root
2. **Proof = O(log n) hashes**: verify one item without downloading everything
3. **Diff = recursive descent**: compare root → compare children → prune matches → reach differing leaves
4. **Update cost = O(log n)**: only recompute the changed path, not the whole tree
5. **Pick variant by use case**: binary (simple), n-ary (fewer round trips), MPT (non-membership), DAG (dedup), sparse (exclusion proof)
6. **Detect ≠ resolve**: Merkle trees find inconsistencies; vector clocks / LWW / quorum resolve them

---

## Keywords

`merkle tree` · `hash tree` · `root hash` · `merkle proof` · `authentication path` · `sibling hash` · `anti-entropy` · `replica sync` · `SPV` · `simplified payment verification` · `n-ary tree` · `merkle patricia trie` · `merkle DAG` · `sparse merkle tree` · `non-membership proof` · `content-addressable storage` · `eager update` · `lazy update` · `Cassandra repair` · `git sha` · `avalanche effect` · `SHA-256` · `bloom filter companion` · `O(log n) proof`
