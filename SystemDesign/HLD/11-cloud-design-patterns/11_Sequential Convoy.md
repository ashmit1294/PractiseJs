# T11 — Sequential Convoy Pattern: Ordered Message Processing

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/sequential-convoy

---

## ELI5 (Explain Like I'm 5)

Imagine a highway with multiple lanes. Each lane has cars travelling in a specific order — the red car always stays ahead of the blue car in its lane. But different lanes move independently. The cars here are messages for different orders, the lanes are "sessions" (one lane = one order), and the highway is your processing system.

Sequential Convoy processes messages in strict order *per group* while letting different groups run in parallel. Order #1234's messages process in sequence → validate, pay, ship. Order #5678 processes at the same time in a separate "lane."

---

## Analogy

**Hospital ward rounds**: In ICU, the doctor visits Patient A's bed, does everything for Patient A in proper order (assess → diagnose → prescribe → update notes). Only then moves to Patient B. But multiple treatment teams handle different patients in parallel. No team processes Patient A's tasks out of order, but Teams A, B, and C run independently.

---

## Core Concept

Sequential Convoy groups messages by a **session identifier** (order ID, user ID, account ID) and ensures messages within each group are processed **in strict order**, while different groups are processed **concurrently**.

**The Goldilocks solution**:
- ❌ **Single consumer** (global ordering): 100 msg/sec with no parallelism — too slow
- ❌ **Competing consumers** (pure parallelism): 10,000 msg/sec but chaotic — no ordering
- ✅ **Sequential Convoy**: 10,000 msg/sec across many sessions, strict order within each session

**Why ordering matters**: Payment must complete before shipment. Validation must run before payment. If Payment step for Order #1234 runs before Validation, you charge an invalid order.

---

## ASCII Diagrams

### The Problem: Competing Consumers Break Order

```
Order #1234: [Validate] → [Pay] → [Ship]   (must be in order)
Order #5678: [Validate] → [Pay] → [Ship]   (must be in order)

WRONG — Competing Consumers:
Queue: [ORD-1234-Validate] [ORD-1234-Pay] [ORD-5678-Validate] [ORD-1234-Ship]
          Consumer A               Consumer B               Consumer C
              │                       │                         │
       ORD-1234-Validate    ORD-1234-Pay (BUT WAIT!)   ORD-5678-Validate
                                 ↑
                         Pay before Validate? ❌ RACE CONDITION
```

### Sequential Convoy Solution

```
                      ┌──────────────────────┐
Session key routing:  │  Broker (Kafka/SQS)  │
                      │  Partition/Session   │
ORD-1234 messages ───►│  Session ORD-1234:   │──► Consumer A (locked to ORD-1234)
  [Validate]          │    [Validate]        │     processes: Validate → Pay → Ship
  [Pay]               │    [Pay]             │     (sequential, in order)
  [Ship]              │    [Ship]            │
                      │                      │
ORD-5678 messages ───►│  Session ORD-5678:   │──► Consumer B (locked to ORD-5678)
  [Validate]          │    [Validate]        │     processes: Validate → Pay → Ship
  [Pay]               │    [Pay]             │     (sequential, in order)
  [Ship]              │    [Ship]            │
                      └──────────────────────┘

Result: Per-session ORDER ✅  +  Cross-session PARALLELISM ✅
```

### Failure Handling: The Poison Message Trade-off

```
Consumer processing ORD-1234 messages:

  [Validate] ✅ → [Pay] ✅ → [Ship] ❌ ← 3RD FAILURE
                                  │
              ┌───────────────────┴───────────────────────┐
              │ Retry-and-Block           Dead-Letter-and-Continue
              │ (hold session lock)       (release session lock)
              │ Retry 1 (1s delay)        Move [Ship] to DLQ
              │ Retry 2 (2s delay)        Release session lock
              │ Retry 3 (4s delay)        Continue with next session
              │ Alert on-call 🚨          ⚠️ Order stuck incomplete
              │                           
              │ ✅ Preserves ordering     ✅ Maintains throughput
              │ ❌ Blocks entire session  ❌ Breaks ordering guarantee
              │ USE FOR: Payments, bank   USE FOR: Chat, logs
```

---

## How It Works (Step by Step)

1. **Assign session identifier**: Producer stamps each message with `sessionId`. In an order system: `sessionId = orderId`. In a banking system: `sessionId = accountId`. In chat: `sessionId = channelId`. This is the grouping key.

2. **Partition by session**: The broker uses `sessionId` as the partition key. This ensures all messages for the same session land in the same partition or queue.
   - **Azure Service Bus**: `SessionId` property → broker-managed session locks
   - **Kafka**: `message.key = sessionId` → same key always → same partition
   - **AWS SQS FIFO**: `MessageGroupId = sessionId` → ordered delivery per group

