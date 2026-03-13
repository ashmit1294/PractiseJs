# AWS Cloud Services — Interview Revision Summary

> **Target:** 7+ year Full Stack MERN Developer | **Files:** 8

## Table of Contents

1. [01_core_services_iam.md — What is AWS?](#01_core_services_iammd-what-is-aws)
2. [02_ec2_vpc.md — EC2 — Elastic Compute Cloud](#02_ec2_vpcmd-ec2-elastic-compute-cloud)
3. [03_s3_cloudfront.md — S3 — Simple Storage Service](#03_s3_cloudfrontmd-s3-simple-storage-service)
4. [04_lambda_api_gateway.md — Lambda — Serverless Functions](#04_lambda_api_gatewaymd-lambda-serverless-functions)
5. [05_rds_dynamodb_cache.md — RDS — Relational Database Service](#05_rds_dynamodb_cachemd-rds-relational-database-service)
6. [06_sqs_sns_eventbridge.md — Why Event-Driven?](#06_sqs_sns_eventbridgemd-why-event-driven)
7. [07_ecs_eks_ecr.md — Container Services — Choosing the Right One](#07_ecs_eks_ecrmd-container-services-choosing-the-right-one)
8. [08_cicd_interview_qa.md — CI/CD Concepts](#08_cicd_interview_qamd-cicd-concepts)

---

<a id="aws-core-services-iam"></a>
## 01_core_services_iam.md — What is AWS?

# AWS: Core Services Overview

## What is AWS?
Amazon Web Services is a cloud platform offering 200+ services — from virtual servers
to AI, databases, networking, and developer tools. This folder covers the services
most commonly asked about in interviews for full-stack, backend, and DevOps roles.

---

## AWS Global Infrastructure

```
Region          = geographic area (e.g., us-east-1, eu-west-1, ap-southeast-1)
Availability Zone (AZ) = one or more data centres within a Region (us-east-1a, 1b, 1c)
Edge Location   = CDN node for CloudFront (hundreds worldwide)

Best practice: deploy across at least 2 AZs for high availability.
```

| Term | Meaning |
|------|---------|
| Region | Isolated geographic cluster of AZs |
| AZ | Physically separate data centres within a Region |
| VPC | Your own private network inside AWS |
| IAM | Manages WHO can do WHAT in your account |
| ARN | Amazon Resource Name — unique ID for every AWS resource |

---

## IAM — Identity and Access Management

```
Every API call to AWS asks:
  WHO are you?    → Principal (User, Role, Service)
  WHAT do you want to do?  → Action (s3:GetObject, ec2:DescribeInstances)
  ON WHAT?        → Resource (arn:aws:s3:::mybucket/*)
  ALLOWED?        → IAM evaluates attached Policies
```

```json
// IAM Policy example: allow read-only access to a specific S3 bucket
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3Read",
      "Effect": "Allow",            // Allow or Deny
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-production-bucket",
        "arn:aws:s3:::my-production-bucket/*"
      ]
    }
  ]
}
```

```bash
# Always use IAM Roles instead of long-lived Access Keys for AWS services
# EC2 instance, Lambda, ECS Task — all should use IAM Roles

# Example: attach a role to an EC2 instance at launch
aws ec2 run-instances \
  --image-id ami-0abcdef1234567890 \
  --iam-instance-profile Name=my-ec2-role \
  --instance-type t3.micro

# Check current identity (who am I?)
aws sts get-caller-identity
```

---

## Core Compute Services

| Service | What it Does | Use Case |
|---------|-------------|----------|
| EC2 | Virtual machines in the cloud | Traditional server workloads, custom OS config |
| Lambda | Run code without managing servers | Event-driven, short tasks, API handlers |
| ECS (Fargate) | Run Docker containers | Containerised apps without K8s complexity |
| EKS | Managed Kubernetes | Large containerised workloads, microservices |
| Elastic Beanstalk | Deploy web apps without infrastructure config | Simple web app deployment, auto-manages EC2/ALB/ASG |
| App Runner | Fully managed container service | Simplest way to deploy a container to the web |

---

## Core Storage Services

| Service | Type | Use Case |
|---------|------|----------|
| S3 | Object store | File storage, backups, static websites, data lakes |
| EBS | Block storage (attached to EC2) | Database volumes, OS disks |
| EFS | Network filesystem (NFS) | Shared files across multiple EC2/Lambda |
| Glacier | Archive object store | Long-term cold storage (retrieved in hours) |

---

## Core Database Services

| Service | Type | Use Case |
|---------|------|----------|
| RDS | Managed relational DB | Postgres, MySQL, MariaDB, Oracle, MSSQL |
| Aurora | AWS-native relational DB | High-performance Postgres/MySQL compatible |
| DynamoDB | NoSQL key-value + document | High-throughput apps, gaming, IoT |
| ElastiCache | In-memory cache (Redis/Memcached) | Session store, query cache |
| Redshift | Data warehouse | Analytics, BI queries on large datasets |

---

## Core Networking Services

| Service | What it Does |
|---------|-------------|
| VPC | Your private network — subnets, routing, security groups |
| Route 53 | DNS + domain registration |
| CloudFront | CDN — cache content at edge locations globally |
| API Gateway | Managed HTTP/WebSocket API frontend for Lambda/backends |
| ALB / NLB | Load balancers (layer 7 HTTP / layer 4 TCP) |

---

## How to interact with AWS

```bash
# AWS CLI — install: pip install awscli
aws configure                # set Access Key, Secret, Region, Output format

# List S3 buckets
aws s3 ls

# Deploy Lambda function
aws lambda update-function-code \
  --function-name myFunction \
  --zip-file fileb://function.zip

# Describe EC2 instances
aws ec2 describe-instances --filters "Name=instance-state-name,Values=running"

# AWS SDK (Node.js)
npm install @aws-sdk/client-s3

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({ region: 'us-east-1' });
await s3.send(new PutObjectCommand({ Bucket: 'mybucket', Key: 'file.txt', Body: 'hello' }));
```

---

## Pricing model (simplified)

| Model | Explanation | Best For |
|-------|-------------|----------|
| On-Demand | Pay per second/hour, no commitment | Variable workloads, development |
| Reserved | 1-3 year commitment — up to 72% discount | Steady-state production workloads |
| Spot | Bid on spare capacity — up to 90% discount | Batch processing, fault-tolerant workloads |
| Savings Plans | Commit to $ amount/hour — flexible across services | Mixed EC2/Lambda/Fargate |

---

## Interview Questions

**Q: What is the difference between a Region and an Availability Zone?**
> A Region is a geographic area (e.g., US East — Virginia). Within a Region there are 3+ AZs — physically separate data centres with independent power and networking. Deploying across 2+ AZs protects against a single data centre failure. Regions are fully independent — useful for data residency requirements.

**Q: What is IAM and why are Roles better than Access Keys?**
> IAM controls who can do what in your AWS account. Access Keys are long-lived credentials that can be leaked (committed to Git, stored in config files). IAM Roles are short-lived credentials automatically rotated by AWS — assigned to EC2, Lambda, ECS, EKS. No secret to store or rotate manually.

**Q: What is the difference between SCP and IAM Policy?**
> IAM Policy is attached to a Principal (User/Role) within an account — defines what that identity CAN do.  
> Service Control Policy (SCP) is applied at the AWS Organizations level — defines the MAXIMUM permissions any IAM entity in an account can have. SCP sets a ceiling; IAM is the floor. Even if my IAM role says "allow everything", an SCP can block specific actions.

**Q: What is the difference between ECS and EKS?**
> ECS is AWS's own container orchestrator — simpler, AWS-native, tight integration with ALB/IAM/CloudWatch. EKS is managed Kubernetes — portable, industry standard, more complex to operate. Choose ECS for simpler setups; EKS for large organizations already using Kubernetes or needing advanced orchestration.

**Q: What is the Shared Responsibility Model?**
> AWS is responsible for security OF the cloud (physical datacentres, hardware, hypervisor, managed service software). You are responsible for security IN the cloud (IAM policies, data encryption, OS patching on EC2, network configuration, application security). The boundary: AWS manages below the hypervisor; you manage above it.

---

<a id="aws-ec2-vpc"></a>
## 02_ec2_vpc.md — EC2 — Elastic Compute Cloud

# AWS: EC2 and VPC Networking

## EC2 — Elastic Compute Cloud
EC2 lets you rent virtual machines (called "instances") on demand.
You pick an AMI (OS image), instance type (CPU/RAM size), and storage.

---

## Instance Types

```
Naming convention: <family><generation>.<size>
Examples:
  t3.micro    → t=burstable, gen 3, micro (2 vCPU, 1 GiB RAM)
  m6i.xlarge  → m=general purpose, gen 6 (Intel), xlarge (4 vCPU, 16 GiB RAM)
  c7g.2xlarge → c=compute optimised, gen 7 (Graviton ARM), 2xlarge (8 vCPU, 16 GiB)
  r6i.large   → r=memory optimised, large (2 vCPU, 16 GiB RAM)
  p4d.24xlarge→ p=GPU, 24xlarge (96 vCPU + A100 GPUs) — ML training
```

| Family | Optimised For | Example Use |
|--------|--------------|-------------|
| t3/t4g | Burstable CPU (cheap baseline) | Dev/test, blogs, small APIs |
| m6i/m7g | Balanced CPU+RAM | Web servers, application servers |
| c6i/c7g | CPU-heavy workloads | Video encoding, HPC, batch |
| r6i/r7g | RAM-heavy workloads | In-memory databases, caches |
| p4d/g5 | GPU | ML training, GPU rendering |
| i4i | NVMe SSD storage | High-throughput databases |

---

## Launch an EC2 Instance (AWS CLI)

```bash
# Launch a t3.micro instance running Amazon Linux 2023
aws ec2 run-instances \
  --image-id ami-0abcdef1234567890 \   # AMI ID (region-specific)
  --instance-type t3.micro \
  --key-name my-key-pair \              # SSH key name for login
  --subnet-id subnet-0abc123 \          # which subnet (and thus which AZ)
  --security-group-ids sg-0def456 \     # firewall rules
  --iam-instance-profile Name=web-server-role \   # attach IAM Role
  --user-data file://bootstrap.sh \     # script to run on first boot
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=api-server}]'

# bootstrap.sh — runs as root on first boot (user-data)
#!/bin/bash
yum update -y
yum install -y nodejs
cd /app
npm ci --only=production
node dist/index.js
```

---

## VPC — Virtual Private Cloud

```
VPC = your own isolated network within AWS.
Without a VPC, all AWS resources would be on a flat public internet.
A VPC lets you control IP ranges, subnets, routing, and firewalls.

VPC CIDR: 10.0.0.0/16    → gives you 65536 IP addresses
  ┌─── Public Subnet (10.0.1.0/24) ────────────────────┐
  │  • Has Route to Internet Gateway (IGW)              │
  │  • Resources here CAN receive inbound internet traffic │
  │  • Used for: Load Balancers, NAT Gateways, Bastion hosts │
  └──────────────────────────────────────────────────────┘
  ┌─── Private Subnet (10.0.2.0/24) ───────────────────┐
  │  • Routes outbound traffic through NAT Gateway      │
  │  • NO inbound from internet (no IGW route)          │
  │  • Used for: EC2 app servers, RDS databases         │
  └──────────────────────────────────────────────────────┘
```

---

## VPC with Terraform (Infrastructure as Code)

```hcl
# Terraform — define your VPC, subnets, routing in code
# This is the production-ready way to manage AWS networking

# The VPC itself — our private network space
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true    # allows EC2 instances to get DNS names
  enable_dns_support   = true

  tags = { Name = "production-vpc" }
}

# Internet Gateway — allows traffic in/out of VPC from the internet
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "production-igw" }
}

# Public subnet in AZ-a — load balancers live here
resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true    # instances get a public IP automatically

  tags = { Name = "public-us-east-1a" }
}

# Public subnet in AZ-b (second AZ for high availability)
resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "us-east-1b"
  map_public_ip_on_launch = true

  tags = { Name = "public-us-east-1b" }
}

# Private subnet in AZ-a — application servers live here
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "us-east-1a"

  tags = { Name = "private-us-east-1a" }
}

# Route table for public subnets — routes 0.0.0.0/0 to IGW
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"              # all traffic
    gateway_id = aws_internet_gateway.igw.id   # → out to internet
  }

  tags = { Name = "public-rt" }
}

# Associate the public route table with both public subnets
resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

# NAT Gateway — allows private subnet instances to reach internet (outbound only)
# Sits in public subnet; private subnet routes to it
resource "aws_eip" "nat" {
  domain = "vpc"      # required for NAT Gateway EIP
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_a.id   # NAT Gateway must be in public subnet

  tags = { Name = "production-nat" }
}

# Route table for private subnets — outbound via NAT
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id  # → outbound through NAT
  }

  tags = { Name = "private-rt" }
}
```

---

## Security Groups

```bash
# Security Groups = stateful virtual firewall at the instance level.
# Think of them as "allow rules only" — there is no deny rule.
# Stateful: if you allow inbound port 443, the response traffic is automatically allowed out.

aws ec2 create-security-group \
  --group-name web-sg \
  --description "Web server security group" \
  --vpc-id vpc-0abc12345

# Allow HTTPS from anywhere (internet-facing ALB)
aws ec2 authorize-security-group-ingress \
  --group-id sg-0def456 \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Allow port 3000 ONLY from the load balancer SG (not from the internet directly)
aws ec2 authorize-security-group-ingress \
  --group-id sg-app-servers \
  --protocol tcp \
  --port 3000 \
  --source-group sg-load-balancer   # reference another SG as source
```

---

## Application Load Balancer (ALB)

```bash
# ALB operates at layer 7 (HTTP/HTTPS).
# Routes requests to target groups based on path or hostname.

# Create ALB
aws elbv2 create-load-balancer \
  --name production-alb \
  --subnets subnet-public-a subnet-public-b \  # must be in 2+ AZs
  --security-groups sg-alb \
  --scheme internet-facing \
  --type application

# Create target group (where traffic goes)
aws elbv2 create-target-group \
  --name api-targets \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-0abc12345 \
  --health-check-path /health \        # ALB checks this endpoint
  --health-check-interval-seconds 30

# Register EC2 instances in target group
aws elbv2 register-targets \
  --target-group-arn arn:aws:elasticloadbalancing:... \
  --targets Id=i-abc123 Id=i-def456
```

---

## Auto Scaling Group (ASG)

```bash
# ASG automatically launches/terminates EC2 instances based on demand.
# Works with ALB: new instances are automatically registered in the target group.

aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name api-asg \
  --launch-template "LaunchTemplateId=lt-0abc123,Version=\$Latest" \
  --min-size 2 \         # always keep at least 2 instances (HA)
  --max-size 10 \        # never exceed 10
  --desired-capacity 2 \
  --target-group-arns arn:aws:elasticloadbalancing:... \
  --vpc-zone-identifier "subnet-private-a,subnet-private-b"

# Scale on CPU > 70%
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name api-asg \
  --policy-name scale-on-cpu \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ASGAverageCPUUtilization"
    },
    "TargetValue": 70.0
  }'
```

---

## Interview Questions

**Q: What is the difference between a public and private subnet?**
> A public subnet has a route to an Internet Gateway (IGW) — resources can receive inbound internet traffic if they have a public IP. A private subnet does not have a route to the IGW — no direct inbound from the internet. Private instances can make outbound requests through a NAT Gateway. Best practice: put load balancers in public subnets, application servers and databases in private subnets.

**Q: What is a NAT Gateway and why is it needed?**
> Private subnet instances need to reach the internet for things like downloading updates, calling external APIs, or downloading npm packages — but they must not be reachable FROM the internet. NAT Gateway sits in the public subnet, translates private IPs to its own elastic IP for outbound requests, and routes responses back. It's outbound-only translation.

**Q: What is the difference between Security Groups and NACLs?**
> Security Groups: stateful, instance-level, allow rules only, evaluated as a whole. If a request comes in and matches an allow rule, the response is automatically allowed out.
> Network ACLs (NACLs): stateless, subnet-level, both allow AND deny rules, evaluated in rule number order. Because stateless, you need explicit rules for both inbound AND outbound traffic. Security Groups are preferred for most use cases.

**Q: What is an ALB and when would you use an NLB instead?**
> ALB (Application Load Balancer) operates at layer 7 — understands HTTP/HTTPS, can route based on path (`/api` → API servers, `/static` → S3), host headers, and query strings. NLB (Network Load Balancer) operates at layer 4 — fast TCP/UDP routing, preserves client IP, handles millions of requests per second. Use ALB for HTTP microservices; NLB for low-latency TCP workloads or when you need a static IP.

**Q: What is an Auto Scaling Group?**
> An ASG manages a fleet of EC2 instances, automatically scaling in and out based on demand. It uses a Launch Template to know what type of instance to create. Target Tracking scaling policies maintain a target metric (e.g., CPU at 70%). ASGs integrate with ALB to register/deregister instances automatically. Minimum replicas provide high availability; maximum prevents runaway costs.

---

<a id="aws-s3-cloudfront"></a>
## 03_s3_cloudfront.md — S3 — Simple Storage Service

# AWS: S3 and CloudFront

## S3 — Simple Storage Service
S3 is an object store. You store files (objects) in containers (buckets).
Unlike a filesystem (folders and files), S3 has flat keys that look like paths.

```
s3://my-bucket/images/profile/alice.jpg
       ↑           ↑
    bucket name    key (the "path" is just part of the key string)
```

---

## Core S3 Concepts

| Concept | Explanation |
|---------|-------------|
| Bucket | Container for objects — globally unique name |
| Object | A file + metadata, up to 5TB per object |
| Key | The name/path of an object within a bucket |
| Prefix | Simulated folder — all keys starting with `images/` |
| Storage Class | Trade-off between cost and retrieval speed |
| Versioning | Keep previous versions of every object |
| ACL / Bucket Policy | Control who can access the bucket or objects |

---

## S3 Storage Classes

| Class | Access Pattern | Cost |
|-------|---------------|------|
| Standard | Frequent access | Highest |
| Intelligent-Tiering | Unknown/changing | Automatic tiering |
| Standard-IA | Infrequent access | Lower storage, retrieval fee |
| One Zone-IA | Infrequent, single AZ | Cheaper, less durable |
| Glacier Instant | Archive, instant retrieval | Very cheap |
| Glacier Flexible | Archive, hours to retrieve | Cheapest active archive |
| Glacier Deep Archive | Archive, 12h retrieval | Cheapest overall |

---

## Common S3 Operations

```javascript
// AWS SDK v3 (modular — only import what you need)
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} = require('@aws-sdk/client-s3');

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Initialise the client — credentials come from IAM Role in production
// (never hard-code keys; use environment or EC2/Lambda role)
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.S3_BUCKET;

// ── Upload a file ──────────────────────────────────────────────────────────
async function uploadFile(key, buffer, contentType) {
  // PutObject: upload the entire object at once (fine for files < 100MB)
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,                        // e.g., 'uploads/users/alice/photo.jpg'
    Body: buffer,                    // Buffer, ReadableStream, or string
    ContentType: contentType,        // e.g., 'image/jpeg'
    ServerSideEncryption: 'AES256',  // encrypt at rest using AWS-managed keys
    // StorageClass: 'INTELLIGENT_TIERING',  // uncomment to use cheaper class
    Metadata: {
      uploadedBy: 'api-server',      // custom metadata (stored with object)
    },
  });

  await s3.send(command);
  // Object is now available at: https://BUCKET.s3.REGION.amazonaws.com/KEY
}

// ── Download a file ────────────────────────────────────────────────────────
async function downloadFile(key) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await s3.send(command);

  // response.Body is a ReadableStream — convert to buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// ── Generate a presigned URL (temporary access to a private object) ────────
// Presigned URL: a time-limited URL that lets a browser directly access
// or upload to S3 without going through your server.
// Use case: let users upload profile photos directly to S3 (no server proxy).
async function getPresignedDownloadUrl(key, expiresIn = 3600) {
  // The URL is valid for 'expiresIn' seconds (default 1 hour).
  // Anyone with this URL can GET the object — treat it like a temporary password.
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
}

async function getPresignedUploadUrl(key, contentType, expiresIn = 300) {
  // Client receives this URL and uploads directly using a PUT request.
  // Limits: content-type and content-length are locked to prevent abuse.
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
  });
  return getSignedUrl(s3, command, { expiresIn });
}

// ── List objects (paginated) ────────────────────────────────────────────────
async function listFiles(prefix, maxKeys = 100) {
  const results = [];
  let continuationToken;

  // S3 returns max 1000 objects per call — paginate using ContinuationToken
  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,              // only list keys starting with this prefix
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
    });

    const response = await s3.send(command);
    results.push(...response.Contents);
    continuationToken = response.NextContinuationToken;  // null when done
  } while (continuationToken);

  return results;
}

// ── Delete an object ───────────────────────────────────────────────────────
async function deleteFile(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// ── Copy an object ─────────────────────────────────────────────────────────
async function copyFile(sourceKey, destKey) {
  // Server-side copy — no data transfer through your server
  await s3.send(new CopyObjectCommand({
    Bucket: BUCKET,
    CopySource: `${BUCKET}/${sourceKey}`,   // source: bucket/key
    Key: destKey,                           // destination key
  }));
}
```

---

## Bucket Policy — control access declaratively

```json
// Bucket policy: allow only a specific IAM role to write objects.
// Block all public access — objects are never publicly accessible.
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAPIServerRole",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/api-server-role"
      },
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::my-production-bucket/*"
    },
    {
      "Sid": "DenyPublicAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-production-bucket/*",
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalArn": "arn:aws:iam::123456789012:role/api-server-role"
        }
      }
    }
  ]
}
```

---

## S3 Lifecycle Rules — auto-move objects to cheaper storage

```json
// Example: move objects older than 30 days to Standard-IA,
// then to Glacier after 90 days, then delete after 365 days.
// This dramatically reduces storage cost for log files, backups, etc.
{
  "Rules": [
    {
      "ID": "log-lifecycle",
      "Status": "Enabled",
      "Filter": { "Prefix": "logs/" },
      "Transitions": [
        { "Days": 30,  "StorageClass": "STANDARD_IA" },
        { "Days": 90,  "StorageClass": "GLACIER" }
      ],
      "Expiration": { "Days": 365 }
    }
  ]
}
```

---

## S3 Event Notifications

```javascript
// S3 can trigger Lambda when objects are created/deleted.
// Great for: image resizing, virus scanning, indexing, ETL pipelines.
// Configure in the S3 bucket Notification settings or via Terraform.

// Lambda handler: triggered on s3:ObjectCreated:* events
exports.handler = async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const size = record.s3.object.size;

    console.log(`New object: s3://${bucket}/${key} (${size} bytes)`);

    // Process the new object: resize an image, parse a CSV, scan for viruses...
    await processObject(bucket, key);
  }
};
```

---

## CloudFront — Content Delivery Network (CDN)

```
CloudFront = global CDN with 400+ edge locations.
Instead of every user hitting your S3 bucket or server directly,
CloudFront caches content at the edge location closest to the user.

Flow:
User in London → CloudFront edge (London) → cache hit? serve immediately
                                           → cache miss? fetch from S3 / origin server
```

```javascript
// CDN URL pattern:
// Instead of: https://my-bucket.s3.us-east-1.amazonaws.com/images/logo.png
// Use:         https://d1abc2xyz.cloudfront.net/images/logo.png
//              ↑ much faster for global users — served from nearest edge
```

---

## CloudFront Distribution (Terraform)

```hcl
resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  default_root_object = "index.html"   # for SPA: serve index.html at root

  # Origin: where CloudFront fetches content from
  origin {
    domain_name = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id   = "S3-assets"

    # Use Origin Access Control so S3 only accepts requests from CloudFront
    # (S3 bucket stays private — no public access)
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  # Default cache behaviour: cache everything at edge
  default_cache_behavior {
    target_origin_id       = "S3-assets"
    viewer_protocol_policy = "redirect-to-https"   # HTTP → HTTPS redirect

    allowed_methods = ["GET", "HEAD"]
    cached_methods  = ["GET", "HEAD"]

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"  # CachingOptimized

    compress = true    # automatically gzip/brotli compress responses
  }

  # Cache API calls at edge (optional — be careful with dynamic content)
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "API"
    viewer_protocol_policy = "https-only"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"  # CachingDisabled
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  # TLS certificate (from ACM — must be in us-east-1 for CloudFront)
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.cert.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # Custom error pages: show React SPA for 404/403 (S3 key not found)
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"  # SPA routing: let React handle the 404
  }

  tags = { Environment = "production" }
}
```

---

## Cache Invalidation

```bash
# When you deploy new assets, tell CloudFront to purge old cached versions
aws cloudfront create-invalidation \
  --distribution-id E1ABCDEF12345 \
  --paths "/*"              # invalidate everything

# Or just specific paths:
aws cloudfront create-invalidation \
  --distribution-id E1ABCDEF12345 \
  --paths "/index.html" "/static/js/main.chunk.js"
```

---

## Interview Questions

**Q: What is S3 and how is it different from a traditional filesystem?**
> S3 is a flat key-value object store — there are no real "folders". What looks like a path (`images/profile/alice.jpg`) is actually the entire key string. Objects are accessed via HTTP PUT/GET, not filesystem calls. S3 is infinitely scalable, globally distributed, 99.999999999% (11 nines) durable, and priced per GB stored + per request.

**Q: What is a presigned URL and when would you use it?**
> A presigned URL is a time-limited signed link that grants temporary access to a private S3 object. Use for: letting users directly upload profile photos to S3 (PUT presigned URL) or download private documents (GET presigned URL) without routing the file data through your server. This reduces backend load and transfer costs.

**Q: How do you make an S3 bucket serve a static website?**
> Enable static website hosting on the bucket, set the index document to `index.html`. Put the bucket behind CloudFront for HTTPS, a custom domain (Route 53 CNAME), and global caching. Deployments: run `aws s3 sync ./dist s3://mybucket --delete`, then invalidate the CloudFront cache.

**Q: What is CloudFront and why use it?**
> CloudFront is AWS's CDN — it caches content at 400+ global edge locations. Benefits: reduced latency (content served from nearest city), reduced origin load (cache hits don't reach S3/server), DDoS protection (AWS Shield Standard included), TLS termination at edge, Gzip/Brotli compression.

**Q: What is Origin Access Control (OAC) in CloudFront?**
> OAC ensures that your S3 bucket only accepts requests coming FROM your CloudFront distribution. The bucket remains private (no public access). CloudFront signs requests with a special identity; the S3 bucket policy only trusts that identity. This prevents users from bypassing CloudFront and accessing S3 directly.

---

<a id="aws-lambda-api-gateway"></a>
## 04_lambda_api_gateway.md — Lambda — Serverless Functions

# AWS: Lambda and API Gateway

## Lambda — Serverless Functions

```
Traditional server: runs 24/7, you pay even when idle
Lambda: runs ONLY when triggered, you pay only for execution time (per 100ms)

Maximum: 15 minutes execution time, 10GB RAM, 10GB ephemeral storage (/tmp)
```

---

## Lambda Triggers (Event Sources)

| Trigger | Description |
|---------|-------------|
| API Gateway / HTTP URL | HTTP request → Lambda response |
| S3 Event | Object created / deleted in S3 |
| SQS / SNS / EventBridge | Message queue, notification, event bus |
| DynamoDB Streams | React to DB changes |
| CloudWatch Events | Scheduled (cron), CloudWatch alarms |
| Kinesis | Streaming data processing |
| Cognito | Custom authentication triggers |

---

## Basic Lambda Function (Node.js)

```javascript
// Every Lambda function has a handler function.
// AWS calls it with: (event, context)
//   event   = the trigger data (HTTP request, S3 event, SQS message, etc.)
//   context = metadata about this invocation (requestId, remaining time, etc.)

exports.handler = async (event, context) => {
  // Log the incoming event for debugging (visible in CloudWatch Logs)
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Remaining time:', context.getRemainingTimeInMillis(), 'ms');

  try {
    const result = await doWork(event);

    // For API Gateway / HTTP URL integrations, return an HTTP response object
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',   // CORS header
      },
      body: JSON.stringify({ success: true, data: result }),
    };
  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
```

---

## Environment Variables and Secrets in Lambda

```javascript
// Environment variables are set in Lambda configuration, NOT hard-coded.
// In production: use Parameter Store or Secrets Manager (not plain env vars for secrets).

// Read plain config from environment
const REGION = process.env.AWS_REGION;
const TABLE_NAME = process.env.DYNAMODB_TABLE;
const BUCKET = process.env.S3_BUCKET;

// For secrets: fetch from AWS SSM Parameter Store at cold start
// (cache it — don't fetch on every invocation)
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const ssm = new SSMClient({ region: REGION });

let cachedSecret = null;

async function getSecret() {
  if (cachedSecret) return cachedSecret;  // reuse across warm invocations

  const command = new GetParameterCommand({
    Name: '/production/api/jwt-secret',
    WithDecryption: true,   // Parameter Store SecureString uses KMS encryption
  });

  const response = await ssm.send(command);
  cachedSecret = response.Parameter.Value;
  return cachedSecret;
}
```

---

## Lambda Layers — share code across functions

```bash
# A Layer is a zip file containing shared dependencies (node_modules, utilities).
# Multiple Lambda functions can reference the same Layer — avoids code duplication.

# 1. Build the layer zip
mkdir -p nodejs/node_modules
cd nodejs && npm install axios lodash && cd ..
zip -r layer.zip nodejs/

# 2. Publish the layer
aws lambda publish-layer-version \
  --layer-name shared-utils \
  --description "Shared utilities: axios, lodash" \
  --compatible-runtimes nodejs20.x \
  --zip-file fileb://layer.zip

# 3. Attach the layer to a function
aws lambda update-function-configuration \
  --function-name myFunction \
  --layers arn:aws:lambda:us-east-1:123456789:layer:shared-utils:1
```

---

## Lambda Concurrency

```bash
# Lambda scales automatically: each request gets its own execution environment.
# Cold Start: when a new environment is created (~100ms-1s for Node.js).
# Warm Start: reuses an existing environment (<5ms overhead).

# Reserved Concurrency: LIMIT a function to N simultaneous executions.
# Useful to protect a downstream DB from being overwhelmed.
aws lambda put-function-concurrency \
  --function-name myFunction \
  --reserved-concurrent-executions 50   # max 50 simultaneous Lambda executions

# Provisioned Concurrency: PRE-WARM N environments.
# Eliminates cold starts for latency-sensitive APIs (costs more).
aws lambda put-provisioned-concurrency-config \
  --function-name myFunction \
  --qualifier production \    # must be an alias or version
  --provisioned-concurrent-executions 10
```

---

## Serverless Framework (deploy Lambda easily)

```yaml
# serverless.yml — defines functions, events, and AWS resources
service: my-api

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  stage: ${opt:stage, 'dev'}         # from CLI: --stage production
  environment:
    DYNAMODB_TABLE: ${self:service}-${self:provider.stage}-users
    NODE_ENV: ${self:provider.stage}
  iam:
    role:
      statements:
        # Grant this Lambda permission to read/write DynamoDB
        - Effect: Allow
          Action:
            - dynamodb:GetItem
            - dynamodb:PutItem
            - dynamodb:UpdateItem
            - dynamodb:DeleteItem
            - dynamodb:Query
          Resource:
            - !GetAtt UsersTable.Arn

functions:
  # HTTP endpoint: GET /users/:id
  getUser:
    handler: src/handlers/users.getUser    # exports.handler in src/handlers/users.js
    events:
      - httpApi:
          path: /users/{id}
          method: GET

  # HTTP endpoint: POST /users
  createUser:
    handler: src/handlers/users.createUser
    events:
      - httpApi:
          path: /users
          method: POST

  # Scheduled function: run every day at midnight
  dailyCleanup:
    handler: src/handlers/cleanup.run
    events:
      - schedule: cron(0 0 * * ? *)

  # S3 trigger: process images on upload
  processImage:
    handler: src/handlers/images.process
    events:
      - s3:
          bucket: my-image-bucket
          event: s3:ObjectCreated:*
          rules:
            - prefix: uploads/         # only trigger for keys starting with 'uploads/'
            - suffix: .jpg

resources:
  Resources:
    UsersTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ${self:provider.environment.DYNAMODB_TABLE}
        BillingMode: PAY_PER_REQUEST   # on-demand pricing — no capacity planning
        AttributeDefinitions:
          - AttributeName: pk
            AttributeType: S
        KeySchema:
          - AttributeName: pk
            KeyType: HASH
```

```bash
# Deploy to AWS
npx serverless deploy --stage production

# Deploy a single function (faster for quick updates)
npx serverless deploy function --function getUser --stage production

# View function logs (streams CloudWatch Logs)
npx serverless logs --function getUser --stage production --tail

# Remove all deployed resources
npx serverless remove --stage production
```

---

## API Gateway

```
API Gateway is a fully managed HTTP API frontend.
It handles: routing, authentication, rate limiting, CORS, and caching.

Types:
  REST API  = full-featured, more config, higher cost
  HTTP API  = lightweight, faster, cheaper (~70% less than REST)
  WebSocket = real-time bidirectional communication
```

```yaml
# HTTP API in Serverless Framework (see functions above — httpApi trigger)
# More explicit API Gateway config example:

functions:
  api:
    handler: src/app.handler    # Express app wrapped with serverless-http
    events:
      - httpApi:
          path: /{proxy+}       # catch-all proxy: route all paths to Express
          method: ANY
```

```javascript
// Wrap an existing Express app for Lambda — no rewrite needed!
const serverless = require('serverless-http');
const express = require('express');
const app = express();

app.use(express.json());

app.get('/users/:id', async (req, res) => {
  const user = await getUser(req.params.id);
  res.json(user);
});

// serverless-http translates API Gateway events ↔ Express req/res
module.exports.handler = serverless(app);
```

---

## Lambda Best Practices

```javascript
// 1. Initialise clients OUTSIDE the handler (reused across warm invocations)
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

// Client created ONCE at module load — reused for thousands of invocations
const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION }),
);

exports.handler = async (event) => {
  // dynamo is reused here — no new client on every call
  const result = await dynamo.send(/* ... */);
  return result;
};

// 2. Keep deployment packages small — smaller zip = faster cold start
// Use Lambda Layers for large dependencies (AWS SDK is pre-installed)

// 3. Set timeouts conservatively — default is 3s, max is 15 min
// A timeout that's too high wastes money on stuck invocations

// 4. Use structured logging — easier to query in CloudWatch Insights
const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ level, msg, ...extra, ts: new Date().toISOString() }));

log('info', 'Processing request', { userId: '123', action: 'getUser' });
```

---

## Interview Questions

**Q: What is a Lambda cold start and how do you minimise it?**
> On first invocation (or after inactivity), AWS creates a new execution environment: downloads code, initialises the runtime, runs module-level code. This can take 100ms–1s. Minimise by: using smaller zip files, keeping node_modules lean (use Rollup/esbuild to bundle), using Provisioned Concurrency for latency-critical APIs, preferring Node.js/Python (faster than Java/.NET for cold starts), and initialising SDK clients outside the handler.

**Q: What is the difference between reserved and provisioned concurrency?**
> Reserved Concurrency: caps the MAXIMUM number of simultaneous Lambda invocations. Protects downstream services (e.g., a DB) from being flooded. If the limit is hit, new requests are throttled.
> Provisioned Concurrency: pre-warms N execution environments. These are always ready — no cold start. Increases cost but eliminates latency spikes for user-facing APIs.

**Q: Why initialise SDK clients outside the Lambda handler?**
> Lambda execution environments are reused across invocations (warm starts). Code outside the handler runs once per cold start, then is cached. Creating SDK clients (HTTP connection pools) inside the handler means recreating them thousands of times per second. Initialise once outside the handler — all warm invocations reuse the same client and its connection pool.

**Q: What is the difference between REST API and HTTP API in API Gateway?**
> HTTP API is the newer, simpler, cheaper option (~70% cheaper). Supports JWT authoriser, CORS, Lambda integration, and HTTP routing. REST API adds: request/response transformations, API keys, usage plans, request validation, WAF integration, caching. Use HTTP API unless you need the advanced REST API features.

**Q: How does Lambda scale?**
> Lambda scales horizontally and automatically. Each concurrent request gets its own execution environment. With default settings, AWS can scale to thousands of concurrent executions within minutes. There is an account-level concurrency limit (default 1000 per region — increase via quota request). No capacity planning needed unlike EC2.

---

<a id="aws-rds-dynamodb-cache"></a>
## 05_rds_dynamodb_cache.md — RDS — Relational Database Service

# AWS: RDS, DynamoDB, and ElastiCache

## RDS — Relational Database Service

```
RDS is a managed relational database.
AWS handles: provisioning, patching, backups, failover, and monitoring.
You handle: schema design, queries, connection pooling.

Supported engines: PostgreSQL, MySQL, MariaDB, Oracle, SQL Server, Aurora
```

---

## RDS Setup Considerations

```
Multi-AZ Deployment:
  Primary instance writes/reads in AZ-a
  Standby replica in AZ-b (synchronous replication)
  If primary fails → automatic failover to standby (~60s downtime)
  DNS name stays the same — application reconnects automatically

Read Replicas (horizontal read scaling):
  Asynchronous replication from primary to read replicas
  Up to 15 read replicas per instance
  Use for reporting, analytics — not for writes
  Can be promoted to standalone primary if needed
```

---

## Connecting to RDS from Node.js (PostgreSQL)

```javascript
// Production PostgreSQL connection with connection pooling
// NEVER hard-code credentials — use environment variables from AWS Secrets Manager
const { Pool } = require('pg');

// Connection pool is shared across all invocations in the same Node.js process.
// pg Pool manages multiple connections — reuses them instead of opening a new
// TCP + TLS + auth handshake for every query.
const pool = new Pool({
  host:     process.env.DB_HOST,       // RDS endpoint, e.g. mydb.abc123.us-east-1.rds.amazonaws.com
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,   // from AWS Secrets Manager (via env injection)
  ssl: {
    rejectUnauthorized: true,          // verify RDS TLS certificate
    ca: process.env.RDS_CA_CERT,       // AWS RDS CA bundle (downloaded from AWS)
  },
  max: 10,                             // max connections in pool
  idleTimeoutMillis: 30_000,           // close idle connections after 30s
  connectionTimeoutMillis: 5_000,      // fail fast if can't get a connection in 5s
});

// Query helper — automatically acquires and releases a connection from the pool
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);  // params array prevents SQL injection
  console.log('Query executed', { text, duration: Date.now() - start, rows: res.rowCount });
  return res;
}

// Transaction helper — wraps multiple queries in BEGIN/COMMIT/ROLLBACK
async function withTransaction(fn) {
  const client = await pool.connect();  // take one connection and hold it for the transaction
  try {
    await client.query('BEGIN');
    const result = await fn(client);   // pass the dedicated client to the caller
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');    // undo all changes if anything fails
    throw err;
  } finally {
    client.release();                  // ALWAYS return connection to pool
  }
}

// Usage example:
async function transferMoney(fromId, toId, amount) {
  return withTransaction(async (client) => {
    // Both updates in the same transaction — atomic
    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1',
      [amount, fromId]
    );
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [amount, toId]
    );
  });
}
```

---

## RDS Proxy (for Lambda + RDS)

```
Problem: Lambda can scale to thousands of concurrent executions.
Each Lambda tries to open its own DB connection.
RDS PostgreSQL supports ~100–500 connections max.
→ Lambda scales to 500 connections → DB is overwhelmed.

Solution: RDS Proxy sits between Lambda and RDS.
It maintains a SMALL pool of actual DB connections and multiplexes
thousands of Lambda connections through them (connection pooling as a service).
```

```javascript
// No code changes needed! Just point to the RDS Proxy endpoint instead of RDS directly.
// The Proxy handles connection pooling transparently.
const pool = new Pool({
  host: process.env.DB_PROXY_HOST,  // e.g., mydb.proxy-abc123.us-east-1.rds.amazonaws.com
  // ↑ This is the Proxy endpoint, not the RDS endpoint
  // Everything else is the same
});
```

---

## DynamoDB — NoSQL Key-Value + Document Store

```
DynamoDB is a fully managed, serverless NoSQL database.
No servers to manage, no capacity planning (on-demand mode).
Scales to millions of requests per second.
Single-digit millisecond latency at any scale.

Data model:
  Table → contains Items (like rows but schema-less)
  Item  → a collection of Attributes (key-value pairs)
  Primary Key:
    - Partition Key (PK) alone — simple table (e.g., userId)
    - Partition Key + Sort Key — composite key (e.g., userId + createdAt)
```

---

## DynamoDB Access Patterns

```javascript
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand,
        UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

// DocumentClient handles marshalling/unmarshalling DynamoDB types automatically
const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION }),
);

const TABLE = process.env.DYNAMODB_TABLE;

// ── Get a single item by primary key ──────────────────────────────────────
async function getUser(userId) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLE,
    Key: { pk: `USER#${userId}` },   // Prefixing keys avoids collisions with other entity types
    ConsistentRead: true,            // strongly consistent read (higher cost; default is eventual)
  }));
  return result.Item;
}

