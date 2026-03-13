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
