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

/*
Q11 [ADVANCED]: Structure of GraphQL for a complex application integrated with Node.js backend
──────────────────────────────────────────────────────────────────────────────────────────────
A: Scalable GraphQL architecture: Schema → Resolvers → DataLoaders → Middleware → Context.\n   1. Schema: types, queries, mutations, subscriptions (single source of truth)\n   2. Resolvers: implement business logic; have access to context (db, loaders, pubsub)\n   3. DataLoaders: batch queries to prevent N+1 problem\n   4. Context factory: fresh context per request with user, db, loaders\n   5. Middleware: auth, authorization, logging, error handling\n   6. Integrates with Node.js Express/Koa via apollo-server-express\n*/\n\n/*\nQ12 [ADVANCED]: How to optimize data fetching in React using GraphQL (fragments, caching, pagination, @defer)\n────────────────────────────────────────────────────────────────────────────────────────────────────────────\nA: Client-side optimization strategies:\n\n   1. Fragments: reuse query selection sets across queries\n   2. Caching: Apollo Client cache-first policy avoids refetching\n   3. Pagination: Relay cursor-based (not offset-based) survives mutations\n   4. @defer: stream non-critical fields later for faster initial render\n   5. Selective fetching: only request fields your component uses\n*/\n\n// Fragment example:\nconst PostFragment = `\n  fragment PostCore on Post {\n    id\n    title\n    content\n    author { id name email }\n  }\n`;\n\n// Using fragment in multiple queries:\nconst POST_QUERY = `\n  query GetPost($id: ID!) {\n    post(id: $id) {\n      ...PostCore\n    }\n  }\n  ${PostFragment}\n`;\n\n// @defer example (stream lazy data):\nconst DEFER_QUERY = `\n  query GetUser($id: ID!) {\n    user(id: $id) {\n      name\n      email\n      ...UserRecommendations @defer(label: \"recommendations\")\n    }\n  }\n  fragment UserRecommendations on User {\n    recommendations { id title }  # arrives later\n  }\n`;\n// First chunk: { data: { user: { name, email } } }\n// Second chunk: { incremental: [{ label: 'recommendations', data: { recommendations } }] }\n\nmodule.exports = { encodeCursor, decodeCursor };
