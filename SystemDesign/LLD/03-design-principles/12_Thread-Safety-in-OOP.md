# Thread Safety in OOP: Locks, Sync & Patterns

> **Source:** https://layrs.me/course/lld/03-design-principles/thread-safety-in-ood
> **Level:** Intermediate | **Read:** ~16 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Thread safety** | Object behaves correctly when accessed by multiple threads simultaneously |
| **Race condition** | Two threads read-modify-write the same data and overwrite each other |
| **Immutability** | Can't change after construction — inherently thread-safe, no locks needed |
| **Mutex / Lock** | Ensures only one thread executes a critical section at a time |
| **Atomic operation** | Single indivisible operation — no interleaving possible |
| **Deadlock** | Two threads each hold a lock the other needs — both wait forever |

> **Key Insight:** The root of most concurrency bugs is **shared mutable state**. The safest path is immutability — no mutation means no synchronization needed. When mutation is required, protect all access paths (including reads) with a lock.

---

## The Analogy — Bank Counter

- Single teller window: one customer at a time — safe but slow (serial)
- Multiple tellers sharing one cash drawer without coordination: race condition — cash goes missing
- Multiple tellers each with their own drawer: thread-local storage — fast and safe
- Lock on the shared drawer: mutex — safe, but creates a bottleneck

---

## Why This Matters in Interviews

- Design questions involving caches, counters, rate limiters, connection pools → must mention thread safety
- "How would you make this thread-safe?" is a direct question at mid/senior levels
- Framework: **identify shared state → choose strategy → explain trade-offs**

> **Red flags:** "I'll just use a global variable," assuming `count += 1` is atomic, not considering concurrent read issues, ignoring deadlock potential in multi-lock scenarios

---

## Four Strategies

| Strategy | When to Use | Trade-off |
|---|---|---|
| **Immutability** | State never changes after construction | May require creating new objects |
| **Synchronization (Lock)** | Shared mutable state with rare contention | Bottleneck if many threads compete |
| **Thread-Local Storage** | Per-thread data (request context, caches) | No sharing across threads |
| **Atomic Operations** | Simple counters / flags | Limited to single-variable operations |

---

## Core Concept

### The Problem — Race Condition

```python
import threading

class UnsafeCounter:
    def __init__(self): self.count = 0
    def increment(self):
        # LOOKS atomic, but is actually 3 operations: read → add → write
        self.count += 1

counter = UnsafeCounter()
threads = [threading.Thread(target=lambda: [counter.increment() for _ in range(1000)])
           for _ in range(10)]
for t in threads: t.start()
for t in threads: t.join()
print(f"Expected: 10000, Got: {counter.count}")   # e.g. Got: 9847 — lost updates!
```

### Strategy 1 — Synchronization (Lock)

```python
import threading

class SafeCounter:
    def __init__(self):
        self.count = 0
        self._lock = threading.Lock()
    
    def increment(self):
        with self._lock:     # only one thread executes this block at a time
            self.count += 1
    
    def get_count(self):
        with self._lock:     # even reads need synchronization!
            return self.count

# Same test as above → always outputs 10000
```

### Strategy 2 — Immutability

```python
from dataclasses import dataclass

@dataclass(frozen=True)    # Python's built-in immutable dataclass
class Point:
    x: float
    y: float
    
    def translate(self, dx: float, dy: float) -> 'Point':
        return Point(self.x + dx, self.y + dy)   # returns NEW object

point = Point(10, 20)
# point.x = 30   ← FrozenInstanceError!

new_point = point.translate(5, 5)
print(point)       # Point(x=10, y=20) — unchanged
print(new_point)   # Point(x=15, y=25)
# Multiple threads can call translate() simultaneously — completely safe, no locks
```

### Strategy 3 — Bank Account with Proper Synchronization

```python
import threading

class BankAccount:
    def __init__(self, balance: float):
        self._balance = balance
        self._lock = threading.Lock()
    
    def deposit(self, amount: float):
        if amount <= 0: raise ValueError("Amount must be positive")
        with self._lock:
            self._balance += amount
    
    def withdraw(self, amount: float) -> bool:
        if amount <= 0: raise ValueError("Amount must be positive")
        with self._lock:
            if self._balance >= amount:
                self._balance -= amount
                return True
            return False
    
    def get_balance(self) -> float:
        with self._lock:
            return self._balance

# Deadlock-free transfer — always acquire locks in consistent order (by object id)
def transfer(source: BankAccount, dest: BankAccount, amount: float) -> bool:
    first, second = (source, dest) if id(source) < id(dest) else (dest, source)
    with first._lock:
        with second._lock:
            if source._balance >= amount:
                source._balance -= amount
                dest._balance += amount
                return True
    return False
```

