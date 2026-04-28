# 14 — Observer Pattern

## TL;DR

| Question | Answer |
|---|---|
| What | One-to-many dependency — subject state change notifies all observers automatically |
| Why | Decouples publisher from subscribers; neither needs to know the other's implementation |
| Components | Subject (attach/detach/notify) · Observer (update) · Concrete variants of each |
| Push vs Pull | Push = subject sends data; Pull = observers query after notification; Hybrid = best |
| When NOT | Simple one-subscriber cases; when notification order must be deterministic |

---

## The Analogy

A **newsletter subscription**: the publisher doesn't know who the subscribers are or what they do with the content. Subscribers join and leave freely. When a new issue drops, everyone currently subscribed receives it — without the publisher tracking anyone individually.

---

## Core Concept

Observer (also called Publish-Subscribe or Event) solves the problem of keeping multiple objects in sync when one object's state changes. Without it, the subject would need explicit references and calls to every dependent object — tight coupling that breaks with every new consumer.

The subject maintains a list of observers. When state changes, it calls `notify()`, which iterates that list and calls each observer's `update()`. Observers register themselves; the subject never needs to know their concrete types.

```python
class EventBus:
    def __init__(self):
        self._subscribers = []

    def subscribe(self, fn):
        self._subscribers.append(fn)

    def publish(self, data):
        for fn in self._subscribers[:]:   # copy: safe even if subscribe/unsubscribe during notify
            fn(data)

bus = EventBus()
bus.subscribe(lambda d: print(f"Listener A got: {d}"))
bus.subscribe(lambda d: print(f"Listener B got: {d}"))
bus.publish("price changed to $42")
```

**Push vs Pull hybrid** (recommended): the notification carries the event type plus just enough data for most observers; observers that need more details query the subject directly.

---

## When to Use / When NOT to Use

**Use when:**
- Multiple unrelated objects need to react to state changes in one object
- The set of observers is unknown at compile time or changes at runtime
- Event-driven systems: UI frameworks, message buses, stock tickers, sensor feeds

**Avoid when:**
- Only one consumer will ever exist — just call it directly
- Notification order matters and must be guaranteed — observer order is fragile
- Circular dependencies risk: A notifies B which notifies A (infinite loop)

---

## Common Mistakes

**Memory leaks from never detaching** — if observers hold references to subjects (or vice versa) and are never removed, garbage collection can't free them. Always call `detach()` when an observer is done (use weak references for long-lived subjects).

**Modifying the observer list during notification** — iterating `self._observers` while a callback calls `subscribe()` or `unsubscribe()` corrupts the loop. Always iterate over a copy: `self._observers[:]`.

**Notification order dependencies** — relying on observers being called in a specific order is brittle. If order matters, you've designed the coupling wrong; consider a single orchestrator instead.

**Circular update loops** — Observer A updates on change → triggers another change → notifies A again → infinite recursion. Add a guard flag or ensure state changes don't re-trigger the same event.

---

## Interview Q&A

**Q: Walk me through the weather station example.**  
`WeatherStation` (subject) holds temperature/humidity. `PhoneDisplay` and `WebDisplay` are observers. When `station.set_temperature(25)` is called, it calls `notify()`, which calls `update(self)` on every observer. Each display reads what it needs from the station (pull model) or receives data in the call (push model).

**Q: How is Observer different from Mediator?**  
Observer is one-to-many: one subject, many observers, one direction. Mediator is many-to-many: multiple colleagues communicate *through* the mediator in both directions. Use Observer when one event source fans out; use Mediator when objects need to coordinate with each other.

**Q: How do you handle observer cleanup?**  
Use Python `weakref` so the subject doesn't prevent garbage collection of dead observers. Or implement a context manager / `__del__` that auto-unsubscribes.

---

## Key Takeaways

- Subject broadcasts to all observers — neither side knows the other's concrete type
- Always iterate over a **copy** of the observer list during notification to avoid mutation bugs
- Detach observers when they're done; use weak references on long-lived subjects to prevent memory leaks
- Push = data in notification call; Pull = observers query the subject — hybrid is usually right