// ── Put (create/replace) an item ──────────────────────────────────────────
async function createUser(user) {
  await dynamo.send(new PutCommand({
    TableName: TABLE,
    Item: {
      pk: `USER#${user.id}`,         // partition key
      sk: 'PROFILE',                  // sort key (for single-table design)
      ...user,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    ConditionExpression: 'attribute_not_exists(pk)',  // fail if item already exists (prevents overwrite)
  }));
}

// ── Update specific attributes (not a full replace) ───────────────────────
async function updateUserEmail(userId, newEmail) {
  // UpdateExpression: only touch the specified attributes
  // ExpressionAttributeNames: needed for reserved words (name, status, etc.)
  await dynamo.send(new UpdateCommand({
    TableName: TABLE,
    Key: { pk: `USER#${userId}`, sk: 'PROFILE' },
    UpdateExpression: 'SET #email = :email, updatedAt = :now',
    ExpressionAttributeNames: { '#email': 'email' },   // 'email' is not reserved but good practice
    ExpressionAttributeValues: {
      ':email': newEmail,
      ':now': new Date().toISOString(),
    },
    ConditionExpression: 'attribute_exists(pk)',         // fail if item doesn't exist
  }));
}

// ── Query all orders for a user (partition key = USER#123, SK begins with ORDER#) ──
async function getUserOrders(userId) {
  const result = await dynamo.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':skPrefix': 'ORDER#',
    },
    ScanIndexForward: false,       // false = descending sort key order (newest first)
    Limit: 20,                     // max items to return per page
  }));
  return result.Items;
}
```

---

## DynamoDB Single-Table Design

```javascript
// Single-table design: store ALL entity types in ONE table using PK/SK conventions.
// Access patterns are designed up front — model data around queries, not entities.

