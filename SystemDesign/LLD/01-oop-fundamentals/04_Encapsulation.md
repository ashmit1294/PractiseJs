# Encapsulation in OOP: Definition & Examples

> **Source:** https://layrs.me/course/lld/01-oop-fundamentals/encapsulation
> **Level:** Beginner | **Read:** ~12 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Encapsulation** | Bundle data + methods together, hide the internals |
| **Private** (`__x`) | Only this class can touch it |
| **Protected** (`_x`) | Convention: only this class + subclasses should touch it |
| **Public** | Anyone can access |
| **`@property`** | Python getter/setter with attribute-like syntax |
| **Name mangling** | Python's `__x` becomes `_ClassName__x` — not true security |

> **Key Insight:** Encapsulation = control access to prevent invalid states. A `BankAccount` shouldn't let anyone set `balance = -500` directly. All changes go through methods that validate first.

---

## The Analogy — Car Dashboard

- You interact with **pedals, steering wheel, buttons** (public interface)
- You don't touch the fuel injectors or timing belt (private internals)
- If you had direct access to internals and changed the wrong thing → broken car
- Encapsulation = controlled access through defined operations

---

## Why This Matters in Interviews

- Shows you think about **data integrity** — not just algorithms
- Demonstrates knowledge of **access modifiers** and their differences across languages
- Interviewers distinguish: "encapsulation ≠ just making things private"

> **Red flags:** Making everything private with no reasoning, providing setters without validation, returning mutable internal lists directly

---

## Core Concept

### Access Levels

| Level | Python | Java/C++ | Who can access |
|---|---|---|---|
| **Public** | `x` (no prefix) | `public` | Anyone |
| **Protected** | `_x` (convention) | `protected` | Class + subclasses |
| **Private** | `__x` (name mangling) | `private` | Only this class |

### Basic Encapsulation

```python
class BankAccount:
    def __init__(self, holder, initial_balance):
        self.holder = holder          # public
        self.__balance = initial_balance  # private

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("Deposit must be positive")
        self.__balance += amount

    def withdraw(self, amount):
        if amount <= 0:
            raise ValueError("Withdrawal must be positive")
        if amount > self.__balance:
            raise ValueError("Insufficient funds")
        self.__balance -= amount

    def get_balance(self):
        return self.__balance

account = BankAccount("Alice", 1000)
account.deposit(500)
account.withdraw(200)
print(account.get_balance())   # 1300
# account.__balance = -999    # AttributeError — blocked!
```

### Pythonic Way — `@property`

```python
class Employee:
    def __init__(self, name, salary):
        self._name = name
        self._salary = salary

    @property
    def salary(self):             # getter
        return self._salary

    @salary.setter
    def salary(self, value):      # setter with validation
        if value < 0:
            raise ValueError("Salary cannot be negative")
        if value > 1_000_000:
            raise ValueError("Salary exceeds maximum")
        self._salary = value

    @property
    def annual_salary(self):      # computed, read-only
        return self._salary * 12

emp = Employee("Bob", 5000)
print(emp.salary)         # 5000 (calls getter — looks like attribute)
emp.salary = 6000         # calls setter with validation
print(emp.annual_salary)  # 72000
# emp.annual_salary = 999 # AttributeError — no setter defined
```

---

## Common Mistakes

### 1. Setters without validation (pointless encapsulation)
```python
# WRONG
def set_balance(self, balance):
    self.__balance = balance   # No validation — defeats purpose!

# RIGHT — guard the invariant
def set_balance(self, balance):
    if balance < 0:
        raise ValueError("Balance cannot be negative")
    self.__balance = balance
```

### 2. Returning mutable internal objects
```python
# WRONG — external code can mutate the list directly
class Team:
    def __init__(self): self.__members = []
    def get_members(self): return self.__members   # reference leak!

team = Team()
team.get_members().append("Hacker")   # bypasses any validation!

# RIGHT — return a copy
def get_members(self): return self.__members.copy()
```

### 3. Making everything private reflexively
```python
# OVER-ENCAPSULATED — unnecessary boilerplate
class Person:
    def __init__(self, name): self.__name = name
    def get_name(self): return self.__name   # No validation, no reason to hide
```
> Rule: use private only when you need **validation** or want to **reserve the right to change implementation**

### 4. Thinking Python's `__` is security
```python
# __balance becomes _BankAccount__balance — accessible if you know the trick
print(account._BankAccount__balance)   # works! not true security
```
> Python relies on developer discipline. `__` prevents accidental subclass collision, not hacking.

---

## Interview Q&A (Quick Fire)

**Q: What's the difference between encapsulation and abstraction?**
> "Encapsulation = hiding **data** (private fields + access control). Abstraction = hiding **complexity** (simplified interface). Encapsulation is the technique; abstraction is the goal. They work together — encapsulate internals to provide an abstracted interface."

**Q: Why not just make all attributes public?**
> "Three reasons: (1) data integrity — you can enforce invariants in setters; (2) flexibility — you can change how data is stored without breaking callers; (3) reduced coupling — callers don't depend on your internal structure."

**Q: How do you implement a read-only attribute?**
> "In Python: `@property` with no `@x.setter`. In Java: `private` field with only a getter method."

---

## Key Takeaways

- Encapsulation = **bundle + control**: group data+methods together, restrict direct access
- Use `private`/`@property` when you need **validation** or **flexibility to change internals**
- Always validate in setters — otherwise encapsulation is theater
- Return **copies** of mutable internal objects (lists, dicts) to prevent external mutation
- Python uses **naming conventions** (`_`, `__`), not strict enforcement like Java/C++
