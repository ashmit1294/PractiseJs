# Thread Pools

> **Source:** https://layrs.me/course/lld/06-concurrency-and-threading/thread-pools
> **Category:** Concurrency — Resource Management

---

## TL;DR

| Pool Type | Behavior | Best For |
|---|---|---|
| **Fixed** | Constant N threads; queue tasks when all busy | Predictable, controlled-resource workloads |
| **Cached** | Creates new threads on demand; reuses idle ones | Bursty, many short-lived I/O tasks |
| **Work-Stealing** | Each thread has own queue; idle threads steal from busy ones | Recursive divide-and-conquer (fork-join) |

**Sizing formula:**
- CPU-bound: `pool_size = num_cores` (or `+ 1`)
- I/O-bound: `pool_size = num_cores × (1 + wait_time / compute_time)`

---

## The Analogy

A restaurant kitchen with a fixed number of chefs (threads). Orders (tasks) go to a ticket rail (task queue). When a chef finishes one order, they grab the next ticket. You don't hire a new chef for every order — that would be chaos. The pool of chefs is pre-hired, reused, and capped at a manageable number.

---

## Core Concept

A **thread pool** maintains a set of pre-created worker threads. Instead of creating and destroying a thread per task (expensive: ~1 ms + stack allocation), tasks are submitted to a queue and picked up by available workers.

```python
from concurrent.futures import ThreadPoolExecutor

def process(item):
    # simulate work
    return item * 2

items = [1, 2, 3, 4, 5, 6]

with ThreadPoolExecutor(max_workers=3) as pool:
    # Submit all tasks first (non-blocking)
    futures = [pool.submit(process, item) for item in items]
    # Collect results as they complete
    results = [f.result() for f in futures]

print(results)  # [2, 4, 6, 8, 10, 12]
```

The `with` block calls `shutdown(wait=True)` automatically — the pool waits for all tasks to finish before exiting.

**Sizing example:** Task spends 900 ms waiting on network, 100 ms processing. On 4 cores: `pool_size = 4 × (1 + 900/100) = 40`. Without oversubscription, cores idle while threads wait.

---

## When to Use

Use thread pools when: handling many short-lived tasks (web server requests), I/O-bound operations (API calls, file I/O), or any scenario where thread creation cost would dominate execution time.

Use `ProcessPoolExecutor` instead when: tasks are CPU-bound in Python (bypass GIL), or when fault isolation between tasks is required.

**Work-stealing pools** (`concurrent.futures.ProcessPoolExecutor` with fork-join, or Java's `ForkJoinPool`): ideal when tasks spawn subtasks of unpredictable sizes (parallel merge sort, tree traversal).

---

## Common Mistakes

**1. Using `ThreadPoolExecutor` for CPU-bound tasks in Python.** The GIL serializes execution. Switch to `ProcessPoolExecutor`.

**2. Not shutting down the pool.** Non-daemon threads prevent process exit. Always use the `with` context manager or call `shutdown()`.

**3. Submitting unlimited tasks without batching.** The default task queue is unbounded. Submitting millions of tasks fills memory before any execute.

```python
# Wrong: 10M tasks queued in memory before any run
for i in range(10_000_000):
    pool.submit(process, i)

# Right: process in batches
import itertools
for batch in itertools.batched(range(10_000_000), 1000):
    futures = [pool.submit(process, i) for i in batch]
    for f in futures: f.result()  # drain batch before next
```

**4. Oversizing the pool.** Hundreds of threads cause excessive context switching, memory pressure (each thread needs a stack), and cache thrashing. Rarely need more than 50–100 threads even for I/O-heavy work.

**5. Blocking on each future immediately after submit.** This serializes execution — you lose all concurrency.

```python
# Wrong: effectively single-threaded
for item in items:
    f = pool.submit(process, item)
    result = f.result()   # blocks until this one finishes

# Right: submit all, then collect
futures = [pool.submit(process, item) for item in items]
results = [f.result() for f in futures]
```

---

## Interview Q&A

**Q: Why use a thread pool instead of creating a thread per task?**
"Thread creation costs ~1 ms and allocates ~1 MB of stack. For 10,000 tasks, that's 10 seconds of overhead just for thread management. Thread pools amortize this cost — workers are created once and reused. They also cap concurrency, preventing resource exhaustion."

**Q: How do you size a thread pool?**
"CPU-bound: `num_cores` — adding more threads just causes context switching. I/O-bound: `num_cores × (1 + wait_time / compute_time)`. For a task with 900 ms network wait and 100 ms processing on 4 cores: 4 × 10 = 40 threads. In practice I'd start with the formula then measure."

**Q: Explain work-stealing.**
"Each thread has its own deque of tasks. When a thread finishes its queue, it steals tasks from the tail of another thread's queue. This dynamically load-balances without central coordination. Ideal for divide-and-conquer: a parent task splits into subtasks of variable size; work-stealing ensures no thread sits idle while another is overloaded."

**Q: Can you implement a simple thread pool?**
"The core: a bounded task queue (thread-safe), N worker threads each looping: `while not shutdown: task = queue.get(); task()`. Submit adds to the queue; shutdown signals workers to stop."

---

## Key Takeaways

- Thread pools **reuse** worker threads to eliminate creation/destruction overhead for each task
- **Fixed** for predictable loads; **Cached** for bursty I/O; **Work-Stealing** for recursive/variable tasks
- Sizing: `num_cores` for CPU-bound, `num_cores × (1 + wait/compute)` for I/O-bound — always measure
- **Python GIL**: use `ProcessPoolExecutor` for CPU-bound, `ThreadPoolExecutor` for I/O-bound
- Always shut down via `with` block; submit tasks in batches if the input is very large
