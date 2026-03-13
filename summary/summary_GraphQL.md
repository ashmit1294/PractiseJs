# GraphQL — Interview Revision Summary

> **Target:** 7+ year Full Stack MERN Developer | **Files:** 9

## Table of Contents

1. [01_schema_types_SDL.js — QUESTION SET: GraphQL — Schema Definition Language (SDL)](#01_schema_types_sdljs-question-set-graphql-schema-definition-language-sdl)
2. [02_resolvers_context.js — QUESTION SET: GraphQL Resolvers, Context & Middleware](#02_resolvers_contextjs-question-set-graphql-resolvers-context-middleware)
3. [03_dataloader_n_plus_1.js — QUESTION SET: GraphQL — DataLoader & N+1 Problem](#03_dataloader_n_plus_1js-question-set-graphql-dataloader-n1-problem)
4. [04_mutations_subscriptions.js — QUESTION SET: GraphQL Mutations & Subscriptions](#04_mutations_subscriptionsjs-question-set-graphql-mutations-subscriptions)
5. [05_apollo_client.jsx — QUESTION SET: Apollo Client — Queries, Mutations & Cache](#05_apollo_clientjsx-question-set-apollo-client-queries-mutations-cache)
6. [06_security_error_handling.js — QUESTION SET: GraphQL Security, Error Handling & Performance](#06_security_error_handlingjs-question-set-graphql-security-error-handling-performance)
7. [07_federation_stitching.js — QUESTION SET: GraphQL Federation & Schema Stitching](#07_federation_stitchingjs-question-set-graphql-federation-schema-stitching)
8. [08_interview_qa_patterns.js — QUESTION SET: GraphQL — Interview Questions & Advanced Patterns](#08_interview_qa_patternsjs-question-set-graphql-interview-questions-advanced-patterns)
9. [FILE: 09_theory_interview_qa.js](#file-09_theory_interview_qajs)

---

<a id="graphql-schema-types-sdl"></a>
## 01_schema_types_SDL.js — QUESTION SET: GraphQL — Schema Definition Language (SDL)

/**
 * QUESTION SET: GraphQL — Schema Definition Language (SDL)
 *
 * GraphQL is a query language for APIs and a runtime for executing those queries.
 * Client asks for EXACTLY what it needs — no over-fetching, no under-fetching.
 *
 * Core concepts:
 * - Schema: contract between client and server (defines types & operations)
 * - Query: read data
 * - Mutation: write/update data
 * - Subscription: real-time data via WebSocket
 * - Resolver: function that returns data for a field
 */

const { gql } = require("graphql-tag");
// or: const { buildSchema } = require('graphql');

// ─────────────────────────────────────────────
// Q1. Scalar types in GraphQL
// Built-in: Int, Float, String, Boolean, ID
// Custom: Date, JSON, URL, Email, etc.
// ─────────────────────────────────────────────
const typeDefs = gql`
  # Custom scalars
  scalar Date
  scalar JSON
  scalar Upload

  # Enum
  enum UserRole {
    ADMIN
    EDITOR
    VIEWER
  }

  enum PostStatus {
    DRAFT
    PUBLISHED
    ARCHIVED
  }

  # Object types
  type User {
    id: ID!               # ! = non-nullable, required
    name: String!
    email: String!
    role: UserRole!
    createdAt: Date!
    posts: [Post!]!       # non-null array of non-null Posts
    friends: [User!]      # nullable array (user may have no friends)
    profile: Profile      # nullable field
  }

  type Profile {
    bio: String
    avatarUrl: String
    website: String
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    status: PostStatus!
    tags: [String!]!
    author: User!
    comments: [Comment!]!
    likeCount: Int!
    createdAt: Date!
    updatedAt: Date!
  }

  type Comment {
    id: ID!
    body: String!
    author: User!
    post: Post!
    createdAt: Date!
  }

  # ─────────────────────────────────────────────
  # Interface — shared fields across types
  # ─────────────────────────────────────────────
  interface Node {
    id: ID!
    createdAt: Date!
  }

  interface SearchResult {
    id: ID!
    title: String!
  }

  type Article implements Node & SearchResult {
    id: ID!
    title: String!
    body: String!
    createdAt: Date!
  }

  type Product implements Node & SearchResult {
    id: ID!
    title: String!
    price: Float!
    createdAt: Date!
  }

  # ─────────────────────────────────────────────
  # Union — field can be one of several types (no shared fields)
  # ─────────────────────────────────────────────
  union FeedItem = Post | Article | Product

  # ─────────────────────────────────────────────
  # Input types — for mutations/queries with complex args
  # Cannot use regular Object types as input (they may have resolvers)
  # ─────────────────────────────────────────────
  input CreateUserInput {
    name: String!
    email: String!
    password: String!
    role: UserRole = VIEWER  # default value
  }

  input UpdateUserInput {
    name: String
    email: String
    role: UserRole
    profile: UpdateProfileInput
  }

  input UpdateProfileInput {
    bio: String
    website: String
  }

  input PaginationInput {
    page: Int = 1
    limit: Int = 20
  }

  input PostFilterInput {
    status: PostStatus
    authorId: ID
    tags: [String!]
    searchTerm: String
  }

  # ─────────────────────────────────────────────
  # Pagination types — Cursor-based (Relay spec) vs Offset-based
  # ─────────────────────────────────────────────
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
    totalCount: Int!
  }

  type UserEdge {
    cursor: String!
    node: User!
  }

  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
  }

  # ─────────────────────────────────────────────
  # Root types
  # ─────────────────────────────────────────────
  type Query {
    # Single resource
    user(id: ID!): User
    me: User

    # Collection with filtering & pagination
    users(filter: String, pagination: PaginationInput): UserConnection!

    # Search returning union
    search(query: String!, limit: Int = 10): [SearchResult!]!
    feed(pagination: PaginationInput): [FeedItem!]!

    posts(filter: PostFilterInput, pagination: PaginationInput): [Post!]!
    post(id: ID!): Post
  }

  type Mutation {
    # Auth
    register(input: CreateUserInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    logout: Boolean!
    refreshToken(token: String!): AuthPayload!

    # User CRUD
    updateUser(id: ID!, input: UpdateUserInput!): User!
    deleteUser(id: ID!): Boolean!
    uploadAvatar(file: Upload!): String!  # returns URL

    # Post CRUD
    createPost(title: String!, content: String!, tags: [String!]): Post!
    updatePost(id: ID!, title: String, content: String, status: PostStatus): Post!
    deletePost(id: ID!): Boolean!
    likePost(id: ID!): Post!
  }

  type Subscription {
    postCreated: Post!
    postUpdated(id: ID!): Post!
    commentAdded(postId: ID!): Comment!
    userOnline: User!
  }

  type AuthPayload {
    token: String!
    refreshToken: String!
    user: User!
    expiresAt: Date!
  }
`;

// ─────────────────────────────────────────────
// Q2. Schema stitching — combine multiple schemas
// ─────────────────────────────────────────────
const { mergeTypeDefs, mergeResolvers } = require("@graphql-tools/merge");

const userTypeDefs = gql`
  type Query { user(id: ID!): User }
  type User  { id: ID! name: String! }
`;

const postTypeDefs = gql`
  type Query { post(id: ID!): Post }
  type Post  { id: ID! title: String! authorId: ID! }
  extend type User { posts: [Post!]! }  # extend across schemas
`;

const mergedTypeDefs = mergeTypeDefs([userTypeDefs, postTypeDefs]);

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the difference between type and input in GraphQL?
  A: "type" defines output types (what the server returns).
     "input" defines input types (what the client sends in arguments).
     You cannot use output types as mutation arguments because they
     may have computed fields/resolvers.

  Q: What does ! mean in GraphQL types?
  A: Non-nullable. The resolver MUST return a value (never null).
     [Post!]!  → non-nullable array of non-nullable Posts
     [Post]    → nullable array of nullable Posts (most permissive)
     [Post!]   → nullable array, but each element if present is non-null

  Q: What is the difference between interface and union?
  A: Interface: all implementing types SHARE defined fields.
               Used for polymorphism with common structure.
     Union: member types can be completely different, NO shared fields.
            Used when types are unrelated (search results, feed items).

  Q: How does GraphQL prevent over-fetching?
  A: The client specifies exactly which fields it needs in the query.
     The server returns ONLY those fields. No extra data is sent.

  Q: What is the N fields problem with ! (non-null)?
  A: If a non-nullable field resolver throws, the error propagates UP to
     the nearest nullable parent — potentially nulling out large parts of
     the response. Prefer nullable fields for non-critical data.
*/

module.exports = { typeDefs };

---

<a id="graphql-resolvers-context"></a>
## 02_resolvers_context.js — QUESTION SET: GraphQL Resolvers, Context & Middleware

/**
 * QUESTION SET: GraphQL Resolvers, Context & Middleware
 *
 * Resolver: function that returns the data for a field
 * Signature: (parent, args, context, info) => value
 *
 * parent  → result of the parent resolver (for nested fields)
 * args    → field arguments from the query
 * context → shared per-request data (user, db, loaders)
 * info    → execution metadata (field name, AST, path, schema)
 */

const { UserInputError, AuthenticationError, ForbiddenError } = require("apollo-server-express");

// ─────────────────────────────────────────────
// Q1. Basic resolvers structure
// ─────────────────────────────────────────────
const resolvers = {
  // Root resolvers
  Query: {
    // user(id: ID!): User
    user: async (_, { id }, { db, user: currentUser }) => {
      if (!currentUser) throw new AuthenticationError("Must be logged in");
      return db.users.findById(id);
    },

    me: async (_, __, { user }) => {
      if (!user) throw new AuthenticationError("Not authenticated");
      return user;
    },

    users: async (_, { filter, pagination = {} }, { db }) => {
      const { page = 1, limit = 20 } = pagination;
      const offset = (page - 1) * limit;
      const [rows, total] = await db.users.findAndCount({
        where: filter ? { name: { contains: filter } } : {},
        take: limit,
        skip: offset,
      });

      // Build Relay-style connection
      return {
        edges: rows.map((node, i) => ({
          cursor: Buffer.from(String(offset + i)).toString("base64"),
          node,
        })),
        pageInfo: {
          hasNextPage: offset + rows.length < total,
          hasPreviousPage: page > 1,
          startCursor: rows.length ? Buffer.from(String(offset)).toString("base64") : null,
          endCursor: rows.length ? Buffer.from(String(offset + rows.length - 1)).toString("base64") : null,
          totalCount: total,
        },
      };
    },

    posts: async (_, { filter = {}, pagination = {} }, { db }) => {
      return db.posts.find({ where: filter, ...pagination });
    },
  },

  Mutation: {
    register: async (_, { input }, { db, jwt }) => {
      const { name, email, password, role } = input;

      // Check uniqueness
      const existing = await db.users.findOne({ where: { email } });
      if (existing) {
        throw new UserInputError("Email already in use", {
          invalidArgs: ["email"],
        });
      }

      const bcrypt = require("bcrypt");
      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await db.users.create({ name, email, password: hashedPassword, role });

      const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
      const refreshToken = jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });

      return { token, refreshToken, user, expiresAt: new Date(Date.now() + 3600000) };
    },

    createPost: async (_, { title, content, tags }, { db, user }) => {
      if (!user) throw new AuthenticationError("Must be logged in");
      return db.posts.create({ title, content, tags: tags ?? [], authorId: user.id });
    },

    updatePost: async (_, { id, ...fields }, { db, user }) => {
      if (!user) throw new AuthenticationError("Must be logged in");

      const post = await db.posts.findById(id);
      if (!post) throw new UserInputError("Post not found");
      if (post.authorId !== user.id && user.role !== "ADMIN") {
        throw new ForbiddenError("Not authorized to edit this post");
      }

      return db.posts.update(id, fields);
    },
  },

  Subscription: {
    postCreated: {
      // pubsub.asyncIterator returns an async iterable
      subscribe: (_, __, { pubsub, user }) => {
        if (!user) throw new AuthenticationError("Must be logged in");
        return pubsub.asyncIterator(["POST_CREATED"]);
      },
    },
    commentAdded: {
      subscribe: (_, { postId }, { pubsub }) =>
        pubsub.asyncIterator([`COMMENT_ADDED_${postId}`]),
    },
  },

  // ─────────────────────────────────────────────
  // Q2. Type resolvers — resolve nested/related fields
  // Called when a query requests this field on the parent type
  // ─────────────────────────────────────────────
  User: {
    // Automatically resolves if User has a `posts` property,
    // but explicit resolver allows custom loading:
    posts: async (parent, _, { db, loaders }) => {
      // parent = User object from Query.user resolver
      return loaders.postsByAuthor.load(parent.id); // batched via DataLoader
    },

    friends: async (parent, _, { loaders }) => {
      return loaders.friendsByUser.load(parent.id);
    },
  },

  Post: {
    author: async (parent, _, { loaders }) => {
      return loaders.userById.load(parent.authorId); // DataLoader avoids N+1
    },

    comments: async (parent, _, { db }) => {
      return db.comments.find({ where: { postId: parent.id } });
    },

    likeCount: async (parent, _, { db }) => {
      return db.likes.count({ where: { postId: parent.id } });
    },
  },

  // ─────────────────────────────────────────────
  // Q3. Interface / Union resolvers
  // __resolveType tells GraphQL which concrete type to use
  // ─────────────────────────────────────────────
  SearchResult: {
    __resolveType(obj) {
      if (obj.price !== undefined) return "Product";
      if (obj.body !== undefined) return "Article";
      return null;
    },
  },

  FeedItem: {
    __resolveType(obj) {
      if (obj.price !== undefined) return "Product";
      if (obj.content !== undefined) return "Post";
      return "Article";
    },
  },

  // ─────────────────────────────────────────────
  // Q4. Custom scalar resolvers
  // ─────────────────────────────────────────────
  Date: {
    serialize: (value) => new Date(value).toISOString(),    // JS → client
    parseValue: (value) => new Date(value),                  // client arg → JS
    parseLiteral: (ast) => new Date(ast.value),             // inline literal
  },

  JSON: {
    serialize: (value) => value,
    parseValue: (value) => value,
    parseLiteral: (ast) => JSON.parse(ast.value),
  },
};

// ─────────────────────────────────────────────
// Q5. Context factory — called once per request
// Provides shared dependencies to all resolvers
// ─────────────────────────────────────────────
const createContext = async ({ req }) => {
  const jwt   = require("jsonwebtoken");
  const db    = require("./db");
  const pubsub = require("./pubsub");

  let user = null;
  const authHeader = req?.headers?.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await db.users.findById(decoded.userId);
    } catch {
      // Invalid token — user stays null (resolvers throw AuthError if needed)
    }
  }

  // DataLoaders must be created PER REQUEST (not globally)
  // to correctly scope the batching window
  const { createLoaders } = require("./loaders");

  return { db, pubsub, user, jwt, loaders: createLoaders(db) };
};

// ─────────────────────────────────────────────
// Q6. Resolver middleware — wrap resolvers for cross-cutting concerns
// (graphql-middleware / graphql-shield pattern)
// ─────────────────────────────────────────────
const { applyMiddleware } = require("graphql-middleware");
const { shield, rule, and, or } = require("graphql-shield");

const isAuthenticated = rule({ cache: "contextual" })(async (_, __, ctx) => {
  return Boolean(ctx.user) || new AuthenticationError("Not authenticated");
});

const isAdmin = rule({ cache: "contextual" })(async (_, __, ctx) => {
  return ctx.user?.role === "ADMIN" || new ForbiddenError("Admins only");
});

const isPostAuthor = rule({ cache: "strict" })(async (_, { id }, ctx) => {
  const post = await ctx.db.posts.findById(id);
  return post?.authorId === ctx.user?.id || new ForbiddenError("Not your post");
});

const permissions = shield({
  Query: {
    me: isAuthenticated,
    users: isAuthenticated,
  },
  Mutation: {
    createPost: isAuthenticated,
    updatePost: and(isAuthenticated, or(isAdmin, isPostAuthor)),
    deletePost: and(isAuthenticated, or(isAdmin, isPostAuthor)),
    deleteUser: isAdmin,
  },
});

// Apply permissions as middleware layer
// const schemaWithMiddleware = applyMiddleware(schema, permissions);

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What are the 4 resolver arguments?
  A: (parent, args, context, info)
     parent  → value from the parent resolver field
     args    → arguments passed to this field in the query
     context → shared per-request object (user, db, loaders)
     info    → execution info (field name, return type, path, AST fragments)

  Q: Why must DataLoaders be created per-request?
  A: DataLoader batches all load() calls within the same "tick".
     If shared globally, one request's data might be returned to another.
     Per-request ensures isolation and correct batching window.

  Q: What is __resolveType and when is it needed?
  A: For Union and Interface types, GraphQL needs to know the concrete type
     at runtime. __resolveType returns the type name as a string.
     Without it, GraphQL cannot execute inline fragments correctly.

  Q: How does context differ from per-field arguments?
  A: Arguments are query-specific (user passes them).
     Context is request-level shared state (auth user, db connection, loaders).
     Use context for authentication, DataLoaders, and services.

  Q: What is resolver chaining?
  A: Parent resolvers run first, then child field resolvers run with
     parent's return value as their first argument. This builds up
     the nested response object piece by piece.
*/

module.exports = { resolvers, createContext };

---

<a id="graphql-dataloader-n-plus-1"></a>
## 03_dataloader_n_plus_1.js — QUESTION SET: GraphQL — DataLoader & N+1 Problem

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

---

<a id="graphql-mutations-subscriptions"></a>
## 04_mutations_subscriptions.js — QUESTION SET: GraphQL Mutations & Subscriptions

/**
 * QUESTION SET: GraphQL Mutations & Subscriptions
 *
 * Mutations: modify server-side data (CREATE, UPDATE, DELETE)
 * Subscriptions: real-time event streams over WebSocket (or SSE)
 *
 * Apollo Server uses PubSub for subscriptions (in-memory for dev,
 * Redis PubSub for production multi-instance deployments)
 */

const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/lib/use/ws");
const { PubSub, withFilter } = require("graphql-subscriptions");
const { RedisPubSub } = require("graphql-redis-subscriptions");
const Redis = require("ioredis");

// In-memory PubSub (dev only — doesn't scale to multiple Node processes)
const pubsub = new PubSub();

// Redis PubSub (production — works with multiple server instances)
const redisPubSub = new RedisPubSub({
  publisher:  new Redis({ host: process.env.REDIS_HOST }),
  subscriber: new Redis({ host: process.env.REDIS_HOST }),
});

// ─────────────────────────────────────────────
// Q1. Mutation resolvers — best practices
// ─────────────────────────────────────────────
const mutationResolvers = {
  Mutation: {
    // Return the created/updated object — client gets fresh data
    createPost: async (_, { title, content, tags }, { db, user, pubsub }) => {
      if (!user) throw new Error("Not authenticated");

      const post = await db.posts.create({
        title,
        content,
        tags: tags ?? [],
        authorId: user.id,
        status: "DRAFT",
        likeCount: 0,
      });

      // Publish event so subscribers receive it
      await pubsub.publish("POST_CREATED", { postCreated: post });

      return post;
    },

    likePost: async (_, { id }, { db, user, pubsub }) => {
      if (!user) throw new Error("Not authenticated");

      // Atomic increment to prevent race conditions
      const post = await db.posts.increment(id, "likeCount");

      await pubsub.publish("POST_UPDATED", {
        postUpdated: post,
        postId: post.id,
      });

      return post;
    },

    // Batch mutation — create multiple items
    createManyPosts: async (_, { inputs }, { db, user, pubsub }) => {
      if (!user) throw new Error("Not authenticated");

      // Validate all before inserting any
      for (const input of inputs) {
        if (!input.title?.trim()) {
          throw new Error(`Invalid title for post: ${JSON.stringify(input)}`);
        }
      }

      const posts = await db.posts.bulkCreate(
        inputs.map((i) => ({ ...i, authorId: user.id }))
      );

      // Publish all events
      await Promise.all(posts.map((p) =>
        pubsub.publish("POST_CREATED", { postCreated: p })
      ));

      return posts;
    },

    // File upload mutation
    uploadAvatar: async (_, { file }, { db, user, storage }) => {
      if (!user) throw new Error("Not authenticated");

      const { createReadStream, filename, mimetype } = await file;

      if (!mimetype.startsWith("image/")) {
        throw new Error("Only images allowed");
      }

      const stream = createReadStream();
      const url = await storage.upload(stream, {
        filename: `avatars/${user.id}-${Date.now()}`,
        contentType: mimetype,
      });

      await db.users.update(user.id, { avatarUrl: url });
      return url;
    },
  },
};

// ─────────────────────────────────────────────
// Q2. Subscription resolvers
// subscribe: returns an async iterator (event source)
// resolve: optional transform before sending to client
// ─────────────────────────────────────────────
const subscriptionResolvers = {
  Subscription: {
    // Basic subscription — all clients receive postCreated events
    postCreated: {
      subscribe: () => pubsub.asyncIterator(["POST_CREATED"]),
      // resolve is optional here (payload matches field name)
    },

    // Filtered subscription — client only gets updates for a specific post
    postUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(["POST_UPDATED"]),
        // Filter: only forward to clients subscribed to this postId
        (payload, variables) => payload.postId === variables.id
      ),
      resolve: (payload) => payload.postUpdated,
    },

    // Comment added — filtered by postId
    commentAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(["COMMENT_ADDED"]),
        (payload, variables) => payload.commentAdded.postId === variables.postId
      ),
    },

    // User online status — with authentication check
    userOnline: {
      subscribe: (_, __, { user }) => {
        if (!user) throw new Error("Must be authenticated for live updates");
        return pubsub.asyncIterator(["USER_STATUS"]);
      },
    },
  },
};

// ─────────────────────────────────────────────
// Q3. Apollo Server setup with subscriptions
// ─────────────────────────────────────────────
async function startServer() {
  const express = require("express");
  const http    = require("http");
  const cors    = require("cors");

  const { typeDefs } = require("./01_schema_types_SDL");
  const { resolvers } = require("./02_resolvers_context");

  const app = express();
  const httpServer = http.createServer(app);

  // WebSocket server for subscriptions
  const wsServer = new WebSocketServer({ server: httpServer, path: "/graphql" });

  const schema = makeExecutableSchema({ typeDefs, resolvers: [resolvers, subscriptionResolvers, mutationResolvers] });

  // GraphQL over WebSocket — cleanup function returned
  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx) => {
        // ctx.connectionParams contains auth token sent during WS handshake
        const token = ctx.connectionParams?.authorization;
        let user = null;
        if (token) {
          const jwt = require("jsonwebtoken");
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            user = await db.users.findById(decoded.userId);
          } catch { /* invalid token */ }
        }
        return { user, pubsub };
      },
    },
    wsServer
  );

  const server = new ApolloServer({
    schema,
    plugins: [
      // Graceful shutdown
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();

  app.use(
    "/graphql",
    cors(),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const { createContext } = require("./02_resolvers_context");
        return createContext({ req });
      },
    })
  );

  await new Promise((resolve) => httpServer.listen(4000, resolve));
  console.log("🚀 GraphQL ready at http://localhost:4000/graphql");
}

