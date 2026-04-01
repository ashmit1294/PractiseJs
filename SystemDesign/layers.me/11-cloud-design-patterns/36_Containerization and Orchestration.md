# 36 — Containerization & Orchestration

> **Module**: M11 — Cloud Design Patterns  
> **Section**: Additional Topics  
> **Source**: https://layrs.me/course/hld/11-cloud-design-patterns/containerization-and-orchestration  
> **Difficulty**: Intermediate | 32 min read

---

## 1. ELI5 — Explain Like I'm 5

Imagine packing your toys in a special box that works anywhere you take it: your house, grandma's house, a friend's house. The box has everything the toys need to work. That's a **container**.

Now imagine a robot that manages thousands of these boxes: decides which shelf to put them on, replaces broken ones, adds more boxes when lots of friends want to play with the same toys, and takes away boxes when nobody is playing. That robot is an **orchestrator** (like Kubernetes).

---

## 2. The Analogy

**Containerization** = the shipping container revolution. Before, loading a ship meant thousands of different-sized boxes, crates, barrels — slow, error-prone. Shipping containers standardized everything: one box that works on any ship, truck, or train.

**Container orchestration** = the automated port management system. It decides which containers go on which ships, monitors locations, reroutes around problems, and ensures the right number of containers are always moving — all without human intervention for each decision.

---

## 3. Core Concept

**Containerization** packages an application with all its dependencies (libraries, runtime, config) into a standardized, portable unit. Unlike VMs that virtualize hardware and run a full OS, containers virtualize the OS and share the host kernel — making them 10–100× lighter and starting in milliseconds.

**Orchestration** automates the deployment, scaling, networking, and lifecycle management of containers across clusters. Kubernetes is the industry standard: you declare desired state ("I want 10 replicas of this service") and the system continuously reconciles actual state toward it.

### Key Comparison: Container vs. VM

```
Container Architecture          VM Architecture
───────────────────────         ───────────────────────
Physical Hardware               Physical Hardware
Host OS (shared kernel)         Hypervisor
Container Runtime               VM 1: Guest OS + App A
  Container 1: Bins + App A     VM 2: Guest OS + App B
  Container 2: Bins + App B     VM 3: Guest OS + App C
  Container 3: Bins + App C
```

- **Containers**: millisecond startup, MB of memory, shared kernel (weaker isolation)
- **VMs**: minute startup, GB of memory, full OS (stronger isolation)

---

## 4. ASCII Architecture

### Kubernetes Cluster

```
                    Internet
                       │
              [Load Balancer / Ingress]
                       │
         ┌─────────────────────────────┐
         │       Control Plane          │
         │  ┌──────────┐ ┌───────────┐ │
         │  │API Server│ │ Scheduler │ │
         │  └──────────┘ └───────────┘ │
         │  ┌────────────┐ ┌────────┐  │
         │  │Controller  │ │  etcd  │  │
         │  │Manager     │ │(state) │  │
         │  └────────────┘ └────────┘  │
         └─────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
   Worker Node 1               Worker Node 2
   ┌─────────────┐             ┌─────────────┐
   │ kubelet     │             │ kubelet     │
   │ kube-proxy  │             │ kube-proxy  │
   │ Container RT│             │ Container RT│
   │ ┌─────────┐ │             │ ┌─────────┐ │
   │ │Pod: API │ │             │ │Pod: API │ │
   │ └─────────┘ │             │ └─────────┘ │
   │ ┌─────────┐ │             │ ┌─────────┐ │
   │ │Pod: FE  │ │             │ │Pod: Work│ │
   │ └─────────┘ │             │ └─────────┘ │
   └─────────────┘             └─────────────┘
```

### Kubernetes Scheduling Flow

```
kubectl apply deployment.yaml
         │
         ▼
[API Server] → store desired state in [etcd]
         │
         ▼
[Controller Manager] → watch for new Deployments → create 5 Pods
         │
         ▼
[Scheduler] → watch for unscheduled Pods → bind to nodes (based on resource fit)
         │
         ▼
[Kubelet on Worker Node] → pull image → create container (namespaces + cgroups)
         │
         ▼
      Container Running
         │
         ▼
[Kubelet] → run liveness probe → HTTP 200 OK → update Pod status: Ready
```

---

## 5. How It Works

### Containerization Process

1. **Image Creation**: Dockerfile defines environment — base OS, dependencies, app code, startup command. `docker build` creates a layered, immutable image. Layers are cached and reused.