### Strategy 4 — Hold Lock Only for Critical Section

```python
class EventDispatcher:
    def __init__(self):
        self._listeners = []
        self._lock = threading.Lock()
    
    def add_listener(self, callback):
        with self._lock:
            self._listeners.append(callback)
    
    def dispatch(self, event):
        with self._lock:
            listeners_copy = list(self._listeners)   # snapshot under lock
        
        # Call listeners OUTSIDE the lock — don't hold lock during external calls!
        for listener in listeners_copy:
            listener(event)   # if listener is slow or tries to acquire another lock → no deadlock
```

---

## Common Mistakes

### 1. Synchronizing writes but not reads

```python
class BadCache:
    def __init__(self): self._data = {}; self._lock = threading.Lock()
    
    def put(self, key, value):
        with self._lock: self._data[key] = value
    
    def get(self, key):
        return self._data.get(key)   # WRONG: no lock on read!
        # May see partial data or cause corruption
```

### 2. Assuming `+=` is atomic

```python
# self.count += 1  →  3 operations: READ / ADD / WRITE
# Another thread can interleave between any of these
# Fix: use with self._lock: around the compound operation
```

### 3. Inconsistent lock ordering → deadlock

```python
# Thread 1: locks account_a, then tries to lock account_b
# Thread 2: locks account_b, then tries to lock account_a
# Result: both threads wait forever (deadlock)

# Fix: always acquire locks in a globally consistent order
# e.g., by object id: if id(a) < id(b): lock a first, then b
```

### 4. Holding lock during I/O or external calls

```python
def bad_method(self, item):
    with self._lock:
        self._items.append(item)
        send_to_api(item)   # WRONG: holding lock during slow API call — bottleneck!

def good_method(self, item):
    with self._lock:
        self._items.append(item)
    send_to_api(item)       # RIGHT: lock released before slow operation
```

---

## Python-Specific Notes

```python
# Python has the GIL (Global Interpreter Lock) — protects some operations
# but NOT compound operations like read-modify-write

# threading.Lock() — basic mutex
# threading.RLock() — reentrant lock (same thread can acquire multiple times)
# queue.Queue    — thread-safe producer-consumer queue (no explicit locking needed)
# threading.Event — thread signaling

# For CPU-bound parallel work → use multiprocessing (bypasses GIL)
```

---

## Interview Q&A (Quick Fire)

**Q: When do you mention thread safety in a design interview?**
> "Whenever the design involves shared resources: caches, counters, rate limiters, connection pools, or any object accessed by concurrent request handlers. I state: 'This cache will be accessed by multiple threads simultaneously, so I'll use a lock to protect reads and writes.'"

**Q: Framework for answering thread safety questions?**
> "Three steps: (1) identify the shared state — what data is accessed by multiple threads? (2) choose a strategy — immutability if state doesn't change, lock if it does, atomic for simple counters; (3) explain the trade-off — locks add overhead, immutability may require object copying."

**Q: What causes a deadlock and how do you prevent it?**
> "Deadlock occurs when Thread A holds Lock 1 and waits for Lock 2, while Thread B holds Lock 2 and waits for Lock 1. Prevention: always acquire multiple locks in a globally consistent order (e.g., by object ID). This breaks the circular wait condition."

**Q: Immutable vs. synchronized — when do you choose each?**
> "Immutability when objects represent values that don't change after creation (Point, Money, Config). No synchronization overhead at all. Synchronization when shared state must be mutable — like a counter or cache that multiple threads update. The cost is potential lock contention."

---

## Key Takeaways

- **Shared mutable state** is the root cause of concurrency bugs — minimize it
- **Immutability** is the simplest path to thread safety — no locks, no contention, no bugs
- **Synchronize ALL access** to shared mutable state — reads AND writes; compound operations are never atomic
- **Don't hold locks during I/O or external calls** — causes bottlenecks and potential deadlocks
- In interviews: **identify shared state → name your strategy → state the trade-off** — shows you think systematically about concurrency
