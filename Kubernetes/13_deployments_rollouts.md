# ReplicaSets, Deployments & Rollout Strategy — Deep Theory
> **Focus:** What happens inside the cluster after `kubectl apply`? Rollout mechanics, strategies, revision history.

---

## ELI5 — Explain Like I'm 5

Imagine you own a **food truck fleet**.

- **ReplicaSet** = "I always want exactly 5 trucks serving burgers." If one breaks down, it orders a new one. It doesn't care about history, only the current count.
- **Deployment** = The manager above the ReplicaSet. It handles upgrades: "Let's swap the menu from burgers to tacos — but don't shut down all trucks at once, do it gradually so the queue never disappears."
- **RollingUpdate** = Swap 1-2 trucks at a time. Some still serve burgers while others start serving tacos.
- **Blue-Green** = Keep all burger trucks running, spin up a full fleet of taco trucks, then flip the traffic switch instantly.
- **Canary** = Send 5% of customers to the new taco truck to see if they like it. If no complaints, switch everyone over.
- **Rollback** = "Tacos were a disaster — bring back the burger fleet from the last saved configuration."

---

## The Ownership Chain

```
Deployment
    │  creates/manages
    ▼
ReplicaSet (current)         ReplicaSet (old-v1)    ReplicaSet (old-v2)
    │  creates/manages           (scaled to 0)           (scaled to 0)
    ▼
  Pod  Pod  Pod
```

- A Deployment manages **multiple ReplicaSets** (one per revision)
- Only one RS is active (desired replicas > 0) at any time
- Old RSes are kept for rollback (controlled by `revisionHistoryLimit`)

---

## What Happens After `kubectl apply`?

```
kubectl apply -f deployment.yaml
```

Step-by-step inside the cluster:

```
1. kubectl serializes the manifest → sends PATCH to API server

2. API server validates, authenticates, authorizes → writes to etcd

3. Deployment controller (in controller-manager) detects the change via watch

4. Deployment controller computes diff:
   - Pod template hash changed? → new rollout needed
   - Only replicas changed? → scale existing RS

5. New ReplicaSet created with new pod template hash in its name:
   myapp-7d5f9b8c4    (new RS)
   myapp-6c4e7a9b2    (old RS, currently active)

6. Deployment controller starts rolling update:
   - Increments new RS replicas
   - Decrements old RS replicas
   - Respects maxSurge and maxUnavailable

7. For each new pod:
   - Scheduler assigns it to a node
   - Kubelet starts container
   - Readiness probe fires
   - Once Ready → pod added to endpoint slice
   - Deployment controller marks it "available"

8. Old pod termination:
   - Removed from endpoints
   - SIGTERM sent
   - terminationGracePeriodSeconds countdown

9. Rollout complete when:
   - new RS at desired replicas
   - all new pods Ready
   - old RS at 0 replicas
```

---

## RollingUpdate Parameters

```yaml
spec:
  replicas: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2          # max pods ABOVE desired count (absolute or %)
      maxUnavailable: 1    # max pods BELOW desired count that can be unavailable
```

**Calculation with replicas=10, maxSurge=2, maxUnavailable=1:**
```
Max pods running at any time:  10 + 2 = 12
Min pods available at any time: 10 - 1 = 9

Start:                [old×10]
Step 1 - start 2 new: [old×10] [new×2]  = 12 pods total
Step 2 - remove 1 old: [old×9] [new×2]  = 11 pods, 9 old available
Step 3 - start 1 more: [old×9] [new×3]  = 12 pods
...and so on until new×10 old×0
```

### Conservative (zero downtime, slow)
```yaml
maxSurge: 1
maxUnavailable: 0     # never go below desired count
```

### Aggressive (fast, some risk)
```yaml
maxSurge: 3
maxUnavailable: 2
```

### Recreate (guaranteed downtime, fastest for dev)
```yaml
strategy:
  type: Recreate    # kill ALL old pods, THEN start new ones
```

---

## Revision History & Rollback

Every change to pod template creates a new revision stored as an `CHANGE-CAUSE` annotation on the ReplicaSet.

```bash
# See rollout history
kubectl rollout history deployment myapp

# REVISION  CHANGE-CAUSE
# 1         Initial deployment
# 2         Update image to v1.2.0
# 3         Update image to v1.3.0 - added cache

# See details of a specific revision
kubectl rollout history deployment myapp --revision=2

# Rollback to previous
kubectl rollout undo deployment myapp

# Rollback to specific revision
kubectl rollout undo deployment myapp --to-revision=2

# Monitor rollout
kubectl rollout status deployment myapp  # blocks until complete or failed
```

**revisionHistoryLimit** (default: 10):
```yaml
spec:
  revisionHistoryLimit: 5   # keep only 5 old ReplicaSets
```

