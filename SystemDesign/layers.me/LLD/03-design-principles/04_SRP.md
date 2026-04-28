# Single Responsibility Principle (SRP) Explained

> **Source:** https://layrs.me/course/lld/03-design-principles/single-responsibility
> **Level:** Beginner | **Read:** ~16 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **SRP** | A class has one reason to change — one job, one focus area |
| **Reason to change** | A source of requirements; who would request a change? |
| **God object** | Class that does everything — the classic SRP violation |
| **Cohesion** | All methods in a class work toward the same goal |
| **Separation of concerns** | SRP is its application at class level |

> **Key Insight:** SRP is about **reasons to change**, not method count. A `Calculator` with `add()`, `subtract()`, `multiply()` is fine — all serve calculation. A `User` with `authenticate()`, `sendEmail()`, `saveToDatabase()` has 3 reasons to change.

---

## The Analogy — Knife vs. Multi-Tool

- A chef's knife does one thing perfectly — cuts
- A Swiss Army knife does 15 things adequately
- In a professional kitchen you want specialized tools: chef's knife, peeler, bread knife
- SRP = each tool has a single, focused purpose

---

## Why This Matters in Interviews

- Most common "refactoring" question: interviewer shows a bloated class and asks "what would you improve?"
- Answer: count the reasons to change → split into focused classes
- Shows: maintainability thinking, testability awareness, SOLID knowledge

> **Red flags:** "I kept it in one class for convenience," creating UserManager that does auth + email + DB, mixing business logic with infrastructure

---

## Core Concept

### Violation — Multiple Reasons to Change

```python
class User:
    def __init__(self, username, email, password):
        self.username = username
        self.email = email
        self.password = password
    
    def authenticate(self, password):       # Reason 1: auth logic changes
        return self.password == password
    
    def send_welcome_email(self):           # Reason 2: email requirements change
        print(f"Sending welcome email to {self.email}")
    
    def save_to_database(self):             # Reason 3: DB schema changes
        print(f"Saving user {self.username} to database")
    
    def generate_report(self):             # Reason 4: report format changes
        return f"Report for {self.username}: Active"
```

### Following SRP — One Reason Each

```python
class User:
    """Only holds user data — changes when data model changes"""
    def __init__(self, username, email, password):
        self.username = username
        self.email = email
        self.password = password

class AuthenticationService:
    """Changes when: password policies, OAuth, MFA are updated"""
    def authenticate(self, user, password):
        return user.password == password

class EmailService:
    """Changes when: email templates, provider, format change"""
    def send_welcome_email(self, user):
        print(f"Sending welcome email to {user.email}")

class UserRepository:
    """Changes when: database schema, ORM, storage backend changes"""
    def save(self, user):
        print(f"Saving user {user.username} to database")

class ReportGenerator:
    """Changes when: report format, metrics, output format changes"""
    def generate_user_report(self, user):
        return f"Report for {user.username}: Active"
```

### Real-World: Invoice Processing

```python
# BEFORE (violates SRP) — 3 reasons to change in one class
class Invoice:
    def __init__(self, items, customer):
        self.items = items
        self.customer = customer
    
    def calculate_total(self):              # Business logic
        return sum(item['price'] * item['quantity'] for item in self.items)
    
    def print_invoice(self):               # Presentation
        print(f"Invoice for {self.customer}")
        for item in self.items:
            print(f"{item['name']}: ${item['price']}")
    
    def save_to_file(self, filename):      # Persistence
        with open(filename, 'w') as f:
            f.write(f"Invoice for {self.customer}\n")

# AFTER (follows SRP)
class Invoice:
    """Business logic and data only"""
    def __init__(self, items, customer):
        self.items = items
        self.customer = customer
    
    def calculate_total(self):
        return sum(item['price'] * item['quantity'] for item in self.items)

class InvoicePrinter:
    """Presentation only — changes when output format changes"""
    def print_invoice(self, invoice):
        print(f"Invoice for {invoice.customer}")
        for item in invoice.items:
            print(f"{item['name']}: ${item['price']}")
        print(f"Total: ${invoice.calculate_total()}")

class InvoicePersistence:
    """Persistence only — changes when storage mechanism changes"""
    def save_to_file(self, invoice, filename):
        with open(filename, 'w') as f:
            f.write(f"Invoice for {invoice.customer}\n")
            f.write(f"Total: ${invoice.calculate_total()}\n")
```

### Lightweight Coordinator (not a God Object)

```python
# RIGHT — coordinator that delegates, doesn't implement
class UserRegistrationService:
    def __init__(self, validator, repository, email_service, logger):
        self.validator = validator
        self.repository = repository
        self.email_service = email_service
        self.logger = logger
    
    def register_user(self, data):
        self.validator.validate(data)          # delegates
        user = User(**data)
        self.repository.save(user)            # delegates
        self.email_service.send_welcome_email(user)  # delegates
        self.logger.log_registration(user)   # delegates
# This class has one responsibility: coordinate registration flow
```

---

## Common Mistakes

### 1. Mixing business logic with infrastructure

```python
# WRONG — SQL inside business class
class OrderProcessor:
    def process_order(self, order):
        total = order.calculate_total()
        import sqlite3
        conn = sqlite3.connect('orders.db')   # infrastructure here!
        cursor.execute("INSERT INTO orders VALUES (?, ?)", (order.id, total))
        conn.commit()

# RIGHT — inject the repository
class OrderProcessor:
    def __init__(self, repository):
        self.repository = repository
    
    def process_order(self, order):
        total = order.calculate_total()
        self.repository.save(order)
```

### 2. SRP ≠ one method per class

```python
# WRONG THINKING — over-split
class EmailValidator:
    def validate(self, email): return '@' in email

class PasswordValidator:
    def validate(self, password): return len(password) >= 8

# RIGHT — group related validation
class UserValidator:
    def validate_email(self, email): return '@' in email
    def validate_password(self, password): return len(password) >= 8
    def validate_all(self, user): return self.validate_email(user.email) and ...
```

---

## Interview Q&A (Quick Fire)

**Q: How do you identify SRP violations?**
> "Ask three questions: Does this class have multiple reasons to change? Can I describe its purpose without 'and'? Would different stakeholders request changes to different parts? If yes to any — it's a violation."

**Q: How is SRP different from separation of concerns?**
> "Separation of concerns is the broader concept. SRP is its application at class level — each class has one reason to change. SoC can apply at any level: modules, services, layers."

**Q: Doesn't SRP lead to too many classes?**
> "Only if over-applied. For simple, stable code, one class is fine. For complex or frequently changing code, SRP prevents change-cascade bugs. I apply SRP where different parts change for different reasons."

**Q: Connect SRP to testability.**
> "With SRP, I test PaymentProcessor without mocking email or database. Each class has focused unit tests with minimal setup — tests run faster and break for clear reasons."

---

## Key Takeaways

- SRP = **one reason to change** — not one method, not one line
- Identify responsibilities by asking: **what stakeholder would request this change?**
- **Cohesion** is the positive signal: all methods serve the same purpose
- Mix of verbs = red flag: validate + save + send + calculate in one class → split it
- Balance with pragmatism: don't over-split; related validations can share a class
