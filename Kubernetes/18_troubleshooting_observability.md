# Troubleshooting & Observability — Deep Theory
> **Focus:** A senior's value is measured by how they debug. Events, logs, metrics, kubelet inspection, CNI.

---

## ELI5 — Explain Like I'm 5

Debugging a Kubernetes issue is like being a **detective at a crime scene**.

- **Events** = Witness statements. Recent events from the scene. They expire after 1 hour, so collect them quickly.
- **Pod logs** = The victim's diary. What the application was saying before something went wrong.
- **kubectl describe** = The full case file. Everything about the suspect (pod/node) — conditions, events, resource usage.
- **kubectl exec** = Actually entering the crime scene and looking around.
- **Metrics** = Surveillance camera footage. Numbers over time. Shows trends, not one-off snapshots.
- **Kubelet logs** = The building security guard's log. What happened on the node — why containers were started, stopped, why network interfaces were created.
- **CNI logs** = The plumber's notes. Why the network pipes were connected or disconnected.

The detective's rule: **always start broad, then narrow. Don't deep-dive into logs before you know what pod is the problem.**

---

## The Systematic Debug Framework

```
Problem reported
    │
    ▼
1. Scope the blast radius
   kubectl get pods -A | grep -v Running
   kubectl get nodes

    │
    ▼
2. Is it pod-level or node-level?
   kubectl describe node <node>    → check Conditions, Capacity, Events
   kubectl get pods -o wide        → which node is the pod on?

    │
    ▼
3. Pod-level diagnosis
   kubectl describe pod <pod>      → Events, Conditions, Exit Code, Restart count
   kubectl logs <pod>              → app logs
   kubectl logs <pod> --previous   → logs BEFORE the last crash

    │
    ▼
4. Live debugging (if pod is running)
   kubectl exec -it <pod> -- sh
   kubectl port-forward <pod> 8080:8080

    │
    ▼
5. Network/service diagnosis
   kubectl get endpoints <service>
   kubectl exec -it <debug-pod> -- curl http://<service>:<port>

    │
    ▼
6. Node/kubelet-level (if pod can't start)
   ssh <node>
   journalctl -u kubelet -n 200
   crictl ps / crictl logs <container-id>
```

---

## kubectl Events — The First Stop

```bash
# Events for a specific pod
kubectl describe pod mypod
# Scroll to "Events:" section at the bottom

# All events in namespace, sorted by time
kubectl get events -n mynamespace --sort-by='.lastTimestamp'

# Watch events in real time
kubectl get events -n mynamespace --watch

# Filter by type
kubectl get events --field-selector type=Warning

# Filter by reason
kubectl get events --field-selector reason=BackOff

# Events for a specific resource
kubectl get events --field-selector involvedObject.name=mypod
```

> Events are stored in etcd and expire after **1 hour** by default (`--event-ttl`). If your pod crashed an hour ago, the events are gone.

### Common Event Patterns:

| Event Reason | Meaning | Next Action |
|---|---|---|
| `BackOff` | CrashLoopBackOff | `kubectl logs --previous` |
| `OOMKilling` | Container exceeded memory limit | Increase memory limit |
| `Failed` + `ErrImagePull` | Image doesn't exist or auth fails | Check image name, imagePullSecret |
| `FailedScheduling` | No node can fit the pod | Check resources, taints, affinity |
| `Evicted` | Node pressure forced pod off | Check node resources |
| `Killing` | Container killed by kubelet (liveness fail) | Check probe config |
| `Started` / `Created` | Normal startup | No action needed |
| `FailedMount` | Volume can't be mounted | Check PVC, secret, configmap exists |

---

## Logs — Deep Dive

```bash
# Basic logs
kubectl logs mypod

# Specific container in multi-container pod
kubectl logs mypod -c mycontainer

# Previous instance (before restart)
kubectl logs mypod --previous

# Stream live
kubectl logs mypod -f

# Last N lines
kubectl logs mypod --tail=100

# Logs since N time
kubectl logs mypod --since=1h
kubectl logs mypod --since-time="2024-03-25T10:00:00Z"

# All pods in deployment
kubectl logs -l app=myapp --all-containers=true

# Timestamps
kubectl logs mypod --timestamps=true
```

