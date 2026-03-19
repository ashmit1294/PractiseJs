# AWS: CI/CD and Comprehensive Interview Q&A

## CI/CD Concepts

```
CI — Continuous Integration:
  Every code commit triggers an automated pipeline that:
    1. Installs dependencies
    2. Runs tests (unit, integration, lint)
    3. Builds the application (Docker image, compiled binary)
    4. Publishes build artifacts

CD — Continuous Delivery/Deployment:
  After CI succeeds, automatically (or after approval) deploy to environments:
    - Staging: automatic
    - Production: after CI + manual approval (Continuous Delivery)
               OR fully automatic (Continuous Deployment)
```

---

## AWS CodeBuild — Build Server

```
CodeBuild runs your build commands inside a managed container.
Defined by buildspec.yml in your repo root.
Scales automatically — no servers to manage.
```

```yaml
# buildspec.yml — CodeBuild build specification

version: 0.2

# Environment variables available during the build
# Set in CodeBuild console or via SSM Parameter Store (for secrets)
env:
  variables:
    AWS_DEFAULT_REGION: us-east-1
    ECR_REPOSITORY: my-app
  parameter-store:
    SONAR_TOKEN: /ci/sonar-token   # fetched from SSM securely (not visible in logs)

phases:
  install:
    runtime-versions:
      nodejs: 20           # Node.js version to use in the build container
    commands:
      - npm ci              # `npm ci` is faster and more reliable than `npm install` in CI
                            # because it respects package-lock.json exactly

  pre_build:
    commands:
      # Log in to ECR before building the Docker image
      - echo "Logging in to Amazon ECR..."
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION \
          | docker login --username AWS --password-stdin \
            $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com

      # Run tests before building image — fail early if tests fail
      - npm test -- --reporter=junit --output-file=test-results/junit.xml

  build:
    commands:
      - echo "Building Docker image..."
      - IMAGE_TAG=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c1-8)  # first 8 chars of commit SHA
      - IMAGE_URI=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG
      - docker build -t $IMAGE_URI .
      - docker tag $IMAGE_URI $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$ECR_REPOSITORY:latest

  post_build:
    commands:
      - docker push $IMAGE_URI
      - docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$ECR_REPOSITORY:latest

      # Write image URI to a file — CodePipeline picks this up for the deploy stage
      - printf '{"ImageURI":"%s"}' $IMAGE_URI > imageDefinitions.json

# Artifacts to pass between pipeline stages
artifacts:
  files:
    - imageDefinitions.json
    - appspec.yml             # for CodeDeploy
    - taskdef.json            # for ECS deployment

# JUnit test report — visible in CodeBuild console under Reports
reports:
  test-results:
    files:
      - 'test-results/junit.xml'
    file-format: JUNITXML

# Cache node_modules between builds — speeds up install phase significantly
cache:
  paths:
    - '/root/.npm/**/*'
```

---

## AWS CodePipeline — Multi-Stage Pipeline

```
CodePipeline orchestrates stages: Source → Build → Test → Deploy-Staging → Approve → Deploy-Prod

Source:      watches GitHub/CodeCommit/S3 for changes
Build:       runs CodeBuild — tests + builds Docker image
Deploy:      deploys to ECS service using the new image
Approve:     manual approval action (email via SNS, approver clicks Approve in console)
```

