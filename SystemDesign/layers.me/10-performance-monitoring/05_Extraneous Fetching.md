# Extraneous Fetching

## ELI5
You're building a mobile app. You ask the server "give me everything about this user" and get back a 100KB JSON object. The app uses only 3 fields. You just burned 97KB of bandwidth, battery, and user's data plan. That's extraneous fetching — fetching more data than you actually need (over-fetching) or fetching it all upfront when you only need it sometimes (under-using lazy loading).

## Analogy
Ordering the entire menu to eat just the soup. Or downloading a full encyclopedia to read one article.

---

## Core Concept
**Extraneous Fetching** has two forms:
- **Over-fetching**: Returning more fields/rows than the client needs
- **Under-fetching** (lazy-loading neglect): Loading related data even when it's rarely accessed

### The Cost Math
```
Example: User profile API
─────────────────────────────────────────────────────
What client needs:  { name, avatar }  →  0.5KB
What API returns:   full user object  →  10KB
Overfetch per req:  9.5KB

At 100M req/day:
  Wasted data:     9.5KB × 100M = 950 GB/day
  Cloud egress:    ~$2,280/month (at $0.08/GB)
  Mobile data:     ~$17/user/year (at $5/GB plans)
  Battery:         3-5× more radio transmit cycles
```

---

## Solutions

### 1. Field Projection (Database Level)
```javascript
// OVER-FETCHING: SELECT * equivalent
const user = await User.findById(userId);
// Returns all 50 fields: password_hash, created_at, internal_flags, etc.

// PROJECTED: Return only needed fields
const user = await User.findById(userId)
  .select('name avatar email');  // Mongoose field selection
// Or MongoDB projection:
const user = await db.users.findOne(
  { _id: userId },
  { projection: { name: 1, avatar: 1, email: 1 } }  // 1 = include
);
```

### 2. REST Sparse Fieldsets
```javascript
// Client requests only needed fields via query param
GET /users/123?fields=name,avatar,email

// Express implementation
app.get('/users/:id', async (req, res) => {
  const fields = req.query.fields?.split(',') || null;
  const projection = fields
    ? Object.fromEntries(fields.map(f => [f, 1]))
    : {};
  const user = await User.findById(req.params.id, projection);
  res.json(user);
});
```

### 3. GraphQL Field Selection
```graphql
# Client declares exactly what it needs — no over/under fetching
query GetUserProfile {
  user(id: "123") {
    name           # just these 3 fields
    avatar
    email
    # NO: password_hash, internal_flags, etc.
  }
}
```
```javascript
// GraphQL resolver uses projection based on requested fields
const resolvers = {
  Query: {
    user: (_, { id }, __, info) => {
      // info.fieldNodes tells you which fields were requested
      const fields = Object.keys(info.fieldNodes[0].selectionSet.selections
        .reduce((acc, s) => ({ ...acc, [s.name.value]: 1 }), {}));
      return User.findById(id).select(fields.join(' '));
    }
  }
};
```

### 4. Pagination (Don't Fetch All Records)
```javascript
// EXTRANEOUS: Load all posts upfront
const posts = await Post.find({ userId });  // could be 10,000 posts!

// PAGINATED: Load first N, fetch more on demand

// Offset-based (simple, but can show duplicates on live data):
GET /users/123/posts?page=2&limit=20

// Cursor-based (preferred for real-time/infinite scroll):
GET /users/123/posts?after=<cursor>&limit=20
// cursor = opaque pointer to last seen item (e.g., base64 of timestamp+id)
```

### 5. Lazy Loading Related Data
```javascript
// OVER-EAGER: Always load a user's 500 posts (even if page only shows profile)
const user = await User.findById(userId).populate('posts'); // N posts fetched!

// LAZY: Only load posts when explicitly requested by client
const user = await User.findById(userId);  // no posts
// Posts loaded separately on demand:
GET /users/123/posts?limit=10&cursor=...
```

---

## ASCII: Over-fetching vs Projected Response

```
OVER-FETCHING
────────────────────────────────────────────────────────
API Response: {
  id, name, avatar, email,
  password_hash,          ← never sent to client  ┐
  internal_flags,         ← UI doesn't use it      │ Wasted
  billing_tier,           ← on this screen         │  9.5KB
  created_at,             ← not displayed          │
  last_login_ip,          ← irrelevant             ┘
  ...47 more fields...
}

PROJECTED (GraphQL / sparse fieldsets)
────────────────────────────────────────────────────────
API Response: {
  name,    ← displayed in header
  avatar   ← displayed as profile pic
}  // 0.5KB — 19× smaller
```

