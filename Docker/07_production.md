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
