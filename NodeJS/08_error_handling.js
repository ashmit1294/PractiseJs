/**
 * QUESTION SET: Node.js Error Handling
 *
 * 1. Synchronous try/catch and error classes
 * 2. Async error handling patterns
 * 3. Express error middleware
 * 4. process.on('uncaughtException') and unhandledRejection
 * 5. Graceful shutdown
 * 6. Domain-specific error hierarchy
 */

const EventEmitter = require("events");

// ─────────────────────────────────────────────
// Q1. Custom error hierarchy
// ─────────────────────────────────────────────

class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // expected error, not a programmer bug
    Error.captureStackTrace(this, this.constructor); // cleaner stack trace
  }
}

class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

class ValidationError extends AppError {
  constructor(message, fields = {}) {
    super(message, 400, "VALIDATION_ERROR");
    this.fields = fields; // field-level validation messages
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "FORBIDDEN");
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, "CONFLICT");
  }
}

class RateLimitError extends AppError {
  constructor(retryAfter = 60) {
    super("Too many requests", 429, "RATE_LIMIT_EXCEEDED");
    this.retryAfter = retryAfter;
  }
}

// ─────────────────────────────────────────────
// Q2. asyncHandler wrapper — removes try/catch boilerplate in routes
// ─────────────────────────────────────────────

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next); // forwards errors to Express error handler
  };
}

// Route example using asyncHandler
// router.get('/users/:id', asyncHandler(async (req, res) => {
//   const user = await User.findById(req.params.id);
//   if (!user) throw new NotFoundError('User');
//   res.json(user);
// }));

// ─────────────────────────────────────────────
// Q3. Express global error handler
// Must have FOUR parameters for Express to recognise it as error middleware
// ─────────────────────────────────────────────

function errorHandler(err, req, res, next) {
  // Log all errors — use structured logging in production
  console.error({
    message: err.message,
    code: err.code,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    path: req.path,
    method: req.method,
    requestId: req.id,
  });

  // Normalise Prisma / Mongoose / Sequelize errors
  const normalised = normaliseError(err);

  const statusCode = normalised.statusCode || 500;
  const body = {
    error: {
      message: normalised.isOperational ? normalised.message : "An unexpected error occurred",
      code: normalised.code || "INTERNAL_ERROR",
      ...(normalised.fields && { fields: normalised.fields }),
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    },
  };

  // Include Retry-After header for rate limit errors
  if (normalised instanceof RateLimitError) {
    res.setHeader("Retry-After", normalised.retryAfter);
  }

  res.status(statusCode).json(body);
}

function normaliseError(err) {
  // Prisma unique constraint violation
  if (err.code === "P2002") {
    return new ConflictError(`Duplicate value for ${err.meta?.target}`);
  }
  // Prisma record not found
  if (err.code === "P2025") {
    return new NotFoundError("Record");
  }
  // JSON parse error (malformed request body)
  if (err.type === "entity.parse.failed") {
    return new ValidationError("Invalid JSON in request body");
  }
  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return new UnauthorizedError("Invalid token");
  }
  if (err.name === "TokenExpiredError") {
    return new UnauthorizedError("Token expired");
  }
  return err;
}

// ─────────────────────────────────────────────
// Q4. process-level error events
// ─────────────────────────────────────────────

function setupProcessErrorHandlers(server) {
  // Synchronous exceptions not caught by try/catch — usually programmer bugs
  process.on("uncaughtException", (err) => {
    console.error("UNCAUGHT EXCEPTION:", err);
    // Should always crash because process state may be invalid
    gracefulShutdown(server, 1);
  });

  // Unhandled promise rejections — treat as fatal in Node 15+
  process.on("unhandledRejection", (reason, promise) => {
    console.error("UNHANDLED REJECTION at:", promise, "reason:", reason);
    gracefulShutdown(server, 1);
  });

  // SIGTERM — sent by orchestrators (Kubernetes, Docker) when stopping container
  process.on("SIGTERM", () => {
    console.log("SIGTERM received — shutting down gracefully");
    gracefulShutdown(server, 0);
  });

  // SIGINT — Ctrl+C during development
  process.on("SIGINT", () => {
    console.log("SIGINT received — shutting down");
    gracefulShutdown(server, 0);
  });
}

// ─────────────────────────────────────────────
// Q5. Graceful shutdown
// Stop accepting new connections while finishing in-flight requests
// ─────────────────────────────────────────────

function gracefulShutdown(server, exitCode = 0) {
  let isShuttingDown = false;

  return async function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log("Closing HTTP server...");

    // server.close stops accepting new connections but waits for existing ones
    server.close(async () => {
      try {
        await closeExternalConnections(); // DB pool, Redis, queues
        console.log("All connections closed. Exiting.");
        process.exit(exitCode);
      } catch (err) {
        console.error("Error during shutdown:", err);
        process.exit(1);
      }
    });

    // Force exit after timeout if requests don't drain
    setTimeout(() => {
      console.error("Forced shutdown after timeout");
      process.exit(exitCode);
    }, 10_000).unref(); // unref() prevents timer from keeping process alive
  };
}

