# T25 — Compute Resource Consolidation Pattern

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/compute-resource-consolidation

---

## ELI5 (Explain Like I'm 5)

Imagine 20 delivery drivers, each making only 2 deliveries a day (90% idle). You're paying for 20 drivers to sit around. Consolidation is realizing you can serve the same customers with just 5 drivers making 8 deliveries each — same total deliveries, 75% cost reduction. The trick is smart scheduling (orchestration) and making sure one driver's pizza delivery doesn't contaminate another customer's sushi (isolation).

---

## Analogy

**Consolidating delivery drivers**: You're not cutting service — you're eliminating waste. Before: 20 drivers × 2 deliveries/day = 40 deliveries. After: 5 drivers × 8 deliveries/day = 40 deliveries. Same output, 75% fewer resources. The prerequisite: smart scheduling and isolation. Compute consolidation does the same — pack more workloads on fewer machines, with orchestration (Kubernetes) and isolation (containers/VMs) as the enablers.

---

## Core Concept

Compute Resource Consolidation addresses a fundamental inefficiency: most servers in traditional architectures sit at **10-30% average CPU utilization** — you're paying for compute capacity you're not using.

**The problem**: Traditional deployment gives each application its own dedicated server/VM. 100 microservices = 100 VMs. Average utilization: 20%. You're paying for 80% idle capacity.

**The solution**: Share physical resources among multiple logical workloads with orchestration (Kubernetes, Nomad) and isolation (containers, VMs, serverless). Target: 60-80% CPU utilization.

**The risk it introduces**: Noisy neighbor problems (one service consumes all resources), larger blast radius (one node failure affects multiple services), complex failure correlation.

**The key discipline**: Profile before consolidating. Reserve headroom (20-40% for failures). Layer isolation mechanisms. Monitor continuously.

---

## ASCII Diagrams

```
BEFORE CONSOLIDATION (100 microservices, dedicated VMs):
  Service 1:  t3.medium ($30/mo)  ─── 20% used ───► 80% idle
  Service 2:  t3.medium ($30/mo)  ─── 20% used ───► 80% idle
  ...
  Service 100: t3.medium ($30/mo) ─── 20% used ───► 80% idle
  Cost: 100 × $30 = $3,000/month

AFTER CONSOLIDATION (same workloads, shared nodes):
  Node 1: m5.8xlarge ($1,109/mo, 32 CPU, 128GB)
    ├── Service 1 (0.5 CPU, 1GB avg)
    ├── Service 2 (0.5 CPU, 1GB avg)
    ... (11 services per node at P99 usage)
  Node 2: m5.8xlarge
    ├── Service 12-22
  ...
  Node 10: m5.8xlarge (+ 1 spare for N+1 headroom)
  Cost: 10 × $1,109 = $11,090, BUT: $3,000 vs $11,090?
  (Nodes needed: 9 at P99 → use 10 nodes → $11K)
  Wait: dedicated VMs for 100 services at $30 each = $3K/mo
  Actual: for realistic workloads, consolidation savings come from:
    - Eliminating VM OS overhead (each VM: 2GB RAM base OS)
    - AWS spot instances for batch jobs (70% cheaper)
    - Autoscaling (scale 0 for off-hours)
    → Real-world: Netflix saves $100M+/year on compute

CONSOLIDATION RATIO FORMULA:
  Nodes needed (conservative, P99) = Total Workloads / (Node Effective CPU / P99 CPU per workload)
  Example: 100 workloads, 32-core node @ 70% utilization = 22.4 effective cores
  P99 usage: 2 CPU per workload → 22.4/2 = 11 per node → 100/11 = 10 nodes
  Consolidation ratio: 100:10 = 10:1 (conservative)
  Optimistic (P50 = 0.5 CPU): 22.4/0.5 = 44 per node → 100/44 = 3 nodes → 33:1 ratio
```

---

## How It Works (Step by Step)

1. **Resource profiling**: Collect CPU, memory, network I/O, disk I/O data at P50, P95, P99 over 30 days. Look for temporal patterns (time-of-day, weekly). Never consolidate based on averages — a service averaging 20% CPU but spiking to 90% during deployments needs headroom.

