# Interfaces in OOP: When & How to Use Them

> **Source:** https://layrs.me/course/lld/01-oop-fundamentals/interfaces
> **Level:** Beginner-Intermediate | **Read:** ~15 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Interface** | A contract — "if you implement me, you MUST have these methods" |
| **Abstract method** | A method declared but not implemented — subclass must fill it in |
| **Polymorphism** | Treat different objects uniformly via a shared interface |
| **Dependency injection** | Pass the interface in, not the concrete class |
| **ISP** | Interface Segregation Principle — keep interfaces small and focused |

> **Key Insight:** Interfaces answer *"what can this do?"* not *"what is this?"*. They decouple the **what** from the **how**, making code flexible, testable, and extensible.

---

## The Analogy — Power Socket

- A power socket (interface) defines exactly what a plug must look like
- Any device (concrete class) that matches the shape works — lamp, phone, TV
- You don't care how the device works internally — only that it fits the socket
- Adding a new device never changes the socket spec

---

## Why This Matters in Interviews

- Every design question becomes cleaner if you **start with an interface**
- Interfaces unlock **dependency injection → testability with mocks**
- Classic interview Q: *"Interface vs Abstract Class"* — know this cold

> **Red flags:** Hard-coding concrete classes in constructors, making one giant interface, not mentioning testability

---

## Core Concept

### Interface vs Abstract Class

| | Interface | Abstract Class |
|---|---|---|
| Methods | All abstract (traditionally) | Mix of abstract + concrete |
| Multiple inheritance | ✅ Implement many | ❌ Inherit from one |
| State (fields) | No instance variables | Can have fields |
| Use case | "Can-do" (Flyable, Serializable) | "Is-a" with shared code |
| Python | `ABC` + `@abstractmethod` | `ABC` with concrete methods |

### Python Interface Pattern

```python
from abc import ABC, abstractmethod

class PaymentProcessor(ABC):
    @abstractmethod
    def process_payment(self, amount: float) -> bool:
        pass

    @abstractmethod
    def refund_payment(self, transaction_id: str) -> bool:
        pass

class CreditCardProcessor(PaymentProcessor):
    def process_payment(self, amount: float) -> bool:
        print(f"Charging ${amount} to credit card")
        return True

    def refund_payment(self, transaction_id: str) -> bool:
        print(f"Refunding {transaction_id}")
        return True

class PayPalProcessor(PaymentProcessor):
    def process_payment(self, amount: float) -> bool:
        print(f"Sending ${amount} via PayPal")
        return True

    def refund_payment(self, transaction_id: str) -> bool:
        return True

# Client depends on the INTERFACE, not the concrete class
def checkout(processor: PaymentProcessor, amount: float):
    if processor.process_payment(amount):
        print("Payment successful!")

checkout(CreditCardProcessor(), 99.99)
checkout(PayPalProcessor(), 149.99)
```

### Dependency Injection + Testability

```python
class OrderService:
    def __init__(self, payment: PaymentProcessor):  # inject interface
        self._payment = payment

    def place_order(self, amount: float):
        return self._payment.process_payment(amount)

# Production
service = OrderService(CreditCardProcessor())

# Test — no real API calls
class MockProcessor(PaymentProcessor):
    def process_payment(self, amount): return True
    def refund_payment(self, txn_id): return True

test_service = OrderService(MockProcessor())
```

### Interface Segregation (ISP)

```python
# BAD — one giant interface
class VehicleOps(ABC):
    @abstractmethod
    def drive(self): pass
    @abstractmethod
    def fly(self): pass   # Cars can't fly!
    @abstractmethod
    def sail(self): pass  # Cars can't sail!

# GOOD — small focused interfaces
class Drivable(ABC):
    @abstractmethod
    def drive(self): pass

class Flyable(ABC):
    @abstractmethod
    def fly(self): pass

class Car(Drivable):
    def drive(self): print("Driving")

class Airplane(Drivable, Flyable):
    def drive(self): print("Taxiing")
    def fly(self): print("Flying")
```

---

## Java Equivalent

```java
interface PaymentProcessor {
    boolean processPayment(double amount);
    boolean refundPayment(String transactionId);
}

class CreditCardProcessor implements PaymentProcessor {
    public boolean processPayment(double amount) {
        System.out.println("Charging $" + amount);
        return true;
    }
    public boolean refundPayment(String transactionId) { return true; }
}
```

---

## Common Mistakes

### 1. Forgetting to implement all abstract methods
```python
class IncompleteProcessor(PaymentProcessor):
    def process_payment(self, amount): return True
    # Missing refund_payment → TypeError on instantiation

# Fix: Implement ALL abstract methods
```

### 2. Logic inside the interface
```python
# WRONG — interface contains implementation
class PaymentProcessor(ABC):
    @abstractmethod
    def process_payment(self, amount):
        if amount < 0: raise ValueError("...")  # Don't do this!

# RIGHT — keep interfaces pure
```

### 3. Making interfaces too large → ISP violation
> Split one `VehicleOperations` into `Drivable`, `Flyable`, `Sailable`

### 4. Hard-coding concrete classes (not using interfaces for DI)
```python
# WRONG
class OrderService:
    def __init__(self):
        self.payment = CreditCardProcessor()  # hard-coded, untestable

# RIGHT
class OrderService:
    def __init__(self, payment: PaymentProcessor):
        self.payment = payment
```

---

## Interview Q&A (Quick Fire)

**Q: Interface vs Abstract Class?**
> "Interface = pure contract, no implementation, supports multiple 'implementation'; Abstract Class = partial implementation, supports 'is-a' with shared code, single inheritance. Use interface for 'can-do', abstract class for 'is-a with shared logic'."

**Q: Why do interfaces improve testability?**
> "They let you inject mock implementations in tests. Without an interface, you need a real database/API. With an interface, you inject a mock that returns fake data — tests are fast, isolated, and don't need infrastructure."

**Q: Design a notification system.**
```python
class NotificationSender(ABC):
    @abstractmethod
    def send(self, recipient: str, message: str) -> bool: pass

class EmailSender(NotificationSender):
    def send(self, recipient, message): print(f"Email → {recipient}"); return True

class SMSSender(NotificationSender):
    def send(self, recipient, message): print(f"SMS → {recipient}"); return True

class NotificationService:
    def __init__(self, senders: list[NotificationSender]):
        self._senders = senders

    def notify(self, recipient, message):
        for s in self._senders:
            s.send(recipient, message)
```

---

## Key Takeaways

- Interfaces define **contracts** (what, not how) — any class implementing them must provide all methods
- They enable **polymorphism**: treat `EmailSender`, `SMSSender`, `PushSender` all as `NotificationSender`
- Keep interfaces **small and focused** (ISP) — many specific > one general
- Use interfaces for **dependency injection** → testability via mocks
- Python uses `ABC` + `@abstractmethod`; Java uses `interface`; Go uses implicit structural typing
