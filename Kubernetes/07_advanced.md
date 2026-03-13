# Kubernetes: Advanced — HPA, VPA, CRDs, Operators, Affinity

## Horizontal Pod Autoscaler (HPA)

```
HPA watches metrics → scales Deployment replicas up or down automatically
```

```yaml
# Scale 'api' Deployment between 2 and 10 replicas based on CPU usage.
# Target: keep CPU below 70% utilization across all Pods.
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api                       # which Deployment to scale

  minReplicas: 2                    # never go below 2 (for HA)
  maxReplicas: 10                   # never exceed 10

  metrics:
    # CPU metric (Pod CPU usage / Pod CPU request)
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70    # 70% of requested CPU — scale up if above

    # Memory metric
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80

    # Custom metric: scale on HTTP requests per second from Prometheus
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "100"       # scale up if average Pod RPS > 100

  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60    # wait 60s before scaling up again
      policies:
        - type: Pods
          value: 2                       # add max 2 pods per scaling event
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300   # wait 5 min before scaling down (avoid flapping)
      policies:
        - type: Percent
          value: 25                      # remove max 25% of Pods per event
          periodSeconds: 60
```

```bash
# Check HPA status
kubectl get hpa -n production
# NAME      REFERENCE       TARGETS   MINPODS   MAXPODS   REPLICAS
# api-hpa   Deployment/api  45%/70%   2         10        3

kubectl describe hpa api-hpa -n production   # shows scaling events and decisions
```

---

## Vertical Pod Autoscaler (VPA)

```yaml
# VPA adjusts CPU/memory requests and limits automatically based on actual usage.
# Unlike HPA (more replicas), VPA changes the resource spec of existing Pods.
# NOTE: VPA must be installed separately — not built into K8s.
# VPA modes: Off (recommend only), Initial (set on Pod start), Auto (evict + restart)
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: api-vpa
  namespace: production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  updatePolicy:
    updateMode: "Off"               # "Off" = recommend only; don't auto-update
                                    # "Initial" = apply on new Pods, not existing
                                    # "Auto" = evict Pods to apply new recommendations

  resourcePolicy:
    containerPolicies:
      - containerName: api
        minAllowed:
          cpu: 50m
          memory: 64Mi
        maxAllowed:
          cpu: "2"
          memory: 2Gi
```

```bash
# Read VPA recommendations
kubectl describe vpa api-vpa -n production
# Shows:
#   Recommendation:
#     Container Recommendations:
#       Container Name: api
#         Lower Bound:   cpu: 50m, memory: 100Mi
#         Target:        cpu: 200m, memory: 200Mi   ← what to set
#         Upper Bound:   cpu: 500m, memory: 400Mi
```

---

## Custom Resource Definitions (CRD) — extend the K8s API

```yaml
# CRDs let you add your own resource types to Kubernetes.
# After installing a CRD, you use it like any built-in resource:
# kubectl get myresource    kubectl apply -f myresource.yaml

# Example: define a 'Database' custom resource
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: databases.mycompany.com   # must be <plural>.<group>
spec:
  group: mycompany.com
  versions:
    - name: v1
      served: true                # this version is available via API
      storage: true               # this version is stored in etcd
      schema:
        openAPIV3Schema:          # validation schema for the custom resource
          type: object
          properties:
            spec:
              type: object
              required: ["engine", "size"]
              properties:
                engine:
                  type: string
                  enum: ["postgres", "mysql", "redis"]
                size:
                  type: string
                  enum: ["small", "medium", "large"]
                version:
                  type: string
  scope: Namespaced               # Namespaced or Cluster
  names:
    plural: databases
    singular: database
    kind: Database                # Kind used in YAML files
    shortNames: [db]              # kubectl get db
```

```yaml
# Now you can create Database resources!
apiVersion: mycompany.com/v1
kind: Database
metadata:
  name: api-database
  namespace: production
spec:
  engine: postgres
  size: medium
  version: "16"
```

---

## Operators — automate Day-2 operations

```
An Operator = CRD + a controller that watches the CRD and reconciles desired state.
Used for complex stateful applications that need operational knowledge baked in:
  - CloudNativePG (Postgres)
  - Redis Operator
  - Prometheus Operator
  - Cert-Manager
  - Strimzi (Kafka)
```

```javascript
// Simplified Operator logic (written in Node.js with @kubernetes-client/javascript)
// Operators use the control loop:  WATCH → RECONCILE → REPEAT

const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

// Watch for Database custom resources
const watch = new k8s.Watch(kc);
watch.watch(
  '/apis/mycompany.com/v1/namespaces/production/databases',
  {},

  // Called on every ADD, MODIFY, DELETE event
  async (type, apiObj) => {
    const { name, namespace } = apiObj.metadata;
    const { engine, size } = apiObj.spec;

    if (type === 'ADDED' || type === 'MODIFIED') {
      console.log(`Reconciling Database: ${name} (${engine}, ${size})`);

      // The operator provisions/updates the real database:
      // - Creates a StatefulSet for the DB engine
      // - Creates a Service for connectivity
      // - Creates a Secret with credentials
      // - Sets up backups (CronJob)
      await reconcileDatabase(namespace, name, engine, size);
    }

    if (type === 'DELETED') {
      console.log(`Cleaning up Database: ${name}`);
      await deleteDatabase(namespace, name);
    }
  },

  (err) => console.error('Watch error:', err),
);
```

