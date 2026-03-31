# 09 — Long Polling vs WebSockets vs SSE

> **Module**: M9 — Communication Protocols  
> **Source**: https://layrs.me/course/hld/09-communication-protocols/long-polling-websockets-sse  
> **Difficulty**: Intermediate | **Read time**: ~15 min

---

## ELI5

You're waiting for a package delivery. Three strategies:

1. **Long Polling**: You call the courier every few minutes: "Is it there yet?" The courier puts you on hold until the package arrives, then tells you. You immediately call again.
2. **WebSockets**: You set up a walkie-talkie with the courier. Both of you can talk at any time. Real-time, two-way.
3. **SSE**: The courier sends you automatic text messages whenever there's a status update. One-way, but you get updates the moment they happen.

---

## Analogy

| Technology | Real-World Analogy |
|---|---|
| **Long Polling** | Repeatedly checking your mailbox until mail arrives |
| **WebSockets** | A phone call — both people can speak simultaneously |
| **SSE** | A news ticker — server broadcasts to you; you watch, don't reply |

---

## Core Concept

Standard HTTP is request-response: the server can only send data when the client asks. For real-time apps (chat, live prices, notifications), we need the server to push data. Three main techniques achieve this with different trade-offs.

---

## Long Polling

```
Client                          Server
  │                              │
  │──── GET /events ────────────►│  Request 1
  │         (server holds       │
  │          connection open)   │
  │              ⋮  waiting      │
  │◄──── 200 OK (event data) ───│  Event arrives → respond
  │                              │
  │──── GET /events ────────────►│  Request 2 (immediately re-request)
  │         (server holds)      │
  │              ⋮  waiting      │  ... and so on
```

### How it works:
1. Client sends HTTP request
2. Server holds the connection open (up to 30-60 seconds)
3. When event arrives, server responds with data
4. Client immediately sends a new request to catch the next event

### Trade-offs:
- **Overhead**: Full HTTP request/response per event. ~800 bytes of headers in HTTP/1.1. Even with HTTP/2, a full round-trip per message.
- **Latency**: Depends on response time. If server responds just after client gets the previous response, next event has a full RTT delay.
- **Server load**: Each waiting client holds a server thread/connection.
- **Works everywhere**: Any HTTP client supports it. No special browser APIs needed.

---

## WebSockets

### Upgrade Handshake

WebSockets start as HTTP and then upgrade:

```
Client                              Server
  │                                  │
  │── GET /chat HTTP/1.1 ───────────►│
  │   Host: example.com              │
  │   Upgrade: websocket             │
  │   Connection: Upgrade            │
  │   Sec-WebSocket-Key: dGhlc...    │  Base64 random 16 bytes
  │   Sec-WebSocket-Version: 13      │
  │                                  │
  │◄── HTTP/1.1 101 Switching Protocols
  │    Upgrade: websocket            │
  │    Connection: Upgrade           │
  │    Sec-WebSocket-Accept: s3pP... │  Hash of key + GUID
  │                                  │
  │════ WebSocket Connection Open ═══│
  │                                  │
  │══ Frame: "Hello" ───────────────►│  2-14 bytes overhead per message
  │◄═ Frame: "Hi back" ══════════════│  FULL DUPLEX — both sides simultaneously
  │══ Frame: ... ───────────────────►│
```

### Frame Format

WebSocket messages are sent as **frames** — incredibly compact:

```
Byte 1: FIN(1) + RSV(3) + Opcode(4)      [type: text/binary/ping/close]
Byte 2: Mask(1) + Payload Len(7)
[If len=126]: Extended length (2 bytes)
[If len=127]: Extended length (8 bytes)
[If masked]:  Masking key (4 bytes)       [client→server messages are masked]
Payload data...
```

**Result**: 2-14 bytes overhead per message (vs ~800 bytes for HTTP/1.1 request headers).

### Key Properties
- **Full-duplex**: client and server send simultaneously, independently
- **Persistent connection**: one TCP connection for lifetime of session
- **Binary or text**: frames can carry raw bytes (great for binary protocols)
- **No built-in reconnection**: you implement reconnection logic yourself
- **Masking**: client→server frames are XOR-masked (prevents cache poisoning on proxies)

---

## Server-Sent Events (SSE)

### How it works

