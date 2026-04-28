# Factory Method Pattern

> **Source:** https://layrs.me/course/lld/04-design-patterns/factory-method
> **Level:** Beginner | **Read:** ~12 min | **Category:** Creational

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Factory Method** | A method that creates objects — subclasses decide *which* object to create |
| **Product** | The interface that all created objects implement |
| **Creator** | The abstract class that declares the factory method |
| **Concrete Creator** | Subclass that overrides the factory method to return a specific product |
| **vs. Simple Factory** | Simple Factory uses `if/elif` — Factory Method uses inheritance |

---

## The Analogy

A logistics company uses `createTransport()` to plan deliveries. Road logistics creates Trucks; sea logistics creates Ships. Both trucks and ships are "Transport" — the planning code doesn't care which, it just calls `transport.deliver()`.

---

## Why This Matters in Interviews

- "Design a notification system (Email / SMS / Push)" → factory method for creating the right notifier
- Signal: "I'd use Factory Method to decouple the creation of notifiers from the sending logic — new channels only add a new subclass, no existing code changes"
- Shows: you understand OCP and DIP in a concrete pattern

> **Red flags:** Confusing Factory Method with Simple Factory (`if type == 'A': return A()`); overusing it for simple construction

---

## The Core Concept

The problem it solves: you write code that creates objects, but you want to add new types later without changing that code. Direct instantiation (`product = ConcreteProduct()`) hardwires you to that class.

Factory Method breaks the dependency: the client calls an abstract `create_product()` method. Subclasses override it to return the right concrete type. The client works only with the Product interface — it never imports a concrete class.

**Structure in 20 lines:**
```python
from abc import ABC, abstractmethod

class Notification(ABC):              # Product interface
    @abstractmethod
    def send(self, message): pass

class EmailNotification(Notification):
    def send(self, message): print(f"Email: {message}")

class SMSNotification(Notification):
    def send(self, message): print(f"SMS: {message}")

class NotificationService(ABC):       # Creator
    @abstractmethod
    def create_notification(self) -> Notification: pass   # Factory method
    
    def notify(self, message):        # Uses the factory method — never touches concrete classes
        n = self.create_notification()
        n.send(message)

class EmailService(NotificationService):              # Concrete creator
    def create_notification(self): return EmailNotification()

class SMSService(NotificationService):
    def create_notification(self): return SMSNotification()
```

Adding `PushNotification` later? Create `PushNotification` and `PushService`. Zero changes to existing code.

---

## When to Use / When NOT to Use

**Use when:** you have multiple types of objects that share an interface; you expect to add new types frequently; you want to decouple creation from usage.

**Don't use when:** you only ever create one type — Factory Method adds two extra classes (Creator + ConcreteCreator) for no benefit. A simple constructor is clearer.

---

## Common Mistakes

**1. Confusing it with Simple Factory**
Simple Factory is a single class with `if/elif` to pick a type. Factory Method uses inheritance — each subclass decides what to create. Simple Factory violates OCP (you modify it to add types); Factory Method doesn't.

**2. Putting logic in the factory method**
The factory method should only instantiate and return. Configuration, validation, and business logic belong in the calling code or in a separate method.

**3. Casting the product back to a concrete type**
```python
doc = app.create_document()
if isinstance(doc, PDFDocument):   # defeats the whole point
    doc.set_compression(9)
```
If you need type-specific behavior, add it to the Product interface or switch to Strategy.

**4. Making the creator concrete when it should be abstract**
If clients can instantiate the creator directly, they bypass the factory method's purpose.

---

## Interview Q&A (Quick Fire)

**Q: How is Factory Method different from Simple Factory?**
> "Simple Factory uses a single method with conditional logic — you modify it to add new types, which violates OCP. Factory Method uses inheritance — each concrete creator subclass decides what to create. Adding a new type means adding a new subclass, never modifying existing code."

**Q: How is Factory Method different from Abstract Factory?**
> "Factory Method creates one type of product — the subclass decides which variant. Abstract Factory creates *families* of related products (e.g., a factory that creates matching Button + Checkbox + TextField for one UI theme). If I only need to vary one product type, Factory Method. If I need multiple compatible products together, Abstract Factory."

**Q: How does this relate to SOLID?**
> "It directly implements OCP — open to new product types via new subclasses, closed to modification. And DIP — the client depends on the abstract Product interface, not any concrete class."

---

## Key Takeaways

- Factory Method = define *an interface* for creating an object, but let subclasses decide *which class* to instantiate
- The key structural difference from Simple Factory: **no `if/elif`** — polymorphism replaces conditionals
- Use it when you expect new types to be added and want to add them without modifying existing code
- Keep factory methods simple: instantiate and return, nothing more
