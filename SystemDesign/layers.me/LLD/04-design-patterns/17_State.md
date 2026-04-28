# 17 — State Pattern

## TL;DR

| Question | Answer |
|---|---|
| What | Object changes behaviour when its internal state changes — states are first-class objects |
| Why | Eliminates massive if/else or switch chains based on state flags |
| Key rule | States trigger their OWN transitions by calling `context.set_state()` |
| vs Strategy | State: internal auto-transitions between interdependent states. Strategy: client picks independent algorithm |
| When NOT | Simple boolean flag (on/off) — State pattern is overkill |

---

## The Analogy

A **document publishing workflow**: the same `publish()` call behaves completely differently depending on whether the document is in Draft, In-Review, or Published state. Rather than checking a flag inside `publish()`, each state object implements its own `publish()` and decides what to do — including which state to transition to next.

---

## Core Concept

Without State, a class accumulates a growing chain of conditionals: `if self.state == "draft": ... elif self.state == "review": ...`. Every new state requires touching every method. State pattern splits each state into its own class. The Context holds a reference to the current state and delegates all behaviour to it. When an action should cause a transition, the *state itself* calls `context.set_state(NextState())` — not the context.

```python
class DraftState:
    def publish(self, doc):
        print("Submitting for review")
        doc.set_state(ReviewState())

class ReviewState:
    def publish(self, doc):
        print("Publishing document")
        doc.set_state(PublishedState())

class PublishedState:
    def publish(self, doc):
        print("Already published — create new version")

class Document:
    def __init__(self):
        self._state = DraftState()

    def set_state(self, state):
        self._state = state

    def publish(self):
        self._state.publish(self)   # delegates entirely

doc = Document()
doc.publish()   # Submitting for review
doc.publish()   # Publishing document
doc.publish()   # Already published — create new version
```

**Context data belongs in the Context** — state objects should be stateless (or nearly so) so they can be reused/shared.

---

## When to Use / When NOT to Use

**Use when:**
- 3+ distinct states with meaningfully different behaviour per state
- Large conditionals based on a state variable appear across multiple methods
- State transitions need to be explicit and auditable (order workflows, TCP connections)

**Avoid when:**
- Only 2 states (on/off) — a boolean flag is simpler
- Transitions are trivial and state-specific behaviour is minimal
- States would need so much context data that they become coupled to the context class anyway

---

## Common Mistakes

**Stateful state objects** — storing data in state instances breaks reuse. The Context is the data owner; states are behaviour delegates. If a state needs document content, it reads it from the context passed in.

**Creating new state instances on every call** — if states are stateless, instantiate them once and reuse. Creating `ReviewState()` every time wastes allocations.

**Transition logic in Context** — if the context's `publish()` decides which state to go to next (`if isinstance(self._state, DraftState): self._state = ReviewState()`), you've gone backwards to the original if/else mess. Let states self-transition.

**Silent failures on invalid transitions** — `PublishedState.submit_for_review()` should either raise, log a warning, or do nothing intentionally. Never silently ignore a transition that shouldn't happen.

---

## Interview Q&A

**Q: Design a TCP connection using State.**  
States: `ClosedState`, `ListenState`, `EstablishedState`. `Connection` (context) starts in `ClosedState`. `open()` on ClosedState transitions to ListenState. `connect()` on ListenState transitions to EstablishedState. Each state defines what `send()`, `receive()`, `close()` mean for that state.

**Q: How is State different from Strategy?**  
In Strategy, the client chooses the algorithm and strategies are independent of each other. In State, the current state decides behaviour AND triggers transitions to other states — states know about each other and the system auto-advances.

**Q: What's the Hollywood Principle connection?**  
"Don't call us, we'll call you." The state calls back into the context (`context.set_state(...)`) rather than the context polling the state for what to do next.

---

## Key Takeaways

- Each state is a class; the Context delegates behaviour to the current state — no conditionals needed
- **States self-transition** by calling `context.set_state(NextState())` — the context never decides the next state
- Keep state objects stateless; all data lives in the Context — then states can be reused/shared
- 3+ states with distinct per-method behaviour = State pattern; 2 states = just use a boolean
