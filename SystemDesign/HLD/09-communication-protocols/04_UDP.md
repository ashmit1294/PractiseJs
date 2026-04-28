# 04 — UDP

> **Module**: M9 — Communication Protocols  
> **Source**: https://layrs.me/course/hld/09-communication-protocols/udp  
> **Difficulty**: Intermediate | **Read time**: ~10 min

---

## ELI5

UDP is like **shouting across a crowded room**. You yell your message and keep walking — you don't turn around to check if anyone heard. Some people might catch it, some might not. It's fast and simple, but **no guarantees**.

TCP is like having a conversation: "Did you hear me?" "Yes!" "Okay, now..." — slower, but nothing gets missed.

---

## Analogy

**UDP = Sending postcards**
- Drop the postcard in any mailbox, walk away immediately
- No ticket, no tracking, no confirmation
- Postcard might arrive, might be lost, might arrive out of order
- But you can send 100 postcards in the time it takes to send 1 registered letter

**TCP = Registered mail with delivery confirmation**
- Post office tracks every step, requires signature on delivery
- Guaranteed to arrive or you're notified of failure
- But takes much longer per letter

---

## Core Concept

UDP (User Datagram Protocol) is a connectionless, unreliable, unordered transport protocol. It provides the minimum necessary service: send a datagram from source to destination with a checksum for error detection.

**What UDP guarantees**: data integrity on arrival (via checksum) — and nothing else.

**What UDP does NOT provide**:
- ❌ Delivery guarantee (no retransmissions)
- ❌ Ordering (datagrams may arrive out of order)
- ❌ Deduplication (duplicates may arrive)
- ❌ Congestion control (will saturate the network if you let it)
- ❌ Flow control (will overwhelm the receiver if unchecked)
- ❌ Connection state (no handshake, no teardown)

---

## UDP Header (8 bytes)

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
├───────────────────────┬───────────────────────┤
│    Source Port (16)   │ Destination Port (16) │
├───────────────────────┼───────────────────────┤
│      Length (16)      │    Checksum (16)       │
├───────────────────────┴───────────────────────┤
│                   Data ...                     │
└───────────────────────────────────────────────┘
```

| Field | Size | Purpose |
|---|---|---|
| Source Port | 16 bits | Sender's port (optional, 0 if not needed) |
| Destination Port | 16 bits | Receiver's port |
| Length | 16 bits | Total length of UDP header + data (min 8 bytes) |
| Checksum | 16 bits | Error detection (optional in IPv4, mandatory in IPv6) |

**Comparison with TCP**: TCP header is 20-60 bytes (options). UDP is fixed 8 bytes. Every byte matters at millions of messages/second.

---

## UDP vs TCP Comparison

| Dimension | UDP | TCP |
|---|---|---|
| **Connection** | Connectionless — no handshake | Connection-oriented — 3-way handshake |
| **Reliability** | Unreliable — no guarantees | Reliable — ACKs, retransmissions |
| **Ordering** | No — datagrams may arrive out of order | Yes — TCP guarantees order |
| **Speed** | Faster — no setup overhead | Slower — connection + ACK overhead |
| **Header Size** | 8 bytes | 20-60 bytes |
| **Congestion Control** | None | Yes (Slow Start, AIMD) |
| **Flow Control** | None | Yes (sliding window) |
| **Latency** | Lower | Higher (handshake + ACKs) |
| **Use Cases** | Video, gaming, DNS, voice | Web, email, file transfer, databases |

---

## IP Fragmentation Danger

UDP datagrams that exceed the network's **MTU (Maximum Transmission Unit, typically 1500 bytes)** get fragmented by IP into multiple packets.

```
┌──────────────────────────────────────────────────────┐
│  Large UDP Datagram (e.g., 4000 bytes)               │
└──────────────────────────────────────────────────────┘
              IP Fragmentation at MTU=1500
    ↓              ↓              ↓
