# 07 — Scheduler Agent Supervisor

> **Module**: M12 — Reliability Patterns  
> **Section**: Section 1 — Resiliency Patterns  
> **Source**: https://layrs.me/course/hld/12-reliability-patterns/scheduler-agent-supervisor  
> **Difficulty**: Intermediate | 11 min read

---

## 1. ELI5 — Explain Like I'm 5

Imagine a restaurant with 3 roles:
- **Manager (Scheduler)**: writes down what orders need to be made and in what order
- **Cooks (Agents)**: actually make the food, one dish at a time
- **Shift supervisor (Supervisor)**: watches all the cooks. If a cook freezes up or disappears for too long, the supervisor reassigns that dish to another cook

The customer doesn't see any of that. They just eventually get their food — even if cook 2 had to restart half the dish.

---

## 2. The Analogy

**Scheduler Agent Supervisor = Builder with site manager and safety inspector.**

- **Scheduler**: the architect — knows which rooms to build, in what order, and the plan
- **Agents**: construction workers — do the actual work (pour concrete, install wires)
- **Supervisor**: independent safety inspector — walks the site every 30 minutes. If a worker hasn't moved since the last visit → they get replaced or the step gets re-assigned

The customer (client) doesn't see workers stall or restart. They just eventually get a bill saying "building complete."

---

## 3. Core Concept

The **Scheduler Agent Supervisor pattern** coordinates distributed long-running workflows by separating three concerns:

| Role | Responsibility | Knows |
|------|---------------|-------|
| **Scheduler** | Initiates workflow, defines step order, dispatches tasks | Business logic: what steps, what order |
| **Agent** | Stateless worker — executes one step, sends heartbeats | Only its own task |
| **Supervisor** | Proactive monitor — detects hung/crashed agents, triggers recovery | Workflow state, expected durations |

### Why Not Just Try-Catch?
Traditional error handling assumes synchronous failures: `try { doStep() } catch (e) { compensate() }`.

Real distributed failures are **temporal**: 
- Service accepts request → never responds (silent failure)
- Job gets stuck at 47% for 3 hours (not an exception — just "nothing happened")
- 3 of 5 database shards updated, 2 timed out (partial inconsistency, invisible to caller)

The Supervisor catches **absence of response** — the most common distributed failure mode.

---

## 4. ASCII Architecture

### Component Interaction

```
Client → [Scheduler] → persist workflow state
                     → enqueue Task 1 to [Work Queue]

[Agent A] pulls Task 1 → executes → heartbeat every 30s → notifies [Scheduler] on done
[Agent B] pulls Task 1 (if A crashed) → retries with same idempotency key

[Supervisor] polls workflow state every 30s:
  - Agent missed heartbeat? (>60s no heartbeat) → mark step FAILED, re-enqueue
  - Step exceeded timeout? → mark FAILED, re-enqueue  
  - Retry count exceeded? → mark workflow FAILED, trigger compensation
```

### Failure Detection Sequence

```
t=0s:   Task 1 assigned to Agent A. Status: in_progress. heartbeat: t=0
t=30s:  Agent A sends heartbeat. last_heartbeat: t=30
t=60s:  Agent A CRASHES (no more heartbeats)
t=90s:  Supervisor polls: last_heartbeat=30, now=90 → gap=60s > threshold(45s)
        → Mark step FAILED, retry_count=1
        → Re-enqueue Task 1
t=91s:  Agent B pulls Task 1
        → POST /resource-group with idempotency-key=original-request-id
        → (Agent A already created it = idempotent → same response returned)
t=120s: Agent B completes successfully
        → Mark Task 1 DONE, notify Scheduler
        → Scheduler enqueues Task 2
```

---

## 5. How It Works

