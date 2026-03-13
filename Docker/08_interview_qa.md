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
