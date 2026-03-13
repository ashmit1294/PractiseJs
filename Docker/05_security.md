# Docker: Security Best Practices

## OWASP Top Docker Security Issues

1. Privileged containers
2. Running as root
3. Exposed secrets in images
4. Unrestricted capabilities
5. Vulnerable base images
6. No resource limits
7. Overly permissive network access
8. Unverified base images

---

## Q1. Run containers as non-root

```dockerfile
FROM node:20-alpine

# Create dedicated app user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
COPY --chown=appuser:appgroup package*.json ./
RUN npm ci --only=production
COPY --chown=appuser:appgroup . .

USER appuser               # switch to non-root before CMD
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

```bash
# Verify running as non-root
docker exec myapp whoami   # should print appuser, not root

# Override at runtime (avoid)
docker run --user 1001:1001 myapp
```

---

## Q2. Never put secrets in images

```dockerfile
# BAD — secret baked into image layer (visible in docker history)
ENV DATABASE_PASSWORD=supersecret
RUN curl -H "Authorization: Bearer ${API_KEY}" https://api.example.com/data
```

**Solutions:**

**BuildKit secrets (never appear in image layers):**
```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine

# --mount=type=secret copies secret into /run/secrets/ for this RUN only
# NOT in final image, NOT in cache
RUN --mount=type=secret,id=npmrc,mode=0400 \
    cp /run/secrets/npmrc ~/.npmrc && \
    npm ci && \
    rm ~/.npmrc
```

```bash
docker build --secret id=npmrc,src=.npmrc -t myapp .
```

**Runtime environment variables (not ARG/ENV at build time):**
```bash
docker run -e DATABASE_URL="${DATABASE_URL}" myapp
# Or via env file:
docker run --env-file .env.production myapp
```

**Docker secrets (Swarm mode):**
```bash
echo "supersecret" | docker secret create db_password -
docker service create --secret db_password myapp
# Available at /run/secrets/db_password inside container
```

---

## Q3. Use minimal base images

```dockerfile
# Option 1: alpine — minimal (~5MB), musl libc
FROM node:20-alpine

# Option 2: slim — Debian minimal
FROM node:20-slim

# Option 3: distroless — no shell, no package manager
FROM gcr.io/distroless/nodejs20-debian12

# Option 4: scratch — completely empty (for Go static binaries)
FROM scratch
COPY myapp-static /app
CMD ["/app"]
```

| Image | Size | Shell | Package Manager |
|-------|------|-------|-----------------|
| node:20 | ~1GB | Yes | Yes |
| node:20-slim | ~240MB | Yes | Yes |
| node:20-alpine | ~180MB | sh | apk |
| distroless/nodejs20 | ~50MB | No | No |

---

## Q4. Pin image versions

```dockerfile
# BAD — 'latest' can change unexpectedly
FROM node:latest

# OK — version pinned
FROM node:20-alpine

# BEST — pinned to exact digest (immutable)
FROM node:20-alpine@sha256:4b64...abc123

# Find digest:
# docker pull node:20-alpine
# docker inspect node:20-alpine --format '{{.Id}}'
```

---

## Q5. Drop Linux capabilities

```bash
# Containers run with a reduced set of capabilities by default
# Drop ALL capabilities, add back only what's needed
docker run \
  --cap-drop ALL \
  --cap-add NET_BIND_SERVICE \     # bind to ports < 1024
  myapp

# In compose
services:
  app:
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

**Common capabilities:**
- `NET_BIND_SERVICE` — bind port < 1024
- `CHOWN` — change file ownership
- `SETUID` / `SETGID` — change user/group
- `SYS_PTRACE` — debug other processes (DO NOT ADD in production)

---

## Q6. Read-only filesystem

```bash
# Container filesystem is read-only — prevents attacker writing files
docker run --read-only \
  --tmpfs /tmp \                   # writable temp
  --tmpfs /var/run \
  myapp

# In compose
services:
  app:
    read_only: true
    tmpfs:
      - /tmp
      - /var/run
```

---

## Q7. Resource limits

```bash
# CPU and memory limits prevent DoS / runaway processes
docker run \
  --memory 512m \                  # hard limit
  --memory-swap 512m \             # no swap
  --memory-reservation 256m \      # soft limit
  --cpus 1.5 \                     # max 1.5 CPU cores
  myapp
```

```yaml
# In compose
services:
  api:
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 128M
```

---

## Q8. Image scanning

```bash
# Docker Scout (built into Docker Desktop)
docker scout cves myapp:latest
docker scout recommendations myapp:latest

# Trivy (open source, CI-friendly)
trivy image myapp:latest
trivy image --severity HIGH,CRITICAL myapp:latest
trivy image --exit-code 1 --severity CRITICAL myapp:latest  # fail CI on CRITICAL

# Snyk
snyk container test myapp:latest

# Anchore
anchore-cli image add myapp:latest
anchore-cli image wait myapp:latest
anchore-cli image vuln myapp:latest all
```

**Integrate into CI pipeline:**
```yaml
# GitHub Actions example
- name: Scan image for vulnerabilities
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: myapp:${{ github.sha }}
    format: sarif
    output: trivy-results.sarif
    severity: CRITICAL,HIGH
    exit-code: 1
```

---

## Q9. Security checklist

```dockerfile
# Security-hardened Node.js Dockerfile

# syntax=docker/dockerfile:1
FROM node:20-alpine@sha256:<pinned-digest> AS deps
WORKDIR /app

# Install as root (needed for npm ci)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:20-alpine@sha256:<pinned-digest> AS runner
WORKDIR /app

ENV NODE_ENV=production

# Non-root user
RUN addgroup -S app && adduser -S app -G app

# Only copy production dependencies
COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --chown=app:app dist ./dist

USER app

# No new privileges
# docker run --security-opt=no-new-privileges myapp

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
```

**Security checklist:**
- [ ] Non-root USER in Dockerfile
- [ ] Minimal base image (alpine/distroless)
- [ ] Pinned image digest
- [ ] No secrets in image or build args
- [ ] Multi-stage build (no dev tools in prod image)
- [ ] Read-only filesystem where possible
- [ ] Drop ALL capabilities, add back only what's needed
- [ ] Memory and CPU limits set
- [ ] Regular vulnerability scanning (Trivy/Scout)
- [ ] Sign images (Docker Content Trust / cosign)

---

## Interview Questions

**Q: Why is running containers as root dangerous?**
> If an attacker breaks out of the container (container escape vulnerability), root in the container means root on the host. Non-root user limits the blast radius of a breach.

**Q: If I have a secret in ENV, is it safe?**
> ENV values are visible in `docker inspect`, docker history, and any process that can read `/proc/1/environ` inside the container. Use BuildKit `--mount=type=secret` for build-time secrets, and inject runtime secrets via orchestrator secrets (K8s Secrets, AWS Secrets Manager) at runtime.

**Q: What is a container escape?**
> A vulnerability that allows code running inside a container to gain access to the host. Privileged containers (`--privileged`) dramatically increase the risk. Running as non-root, dropping capabilities, and using read-only filesystems reduce the attack surface.

**Q: What is the principle of least privilege in Docker?**
> Containers should only have the permissions they need: minimal capabilities, non-root user, no host network/PID namespaces, no mounted Docker socket (`/var/run/docker.sock`), read-only filesystem, and only necessary ports exposed.

**Q: Why should you never mount the Docker socket into a container?**
> `/var/run/docker.sock` grants full control of the Docker daemon. Any process in that container can spawn new privileged containers, access all containers, and effectively own the host. Never mount it in production workloads.
