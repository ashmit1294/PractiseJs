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

> **ELI5:** Layers are like sheets of glass stacked on top of each other. Each sheet is cached and reused. Containers add a wiping cloth on top (Copy-on-Write).
---

**Q3. Explain the Docker build context**
> The build context is the directory (or URL) sent to the Docker daemon at build time. Everything you `COPY` must be in the build context. A large context (e.g., `node_modules`) slows every `docker build`. Use `.dockerignore` to exclude files. The daemon builds the image from the instructions in `Dockerfile` using only what's in the build context.

> **ELI5:** Build context is the suitcase you send to Docker. Don't pack the whole house, just what you need.
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

> **ELI5:** Multi-stage is like building a house, moving out the construction equipment before the new tenants move in.
---

## Networking

**Q6. Explain Docker network drivers**
> - **bridge** (default): isolated virtual switch on the host; containers on same bridge can talk by IP. Default bridge has no DNS; custom bridge resolves by container name.
> - **host**: container shares the host's network stack, no isolation, best performance.
> - **none**: no networking.
> - **overlay**: multi-host networking for Docker Swarm / Kubernetes.
> - **macvlan**: assigns a real MAC address; container appears as physical device on LAN.

> **ELI5:** Bridge is like WiFi (containers on same network). Host is like plugged into the same ethernet (no separation). Overlay is like WiFi across multiple buildings.
---

**Q7. What is the difference between EXPOSE and -p / ports:?**
> `EXPOSE` is metadata only — it documents which port the app listens on but does not publish anything to the host. `-p 8080:3000` (or `ports: "8080:3000"` in compose) actually binds the host port. `-P` publishes all `EXPOSE`d ports to random host ports.

> **ELI5:** EXPOSE is like putting "WiFi password used" on your modem box. Actually using WiFi is like -p binding the port.
---

**Q8. How do containers on the same compose network communicate?**
> Docker Compose creates a shared network. Containers resolve each other by **service name** as a DNS hostname. `api` service can reach `db` service at `postgresql://db:5432`. This works on custom bridge networks; the default bridge network has no DNS resolution.

> **ELI5:** Services in compose are like phones in a company - you can call by name ("call the database") instead of phone number (IP).
---

## Storage

**Q9. What are the three types of Docker storage?**
> 1. **Named volumes** (`docker volume create`): managed by Docker, stored in `/var/lib/docker/volumes/`. Persists beyond container lifecycle. Best for databases.
> 2. **Bind mounts**: map a host directory into the container. Host path must exist. Best for development (live reload) or reading host configuration.
> 3. **tmpfs**: in-memory only. Never written to disk. Ideal for sensitive data (session tokens, temp secrets) that must not persist.

> **ELI5:** Named volume is permanent storage. Bind mount is "share with my computer". tmpfs is sticky notes (disappear on restart).
---

**Q10. Why use an anonymous volume for node_modules?**
> During development with a bind mount of your source code, `node_modules` from the host gets mounted over the version the `Dockerfile` installed inside the container. If the host and container OS differ (e.g., macOS + Linux image), native binaries will be incompatible. Declaring an anonymous volume for `/app/node_modules` shadows the bind mount, keeping the container's installed version.

> **ELI5:** Anonymous volume for node_modules is like keeping your laptop's apps separate from your desktop's apps (different OS)
---

## Security

**Q11. What are Linux capabilities in Docker?**
> Linux capabilities split root privileges into fine-grained units (`NET_BIND_SERVICE`, `CHOWN`, `SYS_PTRACE`, etc.). Docker containers run with a reduced set by default. Best practice: `--cap-drop ALL` then `--cap-add` only what's needed. Never use `--privileged` in production — it gives full kernel access.

> **ELI5:** Capabilities are like permission levels - normal user, sudo user, root. Drop to normal, grant only what you need.
---

