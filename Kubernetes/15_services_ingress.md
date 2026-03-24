# Services & Ingress — Deep Theory
> **Focus:** Traffic path from LoadBalancer to Pod. ClusterIP, NodePort, LoadBalancer, Ingress internals.

---

## ELI5 — Explain Like I'm 5

Imagine your pods are employees working in different rooms of an office building.

- **ClusterIP** = An internal phone extension. Only people inside the office building can call it. "Dial 5432 for the database team." The operator (kube-proxy) figures out which actual person (pod) picks up.
- **NodePort** = A direct phone number that rings into the building on a specific port. Anyone on the internet can call `<building-address>:30080` and get routed inside.
- **LoadBalancer** = The company's main public number. An external receptionist (cloud load balancer - AWS ALB, Azure LB) answers and routes calls to the building's NodePorts.
- **Ingress** = The switchboard operator with smart routing rules: "If you ask for /api, I'll route to the backend team. If you ask for /dashboard, I'll route to the frontend team. And I handle TLS certificates too."

---

## How kube-proxy Makes Services Work

When you create a Service, kube-proxy on every node programs iptables/IPVS rules to intercept traffic destined for that Service's ClusterIP and route it to one of the healthy backing pods.

```
Service created → API server notified
EndpointSlice controller creates EndpointSlice (list of pod IPs)
kube-proxy on each node WATCHES EndpointSlices
kube-proxy updates iptables/IPVS rules
```

**Key insight:** The ClusterIP is a **virtual IP** — no process actually listens on it. It only exists as an iptables DNAT rule that intercepts packets and rewrites the destination.

---

## Service Types

### 1. ClusterIP (default)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  type: ClusterIP          # only reachable within cluster
  selector:
    app: myapp
  ports:
    - port: 80             # service port (what callers use)
      targetPort: 8080     # container port (where app listens)
```

**Traffic path:**
```
Pod A → ClusterIP:80
  iptables DNAT → random pod IP:8080
  → Pod B
```

**ClusterIP = None (Headless Service):**
```yaml
spec:
  clusterIP: None   # no virtual IP assigned
```
DNS returns all pod IPs directly. Used by StatefulSets for stable pod DNS names.

---

### 2. NodePort

```yaml
spec:
  type: NodePort
  ports:
    - port: 80
      targetPort: 8080
      nodePort: 30080    # range: 30000-32767 (configurable)
```

**Traffic path:**
```
External client → <any-node-IP>:30080
  iptables → DNAT to pod IP:8080 (pod can be on ANY node)
  → Pod
```

> **Important:** Traffic can arrive on Node 1, but be forwarded to a pod on Node 2. This is an extra network hop. To avoid this (prefer local pods), set `externalTrafficPolicy: Local`.

```yaml
spec:
  externalTrafficPolicy: Local   # only route to pods on THIS node
  # Tradeoff: if no pod on this node, connection drops (uneven distribution)
```

---

### 3. LoadBalancer

```yaml
spec:
  type: LoadBalancer
```

**What happens:**
1. Kubernetes creates a NodePort service
2. Cloud controller manager provisions a cloud load balancer (AWS ELB/ALB, GCP, Azure)
3. Cloud LB is configured to send traffic to all nodes on the NodePort
4. Returns external IP in `status.loadBalancer.ingress[0].ip`

**Traffic path:**
```
Internet → Cloud LB (public IP)
  → All nodes on NodePort 30080
  → kube-proxy → DNAT → Pod
```

**Cost:** Every LoadBalancer Service = 1 cloud load balancer = $$$. That's why Ingress exists.

---

### 4. ExternalName

```yaml
spec:
  type: ExternalName
  externalName: my-database.rds.amazonaws.com
```

DNS returns a CNAME. No proxying. Used to give cluster-internal DNS names to external services.

---

## Service — EndpointSlice Internals

```
Service (selector: app=myapp)
    ↓ EndpointSlice controller
EndpointSlice: [10.244.1.5:8080, 10.244.2.3:8080, 10.244.3.7:8080]
    ↓ kube-proxy watches
iptables rules on every node
```

When a pod fails its readiness probe:
```
1. Readiness probe fails → kubelet updates pod condition Ready=False
2. EndpointSlice controller removes pod from EndpointSlice
3. kube-proxy detects change → updates iptables
4. No new traffic routed to failing pod
```

This is why readiness probes are critical for zero-downtime deployments.

```bash
kubectl get endpointslices
kubectl get endpointslices myapp -o yaml
```

---

## Ingress

A single entry point for HTTP/HTTPS traffic with routing rules. Requires an **Ingress Controller** to implement.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - myapp.example.com
      secretName: myapp-tls-cert      # TLS cert stored as Secret
  rules:
    - host: myapp.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 80
```

