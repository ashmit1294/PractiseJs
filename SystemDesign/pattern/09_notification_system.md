# Pattern 09 — Notification System (Push / Email / SMS)

---

## ELI5 — What Is This?

> A pizza place needs to tell you when your pizza is ready.
> Some people want a phone call, some a text, some an app buzz.
> The notification system is one central announcer that figures out
> HOW you prefer to be told, then sends the message the right way —
> without slowing down the pizza kitchen one bit.

---

## Glossary

| Word | ELI5 Meaning |
|---|---|
| **Bull Queue** | A job queue built on top of Redis. You drop in a job (send this email), workers pick it up, do it, report success or failure. Failed jobs are retried automatically. |
| **Worker** | A process that picks jobs off a queue and executes them. Like a factory employee who picks the next task off the conveyor belt. |
| **FCM (Firebase Cloud Messaging)** | Google's delivery service for push notifications to Android phones. |
| **APNs (Apple Push Notification service)** | Apple's delivery service for push notifications to iPhones. |
| **Device Token** | A unique ID assigned by FCM or APNs to your specific app installation. The server sends the notification to the token — FCM/APNs routes it to your device. |
| **Webhook** | A callback URL. When SendGrid successfully delivers your email, it sends an HTTP POST to your webhook URL saying "delivered!". Like a delivery person leaving a note saying "package left at door". |
| **Idempotency** | Doing the same thing twice gives the same result. If a notification job runs twice, the user receives only one notification. |
| **Exponential Backoff** | Retry strategy: wait 2s, then 4s, then 8s, then 16s before each retry. Avoids hammering a struggling service. Like giving someone more time between attempts to answer the door. |
| **Dead Letter Queue (DLQ)** | Where failed jobs go after exhausting all retries. A parking lot for broken jobs. Engineers inspect it to understand what went wrong. |
| **Quiet Hours** | A user preference: do not send marketing notifications between 10pm and 8am. Transactional and urgent messages bypass this. |
| **Digest** | Bundling multiple notifications into one. Instead of 10 separate "liked your post" notifications, send one: "10 people liked your post". |

---

## Component Diagram

```mermaid
graph TB
    subgraph TRIGGERS["Event Sources"]
        T1["Order Placed"]
        T2["Payment Confirmed"]
        T3["Friend Request"]
        T4["Marketing Campaign"]
        T5["Security Alert"]
    end

    subgraph API["Notification API"]
        LB["Load Balancer"]
        NOTIF_API["Notification Service — validates event, checks preferences, enqueues jobs"]
    end

    subgraph PREF["User Preferences"]
        PREF_SVC["Preferences Service — stores per-user channel opt-ins and quiet hours"]
        PREF_DB["PostgreSQL — user_notification_preferences table"]
    end

    subgraph QUEUES["Bull Queues backed by Redis"]
        Q_PUSH["push-notifications queue — priority high, 3 retries"]
        Q_EMAIL["email-notifications queue — priority medium, 3 retries"]
        Q_SMS["sms-notifications queue — priority high, 3 retries"]
        Q_INAPP["in-app-notifications queue — stored and shown on next login"]
    end

    subgraph WORKERS["Channel Workers — auto-scaled based on queue depth"]
        W_PUSH["Push Worker — sends via FCM for Android and APNs for iOS"]
        W_EMAIL["Email Worker — sends via SendGrid or Amazon SES using HTML templates"]
        W_SMS["SMS Worker — sends via Twilio"]
        W_INAPP["In-App Worker — writes to notification_inbox table"]
    end

    subgraph TRACKING["Delivery Tracking"]
        LOG_DB["PostgreSQL — notification_log table: queued sent delivered read"]
        WEBHOOK["Webhook Handler — receives delivery callbacks from SendGrid, Twilio"]
    end

    T1 & T2 & T3 & T4 & T5 --> LB --> NOTIF_API
    NOTIF_API --> PREF_SVC --> PREF_DB
    NOTIF_API --> Q_PUSH & Q_EMAIL & Q_SMS & Q_INAPP
    Q_PUSH --> W_PUSH
    Q_EMAIL --> W_EMAIL
    Q_SMS --> W_SMS
    Q_INAPP --> W_INAPP
    W_PUSH & W_EMAIL & W_SMS --> LOG_DB
    WEBHOOK --> LOG_DB
```

---

## Notification Send Flow

