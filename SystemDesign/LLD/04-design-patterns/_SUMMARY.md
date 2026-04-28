# Module 04 — Design Patterns: Summary

## Pattern Map

| # | Pattern | Category | Problem Solved | Key Mechanism |
|---|---|---|---|---|
| 01 | Singleton | Creational | Ensure one instance globally | Private constructor + class-level instance |
| 02 | Factory Method | Creational | Decouple object creation from usage | Subclass decides which class to instantiate |
| 03 | Abstract Factory | Creational | Create families of related objects | Factory of factories; swap entire families |
| 04 | Builder | Creational | Construct complex objects step-by-step | Director + Builder + method chaining |
| 05 | Prototype | Creational | Clone expensive-to-create objects | `copy.deepcopy()` / `__copy__` |
| 06 | Adapter | Structural | Incompatible interface compatibility | Wrapper that translates calls |
| 07 | Bridge | Structural | Decouple abstraction from implementation | Composition instead of inheritance |
| 08 | Composite | Structural | Treat individual items and groups uniformly | Recursive tree; leaf + composite share interface |
| 09 | Decorator | Structural | Add behaviour without subclassing | Wraps component; forwards + extends |
| 10 | Facade | Structural | Simplify complex subsystem access | Single unified interface to subsystem |
| 11 | Flyweight | Structural | Share fine-grained objects to save memory | Intrinsic (shared) vs extrinsic (contextual) state |
| 12 | Proxy | Structural | Controlled access / lazy load / caching | Stand-in object with same interface |
| 13 | Iterator | Behavioural | Traverse collections without exposing internals | `__iter__` / `__next__` / `StopIteration` |
| 14 | Observer | Behavioural | Notify dependents of state changes | Subject broadcasts; observers register/deregister |
| 15 | Strategy | Behavioural | Swap algorithms at runtime | Inject strategy; context delegates entirely |
| 16 | Command | Behavioural | Encapsulate requests with undo/queue lifecycle | Execute + Undo + history stack |
| 17 | State | Behavioural | Behaviour changes with internal state | States self-transition via context reference |
| 18 | Template Method | Behavioural | Fixed algorithm skeleton, variable steps | Abstract steps + optional hooks; parent controls flow |
| 19 | Visitor | Behavioural | Add operations to stable hierarchy | Double dispatch: element.accept → visitor.visit_type |
| 20 | Mediator | Behavioural | Reduce many-to-many coupling | All communication through central mediator |
| 21 | Memento | Behavioural | Undo/redo without breaking encapsulation | Originator creates opaque snapshot; Caretaker stores |
| 22 | Chain of Responsibility | Behavioural | Route request through handlers | Each handler processes or forwards; set_next chaining |
| 23 | Interpreter | Behavioural | Evaluate custom grammar/DSL | Terminal + Non-terminal expression tree; recursive interpret |

---

## Category Quick Reference

### Creational (01–05) — *How objects are created*
- **Singleton**: one instance, global access — use sparingly (hidden coupling, testability issues)
- **Factory Method**: subclass decides the concrete type — use when you don't know upfront
- **Abstract Factory**: coordinated families of objects — swap product families as a unit
- **Builder**: incremental construction with validation — use for objects with many optional parts
- **Prototype**: clone existing objects — use when construction is expensive or complex

### Structural (06–12) — *How objects are composed*
- **Adapter**: make incompatible interfaces work together — classic legacy integration pattern
- **Bridge**: decouple abstraction from implementation — grow independently along two axes
- **Composite**: recursive tree of uniform components — file systems, UI widget hierarchies
- **Decorator**: stack behaviours at runtime — Python's `@decorator` syntax is this pattern
- **Facade**: hide subsystem complexity behind one entry point — don't couple clients to internals
- **Flyweight**: share immutable state across many instances — character glyphs, game sprites
- **Proxy**: controlled access with same interface — lazy load, caching, access control, logging

### Behavioural (13–23) — *How objects communicate*
- **Iterator**: uniform traversal of any collection — know `__iter__`/`__next__`/`StopIteration`
- **Observer**: one event, many listeners — avoid order dependencies and memory leaks
- **Strategy**: pluggable algorithms — eliminates if/else chains; inject via DI
- **Command**: request as object — enables undo, queuing, auditing; snapshot before execute
- **State**: state-driven behaviour — states self-transition; no conditionals in context
- **Template Method**: fixed skeleton, variable steps — hooks for optional customisation
- **Visitor**: operations over stable hierarchy — double dispatch; easy to add ops, hard to add types
- **Mediator**: central communication hub — reduces O(n²) coupling to O(n); don't let it become a god object
- **Memento**: opaque state snapshot — caretaker stores but never reads; bound history size
- **Chain of Responsibility**: sequential handler routing — always guard for null next; add DefaultHandler
- **Interpreter**: grammar as class hierarchy — only for simple grammars; separate parsing from evaluation

---

## Critical Confusions to Clear in Interviews

| Pair | How to Distinguish |
|---|---|
| Factory Method vs Abstract Factory | FM: one product type, subclass decides. AF: multiple coordinated product types |
| Decorator vs Proxy | Decorator adds behaviour (same interface, extended). Proxy controls access (same interface, gating) |
| Strategy vs State | Strategy: client picks, strategies independent. State: object auto-transitions, states reference each other |
| Strategy vs Template Method | Strategy: composition, runtime swap. Template Method: inheritance, compile-time skeleton |
| Observer vs Mediator | Observer: one-to-many, one source. Mediator: many-to-many, bidirectional coordination |
| Chain of Responsibility vs Decorator | CoR: ONE handler processes (routing). Decorator: ALL wrappers execute (additive) |
| Visitor vs Interpreter | Visitor: multiple ops over stable structure. Interpreter: one op (evaluate) over a grammar tree |
| Command vs Memento | Command: undo by reversing operations. Memento: undo by restoring full state snapshot |
| Facade vs Mediator | Facade: simplify subsystem access (subsystem unaware). Mediator: coordinate peers (colleagues know mediator) |

---

## Principles Underpinning All Patterns

| Principle | Patterns That Embody It |
|---|---|
| Open/Closed | Strategy, Visitor, Decorator, Observer |
| Single Responsibility | Command (separate invoker from receiver), Mediator (separate coordination from colleagues) |
| Dependency Inversion | Factory, Abstract Factory, Strategy (depend on abstractions) |
| Composition over Inheritance | Strategy, Bridge, Decorator, Composite |
| Encapsulation | Memento (state encapsulated in originator), Facade (subsystem encapsulated) |
| Hollywood Principle ("don't call us") | Template Method (parent calls subclass steps) |

---

## Interview Cheat Sheet

**"When would you use X?"** — state the problem it solves, not just the pattern name.

**Common scenarios:**
- Undo/Redo → Command (operation-level) or Memento (state-level)
- Plugin system → Strategy or Factory
- Event system → Observer
- Request pipeline / middleware → Chain of Responsibility
- Complex object construction → Builder
- UI widget hierarchy → Composite + Decorator
- Legacy API integration → Adapter
- Cross-platform implementation → Bridge
- Controlled resource access → Proxy
- DSL / rule engine → Interpreter
- Stable class hierarchy, changing operations → Visitor
- Many objects tightly coupled → Mediator
