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
