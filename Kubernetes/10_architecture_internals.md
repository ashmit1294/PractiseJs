# Kubernetes Architecture — The Real Internals
> **Focus:** Failure behaviour, not just definitions. What breaks and why.

---

## ELI5 — Explain Like I'm 5

Imagine Kubernetes is a **big restaurant**.

- **API Server** = The head waiter. Every order (request) must go *through* the head waiter. No one talks to the kitchen directly.
- **etcd** = The notebook where every order, table booking, and recipe is written down. If this notebook burns, the restaurant loses its memory.
- **Scheduler** = The person who decides *which chef* cooks each dish based on who is free and skilled.
- **Controller Manager** = The floor manager who constantly checks "are there enough chefs on each station?" and fixes gaps.
- **Kubelet** = Each individual chef on the floor who actually cooks (runs containers) and reports back to the head waiter.

If the head waiter (API server) faints, orders stop flowing — but **the food already being cooked keeps cooking**. The kitchen doesn't stop mid-task.

---

## The Real Internals

### 1. kube-apiserver

The **only** entry point to the Kubernetes control plane. All tools (`kubectl`, controllers, kubelet) talk exclusively to the API server.

**What it does:**
- Validates and processes REST requests
- Authenticates via certs / tokens / OIDC
- Authorizes via RBAC / ABAC
- Writes state to etcd
- Broadcasts watch events to subscribers (controllers, kubelet)

**Failure behaviour:**
```
API Server DOWN
├── kubectl → connection refused immediately
├── Kubelet → keeps running containers already running (local state)
├── Scheduler → stops scheduling new pods (no new assignments)
├── Controllers → stop reconciling (deployments won't self-heal)
├── etcd → untouched (it holds state, doesn't need API server)
└── Running pods → UNAFFECTED until they crash or node fails
```

> **Key insight:** The data plane (running pods) is decoupled from the control plane. Pods don't talk to the API server — only kubelet does. If the API server dies, **your app keeps running**.

**HA Mode:**
- Multiple API server instances run behind a load balancer
- They are **stateless** — all state is in etcd
- Any replica can serve any request

---

### 2. etcd

A distributed, consistent key-value store. The **single source of truth** for all cluster state: pods, nodes, secrets, configmaps, service accounts, etc.

**What it does:**
- Stores all Kubernetes objects as serialized protobuf
- Uses the **Raft consensus algorithm** — majority of nodes must agree before a write commits
- API server is the only component that reads/writes etcd directly

**Failure behaviour:**
```
etcd quorum rules:
  3-node cluster → can lose 1 node (needs 2/3)
  5-node cluster → can lose 2 nodes (needs 3/5)
  
etcd loses quorum:
├── API server → returns 503 / etcd timeout errors
├── No new objects can be created or updated
├── Reads may still work temporarily (cached in API server)
├── Running pods → UNAFFECTED (kubelet has local pod spec cache)
└── Cluster recovery → requires etcd snapshot restore
```

**Compaction & fragmentation:**
- etcd keeps a revision history of all keys
- Without compaction, it grows unboundedly → hitting `--quota-backend-bytes` causes **db space exceeded** errors → cluster goes read-only
- This is a real production failure pattern

```bash
# Check etcd health
ETCDCTL_API=3 etcdctl endpoint health \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Check DB size
ETCDCTL_API=3 etcdctl endpoint status --write-out=table ...

# Manual compaction
ETCDCTL_API=3 etcdctl compact <rev>
ETCDCTL_API=3 etcdctl defrag
```

---

### 3. kube-scheduler

Watches for pods with `spec.nodeName == ""` (unscheduled). For each one, runs a **two-phase algorithm**:

**Phase 1 — Filtering (hard constraints):**
```
Eliminates nodes that CANNOT run the pod:
  ✗ Insufficient CPU/Memory
  ✗ Taint not tolerated
  ✗ Node selector doesn't match
  ✗ Node affinity required rules not met
  ✗ Port already in use on node
  ✗ Pod anti-affinity violated
  ✗ Node is unschedulable (cordoned)
```

**Phase 2 — Scoring (soft preferences):**
```
Remaining nodes get scored 0–100 on multiple criteria:
  LeastRequestedPriority      → prefer nodes with more free capacity
  BalancedResourceAllocation  → prefer balanced CPU/mem usage
  ImageLocalityPriority       → prefer nodes that already have the image
  NodeAffinityPriority        → preferred affinity rules
  InterPodAffinityPriority    → preferred pod affinity/anti-affinity
```

**Failure behaviour:**
```
Scheduler DOWN:
├── Existing pods → UNAFFECTED
├── New pods → stay in Pending state indefinitely
├── Pod shows: reason: "Unschedulable", but never gets scheduled
├── ReplicaSets still try to create pods → pods pile up in Pending
└── Recovery → restart scheduler → it processes all Pending pods
```

