# Proxy Pattern

> **Source:** https://layrs.me/course/lld/04-design-patterns/proxy
> **Level:** Beginner | **Read:** ~10 min | **Category:** Structural

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Proxy** | A stand-in that controls access to another object, with the same interface |
| **Virtual Proxy** | Delays creating an expensive object until it's actually needed (lazy loading) |
| **Protection Proxy** | Adds auth/permission checks before forwarding to the real object |
| **Caching Proxy** | Returns a cached result instead of calling the real object each time |
| **vs. Decorator** | Decorator *adds* behaviour. Proxy *controls access* — it may defer, restrict, or cache |

---

## The Analogy

A lawyer who acts on your behalf: you give them power of attorney (same authority = same interface), but they can check whether the other party's request is appropriate before presenting it to you, handle minor matters themselves (caching), or delay involving you until it's necessary (lazy loading).

---

## Why This Matters in Interviews

- "How would you add authentication to DB access without touching the DB class?" → Protection Proxy
- "How would you avoid loading a 10MB image until the user actually scrolls to it?" → Virtual Proxy
- "How would you reduce repeated database calls for the same data?" → Caching Proxy
- Shows: you understand access control, lazy evaluation, and caching at the design level, not just as ad-hoc code

> **Red flags:** Proxy that doesn't implement the same interface as the real subject (breaks substitutability); proxy that creates the real object immediately (defeats lazy loading); forgetting to apply proxy logic to *all* methods in the interface

---

## The Core Concept

The problem it solves: you want to intercept access to an object — to defer creation, enforce security, add caching, or log usage — without changing the real object and without clients knowing there's a middleman.

Proxy and real object implement the **same interface**. Clients use the proxy thinking they're using the real object. The proxy decides whether, when, and how to delegate.

**Virtual Proxy — lazy loading:**
```python
class Image(ABC):
    @abstractmethod
    def display(self): pass

class RealImage(Image):
    def __init__(self, file):
        print(f"Loading {file}...")   # expensive
        self._file = file
    def display(self): print(f"Showing {self._file}")

class ImageProxy(Image):
    def __init__(self, file):
        self._file = file
        self._real = None             # not loaded yet
    def display(self):
        if self._real is None:
            self._real = RealImage(self._file)   # load only on first use
        self._real.display()

img = ImageProxy("large_photo.jpg")   # instant — no loading
img.display()                         # "Loading large_photo.jpg..." only now
img.display()                         # instant — already loaded
```

**Caching Proxy — avoid repeated calls:**
```python
class UserServiceProxy(UserService):
    def __init__(self, real: UserService):
        self._real = real
        self._cache = {}
    def get_user(self, user_id):
        if user_id not in self._cache:
            self._cache[user_id] = self._real.get_user(user_id)  # expensive call
        return self._cache[user_id]   # subsequent calls: instant
```

---

## When to Use / When NOT to Use

**Use when:** you need one of: lazy initialisation of expensive objects; access control without modifying the real object; transparent caching; usage logging; remote object representation.

**Don't use when:** you just want to add new behaviour (use Decorator instead); the overhead of the extra indirection isn't justified by the benefit.

---

## Common Mistakes

**1. Proxy has a different interface than the real subject**
Client code can't substitute one for the other. They must implement the exact same interface — any proxy-specific extras (like `clear_cache()`) must be separate methods, not replacements.

**2. Creating the real object eagerly in the proxy constructor**
```python
class ImageProxy:
    def __init__(self, file):
        self._real = RealImage(file)   # WRONG — defeats lazy loading entirely
```

**3. Only applying proxy logic to some interface methods**
```python
class BankProxy(BankAccount):
    def withdraw(self, amt): ... auth check ... return self._real.withdraw(amt)
    def get_balance(self): return self._real.get_balance()   # no auth check — security hole
```
If authentication applies to `withdraw()`, it applies to `get_balance()` too. Proxy logic must be consistent across all interface methods.

**4. Exposing the real subject**
```python
def get_real_account(self): return self._real   # WRONG — bypasses the proxy entirely
```

---

## Interview Q&A (Quick Fire)

**Q: How is Proxy different from Decorator?**
> "Intent. Decorator *adds* new behaviour on top — the caller gets enhanced functionality and the base object still does its full work. Proxy *controls access* — it may prevent the call, return a cached result, or defer object creation. Decorator assumes the object exists; Proxy may manage its lifecycle."

**Q: How is Proxy different from Facade?**
> "Proxy represents *one* object and keeps the same interface. Facade provides a simplified interface to *many* classes. A Proxy and its real subject are interchangeable; a Facade and its subsystem are not."

**Q: When would you use a Virtual Proxy?**
> "When object creation is expensive and you might not need the object at all, or need it much later than you reference it. ORMs use this for lazy-loading related records — SQLAlchemy won't hit the database for a relationship until you actually access it."

---

## Key Takeaways

- Proxy = **same interface, controlled access** — clients don't know there's a middleman
- Three main types: **Virtual** (lazy creation), **Protection** (auth checks), **Caching** (memoised results)
- Proxy logic must be applied **consistently** to all interface methods — partial protection is a security hole
- Proxy manages the **lifecycle** of the real object; Decorator just wraps an already-existing one
