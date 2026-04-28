# Composition over Inheritance: When and Why

> **Source:** https://layrs.me/course/lld/03-design-principles/composition-over-inheritance
> **Level:** Beginner | **Read:** ~14 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Composition** | Build complex objects by combining simpler objects (has-a) |
| **Inheritance** | Build complex objects by extending parent classes (is-a) |
| **Default rule** | Favor composition; use inheritance only for true is-a + polymorphism needs |
| **Runtime flexibility** | Composition lets you swap behavior at runtime — inheritance locks it at compile-time |
| **Subclass explosion** | 6 character types × 4 abilities = 24 classes; composition avoids this |

> **Key Insight:** Inheritance creates **rigid hierarchies**. Composition creates **flexible assemblies**. When you add a `HealingWarrior` class to represent a warrior that heals, you've started the path to combinatorial explosion. Composition solves this with plug-in behavior components.

---

## The Analogy — LEGO vs. Russian Dolls

- Inheritance = Russian dolls — each layer wraps the last; tightly nested, hard to change
- Composition = LEGO — independent bricks that snap together; swap pieces freely, unlimited combinations
- Favor LEGO thinking: build complex behavior by combining focused components

---

## Why This Matters in Interviews

- Interviewer gives you a deep inheritance hierarchy → ask "how would you refactor this?"
- Signal: "I see subclass explosion — a `WarriorAndHealer` class is a code smell. I'd use composition to inject behavior as components"
- Design patterns based on composition: Strategy, Decorator, Dependency Injection

> **Red flags:** Class names with "And" (WarriorAndHealer), deep hierarchies (3+ levels for behavior), parent classes with unrelated methods, multiple inheritance for behavior mixing

---

## Core Concept

### The Problem — Subclass Explosion

```python
# INHERITANCE approach — quickly explodes
class Character:
    def __init__(self, name): self.name = name

class Warrior(Character):
    def attack(self): return "Swings sword for 20 damage"

class Mage(Character):
    def attack(self): return "Casts fireball for 30 damage"

class HealingWarrior(Character):       # warrior + healing combo?
    def attack(self): return "Swings sword for 20 damage"
    def heal(self): return "Heals for 15 HP"

class HealingMage(Character):          # mage + healing combo?
    def attack(self): return "Casts fireball for 30 damage"
    def heal(self): return "Heals for 15 HP"
# 2 attack types × 3 support abilities = 6 classes and growing...
```

### The Solution — Composition

```python
from abc import ABC, abstractmethod

class AttackBehavior(ABC):
    @abstractmethod
    def execute(self) -> str: pass

class SwordAttack(AttackBehavior):
    def execute(self): return "Swings sword for 20 damage"

class MagicAttack(AttackBehavior):
    def execute(self): return "Casts fireball for 30 damage"

class HealBehavior:
    def execute(self): return "Heals for 15 HP"

class NoHeal:
    def execute(self): return "Cannot heal"

class Character:
    def __init__(self, name, attack_behavior: AttackBehavior, heal_behavior):
        self.name = name
        self._attack = attack_behavior
        self._heal = heal_behavior
    
    def attack(self): return self._attack.execute()
    def heal(self): return self._heal.execute()
    
    def set_attack(self, behavior: AttackBehavior):
        self._attack = behavior   # swap at RUNTIME!

# Any combination, no new classes
warrior = Character("Conan", SwordAttack(), NoHeal())
paladin = Character("Paladin", SwordAttack(), HealBehavior())
mage    = Character("Gandalf", MagicAttack(), HealBehavior())

print(warrior.attack())   # Swings sword for 20 damage
print(paladin.heal())     # Heals for 15 HP

warrior.set_attack(MagicAttack())   # runtime behavior swap!
print(warrior.attack())   # Casts fireball for 30 damage
```

### Real-World: Order Checkout

