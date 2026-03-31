# 06 — RPC vs REST

> **Module**: M9 — Communication Protocols  
> **Source**: https://layrs.me/course/hld/09-communication-protocols/rpc  
> **Difficulty**: Intermediate | **Read time**: ~12 min

---

## ELI5

Imagine two ways to order food:

**REST** is like a restaurant menu:
- Every dish has a name and price (resource + representation)
- You pick items by their catalog entry ("I'll have item #42")
- The waiter (HTTP) brings it to you

**RPC** is like calling the chef directly:
- You say "make me a medium-rare steak with truffle fries"
- The chef executes your specific instruction
- You don't browse a catalog — you call a function

Same result (you get food), completely different interaction model.

---

## Analogy

**RPC** is calling a local function — but the function runs on another machine.

```
// Locally calling a function:
const user = getUser(123);

// RPC — same feel, different machine:
const user = await userService.getUser({ id: 123 });
// ↑ Looks local, but actually: serialized → network → deserialized → executed → serialized → network → deserialized
```

REST forces you to think in **resources and representations**. RPC lets you think in **functions and return values**. REST is a design constraint; RPC is a programming model.

---

## Core Concept

**RPC (Remote Procedure Call)** is a mechanism that allows a program to call a function or procedure on a remote server as if it were a local call. The network communication is abstracted away by "stubs."

**How it works in 6 steps**:

```
Client Side                              Server Side
┌─────────────┐                         ┌─────────────┐
│  Client     │  1. Client calls        │  Server     │
│  Code       │─────────────────────────►  Stub       │
└─────────────┘  getUser(123)           └─────────────┘
      │                                       │
      ▼                                       ▼
┌─────────────┐                         ┌─────────────┐
│  Client     │  2. Marshal (serialize) │  Server     │ 5. Unmarshal
│  Stub       │  args to bytes          │  Stub       │  (deserialize)
└─────────────┘                         └─────────────┘
      │                                       │
      ▼                                       ▼
┌─────────────┐  3. Network Transport   ┌─────────────┐
│  Network    │─────────────────────────►  Network    │
│  Layer      │  ◄──────────────────────│  Layer      │ 6. Return result
└─────────────┘  4. Response            └─────────────┘
                                               │
                                               ▼
                                         ┌─────────────┐
                                         │  Actual     │
                                         │  Function   │ ← Actually executes here
                                         └─────────────┘
```

**Stub**: generated code that handles serialization/deserialization. In gRPC, the proto compiler generates stubs in your target language automatically.

---

## RPC vs REST: The Philosophical Difference

| Dimension | REST | RPC |
|---|---|---|
| **Mental model** | Resources (nouns) | Actions (verbs / functions) |
| **URL style** | `/users/123` (noun) | `/getUserById` or `UserService.GetUser` |
| **HTTP methods** | Meaningful (GET/POST/PUT/DELETE) | Often only POST (action in body/method name) |
| **Coupling** | Loose (clients know resource structure) | Tighter (clients know method signatures) |
| **Transport** | Usually HTTP only | HTTP, TCP, HTTP/2, custom sockets |
| **Discoverability** | Predictable URL structure | Requires interface definition (IDL) |
| **Type safety** | No — JSON is schema-less | Strong — IDL defines types at compile time |
| **Code generation** | Manual (OpenAPI → code) | First-class (proto/thrift → code) |
| **Best for** | Public APIs, browser access, CRUD | Internal microservices, low latency, type safety |

---

## RPC Serialization Formats

| Format | Protocol | Size vs JSON | Speed vs JSON | Schema Required? |
|---|---|---|---|---|
| **Protocol Buffers (Protobuf)** | gRPC | 5-10x smaller | 5-10x faster | Yes (`.proto` file) |
| **Thrift** | Apache Thrift | 5-10x smaller | Fast | Yes (`.thrift` file) |
| **MessagePack** | Various | 2-3x smaller | Faster | No (schemaless) |
| **Avro** | Kafka, Hadoop | 2-4x smaller | Fast | Yes (JSON schema) |
| **JSON-RPC** | HTTP | Same as REST | Same as REST | No |
| **XML-RPC** | SOAP | Larger than JSON | Slower | WSDL |
| **JSON** | REST | Baseline | Baseline | No |

---

## RPC Failure Modes

The hardest part of RPC is handling the 5 possible outcomes of any remote call. Unlike local function calls, "exception = something went wrong" is insufficient:

```
Client calls getUser(123)...
│
├── 1. SUCCESS        → Got the user back ✅
├── 2. SERVER ERROR   → Server crashed processing the request ❌
├── 3. TIMEOUT        → Did the server execute? WE DON'T KNOW ⚠️
│                       May have processed and response was lost
│                       May have never started
├── 4. CONN FAILURE   → Network issue before server received request ❌
└── 5. PARTIAL        → Server processed partially, failed at step 3 ⚠️ (most dangerous)
```

**Timeout is the hardest case**: You don't know if the server executed your call. If you retry, you might create a duplicate. If you don't, you might have lost the original. Solution: **idempotent operations + idempotency keys**.

---

## Performance Comparison

| Dimension | REST/HTTP (JSON) | gRPC/HTTP2 (Protobuf) |
|---|---|---|
| **Message size** | 100 bytes JSON | 10-20 bytes Protobuf |
| **Parse time** | Text parsing (slow) | Binary parsing (fast) |
| **Connection overhead** | New TCP per request (HTTP/1.1) | Multiplexed HTTP/2 |
| **Headers** | Repeated on every request | HPACK compressed |
| **Typical p50 latency** | 50ms | 5-10ms |
| **Throughput gain** | Baseline | 5-10x |

---

## REST at the Boundary, gRPC Inside

Real-world pattern at companies like Uber, Netflix, Google:

```
Mobile/Web Browser
       │
       │ REST/HTTP (JSON)
       ▼
  API Gateway  ── Validates, authenticates, routes
       │
       │ gRPC (Protobuf)
   ┌───┴──────────────────┐
   ▼           ▼          ▼
User Service  Order Service  Payment Service
   │                │
   │ gRPC (Protobuf) │ gRPC (Protobuf)
   ▼                ▼
Auth Service    Inventory Service
```

**Why this pattern**:
- External (REST): browser compatibility, no Protobuf library needed, CDN-friendly, easy debugging with curl
- Internal (gRPC): performance, type safety catches breaking changes at compile time, code generation means less boilerplate

**Uber example**: 1 REST call from mobile → triggers 20+ internal gRPC calls across microservices.

---

## RPC Versioning

**Protobuf field numbers** — the versioning system baked into gRPC:

```protobuf
// v1
message User {
  string name = 1;    // field tag 1
  int32 age = 2;      // field tag 2
}

// v2 — added field (backward compatible — old clients ignore it)
message User {
  string name = 1;     // same tag (NEVER change)
  int32 age = 2;       // same tag (NEVER change)
  string email = 3;    // NEW — old clients skip tag 3
}

// NEVER DO THIS (breaks backward compatibility):
message User {
  string email = 1;    // ❌ Reused tag 1 — old clients parse email as name
  string name = 2;     // ❌ Type mismatch with old data
}
```

Rules:
- ✅ Add new optional fields with new tag numbers
- ✅ Add new message types
- ❌ Never remove or rename fields with existing clients
- ❌ Never reuse field tag numbers
- ❌ Never change a field type for a tag number

---

## MERN Dev Notes

```js
// gRPC in Node.js (using @grpc/grpc-js)
// user.proto
syntax = "proto3";
service UserService {
  rpc GetUser (GetUserRequest) returns (User) {}
  rpc ListUsers (ListUsersRequest) returns (stream User) {}
}
message GetUserRequest { string id = 1; }
message User { string id = 1; string name = 2; string email = 3; }
```

```js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const packageDefinition = protoLoader.loadSync('user.proto');
const userProto = grpc.loadPackageDefinition(packageDefinition);

// gRPC Client
const client = new userProto.UserService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// Looks like a local function call
client.getUser({ id: '123' }, (error, user) => {
  if (error) {
    // Could be: UNAVAILABLE, DEADLINE_EXCEEDED, NOT_FOUND, etc.
    console.error('gRPC error:', error.code, error.message);
    return;
  }
  console.log('User:', user.name);
});

// With deadline (timeout)
const deadline = new Date(Date.now() + 5000); // 5 second deadline
client.getUser({ id: '123' }, { deadline }, (error, user) => {
  // ...
});
```

---

## Real-World Examples

**Google (invented gRPC)**
- All internal services communicate via gRPC (protocol buffers since 2001 — "Stubby").
- Open-sourced as gRPC in 2015. Powers all Google products internally.
- Handles billions of RPC calls per second across Google's infrastructure.

