# 22 — Chain of Responsibility

## TL;DR

| Question | Answer |
|---|---|
| What | Pass a request along a chain of handlers; each decides to handle or forward |
| Why | Decouples sender from receivers; add/remove/reorder handlers without changing client |
| Key mechanism | `set_next(handler)` returns `handler` for fluent chaining; always check next before calling |
| vs Decorator | CoR: ONE handler typically processes the request (or none). Decorator: ALL wrappers add behaviour |
| When NOT | You know exactly which object should handle — just call it directly |

---

## The Analogy

**Customer support escalation**: a question goes to the chatbot first; if unresolved, to a junior agent; then to a senior agent; then to a specialist. Each level tries to handle it; if they can't, they escalate. The customer (sender) doesn't know who will ultimately answer.

---

## Core Concept

Without Chain of Responsibility, the client contains the routing logic: `if priority == LOW: junior.handle(...)`. Every new handler type requires changing the client. CoR moves that logic into the chain itself: each handler knows only its own capability and its next handler. The client sends to the chain head and forgets.

```python
class Handler:
    def __init__(self): self._next = None

    def set_next(self, h):
        self._next = h
        return h          # enables: h1.set_next(h2).set_next(h3)

    def handle(self, request):
        if self._next:
            return self._next.handle(request)
        return None       # unhandled — consider a DefaultHandler at chain end

class LowHandler(Handler):
    def handle(self, r):
        if r["priority"] == "low":
            print(f"LowHandler: handled '{r['desc']}'")
        else:
            super().handle(r)

class HighHandler(Handler):
    def handle(self, r):
        if r["priority"] == "high":
            print(f"HighHandler: handled '{r['desc']}'")
        else:
            super().handle(r)

low = LowHandler()
high = HighHandler()
low.set_next(high)

low.handle({"priority": "low",  "desc": "reset password"})
low.handle({"priority": "high", "desc": "server down"})
```

Building the chain is done by the client once — the request-processing code never changes when you add a new handler.

---

## When to Use / When NOT to Use

**Use when:**
- Multiple objects might handle a request and the correct one is unknown upfront
- Request processing pipelines: middleware, validation chains, approval workflows
- You want to add/remove/reorder handlers at runtime without touching the client

**Avoid when:**
- The handler is always known — direct call is clearer and cheaper
- All handlers must process every request — use Observer (fan-out) instead
- The chain is very long and performance is critical — chain traversal has overhead

---

## Common Mistakes

**Forgetting to call next** — if a handler can't process the request but returns without forwarding, the request is silently dropped. Always include `if self._next: return self._next.handle(request)` in the else branch.

**Not checking next for None** — calling `self._next.handle(request)` without a None-guard crashes at the end of the chain. Always check first, or use a `DefaultHandler` as a guaranteed terminal.

**Circular chains** — `h1 → h2 → h3 → h1` causes infinite loops. Add cycle detection in development builds; document construction order clearly.

**Handlers doing too much** — a handler that validates, logs, checks permissions, and processes business logic violates SRP and makes the chain rigid. One handler, one concern.

**Silent unhandled requests** — when no handler can process, silently returning `None` or `False` makes debugging hard. Add a `DefaultHandler` at the chain end that logs warnings or raises a meaningful exception.

---

## Interview Q&A

**Q: What's the difference between Chain of Responsibility and Decorator?**  
Both form chains, but with different intent. CoR: request travels until *one* handler processes it (then usually stops). Decorator: request passes through *every* wrapper, each adding behaviour. CoR = exclusive routing; Decorator = additive wrapping.

**Q: What if no handler can process the request?**  
Three options: (1) add a `DefaultHandler` at the end that catches everything and returns a sensible fallback; (2) return `None`/`False` and let the client deal with it; (3) raise an exception if an unhandled request is an error condition. Choose based on whether "no handler" is exceptional or expected.

**Q: Design an expense approval workflow.**  
Handlers: `ManagerApprover` (up to $1,000), `DirectorApprover` (up to $10,000), `VPApprover` (up to $100,000), `DefaultApprover` (rejects over limit). Chain in ascending authority order. Client just submits expense to `manager.handle(expense)` — routing is automatic.

---

## Key Takeaways

- Each handler either processes or forwards — never silently drops a request
- `set_next()` returns the handler for fluent chaining: `h1.set_next(h2).set_next(h3)`
- Always guard `self._next` for None; add a DefaultHandler at chain end to catch unhandled requests
- CoR = one handler wins (routing); Decorator = all layers execute (wrapping) — common confusion to clarify in interviews