2. **Image Storage**: Pushed to registry (Docker Hub, AWS ECR, GCR). Identified by `repo:tag@sha256:hash`. Never use `latest` in production.

3. **Container Runtime**: Runtime (Docker, containerd, CRI-O) pulls image, creates isolated namespaces (process, network, filesystem), applies resource limits (CPU, memory via cgroups), starts app process. Container sees its own filesystem and network but shares host kernel.

### Kubernetes Orchestration Process

4. **Cluster Setup**: Control plane (API server, scheduler, controller manager, etcd) manages state. Worker nodes (kubelet, kube-proxy, container runtime) run workloads.

5. **Workload Deployment**: YAML manifests define desired state. Deployments specify replicas, Services define networking, ConfigMaps/Secrets provide config. `kubectl apply -f deployment.yaml` sends to API server.

6. **Scheduling**: Scheduler places Pods on nodes based on resource requests, affinity rules, taints/tolerations. Kubelet receives assignment, pulls image, starts containers.

7. **Service Discovery**: Services get stable DNS names and virtual IPs. kube-proxy configures iptables/IPVS rules. External traffic enters via Ingress or LoadBalancer services.

8. **Health Monitoring**: Liveness probes (is container alive? → restart if not). Readiness probes (should it receive traffic? → remove from Service endpoints if not).

9. **Scaling**: HPA monitors metrics (CPU, custom Prometheus metrics), adjusts replicas. `Desired = ceil(current_replicas × current_metric / target_metric)`.

10. **Rolling Updates**: New Pods created; old Pods terminated only after new ones pass health checks. `maxUnavailable: 0` ensures continuity. Failed health checks pause rollout.

---

## 6. Variants / Types

### Container Runtimes

| Runtime | Description | Use When |
|---------|-------------|----------|
| **Docker** | Original, developer-friendly, full platform | Local development, simple prod |
| **containerd** | Lightweight, Kubernetes default | Production Kubernetes clusters |
| **CRI-O** | Kubernetes-native, minimal surface | OpenShift, Kubernetes-only environments |

### Orchestration Platforms

| Platform | Description | Use When |
|----------|-------------|----------|
| **Kubernetes** | Industry standard, cloud-agnostic, extensible | Multi-cloud, advanced features needed |
| **Amazon ECS** | Proprietary, deep AWS integration | AWS-only shops, simpler ops |
| **Docker Swarm** | Built-in Docker, minimal setup | Small deployments, <10 services |
| **Nomad (HashiCorp)** | Multi-workload (containers + VMs + binaries) | Heterogeneous infrastructure |
| **Serverless Containers** (Fargate, Cloud Run, ACI) | Zero cluster management | Event-driven, variable traffic, zero ops |

### Deployment Strategies

| Strategy | How | Rollback | Capacity |
|----------|-----|----------|----------|
| **Rolling Update** | Gradual Pod replacement | Slow | No extra |
| **Blue-Green** | Full new version beside old, instant switch | Instant | 2× |
| **Canary** | Small % to new, monitor, increase | Easy | Slight extra |

---

## 7. Trade-offs

### Containers vs. VMs

