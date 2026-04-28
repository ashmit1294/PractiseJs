# M9 — Communication Protocols: Summary

> **Module**: M9 | **Topics**: 9 | **Difficulty**: Intermediate–Advanced  
> **Covers**: Network protocols (TCP/UDP), HTTP evolution, REST, RPC, gRPC, GraphQL, Real-time communication

---

## Topics at a Glance

| # | Topic | Core Idea | Key Metric |
|---|---|---|---|
| T01 | Communication Protocols Overview | Protocol layers + pattern selection | Decision tree: gRPC/WS/SSE/REST/queue |
| T02 | HTTP | HTTP/1.1 → HTTP/2 → HTTP/3 evolution | 0 RTT (HTTP/3) vs 3 RTT (HTTP/1.1+TLS1.2) |
| T03 | TCP | Reliable ordered transport via ACKs + congestion control | BDP = Bandwidth × RTT |
| T04 | UDP | Connectionless, unreliable, 8-byte header | 8 bytes (UDP) vs 20-60 bytes (TCP) |
| T05 | REST API Design | 6 constraints, Richardson L2, idempotency | L2 = industry standard |
| T06 | RPC vs REST | Resource-oriented (nouns) vs action-oriented (verbs) | gRPC p50: 1-2ms vs REST: 10-20ms |
| T07 | gRPC | Protobuf + HTTP/2 + 4 streaming modes | 3-10x smaller payload, 5-10x throughput |
| T08 | GraphQL | Client-specified queries, N+1 + DataLoader | 101 queries → 2 queries with DataLoader |
| T09 | Long Polling vs WS vs SSE | Three real-time push techniques | WS: 2-14 bytes overhead; LP: ~800 bytes |

---

## T01 — Communication Protocols Overview

**Core**: Protocols operate in layers. Lower layers (TCP/UDP) handle transport; higher layers (HTTP, REST, gRPC, GraphQL) add structure.

```
APPLICATION:  REST │ gRPC │ GraphQL │ WebSocket │ SSE │ Long Polling
TRANSPORT:    HTTP/1.1 │ HTTP/2 │ HTTP/3
NETWORK:      TCP │ UDP
```

**4 Communication Patterns**:
- **Request-Response** (REST, RPC) — caller blocks
- **Server Streaming** (SSE, gRPC server stream) — one request, many responses
- **Bidirectional** (WebSockets, gRPC bidi) — both send simultaneously
- **Async** (Kafka, SQS) — fire-and-forget, decoupled

**Quick Decision**:
- Bidirectional, low latency → WebSocket
- Server push, auto-reconnect → SSE
- Public API, browser client → REST
- Internal microservices, performance → gRPC
- Background processing, resilience → Message queue

---

## T02 — HTTP Evolution

```
HTTP/1.1  → Text, sequential, 6-8 TCP conn/domain, app-layer HOL blocking
HTTP/2    → Binary frames, multiplexed streams, HPACK, TCP-layer HOL blocking
HTTP/3    → QUIC/UDP, independent streams, 0-RTT repeat, conn migration
```

**HOL Blocking progression**:
- HTTP/1.1 → blocks at application layer (sequential requests)
- HTTP/2 → blocks at TCP layer (one lost packet stalls all streams)
- HTTP/3 → eliminated (per-stream retransmission in QUIC)

**Connection setup cost**:
```
HTTP/1.1 + TLS 1.2 = 3 RTT
HTTP/2   + TLS 1.3 = 2 RTT
HTTP/3   (new)     = 1 RTT
HTTP/3   (repeat)  = 0 RTT
```

**Methods**: GET/DELETE = idempotent + safe; PUT = idempotent; POST = neither  
**Key status codes**: 401 (unauthenticated) vs 403 (unauthorized); 502 (bad gateway) vs 503 (unavailable)

---

## T03 — TCP

```
Three-way handshake:  SYN → SYN-ACK → ACK  (1 RTT overhead)
Four-way teardown:    FIN → ACK → FIN → ACK + TIME-WAIT (2 min)
```

**Congestion Control phases**:
```
Slow Start (cwnd doubles/RTT) → ssthresh → Congestion Avoidance (+1 MSS/RTT)
   3 dup ACKs → Fast Retransmit + Fast Recovery (cwnd/2, resume CA)
   Timeout   → Reset cwnd=1, restart Slow Start
```

