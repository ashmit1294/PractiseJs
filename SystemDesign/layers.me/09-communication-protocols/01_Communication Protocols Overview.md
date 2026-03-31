# 01 — Communication Protocols Overview

> **Module**: M9 — Communication Protocols  
> **Source**: https://layrs.me/course/hld/09-communication-protocols/communication-overview  
> **Difficulty**: Intermediate | **Read time**: ~15 min

---

## ELI5

Imagine you and your friends send messages to each other. Some of you write letters (slow but detailed), some call on the phone (fast back-and-forth), and some use walkie-talkies (one talks, others listen). Communication protocols are just the **agreed rules** that tell systems: "How do we talk? How fast? Who speaks first? What happens if a message gets lost?"

---

## Analogy

A **restaurant** uses different communication protocols:
- **Waiter → kitchen** via written ticket (request-response, like REST)
- **Kitchen → waiter** via bell (server push, like SSE)
- **Chef ↔ sous chef** via constant back-and-forth verbal (bidirectional, like WebSockets)
- **Manager → all staff** announcements via one message to many (pub/sub, like Kafka)

The same restaurant, four different communication patterns — chosen based on what makes sense for each situation.

---

## Core Concept

Communication protocols define **how distributed systems exchange data**. They operate in a layered hierarchy:

```
┌─────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                       │
│   REST  │  RPC  │  gRPC  │  GraphQL  │  WebSocket  │ SSE │
├─────────────────────────────────────────────────────────┤
│                  TRANSPORT LAYER                         │
│           HTTP/1.1  │  HTTP/2  │  HTTP/3 (QUIC)         │
├─────────────────────────────────────────────────────────┤
│                  NETWORK LAYER                           │
│                  TCP  │  UDP                             │
├─────────────────────────────────────────────────────────┤
│                  IP LAYER                                │
│                  Packet Routing                          │
└─────────────────────────────────────────────────────────┘
```

Each layer solves problems for the layer above:
- **TCP/UDP** — handle reliable or fast transport of bytes
- **HTTP/1.1, HTTP/2, HTTP/3** — provide request/response semantics
- **Application protocols** — structure messages and define API patterns

---

## Communication Patterns

### 1. Request-Response (Synchronous)
```
Client ──── Request ────► Server
Client ◄─── Response ─── Server
```
- Caller **blocks** until it gets a response
- Simple to reason about, but **tight coupling** — if server is slow, caller is slow
- Used by: REST, RPC, database queries

### 2. Server Streaming
```
Client ──── Request ────► Server
Client ◄─── Response 1 ─ Server
Client ◄─── Response 2 ─ Server
Client ◄─── Response N ─ Server
```
- One request, multiple responses over time
- Used by: Server-Sent Events (SSE), gRPC server streaming

### 3. Bidirectional Streaming
```
Client ──── Message 1 ──► Server
Client ◄─── Message A ── Server
Client ──── Message 2 ──► Server
Client ◄─── Message B ── Server
```
- Both sides can send at any time, simultaneously
- Used by: WebSockets, gRPC bidirectional streaming

### 4. Asynchronous (Fire-and-Forget)
```
Publisher ──── Event ────► Message Queue ──── Event ────► Subscriber A
                                          └─── Event ────► Subscriber B
```
- Sender publishes and **continues immediately** — receiver processes later
- Decouples services, improves resilience
- Used by: Kafka, RabbitMQ, SQS

---

## Synchronous vs Asynchronous

| Dimension | Synchronous (REST, gRPC) | Asynchronous (Queues, Events) |
|---|---|---|
| **Coupling** | Tight — caller waits on callee | Loose — sender doesn't wait |
| **Failure propagation** | Failure cascades up the call chain | Receiver can be down temporarily |
| **Debugging** | Simple — one stack trace | Hard — no stack trace across services |
| **Latency** | Adds up through call chains | Decoupled; latency is acceptable |
| **Error handling** | Immediate — caller gets error | Complex — dead letter queues, retries |
| **Use when** | Immediate response needed (payments, user requests) | Background processing, analytics, cross-service events |

> **Key insight**: Most systems use **both** — synchronous for user-facing requests where immediate feedback matters, asynchronous for background work, analytics, and cross-service notifications.