3. **Lock and process sequentially**: When consumer picks up a message, it acquires a session lock. While Consumer A holds the lock on session `ORD-1234`, no other consumer processes `ORD-1234` messages. Consumer A processes `Validate → Pay → Ship` in order.

4. **Release and continue**: After processing messages for a session, consumer releases the session lock and either:
   - Picks up the next message in the same session (if more pending)
   - Switches to a different session (if current session is drained)

5. **Handle failures**: Decide based on domain criticality:
   - **Financial/critical**: Retry-and-block (hold session lock, exponential backoff, alert on timeout)
   - **User-facing/non-critical**: Dead-letter-and-continue (move poison message to DLQ, release lock, continue with other sessions)

---

## Variants

| Variant | Mechanism | Pros | Cons |
|---------|-----------|------|------|
| **Session-Based Convoy (Azure SB)** | Explicit SessionId; broker manages locks | Simple for producers; broker handles complexity | Azure lock-in; session-aware consumers required |
| **Partition Key Convoy (Kafka)** | `message.key = sessionId`; one consumer per partition | Scales horizontally (add partitions); natural Kafka fit | Fixed partition count; rebalancing can temporarily break order |
| **Application-Level Convoy** | App maintains in-memory queues per session; distributes via any broker | Works with any broker (basic SQS) | Complex state management; risk of loss on consumer crash; needs distributed locking |

---

## Trade-offs

| Dimension | Detail |
|-----------|--------|
| **Ordering scope** | Session-based (per entity) vs. global ordering vs. none. Use session-based when entities have independent ordering requirements. |
| **Hot session problem** | If 80% of messages belong to one session (e.g., a power user), that session becomes a bottleneck — only one consumer handles it. Solution: sub-partitioning, or accept eventual consistency for hot users. |
| **Failure handling** | Retry-and-block (order preserved; one poison message stops session) vs. dead-letter-and-continue (throughput maintained; ordering broken). Choose by domain criticality. |
| **Session distribution** | Scales well with many sessions of similar size. Degrades with skewed distribution (few hot sessions). Profile session distribution before choosing this pattern. |

---

## When to Use (and When Not To)

**Use when:**
- Multiple independent entities each require ordered processing (orders, accounts, user sessions)
- Global ordering would destroy throughput (10,000 orders × 5 steps each)
- Race conditions exist between steps for the same entity (pay before validate = invalid charge)
- Classic examples: order processing, chat messages, trip state machines, bank account transactions

**Avoid when:**
- Operations are truly independent and idempotent — Competing Consumers is simpler and faster
- Cross-session ordering required ("all payments before any shipments") — need distributed transactions or Saga
- Broker doesn't support sessions/partitions and you're unwilling to build application-level management
- Session distribution is highly skewed (power law) — hot sessions become single-threaded bottlenecks

**Anti-patterns:**
- Using for globally ordered event streams — use event sourcing instead
- Not testing hot session behavior under load
- Wrong partition count: too few → poor parallelism; too many → resource waste

---

## MERN Developer Notes

```javascript
// Producer — assigns session ID as partition key
async function publishOrderEvent(orderId, eventType, payload) {
  await kafka.producer().send({
    topic: 'order-events',
    messages: [{
      key: orderId,           // ← partition key = session ID
      value: JSON.stringify({ orderId, eventType, payload }),
      headers: { sessionId: orderId }
    }]
  });
}

// Publish order lifecycle events — all same orderId → same partition → same consumer → ordered
await publishOrderEvent('ORD-1234', 'VALIDATE', { cartItems: [...] });
await publishOrderEvent('ORD-1234', 'PAYMENT',  { amount: 99.99 });
await publishOrderEvent('ORD-1234', 'SHIP',     { warehouseId: 'W1' });

// Consumer — single consumer per partition maintains ordering
const consumer = kafka.consumer({ groupId: 'order-processors' });
await consumer.subscribe({ topic: 'order-events' });

await consumer.run({
  // Kafka guarantees: same key → same partition → same consumer in group
  // So all ORD-1234 events always go to the same consumer instance
  eachMessage: async ({ message }) => {
    const { orderId, eventType, payload } = JSON.parse(message.value.toString());
    
    // This consumer processes ORD-1234 events one by one, in order
    // Another consumer (different partition) processes ORD-5678 concurrently
    await processOrderEvent(orderId, eventType, payload);
    // Kafka commits offset after this returns — preserving position
  }
});

// AWS SQS FIFO alternative — broker-managed ordering per group
await sqs.sendMessage({
  QueueUrl: 'https://sqs.us-east-1.amazonaws.com/.../orders.fifo',
  MessageBody: JSON.stringify({ eventType: 'VALIDATE', orderId: 'ORD-1234' }),
  MessageGroupId: 'ORD-1234',           // ← session ID
  MessageDeduplicationId: 'ORD-1234-VALIDATE-v1'  // idempotency
}).promise();
```