**Step 1: Workflow Initiation (Scheduler)**
Client requests complex operation (e.g., provision Azure VM). Scheduler breaks it into a directed acyclic graph (DAG) of tasks: `create_vnet → allocate_disk → provision_vm → configure_rbac`. Persists workflow to durable storage (DB or queue), dispatches first task to work queue.

**Step 2: Agent Execution**
Stateless Agent pulls task from work queue. Executes the work (calls external API). Sends heartbeat to shared state every 30s: "I'm still alive." On completion, updates workflow state (`step: DONE`) and notifies Scheduler. Agent does NOT decide what happens next — always the Scheduler's job.

**Step 3: Supervisor Monitoring**
Supervisor runs on independent polling loop (every 10-60s). Scans all in-progress workflows. Checks two conditions for each step:
1. Has Agent sent heartbeat within threshold? (e.g., last_heartbeat < 45s ago)
2. Has step exceeded expected duration? (e.g., create_resource_group should complete in <5m)

If either fails → Agent assumed crashed → mark step FAILED.

**Step 4: Failure Recovery**
Supervisor consults retry policy:
- **Transient** (network blip, API throttle): re-enqueue to fresh Agent, increment retry counter
- After 3 retries, try fallback: different region, slower but more reliable endpoint
- **Permanent** (invalid config, quota exceeded): mark workflow FAILED, trigger defined cleanup steps
- **Partial**: delete partially created resource group, etc.

**Step 5: Transparent Completion**
Caller never knew about 3 retries, Agent crash, or API latency. Pattern absorbs chaos and returns clean success/failure interface. Azure reduced provisioning failures: 12% → <0.5% using this approach.

---

## 6. Variants

### Centralized Supervisor
- Single Supervisor monitors all workflows
- Pros: simple to implement, easy to reason about
- Cons: single point of failure; becomes bottleneck at high scale
- Use when: < 10,000 concurrent workflows and fast failover is acceptable

### Distributed Supervisor
- Multiple Supervisors partition workflow space (shard by workflow ID hash, tenant ID, or geo region)
- Pros: horizontal scaling, no SPOF
- Cons: needs distributed locking (one Supervisor per workflow); partition rebalancing on Supervisor failure
- Use when: hundreds of thousands of concurrent workflows or geo compliance requirements
- Azure uses **geographic sharding**: EU workflows monitored by EU-region Supervisors (data residency)

### Embedded Supervisor
- Supervisor logic runs inside the Scheduler process — no separate component
- Pros: fewer services to deploy, no network hops between Scheduler and Supervisor
- Cons: couples reliability with business logic; harder to test
- **Stripe** uses this for payment workflows: retry logic tightly coupled to payment state machine
- Use when: simple workflows where separation of concerns isn't needed

---

## 7. Trade-offs

### Complexity vs Resilience
- 3 components to deploy/monitor instead of 1
- Gain: survives agent crashes, network partitions, silent failures
- Cost: 3 services + durable state store + monitoring
- Only worth it when workflow failures directly impact revenue or user trust

### Supervisor Polling Interval vs Cost

| Strategy | Detection | DB Load | Use For |
|----------|-----------|---------|---------|
| Fast (5s) | 5-10s | 12 queries/min/workflow | Payment, provisioning |
| Medium (30s) | 30-60s | 2 queries/min/workflow | Most workflows |
| Slow (60s) | 60-120s | 1 query/min/workflow | Batch, non-urgent |

Azure settled on 30s: fast enough for user perception; slow enough for cost efficiency at scale.

### Agent Autonomy vs Coordination
- Autonomous agents (decide their own retry/error strategy): faster, but inconsistent across workflow
- Coordinated agents (Supervisor decides all): consistent retry policies, but adds latency
- Choose based on coupling: tightly dependent steps → coordinated; embarrassingly parallel steps → autonomous

---

## 8. When to Use / When to Avoid

### ✅ Use When:
- Long-running workflows: minutes to hours (not <5s)
- Silent failures are common: 3rd-party APIs that accept requests but never respond
- Partial failures are expensive: half-provisioned cloud resources burning money; reserved inventory blocking sales
- Workflows span multiple unreliable external dependencies

