# Inheritance in OOP: Types & Interview Guide

> **Source:** https://layrs.me/course/lld/01-oop-fundamentals/inheritance
> **Level:** Beginner-Intermediate | **Read:** ~16 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Inheritance** | Child gets all parent's stuff automatically |
| **`super()`** | "Hey parent, do your thing first" |
| **Method overriding** | Child replaces parent's method with its own version |
| **MRO** | Method Resolution Order — Python's search order for methods |
| **Is-a relationship** | Dog is-a Animal ✅ / Car is-a Engine ❌ |
| **Multiple inheritance** | Class inherits from 2+ parents (Python supports, Java doesn't) |

> **Key Insight:** Inheritance = code reuse through **is-a** relationships. Misuse it for "has-a" and you'll get a mess. When in doubt: **prefer composition over inheritance**.

---

## The Analogy — Family Traits

- You inherit your parents' eye color, height tendencies (attributes)
- You also inherit behaviors (speak, walk) but do them your own way (override)
- You can't have two biological fathers (single inheritance) but can have multiple roles (interfaces)
- Deep family trees are confusing — keep hierarchies shallow

---

## Why This Matters in Interviews

- Classic question: **"Is-a vs has-a"** — inheritance vs composition
- Design questions often reveal misuse: `Square extends Rectangle` (LSP violation)
- Expected to know `super()`, MRO, and when NOT to use inheritance

> **Red flags:** Deep hierarchies (>3 levels), `class Car(Engine)`, forgetting `super().__init__()`

---

## Core Concept

### Basic Inheritance

```python
class Animal:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def speak(self):
        return "Some generic sound"

    def info(self):
        return f"{self.name} is {self.age} years old"

class Dog(Animal):              # Dog inherits from Animal
    def __init__(self, name, age, breed):
        super().__init__(name, age)  # initialize parent attrs first
        self.breed = breed

    def speak(self):            # override parent method
        return "Woof!"

    def fetch(self):            # Dog-specific method
        return f"{self.name} fetches the ball!"

class Cat(Animal):
    def speak(self): return "Meow!"

dog = Dog("Buddy", 3, "Labrador")
print(dog.info())    # Inherited from Animal → "Buddy is 3 years old"
print(dog.speak())   # Overridden in Dog    → "Woof!"
print(dog.fetch())   # Dog-specific         → "Buddy fetches the ball!"
```

### Using `super()` to Extend (not just replace)

```python
class BankAccount:
    def withdraw(self, amount):
        if 0 < amount <= self.balance:
            self.balance -= amount
            return f"Withdrew ${amount}"
        return "Insufficient funds"

class SavingsAccount(BankAccount):
    def withdraw(self, amount):
        if amount > 500:
            return "Cannot withdraw more than $500 at once"
        return super().withdraw(amount)   # call parent logic after check
```

### Method Resolution Order (MRO)

```python
class D(B, C):  # Multiple inheritance
    pass

# MRO: D → B → C → A → object (C3 linearization)
print(D.__mro__)   # Shows full lookup chain
```

### Checking Relationships

```python
isinstance(dog, Dog)     # True — exact type
isinstance(dog, Animal)  # True — respects inheritance chain
type(dog) == Dog         # True
type(dog) == Animal      # False — exact class only

# Always prefer isinstance() for type checking in polymorphic code
```

---

## Is-A vs Has-A Decision Tree

```
Do you want to share functionality?
        ↓
Is there a true "is-a" relationship? ("Dog is-a Animal")
    YES → Use Inheritance
    NO  →
        Is there a "has-a" relationship? ("Car has-a Engine")
            YES → Use Composition
            NO  → Consider other patterns
```

---

## Language Cross-Reference

| | Python | Java | C++ |
|---|---|---|---|
| Syntax | `class Dog(Animal):` | `class Dog extends Animal {}` | `class Dog : public Animal {}` |
| Super call | `super().__init__()` | `super(name, age);` | `: Animal(name, age)` (initializer list) |
| Multiple inheritance | ✅ Supported | ❌ (use interfaces) | ✅ Supported (diamond problem risk) |

---

## Common Mistakes

### 1. Forgetting `super().__init__()`
```python
class Dog(Animal):
    def __init__(self, name, breed):
        self.breed = breed    # ← parent attrs never initialized!

dog = Dog("Buddy", "Lab")
print(dog.name)  # AttributeError!
```

### 2. Using inheritance for "has-a" (wrong abstraction)
```python
# WRONG — Car is NOT an Engine
class Car(Engine): ...

# RIGHT — Car HAS an Engine
class Car:
    def __init__(self, engine: Engine):
        self.engine = engine
```

### 3. Deep hierarchies (>3-4 levels)
```python
# Avoid: LivingThing → Animal → Mammal → Carnivore → Canine → Dog → GoldenRetriever
# Better: Animal → Dog (breed is data, not a class)
class Dog(Animal):
    def __init__(self, breed):
        self.breed = breed   # data attribute, not subclass
```

### 4. Using `type()` instead of `isinstance()`
```python
type(dog) == Animal    # False — misses inheritance
isinstance(dog, Animal)  # True — checks entire chain ✅
```

### 5. LSP violation (Square-Rectangle problem)
```python
# WRONG — Square can't be a true Rectangle substitute
class Square(Rectangle):
    def set_width(self, w):
        self.width = w
        self.height = w  # breaks Rectangle's assumption!
```

---

## Interview Q&A (Quick Fire)

**Q: What is the Liskov Substitution Principle in the context of inheritance?**
> "If `S` is a subtype of `T`, objects of type `S` should be substitutable for objects of type `T` without breaking the program. A `Square` shouldn't inherit from `Rectangle` because changing width also changes height — it violates Rectangle users' expectations."

**Q: What's the MRO in Python?**
> "Python uses C3 linearization. When `D` inherits from `B` and `C`, it searches `D → B → C → A → object`. Check with `ClassName.__mro__`. I avoid complex multiple inheritance — prefer mixins carefully."

**Q: When do you prefer composition over inheritance?**
> "When the relationship is 'has-a' not 'is-a', when the hierarchy would exceed 2-3 levels, or when I need to change behavior at runtime. Composition is more flexible and avoids tight coupling."

---

## Key Takeaways

- Inheritance models **is-a** relationships — Dog is-a Animal ✅; Car is-a Engine ❌
- Always call `super().__init__()` to properly initialize inherited attributes
- Keep hierarchies **shallow** (≤ 3 levels) — deep chains become unmanageable
- Prefer **composition** for has-a relationships and when flexibility matters
- Use `isinstance()` (not `type()`) for type checking — it respects the inheritance chain
