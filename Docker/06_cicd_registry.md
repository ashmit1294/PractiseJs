# Docker: CI/CD and Registry

## Registry Overview

| Registry | Free Tier | Auth | Best For |
|----------|-----------|------|----------|
| Docker Hub | 1 private repo | Docker login | Public OSS, personal |
| GitHub Container Registry (GHCR) | ✅ public free | GITHUB_TOKEN | GitHub-hosted projects |
| AWS ECR | Pay per GB | AWS IAM | ECS/EKS workloads |
| Google Artifact Registry | Pay per GB | gcloud auth | GKE workloads |
| Azure Container Registry | Pay per tier | Azure AD | AKS workloads |
| Self-hosted (Harbor) | Free | LDAP/OIDC | On-premise, compliance |

---

## Q1. Basic registry push/pull

```bash
# Docker Hub
docker login
docker build -t username/myapp:1.0.0 .
docker push username/myapp:1.0.0
docker pull username/myapp:1.0.0

# Tag with multiple tags
docker tag username/myapp:1.0.0 username/myapp:latest
docker push username/myapp:latest

# GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
docker build -t ghcr.io/username/myapp:1.0.0 .
docker push ghcr.io/username/myapp:1.0.0

# AWS ECR
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

REPO=123456789.dkr.ecr.us-east-1.amazonaws.com/myapp
docker build -t $REPO:1.0.0 .
docker push $REPO:1.0.0
```

---

## Q2. Semantic versioning tagging strategy

```bash
# Good tagging strategy
VERSION=1.2.3
GIT_SHA=$(git rev-parse --short HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)

docker build \
  -t myapp:${VERSION} \
  -t myapp:${VERSION%.*} \        # 1.2 (minor)
  -t myapp:${VERSION%%.*} \       # 1 (major)
  -t myapp:${GIT_SHA} \           # immutable sha tag
  -t myapp:latest \
  .

# In CI (GitHub Actions)
# ${{ github.sha }} — full commit SHA
# ${{ github.ref_name }} — branch or tag name
# ${{ github.run_number }} — auto-incrementing run number
```

---

## Q3. Multi-platform builds with buildx

```bash
# Multi-platform builds (amd64 + arm64) using Docker buildx + QEMU
# Needed for: M-chip Macs, AWS Graviton, Raspberry Pi

# Set up builder (one-time)
docker buildx create --name multiplatform --use
docker buildx inspect --bootstrap

# Build and push to registry for both platforms in one command
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag ghcr.io/username/myapp:1.0.0 \
  --push \
  .

# Inspect manifest (see all platforms)
docker buildx imagetools inspect ghcr.io/username/myapp:1.0.0
```

```dockerfile
# Detect architecture in Dockerfile if needed
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder
ARG TARGETPLATFORM
ARG BUILDPLATFORM
RUN echo "Building on $BUILDPLATFORM for $TARGETPLATFORM"
```

---

## Q4. Layer caching in CI

```bash
# Without caching: every CI run rebuilds from scratch (~3 min)
# With caching: only changed layers rebuild (~30 sec)

# Strategy 1: registry cache
docker buildx build \
  --cache-from type=registry,ref=ghcr.io/username/myapp:cache \
  --cache-to   type=registry,ref=ghcr.io/username/myapp:cache,mode=max \
  --tag ghcr.io/username/myapp:latest \
  --push .

# Strategy 2: inline cache (simpler, stores in image itself)
docker buildx build \
  --cache-from ghcr.io/username/myapp:latest \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  --tag ghcr.io/username/myapp:latest \
  --push .

# Strategy 3: GitHub Actions cache (fastest for GHA)
# --cache-from type=gha
# --cache-to   type=gha,mode=max
```

---

## Q5. GitHub Actions complete workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
    tags: ["v*.*.*"]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm test

  build-push:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write  # needed to push to GHCR

    steps:
      - uses: actions/checkout@v4

      # Set up QEMU for multi-platform
      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      # Set up buildx with cache support
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}  # auto-provided

      # Generate tags: branch name, PR, semver on tag push
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # Scan built image for vulnerabilities
      - name: Scan image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          format: sarif
          output: trivy-results.sarif
          severity: CRITICAL
          exit-code: 1

      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: trivy-results.sarif
```

---

## Q6. Docker in Docker (DinD) vs bind-mounting socket

```yaml
# Pattern 1: Docker socket bind-mount (DANGEROUS — see security notes)
# The CI runner must have Docker installed
# SECURITY RISK: container has full Docker daemon access
services:
  runner:
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

# Pattern 2: Docker-in-Docker (DinD) sidecar
# Each job gets isolated Docker daemon
# Used by: GitLab CI dind, Jenkins Kaniko

# Pattern 3: Rootless Docker / Kaniko (Recommended for K8s CI)
# kaniko builds images without Docker daemon inside K8s pods
# No privileged containers needed
```

---

## Q7. Image signing with cosign

```bash
# Sign with GitHub OIDC (keyless signing)
cosign sign --oidc-issuer https://token.actions.githubusercontent.com \
  ghcr.io/username/myapp@sha256:abc123...

# Verify signature
cosign verify \
  --certificate-identity "https://github.com/username/myapp/.github/workflows/ci.yml@refs/heads/main" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  ghcr.io/username/myapp:latest

# Generate SBOM (Software Bill of Materials)
syft ghcr.io/username/myapp:latest -o cyclonedx-json > sbom.json
cosign attach sbom --sbom sbom.json ghcr.io/username/myapp:latest
```

---

## Interview Questions

**Q: What is multi-platform build and when is it needed?**
> A multi-platform build produces a single image manifest that works on multiple CPU architectures (amd64, arm64). Needed when: deploying to AWS Graviton instances, Apple Silicon Macs, or Raspberry Pi. Use `docker buildx build --platform linux/amd64,linux/arm64`.

**Q: What is cache-from/cache-to and why does it matter in CI?**
> CI runners are typically ephemeral (fresh VM per job). Without cache, every run rebuilds all layers. `--cache-from` restores previously built layers from a registry or GitHub Actions cache. `--cache-to` saves them. `mode=max` stores all intermediate layers, `mode=min` stores only final image layers.

**Q: What is the difference between GHCR, ECR, and Docker Hub?**
> GHCR is tightly integrated with GitHub Actions (GITHUB_TOKEN auth, free for public repos). ECR is managed by AWS IAM, best for ECS/EKS. Docker Hub requires separate credentials and rate-limits anonymous pulls (100 pulls/6h). Use the registry that matches your cloud provider for least friction.

**Q: How do you avoid hard-coding the registry password in GitHub Actions?**
> Use `secrets.GITHUB_TOKEN` for GHCR (auto-provided, no setup needed). For ECR, use `aws-actions/configure-aws-credentials` with OIDC federation — no long-lived AWS credentials stored as secrets.

**Q: What is cosign/Sigstore and why does it matter?**
> cosign allows cryptographic signing of container images in the OCI registry. Sigstore provides keyless signing using OIDC tokens (GitHub Actions identity). Consumers can verify that an image was built by a specific CI workflow — protecting against supply chain attacks.
