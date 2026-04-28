# 20 — Mediator Pattern

## TL;DR

| Question | Answer |
|---|---|
| What | Centralise complex communication — objects talk through a mediator, not each other |
| Why | Reduces connections from O(n²) to O(n); easier to add components without touching existing ones |
| Components | Mediator interface · ConcreteMediator (coordination logic) · Colleagues (only know the mediator) |
| vs Observer | Observer = one-to-many notification. Mediator = many-to-many coordination |
| When NOT | Only 2–3 objects with simple, infrequent interactions |

---

## The Analogy

An **air traffic control tower**: planes don't talk to each other (dangerous). They all talk to the tower, which coordinates who can land, who must hold, who's next. The tower is the mediator — it knows all aircraft; aircraft only know the tower.

---

## Core Concept

When many objects need to interact, direct references create an O(n²) web of dependencies. Adding a new colleague requires updating many others. The Mediator centralises all coordination in one place: colleagues hold only a reference to the mediator and send/receive through it. The mediator encapsulates the "who reacts to what" logic that was previously scattered.

```python
class ChatRoom:
    def __init__(self):
        self._users = []

    def add_user(self, user):
        self._users.append(user)

    def send(self, message, sender):
        for user in self._users:
            if user is not sender:
                user.receive(f"{sender.name}: {message}")

class User:
    def __init__(self, name, room):
        self.name = name
        self._room = room
        room.add_user(self)

    def send(self, msg): self._room.send(msg, self)
    def receive(self, msg): print(f"[{self.name}] {msg}")

room = ChatRoom()
alice = User("Alice", room)
bob = User("Bob", room)
alice.send("Hey!")   # Bob receives "Alice: Hey!"
```

Users have zero references to each other — adding `charlie = User("Charlie", room)` requires no changes to `alice` or `bob`.

---

## When to Use / When NOT to Use

**Use when:**
- 4+ objects with complex, many-to-many interaction patterns
- Adding a new component would otherwise require updating many existing ones
- Interaction rules are complex enough to warrant centralisation (chat rooms, GUI forms, trading systems)

**Avoid when:**
- 2–3 objects with simple interactions — direct calls are clearer
- The mediator would need to know too much about colleagues' internals — breaks encapsulation

---

## Common Mistakes

**God Object mediator** — putting *all* logic in the mediator (validation, spam detection, logging, analytics) turns it into an unmaintainable monolith. Delegate to specialised components (Strategy, CoR) and keep the mediator focused on *routing* only.

**Colleagues communicating directly** — if colleagues hold references to other colleagues for "convenience", the coupling the pattern was meant to eliminate returns. All communication must route through the mediator interface.

**No mediator interface** — a concrete mediator class couples colleagues to that specific implementation, making it impossible to test or swap. Always define `ChatMediator(ABC)` and have colleagues depend on the abstraction.

**Forgetting to unregister** — colleagues that leave (users disconnecting, form fields removed) must be removed from the mediator's list. Without `remove_user()`, they stay registered, receive messages, and leak memory.

---

## Interview Q&A

**Q: How is Mediator different from Observer?**  
Observer is one-to-many: one subject notifies many observers of its own state changes, unidirectionally. Mediator is many-to-many: colleagues communicate *through* the mediator in both directions; the mediator routes and coordinates, not just notifies.

**Q: How is Mediator different from Facade?**  
Facade simplifies access to a complex subsystem — subsystem classes don't know about the facade. Mediator coordinates communication between *peers* — colleagues know about the mediator. Facade is structural; Mediator is behavioural.

**Q: Design a GUI form where enabling a checkbox enables/disables other fields.**  
`RegistrationForm` (mediator) holds references to all form fields. Each field calls `form.notify(self, "changed")` when its value changes. The form's `notify()` contains all cross-field logic: enable submit only when all fields valid, show/hide dependent fields. Fields themselves stay simple and reusable.

---

## Key Takeaways

- Mediator reduces object connections from O(n²) to O(n) — colleagues only reference the mediator
- Colleagues must never hold direct references to each other; all communication flows through the mediator
- Keep the mediator as a *router*, not a *god object* — delegate complex logic to specialised components
- Always define an abstract mediator interface; always provide a `remove`/`unregister` method for lifecycle management
