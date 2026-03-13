# Docker & Containers — Interview Revision Summary

> **Target:** 7+ year Full Stack MERN Developer | **Files:** 9

## Table of Contents

1. [01_dockerfile_basics.md — Q1. Simple Node.js Dockerfile](#01_dockerfile_basicsmd-q1-simple-nodejs-dockerfile)
2. [02_docker_compose.md — Q1. Basic docker-compose.yml structure](#02_docker_composemd-q1-basic-docker-composeyml-structure)
3. [03_networking.md — Q1. Bridge networks (default and custom)](#03_networkingmd-q1-bridge-networks-default-and-custom)
4. [04_volumes_storage.md — Q1. Named volumes](#04_volumes_storagemd-q1-named-volumes)
5. [05_security.md — Q1. Run containers as non-root](#05_securitymd-q1-run-containers-as-non-root)
6. [06_cicd_registry.md — Q1. Basic registry push/pull](#06_cicd_registrymd-q1-basic-registry-pushpull)
7. [07_production.md — Q1. Resource limits](#07_productionmd-q1-resource-limits)
8. [08_interview_qa.md — Q1. What is Docker and how does it differ from a virtual machine?**](#08_interview_qamd-q1-what-is-docker-and-how-does-it-differ-from-a-virtual-machine)
9. [09_theory_advanced_qa.md — SECTION 1: BASIC](#09_theory_advanced_qamd-section-1-basic)

---

<a id="docker-dockerfile-basics"></a>
## 01_dockerfile_basics.md — Q1. Simple Node.js Dockerfile

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

---

<a id="docker-docker-compose"></a>
## 02_docker_compose.md — Q1. Basic docker-compose.yml structure

# Docker: docker-compose & Multi-Container Apps

## What is Docker Compose?

A tool to define and run **multi-container** applications.
Configuration lives in `docker-compose.yml` (or `compose.yaml`).
A single command (`docker compose up`) starts your entire stack.

---

## Q1. Basic docker-compose.yml structure

```yaml
# compose.yaml (preferred file name in newer versions)
version: "3.9"   # Compose file format version

services:
  web:
    build: .                         # use local Dockerfile
    ports:
      - "3000:3000"                  # host:container
    environment:
      NODE_ENV: development
      DATABASE_URL: postgres://user:pass@db:5432/myapp
    depends_on:
      db:
        condition: service_healthy   # wait for health check
    volumes:
      - ./src:/app/src               # bind mount for hot reload
    networks:
      - app-network
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: myapp
    volumes:
      - pg_data:/var/lib/postgresql/data   # named volume (persists data)
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d myapp"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - app-network

volumes:
  pg_data:
  redis_data:

networks:
  app-network:
    driver: bridge
```

---

## Q2. Environment variable management

```yaml
# Option 1: inline (avoid for secrets)
services:
  app:
    environment:
      DB_HOST: db
      DB_PORT: 5432

# Option 2: env_file — reads from a file
services:
  app:
    env_file:
      - .env
      - .env.local           # overrides .env

# Option 3: variable substitution from host env
services:
  app:
    environment:
      API_KEY: ${API_KEY}    # from host env / .env file
      DEBUG: ${DEBUG:-false} # with default value
```

```bash
# .env file (in project root — loaded automatically by compose)
DB_HOST=db
DB_PASSWORD=supersecret
API_KEY=abc123
```

---

## Q3. Volumes — bind mounts vs named volumes

```yaml
services:
  app:
    volumes:
      # Named volume — managed by Docker, persists between runs
      - db_data:/var/lib/postgresql/data

      # Bind mount — maps host path to container path
      - ./src:/app/src              # hot reload: host changes visible in container
      - ./config:/app/config:ro     # :ro = read-only

      # Anonymous volume — temporary, deleted when container removed
      - /app/node_modules           # prevents host node_modules from overriding

volumes:
  db_data:
    driver: local                   # default driver
```

**When to use named volumes:**
- Database files, persistent uploads, persistent cache
- Managed by Docker — survives `docker compose down`

**When to use bind mounts:**
- Development hot reload (source code)
- Config files from the host
- Sharing files between host and container

**Anti-pattern:** Mounting `node_modules` from host into container — different platforms (macOS/Linux/Windows) compile native modules differently. Use anonymous volume instead.

---

## Q4. Service profiles — conditional services

```yaml
services:
  app:
    build: .
    profiles: [""]          # always started

  db:
    image: postgres:16-alpine
    profiles: [""]          # always started

  adminer:                  # DB admin UI — development only
    image: adminer
    ports:
      - "8080:8080"
    profiles: ["dev"]       # only started with --profile dev

  mailhog:                  # fake SMTP server
    image: mailhog/mailhog
    profiles: ["dev", "test"]
```

```bash
docker compose up                              # starts services with no profile
docker compose --profile dev up               # starts dev profile services too
docker compose --profile dev --profile test up
```

---

## Q5. Full-stack development compose

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev -d myapp"]
      interval: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build:
      context: .
      dockerfile: Dockerfile.dev
      target: development             # multi-stage build target
    ports:
      - "3001:3001"
      - "9229:9229"                   # Node debugger port
    environment:
      DATABASE_URL: postgres://dev:dev@postgres:5432/myapp
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
    volumes:
      - ./src:/app/src
      - /app/node_modules             # anonymous volume — keeps container modules
    command: npm run dev              # nodemon / ts-node-dev
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      VITE_API_URL: http://localhost:3001
    volumes:
      - ./frontend/src:/app/src
      - /app/node_modules
    depends_on:
      - api

volumes:
  pg_data:
```

---

## Q6. Override files — compose.override.yml

```yaml
# compose.yml — base (production compatible)
services:
  app:
    image: myapp:${TAG:-latest}
    environment:
      NODE_ENV: production
```

```yaml
# compose.override.yml — auto-loaded in development
services:
  app:
    build: .                         # build locally in dev
    volumes:
      - ./src:/app/src               # hot reload
    environment:
      NODE_ENV: development
      DEBUG: "*"
    command: npm run dev
```

```bash
# Development (uses both files automatically)
docker compose up

# CI/Production (only base file)
docker compose -f compose.yml up

# Specific override
docker compose -f compose.yml -f compose.prod.yml up
```

---

## Q7. Common docker compose commands

```bash
# Start services
docker compose up -d                           # detached (background)
docker compose up --build                      # rebuild images first
docker compose up --scale api=3               # run 3 api instances

# Stop / clean up
docker compose down                            # stop + remove containers
docker compose down -v                         # also remove volumes (data loss!)
docker compose down --remove-orphans

# Logs
docker compose logs -f                         # follow all logs
docker compose logs -f api                     # follow api logs only

# Exec into running container
docker compose exec api sh
docker compose exec api npm run migration:run

# Run one-off command
docker compose run --rm api npm run seed

# Status
docker compose ps
docker compose top                             # process list inside containers
```

---

## Q8. Health checks and restart policies

```yaml
services:
  api:
    restart: unless-stopped          # restart on crash, but not if manually stopped
    # always — always restart
    # on-failure — only restart on non-zero exit
    # no — never restart

  db:
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
      interval: 10s           # check every 10s
      timeout: 5s             # fail if no response in 5s
      retries: 5              # 5 consecutive failures = unhealthy
      start_period: 30s       # grace period before health checks count

    depends_on:
      db:
        condition: service_healthy   # wait until healthy
```

---

## Interview Questions

**Q: What is the difference between `docker compose up` and `docker compose start`?**
> `up` creates AND starts containers. `start` only starts already-created containers.

**Q: What does `depends_on` guarantee?**
> Only that the container starts — NOT that the service inside is ready. Use `condition: service_healthy` with a healthcheck for proper readiness waiting.

**Q: How do containers in the same compose network communicate?**
> They can reach each other by **service name** (e.g., `http://api:3001`). Docker's DNS resolver handles the hostname → IP mapping. No need to expose ports between services on the same network.

**Q: What is the difference between `docker compose down` and `docker compose stop`?**
> `stop`: pauses containers (preserves state). `down`: stops AND removes containers, networks. `-v` flag also removes volumes (destructive!).

**Q: How do you share environment variables between multiple services without repeating?**
> Use YAML anchors:
> ```yaml
> x-common-env: &common-env
>   NODE_ENV: production
>   LOG_LEVEL: info
> services:
>   api:
>     environment: *common-env
>   worker:
>     environment: *common-env
> ```

---

<a id="docker-networking"></a>
## 03_networking.md — Q1. Bridge networks (default and custom)

# Docker: Networking

## Docker Network Types

| Driver    | Description |
|-----------|-------------|
| `bridge`  | Default. Private network for containers on one host. |
| `host`    | Container shares host network stack (Linux only). |
| `none`    | No networking. |
| `overlay` | Multi-host networking (Docker Swarm / Kubernetes). |
| `macvlan` | Container gets its own MAC + IP on the physical network. |

---

## Q1. Bridge networks (default and custom)

```bash
# Default bridge network — auto-assigned IPs, containers talk via IP only
docker run -d --name app1 nginx
docker run -d --name app2 nginx
# app1 cannot reach app2 by name — only by IP

# Custom bridge — automatic DNS resolution by container name
docker network create my-network
docker run -d --name app1 --network my-network nginx
docker run -d --name app2 --network my-network nginx
# app2 can reach app1 at http://app1:80
```

**Always use custom bridge networks — DNS by name works, more isolation.**

---

## Q2. Network commands

```bash
# Create
docker network create --driver bridge app-net
docker network create --subnet 172.20.0.0/16 --ip-range 172.20.240.0/20 app-net

# List / inspect
docker network ls
docker network inspect app-net

# Connect / disconnect a running container
docker network connect app-net my-container
docker network disconnect app-net my-container

# Remove unused networks
docker network prune
```

---

## Q3. Expose vs publish ports

```dockerfile
EXPOSE 3000   # documents intent — informational only, no binding
```

```bash
# -p publishes the port to the host
docker run -p 3000:3000 myapp          # host:container
docker run -p 127.0.0.1:3000:3000 myapp  # bind to localhost only (safer)
docker run -p 3000 myapp              # random host port → container 3000

docker port myapp                      # show port mappings
```

---

## Q4. Inter-service communication in compose

```yaml
services:
  api:
    image: myapi
    networks:
      - backend
      - frontend

  db:
    image: postgres:16
    networks:
      - backend              # only reachable from backend network
    # NOT on frontend — db is not exposed to client-facing services

  nginx:
    image: nginx
    ports:
      - "80:80"
    networks:
      - frontend             # faces the internet

networks:
  frontend:
  backend:
    internal: true           # no external traffic — only internal services
```

---

## Q5. Host networking (Linux only)

```bash
# Container shares host network interface directly
# No port mapping needed — process appears on host IP
docker run --network host nginx

# Useful for:
# - Performance-critical workloads (no NAT overhead)
# - Tools that need to see host network interfaces
# - Development only — not recommended for production (no isolation)
```

---

## Q6. DNS and service discovery

```bash
# Inside a container on a custom network, you can reach other containers by:
# 1. Service name:    http://api:3000
# 2. Container name: http://my-api-container:3000
# 3. Network alias:  http://backend:3000 (if alias defined)

# Aliases
docker run -d --network app-net --network-alias backend myapi
```

```yaml
# Compose network aliases
services:
  api:
    networks:
      app-net:
        aliases:
          - backend
          - api-service
```

---

## Q7. Overlay network (Swarm / multi-host)

```bash
# Overlay spans multiple Docker hosts
docker network create --driver overlay --attachable my-overlay

# Services on different hosts communicate transparently via overlay
# Uses VXLAN encapsulation under the hood
# Swarm encrypted overlay: --opt encrypted
docker network create --driver overlay --opt encrypted secure-net
```

---

## Q8. Network troubleshooting

```bash
# Check connectivity from inside a container
docker exec -it myapp sh
wget -qO- http://api:3000/health
nslookup api
ping db

# Inspect network — see containers and IPs
docker network inspect app-net

# Container IP address
docker inspect myapp --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'

# Port scan from another container
docker run --rm --network app-net alpine nc -zv db 5432

# Network traffic capture (requires NET_ADMIN capability)
docker run --rm --net container:myapp nicolaka/netshoot tcpdump -i eth0 port 3000
```

---

## Interview Questions

**Q: Why should you use custom bridge networks instead of the default?**
> Custom bridge networks provide automatic DNS resolution between containers by name. The default bridge network only allows IP-based communication; you'd need to look up IPs or use `--link` (deprecated).

**Q: How do containers on the same Docker host communicate without exposing ports?**
> Place them on the same custom network. They communicate directly using service/container names as hostnames. No ports need to be published to the host.

**Q: What is the difference between EXPOSE and -p?**
> `EXPOSE` is documentation only — it doesn't open any ports. `-p` actually binds a host port to a container port, making it accessible from outside the container.

**Q: What security considerations apply to Docker networking?**
> - Use `internal: true` on networks that should not reach the internet.
> - Bind published ports to `127.0.0.1` if only local access is needed.
> - Separate networks for frontend/backend/database tiers.
> - Overlay networks should use encryption (`--opt encrypted`).
> - Avoid `--network host` in production.

**Q: What is a macvlan network and when would you use it?**
> Macvlan assigns a container its own MAC address and IP on the physical network, making it appear as a physical device. Useful for legacy apps that expect to be on the LAN directly, or network appliance containers. Rarely used in modern web apps.

---

<a id="docker-volumes-storage"></a>
## 04_volumes_storage.md — Q1. Named volumes

# Docker: Volumes & Storage

## Storage Types

| Type        | Description | Persistence |
|-------------|-------------|-------------|
| Named volume | Docker-managed, stored in Docker area | Yes — survives `docker compose down` |
| Bind mount  | Host path mapped into container | Yes — on host filesystem |
| tmpfs       | In-memory (Linux only) | No — lost on container stop |
| Anonymous volume | Like named but no name, auto-cleanup | No — removed with container |

---

## Q1. Named volumes

```bash
# Create
docker volume create my_data

# List / inspect
docker volume ls
docker volume inspect my_data

# Remove
docker volume rm my_data
docker volume prune          # remove all unused volumes (careful!)
```

```yaml
# In compose
services:
  db:
    image: postgres:16
    volumes:
      - pg_data:/var/lib/postgresql/data

volumes:
  pg_data:                    # Docker manages this — stored in /var/lib/docker/volumes/
    driver: local
```

---

## Q2. Bind mounts — hot reload development

```yaml
services:
  api:
    build: .
    volumes:
      - ./src:/app/src           # changes on host immediately reflected in container
      - ./config:/app/config:ro  # read-only

  # Prevent host node_modules from being used inside container
  # (different platforms compile native modules differently)
  frontend:
    build: .
    volumes:
      - ./src:/app/src
      - /app/node_modules        # anonymous volume — container uses its own modules
```

---

## Q3. tmpfs — sensitive / temporary data

```bash
# Secrets in memory — never on disk
docker run --tmpfs /run/secrets:rw,noexec,nosuid,size=65536k myapp

# In compose
services:
  app:
    tmpfs:
      - /tmp
      - /run/secrets:size=10m,mode=0700
```

---

## Q4. Volume backup and restore

```bash
# Backup named volume to a tar file
docker run --rm \
  -v pg_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/pg_backup.tar.gz -C /data .

# Restore
docker run --rm \
  -v pg_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/pg_backup.tar.gz -C /data
```

---

## Q5. Volume drivers — remote storage

```yaml
# NFS volume — shared across multiple hosts
volumes:
  nfs_share:
    driver: local
    driver_opts:
      type: nfs
      o: "addr=nfs-server.example.com,rw,nfsvers=4"
      device: ":/exports/mydata"

# AWS EFS (via Portworx / Docker EFS driver)
volumes:
  efs_data:
    driver: rexray/efs
    driver_opts:
      volumeType: gp2
```

---

## Q6. Copy-on-Write (CoW) semantics

**Image layers** are read-only. When a container modifies a file:
1. Docker copies the file from the read-only layer to the container's writable layer (CoW).
2. Subsequent reads/writes go to the writable copy.

**Implications:**
- Frequent writes to many small files → many CoW operations → slow
- Solution: use volumes for write-heavy paths (databases, logs, uploads)
- `docker diff container_id` — shows files modified in writable layer

---

## Q7. Volumes vs bind mounts — when to use each

| Scenario | Recommendation |
|----------|----------------|
| Database files | Named volume |
| Log files | Named volume or stdout |
| Dev hot reload | Bind mount |
| Config files | Bind mount (read-only) |
| Shared between containers | Named volume |
| Sensitive temp data | tmpfs |
| CI/CD artifacts | Bind mount to workspace |

---

## Interview Questions

**Q: What is the difference between a named volume and a bind mount?**
> Named volume: Docker manages the location (`/var/lib/docker/volumes/`). Portable, not tied to host filesystem layout. Preferred for databases and persistent data.
> Bind mount: exact host path mounted. More control, but tied to host OS structure. Best for development (source code hot reload) and config files.

**Q: Why does using host `node_modules` cause problems in containers?**
> Native Node.js modules are compiled for the host OS and CPU architecture. If the host is macOS and the container is Linux, native modules (like `sharp`, `bcrypt`) will fail. Solution: use an anonymous volume (`/app/node_modules`) to use the container-compiled modules.

**Q: How do multiple containers share a volume in compose?**
> Define a named volume and mount it in multiple services. Both services read/write to the same location. Be careful with concurrent writes — databases handle their own locking. For app code: use one writer, multiple readers pattern.

**Q: What happens to named volumes when you run `docker compose down`?**
> Containers are removed, but named volumes persist. Use `docker compose down -v` to also remove volumes. This is destructive — you lose all database data.

**Q: How do you access volume data from the host?**
> `docker volume inspect vol_name` shows the Mountpoint. On Linux you can access it directly. On macOS/Windows (which use a Linux VM), you need to `docker run --rm -v vol_name:/data alpine ls /data`. Or use bind mounts instead.

---

<a id="docker-security"></a>
## 05_security.md — Q1. Run containers as non-root

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

---

<a id="docker-cicd-registry"></a>
## 06_cicd_registry.md — Q1. Basic registry push/pull

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

---

<a id="docker-production"></a>
## 07_production.md — Q1. Resource limits

# Docker: Production Operations

## Key Production Concerns
1. Resource limits (prevent runaway containers)
2. Logging (centralized, structured)
3. Health checks (restart failing containers automatically)
4. Restart policies (survive crashes + reboots)
5. Monitoring (metrics, alerts)
6. Rolling updates (zero-downtime deployments)

---

## Q1. Resource limits

```bash
# Memory limits
docker run \
  --memory 512m \           # if container exceeds this, it is OOM-killed
  --memory-swap 512m \      # = memory limit (no swap allowed)
  --memory-reservation 256m \ # soft limit for scheduling
  myapp

# CPU limits
docker run \
  --cpus 1.5 \              # max 1.5 CPU cores
  --cpu-shares 512 \        # relative weight (default 1024)
  myapp

# Check current usage
docker stats --no-stream

# Verify limits on running container
docker inspect <id> | jq '.[0].HostConfig | {Memory, NanoCpus}'
```

```yaml
# compose — deploy.resources (also honoured by Swarm)
services:
  api:
    image: myapp:latest
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 128M
      replicas: 3
      update_config:
        parallelism: 1         # update one at a time
        delay: 10s
        failure_action: rollback
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
```

---

## Q2. Logging drivers

```bash
# Default: json-file (stored in /var/lib/docker/containers/<id>/<id>-json.log)
# Pros: simple; Cons: no central aggregation, grows unbounded

# Set log driver + rotation (json-file)
docker run \
  --log-driver json-file \
  --log-opt max-size=10m \   # rotate at 10MB
  --log-opt max-file=5 \     # keep 5 rotated files
  myapp

# Syslog
docker run --log-driver syslog --log-opt syslog-address=tcp://loghost:514 myapp

# Fluentd (structured log shipping)
docker run \
  --log-driver fluentd \
  --log-opt fluentd-address=localhost:24224 \
  --log-opt tag="{{.Name}}" \
  myapp

# AWS CloudWatch
docker run \
  --log-driver awslogs \
  --log-opt awslogs-region=us-east-1 \
  --log-opt awslogs-group=production \
  --log-opt awslogs-stream=myapp \
  myapp

# Splunk / GELF (Graylog) also supported
```

```json
// daemon.json — set default log driver for ALL containers on this host
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
# Read logs
docker logs myapp
docker logs --follow myapp           # stream
docker logs --since 1h myapp        # last 1 hour
docker logs --tail 100 myapp        # last 100 lines
```

---

## Q3. Restart policies

| Policy | Behaviour |
|--------|-----------|
| `no` (default) | Never restart |
| `on-failure[:N]` | Restart on non-zero exit, up to N times |
| `always` | Always restart (including daemon restart) |
| `unless-stopped` | Always restart unless manually stopped |

```bash
docker run --restart unless-stopped myapp

# In compose (for plain docker compose, not Swarm)
services:
  app:
    restart: unless-stopped

# 'always' vs 'unless-stopped':
# docker stop myapp → 'always' will restart after daemon restart
#                     'unless-stopped' will NOT (respects intentional stop)
```

---

## Q4. HEALTHCHECK in depth

```dockerfile
# Interval: how often to check (default 30s)
# Timeout: how long to wait for response (default 30s)
# Start-period: grace period after container start (default 0)
# Retries: consecutive failures before declaring unhealthy (default 3)

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' myapp

# Watch health events
docker events --filter event=health_status

# Health states: starting → healthy | unhealthy
# Docker Swarm automatically reschedules unhealthy tasks
```

```javascript
// Express health endpoint pattern
app.get('/health', (req, res) => {
  // Check critical dependencies
  const dbOk = db.readyState === 1;        // mongoose
  const redisOk = redisClient.isReady;

  if (!dbOk || !redisOk) {
    return res.status(503).json({
      status: 'unhealthy',
      db: dbOk,
      redis: redisOk,
    });
  }

  res.json({ status: 'healthy', uptime: process.uptime() });
});
```

---

## Q5. Graceful shutdown in Node.js

```javascript
// index.js — critical for zero-downtime deployments
const server = app.listen(3000);

async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);

  // Stop accepting new connections
  server.close(async () => {
    try {
      await db.disconnect();         // close DB pool
      await redisClient.quit();      // close Redis
      console.log('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      console.error('Shutdown error:', err);
      process.exit(1);
    }
  });

  // Force exit after timeout if not done
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));  // Docker stop sends SIGTERM
process.on('SIGINT',  () => shutdown('SIGINT'));   // Ctrl+C
```

```dockerfile
# MUST use exec form (array) — shell form does not forward signals
CMD ["node", "dist/index.js"]     # correct — PID 1 receives SIGTERM
CMD node dist/index.js            # WRONG — shell is PID 1, node never gets SIGTERM
```

---

## Q6. docker stats and monitoring

```bash
# Live stats (CPU, memory, net, block I/O)
docker stats
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Prometheus + Grafana (standard production monitoring)
# cAdvisor exposes per-container metrics at :8080/metrics

docker run -d \
  --name cadvisor \
  --volume /var/run:/var/run:ro \
  --volume /sys:/sys:ro \
  --volume /var/lib/docker/:/var/lib/docker:ro \
  --publish 8080:8080 \
  gcr.io/cadvisor/cadvisor:latest
```

```yaml
# Compose monitoring stack
services:
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    volumes:
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker:/var/lib/docker:ro
    ports:
      - "8080:8080"
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - --config.file=/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    restart: unless-stopped
```

---

## Q7. Rolling updates (Docker Swarm)

```bash
# Initialize Swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml myapp

# Update to new image version (rolling — no downtime)
docker service update \
  --image myapp:2.0.0 \
  --update-parallelism 1 \     # update 1 replica at a time
  --update-delay 10s \         # wait 10s between replicas
  --update-failure-action rollback \
  myapp_api

# Rollback if something went wrong
docker service rollback myapp_api

# Scale replicas
docker service scale myapp_api=5
```

---

## Interview Questions

**Q: What happens when a container exceeds its memory limit?**
> The kernel OOM (Out of Memory) killer terminates the container process immediately (SIGKILL — no graceful shutdown). The container exits with error code 137. Set `--memory-reservation` lower than `--memory` as the soft limit for scheduling, and `--memory-swap` equal to `--memory` to disable swap.

**Q: What is the difference between `always` and `unless-stopped` restart policy?**
> Both restart the container on crash and after Docker daemon restart. The difference is when you manually `docker stop myapp`: `unless-stopped` remembers the intentional stop and won't restart after daemon restart; `always` will always restart regardless.

**Q: Why must CMD use exec form in production?**
> Shell form (`CMD node app.js`) is equivalent to `CMD ["/bin/sh", "-c", "node app.js"]`. The shell becomes PID 1 and the Node.js process is a child. When Docker sends SIGTERM (on `docker stop`), the shell ignores it and the Node.js process never receives it — the container is force-killed after the 10-second timeout. Exec form (`CMD ["node", "app.js"]`) makes Node.js PID 1 and it receives signals directly.

**Q: What is the default log driver and what are its production limitations?**
> `json-file` is the default. It stores logs locally in `/var/lib/docker/containers/<id>/`. Production limitations: no max-size limit by default (disk fills up), no central aggregation, lost when container is removed. Production solution: set max-size/max-file rotation, or use a remote driver (awslogs, fluentd, syslog) pointing to a centralized logging system.

**Q: How do you debug a container that keeps crashing on startup?**
> `docker logs <id>` shows stdout/stderr even after container exits. Use `docker inspect <id>` to see exit codes and last health status. Add `sleep infinity` or override CMD temporarily to keep it alive for debugging. Use `--restart no` during debugging to avoid restart loops.

---

<a id="docker-interview-qa"></a>
## 08_interview_qa.md — Q1. What is Docker and how does it differ from a virtual machine?**

# Docker: Interview Q&A (Comprehensive)

## Fundamentals

**Q1. What is Docker and how does it differ from a virtual machine?**
> Docker containers share the host OS kernel; each VMs has its own full OS kernel. Containers start in milliseconds and use far less memory (MBs vs GBs). Isolation: VMs use hardware-level hypervisor isolation (stronger); containers use Linux namespaces + cgroups (weaker, but sufficient for most workloads).

| | Container | VM |
|---|---|---|
| Boot time | ~100ms | 1–60s |
| Size | MBs | GBs |
| OS | Shares host kernel | Own OS |
| Isolation | Namespaces / cgroups | Hypervisor |
| Portability | High | Medium |

---

**Q2. What are Docker layers and how do they work?**
> Every `RUN`, `COPY`, and `ADD` instruction creates an immutable layer cached by content hash. Layers are stacked using a union filesystem (OverlayFS). When building, Docker reuses cached layers until a cache-invalidating change is detected. Images are the sum of all layers; containers add a thin writable layer on top (Copy-on-Write). Layers are shared between images — pulling `node:20-alpine` once lets any image using that base reuse it.

---

**Q3. Explain the Docker build context**
> The build context is the directory (or URL) sent to the Docker daemon at build time. Everything you `COPY` must be in the build context. A large context (e.g., `node_modules`) slows every `docker build`. Use `.dockerignore` to exclude files. The daemon builds the image from the instructions in `Dockerfile` using only what's in the build context.

---

**Q4. What is the difference between CMD and ENTRYPOINT?**
> `ENTRYPOINT` defines the executable; `CMD` provides default arguments. If you pass arguments to `docker run`, they override `CMD` but not `ENTRYPOINT`.

```dockerfile
ENTRYPOINT ["node"]
CMD ["dist/index.js"]       # docker run myapp → node dist/index.js
                            # docker run myapp dist/server.js → node dist/server.js
```

> Use `ENTRYPOINT` for the core command and `CMD` for overridable defaults. Always use exec form (array) so PID 1 receives OS signals.

---

**Q5. What is a multi-stage build and why use it?**
> A Dockerfile with multiple `FROM` statements. Each stage can have different tools. You use `COPY --from=<stage>` to selectively copy artifacts. Benefit: the final image only contains what the app needs to run — no compilers, dev dependencies, or source code. Common result: reducing a Node.js image from 800MB to 150MB.

---

## Networking

**Q6. Explain Docker network drivers**
> - **bridge** (default): isolated virtual switch on the host; containers on same bridge can talk by IP. Default bridge has no DNS; custom bridge resolves by container name.
> - **host**: container shares the host's network stack, no isolation, best performance.
> - **none**: no networking.
> - **overlay**: multi-host networking for Docker Swarm / Kubernetes.
> - **macvlan**: assigns a real MAC address; container appears as physical device on LAN.

---

**Q7. What is the difference between EXPOSE and -p / ports:?**
> `EXPOSE` is metadata only — it documents which port the app listens on but does not publish anything to the host. `-p 8080:3000` (or `ports: "8080:3000"` in compose) actually binds the host port. `-P` publishes all `EXPOSE`d ports to random host ports.

---

**Q8. How do containers on the same compose network communicate?**
> Docker Compose creates a shared network. Containers resolve each other by **service name** as a DNS hostname. `api` service can reach `db` service at `postgresql://db:5432`. This works on custom bridge networks; the default bridge network has no DNS resolution.

---

## Storage

**Q9. What are the three types of Docker storage?**
> 1. **Named volumes** (`docker volume create`): managed by Docker, stored in `/var/lib/docker/volumes/`. Persists beyond container lifecycle. Best for databases.
> 2. **Bind mounts**: map a host directory into the container. Host path must exist. Best for development (live reload) or reading host configuration.
> 3. **tmpfs**: in-memory only. Never written to disk. Ideal for sensitive data (session tokens, temp secrets) that must not persist.

---

**Q10. Why use an anonymous volume for node_modules?**
> During development with a bind mount of your source code, `node_modules` from the host gets mounted over the version the `Dockerfile` installed inside the container. If the host and container OS differ (e.g., macOS + Linux image), native binaries will be incompatible. Declaring an anonymous volume for `/app/node_modules` shadows the bind mount, keeping the container's installed version.

---

## Security

**Q11. What are Linux capabilities in Docker?**
> Linux capabilities split root privileges into fine-grained units (`NET_BIND_SERVICE`, `CHOWN`, `SYS_PTRACE`, etc.). Docker containers run with a reduced set by default. Best practice: `--cap-drop ALL` then `--cap-add` only what's needed. Never use `--privileged` in production — it gives full kernel access.

---

**Q12. How do you prevent secrets from appearing in docker history?**
> - Never use `ENV` or `ARG` for secrets — both appear in `docker history` and `docker inspect`.
> - Use BuildKit `--mount=type=secret`: files are mounted for that `RUN` only, never stored in any layer.
> - Use runtime environment variables (`docker run -e`), Docker Secrets (Swarm), or Kubernetes Secrets for runtime secrets.

---

**Q13. What is a container escape?**
> A vulnerability allowing code inside a container to gain access to the host OS or other containers. Risk factors: `--privileged`, mounted Docker socket (`/var/run/docker.sock`), running as root, vulnerable kernel. Mitigations: run as non-root user, drop capabilities, read-only filesystem, no-new-privileges, keep kernel/runtime patched.

---

## Operations

**Q14. Explain restart policies**
> - `no`: never restart (default).
> - `on-failure[:3]`: restart on non-zero exit code, max 3 times.
> - `always`: restarts always, including after Docker daemon restart.
> - `unless-stopped`: like `always` but respects intentional `docker stop`.
> Production recommendation: `unless-stopped` for stateless apps; `on-failure` for batch jobs.

---

**Q15. How does a rolling update work in Docker Swarm?**
> Swarm updates replicas one batch at a time. `--update-parallelism 1` updates one task, waits `--update-delay 10s`, checks health, then continues. If health check fails: `--update-failure-action rollback` automatically reverts. At any point, old replicas are still serving traffic so there is no downtime.

---

**Q16. Why must CMD use exec form (array) for signal handling?**
> Shell form (`CMD node app.js`) spawns `/bin/sh -c node app.js`. The shell is PID 1 and the app is its child. Docker sends SIGTERM to PID 1 (the shell) on `docker stop`; many shells don't forward it, so the app is eventually SIGKILL'd after the 10s timeout — no graceful shutdown. Exec form (`CMD ["node", "app.js"]`) makes the app PID 1 so it receives SIGTERM directly.

---

**Q17. How do you reduce Docker image size?**
> 1. Use minimal base image (alpine, slim, distroless).
> 2. Multi-stage build — only copy production artifacts.
> 3. `npm ci --only=production` (no devDependencies).
> 4. Combine `RUN` commands to reduce layers.
> 5. Add `.dockerignore` (exclude `node_modules`, `.git`, test files).
> 6. Use `npm cache clean --force` after install in same layer.

---

**Q18. What is the difference between docker stop and docker kill?**
> `docker stop` sends SIGTERM (graceful), then waits 10 seconds (default `--time`), then sends SIGKILL. Allows the app to finish in-flight requests, close DB connections. `docker kill` sends SIGKILL immediately (or any signal with `-s`). Use `docker stop` in production; use `docker kill` only when a container is stuck.

---

**Q19. What is OOM and how do you prevent it?**
> OOM (Out Of Memory): when a container exceeds its `--memory` limit, the Linux OOM killer sends SIGKILL (exit code 137) — no graceful shutdown. Prevention: set `--memory-swap` equal to `--memory` (disables swap), set limits appropriate to the workload, monitor with `docker stats`, and set `--memory-reservation` as a soft limit for the scheduler.

---

**Q20. How do you inspect and debug a running container?**
```bash
docker exec -it <id> sh           # open shell (alpine: sh, debian: bash)
docker logs --follow <id>         # stream logs
docker inspect <id>               # full JSON metadata
docker stats <id>                 # live resource usage
docker top <id>                   # running processes inside container
docker diff <id>                  # filesystem changes since start
docker cp <id>:/app/log.txt .     # copy file out of container
```

---

**Q21. What is Build Cache and when is it invalidated?**
> Docker checks each instruction against its cache. Cache hit = reuse layer (fast); cache miss = rebuild from that point onward. Invalidation triggers:
> - File content changed (COPY/ADD checks file checksums)
> - Instruction text changed (different RUN command)
> - Parent layer invalidated (rebuild propagates)
> - `docker build --no-cache` forces full rebuild
> Best practice: copy `package*.json` and `npm ci` before copying source — source changes don't bust the npm install cache.

---

**Q22. What is the difference between Docker Compose and Docker Swarm?**
> | | Docker Compose | Docker Swarm |
> |---|---|---|
> | Scope | Single host | Multi-host cluster |
> | Scaling | `docker compose up --scale` | `docker service scale` |
> | Rolling updates | Manual | Built-in |
> | Secrets | env files | `docker secret` (encrypted) |
> | Use case | Development, single-server | Production multi-node |
> > Note: For production multi-node orchestration, Kubernetes is now the industry standard over Swarm.

---

**Q23. How does .dockerignore work?**
> It follows `.gitignore` syntax and excludes files/directories from the build context sent to the daemon. This speeds up builds (less data sent) and prevents accidentally including secrets (`.env`), test files, or large directories (`node_modules`, `.git`). A missing `.dockerignore` can expose `.env` if it's in the context and you `COPY . .`.

---

**Q24. What is docker buildx?**
> `buildx` is Docker's CLI build plugin based on BuildKit. Key features over classic builder:
> - Multi-platform builds (`--platform linux/amd64,linux/arm64`)
> - Advanced cache backends (registry, GitHub Actions cache)
> - BuildKit secrets support
> - Concurrent multi-stage builds
> - SSH forwarding (`--mount=type=ssh`)

---

**Q25. Dockerfile ARG vs ENV — key differences?**
> | | ARG | ENV |
> |---|---|---|
> | Available | Build time only (in Dockerfile) | Build time + runtime |
> | Visible in docker inspect | `docker history` shows value | ✅ Yes |
> | Override at build | `--build-arg NAME=value` | Also `--build-arg` with `ARG` → `ENV` |
> | Persists in image | ❌ (after its layer) | ✅ |
> | Suitable for secrets | ❌ (shows in docker history) | ❌ (shows in inspect) |

---

<a id="docker-theory-advanced-qa"></a>
## 09_theory_advanced_qa.md — SECTION 1: BASIC

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

---

