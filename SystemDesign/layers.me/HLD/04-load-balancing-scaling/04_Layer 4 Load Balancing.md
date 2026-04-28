# Layer 4 Load Balancing

> **Module 4 — Load Balancing & Scaling**  
> Source: https://layrs.me/course/hld/04-load-balancing-scaling/layer-4-load-balancing

---

## ELI5 — Explain Like I'm 5

Imagine you're sorting packages at a post office.  
A **Layer 4 load balancer** reads *only the address label* (IP + port) to decide which shelf to put it on.  
It doesn't open the package (doesn't look at HTTP content).  
Because it never opens anything, it can sort thousands of packages per second — blindingly fast.

---

## Analogy

Layer 4 LB = **highway toll booth** routing cars by license plate prefix.
- Plate starts with A–M → lane 1
- Plate starts with N–Z → lane 2
- No inspection of car contents (cargo, passengers)

Layer 7 LB = **customs agent** who opens the car, inspects cargo, and routes to different
terminals based on what's inside.

---

## Core Concept

Layer 4 refers to **OSI Layer 4 — the Transport Layer**, where TCP and UDP operate.

A Layer 4 load balancer makes routing decisions based *only* on the **5-tuple**:
```
Source IP | Destination IP | Source Port | Destination Port | Protocol (TCP/UDP)
```

It does **NOT** inspect:
- HTTP headers, URLs, cookies  
- TLS payload  
- Any application-layer data

```
OSI Model Layers:
  7 — Application   (HTTP, HTTPS, FTP) ← L7 LB operates here
  6 — Presentation  (SSL/TLS)
  5 — Session
  4 — Transport     (TCP, UDP)         ← L4 LB operates here
  3 — Network       (IP routing)
  2 — Data Link     (MAC addresses)
  1 — Physical      (cables, signals)
```

---

## Architecture: Three Core Components

```
Client SYN → 203.0.113.10:443 (VIP)
                │
                ▼
┌─────────────────────────────────────────────────────┐
│  L4 Load Balancer                                   │
│                                                     │
│  1. Packet Processor                                │
│     └─ Extract 5-tuple from TCP/UDP headers         │
│                                                     │
│  2. Connection Table  (hash table, lock-free)       │
│     └─ 192.168.1.10:5000 → Server 1                 │
│     └─ 192.168.1.20:5001 → Server 2  (O(1) lookup) │
│                                                     │
│  3. NAT Engine                                      │
│     └─ DNAT: rewrite Dest IP (VIP → Server IP)     │
│     └─ SNAT: rewrite Source IP (Client → LB IP)    │
└─────────────────────────────────────────────────────┘
         │                │
         ▼                ▼
      Server 1         Server 2
   10.0.1.10:443    10.0.1.11:443
```

### NAT Modes

| Mode | What changes | Return path |
|---|---|---|
| **DNAT** (Destination NAT) | Dest IP: VIP → Server IP | Via load balancer |
| **SNAT** (Source NAT) | + Source IP: Client IP → LB IP | Forced back through LB |
| **DSR** (Direct Server Return) | Only Dest MAC (Layer 2 rewrite!) | Server responds *directly* to client, bypassing LB |

**DSR is critical for high-bandwidth scenarios** (video streaming, large files):
- LB only handles small incoming requests
- Large responses (10–100× request size) flow directly from server → client
- LB never becomes a bandwidth bottleneck at 100+ Gbps

