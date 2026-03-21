# Master Interview Q&A — Part 3
# Source: questions.txt
# Sections 7–15 (Q48–Q157)
# Rules: plain-text headers, ASCII-only diagrams, one Q per commit

---

# Section 7: NODE.JS + EXPRESS (Q48-Q57)

---

## Q48: How does Express middleware chain work? What happens if you forget to call `next()`?

### ELI5

Think of a factory assembly line. A car body enters and passes through stations in order: painting, windshield fitting, tyre fitting, final quality check. Each station does its work and then physically pushes the car to the next station. In Express, a request is the car. Middleware functions are the stations. Each middleware MUST call `next()` to push the request forward. If a station worker forgets to push the car along (forgets `next()`), the car just sits there — the client waiting for a response gets a timeout after ~30 seconds because the response is never sent.

### Visual Diagram

```
HTTP Request arrives
        |
        v
+-------------------+       next()
|  Middleware 1     |---------------->+-------------------+       next()
|  (logger)        |                 |  Middleware 2     |---------------->+-------------------+
|  logs timestamp  |                 |  (auth check)     |                 |  Route Handler    |
+-------------------+                |  attaches req.user|                 |  (GET /api/data)  |
                                     +-------------------+                 |  sends res.json() |
                                            |                              +-------------------+
                              if invalid    |
                              return 401 <--+

--- What happens when next() is forgotten: ---

HTTP Request arrives
        |
        v
+-------------------+
|  Broken Middle-   |
|  ware             |  <-- does its work but never calls next() or res.send()
|  ??? no next() ???|
+-------------------+
        |
        |  (request stuck here)
        v
   Client times out after ~30s — no response ever arrives
```

### Code Example

```javascript
const express = require('express');
const app = express();

// ----- Middleware 1: Request logger -----
// app.use() with no path prefix means this runs for EVERY request
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`--> ${req.method} ${req.url}`);

  // Attach start time so downstream handlers can measure response time
  req.startTime = start;

  next(); // MUST call this — passes control to Middleware 2
});

// ----- Middleware 2: JSON body parser -----
// Built-in since Express 4.16+; parses application/json bodies into req.body
app.use(express.json());

// ----- Middleware 3: Auth guard — only runs for /api/* paths -----
app.use('/api', (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Calling return here ends the chain — client gets 401, nothing else runs
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  // Token exists: decode and attach user to req for route handlers to use
  // (simplified — real code would verify the JWT signature here)
  req.user = { id: 42, role: 'admin' };

  next(); // Valid token — proceed to the actual route handler
});

// ----- Route handler: end of the chain -----
app.get('/api/profile', (req, res) => {
  // req.user is available because Middleware 3 attached it
  const elapsed = Date.now() - req.startTime; // startTime set by Middleware 1

  res.json({
    user: req.user,
    responseTimeMs: elapsed,
  });
  // No next() here — res.json() sends the response and Express closes the cycle
});

// ----- Error-handling middleware (4 params, registered LAST) -----
// Only triggered when a middleware calls next(err) with an Error object
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(3000, () => console.log('Server up on port 3000'));

// =============================================================
// COMMON BUG: forgetting next()
// =============================================================
// app.use((req, res, next) => {
//   console.log('I ran but never passed control forward');
//   // Neither next() nor res.send() — client hangs until timeout
// });
```

### Step-by-Step Explanation

1. An HTTP request hits the Express server.
2. Express iterates through registered middleware **in registration order** — FIFO.
3. Path matching: `app.use('/api', fn)` only triggers for requests whose URL starts with `/api`; `app.use(fn)` with no path triggers for every request.
4. Each middleware receives three arguments: `req` (request), `res` (response), `next` (callback to advance the chain).
5. **Call `next()` with no arguments** → pass control to the next matching middleware or route handler.
6. **Call `next(new Error('message'))` with an error** → skip all remaining regular middleware and jump straight to the 4-argument error-handling middleware.
7. **Call `res.json()`, `res.send()`, `res.redirect()`, etc.** → send the response to the client; no further middleware runs after this.
8. **Forget both `next()` and `res.*`** → the request hangs indefinitely; the client eventually receives a connection timeout (usually 30–60 seconds).
9. Middleware order matters: register body-parsers before route handlers, auth guards before the routes they protect, and error handlers absolutely last.

### Complexity

| Operation | Time | Space | Notes |
|-----------|------|-------|-------|
| Middleware traversal | O(n) | O(1) | n = number of registered middleware / route handlers |
| `next()` call itself | O(1) | O(1) | Moves an internal pointer to the next handler |
| Stuck request (no next, no res) | N/A | O(1) | Holds the TCP connection open until client timeout |
| Error middleware dispatch | O(1) | O(1) | Triggered by `next(err)` — skips regular middleware |

---

## Q49: What is the difference between `app.use()` and `app.get()`?

### ELI5

Imagine a shopping mall security guard vs a specific shop assistant. The security guard (`app.use()`) checks everyone entering the mall regardless of which shop they are visiting — they run for every request or for any request that starts with a path prefix. The shop assistant (`app.get()`) only serves customers who want to buy something specific from that exact shop using a specific action (GET). `app.use()` is broad and method-agnostic; `app.get()` is narrow, path-exact, and method-specific.

### Visual Diagram

```
Incoming Requests:
  GET  /api/users
  POST /api/users
  GET  /api/orders

app.use('/api', authMiddleware)
  --> runs for ALL THREE  (GET /api/users, POST /api/users, GET /api/orders)
  --> path matching: starts-with /api

app.get('/api/users', handler)
  --> runs ONLY for: GET /api/users
  --> path matching: exact /api/users
  --> method matching: GET only

app.post('/api/users', handler)
  --> runs ONLY for: POST /api/users
  --> path matching: exact /api/users
  --> method matching: POST only

------------------------------------------------------
Feature            | app.use()          | app.get()
------------------------------------------------------
HTTP method        | ALL methods        | GET only
Path matching      | prefix match       | exact match
Typical use        | middleware         | route handler
Passes control     | must call next()   | sends response
------------------------------------------------------
```

### Code Example

```javascript
const express = require('express');
const app = express();

// ----- app.use(): runs for EVERY request whose URL starts with /api -----
// No HTTP method restriction — handles GET, POST, PUT, DELETE, PATCH, etc.
// Path is a PREFIX match — /api/users, /api/orders, /api/anything all match
app.use('/api', (req, res, next) => {
  // Attach authenticated user for downstream handlers
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = { id: 1, role: 'admin' }; // simplified JWT decode
  next(); // must call next() to continue — app.use() is middleware, not a terminal
});

// ----- app.use() with no path: runs for ALL requests unconditionally -----
app.use(express.json()); // body parser — no path = catches every request

// ----- app.get(): only matches GET /api/users exactly -----
// POST /api/users, PUT /api/users, GET /api/users/123 all SKIP this handler
app.get('/api/users', (req, res) => {
  // By the time we reach here, app.use('/api', ...) has already validated the token
  res.json({ users: [{ id: 1, name: 'Alice' }] });
  // No next() call here — res.json() ends the request cycle
});

// ----- app.post() for the same path: separate, coexists peacefully -----
app.post('/api/users', (req, res) => {
  const { name } = req.body; // body parsed by the app.use(express.json()) above
  res.status(201).json({ created: { id: 2, name } });
});

// ----- Gotcha: app.use() with path still prefix-matches -----
// This WILL run for /admin, /admin/dashboard, /admin/anything
app.use('/admin', (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
});

// ----- Contrast: app.get() with a param does NOT match /users -----
app.get('/api/users/:id', (req, res) => {
  // Only matches GET /api/users/123, not GET /api/users
  res.json({ user: { id: req.params.id } });
});

app.listen(3000);
```

### Step-by-Step Explanation

1. **`app.use(path, fn)`** registers middleware. Path is optional (defaults to `'/'` = every request).
2. **Path matching for `app.use()`** is a **prefix match** — the path just needs to START with the given string. `/api` matches `/api`, `/api/users`, `/api/orders/123`, etc.
3. **`app.get(path, fn)`** (and `app.post()`, `app.put()`, etc.) registers a **route handler**. It only fires when BOTH the HTTP method AND the path match.
4. **Path matching for route methods** is **exact** (with optional param wildcards like `:id`). `/api/users` does NOT match `/api/users/123`.
5. `app.use()` is intended to be middleware — it should call `next()` to pass control onward or call `res.*` to terminate. Route handlers (`app.get()`) are terminal — they send the response.
6. Order of registration still matters: `app.use()` registered before `app.get()` runs first.
7. `app.use()` with no path is the canonical way to add global middleware (body parsers, loggers, CORS headers).
8. Under the hood, Express stores `app.use` entries as Layer objects with `route = undefined`, while `app.get/post` entries have a `route` object with the method stored — the dispatch loop checks method accordingly.

### Complexity

| Feature | app.use() | app.get() |
|---------|-----------|-----------|
| HTTP methods matched | ALL | GET only (respective method for app.post/put/etc.) |
| Path match type | Prefix (starts-with) | Exact (with params) |
| Primary purpose | Middleware (auth, logging, parsing) | Route handler (terminal) |
| Must call next()? | Yes (unless sending response) | No — sends response and exits |
| Dispatch time | O(n) scan through registered layers | O(n) scan, filtered by method |

---

## Q50: How do you create a global error handling middleware in Express?

### ELI5

Imagine every department in a company has a receptionist. If something goes wrong in any department and nobody there can fix it, they call the main company helpdesk. The helpdesk is one person who handles ALL complaints from ALL departments in one place. In Express, the global error handler is that helpdesk — one special 4-argument middleware registered at the very bottom of your file. Any middleware that calls `next(err)` (passing an error object) skips all normal middleware and lands directly at this handler.

### Visual Diagram

```
Request comes in
      |
      v
+------------------+
| Middleware 1     |  -- works fine --> next()
+------------------+
      |
      v
+------------------+
| Middleware 2     |  -- something blows up!
| throw new Error  |  --> next(err) or async throws caught by wrapper
+------------------+
      |
      | next(err) called
      v
+------------------+   <-- ALL normal middleware SKIPPED
| Route Handler    |   <-- SKIPPED
+------------------+
      |
      v
+---------------------------+
| Global Error Handler      |  <-- 4 params: (err, req, res, next)
| (err, req, res, next)     |  must be registered LAST
| logs error, sends 500     |
+---------------------------+
      |
      v
  Client receives JSON error response

---- Express identifies error handlers by signature ----
  3 params (req, res, next)   --> normal middleware
  4 params (err, req, res, next) --> error middleware
```

### Code Example

```javascript
const express = require('express');
const app = express();

app.use(express.json());

// ----- Custom AppError class for structured errors -----
// Lets us attach HTTP status codes to errors thrown anywhere in the app
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes our errors from unknown bugs
  }
}

// ----- Route that deliberately throws an operational error -----
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await findUser(req.params.id); // pretend DB call
    if (!user) {
      // Throw structured error — will be caught below and forwarded to error handler
      throw new AppError('User not found', 404);
    }
    res.json(user);
  } catch (err) {
    // Pass error to Express error-handling pipeline
    next(err);
  }
});

// ----- Async wrapper utility — avoids try/catch boilerplate in every route -----
// Wraps an async route handler and automatically calls next(err) on rejection
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Using asyncHandler: no try/catch needed inside the route at all
app.post('/orders', asyncHandler(async (req, res) => {
  const order = await createOrder(req.body); // any thrown error auto-goes to next(err)
  res.status(201).json(order);
}));

// ----- 404 handler — must come AFTER all valid routes -----
// Catches any request that didn't match a registered route
app.use((req, res, next) => {
  next(new AppError(`Cannot ${req.method} ${req.url}`, 404));
});

// ----- GLOBAL ERROR HANDLER — must be registered LAST -----
// Express recognises error middleware by the 4-parameter signature (err, req, res, next)
// If this is accidentally declared with 3 params, Express treats it as normal middleware
app.use((err, req, res, next) => {
  // Log full error in production logging system (e.g. CloudWatch, Datadog)
  console.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  // Determine the correct HTTP status code
  const statusCode = err.statusCode || 500;

  // Send structured JSON response — never expose raw stack traces to clients
  res.status(statusCode).json({
    status: 'error',
    message: err.isOperational
      ? err.message           // safe to expose — we wrote this message intentionally
      : 'Internal Server Error', // unknown error — hide details from client
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }), // dev only
  });
});

app.listen(3000);

// Stub functions (would be real DB calls in production)
async function findUser(id) { return id === '1' ? { id: 1, name: 'Alice' } : null; }
async function createOrder(data) { return { id: 99, ...data }; }
```

### Step-by-Step Explanation

1. Any middleware or route can signal an error by calling **`next(err)`** where `err` is an Error object (or any value, but always use Error objects).
2. Express detects that an argument was passed to `next()` and **skips all remaining 3-param middleware** — jumping directly to the first 4-param middleware.
3. The error handler **must have exactly 4 parameters**: `(err, req, res, next)`. Express identifies error handlers purely by arity — even if you never use `next`, declare it to keep it a 4-param function.
4. Register the global error handler **after all routes and middleware** — being last ensures it only catches what wasn't handled elsewhere.
5. Add a **404 catch-all** (`app.use` with no path) just before the error handler to convert unmatched routes into proper 404 errors rather than hanging connections.
6. Use a custom `AppError` class with `statusCode` and `isOperational` to distinguish planned errors (404, 400, 401) from unexpected bugs (crashes, DB failures) — this controls what message reaches the client.
7. Use an **`asyncHandler` wrapper** (or the `express-async-errors` package) to automatically forward async rejections to `next(err)` without writing try/catch in every route.
8. In production, **never send raw stack traces** to the client — log them server-side and send a generic message.

### Complexity

| Concern | Detail |
|---------|--------|
| Middleware arity check | O(1) per layer — Express checks `.length` of the function |
| Error handler placement | Must be last — Express traverses layers in registration order |
| Async errors pre-Express 5 | Must be manually forwarded with `next(err)` or asyncHandler wrapper |
| Async errors in Express 5 | Async route errors auto-forwarded (no wrapper needed) |
| Operational vs programmer errors | Use `isOperational` flag to decide client message vs generic 500 |

---

## Q51: How do you implement rate limiting across multiple server instances using Redis?

### ELI5

Imagine a nightclub with 3 doors (3 server instances). Each door has its own bouncer. If they don't talk to each other, a person can get rejected at door 1 but just walk to door 2 and get in — bypassing the 10-person limit. To fix this, all bouncers share a single whiteboard (Redis) that tracks exactly how many times each person has entered tonight. Every bouncer checks and updates the same whiteboard, so the limit is global across all doors.

### Visual Diagram

```
Client ---> Load Balancer
                |
    +-----------+-----------+
    |           |           |
 Server 1    Server 2    Server 3
    |           |           |
    +-----------+-----------+
                |
         Redis (shared store)
         Key: "rate:IP:userId"
         Value: request count
         TTL: window duration

--- Sliding Window algorithm in Redis ---

Time window: 60 seconds, limit: 100 requests

ZADD rate:192.168.1.1 <now_ms> <now_ms>   (record this request's timestamp)
ZREMRANGEBYSCORE rate:192.168.1.1 0 <now_ms - 60000>  (remove old entries outside window)
ZCARD rate:192.168.1.1                     (count current entries)
EXPIRE rate:192.168.1.1 60                 (auto-cleanup key)

If ZCARD > 100 --> 429 Too Many Requests
Else           --> allow request
```

### Code Example

```javascript
const express = require('express');
const { createClient } = require('redis');
const app = express();

// ----- Connect to Redis (shared across all server instances) -----
const redis = createClient({ url: process.env.REDIS_URL });
redis.connect();

// ----- Sliding Window Rate Limiter using Redis Sorted Sets -----
// Sorted sets let us store timestamps as both the score AND member,
// making it trivial to remove entries older than the window.
async function slidingWindowRateLimit(req, res, next) {
  const ip = req.ip;                      // use IP as rate limit key
  const key = `rate:${ip}`;
  const limit = 100;                      // max requests per window
  const windowMs = 60 * 1000;            // 60-second sliding window

  const now = Date.now();
  const windowStart = now - windowMs;

  // Use a pipeline (atomic multi-command) to avoid race conditions
  const pipeline = redis.multi();

  // 1. Add current request timestamp to the sorted set
  pipeline.zAdd(key, { score: now, value: String(now) });

  // 2. Remove all entries older than the window
  pipeline.zRemRangeByScore(key, 0, windowStart);

  // 3. Count remaining entries = requests in the current window
  pipeline.zCard(key);

  // 4. Reset TTL so the key auto-expires after inactivity
  pipeline.expire(key, Math.ceil(windowMs / 1000));

  const results = await pipeline.exec();
  const requestCount = results[2]; // zCard result is index 2

  // Set rate-limit headers so clients know their quota
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - requestCount));
  res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

  if (requestCount > limit) {
    return res.status(429).json({
      error: 'Too Many Requests',
      retryAfter: Math.ceil(windowMs / 1000),
    });
  }

  next();
}

// ----- Apply rate limiter globally -----
app.use(slidingWindowRateLimit);

// ----- Per-route tighter limit for sensitive endpoints -----
// Factory function creates a limiter with custom options
function createRateLimiter(limit, windowMs) {
  return async (req, res, next) => {
    const key = `rate:${req.ip}:${req.path}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const pipeline = redis.multi();
    pipeline.zAdd(key, { score: now, value: String(now) });
    pipeline.zRemRangeByScore(key, 0, windowStart);
    pipeline.zCard(key);
    pipeline.expire(key, Math.ceil(windowMs / 1000));
    const results = await pipeline.exec();

    if (results[2] > limit) {
      return res.status(429).json({ error: 'Rate limit exceeded for this endpoint' });
    }
    next();
  };
}

// Login endpoint — only 5 attempts per minute per IP
app.post('/auth/login', createRateLimiter(5, 60_000), (req, res) => {
  res.json({ token: 'jwt-here' });
});

app.listen(3000);
```

### Step-by-Step Explanation

1. Each request is identified by its IP (or user ID for authenticated routes) forming the Redis key.
2. A **sorted set** is used where each member is the request timestamp — scores equal members so ZRANGEBYSCORE can efficiently window queries by time.
3. `ZADD` records the current request; `ZREMRANGEBYSCORE` purges entries outside the window; `ZCARD` counts what remains — this is the **sliding window counter**.
4. All three Redis commands are batched in a **pipeline/MULTI** block so they execute atomically — this prevents race conditions where two simultaneous requests both read a count of 99 and both get admitted when the limit is 100.
5. Setting `EXPIRE` on the key means Redis automatically cleans up inactive keys — no need for a background job.
6. **Why Redis?**: In-memory rate limiters (like `express-rate-limit` with default MemoryStore) only track counts per process. With 3 server instances, each tracks its own count — the real limit becomes `N * limit`. Redis is a shared external store visible to all instances simultaneously.
7. **Token Bucket vs Sliding Window**: Token bucket refills at a fixed rate (steady throughput). Sliding window counts requests in a rolling window (burst control). Redis sorted sets implement sliding window cleanly.
8. Add `X-RateLimit-*` headers so API clients can implement back-off without guessing.

### Complexity

| Operation | Time | Space | Notes |
|-----------|------|-------|-------|
| ZADD | O(log N) | — | N = entries in current window |
| ZREMRANGEBYSCORE | O(log N + M) | — | M = entries removed |
| ZCARD | O(1) | — | Sorted set cardinality is cached |
| Full pipeline | O(log N) | O(N) per key | N capped by requests-per-window |
| Network round trip | O(1) latency ~1ms | — | Redis typically < 1ms local LAN |

---

## Q52: What security headers does Helmet set and why do they matter?

### ELI5

When you send a letter, the envelope tells the post office how to handle it — fragile, do not bend, return address, etc. HTTP response headers work the same way. Without them, browsers make risky default assumptions: they'll run any inline script, load content from anywhere, and reveal sensitive server info. Helmet is an Express middleware that sets a collection of well-known HTTP security headers in one line, instructing browsers to enforce safe defaults.

### Visual Diagram

```
Without Helmet:
  HTTP Response:
    Content-Type: application/json
    X-Powered-By: Express          <-- reveals framework (helps attackers)
    (no CSP)                       <-- browser runs ANY script, including injected ones
    (no X-Frame-Options)           <-- page can be embedded in an iframe (clickjacking)
    (no HSTS)                      <-- browser allows plain HTTP downgrade

With Helmet (app.use(helmet())):
  HTTP Response:
    Content-Security-Policy: default-src 'self'   <-- only load resources from same origin
    X-Content-Type-Options: nosniff               <-- stop MIME-type sniffing attacks
    X-Frame-Options: SAMEORIGIN                   <-- prevent clickjacking via iframes
    Strict-Transport-Security: max-age=15552000   <-- force HTTPS for 180 days
    X-XSS-Protection: 0                           <-- disables broken legacy XSS filter
    Referrer-Policy: no-referrer                  <-- don't leak URL in Referer header
    Permissions-Policy: ...                       <-- restrict browser features (camera, mic)
    (removes X-Powered-By)                        <-- attacker can't fingerprint framework
```

### Code Example

```javascript
const express = require('express');
const helmet = require('helmet');
const app = express();

// ----- Default Helmet: applies ~15 headers with safe defaults in one line -----
app.use(helmet());

// ----- Custom Helmet with per-directive control -----
app.use(
  helmet({
    // Content-Security-Policy: controls which resources (scripts, images, fonts) are allowed
    // Prevents XSS — even if an attacker injects a <script> tag, the browser blocks it
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],                      // only load from same origin by default
        scriptSrc: ["'self'", 'https://cdn.example.com'], // allow scripts from our CDN
        styleSrc: ["'self'", "'unsafe-inline'"],     // allow inline styles (legacy UI)
        imgSrc: ["'self'", 'data:', 'https:'],        // allow images from HTTPS anywhere
        connectSrc: ["'self'", 'https://api.example.com'], // AJAX/WebSocket origins
        fontSrc: ["'self'", 'https://fonts.googleapis.com'],
        objectSrc: ["'none'"],                       // block <object>, <embed>, <applet>
        upgradeInsecureRequests: [],                 // auto-upgrade http:// links to https://
      },
    },

    // HTTP Strict Transport Security: tells browsers to ONLY use HTTPS for this domain
    // max-age=15552000 = 180 days; includeSubDomains extends to subdomains
    hsts: {
      maxAge: 15_552_000,
      includeSubDomains: true,
      preload: true, // allows domain to be submitted to browser HSTS preload list
    },

    // X-Frame-Options: SAMEORIGIN — prevents your page from being embedded in iframes
    // on other domains (clickjacking defence)
    frameguard: { action: 'sameorigin' },

    // X-Content-Type-Options: nosniff — browser must use declared Content-Type
    // Prevents browsers from interpreting a JS file as HTML and executing it
    noSniff: true,

    // Referrer-Policy: controls how much URL info is sent in the Referer header
    // 'no-referrer-when-downgrade' — don't leak HTTPS URLs to HTTP sites
    referrerPolicy: { policy: 'no-referrer-when-downgrade' },

    // Permissions-Policy: restrict browser APIs to prevent abuse
    // Prevents pages from accessing camera/mic/geolocation without explicit need
    permittedCrossDomainPolicies: false,

    // Removes X-Powered-By: Express — attackers commonly scan for this to target known exploits
    hidePoweredBy: true,

    // X-XSS-Protection: 0 — disables old IE XSS filter (broken and itself exploitable)
    xssFilter: false,
  })
);

// ----- API-specific CSP: APIs usually don't serve HTML so relax CSP -----
const apiRouter = express.Router();
apiRouter.use(
  helmet({
    contentSecurityPolicy: false, // no CSP for pure JSON API endpoints
  })
);

app.use('/api', apiRouter);
app.listen(3000);
```

### Step-by-Step Explanation

1. **Content-Security-Policy (CSP)**: The most powerful XSS defence. Tells the browser which origins can supply scripts, styles, images, etc. An injected `<script src="evil.com/xss.js">` is blocked if `evil.com` isn't in `scriptSrc`.
2. **HTTP Strict Transport Security (HSTS)**: Once a browser sees this header, it refuses HTTP connections to the domain for `maxAge` seconds — even if the user types `http://`. Prevents SSL-stripping attacks.
3. **X-Frame-Options `SAMEORIGIN`**: Prevents your page from being loaded inside an `<iframe>` on another domain. Clickjacking embeds a legitimate page in a transparent iframe and tricks users into clicking invisible buttons.
4. **X-Content-Type-Options `nosniff`**: A browser normally tries to guess the content type of a response. If an attacker uploads an image file containing JavaScript, `nosniff` makes the browser honour `Content-Type: image/jpeg` and refuse to execute it as JS.
5. **X-Powered-By removal**: Express sets `X-Powered-By: Express` by default. Removing it means automated scanners can't trivially identify your stack and target known Express vulnerabilities.
6. **Referrer-Policy**: Controls whether the browser sends the full URL in the `Referer` header to third parties. A URL like `/reset-password?token=abc123` should never appear in a third-party server's access log.
7. **Permissions-Policy**: Browser-level feature flags — `camera=()` disables camera access for the page entirely, even if the JavaScript tries to request it.
8. **CSP nonces for inline scripts**: If you need inline scripts (e.g., Next.js hydration), generate a random nonce per request and add it to both the CSP header and the `<script nonce="...">` tag — the browser only executes scripts whose nonce matches.

### Complexity

| Header | Attack prevented | Default in Helmet |
|--------|-----------------|-------------------|
| Content-Security-Policy | XSS, data injection | Yes (default-src 'self') |
| HSTS | SSL stripping, downgrade attacks | Yes (180d) |
| X-Frame-Options | Clickjacking | Yes (SAMEORIGIN) |
| X-Content-Type-Options | MIME sniffing | Yes (nosniff) |
| Referrer-Policy | URL leakage | Yes (no-referrer) |
| Permissions-Policy | Browser API abuse | Yes (restrictive) |
| X-Powered-By removed | Framework fingerprinting | Yes (removed) |

---

## Q53: How do you validate request body in Express using Zod?

### ELI5

Imagine a bouncer at a restaurant who checks that everyone who walks in is wearing shoes and a shirt and has a reservation. Zod is that bouncer for your API — before any request body reaches your database or business logic, Zod checks its shape and types precisely. If the data doesn't match the schema you defined, it rejects the request immediately with a clear error explaining exactly what was wrong, before any damage is done.

### Visual Diagram

```
POST /api/users
Body: { "name": 123, "email": "not-an-email" }

               |
               v
+-----------------------------+
|  express.json() middleware  |  parse raw JSON --> req.body
+-----------------------------+
               |
               v
+-----------------------------+
|  Zod validation middleware  |  schema.safeParse(req.body)
|  (validateBody(UserSchema)) |
+-----------------------------+
               |
        fail?  |  pass?
       --------+--------
       |                |
       v                v
  400 Bad Request   next()
  {                 req.body is now
    errors: [...]   typed & validated
  }                      |
                         v
                  +-------------+
                  | Route Handler|
                  | safe to use  |
                  | req.body.name|
                  +-------------+
```

### Code Example

```javascript
const express = require('express');
const { z } = require('zod');
const app = express();

app.use(express.json());

// ----- Define schema with Zod -----
// z.object() creates a schema that validates an object's shape and field types
const CreateUserSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100),
  email: z
    .string()
    .email('Must be a valid email address'),
  age: z
    .number()
    .int('Age must be an integer')
    .min(18, 'Must be 18 or older')
    .optional(),   // age is optional — can be missing without error
  role: z
    .enum(['user', 'admin', 'moderator'])  // only allow these exact string values
    .default('user'),  // defaults to 'user' if not provided
  address: z.object({
    street: z.string(),
    city: z.string(),
    postcode: z.string().regex(/^\d{5}$/, 'Postcode must be 5 digits'),
  }).optional(),
});

// Infer the TypeScript type from the schema (also works in JS with JSDoc)
// type CreateUserInput = z.infer<typeof CreateUserSchema>;

// ----- Reusable validation middleware factory -----
// Takes any Zod schema and returns Express middleware that validates req.body against it
function validateBody(schema) {
  return (req, res, next) => {
    // safeParse returns { success, data, error } — never throws
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // ZodError.flatten() gives a clean { fieldErrors, formErrors } structure
      const { fieldErrors, formErrors } = result.error.flatten();

      return res.status(400).json({
        error: 'Validation failed',
        fieldErrors,    // { name: ['Name must be at least 2 characters'], ... }
        formErrors,     // top-level errors not tied to a field
      });
    }

    // Replace req.body with the PARSED output — Zod applies defaults & transforms
    // e.g., role will be 'user' even if it wasn't in the original body
    req.body = result.data;
    next();
  };
}

// ----- Route: validation middleware runs BEFORE the handler -----
app.post('/api/users', validateBody(CreateUserSchema), (req, res) => {
  // req.body is now fully validated and typed — safe to use directly
  const { name, email, age, role } = req.body;
  // ... save to DB
  res.status(201).json({ message: 'User created', user: { name, email, role } });
});

// ----- Sharing the same schema for query param validation -----
const GetUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),  // z.coerce converts "1" string -> 1 number
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['user', 'admin']).optional(),
});

// Middleware for query params instead of body
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid query params', details: result.error.flatten() });
    }
    req.query = result.data; // coerced and defaulted query params
    next();
  };
}

app.get('/api/users', validateQuery(GetUsersQuerySchema), (req, res) => {
  const { page, limit, role } = req.query; // page and limit are numbers here, not strings
  res.json({ page, limit, role });
});

app.listen(3000);
```

### Step-by-Step Explanation

1. Define a **Zod schema** (`z.object({...})`) that describes the exact shape and constraints your route expects — string formats, numeric ranges, enums, optional fields, default values.
2. In the middleware, call **`schema.safeParse(req.body)`** — `safeParse` (not `parse`) returns a result object and never throws, making error handling explicit.
3. If `result.success === false`, extract errors with **`result.error.flatten()`** and return a 400 with per-field error messages — the client knows exactly what to fix.
4. If `result.success === true`, **replace `req.body` with `result.data`** — this is important because Zod may have applied defaults (e.g., `role: 'user'`) and coerced types (`z.coerce.number()` converts the string `"42"` to the number `42`).
5. **`z.coerce`** is essential for query params and route params — HTTP delivers everything as strings, but you don't want to manually `parseInt()` everywhere.
6. The **middleware factory pattern** (`validateBody(schema)` returning middleware) means you define the schema once at the top of the file and reuse slim middleware declarations on each route.
7. **Sharing schemas** between frontend and backend (in a monorepo) means the same email regex validates at the `<input>` level AND on the server — one source of truth.
8. Zod's **`z.infer<typeof Schema>`** generates a TypeScript type automatically, so you never write types and schemas separately.

### Complexity

| Operation | Detail |
|-----------|--------|
| `safeParse` | O(n) where n = number of fields + nested depth |
| Error formatting | O(n fields) |
| Schema reuse | Define once, use in middleware, frontend, and TypeScript types |
| `z.coerce` | Handles string-to-number/boolean for query params automatically |
| vs Joi | Zod has first-class TypeScript inference; Joi requires separate type definitions |
| vs class-validator | Zod schemas are plain objects — no decorators, works in JS too |

---

## Q54: What is the difference between `jwt.sign()` and `jwt.verify()`? How do you implement refresh tokens?

### ELI5

Think of a JWT like a signed concert ticket. `jwt.sign()` is the ticket printer — it takes your info (who you are, when it expires) and stamps it with a special seal (the signature) that only the venue knows how to make. `jwt.verify()` is the ticket scanner at the gate — it checks that the seal is real and that the ticket hasn't expired. A refresh token is a separate long-lived "voucher" kept in a safe in the back office — when your concert ticket expires, you show the voucher and get a new ticket printed, without having to queue outside again.

### Visual Diagram

```
LOGIN FLOW:
  Client -> POST /auth/login { email, password }
                |
                v
         Validate credentials
                |
                v
  jwt.sign(payload, SECRET, { expiresIn: '15m' })
  --> Access Token  (short-lived: 15 minutes)
  jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: '7d' })
  --> Refresh Token (long-lived: 7 days)
         Store refresh token hash in DB
                |
                v
  Response: { accessToken, refreshToken }

AUTHENTICATED REQUEST FLOW:
  Client -> GET /api/data
            Authorization: Bearer <accessToken>
                |
                v
  jwt.verify(token, SECRET)
  --> OK: { userId, role, iat, exp }
  --> FAIL (expired/tampered): throw JsonWebTokenError / TokenExpiredError

REFRESH FLOW:
  Client -> POST /auth/refresh { refreshToken }
                |
                v
  1. jwt.verify(refreshToken, REFRESH_SECRET) -- check signature & expiry
  2. Look up hash of refreshToken in DB -- check it hasn't been revoked
  3. Issue new accessToken (15m) + rotate refreshToken (new 7d token)
  4. Invalidate old refreshToken in DB (refresh token rotation)
                |
                v
  Response: { accessToken, refreshToken (new) }
```

### Code Example

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// ----- Secrets (load from environment variables — NEVER hardcode) -----
const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;

// In-memory store for demo — production uses Redis or a DB table
const refreshTokenStore = new Map(); // hash -> { userId, expiresAt }

// ----- Helper: create an access token (short-lived) -----
function signAccessToken(userId, role) {
  // Payload: only include non-sensitive identifying data
  // iat (issued at) and exp (expiry) are added automatically
  return jwt.sign(
    { userId, role },
    ACCESS_SECRET,
    { expiresIn: '15m', issuer: 'myapp', audience: 'myapp-client' }
  );
}