**Q12. How do you prevent secrets from appearing in docker history?**
> - Never use `ENV` or `ARG` for secrets — both appear in `docker history` and `docker inspect`.
> - Use BuildKit `--mount=type=secret`: files are mounted for that `RUN` only, never stored in any layer.
> - Use runtime environment variables (`docker run -e`), Docker Secrets (Swarm), or Kubernetes Secrets for runtime secrets.

> **ELI5:** Never put secrets in images (they appear in history forever). Inject at runtime like env variables.
---

**Q13. What is a container escape?**
> A vulnerability allowing code inside a container to gain access to the host OS or other containers. Risk factors: `--privileged`, mounted Docker socket (`/var/run/docker.sock`), running as root, vulnerable kernel. Mitigations: run as non-root user, drop capabilities, read-only filesystem, no-new-privileges, keep kernel/runtime patched.

> **ELI5:** Container escape is a jail break. Prevent it by not giving prisoners admin tools and keeping guards updated.
---

## Operations

**Q14. Explain restart policies**
> - `no`: never restart (default).
> - `on-failure[:3]`: restart on non-zero exit code, max 3 times.
> - `always`: restarts always, including after Docker daemon restart.
> - `unless-stopped`: like `always` but respects intentional `docker stop`.
> Production recommendation: `unless-stopped` for stateless apps; `on-failure` for batch jobs.

> **ELI5:** Restart policy is automatic life support - `always` means always resuscitate, `on-failure` means only if it crashes.
---

**Q15. How does a rolling update work in Docker Swarm?**
> Swarm updates replicas one batch at a time. `--update-parallelism 1` updates one task, waits `--update-delay 10s`, checks health, then continues. If health check fails: `--update-failure-action rollback` automatically reverts. At any point, old replicas are still serving traffic so there is no downtime.

> **ELI5:** Rolling update is like replacing bricks in a wall one at a time without affecting stability (some old bricks still holding it up).
---

**Q16. Why must CMD use exec form (array) for signal handling?**
> Shell form (`CMD node app.js`) spawns `/bin/sh -c node app.js`. The shell is PID 1 and the app is its child. Docker sends SIGTERM to PID 1 (the shell) on `docker stop`; many shells don't forward it, so the app is eventually SIGKILL'd after the 10s timeout — no graceful shutdown. Exec form (`CMD ["node", "app.js"]`) makes the app PID 1 so it receives SIGTERM directly.

> **ELI5:** Shell form is like a middleman (shell) not passing messages. Exec form is direct line (app is PID 1 gets signal direct).
---

**Q17. How do you reduce Docker image size?**
> 1. Use minimal base image (alpine, slim, distroless).
> 2. Multi-stage build — only copy production artifacts.
> 3. `npm ci --only=production` (no devDependencies).
> 4. Combine `RUN` commands to reduce layers.
> 5. Add `.dockerignore` (exclude `node_modules`, `.git`, test files).
> 6. Use `npm cache clean --force` after install in same layer.

> **ELI5:** Image size = base + layers. Like luggage - less stuff, lighter bag. Multi-stage = pack only essentials in final bag.
---

**Q18. What is the difference between docker stop and docker kill?**
> `docker stop` sends SIGTERM (graceful), then waits 10 seconds (default `--time`), then sends SIGKILL. Allows the app to finish in-flight requests, close DB connections. `docker kill` sends SIGKILL immediately (or any signal with `-s`). Use `docker stop` in production; use `docker kill` only when a container is stuck.

> **ELI5:** Stop is polite ("please shut down cleanly"). Kill is terminator ("shutdown NOW").
---

**Q19. What is OOM and how do you prevent it?**
> OOM (Out Of Memory): when a container exceeds its `--memory` limit, the Linux OOM killer sends SIGKILL (exit code 137) — no graceful shutdown. Prevention: set `--memory-swap` equal to `--memory` (disables swap), set limits appropriate to the workload, monitor with `docker stats`, and set `--memory-reservation` as a soft limit for the scheduler.

> **ELI5:** OOM is container getting too fat. Set a diet limit and monitor weight.
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

> **ELI5:** Cache is like "have I seen this recipe before?" If yes, use old result. If ingredients changed, cook again.
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

