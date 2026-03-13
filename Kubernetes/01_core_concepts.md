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
