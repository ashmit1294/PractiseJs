# State Machine Diagram

> **Source:** https://layrs.me/course/lld/05-uml-diagrams/state-machine-diagram
> **Category:** UML — Behavioral (State)

---

## TL;DR

| Term | Meaning |
|---|---|
| **State** | Rounded rectangle; object is in exactly one state at a time |
| **Transition** | Arrow from state to state, labeled `event [guard] / action` |
| **Initial state** | Filled black circle → first state |
| **Final state** | Bullseye (circle inside circle) |
| **Guard condition** | `[condition]` on transition — must be true for transition to fire |
| **Action** | `/doSomething` — executes during the transition |
| **Self-transition** | Loop on same state (event occurs but state doesn't change) |
| **Composite state** | State containing substates (hierarchical state machine) |

---

## The Analogy

A traffic light. It's always in exactly one state (Red, Yellow, or Green). You can't be in two states simultaneously. It transitions on a timer event. There's no direct path from Red to Yellow in one direction — valid transitions are explicit. State machines formalize this: **all states, all transitions, all triggers — nothing undefined.**

---

## Core Concept

State machine diagrams model **how an object transitions through states in response to events**. They prevent invalid state combinations and make complex conditional logic readable and testable.

```python
from enum import Enum

class ConnectionState(Enum):
    DISCONNECTED = 1
    CONNECTING = 2
    CONNECTED = 3

class Connection:
    def __init__(self):
        self.state = ConnectionState.DISCONNECTED

    def connect(self):
        if self.state == ConnectionState.DISCONNECTED:
            self.state = ConnectionState.CONNECTING
            self.state = ConnectionState.CONNECTED  # simplified
        else:
            raise ValueError(f"Cannot connect from {self.state.name}")

    def send(self, data):
        if self.state != ConnectionState.CONNECTED:
            raise ValueError("Must be CONNECTED to send")
        print(f"Sending: {data}")
```

Without the state machine, there's nothing preventing `send()` when disconnected. The explicit state check enforces the diagram's rules at runtime.

---

## When to Use / Not Use

**Use** when: an object has distinct modes of behavior, the response to events depends on current state, you need to prevent invalid transitions, there is complex conditional logic based on history.

**Don't use** for: objects with no behavioral changes (just store/retrieve data), modeling data relationships (use class diagram), very simple on/off behavior (a boolean suffices).

---

## Common Mistakes

**1. No state validation.** Allowing operations without checking current state lets you lock an open door. Always validate state before executing transitions.

```python
# Wrong:
def lock(self): self.is_locked = True   # can lock an open door!

# Right:
def lock(self):
    if self.state != 'closed':
        raise ValueError("Can only lock a closed door")
    self.state = 'locked'
```

**2. Boolean flags instead of states.** With 4 booleans you have 16 combinations but only 5 valid states — a bug factory. Use an `Enum`.

**3. Missing guard conditions.** Guards are essential business logic. Skipping them means invalid transitions execute silently.

**4. Business logic inside transitions.** Transition methods should be short — check guard, change state, call a hook method. Don't put 50 lines of business logic in `approve_order()`. Extract to `_on_approval()`.

**5. Not handling all events in all states.** Every event that can occur should have defined behavior in every state, even if it's "ignore" or "raise error." Undefined behavior causes crashes or inconsistent state.

---

## Interview Q&A

**Q: Design a state machine for an order system.**
"States: New → Confirmed → Processing → Shipped → Delivered. Also Cancelled (from New or Confirmed). Transitions: `confirm()` from New (guard: payment valid), `startProcessing()` from Confirmed, `ship()` from Processing, `deliver()` from Shipped, `cancel()` from New or Confirmed."

**Q: State machine vs strategy pattern?**
"State pattern: the **object** controls its own transitions — states call `context.set_state(NextState())`. Strategy pattern: the **client** chooses the algorithm at runtime; the algorithm itself doesn't switch strategies."

**Q: Why use a state machine instead of if-else chains?**
"With 5 boolean flags you get 32 combinations, only 8 valid — the other 24 are hidden bugs. State machines make valid states explicit, prevent impossible combinations, and are easier to test: each state is a unit. Also easier to extend: adding a new state doesn't require modifying all existing logic."

**Q: What is a composite state?**
"A state that contains substates. A media player in 'Playing' state has substates: NormalSpeed, FastForward, Rewind. This models hierarchical behavior without flattening everything into one massive flat state machine."

**Q: Thread safety?**
"In multi-threaded environments, state transitions must be synchronized to prevent two threads from transitioning simultaneously. Common approach: acquire a lock before reading current state and transitioning, release after."

---

## Key Takeaways

- State machines prevent **invalid state combinations** and make complex behavior explicit and testable
- Every object is in **exactly one state** at a time; transitions fire on **events**, optionally gated by **guards**, executing **actions**
- Use **Enum** for simple cases; use the **State Pattern** (each state as a class) when state-specific behavior is complex
- **Guard conditions** are essential business logic — always validate preconditions before transitioning
- Know the comparison: state machine **diagram** (design tool) vs State **Pattern** (implementation approach)