**Uber**
- FUSION: migration from microservices over REST to gRPC internally.
- 1 rider request from mobile app → ~20 internal gRPC calls (location, pricing, dispatch, driver, payments).
- Reduced p99 latency from >500ms to <100ms in some services after gRPC migration.

**Netflix**
- Open Connect CDN management via gRPC.
- Recommendation engine calls to ML services via gRPC (binary serialization for model features).

---

## Interview Cheat Sheet

**Q: What is the core difference between REST and RPC philosophically?**
A: REST thinks in resources (nouns) and representations — you identify resources by URI and manipulate them with HTTP verbs. The interface constraint forces predictable structure. RPC thinks in actions (function calls) — the remote service exposes an interface of callable functions, and the client calls them. REST is a design constraint that leads to discoverable, cacheable APIs. RPC is a programming model that makes remote calls feel local, often with better performance via binary protocols and code generation.

**Q: When should you use gRPC instead of REST?**
A: gRPC for: (1) internal microservices where you control both client and server; (2) performance-critical paths (5-10x better throughput, 1-2ms vs 50ms latency); (3) strong typing via Protobuf to catch breaking changes at compile time; (4) streaming (server/client/bidirectional) built-in. REST for: (1) public APIs requiring browser support; (2) loose coupling (clients don't need stub libraries); (3) HTTP caching; (4) simple CRUD. Most mature companies use REST at the public boundary, gRPC internally.

**Q: What are the 5 RPC failure modes and why does timeout matter most?**
A: (1) Success. (2) Server error — server executed and returned an error. (3) Timeout — unknown if server executed; most dangerous case for non-idempotent operations. (4) Connection failure — network issue before server received request. (5) Partial failure — server executed partially. Timeout is trickiest: retry risks duplicate execution; not retrying risks lost data. Solution: make operations idempotent using idempotency keys — safe to retry because repeating has no additional side effects.

**Q: How does Protobuf versioning work?**
A: Protobuf uses field numbers (tags) for serialization, not field names. Binary encoding stores `(field_number, value)` pairs. Adding a new field with a new tag number is backward compatible — old clients decode only fields they know and skip unknown tags. The rules: never remove used field numbers, never reuse field numbers for different fields, never change a field's type. Add new fields with new numbers and mark them `optional`. This enables rolling deployments where old and new versions of servers/clients coexist.

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **RPC (Remote Procedure Call)** | Programming model where a client calls a function that executes on a remote server |
| **Stub** | Generated code on client and server that handles serialization/deserialization of RPC arguments |
| **Marshaling / Serialization** | Converting data structures to bytes for network transmission (e.g. struct → Protobuf bytes) |
| **Unmarshaling / Deserialization** | Converting bytes back to data structures on the receiver side |
| **IDL (Interface Definition Language)** | Language for defining function signatures shared between client and server (`proto`, `.thrift`) |
| **Protocol Buffers (Protobuf)** | Google's binary serialization format and IDL for gRPC. 5-10x smaller/faster than JSON |
| **Code Generation** | Compiler produces client/server stub code from IDL. `protoc` generates code in 11+ languages |
| **Field Tag / Tag Number** | Integer ID assigned to each field in Protobuf. Used instead of field names in binary encoding |
| **Backward Compatibility** | Old clients can still communicate with new servers (or vice versa) |
| **Forward Compatibility** | New clients can communicate with old servers (via ignoring unknown fields) |
| **Partial Failure** | Server processes some of the work but fails partway through — most dangerous RPC failure mode |
| **Idempotent Operation** | Operation that is safe to retry because repeating it produces the same result |
| **gRPC** | Google's RPC framework: Protobuf + HTTP/2. Supports streaming. Open-sourced 2015 |
| **Thrift** | Apache RPC framework (used at Facebook/Meta). Similar concept to gRPC with its own IDL |
| **JSON-RPC** | Lightweight RPC protocol using JSON; no performance advantage over REST, simpler than gRPC |
| **Tight Coupling** | Client must know exact function signatures and types of the server — changes require coordinated updates |
| **Loose Coupling** | Client knows only the resource structure (REST) — server implementation can change freely |
| **API Gateway** | Entry point for all client requests. Translates REST → gRPC for internal service calls |
| **BFF (Backend for Frontend)** | Dedicated API layer per client type; often translates external REST calls to internal gRPC calls |
