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
