/**
 * QUESTION SET: GraphQL — DataLoader & N+1 Problem
 *
 * N+1 Problem: fetching a list of N items where each item triggers
 * an additional query → N+1 total queries.
 *
 * Example: Query 10 posts → 10 separate queries to get each author
 *
 * Solution: DataLoader
 * - Batches multiple individual .load(key) calls into ONE batch query
 * - Caches results within a single request
 */

const DataLoader = require("dataloader");

// ─────────────────────────────────────────────
// Q1. Demonstrating the N+1 problem
// ─────────────────────────────────────────────

// Query:
// { posts { id title author { id name } } }
//
// Without DataLoader execution:
// 1. SELECT * FROM posts          → returns 100 posts
// 2. SELECT * FROM users WHERE id = 1   (for post 1's author)
// 3. SELECT * FROM users WHERE id = 2   (for post 2's author)
// ...
// 101. SELECT * FROM users WHERE id = 100  (for post 100's author)
// Total: 101 queries!

// ─────────────────────────────────────────────
// Q2. DataLoader — batch function
// Receives an ARRAY of keys, returns an ARRAY of values (same order!)
// ─────────────────────────────────────────────

// User batch loader
async function batchLoadUsers(userIds) {
  const db = require("./db");

  // ONE query for all users at once
  const users = await db.users.findAll({
    where: { id: userIds }, // SELECT * FROM users WHERE id IN (1, 2, 3…)
  });

  // CRITICAL: result must be in the SAME ORDER as input keys
  const userMap = new Map(users.map((u) => [u.id, u]));
  return userIds.map((id) => userMap.get(id) ?? null);
}

// Post by author batch loader (1-to-many)
async function batchLoadPostsByAuthor(authorIds) {
  const db = require("./db");
  const posts = await db.posts.findAll({
    where: { authorId: authorIds },
  });

  // Group posts by authorId
  const postsByAuthor = new Map();
  for (const post of posts) {
    const list = postsByAuthor.get(post.authorId) ?? [];
    list.push(post);
    postsByAuthor.set(post.authorId, list);
  }

  return authorIds.map((id) => postsByAuthor.get(id) ?? []);
}

// ─────────────────────────────────────────────
// Q3. Create loaders — must be PER REQUEST for correct caching scope
// ─────────────────────────────────────────────
function createLoaders(db) {
  return {
    // DataLoader automatically:
    // 1. Collects all .load(id) calls in the same tick
    // 2. Calls batchFn([id1, id2, ...]) once
    // 3. Caches results for the request duration
    userById: new DataLoader(batchLoadUsers, {
      cache: true,          // default: true — cache within request
      maxBatchSize: 100,    // don't batch more than 100 at once
    }),

    postsByAuthor: new DataLoader(batchLoadPostsByAuthor),

    // Primed loader — manually seed the cache (avoids future queries)
    // e.g. after fetching a user in Query.user, prime the loader so
    // nested resolvers don't re-fetch it
    primedUsers: (() => {
      const loader = new DataLoader(batchLoadUsers);
      // Pre-populate: loader.prime(key, value)
      return loader;
    })(),
  };
}

// ─────────────────────────────────────────────
// Q4. DataLoader with caching and priming
// ─────────────────────────────────────────────
async function loaderPatterns(loaders) {
  // Single load — will be batched with other loads in same tick
  const user1 = await loaders.userById.load("1");

  // Load many — returns array
  const [user2, user3] = await loaders.userById.loadMany(["2", "3"]);

  // Priming — seed cache manually (avoids redundant batch calls)
  // Useful after a mutation creates a new record
  loaders.userById.prime("4", { id: "4", name: "New User" });

  // Clear a cached entry (e.g. after update)
  loaders.userById.clear("1");

  // Clear entire cache
  loaders.userById.clearAll();
}

