# Real-time Communication
> Resume Signal: Socket.IO + WebSockets, sub-second latency

---

## STAR Interview Answer

| | |
|---|---|
| **Situation** | A collaborative dashboard needed live updates — multiple browser tabs showing the same data had to stay in sync with sub-second latency. Long polling was creating 2–3 second delays and hammering the server with constant polling requests. |
| **Task** | Replace polling with a persistent bidirectional channel that worked across multiple horizontally-scaled Node.js instances. |
| **Action** | Migrated to Socket.IO (WebSocket with automatic fallback). Added a Redis adapter (`@socket.io/redis-adapter`) so events emitted on one server instance were broadcast to all connected clients regardless of which instance they were connected to. Used rooms to scope updates per-user and per-dashboard. Added a heartbeat + reconnect strategy to gracefully recover dropped connections. |
| **Result** | Latency dropped from 2–3s (polling) to under 100ms measured end-to-end. Server requests reduced by ~85% — persistent connections replaced constant polling. Works seamlessly with horizontal scaling: 3 Node.js instances, all clients receive updates through Redis adapter fan-out. |

---

## ELI5

A telephone call vs sending letters. HTTP polling is like mailing a letter every second asking "anything new?" — wasteful and slow. WebSockets are a phone call — the line stays open, either side can speak the instant something happens. Server-Sent Events (SSE) is a one-way radio broadcast — server talks, client only listens.

---

## The Three Protocols

### WebSockets

Full-duplex persistent TCP connection over a single HTTP upgrade.

```
Client                       Server
  |                             |
  |  HTTP GET /ws               |
  |  Upgrade: websocket  -----> |
  |                             |
  |  101 Switching Protocols <--|
  |  (HTTP upgrades to WS)      |
  |                             |
  |  <==== PERSISTENT TCP ====> |  ← bidirectional, any time
  |  frame: { type: 'msg' } --> |
  |  <-- frame: { data: ... }   |
```

**Characteristics:**
- Full-duplex: client AND server can send at any time
- Low overhead: frames after handshake, no HTTP headers each time
- Works through most proxies/load balancers (with sticky sessions or Redis adapter)

```javascript
// Server — Socket.IO (wraps WebSocket with rooms, namespaces, fallback)
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const io = new Server(httpServer, {
  cors: { origin: process.env.ALLOWED_ORIGIN },
  pingTimeout: 20000,
  pingInterval: 10000,
});

// Redis adapter: events on one Node.js instance → all instances
const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));

io.use((socket, next) => {
  // Authenticate on connect — verify JWT from handshake
  const token = socket.handshake.auth.token;
  try {
    socket.user = verifyJWT(token);
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const { userId, dashboardId } = socket.user;

  // Join a room — scoped broadcast to that dashboard only
  socket.join(`dashboard:${dashboardId}`);

  socket.on('cursor-move', (pos) => {
    // Broadcast to all in the room EXCEPT sender
    socket.to(`dashboard:${dashboardId}`).emit('cursor-update', {
      userId,
      pos,
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`${userId} disconnected: ${reason}`);
  });
});

// Emit from anywhere in the backend (another service, a job worker)
export function notifyDashboard(dashboardId, event, data) {
  io.to(`dashboard:${dashboardId}`).emit(event, data);
}
```

```javascript
// Client — React hook
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export function useSocket(dashboardId) {
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_WS_URL, {
      auth: { token: getAuthToken() },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => console.log('WS connected'));
    socket.on('connect_error', (err) => console.error('WS error', err.message));

    socketRef.current = socket;
    return () => socket.disconnect();
  }, [dashboardId]);

  return socketRef.current;
}
```

---

### Server-Sent Events (SSE)

**One-way stream from server to browser** over regular HTTP. Browser reconnects automatically.

```javascript
// Server
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Emit an event every time something changes
  const interval = setInterval(() => sendEvent({ ts: Date.now() }), 1000);

  req.on('close', () => {
    clearInterval(interval);
  });
});
```