> **ELI5:** Compose is a local restaurant (one kitchen). Swarm is a chain (multiple locations, central HQ). Kubernetes is like a mega-corporation.
---

**Q23. How does .dockerignore work?**
> It follows `.gitignore` syntax and excludes files/directories from the build context sent to the daemon. This speeds up builds (less data sent) and prevents accidentally including secrets (`.env`), test files, or large directories (`node_modules`, `.git`). A missing `.dockerignore` can expose `.env` if it's in the context and you `COPY . .`.

> **ELI5:** .dockerignore is like telling shipping "don't package the garbage bin with my order".
---

**Q24. What is docker buildx?**
> `buildx` is Docker's CLI build plugin based on BuildKit. Key features over classic builder:
> - Multi-platform builds (`--platform linux/amd64,linux/arm64`)
> - Advanced cache backends (registry, GitHub Actions cache)
> - BuildKit secrets support
> - Concurrent multi-stage builds
> - SSH forwarding (`--mount=type=ssh`)

> **ELI5:** Buildx is the upgraded builder - build for Mac AND Linux in one go, cache smarter.
---

**Q25. Dockerfile ARG vs ENV — key differences?**
> | | ARG | ENV |
> |---|---|---|
> | Available | Build time only (in Dockerfile) | Build time + runtime |
> | Visible in docker inspect | `docker history` shows value | ✅ Yes |
> | Override at build | `--build-arg NAME=value` | Also `--build-arg` with `ARG` → `ENV` |
> | Persists in image | ❌ (after its layer) | ✅ |
> | Suitable for secrets | ❌ (shows in docker history) | ❌ (shows in inspect) |

> **ELI5:** ARG is "tell me once at build" (visible in history). ENV is "tell me always" (visible at runtime). Neither should have secrets.
---

## GitHub Actions — CI/CD with Docker

**Q26. GitHub Actions — CI/CD pipeline, workflows, jobs, steps, secrets**
> GitHub Actions is GitHub's built-in CI/CD platform. Runs workflows triggered by events (push, pull request, schedule, manual).
> 
> **Key Concepts:**
> - **Workflow**: YAML file (`.github/workflows/*.yml`) that defines the entire CI/CD automation
> - **Trigger/Event**: `on: [push, pull_request]` — what causes the workflow to run
> - **Job**: independent execution unit (runs on a runner machine)
> - **Step**: individual command or action within a job
> - **Action**: reusable code unit (from GitHub Marketplace or custom)
> - **Runner**: machine where jobs execute (GitHub-hosted: ubuntu/windows/macos; or self-hosted)
> - **Secret**: encrypted environment variable (passwords, API keys); doesn't leak in logs
> 
> **Workflow Execution Flow:**
> ```mermaid
> graph LR
>     A["Push to main<br/>or PR Created"] -->|Trigger Event| B["Workflow Started"]
>     B --> C["Matrix/Strategy<br/>Setup"]
>     C --> D["Runner Machine<br/>Allocated"]
>     D --> E["Checkout Code"]
>     E --> F["Setup Environment<br/>Node.js/Python/etc"]
>     F --> G["Install Dependencies<br/>npm ci"]
>     G --> H["Run Tests"]
>     H -->|✅ Passed| I["Build Artifact"]
>     H -->|❌ Failed| J["Notify Developer"]
>     I --> K{"Condition Check<br/>github.ref?"}
>     K -->|main branch| L["Deploy Job"]
>     K -->|other| M["Skip Deployment"]
>     L --> N["Configure AWS<br/>Credentials"]
>     N --> O["Build & Push<br/>Docker Image"]
>     O --> P["Deploy to ECS"]
>     P --> Q["All Complete<br/>Send Notification"]
>     J --> Q
>     M --> Q
> ```
> 
> **Workflow Example:**
> ```yaml
> name: CI/CD Pipeline
> 
> on:
>   push:
>     branches: [main, develop]
>   pull_request:
>     branches: [main]
> 
> jobs:
>   test:
>     runs-on: ubuntu-latest
>     steps:
>       - uses: actions/checkout@v3
>       - uses: actions/setup-node@v3
>         with:
>           node-version: '18'
>       - run: npm ci
>       - run: npm test
>       - run: npm run build
> 
>   deploy:
>     needs: test                    # wait for test job to finish
>     if: github.ref == 'refs/heads/main'
>     runs-on: ubuntu-latest
>     steps:
>       - uses: actions/checkout@v3
>       - name: Build and deploy
>         env:
>           API_KEY: ${{ secrets.PROD_API_KEY }}
>         run: |
>           docker build -t myapp:latest .
>           docker push myapp:latest
> ```
> 
> **Secrets Management:**
> 1. Go to GitHub Repo Settings → Secrets and variables → Actions
> 2. Add secret: `PROD_API_KEY = sk_live_...` (encrypted, never shown)
> 3. In workflow: `${{ secrets.PROD_API_KEY }}`
> 4. At runtime: secret injected but NEVER logged (GitHub masks in logs)
> 
> **Common Actions:**
> - `actions/checkout` — clone repo code
> - `actions/setup-node` — install Node.js version
> - `docker/build-push-action` — build and push Docker image to registry
> - `aws-actions/configure-aws-credentials` — authenticate to AWS

