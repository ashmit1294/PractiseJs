# Facade Pattern

> **Source:** https://layrs.me/course/lld/04-design-patterns/facade
> **Level:** Beginner | **Read:** ~8 min | **Category:** Structural

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Facade** | A single front door to a complex subsystem — you knock once, it handles everything inside |
| **Subsystem** | The multiple classes behind the facade that do the actual work |
| **Thin layer** | Facade coordinates, it doesn't add business logic |
| **Optional** | Clients can still access subsystem classes directly if they need advanced features |
| **vs. Adapter** | Adapter makes *one* incompatible class fit. Facade simplifies *many* complex classes into one interface |

---

## The Analogy

A hotel concierge: you ask "can you arrange a dinner reservation, airport transfer, and theatre tickets?" They handle the 6 phone calls, the booking systems, the confirmations. You made one request; they coordinated everything behind the scenes.

---

## Why This Matters in Interviews

- "How would you simplify the checkout flow in an e-commerce system?" → `CheckoutFacade` coordinating inventory, payment, shipping, notifications
- Signal: "I'd create a Facade that orchestrates all four subsystems — the client just calls `facade.complete_order(cart)`"
- Shows: you think about layered architecture and API design, not just class structure

> **Red flags:** Adding business logic (discount calculation, pricing rules) to the Facade — it should only coordinate; creating a "god facade" that handles unrelated subsystems; using Facade when the subsystem is already simple

---

## The Core Concept

The problem it solves: complex subsystems have many interdependent components with specific initialization orders, state sequences, and error handling. Without a facade, every piece of client code must know all of this. With one, clients call one method and the Facade sequences the underlying calls.

```python
# Complex subsystem — 4 classes, specific sequence needed
class Inventory:
    def reserve(self, item_id): print(f"Reserved: {item_id}")
    def release(self, item_id): print(f"Released: {item_id}")

class PaymentGateway:
    def charge(self, amount): print(f"Charged: ${amount}"); return "txn_123"

class ShippingService:
    def create_label(self, address): print(f"Label for: {address}")

class EmailService:
    def send_confirmation(self, email, txn): print(f"Confirmation → {email}: {txn}")

# Facade — one clean entry point
class CheckoutFacade:
    def __init__(self):
        self._inventory = Inventory()
        self._payment = PaymentGateway()
        self._shipping = ShippingService()
        self._email = EmailService()
    
    def complete_order(self, item_id, amount, address, email):
        """Client calls this one method — Facade handles the rest"""
        self._inventory.reserve(item_id)
        txn = self._payment.charge(amount)
        self._shipping.create_label(address)
        self._email.send_confirmation(email, txn)
        return txn

# Client code — zero knowledge of the four subsystems
checkout = CheckoutFacade()
checkout.complete_order("SKU-001", 49.99, "123 Main St", "user@email.com")
```

---

## When to Use / When NOT to Use

**Use when:** you have a complex subsystem that most clients only interact with in a small number of standard ways; when clients must understand too many classes just to do one thing; when you want to isolate changes in the subsystem from client code.

**Don't use when:** the subsystem is already simple (adds unnecessary indirection); when clients need fine-grained control over individual subsystem components; when it would become a god object.

---

## Common Mistakes

**1. Putting business logic in the Facade**
```python
def complete_order(self, items, user):
    discount = 0.15 if len(items) > 10 else 0.0   # WRONG — business logic in facade
```
Facade coordinates, it doesn't decide. Move business rules to a service class.

**2. Creating a god Facade**
One facade handling emails, payments, reports, user management, and file uploads has too many reasons to change. Create focused facades — `CheckoutFacade`, `ReportingFacade`, `UserFacade`.

**3. Blocking direct subsystem access**
The facade is a convenience, not a gate. Clients who need advanced features should be able to use subsystem classes directly.

---

## Interview Q&A (Quick Fire)

**Q: How is Facade different from Adapter?**
> "Adapter converts one incompatible interface to another — typically wrapping a single class. Facade provides a simplified interface to a complex system of many classes. Adapter is about compatibility; Facade is about simplicity."

**Q: How is Facade different from Mediator?**
> "Facade is one-directional: clients talk to the Facade, Facade talks to subsystems. The subsystems don't know about the Facade. Mediator is bidirectional: colleague objects communicate *through* the Mediator, which knows about all of them and can coordinate two-way."

**Q: Real-world examples of the Facade pattern?**
> "Python's `requests` library is a Facade over `urllib3` and HTTP internals. Django's ORM is a Facade over raw SQL. Stripe's SDK is a Facade over their REST API — instead of building HTTP requests yourself, you call `stripe.charge.create()`."

---

## Key Takeaways

- Facade = **one simple entry point** to a complex subsystem — reduces cognitive load for clients
- Keep it **thin**: coordinate subsystem calls, pass data between them, handle errors — no business logic
- Create **multiple focused facades** rather than one god object
- The Facade should be **optional** — direct subsystem access remains possible for advanced use
