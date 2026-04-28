# Flyweight Pattern

> **Source:** https://layrs.me/course/lld/04-design-patterns/flyweight
> **Level:** Intermediate | **Read:** ~10 min | **Category:** Structural

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Flyweight** | Share the common parts of many objects; store only the unique parts per instance |
| **Intrinsic state** | Shared, immutable data stored *inside* the flyweight (e.g., font, texture) |
| **Extrinsic state** | Unique, context-specific data stored *outside* — passed in at call time (e.g., position, character) |
| **Flyweight Factory** | A cache that returns existing flyweights rather than creating duplicates |
| **When to use** | Thousands+ of similar objects where shared state dominates; memory is a concern |

---

## The Analogy

A text editor has 100,000 characters. "Arial 12pt Bold" is shared by 90,000 of them. Instead of storing the font in each of those 90,000 character objects, you store it once — one `Arial12ptBold` flyweight — and each character just holds its letter and position. 90,000 × (font object) → 1 × (font object) + 90,000 × (letter, position).

---

## Why This Matters in Interviews

- "Design a particle system / game forest / text rendering engine with millions of objects" → Flyweight
- Signal: "Most objects share the same texture or font — I'd separate the shared state into flyweights and store only the unique position/state per instance"
- Shows: you think about memory and performance, not just correctness

> **Red flags:** Storing position or instance-specific data inside the flyweight (defeats sharing); not using a factory (creates duplicate flyweights); confusing Flyweight with Singleton

---

## The Core Concept

The problem it solves: large numbers of similar objects where each holds a big chunk of identical data. If 1 million tree objects each store the same 1KB texture, that's 1GB of wasted memory for identical data.

Split the state: intrinsic (shared, immutable) → stored inside the flyweight. Extrinsic (unique per instance) → stored in the client context or passed as method arguments.

```python
from dataclasses import dataclass

@dataclass(frozen=True)         # Flyweight — immutable, shareable
class TreeType:
    name: str
    texture: str
    def render(self, x: int, y: int, age: int):
        return f"{self.name} at ({x},{y}) age {age}y — texture: {self.texture}"

class TreeFactory:
    _cache = {}
    @classmethod
    def get(cls, name, texture) -> TreeType:
        key = (name, texture)
        if key not in cls._cache:
            cls._cache[key] = TreeType(name, texture)   # create only once
        return cls._cache[key]

class Tree:                     # Client — holds only extrinsic state
    def __init__(self, x, y, age, tree_type: TreeType):
        self.x, self.y, self.age = x, y, age
        self._type = tree_type  # reference to shared flyweight
    def draw(self): return self._type.render(self.x, self.y, self.age)

# Plant 1000 oak trees — only ONE OakType flyweight is ever created
oak = TreeFactory.get("Oak", "oak_texture.png")
forest = [Tree(i * 10, i * 5, i % 20, oak) for i in range(1000)]
print(forest[0].draw())
print(f"Flyweights created: {len(TreeFactory._cache)}")  # 1, not 1000
```

---

## When to Use / When NOT to Use

**Use when:** you need thousands or millions of similar objects; profiling shows memory is the bottleneck; most state is shared across instances.

**Don't use when:** you have fewer than a few hundred objects — the factory overhead and code complexity outweigh the savings. **Always profile first** — premature optimization is the root of all evil.

---

## Common Mistakes

**1. Storing extrinsic state in the flyweight**
```python
class CharacterFlyweight:
    def __init__(self, font, size, char, position):  # char and position are extrinsic!
```
If the flyweight holds unique data, it can't be shared. Position and character identity must stay external.

**2. Not using a factory**
```python
char_format_1 = CharacterFlyweight('Arial', 12)
char_format_2 = CharacterFlyweight('Arial', 12)   # duplicate — no sharing!
```
Without a factory cache, you create identical objects instead of reusing them.

**3. Mutating flyweight state**
```python
flyweight.size = 14   # WRONG — modifies shared object, affects all clients
```
Flyweights must be immutable. Use `@dataclass(frozen=True)` or private attributes with no setters.

**4. Confusing Flyweight with Singleton**
Singleton = one instance of a class. Flyweight = multiple instances based on intrinsic state (you might have 50 different flyweights). They solve different problems.

---

## Interview Q&A (Quick Fire)

**Q: How does Flyweight actually save memory?**
> "Instead of N objects each holding K bytes of shared data (N×K memory), you have M flyweight objects (M×K) plus N lightweight context objects (N×reference_size). When M is much smaller than N — say 5 tree types vs 1 million trees — the savings are dramatic. In the extreme case, 1 million trees × 1KB shared texture = 1GB → 5KB + 1M × 8 bytes ≈ 8MB."

**Q: What's intrinsic vs extrinsic state? Give an example.**
> "Intrinsic state is shared and immutable — it's the same for all objects in a group. In a forest, `name = 'Oak'` and `texture = 'oak.png'` are intrinsic. Extrinsic state is unique per instance — position, age, health. Intrinsic goes in the flyweight; extrinsic stays outside, passed to the flyweight's methods."

**Q: How would you make a flyweight factory thread-safe?**
> "Use a lock around the cache check-and-create: `with self._lock: if key not in self._cache: self._cache[key] = Flyweight(...)`. Python's `threading.Lock`, Java's `synchronized` or `ConcurrentHashMap`."

---

## Key Takeaways

- Flyweight splits object state: **intrinsic (shared, immutable)** in the flyweight; **extrinsic (unique)** stays in the client
- A **factory with a cache** is essential — without it, you create duplicates and defeat the pattern
- Flyweights must be **immutable** — shared objects can't be modified safely
- Only apply when you have **thousands+** of objects and profiling confirms memory is the issue — not as a default optimisation