### Log aggregation at scale:
```
Pods write to stdout/stderr
    ↓
Container runtime writes to /var/log/pods/<namespace>_<pod>_<uid>/<container>/
    ↓
Node-level log agent (Fluentd/Fluent Bit DaemonSet) reads files
    ↓
Ships to Elasticsearch / CloudWatch / Loki / Datadog
```

---

## kubectl describe — The Case File

```bash
kubectl describe pod mypod
```

Key sections to examine:
```
Name:         mypod
Status:       Pending / Running / Failed
Conditions:   Ready=True/False, Initialized, ContainersReady, PodScheduled
Node:         node-3 / <none>  ← <none> means not yet scheduled

Containers:
  mycontainer:
    Image:          myapp:v1.3
    State:          Running / Waiting / Terminated
    Last State:     Terminated, Reason: OOMKilled, Exit Code: 137
    Ready:          True / False
    Restart Count:  14        ← high = CrashLoopBackOff

Volumes:
  config:    ← check if mounted correctly

Events:
  Type     Reason          Message
  ----     ------          -------
  Warning  BackOff         Back-off restarting failed container
  Warning  FailedMount     MountVolume.SetUp failed: secret "my-secret" not found
```

---

## Node-Level Debugging

```bash
# Describe the node
kubectl describe node node-3

# Key sections:
# Conditions:
#   MemoryPressure  False   ← or True = eviction happening
#   DiskPressure    False
#   PIDPressure     False
#   Ready           True    ← or False = node is down

# Capacity / Allocatable:
#   cpu:     4        ← total
#   memory:  7800Mi   ← allocatable (after reserved)

# Non-terminated Pods:
#   (see all pods on this node with their resource usage)

# Events:
#   Node rebooted, disk pressure, etc.
```

---

## Kubelet Inspection

```bash
# SSH into node
ssh <node-ip>

# Kubelet logs (systemd)
journalctl -u kubelet -n 200 --no-pager
journalctl -u kubelet -f         # stream live
journalctl -u kubelet --since "10 minutes ago"

# Look for:
# E (error) and W (warning) level messages
# "failed to pull image"
# "failed to create pod sandbox"
# "dial tcp: connect: connection refused"  ← API server unreachable
# "volume manager reconstruction"           ← volume issues
# "OOM score"                               ← memory pressure

# Container runtime inspection (containerd)
crictl ps                         # list running containers
crictl ps -a                      # list all including stopped
crictl inspect <container-id>     # full container details
crictl logs <container-id>        # container logs directly
crictl pods                       # list pod sandboxes
crictl stopp <pod-id>             # stop pod
```

---

## CNI Debugging

Network issues that require going deeper than kubectl:

```bash
# Check CNI plugin pods (usually a DaemonSet: calico-node, flannel, etc.)
kubectl get pods -n kube-system | grep -E "calico|flannel|cilium|weave"
kubectl logs -n kube-system calico-node-xxxxx

# Check if pod has an IP
kubectl get pod mypod -o jsonpath='{.status.podIP}'

# Check routes on node
ip route show                    # see routing table
ip route get 10.244.2.5         # trace route to a specific pod IP

# Check if veth pair exists
ip link show | grep veth

# Test connectivity from inside pod
kubectl exec -it mypod -- ping 10.244.2.5   # pod-to-pod
kubectl exec -it mypod -- curl http://10.244.2.5:8080

# Check iptables rules (kube-proxy)
iptables -t nat -L -n -v | grep <service-ip>

# For Calico specifically
calicoctl node status
calicoctl get workloadendpoints --all-namespaces

# For Cilium
cilium status
cilium endpoint list
cilium monitor                  # live packet trace
```

---

## Metrics & Observability Stack

### Built-in: metrics-server
```bash
# Install metrics-server first
kubectl top nodes
kubectl top pods -A --sort-by=memory
kubectl top pods -n mynamespace
```

### Prometheus + Grafana (standard stack)

Key metrics to know:

```promql
# CPU throttling (is the limit too low?)
rate(container_cpu_cfs_throttled_seconds_total[5m])
  / rate(container_cpu_cfs_periods_total[5m])
# > 0.25 (25%) means significant throttling

# Memory near limit
container_memory_working_set_bytes
  / container_spec_memory_limit_bytes
# > 0.85 (85%) = imminent OOM risk

# Pod restarts
rate(kube_pod_container_status_restarts_total[15m]) > 0

# ReadinessProbe failures
kube_pod_container_status_ready == 0

# Pending pods
kube_pod_status_phase{phase="Pending"} > 0

# Node memory pressure
kube_node_status_condition{condition="MemoryPressure",status="true"} == 1
```

