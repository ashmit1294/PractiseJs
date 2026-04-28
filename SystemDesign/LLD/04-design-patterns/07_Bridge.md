# Bridge Pattern

> **Source:** https://layrs.me/course/lld/04-design-patterns/bridge
> **Level:** Intermediate | **Read:** ~12 min | **Category:** Structural

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Bridge** | Separate two dimensions of variation into two independent hierarchies, linked by composition |
| **Abstraction** | The high-level part (what the client uses) — holds a reference to the Implementor |
| **Implementor** | The low-level part (how the work is done) |
| **Class explosion** | M×N subclasses when you combine two varying dimensions via inheritance alone |
| **vs. Adapter** | Adapter fixes an existing incompatibility. Bridge is designed *upfront* to prevent class explosion |

---

## The Analogy

TV remote control: the *remote* (abstraction) has buttons — power, volume, channel. The *device* (implementor) is a TV, radio, or projector. Any remote works with any device. You don't need a "TVRemote", "RadioRemote", "ProjectorRemote" — just one remote connected to any device.

---

## Why This Matters in Interviews

- "Design a notification system for multiple channels (Email/SMS/Push) AND multiple urgency levels (Low/High/Critical)" — two varying dimensions → Bridge
- Signal: "With inheritance alone, I'd need 9 classes. With Bridge, I separate channels from urgency, 3+3 = 6 classes, and they combine at runtime"
- Shows: you recognise multi-dimensional variation and know how to avoid class explosion

> **Red flags:** Creating `EmailLowNotification`, `EmailHighNotification`, `SMSLowNotification`... — that's the class explosion Bridge prevents

---

## The Core Concept

The problem it solves: you have two things that vary — shapes and rendering methods, remote controls and devices, notifications and delivery channels. Using inheritance alone, you multiply them: 3 shapes × 3 renderers = 9 classes. Add a 4th shape: now 12. Add a 4th renderer: now 16. This is **class explosion**.

Bridge keeps the two dimensions as separate hierarchies, connected by a composition reference (the "bridge"). Now M shapes + N renderers = M+N classes.

```python
from abc import ABC, abstractmethod

# Implementor hierarchy — HOW rendering works
class Renderer(ABC):
    @abstractmethod
    def render(self, shape: str, detail: str): pass

class VectorRenderer(Renderer):
    def render(self, shape, detail): print(f"Vector: {shape} — {detail}")

class RasterRenderer(Renderer):
    def render(self, shape, detail): print(f"Pixels: {shape} — {detail}")

# Abstraction hierarchy — WHAT shapes are
class Shape(ABC):
    def __init__(self, renderer: Renderer):
        self._renderer = renderer   # The bridge — holds the implementor

class Circle(Shape):
    def __init__(self, renderer, radius):
        super().__init__(renderer)
        self.radius = radius
    def draw(self): self._renderer.render("Circle", f"radius={self.radius}")

class Square(Shape):
    def __init__(self, renderer, side):
        super().__init__(renderer)
        self.side = side
    def draw(self): self._renderer.render("Square", f"side={self.side}")

# Mix and match at runtime — no combined subclasses needed
Circle(VectorRenderer(), 5).draw()   # Vector: Circle — radius=5
Circle(RasterRenderer(), 5).draw()   # Pixels: Circle — radius=5
Square(VectorRenderer(), 10).draw()  # Vector: Square — side=10
```

Add `Triangle`? One class. Add `OpenGLRenderer`? One class. Never M×N again.

---

## When to Use / When NOT to Use

**Use when:** you have two clearly independent dimensions of variation, and you can see they'll each grow separately. The signal is class names that look like `[DimensionA][DimensionB]`.

**Don't use when:** you only have one dimension varying — simple inheritance or Strategy is cleaner. Bridge adds two hierarchies and an indirection; only worthwhile when both grow.

---

## Common Mistakes

**1. Using Bridge for only one dimension of variation**
If you only have shapes with no renderer variation, Bridge adds complexity for nothing. Identify the two varying dimensions first.

**2. Coupling Abstraction to a concrete Implementor**
```python
class Shape:
    def __init__(self, renderer: VectorRenderer):   # WRONG — concrete type
```
The Abstraction must depend on the Implementor *interface*, not a specific class.

**3. Creating the Implementor inside the Abstraction**
```python
class Circle(Shape):
    def __init__(self): self._renderer = VectorRenderer()   # hard-coded!
```
Inject the implementor. That's the whole point — swappable at runtime.

---

## Interview Q&A (Quick Fire)

**Q: What's the key difference between Bridge and Adapter?**
> "Intent and timing. Adapter is reactive — you have an existing incompatible interface and you fix it. Bridge is proactive — you design two hierarchies upfront to evolve independently. Adapter usually wraps a single class; Bridge creates two parallel hierarchies connected by composition."

**Q: What problem does Bridge actually solve?**
> "Class explosion. When two dimensions vary independently — say, shapes and rendering methods — inheritance alone produces M×N subclasses. Bridge reduces this to M+N by separating the dimensions into two hierarchies. Adding a new shape is one class; adding a new renderer is one class."

**Q: How does Bridge relate to DIP?**
> "The Abstraction depends on the Implementor interface, not any concrete class. That's Dependency Inversion — high-level (Abstraction) depends on an abstraction (Implementor interface), not a low-level detail (VectorRenderer or RasterRenderer)."

---

## Key Takeaways

- Bridge = **two independent hierarchies** connected by composition — prevents class explosion when two dimensions vary
- The "bridge" is the composition reference: Abstraction *has-a* Implementor (via interface)
- Apply it **proactively** when you see names like `XYZ_Type_Variant` emerging — that's the signal
- Always inject the implementor — swappability at runtime is the main benefit