---

## Protocol Selection Decision Tree

```
Need API communication?
│
├── Latency < 100ms required?
│   ├── Yes → Need bidirectional?
│   │         ├── Yes → WebSockets
│   │         └── No  → Server push only?
│   │                   ├── Yes → SSE
│   │                   └── No  → gRPC (binary, HTTP/2)
│   └── No  → Client type?
│             ├── Browser / Mobile → REST/HTTP
│             ├── Internal microservice → gRPC (performance)
│             └── Loose coupling needed → Message Queue (Kafka/SQS)
│
└── Guaranteed delivery required?
    ├── Yes → TCP-based (REST, gRPC, message queues)
    └── No  → UDP-based (video streaming, gaming, telemetry)
```

---

## Protocol Comparison Table

| Protocol | Layer | Transport | Latency | Direction | Best For |
|---|---|---|---|---|---|
| **REST** | Application | HTTP + TCP | Medium | Request-Response | Public APIs, CRUD |
| **gRPC** | Application | HTTP/2 + TCP | Low | Request + Streaming | Internal microservices |
| **GraphQL** | Application | HTTP + TCP | Medium | Request-Response | Complex queries, mobile |
| **WebSockets** | Application | TCP (upgraded) | Very Low | Bidirectional | Chat, gaming, collaboration |
| **SSE** | Application | HTTP + TCP | Low | Server → Client | Notifications, live feeds |
| **Long Polling** | Application | HTTP + TCP | High | Simulated push | Legacy compatibility |
| **TCP** | Transport | IP | Medium | Full-duplex | Web, DB, file transfer |
| **UDP** | Transport | IP | Very Low | Datagram | Video, gaming, DNS |

---

## Real-World Protocol Composition

Netflix, Uber, Slack — none uses a single protocol. They compose:

```
┌─────────────────────────────────────────────────────────────────┐
│                     REAL-WORLD SYSTEM                           │
│                                                                 │
│  Web Browser ──── REST/HTTP ────► API Gateway                  │
│  Mobile App  ──── REST/HTTP ────► API Gateway                  │
│  Mobile App  ──── WebSocket ────► WebSocket Gateway (real-time)│
│                                         │                       │
│              ┌──────────────────────────┤                       │
│              ▼          ▼               ▼                       │
│         Auth Service  User Service  Order Service               │
│              └──── gRPC ────────────── ▲                        │
│                                        │                        │
│                              Message Queue (Kafka)              │
│                                        │                        │
│                              Background Worker                  │
└─────────────────────────────────────────────────────────────────┘
```

| Where | Protocol | Why |
|---|---|---|
| External clients → API Gateway | REST/HTTP | Simplicity, browser compatibility |
| Real-time updates | WebSocket | Bidirectional, low latency |
| Internal services | gRPC | Performance, type safety |
| Background/async | Kafka/SQS | Decoupling, resilience |

---

## MERN Dev Notes

As a MERN developer you already use several of these:

| What you've used | Protocol |
|---|---|
| `fetch('/api/users')`, Axios, Express routes | REST over HTTP |
| `socket.io` | WebSockets (with fallback to long polling) |
| `EventSource` in browser | SSE |
| Apollo Client (`useQuery`, `useMutation`) | GraphQL over HTTP |
| Redis Pub/Sub in Node.js | Async messaging |

**gRPC in Node.js** — use `@grpc/grpc-js` + `@grpc/proto-loader`. Not common in MERN but used for internal services where you control both ends (e.g., Express API → Node.js microservice).

**mongoose** connections are TCP — so if your DB is in another service, it's essentially request-response synchronous.

---

## Red Flags to Avoid in Interviews

1. **"gRPC is always better than REST"** — wrong; REST is better for public APIs, browser compatibility, and HTTP caching
2. **"TCP is always slower than UDP"** — wrong; for bulk transfers TCP often achieves better throughput; UDP saves latency on small messages
3. **"WebSockets are the only way for real-time"** — SSE is simpler for unidirectional push; Long Polling works in restrictive networks
4. **Choosing one protocol for everything** — production systems compose multiple protocols deliberately
5. **Ignoring operational complexity** — gRPC requires binary debugging tools, WebSockets need sticky sessions

