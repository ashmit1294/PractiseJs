# Cohesion and Coupling in Software Design

> **Source:** https://layrs.me/course/lld/03-design-principles/cohesion-and-coupling
> **Level:** Beginner | **Read:** ~14 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Cohesion** | How focused a class is — do all its parts serve the same purpose? |
| **High cohesion** | Every method/attribute works toward one clear goal |
| **Coupling** | How dependent classes are on each other |
| **Tight coupling** | Class A knows B's internals — changes to B break A |
| **Loose coupling** | Class A knows only B's interface — changes to B's internals don't break A |
| **Goal** | High cohesion within classes, low coupling between classes |

> **Key Insight:** These two forces work together. High cohesion naturally reduces coupling — when each class has a focused responsibility, it doesn't need to reach into other classes' internals. The **Information Expert** principle: put methods where the data lives.

---

## The Analogy — Specialists vs. Generalists

- **Low cohesion** = one person does accounting, HR, legal, and marketing — too many hats, mediocre at each
- **High cohesion** = specialists (accountant, lawyer, marketer) — each excellent at one thing
- **Tight coupling** = the accountant can't do anything without calling the lawyer's personal cell
- **Loose coupling** = they communicate through formal contracts (interfaces) — swap the lawyer without telling the accountant

---

## Why This Matters in Interviews

- "What would you improve about this `UserManager` that does auth + email + DB + reports?"
- Answer: low cohesion, high coupling → split by responsibility, inject dependencies via interfaces
- Shows: you think about long-term maintainability and testability, not just making it work

> **Red flags:** God classes with 10+ unrelated methods, mixing infrastructure with business logic, multiple `import` chains in one class, changing one feature breaks unrelated features

---

## Core Concept

### Low Cohesion — God Object

```python
class UserManager:
    """Does everything — low cohesion"""
    
    def add_user(self, user): self.users.append(user)       # user storage
    
    def send_welcome_email(self, user):                      # email logic
        print(f"Sending email to {user['email']}")
    
    def calculate_user_discount(self, user):                # business logic
        return 0.15 if user['orders'] > 10 else 0.05
    
    def generate_pdf_report(self, user):                    # PDF generation
        print(f"Generating PDF for {user['name']}")
    
    def log_to_database(self, message):                     # logging
        print(f"LOG: {message}")

# 5 different reasons to change — every stakeholder touches this class
```

### High Cohesion — Focused Classes

```python
class UserRepository:
    """Only user data storage — changes when storage mechanism changes"""
    def __init__(self): self.users = []
    def add(self, user): self.users.append(user)
    def find_by_email(self, email):
        return next((u for u in self.users if u['email'] == email), None)

class EmailService:
    """Only email operations — changes when email provider/templates change"""
    def send_welcome_email(self, user): print(f"Sending email to {user['email']}")
    def send_notification(self, user, message): print(f"Notifying {user['email']}: {message}")

class DiscountCalculator:
    """Only discount logic — changes when discount policy changes"""
    def calculate_for_user(self, user):
        if user['orders'] > 10: return 0.15
        elif user['orders'] > 5: return 0.10
        return 0.05
```

### Tight Coupling — Concrete Dependencies

```python
class OrderProcessor:
    def __init__(self):
        self.db = MySQLDatabase()    # tight coupling — hard-wires to MySQL
    
    def process_order(self, order):
        total = sum(item['price'] for item in order['items'])
        self.db.connect()
        self.db.execute_query(f"INSERT INTO orders VALUES ({order['id']}, {total})")
        self.db.close()

# Problems:
# • Can't switch to PostgreSQL without changing OrderProcessor
# • Can't test without a real MySQL connection
# • OrderProcessor knows MySQL-specific operations (connect, close, execute_query)
```

### Loose Coupling — Depend on Abstraction

