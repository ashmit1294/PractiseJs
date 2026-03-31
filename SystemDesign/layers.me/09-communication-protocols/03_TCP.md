# 03 — TCP

> **Module**: M9 — Communication Protocols  
> **Source**: https://layrs.me/course/hld/09-communication-protocols/tcp  
> **Difficulty**: Intermediate | **Read time**: ~15 min

---

## ELI5

Imagine shipping packages between two warehouses. TCP is like using a courier service with **tracking, acknowledgements, and guaranteed delivery**:
- Before any package ships, both warehouses agree on the rules (3-way handshake).
- Every package gets a sequence number. If package #5 doesn't arrive, the courier re-ships it.
- The receiving warehouse sends receipts confirming what arrived (ACKs).
- If the road gets congested, the courier slows down (congestion control).

You never lose a package, but delivery takes longer because of all this coordination.

---

## Analogy

TCP is like a **phone call**:
1. You dial (SYN) → it rings (SYN-ACK) → you say "hello?" (ACK) — connection established.
2. Both parties can talk simultaneously (full-duplex).
3. If the line is noisy and you miss something, you ask "can you repeat that?" (retransmission).
4. When done, both sides say "goodbye" (4-way FIN handshake).

---

## Core Concept

TCP (Transmission Control Protocol) is a connection-oriented, reliable, ordered, full-duplex transport protocol. It guarantees that:
1. **All segments arrive** (retransmission on loss)
2. **In the correct order** (sequence numbers)
3. **Without duplicates** (sequence number deduplication)
4. **At a rate the receiver can handle** (flow control)
5. **Without congesting the network** (congestion control)

These guarantees come at the cost of **latency** and **overhead** — not suitable for applications where freshness matters more than completeness (use UDP for those).

---

## Three-Way Handshake

Establishes a connection before any data is transferred. Costs **1 RTT** of latency overhead.

```
Client                          Server
  │                              │
  │──── SYN (seq=x) ────────────►│  Client: "I want to connect, my seq starts at x"
  │                              │
  │◄─── SYN-ACK (seq=y, ack=x+1)│  Server: "OK, my seq starts at y, I got your x"
  │                              │
  │──── ACK (ack=y+1) ──────────►│  Client: "I got your y, connection open"
  │                              │
  │═══════ DATA FLOWS ══════════►│
  │◄══════ DATA FLOWS ═══════════│
```

**SYN flood attack**: attacker sends many SYN packets without completing handshakes, exhausting server's half-open connection table. Mitigated by **SYN cookies** — server doesn't allocate state until handshake completes.

---

## Four-Way Termination

```
Client                          Server
  │──── FIN ───────────────────►│  Client: "I'm done sending"
  │◄─── ACK ────────────────────│  Server: "Got it"
  │◄─── FIN ────────────────────│  Server: "I'm done sending"
  │──── ACK ───────────────────►│  Client: "Got it" → enters TIME-WAIT (2 min)
```

**TIME-WAIT (2 minutes)**: client waits before fully closing. Prevents stale packets from the old connection being interpreted as data in a new connection. Can exhaust ports on high-throughput servers — solved with `SO_REUSEADDR` and `SO_LINGER`.

---

## Sequence Numbers and ACKs

```
Sender                 Receiver
  │──Seg 1 (seq=1) ──►│
  │──Seg 2 (seq=2) ──►│
  │──Seg 3 (seq=3) ──►│  Seg 2 lost
  │                   │
  │◄── ACK 2 ─────────│  "I got up to 1, send from 2"
  │──Seg 2 (seq=2) ──►│  Retransmit
  │◄── ACK 4 ─────────│  "I got up to 3, send from 4"
```

Sequence numbers are **byte offsets**, not packet numbers. Every byte has a unique position in the stream. ACK number = "I've received all bytes up to (ACK-1), send me byte ACK next."

---

## Flow Control: Sliding Window

The receiver **advertises its receive window** (rwnd) — how many bytes it can buffer. The sender cannot have more than `rwnd` bytes in-flight (sent but not yet acknowledged).

```
Sender Window (what can be in-flight simultaneously):
│ ─ ─ ─ ─ │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ ─ ─ ─ ─│
           ↑               ↑           ↑
       Sent + ACKed    Window Right    Can't send yet
       (slide left)    Edge            (beyond window)

As ACKs arrive → window slides right → more data can be sent
```

**Bandwidth-Delay Product (BDP)**:
$$BDP = Bandwidth \times RTT$$
Example: 1 Gbps link × 50ms RTT = 6.25 MB. The receive window must be at least 6.25 MB to fully utilize this link.

---

## Congestion Control

TCP infers network congestion from **packet loss** and **RTT increases**. It dynamically adjusts the **congestion window (cwnd)**:

### Phases:

```
cwnd
(MSS) 
 32 │                         *
    │                      *     *
 16 │                   *           (packets lost → fast recovery)
    │               *
  8 │           *
    │       *   ↑ threshold (ssthresh=16)
  4 │    *      Congestion Avoidance begins (+1 MSS/RTT, linear)
  2 │  *
  1 │* ← Slow Start begins (double cwnd every RTT)
    └────────────────────────────► time
```