// ─────────────────────────────────────────────
// Q4. Optimistic mutations on the client side
// (Apollo Client — within React apps)
// ─────────────────────────────────────────────
// const client = useApolloClient();
//
// client.mutate({
//   mutation: LIKE_POST,
//   variables: { id: postId },
//   // Optimistic response updates cache BEFORE server responds
//   optimisticResponse: {
//     likePost: {
//       __typename: "Post",
//       id: postId,
//       likeCount: currentLikeCount + 1,
//     },
//   },
// });

// ─────────────────────────────────────────────
// Q5. Triggering subscriptions from REST endpoints
// (hybrid API — GraphQL + REST notify same subscription channel)
// ─────────────────────────────────────────────
function createRestNotifier(pubsub) {
  return {
    notifyPostCreated: (post) => pubsub.publish("POST_CREATED", { postCreated: post }),
    notifyCommentAdded: (comment) => pubsub.publish("COMMENT_ADDED", { commentAdded: comment }),
  };
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the difference between a Query, Mutation, and Subscription?
  A: Query: read-only data fetch (HTTP GET semantics, may be cached)
     Mutation: data modification — write side effects (HTTP POST semantics)
     Subscription: long-lived real-time event stream over WebSocket

  Q: Why is PubSub in-memory not suitable for production?
  A: In-memory PubSub only works within a single Node.js process.
     With multiple server instances (horizontal scaling), a publish on
     server A won't notify subscribers connected to server B.
     Redis PubSub broadcasts across all instances.

  Q: What is withFilter in subscriptions?
  A: withFilter wraps an async iterator and adds a filter predicate.
     Only events for which the predicate returns true are forwarded
     to the subscribing client. Prevents clients receiving irrelevant events.

  Q: How does optimistic mutation work in Apollo Client?
  A: Provide an optimisticResponse that mirrors the expected mutation result.
     Apollo writes it to the cache immediately, updating the UI.
     When the real server response arrives, it overwrites the optimistic value.
     On error, the optimistic data is rolled back.

  Q: What transport does GraphQL subscriptions use?
  A: Typically WebSocket (RFC 6455). graphql-ws is the modern protocol.
     Alternative: Server-Sent Events (SSE) — one-way, simpler, HTTP.
     Polling (frequent queries) is the simplest but least efficient.
*/

module.exports = { mutationResolvers, subscriptionResolvers, startServer, createRestNotifier };

---

<a id="graphql-apollo-client"></a>
## 05_apollo_client.jsx — QUESTION SET: Apollo Client — Queries, Mutations & Cache

/**
 * QUESTION SET: Apollo Client — Queries, Mutations & Cache
 *
 * Apollo Client = GraphQL client for React
 * Core features:
 * - Declarative data fetching with hooks (useQuery, useMutation, useSubscription)
 * - Normalized in-memory cache (deduplication, optimistic updates)
 * - Local state management
 * - Pagination (offset, cursor, relay)
 */

// ─────────────────────────────────────────────
// Q1. Apollo Client setup
// ─────────────────────────────────────────────
import {
  ApolloClient, InMemoryCache, ApolloProvider,
  createHttpLink, split, from,
} from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getMainDefinition } from "@apollo/client/utilities";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";