| Factor | Containers | VMs |
|--------|-----------|-----|
| Startup time | Milliseconds | Minutes |
| Memory | MBs (10–100× less) | GBs |
| Density | 100s per host | Dozens per host |
| Security isolation | Weaker (shared kernel) | Stronger (kernel exploit can't escape) |
| Use for | Trusted microservices | Multi-tenant / untrusted code |

### Kubernetes vs. Managed Services (EKS/GKE/AKS)

| Factor | Self-Managed K8s | Managed K8s |
|--------|-----------------|-------------|
| Control | Full | Limited customization |
| Operational burden | High (SRE time) | Low (control plane handled) |
| Cost at small scale (<50 nodes) | Higher | Lower |
| Cost at large scale (>500 nodes) | Lower | Higher |
| When | Specific requirements, multi-cloud | Faster time-to-value |

### Stateless vs. Stateful in Containers

| Factor | Stateless Services | Stateful Services |
|--------|-------------------|------------------|
| Orchestration | Simple — any instance interchangeable | Complex — ordered startup, stable identities |
| Scaling | Horizontal + automatic | Vertical or complex sharding |
| Failure handling | Replace immediately | Careful PV management, backup |
| Recommendation | Use containers freely | Prefer managed databases; use StatefulSets carefully |

---

## 8. When to Use / When to Avoid

### ✅ Use Containers + Orchestration When:
- Running microservices that need independent scaling and deployment
- Need **immutable, reproducible** deployments across environments
- Need **self-healing** behavior (automatically restart failed services)
- Team has container expertise and Kubernetes experience
- Multi-cloud portability requirements

### ❌ Avoid / Think Twice When:
- **Simple single-service application** — overkill, use Heroku/Render/serverless
- **No DevOps expertise** — operational burden without dedicated platform engineers is high
- **Stateful services (databases)** — prefer managed databases (RDS, Cloud SQL, Mongo Atlas) unless very specific reasons
- **All-in on one cloud** — native services (ECS, App Engine, Cloud Run) are simpler
- **Infrequent batch jobs** — serverless (Lambda) is cheaper and simpler

---

## 9. MERN Dev Notes (Node.js / Docker / Kubernetes)

### Dockerfile Best Practices

```dockerfile
# Multi-stage build: build in full image, run in minimal image
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app
# Don't run as root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/node_modules ./node_modules
COPY . .
USER appuser
EXPOSE 3000
# Handle SIGTERM for graceful shutdown
CMD ["node", "server.js"]
```

### Kubernetes Deployment Manifest

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-service
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0    # Never have less than 3 Pods available
      maxSurge: 1          # Allow 1 extra Pod during update
  template:
    metadata:
      labels:
        app: api-service
    spec:
      containers:
      - name: api
        image: myregistry/api-service:v1.2.3   # NEVER use :latest in prod
        ports:
        - containerPort: 3000
        # Always set resource requests and limits
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "200m"
            memory: "256Mi"
        # Readiness: should this Pod receive traffic?
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          failureThreshold: 3
        # Liveness: is this Pod alive?
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          failureThreshold: 5
        # Graceful shutdown hook
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 5"]
      terminationGracePeriodSeconds: 60
```

### Health Check Endpoint (Node.js/Express)

```javascript
// health.js
const express = require('express');
const router = express.Router();
let isReady = false;

// Liveness: is the process alive? (simple check)
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

// Readiness: can we serve traffic? (check dependencies)
router.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping(); // Check DB
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    // Not ready — k8s will remove from Service endpoints
    res.status(503).json({ status: 'not ready', reason: err.message });
  }
});

// Mark ready after initialization
module.exports = { router, markReady: () => { isReady = true; } };
```

### Graceful Shutdown (Node.js)

```javascript
// server.js
const server = app.listen(3000);

