# Abstract Factory Pattern

> **Source:** https://layrs.me/course/lld/04-design-patterns/abstract-factory
> **Level:** Intermediate | **Read:** ~12 min | **Category:** Creational

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Abstract Factory** | A factory that creates *families* of related objects |
| **Product family** | A group of objects that must be used together (e.g., Windows Button + Windows Checkbox) |
| **Concrete Factory** | One factory per variant (WindowsFactory, MacFactory) |
| **vs. Factory Method** | Factory Method: one product type, subclasses decide. Abstract Factory: multiple product types, one factory creates them all as a matching set |
| **Key guarantee** | Products from the same factory are always compatible with each other |

---

## The Analogy

A furniture store sells "Modern" and "Victorian" collections. Each collection has a matching Chair, Table, and Sofa. You don't mix a Victorian sofa with a Modern table — they'd clash. The collection *is* the Abstract Factory: one factory, a whole matching set of products.

---

## Why This Matters in Interviews

- "Design a cross-platform UI library / support multiple database backends / payment providers with multiple components" → Abstract Factory
- Signal: "I'd use Abstract Factory to ensure all components come from the same family — a PostgreSQL QueryBuilder and MySQL Connection should never be mixed"
- Shows: you recognise *compatibility constraints* between objects, not just object creation

> **Red flags:** Confusing with Factory Method (key difference: one product vs. a family); not knowing when adding a new product type requires changing all factories

---

## The Core Concept

The problem it solves: Factory Method handles one type of product. But sometimes you need several objects that *must work together* — a UI Button and a UI Checkbox for the same theme, or a DB Connection and a QueryBuilder for the same database. Mixing them (Windows Button + macOS Checkbox) breaks consistency.

Abstract Factory guarantees consistency by grouping creation: one factory, one family.

```python
from abc import ABC, abstractmethod

# Two products that must match
class Button(ABC):
    @abstractmethod
    def render(self): pass

class Checkbox(ABC):
    @abstractmethod
    def render(self): pass

# Abstract Factory — creates both products
class GUIFactory(ABC):
    @abstractmethod
    def create_button(self) -> Button: pass
    @abstractmethod
    def create_checkbox(self) -> Checkbox: pass

# Windows family
class WindowsButton(Button):
    def render(self): return "Windows button (square corners)"

class WindowsCheckbox(Checkbox):
    def render(self): return "Windows checkbox (square box)"

class WindowsFactory(GUIFactory):
    def create_button(self): return WindowsButton()
    def create_checkbox(self): return WindowsCheckbox()

# macOS family (same structure, different products)
class MacFactory(GUIFactory):
    def create_button(self): return MacButton()
    def create_checkbox(self): return MacCheckbox()

# Client — only ever talks to GUIFactory; never imports WindowsButton or MacButton
class Application:
    def __init__(self, factory: GUIFactory):
        self.button = factory.create_button()
        self.checkbox = factory.create_checkbox()
    
    def render(self):
        print(self.button.render())
        print(self.checkbox.render())
```

Swap the entire theme by swapping the factory. The Application class has zero knowledge of Windows vs. macOS.

---

## When to Use / When NOT to Use

**Use when:** you have multiple *families* of related products, each family must stay internally consistent, and you want to switch between families easily.

**Don't use when:** you only have one product type (use Factory Method instead). Abstract Factory adds significant structure — if you're not enforcing family consistency, the complexity isn't worth it.

**The key trade-off:** Adding a new *variant* (e.g., LinuxFactory) is easy — add a new class. But adding a new *product type* (e.g., Slider) requires updating *every* factory interface and implementation. Plan your product types upfront.

---

## Common Mistakes

**1. Using Abstract Factory when you only have one product type**
That's Factory Method's job. Abstract Factory is specifically for enforcing *compatibility across multiple product types*.

**2. Client code directly instantiating concrete products**
```python
self.button = factory.create_button()
self.checkbox = MacCheckbox()   # WRONG — breaks family consistency
```
All products must come from the factory.

**3. Returning concrete types from factory methods**
```python
def create_button(self) -> WindowsButton:   # Too specific
```
Always return the abstract type (`Button`) so client code doesn't depend on the concrete class.

---

## Interview Q&A (Quick Fire)

**Q: What's the difference between Abstract Factory and Factory Method?**
> "Factory Method creates one product type and subclasses decide which variant to instantiate. Abstract Factory creates a *family* of related products — multiple types that must be compatible. If I need to vary just the Notification type, Factory Method. If I need matching Notification + Validator + Logger for each region, Abstract Factory."

**Q: When would you use this in a real system?**
> "Database access layers: PostgreSQL and MySQL each need a compatible Connection *and* QueryBuilder. Mixing them would break. An `AbstractDatabaseFactory` with `create_connection()` and `create_query_builder()` guarantees the pair always matches. The application layer depends only on the abstract factory interface."

**Q: What's the main drawback?**
> "Adding a new product type — say, adding `TransactionManager` to the database factory — requires changing the abstract factory interface and every concrete factory. It violates OCP for product types. The pattern is rigid in that dimension, so you should plan your product families carefully upfront."

---

## Key Takeaways

- Abstract Factory = **interface for creating families** of compatible objects — one factory, a whole matching set
- The key differentiator from Factory Method: **multiple product types** that must stay consistent with each other
- Client code depends only on abstract interfaces — never on concrete products
- Easy to add new **variants** (new factory = new family); hard to add new **product types** (changes all factories)
