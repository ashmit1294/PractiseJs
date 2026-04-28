# 04 — Compensating Transaction Pattern

> **Module**: M12 — Reliability Patterns  
> **Section**: Section 1 — Resiliency Patterns  
> **Source**: https://layrs.me/course/hld/12-reliability-patterns/compensating-transaction  
> **Difficulty**: Intermediate | 12 min read

---

## 1. ELI5 — Explain Like I'm 5

Imagine ordering pizza: the shop takes your money (step 1) and assigns a delivery driver (step 2). If the driver can't reach you (step 3 fails), they don't just freeze. They release the driver back to work (undo step 2) and refund your money (undo step 1). Each step has an "undo" action.

That's a compensating transaction: a multi-step process where each step has a defined reverse operation, so when something fails midway, you can roll back what you've done — without needing everyone to wait locked in place.

---

## 2. The Analogy

**Compensating Transactions = Trip cancellation with refunds.**

When you book a flight + hotel + car together:
- Book flight ✅ → store compensation: `cancelFlight(bookingId)`
- Book hotel ✅ → store compensation: `cancelHotel(bookingId)`  
- Book car ❌ (no cars available)
- Execute compensations in reverse: `cancelHotel(bookingId)` → `cancelFlight(bookingId)`

Nothing was permanently locked. Each step committed immediately. The compensations are separate forward operations that reverse the effect — "semantic rollback."

---

## 3. Core Concept

The **Compensating Transaction pattern** enables distributed rollback in microservices by executing reverse operations when multi-step workflows fail.

### The Problem with 2PC (Two-Phase Commit):
```
2PC Coordinator: "Prepare to commit"
   Service A: "Prepared" (locks inventory)
   Service B: "Prepared" (locks payment account)
   Service C: "Prepared" (locks shipping slot)
— ALL LOCKED for duration of coordination —
   Service B: slow response... 2s... 5s... timeout
   All services remain locked while waiting
Result: availability ≠ acceptable for multi-second business flows
```

### Compensating Transaction Solution (Saga Pattern):
```
Step 1: Service A commits immediately (no lock on other services)
Step 2: Service B commits immediately
Step 3: Service C fails
→ Execute: Compensation B → Compensation A (in reverse order)
→ Each compensation is a new forward operation (not a DB rollback)
```

### Key Properties:
- **Semantic rollback** — NOT a database ROLLBACK; creates new forward records (refund = new record)
- **Eventual consistency** — between compensation start and completion, system is temporarily inconsistent
- **Idempotency required** — compensations must be safe to execute multiple times (same compensation executed twice = same result)
- **Audit trail preserved** — original transaction + compensation both recorded in history

---

## 4. ASCII Architecture

### Saga Forward + Compensation Flow

```
Booking Saga: Reserve → Charge → Notify

   [ORCHESTRATOR]
        │
        ├───── T1: POST /inventory/reserve ──→ [Inventory Service]  → Committed ✅
        │                                       compensation: C1 = POST /inventory/release
        │
        ├───── T2: POST /payments/charge ───→ [Payment Service]     → Committed ✅
        │                                       compensation: C2 = POST /payments/refund
        │
        └───── T3: POST /notifications/send → [Notification Service] → FAILED ❌

   ← Compensation Phase (reverse order):
        │
        ├───── C2: POST /payments/refund ───→ [Payment Service]     → Completed ✅
        │
        └───── C1: POST /inventory/release → [Inventory Service]    → Completed ✅

   Final State: booking reversed, no locks held, audit trail complete
```

### Orchestration vs Choreography

```
ORCHESTRATION (central coordinator):
   [Saga Coordinator]
     ├── calls → Service A (T1)
     ├── calls → Service B (T2)
     ├── hears error from C, calls → Service B (C2)
     └── calls → Service A (C1)
   Coordinator holds the state machine

CHOREOGRAPHY (event-driven):
   Service A ──publish: "InventoryReserved" ──→ Service B
   Service B ──publish: "PaymentCharged"   ──→ Service C
   Service C fails ──publish: "ShipmentFailed" ──→ Service B (listens)
   Service B ──publish: "PaymentRefunded"  ──→ Service A (listens)
   Service A ──publish: "InventoryReleased"
   No central coordinator; each service knows its compensations
```

