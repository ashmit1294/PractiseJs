# Scalability Patterns
> Resume Signal: Docker/Kubernetes, CI/CD, 60% deployment cycle reduction

---

## STAR Interview Answer

| | |
|---|---|
| **Situation** | A manual deployment process required SSH into servers, `git pull`, `pm2 restart`, and coordinated downtime windows (~45 min per release). With increasing release frequency, this became the bottleneck. Inconsistent environments ("works on my machine") caused post-deploy incidents. |
| **Task** | Automate the full build-test-deploy pipeline, eliminate deployment downtime, and make environment parity a non-issue. |
| **Action** | Containerised all services with Docker (multi-stage builds to keep images lean). Orchestrated with Kubernetes: Deployments with rolling update strategy, HPA for auto-scaling, readiness/liveness probes to keep bad pods out of rotation. Set up GitHub Actions CI pipeline (lint → test → build image → push to ECR → `kubectl rollout`). Blue-green deployments for the public API — new version receives 0% traffic until smoke tests pass, then Service selector switches atomically. |
| **Result** | Deployment cycle reduced by 60% — from 45 minutes manual to ~18 minutes fully automated. Zero-downtime releases. Rollback time dropped from "hours to coordinate" to `kubectl rollout undo` (< 2 minutes). Environment parity incidents dropped to zero. |

---

## ELI5

**Vertical scaling** is replacing a small car with a bigger one — there's a physical limit to how big a car can get, and while you're swapping you can't drive at all. **Horizontal scaling** is adding more cars to the fleet — each car is the same, no limit to how many you add, and you can add/remove without stopping traffic. Containers (Docker) make sure every car is built identically from the same blueprint. Kubernetes is the dispatcher that manages the fleet.

---

## Horizontal vs Vertical Scaling

| | Vertical (Scale Up) | Horizontal (Scale Out) |
|--|---------------------|------------------------|
| How | Bigger CPU/RAM on same machine | More instances of the same size |
| Limit | Hardware ceiling exists | Near-infinite (cloud) |
| Downtime | Often requires restart | None — add instances while live |
| Cost | Diminishing returns at high end | Linear, can scale down too |
| Failure | Single point of failure | Instances fail independently |
| State | Easy — one machine, one memory | Hard — state must be external (Redis, DB) |
| Best for | DBs (vertical first), legacy apps | Stateless services, APIs, workers |

---

## Docker — Container Fundamentals

### Multi-stage build (lean images)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci                          # install ALL deps including devDependencies
COPY . .
RUN npm run build                   # compile TypeScript

# Stage 2: Production image
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev               # production deps only — no devDeps, no build tools

COPY --from=builder /app/dist ./dist   # copy compiled output only

# Security: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

```bash
# Result: production image ~120MB vs naive single-stage ~850MB
docker build -t myapp:v1.0.0 --target production .
docker images | grep myapp
# myapp   v1.0.0   a1b2c3d4   120MB
```

---

## Kubernetes — Core Deployment Patterns

### Rolling Update (default)

Replace pods incrementally — old version pods come down as new version pods become ready.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
spec:
  replicas: 6
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2          # allow 2 extra pods during update (8 total)
      maxUnavailable: 1    # at most 1 pod offline at any time
  selector:
    matchLabels:
      app: api-service
  template:
    metadata:
      labels:
        app: api-service
    spec:
      containers:
        - name: api
          image: myapp:v1.1.0
          ports:
            - containerPort: 3000
          readinessProbe:              # traffic only sent when ready
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
          livenessProbe:               # restart if unhealthy
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
```

```bash
# Deploy new version
kubectl set image deployment/api-service api=myapp:v1.1.0

# Watch rollout progress
kubectl rollout status deployment/api-service

# Instant rollback if issues detected
kubectl rollout undo deployment/api-service
```

---

### Blue-Green Deployment

Two identical environments (blue = current live, green = new version). Traffic switches atomically via Service selector update.

```yaml
# Blue deployment (current live)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
      slot: blue
  template:
    metadata:
      labels:
        app: api
        slot: blue    # ← slot label distinguishes blue from green
    spec:
      containers:
        - name: api
          image: myapp:v1.0.0
---
# Service — points to blue
apiVersion: v1
kind: Service
metadata:
  name: api-service
spec:
  selector:
    app: api
    slot: blue       # ← this controls which deployment receives traffic
  ports:
    - port: 80
      targetPort: 3000
```

```bash
# 1. Deploy green (new version) — receives NO traffic yet
kubectl apply -f deployment-green.yaml   # image: myapp:v1.1.0, slot: green

