# Ticket Online Booking System — System Design

> Scale: **100K+ concurrent users** | Seat Safety: **No double booking** | Notifications: **Email · SMS · Bull Queue**

---

## 1. High-Level Component Diagram

```mermaid
graph TB
    subgraph CLIENT["🖥️ Client Layer"]
        WEB["React / Next.js\nWeb App"]
        MOB["Mobile App\n(React Native)"]
    end

    subgraph EDGE["🌐 Edge Layer"]
        CDN["CDN\n(CloudFront / Akamai)"]
        LB["Load Balancer\n(NGINX / ALB)"]
        GW["API Gateway\n(Rate Limit · Auth · Routing)"]
    end

    subgraph SERVICES["⚙️ Microservices"]
        US["User Service\n(Auth · Profile · JWT)"]
        ES["Event Service\n(Catalog · Seats · Search)"]
        SLS["Seat Lock Service\n(Redis TTL Lock · 10 min)"]
        BS["Booking Service\n(Create · Confirm · Cancel)"]
        PS["Payment Service\n(Stripe / Razorpay)"]
        NS["Notification Service\n(Dispatcher)"]
    end

    subgraph QUEUE["📨 Message Queue (Bull + Redis)"]
        BQ_EMAIL["Bull Queue\nemail-notifications"]
        BQ_SMS["Bull Queue\nsms-notifications"]
        BQ_CONFIRM["Bull Queue\nbooking-events"]
    end

    subgraph WORKERS["👷 Queue Workers"]
        EW["Email Worker\n(SendGrid / Nodemailer)"]
        SW["SMS Worker\n(Twilio / AWS SNS)"]
        BW["Booking Worker\n(PDF Ticket · Audit)"]
    end

    subgraph DATA["🗄️ Data Layer"]
        PG[("PostgreSQL\nUsers · Bookings · Payments")]
        REDIS[("Redis\nSeat Locks · Sessions · Cache")]
        ES_DB[("Elasticsearch\nEvent Search · Filters")]
        S3["S3 / Object Store\nTicket PDFs · Assets"]
    end

    subgraph MONITORING["📊 Observability"]
        PROM["Prometheus + Grafana"]
        SENTRY["Sentry (Errors)"]
        LOGS["ELK Stack (Logs)"]
    end

    WEB & MOB --> CDN --> LB --> GW
    GW --> US
    GW --> ES
    GW --> SLS
    GW --> BS
    GW --> PS

    BS --> NS
    PS --> NS

    NS --> BQ_EMAIL --> EW
    NS --> BQ_SMS --> SW
    NS --> BQ_CONFIRM --> BW

    US --> PG
    BS --> PG
    PS --> PG
    ES --> PG
    ES --> ES_DB

    SLS --> REDIS
    GW --> REDIS

    BW --> S3

    SERVICES --> PROM
    SERVICES --> SENTRY
    SERVICES --> LOGS
```

---

## 2. Seat Booking Flow — Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant GW as API Gateway
    participant ES as Event Service
    participant SLS as Seat Lock Service
    participant Redis as Redis
    participant BS as Booking Service
    participant PS as Payment Service
    participant DB as PostgreSQL
    participant NS as Notification Service
    participant BQ as Bull Queue

    User->>FE: Browse Events
    FE->>GW: GET /events?category=concert
    GW->>ES: fetch events + available seats
    ES->>DB: SELECT events, seats WHERE status='available'
    DB-->>ES: event list + seat map
    ES-->>FE: events with seat availability

    User->>FE: Select Seat(s)
    FE->>GW: POST /seats/lock {eventId, seatIds, userId}
    GW->>SLS: acquireLock(seatId, userId, TTL=10min)
    SLS->>Redis: SET seat:{seatId} userId EX 600 NX
    alt Seat Already Locked
        Redis-->>SLS: nil (lock failed)
        SLS-->>FE: 409 Seat Unavailable
    else Lock Acquired
        Redis-->>SLS: OK
        SLS-->>FE: 200 Seats Locked (countdown: 10min)
    end

    User->>FE: Fill Details + Proceed to Pay
    FE->>GW: POST /bookings {seatIds, userId, eventId}
    GW->>BS: createPendingBooking()
    BS->>DB: INSERT booking (status=PENDING)
    BS-->>FE: bookingId + paymentIntent

    User->>FE: Enter Payment Details
    FE->>PS: POST /payments/process {bookingId, paymentToken}
    PS->>DB: INSERT payment (status=PROCESSING)
    PS->>PS: Stripe/Razorpay Charge API

    alt Payment Success
        PS->>DB: UPDATE payment status=SUCCESS
        PS->>BS: confirmBooking(bookingId)
        BS->>DB: UPDATE booking status=CONFIRMED\nUPDATE seats status=BOOKED
        BS->>SLS: releaseLock(seatId)
        SLS->>Redis: DEL seat:{seatId}
        BS->>NS: emit BOOKING_CONFIRMED event
        NS->>BQ: add job → email-notifications
        NS->>BQ: add job → sms-notifications
        NS->>BQ: add job → booking-events (PDF)
        BQ-->>User: Email Confirmation (async)
        BQ-->>User: SMS Confirmation (async)
    else Payment Failed
        PS->>DB: UPDATE payment status=FAILED
        PS->>SLS: releaseLock(seatId)
        SLS->>Redis: DEL seat:{seatId}
        PS-->>FE: 402 Payment Failed
    end
