# Abstract Classes vs Interfaces in OOP

> **Source:** https://layrs.me/course/lld/01-oop-fundamentals/abstract-classes-vs-interfaces
> **Level:** Intermediate | **Read:** ~13 min

---

## TL;DR (Cheat Sheet)

| | Abstract Class | Interface |
|---|---|---|
| **Implementation** | Partial allowed | Pure contract (traditionally) |
| **State** | Can have instance variables | No state (only constants) |
| **Multiple inheritance** | ❌ Single only | ✅ Implement many |
| **Relationship** | "is-a" | "can-do" |
| **Use case** | Shared code + hierarchy | Capabilities across unrelated types |
| **Coupling** | Tighter | Looser |

> **Key Insight:** Abstract class = "is-a with shared code". Interface = "can-do, regardless of what you are". A `Duck` is-an `Animal` (abstract class) AND can-fly (interface) AND can-swim (interface).

---

## The Analogy

- **Abstract class** → Franchise restaurant: common recipe + kitchen equipment, each location adds local flair
- **Interface** → Electrical socket contract: any device that fits the socket works — no shared structure required

---

## Why This Matters in Interviews

- This is asked in virtually every OOP interview
- Must explain with trade-offs, not just definitions
- Connect to ISP and DIP from SOLID

> **Red flags:** Can't give a concrete design example, saying "interfaces are always better", not mentioning multiple inheritance trade-off

---

## Core Concept

### Abstract Class — Shared Implementation

```python
from abc import ABC, abstractmethod

class Vehicle(ABC):
    def __init__(self, brand, model):
        self.brand = brand        # shared state
        self.model = model
        self._is_running = False

    def start(self):              # concrete — shared by all vehicles
        self._is_running = True
        print(f"{self.brand} {self.model} started")

    def stop(self):               # concrete — shared
        self._is_running = False

    @abstractmethod
    def drive(self): pass         # abstract — each vehicle implements differently

class Car(Vehicle):
    def drive(self):
        if self._is_running:
            print(f"Driving {self.brand} {self.model} on road")

class Boat(Vehicle):
    def drive(self):
        if self._is_running:
            print(f"Sailing {self.brand} {self.model} on water")

car = Car("Toyota", "Camry")
car.start()   # Toyota Camry started
car.drive()   # Driving Toyota Camry on road
# Vehicle("Generic", "X")  # TypeError — can't instantiate abstract class
```

### Interface — Capabilities Across Unrelated Types

```python
class Flyable(ABC):
    @abstractmethod
    def fly(self): pass

    @abstractmethod
    def land(self): pass

class Swimmable(ABC):
    @abstractmethod
    def swim(self): pass

class Walkable(ABC):
    @abstractmethod
    def walk(self): pass

# Duck can do all three — multiple interfaces
class Duck(Flyable, Swimmable, Walkable):
    def __init__(self, name): self.name = name
    def fly(self): print(f"{self.name} flies")
    def land(self): print(f"{self.name} lands")
    def swim(self): print(f"{self.name} swims")
    def walk(self): print(f"{self.name} walks")

class Fish(Swimmable):
    def __init__(self, name): self.name = name
    def swim(self): print(f"{self.name} swims")

# Polymorphism via interface
def make_it_swim(swimmer: Swimmable):
    swimmer.swim()

make_it_swim(Duck("Donald"))  # Donald swims
make_it_swim(Fish("Nemo"))    # Nemo swims
```

### Combining Both (Real-World)

