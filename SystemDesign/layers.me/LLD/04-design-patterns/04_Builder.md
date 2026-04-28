# Builder Pattern

> **Source:** https://layrs.me/course/lld/04-design-patterns/builder
> **Level:** Beginner | **Read:** ~10 min | **Category:** Creational

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Builder** | Step-by-step construction of a complex object |
| **Method chaining** | Each setter returns `self`, so you can chain calls: `.setA().setB().build()` |
| **Product** | The final object being built — ideally immutable once created |
| **Director** | Optional: a class that knows a common construction sequence |
| **vs. Factory** | Factory: creates objects in one step. Builder: constructs step-by-step, with validation before final assembly |

---

## The Analogy

A restaurant order: you tell the waiter "burger, no pickles, extra cheese, large fries, Coke" — step by step. The waiter (Builder) assembles everything. You get the final meal (Product) only when you say "that's it". You can't get a half-assembled burger mid-order.

---

## Why This Matters in Interviews

- "Design a SQL query builder / HTTP request builder / report generator with many optional fields" → Builder
- Signal: "I'd use Builder here — the object has 8+ parameters, most are optional, and I want to validate the combination before constructing it"
- Shows: you recognise the telescoping constructor problem and know when to solve it

> **Red flags:** Using Builder for 2-parameter objects (overkill); forgetting `return self` in setter methods; not adding validation in `build()`

---

## The Core Concept

The problem it solves: you have an object with many optional parameters. A constructor with 8 arguments is unreadable (`House("concrete", "wood", "tiles", 10, 3, True, False, True)` — what does `False` mean?). Setters leave the object in inconsistent intermediate states.

Builder collects configuration step-by-step, then assembles the object in one validated `build()` call.

```python
class SQLQuery:
    def __init__(self, select, from_table, where=None, order_by=None, limit=None):
        self.select = select
        self.from_table = from_table
        self.where = where
        self.order_by = order_by
        self.limit = limit

class SQLQueryBuilder:
    def __init__(self): self._select = []; self._from = None; self._where = []; self._limit = None
    
    def select(self, *cols): self._select.extend(cols); return self    # return self enables chaining
    def from_table(self, t): self._from = t; return self
    def where(self, cond): self._where.append(cond); return self
    def limit(self, n): self._limit = n; return self
    
    def build(self):
        if not self._select: raise ValueError("SELECT required")
        if not self._from: raise ValueError("FROM required")
        return SQLQuery(self._select, self._from, self._where or None, limit=self._limit)

# Readable, validated, flexible
query = (SQLQueryBuilder()
    .select('id', 'name')
    .from_table('users')
    .where('age > 18')
    .limit(10)
    .build())
```

Compare this to `SQLQuery(['id','name'], 'users', ['age > 18'], None, 10)` — the Builder version is self-documenting.

**Optional: Director**

If you create the same configurations repeatedly, a Director wraps common sequences:
```python
class ComputerDirector:
    def __init__(self, builder): self._b = builder
    def gaming_pc(self): return self._b.cpu("i9").ram(32).gpu("RTX 4090").build()
    def office_pc(self): return self._b.cpu("i5").ram(8).build()
```

---

## When to Use / When NOT to Use

**Use when:** 4+ parameters, especially with many optional ones; complex validation before construction; you want the final object to be immutable.

**Don't use when:** the object has 2–3 parameters — a regular constructor or `dataclass` is simpler and clearer. Builder adds a whole extra class for no gain.

---

## Common Mistakes

**1. Forgetting `return self`**
Every setter must return `self` to enable chaining. Forgetting it breaks the fluent interface mid-chain with an `AttributeError`.

**2. No validation in `build()`**
Without validation, `builder.build()` with no fields set creates a broken object. Always check required fields before constructing.

**3. Reusing builder instances**
```python
builder = QueryBuilder()
q1 = builder.select('id').from_table('users').build()
q2 = builder.from_table('orders').build()  # Still has select='id' from q1!
```
Create a new builder for each object, or add a `reset()` method that reinitialises state.

**4. Making the product mutable after `build()`**
The whole point of Builder is controlled construction. If the product has public setters, clients bypass the builder's validation. Use `@dataclass(frozen=True)` or properties without setters.

---

## Interview Q&A (Quick Fire)

**Q: How is Builder different from Factory?**
> "Factory creates objects in one step — it decides *which* class to instantiate. Builder constructs complex objects *step-by-step*, assembling parts progressively and validating before the final `build()`. Use Factory when type selection is the concern; use Builder when construction complexity and optional configuration is the concern."

**Q: When would you use the Director?**
> "When certain construction sequences are repeated — like always building a 'gaming PC' or 'office PC' with the same specs. The Director encapsulates those common recipes. Without it, those sequences would be duplicated everywhere the builder is used."

**Q: How do you handle required vs. optional fields?**
> "Validate required fields in `build()` and raise a `ValueError` if they're missing. Truly required fields can also go in the Builder's constructor to force them upfront — the optional ones get their own setter methods."

---

## Key Takeaways

- Builder solves the **telescoping constructor** problem — many parameters become readable chained calls
- Always `return self` from setters; always **validate** in `build()`
- The Product should be **immutable** once built — Builder provides the controlled window for setting it up
- Use it for **4+ parameters or complex validation**; a plain constructor is cleaner for simple objects