// Handle SIGTERM from Kubernetes
process.on('SIGTERM', async () => {
  console.log('SIGTERM received: shutting down gracefully');
  
  // Stop accepting new connections
  server.close(async () => {
    try {
      await mongoose.disconnect();
      console.log('DB disconnected, process exiting');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
  
  // Force shutdown after terminationGracePeriodSeconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 55000); // 5s less than terminationGracePeriodSeconds: 60
});
```

### HPA (Horizontal Pod Autoscaler)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-service
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70  # Scale when >70% CPU
```

---

## 10. Real-World Examples

### Netflix — Titus Container Platform
- Runs 3M+ container instances daily
- Originally on Apache Mesos, migrating to Kubernetes
- **Chaos Monkey**: randomly kills containers in production — works because containers are stateless and replaceable
- 700+ microservices, each deployable independently
- Resource efficiency improved 10× vs. VM-based deployments

### Spotify — Multi-Cluster Kubernetes
- 1,500+ microservices across 150+ clusters on GCP and AWS
- Multi-cluster for team isolation (squad owns services in their cluster) and blast radius reduction
- Built **Backstage** (now open-source) — developers describe services in simple YAML, and Backstage generates K8s manifests, CI/CD, databases, monitoring
- "Golden path" approach: developers push code, automation handles orchestration
- Processing 4B+ events/day through containerized data pipelines

### Airbnb — Kubernetes Migration
- Migrated from Rails monolith + Chef-managed VMs → Kubernetes
- Custom scheduler extension: preferentially schedules batch jobs on spot instances (70% cheaper), critical services on on-demand
- "Bin packing" to maximize node utilization → AWS bill reduced 30%
- Deployment frequency: monthly → multiple per day
- Incident recovery: hours → minutes (rollback = deploy previous container image)

---

## 11. Interview Cheat Sheet

### One-Liner
> "Containerization packages apps with deps for consistent, portable execution. Kubernetes automates container lifecycle — scheduling, scaling, health checking, and self-healing — at cluster scale."

### When Interviewers Bring This Up:
- "How would you deploy a microservices system in production?"
- "How do you handle zero-downtime deployments?"
- "How do you scale services automatically?"
- "What's the difference between Docker and Kubernetes?"

### Key Points:
1. **Immutable images** — never patch running containers; rebuild and redeploy
2. **Always set resource requests and limits** — prevents noisy neighbor problems
3. **Readiness vs. liveness probes** — both needed; readiness = traffic, liveness = alive
4. **Graceful shutdown** — handle SIGTERM, finish in-flight requests before exit
5. **Stateless services** in K8s; **managed databases** not in K8s (unless StatefulSets with operators)
6. **Rolling updates**: `maxUnavailable: 0` + readiness probes = zero-downtime

### Container Density Formula
```
Max containers = min(
  floor(available_CPU / container_CPU_request),
  floor(available_memory / container_memory_request)
)

Example: 7000m CPU, 28GB RAM, 100m/256MB per container
= min(70, 112) = 70 containers (CPU-bound)
(Allow ~15% headroom → 60 containers safe)
```

### HPA Formula
```
Desired replicas = ceil(current_replicas × (current_metric / target_metric))
= ceil(5 × (80 / 50)) = ceil(8) = 8 replicas
```

### Managed K8s Cost: Break-Even ~100–200 nodes

---

## 12. Red Flags + Keywords

### Red Flags to Avoid

❌ **"Containers are just lightweight VMs"**
→ Wrong fundamentally: containers share the host kernel (process isolation), VMs virtualize hardware (OS-level isolation). Implications: startup time, memory, security all differ

❌ **"We use Docker in production"**
→ Ambiguous; modern Kubernetes uses containerd by default, not Docker. Clarify: "we use Kubernetes with containerd; Docker for local development"

❌ **"Kubernetes solves all our scaling problems"**
→ K8s enables scaling infrastructure, but application must be designed stateless, with caching and DB optimization

❌ **"We run our database in Kubernetes"**
→ Valid but complex; requires StatefulSets, PVCs, backup strategy, operators. For most teams, managed databases (RDS, Cloud SQL) are better

❌ **"We don't need resource limits, our services are well-behaved"**
→ Memory leaks happen; without limits, one container can take down an entire node

❌ **"We use :latest tag in production"**
→ Means you don't know what version is running; makes rollback impossible

### Keywords / Glossary

| Term | Meaning |
|------|---------|
| **Container** | Isolated process with packaged app + deps, sharing host kernel |
| **Image** | Immutable, layered snapshot that a container runs from |
| **Dockerfile** | Instructions to build a container image |
| **Kubernetes (K8s)** | Container orchestration platform — declarative desired-state management |
| **Pod** | Smallest K8s unit — one or more containers sharing network and storage |
| **Deployment** | Manages replicas of a Pod; handles rolling updates |
| **Service** | Stable network endpoint (DNS, VIP) for a set of Pods |
| **Ingress** | Routes external HTTP traffic to internal Services |
| **kubelet** | Agent on each worker node; manages Pods on that node |
| **etcd** | Distributed KV store — Kubernetes' source of truth for cluster state |
| **HPA** | Horizontal Pod Autoscaler — adjusts replica count based on metrics |
| **Liveness Probe** | Health check: is the container alive? (restart if no) |
| **Readiness Probe** | Traffic check: should the Pod receive requests? (remove from endpoints if no) |
| **ConfigMap** | Key-value config data injected into Pods |
| **Secret** | Sensitive config (passwords, tokens) — encoded, not encrypted by default |
| **StatefulSet** | Manages stateful workloads with stable identity and persistent storage |
| **Namespace** | Logical isolation within a cluster (team, environment) |
| **Rolling Update** | Gradual Pod replacement during deployment |
| **Blue-Green** | Full parallel deployment; instant traffic switch; instant rollback |
| **Canary** | Deploy to small % first; monitor; increase — risk mitigation |
| **CrashLoopBackOff** | K8s status: container repeatedly failing and backing off restarts |
| **SIGTERM** | Signal sent to container on graceful shutdown; app must handle it |
| **containerd** | Lightweight container runtime used by Kubernetes |
| **CRI-O** | Kubernetes-native runtime implementing Container Runtime Interface |
| **Taint/Toleration** | Node taints repel Pods; tolerations allow specific Pods on tainted nodes |
| **Affinity** | Rules for scheduling Pods near (or away from) certain nodes or Pods |