---

## 5. How It Works

**Step 1: Forward Execution**
Each service performs local transaction immediately and commits. No distributed lock. No waiting for other services.

**Step 2: Failure Detection**
Orchestrator detects service C failure via: HTTP error, timeout, dead-letter queue message, or absence of success event.

**Step 3: Compensation Dispatch**
Orchestrator executes compensations in reverse order (C_n-1, C_n-2, …, C_1). Each compensation has a unique `compensationId` for idempotency.

**Step 4: Idempotency Check**
Before executing compensation, check: `SELECT * FROM compensation_log WHERE compensation_id = ?`. If already executed → skip (return success). If not executed → run and record.

**Step 5: Compensation Failure Handling**
If compensation C2 fails, retry with exponential backoff. If all retries exhausted → send to dead-letter queue for manual resolution. Log: who, what, when, why.

**Step 6: Semantic Rollback Completes**
System reaches eventual consistency. Audit trail shows: T1 + T2 + C2 + C1 all as separate records.

---

## 6. Variants

### Orchestration-Based Saga
- Central coordinator (saga orchestrator) holds the state machine
- Explicitly calls each service step and knows compensation sequence
- Pros: easy to track state, explicit control flow, simple debugging
- Cons: orchestrator is SPOF; tight coupling to coordinator
- **Use when**: >5 steps, conditional logic, single team, tight SLA
- **Tools**: AWS Step Functions, Temporal.io, Conductor, custom DB-backed state machine

### Choreography-Based Saga
- Services coordinate via events/messages; no central controller
- Each service listens for success/failure events and triggers the next step or compensation
- Pros: decoupled, scales naturally, event-driven architectures
- Cons: distributed complexity, harder to debug (distributed trace required), difficult conditional logic
- **Use when**: simple linear flow (3 steps), multiple teams, pre-existing event bus
- **Tools**: Kafka, RabbitMQ, AWS EventBridge + SNS

### Hybrid Approach
- Orchestrate critical core path (reservation + payment)
- Choreograph secondary effects (analytics, email, audit log)
- **Used by**: Airbnb (orchestrates booking core, choreographs secondary effects)

---

## 7. Trade-offs

### Consistency vs Availability
| 2PC / Distributed Transactions | Saga / Compensating Transactions |
|------|------|
| Strong consistency (ACID) | Eventual consistency |
| All services locked during coordination | Services lock only for local transaction |
| Availability bottleneck | High availability |
| Single team, same DB cluster | Multiple teams, multiple services |

### Idempotency Overhead
- Requires deduplication table per service
- Every compensation checks log before executing
- Adds **+10-20% latency** per compensation step
- Adds **+5-10% storage** for deduplication log
- Non-negotiable: without idempotency, duplicate compensations corrupt data

### Isolation Gap
- Sagas don't provide isolation — **dirty reads possible**
- Between T1 committing and C1 executing, another transaction can observe intermediate state
- Fix: "semantic locks" (soft reservations), "pessimistic sagas" (mark record as "pending"), or accept the gap and design UI to handle it

### Compensation Failures
- If compensation itself fails → retry with exponential backoff (3×, delays: 1s, 2s, 4s)
- After max retries → dead-letter queue → manual intervention
- Must alert operations team: compensation stuck = inconsistent data remains

---

## 8. When to Use / When to Avoid