---

## Affinity and Anti-Affinity — control Pod placement

```yaml
# NodeAffinity: schedule Pods only on specific nodes
# PodAffinity: schedule Pods NEAR other Pods
# PodAntiAffinity: schedule Pods AWAY from other Pods

spec:
  affinity:
    # ---- NodeAffinity: only schedule on nodes in us-east-1a or us-east-1b ----
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:   # hard requirement
        nodeSelectorTerms:
          - matchExpressions:
              - key: topology.kubernetes.io/zone
                operator: In
                values: [us-east-1a, us-east-1b]

      preferredDuringSchedulingIgnoredDuringExecution:  # soft preference
        - weight: 1
          preference:
            matchExpressions:
              - key: node-type
                operator: In
                values: [compute-optimized]

    # ---- PodAntiAffinity: SPREAD api Pods across nodes (no two on same node) ----
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchLabels:
              app: api             # don't colocate with other api Pods
          topologyKey: kubernetes.io/hostname   # "hostname" = one per node rule
```

---

## Taints and Tolerations — reserve nodes for specific workloads

```bash
# Taint a node: "only GPU workloads can run here"
kubectl taint nodes gpu-node-1 gpu=true:NoSchedule
# Effect options:
#   NoSchedule:       new Pods without toleration won't be scheduled
#   PreferNoSchedule: try not to schedule, but will if necessary
#   NoExecute:        evict existing Pods without toleration too

# Remove a taint
kubectl taint nodes gpu-node-1 gpu=true:NoSchedule-
```

```yaml
# Pods must declare a toleration to be scheduled on a tainted node
spec:
  tolerations:
    - key: gpu
      operator: Equal
      value: "true"
      effect: NoSchedule
  nodeSelector:
    gpu: "true"            # also select only the GPU node
```

---

## Admission Webhooks — intercept and mutate/validate API requests

```yaml
# MutatingAdmissionWebhook: auto-modify Pods before saving to etcd
# Example: auto-inject a sidecar container into every Pod

apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: sidecar-injector
webhooks:
  - name: inject.mycompany.com
    admissionReviewVersions: ["v1"]
    clientConfig:
      service:
        name: sidecar-injector
        namespace: system
        path: /inject
      caBundle: <base64-encoded-CA-cert>   # TLS required for admission webhooks
    rules:
      - operations: ["CREATE"]
        apiGroups: [""]
        apiVersions: ["v1"]
        resources: ["pods"]
    namespaceSelector:
      matchLabels:
        inject-sidecar: "true"    # only inject in namespaces with this label
    failurePolicy: Fail            # Fail: reject Pod if webhook is down
                                   # Ignore: allow Pod even if webhook fails
```

---

## Interview Questions

**Q: What is the difference between HPA and VPA?**
> HPA scales horizontally — it changes the NUMBER of Pod replicas based on CPU, memory, or custom metrics. VPA scales vertically — it adjusts the CPU/memory requests and limits of existing Pods. They solve different problems: HPA for handling load spikes, VPA for right-sizing under-resourced Pods. They can be combined but require care (VPA must not fight HPA on memory-based metrics).

**Q: What is an Operator and why is it useful?**
> An Operator is a custom controller that automates the management of complex stateful apps (Postgres, Kafka, Elasticsearch). It bundles operational knowledge (how to scale, backup, failover, upgrade) into code. Instead of a human running `kubectl exec` to initiate a Postgres failover, the Operator watches the cluster state and does it automatically.

**Q: What is a CRD?**
> Custom Resource Definition — extends the Kubernetes API with new resource types. After creating a CRD, you can create, list, and update instances of that custom resource using kubectl. CRDs are the foundation that Operators build on.

**Q: What is the difference between required and preferred affinity?**
> `requiredDuringScheduling`: Pod will NOT be scheduled if the constraint cannot be met — hard requirement. If no matching nodes exist, the Pod stays in Pending.
> `preferredDuringScheduling`: Scheduler TRIES to meet the constraint but will schedule elsewhere if necessary. Use required for strict topology requirements (e.g., same AZ as database), preferred for performance hints.

**Q: What is the stabilizationWindowSeconds in HPA?**
> It prevents flapping — the HPA waits this many seconds before deciding to scale again. A 300-second scaleDown window means: if load drops, HPA won't immediately remove replicas — it waits 5 minutes to confirm the drop is sustained. Without this, a brief load dip triggers scale-down, then the next spike triggers scale-up — constant churn.