async function closeExternalConnections() {
  // await db.disconnect();
  // await redisClient.quit();
  // await messageQueue.close();
}

// ─────────────────────────────────────────────
// Q6. Result type pattern (avoids throw for expected errors)
// Inspired by Rust Result<T, E>
// ─────────────────────────────────────────────

class Result {
  #ok;
  #value;
  #error;

  constructor(ok, valueOrError) {
    this.#ok = ok;
    if (ok) this.#value = valueOrError;
    else this.#error = valueOrError;
  }

  static ok(value) { return new Result(true, value); }
  static err(error) { return new Result(false, error); }

  isOk() { return this.#ok; }
  isErr() { return !this.#ok; }

  unwrap() {
    if (!this.#ok) throw this.#error;
    return this.#value;
  }

  unwrapOr(fallback) {
    return this.#ok ? this.#value : fallback;
  }

  map(fn) {
    return this.#ok ? Result.ok(fn(this.#value)) : this;
  }

  // Pattern match
  match({ ok, err }) {
    return this.#ok ? ok(this.#value) : err(this.#error);
  }
}

// Usage — avoids try/catch for expected failures
async function findUserResult(id) {
  const user = await db.user.findById(id);
  if (!user) return Result.err(new NotFoundError("User"));
  return Result.ok(user);
}

async function handleGetUser(req, res) {
  const result = await findUserResult(req.params.id);
  result.match({
    ok: (user) => res.json(user),
    err: (err) => res.status(err.statusCode).json({ error: err.message }),
  });
}

// ─────────────────────────────────────────────
// Q7. Circuit breaker pattern
// Stops hammering a failing downstream service
// ─────────────────────────────────────────────

class CircuitBreaker {
  #state = "CLOSED"; // CLOSED | OPEN | HALF_OPEN
  #failures = 0;
  #threshold;
  #timeout;
  #lastFailureTime = null;

  constructor(threshold = 5, timeout = 30_000) {
    this.#threshold = threshold;
    this.#timeout = timeout;
  }

  async call(fn) {
    if (this.#state === "OPEN") {
      const elapsed = Date.now() - this.#lastFailureTime;
      if (elapsed > this.#timeout) {
        this.#state = "HALF_OPEN";
      } else {
        throw new AppError("Circuit open — service unavailable", 503, "CIRCUIT_OPEN");
      }
    }

    try {
      const result = await fn();
      this.#onSuccess();
      return result;
    } catch (err) {
      this.#onFailure();
      throw err;
    }
  }

  #onSuccess() {
    this.#failures = 0;
    this.#state = "CLOSED";
  }

  #onFailure() {
    this.#failures++;
    this.#lastFailureTime = Date.now();
    if (this.#failures >= this.#threshold) {
      this.#state = "OPEN";
    }
  }

  getState() { return this.#state; }
}

// Usage
const paymentBreaker = new CircuitBreaker(5, 30000);
async function chargeCard(cardToken, amount) {
  return paymentBreaker.call(() => paymentService.charge(cardToken, amount));
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the difference between operational and programmer errors?
  A: Operational errors: expected failures at runtime — network timeout, invalid user input,
     disk full, resource not found. Handle gracefully, return 4xx/5xx.
  
     Programmer errors: bugs — null dereference, using an API wrong, type mismatch.
     Cannot recover — crash and restart. Never silently swallow them.

  Q: Why should uncaughtException always crash the process?
  A: When an exception reaches that handler, the process is in an unknown state —
     internal data structures may be corrupt. Continuing risks data corruption.
     The safe approach: log, cleanup, and exit. Use a process manager (PM2, Kubernetes)
     to restart automatically.

  Q: What does next(err) do in Express?
  A: Calling next(err) skips all remaining regular middlewares and routes,
     and jumps to the nearest error-handling middleware (4-arg: err, req, res, next).

  Q: How do you prevent memory leaks from event emitters?
  A: Remove listeners when no longer needed: emitter.off(event, fn).
     Use once() for single-use listeners.
     Monitor: emitter.listenerCount(event).
     Node warns when > maxListeners (default 10) are added.

  Q: Explain the circuit breaker states.
  A: CLOSED: normal operation, requests pass through.
     OPEN: too many failures; requests immediately rejected (fail fast).
     HALF_OPEN: after timeout, one probe request allowed.
       Success → back to CLOSED.
       Failure → back to OPEN.

  Q: What is the difference between SIGTERM and SIGKILL?
  A: SIGTERM (15): graceful signal — process can catch it, clean up, then exit.
     SIGKILL (9): forceful — cannot be caught or ignored, OS immediately terminates process.
     Always send SIGTERM first, then SIGKILL after a timeout if the process hasn't exited.
*/

const paymentService = { charge: async () => {} };
const db = { user: { findById: async () => null } };

module.exports = {
  AppError, NotFoundError, ValidationError, UnauthorizedError,
  ForbiddenError, ConflictError, RateLimitError,
  asyncHandler, errorHandler, setupProcessErrorHandlers, gracefulShutdown,
  Result, CircuitBreaker,
};
