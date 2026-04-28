# Decorator Pattern

> **Source:** https://layrs.me/course/lld/04-design-patterns/decorator
> **Level:** Beginner | **Read:** ~10 min | **Category:** Structural

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Decorator** | Wrap an object to add behaviour — same interface, new features |
| **Component** | The shared interface — base object and all decorators implement it |
| **Concrete Component** | The base object being decorated (e.g., `SimpleCoffee`) |
| **Decorator** | Wraps a Component and delegates to it, adding its own behaviour |
| **vs. Inheritance** | Inheritance creates one subclass per combination; decorators combine at runtime with no class explosion |

---

## The Analogy

Coffee customisation: you have a base `Coffee`. Add milk — wrap it in `MilkDecorator`. Add sugar — wrap that in `SugarDecorator`. Each wrapper adds its cost and description, then delegates down to the previous layer. You build the customisation at order-time, not at compile-time.

---

## Why This Matters in Interviews

- "Design a notification system where any notification can be logged, retried, and rate-limited in any combination" → Decorator
- Signal: "Inheritance would give me `LoggedRetriableRateLimitedEmailNotification` — 2^n subclasses. Decorators compose at runtime"
- Shows: you understand why "prefer composition over inheritance" — here's the practical pattern for it

> **Red flags:** Decorator methods that don't call `self._wrapped.operation()` — you'd be *replacing* behaviour, not *adding* to it; decorators that add non-interface methods (breaks polymorphism)

---

## The Core Concept

The problem it solves: you want to add optional behaviours (logging, caching, validation, formatting) to an object, but the combinations are numerous. Creating subclasses for every combination explodes: `LoggedCachedValidatedPaymentProcessor`, `CachedValidatedPaymentProcessor`, etc.

Decorators wrap the object and call through to it, each adding one thing. You compose them at runtime.

```python
from abc import ABC, abstractmethod

class Coffee(ABC):
    @abstractmethod
    def cost(self) -> float: pass
    @abstractmethod
    def description(self) -> str: pass

class SimpleCoffee(Coffee):
    def cost(self) -> float: return 2.0
    def description(self) -> str: return "Coffee"

class CoffeeDecorator(Coffee):          # Decorator base — implements the same interface
    def __init__(self, coffee: Coffee):
        self._coffee = coffee
    def cost(self) -> float: return self._coffee.cost()        # delegate down
    def description(self) -> str: return self._coffee.description()

class MilkDecorator(CoffeeDecorator):
    def cost(self) -> float: return self._coffee.cost() + 0.50
    def description(self) -> str: return self._coffee.description() + ", milk"

class SugarDecorator(CoffeeDecorator):
    def cost(self) -> float: return self._coffee.cost() + 0.20
    def description(self) -> str: return self._coffee.description() + ", sugar"

# Compose at runtime — any combination, any order
order = SugarDecorator(MilkDecorator(SimpleCoffee()))
print(order.description())   # Coffee, milk, sugar
print(order.cost())          # 2.70
```

The `Coffee` interface doesn't change. Neither does `SimpleCoffee`. Each decorator is a single independent class that knows only about `Coffee`.

---

## When to Use / When NOT to Use

**Use when:** you need many combinations of optional behaviours; you want to add/remove behaviour at runtime; you want each behaviour to be independent and reusable.

**Don't use when:** you have a small fixed set of types — two or three subclasses is simpler. Also, decorators are order-sensitive (`UpperCaseDecorator(BoldDecorator(...))` vs. the reverse produce different results); if order independence matters, Decorator may not be the right fit.

---

## Common Mistakes

**1. Forgetting to delegate to the wrapped component**
```python
class MilkDecorator(CoffeeDecorator):
    def cost(self): return 0.50    # WRONG — ignores base cost; replaces, not adds
```
Every decorator must call `self._coffee.cost()` and add to it. That's the chain.

**2. Decorators that add methods not in the interface**
If `MilkDecorator` adds `get_milk_type()`, callers with a `Coffee` reference can't use it without a type cast — defeating polymorphism.

**3. Applying Decorator for a fixed small set**
If you only ever have "Large" and "Small" coffee, two subclasses is cleaner. Decorator's value is in runtime composition of many independent options.

---

## Interview Q&A (Quick Fire)

**Q: How is Decorator different from Proxy?**
> "Both wrap an object. Decorator *adds* behaviour — the wrapped object still does its work, the decorator adds on top. Proxy *controls access* — it may defer, restrict, or cache the real object's operation. Proxy often manages the real object's lifecycle; Decorator just enhances."

**Q: How is Decorator different from inheritance?**
> "Inheritance adds behaviour at compile time for specific combinations. If I have 5 optional features, I'd need 2^5 = 32 subclasses to cover all combinations. Decorators compose at runtime — I need exactly 5 decorator classes and can combine them freely."

**Q: Order matters in decorators?**
> "Yes, when decorators transform data. `UpperCase(Bold('hello'))` produces `<b>HELLO</b>` (bold applied first, then uppercased including tags). `Bold(UpperCase('hello'))` produces `<b>HELLO</b>` (uppercased first, then bolded). Always document expected order or design decorators to be order-independent."

---

## Key Takeaways

- Decorator = **wrap an object with the same interface** to add one behaviour at a time — compose at runtime
- The chain works because every decorator **delegates** to the wrapped component — always call through
- Each decorator adds **one responsibility** — that's what makes them composable (Single Responsibility)
- Decorators follow **OCP** — you extend behaviour by adding a new decorator class, never modifying existing ones
