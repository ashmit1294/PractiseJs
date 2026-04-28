# 19 — Visitor Pattern

## TL;DR

| Question | Answer |
|---|---|
| What | Separate algorithms from object structure — add operations without modifying classes |
| Why | Open/Closed for operations: add visitors freely; stable element hierarchy |
| Double dispatch | `element.accept(visitor)` → `visitor.visit_specific_type(self)` — two steps ensure correct method |
| Key trade-off | Easy to add operations; hard to add new element types (all visitors must update) |
| When NOT | Object hierarchy changes frequently — every new element type breaks all existing visitors |

---

## The Analogy

A **tax auditor visiting different business units**: the auditor (visitor) applies different rules to a restaurant, a factory, and a software firm (elements). The businesses don't implement tax logic; the auditor brings it. To audit differently for next year, you bring a new auditor — not rewrite all the businesses.

---

## Core Concept

Visitor solves: *stable class hierarchy, frequently changing operations*. Without it, adding a new export format (HTML, Markdown, PDF) to a document model means adding a method to every element class. With Visitor, each export format is a separate visitor class; element classes only expose `accept(visitor)`.

**Double dispatch** is the mechanism: Python's single-dispatch would call the same `visit()` for every element type. Instead, `element.accept(visitor)` lets the *element* call back with its specific type: `visitor.visit_paragraph(self)`. Now the correct overload runs — dispatch on *both* visitor and element type.

```python
class Paragraph:
    def __init__(self, text): self.text = text
    def accept(self, visitor): return visitor.visit_paragraph(self)

class Image:
    def __init__(self, url): self.url = url
    def accept(self, visitor): return visitor.visit_image(self)

class HTMLExporter:
    def visit_paragraph(self, p): return f"<p>{p.text}</p>"
    def visit_image(self, img): return f'<img src="{img.url}"/>'

class MarkdownExporter:
    def visit_paragraph(self, p): return f"{p.text}\n"
    def visit_image(self, img): return f"![]({img.url})"

doc = [Paragraph("Hello"), Image("logo.png")]
for el in doc:
    print(el.accept(HTMLExporter()))
```

Adding a new `PDFExporter` requires only a new visitor class — no changes to `Paragraph` or `Image`.

---

## When to Use / When NOT to Use

**Use when:**
- Object hierarchy is **stable** (element types rarely change)
- You need many different, unrelated operations over that hierarchy (render, export, validate, serialize)
- You want to keep all logic for one operation together in one class

**Avoid when:**
- Element types change frequently — each new element type forces updates to every visitor
- You only have 1–2 operations — just add methods to the element classes directly
- Encapsulation matters a lot — visitors often need access to element internals

---

## Common Mistakes

**Adding new element types frequently** — this is the pattern's fatal weakness. Every new element requires updating all existing visitors. If the hierarchy is unstable, use Strategy or simple method dispatch instead.

**Breaking encapsulation** — visitors often need to access private element data. The fix: provide focused public accessor methods. Never make private fields public just for visitor access.

**No visitor interface** — without a common abstract base, visitors can't be swapped. Always define `DocumentVisitor(ABC)` with consistent method names.

**Inconsistent visit return types** — if `visit_paragraph` returns `str` and `visit_image` returns `dict`, aggregating results across the document is impossible. Keep return types consistent (or use a wrapper).

**Overusing for single operations** — if you only ever need one operation, just add a method to the element class. Visitor's complexity is only justified when multiple unrelated operations will accumulate over time.

---

## Interview Q&A

**Q: Explain double dispatch.**  
Python has single dispatch — `visitor.visit(element)` can't choose the right overload by element type at runtime. Double dispatch solves this: `element.accept(visitor)` invokes the element's `accept`, which calls back with its concrete type: `visitor.visit_paragraph(self)`. Now the correct visitor method runs, dispatched on both types.

**Q: Design a file system where you can calculate size, count files, and search patterns without modifying File/Directory.**  
`File` and `Directory` each have `accept(visitor)`. Create `SizeVisitor`, `CountVisitor`, `SearchVisitor` — each implements `visit_file()` and `visit_directory()`. Directory's `accept` recursively visits children. Adding new operations = new visitor class only.

**Q: Visitor vs Strategy?**  
Strategy encapsulates a single swappable algorithm for a context. Visitor operates on an *entire object structure* with type-specific logic for each node. Visitor is about traversing a composite; Strategy is about plugging in one algorithm.

---

## Key Takeaways

- Visitor = open/closed for operations: add new operations freely; adding new element types is painful
- Double dispatch (element calls back to visitor with `self`) is the mechanism that makes type-specific dispatch work
- Keep element hierarchies stable when using Visitor; if types change often, choose a different approach
- Always define a visitor interface; use consistent return types; provide public accessors instead of exposing private fields
