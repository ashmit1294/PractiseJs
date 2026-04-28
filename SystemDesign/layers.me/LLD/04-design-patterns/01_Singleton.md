# Singleton Pattern: Ensure One Instance

> **Source:** https://layrs.me/course/lld/04-design-patterns/singleton
> **Level:** Beginner | **Read:** ~10 min | **Category:** Creational

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Singleton** | A class that can only ever have one object in memory |
| **Global access point** | Everyone gets that same object, not a fresh copy |
| **Lazy initialization** | Don't create the instance until the first time it's needed |
| **Double-checked locking** | Check twice (with a lock) to avoid race conditions on creation |
| **Anti-pattern concern** | Singletons are global state — they make code harder to test |

---

## The Analogy

A country has exactly one President at a time. No matter who asks "who is president?", they all get the same answer — the same person. You can't instantiate a new president.

---

## Why This Matters in Interviews

- "Design a logging system / configuration / connection pool" → always mention Singleton
- Signal: "I'd make this a Singleton but inject it as a dependency rather than accessing it globally, so it stays testable"
- Shows: you know both the pattern AND its pitfalls

> **Red flags:** Not mentioning thread safety; saying "I always use Singleton for shared resources"; not knowing the alternatives (dependency injection)

---

## The Core Concept

The problem Singleton solves: some resources must be shared, not duplicated. Two database connection objects pointing to the same DB wastes connections and causes bugs. A second `Config` object might have stale values.

The mechanism: control instantiation so `__new__` returns the existing instance if one already exists.

**Three implementation levels:**

**Level 1 — Basic (single-threaded only)**
```python
class DatabaseConnection:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.url = "db://localhost:5432"
        return cls._instance

db1 = DatabaseConnection()
db2 = DatabaseConnection()
print(db1 is db2)  # True — same object
```

**Level 2 — Thread-safe (use this in interviews)**
```python
import threading

class Logger:
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:   # double-check after acquiring lock
                    cls._instance = super().__new__(cls)
        return cls._instance
```
The double-check matters: without it, two threads could both pass the first `if` before either creates the instance.

**Level 3 — Pythonic (decorator)**
```python
def singleton(cls):
    instances = {}
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    return get_instance

@singleton
class Config:
    def __init__(self):
        self.settings = {'debug': True, 'max_connections': 100}
```

---

## When to Use / When NOT to Use

**Use when:** the resource is genuinely shared (DB connection pool, app config loaded at startup, central logger, thread pool).

**Don't use when:** you just want convenience — that's global state in disguise. Every class that touches a Singleton has a hidden dependency on it, making tests brittle (the Singleton's state leaks between test cases).

**Modern alternative:** Dependency Injection. Create one instance and pass it to classes that need it. Same single-instance benefit, no global state, fully testable.

---

## Common Mistakes

**1. Not thread-safe**
The simple `if cls._instance is None: create` check is a race condition. Two threads can both see `None` simultaneously. Always use the lock + double-check pattern for multi-threaded code.

**2. Testing is broken**
State persists across test cases. Fix: add a `reset()` classmethod (`cls._instance = None`) for test teardown only.

**3. Subclassing shares the instance**
```python
class Parent:
    _instance = None  # Child inherits this — Parent() and Child() return same object!
```
Fix: store instances per class: `if cls not in cls._instances:`.

**4. Overusing it**
Stateless helper classes don't need to be Singletons. Use static methods or module-level functions instead.

---

## Interview Q&A (Quick Fire)

**Q: When would you use a Singleton?**
> "For shared resources where multiple instances would cause bugs or waste — database connection pools, configuration loaded once at startup, central loggers. But I'd inject it as a dependency rather than access it globally."

**Q: What are the downsides of Singletons?**
> "Global state and hidden dependencies. Any class that calls `Logger.getInstance()` is secretly coupled to the Logger. It makes tests brittle — state persists between test runs. I prefer dependency injection to get the single-instance benefit without global state."

**Q: How do you make it thread-safe?**
> "Double-checked locking: check if instance is None, acquire a lock, check again, then create. The double-check avoids a race condition where two threads both pass the first check before either creates the instance."

---

## Key Takeaways

- Singleton = one instance, global access — useful for genuinely shared resources
- Thread safety requires the **lock + double-check** pattern
- Singletons are often an **anti-pattern** because they create hidden global state — prefer dependency injection
- Always add a **reset mechanism** if you use Singletons in code that's unit-tested
