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
