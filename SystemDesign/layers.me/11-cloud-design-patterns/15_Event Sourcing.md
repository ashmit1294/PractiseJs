# T15 — Event Sourcing: Immutable Event Log as Source of Truth

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/event-sourcing

---

## ELI5 (Explain Like I'm 5)

Imagine your bank account. Instead of just showing "Balance: $500", the bank keeps every single transaction ever: "Deposited $1000 on Jan 1. Withdrew $200 on Jan 5. Deposited $300 on Jan 10. Withdrew $600 on Jan 15." The balance $500 is calculated from all those transactions. If you add up all the transactions, you always arrive at the same balance.

Event Sourcing is exactly this. Instead of storing *current state*, you store every *event* that changed state. Current state = replay all events from beginning.

---

## Analogy

A **Git repository**: Git doesn't store snapshots of each file replacing the previous one. Git stores every commit (event) — what changed, when, by whom. The current codebase state is the result of applying all commits in sequence. You can replay history, rewind to any point (`git checkout abc123`), create branches at any historical point. Event Sourcing is Git for your application data.

---

## Core Concept

In a traditional system: when an order is cancelled, you `UPDATE orders SET status='CANCELLED'`. The previous state is gone.

In Event Sourcing: you `INSERT INTO events (aggregate_id, type, data, timestamp)` `('order-789', 'OrderCancelled', {...}, now())`. The previous state is preserved. Current state = replay all events.

**Key principles:**
1. Events are **immutable facts** — they describe what happened, not instructions
2. `ORDER` is current state; `OrderPlaced + ItemAdded + AddressUpdated + OrderCancelled` is the event log
3. You never UPDATE or DELETE events — append compensating events instead
4. State at any point in time = replay events up to that timestamp
5. Multiple different read models can be built independently from the same event log

---

## ASCII Diagrams

### Event Store vs Traditional DB

```
TRADITIONAL (current state only):
  orders table
  ┌──────────┬──────────────┬────────┬─────────┐
  │ order_id │ status       │ total  │ updated │
  ├──────────┼──────────────┼────────┼─────────┤
  │ 789      │ CANCELLED    │ 120.00 │ Jan 15  │
  └──────────┴──────────────┴────────┴─────────┘
  ← Previous state (placed, then modified) is GONE forever

EVENT STORE (complete history):
  events table
  ┌──────┬────────────┬───────────────────┬──────────────────────────────┬──────────┐
  │ seq  │ aggregate  │ event_type        │ data                         │ time     │
  ├──────┼────────────┼───────────────────┼──────────────────────────────┼──────────┤
  │  1   │ order-789  │ OrderPlaced       │ {"total":120, "items":[...]} │ Jan 10   │
  │  2   │ order-789  │ ItemAdded         │ {"sku":"ABC", "price":15}    │ Jan 11   │
  │  3   │ order-789  │ AddressUpdated    │ {"city":"Dallas"}            │ Jan 12   │
  │  4   │ order-789  │ PaymentProcessed  │ {"amount":135, "card":"***"} │ Jan 13   │
  │  5   │ order-789  │ OrderCancelled    │ {"reason":"customer request"}│ Jan 15   │
  └──────┴────────────┴───────────────────┴──────────────────────────────┴──────────┘
  
Current state = apply events 1+2+3+4+5
State at Jan 12 = apply events 1+2+3 only ← TIME TRAVEL!
```

### State Reconstruction

```
rebuild_order('order-789'):
  
  events = load_events('order-789')
  order = new Order() // empty
  
  for each event:
    apply(event) to order
    
  Event 1: OrderPlaced    → order.status = PENDING; order.items = [...]
  Event 2: ItemAdded      → order.items.push(ABC)
  Event 3: AddressUpdated → order.address = Dallas
  Event 4: PaymentProcessed → order.status = PAID; order.paymentId = xxx
  Event 5: OrderCancelled  → order.status = CANCELLED; order.cancelReason = ...
  
  return order // current state ✅
```

### Snapshot Optimization

```
Without snapshot (1,000 events):
  Replay event 1 → 2 → 3 → ... → 1,000
  = 1,000 apply() calls every time you load this aggregate
  
With snapshot (every 100 events):
  snapshot_at_event_900: { status: PAID, total: 135, address: Dallas, ... }
  
  Load: snapshot(900) + events 901 → 1,000
  = snapshot restore + 100 apply() calls
  = 10x faster
  
Snapshot is pure optimization — can always delete snapshots
and rebuild from raw events
```

---

## How It Works (Step by Step)

