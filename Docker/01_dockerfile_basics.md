# Docker: Dockerfile Fundamentals

## What is a Dockerfile?

A text document containing instructions to build a Docker image.
Each instruction creates a new layer in the image.

---

## Key Dockerfile Instructions

| Instruction | Purpose |
|-------------|---------|
| `FROM`      | Base image |
| `RUN`       | Execute command during build |
| `COPY`      | Copy files from host to image |
| `ADD`       | Like COPY + URL support + auto-extract tar |
| `WORKDIR`   | Set working directory |
| `ENV`       | Set environment variable |
| `ARG`       | Build-time variable (not in final image) |
| `EXPOSE`    | Document the port (informational only) |
| `CMD`       | Default command when container starts (overridable) |
| `ENTRYPOINT`| Container entrypoint (not overridden by `docker run`) |
| `USER`      | Switch to a non-root user |
| `HEALTHCHECK` | Check container health |
| `VOLUME`    | Declare mount points |

---

## Q1. Simple Node.js Dockerfile

```dockerfile
# Bad — no layer caching optimisation
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "src/index.js"]
```

**Problem:** Every code change invalidates the `npm install` layer.

```dockerfile
# Good — copy package.json first to cache npm install layer
FROM node:20-alpine
WORKDIR /app

# Layer 1: dependencies (cached unless package.json changes)
COPY package*.json ./
RUN npm ci --only=production

# Layer 2: application code
COPY . .

EXPOSE 3000
CMD ["node", "src/index.js"]
```

---

## Q2. Multi-stage build — smaller production image

```dockerfile
# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci                          # install ALL deps (dev + prod)

COPY . .
RUN npm run build                   # compile TypeScript → dist/

# ── Stage 2: Production ─────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only what's needed from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER appuser                        # run as non-root

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
```

**Benefits:**
- Builder image: 400MB (includes compilers, dev deps)
- Production image: ~120MB (runtime only)
- No source files, no dev tools, no test dependencies in production

---

## Q3. .dockerignore — exclude files from build context

```dockerignore
node_modules
dist
.git
.gitignore
*.md
*.log
.env
.env.*
coverage
.nyc_output
.DS_Store
Thumbs.db
docker-compose*.yml
Dockerfile*
```

**Why it matters:** Without `.dockerignore`, the entire `node_modules` (potentially 500MB)
is sent to the Docker daemon before each build.

---

## Q4. ARG vs ENV

```dockerfile
# ARG — build-time only, not available in running container
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine

ARG BUILD_DATE
ARG GIT_COMMIT

LABEL build-date=${BUILD_DATE} git-commit=${GIT_COMMIT}

# ENV — available at both build time AND runtime
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info

# Override ARG at build: docker build --build-arg NODE_VERSION=18 .
# Override ENV at run:   docker run -e LOG_LEVEL=debug myapp
```

---

## Q5. ENTRYPOINT vs CMD

```dockerfile
# CMD only — easily overridden by docker run arguments
CMD ["node", "dist/index.js"]
# docker run myapp bash → runs bash, not node

# ENTRYPOINT — always runs; CMD becomes default arguments
ENTRYPOINT ["node"]
CMD ["dist/index.js"]
# docker run myapp dist/other.js → runs node dist/other.js

# Combined — best practice for scripts
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
# Entrypoint script sets up env, then execs CMD
```

**Shell form vs Exec form:**
```dockerfile
CMD node dist/index.js       # Shell form: runs /bin/sh -c "node dist/index.js"
CMD ["node", "dist/index.js"] # Exec form: runs directly — receives signals properly
```
Always use **exec form** in production so `SIGTERM` reaches the process.

---

## Q6. Layer caching best practices

```dockerfile
# Order from LEAST frequently changing to MOST frequently changing

FROM node:20-alpine

# 1. System dependencies (rarely change)
RUN apk add --no-cache curl

WORKDIR /app

# 2. Package manifest (changes when adding new packages)
COPY package*.json ./
RUN npm ci --only=production

# 3. Configuration files (change occasionally)
COPY tsconfig.json .

# 4. Application source (changes most frequently)
COPY src ./src

RUN npm run build
```

---

## Q7. HEALTHCHECK

```dockerfile
HEALTHCHECK \
  --interval=30s \   # check every 30 seconds
  --timeout=10s \    # report unhealthy if no reply within 10s
  --start-period=5s \ # ignore failures during the first 5s
  --retries=3 \      # 3 failures = unhealthy
  CMD curl -f http://localhost:3000/health || exit 1
```

---

## Q8. Security best practices

```dockerfile
FROM node:20-alpine

# Pin base image by digest for reproducibility + security
# FROM node:20-alpine@sha256:abc123...

# Run as non-root user
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --chown=app:app package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --chown=app:app . .

# Drop ALL linux capabilities
USER app

# Read-only filesystem (add tmpfs for writable dirs if needed)
# docker run --read-only --tmpfs /tmp myapp

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Security checklist:**
- [ ] Use minimal base image (alpine, distroless)
- [ ] Run as non-root user
- [ ] No secrets in Dockerfile or image layers
- [ ] Pin base image versions
- [ ] Scan with `docker scout` or Trivy
- [ ] Minimise installed packages
- [ ] Use multi-stage to exclude build tools

---

## Q9. Distroless images

```dockerfile
# FROM node:20-alpine     ~65MB
# FROM gcr.io/distroless/nodejs20-debian12  ~50MB — no shell, no package manager

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["dist/index.js"]
```

Distroless: no shell available → harder for attackers to execute commands if they get in.

---

## Q10. Build & run commands reference

```bash
# Build
docker build -t myapp:1.0.0 .
docker build -t myapp:1.0.0 --build-arg BUILD_DATE=$(date -u +%FT%TZ) .
docker build --no-cache -t myapp:latest .   # bypass cache

# Tag & push
docker tag myapp:1.0.0 registry.example.com/myapp:1.0.0
docker push registry.example.com/myapp:1.0.0

# Run
docker run -d -p 3000:3000 --name myapp myapp:latest
docker run -e NODE_ENV=production -e DATABASE_URL=... myapp:latest

# Inspect layers
docker history myapp:latest
docker inspect myapp:latest

# Scan for vulnerabilities
docker scout cves myapp:latest
```

---

## Interview Questions

**Q: What is the difference between an image and a container?**
> Image: read-only template (layers). Container: running instance of an image (image + writable layer).

**Q: What is a Docker layer?**
> Each instruction in a Dockerfile creates an immutable layer. Layers are cached and shared across images. A container adds one writable layer on top.

**Q: Why use multi-stage builds?**
> Separate build dependencies from runtime. Final image only contains what's needed to run, not compilers, source code, or dev tools. Dramatically reduces image size and attack surface.

**Q: What happens when SIGTERM is sent to a container?**
> Docker sends SIGTERM to PID 1. With exec form CMD, your Node.js process is PID 1 and receives it directly. With shell form, `sh` is PID 1 and may not forward signals — graceful shutdown breaks.

**Q: What is a dangling layer?**
> A layer no longer referenced by any image tag, created by re-building an image with the same tag. Freed with `docker image prune`.
