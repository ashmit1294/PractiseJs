# Pattern 04 — Chat System (like WhatsApp / Slack)

---

## ELI5 — What Is This?

> Normal web browsing is like knocking on a door, getting an answer, and leaving.
> Chat needs a door that stays open — so your friend can tap you on the shoulder any time.
> That "always-open door" is called a WebSocket connection.
> Messages fly both ways instantly without knocking every time.

---

## Glossary

| Word | ELI5 Meaning |
|---|---|
| **WebSocket** | A permanent two-way pipe between your browser and the server. Unlike normal HTTP where you ask and the server answers, WebSocket lets the server push messages to you any time. Like a phone call vs sending letters. |
| **Presence** | The online/offline/last-seen status of a user. "User A was last seen 5 minutes ago." |
| **Fan-out** | Sending one message to many recipients. Like a teacher announcing something and every student hears it. |
| **Redis Pub/Sub** | A broadcasting system inside Redis. One server publishes to a channel; any other server subscribed to that channel receives it instantly. Like a walkie-talkie channel. |
| **Cassandra** | A database designed to handle enormous amounts of writes and store data partitioned by chat room ID and time. Perfect for chat history. |
| **heartbeat** | A tiny "I'm still alive" message sent by the client every 25 seconds so the server knows the connection is still active. Like blinking to show you're awake. |
| **FCM (Firebase Cloud Messaging)** | Google's service for sending push notifications to Android devices. |
| **APNs (Apple Push Notification service)** | Apple's service for sending push notifications to iPhones. |
| **Idempotency** | Doing the same thing twice gives the same result as doing it once. Like pressing a light switch twice — if you want it on, pressing "on" twice still just leaves it on. Important for safe retries. |
| **clientMsgId** | A unique ID the client generates for each message before sending it. Used to detect duplicates if the message is retried. |

---

## Component Diagram

```mermaid
graph TB
    subgraph CLIENTS["Clients"]
        USERA["User A — Mobile or Web"]
        USERB["User B — Mobile or Web"]
        USERC["User C — Currently Offline"]
    end

    subgraph CONNECTION["Connection Layer"]
        LB["L4 Load Balancer — TCP sticky routing, same user always goes to same WS server"]
        WS1["WebSocket Server 1 — holds User A persistent connection"]
        WS2["WebSocket Server 2 — holds User B persistent connection"]
    end

    subgraph PRESENCE["Presence Service"]
        PRES_SVC["Presence Service — tracks who is online"]
        PRES_REDIS["Redis — user status with 35 second TTL, refreshed by heartbeat"]
    end

    subgraph MESSAGE["Message Pipeline"]
        MSG_SVC["Message Service — validates, stores, routes each message"]
        KAFKA["Kafka — carries message events between services reliably"]
    end

    subgraph ROUTING["Cross-Server Routing"]
        PUBSUB["Redis Pub/Sub — WebSocket servers subscribe to user channels"]
    end

    subgraph STORAGE["Storage"]
        CASS["Cassandra — chat history partitioned by chatId and time bucket"]
        PG["PostgreSQL — user accounts, groups, membership"]
        BLOB["S3 — images, videos, and documents"]
    end

    subgraph PUSH["Push Notifications for Offline Users"]
        NOTIF["Notification Service"]
        FCM["FCM — Android push"]
        APNS["APNs — iOS push"]
    end

    USERA <-- WebSocket --> LB
    USERB <-- WebSocket --> LB
    LB --> WS1 & WS2
    WS1 --> MSG_SVC --> KAFKA --> CASS
    KAFKA --> PUBSUB --> WS2 --> USERB
    KAFKA --> NOTIF --> FCM & APNS --> USERC
    WS1 --> PRES_SVC --> PRES_REDIS
```

---

## Message Delivery Flow

