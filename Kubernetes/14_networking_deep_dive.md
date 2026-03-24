# Networking Deep Dive — CNI, kube-proxy, DNS, MTU, Routing
> **Focus:** Most rejections happen here. Understand the full packet path.

---

## ELI5 — Explain Like I'm 5

Imagine Kubernetes networking as a **city postal system**.

- Each **pod** has its own house with a unique address (IP). Even on the same street (node), every house has its own mailbox.
- The **CNI plugin** is the city planner. It builds the roads (virtual network interfaces) and assigns addresses. Different CNI plugins build the roads differently (Flannel builds flat roads, Calico builds roads with traffic rules/NetworkPolicy enforcement).
- **kube-proxy** is the post office directory. When you write "To: myapp-service", the post office looks up which actual house addresses (pod IPs) are in that service and translates the address on the envelope.
- **CoreDNS** is the phone book. You ask "what's the IP of myapp-service?" and it tells you.
- **MTU issues** = If the post office tries to fit a giant package through a small mail slot, it has to cut the package into smaller pieces (fragmentation) — or the delivery fails entirely.

---

## Kubernetes Networking Fundamental Rules

Kubernetes enforces a flat network model. These are the 3 rules every CNI must implement:

```
1. Every pod gets a unique IP address
2. Pods on any node can communicate with any other pod WITHOUT NAT
3. Agents on a node (kubelet, kube-proxy) can communicate with all pods on that node
```

This means: **pod-to-pod communication is always direct, no NAT in the middle**.

---

## Network Layers

```
Application Layer   → Your app (port 8080)
Service Layer       → kube-proxy / iptables / IPVS
CNI Layer           → Pod networking, cross-node routing
Node Network        → Physical/virtual NICs, underlying infrastructure
```

---

## CNI (Container Network Interface)

CNI is a **specification** + **plugin system**. When kubelet creates a pod, it calls the CNI plugin to:
1. Create a network namespace for the pod
2. Create a veth pair (virtual ethernet): one end in pod's namespace, other on host
3. Assign an IP to the pod
4. Set up routing so the pod can reach other pods and services

### How pod gets its IP

```
Node has a pod CIDR: 10.244.1.0/24 (assigned by node controller)

CNI plugin assigns from this range:
  Pod 1: 10.244.1.2
  Pod 2: 10.244.1.3
  Pod 3: 10.244.1.4
  ...
```

Each node gets its own `/24` (256 addresses) carved from the cluster CIDR (`10.244.0.0/16`).

### Popular CNI Plugins

| Plugin | Cross-node routing | NetworkPolicy | Performance | Use case |
|---|---|---|---|---|
| **Flannel** | VXLAN overlay (tunnels) | No (needs Calico) | Medium | Simple setups |
| **Calico** | BGP (pure L3) or VXLAN | Yes (native) | High | Production |
| **Cilium** | eBPF (no iptables) | Yes (L7 too) | Very High | Advanced, security-focused |
| **Weave** | Mesh overlay | Yes | Medium | Multi-cloud |
| **AWS VPC CNI** | Native VPC routing | Via Security Groups | Very High | EKS |

---

## Cross-Node Pod Communication

### Flannel (VXLAN overlay):
```
Pod A (10.244.1.5) on Node 1
    → veth pair → flannel0 bridge → VXLAN encapsulation
    → UDP packet (outer IP: Node 1 → Node 2, port 8472)
    → Node 2 receives, decapsulates
    → Routes to Pod B (10.244.2.5) via veth
```

### Calico (BGP routing):
```
Pod A (10.244.1.5) on Node 1
    → veth pair → Node 1 routing table
    → BGP route: "10.244.2.0/24 is reachable via Node 2"
    → IP packet sent directly to Node 2 (no encapsulation)
    → Node 2 routes to Pod B
```

BGP is more efficient (no overhead), but requires L2 adjacency or BGP peering between nodes.

---

## kube-proxy

Runs on every node. Watches the API server for Service and Endpoint changes. Translates Service IPs → Pod IPs.

### Three modes:

**1. userspace (legacy, do not use):**
- Intercepts traffic via iptables → forwards to userspace proxy → forwards to pod
- Very slow (kernel/userspace context switching)

**2. iptables (default):**
- Programs iptables PREROUTING/OUTPUT chains with DNAT rules
- All translation happens in kernel space
- For a service with 3 backends: random selection via statistic module

```bash
# See the iptables rules kube-proxy creates
iptables -t nat -L KUBE-SERVICES
iptables -t nat -L KUBE-SVC-<hash>    # per-service chain
iptables -t nat -L KUBE-SEP-<hash>    # per-endpoint (pod) chain
```

**3. IPVS (preferred for large clusters):**
- Uses Linux Virtual Server (netfilter hooks but kernel hash table, not linear rules)
- O(1) lookup vs iptables O(n) — critical at 10,000+ services
- Supports more load balancing algorithms: rr, lc, dh, sh, sed, nq

```yaml
# kube-proxy config to enable IPVS
kind: KubeProxyConfiguration
mode: "ipvs"
ipvs:
  scheduler: "rr"   # round-robin
```

---

## DNS in Kubernetes (CoreDNS)

