# Class Diagram

> **Source:** https://layrs.me/course/lld/05-uml-diagrams/class-diagram
> **Category:** UML — Structural

---

## TL;DR

| Term | Meaning |
|---|---|
| **Class box** | Three compartments: name / attributes / methods |
| **Visibility** | `+` public, `-` private, `#` protected |
| **Association** | Knows-about; independent lifecycles |
| **Aggregation** | Has-a; shared ownership (`o—`) |
| **Composition** | Owns; child destroyed with parent (`◆—`) |
| **Inheritance** | Is-a; hollow triangle pointing to parent |
| **Dependency** | Uses temporarily (`..>`) |
| **Multiplicity** | `1`, `0..1`, `0..*`, `1..*` |

---

## The Analogy

A class diagram is an architectural blueprint. Before a builder pours concrete, they study a blueprint that shows every room, every structural wall, and every load-bearing relationship. Code is the building; the class diagram is the blueprint — it shows what exists and how things connect, not what happens over time.

---

## Core Concept

Class diagrams are UML's most-used diagram type, showing the **static structure** of a system: classes, their attributes and methods, and the relationships between them.

Each class is a box with three sections:

```
┌─────────────────┐
│   BankAccount   │   ← Class name (abstract → italics)
├─────────────────┤
│ - balance: float│   ← Attributes: visibility name: type
├─────────────────┤
│ + deposit()     │   ← Methods: visibility name(params): return
│ + getBalance()  │
└─────────────────┘
```

**Key relationships:**

```
Customer ——1——>——0..*—— Order ——◆——1..*—— OrderItem
```

- Customer *places* Orders (association, 1 to many)
- Order *owns* OrderItems (composition — items die with the order)

**Multiplicity reads left-to-right as a sentence:** "One customer places zero or more orders."

---

## When to Use / Not Use

**Use** to: communicate design before coding, review relationships in a code review, sketch a system in an interview ("let me draw the classes first").

**Don't use** to: show sequence of operations (use Sequence Diagram), model state transitions (use State Machine), or document every getter/setter (over-engineering).

---

## Common Mistakes

**1. Confusing association, aggregation, composition.** Ask: "If I delete A, must B also die?" Yes → composition. No → association or aggregation.

```python
# Composition: House creates and owns its rooms
class House:
    def __init__(self, n):
        self.__rooms = [Room(f"Room {i}") for i in range(n)]
# Rooms don't exist without the house
```

**2. Overcomplicating diagrams.** Include only public interfaces and key attributes — not every getter, private helper, or logging statement. If it doesn't affect design decisions, leave it out.

**3. Inheritance instead of composition.** Use the "is-a" test. `Car` is a `Vehicle` ✅. `Car` is an `Engine` ❌ — use composition.

**4. Wrong multiplicity placement.** Place the number near the class it describes: `Customer "1" ——> "0..*" Order` reads "one customer, many orders."

**5. Not marking abstract classes.** Add `{abstract}` or italicize the class name and abstract methods, otherwise developers think they can instantiate it.

---

## Interview Q&A

**Q: "Design a parking lot system."**
Start: "Let me sketch the class diagram first. I see nouns: ParkingLot, Level, ParkingSpot, Vehicle. Verbs → methods: `park()`, `leave()`, `findAvailableSpot()`. ParkingLot *contains* Levels (composition), Level *contains* Spots (composition), Spot *references* Vehicle (association)."

**Q: Aggregation vs Composition?**
"Aggregation: Department has Professors, but professors can exist without the department. Composition: University contains Departments — a department can't exist without the university. The test is lifecycle dependency."

**Q: Class diagram vs object diagram?**
"Class diagram shows structure (the blueprint). Object diagram shows specific instances at a point in time (Alice's account with balance $500)."

**Q: What's a dependency relationship?**
"A dashed arrow `..>` meaning one class uses another temporarily — as a method parameter or local variable — but doesn't hold a reference as an attribute."

---

## Key Takeaways

- Class diagrams show **static structure** — blueprints, not behavior
- Master four relationships: **association**, **aggregation**, **composition**, **inheritance** — each has different lifecycle implications
- Always specify **multiplicity** and **visibility**; omit trivial methods
- **Design before coding** in interviews — sketch the class diagram first and explain your relationship choices out loud