### ❌ Avoid When:
- **Synchronous request-response**: pattern is asynchronous; can't return result in same HTTP request
- **Complex compensating logic**: each step requires carefully orchestrated rollback → use Saga pattern instead
- **Already using workflow engine**: Temporal, Cadence, AWS Step Functions implement this internally — don't reinvent the wheel
- **Short-lived workflows** (<5s total): overhead of 3 components outweighs benefit; use retry directly

---

## 9. MERN Dev Notes

### Scheduler + Agent + Supervisor (Node.js)

```javascript
const mongoose = require('mongoose');

// ──── Workflow Schema (durable state) ────
const workflowSchema = new mongoose.Schema({
  workflowId: { type: String, required: true, unique: true },
  steps: [{
    name: String,
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'failed'], default: 'pending' },
    agentId: String,
    lastHeartbeat: Date,
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    expectedDurationMs: Number,
    startedAt: Date,
    completedAt: Date
  }],
  currentStepIndex: { type: Number, default: 0 },
  status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
  createdAt: { type: Date, default: Date.now }
});
const Workflow = mongoose.model('Workflow', workflowSchema);

// ──── Scheduler ────
class Scheduler {
  async createWorkflow(workflowId, steps) {
    const workflow = new Workflow({
      workflowId,
      steps: steps.map(s => ({ ...s, status: 'pending' }))
    });
    await workflow.save();
    await this._dispatchNextStep(workflow);
    console.log(`[Scheduler] Workflow ${workflowId} created with ${steps.length} steps`);
  }
  
  async _dispatchNextStep(workflow) {
    const nextStep = workflow.steps.find(s => s.status === 'pending');
    if (!nextStep) {
      await Workflow.updateOne({ workflowId: workflow.workflowId }, { status: 'completed' });
      console.log(`[Scheduler] Workflow ${workflow.workflowId} COMPLETED`);
      return;
    }
    nextStep.status = 'in_progress';
    nextStep.startedAt = new Date();
    await workflow.save();
    workQueue.enqueue({ workflowId: workflow.workflowId, stepName: nextStep.name });
    console.log(`[Scheduler] Dispatched: ${nextStep.name}`);
  }
  
  async onStepComplete(workflowId, stepName) {
    const workflow = await Workflow.findOne({ workflowId });
    const step = workflow.steps.find(s => s.name === stepName);
    step.status = 'completed';
    step.completedAt = new Date();
    await workflow.save();
    await this._dispatchNextStep(workflow);
  }
}

// ──── Agent ────
class Agent {
  constructor(agentId) { this.agentId = agentId; }
  
  async executeTask({ workflowId, stepName }) {
    const heartbeatInterval = setInterval(
      () => this._sendHeartbeat(workflowId, stepName),
      30000
    );
    
    try {
      // Initial heartbeat
      await this._sendHeartbeat(workflowId, stepName);
      
      // Do the actual work
      await this._doWork(stepName, workflowId);
      
      clearInterval(heartbeatInterval);
      await scheduler.onStepComplete(workflowId, stepName);
    } catch (err) {
      clearInterval(heartbeatInterval);
      console.error(`[Agent:${this.agentId}] Failed step ${stepName}: ${err.message}`);
      throw err;
    }
  }
  
  async _sendHeartbeat(workflowId, stepName) {
    await Workflow.updateOne(
      { workflowId, 'steps.name': stepName },
      { $set: { 'steps.$.lastHeartbeat': new Date(), 'steps.$.agentId': this.agentId } }
    );
  }
  
  async _doWork(stepName, workflowId) {
    // Idempotent call — use workflowId as request ID so retries are safe
    const response = await externalService.call(stepName, { requestId: workflowId });
    return response;
  }
}

// ──── Supervisor ────
class Supervisor {
  constructor({ pollIntervalMs = 30000, heartbeatTimeoutMs = 60000 } = {}) {
    this.pollIntervalMs = pollIntervalMs;
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;
  }
  
  start() {
    console.log('[Supervisor] Started polling');
    setInterval(() => this._scan(), this.pollIntervalMs);
  }
  
  async _scan() {
    const stuckWorkflows = await Workflow.find({
      status: 'running',
      'steps.status': 'in_progress'
    });
    
    for (const workflow of stuckWorkflows) {
      for (const step of workflow.steps) {
        if (step.status !== 'in_progress') continue;
        
        const noHeartbeat = !step.lastHeartbeat ||
          Date.now() - step.lastHeartbeat.getTime() > this.heartbeatTimeoutMs;
        const exceededDuration = step.expectedDurationMs &&
          Date.now() - step.startedAt.getTime() > step.expectedDurationMs;
        
        if (noHeartbeat || exceededDuration) {
          console.warn(`[Supervisor] Stuck step: ${step.name} in workflow ${workflow.workflowId}. Retry #${step.retryCount + 1}`);
          await this._handleFailure(workflow, step);
        }
      }
    }
  }
  
  async _handleFailure(workflow, step) {
    if (step.retryCount >= step.maxRetries) {
      console.error(`[Supervisor] Max retries exceeded for ${step.name} — marking workflow FAILED`);
      await Workflow.updateOne({ workflowId: workflow.workflowId }, { status: 'failed' });
      // Alert on-call, trigger compensations
      return;
    }
    
    // Reset step for retry
    await Workflow.updateOne(
      { workflowId: workflow.workflowId, 'steps.name': step.name },
      { $set: { 'steps.$.status': 'pending', 'steps.$.lastHeartbeat': null, 'steps.$.startedAt': null },
        $inc: { 'steps.$.retryCount': 1 } }
    );
    workQueue.enqueue({ workflowId: workflow.workflowId, stepName: step.name });
  }
}

