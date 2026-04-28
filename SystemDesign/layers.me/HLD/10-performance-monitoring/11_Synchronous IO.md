# Synchronous I/O

## ELI5
Imagine a waiter who, after taking your order, stands at the kitchen window doing nothing until your food is ready — refusing to serve any other tables. That waiter can only serve ~5 tables per hour. With async, the waiter takes the order, walks away, serves other tables, and returns when the kitchen calls. Same waiter now serves 50+ tables per hour.

## Analogy
Synchronous I/O = a cashier who freezes until the credit card processor responds. Async I/O = a cashier who starts the card payment, helps the next customer, and alerts when the card is approved.

---

## Core Concept
**Synchronous I/O** means a thread blocks during I/O (waiting for disk, network, DB response). The thread consumes OS resources while doing literally nothing. At scale, this throttles throughput far below what hardware supports.

### Thread Blocking Math

```
Thread pool size:  200 threads
Average I/O wait:  150ms (DB query)
Average CPU time:  10ms (compute)
Total request time: 160ms

max_rps = thread_pool_size / request_time
        = 200 / 0.160s
        = 1,250 requests/second

CPU utilization = cpu_time / total_time
                = 10ms / 160ms
                = 6.25% ← CPU is idle 93.75% of the time!

You have cores doing nothing while threads sit blocked.
```

### Async Model Math

```
CPU cores: 8 (2 threads each = 16 async workers)
CPU time per request: 10ms

max_rps = workers / cpu_time
        = 16 / 0.01s
        = 12,800 requests/second at ~100% CPU utilization

Improvement: 12,800 / 1,250 = 10.24× better throughput
Same hardware, radically different I/O model.
```

### Thread Sizing Formula (If You Must Use Threads)

```
threads = cores × (1 + wait_time / compute_time)

With 8 cores, 150ms I/O, 10ms CPU:
threads = 8 × (1 + 150/10) = 8 × 16 = 128 threads

This is Little's Law applied to thread pools.
PROBLEM: 128 threads × ~1MB stack = 128MB just for stacks.
At 1000+ threads, OS scheduling overhead dominates.
```

---

## The C10K Problem

```
C10K = serving 10,000 concurrent connections

PROBLEM with threads:
  10,000 connections × 1 thread each
  OS must schedule 10,000 threads
  Context switch cost: ~1-10 microseconds each
  Scheduler overhead alone: hundreds of milliseconds

OS thread schedulers break down at this scale.
```

---

## Async Implementation Models

```
1. NIO (Non-blocking I/O) — Java NIO, Python asyncio
   ─────────────────────────────────────────────────
   Thread polls selector for ready events
   Maximum performance, complex state management
   Best for: frameworks building async libraries

2. Event Loop (Node.js + libuv/epoll) — JavaScript
   ─────────────────────────────────────────────────
   Single thread + event queue + kernel I/O notifications
   Perfect for I/O-bound workloads
   DANGER: CPU-heavy tasks block the loop for all users

3. Reactive Streams (Project Reactor, RxJava)
   ─────────────────────────────────────────────────
   Composable async pipelines with backpressure
   Backpressure: consumer tells producer "slow down"
   Best for: complex orchestration of async operations

4. Green Threads / Goroutines (Go, Erlang/BEAM)
   ─────────────────────────────────────────────────
   M:N multiplexing: many goroutines → few OS threads
   Write synchronous-looking code, get async performance
   Go: goroutines start at 2KB stack (vs ~1MB OS thread)
   BEAM: 2KB per Erlang process, millions of processes

5. Message Queues (Kafka, RabbitMQ) — Decouple
   ─────────────────────────────────────────────────
   Producer returns immediately after enqueueing
   Consumer processes async — completely decoupled
   Best for: work that doesn't need synchronous response
```

---

## ASCII: Sync vs Async Thread Lifecycle

```
SYNCHRONOUS I/O (200 threads, 6.25% CPU)
──────────────────────────────────────────────────
Thread 1: [CPU:10ms][======BLOCKED:150ms======][CPU:10ms]...
Thread 2:         [CPU:10ms][======BLOCKED:150ms======][CPU:10ms]...
Thread 3:                 [CPU:10ms][======BLOCKED:150ms======]...
...
Thread 200:                                            [CPU:10ms]...

Each thread: 10ms work, 150ms blocking = 6.25% CPU

ASYNCHRONOUS I/O (16 workers, ~100% CPU)
──────────────────────────────────────────────────
Worker 1: [CPU][CPU][CPU][CPU][CPU][CPU][CPU][CPU][CPU]...
Worker 2: [CPU][CPU][CPU][CPU][CPU][CPU][CPU][CPU][CPU]...
...
Worker 16: [CPU][CPU][CPU][CPU][CPU][CPU][CPU][CPU][CPU]...

While I/O is in-flight, workers handle OTHER requests' CPU work.
```

---

## ASCII: Event Loop Architecture (Node.js Model)

```
                     ┌────────────────────────────┐
HTTP Request ──────► │      Event Queue            │
                     │  [req1, req2, req3, ...]    │
                     └─────────────┬──────────────┘
                                   │ dequeue one at a time
                     ┌─────────────▼──────────────┐
                     │      Event Loop             │
                     │   (single-threaded)         │
                     └──────┬──────────────────────┘
                            │
             ┌──────────────▼──────────────┐
             │     Is it I/O?              │
             │   YES: delegate to          │
             │   libuv thread pool         │  ← OS kernel
             │   NO: execute now (CPU)     │
             └──────────────┬──────────────┘
                            │
             callback registered → resume when I/O completes
```

---

## Decision Guide: When to Use Async

