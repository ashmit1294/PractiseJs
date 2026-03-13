/**
 * QUESTION SET: Node.js REST API Patterns
 *
 * 1. RESTful routing conventions
 * 2. Input validation with Zod
 * 3. Cursor-based pagination
 * 4. Filter / sort / field selection (sparse fieldsets)
 * 5. Rate limiting
 * 6. API versioning
 * 7. Idempotency keys
 * 8. HATEOAS links
 */

const express = require("express");
const { z } = require("zod");
const crypto = require("crypto");

// ─────────────────────────────────────────────
// Q1. RESTful routing conventions
// ─────────────────────────────────────────────

const router = express.Router();

// Resource: /api/v1/posts
// GET    /posts           → list (paginated)
// POST   /posts           → create
// GET    /posts/:id       → get one
// PUT    /posts/:id       → full replace
// PATCH  /posts/:id       → partial update
// DELETE /posts/:id       → delete

// Nested resources
// GET  /posts/:id/comments     → comments for a post
// POST /posts/:id/comments     → add comment to a post

// ─────────────────────────────────────────────
// Q2. Input validation with Zod
// ─────────────────────────────────────────────

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  content: z.string().min(1).max(10_000),
  tags: z.array(z.string().max(50)).max(10).default([]),
  published: z.boolean().default(false),
});

const UpdatePostSchema = CreatePostSchema.partial(); // all fields optional for PATCH

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields = Object.fromEntries(
        result.error.errors.map((e) => [e.path.join("."), e.message])
      );
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", fields } });
    }
    req.body = result.data; // replace with parsed/coerced data
    next();
  };
}

// Query params validation
const ListPostsQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["createdAt", "updatedAt", "title"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  tags: z.string().optional().transform((v) => v?.split(",").filter(Boolean)),
  fields: z.string().optional().transform((v) => v?.split(",").filter(Boolean)),
});

// ─────────────────────────────────────────────
// Q3. Cursor-based pagination
// Safer than offset pagination for large/changing datasets
// ─────────────────────────────────────────────

// Cursor encodes {id, sortValue} to be opaque to clients
function encodeCursor(id, sortValue) {
  return Buffer.from(JSON.stringify({ id, sortValue })).toString("base64url");
}

function decodeCursor(cursor) {
  return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
}

async function listPosts(db, { cursor, limit, sort, order, tags }) {
  const take = limit + 1; // fetch one extra to determine hasNextPage
  const where = {};

  if (tags?.length) {
    where.tags = { hasSome: tags };
  }

  // Cursor condition — fetch records after the cursor
  if (cursor) {
    const { id, sortValue } = decodeCursor(cursor);
    where[sort] = order === "desc" ? { lt: sortValue } : { gt: sortValue };
    // Tie-breaking by ID when sort values collide
    where.OR = [
      { [sort]: order === "desc" ? { lt: sortValue } : { gt: sortValue } },
      { [sort]: sortValue, id: order === "desc" ? { lt: id } : { gt: id } },
    ];
  }

  const posts = await db.post.findMany({
    where,
    orderBy: [{ [sort]: order }, { id: order }], // secondary sort by id
    take,
  });

  const hasNextPage = posts.length > limit;
  const items = hasNextPage ? posts.slice(0, -1) : posts;

  const nextCursor = hasNextPage
    ? encodeCursor(items[items.length - 1].id, items[items.length - 1][sort])
    : null;

  return {
    items,
    pagination: {
      hasNextPage,
      nextCursor,
      count: items.length,
    },
  };
}

// ─────────────────────────────────────────────
// Q4. Sparse fieldsets — only return requested fields
// GET /posts?fields=id,title,createdAt
// ─────────────────────────────────────────────

function applyFieldFilter(data, fields) {
  if (!fields?.length) return data;
  if (Array.isArray(data)) return data.map((item) => pick(item, fields));
  return pick(data, fields);
}

function pick(obj, keys) {
  return Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));
}

// ─────────────────────────────────────────────
// Q5. In-memory rate limiter (production: use Redis)
// ─────────────────────────────────────────────

class InMemoryRateLimiter {
  #store = new Map();

  constructor(windowMs, max) {
    this.windowMs = windowMs;
    this.max = max;
    // Periodic cleanup to avoid memory growth
    setInterval(() => this.#cleanup(), windowMs).unref();
  }

  middleware() {
    return (req, res, next) => {
      const key = req.ip || req.headers["x-forwarded-for"] || "unknown";
      const now = Date.now();
      const window = Math.floor(now / this.windowMs);
      const storeKey = `${key}:${window}`;

      const count = (this.#store.get(storeKey) || 0) + 1;
      this.#store.set(storeKey, count);

      res.setHeader("X-RateLimit-Limit", this.max);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, this.max - count));
      res.setHeader("X-RateLimit-Reset", (window + 1) * this.windowMs);

      if (count > this.max) {
        return res.status(429).json({ error: "Too many requests" });
      }
      next();
    };
  }

  #cleanup() {
    const now = Date.now();
    for (const [key] of this.#store) {
      const window = parseInt(key.split(":").pop(), 10);
      if (window * this.windowMs < now - this.windowMs) {
        this.#store.delete(key);
      }
    }
  }
}

const apiLimiter = new InMemoryRateLimiter(60_000, 100); // 100 req/min

// ─────────────────────────────────────────────
// Q6. API versioning strategies
// ─────────────────────────────────────────────