---

## Ephemeral Debug Containers (K8s 1.23+)

Inject a debug container into a running pod without restarting it:

```bash
# Add a debug container to running pod (distroless images don't have shells)
kubectl debug -it mypod --image=busybox --target=mycontainer

# Or create a copy of the pod with a debug image
kubectl debug mypod -it --image=ubuntu --copy-to=mypod-debug

# Debug a node (runs privileged pod on the node)
kubectl debug node/node-3 -it --image=ubuntu
```

---

## Common Failure Patterns & Debug Playbooks

### Playbook 1: Pod stuck in Pending
```
kubectl describe pod <pod>
→ Events: FailedScheduling?

If "Insufficient cpu/memory":
  kubectl describe nodes | grep -A5 "Allocated resources"
  → Add nodes or reduce pod requests

If "No nodes match node selector/affinity":
  kubectl get nodes --show-labels
  → Fix affinity rules or add labels to nodes

If "Taints not tolerated":
  kubectl describe nodes | grep -i taint
  → Add toleration or remove taint
```

### Playbook 2: CrashLoopBackOff
```
kubectl describe pod <pod>
→ Check Exit Code:
    137 = OOMKilled → increase memory limit
    1   = App error → kubectl logs --previous
    2   = Misuse/config error → check env vars, mounted configs
    
kubectl logs <pod> --previous
→ Read the last lines for error message

kubectl describe pod <pod> | grep -A3 "Liveness"
→ Is initialDelaySeconds too short?
```

### Playbook 3: Service not reachable
```
kubectl get endpoints <service>
→ If <none>: pod labels don't match service selector
  kubectl get pods -l <selector>
  kubectl describe service <service> | grep Selector

If endpoints exist:
  kubectl exec -it debug-pod -- curl http://<service-ip>
  kubectl exec -it debug-pod -- curl http://<pod-ip>:<targetPort>
  → If pod-ip works but service-ip doesn't: kube-proxy issue
  
iptables -t nat -L | grep <service-clusterip>
→ Check if rules exist
```

---

## Interview Questions

**Q: How would you debug a pod that worked yesterday but is now in CrashLoopBackOff?**
A: 1) `kubectl logs <pod> --previous` — see logs before the crash. 2) `kubectl describe pod` — check Exit Code (137=OOM, 1=app error), Restart Count, Events. 3) Check if a ConfigMap or Secret was updated recently that broke the app config. 4) Check if a resource limit was reduced. 5) Check if a database or dependency is healthy. Start with the most recent change.

**Q: A service is not routing traffic. Where do you start?**
A: `kubectl get endpoints <service>` — if `<none>`, the pods aren't matching the selector. Check pod labels vs service selector. If endpoints exist, test with `curl <clusterip>` from inside the cluster. If that works, test from outside. At each hop, determine if the problem is DNS, kube-proxy, CNI, or the app itself.

**Q: How do you get logs from a pod that keeps crashing before you can `kubectl exec` into it?**
A: `kubectl logs <pod> --previous` — gets logs from the previous container instance. You can also use init containers as a diagnostic tool (they run before the main container), or set the pod command to a long sleep to prevent it from crashing while you investigate.

**Q: A pod is Running but your application is throwing connection errors to the database. How do you debug?**
A: 1) Exec into the pod and try `curl` / `nc` to the DB service/IP. 2) Check DNS: `nslookup db-service`. 3) Check if DB pod is running and ready: `kubectl get pods -l app=db`. 4) Check Service endpoints. 5) Check NetworkPolicy — is there a policy blocking the connection? 6) Check if DB credentials (Secret) are correct.

**Q: Metrics show normal CPU/memory but latency is high. What do you check?**
A: CPU throttling. Check `container_cpu_cfs_throttled_seconds_total` metric. CFS throttling creates p99 latency spikes even with low average CPU. Also check: garbage collection pauses (JVM), network latency (`kubectl exec ping`), DNS resolution time, and downstream service latency.
