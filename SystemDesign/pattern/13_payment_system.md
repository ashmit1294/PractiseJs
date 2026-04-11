# Pattern 13 — Payment System

---

## ELI5 — What Is This?

> Paying online is like two banks passing notes to each other.
> Your bank says "I promise to send $50 to shop's bank".
> Shop's bank says "I received the note, credit the shop".
> The trick is: BOTH sides must agree before any money moves.
> If any note gets lost, neither side changes its balance.
> A payment system enforces this agreement with extreme precision,
> because double charges and silent failures anger customers and violate laws.

---

## Glossary

| Word | ELI5 Meaning |
|---|---|
| **Payment Gateway** | A service (Stripe, Braintree, PayPal) that sits between your app and the banks. You send the card details; the gateway handles the complex bank communication, fraud checks, and regulatory compliance. |
| **Idempotency Key** | A unique string you send with every payment request so the gateway can recognize "I have seen this exact request before". If you send the request twice (network drop), the gateway returns the same result without charging twice. Like a ticket number on a form — submit the same ticket twice and you get the same response. |
| **Two-Phase Commit (2PC)** | Phase 1: ask all parties "can you do this?" — everyone votes YES or NO. Phase 2: if ALL say YES, tell everyone to DO IT. If anyone says NO, tell everyone to UNDO. Guarantees atomicity across multiple systems. |
| **SAGA Pattern** | Breaking a long transaction into smaller steps, each with a compensating action (undo). If step 3 fails, you run the undo actions for steps 2 and 1. Like a cooking recipe where burning step 3 means you must throw away ingredients used in steps 1 and 2. |
| **Compensating Transaction** | The "undo" step of a SAGA. If payment succeeded but order creation failed, the compensating transaction is a refund. |
| **Webhook** | A callback that the payment gateway sends to your server to inform you of an event (payment.succeeded, payment.failed). Like a courier leaving a notification saying "package delivered". |
| **Reconciliation** | The nightly process of comparing your internal records against the bank/gateway statement to find discrepancies. Like balancing a checkbook at end of day. |
| **PCI-DSS** | Payment Card Industry Data Security Standard. Rules that say you must NEVER store raw card numbers in your own database. You use a gateway that is PCI-certified and stores sensitive data on your behalf. |
| **Tokenization** | Replacing a real credit card number with a fake ID (token). Your server stores the token. The gateway maps token → real card number in their secure vault. |
| **3D Secure (3DS)** | An extra password step ("Verified by Visa"). Bank redirects user to verify identity, then redirects back. Reduces fraud for card-not-present transactions. |
| **Chargeback** | When a customer disputes a charge with their bank. The bank forcibly reverses the payment and the merchant loses the money unless they can prove the charge was valid. |
| **At-Least-Once Delivery** | A guarantee that a message or action will happen at least once. May happen more than once (duplicate). System must be idempotent to handle duplicates safely. |

---

## Component Diagram

```mermaid
graph TB
    subgraph CLIENT["Client"]
        UI["Browser or Mobile App — never touches raw card data after tokenization"]
    end

    subgraph GATEWAY_LAYER["Payment Gateway"]
        STRIPE["Stripe — PCI-certified — handles card data, fraud checks, bank communication"]
    end

    subgraph PAY_SVC["Payment Service  — your system"]
        PAY_API["Payment API — creates Payment Intent, handles webhook events"]
        IDEM_STORE["Idempotency Store — Redis — idempotencyKey maps to result"]
        PAY_DB["PostgreSQL — payments, payment_events tables"]
    end

    subgraph SAGA["Distributed Transaction (SAGA)"]
        ORDER_SVC["Order Service — creates order row after payment succeeds"]
        INVENTORY_SVC["Inventory Service — decrements stock after order created"]
        NOTIF_SVC["Notification Service — sends receipt after inventory confirmed"]
    end

    subgraph ASYNC["Async Processing"]
        KAFKA["Kafka — payment.succeeded and payment.failed events"]
        RECONCILE["Reconciliation Job — nightly comparison with Stripe report"]
        ALERT["Alerting — pagerduty alert if discrepancy found"]
    end

    UI --> STRIPE
    STRIPE --> UI
    UI --> PAY_API
    PAY_API --> IDEM_STORE
    PAY_API --> PAY_DB
    STRIPE --> PAY_API
    PAY_API --> KAFKA
    KAFKA --> ORDER_SVC --> INVENTORY_SVC --> NOTIF_SVC
    RECONCILE --> PAY_DB & STRIPE & ALERT
```

