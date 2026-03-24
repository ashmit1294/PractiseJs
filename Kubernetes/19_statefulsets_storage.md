# StatefulSets, PVCs & Storage Internals — Deep Theory
> **Focus:** Binding logic, storage class behaviour, access modes, volume expansion. Stand out in interviews.

---

## ELI5 — Explain Like I'm 5

Imagine pods are hotel guests.

- **Deployment** = The hotel puts guests in any available room. Rooms are interchangeable. Guest 1 could be in Room 101 today and Room 205 tomorrow.
- **StatefulSet** = High-end hotel where each guest is assigned a **permanent room number** (pod-0, pod-1, pod-2). They always get the same room. If they leave, when they come back, their personal belongings (PVC) are still there waiting for them.
- **PersistentVolume (PV)** = The physical room — the actual storage medium (EBS disk, NFS share, etc.).
- **PersistentVolumeClaim (PVC)** = The room reservation. "I need a non-smoking room with at least 50GB of space."
- **StorageClass** = The hotel tier (Budget, Standard, Premium). Premium rooms might have SSDs (faster), budget rooms use HDDs (slower).
- **Access Modes** = Room rules: `ReadWriteOnce` = only one guest at a time. `ReadWriteMany` = conference room that multiple guests can use simultaneously.
- **Volume Binding** = The hotel clerk matches your reservation (PVC) to the best available physical room (PV).

---

## StatefulSet vs Deployment — The Core Difference

| | Deployment | StatefulSet |
|---|---|---|
| Pod identity | Random names (`myapp-7d5f9b8c4-x8k2v`) | Stable ordinal names (`myapp-0`, `myapp-1`) |
| Pod restart | Gets new name, new IP | Keeps same name, same PVC, gets new IP |
| Startup order | All at once (random) | Sequential (`pod-0` before `pod-1`) |
| Deletion order | All at once (random) | Reverse (`pod-2` before `pod-1` before `pod-0`) |
| Storage | Shared volume or none | Per-pod PVC (own dedicated storage) |
| DNS | Random pod DNS | Stable: `pod-0.service.namespace.svc.cluster.local` |
| Use case | Stateless (web, API) | Stateful (databases, Kafka, Zookeeper, etcd) |

---

## StatefulSet Spec

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: "postgres"          # REQUIRED: headless service name for stable DNS
  replicas: 3
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
          image: postgres:15
          ports:
            - containerPort: 5432
          volumeMounts:
            - name: pgdata
              mountPath: /var/lib/postgresql/data
  
  # THIS is the key difference — per-pod PVC template
  volumeClaimTemplates:
    - metadata:
        name: pgdata
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: "fast-ssd"
        resources:
          requests:
            storage: 50Gi
```

This creates:
```
postgres-0  →  PVC: pgdata-postgres-0  →  PV (50Gi SSD)
postgres-1  →  PVC: pgdata-postgres-1  →  PV (50Gi SSD)
postgres-2  →  PVC: pgdata-postgres-2  →  PV (50Gi SSD)
```

If `postgres-1` is deleted and recreated → it gets re-attached to `pgdata-postgres-1`.

---

## Headless Service (Required for StatefulSet DNS)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres      # matches StatefulSet's serviceName
spec:
  clusterIP: None     # headless = no virtual IP
  selector:
    app: postgres
  ports:
    - port: 5432
```

**DNS records created (per pod):**
```
postgres-0.postgres.default.svc.cluster.local → 10.244.1.5
postgres-1.postgres.default.svc.cluster.local → 10.244.2.3
postgres-2.postgres.default.svc.cluster.local → 10.244.3.7

Headless service itself:
postgres.default.svc.cluster.local → returns ALL pod IPs (round-robin A records)
```

This allows clients to address specific pods by name — critical for database clients that need to know which pod is the leader vs replica.

---

## PersistentVolume & PersistentVolumeClaim — Binding Logic

### The Three-Layer Model

```
PersistentVolume (PV)          — cluster-scoped resource, the actual disk
PersistentVolumeClaim (PVC)    — namespace-scoped request for storage
StorageClass                   — defines provisioning behaviour
```

### Static Provisioning (manual PV creation)

