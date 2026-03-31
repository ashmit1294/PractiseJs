# 07 — gRPC

> **Module**: M9 — Communication Protocols  
> **Source**: https://layrs.me/course/hld/09-communication-protocols/grpc  
> **Difficulty**: Advanced | **Read time**: ~15 min

---

## ELI5

Imagine you need to talk to a co-worker in Japan. Normal REST is sending English emails (text, easy to read but slow and large). gRPC is like using a secret codebook — you compress everything into super-short codes. The messages are tiny, travel fast, and can't be read without the codebook. Plus, you can have multiple simultaneous conversations in one phone call.

---

## Analogy

**gRPC** is like a **specialized internal telephone network** at a large company:
- Everyone uses standard phones (HTTP/2)
- Conversations use a private shorthand language only company employees know (Protocol Buffers)
- Multiple conversations can happen on one call simultaneously (multiplexing)
- The phone directory (`.proto` file) defines exactly who can be called and what they understand
- Outside visitors still use regular email/postal mail (REST API gateway)

---

## Core Concept

gRPC (Google Remote Procedure Call) is an open-source, high-performance RPC framework that uses:
1. **Protocol Buffers** — binary serialization format + Interface Definition Language (IDL)
2. **HTTP/2** — transport layer for multiplexing, flow control, header compression
3. **Code generation** — compile `.proto` file → client/server stubs in 11+ languages

**Original "Stubby"**: Google's internal RPC system since 2001 handling 10 billion calls/second. Open-sourced as gRPC in 2015.

---

## Protocol Buffers Deep Dive

### Defining a Service
```protobuf
syntax = "proto3";
package users;

// The service definition — what can be called
service UserService {
  rpc GetUser (GetUserRequest) returns (User) {}
  rpc ListUsers (ListUsersRequest) returns (stream User) {}
  rpc UpdateUser (stream UserUpdate) returns (UpdateResult) {}
  rpc Chat (stream Message) returns (stream Message) {}
}

// Message definitions — the data shapes
message GetUserRequest {
  string id = 1;       // field number = 1
}

message User {
  string id = 1;
  string name = 2;
  string email = 3;
  int32 age = 4;
  repeated string tags = 5;  // array
  Address address = 6;       // nested message
  int64 created_at = 7;      // Unix timestamp
}

message Address {
  string street = 1;
  string city = 2;
  string country = 3;
}
```

### Binary Encoding (Tag-Length-Value)
```
JSON:  {"id": "abc", "name": "Alice", "age": 30}
       = 37 bytes, text parsing required

Protobuf binary:
  Field 1 (id):   0A 03 61 62 63   → tag=1, len=3, "abc"
  Field 2 (name): 12 05 41 6C 69 63 65 → tag=2, len=5, "Alice"
  Field 4 (age):  20 1E              → tag=4, varint 30
  = ~18 bytes, binary parsing (much faster)
```

> **Varint encoding**: integers compressed to 1-5 bytes based on magnitude. Values 0-127 fit in 1 byte.

### Why Much Faster
- No field name transmission (just tag number)
- Fixed binary format → no regex/parsing
- Varint for integers → compact representation
- No quotes, commas, braces overhead
- Result: **3-10x smaller** payload, **20-100x faster** serialization

---

## Four Streaming Modes

gRPC supports 4 communication patterns in a single framework:

### 1. Unary RPC (80% of use cases)
```
Client ──── Single Request ────► Server
Client ◄─── Single Response ─── Server
```
```protobuf
rpc GetUser (GetUserRequest) returns (User) {}
```
```js
// Node.js usage
client.getUser({ id: '123' }, (err, user) => {
  console.log(user.name);
});
```

### 2. Server Streaming
```
Client ──── Single Request ────► Server
Client ◄─── Response 1 ──────── Server
Client ◄─── Response 2 ──────── Server
Client ◄─── Response N ──────── Server (stream closes)
```
```protobuf
rpc ListRecommendations (UserId) returns (stream Movie) {}
```
```js
const stream = client.listRecommendations({ userId: '123' });
stream.on('data', (movie) => console.log(movie.title));
stream.on('end', () => console.log('Done'));
```
**Use case**: Netflix sending movie recommendations progressively, search results as they're found.

