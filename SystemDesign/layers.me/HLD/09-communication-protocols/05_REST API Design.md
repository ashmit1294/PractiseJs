# 05 — REST API Design

> **Module**: M9 — Communication Protocols  
> **Source**: https://layrs.me/course/hld/09-communication-protocols/rest  
> **Difficulty**: Intermediate | **Read time**: ~15 min

---

## ELI5

Imagine a **library** with a standardized system:
- Every book has a unique address (URL: `/books/123`)
- You use standard actions: "get me" (GET), "add" (POST), "replace" (PUT), "update partially" (PATCH), "remove" (DELETE)
- The librarian doesn't remember you between visits — each request is self-contained (stateless)
- Results can be cached (if a book hasn't changed, you get the cached copy instantly)

REST is this standardized library system applied to web APIs.

---

## Analogy

REST is like a **universal TV remote**. Every TV from different manufacturers responds to the same buttons (ON/OFF, volume, channel). You don't need different remotes for each TV. Similarly, REST APIs use uniform HTTP methods and URLs so any client (browser, mobile, CLI) can interact with any REST server without custom adapters.

---

## Core Concept

REST (Representational State Transfer) is an **architectural style** — not a protocol or a standard. Defined by Roy Fielding in his 2000 PhD dissertation as 6 constraints. An API that follows these constraints is "RESTful."

**Key insight**: REST is a design philosophy for building APIs over HTTP, not a specification you implement. There's no REST file to compile, no REST library to import.

---

## The 6 REST Constraints

| # | Constraint | Meaning | Violation Example |
|---|---|---|---|
| 1 | **Client-Server** | UI and data storage concerns are separated | Server rendering HTML AND managing business logic together |
| 2 | **Stateless** | Each request contains all information needed; server holds no client session state | Server stores "user is on step 2 of checkout" between requests |
| 3 | **Cacheable** | Responses must declare if they're cacheable (`Cache-Control`) | Not setting cache headers on GET responses |
| 4 | **Layered System** | Client doesn't know if it's talking directly to server or through proxy, CDN, LB | Client behavior changes based on whether it's behind a CDN |
| 5 | **Uniform Interface** | Resources identified by URI; manipulation via representations; self-descriptive messages; HATEOAS | Custom API that doesn't use HTTP methods; RPC-style verb URIs |
| 6 | **Code on Demand** *(optional)* | Server can send executable code to client (e.g., JavaScript) | No violation here — optional constraint |

---

## Richardson Maturity Model

A way to measure "how RESTful" an API is, from 0 to 3:

```
Level 3 ─── HATEOAS ─────── Responses include links to next actions
Level 2 ─── HTTP Verbs ───── GET/POST/PUT/DELETE + proper status codes  ← Industry Standard
Level 1 ─── Resources ────── Individual URI per resource (no verbs in URL)
Level 0 ─── POX ─────────── Single endpoint, POST everything (RPC-style)
```

### Level 0 — Plain Old XML / JSON (RPC-style)
```
POST /api
Body: { "action": "getUser", "id": 123 }
POST /api
Body: { "action": "deleteUser", "id": 123 }
```
Single endpoint. Action in the body. HTTP is just a tunnel.

### Level 1 — Resources
```
POST /users/123          ← individual resource, but wrong method
POST /users/123/disable  ← still verbs in URL
```
Resources have their own URIs, but HTTP methods aren't used correctly.

### Level 2 — HTTP Verbs + Status Codes (Industry Standard)
```
GET    /users/123     → 200 OK
POST   /users         → 201 Created
PUT    /users/123     → 200 OK
DELETE /users/123     → 204 No Content
GET    /users/999     → 404 Not Found
```
Correct use of HTTP verbs and status codes. 95% of "REST APIs" are here.

### Level 3 — HATEOAS
```json
GET /orders/456 → 200 OK
{
  "id": 456,
  "status": "pending",
  "_links": {
    "self":    { "href": "/orders/456" },
    "cancel":  { "href": "/orders/456/cancel",  "method": "DELETE" },
    "pay":     { "href": "/orders/456/payment", "method": "POST" },
    "items":   { "href": "/orders/456/items",   "method": "GET" }
  }
}
```
Response includes hypermedia links describing what actions are available. Client discovers next steps from the response itself — no hardcoded URLs.

**HATEOAS in practice**: used by GitHub API, Stripe API (partially), PayPal. Not universally adopted due to client-side complexity.

---

## Resource Design

### URL Conventions
```
GET    /users              → list all users
POST   /users              → create a user
GET    /users/123          → get user 123
PUT    /users/123          → replace user 123 completely
PATCH  /users/123          → partially update user 123
DELETE /users/123          → delete user 123

GET    /users/123/orders   → get all orders for user 123
GET    /users/123/orders/456 → get order 456 for user 123

# Filtering, sorting, pagination via query string
GET /users?role=admin&sort=created_at&page=2&limit=20
```

**Nouns, not verbs** in URLs:
```
✅ DELETE /users/123         (noun + HTTP verb)
❌ POST /deleteUser/123      (verb in URL — Level 0)
❌ GET /getUsers             (verb in URL — Level 0)
```

---

## Idempotency

| Method | Idempotent? | Implication |
|---|---|---|
| GET | ✅ Yes | Safe to retry automatically |
| DELETE | ✅ Yes | Delete twice = same result |
| PUT | ✅ Yes | Replace with same data = same result |
| PATCH | ⚠️ Depends | `{ "age": 30 }` is idempotent; `{ "increment": 1 }` is not |
| POST | ❌ No | Creates new resource each time — dangerous to auto-retry |

**Idempotency Key** (Stripe pattern): for non-idempotent POST operations, send an `Idempotency-Key` header with a unique UUID. The server stores the result under that key — duplicate requests return the cached result instead of executing again.

```
POST /payments
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json
{ "amount": 5000, "currency": "usd" }
```

---

## The N+1 Problem

Classic over-fetching pattern:

```
GET /users → [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }, ...]
// 1 request

GET /users/1/orders  ← 1 request
GET /users/2/orders  ← 1 request
...
GET /users/100/orders ← 1 request
// TOTAL: 1 + 100 = 101 requests = N+1 problem
```

**Solutions**:
1. **Include in response**: `GET /users?include=orders` — eager load in the backend
2. **Compound document**: `GET /users?include=orders` returns users + orders in one JSON response
3. **GraphQL**: client specifies exactly what it needs, no separate trips
4. **Batch endpoint**: `POST /users/orders/batch` with `{ "userIds": [1, 2, ..., 100] }`

---

## API Versioning Strategies

| Strategy | Example | Pros | Cons |
|---|---|---|---|
| **URI versioning** | `/v1/users`, `/v2/users` | Obvious, easy to test, CDN-friendly | "Dirty" URLs; duplicates routes |
| **Header versioning** | `Accept: application/vnd.myapi.v2+json` | Clean URLs | Less visible, harder to test |
| **Query string** | `/users?version=2` | Easy to test | Mixing resource and meta-info |
| **Date-based** (Stripe) | `Stripe-Version: 2023-10-16` | Precise backwards compatibility | Complex version matrix |

---

## REST Weaknesses

| Problem | Description | Solution |
|---|---|---|
| **Over-fetching** | Response contains more data than the client needs | GraphQL; sparse fieldsets (`?fields=id,name`) |
| **Under-fetching** | One endpoint doesn't return enough; requires multiple round trips | BFF (Backend for Frontend) pattern; compound endpoints |
| **No real-time** | Request-response only; no server push | WebSockets or SSE for real-time on top of REST |
| **N+1 problem** | Related resources require N+1 requests | Eager loading, batch endpoints, GraphQL |
| **Documentation drift** | REST has no schema enforcement | OpenAPI/Swagger specs |
| **HATEOAS complexity** | Level 3 rarely implemented; clients hardcode URLs anyway | Accept Level 2 as sufficient |

---

## MERN Dev Notes

```js
// Express.js RESTful routes (Level 2)
const express = require('express');
const router = express.Router();

// GET /users
router.get('/users', async (req, res) => {
  const { page = 1, limit = 20, sort = 'created_at', role } = req.query;
  const filter = role ? { role } : {};
  const users = await User.find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(Number(limit));
  res.json({ data: users, page: Number(page), limit: Number(limit) });
});

// POST /users → 201 Created
router.post('/users', async (req, res) => {
  const user = new User(req.body);
  await user.save();
  res.status(201).json(user);  // 201, not 200
});

// PUT /users/:id → full replacement
router.put('/users/:id', async (req, res) => {
  const user = await User.findByIdAndReplace(req.params.id, req.body, { new: true });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

// PATCH /users/:id → partial update
router.patch('/users/:id', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

// DELETE /users/:id → 204 No Content
router.delete('/users/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.status(204).end();  // no body on 204
});
```

```js
// Idempotency key middleware
const idempotencyStore = new Map(); // Redis in production

function idempotencyMiddleware(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key) return next();
  
  if (idempotencyStore.has(key)) {
    const cached = idempotencyStore.get(key);
    return res.status(cached.status).json(cached.body);
  }
  
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    idempotencyStore.set(key, { status: res.statusCode, body });
    return originalJson(body);
  };
  next();
}
```

---

## Real-World Examples

**Stripe**
- REST API for all payment operations. Every resource has its own URI, HTTP methods, status codes.
- Uses date-based versioning (`Stripe-Version: 2023-10-16`) — breaking changes create a new version date.
- `Idempotency-Key` on all POST requests for safe retries.
- Level 2 REST + selective HATEOAS elements.

**Twitter/X API v2**
- Level 2 REST. Resources: tweets, users, lists, spaces.
- Sparse fieldsets: `?tweet.fields=text,created_at,public_metrics` to control response size.
- Pagination via `next_token` cursor.

**Spotify Web API**
- Level 2/3 hybrid. Responses include `external_urls`, `href` (self-URL), `id`.
- Rate limiting: `X-RateLimit-Remaining`, `Retry-After` headers.
- Resource hierarchy: `/artists/{id}/albums/{id}/tracks`.

---

## Interview Cheat Sheet

**Q: What are the 6 REST constraints and why do they matter?**
A: Client-Server (separation of concerns), Stateless (each request self-contained, enables horizontal scaling), Cacheable (reduces server load, declares cache policy), Layered System (LBs, CDNs, proxies transparent to client), Uniform Interface (predictable URLs + methods for any client), Code-on-Demand (optional, JavaScript from servers). Stateless is the most impactful for scalability — no sticky sessions, any server can handle any request.

**Q: What is the Richardson Maturity Model?**
A: A scale from 0-3 measuring REST compliance. L0: single endpoint, RPC-style POST everything. L1: resources have individual URIs. L2: correct HTTP verbs + status codes — the industry standard. L3: HATEOAS, responses include hypermedia links. Most production APIs are L2. L3 is rare because clients often hardcode URLs for simplicity.

**Q: What is HATEOAS and is it worth implementing?**
A: Hypermedia As The Engine Of Application State — API responses include links describing available next actions. The client discovers workflow from the response itself, not hardcoded logic. Worth implementing when you want client-server decoupling (client doesn't need to know URL structure), workflow flexibility (server can change available actions without client code changes), or discoverability. Not worth it for most internal APIs where you control both client and server — the added complexity isn't justified.

**Q: How would you solve the N+1 problem in a REST API?**
A: Several approaches: (1) Eager loading — backend JOIN/populate: `GET /users?include=orders` returns users with order counts in one DB query. (2) Sparse fieldsets — clients specify needed fields, reducing over-fetching. (3) Batch endpoint — `POST /batch/orders` with array of user IDs, returns all orders in one call. (4) Switch to GraphQL for complex data requirements — client declares exactly what it needs. The right choice depends on how many clients have this need and whether it's a pattern (use GraphQL) or a one-off (batch endpoint).

**Q: What is the difference between PUT and PATCH?**
A: PUT replaces the entire resource with the provided representation — fields not in the request body are removed. PATCH partially updates the resource — only fields provided are changed. PUT is idempotent: replacing a resource with the same data always produces the same state. PATCH can be idempotent (set age=30) or not (increment age by 1). In practice, many APIs use PATCH for all updates because full replacement (PUT) is risky and clients rarely need to send every field.

---

## Keywords / Glossary

| Term | Definition |
|---|---|
| **REST (Representational State Transfer)** | Architectural style for distributed hypermedia systems, defined by Roy Fielding (2000). Not a protocol |
| **Resource** | Any named entity that can be identified by a URI. Documents, collections, files, services |
| **Representation** | The format of a resource in transit (JSON, XML, HTML). Separate from the resource itself |
| **Stateless** | Server holds no client session state between requests. Each request carries all necessary context |
| **HATEOAS** | Hypermedia As The Engine Of Application State — responses include links to available actions |
| **Uniform Interface** | REST constraint: consistent way to identify and manipulate resources using HTTP conventions |
| **Richardson Maturity Model** | 0-3 scale measuring REST compliance. L2 (HTTP verbs + status codes) = industry standard |
| **Idempotent** | Operation that produces the same result executed once or N times |
| **Idempotency Key** | Client-generated UUID sent with POST requests to enable safe retry without duplicating effects |
| **N+1 Problem** | Fetching a list of N resources then making N additional requests for related data |
| **Over-fetching** | API response contains more data than the client needs |
| **Under-fetching** | One API call doesn't return enough data, requiring subsequent calls |
| **BFF (Backend for Frontend)** | Dedicated API service per client type (mobile, web) to serve their exact data needs |
| **Sparse Fieldsets** | `?fields=id,name` query parameter that limits response to specified fields |
| **Content Negotiation** | Client and server agree on media type via `Accept` and `Content-Type` headers |
| **ETag** | Entity tag: version identifier for a resource. Used for conditional requests and optimistic locking |
| **Optimistic Locking** | Update only if `If-Match: <etag>` matches current version. Returns 412 on conflict |
| **Rate Limiting** | Server limits request rate per client. Communicated via `X-RateLimit-*` and `Retry-After` headers |
| **OpenAPI / Swagger** | Standard for describing REST APIs in machine-readable YAML/JSON. Used for documentation and code gen |
| **Versioning** | Strategy for evolving an API without breaking existing clients (URI, header, date-based) |