// HTTP link for queries & mutations
const httpLink = createHttpLink({ uri: "/graphql" });

// Auth link — adds Authorization header to every request
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem("authToken");
  return {
    headers: { ...headers, authorization: token ? `Bearer ${token}` : "" },
  };
});

// Error link — centralized error handling
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    for (const { message, extensions } of graphQLErrors) {
      if (extensions?.code === "UNAUTHENTICATED") {
        // Redirect to login or refresh token
        window.location.href = "/login";
      }
      console.error(`[GraphQL error]: ${message}`);
    }
  }
  if (networkError) {
    console.error("[Network error]:", networkError);
  }
});

// Retry link — retry failed queries on network error
const retryLink = new RetryLink({
  delay: { initial: 300, max: 2000, jitter: true },
  attempts: { max: 3, retryIf: (error) => !!error && !error.statusCode },
});

// WebSocket link for subscriptions
const wsLink = new GraphQLWsLink(
  createClient({
    url: "ws://localhost:4000/graphql",
    connectionParams: () => ({
      authorization: localStorage.getItem("authToken"),
    }),
  })
);

// Split link: subscriptions → WS, everything else → HTTP
const splitLink = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return def.kind === "OperationDefinition" && def.operation === "subscription";
  },
  wsLink,
  from([errorLink, retryLink, authLink, httpLink])
);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      // Customize cache key (default: id)
      User: { keyFields: ["id"] },
      // Non-normalized type — embedded in parent
      Profile: { keyFields: false },
      Query: {
        fields: {
          // Merge paginated results (cursor-based)
          users: {
            keyArgs: ["filter"],          // separate cache entries per filter
            merge(existing = { edges: [] }, incoming) {
              return {
                ...incoming,
                edges: [...existing.edges, ...incoming.edges],
              };
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: { fetchPolicy: "cache-and-network" },
  },
});

// ─────────────────────────────────────────────
// Q2. useQuery — data fetching hook
// ─────────────────────────────────────────────
import { useQuery, gql } from "@apollo/client";

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
      role
      posts {
        id
        title
        status
      }
    }
  }
