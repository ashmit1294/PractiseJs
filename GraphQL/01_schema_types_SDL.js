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