const scheduler = new Scheduler();
const supervisor = new Supervisor({ pollIntervalMs: 30000, heartbeatTimeoutMs: 60000 });
supervisor.start();
```

---

## 10. Real-World Examples

### Microsoft Azure — VM Provisioning
- VM creation: 15-20 steps (allocate IP, provision storage, configure networking, install OS)
- Each step = specialized Agent calling Azure Resource Manager API
- Supervisor: geographic sharding — EU provisions monitored by EU Supervisors (data residency compliance)  
- Result: P99 provisioning reduced from **12 minutes → 4 minutes** by aggressively retrying transient failures
- Key metric: previously 12% provisioning failures; after SAS pattern: <0.5%

### Netflix — Video Encoding Pipeline
- Scheduler dispatches encoding jobs (1 job per video chunk per format) to GPU Agents
- Supervisor detects "stuck encoders" — Agent not dead, but stops making progress for >30 min
- Fix: kills stuck Agent, retries the chunk with different encoding parameters
- Reality: some video files encode in 10 seconds; others take hours; some need manual intervention

### Stripe — Payment Processing (Embedded Supervisor)
- Payment workflow: authorize → capture → update ledger → send receipt
- Agents call external banking APIs (up to 30s latency — bank APIs are unreliable)
- Embedded Supervisor: retry logic tightly coupled to payment state machine
- Different retry strategies: immediate retry for network errors; exponential backoff for rate limits; escalate to human review for ambiguous bank responses (no clear success or failure)
- Result: **99.99% payment success rate** despite inherent banking infrastructure unreliability

---

## 11. Interview Cheat Sheet

### One-Liner
> "Scheduler Agent Supervisor separates workflow orchestration (Scheduler), execution (Agents), and monitoring (Supervisor) into 3 independent components. The Supervisor is proactive — it doesn't wait for errors to be reported; it detects silent failures (missed heartbeats, exceeded timeouts) and re-dispatches to fresh Agents."

### SAS vs Saga Pattern (Interviewers Ask):
| | Saga (Compensating Transaction) | Scheduler Agent Supervisor |
|--|--|--|
| Focus | Compensation for completed steps | Detection + retry of incomplete steps |
| When failures are | Fast and explicit | Silent, hung, or partial |
| Rollback model | Execute reverse operations | Re-execute forward operation on new Agent |
| User experience | Explicit rollback result | Failure invisible to caller |
| Use when | Complex undo sequences needed | External APIs may silently fail |

### State Schema (Know Cold):
```
workflow: { workflowId, currentStepIndex, status }
step: { name, status, agentId, lastHeartbeat, retryCount, maxRetries, startedAt, expectedDurationMs }
```

### Key Numbers:
- Azure Supervisor poll: **30s** (sweet spot: fast enough for perception, low DB cost)
- Heartbeat interval: **30s** (Agents write every 30s)  
- Heartbeat timeout: **60s** (Supervisor flags after 60s of silence)
- Azure's result: failures **12% → 0.5%**; P99 provisioning **12min → 4min**

---

## 12. Red Flags + Keywords

### Red Flags to Avoid

❌ **Confusing Scheduler and Supervisor** — Scheduler decides WHAT next; Supervisor detects and fixes PROBLEMS. Different jobs.

❌ **"SAS pattern solves all distributed workflows"** — It doesn't handle compensation (use Saga), doesn't solve distributed consensus (use Raft/Paxos), can't detect Byzantine failures (agent reports false progress)

❌ **"The Supervisor is reactive"** — It's **proactive** — actively looks for problems by monitoring heartbeats and timeouts, not waiting for errors to propagate

❌ **Ignoring operational complexity** — If you propose SAS without discussing how to monitor the Supervisor, deploy it reliably, and debug failures, you're missing the hard parts

❌ **Proposing SAS for a 500ms workflow** — Overkill; overhead > benefit; use simple retry instead

❌ **Not discussing idempotency for retried steps** — If Supervisor re-dispatches a step that actually succeeded silently, the Agent must be able to detect the duplicate and return the same result

### Keywords / Glossary

| Term | Meaning |
|------|---------|
| **Scheduler** | Workflow initiator — defines steps, order, and dispatches to Agents |
| **Agent** | Stateless workers — execute one task, send heartbeats |
| **Supervisor** | Proactive monitor — detects missed heartbeats/timeouts, triggers recovery |
| **Heartbeat** | Periodic "I'm alive" write from Agent to shared state store |
| **Heartbeat Timeout** | Max time allowed between heartbeats before step marked FAILED |
| **Silent Failure** | Service accepts request but never responds; no exception thrown |
| **Temporal Uncertainty** | Don't know if step failed, is still running, or succeeded without notification |
| **DAG (Directed Acyclic Graph)** | Structure of workflow steps with dependencies |
| **Idempotent Agent** | Agent that can safely re-execute a step that may have already run |
| **Centralized Supervisor** | Single Supervisor instance; simple but SPOF |
| **Distributed Supervisor** | Multiple Supervisors with sharding; scalable but complex coordination |
| **Embedded Supervisor** | Supervisor logic inside Scheduler process; operationally simpler |
| **Geographic Sharding** | Partition workflows to Supervisors in same geo region (compliance) |
| **Lease-Based Ownership** | Distributed lock mechanism: Supervisor acquires time-limited lease per workflow partition |
| **Temporal.io / Cadence** | Workflow orchestration platforms implementing SAS pattern internally |
| **AWS Step Functions** | Serverless SAS implementation — manages state, retries, timeouts |
| **Forward Recovery** | Retry a step with modified parameters vs compensating entire workflow |
| **Push-Based Health** | Services push status to registry (Netflix Eureka); vs pull (registry polls endpoints) |
