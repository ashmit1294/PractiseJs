# Adapter Pattern

> **Source:** https://layrs.me/course/lld/04-design-patterns/adapter
> **Level:** Beginner | **Read:** ~10 min | **Category:** Structural

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Adapter** | A wrapper that makes an incompatible interface work where a different interface is expected |
| **Target** | The interface your client code expects |
| **Adaptee** | The existing class with the "wrong" interface (often can't be changed) |
| **Object Adapter** | Adapter wraps the adaptee via composition — preferred |
| **Class Adapter** | Adapter inherits from both target and adaptee — requires multiple inheritance |

---

## The Analogy

A power adapter: your US laptop charger has a type-A plug, the European wall socket expects a type-C plug. The adapter doesn't change your charger or the wall — it translates one to the other. You plug in, it works.

---

## Why This Matters in Interviews

- "Integrate three payment gateways (Stripe/PayPal/Square) into one checkout flow" → Adapter
- "Wrap a legacy component to work with your new interface without modifying it" → Adapter
- Signal: "I can't change the third-party library, so I'd write an adapter that implements my `PaymentProcessor` interface and delegates to the library's specific API"
- Shows: you know how to deal with real-world integration problems without breaking existing code

> **Red flags:** Reaching into the third-party class and modifying it; exposing the adaptee's methods from the adapter (defeats the purpose)

---

## The Core Concept

The problem it solves: you have code that expects interface A, and a class that provides interface B. You can't change either — the code calling it is shared, and the class is a third-party library or legacy component.

An adapter implements interface A and delegates all calls to the class with interface B, translating method names, parameter formats, and return types as needed.

```python
from abc import ABC, abstractmethod

class PaymentProcessor(ABC):        # Target — what our system expects
    @abstractmethod
    def pay(self, amount: float) -> dict: pass

# Stripe's SDK — can't change this
class StripeAPI:
    def create_charge(self, cents: int, currency: str) -> dict:
        return {"status": "ok", "id": f"stripe_{cents}_{currency}"}

# Adapter — makes StripeAPI fit PaymentProcessor
class StripeAdapter(PaymentProcessor):
    def __init__(self): self._stripe = StripeAPI()
    
    def pay(self, amount: float) -> dict:
        # Translate: dollars → cents, add currency
        return self._stripe.create_charge(int(amount * 100), "usd")

# Client code — only ever talks to PaymentProcessor
def checkout(processor: PaymentProcessor, amount: float):
    result = processor.pay(amount)
    print(f"Payment result: {result['status']}")

checkout(StripeAdapter(), 29.99)
```

Add PayPal? Create `PayPalAdapter(PaymentProcessor)`. The checkout function never changes.

---

## When to Use / When NOT to Use

**Use when:** you can't modify the adaptee (third-party library, legacy code, external API), and your system depends on a different interface.

**Don't use when:** you control both interfaces — just refactor them to match. Adapters are for integration, not for avoiding refactoring.

---

## Common Mistakes

**1. Overusing adapters instead of refactoring**
If you own both the calling code and the class, a rename/refactor is cleaner. Adapters are specifically for when you *can't* change one side.

**2. Exposing adaptee-specific methods from the adapter**
```python
class StripeAdapter(PaymentProcessor):
    def pay(self, amount): ...
    def get_stripe_customer_id(self): ...   # WRONG — leaks Stripe internals to callers
```
The adapter should only expose what the Target interface defines.

**3. Adding business logic to the adapter**
Adapters translate interfaces only. Discount calculation, retries, logging — those belong elsewhere.

**4. Not translating exceptions**
If the adaptee throws `StripeError`, callers shouldn't have to import Stripe to catch it. Catch and re-raise as a domain exception.

---

## Interview Q&A (Quick Fire)

**Q: How is Adapter different from Facade?**
> "Adapter converts one interface to another — it's usually wrapping a single class. Facade provides a simplified interface to a complex *subsystem* of many classes. Adapter is about compatibility; Facade is about simplification."

**Q: How is Adapter different from Decorator?**
> "Both wrap an object, but the intent differs. Adapter changes the interface — the wrapper and the wrapped have different interfaces. Decorator keeps the same interface but adds behaviour — the wrapper and wrapped are interchangeable."

**Q: Object adapter vs. class adapter — which do you prefer?**
> "Object adapter (composition). It's more flexible — you can adapt multiple related classes, and you can swap the adaptee at runtime. Class adapters (multiple inheritance) tie you to a specific concrete class."

---

## Key Takeaways

- Adapter = **translate** one interface into another so incompatible classes can work together
- Use **composition** (Object Adapter) over inheritance — more flexible, easier to test
- Keep adapters **thin**: translate calls, translate data formats, translate exceptions — no business logic
- Use when you **can't modify the adaptee** — if you can, just refactor instead