| Phase | Trigger | Behavior |
|---|---|---|
| **Slow Start** | Connection start or timeout | cwnd doubles every RTT (exponential growth) |
| **Congestion Avoidance** | cwnd ≥ ssthresh | cwnd increases by 1 MSS per RTT (linear growth) |
| **Fast Retransmit** | 3 duplicate ACKs | Retransmit missing segment immediately (don't wait for timeout) |
| **Fast Recovery** | After fast retransmit | ssthresh = cwnd/2; cwnd = ssthresh; resume Congestion Avoidance |
| **Timeout** | No ACK within RTO | ssthresh = cwnd/2; cwnd = 1 MSS; restart Slow Start |

> **3 duplicate ACKs** mean: segment N is lost, but segments N+1, N+2, N+3 arrived. Receiver sends ACK N three times. This is a mild signal — some data got through. Perform fast recovery. A **timeout** is a severe signal — nothing is getting through — reset completely.

---

## Throughput Formula (Mathis Equation)

$$Throughput \leq \frac{MSS}{RTT} \times \frac{1}{\sqrt{packet\,loss\,rate}}$$

At 1% packet loss, 100ms RTT, 1460-byte MSS:
$$Throughput = \frac{1460}{0.1} \times \frac{1}{\sqrt{0.01}} = 14600 \times 10 = 146{,}000 \text{ bytes/s} \approx 1.4 \text{ Mbps}$$

This is why TCP performance degrades sharply with packet loss — and why UDP-based QUIC is better for high-loss links.

---

## TCP Algorithms and Options

| Algorithm / Option | Purpose | When to use |
|---|---|---|
| **Nagle's Algorithm** | Buffers small writes, combines into one segment | Enabled by default; useful for bulk transfers |
| **TCP_NODELAY** | Disables Nagle's algorithm | Interactive apps (SSH, trading, WebSockets over TCP) |
| **TCP_QUICKACK** | Sends ACKs immediately | Reduce latency for interactive traffic |
| **TCP Cubic** | Default Linux congestion control (since 2.6.19) | General purpose; good for high-bandwidth paths |
| **BBR (Bottleneck Bandwidth and RTT)** | Google's algorithm; measures actual throughput + RTT instead of inferring from loss | High-speed, long-distance links; YouTube uses it |
| **SACK (Selective ACK)** | Receiver reports which segments were received, not just the last in-order one | Reduces unnecessary retransmissions on lossy links |
| **SO_REUSEADDR** | Allow binding to a port in TIME-WAIT | High-throughput servers recycling ports quickly |

---

## MERN Dev Notes

```js
// Node.js net module — raw TCP server
const net = require('net');

const server = net.createServer((socket) => {
  console.log('Client connected:', socket.remoteAddress);
  
  socket.setNoDelay(true); // TCP_NODELAY — disable Nagle's for interactive data
  
  socket.on('data', (data) => {
    console.log('Received:', data.toString());
    socket.write('ACK: ' + data);
  });
  
  socket.on('end', () => {
    console.log('Client disconnected');
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err.message);
  });
});

server.listen(8080, () => {
  console.log('TCP server listening on port 8080');
});
```

```js
// mongoose uses TCP under the hood
// Connection pooling = multiple TCP connections reused
mongoose.connect('mongodb://localhost:27017/mydb', {
  maxPoolSize: 10,  // max 10 persistent TCP connections
  minPoolSize: 2,   // keep at least 2 alive
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,  // TCP socket idle timeout
  connectTimeoutMS: 10000  // TCP connection timeout
});
```

**Key TCP behaviors affecting Node.js apps:**
- `keep-alive` on HTTP connections in Node.js's `http.Agent` reuses TCP connections (avoids 3-way handshake per request)
- `http.globalAgent.maxSockets = 50` — max concurrent TCP connections per host
- Socket pools in connection strings (`maxPoolSize`) manage TCP connection lifecycle

---

## Real-World Examples

**Netflix**
- Uses TCP for video manifest fetching and API calls (reliability required).
- Adaptive bitrate (ABR) switching uses TCP throughput measurement to select video quality.
- Deployed BBR congestion control across servers serving 200M+ users.

**Stripe**
- All payment API calls use HTTP over TCP. Reliability non-negotiable for financial data.
- TLS over TCP — data in transit encrypted; any tampering detected by TCP checksum + TLS MAC.

**Slack**
- WebSocket connections run over TCP. Message ordering guaranteed by TCP sequence numbers.
- Per-message ACKs at the application layer (Slack's own protocol) on top of TCP's byte-level delivery.

---

## Interview Cheat Sheet

**Q: Explain the TCP three-way handshake and why it takes 1 RTT.**
A: SYN (client→server) → SYN-ACK (server→client) → ACK (client→server). The client and server exchange sequence numbers to synchronize state. The full handshake requires one round-trip time before any data can flow. This is why HTTP/3 with QUIC is faster — QUIC combines the crypto handshake with connection setup, achieving 1 RTT for new connections and 0 RTT for repeat connections.

**Q: What is the difference between flow control and congestion control?**
A: Flow control prevents the **sender from overwhelming the receiver** — the receiver advertises its receive window (rwnd), and the sender can't have more bytes in-flight than rwnd. Congestion control prevents the **sender from overwhelming the network** — the sender maintains a congestion window (cwnd) based on observed packet loss and RTT. The effective send window is `min(rwnd, cwnd)`.

**Q: What is slow start and why is it called "slow" despite exponential growth?**
A: Slow start begins with cwnd = 1 MSS (one segment) — much slower than "full speed." The cwnd doubles every RTT (exponential growth, e.g. 1 → 2 → 4 → 8 MSS), which is fast growth, but the name refers to starting small rather than blasting the network immediately. "Slow" compared to immediately sending at maximum rate. It continues until cwnd reaches ssthresh (slow start threshold), after which linear Congestion Avoidance begins.

**Q: What happens when 3 duplicate ACKs arrive vs a timeout?**
A: 3 duplicate ACKs trigger **fast retransmit** — retransmit the missing segment immediately without waiting for a timeout. Then **fast recovery** — ssthresh = cwnd/2, cwnd = ssthresh, continue Congestion Avoidance (don't reset to Slow Start). This is a **mild congestion signal** because later segments still arrived. A **timeout** means nothing is getting through — far more severe. The sender resets cwnd = 1 MSS and restarts Slow Start from scratch. Timeouts cause dramatically worse performance than fast retransmit.

**Q: What is the Bandwidth-Delay Product and why does it matter?**
A: BDP = Bandwidth × RTT. It represents how many bytes can be "in flight" (sent but not yet ACKed) on a fully utilized link. The TCP receive window must be at least the BDP to fully utilize the link. On a 1 Gbps link with 100ms RTT, BDP = 12.5 MB. If the receive window is limited to 64KB (the old TCP default), maximum throughput is 64KB / 0.1s = 5.12 Mbps — only 0.5% utilization of a gigabit link. TCP window scaling (RFC 1323) extends the window to 1 GB.

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **TCP (Transmission Control Protocol)** | Connection-oriented, reliable, ordered, full-duplex transport protocol |
| **Three-Way Handshake** | SYN → SYN-ACK → ACK: connection establishment sequence that synchronizes sequence numbers |
| **Four-Way Termination** | FIN → ACK → FIN → ACK: graceful connection shutdown |
| **SYN** | Synchronize flag: initiates a connection, carries initial sequence number |
| **ACK** | Acknowledgement flag: confirms receipt of bytes up to (ACK number - 1) |
| **FIN** | Finish flag: signals sender has no more data to send |
| **Sequence Number** | Byte offset of the first byte in a TCP segment — used for ordering and deduplication |
| **Acknowledgement Number** | "I've received all bytes up to here; send me this byte next" |
| **Segment** | The unit of TCP data transmission (a TCP packet) |
| **MSS (Maximum Segment Size)** | Largest amount of data that can be sent in a single TCP segment (typically 1460 bytes) |
| **RTT (Round-Trip Time)** | Time for a message to travel from sender to receiver and back |
| **Sliding Window** | Flow control mechanism: receiver advertises buffer space, sender stays within it |
| **rwnd (Receive Window)** | Advertised by receiver: how many bytes it can buffer |
| **cwnd (Congestion Window)** | Maintained by sender: estimate of network capacity |
| **Slow Start** | TCP congestion control phase: cwnd doubles every RTT starting from 1 MSS |
| **ssthresh (Slow Start Threshold)** | When cwnd reaches ssthresh, switch from Slow Start to Congestion Avoidance |
| **Congestion Avoidance** | TCP phase: cwnd increases linearly (+1 MSS per RTT) after reaching ssthresh |
| **Fast Retransmit** | Retransmit lost segment on 3 duplicate ACKs, without waiting for timeout |
| **Fast Recovery** | After fast retransmit: ssthresh = cwnd/2; cwnd = ssthresh; resume Congestion Avoidance |
| **RTO (Retransmission Timeout)** | How long TCP waits before assuming a segment was lost and retransmitting |
| **TIME-WAIT** | Post-close state lasting 2 minutes to prevent stale packets from interfering with new connections |
| **Nagle's Algorithm** | Buffers small TCP writes into fewer, larger segments. Disabled with TCP_NODELAY |
| **Bandwidth-Delay Product (BDP)** | Bandwidth × RTT = bytes that can be in-flight on a fully utilized link |
| **BBR (Bottleneck Bandwidth and RTT)** | Google's congestion algorithm: probes actual bottleneck bandwidth + RTT instead of inferring from loss |
| **BDP (Bandwidth-Delay Product)** | The "pipe size" — bytes in transit on a fully utilized link: Bandwidth × RTT |
| **SACK (Selective Acknowledgement)** | Extension allowing receiver to report non-contiguous received segments, reducing retransmissions |
| **SYN Flood** | DoS attack: sends many SYN packets without completing handshakes to exhaust server resources |
| **SYN Cookie** | Defense against SYN floods: server encodes state in sequence number, allocates nothing until ACK |