**DSR requirement**: server must have the VIP configured as a loopback interface  
(so it accepts packets with Dest IP = VIP even though that's "not its own IP").

---

## How the Connection Table Works

```
SYN packet arrives (new connection):
  hash(5-tuple) → select backend (LB algorithm)
                → create entry: {192.168.1.10:5000 → 10.0.1.10}
                → forward packet (DNAT)

Next packet for same connection:
  hash(5-tuple) → cache hit → O(1) lookup
                → forward to same backend (session consistency)

FIN/RST received:
  → delete entry from table
```

For **UDP** (stateless protocol): LB creates pseudo-connections with 30–60 s timeout.  
Health checks are simple TCP/UDP socket tests (not HTTP endpoint calls).

---

## Performance Characteristics

| Metric | L4 LB | L7 LB |
|---|---|---|
| **Latency** | 50–500 µs | 1–5 ms (10–100× slower) |
| **Throughput** | 10–20 M packets/s, 100+ Gbps | 1–2 M packets/s, 10–20 Gbps |
| **Concurrent connections** | 10 M+ (200 bytes/entry) | 100K–1M (SSL state overhead) |
| **CPU per req** | Hash lookup + NAT rewrite | TLS handshake + HTTP parsing |

```
L4 processing pipeline:
  1. Extract 5-tuple        (~5 ns)
  2. Hash table lookup      (~50 ns)
  3. NAT header rewrite     (~5 ns)
  4. Forward packet         (~10 ns)
  Total: ~70 ns → sub-microsecond per packet

L7 processing pipeline:
  1. TCP handshake          (1-2 ms)
  2. TLS handshake          (1-3 ms)
  3. HTTP parsing           (0.1–0.5 ms)
  4. Routing decision       (~1 ms)
  Total: 3–6 ms per request
```

---

## Kernel Bypass Techniques (Advanced Perf)

Standard Linux networking: packet → kernel TCP/IP stack → context switch → userspace (~50 µs)

| Technique | What it does | Speedup |
|---|---|---|
| **DPDK** (Data Plane Development Kit) | Polls NIC directly from userspace; no kernel | 10–100× |
| **XDP** (eXpress Data Path) | eBPF programs run in kernel before networking stack | 10× |
| **Lock-free hash tables** | Per-CPU tables, no mutex contention | 5–10× |

Google Maglev uses a custom lock-free hash table with 64-byte entries (= 1 CPU cache line).  
Cloudflare Unimog uses XDP to absorb 300+ M packets/s during DDoS attacks.

---

## SYN Flood Defense

SYN floods = attacker sends millions of SYN packets without completing the TCP handshake.  
Naive LB: stores connection state for every SYN → memory exhaustion.

**SYN cookies** (Cloudflare Unimog's technique):
```
Encode connection state into the TCP sequence number (32 bits):
  seq_no = hash(src_IP, src_port, dst_IP, dst_port, timestamp, secret)
  → No state stored on SYN
  → Only when client responds with ACK + seq_no±1 is state allocated
```

---

## Scalability: Multiple L4 LB Instances

**ECMP** (Equal-Cost Multi-Path routing):
```
Router distributes packets across L4 LB instances using hash(5-tuple):
  Packet → Router → [LB1 | LB2 | LB3]    // each handles its share
```
Problem: adding/removing an LB instance remaps many 5-tuples (connections get sent to wrong LB).

**Consistent hashing across LB instances** (Google Maglev):
- Each LB instance independently builds the same mapping table using consistent hashing
- Adding/removing 1 LB instance remaps only 1/N of connections
- No shared state between LB instances needed

---

## Limitations vs Layer 7

| L4 cannot... | Why you'd need L7 |
|---|---|
| Route by HTTP path/header/cookie | Microservices with multiple URL namespaces |
| Terminate SSL (inspect encrypted payload) | Content inspection, WAF, SSL offload |
| HTTP-level health checks | Server accepts TCP but returns 500s |
| Request/response modification | Header injection, URL rewriting, compression |

---

## Two-Tier Architecture (Best of Both)

```
Internet
    │
    ▼
L4 LBs (edge)
  → 100+ Gbps throughput
  → DDoS protection (sub-ms packet drops)
  → Protocol-agnostic (HTTP, WebSocket, DB, MQTT, custom TCP)
    │
    ├──► L7 LBs (HTTP/HTTPS traffic)
    │       → Path-based routing to microservices
    │       → SSL termination
    │       → WAF
    │
    └──► Direct backends (non-HTTP: PostgreSQL, MQTT, RTMP)
```

Used by: AWS (NLB → ALB), Google Cloud Load Balancing, Netflix, Cloudflare.

---

## Real-World Examples

| System | Detail |
|---|---|
| **Google Maglev** | Software L4 LB handling all Google DC ingress; sub-50 µs P99; consistent hashing across LB cluster; lock-free hash table with 64-byte cache-line entries |
| **Cloudflare Unimog** | XDP-based; absorbs 300+ Mpps during DDoS; SYN cookies; Anycast integration |
| **HAProxy TCP mode** | 1M+ concurrent connections; used for PostgreSQL replica routing by Reddit, Stack Overflow; "seamless reload" (zero-downtime config change — old process drains, new accepts) |

---

## MERN Dev Notes

| Scenario | L4 relevance |
|---|---|
| MongoDB Atlas | Atlas internally uses L4-style TCP load balancing for connection pooling across mongos routers |
| Node.js TCP server | `net.createServer()` — can sit behind HAProxy in TCP mode |
| Production Express | Typically behind L7 (Nginx), which may sit behind L4 (AWS NLB) |
| WebSocket servers | HAProxy in TCP mode (L4) is ideal — long-lived connections, no HTTP parsing overhead |
| Database connection pool | `mongoose.connect(uri, { maxPoolSize: 10 })` — pool to the LB VIP, LB distributes across replica set |

**HAProxy TCP mode (for Node.js WebSocket)**:
```
frontend ws_frontend
  bind *:3001
  mode tcp
  default_backend ws_servers

backend ws_servers
  mode tcp
  balance leastconn
  server node1 10.0.1.10:3001 check
  server node2 10.0.1.11:3001 check
  server node3 10.0.1.12:3001 check
```

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| What does L4 LB route on? | 5-tuple: src IP, dst IP, src port, dst port, protocol |
| Why is L4 faster than L7? | No payload inspection, no TLS, just NAT + hash lookup (~70 ns vs 3–6 ms) |
| What is DSR? | LB rewrites only MAC address (L2); server responds directly to client; LB handles only inbound |
| L4 session persistence? | Source IP hash or 5-tuple hash — not cookie-based (no HTTP inspection) |
| L4 health checks? | TCP/UDP socket test only — not HTTP status codes |
| Two-tier architecture? | L4 at edge (speed/DDoS), L7 behind (intelligent routing/SSL) |

**Red flags**:
- "L4 can route by URL / HTTP header" — that requires L7
- "DSR works everywhere" — needs server loopback VIP config, same L2 network
- "L4 persistence works for mobile users" — source IP changes when switching networks
- "L4 can do advanced health checks" — it only tests TCP connectivity

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **OSI Layer 4** | Transport Layer — TCP and UDP protocols |
| **5-tuple** | (src IP, dst IP, src port, dst port, protocol) — full connection identifier |
| **VIP** (Virtual IP) | IP address owned by the load balancer, not any single server |
| **DNAT** (Destination NAT) | Rewriting destination IP of packet from VIP to real server IP |
| **SNAT** (Source NAT) | Rewriting source IP so return traffic is forced through LB |
| **DSR** (Direct Server Return) | Only Layer 2 (MAC) rewrite; servers respond directly to clients |
| **Connection table** | Hash table in LB mapping 5-tuple → backend server |
| **DPDK** (Data Plane Development Kit) | Userspace networking to bypass Linux kernel stack for maximum speed |
| **XDP** (eXpress Data Path) | eBPF-based packet processing in kernel, before TCP/IP stack |
| **ECMP** (Equal-Cost Multi-Path) | Router-level distribution of packets across multiple L4 LB instances |
| **Maglev** | Google's software L4 load balancer with consistent hashing |
| **SYN cookie** | TCP sequence number encodes state, preventing SYN-flood memory exhaustion |