// Example table layout:
//
// PK             | SK               | Data
// ─────────────────────────────────────────────────────────────────────
// USER#u1        | PROFILE          | { name, email, createdAt }
// USER#u1        | ORDER#o1         | { total, status, createdAt }
// USER#u1        | ORDER#o2         | { total, status, createdAt }
// PRODUCT#p1     | DETAILS          | { name, price, stock }
// ORDER#o1       | ITEM#i1          | { productId, qty, price }
//
// Access patterns:
//   Get user profile:   PK=USER#u1,  SK=PROFILE
//   Get all user orders: PK=USER#u1, SK begins_with ORDER#
//   Get product:        PK=PRODUCT#p1, SK=DETAILS
```

---

## ElastiCache — Managed Redis / Memcached

```
ElastiCache is managed Redis or Memcached.
Typical uses:
  - Session storage (JWT → session ID mapping)
  - Query result caching (expensive DB query cached for 60 seconds)
  - Rate limiting (sliding window counters)
  - Pub/Sub messaging
```

```javascript
const Redis = require('ioredis');

// Connect to ElastiCache Redis cluster endpoint
// Production: use Cluster Mode for horizontal sharding
const redis = new Redis.Cluster(
  [{ host: process.env.CACHE_HOST, port: 6379 }],
  {
    redisOptions: {
      tls: {},               // ElastiCache in-transit encryption
      enableOfflineQueue: false,
    },
    enableReadyCheck: true,
  }
);

