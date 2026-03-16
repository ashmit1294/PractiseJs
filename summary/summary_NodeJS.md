# Node.js — Interview Revision Summary

> **Target:** 7+ year Full Stack MERN Developer | **Files:** 11

## Table of Contents

1. [01_event_loop.js — QUESTION SET: Node.js Event Loop](#nodejs-event-loop)
2. [02_streams_buffers.js — QUESTION SET: Node.js Streams & Buffers](#nodejs-streams-buffers)
3. [03_express_middleware.js — QUESTION SET: Express.js Middleware & Patterns](#nodejs-express-middleware)
4. [04_authentication.js — QUESTION SET: Node.js Authentication & JWT](#nodejs-authentication)
5. [05_event_emitter.js — QUESTION SET: Node.js EventEmitter & Custom Events](#nodejs-event-emitter)
6. [06_cluster_workers.js — QUESTION SET: Node.js Cluster, Worker Threads & child_process](#nodejs-cluster-workers)
7. [07_file_system.js — QUESTION SET: Node.js File System (fs)](#nodejs-file-system)
8. [08_error_handling.js — QUESTION SET: Node.js Error Handling](#nodejs-error-handling)
9. [09_rest_api_patterns.js — QUESTION SET: Node.js REST API Patterns](#nodejs-rest-api-patterns)
10. [10_race_conditions.js — RACE CONDITIONS IN NODE.JS — WHAT THEY ARE AND HOW TO AVOID THEM](#nodejs-race-conditions)  (Q1-Q2)
11. [FILE: 11_theory_interview_qa.js](#nodejs-theory-interview-qa)
   - [Scenario-Based Questions](#nodejs-scenarios)

---

<a id="nodejs-event-loop"></a>
## 01_event_loop.js — QUESTION SET: Node.js Event Loop

```javascript
/**
 * QUESTION SET: Node.js Event Loop
 *
 * The event loop is what allows Node.js to perform non-blocking I/O operations
 * despite JavaScript being single-threaded.
 *
 * Phases (in order):
 * 1. timers       → setTimeout, setInterval callbacks
 * 2. pending      → I/O callbacks deferred to next iteration
 * 3. idle/prepare → internal use
 * 4. poll         → retrieve new I/O events (MOST time spent here)
 * 5. check        → setImmediate callbacks
 * 6. close        → close event callbacks (socket.on('close'))
 *
 * Microtasks (between every phase):
 *   process.nextTick > Promise.then > queueMicrotask
 */

// ─────────────────────────────────────────────
// Q1. Event loop order — predict the output
// ─────────────────────────────────────────────
console.log("1 — synchronous");

setTimeout(() => console.log("2 — setTimeout 0"), 0);

Promise.resolve().then(() => console.log("3 — Promise.then"));

process.nextTick(() => console.log("4 — nextTick"));

setImmediate(() => console.log("5 — setImmediate"));

console.log("6 — synchronous");

// Output order: 1, 6, 4, 3, 2, 5
// Why:
//   1 & 6 → synchronous, run first
//   4 → nextTick queue (highest priority microtask)
//   3 → Promise microtask queue
//   2 → timers phase (setTimeout 0ms → next iteration)
//   5 → check phase (setImmediate → after poll phase)

// ─────────────────────────────────────────────
// Q2. Nested microtasks — nextTick in a loop
// nextTick can STARVE the event loop if used recursively!
// ─────────────────────────────────────────────
// DANGEROUS — starves I/O:
// process.nextTick(function tick() {
//   process.nextTick(tick); // infinite nextTick loop blocks everything
// });

// Safe — use setImmediate for recursive async:
function safeRecursion() {
  setImmediate(function tick() {
    // do work
    setImmediate(tick); // yields to event loop between iterations
  });
}

// ─────────────────────────────────────────────
// Q3. setTimeout vs setImmediate — which runs first?
// It depends on whether we're inside an I/O callback!
// ─────────────────────────────────────────────

// Outside I/O callback — order is non-deterministic
setTimeout(() => console.log("timeout"), 0);
setImmediate(() => console.log("immediate"));
// Output: either order (depends on OS scheduling)

// INSIDE I/O callback — setImmediate always first
const fs = require("fs");
fs.readFile(__filename, () => {
  setTimeout(() => console.log("timeout inside I/O"), 0);
  setImmediate(() => console.log("immediate inside I/O — ALWAYS FIRST"));
});

// ─────────────────────────────────────────────
// Q4. process.nextTick use case
// Execute callback AFTER the current operation but BEFORE any I/O
// ─────────────────────────────────────────────

// Use case: emit event after constructor returns
const EventEmitter = require("events");

class MyEmitter extends EventEmitter {
  constructor() {
    super();
    // BUG: emitting 'ready' here — event listener hasn't been attached yet
    // this.emit('ready');

    // FIX: defer until after constructor returns
    process.nextTick(() => this.emit("ready"));
  }
}

const em = new MyEmitter();
em.on("ready", () => console.log("Emitter is ready!"));

// ─────────────────────────────────────────────
// Q5. Promise chaining and microtask queue
// ─────────────────────────────────────────────
async function asyncVsSync() {
  console.log("A");

  await Promise.resolve();
  console.log("B"); // runs after current synchronous block

  setTimeout(() => console.log("C — setTimeout"), 0);

  await new Promise((resolve) => setTimeout(resolve, 0));
  console.log("D"); // runs after C (awaiting a setTimeout)

  console.log("E");
}

asyncVsSync();
console.log("F"); // runs before B — F is synchronous, B needs microtask queue

// Output: A, F, B, C, D, E

// ─────────────────────────────────────────────
// Q6. Call Stack visualization
// ─────────────────────────────────────────────
function multiply(a, b) { return a * b; }
function square(n) { return multiply(n, n); }
function printSquare(n) { console.log(square(n)); }

// Call stack:
// printSquare(5)
//   square(5)
//     multiply(5, 5)
//     ← multiply returns 25
//   ← square returns 25
// ← printSquare logs 25, returns

printSquare(5);

// ─────────────────────────────────────────────
// Q7. Non-blocking I/O with callbacks
// ─────────────────────────────────────────────
const path = require("path");

function readFileAsync(filePath, callback) {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) return callback(err);
    callback(null, data);
  });
}

// Node.js can handle thousands of concurrent I/O ops because:
// 1. fs/net operations are delegated to libuv thread pool
// 2. Meanwhile, event loop processes other callbacks
// 3. When I/O completes, callback is queued in poll phase

// ─────────────────────────────────────────────
// Q8. Worker Threads for CPU-intensive tasks
// Use when: computation blocks event loop > 100ms
// ─────────────────────────────────────────────
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");

if (isMainThread) {
  // Main thread: spawn worker
  function fibonacci(n) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { n } });
      worker.on("message", resolve);
      worker.on("error", reject);
    });
  }

  fibonacci(40).then((result) => console.log("Fibonacci(40):", result));
} else {
  // Worker thread: compute and send result
  function fib(n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
  }
  parentPort.postMessage(fib(workerData.n));
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the event loop?
  A: A C loop (in libuv) that processes async callbacks after the
     call stack is empty. It has phases: timers, I/O, idle/prepare,
     poll, check, close. Microtasks (nextTick, Promises) run between
     each phase transition.

  Q: What is the difference between process.nextTick and setImmediate?
  A: nextTick runs BEFORE the next event loop iteration (after current op).
     setImmediate runs in the CHECK phase of the NEXT iteration.
     nextTick has higher priority. Avoid recursive nextTick.

  Q: Why is Node.js single-threaded but non-blocking?
  A: I/O operations (disk, network) are delegated to OS/libuv thread pool.
     The main JS thread registers a callback and continues.
     When I/O completes, the callback is added to the event queue.

  Q: How many threads does Node.js actually use?
  A: By default: 1 main JS thread + 4 libuv worker threads (UV_THREADPOOL_SIZE).
     libuv threads handle: file I/O, DNS, zlib, crypto.
     Network I/O uses OS async syscalls (epoll/kqueue), no threads needed.

  Q: When should you use Worker Threads?
  A: For CPU-intensive synchronous work that would block the event loop
     (image processing, cryptography, complex data transforms).
     Do NOT use for I/O — Node's async model handles that efficiently.
*/

module.exports = { readFileAsync };

---
```

<a id="nodejs-streams-buffers"></a>
## 02_streams_buffers.js — QUESTION SET: Node.js Streams & Buffers

```javascript
/**
 * QUESTION SET: Node.js Streams & Buffers
 *
 * Streams: process data piece by piece, not all at once
 * Types: Readable, Writable, Duplex (both), Transform (duplex + modify)
 *
 * Buffer: raw binary data in a fixed-size chunk outside V8 heap
 * Why: Node.js needs to process binary data (files, network, crypto)
 */

const fs      = require("fs");
const stream  = require("stream");
const { pipeline, Transform, Readable, Writable, PassThrough } = require("stream");
const { promisify } = require("util");

const pipelineAsync = promisify(pipeline);

// ─────────────────────────────────────────────
// Q1. Reading a large file with streams
// Without streams: reads entire file into memory
// With streams: reads in 16KB chunks (highWaterMark default)
// ─────────────────────────────────────────────

// BAD for large files — reads ALL into RAM
function readFileBad(filePath) {
  const data = fs.readFileSync(filePath, "utf8");
  return data.split("\n").length;
}

// GOOD — stream line by line, constant memory
async function countLines(filePath) {
  const readable = fs.createReadStream(filePath, { encoding: "utf8" });
  let lineCount = 0;
  let partial = "";

  for await (const chunk of readable) {
    const lines = (partial + chunk).split("\n");
    partial = lines.pop(); // last partial line
    lineCount += lines.length;
  }
  if (partial) lineCount++;
  return lineCount;
}

// ─────────────────────────────────────────────
// Q2. Pipe — chain streams
// pipe() handles backpressure automatically
// ─────────────────────────────────────────────
async function compressFile(inputPath, outputPath) {
  const zlib = require("zlib");

  await pipelineAsync(
    fs.createReadStream(inputPath),
    zlib.createGzip(),              // Transform: compress
    fs.createWriteStream(outputPath)
  );
  console.log("Compressed successfully");
}

// ─────────────────────────────────────────────
// Q3. Custom Readable stream
// Push data into the stream via _read() or push()
// ─────────────────────────────────────────────
class CounterStream extends Readable {
  constructor(max, options = {}) {
    super({ ...options, objectMode: true });
    this.max = max;
    this.current = 0;
  }

  _read() {
    if (this.current < this.max) {
      this.push(this.current++);
    } else {
      this.push(null); // signal end of stream
    }
  }
}

// Usage:
// const counter = new CounterStream(5);
// counter.on('data', chunk => console.log(chunk));
// counter.on('end', () => console.log('done'));
// Output: 0, 1, 2, 3, 4, done

// ─────────────────────────────────────────────
// Q4. Custom Writable stream
// ─────────────────────────────────────────────
class ArrayCollector extends Writable {
  constructor(options) {
    super({ ...options, objectMode: true });
    this.items = [];
  }

  _write(chunk, encoding, callback) {
    this.items.push(chunk);
    callback(); // MUST call to signal ready for more data
  }

  _final(callback) {
    console.log("Collected:", this.items);
    callback();
  }
}

// ─────────────────────────────────────────────
// Q5. Custom Transform stream
// Reads data from one side, emits different data on the other
// ─────────────────────────────────────────────

// Uppercase transformer
class UpperCaseTransform extends Transform {
  _transform(chunk, encoding, callback) {
    this.push(chunk.toString().toUpperCase());
    callback();
  }
}

// CSV to JSON transformer
class CsvToJson extends Transform {
  constructor(options) {
    super({ ...options });
    this._headers = null;
    this._buffer = "";
  }

  _transform(chunk, encoding, callback) {
    this._buffer += chunk.toString();
    const lines = this._buffer.split("\n");
    this._buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (!line.trim()) continue;
      if (!this._headers) {
        this._headers = line.split(",").map((h) => h.trim());
      } else {
        const values = line.split(",").map((v) => v.trim());
        const obj = Object.fromEntries(this._headers.map((h, i) => [h, values[i]]));
        this.push(JSON.stringify(obj) + "\n");
      }
    }
    callback();
  }

  _flush(callback) {
    if (this._buffer.trim() && this._headers) {
      const values = this._buffer.split(",").map((v) => v.trim());
      const obj = Object.fromEntries(this._headers.map((h, i) => [h, values[i]]));
      this.push(JSON.stringify(obj) + "\n");
    }
    callback();
  }
}

// ─────────────────────────────────────────────
// Q6. Backpressure handling
// When consumer is slower than producer, Writable signals to pause
// ─────────────────────────────────────────────
function writeWithBackpressure(readable, writable) {
  readable.on("data", (chunk) => {
    const canContinue = writable.write(chunk);
    if (!canContinue) {
      readable.pause();            // slow down!
      writable.once("drain", () => {
        readable.resume();         // writer ready, resume
      });
    }
  });

  readable.on("end", () => writable.end());
  readable.on("error", (err) => writable.destroy(err));
  writable.on("error", (err) => readable.destroy(err));
}
// NOTE: pipeline() handles this automatically — prefer it over manual handling

// ─────────────────────────────────────────────
// Q7. Buffer basics
// ─────────────────────────────────────────────

// Create a buffer
const buf1 = Buffer.from("Hello, World!", "utf8");
const buf2 = Buffer.alloc(10);          // zero-filled, 10 bytes
const buf3 = Buffer.allocUnsafe(10);    // faster, uninitialized memory — fill before use!

console.log(buf1.toString("utf8"));     // "Hello, World!"
console.log(buf1.toString("hex"));      // hex string
console.log(buf1.toString("base64"));   // base64 string
console.log(buf1.length);               // byte count, NOT character count

// Buffer → JSON
const json = buf1.toJSON(); // { type: 'Buffer', data: [...] }

// Concatenate buffers
const combined = Buffer.concat([buf1, Buffer.from("!!!")]);

// Slice (shares memory!)
const slice = buf1.slice(0, 5); // "Hello"

// Copy (independent)
const copy = Buffer.allocUnsafe(5);
buf1.copy(copy, 0, 0, 5);

// ─────────────────────────────────────────────
// Q8. Streaming HTTP response
// ─────────────────────────────────────────────
const http = require("http");

const server = http.createServer((req, res) => {
  if (req.url === "/stream") {
    res.writeHead(200, { "Content-Type": "text/plain" });

    // Stream 100 lines, one per second
    let i = 0;
    const interval = setInterval(() => {
      res.write(`Line ${i++}\n`);
      if (i >= 100) {
        clearInterval(interval);
        res.end();
      }
    }, 10);

    req.on("close", () => clearInterval(interval)); // client disconnected
  } else if (req.url === "/file") {
    // Stream a file directly to response
    const fileStream = fs.createReadStream("./large-file.txt");
    fileStream.pipe(res);
    fileStream.on("error", () => { res.statusCode = 404; res.end("Not found"); });
  }
});

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is backpressure in streams?
  A: When data is produced faster than it can be consumed, the internal
     buffer fills up. The Writable signals the Readable to pause (returns
     false from write()). The Readable resumes on the 'drain' event.
     pipeline() automates this.

  Q: What is the difference between Buffer.alloc and Buffer.allocUnsafe?
  A: alloc: zero-fills the buffer (safe, slightly slower)
     allocUnsafe: leaves old memory (fast but may expose sensitive data if not filled)

  Q: When should you use streams vs loading data entirely?
  A: Streams: large files, HTTP responses, real-time data, CSV/log processing
     Buffered: small files, database rows that need full context, JSON APIs

  Q: What is objectMode in streams?
  A: By default, streams work with Buffers/strings.
     objectMode: true allows passing any JS value through the stream.
     Use for data transformation pipelines (CSV → objects → database rows).

  Q: How does pipe() differ from pipeline()?
  A: pipe() doesn't propagate errors — if source errors, destination stays open.
     pipeline() properly destroys all streams on error and returns a callback/promise.
     Always use pipeline() in production code.
*/

module.exports = { countLines, compressFile, CounterStream, ArrayCollector, CsvToJson };

---
```

<a id="nodejs-express-middleware"></a>
## 03_express_middleware.js — QUESTION SET: Express.js Middleware & Patterns

```javascript
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
// MUST be registered LAST with 4 parameters
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

---
```

<a id="nodejs-authentication"></a>
## 04_authentication.js — QUESTION SET: Node.js Authentication & JWT

```javascript
/**
 * QUESTION SET: Node.js Authentication & JWT
 *
 * 1. Password hashing with bcrypt
 * 2. JWT sign / verify
 * 3. Refresh token rotation
 * 4. Session storage with Redis
 * 5. Passport.js integration
 * 6. OAuth2 patterns
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// ─────────────────────────────────────────────
// Q1. Password hashing
// ─────────────────────────────────────────────

const SALT_ROUNDS = 12; // higher = slower = more secure (12 is a solid default)

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

async function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

// ─────────────────────────────────────────────
// Q2. JWT access token
// ─────────────────────────────────────────────

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;
const ACCESS_EXPIRY = "15m"; // short-lived

function signAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRY,
    algorithm: "HS256",
  });
}

function verifyAccessToken(token) {
  // Throws JsonWebTokenError or TokenExpiredError
  return jwt.verify(token, ACCESS_SECRET);
}

// ─────────────────────────────────────────────
// Q3. Refresh token rotation
//
// - Refresh token is long-lived (7d), stored in DB
// - On each use, old token is revoked + new token issued
//   (rotation prevents replay of stolen refresh tokens)
// ─────────────────────────────────────────────

const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
const REFRESH_EXPIRY = "7d";

function signRefreshToken(userId) {
  const jti = crypto.randomBytes(32).toString("hex"); // unique token ID
  const token = jwt.sign({ sub: userId, jti }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRY,
  });
  return { token, jti };
}

// Express route: POST /auth/refresh
async function refreshTokenRoute(req, res) {
  const { refreshToken } = req.cookies; // stored in HTTP-only cookie
  if (!refreshToken) return res.status(401).json({ error: "No refresh token" });

  let payload;
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  // Check token is in DB and not revoked
  const stored = await db.refreshToken.findUnique({ where: { jti: payload.jti } });
  if (!stored || stored.revoked) {
    // Possible token reuse — revoke entire family
    await db.refreshToken.updateMany({
      where: { userId: payload.sub },
      data: { revoked: true },
    });
    return res.status(401).json({ error: "Refresh token reuse detected" });
  }

  // Rotate: revoke old, issue new
  await db.refreshToken.update({ where: { jti: payload.jti }, data: { revoked: true } });

  const { token: newRefresh, jti: newJti } = signRefreshToken(payload.sub);
  await db.refreshToken.create({
    data: { jti: newJti, userId: payload.sub, expiresAt: new Date(Date.now() + 7 * 86400000) },
  });

  const newAccess = signAccessToken({ sub: payload.sub });

  res.cookie("refreshToken", newRefresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({ accessToken: newAccess });
}

// ─────────────────────────────────────────────
// Q4. Session-based auth with Redis
// ─────────────────────────────────────────────

const session = require("express-session");
const RedisStore = require("connect-redis").default;
const { createClient } = require("redis");

async function setupSession(app) {
  const redisClient = createClient({ url: process.env.REDIS_URL });
  await redisClient.connect();

  app.use(
    session({
      store: new RedisStore({ client: redisClient }),
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
      },
      name: "sid", // don't expose default 'connect.sid' name
    })
  );
}

// Login route
async function loginRoute(req, res) {
  const { email, password } = req.body;
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  // Regenerate session ID after login to prevent session fixation
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Session error" });
    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ message: "Logged in" });
  });
}

// Session auth middleware
function requireSession(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthenticated" });
  next();
}

// ─────────────────────────────────────────────
// Q5. JWT auth middleware (stateless)
// ─────────────────────────────────────────────

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = payload; // { sub, role, iat, exp }
    next();
  } catch (err) {
    const message = err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    return res.status(401).json({ error: message });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

// Protected route example
// router.get('/admin', authenticate, authorize('ADMIN'), (req, res) => res.json({ ok: true }));

// ─────────────────────────────────────────────
// Q6. OAuth2 with Passport.js (Google)
// ─────────────────────────────────────────────

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

function setupPassport(app) {
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Upsert user from Google profile
          const user = await db.user.upsert({
            where: { googleId: profile.id },
            create: {
              googleId: profile.id,
              email: profile.emails[0].value,
              name: profile.displayName,
              avatar: profile.photos[0]?.value,
            },
            update: { name: profile.displayName },
          });
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    const user = await db.user.findUnique({ where: { id } });
    done(null, user);
  });
}

// Routes
// app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
// app.get('/auth/google/callback',
//   passport.authenticate('google', { failureRedirect: '/login' }),
//   (req, res) => res.redirect('/dashboard')
// );

/*
  INTERVIEW QUESTIONS — THEORY

  Q: JWT vs Sessions — which is stateless?
  A: JWT is stateless (server doesn't store token state).
     Sessions are stateful (server stores session in DB/Redis).
     JWT advantage: horizontally scalable, no DB lookup per request.
     JWT disadvantage: can't revoke a token before it expires (unless using a blocklist/JTI store, which brings state back).

  Q: What attacks does httpOnly prevent?
  A: httpOnly cookies cannot be read via document.cookie, preventing XSS
     attacks from stealing tokens. Still vulnerable to CSRF — use sameSite + CSRF tokens.

  Q: What is PKCE in OAuth2?
  A: Proof Key for Code Exchange — prevents authorization code interception in public clients.
     Client generates code_verifier → SHA256 hash = code_challenge.
     Authorization server returns code, client redeems with code_verifier.
     Server verifies hash matches — proof that the same client initiated the flow.

  Q: How do you revoke a JWT?
  A: Three approaches:
     1. Short expiry (15m access tokens) — tokens naturally expire quickly
     2. JTI blocklist — store revoked JTIs in Redis; check on each request
     3. Use refresh token rotation — refresh tokens are stored/revoked in DB

  Q: What is session fixation?
  A: Attacker sets a known session ID before user logs in.
     After login, server must regenerate the session ID (req.session.regenerate).
     This is why you should always call regenerate() on successful login.

  Q: bcrypt vs Argon2 for password hashing?
  A: Both are slow hash functions designed for passwords.
     Argon2 (winner of Password Hashing Competition) is more configurable —
     can tune memory and parallelism in addition to time factor.
     Argon2id (hybrid) is the recommended modern choice.
     bcrypt is widely supported and battle-tested with cost factor >= 12.
*/

module.exports = {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  authenticate,
  authorize,
};

---
```

<a id="nodejs-event-emitter"></a>
## 05_event_emitter.js — QUESTION SET: Node.js EventEmitter & Custom Events

```javascript
/**
 * QUESTION SET: Node.js EventEmitter & Custom Events
 *
 * 1. EventEmitter basics — on / emit / once / off
 * 2. Custom EventEmitter class
 * 3. Event-driven architecture patterns
 * 4. Domain events pattern
 * 5. Memory leak prevention (maxListeners)
 * 6. AsyncEventEmitter (async listeners)
 */

const EventEmitter = require("events");

// ─────────────────────────────────────────────
// Q1. EventEmitter basics
// ─────────────────────────────────────────────

class OrderService extends EventEmitter {
  async placeOrder(order) {
    await saveOrderToDb(order);                  // save first
    this.emit("order:placed", order);            // then broadcast
  }

  async cancelOrder(orderId) {
    const order = await cancelInDb(orderId);
    this.emit("order:cancelled", { orderId, order });
  }
}

const orderService = new OrderService();

// Subscribe — executes every time
orderService.on("order:placed", (order) => {
  console.log("[EMAIL] Order confirmation to", order.email);
});

// Subscribe — executes only once
orderService.once("order:placed", () => {
  console.log("[ANALYTICS] First order in session");
});

// Prepend listener — runs before others
orderService.prependListener("order:placed", (order) => {
  console.log("[AUDIT] Order placed:", order.id);
});

// Remove a specific listener
function inventoryListener(order) {
  console.log("[INVENTORY] Reserve items for", order.id);
}
orderService.on("order:placed", inventoryListener);
orderService.off("order:placed", inventoryListener); // later removal

// Remove all listeners for an event
orderService.removeAllListeners("order:placed");

// ─────────────────────────────────────────────
// Q2. Custom lightweight EventEmitter (from scratch)
// ─────────────────────────────────────────────

class MyEventEmitter {
  #listeners = new Map(); // event → Set of listeners

  on(event, listener) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event).add(listener);
    return this; // allow chaining
  }

  once(event, listener) {
    const wrapper = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    wrapper._original = listener; // For removal by original reference
    return this.on(event, wrapper);
  }

  off(event, listener) {
    const set = this.#listeners.get(event);
    if (!set) return this;
    // Support removing by original reference (for once-wrapped listeners)
    for (const fn of set) {
      if (fn === listener || fn._original === listener) {
        set.delete(fn);
        break;
      }
    }
    return this;
  }

  emit(event, ...args) {
    const set = this.#listeners.get(event);
    if (!set) return false;
    for (const listener of set) {
      listener(...args);
    }
    return true;
  }

  listenerCount(event) {
    return this.#listeners.get(event)?.size ?? 0;
  }

  removeAllListeners(event) {
    if (event) {
      this.#listeners.delete(event);
    } else {
      this.#listeners.clear();
    }
    return this;
  }
}

// ─────────────────────────────────────────────
// Q3. Event-driven architecture — pub/sub within a process
// ─────────────────────────────────────────────

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // prevent accidental memory leak warning
  }

  publish(event, payload) {
    this.emit(event, { event, payload, timestamp: new Date() });
  }

  subscribe(event, handler) {
    this.on(event, handler);
    // Return unsubscribe function
    return () => this.off(event, handler);
  }
}

const bus = new EventBus();

// Subscriber 1 — email service
const unsubEmail = bus.subscribe("user:registered", ({ payload }) => {
  sendWelcomeEmail(payload.email);
});

// Subscriber 2 — analytics
bus.subscribe("user:registered", ({ payload, timestamp }) => {
  recordSignup(payload.userId, timestamp);
});

// Publisher
async function registerUser(email, password) {
  const user = await createUser(email, password);
  bus.publish("user:registered", { userId: user.id, email });
  return user;
}

// Later — clean up subscriber
unsubEmail();

// ─────────────────────────────────────────────
// Q4. Domain event pattern (DDD-style)
// Collect events during a transaction, emit after commit
// ─────────────────────────────────────────────

class AggregateRoot {
  #domainEvents = [];

  addDomainEvent(event) {
    this.#domainEvents.push(event);
  }

  getDomainEvents() {
    return [...this.#domainEvents];
  }

  clearDomainEvents() {
    this.#domainEvents = [];
  }
}

class User extends AggregateRoot {
  constructor(id, email) {
    super();
    this.id = id;
    this.email = email;
  }

  static create(id, email) {
    const user = new User(id, email);
    user.addDomainEvent({ type: "UserCreated", payload: { userId: id, email } });
    return user;
  }

  changeEmail(newEmail) {
    const oldEmail = this.email;
    this.email = newEmail;
    this.addDomainEvent({ type: "UserEmailChanged", payload: { userId: this.id, oldEmail, newEmail } });
  }
}

async function saveUserWithEvents(user, eventBus) {
  await db.user.save(user); // persists aggregate
  // Only emit events AFTER successful commit
  for (const event of user.getDomainEvents()) {
    eventBus.publish(event.type, event.payload);
  }
  user.clearDomainEvents();
}

// ─────────────────────────────────────────────
// Q5. Memory leak prevention
// ─────────────────────────────────────────────

/*
  Node.js warns when > 10 listeners on one event (default maxListeners).
  Common causes:
    - Adding listeners in event handlers or loops without cleanup
    - Forgetting to call removeListener when component/service is destroyed

  Best practices:
    1. Always store reference to listener so you can remove it: emitter.off(event, fn)
    2. Use once() instead of on() when handler should fire only once
    3. Increase maxListeners if you legitimately need > 10: emitter.setMaxListeners(20)
    4. Use emitter.rawListeners(event) to inspect current listeners
    5. Use WeakRef for listeners if emitter outlives the subscribing object
*/

// Anti-pattern: listener added on every request
function badMiddleware(req, res, next) {
  process.on("uncaughtException", (err) => {
    // BUG: adds a new listener on every request → memory leak
    console.error(err);
  });
  next();
}

// Fix: add once at startup
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

// ─────────────────────────────────────────────
// Q6. Async event listeners with error handling
// ─────────────────────────────────────────────

class AsyncEventEmitter extends EventEmitter {
  emitAsync(event, ...args) {
    const listeners = this.rawListeners(event);
    return Promise.all(listeners.map((fn) => Promise.resolve(fn(...args))));
  }

  // Forward errors from async listeners to 'error' event
  onAsync(event, asyncListener) {
    this.on(event, (...args) => {
      Promise.resolve(asyncListener(...args)).catch((err) => {
        this.emit("error", err);
      });
    });
    return this;
  }
}

// Usage
const asyncEmitter = new AsyncEventEmitter();

asyncEmitter.onAsync("data:received", async (data) => {
  await processData(data);        // if this throws, 'error' event fires
  await saveToDatabase(data);
});

asyncEmitter.on("error", (err) => {
  console.error("EventEmitter error:", err);
});

asyncEmitter.emit("data:received", { id: 1 });

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the difference between process.nextTick and EventEmitter callbacks?
  A: process.nextTick fires synchronously after the current operation, before any I/O.
     EventEmitter listeners fire synchronously during emit() by default.
     Use setImmediate or process.nextTick inside listeners to defer heavy work.

  Q: How does Node.js EventEmitter handle errors?
  A: All EventEmitter instances have special 'error' event handling.
     If 'error' is emitted and no listener is registered, Node.js throws it
     as an uncaught exception (potentially crashing the process).
     Always add: emitter.on('error', handler) before emitting errors.

  Q: What is the difference between EventEmitter and streams?
  A: Streams extend EventEmitter. Streams add: backpressure, piping, ordering
     guarantees (data flows in chunks). EventEmitter is the underlying pub/sub mechanism.

  Q: How do you implement request/response over EventEmitter?
  A: Use a unique ID (UUID) and register a one-time listener for that ID:
     const id = uuid();
     emitter.once(`response:${id}`, resolve);
     emitter.emit('request', { id, payload });
     This is the standard pattern for async RPC over an event bus.

  Q: Wildcard event names — does Node's EventEmitter support them?
  A: No. Standard EventEmitter requires exact event name matches.
     Use the 'eventemitter2' npm package for wildcard/glob support:
     emitter.on('user.*', handler)  // matches user.created, user.deleted
*/

// ─────────────────────────────────────────────
// Helpers (stubs for examples above)
// ─────────────────────────────────────────────
async function saveOrderToDb(order) {}
async function cancelInDb(orderId) {}
async function sendWelcomeEmail(email) {}
async function recordSignup(userId, timestamp) {}
async function createUser(email, password) { return { id: "1", email }; }
async function processData(data) {}
async function saveToDatabase(data) {}
const db = { user: { save: async () => {} } };

module.exports = { MyEventEmitter, EventBus, AsyncEventEmitter };

---
```

<a id="nodejs-cluster-workers"></a>
## 06_cluster_workers.js — QUESTION SET: Node.js Cluster, Worker Threads & child_process

```javascript
/**
 * QUESTION SET: Node.js Cluster, Worker Threads & child_process
 *
 * 1. cluster module — multi-core HTTP server
 * 2. worker_threads — CPU-bound work off the main thread
 * 3. Shared memory with SharedArrayBuffer + Atomics
 * 4. child_process — spawn / exec / fork
 * 5. Process communication patterns
 */

const os = require("os");
const cluster = require("cluster");
const { Worker, isMainThread, parentPort, workerData, MessageChannel } = require("worker_threads");
const { spawn, exec, fork } = require("child_process");

// ─────────────────────────────────────────────
// Q1. cluster module
// Each worker is a separate OS process (separate V8 heap, event loop)
// Primary process distributes incoming TCP connections via round-robin
// ─────────────────────────────────────────────

function startClusteredServer() {
  if (cluster.isPrimary) {
    const numCPUs = os.cpus().length;
    console.log(`Primary PID ${process.pid} — forking ${numCPUs} workers`);

    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
      console.warn(`Worker ${worker.process.pid} died (${signal || code}). Respawning…`);
      cluster.fork(); // auto-restart
    });

    // Graceful shutdown — drain workers, then kill them
    process.on("SIGTERM", () => {
      for (const id in cluster.workers) {
        cluster.workers[id].send("shutdown");
      }
    });
  } else {
    // Each worker runs an independent Express instance
    const express = require("express");
    const app = express();
    app.get("/", (req, res) => res.send(`Worker ${process.pid}`));
    app.listen(3000, () => console.log(`Worker ${process.pid} listening`));

    // Graceful shutdown message from primary
    process.on("message", (msg) => {
      if (msg === "shutdown") {
        // Stop accepting new connections
        app.close(() => process.exit(0));
      }
    });
  }
}

// ─────────────────────────────────────────────
// Q2. worker_threads — CPU-bound tasks
// Threads share the same memory — lower overhead than child processes
// V8 isolate per thread, but SharedArrayBuffer enables shared memory
// ─────────────────────────────────────────────

// Main thread
function runCpuTask(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: data, // Serialised (structured clone) and passed to worker
    });
    worker.on("message", resolve);
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

// Worker thread code (same file — guarded by isMainThread)
if (!isMainThread) {
  const { data } = workerData;
  const result = cpuIntensiveTask(data); // blocks this thread, not event loop
  parentPort.postMessage(result);
}

function cpuIntensiveTask(data) {
  // Example: compute prime numbers
  let count = 0;
  for (let n = 2; n <= data.limit; n++) {
    let prime = true;
    for (let i = 2; i <= Math.sqrt(n); i++) {
      if (n % i === 0) { prime = false; break; }
    }
    if (prime) count++;
  }
  return count;
}

// ─────────────────────────────────────────────
// Q3. Worker Thread Pool (reuse workers)
// Creating a worker per-request is expensive.
// Maintain a pool and queue tasks.
// ─────────────────────────────────────────────

class WorkerPool {
  #workers = [];
  #queue = [];
  #size;

  constructor(workerScript, size = os.cpus().length) {
    this.#size = size;
    for (let i = 0; i < size; i++) {
      this.#createWorker(workerScript);
    }
  }

  #createWorker(script) {
    const worker = new Worker(script);
    const entry = { worker, busy: false };
    worker.on("message", ({ id, result, error }) => {
      entry.busy = false;
      const pending = this.#queue.find((t) => t.id === id);
      if (pending) {
        this.#queue = this.#queue.filter((t) => t.id !== id);
        error ? pending.reject(new Error(error)) : pending.resolve(result);
      }
      this.#drain(); // pick next task from queue
    });
    this.#workers.push(entry);
  }

  run(data) {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(2);
      this.#queue.push({ id, data, resolve, reject });
      this.#drain();
    });
  }

  #drain() {
    const idle = this.#workers.find((w) => !w.busy);
    const next = this.#queue.find((t) => !t.inFlight);
    if (idle && next) {
      idle.busy = true;
      next.inFlight = true;
      idle.worker.postMessage({ id: next.id, data: next.data });
    }
  }

  destroy() {
    this.#workers.forEach(({ worker }) => worker.terminate());
  }
}

// ─────────────────────────────────────────────
// Q4. SharedArrayBuffer + Atomics
// Multiple threads reading/writing same memory — needs synchronisation
// ─────────────────────────────────────────────

function sharedMemoryExample() {
  const sharedBuffer = new SharedArrayBuffer(4 * Int32Array.BYTES_PER_ELEMENT);
  const shared = new Int32Array(sharedBuffer);

  // Atomic increment (thread-safe counter)
  // Atomics.add reads, adds and writes atomically — no race condition
  Atomics.add(shared, 0, 1);

  // Lock pattern using Atomics.compareExchange (simple spinlock)
  function lock(index) {
    while (Atomics.compareExchange(shared, index, 0, 1) !== 0) {
      Atomics.wait(shared, index, 1); // park thread until value changes
    }
  }

  function unlock(index) {
    Atomics.store(shared, index, 0);
    Atomics.notify(shared, index, 1); // wake one waiting thread
  }

  return { sharedBuffer, shared };
}

// ─────────────────────────────────────────────
// Q5. child_process.spawn — stream large outputs
// ─────────────────────────────────────────────

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Command failed (${code}): ${Buffer.concat(stderr).toString()}`));
      }
      resolve(Buffer.concat(stdout).toString());
    });

    child.on("error", reject);
  });
}

// child_process.exec — buffer output (small outputs only, default maxBuffer 1MB)
function execCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
  });
}

// ─────────────────────────────────────────────
// Q6. child_process.fork — separate Node process with IPC
// ─────────────────────────────────────────────

// main.js
function runForkedWorker() {
  const child = fork("./worker-process.js", [], {
    env: { ...process.env, WORKER_ID: "1" },
  });

  child.send({ type: "COMPUTE", data: { limit: 1_000_000 } });

  child.on("message", (msg) => {
    if (msg.type === "RESULT") {
      console.log("Prime count:", msg.result);
      child.kill();
    }
  });

  child.on("exit", (code) => {
    console.log("Worker exited with code", code);
  });
}

// worker-process.js (separate file)
/*
process.on('message', (msg) => {
  if (msg.type === 'COMPUTE') {
    const result = countPrimes(msg.data.limit);
    process.send({ type: 'RESULT', result });
    process.exit(0);
  }
});
*/

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the difference between cluster and worker_threads?

  Cluster:
    - Separate OS processes — separate V8 heaps, event loops
    - Full isolation — a crash in one worker doesn't affect others
    - Higher memory overhead (each process loads Node.js runtime)
    - Shares TCP server (kernel distributes connections)
    - Use for: scaling I/O-bound HTTP servers across cores

  worker_threads:
    - OS threads within the same process
    - Shared memory via SharedArrayBuffer
    - Lower overhead than processes
    - A crash in a worker can still crash the process in some scenarios
    - Use for: CPU-intensive tasks (image processing, parsing, crypto)

  Q: Why can't you share closures between worker threads?
  A: Each Worker thread runs in its own V8 isolate — separate heap.
     You communicate via postMessage (structured clone algorithm) or SharedArrayBuffer.
     Structured clone copies data — it's not a shared reference.
     Functions cannot be transferred (only data).

  Q: What is the structured clone algorithm?
  A: The serialisation mechanism used by postMessage and worker_threads.
     Supports: primitives, Arrays, Objects, Date, RegExp, Map, Set, ArrayBuffer, TypedArrays, Blob.
     Does NOT support: functions, DOM nodes, class instances with prototypes.
     Circular references are handled correctly.

  Q: When would you use child_process.fork over worker_threads?
  A: fork() for:
     - Running an entirely separate Node.js script (different codebase)
     - When you need full process isolation (crash isolation)
     - When the worker needs its own memory, env, and event listeners
  worker_threads for:
     - Sharing memory (SharedArrayBuffer)
     - Lower overhead when spawning many threads
     - Keeping the thread pool within one process

  Q: How do you prevent zombie processes?
  A: Always handle the 'exit' and 'error' events of child processes.
     Call child.kill() when done, or use detached + unref() for truly
     independent background processes.
     In cluster: listen for 'exit' on the primary and respawn workers.
*/

module.exports = { WorkerPool, runCommand, execCommand };

---
```

<a id="nodejs-file-system"></a>
## 07_file_system.js — QUESTION SET: Node.js File System (fs)

```javascript
/**
 * QUESTION SET: Node.js File System (fs)
 *
 * 1. fs.promises (async/await API)
 * 2. Streaming large files
 * 3. path module
 * 4. Directory traversal / recursive walk
 * 5. Watching files (fs.watch)
 * 6. CSV processing pipeline
 */

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { pipeline, Transform } = require("stream");
const { promisify } = require("util");
const pipelineAsync = promisify(pipeline);

// ─────────────────────────────────────────────
// Q1. fs.promises — async file operations
// ─────────────────────────────────────────────

async function readJsonFile(filePath) {
  const content = await fsp.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  await fsp.mkdir(dir, { recursive: true }); // create parent dirs if needed
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

// Atomic write: write to temp file then rename to prevent partial writes
async function atomicWrite(filePath, data) {
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  try {
    await fsp.writeFile(tmpPath, data, "utf8");
    await fsp.rename(tmpPath, filePath); // atomic on same filesystem
  } catch (err) {
    await fsp.unlink(tmpPath).catch(() => {}); // cleanup temp
    throw err;
  }
}

// File existence check (stat throws ENOENT if missing)
async function fileExists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Copy file with metadata preservation
async function copyFile(src, dest) {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.copyFile(src, dest, fs.constants.COPYFILE_EXCL); // fail if dest exists
}

// ─────────────────────────────────────────────
// Q2. Streaming large files (avoid loading entire file into memory)
// ─────────────────────────────────────────────

// Count lines without loading entire file into memory
async function countLines(filePath) {
  let count = 0;
  let remainder = "";

  const readable = fs.createReadStream(filePath, { encoding: "utf8", highWaterMark: 64 * 1024 });

  for await (const chunk of readable) {
    const lines = (remainder + chunk).split("\n");
    remainder = lines.pop(); // last incomplete line
    count += lines.length;
  }

  if (remainder.length > 0) count++; // final line without trailing newline
  return count;
}

// Stream-based file copy (efficient for large files)
async function streamCopy(src, dest) {
  const reader = fs.createReadStream(src);
  const writer = fs.createWriteStream(dest);
  await pipelineAsync(reader, writer);
}

// Stream → gzip compress
const zlib = require("zlib");

async function gzipFile(src, dest) {
  await pipelineAsync(
    fs.createReadStream(src),
    zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION }),
    fs.createWriteStream(dest)
  );
}