// Strategy 1: URL prefix (most common)
// /api/v1/posts
// /api/v2/posts

// Express implementation
function mountVersionedRoutes(app) {
  const v1router = express.Router();
  const v2router = express.Router();

  // v1 routes
  v1router.get("/posts", listPostsV1);

  // v2 routes — different response shape
  v2router.get("/posts", listPostsV2);

  app.use("/api/v1", v1router);
  app.use("/api/v2", v2router);
}

// Strategy 2: Accept header versioning
// Accept: application/json; version=2
function versionFromHeader(req) {
  const accept = req.headers.accept || "";
  const match = accept.match(/version=(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

async function listPostsV1(req, res) { res.json({ posts: [] }); }
async function listPostsV2(req, res) { res.json({ data: [], meta: {} }); }

// ─────────────────────────────────────────────
// Q7. Idempotency keys — safe to retry POST requests
// ─────────────────────────────────────────────

function idempotencyMiddleware(cache) {
  return async (req, res, next) => {
    if (req.method !== "POST") return next();

    const key = req.headers["idempotency-key"];
    if (!key) return next(); // optional — only apply when header provided

    // Check if we've seen this key before
    const cached = await cache.get(`idempotency:${key}`);
    if (cached) {
      const { statusCode, body } = JSON.parse(cached);
      return res.status(statusCode).json(body);
    }

    // Intercept response to cache it
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      // Cache for 24h — prevents duplicate operations on retry
      cache.setEx(`idempotency:${key}`, 86400, JSON.stringify({ statusCode: res.statusCode, body }));
      return originalJson(body);
    };

    next();
  };
}

// ─────────────────────────────────────────────
// Q8. HATEOAS — hypermedia links in responses
// Clients can discover available actions from the response
// ─────────────────────────────────────────────

function addLinks(post, baseUrl) {
  return {
    ...post,
    _links: {
      self: { href: `${baseUrl}/posts/${post.id}`, method: "GET" },
      update: { href: `${baseUrl}/posts/${post.id}`, method: "PATCH" },
      delete: { href: `${baseUrl}/posts/${post.id}`, method: "DELETE" },
      comments: { href: `${baseUrl}/posts/${post.id}/comments`, method: "GET" },
      author: { href: `${baseUrl}/users/${post.authorId}`, method: "GET" },
    },
  };
}

// Full POST route example
router.post(
  "/posts",
  apiLimiter.middleware(),
  validate(CreatePostSchema),
  async (req, res, next) => {
    try {
      const post = await createPost(req.body, req.user);
      res.status(201).json(addLinks(post, req.baseUrl));
    } catch (err) {
      next(err);
    }
  }
);

router.get("/posts", async (req, res, next) => {
  try {
    const query = ListPostsQuery.parse(req.query);
    const result = await listPosts(db, query);
    res.json({
      data: applyFieldFilter(result.items, query.fields),
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
});

/*
  INTERVIEW QUESTIONS — THEORY

  Q: Offset vs cursor pagination — when to use which?
  A: Offset (LIMIT 20 OFFSET 40):
       Simple, allows jumping to any page.
       Inconsistent if rows are inserted/deleted during iteration (items skip or repeat).
       Slow for large offsets (DB must scan all rows up to offset).
  
     Cursor (WHERE id > ? LIMIT 20):
       Consistent — new rows don't affect the cursor window.
       Fast — uses an index on the cursor column.
       Does not support random page access ("jump to page 5").
     Use cursor for large/live feeds; offset for small stable datasets.

  Q: What is the difference between PUT and PATCH?
  A: PUT replaces the entire resource with the provided payload.
     Omitting a field means it's set to null/default.
     PATCH applies a partial update — only provided fields are updated.
     Use PATCH for partial updates to avoid accidentally nulling fields.

  Q: How do you handle 422 vs 400?
  A: 400 Bad Request: malformed syntax, unparseable JSON.
     422 Unprocessable Entity: syntactically valid but semantically invalid
     (e.g., email field has valid format but that email already exists).
     Many APIs use 400 for both — the distinction matters mainly in formal REST APIs.

  Q: How do idempotency keys prevent double charges?
  A: Client generates a unique key (UUID) per logical operation.
     Includes it in the Idempotency-Key header on each request.
     Server caches the response against that key (Redis, 24h).
     On retry (network fail), server returns cached response instead of re-executing.
     Guarantees the operation executes exactly once.

  Q: What is HATEOAS and why is it rarely used in practice?
  A: Hypermedia As The Engine Of Application State: responses contain
     links to available actions. Clients need not hard-code URLs.
     In practice it increases response payload size and complexity.
     Most real-world APIs use documented URLs rather than discovered links.
     Useful in public APIs where clients should be decoupled from URL structure.

  Q: How do you design an API for backward compatibility?
  A: Never remove or rename fields — add new fields instead.
     Version breaking changes (v2).
     Use API deprecation headers: Deprecation, Sunset.
     Maintain old versions long enough for clients to migrate.
     Expand/Contract pattern: add new format alongside old, migrate clients, remove old.
*/

async function createPost(data, user) { return { id: "1", ...data, authorId: user?.id }; }
const db = {};
const cache = { get: async () => null, setEx: async () => {} };

module.exports = { InMemoryRateLimiter, applyFieldFilter, encodeCursor, decodeCursor, listPosts };