// ── Cache-aside pattern ──────────────────────────────────────────────────
// 1. Check cache first
// 2. On miss: query DB, store in cache, return
// 3. On hit: return cached data immediately
async function getUserCached(userId) {
  const cacheKey = `user:${userId}`;

  // Step 1: check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);    // cache HIT — DB not touched
  }

  // Step 2: cache miss — fetch from DB
  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

  // Step 3: store in cache with a TTL (Time To Live) of 5 minutes
  // TTL prevents the cache from serving stale data forever
  await redis.set(cacheKey, JSON.stringify(user), 'EX', 300);   // EX = seconds

  return user;
}

// ── Cache invalidation ────────────────────────────────────────────────────
async function updateUser(userId, updates) {
  await db.query('UPDATE users SET ... WHERE id = $1', [userId]);
  // Remove the cached entry so the next read fetches fresh data
  await redis.del(`user:${userId}`);
}
```

---

## Interview Questions

**Q: When would you choose DynamoDB over PostgreSQL (RDS)?**
> DynamoDB: unlimited scale with consistent latency, fully serverless, great for high-throughput key-value access (user sessions, product lookups, IoT events). No joins — all access patterns must be known upfront and modelled via keys and indexes.
> PostgreSQL: complex queries with joins, ad-hoc queries, strong ACID transactions, relational data model. Better for applications where data relationships are complex or evolving.

**Q: What is DynamoDB single-table design?**
> Storing multiple entity types (Users, Orders, Products) in ONE DynamoDB table using structured PK/SK conventions. Enables fetching multiple entity types in a SINGLE query (e.g., all orders for a user). Avoids N+1 issues. Requires designing access patterns upfront. Complex to understand initially but critical for DynamoDB performance.

**Q: What is the cache-aside pattern?**
> Application checks cache first. On a miss, queries the database, stores the result in cache with a TTL, returns it. On subsequent requests, cache serves the data directly. Also called "lazy loading". When data changes, explicitly delete or update the cache entry. Simple to implement; data may be stale until TTL expires.

**Q: What is RDS Multi-AZ and how is it different from a Read Replica?**
> Multi-AZ: synchronous standby replica in another AZ for high availability. Both primary and standby always have the same data. If primary fails, automatic failover within ~60s. Cannot serve read traffic.
> Read Replica: asynchronous copy for read scaling. Can serve SELECT queries. Used for read-heavy workloads like reporting. Not a failover target by default.

**Q: Why do you need RDS Proxy for Lambda?**
> Lambda scales to thousands of concurrent executions — each opening a DB connection. RDS/Aurora have a hard connection limit (dozens to hundreds). RDS Proxy maintains a fixed pool of actual DB connections and multiplexes thousands of Lambda connections through them, preventing connection exhaustion without any code changes.

---

<a id="aws-sqs-sns-eventbridge"></a>
## 06_sqs_sns_eventbridge.md — Why Event-Driven?

# AWS: SQS, SNS, and EventBridge — Event-Driven Architecture

## Why Event-Driven?

```
Instead of Service A calling Service B directly (synchronous coupling):

  [A] ──HTTP──> [B]     Problem: if B is slow/down, A is blocked too

