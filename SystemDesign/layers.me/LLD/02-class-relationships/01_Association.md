# Association in OOP: Object Relationships Guide

> **Source:** https://layrs.me/course/lld/02-class-relationships/association
> **Level:** Beginner | **Read:** ~12 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **Association** | "Uses-a" — objects collaborate but neither owns the other |
| **Unidirectional** | A knows about B; B doesn't know A |
| **Bidirectional** | A knows about B; B knows about A |
| **One-to-One** | Each object associates with exactly one other |
| **One-to-Many** | One object associates with a collection of others |
| **Many-to-Many** | Both sides can have multiple associations |
| **Dependency Injection** | Pass the dependency in — enable testing + flexibility |

> **Key Insight:** Association = loose collaboration. Customer uses PaymentProcessor, but neither owns the other. If Customer is deleted, PaymentProcessor lives on. This is the foundation of dependency injection.

---

## The Analogy — Doctor and Patient

- A doctor treats patients. A patient sees doctors.
- Neither owns the other — the doctor exists independently, so does the patient.
- A patient can see multiple doctors (many-to-many association).
- Contrast with composition: a Human owns a Heart — heart doesn't exist without human.

---

## Why This Matters in Interviews

- Every "design a system" question has association relationships
- Interviewers test: "Can you distinguish association from composition/aggregation?"
- DIP (Dependency Inversion) is about programming to interfaces in association

> **Red flags:** Creating objects inside a class when they should be injected, not maintaining bidirectional consistency, missing null checks for optional associations

---

## Core Concept

### 1. Unidirectional Association

```python
class PaymentProcessor:
    def __init__(self, name):
        self.name = name

    def process_payment(self, amount):
        return f"{self.name}: processed ${amount}"

class Customer:
    def __init__(self, name):
        self.name = name

    def make_purchase(self, amount, payment_processor: PaymentProcessor):
        # Association via method parameter — no stored reference
        transaction_id = payment_processor.process_payment(amount)
        print(f"{self.name} paid ${amount}: {transaction_id}")

# Both exist independently
processor = PaymentProcessor("Stripe")
customer = Customer("Alice")

customer.make_purchase(99.99, processor)
# Stripe can serve many customers — not owned by any

del customer    # Processor still works
customer2 = Customer("Bob")
customer2.make_purchase(49.99, processor)
```

### 2. Bidirectional Association

```python
class Teacher:
    def __init__(self, name):
        self.name = name
        self.students: list = []

    def add_student(self, student):
        if student not in self.students:
            self.students.append(student)
            student.set_teacher(self)   # maintain BOTH sides

    def list_students(self):
        return [s.name for s in self.students]

class Student:
    def __init__(self, name):
        self.name = name
        self.teacher: Teacher | None = None

    def set_teacher(self, teacher):
        self.teacher = teacher

    def get_teacher_name(self):
        return self.teacher.name if self.teacher else "No teacher assigned"

teacher = Teacher("Dr. Smith")
s1 = Student("Emma")
s2 = Student("Liam")

teacher.add_student(s1)
teacher.add_student(s2)

print(teacher.list_students())      # ['Emma', 'Liam']
print(s1.get_teacher_name())        # Dr. Smith

del teacher   # Students still exist — not composition
print(s1.name, "still exists")
```

### 3. Many-to-Many Association

```python
class Doctor:
    def __init__(self, name, specialty):
        self.name = name
        self.specialty = specialty
        self.patients: list = []

    def add_patient(self, patient):
        if patient not in self.patients:
            self.patients.append(patient)
            patient.add_doctor(self)    # bidirectional

class Patient:
    def __init__(self, name):
        self.name = name
        self.doctors: list = []

    def add_doctor(self, doctor):
        if doctor not in self.doctors:
            self.doctors.append(doctor)

dr_jones = Doctor("Dr. Jones", "Cardiology")
dr_patel = Doctor("Dr. Patel", "Neurology")
sarah = Patient("Sarah")

dr_jones.add_patient(sarah)
dr_patel.add_patient(sarah)   # Sarah sees two doctors
print([(d.name, d.specialty) for d in sarah.doctors])
# [('Dr. Jones', 'Cardiology'), ('Dr. Patel', 'Neurology')]
```