// ----- Helper: create a refresh token (long-lived) -----
function signRefreshToken(userId) {
  const token = jwt.sign(
    { userId, type: 'refresh' }, // type field helps distinguish if token leaks
    REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  // Store a HASH of the token, not the token itself
  // If DB is breached, stolen hashes can't be used directly
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  refreshTokenStore.set(hash, {
    userId,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return token;
}

// ----- Login: issue both tokens -----
app.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await findUserByEmail(email); // DB lookup

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      // Generic message — don't reveal which field was wrong (prevents enumeration)
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = signAccessToken(user.id, user.role);
    const refreshToken = signRefreshToken(user.id);

    // Return refresh token in httpOnly cookie to prevent JS access (XSS protection)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,   // JS cannot read this cookie
      secure: true,     // only sent over HTTPS
      sameSite: 'strict', // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    });

    res.json({ accessToken }); // access token returned in body — client stores in memory
  } catch (err) {
    next(err);
  }
});

// ----- Auth middleware: verify access token on protected routes -----
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // verify() throws if token is expired, tampered, or has wrong signature
    const decoded = jwt.verify(token, ACCESS_SECRET, {
      issuer: 'myapp',
      audience: 'myapp-client',
    });
    req.user = decoded; // attach { userId, role, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ----- Refresh: rotate tokens -----
app.post('/auth/refresh', (req, res) => {
  const refreshToken = req.cookies.refreshToken; // read from httpOnly cookie
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

  try {
    // Step 1: verify JWT signature and expiry
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);

    // Step 2: verify token exists in store (wasn't revoked/logged out)
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = refreshTokenStore.get(hash);

    if (!stored || stored.userId !== decoded.userId) {
      return res.status(401).json({ error: 'Refresh token revoked' });
    }

    // Step 3: Remove old refresh token (rotation — each refresh token is single-use)
    refreshTokenStore.delete(hash);

    // Step 4: Issue new pair
    const newAccessToken = signAccessToken(decoded.userId, decoded.role);
    const newRefreshToken = signRefreshToken(decoded.userId);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true, secure: true, sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// ----- Logout: revoke refresh token -----
app.post('/auth/logout', (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    refreshTokenStore.delete(hash); // invalidate the token server-side
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
});

app.get('/api/profile', authenticate, (req, res) => {
  res.json({ userId: req.user.userId, role: req.user.role });
});

app.listen(3000);

async function findUserByEmail(email) {
  return { id: 1, role: 'admin', passwordHash: await bcrypt.hash('password', 10) };
}
```

### Step-by-Step Explanation

1. **`jwt.sign(payload, secret, options)`** creates a JWT: encodes `payload` as Base64URL, generates the signature using HMAC-SHA256 (or RSA), and concatenates `header.payload.signature`.
2. **`jwt.verify(token, secret)`** decodes the token, recomputes the signature with the same secret, and checks it matches — proving the token wasn't tampered with. Also checks `exp` against current time.
3. **Access token**: short-lived (5–15 minutes). Sent in `Authorization: Bearer` header. Stateless — no DB lookup needed for every request.
4. **Refresh token**: long-lived (days–weeks). Stored server-side as a hash. Used ONLY to get new access tokens.
5. **Store refresh token in httpOnly cookie** — JavaScript can't read it, blocking XSS-based token theft. Access token lives in memory (not localStorage — vulnerable to XSS).
6. **Refresh token rotation** — each refresh token is single-use. When used, it's deleted and a new one is issued. If a stolen refresh token is used, the legitimate user's next refresh attempt detects the mismatch and logs out all sessions.
7. **Revocation**: JWTs are stateless by design — you can't "un-issue" an access token. The short expiry (15 min) limits the damage window. Refresh token revocation list in Redis/DB handles logout immediately.
8. **Separate secrets** for access and refresh tokens — if one leaks, the other isn't compromised.

### Complexity

| Feature | Access Token | Refresh Token |
|---------|-------------|---------------|
| Lifespan | 5–15 minutes | 7–30 days |
| Storage (client) | Memory (JS variable) | httpOnly cookie |
| Server-side state | None (stateless) | Hash stored in DB/Redis |
| Revocable | No (wait for expiry) | Yes (delete from store) |
| Theft impact | Limited (short-lived) | High — rotate immediately on detection |
| DB lookup per request | No | Only on /auth/refresh |

---

## Q55: How do you implement the Repository pattern in a Node.js + Express application?

### ELI5

Imagine a library. You (the service/route handler) never go directly to the shelves to find books. Instead, you ask the librarian (the repository). The librarian knows where everything is stored — whether books are in shelf A, the basement archive, or sometimes borrowed from another library. You just say "I need the book about MongoDB" and you get it — you don't care how. The Repository pattern works the same way: your business logic doesn't care if data comes from MongoDB, PostgreSQL, or a cache. It just calls `userRepository.findById(id)` and gets back a plain object.

### Visual Diagram

```
Route Handler (Express)
        |
        v
   Service Layer          <-- business logic (e.g., hash password, send email)
        |
        v
   Repository             <-- data access abstraction
        |
        v
   Data Source            <-- MongoDB / PostgreSQL / Redis / mock

--- Without Repository Pattern: ---
Route Handler --> mongoose.model('User').findOne({ email }) --> MongoDB
                  (DB query INSIDE route handler — tightly coupled)

--- With Repository Pattern: ---
Route Handler --> userService.getUser(id)
                         |
                 userRepository.findById(id)
                         |
                 UserModel.findById(id).lean()  <-- only this file knows about Mongoose
```

### Code Example

```javascript
// ============================================================
// repositories/userRepository.js
// Knows about Mongoose — nothing else in the app imports Mongoose directly
// ============================================================
const UserModel = require('../models/User');

const userRepository = {
  // Find by ID — returns plain JS object (not a Mongoose document)
  async findById(id) {
    return UserModel.findById(id).lean(); // .lean() returns POJO, not Mongoose Document
  },

  // Find by email for login/uniqueness checks
  async findByEmail(email) {
    return UserModel.findOne({ email }).lean();
  },

  // Create new user — only repository knows how to persist a User
  async create(userData) {
    const user = new UserModel(userData);
    const saved = await user.save();
    return saved.toObject(); // return plain object, not Mongoose Document
  },

  // Update — returns updated document
  async update(id, updates) {
    return UserModel.findByIdAndUpdate(id, updates, {
      new: true,       // return updated document
      runValidators: true, // run schema validators
    }).lean();
  },

  // Soft delete — sets deletedAt instead of removing
  async delete(id) {
    return UserModel.findByIdAndUpdate(id, { deletedAt: new Date() }).lean();
  },

  // Find with pagination — cursor-style
  async findAll({ limit = 20, cursor, role } = {}) {
    const query = { deletedAt: null };
    if (role) query.role = role;
    if (cursor) query._id = { $gt: cursor }; // cursor-based pagination

    return UserModel.find(query)
      .sort({ _id: 1 })
      .limit(limit)
      .lean();
  },
};

module.exports = userRepository;

// ============================================================
// services/userService.js
// Business logic — uses repository but never touches DB directly
// ============================================================
const bcrypt = require('bcrypt');
const userRepository = require('../repositories/userRepository');

const userService = {
  async getUserById(id) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('User not found'); // business rule
    return user;
  },

  async createUser({ name, email, password }) {
    // Business rule: email must be unique
    const existing = await userRepository.findByEmail(email);
    if (existing) throw Object.assign(new Error('Email already in use'), { statusCode: 409 });

    // Business logic: hash before storing
    const passwordHash = await bcrypt.hash(password, 12);

    return userRepository.create({ name, email, passwordHash });
  },

  async updateUser(id, updates) {
    // Business rule: prevent privilege escalation via API
    const safeUpdates = { ...updates };
    delete safeUpdates.role;        // role changes go through separate admin flow
    delete safeUpdates.passwordHash; // password changes go through /auth/change-password

    return userRepository.update(id, safeUpdates);
  },
};

module.exports = userService;

// ============================================================
// routes/users.js
// Route handlers — thin, no business logic or DB calls
// ============================================================
const express = require('express');
const userService = require('../services/userService');
const router = express.Router();

router.get('/:id', async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    res.json(user);
  } catch (err) {
    next(err); // global error handler takes over
  }
});

router.post('/', async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

### Step-by-Step Explanation

1. **Repository**: a module whose sole job is data access — reads/writes to the database. It exposes plain methods like `findById`, `create`, `update` and returns plain objects (not ORM documents).
2. **Service Layer**: contains business logic — validation rules like "email must be unique", transformations like "hash the password", and orchestration across multiple repositories.
3. **Route Handler**: thin controller — parses HTTP input, calls the service, and formats the HTTP response. Contains no business logic and no database calls.
4. **Why `.lean()` matters**: Mongoose documents are heavy objects with many attached methods. Returning POJOs from the repository means the rest of the app doesn't accidentally depend on Mongoose-specific behaviour.
5. **Testability**: To test `userService`, you mock `userRepository` — no real database needed. To test `userRepository`, you use an in-memory MongoDB (mongomemoryserver). Route handlers are only integration-tested.
6. **Swappable data source**: If you decide to move from MongoDB to PostgreSQL, you rewrite `userRepository` only. The service and route files are completely unchanged.
7. **Single Responsibility**: Each layer does exactly one thing. Debugging is easier — a bug in data access is in the repository, a business rule bug is in the service.
8. **Dependency injection** (advanced): instead of importing the repository directly in the service, inject it as a constructor parameter. This makes testing cleaner and decouples modules.

### Complexity

| Layer | Responsibility | Knows about |
|-------|---------------|-------------|
| Route Handler | HTTP in/out, call service | HTTP, service |
| Service | Business rules, orchestration | Repository, other services |
| Repository | Data access only | ORM/DB driver |
| Model/Schema | Data shape validation | DB driver |
| Test benefit | Mock repository isolates service | No DB needed for unit tests |

---

## Q56: How do you handle graceful shutdown in a Node.js server?

### ELI5

Imagine you're a chef and the restaurant is closing. A graceful shutdown is like: stop taking new orders, finish cooking all the orders already placed, clean the kitchen, then turn off the lights and leave. A brutal shutdown is like someone flipping the main power switch mid-service — half-cooked food gets thrown away, customers don't get their meals, and the kitchen is left a mess. Graceful shutdown ensures in-flight requests complete, database connections are cleanly closed, and no data is lost before the process exits.

### Visual Diagram

```
SIGTERM received (from OS, Kubernetes, load balancer, or pm2 restart)
         |
         v
+---------------------------+
| 1. Stop accepting new     |  server.close() -- no new connections accepted
|    connections            |
+---------------------------+
         |
         v
+---------------------------+
| 2. Wait for in-flight     |  existing requests finish processing
|    requests to complete   |  (set a timeout: 30s max)
+---------------------------+
         |
         v
+---------------------------+
| 3. Close all connections  |  DB pool, Redis, message queue consumers
|    to external services   |
+---------------------------+
         |
         v
+---------------------------+
| 4. Flush logs / metrics   |  ensure observability data is sent
+---------------------------+
         |
         v
+---------------------------+
| 5. process.exit(0)        |  clean exit (0 = success, 1 = error)
+---------------------------+

SIGKILL = immediate kill (no graceful shutdown possible — use as last resort)
Kubernetes sends SIGTERM, waits terminationGracePeriodSeconds (default 30s), then SIGKILL
```

### Code Example

```javascript
const express = require('express');
const mongoose = require('mongoose');
const { createClient } = require('redis');

const app = express();
let server;
let isShuttingDown = false;

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect();

// ----- Health check: reject new requests during shutdown -----
// Load balancers call /health to decide whether to send traffic here
// Returning 503 makes the LB route new traffic elsewhere before we shut down
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.setHeader('Connection', 'close'); // signal HTTP client to not reuse connection
    return res.status(503).json({ status: 'shutting down' });
  }
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ----- Graceful shutdown function -----
async function gracefulShutdown(signal) {
  if (isShuttingDown) return; // prevent double-shutdown if multiple signals arrive
  isShuttingDown = true;

  console.log(`Received ${signal}. Starting graceful shutdown...`);

  // ---- Step 1: Stop accepting NEW connections ----
  // Existing connections and in-flight requests continue to completion
  server.close(async () => {
    console.log('HTTP server closed — no new connections accepted');

    try {
      // ---- Step 2: Close database connection pool ----
      await mongoose.connection.close(false); // false = don't force-close active ops
      console.log('MongoDB connection closed');

      // ---- Step 3: Close Redis connection ----
      await redis.quit(); // sends QUIT command, waits for acknowledgement
      console.log('Redis connection closed');

      // ---- Step 4: Any other cleanup (message queue consumers, etc.) ----
      // await sqsConsumer.stop();
      // await kafkaConsumer.disconnect();

      console.log('Graceful shutdown complete');
      process.exit(0); // success exit
    } catch (err) {
      console.error('Error during graceful shutdown:', err);
      process.exit(1); // error exit
    }
  });

  // ---- Safety net: force exit if shutdown takes too long ----
  // Prevents stuck connections from blocking deployment forever
  setTimeout(() => {
    console.error('Graceful shutdown timeout — forcing exit');
    process.exit(1);
  }, 30_000).unref(); // .unref() means this timer itself won't prevent exit
}

// ----- Register signal handlers -----
// SIGTERM: standard termination signal from OS/Docker/Kubernetes/pm2
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// SIGINT: Ctrl+C in terminal during local development
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ----- Unhandled errors: log and decide whether to exit -----
// uncaughtException means an error was thrown outside of a promise/async chain
// The process state is UNKNOWN after this — safest action is controlled exit
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  gracefulShutdown('uncaughtException');
});

// unhandledRejection: a Promise was rejected with no .catch() handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  // In Node.js 15+ this crashes the process by default — log it and let it crash gracefully
  gracefulShutdown('unhandledRejection');
});

// ----- Start server and connect to DB -----
async function start() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');

  server = app.listen(3000, () => {
    console.log('Server listening on port 3000');
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
```

### Step-by-Step Explanation

1. **SIGTERM** is the standard shutdown signal from Kubernetes, Docker, pm2, and most process managers. Always handle it explicitly — the default behaviour kills the process immediately.
2. **`server.close(callback)`** stops the HTTP server from accepting new connections but allows existing ones to finish. The callback fires when all connections have drained.
3. **In-flight requests** continue processing normally after `server.close()`. A keep-alive connection won't drain until the client closes it — set `Connection: close` header to tell clients not to reuse the connection.
4. **Database pools**: Close connections cleanly. Mongoose's `connection.close(false)` waits for active queries; `true` would force-close. An abrupt process exit mid-transaction can cause data corruption or lock orphans.
5. **`isShuttingDown` flag**: Once set, the health check returns 503 — this tells the load balancer to de-register the instance from its backend pool *before* the instance stops, ensuring zero dropped requests.
6. **Safety timeout**: `setTimeout(..., 30_000)` is a hard deadline. If a rogue request hangs forever, this prevents the deployment pipeline from blocking. `.unref()` means the timer itself won't keep the event loop alive.
7. **Kubernetes flow**: Container receives SIGTERM → `terminationGracePeriodSeconds` (default 30s) timer starts → container shuts down cleanly → Kubernetes sends SIGKILL only if the container hasn't exited within the grace period.
8. **`unhandledRejection` and `uncaughtException`**: In Node.js 15+, unhandled rejections crash the process by default — handle them, log them, and trigger graceful shutdown rather than letting the process die mid-request.

### Complexity

| Signal | Source | Default behaviour | What you should do |
|--------|--------|-------------------|-------------------|
| SIGTERM | Kubernetes, pm2, Docker stop | Immediate kill | Graceful shutdown |
| SIGINT | Ctrl+C | Immediate kill | Graceful shutdown |
| SIGKILL | OS force kill | Immediate kill (unblockable) | Cannot be intercepted |
| uncaughtException | Sync throw outside try/catch | Crash (Node <15) or exit(1) | Log + graceful shutdown |
| unhandledRejection | Rejected promise without .catch | Warn (Node <15), exit(1) (Node 15+) | Log + graceful shutdown |

---

## Q57: What is the Service Layer pattern? How does it differ from putting logic in route handlers?

### ELI5

Imagine a fast-food restaurant. The cashier (route handler) takes your order and hands it to the kitchen (service layer). The kitchen decides how to make the burger — what ingredients to use, how to cook it, what checks to make. The cashier doesn't know how to cook. If you swap the cashier for a self-service kiosk (REST to GraphQL) or add a drive-through (new route), the kitchen stays exactly the same. The Service Layer is the kitchen — all the "how" logic lives there.

### Visual Diagram

```
--- WITHOUT Service Layer (logic in route handler) ---

POST /api/orders
  |
  v
Route Handler:
  - validate body
  - check if user exists (DB)
  - check item stock (DB)
  - calculate total
  - save order (DB)
  - send confirmation email
  - update inventory (DB)
  --> impossible to test without HTTP server and live DB

--- WITH Service Layer ---

POST /api/orders  (REST)
GraphQL mutation  (GraphQL)
CLI command       (admin tool)
          |
          v
   orderService.createOrder(userId, items)
          |
    +-----+-----+
    |            |
 userRepo    itemRepo    emailService    inventoryService
    |            |            |                |
   DB           DB           SMTP            DB
          (all testable in isolation)
```

### Code Example

```javascript
// ============================================================
// services/orderService.js — ALL business logic lives here
// ============================================================
const orderRepository = require('../repositories/orderRepository');
const userRepository = require('../repositories/userRepository');
const itemRepository = require('../repositories/itemRepository');
const emailService = require('./emailService');

const orderService = {
  async createOrder(userId, items) {
    // Business rule 1: user must exist and be active
    const user = await userRepository.findById(userId);
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    if (user.status !== 'active') throw Object.assign(new Error('Account suspended'), { statusCode: 403 });

    // Business rule 2: validate each item and check stock
    const resolvedItems = await Promise.all(
      items.map(async ({ itemId, quantity }) => {
        const item = await itemRepository.findById(itemId);
        if (!item) throw Object.assign(new Error(`Item ${itemId} not found`), { statusCode: 404 });
        if (item.stock < quantity) {
          throw Object.assign(
            new Error(`Insufficient stock for ${item.name}`),
            { statusCode: 409 }
          );
        }
        return { ...item, quantity, subtotal: item.price * quantity };
      })
    );

    // Business rule 3: calculate total (discount, tax applied here)
    const subtotal = resolvedItems.reduce((acc, i) => acc + i.subtotal, 0);
    const tax = Math.round(subtotal * 0.2 * 100) / 100; // 20% VAT
    const total = subtotal + tax;

    // Persist the order
    const order = await orderRepository.create({
      userId,
      items: resolvedItems,
      subtotal,
      tax,
      total,
      status: 'pending',
    });

    // Side effect: send confirmation email (fire-and-forget, don't fail the order)
    emailService.sendOrderConfirmation(user.email, order).catch((err) => {
      console.error('Failed to send confirmation email:', err);
    });

    return order;
  },

  async cancelOrder(orderId, userId) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });

    // Business rule: user can only cancel their own orders
    if (order.userId.toString() !== userId.toString()) {
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    }

    // Business rule: can only cancel pending orders
    if (order.status !== 'pending') {
      throw Object.assign(
        new Error(`Cannot cancel order with status: ${order.status}`),
        { statusCode: 409 }
      );
    }

    return orderRepository.update(orderId, { status: 'cancelled' });
  },
};

module.exports = orderService;

// ============================================================
// routes/orders.js — THIN route handler, no business logic
// ============================================================
const express = require('express');
const orderService = require('../services/orderService');
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { CreateOrderSchema } = require('../schemas/order');
const router = express.Router();

// Route handler: parse HTTP input, call service, format HTTP output
router.post('/', authenticate, validateBody(CreateOrderSchema), async (req, res, next) => {
  try {
    const order = await orderService.createOrder(req.user.userId, req.body.items);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const order = await orderService.cancelOrder(req.params.id, req.user.userId);
    res.json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

// ============================================================
// Unit test — no HTTP server, no DB, just pure logic
// ============================================================
// const orderService = require('./services/orderService');
// jest.mock('./repositories/userRepository');
// jest.mock('./repositories/itemRepository');
// jest.mock('./repositories/orderRepository');
//
// test('throws 409 when item is out of stock', async () => {
//   userRepository.findById.mockResolvedValue({ id: '1', status: 'active' });
//   itemRepository.findById.mockResolvedValue({ id: 'x', name: 'Widget', price: 10, stock: 0 });
//   await expect(orderService.createOrder('1', [{ itemId: 'x', quantity: 1 }]))
//     .rejects.toMatchObject({ statusCode: 409 });
// });
```

### Step-by-Step Explanation

1. **Route Handler responsibility**: receive HTTP request → call service → send HTTP response. It should never contain a database query, a business rule, or domain logic.
2. **Service Layer responsibility**: all the "what" and "how" of the business — validate rules, orchestrate DB calls, compute values, trigger side-effects (email, events).
3. **Single Entry Point for Logic**: if a business rule changes (e.g., tax rate goes from 20% to 18%), you edit `orderService.js` in one place — not scattered across multiple route files.
4. **Testability**: services are pure functions over injected dependencies. You mock the repositories and test the business logic with zero infrastructure.
5. **Protocol independence**: the same `orderService.createOrder()` can be called from an Express route, a GraphQL mutation resolver, a CLI admin script, or a background job — without any code changes.
6. **Error semantics**: services throw domain errors with `statusCode` attached. The global error handler reads `statusCode` and maps it to HTTP — the service doesn't know about HTTP.
7. **What stays in route handlers**: request parsing (`req.body`, `req.params`, `req.query`), authentication/authorisation middleware, response formatting (`res.json()`), input validation (Zod middleware).
8. **What goes in the service**: all business decisions — every `if` that isn't "is the token valid?" belongs in the service, not the route.

### Complexity

| Concern | Route Handler | Service Layer | Repository |
|---------|--------------|---------------|------------|
| Knows about HTTP | Yes | No | No |
| Knows about DB | No | No | Yes |
| Business rules | No | Yes | No |
| Can be unit tested without infra | No (needs HTTP server) | Yes (mock repos) | No (needs DB) |
| Reusable from GraphQL/CLI | No | Yes | Yes |

--- End of Section 7 ---

---

# Section 8: NODE.JS — Auth & Security (Q58-Q65)

---

## Q58: How does the OAuth 2.0 flow work? What is the difference between Authorization Code and Client Credentials flow?

### ELI5

OAuth 2.0 is a system for letting one app act on your behalf without giving it your password. Think of it like a hotel key card. Instead of handing a visitor your house keys (your password), the front desk (the authorization server) issues a temporary key card (access token) specifically for that visitor that only opens certain doors. Authorization Code flow is for humans — the person shows up and the front desk checks their ID. Client Credentials flow is for machines — a server talks to another server with a pre-shared secret, no human involved.

### Visual Diagram

```
--- Authorization Code Flow (user present) ---

User's Browser      Your App (Client)     Auth Server      Resource Server
      |                    |                   |                  |
      |-- click "Login" -->|                   |                  |
      |                    |-- redirect to ---->|                  |
      |                    |   /authorize      |                  |
      |<-- redirect to Auth Server login -------|                  |
      |-- logs in, consents ------------------>|                  |
      |<-- redirect back to /callback?code=XYZ--|                  |
      |                    |<-- receives code --|                  |
      |                    |-- POST /token ----->|                  |
      |                    |   { code, secret } |                  |
      |                    |<-- access_token, refresh_token --------|
      |                    |-- GET /api/profile w/ Bearer token --->|
      |                    |<-- user data ----------------------------

--- Client Credentials Flow (machine-to-machine, no user) ---

 Your Server (Client)      Auth Server       Other API (Resource)
        |                      |                    |
        |-- POST /token ------->|                    |
        |   { client_id,        |                    |
        |     client_secret,    |                    |
        |     grant_type:       |                    |
        |     'client_credentials' }                 |
        |<-- access_token (no refresh token) --------|
        |-- GET /api/data w/ Bearer token ---------->|
        |<-- data -----------------------------------|
```

### Code Example

```javascript
// ============================================================
// Authorization Code Flow — typical setup with passport.js + GitHub OAuth
// ============================================================
const express = require('express');
const passport = require('passport');
const { Strategy: GitHubStrategy } = require('passport-github2');
const session = require('express-session');

const app = express();

app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// Step 1: Configure the strategy with your app's credentials
passport.use(new GitHubStrategy(
  {
    clientID: process.env.GITHUB_CLIENT_ID,       // from GitHub app settings
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: 'https://yourapp.com/auth/github/callback',
  },
  async (accessToken, refreshToken, profile, done) => {
    // Called after GitHub redirects back with a valid code + token
    // accessToken can now be used to call GitHub APIs on behalf of the user
    let user = await findOrCreateUser({ githubId: profile.id, name: profile.displayName });
    done(null, user);
  }
));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => done(null, await findUser(id)));

// Step 2: Redirect user to GitHub's authorization page
app.get('/auth/github',
  passport.authenticate('github', { scope: ['user:email'] }) // request specific permissions
);

// Step 3: GitHub redirects back here with ?code=... — passport exchanges it for a token
app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/dashboard'); // authentication succeeded
  }
);

// ============================================================
// Client Credentials Flow — server-to-server (e.g., calling Azure AD-protected API)
// ============================================================
const axios = require('axios');

let cachedToken = null;
let tokenExpiry = 0;

async function getClientCredentialsToken() {
  // Reuse cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiry - 60_000) {
    return cachedToken;
  }

  const tenantId = process.env.AZURE_TENANT_ID;
  const response = await axios.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID,
      client_secret: process.env.AZURE_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default', // scope of the target API
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  cachedToken = response.data.access_token;
  tokenExpiry = Date.now() + response.data.expires_in * 1000;
  return cachedToken;
}

// Use the token to call the protected API
async function callAzureApi() {
  const token = await getClientCredentialsToken();
  const response = await axios.get('https://graph.microsoft.com/v1.0/users', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

app.listen(3000);
```

### Step-by-Step Explanation

1. **OAuth 2.0 roles**: Resource Owner (user), Client (your app), Authorization Server (Google/GitHub/Azure AD), Resource Server (the API you're calling).
2. **Authorization Code flow steps**: (a) redirect user to auth server with `client_id` + `scope`; (b) user authenticates and consents; (c) auth server redirects back with a short-lived `code`; (d) your server exchanges `code` + `client_secret` for an `access_token` and `refresh_token` (server-to-server, never exposed to browser).
3. **Why a code instead of the token directly?**: The code is short-lived and single-use. The actual token exchange happens server-to-server, never through the browser — the `client_secret` never touches the front end.
4. **PKCE (Proof Key for Code Exchange)**: for mobile/SPA clients that can't safely store a `client_secret`, PKCE replaces the secret with a code verifier/challenge pair generated per-request.
5. **Client Credentials flow**: no user involved — your server sends `client_id + client_secret` directly to get an `access_token`. Used for background jobs, microservices, daemon processes.
6. **Token caching**: client credentials tokens are short-lived (typically 1 hour). Cache them and reuse until near-expiry — don't fetch a new token on every request.
7. **Scopes**: the `scope` parameter limits what the token is authorized to do. Always request the minimum scope needed (`principle of least privilege`).
8. **Refresh tokens**: Authorization Code flow issues refresh tokens; Client Credentials does not (just re-request a new token when it expires).

### Complexity

| | Authorization Code | Client Credentials |
|--|---|---|
| User present | Yes | No |
| Refresh token | Yes | No |
| Use case | Login with Google/GitHub/Azure | Microservice-to-microservice |
| Client secret | Kept server-side | Used directly in token request |
| PKCE | For public clients (SPA, mobile) | Not applicable |
| Token cache | Optional (use refresh token) | Essential (re-request on expiry) |

---

## Q59: What is the difference between authentication and authorization?

### ELI5

Authentication is proving who you are — showing your passport at the border. Authorization is proving what you're allowed to do — showing your boarding pass that says you can only enter Gate B, not Gate A. You can be perfectly authenticated (we know who you are) but still not authorized (you don't have permission for this action).

### Visual Diagram

```
Request: DELETE /api/admin/users/42

Step 1 — AUTHENTICATION: "Are you who you claim to be?"
  Authorization: Bearer <jwt>
       |
       v
  jwt.verify(token, SECRET)
       |
  PASS: token is valid, decoded = { userId: 7, role: 'editor' }
  FAIL: 401 Unauthorized — "I don't know who you are"

Step 2 — AUTHORIZATION: "Are you allowed to do this?"
  req.user.role = 'editor'
  Required role: 'admin'
       |
  FAIL: 403 Forbidden — "I know who you are, but you can't do this"

  (If role = 'admin'): PASS --> route handler executes

Status codes:
  401 Unauthorized --> authentication failed (bad/missing token)
  403 Forbidden    --> authorized identity, but insufficient permission
```

### Code Example

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();

// ----- AUTHENTICATION middleware -----
// Validates the JWT — answers "who is this user?"
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { userId, role, permissions }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ----- AUTHORIZATION middleware factory -----
// Returns middleware that checks if authenticated user has the required role
function authorize(...allowedRoles) {
  return (req, res, next) => {
    // authenticate must have run first to populate req.user
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        required: allowedRoles,
        yours: req.user.role,
      });
    }
    next();
  };
}

// ----- Permission-based authorization (more granular than roles) -----
function hasPermission(permission) {
  return (req, res, next) => {
    // JWT payload might include a permissions array: ['read:users', 'delete:users']
    if (!req.user.permissions?.includes(permission)) {
      return res.status(403).json({ error: `Missing permission: ${permission}` });
    }
    next();
  };
}

// Applies: authenticate first, then authorize for role, then actual handler
app.delete(
  '/api/admin/users/:id',
  authenticate,                // step 1: who are you?
  authorize('admin'),          // step 2: are you an admin?
  async (req, res) => {
    await deleteUser(req.params.id);
    res.json({ deleted: true });
  }
);

// More granular: permission-based
app.get(
  '/api/reports',
  authenticate,
  hasPermission('read:reports'),
  async (req, res) => {
    res.json({ report: 'data here' });
  }
);

app.listen(3000);
```

### Step-by-Step Explanation

1. **Authentication**: verifying identity — "Are you really Alice?". Methods: password + JWT, OAuth 2.0, API keys, mTLS certificates.
2. **Authorization**: verifying permissions — "Is Alice allowed to delete users?". Methods: RBAC (roles), ABAC (attributes), ACL (explicit per-resource lists).
3. **401 vs 403**: 401 means unauthenticated (no/bad token); 403 means authenticated but not authorized (good token, wrong permissions). Using 404 to hide the existence of a resource is also valid in security-sensitive scenarios.
4. **Separation of concerns**: authentication middleware runs once per request; authorization middleware runs per route with different role/permission requirements.
5. **JWT claims**: include `role` and/or `permissions` in the JWT payload so authorization checks don't require a DB lookup on every request. Watch for stale permissions if roles change — short token lifetimes mitigate this.
6. **Principle of least privilege**: users should only have the minimum permissions needed. Default to deny.

### Complexity

| | Authentication | Authorization |
|--|---|---|
| Question answered | Who are you? | What can you do? |
| Failure code | 401 Unauthorized | 403 Forbidden |
| Data needed | Token/credential | Role/permission |
| When to run | Every request | Per route/resource |

---

## Q60: How do you implement RBAC (Role-Based Access Control) in a Node.js API?

### ELI5

RBAC is like a job title system. In a company, a "Manager" can approve expenses, view reports, and hire staff. An "Employee" can only submit expenses and view their own records. You don't set individual permissions for each person — you assign them a role, and the role carries all the permissions. Adding a new hire is simple: assign them Employee role. Promoting someone: change their role to Manager.

### Visual Diagram

```
Roles and permissions defined upfront:

  admin:     ['read:users', 'write:users', 'delete:users', 'read:reports', 'write:reports']
  manager:   ['read:users', 'read:reports', 'write:reports']
  editor:    ['read:users', 'write:reports']
  viewer:    ['read:users', 'read:reports']

User has a role: user.role = 'editor'

Request: DELETE /api/users/42 --> requires 'delete:users'
  editor permissions include 'delete:users'? NO --> 403 Forbidden

Request: GET /api/reports --> requires 'read:reports'
  editor permissions include 'read:reports'? YES --> allow

Hierarchy approach:
  admin > manager > editor > viewer
  Each level inherits all permissions of levels below it
```

### Code Example

```javascript
// ============================================================
// config/rbac.js — Role and permission definitions (single source of truth)
// ============================================================
const PERMISSIONS = {
  READ_USERS: 'read:users',
  WRITE_USERS: 'write:users',
  DELETE_USERS: 'delete:users',
  READ_REPORTS: 'read:reports',
  WRITE_REPORTS: 'write:reports',
  MANAGE_ROLES: 'manage:roles',
};

// Each role lists exactly which permissions it has — explicit, no magic inheritance
const ROLES = {
  viewer: [PERMISSIONS.READ_USERS, PERMISSIONS.READ_REPORTS],
  editor: [PERMISSIONS.READ_USERS, PERMISSIONS.WRITE_REPORTS, PERMISSIONS.READ_REPORTS],
  manager: [
    PERMISSIONS.READ_USERS, PERMISSIONS.WRITE_USERS,
    PERMISSIONS.READ_REPORTS, PERMISSIONS.WRITE_REPORTS,
  ],
  admin: Object.values(PERMISSIONS), // admin has every permission
};

module.exports = { PERMISSIONS, ROLES };

// ============================================================
// middleware/rbac.js — reusable authorization middleware
// ============================================================
const { ROLES } = require('../config/rbac');

// Check if user's role includes the required permission
function can(permission) {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole || !ROLES[userRole]) {
      return res.status(403).json({ error: 'No role assigned' });
    }

    const allowed = ROLES[userRole].includes(permission);

    if (!allowed) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permission,
        yourRole: userRole,
      });
    }

    next();
  };
}

// Check if user HAS one of the given roles (role-level check, not permission-level)
function hasRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden', requiredRole: roles });
    }
    next();
  };
}

module.exports = { can, hasRole };

