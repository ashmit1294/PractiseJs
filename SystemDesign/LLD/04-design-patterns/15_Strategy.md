# 15 — Strategy Pattern

## TL;DR

| Question | Answer |
|---|---|
| What | Defines a family of interchangeable algorithms; inject one at runtime |
| Why | Eliminates if/else chains; open/closed — add algorithms without changing context |
| Components | Strategy interface · Concrete Strategies · Context (holds reference, delegates) |
| vs State | Strategy: *client* chooses, strategies are independent. State: *object* auto-transitions |
| When NOT | Fewer than 3 variants, or they never change at runtime — just use a function |

---

## The Analogy

A **navigation app** (Google Maps): the same app, same destination input, but you pick "fastest route", "avoid highways", or "walking". The app (context) delegates routing to whichever algorithm (strategy) you selected. Swapping strategies doesn't change the app.

---

## Core Concept

Strategy's core problem: code with 3+ branches that selects an algorithm based on a condition. As variants grow, the if/else chain becomes a maintenance hazard. Strategy externalises each variant as its own class implementing a common interface, then the context holds a reference and calls it without knowing which concrete strategy is running.

```python
class Sorter:
    def __init__(self, strategy):
        self._strategy = strategy      # injected dependency

    def set_strategy(self, strategy):  # swap at runtime
        self._strategy = strategy

    def sort(self, data):
        return self._strategy(data)    # delegate entirely

import functools
sorter = Sorter(sorted)                # built-in as strategy
sorter.sort([3, 1, 2])                 # [1, 2, 3]

sorter.set_strategy(lambda d: sorted(d, reverse=True))
sorter.sort([3, 1, 2])                 # [3, 2, 1]
```

In Python, **functions are first-class** — a callable is a perfectly valid strategy without needing a formal class hierarchy. Only wrap in classes when strategies need config state (e.g., `TaxStrategy(rate=0.18)`).

---

## When to Use / When NOT to Use

**Use when:**
- Multiple ways to perform the same operation (payment: card, PayPal, crypto)
- Algorithm selection happens at runtime based on user/config input
- You expect the number of variants to grow over time
- You want to test each algorithm variant in isolation

**Avoid when:**
- Only 1-2 variants exist and they're unlikely to grow — just pass a flag or callable
- The context needs to know which strategy is running (breaks the abstraction)
- Strategies need deep access to context internals — consider Template Method instead

---

## Common Mistakes

**Too many strategies for trivial differences** — if the only difference is one parameter value, use a parameterized single class instead of N strategy subclasses.

**Context knowing strategy internals** — the context should call `strategy.execute(data)` and nothing else. If it peeks at the strategy type (`isinstance` checks), you've defeated the purpose.

**Hardcoding strategy creation** — create strategies via dependency injection or a factory; don't `new` them inside the context. This makes testing and swapping impossible.

**Null strategy** — always provide a default strategy or guard for `None`; a missing strategy causes a cryptic `AttributeError` at call time.

**Confusing with State** — in Strategy the *client* picks the algorithm and strategies don't know about each other. In State, the *current state* decides what to do next and states reference each other for transitions.

---

## Interview Q&A

**Q: Show a payment processing design using Strategy.**  
`PaymentContext` holds a `PaymentStrategy`. `CreditCardStrategy`, `PayPalStrategy`, `CryptoStrategy` each implement `pay(amount)`. At checkout, the user's choice is injected: `ctx = PaymentContext(CreditCardStrategy(card_number))`. Calling `ctx.checkout(100)` delegates to the strategy — the context never branches on payment type.

**Q: How is Strategy different from Factory?**  
Factory *creates* objects. Strategy *defines behaviour*. You might use a Factory to instantiate the right Strategy, but they're complementary not equivalent.

**Q: When would you use Template Method instead?**  
When the algorithm's skeleton is fixed and only certain steps vary — use inheritance (Template Method). When the *entire* algorithm is swappable at runtime — use composition (Strategy).

---

## Key Takeaways

- Strategy eliminates if/else chains by externalising each variant as an interchangeable object
- In Python, callables (functions/lambdas) are the simplest strategy — only use classes when strategies need state
- Context delegates entirely to the strategy; never let the context branch on strategy type
- Strategy = client picks algorithm (independent); State = object auto-transitions between states (interdependent)
