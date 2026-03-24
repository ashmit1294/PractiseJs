# Scheduler Logic & Node Selection — Deep Theory
> **Focus:** Why did this pod land on that node? Taints, tolerations, affinities, scoring.

---

## ELI5 — Explain Like I'm 5

Imagine you're a school teacher assigning students (pods) to classrooms (nodes).

- **Filtering** = First eliminate classrooms that are too small, broken, or have a "No loud students" sign that this student doesn't have permission to override.
- **Scoring** = Among the remaining classrooms, pick the best one — maybe the one with more empty seats, or the one where the student's best friend already sits.
- **Taints** = A "No Entry" sign on the classroom door. Students without the right pass (toleration) can't enter.
- **Node Affinity** = "I prefer to be in the sunny classroom on the 2nd floor" — a soft or hard preference.
- **Pod Anti-Affinity** = "Don't put me next to student X" — useful for spreading replicas across nodes.
- **Topology Spread** = "Spread all students evenly across all classrooms, no one classroom gets too crowded."

---

## The Two-Phase Scheduling Algorithm

```
Unscheduled Pod
     │
     ▼
┌──────────────────────────────────┐
│  PHASE 1: FILTERING              │
│  Eliminate ineligible nodes      │
│  Result: feasible node set       │
└──────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────┐
│  PHASE 2: SCORING                │
│  Rank remaining nodes 0-100      │
│  Result: highest-score node wins │
└──────────────────────────────────┘
     │
     ▼
  BIND: pod.spec.nodeName = winner
```

---

## Phase 1 — Filtering (Hard Constraints)

A node is **eliminated** if any of these fail:

| Filter | What it checks |
|---|---|
| `PodFitsResources` | Node has enough free CPU + memory for requests |
| `PodFitsHostPorts` | No port conflict with other pods on node |
| `PodMatchNodeSelector` | `spec.nodeSelector` matches node labels |
| `NodeHasTaints` | Pod tolerates all node taints |
| `NodeAffinity` | Required NodeAffinity rules are met |
| `PodTopologySpread` | Would violate `maxSkew` |
| `VolumeBinding` | Required PVCs can be scheduled on this node |
| `NodeUnschedulable` | Node is not cordoned |
| `NodeConditions` | Node must be Ready |

---

## Phase 2 — Scoring (Soft Preferences)

Remaining nodes are scored. Higher score = more preferred.

| Scorer | Logic |
|---|---|
| `LeastRequestedPriority` | Prefer nodes with MORE free resources |
| `BalancedResourceAllocation` | Prefer nodes where CPU% ≈ memory% (avoid lopsided usage) |
| `NodeAffinityPriority` | Score based on preferred NodeAffinity weight |
| `InterPodAffinityPriority` | Prefer nodes where pod affinity matches |
| `NodePreferAvoidPodsPriority` | Respect node annotation `scheduler.alpha.kubernetes.io/preferAvoidPods` |
| `ImageLocalityPriority` | Prefer nodes that already have the container image (avoids pull time) |
| `TaintTolerationPriority` | Prefer nodes with fewer un-preferred taints |

> **Final score** = weighted sum of all scorers. The scheduler normalizes to 0–100.

---

## Taints & Tolerations

### Concept

A **taint** is applied to a **node**. It says "pods that don't explicitly tolerate this should not run here."

A **toleration** is applied to a **pod**. It says "I can run on nodes with this taint."

```bash
# Add a taint to a node
kubectl taint nodes node1 gpu=true:NoSchedule

# Remove a taint
kubectl taint nodes node1 gpu=true:NoSchedule-
```

### Taint Effects

| Effect | Behaviour |
|---|---|
| `NoSchedule` | New pods without toleration won't be scheduled here |
| `PreferNoSchedule` | Scheduler tries to avoid it, but can place here if no other option |
| `NoExecute` | New pods rejected AND existing pods evicted (unless they tolerate it) |

`NoExecute` is what Kubernetes uses automatically when a node goes `NotReady` or `Unreachable`:
```
node.kubernetes.io/not-ready:NoExecute
node.kubernetes.io/unreachable:NoExecute
```
Pods without tolerations are evicted after `tolerationSeconds` (default 300s).

### Toleration Syntax

```yaml
tolerations:
  # Exact match
  - key: "gpu"
    operator: "Equal"
    value: "true"
    effect: "NoSchedule"
  
  # Tolerate any taint with this key (any value or effect)
  - key: "dedicated"
    operator: "Exists"
  
  # Tolerate the node eviction taints (needed for DaemonSets)
  - key: "node.kubernetes.io/not-ready"
    operator: "Exists"
    effect: "NoExecute"
    tolerationSeconds: 300
```

---

## Node Affinity

More expressive than `nodeSelector`. Two types:

### Required (hard constraint — filtering phase)
```yaml
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: kubernetes.io/arch
              operator: In
              values: [amd64]
            - key: node-role
              operator: In
              values: [worker]
```