CoreDNS runs as a Deployment in `kube-system`. Every pod uses it as its DNS resolver (injected via `/etc/resolv.conf`).

### DNS record pattern:
```
<service-name>.<namespace>.svc.<cluster-domain>

Examples:
  myapp.default.svc.cluster.local        → ClusterIP
  db.production.svc.cluster.local        → ClusterIP

Headless service (ClusterIP: None):
  myapp.default.svc.cluster.local        → returns all pod IPs (A records)
  pod-0.myapp.default.svc.cluster.local  → individual pod (StatefulSet)
```

### DNS search domains (in pod's /etc/resolv.conf):
```
search default.svc.cluster.local svc.cluster.local cluster.local
nameserver 10.96.0.10   (CoreDNS ClusterIP)
```

This means `curl myapp` resolves to `myapp.default.svc.cluster.local` automatically.

### DNS Resolution Steps:
```
Pod A tries to resolve "redis"
  1. Check /etc/hosts
  2. Query CoreDNS (10.96.0.10)
  3. CoreDNS checks: redis.default.svc.cluster.local → found → returns ClusterIP
  4. Pod sends traffic to ClusterIP → kube-proxy translates → pod IP
```

### ndots setting:
```
Pod /etc/resolv.conf: options ndots:5
```
If the name has fewer than 5 dots, try search domains first before treating as absolute. This causes **5 DNS lookups for every external hostname** (a real performance issue).

```bash
# Debug DNS
kubectl exec -it mypod -- nslookup redis
kubectl exec -it mypod -- cat /etc/resolv.conf
kubectl logs -n kube-system -l k8s-app=kube-dns    # CoreDNS logs
```

---

## MTU and Packet Drops

**MTU (Maximum Transmission Unit)** = maximum size of a packet in bytes.

Typical values:
```
Physical ethernet:     1500 bytes
VXLAN overhead:        50 bytes → effective pod MTU: 1450 bytes
WireGuard overhead:    80 bytes → effective pod MTU: 1420 bytes
GRE overhead:          42 bytes → effective pod MTU: 1458 bytes
```

### The MTU mismatch problem:
```
Pod sends 1500-byte packet
CNI adds VXLAN header → 1550 bytes
Host NIC MTU: 1500 bytes → packet is TOO LARGE
Options:
  a) Fragment (slow, stateful)
  b) Drop with ICMP "fragmentation needed" → TCP MSS clamping fixes this
  c) Correct: set pod MTU to 1450 from the start
```

### Symptoms of MTU issues:
- Small requests work fine
- Large payloads (file uploads, big responses) hang or fail
- Connection established but no data transfer
- TCP handshake succeeds (small packets), data transfer fails (large packets)

```bash
# Check MTU on nodes
ip link show
# Check MTU inside pod
kubectl exec -it mypod -- ip link show eth0

# Test with specific packet size
kubectl exec -it mypod -- ping -M do -s 1400 10.244.2.5
# -M do = don't fragment, -s = payload size
```

---

## NetworkPolicy

Controls pod-to-pod communication. Without any NetworkPolicy, all pods can talk to all pods (flat network).

```yaml
# Default deny all ingress to pods with app=backend
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-policy
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend    # only from frontend pods
      ports:
        - port: 8080
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: database
      ports:
        - port: 5432
```

> NetworkPolicy is enforced by the **CNI plugin** (not kube-proxy). Flannel alone cannot enforce NetworkPolicy. You need Calico, Cilium, or another policy-capable CNI.

---

## Interview Questions

**Q: How does a packet get from Pod A on Node 1 to Pod B on Node 2?**
A: 1) Pod A sends to Pod B's IP. 2) The routing table on Node 1 says Pod B's subnet is reachable via Node 2's IP. 3) With Flannel/VXLAN, the packet is encapsulated in UDP and sent to Node 2. 4) Node 2 decapsulates it and routes to Pod B via veth pair. With Calico/BGP, no encapsulation - the packet routes directly using L3.

**Q: Why does DNS resolution fail for some pods but not others?**
A: Common causes: 1) ndots misconfiguration causing excessive search domain lookups and hitting rate limits. 2) CoreDNS pods not running (check `kubectl get pods -n kube-system`). 3) NetworkPolicy blocking UDP 53 to CoreDNS. 4) Pod's `/etc/resolv.conf` pointing to wrong DNS IP.

**Q: What is the difference between CNI and kube-proxy?**
A: CNI handles pod-to-pod communication (L3 networking, IP assignment, cross-node routing). kube-proxy handles Service-to-pod mapping (L4 load balancing, virtual IP translation). They operate at different layers.

**Q: Your app works fine for small requests but hangs on large payloads. What do you check first?**
A: MTU mismatch. Check the effective MTU inside the pod (`ip link show eth0`) vs the CNI's expected MTU. VXLAN overlays need 50 bytes of headroom. A ping test with `ping -M do -s 1450` can confirm if large packets get dropped.

**Q: How would you restrict a pod so it can only talk to pods in the same namespace?**
A: Apply a NetworkPolicy with an ingress rule allowing only `podSelector: {}` (all pods) from the same namespace (implied by no `namespaceSelector`). Add a default-deny policy for all ingress from other sources.