┌─────────┐  ┌─────────┐  ┌─────────┐
│Fragment1│  │Fragment2│  │Fragment3│
│ 1480B   │  │ 1480B   │  │ 1040B   │
└─────────┘  └─────────┘  └─────────┘
```

**Problem**: If ANY fragment is lost, the **entire datagram is dropped**. There's no mechanism to request only the missing fragment. The application receives nothing.

**Rule of thumb**: Keep UDP payloads ≤ **1400 bytes** (leaves room for IP + UDP headers + tunneling overhead). This avoids fragmentation entirely.

---

## Building Reliability on Top of UDP

When you need some reliability but can't tolerate TCP's latency, implement it yourself in the application layer:

| Technique | What it adds | Example |
|---|---|---|
| **Sequence numbers** | Detect out-of-order, detect loss | WebRTC data channels |
| **Selective ACKs** | Acknowledge specific received chunks | Custom game protocols |
| **Forward Error Correction (FEC)** | Recover from loss without retransmission | Video streaming (redundant data) |
| **Redundancy / duplication** | Send same data on multiple paths | Video conferencing |
| **QUIC** | Full reliability + TLS + multiplexing on UDP | HTTP/3 |
| **WebRTC** | Browser P2P with optional reliability | Video calls, data channels |

---

## UDP Security Risk: Amplification Attacks

```
Attacker                 DNS Server              Victim
   │──Spoofed UDP (src=Victim IP)──►│
   │   small query (40 bytes)        │
   │                                 │──── Large response (4000 bytes) ────► Victim
   │                                 │     Amplification factor: 100x        (overwhelmed)
```

**How it works**:
1. Attacker sends UDP request with **spoofed source IP** (victim's IP)
2. Server sends large response to the victim (not the attacker)
3. Amplification factor = response size / request size (DNS: up to 100x, NTP: up to 556x)

**Why UDP enables this**: No handshake — server can't verify source IP before responding.

**Mitigations**:
- Response rate limiting (RRL) — limit responses per source IP
- Limit response sizes (DNS: truncate large responses, use EDNS with care)
- BCP38 — network-level filtering of spoofed source IPs
- DNSSEC doesn't prevent this (still amplifies)

---

## MERN Dev Notes

```js
// Node.js UDP (dgram module)
const dgram = require('dgram');

// UDP Server
const server = dgram.createSocket('udp4');

