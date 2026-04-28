# T07 — Priority Queue Pattern: Tiered Message Processing

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/priority-queue

---

## ELI5 (Explain Like I'm 5)

Imagine a hospital emergency room. When patients arrive, a nurse sorts them: "heart attack" goes to the front of the line, "broken finger" waits longer. You don't process patients in arrival order — you process the most critical first.

Priority queue pattern does the same for messages/tasks. Payment processing is "heart attack" — jump to the front. Analytics event logging is "broken finger" — wait if needed.

---

## Analogy

**Airport check-in lanes**: Business class has its own dedicated (short) queue and gets processed first. Economy has a longer general queue. If business lane is empty, agent can help economy passengers. That's priority queue with weighted consumption.

---

## Core Concept

The Priority Queue pattern assigns **different priority levels to tasks/messages** and ensures **higher-priority tasks are processed first**, regardless of arrival time. It prevents high-value or time-sensitive operations from being delayed by lower-value bulk work.

**Implementation reality**: Don't use a single queue sorted by priority header — that causes head-of-line blocking. Instead, use **multiple physical queues** (one per priority level) with **weighted consumer threads**.

**The starvation problem**: If P0 (high) queue never empties, P2 (low) tasks wait forever. Solve with **age-based priority promotion**: a P2 task waiting >5 minutes gets promoted to P1.

---

## ASCII Diagrams

### Multiple Physical Queues Architecture

```
Producers:
  [Payment Processor] ──────────────► P0 Queue (capacity: 500K)
  [Fraud Alert Service] ─────────────► P0 Queue
  [User Auth Service] ───────────────► P1 Queue (capacity: 1M)
  [Trip Updates] ────────────────────► P1 Queue  
  [Analytics Events] ────────────────► P2 Queue (capacity: unbounded)
  [Report Generator] ────────────────► P2 Queue

Consumer Pool (10 worker threads):
  Thread 1-7 ◄──── P0 Queue (70% of workers dedicated)
  Thread 8-9 ◄──── P1 Queue (20% of workers)
  Thread  10 ◄──── P2 Queue (10% of workers)
  
  Bonus: if P0 queue is EMPTY, Thread 1-7 pull from P1/P2
```

### Age-Based Priority Promotion (Starvation Prevention)

```
Timeline:
t=0   →  Task "analytics-report-xyz" enters P2 Queue
t=5m  →  Age promoter scans queues: "analytics-report-xyz" is 5min old → PROMOTE to P1
t=10m →  If still pending → PROMOTE to P0 (emergency escalation)

                              ┌─ age > 5min ──┐    
P2 Queue ──► [Age Promoter]──┤               │
                              └─ age <= 5min ─► stay in P2
                                              │
                                              ▼
                                         P1 Queue
                                         [Age Promoter] ──► age > 5min → P0 Queue
```

### Backpressure When P0 Overloads

```
Normal:
  P0 Queue [████░░░░░░] 40% full → all good

Backpressure triggered:
  P0 Queue [██████████] 90% full → signal producers to SLOW DOWN
                                 → shed P2 work (drop analytics events)
                                 → alert ops team

Recovery:
  Add consumer replicas → P0 Queue [████░░░░░░] back to 40%
```

---

## How It Works (Step by Step)

1. **Assign priority on publish**: Producer stamps each message with priority (P0/P1/P2) based on business rules. Payment failure → P0. Analytics event → P2. Never let consumers decide priority — it's a producer-side concern.

2. **Route to correct physical queue**: A router/topic partitioner reads the priority header and puts the message in the correct physical queue. In AWS: SQS has no built-in priority — create 3 SQS queues (`payments-p0`, `payments-p1`, `payments-p2`). In Kafka: 3 separate topics.

3. **Weighted consumption**: Scale worker threads/replicas per priority. Facebook FOQS example: allocate 70% of consumer threads to P0, 20% to P1, 10% to P2. When P0 queue drains, P0 workers steal from lower queues.

4. **Monitor consumer lag per priority**: Track `consumer_lag_p0`, `consumer_lag_p1`, `consumer_lag_p2` separately. Alert when `consumer_lag_p0 > 1000` — that means high-priority messages are piling up.

5. **Age-based promotion**: Background process scans lower-priority queues every 60 seconds. Tasks older than threshold → promote to higher priority queue. Prevents permanent starvation.

