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