`;

function UserProfile({ userId }) {
  const { data, loading, error, refetch, networkStatus } = useQuery(GET_USER, {
    variables: { id: userId },
    fetchPolicy: "cache-first",      // use cache if available
    // fetchPolicy options:
    // "cache-first"          → default, use cache, only fetch if missing
    // "network-only"         → always fetch, don't read cache first
    // "cache-and-network"    → return cache immediately, then update from network
    // "no-cache"             → always fetch, don't write to cache
    // "cache-only"           → only read from cache, never fetch
    skip: !userId,                   // skip this query if userId is falsy
    pollInterval: 30000,             // re-fetch every 30s
    onCompleted: (data) => console.log("Data loaded:", data),
    onError: (err) => console.error("Error:", err),
  });

  if (loading) return <p>Loading…</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h1>{data.user.name}</h1>
      <ul>{data.user.posts.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q3. useMutation
// ─────────────────────────────────────────────
import { useMutation } from "@apollo/client";

const CREATE_POST = gql`
  mutation CreatePost($title: String!, $content: String!, $tags: [String!]) {
    createPost(title: $title, content: $content, tags: $tags) {
      id title status likeCount createdAt
    }
  }
`;

const GET_POSTS = gql`query GetPosts { posts { id title status likeCount } }`;

function CreatePostForm() {
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");

  const [createPost, { loading, error }] = useMutation(CREATE_POST, {
    // Update cache after mutation — avoid full refetch
    update(cache, { data: { createPost } }) {
      const existing = cache.readQuery({ query: GET_POSTS });
      if (existing) {
        cache.writeQuery({
          query: GET_POSTS,
          data: { posts: [createPost, ...existing.posts] },
        });
      }
    },

    // Alternative: tell Apollo which queries to refetch automatically
    // refetchQueries: [{ query: GET_POSTS }],

    optimisticResponse: {
      createPost: {
        __typename: "Post",
        id: "temp-id",
        title,
        content,
        status: "DRAFT",
        likeCount: 0,
        createdAt: new Date().toISOString(),
      },
    },

    onCompleted: () => { setTitle(""); setContent(""); },
    onError: (e) => console.error("Create post failed:", e),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createPost({ variables: { title, content } });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} />
      <button type="submit" disabled={loading}>
        {loading ? "Posting…" : "Create Post"}
      </button>
      {error && <p>Error: {error.message}</p>}
    </form>
  );
}

// ─────────────────────────────────────────────
// Q4. useSubscription
// ─────────────────────────────────────────────
import { useSubscription } from "@apollo/client";

const ON_COMMENT_ADDED = gql`
  subscription OnCommentAdded($postId: ID!) {
    commentAdded(postId: $postId) {
      id body createdAt
      author { id name }
    }
  }
`;

function LiveComments({ postId }) {
  const [comments, setComments] = React.useState([]);

  const { data, loading } = useSubscription(ON_COMMENT_ADDED, {
    variables: { postId },
    onData: ({ data }) => {
      setComments((prev) => [...prev, data.data.commentAdded]);
    },
  });

  return (
    <div>
      <h3>Live Comments</h3>
      {comments.map((c) => <p key={c.id}><strong>{c.author.name}:</strong> {c.body}</p>)}
    </div>
  );
}

// ─────────────────────────────────────────────
// Q5. Fragments — reuse field selections across queries
// ─────────────────────────────────────────────
const POST_FIELDS = gql`
  fragment PostFields on Post {
    id
    title
    status
    likeCount
    createdAt
    author {
      id
      name
    }
  }
`;

const GET_FEED = gql`
  ${POST_FIELDS}
  query GetFeed {
    posts {
      ...PostFields
    }
  }
`;

// ─────────────────────────────────────────────
// Q6. Direct cache manipulation
// ─────────────────────────────────────────────
function cacheManipulationExamples(client) {
  // Read a cached query
  const data = client.readQuery({ query: GET_POSTS });

  // Write to cache
  client.writeQuery({ query: GET_POSTS, data: { posts: [] } });

  // Read/write a fragment (single object by __typename + id)
  const post = client.readFragment({
    id: "Post:123",               // cache key: __typename:id
    fragment: gql`fragment F on Post { id title likeCount }`,
  });

  client.writeFragment({
    id: "Post:123",
    fragment: gql`fragment F on Post { likeCount }`,
    data: { likeCount: post.likeCount + 1 },
  });

  // Evict a specific object from cache
  client.cache.evict({ id: "Post:123" });
  client.cache.gc(); // garbage collect unreachable objects
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is Apollo Client's normalized cache?
  A: Apollo normalizes query results by splitting them into individual
     objects identified by __typename + id. This means:
     - Same user appearing in 2 queries shares ONE cached object
     - Updating user in one place reflects everywhere automatically

  Q: What is the difference between refetchQueries and cache update?
  A: refetchQueries: sends new network requests — always up-to-date, but costs network round-trips
     update function: directly patch local cache — immediate, no extra network call
     Prefer cache update for performance; refetchQueries for simplicity/correctness

  Q: What is fetchPolicy "cache-and-network"?
  A: Returns cached data immediately (fast render), then fires a network
     request in parallel. When network responds, updates the cache and re-renders.
     Best for data that must be fresh but should load fast.

  Q: How do Apollo fragments help?
  A: Fragments define reusable field selections. Useful for:
     - Sharing field lists between different queries
     - Colocation — define a component's data requirements next to the component
     - Type safety when used with codegen

  Q: What happens to optimistic updates on mutation failure?
  A: Apollo rolls back the optimistic response, restoring the cache
     to its pre-mutation state. Any UI showing the optimistic data reverts.
*/

export { client };

---

<a id="graphql-security-error-handling"></a>
## 06_security_error_handling.js — QUESTION SET: GraphQL Security, Error Handling & Performance

/**
 * QUESTION SET: GraphQL Security, Error Handling & Performance
 *
 * Key attack vectors in GraphQL:
 * 1. Query depth attacks (infinitely nested queries)
 * 2. Query complexity attacks (massive field selection)
 * 3. Introspection leaking schema in production
 * 4. Batching attacks (thousands of operations in one request)
 * 5. Field-level authorization bypass
 */

const depthLimit = require("graphql-depth-limit");
const { createComplexityLimitRule } = require("graphql-validation-complexity");
const { ApolloServer } = require("@apollo/server");
const { GraphQLError } = require("graphql");

// ─────────────────────────────────────────────
// Q1. Depth limiting — prevent deeply nested malicious queries
// ─────────────────────────────────────────────

// Malicious query:
// { user { friends { friends { friends { friends { ... } } } } } }
// Without protection, this can cause O(n^depth) DB queries

// Protection: define a max depth
const depthLimitRule = depthLimit(5); // max 5 levels deep

// ─────────────────────────────────────────────
// Q2. Query complexity limiting
// Assign a cost to each field; reject if total > threshold
// ─────────────────────────────────────────────
const complexityRule = createComplexityLimitRule(1000, {
  // Scalars cost 1, objects cost 2, lists multiply by 10 by default
  onCost: (cost) => console.log("Query cost:", cost),
  formatErrorMessage: (cost) =>
    `Query cost (${cost}) exceeded maximum complexity (1000)`,
});

// Custom complexity with field-level overrides
const { fieldExtensionsEstimator, simpleEstimator, getComplexity } = require("graphql-query-complexity");

function queryComplexityPlugin(schema) {
  return {
    requestDidStart: () => ({
      didResolveOperation({ request, document }) {
        const complexity = getComplexity({
          schema,
          operationName: request.operationName,
          query: document,
          variables: request.variables,
          estimators: [
            fieldExtensionsEstimator(),  // use "complexity" in schema extensions
            simpleEstimator({ defaultComplexity: 1 }),
          ],
        });

        if (complexity > 500) {
          throw new GraphQLError(
            `Query is too complex: ${complexity}/500. Simplify your query.`,
            { extensions: { code: "QUERY_TOO_COMPLEX" } }
          );
        }
      },
    }),
  };
}

// ─────────────────────────────────────────────
// Q3. Disable introspection in production
// Introspection reveals full schema — use during dev only
// ─────────────────────────────────────────────
const { NoSchemaIntrospectionCustomRule } = require("graphql");

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== "production", // disable in prod

  validationRules: [
    depthLimitRule,
    complexityRule,
    ...(process.env.NODE_ENV === "production" ? [NoSchemaIntrospectionCustomRule] : []),
  ],

  plugins: [
    queryComplexityPlugin(schema),
  ],
});

// ─────────────────────────────────────────────
// Q4. Structured error handling — never leak internals
// ─────────────────────────────────────────────

// Custom error classes
class NotFoundError extends GraphQLError {
  constructor(resource, id) {
    super(`${resource} with id "${id}" not found`, {
      extensions: { code: "NOT_FOUND", resource },
    });
  }
}

class ValidationError extends GraphQLError {
  constructor(message, invalidArgs) {
    super(message, {
      extensions: { code: "VALIDATION_ERROR", invalidArgs },
    });
  }
}

class AuthError extends GraphQLError {
  constructor(message = "Not authenticated") {
    super(message, {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
}

// Format errors before sending to client
function formatError(formattedError, error) {
  // Log full error internally
  console.error({
    message: error.message,
    stack: error.stack,
    path: formattedError.path,
    extensions: formattedError.extensions,
  });

  // Hide internal error details in production
  if (process.env.NODE_ENV === "production" &&
      formattedError.extensions?.code === "INTERNAL_SERVER_ERROR") {
    return {
      message: "An internal error occurred",
      extensions: { code: "INTERNAL_SERVER_ERROR" },
      path: formattedError.path,
      locations: formattedError.locations,
    };
  }

  return formattedError;
}

// ─────────────────────────────────────────────
// Q5. Rate limiting per operation
// ─────────────────────────────────────────────
function rateLimitPlugin(limits = { default: 100, login: 5 }) {
  const counts = new Map(); // ip:operation → { count, resetAt }

  return {
    requestDidStart: ({ request, contextValue }) => ({
      willSendResponse() {
        const ip = contextValue.req.ip;
        const op = request.operationName ?? "anonymous";
        const limit = limits[op] ?? limits.default;
        const key = `${ip}:${op}`;
        const now = Date.now();
        const entry = counts.get(key) ?? { count: 0, resetAt: now + 60000 };

        if (now > entry.resetAt) {
          entry.count = 0;
          entry.resetAt = now + 60000;
        }

        entry.count++;
        counts.set(key, entry);

        if (entry.count > limit) {
          throw new GraphQLError("Rate limit exceeded", {
            extensions: { code: "RATE_LIMITED", retryAfter: Math.ceil((entry.resetAt - now) / 1000) },
          });
        }
      },
    }),
  };
}

// ─────────────────────────────────────────────
// Q6. Query cost analysis / persisted queries allowlist
// Only pre-approved queries can run in production
// ─────────────────────────────────────────────
const allowedQueries = new Set([
  "sha256hash1", // hash of GET_USER query
  "sha256hash2", // hash of GET_POSTS query
]);

function allowlistPlugin() {
  return {
    requestDidStart: ({ request }) => ({
      didResolveOperation() {
        const hash = request.extensions?.persistedQuery?.sha256Hash;
        if (process.env.NODE_ENV === "production" && hash && !allowedQueries.has(hash)) {
          throw new GraphQLError("Query not allowed", {
            extensions: { code: "FORBIDDEN_QUERY" },
          });
        }
      },
    }),
  };
}

// ─────────────────────────────────────────────
// Q7. Timeout middleware — kill long-running resolvers
// ─────────────────────────────────────────────
function withTimeout(resolver, ms) {
  return async (parent, args, context, info) => {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new GraphQLError(`Field "${info.fieldName}" timed out`)), ms)
    );
    return Promise.race([resolver(parent, args, context, info), timeout]);
  };
}

// Apply to all resolver fields using mapSchema
const { mapSchema, MapperKind } = require("@graphql-tools/utils");

function timeoutDirective(schema, defaultMs = 5000) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD](fieldConfig) {
      const originalResolve = fieldConfig.resolve;
      if (!originalResolve) return fieldConfig;
      return {
        ...fieldConfig,
        resolve: withTimeout(originalResolve, defaultMs),
      };
    },
  });
}

// ─────────────────────────────────────────────
// Q8. Field-level authorization with directives (@auth)
// ─────────────────────────────────────────────
const authDirectiveDefs = `
  directive @auth(requires: UserRole = VIEWER) on FIELD_DEFINITION | OBJECT