---

## Offset vs Cursor Pagination Trade-offs

```
Offset Pagination:        Cursor Pagination:
─────────────────────     ──────────────────────────────
?page=2&limit=20          ?after=eyJpZCI6MTIzfQ&limit=20

Pros:                      Pros:
  Simple to implement        Stable — no duplicates on insert
  Jump to any page           Works with real-time data
  User knows "page 3/10"     Efficient (index seek, not offset)

Cons:                      Cons:
  Duplicates when data       Can't jump to arbitrary page
  changes between pages      Cursor is opaque to user
  Slow for large offsets     Requires cursor generation
  (OFFSET 50000 = slow)

Use when: Admin list views  Use when: Social feeds,
showing stable data         infinite scroll, live data
```

---

## MERN Developer Notes

```javascript
// Mongoose: projection in queries
const usernames = await User.find({})
  .select('name avatar')  // field projection
  .limit(20)
  .skip(page * 20);       // offset pagination

// Better: cursor pagination with MongoDB
const users = await User.find({
  _id: { $gt: lastSeenId }  // cursor is the last _id
}).limit(20).sort({ _id: 1 });

// Return cursor for next page
const cursor = users[users.length - 1]?._id;

// Lean queries (skip Mongoose document hydration — plain objects)
const users = await User.find({}).lean();  // 10-20% faster, less memory
```

---

## Real-World Examples

| Company | Problem | Fix | Result |
|---|---|---|---|
| Facebook | REST APIs returning full objects regardless of client needs | Invented GraphQL (2012, OSS 2015) | 70% payload reduction, 30% faster on 2G |
| Netflix | Overfetch on recommendation API | Falcor (predecessor to GraphQL concept) | 60% smaller responses, 40% less DB load |
| Stripe | Mobile SDK loading full charge objects | Sparse fieldsets API (`?expand=`) | 8KB→1.2KB on mobile (85% reduction) |

---

## Interview Cheat Sheet

**Q: What's the difference between over-fetching and under-fetching?**

> A: Over-fetching: API returns more data than the client needs (extra fields, full objects). Under-fetching: API returns too little, requiring multiple round trips for related data. GraphQL was designed specifically to solve both — the client declares exactly what it needs in one query.

**Q: When would you use offset pagination vs cursor pagination?**

> A: Offset (page=2&limit=20) when data is stable and users need to jump to specific pages (admin tables, search results). Cursor (`after=<cursor>`) when data changes in real-time and you need stable pagination (social feeds, notifications, infinite scroll). Cursor is more database-efficient at large offsets (OFFSET 50000 forces DB to scan 50000 rows; cursor skips directly to the index entry).

**Q: GraphQL solves over-fetching but introduces what risk?**

> A: N+1 query problem. Without DataLoader, each field in a GraphQL query can trigger a separate DB query. A query for 100 posts with their authors = 101 DB queries. Solution: DataLoader batches field resolution within one event loop tick.

**Q: A REST API returns a 50KB user object. How do you reduce it?**

> A: Short-term: add `?fields=` sparse fieldset support; apply DB projection in the route handler. Medium-term: version the API with a slimmed endpoint (`/users/:id/profile` vs `/users/:id`). Long-term: migrate to GraphQL if you have diverse clients with different data needs.

**Q: How do you detect over-fetching in production?**

> A: Monitor response payload sizes by endpoint (alert on >20% growth week-over-week). Instrument GraphQL resolvers to log which fields were requested vs. all available fields. Query your DB for column access statistics — if a column is never read, it's never queried, meaning you're selecting it unnecessarily.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **Over-fetching** | Returning more data fields or rows than the client needs |
| **Under-fetching** | Loading too little, requiring additional round trips |
| **Field projection** | DB-level SELECT for specific columns only |
| **Sparse fieldsets** | REST pattern: `?fields=name,avatar` to request only needed fields |
| **Offset pagination** | `?page=N&limit=M` — simple but can show duplicates on live data |
| **Cursor pagination** | `?after=<cursor>` — stable for real-time data, efficient for large datasets |
| **Lazy loading** | Deferring load of related data until explicitly requested |
| **Eager loading** | Loading related data upfront even when rarely needed |
| **GraphQL** | Query language where client specifies exactly which fields to return |
| **Lean query** | Mongoose `.lean()` — returns plain JS objects instead of hydrated documents |