```

---

## 3. Seat Locking Strategy (No Double Booking)

```mermaid
flowchart TD
    A["User Selects Seat"] --> B{"Redis NX Lock\nSET seat:ID userId EX 600 NX"}
    B -->|"Lock Acquired"| C["Show Payment Page\n⏱ 10-min countdown"]
    B -->|"Lock Exists"| D["Return 409\nSeat Temporarily Held"]
    C --> E{"Payment Completed\nwithin 10 min?"}
    E -->|"Yes"| F["DB Transaction:\nUPDATE seat=BOOKED\nUPDATE booking=CONFIRMED"]
    F --> G["DEL Redis Lock"]
    G --> H["Fire Notification Jobs"]
    E -->|"No / Timeout"| I["TTL Expires\nRedis auto-releases lock"]
    I --> J["Seat available again"]
    E -->|"Payment Failed"| K["Explicit DEL lock\nSeat re-available"]
```

### Why Redis NX (Not Exists)?
| Concern | Solution |
|---|---|
| Two users click same seat simultaneously | `SET NX` is atomic — only one wins |
| User abandons checkout | TTL auto-releases after 10 min |
| Payment fails | Explicit DEL in failure handler |
| Server crashes mid-payment | TTL still fires — no orphaned locks |
| Multiple booking service instances | Redis is shared state across all pods |

---

## 4. Notification Architecture (Bull Queue)

```mermaid
graph LR
    subgraph TRIGGERS["Event Triggers"]
        BC["Booking Confirmed"]
        PF["Payment Failed"]
        ER["Event Reminder\n(24h before)"]
        EC["Event Cancelled"]
    end

    subgraph NS["Notification Service"]
        DISP["Dispatcher\n(decides channels)"]
        PREF["User Preferences\n(email/sms/both)"]
    end

    subgraph BULL["Bull Queue (Redis-backed)"]
        Q1["Queue: email-notifications\n(priority: high, retries: 3)"]
        Q2["Queue: sms-notifications\n(priority: high, retries: 3)"]
        Q3["Queue: booking-events\n(PDF generation, audit)"]
        Q4["Queue: reminders\n(delayed jobs, cron)"]
    end

    subgraph WORKERS["Workers (auto-scaled)"]
        EW["Email Worker\nSendGrid / Nodemailer\nHTML Templates"]
        SW["SMS Worker\nTwilio / AWS SNS\n160-char limit"]
        PW["PDF Worker\npuppeteer → QR ticket\nS3 upload"]
        RW["Reminder Worker\nBull repeatable jobs"]
    end

    BC & PF & ER & EC --> DISP
    DISP --> PREF
    PREF --> Q1 & Q2 & Q3 & Q4
    Q1 --> EW
    Q2 --> SW
    Q3 --> PW
    Q4 --> RW
```

### Bull Queue Job Example

```javascript
// Notification Service — dispatcher.js
const Queue = require('bull');
const emailQueue = new Queue('email-notifications', { redis: redisConfig });
const smsQueue   = new Queue('sms-notifications',   { redis: redisConfig });
const bookingQueue = new Queue('booking-events',    { redis: redisConfig });