`;

function authDirectiveTransformer(schema) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD](fieldConfig) {
      const authDirective = fieldConfig.astNode?.directives?.find(
        (d) => d.name.value === "auth"
      );
      if (!authDirective) return fieldConfig;

      const requiredRole = authDirective.arguments?.[0]?.value?.value ?? "VIEWER";
      const originalResolve = fieldConfig.resolve ?? (() => null);

      return {
        ...fieldConfig,
        resolve(parent, args, context, info) {
          const { user } = context;
          if (!user) throw new AuthError();
          const roles = ["VIEWER", "EDITOR", "ADMIN"];
          if (roles.indexOf(user.role) < roles.indexOf(requiredRole)) {
            throw new GraphQLError("Insufficient permissions", {
              extensions: { code: "FORBIDDEN" },
            });
          }
          return originalResolve(parent, args, context, info);
        },
      };
    },
  });
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What are the main security risks in GraphQL?
  A: 1. Introspection leaking schema structure
     2. Deeply nested queries causing O(n^d) DB load
     3. High-complexity queries overloading servers
     4. Batch attacks (large arrays in variables)
     5. Authorization not enforced at field level
     6. Injection through user-controlled strings in resolvers

  Q: Why is introspection dangerous in production?
  A: Introspection reveals the entire schema — all types, fields, queries,
     mutations. An attacker can enumerate the API surface and craft targeted
     attacks. Disable in production, or use an allowlist approach.

  Q: How does query depth limiting prevent DoS attacks?
  A: A depth-limited schema rejects queries that nest beyond a threshold.
     Without it: { user { friends { friends { friends { ... } } } } }
     could result in exponential DB queries. Depth limit of 5-7 is typical.

  Q: What is the difference between depth limiting and complexity limiting?
  A: Depth: counts nesting levels only (misses wide shallow queries).
     Complexity: assigns cost to each field; totals the cost. Computes
     total "work" — more accurate, but requires tuning per field.
     Use both together for comprehensive protection.

  Q: Should you use GraphQL error extensions?
  A: Yes. Extensions provide machine-readable error codes (UNAUTHENTICATED,
     NOT_FOUND, VALIDATION_ERROR) that clients can act on programmatically,
     separate from the human-readable message string.
*/

module.exports = { NotFoundError, ValidationError, AuthError, formatError };

---

<a id="graphql-federation-stitching"></a>
## 07_federation_stitching.js — QUESTION SET: GraphQL Federation & Schema Stitching

/**
 * QUESTION SET: GraphQL Federation & Schema Stitching
 *
 * Federation: architectural approach for splitting a GraphQL API across
 * multiple independently deployable services (microservices).
 * Each service owns a portion of the schema; the Gateway composes them.
 *
 * Schema Stitching: older approach — combine multiple schemas locally.
 * Federation is preferred for distributed/microservice architectures.
 */

const { ApolloServer } = require("@apollo/server");
const { buildSubgraphSchema } = require("@apollo/subgraph");
const { gql } = require("graphql-tag");

// ─────────────────────────────────────────────
// Q1. Users Subgraph — owns User type
// ─────────────────────────────────────────────
const usersTypeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key", "@shareable", "@external", "@requires", "@provides"])

  type User @key(fields: "id") {
    id: ID!
    name: String!
    email: String!
    role: String!
  }

  type Query {
    users: [User!]!
    user(id: ID!): User
    me: User
  }

  type Mutation {
    register(name: String!, email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
  }

  type AuthPayload {
    token: String!
    user: User!
  }
`;

const usersResolvers = {
  Query: {
    users: (_, __, { db }) => db.users.findAll(),
    user: (_, { id }, { db }) => db.users.findById(id),
    me: (_, __, { user }) => user,
  },
  User: {
    // __resolveReference: Called by the Gateway when it needs to resolve
    // a User entity from another subgraph's reference { __typename, id }
    __resolveReference: async ({ id }, { db }) => db.users.findById(id),
  },
};

const usersSubgraph = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs: usersTypeDefs, resolvers: usersResolvers }),
});

// ─────────────────────────────────────────────
// Q2. Posts Subgraph — owns Post type, extends User
// ─────────────────────────────────────────────
const postsTypeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key", "@external"])

  # Reference User from users subgraph — stub type
  type User @key(fields: "id") {
    id: ID!
    # posts field added to the User type (cross-subgraph extension)
    posts: [Post!]!
  }

  type Post @key(fields: "id") {
    id: ID!
    title: String!
    content: String!
    authorId: ID!
    author: User!             # resolved via federation reference
    createdAt: String!
  }

  type Query {
    posts: [Post!]!
    post(id: ID!): Post
  }

  type Mutation {
    createPost(title: String!, content: String!): Post!
    deletePost(id: ID!): Boolean!
  }
`;

const postsResolvers = {
  Post: {
    // Return a reference object — Gateway resolves full User via users subgraph
    author: (post) => ({ __typename: "User", id: post.authorId }),
    __resolveReference: ({ id }, { db }) => db.posts.findById(id),
  },
  User: {
    posts: ({ id }, _, { db }) => db.posts.find({ where: { authorId: id } }),
  },
};

// ─────────────────────────────────────────────
// Q3. Reviews Subgraph — @requires and @provides
// @requires: field needs fields resolved from another subgraph
// @provides: field can provide additional external fields (optimization)
// ─────────────────────────────────────────────
const reviewsTypeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key", "@external", "@requires", "@provides"])

  type Post @key(fields: "id") {
    id: ID!
    reviews: [Review!]!
    reviewCount: Int!
    averageRating: Float
  }

  # @requires: to compute shippingEstimate we need product.weight from Products subgraph
  type Product @key(fields: "id") {
    id: ID!
    weight: Float @external           # declared in Products subgraph
    shippingEstimate: String @requires(fields: "weight")
  }

  type Review @key(fields: "id") {
    id: ID!
    body: String!
    rating: Int!
    postId: ID!
    authorId: ID!
    author: User! @provides(fields: "name")  # can provide name without hitting users subgraph
  }

  type User @key(fields: "id") {
    id: ID!
    name: String @external
  }

  type Query {
    reviews(postId: ID!): [Review!]!
  }
`;

const reviewsResolvers = {
  Post: {
    reviews: ({ id }, _, { db }) => db.reviews.find({ where: { postId: id } }),
    reviewCount: ({ id }, _, { db }) => db.reviews.count({ where: { postId: id } }),
    averageRating: async ({ id }, _, { db }) => {
      const reviews = await db.reviews.find({ where: { postId: id } });
      if (!reviews.length) return null;
      return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    },
  },
  Product: {
    shippingEstimate: (product) => {
      // @requires(fields: "weight") — weight is available here from Products subgraph
      return product.weight > 10 ? "Heavy shipping: $15" : "Standard shipping: $5";
    },
  },
};