// ─────────────────────────────────────────────
// Q3. path module — cross-platform
// ─────────────────────────────────────────────

function pathExamples() {
  const full = "/home/user/docs/report.pdf";

  path.dirname(full);           // /home/user/docs
  path.basename(full);          // report.pdf
  path.basename(full, ".pdf");  // report
  path.extname(full);           // .pdf

  path.join("/home", "user", "docs");          // /home/user/docs (normalised)
  path.resolve("./config", "../.env");         // absolute resolved path

  // Cross-platform
  path.sep;   // '/' on POSIX, '\' on Windows
  path.delimiter; // ':' on POSIX, ';' on Windows (PATH env separator)

  // Safe against path traversal attacks
  const root = "/var/uploads";
  const userInput = "../../etc/passwd";
  const resolved = path.resolve(root, userInput);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error("Path traversal detected");
  }
}

// ─────────────────────────────────────────────
// Q4. Recursive directory walk
// ─────────────────────────────────────────────

// Using fs.promises.readdir with { withFileTypes: true }
async function* walkDir(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(fullPath); // recurse with async generator
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

// Collect all files with a specific extension
async function findFiles(rootDir, ext) {
  const results = [];
  for await (const file of walkDir(rootDir)) {
    if (path.extname(file) === ext) results.push(file);
  }
  return results;
}

// Parallel directory walk with concurrency limit
async function walkParallel(dir, concurrency = 10) {
  const results = [];
  const sem = new Semaphore(concurrency);

  async function visit(d) {
    await sem.acquire();
    try {
      const entries = await fsp.readdir(d, { withFileTypes: true });
      const subdirs = [];
      for (const e of entries) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) subdirs.push(p);
        else results.push(p);
      }
      await Promise.all(subdirs.map(visit));
    } finally {
      sem.release();
    }
  }

  await visit(dir);
  return results;
}