> **ELI5:** GitHub Actions is like hiring a robot to run your CI/CD checklist. Actions are tools in the robot's toolbox.

**Q27. GitHub Actions + Docker + ECR + ECS end-to-end deployment**
> ```yaml
> name: Build, Push to ECR, and Deploy to ECS
> 
> on:
>   push:
>     branches: [main]
> 
> jobs:
>   deploy:
>     runs-on: ubuntu-latest
>     steps:
>       - uses: actions/checkout@v3
> 
>       - name: Configure AWS credentials
>         uses: aws-actions/configure-aws-credentials@v2
>         with:
>           role-to-assume: arn:aws:iam::123456789:role/GitHubActionsRole
>           aws-region: us-east-1
> 
>       - name: Login to ECR
>         id: login-ecr
>         uses: aws-actions/amazon-ecr-login@v1
> 
>       - name: Build Docker image
>         run: |
>           docker build -t myapp:${{ github.sha }} .
>           docker tag myapp:${{ github.sha }} ${{ steps.login-ecr.outputs.registry }}/myapp:latest
> 
>       - name: Push to ECR
>         run: |
>           docker push ${{ steps.login-ecr.outputs.registry }}/myapp:latest
> 
>       - name: Update ECS service (forces new deployment)
>         run: |
>           aws ecs update-service \
>             --cluster prod-cluster \
>             --service myapp \
>             --force-new-deployment
> 
>       - name: Wait for ECS service to stabilize
>         run: |
>           aws ecs wait services-stable \
>             --cluster prod-cluster \
>             --services myapp
> ```
> 
> **End-to-End Deployment Pipeline:**
> ```mermaid
> graph TD
>     A["Developer Pushes<br/>to main"] -->|Trigger| B["GitHub Actions<br/>Workflow"]
>     B -->|1. OIDC| C["AWS IAM Role<br/>Assumed<br/>No long-lived keys"]
>     C -->|2. Auth| D["ECR Login<br/>Get credentials"]
>     D -->|3. Build| E["Build Docker Image<br/>Tag: commit-SHA"]
>     E -->|4. Push| F["ECR Registry<br/>Image stored<br/>myapp:latest"]
>     F -->|5. Update| G["ECS Cluster<br/>Update Service"]
>     G -->|6. Deploy| H["Task Definition<br/>New Revision"]
>     H -->|7. Create| I["New ECS Tasks<br/>Pull from ECR"]
>     I -->|8. Rolling Update| J["Old Tasks Drain<br/>New Tasks Start"]
>     J -->|9. Health Check| K["Load Balancer<br/>Routes to<br/>Healthy Tasks"]
>     K -->|10. Monitor| L["CloudWatch<br/>Logs & Metrics"]
>     L -->|✅ Healthy| M["Deployment Complete"]
>     I -->|❌ Unhealthy| N["Rollback<br/>Previous Task Def"]
>     N --> M
> ```
> 
> **Flow:**
> 1. Developer pushes to `main`
> 2. GitHub Actions triggered
> 3. Assume AWS IAM role via OIDC (no long-lived keys needed)
> 4. Build Docker image, tag with commit SHA
> 5. Push to ECR
> 6. Update ECS service → triggers new deployment
> 7. Wait until all tasks are healthy (ready)

