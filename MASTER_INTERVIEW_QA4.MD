# Master Interview Q&A — Part 4
# Source: questions.txt
# Section 11 remainder (Q99-Q104) + Sections 12-15 (Q105-Q157)
# Rules: plain-text headers, ASCII-only diagrams, one Q per commit, update progress.md after each Q

---

# Section 11 continued: SYSTEM DESIGN (Q99-Q104)

---

## Q99: How would you design a real-time notification system for 50 million users?

### ELI5

Imagine a newspaper but instead of printing one big batch, you want to whisper the latest headline directly in each person's ear the moment it happens. 50 million ears. You can't ring everyone personally — you set up local radio towers (WebSocket servers) in every city, subscribe groups of users to channels (topics), and when news breaks you broadcast the topic. People actively listening get it instantly. People whose phone is off get it when they turn it back on (via a push queue). The trick is never sending a message person-by-person — always broadcasting to a topic and letting the infrastructure fan it out.

### Visual Diagram

```
Event source (order placed, comment posted, etc.)
     |
     v
+------------------+
| Event Producer   |  (API server publishes event)
+------------------+
     |
     v pubsub
+------------------+
| Message Bus      |  Redis Pub/Sub (low latency) or Kafka (durable, replay)
| topic: user.123  |
+------------------+
     |
     +----fan-out---+----fan-out---+
     v              v              v
+----------+  +----------+  +----------+
| WS Node1 |  | WS Node2 |  | WS Node3 |  <-- many WebSocket servers
| users    |  | users    |  | users    |      each holds ~10k connections
| connected|  | connected|  | connected|
+----------+  +----------+  +----------+
     |
     v WebSocket push
+----------+
| User's   |
| Browser  |  receives notification in real-time
+----------+

User OFFLINE path:
event --> Message Bus --> Notification Worker --> APNs / FCM (mobile push)
                                               --> Email queue (SES/SendGrid)
                                               --> Unread count stored in Redis

Scale numbers:
  50M users, 10% online at peak = 5M concurrent WebSocket connections
  WS server: ~10k connections each = 500 WS server instances
  Redis Pub/Sub fan-out: single channel broadcast to all 500 nodes simultaneously
```

### Code Example

```javascript
// ----- WebSocket notification server (one of many instances) -----
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const redis = require('ioredis');

const server = createServer();
const wss = new WebSocketServer({ server });

// Each WS server has its own Redis subscriber
// Redis Pub/Sub broadcasts from any publisher to ALL subscribed WS nodes
const subscriber = new redis(process.env.REDIS_URL);

// Map of userId -> WebSocket connection (only for users connected to THIS node)
const userSockets = new Map();

// ----- Subscribe to the user-notifications Redis channel -----
subscriber.subscribe('user-notifications', (err) => {
  if (err) console.error('Redis subscribe error:', err);
});

subscriber.on('message', (channel, message) => {
  const { userId, payload } = JSON.parse(message);

  // Check if the target user is connected to THIS node
  const ws = userSockets.get(userId);
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
  // If user is not on this node — another node will handle it
});

// ----- Handle new WebSocket connections -----
wss.on('connection', (ws, req) => {
  // User sends auth token on connect; decode to get userId
  const userId = getUserIdFromToken(req.headers['sec-websocket-key']); // simplified
  userSockets.set(userId, ws);

  ws.on('close', () => userSockets.delete(userId));
});

server.listen(process.env.PORT || 8080);

// =============================================================
// ----- API server: publishes notification event -----
// =============================================================
const publisher = new redis(process.env.REDIS_URL);

async function sendNotification(userId, payload) {
  // Step 1: Store notification in DB for history / unread count
  await db.notifications.insert({ userId, payload, read: false, createdAt: new Date() });

  // Step 2: Increment unread count in Redis (fast badge counter)
  await publisher.incr(`unread:${userId}`);

  // Step 3: Publish to all WS nodes via Redis Pub/Sub
  // Whichever WS node has this user connected will deliver it immediately
  await publisher.publish('user-notifications', JSON.stringify({ userId, payload }));

  // Step 4: For offline users — send mobile push via FCM/APNs
  const isOnline = await publisher.exists(`ws:online:${userId}`);
  if (!isOnline) {
    await pushQueue.add({ userId, title: payload.title, body: payload.body });
  }
}

function getUserIdFromToken(token) { return 'user-123'; } // stub
const db = { notifications: { insert: async () => {} } }; // stub
const pushQueue = { add: async () => {} }; // stub (Bull queue -> Firebase)
```

### Step-by-Step Explanation

1. **Event source** (order service, comment service, etc.) publishes a notification event to a message bus (Redis Pub/Sub for low latency; Kafka if replay/audit is needed).
2. **WebSocket tier**: many WS server instances, each maintaining ~10k–50k long-lived connections. Total 50M users × 10% online = 5M connections / 50k per node = 100 WS nodes.
3. **Fan-out via Redis Pub/Sub**: a single `PUBLISH` command broadcasts the message to ALL subscribed WS nodes simultaneously. Each node checks if the target user is connected to it — if yes, pushes via WebSocket.
4. **Offline users**: if the user has no active WebSocket, push to mobile via FCM (Android) or APNs (iOS), or queue an email for lower-urgency notifications.
5. **Unread counts**: store in Redis (`INCR unread:userId`) — O(1), no DB query needed for badge counts. Reset to 0 when user opens notification center.
6. **Persistent storage**: write every notification to the DB for history, pagination, and "mark all as read" features.
7. **Scalability**: WS servers are stateless in terms of business logic — they only hold connection maps. Scale horizontally behind a sticky-session load balancer (or use connection-aware routing).
8. **Sticky sessions**: WebSocket upgrades require the same server for the lifetime of the connection. Use consistent hashing on userId in the load balancer, or session affinity.

### Complexity

| Component | Scale target | Approach |
|-----------|-------------|---------|
| WebSocket servers | 5M concurrent connections | 100 nodes x 50k each |
| Redis Pub/Sub fan-out | 100 WS nodes | Single PUBLISH reaches all |
| Notification delivery latency | <100ms | Redis in-memory Pub/Sub |
| Offline push | 45M offline users | FCM/APNs batch push |
| Unread count reads | High-frequency | Redis INCR/GET, O(1) |
| Notification history | Pagination | DB with (userId, createdAt) index |

---
