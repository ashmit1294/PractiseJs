# Prototype Pattern

> **Source:** https://layrs.me/course/lld/04-design-patterns/prototype
> **Level:** Beginner | **Read:** ~10 min | **Category:** Creational

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Prototype** | Create new objects by *cloning* an existing one instead of building from scratch |
| **Shallow copy** | Copies the object but shares references to nested objects — both originals share those nested parts |
| **Deep copy** | Recursively copies everything — the clone is fully independent |
| **Prototype Registry** | A dictionary of ready-to-clone templates, accessed by key |
| **When to prefer it** | Object creation is expensive (DB queries, complex config) and you need many similar instances |

---

## The Analogy

A cookie cutter (the prototype) pressed into dough — each cookie is a fresh copy of the same shape. You don't design the shape each time; you clone the cutter. Each cookie can then be decorated independently (different icing, sprinkles) without affecting the cutter or other cookies.

---

## Why This Matters in Interviews

- "Create many similar objects that share a base configuration but differ in small ways" → Prototype
- "Object construction requires expensive queries / network calls" → Prototype + Registry
- Signal: "I'd preload a prototype with the expensive setup once, then clone it for each new instance"
- Shows: you think about performance and object lifecycle, not just structure

> **Red flags:** Forgetting deep vs. shallow copy distinction; trying to clone objects with external resources (DB connections, file handles) without handling them specially

---

## The Core Concept

The problem it solves: sometimes creating an object is expensive — loading config from a database, initialising a complex object graph, or running expensive calculations. If you need 100 similar objects, running that expensive setup 100 times wastes time.

Clone once, customise each copy.

```python
import copy

class GameCharacter:
    def __init__(self, name, health, skills):
        self.name = name
        self.health = health
        self.skills = skills   # list — mutable, must deep copy!
    
    def clone(self):
        return copy.deepcopy(self)   # fully independent copy

# Define template once
warrior_template = GameCharacter("Warrior", 150, ["Sword Strike", "Shield Block"])

# Spawn many instances cheaply — no repeated setup
player1 = warrior_template.clone()
player1.name = "Conan"
player1.skills.append("Whirlwind")   # modifies only player1

player2 = warrior_template.clone()
player2.name = "Xena"

print(warrior_template.skills)   # ['Sword Strike', 'Shield Block'] — unchanged
print(player1.skills)            # ['Sword Strike', 'Shield Block', 'Whirlwind']
```

**Deep vs. shallow — why it matters:**
```python
# Shallow copy — nested objects are SHARED
clone = copy.copy(original)
clone.skills.append("Fireball")   # also changes original.skills!

# Deep copy — fully independent
clone = copy.deepcopy(original)
clone.skills.append("Fireball")   # only changes clone.skills ✓
```

**Prototype Registry — for multiple templates:**
```python
class CharacterRegistry:
    def __init__(self): self._templates = {}
    def register(self, key, template): self._templates[key] = template
    def spawn(self, key): return self._templates[key].clone()

registry = CharacterRegistry()
registry.register("warrior", warrior_template)
registry.register("mage", GameCharacter("Mage", 80, ["Fireball", "Teleport"]))

player = registry.spawn("warrior")   # get fresh clone by name
```

---

## When to Use / When NOT to Use

**Use when:** object initialisation is expensive and you need many similar instances; you want to copy complex object state without coupling to its class; game spawning, document templates, configuration snapshots.

**Don't use when:** objects are cheap to construct — `Point(10, 20)` doesn't need cloning. Also, objects that hold external resources (file handles, open connections) can't be naively deep-copied — you'd need custom `__deepcopy__` logic.

---

## Common Mistakes

**1. Using shallow copy when nested objects are mutable**
`copy.copy()` copies the container but shares nested lists, dicts, objects. Two clones modifying the same inner list is a subtle bug. Default to `copy.deepcopy()` unless you have a measured performance reason not to.

**2. Implementing clone manually and forgetting new fields**
If you write `return Product(self.name, self.price)` instead of `deepcopy(self)`, you'll forget to include `category` the day you add it. Let `deepcopy` handle it automatically.

**3. Cloning objects with external resources**
```python
class DBConn:
    def clone(self): return copy.deepcopy(self)   # copies an active socket — broken!
```
Override `__deepcopy__` to re-establish the connection rather than copying the socket object.

---

## Interview Q&A (Quick Fire)

**Q: When would you use Prototype instead of Factory?**
> "When object creation is expensive. A Factory creates a fresh object every time — running all the setup code again. A Prototype clones an already-configured instance. If initialising a document requires fetching templates from a database, I'd create one prototype document, load the templates once, then clone it for each new document."

**Q: What's the difference between shallow and deep copy?**
> "Shallow copy duplicates the top-level object but leaves nested objects shared — changing a nested list in the clone also changes it in the original. Deep copy recursively duplicates the entire object graph — the clone is fully independent. For Prototype Pattern, deep copy is almost always what you want."

**Q: What's a Prototype Registry?**
> "A dictionary mapping keys to prototype instances. Instead of callers knowing which class to clone, they ask the registry by name: `registry.spawn('warrior')`. It decouples object creation from client code and makes it easy to add new prototypes without changing calling code."

---

## Key Takeaways

- Prototype = clone an existing object instead of constructing from scratch — ideal when setup is expensive
- **Almost always use `copy.deepcopy()`** — shallow copy with mutable nested state is a common source of bugs
- A **Prototype Registry** decouples clients from concrete classes, similar to how a factory does — but cloning instead of constructing
- Watch out for objects holding **external resources** — they need custom clone logic