class Semaphore {
  #permits;
  #queue = [];
  constructor(n) { this.#permits = n; }
  acquire() {
    if (this.#permits > 0) { this.#permits--; return Promise.resolve(); }
    return new Promise((res) => this.#queue.push(res));
  }
  release() {
    if (this.#queue.length > 0) { this.#queue.shift()(); }
    else { this.#permits++; }
  }
}

// ─────────────────────────────────────────────
// Q5. File watching
// ─────────────────────────────────────────────

function watchConfig(configPath, onChange) {
  // fs.watch uses inotify/FSEvents — efficient but event may fire multiple times
  let debounceTimer;
  const watcher = fs.watch(configPath, { persistent: false }, (eventType) => {
    if (eventType === "change") {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const config = await readJsonFile(configPath);
          onChange(config);
        } catch (err) {
          console.error("Config reload failed:", err);
        }
      }, 100);
    }
  });

  watcher.on("error", (err) => console.error("Watcher error:", err));
  return () => watcher.close(); // return cleanup function
}

// ─────────────────────────────────────────────
// Q6. CSV processing Transform stream pipeline
// ─────────────────────────────────────────────

const { createReadStream, createWriteStream } = fs;

function createCsvParserStream() {
  let tail = "";
  let headers = null;

  return new Transform({
    readableObjectMode: true, // outputs plain objects
    writableObjectMode: false, // receives buffer/string chunks

    transform(chunk, _encoding, callback) {
      const text = tail + chunk.toString("utf8");
      const lines = text.split("\n");
      tail = lines.pop(); // keep incomplete last line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const values = trimmed.split(",").map((v) => v.trim());
        if (!headers) {
          headers = values;
        } else {
          const obj = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
          this.push(obj);
        }
      }
      callback();
    },

    flush(callback) {
      if (tail.trim() && headers) {
        const values = tail.trim().split(",").map((v) => v.trim());
        const obj = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
        this.push(obj);
      }
      callback();
    },
  });
}

async function processCsv(inputPath, outputPath, transformFn) {
  await pipelineAsync(
    createReadStream(inputPath),
    createCsvParserStream(),
    new Transform({
      objectMode: true,
      transform(row, _enc, cb) {
        cb(null, JSON.stringify(transformFn(row)) + "\n");
      },
    }),
    createWriteStream(outputPath)
  );
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the difference between readFile and createReadStream?
  A: readFile loads the entire file into memory as a Buffer/string.
     createReadStream reads in chunks (highWaterMark, default 64KB),
     keeping memory usage constant regardless of file size.
     For files > a few MB, always prefer streams.

  Q: Why might fs.watch fire events multiple times?
  A: Editors and OS file systems often write files in stages (rename trick) —
     write to temp, then rename to original — triggering multiple events.
     Debounce the handler to coalesce rapid events.

  Q: What does recursive: true do in fs.mkdir?
  A: Creates all intermediate directories that don't yet exist (like mkdir -p).
     Does NOT throw if the directory already exists.

  Q: What is the difference between __dirname and path.resolve('.')?
  A: __dirname: the directory of the current module file — consistent.
     path.resolve('.'): current working directory (process.cwd()) — changes if
     the process was started from a different location.

  Q: How do you safely read user-supplied file paths?
  A: Resolve to an absolute path with path.resolve, then check it starts
     with the permitted root directory.
     const resolved = path.resolve(ROOT, userInput);
     if (!resolved.startsWith(ROOT + path.sep)) throw new Error('Path traversal');

  Q: What is ENOENT vs ENOTDIR?
  A: ENOENT — no such file or directory (path does not exist).
     ENOTDIR — a component of the path exists but is not a directory.
     EACCES / EPERM — permission denied.
     Check err.code to handle specific error conditions.
*/

module.exports = {
  readJsonFile,
  writeJsonFile,
  atomicWrite,
  fileExists,
  countLines,
  gzipFile,
  walkDir,
  findFiles,
  watchConfig,
  processCsv,
};

---
```

<a id="nodejs-error-handling"></a>
## 08_error_handling.js — QUESTION SET: Node.js Error Handling

```javascript
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

---
```

<a id="nodejs-rest-api-patterns"></a>
## 09_rest_api_patterns.js — QUESTION SET: Node.js REST API Patterns

```javascript
/**
 * QUESTION SET: Node.js REST API Patterns
 *
 * 1. RESTful routing conventions
 * 2. Input validation with Zod
 * 3. Cursor-based pagination
 * 4. Filter / sort / field selection (sparse fieldsets)
 * 5. Rate limiting
 * 6. API versioning
 * 7. Idempotency keys
 * 8. HATEOAS links
 */

const express = require("express");
const { z } = require("zod");
const crypto = require("crypto");

// ─────────────────────────────────────────────
// Q1. RESTful routing conventions
// ─────────────────────────────────────────────

const router = express.Router();

// Resource: /api/v1/posts
// GET    /posts           → list (paginated)
// POST   /posts           → create
// GET    /posts/:id       → get one
// PUT    /posts/:id       → full replace
// PATCH  /posts/:id       → partial update
// DELETE /posts/:id       → delete

// Nested resources
// GET  /posts/:id/comments     → comments for a post
// POST /posts/:id/comments     → add comment to a post

// ─────────────────────────────────────────────
// Q2. Input validation with Zod
// ─────────────────────────────────────────────

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  content: z.string().min(1).max(10_000),
  tags: z.array(z.string().max(50)).max(10).default([]),
  published: z.boolean().default(false),
});