// ============================================================
// routes/users.js — applying RBAC to routes
// ============================================================
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { can, hasRole } = require('../middleware/rbac');
const { PERMISSIONS } = require('../config/rbac');
const router = express.Router();

// All routes require authentication first
router.use(authenticate);

router.get('/',        can(PERMISSIONS.READ_USERS),   listUsers);
router.post('/',       can(PERMISSIONS.WRITE_USERS),  createUser);
router.delete('/:id',  can(PERMISSIONS.DELETE_USERS), deleteUser);

// Admin-only — role check instead of permission check for coarse-grained access
router.post('/bulk-import', hasRole('admin'), bulkImport);

// ============================================================
// Dynamic RBAC: roles stored in DB (for runtime updates without redeploy)
// ============================================================
async function canDynamic(permission) {
  return async (req, res, next) => {
    // Fetch the user's current role from DB (role may have changed since JWT was issued)
    const userFromDb = await userRepository.findById(req.user.userId);
    const rolePerms = await roleRepository.getPermissions(userFromDb.role);

    if (!rolePerms.includes(permission)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = router;
```

### Step-by-Step Explanation

1. **Define permissions as constants** (not magic strings) — preventing typos and enabling IDE autocomplete.
2. **Map roles to permission arrays** in one config file — when requirements change, one file changes.
3. **`can(permission)` middleware** checks the authenticated user's role against the permission registry. This is a permission-level check — fine-grained.
4. **`hasRole(...roles)` middleware** does a coarser role-level check for endpoints that are conceptually "admin only" rather than permission-specific.
5. **JWT vs DB**: storing `role` in the JWT means zero DB lookups for auth, but if you change a user's role the change only takes effect when their token expires. For immediate role change propagation, do a DB lookup per request (or invalidate the token).
6. **Dynamic RBAC**: store roles and permissions in a database — admins can add/remove permissions at runtime without deploying code. Cache the role config in Redis with a short TTL.
7. **ABAC (Attribute-Based)**: for more complex scenarios — "a user can edit their own posts but not others'". This requires passing the resource being accessed to the authorization check, not just the role.

### Complexity

| Factor | Static RBAC (config file) | Dynamic RBAC (DB) |
|--------|--------------------------|-------------------|
| Permission check cost | O(1) in-memory | O(1) with Redis cache |
| Role changes take effect | On next token issuance | Immediately (with DB lookup) |
| Deployment needed for changes | Yes | No |
| Complexity | Low | Medium |

---

## Q61: How did your Azure AD + Function App auth flow work end to end?

### ELI5

Azure AD is Microsoft's identity provider — think of it as the company's security guard system. A Function App is like a small specialized worker. When a client wants to call the Function App, Azure AD acts as the gatekeeper: the client gets a pass (access token) from Azure AD by proving its identity, then shows that pass to the Function App. The Function App verifies the pass is genuine (by checking Azure AD's public keys) and only then does the work.

### Visual Diagram

```
Client (another service or user)
         |
         | 1. POST /oauth2/v2.0/token
         |    { client_id, client_secret, grant_type: 'client_credentials',
         |      scope: 'api://<FunctionApp-App-ID>/.default' }
         v
   Azure AD (Token Endpoint)
         |
         | 2. Returns JWT access token
         |    { aud: 'api://<FunctionApp-App-ID>', roles: [...], ... }
         v
Client bears the token
         |
         | 3. GET https://<func>.azurewebsites.net/api/endpoint
         |    Authorization: Bearer <access_token>
         v
   Azure Function App
         |
         | 4. Function App Authentication (built-in EasyAuth)
         |    OR custom middleware validates JWT:
         |    - Fetch JWKS from https://login.microsoftonline.com/<tenant>/discovery/v2.0/keys
         |    - Verify signature using public key
         |    - Check aud === 'api://<FunctionApp-App-ID>'
         |    - Check iss === 'https://sts.windows.net/<tenant>/'
         |    - Check exp > now
         v
   Business Logic Executes

App Registrations needed:
  - Client App Registration (has client_id + client_secret)
  - Function App Registration (defines the 'api://' URI and app roles)
  - Client App Registration granted permission to Function App Registration
```

### Code Example

```javascript
// ============================================================
// Function App: validate Azure AD JWT manually (without EasyAuth)
// ============================================================
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const TENANT_ID = process.env.AZURE_TENANT_ID;
const AUDIENCE = `api://${process.env.FUNCTION_APP_CLIENT_ID}`; // your Function App's app ID URI

// jwks-rsa fetches and caches Azure AD's public signing keys
const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000, // cache keys for 10 minutes
});

// Called by jsonwebtoken to retrieve the correct public key for signature verification
function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

// Middleware: validates Azure AD JWT on every incoming request
function validateAzureToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  jwt.verify(
    token,
    getSigningKey,
    {
      audience: AUDIENCE,                                         // must match
      issuer: `https://sts.windows.net/${TENANT_ID}/`,           // must match
      algorithms: ['RS256'],                                      // Azure AD uses RSA
    },
    (err, decoded) => {
      if (err) return res.status(401).json({ error: 'Invalid token', detail: err.message });
      req.user = decoded;   // { oid, appid, roles, scp, ... }
      next();
    }
  );
}

// ============================================================
// Client: getting a token and calling the Function App
// ============================================================
const axios = require('axios');

async function callFunctionApp(endpoint, data) {
  // Step 1: get token from Azure AD using client credentials
  const tokenRes = await axios.post(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: process.env.CLIENT_APP_ID,
      client_secret: process.env.CLIENT_APP_SECRET,
      grant_type: 'client_credentials',
      scope: `${AUDIENCE}/.default`,  // request access to Function App
    })
  );

  const accessToken = tokenRes.data.access_token;

  // Step 2: call the Function App with the bearer token
  const response = await axios.post(endpoint, data, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return response.data;
}
```

### Step-by-Step Explanation

1. **Two App Registrations**: one for the calling client (has client secret), one for the Function App (defines the API URI `api://...` and app roles).
2. **Client requests token**: POST to Azure AD's `/token` endpoint with `client_id`, `client_secret`, `grant_type: client_credentials`, and `scope` pointing to the Function App's App ID URI.
3. **Token returned**: JWT with `aud` = Function App's ID, `iss` = Azure AD tenant, `appid` = caller's client ID, and any `roles` assigned.
4. **Function App validates**: either using Azure's built-in "EasyAuth" (App Service Authentication — zero code) or manually with `jsonwebtoken` + `jwks-rsa`.
5. **JWKS endpoint**: Azure AD publishes its public keys at `/.well-known/openid-configuration` → `jwks_uri`. Your app fetches the key matching the JWT's `kid` header to verify the signature.
6. **App Roles**: defined on the Function App registration, granted to the client app registration. These appear as `roles` array in the token — your Function App can check `req.user.roles.includes('DataReader')`.
7. **EasyAuth vs manual**: EasyAuth is zero-config and handles token validation, but gives less control. Manual validation lets you check custom claims, integrate with your middleware chain, and work in non-Azure environments.
8. **Service Principal**: when you register a client app and grant it client credentials, Azure creates a "Service Principal" in your tenant — track these in your access review audits.

### Complexity

| Component | Detail |
|-----------|--------|
| Token endpoint | `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` |
| JWKS endpoint | `https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys` |
| Required claims to verify | aud, iss, exp, nbf |
| Token lifetime | Default 1 hour — cache and reuse |
| EasyAuth | Built-in Function App auth — no code needed, limited customization |
| Manual validation | Full control, works outside Azure, requires jwks-rsa package |

---

## Q62: What is the difference between bcrypt `hash()` and `compare()`? What are salt rounds?

### ELI5

Imagine a magic blender. You put a password in, add random spices (the salt), blend it for a while, and out comes a weird smoothie. The longer you blend (more rounds), the harder it is to reverse. `hash()` does the blending. `compare()` is for later — when someone says "I think the password was 'password123'", you put that in the same blender with the same spices, blend it the same amount, and check if the result looks the same as what's in your fridge. You never need to unblend — you just blend again and compare.

### Visual Diagram

```
HASHING (registration):

  password: "mySecret123"
  +---bcrypt.hash("mySecret123", 12)---+
  |                                    |
  1. Generate random salt (22 chars)   |
     e.g., "$2b$12$N9qo8uLOickgx2ZMRZo"
  2. Concatenate salt + password       |
  3. Run bcrypt key-derivation 2^12    |
     (4096) times                      |
  4. Produce 60-char hash string       |
  +------------------------------------+
  Stored hash: "$2b$12$N9qo8uLOickgx2ZMRZoIIuBnmWepMaKmB6N3wPPVhC4lc6CtEQBG"
                 ^^  ^^  ^^^^^^^^^^^^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
               algo rounds      salt              hash

COMPARISON (login):

  password: "mySecret123"
  stored hash: "$2b$12$N9qo8u..."
  |
  bcrypt.compare("mySecret123", storedHash)
  --> extract salt from stored hash
  --> run bcrypt 2^12 times on (salt + input)
  --> compare result to stored hash
  --> returns true / false
```

### Code Example

```javascript
const bcrypt = require('bcrypt');

// ----- Hashing a password — always async in production -----
async function hashPassword(plainTextPassword) {
  const saltRounds = 12; // cost factor: 2^12 = 4096 iterations
  // bcrypt.hash internally generates a random salt — you don't need to handle it separately
  const hash = await bcrypt.hash(plainTextPassword, saltRounds);
  // hash is a 60-character string containing algorithm, rounds, salt, and hash all in one
  return hash;
}

// ----- Comparing a password at login -----
async function verifyPassword(plainTextPassword, storedHash) {
  // bcrypt.compare extracts the salt from storedHash and recomputes
  // Returns true if they match, false otherwise — never throws on mismatch
  const match = await bcrypt.compare(plainTextPassword, storedHash);
  return match;
}

// ----- Usage in registration route -----
async function registerUser(email, plainPassword) {
  // Hash BEFORE storing — never store plain text passwords
  const passwordHash = await hashPassword(plainPassword);
  await db.users.create({ email, passwordHash });
}

// ----- Usage in login route -----
async function loginUser(email, plainPassword, res) {
  const user = await db.users.findOne({ email });

  // Always run compare even if no user found — prevents timing attacks
  // If user doesn't exist, compare against a dummy hash so response time is consistent
  const dummyHash = '$2b$12$N9qo8uLOickgx2ZMRZoIIuBnmWepMaKmB6N3wPPVhC4lc6CtEQBG';
  const passwordToCheck = user?.passwordHash ?? dummyHash;

  const match = await bcrypt.compare(plainPassword, passwordToCheck);

  if (!user || !match) {
    // Same message regardless of whether email or password was wrong — prevents enumeration
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Issue JWT here...
}

// ----- Choosing salt rounds -----
// Aim for ~100–300ms on your production server hardware
// Test with:
async function benchmarkRounds() {
  for (let rounds = 10; rounds <= 14; rounds++) {
    const start = Date.now();
    await bcrypt.hash('test', rounds);
    console.log(`Rounds ${rounds}: ${Date.now() - start}ms`);
  }
}
// Typical results: 10=~70ms, 11=~140ms, 12=~280ms, 13=~560ms, 14=~1100ms
```

### Step-by-Step Explanation

1. **`bcrypt.hash(password, saltRounds)`**: generates a random 22-character salt, runs the bcrypt key derivation function `2^saltRounds` times, and returns a 60-character string encoding the algorithm version, rounds, salt, and hash.
2. **Salt**: random data mixed into the password before hashing. Even if two users have the same password, their hashes will be different. Stored inside the hash string — you don't need to store it separately.
3. **Salt rounds (cost factor)**: controls how many iterations bcrypt runs. Doubling rounds doubles compute time. This is intentional — it makes brute-force attacks `2x` more expensive whenever you increment by 1.
4. **`bcrypt.compare(password, hash)`**: extracts the salt from the stored hash, reruns bcrypt with the same params, and does a constant-time comparison. Returns `true` or `false` — never throws on a mismatch.
5. **Constant-time comparison**: bcrypt uses `timingSafeEqual` internally — the comparison takes the same time regardless of where it first differs. This prevents timing attacks that could reveal partial password information.
6. **Timing attack prevention**: always call `bcrypt.compare` even when the user doesn't exist (use a dummy hash). Otherwise, a failed lookup returns instantly while a valid user takes 300ms — an attacker can enumerate valid email addresses by response time.
7. **Cost calibration**: target 100–300ms on your production server. Retest after hardware upgrades. A slow hash is a feature, not a bug — but don't go so slow it impacts legitimate login UX.
8. **bcrypt vs Argon2**: bcrypt is well-tested and widely used. Argon2 (winner of the Password Hashing Competition) offers memory-hardness, making GPU attacks more expensive. Both are acceptable; Argon2id is the modern recommendation.

### Complexity

| Operation | Time | Notes |
|-----------|------|-------|
| bcrypt.hash (12 rounds) | ~280ms | Intentionally slow — attacker cost |
| bcrypt.compare | ~280ms | Same cost as hash — constant time |
| MD5/SHA-1 hash | < 1ms | NEVER use for passwords — too fast to brute-force |
| GPU brute force (12 rounds) | ~280ms per attempt per thread | Cost scales linearly with rounds |
| argon2id | ~100–300ms | Memory-hard — GPU farming less effective |

---

## Q63: How do you prevent SQL injection in Node.js?

### ELI5

SQL injection happens when an attacker sneaks their own SQL commands into your query by sending malicious input. Imagine asking a librarian "Please find the book called `'; DROP TABLE books; --`". If the librarian just reads your request literally without checking, all the books disappear. Preventing it is simple: use parameterized queries — treat user input as DATA, not as part of the SQL command. The librarian puts your request in quotes and looks for a book literally called that, rather than running it as a command.

### Visual Diagram

```
VULNERABLE (string concatenation):

  const query = "SELECT * FROM users WHERE email = '" + email + "'";
  
  email = "' OR '1'='1"
  Result: SELECT * FROM users WHERE email = '' OR '1'='1'
  --> Returns ALL users! Authentication bypassed.

  email = "'; DROP TABLE users; --"
  Result: SELECT * FROM users WHERE email = ''; DROP TABLE users; --'
  --> Deletes the entire table!

SAFE (parameterized query):

  const query = "SELECT * FROM users WHERE email = $1";
  const values = [email];
  
  email = "' OR '1'='1"
  DB executes: SELECT * FROM users WHERE email = ''' OR ''1''=''1'
  --> Treats input as a string literal — returns 0 rows. Safe.
```

### Code Example

```javascript
const { Pool } = require('pg'); // PostgreSQL client
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ============================================================
// NEVER do this — vulnerable to SQL injection
// ============================================================
// async function findUserBad(email) {
//   const query = `SELECT * FROM users WHERE email = '${email}'`; // DANGER!
//   return pool.query(query);
// }

// ============================================================
// CORRECT: Parameterized queries — user input goes in the values array
// ============================================================
async function findUserByEmail(email) {
  // $1 is a placeholder — pg driver sends the value separately to PostgreSQL
  // PostgreSQL treats it as a literal value, never as SQL syntax
  const { rows } = await pool.query(
    'SELECT id, name, email, role FROM users WHERE email = $1',
    [email]  // values array — indexed $1, $2, etc.
  );
  return rows[0] ?? null;
}

// Multiple parameters
async function searchUsers({ role, minAge, limit = 20 }) {
  const { rows } = await pool.query(
    'SELECT id, name FROM users WHERE role = $1 AND age >= $2 LIMIT $3',
    [role, minAge, limit]
  );
  return rows;
}

// ============================================================
// With an ORM (Sequelize) — parameterization is automatic
// ============================================================
const { User } = require('../models');

async function findUserSequelize(email) {
  // Sequelize always parameterizes — safe by default
  return User.findOne({ where: { email } });
}

// DANGER even with ORM — using raw SQL with string concatenation
// async function badOrm(email) {
//   return User.findOne({ where: sequelize.literal(`email = '${email}'`) }); // VULNERABLE
// }

// ============================================================
// With Knex.js query builder — also safe by default
// ============================================================
const knex = require('knex')({ client: 'pg', connection: process.env.DATABASE_URL });

async function findUserKnex(email) {
  return knex('users').where({ email }).first(); // parameterized automatically
}

// ============================================================
// Dynamic query building — safe approach with an allow-list
// ============================================================
const ALLOWED_SORT_COLUMNS = new Set(['name', 'created_at', 'email']); // allow-list

async function listUsers({ sortBy = 'created_at', sortDir = 'asc', page = 1 }) {
  // Column names and ORDER BY directions CANNOT be parameterized in SQL
  // Validate against an allow-list to prevent injection via these dynamic parts
  if (!ALLOWED_SORT_COLUMNS.has(sortBy)) {
    throw new Error('Invalid sort column');
  }
  const direction = sortDir === 'desc' ? 'DESC' : 'ASC'; // sanitize to one of two values

  const offset = (page - 1) * 20;
  // Column and direction injected as code (validated), values as params
  const { rows } = await pool.query(
    `SELECT * FROM users ORDER BY ${sortBy} ${direction} LIMIT $1 OFFSET $2`,
    [20, offset]
  );
  return rows;
}
```

### Step-by-Step Explanation

1. **Root cause**: SQL injection occurs when user-supplied input is concatenated directly into a SQL string and the database executes the attacker's injected SQL.
2. **Parameterized queries** (prepared statements): the SQL structure and the values are sent to the database separately. The database driver escapes and quotes values automatically — they can never be interpreted as SQL syntax.
3. **Placeholders**: `pg` uses `$1, $2, ...`; `mysql2` uses `?`; Knex/Sequelize handle it internally. Always pass values as the second argument to `query()`, not inside the string.
4. **ORMs are mostly safe**: Sequelize, Prisma, TypeORM parameterize by default. The danger is using their raw query escape hatches (`sequelize.literal()`, `prisma.$queryRaw`) with string concatenation.
5. **Dynamic column names/ORDER BY**: these cannot be parameterized because they are structural SQL, not values. Validate them against a hardcoded allow-list before interpolating.
6. **Second order injection**: data that was safely inserted can later be read and used unsafely in another query. Always parameterize, even when reading from the database.
7. **Stored procedures** are not automatically safe — they can still run dynamic SQL internally. Parameterize within them too.
8. **Least privilege**: the database user your app connects as should only have SELECT, INSERT, UPDATE, DELETE on the tables it needs — not DROP TABLE or other DDL.

### Complexity

| Approach | SQL Injection Risk | Notes |
|----------|-------------------|-------|
| String concatenation | HIGH — never use | Attacker controls query structure |
| Parameterized queries (pg, mysql2) | None | Values are always literals |
| ORM default queries | None | Automatically parameterized |
| ORM raw queries with concatenation | HIGH | Treat like raw SQL |
| Allow-list for column/direction | None (if validated strictly) | Required for dynamic ORDER BY |

---

## Q64: What is CSRF? How do you prevent it in a REST API vs a web app?

### ELI5

CSRF (Cross-Site Request Forgery) is when an evil website tricks YOUR browser into making a request to a site you're logged into. Imagine you're logged into your bank. You visit an evil site, and it has a hidden button that submits a form to `bank.com/transfer?to=attacker&amount=1000`. Your browser automatically includes your bank's cookies, so the bank thinks YOU made the transfer. CSRF is the attack of making the browser do things you didn't intend.

### Visual Diagram

```
Normal login:
  User --> POST bank.com/login --> bank sets Cookie: session=ABC

CSRF Attack:
  User (logged in to bank.com)
    |
    | visits evil.com
    v
  evil.com page contains:
  <img src="https://bank.com/transfer?to=evil&amount=1000">
  OR
  <form method="POST" action="https://bank.com/transfer">
    <input name="amount" value="1000">
    <input name="to" value="evil">
  </form>
  <script>document.forms[0].submit();</script>
    |
    | browser automatically attaches Cookie: session=ABC
    v
  bank.com processes the transfer!

--- Defence mechanisms ---

SameSite Cookie:    Cookie: session=ABC; SameSite=Strict
  --> browser refuses to send this cookie on cross-origin requests
  --> evil.com's request arrives without the cookie --> 401

CSRF Token:         Form includes { csrfToken: 'random-secret' }
  --> server checks token; evil.com can't read your tokens (SOP)
  --> missing/wrong token --> 403

Origin/Referer check:  server verifies request origin header
  --> Origin: https://evil.com --> reject
  --> Origin: https://bank.com --> allow
```

### Code Example

```javascript
const express = require('express');
const { doubleCsrf } = require('csrf-csrf'); // modern CSRF library
const cookieParser = require('cookie-parser');
const app = express();

app.use(cookieParser());
app.use(express.json());

// ============================================================
// APPROACH 1: SameSite cookies — modern browsers, REST APIs & web apps
// ============================================================
// Set all session/auth cookies with SameSite=Strict or Lax
app.use((req, res, next) => {
  // If you're setting cookies for auth, always include SameSite
  // This is the SIMPLEST and most effective CSRF defence for modern apps
  res.cookie('sessionId', 'value', {
    httpOnly: true,      // JS cannot read it
    secure: true,        // HTTPS only
    sameSite: 'strict',  // never sent on cross-origin requests
    maxAge: 3600000,     // 1 hour
  });
  next();
});

// ============================================================
// APPROACH 2: JWT in Authorization header (REST API best practice)
// ============================================================
// If your REST API uses JWT in Authorization: Bearer header (not cookies),
// CSRF is NOT possible — browsers can't set custom headers on cross-origin requests
// (XHR/fetch don't auto-attach Authorization headers, unlike cookies)
// This is why most REST APIs using Bearer tokens are naturally CSRF-immune

function authenticate(req, res, next) {
  // Token in header = CSRF-immune. Token in cookie = needs SameSite or CSRF token
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing auth header' });
  // ...verify JWT
  next();
}

// ============================================================
// APPROACH 3: CSRF tokens — for session-cookie-based web apps (forms)
// ============================================================
const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  cookieName: '__Host-psifi.x-csrf-token', // __Host- prefix = extra secure
  cookieOptions: { secure: true, sameSite: 'strict', path: '/' },
  size: 64,
});

// Load CSRF middleware for form-based endpoints
app.use(doubleCsrfProtection);

// Server-rendered form: client fetches a CSRF token first
app.get('/csrf-token', (req, res) => {
  // Return token to include in next form submission
  res.json({ csrfToken: generateToken(req, res) });
});

// Protected form endpoint: doubleCsrfProtection validates the token
app.post('/transfer', (req, res) => {
  // If CSRF token is missing or wrong, doubleCsrfProtection throws before reaching here
  const { to, amount } = req.body;
  res.json({ success: true, to, amount });
});

// ============================================================
// APPROACH 4: Origin/Referer check (defence in depth)
// ============================================================
function checkOrigin(req, res, next) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const allowedOrigins = ['https://yourapp.com', 'https://www.yourapp.com'];

  // Skip for GET requests (should be idempotent)
  if (req.method === 'GET') return next();

  const requestOrigin = origin || (referer ? new URL(referer).origin : null);
  if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  next();
}

app.listen(3000);
```

### Step-by-Step Explanation

1. **CSRF exploits the browser's automatic cookie attachment**: any request to `example.com` will include `example.com` cookies, regardless of which site triggered the request.
2. **REST API with Bearer token (header)**: naturally CSRF-immune. Browsers' cross-origin XHR/fetch cannot set custom `Authorization` headers without CORS permission from the target server. A malicious page can't steal the token because it's in JS memory, not in a cookie.
3. **SameSite cookies**: `SameSite=Strict` — the cookie is never sent on cross-origin requests at all. `SameSite=Lax` — allows cookies on top-level navigations (GET) but not on cross-origin POST. This is the simplest modern CSRF defence.
4. **Double-Submit CSRF token**: client fetches a token from the server (stored in a cookie), includes it in every state-changing request as a header or form field. Evil site can't read your cookies (Same-Origin Policy), so it can't get the token to include.
5. **Synchronizer Token Pattern**: server stores a random token in the session, includes it in every HTML form, and validates it on POST. Works for server-rendered HTML apps.
6. **When CSRF matters**: only when authentication uses cookies. GraphQL APIs, REST APIs with Bearer tokens, and APIs that use `Authorization: Basic` are all CSRF-safe.
7. **CORS is NOT CSRF protection**: CORS prevents cross-origin JS from reading responses. CSRF is about forging requests, not reading them. A CSRF attack doesn't need to read the response.
8. **Defence in depth**: combine SameSite cookies + CSRF tokens for maximum protection in web apps that use session cookies.

### Complexity

| Method | Protects | Works for | Effort |
|--------|----------|-----------|--------|
| Bearer token in header | All CSRF | REST APIs | Low — just use auth header |
| SameSite=Strict cookie | All CSRF | Modern browsers | Low — set cookie attribute |
| CSRF token (double-submit) | All CSRF | Form-based web apps | Medium |
| Origin/Referer check | Most CSRF | API + web | Low — defence-in-depth |
| CORS | Not CSRF | Cross-origin read | Separate concern |

---

## Q65: How do you securely store secrets in a Node.js production app?

### ELI5

Secrets are like your house keys — you don't write them on a sticky note on the front door (don't commit them to git), you don't shout them across the office (don't log them), and you don't give a copy to every person you meet (don't pass them as plain env vars in Docker logs). You keep them in a locked safe (a secrets manager like AWS Secrets Manager or Azure Key Vault) and only the right people (services with the right IAM role) can open it.

### Visual Diagram

```
BAD (never do):
  Code: const secret = "myDatabasePassword123"; // hardcoded
  .env committed to git                          // leaked in repo history
  process.env.SECRET in Docker logs             // exposed in log outputs
  Secrets in CI/CD environment variables (unmasked) // visible in pipeline logs

GOOD (production patterns):

  AWS:
    Developer --> stores secrets in AWS Secrets Manager
    EC2/Lambda --> IAM Role grants access (no credentials needed in code)
    Code --> secretsManager.getSecretValue('prod/db/password') --> auto-rotated value

  Azure:
    Developer --> stores secrets in Azure Key Vault
    App Service/Function --> Managed Identity (no credentials needed)
    Code --> keyVaultClient.getSecret('db-password') --> value

  Local development:
    .env file (NOT committed) --> loaded by dotenv
    .gitignore includes .env
    .env.example committed (shows keys, not values)
```

### Code Example

```javascript
// ============================================================
// Pattern 1: .env for local dev (dotenv) — never commit .env
// ============================================================
// .gitignore: .env, .env.local, .env.production
// .env.example (committed, no real values):
//   DATABASE_URL=postgresql://user:password@localhost:5432/mydb
//   JWT_SECRET=your-secret-here
//   REDIS_URL=redis://localhost:6379

require('dotenv').config(); // loads .env into process.env — development only

// ============================================================
// Pattern 2: AWS Secrets Manager — zero secrets in code or env
// ============================================================
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({ region: 'us-east-1' });

// Cache secrets in memory to avoid API call on every request
const secretCache = new Map();

async function getSecret(secretName) {
  if (secretCache.has(secretName)) {
    return secretCache.get(secretName);
  }

  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );

  // Secrets can be stored as JSON string or plain string
  const secretValue = response.SecretString
    ? JSON.parse(response.SecretString)
    : Buffer.from(response.SecretBinary, 'base64').toString();

  secretCache.set(secretName, secretValue);
  return secretValue;
}

// Usage: credentials come from Secrets Manager, not environment variables
async function getDatabaseConfig() {
  const secret = await getSecret('prod/myapp/database');
  return {
    host: secret.host,
    username: secret.username,
    password: secret.password, // auto-rotated by Secrets Manager
    database: secret.dbname,
  };
}

// ============================================================
// Pattern 3: Azure Key Vault with Managed Identity
// ============================================================
const { SecretClient } = require('@azure/keyvault-secrets');
const { DefaultAzureCredential } = require('@azure/identity');

// DefaultAzureCredential uses Managed Identity in Azure, falls back to local CLI auth
// NO client secret or SAS token in code — the Azure infrastructure grants access
const credential = new DefaultAzureCredential();
const kvClient = new SecretClient(
  `https://${process.env.KEY_VAULT_NAME}.vault.azure.net`,
  credential
);

async function getKeyVaultSecret(secretName) {
  const secret = await kvClient.getSecret(secretName);
  return secret.value;
}

// ============================================================
// Pattern 4: Guard against accidentally logging secrets
// ============================================================
// Never directly console.log(req.body) — it may contain passwords
// Sanitize logged objects:
function sanitizeForLogging(obj) {
  const SENSITIVE_KEYS = new Set(['password', 'token', 'secret', 'authorization', 'creditCard']);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v,
    ])
  );
}

