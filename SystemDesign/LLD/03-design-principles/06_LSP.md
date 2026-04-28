# Liskov Substitution Principle (LSP) Explained

> **Source:** https://layrs.me/course/lld/03-design-principles/liskov-substitution
> **Level:** Beginner | **Read:** ~16 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **LSP** | Any subclass should work wherever the base class is expected — no surprises |
| **Behavioral subtyping** | The formal name for LSP — substitution preserves behavior |
| **Contract** | Preconditions, postconditions, and invariants the base class establishes |
| **Precondition** | What must be true before the method is called |
| **Postcondition** | What the method guarantees after it runs |
| **LSP red flag** | `isinstance()` checks, `NotImplementedError`, empty method overrides |

> **Key Insight:** LSP is about **behavioral compatibility**, not structural similarity. A Square is mathematically a rectangle, but in code it violates LSP because it breaks the client contract: width and height can be set independently.

---

## The Analogy — Electrical Adapters

- A UK-to-EU plug adapter works because it fulfills the same contract: deliver power to the device
- If a "UK adapter" randomly shocked you sometimes, that's an LSP violation — same interface, broken behavior
- LSP: subclasses must honor the original contract, not just have the right shape

---

## Why This Matters in Interviews

- "Is this inheritance LSP-compliant?" is the most common LSP interview question
- Classic case: Rectangle→Square, Bird→Penguin
- Signal: "The subclass strengthens the precondition / weakens the postcondition — that's a contract violation"

> **Red flags:** Subclass throws exceptions not declared by base, returns `None` when base guarantees non-null, overrides with no-op implementations, requires type-checking in client code

---

## Core Concept

### The Contract (Formal Rules)

1. **Preconditions cannot be strengthened**: if base accepts any integer, subclass can't require only positive integers
2. **Postconditions cannot be weakened**: if base guarantees non-null return, subclass can't return `None`
3. **Invariants must be preserved**: state rules the base maintains must hold in subclass too

### Classic Violation — Rectangle → Square

```python
class Rectangle:
    def __init__(self, width, height):
        self._width = width
        self._height = height
    
    def set_width(self, width): self._width = width
    def set_height(self, height): self._height = height
    def get_area(self): return self._width * self._height

class Square(Rectangle):
    """LSP VIOLATION: breaks Rectangle's contract"""
    def set_width(self, width):
        self._width = width
        self._height = width   # Forces both equal — violates contract

    def set_height(self, height):
        self._width = height   # Forces both equal — violates contract
        self._height = height

# Client code working with Rectangle
def test_rectangle(rect: Rectangle):
    rect.set_width(5)
    rect.set_height(4)
    assert rect.get_area() == 20, f"Expected 20, got {rect.get_area()}"

test_rectangle(Rectangle(0, 0))  # ✓ Area is 20
test_rectangle(Square(0, 0))     # AssertionError: Expected 20, got 16 ← VIOLATION
```

### Fix — Extract a Common Interface

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self) -> float: pass

class Rectangle(Shape):
    def __init__(self, width, height): self.width = width; self.height = height
    def area(self): return self.width * self.height

class Square(Shape):             # Parallel — neither inherits from the other
    def __init__(self, side): self.side = side
    def area(self): return self.side ** 2
```

### Bird Hierarchy — Structural Refactor

```python
# BEFORE — Penguin.fly() throws → client must handle exception
class Bird:
    def fly(self): return "Flying in the sky"

class Penguin(Bird):
    def fly(self): raise Exception("Penguins can't fly!")  # LSP VIOLATION

# AFTER — hierarchy matches real behavioral contracts
class Bird(ABC):
    @abstractmethod
    def move(self): pass

class FlyingBird(Bird):
    def move(self): return self.fly()
    def fly(self): return "Flying in the sky"

class Sparrow(FlyingBird):
    def fly(self): return "Sparrow flying fast"

class Penguin(Bird):             # Doesn't inherit fly() — no violation
    def move(self): return "Penguin swimming"

def make_bird_move(bird: Bird):
    print(bird.move())           # Works for ALL birds without type checking
```

### LSP-Compliant Payment System

```python
class PaymentProcessor(ABC):
    @abstractmethod
    def process_payment(self, amount: float) -> bool:
        """Process payment. Returns True if successful, never raises for valid input."""
        pass

class CreditCardProcessor(PaymentProcessor):
    def process_payment(self, amount: float) -> bool:
        if amount <= 0: return False   # honors precondition
        return True                    # always returns bool — honors postcondition

class PayPalProcessor(PaymentProcessor):
    def process_payment(self, amount: float) -> bool:
        if amount <= 0: return False
        return True

# Client works identically with any processor — substitution is safe
def checkout(processor: PaymentProcessor, amount: float):
    if processor.process_payment(amount):
        print("Payment successful!")
```

---

## Common Mistakes

### 1. Strengthening preconditions

```python
class FileReader:
    def read(self, filename: str) -> str:
        with open(filename) as f: return f.read()

class TextFileReader(FileReader):
    def read(self, filename: str) -> str:
        if not filename.endswith('.txt'):
            raise ValueError("Only .txt files allowed")   # VIOLATION
        return super().read(filename)
# Client expecting FileReader to read any file → breaks with TextFileReader
```

### 2. Weakening postconditions

```python
class UserRepository:
    def get_user(self, user_id: int) -> dict:
        return {'id': user_id, 'name': 'John', 'email': 'john@example.com'}

class CachedUserRepository(UserRepository):
    def get_user(self, user_id: int) -> dict:
        cached = self._check_cache(user_id)
        return cached  # VIOLATION — could be None on cache miss!
        # Fix: return self._db.get_user(user_id) if not cached
```

### 3. Throwing new exceptions

```python
class Calculator:
    def divide(self, a, b): return a / b if b != 0 else 0   # Never raises

class StrictCalculator(Calculator):
    def divide(self, a, b):
        if b == 0: raise ZeroDivisionError("Cannot divide by zero")  # VIOLATION
        return a / b
```

---

## Interview Q&A (Quick Fire)

**Q: Explain the Rectangle-Square problem.**
> "While mathematically a square is a rectangle, in code Square violates LSP if it inherits from Rectangle. Setting width and height independently is Rectangle's contract. Square must keep them equal — that breaks the contract. Client code that sets width=5, height=4 expecting area=20 gets 16. Fix: both inherit from Shape without a parent-child relationship."

**Q: What are the LSP red flags?**
> "Four signals: (1) subclass throws exceptions the base doesn't declare, (2) subclass returns null when base guarantees non-null, (3) empty or `NotImplementedError` implementations, (4) client code needs `isinstance()` checks to handle a specific subclass differently."

**Q: How does LSP relate to other SOLID principles?**
> "LSP enables OCP — safe substitution is what makes extension without modification possible. ISP can fix LSP violations — sometimes a class can't implement a method because the interface is too broad. Split the interface and LSP compliance follows naturally."

---

## Key Takeaways

- LSP = **subclasses are true substitutes** — client code works identically with any subclass
- **Honor the contract**: don't strengthen preconditions, weaken postconditions, or throw new exceptions
- **Behavioral IS-A ≠ mathematical IS-A**: Square-Rectangle is the canonical example
- **Fix violations with**: (1) extract interface for both, (2) split the hierarchy, (3) use composition
- Use LSP vocabulary in interviews: preconditions, postconditions, invariants, behavioral subtyping
