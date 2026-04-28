# T10 — Scheduling Agent Supervisor Pattern

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/scheduling-agent-supervisor

---

## ELI5 (Explain Like I'm 5)

Imagine a big construction project. The **scheduler** (project manager) plans the work and assigns tasks: "electricians, do wiring; plumbers, install pipes." The **agents** (workers) do their assigned tasks. The **supervisor** (site inspector) walks around checking that everything is on track — if a worker hasn't responded in an hour, the supervisor notices and reassigns the task.

In software: when you need to coordinate 5 different microservices for one order (reserve inventory, charge payment, create shipment, send email), a scheduler sends the tasks, agents execute them, and a supervisor watches for failures and orchestrates recovery.

---

## Analogy

**Air traffic control**: The scheduler assigns gates and runways (dispatches work). Pilots (agents) execute landings. Air traffic controllers (supervisors) monitor radar — if a flight stops reporting position, they investigate and take action. No distributed transaction needed — just smart state tracking and recovery.

---

## Core Concept

The Scheduling Agent Supervisor pattern coordinates **multiple distributed operations as a single logical unit** without distributed transactions (2PC). Three distinct roles:

| Role | Responsibility | Example |
|------|---------------|---------|
| **Scheduler** | Break workflow into tasks; dispatch to agents; persist initial state | Creates `workflow_123`, enqueues tasks for each step |
| **Agent** | Execute one task against its service; report status; idempotent | `InventoryAgent` calls inventory API; reports success/failure |
| **Supervisor** | Monitor agent progress; detect timeouts/failures; orchestrate retry/compensate/escalate | Detects payment agent hasn't reported in 45s; queries Stripe directly |

**Key insight**: Eventual consistency instead of strong consistency. Instead of "all steps must succeed atomically NOW," the system ensures "all steps will eventually reach a consistent terminal state (succeeded or compensated)."

---

## ASCII Diagrams

### Architecture Overview

```
Control Plane:                          Data Plane:
┌──────────────────────────────┐        ┌────────────────────────────────────┐
│ Scheduler                    │        │ Agents (horizontally scalable)     │
│  - Creates workflow instance │        │                                    │
│  - Builds DAG of tasks       │──────► │ [InventoryAgent] → Inventory Svc   │
│  - Dispatches to Task Queue  │        │ [PaymentAgent]   → Stripe          │
└──────────────────────────────┘        │ [ShipmentAgent]  → FedEx API       │
                                        │ [NotifAgent]     → SendGrid        │
┌──────────────────────────────┐        └────────────────────────────────────┘
│ Supervisor                   │                  ▲ heartbeat reports
│  - Scans state store         │                  │
│  - Detects timeouts          │──────────────────┘
│  - Retry / Compensate        │
│  - Escalate to DLQ           │        ┌──────────────────┐
└──────────────────────────────┘        │ Workflow State DB │
                 │                      │ (PostgreSQL/DDB)  │
                 └─────────────────────►│ workflow_123:     │
                                        │  task1: succeeded │
                                        │  task2: in-progress│
                                        │  task3: pending   │
                                        └──────────────────┘
```

### Supervisor Failure Detection Decision Tree

```
Supervisor Scan Cycle (every N seconds):
  Query state store for in-progress tasks
          │
          ▼
  Task exceeded expected duration?
    ├── NO  → Continue monitoring
    └── YES →
          │
          ▼
  Recent heartbeat within threshold?
    ├── YES (still alive → slow operation) → Continue monitoring
    └── NO  →
          │
          ▼
  Query target service for actual status
    ├── Completed → Mark task complete, proceed to next step ✅
    └── Not completed / Unknown →
          │
          ▼
  Retry count < max (e.g., < 3)?
    ├── YES → Requeue task with exponential backoff
    └── NO  →
          │
          ▼
  Compensation defined?
    ├── YES → Dispatch compensation tasks (refund, cancel reservation)
    └── NO  → Move to DLQ, alert on-call engineer 🚨
```

### Workflow Execution Example (Order Fulfillment)