// ─────────────────────────────────────────────
// Q4. Gateway — composes all subgraphs
// (Managed federation via Apollo Studio or self-hosted)
// ─────────────────────────────────────────────
const { ApolloGateway, IntrospectAndCompose } = require("@apollo/gateway");

const gateway = new ApolloGateway({
  // IntrospectAndCompose: fetches schema from each subgraph via introspection (dev)
  // In production, use managed federation with schema registry
  supergraphSdl: new IntrospectAndCompose({
    subgraphs: [
      { name: "users",   url: "http://localhost:4001/graphql" },
      { name: "posts",   url: "http://localhost:4002/graphql" },
      { name: "reviews", url: "http://localhost:4003/graphql" },
    ],
  }),

  // Pass auth headers to subgraphs
  buildService({ url }) {
    return new RemoteGraphQLDataSource({
      url,
      willSendRequest({ request, context }) {
        // Forward auth token from gateway context to subgraph
        request.http?.headers?.set("authorization", context.authToken ?? "");
        request.http?.headers?.set("x-user-id", context.userId ?? "");
      },
    });
  },
});

const gatewayServer = new ApolloServer({
  gateway,
  context: ({ req }) => ({
    authToken: req.headers.authorization,
    userId: req.headers["x-user-id"],
  }),
});

// ─────────────────────────────────────────────
// Q5. Schema Stitching (older approach, single server)
// ─────────────────────────────────────────────
const { stitchSchemas } = require("@graphql-tools/stitch");
const { delegateToSchema } = require("@graphql-tools/delegate");

// Each sub-schema can be local or remote
const stitchedSchema = stitchSchemas({
  subschemas: [usersSubgraph, postsSubgraph],
  typeMergingOptions: {
    User: {
      selectionSet: "{ id }",
      // Merge user fields from both schemas
      fieldName: "user",
      args: (originalObject) => ({ id: originalObject.id }),
    },
  },
  // Add custom resolvers that delegate between schemas
  resolvers: {
    User: {
      postsFromPostsSchema: {
        selectionSet: "{ id }",
        resolve(user, args, context, info) {
          return delegateToSchema({
            schema: postsSubgraph,
            operation: "query",
            fieldName: "postsByUser",
            args: { userId: user.id },
            context,
            info,
          });
        },
      },
    },
  },
});

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is GraphQL Federation?
  A: Apollo Federation lets you split a single GraphQL API across multiple
     independently deployable services. Each service (subgraph) owns part
     of the schema. The Gateway composes all subgraphs into a unified graph.

  Q: What is a @key directive?
  A: Marks the primary key of an entity (type that can be referenced
     across subgraphs). The Gateway uses key fields to create references
     and resolve entities from other subgraphs.

  Q: What is __resolveReference?
  A: A special resolver called by the Gateway when it needs to load a
     full entity from a subgraph, given a "stub" reference object
     containing only the @key fields ({ __typename, id }).

  Q: What is @requires vs @external?
  A: @external: declares a field that is defined in another subgraph.
                This subgraph knows about it but doesn't own it.
     @requires: this field's resolver needs the @external field to be
                fetched and available before running.

  Q: Federation vs Schema Stitching?
  A: Federation: distributed — each subgraph runs independently,
                 declarative with directives, designed for microservices.
     Stitching: typically single-server composition, more flexible/
                complex configuration, useful when you don't control subgraphs.
     Apollo recommends Federation for new projects.
*/

module.exports = { usersResolvers, postsResolvers, reviewsResolvers };

---

<a id="graphql-interview-qa-patterns"></a>
## 08_interview_qa_patterns.js — QUESTION SET: GraphQL — Interview Questions & Advanced Patterns

/**
 * QUESTION SET: GraphQL — Interview Questions & Advanced Patterns
 *
 * Covers:
 * 1. REST vs GraphQL comparison
 * 2. Pagination patterns
 * 3. Caching strategies
 * 4. Testing GraphQL APIs
 * 5. 50+ theory Q&A for interviews
 */

// ─────────────────────────────────────────────
// Q1. Offset-based pagination
// ─────────────────────────────────────────────

// Schema:
// posts(page: Int!, limit: Int!): PostPage!
// type PostPage { items: [Post!]! total: Int! page: Int! totalPages: Int! }

const offsetPaginationResolvers = {
  Query: {
    posts: async (_, { page = 1, limit = 10, filter }, { db }) => {
      const offset = (page - 1) * limit;
      const [items, total] = await db.posts.findAndCount({
        where: filter ?? {},
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
      });
      return { items, total, page, totalPages: Math.ceil(total / limit) };
    },
  },
};

// ─────────────────────────────────────────────
// Q2. Cursor-based pagination (Relay spec)
// Better for real-time data — no shifted results when new items are added
// ─────────────────────────────────────────────

// Schema:
// posts(first: Int, after: String, last: Int, before: String): PostConnection!

function encodeCursor(id) {
  return Buffer.from(String(id)).toString("base64");
}

function decodeCursor(cursor) {
  return Buffer.from(cursor, "base64").toString("utf8");
}

const cursorPaginationResolvers = {
  Query: {
    posts: async (_, { first = 10, after, last, before }, { db }) => {
      const afterId = after ? decodeCursor(after) : null;
      const beforeId = before ? decodeCursor(before) : null;

      const items = await db.posts.findAll({
        where: {
          ...(afterId ? { id: { gt: afterId } } : {}),
          ...(beforeId ? { id: { lt: beforeId } } : {}),
        },
        take: (first ?? last) + 1, // fetch one extra to determine hasNextPage
        orderBy: { id: "asc" },
      });

      const hasNextPage = items.length > (first ?? last);
      if (hasNextPage) items.pop(); // remove extra item

      return {
        edges: items.map((item) => ({
          cursor: encodeCursor(item.id),
          node: item,
        })),
        pageInfo: {
          hasNextPage,
          hasPreviousPage: Boolean(afterId),
          startCursor: items.length ? encodeCursor(items[0].id) : null,
          endCursor: items.length ? encodeCursor(items[items.length - 1].id) : null,
          totalCount: await db.posts.count(),
        },
      };
    },
  },
};

// ─────────────────────────────────────────────
// Q3. Testing GraphQL with jest
// ─────────────────────────────────────────────
const { ApolloServer } = require("@apollo/server");
const { executeOperation } = require("@apollo/server");
const { gql } = require("graphql-tag");
const assert = require("assert");

async function testGraphQL() {
  const typeDefs = gql`
    type Query {
      hello(name: String): String!
      users: [User!]!
    }
    type User { id: ID! name: String! }
  `;

  const resolvers = {
    Query: {
      hello: (_, { name }) => `Hello, ${name ?? "World"}!`,
      users: () => [{ id: "1", name: "Alice" }, { id: "2", name: "Bob" }],
    },
  };

  const server = new ApolloServer({ typeDefs, resolvers });

  // Test without HTTP server using executeOperation
  const { body } = await server.executeOperation({
    query: `query { hello(name: "Test") }`,
  });

  assert.equal(body.singleResult.data.hello, "Hello, Test!");

  // Test with variables
  const GET_USERS = `query GetUsers { users { id name } }`;
  const result = await server.executeOperation({ query: GET_USERS });
  assert.equal(result.body.singleResult.data.users.length, 2);

  // Test with context (mock auth)
  const ME = `query { me { id name } }`;
  const meResult = await server.executeOperation(
    { query: ME },
    { contextValue: { user: { id: "1", name: "Alice" } } }
  );

  console.log("All tests passed!");
}

// ─────────────────────────────────────────────
// Q4. REST vs GraphQL comparison (code example)
// ─────────────────────────────────────────────

// REST — multiple roundtrips to get user + their posts + comments
// GET /users/1
// GET /users/1/posts
// GET /posts/42/comments

// GraphQL — single query, client specifies exactly what it needs
const COMBINED_QUERY = gql`
  query UserWithPostsAndComments($userId: ID!) {
    user(id: $userId) {
      id
      name
      posts {
        id
        title
        comments {
          id
          body
          author { name }
        }
      }
    }
  }
`;

// ─────────────────────────────────────────────
// Q5. Apollo Server caching with @cacheControl
// ─────────────────────────────────────────────
const cacheableTypeDefs = gql`
  type Query {
    # Cache for 60 seconds
    staticContent: String @cacheControl(maxAge: 60)

    # Private — per-user, not shared
    me: User @cacheControl(maxAge: 30, scope: PRIVATE)

    # Never cache
    currentTime: String @cacheControl(maxAge: 0)
  }
`;

// ─────────────────────────────────────────────
// Q6. Custom directives (@deprecated, @skip, @include)
// ─────────────────────────────────────────────
const directiveExamples = gql`
  type User {
    id: ID!
    name: String!
    username: String @deprecated(reason: "Use 'name' instead")
  }

  type Query {
    allUsers: [User!]!
  }
`;

// Client-side directive usage:
// query GetUser($showEmail: Boolean!, $skipPosts: Boolean!) {
//   user(id: "1") {
//     id
//     name
//     email @include(if: $showEmail)   # include only if true
//     posts @skip(if: $skipPosts)      # skip if true
//   }
// }

