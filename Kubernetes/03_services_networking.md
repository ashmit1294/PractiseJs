# Kubernetes: Services and Networking

## How Pod Networking Works
Every Pod gets its own IP address. Pods on the same cluster can talk to each other
directly by IP. A Service is a stable "virtual IP + DNS name" that load-balances
across a set of matching Pods — even as Pods are replaced.

```
Client → Service (stable ClusterIP + DNS) → kube-proxy (iptables/IPVS) → Pod
```

---

## Service Types

| Type | Accessible From | How |
|------|----------------|-----|
| ClusterIP | Inside cluster only | Virtual IP routed by kube-proxy |
| NodePort | Outside cluster via node IP | Each node opens a port 30000-32767 |
| LoadBalancer | Outside cluster via cloud LB | Provisions AWS ELB / GCP LB / Azure LB |
| ExternalName | Inside cluster → external DNS | CNAME to an external hostname |

---

## ClusterIP — internal services

```yaml
# ClusterIP is the default. Assigns a stable virtual IP inside the cluster.
# DNS: <service>.<namespace>.svc.cluster.local
# Example: postgres.production.svc.cluster.local

apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: production
spec:
  type: ClusterIP             # default; can omit 'type'
  selector:
    app: api                  # routes to all Pods with label app=api
  ports:
    - name: http
      port: 80                # port clients use (service port)
      targetPort: 3000        # port on the Pod (container port)
      protocol: TCP
```

---

## NodePort — simple external access (dev/testing)

```yaml
# NodePort opens port 30080 on EVERY node. Not for production — exposes raw node IPs.
apiVersion: v1
kind: Service
metadata:
  name: api-nodeport
spec:
  type: NodePort
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 3000
      nodePort: 30080         # fixed port on each node (30000-32767 range)
                              # accessible at http://<any-node-ip>:30080
```

---

## LoadBalancer — production external access

```yaml
# Provisions a cloud load balancer (AWS NLB/ALB, GCP LB, Azure LB).
# The cloud controller assigns an external IP / DNS hostname.
apiVersion: v1
kind: Service
metadata:
  name: api-lb
  namespace: production
  annotations:
    # AWS-specific: use NLB (Network Load Balancer) instead of CLB
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    # Azure-specific: use internal LB (within VNet, no public IP)
    # service.beta.kubernetes.io/azure-load-balancer-internal: "true"
spec:
  type: LoadBalancer
  selector:
    app: api
  ports:
    - port: 443
      targetPort: 3000
  # Optional: restrict which source IPs can reach this LB
  loadBalancerSourceRanges:
    - 10.0.0.0/8
    - 203.0.113.0/24
```

---

## Ingress — HTTP routing (one LB for many services)

```yaml
# Ingress handles HTTP/HTTPS routing at layer 7 (host + path based).
# Requires an Ingress Controller (nginx, Traefik, AWS ALB, etc.)
#
# Instead of one LoadBalancer per Service (expensive!), one Ingress LB
# routes to many services based on hostname and path.
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: main-ingress
  namespace: production
  annotations:
    # Tell nginx ingress to use cert-manager for TLS
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    # Rewrite /api/v1 prefix before forwarding to backend
    nginx.ingress.kubernetes.io/rewrite-target: /$2
    # Rate limit: 100 requests per minute per IP
    nginx.ingress.kubernetes.io/limit-rpm: "100"
spec:
  ingressClassName: nginx              # which Ingress Controller to use

  # TLS termination — cert-manager auto-fetches Let's Encrypt certificate
  tls:
    - hosts:
        - myapp.example.com
      secretName: myapp-tls            # cert stored in this Secret

  rules:
    - host: myapp.example.com
      http:
        paths:
          - path: /api(/|$)(.*)         # matches /api and /api/anything
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80

          - path: /                     # catch-all: everything else → frontend
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80
```

---

## DNS in Kubernetes

```bash
# Pods communicate using Service DNS names — no hard-coded IPs needed
# Full DNS format: <service>.<namespace>.svc.cluster.local

# Same namespace (short form works)
curl http://api/healthz

# Cross-namespace (must use full form)
curl http://api.production.svc.cluster.local/healthz

# Pods in same namespace can use just the service name
# like 'postgres' — resolves to postgres.production.svc.cluster.local automatically
DATABASE_URL=postgresql://postgres:5432/myapp

# StatefulSet Pod DNS (stable per-pod DNS):
# <pod-name>.<headless-service>.<namespace>.svc.cluster.local
# postgres-0.postgres.production.svc.cluster.local
# postgres-1.postgres.production.svc.cluster.local
```

