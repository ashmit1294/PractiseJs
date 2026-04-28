# Module 1 Summary — OOP Fundamentals

> **Source:** https://layrs.me/course/lld/01-oop-fundamentals
> **Topics:** 9 | **Folder:** `01-oop-fundamentals/`

---

## Topics Covered

| # | File | Core Concept |
|---|---|---|
| T01 | [01_Classes-and-Objects.md](01_Classes-and-Objects.md) | Blueprint (class) vs instance (object); constructor; `self` |
| T02 | [02_Enums.md](02_Enums.md) | Fixed named constants; type safety; replace magic numbers |
| T03 | [03_Interfaces.md](03_Interfaces.md) | Pure contract; `@abstractmethod`; DI + testability |
| T04 | [04_Encapsulation.md](04_Encapsulation.md) | Bundle + control access; `@property`; prevent invalid state |
| T05 | [05_Abstraction.md](05_Abstraction.md) | Hide complexity; expose simplified interface; ABC pattern |
| T06 | [06_Inheritance.md](06_Inheritance.md) | Is-a relationship; `super()`; MRO; composition > inheritance |
| T07 | [07_Polymorphism.md](07_Polymorphism.md) | One interface, many forms; runtime vs compile-time; duck typing |
| T08 | [08_Abstract-Classes-vs-Interfaces.md](08_Abstract-Classes-vs-Interfaces.md) | Shared code vs pure contract; is-a vs can-do |
| T09 | [09_Method-Overloading-vs-Overriding.md](09_Method-Overloading-vs-Overriding.md) | Compile-time vs runtime; Python's lack of overloading |

---

## The 4 Pillars — Quick Reference

| Pillar | Core Idea | Python Mechanism |
|---|---|---|
| **Encapsulation** | Bundle data + methods; control access | `__private`, `@property` |
| **Abstraction** | Hide complexity; expose simple interface | `ABC` + `@abstractmethod` |
| **Inheritance** | Reuse code through is-a hierarchy | `class Child(Parent):`, `super()` |
| **Polymorphism** | One interface, many implementations | Method overriding, duck typing |

---

## Common Interview Pattern

Every LLD design question maps to this flow:

```
1. Identify the abstraction (what interface does this need?)
2. Design the class hierarchy (is-a → inherit; has-a → compose)
3. Encapsulate state (what must be private? what needs validation?)
4. Enable polymorphism (how do different types behave differently?)
5. Apply enums for fixed states (OrderStatus, ElevatorState, etc.)
```

---

## Decision Cheat Sheet

| Situation | Solution |
|---|---|
| Fixed set of values | `Enum` |
| Pure "can-do" contract | Interface (ABC, no state) |
| Shared code + is-a | Abstract class |
| Has-a relationship | Composition |
| Runtime behavior variation | Polymorphism / method override |
| Multiple overloads in Python | Default args or `*args` |
| Read-only computed attribute | `@property` without setter |
