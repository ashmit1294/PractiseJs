# Composition in OOP: Strong Has-A Relationship

> **Source:** https://layrs.me/course/lld/02-class-relationships/composition
> **Level:** Beginner-Intermediate | **Read:** ~13 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Composition** | "Owns-a" — container creates and destroys its parts |
| **Strong ownership** | Parts cannot exist without the container |
| **Lifecycle dependency** | Destroy the container → destroy the parts |
| **Exclusive** | A part belongs to exactly one container |
| **UML symbol** | Filled diamond (◆) on the container side |
| **vs Aggregation** | Aggregation: parts independent. Composition: parts die with container |

> **Key Insight:** Composition = the container is responsible for the ENTIRE lifecycle of its parts. A House creates its Rooms in `__init__`, and when the house is gone, the rooms are gone. Parts don't exist outside the whole.

---

## The Analogy — Human Body

- A heart belongs to exactly one body — it doesn't exist outside
- Created when the body forms, destroyed when the body is destroyed
- Contrast: employees at a company are aggregation — they existed before the company and survive if the company closes

---

## Why This Matters in Interviews

- "Favor composition over inheritance" is a core design principle — explain why
- Design questions: "Should this be composition or aggregation?" → use the lifecycle test
- Composition enables **encapsulation** — internal structure is hidden from outside

> **Red flags:** Passing parts in from outside and calling it composition, letting parts outlive the container (returning references), using inheritance when composition is the right tool

---

## Core Concept

### Basic Composition — House and Rooms

```python
class Room:
    def __init__(self, name, area):
        self.name = name
        self.area = area

    def __str__(self):
        return f"{self.name} ({self.area} sq ft)"

class House:
    def __init__(self, address):
        self.address = address
        # House CREATES and OWNS these rooms — composition
        self.rooms = [
            Room("Living Room", 300),
            Room("Bedroom", 200),
            Room("Kitchen", 150),
        ]

    def total_area(self):
        return sum(r.area for r in self.rooms)

    def __str__(self):
        room_list = ", ".join(str(r) for r in self.rooms)
        return f"{self.address} | {room_list} | Total: {self.total_area()} sqft"

my_house = House("123 Main St")
print(my_house)
# 123 Main St | Living Room (300 sq ft), Bedroom (200 sq ft), ... | Total: 650 sqft

del my_house   # rooms destroyed too — they don't exist outside
```

### Multi-Level Composition

```python
class CPU:
    def __init__(self, cores, speed_ghz):
        self.cores = cores
        self.speed_ghz = speed_ghz

    def process(self): return f"{self.cores} cores @ {self.speed_ghz}GHz"

class Memory:
    def __init__(self, size_gb):
        self.size_gb = size_gb

    def store(self, data): return f"Stored '{data}' in {self.size_gb}GB RAM"

class Motherboard:
    def __init__(self):
        self.cpu = CPU(8, 3.5)        # Motherboard creates and owns CPU
        self.memory = Memory(16)       # Motherboard creates and owns Memory

    def boot(self):
        return f"{self.cpu.process()}\n{self.memory.store('OS')}"

class Computer:
    def __init__(self, brand):
        self.brand = brand
        self.motherboard = Motherboard()   # Computer owns Motherboard

    def start(self):
        return f"{self.brand}:\n{self.motherboard.boot()}"

pc = Computer("TechBrand")
print(pc.start())
# Computer → Motherboard → CPU/Memory — all created and destroyed together
del pc   # entire chain cleaned up
```

### Composition vs Aggregation Side-by-Side

```python
# COMPOSITION — Car owns Engine
class Engine:
    def __init__(self, hp): self.hp = hp

class Car:
    def __init__(self, model):
        self.model = model
        self.engine = Engine(250)   # Car creates it, owns it exclusively

car = Car("Sedan")
# Engine lives only inside this car

# AGGREGATION — Taxi uses external Driver
class Driver:
    def __init__(self, name): self.name = name

class Taxi:
    def __init__(self, driver: Driver):
        self.driver = driver        # Driver passed in, exists independently

driver = Driver("John")
taxi = Taxi(driver)
del taxi   # taxi gone, driver still exists
print(driver.name)   # John
```

---

## Composition in Design

Composition enables **building complex objects from simple ones** without inheritance:

```python
# Composition-based design — more flexible than deep inheritance
class Logger:
    def log(self, message): print(f"[LOG] {message}")

class Validator:
    def validate(self, data) -> bool: return bool(data)

class Formatter:
    def format(self, data) -> str: return str(data).strip()

class DataProcessor:
    def __init__(self):
        # Compose capabilities from simple components
        self._logger = Logger()
        self._validator = Validator()
        self._formatter = Formatter()

    def process(self, raw_data):
        self._logger.log(f"Processing: {raw_data}")
        if not self._validator.validate(raw_data):
            raise ValueError("Invalid data")
        result = self._formatter.format(raw_data)
        self._logger.log(f"Done: {result}")
        return result

processor = DataProcessor()
print(processor.process("  hello  "))   # "hello"
```

---

## Common Mistakes

### 1. Passing parts in from outside (becomes aggregation)
```python
# WRONG — engine passed in = aggregation, not composition
class Car:
    def __init__(self, engine):  # Engine created externally
        self.engine = engine

# RIGHT — engine created inside = composition
class Car:
    def __init__(self):
        self.engine = Engine(250)  # Car controls lifecycle
```

### 2. Returning mutable references to parts (lets parts "escape")
```python
class House:
    def get_rooms(self):
        return self.rooms   # reference leak — caller can modify!

# RIGHT — return copy
def get_rooms(self):
    return self.rooms.copy()
```

### 3. Using composition for "is-a" relationships
```python
# WRONG — Dog is-a Animal, not has-a Animal
class Dog:
    def __init__(self):
        self.animal = Animal()   # awkward and wrong

# RIGHT — inheritance for is-a
class Dog(Animal): ...
```

### 4. Shallow-copying a composed object
```python
import copy
house1 = House("123 Main St")
house2 = copy.copy(house1)        # shallow — same room objects!
house2.rooms[0].name = "Studio"   # modifies house1's room too!

# RIGHT — deep copy when needed
house2 = copy.deepcopy(house1)    # fully independent
```

---

## Interview Q&A (Quick Fire)

**Q: "Favor composition over inheritance" — why?**
> "Inheritance creates tight coupling — changes to parent ripple down. Composition is flexible: you can swap components, mock them in tests, and combine behaviors from multiple sources. Plus you avoid the fragile base class problem and deep hierarchies."

**Q: How do you test composed objects?**
> "Inject dependencies even in composition — pass concrete types as constructor params. Or use factory methods that create the composed parts. This lets you inject mocks. Alternatively, test the whole unit since composed parts are internal details."

**Q: Lifecycle management in different languages?**
> "Python: garbage collector handles it when no references remain. Java: GC handles it, use `AutoCloseable` for resources. C++: RAII — composed objects as value members (`vector<Room>`) are destroyed automatically in destructor."

**Q: When to choose composition over aggregation?**
> "Use composition when: (1) the part has no meaning outside the whole, (2) the part should be created and destroyed with the container, (3) you want exclusive ownership. Use aggregation when parts are shared or pre-exist."

---

## Key Takeaways

- Composition = "owns-a" — the container **creates** parts in `__init__` and **owns** their lifecycle
- Parts are **exclusive** to one container and **destroyed** when the container is destroyed
- **Favor composition over inheritance** — more flexible, less coupled, easier to test
- Return **copies** of parts, not references — prevent parts from "escaping" the container
- The lifecycle test: container creates parts internally? → composition. Parts passed in? → aggregation