2. **Bin packing**: Fit N workloads onto M nodes. Kubernetes scheduler uses filtering (eliminate nodes that can't host) → scoring (rank by utilization, spreading, custom metrics). Look for complementary workloads whose peaks don't overlap.

3. **Isolation mechanism selection**: Process-level (lightweight, minimal security) → Container (cgroups + namespaces, ~5% overhead) → VM (stronger security, 10-20% overhead, slow startup). AWS Lambda uses Firecracker microVMs (startup in 125ms, strong isolation, minimal overhead).

4. **Resource limits**: Set both `requests` (scheduler guarantee, for bin packing calculation) AND `limits` (enforcement ceiling) in Kubernetes. Never set limits at P99 alone — need headroom above P99 for safety.

5. **Monitoring and autoscaling**: Track node-level utilization, per-container CPU/memory, network saturation. Set alerts for approaching limits. Use Horizontal Pod Autoscaler for traffic spikes, Cluster Autoscaler for node pool scaling.

6. **Failure isolation**: Pod anti-affinity rules spread replicas across nodes. Pod Disruption Budgets prevent too many replicas going down simultaneously. Circuit breakers + bulkheads at app layer prevent cascading failures.

---

## Variants

| Approach | Isolation | Overhead | When to Use |
|----------|-----------|----------|-------------|
| **Container-based (Kubernetes)** | cgroups + namespaces | ~5% | Cloud-native microservices; mainstream choice |
| **VM-based** | Full hypervisor | 10-20%, slower startup | Legacy apps, multi-tenant SaaS with strict security |
| **Serverless/FaaS** | Firecracker microVMs (AWS) | ~0 ops overhead | Event-driven, unpredictable traffic; zero infra management |
| **Process-level** | OS process boundaries | Minimal | Trusted workloads, resource-constrained, early stage |
| **Hybrid/Multi-level** | Different isolation per tier | Mixed | Multiple trust levels in one platform |

---

## Trade-offs

| Dimension | High Consolidation | Low Consolidation |
|-----------|-------------------|------------------|
| **Cost** | Lower infrastructure cost | Higher (idle capacity) |
| **Blast radius** | Larger (50 services per node → node failure = 50 services down) | Smaller (1 service per node) |
| **Noisy neighbors** | Risk: one service consumes shared resources | No risk (dedicated) |
| **Scheduling complexity** | High (bin packing, affinity rules) | Low or none |
| **Utilization** | 60-80% | 10-30% |

**Target utilization**: 60-70% for production. Reserve 20-30% headroom. Why not 90%+? Queueing effects (Little's Law) increase latency sharply above 80% utilization. Node failures need spare capacity for rescheduling. Rolling deployments need extra capacity.

**Node size trade-off**: Large nodes (96 cores) → better bin packing, lower overhead, but high blast radius. Small nodes (8 cores) → fine-grained scaling, small blast radius, but lower packing efficiency. Uber: 96-core nodes for stable core dispatch services, 8-core for experimental services.

---

## When to Use (and When Not To)

**Use when:**
- Average CPU utilization < 30% across services (clear consolidation opportunity)
- Workloads have complementary resource profiles (CPU-heavy pairs with memory-heavy)
- Infrastructure costs are a significant budget item
- You have Kubernetes or equivalent orchestration maturity

**Avoid when:**
- Single latency-sensitive monolith that needs dedicated resources
- Compliance/security requirements mandate dedicated hardware
- Team doesn't have orchestration operational maturity (Kubernetes is complex to operate)
- Workloads all peak simultaneously (consolidation gains disappear, risk increases)

---

## MERN Developer Notes

```javascript
// Kubernetes resource spec — critical for consolidation correctness
// The relationship between requests and limits matters enormously:

// kubernetes deployment.yaml (excerpt)
/*
resources:
  requests:
    cpu: "500m"      # 0.5 cores — what Kubernetes scheduler uses for bin packing
    memory: "1Gi"   # Used for node fit calculation
  limits:
    cpu: "2000m"    # 2 cores — hard ceiling (throttled if exceeded)
    memory: "4Gi"  # HARD limit (OOM killed if exceeded — choose carefully!)
*/

// Node.js service with graceful degradation under resource pressure
const os = require('os');

// Expose resource metrics for Kubernetes probes
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  const memPercent = memUsage.heapUsed / memUsage.heapTotal;
  
  if (memPercent > 0.9) {
    // Signal to Kubernetes this pod is under memory pressure
    return res.status(503).json({ 
      status: 'degraded', 
      reason: 'memory_pressure',
      heapUsedPercent: Math.round(memPercent * 100)
    });
  }
  
  res.json({ status: 'ok' });
});

// Liveness probe — Kubernetes restarts unhealthy pods
app.get('/livez', (req, res) => res.json({ alive: true }));

// Readiness probe — Kubernetes removes from load balancing during high load
let isReady = true;
app.get('/readyz', (req, res) => {
  if (!isReady) return res.status(503).json({ ready: false });
  res.json({ ready: true });
});

// Graceful shutdown — tell Kubernetes you're done, let connections drain
process.on('SIGTERM', async () => {
  console.log('SIGTERM received: stopping new requests');
  isReady = false; // readiness probe fails → removed from load balancer
  await new Promise(r => setTimeout(r, 5000)); // wait for connections to drain
  server.close(() => process.exit(0));
});

// Continuous right-sizing: log resource usage for analysis
setInterval(() => {
  const usage = process.cpuUsage();
  const mem = process.memoryUsage();
  console.log(JSON.stringify({
    event: 'resource_sample',
    cpu_user_ms: usage.user / 1000,
    cpu_system_ms: usage.system / 1000,
    heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
    heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
  }));
}, 60000); // log every minute
```

---

## Real-World Examples

| Company | Platform | Key Metrics |
|---------|---------|------------|
| **Netflix (Titus)** | 3M+ containers/day on shared AWS EC2. Pre-Titus: 15-20% CPU util. Post-Titus: 60-70% | Sophisticated bin packing: considers network topology, failure domains, cost optimization (prefers spot for batch). Makes 10K+ placement decisions/sec. **Saves ~$100M+/year** |
| **Shopify** | Kubernetes migration from VM-based infra | 100K+ containers. **40% cost reduction**. Kubernetes enabled autoscaling — dynamically scales from 1 replica to 100+ during flash sales in seconds |
| **AWS Lambda** | Firecracker microVM per function invocation | Startup: 125ms. Strong isolation (VM-level) with near-container overhead. 90%+ utilization via complementary traffic patterns (different customers' functions fill gaps) |
| **Uber** | Multi-tier Kubernetes: 96-core nodes for core services, 8-core for experiments | Core dispatch: large nodes + static allocation (predictable latency). Experimental: small nodes + dynamic scheduling (rapid scaling). Twitter: complementary workloads — real-time (CPU-intensive) + batch analytics (I/O-intensive) share Mesos clusters |
| **Spotify** | Weekly automated right-sizing PRs | Analyzes real resource usage weekly, generates automated PRs to adjust K8s resource specs. Result: **recovered 30% of cluster capacity** that was allocated but unused |

---

## Interview Cheat Sheet

### Q: How do you calculate how many nodes you need for consolidation?
**A:** Profile at P99 (not average — a service averaging 20% but spiking 90% will fail in consolidation). Calculate effective capacity per node: node capacity × target utilization (70%). Divide by P99 CPU per workload for CPU constraint, P99 memory per workload for memory constraint. Take the limiting factor. Round up, then add N+1 or N+2 for failure headroom. Example: 100 workloads at 2 CPU P99. 32-core node × 0.7 = 22.4 effective. 22.4/2 = 11 per node. 100/11 = 10 nodes. Add 1 spare = 11 nodes for failure.

### Q: How do you handle the noisy neighbor problem?
**A:** Defense in depth: (1) Resource limits in Kubernetes (CPU requests + limits). (2) Network policies to prevent bandwidth monopolization. (3) Priority classes so critical services can preempt batch jobs. (4) Node pools separating latency-sensitive services from batch. (5) Monitoring alerts for CPU steal time, memory pressure. (6) Rate limiting at application level. Never rely on a single isolation layer.

### Q: What utilization target should you aim for?
**A:** 60-70% average for production systems. Not 90%+ — for two reasons: (1) Reliability: when a node fails, the cluster must absorb its workloads. At 90% utilization, no spare capacity exists for rescheduling. (2) Latency: queueing effects (Little's Law) sharply increase latency above 80% utilization. Reserve 20-30% headroom. Use autoscaling to handle spikes without over-provisioning 24/7.

---

## Red Flags to Avoid

- "Consolidation is just about saving money by packing more services on fewer servers" — ignores blast radius, reliability implications, and operational complexity
- "Consolidate everything onto the largest instances" — increases blast radius, reduces scheduling flexibility, doesn't always maximize efficiency
- Targeting 90%+ utilization — leaves no headroom for node failures or traffic spikes; cascading failures inevitable
- Consolidating without profiling resource usage — leads to OOM kills or CPU starvation based on wrong assumptions
- "Just use Kubernetes" without understanding Kubernetes operational complexity and failure modes

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Compute Resource Consolidation** | Running multiple workloads on shared infrastructure to maximize utilization and reduce costs |
| **Bin Packing** | Algorithm fitting N workloads onto M nodes minimizing wasted capacity |
| **Noisy Neighbor** | One workload consuming disproportionate shared resources, degrading co-located workloads |
| **Blast Radius** | Number of services affected when a single node fails — larger with higher consolidation density |
| **Resource Requests** | Kubernetes: guaranteed resources used for scheduler bin packing calculation |
| **Resource Limits** | Kubernetes: hard ceiling; CPU throttled, memory OOM-killed if exceeded |
| **Pod Disruption Budget (PDB)** | Kubernetes: minimum available replicas during rolling updates/node drains |
| **Pod Anti-Affinity** | Kubernetes rule: schedule replicas across different nodes, AZs for blast radius reduction |
| **Complementary Workloads** | Services whose resource peaks don't overlap — optimal for co-location |
| **Firecracker** | AWS microVM technology: VM-level isolation with container-level startup speed (125ms) |
| **Node Pool** | Group of nodes with identical hardware for specific workload classes (GPU pool, high-memory pool) |
| **Vertical Pod Autoscaler (VPA)** | Kubernetes: automatically adjusts resource requests based on actual usage |
| **Horizontal Pod Autoscaler (HPA)** | Kubernetes: scales number of pod replicas based on CPU/memory/custom metrics |
| **CPU Steal Time** | Sign of noisy neighbor: a VM/container waiting for CPU that the hypervisor is using for other tenants |
| **N+1 / N+2 Capacity** | Reserve 1 or 2 extra nodes for failure absorption — standard production headroom |
| **Overcommit / Over-subscription** | Setting total requests above node capacity, betting workloads won't all peak simultaneously |
| **Right-Sizing** | Continuously adjusting resource allocations to match actual usage (not initial estimates) |
