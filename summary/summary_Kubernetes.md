# Kubernetes — Interview Revision Summary

> **Target:** 7+ year Full Stack MERN Developer | **Files:** 9

## Table of Contents

1. [01_core_concepts.md — Architecture Overview](#01_core_conceptsmd-architecture-overview)
2. [02_workloads.md — Overview](#02_workloadsmd-overview)
3. [03_services_networking.md — How Pod Networking Works](#03_services_networkingmd-how-pod-networking-works)
4. [04_storage.md — Storage Concepts](#04_storagemd-storage-concepts)
5. [05_config_secrets.md — Why configuration management matters](#05_config_secretsmd-why-configuration-management-matters)
6. [06_security.md — Security Layers in Kubernetes](#06_securitymd-security-layers-in-kubernetes)
7. [07_advanced.md — Horizontal Pod Autoscaler (HPA)](#07_advancedmd-horizontal-pod-autoscaler-hpa)
8. [08_helm_interview_qa.md — What is Helm?](#08_helm_interview_qamd-what-is-helm)
9. [09_theory_advanced_qa.md — SECTION 1: BASIC](#09_theory_advanced_qamd-section-1-basic)

---

## 01_core_concepts.md — Architecture Overview

# Kubernetes: Core Concepts

## Architecture Overview

```
Control Plane                    Worker Nodes
┌─────────────────┐              ┌─────────────────┐
│  kube-apiserver │◄────────────►│    kubelet       │
│  etcd           │              │    kube-proxy    │
│  kube-scheduler │              │    container     │
│  controller-mgr │              │    runtime       │
└─────────────────┘              └─────────────────┘
```

| Component | Role |
|-----------|------|
| `kube-apiserver` | REST gateway — all communication goes through here |
| `etcd` | Distributed key-value store — source of truth for cluster state |
| `kube-scheduler` | Assigns pending Pods to Nodes based on resources/constraints |
| `kube-controller-manager` | Control loops: ReplicaSet, Deployment, Node, Job controllers |
| `kubelet` | Node agent — ensures containers in Pods are running |
| `kube-proxy` | Maintains iptables/IPVS rules for Service networking |

---

## Pods

```yaml
# Minimal Pod (rarely used directly — use Deployment instead)
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
  labels:
    app: myapp
    env: production
spec:
  containers:
    - name: api
      image: ghcr.io/username/myapp:1.0.0
      ports:
        - containerPort: 3000
      env:
        - name: NODE_ENV
          value: production
      resources:
        requests:              # minimum guaranteed
          cpu: 100m            # 100 millicores = 0.1 CPU
          memory: 128Mi
        limits:                # maximum allowed
          cpu: 500m
          memory: 256Mi

  # Sidecar container (e.g., log forwarder)
  - name: log-forwarder
    image: fluent/fluent-bit:latest
    volumeMounts:
      - name: logs
        mountPath: /var/log/app

  volumes:
    - name: logs
      emptyDir: {}

  restartPolicy: Always        # Always | OnFailure | Never
```

---

## ReplicaSet

```yaml
# Ensures N replicas of a Pod are running at all times
# Usually managed by a Deployment — rarely created directly
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: myapp-rs
spec:
  replicas: 3
  selector:
    matchLabels:             # pods matching this label are owned by this RS
      app: myapp
  template:                  # pod template
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: api
          image: ghcr.io/username/myapp:1.0.0
```

---

## Deployment

```yaml
# Deployment manages ReplicaSets for rolling updates + rollbacks
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-deployment
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1            # extra pods during update
      maxUnavailable: 0      # never go below desired count
  template:
    metadata:
      labels:
        app: myapp
        version: "1.0.0"     # update label to match new version
    spec:
      containers:
        - name: api
          image: ghcr.io/username/myapp:1.0.0
          ports:
            - containerPort: 3000
          readinessProbe:              # ready to receive traffic?
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:               # still alive? restart if not
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
            failureThreshold: 3
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
```

---

## Services

```yaml
# ClusterIP — internal only (default)
apiVersion: v1
kind: Service
metadata:
  name: myapp-svc
spec:
  type: ClusterIP
  selector:
    app: myapp               # routes to pods with this label
  ports:
    - port: 80               # service port
      targetPort: 3000       # pod port

---
# NodePort — accessible on each node's IP
apiVersion: v1
kind: Service
metadata:
  name: myapp-nodeport
spec:
  type: NodePort
  selector:
    app: myapp
  ports:
    - port: 80
      targetPort: 3000
      nodePort: 30080       # range 30000–32767

---
# LoadBalancer — provisions cloud LB (ELB, GCP LB, Azure LB)
apiVersion: v1
kind: Service
metadata:
  name: myapp-lb
spec:
  type: LoadBalancer
  selector:
    app: myapp
  ports:
    - port: 80
      targetPort: 3000
```

---

## Namespaces

```bash
# Logical partitioning within a cluster
kubectl create namespace production
kubectl create namespace staging

# Set default namespace for current context
kubectl config set-context --current --namespace=production

# Cross-namespace Service DNS:
# <service>.<namespace>.svc.cluster.local
# e.g., myapp-svc.production.svc.cluster.local
```

```yaml
# ResourceQuota — limit namespace resource consumption
apiVersion: v1
kind: ResourceQuota
metadata:
  name: production-quota
  namespace: production
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 4Gi
    limits.cpu: "8"
    limits.memory: 8Gi
    pods: "20"
```

---

## Essential kubectl Commands

```bash
# Cluster info
kubectl cluster-info
kubectl get nodes -o wide

# Deployments
kubectl apply -f deployment.yaml           # declarative (preferred)
kubectl get deployments -n production
kubectl rollout status deployment/myapp
kubectl rollout history deployment/myapp
kubectl rollout undo deployment/myapp      # rollback
kubectl scale deployment myapp --replicas=5

# Pods
kubectl get pods -o wide
kubectl describe pod <pod-name>
kubectl logs <pod-name> -f                 # stream logs
kubectl logs <pod-name> -c <container>     # multi-container pod
kubectl exec -it <pod-name> -- sh          # interactive shell
kubectl delete pod <pod-name>              # triggers restart via ReplicaSet

# Port forwarding (debug without Service)
kubectl port-forward pod/<pod-name> 8080:3000
kubectl port-forward svc/myapp-svc 8080:80

# Resource watching
kubectl get pods --watch
kubectl top pods
kubectl top nodes
```

---

## Interview Questions

**Q: What is the difference between a Pod and a container?**
> A Pod is the smallest deployable unit in Kubernetes. It can contain one or more tightly-coupled containers that share the same network namespace (same IP, localhost) and can share volumes. Docker containers are the actual runtimes; Pods are the K8s abstraction that wraps them.

**Q: Why don't we create Pods directly in production?**
> bare Pods are not self-healing. If a node fails or the pod crashes, it is gone — nothing reschedules it. Deployments (via ReplicaSets) ensure N replicas always run and handle rolling updates and rollbacks.

**Q: What is the difference between readinessProbe and livenessProbe?**
> - **readinessProbe**: Is this Pod ready to receive traffic? While failing, the Pod is removed from Service endpoints (no traffic sent). Used for startup delays or temporary unavailability (DB migration).
> - **livenessProbe**: Is this Pod alive? If it fails `failureThreshold` times, the container is restarted. Used for detecting deadlocks or corrupted state that won't recover without a restart.

**Q: What is the difference between requests and limits?**
> - **requests**: guaranteed resources — used by the scheduler to find a node with enough available capacity. Pod is always given this much.
> - **limits**: maximum allowed — if the container uses more than its memory limit, it is OOM-killed; if it exceeds CPU limit, it is throttled (not killed).
> Setting requests = limits (Guaranteed QoS) works well for predictable workloads. Just requests (Burstable QoS) is common for web apps.

**Q: What is a rolling update strategy in Kubernetes?**
> Kubernetes creates a new ReplicaSet for the updated Deployment, gradually scales it up while scaling down the old one. `maxSurge` controls how many extra pods are created; `maxUnavailable` controls how many can be missing. Setting `maxUnavailable: 0` ensures zero-downtime (all old pods stay until new ones are ready).

---

## 02_workloads.md — Overview

# Kubernetes: Workloads

## Overview
Kubernetes workload resources manage how your application Pods run.
Each type is designed for a specific use case — choosing the right one is critical.

| Resource | Use Case |
|----------|----------|
| Deployment | Stateless web apps, APIs, microservices |
| StatefulSet | Databases, caches with persistent identity (Postgres, Redis) |
| DaemonSet | Per-node agents (log collectors, monitoring, node config) |
| Job | One-time batch processing task |
| CronJob | Scheduled batch tasks (like cron on Linux) |

---

## Deployment — updating and rolling back

```yaml
# A complete production Deployment with all key settings explained
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: production
  annotations:
    # Store change reason for rollout history (kubectl rollout history)
    kubernetes.io/change-cause: "Deploy v2.1.0 — add /healthz endpoint"
spec:
  replicas: 3                    # run 3 copies for high availability

  selector:
    matchLabels:
      app: api                   # must match template.metadata.labels

  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1                # allow 1 EXTRA pod during update (4 total temporarily)
      maxUnavailable: 0          # never kill an old pod before a new one is Ready
                                 # → zero-downtime deployment

  template:
    metadata:
      labels:
        app: api
        version: "2.1.0"

    spec:
      # Spread Pods across zone failure domains (avoid putting all 3 on same node)
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: api

      containers:
        - name: api
          image: ghcr.io/myorg/api:2.1.0

          ports:
            - containerPort: 3000

          # Resource requests tell the scheduler what this Pod needs.
          # Resource limits cap what it can use. Both are required for QoS.
          resources:
            requests:
              cpu: 100m          # 0.1 CPU core guaranteed
              memory: 128Mi      # 128 MiB guaranteed
            limits:
              cpu: 500m          # max 0.5 CPU core
              memory: 256Mi      # max 256 MiB (OOM-killed if exceeded)

          # readinessProbe: "is this Pod safe to send traffic to?"
          # Failing = Pod removed from Service endpoints (no traffic)
          readinessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 5    # wait 5s before first check (startup time)
            periodSeconds: 10         # check every 10s
            successThreshold: 1       # 1 success = ready
            failureThreshold: 3       # 3 consecutive failures = not ready

          # livenessProbe: "is this Pod still working, or is it stuck?"
          # Failing = kubelet restarts the container
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 30
            failureThreshold: 3

          # startupProbe: prevents liveness from killing slow-starting containers
          # once startupProbe succeeds, liveness takes over
          startupProbe:
            httpGet:
              path: /healthz
              port: 3000
            failureThreshold: 30      # allow up to 30 * 10s = 5 minutes to start
            periodSeconds: 10

          env:
            - name: NODE_ENV
              value: production
            - name: PORT
              value: "3000"
```

```bash
# Rolling update commands
kubectl apply -f deployment.yaml               # apply new image version

kubectl rollout status deployment/api          # watch rollout progress
# Waiting for deployment "api" rollout to finish: 1 out of 3 new replicas have been updated...

kubectl rollout history deployment/api         # see history of changes
# REVISION  CHANGE-CAUSE
# 1         Deploy v2.0.0
# 2         Deploy v2.1.0

kubectl rollout undo deployment/api           # rollback to previous revision
kubectl rollout undo deployment/api --to-revision=1  # rollback to specific revision
```

---

## StatefulSet — for stateful applications (databases, Redis)

```yaml
# StatefulSets give each Pod a STABLE identity: api-0, api-1, api-2
# Pods are created in ORDER (0 → 1 → 2) and deleted in REVERSE order
# Each Pod gets its own PersistentVolumeClaim via volumeClaimTemplates
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: production
spec:
  serviceName: "postgres"         # REQUIRED: headless Service name for stable DNS
  replicas: 1                     # usually 1 for primary; use operator for HA

  selector:
    matchLabels:
      app: postgres

  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432

          env:
            - name: POSTGRES_DB
              value: myapp
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:       # read from a Secret (see file 05_config_secrets.md)
                  name: postgres-secret
                  key: username
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password

          volumeMounts:
            - name: data             # mounts the PVC created below
              mountPath: /var/lib/postgresql/data

          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: "1"
              memory: 1Gi

  # Each replica gets its own PVC automatically.
  # postgres-0 gets data-postgres-0, postgres-1 gets data-postgres-1, etc.
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: [ReadWriteOnce]   # only one node can write (typical for DBs)
        storageClassName: gp3          # use fast SSD storage class
        resources:
          requests:
            storage: 20Gi

---
# Headless Service (clusterIP: None) — required by StatefulSet for stable DNS
# DNS: postgres-0.postgres.production.svc.cluster.local
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: production
spec:
  clusterIP: None                  # headless — no load balancing, returns Pod IPs
  selector:
    app: postgres
  ports:
    - port: 5432
```

---

## DaemonSet — run exactly one Pod per node

```yaml
# Use case: log collector (Fluent Bit), metrics agent (node-exporter), security agent
# DaemonSet automatically adds a Pod when a new node joins the cluster
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentbit
  namespace: logging
spec:
  selector:
    matchLabels:
      app: fluentbit

  template:
    metadata:
      labels:
        app: fluentbit
    spec:
      # serviceAccountName: fluentbit-sa  # SA with permission to read pod logs

      # tolerations allow this Pod to run on control-plane nodes too
      tolerations:
        - key: node-role.kubernetes.io/control-plane
          operator: Exists
          effect: NoSchedule

      containers:
        - name: fluentbit
          image: fluent/fluent-bit:3.0
          resources:
            requests:
              cpu: 50m
              memory: 50Mi
            limits:
              cpu: 200m
              memory: 200Mi
          volumeMounts:
            - name: varlog
              mountPath: /var/log
              readOnly: true
            - name: varlibdockercontainers
              mountPath: /var/lib/docker/containers
              readOnly: true

      volumes:
        - name: varlog
          hostPath:                      # mount from the actual node filesystem
            path: /var/log
        - name: varlibdockercontainers
          hostPath:
            path: /var/lib/docker/containers
```

---

## Job — run a task to completion once

```yaml
# Jobs run until completions are reached (re-runs on failure).
# Great for: DB migrations, data import, report generation.
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
  namespace: production
spec:
  completions: 1                  # run 1 successful completion
  parallelism: 1                  # run 1 pod at a time
  backoffLimit: 3                 # retry up to 3 times on failure
  ttlSecondsAfterFinished: 300    # auto-delete job 5 minutes after it finishes

  template:
    spec:
      restartPolicy: OnFailure     # Jobs MUST set restartPolicy to Never or OnFailure
      containers:
        - name: migrate
          image: ghcr.io/myorg/api:2.1.0
          command: ["node", "scripts/migrate.js"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: api-secret
                  key: database-url
```

---

## CronJob — scheduled Jobs (like cron)

```yaml
# Runs a Job on a schedule defined using cron syntax.
# .----------------------------------------- minute (0-59)
# | .--------------------------------------- hour (0-23)
# | | .------------------------------------ day of month (1-31)
# | | | .--------------------------------- month (1-12)
# | | | | .------------------------------- day of week (0-6, 0=Sunday)
# | | | | |
# 0 2 * * *  = every day at 02:00 UTC
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-cleanup
  namespace: production
spec:
  schedule: "0 2 * * *"           # run at 02:00 UTC every day
  timeZone: "UTC"
  concurrencyPolicy: Forbid        # don't run a new Job if previous is still running
                                   # Replace: cancel previous and start new
                                   # Allow: run multiple simultaneously
  successfulJobsHistoryLimit: 3    # keep logs of 3 most recent successful runs
  failedJobsHistoryLimit: 1        # keep logs of 1 most recent failed run
  startingDeadlineSeconds: 300     # if missed schedule by 5min, skip (don't run late)

  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: cleanup
              image: ghcr.io/myorg/api:2.1.0
              command: ["node", "scripts/cleanup-old-sessions.js"]
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 500m
                  memory: 256Mi
```

---

## Pod Disruption Budget (PDB)

```yaml
# PDB protects against too many Pods being simultaneously unavailable
# during voluntary disruptions: node drain, rolling upgrades, cluster autoscaler
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-pdb
  namespace: production
spec:
  minAvailable: 2                # at least 2 replicas must always be available
  # maxUnavailable: 1            # alternatively: max 1 can be unavailable at a time
  selector:
    matchLabels:
      app: api
```

---

## Interview Questions

**Q: What is the difference between Deployment and StatefulSet?**
> Deployment Pods are interchangeable: they share the same PVC, have random names (api-abc12), and can be replaced in any order. StatefulSet Pods have stable identities: ordered names (postgres-0, postgres-1), their own PVCs that persist if the Pod is deleted, and are created/deleted in a predictable order. Use StatefulSet for anything that stores data on disk and needs stable network identity (databases, Kafka, ZooKeeper).

**Q: Why would you use a DaemonSet over a Deployment?**
> DaemonSet guarantees exactly ONE Pod per node — including new nodes that join later. Useful for node-level agents that need to run on every machine: log shippers (Fluent Bit), metrics agents (node-exporter), security scanners. A Deployment can't guarantee one-per-node placement.

**Q: What is backoffLimit in a Job?**
> The maximum number of retry attempts before the Job is declared failed. If `backoffLimit: 3` and the Pod fails 4 times, the Job fails and no more retries happen. Use with idempotent tasks — each retry should produce the same result (DB migrations check if migration already applied).

**Q: What does concurrencyPolicy: Forbid do in CronJob?**
> If the previous Job is still running when the next schedule triggers, Forbid skips the new run entirely. Default is `Allow` (multiple runs simultaneously). Use `Forbid` for jobs that must not overlap (e.g., report generation writing to the same output file).

**Q: What is a Pod Disruption Budget and when does it matter?**
> A PDB prevents too many Pods from being unavailable at the same time during voluntary disruptions (node drains for maintenance, cluster autoscaler scale-down). The cluster respects the PDB by waiting before draining another node. Without a PDB, a node drain could take down all your API Pods simultaneously during a maintenance window.

**Q: What is the difference between requests and limits in Kubernetes?**
> `requests`: guaranteed resources used by the scheduler to find a suitable node. The Pod always gets at least this much.
> `limits`: absolute maximum. Exceeding memory limit → the Pod is OOM-killed (exit code 137). Exceeding CPU limit → the process is throttled (slowed down), not killed.
> Setting `requests == limits` gives the Pod "Guaranteed" QoS class — highest priority for eviction protection.

---

## 03_services_networking.md — How Pod Networking Works

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

---

## 04_storage.md — Storage Concepts

# Kubernetes: Storage — PersistentVolumes, PVCs, StorageClasses

## Storage Concepts

```
StorageClass  →  provisions a PersistentVolume (PV)
                          ↑
                   PersistentVolumeClaim (PVC)  ←  Pod mounts PVC
```

| Concept | What it is |
|---------|-----------|
| PersistentVolume (PV) | A piece of storage provisioned in the cluster (manually or by StorageClass) |
| PersistentVolumeClaim (PVC) | A request for storage by a Pod — like renting a PV |
| StorageClass | Blueprint for dynamic provisioning — "give me 20Gi of fast SSD" |
| CSI Driver | Plugin that connects K8s to cloud storage (EBS, Azure Disk, GCE PD) |

---

## Access Modes

| Mode | Abbreviation | Meaning |
|------|-------------|---------|
| ReadWriteOnce | RWO | One node can read and write — typical for databases |
| ReadOnlyMany | ROX | Many nodes can read, none can write |
| ReadWriteMany | RWX | Many nodes can read AND write — requires NFS or supported CSI |
| ReadWriteOncePod | RWOP | Only one Pod can read/write (K8s 1.22+) |

---

## StorageClasses (cloud-native)

```yaml
# AWS: gp3 SSD (EBS) — faster and cheaper than gp2
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"   # used when PVC has no storageClassName
provisioner: ebs.csi.aws.com      # AWS EBS CSI driver
parameters:
  type: gp3
  fsType: ext4
  encrypted: "true"               # encrypt the EBS volume at rest
reclaimPolicy: Retain             # Retain: keep PV when PVC deleted (use for databases!)
                                  # Delete: auto-delete the underlying EBS volume
allowVolumeExpansion: true        # allow resizing the EBS volume later
volumeBindingMode: WaitForFirstConsumer   # delay PV creation until a Pod is scheduled
                                          # ensures volume is in same AZ as Pod

---
# Azure: Premium SSD (Managed Disk)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: managed-premium
provisioner: disk.csi.azure.com
parameters:
  skuName: Premium_LRS            # locally redundant SSD
  kind: Managed
  cachingMode: ReadOnly
reclaimPolicy: Retain
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer

---
# GCP: SSD Persistent Disk
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: pd.csi.storage.gke.io
parameters:
  type: pd-ssd
  replication-type: regional-pd   # replicated across 2 zones
reclaimPolicy: Retain
allowVolumeExpansion: true
```

---

## PersistentVolumeClaim (PVC)

```yaml
# A PVC is a request: "I need 20Gi of RWO storage from the gp3 class"
# Kubernetes automatically provisions a PV and binds it to this PVC.
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: production
spec:
  accessModes:
    - ReadWriteOnce                # one node at a time
  storageClassName: gp3            # use the gp3 StorageClass above
  resources:
    requests:
      storage: 20Gi               # minimum size requested
```

---

## Using a PVC in a Pod / Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 1                     # RWO: only 1 replica can mount at a time
  template:
    spec:
      containers:
        - name: api
          image: ghcr.io/myorg/api:1.0.0
          volumeMounts:
            - name: uploads        # must match volume name below
              mountPath: /app/uploads   # where the volume appears inside the container

      volumes:
        - name: uploads
          persistentVolumeClaim:
            claimName: uploads-pvc  # reference the PVC by name
```

---

## StatefulSet volumeClaimTemplates (auto PVC per Pod)

```yaml
# StatefulSet creates a PVC per replica automatically.
# postgres-0 gets data-postgres-0, postgres-1 gets data-postgres-1, etc.
# If postgres-0 Pod is deleted + recreated, it re-binds to the same PVC.
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  replicas: 1
  serviceName: postgres
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: data                   # PVC name prefix
      spec:
        accessModes: [ReadWriteOnce]
        storageClassName: gp3
        resources:
          requests:
            storage: 20Gi
```

---

## Manually provisioned PV (on-premise / NFS)

```yaml
# When there is no cloud StorageClass, create a PV manually
# and bind a PVC to it using storageClassName: "" (manual binding)
apiVersion: v1
kind: PersistentVolume
metadata:
  name: nfs-pv
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteMany                # NFS supports multiple simultaneous writers
  nfs:
    server: 10.0.0.5               # NFS server IP
    path: /mnt/data/myapp
  persistentVolumeReclaimPolicy: Retain
  storageClassName: ""             # static binding — match exactly to PVC below

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shared-data
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: ""             # must match PV's storageClassName for static binding
  resources:
    requests:
      storage: 100Gi
  volumeName: nfs-pv               # explicitly bind to this specific PV
```

---

## Volume Snapshots (backup)

```yaml
# Snapshot = point-in-time copy of a PV (cloud-native backup)
# Requires VolumeSnapshotClass and CSI driver support

# 1. Create a VolumeSnapshotClass
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshotClass
metadata:
  name: ebs-vsc
driver: ebs.csi.aws.com
deletionPolicy: Retain

---
# 2. Take a snapshot of an existing PVC
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: postgres-snapshot-2026-03-12
spec:
  volumeSnapshotClassName: ebs-vsc
  source:
    persistentVolumeClaimName: postgres-data  # PVC to snapshot

---
# 3. Restore from snapshot into a new PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data-restore
spec:
  storageClassName: gp3
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 20Gi
  dataSource:
    name: postgres-snapshot-2026-03-12
    kind: VolumeSnapshot
    apiGroup: snapshot.storage.k8s.io
```

---

## Common kubectl Storage Commands

```bash
# PVC / PV
kubectl get pvc -n production
kubectl describe pvc postgres-data -n production
kubectl get pv                             # cluster-wide
kubectl describe pv <pv-name>

# Check PVC is bound before deploying
kubectl wait pvc/postgres-data --for=condition=Bound --timeout=60s

# Resize a PVC (StorageClass must have allowVolumeExpansion: true)
kubectl patch pvc postgres-data -p '{"spec":{"resources":{"requests":{"storage":"40Gi"}}}}'

# Storage classes
kubectl get storageclass
kubectl get storageclass gp3 -o yaml

# Volume snapshots
kubectl get volumesnapshot -n production
```

---

## Interview Questions

**Q: What is the difference between a PV and a PVC?**
> PV is the actual storage resource (an EBS volume, NFS share, etc.) — created by an admin or auto-provisioned by a StorageClass. PVC is a request for storage by a Pod — "I need 20Gi RWO." Kubernetes binds a matching PVC to a PV. The Pod interacts only with the PVC; it doesn't need to know the underlying storage type.

**Q: What does reclaimPolicy: Retain mean?**
> When the PVC is deleted, the underlying PV (and the cloud volume like EBS) is NOT deleted — it stays around and moves to "Released" state. You must manually delete or re-bind it. Use `Retain` for databases to prevent accidental data loss. `Delete` auto-deletes the cloud volume — fine for ephemeral data.

**Q: Why use WaitForFirstConsumer in volumeBindingMode?**
> With `Immediate`, the PV (e.g., EBS volume) is provisioned as soon as the PVC is created — in a random Availability Zone. If the Pod gets scheduled to a different AZ, it can't mount the volume. `WaitForFirstConsumer` delays provisioning until a Pod is scheduled, so the volume is created in the same AZ as the Pod.

**Q: What is a VolumeClaimTemplate in a StatefulSet?**
> It's a template that auto-creates a dedicated PVC for each StatefulSet replica. `postgres-0` gets its own `data-postgres-0` PVC and `postgres-1` gets `data-postgres-1`. If a Pod is deleted and recreated with the same name, it will reattach to the same PVC and its data is preserved.

**Q: When would you use ReadWriteMany (RWX)?**
> When multiple Pods across multiple nodes need to read AND write the same data simultaneously — e.g., a shared media storage or config directory. Most cloud block storage (EBS, Azure Disk) only supports RWO. For RWX you need a network filesystem: AWS EFS, Azure Files, or NFS with a CSI driver.

---

## 05_config_secrets.md — Why configuration management matters

# Kubernetes: ConfigMaps and Secrets

## Why configuration management matters
Hard-coding config values in container images is an anti-pattern:
- An image built with `NODE_ENV=staging` cannot be promoted to production
- Database passwords in images are a security failure
- Changing any config requires a full image rebuild

ConfigMaps and Secrets let you separate configuration from the container image.
The same image runs in dev, staging, and production — only the config changes.

---

## ConfigMap — non-sensitive configuration

```yaml
# ConfigMap stores arbitrary key-value pairs or entire config files.
# Use for: environment names, feature flags, app config files, URLs.
# DO NOT use for passwords, tokens, or certificates.
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
  namespace: production
data:
  # Simple key-value pairs → injected as environment variables
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "3000"
  REDIS_HOST: "redis.production.svc.cluster.local"
  MAX_CONNECTIONS: "100"

  # Multi-line value → mount as a file
  app.json: |
    {
      "featureFlags": {
        "newCheckout": true,
        "darkMode": false
      },
      "rateLimits": {
        "api": 1000,
        "auth": 10
      }
    }

  # nginx.conf example — mount into nginx container as a file
  nginx.conf: |
    server {
      listen 80;
      location / {
        proxy_pass http://api:3000;
      }
    }
```

---

## Secret — sensitive configuration

```yaml
# Secrets are like ConfigMaps but for sensitive data.
# Values MUST be base64 encoded (this is encoding, NOT encryption).
# In production: use sealed-secrets, External Secrets Operator, or Vault.
apiVersion: v1
kind: Secret
metadata:
  name: api-secret
  namespace: production
type: Opaque                       # generic secret; other types: kubernetes.io/tls, kubernetes.io/dockerconfigjson

data:
  # echo -n 'mypassword' | base64  → bXlwYXNzd29yZA==
  DATABASE_PASSWORD: bXlwYXNzd29yZA==
  JWT_SECRET: c3VwZXJzZWNyZXRrZXk=
  API_KEY: YWJjMTIzZGVmNDU2

stringData:                        # alternative: plain text (K8s base64-encodes it for you)
  DATABASE_URL: "postgresql://admin:mypassword@postgres:5432/myapp"
  # stringData is WRITE-only — kubectl get secret still shows base64
```

---

## Injecting ConfigMap as environment variables

```yaml
# Method 1: envFrom — inject ALL keys as env vars at once
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  template:
    spec:
      containers:
        - name: api
          image: ghcr.io/myorg/api:1.0.0
          envFrom:
            - configMapRef:
                name: api-config       # injects NODE_ENV, LOG_LEVEL, PORT, ... 
            - secretRef:
                name: api-secret       # injects DATABASE_PASSWORD, JWT_SECRET, ...
          # All keys become environment variables in the container.
```

```yaml
# Method 2: Individual env vars — explicit, safer (avoids accidentally injecting extras)
          env:
            - name: NODE_ENV           # env var name inside the container
              valueFrom:
                configMapKeyRef:
                  name: api-config     # ConfigMap name
                  key: NODE_ENV        # specific key to use

            - name: DB_PASSWORD        # env var name can differ from secret key
              valueFrom:
                secretKeyRef:
                  name: api-secret
                  key: DATABASE_PASSWORD
                  optional: false      # fail hard if Secret/key doesn't exist
```

---

## Mounting ConfigMap as files inside a container

```yaml
# Useful for config files (nginx.conf, app.json, .env).
# The container reads them from the filesystem, not environment variables.
spec:
  containers:
    - name: api
      image: ghcr.io/myorg/api:1.0.0
      volumeMounts:
        - name: config-vol
          mountPath: /app/config        # config files appear here
          readOnly: true               # config should be read-only

  volumes:
    - name: config-vol
      configMap:
        name: api-config
        # Optional: only mount specific keys (not all of them)
        items:
          - key: app.json              # take this key from ConfigMap
            path: app.json             # create this filename in mountPath
          - key: nginx.conf
            path: nginx.conf
```

---

## Mounting Secrets as files

```yaml
# TLS certificates are best mounted as files, not env vars
spec:
  containers:
    - name: api
      volumeMounts:
        - name: tls-cert
          mountPath: /etc/ssl/certs
          readOnly: true

  volumes:
    - name: tls-cert
      secret:
        secretName: api-tls-secret     # Secret containing tls.crt and tls.key
        defaultMode: 0400              # owner read-only (chmod 400)
```

---

## TLS Secret

```bash
# Create TLS secret from certificate files
kubectl create secret tls api-tls-secret \
  --cert=server.crt \
  --key=server.key \
  --namespace=production

# The Secret contains two keys: tls.crt and tls.key
```

---

## External Secrets Operator (production best practice)

```yaml
# Problem: storing plain base64 Secrets in Git is insecure.
# External Secrets Operator syncs secrets FROM a secret store (AWS SSM,
# Azure Key Vault, HashiCorp Vault, GCP Secret Manager) INTO K8s Secrets.
# Your Git repo never contains actual secret values.

# 1. Define where secrets come from
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: production
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:                          # use IRSA (IAM Role for Service Account)
          serviceAccountRef:
            name: external-secrets-sa

---
# 2. Define which secrets to fetch and how to map them to K8s Secret keys
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: api-external-secret
  namespace: production
spec:
  refreshInterval: 1h               # re-sync from source every 1 hour
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore

  target:
    name: api-secret                # creates/updates this K8s Secret
    creationPolicy: Owner

  data:
    - secretKey: DATABASE_PASSWORD   # key name in K8s Secret
      remoteRef:
        key: production/api          # path in AWS Secrets Manager
        property: db_password        # JSON key inside the secret value

    - secretKey: JWT_SECRET
      remoteRef:
        key: production/api
        property: jwt_secret
```

---

## Azure Key Vault integration (Azure-specific)

```yaml
# Use Azure Key Vault Provider for Secrets Store CSI Driver
# OR External Secrets Operator with Azure provider
# Secret values are fetched directly from Azure Key Vault and mounted as K8s Secrets

# Using External Secrets Operator with Azure Key Vault:
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: azure-key-vault
  namespace: production
spec:
  provider:
    azurekv:
      tenantId: "your-tenant-id"
      vaultUrl: "https://my-vault.vault.azure.net"
      authType: WorkloadIdentity     # recommended: no credentials stored in cluster
      serviceAccountRef:
        name: workload-identity-sa

---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: api-secret
  namespace: production
spec:
  refreshInterval: 30m
  secretStoreRef:
    name: azure-key-vault
    kind: SecretStore
  target:
    name: api-secret
  data:
    - secretKey: DATABASE_PASSWORD
      remoteRef:
        key: api-db-password         # secret name in Azure Key Vault
    - secretKey: JWT_SECRET
      remoteRef:
        key: api-jwt-secret
```

---

## kubectl Commands

```bash
# ConfigMaps
kubectl create configmap api-config --from-literal=NODE_ENV=production
kubectl create configmap api-config --from-file=app.json=./config/app.json
kubectl get configmap api-config -o yaml
kubectl edit configmap api-config      # live edit (not recommended for production)

# Secrets
kubectl create secret generic api-secret \
  --from-literal=JWT_SECRET=mysupersecretkey \
  --from-literal=DATABASE_PASSWORD=mypassword

kubectl get secret api-secret -o jsonpath='{.data.JWT_SECRET}' | base64 --decode

# View all secrets in namespace (shows names, not values)
kubectl get secrets -n production

# Delete and recreate (for rotations)
kubectl delete secret api-secret
kubectl apply -f secret.yaml
```

---

## Interview Questions

**Q: What is the difference between ConfigMap and Secret?**
> Both store key-value config for Pods. Secrets are intended for sensitive data: they are stored separately in etcd and can be encrypted at rest (with proper cluster config). The key difference is intent and access control — you can RBAC-restrict access to Secrets separately. In practice: ConfigMap for non-sensitive config, Secret for passwords/tokens/certs.

**Q: Are Kubernetes Secrets secure by default?**
> By default: no. Values are base64-encoded (not encrypted), stored in etcd in plain text, and visible to anyone who can `kubectl get secret`. For real security: enable etcd encryption at rest, use RBAC to restrict Secret access, and ideally use External Secrets Operator to store actual values in AWS Secrets Manager / Azure Key Vault and never commit secrets to Git.

**Q: What is the difference between envFrom and individual env.valueFrom?**
> `envFrom.configMapRef` injects ALL keys from a ConfigMap as environment variables in one line. `env.valueFrom.configMapKeyRef` lets you inject specific keys and rename them. Use `envFrom` for convenience, individual `env` for precision — especially to avoid accidentally exposing unrelated keys.

**Q: What is External Secrets Operator and why use it?**
> It's a Kubernetes operator that syncs secrets from external vaults (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault) into K8s Secrets automatically. Benefits: no secret values in Git, automatic rotation (re-syncs on interval), centralised secret management across clusters, full audit trail in the provider.

**Q: How do you handle secret rotation in Kubernetes?**
> With External Secrets: the operator re-fetches the secret on each `refreshInterval` and updates the K8s Secret. Then Pods need to either restart (to pick up new env vars) or read the file from a mounted volume (volume mounts reflect updates automatically within ~1 minute without a restart).

---

## 06_security.md — Security Layers in Kubernetes

# Kubernetes: Security — RBAC, ServiceAccounts, Pod Security

## Security Layers in Kubernetes

```
┌─────────────────────────────────────────────────┐
│  Who can call the API?    → Authentication       │
│  What can they do?        → RBAC Authorization   │
│  What can Pods do?        → Pod Security / PSA   │
│  What can Pods access?    → NetworkPolicy        │
│  External secrets         → Vault / ESO          │
└─────────────────────────────────────────────────┘
```

---

## RBAC — Role-Based Access Control

```
Role / ClusterRole       ← defines WHAT actions are allowed
        +
RoleBinding / ClusterRoleBinding  ← defines WHO gets those actions
```

| Resource | Scope |
|----------|-------|
| Role | One namespace |
| ClusterRole | All namespaces (or cluster-level resources like nodes) |
| RoleBinding | Binds Role OR ClusterRole to a subject in ONE namespace |
| ClusterRoleBinding | Binds ClusterRole to a subject cluster-wide |

---

## Role and RoleBinding (namespace-scoped)

```yaml
# Role: allow reading (get, list, watch) Pods and their logs in the 'staging' namespace.
# Nothing else is allowed — principle of least privilege.
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: staging
rules:
  - apiGroups: [""]                  # "" = core API group (Pods, Services, Secrets)
    resources: ["pods", "pods/log"]  # which resources
    verbs: ["get", "list", "watch"]  # which actions (no create/update/delete)

  - apiGroups: ["apps"]              # Deployment, ReplicaSet, StatefulSet
    resources: ["deployments"]
    verbs: ["get", "list"]

---
# RoleBinding: give the 'dev-team' group the 'pod-reader' role in 'staging'
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: dev-pod-reader
  namespace: staging
subjects:
  # Subject types: User, Group, ServiceAccount
  - kind: Group
    name: dev-team                    # group from your identity provider (OIDC/LDAP)
    apiGroup: rbac.authorization.k8s.io
  - kind: User
    name: alice@mycompany.com
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role                          # Role (namespace) or ClusterRole (cluster-wide)
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

---

## ClusterRole and ClusterRoleBinding (cluster-wide)

```yaml
# ClusterRole: allow reading all nodes and persistent volumes (cluster-level resources)
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cluster-reader
rules:
  - apiGroups: [""]
    resources: ["nodes", "persistentvolumes", "namespaces"]
    verbs: ["get", "list", "watch"]

---
# Bind a ClusterRole to a specific namespace's ServiceAccount
# (reuse ClusterRole definition but limit it to one namespace via RoleBinding)
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: monitoring-cluster-reader
subjects:
  - kind: ServiceAccount
    name: prometheus
    namespace: monitoring
roleRef:
  kind: ClusterRole
  name: cluster-reader
  apiGroup: rbac.authorization.k8s.io
```

---

## ServiceAccounts

```yaml
# Every Pod runs under a ServiceAccount (default: 'default' SA in its namespace).
# The 'default' SA has no special permissions — that is intentional.
# Create a dedicated SA for each workload with exactly the permissions it needs.

apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-sa
  namespace: production
  annotations:
    # AWS IRSA: link SA to an IAM Role so Pods get AWS permissions without stored keys
    eks.amazonaws.com/role-arn: "arn:aws:iam::123456789:role/api-role"
    # Azure Workload Identity: link SA to Azure Managed Identity
    azure.workload.identity/client-id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

---
# Associate the ServiceAccount with the Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  template:
    spec:
      serviceAccountName: api-sa    # Pods in this Deployment run as api-sa
      automountServiceAccountToken: true   # SA token mounted at /var/run/secrets/...
      containers:
        - name: api
          image: ghcr.io/myorg/api:1.0.0
```

---

## Pod Security Admission (PSA) — K8s 1.25+

```yaml
# PSA enforces security policies at the namespace level (replaced PodSecurityPolicy).
# Three built-in profiles:
#   privileged: no restrictions (control-plane, system namespaces)
#   baseline:   prevents most known privilege escalations
#   restricted: heavily restricted, follows current Pod hardening best practices

# Label a namespace to enforce the 'restricted' policy
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted   # reject violating Pods
    pod-security.kubernetes.io/audit: restricted     # log warnings
    pod-security.kubernetes.io/warn: restricted      # show warning to user

# Restricted policy requires:
# - runAsNonRoot: true
# - allowPrivilegeEscalation: false
# - seccompProfile: RuntimeDefault or Localhost
# - capabilities: drop ALL
```

```yaml
# A Pod that passes the 'restricted' security profile
spec:
  containers:
    - name: api
      securityContext:
        runAsNonRoot: true              # must not run as root
        runAsUser: 1001                 # specific non-root UID
        runAsGroup: 1001
        allowPrivilegeEscalation: false # cannot gain more privileges than parent
        readOnlyRootFilesystem: true    # container filesystem is read-only
        capabilities:
          drop: ["ALL"]                 # drop ALL Linux capabilities
          # Only add back what you need:
          # add: ["NET_BIND_SERVICE"]
        seccompProfile:
          type: RuntimeDefault          # apply default seccomp filter
```

---

## NetworkPolicy for security (namespace isolation)

```yaml
# Default-deny: deny all ingress and egress in 'production' namespace.
# Then explicitly allow only what's needed.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}                  # {} = applies to ALL pods in namespace
  policyTypes:
    - Ingress
    - Egress
  # No ingress/egress rules = deny everything

---
# Allow api to receive from ingress-nginx, send to postgres, send DNS
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes: [Ingress, Egress]

  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
      ports:
        - port: 3000

  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - port: 5432
    - to:
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - port: 6379
    - ports:                       # DNS must always be allowed
        - port: 53
          protocol: UDP
```

---

## RBAC Audit — test permissions

```bash
# Can 'alice' create Pods in 'production'?
kubectl auth can-i create pods --namespace=production --as=alice

# Can the 'api-sa' ServiceAccount get Secrets?
kubectl auth can-i get secrets \
  --namespace=production \
  --as=system:serviceaccount:production:api-sa

# List all permissions for the current user
kubectl auth can-i --list --namespace=production

# View RBAC for a Service Account
kubectl describe rolebinding -n production | grep -A3 "api-sa"
```

---

## Audit Logging (detect suspicious activity)

```yaml
# Enable API server audit log (set in kube-apiserver flags)
# --audit-log-path=/var/log/k8s-audit.log
# --audit-policy-file=/etc/kubernetes/audit-policy.yaml

apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  # Log all access to Secrets at Metadata level (who accessed, not the values)
  - level: Metadata
    resources:
      - group: ""
        resources: ["secrets"]

  # Log create/delete of Pods at Request level (includes full request body)
  - level: Request
    verbs: ["create", "delete"]
    resources:
      - group: ""
        resources: ["pods"]

  # Skip noisy health checks
  - level: None
    users: ["system:kube-proxy"]
    verbs: ["watch"]
    resources:
      - group: ""
        resources: ["endpoints", "services"]
```

---

## Interview Questions

**Q: What is the difference between Role and ClusterRole?**
> Role is namespace-scoped — its permissions apply only within the namespace it is created in. ClusterRole is cluster-wide — it can grant permissions on cluster-level resources (nodes, PVs) or be reused across namespaces via RoleBindings. You can bind a ClusterRole via a RoleBinding to limit it to one namespace.

**Q: What is a ServiceAccount and why should you create one per workload?**
> A ServiceAccount is an identity for Pods — it provides a token that the Pod uses to authenticate to the Kubernetes API. The 'default' SA has no permissions beyond listing basic info. Creating a dedicated SA per workload follows least privilege: you grant the api SA only what the api Pod needs (e.g., read ConfigMaps), not cluster-wide permissions.

**Q: What is IRSA on AWS EKS?**
> IAM Roles for Service Accounts. You annotate a K8s ServiceAccount with an IAM Role ARN. Pods running under that SA automatically get AWS credentials (via OIDC token exchange) without storing any access keys. The Pod can call S3, SES, Secrets Manager, etc. using the IAM Role's permissions.

**Q: What replaced PodSecurityPolicy (PSP)?**
> Pod Security Admission (PSA), introduced in K8s 1.25. Instead of a separate resource per-namespace, PSA uses namespace labels to enforce built-in profiles: `privileged`, `baseline`, or `restricted`. Much simpler than PSP. For more complex policies, OPA/Gatekeeper or Kyverno are used.

**Q: What is the principle of least privilege in Kubernetes RBAC?**
> Grant only the minimum permissions needed. Examples: a read-only dashboard SA gets only `get/list/watch` on Pods, not `create/delete`. An operator that deploys apps needs `update deployments` but not `delete namespaces`. Use `kubectl auth can-i` to verify permissions. Audit regularly with tools like `rbac-police` or `rakkess`.

---

## 07_advanced.md — Horizontal Pod Autoscaler (HPA)

# Kubernetes: Advanced — HPA, VPA, CRDs, Operators, Affinity

## Horizontal Pod Autoscaler (HPA)

```
HPA watches metrics → scales Deployment replicas up or down automatically
```

```yaml
# Scale 'api' Deployment between 2 and 10 replicas based on CPU usage.
# Target: keep CPU below 70% utilization across all Pods.
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api                       # which Deployment to scale

  minReplicas: 2                    # never go below 2 (for HA)
  maxReplicas: 10                   # never exceed 10

  metrics:
    # CPU metric (Pod CPU usage / Pod CPU request)
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70    # 70% of requested CPU — scale up if above

    # Memory metric
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80

    # Custom metric: scale on HTTP requests per second from Prometheus
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "100"       # scale up if average Pod RPS > 100

  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60    # wait 60s before scaling up again
      policies:
        - type: Pods
          value: 2                       # add max 2 pods per scaling event
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300   # wait 5 min before scaling down (avoid flapping)
      policies:
        - type: Percent
          value: 25                      # remove max 25% of Pods per event
          periodSeconds: 60
```

```bash
# Check HPA status
kubectl get hpa -n production
# NAME      REFERENCE       TARGETS   MINPODS   MAXPODS   REPLICAS
# api-hpa   Deployment/api  45%/70%   2         10        3

kubectl describe hpa api-hpa -n production   # shows scaling events and decisions
```

---

## Vertical Pod Autoscaler (VPA)

```yaml
# VPA adjusts CPU/memory requests and limits automatically based on actual usage.
# Unlike HPA (more replicas), VPA changes the resource spec of existing Pods.
# NOTE: VPA must be installed separately — not built into K8s.
# VPA modes: Off (recommend only), Initial (set on Pod start), Auto (evict + restart)
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: api-vpa
  namespace: production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  updatePolicy:
    updateMode: "Off"               # "Off" = recommend only; don't auto-update
                                    # "Initial" = apply on new Pods, not existing
                                    # "Auto" = evict Pods to apply new recommendations

  resourcePolicy:
    containerPolicies:
      - containerName: api
        minAllowed:
          cpu: 50m
          memory: 64Mi
        maxAllowed:
          cpu: "2"
          memory: 2Gi
```

```bash
# Read VPA recommendations
kubectl describe vpa api-vpa -n production
# Shows:
#   Recommendation:
#     Container Recommendations:
#       Container Name: api
#         Lower Bound:   cpu: 50m, memory: 100Mi
#         Target:        cpu: 200m, memory: 200Mi   ← what to set
#         Upper Bound:   cpu: 500m, memory: 400Mi
```

---

## Custom Resource Definitions (CRD) — extend the K8s API

```yaml
# CRDs let you add your own resource types to Kubernetes.
# After installing a CRD, you use it like any built-in resource:
# kubectl get myresource    kubectl apply -f myresource.yaml

# Example: define a 'Database' custom resource
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: databases.mycompany.com   # must be <plural>.<group>
spec:
  group: mycompany.com
  versions:
    - name: v1
      served: true                # this version is available via API
      storage: true               # this version is stored in etcd
      schema:
        openAPIV3Schema:          # validation schema for the custom resource
          type: object
          properties:
            spec:
              type: object
              required: ["engine", "size"]
              properties:
                engine:
                  type: string
                  enum: ["postgres", "mysql", "redis"]
                size:
                  type: string
                  enum: ["small", "medium", "large"]
                version:
                  type: string
  scope: Namespaced               # Namespaced or Cluster
  names:
    plural: databases
    singular: database
    kind: Database                # Kind used in YAML files
    shortNames: [db]              # kubectl get db
```

```yaml
# Now you can create Database resources!
apiVersion: mycompany.com/v1
kind: Database
metadata:
  name: api-database
  namespace: production
spec:
  engine: postgres
  size: medium
  version: "16"
```

---

## Operators — automate Day-2 operations

```
An Operator = CRD + a controller that watches the CRD and reconciles desired state.
Used for complex stateful applications that need operational knowledge baked in:
  - CloudNativePG (Postgres)
  - Redis Operator
  - Prometheus Operator
  - Cert-Manager
  - Strimzi (Kafka)
```

```javascript
// Simplified Operator logic (written in Node.js with @kubernetes-client/javascript)
// Operators use the control loop:  WATCH → RECONCILE → REPEAT

const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

// Watch for Database custom resources
const watch = new k8s.Watch(kc);
watch.watch(
  '/apis/mycompany.com/v1/namespaces/production/databases',
  {},

  // Called on every ADD, MODIFY, DELETE event
  async (type, apiObj) => {
    const { name, namespace } = apiObj.metadata;
    const { engine, size } = apiObj.spec;

    if (type === 'ADDED' || type === 'MODIFIED') {
      console.log(`Reconciling Database: ${name} (${engine}, ${size})`);

      // The operator provisions/updates the real database:
      // - Creates a StatefulSet for the DB engine
      // - Creates a Service for connectivity
      // - Creates a Secret with credentials
      // - Sets up backups (CronJob)
      await reconcileDatabase(namespace, name, engine, size);
    }

    if (type === 'DELETED') {
      console.log(`Cleaning up Database: ${name}`);
      await deleteDatabase(namespace, name);
    }
  },

  (err) => console.error('Watch error:', err),
);
```

---

## Affinity and Anti-Affinity — control Pod placement

```yaml
# NodeAffinity: schedule Pods only on specific nodes
# PodAffinity: schedule Pods NEAR other Pods
# PodAntiAffinity: schedule Pods AWAY from other Pods

spec:
  affinity:
    # ---- NodeAffinity: only schedule on nodes in us-east-1a or us-east-1b ----
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:   # hard requirement
        nodeSelectorTerms:
          - matchExpressions:
              - key: topology.kubernetes.io/zone
                operator: In
                values: [us-east-1a, us-east-1b]

      preferredDuringSchedulingIgnoredDuringExecution:  # soft preference
        - weight: 1
          preference:
            matchExpressions:
              - key: node-type
                operator: In
                values: [compute-optimized]

    # ---- PodAntiAffinity: SPREAD api Pods across nodes (no two on same node) ----
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchLabels:
              app: api             # don't colocate with other api Pods
          topologyKey: kubernetes.io/hostname   # "hostname" = one per node rule
```

---

## Taints and Tolerations — reserve nodes for specific workloads

```bash
# Taint a node: "only GPU workloads can run here"
kubectl taint nodes gpu-node-1 gpu=true:NoSchedule
# Effect options:
#   NoSchedule:       new Pods without toleration won't be scheduled
#   PreferNoSchedule: try not to schedule, but will if necessary
#   NoExecute:        evict existing Pods without toleration too

# Remove a taint
kubectl taint nodes gpu-node-1 gpu=true:NoSchedule-
```

```yaml
# Pods must declare a toleration to be scheduled on a tainted node
spec:
  tolerations:
    - key: gpu
      operator: Equal
      value: "true"
      effect: NoSchedule
  nodeSelector:
    gpu: "true"            # also select only the GPU node
```

---

## Admission Webhooks — intercept and mutate/validate API requests

```yaml
# MutatingAdmissionWebhook: auto-modify Pods before saving to etcd
# Example: auto-inject a sidecar container into every Pod

apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: sidecar-injector
webhooks:
  - name: inject.mycompany.com
    admissionReviewVersions: ["v1"]
    clientConfig:
      service:
        name: sidecar-injector
        namespace: system
        path: /inject
      caBundle: <base64-encoded-CA-cert>   # TLS required for admission webhooks
    rules:
      - operations: ["CREATE"]
        apiGroups: [""]
        apiVersions: ["v1"]
        resources: ["pods"]
    namespaceSelector:
      matchLabels:
        inject-sidecar: "true"    # only inject in namespaces with this label
    failurePolicy: Fail            # Fail: reject Pod if webhook is down
                                   # Ignore: allow Pod even if webhook fails
```

---

## Interview Questions

**Q: What is the difference between HPA and VPA?**
> HPA scales horizontally — it changes the NUMBER of Pod replicas based on CPU, memory, or custom metrics. VPA scales vertically — it adjusts the CPU/memory requests and limits of existing Pods. They solve different problems: HPA for handling load spikes, VPA for right-sizing under-resourced Pods. They can be combined but require care (VPA must not fight HPA on memory-based metrics).

**Q: What is an Operator and why is it useful?**
> An Operator is a custom controller that automates the management of complex stateful apps (Postgres, Kafka, Elasticsearch). It bundles operational knowledge (how to scale, backup, failover, upgrade) into code. Instead of a human running `kubectl exec` to initiate a Postgres failover, the Operator watches the cluster state and does it automatically.

**Q: What is a CRD?**
> Custom Resource Definition — extends the Kubernetes API with new resource types. After creating a CRD, you can create, list, and update instances of that custom resource using kubectl. CRDs are the foundation that Operators build on.

**Q: What is the difference between required and preferred affinity?**
> `requiredDuringScheduling`: Pod will NOT be scheduled if the constraint cannot be met — hard requirement. If no matching nodes exist, the Pod stays in Pending.
> `preferredDuringScheduling`: Scheduler TRIES to meet the constraint but will schedule elsewhere if necessary. Use required for strict topology requirements (e.g., same AZ as database), preferred for performance hints.

**Q: What is the stabilizationWindowSeconds in HPA?**
> It prevents flapping — the HPA waits this many seconds before deciding to scale again. A 300-second scaleDown window means: if load drops, HPA won't immediately remove replicas — it waits 5 minutes to confirm the drop is sustained. Without this, a brief load dip triggers scale-down, then the next spike triggers scale-up — constant churn.

---

## 08_helm_interview_qa.md — What is Helm?

# Kubernetes: Helm and Interview Q&A

## What is Helm?
Helm is the package manager for Kubernetes. It bundles all the YAML files needed
to deploy an application into a "Chart" — a reusable, parameterised template.

```
Helm Chart     = recipe (templates + default values)
Values file    = ingredients (your overrides)
Release        = a deployed instance of a chart into a cluster
```

---

## Helm Chart Structure

```
mychart/
├── Chart.yaml           ← chart metadata (name, version, description)
├── values.yaml          ← default configuration values
├── templates/           ← YAML templates with {{ .Values.xxx }} placeholders
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── hpa.yaml
│   ├── _helpers.tpl     ← reusable template snippets (not rendered as K8s objects)
│   └── NOTES.txt        ← printed to user after 'helm install'
├── charts/              ← chart dependencies (sub-charts)
└── .helmignore          ← files to exclude (like .gitignore)
```

---

## Chart.yaml

```yaml
# Describes the chart itself
apiVersion: v2                      # Helm 3 charts use v2
name: myapp
description: A production-ready Node.js API chart
type: application                   # 'application' or 'library'
version: 0.3.0                      # chart version (semver) — bump when chart changes
appVersion: "2.1.0"                 # version of the APPLICATION being deployed
keywords: [nodejs, api, microservice]
maintainers:
  - name: Alice
    email: alice@example.com
dependencies:
  # Sub-chart: pull in PostgreSQL chart from Bitnami
  - name: postgresql
    version: "13.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled   # toggle via values.yaml
```

---

## values.yaml — defaults

```yaml
# All template values are sourced from here (or overridden at deploy time)
replicaCount: 2

image:
  repository: ghcr.io/myorg/api
  pullPolicy: IfNotPresent
  tag: ""                   # when "", uses appVersion from Chart.yaml

service:
  type: ClusterIP
  port: 80
  targetPort: 3000

ingress:
  enabled: false
  className: nginx
  host: myapp.example.com
  tlsSecretName: myapp-tls

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

env:
  NODE_ENV: production
  LOG_LEVEL: info

postgresql:
  enabled: true             # enable the postgresql sub-chart dependency
  auth:
    username: myapp
    database: myapp
```

---

## templates/deployment.yaml

```yaml
# Templates use Go templating syntax.
# {{ .Values.xxx }}      reads from values.yaml
# {{ .Release.Name }}    the Helm release name (set at install time)
# {{ .Chart.Name }}      chart name from Chart.yaml
# {{ include "mychart.fullname" . }} calls a helper from _helpers.tpl

apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "mychart.fullname" . }}
  labels:
    {{- include "mychart.labels" . | nindent 4 }}    # nindent = indent + newline
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}               # only set if HPA is disabled
  {{- end }}
  selector:
    matchLabels:
      {{- include "mychart.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "mychart.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - containerPort: {{ .Values.service.targetPort }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}   # toYaml renders the map
          env:
            {{- range $key, $val := .Values.env }}
            - name: {{ $key }}
              value: {{ $val | quote }}
            {{- end }}
```

---

## templates/_helpers.tpl

```
{{/*
  _helpers.tpl defines reusable named templates.
  They are included with {{ include "mychart.xxx" . }}
  The file's name starts with _ so Helm doesn't render it as a K8s object.
*/}}

{{/* Generate the full name: release-name + chart-name, or override */}}
{{- define "mychart.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/* Common labels applied to all resources */}}
{{- define "mychart.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
```

---

## Helm CLI Commands

```bash
# ── INSTALL & UPGRADE ────────────────────────────────────────────────────────

# First-time install: release name = 'myapp-prod', chart = './mychart'
helm install myapp-prod ./mychart \
  --namespace production \
  --create-namespace \
  --values ./values.production.yaml   # override with environment-specific values

# Upgrade an existing release (applies changes)
helm upgrade myapp-prod ./mychart \
  --namespace production \
  --values ./values.production.yaml \
  --set image.tag=2.2.0               # override single value inline

# Install OR upgrade in one command (idempotent — safe to run in CI)
helm upgrade --install myapp-prod ./mychart \
  --namespace production \
  --values ./values.production.yaml \
  --atomic                            # rollback automatically if upgrade fails
  --timeout 5m                        # wait up to 5 min for rollout

# ── ROLLBACK ─────────────────────────────────────────────────────────────────

helm history myapp-prod -n production   # see revision history
# REVISION  STATUS     CHART            APP VERSION  DESCRIPTION
# 1         superseded myapp-0.1.0      2.0.0        Install complete
# 2         deployed   myapp-0.3.0      2.1.0        Upgrade complete

helm rollback myapp-prod 1 -n production   # roll back to revision 1

# ── INSPECT & DEBUG ──────────────────────────────────────────────────────────

helm list -n production                 # list all releases
helm status myapp-prod -n production    # current status
helm get values myapp-prod -n production   # see current values
helm get manifest myapp-prod -n production # see rendered YAML

# Dry-run: render templates without deploying (great for CI validation)
helm install myapp-prod ./mychart --dry-run --debug

# Lint: check chart for issues
helm lint ./mychart

# Template: render to stdout (pipe to kubectl diff for change preview)
helm template myapp-prod ./mychart --values values.production.yaml | kubectl diff -f -

# ── REPOSITORIES ─────────────────────────────────────────────────────────────

helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm search repo bitnami/postgresql
helm install my-db bitnami/postgresql --version 13.x.x
```

---

## Helm in CI/CD (Azure DevOps Pipeline)

```yaml
# azure-pipelines.yml — build, push image, deploy with Helm to AKS

trigger:
  branches:
    include:
      - main

variables:
  imageRepository: myapp
  containerRegistry: myregistry.azurecr.io
  helmChartPath: ./helm/mychart
  aksCluster: my-aks-cluster
  aksResourceGroup: my-resource-group
  namespace: production

stages:
  # ── Stage 1: Build & Push Docker Image ──────────────────────────────────
  - stage: BuildAndPush
    displayName: "Build & Push Image"
    jobs:
      - job: Build
        pool:
          vmImage: ubuntu-latest
        steps:
          - task: Docker@2
            displayName: "Build and push to ACR"
            inputs:
              containerRegistry: my-acr-service-connection   # set up in Azure DevOps
              repository: $(imageRepository)
              command: buildAndPush
              Dockerfile: Dockerfile
              tags: |
                $(Build.BuildId)
                latest

  # ── Stage 2: Run Tests ───────────────────────────────────────────────────
  - stage: Test
    displayName: "Run Tests"
    dependsOn: BuildAndPush
    jobs:
      - job: UnitTests
        pool:
          vmImage: ubuntu-latest
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: "20.x"
          - script: npm ci
            displayName: "Install dependencies"
          - script: npm test -- --reporter=junit --output=test-results.xml
            displayName: "Run unit tests"
          - task: PublishTestResults@2
            inputs:
              testResultsFormat: JUnit
              testResultsFiles: test-results.xml

  # ── Stage 3: Deploy to Staging ──────────────────────────────────────────
  - stage: DeployStaging
    displayName: "Deploy to Staging"
    dependsOn: Test
    environment: staging                  # creates an Environment in Azure DevOps
    jobs:
      - deployment: HelmDeploy
        pool:
          vmImage: ubuntu-latest
        strategy:
          runOnce:
            deploy:
              steps:
                - task: KubernetesManifest@1
                  displayName: "Set image tag"
                  inputs:
                    action: bake           # just renders the chart, not deploy yet
                    renderType: helm
                    releaseName: myapp-staging
                    helmChart: $(helmChartPath)
                    overrideFiles: helm/values.staging.yaml
                    overrides: "image.tag:$(Build.BuildId)"

                - task: HelmDeploy@0
                  displayName: "Helm upgrade --install (staging)"
                  inputs:
                    connectionType: Azure Resource Manager
                    azureSubscription: my-azure-subscription
                    azureResourceGroup: $(aksResourceGroup)
                    kubernetesCluster: $(aksCluster)
                    namespace: staging
                    command: upgrade
                    chartType: FilePath
                    chartPath: $(helmChartPath)
                    releaseName: myapp-staging
                    overrideFiles: helm/values.staging.yaml
                    arguments: >
                      --set image.tag=$(Build.BuildId)
                      --atomic
                      --timeout 5m0s

  # ── Stage 4: Manual Approval → Deploy to Production ─────────────────────
  - stage: DeployProduction
    displayName: "Deploy to Production"
    dependsOn: DeployStaging
    condition: succeeded()
    jobs:
      - deployment: HelmDeployProd
        pool:
          vmImage: ubuntu-latest
        environment: production           # 'production' environment requires manual approval
                                          # Configure approvals in: Azure DevOps → Environments → production → Approvals
        strategy:
          runOnce:
            deploy:
              steps:
                - task: HelmDeploy@0
                  displayName: "Helm upgrade --install (production)"
                  inputs:
                    connectionType: Azure Resource Manager
                    azureSubscription: my-azure-subscription
                    azureResourceGroup: $(aksResourceGroup)
                    kubernetesCluster: $(aksCluster)
                    namespace: production
                    command: upgrade
                    chartType: FilePath
                    chartPath: $(helmChartPath)
                    releaseName: myapp-prod
                    overrideFiles: helm/values.production.yaml
                    arguments: >
                      --set image.tag=$(Build.BuildId)
                      --atomic
                      --timeout 5m0s
```

---

## Helm in CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Login to Azure Container Registry
      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      # Set up kubectl context pointing to AKS
      - uses: azure/aks-set-context@v3
        with:
          resource-group: my-resource-group
          cluster-name: my-aks-cluster

      # Run helm upgrade --install
      - name: Helm deploy
        run: |
          helm upgrade --install myapp-prod ./helm/mychart \
            --namespace production \
            --create-namespace \
            --values ./helm/values.production.yaml \
            --set image.tag=${{ github.sha }} \
            --atomic \
            --timeout 5m
```

---

## Comprehensive Interview Q&A

**Q: What is the difference between kubectl apply and helm upgrade?**
> `kubectl apply` is imperative at the resource level — you manage each YAML file separately. `helm upgrade` manages ALL the resources of a release as a unit: it tracks what was deployed, diffs against the new chart, and updates/creates/deletes resources accordingly. Helm also provides rollback history, versioning, and parameterisation across environments.

**Q: What does --atomic do in helm upgrade?**
> If the upgrade fails (e.g., a Pod's readinessProbe never passes within the timeout), `--atomic` automatically rolls back the release to the previous good revision. Without it, a failed upgrade leaves the cluster in a degraded half-updated state that you must manually fix.

**Q: How do you separate environment-specific config in Helm?**
> Create separate values files per environment: `values.yaml` (defaults), `values.staging.yaml` (staging overrides), `values.production.yaml` (prod overrides). Pass with `--values` at install time. Example: `values.yaml` has `replicaCount: 1`; `values.production.yaml` overrides with `replicaCount: 5`.

**Q: What is the difference between Helm v2 and Helm v3?**
> Helm v2 required a server-side component called "Tiller" running in the cluster — a security risk (full cluster admin). Helm v3 removed Tiller entirely. All state is stored in Kubernetes Secrets in the release namespace. Authentication uses the same kubeconfig as kubectl — no separate RBAC concerns.

**Q: What are Helm hooks?**
> Hooks allow running Jobs at specific lifecycle points of a release:
> - `pre-install`: run before any resources are created (e.g., create DB user)
> - `post-install`: run after all resources are ready (e.g., seed data)
> - `pre-upgrade` / `post-upgrade`: run DB migrations before/after upgrade
> - `pre-delete`: clean up external resources before uninstall
> Defined by adding annotation: `"helm.sh/hook": pre-upgrade`

**Q: What happens to PVCs when you helm uninstall?**
> By default, PVCs are NOT deleted by `helm uninstall` — they are left behind to prevent data loss. To delete them, you must explicitly `kubectl delete pvc` or add `"helm.sh/resource-policy": keep` and manage deletion separately. This is intentional behaviour for databases.

**Q: How do you manage secrets securely with Helm?**
> Never put real secrets in `values.yaml` or commit them to Git. Options:
> 1. Use `helm-secrets` plugin (encrypts values files with SOPS/Age)
> 2. Reference K8s Secrets that are managed outside Helm (by External Secrets Operator)
> 3. Use `--set` with values from CI/CD secret variables (e.g., Azure DevOps secret variables or GitHub Actions secrets) — they are never written to disk

**Q: What is a Helm dependency / sub-chart?**
> A chart can depend on other charts (e.g., your app chart depends on the Bitnami PostgreSQL chart). Listed in `Chart.yaml` under `dependencies`. Run `helm dependency update` to download them into the `charts/` folder. Enable/disable sub-charts with a `condition` key tied to a values flag.

**Q: Explain the Kubernetes control loop pattern.**
> Kubernetes is a reconciliation engine. Every controller runs a loop:
> 1. Observe: read current state (what's deployed)
> 2. Diff: compare to desired state (what's declared in YAML)
> 3. Act: create/update/delete resources to make current = desired
> 4. Repeat forever
> This is why `kubectl apply` is idempotent — if the state is already correct, nothing changes.

**Q: What is kubectl diff and why is it useful in CI?**
> `kubectl diff -f manifest.yaml` shows what would change if you `kubectl apply` the manifest — like `git diff` but for live cluster state. In CI, combine with `helm template | kubectl diff -f -` to show reviewers exactly what K8s resources will change before merging a PR.

**Q: What is the difference between Deployment and DaemonSet?**
> Deployment: runs N replicas, scheduler picks which nodes. DaemonSet: runs exactly one Pod per node (including new nodes added later). Deployments are for application workloads. DaemonSets are for node-level infrastructure: log collectors, monitoring agents, network plugins.

---

## 09_theory_advanced_qa.md — SECTION 1: BASIC

# KUBERNETES — ADVANCED THEORY Q&A
> **Level:** Advanced | **For:** 7+ years experience  
> Companion to `08_helm_interview_qa.md` — covers internals, controller patterns, and production

---

## SECTION 1: BASIC

### Q1 [BASIC]: What are the core components of a Kubernetes cluster?
**A:** Kubernetes has two planes: **Control Plane** (brain) and **Data Plane** (workers).

```
Control Plane (runs on master nodes):
  ┌─────────────────────────────────────────────────────────┐
  │ kube-apiserver    → REST API gateway (all commands go here)
  │ etcd              → distributed key-value store (cluster state)
  │ kube-scheduler    → assigns Pods to Nodes based on resources/constraints
  │ kube-controller-manager → runs reconciliation loops (Deployment, Node, etc.)
  │ cloud-controller-manager → integrates with AWS/GCP/Azure APIs
  └─────────────────────────────────────────────────────────┘

Data Plane (runs on worker nodes):
  ┌─────────────────────────────────────────────────────────┐
  │ kubelet           → agent on each node; ensures containers are running
  │ kube-proxy        → manages iptables/IPVS rules for Service networking
  │ Container runtime → containerd / CRI-O; runs the actual containers
  └─────────────────────────────────────────────────────────┘
```

```bash
# Check control plane component health:
kubectl get componentstatuses
kubectl get pods -n kube-system

# Node status:
kubectl describe node <node-name>
kubectl top nodes    # CPU/memory usage (requires metrics-server)
```

---

### Q2 [BASIC]: What is the difference between a Deployment, StatefulSet, and DaemonSet?
**A:**
| Controller | Pods | Pod Identity | Storage | Use Case |
|-----------|------|------|---------|--------|
| **Deployment** | Interchangeable | None (random names) | Shared or none | Stateless apps (web, API) |
| **StatefulSet** | Ordered, stable | Sticky (`pod-0`, `pod-1`) | Per-pod PVC | Databases, Kafka, Zookeeper |
| **DaemonSet** | One per node | Node-bound | Node-local | Log agents, monitoring, CNI |

```yaml
# StatefulSet — each pod gets a stable hostname and its own PVC:
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: "postgres"        # headless service for stable DNS
  replicas: 3
  selector:
    matchLabels: { app: postgres }
  template:
    metadata:
      labels: { app: postgres }
    spec:
      containers:
      - name: postgres
        image: postgres:15
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:          # ← each pod gets its OWN PVC (postgres-data-postgres-0, etc.)
  - metadata:
      name: data
    spec:
      accessModes: [ReadWriteOnce]
      resources:
        requests:
          storage: 10Gi
# Pods: postgres-0, postgres-1, postgres-2 (stable, in order)
# DNS:  postgres-0.postgres.default.svc.cluster.local
```

---

## SECTION 2: INTERMEDIATE

### Q3 [INTERMEDIATE]: How does etcd maintain consistency in Kubernetes?
**A:** etcd uses the **Raft consensus algorithm** to maintain consistency across multiple etcd nodes.

```
Raft basics:
1. One node is elected LEADER (via randomized election timeout)
2. All WRITES go to the leader
3. Leader replicates each write to a QUORUM (majority) of followers before acknowledging
4. Cluster tolerates failures: with 3 nodes → 1 failure tolerated; 5 nodes → 2 failures
5. READS: by default, served by leader only (linearizable reads — never stale)

Why 3 or 5 etcd nodes (never even numbers):
  3 nodes → quorum = 2 → tolerate 1 failure
  5 nodes → quorum = 3 → tolerate 2 failures
  4 nodes → quorum = 3 → tolerate only 1 failure (same as 3, but more expensive)
```

```bash
# etcd health check:
ETCDCTL_API=3 etcdctl endpoint health \
  --endpoints=https://etcd1:2379,https://etcd2:2379,https://etcd3:2379 \
  --cacert=/etc/k8s/pki/etcd/ca.crt \
  --cert=/etc/k8s/pki/etcd/healthcheck-client.crt \
  --key=/etc/k8s/pki/etcd/healthcheck-client.key

# Backup etcd (CRITICAL — do this before cluster upgrades):
ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-$(date +%Y%m%d).db

# List cluster state:
ETCDCTL_API=3 etcdctl get / --prefix --keys-only | head -20
# Shows: /registry/pods/default/..., /registry/services/..., etc.
```

---

### Q4 [INTERMEDIATE]: How does kube-proxy work? iptables vs IPVS mode.
**A:** kube-proxy watches the API server for Service/Endpoints changes and programs the kernel networking rules to implement Service load balancing.

```
iptables mode (default):
  - Creates iptables PREROUTING rules for each Service ClusterIP
  - Randomly selects one Endpoint for each connection (per-connection load balancing)
  - Problem: O(n) rule traversal — with 10,000 services, every packet checks 10k rules
  - All rules re-written on each Endpoint change (O(n) update cost)

IPVS mode (recommended for large clusters):
  - Uses Linux kernel's IPVS (IP Virtual Server) — a proper load balancer in kernel
  - O(1) lookup via hash tables (not linear iptables traversal)
  - Multiple algorithms: rr (default), lc (least connections), sh (source hash)
  - Handles 100,000+ services efficiently
```

```bash
# Check current mode:
kubectl get configmap -n kube-system kube-proxy -o yaml | grep mode

# Enable IPVS mode (in kube-proxy ConfigMap):
# mode: "ipvs"
# ipvs:
#   scheduler: "lc"   # least connections

# Inspect IPVS rules on a node:
ipvsadm -Ln                    # list all IPVS virtual services
ipvsadm -Ln --stats            # show connection stats per service

# For a Service with ClusterIP 10.96.0.1:80:
# IPVS entry: TCP 10.96.0.1:80 rr
#   → 10.244.1.5:8080 (Pod 1)
#   → 10.244.2.3:8080 (Pod 2)
```

---

### Q5 [INTERMEDIATE]: How does the Kubernetes scheduler make placement decisions?
**A:** Scheduling is a two-phase process: **Filtering** (which nodes are eligible?) then **Scoring** (which is best?).

```
Phase 1 — Filtering plugins (all must pass):
  - NodeUnschedulable: skip nodes with node.kubernetes.io/unschedulable
  - PodFitsResources: node has enough CPU/memory for pod requests
  - NodeAffinity: node matches pod's nodeAffinity rules
  - TaintToleration: pod tolerates all node taints
  - VolumeBinding: required PVCs can be bound to PVs on this node
  - PodTopologySpread: spread constraints satisfied

Phase 2 — Scoring plugins (higher = better):
  - LeastAllocated: prefer nodes with most available resources
  - NodeAffinity: bonus points for preferred node affinity
  - InterPodAffinity: bonus for co-locating with preferred pods
  - ImageLocality: prefer nodes that already have the container image

Final: pod is bound to highest-scoring node.
```

```yaml
# nodeAffinity — prefer SSD nodes, require specific region:
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:   # hard requirement
        nodeSelectorTerms:
        - matchExpressions:
          - key: topology.kubernetes.io/region
            operator: In
            values: [us-east-1]
      preferredDuringSchedulingIgnoredDuringExecution:  # soft preference
      - weight: 80
        preference:
          matchExpressions:
          - key: node.kubernetes.io/disk-type
            operator: In
            values: [ssd]

# topologySpreadConstraints — spread pods across zones:
  topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels: { app: myapp }
```

---

## SECTION 3: ADVANCED

### Q6 [ADVANCED]: How does the controller reconciliation loop work? Implement a custom controller pattern.
**A:** Every Kubernetes controller implements the **control loop**: observe desired state → compare with current state → act to reconcile.

```
controller-manager runs N controllers, each:

 ┌─────────────────────────────────────────────────────────────┐
 │  Watch API server for changes (via informer/reflector)       │
 │       ↓                                                      │
 │  Add event to work queue (with key: namespace/name)          │
 │       ↓                                                      │
 │  Worker goroutine dequeues item → runs Reconcile(key)        │
 │       ↓                                                      │
 │  Get CURRENT state from lister (local cache, not API call)   │
 │       ↓                                                      │
 │  Compute DESIRED state                                       │
 │       ↓                                                      │
 │  Call API server to create/update/delete to match desired    │
 │       ↓                                                      │
 │  If error → re-queue with exponential backoff                │
 └─────────────────────────────────────────────────────────────┘
```

```go
// Reconciliation pattern (Go pseudo-code — controller-runtime):
func (r *MyAppReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    // 1. Fetch the custom resource
    app := &appsv1alpha1.MyApp{}
    if err := r.Get(ctx, req.NamespacedName, app); err != nil {
        if errors.IsNotFound(err) {
            return ctrl.Result{}, nil  // deleted — nothing to do
        }
        return ctrl.Result{}, err
    }

    // 2. Check if the desired Deployment exists
    deployment := &appsv1.Deployment{}
    err := r.Get(ctx, req.NamespacedName, deployment)
    if errors.IsNotFound(err) {
        // 3. Create it if not found
        dep := r.buildDeployment(app)
        return ctrl.Result{}, r.Create(ctx, dep)
    }

    // 4. Reconcile: ensure current state matches desired
    if *deployment.Spec.Replicas != app.Spec.Replicas {
        deployment.Spec.Replicas = &app.Spec.Replicas
        return ctrl.Result{}, r.Update(ctx, deployment)
    }

    // 5. Update status
    app.Status.ReadyReplicas = deployment.Status.ReadyReplicas
    return ctrl.Result{RequeueAfter: 30 * time.Second}, r.Status().Update(ctx, app)
}
```

---

### Q7 [ADVANCED]: How does the API server admission chain work?
**A:** Every write request to the API server passes through a pipeline before being persisted to etcd.

```
Client Request → Authentication → Authorization (RBAC) → Admission Control → etcd

Admission Control has two phases (run in order):
1. Mutating Webhooks  → can MODIFY the request (add defaults, inject sidecars)
2. Validating Webhooks → can REJECT the request (policy enforcement)

Built-in admission controllers (run before webhooks):
  - NamespaceLifecycle: prevent objects in terminating namespaces
  - LimitRanger: enforce LimitRange defaults (auto-add resources if not set)
  - ServiceAccount: auto-inject service account token
  - ResourceQuota: enforce namespace resource quotas
  - MutatingAdmissionWebhook: call external webhook (mutate)
  - ValidatingAdmissionWebhook: call external webhook (validate)
```

```yaml
# Custom ValidatingWebhookConfiguration:
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: require-resource-limits
webhooks:
- name: require-limits.mycompany.com
  rules:
  - apiGroups: [""]
    apiVersions: ["v1"]
    operations: ["CREATE", "UPDATE"]
    resources: ["pods"]
  clientConfig:
    service:
      name: webhook-service
      namespace: webhook-system
      path: "/validate-pod"
    caBundle: <base64-encoded-CA>
  admissionReviewVersions: ["v1"]
  sideEffects: None
  failurePolicy: Fail   # ← Fail = reject if webhook is unreachable (safer for security)
                        # Ignore = allow if webhook is unreachable (faster, less safe)
```

---

### Q8 [ADVANCED]: How does CNI (Container Network Interface) work? Calico vs Cilium.
**A:** CNI plugins connect pod network namespaces to the cluster network.

```
When kubelet creates a pod:
1. Creates network namespace: /var/run/netns/<pod-uid>
2. Calls CNI plugin binary with ADD command
3. CNI plugin: creates veth pair (one end in pod netns, one in host netns)
4. CNI assigns IP from the pod CIDR
5. Sets up routes so other pods can reach this pod's IP

Without CNI, pods would be isolated network namespaces with no connectivity.

Calico (eBPF or iptables):
  - Uses BGP to advertise pod routes across nodes (no overlay network)
  - Native routing: packets don't have extra encapsulation header
  - iptables OR eBPF data plane
  - Network Policy: very mature, supports GlobalNetworkPolicy (cluster-wide)

Cilium (eBPF-native):
  - eBPF programs replace iptables entirely (kube-proxy replacement)
  - L7 policy: can filter by HTTP path, gRPC method (not just IP/port)
  - Native service mesh features (mTLS, observability) via Hubble
  - Much faster at large scale (eBPF hash maps vs iptables chains)
  - Better for zero-trust environments
```

```bash
# Check CNI configuration:
ls /etc/cni/net.d/          # CNI config files
ls /opt/cni/bin/            # CNI plugin binaries

# Cilium status:
cilium status
cilium connectivity test    # end-to-end network test

# Observe network flows (Hubble - Cilium's observability layer):
hubble observe --namespace default --pod myapp-xxx
hubble observe --type drop   # show dropped packets (policy violations)
```

---

### Q9 [ADVANCED]: How do you implement leader election for a controller?
**A:** If you run multiple replicas of your controller for HA, only ONE should actively reconcile (split-brain = dangerous). Kubernetes uses a **Lease** object for leader election.

```yaml
# Lease object (etcd-backed, short TTL):
apiVersion: coordination.k8s.io/v1
kind: Lease
metadata:
  name: my-controller-leader
  namespace: kube-system
spec:
  holderIdentity: "pod-abc-123"      # current leader's pod name
  leaseDurationSeconds: 15           # leader must renew within 15s
  acquireTime: "2026-03-12T10:00:00Z"
  renewTime: "2026-03-12T10:00:10Z"  # last renewal
```

```go
// Leader election with controller-runtime:
mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
    LeaderElection:          true,
    LeaderElectionID:        "my-controller-leader",
    LeaderElectionNamespace: "kube-system",
    LeaseDuration:           pointer.Duration(15 * time.Second),
    RenewDeadline:           pointer.Duration(10 * time.Second),
    RetryPeriod:             pointer.Duration(2 * time.Second),
    // Only the leader runs the reconcile loop.
    // Standby replicas wait, watching the Lease.
    // If leader dies (lease expires), a standby acquires the lease and becomes leader.
})
```

---

### Q10 [ADVANCED]: How does Kubernetes Handle Node Failure and Pod Rescheduling?
**A:** Node failure detection and pod rescheduling flow:

```
1. Node stops sending heartbeats (kubelet sends Node status every 10s)
2. After node-monitor-grace-period (default 40s): Node marked "Unknown"
3. After pod-eviction-timeout (default 5m): controller manager marks pods for deletion
4. Scheduler reschedules deleted pods on healthy nodes

Key controllers:
  NodeLifecycle controller: watches node health, adds NoExecute taints on failure
    - node.kubernetes.io/not-ready:NoExecute     → pods without toleration get evicted
    - node.kubernetes.io/unreachable:NoExecute   → same

  Garbage collection: cleans up orphaned pods

Tuning for faster failover (at cost of instability):
```

```yaml
# Toleration with timeout → pod evicted 30s after node becomes NotReady:
spec:
  tolerations:
  - key: "node.kubernetes.io/not-ready"
    operator: "Exists"
    effect: "NoExecute"
    tolerationSeconds: 30      # ← default is 300 (5 min); set lower for faster rescheduling

  - key: "node.kubernetes.io/unreachable"
    operator: "Exists"
    effect: "NoExecute"
    tolerationSeconds: 30

# PodDisruptionBudget — ensure minimum availability during voluntary disruptions:
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: myapp-pdb
spec:
  minAvailable: 2              # always keep at least 2 pods running
  # OR: maxUnavailable: 1
  selector:
    matchLabels: { app: myapp }
# kubectl drain will respect this budget (waits for new pod to be ready before evicting)
```

---

