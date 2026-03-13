# AWS: ECS, EKS, and ECR — Containers on AWS

## Container Services — Choosing the Right One

```
Three ways to run containers on AWS:

  ECR   → store container images (like Docker Hub, but private and AWS-native)

  ECS   → run containers, AWS manages the cluster control plane
           Fargate: serverless — you don't provision/manage EC2 instances
           EC2 launch type: you manage EC2 instances in the cluster

  EKS   → run Kubernetes on AWS, AWS manages the control plane
           Full Kubernetes API: kubectl, Helm, CRDs, Operators all work
           More power and flexibility than ECS, more complexity

  Lambda → run code (not containers per se, though Lambda supports container images)

When to choose:
  ECS Fargate → team doesn't know Kubernetes, wants simplest container deployment
  EKS         → team knows Kubernetes, needs advanced scheduling, multi-cloud portability
  Lambda      → event-driven, short-lived, bursty workloads (< 15 min execution)
```

---

## ECR — Elastic Container Registry

```bash
# ── Log in to ECR ──────────────────────────────────────────────────────────
# ECR uses temporary tokens (12h validity) obtained via AWS credentials
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin \
    123456789012.dkr.ecr.us-east-1.amazonaws.com
# ↑ format: <account-id>.dkr.ecr.<region>.amazonaws.com

# ── Create a repository ────────────────────────────────────────────────────
aws ecr create-repository \
  --repository-name my-app \
  --image-scanning-configuration scanOnPush=true \   # auto scan for CVEs on every push
  --encryption-configuration encryptionType=KMS      # encrypt at rest with KMS key

# ── Build and push an image ───────────────────────────────────────────────
IMAGE_URI=123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app

docker build -t my-app:latest .
docker tag  my-app:latest  $IMAGE_URI:latest
docker tag  my-app:latest  $IMAGE_URI:v1.2.3         # always tag with semver, not just :latest
docker push $IMAGE_URI:latest
docker push $IMAGE_URI:v1.2.3

# ── Lifecycle policy (keep only last 10 untagged images) ─────────────────
aws ecr put-lifecycle-policy \
  --repository-name my-app \
  --lifecycle-policy-text '{
    "rules": [{
      "rulePriority": 1,
      "description": "Delete old untagged images",
      "selection": {
        "tagStatus": "untagged",
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": { "type": "expire" }
    }]
  }'
```

---

## ECS — Elastic Container Service

```
ECS Core Concepts:
  Cluster    → logical grouping of compute (Fargate tasks or EC2 instances)
  Task Def   → blueprint: which image, how much CPU/memory, env vars, logging
  Task       → running instance of a Task Definition (like a running container)
  Service    → keeps N tasks running, handles deployments, connects to ALB

Fargate launch type:
  - No EC2 instances to manage
  - AWS provisions compute per task
  - Pay for vCPU and memory per second per task
```

```json
// Task Definition (JSON) — the blueprint for running your container
// Stored in ECS, versioned (each register = new revision)
{
  "family": "my-app",                        // task def name, e.g., my-app:5 for revision 5
  "networkMode": "awsvpc",                   // each task gets its own ENI and private IP
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",                              // 0.5 vCPU
  "memory": "1024",                          // 1 GB
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  // ↑ ECS agent uses this role to pull image from ECR, write logs to CloudWatch
  "taskRoleArn": "arn:aws:iam::123456789012:role/my-app-task-role",
  // ↑ container code uses this role to access AWS services (S3, DynamoDB, etc.)
  "containerDefinitions": [{
    "name": "my-app",
    "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:v1.2.3",
    "essential": true,                       // if this container stops, stop the whole task
    "portMappings": [{ "containerPort": 3000 }],
    "environment": [
      { "name": "NODE_ENV", "value": "production" }
    ],
    "secrets": [
      // Secrets Manager / SSM values injected at task startup — NOT visible in task def
      { "name": "DB_PASSWORD", "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:db-password" }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",                // send stdout/stderr to CloudWatch Logs
      "options": {
        "awslogs-group": "/ecs/my-app",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "healthCheck": {
      "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3,
      "startPeriod": 60                      // give container 60s to start before health checks begin
    }
  }]
}
```

```bash
# ── Register a task definition ─────────────────────────────────────────────
aws ecs register-task-definition --cli-input-json file://task-def.json

# ── Create an ECS Service ─────────────────────────────────────────────────
# A Service keeps the desired number of tasks running and handles deployments
aws ecs create-service \
  --cluster my-cluster \
  --service-name my-app \
  --task-definition my-app:1 \
  --desired-count 3 \                    # keep 3 tasks running at all times
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[subnet-abc,subnet-def],
    securityGroups=[sg-xyz],
    assignPublicIp=DISABLED              # private subnets — traffic via ALB
  }" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=my-app,containerPort=3000" \
  --deployment-controller type=ECS \    # rolling update (default)
  --deployment-configuration minimumHealthyPercent=50,maximumPercent=200

# ── Update a service (deploy new image version) ───────────────────────────
aws ecs update-service \
  --cluster my-cluster \
  --service my-app \
  --task-definition my-app:2 \           # new revision with updated image tag
  --force-new-deployment                 # force replace tasks even if task def didn't change
```

