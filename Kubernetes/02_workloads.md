# Kubernetes: Workloads

## Overview
Kubernetes workload resources manage how your application Pods run.
Each type is designed for a specific use case — choosing the right one is critical.

| Resource | Use Case |
|----------|----------|
| Deployment | Stateless web apps, APIs, microservices |
| StatefulSet | Databases, caches with persistent identity (Postgres, Redis) |
| DaemonSet | Per-node agents (log collectors, monitoring, node config) |
| Job | One-time batch processing task |
| CronJob | Scheduled batch tasks (like cron on Linux) |

---

## Deployment — updating and rolling back

```yaml
# A complete production Deployment with all key settings explained
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: production
  annotations:
    # Store change reason for rollout history (kubectl rollout history)
    kubernetes.io/change-cause: "Deploy v2.1.0 — add /healthz endpoint"
spec:
  replicas: 3                    # run 3 copies for high availability

  selector:
    matchLabels:
      app: api                   # must match template.metadata.labels

  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1                # allow 1 EXTRA pod during update (4 total temporarily)
      maxUnavailable: 0          # never kill an old pod before a new one is Ready
                                 # → zero-downtime deployment

  template:
    metadata:
      labels:
        app: api
        version: "2.1.0"

    spec:
      # Spread Pods across zone failure domains (avoid putting all 3 on same node)
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: api

      containers:
        - name: api
          image: ghcr.io/myorg/api:2.1.0

          ports:
            - containerPort: 3000

          # Resource requests tell the scheduler what this Pod needs.
          # Resource limits cap what it can use. Both are required for QoS.
          resources:
            requests:
              cpu: 100m          # 0.1 CPU core guaranteed
              memory: 128Mi      # 128 MiB guaranteed
            limits:
              cpu: 500m          # max 0.5 CPU core
              memory: 256Mi      # max 256 MiB (OOM-killed if exceeded)

          # readinessProbe: "is this Pod safe to send traffic to?"
          # Failing = Pod removed from Service endpoints (no traffic)
          readinessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 5    # wait 5s before first check (startup time)
            periodSeconds: 10         # check every 10s
            successThreshold: 1       # 1 success = ready
            failureThreshold: 3       # 3 consecutive failures = not ready

          # livenessProbe: "is this Pod still working, or is it stuck?"
          # Failing = kubelet restarts the container
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 30
            failureThreshold: 3

          # startupProbe: prevents liveness from killing slow-starting containers
          # once startupProbe succeeds, liveness takes over
          startupProbe:
            httpGet:
              path: /healthz
              port: 3000
            failureThreshold: 30      # allow up to 30 * 10s = 5 minutes to start
            periodSeconds: 10

          env:
            - name: NODE_ENV
              value: production
            - name: PORT
              value: "3000"
```

```bash
# Rolling update commands
kubectl apply -f deployment.yaml               # apply new image version

kubectl rollout status deployment/api          # watch rollout progress
# Waiting for deployment "api" rollout to finish: 1 out of 3 new replicas have been updated...

kubectl rollout history deployment/api         # see history of changes
# REVISION  CHANGE-CAUSE
# 1         Deploy v2.0.0
# 2         Deploy v2.1.0

kubectl rollout undo deployment/api           # rollback to previous revision
kubectl rollout undo deployment/api --to-revision=1  # rollback to specific revision
```

---

## StatefulSet — for stateful applications (databases, Redis)

```yaml
# StatefulSets give each Pod a STABLE identity: api-0, api-1, api-2
# Pods are created in ORDER (0 → 1 → 2) and deleted in REVERSE order
# Each Pod gets its own PersistentVolumeClaim via volumeClaimTemplates
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: production
spec:
  serviceName: "postgres"         # REQUIRED: headless Service name for stable DNS
  replicas: 1                     # usually 1 for primary; use operator for HA

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
          ports:
            - containerPort: 5432

          env:
            - name: POSTGRES_DB
              value: myapp
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:       # read from a Secret (see file 05_config_secrets.md)
                  name: postgres-secret
                  key: username
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password

          volumeMounts:
            - name: data             # mounts the PVC created below
              mountPath: /var/lib/postgresql/data

          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: "1"
              memory: 1Gi

  # Each replica gets its own PVC automatically.
  # postgres-0 gets data-postgres-0, postgres-1 gets data-postgres-1, etc.
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: [ReadWriteOnce]   # only one node can write (typical for DBs)
        storageClassName: gp3          # use fast SSD storage class
        resources:
          requests:
            storage: 20Gi

---
# Headless Service (clusterIP: None) — required by StatefulSet for stable DNS
# DNS: postgres-0.postgres.production.svc.cluster.local
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: production
spec:
  clusterIP: None                  # headless — no load balancing, returns Pod IPs
  selector:
    app: postgres
  ports:
    - port: 5432
```

---

## DaemonSet — run exactly one Pod per node

