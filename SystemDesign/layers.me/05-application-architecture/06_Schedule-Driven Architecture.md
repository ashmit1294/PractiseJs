# Schedule-Driven Architecture: Time-Triggered Work

> **Module 5 — Application Architecture**  
> Source: https://layrs.me/course/hld/05-application-architecture/schedule-driven-architecture

---

## ELI5 — Explain Like I'm 5

Every Sunday morning, your building's sprinkler system waters the garden automatically — regardless of whether anyone is home or anything has happened. That's schedule-driven work: a **timer fires**, work runs.

No human trigger, no event — just the clock.

---

## Analogy

| Type | Trigger | Example |
|---|---|---|
| Request-driven | User action (button, API call) | "Place order" button |
| Event-driven | Something happened in the system | "OrderPlaced" event |
| **Schedule-driven** | **The clock** | "Run every night at 2AM" |

Schedule-driven is the **cron job equivalent for distributed systems** — but gets complicated when 50 servers are running, not just one machine.

---

## Core Concept

A **scheduled task** runs based on a time expression. The main challenges:

1. **Duplicate execution** — if 10 server instances all have a cron, all 10 fire at 2AM
2. **Missed triggers** — if the instance is down at 2AM, the job doesn't run
3. **DST edge cases** — clocks change → a 2:30AM job might fire twice or not at all

**Solution**: add **coordination** on top of standard cron.

```
Without coordination (bad):
  Instance A: fires job at 2AM ─┐
  Instance B: fires job at 2AM ─┼─► 10× duplicate DB writes, 10× emails sent
  Instance C: fires job at 2AM ─┘

With leader election (good):
  Leader (Instance A): fires job at 2AM ──► executes
  Instance B: knows it's not leader ──► skips
  Instance C: knows it's not leader ──► skips
```

---

## Cron Expression Refresher

```
┌─────────── minute         (0–59)
│ ┌───────── hour           (0–23)
│ │ ┌─────── day of month   (1–31)
│ │ │ ┌───── month          (1–12)
│ │ │ │ ┌─── day of week    (0–7, 0 and 7 = Sunday)
│ │ │ │ │
* * * * *

Common patterns:
  0 2 * * *        → 2:00 AM every day
  */15 * * * *     → every 15 minutes
  0 9 * * 1        → 9 AM every Monday
  0 0 1 * *        → midnight on the 1st of every month
  0 */6 * * *      → every 6 hours
```

---

## Coordination Strategies

### Strategy 1: Leader Election

One instance is elected leader and runs all scheduled jobs. Others stand by.

```
3 instances compete for leader lock via Redis / Zookeeper:
  Instance A: acquires lock ──► LEADER (runs cron jobs)
  Instance B: lock taken ──────► FOLLOWER (monitors, ready to take over)
  Instance C: lock taken ──────► FOLLOWER

Leader crashes:
  Instances B/C detect: no heartbeat from A for 5–30s
  Either B or C wins new election ──► becomes leader
  Job fires again (with 5–30s delay)

Gap risk: a scheduled job could be missed once during leader failover.
Acceptable when occasional missed execution is tolerable.
```

### Strategy 2: Distributed Lock (More Resilient)

Any instance can run the job, but only the one that acquires the lock does.

```
Job fires at 2:00 AM on all 10 instances simultaneously:
  Instance A: SET "job:daily-report:2024-01-15" NX PX 3600000 ──► acquires lock ──► executes
  Instance B: NX fails ──────────────────────────────────────────────────────────► skips
  Instance D: NX fails ──────────────────────────────────────────────────────────► skips
  …

Key format:  job:{job-name}:{date}
TTL:         max expected job duration (set generous, e.g., 1 hour for a 10-minute job)
```

**Lock TTL = max job duration**: if the job dies mid-execution, the lock expires and another instance retries.

**At-least-once semantics**: partial execution → lock expires → another instance re-runs → make jobs idempotent.

---

## Fixed-Rate vs Fixed-Delay

| Mode | Behavior | Use case |
|---|---|---|
| **Fixed-rate** | Start every N seconds, regardless of how long the last run took | Regular heartbeats, metrics collection |
| **Fixed-delay** | Wait N seconds after previous run completes before starting again | Processing queue, cleanup tasks |

```
Fixed-rate (every 10s):
  Job 1 starts: 0s  → finishes: 8s
  Job 2 starts: 10s → finishes: 25s   (15s run time! but next is at 20s)
  Job 3 starts: 20s → overlap? yes, if not handled → use locking

Fixed-delay (10s after finish):
  Job 1 starts: 0s  → finishes: 8s
  Job 2 starts: 18s → finishes: 26s
  Job 3 starts: 36s → finishes: …
```

---

## Thundering Herd: Jitter

Many services scheduling at the same rounded time (2:00:00 AM) → spike in database load.

**Solution**: add random jitter so jobs stagger across a window:

```
Without jitter:
  2:00:00 AM: 200 services hit DB simultaneously → 200× load spike

With jitter:
  job_delay = random(0, 300)  // up to 5-minute random offset
  2:00:00 to 2:05:00 AM: services spread across 300s → smooth load
```

---

