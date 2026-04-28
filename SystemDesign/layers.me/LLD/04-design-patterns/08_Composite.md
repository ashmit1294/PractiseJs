# Composite Pattern

> **Source:** https://layrs.me/course/lld/04-design-patterns/composite
> **Level:** Beginner | **Read:** ~10 min | **Category:** Structural

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Composite** | Organise objects into a tree where both individual items and groups can be treated the same way |
| **Component** | The shared interface — both leaves and composites implement it |
| **Leaf** | An individual item with no children (a file, a button, an employee) |
| **Composite** | A container that holds other components (a folder, a panel, a department) |
| **Uniform treatment** | Client calls `component.operation()` — doesn't need to know if it's a leaf or container |

---

## The Analogy

A file system: a folder and a file both have a `get_size()`. A file returns its own bytes. A folder adds up the sizes of everything inside — which might contain sub-folders, which recurse further. From the outside, `get_size()` works the same on both.

---

## Why This Matters in Interviews

- "Design a file system / UI component tree / org chart" → Composite
- Signal: "I'd use Composite — both individual items and groups need to respond to the same operation, and the nesting can be arbitrarily deep"
- Shows: you recognise tree structures and recursive delegation, not just flat lists

> **Red flags:** `if isinstance(item, Folder):` in client code — that's exactly what Composite eliminates; not making the operation recursive in the Composite class

---

## The Core Concept

The problem it solves: you have a tree structure where items and groups of items should behave the same. Without Composite, client code must branch on type — check if it's a file or a folder before deciding how to call things. With Composite, you just call `component.operation()` and the recursion happens inside.

```python
from abc import ABC, abstractmethod

class FileSystemItem(ABC):          # Component
    def __init__(self, name): self.name = name
    @abstractmethod
    def get_size(self) -> int: pass

class File(FileSystemItem):         # Leaf
    def __init__(self, name, size):
        super().__init__(name)
        self._size = size
    def get_size(self) -> int: return self._size

class Folder(FileSystemItem):       # Composite
    def __init__(self, name):
        super().__init__(name)
        self._children = []
    
    def add(self, item): self._children.append(item)
    def get_size(self) -> int:
        return sum(child.get_size() for child in self._children)  # recursive

# Build a tree
root = Folder("root")
docs = Folder("docs")
docs.add(File("resume.pdf", 2048))
docs.add(File("notes.txt", 512))
root.add(docs)
root.add(File("readme.txt", 256))

# Uniform treatment — same call on File or Folder
print(root.get_size())   # 2816 — sums the whole tree automatically
print(docs.get_size())   # 2560
```

The client never uses `isinstance`. `get_size()` on a Folder triggers recursion; on a File it just returns the value.

---

## When to Use / When NOT to Use

**Use when:** your domain has a **part-whole hierarchy** — things that contain other things, nested to any depth. File systems, UI trees, org charts, expression trees, menu systems.

**Don't use when:** items and groups don't share the same operations, or the tree is fixed and shallow — a flat list is simpler.

---

## Common Mistakes

**1. Putting child-management methods on Leaf**
Implementing empty `add()` / `remove()` on Leaf just to satisfy an interface violates ISP. Keep child-management on Composite only; design the Component interface around the shared operational methods.

**2. Forgetting to make operations recursive in Composite**
```python
class Folder:
    def get_size(self): return 0   # WRONG — ignores children
```
Composite must iterate and delegate to all children. That's the whole mechanism.

**3. Circular references**
`folder_a.add(folder_b)` and `folder_b.add(folder_a)` creates an infinite loop when any recursive operation is called. Validate in `add()`.

---

## Interview Q&A (Quick Fire)

**Q: What problem does Composite solve?**
> "Treating individual objects and groups of objects uniformly. Without it, client code must check if it's dealing with a leaf or a container before every operation. Composite gives both a shared interface — the client calls `item.operation()` and the tree handles recursion internally."

**Q: Common scenarios where you'd use it?**
> "File systems — files and folders both have size and name. UI component trees — buttons and panels both have render() and setEnabled(). Org charts — employees and departments both have getTotalSalary(). Expression trees — numbers and operators both have evaluate()."

**Q: Where does the recursion actually live?**
> "In the Composite's implementation of the shared operation. When you call `folder.get_size()`, it iterates its children and calls `get_size()` on each — which might itself be a folder, triggering further recursion. Leaves just return their value directly."

---

## Key Takeaways

- Composite = **tree structure** where leaves and composites share one interface — no `isinstance` checks in client code
- The recursion lives in the **Composite's** operation — it iterates children and delegates
- Design the **Component interface** around the operations that make sense for both leaves and composites
- Watch for **circular references** and **empty composite** edge cases in the recursive operations
