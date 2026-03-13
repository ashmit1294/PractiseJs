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