6. **Priority propagation**: When P0 task creates a sub-task, the sub-task inherits P0 priority. Otherwise a critical payment processing chain degrades because the database query was scheduled as P2.

---

## Variants

| Variant | How It Works | Pros | Cons |
|---------|-------------|------|------|
| **Multiple Physical Queues** (recommended) | 3 separate queues + weighted consumers | No head-of-line blocking; independent scaling | More infrastructure to manage |
| **Single Queue + Priority Header** | One queue, consumers sort by priority header | Simple to implement | Head-of-line blocking; slow P0 blocks P0 queue |
| **Hybrid Priority Lanes** | Critical ops on dedicated infrastructure, rest shared | Absolute isolation for P0 | Resource waste when P0 is idle |
| **Time-Based Priority Windows** | Priority changes based on time-of-day | Batch jobs run at night as P0 | Complex scheduling logic |

---

## Trade-offs

| Consideration | Detail |
|---------------|--------|
| **SLA separation** | P0: <500ms, P1: <5s, P2: <60s — without priority queuing, all compete equally |
| **Operational complexity** | Must maintain and monitor N queues instead of 1 |
| **Starvation risk** | Low-priority tasks can wait indefinitely → require age-based promotion |
| **Priority inversion** | P0 task depends on P2 sub-task → sub-task must inherit P0 priority |
| **Over-prioritization** | If everyone marks work as P0, priority queuing loses its value — governance required |

---

## When to Use (and When Not To)

**Use when:**
- Clear business value differences between task types (payment vs. analytics)
- SLA requirements differ across task types (500ms vs. 60s acceptable)
- System has bursty load where important work risks being buried by bulk work
- Multi-tenant systems where some tenants pay for higher SLA guarantees

**Avoid when:**
- All tasks truly have equal priority (it adds complexity for no gain)
- System is never under load (priority only matters when queues are non-empty)
- Tasks are so interdependent that you can't process them independently

**Anti-patterns:**
- Single queue sorted by priority header (head-of-line blocking)
- Letting consumers define priority (producers should own priority assignment)
- No starvation prevention (low-priority tasks can wait forever)
- Ignoring priority inversion (P0 task waiting on P2 sub-task)

---

## MERN Developer Notes

```javascript
// Priority queue consumer factory — works with SQS or RabbitMQ
class PriorityQueueConsumer {
  constructor(queues) {
    // queues = [{ name: 'p0', url: '...', weight: 70 }, ...]
    this.queues = queues;
    this.workerPool = this._allocateWorkers();
  }

  _allocateWorkers() {
    const totalWorkers = 10;
    return this.queues.flatMap(q =>
      Array(Math.round(q.weight / 10)).fill(q)
    );
  }

  async start() {
    // Each worker polls its assigned queue; falls back to lower queues if empty
    await Promise.all(
      this.workerPool.map(primaryQueue => this._worker(primaryQueue))
    );
  }

  async _worker(primaryQueue) {
    while (true) {
      // Try primary queue first
      let msg = await this._poll(primaryQueue);

      // Work stealing: if empty, try higher-priority queues, then lower
      if (!msg) {
        for (const q of this.queues) {
          msg = await this._poll(q);
          if (msg) break;
        }
      }

      if (msg) await this._process(msg);
      else await sleep(100); // no messages — brief pause
    }
  }
}

// Age-based promotion (run every 60s)
async function promoteStarvedTasks() {
  const now = Date.now();
  const p2Messages = await redis.zrangebyscore('p2-queue', '-inf', now - 5 * 60 * 1000);
  
  for (const msg of p2Messages) {
    await redis.zrem('p2-queue', msg);
    await redis.zadd('p1-queue', now, msg); // promote with current timestamp
    metrics.increment('priority.promoted', { from: 'p2', to: 'p1' });
  }
}
setInterval(promoteStarvedTasks, 60_000);

// Producer — assigns priority at publish time
function publishTask(task) {
  const priority = getPriority(task.type);
  const queueUrl = QUEUES[priority]; // 'p0' | 'p1' | 'p2'
  return sqs.sendMessage({ QueueUrl: queueUrl, MessageBody: JSON.stringify(task) });
}

function getPriority(taskType) {
  const P0_TYPES = new Set(['payment-processing', 'fraud-alert', 'auth-token']);
  const P1_TYPES = new Set(['trip-update', 'notification', 'search-index']);
  if (P0_TYPES.has(taskType)) return 'p0';
  if (P1_TYPES.has(taskType)) return 'p1';
  return 'p2'; // default: analytics, reports, batch jobs
}
```

