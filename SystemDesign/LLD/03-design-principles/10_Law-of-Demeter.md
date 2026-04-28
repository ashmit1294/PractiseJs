# Law of Demeter: Principle of Least Knowledge

> **Source:** https://layrs.me/course/lld/03-design-principles/law-of-demeter
> **Level:** Beginner | **Read:** ~12 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Law of Demeter (LoD)** | Only talk to your immediate friends — not strangers |
| **Principle of Least Knowledge** | The alternate name — minimize what each object knows |
| **Train wreck** | `obj.getA().getB().doSomething()` — navigation through strangers |
| **"One dot" heuristic** | More than one `.` per expression often signals a violation |
| **Tell, Don't Ask** | Related concept — ask objects to do work, not expose internals |

> **Key Insight:** Every time you chain through another object's internals (`customer.getWallet().getMoney().getAmount()`), you create a dependency on the entire chain. Change anything in that chain and the calling code breaks. LoD pushes responsibility down to where the data lives.

---

## The Analogy — Office Hierarchy

- CEO asks an employee directly: "Get me the Q3 report" — that's good (one hop)
- CEO says: "Call Bob's manager's assistant's intern who has the report" — that's a train wreck
- LoD: the CEO talks to the direct report; the report navigates internally

---

## Why This Matters in Interviews

- "What's wrong with `order.getCustomer().getAddress().getZipCode()`?" → LoD violation
- Signal: "The client knows too much about Order's internal structure. I'd add `order.getCustomerZipCode()` and let Order navigate internally."
- Shows: encapsulation thinking, coupling awareness

> **Red flags:** `obj.getX().getY().getZ()` chains, exposing public collections (`self.items = []`), client code navigating object graphs

---

## The Four Allowed Calls

A method `M` in object `O` may call methods on:

1. `O` itself (`self`)
2. Objects passed as **parameters** to `M`
3. Objects **created locally** within `M`
4. **Direct components** of `O` (instance variables)

**NOT allowed**: objects returned by method calls (navigating through strangers)

---

## Core Concept

### Violation — Train Wreck

```python
class Money:
    def __init__(self, amount): self.amount = amount
    def get_amount(self): return self.amount

class Wallet:
    def __init__(self, money): self.money = money
    def get_money(self): return self.money

class Customer:
    def __init__(self, wallet): self.wallet = wallet
    def get_wallet(self): return self.wallet

# CLIENT CODE — VIOLATION
def process_payment(customer, price):
    # Reaches through Customer → Wallet → Money — coupled to entire chain
    available = customer.get_wallet().get_money().get_amount()
    if available >= price:
        print(f"Payment of ${price} approved")
```

### Following LoD — Push Responsibility Down

```python
class Money:
    def __init__(self, amount): self._amount = amount
    def is_sufficient(self, required): return self._amount >= required
    def subtract(self, amount):
        if self.is_sufficient(amount):
            self._amount -= amount
            return True
        return False

class Wallet:
    def __init__(self, money): self._money = money
    def can_afford(self, price): return self._money.is_sufficient(price)
    def deduct(self, price): return self._money.subtract(price)

class Customer:
    def __init__(self, wallet): self._wallet = wallet
    def make_payment(self, price) -> bool:
        """Customer handles its own payment logic — client stays out"""
        if self._wallet.can_afford(price):
            return self._wallet.deduct(price)
        return False

# CLIENT CODE — LoD compliant
def process_payment(customer, price):
    if customer.make_payment(price):     # one hop — only talks to Customer
        print(f"Payment of ${price} approved")
    else:
        print(f"Payment of ${price} declined")
```

### Document Formatting — Avoid Deep Navigation

