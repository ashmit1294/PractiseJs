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
