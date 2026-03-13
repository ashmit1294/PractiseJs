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
