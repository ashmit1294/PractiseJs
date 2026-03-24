# Pod Lifecycle & Probes — Deep Theory
> **Focus:** Why pods restart, not just how. CrashLoopBackOff root causes. Probe mechanics.

---

## ELI5 — Explain Like I'm 5

Imagine a pod is like a **new employee starting a job**.

- **Pending** = HR is still setting up your desk and computer (scheduling + image pull)
- **Init containers** = Mandatory onboarding training you must complete before you can work
- **Running** = You're at your desk, working
- **Liveness probe** = Your manager checks "are you still alive and working?" every few minutes. If you don't respond, they fire you and hire someone new.
- **Readiness probe** = "Are you *ready* to take customer calls yet?" You might be *alive* but still loading your tools. Customers don't get routed to you until you say ready.
- **Startup probe** = "I know this new employee takes 2 minutes to boot up their slow laptop — don't fire them during that time."
- **CrashLoopBackOff** = The employee keeps quitting or fainting on their first day. HR keeps rehiring them, but adds a longer and longer wait between each attempt (exponential backoff).

---

## Pod Lifecycle States

```
Pending → Running → Succeeded
                 ↘ Failed
                 ↘ Unknown
```

| Phase | Meaning |
|---|---|
| `Pending` | Pod accepted; waiting to be scheduled OR waiting for image pull OR init containers running |
| `Running` | At least one container is running (doesn't mean healthy!) |
| `Succeeded` | All containers exited with code 0 (Batch/Job use case) |
| `Failed` | All containers terminated; at least one exited non-zero |
| `Unknown` | Node unreachable; API server can't get pod status |

> **Trap:** A pod in `Running` phase can still be **not ready** (readiness probe failing). Traffic won't be sent, but the phase shows Running.

---

## Container States (within a Running Pod)

Each container has its own state, separate from the pod phase:

| Container State | Meaning |
|---|---|
| `Waiting` | Hasn't started yet (init, image pull, ContainerCreating) |
| `Running` | Process is executing |
| `Terminated` | Process exited (exit code tells you why) |

```bash
kubectl get pod mypod -o jsonpath='{.status.containerStatuses[*].state}'
kubectl describe pod mypod   # shows Last State, Reason, Exit Code
```

---

## Init Containers

Run **sequentially before** any app containers. Must exit 0 before the next one runs.

**Why they exist:**
- Wait for a dependency (DB ready check)
- Populate a shared volume (download config files)
- Run migrations
- Set permissions on mounted volumes

```yaml
initContainers:
  - name: wait-for-db
    image: busybox
    command: ['sh', '-c', 'until nc -z db-service 5432; do sleep 2; done']
  - name: run-migrations
    image: myapp:latest
    command: ['./migrate.sh']
```

**Failure behaviour:**
- If an init container fails → pod stays in `Init:Error` or `Init:CrashLoopBackOff`
- Main containers **never start**
- Restarts follow the pod's `restartPolicy`

---

## The Three Probes

### Liveness Probe
> "Is the process still alive and functional?"

- **Failure action:** Kill the container → restart it
- **Use case:** Detect deadlocks, infinite loops, corrupted state that the app can't self-recover from
- **Do NOT use** to check external dependencies — if your DB is down, your pod shouldn't restart

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 15    # wait before first check
  periodSeconds: 20          # check every 20s
  failureThreshold: 3        # 3 consecutive failures → restart
  timeoutSeconds: 5          # timeout per probe
```

### Readiness Probe
> "Is the pod ready to receive traffic?"

- **Failure action:** Remove pod from Service endpoints (no restart)
- **Use case:** App is starting, warming cache, connecting to DB, circuit breaker open
- **Critical:** Without this, traffic hits pods that aren't ready yet → errors

```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 3
  successThreshold: 1   # 1 success re-adds it to endpoints
```

### Startup Probe
> "Give the app time to start before liveness kicks in"

- **Failure action:** Kill the container (same as liveness)
- **Use case:** Slow-starting apps (JVM, Python loading large models)
- **While startup probe is active:** liveness and readiness probes are DISABLED
- Calculated max startup time: `failureThreshold × periodSeconds`

```yaml
startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  failureThreshold: 30   # allows up to 30 × 10s = 5 minutes to start
  periodSeconds: 10
```

### Probe Type Comparison

| | Liveness | Readiness | Startup |
|---|---|---|---|
| Failure action | Restart container | Remove from endpoints | Restart container |
| Traffic impact | Indirect (restart causes downtime) | Direct (no traffic) | Indirect |
| Keeps pod alive | No | Yes | No |
| Replaces liveness | No | No | Delays it |

---

## CrashLoopBackOff — Root Causes & Patterns

`CrashLoopBackOff` means: the container keeps crashing, so kubelet applies exponential backoff (10s, 20s, 40s, 80s... up to 5 minutes) between restart attempts.

**Backoff timeline:**
```
Crash #1 → wait 10s → restart
Crash #2 → wait 20s → restart
Crash #3 → wait 40s → restart
Crash #4 → wait 80s → restart
...
Crash #N → wait 300s (5 min cap) → restart
```

### Root Cause Patterns

**Pattern 1: Application crashes on startup**
```
Symptom: Container terminates immediately, exit code 1 or 2
Causes:
  - Missing environment variable
  - DB connection string invalid (fail-fast behaviour)
  - Config file not found
  - Port already in use
  
Debug:
  kubectl logs mypod --previous   # logs BEFORE the crash
  kubectl describe pod mypod      # check Last State, Exit Code
```

**Pattern 2: OOM Kill**
```
Symptom: Exit code 137 (128 + SIGKILL)
Causes:
  - Memory limit too low
  - Memory leak
  - JVM heap not bounded (default heap = 25% of system RAM, ignores K8s limits)
  
Debug:
  kubectl describe pod mypod | grep -A5 "Last State"
  # Reason: OOMKilled
```

**Pattern 3: Liveness probe too aggressive**
```
Symptom: Pod restarts every few minutes, looks "healthy" when you check
Causes:
  - initialDelaySeconds too low (probe fires before app is ready)
  - timeoutSeconds too short
  - App has GC pause that exceeds probe timeout
  
Debug:
  kubectl describe pod mypod
  # Events: "Liveness probe failed: Get http://...:8080/healthz: context deadline exceeded"
```

**Pattern 4: Permission denied / missing secret**
```
Symptom: Exit code 1, "permission denied" or "file not found"
Causes:
  - Secret not created in the right namespace
  - ConfigMap key doesn't exist
  - Volume mount path conflict
  
Debug:
  kubectl get events -n mynamespace
  kubectl describe pod mypod | grep -A10 Volumes
```

**Pattern 5: Image issues**
```
Symptom: Pod stuck in ImagePullBackOff or ErrImagePull
Causes:
  - Image tag doesn't exist
  - Private registry: imagePullSecret missing or wrong
  - Registry rate limit (Docker Hub 429)
  
Debug:
  kubectl describe pod mypod | grep -A5 "Failed"
```

---

## Pod Termination — The Graceful Shutdown Sequence

```
kubectl delete pod mypod

1. Pod.status.phase → Terminating
2. Pod removed from Service endpoints IMMEDIATELY → no new traffic
3. preStop hook runs (if defined) → blocks until complete
4. SIGTERM sent to container
5. terminationGracePeriodSeconds countdown begins (default: 30s)
6. If container still running after grace period → SIGKILL
7. Volumes unmounted, pod deleted from API server
```

> **Critical for zero-downtime:** Step 2 (endpoint removal) and Step 4 (SIGTERM) happen roughly simultaneously, not sequentially. Traffic may still arrive for 1-2 seconds after SIGTERM. Use a `preStop` sleep to handle this.

```yaml
lifecycle:
  preStop:
    exec:
      command: ["/bin/sh", "-c", "sleep 5"]   # drain in-flight requests
```

---

## RestartPolicy

| Policy | Behaviour | Use Case |
|---|---|---|
| `Always` (default) | Restart on any exit | Long-running services |
| `OnFailure` | Restart only on non-zero exit | Batch jobs that might fail |
| `Never` | Never restart | One-shot tasks |

---

## Interview Questions

**Q: What is the difference between liveness and readiness probes?**
A: Liveness restarts the container when it fails. Readiness removes the pod from Service endpoints without restarting. A pod can be live (not deadlocked) but not ready (still warming up). Both can fire simultaneously on the same pod.

**Q: Why would a pod be Running but not serving traffic?**
A: Readiness probe is failing. The pod phase is `Running` but `Ready` condition is `False`. The EndpointSlice controller removes it from the Service endpoints, so kube-proxy doesn't route traffic to it.

**Q: Exit code 137 — what does it mean?**
A: OOM Kill. Linux sends SIGKILL (signal 9) to the process. Exit code = 128 + signal number = 128 + 9 = 137. Check `kubectl describe pod` for `OOMKilled: true` in Last State.

**Q: How would you debug a pod stuck in Init:0/1?**
A: `kubectl logs <pod> -c <init-container-name>` to see init container logs. Also check `kubectl describe pod` for events. Common causes: waiting for a service that's not ready, network policy blocking the init check, or the init command failing silently.

**Q: A pod keeps restarting every 5 minutes. How do you diagnose?**
A: 1) `kubectl describe pod` → check Events and Last State exit code. 2) `kubectl logs --previous` → see logs before the crash. 3) If liveness probe failure → check probe config vs actual app startup time. 4) If OOMKilled → check memory usage trends. 5) If exit code 1 → check application startup logs for errors.