const UpdatePostSchema = CreatePostSchema.partial(); // all fields optional for PATCH

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields = Object.fromEntries(
        result.error.errors.map((e) => [e.path.join("."), e.message])
      );
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", fields } });
    }
    req.body = result.data; // replace with parsed/coerced data
    next();
  };
}

// Query params validation
const ListPostsQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["createdAt", "updatedAt", "title"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  tags: z.string().optional().transform((v) => v?.split(",").filter(Boolean)),
  fields: z.string().optional().transform((v) => v?.split(",").filter(Boolean)),
});

// ─────────────────────────────────────────────
// Q3. Cursor-based pagination
// Safer than offset pagination for large/changing datasets
// ─────────────────────────────────────────────

// Cursor encodes {id, sortValue} to be opaque to clients
function encodeCursor(id, sortValue) {
  return Buffer.from(JSON.stringify({ id, sortValue })).toString("base64url");
}

function decodeCursor(cursor) {
  return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
}

async function listPosts(db, { cursor, limit, sort, order, tags }) {
  const take = limit + 1; // fetch one extra to determine hasNextPage
  const where = {};

  if (tags?.length) {
    where.tags = { hasSome: tags };
  }

  // Cursor condition — fetch records after the cursor
  if (cursor) {
    const { id, sortValue } = decodeCursor(cursor);
    where[sort] = order === "desc" ? { lt: sortValue } : { gt: sortValue };
    // Tie-breaking by ID when sort values collide
    where.OR = [
      { [sort]: order === "desc" ? { lt: sortValue } : { gt: sortValue } },
      { [sort]: sortValue, id: order === "desc" ? { lt: id } : { gt: id } },
    ];
  }

  const posts = await db.post.findMany({
    where,
    orderBy: [{ [sort]: order }, { id: order }], // secondary sort by id
    take,
  });

  const hasNextPage = posts.length > limit;
  const items = hasNextPage ? posts.slice(0, -1) : posts;

  const nextCursor = hasNextPage
    ? encodeCursor(items[items.length - 1].id, items[items.length - 1][sort])
    : null;

  return {
    items,
    pagination: {
      hasNextPage,
      nextCursor,
      count: items.length,
    },
  };
}