```mermaid
sequenceDiagram
    participant SVC as Business Service
    participant API as Notification API
    participant PREF as Preferences DB
    participant BULL as Bull Queue
    participant EMAIL_W as Email Worker
    participant SG as SendGrid
    participant WEBHOOK as Webhook Handler
    participant LOG as notification_log

    SVC->>API: POST /notify  userId=U1, event=order.placed, data=order details
    API->>PREF: fetch user U1 preferences
    PREF-->>API: email=true, sms=true, push=false, quietHours=22:00-08:00

    API->>API: current time is 14:00 — not in quiet hours — proceed
    API->>BULL: emailQueue.add(job  to=user@mail.com  template=order-placed  data  attempts=3)
    API->>BULL: smsQueue.add(job  to=+1234567890  message=Order placed!  attempts=3)
    API->>LOG: INSERT row  userId=U1, event=order.placed, status=QUEUED

    BULL->>EMAIL_W: process email job
    EMAIL_W->>SG: POST /mail/send  to, templateId, dynamicData
    SG-->>EMAIL_W: 202 Accepted  messageId=sg_abc
    EMAIL_W->>LOG: UPDATE status=SENT  sentAt=now  messageId=sg_abc

    SG->>WEBHOOK: POST /webhooks/email  event=delivered  messageId=sg_abc
    WEBHOOK->>LOG: UPDATE status=DELIVERED  deliveredAt=now

    SG->>WEBHOOK: POST /webhooks/email  event=open  messageId=sg_abc
    WEBHOOK->>LOG: UPDATE status=READ  readAt=now
```

---

## Quiet Hours and Batching Logic

```mermaid
flowchart TD
    A["Notification triggered"] --> B{"Is user in quiet hours?"}
    B -- No --> C["Send immediately"]
    B -- Yes --> D{"Is this URGENT? Security or fraud alert?"}
    D -- Yes urgent --> C
    D -- No marketing or social --> E["Hold notification"]
    E --> F["Schedule Bull job with delay — fires at 8am next morning"]
    F --> C

    C --> G{"Multiple notifications for same user in last 2 minutes?"}
    G -- Yes promotional --> H["Batch into single digest message"]
    G -- No transactional --> I["Send as individual message"]
```

---

## Bottlenecks — Every Point Explained

| # | Bottleneck | Why It Hurts | Fix |
|---|---|---|---|
| 1 | **Provider rate limits** | SendGrid free tier allows 100 emails/second. A marketing blast to 5 million users would take 14 hours at that rate. | Use multiple SendGrid sub-accounts or switch to Amazon SES which has higher limits. Throttle queue concurrency to match provider limits. |
| 2 | **Marketing blast creates millions of Bull jobs at once** | Enqueueing 5 million jobs instantly bloats Redis memory and overwhelms workers. | Paginated batch strategy: enqueue 1000 users per parent job. Each parent job spawns 1000 individual send jobs. Total memory is controlled. |
| 3 | **Stale device tokens** | User uninstalls app. Their FCM device token is now dead. Push will fail silently for every notification after uninstall. | When FCM returns a `NotRegistered` or `InvalidRegistration` error code, immediately delete that token from the database. Do not retry. |
| 4 | **Webhook events arrive out of order or duplicated** | SendGrid sends "delivered" then "opened" but they arrive "opened" then "delivered". Status machine goes wrong. | Use ordered status progression: QUEUED → SENT → DELIVERED → READ. Only update if incoming status is higher than current. Idempotency key on messageId prevents duplicate updates. |
| 5 | **Checking preferences at enqueue time only** | User opts out of marketing after jobs are already queued. Jobs execute anyway, violating GDPR. | Always re-check user preferences at job execution time, not only at enqueue time. |

---

## What Happens When Each Part Fails?