```hcl
# Terraform: CodePipeline with Source (GitHub) → Build (CodeBuild) → Deploy (ECS)

resource "aws_codepipeline" "app_pipeline" {
  name     = "my-app-pipeline"
  role_arn = aws_iam_role.codepipeline_role.arn

  artifact_store {
    type     = "S3"
    location = aws_s3_bucket.pipeline_artifacts.bucket
    # All artifacts (source zip, build output) stored here between stages
  }

  stage {
    name = "Source"
    action {
      name             = "Source"
      category         = "Source"
      owner            = "ThirdParty"
      provider         = "GitHub"
      version          = "2"
      output_artifacts = ["SourceArtifact"]
      configuration = {
        Owner      = "my-github-org"
        Repo       = "my-app"
        Branch     = "main"
        ConnectionArn = aws_codestarconnections_connection.github.arn
      }
    }
  }

  stage {
    name = "Build"
    action {
      name             = "Build"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["SourceArtifact"]
      output_artifacts = ["BuildArtifact"]
      configuration = {
        ProjectName = aws_codebuild_project.app_build.name
      }
    }
  }

  stage {
    name = "DeployStaging"
    action {
      name            = "DeployToStaging"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "ECS"         # deploys by updating ECS service with new image
      version         = "1"
      input_artifacts = ["BuildArtifact"]
      configuration = {
        ClusterName = "my-cluster-staging"
        ServiceName = "my-app-staging"
        FileName    = "imageDefinitions.json"   # file written by buildspec.yml
      }
    }
  }

  stage {
    name = "ApproveProduction"
    action {
      name     = "ManualApproval"
      category = "Approval"
      owner    = "AWS"
      provider = "Manual"
      version  = "1"
      configuration = {
        NotificationArn = aws_sns_topic.pipeline_approvals.arn
        CustomData      = "Review staging at https://staging.myapp.com and approve for prod"
      }
      # Pipeline PAUSES here. Team reviews staging. Someone clicks Approve/Reject in console.
      # SNS notification is sent to the approver email/Slack channel.
    }
  }

  stage {
    name = "DeployProduction"
    action {
      name            = "DeployToProd"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "ECS"
      version         = "1"
      input_artifacts = ["BuildArtifact"]
      configuration = {
        ClusterName = "my-cluster-prod"
        ServiceName = "my-app-prod"
        FileName    = "imageDefinitions.json"
      }
    }
  }
}
```

---

## GitHub Actions Pipeline (Alternative to CodePipeline)

```yaml
# .github/workflows/deploy.yml
# GitHub Actions CI/CD pipeline: build → test → push to ECR → deploy to ECS

name: Deploy to AWS ECS

on:
  push:
    branches: [main]     # trigger on every push to main

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: my-app
  ECS_CLUSTER: my-cluster
  ECS_SERVICE: my-app

jobs:
  deploy:
    name: Build and Deploy
    runs-on: ubuntu-latest   # run on GitHub-hosted Ubuntu runner

    steps:
      - name: Checkout code
        uses: actions/checkout@v4     # check out your Git repo

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'              # cache node_modules between runs

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test                 # pipeline fails here if tests fail

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          # OIDC federation: no long-lived access keys needed
          # GitHub assumes the IAM Role via OIDC token (like IRSA for K8s)
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}    # full commit SHA as image tag
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:latest .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
          echo "IMAGE=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_ENV

      - name: Download ECS task definition
        run: |
          aws ecs describe-task-definition \
            --task-definition my-app \
            --query taskDefinition > task-definition.json

      - name: Update ECS task definition with new image
        id: update-task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: task-definition.json
          container-name: my-app
          image: ${{ env.IMAGE }}          # inject new image into task definition

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: ${{ steps.update-task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true  # wait until ECS service is stable before success
```

---

## Comprehensive AWS Interview Q&A

### IAM & Security

**Q: What is the principle of least privilege?**
> Grant only the permissions required to perform a specific task — nothing more. Instead of attaching `AdministratorAccess` to everything, create a narrowly scoped IAM policy (e.g., `s3:GetObject` on `arn:aws:s3:::my-specific-bucket/*`). Limits the blast radius if credentials are compromised.

**Q: What is the difference between an IAM Role and an IAM User?**
> IAM User: a permanent identity for a person or application. Has static long-lived access keys. Don't use for application code (rotation risk, secret leakage).
> IAM Role: a temporary identity assumed by AWS services, Lambda, EC2, or federated users. Issues short-lived credentials (STS tokens) that auto-rotate. Always prefer Roles over static keys.