### ✅ Use When:
- Multi-step workflows that span multiple services or databases
- Long-running business processes (booking, order fulfillment) where 2PC timeout is unacceptable
- Services owned by different teams (can't use shared DB for 2PC)
- Workflow execution > 100ms (too long to hold distributed locks)

### ❌ Avoid When:
- **Single service, single DB**: use local database transaction (ACID — simpler, correct)
- **Strict consistency required**: bank account transfers where double-spend must be impossible
- **Uncompensatable operations**: email already sent, SMS delivered, external payment processed without idempotency key — can't be recalled
- **High-contention resources**: sagas lack isolation; pessimistic locking more appropriate

---

## 9. MERN Dev Notes

### Saga Orchestrator with Compensation Log (Node.js)

```javascript
// In-memory saga orchestrator (production: use persistent store + DB)
class SagaOrchestrator {
  constructor(sagaId) {
    this.sagaId = sagaId;
    this.steps = [];          // [{ name, action, compensation, status }]
    this.compensationLog = new Map(); // compensationId → result
  }
  
  addStep(name, action, compensation) {
    this.steps.push({ name, action, compensation, status: 'pending' });
    return this;
  }
  
  async execute() {
    const completed = [];
    
    for (const step of this.steps) {
      try {
        console.log(`[Saga:${this.sagaId}] Executing: ${step.name}`);
        await step.action();
        step.status = 'completed';
        completed.push(step);
        console.log(`[Saga:${this.sagaId}] ✅ Completed: ${step.name}`);
      } catch (err) {
        console.error(`[Saga:${this.sagaId}] ❌ Failed: ${step.name} — ${err.message}`);
        step.status = 'failed';
        await this._compensate(completed);
        throw new Error(`Saga ${this.sagaId} failed at ${step.name}, compensated.`);
      }
    }
    
    return { sagaId: this.sagaId, status: 'completed' };
  }
  
  async _compensate(completedSteps) {
    // Execute compensations in reverse order
    for (const step of [...completedSteps].reverse()) {
      const compensationId = `${this.sagaId}:${step.name}:compensation`;
      
      // Idempotency check
      if (this.compensationLog.has(compensationId)) {
        console.log(`[Saga:${this.sagaId}] Skipping duplicate compensation: ${step.name}`);
        continue;
      }
      
      try {
        await this._retryCompensation(compensationId, step);
        this.compensationLog.set(compensationId, { status: 'completed', ts: Date.now() });
        console.log(`[Saga:${this.sagaId}] ↩️ Compensated: ${step.name}`);
      } catch (err) {
        // Compensation failed — requires manual intervention
        this.compensationLog.set(compensationId, { status: 'failed', err: err.message });
        console.error(`[Saga:${this.sagaId}] STUCK: ${step.name} compensation FAILED — manual intervention needed`);
        // Alert: send to dead-letter queue or PagerDuty
      }
    }
  }
  
  async _retryCompensation(id, step, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await step.compensation();
        return;
      } catch (err) {
        if (attempt === maxRetries) throw err;
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
}

// Usage: Booking saga
async function bookingWorkflow(userId, roomId, amount) {
  const sagaId = `booking-${userId}-${Date.now()}`;
  let reservationId, paymentId;
  
  const saga = new SagaOrchestrator(sagaId)
    .addStep(
      'reserve-inventory',
      async () => { reservationId = await inventoryService.reserve(roomId); },
      async () => { await inventoryService.release(reservationId); }
    )
    .addStep(
      'charge-payment',
      async () => { paymentId = await paymentService.charge(userId, amount); },
      async () => { await paymentService.refund(paymentId); }
    )
    .addStep(
      'create-booking-record',
      async () => { await bookingDB.create({ userId, roomId, paymentId, reservationId }); },
      async () => { await bookingDB.cancel({ userId, roomId }); }
    );
  
  return await saga.execute();
}
```

### Idempotency Key Middleware (Express)

```javascript
const idempotencyStore = new Map(); // Production: Redis with TTL

const idempotencyMiddleware = (req, res, next) => {
  const key = req.headers['idempotency-key'];
  if (!key) return next();
  
  if (idempotencyStore.has(key)) {
    const cached = idempotencyStore.get(key);
    return res.status(cached.status).json(cached.body);
  }
  
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    idempotencyStore.set(key, { status: res.statusCode, body });
    return originalJson(body);
  };
  
  next();
};

router.post('/payments/refund', idempotencyMiddleware, async (req, res) => {
  const { paymentId, amount } = req.body;
  const refund = await paymentService.processRefund(paymentId, amount);
  res.json({ refundId: refund.id, status: 'refunded' });
});
```

---

## 10. Real-World Examples

### Uber — Trip Request Saga
- Orchestrated saga: Request Ride → Match Driver → Charge Payment → Create Trip Record
- Failure: Payment fails after driver matched → compensation releases driver to available pool
- Optimization: "Soft reservation" — driver tentatively assigned (not hard-committed) reduces compensation frequency
- Result: ~0.1% of sagas need compensation; 99.9% complete forward path successfully

### Airbnb — Booking Saga
- Orchestration for critical path: inventory reservation + payment charge
- Choreography for secondary effects: analytics update, host notification, calendar sync
- Versioned compensations: if compensation logic changes, old saga records still reference correct version
- Guard against race conditions: "pending" status on inventory record as semantic lock

### Netflix — Content Encoding Saga
- Video upload → transcoding → thumbnail extraction → quality check → publishing
- If transcoding completes but thumbnail fails: Netflix uses "forward recovery" (retry thumbnail with different parameters)
- Full compensation only if video data corruption detected at quality check step
- Insight: choose forward recovery over compensation when step can be retried with modified input

---

## 11. Interview Cheat Sheet

### One-Liner
> "Compensating transactions enable distributed rollback by executing reverse operations (compensations) in reverse sequence when a multi-step workflow fails. Each service commits its local transaction immediately — no distributed locks — trading ACID for high availability with eventual consistency."

### Saga vs 2PC:
| | 2PC | Saga |
|--|--|--|
| Consistency | Strong (ACID) | Eventual |
| Availability | Low (all lock) | High |
| Coupling | Tight | Loose |
| Scale | Single cluster | Cross-service, cross-team |

### Must Know Patterns:
- **Orchestration**: central coordinator, easier to debug, SPOF risk
- **Choreography**: event-driven, decoupled, harder to debug
- **Idempotency**: mandatory for compensations — use unique IDs + deduplication table
- **Semantic rollback**: NOT a database ROLLBACK — a new forward business operation

### When They Ask "How Do You Handle Compensation Failures":
1. Retry with exponential backoff (3 attempts: 1s, 2s, 4s)
2. After max retries → dead-letter queue
3. Alert on-call team (PagerDuty / OpsGenie)
4. Manual intervention + resolution playbook

---

## 12. Red Flags + Keywords

### Red Flags to Avoid

❌ **"Sagas provide ACID guarantees"** — They don't. Sagas offer eventual consistency; isolation is NOT provided

❌ **"Compensating transaction = database ROLLBACK"** — It's a new forward business operation. It creates new records and preserves full audit trail

❌ **"Compensations always succeed"** — They can fail too. Must handle compensation failures with retries and dead-letter queues

❌ **"Choreography is always better because it's decoupled"** — For complex workflows with >5 steps, conditional logic, or tight SLAs → orchestration is better

❌ **"Idempotency is optional"** — Without idempotency, duplicate compensations double-refund or double-cancel; it is mandatory

### Keywords / Glossary

| Term | Meaning |
|------|---------|
| **Compensating Transaction** | A reverse operation that undoes a previous transaction's effect |
| **Saga Pattern** | Sequence of local transactions with defined compensations |
| **Semantic Rollback** | Compensation via new forward operations (not DB ROLLBACK) |
| **Two-Phase Commit (2PC)** | Distributed protocol where all participants lock and wait for coordinator decision |
| **Orchestration** | Central coordinator explicitly invokes each saga step |
| **Choreography** | Services coordinate via events without central coordinator |
| **Idempotency** | Property: executing the same operation N times = same result as 1 time |
| **Idempotency Key** | Unique identifier per operation to detect duplicates |
| **Deduplication Table** | Store of already-executed compensation IDs to prevent re-execution |
| **Dead-Letter Queue** | Queue for messages/compensations that failed after all retries |
| **Soft Reservation** | Tentative hold (not hard commit) to reduce compensation frequency |
| **Forward Recovery** | Retry with modified parameters instead of compensating and restarting |
| **Eventual Consistency** | System reaches consistent state after some delay (no guarantee of when) |
| **Dirty Read** | Reading intermediate uncommitted state from another transaction |
| **Semantic Lock** | Application-level lock (e.g., `status: PENDING`) to prevent concurrent modifications |
| **Temporal.io** | Workflow orchestration platform with built-in saga support and persistent state |
| **AWS Step Functions** | Serverless orchestration service with saga pattern support |
