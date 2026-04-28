# 02 — HTTP

> **Module**: M9 — Communication Protocols  
> **Source**: https://layrs.me/course/hld/09-communication-protocols/http  
> **Difficulty**: Intermediate | **Read time**: ~15 min

---

## ELI5

Imagine sending letters to a librarian to request books.
- **HTTP/1.1**: you write one letter, wait for the book to arrive, then write the next letter. Sequential. One at a time.
- **HTTP/2**: you send 10 letters at once in one envelope. The librarian sends all 10 books back in one big parcel, but if one book is stuck in the mailroom, the whole parcel is delayed.
- **HTTP/3**: you send 10 letters via drone. Each drone is independent — if one drone crashes, the other 9 still arrive on time.

---

## Analogy

HTTP/1.1 is a single-lane road. HTTP/2 adds a dedicated highway with multiple lanes in one tunnel — fast, but an accident blocks all lanes. HTTP/3 builds independent air corridors for each message — no shared bottleneck.

---

## Core Concept

HTTP (HyperText Transfer Protocol) is the application-layer protocol for transferring data on the web. It operates as a **stateless request-response protocol** on top of TCP (HTTP/1.1, HTTP/2) or UDP (HTTP/3 via QUIC).

---

## HTTP Evolution

### HTTP/1.1 (1997)
- **Text-based** protocol — headers and body are plain ASCII
- **Sequential**: one request per TCP connection (unless persistent connection + pipelining)
- **Head-of-line blocking**: later requests wait for earlier ones to complete
- **Workaround**: browsers open 6-8 parallel TCP connections per domain (resource waste)
- **Persistent connections**: `Connection: keep-alive` reuses TCP connection across requests

```
Client          Server
  │──GET /page───►│
  │◄──200 OK──────│  (wait complete)
  │──GET /style───►│
  │◄──200 OK──────│  (wait complete)
  │──GET /script──►│
  │◄──200 OK──────│
```

### HTTP/2 (2015)
- **Binary framing** — all communication split into binary frames (not text)
- **Multiplexing** — multiple streams on a single TCP connection simultaneously
- **HPACK header compression** — dynamic table + Huffman encoding, ~85-90% size reduction
- **Server push** — server can proactively send resources before client asks
- **Stream prioritization** — assign weights/dependencies to streams
- **Still TCP** — TCP-layer head-of-line blocking remains (packet loss stalls all streams)

```
Client          Server
├── Stream 1: GET /page   ──────►│
├── Stream 2: GET /style  ──────►│  (simultaneous)
└── Stream 3: GET /script ──────►│
            ◄── Stream 2: 200 ───┤
            ◄── Stream 1: 200 ───┤
            ◄── Stream 3: 200 ───┤
```

### HTTP/3 (2022) — QUIC
- **Built on QUIC** — a UDP-based transport protocol developed by Google
- **Independent streams** — packet loss only stalls the affected stream, not others
- **0-RTT / 1-RTT** connection setup (vs 2-3 RTT for TCP + TLS)
- **Connection migration** — connection identified by Connection ID (not IP:port), survives network changes (e.g. WiFi → 4G)
- **TLS 1.3 mandatory** — security baked in; no unencrypted HTTP/3

```
Client                 Server
  │──QUIC Initial (0-RTT)────►│
  │◄─Handshake Complete───────│
  │
  ├── Stream 1: GET /page   ──►│
  ├── Stream 2: GET /style  ──►│  (independent streams)
  └── Stream 3: GET /script ──►│
              ◄── Stream 2 ────┤ (arrives first)
              ◄── Stream 1 ────┤
              ◄── Stream 3 ────┤ (packet loss here doesn't block others)
```

---

## HTTP Version Comparison

