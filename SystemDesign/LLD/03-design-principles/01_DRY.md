# DRY Principle: Don't Repeat Yourself in Code

> **Source:** https://layrs.me/course/lld/03-design-principles/dry
> **Level:** Beginner | **Read:** ~14 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **DRY** | Every piece of knowledge has one, unambiguous representation |
| **WET** | "Write Everything Twice" / "We Enjoy Typing" — the violation |
| **Rule of Three** | Extract after seeing duplication **3 times**, not the first |
| **Incidental duplication** | Code that looks similar but represents different concepts — keep separate |
| **Knowledge duplication** | Same business rule in multiple places — always extract |

> **Key Insight:** DRY is not about eliminating identical lines — it's about a **single source of truth for knowledge**. A business rule (loyalty = 5+ orders) in two places is a DRY violation even if the code looks different.

---

## The Analogy — Legal Contract

- If you have the same clause in 5 places of a contract, changing it requires 5 updates — and you'll miss one
- A good contract says: "Per section 3.2, all of the following apply..." — one source, referenced elsewhere
- Bug in the logic? Fix once, fixed everywhere

---

## Why This Matters in Interviews

- Interviewers show WET code and ask "what would you improve?"
- Signal: "I notice this validation appears in three places — I'd extract it into a `UserValidator` class"
- Shows maintainability thinking, not just syntax knowledge

> **Red flags:** Over-DRY-ing (coupling unrelated concepts), extracting after 1st occurrence (premature), not knowing when duplication is intentional

---

## Core Concept

### Basic Extraction

```python
# BEFORE (WET) — tax logic duplicated in 3 functions
def process_order_standard(price, quantity):
    subtotal = price * quantity
    tax = subtotal * 0.08          # duplicated
    discount = subtotal * 0.10
    return subtotal + tax - discount

def process_order_premium(price, quantity):
    subtotal = price * quantity
    tax = subtotal * 0.08          # duplicated
    discount = subtotal * 0.20
    return subtotal + tax - discount

def process_order_vip(price, quantity):
    subtotal = price * quantity
    tax = subtotal * 0.08          # duplicated
    discount = subtotal * 0.30
    return subtotal + tax - discount

# AFTER (DRY) — one source of truth
def calculate_order_total(price, quantity, discount_rate, tax_rate=0.08):
    """Single source of truth for order calculation."""
    subtotal = price * quantity
    tax = subtotal * tax_rate
    discount = subtotal * discount_rate
    return subtotal + tax - discount

def process_order_standard(price, qty): return calculate_order_total(price, qty, 0.10)
def process_order_premium(price, qty): return calculate_order_total(price, qty, 0.20)
def process_order_vip(price, qty): return calculate_order_total(price, qty, 0.30)

# Changing tax rate: edit ONE line
```

### Class-Level DRY

```python
# BEFORE — validation duplicated across 3 classes
class UserValidator:
    def validate_email(self, email):
        return bool(email) and '@' in email and len(email) >= 5

class AdminValidator:
    def validate_email(self, email):
        return bool(email) and '@' in email and len(email) >= 5  # copy-paste!

# AFTER — single source
class EmailValidator:
    @staticmethod
    def is_valid(email: str) -> bool:
        return bool(email) and '@' in email and len(email) >= 5

class UserValidator:
    def validate_email(self, email): return EmailValidator.is_valid(email)

class AdminValidator:
    def validate_email(self, email): return EmailValidator.is_valid(email)
```

### Knowledge DRY (Business Rules)

```python
# BEFORE — "loyalty = 5+ orders" lives in two places
class OrderService:
    def can_apply_discount(self, user):
        return user.orders_count > 5     # Rule here

class EmailService:
    def send_loyalty_email(self, user):
        if user.orders_count > 5:        # Same rule duplicated!
            ...

# AFTER — rule lives in User (single source of truth)
class User:
    LOYALTY_THRESHOLD = 5
    def is_loyalty_customer(self) -> bool:
        return self.orders_count > self.LOYALTY_THRESHOLD

class OrderService:
    def can_apply_discount(self, user): return user.is_loyalty_customer()

class EmailService:
    def send_loyalty_email(self, user):
        if user.is_loyalty_customer(): ...
# Change threshold once in User — both services see it
```

### Constants/Config DRY

```python
# BEFORE — magic numbers scattered everywhere
class PaymentProcessor:
    def process(self, amount):
        return amount * 0.029 + 0.30   # fee

class ReportGenerator:
    def calculate_fees(self, amounts):
        return sum(a * 0.029 + 0.30 for a in amounts)  # duplicated!

# AFTER — constants in one place
class PaymentConfig:
    RATE = 0.029
    FIXED_FEE = 0.30

    @classmethod
    def calculate_fee(cls, amount): return amount * cls.RATE + cls.FIXED_FEE

class PaymentProcessor:
    def process(self, amount): return amount + PaymentConfig.calculate_fee(amount)

class ReportGenerator:
    def calculate_fees(self, amounts):
        return sum(PaymentConfig.calculate_fee(a) for a in amounts)
```

---

## When NOT to Apply DRY

### Incidental Duplication (keep separate)

```python
# These look the same TODAY but represent different concepts
def calculate_employee_bonus(salary):
    return salary * 0.10   # 10% bonus policy

def calculate_sales_tax(price):
    return price * 0.10    # current tax rate

# WRONG — don't combine!
def calculate_ten_percent(amount):
    return amount * 0.10   # Breaks when tax becomes 8% or bonus becomes 15%
```

> **Rule of Three**: wait until you see it 3 times before extracting. After 1 or 2, it might just be coincidence.

---

## Common Mistakes

### 1. Over-applying DRY → over-generic abstractions
```python
# BAD — so generic it's useless
def process_data(data, operation, config, flags, options):
    # 50 lines of conditional logic for every possible case
    ...

# GOOD — specific, focused helpers
def _validate_input(data): ...
def process_user_data(user_data):
    _validate_input(user_data)
    # user-specific logic
```

### 2. Creating hidden side-effect dependencies
```python
# BAD — shared function has hidden side effects
def transform_and_log(data, user_type):
    result = transform_data(data)
    log_to_database(user_type, result)   # always logs!
    return result

def generate_report(data):
    return transform_and_log(data, 'admin')  # Surprise! Logs to DB

# GOOD — separate concerns, let callers decide
def transform_data(data): ...   # pure transformation
def handle_request(data):
    result = transform_data(data)
    log_to_database('user', result)   # explicit
```

---

## Interview Q&A (Quick Fire)

**Q: What is DRY and when do you apply it?**
> "Every piece of knowledge — logic, business rules, constants — should have one place. When I see the same logic appearing 3+ times, I extract it. But I wait for the Rule of Three — two occurrences might be incidental."

**Q: DRY violation in a business context?**
> "A loyalty threshold (5 orders) hardcoded in OrderService AND EmailService. I'd move it to `User.LOYALTY_THRESHOLD = 5` with an `is_loyalty_customer()` method — change once, both services see it."

**Q: When is duplication acceptable?**
> "When two things just look similar now but will evolve independently. Employee bonus and sales tax both use 10% today, but they'll change at different times for different reasons — coupling them would create a hidden dependency."

---

## Key Takeaways

- DRY = **single source of truth** for logic, business rules, and constants — not just code lines
- Apply the **Rule of Three**: extract after 3 occurrences, not the first
- **Knowledge duplication** (business rules) is often worse than code duplication
- **Incidental duplication** is acceptable when concepts are independent — don't force it
- When extracting, keep abstractions **focused** — avoid overly generic functions that do everything
