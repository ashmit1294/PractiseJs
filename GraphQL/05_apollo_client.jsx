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