**Q: How does STS (Security Token Service) work?**
> sts:AssumeRole returns temporary credentials (AccessKeyId, SecretAccessKey, SessionToken) valid for 15 min to 12 hours. EC2 instance metadata, Lambda, EKS IRSA all use STS under the hood. Rotating credentials means a stolen token expires automatically.

---

### Networking & VPC

**Q: What is a VPC and why do you use subnets?**
> VPC is your private isolated network in AWS. Subnets divide it: public subnets (have route to Internet Gateway — for ALB, NAT) and private subnets (no direct internet route — for databases, app servers). This limits the attack surface: DB servers are never directly reachable from the internet.

**Q: What is the difference between a Security Group and NACL?**
> Security Group: stateful firewall attached to an instance/ENI. Allows rules only (no deny). Return traffic is automatically allowed. Supports referencing other Security Groups as source/destination.
> NACL (Network ACL): stateless firewall at the subnet level. Must explicitly allow both inbound AND outbound (including ephemeral ports). Supports allow AND deny rules. Used for broad subnet-level rules.

**Q: What is a NAT Gateway?**
> Allows instances in private subnets to initiate outbound internet connections (e.g., npm install, API calls) without being reachable from the internet. Sits in a public subnet. Private instances route outbound traffic to the NAT Gateway, which masquerades as its own public IP.

---

### Compute & Scaling

**Q: What is an Auto Scaling Group and how does Target Tracking work?**
> ASG maintains a fleet of EC2 instances, automatically scaling in/out. Target Tracking policy: you set a metric target (e.g., average CPU 60%). ASG uses CloudWatch alarms to add instances when CPU > 60% and removes instances when CPU < 60%. No manual scaling rules needed.

**Q: What is the difference between vertical and horizontal scaling?**
> Vertical: make the instance larger (t3.small → t3.large). Limited by the size of the largest available instance. Requires downtime.
> Horizontal: add more instances (1 → 10 tasks/pods/instances). Limited only by architecture and cost. No single point of failure. Preferred in cloud-native design.

---

### Storage

**Q: What are the S3 storage classes and when do you use them?**
> Standard: frequently accessed data. Extra cost for retrieval is zero but per-GB cost higher.
> Standard-IA (Infrequent Access): accessed less than once a month. Cheaper per-GB, but retrieval costs money.
> Glacier Instant Retrieval: archive data retrieved within milliseconds. Much cheaper per-GB.
> Glacier Deep Archive: cheapest, retrieval takes hours. For compliance data kept for 7-10 years.
> Intelligent-Tiering: AWS automatically moves objects between tiers based on access patterns.

---

### Database

**Q: Aurora vs RDS — what is the difference?**
> Aurora is AWS's cloud-native MySQL/PostgreSQL-compatible database. It's faster than standard RDS (5x MySQL, 3x PostgreSQL) because of Aurora's distributed storage architecture (6 copies across 3 AZs, but appears as one volume). Aurora Serverless v2 auto-scales capacity. RDS is managed open-source engines — simpler and cheaper for small workloads.

**Q: When would you scan an entire DynamoDB table (Scan) and when do you Query?**
> Never Scan in production code. Scan reads every item in the table — slow and expensive at scale. Query fetches items by partition key + optional sort key condition — fast and efficient. Design your tables so all access patterns can be served by Query operations.

---

### Lambda & Serverless

**Q: What is a Lambda cold start and how do you mitigate it?**
> A cold start happens when Lambda hasn't been invoked recently and needs to create a new execution environment (container): download code, start Node.js runtime, run module-level code. Takes 100ms-1s. Mitigations: reduce package size (smaller layer = faster download), move initialization outside the handler function, use Provisioned Concurrency (keeps N environments warm — costs money but eliminates cold starts for predictable traffic).

**Q: What is Lambda concurrency and what happens when you hit the limit?**
> Concurrency = number of function instances running simultaneously. Default: 1,000 per AWS account per region. If you exceed this, new invocations are throttled (429 error). Reserved concurrency: set a maximum for one function (protects other functions from a runaway one). Provisioned concurrency: pre-warm N instances (helps cold starts but costs money).