// ─────────────────────────────────────────────
// Q4. Sparse fieldsets — only return requested fields
// GET /posts?fields=id,title,createdAt
// ─────────────────────────────────────────────

function applyFieldFilter(data, fields) {
  if (!fields?.length) return data;
  if (Array.isArray(data)) return data.map((item) => pick(item, fields));
  return pick(data, fields);
}

function pick(obj, keys) {
  return Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));
}

// ─────────────────────────────────────────────
// Q5. In-memory rate limiter (production: use Redis)
// ─────────────────────────────────────────────

class InMemoryRateLimiter {
  #store = new Map();

  constructor(windowMs, max) {
    this.windowMs = windowMs;
    this.max = max;
    // Periodic cleanup to avoid memory growth
    setInterval(() => this.#cleanup(), windowMs).unref();
  }

  middleware() {
    return (req, res, next) => {
      const key = req.ip || req.headers["x-forwarded-for"] || "unknown";
      const now = Date.now();
      const window = Math.floor(now / this.windowMs);
      const storeKey = `${key}:${window}`;

      const count = (this.#store.get(storeKey) || 0) + 1;
      this.#store.set(storeKey, count);

      res.setHeader("X-RateLimit-Limit", this.max);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, this.max - count));
      res.setHeader("X-RateLimit-Reset", (window + 1) * this.windowMs);

      if (count > this.max) {
        return res.status(429).json({ error: "Too many requests" });
      }
      next();
    };
  }

  #cleanup() {
    const now = Date.now();
    for (const [key] of this.#store) {
      const window = parseInt(key.split(":").pop(), 10);
      if (window * this.windowMs < now - this.windowMs) {
        this.#store.delete(key);
      }
    }
  }
}

const apiLimiter = new InMemoryRateLimiter(60_000, 100); // 100 req/min

// ─────────────────────────────────────────────
// Q6. API versioning strategies
// ─────────────────────────────────────────────

// Strategy 1: URL prefix (most common)
// /api/v1/posts
// /api/v2/posts

// Express implementation
function mountVersionedRoutes(app) {
  const v1router = express.Router();
  const v2router = express.Router();

  // v1 routes
  v1router.get("/posts", listPostsV1);

  // v2 routes — different response shape
  v2router.get("/posts", listPostsV2);

  app.use("/api/v1", v1router);
  app.use("/api/v2", v2router);
}

