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
