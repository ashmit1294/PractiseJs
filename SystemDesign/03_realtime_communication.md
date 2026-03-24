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