---

### 4. kube-controller-manager

Runs multiple **control loops** (controllers) in one binary. Each controller watches a resource type and reconciles actual state → desired state.

**Key controllers:**
| Controller | Watches | Behaviour |
|---|---|---|
| **Deployment** | Deployments | Creates/updates ReplicaSets |
| **ReplicaSet** | ReplicaSets | Creates/deletes Pods to match replicas |
| **Node** | Nodes | Marks nodes NotReady, evicts pods after timeout |
| **Job** | Jobs | Tracks completions, retries |
| **EndpointSlice** | Services + Pods | Maintains endpoint lists |
| **Namespace** | Namespaces | Finalizes deletion |
| **ServiceAccount** | ServiceAccounts | Creates default tokens |

**Failure behaviour:**
```
Controller Manager DOWN:
├── Existing healthy pods → UNAFFECTED
├── Pod crashes → not restarted (ReplicaSet controller not watching)
├── Node goes down → not evicted (Node controller not watching)
├── Deployment scale → no new pods created
├── HA mode: multiple instances use leader election via etcd lease
└── Non-leader instances are hot standbys — leader dies → re-election in ~15s
```

**Leader election mechanics:**
- Controller manager uses a **Lease** object in etcd as a distributed lock
- The holder updates the lease timestamp periodically (heartbeat)
- If the heartbeat stops, another instance acquires the lease

---

### 5. kubelet

The **node agent**. Runs on every worker node. Responsible for making the actual containers run.

**What it does:**
- Watches API server for pods scheduled to its node
- Calls the container runtime (containerd/CRI-O) via CRI (Container Runtime Interface)
- Reports pod status, node conditions, and resource usage back to API server
- Runs liveness/readiness/startup probes
- Manages pod volumes and secrets mounting
- Garbage collects unused images and containers

**Failure behaviour:**
```
Kubelet DOWN on a node:
├── Running containers → KEEP RUNNING (managed by containerd, not kubelet)
├── API server → marks node as NotReady after ~40s (no heartbeat)
├── Node controller → after 5min eviction timeout → evicts pods
├── New pods scheduled to this node → stuck in ContainerCreating
└── Kubelet restart → re-syncs pod state with API server

Kubelet cannot reach API server:
├── Node goes NotReady from cluster perspective
├── kubelet keeps running pods based on local pod cache
├── No new secrets/configmap updates reach the node
└── Liveness probes still fire locally (no API server needed)
```

**The reconciliation loop:**
```
kubelet loop (every ~20s sync period):
  1. Get desired pods from API server (or local cache)
  2. Get actual pods from container runtime
  3. For each desired pod not running → start it
  4. For each running pod not desired → stop it
  5. Run probes, update status
  6. Report status to API server
```

---

## Architecture Failure Matrix

| Failure | New Pods | Running Pods | kubectl Works | Node Detected Down |
|---|---|---|---|---|
| API Server down | ✗ | ✓ | ✗ | ✗ |
| etcd quorum lost | ✗ | ✓ | ✗ (503) | ✗ |
| Scheduler down | ✗ (Pending) | ✓ | ✓ | ✓ |
| Controller Manager down | Partial | ✓ | ✓ | ✓ (delayed) |
| Kubelet down | ✗ on node | ✓ (briefly) | ✓ | ✓ (after 40s) |

---

## Interview Questions

**Q: If etcd goes down, do running pods crash?**
A: No. Kubelet has a local cache of pod specs. Containers are managed by the container runtime (containerd), which is independent of etcd. Pods keep running until they crash naturally. Only then does the lack of self-healing become visible.

**Q: Can you run Kubernetes without a scheduler?**
A: Yes. Pods with an explicit `spec.nodeName` skip scheduling. You can manually assign pods to nodes. This is how static pods (API server, etcd, scheduler itself) work — the kubelet reads them from `/etc/kubernetes/manifests/`.

**Q: What is the API server's role in watch-based communication?**
A: API server maintains a watch cache backed by etcd. When a controller calls `Watch`, it gets a long-lived HTTP connection. On any state change, API server pushes events. This is how controllers react instantly without polling.

**Q: How does the Node controller decide to evict pods?**
A: Kubelet sends heartbeats to the API server. After `node-monitor-grace-period` (default 40s), the node controller marks the node `Unknown`. After `pod-eviction-timeout` (default 5min), it taints the node with `node.kubernetes.io/unreachable:NoExecute`, which triggers pod eviction.

**Q: What happens if two schedulers run simultaneously?**
A: They may both try to bind the same pod to different nodes. The API server uses optimistic concurrency — only the first bind (with the correct resourceVersion) succeeds. The other gets a 409 Conflict and retries.