```
USE ASYNC when:
  ✓ I/O-bound workload (DB queries, HTTP calls, filesystem)
  ✓ Average I/O latency > 50ms
  ✓ Need to handle > 1,000 concurrent connections
  ✓ Thread count shows > 80% in WAITING state (jstack/jcmd)

AVOID ASYNC when:
  ✗ CPU-bound workload (image processing, crypto, compression)
  ✗ Average I/O latency < 10ms
  ✗ < 1,000 concurrent connections (sync is simpler)
  ✗ Team lacks async experience (async bugs are hard to debug)
  ✗ Blocking third-party libraries you cannot change
```

---

## MERN Developer Notes

```javascript
// BAD: Blocking sequential I/O
app.get('/dashboard', async (req, res) => {
  const user = await db.getUser(req.userId);         // 50ms wait
  const orders = await db.getOrders(req.userId);     // 80ms wait (after user!)
  const prefs = await db.getPreferences(req.userId); // 40ms wait (after orders!)
  // Total: 170ms
});

// GOOD: Parallel async I/O (all-at-once)
app.get('/dashboard', async (req, res) => {
  const [user, orders, prefs] = await Promise.all([
    db.getUser(req.userId),         // \_
    db.getOrders(req.userId),       //  > all start simultaneously
    db.getPreferences(req.userId),  // /
  ]);
  // Total: max(50, 80, 40) = 80ms — dramatically better
});

// NODE.JS TRAP: Never block the event loop
app.get('/compute', (req, res) => {
  // BAD: Blocks ALL requests for 2 seconds
  const result = heavyCPUWork(req.data); // ← synchronous CPU
  res.json(result);
});

// BETTER: Offload CPU work to worker thread
const { Worker } = require('worker_threads');
app.get('/compute', (req, res) => {
  const worker = new Worker('./heavy-work.js', { workerData: req.data });
  worker.on('message', (result) => res.json(result));
});
```

---

## Real-World Examples

| Company | Problem | Solution | Result |
|---|---|---|---|
| Spotify BFF | Java sync threads, high latency | CompletableFuture parallel calls | P99: 500ms → 100ms |
| Netflix Zuul 1→2 | Zuul 1 (Apache): 1 thread/connection | Zuul 2: Netty NIO, async event loop | 10K+ connections <100 threads, 80% memory reduction, 5× throughput |
| Discord | 2.5M WebSocket connections | Elixir/BEAM (Erlang VM): 2KB per process | 12 servers for 2.5M concurrent connections |
| Node.js servers | C10K challenge | Single-threaded event loop without thread overhead | Standard solution for high-concurrency APIs |

---

## Interview Cheat Sheet

**Q: Your Java API can only handle 1,000 req/s with 200 threads. How would you diagnose and fix?**

> A: First diagnose: run `jstack` and check how many threads are in WAITING/BLOCKED state. If >80% are blocked on I/O, the bottleneck is synchronous I/O, not CPU. Calculate max_rps = threads / avg_request_latency — with 200 threads and 160ms avg, that's exactly 1,250 rps. The fix: switch to async I/O (CompletableFuture, Reactor, or vert.x). For DB: use async drivers (R2DBC instead of JDBC). For HTTP calls: use async HTTP client. This turns 200 blocking threads into a few async workers handling thousands of concurrent requests.

**Q: Why doesn't increasing threads solve the sync I/O problem?**

> A: Thread creation has a hard cost: ~1MB stack per thread, OS scheduler overhead for context switching. Beyond ~500-1,000 threads, context switch overhead (1-10μs per switch) consumes an increasing fraction of CPU — this is the C10K problem. More threads doesn't help when the bottleneck is I/O wait time, not CPU. The actual fix is async so the same threads handle multiple requests' I/O concurrently.

**Q: What's the risk of Node.js's async event loop model?**

> A: Node.js uses a single-threaded event loop — any synchronous CPU work blocks ALL concurrent requests. A 2-second crypto operation blocks the event loop for 2 seconds, making your API unresponsive. Fix: use worker_threads for CPU-bound work, never do synchronous heavy computation on the main thread. For I/O (DB, HTTP), Node.js is excellent; for CPU-heavy work, Go or multi-threaded Java is safer.

**Q: Compare goroutines vs OS threads for handling I/O concurrency.**

> A: OS threads: ~1MB stack, scheduled by OS, context switch ~1-10μs. Goroutines: start at 2KB stack (grows dynamically), scheduled by Go runtime (M:N: many goroutines multiplexed to few OS threads), context switch ~100ns. At 10,000 goroutines: 20MB vs 10GB memory. Go runtime parks goroutines during I/O and resumes them when the kernel signals I/O completion — same write-sync-code-get-async-perf pattern as Erlang's BEAM.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **Synchronous I/O** | Thread blocks (pauses execution) waiting for I/O to complete |
| **Asynchronous I/O** | Thread initiates I/O and is freed to do other work; callback/future notifies on completion |
| **Event loop** | Single-threaded loop that processes I/O completion events — Node.js, nginx |
| **Non-blocking I/O** | Kernel-level API (epoll/kqueue) that notifies when I/O is ready instead of blocking |
| **C10K problem** | Challenge of handling 10,000 concurrent connections with OS threads |
| **Goroutine** | Go's lightweight async execution unit (~2KB stack, M:N multiplexed to OS threads) |
| **BEAM VM** | Erlang/Elixir virtual machine supporting millions of lightweight processes with isolated heaps |
| **Thread pool** | Fixed-size set of threads reused for tasks to avoid thread creation overhead |
| **Backpressure** | Mechanism where a slow consumer signals a fast producer to slow down — prevents overflow |
| **libuv** | Cross-platform async I/O library used by Node.js, provides event loop + thread pool for blocking I/O |
| **M:N threading** | Many user-space threads (goroutines) mapped to fewer OS threads — runtime handles scheduling |
