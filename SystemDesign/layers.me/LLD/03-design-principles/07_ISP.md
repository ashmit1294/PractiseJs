# Interface Segregation Principle (ISP) Explained

> **Source:** https://layrs.me/course/lld/03-design-principles/interface-segregation
> **Level:** Beginner | **Read:** ~14 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **ISP** | Clients should only depend on methods they actually use |
| **Fat interface** | Too many methods in one interface — forces irrelevant implementations |
| **Role interface** | Small, focused interface representing one capability |
| **ISP red flag** | `NotImplementedError`, empty method bodies in a subclass |
| **ISP vs SRP** | SRP = class has one reason to change; ISP = clients don't depend on unused methods |

> **Key Insight:** ISP is about **interface design from the client's perspective**. If `Robot` implements `Worker` but has no reason to implement `eat()` and `sleep()`, the interface is too fat. Split it so each client sees only what it uses.

---

## The Analogy — TV Remote

- Old universal remote has 80 buttons — you use 5
- Smart TV app remote shows only what you need: play, pause, volume, channels
- ISP = give each client only the controls they need — not a universal panel

---

## Why This Matters in Interviews

- Common test: show a class with `raise NotImplementedError` implementations → ask what's wrong
- Signal: "The interface is too broad — `Robot` shouldn't implement `eat()` and `sleep()`. I'd segregate into `Workable`, `Eatable`, `Sleepable`"
- Shows: you design interfaces from the client's point of view, not the implementation's

> **Red flags:** `raise NotImplementedError` in subclass methods, empty `pass` implementations, comments like "this class doesn't need this but…"

---

## Core Concept

### Violation — Fat Interface

```python
from abc import ABC, abstractmethod

# BAD: Fat interface forces all implementers to support all operations
class Document(ABC):
    @abstractmethod
    def open(self): pass
    
    @abstractmethod
    def save(self): pass
    
    @abstractmethod
    def print(self): pass
    
    @abstractmethod
    def fax(self): pass

class ReadOnlyDocument(Document):
    def open(self): print("Opening read-only document")
    def save(self): raise NotImplementedError("Cannot save read-only document")  # forced!
    def print(self): print("Printing document")
    def fax(self): raise NotImplementedError("Faxing not supported")              # forced!

# Client calling .save() on ReadOnlyDocument gets a runtime surprise!
```

### Following ISP — Segregated Interfaces

```python
class Openable(ABC):
    @abstractmethod
    def open(self): pass

class Saveable(ABC):
    @abstractmethod
    def save(self): pass

class Printable(ABC):
    @abstractmethod
    def print(self): pass

class Faxable(ABC):
    @abstractmethod
    def fax(self): pass

class ModernDocument(Openable, Saveable, Printable):     # implements what it needs
    def open(self): print("Opening document")
    def save(self): print("Saving document")
    def print(self): print("Printing document")

class ReadOnlyDocument(Openable, Printable):             # only relevant capabilities
    def open(self): print("Opening read-only document")
    def print(self): print("Printing document")

class LegacyDocument(Openable, Saveable, Printable, Faxable):  # full feature set
    def open(self): print("Opening legacy document")
    def save(self): print("Saving legacy document")
    def print(self): print("Printing document")
    def fax(self): print("Faxing document")

# Type-safe client functions
def process_saveable(doc: Saveable): doc.save()
def process_printable(doc: Printable): doc.print()

process_printable(ReadOnlyDocument())   # Works
process_saveable(ModernDocument())      # Works
# process_saveable(ReadOnlyDocument()) # Type checker catches this at compile time!
```

### Payment System — Real ISP Example

