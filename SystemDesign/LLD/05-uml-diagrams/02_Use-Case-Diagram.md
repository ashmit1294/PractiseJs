# Use Case Diagram

> **Source:** https://layrs.me/course/lld/05-uml-diagrams/use-case-diagram
> **Category:** UML — Behavioral

---

## TL;DR

| Term | Meaning |
|---|---|
| **Actor** | External entity (person or system) that interacts with the system |
| **Use Case** | One user goal the system fulfills (oval, verb phrase) |
| **Association** | Solid line: actor participates in use case |
| **«include»** | Mandatory step always required (dashed arrow) |
| **«extend»** | Optional enhancement triggered under certain conditions |
| **Generalization** | Inheritance between actors or use cases |
| **System boundary** | Rectangle enclosing all use cases; actors stay outside |

---

## The Analogy

A restaurant menu. The menu shows **what** the kitchen can do (dishes = use cases), not **how** (the recipes). Customers and waiters are actors — they interact with the kitchen through the menu. The health inspector (secondary actor) plays a different role but also interacts with the system.

---

## Core Concept

Use case diagrams show **what a system does from the user's perspective** — they are the highest-level behavioral view. Unlike class diagrams (structure) or sequence diagrams (interaction over time), use case diagrams answer: *"Who uses this system, and for what goals?"*

**Key distinction — include vs extend:**

```
Checkout ——«include»——> Process Payment     ← mandatory, always happens
Checkout <——«extend»——— Apply Discount      ← optional, happens only sometimes
```

Include = "must happen every time." Extend = "may happen optionally."

**Actor hierarchy example:**

```python
# Implemented as code structure for a learning platform
user = Actor("User")
student = Actor("Student", parent=user)   # inherits "Browse Courses"
instructor = Actor("Instructor", parent=user)
admin = Actor("Admin", parent=user)
```

Student inherits all User use cases plus gets `Enroll in Course`, `Watch Lecture`. Instructor gets `Create Course`, `Grade Assignment`.

---

## When to Use / Not Use

**Use** for: requirements gathering, stakeholder sign-off, defining scope ("what's inside the system boundary"), generating test case skeletons.

**Don't use** to: show sequence or timing (use Sequence Diagram), show data flow (use Activity Diagram), show internal structure (use Class Diagram).

---

## Common Mistakes

**1. Listing internal components as actors.** "Database" or "Authentication Module" are NOT actors — they're inside the system. Only external entities are actors. Ask: "Does this exist independently of my system?"

**2. Use cases too granular.** "Click Submit Button", "Validate Email Format" are implementation details, not use cases. A use case should answer: "What goal does the user accomplish?" — e.g., "Register Account", "Submit Order."

**3. Overusing include/extend.** These should be rare. If every use case has five arrows, the diagram becomes unreadable. Most use cases should stand alone. Use `«include»` only for truly shared, mandatory sub-flows.

**4. Mixing functional and non-functional requirements.** "System responds in 2 seconds" is NOT a use case. Performance, security, and scalability belong in supplementary specifications.

**5. Missing system boundary.** Without a clear rectangle, stakeholders don't know scope — what you're building vs. what's external. Always draw the boundary explicitly.

---

## Interview Q&A

**Q: "Design a use case diagram for an ATM."**
Start: "Actors: Customer (primary), Bank (secondary). Inside the boundary: Withdraw Cash, Check Balance, Transfer Funds, Change PIN. 'Withdraw Cash' includes 'Validate PIN' (mandatory). 'Print Receipt' extends 'Withdraw Cash' (optional)."

**Q: Include vs extend?**
"Include: the base use case cannot complete without the included one — 'Login' includes 'Validate Credentials.' Extend: the base use case can complete without the extension — 'Apply Discount' extends 'Checkout' only if the user has a code."

**Q: Primary vs secondary actor?**
"Primary actor initiates the interaction to achieve their goal — the Customer in a banking app. Secondary actor provides a service to the system — the Payment Gateway that our system calls."

**Q: What are the limitations of use case diagrams?**
"They show what the system does, not how or when. They don't show sequence, data flow, or object interactions. They're best used early in requirements gathering, then replaced by more detailed diagrams."

---

## Key Takeaways

- Use case diagrams show **what** a system does from the **user's perspective**, not how it works internally
- **Actors are external** — users or systems that interact with your system, never internal components
- Use cases represent **complete user goals** that provide value, not individual steps or UI actions
- `«include»` = mandatory; `«extend»` = optional — misusing these is a red flag in interviews
- The **system boundary** makes scope explicit and prevents feature creep
