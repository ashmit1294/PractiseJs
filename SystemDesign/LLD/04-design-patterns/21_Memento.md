# 21 — Memento Pattern

## TL;DR

| Question | Answer |
|---|---|
| What | Capture and externalise object state without violating encapsulation; restore later |
| Why | Undo/redo, checkpoints, rollback — without exposing internal structure via getters |
| Three roles | Originator (creates/restores) · Memento (immutable snapshot) · Caretaker (stores, never reads) |
| Critical | Memento must be immutable; Caretaker treats it as opaque |
| When NOT | State is tiny and trivial — just copy the value directly |

---

## The Analogy

A **game checkpoint**: the game (originator) saves your character's full state to a save file (memento). The save manager (caretaker) stores that file. When you die, you load the checkpoint — the game reads the file and restores itself. The save manager never reads or edits the save file's contents; it just stores and retrieves it.

---

## Core Concept

The naive undo implementation exposes every field via getters so external code can snapshot and restore. This breaks encapsulation and tightly couples history management to implementation details. Memento solves it by having the Originator create its own snapshot (it knows its internals), package it as an opaque Memento object, and hand it to the Caretaker for storage. The Caretaker stores/retrieves mementos but *never inspects their contents*.

```python
class EditorMemento:
    def __init__(self, content):
        self._content = content      # private — only Editor should read this

    def _get_content(self):          # name-mangled: conventionally private
        return self._content

class TextEditor:
    def __init__(self): self.content = ""

    def type(self, text): self.content += text

    def save(self): return EditorMemento(self.content)      # Originator creates memento

    def restore(self, m): self.content = m._get_content()  # Originator restores from memento

class History:                                             # Caretaker
    def __init__(self): self._stack = []
    def push(self, m): self._stack.append(m)
    def pop(self): return self._stack.pop() if self._stack else None

editor = TextEditor()
history = History()

history.push(editor.save())
editor.type("Hello")
history.push(editor.save())
editor.type(" World")

editor.restore(history.pop())   # back to "Hello"
editor.restore(history.pop())   # back to ""
```

---

## When to Use / When NOT to Use

**Use when:**
- Undo/redo is needed and the object's internal state is complex or private
- Transactional rollback (wizard forms, database transactions)
- Game checkpoints or long-running computation snapshots

**Avoid when:**
- Object state is trivial — just copy one or two values directly
- The object is very large and snapshots would cause memory pressure — consider incremental snapshots or the Command pattern for operation-level undo instead

---

## Common Mistakes

**Public memento internals** — if the Caretaker can read or modify `memento.state`, encapsulation is broken and external code can corrupt saved state. Use private attributes (`_state`) or Java inner-class access control.

**Unbounded history** — saving after every keystroke without a size limit quickly exhausts memory. Use a bounded deque (`collections.deque(maxlen=100)`) or circular buffer.

**Mutable references in the memento** — `GameMemento(inventory=self._inventory)` stores a *reference*, not a copy. If the inventory list is later modified, the saved state changes too. Always copy mutable objects: `tuple(self._inventory)` or `list(self._inventory)[:]`.

**Originator managing its own history** — mixing state creation with history storage in the same class violates SRP. The Originator creates/restores; the Caretaker stores/retrieves — keep them separate.

**Confusing with Prototype** — Prototype clones objects to create new instances. Memento saves state specifically to *restore* it later; the motivation is rollback, not object creation.

---

## Interview Q&A

**Q: Design undo/redo for a drawing application.**  
`Canvas` (Originator) has `create_memento()` and `restore(memento)`. `UndoManager` (Caretaker) holds two stacks: undo and redo. On action: push current state to undo stack, clear redo stack. On undo: pop from undo stack, push current state to redo stack, restore. On redo: reverse. Mention bounded history and deep-copy of shape lists.

**Q: What if object state is very large?**  
Options: (1) limit history size with a circular buffer, (2) store only the *diff* between states, (3) use the Command pattern instead — undo by reversing operations, not by restoring full snapshots, (4) compress older mementos.

**Q: How do you enforce that Caretaker can't read memento state?**  
Python: name mangling (`__state`) or convention (`_state`). Java: private static inner class — only the outer Originator class can access it. C++: `friend class Originator` in the Memento class.

---

## Key Takeaways

- Originator creates and restores; Memento stores state immutably; Caretaker manages storage without reading contents
- Mementos must be **immutable** — deep-copy mutable fields (lists, dicts) at creation time
- Bound history size; large objects need incremental or delta snapshots to avoid memory pressure
- For operation-level undo (redo individual actions), consider Command pattern instead of full-state snapshots