**Key formulas**:
- BDP = Bandwidth × RTT (pipe size; receive window must be ≥ BDP)
- Mathis: Throughput ≤ (MSS/RTT) × (1/√loss_rate)

**TCP_NODELAY**: disables Nagle's algorithm — critical for interactive apps (WebSockets, SSH, trading)  
**BBR**: Google's congestion algorithm — measures bottleneck bandwidth + RTT directly instead of inferring from loss

---

## T04 — UDP

```
UDP Header: [Src Port 16] [Dst Port 16] [Length 16] [Checksum 16] = 8 bytes
```

**No**: handshake, ACKs, retransmissions, ordering, congestion control  
**Fragmentation danger**: datagrams > MTU (≈1500B) get fragmented; lose any fragment = lose whole datagram → keep payloads ≤ 1400 bytes

**UDP amplification attacks**: attacker spoofs source IP → server sends large response to victim. Mitigate: rate limiting, BCP38 filtering.

**Building on UDP**: QUIC (HTTP/3) + WebRTC add custom reliability in userspace where needed.

---

## T05 — REST API Design

**6 REST Constraints**: Client-Server, Stateless, Cacheable, Layered, Uniform Interface, Code-on-Demand  
**Stateless = most important for scaling**: any server handles any request, no sticky sessions for REST

**Richardson Maturity Model**:
```
L0: Single endpoint, POST everything (RPC-style)
L1: Individual resource URIs
L2: HTTP verbs + correct status codes  ← Industry standard
L3: HATEOAS (responses include action links) ← Rare
```

