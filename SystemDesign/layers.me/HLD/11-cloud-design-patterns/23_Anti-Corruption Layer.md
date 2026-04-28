# T23 — Anti-Corruption Layer: Bridge Legacy & New Systems

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/anti-corruption-layer

---

## ELI5 (Explain Like I'm 5)

You're building a modern smart home system. But you need to talk to a 1990s security system that uses weird codes like "ARM_MODE_3_ZONE_BYPASS_12". You don't want your clean smart-home app to have to understand all that gibberish. So you build a translator module — it speaks the old system's weird language on one side, and your clean "setSecurityMode('away')" API on the other. Your app never sees the legacy mess. That translator is the Anti-Corruption Layer.

---

## Analogy

**A diplomatic interpreter**: Two countries need to negotiate, but their languages are structurally different — not just different words, but different conceptual frameworks. The interpreter doesn't just translate words; they translate concepts, context, and intent. The ACL is this interpreter — it translates between your clean domain model and the messy external system's model, ensuring neither corrupts the other.

---

## Core Concept

The Anti-Corruption Layer (ACL) is a **translation boundary** that sits between your domain model and external systems with incompatible semantics. It prevents legacy or third-party models from "leaking" into and corrupting your clean architecture.

First described by Eric Evans in *Domain-Driven Design*, it acts as a bidirectional translator: converting external concepts into your domain's ubiquitous language on the way in, and translating your domain operations into external system calls on the way out.

**What corruption looks like without an ACL**: Your domain `Order` entity starts using field names from the legacy ERP (`CUST_NO`, `ORD_STS_CD`). Your code references external error codes (`PROC_ERR_3421`) directly in business logic. Your validation rules are shaped by external system's loose constraints. Over time, your domain becomes a patchwork of different mental models.

**The ACL protects against this** by containing all translation in a dedicated layer.

---

## ASCII Diagrams

```
WITHOUT ACL — Corruption leaks into domain:
  Domain Code ──────── EXTERNAL TYPES ──────────► Legacy ERP
                 PaymentProcessorResponse
                 "PROC_ERR_3421"
                 CUST_NO, ORD_STS_CD fields
  ❌ External types in domain method signatures
  ❌ External error codes in business logic
  ❌ External validation rules in domain entities

WITH ACL — Clean boundary:
  Domain Code ── Domain Types ──► ACL ── External Types ──► Legacy ERP
                 PaymentResult         PaymentProcessorResponse
                 PaymentDeclined       "PROC_ERR_3421"
                 Order {customerId}    ORDRHDR {CUST_NO}
  ✅ Domain types only in domain code
  ✅ All translation isolated in ACL
  ✅ Domain invariants enforced at boundary

BIDIRECTIONAL TRANSLATION FLOW:
  createOrder(Order)              
  ──────────────────► ACL Facade 
                       │ translates to ERP format
                       │── SOAP Request (ORDRHDR XML) ──► Legacy ERP
                       │◄── SOAP Response XML ────────────────────
                       │ translates back to domain
  ◄── Return Order ────┘
```

---

## How It Works (Step by Step)

1. **Define your domain model first**: Design purely based on business needs. `Order` entity with `customerId`, `items`, `totalAmount`, `status`. No concessions for external systems at this stage.

2. **Map the external model**: Document the external system's data structures. A legacy ERP has `ORDRHDR` records with `CUST_NO`, `ORD_STS_CD`, `TOT_AMT_CENTS`. Different terminology, different types, different validation.

3. **Create the ACL interface**: Domain code calls `orderRepository.save(order)`. The interface uses only domain types. ACL implements this interface internally.

4. **Implement bidirectional translation**: ACL translates `Order` → `ORDRHDR` on the way out; translates SOAP XML response → `Order` on the way back. Maps `CUST_NO` → `customerId`, converts error codes `PROC_ERR_3421` → domain exception `PaymentDeclined`.

5. **Enforce domain invariants at the boundary**: External system allows null emails? ACL must reject or enrich. ACL enforces that data crossing the boundary always meets domain requirements, regardless of what external system allows.

6. **Isolate and test independently**: ACL is a separate module with clear interfaces. Swap the real external system with a mock in testing. Switch from one payment processor to another by only changing the ACL implementation.

---

## Variants

| Variant | Description | Example |
|---------|-------------|---------|
| **Facade-Based ACL** | Simplifies complex external API behind clean interface. `orderService.placeOrder(order)` hides 15-step ERP workflow | Shopify's SAP integration: `syncInventory()` hides SAP's multi-step protocol |
| **Adapter-Based ACL** | Structural translation — converts data shapes. `Order` ↔ `PurchaseOrder` | Stripe's per-processor adapters: `PaymentIntent` → Visa auth format OR PayPal API format |
| **Service-Based ACL** | Separate microservice; multiple services use same ACL; adds caching, circuit breakers | Netflix's Billing Gateway: translates Subscription/Plan to legacy ACCT_MSTR/BILL_CYC |
| **Event-Driven ACL** | Subscribes to domain events, translates, pushes to external async | Uber's driver payout ACL: `TripCompleted` event → bank payment instruction |
| **Repository-Based ACL** | ACL implements repository interfaces; domain uses repository as if talking to clean storage | Hotel integrations: `bookingRepository.save()` → PMS-specific API calls under the hood |