```yaml
# Admin creates PV
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-nfs-001
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  nfs:
    path: /exports/data
    server: 10.0.0.50

---
# Developer creates PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-data
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 50Gi    # can request LESS than PV's 100Gi
```

**Binding logic (static):**
```
PVC created → PV controller searches for a PV that satisfies:
  1. accessModes match (PVC modes ⊆ PV modes)
  2. storage request ≤ PV capacity
  3. storageClassName matches (or both empty)
  4. volumeMode matches (Filesystem / Block)
  5. PV not already bound

Finds best match (smallest PV that satisfies) → binds
PVC.status.phase = Bound
PV.status.phase = Bound
PV.spec.claimRef = {namespace, name of PVC}
```

> A PVC can bind to a larger PV than requested. A 50Gi claim can bind to a 100Gi PV. The remaining 50Gi is **wasted** — no other claim can use a bound PV.

### Dynamic Provisioning (StorageClass)

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"  # default SC
provisioner: ebs.csi.aws.com         # AWS EBS CSI driver
parameters:
  type: gp3                           # EBS volume type
  iops: "3000"
  encrypted: "true"
reclaimPolicy: Delete                 # Delete | Retain
volumeBindingMode: WaitForFirstConsumer   # Immediate | WaitForFirstConsumer
allowVolumeExpansion: true
```

**Dynamic binding flow:**
```
PVC created (storageClassName: fast-ssd)
    ↓
No existing PV matches
    ↓
StorageClass controller calls provisioner plugin (ebs.csi.aws.com)
    ↓
Provisioner creates actual AWS EBS volume
    ↓
PV object created automatically in Kubernetes
    ↓
PVC bound to new PV
```

---

## volumeBindingMode — Critical Concept

### `Immediate` (default)
```
PVC created → PV provisioned immediately in ANY availability zone
    ↓
Pod scheduled to zone us-east-1b
    ↓
EBS volume is in us-east-1a  ← PROBLEM: volumes are AZ-specific!
    ↓
Pod can't mount volume → stuck in Pending
```

### `WaitForFirstConsumer` (recommended for zonal storage)
```
PVC created → NOT yet bound (waits)
    ↓
Pod scheduled to zone us-east-1b
    ↓
Scheduler informs StorageClass of target AZ
    ↓
PV provisioned in us-east-1b
    ↓
PVC bound, pod can mount
```

---

## Access Modes

| Mode | Short | Meaning | Typical Backend |
|---|---|---|---|
| `ReadWriteOnce` | RWO | One node reads/writes at a time | AWS EBS, Azure Disk, GCP PD |
| `ReadOnlyMany` | ROX | Many nodes read simultaneously | NFS, Azure File |
| `ReadWriteMany` | RWX | Many nodes read AND write simultaneously | NFS, CephFS, Azure File |
| `ReadWriteOncePod` | RWOP | Only ONE pod cluster-wide (K8s 1.22+) | EBS |

> **RWO means ONE NODE, not ONE POD.** Multiple pods on the same node can mount an RWO volume. This is a common interview confusion.
> 
> No cloud block storage (EBS, GCP PD, Azure Disk) supports RWX. For shared storage, you need NFS, CephFS, or cloud file storage.

---

## Reclaim Policy

What happens to the PV (and the underlying storage) when the PVC is deleted:

| Policy | Behaviour |
|---|---|
| `Delete` (default for dynamic) | PV and underlying storage (EBS, etc.) are deleted |
| `Retain` | PV stays (phase: Released), data intact. Admin must manually reclaim. |
| `Recycle` (deprecated) | `rm -rf` on the volume, then make available again |

**Released state:** PV is no longer bound but is not available for new claims (it has `claimRef` still set). Admin must manually delete the PV to free it, or patch it.

---

## Volume Expansion

```yaml
# StorageClass must have allowVolumeExpansion: true

# Expand by updating PVC
kubectl patch pvc my-data -p '{"spec":{"resources":{"requests":{"storage":"200Gi"}}}}'

# Check status
kubectl describe pvc my-data
# Conditions: FileSystemResizePending ← filesystem resize needed
```

**Expansion flow:**
```
PVC storage increased in spec
    ↓
StorageClass controller calls provisioner to expand the volume
    ↓
Underlying disk expanded (EBS resized)
    ↓
If FileSystemResizePending: filesystem resize needed
    ↓
