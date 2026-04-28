# Classes and Objects in OOP Explained

> **Source:** https://layrs.me/course/lld/01-oop-fundamentals/classes-and-objects
> **Level:** Beginner | **Read:** ~15 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Class** | Cookie cutter — defines the shape, not the cookie itself |
| **Object** | The actual cookie — a specific instance with real data |
| **Constructor** | The setup function that runs when an object is born |
| **Instance attribute** | Data that belongs to ONE specific object |
| **Class attribute** | Data shared across ALL objects of that class |
| **`self` / `this`** | "Me" — the specific object calling the method |

> **Key Insight:** A class is a blueprint. Objects are what you actually use. One class → infinite objects, each with their own data, sharing the same methods.

---

## The Analogy — Cookie Cutter

- **Cookie cutter** = Class → defines shape, but isn't edible
- **Each cookie** = Object → made from the cutter, but with different toppings (data)
- **Constructor** = The act of pressing the cutter into dough (initializes each cookie)
- Same cutter, different cookies: `Dog` class → `buddy`, `max`, `luna` — all dogs, different names/ages

---

## Why This Matters in Interviews

- Interviewers ask **"Design a class to model X"** (parking lot, library, social network)
- **What they want to see:**
  - Can you identify attributes vs methods?
  - Do you think about validation (guard against invalid state)?
  - Can you explain `self`/`this` without hesitation?
- **Junior:** "A class has variables and functions" ❌
- **Mid-level:** Knows class vs instance attributes, validates inputs ✅
- **Senior:** Designs for extensibility, mentions encapsulation trade-offs ✅✅

> **Red flags:** Forgetting `self`, sharing mutable defaults, no validation logic

---

## Core Concept

### What Is a Class?

A class is a **template or blueprint** defining structure (attributes) and behavior (methods):

```python
class Car:
    # Class attribute — shared by ALL cars
    wheels = 4

    def __init__(self, color, model, year):   # Constructor
        # Instance attributes — unique per car
        self.color = color
        self.model = model
        self.year = year

    def honk(self):
        return f"{self.model} says Beep!"
```

### What Is an Object?

An **object (instance)** is a concrete realization of a class with actual data:

```python
car1 = Car("red", "Toyota Camry", 2020)    # instantiate
car2 = Car("blue", "Honda Accord", 2019)

print(car1.color)   # red  — own data
print(car2.color)   # blue — own data
print(car1.honk())  # Toyota Camry says Beep!
print(Car.wheels)   # 4    — shared class attribute
```

### The Constructor

`__init__` runs **automatically** when an object is created. It ensures every object starts in a valid state:

```python
class BankAccount:
    def __init__(self, account_number, owner, initial_balance=0):
        if initial_balance < 0:
            raise ValueError("Balance cannot be negative")
        self.account_number = account_number
        self.owner = owner
        self.balance = initial_balance

    def deposit(self, amount):
        if amount <= 0:
            return "Deposit must be positive"
        self.balance += amount
        return f"New balance: ${self.balance}"

    def withdraw(self, amount):
        if amount > self.balance:
            return "Insufficient funds"
        self.balance -= amount
        return f"New balance: ${self.balance}"
```

### Class vs Instance Attributes

| Type | Scope | When to Use |
|---|---|---|
| **Instance attribute** (`self.x`) | One specific object | Data that differs per object (name, age) |
| **Class attribute** (`ClassName.x`) | All objects of the class | Constants shared by all (species, wheels) |

---

## Language Cross-Reference

| Python | Java | JavaScript |
|---|---|---|
| `def __init__(self, x):` | `public ClassName(Type x) {}` | `constructor(x) {}` |
| `self.x = x` | `this.x = x;` | `this.x = x;` |
| `self` | `this` | `this` |

---

## Common Mistakes

### 1. Forgetting `self` in method definitions
```python
# WRONG
class Car:
    def __init__(model, year):   # Missing self!
        self.model = model       # TypeError at runtime

# RIGHT
class Car:
    def __init__(self, model, year):
        self.model = model
```

### 2. Mutable default argument trap
```python
# WRONG — all Team objects share the SAME list
class Team:
    def __init__(self, name, members=[]):
        self.members = members   # Shared across all instances!

# RIGHT
class Team:
    def __init__(self, name, members=None):
        self.members = members if members is not None else []
```

### 3. Forgetting `return` in methods
```python
# WRONG
class Calculator:
    def add(self, a, b):
        result = a + b   # Never returned → returns None

# RIGHT
class Calculator:
    def add(self, a, b):
        return a + b
```

### 4. Referencing class without instantiation
```python
# WRONG
my_book = Book   # Just the class itself, no object created
print(my_book.title)   # AttributeError

# RIGHT
my_book = Book("1984", "Orwell")   # Parentheses = create object
```

---

## Interview Q&A (Quick Fire)

**Q: What's the difference between a class and an object?**
> "A class is a blueprint; an object is an instance created from it. `Car` is a class, `my_toyota` with `color='red'` is an object. Multiple objects can be created from one class, each with different data."

**Q: What is `self` in Python?**
> "`self` is a reference to the current object instance. It lets Python distinguish `dog1.bark()` from `dog2.bark()` — `self` points to `dog1` in the first call. Java/C++ use `this` for the same purpose."

**Q: What does the constructor do?**
> "It initializes the object in a valid state when created. Without it, you'd have to manually set every attribute, which is error-prone. It's called automatically when you write `ClassName(args)`."

**Q: Design a `Rectangle` class.**
```python
class Rectangle:
    def __init__(self, width, height):
        if width <= 0 or height <= 0:
            raise ValueError("Dimensions must be positive")
        self.width = width
        self.height = height

    def area(self):
        return self.width * self.height

    def perimeter(self):
        return 2 * (self.width + self.height)

    def is_square(self):
        return self.width == self.height
```

---

## Key Takeaways

- Classes are blueprints (attributes + methods); objects are instances with actual data
- Constructors (`__init__`) initialize objects in a valid starting state
- Each object owns its own attribute values; methods are shared
- Use `self` (Python) / `this` (Java/JS) to refer to the current instance
- Always validate constructor inputs — prevent invalid object states early