// ─────────────────────────────────────────────
// Q5. Custom cache for DataLoader (Redis-backed)
// ─────────────────────────────────────────────
function createRedisCacheMap(redis, ttlSeconds = 60) {
  const prefix = "dl:";
  return {
    get: async (key) => {
      const val = await redis.get(prefix + key);
      return val ? JSON.parse(val) : undefined;
    },
    set: async (key, value) => {
      // DataLoader sets the value as a Promise — we must await it
      const resolved = await value;
      await redis.setex(prefix + key, ttlSeconds, JSON.stringify(resolved));
      return value; // return original promise
    },
    delete: (key) => redis.del(prefix + key),
    clear: () => redis.keys(prefix + "*").then((keys) => keys.forEach((k) => redis.del(k))),
  };
}

// Usage:
// new DataLoader(batchLoadUsers, { cacheMap: createRedisCacheMap(redis) });

// ─────────────────────────────────────────────
// Q6. DataLoader with complex keys (objects as keys)
// ─────────────────────────────────────────────

// Problem: DataLoader uses object reference equality for cache
// Solution: serialize complex keys to strings

const postsByTagLoader = new DataLoader(
  async (keys) => {
    const results = await Promise.all(
      keys.map(({ tag, limit }) =>
        db.posts.find({ where: { tags: { has: tag } }, take: limit })
      )
    );
    return results;
  },
  {
    // Custom cache key function — serialize object to string
    cacheKeyFn: ({ tag, limit }) => `${tag}:${limit}`,
  }
);

// ─────────────────────────────────────────────
// Q7. Resolvers with DataLoader — before vs after comparison
// ─────────────────────────────────────────────

// BEFORE (N+1 problem):
const resolversWithNPlusOne = {
  Post: {
    author: async (post, _, { db }) => {
      return db.users.findById(post.authorId); // separate query per post
    },
  },
};

// AFTER (batched with DataLoader):
const resolversWithDataLoader = {
  Post: {
    author: (post, _, { loaders }) => {
      return loaders.userById.load(post.authorId); // batched!
    },
  },
  User: {
    posts: (user, _, { loaders }) => {
      return loaders.postsByAuthor.load(user.id); // batched!
    },
  },

  // After Query.user resolver, prime the cache to avoid re-fetch in User.posts
  Query: {
    user: async (_, { id }, { db, loaders }) => {
      const user = await db.users.findById(id);
      if (user) loaders.userById.prime(id, user); // seed cache!
      return user;
    },
  },
};

// ─────────────────────────────────────────────
// Q8. Persisted Queries — send query hash instead of full query text
// Reduces network payload, enables server-side query allowlisting
// ─────────────────────────────────────────────
const crypto = require("crypto");

function hashQuery(query) {
  return crypto.createHash("sha256").update(query).digest("hex");
}

// Client stores: { [hash]: queryString }
// Server stores: same map
// On request: client sends { extensions: { persistedQuery: { hash } } }
// Server looks up hash → executes known query → rejects unknown hashes

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the N+1 problem in GraphQL?
  A: When resolving a list of N items, each item trigger an additional
     DB query (1 for list + N for related data = N+1 queries).
     Example: 100 posts, each needing author = 101 queries.

  Q: How does DataLoader solve N+1?
  A: DataLoader collects all .load(key) calls within the same event loop
     tick, then calls the batch function ONCE with all keys combined.
     100 separate load(authorId) calls → 1 query with IN clause.

  Q: What are the two main DataLoader features?
  A: 1. Batching: merges multiple loads into one batch query per tick
     2. Caching: within single request, same key returns cached promise
     Both are enabled by default.

  Q: Why create DataLoaders per-request instead of globally?
  A: Per-request ensures:
     1. Each request sees only its own data (no cross-request cache pollution)
     2. Cleared after request — no stale data served to subsequent requests
     3. Correct batching scope — only batches loads from the SAME request

  Q: What is the critical constraint on the batch function?
  A: The returned array must have the SAME LENGTH and SAME ORDER as the
     input keys array. If a key has no result, return null for that position.
     DataLoader maps results to promises by array index.
*/

module.exports = { createLoaders, batchLoadUsers, batchLoadPostsByAuthor };