// Strategy 2: Accept header versioning
// Accept: application/json; version=2
function versionFromHeader(req) {
  const accept = req.headers.accept || "";
  const match = accept.match(/version=(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

async function listPostsV1(req, res) { res.json({ posts: [] }); }
async function listPostsV2(req, res) { res.json({ data: [], meta: {} }); }

// ─────────────────────────────────────────────
// Q7. Idempotency keys — safe to retry POST requests
// ─────────────────────────────────────────────

function idempotencyMiddleware(cache) {
  return async (req, res, next) => {
    if (req.method !== "POST") return next();

    const key = req.headers["idempotency-key"];
    if (!key) return next(); // optional — only apply when header provided

    // Check if we've seen this key before
    const cached = await cache.get(`idempotency:${key}`);
    if (cached) {
      const { statusCode, body } = JSON.parse(cached);
      return res.status(statusCode).json(body);
    }

    // Intercept response to cache it
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      // Cache for 24h — prevents duplicate operations on retry
      cache.setEx(`idempotency:${key}`, 86400, JSON.stringify({ statusCode: res.statusCode, body }));
      return originalJson(body);
    };

    next();
  };
}

// ─────────────────────────────────────────────
// Q8. HATEOAS — hypermedia links in responses
// Clients can discover available actions from the response
// ─────────────────────────────────────────────

function addLinks(post, baseUrl) {
  return {
    ...post,
    _links: {
      self: { href: `${baseUrl}/posts/${post.id}`, method: "GET" },
      update: { href: `${baseUrl}/posts/${post.id}`, method: "PATCH" },
      delete: { href: `${baseUrl}/posts/${post.id}`, method: "DELETE" },
      comments: { href: `${baseUrl}/posts/${post.id}/comments`, method: "GET" },
      author: { href: `${baseUrl}/users/${post.authorId}`, method: "GET" },
    },
  };
}

// Full POST route example
router.post(
  "/posts",
  apiLimiter.middleware(),
  validate(CreatePostSchema),
  async (req, res, next) => {
    try {
      const post = await createPost(req.body, req.user);
      res.status(201).json(addLinks(post, req.baseUrl));
    } catch (err) {
      next(err);
    }
  }
);

router.get("/posts", async (req, res, next) => {
  try {
    const query = ListPostsQuery.parse(req.query);
    const result = await listPosts(db, query);
    res.json({
      data: applyFieldFilter(result.items, query.fields),
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
});

/*
  INTERVIEW QUESTIONS — THEORY

  Q: Offset vs cursor pagination — when to use which?
  A: Offset (LIMIT 20 OFFSET 40):
       Simple, allows jumping to any page.
       Inconsistent if rows are inserted/deleted during iteration (items skip or repeat).
       Slow for large offsets (DB must scan all rows up to offset).
  
     Cursor (WHERE id > ? LIMIT 20):
       Consistent — new rows don't affect the cursor window.
       Fast — uses an index on the cursor column.
       Does not support random page access ("jump to page 5").
     Use cursor for large/live feeds; offset for small stable datasets.

  Q: What is the difference between PUT and PATCH?
  A: PUT replaces the entire resource with the provided payload.
     Omitting a field means it's set to null/default.
     PATCH applies a partial update — only provided fields are updated.
     Use PATCH for partial updates to avoid accidentally nulling fields.

  Q: How do you handle 422 vs 400?
  A: 400 Bad Request: malformed syntax, unparseable JSON.
     422 Unprocessable Entity: syntactically valid but semantically invalid
     (e.g., email field has valid format but that email already exists).
     Many APIs use 400 for both — the distinction matters mainly in formal REST APIs.

  Q: How do idempotency keys prevent double charges?
  A: Client generates a unique key (UUID) per logical operation.
     Includes it in the Idempotency-Key header on each request.
     Server caches the response against that key (Redis, 24h).
     On retry (network fail), server returns cached response instead of re-executing.
     Guarantees the operation executes exactly once.

  Q: What is HATEOAS and why is it rarely used in practice?
  A: Hypermedia As The Engine Of Application State: responses contain
     links to available actions. Clients need not hard-code URLs.
     In practice it increases response payload size and complexity.
     Most real-world APIs use documented URLs rather than discovered links.
     Useful in public APIs where clients should be decoupled from URL structure.

  Q: How do you design an API for backward compatibility?
  A: Never remove or rename fields — add new fields instead.
     Version breaking changes (v2).
     Use API deprecation headers: Deprecation, Sunset.
     Maintain old versions long enough for clients to migrate.
     Expand/Contract pattern: add new format alongside old, migrate clients, remove old.
*/

async function createPost(data, user) { return { id: "1", ...data, authorId: user?.id }; }
const db = {};
const cache = { get: async () => null, setEx: async () => {} };

module.exports = { InMemoryRateLimiter, applyFieldFilter, encodeCursor, decodeCursor, listPosts };

---
```

<a id="nodejs-race-conditions"></a>
## 10_race_conditions.js — RACE CONDITIONS IN NODE.JS — WHAT THEY ARE AND HOW TO AVOID THEM

```javascript
/**
 * RACE CONDITIONS IN NODE.JS — WHAT THEY ARE AND HOW TO AVOID THEM
 *
 * A race condition happens when the outcome of your code depends on
 * the ORDER in which asynchronous operations complete — and that order
 * is unpredictable. They are silent bugs: the code looks correct but
 * misbehaves under concurrent load.
 *
 * Topics covered:
 * 1. Classic async race (stale data overwrite)
 * 2. Database race conditions (check-then-act)
 * 3. File system races
 * 4. Mutex (Mutual Exclusion Lock)
 * 5. Atomic DB operations
 * 6. Redis distributed lock
 * 7. Queue-based serialisation
 * 8. Promise.all vs sequential (deliberate vs accidental concurrency)
 * 9. Event Emitter race
 * 10. Interview Questions
 */

'use strict';

const fs = require('fs/promises');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

// ─────────────────────────────────────────────────────────────────────────────
// 1. CLASSIC ASYNC RACE — STALE DATA OVERWRITE
// WHAT: How can race conditions occur when two concurrent requests read-modify-write shared state?
// THEORY: Request A reads value, B reads same value before A writes. Both write independently, one overwrites. Happens with async DB/file ops. Mutex locks prevent interleaving
// Time: O(1) per op  Space: O(1)
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: Two simultaneous requests both read the counter, both increment,
//         both write back. One write silently overwrites the other.
//
// Timeline (2 concurrent callers):
//   Caller A reads count = 5
//   Caller B reads count = 5  ← reads BEFORE A has written
//   Caller A writes count = 6
//   Caller B writes count = 6  ← should be 7, but overwrites A's result!
//
// Result: counter is 6 instead of 7. One increment is lost.

let counter = 0; // in-memory shared state

async function incrementCounterBAD() {
  const current = counter;                    // read
  await new Promise(r => setTimeout(r, 10)); // simulate async work (e.g. DB read)
  counter = current + 1;                     // write — RACE: current is now stale!
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FIX — MUTEX (Mutual Exclusion Lock)
// WHAT: How does a Mutex lock prevent concurrent access to critical sections?
// THEORY: _locked flag + _queue of waiting callers. acquire() returns Promise when lock available. _release() marks unlocked, resolves next waiter. FIFO queue ordering prevents races
// Time: O(1) acquire  Space: O(w) waiters in queue
// A mutex ensures only ONE piece of code runs a critical section at a time.
// Others wait in a queue until the lock is released.
// ─────────────────────────────────────────────────────────────────────────────

class Mutex {
  constructor() {
    // _queue holds resolve functions of waiting callers.
    // When the lock is released, the next waiter's Promise resolves.
    this._queue = [];
    this._locked = false;
  }

  /**
   * Acquire the lock. Returns a Promise that resolves with a release function.
   * Always call release() in a finally block to avoid deadlocks.
   */
  acquire() {
    return new Promise(resolve => {
      if (!this._locked) {
        // No one holds the lock — take it immediately
        this._locked = true;
        resolve(() => this._release()); // give caller a release function
      } else {
        // Lock is held — queue this caller
        this._queue.push(resolve);
      }
    });
  }

  _release() {
    if (this._queue.length > 0) {
      // Hand the lock to the next waiter in the queue (FIFO order)
      const next = this._queue.shift();
      next(() => this._release());
    } else {
      // No one waiting — unlock
      this._locked = false;
    }
  }
}

const mutex = new Mutex();

async function incrementCounterSafe() {
  const release = await mutex.acquire(); // blocks until previous caller finishes
  try {
    const current = counter;
    await new Promise(r => setTimeout(r, 10)); // simulate async work
    counter = current + 1;                     // safe: no other caller can interfere
  } finally {
    release(); // ALWAYS release in finally so the lock is freed even on error
  }
}

// Demo function
async function demoMutex() {
  counter = 0;
  // Fire 5 increments concurrently — with mutex, all 5 are serialised
  await Promise.all([
    incrementCounterSafe(),
    incrementCounterSafe(),
    incrementCounterSafe(),
    incrementCounterSafe(),
    incrementCounterSafe(),
  ]);
  console.log('Count with mutex:', counter); // always 5 ✅
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DATABASE RACE — CHECK-THEN-ACT (TOCTOU)
// "Time of Check vs Time of Use"
// Two requests check a condition at the same time, then both act on it.
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: Two users simultaneously try to register the same username.
//         Both SELECT and find 0 rows, both INSERT — duplicate user created!

async function registerUserBAD(db, username, email) {
  // Step 1: Check if username is free
  const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);

  // ← HERE: another request sneaks in and passes the same check before we INSERT

  if (existing.rows.length > 0) {
    throw new Error('Username already taken');
  }

  // Step 2: Insert — but another caller may have just inserted the same username!
  await db.query('INSERT INTO users (username, email) VALUES ($1, $2)', [username, email]);
}

// ✅ FIX 1: Database-level unique constraint (always do this as a baseline)
// CREATE UNIQUE INDEX CONCURRENTLY on users(username);
// The DB will reject the second INSERT with a constraint error — catch and handle it:

async function registerUserWithUniqueConstraint(db, username, email) {
  try {
    await db.query(
      'INSERT INTO users (username, email) VALUES ($1, $2)',
      [username, email],
    );
  } catch (err) {
    // PostgreSQL error code 23505 = unique_violation
    if (err.code === '23505') throw new Error('Username already taken');
    throw err;
  }
}

// ✅ FIX 2: INSERT ... ON CONFLICT (upsert / atomic check-and-insert)
// A single atomic statement: insert only if username doesn't exist
async function registerUserAtomic(db, username, email) {
  const result = await db.query(
    `INSERT INTO users (username, email) VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING
     RETURNING id`,
    [username, email],
  );

  // If INSERT was blocked by conflict, RETURNING returns 0 rows
  if (result.rowCount === 0) throw new Error('Username already taken');
  return result.rows[0].id;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. INVENTORY / BALANCE CHECK RACE (SELECT FOR UPDATE)
// Classic e-commerce race: two orders placed simultaneously for the last item.
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: Both orders read stock = 1, both pass the check, both decrement
async function placeOrderBAD(db, productId, qty) {
  const { rows } = await db.query('SELECT stock FROM products WHERE id = $1', [productId]);
  const stock = rows[0].stock;

  // Another request reads stock=1 HERE before we UPDATE below
  if (stock < qty) throw new Error('Out of stock');

  await db.query('UPDATE products SET stock = stock - $2 WHERE id = $1', [productId, qty]);
}

// ✅ GOOD: SELECT FOR UPDATE locks the row in a transaction.
// The second caller WAITS at the SELECT until the first transaction commits/rollbacks.
async function placeOrderSafe(db, productId, qty) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // FOR UPDATE acquires a row-level lock — no other transaction can touch this row
    const { rows } = await client.query(
      'SELECT stock FROM products WHERE id = $1 FOR UPDATE',
      [productId],
    );

    const stock = rows[0].stock;

    if (stock < qty) {
      await client.query('ROLLBACK');
      throw new Error('Out of stock');
    }

    await client.query(
      'UPDATE products SET stock = stock - $2 WHERE id = $1',
      [productId, qty],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // always release connection back to pool
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. REDIS DISTRIBUTED LOCK (cross-process / cross-server)
// In-process Mutex only works within one Node.js process.
// For multiple servers (horizontal scaling), use a distributed lock in Redis.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Acquires a Redis-based distributed lock using SET NX EX (atomic).
 *
 * NX = Set only if Not eXists (prevents two callers from acquiring simultaneously)
 * EX = Expiry in seconds (prevents deadlock if the holder crashes)
 *
 * Uses a random token so only the lock owner can release it
 * (prevents accidentally releasing a lock acquired by another process after expiry).
 */
async function withRedisLock(redis, key, ttlSeconds, fn) {
  const token = Math.random().toString(36).substring(2); // unique owner token
  const lockKey = `lock:${key}`;

  // SET lock:key <token> NX EX <ttl>  — atomic: succeeds only if key doesn't exist
  const acquired = await redis.set(lockKey, token, 'NX', 'EX', ttlSeconds);

  if (!acquired) {
    throw new Error(`Could not acquire lock for ${key} — resource is busy`);
  }

  try {
    return await fn(); // run the critical section
  } finally {
    // Lua script: check token AND delete in one atomic operation
    // Without this, another process could acquire the lock between our GET and DEL
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await redis.eval(luaScript, 1, lockKey, token);
  }
}

// Usage example:
// await withRedisLock(redis, `product:${productId}`, 5, async () => {
//   await placeOrderBAD(db, productId, qty); // now safe across all servers
// });

// ─────────────────────────────────────────────────────────────────────────────
// 6. FILE SYSTEM RACE — CHECK THEN CREATE
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: check if file exists, then create — another process can create it
//         in the gap between the check and the create.
async function createFileBAD(filePath, content) {
  try {
    await fs.access(filePath); // check if file exists
    throw new Error('File already exists');
  } catch (accessErr) {
    if (accessErr.code !== 'ENOENT') throw accessErr; // re-throw non-"not found" errors
    await fs.writeFile(filePath, content);             // RACE: another process may create here
  }
}

// ✅ GOOD: Use the 'wx' flag — open for writing only if file doesn't exist.
// This is an ATOMIC operation at the OS level — no race possible.
async function createFileSafe(filePath, content) {
  try {
    // 'wx' = write + exclusive (fail if file exists)
    await fs.writeFile(filePath, content, { flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') throw new Error('File already exists');
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. PROMISE.ALL RACE — WHEN CONCURRENT IS WRONG
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: Promise.all runs both operations in parallel.
//         debitAccount runs at the same time as creditAccount.
//         If debit succeeds but credit fails: money is lost with no compensation.
async function transferMoneyBAD(db, fromId, toId, amount) {
  await Promise.all([
    db.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]),
    db.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]),
  ]);
}

// ✅ GOOD: Sequential inside a transaction.
//          If credit fails, the entire transaction rolls back — atomic transfer.
async function transferMoneySafe(db, fromId, toId, amount) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Debit first, credit second — sequentially within a transaction
    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [amount, fromId],
    );
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [amount, toId],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK'); // debit is reversed if credit fails
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. SERIAL QUEUE — SERIALISE ASYNC OPERATIONS WITHOUT A MUTEX
// Useful when you have a stream of independent tasks but want them
// processed one-at-a-time (e.g. writing to a file, sending to a serial port).
// ─────────────────────────────────────────────────────────────────────────────

class SerialQueue {
  constructor() {
    // _promise tracks the "last task in line".
    // Each new task chains onto the end of the previous one.
    this._promise = Promise.resolve();
  }

  /**
   * Enqueues a task. The task is an async function that returns a Promise.
   * Returns a Promise that resolves with the task's result.
   */
  enqueue(task) {
    // Chain onto the running queue.
    // Even if a task throws, the queue continues (catch swallows internal errors).
    const result = this._promise.then(() => task());
    // Update the tail to be a version that never rejects (so the queue keeps going)
    this._promise = result.catch(() => {});
    return result; // returned Promise CAN reject — the caller handles their own error
  }
}

// Usage: safe sequential file writes without mutex boilerplate
const queue = new SerialQueue();

async function safeFileWrite(filePath, data) {
  return queue.enqueue(() => fs.writeFile(filePath, data, { flag: 'a' }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. RACE IN EVENT EMITTER — LISTENER ADDED TOO LATE
// ─────────────────────────────────────────────────────────────────────────────
const { EventEmitter } = require('events');

// ❌ BAD: 'data' event emitted synchronously in constructor BEFORE the caller
//         has a chance to attach a listener.
class DataFetcherBAD extends EventEmitter {
  constructor(url) {
    super();
    // This runs synchronously — any 'data' listener attached after
    // new DataFetcherBAD() will miss this event entirely.
    this.emit('data', { url, payload: [] });
  }
}

// const f = new DataFetcherBAD('/api');
// f.on('data', console.log); // ← MISSED — event was emitted in constructor

// ✅ GOOD: Defer the emit with setImmediate / process.nextTick so the caller
//          can attach listeners in the same synchronous execution frame.
class DataFetcherGood extends EventEmitter {
  constructor(url) {
    super();
    // setImmediate defers to the next iteration of the event loop,
    // giving the caller time to attach listeners after the constructor returns.
    setImmediate(() => {
      this.emit('data', { url, payload: [] });
    });
  }
}

// const f = new DataFetcherGood('/api');
// f.on('data', console.log); // ✅ attached before setImmediate fires

// ─────────────────────────────────────────────────────────────────────────────
// 10. USEEFFECT CLEANUP — RACE IN (FRONTEND / SSR CONTEXT)
// When using Node.js with React SSR, the same pattern causes stale responses.
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: A user types fast. Three fetches fire. The first one might respond
//         LAST due to network delays, overwriting the correct third result.
//
// In Node.js SSR or streaming: you cancel the earlier request.
// Use AbortController:

async function fetchUserSafe(userId) {
  const controller = new AbortController();
  const { signal } = controller;

  // Caller can call controller.abort() to cancel this request
  // (e.g., when a newer request fires)
  const res = await fetch(`https://api.example.com/users/${userId}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();

  // How to cancel from outside:
  // const controller = new AbortController();
  // const promise = fetchUserSafe('123');
  // controller.abort(); // cancels the in-flight request
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. SUMMARY: WHICH TOOL FOR WHICH RACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Problem                               | Solution
 * --------------------------------------|------------------------------------
 * In-memory shared state (1 process)    | Mutex class
 * DB: duplicate insert                  | UNIQUE constraint + ON CONFLICT
 * DB: stale read-then-write             | SELECT FOR UPDATE inside transaction
 * Money / account transfers             | DB transaction (BEGIN/COMMIT)
 * Multi-server shared resource          | Redis distributed lock (SET NX EX)
 * File system check-then-create         | 'wx' flag (atomic exclusive create)
 * Sequential task queue                 | SerialQueue / p-queue library
 * Event emitter emits before listener   | defer with setImmediate / nextTick
 * HTTP requests (stale response)        | AbortController + cancel on new request
 * Concurrent promises need ordering     | Sequential await, not Promise.all
 */

// ─────────────────────────────────────────────────────────────────────────────
// INTERVIEW QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

/*
Q: What is a race condition?
A: When two or more operations run concurrently, and the final outcome depends on
   which finishes first. The code looks fine in isolation but behaves incorrectly
   when two requests hit it at the same time.

Q: Is Node.js single-threaded? Can it have race conditions?
A: Node.js has one JavaScript thread — there is no true parallelism in JS code.
   BUT race conditions still happen because async operations (DB queries, file reads,
   HTTP calls) are non-blocking. Two requests are interleaved in the event loop:
   A reads → B reads → A writes → B writes (B's write clobbers A's).

Q: What is a mutex and when do you need one?
A: Mutex (Mutual Exclusion Lock) ensures only one async caller can run a critical
   section at a time. Needed when you have shared in-memory state that must be
   read-then-modified atomically. Example: an in-memory cache that is read and
   written by concurrent request handlers.

Q: What is SELECT FOR UPDATE in PostgreSQL?
A: It acquires a row-level exclusive lock when reading a row, so no other transaction
   can read (with FOR UPDATE) or modify that row until the lock is released. Use it
   when you need to read a value and then update it based on that value — prevents
   the check-then-act race.

Q: What is the difference between ON CONFLICT DO NOTHING and ON CONFLICT DO UPDATE?
A: ON CONFLICT DO NOTHING: if the insert violates a unique constraint, silently skip it.
   ON CONFLICT DO UPDATE (upsert): if conflict, update the existing row instead.
   Both are atomic — no gap between check and insert.

Q: Why can't you use an in-process Mutex across multiple servers?
A: A Mutex lives in one process's memory. On two different servers, each has its own
   Mutex that knows nothing of the other. Both can acquire "their" mutex simultaneously.
   For multi-server scenarios, use a Redis distributed lock (SET NX EX).

Q: What is the 'wx' file flag and why is it safer than checking then writing?
A: 'wx' opens for writing exclusively — if the file already exists, it throws EEXIST.
   This is atomic at the OS level. The check-and-create is ONE system call, not two.
   There is no gap for another process to create the file between your check and write.

Q: When should operations be sequential (await A; await B) vs parallel (Promise.all)?
A: Use sequential when:
   - Operation B depends on the result of A
   - Both modify shared state and ordering matters (e.g., debit then credit)
   - You want atomic behaviour wrapped in a DB transaction
   Use Promise.all when:
   - Operations are truly independent (load user + load products simultaneously)
   - Neither operation modifies state that the other reads/writes
   - Parallel execution genuinely speeds things up

Q: What is the TOCTOU vulnerability?
A: Time Of Check To Time Of Use. Between checking a condition (file exists? user taken?)
   and acting on it (create the file? insert user?), another process changes the state.
   Fix: collapse check-and-act into a single atomic operation (UNIQUE constraint,
   wx flag, SELECT FOR UPDATE).

Q: How does AbortController help with race conditions in fetch calls?
A: When a new fetch fires (e.g., user types again), you call controller.abort() on the
   previous request. The old fetch throws an AbortError — you ignore it. Only the
   latest response is processed, preventing stale/out-of-order responses.
*/

module.exports = {
  Mutex,
  SerialQueue,
  withRedisLock,
  createFileSafe,
  registerUserAtomic,
  placeOrderSafe,
  transferMoneySafe,
};

---
```

<a id="nodejs-theory-interview-qa"></a>
## FILE: 11_theory_interview_qa.js

```javascript
/*
=============================================================
  NODE.JS THEORY — INTERVIEW Q&A
  Basic → Intermediate → Advanced
  For 7+ years experience
=============================================================
*/

// ─────────────────────────────────────────────────────────
// ██ SECTION 1: BASIC
// ─────────────────────────────────────────────────────────

/*
Q1 [BASIC]: What is the Node.js event loop? Explain each phase.
────────────────────────────────────────────────────────────────
A: The event loop is a C loop (in libuv) that continuously checks the call stack
   and task queues. It has PHASES — each processes a specific type of callback.
   Order of phases per loop iteration:

   1. timers         → callbacks from setTimeout / setInterval whose delay has elapsed
   2. pending I/O    → I/O error callbacks deferred from previous iteration
   3. idle, prepare  → internal use only
   4. poll           → retrieve new I/O events; blocks here if nothing else to do
   5. check          → setImmediate() callbacks
   6. close callbacks→ e.g., socket.on('close', ...)

   Between EVERY phase: process.nextTick callbacks drain completely
   Between EVERY phase: Promise microtasks drain completely
   nextTick runs BEFORE Promises within the same "between phases" window.
*/
// Demonstrates phase ordering:
setTimeout(() => console.log('1. setTimeout'), 0);

setImmediate(() => console.log('2. setImmediate'));

Promise.resolve().then(() => console.log('3. Promise microtask'));

process.nextTick(() => console.log('4. nextTick'));

console.log('5. sync');

// Output: 5 → 4 → 3 → 1 → 2
// Reason: sync first, then nextTick (before microtasks), then Promise, then timers phase, then check phase
// Note: setTimeout vs setImmediate order can vary if NOT inside an I/O callback.
// Inside I/O callback: setImmediate ALWAYS before setTimeout.

/*
Q2 [BASIC]: Why is Node.js "non-blocking" even though JavaScript is single-threaded?
─────────────────────────────────────────────────────────────────────────────────────
A: Non-blocking I/O is achieved via the OS (epoll on Linux, kqueue on macOS, IOCP on Windows)
   and libuv's thread pool.

   Network I/O (TCP, HTTP): handed to OS async syscalls. No threads needed.
   File I/O, DNS, Crypto, zlib: delegated to libuv's thread pool (default: 4 threads).
   The main JS thread is free to process other events while waiting.

   Analogy: A chef (JS thread) takes orders (requests), puts food in the oven (I/O),
   and doesn't stand there watching — they take more orders instead.
   A kitchen helper (libuv thread) monitors the oven and notifies the chef.
*/
const { readFile } = require('fs');

// This does NOT block — readFile hands off to libuv thread pool
readFile('/etc/hosts', 'utf8', (err, data) => {
  // This callback runs in the POLL phase when file reading is complete
  if (err) throw err;
  console.log(data.slice(0, 50));
});

// While file is being read, Node continues here:
console.log('This prints BEFORE the file content'); // ← runs immediately

/*
Q3 [BASIC]: What are Streams and why are they important in Node.js?
────────────────────────────────────────────────────────────────────
A: Streams process data in CHUNKS rather than loading everything into memory.
   Critical for: large file processing, HTTP responses, video streaming, CSV parsing.

   Types: Readable, Writable, Duplex (both), Transform (duplex + modify data)
   All streams inherit from EventEmitter.
*/
const { createReadStream, createWriteStream } = require('fs');
const { createGzip } = require('zlib');
const { pipeline } = require('stream/promises');  // ← promisified pipeline

// BAD: loads entire 10GB file into memory
// const data = fs.readFileSync('bigfile.csv'); // 💀 heap OOM

// GOOD: streams — constant memory usage regardless of file size
async function gzipFile(input, output) {
  await pipeline(
    createReadStream(input),        // read in 64KB chunks
    createGzip(),                   // compress each chunk
    createWriteStream(output),      // write each compressed chunk
  );
  // Maximum memory used: ~3x chunk size (read + compress buffer + write)
  // NOT the entire file size
}

// ─────────────────────────────────────────────────────────
// ██ SECTION 2: INTERMEDIATE
// ─────────────────────────────────────────────────────────

/*
Q4 [INTERMEDIATE]: What is AsyncLocalStorage and how does it replace req.locals?
──────────────────────────────────────────────────────────────────────────────────
A: AsyncLocalStorage provides a context that propagates automatically through
   async operations (Promises, callbacks, timers, streams) within a single async call tree.
   Like thread-local storage but for async operations.
   Use: request-scoped context (requestId, userId, logger) without passing it everywhere.
*/
const { AsyncLocalStorage } = require('async_hooks');

const requestContext = new AsyncLocalStorage();

// Middleware: set context at the start of each request
function requestMiddleware(req, res, next) {
  const context = {
    requestId: req.headers['x-request-id'] || crypto.randomUUID(),
    userId: req.user?.id,
    startTime: Date.now(),
  };
  // All async operations triggered within this callback inherit the context
  requestContext.run(context, () => next());
}

// Anywhere in the call tree — no need to pass context explicitly
async function databaseQuery(sql) {
  const context = requestContext.getStore();          // ← automatically available
  console.log(`[${context?.requestId}] Executing: ${sql}`);
  // Use for logging, tracing, audit trails
}

// Logger that auto-includes request context:
const logger = {
  info(msg) {
    const ctx = requestContext.getStore();
    console.log(JSON.stringify({ level: 'info', msg, ...ctx }));
  },
};

/*
Q5 [INTERMEDIATE]: How does Node.js clustering work, and what are the downsides?
──────────────────────────────────────────────────────────────────────────────────
A: Node.js is single-threaded, so it can only use ONE CPU core by default.
   cluster module forks N worker processes (one per CPU), each running the same server code.
   The master process distributes incoming connections across workers.
   Workers share the same port via OS-level load balancing.

   Downsides:
   1. Workers do NOT share memory (separate process = separate heap)
      → Cannot use in-memory cache across workers
      → Session data must be stored in Redis/DB, not process memory
   2. Harder to debug (multiple processes)
   3. Each worker runs full server startup → more memory usage
*/
const cluster = require('cluster');
const os = require('os');
const http = require('http');

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(`Primary ${process.pid} is running. Forking ${numCPUs} workers.`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();   // ← auto-restart failed workers (resilience pattern)
  });
} else {
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end(`Worker ${process.pid} handled request`);
  }).listen(3000);
}

/*
Q6 [INTERMEDIATE]: Explain backpressure in Node.js streams and how to handle it.
───────────────────────────────────────────────────────────────────────────────────
A: Backpressure occurs when the PRODUCER (Readable) generates data faster than the
   CONSUMER (Writable) can process it. Without handling, data piles up in memory.

   Node's stream API communicates backpressure via boolean returns and 'drain' events.
   pipeline() / pipe() handle backpressure automatically — always prefer them.
*/
const { Readable, Writable } = require('stream');

// Manually handling backpressure:
const readable = createReadStream('bigfile.json');
const writable = createWriteStream('output.json');

readable.on('data', (chunk) => {
  const canContinue = writable.write(chunk);  // write returns false when buffer is full
  if (!canContinue) {
    readable.pause();    // ← tell source to stop producing (backpressure applied!)
    writable.once('drain', () => {
      readable.resume(); // ← drain fires when write buffer is flushed — safe to produce again
    });
  }
});

readable.on('end', () => writable.end());

// BETTER: pipeline handles all this automatically + proper error propagation:
// pipeline(readable, writable).catch(err => console.error(err));

/*
Q7 [INTERMEDIATE]: How does the Node.js module caching system work?
────────────────────────────────────────────────────────────────────
A: require() caches modules by their RESOLVED FILENAME.
   Second require() of the same file returns the CACHED MODULE OBJECT — no re-execution.
   This means:
   - Singleton pattern is automatic with CJS modules
   - Mutation of exports is shared across all requirers
   - Circular dependencies are possible but return incomplete exports
*/
// db.js:
// let connection = null;
// module.exports = {
//   connect() { connection = new DB(); return connection; },
//   query(sql) { return connection.query(sql); }
// };
// Any number of files require('./db') → they all get the SAME exported object
// → connection state is shared → natural singleton

// Clear cache (useful in tests):
// delete require.cache[require.resolve('./myModule')];  // force fresh require

// ─────────────────────────────────────────────────────────
// ██ SECTION 3: ADVANCED
// ─────────────────────────────────────────────────────────

/*
Q8 [ADVANCED]: How do you diagnose and fix memory leaks in a production Node.js app?
──────────────────────────────────────────────────────────────────────────────────────
A: Symptoms: heap growing over time, eventual OOM / process restart.
   Process:
   1. Monitor heap metrics (process.memoryUsage().heapUsed over time)
   2. Generate heap snapshots at different times
   3. Compare snapshots to find retained objects
   4. Find what is holding references (retention path)
*/
const v8 = require('v8');
const { writeFileSync } = require('fs');

// Method 1: V8 heap snapshot (analyze in Chrome DevTools → Memory tab)
function captureHeapSnapshot(filename) {
  const snapshotData = v8.writeHeapSnapshot();  // writes .heapsnapshot file
  console.log(`Snapshot written to: ${snapshotData}`);
}

// Method 2: Track memory usage over time
function monitorMemory(intervalMs = 10000) {
  setInterval(() => {
    const used = process.memoryUsage();
    console.log({
      heapUsed:  `${Math.round(used.heapUsed  / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
      rss:       `${Math.round(used.rss       / 1024 / 1024)} MB`,  // Resident Set Size (total process memory)
      external:  `${Math.round(used.external  / 1024 / 1024)} MB`,  // C++ objects tied to V8
    });
  }, intervalMs);
}

// Common production leak pattern: EventEmitter listener accumulation
const EventEmitter = require('events');
const emitter = new EventEmitter();

// BAD: each request adds a new listener but never removes it
// app.get('/subscribe', (req, res) => {
//   emitter.on('data', (d) => res.json(d)); // ← leaked! response gone but listener remains
// });

// GOOD: remove listener when request ends
// app.get('/subscribe', (req, res) => {
//   const handler = (d) => res.json(d);
//   emitter.on('data', handler);
//   req.on('close', () => emitter.off('data', handler)); // cleanup on disconnect
// });

/*
Q9 [ADVANCED]: How does Node.js handle uncaught exceptions and unhandled promise rejections?
────────────────────────────────────────────────────────────────────────────────────────────
A: Unhandled errors crash the process — but you WANT that in production (predictable state).
   The goal is to: log the error, flush any pending I/O, then exit gracefully.
   Never swallow errors silently.
*/

// PROCESS-LEVEL error handling (last resort — not a substitute for proper error handling)
process.on('uncaughtException', (err, origin) => {
  // DO: log the error
  console.error('UNCAUGHT EXCEPTION:', err.message, err.stack);
  // DO: exit immediately — process state is indeterminate after uncaught exception
  // NOT safe to continue (memory could be corrupt, db connections could be broken)
  process.exit(1);
  // DON'T continue running — that's dangerous
});

process.on('unhandledRejection', (reason, promise) => {
  // In Node 15+: unhandledRejection also terminates the process (as it should)
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});

// CORRECT pattern: proper try/catch in async functions
async function safeOperation() {
  try {
    const result = await riskyOperation();
    return result;
  } catch (err) {
    // Handle or re-throw — NEVER ignore
    logger.error({ err, operation: 'safeOperation' });
    throw err;   // re-throw for caller to handle or for Express error middleware
  }
}

const logger = { error: console.error };
async function riskyOperation() { return 'ok'; }

/*
Q10 [ADVANCED]: What is the difference between child_process.fork(), spawn(), and exec()?
──────────────────────────────────────────────────────────────────────────────────────────
A: All three create child processes, but differ in use case and how they handle I/O.
*/
const { fork, spawn, exec, execFile } = require('child_process');

// spawn() → stream-based I/O. Use for long-running processes with large output.
//           Does not create a shell (safer — no shell injection risk).
const ls = spawn('ls', ['-la', '/tmp']);    // streams stdout/stderr
ls.stdout.on('data', (data) => console.log(data.toString()));
ls.on('close', (code) => console.log(`Exit code: ${code}`));

// exec() → buffers ALL output in memory. Use for small output, needs shell features.
//          Creates a shell → SHELL INJECTION RISK if user input is in command string.
exec('ls -la /tmp', (err, stdout, stderr) => {
  // stdout is the full output as a string
  // BAD: exec(`ls ${userInput}`) → command injection if userInput = '; rm -rf /'
  // GOOD: execFile or spawn with arguments array (no shell)
});

// execFile() → like exec but no shell (safer than exec when running a specific file)
execFile('/usr/bin/ls', ['-la'], (err, stdout) => console.log(stdout));

// fork() → special spawn for Node.js scripts with built-in IPC channel
//          Shares V8 context overhead but has message passing
const worker = fork('./worker.js');         // creates new Node.js process
worker.send({ task: 'compute', data: 42 }); // send message to child
worker.on('message', (result) => {
  console.log('Worker result:', result);
  worker.kill();
});

/*
Q11 [ADVANCED]: How does Node.js handle long-running CPU-intensive tasks without blocking?
───────────────────────────────────────────────────────────────────────────────────────────
A: Options from simplest to most powerful:
   1. Offload to external service (microservice, Lambda, job queue)
   2. setImmediate chunking (cooperative multitasking)
   3. worker_threads (true parallel V8 execution within same process)
   4. child_process.fork() (separate process entirely)
*/
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// setImmediate chunking: break up CPU work to yield I/O callbacks between chunks
async function processArray(items) {
  const CHUNK_SIZE = 100;
  const results = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    chunk.forEach(item => results.push(item * 2));
    // Yield to the event loop after each chunk
    await new Promise(resolve => setImmediate(resolve));
    // → I/O callbacks, timers, incoming requests can run between chunks
  }
  return results;
}

// Worker Threads: true parallelism for CPU-bound tasks
function runInWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require('worker_threads');
      // CPU-intensive computation (does NOT block main thread)
      let result = 0;
      for (let i = 0; i < workerData.n; i++) result += i;
      parentPort.postMessage(result);
    `, { eval: true, workerData: data });

    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

/*
Q12 [ADVANCED]: Explain HTTP keep-alive, connection pooling, and their impact at scale.
──────────────────────────────────────────────────────────────────────────────────────
A: HTTP/1.1 keep-alive: reuse TCP connections for multiple requests (avoid 3-way handshake cost).
   Without keep-alive: each request does TCP connect (3-way handshake ~50-200ms) + TLS (~2 RTT).
   With keep-alive: connection stays open, subsequent requests pay ~0 connection overhead.

   Node's http.globalAgent manages a connection pool per host:port.
   Default maxSockets: Infinity (can overwhelm target server).
   Always configure agent for outbound connections.
*/
const http = require('http');
const https = require('https');

// Properly configure agent for production use
const httpsAgent = new https.Agent({
  keepAlive: true,           // reuse connections
  keepAliveMsecs: 30_000,   // send keep-alive probes every 30s
  maxSockets: 50,            // max connections per host (tune to your target server's capacity)
  maxFreeSockets: 10,        // keep N idle connections in pool
  timeout: 5000,             // socket timeout
});

// Reuse the SAME agent across all requests (create once, use everywhere):
async function callAPI(path) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      { hostname: 'api.example.com', path, agent: httpsAgent },  // ← uses pooled connections
      (res) => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => resolve(JSON.parse(data)));
      }
    );
    req.on('error', reject);
  });
}

module.exports = { gzipFile, processArray, callAPI };

---
```

---

<a id="nodejs-scenarios"></a>
## Scenario-Based Interview Questions

---

### Scenario 1: Express API Times Out Under Load

**Situation:** Your Express API handles 50 req/s fine in dev, but at 500 req/s in prod it starts returning 502s after ~10 seconds. CPU stays at 20%.

**Question:** How do you diagnose and fix this?

**Answer:**
1. Check the event loop lag with `perf_hooks` — if the loop is blocking, identify the synchronous code.
2. Check **open connections / keep-alive** — is the downstream DB pool exhausted?
3. Profile with `clinic.js` (Doctor / Flame) to find the bottleneck.
4. Common fix: DB connection pool is too small. Increase `pool.max` in your ORM config to match concurrent requests.
5. Add `compression()` middleware to reduce response payload size.
6. Use `cluster` module or PM2 with `instances: 'max'` to utilise all CPU cores.
7. Ensure all I/O (DB, Redis, external APIs) is properly `await`-ed — accidentally blocking the event loop will cause this.

---

### Scenario 2: Webhook Endpoint Is Slow — Synchronous Third-Party Calls

**Situation:** A payment provider sends webhooks. Your handler validates the signature, then calls three downstream services synchronously. On high volume days, the webhook response times out (provider retries, causing duplicate processing).

**Question:** How do you restructure this?

**Answer:**
- **Respond fast**: acknowledge the webhook immediately (`res.status(200).send('OK')`) within < 2 seconds.
- **Defer processing**: push the event payload onto a message queue (Redis + BullMQ, SQS, or a database queue table).
- A **background worker** picks up the job and calls downstream services.
- This decouples ingestion from processing and makes each step independently retryable.
- Add **idempotency keys** (webhook event ID stored in DB) to safely ignore duplicate deliveries.

```javascript
app.post('/webhook', validateSignature, async (req, res) => {
  await queue.add('payment.webhook', req.body, { jobId: req.body.id }); // deduped by jobId
  res.sendStatus(200); // respond immediately
});
```

---

### Scenario 3: Debugging a Memory Leak in a Long-Running Worker

**Situation:** A Node worker process that processes queue jobs leaks ~10 MB/hour. After 48 hours it OOMs.

**Question:** How do you find and fix the leak?

**Answer:**
1. Take heap snapshots at intervals with `v8.writeHeapSnapshot()` or attach Chrome DevTools via `node --inspect`.
2. Compare snapshots — look for objects with growing "retained size" between snapshots.
3. Common causes: **in-memory cache that never evicts**, **event emitter listeners that accumulate**, **closures in request handlers holding request objects**.
4. Fix caches with a TTL map or use `lru-cache`.
5. Always call `emitter.off()` when a listener's purpose is fulfilled.
6. Use `--max-old-space-size` as a circuit breaker and PM2's `max_memory_restart` while investigating.

---

### Scenario 4: JWT Refresh Token Strategy

**Situation:** You issue 15-minute access tokens and 7-day refresh tokens. A user's refresh token is stolen. How do you invalidate it?

**Answer:**
- **Refresh token rotation**: each use of a refresh token issues a NEW refresh token and invalidates the old one (stored in DB).
- If an attacker reuses a refresh token that has already been rotated, detect the reuse → invalidate the entire family → force re-login.
- Store refresh tokens hashed (bcrypt or SHA-256) in the DB — never store raw.
- Set the refresh token as an **`HttpOnly`, `SameSite=Strict` cookie** so JavaScript can't read it.
- On logout, immediately delete the refresh token from the DB.

---

### Scenario 5: Node.js Event Loop Blocking — Crypto or JSON in Request Handler

**Situation:** Your API has one endpoint that runs `JSON.parse()` on a 10 MB payload directly in the request handler. All other endpoints start timing out when this endpoint is hit.

**Question:** What is happening and how do you fix it?

**Answer:**
- `JSON.parse` on a large string is **synchronous** and blocks the event loop — while it runs, no other requests can be processed.
- **Fix options**:
  1. Use `worker_threads` to parse the JSON in a separate thread, keeping the main event loop free.
  2. Use streaming JSON parsing (`stream-json` library) to parse incrementally without blocking.
  3. Enforce a `Content-Length` limit on the endpoint (e.g., `express.json({ limit: '1mb' })`).
  4. Move heavy processing to a dedicated worker microservice.

---

### Scenario 6: Rate Limiting a Multi-Instance API

**Situation:** You add `express-rate-limit` but realise it only tracks request counts in-memory. With 4 Node processes behind a load balancer, a user can make 4× the allowed requests.

**Question:** How do you fix this?

**Answer:**
- Use a **shared Redis store** for rate limit counters: `express-rate-limit` + `rate-limit-redis`.
- The Redis `INCR` + `EXPIRE` pattern is atomic, consistent across all instances.
- Key by IP or by user ID (authenticated routes) depending on your strategy.

```javascript
import RedisStore from 'rate-limit-redis';
app.use(rateLimit({
  windowMs: 60_000,
  max: 100,
  store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
  keyGenerator: (req) => req.user?.id ?? req.ip,
}));
```

---

### Scenario 7: Graceful Shutdown for Zero-Downtime Deploys

**Situation:** Rolling deployment restarts one Node pod at a time. In-flight requests during the restart get ECONNRESET errors on the client.

**Question:** How do you implement graceful shutdown?

**Answer:**

```javascript
const server = app.listen(PORT);

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(async () => {         // stops accepting new connections
    await db.pool.end();             // close DB pool
    await redisClient.quit();        // close Redis
    process.exit(0);
  });
  // Force exit if shutdown takes too long
  setTimeout(() => process.exit(1), 10_000);
});
```

- Kubernetes sends `SIGTERM` 30 seconds before `SIGKILL` — use that window to drain connections.
- Configure `terminationGracePeriodSeconds: 30` in the Pod spec.

---

### Scenario 8: Preventing SQL Injection in a Dynamic Query Builder

**Situation:** A search feature builds a dynamic `WHERE` clause based on user-provided filter keys and values. A developer constructs the clause with string interpolation.

**Question:** Explain the risk and the correct approach.

**Answer:**
- String interpolation with user input allows injection: `WHERE status = 'active'; DROP TABLE users; --`
- **Always use parameterised queries / prepared statements**:

```javascript
// WRONG
const query = `SELECT * FROM orders WHERE status = '${req.query.status}'`;

// CORRECT — pg driver
const { rows } = await db.query(
  'SELECT * FROM orders WHERE status = $1 AND user_id = $2',
  [req.query.status, req.user.id]
);
// Knex / TypeORM query builders also escape values automatically
```

- Validate and whitelist filter keys (column names) — never allow raw column names from user input.

---

### Scenario 9: Streams for Processing a 5 GB Log File

**Situation:** A script reads a 5 GB log file with `fs.readFileSync`. It crashes with `FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory`.

**Question:** Rewrite it to handle files of any size.

**Answer:**

```javascript
const { createReadStream } = require('fs');
const { createInterface } = require('readline');

const rl = createInterface({
  input: createReadStream('/var/log/app.log'),
  crlfDelay: Infinity,
});

let errorCount = 0;
for await (const line of rl) {
  if (line.includes('ERROR')) errorCount++;
}
console.log('Total errors:', errorCount);
// Processes one line at a time — constant memory usage regardless of file size
```

---

### Scenario 10: Cluster Mode Does Not Improve Latency as Expected

**Situation:** You enable PM2 cluster mode with 8 workers but your CPU-bound endpoint latency barely improves.

**Question:** Why and what else can you do?

**Answer:**
- Cluster spawns 8 processes, but if the endpoint is still doing CPU work per process it distributes load, not reduces individual response time.
- Check if the endpoint is truly CPU-bound (video encoding, image resize, heavy crypto) — if so, `cluster` helps throughput but not p50 latency.
- For latency: use `worker_threads` within a single process to offload the CPU work while responding to other requests immediately.
- Consider moving the CPU work to a dedicated microservice or a background job queue.
- Profile first — the bottleneck may be DB queries, not CPU, in which case connection pool tuning and query optimisation will help more.