---

## Payment Flow — Stripe Payment Intents

```mermaid
sequenceDiagram
    participant UI as Browser
    participant PAY as Payment API
    participant REDIS as Idempotency Redis
    participant DB as Payments DB
    participant STRIPE as Stripe
    participant ORDER as Order Service
    participant KAFKA as Kafka

    UI->>PAY: POST /payments/create  orderId=ORD-55  amount=4999  currency=USD  idempotencyKey=IK-abc123
    PAY->>REDIS: GET IK-abc123
    REDIS-->>PAY: null  (not seen before)
    PAY->>DB: INSERT payment  status=PENDING  idempotencyKey=IK-abc123  amount=4999
    PAY->>STRIPE: POST /payment_intents  amount=4999  currency=usd  idempotencyKey=IK-abc123
    STRIPE-->>PAY: paymentIntentId=pi_xyz  clientSecret=pi_xyz_secret
    PAY->>REDIS: SET IK-abc123 = pi_xyz  EX 86400
    PAY-->>UI: clientSecret=pi_xyz_secret

    Note over UI: Browser uses Stripe.js SDK to show card form — card data goes directly to Stripe
    UI->>STRIPE: stripe.confirmCardPayment(clientSecret, cardElement)
    STRIPE->>STRIPE: validate card, run 3DS if required, charge bank
    STRIPE-->>UI: payment succeeded

    Note over STRIPE: Async: Stripe calls your webhook
    STRIPE->>PAY: POST /webhooks/stripe  event=payment_intent.succeeded  pi=pi_xyz
    PAY->>DB: UPDATE payment  status=SUCCEEDED  paidAt=now  stripeChargeId=ch_xxx
    PAY->>KAFKA: publish  payment.succeeded  orderId=ORD-55  userId=U1  amount=4999
    KAFKA->>ORDER: consume event  create order row
    ORDER->>KAFKA: publish  order.created  orderId=ORD-55
    KAFKA->>NOTIF: consume  send receipt email to user
```

---

## SAGA Failure Compensation Flow

```mermaid
flowchart TD
    A["payment.succeeded event consumed by Order Service"] --> B["Create order row in DB"]
    B -- Success --> C["Publish order.created event to Kafka"]
    C --> D["Inventory Service consumes order.created"]
    D --> E{"Inventory available?"}
    E -- Yes --> F["Decrement inventory — publish inventory.reserved"]
    F --> G["Notification Service sends receipt — done!"]
    E -- No out of stock --> H["Inventory Service publishes inventory.failed"]
    H --> I["Order Service consumes inventory.failed"]
    I --> J["Order Service marks order as FAILED  publishes order.failed"]
    J --> K["Payment Service consumes order.failed — run compensating transaction"]
    K --> L["Call Stripe Refund API  refundId=ref_xxx  reason=out_of_stock"]
    L --> M["Update payment record status=REFUNDED  refundId=ref_xxx"]
    M --> N["Notification Service sends 'sorry, refund issued' email to user"]

    B -- DB crash --> O["Order Service fails — payment already succeeded"]
    O --> P["Kafka retries delivery to Order Service 3 times with backoff"]
    P -- Order Service recovers --> B
    P -- Still failing after 3 hours --> Q["Message goes to Dead Letter Queue"]
    Q --> R["Ops team manually triggers compensating refund via admin tool"]
```

---

## Bottlenecks — Every Point Explained

| # | Bottleneck | Why It Hurts | Fix |
|---|---|---|---|
| 1 | **Webhook delivery unreliable** | Stripe sends webhooks but your server was down for 30 seconds. Stripe retries but if your server is down for hours, events are lost. You never find out payments succeeded. | Webhook endpoint must return 200 fast (under 5s). Process asynchronously. Stripe stores and retries webhooks for 72 hours. Reconciliation job catches anything missed. |
| 2 | **Idempotency key collision** | Two different orders accidentally get the same idempotency key. The second one returns the result of the first — wrong amount charged. | Include ALL transaction-specific details in the key: `SHA256(userId + orderId + amount + currency)`. Uniqueness is guaranteed by the inputs. |
| 3 | **SAGA partial failure leaves inconsistent state** | Payment succeeded, order service was permanently down for 2 days. No compensation ran. User was charged, never got order. | Outbox pattern: Payment Service writes `payment.succeeded` event to its own DB table (outbox) in the same transaction as updating payment status. A separate outbox poller reads this table and publishes to Kafka. Even if Kafka is down during payment, the outbox captures the event durably. |
| 4 | **Reconciliation discovers missed charges** | Nightly reconciliation shows Stripe captured $500 that your system has no record of. This is a ghost payment. | Reconciliation job creates a `SUSPICIOUS` record for unmatched Stripe charges. Alerts on-call engineer. Investigation and manual refund if needed. |
| 5 | **Chargeback rate exceeds 1%** | Visa/Mastercard penalize merchants with chargeback rates above 1% by increasing fees or revoking card acceptance ability. | Fraud detection: integrate Stripe Radar or custom ML model. Flag high-risk transactions for manual review. Require 3DS for flagged orders. Maintain evidence package for every completed order. |