---

## Ingress Controllers

An Ingress object is just config — you need an Ingress Controller to act on it:

| Controller | Basis | Features |
|---|---|---|
| **NGINX Ingress** | nginx | Most common, highly configurable |
| **Traefik** | Go | Auto-discovery, Let's Encrypt built-in |
| **AWS ALB Ingress** | AWS ALB | Native ALB integration |
| **HAProxy** | haproxy | High-performance |
| **Contour** | Envoy | gRPC, HTTP/2 |

**How NGINX Ingress Controller works:**
```
1. Ingress Controller pod runs nginx inside
2. Watches Kubernetes Ingress objects via API server watch
3. When Ingress changes → regenerates nginx.conf
4. nginx reloads (or hot reloads with Lua)
5. Traffic arrives → nginx proxies to Service ClusterIP → pod
```

---

## Full Traffic Path: LB → Ingress → Service → Pod → App

```
Internet request: https://myapp.example.com/api/users

Step 1: Cloud Load Balancer (AWS ALB)
  → Receives on port 443
  → Terminates TLS (or passes through)
  → Forwards to NodePort 30443 on any cluster node

Step 2: kube-proxy on Node
  → NodePort 30443 → ClusterIP of ingress-nginx Service
  → DNAT to ingress-nginx controller pod IP

Step 3: NGINX Ingress Controller Pod
  → Receives raw HTTP (TLS already terminated, or terminates here)
  → Matches rule: host=myapp.example.com, path=/api
  → Proxies to api-service:80 (ClusterIP of api-service)

Step 4: kube-proxy again
  → api-service ClusterIP:80 → DNAT
  → Random healthy pod IP:8080 (from EndpointSlice)

Step 5: Application Pod
  → Receives request on port 8080
  → Processes and responds

Return path:
  Pod → kube-proxy (reverse DNAT) → NGINX → LB → client
```

---

## Session Affinity

By default, kube-proxy distributes requests randomly. For sticky sessions:

```yaml
spec:
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800    # 3 hours
```

> This uses source IP hashing in iptables/IPVS. Works at L4. For cookie-based stickiness (L7), use Ingress annotations.

---

## Common Failure Patterns

**Service has no endpoints:**
```bash
kubectl get endpoints myapp
# NAME    ENDPOINTS   AGE
# myapp   <none>      5m   ← bad!

# Diagnose: does the selector match any pods?
kubectl get pods -l app=myapp
kubectl describe service myapp   # check selector
```

**Connection refused vs connection timed out:**
```
Connection refused = reached the pod/node, nothing listening (wrong port, app crashed)
Connection timed out = packet dropped (NetworkPolicy, iptables issue, pod not scheduled)
```

---

## Interview Questions

**Q: How does a Service know which pods to route traffic to?**
A: The Service has a `selector` field. The EndpointSlice controller watches for pods matching that selector and builds an EndpointSlice containing the IPs of pods that are both Running AND have a passing readiness probe. kube-proxy programs iptables/IPVS rules based on that EndpointSlice.

**Q: What is the difference between ClusterIP and Headless service?**
A: ClusterIP has a virtual IP; DNS returns that single IP, and kube-proxy load-balances to pods. Headless (ClusterIP: None) has no virtual IP; DNS returns the actual pod IPs directly. Headless is used by StatefulSets so clients can reach specific pods by name.

**Q: Why is the LoadBalancer type expensive in cloud environments?**
A: Each LoadBalancer Service provisions a dedicated cloud load balancer. In AWS, that's one ELB per service. Ingress solves this by routing all external traffic through a single load balancer with an in-cluster Ingress Controller handling path-based routing.

**Q: What happens when a pod fails its readiness probe during a rolling update?**
A: The EndpointSlice controller removes the failing pod from the EndpointSlice. kube-proxy updates iptables — no traffic reaches it. The Deployment controller stops the rollout (because it respects `minAvailable`). The old pods stay running. The failing pod is not restarted by the Deployment — that's the liveness probe's job.

**Q: Trace the packet path for `curl http://myapp-service` from inside a pod.**
A: 1) DNS lookup: resolves `myapp-service.namespace.svc.cluster.local` → ClusterIP via CoreDNS. 2) Pod sends TCP SYN to ClusterIP:80. 3) iptables PREROUTING chain intercepts, DNAT rewrites destination to a pod IP:targetPort. 4) Packet routed to target pod (same node: via veth; different node: via CNI routing). 5) Response travels back (connection tracking handles reverse NAT).
