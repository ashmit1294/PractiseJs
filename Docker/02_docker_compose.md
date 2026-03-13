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