---

## Interview Cheat Sheet

**Q: What's the difference between synchronous and asynchronous communication?**
A: Synchronous (REST, gRPC) means the caller blocks waiting for a response — simple but tight coupling, failures propagate up. Asynchronous (message queues, events) means fire-and-forget — the sender continues, receiver processes later. Async improves resilience and decouples services but adds complexity in error handling, ordering, and debugging. Most systems use both: sync for user-facing requests, async for background processing.

**Q: How do you choose between REST and gRPC?**
A: REST for public APIs (browser compatibility, HTTP caching, developer familiarity, loose coupling). gRPC for internal microservices (5-10x better performance via binary Protobuf + HTTP/2 multiplexing, type safety catches API breaks at compile time). Netflix/Uber/Google pattern: gRPC inside, REST at the boundary (API gateway translates).

**Q: What is protocol layering and why does it matter?**
A: Protocols compose in layers — TCP/UDP handle transport, HTTP adds request-response semantics, REST/gRPC/GraphQL add application structure. Understanding the stack means knowing where problems occur: TCP head-of-line blocking affects HTTP/2 (not HTTP/3), WebSocket upgrades HTTP, gRPC builds on HTTP/2. Each layer's trade-offs flow up.

**Q: How would you implement real-time updates in a web app?**
A: Bidirectional (chat, collaboration) → WebSockets. Server push only (notifications, dashboards) → SSE (simpler, auto-reconnects). Needs maximum compatibility → Long Polling. On the backend, buffer events in Redis Pub/Sub and use sticky sessions on the load balancer.

**Q: How do you ensure reliable message delivery in a distributed system?**
A: At network layer, TCP for guaranteed delivery. At application layer: idempotency (same message twice = same result), at-least-once delivery with ACKs, dead letter queues for failed messages, transactional outbox pattern for critical ops (write message to DB in same transaction as business logic, then publish to queue).

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Protocol** | A set of rules governing how systems exchange data |
| **Synchronous** | Caller blocks and waits for the response before continuing |
| **Asynchronous** | Sender continues after publishing; receiver processes independently |
| **Request-Response** | Client sends request, server sends back one response |
| **Server Streaming** | One client request triggers multiple server responses over time |
| **Bidirectional Streaming** | Both client and server can send messages at any time |
| **TCP (Transmission Control Protocol)** | Reliable, ordered, connection-oriented transport. Guarantees delivery via ACKs and retransmissions |
| **UDP (User Datagram Protocol)** | Connectionless, unreliable transport. Faster; no handshake, no retransmissions |
| **HTTP/1.1** | Text-based request-response protocol. Sequential; head-of-line blocking |
| **HTTP/2** | Binary framing + multiplexing over one TCP connection. Eliminates app-layer HOL blocking |
| **HTTP/3 / QUIC** | HTTP/2 semantics over UDP-based QUIC; eliminates all head-of-line blocking, 0-1 RTT setup |
| **REST** | Architectural style for resource-oriented APIs over HTTP |
| **gRPC** | High-performance RPC framework using Protobuf + HTTP/2 |
| **GraphQL** | Query language for APIs; client specifies exactly what data it needs |
| **WebSockets** | Persistent bidirectional TCP connection, upgraded from HTTP |
| **SSE (Server-Sent Events)** | Unidirectional server-to-client HTTP stream; built-in reconnection |
| **Long Polling** | Client holds HTTP request open; server responds when data is ready, then client re-requests |
| **Pub/Sub** | Publisher sends events to a topic; multiple subscribers consume independently |
| **Dead Letter Queue (DLQ)** | Queue where unprocessable messages are sent after repeated failures — for inspection and retry |
| **Idempotency** | Processing the same message/request multiple times produces the same result as processing it once |
| **Head-of-Line (HOL) Blocking** | When one slow/lost message blocks all subsequent messages in a queue or connection |
| **Marshaling / Serialization** | Converting data structures to a format for network transmission (JSON, Protobuf, XML) |
| **Multiplexing** | Multiple independent request/response streams sharing a single TCP connection (HTTP/2) |
