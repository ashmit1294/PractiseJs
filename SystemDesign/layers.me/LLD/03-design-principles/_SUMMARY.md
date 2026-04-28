# Module 3 — Design Principles: Summary

> **Module**: 03 — Design Principles  
> **Topics**: 12 | **Folder**: `03-design-principles/`

---

## Quick Reference — All 12 Principles

| # | Principle | One-liner | Violation Signal |
|---|---|---|---|
| 01 | **DRY** | Don't Repeat Yourself | Copy-paste logic that must stay in sync |
| 02 | **YAGNI** | Don't build features until needed | Dead code, `TODO: for future use` |
| 03 | **KISS** | Prefer simple over clever | No one understands it in 6 months |
| 04 | **SRP** | One class = one reason to change | Class changes for 2+ stakeholder reasons |
| 05 | **OCP** | Open for extension, closed for modification | Adding feature requires editing existing code |
| 06 | **LSP** | Subclasses must be substitutable for their base | Override that raises `NotImplementedError` |
| 07 | **ISP** | No client should depend on methods it doesn't use | Interface with unrelated methods, empty impls |
| 08 | **DIP** | Depend on abstractions, not concretions | `new ConcreteClass()` inside high-level module |
| 09 | **Composition** | Prefer composition over inheritance | Deep `is-a` chains for code reuse |
| 10 | **LoD** | Only talk to immediate friends | `obj.getA().getB().doSomething()` train wreck |
| 11 | **Cohesion/Coupling** | High cohesion + low coupling | God class; `new MySQLDatabase()` inline |
| 12 | **Thread Safety** | Protect shared mutable state | `count += 1` without a lock |

---

## Groupings

### Code Quality Principles (01–03)
| Principle | Core Rule |
|---|---|
| **DRY** | Extract shared logic into one authoritative source |
| **YAGNI** | Delete/skip code that has no current user |
| **KISS** | Choose the simplest design that works |

> Shared theme: **discipline** — resist the temptation to over-abstract, over-engineer, or copy-paste

### SOLID Principles (04–08)
| Letter | Name | Core Rule |
|---|---|---|
| **S** | SRP | One reason to change |
| **O** | OCP | Add via extension, not modification |
| **L** | LSP | Subtypes must honour the base contract |
| **I** | ISP | Split fat interfaces; clients see only what they need |
| **D** | DIP | High-level modules drive; depend on abstractions |

> Shared theme: **change management** — SOLID makes adding features safe and predictable

### Structural Principles (09–11)
| Principle | Core Rule |
|---|---|
| **Composition over Inheritance** | Assemble behaviour via has-a, not is-a |
| **Law of Demeter** | Navigate no further than your direct friends |
| **Cohesion and Coupling** | Focused classes; abstract dependencies |

> Shared theme: **architecture** — how classes relate and how knowledge flows between them

### Concurrency Principle (12)
| Principle | Core Rule |
|---|---|
| **Thread Safety** | Immutability > locks > atomic; protect all access paths |

---

## How the Principles Reinforce Each Other

```
SRP → high cohesion → fewer reasons for two classes to be coupled
DIP → loose coupling → testability → safe refactoring
OCP + LSP → extensibility without breaking existing code
ISP → lean interfaces → easier to satisfy LSP
LoD → loose coupling (structural) → reinforces DIP
Composition → replaces fragile inheritance hierarchies (reinforces LSP)
DRY → single source of truth → easier to satisfy SRP
Thread Safety → final shield when shared state is unavoidable
```

---

## Interview Meta-Patterns

### Recognising Violations (common interview question format: "What's wrong with this code?")

| You see | Principle violated |
|---|---|
| Class with 3+ unrelated method groups | SRP / Cohesion |
| `if isinstance(obj, SubclassA):` in client code | LSP / OCP |
| `class MyService implements BigInterface` with empty methods | ISP |
| `self.db = MySQLDatabase()` inside a business class | DIP / Coupling |
| `obj.getA().getB().doC()` | Law of Demeter |
| Same logic in 3 places | DRY |
| `count += 1` shared across threads | Thread Safety |

### Fix Vocabulary

- "I'd apply SRP and extract..." 
- "I'd use the Strategy pattern to make this OCP-compliant..."
- "I'd inject an abstraction so this satisfies DIP..."
- "I'd narrow this interface to respect ISP..."
- "I'd replace the inheritance chain with composition..."
- "I'd add a lock or make this class immutable to ensure thread safety..."

---

## Key Takeaways for the Module

1. **DRY/YAGNI/KISS** = the baseline habits — get these right before any architecture
2. **SOLID** = the canonical framework for OOP design — know all five by name and give a one-sentence explanation + code example for each
3. **Composition over Inheritance** = the practical alternative when `is-a` relationships are forced
4. **LoD + Cohesion/Coupling** = the coupling metrics — high cohesion and low coupling are the measurable goals that all other principles aim at
5. **Thread Safety** = context-dependent — mention it proactively in system design when shared state exists