---

## Trade-offs

| Dimension | ACL | Direct Integration |
|-----------|-----|-------------------|
| **Architecture purity** | Domain stays clean; external concepts never leak | External concepts pollute domain over time |
| **Performance** | 10-50ms translation overhead per request | Zero overhead |
| **Team independence** | Domain evolves without coordinating with external system team | Tightly coupled lifecycle |
| **Maintenance** | ACL must stay up to date with external API changes | Domain absorbs all changes directly |
| **Testability** | Mock the ACL; test domain in isolation | Must mock external system everywhere |

**Stripe**: Uses strict ACLs for core payment engine (must remain pure and testable), but allows some direct integration in analytics pipeline where performance > purity.

**When ACL is worth the overhead**: Core domain logic that changes frequently; when long-term maintainability is critical; when multiple teams integrate with the same external system (Service-Based ACL amortizes the cost).

---

## When to Use (and When Not To)

**Use when:**
- Integrating with legacy systems you don't control (and can't change)
- Integrating with third-party APIs where semantics differ from your domain
- Two bounded contexts in your org use different domain models
- Protecting your domain during a legacy migration (Strangler Fig + ACL pair well)
- The external system changes frequently but your domain should remain stable

**Avoid when:**
- Two services share the same bounded context and ubiquitous language (direct calls suffice)
- High-frequency trading or real-time systems where even 5ms matters
- CRUD operations with no meaningful semantic gap
- You're building the ACL "just in case" — wait until you feel the pain

---

## MERN Developer Notes

```javascript
// Domain model — pure, clean, no external concerns
class Order {
  constructor({ customerId, items, totalAmount, status }) {
    if (!customerId) throw new DomainError('Customer ID required');
    if (!items?.length) throw new DomainError('Order must have items');
    this.customerId = customerId;
    this.items = items;
    this.totalAmount = totalAmount;
    this.status = status;
  }
}

// Domain exception — clean business concepts
class PaymentDeclined extends Error {
  constructor(reason) { super(`Payment declined: ${reason}`); this.name = 'PaymentDeclined'; }
}

// ===== ANTI-CORRUPTION LAYER =====
class PaymentProcessorACL {
  constructor(legacyPaymentClient) {
    this.client = legacyPaymentClient;
  }

  // Translates domain PaymentRequest → external processor format
  async processPayment(order, paymentMethod) {
    // Build external system's request format
    const externalRequest = {
      CUST_NO: order.customerId,        // external field name
      TOT_AMT_CENTS: Math.round(order.totalAmount * 100), // external format
      PMT_METH_CD: this._mapPaymentMethod(paymentMethod), // semantic translation
      ORD_REF: order.id,
      TXN_TYPE: 'PAY'
    };

    let externalResponse;
    try {
      externalResponse = await this.client.processTransaction(externalRequest);
    } catch (err) {
      // Translate external connection errors to domain exceptions
      throw new PaymentServiceUnavailable('Payment processor unreachable');
    }

    // Translate external error codes to domain exceptions
    if (externalResponse.STATUS_CD !== '00') {
      switch (externalResponse.ERR_CD) {
        case 'PROC_ERR_3421': throw new PaymentDeclined('Insufficient funds');
        case 'PROC_ERR_9001': throw new PaymentDeclined('Card expired');
        case 'PROC_ERR_5500': throw new PaymentDeclined('Card reported stolen');
        default: throw new PaymentDeclined(`Transaction declined (code: ${externalResponse.ERR_CD})`);
      }
    }

    // Translate external success response to domain PaymentResult
    return {
      transactionId: externalResponse.TXN_ID,   // external → domain naming
      processedAt: new Date(externalResponse.PROC_DT),
      amount: externalResponse.TOT_AMT_CENTS / 100
    };
  }

  // Private method — semantic translation, not leaked to domain
  _mapPaymentMethod(method) {
    const map = { 'credit_card': 'CC', 'debit_card': 'DC', 'bank_transfer': 'ACH' };
    if (!map[method]) throw new DomainError(`Unsupported payment method: ${method}`);
    return map[method];
  }
}

// Domain service uses ACL through clean interface — never sees external types
class OrderService {
  constructor(orderRepo, paymentACL) {
    this.orderRepo = orderRepo;
    this.paymentACL = paymentACL;
  }

  async placeOrder(customerId, items, paymentMethod) {
    const order = new Order({ customerId, items, totalAmount: this._calculateTotal(items), status: 'pending' });
    
    // Domain code calls ACL — only domain types cross this call
    const paymentResult = await this.paymentACL.processPayment(order, paymentMethod);
    
    order.status = 'confirmed';
    order.paymentTransactionId = paymentResult.transactionId;
    await this.orderRepo.save(order);
    return order;
  }
}

// Key principle: Domain never imports external types. ACL owns the translation.
// Swap to a different payment processor by creating a new ACL implementation.
// Domain code is unchanged.
```