1. **Command arrives**: `CancelOrderCommand { orderId: 789, reason: "changed mind" }`.

2. **Load current state from events**: Execute `SELECT * FROM events WHERE aggregate_id = 'order-789' ORDER BY seq`. Replay events to build current Order object in memory.

3. **Validate command against current state**: Is it valid to cancel this order? (Not already shipped, not already cancelled.)

4. **Produce new event**: `OrderCancelled { orderId: 789, reason, cancelledAt: now() }`.

5. **Append event to store**: `INSERT INTO events (...) VALUES (...)`. This is the ONLY write operation.

6. **Publish domain event** to message broker for read model projections to consume.

7. **Read models update asynchronously**: Dashboard projection marks order status cancelled. Email projection sends cancellation confirmation.

---

## Variants

| Variant | Architecture | Best For |
|---------|-------------|----------|
| **Event Sourcing + CQRS** | Events on write side; multiple read models on query side | Most common production setup; separate teams, scale read/write independently |
| **Event Sourcing without CQRS** | Single read/write model reading from event store | Smaller aggregates (<100 events); simpler; audit trail without projection complexity |
| **Hybrid** | Both current state (SQL row) AND event log maintained | Fast reads + full history; but two sources of truth to keep in sync — complex |
| **Temporal Queries** | Use event store as primary query mechanism; "what was state at time T?" | Compliance, financial auditing, dispute resolution |

---

## Trade-offs

| Dimension | Event Sourcing | Traditional (State-Based) |
|-----------|---------------|--------------------------|
| **Audit trail** | Built-in, complete, immutable | Requires separate audit table; often incomplete |
| **Temporal queries** | Native — replay to any point | Difficult; requires CDC or audit log |
| **Debugging** | Replay events → reproduce any historical state | Hard to reproduce past states |
| **Read performance** | Slow without snapshots (full replay); excellent with read model projections | Fast (direct query) |
| **Write simplicity** | ONE write (append) | Multiple updates, joins, locking |
| **Schema evolution** | Complex — old events must be upcastable forever | Simpler — migration affects only current state |
| **GDPR compliance** | Hard — immutable log; needs crypto-shredding | Easy — DELETE or anonymize rows |
| **Team experience required** | High | Low |

---

## When to Use (and When Not To)

**Use when:**
- **Audit requirements are non-negotiable**: Banking, healthcare, fintech — must prove what happened and when
- **Business logic depends on history**: Fraud detection (is this transaction pattern consistent with past behavior?), dispute resolution ("prove you updated that record")
- **Temporal queries are valuable**: "What was the account balance on March 15?" — Stripe does this for financial reconciliation
- **Multiple consumers, multiple views**: Same order event feeds inventory, billing, fulfillment, analytics — each with their own projection
- **Event-driven microservices integration**: Events are the native integration contract

**Avoid when:**
- Simple CRUD application with no audit requirement
- Team is unfamiliar with event sourcing — debugging is very different (you trace events, not DB rows)
- High event volume per aggregate (>10,000 events) without snapshot strategy — reconstruction becomes expensive
- GDPR or data deletion requirements are burdensome — always think through crypto-shredding strategy first

---

## MERN Developer Notes