server.on('message', (msg, rinfo) => {
  console.log(`Received ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);
  // No guaranteed delivery — if this response is lost, client never knows
  const response = Buffer.from('pong');
  server.send(response, rinfo.port, rinfo.address);
});

server.bind(8080, () => {
  console.log('UDP server listening on port 8080');
});

// UDP Client
const client = dgram.createSocket('udp4');
const message = Buffer.from('ping');

// Fire and forget — no connection needed
client.send(message, 8080, 'localhost', (err) => {
  if (err) console.error(err);
  client.close(); // No graceful teardown needed
});
```

```js
// DNS lookup uses UDP under the hood
// Node.js dns module
const dns = require('dns');

// This triggers a UDP request to the DNS resolver
dns.resolve4('google.com', (err, addresses) => {
  if (err) throw err;
  console.log('IP addresses:', addresses);
  // If UDP packet lost → DNS timeout → retry
});

// For MERN apps: mongoose DNS resolution, Redis connections
// All start with UDP DNS lookups
```

**Key MERN context**:
- **Every connection** your Node.js app makes (to MongoDB, Redis, external APIs) starts with a UDP DNS lookup.
- `socket.io` uses WebSockets (TCP) by default, falls back to HTTP long polling — not raw UDP.
- If you need UDP in production Node.js apps: game servers, telemetry ingestion, IoT data collection.

---

## Real-World Examples

**Discord**
- Voice and video use UDP via WebRTC. Dropped audio frames are preferable to stuttering from retransmissions.
- Text messaging uses TCP/WebSockets — messages must arrive completely and in order.
- Same application, different protocols for different data types.

**Cloudflare DNS (1.1.1.1)**
- DNS protocol runs over UDP port 53.
- Short queries and responses (typically < 512 bytes — no fragmentation risk).
- Fallback to TCP for responses > 512 bytes (EDNS extended size) or zone transfers.
- Handles millions of UDP requests/second; TCP overhead would be prohibitive.

**Netflix Telemetry**
- Client-side playback metrics (buffer events, quality switches, errors) sent via UDP.
- If telemetry is lost: acceptable. Netflix can afford gaps in analytics data.
- TCP would add latency and overhead for low-value, high-volume telemetry.

**Gaming (any online multiplayer)**
- Player position updates sent as UDP datagrams up to 60 times/second.
- A stale position update from 16ms ago is useless — retransmitting it would cause worse lag.
- Loss is acceptable; freshness is critical.

---

## Interview Cheat Sheet

**Q: When would you choose UDP over TCP?**
A: Choose UDP when: (1) **latency matters more than completeness** — video calls, gaming, where a stale retransmission is worse than a missing frame; (2) **short request-response** — DNS queries that fit in one datagram, where re-sending the full query is cheaper than a TCP handshake; (3) **high-volume telemetry** — IoT sensor data where occasional loss is acceptable; (4) **you're building your own reliability stack** — QUIC, WebRTC. Avoid UDP for financial transactions, file transfers, or anything requiring guaranteed delivery.

**Q: How does QUIC use UDP to get TCP-like reliability?**
A: QUIC implements reliability in userspace on top of UDP. It adds: stream-level sequence numbers (not connection-level like TCP), selective ACKs, retransmissions, and congestion control (similar to Cubic/BBR). But by doing this in userspace, each QUIC stream retransmits independently — packet loss only stalls the affected stream, not all streams sharing a connection (unlike TCP where one lost packet stalls everything in that TCP connection). Plus QUIC can be updated without OS changes.

**Q: Why is UDP vulnerable to amplification attacks but TCP isn't?**
A: UDP is connectionless — the server sends responses to the source IP without verifying it matches the actual requester. An attacker can spoof a victim's IP, send a small UDP request, and the server's large response floods the victim. TCP's three-way handshake prevents this: the server sends SYN-ACK to the supposed source IP, and the attacker (who doesn't control that IP) can't complete the ACK, so no connection is established and no data is sent to the victim.

**Q: What is the MTU and why should you keep UDP payloads under 1400 bytes?**
A: MTU (Maximum Transmission Unit) is the largest IP packet a network can transmit without fragmentation — typically 1500 bytes on Ethernet. With IP header (20 bytes) + UDP header (8 bytes), payload space is ~1472 bytes. But tunneling (VPNs, GRE), VLAN tags, and other overhead can shrink this. Staying at 1400 bytes provides safety margin. If a UDP datagram is fragmented and any fragment is lost, the entire datagram is silently dropped — the application gets nothing and must retry the whole thing.

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **UDP (User Datagram Protocol)** | Connectionless, unreliable, unordered transport protocol. Minimal overhead, no delivery guarantees |
| **Datagram** | A self-contained unit of data sent over UDP, equivalent to a packet in this context |
| **Connectionless** | No handshake required before sending; each datagram is independent |
| **Checksum** | UDP's only error-detection mechanism; detects corrupted bytes on arrival |
| **MTU (Maximum Transmission Unit)** | Largest IP packet a network link can transmit without fragmentation (typically 1500 bytes) |
| **IP Fragmentation** | Splitting a large IP packet into smaller pieces to fit MTU; dangerous for UDP (lose one fragment = lose all) |
| **PMTU (Path MTU)** | The smallest MTU across all links on a path; PMTU Discovery finds it before sending large datagrams |
| **Amplification Attack** | UDP-based DoS: attacker spoofs victim IP → server sends large response to victim |
| **Source IP Spoofing** | Forging the source IP address in a UDP packet; possible because UDP has no handshake to verify identity |
| **BCP38** | Network ingress filtering: ISPs drop packets with spoofed source IPs to prevent amplification attacks |
| **QUIC** | UDP-based transport protocol implementing reliability + TLS + multiplexing in userspace; basis of HTTP/3 |
| **WebRTC** | Browser-to-browser real-time communication over UDP; adds ICE, STUN, TURN for NAT traversal |
| **Forward Error Correction (FEC)** | Sending redundant data to recover from packet loss without retransmission |
| **RTP (Real-Time Transport Protocol)** | Application protocol over UDP for audio/video; adds sequence numbers, timestamps |
| **DNS (Domain Name System)** | UDP port 53; resolves hostnames to IPs; short enough to avoid fragmentation |
| **Fire-and-forget** | Sending a message without waiting for acknowledgement or confirmation of receipt |
| **Connectionless** | No persistent state between sender and receiver; each datagram handled independently |