---

## Real-World Examples

| Company | External System | ACL Approach | Key Detail |
|---------|----------------|--------------|-----------|
| **Stripe** | 135+ payment processors (Visa, PayPal, Alipay, etc.) | Adapter-Based ACL per processor | Domain uses `PaymentIntent`/`Charge`/`Refund`. Visa ACL translates to Visa auth format + handles AVS codes. PayPal ACL translates to completely different structure. Added 15 new payment methods in 2023 without touching payment engine. Each new engineer builds a mock ACL first week |
| **Netflix** | Legacy 1990s billing system (ACCT_MSTR, PMT_METH_CD) | Service-Based ACL ("Billing Gateway") | Exposes modern REST API with `Subscription`, `Plan`, `Invoice`. Handles complex case: Netflix allows multiple payment methods with priorities; legacy supports only one — ACL maintains mapping table + orchestrates multiple legacy calls |
| **Shopify** | Enterprise ERP systems (SAP) | Facade-Based ACL | `syncInventory()` hides SAP multi-step protocol (auth, session, transaction, error recovery). Migrated Rails monolith to microservices using ACLs at service boundaries — teams refactored domains independently without breaking integrations |
| **Uber** | Banking systems for driver payouts | Event-Driven ACL | `TripCompleted` event → bank payment instruction. Handles retries, idempotency. Banking system confirms → ACL translates back to `PaymentConfirmed` domain event |

---

## Interview Cheat Sheet

### Q: When would you use an ACL vs. direct integration?
**A:** ACL is warranted when there's a genuine **semantic gap** — different terminology, data models, business rules between systems. Three factors: (1) Semantic gap: "account master" vs. "customer" is a gap; different JSON field names is just an adapter. (2) Domain criticality: If this is your core competitive domain, protect it with an ACL. (3) Stability: If the external API changes frequently, ACL isolates your domain from those changes. Also consider team boundaries — different teams with different priorities? ACL gives you independence.

### Q: What's the difference between an ACL and a simple adapter?
**A:** An adapter converts one interface into another — structurally. An ACL does that **plus** semantic translation and domain protection. A thin wrapper that just renames fields is an adapter. A true ACL also: (1) Translates domain-level concepts not just field names, (2) Enforces domain invariants at the boundary (null email in external system → domain exception), (3) Translates error codes to domain exceptions, (4) Assumes the external system is untrustworthy and validates defensively. The ACL's intent is architectural protection of domain integrity.

### Q: How do you prevent the ACL from becoming the new legacy system?
**A:** Treat it as temporary infrastructure with a planned end-of-life. Three rules: (1) **No business logic** in the ACL — only translation. If you write `if user.isPremium: applyDiscount()`, that belongs in a domain service. (2) **Quarterly complexity reviews** — if ACL is growing, simplify or extract. (3) **Clear sunset plan** — what's the condition that removes the ACL? (Legacy system replaced? External API migrated?) Shopify's ACL had a 2-year lifespan with quarterly reviews.

---

## Red Flags to Avoid

- "ACL is just a wrapper" — the semantic translation and domain protection are what make it an ACL, not just interface adaptation
- Putting business logic in the ACL — it becomes a new monolith, hard to test, eventually becomes the new legacy
- Sharing domain and external models to avoid "duplication" — this defeats the purpose; healthy duplication enables independence across the boundary
- ACL that doesn't translate errors — external error codes leaking into domain logic defeats protection
- Adding ACLs between services in the same bounded context — unnecessary overhead when services share a domain model

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Anti-Corruption Layer (ACL)** | Translation boundary preventing external model from polluting your domain |
| **Ubiquitous Language** | Domain-Driven Design: shared vocabulary used consistently by developers + domain experts |
| **Bounded Context** | DDD: boundary within which a specific domain model and language apply |
| **Semantic Gap** | Difference in concepts, not just syntax — "customer" vs. "account master" |
| **Bidirectional Translation** | ACL translates in both directions: domain → external on writes, external → domain on reads |
| **Domain Exception** | Exception classes representing business failures, not technical errors (`PaymentDeclined`, `InsufficientInventory`) |
| **Facade-Based ACL** | ACL that simplifies complex external API behind a single clean interface |
| **Adapter-Based ACL** | ACL focused on structural/field-mapping translation |
| **Service-Based ACL** | ACL implemented as a microservice; multiple consumers share it |
| **Event-Driven ACL** | ACL that uses message queues to decouple systems asynchronously |
| **Repository-Based ACL** | ACL embedded in the repository layer, hiding external storage behind domain abstractions |
| **Domain Corruption** | When external system's terminology or constraints leak into and pollute your domain model |
| **Defensive Validation** | ACL validates all data crossing the boundary assuming external system is untrustworthy |
| **Consumer-Driven Contract Testing** | Testing approach (Pact) where domain defines contract it expects from ACL, ensuring ACL doesn't break domain |
