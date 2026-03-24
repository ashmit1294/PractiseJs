# API Design — REST, GraphQL, Rate Limiting & Auth
> Resume Signal: GraphQL + REST APIs, rate limiting, JWT, third-party integrations

---

## STAR Interview Answer

| | |
|---|---|
| **Situation** | A product with a public REST API was being hit by third-party integrations that didn't implement back-off — one bad client caused 100% CPU spikes. The REST API also forced mobile clients to make 4–6 sequential requests per screen because each endpoint returned full resource objects. |
| **Task** | Introduce rate limiting to protect the service from abusive or misconfigured clients, and evaluate GraphQL to allow clients to specify exactly what data they need in a single request. |
| **Action** | Layer 1: Nginx rate limiting by IP (coarse). Layer 2: Token-bucket rate limiting in Node.js middleware per API key — sliding window in Redis, tiered limits per client tier. JWT for stateless auth (access token short-lived + refresh token rotation). Implemented a GraphQL endpoint alongside REST — clients migrated high-cardinality screens (dashboard, reports) to GraphQL while simpler CRUD stayed REST. Added query depth limiting and complexity analysis (graphql-depth-limit + graphql-query-complexity) to prevent nested query abuse. |
| **Result** | Eliminated CPU spike incidents from bad clients. Mobile round-trips reduced from 4–6 to 1 per screen. P95 response time improved by 40% on data-heavy screens. JWT + refresh rotation removed server-side session storage entirely. |

---

## ELI5

**REST** is like a restaurant with a fixed menu: "I'll have the user meal (#GET /users/1)" and you get the whole dish — even parts you didn't want. **GraphQL** is like a custom order: "I'll have the user but only their name and email, and include their last 3 orders." You get exactly what you asked for in one trip.

**Rate limiting** is the bouncer at the door: "you've been here 100 times this minute, wait outside."

---

## REST vs GraphQL — When to Use Which

| | REST | GraphQL |
|--|------|---------|
| Data shape | Fixed by server | Client specifies fields |
| Overfetching | Common (returns full objects) | Eliminated |
| Underfetching | N+1 requests for related data | One request with nested fields |
| Caching | Trivial (HTTP GET cache by URL) | Complex (query varies, POST often) |
| Introspection | No built-in | Schema is self-documenting |
| File uploads | Simple multipart | Awkward with graphql-multipart |
| Best for | Public APIs, simple CRUD, CDN cache layer | Mobile/SPA data-heavy screens, aggregation layer |
| Versioning | `/v1/` → `/v2/` URL or header | Schema evolve with `@deprecated` directive |

---

## REST Best Practices

```javascript
// Express REST structure — resource-centric, method-semantic
router.get('/users',         listUsers);        // 200 + pagination
router.post('/users',        createUser);       // 201 + Location header
router.get('/users/:id',     getUser);          // 200 | 404
router.patch('/users/:id',   updateUser);       // 200 — partial update
router.delete('/users/:id',  deleteUser);       // 204 No Content

// Consistent error shape
function apiError(res, status, code, message) {
  return res.status(status).json({
    error: { code, message, timestamp: new Date().toISOString() }
  });
}
// 404 → apiError(res, 404, 'USER_NOT_FOUND', 'User with id 42 not found')

// Pagination pattern (cursor-based for large sets)
// GET /posts?cursor=eyJpZCI6MTAwfQ&limit=20
async function listPosts(req, res) {
  const { cursor, limit = 20 } = req.query;
  const query = cursor
    ? { _id: { $gt: decodeCursor(cursor) } }
    : {};
  const posts = await Post.find(query).limit(Number(limit) + 1).sort({ _id: 1 });
  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, -1) : posts;
  res.json({
    items,
    pagination: {
      hasMore,
      nextCursor: hasMore ? encodeCursor(items[items.length - 1]._id) : null
    }
  });
}
```

---

## GraphQL — Server Setup + Safety Guards

```javascript
import { ApolloServer } from '@apollo/server';
import { createComplexityLimitRule } from 'graphql-validation-complexity';
import depthLimit from 'graphql-depth-limit';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [
    depthLimit(7),                              // reject queries nested > 7 levels
    createComplexityLimitRule(1000, {           // reject queries with cost > 1000
      scalarCost: 1,
      objectCost: 10,
      listFactor: 20,
    }),
  ],
  formatError: (error) => ({                    // never leak stack traces
    message: error.message,
    code: error.extensions?.code ?? 'INTERNAL_SERVER_ERROR',
  }),
});

// Schema example
const typeDefs = `#graphql
  type Query {
    user(id: ID!): User
    posts(filter: PostFilter, limit: Int = 20, cursor: String): PostConnection
  }

  type User {
    id: ID!
    name: String!
    email: String!
    posts(limit: Int = 5): [Post!]!  # nested — DataLoader batches this
  }

  type Post {
    id: ID!
    title: String!
    author: User!
  }

  type PostConnection {
    items: [Post!]!
    hasMore: Boolean!
    nextCursor: String
  }
`;

// Resolver with DataLoader (N+1 prevention)
const resolvers = {
  User: {
    posts: (user, { limit }, { loaders }) =>
      loaders.postsByAuthor.load({ authorId: user.id, limit }),
  },
  Post: {
    author: (post, _, { loaders }) =>
      loaders.userById.load(post.authorId),   // batched — 1 DB query for N authors
  },
};
```

