# Polymorphism in OOP: Runtime vs Compile-Time

> **Source:** https://layrs.me/course/lld/01-oop-fundamentals/polymorphism
> **Level:** Intermediate | **Read:** ~14 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Polymorphism** | One interface, many implementations — "many forms" |
| **Runtime polymorphism** | Which method runs is decided *at runtime* based on actual object type |
| **Compile-time polymorphism** | Which method runs is decided *at compile time* based on signature |
| **Method overriding** | Child replaces parent's method — runtime polymorphism |
| **Method overloading** | Same name, different params in same class — compile-time |
| **Duck typing** | Python: "if it has `.speak()`, call it" — no inheritance needed |
| **vtable** | C++/Java lookup table enabling dynamic dispatch |

> **Key Insight:** Polymorphism = write code once against an interface, have it work for all implementations. This is the *Open/Closed Principle* in action — add `Bird` without changing any existing code.

---

## The Analogy — Universal Remote

- One remote (interface) with a "power" button
- Works on a TV, DVD player, AC unit — each responds differently
- You don't know or care which device is behind the button
- Adding a new device never changes the remote's interface

---

## Why This Matters in Interviews

- Polymorphism is what makes design patterns work
- "Replace if-isinstance chain with polymorphism" is a classic refactor question
- Design Q: "How would you add a new payment method without changing checkout logic?"

> **Red flags:** `isinstance` chains instead of polymorphic dispatch, not knowing overloading vs overriding difference

---

## Core Concept

### 1. Runtime Polymorphism (Method Overriding)

```python
class Animal:
    def make_sound(self):
        return "Generic sound"

    def describe(self):
        return f"I say: {self.make_sound()}"   # polymorphic call

class Dog(Animal):
    def make_sound(self): return "Woof!"

class Cat(Animal):
    def make_sound(self): return "Meow!"

class Bird(Animal):
    def make_sound(self): return "Chirp!"

# One function, all animal types
def concert(animals):
    for a in animals:
        print(a.make_sound())   # runtime dispatch

concert([Dog(), Cat(), Bird(), Animal()])
# Woof! / Meow! / Chirp! / Generic sound

dog = Dog()
print(dog.describe())   # "I say: Woof!" — parent uses child's override
```

### 2. Compile-Time Polymorphism (Method Overloading)

Python doesn't support true overloading. Use default args or `*args`:

```python
class Calculator:
    def add(self, a, b, c=0):     # default argument approach
        return a + b + c

# Java (true overloading — compiler picks at compile time):
# public int add(int a, int b) { ... }
# public int add(int a, int b, int c) { ... }
# public double add(double a, double b) { ... }
```

### 3. Duck Typing (Python's Dynamic Polymorphism)

```python
class Dog:
    def speak(self): return "Woof!"

class Person:
    def speak(self): return "Hello!"

# No inheritance needed — just needs a .speak() method
def make_it_speak(thing):
    return thing.speak()

make_it_speak(Dog())     # Woof!
make_it_speak(Person())  # Hello!
```

### 4. Polymorphism with ABC

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self) -> float: pass

    @abstractmethod
    def perimeter(self) -> float: pass

    def describe(self):
        return f"Area: {self.area():.2f}, Perimeter: {self.perimeter():.2f}"

class Rectangle(Shape):
    def __init__(self, w, h): self.w, self.h = w, h
    def area(self): return self.w * self.h
    def perimeter(self): return 2 * (self.w + self.h)

class Circle(Shape):
    def __init__(self, r): self.r = r
    def area(self): return 3.14159 * self.r ** 2
    def perimeter(self): return 2 * 3.14159 * self.r

shapes = [Rectangle(5, 3), Circle(4), Rectangle(2, 8)]
total = 0
for s in shapes:
    print(s.describe())
    total += s.area()
print(f"Total area: {total:.2f}")
```

---

## Polymorphism vs isinstance Chains

```python
# BAD — violates Open/Closed, must change when adding new type
def process(animal):
    if isinstance(animal, Dog): return "Woof!"
    elif isinstance(animal, Cat): return "Meow!"
    # What about Bird?? Must edit this function!

# GOOD — adding Bird never touches this function
def process(animal):
    return animal.make_sound()
```

---

## Language Notes

| Feature | Python | Java | C++ |
|---|---|---|---|
| Runtime polymorphism | All methods by default | Non-final/private methods | Only `virtual` methods |
| Compile-time polymorphism | Not directly supported | Method overloading | Method overloading |
| Duck typing | ✅ | ❌ | ❌ (templates achieve similar) |

---

## Common Mistakes

### 1. Python overloading trap
```python
class Calculator:
    def add(self, a, b): return a + b
    def add(self, a, b, c): return a + b + c  # replaces first!

calc.add(5, 3)  # TypeError — second def requires 3 args
```

### 2. Breaking parent contract (LSP violation)
```python
class Animal:
    def make_sound(self): return "Sound"

class Dog(Animal):
    def make_sound(self, volume):   # changed signature! breaks polymorphism
        return "Woof!" * volume
```

### 3. Type-checking instead of polymorphism
```python
# WRONG
if type(shape) == Circle: ...
elif type(shape) == Rectangle: ...

# RIGHT
shape.area()   # polymorphic dispatch
```

---

## Interview Q&A (Quick Fire)

**Q: Two types of polymorphism?**
> "Compile-time (method overloading) — resolved by compiler based on signature. Runtime (method overriding) — resolved by runtime based on actual object type."

**Q: What is dynamic dispatch / vtable?**
> "When a virtual method is called, the runtime looks up the actual implementation in a vtable (virtual method table). This is how Java/C++ implement runtime polymorphism. Python does this for all methods by default."

**Q: What is duck typing?**
> "Python's approach: if an object has the method, call it — regardless of type or inheritance. 'If it walks like a duck and quacks like a duck, it's a duck.' Pros: maximum flexibility. Cons: errors at runtime, not compile time."

**Q: How would you add a new shape without changing existing code?**
```python
class Triangle(Shape):       # just implement the interface
    def __init__(self, b, h): self.b, self.h = b, h
    def area(self): return 0.5 * self.b * self.h
    def perimeter(self): return 3 * self.b   # simplified

# All existing code (total area loop, describe) works unchanged ✅
```

---

## Key Takeaways

- Polymorphism = **one interface, many implementations** — write generic code once
- **Runtime** (overriding) decided by actual object type at execution; **compile-time** (overloading) decided by signature
- Python uses **duck typing** — no inheritance needed, just the right methods
- Prefer polymorphic dispatch over `isinstance` chains — extensible without modification
- Polymorphism powers nearly every design pattern: Strategy, Factory, Observer, Template Method
