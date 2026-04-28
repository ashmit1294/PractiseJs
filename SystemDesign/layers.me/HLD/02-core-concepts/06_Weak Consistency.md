# 06 — Weak Consistency in Distributed Systems

**Module:** Core Concepts & Trade-offs | **Level:** Intermediate

---

## ELI5 Summary

- **Weak consistency** = "We'll try our best, but no promises" about what you read after a write
- After you write, other readers may see the old data **forever** — there's no guarantee it will ever converge
- Different from eventual consistency: eventual *promises* convergence; weak consistency **doesn't**
- Systems choose this when **speed and availability beat data accuracy**
- Best for: VoIP, live video, social metrics, caches, approximate analytics

---

## The Restaurant Analogy

- Servers **shout orders** to the kitchen instead of writing them down
- Sometimes the chef hears "no onions", sometimes not — but the food comes out fast
- Works fine for bar snacks at a concert
- Fails for someone with a severe allergy (who needs written confirmation = strong consistency)
- **Speed always wins**; correctness is sacrificed

---

## Core Concept

- **Zero freshness guarantees**: after a write, reads may return old value **indefinitely**
- **Best-effort delivery**: system tries to propagate updates but will drop them without retry if the network fails
- **No version tracking, no conflict resolution, no global ordering**
- Writes complete in **< 1ms** because there is zero coordination

---

## Read Flow: Stale Data Scenario

```
T0: Client1 writes key=100 to Node1
         Node1: ACK ← (write accepted, 1ms)
         Node2: still has key=50 (no sync guaranteed)

T1: Client2 reads key from Node2
         Returns: key=50  ← STALE (no guarantee when this updates)

T2: Later (maybe)...
         Node2: best-effort async propagation → key=100 (or lost!)

Key: There is NO "eventually" promise here.
     The data may stay at 50 forever if Node2 never re-syncs.
```

---

## Weak vs Strong: Performance Comparison

```
STRONG CONSISTENCY:
  Write → Node1 → sync → Node2 → sync → Node3 → ACK back
  Duration: 10–100ms (network round-trips)
  Throughput: ~thousands ops/sec

WEAK CONSISTENCY:
  Write → Node1 → ACK (done)
  Async propagation? Best-effort. Maybe.
  Duration: < 1ms
  Throughput: millions ops/sec
```

---

## Variants of Weak Consistency

| Form | How | Example |
|---|---|---|
| **Cache-aside** | Write to DB, invalidate one cache node; others stay stale | Memcached (each node independent) |
| **UDP-based** | Packet loss = accepted; no retransmit | VoIP (Zoom audio), live game streaming |
| **Metrics/monitoring** | Sample events; some points dropped OK | Prometheus, Datadog dashboards |
| **Mobile offline** | Cache locally, sync opportunistically | iOS apps, Google Maps offline |

---

## Key Principles

- **No freshness guarantees** — reads may return old value forever (Twitter follower count, Facebook likes)
- **Best-effort delivery** — VoIP drops packets; audio has a gap; that's the design, not a bug
- **Availability over accuracy** — "People You May Know" on Facebook runs on data that's hours old

---

## Facebook Like Counts: Real Example

```
User1 likes post → DB: likes=1235 ✓
                 → Cache US-East: async invalidate (best-effort)
                 → Cache US-West: async invalidate (best-effort)
                 → Cache EU: not invalidated yet

User2 (US-East) reads: 1234  ← stale
User3 (US-West) reads: 1234  ← stale
User4 (EU)      reads: 1232  ← very stale

Convergence? Not guaranteed. Minutes or never.
Acceptable? YES — users don't care if likes are off by 3
```

---

## When to Use Weak Consistency

| Use Case | Why It's OK |
|---|---|
| **VoIP / live streaming** | 100ms audio gap better than stutter from retransmit |
| **Social metrics** (likes, views, followers) | Users don't notice ±5 difference |
| **Trending topics** (Twitter) | Approximate sampling; goal = surfacing trends, not exact counts |
| **Operational monitoring** (Prometheus) | Missing 1 data point doesn't invalidate the trend |
| **"You May Know"** suggestions | Runs on hours-old data; discovery value doesn't need freshness |
| **Read caches** | Stale cache is fine; DB is source of truth |

---

## When NOT to Use Weak Consistency

| Use Case | Why It Fails |
|---|---|
| Bank balances | User sees wrong balance → financial disaster |
| Inventory stock | Oversell possible if all nodes show stale count |
| User-facing writes | User submits form, immediately sees old data → "system is broken" |
| Auth tokens | Revoked token still accepted if read is stale |

---

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| **Confusing weak with eventual** | Eventual = promises convergence. Weak = no promise at all. |
| **Weak consistency for user-facing writes** | Use read-your-own-writes at minimum (session affinity / client-side cache of own writes) |
| **No staleness monitoring** | Even in weak consistency, track data age; alert when staleness SLA (Service Level Agreement) is violated |
| Applying strong consistency everywhere | Over-engineering; pay coordination cost only where business demands it |

---

## Real-World Examples

### Facebook — Like Counts
- Like count served from **geographically distributed caches** with no coordination
- Different users see different counts; convergence not guaranteed
- **Why**: need instant feed loading more than precise metrics

### Netflix — Video Quality Metrics
- Engineering dashboards show data **seconds to minutes old**, with some events dropped
- **Why**: identifying trends (20% buffering spike in EU) → eventual is enough; billing data uses strong consistency

### Twitter — Trending Topics
- Calculates from **sampled** tweet streams; algorithm runs on data **minutes old**
- Different regions see slightly different trends
- **Why**: trending is approximate by nature; exact counts would require unaffordable infra

---

## Interview Cheat Sheet

| Level | Expectation |
|---|---|
| **Mid** | Define weak consistency; distinguish from eventual; name 1–2 use cases (VoIP, caching); explain performance benefit |
| **Senior** | Design a system (analytics dashboard, social feed) using weak consistency with justification; mention monitoring staleness; discuss user experience impact |
| **Staff+** | Explain hybrid designs; evolve from weak → eventual as requirements grow; quantify staleness SLAs (Service Level Agreements); reference specific tech (memcached, UDP, Prometheus) |

**Common Questions:**
- "When would you choose weak over eventual consistency?" → When convergence itself isn't needed (real-time media, approximate metrics)
- "Design a real-time analytics dashboard" → Weak consistency for metrics counters; strong for billing
- "Difference between weak and eventual?" → Eventual guarantees convergence; weak does not

**Red Flags:**
- "Weak consistency is always bad" — it's a deliberate choice, not a failure
- Insisting on strong consistency everywhere without cost justification
- Treating consistency as binary (only strong vs weak, ignoring spectrum)

---

## Key Takeaways

1. **Zero guarantees** — reads may return stale data forever; writes may be silently lost
2. **Best-effort delivery** — no retransmit, no convergence promise
3. **Sub-millisecond writes** via zero coordination → millions of ops/sec
4. Complexity is **pushed to the application** — app must tolerate inconsistency as normal, not exceptional
5. Use for: VoIP, caches, social counters, approximate analytics
6. **Monitor staleness** even without guarantees — track data age; set SLA (Service Level Agreement) alerts
7. Distinct from eventual: **eventual promises convergence; weak does not**

---

## Keywords

`weak consistency` `best-effort delivery` `no freshness guarantee` `stale data` `Memcached` `UDP` `VoIP` `cache invalidation` `cache-aside` `approximate metrics` `replication lag` `social metrics` `eventual consistency difference` `data loss` `session affinity` `read-your-own-writes` `Prometheus` `partial availability`