```mermaid
sequenceDiagram
    actor A as User A
    participant WS1 as WebSocket Server 1
    participant MSG as Message Service
    participant KAFKA as Kafka
    participant CASS as Cassandra
    participant PUBSUB as Redis Pub/Sub
    participant WS2 as WebSocket Server 2
    actor B as User B
    participant PUSH as Push Notification Service
    actor C as User C offline

    A->>WS1: send message to B  clientMsgId=abc123
    WS1->>MSG: route message
    MSG->>CASS: INSERT message row
    MSG->>KAFKA: publish message event
    WS1-->>A: ACK — delivered to server, status=SENT

    KAFKA->>PUBSUB: publish on channel user-B
    PUBSUB->>WS2: User B is on this server, deliver now
    WS2->>B: push message
    B-->>WS2: read receipt
    WS2->>MSG: update message status to READ
    MSG-->>WS1: notify A
    WS1-->>A: double tick — message read by B

    KAFKA->>PUSH: User C is offline
    PUSH->>FCM: send push notification
    FCM-->>C: notification appears on lock screen
```

---

## Presence — Heartbeat System

```mermaid
flowchart TD
    A["User connects WebSocket"] --> B["Presence Service sets user=online in Redis, TTL=35s"]
    B --> C["Client sends heartbeat every 25 seconds"]
    C --> D["Presence Service resets TTL to 35 seconds again"]
    D --> C

    E["User closes app gracefully"] --> F["WebSocket onclose fires, Presence sets user=offline"]
    G["User loses internet, no heartbeat"] --> H["Redis TTL expires after 35 seconds, auto-marks offline"]
```

> **Why 35s TTL with 25s heartbeat?**
> The 10-second gap absorbs occasional network hiccups — one missed heartbeat does not immediately show you as offline.

---

## Bottlenecks — Every Point Explained

| # | Bottleneck | Why It Hurts | Fix |
|---|---|---|---|
| 1 | **Memory per WebSocket connection** | Each open connection uses about 50KB of RAM. 1 million connections = 50 GB on one server. | Use event-driven servers (Node.js, Netty) that handle 1 million connections asynchronously with far less RAM than thread-based servers. |
| 2 | **Group message fan-out** | Sending to a 1000-member group means 1000 individual deliveries. At 1 message per second per group that is 1000 write operations per second for one group alone. | Use **fan-out on read** for large groups (> 500 members) — members pull messages when they open the chat. Use fan-out on write only for small groups. |
| 3 | **Cassandra hot partition** | A very active chat room may write thousands of messages per second to the same partition key (chatId), overloading that one partition. | Use a composite key: `(chatId, week_bucket)`. Week bucket changes every week, spreading load across new partitions automatically. |
| 4 | **Redis Pub/Sub single-threaded** | Redis processes Pub/Sub events on a single thread. At very high scale, the routing layer becomes a bottleneck. | Shard channels by user-ID range across multiple Redis nodes. Or replace Pub/Sub with Kafka for durable inter-server routing. |
| 5 | **Presence storm on reconnect** | If 10 million users all reconnect after a brief outage, 10 million simultaneous SET commands flood Redis. | Add jitter (random delay up to 10 seconds) in client reconnect logic to spread the storm out. |

---

## What Happens When Each Part Fails?

```mermaid
flowchart TD
    F1["WebSocket Server Crashes"]
    F2["Cassandra Node Fails"]
    F3["Kafka Partition Leader Fails"]
    F4["Redis Pub/Sub Is Down — Cross-Server Routing Broken"]
    F5["FCM or APNs Is Unreachable"]
    F6["Network Splits User A from Server — ACK Never Arrives"]

    F1 --> R1["Client detects WebSocket disconnect immediately via the onclose event.
    Client reconnects with exponential backoff — wait 1s, 2s, 4s between attempts.
    Reconnects to a different WebSocket server via load balancer.
    On reconnect, client sends its last seen message ID.
    Server returns any messages missed during the outage from Cassandra.
    This gap recovery is called message sync on reconnect."]

    F2 --> R2["Cassandra uses replication factor 3 — every message is on 3 different machines.
    Quorum write means 2 of 3 must confirm before success.
    If 1 node is down, the other 2 still form a quorum and everything keeps working.
    The dead node uses hinted handoff to catch up when it comes back.
    Users see no disruption at all for a single node failure."]

    F3 --> R3["Kafka automatically elects a new partition leader in under 10 seconds.
    During those 10 seconds, the message producer buffers messages locally and retries.
    With acks=all setting, no message is lost — the producer waits for confirmation
    before considering a send complete.
    Messages are delivered in order with a delay of up to 10 seconds."]

    F4 --> R4["Cross-server routing fails — User A's message sits on WS Server 1
    but User B is on WS Server 2 and never receives the push.
    The message IS saved to Cassandra (that path does not go through Pub/Sub).
    When User B opens the app, they fetch missing messages from Cassandra directly.
    Real-time delivery degrades to near-real-time pull.
    Fix: deploy Redis Cluster for high availability of Pub/Sub."]

    F5 --> R5["Offline user C does not receive the push notification immediately.
    The notification is stored in the notifications table.
    When User C opens the app, client fetches unread messages from the server.
    The push notification is retried using an exponential backoff by the push service.
    Most push providers queue for 24-72 hours before giving up."]

    F6 --> R6["User A sends a message, the server processes it, but the ACK is lost on the way back.
    User A's client sees the message in a pending state.
    After 5 seconds, client retries with the same clientMsgId.
    Server checks if clientMsgId is already in Cassandra — it is, so it skips the insert.
    Server replies with the existing message ID and status=SENT.
    Message is stored exactly once. This is idempotency in action."]
```