### 3. Client Streaming
```
Client ──── Request 1 ──────────► Server
Client ──── Request 2 ──────────► Server
Client ──── Request N ──────────► Server (stream closes)
Client ◄─── Single Response ─── Server
```
```protobuf
rpc UploadLogs (stream LogEntry) returns (UploadResult) {}
```
```js
const call = client.uploadLogs((err, result) => {
  console.log(`Uploaded: ${result.count} logs`);
});
call.write({ level: 'ERROR', message: '...' });
call.write({ level: 'INFO', message: '...' });
call.end();
```
**Use case**: Google Cloud Logging batching log entries, uploading large files in chunks.

### 4. Bidirectional Streaming
```
Client ──── Location Update 1 ──► Server
Client ◄─── Driver Match ─────── Server
Client ──── Location Update 2 ──► Server
Client ◄─── ETA Update ────────── Server
```
```protobuf
rpc LocationTracking (stream Location) returns (stream DriverUpdate) {}
```
```js
const call = client.locationTracking();
call.on('data', (update) => console.log('Driver ETA:', update.eta));
call.write({ lat: 37.7749, lng: -122.4194 });
// Both sides can send at any time
```
**Use case**: Uber dispatch (driver location → server, server sends matches back), multiplayer gaming.

---

## ASCII: gRPC Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        gRPC STACK                           │
├─────────────────────────────────────────────────────────────┤
│  .proto file  → protoc compiler → Generated Stubs           │
│  (IDL)          (code gen)        (client + server code)    │
├─────────────────────────────────────────────────────────────┤
│  Application Layer:  Method dispatch, deadline propagation  │
├─────────────────────────────────────────────────────────────┤
│  gRPC Core:   Serialization (Protobuf), compression, auth   │
├─────────────────────────────────────────────────────────────┤
│  HTTP/2:      Multiplexing, flow control, HPACK compression │
├─────────────────────────────────────────────────────────────┤
│  TLS:         Encryption (mandatory in production)          │
├─────────────────────────────────────────────────────────────┤
│  TCP:         Reliable transport                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Load Balancing Problem

gRPC's biggest operational challenge:

```
Traditional L4 Load Balancer:
                                 ┌─── Server A (100% of traffic)
Client ──── 1 TCP connection ───►│LB
                                 └─── Server B (0% of traffic)

(HTTP/2 multiplexes all streams on ONE persistent TCP connection
 → all gRPC calls go to whichever server the LB assigned initially)
```

**Solution Options**:

