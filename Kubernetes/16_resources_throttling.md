# Resource Requests, Limits & Throttling — Deep Theory
> **Focus:** CPU throttling, memory eviction, QoS classes, noisy neighbour. Where real interviews get messy.

---

## ELI5 — Explain Like I'm 5

Think of a node as a **shared apartment** with limited resources.

- **Requests** = "I need at least this much space." This is what you tell the landlord (scheduler) when applying. The scheduler only puts you in the apartment if there's room for your requested space.
- **Limits** = "You can't use more than this." The apartment manager enforces it. If you try to use more memory than your limit → you get evicted. If you try to use more CPU than your limit → you get *throttled* (slowed down but not kicked out).
- **CPU throttle** = Like an internet connection throttled at 1 Mbps. You can still work, just very slowly.
- **OOM Kill** = You stored too much stuff → landlord throws your things out the window (process killed).
- **QoS Guaranteed** = You're the VIP tenant. System kills BestEffort tenants before touching you.
- **BestEffort** = The squatter. No reservation, no guarantee. First to be evicted when things get tight.
- **Noisy neighbour** = Your roommate is downloading torrents at 3AM and consuming all shared CPU, making your own work slow.

---

## Requests vs Limits

```yaml
resources:
  requests:
    cpu: "250m"       # 0.25 CPU cores — used by scheduler (fits pod to node)
    memory: "256Mi"   # used by scheduler + eviction manager
  limits:
    cpu: "500m"       # enforced by CFS quota in kernel (throttle if exceeded)
    memory: "512Mi"   # enforced by cgroups OOM killer (kill if exceeded)
```

| | Requests | Limits |
|---|---|---|
| Purpose | Scheduling & Guaranteed baseline | Hard cap enforcement |
| Exceeding | Cannot — it's a guarantee | CPU: throttled. Memory: OOM killed |
| Used by scheduler | YES | NO |
| Used by kubelet/kernel | For eviction ordering | For enforcement |

---

## CPU Throttling — The CFS Mechanics

CPU limits are enforced using **Linux CFS (Completely Fair Scheduler) bandwidth control** via cgroups.

```
cpu.cfs_period_us = 100,000 (100ms — the accounting window)
cpu.cfs_quota_us  = 50,000  (50ms per period → 0.5 CPU limit)

Every 100ms:
  Container gets a "budget" of 50ms of CPU time
  If it uses all 50ms before the period ends → THROTTLED (sleep until next period)
  Even if the physical CPU is 80% idle
```

> **This is the most misunderstood thing in Kubernetes:** A container can be throttled even when the node has plenty of free CPU, because the per-period quota is exhausted.

### Real-world impact:
- A brief CPU spike (GC, request burst) exhausts the budget → p99 latency spikes massively
- Metrics show low average CPU, but latency is terrible → classic throttling symptom

```bash
# Check if container is being throttled
kubectl exec -it mypod -- cat /sys/fs/cgroup/cpu/cpu.stat
# nr_throttled = number of times throttled
# throttled_time = total nanoseconds spent throttled

# Or: container_cpu_cfs_throttled_seconds_total metric in Prometheus
```

### CPU Request (not limit) — what it actually does:
```
cpu.shares = request in millicores × (1024 / 1000)

100m → shares = 102
1000m → shares = 1024 (1 full core's share)

Shares only matter under CONTENTION:
  If 3 containers compete for 1 CPU:
    Container A: 500m → gets 50% of available time
    Container B: 250m → gets 25%
    Container C: 250m → gets 25%
  If no contention: all containers can burst beyond requests
```

---

## Memory OOM — The Kernel Kills

Memory limits are enforced by Linux's **memory cgroup**. When a container tries to allocate beyond its limit:
```
1. cgroup sees allocation exceeds memory.limit_in_bytes
2. Kernel's OOM killer is invoked (within the cgroup scope)
3. Most memory-consuming process in the cgroup is killed (usually the main process)
4. Container exits with code 137 (killed by SIGKILL)
5. Kubelet sees container terminated → restarts it (if restartPolicy=Always)
```

**OOM Kill is NOT graceful.** No shutdown hooks, no cleanup, just instant death.

### Memory vs CPU — key asymmetry:
```
CPU limit exceeded  → throttled (slowed, survives)
Memory limit exceeded → OOM killed (process dies)
```

---

## QoS Classes

Kubernetes assigns one of three QoS classes based on request/limit configuration:

### 1. Guaranteed (best — hardest to evict)
```
ALL containers have BOTH cpu AND memory requests AND limits set
AND requests == limits for all containers
```
```yaml
resources:
  requests:
    cpu: "500m"
    memory: "256Mi"
  limits:
    cpu: "500m"      # must equal requests
    memory: "256Mi"  # must equal requests
```

### 2. Burstable (middle — evicted after BestEffort)
```
At least one container has requests OR limits set, but NOT Guaranteed
```
```yaml
resources:
  requests:
    memory: "128Mi"   # has request but no limit → Burstable
```