SSE uses a **persistent HTTP response** — the response never ends:

```
Client                              Server
  │── GET /events ─────────────────►│
  │   Accept: text/event-stream     │
  │                                  │
  │◄── HTTP/1.1 200 OK ──────────────│
  │    Content-Type: text/event-stream
  │    Cache-Control: no-cache      │
  │    Connection: keep-alive       │
  │                                  │
  │◄── data: {"type":"price","val":42} \n\n
  │                                  │  (connection stays open)
  │◄── data: {"type":"price","val":43} \n\n
  │                                  │
  │◄── id: 1001 \n                   │  Event ID for reconnection
  │    data: {"type":"trade"} \n\n   │
```

### SSE Event Format

```
id: 1001
event: price-update
data: {"symbol": "AAPL", "price": 182.50}
retry: 3000

id: 1002
data: Simple text message

```

Fields: `id` (for reconnection), `event` (custom event name), `data` (payload), `retry` (reconnection delay ms)

### Auto-Reconnection

SSE's killer feature — built into the browser `EventSource` API:

```
Client                              Server
  │── GET /events ─────────────────►│
  │   Last-Event-ID: 1001           │  Auto-sends last received ID
  │                                  │
  │         ... connection drops ... │
  │                                  │
  │ EventSource auto-reconnects     │
  │── GET /events ─────────────────►│
  │   Last-Event-ID: 1001           │  Resume from event 1001
  │◄── id: 1002 data: ... \n\n ─────│  Server resumes from there
```

The `EventSource` API automatically reconnects with **exponential backoff** and sends the `Last-Event-ID` header so the server can resume the stream from where it left off.

---

## Full Comparison Table

| Dimension | Long Polling | WebSockets | SSE |
|---|---|---|---|
| **Direction** | Simulate server push | Full-duplex (bidirectional) | Server → Client only |
| **Protocol** | HTTP (standard) | HTTP upgrade → WebSocket | HTTP/1.1 or HTTP/2 |
| **Connection** | New request per event | Persistent TCP | Persistent HTTP response |
| **Overhead per message** | ~800 bytes (HTTP/1.1 headers) | 2-14 bytes | Minimal (streaming) |
| **Latency** | 50-200ms | ~1-2ms | Low (~10ms) |
| **Auto-reconnect** | You implement | You implement | ✅ Built-in (EventSource) |
| **Binary support** | No | ✅ Yes | No (text-only) |
| **Browser support** | Universal | IE10+ | IE not supported |
| **Multiplexing** | N connections = N polls | N connections = N TCP sockets | N connections = N HTTP |
| **Load balancer** | Stateless-compatible | Needs sticky sessions | Needs sticky sessions |
| **Firewall/proxy** | Safest (just HTTP) | Sometimes blocked | Safe (just HTTP) |
| **Battery usage** | High (many connections) | Good | Good |

---

## Scaling WebSockets and SSE

Both require **persistent connections** — creates scaling challenges:

### Memory Per Connection
```
64KB stack × 100,000 connections = ~6.4GB RAM per server
(actual: ~640KB stack in Node.js; 100K = ~64GB — use connection limits)
```

In practice, Node.js handles 10,000-50,000 WebSocket connections per instance (tunable).

### Sticky Sessions Problem

```
Without sticky sessions:            With sticky sessions:
                                    
User ─► LB ─► Server A              User ─► LB ─► Server A (always)
              (has WS conn)                       (session affinity)
              
Server B pushes to User             Works, but uneven load distribution
but has no WebSocket connection     Server A may be overloaded
for that User → message lost!       
```

**Sticky sessions (session affinity)**: Load balancer always routes a specific client to the same server (via IP hash or cookie). Ensures the client's persistent connection is always reachable.

### Cross-Server Message Delivery

Even with sticky sessions, if a message originates on Server B, it must reach User's connection on Server A:

```
                    Redis Pub/Sub
                    (shared broker)
                   /               \
User WebSocket    Server A      Server B ← Message originates here
  on Server A  ←  subscribes     publishes to "user:123" channel
                  "user:123"
                  → forwards to client's WebSocket connection
```

**Pattern**: each server subscribes to Redis Pub/Sub channels for its connected users. Any server can publish to any channel; the server holding the connection receives and forwards it.

---

## Decision Tree