> **ELI5:** ECR is just a registry (eBay for images). Update ECS service forces new deployment.
> OIDC is like "I'm GitHub, trust me" (no storing credentials).

---

## Docker Compose for Local Development

**Q28. Docker Compose for complete application stack (dev vs prod)**
> Developers use `docker-compose up` to run the entire application stack locally: app + database + cache + message queue.
> Run once, have everything — no installation manual steps.
> 
> **Service Dependency & Startup Flow:**
> ```mermaid
> graph TB
>     A["docker-compose up"] -->|Resolve| B["Dependency<br/>Analysis"]
>     B --> C["Start cache<br/>Redis:6379"]
>     C -->|no condition| D["cache: running"]
>     B --> E["Start db<br/>PostgreSQL:5432"]
>     E -->|healthcheck| F{"pg_isready?"}
>     F -->|waiting| F
>     F -->|✅ healthy| G["db: healthy"]
>     B --> H["Start app<br/>Build Dockerfile"]
>     H -->|condition:<br/>service_healthy| I["Wait for db<br/>health check"}]
>     I -->|condition:<br/>service_started| J["Wait for cache<br/>running"]
>     J -->|ready| K["App connect:<br/>postgresql://user:password@db:5432/myapp"]
>     K --> L["App connect:<br/>redis://cache:6379"]
>     L --> M["App: running<br/>Port 3000"]
>     
>     subgraph compose["Docker Compose Stack"]
>         D
>         G
>         M
>     end
>     
>     N["Named Volume:<br/>pgdata persistent"] -.-> G
>     O["Bind Mount:<br/>.:/app hot reload"] -.-> M
> ```
> 
> **docker-compose.yml (development):**
> ```yaml
> version: '3.8'
> services:
>   app:
>     build: .
>     ports:
>       - "3000:3000"
>     environment:
>       DATABASE_URL: postgresql://user:password@db:5432/myapp
>       REDIS_URL: redis://cache:6379
>     depends_on:
>       db:
>         condition: service_healthy   # wait for db health check
>       cache:
>         condition: service_started
>     volumes:
>       - .:/app                       # mount source code (live reload)
>       - /app/node_modules            # but not node_modules (keep container's version)
> 
>   db:
>     image: postgres:15
>     environment:
>       POSTGRES_USER: user
>       POSTGRES_PASSWORD: password
>       POSTGRES_DB: myapp
>     volumes:
>       - pgdata:/var/lib/postgresql/data
>     healthcheck:
>       test: ["CMD", "pg_isready"]
>       interval: 10s
>       timeout: 5s
>       retries: 5
> 
>   cache:
>     image: redis:7-alpine
>     ports:
>       - "6379:6379"
> 
> volumes:
>   pgdata:
> ```
> 
> **Key points:**
> - `depends_on` with `condition: service_healthy` ensures services start in order
> - `volumes` mount source code for hot reload during development
> - Named volume `pgdata` persists DB data between `docker-compose down` / `docker-compose up` cycles
> - Service names are DNS hostnames: app connects to `db:5432` (not localhost)
> 
> **CI Pipeline integration (GitHub Actions):**

> **ELI5:** Docker Compose is like a food court where each vendor (service) has a window, and they all coordinate via shared WiFi (network).
> ```yaml
> - name: Run integration tests
>   run: |
>     docker-compose -f docker-compose.test.yml up --abort-on-container-exit
>     # Compose runs app + db + test services, tears down when tests finish
> ```
