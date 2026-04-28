# Dependency in OOP: Uses-A Relationship Guide

> **Source:** https://layrs.me/course/lld/02-class-relationships/dependency
> **Level:** Beginner-Intermediate | **Read:** ~11 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Dependency** | Class A *uses* class B temporarily — in method params, local vars, return types |
| **No stored reference** | Key distinction: dependency = not saved as instance variable |
| **Method parameter dep.** | `def process(self, cart: ShoppingCart)` |
| **Local variable dep.** | `db = Database()` inside a method |
| **Return type dep.** | Method returns an object of another class |
| **Coupling** | Dependencies = coupling; minimize and depend on abstractions |
| **DIP** | Depend on abstractions, not concrete implementations |

> **Key Insight:** Dependency = the weakest relationship. Class A doesn't store a reference to class B — it just uses B within a method scope. The instant the method returns, the relationship ends. High dependency count = too many responsibilities (SRP violation).

---

## The Analogy — Calculator App

- You open your phone, use the calculator to add numbers, close it.
- Your phone *depended on* the calculator temporarily.
- No permanent reference stored — the relationship ends when you close the app.
- Contrast with association: you keep a contact stored in your phone → lasting relationship.

---

## Why This Matters in Interviews

- "How would you make this class more testable?" → dependency injection
- Connect dependency to DIP (Dependency Inversion Principle)
- Many dependencies (5+) → code smell for SRP violation

> **Red flags:** Circular dependencies (`A uses B, B uses A`), depending on concrete classes instead of abstractions, not using type hints (unclear dependencies)

---

## Core Concept

### Three Ways Dependencies Appear

```python
# 1. METHOD PARAMETER — most common
class EmailService:
    def send_email(self, message: "EmailMessage") -> bool:
        print(f"Sending to {message.to}: {message.subject}")
        return True
    # EmailMessage is used only within this method — dependency

# 2. LOCAL VARIABLE — created inside a method
class UserRepository:
    def __init__(self, conn_string):
        self.conn_string = conn_string

    def get_user(self, user_id: int) -> dict:
        db = DatabaseConnection(self.conn_string)   # local dependency
        result = db.execute(f"SELECT * FROM users WHERE id = {user_id}")
        return result
        # db is gone when method returns

# 3. RETURN TYPE — method produces another class
class ReportGenerator:
    def generate_sales_report(self, data: list) -> "Report":
        total = sum(data)
        return Report("Sales Report", f"Total: ${total}")
    # Report is a dependency via return type
```

### Dependency Injection — Making It Testable

```python
from abc import ABC, abstractmethod

class Logger(ABC):
    @abstractmethod
    def log(self, message): pass

class ConsoleLogger(Logger):
    def log(self, message): print(f"[LOG] {message}")

class MockLogger(Logger):
    def __init__(self): self.messages = []
    def log(self, message): self.messages.append(message)

class PaymentProcessor:
    def process_payment(self, amount: float, logger: Logger) -> bool:
        logger.log(f"Processing ${amount}")
        if amount > 0:
            logger.log("Success")
            return True
        logger.log("Failed: invalid amount")
        return False

# Production
processor = PaymentProcessor()
processor.process_payment(99.99, ConsoleLogger())

# Test — inject mock, no side effects
mock_logger = MockLogger()
result = processor.process_payment(50.00, mock_logger)
assert result is True
assert "Processing $50.0" in mock_logger.messages[0]
```

### Reducing Coupling — Depend on Abstractions

```python
# BAD — depends on concrete MySQLDatabase
class UserRepository:
    def save(self, user, database: "MySQLDatabase"):
        database.insert(user)   # breaks if we switch to Postgres

# GOOD — depends on abstraction
from abc import ABC, abstractmethod

class Database(ABC):
    @abstractmethod
    def insert(self, data): pass

class MySQLDatabase(Database):
    def insert(self, data): print(f"MySQL: INSERT {data}")

class PostgresDatabase(Database):
    def insert(self, data): print(f"Postgres: INSERT {data}")

class UserRepository:
    def save(self, user, database: Database):   # any DB works
        database.insert(user)

repo = UserRepository()
repo.save({"name": "Alice"}, MySQLDatabase())
repo.save({"name": "Bob"}, PostgresDatabase())   # zero code change!
```

