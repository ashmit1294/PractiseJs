# Producer-Consumer Problem

> **Source:** https://layrs.me/course/lld/06-concurrency-and-threading/producer-consumer-problem
> **Category:** Concurrency — Classic Pattern

---

## TL;DR

| Approach | Complexity | When to Use |
|---|---|---|
| **`queue.Queue`** (Python) / `BlockingQueue` (Java) | Low | Production — always prefer this |
| **Lock + Condition Variables** | Medium | Educational, custom requirements |
| **Semaphores** | Medium | Low-level resource counting |

| Must-Know Rules | Why |
|---|---|
| Use `while` not `if` for condition checks | Spurious wakeups exist |
| Always call `notify()` after changing state | Otherwise waiting threads sleep forever |
| Release lock before expensive work | Avoid holding lock during slow operations |

---

## The Analogy

A bakery. Bakers (producers) place loaves on a shelf (bounded buffer, capacity=10). Customers (consumers) take loaves. If the shelf is full, bakers wait. If it's empty, customers wait. A manager (the lock) ensures only one person touches the shelf at a time, and signals when the situation changes.

---

## Core Concept

The Producer-Consumer problem coordinates threads accessing a **bounded shared buffer**: producers add items, consumers remove them, both blocking when the buffer is full/empty respectively.

```python
import threading, queue

work_queue = queue.Queue(maxsize=5)  # bounded buffer

def producer(q, items):
    for item in items:
        q.put(item)          # blocks if full

def consumer(q):
    while True:
        try:
            item = q.get(timeout=2)  # blocks if empty
            process(item)
            q.task_done()
        except queue.Empty:
            break            # no more work
```

`queue.Queue` handles all locking and condition signaling internally. Always prefer it in production.

**Manual implementation** (when you need more control): acquire lock → check condition in `while` loop → `wait()` → perform operation → `notify()` → release lock.

---

## When to Use

This pattern appears everywhere: web server request queues, Kafka/RabbitMQ message queues, logging systems (buffer log messages to avoid blocking app threads), thread pools (tasks are produced, workers consume them), data pipeline stages.

---

## Common Mistakes

**1. Using `if` instead of `while` for condition check.** Condition variables can have spurious wakeups — a thread wakes up even without a `notify()`. Another thread may also consume the condition between notification and re-acquiring the lock. Always re-check the condition after waking.

```python
# Wrong:
if len(buffer) >= capacity: self.not_full.wait()

# Right:
while len(buffer) >= capacity: self.not_full.wait()
```

**2. Forgetting to call `notify()`.** If a producer adds an item but doesn't notify the consumer's condition variable, the consumer sleeps forever.

**3. Holding the lock during expensive operations.** Remove the item from the buffer (inside lock), release the lock, then process the item (outside lock). Otherwise all other threads block during slow processing.

**4. Wrong semaphore initialization.** `empty_slots = Semaphore(capacity)`, `full_slots = Semaphore(0)`. Swapping these causes immediate deadlock.

**5. Not handling `queue.Empty` for non-blocking gets.** Without exception handling, the consumer crashes on an empty queue.

---

## Interview Q&A

**Q: How do you solve producer-consumer?**
"In production, I'd use Python's `queue.Queue` or Java's `BlockingQueue` — they handle all synchronization internally. If implementing from scratch, I'd use a lock with two condition variables: `not_full` (producers wait here) and `not_empty` (consumers wait here). Use `while` loops, not `if`, for condition checks to handle spurious wakeups."

**Q: What happens without synchronization?**
"Race conditions: two producers might both read `len(buffer) < capacity` as true, both add an item, overflowing the buffer. Or a consumer reads from an empty buffer and gets undefined data."

**Q: What is a poison pill?**
"A special sentinel value (e.g., `None` or a `STOP` object) that producers send when they're done. Consumers, upon receiving it, exit gracefully. Useful for clean shutdown without external flags."

**Q: Differences between the three approaches?**
"Blocking queue: simplest, safest, best for most cases. Lock + condition variables: more control, educational, easier to make mistakes. Semaphores: good for counting resources, still need a mutex for actual buffer manipulation — correct initialization is critical."

---

## Key Takeaways

- Producer-Consumer requires: mutual exclusion on the buffer, blocking when full/empty, notification when conditions change
- **Prefer `queue.Queue`** (Python) or `BlockingQueue` (Java) in production — they handle everything correctly
- When implementing manually: `while` not `if`, notify after every state change, minimize time holding the lock
- Real-world applications: message queues (Kafka), thread pools, logging systems, any data pipeline stage
- Key interview signals: clarify bounds, threading count, and what happens at full/empty before writing code