```javascript
// Event Sourcing core primitives in Node.js

// ===== EVENT STORE (PostgreSQL) =====
// Schema:
// CREATE TABLE events (
//   seq BIGSERIAL PRIMARY KEY,
//   aggregate_id TEXT NOT NULL,
//   aggregate_type TEXT NOT NULL,
//   event_type TEXT NOT NULL,
//   data JSONB NOT NULL,
//   metadata JSONB DEFAULT '{}',
//   timestamp TIMESTAMPTZ DEFAULT NOW()
// );
// CREATE INDEX ON events (aggregate_id, seq);

const db = require('./db');
const { publishEvent } = require('./eventBus');

// ===== APPEND EVENT =====
async function appendEvent(aggregateId, aggregateType, eventType, data, metadata = {}) {
  const result = await db.query(
    `INSERT INTO events (aggregate_id, aggregate_type, event_type, data, metadata)
     VALUES ($1, $2, $3, $4, $5) RETURNING seq, timestamp`,
    [aggregateId, aggregateType, eventType, JSON.stringify(data), JSON.stringify(metadata)]
  );
  const event = { seq: result.rows[0].seq, aggregateId, eventType, data, timestamp: result.rows[0].timestamp };
  await publishEvent(eventType, event); // async fan-out to projections
  return event;
}

// ===== LOAD EVENTS / REBUILD STATE =====
async function loadOrderEvents(orderId) {
  const result = await db.query(
    'SELECT * FROM events WHERE aggregate_id = $1 ORDER BY seq ASC',
    [orderId]
  );
  return result.rows;
}

function rebuildOrder(events) {
  let order = { status: null, items: [], address: null, total: 0, paymentId: null };
  for (const event of events) {
    switch (event.event_type) {
      case 'OrderPlaced':
        order.status = 'PENDING';
        order.items = event.data.items;
        order.total = event.data.total;
        break;
      case 'ItemAdded':
        order.items.push(event.data.item);
        order.total += event.data.item.price;
        break;
      case 'AddressUpdated':
        order.address = event.data.address;
        break;
      case 'PaymentProcessed':
        order.status = 'PAID';
        order.paymentId = event.data.paymentId;
        break;
      case 'OrderCancelled':
        order.status = 'CANCELLED';
        order.cancelReason = event.data.reason;
        break;
    }
  }
  return order;
}

// ===== COMMAND HANDLER — Cancel Order =====
async function cancelOrderCommand({ orderId, reason, userId }) {
  // 1. Rebuild current state
  const events = await loadOrderEvents(orderId);
  if (!events.length) throw new Error('Order not found');
  const order = rebuildOrder(events);

  // 2. Validate
  if (order.status === 'CANCELLED') throw new Error('Order already cancelled');
  if (order.status === 'SHIPPED') throw new Error('Cannot cancel shipped order');

  // 3. Append new event (ONLY write operation)
  return appendEvent(orderId, 'Order', 'OrderCancelled', { reason, cancelledBy: userId });
}

// ===== SNAPSHOT (performance optimization) =====
async function saveSnapshot(orderId, state, atSeq) {
  await db.query(
    `INSERT INTO snapshots (aggregate_id, state, at_seq)
     VALUES ($1, $2, $3) ON CONFLICT (aggregate_id) DO UPDATE SET state=$2, at_seq=$3`,
    [orderId, JSON.stringify(state), atSeq]
  );
}

async function loadWithSnapshot(orderId) {
  // 1. Load latest snapshot
  const snapResult = await db.query(
    'SELECT * FROM snapshots WHERE aggregate_id = $1',
    [orderId]
  );
  const snapshot = snapResult.rows[0];
  const fromSeq = snapshot ? snapshot.at_seq + 1 : 0;

  // 2. Load only events after snapshot
  const events = await db.query(
    'SELECT * FROM events WHERE aggregate_id = $1 AND seq >= $2 ORDER BY seq',
    [orderId, fromSeq]
  );

  // 3. Rebuild from snapshot state + remaining events
  const baseState = snapshot ? JSON.parse(snapshot.state) : { items: [], total: 0, status: null };
  return rebuildOrder(events.rows);
}

// ===== GDPR: CRYPTO-SHREDDING =====
// Encrypt PII in events with per-user key stored separately
// When user requests deletion: delete their encryption key
// Events remain in store but contain only unreadable encrypted blobs
// Compliant with GDPR "right to erasure" without mutating immutable events

const crypto = require('crypto');
async function encryptUserData(userId, data) {
  const key = await getUserEncryptionKey(userId); // per-user key from key store
  const cipher = crypto.createCipher('aes-256-gcm', key);
  return cipher.update(JSON.stringify(data), 'utf8', 'hex') + cipher.final('hex');
}
// On GDPR deletion: deleteEncryptionKey(userId) — data is unreachable ✅
```

---

## Real-World Examples

| Company | Scale | Implementation | Key Insight |
|---------|-------|---------------|------------|
| **Uber** | Petabytes of trip events across all time | Event store per trip; snapshot every **10 events** (trips are short, but they have billions of trips). Tiered storage: hot trips on NVMe SSD, completed trips on S3. Event upcasting for schema changes over 5+ years. | Snapshot every 10 events keeps reconstruction to <10 `apply()` calls. S3 cold storage for old trips (cheap). Upcasting handles old event schemas without rewriting history. |
| **Stripe** | Financial ledger — every charge, refund, dispute | Event log with as-of queries: `SELECT * FROM events WHERE aggregate_id = $1 AND timestamp <= $2`. Binary search by aggregate ID + timestamp for any historical balance. | "What was this customer's balance on March 15?" → binary search in sorted events by timestamp. No special infrastructure needed — sorted append-only log is already the right data structure. |
| **LinkedIn** | Member profile changes at scale | Profile update event fans out to 3+ read models: Galene (full-text search), PYMK (People You May Know — graph recommendations), profile view (HTML rendering). Same event → different schemas per consumer. | One AppendEvent call → three completely different views updated independently. Each can evolve its schema independently without touching others. |
| **Financial Systems (generic)** | Banking ledger | Events: `MoneyDeposited`, `MoneyWithdrawn`, `TransferInitiated`, `TransferCompleted`. Balance = sum of all debit/credit events. Compensating events: `PaymentReversed` — never delete the `PaymentProcessed` event. | Compensating events (not corrections) preserve the full history including the error. Auditors can see both the original transaction and the reversal. |