```python
class PaymentProcessor(ABC):
    @abstractmethod
    def process_payment(self, amount: float) -> bool: pass

class RefundablePayment(ABC):
    @abstractmethod
    def refund(self, transaction_id: str, amount: float) -> bool: pass

class RecurringPayment(ABC):
    @abstractmethod
    def setup_subscription(self, amount: float, interval: str) -> str: pass
    
    @abstractmethod
    def cancel_subscription(self, subscription_id: str) -> bool: pass

# Credit card supports all capabilities
class CreditCardProcessor(PaymentProcessor, RefundablePayment, RecurringPayment):
    def process_payment(self, amount): print(f"Processing ${amount} via CC"); return True
    def refund(self, txn_id, amount): print(f"Refunding ${amount}"); return True
    def setup_subscription(self, amount, interval): return f"SUB-{amount}-{interval}"
    def cancel_subscription(self, sub_id): return True

# Cash: only basic payment — no refunds, no subscriptions
class CashProcessor(PaymentProcessor):
    def process_payment(self, amount): print(f"Accepting ${amount} cash"); return True

# Gift card: payment + refunds, no subscriptions
class GiftCardProcessor(PaymentProcessor, RefundablePayment):
    def process_payment(self, amount): print(f"Processing ${amount} via gift card"); return True
    def refund(self, txn_id, amount): print(f"Refunding ${amount} to gift card"); return True

# Client functions declare exactly what they need
def process_order(p: PaymentProcessor, amount): return p.process_payment(amount)
def handle_return(p: RefundablePayment, txn_id, amount): return p.refund(txn_id, amount)
def setup_billing(p: RecurringPayment, amount): return p.setup_subscription(amount, "monthly")
# handle_return(CashProcessor(), "TXN-1", 50) → Type error caught at compile time!
```

### Python Protocol (Structural Subtyping)

```python
from typing import Protocol

# No inheritance needed — structural compatibility
class Drawable(Protocol):
    def draw(self) -> None: ...

def render(obj: Drawable):
    obj.draw()

class Circle:
    def draw(self): print("Drawing circle")

render(Circle())   # Works — no ABC inheritance required
```

---

## Common Mistakes

### 1. Using NotImplementedError instead of segregating

```python
class Bird(ABC):
    @abstractmethod
    def fly(self): pass
    @abstractmethod
    def swim(self): pass

class Penguin(Bird):
    def fly(self): raise NotImplementedError("Penguins can't fly")  # VIOLATION
    def swim(self): print("Swimming")

# FIX: segregate
class Flyable(ABC):
    @abstractmethod
    def fly(self): pass

class Swimmable(ABC):
    @abstractmethod
    def swim(self): pass

class Penguin(Swimmable):   # only implements what makes sense
    def swim(self): print("Swimming")
```

### 2. Over-segregating (one method per interface)

```python
# TOO GRANULAR — interface explosion
class Openable(ABC): ...
class Closeable(ABC): ...
class Readable(ABC): ...
class Writable(ABC): ...
# File now implements 4 tiny interfaces unnecessarily

# BETTER — group cohesive operations
class FileOperations(ABC):
    @abstractmethod
    def open(self): pass
    @abstractmethod
    def close(self): pass
```

### 3. ISP ≠ one interface per class

```python
# WRONG THINKING
class Document(Openable):   # one interface = ISP compliance? No!
    def open(self): pass
    # But where's save and print?

# RIGHT: A class can implement multiple focused interfaces
class ModernDocument(Openable, Saveable, Printable): ...
```

---

## Interview Q&A (Quick Fire)

**Q: How do you identify an ISP violation?**
> "Three signals: (1) `NotImplementedError` in a method the class logically can't do, (2) empty `pass` implementations just to satisfy an interface, (3) client code that type-checks before calling methods. These all mean the interface is too broad."

**Q: How does ISP relate to LSP?**
> "ISP violations often cause LSP violations. If an interface has methods a subclass can't implement, the subclass throws `NotImplementedError` — that breaks LSP (surprising behavior). Split the interface and LSP compliance follows."

**Q: When should you NOT split an interface?**
> "When all implementers genuinely need all methods, and splitting would create artificial fragmentation. ISP is about what clients need, not about making interfaces as small as possible. Two related methods — `open()` and `close()` — can share an interface because they're naturally coupled."

**Q: ISP and dependency injection?**
> "Focused interfaces are easier to mock in tests. A `process_order()` function that only needs `PaymentProcessor` can be tested with a simple mock that implements one method — no need to stub refunds and subscriptions."

---

## Key Takeaways

- ISP = clients depend **only on methods they use** — no forced irrelevant implementations
- **Red flags**: `NotImplementedError`, empty `pass`, comments saying "this class doesn't need this"
- Design from the **client's perspective**: ask "what does this client actually need?" not "what can this class do?"
- **Don't over-segregate**: group cohesive operations together; one method per interface is too granular
- **Python bonus**: use `Protocol` for structural subtyping — no forced ABC inheritance when duck typing is cleaner
