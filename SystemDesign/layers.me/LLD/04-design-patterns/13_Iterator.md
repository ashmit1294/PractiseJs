# 13 — Iterator Pattern

## TL;DR

| Question | Answer |
|---|---|
| What | Traverse any collection sequentially without exposing its internal structure |
| Why | Decouples iteration logic from the collection itself |
| Key mechanism | `__iter__()` returns an iterator; `__next__()` advances it; `StopIteration` signals end |
| Pythonic shortcut | Generators with `yield` — the cleanest iterator implementation |
| When NOT | You just need a simple `for` loop over a built-in type |

---

## The Analogy

A **music playlist**: you press "next" without knowing whether songs are stored in an array, a linked list, or a database. The playlist exposes a consistent traversal interface; its internal format is irrelevant.

---

## Core Concept

Every Python `for` loop uses the iterator protocol silently. An **iterable** is anything that can produce an iterator via `__iter__()`; an **iterator** is the thing that does the actual walking via `__next__()`. They are different responsibilities — an iterable creates fresh iterators; an iterator does traversal and remembers position.

The main value: you can have **multiple simultaneous traversals** of the same collection, support **lazy evaluation** (generate items on demand), and treat every collection — list, tree, graph — through the same interface.

```python
class CountUp:
    def __init__(self, limit):
        self._limit = limit
        self._current = 0

    def __iter__(self):      # Makes CountUp an iterable
        return self          # Returns self because it IS its own iterator

    def __next__(self):
        if self._current >= self._limit:
            raise StopIteration
        val = self._current
        self._current += 1
        return val

for n in CountUp(3):
    print(n)   # 0, 1, 2
```

The **generator** equivalent collapses all boilerplate: `yield` automatically implements `__iter__` and `__next__` and raises `StopIteration` at function end.

---

## When to Use / When NOT to Use

**Use when:**
- Traversing complex data structures (trees, graphs, linked lists) without exposing internals
- You need multiple simultaneous traversals (each caller gets a fresh iterator)
- Lazy evaluation — producing items one at a time from a large/infinite source
- Uniform interface across different collection types

**Avoid when:**
- You just need to loop over a built-in list/dict — Python's `for` already handles it
- The collection is tiny and iteration logic is trivial — don't add classes for nothing

---

## Common Mistakes

**Returning `None` instead of raising `StopIteration`** — the loop protocol checks for the exception, not a sentinel value. Returning `None` makes `None` appear as a real item.

**Not returning `self` from `__iter__`** — when the iterator IS its own iterable (stateful traversal), `__iter__` must return `self`. Returning a new object breaks the protocol.

**Reusing exhausted iterators** — once `StopIteration` is raised, the iterator is done. Store the iterable (the collection), not the iterator, if you need to iterate again.

**Modifying the collection during iteration** — inserting or deleting items mid-traversal causes unpredictable behavior. Iterate over a copy (`list(collection)`) if mutation is needed.

---

## Interview Q&A

**Q: What's the difference between an iterable and an iterator?**  
An *iterable* (`__iter__`) produces an iterator; an *iterator* (`__next__`) does the traversal and holds position state. A `list` is an iterable; `iter(my_list)` produces an iterator.

**Q: When would you write a custom iterator instead of using a generator?**  
When you need to expose the iterator as a class with additional methods (e.g., `peek()`, `reset()`), or when integrating with a framework expecting a class-based protocol.

**Q: How do generators relate to the Iterator pattern?**  
A generator function automatically implements the full iterator protocol. `yield` suspends execution, `__next__` resumes it, and returning from the function raises `StopIteration`. It's the Pythonic Iterator.

---

## Key Takeaways

- **Iterator = traversal object**; **Iterable = thing that produces iterators** — they're distinct roles
- Raise `StopIteration`, never return a sentinel; return `self` from `__iter__` when iterator IS iterable
- Generators are the Pythonic Iterator — prefer them over manual `__iter__`/`__next__` for simple cases
- Fresh iterators per caller = safe concurrent traversal; exhausted iterators cannot be reset