```python
# VIOLATION
def calculate_total_font_size(document):
    total = 0
    for paragraph in document.get_paragraphs():         # one hop
        total += paragraph.get_font().get_size()         # two hops — violation!
    return total

# LoD COMPLIANT — each level provides what the next needs
class Paragraph:
    def __init__(self, font): self._font = font
    def get_font_size(self): return self._font.get_size()   # Paragraph navigates

class Document:
    def __init__(self, paragraphs): self._paragraphs = paragraphs
    def calculate_total_font_size(self):                # Document navigates
        return sum(p.get_font_size() for p in self._paragraphs)

def display_stats(document):
    print(document.calculate_total_font_size())   # client talks only to Document
```

### Encapsulate Collections

```python
# VIOLATION — exposing internal collection
class ShoppingCart:
    def __init__(self): self.items = []   # public!

cart = ShoppingCart()
cart.items.append(item)                     # client reaches into internals
total = sum(i.get_price() for i in cart.items)   # navigates collection

# LoD COMPLIANT
class ShoppingCart:
    def __init__(self): self._items = []
    def add_item(self, item): self._items.append(item)
    def get_total(self): return sum(i.get_price() for i in self._items)

cart = ShoppingCart()
cart.add_item(item)    # talks to cart, not its internals
total = cart.get_total()
```

---

## Exceptions

### Fluent Interfaces — Not a Violation

```python
# FINE — same object throughout (returns self)
query = (QueryBuilder()
    .select('name')
    .from_table('users')
    .where('age > 18')
    .order_by('name'))
# Not a "train wreck" because you're always talking to the same QueryBuilder friend
```

### Simple DTOs / Value Objects

```python
# Acceptable for pure data objects with no behavior
address_string = f"{person.address.street}, {person.address.city}"
# person.address is a value object (DTO) — no logic, no invariants to hide
# Strict LoD compliance here (get_formatted_address()) may be overkill
```

---

## Common Mistakes

### 1. Thinking LoD means "never use getters"

```python
class Order:
    def __init__(self, customer): self._customer = customer
    
    def get_customer_name(self):
        return self._customer.get_name()   # FINE — customer is a direct component
```

Getters on **direct components** are fine. The violation is chaining through multiple levels from **outside** the class.

### 2. Creating excessive wrapper methods

```python
# OVER-ENGINEERED — wrapping every address detail
class Customer:
    def get_street(self): return self._address.get_street()
    def get_city(self): return self._address.get_city()
    def get_zip(self): return self._address.get_zip()
    # ...wrapping every method

# BETTER — provide high-level operations
class Customer:
    def get_formatted_address(self): return self._address.format()
    def is_in_delivery_zone(self, zone): return self._address.is_in_zone(zone)
```

---

## Interview Q&A (Quick Fire)

**Q: What's wrong with `order.getCustomer().getAddress().getZipCode()`?**
> "It violates the Law of Demeter — the client navigates through Order's entire internal structure. If we change how Order stores customer data or Address stores zip, this call breaks. I'd move responsibility to Order: add `order.getCustomerZipCode()` — it navigates internally, the client stays decoupled."

**Q: Are fluent interfaces LoD violations?**
> "No — fluent interfaces like `builder.setName().setAge().build()` return `self` (or the same object type). You're always talking to the same 'friend'. LoD is violated when you chain through *different* objects."

**Q: What's the 'Tell, Don't Ask' principle and how does it relate?**
> "Tell, Don't Ask says: instead of asking an object for data to make a decision, tell the object to make the decision itself. It's the behavioral side of LoD — instead of `if customer.getWallet().getMoney() >= price`, tell the customer: `customer.makePayment(price)`."

---

## Key Takeaways

- LoD = call methods only on **self, parameters, local objects, direct components** — not on returned objects
- **Train wrecks** (`obj.getA().getB().getC()`) couple you to the entire internal chain
- **Push responsibility down**: let the object that owns the data navigate it — clients stay decoupled
- **Fluent interfaces** and **DTOs** are justified exceptions — apply LoD where coupling to internals is harmful
- Don't blindly wrap every method — provide **high-level operations** that make sense at that abstraction level
