# Service Discovery in Microservices: Client vs Server

> **Module 5 — Application Architecture**  
> Source: https://layrs.me/course/hld/05-application-architecture/service-discovery

---

## ELI5 — Explain Like I'm 5

Imagine your city has 200 pizza places and new ones open/close every day.  
You can't hardcode addresses — they change constantly.

**Service discovery** is like a live phone book:  
- A pizza place opens → registers itself in the book (address, hours, if it's open).  
- You browse the book to find the closest healthy pizza place.  
- A place closes → the book removes it automatically within seconds.

---

## Analogy

| | Without service discovery | With service discovery |
|---|---|---|
| Finding a restaurant | You have a printed map from last year (might be wrong) | You check Google Maps (live, real-time) |
| Instance crashes | Your app has a dead IP and requests fail | Registry detects the failure → removes the IP |
| Auto-scaling adds 50 new instances | You'd need to update configuration manually | Registry is updated automatically at startup |

---

## Core Concept

In microservices, service instances are **ephemeral** — they spin up, scale out, and get replaced constantly.  
**Service discovery** lets services find each other by **logical name**, not hardcoded IP.

```
Without discovery (breaks during scaling):
  Order Service ──► "10.0.1.42:8080" (hardcoded Payment Service IP)
  ← Instance rotates or crashes: requests fail immediately

With discovery:
  Order Service ──► "payment-service" (logical name)
  Registry resolves: [10.0.1.42:8080, 10.0.1.43:8080, 10.0.1.44:8080]
  Client picks one (healthy)
```

Three components:
1. **Service registry** — database of live, healthy instances (Consul, Eureka, etcd, Kubernetes Services)
2. **Registration** — service tells the registry it's alive and where it is
3. **Discovery** — consumer asks registry "where is the payment service?"

---

## How It Works — Full Lifecycle

### Step 1: Service Registration

When `payment-service-instance-42` starts on `10.0.1.42:8080`, it registers:
```json
{
  "Name":    "payment-service",
  "ID":      "payment-service-42",
  "Address": "10.0.1.42",
  "Port":    8080,
  "Check":   { "HTTP": "http://10.0.1.42:8080/health", "Interval": "10s" }
}
```

### Step 2: Health Checks

Consul pings `10.0.1.42:8080/health` every 10 seconds.  
After 3 consecutive failures → instance marked unhealthy → removed from discovery results.

```
Health check states:
  PASSING  → included in discovery results
  WARNING  → included (degraded)
  CRITICAL → excluded from discovery results
```

### Step 3: Client-Side Discovery (e.g., Consul + Ribbon)

The Order Service queries Consul:
```
GET /v1/health/service/payment-service?passing
→ [{ "Address": "10.0.1.42", "Port": 8080 }, ...]
```
Client library (Netflix Ribbon) picks an instance (round-robin or least-connections) and makes the call.  
On failure → retry with a different instance from the cached list.

### Step 4: Server-Side Discovery (e.g., Kubernetes)

```
Client calls: http://payment-service:8080/charge
              (logical DNS name inside cluster)

Kubernetes:
  1. CoreDNS resolves "payment-service" → ClusterIP (10.96.0.10)
  2. kube-proxy uses iptables to forward to a healthy pod IP
  3. App code never interacts with the registry at all
```

### Step 5: Instance Failure and Recovery

```
payment-service-43 crashes:
  ← Consul fails health check 3×
  ← Marks instance as CRITICAL
  ← Removes from query results (within ~30s)
  ← Order Service's next query omits 10.0.1.43
  ← Zero downtime for clients (retried with next instance)

New instance starts:
  ← Registers with Consul
  ← Passes first health check
  ← Immediately included in query results
```

---

## Variants

### Client-Side Discovery

```
  Order Service
       │
       ├──1. Query Consul/Eureka → [instance list]
       ├──2. Pick instance (own load balancing logic)
       └──3. Call gRPC directly

Examples: Netflix Eureka, HashiCorp Consul
```

**Pros**: fine-grained control (latency-aware routing, version-based routing), cache locally.  
**Cons**: every client must implement discovery logic; Eureka/Consul becomes a critical dependency.

### Server-Side Discovery

```
  Order Service
       │
       └──1. Call "payment-service" (DNS name)
               │
              LB / kube-proxy queries registry → selects healthy instance

Examples: Kubernetes Services, AWS ELB target groups, NGINX Plus
```

**Pros**: client is simple — just call a DNS name.  
**Cons**: LB is a potential bottleneck and SPOF; less routing flexibility.

### DNS-Based Discovery

Services register DNS A/SRV records. TTL must be very low (1–5s) for dynamic environments.  
Universal compatibility but slow stale detection at normal DNS TTL (30s+).

### Sidecar Registration (Consul Connect / Registrator)

A sidecar process watches for app startup/shutdown and registers/deregisters on behalf of the app. Application code is clean of discovery logic.

---

## Trade-offs

| Dimension | Client-side | Server-side |
|---|---|---|
| Client code complexity | ❌ High (implements routing/caching) | ✅ Simple (just DNS name) |
| Infrastructure complexity | ✅ Just run the registry | ❌ Need LBs + registry |
| Custom routing | ✅ Client chooses (version pinning, A/B) | ❌ LB makes the decision |
| SPOF risk | Low (clients cache) | Medium (LB is single point) |
| Best for | Polyglot env, custom logic | Platform teams, Kubernetes |

**Consistency model**:
- **Strong (Consul, etcd / Raft)**: all nodes agree on registry state; slower writes, unavailable during quorum loss
- **Eventual (Eureka)**: highly available, accepts stale data for seconds; "self-preservation mode" during partitions

**Push vs Pull health checks**:
- **Active** (registry pings service): faster failure detection; more traffic
- **Passive** (service sends heartbeats): lower registry load; slower detection

---

## Real-World Examples

| Company | System | Detail |
|---|---|---|
| **Netflix** | Eureka | Built for availability-over-consistency; clients cache registry locally; "self-preservation mode" stops expiring instances during network blip to prevent false-positive mass deregistration |
| **Airbnb** | SmartStack (Nerve + Synapse + Zookeeper + HAProxy) | Nerve registers services with Zookeeper; Synapse watches and reconfigures a local HAProxy on every host; services call `localhost:3000` → HAProxy routes to remote instance. Hybrid: client simplicity + no central LB bottleneck |
| **Amazon** | Internal service mesh | Passive heartbeat health checks to reduce load (millions of instances × active checks = enormous traffic); 15s failure detection window acceptable given redundancy |

---

## MERN Dev Notes

| Context | Implementation |
|---|---|
| Dev / Docker Compose | Use service names in `docker-compose.yml`; Docker provides DNS automatically |
| Prod / Kubernetes | Use Kubernetes Services (`payment-service.default.svc.cluster.local`) — server-side discovery built in |
| Without K8s | Use Consul or AWS Cloud Map for dynamic instance registration |
| Health endpoint | Every Express app must expose `GET /health` returning `{ status: "ok" }` with 200 |
| Circuit breaker | `opossum` wraps service calls; opens circuit after N failures |

```js
// Express health endpoint (required for service discovery health checks)
app.get('/health', (req, res) => {
  // Check DB + Redis connectivity
  const dbOk    = mongoose.connection.readyState === 1;
  const redisOk = redisClient.isReady;
  if (dbOk && redisOk) return res.json({ status: 'ok' });
  res.status(503).json({ status: 'degraded', db: dbOk, redis: redisOk });
});
```

---

## Interview Cheat Sheet

| Question | Answer |
|---|---|
| Why not just use DNS? | DNS caching (TTL 30–300s) → stale data after crash; no health checks built in |
| Client vs server-side? | Client: custom routing logic, polyglot. Server (K8s): simple clients, platform handles routing |
| Active vs passive health checks? | Active: registry pings → fast detection, more traffic. Passive: heartbeats → less load, slower detection |
| What if the registry goes down? | Clients use cached instance lists (TTL); registry cluster has 3–5 nodes (Raft quorum); fallback to DNS |
| K8s service discovery? | Kubernetes creates DNS name; CoreDNS resolves to ClusterIP; kube-proxy routes via iptables to pod |
| Self-preservation mode (Eureka)? | If >15% instances stop heartbeating (network problem, not crash), Eureka stops expiring them — prevents mass deregistration false positive |

**Red flags**:
- "Just hardcode IPs, they rarely change" — breaks with any auto-scaling
- Confusing service discovery with load balancing (complements, not same thing)
- Not mentioning health checks (registry with no health checks routes to dead instances)
- Recommending a single Consul node (SPOF)

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **Service registry** | Database tracking running service instances and their health (Consul, Eureka, etcd) |
| **Client-side discovery** | Client queries the registry and performs its own load balancing (Eureka/Ribbon) |
| **Server-side discovery** | LB queries the registry; client only calls a DNS name (Kubernetes, AWS ELB) |
| **Health check** | Periodic test confirming a service instance is alive and ready to serve traffic |
| **Self-registration** | Service instance registers itself with the registry on startup |
| **Third-party registration** | A sidecar agent registers the service (Registrator for Docker) |
| **Consul** | HashiCorp service registry supporting both DNS and HTTP API; uses Raft for consistency |
| **Eureka** | Netflix service registry; prioritizes availability; uses eventual consistency |
| **CoreDNS** | DNS server used by Kubernetes for cluster-internal service name resolution |
| **ClusterIP** | Virtual stable IP assigned to a Kubernetes Service; backed by kube-proxy routing |
| **SPOF** (Single Point Of Failure) | Component whose failure causes total outage |
| **TTL** (Time To Live) | Time before a cached DNS record expires and must be re-fetched |