```
Order Placed → workflow_123

Task DAG:
  [reserve_inventory] → [charge_payment] → ┬── [create_shipment]
  (sequential)          (sequential)        └── [send_notification] (parallel)

State Store Timeline:
  t=0   reserve_inventory: IN_PROGRESS
  t=2s  reserve_inventory: SUCCEEDED (agent reports ✅)
  t=2s  charge_payment:    IN_PROGRESS (scheduler dispatches next)
  t=12s charge_payment:    TIMEOUT (agent silent for 45s - Stripe slow)
        Supervisor queries Stripe API → "charge succeeded!"
  t=13s charge_payment:    SUCCEEDED (supervisor reconciles ✅)
  t=13s create_shipment:   IN_PROGRESS
        send_notification: IN_PROGRESS (parallel)
  t=20s create_shipment:   FAILED (FedEx API down)
        Supervisor: retry 1 → retry 2 → retry 3 → compensate
  t=90s compensate:        [refund_payment] + [cancel_inventory]
  t=95s workflow_123:      COMPENSATED (notifies customer)
```

---

## How It Works (Step by Step)

1. **Workflow Initiation**: Scheduler creates `workflow_123` in state store with status `STARTED`. Builds a directed acyclic graph (DAG) of tasks with dependencies. Dispatches first task(s) to the queue with `{ workflowId, taskType, input, correlationToken }`.

2. **Agent Execution**: Agent pulls task, calls its service (Inventory API, Stripe, etc.). **Idempotency critical**: same task delivered twice must produce same outcome. Agent sends heartbeats: `"Task X for workflow Y still processing"`. On success: reports output data. On failure: reports structured error with error code.

3. **Supervisor Monitoring**: Separate process scans state store continuously for:
   - Tasks with no heartbeat past expected duration (e.g., payment: should complete in 30s, now 45s → investigate)
   - Tasks that reported failure
   - Agents that crashed without reporting anything

4. **Recovery Decision**: Supervisor consults workflow's recovery policy:
   - **Transient failure** (network timeout, temporary DB error) → retry with exponential backoff (max 3–5x)
   - **Timeout where service may have succeeded** → query service directly for actual status before retrying
   - **Business logic failure** (payment declined, inventory unavailable) → trigger compensation chain
   - **Unknown failure** → attempt one retry, then escalate to DLQ with full context

5. **Compensation**: When forward progress fails, supervisor dispatches compensation tasks as sub-workflow. Example: if shipment creation fails after payment → supervisor dispatches `refund_payment` + `cancel_inventory_reservation`. Compensation chain is tracked with same rigor as forward-progress chain.

6. **Completion**: When all tasks reach terminal state (all succeeded OR all compensated), supervisor marks workflow complete. Archives state for audit. Triggers final actions (analytics update, summary notification).

---

## Variants

| Variant | When to Use | Pros | Cons |
|---------|------------|------|------|
| **Centralized Supervisor + Distributed Agents** | Most cases; moderate volume (<100K active workflows) | Simple mental model; easy to debug | Supervisor bottleneck at extreme scale |
| **Distributed Supervisor (Sharded)** | >100K concurrent workflows; geographic distribution | Horizontally scalable; fault isolation per shard | Complex shard management; cross-shard workflows need coordination |
| **Embedded Supervisor (Temporal/Step Functions)** | Don't want to build coordination infrastructure; complex branching, long-running workflows | Battle-tested; visual debugging tools | Vendor lock-in; per-transition cost can be high at scale |

**Netflix Conductor Pull-Based variant**: Workers poll for tasks (`GET /tasks/encode`) rather than receiving pushed messages. Supervisor detects stuck tasks by timestamp, not heartbeats. Result: no heartbeat network overhead; overloaded workers stop polling to create natural backpressure.

---

## Trade-offs