### 4. Association via Dependency Injection (DI)

```python
from abc import ABC, abstractmethod

class EmailService(ABC):
    @abstractmethod
    def send_email(self, to, subject, body): pass

class GmailService(EmailService):
    def send_email(self, to, subject, body):
        return f"[Gmail] → {to}: {subject}"

class MockEmailService(EmailService):
    def send_email(self, to, subject, body):
        return f"[Mock] → {to}: {subject}"

class UserNotifier:
    def __init__(self, email_service: EmailService):
        self.email_service = email_service   # association via DI

    def notify(self, user_email, message):
        result = self.email_service.send_email(user_email, "Notification", message)
        print(result)

# Production
UserNotifier(GmailService()).notify("alice@co.com", "Order shipped!")
# Testing — swap without changing UserNotifier
UserNotifier(MockEmailService()).notify("test@co.com", "Test")
```

---

## Association vs Related Concepts

| | Association | Aggregation | Composition |
|---|---|---|---|
| Keyword | Uses-a | Has-a (independent) | Owns-a (dependent) |
| Lifecycle | Fully independent | Independent | Dependent |
| Created by | External | External | Container |
| Stored as | Method param or instance var | Collection field | Field |
| Example | Customer → PaymentProcessor | University → Students | Car → Engine |

---

## Common Mistakes

### 1. Creating the dependency internally (becomes composition)
```python
# WRONG — Customer now owns the processor
class Customer:
    def __init__(self, name):
        self.payment_processor = PaymentProcessor()  # tight coupling!

# RIGHT — inject from outside
class Customer:
    def make_purchase(self, amount, payment_processor: PaymentProcessor):
        ...
```

### 2. Missing bidirectional consistency
```python
# WRONG — only half the link
teacher.students.append(student)
# student.teacher is still None — inconsistent state!

# RIGHT — always update both
teacher.add_student(student)   # method handles both sides
```

### 3. Null-checking associated objects
```python
# WRONG
class Student:
    def get_teacher_name(self):
        return self.teacher.name  # AttributeError if None!

# RIGHT
def get_teacher_name(self):
    return self.teacher.name if self.teacher else "No teacher assigned"
```

### 4. Association with rich data → needs its own class
```python
# WRONG — stuffing appointment data into Doctor
class Doctor:
    def __init__(self): self.patient_notes = {}   # messy

# RIGHT — create an Appointment association class
class Appointment:
    def __init__(self, doctor, patient, date, diagnosis):
        self.doctor, self.patient = doctor, patient
        self.date, self.diagnosis = date, diagnosis
```

---

## Interview Q&A (Quick Fire)

**Q: Difference between association, aggregation, and composition?**
> "Association = uses-a, fully independent lifecycles. Aggregation = has-a, parts can still exist if container deleted. Composition = owns-a, parts are destroyed when container is destroyed. A customer *uses* a PaymentProcessor (association). A library *has* books that can exist elsewhere (aggregation). A car *owns* its engine which is destroyed with it (composition)."

**Q: How does association relate to Dependency Injection?**
> "Association via DI: instead of a class creating its dependencies internally, they're passed in from outside. This enables swapping implementations (e.g., mock vs real email service) and follows DIP — depend on abstractions, not concretions."

**Q: When would you make an association its own class?**
> "When the relationship itself has attributes — like a Doctor-Patient relationship with an appointment date and diagnosis. That data belongs in an `Appointment` class, not crammed into either Doctor or Patient."

---

## Key Takeaways

- Association = "uses-a" — objects collaborate, neither owns the other, both have independent lifecycles
- Bidirectional: always update **both sides** in a single method to maintain consistency
- Use dependency injection — pass dependencies in, don't create them internally
- When an association has its own data (date, notes), extract it to an **association class**
- Distinguish from aggregation (has-a, independent) and composition (owns-a, dependent)