---

### CI/CD & DevOps

**Q: What is the difference between CodeBuild, CodePipeline, and CodeDeploy?**
> CodeBuild: runs build commands (like GitHub Actions runner / Azure DevOps agent). Executes your `buildspec.yml`.
> CodePipeline: orchestrates stages (Source → Build → Deploy → Approve → Deploy). The workflow engine.
> CodeDeploy: deploys application artifacts to EC2, ECS, Lambda using `appspec.yml`. Handles rolling, blue/green strategies.

**Q: How do you prevent secrets from appearing in pipeline logs?**
> Store secrets in AWS Secrets Manager or SSM Parameter Store. Reference them in `buildspec.yml` via `parameter-store` or `secrets-manager` environment variable sections. CodeBuild fetches them at runtime and NEVER logs their values. Use `no-echo` in shell scripts. For GitHub Actions, use repository secrets — they are masked in logs automatically.

**Q: What is blue/green deployment?**
> Two identical environments: Blue (current production) and Green (new version).
> 1. Deploy new version to Green (no traffic yet).
> 2. Run smoke tests / health checks on Green.
> 3. Switch load balancer to route 100% traffic to Green.
> 4. Blue stays alive for quick rollback — just flip the LB back.
> 5. After validation period, decommission Blue.
> Zero downtime; instant rollback capability. ECS and CodeDeploy support this natively.

---

### Resilience & Disaster Recovery

