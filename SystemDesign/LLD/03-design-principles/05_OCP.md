# Open-Closed Principle (OCP): Extend, Don't Modify

> **Source:** https://layrs.me/course/lld/03-design-principles/open-closed
> **Level:** Beginner | **Read:** ~15 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **OCP** | Add new features via new code, not by editing old tested code |
| **Open for extension** | New behavior can be added (new subclasses / implementations) |
| **Closed for modification** | Existing working code is not changed for new features |
| **Variation point** | Where requirements are likely to change — abstract these |
| **Type-checking smell** | `isinstance()` chains → likely OCP violation |

> **Key Insight:** When you modify existing code to add features, you risk breaking tested functionality and introducing bugs. OCP says: design so new features are **new code**, not edits to old code.

---

## The Analogy — Power Outlet

- A power outlet is **closed for modification** — you don't rewire your house for each new device
- It's **open for extension** — any device following the standard interface (plug) can use it
- New devices extend capability without touching the outlet

---

## Why This Matters in Interviews

- Interviewers look for `if-elif` chains based on type → OCP violation
- Signal: "I'd refactor this using polymorphism / Strategy pattern so new types require zero changes to existing code"
- Shows extensibility thinking for systems that need to grow

> **Red flags:** Growing if-elif chains, `isinstance()` type checks to dispatch behavior, modifying the same class repeatedly for new features

---

## Core Concept

### Violation — If-Elif for Each New Type

```python
class AreaCalculator:
    def calculate_area(self, shapes):
        total_area = 0
        for shape in shapes:
            if shape['type'] == 'circle':
                total_area += 3.14 * shape['radius'] ** 2
            elif shape['type'] == 'rectangle':
                total_area += shape['width'] * shape['height']
            # Adding triangle? Must modify this method — risk of breaking circle/rect!
            elif shape['type'] == 'triangle':
                total_area += 0.5 * shape['base'] * shape['height']
        return total_area
```

### Following OCP — Extend via New Classes

```python
from abc import ABC, abstractmethod
import math

class Shape(ABC):
    @abstractmethod
    def area(self): pass

class Circle(Shape):
    def __init__(self, radius): self.radius = radius
    def area(self): return math.pi * self.radius ** 2

class Rectangle(Shape):
    def __init__(self, width, height): self.width = width; self.height = height
    def area(self): return self.width * self.height

class Triangle(Shape):          # NEW: zero changes to AreaCalculator!
    def __init__(self, base, height): self.base = base; self.height = height
    def area(self): return 0.5 * self.base * self.height

class AreaCalculator:           # CLOSED for modification
    def calculate_area(self, shapes):
        return sum(shape.area() for shape in shapes)

# Output: 108.54 (78.54 + 24 + 6)
calc = AreaCalculator()
print(f"{calc.calculate_area([Circle(5), Rectangle(4,6), Triangle(4,3)]):.2f}")
```

### Payment Processing — Real OCP Example

```python
# BEFORE — violates OCP
class PaymentProcessor:
    def process_payment(self, amount, payment_type, details):
        if payment_type == 'credit_card':
            print(f"Processing ${amount} via Credit Card: {details['card_number']}")
        elif payment_type == 'paypal':
            print(f"Processing ${amount} via PayPal: {details['email']}")
        # Adding crypto → must modify this class!
        elif payment_type == 'crypto':
            print(f"Processing ${amount} via Crypto: {details['wallet']}")

# AFTER — follows OCP
class PaymentMethod(ABC):
    @abstractmethod
    def process(self, amount): pass

class CreditCardPayment(PaymentMethod):
    def __init__(self, card_number): self.card_number = card_number
    def process(self, amount): print(f"Processing ${amount} via Credit Card: {self.card_number}")

class PayPalPayment(PaymentMethod):
    def __init__(self, email): self.email = email
    def process(self, amount): print(f"Processing ${amount} via PayPal: {self.email}")

class CryptoPayment(PaymentMethod):   # NEW — zero changes to PaymentProcessor!
    def __init__(self, wallet): self.wallet = wallet
    def process(self, amount): print(f"Processing ${amount} via Crypto: {self.wallet}")

class PaymentProcessor:               # CLOSED — never changes for new payment types
    def process_payment(self, amount, payment_method: PaymentMethod):
        return payment_method.process(amount)
```

---

## When NOT to Apply OCP

```python
# Stable, single-purpose function — no abstraction needed
def format_date(date):
    return date.strftime('%Y-%m-%d')   # Unlikely to vary → YAGNI

# One formatter is enough → don't build AbstractDateFormatter hierarchy
```

The Rule of Three: wait until you have 3+ similar variations before abstracting. Two might be coincidence.

---

## Common Mistakes

### 1. Mistaking OCP for "never change code"

> OCP targets new **feature additions** handled by new code. Bug fixes, refactors, and performance tuning are legitimate modifications. The principle prevents modification for *predictable variation*.

### 2. Adding abstract methods to base class = modification

```python
class Shape(ABC):
    @abstractmethod
    def area(self): pass
    
    @abstractmethod
    def perimeter(self): pass   # Adding this forces ALL existing shapes to change!
    # VIOLATES OCP — if only some shapes need it, use a separate interface
```

### 3. Type checking in disguise

```python
# WRONG — isinstance chain = hidden OCP violation
class NotificationSender:
    def send(self, notification):
        if isinstance(notification, EmailNotification): ...
        elif isinstance(notification, SMSNotification): ...

# RIGHT — polymorphism
class Notification(ABC):
    @abstractmethod
    def send(self): pass
```

---

## Interview Q&A (Quick Fire)

**Q: What's the OCP smell to look for in code reviews?**
> "If-elif chains or isinstance checks on object type. Each new type requires modifying the dispatcher. I'd refactor to polymorphism — each type knows how to handle itself."

**Q: How does OCP relate to other SOLID principles?**
> "OCP needs LSP — subclasses must be safe substitutes, otherwise extension isn't safe. It needs DIP — depending on abstractions enables extension without modifying. ISP prevents fat interfaces that force modifications when you add one method."

**Q: When would you NOT apply OCP?**
> "When the cost of abstraction exceeds the benefit. A date formatter that's stable and used once doesn't need an extensible hierarchy. I apply OCP to parts with high change frequency — payment types, notification channels, report formats. I use the Rule of Three: abstract after the third variation."

**Q: Design a notification system applying OCP.**
> "I'd define `INotificationChannel` with a `send(message)` method. Each channel — email, SMS, push — implements it. The `NotificationService` depends on the interface. Adding Slack requires a new `SlackChannel` class — zero changes to `NotificationService`."

---

## Key Takeaways

- OCP = **new features → new code**, not edited old code
- Mechanism: abstract **variation points** with interfaces/ABCs; extend via subclasses
- **Type-checking (`isinstance`) = OCP red flag** — use polymorphism instead
- Balance: apply OCP where change is expected; don't over-abstract stable code (YAGNI)
- Rule of Three: two similar implementations might be coincidence; three → abstract