/*
  ─────────────────────────────────────────────
  COMPREHENSIVE INTERVIEW Q&A
  ─────────────────────────────────────────────

  Q: What is GraphQL and how does it differ from REST?
  A: GraphQL is a query language + runtime. Unlike REST:
     - Single endpoint (/graphql) instead of multiple URLs
     - Client defines exact data shape — no over/under fetching
     - Strongly typed schema is the contract
     - Multiple resources in one request
     - Real-time with subscriptions (vs REST polling/webhooks)

  Q: What are the three root types in GraphQL?
  A: Query (read), Mutation (write), Subscription (real-time events)

  Q: What is a resolver?
  A: A function that provides data for a field: (parent, args, context, info) → value
     Default resolver: returns parent[fieldName]

  Q: What is the execution model?
  A: 1. Parse query → AST
     2. Validate against schema (types, fields, depth)
     3. Execute: call resolver for each field, depth-first
     4. Return JSON with data and/or errors

  Q: Can a GraphQL response have both data and errors?
  A: Yes! Partial success is allowed. Nullable fields can be null
     when their resolver fails, while other fields succeed.
     The errors array contains all errors that occurred.

  Q: What is a fragment?
  A: A reusable selection of fields: fragment UserFields on User { id name email }
     Used with spread: ... UserFields
     Named fragments are shareable across operations.
     Inline fragments: ... on User { ... } — for unions/interfaces

  Q: What is an inline fragment?
  A: ... on TypeName { fields } inside a query.
     Required for union and interface fields to access type-specific fields.

  Q: What is the difference between query and mutation execution?
  A: Queries: resolvers execute in PARALLEL (concurrent)
     Mutations: resolvers execute SEQUENTIALLY (serial) — ensures ordering

  Q: What are GraphQL variables?
  A: Parameters passed separately from the query string.
     Avoids string interpolation/injection. Enables query reuse.
     Defined with $ prefix: query GetUser($id: ID!) { user(id: $id) { ... } }

  Q: What is schema introspection?
  A: Built-in GraphQL feature: query the schema itself for all types/fields.
     __schema, __type, __typename are introspection fields.
     Powers tools like GraphiQL, Apollo Studio, codegen.

  Q: What is persisted queries?
  A: Client sends a hash instead of full query text.
     Server maps hash → query. Smaller payloads, allowlisting security.
     Requires query registration step.

  Q: What is Apollo Federation?
  A: Splitting one GraphQL API across multiple microservices (subgraphs).
     The Gateway composes them into a supergraph.
     Each subgraph owns types declared with @key.

  Q: What is DataLoader?
  A: A utility that batches multiple loads within the same tick into a
     single batch call, and caches results within the request. Solves N+1.

  Q: How do you handle file uploads in GraphQL?
  A: Use the graphql-upload package and scalar Upload.
     Multipart form data protocol (GraphQL multipart request spec).
     Alternatively accept a pre-signed URL from a storage service instead.

  Q: What is the difference between Apollo Client fetch policies?
  A: cache-first: cache → network if missing (default, fast)
     network-only: always network, update cache
     cache-and-network: return cache + background network update
     no-cache: network only, don't cache at all
     cache-only: cache only, error if missing

  Q: What is the @defer directive?
  A: Marks parts of a query to be returned incrementally via HTTP streaming.
     Initial response returns quickly; deferred parts stream later.
     Good for non-critical parts of a page.
*/

module.exports = { encodeCursor, decodeCursor, offsetPaginationResolvers, cursorPaginationResolvers };

---

<a id="graphql-theory-interview-qa"></a>
## FILE: 09_theory_interview_qa.js

/*
=============================================================
  GRAPHQL THEORY — INTERVIEW Q&A
  Basic → Intermediate → Advanced
  For 7+ years experience
=============================================================
*/

// ─────────────────────────────────────────────────────────
// ██ SECTION 1: BASIC
// ─────────────────────────────────────────────────────────

/*
Q1 [BASIC]: What is GraphQL and how is it different from REST?
───────────────────────────────────────────────────────────────
A: GraphQL is a query language for APIs + a runtime for executing those queries.
   Client specifies EXACTLY what data it needs — no over-fetching or under-fetching.

   REST problems GraphQL solves:
   1. Over-fetching: REST returns fixed shapes; client gets more than it needs.
      GET /users/:id → returns 40 fields, client needs 3.
   2. Under-fetching (N+1 round trips):
      GET /users/:id then GET /users/:id/posts then GET /posts/:id/comments
      GraphQL: one request for all three.
   3. Versioning: REST needs /v1 /v2; GraphQL evolves schema with @deprecated directive.
   4. Type system: GraphQL schema is strongly typed; REST needs OpenAPI separately.
*/
// REST vs GraphQL query shape:

// REST: fixed shape, always returns all fields
// GET /api/users/1
// Response: { id, name, email, phone, address, createdAt, updatedAt, ... }

// GraphQL: client declares exactly what it wants
const GRAPHQL_QUERY = `
  query GetUser($id: ID!) {
    user(id: $id) {
      name
      email
      posts(last: 3) {
        title
        publishedAt
        comments { count }
      }
    }
  }
`;
// One request → user + posts + comment counts — ONLY those fields

/*
Q2 [BASIC]: Explain the GraphQL execution model — how does a query get resolved?
──────────────────────────────────────────────────────────────────────────────────
A: 1. Client sends POST request with query string + variables to /graphql endpoint
   2. GraphQL server PARSES the query into an AST
   3. Server VALIDATES the AST against the schema (types, fields, arguments)
   4. Server EXECUTES the AST: walks the selection set tree, calling each field's resolver
   5. Resolvers return values or Promises; GraphQL waits for all Promises then builds response
   6. Response is shaped EXACTLY like the query (mirrors the query structure)

   Resolver function signature: (parent, args, context, info) => value | Promise<value>
   - parent: resolved value of the parent field
   - args: arguments from the query (?limit, ?filter)
   - context: shared object (db, auth user, DataLoader instances)
   - info: AST info, requested fields, path
*/
const resolvers = {
  Query: {
    // parent = root (null), args = { id: '1' }, context = { db, user }, info = AST
    user: async (parent, { id }, context, info) => {
      if (!context.user) throw new Error('Unauthenticated');
      return context.db.users.findById(id);
    },
  },
  User: {
    // parent = user object returned above
    // posts resolver runs FOR EACH user — classic N+1 setup
    posts: async (user, args, context) => {
      return context.db.posts.findByUserId(user.id);  // ← called N times if listing N users
    },
    // Field that doesn't map to the object property directly:
    fullName: (user) => `${user.firstName} ${user.lastName}`,
  },
};

/*
Q3 [BASIC]: What is the difference between Query, Mutation, and Subscription?
───────────────────────────────────────────────────────────────────────────────
A: Query      → read data. Resolvers run in PARALLEL (safe because reads don't conflict).
   Mutation   → write data. Resolvers run SERIALLY (top-level mutations, in order).
   Subscription → real-time data stream over WebSocket. Resolves return AsyncIterator.
*/
// Schema example:
const typeDefs = `#graphql
  type Query {
    users: [User!]!
    user(id: ID!): User
  }
  type Mutation {
    createUser(input: CreateUserInput!): User!
    deleteUser(id: ID!): Boolean!
  }
  type Subscription {
    userCreated: User!            # fires when any user is created
    orderStatusChanged(orderId: ID!): Order!
  }
  input CreateUserInput {
    name: String!
    email: String!
  }
  type User { id: ID! name: String! email: String! }
  type Order { id: ID! status: String! }
`;

// Subscription resolver on server (uses async generator):
const subscriptionResolvers = {
  Subscription: {
    userCreated: {
      subscribe: (_, __, { pubsub }) => pubsub.asyncIterator(['USER_CREATED']),
      resolve: (payload) => payload.userCreated,
    },
  },
  Mutation: {
    createUser: async (_, { input }, { db, pubsub }) => {
      const user = await db.users.create(input);
      pubsub.publish('USER_CREATED', { userCreated: user });  // ← triggers all subscribers
      return user;
    },
  },
};

// ─────────────────────────────────────────────────────────
// ██ SECTION 2: INTERMEDIATE
// ─────────────────────────────────────────────────────────

/*
Q4 [INTERMEDIATE]: What is the N+1 problem and how does DataLoader solve it?
─────────────────────────────────────────────────────────────────────────────
A: N+1 problem: fetching a list of N items, then making 1 additional DB query PER item.
   Query users (1 DB call) → resolve posts for each user (N DB calls) = N+1 total.

   DataLoader solves it with BATCHING + CACHING within a single request:
   1. Instead of executing immediately, DataLoader COLLECTS all keys requested in the
      same event loop tick (via process.nextTick batch window)
   2. Calls your batch function ONCE with all collected keys
   3. Caches results so duplicate keys get the same promise
*/
const DataLoader = require('dataloader');

// Batch function: receives ARRAY of all keys collected in one tick
async function batchLoadPosts(userIds) {
  // ONE query for ALL userIds instead of one per user
  const posts = await db.posts.findByUserIds(userIds);

  // IMPORTANT: must return array WITH SAME LENGTH AND ORDER as userIds
  return userIds.map(id => posts.filter(p => p.userId === id));
}
const db = { posts: { findByUserIds: async (ids) => [] } };

function createLoaders(db) {
  return {
    // Create one DataLoader per request (not per server — would leak cache)
    postsForUser: new DataLoader(batchLoadPosts, {
      cacheKeyFn: (id) => String(id),  // normalize key type
      maxBatchSize: 100,               // limit batch size
    }),
    userById: new DataLoader(async (ids) => {
      const users = await db.users.findByIds(ids);
      const userMap = new Map(users.map(u => [u.id, u]));
      return ids.map(id => userMap.get(id) || new Error(`User ${id} not found`));
    }),
  };
}

