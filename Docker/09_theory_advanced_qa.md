# DOCKER — ADVANCED THEORY Q&A
> **Level:** Advanced | **For:** 7+ years experience  
> Companion to `08_interview_qa.md` — covers internals, production patterns, and edge cases

---

## SECTION 1: BASIC

### Q1 [BASIC]: What is the difference between a Docker image and a container?
**A:** An image is a **read-only, layered filesystem snapshot** — a blueprint.  
A container is a **running instance of an image** — a process with its own isolated namespace.  
Multiple containers can run from the same image simultaneously without interfering.

```bash
# Image: just data on disk
docker images

# Container: running process + copy-on-write layer on top of image
docker run -d nginx          # creates container, starts process
docker ps                    # shows running containers

# Image layers are SHARED between containers (read-only base = no duplication)
docker history nginx         # see all layers of an image
docker inspect nginx --format='{{.RootFS.Layers}}'  # SHA256 of each layer
```

**Mental model:**
```
Image (read-only layers):
  ┌────────────────────────────────┐  ← Layer 4: COPY app/ /app      (your code)
  ├────────────────────────────────┤  ← Layer 3: RUN npm install       (node_modules)
  ├────────────────────────────────┤  ← Layer 2: RUN apt-get install   (system deps)
  └────────────────────────────────┘  ← Layer 1: FROM node:20-alpine   (base OS)

Container (adds writable layer on top):
  ┌────────────────────────────────┐  ← Writable layer (copy-on-write)
  [above read-only image layers]
```

---

### Q2 [BASIC]: What is the purpose of .dockerignore?
**A:** `.dockerignore` prevents files from being sent in the **build context** (the tar archive Docker sends to the daemon before building).

Without it: `node_modules/` (500MB+), `.git/`, logs — all are sent over, making builds slow.

```dockerignore
# .dockerignore
node_modules/          # don't send — will be installed inside image
.git/                  # build history not needed inside image
*.log                  # logs not needed
.env                   # NEVER copy secrets into images
dist/                  # will be rebuilt inside
coverage/
.DS_Store
**/*.test.js
```

```bash
# Check what would be sent in build context:
docker build --no-cache -t test . 2>&1 | head -5
# "Sending build context to Docker daemon  X MB"
```

---

## SECTION 2: INTERMEDIATE

### Q3 [INTERMEDIATE]: What is OverlayFS and how do Docker image layers work?
**A:** Docker uses **OverlayFS** (overlay filesystem) on Linux to stack read-only image layers + a writable container layer into a single merged filesystem view.

```
Container view (merged):    /app/server.js  (from Layer 4)
                            /app/node_modules  (from Layer 3)
                            /usr/bin/node  (from Layer 1 base)

OverlayFS terminology:
  lowerdir  = read-only image layers (stacked)
  upperdir  = writable container layer (copy-on-write)
  workdir   = OverlayFS internal use
  merged    = what the container sees

# When a container modifies a read-only file:
# 1. File is COPIED from lowerdir to upperdir (copy-on-write)
# 2. Modification happens on the copy in upperdir
# 3. Merged view shows the upperdir copy
# Original layer is UNCHANGED → other containers still see the original
```

**Layer caching rules:**
```dockerfile
# GOOD: stable layers first, changing layers last
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./            # ← only changes when deps change
RUN npm ci                       # ← cached as long as package-lock.json unchanged
COPY . .                         # ← changes every build (code changes)
RUN npm run build

# BAD: code copy before npm install → invalidates npm cache on every code change
COPY . .                         # ← changes every commit
RUN npm ci                       # ← re-runs even if package.json unchanged
```

---

### Q4 [INTERMEDIATE]: How does multi-stage build work and what are cache mounts?
**A:** Multi-stage: use multiple `FROM` statements. Each stage builds in isolation.  
Final stage only copies **artifacts** — build tools/dependencies stay in intermediate stages.

```dockerfile
# Stage 1: build (large — has build tools, source, dev deps)
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci                          # installs ALL deps
COPY . .
RUN npm run build                   # produces /app/dist

# Stage 2: production (small — only runtime)
FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production        # only prod deps
COPY --from=builder /app/dist ./dist  # ← COPY from builder stage
EXPOSE 3000
CMD ["node", "dist/index.js"]

# Result: production image has NO build tools, NO dev deps, NO source .ts files
# Typical size reduction: 800MB → 120MB
```