---

## Key Numbers

| Metric | Value |
|---|---|
| Daily active users (WhatsApp scale) | 2 billion |
| Messages per day | 100 billion |
| WebSocket connections per server | 1 million |
| Presence heartbeat interval | 25 seconds |
| Message delivery P99 latency | Under 100ms |
| Message storage partitioning | chatId + weekly bucket |

---

## How All Components Work Together (The Full Story)

Think of a chat system as a telephone exchange where two people must always have an open line to the operator, and the operator knows how to connect them to each other instantly.

**When User A sends a message to User B:**
1. User A's phone has a permanent open **WebSocket** connection to **WebSocket Server 1**. This is the "always-open door" — established when the app opened, maintained by heartbeats.
2. A types a message. It travels instantly over this connection to **WS Server 1**, which hands it off to the **Message Service** for validation and persistence.
3. The **Message Service** writes the message to **Cassandra** (durable, partitioned by chatId). This is the permanent record.
4. Simultaneously, the Message Service publishes a `message.created` event to **Kafka** — the reliable conveyor belt.
5. Kafka fans the event out: one path goes to **Redis Pub/Sub** (for live delivery), another path goes to the **Push Notification Service** (for offline users).
6. **Redis Pub/Sub** broadcasts the message on the channel `user-B`. **WS Server 2** (which holds User B's connection) is subscribed to that channel and receives the event immediately.
7. WS Server 2 pushes the message to User B's phone. User B's app sends a read receipt back, which travels the same path in reverse, ending as a "double tick" on User A's screen.
8. If User C is offline, the event reaches the **Push Notification Service**, which calls **FCM** (Android) or **APNs** (iOS) to light up a banner on C's lock screen.

**How the components support each other:**
- **Cassandra** stores the durable truth. Even if Redis Pub/Sub is completely down, users get messages when they open the app (pull from Cassandra).
- **Redis Pub/Sub** is the real-time shortcut that makes delivery feel instant.
- **Kafka** decouples the core message path from push notifications — a slow APNS cannot back up message delivery.
- **Presence** runs on a separate Redis key-space with TTL, completely independent of the message path. It never blocks a message send.

> **ELI5 Summary:** WebSocket is the phone call that stays open. WS Servers are telephone exchanges. Redis Pub/Sub is the speakerphone that announces the message to the right exchange. Cassandra is the voicemail box. Kafka is the dispatcher who routes copies of the message to the right departments. FCM/APNs are the telegram delivery boys for people not on the phone.

---

## Key Trade-offs

| Decision | Option A | Option B | Why We Pick B (or A) |
|---|---|---|---|
| **WebSocket vs Long-Polling** | Long-Polling — client repeatedly asks "anything new?" every 30s | WebSocket — persistent bidirectional connection | **WebSocket** for chat: latency is under 100ms vs 30s. Long-polling wastes bandwidth and cannot deliver real-time "typing" indicators. |
| **Fan-out on write vs fan-out on read for group messages** | Push to every member's inbox immediately (fan-out on write) | Members pull from a central group timeline (fan-out on read) | **Fan-out on write** for small groups (<200 members). **Fan-out on read** for large groups (Slack channels with thousands) — pushing to 10,000 inboxes per message is too expensive. |
| **Cassandra vs MySQL for message history** | MySQL — ACID transactions, relational querying | Cassandra — horizontal writes, partition by chatId + time | **Cassandra** for chat: chat history is an append-only time series, never updated, frequently read by the last 100 messages. Cassandra is purpose-built for this. MySQL would require complex sharding at scale. |
| **Redis Pub/Sub vs Kafka for cross-server delivery** | Redis Pub/Sub — ultra-fast, in-memory, no durability | Kafka — durable, replayable, slightly more latency | **Redis Pub/Sub** for the live-delivery shortcut (microseconds). **Kafka** for durable fan-out to notification services. Use both: Pub/Sub for speed, Kafka for safety. |
| **Single delivery guarantee: at-least-once vs exactly-once** | At least once — duplicates possible, use clientMsgId for dedup | Exactly once — no duplicates, more complex | **At least once + clientMsgId deduplication** is the industry standard. Exactly-once has heavy overhead and is only needed for financial systems. Chat users barely notice rare duplicate messages. |
| **Presence via heartbeat TTL vs connection event** | Connection open/close events update presence instantly | Heartbeat with TTL handles both graceful and ungraceful disconnects | **Heartbeat + TTL**: graceful disconnect fires the `onclose` event (instant offline). Sudden network loss fires nothing — only the TTL expiry catches it 35 seconds later. Both mechanisms together cover all cases. |

---

## Important Cross Questions

**Q1. User A sends a message to User B. Both are on WS Server 1. Does the message stil go through Kafka and Redis Pub/Sub?**
> In a simple implementation: no. If both users are on the same WS Server, the server can deliver locally without Pub/Sub. However, most production systems route through Kafka regardless for consistency (analytics, notifications, audit trail) and to avoid special-casing same-server delivery. The latency difference is negligible compared to the simplification gained.

**Q2. How does the system handle 1 billion simultaneous users? How many WebSocket servers do you need?**
> Each WebSocket server holds ~1 million connections using an event-driven model (Node.js, Netty) consuming ~50GB RAM. 1 billion users / 1 million per server = **1,000 WS servers**. In practice, not all users are active simultaneously. WhatsApp with 2 billion users has far fewer than 2 billion concurrent connections. Provision for your peak concurrent users, not total registered users.

**Q3. User B is offline for 7 days. When they come back online, how do they get all missed messages?**
> On reconnect, the client sends its `lastSeenMessageId` to the server. The server queries Cassandra: `SELECT * FROM messages WHERE chatId = X AND messageId > lastSeenMessageId ORDER BY timestamp ASC LIMIT 100`. This "gap sync" fills in all missed messages. Cassandra's partition key on `chatId` makes this a fast range scan. Messages are kept in Cassandra with configurable retention (WhatsApp: indefinite; Slack: 90 days free, unlimited paid).

**Q4. How do you implement end-to-end encryption (E2E) where even your servers cannot read messages?**
> Each user generates a public/private key pair on their device. The private key never leaves the device. Sender fetches recipient's public key from a key server. Sender encrypts the message locally with recipient's public key. Encrypted ciphertext is stored in Cassandra and delivered via WebSocket. Only the recipient's private key (on their device) can decrypt. Your servers store and route encrypted blobs — they cannot read the content.

**Q5. How would you implement a "message deleted for everyone" feature?**
> Create a `DELETE` event with the `messageId`. Store it in Cassandra as a deletion record. Fan-out this event to all chat members who are online (same WebSocket path as a regular message). Each recipient's client hides or removes the message from UI. Cassandra still physically stores the original message for a grace period (in case of disputes/legal holds), with a `deleted=true` flag. Permanent deletion happens via a background job after the grace period.

**Q6. 50,000 people join a live event group chat. Every message fans out to 50,000 members. How do you handle this?**
> Switch to **fan-out on read** for groups above a threshold. Instead of pushing to 50,000 inboxes, store the message once in a central "group timeline" in Cassandra. Members poll this timeline when they open the chat. For live read receipts and typing indicators: use a single-channel broadcast per group (Redis Pub/Sub on `group-channel-id`). All 50,000 WebSocket connections subscribed to that channel get a push simultaneously without 50,000 individual write operations.