---

## Dependency vs Association vs Composition

| | Dependency | Association | Aggregation | Composition |
|---|---|---|---|---|
| **Stored as** | Not stored (method/local) | Instance variable | Collection field | Field (owns) |
| **Duration** | Method scope only | Object lifetime | Object lifetime | Object lifetime |
| **Coupling** | Weakest | Moderate | Moderate | Strongest |
| **Code pattern** | `def f(self, x: B)` | `self.b = b` | `self.items.append(b)` | `self.b = B()` |
| **Example** | `OrderService` uses `Cart` | `Cart` stores `User` | `Library` holds `Books` | `Car` owns `Engine` |

---

## Common Mistakes

### 1. Circular dependencies
```python
# BAD — A uses B, B uses A → fragile coupling
class UserService:
    def get_orders(self, user_id):
        return OrderService().get_by_user(user_id)

class OrderService:
    def get_owner(self, order_id):
        return UserService().get_user(order_id)   # circular!

# RIGHT — introduce a shared data object or mediator
class OrderSummary:
    def __init__(self, user_id, items): ...

# UserService and OrderService both use OrderSummary without knowing each other
```

### 2. Depending on concrete classes (breaks DIP)
```python
# WRONG
class NotificationService:
    def send(self, content, mailer: GmailMailer):  # concrete!
        mailer.send(content)

# RIGHT
class NotificationService:
    def send(self, content, mailer: Mailer):   # abstract
        mailer.send(content)
```

### 3. Too many dependencies → SRP violation
```python
class GodClass:
    def process(self, user, order, payment, logger, email, db, cache, config):
        # 8 dependencies → this class has too many responsibilities!
        pass

# RIGHT — split into smaller, focused classes
class OrderProcessor:
    def process(self, order, payment): ...

class NotificationSender:
    def notify(self, user, email): ...
```

### 4. Missing type hints — obscure dependencies
```python
# BAD — what is 'msg'?
def send(self, msg): msg.deliver()

# GOOD — explicit dependency
def send(self, msg: EmailMessage): msg.deliver()
```

---

## Interview Q&A (Quick Fire)

**Q: What distinguishes dependency from association?**
> "Storage and duration. Dependency uses another class temporarily — in method parameters, local variables, or return types — but never stores a lasting reference. Association stores the reference as an instance variable for the object's lifetime. If you see `self.x = x`, that's association. If you see `def f(self, x)`, that's dependency."

**Q: How do you reduce dependency coupling?**
> "Three ways: (1) depend on abstractions (interfaces/ABCs), not concrete classes; (2) inject dependencies as parameters instead of creating them internally; (3) keep dependencies narrow — don't take a whole object when you only need one field."

**Q: What does a class with 8+ dependencies indicate?**
> "SRP violation — the class is doing too much. Look for cohesive groups of dependencies that belong together and extract them into separate classes with their own responsibilities."

**Q: What's the Dependency Inversion Principle?**
> "DIP: high-level modules shouldn't depend on low-level modules — both should depend on abstractions. `OrderService` shouldn't depend on `MySQLDatabase`; it should depend on `Database` (abstract). This makes `OrderService` reusable with any database implementation."

---

## Key Takeaways

- Dependency = **temporary usage** — method parameter, local variable, or return type; NOT stored as instance variable
- The weakest relationship — but still creates coupling that affects testability and flexibility
- **Inject dependencies** as parameters instead of creating them internally — enables mocking and swapping
- **Depend on abstractions** (ABC/interface), not concrete classes — Dependency Inversion Principle
- Too many dependencies (5+) is a code smell → Single Responsibility Principle violation