async function dispatchBookingConfirmed(booking, user) {
  const jobOpts = { attempts: 3, backoff: { type: 'exponential', delay: 2000 } };

  await emailQueue.add('booking-confirmed', {
    to: user.email,
    template: 'booking-confirmation',
    data: { name: user.name, event: booking.event, seats: booking.seats, bookingId: booking.id }
  }, jobOpts);

  await smsQueue.add('booking-confirmed', {
    to: user.phone,
    message: `Booking confirmed! ${booking.event.name} on ${booking.event.date}. Seats: ${booking.seats.join(',')}. ID: ${booking.id}`
  }, jobOpts);

  await bookingQueue.add('generate-ticket', {
    bookingId: booking.id,
    userId: user.id
  }, { ...jobOpts, priority: 2 });
}

// Email Worker
emailQueue.process('booking-confirmed', async (job) => {
  const { to, template, data } = job.data;
  await sendgrid.send({ to, subject: 'Booking Confirmed!', templateId: templates[template], dynamicTemplateData: data });
});

// SMS Worker
smsQueue.process('booking-confirmed', async (job) => {
  const { to, message } = job.data;
  await twilio.messages.create({ body: message, from: process.env.TWILIO_FROM, to });
});
```

---

## 5. Database Schema

```mermaid
erDiagram
    USERS {
        uuid id PK
        string name
        string email
        string phone
        string password_hash
        timestamp created_at
    }

    EVENTS {
        uuid id PK
        string title
        string venue
        datetime event_date
        string category
        int total_capacity
        decimal base_price
        string status
        timestamp created_at
    }

    SEATS {
        uuid id PK
        uuid event_id FK
        string row
        string number
        string category
        decimal price
        string status
    }

    BOOKINGS {
        uuid id PK
        uuid user_id FK
        uuid event_id FK
        string status
        decimal total_amount
        timestamp booked_at
        timestamp expires_at
    }

    BOOKING_SEATS {
        uuid booking_id FK
        uuid seat_id FK
    }

    PAYMENTS {
        uuid id PK
        uuid booking_id FK
        string provider
        string provider_ref
        decimal amount
        string status
        jsonb metadata
        timestamp processed_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        uuid booking_id FK
        string channel
        string status
        string job_id
        timestamp sent_at
    }

    USERS ||--o{ BOOKINGS : "makes"
    EVENTS ||--o{ SEATS : "has"
    EVENTS ||--o{ BOOKINGS : "has"
    BOOKINGS ||--o{ BOOKING_SEATS : "contains"
    SEATS ||--o{ BOOKING_SEATS : "in"
    BOOKINGS ||--|| PAYMENTS : "paid via"
    BOOKINGS ||--o{ NOTIFICATIONS : "triggers"
```

---

## 6. Scalability Strategy (100K+ Users)

```mermaid
graph TB
    subgraph SCALE["Scale-Out Architecture"]
        LB["Load Balancer\n(sticky sessions OFF)"]

        subgraph API_PODS["API Pods (k8s HPA)"]
            P1["Pod 1"]
            P2["Pod 2"]
            P3["Pod N..."]
        end

        subgraph CACHE["Caching Strategy"]
            RC["Redis Cluster\n• Seat locks (TTL)\n• Session tokens\n• Event catalog (5 min)\n• Seat map (1 min)"]
        end

        subgraph DB_LAYER["Database Layer"]
            PG_W["PostgreSQL Writer\n(bookings, payments)"]
            PG_R1["Read Replica 1\n(event browsing)"]
            PG_R2["Read Replica 2\n(user queries)"]
            ES_SEARCH["Elasticsearch\n(event search)"]
        end

        subgraph WORKERS["Bull Workers (auto-scaled)"]
            W1["Email Workers x3"]
            W2["SMS Workers x3"]
            W3["PDF Workers x2"]
        end
    end

    LB --> P1 & P2 & P3
    P1 & P2 & P3 --> RC
    P1 & P2 & P3 --> PG_W
    P1 & P2 & P3 --> PG_R1 & PG_R2
    P1 & P2 & P3 --> ES_SEARCH
```

### Key Scaling Decisions

| Concern | Decision |
|---|---|
| **100K concurrent users** | Horizontal pod scaling (k8s HPA), Redis cluster |
| **Event browsing spikes** | Cache event catalog in Redis (5 min TTL), CDN for static |
| **Seat map reads** | Redis cache with 1-min TTL + cache-aside pattern |
| **Payment throughput** | Async payment confirmation via webhooks |
| **Notification backlog** | Bull Queue with multiple workers, priority lanes |
| **Search performance** | Elasticsearch for full-text event search |
| **DB write bottleneck** | Connection pooling (PgBouncer), write to primary only |
| **Flash sales / major events** | Queue-based seat selection (virtual waiting room) |

---

## 7. API Contract (REST)

```
# Event Browsing
GET  /api/v1/events                    # list with filters (category, date, city)
GET  /api/v1/events/:id                # event detail + venue map
GET  /api/v1/events/:id/seats          # real-time seat availability

# Seat Locking
POST /api/v1/seats/lock                # { eventId, seatIds[] } → 10-min lock
DELETE /api/v1/seats/lock/:lockId      # release early

# Booking
POST /api/v1/bookings                  # create pending booking
GET  /api/v1/bookings/:id              # booking status
GET  /api/v1/bookings/user/me          # user's booking history

# Payments
POST /api/v1/payments/initiate         # get paymentIntent / order
POST /api/v1/payments/webhook          # Stripe/Razorpay webhook callback
POST /api/v1/payments/refund           # initiate refund

# Notifications
GET  /api/v1/notifications/preferences # get user prefs
PUT  /api/v1/notifications/preferences # update email/sms opt-in
```

---

## 8. Tech Stack Summary

| Layer | Technology | Why |
|---|---|---|
| Frontend | React / Next.js | SSR for SEO, fast seat map rendering |
| API Gateway | Kong / NGINX | Rate limiting, JWT auth, routing |
| Services | Node.js (Express/Fastify) | Non-blocking I/O, JS ecosystem |
| Seat Lock | Redis `SET NX EX` | Atomic, fast, TTL-based auto-release |
| Primary DB | PostgreSQL | ACID transactions for bookings/payments |
| Search | Elasticsearch | Full-text event search, geo queries |
| Message Queue | Bull (Redis-backed) | Reliable jobs, retries, priority, delay |
| Email | SendGrid / Nodemailer | Templates, delivery analytics |
| SMS | Twilio / AWS SNS | Global reach, delivery receipts |
| PDF Tickets | Puppeteer + S3 | QR code, barcode generation |
| Container | Docker + Kubernetes | Auto-scaling, rolling deploys |
| Monitoring | Prometheus + Grafana | Queue depth, latency, error rate |
| Tracing | Jaeger / OpenTelemetry | Trace booking flow end-to-end |

---

## 9. Critical Edge Cases

```
┌─────────────────────────────────────────────────────────────────────┐
│  EDGE CASE                  │  SOLUTION                             │
├─────────────────────────────┼───────────────────────────────────────┤
│  Two users lock same seat   │  Redis SET NX — atomic, only one wins │
│  Payment gateway timeout    │  Idempotency key, webhook retry       │
│  User closes tab mid-pay    │  TTL auto-releases lock in 10 min     │
│  Webhook fires twice        │  Idempotency check on booking status  │
│  Event suddenly cancelled   │  Batch refund job, notify via Bull    │
│  Flash sale (10K req/sec)   │  Virtual queue, rate-limit per user   │
│  Overselling (race cond.)   │  DB constraint: UNIQUE(event, seat)   │
│  Bull worker crashes        │  Bull auto-retries with backoff       │
│  Redis goes down            │  Fallback: DB row-level seat lock     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. Deployment Architecture

```mermaid
graph LR
    subgraph K8S["Kubernetes Cluster"]
        subgraph NS_APP["Namespace: app"]
            D1["user-service\n(2-5 replicas)"]
            D2["event-service\n(3-8 replicas)"]
            D3["seat-lock-service\n(2-4 replicas)"]
            D4["booking-service\n(3-8 replicas)"]
            D5["payment-service\n(2-4 replicas)"]
            D6["notification-service\n(2-3 replicas)"]
        end
        subgraph NS_WORKERS["Namespace: workers"]
            W1["email-worker\n(HPA: queue depth)"]
            W2["sms-worker\n(HPA: queue depth)"]
            W3["pdf-worker\n(HPA: queue depth)"]
        end
        subgraph NS_DATA["Namespace: data"]
            R["Redis Cluster\n(6 nodes)"]
            P["PostgreSQL\n(primary + 2 replicas)"]
        end
    end

    CI["CI/CD Pipeline\n(GitHub Actions)"] -->|"Docker Build + Push"| REG["Container Registry\n(ECR / GCR)"]
    REG -->|"Helm Deploy"| K8S
```
