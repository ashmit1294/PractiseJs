# 08 — GraphQL

> **Module**: M9 — Communication Protocols  
> **Source**: https://layrs.me/course/hld/09-communication-protocols/graphql  
> **Difficulty**: Intermediate–Advanced | **Read time**: ~15 min

---

## ELI5

Imagine ordering at a restaurant where you can say exactly what you want: "I want a burger but only the patty and bun — no lettuce, no tomato. And small fries, not large."

REST is a fixed menu: you get the full burger whether you want all the toppings or not (over-fetching), and if you want dessert too you have to place a separate order (under-fetching, multiple round trips).

GraphQL is the custom-order system: one trip to the counter, get exactly — and only — what you asked for.

---

## Analogy

**REST** is a **vending machine**: each slot (endpoint) gives you one fixed item. Want a specific combination? Push multiple buttons, make multiple trips.

**GraphQL** is a **custom sandwich shop**: one window, tell them exactly what goes in the sandwich — bread type, fillings, sauces. One order, precisely what you asked for.

---

## Core Concept

GraphQL is a **query language for APIs** and a **runtime for executing those queries** against your data. Created by Facebook in 2012, open-sourced in 2015.

Three key ideas:
1. **Clients specify exactly what data they need** — no more, no less
2. **Single endpoint** (`POST /graphql`) — all queries through one URL
3. **Schema defines what's possible** — type system enforced at the API layer

---

## Schema Definition

GraphQL schemas describe the data and operations available:

```graphql
# Types — your data shapes
type User {
  id: ID!            # ! = non-null (required)
  name: String!
  email: String!
  age: Int
  posts: [Post!]!    # [] = list; [Post!]! = non-null list of non-null Posts
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  comments: [Comment!]!
  createdAt: String!
}

type Comment {
  id: ID!
  text: String!
  author: User!
}

# Root types — the entry points
type Query {               # Read operations
  user(id: ID!): User
  users(limit: Int, offset: Int): [User!]!
  searchPosts(query: String!): [Post!]!
}

type Mutation {            # Write operations
  createUser(name: String!, email: String!): User!
  updateUser(id: ID!, name: String): User!
  deleteUser(id: ID!): Boolean!
}

type Subscription {        # Real-time operations
  postCreated: Post!
  commentAdded(postId: ID!): Comment!
}
```

---

## Queries and Responses

The client specifies exactly the fields it wants:

```graphql
# Query — client specifies fields
query {
  user(id: "123") {
    name
    email
    posts {
      title
      createdAt
    }
  }
}
```

```json
{
  "data": {
    "user": {
      "name": "Alice",
      "email": "alice@example.com",
      "posts": [
        { "title": "GraphQL Intro", "createdAt": "2024-01-15" },
        { "title": "gRPC vs REST",  "createdAt": "2024-02-20" }
      ]
    }
  }
}
```

Fields NOT requested (age, comments, etc.) are NEVER fetched. The response shape **exactly mirrors** the query shape.

---

## Resolvers

Each field in a GraphQL schema is backed by a **resolver function**:

```js
const resolvers = {
  Query: {
    // Called when client queries `user(id: "123")`
    user: async (parent, args, context, info) => {
      // 4 arguments — always:
      // parent: result from parent resolver
      // args: query arguments (e.g., { id: "123" })
      // context: shared data — auth token, DB connection, DataLoader instances
      // info: query metadata, selected fields
      return await context.db.findUser(args.id);
    },
    users: async (parent, args, context) => {
      return await context.db.findUsers(args.limit, args.offset);
    }
  },
  
  User: {
    // Called for each User object to resolve its `posts` field
    posts: async (parent, args, context) => {
      // parent = the User object (has parent.id)
      return await context.db.findPostsByUser(parent.id);
    }
  },
  
  Mutation: {
    createUser: async (parent, { name, email }, context) => {
      if (!context.user) throw new AuthenticationError('Not authenticated');
      return await context.db.createUser({ name, email });
    }
  }
};
```

---

## The N+1 Problem

The most critical GraphQL performance problem:

```graphql
query {
  users {        # → SELECT * FROM users  (1 query)
    name
    posts {      # → For each user, SELECT * FROM posts WHERE userId = ?
      title      #   100 users = 100 separate queries
    }
  }
}
```

