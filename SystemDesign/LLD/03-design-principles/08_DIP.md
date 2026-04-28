# Dependency Inversion Principle (DIP) Explained

> **Source:** https://layrs.me/course/lld/03-design-principles/dependency-inversion
> **Level:** Beginner | **Read:** ~15 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **DIP** | High-level logic depends on abstractions, not concrete implementations |
| **High-level module** | Business logic — defines *what* the system does |
| **Low-level module** | Infrastructure — defines *how* things are done (DB, email, etc.) |
| **Abstraction** | Interface / abstract class that both depend on |
| **DI (Dependency Injection)** | Technique to achieve DIP — pass dependencies in, don't create them |
| **DIP ≠ DI** | DIP is the principle; DI is a pattern that implements it |

> **Key Insight:** DIP **inverts** the traditional flow. Instead of `OrderProcessor` creating `MySQLDatabase`, both depend on `IDatabase`. High-level modules define what they need; low-level modules adapt. This enables swapping implementations and mocking in tests.

---

## The Analogy — USB Interface

- Your laptop doesn't care if it's connecting to a SanDisk or Samsung USB drive
- Both implement the USB standard (abstraction)
- You can plug in any manufacturer's drive without modifying your laptop
- DIP = your business logic is the laptop; the database/email/etc. is the USB drive

---

## Why This Matters in Interviews

- Classic violation: "This `UserService` creates `MySQLUserRepository` directly. What's wrong?"
- Answer: "It violates DIP — high-level depends on a concrete low-level class. I'd extract `IUserRepository`, inject it into UserService, and let MySQL implement it."
- Shows: testability thinking (mock implementations), flexibility for swapping backends

> **Red flags:** `self.db = MySQLDatabase()` inside `__init__`, `import MySQLDatabase` at top of business logic file, no way to test without a real database

---

## Core Concept

### Violation — Tightly Coupled

```python
class MySQLDatabase:
    def save_order(self, order_data):
        print(f"Saving to MySQL: {order_data}")
        return True

class OrderProcessor:
    def __init__(self):
        self.database = MySQLDatabase()   # direct dependency — violates DIP!
    
    def process_order(self, order):
        order_data = {"id": order["id"], "total": order["total"]}
        self.database.save_order(order_data)
        print("Order processed")

# To switch to PostgreSQL → must modify OrderProcessor!
# To unit test → need a real MySQL connection!
```

### Following DIP — Depend on Abstraction

```python
from abc import ABC, abstractmethod

class IDatabase(ABC):                         # abstraction — owned by high-level module
    @abstractmethod
    def save_order(self, order_data): pass

class MySQLDatabase(IDatabase):               # low-level: implements abstraction
    def save_order(self, order_data):
        print(f"Saving to MySQL: {order_data}")
        return True

class PostgreSQLDatabase(IDatabase):          # swap in without touching OrderProcessor
    def save_order(self, order_data):
        print(f"Saving to PostgreSQL: {order_data}")
        return True

class MockDatabase(IDatabase):               # for testing — no real DB needed
    def __init__(self): self.saved = []
    def save_order(self, order_data): self.saved.append(order_data); return True

class OrderProcessor:
    def __init__(self, database: IDatabase):  # receives abstraction
        self.database = database
    
    def process_order(self, order):
        order_data = {"id": order["id"], "total": order["total"]}
        self.database.save_order(order_data)
        print("Order processed")

# Swap implementations at wiring time
mysql_processor = OrderProcessor(MySQLDatabase())
postgres_processor = OrderProcessor(PostgreSQLDatabase())
test_processor = OrderProcessor(MockDatabase())
```

### Multiple Dependencies — Both Abstracted

```python
class IDatabase(ABC):
    @abstractmethod
    def save_order(self, order_data): pass

class INotificationService(ABC):
    @abstractmethod
    def send_notification(self, message): pass

class MySQLDatabase(IDatabase):
    def save_order(self, order_data): print(f"MySQL: Saved order {order_data['id']}")

class EmailService(INotificationService):
    def send_notification(self, message): print(f"Email sent: {message}")

class SMSService(INotificationService):
    def send_notification(self, message): print(f"SMS sent: {message}")

class OrderProcessor:
    def __init__(self, database: IDatabase, notifier: INotificationService):
        self.database = database
        self.notifier = notifier
    
    def process_order(self, order):
        order_data = {"id": order["id"], "total": order["total"]}
        if self.database.save_order(order_data):
            self.notifier.send_notification(f"Order {order['id']} confirmed")

# Mix and match independently
OrderProcessor(MySQLDatabase(), EmailService())
OrderProcessor(MySQLDatabase(), SMSService())
```

