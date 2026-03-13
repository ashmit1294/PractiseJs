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
