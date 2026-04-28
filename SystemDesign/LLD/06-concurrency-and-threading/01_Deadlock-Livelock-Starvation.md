# Deadlock, Livelock & Starvation

> **Source:** https://layrs.me/course/lld/06-concurrency-and-threading/deadlock-livelock-starvation
> **Category:** Concurrency — Hazards

---

## TL;DR

| Hazard | Threads | CPU | Progress |
|---|---|---|---|
| **Deadlock** | Blocked forever | Low | None |
| **Livelock** | Running | High | None |
| **Starvation** | Running (some) | Normal | Some threads only |

| Prevention | Deadlock | Livelock | Starvation |
|---|---|---|---|
| Lock ordering | ✅ breaks circular wait | — | — |
| Timeouts | ✅ breaks hold-and-wait | ✅ + backoff | — |
| Fair scheduling | — | — | ✅ |

---

## The Analogy

**Deadlock:** Two cars at a one-lane bridge, each waiting for the other to back up. Neither can proceed — forever.

**Livelock:** Two polite people in a narrow hallway, both stepping left simultaneously, then both stepping right, repeating indefinitely. They're moving, but going nowhere.

**Starvation:** A fast checkout lane where three aggressive shoppers constantly squeeze in front of one patient shopper who never gets served.

---

## Core Concept

**Deadlock** requires ALL four Coffman conditions simultaneously. Break any one to prevent it:

1. **Mutual Exclusion** — resources can't be shared (one thread holds a lock at a time)
2. **Hold and Wait** — threads hold a resource while waiting for others
3. **No Preemption** — resources can't be forcibly taken
4. **Circular Wait** — A waits for B's resource, B waits for A's resource

```python
import threading
lock_a, lock_b = threading.Lock(), threading.Lock()

def thread1():
    lock_a.acquire()          # holds A
    lock_b.acquire()          # waits for B → DEADLOCK
    lock_b.release(); lock_a.release()

def thread2():
    lock_b.acquire()          # holds B
    lock_a.acquire()          # waits for A → DEADLOCK
    lock_a.release(); lock_b.release()
```

**Fix — lock ordering** (break circular wait): both threads always acquire `lock_a` first, then `lock_b`.

**Livelock** = deadlock with motion. Threads react to each other's actions without making progress. Fix: randomized exponential backoff before retry.

**Starvation** = some thread(s) perpetually denied CPU time because high-priority or aggressive threads always win. Fix: fair locks, priority aging (gradually raise waiting thread's priority).

---

## When to Watch For

- Any code that acquires multiple locks → deadlock risk
- Retry loops without backoff → livelock risk
- Unfair lock implementations or thread priority differences → starvation risk

---

## Common Mistakes

**1. Acquiring locks in different orders across threads.** This creates circular wait. Document and enforce a global lock order.

**2. Not releasing locks on error paths.** An early `return` or exception leaves the lock held forever.

```python
# Wrong: lock never released if error_condition is true
lock.acquire()
if error_condition: return
lock.release()

# Right:
with lock:  # auto-releases on any exit
    if error_condition: return
```

**3. Confusing livelock with deadlock.** High CPU + no progress = livelock. Low CPU + blocked threads = deadlock. Add logging to track actual work completed, not just activity.

**4. Polling with sleep instead of condition variables.** Busy-polling wastes CPU and risks starvation. Use `threading.Condition.wait()` which releases the lock and wakes on notification.

**5. Ignoring lock timeouts.** Blocking acquire with no timeout = no deadlock detection. Use `lock.acquire(timeout=5)` and handle failure.

---

## Interview Q&A

**Q: What are the four conditions for deadlock?**
"Mutual exclusion, hold-and-wait, no preemption, circular wait. Break any one: lock ordering breaks circular wait; timeouts break hold-and-wait; `tryLock` and releasing on failure breaks hold-and-wait."

**Q: How do you diagnose deadlock vs livelock in production?**
"Deadlock: threads in BLOCKED state, low CPU, stack traces show waiting on locks — use `jstack` in Java or `py-spy` in Python. Livelock: threads RUNNABLE, high CPU, stack traces show repeated lock acquisition attempts. Add logging to measure actual progress, not just activity."

**Q: How do databases handle deadlock?**
"Databases use deadlock detection via wait-for graphs. When a cycle is detected, they pick a victim transaction (usually the one with least work) and roll it back. The application retries. This is detection + recovery rather than prevention."

**Q: What is priority inversion?**
"A high-priority thread waits for a lock held by a low-priority thread that never gets scheduled — effectively the high-priority thread is starved. Solution: priority inheritance (temporarily boost the low-priority thread's priority while it holds the lock). Classic example: Mars Pathfinder mission."

---

## Key Takeaways

- **Deadlock** requires all four Coffman conditions; break any one, especially circular wait via lock ordering
- **Livelock**: threads run but make no progress — fix with randomized exponential backoff
- **Starvation**: unfair scheduling; fix with fair locks or queue-based access
- **Always** use `with lock:` or try-finally to ensure locks are released on all exit paths
- Diagnose with thread state + CPU usage: blocked+low = deadlock; running+high+no-progress = livelock