```python
class PaymentMethod(ABC):
    @abstractmethod
    def process(self, amount): pass

class CreditCard(PaymentMethod):
    def __init__(self, card_number): self.card_number = card_number
    def process(self, amount): return f"Charged ${amount} to card ending in {self.card_number[-4:]}"

class PayPal(PaymentMethod):
    def __init__(self, email): self.email = email
    def process(self, amount): return f"Charged ${amount} to PayPal {self.email}"

class DiscountStrategy(ABC):
    @abstractmethod
    def apply(self, amount): pass

class PercentageDiscount(DiscountStrategy):
    def __init__(self, pct): self.pct = pct
    def apply(self, amount): return amount * (1 - self.pct / 100)

class FixedDiscount(DiscountStrategy):
    def __init__(self, discount): self.discount = discount
    def apply(self, amount): return max(0, amount - self.discount)

class NoDiscount(DiscountStrategy):
    def apply(self, amount): return amount

class Order:
    """Composed of independent payment and discount components"""
    def __init__(self, items, payment: PaymentMethod, discount: DiscountStrategy):
        self.items = items
        self._payment = payment
        self._discount = discount
    
    def checkout(self):
        total = sum(item['price'] for item in self.items)
        final = self._discount.apply(total)
        return self._payment.process(final)

# Mix and match freely — Order class never changes
items = [{'price': 20}, {'price': 5}]
Order(items, CreditCard("1234567890123456"), PercentageDiscount(10)).checkout()
Order(items, PayPal("user@example.com"), FixedDiscount(5)).checkout()
Order(items, CreditCard("9999999999999999"), NoDiscount()).checkout()
```

---

## When to Use Inheritance

```python
# TRUE is-a + polymorphism needed → inheritance is correct
class Animal(ABC):
    @abstractmethod
    def sound(self): pass

class Dog(Animal):
    def sound(self): return "Woof"

class Cat(Animal):
    def sound(self): return "Meow"

# Store in a list and treat uniformly — that's the power of polymorphism
animals: list[Animal] = [Dog(), Cat()]
for a in animals: print(a.sound())   # polymorphic dispatch works correctly
```

```python
# Composition for Dog would be awkward
class Dog:
    def __init__(self): self.animal = Animal()   # bizarre — Dog IS an Animal
    def sound(self): return self.animal.sound()  # delegation loses polymorphism
```

**Decision rule:**
- **is-a + need polymorphism** → inherit
- **has-a** OR **combining behaviors from different domains** → compose

---

## Common Mistakes

### 1. Using composition for true is-a relationships

```python
# WRONG — Dog clearly IS an Animal
class Dog:
    def __init__(self): self.animal = Animal()   # awkward, loses polymorphism

# RIGHT
class Dog(Animal):
    def sound(self): return "Woof"
```

### 2. Composing concrete classes instead of abstractions

```python
# WRONG
class Robot:
    def __init__(self): self.weapon = Sword()   # hardcoded!

# RIGHT — compose with abstraction
class Robot:
    def __init__(self, weapon: Weapon):  # any Weapon works
        self.weapon = weapon
```

### 3. Mixing composition and inheritance for the same relationship

```python
# WRONG — confusing
class Car(Engine):          # inherits Engine AND
    def __init__(self): self.engine = Engine()   # composes Engine?

# RIGHT — pick one
class Car:
    def __init__(self, engine): self.engine = engine   # composition only
```

---

## Interview Q&A (Quick Fire)

**Q: Why is composition more flexible than inheritance?**
> "Composition allows runtime behavior changes by swapping component objects. Inheritance locks behavior at compile time — you'd need new subclasses. With composition, a `Robot` can switch weapons mid-game; with inheritance, that'd require `LaserRobot`, `SwordRobot`, `GunRobot` classes."

**Q: Give an example where inheritance IS better.**
> "When you have a true is-a relationship and need polymorphism. `Circle` and `Rectangle` should inherit from `Shape` so you can store them in a `list[Shape]` and call `area()` uniformly — that's polymorphic dispatch, which composition doesn't give you."

**Q: How do you test composed objects?**
> "Through dependency injection. I inject mock components. Testing an `Order` class: inject a `MockPayment` that records calls — no real credit card API needed. Testing is isolated and fast."

**Q: Name design patterns that use composition.**
> "Strategy Pattern — injecting algorithm components (our `DiscountStrategy`). Decorator Pattern — wrapping objects to add behavior. Dependency Injection — passing dependencies rather than hardcoding them. All rely on composition over inheritance."

---

## Key Takeaways

- **Favor composition by default** — use inheritance only when you have a true is-a + need polymorphism
- **Composition enables runtime flexibility** — swap components without new subclasses
- **Compose with abstractions** (interfaces/ABCs), not concrete classes — combine with DIP
- Composition is the foundation of: **Strategy, Decorator, Dependency Injection** patterns
- In design questions: explicitly say "I'll use composition here because we have a has-a relationship and need runtime flexibility"