Event-driven: A publishes an event; B processes it when ready (decoupled)

  [A] ──event──> [Queue/Topic] ──event──> [B]
           ↑                         ↑
     A doesn't know/care about B    B processes at its own pace
```

---

## SQS — Simple Queue Service

```
SQS is a fully managed message queue.
Producers send messages → SQS holds them → Consumers poll and process.

Standard Queue:
  - Nearly unlimited throughput
  - At-least-once delivery (same message might be received twice → design idempotent consumers)
  - Best-effort ordering

FIFO Queue:
  - Exactly-once processing
  - Strict first-in-first-out order (within a message group)
  - Up to 3,000 messages/sec (or 300 per API call)
```

---

## SQS — Node.js SDK Operations

```javascript
const { SQSClient, SendMessageCommand, ReceiveMessageCommand,
        DeleteMessageCommand, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');

const sqs = new SQSClient({ region: process.env.AWS_REGION });
const QUEUE_URL = process.env.SQS_QUEUE_URL;

// ── Send a message to the queue ───────────────────────────────────────────
async function sendOrderEvent(order) {
  const response = await sqs.send(new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify({       // always serialize to string
      type: 'ORDER_PLACED',
      orderId: order.id,
      userId: order.userId,
      total: order.total,
      timestamp: new Date().toISOString(),
    }),
    // MessageGroupId is required for FIFO queues — messages with the same group
    // are delivered in order and are not processed in parallel
    // MessageGroupId: `order-${order.userId}`,

    // MessageDeduplicationId prevents duplicates in FIFO queues (within 5 min window)
    // MessageDeduplicationId: order.id,
  }));
  console.log('Message queued:', response.MessageId);
  return response.MessageId;
}