### Preferred (soft — scoring phase)
```yaml
affinity:
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 80          # higher weight = stronger preference (1-100)
        preference:
          matchExpressions:
            - key: zone
              operator: In
              values: [us-east-1a]
      - weight: 20
        preference:
          matchExpressions:
            - key: instance-type
              operator: In
              values: [c5.2xlarge]
```

> **"IgnoredDuringExecution"** means: if the node label changes AFTER the pod is running, the pod is NOT evicted. The rule only applies at scheduling time.

---

## Pod Affinity & Anti-Affinity

Lets pods express preferences **relative to other pods** (using topology domains like nodes, zones, racks).

### Pod Affinity — "Place me near pod X"
```yaml
affinity:
  podAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: cache          # co-locate with pods labeled app=cache
        topologyKey: kubernetes.io/hostname   # same node
```

### Pod Anti-Affinity — "Spread my replicas"
```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app: myapp        # don't place on a node that already has app=myapp
          topologyKey: kubernetes.io/hostname
```

**topologyKey** defines the domain for "same" location:
- `kubernetes.io/hostname` → same node
- `topology.kubernetes.io/zone` → same availability zone
- Custom label (rack, datacenter) → any domain

---

## Topology Spread Constraints

More powerful than anti-affinity for even distribution:

```yaml
topologySpreadConstraints:
  - maxSkew: 1                              # max difference between most and least loaded zones
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule       # hard: ScheduleAnyway = soft
    labelSelector:
      matchLabels:
        app: myapp
```

**Example: 3 zones, 6 replicas**
```
Zone A: 2 pods
Zone B: 2 pods
Zone C: 2 pods   → maxSkew=1 satisfied (0 difference)

Zone A: 3 pods
Zone B: 2 pods
Zone C: 1 pod    → maxSkew=1 violated if we try to add to C (skew = 3-1 = 2)
```

---

## Resource-Based Scheduling

The scheduler uses **requests** (not limits) to decide if a pod fits a node:

```
Node allocatable CPU: 3800m
Currently requested:  3200m
Available:            600m

Pod requests 700m CPU → FILTERED OUT (not enough)
Pod requests 500m CPU → passes filter
```

> **Trap:** Node allocatable ≠ node capacity. Kubelet and OS reserve resources:
> ```
> allocatable = capacity - kube-reserved - system-reserved - eviction-threshold
> ```

---

## Why Did This Pod Land On That Node? (The Real Answer)

```bash
kubectl describe pod mypod | grep -A3 "Events:"
# Reason: Scheduled
# Message: Successfully assigned default/mypod to node-3

kubectl get events --field-selector reason=Scheduled
```

To trace the scoring decision:
```bash
# Enable scheduler verbose logging (not in prod):
# --v=10 shows filtering and scoring details

# Or use the scheduler extender / framework plugins to log scoring
```

Answer template for interviews:
> "The scheduler first filtered out nodes that didn't have enough CPU/memory for the pod's requests, then eliminated nodes where taints weren't tolerated. From the remaining nodes, it scored them based on resource availability and affinity preferences, and the pod was bound to the node with the highest weighted score."

---

## nodeName (Bypass Scheduler)

```yaml
spec:
  nodeName: node-3    # skips scheduler entirely — direct binding
```
Used for: static pods (control plane components), node-specific debug pods.

---

## Interview Questions

**Q: If a pod is stuck in Pending, what are the possible causes?**
A: 1) No node has enough CPU/memory for the requests. 2) Node selector or required node affinity has no matching nodes. 3) Node taint not tolerated. 4) PVC can't be bound on any available node. 5) Pod anti-affinity eliminates all nodes. 6) Scheduler is down. Check `kubectl describe pod` Events section.

**Q: What is the difference between taints and node affinity?**
A: Taints are set on nodes and **repel** pods unless explicitly tolerated. Node affinity is set on pods and **attracts** pods to specific nodes. Taints are about "who can come in", affinity is about "where do I want to go."

**Q: You have 3 replicas of an app. How do you ensure they never land on the same node?**
A: Use `podAntiAffinity` with `requiredDuringSchedulingIgnoredDuringExecution` and `topologyKey: kubernetes.io/hostname`. Or use `topologySpreadConstraints` with `maxSkew: 1`.

**Q: What is the difference between `NoSchedule` and `NoExecute` taints?**
A: `NoSchedule` prevents new pods from being placed. `NoExecute` both prevents scheduling AND evicts existing pods without tolerations (after `tolerationSeconds`).

**Q: A pod needs to run on GPU nodes exclusively. How do you configure this?**
A: Two approaches: 1) Taint GPU nodes with `nvidia.com/gpu=true:NoSchedule` and add matching toleration to the pod. 2) Label GPU nodes `accelerator=gpu` and add `requiredDuringScheduling` nodeAffinity on the pod. Best practice: do both — taints prevent accidental placement, affinity ensures intentional placement.
