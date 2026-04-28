# Threads vs Processes

> **Source:** https://layrs.me/course/lld/06-concurrency-and-threading/threads-vs-processes
> **Category:** Concurrency — Architecture

---

## TL;DR

| Dimension | Process | Thread |
|---|---|---|
| **Memory** | Isolated (own heap + stack) | Shared heap; own stack only |
| **Creation cost** | 1–10 ms, expensive | 0.01–0.1 ms, cheap |
| **Communication** | IPC: pipes, sockets, shared mem | Shared variables (needs locks) |
| **Fault isolation** | Crash in one → others survive | Crash in one → entire process dies |
| **Python CPU-bound** | ✅ bypasses GIL | ❌ GIL serializes execution |
| **I/O-bound** | ✅ | ✅ (threads are lighter) |

---

## The Analogy

**Process** = a separate house. Isolated, safe, but expensive to build. Communicate by post (IPC).

**Thread** = a separate room in the same house. Cheap, shares plumbing and electricity (memory), but if one room catches fire the whole house burns (process crash).

---

## Core Concept

A **process** is an independent program instance with its own memory space. A **thread** is a lightweight unit of execution inside a process, sharing its memory.

**When CPU-bound — use processes (bypasses Python's GIL):**

```python
import multiprocessing, time

def cpu_task(n):
    return sum(i * i for i in range(n))

# Processes: true parallelism on multiple cores
with multiprocessing.Pool(processes=4) as pool:
    pool.map(cpu_task, [10_000_000] * 4)
# ~2x faster than threads on 4-core machine for pure computation
```

**When I/O-bound — use threads (lighter, GIL released during I/O waits):**

```python
import threading, urllib.request

def fetch(url):
    with urllib.request.urlopen(url, timeout=5) as r:
        return len(r.read())

threads = [threading.Thread(target=fetch, args=(url,)) for url in urls]
for t in threads: t.start()
for t in threads: t.join()
# Faster than processes because thread creation is cheaper, no GIL during network wait
```

**Python's GIL:** Only one thread runs Python bytecode at a time. For CPU-bound work, threads don't help — use `multiprocessing`. In Java/C++, threads achieve true parallelism; the choice depends on memory isolation needs.

---

## When to Use Which

| Scenario | Choice | Reason |
|---|---|---|
| CPU-intensive computation (Python) | Processes | Bypass GIL |
| Web scraping / API calls | Threads | I/O-bound, GIL released |
| Shared mutable state needed | Threads | No IPC overhead |
| Fault isolation required | Processes | One crash doesn't kill others |
| Untrusted/sandboxed code | Processes | Memory isolation |

---

## Common Mistakes

**1. Using threads for CPU-bound work in Python.** Python's GIL prevents true parallelism. Four threads on a CPU task run sequentially, no faster than one thread. Use `ProcessPoolExecutor`.

**2. Not joining threads/processes.** The main program exits before workers finish, losing results.

```python
threads = [threading.Thread(target=worker, args=(i,)) for i in range(5)]
for t in threads: t.start()
for t in threads: t.join()  # Must join!
```

**3. Sharing regular Python objects between processes.** Each process gets a copy; changes don't propagate. Use `multiprocessing.Value`, `multiprocessing.Array`, or `Manager` for shared state.

**4. Creating one thread/process per task.** For 10,000 tasks, that's 10,000 thread creations. Use `ThreadPoolExecutor` or `ProcessPoolExecutor` with a capped number of workers.

**5. Missing `if __name__ == '__main__':` guard in Python.** On Windows, `multiprocessing` re-imports the main module in each new process. Without the guard, each process creates more processes → fork bomb.

---

## Interview Q&A

**Q: When would you use threads vs processes in Python?**
"I/O-bound tasks: threads — they're 10–100x cheaper to create and the GIL is released during network/disk waits. CPU-bound tasks: processes — they bypass the GIL and achieve true parallelism. If I need fault isolation or am running untrusted code, I'd always use processes regardless of task type."

**Q: What happens if a thread crashes?**
"An unhandled exception in a thread typically crashes the entire process because threads share memory. A segfault in one thread (C extension, etc.) definitely kills all threads. This is why fault-sensitive services use process isolation."

**Q: Can processes share file descriptors?**
"Yes — child processes inherit file descriptors from the parent via `fork()`. This is how process pools share listening sockets: the parent creates the socket, forks workers, and all workers accept connections on it."

**Q: What's the cost of a context switch?**
"Thread context switch: microseconds — threads share memory, so no TLB flush needed. Process context switch: tens of microseconds — requires saving/restoring memory mappings, TLB flush. At scale (thousands of concurrent connections), this difference matters significantly."

---

## Key Takeaways

- **Processes**: isolated memory, expensive to create, communicate via IPC, crash-safe
- **Threads**: shared memory, cheap, communicate via variables (need locks), one crash kills all
- **Python GIL**: use processes for CPU-bound, threads for I/O-bound
- **Java/C++**: threads achieve true parallelism; choice driven by isolation vs shared-state needs
- At scale: **pool** threads/processes (fixed count) rather than creating one per task