```
Need real-time communication?
│
├── Does client need to SEND data to server?
│   ├── Yes → WebSockets (full-duplex)
│   └── No  → What else matters?
│             ├── Auto-reconnect + text only → SSE
│             ├── Max browser compatibility → Long Polling
│             └── Binary data + low overhead → WebSockets
│
├── Running in constrained proxy environment?
│   └── Yes → Long Polling (pure HTTP, never blocked)
│
└── Mobile battery life critical?
    └── Yes → SSE (one persistent connection, less overhead than polling)
```

---

## MERN Dev Notes

### WebSockets with ws
```js
const WebSocket = require('ws');
const http = require('http');

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Connection map for targeted messaging
const clients = new Map(); // userId → ws

wss.on('connection', (ws, req) => {
  const userId = getUserFromRequest(req); // parse JWT from query/cookie
  clients.set(userId, ws);
  
  ws.on('message', (data) => {
    const message = JSON.parse(data);
    handleMessage(userId, message);
  });
  
  ws.on('close', () => clients.delete(userId));
  
  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    clients.delete(userId);
  });
  
  // Heartbeat ping (detect dead connections)
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

// Heartbeat — detect and clean up dead connections
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);
```

### SSE with Express
```js
app.get('/events', (req, res) => {
  const userId = authenticate(req);
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();
  
  let eventId = parseInt(req.headers['last-event-id'] || '0');
  
  const sendEvent = (data) => {
    eventId++;
    res.write(`id: ${eventId}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  // Subscribe to Redis for this user's events
  const subscriber = redis.duplicate();
  subscriber.subscribe(`user:${userId}:events`);
  subscriber.on('message', (channel, message) => {
    sendEvent(JSON.parse(message));
  });
  
  // Cleanup on disconnect
  req.on('close', () => {
    subscriber.unsubscribe();
    subscriber.quit();
  });
});
```

### EventSource in React
```jsx
import { useEffect, useState } from 'react';

