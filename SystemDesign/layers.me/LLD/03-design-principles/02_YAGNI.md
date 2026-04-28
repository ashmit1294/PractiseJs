# YAGNI Principle: You Aren't Gonna Need It

> **Source:** https://layrs.me/course/lld/03-design-principles/yagni
> **Level:** Beginner | **Read:** ~12 min

---

## TL;DR (Cheat Sheet)

| Term | ELI5 |
|---|---|
| **YAGNI** | Don't build it until you actually need it |
| **Speculative generality** | Adding "just in case" features that will probably never be used |
| **Premature abstraction** | Creating factory/strategy/plugin patterns before you have 2+ implementations |
| **Over-parameterizing** | Adding optional params for features not yet required |
| **Rule of thumb** | If it's not in the current sprint/spec, you probably don't need it |

> **Key Insight:** Every line of speculative code is a **liability** — it can contain bugs, must be understood by future developers, and may need updating when requirements change. Code written for "what if" needs often becomes obsolete before it's ever used.

---

## The Analogy — Restaurant Menu

- A small restaurant prints 100 different dishes on the menu "just in case" people ask
- Staff must know how to make all 100. Most will never be ordered. Kitchen complexity spikes.
- Better: start with 15 dishes done excellently. Add more when demand is proven.

---

## Why This Matters in Interviews

- Classic interviewer test: gives a problem with vague hints about "possible future features"
- Wrong answer: "I'll build a plugin architecture for all future cases!"
- Right answer: "I'll build exactly what's needed now, keeping it easy to extend later"

> **Red flags:** "We might need this later," building frameworks for single use cases, adding 5+ optional parameters, creating abstract hierarchies for one implementation

---

## Core Concept

### Over-Engineered Configuration

```python
# VIOLATES YAGNI — current requirement: just send emails
class NotificationService:
    def __init__(self, config):
        self.email_enabled = config.get('email_enabled', True)
        self.sms_enabled = config.get('sms_enabled', False)   # Not needed yet
        self.push_enabled = config.get('push_enabled', False)  # Not needed yet
        self.slack_enabled = config.get('slack_enabled', False) # Not needed yet
        self.retry_count = config.get('retry_count', 3)        # Not needed yet
        self.timeout = config.get('timeout', 30)               # Not needed yet

    def send(self, user, message):
        if self.email_enabled: self._send_email(user.email, message)
        if self.sms_enabled: self._send_sms(user.phone, message)    # dead code
        if self.push_enabled: self._send_push(user.device_id, message)  # dead code

# FOLLOWS YAGNI — does one thing well
class NotificationService:
    def send_notification(self, user, message):
        self._send_email(user.email, message)

    def _send_email(self, email, message):
        print(f"Email sent to {email}: {message}")
# When SMS is ACTUALLY needed → refactor with real requirements
```

### Premature Abstraction

```python
# VIOLATES YAGNI — only one discount type exists
from abc import ABC, abstractmethod

class Rule(ABC):
    @abstractmethod
    def evaluate(self, context): pass

class DiscountRule(Rule):
    def __init__(self, condition, discount):
        self.condition = condition
        self.discount = discount
    def evaluate(self, context):
        return self.discount if self.condition(context) else 0

class RuleEngine:
    def __init__(self): self.rules = []
    def add_rule(self, rule): self.rules.append(rule)
    def execute(self, context): return sum(r.evaluate(context) for r in self.rules)

# FOLLOWS YAGNI — simple, direct
def calculate_discount(user_type: str) -> float:
    return 0.10 if user_type == 'premium' else 0.0
# When multiple discount rules ACTUALLY exist → then build the engine
```

### Over-Parameterizing

```python
# VIOLATES YAGNI — only PDF reports needed
class ReportGenerator:
    def generate(self, start, end,
                 format='pdf',       # Not needed yet
                 language='en',      # Not needed yet
                 timezone='UTC',     # Not needed yet
                 include_charts=True # Not needed yet
                ):
        return self._format_as_pdf(self._fetch_data(start, end))  # only pdf used!

# FOLLOWS YAGNI
class ReportGenerator:
    def generate_sales_report(self, start_date: str, end_date: str) -> str:
        data = self._fetch_data(start_date, end_date)
        return self._format_as_pdf(data)
# When CSV format is ACTUALLY requested → add a `format` param then
```

---

## YAGNI vs. Good Design

YAGNI ≠ write bad code. You should still:
- Follow clean code practices and SOLID for **current** requirements
- Write code that's **easy to change**
- Create appropriate abstractions for **existing** use cases

The key: design for easy change without implementing imagined features.

```python
# YAGNI-compliant AND extensible
class DataLayer:
    def find_user(self, user_id: int) -> dict:
        # concrete implementation now
        return self._db_query(user_id)
    # When we need to abstract for testing → introduce interface then
    # The method signature is already clean and easy to extract
```

---

## Common Mistakes

### 1. Thinking YAGNI means "write messy code"
```python
# WRONG — messy, coupled, untestable
def process_order(order_id):
    order = db.query(f"SELECT * FROM orders WHERE id={order_id}")
    total = sum(i.price * i.qty for i in order.items)
    db.execute(f"UPDATE orders SET total={total} WHERE id={order_id}")
    send_email(order.user.email, f"Total: {total}")

# RIGHT — clean, single-responsibility, STILL no speculative features
class OrderProcessor:
    def process(self, order_id):
        order = self._fetch_order(order_id)
        total = self._calculate_total(order)
        self._update_order(order_id, total)
        self._notify_user(order.user, total)
```

### 2. Building frameworks for single use cases
```python
# WRONG — generic "rule engine" for one discount rule
class RuleEngine: ...

# RIGHT — solve the actual problem; refactor when patterns emerge
def apply_discount(user_type, amount):
    return amount * 0.9 if user_type == 'premium' else amount
```

---

## Interview Q&A (Quick Fire)

**Q: An interviewer says "design a profile system, we might add social features later." What do you do?**
> "I'd focus on the current requirement — storing user profiles. Simple table: name, email, bio. I'd keep the design clean and modular so adding social features later is a small, additive change. I wouldn't build friend graphs or post feeds until they're actually needed — that's YAGNI."

**Q: Code review shows a notification class with 7 config options. Most are disabled. What's your feedback?**
> "Classic YAGNI violation — this class has 5+ features that are never used but still add complexity. I'd trim to just what's currently active, and add features when they're actually needed and requirements are clear."

**Q: When does YAGNI conflict with SOLID?**
> "YAGNI tells you not to implement hypothetical features. SOLID tells you how to structure what you DO implement. No conflict — apply SOLID to current requirements, just don't extend it to speculative ones. You still follow OCP and DIP — just for things that exist."

---

## Key Takeaways

- YAGNI = implement when needed, not when you foresee needing it
- Every speculative line has **ongoing maintenance cost** — bugs, updates, cognitive load
- YAGNI ≠ bad code — still write clean, testable, SOLID code for **current requirements**
- Wait for 2+ real implementations before abstracting — don't build factories for one thing
- In interviews: "I'd start with the simplest solution that meets current requirements, keeping it easy to extend when needs are real"