// ── Receive and process messages from the queue ───────────────────────────
async function processMesages() {
  while (true) {
    const response = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 10,         // process up to 10 at once (SQS max)
      WaitTimeSeconds: 20,             // long polling — wait up to 20s for messages
      // Long polling reduces empty responses and saves API call costs compared to
      // short polling (which returns immediately whether or not there are messages)
      VisibilityTimeout: 60,           // message hidden from other consumers for 60s while processing
      // If processing takes > 60s and we don't delete the message, it becomes visible again
      // → another consumer picks it up → duplicate processing risk (design idempotently!)
    }));

    if (!response.Messages?.length) continue;  // no messages, loop again

    await Promise.all(response.Messages.map(processOneMessage));
  }
}

async function processOneMessage(message) {
  try {
    const body = JSON.parse(message.Body);
    console.log('Processing:', body.type, body.orderId);

    // ── IDEMPOTENCY CHECK ──────────────────────────────────────────────
    // SQS delivers "at-least-once" — same message can arrive twice on retries.
    // Before processing, check if we've already handled this event.
    const alreadyProcessed = await db.query(
      'SELECT 1 FROM processed_events WHERE message_id = $1', [message.MessageId]
    );
    if (alreadyProcessed.rowCount > 0) {
      console.log('Duplicate message, skipping:', message.MessageId);
      await deleteMessage(message.ReceiptHandle);   // still delete so it's not re-delivered
      return;
    }

    // Process the actual business logic
    await fulfillOrder(body.orderId);

    // Record that we processed this message
    await db.query(
      'INSERT INTO processed_events(message_id, processed_at) VALUES($1, NOW())',
      [message.MessageId]
    );

    // ── DELETE the message from queue after successful processing ──────
    // If we don't delete, the VisibilityTimeout expires and it re-appears
    await deleteMessage(message.ReceiptHandle);
  } catch (err) {
    // Don't delete the message — SQS will make it visible again after VisibilityTimeout
    // After maxReceiveCount retries, SQS moves it to the Dead Letter Queue (DLQ)
    console.error('Failed to process message, will be retried:', err);
  }
}