```yaml
# Use case: log collector (Fluent Bit), metrics agent (node-exporter), security agent
# DaemonSet automatically adds a Pod when a new node joins the cluster
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentbit
  namespace: logging
spec:
  selector:
    matchLabels:
      app: fluentbit

  template:
    metadata:
      labels:
        app: fluentbit
    spec:
      # serviceAccountName: fluentbit-sa  # SA with permission to read pod logs

      # tolerations allow this Pod to run on control-plane nodes too
      tolerations:
        - key: node-role.kubernetes.io/control-plane
          operator: Exists
          effect: NoSchedule

      containers:
        - name: fluentbit
          image: fluent/fluent-bit:3.0
          resources:
            requests:
              cpu: 50m
              memory: 50Mi
            limits:
              cpu: 200m
              memory: 200Mi
          volumeMounts:
            - name: varlog
              mountPath: /var/log
              readOnly: true
            - name: varlibdockercontainers
              mountPath: /var/lib/docker/containers
              readOnly: true

      volumes:
        - name: varlog
          hostPath:                      # mount from the actual node filesystem
            path: /var/log
        - name: varlibdockercontainers
          hostPath:
            path: /var/lib/docker/containers
```

---

## Job — run a task to completion once

```yaml
# Jobs run until completions are reached (re-runs on failure).
# Great for: DB migrations, data import, report generation.
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
  namespace: production
spec:
  completions: 1                  # run 1 successful completion
  parallelism: 1                  # run 1 pod at a time
  backoffLimit: 3                 # retry up to 3 times on failure
  ttlSecondsAfterFinished: 300    # auto-delete job 5 minutes after it finishes

  template:
    spec:
      restartPolicy: OnFailure     # Jobs MUST set restartPolicy to Never or OnFailure
      containers:
        - name: migrate
          image: ghcr.io/myorg/api:2.1.0
          command: ["node", "scripts/migrate.js"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: api-secret
                  key: database-url
```

---

## CronJob — scheduled Jobs (like cron)

```yaml
# Runs a Job on a schedule defined using cron syntax.
# .----------------------------------------- minute (0-59)
# | .--------------------------------------- hour (0-23)
# | | .------------------------------------ day of month (1-31)
# | | | .--------------------------------- month (1-12)
# | | | | .------------------------------- day of week (0-6, 0=Sunday)
# | | | | |
# 0 2 * * *  = every day at 02:00 UTC
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-cleanup
  namespace: production
spec:
  schedule: "0 2 * * *"           # run at 02:00 UTC every day
  timeZone: "UTC"
  concurrencyPolicy: Forbid        # don't run a new Job if previous is still running
                                   # Replace: cancel previous and start new
                                   # Allow: run multiple simultaneously
  successfulJobsHistoryLimit: 3    # keep logs of 3 most recent successful runs
  failedJobsHistoryLimit: 1        # keep logs of 1 most recent failed run
  startingDeadlineSeconds: 300     # if missed schedule by 5min, skip (don't run late)

  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: cleanup
              image: ghcr.io/myorg/api:2.1.0
              command: ["node", "scripts/cleanup-old-sessions.js"]
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 500m
                  memory: 256Mi
```

---

## Pod Disruption Budget (PDB)

```yaml
# PDB protects against too many Pods being simultaneously unavailable
# during voluntary disruptions: node drain, rolling upgrades, cluster autoscaler
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-pdb
  namespace: production
spec:
  minAvailable: 2                # at least 2 replicas must always be available
  # maxUnavailable: 1            # alternatively: max 1 can be unavailable at a time
  selector:
    matchLabels:
      app: api
```

---

## Interview Questions

**Q: What is the difference between Deployment and StatefulSet?**
> Deployment Pods are interchangeable: they share the same PVC, have random names (api-abc12), and can be replaced in any order. StatefulSet Pods have stable identities: ordered names (postgres-0, postgres-1), their own PVCs that persist if the Pod is deleted, and are created/deleted in a predictable order. Use StatefulSet for anything that stores data on disk and needs stable network identity (databases, Kafka, ZooKeeper).

**Q: Why would you use a DaemonSet over a Deployment?**
> DaemonSet guarantees exactly ONE Pod per node — including new nodes that join later. Useful for node-level agents that need to run on every machine: log shippers (Fluent Bit), metrics agents (node-exporter), security scanners. A Deployment can't guarantee one-per-node placement.

**Q: What is backoffLimit in a Job?**
> The maximum number of retry attempts before the Job is declared failed. If `backoffLimit: 3` and the Pod fails 4 times, the Job fails and no more retries happen. Use with idempotent tasks — each retry should produce the same result (DB migrations check if migration already applied).

**Q: What does concurrencyPolicy: Forbid do in CronJob?**
> If the previous Job is still running when the next schedule triggers, Forbid skips the new run entirely. Default is `Allow` (multiple runs simultaneously). Use `Forbid` for jobs that must not overlap (e.g., report generation writing to the same output file).

**Q: What is a Pod Disruption Budget and when does it matter?**
> A PDB prevents too many Pods from being unavailable at the same time during voluntary disruptions (node drains for maintenance, cluster autoscaler scale-down). The cluster respects the PDB by waiting before draining another node. Without a PDB, a node drain could take down all your API Pods simultaneously during a maintenance window.

**Q: What is the difference between requests and limits in Kubernetes?**
> `requests`: guaranteed resources used by the scheduler to find a suitable node. The Pod always gets at least this much.
> `limits`: absolute maximum. Exceeding memory limit → the Pod is OOM-killed (exit code 137). Exceeding CPU limit → the process is throttled (slowed down), not killed.
> Setting `requests == limits` gives the Pod "Guaranteed" QoS class — highest priority for eviction protection.
