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