function LivePriceFeed() {
  const [price, setPrice] = useState(null);
  
  useEffect(() => {
    const source = new EventSource('/events?token=' + getToken());
    
    source.addEventListener('price-update', (e) => {
      setPrice(JSON.parse(e.data).price);
    });
    
    source.onerror = () => {
      // EventSource handles reconnection automatically
      // onerror fires on each reconnection attempt
    };
    
    return () => source.close();
  }, []);
  
  return <div>Price: ${price}</div>;
}
```

---

## Real-World Examples

**Slack (WebSockets)**
- Maintains a WebSocket connection per client session.
- Used for: message delivery, typing indicators, presence updates, read receipts.
- Target latency: < 100ms for message delivery.
- Falls back to long polling for restrictive corporate networks.
- Scales with sticky sessions + Redis Pub/Sub for cross-server delivery.

**Discord (WebSockets at massive scale)**
- 4M+ concurrent WebSocket connections served by Elixir/BEAM virtual machine.
- BEAM's actor model and lightweight processes (not OS threads) make it ideal for millions of persistent connections.
- Gateway servers handle WebSocket connections; separate servers handle logic.
- Presence system (who's online in which server) is the hardest scaling challenge.

**Stripe (SSE)**
- Stripe Dashboard uses SSE for real-time payment event updates.
- Payment succeeded/failed events stream to the merchant's browser the moment they occur.
- SSE is ideal: server-to-client only (Stripe pushes events, merchant just watches), auto-reconnect handled by EventSource.

---

## Interview Cheat Sheet

**Q: What is the WebSocket upgrade handshake and why is it needed?**
A: WebSockets start as an HTTP/1.1 request with `Upgrade: websocket` and `Connection: Upgrade` headers. The server responds with `101 Switching Protocols` and the `Sec-WebSocket-Accept` header (SHA-1 hash of client's key + a GUID, base64-encoded). This handshake serves two purposes: (1) reuses port 80/443 so WebSockets pass through firewalls that allow HTTP; (2) prevents non-WebSocket clients from accidentally connecting. After 101, the connection is no longer HTTP — it's a raw bidirectional TCP stream with WebSocket framing.

**Q: When would you choose SSE over WebSockets?**
A: SSE for: (1) server-to-client only use case (notifications, live feeds, dashboards) — simpler than WebSockets since no client-to-server messaging; (2) auto-reconnect with state is important — EventSource + Last-Event-ID built-in vs custom implementation for WebSockets; (3) you want the simplicity of HTTP — SSE works over regular HTTP/1.1, debug with browser DevTools Network tab, no special proxy config. WebSockets for: (1) client needs to send messages (chat, collaboration, gaming); (2) very low latency (2-14 byte overhead vs SSE's text lines); (3) binary data.

**Q: How do you scale WebSockets/SSE across multiple servers?**
A: Two challenges: (1) Sticky sessions — load balancer must route each client to the same server that holds their connection (IP hash or cookie-based affinity). Without this, HTTP requests go to the wrong server. (2) Cross-server message delivery — when a message must reach a user connected to a different server, use a broker. Pattern: servers subscribe to Redis Pub/Sub channels for their connected users; any server can publish to any channel; the server holding the connection receives and forwards it to the WebSocket/SSE client. Use Redis Streams or Kafka for durability and message ordering.

**Q: What is Long Polling and why is it considered a "hack"?**
A: Long Polling simulates server push using standard HTTP — the server holds the request open until data is ready, then responds. The client immediately sends a new request to re-establish the "connection." It's a hack because: it's stateless (each poll is a new HTTP request with full header overhead ~800B), has inherent latency (at minimum one RTT between events), ties up server resources (connections held open), and is fragile (timeouts, proxies closing idle connections). But it works everywhere, behind any proxy or firewall, making it a universal fallback when WebSockets are blocked.

**Q: What are the memory and scaling implications of 100,000 WebSocket connections?**
A: Each WebSocket connection requires server-side state: the TCP socket, receive/send buffers, and application-level session data. In Node.js, expect ~10-50KB per connection (socket buffers + application state). 100K connections × 50KB = ~5GB RAM per server. More importantly, 100K connections tied to one Node.js process means CPU contention on the event loop — distribute across multiple processes/servers. Use UV_THREADPOOL_SIZE, cluster mode, or separate gateway servers for WebSocket handling. Heartbeat intervals must scan all connections — N connections × heartbeat work = O(N) per interval.

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Long Polling** | Client holds HTTP request open; server responds when data available; client immediately re-requests |
| **WebSocket** | Persistent, full-duplex TCP connection upgraded from HTTP via `101 Switching Protocols` |
| **SSE (Server-Sent Events)** | Persistent HTTP response stream from server to client; text-only, auto-reconnects |
| **EventSource** | Browser API for SSE. `new EventSource('/events')` — handles auto-reconnection natively |
| **Full-Duplex** | Both parties send and receive simultaneously and independently |
| **`101 Switching Protocols`** | HTTP status code that completes the WebSocket upgrade handshake |
| **`Upgrade: websocket`** | HTTP header requesting protocol upgrade to WebSocket |
| **`Sec-WebSocket-Key`** | Random base64 value client sends; server hashes it to prove it speaks WebSocket |
| **`Sec-WebSocket-Accept`** | Server's response: SHA-1(Key + GUID) base64 — confirms WebSocket support |
| **WebSocket Frame** | Unit of WebSocket transport. 2-14 bytes overhead; carries text, binary, ping, pong, close |
| **Masking** | Client→server WebSocket frames XOR-masked with a 4-byte key. Prevents cache poisoning |
| **`Last-Event-ID`** | HTTP header sent by EventSource on reconnect, telling server the last received event ID |
| **SSE Auto-Reconnect** | EventSource automatically reconnects after connection drops, with exponential backoff |
| **Sticky Sessions (Session Affinity)** | Load balancer always routes a specific client to the same server |
| **Redis Pub/Sub** | Publish-Subscribe messaging in Redis; used to route messages across WebSocket servers |
| **Heartbeat / Ping-Pong** | Periodic messages to detect dead WebSocket connections (`ws.ping()`, `ws.on('pong')`) |
| **`X-Accel-Buffering: no`** | Nginx header to disable response buffering for SSE streams |
| **Polling** | Client periodically requests data on a timer; simpler but wastes resources when no data changes |
| **Server Push** | Server sends data to client without client requesting it |
| **Connection Upgrade** | HTTP mechanism to switch protocol on a connection (HTTP → WebSocket) |
| **Backpressure** | When sender produces data faster than receiver consumes it; WebSocket streams can stall |