**BuildKit cache mounts** — persistent cache between builds (doesn't bloat image layers):
```dockerfile
# syntax=docker/dockerfile:1.4
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \    # ← npm cache persists between builds
    npm ci
# Re-running build: npm uses disk cache → only downloads changed packages
# Unlike regular RUN: cache mount is NOT stored in the image layer

# Go / Rust / Python pip equivalent:
RUN --mount=type=cache,target=/go/pkg/mod \  # Go module cache
    go build ./...

RUN --mount=type=cache,target=/root/.cache/pip \  # pip cache
    pip install -r requirements.txt
```

---

### Q5 [INTERMEDIATE]: What is containerd and how does it relate to Docker?
**A:** The Docker stack was decomposed into independent components:

```
Docker CLI → dockerd (Docker daemon) → containerd (OCI runtime manager) → runc (OCI runtime)

containerd: manages the full container lifecycle (image pull, snapshots, container create/start/stop)
runc:       creates the actual Linux process with namespaces/cgroups (OCI runtime spec)

Why this matters:
- Kubernetes no longer uses Docker — it uses containerd directly via CRI (Container Runtime Interface)
- dockerd: adds Docker-specific features (build, swarm, volumes) on top of containerd
- Building images: docker build → BuildKit (can run standalone, without dockerd)
```

```bash
# On a Kubernetes node — containerd manages containers directly:
crictl ps              # list containers via CRI
ctr images list        # containerd CLI (low-level)

# OCI image spec: what any container runtime must be able to run
# docker images are OCI-compliant → can run with podman, containerd, etc.
```

---

## SECTION 3: ADVANCED

### Q6 [ADVANCED]: How do you build multi-platform images with buildx?
**A:** `docker buildx` uses BuildKit under the hood and can produce images for multiple CPU architectures (AMD64, ARM64, ARMv7) in a single build.

```bash
# Create and use a multi-platform builder
docker buildx create --name multibuilder --driver docker-container --use
docker buildx inspect --bootstrap

# Build for multiple platforms simultaneously
docker buildx build \
  --platform linux/amd64,linux/arm64,linux/arm/v7 \
  -t myrepo/myapp:latest \
  --push \      # ← must push to registry (not local daemon) for multi-platform
  .

# Result: a manifest list in the registry
# docker pull myrepo/myapp → automatically pulls correct arch for current machine

# Check manifest:
docker buildx imagetools inspect myrepo/myapp:latest
```

**QEMU for cross-compilation:**
```bash
# Enable QEMU binfmt (already done on Docker Desktop)
docker run --privileged --rm tonistiigi/binfmt --install all

# Build ARM64 image on AMD64 machine (transpilers/emulation)
docker buildx build --platform linux/arm64 -t myapp:arm64 .
```

---

### Q7 [ADVANCED]: How do you implement rootless Docker and why does it matter for security?
**A:** Default Docker: daemon runs as **root** on the host. Container escape → root on host.  
Rootless mode: Docker daemon runs as an **unprivileged user** — container escape gets only user-level access.

```bash
# Install rootless Docker (Linux):
dockerd-rootless-setuptool.sh install

# Start rootless service:
systemctl --user start docker

# Verify:
docker info | grep "rootless"

# Key differences in rootless mode:
# - Uses user namespaces (user ID mapping: container root=host user 1000)
# - /var/lib/docker → ~/.local/share/docker
# - Cannot bind to ports < 1024 without additional config
# - Some features unavailable: --privileged is still risky, block devices, etc.

# Alternative: USER directive in Dockerfile (don't run app as root inside container)
```

```dockerfile
# Always run app as non-root inside the container:
FROM node:20-alpine
WORKDIR /app
COPY --chown=node:node package*.json ./   # ← own files as 'node' user
RUN npm ci
COPY --chown=node:node . .

USER node                                 # ← switch to non-root user before CMD
# If container is escaped: attacker is 'node' (uid 1000), not 'root'
EXPOSE 3000
CMD ["node", "server.js"]
```

---

### Q8 [ADVANCED]: What is the OCI Image Specification? How is an image really stored?
**A:** OCI (Open Container Initiative) Image Spec defines the standard image format that all compliant registries and runtimes understand.

```json
// An image is: a manifest pointing to layers + a config
// manifest.json (what the registry stores):
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.oci.image.manifest.v1+json",
  "config": {
    "digest": "sha256:abc123...",    // ← image config (ENV, CMD, entrypoint, etc.)
    "size": 7023
  },
  "layers": [
    { "digest": "sha256:layer1...", "size": 25164288 },  // ← base OS layer
    { "digest": "sha256:layer2...", "size": 8192000  },  // ← npm install layer
    { "digest": "sha256:layer3...", "size": 51200    }   // ← app code layer
  ]
}
```

```bash
# Pull and inspect image internals:
docker save myapp > myapp.tar
tar xf myapp.tar
# Shows: manifest.json, /blobs/sha256/* (each layer is a .tar.gz)

# Layers are content-addressed (sha256 of content = name)
# → identical layers across images are stored ONCE on disk and in registries
# → 'node:20' layer shared between all node-based images in your registry

# Image manifest list (multi-arch):
docker manifest inspect node:20
# Shows per-arch manifests: amd64, arm64, etc.
```

---

### Q9 [ADVANCED]: How do you diagnose and fix container performance issues?
**A:** Container performance issues fall into: CPU throttling, memory pressure, I/O contention, and network bottlenecks.

```bash
# Real-time stats for all containers:
docker stats --no-trunc

# CPU throttling (cgroup CPU quota):
cat /sys/fs/cgroup/cpu/docker/<container-id>/cpu.stat
# throttled_time > 0 → container is CPU-throttled (limit too low or app too CPU-hungry)

# Fix: increase CPU limit or optimize the hotspot
docker run --cpus="2.0" myapp      # allow up to 2 CPU cores
docker run --cpu-shares=512 myapp  # relative weight (1024 = default)

# Memory pressure:
docker inspect <container> | grep -A 5 '"Memory"'
# OOMKilled = true → container ran out of memory and was killed by the OOM killer

docker run --memory="512m" --memory-swap="512m" myapp  # no swap
# --memory-swap same as --memory → no swap space (faster, prevents OOM slow death)

# I/O throttling:
docker run --device-write-bps /dev/sda:10mb myapp  # limit write to 10MB/s

# Network diagnostics:
docker exec myapp ss -tp          # active connections inside container
docker exec myapp netstat -s      # network retransmit stats (high = congestion)

# Full system profiling with cAdvisor:
docker run -d \
  --volume=/var/run/docker.sock:/var/run/docker.sock:ro \
  --publish=8080:8080 \
  gcr.io/cadvisor/cadvisor      # → metrics for all containers at :8080/metrics
```

---

### Q10 [ADVANCED]: What are security scanning best practices for Docker images?
**A:** Images can contain vulnerable OS packages, leaked secrets, or misconfigured permissions. Scanning must be part of CI/CD.

```bash
# Trivy — comprehensive vulnerability scanner
docker run aquasec/trivy image myapp:latest
# Reports: CVE IDs, severity (CRITICAL/HIGH/MEDIUM/LOW), fixed-in version

# Scan before push in CI:
trivy image --exit-code 1 --severity CRITICAL myapp:latest
# --exit-code 1 → fail CI pipeline if CRITICAL CVEs found

# Docker Scout (built into Docker Desktop / Hub):
docker scout cves myapp:latest
docker scout recommendations myapp:latest   # suggests base image upgrades

# Prevent secret leaks — scan build context:
# Use trufflehog, detect-secrets, or gitleaks in pre-commit hooks
# NEVER: COPY /host/.env /app/.env  ← secrets baked into image layer forever

# Distroless images — minimal attack surface (no shell, no package manager):
FROM gcr.io/distroless/nodejs20-debian12 AS runtime  # ← no bash, no apt
COPY --from=builder /app/dist /app/dist
CMD ["/app/dist/server.js"]
# trivy scan result: dramatically fewer CVEs (no OS package manager)

# Verify image hasn't been tampered with — Docker Content Trust:
export DOCKER_CONTENT_TRUST=1
docker pull myrepo/myapp:latest   # verifies Notary signature
```