| Dimension | Detail |
|-----------|--------|
| **Consistency** | Eventual consistency (not ACID). Workflow will reach consistent terminal state, but not atomically. |
| **Heartbeat overhead** | 5-second task with 500ms heartbeat = 10x more I/O than the real work. Relax for batch workflows (30-60s heartbeat). |
| **Retry vs. Compensate** | Retry for transient failures; compensate for semantic failures (business rule violations, resource exhaustion). Always set max retry count. |
| **Centralized vs. Distributed** | Start centralized. Distribute only when measured as bottleneck (>50K active workflows). Distributed adds significant ops complexity. |
| **CAP implications** | Supervisor needs CP (consistent state). Agents can be AP (available, partition-tolerant). Design accordingly. |

---

## When to Use (and When Not To)

**Use when:**
- Coordinating 3+ distributed operations as a logical unit without distributed transactions
- Individual steps can fail independently and require different recovery strategies
- Workflows are long-running (seconds to hours) — request-response patterns don't work
- Need audit trails and visibility into multi-step workflow progress (compliance, debugging)
- Operations are (or can be made) idempotent with compensating actions defined

**Avoid when:**
- Just 1-2 steps — simple retry logic with exponential backoff is sufficient
- Strict ACID transactions required — use a database transaction (or see Saga pattern)
- Latency critical (sub-millisecond) — state persistence and monitoring add overhead
- Operations aren't idempotent and can't be made so — the pattern relies on safe retries
- Working with legacy systems that can't report status or accept correlation tokens

---

## MERN Developer Notes

```javascript
// Workflow state stored in MongoDB
const workflowSchema = {
  workflowId: String,
  status: String, // STARTED | IN_PROGRESS | SUCCEEDED | COMPENSATED | FAILED
  tasks: [{
    taskId: String,
    taskType: String, // reserve_inventory | charge_payment | create_shipment
    status: String,   // PENDING | IN_PROGRESS | SUCCEEDED | FAILED
    input: Object,
    output: Object,
    retryCount: Number,
    lastHeartbeat: Date,
    expectedDuration: Number // ms
  }]
};

// Agent (e.g., PaymentAgent) - must be idempotent
async function paymentAgent(task) {
  const { workflowId, taskId, input } = task;
  
  // Idempotency check
  const existing = await Workflow.findOne(
    { workflowId, 'tasks.taskId': taskId, 'tasks.status': 'SUCCEEDED' }
  );
  if (existing) return; // already processed — safe no-op
  
  // Start heartbeat
  const heartbeat = setInterval(() => {
    reportHeartbeat(workflowId, taskId);
  }, 5000);
  
  try {
    const result = await stripe.charges.create({
      amount: input.amount,
      idempotencyKey: taskId // Stripe deduplication
    });
    
    clearInterval(heartbeat);
    await reportSuccess(workflowId, taskId, { chargeId: result.id });
  } catch (err) {
    clearInterval(heartbeat);
    await reportFailure(workflowId, taskId, { error: err.message, code: err.code });
  }
}

// Supervisor scan — runs on a cron (every 30s)
async function supervisorScan() {
  const stuckTasks = await Workflow.find({
    'tasks.status': 'IN_PROGRESS',
    'tasks.lastHeartbeat': { $lt: new Date(Date.now() - 45000) } // 45s without heartbeat
  });
  
  for (const workflow of stuckTasks) {
    for (const task of workflow.tasks.filter(t => t.status === 'IN_PROGRESS')) {
      const ageMs = Date.now() - task.lastHeartbeat;
      if (ageMs > task.expectedDuration * 1.5) {
        await handleStuckTask(workflow, task);
      }
    }
  }
}

async function handleStuckTask(workflow, task) {
  if (task.retryCount < 3) {
    // Retry with exponential backoff
    const delay = Math.pow(2, task.retryCount) * 1000;
    await requeueTask(task, delay);
    await incrementRetryCount(workflow.workflowId, task.taskId);
  } else {
    // Compensate or escalate
    await triggerCompensation(workflow);
  }
}
```

---

## Real-World Examples