Kubernetes triggers filesystem resize when pod restarts OR
uses online resize (if supported by CSI driver and OS)
```

> You can only **expand** PVCs, not shrink them. Shrinking requires creating a new PVC and migrating data.

---

## StatefulSet Update Strategies

```yaml
spec:
  updateStrategy:
    type: RollingUpdate       # default: updates pods one by one (reverse ordinal)
    rollingUpdate:
      partition: 2            # only update pods with ordinal >= 2 (canary for StatefulSets)
  # type: OnDelete            # manual: pods only updated when you delete them
```

**RollingUpdate order:**
```
postgres-2 updated first → postgres-1 → postgres-0
(reverse ordinal so the primary/leader is last)
```

**Partition (canary):**
```
partition: 2 → only postgres-2 gets new version
                postgres-0 and postgres-1 stay at old version
Verify postgres-2 is healthy → set partition: 0 → full rollout
```

---

## StatefulSet Deletion Behaviour

```bash
kubectl delete statefulset postgres
# Pods deleted in REVERSE ordinal: postgres-2 → postgres-1 → postgres-0
# PVCs are NOT deleted! Data is preserved.

kubectl delete statefulset postgres --cascade=orphan
# Only deletes the StatefulSet object, pods keep running (dangerous but useful for debugging)

# To delete PVCs manually:
kubectl delete pvc -l app=postgres
```

---

## CSI (Container Storage Interface)

Modern Kubernetes uses CSI drivers for storage. Replaces the old in-tree volume plugins.

```
App Pod → K8s Volume Management → CSI Driver → External Storage (AWS EBS, Ceph, NFS)

CSI Components:
  external-provisioner  → watches for PVCs, calls CreateVolume
  external-attacher     → calls ControllerPublishVolume (attach to node)
  external-resizer      → calls ControllerExpandVolume
  node-driver-registrar → registers CSI with kubelet on each node
  CSI Driver plugin     → implements the actual storage calls
```

---

## Interview Questions

**Q: Why does a StatefulSet use a headless service instead of a regular ClusterIP service?**
A: Headless services (ClusterIP: None) let DNS return individual pod IPs with stable names (pod-0.service.namespace). This allows database clients to address specific pods directly — e.g., always read from pod-0 (primary) and write to pod-1/pod-2 (replicas). A regular ClusterIP would load-balance randomly, which breaks primary/replica routing.

**Q: A PVC is stuck in Pending. What are the causes?**
A: 1) No PV matches the request (accessMode, storageClass, size). 2) StorageClass doesn't exist. 3) Dynamic provisioner is not running or misconfigured. 4) `volumeBindingMode: WaitForFirstConsumer` — waiting for a pod to be scheduled first. 5) Resource quota for storage is exceeded.

**Q: What is the difference between `Delete` and `Retain` reclaim policy?**
A: `Delete` destroys the PV and underlying storage when PVC is deleted (good for ephemeral workloads, risky for databases). `Retain` keeps the PV and data; it enters Released state and requires manual admin intervention before it can be reused (good for databases — prevents accidental data loss).

**Q: You have 3 replicas of a database StatefulSet. How does a pod maintain its data after a restart?**
A: StatefulSet pods have stable identity names (pod-0, pod-1). The `volumeClaimTemplates` creates per-pod PVCs named `<pvc-name>-<pod-name>`. When pod-1 restarts (for any reason), it's recreated with the same name `pod-1` and Kubernetes re-attaches `pgdata-postgres-1` to it. The PVC is never deleted on pod restart.

**Q: What does `ReadWriteOnce` actually mean? Can two pods share it?**
A: RWO means the volume can be mounted read-write by pods on **one node** at a time. Multiple pods ON THE SAME NODE can mount the same RWO volume. Pods on different nodes cannot. To truly restrict to one pod, use `ReadWriteOncePod` (K8s 1.22+).

**Q: What is `WaitForFirstConsumer` and why does it matter for cloud storage?**
A: Cloud block storage (EBS, GCP PD) is **availability zone-specific**. If you provision a PV immediately (Immediate mode), it might be provisioned in a different AZ than where the pod gets scheduled, making it unmountable. `WaitForFirstConsumer` delays provisioning until the scheduler picks a node, then provisions the volume in that node's AZ.
