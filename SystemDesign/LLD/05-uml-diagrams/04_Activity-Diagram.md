# Activity Diagram

> **Source:** https://layrs.me/course/lld/05-uml-diagrams/activity-diagram
> **Category:** UML — Behavioral (Workflow)

---

## TL;DR

| Symbol | Meaning |
|---|---|
| **Solid circle** | Initial node (start) |
| **Bullseye** | Final node (end) |
| **Rounded rectangle** | Activity (action / task) |
| **Diamond** | Decision node (outgoing edges have guard conditions) |
| **Diamond** | Merge node (multiple in, one out — no guards needed) |
| **Thick bar** | Fork (split into parallel flows) |
| **Thick bar** | Join (synchronize parallel flows — all must complete) |
| **Swimlane** | Vertical/horizontal partition showing which actor performs each activity |

---

## The Analogy

An airport departure process. Multiple actors (passenger, check-in agent, security, gate staff) perform activities in a specific order. Some are sequential (check in → security → gate), some are parallel (baggage goes to the plane while you walk to the gate). Activity diagrams model exactly this — a workflow with actors, decisions, and parallel tracks.

---

## Core Concept

Activity diagrams model **workflow and control flow** — they answer "What activities happen, in what order, with what decisions?" Unlike sequence diagrams (which object calls which method), activity diagrams focus on **the process itself**, often spanning multiple actors via swimlanes.

**Code mapping:**

```python
# Activity diagram logic → direct code translation
def calculate_grade(score: int) -> str:
    if score >= 90: return 'A'   # decision node
    elif score >= 80: return 'B'
    elif score >= 70: return 'C'
    elif score >= 60: return 'D'
    else: return 'F'
```

Each decision diamond becomes an `if/elif`. Activities become function calls. **Fork → parallel threads; Join → `thread.join()`.**

---

## When to Use / Not Use

**Use** to: document multi-actor business processes, visualize an algorithm before coding, find bottlenecks (slow activities visible at a glance), show parallel operations with fork/join.

**Don't use** to: show which object calls which method (use Sequence Diagram), model an object's state transitions (use State Machine), show system structure (use Class Diagram).

**Vs Flowcharts:** Activity diagrams add swimlanes (who does what), standardized fork/join for parallel flows, and object flows (data objects moving between activities).

---

## Common Mistakes

**1. Confusing decision and merge nodes.** Decision nodes have one incoming and multiple outgoing edges, each with a guard condition `[e.g. valid]`. Merge nodes have multiple incoming and one outgoing edge — no guards. Using the same symbol for both without labels creates ambiguity.

**2. Fork without matching join.** Every fork must have a corresponding join. Without join, the diagram implies the next activity can start before parallel activities finish — implying a race condition.

**3. Too much detail.** "Open file", "Read line", "Parse token", "Close file" → replace with one activity "Load data from file." Diagrams communicate at a level of abstraction, not replace code.

**4. Missing initial/final nodes.** Diagrams without start and end nodes are ambiguous. Multiple final nodes are fine — one for "Success", one for "Failure."

**5. No swimlanes for multi-actor processes.** Without swimlanes, it's unclear whether the Customer, the System, or the Database performs each activity — the most important design question.

---

## Interview Q&A

**Q: Activity diagram vs sequence diagram?**
"Activity: what activities happen and in what order (workflow). Sequence: which objects call which methods (object interaction). For an order fulfillment process overview, I'd use activity. For the interaction between OrderService and PaymentGateway, I'd use sequence."

**Q: How do you model parallel processing?**
"Fork bar splits into parallel tracks; join bar synchronizes them. In code this maps to spawning threads at the fork and calling `thread.join()` at the join."

**Q: How do you model error handling?**
"Add a decision node after the risky activity: `[success]` continues forward, `[failure]` leads to an error-handling activity or a separate final node."

**Q: How do you spot optimization opportunities in a diagram?**
"Look for: sequential activities that have no data dependency → could be parallelized with fork/join. Duplicate decision points checking the same condition. Activities with many incoming paths → bottleneck candidates for caching."

---

## Key Takeaways

- Activity diagrams model **workflow** — who does what, in what order, with decisions and parallelism
- Core notation: initial node, final node, activities, decision/merge diamonds, fork/join bars, swimlanes
- Maps directly to code: decision → `if/elif`, loop → `while/for`, fork/join → parallel threads + `join()`
- Use **swimlanes** whenever multiple actors or components are involved — they answer "who is responsible?"
- In interviews: know when to suggest activity diagrams vs sequence vs state diagrams