// ============================================================
// Pattern 5: Validate required env vars at startup (fail fast)
// ============================================================
function requireEnv(...keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// App crashes immediately on startup if secrets aren't set — better than mysterious runtime errors
requireEnv('DATABASE_URL', 'JWT_SECRET', 'REDIS_URL');
```

### Step-by-Step Explanation

1. **Never commit secrets to git**: use `.gitignore` to exclude `.env` files. If a secret is committed, rotate it immediately — git history retains it even after deletion.
2. **Environment variables for simple deployments**: `process.env.SECRET` is better than hardcoding, but env vars appear in `docker inspect`, `/proc/*/environ`, and some logging systems. Use them for non-critical config and secrets managers for sensitive values.
3. **Secrets managers (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault)**: store secrets outside your codebase and infrastructure config. Access is controlled by IAM roles/Managed Identity — no credentials needed in the application code itself.
4. **Managed Identity / IAM role**: the compute resource (EC2, Lambda, AKS pod, App Service) is granted permission to read secrets by an IAM role — no client secret or access key is needed in the environment. The credential is granted at the infrastructure level.
5. **Secret rotation**: Secrets Manager can auto-rotate database passwords. Your app fetches the current value each time (or on a cache refresh) — the code never hardcodes the actual value.
6. **Never log secrets**: sanitize request bodies and environment before logging. Use structured logging with allow-lists of loggable fields.
7. **Fail fast at startup**: validate that all required environment variables/secrets are present when the server starts. This prevents mysterious errors at request time when a secret is missing.
8. **Secret scanning**: use tools like `git-secrets`, `truffleHog`, or GitHub's secret scanning feature to detect accidentally committed secrets before they are pushed.

### Complexity

| Method | Security Level | Effort | Use case |
|--------|---------------|--------|----------|
| Hardcoded in code | None — never | Zero | Never |
| .env file (not committed) | Low-medium | Very low | Local dev only |
| Environment variables | Medium | Low | Simple deployments |
| AWS Secrets Manager | High | Medium | AWS workloads |
| Azure Key Vault + Managed Identity | High | Medium | Azure workloads |
| HashiCorp Vault | High | High | Multi-cloud / on-prem |

--- End of Section 8 ---

---

# Section 9: MONGODB (Q66-Q80)

---

## Q66: When would you embed a document vs use a reference? Give a real example for each.

### ELI5

Embedding is like writing your shopping list directly in your diary — it's all in one place, easy to find. Referencing is like writing "see the shopping list pinned to the fridge" — two places to look, but the shopping list can be reused in multiple diaries. Embed when the data belongs to ONE parent and you always need both together. Reference when the data is shared across many documents, or when the nested data can grow unboundedly.

### Visual Diagram

```
--- EMBED: Blog post with comments (few, owned, always read together) ---
{
  _id: ObjectId,
  title: "My Post",
  body: "...",
  comments: [             // <-- embedded array
    { author: "Alice", text: "Great post!", createdAt: ... },
    { author: "Bob",   text: "Thanks!", createdAt: ... }
  ]
}
Single read = full post + all comments. Atomic update. 16MB doc limit.

--- REFERENCE: Order with a customer ---
// orders collection
{ _id: ObjectId, items: [...], total: 100, customerId: ObjectId("abc") }
//                                                       ^^ reference

// users collection
{ _id: ObjectId("abc"), name: "Alice", email: "alice@example.com" }

Separate collections. Join with $lookup in aggregation.
One customer can have many orders — embedding customer IN each order = massive duplication.

--- RULES OF THUMB ---
Embed when:
  - "owns" relationship (post owns its own comments if there are few)
  - always accessed together
  - data doesn't change independently
  - bounded size (won't grow past a few hundred items)

Reference when:
  - "many-to-many" or "many-to-one" (orders BELONG TO a customer)
  - sub-document grows unboundedly (an active user's event log)
  - data is shared / accessed independently
  - the embedded array could exceed 16MB BSON limit
```

### Code Example

```javascript
// ============================================================
// EMBED: User profile with addresses (owned, few, always read together)
// ============================================================
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  // Embedded array — addresses belong entirely to this user
  // max 10 saved addresses per user — bounded, safe to embed
  addresses: [{
    label: String,         // 'home', 'work'
    street: String,
    city: String,
    postcode: String,
    isDefault: Boolean,
  }],
});

// Single query gets user + all addresses
const user = await User.findById(userId);
const defaultAddress = user.addresses.find(a => a.isDefault);

// Atomic update: add a new address
await User.updateOne(
  { _id: userId },
  { $push: { addresses: { label: 'work', street: '1 Main St', city: 'London', isDefault: false } } }
);

// ============================================================
// REFERENCE: Order referencing a product (product shared across many orders)
// ============================================================
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },     // reference
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // reference
    quantity: Number,
    priceAtPurchase: Number, // snapshot price — important! don't rely on live product price
  }],
  total: Number,
  status: { type: String, enum: ['pending', 'shipped', 'delivered'] },
});

// Populate to resolve references (triggers additional DB queries)
const order = await Order
  .findById(orderId)
  .populate('userId', 'name email')              // only fetch name and email
  .populate('items.productId', 'name imageUrl'); // only fetch name and image

// Aggregation $lookup (single query, more efficient than populate for large datasets)
const ordersWithProducts = await Order.aggregate([
  { $match: { _id: mongoose.Types.ObjectId(orderId) } },
  { $unwind: '$items' },
  {
    $lookup: {
      from: 'products',
      localField: 'items.productId',
      foreignField: '_id',
      as: 'items.product',
    },
  },
]);
```

### Step-by-Step Explanation

1. **Embed when**: the child data is owned exclusively by the parent (one address belongs to one user), is always read with the parent, has bounded size, and requires atomic updates.
2. **Reference when**: the data is shared (a product appears in thousands of orders), the sub-array is unbounded (event logs), or the child documents are large and sometimes needed independently.
3. **16MB BSON document limit**: MongoDB documents can't exceed 16MB. An embedded array of user activity logs could hit this limit quickly — use a reference/separate collection with `userId` index.
4. **Snapshot price anti-pattern**: reference `productId` in order items, but also store `priceAtPurchase` as a snapshot. If you only reference and the product price changes, historical orders show wrong prices.
5. **Hybrid approach**: embed a summary (product name, price at purchase) for read performance, and keep the reference for consistency checks. Common in e-commerce.
6. **`populate()`**: Mongoose's ORM-style join — fires a separate query per referenced field. Convenient but inefficient for large result sets.
7. **`$lookup`**: MongoDB's aggregation join — single round-trip, more efficient than populate, but less readable.

### Complexity

| Concern | Embed | Reference |
|---------|-------|-----------|
| Read performance | O(1) — single document | O(n) with $lookup or populate |
| Write performance | Atomic | Multi-document (transactions needed for consistency) |
| Data duplication | None within document | Potential (snapshot pattern) |
| Max safe size | Hundreds of sub-docs | Unlimited |
| Indexing sub-fields | Supports array index | Index the FK field |

---

## Q67: What is the ESR rule for compound indexes? Why does field order matter?

### ELI5

Imagine a phone book sorted by last name, then first name, then city. Finding "Smith, John, London" is fast. But finding "everyone in London" is slow because the book isn't sorted by city first. MongoDB indexes work the same way. The ESR rule says: put **E**quality fields first (exact match), then **S**ort fields, then **R**ange fields. Field order determines which queries the index supports efficiently.

### Visual Diagram

```
Query: find users where role='admin' AND age BETWEEN 25 AND 40 ORDER BY name

ESR Rule applied:
  E = role (equality: role = 'admin')
  S = name  (sort: ORDER BY name)
  R = age   (range: 25 <= age <= 40)

Correct index:  { role: 1, name: 1, age: 1 }
  --> MongoDB narrows by role (equality), then uses index for sort (no in-memory sort),
      then applies range filter while still in the index

Wrong index:  { age: 1, name: 1, role: 1 }
  --> MongoDB scans entire age range first, can't use index for sort

--- Why order matters ---

Index: { role: 1, name: 1 }

Query: { role: 'admin' }           --> uses index (left prefix)
Query: { role: 'admin', name: 'A' } --> uses index (full match)
Query: { name: 'Alice' }           --> CANNOT use this index (role is first)
  --> must do collection scan unless separate index on name exists
```

### Code Example

```javascript
// ============================================================
// Practical index design using ESR rule
// ============================================================
// Query: "Find all published articles by category, sorted by date, created in last 30 days"
// db.articles.find({ status: 'published', category: 'tech' })
//             .sort({ publishedAt: -1 })
//             .gte('publishedAt', thirtyDaysAgo)

const articleSchema = new mongoose.Schema({
  title: String,
  category: String,
  status: { type: String, enum: ['draft', 'published', 'archived'] },
  publishedAt: Date,
  authorId: mongoose.Schema.Types.ObjectId,
  views: Number,
});

// ESR: status (E) + category (E) + publishedAt (S+R combined)
// Both equality fields first, then the date field used for both sort and range
articleSchema.index({ status: 1, category: 1, publishedAt: -1 });

// Additional index for author's article list (separate use case)
articleSchema.index({ authorId: 1, publishedAt: -1 });

// ============================================================
// Verifying index usage with explain()
// ============================================================
// Run explain to check which index was chosen and whether it's efficient:
// db.articles.find({ status: 'published', category: 'tech' })
//            .sort({ publishedAt: -1 })
//            .explain('executionStats')
//
// Look for:
//   winningPlan.inputStage.indexName  --> which index was used
//   totalDocsExamined                 --> should be close to totalDocsReturned
//   executionTimeMillis               --> latency
//
// Red flags:
//   stage: "COLLSCAN"   --> no index used, full collection scan
//   stage: "SORT"       --> in-memory sort (index not used for sort)
//   totalDocsExamined >> totalDocsReturned --> low selectivity

// ============================================================
// Index with partial filter — only index a subset of documents
// ============================================================
// Index only active users — saves index space, faster writes for inactive users
articleSchema.index(
  { authorId: 1, publishedAt: -1 },
  { partialFilterExpression: { status: 'published' } }
);

// ============================================================
// Compound index direction matters for multi-field sort
// ============================================================
// Query: sort by (publishedAt DESC, title ASC)
articleSchema.index({ publishedAt: -1, title: 1 }); // matches sort direction exactly

// This index CANNOT satisfy the above sort (directions conflict)
// articleSchema.index({ publishedAt: 1, title: 1 }); // wrong for publishedAt DESC
```

### Step-by-Step Explanation

1. **ESR Rule**: Equality → Sort → Range. Fields used in exact equality matches go first in the index, sort fields go in the middle, and range fields (>, <, between) go last.
2. **Why equality first**: equality fields eliminate the most documents immediately, making the index as selective as possible before the expensive range scan.
3. **Why sort before range**: if the sort field comes after the range field, MongoDB cannot use the index to satisfy the sort and must do an in-memory sort (`SORT` stage in explain) — very expensive for large result sets.
4. **Left-prefix rule**: MongoDB can use an index for any query that matches a left prefix of the index fields. `{ a: 1, b: 1, c: 1 }` supports queries on `{a}`, `{a, b}`, `{a, b, c}` — but NOT `{b}` or `{c}` alone.
5. **Covered query**: if ALL fields in the query AND projection are in the index, MongoDB never touches the actual documents — returns directly from the index. Zero document fetches.
6. **Index direction**: for single-field sorts, direction doesn't matter much (index can be traversed forward or backward). For multi-field sorts, each field's index direction must match or mirror the sort direction.
7. **Partial filter expressions**: index only the subset of documents you actually query — saves disk, speeds up writes, reduces index maintenance cost.

### Complexity

| | Notes |
|--|--|
| Without index | O(n) collection scan |
| With ESR index | O(log n + k) where k = matching docs |
| In-memory sort (SORT stage) | O(k log k) — expensive if k is large |
| Covered query | O(log n) — zero doc fetches |
| Max index fields | 32 fields per compound index |

---

## Q68: What is a covered query in MongoDB? How do you achieve it?

### ELI5

Normally when MongoDB searches, it looks at the index to find which documents match, then fetches those documents from disk to return the fields you asked for — two trips. A covered query is when the index already contains ALL the fields you need in both the filter AND the result. MongoDB can answer the whole question just from the index — no need to fetch the actual documents at all. It's like finding a fact in a book's index without needing to read the chapter.

### Visual Diagram

```
Normal query (non-covered):
  Index lookup (btree) --> finds [docId1, docId2, ...]
         |
         v
  Fetch documents from disk   <-- extra I/O
         |
         v
  Return { name, email }

Covered query:
  Index: { email: 1, name: 1 } contains BOTH email and name
  Query: db.users.find({ email: 'a@b.com' }, { name: 1, email: 1, _id: 0 })
         |
         v
  Index lookup (btree) --> finds exact entry with [email, name] values
         |
  NO document fetch needed -- data is IN the index leaf node
         v
  Return { name, email }   <-- from index only

Conditions for covered query:
  1. All query filter fields are in the index
  2. All projection fields are in the index
  3. Projection excludes _id (or _id is in the index)
  4. No array fields in the query (arrays make covering impossible)
```

### Code Example

```javascript
// ============================================================
// Setting up a covered query
// ============================================================
const userSchema = new mongoose.Schema({
  email: String,
  name: String,
  role: String,
  passwordHash: String,  // sensitive — NEVER include in projections
  createdAt: Date,
});

// Index includes all fields needed for the query AND projection
// Query: { email }, Projection: { name, email } -- both in index
userSchema.index({ email: 1, name: 1 }); // covering index

// ============================================================
// Query that IS covered
// ============================================================
const user = await User.findOne(
  { email: 'alice@example.com' },   // filter: email is in index
  { name: 1, email: 1, _id: 0 }    // projection: name + email in index, _id excluded
);
// explain() will show: stage NOT 'FETCH' -- no document read needed

// ============================================================
// Query that is NOT covered (and why)
// ============================================================
// Missing _id: 0 -- _id is NOT in the index, so MongoDB must fetch the doc
const notCovered1 = await User.findOne(
  { email: 'alice@example.com' },
  { name: 1, email: 1 }  // _id implicitly included -- breaks coverage
);

// Requesting a field not in the index
const notCovered2 = await User.findOne(
  { email: 'alice@example.com' },
  { name: 1, email: 1, createdAt: 1, _id: 0 } // createdAt not in index
);

// ============================================================
// Verifying with explain
// ============================================================
// In mongosh:
// db.users.find({ email: 'alice@example.com' }, { name: 1, email: 1, _id: 0 }).explain()
//
// Covered query plan:
//   winningPlan.stage: "PROJECTION_COVERED"
//   inputStage.stage:  "IXSCAN"   (index scan only)
//
// Non-covered:
//   winningPlan.stage: "PROJECTION_DEFAULT"
//   inputStage.stage:  "FETCH"   (document fetch needed)
//   inputStage.inputStage.stage: "IXSCAN"

// ============================================================
// High-volume read with covered query (e.g., email existence check)
// ============================================================
// Just checking if email exists — no need to fetch the full document
async function emailExists(email) {
  const result = await User.findOne(
    { email },
    { email: 1, _id: 0 } // covered by { email: 1 } index (unique)
  ).lean();
  return result !== null;
}
```

### Step-by-Step Explanation

1. A covered query satisfies all its filter conditions AND returns all its projected fields using only the index — no document fetch.
2. **Three conditions**: all filter fields in the index; all projection fields in the index; `_id` must be explicitly excluded (`_id: 0`) OR be part of the index itself (since MongoDB always includes `_id` otherwise).
3. **Why it's fast**: document storage and index storage are physically separate in WiredTiger. A covered query avoids the extra disk I/O to fetch documents, reducing latency significantly.
4. **Array fields break coverage**: if any queried field is an array (even if indexed), the query cannot be covered because MongoDB must verify the array contains the queried value.
5. **Verify with explain()**: look for `PROJECTION_COVERED` and `IXSCAN` only. If you see `FETCH`, the query is not covered.
6. **Practical use**: covered queries are excellent for high-volume lookups like "does this email exist?", "what is this user's name?", "list all IDs in a category" — queries on hot paths where latency matters.
7. **Trade-off**: wider covering indexes consume more write overhead (every write updates the index). Use covering indexes for read-heavy, latency-sensitive queries.

### Complexity

| | Regular Query | Covered Query |
|--|---|---|
| Index scan | O(log n) | O(log n) |
| Document fetch | O(k) docs from disk | None |
| Total I/O | Index + document pages | Index pages only |
| Ideal for | General queries | High-volume hot-path reads |

---

## Q69: How does `$lookup` work in aggregation? Write a query joining orders with users.

### ELI5

In a filing cabinet, your orders are in drawer 1 and customer info is in drawer 2. Normally you'd look up an order, note the customer ID, walk to drawer 2, look up the customer, and combine them manually. `$lookup` is like having a robot assistant who does this combining for you in one step — it joins data from two collections based on a matching field, right inside your aggregation pipeline.

### Visual Diagram

```
orders collection:
  { _id: 1, customerId: ObjectId('u1'), total: 100, status: 'shipped' }
  { _id: 2, customerId: ObjectId('u1'), total: 50,  status: 'pending' }
  { _id: 3, customerId: ObjectId('u2'), total: 200, status: 'shipped' }

users collection:
  { _id: ObjectId('u1'), name: 'Alice', email: 'alice@x.com' }
  { _id: ObjectId('u2'), name: 'Bob',   email: 'bob@x.com'   }

$lookup joins orders -> users (localField: customerId, foreignField: _id):

Result (embedded array):
  {
    _id: 1, total: 100, status: 'shipped',
    customer: [{ name: 'Alice', email: 'alice@x.com' }]  // array
  }

After $unwind + $project:
  { orderId: 1, total: 100, status: 'shipped', customerName: 'Alice' }
```

### Code Example

```javascript
// ============================================================
// Basic $lookup: join orders with users
// ============================================================
const orderSummaries = await Order.aggregate([
  // Stage 1: filter — only shipped orders
  { $match: { status: 'shipped' } },

  // Stage 2: $lookup — join users collection on customerId = users._id
  {
    $lookup: {
      from: 'users',             // the OTHER collection to join
      localField: 'customerId',  // field in orders that holds the FK
      foreignField: '_id',       // field in users that matches
      as: 'customerDocs',        // name of the array field added to each order doc
    },
  },

  // Stage 3: $unwind — flatten the array to a single object (1-to-1 joins)
  // preserveNullAndEmpty: true keeps orders with no matching customer
  { $unwind: { path: '$customerDocs', preserveNullAndEmptyArrays: true } },

  // Stage 4: $project — shape the output, rename fields
  {
    $project: {
      _id: 0,
      orderId: '$_id',
      total: 1,
      status: 1,
      orderDate: '$createdAt',
      customerName: '$customerDocs.name',
      customerEmail: '$customerDocs.email',
    },
  },

  // Stage 5: sort by most recent first
  { $sort: { orderDate: -1 } },
]);

// ============================================================
// Advanced: $lookup with pipeline (MongoDB 3.6+)
// Allows filtering and transforming the joined collection BEFORE the join
// More efficient than joining everything then filtering
// ============================================================
const ordersWithRecentActivity = await Order.aggregate([
  { $match: { status: 'pending' } },
  {
    $lookup: {
      from: 'users',
      let: { cid: '$customerId' }, // pass local fields to the sub-pipeline as variables
      pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$cid'] } } }, // use $$variable in $expr
        { $project: { name: 1, email: 1, _id: 0 } },        // only take needed fields
      ],
      as: 'customer',
    },
  },
  { $unwind: '$customer' },
  {
    $project: {
      total: 1,
      status: 1,
      'customer.name': 1,
      'customer.email': 1,
    },
  },
]);

// ============================================================
// $lookup for aggregation report: orders grouped by customer
// ============================================================
const customerOrderSummary = await Order.aggregate([
  {
    $group: {
      _id: '$customerId',
      totalOrders: { $sum: 1 },
      totalRevenue: { $sum: '$total' },
      avgOrderValue: { $avg: '$total' },
    },
  },
  {
    $lookup: {
      from: 'users',
      localField: '_id',
      foreignField: '_id',
      as: 'user',
    },
  },
  { $unwind: '$user' },
  {
    $project: {
      customerName: '$user.name',
      totalOrders: 1,
      totalRevenue: 1,
      avgOrderValue: { $round: ['$avgOrderValue', 2] },
    },
  },
  { $sort: { totalRevenue: -1 } },
  { $limit: 10 }, // top 10 customers by revenue
]);
```

### Step-by-Step Explanation

1. **`$lookup` syntax**: `from` (target collection), `localField` (FK in current doc), `foreignField` (PK in target), `as` (output array field name).
2. **Result is always an array**: even for 1-to-1 joins, `$lookup` adds an array. Use `$unwind` to flatten it to a single embedded object.
3. **`preserveNullAndEmptyArrays: true`** in `$unwind`: keeps documents where the join matched nothing (left outer join behaviour). Without it — inner join (unmatched docs disappear).
4. **Pipeline-based `$lookup`** (`let` + `pipeline`): allows filtering, projecting, or transforming the joined collection before materializing the join. Crucial for performance — don't join 10,000 documents and then throw away 9,900.
5. **`$$variable`**: in a pipeline `$lookup`, you access the outer document's fields via `$$variableName` (double dollar) inside `$match: { $expr: ... }`.
6. **Performance**: `$lookup` requires an index on the `foreignField` in the joined collection. Without an index on `_id`/`foreignField`, every lookup requires a full scan of the joined collection.
7. **`$lookup` is not a SQL JOIN**: it materializes the joined array in memory. For very large join result sets, consider denormalizing (store the customer's name directly in the order document) to avoid runtime joins.
8. **When to use `$lookup` vs `populate()`**: `$lookup` is a single aggregation pipeline round-trip; `populate()` fires N+1 queries (one per joined document). For analytics and large datasets, prefer `$lookup`.

### Complexity

| | Detail |
|--|--|
| $lookup without index on foreignField | O(n * m) — full scan of joined collection per doc |
| $lookup with index on foreignField | O(n * log m) |
| Pipeline $lookup with filter | O(n * log m) where m = matching docs only |
| $unwind | O(k) where k = total array elements |

---

## Q70: What is the difference between `find()` with `skip()` vs cursor-based pagination? Why is `skip()` slow?

### ELI5

`skip()` is like being told "the answer is on page 500 of this book" and you flip through all 499 pages to get there — the database literally processes and discards all the previous documents. Cursor-based pagination is like using a bookmark — you remember exactly where you stopped, and next time you open straight to that page. For small datasets `skip()` is fine, but at page 500 with 100,000 records, `skip()` is reading 49,900 records to throw them away.

### Visual Diagram

```
skip() / offset pagination:
  Page 1: db.posts.find().sort({_id:1}).skip(0).limit(20)    --> scans 20 docs
  Page 2: db.posts.find().sort({_id:1}).skip(20).limit(20)   --> scans 40 docs (skip 20 + read 20)
  Page 3: db.posts.find().sort({_id:1}).skip(40).limit(20)   --> scans 60 docs (skip 40 + read 20)
  Page N: skip = (N-1)*20     --> scans N*20 docs  O(N*pageSize)

  At page 1000 with pageSize 20: scan 20,000 documents, return 20. Very slow.

Cursor-based pagination:
  Page 1: db.posts.find().sort({_id:1}).limit(21)
          --> returns 20 items + 1 extra (to detect if there's a next page)
          last item _id = ObjectId("abc")

  Page 2: db.posts.find({ _id: { $gt: ObjectId("abc") } }).sort({_id:1}).limit(21)
          --> index seek to "abc", scan forward 21 docs.
          --> ALWAYS O(log n + pageSize) regardless of page number
```

### Code Example

```javascript
// ============================================================
// skip() / offset pagination — simple but degrades at scale
// ============================================================
async function getPostsOffset(page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    Post.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Post.countDocuments(), // needed for "total pages" — also slow on large collections
  ]);

  return {
    posts,
    page,
    totalPages: Math.ceil(total / limit),
    hasNextPage: skip + posts.length < total,
  };
}
// OK for: admin dashboards, small collections (< 10k docs), when page numbers matter

// ============================================================
// Cursor-based pagination — scalable, used in feeds and infinite scroll
// ============================================================
async function getPostsCursor({ limit = 20, cursor = null } = {}) {
  // cursor = the _id of the last item from the previous page
  const query = cursor
    ? { _id: { $lt: cursor } } // for descending sort: get items OLDER than cursor
    : {};

  // Fetch one extra item to determine if there's a next page
  const posts = await Post
    .find(query)
    .sort({ _id: -1 }) // newest first (descending _id = descending insertion order)
    .limit(limit + 1)
    .lean();

  const hasNextPage = posts.length > limit;
  const items = hasNextPage ? posts.slice(0, limit) : posts; // trim the extra item

  return {
    items,
    nextCursor: hasNextPage ? items[items.length - 1]._id : null,
    hasNextPage,
  };
}

// Usage:
// First page:  getPostsCursor({ limit: 20 })
//              --> { items: [...], nextCursor: ObjectId("xyz"), hasNextPage: true }
// Second page: getPostsCursor({ limit: 20, cursor: ObjectId("xyz") })

// ============================================================
// Cursor pagination with a non-_id sort field (e.g., createdAt)
// Compound cursor needed when sort field isn't unique
// ============================================================
async function getPostsByDate({ limit = 20, lastCreatedAt = null, lastId = null } = {}) {
  const query = lastCreatedAt
    ? {
        $or: [
          { createdAt: { $lt: new Date(lastCreatedAt) } },
          // tie-breaker: same timestamp, use _id to disambiguate
          { createdAt: new Date(lastCreatedAt), _id: { $lt: lastId } },
        ],
      }
    : {};

  const posts = await Post
    .find(query)
    .sort({ createdAt: -1, _id: -1 }) // compound sort for stable ordering
    .limit(limit + 1)
    .lean();

  const hasNextPage = posts.length > limit;
  const items = hasNextPage ? posts.slice(0, limit) : posts;
  const last = items[items.length - 1];

  return {
    items,
    nextCursor: hasNextPage ? { lastCreatedAt: last.createdAt, lastId: last._id } : null,
    hasNextPage,
  };
}
```

### Step-by-Step Explanation

1. **`skip(n)` cost**: MongoDB scans and discards `n` documents every time. Page 100 with limit 20 = scan 1,980 documents, return 20. Page 1,000 = scan 19,980, return 20. O(n) per page request.
2. **Cursor-based cost**: uses `$gt`/`$lt` on an indexed field — MongoDB seeks directly to the cursor position in the index. O(log n) regardless of which page number.
3. **The +1 trick**: fetch `limit + 1` items. If you get `limit + 1` back, there IS a next page. Trim the extra item before returning. This avoids an extra `countDocuments` call.
4. **Cursor value**: should be the `_id` or a compound `(sortField, _id)` from the last item of the previous page. Pass it back to the client and require it on the next request.
5. **When skip() is acceptable**: page numbers in admin interfaces, collections under ~10,000 docs, or when the user jumps to an arbitrary page number (cursor pagination can't do "go to page 42").
6. **Compound cursor needed for non-unique sort fields**: if sorting by `createdAt` and two documents have the same timestamp, a cursor on `createdAt` alone is ambiguous. Add `_id` as a tie-breaker.
7. **Stable ordering**: sort by an immutable field (`_id`, `createdAt`). Sorting by `updatedAt` or `score` means items can move between pages as data changes.

### Complexity

| Approach | Page 1 | Page N | Total docs scanned |
|----------|--------|--------|-------------------|
| skip(n).limit(20) | O(log n + 20) | O(skip + 20) | O(N * pageSize) |
| Cursor $gt/$lt | O(log n + 20) | O(log n + 20) | O(pageSize) always |

---

## Q71: How do you implement transactions in MongoDB? What are the limitations?

### ELI5

A transaction is like an "all or nothing" deal — either everything in the group succeeds, or nothing happens. Imagine transferring money between two bank accounts: deduct from account A AND add to account B. If the app crashes after the deduction but before the addition, account A loses money that never arrived. A transaction wraps both operations so they either both succeed or both are rolled back.

### Visual Diagram

```
Without transaction:
  1. deduct £100 from account A   (success)
  2. [crash / error here]
  3. add £100 to account B        (never runs)
  --> account A lost £100, account B unchanged. Data inconsistency!

With transaction:
  START SESSION
    1. deduct £100 from account A   (tentative)
    2. add £100 to account B        (tentative)
  COMMIT
    --> both changes applied atomically
  If any step throws:
  ABORT
    --> both changes rolled back, data unchanged

MongoDB transaction requirements:
  - MongoDB 4.0+  for replica set transactions
  - MongoDB 4.2+  for sharded cluster transactions
  - Must use a replica set (even locally: mongod --replSet rs0)
  - Sessions (ClientSession) are used to coordinate
```

### Code Example

```javascript
const mongoose = require('mongoose');

// ============================================================
// Money transfer with MongoDB transaction
// ============================================================
async function transferFunds(fromAccountId, toAccountId, amount) {
  // Step 1: Start a session — all operations in the transaction use this session
  const session = await mongoose.startSession();

  try {
    // Step 2: Start the transaction with optional read/write concern
    session.startTransaction({
      readConcern: { level: 'snapshot' }, // see consistent snapshot of data
      writeConcern: { w: 'majority' },    // writes acknowledged by majority of replica set
    });

    // Step 3: Perform operations — MUST pass { session } to ALL operations in the transaction
    const fromAccount = await Account.findOneAndUpdate(
      { _id: fromAccountId, balance: { $gte: amount } }, // filter: check sufficient funds
      { $inc: { balance: -amount } },                    // atomic deduct
      { session, new: true }                             // use same session, return updated doc
    );

    if (!fromAccount) {
      // Insufficient funds — abort before even trying the credit
      await session.abortTransaction();
      throw Object.assign(new Error('Insufficient funds'), { statusCode: 400 });
    }

    await Account.findByIdAndUpdate(
      toAccountId,
      { $inc: { balance: amount } }, // atomic credit
      { session }
    );

    // Step 4: Commit — both changes become visible atomically
    await session.commitTransaction();

    return { success: true, transferred: amount };

  } catch (err) {
    // Step 5: Abort on any error — all changes rolled back
    // Check if transaction is still active before aborting (commitTransaction may have succeeded)
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw err;

  } finally {
    // Step 6: Always end the session to release resources
    session.endSession();
  }
}

// ============================================================
// Mongoose-specific: withTransaction() helper (auto-retries transient errors)
// ============================================================
async function createOrderWithInventory(userId, items) {
  const session = await mongoose.startSession();

  const result = await session.withTransaction(async () => {
    // withTransaction handles start/commit/abort/retry automatically
    // It retries on transient errors (e.g., WriteConflict from concurrent transactions)

    // Create the order
    const [order] = await Order.create([{ userId, items }], { session });

    // Deduct inventory for each item using Promise.all
    await Promise.all(
      items.map(({ productId, quantity }) =>
        Product.findByIdAndUpdate(
          productId,
          { $inc: { stock: -quantity } },
          { session }
        )
      )
    );

    return order;
  });

  session.endSession();
  return result;
}
```

### Step-by-Step Explanation

1. **Start a session** with `mongoose.startSession()` — a session is the mechanism that tracks which operations belong to the same transaction.
2. **`session.startTransaction()`** begins the ACID transaction on the session.
3. **Pass `{ session }` to every operation** in the transaction — any operation without the session runs outside the transaction, defeating the purpose.
4. **`commitTransaction()`**: makes all changes durably visible. If any operation fails before this point and you throw, call `abortTransaction()` to roll back.
5. **`withTransaction()`**: Mongoose's helper that handles retry on transient errors (`TransientTransactionError`, `UnknownTransactionCommitResult`) — important for production reliability in replica sets.
6. **Limitations**: transactions are significantly slower than single-document operations (network round-trips, lock contention). Use them only when you genuinely need cross-document atomicity.
7. **Replica set requirement**: standalone `mongod` does NOT support multi-document transactions. For local development, start MongoDB as a single-node replica set (`--replSet rs0`).
8. **16MB result set limit**: transactions have a 16MB BSON size limit per operation. Transactions modifying large numbers of documents may hit memory pressure limits.
9. **Design first**: MongoDB's single-document atomicity is very powerful — `$push`, `$inc`, array operations are all atomic. Only reach for transactions when you genuinely need multi-collection atomicity.

### Complexity

| | Single-document op | Multi-doc transaction |
|--|---|---|
| Atomicity scope | One document | Multiple documents / collections |
| Latency | <1ms | 5–20ms (extra round-trips) |
| Requires replica set | No | Yes |
| Retry on conflict | N/A | Use withTransaction() |
| Max transaction size | N/A | 16MB document limit |
| Lock contention | Minimal | Higher — concurrent writes can abort |

---

## Q72: What is a Change Stream in MongoDB? Give a real use case.

### ELI5

A Change Stream is like subscribing to a news feed about your database. Instead of asking "did anything change?" every few seconds (polling), you tell MongoDB: "call me whenever something in this collection changes". MongoDB taps into its internal replication log (oplog) and sends you a notification for every insert, update, delete. This lets you react to data changes in real time.

### Visual Diagram

```
MongoDB Replica Set
   Primary
      |
      +-- oplog (operations log) -- all write operations recorded here
      |
      v
  Change Stream watches the oplog
      |
      | event: { operationType: 'insert', fullDocument: {...}, ... }
      v
  Your Node.js listener function runs
      |
      v
  Downstream action:
    - Notify WebSocket clients in real time
    - Invalidate Redis cache
    - Trigger a workflow (email, invoice generation)
    - Sync to search index (Elasticsearch)
    - Audit log (write to separate audit collection)
```

### Code Example

```javascript
const mongoose = require('mongoose');

// ============================================================
// Watch for new orders and notify connected WebSocket clients
// ============================================================
function startOrderChangeStream(io) { // io = Socket.io server instance
  const Order = mongoose.model('Order');

  // Watch the orders collection -- pipeline filters to only inserts and certain statuses
  const pipeline = [
    {
      $match: {
        $or: [
          { operationType: 'insert' },
          {
            operationType: 'update',
            'updateDescription.updatedFields.status': { $exists: true },
          },
        ],
      },
    },
    {
      // Only return the fields we need — reduces bandwidth
      $project: {
        operationType: 1,
        'fullDocument._id': 1,
        'fullDocument.userId': 1,
        'fullDocument.total': 1,
        'fullDocument.status': 1,
        'updateDescription.updatedFields.status': 1,
      },
    },
  ];

  const changeStream = Order.watch(pipeline, {
    fullDocument: 'updateLookup', // include the full updated document (not just the diff)
    resumeAfter: null,            // start from now; set to a resumeToken to replay from a point
  });

  // Fires for each matching change event
  changeStream.on('change', (event) => {
    const { operationType, fullDocument } = event;

    if (operationType === 'insert') {
      // Emit to all admin dashboard WebSocket clients
      io.to('admin').emit('newOrder', {
        orderId: fullDocument._id,
        userId: fullDocument.userId,
        total: fullDocument.total,
      });
    }

    if (operationType === 'update') {
      const newStatus = event.updateDescription.updatedFields.status;
      // Notify the specific user that their order status changed
      io.to(`user:${fullDocument.userId}`).emit('orderStatusUpdate', {
        orderId: fullDocument._id,
        status: newStatus,
      });
    }
  });

  // Error handling: change streams emit errors on replica set failover, network issues
  changeStream.on('error', (err) => {
    console.error('Change stream error:', err);
    // Reconnect with the resume token to avoid replaying missed events
    // resumeToken = changeStream.resumeToken before the error
  });

  return changeStream;
}

// ============================================================
// Cache invalidation: invalidate Redis when a product changes
// ============================================================
function watchProductChanges(redis) {
  const Product = mongoose.model('Product');
  const stream = Product.watch();

  stream.on('change', async (event) => {
    const productId = event.documentKey._id.toString();

    // Invalidate the cached product and any listing caches that might include it
    await Promise.all([
      redis.del(`product:${productId}`),
      redis.del('products:list'),
    ]);

    console.log(`Cache invalidated for product ${productId} due to ${event.operationType}`);
  });
}
```

### Step-by-Step Explanation

1. **Change Streams tap the oplog**: MongoDB's replica set records every write operation in the oplog (operation log). Change Streams provide a filtered, resumable view of that log.
2. **Requires replica set**: Change Streams are not available on standalone `mongod` instances — they need at least a single-node replica set.
3. **Resume tokens**: each change event includes a `resumeToken`. Store it; if your listener crashes and restarts, pass `resumeAfter: savedToken` to replay events you missed.
4. **`fullDocument: 'updateLookup'`**: for update events, MongoDB by default only sends the changed fields. This option additionally fetches and includes the full updated document (an extra read).
5. **Pipeline filtering**: pass a MongoDB aggregation pipeline to `watch()` to filter which events you receive. Filter at the source — don't subscribe to everything and filter in your Node code.
6. **Real use cases**: real-time dashboard updates, cache invalidation, search index sync (Elasticsearch), audit logging, event-driven workflows (trigger email on order insert), data replication to another system.
7. **Polling alternative**: change streams eliminate polling loops. Polling at 1-second intervals creates unnecessary DB load; change streams are push-based and idle until a change occurs.
8. **In MongoDB Atlas**: the Atlas Triggers product uses Change Streams under the hood — you configure them through a UI rather than writing Node code.

### Complexity

| | Polling | Change Stream |
|--|---|---|
| DB load at rest | O(1) per poll interval | Zero (event-driven) |
| Latency | Up to polling interval | Near-real-time (<100ms typical) |
| Missed events | None (re-queries) | Resume token protects against crashes |
| Requires replica set | No | Yes (MongoDB 3.6+) |

---

## Q73: What is a TTL index? When would you use it?

### ELI5

A TTL (Time-To-Live) index is an automatic cleaner. You tell MongoDB: "delete any document in this collection that is more than X seconds old, using this date field as the clock". MongoDB runs a background cleanup every 60 seconds and removes expired documents for you — no cron job, no scheduled script, no DELETE queries needed.

### Visual Diagram

```
Collection: sessions
  { _id: ..., userId: 'u1', createdAt: ISODate("2026-03-21T10:00:00"), data: {...} }
  { _id: ..., userId: 'u2', createdAt: ISODate("2026-03-21T09:00:00"), data: {...} }

TTL Index: db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 })

After 3600 seconds (1 hour):
  Background TTL thread runs every 60s
  Finds: createdAt < (now - 3600s) = ISODate("2026-03-21T09:00:00")
  Deletes: userId u2's session automatically
  ISODate("2026-03-21T10:00:00") is still valid (created 1 hour later)

--- Expiry at a specific time (expireAfterSeconds: 0) ---
  { token: 'abc', expiresAt: ISODate("2026-03-21T11:30:00") }
  TTL: db.tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  --> document deleted AT expiresAt time exactly (within ~60s)
```

### Code Example

```javascript
const mongoose = require('mongoose');

// ============================================================
// Pattern 1: TTL from creation time (e.g., session expiry)
// ============================================================
const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  token: { type: String, unique: true },
  data: mongoose.Schema.Types.Mixed, // arbitrary session data
  createdAt: { type: Date, default: Date.now }, // TTL clock field
});

// Delete sessions 24 hours (86400 seconds) after createdAt
sessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

const Session = mongoose.model('Session', sessionSchema);

// ============================================================
// Pattern 2: TTL at a specific future time (flexible per-document TTL)
// ============================================================
const passwordResetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  token: { type: String, unique: true },
  expiresAt: { type: Date, required: true }, // when THIS specific token expires
});

// expireAfterSeconds: 0 means "delete at exactly the expiresAt time"
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

// Creating a token that expires in 1 hour from now
async function createPasswordResetToken(userId) {
  const token = require('crypto').randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  await PasswordReset.create({ userId, token, expiresAt });
  return token;
}

// ============================================================
// Other TTL use cases
// ============================================================
// Refresh token storage (7-day expiry)
const refreshTokenSchema = new mongoose.Schema({
  hash: String,
  userId: mongoose.Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now },
});
refreshTokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 }); // 7 days

// Rate limiting counters (1-minute window)
const rateLimitSchema = new mongoose.Schema({
  key: { type: String, unique: true }, // e.g., 'rate:192.168.1.1'
  count: Number,
  windowStart: { type: Date, default: Date.now },
});
rateLimitSchema.index({ windowStart: 1 }, { expireAfterSeconds: 60 }); // auto-clean after 1 min

// Temporary job queue entries (24-hour cleanup)
const jobSchema = new mongoose.Schema({
  type: String,
  payload: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ['pending', 'completed', 'failed'] },
  completedAt: Date, // TTL only on completed/failed jobs
});
// Only TTL-expire completed jobs (partial index prevents deleting pending jobs)
jobSchema.index(
  { completedAt: 1 },
  {
    expireAfterSeconds: 86400, // keep completed jobs for 24 hours for debugging
    partialFilterExpression: { status: { $in: ['completed', 'failed'] } },
  }
);
```

### Step-by-Step Explanation

1. **TTL index**: a special single-field index on a `Date` field that enables MongoDB's background TTL thread to automatically delete expired documents.
2. **`expireAfterSeconds: N`**: documents where `dateField < now - N seconds` are eligible for deletion.
3. **`expireAfterSeconds: 0`**: documents are deleted at exactly the time stored in `dateField` — useful when each document has a different expiry (password reset tokens, OTP codes).
4. **Background thread**: MongoDB's TTL monitor runs every 60 seconds. Deletion is not instantaneous — a just-expired document may live for up to 60 extra seconds.
5. **Only single-field, Date fields**: TTL indexes can only be on a single Date field. Compound indexes cannot be TTL indexes.
6. **Use cases**: session storage, JWT refresh tokens, temporary auth codes (OTP, magic links), cache entries, rate limit counters, temporary lock records, log/event data with retention policies.
7. **Alternative to cron jobs**: TTL indexes replace scheduled DELETE queries or background cleanup scripts with zero application code.
8. **Partial filter**: combine `partialFilterExpression` with TTL to only expire a subset of documents (e.g., only `status: 'completed'` jobs, not pending ones).

### Complexity

| | Detail |
|--|--|
| Index type | B-tree (same as regular index) with expiry metadata |
| Cleanup interval | Every 60 seconds (approximate) |
| Cleanup cost | O(expired docs) — background, doesn't block reads/writes |
| Field requirement | Single Date field only |
| Replica sets | TTL monitor only runs on primary; secondaries replicate the deletes |

---

## Q74: What does `.lean()` do in Mongoose? When should you use it?

### ELI5

When you fetch a document with Mongoose, you don't just get back plain data — you get a fully-featured Mongoose Document object with save methods, change tracking, virtual fields, middleware hooks, and lots of overhead attached. `.lean()` tells Mongoose: "I just want the plain JavaScript object, skip all the Mongoose wrapper". It's like asking for a plain text file instead of a Microsoft Word document — you can read it faster, but you can't use Word's features on it.

### Visual Diagram

```
Without .lean():
  Mongoose Document object
  ├── _id, name, email (your actual data)
  ├── $__: { ... internal mongoose state, change tracking... }
  ├── .save()        method
  ├── .remove()      method
  ├── .toObject()    method
  ├── .toJSON()      method
  ├── schema reference (large object)
  └── [many more internal properties]
  Memory: ~10KB overhead per document

With .lean():
  Plain JavaScript Object
  { _id: ..., name: 'Alice', email: 'alice@x.com' }
  Memory: only your actual data
  Speed: 2-5x faster (no prototype setup, no change tracking init)
```

### Code Example

```javascript
// ============================================================
// Without .lean() — returns Mongoose Documents
// ============================================================
const user = await User.findById(id);
// user is a Mongoose Document
// user.save()           works
// user.name = 'Bob'; user.save()  triggers pre/post save hooks
// user._id is a Mongoose ObjectId
// JSON.stringify(user)  triggers .toJSON() which calls schema transforms

// ============================================================
// With .lean() — returns plain JS object
// ============================================================
const user = await User.findById(id).lean();
// user is a plain object: { _id: ObjectId, name: '...', email: '...' }
// user.save()        DOES NOT EXIST — will throw TypeError
// user._id           is a plain ObjectId (not Mongoose wrapped)
// No change tracking, no middleware hooks

// ============================================================
// When to use .lean() — read-only operations
// ============================================================

// API responses — just reading and serializing, no need to save
app.get('/api/users', async (req, res) => {
  const users = await User.find({}).lean(); // faster — no Mongoose overhead per doc
  res.json(users);
});

// Aggregations that loop over many documents
async function stats() {
  const orders = await Order.find({ status: 'completed' }).lean(); // much lighter
  const total = orders.reduce((sum, o) => sum + o.total, 0);
  return { total, count: orders.length };
}

// Feeding data to an aggregation/transformation (no DB writes needed)
const products = await Product.find({ category: 'electronics' }).lean();
const enriched = products.map(p => ({ ...p, priceWithTax: p.price * 1.2 }));

// ============================================================
// When NOT to use .lean() — when you need Mongoose features
// ============================================================

// Updating and saving — need the Document's .save()
const user = await User.findById(id); // NO .lean()
user.name = 'Bob';
await user.save(); // triggers pre-save hooks (e.g., bcrypt hashing)

// Using virtuals (computed fields defined in schema)
const user = await User.findById(id); // NO .lean()
console.log(user.fullName); // virtual that combines firstName + lastName

// Using .lean({ virtuals: true }) to get virtuals with lean
const user = await User.findById(id).lean({ virtuals: true });
console.log(user.fullName); // works with lean + virtuals plugin

// Population (populate) with .lean() — still works, populated fields are plain objects
const order = await Order
  .findById(orderId)
  .populate('userId', 'name email')
  .lean(); // populated userId will be a plain object, not a Mongoose Document
```

### Step-by-Step Explanation

1. **Mongoose Document overhead**: without `.lean()`, every document returned is wrapped in a Mongoose Document prototype with change tracking (`$__`), method bindings (`.save()`, `.remove()`), schema reference, and validation logic. This adds overhead per document.
2. **`.lean()` returns POJOs**: plain JavaScript objects with only your actual data. Faster (2–5x), less memory, directly serializable.
3. **Use `.lean()` for**: read-only API responses, analytical queries over many documents, anywhere you won't call `.save()`, batch processing, data to pass to external services.
4. **Don't use `.lean()` for**: any operation where you call `.save()`, operations that trigger pre/post hooks (bcrypt hashing on save, etc.), code that uses Mongoose virtuals (unless you use `lean({ virtuals: true })` plugin).
5. **`.lean({ virtuals: true })`**: with the `mongoose-lean-virtuals` package, you can get both POJO speed and virtual fields.
6. **`populate` works with `.lean()`**: populated references become plain objects, not Mongoose Documents themselves.
7. **Repository pattern alignment**: repositories should return `.lean()` results — only the raw data, not ORM Documents. Business logic and route handlers shouldn't work with Mongoose Documents directly.

### Complexity

| | Without .lean() | With .lean() |
|--|---|---|
| Memory per doc | ~10KB overhead | Only data size |
| Query speed | Baseline | 2–5x faster |
| .save() | Works | Not available |
| Virtuals | Works | Requires plugin |
| populate | Works | Works (plain objects) |
| Use case | Read + Write flows | Read-only flows |

---

## Q75: How do Mongoose middleware (pre/post hooks) work? Give a use case for `pre('save')`.

### ELI5

Mongoose middleware works like a pipeline of workers before and after a document is saved or deleted. `pre('save')` is a worker who gets to look at the document RIGHT BEFORE it goes into the database — they can change things, validate things, or stop the whole save if something is wrong. `post('save')` is a worker who gets a notification AFTER the save succeeds — they can do follow-up work like sending an email.

### Visual Diagram

```
user.save() called
      |
      v
pre('validate') hooks    -- run before schema validation
      |
      v
Schema validation         -- mongoose validates required fields, types, etc.
      |
      v
pre('save') hooks         -- run before the actual DB write
      |  (hash password here!)
      v
MongoDB write             -- document inserted/updated in DB
      |
      v
post('save') hooks        -- run after successful DB write
      |  (send welcome email here!)
      v
.save() resolves

If any pre hook throws / calls next(error):
      --> save() rejects, DB write NEVER happens, post hooks don't run
```

### Code Example

```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true, trim: true },
  passwordHash: String,
  role: { type: String, default: 'user' },
  loginAttempts: { type: Number, default: 0 },
  isLocked: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
});

// ============================================================
// pre('save'): hash password before saving
// ============================================================
userSchema.pre('save', async function (next) {
  // 'this' = the Mongoose Document being saved
  // isModified('password') = true if the password field was set/changed since last save
  // This prevents re-hashing on every save (e.g., if only name changes)
  if (this.isModified('password')) {
    this.passwordHash = await bcrypt.hash(this.password, 12);
    this.password = undefined; // remove the plain-text password field from the doc
  }

  // Always update the updatedAt timestamp on any save
  this.updatedAt = new Date();

  next(); // or return (in async functions, Mongoose detects promise return)
});

// ============================================================
// pre('save'): prevent overriding a locked account with an unlock
// ============================================================
userSchema.pre('save', function (next) {
  // Custom business rule enforced at the model level
  if (this.loginAttempts >= 5) {
    this.isLocked = true;
  }
  next();
});

// ============================================================
// pre('save'): transform email to lowercase before uniqueness check
// (usually handled by schema option `lowercase: true` — shown here for illustration)
// ============================================================
userSchema.pre('save', function (next) {
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase().trim();
  }
  next();
});

// ============================================================
// post('save'): send welcome email after successful registration
// ============================================================
userSchema.post('save', async function (doc) {
  // doc = the saved document (same as 'this' but after the write)
  // Only send welcome email on initial creation (not on updates)
  if (doc.isNew) { // isNew = true only on the first insert, not subsequent saves
    await emailService.sendWelcomeEmail(doc.email, doc.name);
  }
});

// ============================================================
// post('save'): invalidate Redis cache when user is saved
// ============================================================
userSchema.post('save', (doc) => {
  redis.del(`user:${doc._id}`).catch(console.error);
});

// ============================================================
// pre('deleteOne'): soft delete — prevent hard deletes, set deletedAt instead
// ============================================================
userSchema.pre('deleteOne', { document: true }, function (next) {
  // Instead of physically deleting, set deletedAt
  this.set({ deletedAt: new Date() });
  this.save().then(() => next()).catch(next);
});

// ============================================================
// Query middleware: pre('find') to auto-filter soft-deleted docs
// ============================================================
userSchema.pre(['find', 'findOne', 'findOneAndUpdate'], function (next) {
  // 'this' is the query, not the document
  this.where({ deletedAt: null }); // automatically exclude soft-deleted docs from all finds
  next();
});

const User = mongoose.model('User', userSchema);
```

### Step-by-Step Explanation

1. **Document middleware** (`pre/post('save')`, `pre/post('deleteOne')`, etc.): `this` is the Mongoose Document. Used for transforming, validating, or triggering side-effects on document-level operations.
2. **Query middleware** (`pre/post('find')`, etc.): `this` is the Query object. Used to add filters to all queries automatically (e.g., always exclude soft-deleted records).
3. **`this.isModified('field')`**: returns `true` if the field was changed since the last save. Essential for password hashing — never re-hash if the password didn't change.
4. **`this.isNew`**: `true` only on the first insert (not on subsequent `save()` calls). Use it in `post('save')` to conditionally run one-time actions like sending a welcome email.
5. **Error propagation**: if a pre hook calls `next(new Error(...))` or throws (in async hooks), the save is aborted — the DB write never happens. Clean for validation/business rules.
6. **`async` pre hooks**: return a promise or use `async` — Mongoose waits for the promise to resolve before proceeding. No need to call `next()` in async functions (though it's harmless if you do).
7. **Execution order**: multiple pre hooks of the same type run in registration order. Always call `next()` (or `return`) to advance the chain.
8. **Hooks don't run on bulk ops**: `updateMany()` and `deleteMany()` bypass document hooks — use query middleware or add hook logic in your service layer for bulk operations.

### Complexity

| Hook | 'this' | Runs on |
|------|--------|---------|
| pre('save') | Document | document.save() |
| post('save') | Document | After successful save |
| pre('find') | Query | Model.find() |
| pre('deleteOne') | Document or Query | document.deleteOne() |
| pre('aggregate') | Aggregate | Model.aggregate() |

---

## Q76: What is the aggregation pipeline? Write a pipeline to find the top 5 users by order count.

### ELI5

The aggregation pipeline is like a factory assembly line for your data. Raw documents go in one end. Each stage transforms, filters, groups, or sorts them. At the end, out comes exactly the result you want. Unlike a simple find query (which just filters), aggregation can calculate totals, join collections, reshape documents, and group data — all in one database operation.

### Visual Diagram

```
orders collection (input):
  { userId: 'u1', total: 100, status: 'completed' }
  { userId: 'u1', total: 50,  status: 'completed' }
  { userId: 'u2', total: 200, status: 'completed' }
  { userId: 'u1', total: 30,  status: 'pending'   }
  { userId: 'u3', total: 150, status: 'completed' }

Stage 1: $match
  { status: 'completed' }
  --> removes pending order (u1's £30 order)
  Remaining: 4 docs

Stage 2: $group
  _id: '$userId', count: {$sum:1}, totalSpent: {$sum:'$total'}
  --> { _id: 'u1', count: 2, totalSpent: 150 }
  --> { _id: 'u2', count: 1, totalSpent: 200 }
  --> { _id: 'u3', count: 1, totalSpent: 150 }

Stage 3: $sort  { count: -1 }
  --> u1 first (count 2), u2 and u3 (count 1)

Stage 4: $limit 5
  --> top 5 users only

Stage 5: $lookup (join users collection)
  --> adds user name/email

Stage 6: $project (shape final output)
  --> { rank, userName, orderCount, totalSpent }
```

### Code Example

```javascript
const mongoose = require('mongoose');

// ============================================================
// Find top 5 users by order count (completed orders only)
// ============================================================
async function getTopCustomers(limit = 5) {
  return Order.aggregate([
    // Stage 1: Filter — only count completed orders
    // Always $match first to reduce document count early (uses indexes)
    { $match: { status: 'completed' } },

    // Stage 2: Group by userId, count orders and sum revenue
    {
      $group: {
        _id: '$userId',           // group key
        orderCount: { $sum: 1 }, // count each document as 1 order
        totalRevenue: { $sum: '$total' },
        avgOrderValue: { $avg: '$total' },
        lastOrderDate: { $max: '$createdAt' }, // most recent order
      },
    },

    // Stage 3: Sort by orderCount descending, use totalRevenue as tie-breaker
    { $sort: { orderCount: -1, totalRevenue: -1 } },

    // Stage 4: Keep only the top N results (after sorting!)
    { $limit: limit },

    // Stage 5: Join users collection to get name and email
    {
      $lookup: {
        from: 'users',
        localField: '_id',       // _id is userId after $group
        foreignField: '_id',
        as: 'userDocs',
        pipeline: [
          { $project: { name: 1, email: 1, _id: 0 } }, // only fetch needed fields
        ],
      },
    },

    // Stage 6: Flatten the lookup array (1-to-1 join)
    { $unwind: { path: '$userDocs', preserveNullAndEmptyArrays: true } },

    // Stage 7: Add a rank field using $setWindowFields (MongoDB 5.0+)
    {
      $setWindowFields: {
        sortBy: { orderCount: -1 },
        output: { rank: { $rank: {} } },
      },
    },

    // Stage 8: Project final output shape
    {
      $project: {
        _id: 0,
        rank: 1,
        userId: '$_id',
        customerName: { $ifNull: ['$userDocs.name', 'Unknown'] },
        customerEmail: '$userDocs.email',
        orderCount: 1,
        totalRevenue: { $round: ['$totalRevenue', 2] },
        avgOrderValue: { $round: ['$avgOrderValue', 2] },
        lastOrderDate: 1,
      },
    },
  ]);
}

// ============================================================
// Additional useful pipeline patterns
// ============================================================

// Monthly revenue report
const monthlyRevenue = await Order.aggregate([
  { $match: { status: 'completed', createdAt: { $gte: new Date('2026-01-01') } } },
  {
    $group: {
      _id: {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
      },
      totalRevenue: { $sum: '$total' },
      orderCount: { $sum: 1 },
    },
  },
  { $sort: { '_id.year': 1, '_id.month': 1 } },
]);

// Bucket orders by value range
const orderBuckets = await Order.aggregate([
  {
    $bucket: {
      groupBy: '$total',
      boundaries: [0, 50, 100, 200, 500, Infinity],
      default: 'Other',
      output: { count: { $sum: 1 }, avgTotal: { $avg: '$total' } },
    },
  },
]);
```

### Step-by-Step Explanation

1. **Always `$match` first**: filter documents early to reduce what subsequent stages process. Critically, `$match` at the start of a pipeline can use indexes.
2. **`$group`**: collapses many documents into fewer grouped documents. `_id` is the grouping key; accumulator operators (`$sum`, `$avg`, `$max`, `$min`, `$push`, `$addToSet`) compute values.
3. **`$sort` before `$limit`**: you MUST sort before limiting or you'll get arbitrary documents instead of the top N.
4. **`$lookup` inside a `$group` result**: join after grouping — don't join before grouping (you'd be joining millions of raw documents instead of thousands of group results).
5. **`$project`**: reshapes output — rename fields, compute new fields, include/exclude fields. Use `$ifNull` to handle cases where a `$lookup` found no match.
6. **`$setWindowFields`**: added in MongoDB 5.0, enables SQL-style window functions — rank, dense rank, running totals.
7. **`$bucket`**: groups documents into ranges (buckets) — useful for histograms and distribution charts.
8. **Aggregation vs application-side**: doing the grouping and counting in MongoDB (one round-trip) is far more efficient than fetching all orders and counting in Node.js (transfers all data, uses Node memory).

### Complexity

| Stage | Cost | Notes |
|-------|------|-------|
| $match (with index) | O(log n + k) | Uses index if on first $match |
| $group | O(n) | Processes remaining docs |
| $sort (in-memory) | O(n log n) | Uses index only if immediately follows $match |
| $lookup | O(n * log m) with index | n = docs after group, m = foreign collection |
| $limit | O(1) | After sort — just take first N |

---

## Q77: How do you handle duplicate key errors (error code 11000) in Mongoose?

### ELI5

A unique index is like a rule that says "no two books in the library can have the same ISBN". If someone tries to add a book with an ISBN that already exists, the library system throws an error with a specific code: 11000. In your code, you catch that specific error and give the user a helpful message ("This email is already registered") instead of letting the generic 500 error bubble up.

### Visual Diagram

```
POST /auth/register { email: "alice@example.com", password: "..." }
        |
        v
User.create({ email: 'alice@example.com' })
        |
        v
MongoDB: unique index on email field
        |
        | email 'alice@example.com' already exists?
        |
   YES  +-->  MongoServerError { code: 11000,
        |                        keyPattern: { email: 1 },
        |                        keyValue: { email: 'alice@example.com' } }
        v
   Mongoose forwards this as a MongoServerError object
        |
        v
   Catch in try/catch
   err.code === 11000 --> 409 Conflict "Email already in use"
```

### Code Example

```javascript
const mongoose = require('mongoose');

// ============================================================
// Detecting and handling error code 11000
// ============================================================
async function registerUser(email, password) {
  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash: hashedPassword });
    return user;
  } catch (err) {
    // MongoDB duplicate key error code is 11000
    if (err.code === 11000) {
      // err.keyPattern tells you WHICH fields caused the duplicate
      // e.g., { email: 1 } or { username: 1 } or { email: 1, tenantId: 1 }
      const duplicatedField = Object.keys(err.keyPattern)[0];

      // Throw a user-friendly application error instead of leaking raw DB error
      throw Object.assign(
        new Error(`${duplicatedField} is already taken`),
        { statusCode: 409, field: duplicatedField }
      );
    }
    throw err; // re-throw unknown errors
  }
}

// ============================================================
// Helper: extract duplicate field name from error
// ============================================================
function getDuplicateField(err) {
  if (err.code !== 11000) return null;
  // keyPattern: { email: 1 } --> returns 'email'
  return Object.keys(err.keyPattern || {})[0] || 'unknown field';
}

// ============================================================
// Pattern: upsert instead of insert to avoid the error entirely
// ============================================================
// If you WANT "insert if not exists, update if exists":
async function upsertUser(email, updates) {
  return User.findOneAndUpdate(
    { email },                   // filter: find by email
    { $set: updates },           // update: apply changes
    {
      upsert: true,              // insert if not found
      new: true,                 // return the updated/created document
      setDefaultsOnInsert: true, // apply schema defaults on insert
    }
  );
  // If two concurrent requests try to upsert the same email simultaneously,
  // one will succeed and one will get 11000 -- still handle it!
}

// ============================================================
// Pattern: check-then-insert with findOne (NOT recommended for concurrent systems)
// ============================================================
// async function registerSafe(email) {
//   const existing = await User.findOne({ email }).lean();
//   if (existing) throw new Error('Email taken');
//   return User.create({ email });
//   // RACE CONDITION: two requests can both pass findOne and both try to insert!
//   // Handle 11000 instead of relying on check-then-insert
// }

// ============================================================
// Global error handler: map 11000 to 409 automatically
// ============================================================
app.use((err, req, res, next) => {
  if (err.code === 11000) {
    const field = getDuplicateField(err);
    return res.status(409).json({ error: `${field} is already in use` });
  }
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ error: err.message || 'Internal Server Error' });
});
```

### Step-by-Step Explanation

1. **Error code 11000**: MongoDB's specific error code for duplicate key violations on unique indexes. Check `err.code === 11000`.
2. **`err.keyPattern`**: tells you which index was violated — `{ email: 1 }` means the `email` field's unique index. Use `Object.keys(err.keyPattern)[0]` to get the field name.
3. **`err.keyValue`**: the actual duplicate value — `{ email: 'alice@example.com' }`. Be careful not to echo sensitive values back to the client.
4. **Race condition**: checking for existence with `findOne` before `create` is not safe under concurrent load — two requests can both pass the check and both attempt the insert. Always handle 11000 even if you "checked first".
5. **409 Conflict**: the correct HTTP status for "the resource you're trying to create already exists". 400 (Bad Request) is also acceptable but less semantically precise.
6. **Upsert pattern**: `findOneAndUpdate({ ... }, updateData, { upsert: true })` avoids the duplicate error entirely by treating "insert or update" as a single atomic operation — but you may still get 11000 from extremely rare concurrent upserts.
7. **Global error handler**: mapping 11000 centrally in the error handler means you don't need to repeat the `if (err.code === 11000)` check in every route.

### Complexity

| | Details |
|--|--|
| Unique index check | O(log n) — index lookup |
| 11000 detection | O(1) — check err.code |
| Race condition risk | Always present — handle 11000, don't rely on pre-check |
| findOneAndUpdate upsert | Atomic — safe under concurrency |

---

## Q78: What are Mongoose virtuals? When would you use them instead of storing computed data?

### ELI5

A virtual is a field that doesn't exist in the database but can be computed on the fly from other fields. Think of a `fullName` that combines `firstName` and `lastName` — you don't need to store `fullName` in MongoDB because you can always compute it. But if computing it was expensive (like aggregating all orders to get a user's total spend), you might store it instead. Virtuals are free computed properties: no storage cost, always up to date, but not queryable.

### Visual Diagram

```
Stored in MongoDB:
  { firstName: 'John', lastName: 'Smith', birthDate: ISODate('1990-05-15') }

Mongoose virtual 'fullName':
  Not in DB  -->  computed: firstName + ' ' + lastName  -->  'John Smith'

Mongoose virtual 'age':
  Not in DB  -->  computed: Math.floor((now - birthDate) / MS_PER_YEAR)  -->  35

Can you: db.users.find({ fullName: 'John Smith' }) ?
  NO -- virtuals are NOT stored, NOT indexed --> cannot filter by them

Can you: user.fullName = 'Alice Jones' ?
  YES -- if you define a setter virtual that updates firstName and lastName

--- Stored computed field (alternative) ---
  { firstName, lastName, fullName: 'John Smith' }
  Queryable: YES (can index fullName)
  Always consistent: ONLY if you update fullName on every firstName/lastName change
```

### Code Example

```javascript
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  birthDate: Date,
  email: String,
  orderCount: { type: Number, default: 0 }, // stored count (updated by service layer)
  totalSpent: { type: Number, default: 0 },
}, {
  // By default, virtuals are NOT included in JSON output
  // This makes them appear in res.json() automatically
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ============================================================
// Getter virtual — fullName
// ============================================================
userSchema.virtual('fullName').get(function () {
  // 'this' = the document
  return `${this.firstName} ${this.lastName}`;
});

// ============================================================
// Getter + Setter virtual — allows setting full name
// ============================================================
userSchema.virtual('fullNameRW')
  .get(function () {
    return `${this.firstName} ${this.lastName}`;
  })
  .set(function (name) {
    const [first, ...rest] = name.split(' ');
    this.firstName = first;
    this.lastName = rest.join(' ');
  });

// ============================================================
// Computed age virtual — always current
// ============================================================
userSchema.virtual('age').get(function () {
  if (!this.birthDate) return null;
  const ms = Date.now() - this.birthDate.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 365.25));
});

// ============================================================
// Average order value — computed from STORED fields
// ============================================================
userSchema.virtual('avgOrderValue').get(function () {
  if (this.orderCount === 0) return 0;
  return Math.round((this.totalSpent / this.orderCount) * 100) / 100;
});

// ============================================================
// Populate virtual — virtual that populates a relationship
// Replaces a manual $lookup for common read patterns
// ============================================================
userSchema.virtual('orders', {
  ref: 'Order',          // which model to populate from
  localField: '_id',     // user's _id
  foreignField: 'userId', // order's userId field
  justOne: false,         // expect an array
  options: { sort: { createdAt: -1 }, limit: 10 }, // recent 10 orders
});

const User = mongoose.model('User', userSchema);

// Usage:
const user = await User.findById(id);
console.log(user.fullName);    // 'John Smith' — no DB query
console.log(user.age);         // 35 — computed from DB birthDate
console.log(user.avgOrderValue); // 45.50 — from stored counts

// Populate virtual orders:
const userWithOrders = await User.findById(id).populate('orders');
console.log(userWithOrders.orders); // actual Order documents

// Virtual is NOT included in .lean() by default
// Use lean({ virtuals: true }) with mongoose-lean-virtuals plugin:
const leanUser = await User.findById(id).lean({ virtuals: true });
console.log(leanUser.fullName); // works with plugin
```

### Step-by-Step Explanation

1. **Virtuals are not stored**: they consume no storage, are always consistent (computed fresh each access), but cannot be queried, filtered, or indexed.
2. **When to use virtuals**: presentation-only computed fields (`fullName`, `age`), fields that depend on other fields and have no query need, format transformations (e.g., currency display).
3. **When to store computed data instead**: you need to query/sort/filter by the computed value (e.g., `ORDER BY fullName`); the computation is expensive (e.g., total revenue = sum of thousands of orders); you need to index it.
4. **`toJSON: { virtuals: true }`**: without this, virtuals are excluded from `JSON.stringify()` and Mongoose's `.toJSON()`. Add to schema options so they appear in `res.json()` responses automatically.
5. **Setter virtuals**: can update multiple real fields when you set a virtual. Useful for accepting input in a combined format while storing it in separate fields.
6. **Populate virtuals**: define a virtual that acts as a one-to-many relationship — `user.populate('orders')` fetches related Order documents without embedding them. Same result as `$lookup` but defined once in the schema.
7. **`.lean()` caveat**: lean objects are POJOs — virtuals don't evaluate. Use the `mongoose-lean-virtuals` plugin and `.lean({ virtuals: true })` if you need both.

### Complexity

| | Virtual | Stored computed |
|--|---|---|
| Storage | None | Actual space |
| Always consistent | Yes (computed fresh) | Only if updated on changes |
| Queryable/Indexable | No | Yes |
| Cost to read | O(1) computation | O(1) DB read |
| Use case | Display fields | Query/sort targets |

---

## Q79: How do you optimize a slow MongoDB query using `explain()`?

### ELI5

`explain()` is like asking the database "show me your work". Instead of giving you the results, it tells you HOW it found the results: did it scan every document (slow) or use an index (fast)? Did it sort 50,000 records in memory? Did it examine 100,000 documents to return 5? `explain()` is your diagnostic tool — once you see what MongoDB is doing, you know what index to add or query to rewrite.

### Visual Diagram

```
db.orders.find({ userId: 'u1', status: 'completed' }).explain('executionStats')

Result interpretation:

SLOW query (no useful index):
  winningPlan.stage:         "COLLSCAN"     <-- RED FLAG: full collection scan
  totalDocsExamined:         100000         <-- scanned all docs
  totalDocsReturned:         3              <-- returned 3
  executionTimeMillis:       450            <-- 450ms -- too slow

FAST query (with index):
  winningPlan.stage:         "FETCH"
  winningPlan.inputStage.stage: "IXSCAN"   <-- used index
  totalDocsExamined:         3              <-- only 3 docs examined
  totalDocsReturned:         3              <-- perfect selectivity
  executionTimeMillis:       2              <-- 2ms -- good

COVERED query (index only):
  winningPlan.stage:         "PROJECTION_COVERED"
  winningPlan.inputStage.stage: "IXSCAN"
  totalDocsExamined:         0              <-- zero document reads!
  executionTimeMillis:       0              <-- sub-millisecond
```

### Code Example

```javascript
// ============================================================
// Step 1: identify a slow query via explain()
// ============================================================
// In mongosh:
// db.orders.find({ userId: ObjectId('...'), status: 'completed' })
//          .sort({ createdAt: -1 })
//          .explain('executionStats')
//
// Key metrics to check:
//   winningPlan.stage          -> COLLSCAN = bad, IXSCAN = good
//   totalDocsExamined          -> should be close to totalDocsReturned
//   executionTimeMillis        -> target < 100ms for most queries
//   indexesUsed                -> which indexes were considered / chosen
//   rejectedPlans              -> other indexes MongoDB considered but didn't use

// ============================================================
// Step 2: add the right index based on query pattern (ESR rule)
// ============================================================
const orderSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  status: String,
  total: Number,
  createdAt: { type: Date, default: Date.now },
});

// Query: { userId, status } sort by createdAt
// ESR: E=userId, E=status, S=createdAt
orderSchema.index({ userId: 1, status: 1, createdAt: -1 });

// ============================================================
// Step 3: re-run explain to verify improvement
// ============================================================
// After adding index, explain should show:
//   stage: "IXSCAN"
//   totalDocsExamined ~= totalDocsReturned

// ============================================================
// In application code: run explain and log slow queries
// ============================================================
async function explainQuery(model, filter, sort = {}, projection = {}) {
  const explanation = await model
    .find(filter, projection)
    .sort(sort)
    .explain('executionStats');

  const stats = explanation.executionStats;
  const planStage = explanation.queryPlanner.winningPlan.stage;

  console.log({
    collectionScan: planStage === 'COLLSCAN',
    docsExamined: stats.totalDocsExamined,
    docsReturned: stats.totalDocsReturned,
    timeMs: stats.executionTimeMillis,
    selectivity: stats.totalDocsReturned / Math.max(stats.totalDocsExamined, 1),
  });

  if (stats.totalDocsExamined > stats.totalDocsReturned * 10) {
    console.warn('Low selectivity — consider adding an index');
  }
}

// ============================================================
// Common fixes for slow queries
// ============================================================

// Fix 1: Add missing index
// If COLLSCAN: orderSchema.index({ status: 1 })

// Fix 2: Add projection to avoid fetching large fields
const orders = await Order
  .find({ userId, status: 'completed' })
  .select('total createdAt status -passwordHash') // exclude large/sensitive fields
  .lean();

// Fix 3: Limit results
const recentOrders = await Order
  .find({ userId })
  .sort({ createdAt: -1 })
  .limit(20)                  // always limit in application queries
  .lean();

// Fix 4: Use .lean() for read-only queries
const ordersLean = await Order.find({ status: 'completed' }).lean(); // 2-5x faster

// Fix 5: Replace skip() with cursor-based pagination for deep pages
// See Q70

// Fix 6: Move filter before $lookup in aggregation
const pipeline = [
  { $match: { status: 'completed' } }, // filter BEFORE expensive $lookup
  { $lookup: { from: 'users', ... } },
];
```

### Step-by-Step Explanation

1. **`explain('executionStats')`**: returns the query execution plan with full statistics. Three verbosity levels: `'queryPlanner'` (plan only), `'executionStats'` (plan + stats for winning plan), `'allPlansExecution'` (stats for all candidate plans).
2. **`COLLSCAN`**: collection scan — MongoDB reads every document. The worst case; add an index.
3. **`IXSCAN`**: index scan — MongoDB walks the index B-tree. Much faster.
4. **`FETCH`**: after an index scan, MongoDB fetches the full documents. If projection removes the need for document fetches, you get `PROJECTION_COVERED` (covered query).
5. **Selectivity ratio**: `totalDocsReturned / totalDocsExamined`. Ratio close to 1 = good (index is selective). Ratio close to 0 = index isn't helping much (low cardinality field like `status` with few values).
6. **In-memory sort `SORT` stage**: appears when MongoDB can't use an index for the sort. Add the sort field to your compound index.
7. **Rejected plans**: MongoDB's query planner evaluates multiple indexes and picks the winning plan. If a better index exists but isn't chosen, hint with `.hint()`.
8. **Monitoring in production**: use MongoDB Atlas Performance Advisor or profiler (`db.setProfilingLevel(1, 100)`) to log queries slower than 100ms automatically.

### Complexity

| Issue | Symptom in explain | Fix |
|-------|-------------------|-----|
| No index | stage: COLLSCAN | Add compound index |
| Wrong index order | High docsExamined vs returned | Reorder index per ESR rule |
| In-memory sort | stage: SORT | Add sort field to index |
| Deep skip pagination | High docsExamined | Use cursor-based pagination |
| Full doc fetch for projection | stage: FETCH | Create covering index |

---

## Q80: What is the Bucket Pattern in MongoDB schema design?

### ELI5

Imagine you're recording every temperature reading from a sensor — one reading every second, 86,400 readings per day. If you store each reading as a separate document, you'd have millions of tiny documents. The Bucket Pattern bundles readings into groups (buckets) — like storing an entire day's readings in one document. This dramatically reduces the number of documents, speeds up queries for time-range analysis, and reduces index overhead.

### Visual Diagram

```
WITHOUT Bucket Pattern (one document per sensor reading):
  { sensorId: 's1', timestamp: ISODate("...T00:00:01"), temp: 22.1 }
  { sensorId: 's1', timestamp: ISODate("...T00:00:02"), temp: 22.2 }
  { sensorId: 's1', timestamp: ISODate("...T00:00:03"), temp: 22.1 }
  ... 86,400 documents per sensor per day
  10 sensors * 365 days = 3,650,000 documents/year/sensor -- huge index overhead

WITH Bucket Pattern (one document per hour per sensor):
  {
    sensorId: 's1',
    date: ISODate("2026-03-21"),
    hour: 10,
    count: 3600,
    measurements: [22.1, 22.2, 22.1, ...]  // 3600 readings in one array
    stats: { min: 21.0, max: 24.5, sum: 79920 } // pre-aggregated
  }
  10 sensors * 365 days * 24 hours = 87,600 documents/year -- 97% fewer docs
```

### Code Example

```javascript
const mongoose = require('mongoose');

// ============================================================
// Bucket schema: one document per sensor per hour
// ============================================================
const sensorBucketSchema = new mongoose.Schema({
  sensorId: { type: String, required: true },
  bucketDate: { type: Date, required: true },  // start of the hour: 2026-03-21T10:00:00Z
  count: { type: Number, default: 0 },          // readings in this bucket

  // Array of raw readings (up to 3600 per hourly bucket)
  readings: [{
    timestamp: Date,
    value: Number,
    unit: String,
  }],

  // Pre-aggregated stats for fast range queries (no array scan needed)
  stats: {
    min: Number,
    max: Number,
    sum: Number,
    avg: Number,
  },
});

// Index on (sensorId, bucketDate) for time-range queries
sensorBucketSchema.index({ sensorId: 1, bucketDate: 1 });

const SensorBucket = mongoose.model('SensorBucket', sensorBucketSchema);

// ============================================================
// Add a new reading to the correct bucket (upsert pattern)
// ============================================================
async function addReading(sensorId, value, unit, timestamp = new Date()) {
  // Round down to the start of the current hour
  const bucketDate = new Date(timestamp);
  bucketDate.setMinutes(0, 0, 0); // zero out minutes, seconds, milliseconds

  const reading = { timestamp, value, unit };

  // $push adds the reading; $inc increments count; $set updates min/max atomically
  await SensorBucket.findOneAndUpdate(
    { sensorId, bucketDate },    // find the correct hourly bucket
    {
      $push: { readings: reading },
      $inc: {
        count: 1,
        'stats.sum': value,
      },
      $min: { 'stats.min': value },   // $min only updates if value is less than current
      $max: { 'stats.max': value },   // $max only updates if value is greater than current
    },
    {
      upsert: true,  // create the bucket document if it doesn't exist
      new: true,
    }
  );
}

// ============================================================
// Query: average temperature for a sensor over a time range
// (read from pre-aggregated stats — no array unwinding needed)
// ============================================================
async function getAverageTemp(sensorId, startDate, endDate) {
  const buckets = await SensorBucket.aggregate([
    {
      $match: {
        sensorId,
        bucketDate: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalSum: { $sum: '$stats.sum' },
        totalCount: { $sum: '$count' },
        overallMin: { $min: '$stats.min' },
        overallMax: { $max: '$stats.max' },
      },
    },
    {
      $project: {
        _id: 0,
        average: { $divide: ['$totalSum', '$totalCount'] },
        min: '$overallMin',
        max: '$overallMax',
        readingCount: '$totalCount',
      },
    },
  ]);

  return buckets[0] || null;
}

// ============================================================
// Query: last 10 readings (must unwind the array — but only one bucket)
// ============================================================
async function getLatestReadings(sensorId, n = 10) {
  const buckets = await SensorBucket.aggregate([
    { $match: { sensorId } },
    { $sort: { bucketDate: -1 } },
    { $limit: 1 },                  // only the most recent bucket
    { $unwind: '$readings' },
    { $sort: { 'readings.timestamp': -1 } },
    { $limit: n },
    { $replaceRoot: { newRoot: '$readings' } }, // promote readings to top level
  ]);

  return buckets;
}
```

### Step-by-Step Explanation

1. **Problem**: time-series data (IoT sensors, click events, metrics) produces one document per event — millions of tiny documents with massive index overhead.
2. **Bucket solution**: group events into time-window documents (per minute, per hour, per day depending on volume). Each bucket document contains an array of readings plus pre-aggregated stats.
3. **Pre-aggregation**: store `min`, `max`, `sum`, `count` in the bucket alongside the raw readings. Time-range analytics (average temperature last week) can then be answered by aggregating bucket stats without unwinding the readings arrays.
4. **Upsert pattern**: `findOneAndUpdate` with `{ upsert: true }` creates the bucket if it doesn't exist, or updates it if it already does — one atomic operation per incoming reading.
5. **`$min`/`$max` atomic operators**: MongoDB's `$min` update operator only writes if the new value is smaller than the current stored value — perfect for maintaining running minimums without a read-then-write.
6. **Document size limit**: MongoDB documents have a 16MB limit. With 3,600 readings per bucket at ~50 bytes each = ~180KB per bucket. Safe. Plan bucket size to stay well under 16MB.
7. **Use case spectrum**: IoT sensors, application metrics, click tracking, financial tick data, audit logs with time-windowed queries.
8. **MongoDB Time Series Collections**: MongoDB 5.0+ has native time series collection support (`timeseries` option on `createCollection`) which implements the Bucket Pattern internally and provides optimized storage and queries automatically.

### Complexity

| | One doc per event | Bucket Pattern |
|--|---|---|
| Documents for 1 sensor, 1 year, 1/s | 31,536,000 | 8,760 (hourly) |
| Index size | Large (one entry per doc) | 97%+ smaller |
| Time-range query | Scan millions of docs | Scan hundreds of buckets |
| Write cost | Single doc insert | Array push + stat update |
| Read individual readings | O(1) | O(array_position) |

--- End of Section 9 ---

---

# Section 10: GRAPHQL (Q81-Q92)

---

## Q81: What is the difference between schema-first and code-first GraphQL? Which do you prefer?

### ELI5

In schema-first GraphQL, you write the API contract (the schema) as a text file first — like writing the menu before you cook the food. In code-first, you write the resolver functions first and the schema is automatically generated from your code. Schema-first keeps the contract explicit and readable; code-first keeps everything in one language and avoids duplication.

### Visual Diagram

```
--- SCHEMA-FIRST ---
  1. Write schema.graphql (the contract):
       type User { id: ID!, name: String!, email: String! }
       type Query { user(id: ID!): User }

  2. Write resolvers to implement it:
       Query.user = (_, { id }) => db.users.findById(id)

  3. GraphQL validates: does your resolver match the schema? YES/NO

--- CODE-FIRST ---
  1. Write resolver/decorator code:
       @ObjectType() class User { @Field() name: string }
       @Query() user(@Arg('id') id: string): User { ... }

  2. Framework (TypeGraphQL, Nexus) auto-generates schema:
       type User { name: String! }
       type Query { user(id: String!): User }

--- TRADE-OFFS ---
  Schema-first:
    + Human-readable contract in .graphql file
    + Easy to share with frontend team before implementation
    + GraphQL schema is the source of truth
    - Resolver type safety requires codegen (graphql-codegen)
    - Easy to have schema/resolver drift (resolve bugs at runtime)

  Code-first (TypeGraphQL/Nexus):
    + Full TypeScript type safety — schema matches types always
    + No separate .graphql file to maintain
    + Decorators co-locate schema + resolver in one class
    - Schema only readable from generated file (less human-friendly)
    - Framework-specific decorators create lock-in
```

### Code Example

```javascript
// ============================================================
// SCHEMA-FIRST: define .graphql then write resolvers
// ============================================================

// schema.graphql
const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
    orders: [Order!]!
  }

  type Order {
    id: ID!
    total: Float!
    status: String!
  }

  type Query {
    user(id: ID!): User
    users(limit: Int = 10): [User!]!
  }

  type Mutation {
    createUser(input: CreateUserInput!): User!
  }

  input CreateUserInput {
    name: String!
    email: String!
    password: String!
  }
`;

// resolvers.js
const resolvers = {
  Query: {
    user: async (_, { id }, { dataSources }) =>
      dataSources.userAPI.findById(id),
    users: async (_, { limit }, { dataSources }) =>
      dataSources.userAPI.findAll(limit),
  },
  User: {
    orders: async (parent, _, { dataSources }) =>
      dataSources.orderAPI.findByUserId(parent.id), // field resolver
  },
  Mutation: {
    createUser: async (_, { input }, { dataSources }) =>
      dataSources.userAPI.create(input),
  },
};

// Apollo Server setup
const { ApolloServer } = require('@apollo/server');
const server = new ApolloServer({ typeDefs, resolvers });

// ============================================================
// CODE-FIRST: TypeGraphQL (TypeScript decorators)
// ============================================================
// -------------------------------------------------------------------
// types/User.ts
// -------------------------------------------------------------------
import { ObjectType, Field, ID } from 'type-graphql';

@ObjectType()
class User {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;
}

// -------------------------------------------------------------------
// resolvers/UserResolver.ts
// -------------------------------------------------------------------
import { Resolver, Query, Mutation, Arg, Ctx } from 'type-graphql';

@Resolver(User)
class UserResolver {
  @Query(() => User, { nullable: true })
  async user(@Arg('id') id: string, @Ctx() ctx: AppContext): Promise<User | null> {
    return ctx.dataSources.userAPI.findById(id);
  }

  @Mutation(() => User)
  async createUser(
    @Arg('input') input: CreateUserInput,
    @Ctx() ctx: AppContext
  ): Promise<User> {
    return ctx.dataSources.userAPI.create(input);
  }
}
// TypeGraphQL generates the schema from these classes automatically
```

### Step-by-Step Explanation

1. **Schema-first**: write `type Query { ... }` in a `.graphql` file. Resolvers are separate — they must manually match the schema. Type-safe with `graphql-codegen`.
2. **Code-first**: use TypeGraphQL (decorators), Nexus, or Pothos to write resolver classes in TypeScript. The `.graphql` schema is auto-generated.
3. **Schema drift risk**: in schema-first, if you change the schema but forget to update the resolver, you get a runtime error (resolver returns wrong shape). Code-first catches this at compile time via TypeScript.
4. **Team workflow**: schema-first is better when frontend and backend teams work in parallel — agree the schema first, then implement independently. Code-first is better for solo devs or backend-focused teams.
5. **`graphql-codegen`**: for schema-first, this tool reads your `.graphql` schema and generates TypeScript types for your resolvers — bridging the gap and giving type safety.
6. **Preference**: for TypeScript projects with a team, code-first (TypeGraphQL) because the schema is always consistent with the implementation. For API-first design with multiple consumers, schema-first because the contract is the explicit source of truth.

### Complexity

| | Schema-first | Code-first |
|--|---|---|
| Source of truth | .graphql SDL file | TypeScript classes/decorators |
| Type safety | With codegen | Native TypeScript |
| Team workflow | Contract-first collab | Single-lang simplicity |
| Learning curve | Lower | Higher (decorators, framework) |

---

## Q82: What is the N+1 problem in GraphQL? How does DataLoader solve it?

### ELI5

Imagine you have 10 blog posts and you want to show each post's author name. The N+1 problem is when your code makes one database query to get the 10 posts, then makes 10 MORE queries (one per post) to get each author. That's 1 + 10 = 11 queries. DataLoader is a batching tool that says "wait, let me collect all the author IDs from all 10 posts, then make ONE query asking for all 10 authors at once".

### Visual Diagram

```
GraphQL query: { posts { title author { name } } }

WITHOUT DataLoader (N+1 problem):
  Query 1: SELECT * FROM posts          --> returns 10 posts, each with authorId
  Query 2: SELECT * FROM users WHERE id = '1'
  Query 3: SELECT * FROM users WHERE id = '2'
  Query 4: SELECT * FROM users WHERE id = '1'  (DUPLICATE! same author as post 2)
  ...
  Query 11: SELECT * FROM users WHERE id = '8'
  Total: 11 queries (1 + N where N=10), with duplicates

WITH DataLoader (batching + caching):
  Query 1: SELECT * FROM posts          --> returns 10 posts, authorIds: [1,2,1,3,2,1,...]
  DataLoader collects: unique IDs = [1, 2, 3]
  Query 2: SELECT * FROM users WHERE id IN (1, 2, 3)  --> ONE batched query
  Total: 2 queries, no duplicates

Caching: within the same request, authorId='1' is loaded once.
  Post #1, Post #3, Post #6 all have authorId='1' -> resolved from cache, not re-queried
```

### Code Example

```javascript
const DataLoader = require('dataloader');
const { ApolloServer } = require('@apollo/server');

// ============================================================
// DataLoader: batch function receives array of keys
// MUST return array of values in same order as keys
// ============================================================
function createUserLoader(db) {
  return new DataLoader(async (userIds) => {
    // userIds = ['1', '3', '7'] -- all unique IDs collected in one tick
    const users = await db.collection('users')
      .find({ _id: { $in: userIds.map(id => new ObjectId(id)) } })
      .toArray();

    // Create a map for O(1) lookup
    const userMap = Object.fromEntries(
      users.map(u => [u._id.toString(), u])
    );

    // CRITICAL: return values in the SAME ORDER as userIds
    // DataLoader matches responses to requests by position
    return userIds.map(id => userMap[id] || new Error(`User ${id} not found`));
  });
}

// ============================================================
// *** Create DataLoader PER REQUEST (in context factory) ***
// DataLoader caches per-request only — NEVER share between requests
// Sharing across requests = stale/cross-contaminated data
// ============================================================
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => ({
    db,
    // New DataLoader instances per request = fresh cache per request
    loaders: {
      user: createUserLoader(db),
      product: createProductLoader(db),
    },
  }),
});

// ============================================================
// Resolvers using DataLoader
// ============================================================
const resolvers = {
  Query: {
    posts: async (_, __, { db }) =>
      db.collection('posts').find().toArray(),
  },
  Post: {
    // This resolver runs once per Post document in the result
    // DataLoader batches all these individual loads into one DB query
    author: async (post, _, { loaders }) =>
      loaders.user.load(post.authorId.toString()), // .load() schedules a batch
  },
  Comment: {
    author: async (comment, _, { loaders }) =>
      loaders.user.load(comment.userId.toString()), // same loader, shared cache
  },
};

// ============================================================
// DataLoader with Mongoose
// ============================================================
function createUserLoader() {
  return new DataLoader(
    async (ids) => {
      const users = await User.find({ _id: { $in: ids } }).lean();
      const map = new Map(users.map(u => [u._id.toString(), u]));
      return ids.map(id => map.get(id.toString()) ?? null);
    },
    {
      // options:
      cache: true,           // default: cache within request lifespan
      maxBatchSize: 1000,    // maximum IDs per batch query
    }
  );
}
```

### Step-by-Step Explanation

1. **N+1 root cause**: GraphQL field resolvers run independently — resolver for `Post.author` runs once per post. Without batching, each invocation fires a separate DB query.
2. **DataLoader mechanism**: DataLoader uses JavaScript's event loop tick timing. All `.load(id)` calls within a single tick are collected, then the `batchFn` is called ONCE with all collected IDs after the tick completes.
3. **Batch function contract**: receives an array of keys, MUST return an array of the same length in the same order. Mismatched order = wrong data assigned to wrong requests.
4. **Per-request instantiation**: CRITICAL — DataLoader caches results for the lifespan of the instance. If you share a DataLoader across requests, User A might receive User B's cached data. Create a new DataLoader instance per HTTP request inside the context factory.
5. **Deduplication**: DataLoader automatically deduplicates keys within a batch — if 5 posts share the same `authorId`, the batch function receives that ID only once.
6. **Caching**: within the same request, `.load('userId123')` called multiple times returns the same promise and the same cached result — no duplicate DB queries even if the same resolver fires many times.
7. **Error handling**: if an ID is not found in the batch, return `new Error('not found')` at that index. DataLoader rejects the individual `.load()` promise rather than the entire batch.

### Complexity

| | Without DataLoader | With DataLoader |
|--|---|---|
| DB queries for 10 posts | 1 + 10 = 11 | 2 (posts + batched users) |
| Duplicate ID handling | Re-queries | Deduplicates + caches |
| Per-request isolation | N/A | Must create per-request |
| Batch size | N/A | Configurable, default 1000 |

---

## Q83: How do you write a GraphQL mutation with an input type? Include validation.

### ELI5

A mutation is GraphQL's way of making changes — creating, updating, or deleting data. An input type is like a reusable form object you can pass as a single argument. Instead of listing 10 separate arguments, you group them into `input CreateUserInput { name, email, password }` and pass the whole form as one thing. Validation runs inside the resolver before you touch the database.

### Visual Diagram

```
Client sends:
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      name
      email
    }
  }
  variables: { input: { name: "Alice", email: "alice@x.com", password: "secret" } }

Schema processes:
  1. Parse & validate input against schema types (name: String!, email: String!)
  2. Call resolver: createUser(_, { input }, context)
  3. Resolver validates business rules (email format, password strength)
  4. Resolver interacts with DB
  5. Return User shape

Error paths:
  Schema validation fail  --> errors in { errors: [...] } array with code GRAPHQL_PARSE_FAILED
  Business logic fail     --> throw new GraphQLError('...', { extensions: { code: '...' } })
  DB error                --> wrapped and returned in errors array
```

### Code Example

```javascript
// ============================================================
// Schema definition (SDL)
// ============================================================
const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
    role: UserRole!
    createdAt: String!
  }

  enum UserRole {
    USER
    ADMIN
    MODERATOR
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input CreateUserInput {
    name: String!
    email: String!
    password: String!
    role: UserRole = USER
  }

  input UpdateUserInput {
    name: String
    email: String
  }

  type Mutation {
    createUser(input: CreateUserInput!): AuthPayload!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    deleteUser(id: ID!): Boolean!
  }
`;

// ============================================================
// Resolvers with validation
// ============================================================
const { GraphQLError } = require('graphql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const validator = require('validator');

const resolvers = {
  Mutation: {
    createUser: async (_, { input }, { db }) => {
      const { name, email, password, role = 'USER' } = input;

      // Step 1: Business validation
      if (!validator.isEmail(email)) {
        throw new GraphQLError('Invalid email format', {
          extensions: { code: 'BAD_USER_INPUT', field: 'email' },
        });
      }
      if (password.length < 8) {
        throw new GraphQLError('Password must be at least 8 characters', {
          extensions: { code: 'BAD_USER_INPUT', field: 'password' },
        });
      }

      // Step 2: Check uniqueness
      const existing = await db.collection('users').findOne({ email });
      if (existing) {
        throw new GraphQLError('Email already in use', {
          extensions: { code: 'CONFLICT', field: 'email' },
        });
      }

      // Step 3: Create user
      const passwordHash = await bcrypt.hash(password, 12);
      const result = await db.collection('users').insertOne({
        name,
        email,
        passwordHash,
        role,
        createdAt: new Date(),
      });

      const user = { id: result.insertedId.toString(), name, email, role, createdAt: new Date().toISOString() };

      // Step 4: Return auth payload with token
      const token = jwt.sign(
        { sub: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      return { token, user };
    },

    updateUser: async (_, { id, input }, { db, userId }) => {
      // Authorization check — only the user themselves or an admin
      if (userId !== id) {
        throw new GraphQLError('Not authorised', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const updates = {};
      if (input.name) updates.name = input.name.trim();
      if (input.email) {
        if (!validator.isEmail(input.email)) {
          throw new GraphQLError('Invalid email', { extensions: { code: 'BAD_USER_INPUT' } });
        }
        updates.email = input.email.toLowerCase();
      }

      const user = await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updates },
        { returnDocument: 'after' }
      );

      if (!user) throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
      return { ...user, id: user._id.toString() };
    },
  },
};
```

### Step-by-Step Explanation

1. **`input` types**: dedicated input type objects for mutations — cannot contain circular references or use `type` (output type) directly. Keeps mutation arguments clean and reusable.
2. **`!` (non-null)**: `CreateUserInput!` means the argument is required. `name: String!` inside the input means name is required within the input. GraphQL itself enforces this before the resolver runs.
3. **`GraphQLError`**: the standard error class for GraphQL. Throw it inside resolvers to return structured errors in the `errors` array. Use `extensions` for machine-readable codes.
4. **Validation order**: schema validation (types, required fields) → business validation inside resolver (email format, password strength) → DB operation.
5. **Error codes**: use standard codes: `BAD_USER_INPUT` (client error), `FORBIDDEN` (authorization), `NOT_FOUND`, `CONFLICT` (duplicate), `INTERNAL_SERVER_ERROR` (unexpected).
6. **Input type reuse**: `UpdateUserInput` uses optional fields (no `!`) — only provided fields are updated. This is the "partial update" pattern for mutations.
7. **Never expose `passwordHash`**: the `User` type in the schema literally doesn't have a `passwordHash` field — GraphQL only returns what's in the schema, providing a natural data filtering layer.

### Complexity

| Step | Responsibility |
|------|---------------|
| Schema validation | GraphQL runtime (type, required check) |
| Business validation | Resolver code (format, range, uniqueness) |
| Auth check | Resolver code (check context.userId) |
| DB operation | DataSource / Repository |
| Error format | GraphQLError with extensions |

---

## Q84: How do GraphQL subscriptions work? Give a real-time use case.

### ELI5

Queries and mutations are like sending a letter and getting a reply. Subscriptions are like subscribing to a magazine — you sign up once and the publisher keeps sending you new issues whenever something happens. GraphQL subscriptions use WebSockets to maintain an open connection between client and server: when an event occurs on the server (a new message is sent), it pushes an update directly to all subscribed clients without them needing to ask.

### Visual Diagram

```
Client connects via WebSocket to subscription endpoint:
  ws://api.example.com/graphql

Client sends:
  subscription {
    messageSent(chatRoomId: "room1") {
      id content sender { name }
    }
  }

Server: "OK, I'll call you when there's a new message in room1"

...time passes...

User B sends a message via mutation:
  mutation { sendMessage(roomId: "room1", content: "Hello!") { id } }

Server: mutation resolver calls pubsub.publish("MESSAGE_SENT", { roomId: "room1", message: {...} })

PubSub broadcasts to subscribers:
  All clients subscribed to "room1" receive:
  {
    "data": {
      "messageSent": { "id": "...", "content": "Hello!", "sender": { "name": "User B" } }
    }
  }

Architecture:
  Single server:   In-memory PubSub (graphql-subscriptions)
  Multiple servers: Redis PubSub (graphql-redis-subscriptions) -- use Pub/Sub across instances
```

### Code Example

```javascript
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');
const { PubSub, withFilter } = require('graphql-subscriptions');

const pubsub = new PubSub(); // in-memory; use graphql-redis-subscriptions for multi-instance

// ============================================================
// Schema
// ============================================================
const typeDefs = `#graphql
  type Message {
    id: ID!
    content: String!
    sender: User!
    roomId: String!
    createdAt: String!
  }

  type Query {
    messages(roomId: String!, limit: Int = 50): [Message!]!
  }

  type Mutation {
    sendMessage(roomId: String!, content: String!): Message!
  }

  type Subscription {
    messageSent(roomId: String!): Message!
    userTyping(roomId: String!): String!  # returns username of typing user
  }
`;

// ============================================================
// Resolvers
// ============================================================
const MESSAGE_SENT = 'MESSAGE_SENT';
const USER_TYPING = 'USER_TYPING';

const resolvers = {
  Mutation: {
    sendMessage: async (_, { roomId, content }, { userId, db }) => {
      const message = await db.collection('messages').insertOne({
        content,
        senderId: userId,
        roomId,
        createdAt: new Date(),
      });

      const fullMessage = {
        id: message.insertedId.toString(),
        content,
        senderId: userId,
        roomId,
        createdAt: new Date().toISOString(),
      };

      // Publish event to PubSub — all subscribers listening for MESSAGE_SENT receive this
      await pubsub.publish(MESSAGE_SENT, { messageSent: fullMessage, roomId });

      return fullMessage;
    },
  },

  Subscription: {
    messageSent: {
      // subscribe: returns an async iterator — the WebSocket feeds from this
      subscribe: withFilter(
        () => pubsub.asyncIterator([MESSAGE_SENT]),
        // Filter: only deliver to clients subscribed to THIS specific roomId
        (payload, variables) => payload.roomId === variables.roomId
      ),
    },

    userTyping: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([USER_TYPING]),
        (payload, variables) => payload.roomId === variables.roomId
      ),
    },
  },

  // Field resolvers still work for subscription payloads
  Message: {
    sender: async (message, _, { loaders }) =>
      loaders.user.load(message.senderId),
  },
};

// ============================================================
// WebSocket server setup (graphql-ws)
// ============================================================
const schema = makeExecutableSchema({ typeDefs, resolvers });
const httpServer = require('http').createServer(app);

const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });

// graphql-ws handles protocol, connection, auth, cleanup
const serverCleanup = useServer(
  {
    schema,
    // Subscription context — authenticate WebSocket connections here
    context: async (ctx) => {
      const token = ctx.connectionParams?.authorization;
      if (!token) throw new Error('Unauthorized');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return { userId: decoded.sub, loaders: { user: createUserLoader(db) } };
    },
  },
  wsServer
);
```

### Step-by-Step Explanation

1. **WebSocket transport**: GraphQL subscriptions require a persistent connection. HTTP is not suitable — use WebSocket (`graphql-ws` library with WebSocketServer).
2. **PubSub**: the message broker between your mutation (publisher) and subscription resolvers (subscribers). In-memory PubSub works for a single server instance; use Redis PubSub for horizontally scaled servers.
3. **`asyncIterator`**: subscription `subscribe` function returns an async iterator — GraphQL-WS pulls from this iterator and pushes each value to connected clients.
4. **`withFilter`**: crucial filter wrapper — without it, ALL subscribers to `MESSAGE_SENT` get ALL messages regardless of their room. `withFilter` runs the filter function to deliver events only to matching subscribers.
5. **Authentication**: authenticate in the `context` function of `useServer` using the `connectionParams` — clients send their auth token in connection params on WebSocket upgrade.
6. **Multi-instance scaling**: in-memory PubSub only works if the mutation and subscriber are on the same server instance. For multiple Node instances behind a load balancer, use Redis PubSub — `graphql-redis-subscriptions`. The mutation publishes to Redis; Redis broadcasts to all server instances.
7. **Field resolvers on subscription payloads**: subscription payload still passes through field resolvers — `Message.sender` still uses DataLoader, maintaining N+1 protection.

### Complexity

| | HTTP Query/Mutation | WebSocket Subscription |
|--|---|---|
| Connection | Stateless, one per request | Persistent, one per subscriber |
| Data direction | Client polls for updates | Server pushes updates |
| Horizontal scaling | Easy (stateless) | Requires Redis PubSub |
| Use case | CRUD, read queries | Real-time: chat, live scores, feeds |

---

## Q85: How do you implement authentication in a GraphQL API?

### ELI5

Authentication in GraphQL works just like in REST — check the JWT in the HTTP Authorization header. The key difference is WHERE you check it. In GraphQL, you put the decoded user object into the `context` — a shared object that every resolver receives. Resolvers that need authentication check `context.user`. You can also use schema directives (`@auth`) to declare protection directly in the schema.

### Visual Diagram

```
HTTP Request
  Headers: { Authorization: "Bearer eyJ..." }
        |
        v
Apollo Server context factory
  - Extract token from header
  - jwt.verify(token) -> { sub: 'userId', role: 'ADMIN' }
  - Attach user to context: { user: { id, role } }
        |
        v
GraphQL execution
  Each resolver receives (parent, args, context, info)
                                         ^
                              context.user is here

Protected resolver:
  meProfile: (_, __, { user }) => {
    if (!user) throw new GraphQLError('Unauthenticated', { extensions: { code: 'UNAUTHENTICATED' } })
    return db.users.findById(user.id)
  }
```

### Code Example

```javascript
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const jwt = require('jsonwebtoken');

// ============================================================
// Context factory: runs on every request
// ============================================================
const contextFactory = async ({ req }) => {
  let user = null;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = { id: decoded.sub, role: decoded.role };
    } catch {
      // Invalid/expired token — user stays null
      // Don't throw here — some routes are public
    }
  }

  return {
    user,
    db,
    loaders: {
      user: createUserLoader(db),
    },
  };
};

// ============================================================
// Helper: requireAuth — throw if not authenticated
// ============================================================
function requireAuth(context) {
  if (!context.user) {
    throw new GraphQLError('You must be logged in', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  return context.user;
}

function requireRole(context, role) {
  const user = requireAuth(context);
  if (user.role !== role) {
    throw new GraphQLError('Insufficient permissions', {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }
  return user;
}

// ============================================================
// Resolvers using auth helpers
// ============================================================
const resolvers = {
  Query: {
    // Public — no auth needed
    publicPosts: (_, __, { db }) =>
      db.collection('posts').find({ published: true }).toArray(),

    // Protected — must be logged in
    myProfile: async (_, __, context) => {
      const user = requireAuth(context);
      return db.collection('users').findOne({ _id: new ObjectId(user.id) });
    },

    // Admin only
    allUsers: async (_, __, context) => {
      requireRole(context, 'ADMIN');
      return db.collection('users').find().toArray();
    },
  },

  Mutation: {
    updateProfile: async (_, { input }, context) => {
      const user = requireAuth(context);
      return db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(user.id) },
        { $set: input },
        { returnDocument: 'after' }
      );
    },
  },
};

// ============================================================
// Schema directive approach: @auth decorator in SDL
// (works with graphql-auth-directives or custom directive)
// ============================================================
const typeDefs = `#graphql
  directive @auth on FIELD_DEFINITION
  directive @hasRole(role: String!) on FIELD_DEFINITION

  type Query {
    publicPosts: [Post!]!
    myProfile: User @auth
    allUsers: [User!]! @hasRole(role: "ADMIN")
  }
`;
```

### Step-by-Step Explanation

1. **Context as the auth carrier**: the Apollo Server context factory runs on every request. Decode the JWT there and attach the user object to context — all resolvers receive it automatically.
2. **Don't throw on invalid token in context**: some queries are public. A rejected/expired token should set `user = null`, not throw. Resolvers that need auth check `if (!context.user)` themselves.
3. **HTTP status codes in GraphQL**: GraphQL always returns HTTP 200, even for errors. Set `extensions.http.status` to give HTTP-aware clients (Apollo Server 4+) the correct status code.
4. **`requireAuth` helper**: centralizes the "throw if not logged in" check. Cleaner than duplicating `if (!context.user) throw ...` in every resolver.
5. **Schema directives**: `@auth` on a field definition is declarative — the schema itself documents which fields are protected. Requires a directive visitor implementation.
6. **GraphQL auth vs REST auth**: same JWT/session mechanism, different integration point. REST uses middleware; GraphQL uses context factory + resolver-level checks.
7. **Subscription auth**: for WebSocket subscriptions, authenticate in `useServer`'s `context` function using `connectionParams` (since there's no HTTP request after the initial upgrade).

### Complexity

| Approach | Pro | Con |
|----------|-----|-----|
| requireAuth helper | Simple, explicit | Repetitive in large schemas |
| Schema directives (@auth) | Declarative, visible in schema | More setup, framework-specific |
| Middleware per field | Fine-grained | Complex wiring |

---

## Q86: How does error handling work in GraphQL? How do you hide internal errors?

### ELI5

In REST, errors are HTTP status codes (404, 500). In GraphQL, the HTTP response is almost always 200, but the JSON body has an `errors` array. Each error has a message and optional `extensions` for codes. The challenge is that you don't want to accidentally send a database error message like "ECONNREFUSED 127.0.0.1:5432" to your users — you hide those behind a generic message while logging the real error internally.

### Visual Diagram

```
Resolver throws GraphQLError('Email already in use')
        |
        v
GraphQL execution catches it
        |
        v
Response: HTTP 200
{
  "data": { "createUser": null },
  "errors": [
    {
      "message": "Email already in use",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["createUser"],
      "extensions": { "code": "CONFLICT", "field": "email" }
    }
  ]
}

Resolver throws new Error('ECONNREFUSED 127.0.0.1')  (DB error)
        |
        v
formatError handler intercepts
        |  - logs full error internally
        |  - client receives sanitized message
        v
{
  "errors": [
    { "message": "Internal server error", "extensions": { "code": "INTERNAL_SERVER_ERROR" } }
  ]
}
```

### Code Example

```javascript
const { GraphQLError } = require('graphql');
const { ApolloServer } = require('@apollo/server');

// ============================================================
// Custom error classes
// ============================================================
class AppError extends GraphQLError {
  constructor(message, code, statusCode = 400) {
    super(message, {
      extensions: {
        code,
        http: { status: statusCode },
      },
    });
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'FORBIDDEN', 403);
  }
}

class ValidationError extends AppError {
  constructor(message, field) {
    super(message, 'BAD_USER_INPUT', 400);
    this.extensions.field = field;
  }
}

// ============================================================
// formatError: intercept ALL errors before sending to client
// ============================================================
const server = new ApolloServer({
  typeDefs,
  resolvers,
  formatError: (formattedError, error) => {
    // 'error' = the original thrown error (with stack trace etc.)
    // 'formattedError' = the already-shaped GraphQL error

    // Log every error internally with full details
    console.error('GraphQL Error:', {
      message: error.message,
      stack: error.stack,
      path: formattedError.path,
      extensions: formattedError.extensions,
    });

    // If it's a GraphQLError (thrown deliberately with AppError/GraphQLError),
    // it's safe to return to the client as-is
    if (error instanceof GraphQLError) {
      return formattedError;
    }

    // For unknown / DB / infrastructure errors: return sanitized response
    // Don't leak DB connection strings, internal paths, stack traces
    return {
      message: 'Internal server error',
      extensions: {
        code: 'INTERNAL_SERVER_ERROR',
        ...(process.env.NODE_ENV === 'development' && {
          // Only include stack in development
          stack: error.stack,
          originalMessage: error.message,
        }),
      },
    };
  },
});

// ============================================================
// Resolvers using custom errors
// ============================================================
const resolvers = {
  Query: {
    user: async (_, { id }, { db }) => {
      const user = await db.collection('users').findOne({ _id: new ObjectId(id) });
      if (!user) throw new NotFoundError('User');
      return user;
    },
  },
  Mutation: {
    createUser: async (_, { input }, { db }) => {
      if (!input.email.includes('@')) {
        throw new ValidationError('Invalid email format', 'email');
      }
      const exists = await db.collection('users').findOne({ email: input.email });
      if (exists) throw new AppError('Email already in use', 'CONFLICT', 409);
      // ... create user
    },
  },
};
```

### Step-by-Step Explanation

1. **GraphQL `errors` array**: every GraphQL response can have both `data` and `errors`. A partial response is valid — some fields resolve successfully while others error.
2. **`GraphQLError` vs plain `Error`**: throw `GraphQLError` for expected application errors (client mistakes, business rule violations). Plain `Error` throws from unexpected failures (DB down, null reference).
3. **`formatError`**: Apollo Server's hook to intercept errors before they reach the client. Always sanitize non-`GraphQLError` errors here to avoid leaking internal details.
4. **`extensions.code`**: machine-readable error code used by clients to handle specific errors without string-parsing messages. Standard codes: `BAD_USER_INPUT`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_SERVER_ERROR`.
5. **`path`**: the GraphQL field path where the error occurred (`["users", "0", "orders"]`). Helps clients know which part of the query failed.
6. **Partial success**: if you query `{ user(id: 1) { name, orders { total } } }` and `orders` fails, GraphQL can still return the `name`. `data.user.name` is populated, `data.user.orders` is null, and the error appears in `errors`.
7. **Production vs development**: include stack traces in `extensions` only in development (`NODE_ENV === 'development'`). Sending stacks to production clients leaks implementation details.

### Complexity

| Error type | Throw | Result |
|------------|-------|--------|
| Client input error | new GraphQLError('...', { code: BAD_USER_INPUT }) | Passed through to client |
| Auth error | new GraphQLError('...', { code: UNAUTHENTICATED }) | Passed through to client |
| DB / infra error | plain Error or DB-thrown error | Sanitized by formatError; logged internally |
| Unexpected | Any uncaught throw | Sanitized; 500-equivalent extensions.code |

---

## Q87: What are GraphQL fragments and aliases? When do you use them?

### ELI5

A fragment is a reusable piece of a GraphQL query — like a saved template. If you need to fetch the same set of fields (`id`, `name`, `email`) in three different queries, you define a fragment once and reuse it. Aliases let you rename fields in the response — so if you query the same field twice with different arguments (e.g., get both the current user AND another user in one request), you rename them so they don't overwrite each other in the JSON response.

### Visual Diagram

```
--- FRAGMENTS ---
Without fragment (repetition):
  query { me { id name email avatar }  friend(id: "1") { id name email avatar } }

With fragment:
  fragment UserBasic on User { id name email avatar }
  query { me { ...UserBasic }  friend(id: "1") { ...UserBasic } }
  --- less repetition, easier to maintain

--- ALIASES ---
Without alias (PROBLEM: same field name, different args):
  query { user(id: "1") { name }  user(id: "2") { name } }
  ERROR: duplicate field 'user' in same selection set

With aliases:
  query {
    currentUser: user(id: "1") { name }
    otherUser:   user(id: "2") { name }
  }
  Result: { currentUser: { name: 'Alice' }, otherUser: { name: 'Bob' } }
  -- keys in response use the alias names
```

### Code Example

```javascript
// ============================================================
// Client-side (React/Apollo Client) using fragments and aliases
// ============================================================
import { gql, useQuery } from '@apollo/client';

// Reusable fragment defined once
const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    name
    email
    avatar
    role
  }
`;

// Reusable fragment for order data
const ORDER_FIELDS = gql`
  fragment OrderFields on Order {
    id
    total
    status
    createdAt
    items {
      quantity
      priceAtPurchase
      product {
        id
        name
        imageUrl
      }
    }
  }
`;

// ============================================================
// Query using fragments and aliases
// ============================================================
const DASHBOARD_QUERY = gql`
  query Dashboard($userId: ID!) {
    # Alias: query user twice for different purposes
    currentUser: user(id: $userId) {
      ...UserFields
      # Alias: get two date ranges of orders
      recentOrders: orders(status: COMPLETED, limit: 5) {
        ...OrderFields
      }
      pendingOrders: orders(status: PENDING) {
        ...OrderFields
      }
    }
    # Public content alongside personal data in one request
    featuredProducts: products(featured: true, limit: 4) {
      id
      name
      price
    }
  }
  ${USER_FIELDS}
  ${ORDER_FIELDS}
`;

function Dashboard({ userId }) {
  const { data, loading, error } = useQuery(DASHBOARD_QUERY, {
    variables: { userId },
  });

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h1>Welcome, {data.currentUser.name}</h1>
      <h2>Recent Orders</h2>
      {data.currentUser.recentOrders.map(order => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

// ============================================================
// Inline fragments: conditional fields on union/interface types
// ============================================================
const SEARCH_QUERY = gql`
  query Search($term: String!) {
    search(term: $term) {
      # search returns SearchResult which is a union: User | Post | Product
      ... on User {
        id
        name
        email
      }
      ... on Post {
        id
        title
        publishedAt
      }
      ... on Product {
        id
        name
        price
      }
      __typename  # discriminator field
    }
  }
`;
```

### Step-by-Step Explanation

1. **Fragments**: named, reusable selections of fields on a specific type (`fragment UserFields on User { ... }`). Use `...FragmentName` to spread them into a query. Avoids duplicating field lists across multiple queries.
2. **Aliases**: rename a field in the response with `alias: fieldName`. Required when querying the same field twice with different arguments — without aliases, the response JSON would have duplicate keys.
3. **Inline fragments**: `... on TypeName { fields }` — select fields only if the result is of a specific type. Used with unions and interfaces where the returned type is variable.
4. **`__typename`**: every GraphQL type has a `__typename` meta-field that returns the type name as a string. Use it in union/interface queries to determine which type was returned.
5. **Apollo Client fragment colocation**: fragments can be defined next to the components that use them (colocated) and composed into parent queries. This is the Apollo "colocation" pattern — each component declares its own data needs.
6. **Cache key**: Apollo Client uses `__typename + id` to normalize its cache. Fragments that include `id` and `__typename` enable proper cache updates.
7. **Client-side only feature**: fragments and aliases are client-side query syntax. The server just sees the fully resolved query fields — it doesn't know fragments were used.

### Complexity

| Feature | Use case |
|---------|----------|
| Fragment | Reuse field sets across queries, reduces duplication |
| Alias | Query same field with different args, rename response keys |
| Inline fragment | Conditional fields on union/interface results |
| __typename | Type discrimination for unions, cache normalization |

---

## Q88: What are persisted queries? Why do they improve performance and security?

### ELI5

Normally, a GraphQL client sends the full query text over the network every request — like faxing the entire menu every time you order food. Persisted queries pre-register query strings on the server (or a CDN) and assign them a short ID (hash). Then the client just sends `{ id: "abc123" }` instead of the full query text. This saves bandwidth, enables CDN caching, and prevents attackers from sending arbitrary expensive queries.

### Visual Diagram

```
WITHOUT persisted queries:
  Client --> POST /graphql  body: { query: "query GetUser { user(id: ...) { name email orders { ... } } }" }
  Server: parse query, validate, execute, return
  Problem: large queries = large payloads; malicious client can send unlimited-depth queries

WITH persisted queries (Automatic Persisted Queries - APQ):
  Step 1 (first request):
    Client --> POST /graphql { extensions: { persistedQuery: { version: 1, sha256Hash: "abc123" } } }
    Server: "I don't know hash abc123"
    Server --> { errors: [{ code: PERSISTED_QUERY_NOT_FOUND }] }

  Step 2 (client resends with full query):
    Client --> POST /graphql { query: "...", extensions: { persistedQuery: { sha256Hash: "abc123" } } }
    Server: stores query text keyed by "abc123" in cache/DB
    Server --> { data: {...} }

  Subsequent requests:
    Client --> GET /graphql?extensions={"persistedQuery":{"sha256Hash":"abc123"}}&variables=...
    Server: looks up hash "abc123", finds query text, executes
    CDN: can cache GET responses (query hash + variables = cache key)
```

### Code Example

```javascript
// ============================================================
// Server: Apollo Server with APQ (Automatic Persisted Queries)
// ============================================================
const { ApolloServer } = require('@apollo/server');
const { KeyvAdapter } = require('@apollo/utils.keyv');
const Keyv = require('keyv');

// APQ requires a cache store -- Redis in production
const cache = new KeyvAdapter(new Keyv(process.env.REDIS_URL));

const server = new ApolloServer({
  typeDefs,
  resolvers,
  cache, // used for APQ storage
  plugins: [
    // APQ is built into Apollo Server -- just providing a persistent cache enables it
  ],
});

// ============================================================
// Client: Apollo Client with APQ enabled
// ============================================================
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { createPersistedQueryLink } from '@apollo/client/link/persisted-queries';
import { sha256 } from 'crypto-hash';

const persistedQueriesLink = createPersistedQueryLink({ sha256 });
const httpLink = new HttpLink({ uri: '/graphql' });

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: persistedQueriesLink.concat(httpLink),
  // With APQ enabled, all queries are automatically sent as hash first
  // Apollo Client handles the retry when the server returns PERSISTED_QUERY_NOT_FOUND
});

// ============================================================
// Trusted Documents (stricter alternative): only known query hashes allowed
// ============================================================
// Build step: extract all query strings from the app, generate hash manifest
// {
//   "abc123": "query GetUser($id: ID!) { user(id: $id) { name } }",
//   "def456": "mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) { id } }"
// }

// Server: reject any query not in the manifest
const trustedDocuments = require('./generated/trusted-documents.json');

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [
    {
      requestDidStart: async () => ({
        didResolveOperation: async ({ request, document }) => {
          const hash = request.extensions?.persistedQuery?.sha256Hash;
          if (!hash || !trustedDocuments[hash]) {
            throw new GraphQLError('Untrusted query', {
              extensions: { code: 'QUERY_NOT_TRUSTED' },
            });
          }
        },
      }),
    },
  ],
});
```

### Step-by-Step Explanation

1. **APQ flow**: client sends hash first (small). Server hits cache miss, replies with `PERSISTED_QUERY_NOT_FOUND`. Client resends with hash + full query. Server caches and responds. All future requests use hash only.
2. **Bandwidth reduction**: a complex query with fragments and field lists can be hundreds of bytes. The SHA-256 hash is always 64 characters. Significant savings for high-traffic APIs.
3. **CDN caching**: with APQ, simple queries can be sent as GET requests (`?extensions=...`). GET requests are cacheable by CDN. This enables GraphQL responses to be served from edge cache without hitting your origin server.
4. **Security**: arbitrary query attacks — sending deeply nested or computationally expensive queries — are mitigated. With Trusted Documents (allowlist), only queries your frontend app actually uses can be executed.
5. **Trusted Documents**: stricter than APQ — a build step extracts all query strings from your frontend code, generates a hash manifest, and the server ONLY allows queries whose hash is in the manifest. Unknown/attacker-crafted queries are immediately rejected.
6. **Cache backend**: use Redis for APQ cache in production. In-memory default only works for single-server setups and loses query cache on restart.
7. **Development trade-off**: during development, disable trusted documents (strict hash checking) so you can iterate on queries freely. Toggle via `NODE_ENV`.

### Complexity

| Feature | Benefit |
|---------|---------|
| APQ hash-only request | Reduces request payload size |
| APQ GET requests | Enables CDN caching |
| Trusted Documents | Blocks arbitrary query injection |
| Redis APQ cache | Survives server restarts, works across instances |

---

## Q89: What are Apollo Client cache policies? When does a query go to the network vs cache?

### ELI5

Apollo Client has an in-memory cache — a local database in your browser tab. When you make a GraphQL query, Apollo checks the cache first. The fetch policy tells it what to do: "cache-first" means use the cache if possible (fastest, might be stale); "network-only" means always fetch fresh data (slowest, always fresh); "cache-and-network" means show cached data immediately and then update when the fresh data arrives (fast initial load, eventually up to date).

### Visual Diagram

```
Apollo InMemoryCache structure (normalized by __typename + id):
  ROOT_QUERY
    user({"id":"1"}) --> ref: User:1
  User:1
    __typename: "User"
    id: "1"
    name: "Alice"
    email: "alice@x.com"
  User:2
    __typename: "User"
    id: "2"
    name: "Bob"

Fetch policies decision tree:
  cache-first:
    cache hit? --> return cache, no network
    cache miss? --> network, store in cache, return

  cache-and-network:
    always: return cache data immediately (if exists)
    always: also fetch from network, update cache, re-render with fresh data

  network-only:
    always go to network, store in cache, return fresh data

  no-cache:
    always go to network, DON'T store in cache

  cache-only:
    only read cache, throw error if not there, NEVER network

  standby:
    like cache-first but doesn't re-render on cache updates
```

### Code Example

```javascript
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

const client = new ApolloClient({
  uri: '/graphql',
  cache: new InMemoryCache({
    // Type policies: configure cache key and field merging per type
    typePolicies: {
      Query: {
        fields: {
          // Paginated field: merge pages instead of replacing
          posts: {
            keyArgs: ['filter'],  // cache varies by 'filter' arg only (not 'limit'/'cursor')
            merge(existing = { items: [] }, incoming) {
              return {
                ...incoming,
                items: [...existing.items, ...incoming.items], // append new pages
              };
            },
            read(existing) {
              return existing;
            },
          },
        },
      },
      User: {
        keyFields: ['id'],  // default -- normalize by id
      },
    },
  }),
});

// ============================================================
// Fetch policy per query
// ============================================================

// cache-first (default): user profile -- changes rarely
const { data: profile } = useQuery(GET_PROFILE, {
  fetchPolicy: 'cache-first',  // serve from cache if available, fast
});

// cache-and-network: order list -- may change, but show immediately
const { data: orders } = useQuery(GET_ORDERS, {
  fetchPolicy: 'cache-and-network', // render cached list immediately, refresh in background
});

// network-only: real-time data (stock price, live score)
const { data: price } = useQuery(GET_STOCK_PRICE, {
  fetchPolicy: 'network-only',   // always fresh
  pollInterval: 10000,            // and poll every 10 seconds
});

// no-cache: sensitive data you don't want stored in browser memory
const { data: secret } = useQuery(GET_SENSITIVE_DATA, {
  fetchPolicy: 'no-cache',  // never stored in InMemoryCache (e.g., 2FA codes)
});

// ============================================================
// Manual cache manipulation
// ============================================================

// After a mutation, manually update the cache
const [createPost] = useMutation(CREATE_POST, {
  update(cache, { data: { createPost } }) {
    // Add new post to the cached list without a refetch
    cache.modify({
      fields: {
        posts(existingPosts = []) {
          const newPostRef = cache.writeFragment({
            data: createPost,
            fragment: gql`fragment NewPost on Post { id title content }`,
          });
          return [newPostRef, ...existingPosts];
        },
      },
    });
  },
});

// Or: evict a cached item to force a fresh fetch next time
cache.evict({ id: cache.identify({ __typename: 'User', id: userId }) });
cache.gc(); // garbage collect orphaned references
```

### Step-by-Step Explanation

1. **Normalized cache**: Apollo Client's `InMemoryCache` stores data by `__typename + id`. Two queries returning the same user with the same ID share one cache entry — updating it in one place updates both views automatically.
2. **Fetch policy choices**: `cache-first` (performance, may be stale), `network-only` (always fresh, slower), `cache-and-network` (fast initial + background refresh — best UX for most cases), `no-cache` (sensitive data).
3. **`nextFetchPolicy`**: after the initial fetch, Apollo can use a different policy for subsequent fetches. Common pattern: `fetchPolicy: 'network-only', nextFetchPolicy: 'cache-first'` — fetch fresh on mount, then use cache for subsequent renders.
4. **Type policies / `keyArgs`**: tell Apollo which query arguments constitute a distinct cache key. For pagination, exclude `cursor`/`page` from `keyArgs` so all pages share one cache field, and use a `merge` function to concatenate pages.
5. **`cache.modify()`**: surgically update a cached object without writing a full query result. Used in mutation `update` callbacks to optimistically add/remove items from lists.
6. **`cache.evict()`**: remove an item from cache. The next query for that item will go to the network. Use after deleting a resource.
7. **Optimistic responses**: `useMutation({ optimisticResponse: {...} })` writes a temporary value to cache immediately, making the UI feel instant. Real server response overwrites the optimistic value when it arrives.

### Complexity

| Policy | Cache read | Network request | Cache write | Use case |
|--------|-----------|----------------|-------------|---------|
| cache-first | Always | Only on miss | On miss | Static/infrequent data |
| cache-and-network | Yes (immediate) | Always | Always | Live lists |
| network-only | No | Always | Always | Real-time |
| no-cache | No | Always | No | Sensitive data |
| cache-only | Always | Never | No | Offline mode |

---

## Q90: What is GraphQL Federation? When would you use schema stitching vs federation?

### ELI5

Federation is for large teams where different teams own different parts of the GraphQL schema. Team A owns `User` type, Team B owns `Order` type. Without federation, you'd need one giant schema file — every team edits the same file. With federation, each team runs their own GraphQL subgraph microservice, and a Gateway/Router combines them into one unified schema for clients. Schema stitching is an older manual approach to combining schemas; federation is the modern, better-designed alternative.

### Visual Diagram

```
Without federation: one big monolith schema
  All types in one server
  All teams edit same schema
  Hard to scale team ownership

With Apollo Federation:
  Client --> Apollo Router (Gateway)
                   |
         +---------+----------+
         |                    |
  Users Subgraph          Orders Subgraph
  (Team A's service)      (Team B's service)
  type User @key(fields: "id") {   type Order {
    id: ID!                          id: ID!
    name: String!                    total: Float!
    email: String!                   user: User  <-- extends User from another subgraph
  }                                }

Router receives query:
  { user(id: "1") { name orders { total } } }
  -->  fetches User.name from Users subgraph
  -->  fetches Orders.user.orders from Orders subgraph using userId as key
  -->  merges results and returns unified response
```

### Code Example

```javascript
// ============================================================
// Users Subgraph (Team A's service)
// ============================================================
const { ApolloServer } = require('@apollo/server');
const { buildSubgraphSchema } = require('@apollo/subgraph');
const { gql } = require('graphql-tag');

const usersTypeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

  type User @key(fields: "id") {
    id: ID!
    name: String!
    email: String!
  }

  type Query {
    user(id: ID!): User
    users(limit: Int): [User!]!
  }
`;

const usersResolvers = {
  Query: {
    user: (_, { id }) => db.users.findById(id),
    users: (_, { limit = 10 }) => db.users.find().limit(limit),
  },
  User: {
    // __resolveReference: called by the Router to resolve a User entity by its @key
    // The Orders subgraph says "I need User with id X" -- this function fulfills it
    __resolveReference: ({ id }) => db.users.findById(id),
  },
};

const usersServer = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs: usersTypeDefs, resolvers: usersResolvers }),
});

// ============================================================
// Orders Subgraph (Team B's service)
// ============================================================
const ordersTypeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@external"])

  # Extend the User type from the Users subgraph — only add our field
  type User @key(fields: "id") {
    id: ID! @external          # declared in another subgraph
    orders: [Order!]!          # added by this subgraph
  }

  type Order {
    id: ID!
    total: Float!
    status: String!
    user: User!
  }

  type Query {
    order(id: ID!): Order
  }
`;

const ordersResolvers = {
  User: {
    orders: ({ id }) => db.orders.find({ userId: id }).toArray(), // id comes from @key
  },
  Order: {
    user: (order) => ({ __typename: 'User', id: order.userId }), // creates entity reference
  },
  Query: {
    order: (_, { id }) => db.orders.findById(id),
  },
};

// ============================================================
// Apollo Router (runs as a separate binary, not Node.js)
// Configured via supergraph.yaml / router.yaml
// Composes the schemas from all subgraphs into a supergraph schema
// ============================================================
// CLI: rover supergraph compose --config supergraph.yaml > supergraph.graphql
// Run: ./router --supergraph supergraph.graphql --config router.yaml
```

### Step-by-Step Explanation

1. **Federation**: each microservice team owns a GraphQL subgraph — a complete, deployable GraphQL schema. The Apollo Router (or Gateway) composes them into a supergraph at runtime.
2. **`@key` directive**: marks the fields that uniquely identify an entity (like a primary key). Other subgraphs use this to cross-reference entities.
3. **`__resolveReference`**: when another subgraph needs an entity (e.g., "I have `{ __typename: 'User', id: '1' }` — please resolve the full User"), the owning subgraph's `__resolveReference` fetches it.
4. **Extending types**: a subgraph can add fields to a type defined in another subgraph (e.g., Orders adds `orders: [Order]` to the `User` type). The owner subgraph doesn't need to know about it.
5. **Schema stitching**: the older alternative — manually merge schemas on the gateway using code. More flexible but complex, error-prone, and harder to maintain. Federation is the recommended modern approach for microservices.
6. **When to avoid federation**: for a monolith or small team, federation adds significant operational complexity (multiple services, schema composition pipeline). Schema stitching or a single schema is simpler.
7. **Apollo Router vs Gateway**: Apollo Router is a Rust-based binary (v2, 2022+); Apollo Gateway is the Node.js predecessor. Router has better performance and supports federation v2 features. Use Router for new projects.

### Complexity

| | Federation | Schema Stitching | Monolith Schema |
|--|---|---|---|
| Team ownership | Each team owns subgraph | Manual merging code | Shared file |
| Operational complexity | High (multiple services) | Medium | Low |
| Type extension | Built-in (@key, @external) | Manual | N/A |
| Best for | Large org, microservices | Legacy migration | Small/medium team |

---

## Q91: How do you rate-limit a GraphQL API? Why is it different from REST?

### ELI5

In REST, rate limiting is simple: limit requests per endpoint per user. GraphQL has one endpoint but a query can ask for an enormous amount of data. One request could be: "give me all users, and for each user all their orders, and for each order all items..." — that's one request but it could read millions of records. Rate limiting GraphQL needs to consider query COMPLEXITY and query DEPTH, not just request count.

### Visual Diagram

```
REST rate limiting: easy
  POST /api/products  --> count +1, limit: 100 requests/minute
  GET /api/orders     --> count +1, limit: 100 requests/minute

GraphQL: ONE endpoint, BUT queries have wildly different costs
  query A: { user(id: "1") { name } }
    cost = 1 (single field)

  query B: { users { orders { items { product { name reviews { author { name } } } } } } }
    cost = potentially millions of DB reads per request
    -- this is ONE HTTP request but catastrophically expensive

Solution: Query Complexity Analysis
  Assign cost to each field resolver
  Sum costs before executing
  Reject if total > threshold

Solution: Query Depth Limit
  Limit nesting: users.orders.items.product.reviews.author = depth 6
  Reject if depth > maxDepth (e.g., 7)
```

### Code Example

```javascript
const { ApolloServer } = require('@apollo/server');
const depthLimit = require('graphql-depth-limit');
const { createComplexityLimitRule } = require('graphql-validation-complexity');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

// ============================================================
// 1. Query Depth Limiting (graphql-depth-limit)
// ============================================================
const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [
    depthLimit(7), // reject queries nested deeper than 7 levels
    createComplexityLimitRule(1000, {
      // Cost rules per field type (customize per your schema's cost model)
      scalarCost: 1,           // simple scalar fields cost 1
      objectCost: 10,          // objects cost more (may trigger a resolver)
      listFactor: 10,          // lists multiply cost by their multiplier
      introspectionListFactor: 1,
    }),
  ],
});

// ============================================================
// 2. Request-level rate limiting (express-rate-limit + Redis)
// Applied BEFORE GraphQL processing for DoS protection
// ============================================================
const graphqlRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,             // 100 requests per minute per IP
  keyGenerator: (req) => {
    // Rate limit by authenticated user ID if logged in, otherwise by IP
    const token = req.headers.authorization?.slice(7);
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return `user:${decoded.sub}`;
      } catch { /* fall through to IP-based */ }
    }
    return req.ip;
  },
  store: new RedisStore({ client: redisClient }),
  handler: (req, res) => res.status(429).json({
    errors: [{ message: 'Too many requests', extensions: { code: 'RATE_LIMITED' } }],
  }),
});