---

## Real-World Examples

| Company | Implementation | Key Detail |
|---------|---------------|-----------|
| **Facebook FOQS** | Facebook Online Queue Service | 100M+ tasks/sec. P0: P99 <10ms SLA. Multiple physical queues with tenant-level quotas — premium tenants get P0 access. |
| **Uber Trip Dispatch** | Real-time ride matching | P0: active ride status updates (driver en route, arrived). P1: location updates (driver GPS stream). P2: analytics events. P0 failures page on-call immediately. |
| **Stripe Payments** | Payment processing queue | Enterprise customers: P0 with 500ms SLA guarantee. Standard customers: P2 with 5s SLA. Age-based promotion: if a standard customer's payment waits >60s, auto-promote. |
| **AWS SQS** | Platform-level support | No built-in priority — recommended pattern is 3 separate SQS queues + auto-scaling workers per queue based on ApproximateNumberOfMessages CloudWatch metric. |

---

## Interview Cheat Sheet

### Q: How do you implement priority queues in SQS (which has no native priority support)?
**A:** Create multiple SQS queues (`my-tasks-p0`, `my-tasks-p1`, `my-tasks-p2`). Deploy consumer services with different replica counts (e.g., P0: 10 pods, P1: 5 pods, P2: 2 pods). Use CloudWatch metric `ApproximateNumberOfMessages` to auto-scale consumers. P0 consumers can poll P1/P2 as fallback when P0 is empty.

### Q: What is priority inversion and how do you prevent it?
**A:** Priority inversion is when a high-priority task (P0) depends on a low-priority sub-task (P2), causing the P0 task to effectively wait at P2 speed. Prevention: propagate priority through the entire task graph — when a P0 task creates a sub-task, the sub-task inherits P0 priority. Pass a `correlationId` and `priority` header that downstream services respect.

### Q: How do you prevent low-priority task starvation?
**A:** Age-based promotion: a background process scans P2 queue every 60 seconds. Any task waiting longer than threshold (e.g., 5 minutes) gets promoted to P1. After another 5 minutes in P1, promote to P0. This guarantees eventual processing of all tasks regardless of priority.

### Q: How do you govern priority assignment to prevent "priority inflation" (everyone marking P0)?
**A:** Governance rules: require engineering review to add a new P0 task type. Monitor `p0_queue_depth` and `p0_consumer_lag` — if P0 queue is consistently > 50% full, re-audit what's labeled P0. Product management owns priority assignment in task routing tables, not individual teams.

---

## Red Flags to Avoid

- Single queue with priority sorting header (head-of-line blocking destroys the point)
- No starvation prevention (can you show a P2 task that's been waiting 3 hours?)
- Consumers deciding priority (producers own it; consistency is lost otherwise)
- No priority propagation (P0 payment task waiting on P2 DB schema migration)
- Treating all work as P0 (this is "priority inflation" — governance required)

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Priority Queue** | Data structure / pattern that processes highest-priority items first, regardless of arrival order |
| **Multiple Physical Queues** | Recommended implementation: one separate queue per priority level |
| **Weighted Consumption** | Allocating N% of worker threads to each queue to ensure proportional processing |
| **Head-of-Line Blocking** | When one slow item blocks all items behind it in a single queue |
| **Starvation** | Low-priority tasks never getting processed because high-priority queue never empties |
| **Age-Based Promotion** | Automatically upgrading a task's priority as it gets older to prevent starvation |
| **Priority Inversion** | When a high-priority task is blocked waiting on a low-priority dependency |
| **Priority Propagation** | Passing priority context (P0/P1/P2) to all sub-tasks and dependencies |
| **Consumer Lag** | How far behind a consumer is from the head of a queue — key health metric per priority level |
| **SLA Separation** | Having different service-level agreements per priority tier (P0: 500ms, P2: 60s) |
| **Work Stealing** | P0 workers polling lower-priority queues when P0 is empty — prevents worker idle time |
| **FOQS** | Facebook Online Queue Service — production priority queue handling 100M+ tasks/sec |