# 2. Verify green is healthy
kubectl rollout status deployment/api-green
curl http://api-green-internal/health

# 3. Run smoke tests against green directly
./smoke-tests.sh http://api-green-internal

# 4. Switch traffic: update Service selector to point to green (atomic)
kubectl patch service api-service -p '{"spec":{"selector":{"slot":"green"}}}'

# 5. Monitor for errors; if bad → instant rollback
kubectl patch service api-service -p '{"spec":{"selector":{"slot":"blue"}}}'

# 6. Tear down blue after confidence period
kubectl delete deployment api-blue
```

---

### Horizontal Pod Autoscaler (HPA)

Scale pod count automatically based on CPU/memory metrics.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-service
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60      # scale up when avg CPU > 60%
    - type: Resource
      resource:
        name: memory
        target:
          type: AverageValue
          averageValue: 200Mi
```

```bash
# Watch HPA in action
kubectl get hpa api-hpa --watch
# NAME      REFERENCE             TARGETS   MINPODS   MAXPODS   REPLICAS
# api-hpa   Deployment/api-service  42%/60%   2         20        3
```

---

## CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Build, Test, Deploy

on:
  push:
    branches: [main]

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm test -- --coverage

  deploy:
    needs: build-test
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE }}
          aws-region: eu-west-1

      - name: Login to ECR
        id: ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Docker image
        env:
          REGISTRY: ${{ steps.ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $REGISTRY/api:$IMAGE_TAG --target production .
          docker push $REGISTRY/api:$IMAGE_TAG

      - name: Deploy to Kubernetes
        env:
          IMAGE_TAG: ${{ github.sha }}
        run: |
          aws eks update-kubeconfig --name prod-cluster --region eu-west-1
          kubectl set image deployment/api-service api=$REGISTRY/api:$IMAGE_TAG
          kubectl rollout status deployment/api-service --timeout=5m
```

---

## Key Interview Q&A

**Q: How did you achieve 60% faster deployments?**
> Eliminated all manual steps. Previously: SSH → pull → restart → verify (45 min average including coordination). After: push to main → GitHub Actions builds image, runs tests, pushes to ECR, updates Kubernetes → done in ~18 minutes with zero manual steps. Kubernetes rolling updates eliminated downtime windows entirely.

**Q: Blue-green vs rolling — when do you use which?**
> Rolling for most services — lower resource cost (no duplicate environment). Blue-green for the public API and payment service — the atomic traffic switch means zero requests hit the new version until smoke tests pass, which is a stronger safety guarantee than a gradual rollout.

**Q: How do readiness vs liveness probes work together?**
> Readiness: "is this pod ready to receive traffic?" — if it fails, the pod is removed from the Service load balancer but NOT killed. Liveness: "is this pod alive?" — if it fails, the pod is killed and restarted. Readiness prevents traffic to a warming-up pod. Liveness handles deadlocks/infinite loops where the process is running but stuck.

**Q: What's the risk of HPA if you set it too aggressively?**
> Flapping: rapid scale-up/scale-down cycles that waste resources and cause instability. Fix: set `stabilizationWindowSeconds` to prevent scale-down for at least 5 minutes after a scale-up, and ensure CPU requests are accurately set (HPA uses requests as the denominator for utilization math).

---

## ELI5: Actions Explained

> Every action taken in the STAR story above, explained like you're 5 years old.

| Action | ELI5 Explanation |
|--------|-----------------|
| **Containerised all services with Docker (multi-stage builds to keep images lean)** | Packed each service into a standard shipping container with everything it needs inside. The multi-stage part is like building a car in a messy factory (with all the heavy tools), then moving *only the finished car* into a clean, small delivery truck. The delivery truck doesn't need the factory — it's tiny. Every container opened on any computer runs identically, so "works on my machine" excuses disappear forever. |
| **Orchestrated with Kubernetes: rolling updates, HPA, and readiness/liveness probes** | Hired an automated fleet manager (Kubernetes). Rolling updates swap old containers for new ones one at a time — traffic never stops. HPA watches busyness and opens new containers when the load rises, closes them when it drops. Probes are like health checks: a container that fails its check gets silently replaced before any user notices it was sick — only healthy containers receive traffic. |
| **Set up GitHub Actions CI pipeline (lint → test → build image → push to ECR → `kubectl rollout`)** | Built an automated assembly line. Every time code is pushed, it automatically: checks code style, runs all tests, packs the app into a container, ships the container to the container warehouse (ECR), and tells Kubernetes to deploy it. A 45-minute manual SSH process became an 18-minute automated one-click pipeline. |
| **Blue-green deployments for the public API** | Run two identical lanes at all times. Blue = the current live version (all users go here). Green = the new version waiting in the wings. Deploy to green, run smoke tests — all good? Flip the switch: all users now go to green in one instant. No downtime, no gradual rollout confusion. If green breaks, flip back to blue in seconds. |

---

## ELI5 Complex Keywords Glossary

| Term | ELI5 Explanation |
|------|-----------------|
| **Container (Docker)** | A lightweight, sealed box that contains your app and everything it needs to run (code, libraries, settings). Open the box on any computer and it runs identically — no more "works on my machine." |
| **Docker Image** | A blueprint/snapshot for creating containers. Like a cookie cutter — stamped from the same mould, every cookie looks the same. You build the image once and run it anywhere. |
| **Multi-stage Docker Build** | Building a Docker image in multiple phases. Phase 1: compile and build (big, messy tools included). Phase 2: copy only the final output into a clean, tiny image. Result: a small production image instead of dragging in all the build tools. |
| **Kubernetes (K8s)** | A system that manages your containers at scale. It decides where to run them, restarts crashed ones, scales them up/down, and rolls out updates — like an air traffic controller for your containers. |
| **Pod** | The smallest deployable unit in Kubernetes. A pod is one or more containers running together on the same machine. Usually one container per pod. If a pod crashes, Kubernetes automatically replaces it. |
| **Deployment** | A Kubernetes object that describes the desired state — "I want 6 replicas of this container, using this image." Kubernetes continuously works to make reality match that description. |
| **Rolling Update** | Replacing old pods with new ones gradually, one at a time. At no point are all pods offline — new pods come up and pass health checks before old ones are removed. Zero downtime. |
| **Blue-Green Deployment** | Running two identical environments: "blue" (live) and "green" (new version). Once green is ready and tested, you switch all traffic from blue to green in one instant. Instant rollback by switching back. |
| **Readiness Probe** | A health check Kubernetes uses to decide if a pod is ready to receive traffic. If a pod is still warming up (loading cache, connecting to DB), the probe fails and the load balancer skips it. |
| **Liveness Probe** | A health check Kubernetes uses to decide if a pod needs to be restarted. If your app is stuck in a deadlock and not responding, the liveness probe fails and Kubernetes kills and replaces the pod. |
| **HPA (Horizontal Pod Autoscaler)** | A Kubernetes robot that watches CPU/memory usage. If your app gets too busy, it automatically spins up more pods. When traffic drops, it scales back down to save money. |
| **Flapping (HPA)** | When HPA rapidly scales up then immediately scales down, then up again — wasting resources and causing instability. Prevented with a cooldown window (stabilizationWindowSeconds). |
| **ECR (Elastic Container Registry)** | Amazon's private Docker image storage. You push your built images here, and Kubernetes pulls them when deploying. Like a private app store for your container images. |
| **CI/CD (Continuous Integration / Continuous Delivery)** | CI: automatically test every code change. CD: automatically deploy passing changes. Together they replace manual "someone SSH into the server and pull the latest code" with a fully automated pipeline. |
| **GitHub Actions** | GitHub's built-in automation tool. You write YAML workflows that run on code events (e.g. push to main) — run tests, build Docker images, deploy to Kubernetes, send notifications. |
| **kubectl** | The command-line tool for talking to Kubernetes. `kubectl rollout undo` rolls back a deployment instantly. `kubectl get pods` shows running pods. It's SSH for your Kubernetes cluster. |
| **EKS (Elastic Kubernetes Service)** | Amazon's managed Kubernetes. AWS runs the control plane (the brain of Kubernetes) for you — you just manage your worker nodes and deployments. Reduces ops burden vs self-hosted K8s. |
| **Environment Parity** | Making development, staging, and production environments as identical as possible. Containers solve "works on my machine" — everyone runs the same Docker image, so environment differences disappear. |
| **Smoke Test** | A quick sanity check after a deployment: "is the app basically working?" — hit the main endpoints, check response codes, verify critical paths. Not exhaustive — just enough to know it's not broken before sending real traffic. |
| **Resource Requests/Limits** | Kubernetes settings per container. Requests: the minimum resources guaranteed. Limits: the maximum it can use. HPA uses requests as the denominator when calculating CPU utilization percentage. |
| **Rollback** | Reverting a deployment to the previous working version. With `kubectl rollout undo`, Kubernetes switches back to the old image in seconds — far faster than a manual revert. |
| **Zero-Downtime Deployment** | Updating your app without any moment where users see an error or unavailability. Achieved with rolling updates or blue-green — traffic always flows to at least some healthy pods. |