> Old ReplicaSets are **NOT deleted** during rollout — they're scaled to 0 and kept for rollback. This is why after many deployments you see many RS objects.

```bash
kubectl get rs -l app=myapp   # see all old ReplicaSets
```

---

## Blue-Green Deployment

Kubernetes doesn't have a native blue-green object. It's implemented via label selectors on Services.

```
                    ┌─────────────────────────┐
                    │  Service (selector: v=blue) │
                    └────────────┬────────────┘
                                 │ traffic
                    ┌────────────▼────────────┐
                    │  Blue Deployment (v=blue)  │
                    │      (current: v1.0)        │
                    └────────────────────────────┘

                    ┌────────────────────────────┐
                    │  Green Deployment (v=green) │
                    │      (new: v1.1, ready)     │
                    └────────────────────────────┘
```

**Cutover:**
```bash
# Switch service to green (instant traffic flip)
kubectl patch service myapp -p '{"spec":{"selector":{"version":"green"}}}'

# Watch for issues, then delete blue
kubectl delete deployment myapp-blue
```

**Pros:** Instant cutover, instant rollback (flip selector back), both versions tested before switch  
**Cons:** Double the resources during transition

---

## Canary Deployment

Send a percentage of traffic to the new version:

```yaml
# v1 deployment: 9 replicas
# v2 deployment: 1 replica
# Total: 10 pods → ~10% traffic to v2 (if service selector matches both)
```

```yaml
# Both deployments share the same label that the Service selects
# Service selector: app=myapp (matches both)
# v1 pods: labels: app=myapp, version=v1
# v2 pods: labels: app=myapp, version=v2
```

**More precise canary with Ingress (NGINX):**
```yaml
# Canary ingress annotation
nginx.ingress.kubernetes.io/canary: "true"
nginx.ingress.kubernetes.io/canary-weight: "10"   # 10% of traffic
```

**With Istio (weight-based routing):**
```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
spec:
  http:
    - route:
        - destination:
            host: myapp
            subset: v1
          weight: 90
        - destination:
            host: myapp
            subset: v2
          weight: 10
```

---

## Pausing & Resuming Rollouts

```bash
# Pause a rollout (apply multiple changes without triggering each as a rollout)
kubectl rollout pause deployment myapp

# Make changes
kubectl set image deployment myapp container=image:v2
kubectl set resources deployment myapp -c container --limits=cpu=500m

# Resume - triggers single rollout with all accumulated changes
kubectl rollout resume deployment myapp
```

---

## ReplicaSet vs Deployment — When to Use What

| | ReplicaSet | Deployment |
|---|---|---|
| Direct use | Rare (avoid) | Always for stateless apps |
| Rolling updates | No | Yes |
| Rollback | No | Yes |
| History | No | Yes |
| Scale | Yes | Yes (preferred) |

> Never create ReplicaSets directly unless you have a custom rollout strategy. Always use Deployments.

---

## Interview Questions

**Q: What happens to the old ReplicaSet when you do a rolling update?**
A: It's scaled down to 0 replicas but NOT deleted. It's kept as a revision for rollback. The number kept is controlled by `revisionHistoryLimit` (default 10). You can see them with `kubectl get rs`.

**Q: After `kubectl apply`, what is the first thing the Deployment controller does?**
A: It computes a hash of the new pod template (`pod-template-hash`). If the hash changed, it creates a new ReplicaSet. If only `replicas` changed, it scales the existing RS up or down.

**Q: How does Kubernetes ensure zero-downtime during a rolling update?**
A: By using `maxUnavailable: 0`. This ensures the number of ready pods never drops below the desired count. Combined with readiness probes, new pods only receive traffic after they pass the readiness check, and old pods only get terminated after new ones are ready.

**Q: What is the difference between maxSurge and maxUnavailable?**
A: `maxSurge` controls how many EXTRA pods can run above the desired count (speed of new pod creation). `maxUnavailable` controls how many pods can be missing/unready below the desired count (speed of old pod removal). Both can be integers or percentages.

**Q: How do you implement a canary with only native Kubernetes (no Istio)?**
A: Deploy two Deployments with the same label that the Service selects, but different version labels. Ratio of replicas determines traffic ratio (rough, not precise). For 10% canary: 1 canary pod + 9 stable pods. For precision, use Ingress annotations or a service mesh.

**Q: What happens if a rolling update gets stuck?**
A: The new pods may be failing readiness probes. The Deployment controller won't scale down old pods because `minAvailable` would be violated. Use `kubectl rollout status` to see it's stuck, then `kubectl rollout undo` to roll back, or investigate with `kubectl describe pod` on the new pods.
