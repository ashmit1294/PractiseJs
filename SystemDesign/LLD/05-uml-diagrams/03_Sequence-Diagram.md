# Sequence Diagram

> **Source:** https://layrs.me/course/lld/05-uml-diagrams/sequence-diagram
> **Category:** UML — Behavioral (Interaction)

---

## TL;DR

| Term | Meaning |
|---|---|
| **Participant / Lifeline** | Box at top + dashed vertical line = one object's lifetime |
| **Synchronous message** | Solid arrow with filled head (caller waits for return) |
| **Return message** | Dashed arrow back to caller |
| **Activation box** | Thin rectangle on lifeline = "actively processing" |
| **`alt` fragment** | Conditional: `[condition]` / `[else]` |
| **`loop` fragment** | Repeated section |
| **Time** | Flows **top to bottom** |

---

## The Analogy

A phone call transcript. You can see exactly who said what, in what order, and what reply came back — you can't see the internal state of each person, but you see the full timeline of the conversation between participants. Sequence diagrams are that transcript, but for objects.

---

## Core Concept

Sequence diagrams show **how objects interact over time** — they answer "What happens when X triggers Y?" Unlike class diagrams (static structure), sequence diagrams capture **dynamic behavior** during one specific scenario.

**Reading the notation:**

```
Client ——————> OrderSystem: process_order(cart)
               OrderSystem ——> InventoryService: check_stock(items)
               InventoryService - - -> OrderSystem: True
               OrderSystem ——> PaymentGateway: charge(amount)
               PaymentGateway - - -> OrderSystem: Transaction(success=True)
OrderSystem - - - - - - - - - - - -> Client: {status: "success"}
```

Solid arrows = calls. Dashed arrows = returns. Order top→bottom = time order. Critical insight: **stock is checked BEFORE payment is charged** — the diagram makes this ordering rule visual and unambiguous.

---

## When to Use / Not Use

**Use** to: explain a specific use case flow, reveal performance bottlenecks (count the messages), clarify which object is responsible for each step, identify circular dependencies.

**Don't use** to: show static relationships (use Class Diagram), model an object's lifecycle states (use State Machine), document all possible paths at once — each diagram should cover one scenario.

---

## Common Mistakes

**1. Treating it like a flowchart.** Sequence diagrams show interactions *between objects*, not algorithmic flow. No diamond shapes — use `alt` fragments for conditionals and ensure every arrow names a specific method call.

**2. Missing return messages.** Every significant method call should have a return arrow. Without returns, it's unclear what data flows back or when control returns to the caller. Interviewers notice immediately.

**3. Wrong detail level.** Too much: every getter, logging call, internal calculation. Too little: `Client -> System: doEverything()`. Show significant collaborations only — if removing a message would make the flow unclear, keep it.

**4. Incorrect time ordering.** Arrows must appear in the actual execution order, top to bottom. Common error: charging payment before checking stock.

**5. Mixing abstraction levels.** Don't combine high-level components ("Payment System") with low-level classes ("CreditCardValidator") in the same diagram. Pick one level and stick to it.

---

## Interview Q&A

**Q: How do you start drawing a sequence diagram in an interview?**
"First I clarify the scenario: 'We're modeling what happens when a user clicks Submit Order, right? Key participants are OrderController, PaymentGateway, InventoryService.' Then I draw participants, then the happy-path arrows top-to-bottom, then add one error path using an `alt` fragment."

**Q: Sequence diagram vs class diagram vs state diagram?**
"Sequence = who calls whom and when (one scenario). Class = static structure (all classes and relationships). State = how one object's state changes over its lifetime."

**Q: How do you show an error path?**
"Use an `alt` fragment with `[payment success]` and `[payment failed]` branches. The diagram has two vertical sections, one per outcome."

**Q: What makes a sequence diagram valuable?**
"It reveals bottlenecks — count the messages to see what's expensive. It exposes coupling — if OrderController calls 7 different services, that's a smell. And it makes the contract between objects explicit before writing code."

---

## Key Takeaways

- Sequence diagrams show **object interactions over time** — time flows top-to-bottom
- **Participants** are objects/actors; **messages** are method calls; **returns** are dashed arrows back
- Cover **one scenario per diagram** — not the entire system
- Always draw **return messages** for significant calls
- In interviews: **clarify the scenario first**, narrate while drawing, proactively handle the error path with `alt` fragments
