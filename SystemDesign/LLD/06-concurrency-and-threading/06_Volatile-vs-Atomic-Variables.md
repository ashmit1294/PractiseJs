# Volatile vs Atomic Variables

> **Source:** https://layrs.me/course/lld/06-concurrency-and-threading/volatile-atomic-variables
> **Category:** Concurrency — Lock-Free Programming

---

## TL;DR

| | `volatile` | `atomic` | `lock` |
|---|---|---|---|
| **Guarantees** | Visibility only | Visibility + atomicity | Visibility + atomicity + complex transactions |
| **Overhead** | Very low | Low (CAS) | Higher (kernel call, context switch) |
| **Use for** | Simple flags (1 writer) | Single-variable counters, pointers | Multiple variables, complex invariants |
| **Python** | No built-in; use locks | `multiprocessing.Value` | `threading.Lock` |
| **Java** | `volatile` keyword | `AtomicInteger`, `AtomicReference` | `synchronized`, `ReentrantLock` |

---

## The Analogy

**Visibility (volatile):** Two cooks sharing a whiteboard. One writes "oven is hot" on the board (main memory). Without volatile, each cook might only check their private notepad (CPU cache) and miss the update. Volatile forces everyone to always read from and write to the shared whiteboard.

**Atomicity (atomic/CAS):** Replacing a Post-it note. You check what the note currently says, write a new one, then swap them in one uninterruptible action. If someone else swapped it while you weren't looking, you retry. That's compare-and-swap.

---

## Core Concept

Modern CPUs use caches and instruction reordering for performance. Thread A writes `flag = True` but Thread B might see the old value because the write is still in Thread A's cache. **Volatile** solves this by ensuring writes flush to main memory and reads fetch from main memory.

But volatile doesn't help with `counter += 1` — that's three operations (read, add, write). Two threads can interleave them and lose updates. **Atomic** variables use **compare-and-swap (CAS)** — a single CPU instruction that atomically checks and updates a value.

```python
# CAS loop pattern (conceptual — Java AtomicInteger does this internally)
def cas_increment(atomic_ref):
    while True:
        current = atomic_ref.get()
        new_val = current + 1
        if atomic_ref.compare_and_set(current, new_val):
            return   # success — no other thread changed it
        # else: retry — someone else changed it between get and set
```

If CAS fails (another thread changed the value), retry. Under low contention this is nearly free. Under high contention, use a lock.

---

## When to Use

- **Volatile**: single flag written by one thread, read by many (stop flag, initialized-once config)
- **Atomic**: single variable that multiple threads increment/decrement/swap (counters, sequence numbers, lock-free stacks/queues)
- **Lock**: when you need to update multiple related variables as a single atomic transaction (bank transfer updating two balances)

---

## Common Mistakes

**1. Using volatile for compound operations.** Volatile makes each individual read/write visible, but `counter++` is still three separate operations — not atomic.

```java
// Java — WRONG: volatile doesn't make ++ atomic
private volatile int counter = 0;
counter++;  // race condition!

// Right: use AtomicInteger
AtomicInteger counter = new AtomicInteger(0);
counter.incrementAndGet();
```

**2. Forgetting memory ordering for related writes.** If you write `data = value` then `ready = true`, without a memory barrier the CPU may reorder these — another thread sees `ready=true` but stale `data`. Make `ready` volatile (Java/C++) to create a happens-before guarantee.

**3. Infinite CAS loops under high contention.** If 100 threads all constantly CAS the same variable, most fail and retry — burning CPU (livelock). Add backoff or fall back to a lock.

**4. Assuming atomic is always faster than locks.** For simple single-variable operations with low contention, atomics win. For high contention or complex operations, locks that put threads to sleep can be more efficient than spinning.

**5. Ignoring the ABA problem.** Thread 1 reads value A, gets preempted. Thread 2 changes A → B → A. Thread 1 resumes, CAS succeeds (sees A again), but missed the intermediate state. Fix: versioned references (`AtomicStampedReference` in Java).

---

## Interview Q&A

**Q: What's the difference between volatile and synchronized in Java?**
"`volatile` guarantees visibility — every read goes to main memory, every write flushes to main memory — but does NOT provide atomicity for compound operations. `synchronized` provides both visibility AND atomicity by creating a critical section. Use `volatile` for simple flags; use `synchronized` or `AtomicInteger` for compound operations."

**Q: Explain compare-and-swap.**
"CAS is a CPU-level atomic instruction: `if (memory[addr] == expected) { memory[addr] = new_val; return true; } else { return false; }`. The check-and-update is uninterruptible — no other thread can sneak in between. If it fails, we read the new current value and retry. This is the foundation of lock-free data structures."

**Q: When would you use atomic instead of a lock for a counter?**
"For a simple counter that many threads increment, `AtomicInteger` avoids the overhead of kernel-level locks and context switches. Under low contention, the CAS usually succeeds first try — much faster than acquiring a mutex. Under high contention (many threads fighting), though, a lock can be better because it suspends losers rather than spinning."

**Q: What is the ABA problem?**
"Thread 1 reads head pointer as A, gets preempted. Thread 2 pops A, pops B, pushes A back. Thread 1 resumes, CAS sees A == expected and succeeds — but the stack's intermediate state was lost. Solution: include a version stamp with every CAS (`AtomicStampedReference` in Java, `std::atomic<std::pair<T, int>>` in C++)."

---

## Key Takeaways

- **Volatile**: memory visibility only — reads/writes bypass CPU cache. NOT sufficient for compound operations like `++`
- **Atomic**: visibility + atomicity via CAS — lock-free, low overhead for simple operations
- **CAS loop**: read current → compute new → swap if unchanged, retry otherwise — the foundation of lock-free programming
- **ABA problem**: CAS can succeed incorrectly if a value changed A→B→A; fix with versioned references
- Choose: volatile for flags, atomics for counters/single-variable updates, locks for multi-variable transactions