## DST (Daylight Saving Time) Handling

**Rule: always store and schedule in UTC internally. Convert to local time only for display.**

```
Problem with local time scheduling:
  clocks go back 1 hour at 2:00 AM
  "2:30 AM daily" job would fire TWICE (once before, once after clock change)
  or never fire on spring-forward night

Solution:
  Store job trigger as UTC cron: "0 6 * * *" (= 2AM EST)
  At job runtime: convert to local timezone for output/display only
```

---

## Real-World Examples

| Company | Use case | Implementation |
|---|---|---|
| **GitHub** | Repository maintenance (GC, stats aggregation) | Distributed Redis lock with jitter to avoid DB spikes. Key format: `job:{repo_id}:{job_type}:{date}` |
| **LinkedIn** | Feed ranking (recomputes relevance scores hourly) | Leader election via Zookeeper. Leader runs the hourly Spark job. Fallback: follower takes over within 30s |
| **Stripe** | Daily invoice generation, monthly billing | All crons run in UTC. Idempotent: invoice generation checks if `invoice:{period}:{userId}` already exists before creating |
| **Uber** | Surge pricing updates (every few minutes) | Fixed-rate with distributed lock + jitter per city to spread DB writes |

---

## MERN Dev Notes

```
npm install node-cron       # Simple cron-style scheduling for Node.js
npm install bullmq          # Redis-backed queue (supports repeat jobs with distributed safety)
npm install ioredis         # Redis client for distributed locking
```

```js
// Simple scheduled job (single instance) — node-cron
const cron = require('node-cron');

cron.schedule('0 2 * * *', async () => {
  console.log('Running nightly report job:', new Date().toISOString()); // UTC
  await generateDailyReport();
}, { timezone: 'UTC' });   // always UTC
```

```js
// Distributed scheduled job (multiple instances) — Bull repeat + Redis lock
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const redis = new Redis();

const reportQueue = new Queue('reports', { connection: redis });

// Schedule once (idempotent — Bull deduplicates by job name + repeat key)
await reportQueue.add(
  'daily-report',
  {},
  { repeat: { cron: '0 2 * * *', tz: 'UTC' } }
);

// Worker — only ONE worker processes each repeat occurrence
const worker = new Worker('reports', async (job) => {
  // Distributed lock to prevent concurrent execution across workers
  const lockKey  = `job:daily-report:${new Date().toISOString().split('T')[0]}`;
  const acquired = await redis.set(lockKey, '1', 'NX', 'PX', 3600000); // 1h TTL
  if (!acquired) return;  // another worker is already running this

  await generateDailyReport();
}, { connection: redis });
```

```js
// Jitter helper
function withJitter(baseCronMs, jitterMs = 60000) {
  const delay = Math.floor(Math.random() * jitterMs);
  return new Promise(resolve => setTimeout(resolve, delay))
    .then(() => runJob());
}
```

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| Why not just use cron on one server? | SPOF — if that server is down, the job never runs; and can't scale independently |
| Leader election vs distributed lock? | Leadership: simpler but 5–30s gap on failover. Distributed lock: any instance runs, more resilient, better for critical jobs |
| How to prevent double execution? | Redis `SET NX PX` with key scoped to job name + date; idempotent job logic as fallback |
| Fixed-rate vs fixed-delay? | Fixed-rate: stable intervals (metrics). Fixed-delay: predictable rest between runs (queue processing) |
| How to handle DST? | Always schedule in UTC internally; convert to local only for display |
| What is jitter and why? | Random delay added to scheduled start time to prevent all instances hitting DB simultaneously (thundering herd) |
| Lock TTL — how to choose? | Set to max expected job duration (generous). Too short → lock expires while running → duplicate execution |

**Red flags**:
- Multiple instances running cron without coordination
- Using local timezone for scheduling (DST bugs)
- No idempotency in scheduled jobs (re-runs cause duplicate records/emails)
- Lock TTL too short relative to job duration

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Scheduled job** | Work that runs on a time-based trigger, not user action or event |
| **Cron expression** | String notation defining a schedule (minute/hour/day/month/weekday) |
| **Leader election** | Coordination mechanism where one node is chosen to execute jobs; others stand by |
| **Distributed lock** | Mechanism (Redis `SET NX`) to ensure only one instance among many runs a critical section |
| **NX** | "Not eXists" — Redis flag that sets a key only if it doesn't already exist (atomic) |
| **TTL** (Time To Live) | Lock expiry duration; prevents lock from staying forever if holder crashes |
| **Thundering herd** | Multiple processes hitting a shared resource simultaneously, causing a load spike |
| **Jitter** | Random delay added to scheduled start to stagger thundering herd |
| **Fixed-rate** | Jobs start at consistent intervals from a reference time |
| **Fixed-delay** | Fixed wait time between end of one execution and start of next |
| **DST** (Daylight Saving Time) | Annual 1-hour clock shift; causes double-fire or missed execution if crons use local time |
| **UTC** (Coordinated Universal Time) | Universal time standard; no DST shifts; use for all internal scheduling |
| **BullMQ** | Node.js queue library with built-in Redis-backed repeat/cron job support |
