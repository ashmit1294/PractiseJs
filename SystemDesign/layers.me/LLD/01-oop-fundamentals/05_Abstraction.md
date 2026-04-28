# Abstraction in OOP: Concepts & Interview Guide

> **Source:** https://layrs.me/course/lld/01-oop-fundamentals/abstraction
> **Level:** Beginner-Intermediate | **Read:** ~14 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Abstraction** | Show only what's needed — hide the complexity underneath |
| **Data abstraction** | Hide HOW data is stored |
| **Process abstraction** | Hide HOW operations are performed |
| **Leaky abstraction** | Implementation details bleed through the interface |
| **Over-abstraction** | Abstracting before you understand the domain |

> **Key Insight:** Abstraction ≠ encapsulation. **Encapsulation hides data**. **Abstraction hides complexity**. You drive a car (abstraction) — you don't need to know how the fuel injection works. Encapsulation is the *mechanism* to achieve abstraction.

---

## The Analogy — Car Dashboard

- **Interface (what you see):** steering wheel, pedals, buttons
- **Hidden complexity:** engine timing, fuel mix, transmission, emissions
- You call `accelerate()` — the car handles 100 internal steps
- Changing the engine doesn't change how you drive → abstraction held

---

## Why This Matters in Interviews

- Every system design starts with identifying abstractions
- LLD interviews: start with an **abstract interface**, then discuss concrete impls
- Senior-level signal: knowing **when NOT to abstract** (YAGNI principle)

> **Red flags:** Abstracting too early (before seeing 2+ impls), leaky abstractions (API exposes DB details), confusing abstraction with encapsulation

---

## Core Concept

### Two Levels of Abstraction

| Type | Example |
|---|---|
| **Data abstraction** | `BankAccount.deposit()` — you don't know if balance is in RAM, DB, or file |
| **Process abstraction** | `PaymentProcessor.process()` — hides encryption, API calls, retries |

### Abstraction vs Encapsulation

| | Abstraction | Encapsulation |
|---|---|---|
| Focus | What to **expose** | How to **hide** |
| Goal | Simplify the interface | Protect data integrity |
| Mechanism | ABC / interfaces | Private fields / access modifiers |
| Question | "What does it do?" | "Who can touch the data?" |

### Classic Pattern

```python
from abc import ABC, abstractmethod

# Abstract interface — defines WHAT, not HOW
class EmailService(ABC):
    @abstractmethod
    def send_email(self, to: str, subject: str, body: str) -> bool:
        pass

# Concrete — hides all complex details
class GmailService(EmailService):
    def __init__(self, api_key: str):
        self._api_key = api_key   # hidden

    def send_email(self, to, subject, body) -> bool:
        self._connect()           # hidden
        self._authenticate()      # hidden
        self._transmit(to, subject, body)  # hidden
        return True

    def _connect(self): pass
    def _authenticate(self): pass
    def _transmit(self, *args): pass

class SendGridService(EmailService):
    def send_email(self, to, subject, body) -> bool:
        # completely different implementation, same interface
        return self._call_sendgrid_api(to, subject, body)

    def _call_sendgrid_api(self, *args): return True

# User code — simple, doesn't know or care about impl
def notify_user(service: EmailService, user_email: str):
    service.send_email(user_email, "Welcome!", "Thanks for joining.")

notify_user(GmailService("key123"), "alice@example.com")
notify_user(SendGridService(), "bob@example.com")
```

### Levels of Abstraction (layered cake)

```
User Code
    ↓  (uses simple interface)
Abstract Layer (EmailService, PaymentProcessor)
    ↓  (implemented by)
Concrete Layer (GmailService, StripeProcessor)
    ↓  (hides)
Implementation Details (API calls, retries, encryption, connection pools)
```

---

## When to Abstract vs When Not To

| Abstract | Don't Abstract Yet |
|---|---|
| 2+ similar implementations exist | Only one implementation, no plans to change |
| Complex internals to hide | Simple, transparent operation |
| Want testability (mock injection) | Small script / one-off use |
| Multiple team members using it | You don't understand the domain yet |

---

## Common Mistakes

### 1. Over-abstraction (abstracting too early)
```python
# BAD — what does "process" even mean? Too vague.
class DataProcessor(ABC):
    @abstractmethod
    def process(self, data: Any) -> Any: pass

# Better — start concrete, abstract when you see 2+ patterns
class CSVProcessor:
    def parse_csv(self, data: str) -> list: ...

class JSONProcessor:
    def parse_json(self, data: str) -> list: ...

# NOW abstract when pattern is clear:
class DataParser(ABC):
    @abstractmethod
    def parse(self, data: str) -> list: pass
```

### 2. Leaky abstraction (impl details bleed through)
```python
# BAD — user must know Postgres SQL syntax
class Database(ABC):
    @abstractmethod
    def execute(self, query: str) -> list: pass

# Usage leaks impl detail:
db.execute("SELECT * FROM users WHERE id = $1")  # Postgres-specific!

# GOOD — domain-level abstraction
class Database(ABC):
    @abstractmethod
    def find_user(self, user_id: int) -> dict: pass   # No SQL exposed
```

### 3. Confusing abstraction with encapsulation
```python
# This is only encapsulation (private balance)
class BankAccount:
    def __init__(self): self._balance = 0
    def get_balance(self): return self._balance

# This is encapsulation + abstraction (hides complexity too)
class BankAccount:
    def deposit(self, amount):
        self._validate(amount)       # hidden complexity
        self._update_balance(amount) # hidden complexity
        self._log_transaction(amount)# hidden complexity
```

---

## Interview Q&A (Quick Fire)

**Q: What's the difference between abstraction and encapsulation?**
> "Encapsulation hides **data** using private access control. Abstraction hides **complexity** by exposing a simplified interface. A `BankAccount` uses encapsulation to make `_balance` private, and abstraction to expose `deposit()`/`withdraw()` that hide validation, logging, and transaction logic."

**Q: How does abstraction improve testability?**
> "By depending on abstract interfaces, you can inject mock implementations in tests. Instead of hitting a real database or email API, you inject `MockDatabase()` or `MockEmailService()` — tests run fast and don't need infrastructure."

**Q: Which design patterns leverage abstraction?**
> "Strategy (swap algorithms), Factory (hide creation), Template Method (abstract steps), Adapter (abstract different APIs), Observer (abstract event handling)."

**Q: Design a notification system (abstraction-first approach).**
```python
class NotificationSender(ABC):
    @abstractmethod
    def send(self, recipient: str, message: str) -> bool: pass

class EmailSender(NotificationSender): ...
class SMSSender(NotificationSender): ...
class PushSender(NotificationSender): ...

# Adding SlackSender never touches existing code — Open/Closed ✅
```

---

## Key Takeaways

- Abstraction = expose **what**, hide **how** — simplify the interface, not just the data
- Abstraction ≠ encapsulation: encapsulation is the **mechanism**, abstraction is the **goal**
- Abstract when you have **2+ impls** or need **testability** — avoid premature abstraction
- Good abstractions are **stable** — don't leak implementation details
- Start interviews with abstractions: define the interface first, then discuss concrete classes
