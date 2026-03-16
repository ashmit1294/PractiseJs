# Data Modeling & Schema Design

## The MongoDB Data Modeling Methodology

**WHAT**: How do you design schemas for MongoDB applications?

**THEORY**:
- MongoDB design focuses on **access patterns** (how you query/update data) rather than normalization
- Start by **mapping application relationships** (1:1, 1:few, 1:many, many:many)
- **Embed for speed**, **reference for consistency**
- Consider **document size limits** (16 MB max) and **growth patterns**
- Use **schema validation** as guardrails, not rigid constraints

```javascript
// Step 1: Identify access patterns

// E-commerce app queries:
// Q1: Get order with all customer details
// Q2: Get customer's recent orders
// Q3: Update order status
// Q4: Analyze revenue by customer (infrequent)
// Q5: Check customer loyalty (frequency > 10 orders in year)
```

---

## Design Patterns for Common Relationships

### Pattern 1: One-to-One (1:1)

```javascript
// User has exactly one profile
// BEST: Embed profile in user document

db.users.insertOne({
  _id: ObjectId(),
  email: "john@example.com",
  profile: {
    firstName: "John",
    lastName: "Doe",
    bio: "Full stack developer",
    avatar: "https://..."
  },
  createdAt: new Date()
});

// Query: Get user profile
db.users.findOne({ email: "john@example.com" })
// Single document read, always together
```

**Time Complexity**: O(1) or O(log n) with index

---

### Pattern 2: One-to-Few (1:few)

```javascript
// User has 2-5 addresses (bounded, small array)
// BEST: Embed addresses in user document

db.users.insertOne({
  _id: ObjectId(),
  email: "john@example.com",
  name: "John Doe",
  addresses: [
    {
      _id: ObjectId(),
      type: "home",
      street: "123 Main St",
      city: "SF",
      country: "USA",
      primary: true
    },
    {
      _id: ObjectId(),
      type: "work",
      street: "456 Business Ave",
      city: "SF",
      country: "USA",
      primary: false
    }
  ]
});

// Query: Find users with primary address in SF
db.users.find({ "addresses.city": "SF", "addresses.primary": true })

// Add new address
db.users.updateOne(
  { _id: userId },
  { $push: { addresses: { type: "vacation", city: "NYC" } } }
);

// Remove address
db.users.updateOne(
  { _id: userId },
  { $pull: { addresses: { type: "vacation" } } }
);
```

**Trade-off**: Document size grows with addresses; for 100+ addresses, consider referencing

**Time Complexity**: O(log n) to find user, O(1) to access addresses

---

### Pattern 3: One-to-Many (1:many)

```javascript
// SCENARIO: Blog has 1000+ comments
// PROBLEM: Embedding 1000 comments → 16 MB document limit
// SOLUTION: Reference approach (store commentIds)

// Approach 1: ARRAY OF IDs (lightweight)
db.blogs.insertOne({
  _id: ObjectId(),
  title: "MongoDB Best Practices",
  content: "...",
  authorId: ObjectId("..."),
  commentIds: [
    ObjectId("..."), ObjectId("..."), ...  // array of 1000+ IDs
  ],
  commentCount: 1523,
  createdAt: new Date()
});

// Query: Get blog post
const blog = db.blogs.findOne({ _id: blogId });

// Query: Get all comments for a blog (need separate lookup)
const comments = db.comments.find({ _id: { $in: blog.commentIds } });

// Add comment
db.blogs.updateOne(
  { _id: blogId },
  {
    $push: { commentIds: newCommentId },
    $inc: { commentCount: 1 }
  }
);

// Approach 2: DOUBLE-SIDED REFERENCE (maintain consistency)
db.comments.insertOne({
  _id: ObjectId(),
  blogId: ObjectId("..."),
  content: "Great post!",
  authorId: ObjectId("..."),
  createdAt: new Date()
});

// Query: Get all comments for a blog
db.comments.find({ blogId: blogId });

// This approach is cleaner but requires discipline
// (updates on either side must be coordinated)
```

**Time Complexity**: O(log n) to find blog, O(m) to find m comments

---

### Pattern 4: Many-to-Many (many:many)

```javascript
// SCENARIO: Students take many courses, courses have many students
// BEST: Separate "enrollment" collection to track relationship

db.students.insertOne({
  _id: ObjectId("student1"),
  name: "Alice"
});

db.courses.insertOne({
  _id: ObjectId("course1"),
  title: "MongoDB Advanced"
});

// JUNCTION collection: tracks relationship
db.enrollments.insertOne({
  _id: ObjectId(),
  studentId: ObjectId("student1"),
  courseId: ObjectId("course1"),
  grade: "A",
  enrolledAt: new Date()
});

// Query: What courses is Alice enrolled in?
const courses = db.enrollments
  .find({ studentId: ObjectId("student1") })
  .toArray()
  .map(e => e.courseId);

const courseDetails = db.courses.find({ _id: { $in: courses } }).toArray();

// Alternative: Embed array of course references (if few courses)
db.students.insertOne({
  _id: ObjectId("student1"),
  name: "Alice",
  enrollments: [
    { courseId: ObjectId("course1"), grade: "A", enrolledAt: new Date() },
    { courseId: ObjectId("course2"), grade: "B", enrolledAt: new Date() }
  ]
});

// Query: What courses with grade A?
db.students.findOne(
  { _id: ObjectId("student1"), "enrollments.grade": "A" },
  { projection: { "enrollments.$": 1 } }  // returns only matching enrollment
);
```

**Time Complexity**: O(log n) to find relationship, then O(log n) per course lookup

---

## Denormalization: When to Break SQL Rules

**WHAT**: MongoDB design often denormalizes; when is duplication acceptable?