```mermaid
flowchart TD
    F1["Bull Redis Crashes — All Queued Jobs Are at Risk"]
    F2["SendGrid Is Down — Email Provider Outage"]
    F3["Twilio Rate Limit Error — SMS Rejected"]
    F4["Webhook Endpoint Is Down — Delivery Status Lost"]
    F5["Worker Crashes Mid-Job"]

    F1 --> R1["Bull stores jobs in Redis Lists which are replicated like any other Redis data.
    If Redis uses AOF persistence (Append-Only File), jobs survive a restart.
    AOF means every write operation is appended to a log file on disk immediately.
    On recovery, Redis replays the log and all jobs reappear.
    Without persistence: jobs in flight are lost and must be re-enqueued from notification_log
    by querying rows with status=QUEUED."]

    F2 --> R2["Email worker receives a 5xx error from SendGrid.
    Bull marks the job as failed and schedules retry number 1 after 2 seconds.
    Retry 2 after 4 seconds. Retry 3 after 8 seconds.
    After 3 failures the job moves to the Dead Letter Queue.
    Circuit breaker: if more than 50% of jobs fail within 1 minute,
    the email worker automatically switches to Amazon SES as a failover provider."]

    F3 --> R3["Twilio returns a 429 Too Many Requests error.
    SMS worker pauses that particular queue for 60 seconds.
    Job is retried after the pause using exponential backoff.
    For volume campaigns: use multiple Twilio sender numbers in rotation.
    Each sender number has its own rate limit so load is spread across them."]

    F4 --> R4["Delivery webhook never arrives.
    Notification stays as status=SENT in the log indefinitely.
    Reconciliation job runs hourly: for notifications in SENT state over 2 hours,
    query SendGrid status API using the stored messageId.
    Update status from the API response.
    This is eventual consistency — delivery status is accurate within 1-2 hours roughly."]

    F5 --> R5["Bull uses a job lock mechanism.
    When a worker picks up a job it acquires a lock with a 30-second expiry.
    If the worker crashes, the lock expires after 30 seconds.
    Another worker picks up the unlocked job and processes it.
    To prevent duplicate sends: worker checks notification_log before sending.
    If status is already SENT or higher, skip the send and mark job complete.
    This makes every send operation idempotent."]
```

---

## Notification Priority Reference

| Type | Channels | Quiet Hours | Batch |
|---|---|---|---|
| Security OTP, fraud alert | SMS + Email | Bypass always | Never |
| Transactional (order, payment) | Push + Email | Bypass | Never |
| Social (likes, follows) | Push + In-app | Respect | Yes 5 min |
| Marketing / promo | Email + Push | Respect | Yes |
| Weekly digest | Email | Respect | Yes |

---

## Key Numbers

| Metric | Value |
|---|---|
| Facebook daily notifications | ~10 billion |
| Email delivery rate target | 99%+ |
| Push notification latency | Under 500ms |
| SMS delivery latency | Under 3 seconds |
| Bull retry strategy | 3 attempts, exponential backoff |
| Job lock expiry | 30 seconds |

---

## How All Components Work Together (The Full Story)

Think of a notification system as a post office that must deliver letters, text messages, phone calls, and app buzzes — and knows each person's preferred method and sleeping schedule.

**When a business event triggers a notification:**
1. An event (e.g. `order.placed`) arrives at the **Notification API** from any business service. The API is the single entry point — no business service needs to know anything about email or push mechanics.
2. The API calls the **Preferences Service** to find out: does this user want email? SMS? Push? Are they in Quiet Hours right now? Is this notification type something they opted into?
3. Based on preferences, the API enqueues one job per channel into the appropriate **Bull Queue** in Redis. Job for email → email queue. Job for SMS → SMS queue. Job for push → push queue.
4. **Workers** (auto-scaling, one pool per channel) pick up jobs from their queue and call the relevant third-party provider: **SendGrid** for email, **Twilio** for SMS, **FCM/APNs** for push.
5. Bull automatically retries failed jobs with exponential backoff (2s, 4s, 8s). After 3 failures, the job moves to the **Dead Letter Queue** for engineering inspection.
6. Providers call back via **webhooks** to report delivery outcomes (sent, delivered, opened, bounced). The **Webhook Handler** updates the **notification_log** table.

**How the components support each other:**
- **Bull queues** decouple the API from the workers — a marketing blast of 5 million emails doesn't block the API from accepting new events.
- **Bull's lock mechanism** prevents two workers from processing the same job simultaneously (even during restarts).
- The **notification_log** provides idempotency: before sending, a worker checks if the job was already sent (status ≥ SENT). This prevents duplicate sends on job retries.
- The **Reconciliation Job** is the safety net for when all else fails — webhooks missed, workers crashed — it polls provider APIs for delivery status.

> **ELI5 Summary:** Notification API is the mail-sorting desk. Preferences DB is the "do not disturb" list. Bull Queue is the separate mail trays for each delivery type. Workers are the delivery drivers. FCM/APNs/SendGrid/Twilio are the postal carriers for each country. notification_log is the delivery receipt book. Dead Letter Queue is the undeliverable mail bin.

---

## Key Trade-offs