app.use('/graphql', graphqlRateLimit);

// ============================================================
// 3. Custom complexity plugin (manual cost calculation)
// ============================================================
const complexityPlugin = {
  requestDidStart: async () => ({
    didResolveOperation: async ({ document, operationName }) => {
      const complexity = calculateComplexity(document); // custom calculation
      console.log(`Query complexity: ${complexity} for operation: ${operationName}`);
      if (complexity > 1000) {
        throw new GraphQLError('Query is too complex', {
          extensions: { code: 'COMPLEXITY_LIMIT_EXCEEDED', complexity },
        });
      }
    },
  }),
};

// ============================================================
// 4. Disable introspection in production (attack surface reduction)
// ============================================================
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== 'production', // false in production
});
```

### Step-by-Step Explanation

1. **GraphQL rate limiting complexity**: unlike REST where each endpoint has comparable cost, GraphQL queries can vary from trivial to catastrophically expensive at the same endpoint.
2. **Depth limiting**: prevent deeply nested queries (`users { friends { friends { friends { ... } } } }`) that can cause exponential resolver invocations. Limit nesting depth (typically 5–10 levels).
3. **Query complexity**: assign a "cost" value to each field. Sum all costs before execution. Reject if over threshold. `graphql-validation-complexity` does this automatically.
4. **Request rate limiting**: still apply HTTP-level rate limiting (requests/min) as a first defense against DDoS, even though it doesn't capture query cost differences.
5. **Introspection disabling**: in production, disable introspection (`introspection: false`). Introspection lets anyone download your entire schema — useful for development, an attack surface in production (attackers learn your complete API).
6. **Persisted queries + trusted documents**: the strongest protection — if only pre-approved queries are allowed, arbitrary expensive queries are impossible regardless of complexity analysis.
7. **Timeout**: add a `requestTimeout` or use Apollo's `requestExecutionTimeout` plugin to kill queries that run too long.

### Complexity

| Defense | Protects against | Implementation |
|---------|-----------------|----------------|
| Request rate limit | DoS, brute force | express-rate-limit + Redis |
| Depth limit | Deeply nested queries | graphql-depth-limit |
| Complexity limit | Costly field combinations | graphql-validation-complexity |
| Disable introspection | Schema enumeration | introspection: false |
| Trusted documents | Arbitrary query injection | APQ allowlist |

---

## Q92: How do you handle file uploads in a GraphQL API?

### ELI5

GraphQL speaks JSON by default — JSON can't contain binary file data. To upload files through a GraphQL API, you use a multipart form request: the file is sent as binary data alongside a JSON GraphQL operation. The `graphql-upload` package handles the multipart parsing and makes the uploaded file available as a stream in your resolver. Alternatively, skip GraphQL entirely for uploads — upload directly to S3 using a presigned URL and just send the resulting URL through GraphQL.

### Visual Diagram

```
Option A: Upload via GraphQL multipart (graphql-upload):
  Client sends: multipart/form-data
    operations: '{"query":"mutation Upload($file:Upload!){uploadAvatar(file:$file){url}}","variables":{"file":null}}'
    map: '{"0": ["variables.file"]}'
    0: [binary file data]
  Server: graphql-upload middleware parses multipart
  Resolver receives: Upload scalar = { createReadStream, filename, mimetype, encoding }
  Resolver: pipe stream to S3 / local disk

