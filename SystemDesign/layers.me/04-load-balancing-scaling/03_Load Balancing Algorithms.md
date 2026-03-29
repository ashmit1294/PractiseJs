# Load Balancing Algorithms

> **Module 4 — Load Balancing & Scaling**  
> Source: https://layrs.me/course/hld/04-load-balancing-scaling/load-balancing-algorithms

---

## ELI5 — Explain Like I'm 5

Imagine you're a teacher handing out homework to 4 students.
- **Round-robin**: give 1 paper to Alice, 1 to Bob, 1 to Charlie, 1 to Dave, repeat.
- **Least connections**: always give the next paper to whoever has fewest papers right now.
- **Consistent hashing**: Alice *always* gets the red folder, Bob *always* gets the blue folder — so the same files always go to the same student.

Each strategy has pros and cons depending on whether all papers take the same time to grade.

---

## Analogy

Think of checkout lanes at a supermarket:
- **Round-robin** — send every Nth customer to lane N (ignores queue length)
- **Least connections** — send each new customer to the shortest queue
- **IP hash** — customer always goes to the same cashier (cashier knows your loyalty card)
- **Consistent hashing** — customers are sorted by membership tier into dedicated lanes; moving lanes doesn't shuffle everyone

---

## Core Concept

Load balancing algorithms answer: **"Which backend server should handle THIS request right now?"**

Two categories:

| Category | Algorithms | State required |
|---|---|---|
| **Static** | Round-Robin, Weighted RR, Random, IP Hash | Minimal (counter or hash) |
| **Dynamic** | Least Connections, Least Response Time, Power of Two | Continuous metrics |

---

## Algorithm Deep Dives

### 1. Round-Robin
```
Servers: [A, B, C]   Pointer: 0
Req 1 → A (pointer=1)
Req 2 → B (pointer=2)
Req 3 → C (pointer=0)
Req 4 → A ...
```
- **O(1)** — just a modulo increment
- **Trade-off**: ignores server capacity differences; 500ms requests and 1ms requests get equal slots

**Weighted Round-Robin** — add weights proportional to server capacity:
```
Server A: weight=4  (32 cores)
Server B: weight=4  (32 cores)
Server C: weight=1  (4 cores)
→ A gets 4/9, B gets 4/9, C gets 1/9 of traffic
```

### 2. Least Connections
```
Server A: 5 active connections
Server B: 12 active connections
Server C: 3 active connections  ← new request goes here
```
- Track `active_conn` counter per server (increment on open, decrement on close)
- **Best for**: long-lived connections (WebSockets, database pools, video streaming)
- **O(n)** scan unless a min-heap is maintained → **O(log n)**

**Weighted Least Connections**: `score = active_conn / weight` — pick lowest score

### 3. Least Response Time

```
score = response_time × active_connections → pick lowest
```
Uses **exponential moving average (EMA)** with decay ≈ 0.9 to smooth transient spikes.

**Risk**: oscillation — if all traffic shifts to the fastest server, it becomes slow, traffic
shifts back, cyclically. Needs hysteresis tuning.

### 4. IP Hash
```
server_index = hash(client_IP) % server_count
```
- Provides natural session affinity — same client always hits same server
- **Fatal flaw**: adding or removing a server changes the modulo divisor →  
  → adding 1 server to a pool of 5 remaps **5/6 (83%)** of clients

### 5. Consistent Hashing (Solves IP Hash's Flaw)

```
Hash ring: 0 ─────────────────────────────── 2³²
           S1-v1   S2-v1   S3-v1   S1-v2  S2-v2
           100     300     600     800    1200
                     ↑
              Key hashed to 250 → next clockwise = S2-v1
```

**Virtual nodes** (100–500 per physical server) ensure even distribution.

**When a server is added/removed**:
- Only **1/N of keys** are remapped (those between the affected virtual nodes)
- Other (N-1)/N keys stay mapped to their original servers

**Best for**: distributed caches (Memcached, Redis), CDN origin selection, sharded databases.

Netflix CDN uses consistent hashing for video chunk routing:  
if server fails, only ~1/N of chunks need to be fetched from a new server
(which likely already has them, being the next clockwise server).

### 6. Random Selection
- Pick a server uniformly at random
- O(1), stateless, trivially parallelisable across multiple LB instances
- Converges to even distribution by the law of large numbers

**Power of Two Choices** (upgrade):
1. Pick **2** servers at random
2. Route to the one with **fewer connections**
→ Research shows near-optimal load distribution with minimal overhead  
→ P(max load) drops from O(log n / log log n) to O(log log n)

---

## Session Affinity (Sticky Sessions)

Required when applications store session state locally (shopping carts, auth tokens in memory).

| Method | Mechanism | Downside |
|---|---|---|
| **Cookie-based** | LB sets `LB_SERVER=A` cookie; subsequent reqs route to A | Requires L7; server loss = session loss |
| **IP hash** | `hash(client_IP) % N` | Breaks with NAT (office of 1000 employees → same IP) |
| **App-controlled header** | App sets routing hint in header | App must be proxy-aware |