```javascript
// Client — native browser API, auto-reconnects
const es = new EventSource('/events');
es.onmessage = (e) => console.log(JSON.parse(e.data));
es.onerror   = ()  => console.warn('SSE reconnecting...');
```

---

### Long Polling

Client sends HTTP request → server holds it open until data is available → client immediately sends another request.

```javascript
// Server
app.get('/poll', async (req, res) => {
  const since = req.query.since || 0;
  const timeout = setTimeout(() => res.json({ events: [] }), 25_000); // 25s max hold

  const events = await waitForNewEvents(since, 25_000);
  clearTimeout(timeout);
  res.json({ events });
});
```

---

## Protocol Comparison

| | WebSocket | SSE | Long Polling |
|--|-----------|-----|--------------|
| Direction | Bidirectional | Server → Client only | Server → Client (per request) |
| Connection | Persistent TCP | Persistent HTTP | Request per message |
| Overhead | Low (frames) | Low (HTTP headers once) | High (full HTTP headers each time) |
| Auto-reconnect | Manual (Socket.IO handles) | Native browser | Client implements |
| Proxies/CDN | Needs upgrade support | Standard HTTP — works everywhere | Standard HTTP |
| Binary data | ✅ Native | ❌ Text only | ❌ Text only |
| Horizontal scaling | Needs sticky session OR Redis adapter | Needs sticky session | Stateless, easy |
| Use case | Chat, live collab, gaming | Live feeds, notifications, dashboards | Legacy fallback |

---

## When to Use Each

| Requirement | Choose |
|-------------|--------|
| Bidirectional (client sends AND receives live) | WebSocket |
| Client must also send to server frequently | WebSocket |
| Server pushes only (notifications, price feed, live score) | SSE |
| Must work through all corporate proxies unconditionally | SSE |
| Simple; must be stateless; no persistent connection infra | Long Polling |
| Real-time multi-player / collaborative editing | WebSocket |
| Live chat | WebSocket |
| Order status updates, CI build logs | SSE |

---

## Scaling WebSockets Horizontally

Single server: trivial. Multiple servers: a client connected to Server 1 won't receive an event emitted on Server 2.

**Solutions:**

| Approach | How |
|----------|-----|
| Sticky sessions | Load balancer pins a client to the same server (IP hash / cookie). Simple but prevents true horizontal autoscaling. |
| Redis Pub/Sub adapter | All servers subscribe to Redis. Emit on Redis → all servers → all their connected sockets. Socket.IO redis-adapter does this automatically. |
| Kafka / NATS | For very high throughput; events flow through a durable message bus; each WS server consumes and pushes to its own clients. |

---

## Key Interview Q&A

**Q: Why Socket.IO over raw WebSockets?**
> Automatic fallback to long polling when WebSocket is blocked (some corporate proxies). Built-in rooms, namespaces, reconnection logic, and middleware. The Redis adapter for horizontal scaling. Raw WebSockets require implementing all of this yourself.

**Q: How did you achieve sub-second latency?**
> Persistent WebSocket connection eliminates TCP handshake overhead on each message. Combined with Redis adapter for multi-instance fan-out, the message path is: client event → Socket.IO server → Redis PUBLISH → all servers → their clients. Redis in-memory pub/sub is typically <1ms. End-to-end measured at ~60–90ms on LAN.

**Q: SSE vs WebSocket for a live notification feed?**
> SSE — notifications are server-to-client only, SSE is simpler, works through all HTTP/2 proxies with no upgrade required, and the browser auto-reconnects natively. WebSocket would be overkill unless the client also needs to send data on the same channel.

**Q: What happens to WebSocket messages during a server restart?**
> Connections drop. Clients with reconnection logic re-establish within 1–5 seconds depending on backoff. Any messages emitted during that window are lost unless you buffer them server-side (Redis list, SQS) and replay on reconnect. We used a `lastEventId` pattern so clients could request missed events on reconnect.

---

## ELI5 Complex Keywords Glossary

