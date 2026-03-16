# Transactions & ACID Compliance

## MongoDB & ACID: Multi-Document Transactions

**WHAT**: How do MongoDB transactions work, and when should I use them?

**THEORY**:
- MongoDB 4.0+: **Multi-document transactions** (ACID compliant)
- **Single document**: always atomic (before & after states, no partial writes)
- **Multiple documents**: transactions ensure **all-or-nothing** semantics
- Trade-off: transactions add latency and reduce throughput (less performant)
- Best practice: **avoid transactions if possible** (design data to avoid them)

```javascript
const session = db.getMongo().startSession();
session.startTransaction();

try {
  // Transfer $100 from account A to B
  
  // Step 1: Debit account A
  db.accounts.updateOne(
    { accountId: "A" },
    { $inc: { balance: -100 } },
    { session: session }
  );
  
  // Step 2: Credit account B
  db.accounts.updateOne(
    { accountId: "B" },
    { $inc: { balance: 100 } },
    { session: session }
  );
  
  session.commitTransaction();
  console.log("Transfer successful");
} catch (error) {
  session.abortTransaction();
  console.error("Transfer failed:", error);
} finally {
  session.endSession();
}

// Guarantee: BOTH updates succeed, or BOTH rollback
// No partial state (A debited, but B not credited)
```

---

## When to Use Transactions (7+ Years Perspective)

### Use Case 1: Money Transfer

```javascript
// REQUIREMENTS: transfer must be atomic
// Account A: balance $1000 → $900
// Account B: balance $500 → $600

// Without transaction: risk of crash between updates
// With transaction: guaranteed consistency

const session = db.getMongo().startSession();
session.startTransaction();
db.accounts.updateOne({ _id: "A" }, { $inc: { balance: -100 } }, { session });
// ^ Crash here = Account A debited, Account B not credited (LOST $100!)
db.accounts.updateOne({ _id: "B" }, { $inc: { balance: 100 } }, { session });
session.commitTransaction();
```

### Use Case 2: Create Order + Deduct Inventory

```javascript
const session = db.getMongo().startSession();
session.startTransaction();

try {
  // Create order
  const orderResult = db.orders.insertOne({
    customerId: customerId,
    items: [{ productId: "PROD-001", quantity: 5, price: 100 }],
    total: 500,
    status: "pending"
  }, { session });

  // Deduct inventory (must succeed or entire transaction fails)
  const updateResult = db.inventory.updateOne(
    { productId: "PROD-001" },
    { $inc: { stock: -5 } },
    { session }
  );

  if (updateResult.matchedCount === 0) {
    throw new Error("Product not found");
  }
  
  session.commitTransaction();
  console.log("Order created, inventory updated");
} catch (error) {
  session.abortTransaction();
  console.error("Order failed:", error);
}
```

---

## When NOT to Use Transactions

### ❌ Avoid: Transactions for Performance Queries

```javascript
// WRONG: Using transaction for read-only aggregation
const session = db.getMongo().startSession();
session.startTransaction();

const result = db.orders.aggregate([
  { $match: { status: "completed" } },
  { $group: { _id: null, total: { $sum: "$amount" } } }
], { session }).toArray();

session.commitTransaction();

// ISSUE: Transaction adds latency for no reason
// Aggregation is read-only, doesn't need atomicity
```

### ❌ Avoid: Large Transactions

```javascript
// WRONG: Processing huge batch in transaction
const session = db.getMongo().startSession();
session.startTransaction();

// Update 1 million documents!
db.orders.updateMany(
  { processed: false },
  { $set: { processed: true } },
  { session }
);

session.commitTransaction();

// ISSUE: Locks too much memory, slow, ties up resources
// Better: process in batches without transaction
```

---

## Isolation Levels

**WHAT**: What does "isolation" mean in MongoDB transactions?

**THEORY**:
- MongoDB transactions default to **SNAPSHOT isolation**
- **SNAPSHOT**: transaction sees consistent view at start time
- Other concurrent transactions don't interfere
- Prevents: dirty reads, non-repeatable reads, phantom reads

```javascript
// Transaction A: Transfer from Account A
session1.startTransaction();
db.accounts.updateOne({ accountId: "A" }, { $inc: { balance: -100 } }, { session: session1 });

// Transaction B: Query Account A balance (concurrent)
session2.startTransaction();
const balance = db.accounts.findOne({ accountId: "A" }, { session: session2 });
// Returns snapshot BEFORE Transaction A's update (isolation!)

session1.commitTransaction();  // Now Account A shows new balance

// Transaction B reading again gets old value (snapshot isolation)
// No dirty read (reading uncommitted changes)
```

---

## Transaction Rollback & Side Effects

**WHAT**: What happens when I roll back a transaction?

**THEORY**:
- Transaction **rollback reverses all writes**
- BUT: **external side effects** (API calls, emails) still execute
- **Idempotency required**: assume operation might repeat

```javascript
const session = db.getMongo().startSession();
session.startTransaction();

try {
  // Update inventory
  db.inventory.updateOne(
    { productId: "PROD-001" },
    { $inc: { stock: -5 } },
    { session }
  );

  // External API call (OUTSIDE transaction)
  const paymentResult = callStripeAPI({ amount: 500 });  // HAPPENS OUTSIDE DB
  
  if (!paymentResult.success) {
    throw new Error("Payment failed");
  }

  // Create order
  db.orders.insertOne({
    customerid: customerId,
    orderId: orderId,
    total: 500
  }, { session });

  session.commitTransaction();
} catch (error) {
  session.abortTransaction();
  // Inventory & order are rolled back
  // BUT: Stripe charge already processed (side effect remains!)
  // SOLUTION: Mark order as failed, create refund transaction
}
```

**Best Practice**: Process external side effects AFTER database commit

```javascript
// CORRECT approach
session.startTransaction();
try {
  // 1. Update database first
  db.inventory.updateOne({ productId: "PROD-001" }, { $inc: { stock: -5 } }, { session });
  db.orders.insertOne({ customerId, orderId }, { session });
  
  // 2. Commit database changes
  session.commitTransaction();
  
  // 3. THEN handle external side effects
  const emailResult = sendConfirmationEmail(customerId);
  const slackResult = notifyWarehouse(orderId);
  
  // If external APIs fail, order is already created
  // (can retry side effects, but DB state is correct)
} catch (error) {
  session.abortTransaction();
  // Database changes rolled back before side effects
}
```

---

## Transaction Limitations & Constraints

| Constraint | Impact | Workaround |
|-----------|--------|-----------|
| Max 5 minutes | Transaction auto-aborts | Split into smaller batches |
| Single shard | Only single replica set | Use transactions carefully in sharded clusters |
| No DDL | Can't create indexes in transaction | Create indexes separately |
| Document size | 16 MB per document | Embed less data |
| Performance | 10-30% latency increase | Avoid unnecessary transactions |

---

## When to Use Transactions: Decision Tree

```
Query: Do I need ACID consistency across multiple documents?

├─ YES: Are these writes always together in business logic?
│  ├─ YES: Is data frequency small/bounded?
│  │  ├─ YES: Try embedding (denormalization) - avoid transaction
│  │  └─ NO: Use transaction
│  └─ NO: Redesign schema or use separate operations
└─ NO: Use individual document writes (single document is atomic)
```

---

## Time Complexity: Transactions

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Transaction startup | O(1) | Minimal overhead |
| Read within transaction | O(log n) | Same as normal query |
| Write within transaction | O(log n) | Same as normal write |
| Commit | O(k) | k = number of writes |
| Rollback | O(k) | Reverses all k writes |
