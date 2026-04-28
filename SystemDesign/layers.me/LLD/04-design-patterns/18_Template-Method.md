# 18 — Template Method Pattern

## TL;DR

| Question | Answer |
|---|---|
| What | Base class defines algorithm skeleton; subclasses fill in specific steps |
| Why | Eliminates code duplication across similar workflows; enforces consistent process |
| Hollywood Principle | "Don't call us, we'll call you" — parent controls flow, calls subclass methods |
| Hook methods | Optional steps with default (often empty) implementation; subclasses can override |
| vs Strategy | Template Method = inheritance, compile-time. Strategy = composition, runtime |

---

## The Analogy

A **testing framework lifecycle**: every test follows the same sequence — setup, execute, teardown. The framework (abstract class) defines that sequence. Your test class (subclass) only fills in what `execute()` does. The sequence itself never changes.

---

## Core Concept

When multiple classes share the same algorithm structure but differ in specific steps, the naive solution copies the shared skeleton into each class — a DRY violation waiting to explode. Template Method extracts the skeleton into an abstract base class as a non-overridable **template method**, then declares the varying steps as `abstract` methods that subclasses *must* implement, plus optional **hook methods** (concrete, with a default) that subclasses *can* override.

```python
from abc import ABC, abstractmethod

class DataProcessor(ABC):
    def process(self):              # template method — do NOT override
        data = self.read_data()
        processed = self.transform(data)
        if self.should_validate():  # hook — optional
            self.validate(processed)
        self.save(processed)

    @abstractmethod
    def read_data(self): pass

    @abstractmethod
    def transform(self, data): pass

    @abstractmethod
    def save(self, data): pass

    def should_validate(self):      # hook with sensible default
        return True

    def validate(self, data):
        print("Default validation passed")

class CSVProcessor(DataProcessor):
    def read_data(self): return "a,b,c"
    def transform(self, data): return data.upper()
    def save(self, data): print(f"CSV saved: {data}")
```

---

## When to Use / When NOT to Use

**Use when:**
- Multiple classes share the same workflow but differ in 1–3 steps
- You need to enforce a consistent process that subclasses cannot reorder
- You want to add new variants (just add a subclass) without touching the shared skeleton

**Avoid when:**
- The algorithm structure itself differs significantly between variants — use Strategy instead
- You need to swap algorithms at runtime — inheritance locks the skeleton at compile time
- The hierarchy grows too deep (3+ levels) — becomes unmaintainable; prefer composition

---

## Common Mistakes

**Making the template method overridable** — if subclasses can override the skeleton method, they can skip or reorder steps, defeating the pattern. In Java, mark it `final`; in Python, document clearly that it should not be overridden.

**Making all steps abstract** — if `validate()` and `log()` are identical in every subclass, they should be concrete in the base class. Only abstract what genuinely varies.

**Forgetting hook methods** — forcing subclasses to implement steps they don't need (`def pre_process(self): pass` repeated everywhere) is noise. Provide hooks with empty defaults for optional steps.

**Confusing with Strategy** — Template Method uses *inheritance* (fixed at class definition) and controls the flow from the parent. Strategy uses *composition* (injected at runtime) and the context just calls `strategy.execute()`. Choose Template Method when the skeleton is invariant; choose Strategy when the whole algorithm must be swappable.

---

## Interview Q&A

**Q: Design a data import system for CSV, JSON, and XML.**  
Abstract `DataImporter` with `import_data()` as template method: calls `validate_file()` (concrete), `parse_data()` (abstract), `transform_data()` (concrete), `load_to_db()` (concrete). `CSVImporter`, `JSONImporter`, `XMLImporter` each implement only `parse_data()`. Adding a new format = new subclass, zero changes to existing code.

**Q: Explain the Hollywood Principle.**  
"Don't call us, we'll call you." The parent's template method controls the flow and *calls into* subclass methods. Subclasses don't call the parent's skeleton method; the parent calls them. This inverts the typical subclass-calls-super flow.

**Q: Template Method vs Strategy — when do you choose?**  
Template Method: algorithm structure is fixed, only certain steps vary, decided at class hierarchy design time. Strategy: the entire algorithm is a pluggable policy selected at runtime. Rule of thumb — if you'd use `final` on the orchestrating method, it's Template Method; if you'd inject it as a constructor argument, it's Strategy.

---

## Key Takeaways

- Template method defines the invariant skeleton; abstract methods define the variable steps; hooks provide optional customization
- Parent controls flow (Hollywood Principle) — never let subclasses override the template method itself
- Use abstract for *required* variation; use hooks (concrete with default) for *optional* variation
- Template Method = inheritance (compile-time binding); Strategy = composition (runtime binding)
