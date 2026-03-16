/**
 * QUESTION SET: Express.js Middleware & Patterns
 *
 * Middleware: function with access to (req, res, next)
 * Executes in order: app.use() registers in sequence
 * Call next() to pass to the next middleware, next(err) to error handler
 *
 * Types:
 * 1. Application-level — app.use(), app.METHOD()
 * 2. Router-level     — router.use(), router.METHOD()
 * 3. Error-handling   — (err, req, res, next) — 4 arguments
 * 4. Built-in         — express.json(), express.static()
 * 5. Third-party      — cors, helmet, morgan
 */

const express = require("express");
const app = express();

// ─────────────────────────────────────────────
// Q1. Write a custom logging middleware
// WHAT: How do you log HTTP requests with method, URL, status code, and response time?
// THEORY: Intercept res.end using bind(), record start time, calculate duration. Call next() to pass to next middleware
// Time: O(1)  Space: O(1)
// ─────────────────────────────────────────────
function logger(req, res, next) {
  const start = Date.now();

  // Intercept res.end to log response time
  const originalEnd = res.end.bind(res);
  res.end = function (...args) {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} ${res.statusCode} — ${duration}ms`);
    return originalEnd(...args);
  };

  next();
}

app.use(logger);

// ─────────────────────────────────────────────
// Q2. Authentication middleware (JWT)
// WHAT: How do you validate JWT tokens in Express middleware to protect routes?
// THEORY: Extract Bearer token from Authorization header, verify with jwt.verify(). Attach decoded user to req.user. Throw on invalid/expired token for error handler. Return 401/403 errors
// Time: O(1) verification  Space: O(1) token storage in req
// ─────────────────────────────────────────────
const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Role-based authorization
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// Usage: app.delete("/users/:id", authenticate, authorize("admin"), deleteUser);

// ─────────────────────────────────────────────
// Q3. Rate limiting middleware (implement from scratch)
// WHAT: How do you implement a rate limiter to throttle API requests per IP address?
// THEORY: Track IP in Map with count+resetAt. Check current count. Return 429 if exceeded. Reset window when expired. Prevents brute-force attacks
// Time: O(1) per request  Space: O(m) for m unique IPs
// ─────────────────────────────────────────────
function createRateLimiter({ windowMs = 60000, max = 100 } = {}) {
  const clients = new Map(); // ip → { count, resetAt }

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const client = clients.get(ip);

    if (!client || now > client.resetAt) {
      clients.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (client.count >= max) {
      res.set("Retry-After", Math.ceil((client.resetAt - now) / 1000));
      return res.status(429).json({ error: "Too many requests" });
    }

    client.count++;
    next();
  };
}

app.use("/api/", createRateLimiter({ windowMs: 60000, max: 60 }));

// ─────────────────────────────────────────────
// Q4. Input validation middleware
// WHAT: How do you validate request body fields before processing in Express?
// THEORY: Define schema with rules (required, type, minLength, maxLength, pattern). Iterate fields, collect errors. Return 400 with errors or pass to next. Reusable across routes
// Time: O(f) fields  Space: O(e) error messages
// ─────────────────────────────────────────────
function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      if (rules.required && (value === undefined || value === "")) {
        errors.push({ field, message: `${field} is required` });
        continue;
      }

      if (value !== undefined) {
        if (rules.type && typeof value !== rules.type) {
          errors.push({ field, message: `${field} must be ${rules.type}` });
        }
        if (rules.minLength && String(value).length < rules.minLength) {
          errors.push({ field, message: `${field} must be at least ${rules.minLength} chars` });
        }
        if (rules.maxLength && String(value).length > rules.maxLength) {
          errors.push({ field, message: `${field} must be at most ${rules.maxLength} chars` });
        }
        if (rules.pattern && !rules.pattern.test(String(value))) {
          errors.push({ field, message: `${field} format is invalid` });
        }
      }
    }
    if (errors.length) return res.status(400).json({ errors });
    next();
  };
}

const userSchema = {
  name:     { required: true, type: "string", minLength: 2, maxLength: 50 },
  email:    { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  password: { required: true, minLength: 8 },
};

// Usage: app.post("/register", express.json(), validate(userSchema), registerHandler);

// ─────────────────────────────────────────────
// Q5. Error handling middleware (4 args)
// WHAT: How do you catch and handle errors globally in Express with proper error handler registration?
// THEORY: 4-argument middleware (err, req, res, next). Log errors for debugging. Return known errors with details, hide programming errors. Register LAST after all routes
// Time: O(1)  Space: O(1) response
// ─────────────────────────────────────────────
class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Async wrapper to avoid try/catch in every route
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Global error handler
function errorHandler(err, req, res, next) {
  // Log all errors
  console.error({
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    url: req.url,
    method: req.method,
  });

  if (err.isOperational) {
    // Known application errors — send details
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code },
    });
  }

  // Programming errors — hide details from client
  res.status(500).json({ error: { message: "Internal server error" } });
}

app.use(errorHandler); // register last!

// ─────────────────────────────────────────────
// Q6. Router pattern — modular routes
// WHAT: How do you organize Express routes into reusable, modular routers?
// THEORY: Create express.Router(), add middleware and routes to it, mount with app.use(path, router). Encapsulates routes, middleware, auth. Compose multiple routers into main app
// Time: O(1) mounting  Space: O(r) routers + routes
// ─────────────────────────────────────────────
const usersRouter = express.Router();

usersRouter
  .use(authenticate)                     // all user routes require auth
  .get("/", asyncHandler(async (req, res) => {
    const users = await getUsers();
    res.json(users);
  }))
  .post("/", validate(userSchema), asyncHandler(async (req, res) => {
    const user = await createUser(req.body);
    res.status(201).json(user);
  }))
  .get("/:id", asyncHandler(async (req, res) => {
    const user = await getUserById(req.params.id);
    if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
    res.json(user);
  }))
  .put("/:id", validate(userSchema), asyncHandler(async (req, res) => {
    const user = await updateUser(req.params.id, req.body);
    res.json(user);
  }))
  .delete("/:id", authorize("admin"), asyncHandler(async (req, res) => {
    await deleteUser(req.params.id);
    res.status(204).end();
  }));

app.use("/api/users", usersRouter);

// ─────────────────────────────────────────────
// Q7. CORS middleware
// WHAT: How do you handle Cross-Origin Resource Sharing (CORS) to allow requests from specific origins?
// THEORY: Check request origin against whitelist. Set Access-Control headers in response. Handle OPTIONS preflight requests. Return 204 for preflight or pass to next
// Time: O(1)  Space: O(1)
// ─────────────────────────────────────────────
function corsMiddleware(options = {}) {
  const {
    origins = ["*"],
    methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    headers = ["Content-Type", "Authorization"],
  } = options;

  return (req, res, next) => {
    const origin = req.headers.origin;
    const allowed = origins.includes("*") || origins.includes(origin);

    if (allowed) {
      res.set("Access-Control-Allow-Origin", origin ?? "*");
      res.set("Access-Control-Allow-Methods", methods.join(", "));
      res.set("Access-Control-Allow-Headers", headers.join(", "));
      res.set("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.status(204).end(); // preflight
    }

    next();
  };
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is middleware in Express?
  A: A function with (req, res, next). Called sequentially for each request.
     It can: modify req/res, end the request, or call next() to continue.

  Q: What happens if you forget to call next()?
  A: The request hangs — the client waits indefinitely until timeout.

  Q: How do you handle async errors in Express?
  A: Express does NOT catch async errors automatically (v4).
     Wrap every async route handler: asyncHandler(() => ...) or use try/catch.
     Express 5 (currently in beta) handles async errors automatically.

  Q: What is the order of middleware execution?
  A: FIFO — first registered, first executed. The order of app.use() calls matters.
     Error-handling middleware (4 args) should always be last.

  Q: Difference between app.use('/path', fn) and app.get('/path', fn)?
  A: app.use: matches ANY method, matches /path AND /path/anything
     app.get: matches only GET, exact path match (or with router)
*/

module.exports = { logger, authenticate, authorize, createRateLimiter, validate, AppError, asyncHandler, errorHandler };