// In resolver — just call load(), DataLoader batches automatically:
const resolversWithLoader = {
  User: {
    // This looks like N+1 but DataLoader batches all user.id calls in one tick:
    posts: (user, _, { loaders }) => loaders.postsForUser.load(user.id),
    // ↑ No matter how many users, only ONE DB query runs
  },
};

/*
Q5 [INTERMEDIATE]: How do you secure a GraphQL API?
─────────────────────────────────────────────────────
A: GraphQL has a larger attack surface than REST (flexible queries → complex queries).
   Key attack vectors and defenses:
*/
// 1. Query Depth Limiting — prevent deeply nested queries
//    query { user { friends { friends { friends { ... } } } } }  ← DoS via deep nesting
const { createComplexityLimitRule } = require('graphql-validation-complexity');
const depthLimit = require('graphql-depth-limit');

const validationRules = [
  depthLimit(5),                              // max 5 levels deep
  createComplexityLimitRule(1000, {           // max complexity score 1000
    scalarCost: 1,
    objectCost: 2,
    listFactor: 10,
  }),
];

// 2. Query Complexity Analysis — weight expensive resolvers
// 3. Persisted Queries — only allow pre-registered queries in production
//    Client sends hash instead of full query; server looks up query by hash
//    Prevents query injection entirely

// 4. Disable introspection in production:
const { NoSchemaIntrospectionCustomRule } = require('graphql');
const productionRules = process.env.NODE_ENV === 'production'
  ? [NoSchemaIntrospectionCustomRule]   // ← hides schema structure from attackers
  : [];

// 5. Field-level authorization with custom directives:
const schemaWithAuth = `#graphql
  type User {
    id: ID!
    name: String!
    email: String! @auth(requires: SELF)        # only own email visible
    salary: Float  @auth(requires: ADMIN)        # only admins can see salary
  }
  directive @auth(requires: Role!) on FIELD_DEFINITION
  enum Role { ADMIN SELF USER }
`;

/*
Q6 [INTERMEDIATE]: What is schema-first vs code-first development?
────────────────────────────────────────────────────────────────────
A: Schema-first: Write SDL (.graphql files) manually, then implement resolvers.
   + SDL is the source of truth; easy to share with frontend teams
   - SDL and resolvers can drift out of sync (no compile-time guarantee)

   Code-first: Write resolvers/types in code (TypeGraphQL, Nexus, Pothos);
               schema is GENERATED from code.
   + Type-safe by construction (TypeScript classes/decorators map to schema)
   + Resolver and type are co-located; can't drift
   - Schema is implicit; SDL must be exported for frontend tooling
*/
// Code-first with TypeGraphQL example:
// (Illustrative — decorators-based)
/*
@ObjectType()
class UserType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;
}

@Resolver(() => UserType)
class UserResolver {
  @Query(() => UserType, { nullable: true })
  async user(@Arg('id', () => ID) id: string, @Ctx() ctx: Context): Promise<UserType | null> {
    return ctx.db.users.findById(id);
  }

  @Mutation(() => UserType)
  async createUser(@Arg('input') input: CreateUserInput, @Ctx() ctx: Context): Promise<UserType> {
    return ctx.db.users.create(input);
  }
}
*/

// ─────────────────────────────────────────────────────────
// ██ SECTION 3: ADVANCED
// ─────────────────────────────────────────────────────────

/*
Q7 [ADVANCED]: How does GraphQL Federation work? What is a supergraph?
───────────────────────────────────────────────────────────────────────
A: Federation allows splitting a single GraphQL API across MULTIPLE services (subgraphs).
   A Router sits in front and combines them into one supergraph that clients query.

   Core concepts:
   - Subgraph: an independent service with its own schema + @key directive to mark entities
   - Entity: a type that can be extended/referenced across subgraphs (has @key = unique id)
   - Router (Apollo Router/Gateway): receives client query, plans how to split it across subgraphs,
     merges results, returns unified response
   - Supergraph schema: composed from all subgraph schemas
*/
// Subgraph 1: Users service
const userSubgraph = `#graphql
  type Query {
    me: User
  }
  type User @key(fields: "id") {       # ← marks User as a federated entity
    id: ID!
    name: String!
    email: String!
  }
`;

// Subgraph 2: Products service — EXTENDS User with orders
const productsSubgraph = `#graphql
  type User @key(fields: "id") {         # ← same key, extends User from users service
    id: ID!                              # must include key fields
    orders: [Order!]!                    # adds orders field to User
  }
  type Order {
    id: ID!
    total: Float!
    items: [OrderItem!]!
  }
  type OrderItem { productId: ID! quantity: Int! price: Float! }
`;

// How the Router resolves: user { name orders { total } }
// 1. Fetch { user { id name } } from Users subgraph
// 2. Take user.id, fetch { user(id: X) { orders { total } } } from Products subgraph
// 3. Merge: user.name from step 1 + user.orders from step 2

/*
Q8 [ADVANCED]: What are @defer and @stream directives?
────────────────────────────────────────────────────────
A: @defer: mark a fragment as non-critical — server sends initial response immediately,
           defers the fragment and streams it separately when ready.
   @stream: stream individual list items as they become available.

   Both use HTTP multipart/mixed or chunked transfer encoding.
   Critical for performance: user sees fast initial data, slow parts arrive later.
*/
const deferQuery = `
  query GetUserProfile($id: ID!) {
    user(id: $id) {
      name               # arrives in FIRST response (fast)
      email              # arrives in FIRST response
      ...UserRecommendations @defer(label: "recommendations")  # arrives LATER
    }
  }
  fragment UserRecommendations on User {
    recommendations {          # slow ML-powered field
      id
      title
    }
  }
`;
// Server sends:
// 1st chunk: { data: { user: { name: 'Alice', email: '...', recommendations: null } } }
// 2nd chunk: { incremental: [{ label: 'recommendations', data: { recommendations: [...] } }] }

const streamQuery = `
  query GetFeed {
    posts(first: 100) @stream(initialCount: 5) {   # first 5 immediately, rest streamed
      id
      title
    }
  }
`;

/*
Q9 [ADVANCED]: How do you implement cursor-based pagination in GraphQL (Relay spec)?
─────────────────────────────────────────────────────────────────────────────────────
A: Relay Connection spec is the GraphQL standard for pagination.
   Avoids offset pagination's issues (non-deterministic under mutations).
   Uses cursors (opaque, usually base64-encoded position) instead of page numbers.
*/
const relayPaginationSchema = `#graphql
  type Query {
    posts(first: Int, after: String, last: Int, before: String, filter: PostFilter): PostConnection!
  }
  type PostConnection {
    edges: [PostEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }
  type PostEdge {
    node: Post!
    cursor: String!           # opaque cursor for this specific item
  }
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }
  type Post { id: ID! title: String! publishedAt: String! }
  input PostFilter { authorId: ID status: String }
`;

// Resolver implementation:
const paginationResolvers = {
  Query: {
    async posts(_, { first = 10, after, filter }, { db }) {
      const limit   = Math.min(first, 100);          // ← cap max page size
      const afterId = after ? decodeCursor(after) : null;

      const rows = await db.posts.findMany({
        where: {
          ...(afterId ? { id: { gt: afterId } } : {}),
          ...(filter?.authorId ? { authorId: filter.authorId } : {}),
        },
        orderBy: { id: 'asc' },
        take: limit + 1,            // ← fetch one extra to determine hasNextPage
      });

      const hasNextPage = rows.length > limit;
      const items = rows.slice(0, limit);

      return {
        edges: items.map(post => ({
          node: post,
          cursor: encodeCursor(post.id),
        })),
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!after,
          startCursor: items[0]     ? encodeCursor(items[0].id)     : null,
          endCursor:   items.at(-1) ? encodeCursor(items.at(-1).id) : null,
        },
        totalCount: () => db.posts.count({ where: filter }),  // lazy — only runs if requested
      };
    },
  },
};

function encodeCursor(id) { return Buffer.from(String(id)).toString('base64'); }
function decodeCursor(cursor) { return Buffer.from(cursor, 'base64').toString('ascii'); }

/*
Q10 [ADVANCED]: How does GraphQL handle errors — field-level vs request-level?
────────────────────────────────────────────────────────────────────────────────
A: GraphQL has PARTIAL SUCCESS: a request can return BOTH data AND errors simultaneously.
   Unlike REST (200 vs 4xx/5xx), GraphQL always returns 200 with errors in the body.

   Two types:
   1. Field errors: resolver throws → that field becomes null, error added to 'errors' array
      → other fields in the response still resolve normally
   2. Request-level errors: schema validation fails, parse error → entire data is null
*/
// Partial success example response:
const partialSuccessResponse = {
  data: {
    user: { name: 'Alice' },    // ← resolved successfully
    posts: null,                 // ← resolver threw, field is null
  },
  errors: [
    {
      message: 'Database connection failed',
      locations: [{ line: 3, column: 5 }],
      path: ['posts'],           // ← which field failed
      extensions: {
        code: 'DATABASE_ERROR',  // ← machine-readable error code for clients
        timestamp: '2026-03-12T10:00:00Z',
      },
    },
  ],
};

// Custom error classes for structured errors:
const { GraphQLError } = require('graphql');

class AuthenticationError extends GraphQLError {
  constructor(message) {
    super(message, {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
}

class ForbiddenError extends GraphQLError {
  constructor(message) {
    super(message, {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }
}

// In resolver:
function protectedResolver(parent, args, context) {
  if (!context.user) throw new AuthenticationError('Must be logged in');
  if (!context.user.isAdmin) throw new ForbiddenError('Admin only');
  // proceed
}

module.exports = { encodeCursor, decodeCursor };

---