**Sequence without DataLoader**:
```
→ DB: SELECT * FROM users             (1 query → returns 100 users)
→ DB: SELECT * FROM posts WHERE userId = 1
→ DB: SELECT * FROM posts WHERE userId = 2
...
→ DB: SELECT * FROM posts WHERE userId = 100
= 101 TOTAL QUERIES for one GraphQL request
```

---

## DataLoader Solution

DataLoader (Facebook's library) **batches and caches** resolver calls within a single event loop tick:

```js
const DataLoader = require('dataloader');

// Batch function — called once with ALL keys accumulated in one tick
const postsByUserLoader = new DataLoader(async (userIds) => {
  // ONE query for all users at once
  const posts = await db.query(
    'SELECT * FROM posts WHERE user_id IN (?)',
    [userIds]
  );
  
  // Return results in same order as userIds (DataLoader requirement)
  return userIds.map(userId =>
    posts.filter(post => post.userId === userId)
  );
});

// In resolver — each call schedules a load, DataLoader batches them
const resolvers = {
  User: {
    posts: (parent, args, context) => {
      // This looks like a single call per user...
      return context.loaders.posts.load(parent.id);
      // ...but DataLoader collects all .load() calls in current tick
      // then fires ONE batched query for all of them
    }
  }
};
```

**Result with DataLoader**:
```
→ Event Loop Tick collects: load(1), load(2), load(3), ..., load(100)
→ DB: SELECT * FROM posts WHERE user_id IN (1,2,3,...,100)  (1 query!)
= 2 TOTAL QUERIES (users + batched posts)
```

---

## ASCII: Execution Flow

```
Client Query:
  query { user(id:"1") { name, posts { title } } }
                │
                ▼
┌──────────────────────────────────────┐
│         GraphQL Execution Engine     │
│                                      │
│  1. Parse query → AST                │
│  2. Validate against schema          │
│  3. Execute resolvers:               │
│     Query.user(id:"1")               │
│       └── User.name (trivial)        │
│       └── User.posts                 │
│             └── Post.title (trivial) │
└──────────────────────────────────────┘
                │
                ▼  (DataLoader batches DB calls)
         ┌──────────────┐
         │   Database   │
         │ 2 queries    │
         │ (not 1+N)    │
         └──────────────┘
```

---

## Caching Challenges

REST uses URL-based HTTP caching naturally. GraphQL breaks this:

| Aspect | REST | GraphQL |
|---|---|---|
| URL per resource | ✅ `/users/123` | ❌ Always `POST /graphql` |
| HTTP GET caching | ✅ CDN, browser cache | ❌ POST requests aren't cached |
| Cache key | URL + headers | Query string + variables (complex) |
| Cache invalidation | Per-URL | Must invalidate by type + ID |

**GraphQL caching solutions**:
1. **Persisted queries** — hash query, send only hash. CDN can cache by hash (GET request)
2. **Apollo Client normalized cache** — caches by `__typename + id` on the client
3. **Response caching** — Redis cache keyed by `hash(query + variables + user_id)`
4. **Field-level caching** — `@cacheControl` directive per field

---

## Authorization Challenge

REST: one permission check per endpoint.  
GraphQL: every resolver needs authorization — deeply nested fields can have different permissions.

```js
// REST: one middleware for /admin/users
app.use('/admin', requireRole('admin'));

// GraphQL: each resolver must check independently
const resolvers = {
  User: {
    email: (parent, args, context) => {
      // Is the requester looking at THEIR OWN email or someone else's?
      if (context.user.id !== parent.id && !context.user.isAdmin) {
        throw new ForbiddenError('Cannot view others\' emails');
      }
      return parent.email;
    },
    salary: (parent, args, context) => {
      // Salary only for HR or the user themselves
      if (!context.user.isHR && context.user.id !== parent.id) {
        throw new ForbiddenError('Unauthorized');
      }
      return parent.salary;
    }
  }
};
```

**Pattern**: use `graphql-shield` for declarative permissions as "rules" per field/type.

---

## Attack Surface: Query Complexity

Malicious deep query can bring down server:

```graphql
{            # depth 1
  users {    # depth 2 → N users
    posts {  # depth 3 → N×M posts  
      comments {  # depth 4 → N×M×K comments
        author {   # depth 5 → more DB calls
          posts {  # depth 6 → recursive!
            ...
          }
        }
      }
    }
  }
}
```

**Defenses**:
1. **Depth limiting**: reject queries deeper than 7-10 levels
2. **Query complexity analysis**: assign cost per field, reject if total cost > threshold
3. **Rate limiting by complexity**: GitHub charges 1 complexity point per node, allows 5000/hour
4. **Persisted queries**: only allow pre-approved queries (disable ad-hoc)
5. **Query timeout**: kill queries running > 30 seconds

---

## When NOT to Use GraphQL

| Scenario | Why REST is Better |
|---|---|
| **Simple CRUD API** | GraphQL overhead for no benefit |
| **CDN-heavy caching** | REST URL-based caching is far simpler |
| **File uploads** | GraphQL wasn't designed for binary; use REST multipart |
| **Simple external integrations** | Third parties expect REST; GraphQL requires client library |
| **Real-time first** | WebSockets or SSE simpler than GraphQL Subscriptions |
| **Team unfamiliar with GraphQL** | Steep learning curve (DataLoader, N+1, auth, caching) |

---

## MERN Dev Notes

```js
// Apollo Server 4 with Express + DataLoaders
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const DataLoader = require('dataloader');

const server = new ApolloServer({ typeDefs, resolvers });
await server.start();

app.use('/graphql', express.json(), expressMiddleware(server, {
  context: async ({ req }) => ({
    user: await authenticate(req.headers.authorization),
    db: mongoose.connection,
    // Fresh DataLoader PER REQUEST (don't share across requests!)
    loaders: {
      posts: new DataLoader(userIds =>
        Post.find({ userId: { $in: userIds } })
          .then(posts => userIds.map(id =>
            posts.filter(p => String(p.userId) === String(id))
          ))
      ),
      users: new DataLoader(ids =>
        User.find({ _id: { $in: ids } })
          .then(users => ids.map(id =>
            users.find(u => String(u._id) === String(id))
          ))
      )
    }
  })
}));
```

```jsx
// Apollo Client in React (frontend)
import { useQuery, useMutation, gql } from '@apollo/client';

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      name
      email
      posts {
        title
        createdAt
      }
    }
  }
`;

function UserProfile({ userId }) {
  const { loading, error, data } = useQuery(GET_USER, {
    variables: { id: userId },
    // Apollo's normalized cache: keyed by __typename + id
    // automatically updates other components showing same user
  });

  if (loading) return <Spinner />;
  if (error) return <Error message={error.message} />;
  
  return <div>{data.user.name}</div>;
}
```

---

## Real-World Examples

**Facebook (GraphQL inventor)**
- Created internally in 2012 to power the Facebook mobile app.
- Problem solved: mobile app had dozens of different REST endpoints for each screen. Merged into one flexible API.
- Scale: 10,000+ types; billions of queries/day; trillions of objects in the graph.

**GitHub API v4**
- Migrated from REST v3 to GraphQL v4. REST had 3x more data than clients needed.
- Rate limits by complexity points (not request count): 5000 points/hour per authenticated user.
- Uses field-level `@deprecated` directives; schema changes published in advance.

**Shopify**
- Black Friday 2023: 100,000+ requests/second through GraphQL API.
- Merchants build storefronts using Shopify's GraphQL Storefront API — fetch exactly the product fields they need.
- Uses persisted queries to allow CDN caching of storefront data.

---

## Interview Cheat Sheet

**Q: What problems does GraphQL solve that REST doesn't?**
A: (1) Over-fetching — REST endpoints return fixed shapes; mobile clients get fields they never render, wasting bandwidth. GraphQL clients specify exact fields. (2) Under-fetching — related data requires multiple REST round trips. GraphQL fetches related types in one query. (3) Rapid frontend iteration — adding a new UI field in REST often requires a backend API change; in GraphQL the frontend can request any field already in the schema. (4) Type safety — the schema provides a contract enforced at parse time, unlike REST's unvalidated JSON.

**Q: Explain the N+1 problem and how DataLoader solves it.**
A: When resolving a list of N users with their posts, each User.posts resolver independently queries the DB — 1 query for users + N queries for posts = N+1 total. DataLoader solves this by batching: it collects all `.load(userId)` calls within one event loop tick, then fires ONE query (`WHERE user_id IN (1,2,...,N)`). Result: 2 total queries regardless of N. DataLoader also caches within a request — same ID loaded twice returns the cached result. Critical: create a new DataLoader per request, never reuse across requests (stale data risk).

**Q: How does GraphQL caching work compared to REST?**
A: REST uses URL-based HTTP caching (CDNs, browser cache work naturally). GraphQL sends all queries as `POST /graphql` — no URL uniqueness, no HTTP caching. Solutions: (1) Persisted queries: hash the query, client sends only the hash as a GET param → CDN can cache by hash. (2) Apollo Client normalized cache: stores results in a flat map by `__typename:id`, shares identical objects across queries. (3) Server-side response caching with Redis keyed on `hash(query + variables)`. GraphQL caching is more complex but solvable.

**Q: How do you protect a GraphQL API from malicious deep queries?**
A: Multiple layers: (1) Query depth limit — reject queries deeper than 7-10 levels (graphql-depth-limit library). (2) Query complexity analysis — assign point costs to fields (lists cost more), reject if total > threshold. (3) Rate limiting by complexity points — GitHub's model: 5000 points/hour, not 5000 requests. (4) Query timeout — kill any query taking > N seconds. (5) Persisted queries in production — only pre-registered queries allowed, disable introspection and ad-hoc queries.

**Q: How does authorization differ in GraphQL vs REST?**
A: REST authorization is coarse-grained at the endpoint level — middleware like `requireRole('admin')` protects all routes under `/admin`. GraphQL authorization must be field-level — a single query can request fields with different permission requirements (public name, private email, HR-only salary). Each resolver must individually check `context.user` permissions. Use `graphql-shield` for declarative rule-based permissions. Never rely on "don't expose it in the schema" — introspection can reveal types even without resolvers.

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **GraphQL** | Query language for APIs and runtime for executing queries. Client specifies data shape |
| **Schema** | Type definitions declaring what data and operations an API supports |
| **Type** | GraphQL's way to define the shape of objects (`type User { id: ID!, name: String! }`) |
| **`!` (Non-null)** | Field marked `!` will never be null. Absence allowed without `!` |
| **Query** | GraphQL read operation. Client fetches data |
| **Mutation** | GraphQL write operation. Client creates, updates, or deletes data |
| **Subscription** | GraphQL real-time operation. Server pushes updates to subscribed clients |
| **Resolver** | Function that fetches the value for a specific field. One resolver per field |
| **Context** | Object passed to all resolvers: shared DB connections, auth info, DataLoader instances |
| **Parent** | First resolver argument: the return value of the parent resolver in the tree |
| **N+1 Problem** | Fetching a list of N items then making N individual sub-queries for related data |
| **DataLoader** | Facebook library that batches and caches resolver calls within one event loop tick |
| **Batching** | Collecting multiple individual `.load(id)` calls, executing as one `WHERE id IN (...)` |
| **Normalized Cache** | Apollo Client's cache structure: flat map keyed by `__typename:id` |
| **Over-fetching** | API returns more data than the client needs |
| **Under-fetching** | One API call returns too little; requires additional requests |
| **Introspection** | GraphQL feature allowing clients to query the schema itself (`__schema`, `__type`) |
| **Depth Limit** | Maximum allowed nesting depth in a query (typically 7-10) |
| **Query Complexity** | Cost metric for a GraphQL query based on field weights; used for rate limiting |
| **Persisted Query** | Pre-registered query stored server-side; client sends only the hash |
| **`graphql-shield`** | Library for declarative field/type level authorization rules in GraphQL |
| **Apollo Server** | Popular Node.js GraphQL server library with schema-first or code-first approach |
| **Apollo Client** | GraphQL client with normalized caching for React and other frameworks |
| **Fragment** | Reusable piece of a GraphQL query: `fragment UserFields on User { id name }` |
| **`__typename`** | Meta-field available on every type; returns the type name. Used as cache key |