---

## Interview Cheat Sheet

### Q: What's the difference between Event Sourcing and just logging?
**A:** Logging is for diagnostics — humans read it for debugging. Event Sourcing treats events as **the source of truth for application state**. Events are structured domain facts that your application reads and replays to reconstruct state. You can delete logs without affecting the system. If you delete events in Event Sourcing, you lose state. Logs are observability; events are data persistence.

### Q: How do you handle GDPR "right to erasure" with an immutable event store?
**A:** **Crypto-shredding**: Encrypt all personal data in events using a per-user encryption key, stored separately in a key management service. When a user requests deletion, delete their encryption key. The events remain in the store but contain only unreadable encrypted blobs. The personal data is effectively erased because the decryption key is gone. The event metadata (timestamps, aggregate IDs) remains for audit integrity.

### Q: How do you handle schema changes when old events must still replay correctly?
**A:** **Event upcasting**: When loading old events, transform them to the new schema before applying to aggregate. Version all events. Write an upcaster function: `v1_to_v2(event)` that adds new fields with defaults or renames fields. Uber has 5+ years of trip events that go through upcasters during replay. Never modify stored events — always transform at read time.

### Q: What are snapshots and when should you use them?
**A:** Snapshots are persisted checkpoints of aggregate state at a specific event sequence number. Instead of replaying from event #1, you restore the snapshot and replay only events since the snapshot. Use when: aggregate has > 50 events and read performance matters. Snapshots are pure optimization — always rebuildable from events. Uber snapshots every 10 events for trip aggregates. Stripe doesn't need snapshots for ledger (uses binary search by timestamp instead).

### Q: Is Event Sourcing the same as Change Data Capture (CDC)?
**A:** No. CDC captures changes made by an existing traditional database as an outgoing stream — pragmatic integration tool. Event Sourcing designs the write model *around* events — events ARE the database. CDC is an afterthought; Event Sourcing is an architectural philosophy.

---

## Red Flags to Avoid

- "Event Sourcing requires CQRS" — they're separate patterns; you can use either without the other
- Saying you'd just `DELETE` an old event to fix a mistake — you append a compensating event instead
- Not mentioning snapshots when asked about large aggregates — 10,000 events replayed every read is a performance crisis
- Ignoring GDPR complexity — interviewers love asking this; "just delete the events" is wrong
- Not knowing the difference between event sourcing and event-driven architecture — event sourcing is a persistence pattern; EDA is an integration pattern
- "I'd use Event Sourcing for everything" — Red flag; it's complex; only appropriate for specific use cases

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Event Sourcing** | Persisting state as sequence of immutable events; current state = replay of all events |
| **Aggregate** | Group of domain objects treated as single unit; events describe aggregate state changes |
| **Domain Event** | Immutable fact describing a state change: OrderPlaced, PaymentProcessed, UserCreated |
| **Event Store** | Append-only database storing domain events; the source of truth |
| **Append-Only** | Events only added, never updated or deleted; fundamental constraint |
| **Event Replay** | Reconstructing state by applying events in sequence from beginning (or from snapshot) |
| **Snapshot** | Persisted checkpoint of aggregate state at sequence N; optimization to avoid full replay |
| **Upcasting** | Transforming old event schema to new schema at read time; handles schema evolution |
| **Compensating Event** | New event that logically reverses an earlier event; preserves history |
| **Projection** | Process subscribing to events to build/update a read model |
| **Temporal Query** | Query for state at a specific point in time; native in event sourcing |
| **Crypto-Shredding** | GDPR technique: encrypt PII in events, delete encryption key → data unreachable |
| **Event Upcasting** | Function transforming an old-schema event to current schema during replay |
| **Optimistic Concurrency** | Version check on append — reject if aggregate already updated since we last read |
| **CDC (Change Data Capture)** | Extract DB changes as events from existing DB (Debezium, etc.); different from event sourcing |
| **Event Log** | The append-only sequence of all events across all aggregates; the core data structure |