Option B: Presigned URL (recommended for large files):
  Client --> GraphQL: mutation { getUploadUrl(filename: "photo.jpg") { url, key } }
  Server --> generates S3 presigned PUT URL (expires in 5 min)
  Client --> PUT directly to S3 presigned URL (bypasses your server!)
  Client --> GraphQL: mutation { updateAvatar(key: "uploads/photo.jpg") { avatarUrl } }
  Server: confirms file exists in S3, updates user record

Option B is preferred because:
  - Your server never handles file bytes (no memory pressure)
  - S3 handles the heavy I/O, checksums, multipart for large files
  - CDN can serve files directly from S3/CloudFront
```

### Code Example

```javascript
// ============================================================
// Option A: graphql-upload (direct upload through GraphQL)
// ============================================================
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const graphqlUploadExpress = require('graphql-upload/graphqlUploadExpress.mjs');
const GraphQLUpload = require('graphql-upload/GraphQLUpload.mjs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuid } = require('uuid');
const path = require('path');

const s3 = new S3Client({ region: process.env.AWS_REGION });
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const typeDefs = `#graphql
  scalar Upload

  type UploadResult {
    url: String!
    key: String!
  }

  type Mutation {
    uploadAvatar(file: Upload!): UploadResult!
  }
`;

const resolvers = {
  Upload: GraphQLUpload, // register the scalar resolver

  Mutation: {
    uploadAvatar: async (_, { file }, { userId }) => {
      // Resolver receives a promise that resolves to the upload stream
      const { createReadStream, filename, mimetype } = await file;

      // Validate mime type -- never trust client-provided Content-Type
      if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
        throw new GraphQLError('Invalid file type. Only JPEG, PNG, WebP allowed', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Sanitize filename: never use client filename directly in storage path
      const ext = path.extname(filename).toLowerCase().replace(/[^.a-z0-9]/g, '');
      const key = `avatars/${userId}/${uuid()}${ext}`;

      // Stream directly to S3 (no buffering entire file in memory)
      await s3.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: createReadStream(),
        ContentType: mimetype,
        ContentLength: MAX_FILE_SIZE, // enforce max size at S3
      }));

      return {
        url: `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`,
        key,
      };
    },
  },
};