| Company | System | Key Detail |
|---------|--------|-----------|
| **Uber Cadence/Temporal** | Trip coordination (100M+ workflows/day) | Event sourcing for workflow state — every state change appended to immutable log. Supervisor reconstructs state by replaying events → enables time-travel debugging. Stateless supervisor (no state in memory) → horizontally scalable. |
| **AWS Step Functions** | Managed workflow orchestration | You define state machines in JSON; Step Functions = scheduler + supervisor. Charges per state transition (not per workflow) — reflects pattern overhead. Some companies build their own for high-volume cost control. |
| **Netflix Conductor** | Video encoding workflows | Pull-based agent model: workers poll for tasks. Supervisor detects stuck tasks by timestamp comparison (no heartbeats) → reduces network chatter. Handles corrupted source file failures gracefully via compensation tasks. |

---

## Interview Cheat Sheet

### Q: How does this differ from the Saga pattern?
**A:** Both handle distributed transactions without 2PC. Saga focuses on compensating transactions — each step has a defined inverse operation for rollback. Scheduling Agent Supervisor focuses on *supervision and failure detection* — a centralized supervisor monitors progress, detects which specific step failed, and decides whether to retry, compensate, or escalate. The patterns can be combined: use SAS for monitoring + Saga choreography/orchestration for transaction semantics.

### Q: What happens if the supervisor itself crashes?
**A:** Because all workflow state is persisted (not in supervisor memory), another supervisor instance can take over by reading the state store. In-flight tasks may be retried if they didn't report completion before the crash. This is why persisting state before dispatching is critical: log-then-dispatch, never dispatch-then-log.

### Q: How do you prevent duplicate task execution?
**A:** Three defenses: (1) Idempotency keys passed to external services (Stripe's idempotency key, same `taskId` = same charge). (2) Application-level deduplication — agent checks if task already succeeded before processing. (3) Deduplication window in the task queue (FIFO queues: message deduplication ID).

### Q: How do you handle long-running tasks (hours/days)?
**A:** Periodic heartbeats (every 5-60s depending on task criticality). Checkpoint/resume mechanisms — task saves intermediate progress, can resume from checkpoint if retried. Supervisor persistence must survive restarts. Example: video encoding checkpoint every 5 minutes; if encoder crashes at minute 47, resume from minute 45 checkpoint — not from the beginning.

---

## Red Flags to Avoid

- Claiming this pattern provides ACID transactions (it provides eventual consistency with failure handling)
- Not discussing idempotency requirements (retries will cause duplicate side effects)
- Ignoring the operational complexity of running a supervisor (monitoring, scaling, crash recovery)
- Synchronous communication between supervisor and agents (use async messaging for decoupling)
- Not considering what happens when the state store is unavailable
- Treating all failures identically (transient vs. permanent vs. business logic failures need different strategies)

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Scheduler** | Component that breaks workflows into tasks and dispatches them to agents |
| **Agent** | Stateless worker that executes one specific task type; pulls from queue; reports status |
| **Supervisor** | Component that monitors workflow state, detects failures, and orchestrates recovery |
| **Workflow State Store** | Persistent storage (PostgreSQL, DynamoDB) holding the state of every workflow and task |
| **Heartbeat** | Periodic message from agent to supervisor confirming a task is still in progress |
| **Compensation** | Inverse operation that undoes a previously successful step (e.g., refund a charge) |
| **Idempotency Key** | Unique identifier passed to external services enabling safe retries without duplicate effects |
| **DAG** | Directed Acyclic Graph — the task dependency graph for a workflow (what runs before what) |
| **Temporal/Cadence** | Uber's open-source workflow engine (now Temporal.io) implementing this pattern at scale |
| **Conductor** | Netflix's open-source workflow engine using pull-based agent model |
| **2PC** | Two-Phase Commit — distributed transaction protocol this pattern avoids due to scaling/availability issues |
| **Poison Message** | Task that repeatedly fails; must be moved to DLQ to prevent blocking workflow recovery |
| **Time-Travel Debugging** | Ability to replay a workflow's event log from any point to understand past behavior; enabled by event sourcing |
