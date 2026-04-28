# Method Overloading vs Overriding in OOP

> **Source:** https://layrs.me/course/lld/01-oop-fundamentals/method-overloading-vs-overriding
> **Level:** Beginner-Intermediate | **Read:** ~12 min

---

## TL;DR (Cheat Sheet)

| | Overloading | Overriding |
|---|---|---|
| **Where** | Same class | Child class over parent method |
| **When decided** | Compile-time (static dispatch) | Runtime (dynamic dispatch) |
| **Parameters** | Different (number/type) | Must match parent signature |
| **Polymorphism type** | Compile-time | Runtime |
| **Python support** | ❌ Native (use defaults/`*args`) | ✅ Native |
| **Java/C++ support** | ✅ | ✅ |

> **Key Insight:** Overloading = convenience (same name, different inputs). Overriding = customization (same signature, different behavior in child). Python skips overloading — the second definition replaces the first.

---

## The Analogy

- **Overloading:** A café "make drink" button that behaves differently if you tap once (espresso) vs twice (latte) vs long-press (americano) — same action, different input
- **Overriding:** A franchise's "make latte" recipe — corporate (parent) has a default, but each location (child) can customize it

---

## Why This Matters in Interviews

- Classic interview question in EVERY OOP round
- Must explain compile-time vs runtime distinction clearly
- Python devs must know workarounds since Python lacks true overloading

> **Red flags:** Saying Python supports overloading, changing method signature when overriding, not using `super()`

---

## Core Concept

### Method Overloading (Compile-Time)

**Java — true overloading:**
```java
class Calculator {
    public int add(int a, int b)              { return a + b; }
    public int add(int a, int b, int c)       { return a + b + c; }
    public double add(double a, double b)     { return a + b; }
}

Calculator calc = new Calculator();
calc.add(5, 3);       // → int version (compiler picks at compile time)
calc.add(5, 3, 2);    // → 3-arg version
calc.add(5.5, 3.2);   // → double version
```

**Python — workarounds:**
```python
# Option 1: Default arguments
class Calculator:
    def add(self, a, b, c=0):
        return a + b + c

calc = Calculator()
calc.add(5, 3)      # 8
calc.add(5, 3, 2)   # 10

# Option 2: *args for any number
class Calculator:
    def add(self, *args):
        return sum(args)

calc.add(5, 3)         # 8
calc.add(5, 3, 2)      # 10
calc.add(1, 2, 3, 4)   # 10

# Option 3: singledispatch (true type-based dispatch)
from functools import singledispatch

@singledispatch
def process(data):
    return str(data)

@process.register(int)
def _(data): return data * 2

@process.register(list)
def _(data): return sum(data)
```

### Method Overriding (Runtime)

```python
class Animal:
    def make_sound(self):
        return "Generic sound"

    def describe(self):
        return f"I say: {self.make_sound()}"   # will use child's version!

class Dog(Animal):
    def make_sound(self):    # overrides parent
        return "Woof!"

class Cat(Animal):
    def make_sound(self):
        return "Meow!"

animals = [Dog(), Cat(), Animal()]
for a in animals:
    print(a.make_sound())
# Woof! / Meow! / Generic sound

# Variable type vs actual type
pet: Animal = Dog()
print(pet.make_sound())   # "Woof!" — runtime dispatch uses Dog's version
print(pet.describe())     # "I say: Woof!" — parent's method calls child's override
```

### Extending with `super()`

```python
class BankAccount:
    def __init__(self, balance):
        self.balance = balance

    def deposit(self, amount):
        self.balance += amount
        return f"Deposited ${amount}. Balance: ${self.balance}"

class SavingsAccount(BankAccount):
    def __init__(self, balance, rate):
        super().__init__(balance)   # ← always call parent init first!
        self.rate = rate

    def deposit(self, amount):
        result = super().deposit(amount)     # extend, don't replace
        interest = amount * self.rate
        self.balance += interest
        return f"{result} (+${interest:.2f} interest)"

acc = SavingsAccount(1000, 0.05)
print(acc.deposit(100))
# Deposited $100. Balance: $1100 (+$5.00 interest)
```

---

## Python Overloading Trap

```python
# DANGER — second definition silently replaces first
class Calculator:
    def add(self, a, b):     return a + b
    def add(self, a, b, c):  return a + b + c   # replaces above!

calc = Calculator()
calc.add(5, 3)    # TypeError: add() missing 1 required positional argument
```

---

## `@Override` in Java (Best Practice)

```java
class Animal {
    public String makeSound() { return "Generic"; }
}

class Dog extends Animal {
    @Override                        // explicit annotation — compiler catches mistakes
    public String makeSound() { return "Woof!"; }

    // Without @Override, a typo like makeSoound() creates a NEW method silently!
}
```

---

## Common Mistakes

### 1. Changing signature when overriding (breaks polymorphism)
```python
class Animal:
    def make_sound(self): return "Sound"

class Dog(Animal):
    def make_sound(self, volume):   # different signature = new method, not override!
        return "Woof!" * volume

animals: list[Animal] = [Dog()]
animals[0].make_sound()    # TypeError — expects volume arg!
```

### 2. Forgetting `super().__init__()` in constructor override
```python
class Dog(Animal):
    def __init__(self, name, breed):
        self.breed = breed   # parent attrs never initialized!

dog = Dog("Buddy", "Lab")
print(dog.name)   # AttributeError
```

### 3. Trying to override private methods
```python
class Parent:
    def __private(self): return "parent"   # becomes _Parent__private

class Child(Parent):
    def __private(self): return "child"    # becomes _Child__private — NOT an override!
```

---

## Interview Q&A (Quick Fire)

**Q: Overloading vs Overriding in one sentence each?**
> "Overloading: same method name, different parameters, same class, resolved at compile time. Overriding: same method signature, different implementation, child class, resolved at runtime."

**Q: Does Python support method overloading?**
> "No native support. If you define two methods with the same name, the second replaces the first. We use default arguments, `*args`, or `functools.singledispatch` to achieve similar behavior."

**Q: Can you overload based on return type only?**
> "No — in Java/C++, overloading requires different parameter lists. The compiler can't tell which version to call from `calc.getValue()` alone since the call syntax is identical regardless of return type."

**Q: What's the risk of overriding without `super()`?**
> "You completely skip the parent's initialization. Parent-defined attributes never get set, leading to AttributeError when you try to access them. Always call `super().__init__()` first when overriding `__init__`."

---

## Key Takeaways

- **Overloading** = same name, different params, same class, **compile-time** decision
- **Overriding** = same signature, child replaces parent, **runtime** decision
- Python has **no native overloading** — use default args, `*args`, or `singledispatch`
- Always keep the **same signature** when overriding; use `super()` to extend parent behavior
- Java's `@Override` annotation is a safety net — catches accidental new-method-creation