// Register graphql-upload middleware BEFORE Apollo middleware
app.use(graphqlUploadExpress({ maxFileSize: MAX_FILE_SIZE, maxFiles: 1 }));
app.use('/graphql', expressMiddleware(server));

// ============================================================
// Option B: Presigned URL (recommended for production)
// ============================================================
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

const typeDefs2 = `#graphql
  type PresignedUpload {
    uploadUrl: String!
    key: String!
    expiresIn: Int!
  }

  type Mutation {
    getAvatarUploadUrl(filename: String!, contentType: String!): PresignedUpload!
    confirmAvatarUpload(key: String!): User!
  }
`;

const resolvers2 = {
  Mutation: {
    getAvatarUploadUrl: async (_, { filename, contentType }, { userId }) => {
      if (!ALLOWED_MIME_TYPES.includes(contentType)) {
        throw new GraphQLError('Invalid content type', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      const ext = path.extname(filename).toLowerCase().replace(/[^.a-z0-9]/g, '');
      const key = `avatars/${userId}/${uuid()}${ext}`;

      // Generate a presigned URL — client PUTs directly to S3
      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 minutes

      return { uploadUrl, key, expiresIn: 300 };
    },

    confirmAvatarUpload: async (_, { key }, { userId, db }) => {
      // Verify the key belongs to this user (check prefix)
      if (!key.startsWith(`avatars/${userId}/`)) {
        throw new GraphQLError('Unauthorized', { extensions: { code: 'FORBIDDEN' } });
      }

      const avatarUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;
      return db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { $set: { avatarUrl } },
        { returnDocument: 'after' }
      );
    },
  },
};
```

### Step-by-Step Explanation

1. **GraphQL Upload scalar**: `graphql-upload` adds an `Upload` scalar that maps to a file stream in resolvers. The multipart request contains the binary data alongside the JSON operation.
2. **`graphql-upload` middleware**: must be registered as Express middleware BEFORE Apollo's middleware to parse the multipart request before GraphQL sees it.
3. **Never use client filename directly**: always generate a random UUID-based key for storage. Client filenames can contain path traversal characters (`../../etc/passwd`). Only use the extension after sanitizing.
4. **Validate MIME type**: the `mimetype` from graphql-upload is client-provided. Additionally validate by checking the file's magic bytes (first bytes) with `file-type` library for stronger validation.
5. **Stream, don't buffer**: use `createReadStream()` and pipe directly to S3. Buffering the entire file in memory (with `await streamToBuffer(file)`) before uploading defeats the purpose and can crash the server with large files.
6. **Presigned URL advantages**: for production, the presigned URL pattern is superior — your server never touches file bytes, S3 handles bandwidth, large files (GB) work without timeout issues, and clients upload directly from their machine to S3 at full speed.
7. **Confirm key ownership**: in `confirmAvatarUpload`, verify the storage key prefix matches the authenticated user's ID — prevent a user from hijacking another user's uploaded file path.

### Complexity

| | Direct upload (graphql-upload) | Presigned URL |
|--|---|---|
| Server memory | File bytes in memory | Zero (not touched) |
| Max file size | Limited by server RAM/timeout | Unlimited (S3 handles) |
| Complexity | Simple setup | Two-step (get URL, confirm) |
| Best for | Small files, simple apps | Production, large files |

--- End of Section 10 ---

---

# Section 11: SYSTEM DESIGN (Q93-Q104)

---

## Q93: Walk me through designing a system to handle a flash sale — 1 item, 10,000 concurrent buyers.

### ELI5

Imagine one toy is put on a shop shelf and 10,000 kids run in at the same time. If everyone grabs and checks out normally, 9,999 kids will be disappointed AND the shop's payment system will crash from the load. The smart shopkeeper puts up a virtual queue: a ticket machine outside the door gives numbered tickets (Redis queue). Only one ticket can win — the rest see "sold out" instantly. The lucky winner is taken to the checkout room (payment flow). Everyone else is handled gracefully without ever reaching the stockroom.

### Visual Diagram

```
10,000 clients
    |
    v
+--------------------+
| CDN / Load Balancer|   <-- WAF, rate-limit per IP
+--------------------+
    |
    v
+--------------------+
| API Gateway        |   <-- throttles to ~500 req/s burst
+--------------------+
    |
    v
+------------------------+       already sold?
| Redis SETNX / Lua      |-----> return "sold out" instantly (no DB hit)
| atomic stock check     |
+------------------------+
    |  stock > 0: decrement
    v
+------------------------+
| Queue (SQS / Redis)    |   <-- enqueue order intent
+------------------------+
    |
    v
+------------------------+
| Order Worker (single   |   <-- processes queue serially or with low concurrency
| consumer or low-conc.) |   <-- idempotency key prevents double-charge
+------------------------+
    |
    v
+------------------------+
| Payment Service        |   <-- calls Stripe / PSP with idempotency key
+------------------------+
    |
    v
+------------------------+
| DB (write order)       |   <-- Postgres / DynamoDB
+------------------------+

Key insight: Redis atomic operations (DECR, Lua script) are the lock.
             DB is only touched once per sale — not 10,000 times.
```

### Code Example

```javascript
const express = require('express');
const redis = require('ioredis');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const app = express();
const redisClient = new redis(process.env.REDIS_URL);
const sqs = new SQSClient({ region: 'us-east-1' });

const ITEM_ID = 'flash-item-001';
const STOCK_KEY = `stock:${ITEM_ID}`;
const QUEUE_URL = process.env.SQS_QUEUE_URL;

// ----- Lua script: atomically check and decrement stock -----
// Lua scripts execute as a single atomic operation in Redis — no race conditions
const decrementIfAvailable = `
  local stock = tonumber(redis.call('GET', KEYS[1]))
  if stock and stock > 0 then
    redis.call('DECR', KEYS[1])
    return 1   -- success: buyer gets the item
  else
    return 0   -- sold out
  end
`;

// ----- Route: buyer attempts to purchase -----
app.post('/flash-sale/buy', async (req, res) => {
  const { userId, paymentToken } = req.body;
  const idempotencyKey = `order:${userId}:${ITEM_ID}`;

  // Step 1: Check if this user already has a pending order (idempotency)
  const existing = await redisClient.get(idempotencyKey);
  if (existing) {
    return res.status(409).json({ status: 'already_purchased' });
  }

  // Step 2: Atomically decrement stock — only ONE buyer can win
  // Redis processes this Lua script as a single transaction
  const won = await redisClient.eval(decrementIfAvailable, 1, STOCK_KEY);

  if (won === 0) {
    // Stock was already 0 — return immediately, no DB, no queue
    return res.status(410).json({ status: 'sold_out' });
  }

  // Step 3: Mark this user as having claimed the item (TTL = 15 min to complete payment)
  await redisClient.setex(idempotencyKey, 900, 'reserved');

  // Step 4: Enqueue order for async processing — don't block the HTTP response on payment
  await sqs.send(new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify({ userId, itemId: ITEM_ID, paymentToken }),
    MessageDeduplicationId: idempotencyKey, // prevents SQS duplicate delivery
    MessageGroupId: 'flash-sale',           // FIFO queue ensures ordered processing
  }));

  // Respond immediately — payment processes asynchronously
  res.status(202).json({
    status: 'reserved',
    message: 'Your order is being processed. You will be notified.',
  });
});