**Q: Strategies to improve system resilience/survival quality for applications deployed on AWS**
> Resilience = ability to recover from failures and continue operation. Multi-layered approach required.
> 
> **1. High Availability (HA):**
> - Deploy across MULTIPLE AVAILABILITY ZONES (AZs) → if one AZ fails, traffic shifts to others
> - Use Auto Scaling Groups (ASG) with min 2-3 instances across AZs
> - Application Load Balancer (ALB) distributes traffic; health checks remove unhealthy targets
> - RDS Multi-AZ: synchronous replica in another AZ; failover is automatic (DNS update)
> 
> **2. Disaster Recovery (DR):**
> - Regular snapshots / backups (EBS, RDS, DynamoDB point-in-time recovery)
> - Cross-region replication (for critical apps)
> - Recovery Time Objective (RTO): how long until system is back up (target: minutes to hours)
> - Recovery Point Objective (RPO): how much data can be lost (target: recent backups)
> 
> **3. Circuit Breaker + Retry Logic:**
> ```
> Request → Try (fail) → Retry with backoff → If threshold exceeded, Circuit breaks
>          → sends fast error to client instead of hanging
> After timeout, Circuit half-open → test single request → if OK, close circuit
> ```
> Use libraries like AWS SDK retry policies, Polly (C#), Resilience4j (Java).
> 
> **4. Load Balancing + Auto Scaling:**
> - ALB routes requests across instances; if instance unhealthy, ALB stops sending traffic
> - ASG scales up when CPU > 70%; scales down when < 30%
> - Prevents single point of failure; handles traffic spikes automatically
> 
> **5. Queue-Based Async Processing (SQS):**
> - Instead of: User request → Sync processing (slow, can timeout)
> - Better: User request → SQS queue → Worker processes asynchronously
> - If worker dies, message stays in SQS; another worker picks it up
> - Decouples producer from consumer; consumer can scale independently
> 
> **6. Cache & CDN (CloudFront):**
> - CloudFront caches at edge locations; if origin goes down, CloudFront can serve stale content
> - ElastiCache (Redis/Memcached) caches DB queries; reduces DB load
> - Cache MISS on CloudFront falls back to origin; if origin slow, users see old data (better than error)
> 
> **7. Monitoring, Alerting, Logging (CloudWatch):**
> - Set up alarms: if CPU > 80%, alert ops team
> - Log aggregation: send all app logs to CloudWatch; search errors rapidly
> - Metrics: CPU, network, disk; identify trends before failure
> - Synthetics: periodic health checks from multiple regions
> 
> **8. Graceful Degradation:**
> - If non-critical service fails (e.g., recommendations), show default data instead of error
> - Prioritize critical paths: auth > payment > recommendations
> 
> **9. Rate Limiting & DDoS Protection:**
> - AWS WAF: block malicious IPs, rate-limit requests
> - Shield Standard (free): basic DDoS protection on Layer 3/4
> - Shield Advanced: advanced DDoS mitigation (paid)
> 
> **10. Multi-Region Deployment (for critical apps):**
> - App runs in us-east-1 AND eu-west-1
> - Route 53 health checks fail over to secondary region automatically
> - Data replicated globally (DynamoDB Global Tables, RDS read replicas, S3 cross-region replication)

---

### CI/CD Pipeline Design

**Q: Designing a CI/CD pipeline for a first-time application using modern tools and processes**
> From commit to production deployment, automated testing and quality gates ensure speed and safety.
> 
> **Pipeline Stages (typical flow):**
> 1. **Source Stage**: Code pushed to GitHub/GitLab/CodeCommit
> 2. **Build Stage**: Compile, lint, unit tests, create Docker image
> 3. **Test Stage**: Integration tests, security scanning (SAST), artifact scanning (container image vulnerability scan)
> 4. **Stage Deployment**: Deploy to staging environment, run end-to-end tests, smoke tests
> 5. **Approval**: Manual approval if needed (for production)
> 6. **Production Deployment**: Blue-green or canary deployment, health check, rollback if needed
> 
> **Modern Tools Stack:**
> 
> | Stage | AWS Tools | Popular Alternatives |
> |-------|-----------|---|
> | Source | CodeCommit | GitHub, GitLab, Bitbucket |
> | Build | CodeBuild | Jenkins, GitLab CI, CircleCI, GitHub Actions |
> | Test | CodeBuild (run tests) | Same as Build |
> | Deploy | CodeDeploy, CloudFormation | Terraform (IaC), Helm (Kubernetes) |
> | Orchestration | CodePipeline | Jenkins, GitLab CI, GitHub Actions |
> | Container Registry | ECR (Elastic Container Registry) | Docker Hub, Artifactory, GitHub Container Registry |
> 
> **Recommended First-Time Setup:**
> ```
> GitHub → GitHub Actions (free CI/CD) → AWS CodeDeploy → ECS or EC2
> OR
> GitHub → AWS CodePipeline → CodeBuild → CodeDeploy → ECS/EKS
> ```
> 
> **Pipeline Configuration (AWS CodePipeline + CodeBuild + ECS):**
> See CloudFormation/Terraform configuration above for full details. Key points:
> - `buildspec.yml` defines: install → lint/test → build Docker image → push to ECR
> - Manual approval gate before production deployment
> - ECS new task definition references the new image URI from build artifacts
> 
> **Best Practices for New Applications:**
> 1. **Start simple**: GitHub Actions + one deploy target (e.g., ECS) before multi-region
> 2. **Test automation**: unit + integration + e2e tests in build stage (fail fast)
> 3. **Security scanning**: container image scan, dependency scanning (CVE), secrets detection
> 4. **Infrastructure as Code (IaC)**: CloudFormation or Terraform; deploy infra alongside code
> 5. **Blue-Green Deployment**: zero-downtime; old version stays up while new version starts; traffic switched atomically
> 6. **Health Checks**: endpoint must respond 200 OK before traffic hits it
> 7. **Rollback Strategy**: if deployment fails, auto-rollback to previous version
> 8. **Monitoring**: enable CloudWatch alarms; if error rate > threshold after deploy, trigger rollback
> 9. **Staging Environment**: mirrors production; test there before production deployment
> 10. **Incremental Rollout**: canary deployment (5% traffic) → wait 15 min → 50% → 100% (catch issues early on small traffic slice)