**Idempotency**: GET/DELETE/PUT = safe to retry; POST = NOT idempotent → use `Idempotency-Key` header  
**N+1**: `GET /users` (1) + `GET /users/1/orders`×N = N+1 → solve with eager loading, batch endpoints, or GraphQL  
**Versioning strategies**: URI (`/v1/`), Header (`Accept: vnd.api.v2`), Date-based (Stripe's model)

---

## T06 — RPC vs REST

```
REST: Client ──── GET /users/123 ────► Server   (resource-oriented)
RPC:  Client ──── UserSvc.GetUser(123) → Server  (action-oriented)
```

**RPC Lifecycle**: Client call → Client stub marshals → Network → Server stub unmarshals → Server executes → Response

**5 RPC outcomes**: Success / Server error / Timeout (⚠️ unknown if executed!) / Connection failure / Partial failure  
**Timeout = hardest**: you don't know if server ran. Solution: make operations idempotent.

**Performance**:
```
REST (JSON): p50=10-20ms, p99=50-100ms
gRPC(Proto): p50=1-2ms,   p99=5-10ms  ← 5-10x better
```

**Pattern**: REST at boundary (public API) + gRPC inside (microservices). Uber: 1 REST call → 20+ gRPC calls.

---

## T07 — gRPC

**Stack**: `.proto` IDL → `protoc` code gen → stubs → Protobuf binary + HTTP/2 transport

**Protobuf encoding** (tag-length-value):
- `{"id":"abc","name":"Alice","age":30}` = 37 bytes JSON → ~18 bytes Protobuf
- 3-10x smaller payload; 20-100x faster parse

**4 Streaming Modes**:
```
Unary:          req → res          (80% of use cases)
Server stream:  req → res×N        (Netflix recommendations)
Client stream:  req×N → res        (log upload batches)
Bidi stream:    req×N ↔ res×N      (Uber location tracking)
```

**Load balancing problem**: HTTP/2 multiplexes all streams on ONE TCP connection → L4 LBs route all traffic to one server. Fix: L7 proxy (Envoy/Istio) or client-side LB.

**Deadline propagation**: A (100ms budget) → 20ms elapsed → B gets 80ms → 20ms elapsed → C gets 60ms. Auto-cancels on expiry.

**Weaknesses**: No native browser support (needs gRPC-Web proxy), binary (can't curl), L4 LB problem.

---

## T08 — GraphQL

**Single endpoint** (`POST /graphql`). Client specifies exact fields → no over/under-fetching.

**Schema entry points**:
```graphql
type Query      { user(id: ID!): User }           # reads
type Mutation   { createUser(name: String!): User } # writes
type Subscription { postCreated: Post! }           # real-time
```

**Resolver signature**: `(parent, args, context, info)` — 4 arguments always

**N+1 Problem → DataLoader Solution**:
```
Without: 1 query for users + 100 queries for posts = 101 queries
With:    1 query for users + 1 batch query for all posts = 2 queries
```

DataLoader collects all `.load(id)` calls in one event loop tick → fires `WHERE id IN (...)` query.

**Caching problem**: POST to `/graphql` = no HTTP caching. Solutions: persisted queries (GET + hash), Apollo normalized cache (by `__typename:id`).

**Attack surface**: depth bombing, introspection abuse → depth limit (7-10), complexity analysis, rate limit by points not count.

**When NOT to use**: simple CRUD, CDN-heavy, file uploads, external integrations.

---

## T09 — Long Polling vs WebSockets vs SSE

**Quick comparison**:
```
Long Polling: ~800B headers/msg, 50-200ms latency, universal support, no auto-reconnect
WebSockets:   2-14B/msg,         ~1-2ms latency,   IE10+,          no auto-reconnect
SSE:          Low overhead,      ~10ms latency,    no IE,          ✅ built-in reconnect
```

**WebSocket upgrade**: HTTP GET + `Upgrade: websocket` → `101 Switching Protocols` → raw TCP frames  
**SSE format**: `id: N\nevent: name\ndata: {...}\n\n` on a persistent HTTP response stream  
**SSE reconnect**: `EventSource` sends `Last-Event-ID` header on reconnect — server resumes from there

**Scaling both**: sticky sessions (session affinity) required → Redis Pub/Sub for cross-server message delivery

**Decision**:
- Bidirectional → WebSocket
- Server push + auto-reconnect → SSE
- Max compatibility (corporate proxies) → Long Polling

---

## Cross-Topic Connections

```
TCP
 └── HTTP/1.1 (sequential on TCP)
      └── HTTP/2 (multiplexed on TCP; eliminates app-layer HOL)
           ├── REST (architectural style over HTTP)
           ├── gRPC (Protobuf + HTTP/2)
           └── GraphQL (query language; runs over HTTP)
 └── WebSockets (upgrade from HTTP; persistent TCP)
 └── SSE (persistent HTTP response over TCP)

UDP
 └── QUIC (HTTP/3) (reliable streams in userspace on UDP)
      └── HTTP/3 (standard HTTP semantics on QUIC)
```

**Technology chain**: TCP reliability enables HTTP semantics; HTTP provides the upgrade mechanism for WebSockets; gRPC leverages HTTP/2 multiplexing; GraphQL runs as POST over HTTP; REST is HTTP used correctly.

---

## Interview Rapid-Fire

| Question | Answer |
|---|---|
| Why HTTP/3 uses UDP | TCP HOL blocking can't be fixed in kernel space; QUIC implements reliability in userspace per-stream |
| TCP vs UDP in one line | TCP: reliable, ordered, connection-oriented. UDP: connectionless, unreliable, fast |
| REST vs gRPC | REST: resource-oriented, public APIs, JSON, cached. gRPC: action-oriented, internal, binary, streaming |
| GraphQL N+1 fix | DataLoader — batches N individual `.load(id)` calls into one `WHERE id IN (...)` query per event loop tick |
| WebSocket vs SSE | WS: bidirectional, binary, no auto-reconnect. SSE: server→client only, text, auto-reconnect built-in |
| HOL blocking in HTTP/2 | TCP-layer: one lost packet stalls ALL streams. HTTP/3/QUIC fixes this — each stream retransmits independently |
| Slow Start meaning | Start cwnd=1 MSS, double each RTT — starts slow, not grows slowly. Probes network before blasting |
| gRPC LB problem | HTTP/2: all streams on 1 TCP conn. L4 LB sees 1 conn → routes all traffic there. Fix: Envoy L7 or client-side LB |
| REST stateless benefit | Any server handles any request → horizontal scaling without sticky sessions |
| 401 vs 403 | 401: not authenticated (no/bad credentials). 403: authenticated but no permission |
| Richardson L3 | HATEOAS: responses include hypermedia links to available next actions. Rare in production |
| UDP amplification | Attacker spoofs victim IP → server sends large response to victim. Works because UDP has no handshake |