| Term | ELI5 Explanation |
|------|-----------------|
| **WebSocket** | A phone call between your browser and the server. After a quick setup handshake, the line stays open indefinitely. Either side can talk at any moment without asking first — unlike HTTP where you always have to call the server and wait for it to answer. |
| **Full-Duplex** | Both sides can send and receive at the same time, independently. Like a phone call (both can talk). The opposite is half-duplex — like walkie-talkies where you say "over" before the other person can speak. |
| **HTTP Upgrade (101 Switching Protocols)** | The initial handshake where the browser politely asks the server: "Can we switch from HTTP to WebSocket?" If the server says yes (code 101), the connection is transformed into a persistent WebSocket tunnel. |
| **TCP** | The underlying internet protocol that makes sure data packets arrive in order and without corruption. WebSockets are built on top of TCP — TCP does the reliable delivery, WebSocket adds the framing layer. |
| **Socket.IO** | A library that wraps WebSockets and adds superpowers: automatic fallback to polling if WebSockets are blocked, rooms, namespaces, reconnection, and middleware. It's a more user-friendly and production-ready WebSocket wrapper. |
| **Room (Socket.IO)** | A named group of connected clients. You can broadcast a message to a room and only the sockets in that room receive it. Like a group chat — say something in "Room 42" and only people in that group see it. |
| **Namespace (Socket.IO)** | A virtual partition within the Socket.IO server. Like having multiple separate apps on the same server — `/chat` and `/notifications` can be completely independent channels on the same port. |
| **Redis Adapter** | A plug-in that makes Socket.IO work across multiple server instances. When Server A emits an event, it publishes to Redis; all other servers (B, C, D) see it and forward it to their connected clients. Lets you scale horizontally. |
| **SSE (Server-Sent Events)** | A one-way stream from the server to the browser over a normal HTTP connection. The browser opens one long-lived request and the server keeps writing data to it. Think of it as a live Twitter feed — server pushes, client just listens. |
| **Long Polling** | A hacky workaround before WebSockets. The client sends a request; the server holds it open without responding until there's new data. Once it responds, the client immediately sends a new request. High overhead, but works everywhere. |
| **Heartbeat / Ping-Pong** | A keep-alive mechanism. The server periodically sends a "ping" to the client; the client replies with "pong." If the server doesn't hear back, it knows the connection is dead and cleans it up. |
| **Reconnection / Backoff** | When a WebSocket connection drops, the client automatically tries to reconnect after a delay. Exponential backoff means: wait 1s, then 2s, then 4s, etc. — so thousands of clients don't all slam the server simultaneously after a restart. |
| **Sticky Sessions** | A load balancer setting that always sends the same user to the same server. Needed for WebSockets (because the connection is stateful) when you don't have a Redis adapter — the load balancer uses a cookie or IP hash to "stick" the user. |
| **Fan-out** | Broadcasting one message to many recipients. Redis Pub/Sub does fan-out — one PUBLISH reaches all subscribers. A WebSocket server fan-out sends one event to all clients in a room. |
| **Horizontal Scaling (WebSockets)** | Running multiple identical WebSocket server instances. Hard because WebSocket connections are stateful — a client connected to Server A can't receive events emitted on Server B without a shared message bus (Redis). |
| **Frame** | The unit of data sent over a WebSocket connection. After the initial handshake, communication happens in small framed packets (not full HTTP requests) — very low overhead compared to repeated HTTP calls. |
| **Latency** | How long it takes for a message to travel from sender to receiver. Sub-second latency means less than 1000ms. WebSockets achieve ~60–100ms end-to-end because the connection is already open and there's no HTTP handshake overhead per message. |
| **`lastEventId` Pattern** | A technique to recover missed events after a reconnection. The client tells the server "the last event I received had ID 42" and the server replays everything after ID 42 — like picking up a newspaper from where you left off. |
| **Proxy / Corporate Firewall** | Network infrastructure that some companies use to inspect traffic. Some proxies block WebSocket upgrades. SSE and long polling use standard HTTP so they pass through freely — a key reason to have fallback options. |