```python
# Abstract class for shared employee behavior
class Employee(ABC):
    def __init__(self, name, salary):
        self.name = name
        self.salary = salary

    def get_details(self):           # shared — no override needed
        return f"{self.name}"

    @abstractmethod
    def calculate_bonus(self): pass  # each type calculates differently

# Interfaces for capabilities
class Technical(ABC):
    @abstractmethod
    def write_code(self): pass

class Manageable(ABC):
    @abstractmethod
    def manage_team(self): pass

class Developer(Employee, Technical):
    def calculate_bonus(self): return self.salary * 0.10
    def write_code(self): return f"{self.name} writes code"

class TechLead(Employee, Technical, Manageable):
    def __init__(self, name, salary, team_size):
        super().__init__(name, salary)
        self.team_size = team_size

    def calculate_bonus(self): return self.salary * 0.15 + (self.team_size * 1000)
    def write_code(self): return f"{self.name} codes (sometimes)"
    def manage_team(self): return f"{self.name} manages {self.team_size} devs"
```

---

## When to Use Each

```
Need to share implementation code?
    YES → Abstract Class
    NO  → Interface

Need multiple inheritance?
    YES → Interface(s)
    NO  → Either works; prefer interface for looser coupling

Related classes with is-a relationship?
    YES → Abstract Class

Unrelated classes sharing a capability?
    YES → Interface
```

---

## Language-Specific Notes

| | Python | Java | C++ |
|---|---|---|---|
| Abstract class | `class X(ABC):` | `abstract class X {}` | Class with pure virtual methods |
| Interface | `class X(ABC):` (no state/impl) | `interface X {}` | Class with only pure virtual methods (`= 0`) |
| Multiple impl | `class D(B, C):` | `class D implements B, C {}` | `class D : public B, public C {}` |
| Java 8+ note | N/A | Interfaces can have `default` methods | N/A |

---

## Common Mistakes

### 1. Using abstract class for unrelated capability
```python
# BAD — Printer "is-a" Printable? Awkward.
class Printable(ABC):
    @abstractmethod
    def print(self): pass

class Printer(Printable): ...   # should be an interface, not is-a

# GOOD — keep interface for capability
```

### 2. State in interfaces
```python
# BAD — interface with state
class Comparable(ABC):
    def __init__(self): self.count = 0   # state in interface!

# GOOD — pure contract
class Comparable(ABC):
    @abstractmethod
    def compare_to(self, other): pass
```

### 3. Deep abstract class hierarchies
```python
# BAD — 7 levels!
LivingThing → Animal → Mammal → Carnivore → Canine → Dog → GoldenRetriever

# GOOD — flat + interfaces
class Animal(ABC): ...
class Dog(Animal, Huntable): ...   # Huntable is an interface
```

---

## Interview Q&A (Quick Fire)

**Q: The classic — Abstract class vs Interface?**
> "Abstract class: partial implementation + state, single inheritance, use for is-a with shared code. Interface: pure contract, no state, multiple inheritance, use for can-do capabilities across unrelated classes. Abstract classes give code reuse; interfaces give flexibility."

**Q: Why can't you just use interfaces everywhere?**
> "Abstract classes prevent code duplication. If 10 subclasses share the same validation logic, put it in the abstract class once. With only interfaces, you'd duplicate that logic 10 times or use composition, adding complexity."

**Q: How do SOLID principles relate?**
> "ISP (Interface Segregation) → keep interfaces small, split large ones. DIP (Dependency Inversion) → depend on interfaces/abstract classes, not concrete classes. LSP → abstract class enforces that subclasses are proper substitutes."

**Q: Design a payment system.**
> "I'd have an abstract `Payment` class with shared `log_transaction()` method and abstract `process_payment()`. A `Refundable` interface for payment types that support refunds. `CreditCard` extends `Payment` and implements `Refundable`. `PayPal` extends `Payment` but NOT `Refundable` — PayPal transactions are final."

---

## Key Takeaways

- **Abstract class** = shared code + is-a hierarchy + single inheritance
- **Interface** = pure contract + can-do capabilities + multiple inheritance
- Python uses `ABC` for both — the distinction is conceptual (no state/impl in interfaces)
- Keep hierarchies **shallow**, prefer **composition**, use **multiple interfaces** for flexibility
- In interviews: state your **choice with trade-offs** — "I'd use an interface here because ISP..."