| Decision | Option A | Option B | Why We Pick B (or A) |
|---|---|---|---|
| **Synchronous send vs async queue** | Send notification inline during the request (sync) | Enqueue and send asynchronously (async) | **Async**: a 5M-user marketing blast sending synchronously would time out the API caller's request (hours). Async returns immediately and workers drain the queue at their own pace. |
| **Single queue vs channel-specific queues** | One queue for all notification types | Separate queues per channel (email, SMS, push) | **Separate queues**: different providers have different rate limits and failure modes. A SendGrid outage should not block SMS sends. Channel isolation means each channel drains independently. |
| **Check preferences at enqueue vs at execution** | Check once at enqueue time | Re-check at execution time (inside the worker) | **Re-check at execution**: a user may opt out between enqueue and execution. GDPR requires respecting opt-out immediately. Checking only at enqueue time violates this regulation. |
| **Device token stored in DB vs provider managed** | Store device tokens in your own PostgreSQL | Store in PostgreSQL and cache in Redis | **Both**: PostgreSQL is the source of truth, Redis is used for fast lookup during bulk push blasts. Always remove invalid tokens (NotRegistered error from FCM) immediately from PostgreSQL. |
| **Transactional vs marketing notification paths** | Same queue and workers for both | Separate high-priority queues for transactional (OTP, security), lower priority for marketing | **Separate priority queues**: an OTP (one-time password) for login must arrive in under 10 seconds or the user will retry. A marketing email can wait hours. Mixing them means marketing volume could delay critical security notifications. |
| **Batching similar notifications vs individual sends** | Send each notification individually | Bundle multiple same-type notifications into a digest | **Batching for marketing / social**: "10 people liked your post" beats 10 separate buzzes. Zero batching for transactional: order confirmations, OTPs, fraud alerts must arrive instantly and individually. |

---

## Important Cross Questions

**Q1. Your marketing team wants to send a push notification to 50 million users simultaneously. How does your system handle this?**
> Don't enqueue 50M individual jobs at once — that bloats Redis memory. Use a paginated batch strategy: enqueue 50,000 parent jobs, each responsible for a batch of 1,000 users. Each parent job spawns 1,000 send jobs as it runs. This spreads memory usage across time. FCM supports batch send (up to 500 tokens per API call), so 1,000 users = 2 FCM API calls per parent job. Total FCM calls: 100,000 — manageable. Workers auto-scale based on queue depth.

**Q2. A push notification is sent to a user who uninstalled the app 6 months ago. What happens?**
> FCM/APNs returns a `NotRegistered` or `InvalidRegistration` error. The push worker receives this error code and immediately deletes the device token from PostgreSQL. No retry. Future notifications to this user will check for device tokens, find none, and skip push (or fall back to email/SMS based on preferences). This cleanup is critical — sending to dead tokens wastes quota and may flag your app as spam.

**Q3. How do you ensure a user doesn't receive duplicate notifications if a worker processes the same job twice?**
> Idempotency check inside the worker: before calling SendGrid/FCM/Twilio, the worker checks `notification_log` for `status >= SENT` with the matching `notificationId`. If found, it skips the send and marks the Bull job as complete. The `notificationId` is generated at enqueue time and stored in the Bull job payload. This makes every send operation idempotent — processing the same job twice has the same effect as processing it once.

**Q4. How do you implement timezone-aware quiet hours — "don't send marketing notifications between 10pm and 8am in the user's local time"?**
> Store the user's timezone in the Preferences Service (`America/New_York`, `Asia/Tokyo`). At notification evaluation time, convert `now` to the user's timezone using a library (moment-tz, Luxon). Compare with quiet hours window. If in quiet hours: delay the notification by scheduling a Bull job with a `delay` parameter set to the number of milliseconds until 8am in the user's timezone. The job sits in the queue and fires exactly at 8am local time.

**Q5. SendGrid goes down for 2 hours. What happens to queued emails? Are they lost?**
> No. The email workers receive 5xx errors from SendGrid and Bull marks each job as failed, scheduling retries with exponential backoff. Retries accumulate over the 2- hour window. When SendGrid recovers, the backlog of retries start processing. Jobs that exhausted all 3 retries during the outage are in the Dead Letter Queue. After SendGrid recovery, an engineer replays the DLQ manually, or an automated job re-enqueues DLQ items back to the main email queue.

**Q6. How do you measure the effectiveness of your notification system for business analytics?**
> Track four metrics per notification: **deliverability** (sent / attempted), **open rate** (opened / delivered), **click rate** (clicked CTA / opened), **unsubscribe rate** (opted out after receiving). All these come from webhook events in `notification_log`. Build a dashboard querying this table aggregated by campaign, notification type, and user segment. A/B test notification copy by randomly assigning users to group A or B at enqueue time and comparing click rates per group.