| Feature | HTTP/1.1 | HTTP/2 | HTTP/3 (QUIC) |
|---|---|---|---|
| **Protocol** | Text | Binary frames | Binary (QUIC) |
| **Transport** | TCP | TCP | UDP (QUIC) |
| **Multiplexing** | No (pipelining, fragile) | Yes (one TCP conn) | Yes (independent streams) |
| **HOL Blocking** | Application layer | TCP layer | Eliminated |
| **Header Compression** | None | HPACK | QPACK |
| **Connection Setup** | 3 RTT (TCP+TLS1.2) | 2 RTT (TCP+TLS1.3) | 1 RTT (new), 0 RTT (repeat) |
| **Connection Migration** | No | No | Yes (Connection ID) |
| **Server Push** | No | Yes | Yes |
| **Adoption** | Universal | ~65% of websites | ~30% and growing |

> **Head-of-line (HOL) Blocking**: HTTP/1.1 blocks at the application layer (sequential requests). HTTP/2 blocks at the TCP layer (one lost packet stalls all streams). HTTP/3 eliminates HOL blocking entirely — each QUIC stream handles its own retransmission.

---

## ASCII: Connection Setup RTTs

```
HTTP/1.1 + TLS 1.2 (3 RTT before data):
  ──SYN──────────────────────────────►
  ◄─SYN-ACK──────────────────────────   TCP handshake: 1 RTT
  ──ACK──────────────────────────────►
  ──ClientHello───────────────────────►
  ◄─ServerHello, Certificate──────────  TLS handshake: 2 RTT
  ──Finished──────────────────────────►
  ◄─Finished──────────────────────────
  ──GET /                 ─────────────► Data starts: 3rd RTT

HTTP/2 + TLS 1.3 (2 RTT):
  ──SYN──────────────────────────────►
  ◄─SYN-ACK──────────────────────────   TCP: 1 RTT
  ──ACK + ClientHello────────────────►
  ◄─ServerHello + Finished────────────  TLS 1.3: 1 RTT (combined)
  ──GET /                 ─────────────► Data starts: 2nd RTT

HTTP/3 + QUIC (1 RTT new, 0 RTT repeat):
  ──QUIC Initial + ClientHello───────►
  ◄─QUIC Response + ServerHello───────  Combined: 1 RTT
  ──GET / (can send immediately)──────► Data: same RTT
```

---

## HTTP Methods

| Method | Safe? | Idempotent? | Example |
|---|---|---|---|
| **GET** | ✅ Yes | ✅ Yes | Fetch resource |
| **HEAD** | ✅ Yes | ✅ Yes | Fetch headers only |
| **OPTIONS** | ✅ Yes | ✅ Yes | CORS preflight |
| **DELETE** | ❌ No | ✅ Yes | Delete resource |
| **PUT** | ❌ No | ✅ Yes | Replace resource completely |
| **PATCH** | ❌ No | ❌ No* | Partial update (*can be idempotent) |
| **POST** | ❌ No | ❌ No | Create resource, trigger action |

> **Safe**: operation has no server-side effects (read-only)  
> **Idempotent**: calling once = calling N times (same result). Critical for retry logic.

---

## HTTP Status Codes

| Range | Category | Key Codes |
|---|---|---|
| **2xx** | Success | 200 OK, 201 Created, 204 No Content |
| **3xx** | Redirect | 301 Moved Permanently, 302 Found, 304 Not Modified |
| **4xx** | Client Error | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 429 Too Many Requests |
| **5xx** | Server Error | 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout |

**Key distinctions**:
- `401 Unauthorized` — not authenticated (no/invalid credentials)
- `403 Forbidden` — authenticated but no permission
- `502 Bad Gateway` — upstream server returned bad response (reverse proxy got garbage)
- `503 Service Unavailable` — server is down or overloaded
- `504 Gateway Timeout` — upstream server timed out (reverse proxy got no response)

---

## HPACK Header Compression (HTTP/2)

HTTP/1.1 repeats large headers on every request (`User-Agent`, `Cookie`, `Accept-*`) — 400-800 bytes per request of overhead.