```python
from abc import ABC, abstractmethod

class Database(ABC):
    @abstractmethod
    def save_order(self, order_id, total): pass

class MySQLDatabase(Database):
    def save_order(self, order_id, total):
        print(f"MySQL: Saving order {order_id} with total {total}")

class PostgreSQLDatabase(Database):
    def save_order(self, order_id, total):
        print(f"PostgreSQL: Saving order {order_id} with total {total}")

class MockDatabase(Database):
    def __init__(self): self.saved_orders = []
    def save_order(self, order_id, total):
        self.saved_orders.append({'id': order_id, 'total': total})

class OrderProcessor:
    """Loosely coupled — knows only the interface, not the implementation"""
    def __init__(self, database: Database):
        self.db = database   # depends on abstraction, not concrete class
    
    def process_order(self, order):
        total = sum(item['price'] for item in order['items'])
        self.db.save_order(order['id'], total)

# Swap freely:
OrderProcessor(MySQLDatabase())
OrderProcessor(PostgreSQLDatabase())
OrderProcessor(MockDatabase())   # fast, isolated unit tests
```

---

## The Information Expert Principle (GRASP)

```python
# WRONG — OrderCalculator needs Order's internals
class OrderCalculator:
    def calculate_total(self, order):
        return sum(item.price for item in order.items)  # reaches into Order

# RIGHT — put method where the data lives
class Order:
    def __init__(self, items): self.items = items
    
    def calculate_total(self):    # Order has the data → Order calculates
        return sum(item.price for item in self.items)

# Benefits: fewer parameters, less coupling, better encapsulation
```

---

## Common Mistakes

### 1. Cohesion ≠ "small classes"

```python
# OVER-SPLIT — related validations unnecessarily separated
class EmailValidator: ...
class PasswordValidator: ...
class AgeValidator: ...

# BETTER — all user validation belongs together (still high cohesion)
class UserValidator:
    def validate_email(self, email): return '@' in email
    def validate_password(self, password): return len(password) >= 8
    def validate_age(self, age): return age >= 18
```

### 2. Shared mutable state = hidden coupling

```python
user_cache = {}   # global state

class UserService:
    def add_user(self, user): user_cache[user['id']] = user

class ReportGenerator:
    def generate(self):
        for user in user_cache.values():   # hidden coupling via shared state!
            print(user['name'])
# Fix: pass data explicitly or inject UserRepository
```

### 3. Interface alone doesn't guarantee loose coupling

```python
class PaymentProcessor(ABC):
    @abstractmethod
    def process(self, amount) -> dict: pass

class OrderService:
    def place_order(self, amount, processor: PaymentProcessor):
        result = processor.process(amount)
        if result['status'] == 'success':          # STILL coupled!
            print(f"TXN: {result['transaction_id']}")
# Depends on specific dict structure — change return format → breaks OrderService
# Fix: define return contract in the interface
```

---

## Cohesion and Coupling at Scale

| Code Level | High Cohesion | Loose Coupling |
|---|---|---|
| **Classes** | Single Responsibility | Dependency Inversion (interfaces) |
| **Modules** | Package by feature | Narrow public APIs |
| **Microservices** | One business capability | REST/gRPC, event-driven |

In system design interviews: "High cohesion → microservices with focused responsibilities. Low coupling → services communicate through well-defined APIs and can be deployed independently."

---

## Interview Q&A (Quick Fire)

**Q: Identify the problem: `UserManager` handles auth, email, and database.**
> "Low cohesion — it has three reasons to change: auth policy updates, email template changes, database schema changes. I'd extract `AuthenticationService`, `EmailService`, and `UserRepository`. Each has high cohesion, and changes to email don't risk breaking authentication."

**Q: When is tight coupling acceptable?**
> "When two classes are always used together and unlikely to change independently — like `TreeNode` and `Tree`. Localized, one-directional coupling within a module is fine. The goal is preventing coupling from spreading across module boundaries."

**Q: How does loose coupling improve testability?**
> "With loose coupling via interfaces, I inject a `MockDatabase` for tests. No real database connection needed. Tests run in milliseconds, failures point to exact business logic. Without it, every test needs infrastructure setup."

---

## Key Takeaways

- **High cohesion** = all methods serve one purpose → easier to understand, test, maintain
- **Low coupling** = depend on interfaces, not implementations → easy to swap, extend, test
- Use **dependency injection** to achieve loose coupling — pass dependencies in, don't create them inside
- **Information Expert (GRASP)**: put the method where the data lives → naturally improves cohesion and coupling
- Balance: some coupling is necessary — reduce it between modules/subsystems; accept it within closely related classes