---

## EKS — Elastic Kubernetes Service

```
EKS runs a fully upstream Kubernetes control plane managed by AWS.
AWS manages: etcd, API server, scheduler, controller manager.
You manage: worker nodes (EC2 or Fargate), deployments, services, etc.
```

```bash
# ── Create an EKS cluster using eksctl (CLI tool for EKS) ─────────────────
eksctl create cluster \
  --name my-cluster \
  --region us-east-1 \
  --version 1.29 \
  --nodegroup-name workers \
  --node-type t3.medium \
  --nodes 3 \                            # 3 worker nodes
  --nodes-min 1 \
  --nodes-max 5 \
  --managed                              # AWS manages node updates and patching

# ── Configure kubectl to talk to your EKS cluster ────────────────────────
aws eks update-kubeconfig \
  --region us-east-1 \
  --name my-cluster
# This adds the cluster credentials to ~/.kube/config

# ── Verify cluster access ─────────────────────────────────────────────────
kubectl get nodes
kubectl get pods -A
```

---

## IRSA — IAM Roles for Service Accounts (EKS)

```
Problem: Pods on EKS need to access AWS services (S3, DynamoDB).
Bad practice: mount AWS access keys as secrets (rotated manually, risky).
IRSA: bind an IAM Role to a Kubernetes ServiceAccount.
      Pods using that ServiceAccount automatically get temporary AWS credentials.
      No secrets to manage, credentials auto-rotate.
```

```bash
# Step 1: Create IAM OIDC provider for your EKS cluster (allows K8s to federate with IAM)
eksctl utils associate-iam-oidc-provider \
  --region us-east-1 \
  --cluster my-cluster \
  --approve

# Step 2: Create an IAM Role bound to the Kubernetes ServiceAccount
eksctl create iamserviceaccount \
  --cluster my-cluster \
  --namespace my-app \
  --name my-app-sa \                         # Kubernetes ServiceAccount name
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess \
  --approve

# Step 3: Use the ServiceAccount in your Pod/Deployment
# (in the Pod spec)
```

```yaml
# Deployment using the IRSA-enabled ServiceAccount
spec:
  serviceAccountName: my-app-sa    # pods using this SA get S3 read permissions via IRSA
  containers:
    - name: my-app
      image: my-app:latest
      # No AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY needed!
      # AWS SDK auto-discovers credentials from the OIDC web identity token mounted by EKS
```

---

## Comparison Table

```
Feature            ECS Fargate        EKS                   Lambda
─────────────────────────────────────────────────────────────────────────────
Learning Curve     Low                High (K8s expertise)  Very Low
Control            Medium             Full K8s API          Minimal
Startup Time       seconds            seconds               cold: ~100ms
Max Duration       unlimited          unlimited             15 minutes
Scaling            ECS Auto Scaling   HPA / KEDA            automatic
Cost Model         per task vCPU+mem  per node + control    per execution
Multi-cloud        No                 Yes (Kubernetes)      No (vendor lock-in)
Use When           simple containers  K8s workloads         event-driven short tasks
```

---

## Interview Questions

**Q: What is the difference between ECS and EKS?**
> ECS: AWS-proprietary container orchestration. Simpler to learn — no Kubernetes concepts (no Pods, Nodes, Helm). Supports Fargate (serverless). Best for teams that want to run containers without learning Kubernetes.
> EKS: AWS-managed Kubernetes. Full Kubernetes API — Helm, CRDs, Operators, advanced scheduling. Best for teams already using Kubernetes or needing multi-cloud portability.

**Q: What is the ECS Task Execution Role vs Task Role?**
> Execution Role: used by the ECS agent (the infrastructure agent), not your code. Needs permissions to pull images from ECR and write logs to CloudWatch.
> Task Role: used by the running container (your application code). Needs whatever AWS permissions your app needs — e.g., read from S3, write to DynamoDB. Follows least-privilege: only grant what the app actually needs.

**Q: How do you do zero-downtime deployments with ECS?**
> ECS rolling update with `minimumHealthyPercent=100` ensures there are always 100% healthy tasks. ECS starts new tasks (up to maximumPercent), waits for them to pass ALB health checks, then terminates old tasks. Traffic gradually shifts from old to new tasks. If new tasks fail health checks, deployment is rolled back.

**Q: What is IRSA and why is it better than using access keys for EKS pods?**
> IRSA (IAM Roles for Service Accounts) lets pods assume an IAM Role via Kubernetes OIDC federation. The credentials are temporary (auto-rotate every few hours) and are scoped to the specific pod's ServiceAccount. With static access keys: if a key leaks you must manually rotate it; it applies to all pods using it; it's hard to audit which pod made which API call. IRSA solves all of these.

**Q: What is ECR image scanning?**
> ECR can scan container images for known CVEs (vulnerabilities in OS packages and application libraries) using Amazon Inspector. `scanOnPush=true` scans every image on push. View findings in the ECR console or set CloudWatch Events to alert when HIGH or CRITICAL vulnerabilities are found.