**Best practice**: **eliminate sticky sessions** — store sessions in Redis.  
Any server can handle any request; failover has no session loss.

```
Sticky sessions → technical debt limiting scalability and autoscaling
Redis sessions  → stateless servers → linear scalability
```

LinkedIn's migration: started with cookie-based sticky sessions on monolith →
moved session state to Couchbase → removed affinity → could autoscale freely.

---

## Performance Characteristics

| Algorithm | CPU overhead | State size | Failure behaviour |
|---|---|---|---|
| Round-robin | Nanoseconds | 1 counter | Clean skip |
| Weighted RR | Nanoseconds | N weights | Clean skip |
| Least connections | Microseconds (O(n) scan or O(log n) heap) | N counters | Brief imbalance |
| Consistent hashing | 1–2 µs (crypto hash + ring lookup) | M virtual nodes | Graceful: 1/N remap |
| IP hash | Nanoseconds | None | Remaps 5/6 on change |

---

## Algorithm Selection Guide

```
Data locality critical? (caching, sharding)
  → Consistent Hashing

Long-lived connections? (WebSocket, DB pools, streaming)
  → Least Connections (or Weighted Least Connections)

Request latency varies 10×+, have monitoring infra?
  → Least Response Time (watch for oscillation)

Session affinity required? (legacy stateful app)
  → Cookie-based affinity + Round-Robin (plan to eliminate it)

Servers have different capacities?
  → Weighted Round-Robin (simple, predictable)

High-throughput stateless service? (millions RPS, multiple LB instances)
  → Power of Two Choices or Random (stateless, parallelisable)

Standard stateless uniform API?
  → Round-Robin (default — 80% of cases)
```

---

## Real-World Examples

| Company | Algorithm | Reason |
|---|---|---|
| **Facebook** web tier | Consistent hashing + Weighted RR | Maximises per-server cache hit rates for user profile data |
| **LinkedIn** API gateway | Least connections (stateless servers) | Session state in Couchbase → no affinity needed |
| **Netflix** CDN | Consistent hashing (100–500 virtual nodes) | Video chunks always map to primary → secondary fallback; minimise cache misses on failure |
| **Facebook dynamic** | Tracks per-server cache hit rate, adjusts weights | Higher-HIT servers get slightly more traffic → positive feedback loop |

---

## MERN Dev Notes

| Scenario | Recommendation |
|---|---|
| Node.js Express API (stateless) | Round-robin or Power of Two — simplest |
| Express with in-memory sessions | Migrate to Redis sessions first, then remove sticky sessions |
| MongoDB reads (read-heavy) | Consistent hashing if you add caching layer on top |
| WebSocket server (long-lived) | Least connections; sticky session per WebSocket upgrade |
| Multi-region with CDN | Consistent hashing for cache servers ensures the same asset hits the same cache node |

**Stateless Express pattern** (Redis sessions):
```js
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const redis = require('redis').createClient({ url: process.env.REDIS_URL });

app.use(session({
  store: new RedisStore({ client: redis }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));
// Now any Node.js instance can handle any request → safe behind round-robin LB
```

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| Default algorithm? | Round-robin (stateless uniform APIs) |
| WebSocket / streaming? | Least connections (long-lived connections ≈ load) |
| Distributed cache? | Consistent hashing (stable key mapping, ≈1/N remap) |
| IP hash vs consistent hashing? | IP hash remaps 5/6 when adding 1 server; consistent hashing remaps only 1/N |
| Sticky session downside? | Uneven load, session loss on failure, complicates autoscaling |
| Power of Two Choices value? | Near-optimal balance with O(1) overhead (pick 2 random, route to lesser-loaded) |

**Red flags**:
- "Least response time is always best" (oscillation risk, monitoring overhead)
- "IP hash is fine for session affinity" (breaks with NAT, mobile IP churn)
- "Session affinity is required for stateful apps" (Redis removes the need)
- Not knowing that IP hash remaps most clients when server count changes

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Round-robin** | Distribute requests cyclically across servers in order |
| **Least connections** | Route to server with fewest active TCP connections |
| **Least response time** | Route to server with lowest (response time × connections) product |
| **IP hash** | `hash(client_IP) % N` — simple affinity, breaks on topology change |
| **Consistent hashing** | Hash ring where adding/removing a server remaps only 1/N of keys |
| **Virtual nodes** | Multiple positions per physical server on the consistent hash ring for even distribution |
| **Session affinity / sticky sessions** | Routing the same client to the same server consistently |
| **EMA** (Exponential Moving Average) | Weighted average that gives more weight to recent values |
| **Power of Two Choices** | Pick 2 random servers; route to the one with fewer connections |
| **Weighted round-robin** | Round-robin with server weights proportional to capacity |