HPACK solves this with:
1. **Static table**: 61 common header name/value pairs (e.g. `:method GET` = index 2)
2. **Dynamic table**: previously seen headers stored and referenced by index
3. **Huffman encoding**: variable-length binary encoding for remaining strings

Result: ~85-90% header size reduction after the first few requests.

---

## Important Headers

| Header | Direction | Purpose |
|---|---|---|
| `Content-Type` | Request/Response | Media type of body (`application/json`) |
| `Accept` | Request | Media types client accepts |
| `Authorization` | Request | Auth credentials (`Bearer <token>`) |
| `Cache-Control` | Both | Caching directives (`max-age=3600`, `no-cache`) |
| `ETag` | Response | Resource version identifier for conditional caching |
| `If-None-Match` | Request | Sends ETag back; server returns 304 if unchanged |
| `X-Request-ID` | Request | Distributed tracing correlation ID |
| `Retry-After` | Response | When to retry after 429/503 |
| `Strict-Transport-Security` | Response | Force HTTPS (HSTS) |

---

## MERN Dev Notes

```js
// HTTP/2 server in Node.js
const http2 = require('http2');
const fs = require('fs');

const server = http2.createSecureServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt')
});

server.on('stream', (stream, headers) => {
  const path = headers[':path'];
  stream.respond({ ':status': 200, 'content-type': 'application/json' });
  stream.end(JSON.stringify({ message: 'HTTP/2 response' }));
});

// HTTP/2 Server Push
server.on('stream', (stream, headers) => {
  if (headers[':path'] === '/') {
    // Proactively push CSS before browser asks
    stream.pushStream({ ':path': '/style.css' }, (err, pushStream) => {
      pushStream.respond({ ':status': 200, 'content-type': 'text/css' });
      pushStream.end(fs.readFileSync('./style.css'));
    });
  }
  stream.respond({ ':status': 200 });
  stream.end('<html>...</html>');
});
```

```js
// Setting cache headers in Express
app.get('/api/products', (req, res) => {
  const etag = generateETag(products);
  
  // Conditional GET — return 304 if client has current version
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  
  res.set({
    'ETag': etag,
    'Cache-Control': 'public, max-age=300',  // cache 5 minutes
    'Last-Modified': new Date().toUTCString()
  });
  res.json(products);
});
```

---

## Real-World Examples

**Google (HTTP/3 inventor)**
- Deployed HTTP/3 / QUIC internally in 2012. HTTP/3 is IETF-standardized QUIC.
- Most Google services (Search, YouTube, Gmail) serve HTTP/3 by default.
- Key benefit: YouTube video streaming resilient to mobile network switches.

**Netflix**
- Uses HTTP/2 for all API traffic; reduces header overhead significantly.
- Open Connect CDN delivers video via HTTP/2 and HTTP/3.
- Server push used for pre-loading related content manifests.

**Stripe**
- Public-facing API uses HTTP/1.1 (max compatibility) and HTTP/2.
- Dates `Stripe-Version` header for API versioning (`2023-10-16`).
- Uses `Idempotency-Key` header with POST to safely retry payments.

---

## Interview Cheat Sheet

**Q: What is head-of-line blocking and how does each HTTP version handle it?**
A: HOL blocking is when one slow message blocks all subsequent ones. HTTP/1.1 blocks at the application layer — sequential requests on one connection. HTTP/2 eliminates app-layer HOL blocking with multiplexing on one TCP connection, but introduces TCP-layer HOL blocking — if one TCP packet is lost, all HTTP/2 streams on that connection stall. HTTP/3 uses QUIC over UDP where each stream manages its own retransmissions independently, eliminating HOL blocking entirely.

**Q: What is the difference between HTTP/2 multiplexing and HTTP/1.1 pipelining?**
A: HTTP/1.1 pipelining sends multiple requests without waiting for responses but still processes them sequentially server-side and requires ordered responses — practically unusable due to proxy incompatibilities. HTTP/2 multiplexing uses binary framing to interleave independent streams (each assigned a stream ID) over one TCP connection, with responses delivered out-of-order. True parallelism vs simulated parallelism.