---

## Rate Limiting

### Token Bucket (allows controlled bursts)

```javascript
// Redis-backed sliding window counter — per API key
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Limits per tier
const TIERS = {
  free:       { rpm: 60,   burst: 10  },
  pro:        { rpm: 600,  burst: 50  },
  enterprise: { rpm: 6000, burst: 200 },
};

async function rateLimitMiddleware(req, res, next) {
  const apiKey  = req.headers['x-api-key'];
  const tier    = req.auth?.tier ?? 'free';
  const { rpm, burst } = TIERS[tier];

  const now     = Date.now();
  const window  = 60_000;                       // 1 minute in ms
  const key     = `ratelimit:${apiKey}`;

  // Sliding window log
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, now - window); // prune old entries
  pipeline.zadd(key, now, `${now}-${Math.random()}`);
  pipeline.zcard(key);                             // count in window
  pipeline.expire(key, 60);                        // key TTL

  const results = await pipeline.exec();
  const count = results[2][1];

  res.set({
    'X-RateLimit-Limit':     rpm,
    'X-RateLimit-Remaining': Math.max(0, rpm - count),
    'X-RateLimit-Reset':     Math.ceil((now + window) / 1000),
  });

  if (count > rpm) {
    return res.status(429).json({
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' }
    });
  }

  next();
}
```

### Rate limiting tiers comparison

| Strategy | Algorithm | Burst allowed | Smoothness | Use case |
|--|--|--|--|--|
| Fixed window | Counter reset per minute | Yes — spike at window boundary | Poor | Simple, low-stakes |
| Sliding window log | Store every request timestamp | Precise | Good | API gateways |
| Token bucket | Tokens replenish at fixed rate | Yes — up to bucket size | Moderate | Most APIs |
| Leaky bucket | Queue that drains at fixed rate | No — strict smooth output | Excellent | Video/audio streams |

---

## JWT Auth — Access + Refresh Token Pattern

```javascript
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Short-lived access token (15 min) — stateless, validated on every request
function issueAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    ACCESS_SECRET,
    { expiresIn: '15m', algorithm: 'HS256' }
  );
}

// Long-lived refresh token (7 days) — stored in DB, rotated on use
async function issueRefreshToken(userId) {
  const token = crypto.randomBytes(40).toString('hex');    // opaque, not JWT
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.refreshTokens.insert({ token, userId, expiresAt });
  return token;
}

// Refresh endpoint — rotate: old token is INVALIDATED, new one issued
async function refreshHandler(req, res) {
  const { refreshToken } = req.cookies;
  const stored = await db.refreshTokens.findOne({ token: refreshToken });

  if (!stored || stored.expiresAt < new Date()) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  // Rotation: delete old, issue new (detects token theft if reuse detected)
  await db.refreshTokens.delete({ token: refreshToken });

  const user        = await db.users.findById(stored.userId);
  const accessToken = issueAccessToken(user);
  const newRefresh  = await issueRefreshToken(user.id);

  res.cookie('refreshToken', newRefresh, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ accessToken });
}

// Auth middleware — validates access token
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).end();
  try {
    req.auth = jwt.verify(header.slice(7), ACCESS_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalid or expired' });
  }
}
```

---

## API Versioning Strategies

| Strategy | Example | Pros | Cons |
|--|--|--|--|
| URL path | `/v1/users`, `/v2/users` | Simple, obvious, cacheable | Clutters URLs |
| Header | `Accept: application/vnd.api+json;version=2` | Clean URLs | Less discoverable |
| Query param | `/users?version=2` | Easy to test | Cache busting issues |
| GraphQL deprecation | `@deprecated(reason: "Use fullName")` | Gradual — no hard cut | Requires client discipline |

---

## Key Interview Q&A

**Q: How did you protect the API from a bad client taking down the service?**
> Two layers: Nginx rate limits at the IP level (coarse, fast), then Redis sliding-window rate limiting per API key in the Node middleware. The per-key limit is tiered — free-tier clients have a 60 req/min ceiling. When a bad client hit the ceiling, they received 429s while all other clients were unaffected.

**Q: Why keep REST alongside GraphQL rather than migrating fully?**
> REST + HTTP caching is still the right tool for simple CRUD and for public endpoints that need CDN caching — a GraphQL POST query can't be cached at the CDN layer without persisted queries. Migrating existing integrations would break partners. So: REST for simple resources and public/cached endpoints, GraphQL for the high-cardinality data screens.

**Q: Why not store JWTs in localStorage?**
> XSS risk — any injected script can read localStorage and exfiltrate the token. Refresh tokens go in `httpOnly; Secure; SameSite=strict` cookies (inaccessible to JavaScript). Access tokens can live in memory (not persisted) since they expire in 15 minutes.

**Q: What's the difference between token bucket and leaky bucket?**
> Token bucket: a bucket holds N tokens, refills at a fixed rate, each request consumes one token. Allows bursting up to bucket size. Leaky bucket: requests enter a queue, drain at a fixed rate — no bursting, output is perfectly smooth. Use leaky bucket when you need strictly even traffic (e.g., outbound API calls to a third-party with a hard rate limit).