**THEORY**:
- **Denormalization** (storing the same data in multiple places) is acceptable in MongoDB for **read performance**
- Key insight: **eventual consistency** is fine for non-critical data
- Typical approach: store **frequently-queried data alongside related documents**
- Downside: **update complexity** (must update in multiple places)
- Best-use: denormalize data that **changes rarely** or **consistency delays are acceptable**

```javascript
// Example: E-commerce order contains customer name/email
// Even though it's in customers collection

db.orders.insertOne({
  _id: ObjectId(),
  orderNumber: "ORD-001",
  customerId: ObjectId("..."),
  // Denormalized customer info (for fast query, print, analysis)
  customerName: "John Doe",
  customerEmail: "john@example.com",
  items: [
    { productId: ObjectId("..."), name: "Laptop", price: 999.99, quantity: 1 }
  ],
  total: 999.99,
  createdAt: new Date()
});

// Why denormalize?
// Q: Generate 100 invoices (need customer name/email instantly)
// Without denorm: must lookup customer for each order (100+ queries)
// With denorm: single collection scan (1 query)

// Downside: if customer changes email
// Must update all orders (eventual consistency delay acceptable)

// Update customer email
db.customers.updateOne(
  { _id: customerId },
  { $set: { email: "john.newemail@example.com" } }
);

// Asynchronously update all orders (eventually)
db.orders.updateMany(
  { customerId: customerId },
  { $set: { customerEmail: "john.newemail@example.com" } }
);

// During the gap: orders show old email (eventual consistency)
// This is ACCEPTABLE for non-critical data
```

**Denormalization Checklist for Experienced Teams**:
- ✅ DO denormalize: name, email (changes rarely, non-critical)
- ✅ DO denormalize: price, quantity in order items (historical snapshot)
- ❌ DON'T denormalize: account balance (must be consistent)
- ❌ DON'T denormalize: inventory stock (must be real-time accurate)
- ❌ DON'T denormalize: payment status (critical consistency)

---

## Polymorphic Documents: Single Collection, Multiple Schemas

**WHAT**: How do I store different document types in one collection?

**THEORY**:
- MongoDB supports **polymorphic documents** (same collection, different schemas)
- Use **discriminator pattern** (a field indicating document type)
- Useful for: events, notifications, payments (different types)
- Validation can enforce schema per type

```javascript
// Single "notifications" collection, multiple types

// Email notification
db.notifications.insertOne({
  _id: ObjectId(),
  type: "email",  // discriminator
  userId: ObjectId("..."),
  subject: "Order confirmed",
  body: "Your order #123 is confirmed",
  from: "orders@shop.com",
  createdAt: new Date()
});

// SMS notification
db.notifications.insertOne({
  _id: ObjectId(),
  type: "sms",  // discriminator
  userId: ObjectId("..."),
  message: "Order #123 shipped",
  phone: "+1-555-0123",
  provider: "Twilio",
  createdAt: new Date()
});

// Push notification
db.notifications.insertOne({
  _id: ObjectId(),
  type: "push",  // discriminator
  userId: ObjectId("..."),
  title: "New order",
  body: "Click here to view",
  action: "ORDER_DETAIL_123",
  device: "iOS",
  createdAt: new Date()
});

// Query all notifications for user
db.notifications.find({ userId: userId });

// Query only email notifications
db.notifications.find({ userId: userId, type: "email" });

// Aggregation: group by type
db.notifications.aggregate([
  { $match: { userId: userId } },
  { $group: { _id: "$type", count: { $sum: 1 } } }
]);
// Result: { _id: "email", count: 5 }, { _id: "sms", count: 3 }, ...
```

---

## Growing Arrays: Avoiding 16 MB Limit

**WHAT**: What's the best practice when array grows over time?

**THEORY**:
- Documents have **16 MB size limit**
- **Growing arrays** (comments, logs, transactions) can exceed limit
- Solutions: **bucketing pattern** or **separate collection**
- **Bucketing**: split large arrays into smaller chunks, store references

```javascript
// PROBLEM: Comments array grows too large

// SOLUTION 1: Bucketing pattern (slice array into buckets)
db.comments.insertOne({
  _id: ObjectId(),
  bucketSize: 1000,
  buckets: [
    {
      sequenceNumber: 0,
      comments: [
        { text: "Comment 1", author: "user1" },
        { text: "Comment 2", author: "user2" },
        // ... up to 1000 comments, each ~300 bytes = ~300 KB
      ]
    },
    {
      sequenceNumber: 1,
      comments: [ /* next 1000 comments */ ]
    }
  ]
});

// Query: Get comments 1000-1100
const bucket = db.comments.findOne({
  _id: blogId,
  "buckets.sequenceNumber": 1
});
const comments = bucket.buckets[0].comments.slice(0, 100);

// SOLUTION 2: Separate collection (simpler for many-to-many)
db.blog_comments.insertOne({
  _id: ObjectId(),
  blogId: ObjectId("..."),
  text: "Great post!",
  author: ObjectId("..."),
  createdAt: new Date()
});

// Query: Get paginated comments
db.blog_comments
  .find({ blogId: blogId })
  .sort({ createdAt: -1 })
  .skip(1000)
  .limit(50);
```

**Preference**: Use separate collection for unbounded arrays (simpler pagination, indexing)

---

## Time Complexity: Schema Design Impact

| Scenario | Complexity | Notes |
|----------|-----------|-------|
| Find by indexed field | O(log n) | B-tree index |
| Embedded document query | O(log n) | Index on parent |
| Array element query | O(log n) | Multikey index |
| Many-to-many join | O(m * log n) | m is relationship count |
| Aggregation pipeline | O(n) | Full scan per stage (optimized if indexed early) |