// ----- Worker (separate process) processes the SQS queue -----
// processOrderFromQueue runs with concurrency=1 to prevent overselling at payment stage
async function processOrderFromQueue(message) {
  const { userId, itemId, paymentToken } = JSON.parse(message.Body);

  // Step 5: Write order to DB with idempotency check
  const orderId = await db.createOrderIfNotExists({ userId, itemId, paymentToken });
  if (!orderId) return; // duplicate — already processed

  // Step 6: Charge payment with idempotency key so Stripe won't double-charge on retry
  await stripe.charges.create({
    amount: 9999,
    currency: 'usd',
    source: paymentToken,
    idempotencyKey: `charge:${userId}:${itemId}`,
  });

  // Step 7: Notify user via WebSocket or email
  await notifyUser(userId, { status: 'purchased', orderId });
}
```

### Step-by-Step Explanation

1. **CDN + WAF layer** absorbs static traffic and blocks obvious bots / per-IP abuse before requests reach application servers.
2. **API Gateway throttling** limits burst rate — prevents 10,000 simultaneous connections from overwhelming workers.
3. **Redis atomic stock check** (Lua script or `DECR`) is the true concurrency gate. Only one operation can read-and-decrement at a time — no two buyers can both see stock > 0 simultaneously.
4. **Sold-out path is instant**: if Redis returns 0, the API returns `410 Gone` without touching the database. 9,999 buyers get this response in <5ms.
5. **Winning buyer is enqueued**, not immediately processed through payment. This decouples the flash-sale API from payment latency.
6. **Idempotency keys** at three levels: Redis (user dedup), SQS (message dedup), Stripe (charge dedup). A crash at any stage can be retried safely.
7. **Worker processes the queue** at controlled concurrency — serialises the actual DB write and payment call, preventing DB thundering-herd.
8. **Pre-warm strategy**: stock is loaded into Redis before the sale starts (`SET stock:flash-item-001 1`). Redis never hits the DB during the sale.

### Complexity

| Component | Latency | Why |
|-----------|---------|-----|
| Redis DECR (sold out path) | ~0.5ms | In-memory, O(1) |
| Redis DECR (win path) + SQS enqueue | ~5-10ms | Network to SQS |
| DB write (worker, async) | ~20-50ms | Doesn't block buyer response |
| Payment (worker, async) | ~200-500ms | External PSP call |
| Throughput | ~50k-100k req/s | Redis single-threaded but extremely fast |

---

## Q94: How does the CAP theorem apply when choosing between PostgreSQL and MongoDB?

### ELI5

You run a library with two branches. CAP says you can only guarantee two of three things during a network outage: that both branches have the same books (Consistency), that a branch always answers the phone (Availability), and that the two branches can still talk to each other even with a broken phone line (Partition Tolerance). Since network failures always happen in the real world, you must always have P — so the real choice is: do you shut a branch down until the lines are fixed (CP) or let it keep lending books that might be slightly out of date (AP)?

### Visual Diagram

```
         CONSISTENCY
              /\
             /  \
            /    \
    CP     /  ???  \     CA
          /   pick   \
         /   any two  \
        /______________\
PARTITION               AVAILABILITY
TOLERANCE

--- Networks always partition → P is mandatory ---
--- Real choice: CP vs AP ---

PostgreSQL (default, strong consistency):
  CP system
  - All nodes agree before responding
  - During partition: primary stops accepting writes to avoid split-brain
  - Use when: financial data, inventory counts, anything needing exact truth

MongoDB (with w:majority):
  CP system (by default with replica sets + w:majority)
  - Majority of replicas must acknowledge write before returning success
  - Can tune toward AP by lowering write concern (w:1) + enabling reads from secondaries

MongoDB (with w:1, read from secondaries):
  AP system
  - Always available for reads/writes
  - Stale reads possible (secondary might be seconds behind primary)
  - Use when: product catalogue, user preferences, analytics — eventual consistency acceptable

+------------------+------------------+---------------------+
| Property         | PostgreSQL       | MongoDB (tunable)   |
+------------------+------------------+---------------------+
| Default mode     | CP               | CP (w:majority)     |
| Can be AP?       | No (MVCC, ACID)  | Yes (w:1 + reads)   |
| ACID tx support  | Full             | Multi-doc (4.0+)    |
| Partition behav. | Primary freezes  | Configurable        |
+------------------+------------------+---------------------+
```

### Code Example

```javascript
// ----- PostgreSQL: CP behaviour — strong consistency -----
// Uses serializable isolation — reads always see committed, consistent data
// During a network partition, the primary simply stops accepting writes

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// This query will either return accurate data or fail — never stale data
async function getAccountBalance(accountId) {
  const { rows } = await pool.query(
    'SELECT balance FROM accounts WHERE id = $1',
    [accountId]
  );
  return rows[0]?.balance; // always the latest committed value
}

// ----- MongoDB: tunable consistency -----
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URI);

// CP mode: w:majority ensures all replica majority acknowledge
// Safe for writes that must never be lost (e.g. orders, payments)
async function writeOrderCP(order) {
  const db = client.db('shop');
  await db.collection('orders').insertOne(order, {
    writeConcern: { w: 'majority', j: true }, // j:true = written to journal (disk)
  });
}

// AP mode: w:1 + read from secondaries — fast but eventually consistent
// Fine for product catalogue, session data, analytics counters
async function readProductCatalogueAP(productId) {
  const db = client.db('shop');
  // readPreference: secondary may return data 0-200ms behind primary
  return db.collection('products')
    .findOne({ _id: productId }, { readPreference: 'secondaryPreferred' });
}

// ----- Choosing based on business requirement -----
// "User just paid — show their updated balance" -> PostgreSQL or MongoDB w:majority
// "Show product recommendations" -> MongoDB w:1, read secondary — staleness tolerable
// "Deduct inventory for flash sale" -> Redis atomic + Postgres for final write
```

### Step-by-Step Explanation

1. **CAP Theorem**: in a distributed system you can guarantee at most two of: Consistency (every read returns the latest write), Availability (every request gets a non-error response), Partition Tolerance (system works despite network splits).
2. **Network partitions always happen** (hardware failures, data centre splits) so P is not optional — the real design choice is whether to sacrifice C or A during a partition.
3. **Consistency-over-Availability (CP)**: the system stops responding (or returns errors) rather than return stale/inconsistent data. PostgreSQL's primary goes read-only during a partition.
4. **Availability-over-Consistency (AP)**: the system keeps serving requests but some nodes may return stale data. MongoDB with `w:1` and `readPreference: secondary` behaves this way.
5. **PostgreSQL is always CP** — MVCC and serialisable transactions make it physically impossible to return stale committed data.
6. **MongoDB is a tunable CP/AP system** — write concern (`w:majority` vs `w:1`) and read preference (`primary` vs `secondary`) let you choose per-operation.
7. **PACELC model** extends CAP: even when there is no partition (normal operation), you must trade off latency vs consistency. MongoDB secondaries improve read latency at the cost of consistency.
8. **Decision guide**: Use PostgreSQL for money, inventory, auth. Use MongoDB for documents that tolerate eventual consistency (catalogue, logs, user activity, preferences).

### Complexity

| Scenario | PostgreSQL | MongoDB w:majority | MongoDB w:1 |
|----------|------------|--------------------|-------------|
| Network partition behaviour | Primary halts writes | Primary halts writes | Writes continue (risk loss) |
| Read freshness | Always latest | Always latest | May be stale (seconds) |
| Write latency | Medium (WAL fsync) | Higher (replica ack) | Low (ack from primary only) |
| ACID multi-document | Full | Supported (4.0+) | Supported |
| Best use | Financial, inventory | Orders, auth | Catalogue, analytics |

---

## Q95: What is the difference between horizontal and vertical scaling? When does each make sense?

### ELI5

Vertical scaling is making your one worker bigger and stronger — give them a better computer, more RAM, a faster CPU. Horizontal scaling is hiring more workers and splitting the work across all of them. There is a ceiling on how big one worker can get (the best server in the world still has a limit), but you can always hire more workers — as long as you can split the work fairly (load balancing) and the workers can share information (shared state, distributed cache).

### Visual Diagram

```
VERTICAL SCALING (scale up):
  Before:       After:
  [Server 4GB]  [Server 64GB]  <-- same machine, bigger hardware
  One instance, no code change, but has a ceiling (max EC2/VM size)

HORIZONTAL SCALING (scale out):
  Before:           After:
  [Server A]        [Server A]
                    [Server B]   <-- new instances added
                    [Server C]
                    [Server D]
        |
  [Load Balancer]  <-- distributes traffic across A, B, C, D
        |
  [Shared State]   <-- Redis, DB, S3 (cannot be local to each server)

--- When to use each ---

+----------------------+------------------------+------------------------+
| Factor               | Vertical               | Horizontal             |
+----------------------+------------------------+------------------------+
| App is stateful      | Good (single session)  | Hard (need sticky      |
|                      |                        | sessions / shared cache)|
| Cost at scale        | Expensive (premium hw) | Cheaper (commodity)    |
| Downtime for scaling | Yes (restart needed)   | No (add instances live)|
| Ceiling              | Hard limit ~100s GBs   | Virtually unlimited    |
| Example              | Single Postgres DB     | Stateless Node.js API  |
+----------------------+------------------------+------------------------+
```

### Code Example

```javascript
// ----- Stateless Node.js service — ready for horizontal scaling -----
// Key rule: NOTHING stored in-process memory that needs to survive across requests

const express = require('express');
const redis = require('ioredis');
const app = express();

const cache = new redis(process.env.REDIS_URL); // shared across ALL instances

// BAD: storing session in local memory — instance B won't know about it
// const sessions = {}; // <-- breaks horizontal scaling

// GOOD: store sessions in Redis — all instances share the same state
app.use(require('express-session')({
  store: new (require('connect-redis')(require('express-session')))({ client: cache }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

// Stateless route — no instance-local state used
app.get('/api/products', async (req, res) => {
  // Cache check goes to Redis, not local variable — works on any instance
  const cached = await cache.get('products:all');
  if (cached) return res.json(JSON.parse(cached));

  const products = await db.query('SELECT * FROM products');
  await cache.setex('products:all', 60, JSON.stringify(products));
  res.json(products);
});

app.listen(process.env.PORT || 3000);

// ----- ECS / EC2 Auto Scaling: horizontal scale triggers -----
// aws autoscaling put-scaling-policy \
//   --scaling-adjustment 2 \        <-- add 2 instances when triggered
//   --adjustment-type ChangeInCapacity \
//   --metric-aggregation-type Average
//
// Trigger on: CPU > 70% for 2 consecutive 60s periods

// ----- Vertical scaling: RDS example -----
// You cannot horizontally scale a single Postgres writer easily.
// Scale vertically: db.t3.medium -> db.r6g.2xlarge (8 vCPU, 64 GB RAM)
// Then add read replicas (horizontal) for read-only traffic.
```

### Step-by-Step Explanation

1. **Vertical scaling** (scale up): increase CPU, RAM, or disk on the existing machine. Simple — no code changes, no architecture changes. Has a hard ceiling and typically requires downtime or a stop/restart.
2. **Horizontal scaling** (scale out): add more instances of the same service behind a load balancer. No ceiling in theory, enables zero-downtime scaling, but requires the application to be stateless.
3. **Stateless requirement**: for horizontal scaling, each request must be servable by ANY instance. No in-process memory (local variables, in-memory caches, local file system) can hold state that must survive across requests.
4. **Shared state layer**: horizontally scaled apps need to push shared state to external systems — sessions to Redis, uploads to S3, queues to SQS/Kafka, DB writes to a single writer or distributed DB.
5. **Databases are usually vertically scaled first** — scaling writes horizontally requires sharding or a distributed DB (CockroachDB, DynamoDB), which adds complexity. Read replicas are horizontal but only for reads.
6. **Start vertical, go horizontal**: for a new service, vertical scaling is simpler and cheaper. As you hit CPU/memory limits or need high availability (no single point of failure), move to horizontal with a load balancer.
7. **Auto Scaling Groups (AWS) or HPA (Kubernetes)** implement horizontal scaling automatically based on CPU, memory, or custom metrics like SQS queue depth.
8. **Cost inversion at scale**: a single beefy server is expensive per unit. Many commodity servers are cheaper per unit and provide redundancy — horizontal scaling wins at high scale.

### Complexity

| Dimension | Vertical | Horizontal |
|-----------|----------|------------|
| Implementation effort | Low — change instance type | Medium — stateless design required |
| Downtime | Usually yes | No (rolling deploys) |
| Upper limit | Machine size (e.g. 128 vCPU) | Virtually unlimited |
| Cost efficiency at scale | Poor | Good |
| Best for | Databases (writer), legacy apps | Stateless APIs, workers, microservices |
| Failure tolerance | Single point of failure | High (N-1 redundancy) |

---

## Q96: How does a CDN work? What should and shouldn't you cache on a CDN?

### ELI5

A CDN is like a chain of local libraries scattered all over the world. When you write a new book (publish a file), copies are sent to every local library. Now when a reader (user) in Tokyo wants that book, they get it from the Tokyo library in 5ms — not from your publishing house in New York (which would take 200ms). The CDN caches your files close to your users. But if the book contains personalised chapters with the reader's name (dynamic/user-specific data), you cannot pre-print it — each reader needs their own custom copy from the publisher.

### Visual Diagram

```
Without CDN:
  User (Tokyo) ------200ms------> Origin Server (New York)
                                         |
                                  reads file, returns
  User (Tokyo) <-----200ms--------------+

With CDN:
  First request (MISS):
  User (Tokyo) --5ms--> CDN Edge (Tokyo)
                              |  cache miss
                              +----150ms----> Origin (New York)
                              <----150ms----- file returned
                              stores in edge cache
  User (Tokyo) <--5ms-- CDN Edge returns file

  Subsequent requests (HIT):
  User (Tokyo) --5ms--> CDN Edge (Tokyo) --5ms--> User (Tokyo)
                        (served from cache, origin not touched)

--- What to cache / not cache ---

+----------------------------+------------------+--------------------+
| Content                    | Cache on CDN?    | Cache-Control      |
+----------------------------+------------------+--------------------+
| JS/CSS bundles (hashed)    | YES              | max-age=31536000   |
| Images, fonts, videos      | YES              | max-age=86400+     |
| HTML (static site)         | YES              | max-age=60-3600    |
| API responses (public)     | Sometimes        | max-age=30-300     |
| API responses (authed)     | NO               | no-store, private  |
| User profile pages         | NO               | private            |
| Payment / checkout         | NO               | no-store           |
| Admin pages                | NO               | no-store           |
+----------------------------+------------------+--------------------+
```

### Code Example

```javascript
const express = require('express');
const app = express();

// ----- Static assets: cache aggressively on CDN -----
// Webpack/Vite adds content hash to filenames: main.a3f92b.js
// Hash changes on every deploy → safe to cache forever
app.use('/static', express.static('dist', {
  maxAge: '1y',           // tells CDN: cache for 1 year
  immutable: true,        // tells CDN: never check for updates
  // Cache-Control: public, max-age=31536000, immutable
}));

// ----- Public API responses: short TTL cache -----
// Product list changes rarely — 60 seconds is fine
app.get('/api/products', (req, res) => {
  res.set({
    'Cache-Control': 'public, max-age=60, s-maxage=300',
    // max-age=60: browser caches 60s
    // s-maxage=300: CDN caches 300s (overrides max-age for shared caches)
    'Surrogate-Key': 'products',  // CloudFront / Fastly tag for selective purge
  });
  res.json(products);
});

// ----- Authenticated endpoint: MUST NOT be cached on CDN -----
app.get('/api/profile', authenticate, (req, res) => {
  res.set({
    'Cache-Control': 'private, no-store',
    // private: browser can cache but CDN must not
    // no-store: don't cache anywhere (safest for sensitive data)
  });
  res.json({ user: req.user });
});

// ----- CDN cache invalidation using CloudFront -----
const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const cf = new CloudFrontClient({ region: 'us-east-1' });

async function invalidateProductCache() {
  // Called when a product is updated — forces CDN to refetch from origin
  await cf.send(new CreateInvalidationCommand({
    DistributionId: process.env.CF_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: Date.now().toString(),
      Paths: { Quantity: 1, Items: ['/api/products*'] },
    },
  }));
}
```

### Step-by-Step Explanation

1. A CDN has **Points of Presence (PoPs)** — servers located in cities worldwide near users.
2. On first request to an edge PoP (cache **miss**), the PoP forwards the request to your **origin server**, stores the response, and returns it.
3. On subsequent requests (cache **hit**), the edge serves the cached response in milliseconds — origin is never contacted, saving bandwidth and latency.
4. **Cache-Control headers** on your origin responses govern CDN behaviour: `max-age` sets TTL, `s-maxage` overrides for shared caches (CDN), `private` prevents CDN caching, `no-store` disables all caching.
5. **What to cache**: anything public and not user-specific — static assets (JS, CSS, images, fonts), public API responses, static HTML pages.
6. **What NOT to cache**: authenticated responses (user profile, cart, orders), forms with CSRF tokens, payment/checkout pages, admin dashboards.
7. **Cache busting**: for static assets, include a content hash in the filename (`bundle.abc123.js`). When you deploy, the filename changes, so old cached files are never served from CDN and no manual invalidation is needed.
8. **CDN invalidation**: when dynamic content changes (product price update), call the CDN API to purge the cache for specific paths. Expensive at scale — use short TTLs or purge-by-tag (Surrogate-Key / Cache-Tag) instead of individual path purges.

### Complexity

| Metric | Without CDN | With CDN |
|--------|-------------|----------|
| Latency (cross-continent) | 100-300ms | 3-20ms |
| Origin load (cache hit) | 100% requests hit origin | Near 0% for cache hits |
| TTFB for static assets | ~100ms+ | ~5-15ms |
| Cost | Pay for all origin bandwidth | Pay CDN bandwidth (cheaper) |
| Cache invalidation lag | Instant | Up to TTL duration |

---

## Q97: What is the Circuit Breaker pattern? What are its 3 states?

### ELI5

Think of the circuit breaker in your home fuse box. When something goes wrong (too much current / a service keeps failing), the breaker trips and cuts power — stopping the flow immediately. Without it, the faulty appliance could damage everything else. After a set time, you flip the breaker back to test if things are fixed. In software, a circuit breaker sits between your service and an external dependency (payment gateway, third-party API). When that dependency keeps failing, the breaker "opens" and immediately returns an error instead of waiting for timeouts — protecting your service from cascading failure.

### Visual Diagram

```
States:

CLOSED (normal operation):
  Your Service --request--> External API
  Success: counter resets
  Failure: failure counter++
  If failures >= threshold --> OPEN

OPEN (dependency is failing):
  Your Service --request--> [CIRCUIT BREAKER]
                               |
                    immediately returns fallback/error
                    External API is NOT called
  After timeout --> HALF-OPEN

HALF-OPEN (testing if dependency recovered):
  Your Service --ONE test request--> External API
  Success: --> back to CLOSED
  Failure: --> back to OPEN

State Transitions:
  CLOSED -----(N failures in window)-----> OPEN
  OPEN   -----(timeout elapsed)---------> HALF-OPEN
  HALF-OPEN --(1 success)---------------> CLOSED
  HALF-OPEN --(1 failure)---------------> OPEN

Without Circuit Breaker (cascading failure):
  ServiceA --> ServiceB --> ServiceC (DOWN)
  ServiceB waits 30s for timeout
  ServiceA waits 30s for ServiceB
  Thread pool exhausted --> ServiceA crashes too

With Circuit Breaker:
  ServiceA --> ServiceB --> [OPEN breaker] --> instant fallback
  ServiceB responds in <1ms
  ServiceA stays healthy
```

### Code Example

```javascript
// Using 'opossum' — the standard Node.js circuit breaker library
const CircuitBreaker = require('opossum');
const axios = require('axios');

// ----- The function we want to protect -----
// This calls an external payment gateway that might be slow or down
async function callPaymentGateway(payload) {
  const response = await axios.post('https://payments.example.com/charge', payload, {
    timeout: 3000, // don't wait more than 3s
  });
  return response.data;
}

// ----- Wrap it with circuit breaker -----
const breaker = new CircuitBreaker(callPaymentGateway, {
  timeout: 3000,         // call is a failure if it takes > 3s
  errorThresholdPercentage: 50, // open when 50% of calls fail within the rolling window
  resetTimeout: 30000,   // after 30s in OPEN, move to HALF-OPEN to test recovery
  rollingCountTimeout: 10000,   // 10s rolling window for failure rate calculation
  rollingCountBuckets: 10,      // divide the window into 10 buckets (1s each)
});

// ----- Fallback: what to return when circuit is OPEN -----
breaker.fallback((payload) => {
  // Return a safe default instead of letting the error propagate
  console.warn('Payment gateway circuit is OPEN — using fallback');
  return { status: 'queued', message: 'Payment will be retried shortly' };
});

// ----- Event listeners for monitoring -----
breaker.on('open',     () => console.error('Circuit OPENED — payment gateway failing'));
breaker.on('halfOpen', () => console.info('Circuit HALF-OPEN — testing recovery'));
breaker.on('close',    () => console.info('Circuit CLOSED — payment gateway recovered'));
breaker.on('fallback', (result) => console.warn('Fallback served:', result));

// ----- Express route using the breaker -----
const app = require('express')();
app.use(require('express').json());

app.post('/checkout', async (req, res, next) => {
  try {
    // breaker.fire() calls callPaymentGateway when CLOSED
    // returns fallback immediately when OPEN
    const result = await breaker.fire(req.body);
    res.json(result);
  } catch (err) {
    next(err); // error handler sends 503
  }
});
```

### Step-by-Step Explanation

1. **CLOSED state** (normal): requests pass through to the dependency. A rolling window tracks the failure rate. When failures exceed the threshold (e.g. 50% of requests in 10s), the breaker trips to OPEN.
2. **OPEN state** (dependency suspected down): the breaker immediately returns a fallback response without calling the dependency. This prevents thread/connection exhaustion and keeps your service fast even when the dependency is dead. After a reset timeout (e.g. 30s), moves to HALF-OPEN.
3. **HALF-OPEN state** (testing): allows a single test request through to the real dependency. Success → back to CLOSED. Failure → back to OPEN.
4. The key benefit is **fail fast**: instead of waiting 30s for a timeout on every request, you fail in <1ms while the breaker is open.
5. **Fallbacks** provide graceful degradation — a cached result, a default value, or a "queued for later" response.
6. Why not just timeouts? Timeouts still block a thread for N seconds. A circuit breaker stops the flood of blocking requests.
7. **Bulkhead pattern** is complementary: limits the number of concurrent calls to a dependency so a slow service can't consume all your threads.
8. Combine with **retry + exponential backoff** in HALF-OPEN state to avoid hammering a recovering service.

### Complexity

| State | Caller experience | Dependency impact |
|-------|-------------------|-------------------|
| CLOSED (healthy) | Normal latency | Full traffic |
| CLOSED (degrading) | Slow (timeout wait) | Full traffic + errors |
| OPEN | <1ms (instant fallback) | Zero traffic |
| HALF-OPEN | One real call, rest fallback | One probe request |
| Transition overhead | O(1) per request | None |

---

## Q98: What is the difference between optimistic and pessimistic locking? When would you use each?

### ELI5

Two people want to edit the same Google Doc. Pessimistic locking is like printing the doc, putting a "LOCKED — do not touch" sign on it, editing your printed copy, then unlocking it. Nobody else can print another copy while you hold the lock. Optimistic locking is like both people editing a copy at the same time. When you save, Google checks: "has this doc changed since you opened it?" If yes, your save is rejected and you must merge. Optimistic is faster when conflicts are rare. Pessimistic is safer when conflicts are likely and collisions must be prevented.

### Visual Diagram

```
PESSIMISTIC LOCKING:
  User A: SELECT ... FOR UPDATE   <-- database locks the row
  User B: SELECT ... FOR UPDATE   <-- BLOCKED, waits for A to finish
  User A: UPDATE + COMMIT         <-- lock released
  User B: now gets the lock, reads updated value, proceeds

OPTIMISTIC LOCKING:
  User A reads row: { balance: 100, version: 5 }
  User B reads row: { balance: 100, version: 5 }  (both get same snapshot)

  User A tries to update:
    UPDATE accounts SET balance=90, version=6 WHERE id=1 AND version=5
    -- succeeds (version still 5) -- rows affected: 1

  User B tries to update:
    UPDATE accounts SET balance=80, version=6 WHERE id=1 AND version=5
    -- FAILS (version is now 6, not 5) -- rows affected: 0
    -- application must retry with fresh read

+---------------------+--------------------+----------------------+
| Factor              | Pessimistic        | Optimistic           |
+---------------------+--------------------+----------------------+
| Mechanism           | DB row lock        | Version/timestamp    |
| Blocks?             | Yes                | No                   |
| Good for            | High contention    | Low contention       |
| Risk                | Deadlock possible  | Stale read + retry   |
| DB overhead         | Lock manager cost  | Extra version column |
+---------------------+--------------------+----------------------+
```

### Code Example

```javascript
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ----- PESSIMISTIC LOCKING: SELECT FOR UPDATE -----
// Use when: deducting inventory, transferring money — conflicts are likely
async function transferMoneyPessimistic(fromId, toId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock both rows immediately — no other transaction can change them until we COMMIT
    // Order IDs consistently (lower first) to prevent deadlocks
    const [firstId, secondId] = fromId < toId ? [fromId, toId] : [toId, fromId];
    const { rows } = await client.query(
      'SELECT id, balance FROM accounts WHERE id = ANY($1) ORDER BY id FOR UPDATE',
      [[firstId, secondId]]
    );

    const from = rows.find(r => r.id === fromId);
    const to   = rows.find(r => r.id === toId);

    if (from.balance < amount) throw new Error('Insufficient funds');

    await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
    await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ----- OPTIMISTIC LOCKING: version column -----
// Use when: updating user profile, product description — conflicts rare
async function updateProductOptimistic(productId, newPrice, knownVersion) {
  const result = await pool.query(
    // WHERE version = knownVersion ensures we only update if nobody else changed it
    `UPDATE products
     SET price = $1, version = version + 1
     WHERE id = $2 AND version = $3
     RETURNING *`,
    [newPrice, productId, knownVersion]
  );

  if (result.rowCount === 0) {
    // Another process updated the row between our read and write
    // Application must re-read the row and retry with the new version
    throw new ConflictError('Product was modified by another process — please retry');
  }

  return result.rows[0];
}

// ----- Mongoose optimistic locking (built-in with mongoose-update-if-current) -----
// const mongoose = require('mongoose');
// const schema = new mongoose.Schema({ price: Number }, { optimisticConcurrency: true });
// model.save() automatically uses __v (version key) and throws VersionError on conflict
```

### Step-by-Step Explanation

1. **Pessimistic locking**: acquire an exclusive lock on a database row before reading and modifying it. Other transactions that try to lock the same row are **blocked** until the lock is released. Implemented in SQL with `SELECT ... FOR UPDATE`.
2. **Optimistic locking**: no lock is acquired. Instead, a `version` column (or `updatedAt` timestamp) is read alongside the data. On write, include `WHERE version = <value-read>` — if another process changed the row, the WHERE clause matches 0 rows and the update fails. The application retries.
3. **Deadlock risk with pessimistic**: if two transactions each lock different rows and then try to lock each other's rows, both wait forever. Prevent by always acquiring multiple locks in a consistent order (lower ID first).
4. **Choose pessimistic when**: high contention (many concurrent writers), you cannot afford to retry (financial transfers), or conflicts are frequent (inventory during flash sales).
5. **Choose optimistic when**: reads heavily outnumber writes, conflicts are rare (user profile updates), the retry cost is low, and blocking writers would be worse than occasional retries.
6. **MVCC in PostgreSQL** is not optimistic locking — it handles read/write concurrency automatically. Explicit optimistic locking is an application-level pattern layered on top.
7. **HTTP ETags** are optimistic locking for REST APIs — `GET` returns an `ETag`, `PUT` sends `If-Match: <ETag>`, server rejects with `412 Precondition Failed` if the resource changed.
8. Mongoose has built-in optimistic locking via the `__v` version key and the `optimisticConcurrency` plugin.

### Complexity

| Metric | Pessimistic | Optimistic |
|--------|-------------|------------|
| Blocking | Yes — other writers wait | No blocking |
| Throughput under low contention | Lower (lock overhead) | Higher |
| Throughput under high contention | Better (prevents retries) | Poor (many retries) |
| Deadlock risk | Yes (multi-row locks) | No |
| Implementation | `SELECT FOR UPDATE` | Add `version` column + retry logic |
| Best scenario | Bank transfers, inventory | CMS edits, user profiles |

---