### Module-Level DIP (Where Interfaces Live)

```python
# domain/interfaces.py  ← abstractions in high-level domain
class IDatabase(ABC): ...

# infrastructure/mysql.py  ← low-level implements
from domain.interfaces import IDatabase
class MySQLDatabase(IDatabase): ...

# domain/order_processor.py  ← high-level imports from domain only
from domain.interfaces import IDatabase
class OrderProcessor:
    def __init__(self, db: IDatabase): ...
# OrderProcessor never imports from infrastructure/ — DIP preserved!
```

---

## Common Mistakes

### 1. Abstraction that mirrors one concrete implementation

```python
class IMySQLDatabase(ABC):           # BAD: named after implementation
    @abstractmethod
    def execute_mysql_query(self, sql): pass   # MySQL-specific!

# Can't add PostgreSQL without changing the interface
# FIX: design from what the high-level module NEEDS
class IDatabase(ABC):
    @abstractmethod
    def save_order(self, order_data): pass   # business operation, not DB detail
```

### 2. Creating dependencies inside the class (not injecting)

```python
class OrderProcessor:
    def __init__(self, db_type: str):
        if db_type == "mysql":
            self.db = MySQLDatabase()        # VIOLATION — still knows concrete classes!
        else:
            self.db = PostgreSQLDatabase()

# FIX: inject from outside
class OrderProcessor:
    def __init__(self, db: IDatabase):       # receives the abstraction
        self.db = db
```

### 3. Abstraction in the low-level module

```python
# WRONG: interface defined alongside implementation
# database_implementations.py
class IDatabase(ABC): pass
class MySQLDatabase(IDatabase): pass
# High-level must import from low-level file — defeats DIP!

# RIGHT: interface in the domain / high-level module
# domain/interfaces.py → class IDatabase(ABC)
# infrastructure/mysql.py → from domain.interfaces import IDatabase
```

### 4. Over-abstracting stable code (YAGNI)

```python
class ILogger(ABC):            # UNNECESSARY if you'll only ever log to console
    @abstractmethod
    def log(self, message): pass

# Skip the interface if you have one implementation and no testing need for it
def log(message): print(message)   # simple and sufficient
```

---

## DIP vs Dependency Injection

| | DIP | Dependency Injection |
|---|---|---|
| **What it is** | Design principle | Implementation pattern |
| **Says** | Depend on abstractions | Pass dependencies from outside |
| **Scope** | Direction of dependencies | Technique for creating objects |
| **Note** | You can do DI without DIP (inject concrete classes) | DIP usually requires DI |

---

## Interview Q&A (Quick Fire)

**Q: How does DIP enable testability?**
> "Without DIP, testing `OrderProcessor` needs a real MySQL connection. With DIP, I inject `MockDatabase` — stores data in a list, no real DB. Tests run in milliseconds and are isolated."

**Q: What's the difference between DIP and Dependency Injection?**
> "DIP is the principle: high-level modules depend on abstractions. Dependency Injection is the technique that achieves it — passing dependencies through constructors rather than creating them inside. You can have DI without DIP (injecting concrete classes), but DIP usually requires DI to work properly."

**Q: Design a notification system applying DIP.**
> "I'd define `INotificationChannel` with `send(message)`. High-level `NotificationManager` accepts a list of channels. Low-level `EmailChannel`, `SMSChannel`, `PushChannel` implement the interface. Adding Slack: create `SlackChannel` — zero changes to `NotificationManager`."

**Q: When would you skip DIP?**
> "For simple, stable utilities — like a console logger that will never change. DIP adds abstraction layers. I apply it when: (1) multiple implementations exist or are expected, (2) testability requires mocking, (3) the implementation might change. Not for every function."

---

## Key Takeaways

- DIP = **both high-level and low-level depend on an abstraction** — neither depends on the other directly
- **Abstractions belong to the high-level module** — define what you need; let low-level implement it
- **Constructor injection** is the primary DI technique for achieving DIP
- DIP enables: swapping implementations, mocking in tests, parallel development
- Balance: don't abstract everything — apply DIP where multiple implementations or testability needs exist