async function deleteMessage(receiptHandle) {
  await sqs.send(new DeleteMessageCommand({
    QueueUrl: QUEUE_URL,
    ReceiptHandle: receiptHandle,       // unique handle from ReceiveMessage call
  }));
}
```

---

## Dead Letter Queue (DLQ)

```
A DLQ is a separate SQS queue that receives messages that could NOT be
processed after maxReceiveCount retries.

[Main Queue] ──(after 3 failures)──> [DLQ]
                                          ↑
                              CloudWatch alarm triggers alert
                              Messages inspected to find bugs

Setup (Terraform):
```

```hcl
resource "aws_sqs_queue" "orders_dlq" {
  name                        = "orders-dlq"
  message_retention_seconds   = 1209600  # 14 days to investigate failed messages
}

resource "aws_sqs_queue" "orders" {
  name                        = "orders"
  visibility_timeout_seconds  = 60
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.orders_dlq.arn
    maxReceiveCount     = 3           # after 3 failed attempts, move to DLQ
  })
}
```

---

## SNS — Simple Notification Service

```
SNS is a pub/sub messaging service.
Publisher sends ONE message to a Topic.
Topic fans out to ALL subscribers simultaneously.

Fan-out pattern:
  Publisher ──> [SNS Topic]
                     ├──> SQS Queue A (processes orders for fulfillment)
                     ├──> SQS Queue B (sends email notification)
                     ├──> Lambda     (logs analytics)
                     └──> HTTP       (webhook to 3rd party)

Each subscriber independently receives the same event.
```

```javascript
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const sns = new SNSClient({ region: process.env.AWS_REGION });

// ── Publish an event to an SNS Topic ─────────────────────────────────────
async function publishOrderPlaced(order) {
  const response = await sns.send(new PublishCommand({
    TopicArn: process.env.SNS_ORDERS_TOPIC_ARN,
    Message: JSON.stringify({
      type: 'ORDER_PLACED',
      orderId: order.id,
      userId: order.userId,
      total: order.total,
    }),
    Subject: 'New Order Placed',           // used by email subscriptions as email subject
    MessageAttributes: {
      // Filter policies on SQS subscriptions can filter by these attributes
      // e.g., only route "ORDER_PLACED" events to the fulfillment queue
      eventType: {
        DataType: 'String',
        StringValue: 'ORDER_PLACED',
      },
    },
  }));
  return response.MessageId;
}
```

---

## EventBridge — Event Bus & Scheduler

```
EventBridge is a serverless event router.
Events from AWS services (EC2 state change, S3 put, CodePipeline state)
and your own applications flow into an event bus.
Rules match events by pattern and route to targets (Lambda, SQS, Step Functions).

Key choice: SQS vs SNS vs EventBridge:
  SQS  → queue for background work; consumers pull; one-to-one (or competing consumers)
  SNS  → push notification; fan-out (one-to-many); real-time subscribers
  EventBridge → rich routing rules; AWS service events; event replay; cross-account/region
```

```javascript
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

const eb = new EventBridgeClient({ region: process.env.AWS_REGION });

// ── Publish a custom event to your event bus ──────────────────────────────
async function publishEvent(detailType, detail) {
  await eb.send(new PutEventsCommand({
    Entries: [{
      EventBusName: process.env.EVENT_BUS_NAME,   // custom event bus name
      Source: 'com.myapp.orders',                  // identifies the publishing application
      DetailType: detailType,                       // used in event rules (e.g., 'OrderPlaced')
      Detail: JSON.stringify(detail),               // event payload (must be a JSON string)
      Time: new Date(),
    }],
  }));
}

// Usage:
// await publishEvent('OrderPlaced', { orderId: '123', total: 99.99 });
```

```json
// EventBridge Rule (Terraform or console):
// Routes "OrderPlaced" events from "com.myapp.orders" to a Lambda function

{
  "source": ["com.myapp.orders"],
  "detail-type": ["OrderPlaced"],
  "detail": {
    "total": [{ "numeric": [">=", 100] }]
  }
}
// The rule above routes only orders with total >= $100 to "high-value-order-handler" Lambda
```

---

## SQS Lambda Trigger (Event Source Mapping)

```javascript
// When you add SQS as a Lambda trigger, Lambda polls the queue automatically —
// no need to write polling code. Lambda receives a batch of messages as an event.