| Approach | How | Used By |
|---|---|---|
| **L7 Proxy (Envoy/Nginx)** | Proxy understands HTTP/2 frames; load balances individual streams | Service mesh (Istio, Linkerd) |
| **Client-side LB** | Client has service registry (Consul/etcd); picks a healthy server per call | Netflix Ribbon pattern |
| **lookaside LB (gRPC's own)** | Separate LB process; client queries it for server address before each call | Google internal |

Most Kubernetes deployments use **Envoy** sidecar proxy (Istio service mesh) for gRPC load balancing.

---

## Deadline Propagation

One of gRPC's most powerful features: deadlines cascade through the call chain automatically.

```
client.getUser({ id: '123' }, { deadline: Date.now() + 100 })
  │  100ms total budget
  │
  ▼
User Service (receives: 80ms remaining after 20ms elapsed)
  │
  ▼ calls upstream
Auth Service (receives: 60ms remaining after 20ms elapsed)
  │
  ▼ calls upstream
Database (receives: 40ms remaining after 20ms elapsed)
  │
  ▼
 [if query takes > 40ms, gRPC auto-cancels — cascades up]
```

If the database is too slow, the entire call chain is cancelled automatically. No orphaned threads waiting forever. This prevents cascading slowdowns.

---

## Error Codes

gRPC uses 16 canonical status codes instead of HTTP status codes:

| Code | Name | Meaning |
|---|---|---|
| 0 | OK | Success |
| 1 | CANCELLED | Client cancelled the RPC |
| 2 | UNKNOWN | Unknown error |
| 3 | INVALID_ARGUMENT | Client provided invalid argument |
| 4 | DEADLINE_EXCEEDED | Deadline expired before completion |
| 5 | NOT_FOUND | Resource not found |
| 7 | PERMISSION_DENIED | Authenticated but no permission |
| 8 | RESOURCE_EXHAUSTED | Quota exhausted, rate limited |
| 12 | UNIMPLEMENTED | Method not implemented on server |
| 13 | INTERNAL | Internal server error |
| 14 | UNAVAILABLE | Server unavailable, safe to retry |
| 16 | UNAUTHENTICATED | Missing or invalid authentication |

---

## gRPC Weaknesses

| Weakness | Detail | Workaround |
|---|---|---|
| **Poor browser support** | Browsers can't use HTTP/2 trailers (required by gRPC) | gRPC-Web (proxy that translates) |
| **Binary → hard to debug** | Can't curl a gRPC endpoint and read output | `grpcurl` CLI, BloomRPC/Postman for gRPC |
| **L4 LB problem** | All streams on one TCP connection → LBs see one connection | Envoy/Istio, client-side LB |
| **Tighter coupling** | Both sides need `.proto` file and regenerate stubs on changes | Buf.build schema registry |
| **HTTP/3 not yet** | gRPC still uses HTTP/2 (TCP); gRPC over QUIC is in progress | Wait for grpc-over-http3 |
| **Streaming complexity** | Bidirectional streaming harder to implement and debug | Use unary unless streaming gives clear benefit |

---

## Performance Numbers

| Metric | REST/HTTP (JSON) | gRPC/HTTP2 (Protobuf) |
|---|---|---|
| **p50 latency** | 10-20ms | 1-2ms |
| **p99 latency** | 50-100ms | 5-10ms |
| **Throughput** | Baseline | 5-10x |
| **Payload size** | Baseline | 3-10x smaller |
| **CPU (serialization)** | Baseline | ~5x less CPU |

---

## MERN Dev Notes

```js
// Full gRPC server in Node.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = './user.proto';
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const proto = grpc.loadPackageDefinition(packageDef).users;

// Implement service methods
const userServiceImpl = {
  getUser: (call, callback) => {
    const { id } = call.request;
    const user = db.findUser(id);
    if (!user) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: `User ${id} not found`
      });
    }
    callback(null, user);
  },
  
  listUsers: (call) => {
    // Server streaming
    db.getAllUsers().forEach(user => call.write(user));
    call.end();
  }
};

// Start server
const server = new grpc.Server();
server.addService(proto.UserService.service, userServiceImpl);
server.bindAsync('0.0.0.0:50051',
  grpc.ServerCredentials.createInsecure(),
  () => server.start()
);
```

```js
// gRPC client with interceptors (middleware)
const { credentials, Metadata } = require('@grpc/grpc-js');

const meta = new Metadata();
meta.set('authorization', `Bearer ${token}`);

// With deadline
const deadline = new Date(Date.now() + 5000);  // 5s deadline
client.getUser({ id: '123' }, meta, { deadline }, (err, user) => {
  if (err?.code === grpc.status.DEADLINE_EXCEEDED) {
    console.error('Request timed out');
  }
});
```

---

## Real-World Examples

**Google**
- Internal: all Google services communicate via protocol buffers + HTTP/2.
- External: Cloud APIs (BigQuery, Pub/Sub, Spanner) expose gRPC APIs alongside REST equivalents.
- Firebase Realtime Database uses a custom protocol; Firebase Admin SDK uses gRPC.

**Netflix**
- Migrated internal service communication to gRPC for performance.
- Recommendation engine: feature vectors for ML models sent via Protobuf (3-10x smaller than JSON).
- Uses gRPC server streaming for pushing content manifests.

**Uber**
- Migrated from microservices-over-HTTP to gRPC across core services (dispatch, matching, pricing).
- Critical path: rider request → 20+ gRPC calls, total target <100ms.
- Uses gRPC bidirectional streaming for real-time driver location tracking.

---

## Interview Cheat Sheet

**Q: What is gRPC and what are its core advantages over REST?**
A: gRPC is Google's open-source RPC framework combining Protocol Buffers (binary serialization) with HTTP/2 (multiplexed transport). Advantages: (1) 5-10x better performance — Protobuf 3-10x smaller and 20-100x faster to parse than JSON; (2) Strong typing via `.proto` IDL — API breaking changes caught at compile time; (3) Code generation in 11+ languages from one `.proto` file; (4) Built-in streaming (unary, server, client, bidirectional); (5) Deadline propagation — timeouts cascade automatically through service chains; (6) 16 semantic error codes vs HTTP's broad 5xx.

**Q: Explain the four gRPC streaming modes with use cases.**
A: Unary: single request → single response, 80% of RPCs (GetUser, CreateOrder). Server streaming: one request → multiple responses (Netflix recommendations, database cursor). Client streaming: multiple requests → one response (uploading log batches, sensor data aggregation). Bidirectional: both sides stream simultaneously (Uber driver location tracking ↔ dispatch matches, real-time chat, collaborative editing). Each mode maps to a real-world pattern; bidirectional is most complex but sometimes the only right choice.

**Q: What is gRPC's load balancing problem and how is it solved?**
A: HTTP/2 multiplexes all gRPC streams over one persistent TCP connection per client-server pair. Traditional L4 load balancers operate on TCP connections — they assign one connection to one backend server, so all gRPC traffic from a client goes to the same server, defeating load balancing. Solutions: (1) L7 proxy like Envoy (used in Istio service mesh) — understands HTTP/2 frames and balances individual streams; (2) Client-side load balancing — client queries a service registry (Consul, etcd) and picks a healthy server for each call; (3) Headless Kubernetes services expose all pod IPs so the gRPC client can round-robin.

**Q: How does deadline propagation work in gRPC?**
A: When a client sets a deadline on a gRPC call (e.g. 100ms), that deadline is propagated as a gRPC header to the server. The server's runtime enforces the remaining deadline on responding. If that server calls upstream services, it calculates remaining time (100ms - elapsed) and passes that as the deadline. If any link in the chain exceeds the deadline, gRPC automatically cancels the call and propagates DEADLINE_EXCEEDED upstream. This prevents unbounded waiting and resource leaks across a service chain that a simple timeout on the original call wouldn't achieve.

**Q: Why does gRPC have poor browser support and how is it addressed?**
A: Browsers can't send HTTP/2 trailers — gRPC uses HTTP/2 trailers to deliver the final status code after the response body. The Fetch API and XMLHttpRequest don't expose trailer headers. Solution: gRPC-Web — a proxy (e.g. Envoy) that translates between HTTP/1.1 (what browsers send) and gRPC's HTTP/2 framing. gRPC-Web embeds trailer data in the response body as an encoded message. Alternatively, connect-rpc (from Buf) is a protocol compatible with both gRPC and native browser HTTP.

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **gRPC** | Google's open-source RPC framework: Protocol Buffers + HTTP/2 + code generation |
| **Protocol Buffers (Protobuf)** | Binary serialization format and IDL. 3-10x smaller than JSON; 20-100x faster to parse |
| **`.proto` file** | Interface definition file: defines message types and RPC service methods |
| **protoc** | Protocol Buffer compiler: generates client/server stub code from `.proto` files |
| **Stub** | Generated code that handles marshaling/unmarshaling, hiding network from application code |
| **Tag Number / Field Number** | Integer identifying a field in Protobuf binary encoding. Stable identifier across versions |
| **Varint** | Protobuf integer encoding: small integers use fewer bytes (0-127 = 1 byte) |
| **Tag-Length-Value (TLV)** | Protobuf encoding scheme: each field encoded as (tag, length, value) |
| **Unary RPC** | Single request, single response — the simplest gRPC pattern |
| **Server Streaming** | Single request triggers multiple response messages from server |
| **Client Streaming** | Client sends multiple messages, server responds once when stream ends |
| **Bidirectional Streaming** | Both client and server send independent message streams |
| **HTTP/2 Multiplexing** | Multiple independent HTTP/2 streams on one TCP connection |
| **HPACK** | HTTP/2 header compression used by gRPC to reduce header overhead |
| **Deadline** | Maximum time allowed for an RPC call to complete. Propagated across service chains |
| **Deadline Propagation** | gRPC automatically passes remaining deadline budget to upstream service calls |
| **L4 Load Balancer** | Routes based on IP/TCP connections. Doesn't understand HTTP/2 frames |
| **L7 Load Balancer** | Routes based on application layer (HTTP/2 streams, gRPC methods) |
| **Envoy** | High-performance L7 proxy. Standard for gRPC load balancing in Kubernetes / Istio |
| **Istio** | Service mesh for Kubernetes. Uses Envoy sidecars to handle gRPC LB, mTLS, observability |
| **gRPC-Web** | Protocol that enables gRPC from browsers by encoding trailers in the response body |
| **grpcurl** | CLI tool for calling gRPC endpoints (like curl for gRPC) |
| **Interceptor** | gRPC middleware: cross-cutting concerns (logging, auth, retry) applied to all calls |
| **Stubby** | Google's internal predecessor to gRPC (2001). Handles 10B+ RPCs/second |
| **connect-rpc** | Buf's protocol compatible with gRPC, gRPC-Web, and plain browser HTTP |