---

## NetworkPolicy — firewall rules for Pods

```yaml
# By default, all Pods can talk to all other Pods (no firewall).
# NetworkPolicy creates iptables rules to restrict traffic.
# IMPORTANT: requires a CNI plugin that supports NetworkPolicy
# (Calico, Cilium, Weave Net — NOT Flannel alone)

# Allow the api Pod to receive traffic ONLY from the frontend Pod
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api               # THIS policy applies to Pods with app=api

  policyTypes:
    - Ingress                # restrict incoming traffic
    - Egress                 # restrict outgoing traffic

  ingress:
    # Allow from the frontend Pod (same namespace)
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 3000

    # Allow from monitoring namespace (Prometheus scraping)
    - from:
        - namespaceSelector:
            matchLabels:
              name: monitoring
      ports:
        - protocol: TCP
          port: 3000

  egress:
    # Allow api to talk to postgres (same namespace)
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432

    # Allow DNS resolution (required for any hostname lookups)
    - to: []
      ports:
        - protocol: UDP
          port: 53
```

---

## Headless Service + StatefulSet DNS

```yaml
# Headless Service (clusterIP: None) returns Pod IPs directly instead of a
# virtual IP. Used by StatefulSets.
# Each Pod gets its own DNS: <pod>.<svc>.<ns>.svc.cluster.local
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: production
spec:
  clusterIP: None             # headless — no virtual IP
  selector:
    app: redis
  ports:
    - port: 6379

# Redis Cluster nodes can now address each other as:
# redis-0.redis.production.svc.cluster.local
# redis-1.redis.production.svc.cluster.local
```

---

## ExternalName Service — connect to external services

```yaml
# Allows internal code to use a K8s DNS name but actually connect to an external host.
# Useful when migrating: cluster code always uses 'database', but now 'database' 
# can point to AWS RDS or an in-cluster pod without changing application code.
apiVersion: v1
kind: Service
metadata:
  name: database              # internal name
  namespace: production
spec:
  type: ExternalName
  externalName: mydb.abc123.us-east-1.rds.amazonaws.com   # redirects here
  # No selector — this is just a CNAME
```

---

## Interview Questions

**Q: What is a Kubernetes Service and why is it needed?**
> Pods are ephemeral — they get new IPs every time they restart. A Service provides a stable virtual IP and DNS name that always routes to the current healthy Pods via label selector. Without a Service, clients would have to track Pod IPs manually.

**Q: What is the difference between ClusterIP, NodePort, and LoadBalancer?**
> ClusterIP: only reachable inside the cluster — no external traffic. NodePort: opens a fixed port on every node, accessible externally via node IP (development/testing only). LoadBalancer: provisions a managed cloud LB (AWS ELB, etc.) — assigns an external DNS/IP. Use LoadBalancer or Ingress for production external traffic.

**Q: Why is Ingress preferred over one LoadBalancer per service?**
> LoadBalancer Services provision a cloud LB per service — expensive and hard to manage. An Ingress uses ONE load balancer with HTTP routing rules (by host, by path) to fan traffic out to many services. Cost is reduced and TLS termination is centralized.

**Q: What is a headless Service?**
> Set `clusterIP: None`. Instead of routing to a virtual IP, DNS returns the individual Pod IPs. Required by StatefulSets so each Pod gets a stable DNS name. Also used when the application itself handles load balancing (e.g., Redis Cluster, Kafka consumers).

**Q: What is a NetworkPolicy and why is it important for security?**
> NetworkPolicy is a firewall for Pods. By default, all Pods allow all traffic. NetworkPolicy restricts this: "api Pod can only receive from frontend, only send to postgres." This limits the blast radius if a Pod is compromised — the attacker can't reach your entire cluster. Requires a CNI plugin that supports NetworkPolicy (Calico, Cilium).

**Q: What happens to Service traffic when all backend Pods are NotReady?**
> The Service removes failing Pods from its endpoint list (Endpoints object). Traffic is only sent to Pods passing their readinessProbe. If ALL Pods fail their readinessProbe, the Service has an empty endpoint list — requests will fail until at least one Pod becomes ready.