**Hot session mitigation:**
```javascript
// If account #VIP has 1000x more events, sub-partition by time bucket
function getSessionId(accountId, event) {
  if (isHotAccount(accountId)) {
    const timeBucket = Math.floor(Date.now() / 60000); // 1-minute buckets
    return `${accountId}-${timeBucket}`; // distribute across time buckets
    // Client merges sub-streams in order at read time
  }
  return accountId;
}
```

---

## Real-World Examples

| Company | System | Key Detail |
|---------|--------|-----------|
| **Slack** | Message delivery | Channel ID = partition key in Kafka. Messages within `#general` arrive in order for all users. Different channels process in parallel → millions of messages/sec. Hot public channels (large Slack communities) use sub-partitioning within channel session. |
| **Uber** | Trip state machine | Trip ID = partition key. State transitions: REQUESTED → ACCEPTED → ARRIVED → STARTED → COMPLETED — always in order. Race condition prevented: driver can't "complete" a trip before it's "started." Discovered: naive trip ID partition keys caused hot partitions in dense pickup areas → salted with time-based hash. |
| **Banking systems** | Account transactions | Account ID = session ID. Debit/credit operations per account must be sequential — otherwise balance calculation races. Multiple accounts process in parallel. |

---

## Interview Cheat Sheet

### Q: How does Sequential Convoy differ from Competing Consumers?
**A:** Competing Consumers has no ordering guarantees — any consumer can process any message, and they race. Sequential Convoy groups related messages by session ID and routes them to the same consumer/partition, ensuring they process in arrival order within the session, while different sessions process in parallel across multiple consumers.

### Q: What happens if a consumer crashes while holding a session lock?
**A:** The broker's session timeout expires (Azure SB: configurable lock timeout; Kafka: partition rebalanced to another consumer). The session's messages become available again for another consumer. Because processing may restart from an earlier point, **handlers must be idempotent** — a payment message processed twice must not charge twice.

### Q: How do you choose Kafka partition count?
**A:** Partition count = max concurrent sessions you want to process simultaneously. Rule of thumb: 3–5x your consumer instance count. Too few partitions → poor parallelism. Too many → resource waste, rebalancing overhead. With 10 consumer instances handling orders: 30–50 partitions is a reasonable starting point. Monitor "consumer lag per partition" to tune.

### Q: How do you handle a hot session (1 user generating 1000x messages)?
**A:** Options: (1) Sub-partitioning — split hot session key into time-based sub-keys (user_id + time_bucket); merge in correct order at read time. (2) Accept eventual consistency — process hot user messages as Competing Consumers (no ordering), but add client-side ordering. (3) Rate limit the hot user at the producer level to prevent monopolizing a partition.

---

## Red Flags to Avoid

- Claiming Sequential Convoy provides global ordering across all messages (per-session only)
- Not discussing poison message handling (one bad message blocks entire session indefinitely)
- Ignoring session distribution skew (assuming all sessions have equal message volume)
- Forgetting to mention partition keys/session IDs as the core mechanism
- Confusing with Competing Consumers (which has no ordering) or Event Sourcing (which is global)

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Sequential Convoy** | Pattern that ensures messages for the same session are processed in strict order while different sessions process concurrently |
| **Session ID** | Identifier grouping related messages (orderId, accountId, channelId); messages with same session ID route to same processing unit |
| **Partition Key** | In Kafka: `message.key` determining which partition receives a message; same key → same partition → same consumer |
| **Session Lock** | Mechanism (Azure Service Bus) where a consumer exclusively processes one session at a time; other consumers can't steal that session's messages |
| **MessageGroupId** | AWS SQS FIFO equivalent of session ID; messages with same MessageGroupId are delivered in order to one consumer |
| **Hot Session** | Session receiving disproportionately high message volume; becomes bottleneck because only one consumer processes it |
| **Sub-partitioning** | Splitting a hot session into multiple sub-keys (user_id + time_bucket) to distribute load while maintaining logical ordering via client-side merge |
| **Competing Consumers** | Pattern where multiple consumers pull from the same queue with no ordering; higher throughput but no ordering guarantees |
| **Partition Rebalancing** | Kafka process of redistributing partitions across consumer instances when instances join/leave; temporarily breaks per-partition ordering during rebalance |
| **Causal Ordering** | Stronger form of ordering where if event A caused event B, all consumers see A before B; not provided by Sequential Convoy (per-entity ordering only) |
| **FIFO Queue** | First-In-First-Out; AWS SQS FIFO guarantees order within a MessageGroupId; standard SQS makes no ordering guarantee |
