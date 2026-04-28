# Enums in OOP: Use Cases & Best Practices

> **Source:** https://layrs.me/course/lld/01-oop-fundamentals/enums
> **Level:** Beginner | **Read:** ~12 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Enum** | A restricted menu — you can only pick from the listed items |
| **Type safety** | Compiler/runtime stops you from passing "invalid" values |
| **Magic number** | A raw number (like `2`) with no context — enums replace these |
| **`auto()`** | Auto-assign values so you don't have to number manually |
| **Singleton** | Each enum member exists only once in memory |

> **Key Insight:** Enums replace magic numbers and error-prone strings with named constants that self-document, prevent typos, and give you IDE autocomplete.

---

## The Analogy — Traffic Lights

- **Without enum:** `if signal == "red":` — typo `"erd"` silently passes ❌
- **With enum:** `if signal == TrafficLight.RED:` — typo is an AttributeError immediately ✅
- The light can only be `RED`, `YELLOW`, or `GREEN` — a fixed set of known values. That's an enum.

---

## Why This Matters in Interviews

- **State machines** are everywhere in LLD interviews (Order status, Elevator state, ATM state)
- Enums signal you think in **type-safe, maintainable** code
- "Why not use strings?" is a classic follow-up — know the answer cold

> **Red flags:** Using raw integers/strings for states, not handling invalid enum values from external input

---

## Core Concept

### When to Use Enums

| Use enums | Don't use enums |
|---|---|
| Fixed set of states (order status) | Open-ended sets (user IDs, product names) |
| HTTP methods (GET/POST/PUT/DELETE) | Numeric ranges (age, temperature) |
| Categorical data (user roles, card suits) | External config that changes dynamically |
| Days of week, card suits | |

### Basic Enum (Python)

```python
from enum import Enum

class OrderStatus(Enum):
    PENDING   = 1
    APPROVED  = 2
    SHIPPED   = 3
    DELIVERED = 4
    CANCELLED = 5

# Access
status = OrderStatus.PENDING
print(status)         # OrderStatus.PENDING
print(status.name)    # PENDING
print(status.value)   # 1

# Iterate
for s in OrderStatus:
    print(f"{s.name}: {s.value}")

# Access by value / name
OrderStatus(2)          # OrderStatus.APPROVED
OrderStatus['SHIPPED']  # OrderStatus.SHIPPED
```

### Enum with `auto()` and Methods

```python
from enum import Enum, auto

class HttpMethod(Enum):
    GET    = auto()
    POST   = auto()
    PUT    = auto()
    DELETE = auto()

    def is_safe(self):
        return self == HttpMethod.GET

    def is_idempotent(self):
        return self in (HttpMethod.GET, HttpMethod.PUT, HttpMethod.DELETE)
```

### String-Valued Enum (for API / DB storage)

```python
class UserRole(Enum):
    ADMIN     = "admin"
    MODERATOR = "moderator"
    USER      = "user"
    GUEST     = "guest"

    @classmethod
    def from_string(cls, role_str):
        try:
            return cls(role_str.lower())
        except ValueError:
            return cls.GUEST  # safe default

# store in DB → role.value → "admin"
# parse from API → UserRole.from_string("MODERATOR")
```

### Enum-Based State Machine

```python
VALID_TRANSITIONS = {
    OrderStatus.PENDING:  [OrderStatus.APPROVED, OrderStatus.CANCELLED],
    OrderStatus.APPROVED: [OrderStatus.SHIPPED,  OrderStatus.CANCELLED],
    OrderStatus.SHIPPED:  [OrderStatus.DELIVERED],
    OrderStatus.DELIVERED: [],
    OrderStatus.CANCELLED: [],
}

def transition(current: OrderStatus, next_status: OrderStatus) -> OrderStatus:
    if next_status not in VALID_TRANSITIONS[current]:
        raise ValueError(f"Cannot transition from {current} to {next_status}")
    return next_status
```

---

## Language Cross-Reference

| Python | Java | C++ (C++11) |
|---|---|---|
| `class X(Enum): A = 1` | `public enum X { A(1) }` | `enum class X { A = 1 }` |
| Runtime type-check | Compile-time type-check | Compile-time, no implicit int conversion |
| Can add methods | Can add constructors + methods | Methods via companion class |

---

## Common Mistakes

### 1. Comparing to raw values (defeats type safety)
```python
# WRONG
if status == 1:          # What is 1? Context lost

# RIGHT
if status == OrderStatus.PENDING:
```

### 2. Mutable enum values
```python
# WRONG
class Config(Enum):
    SETTINGS = {"timeout": 30}   # mutable dict!

config.value["timeout"] = 60     # mutates the enum!

# RIGHT — use immutable types
class Config(Enum):
    SETTINGS = (30,)              # tuple (immutable)
```

### 3. Not handling invalid external input
```python
# WRONG
def set_status(code):
    return OrderStatus(code)     # raises ValueError if invalid

# RIGHT
def set_status(code):
    try:
        return OrderStatus(code)
    except ValueError:
        return OrderStatus.PENDING  # safe default
```

---

## Interview Q&A (Quick Fire)

**Q: What's wrong with using `0, 1, 2` for status codes?**
> "Magic numbers have 3 problems: (1) not self-documenting — you need a comment to know what `2` means; (2) error-prone — typo `status == 5` gives no error; (3) hard to refactor — if you change approved from `2` to `10` you must find every `2` and check context."

**Q: When would you NOT use an enum?**
> "When the set grows dynamically (user IDs, country codes from a database), or when values come from external config users control."

**Q: Are enum members singletons?**
> "Yes — `OrderStatus.PENDING is OrderStatus.PENDING` is always `True`. Safe to use `is` but `==` is more conventional."

**Q: Design a state machine for an elevator.**
```python
class ElevatorState(Enum):
    IDLE    = "idle"
    MOVING  = "moving"
    DOOR_OPEN = "door_open"

TRANSITIONS = {
    ElevatorState.IDLE:      [ElevatorState.MOVING, ElevatorState.DOOR_OPEN],
    ElevatorState.MOVING:    [ElevatorState.IDLE],
    ElevatorState.DOOR_OPEN: [ElevatorState.IDLE],
}
```

---

## Key Takeaways

- Enums define a **fixed set of named constants** — type-safe, self-documenting, IDE-friendly
- Always compare enum **members to members**, not to raw values
- Use `auto()` when specific values don't matter
- Always validate external input before constructing enums
- Enum values must be immutable — avoid dicts/lists as enum values
