# 23 — Interpreter Pattern

## TL;DR

| Question | Answer |
|---|---|
| What | Define a grammar as a class hierarchy; interpret sentences via recursive AST evaluation |
| Why | Structured, extensible way to evaluate custom expressions or DSLs |
| Key mechanism | Terminal = leaf (value), Non-terminal = node (operator containing sub-expressions) |
| Heavy use of | Composite Pattern — non-terminals are composites of other expressions |
| When NOT | Complex grammars (20+ rules) — use a parser generator (ANTLR, PLY) instead |

---

## The Analogy

A **calculator's parse tree**: the expression `(5 + 3) * 2` becomes a tree where `*` is the root, `+` is its left child, and `2` is its right child. Each node knows how to evaluate itself — the multiplication node multiplies the results of evaluating its children. This is exactly what Interpreter formalises.

---

## Core Concept

Every grammar rule becomes a class. **Terminal expressions** are leaf nodes that hold a concrete value (a number, a variable name). **Non-terminal expressions** are inner nodes that hold references to sub-expressions and combine their results (addition, AND, NOT). Interpretation is recursive: call `interpret(context)` on the root, and it cascades down the tree until all terminals return their values.

The Context carries variable bindings or other shared state needed during interpretation.

```python
from abc import ABC, abstractmethod

class Expr(ABC):
    @abstractmethod
    def interpret(self, ctx): pass

class Number(Expr):                     # Terminal
    def __init__(self, v): self.v = v
    def interpret(self, ctx): return self.v

class Add(Expr):                        # Non-terminal
    def __init__(self, l, r): self.l, self.r = l, r
    def interpret(self, ctx): return self.l.interpret(ctx) + self.r.interpret(ctx)

class Multiply(Expr):                   # Non-terminal
    def __init__(self, l, r): self.l, self.r = l, r
    def interpret(self, ctx): return self.l.interpret(ctx) * self.r.interpret(ctx)

# (5 + 3) * 2
expr = Multiply(Add(Number(5), Number(3)), Number(2))
print(expr.interpret({}))   # 16
```

Adding a new operator (e.g., `Subtract`, `Divide`) = new class only — existing classes untouched.

---

## When to Use / When NOT to Use

**Use when:**
- Simple, stable grammar (fewer than ~20 rules) — calculators, rule engines, config parsers
- The language needs to be extensible by adding new operations as new classes
- You're building a DSL where business rules are expressed in a readable format

**Avoid when:**
- Grammar is complex — class-per-rule creates a class explosion and poor performance
- Grammar changes frequently — restructuring the AST class hierarchy is expensive
- Performance is critical — recursive method calls on large trees are slow; compiled interpreters are faster

---

## Common Mistakes

**Using Interpreter for complex grammars** — each grammar rule needs a class; 50 rules = 50 classes + a fragile class hierarchy. For production languages use ANTLR, PLY, or lark-parser. The pattern is for *simple, internal* DSLs only.

**Ignoring operator precedence** — building `Add(Number(2), Multiply(Number(3), Number(4)))` for "2 + 3 * 4" requires a parser that respects precedence. The pattern provides *evaluation*; building the AST correctly is a separate parsing concern.

**Mixing parsing and interpretation** — expression classes should only evaluate, not parse strings. Use a dedicated parser (recursive descent, shunting-yard) to build the AST; expression classes call `interpret()` only.

**Global state in context** — using module-level globals instead of passing a context object makes expressions non-reentrant and impossible to test in isolation. Always pass context as a parameter.

**No `__str__` on expressions** — when the interpreter produces wrong results, you need to visualise the AST. Implement `__repr__`/`__str__` on every expression class for debugging.

---

## Interview Q&A

**Q: When would you NOT use the Interpreter Pattern?**  
Complex grammars: too many classes, poor runtime performance, hard to maintain. Frequently changing grammars: modifying class hierarchies is expensive. For anything non-trivial use a parser generator — they produce efficient parsers from grammar specs automatically.

**Q: How would you add exponentiation to the calculator?**  
Create `Power(left, right)` implementing `Expr`. Its `interpret` returns `left.interpret(ctx) ** right.interpret(ctx)`. Zero changes to existing classes — this is the Open/Closed benefit.

**Q: How is Interpreter different from Visitor?**  
Both traverse tree structures. Visitor separates *operations* from a *fixed structure* — you add new operations (visitors) without touching the structure. Interpreter *defines* the structure to represent a language grammar and each node implements its own evaluation. Interpreter = grammar evaluation; Visitor = multiple algorithms over a stable structure.

---

## Key Takeaways

- Each grammar rule = one class; Terminal = leaf value; Non-terminal = operator combining sub-expressions
- Evaluation is recursive: `interpret(ctx)` cascades from root to leaves and bubbles results back up
- **Separate parsing from interpretation** — build the AST with a dedicated parser; expression classes only evaluate
- Use only for simple, stable grammars; for anything complex, use a parser generator like ANTLR or lark
