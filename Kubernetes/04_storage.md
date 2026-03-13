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
