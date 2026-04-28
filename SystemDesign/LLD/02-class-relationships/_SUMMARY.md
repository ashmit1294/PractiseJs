# Module 2 Summary — Class Relationships

> **Source:** https://layrs.me/course/lld/02-class-relationships
> **Topics:** 4 | **Folder:** `02-class-relationships/`

---

## Topics Covered

| # | File | Core Concept |
|---|---|---|
| T01 | [01_Association.md](01_Association.md) | Uses-a; independent lifecycles; DI; bidirectional consistency |
| T02 | [02_Aggregation.md](02_Aggregation.md) | Has-a with independence; shared parts; lifecycle test |
| T03 | [03_Composition.md](03_Composition.md) | Owns-a; parts created/destroyed by container; exclusive |
| T04 | [04_Dependency.md](04_Dependency.md) | Temporary usage; method params; DIP; minimize coupling |

---

## The Relationship Spectrum

```
Weakest ←——————————————————————————→ Strongest

Dependency → Association → Aggregation → Composition
 (method      (stores       (has-a,        (owns-a,
  param)       ref)         parts live)    parts die)
```

## Full Comparison Table

| | Dependency | Association | Aggregation | Composition |
|---|---|---|---|---|
| Keyword | uses | uses (lasting) | has-a | owns-a |
| Stored? | ❌ | ✅ instance var | ✅ collection | ✅ field |
| Lifecycle | method scope | independent | independent | dependent |
| Sharing | N/A | yes | yes | exclusive (1:1) |
| UML | dashed arrow | solid line | empty ◇ | filled ◆ |
| Example | `process(cart)` | `User` has `Cart` | `Library`→`Books` | `Car`→`Engine` |
| Coupling | weakest | moderate | moderate | strongest |

---

## Decision Guide

```
Does the class store a permanent reference?
    NO  → Dependency (method param / local var)
    YES →
        Who creates the part?
            External code → Association or Aggregation
            The container itself → Composition

        Can the part exist independently?
            YES → Aggregation (or Association)
            NO  → Composition
```

---

## Interview Cheat Sheet

| Question | Quick Answer |
|---|---|
| Aggregation vs Composition? | Independent lifecycle vs dependent lifecycle |
| Association vs Dependency? | Stored reference vs temporary usage |
| When to use composition? | Part has no meaning outside container |
| When to use aggregation? | Part can be shared or pre-exists |
| Multiple dependencies = ? | Code smell → SRP violation |
| "Favor composition over inheritance" | More flexible, less coupled, easier to test |
