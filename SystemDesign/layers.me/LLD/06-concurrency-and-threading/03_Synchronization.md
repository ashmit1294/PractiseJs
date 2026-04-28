# Synchronization

> **Source:** https://layrs.me/course/lld/06-concurrency-and-threading/synchronization
> **Category:** Concurrency — Primitives

---

## TL;DR

| Primitive | Use When |
|---|---|
| **Lock / Mutex** | One thread at a time in a critical section |
| **Semaphore(N)** | Limit concurrent access to N resources (connection pools) |
| **RLock (Reentrant)** | Same thread needs to acquire the same lock again (recursive calls) |
| **Read-Write Lock** | Read-heavy workload — multiple readers OR one exclusive writer |
| **Condition Variable** | Thread must wait until a specific condition becomes true |

**Critical section goal:** Mutual Exclusion + Progress + Bounded Waiting.

---

## The Analogy

A bathroom key at a petrol station. One key = one lock = mutual exclusion. A pool of 3 database connections = semaphore(3) — third person has to wait in line. A library reading room with one whiteboard = read-write lock: many people can read simultaneously, but only one person can write on the whiteboard (and nobody reads while they do).

---

## Core Concept

Synchronization prevents **race conditions** — outcomes that depend on unpredictable thread timing. A race condition occurs when multiple threads read-modify-write shared state without coordination.

```python
import threading

counter = 0
lock = threading.Lock()

def increment():
    global counter
    for _ in range(100_000):
        with lock:          # critical section: read + add + write protected
            counter += 1

t1 = threading.Thread(target=increment)
t2 = threading.Thread(target=increment)
t1.start(); t2.start()
t1.join(); t2.join()
print(counter)  # Always 200000. Without lock: random (e.g. 156789)
```

The `with lock:` context manager acquires on entry, releases on exit — even if an exception is raised. This is the only safe pattern.

**Semaphore for resource pools:**

```python
db_sem = threading.Semaphore(2)   # max 2 concurrent DB connections

def query():
    with db_sem:                  # blocks if 2 threads already hold it
        do_database_work()
```

**Read-Write Lock concept:** Multiple readers can hold the lock simultaneously. A writer needs exclusive access — waits for all readers to finish, then blocks new readers. Use Python's `threading.RLock` for reentrant, or `rwlock` library for read-write.

---

## When to Use Which Primitive

- **Mutex/Lock**: default choice for any shared mutable state
- **Semaphore**: when you want exactly N concurrent accesses (connection pool, rate limiter)
- **RLock**: when your code is recursive or a synchronized method calls another synchronized method
- **RW Lock**: when data is read frequently and written rarely (caches, configuration)
- **Condition Variable**: when a thread must wait for a state change (producer-consumer, barrier)

---

## Common Mistakes

**1. Forgetting to release on error paths.** An early `return` or exception while holding a lock deadlocks all other threads.

```python
# Wrong:
lock.acquire()
if error: return    # lock never released!
lock.release()

# Right:
with lock:
    if error: return  # auto-released
```

**2. Deadlock from inconsistent lock ordering.** Thread 1: `lock_a → lock_b`. Thread 2: `lock_b → lock_a`. Fix: establish a global order and always acquire in that order.

**3. Using `Lock` for recursive code — it deadlocks.** A thread trying to re-acquire a `Lock` it already holds blocks itself forever. Use `RLock`.

**4. Holding locks too long.** Don't do expensive I/O or computation inside a critical section. Read shared data (in lock), release, compute, re-acquire to write.

**5. Check-then-act outside lock.**

```python
# Wrong: another thread can empty the list between check and pop
if len(shared_list) > 0:
    with lock: item = shared_list.pop()

# Right: check and act atomically
with lock:
    if len(shared_list) > 0:
        item = shared_list.pop()
```

**6. Not protecting all accesses.** If `increment()` uses a lock but `get_and_reset()` reads without one, it's still a race condition.

---

## Interview Q&A

**Q: What causes a race condition?**
"A read-modify-write operation on shared data without synchronization. `counter += 1` is three instructions: read, add, write. Two threads can interleave, both read the same value, and both write the same incremented value — losing one update."

**Q: Mutex vs semaphore?**
"Mutex: binary (locked/unlocked), one thread owns it and must be the one to release it — protects a critical section. Semaphore(N): counter allowing N concurrent holders — controls access to a resource pool. A mutex is a semaphore(1) with ownership semantics."

**Q: How do you implement a thread-safe singleton?**

```python
class Singleton:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:       # first check (no lock)
            with cls._lock:
                if cls._instance is None:  # second check (inside lock)
                    cls._instance = super().__new__(cls)
        return cls._instance
```

Double-checked locking: the first check avoids lock overhead for the common case; the second check inside the lock prevents a race.

**Q: When to use a read-write lock?**
"When reads vastly outnumber writes — like a DNS cache or configuration store. Regular locks serialize all readers unnecessarily. RW locks allow concurrent reads (no contention), only serializing writes. Trade-off: more complex implementation, potential writer starvation if reads never stop."

---

## Key Takeaways

- **Locks** (mutexes) provide mutual exclusion — only one thread in the critical section at a time
- **Always** use `with lock:` / try-finally to guarantee release on all exit paths
- Match the primitive to the use case: semaphore for resource pools, RLock for recursive code, RW lock for read-heavy workloads
- Prevent deadlocks with **consistent lock ordering** across all threads
- **Minimize critical sections** — hold locks only as long as strictly necessary