---

## What Happens When Each Part Fails?

```mermaid
flowchart TD
    F1["Stripe API Is Down — Cannot Create Payment Intent"]
    F2["Webhook Never Arrives — Stripe Called But Your Server Was Down"]
    F3["Duplicate Webhook — Stripe Sends payment.succeeded Twice"]
    F4["Database Crashes While Writing Payment Record"]
    F5["Refund Fails After SAGA Compensation Is Triggered"]

    F1 --> R1["Stripe has 99.9% uptime SLA (8 hours down per year max).
    If Stripe is down: your POST /payment_intents returns a 5xx error.
    Your API returns 503 to the client with a Retry-After: 30 header.
    The browser shows 'Payment service temporarily unavailable, please try again'.
    If Stripe is down for extended period: failover to secondary gateway Braintree.
    Circuit breaker: after 10 consecutive Stripe failures, route new payments to Braintree.
    Braintree uses the same card tokenization — Stripe tokens NOT interchangeable,
    so this only works for NEW payment attempts, not retries of existing payment intents."]

    F2 --> R2["Stripe retries failed webhooks with exponential backoff for up to 72 hours.
    Timeline: retry at 1h, 2h, 4h, 8h, 16h, 24h, 48h.
    Your server only needs to be down for under 72 hours for auto-recovery.
    For extra safety: on every order status page load, Payment API actively queries
    Stripe for the payment intent status using the stored paymentIntentId.
    This polling approach catches the state even if all webhooks failed.
    Reconciliation job at midnight also catches any remaining discrepancies."]

    F3 --> R3["Idempotency on webhook processing prevents double processing.
    When webhook arrives: check payment_events table for eventId.
    If eventId already exists: return 200 immediately without reprocessing.
    This makes webhook processing idempotent.
    Stripe guarantees eventId is unique per event.
    So even if the same event arrives 3 times, only the first one triggers
    order creation. The others are silently acknowledged and ignored."]

    F4 --> R4["Scenario: Stripe payment intent created, DB crashes before INSERT payment row.
    On DB recovery: the payment intent exists in Stripe but not in your DB.
    Client retries: sends same request with same idempotency key.
    Payment API checks Redis idempotency store — key IS present (was set before DB write).
    Redis returns the paymentIntentId stored earlier.
    API returns the existing clientSecret to the browser.
    Browser confirms payment using that clientSecret.
    Webhook arrives: Payment API handles it and does INSERT if row does not exist.
    This relies on the Redis idempotency store surviving the DB crash
    — hence the 24-hour TTL on idempotency keys in Redis."]

    F5 --> R5["Compensation refund is itself an API call that can fail.
    Stripe refund API fails with 5xx.
    SAGA compensation is handled as a Kafka consumer job.
    Same retry-with-backoff policy: 3 attempts, exponential backoff.
    If all 3 fail: message moves to Dead Letter Queue.
    DLQ is monitored with alerts — on-call engineer is paged.
    Engineer manually triggers refund via Stripe dashboard.
    This is a support ticket SLA issue now, not an automated system issue.
    Payment record in DB has status=REFUND_FAILED so finance team knows."]
```

---

## Key Numbers

| Metric | Value |
|---|---|
| Stripe webhook retry window | 72 hours |
| Idempotency key TTL in Redis | 24 hours |
| Payment Intent status options | requires_payment_method, requires_action, processing, succeeded, canceled |
| Chargeback rate safe threshold | Under 1% |
| SAGA steps in typical e-commerce | 3-5 steps |
| Reconciliation frequency | Daily (nightly batch) |
| PCI-DSS requirement | Never store raw card numbers |