### 3. BestEffort (worst — evicted first)
```
NO containers have any resource requests or limits
```
```yaml
# No resources section at all
```

### Eviction order during node memory pressure:
```
1. BestEffort pods evicted first (no reservations)
2. Burstable pods that exceed requests evicted next
3. Guaranteed pods evicted last (only if node is critically low)
```

```bash
kubectl describe node <node> | grep -A10 "Conditions:"
# MemoryPressure=True → eviction happening

kubectl get events --field-selector reason=Evicted
```

---

## Eviction Thresholds

Kubelet monitors node resources and evicts pods when thresholds are crossed:

```
--eviction-hard=memory.available<100Mi   (default)
              nodefs.available<10%
              nodefs.inodesFree<5%
              imagefs.available<15%

--eviction-soft=memory.available<200Mi   (with grace period)
--eviction-soft-grace-period=memory.available=90s
```

**Hard eviction:** Immediate, no grace period.  
**Soft eviction:** Rate-limited, respects grace period (allows clean shutdown).

---

## LimitRange (Namespace-level defaults)

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
spec:
  limits:
    - type: Container
      default:              # applied if no limit specified
        cpu: "500m"
        memory: "256Mi"
      defaultRequest:       # applied if no request specified
        cpu: "100m"
        memory: "128Mi"
      max:
        cpu: "2"
        memory: "2Gi"
      min:
        cpu: "50m"
        memory: "64Mi"
```

Without LimitRange, containers with no resources set get BestEffort QoS and can consume unlimited node resources.

---

## ResourceQuota (Namespace-level caps)

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "20"
    services: "5"
    persistentvolumeclaims: "10"
```

```bash
kubectl describe resourcequota -n mynamespace
# Shows used vs hard for each resource
```

---

## Noisy Neighbour Problem

Multiple pods on a node competing for resources — the well-behaved pod suffers because of the greedy one.

```
Node: 4 CPU cores
  Pod A: requests=500m, limit=2000m   (greedy — uses 1800m regularly)
  Pod B: requests=500m, limit=1000m   (your app — needs 900m for response generation)
  Pod C: requests=500m, limit=1000m
  Pod D: requests=500m, limit=500m

Total requested: 2000m (fits on 4 cores)
Actual usage:    1800+900+900+500 = 4100m → OVER NODE CAPACITY

Under contention, CFS shares kick in:
  Pod A gets 500/(500+500+500+500) = 25% of contended CPU
  Even though it's using 45% of total!
```

### Solutions:
1. Set limits closer to requests (Guaranteed QoS)
2. Use LimitRange to cap max/min
3. Use node affinity to spread resource-hungry pods
4. Use VPA (Vertical Pod Autoscaler) to right-size requests

---

## VPA — Vertical Pod Autoscaler

Automatically adjusts pod resource requests based on actual usage:

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: myapp-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  updatePolicy:
    updateMode: "Auto"   # Off | Initial | Recreate | Auto
  resourcePolicy:
    containerPolicies:
      - containerName: "*"
        minAllowed:
          cpu: 100m
          memory: 50Mi
        maxAllowed:
          cpu: 1
          memory: 500Mi
```

> **VPA and HPA can conflict.** Do NOT use both on the same metric (CPU/memory). VPA adjusts requests → changes scheduling; HPA scales replicas. Use HPA for CPU with custom metrics + VPA for memory.

---

## Interview Questions

**Q: A pod is slow but shows low CPU usage on dashboards. What could cause this?**
A: CPU throttling. The average CPU usage looks low, but during bursts the pod exhausts its CFS quota for the period and gets throttled. Check `container_cpu_cfs_throttled_seconds_total` in Prometheus or `cpu.stat` in the cgroup. Solution: increase the CPU limit or set request=limit (Guaranteed QoS) to get predictable scheduling.

**Q: What is the QoS class for a pod with only memory limits set?**
A: Burstable. Guaranteed requires BOTH cpu AND memory requests AND limits set, and requests must equal limits for ALL containers.

**Q: Why would you ever want CPU requests to equal CPU limits?**
A: To get Guaranteed QoS, which makes the pod last to be evicted during node pressure. Also, predictable performance — no surprise throttling or noisy-neighbour CPU stealing. For latency-sensitive workloads (trading systems, real-time processing), this is mandatory.

**Q: A pod keeps getting OOM killed even though the node has 4GB free. Why?**
A: OOM kill happens against the pod's own memory LIMIT, not against total node free memory. If the pod's limit is 256Mi and it allocates 257Mi, the kernel OOM killer fires regardless of how much free memory is on the node. Increase the pod's memory limit.

**Q: What is the difference between eviction and OOM kill?**
A: OOM kill is triggered by the kernel when a container exceeds its cgroup memory limit — it kills the container process immediately. Eviction is triggered by kubelet when the NODE is under memory pressure — it terminates pods gracefully (respects terminationGracePeriod) to free node-level memory.