**Q: How does HTTP caching work?**
A: ETag-based: server sends `ETag: "abc123"` with response. Client sends `If-None-Match: "abc123"` on next request. If unchanged, server returns `304 Not Modified` with no body, saving bandwidth. `Cache-Control: max-age=300` tells CDN/browser to serve cached copy for 5 minutes without re-validating. `Cache-Control: no-cache` requires revalidation each time, `no-store` prevents caching entirely.

**Q: What is QUIC and why was it built on UDP?**
A: QUIC is a transport protocol developed by Google (now IETF RFC 9000) that implements reliability, congestion control, and TLS 1.3 in userspace over UDP. Built on UDP because TCP is implemented in OS kernels — impossible to change behavior there (middleboxes/firewalls also ossify TCP behavior). UDP passes through firewalls and allows Google to iterate QUIC quickly in userspace. Connection migration via Connection IDs (instead of IP:port) is a QUIC-only capability.

**Q: What does idempotent mean for HTTP methods?**
A: An idempotent operation yields the same result regardless of how many times it's executed. GET, HEAD, DELETE, PUT are idempotent. POST is not — sending the same POST twice creates two resources. This matters for retry logic: safe to automatically retry idempotent methods on failure; POST retries need an `Idempotency-Key` header (like Stripe's API) to prevent duplicates.

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **HTTP (HyperText Transfer Protocol)** | Stateless application-layer protocol for transferring data over the web |
| **Stateless** | Each HTTP request contains all information needed; server holds no session state between requests |
| **TCP (Transmission Control Protocol)** | Reliable, ordered transport. HTTP/1.1 and HTTP/2 use TCP |
| **QUIC** | UDP-based transport protocol combining TCP reliability + TLS 1.3. Used by HTTP/3 |
| **Head-of-Line (HOL) Blocking** | When one slow/lost message delays all subsequent messages in a queue or connection |
| **Multiplexing** | Multiple independent streams sharing a single connection (HTTP/2 and HTTP/3) |
| **HPACK** | HTTP/2 header compression using static table, dynamic table, and Huffman encoding |
| **QPACK** | HTTP/3 header compression — HPACK adapted for QUIC's out-of-order stream delivery |
| **Binary Framing** | HTTP/2 splits messages into binary frames with stream IDs, enabling multiplexing |
| **Server Push** | Server proactively sends resources to client before they are requested (HTTP/2, HTTP/3) |
| **Persistent Connection** | TCP connection reused across multiple HTTP requests (`Connection: keep-alive`) |
| **Pipelining** | HTTP/1.1 feature: send multiple requests without waiting, but receive in order — poorly supported |
| **ETag (Entity Tag)** | Server-generated identifier for a resource version, used for conditional caching |
| **Cache-Control** | HTTP header controlling caching behavior: `max-age`, `no-cache`, `no-store`, `public/private` |
| **304 Not Modified** | Response code meaning "your cached version is current, no body sent" |
| **Idempotent** | Same operation applied N times produces the same result as applying it once |
| **Safe Method** | HTTP method with no server-side state changes (GET, HEAD, OPTIONS) |
| **Idempotency-Key** | Header sent with POST to ensure retries don't create duplicate resources (used by Stripe) |
| **Connection Migration** | QUIC feature: connection survives IP/port changes (e.g. WiFi → 4G), identified by Connection ID |
| **0-RTT** | QUIC feature: repeat connections can send data immediately without a handshake round-trip |
| **TLS 1.3** | Latest TLS version; 1 RTT handshake (vs 2 RTT for TLS 1.2); mandatory for HTTP/3 |
| **Huffman Encoding** | Variable-length binary encoding where frequent values get shorter codes, reducing size |