// Lambda handler for SQS trigger
exports.handler = async (event) => {
  const batchItemFailures = [];  // track which messages failed

  for (const record of event.Records) {
    // Each record is one SQS message
    const body = JSON.parse(record.body);
    try {
      await processOrder(body);
      // Successfully processed — Lambda will delete this message from queue
    } catch (err) {
      console.error('Failed:', record.messageId, err);
      // Report this message as failed — don't delete from queue
      // Only this message goes back to queue / DLQ — others still succeed
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  // Returning batchItemFailures enables "partial batch response"
  // Without this, a single failure would reprocess ALL messages in the batch
  return { batchItemFailures };
};
```

---

## Interview Questions

**Q: What is the difference between SQS, SNS, and EventBridge?**
> SQS: queue — messages wait for a consumer to pull and process them. One message goes to one consumer. Good for background jobs, work queues, rate limiting.
> SNS: topic — publisher sends once, all subscribers receive simultaneously (fan-out). Good for notifications that go to multiple systems at once.
> EventBridge: event router — routes events using rich pattern matching rules. Receives events from AWS services, your app, and SaaS apps. Best for event-driven microservice orchestration.

**Q: What is a Dead Letter Queue and why do you need one?**
> A DLQ receives messages that repeatedly failed processing (after maxReceiveCount retries). Without a DLQ, failed messages loop forever wasting compute and preventing other messages from being processed. DLQ holds them safely for investigation. You set up a CloudWatch alarm on DLQ message count to alert the team when processing failures occur.

**Q: What is SQS long polling?**
> WaitTimeSeconds between 1-20 tells SQS to wait up to 20 seconds for a message before returning an empty response. Without long polling (short polling), if there are no messages SQS responds immediately with nothing — your code keeps polling in a tight loop, wasting money on API calls. Long polling reduces costs by up to 95% for low-traffic queues.

**Q: How do you ensure idempotency in an SQS consumer?**
> SQS guarantees at-least-once delivery — the same message can arrive more than once (during retries or network issues). To handle duplicates: use the SQS MessageId as a deduplication key in a database table. Before processing, check if that MessageId was already processed. If yes, skip business logic but still delete the message. This makes processing idempotent — processing the same message twice has the same result as once.

**Q: When would you use SNS → SQS fan-out vs just SNS?**
> SNS directly invokes subscribers synchronously with retries for short duration. If you need durability (messages persist even if Lambda is down), rate control (process at your own pace), or competing consumers (multiple workers processing the same messages), add SQS between SNS and the consumer. SNS → SQS fan-out = best of both: easy fan-out + durable queued processing.

---

<a id="aws-ecs-eks-ecr"></a>
## 07_ecs_eks_ecr.md — Container Services — Choosing the Right One

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

---

<a id="aws-cicd-interview-qa"></a>
## 08_cicd_interview_qa.md — CI/CD Concepts

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


---

<a id="aws-scenarios"></a>
## Scenario-Based Interview Questions

---

### Scenario 1: Lambda Cold Starts Causing p99 Latency of 3+ Seconds

**Situation:** Your API backend uses Lambda functions. Most requests are fast (p50 = 80 ms) but p99 is 3.5 seconds. Users sporadically experience long delays.

**Question:** What are the causes and how do you fix them?

**Answer:**
- **Cold start** occurs when Lambda needs to initialise a new execution environment (download code, start runtime, run init code).
- Causes of slow cold starts: large bundle size, heavy initialisation (DB connections, loading config), VPC networking, heavy runtimes (Java, .NET).
- **Fixes**:
  1. **Provisioned Concurrency** — pre-warm N instances, eliminating cold starts for those slots.
  2. **Lambda SnapStart** (Java) — snapshot the initialised execution environment.
  3. Reduce bundle size with tree-shaking / esbuild.
  4. Move expensive init (DB connections, secret loading) **outside the handler** — it runs once per container, not per invocation.
  5. Avoid VPC attachment unless you need private resources — VPC ENI provisioning adds 1–2 seconds.
  6. Use **Node.js or Python** runtimes for lowest cold start overhead.

---

### Scenario 2: S3 Bucket Exposed Publicly — Security Incident

**Situation:** Monitoring alerts that a new S3 bucket has public read enabled. It contains customer invoices in PDF format.

**Question:** Walk through your incident response.

**Answer:**
1. Immediately block public access: `aws s3api put-public-access-block --bucket $BUCKET --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"`.
2. Enable **S3 Block Public Access at the account level** so no future bucket can be made public.
3. Check **CloudTrail** for any downloads of the exposed objects (filter `GetObject` events during exposure window).
4. Notify affected customers per your breach notification obligations.
5. Audit all buckets: `aws s3api list-buckets | xargs -I{} aws s3api get-bucket-acl --bucket {}`.
6. Long-term: use **AWS Config rule** `s3-bucket-public-read-prohibited` to auto-detect and alert.

---

### Scenario 3: RDS Multi-AZ Failover — Application Reconnects Fail

**Situation:** A Multi-AZ RDS instance fails over to the standby. Your application keeps getting "connection refused" for 90 seconds even though RDS says the failover took 60 seconds.

**Question:** Why and how do you fix it?

**Answer:**
- DNS TTL: The RDS endpoint DNS is updated on failover but your application or connection pool **caches the old IP**.
- Fix:
  1. Set Java/Node DNS TTL to 5–30 seconds (`networkaddress.cache.ttl` for JVM; `dns.lookup` for Node).
  2. Configure your connection pool to **retry on connection failure** with exponential back-off.
  3. Use **RDS Proxy** in front of RDS — it maintains a warm connection pool and handles failovers transparently, giving your app a stable endpoint.
- Also ensure `jdbc:mysql://...?useSSL=true&failOverReadOnly=false&autoReconnect=true` or equivalent.

---

### Scenario 4: DynamoDB — Hot Partition Causing Throttling

**Situation:** A DynamoDB table for a chat app uses `conversationId` as the partition key. During a viral live chat event, millions of reads/writes hit one conversation, causing throttling.

**Question:** How do you address hot partitions?

**Answer:**
- **Write sharding**: append a random suffix (0–N) to the partition key for writes (`conversationId#3`), then scatter-gather reads across all shards.
- Use **DAX (DynamoDB Accelerator)** to cache hot reads in microseconds.
- Switch to **On-demand capacity** mode — it automatically scales for unexpected spikes (no throttling, pay-per-request).
- For viral events, pre-scale **provisioned capacity** ahead of time using Application Auto Scaling.
- Design for distribution: use `userId + timestamp` as the key for chat messages so load spreads naturally.

---

### Scenario 5: SQS Message Processed Multiple Times — Duplicate Charges

**Situation:** Your order fulfilment Lambda processes an SQS message but fails after the charge but before deleting the message. SQS re-delivers it, the customer is charged twice.

**Question:** How do you prevent this?

**Answer:**
- **Idempotency key pattern**: before processing, check if `orderId` has already been processed (store in DynamoDB/Redis with a TTL).
- If already processed: skip the charge, acknowledge/delete the message.
- This is the **at-least-once delivery + idempotent consumer** pattern.

```javascript
async function handler(event) {
  for (const record of event.Records) {
    const { orderId } = JSON.parse(record.body);
    const alreadyProcessed = await db.get(`processed:${orderId}`);
    if (alreadyProcessed) continue;
    await chargeCustomer(orderId);
    await db.set(`processed:${orderId}`, '1', { EX: 86400 }); // 24h TTL
    // SQS auto-deletes on Lambda success, or call deleteMessage explicitly
  }
}
```

- Use **FIFO queues** with a `MessageDeduplicationId` to get exactly-once processing at the queue level.

---

### Scenario 6: API Gateway Timeout — Lambda Exceeds 29 Seconds

**Situation:** A data-export Lambda takes up to 120 seconds for large exports. API Gateway has a hard-coded 29-second timeout. Users get 504 errors.

**Question:** How do you redesign this?

**Answer:**
- API Gateway **cannot exceed 29 seconds** — this is a hard limit.
- Redesign to **async**: 
  1. POST to the API to **start the export** — Lambda kicks off an async job and returns immediately with a `jobId` (202 Accepted).
  2. Client polls `GET /export/{jobId}/status` or uses a WebSocket/SSE connection.
  3. The export Lambda writes the file to S3 and updates job status in DynamoDB.
  4. Return a **pre-signed S3 URL** when the job is complete.
- Alternative: use **Step Functions** for long-running workflows with built-in state management.

---

### Scenario 7: ECS Task Cannot Access S3 — Permissions Error

**Situation:** Your ECS task running a data-processing service gets `AccessDenied` when calling `s3:GetObject`. The developers swear they attached the right policy.

**Question:** How do you debug IAM issues on ECS?

**Answer:**
1. Check the **Task IAM Role** (not the EC2 instance role): `aws ecs describe-task-definition --task-definition my-task`.
2. The task execution role and the task role are different — the task role is what the application code uses.
3. Test the exact API call: `aws sts assume-role --role-arn <task-role-arn>` and then run the S3 call as that role.
4. Use **IAM Policy Simulator** to test the role's permissions.
5. Check **S3 Bucket Policy** — even if the role has `s3:GetObject`, the bucket policy might explicitly `Deny` the role's account.
6. Check for **Permission Boundaries** on the task role that might restrict effective permissions.

---

### Scenario 8: Cost Optimisation — EC2 Budget 40% Over Forecast

**Situation:** Your AWS bill shows EC2 costs 40% higher than last month. No new services were launched.

**Question:** How do you investigate and reduce costs?

**Answer:**
1. **AWS Cost Explorer** → Group by usage type → identify instance type / region driving the spike.
2. Check for unattached EBS volumes (`aws ec2 describe-volumes --filters Name=status,Values=available`).
3. Check for old snapshots: `aws ec2 describe-snapshots --owner-ids self`.
4. Look for **NAT Gateway data processing charges** (often a surprise).
5. **Rightsizing**: AWS Compute Optimizer recommends instance type adjustments.
6. **Savings Plans / Reserved Instances**: for stable workloads, commit for 1–3 years for up to 72% savings.
7. **Spot Instances** for batch/stateless workloads — up to 90% cheaper.
8. Set up **AWS Budgets** alerts at 80%/100% of expected spend.
