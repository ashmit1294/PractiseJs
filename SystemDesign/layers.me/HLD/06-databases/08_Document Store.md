# T08 — Document Store

---

## 1. ELI5

A document store is like a filing cabinet for folders. Each folder (document) can hold whatever papers (fields) you want — some folders have tax forms, others have photos, others have letters. Unlike a spreadsheet where every row must have the exact same columns, each folder can look completely different.

And when you pull out a folder, you get EVERYTHING in it at once — no need to go to five other cabinets to assemble the full picture. The document is self-contained.

---

## 2. Analogy

**JSON-Powered ID Card vs SQL Table**

Think of a hotel registration system:
- **SQL**: Every guest fills out the EXACT same form (name, address, phone, passport, credit card). No extra fields allowed.
- **Document store**: Each guest's dossier is a folder with whatever info is relevant to them. Business guests have a company invoice section. Family guests have extra beds and crib preferences. International guests have visa information. The folder adapts to the person.

Document stores solve the **object-relational impedance mismatch** — your JavaScript object `{ user: { address: { city: ..., country: ... } } }` maps directly to a BSON document. No ORM gymnastics needed.

---

## 3. Core Concept

### What is a Document Store?

A document store persists semi-structured documents (JSON, BSON, XML) as the primary unit of storage. Each document is self-contained, schema-flexible, and can contain nested objects and arrays.

```
SQL Table (rigid):
┌──────────┬────────┬───────────┬─────────┬────────────┐
│ user_id  │ name   │ street    │ city    │ country    │
├──────────┼────────┼───────────┼─────────┼────────────┤
│ 1        │ Alice  │ 123 Oak   │ NYC     │ USA        │
│ 2        │ Bob    │ NULL      │ London  │ UK         │
│ 3        │ Carol  │ NULL      │ NULL    │ NULL       │
│ ...      │ ...    │ ...       │ ...     │ ...        │
└──────────┴────────┴───────────┴─────────┴────────────┘
Every row same structure. Many NULLs for optional fields.

Document Store (flexible):
{ _id: "1", name: "Alice", address: { street: "123 Oak", city: "NYC" } }
{ _id: "2", name: "Bob", address: { city: "London" }, isPremium: true }
{ _id: "3", name: "Carol" }
Each document has only what it needs. No NULLs. No schema changes needed.
```

### Object-Relational Impedance Mismatch — Eliminated

```javascript
// JavaScript object:
const order = {
  id: "order_123",
  user: { id: "user_456", name: "Alice" },
  items: [
    { productId: "prod_1", name: "Laptop", qty: 1, price: 999.99 },
    { productId: "prod_2", name: "Mouse",  qty: 2, price: 29.99 }
  ],
  shipping: { address: "123 Oak St", city: "NYC", method: "express" },
  total: 1059.97
};

// SQL: needs 4 tables + JOIN to reconstruct this object
//   orders + order_items + users + shipping_addresses

// MongoDB: Store AS-IS, retrieve AS-IS
await db.orders.insertOne(order);
const result = await db.orders.findOne({ id: "order_123" });
// result == order (one round trip, no JOIN)
```

---

## 4. BSON — Binary JSON (MongoDB's Wire Format)

```
JSON (text):
  { "name": "Alice", "age": 30 }
  → Parsing: must scan every character to find field boundaries
  → Size check: must read entire string

BSON (binary):
  ┌─────────────────────────────────────────────────────────────┐
  │ 4-byte doc length │ type(05) │ "name\0" │ 5 bytes │ "Alice" │
  │                   │ type(10) │ "age\0"  │ 4 bytes │ 30 (int)│
  │ EOD(00)           │                                          │
  └─────────────────────────────────────────────────────────────┘
  
Benefits:
  → 4-byte length prefix → skip field without reading it (O(1) seek)
  → Native types: int32, int64, double, datetime, ObjectId, binary
  → Ordered: fields always in same order → predictable parsing
  → Faster than JSON for machine-to-machine communication
  
Tradeoffs:
  → Not human-readable like JSON
  → Slightly larger than JSON for small documents (overhead from type bytes)
```

---

## 5. Document Store Indexing

### Single-Field Index

```javascript
// Index on top-level field
db.users.createIndex({ email: 1 })
// → B-tree: O(log N) lookup for exact email match

// Range query uses B-tree efficiently
db.products.find({ price: { $gte: 10, $lte: 50 } })
// → With index on price: B-tree range scan
```

### Dot Notation Index (Nested Fields)

```javascript
// Index on nested field using dot notation
db.users.createIndex({ "address.city": 1 })

// Query uses nested field index
db.users.find({ "address.city": "NYC" })
// → Uses index → O(log N) not O(N) collection scan
```

### Multi-Key Index (Arrays)

```javascript
// Index on array field → MongoDB creates index entry per array element
db.posts.createIndex({ tags: 1 })

// A post with tags: ["react", "node", "mongodb"]
// Creates 3 index entries: tags:"react", tags:"node", tags:"mongodb"
// Allows efficient lookup by any tag
db.posts.find({ tags: "react" })
// → Index scan on "react" → finds only posts tagged "react"
// ⚠️ Multi-key indexes can't be used for compound index if BOTH fields are arrays
```

### Text Index (Full-Text Search)

```javascript
// Create text index on content fields
db.articles.createIndex({ title: "text", content: "text" })

// Full-text search
db.articles.find({ $text: { $search: "javascript promises async" } })
// → Tokenizes, stems, searches inverted index
// ⚠️ MongoDB text search is basic — use Elasticsearch for production search
```

---

## 6. ASCII Architecture: MongoDB Internals

```
                         ┌─────────────────────────────┐
                         │         mongod process        │
                         │                              │
                         │  ┌───────────────────────┐  │
                         │  │   WiredTiger Engine    │  │
                         │  │                        │  │
  WRITE ──────────────► │  │ ┌──────────────────┐  │  │
  {_id:1, name:"Alice"} │  │ │  Journal (WAL)   │  │  │
                         │  │ │  128MB segments  │  │  │
                         │  │ └─────────┬────────┘  │  │
                         │  │           │ checkpoint │  │
                         │  │ ┌─────────▼────────┐  │  │
                         │  │ │  Data Files       │  │  │
                         │  │ │  (B-tree pages)   │  │  │
                         │  │ └──────────────────┘  │  │
                         │  │                        │  │
                         │  │  Buffer Pool (RAM)     │  │
                         │  │  60% of system RAM     │  │
                         │  └───────────────────────┘  │
                         └─────────────────────────────┘
                         
MongoDB WiredTiger uses B-trees (not LSM like Cassandra)
→ Better read performance for random lookups
→ Slightly worse sequential write performance vs LSM
→ MVCC: Multiple Versions for concurrent reads/writes without locks
```

---

## 7. MongoDB CRUD Performance Model

```
Single-document lookup by _id (primary key):
  Cost: 1 B-tree traversal = O(log N) = 1–3ms for 100M docs

Query with secondary index:
  Cost: 1 index B-tree + N heap fetches = 2–10ms
  
Query without index (collection scan):
  Cost: O(N) = scans ALL documents
  For 100M docs → seconds/minutes → always add indexes for frequent queries

Aggregation pipeline ($lookup / JOIN):
  $lookup performs subquery per matched document
  N matched × M subquery = O(N×M) → watch for large N
  
  // BAD: $lookup on 1M documents
  db.orders.aggregate([
    { $match: { createdAt: { $gte: last30Days } } },  // 500K documents
    { $lookup: { from: "users", localField: "userId", ... } }  // 500K lookups
  ]);
  // → 500K × 1 = 500K secondary lookups → 5–10 seconds
  
  // GOOD: Denormalize userName into orders at write time → 0 lookups
```

---

## 8. Schema Design Principles

### Embed vs Reference

```javascript
// EMBED (denormalize) when:
// - Read-heavy: always fetch together
// - 1:1 or 1:few relationship
// - Sub-document is small (<1MB total doc size limit)

const blogPost = {
  _id: ObjectId(),
  title: "Intro to MongoDB",
  author: { id: "u1", name: "Alice", avatar: "/alice.jpg" },  // embedded
  tags: ["mongodb", "databases"],                               // embedded array
  commentCount: 47,                                              // precomputed
  topComment: { userId: "u2", text: "Great post!", likes: 23 } // preview embed
};

// REFERENCE when:
// - Data is large or changes independently
// - 1:many with unbounded growth (add LIMIT to embed rule)
// - Data is shared across many documents

const order = {
  _id: ObjectId(),
  userId: ObjectId("u1"),      // ← REFERENCE to user (not embedded)
  // user can change their address, name, payment methods independently
  productId: ObjectId("p1"),   // ← REFERENCE to product
  quantity: 2,
  priceAtPurchase: 49.99       // ← SNAPSHOT (not reference) for auditing
};
```

### Document Size Rule

```
MongoDB max document size: 16MB (BSON limit)
Practical guideline:
  < 1KB: session/cache documents (Redis preferred, but OK)
  1KB–100KB: typical user profiles, posts, orders
  100KB–1MB: rich content with embedded media references
  1MB–16MB: possible but avoid; consider GridFS for binary data
  
Hot document rule:
  Frequently accessed documents should fit in working set (RAM)
  If 1M documents accessed per day × 10KB avg = 10GB working set
  Ensure DB server has ≥ 10GB RAM (or 60% of your data size, whichever smaller)
```

---

## 9. Math & Formulas

### Index Memory Estimate

$$\text{index size} \approx \text{unique\_values} \times \text{avg\_key\_size} \times 1.5$$

For `email` index on 100M users, avg email 30 bytes:
$$= 100M \times 30 \times 1.5 = 4.5\text{ GB}$$

Indexes must fit in RAM for good performance. If indexes exceed RAM, paging = slow.

### Write Amplification (with Indexes)

$$\text{total writes} = 1 \text{ (document)} + N_{\text{indexes}} \text{ (index updates)}$$

For 5 indexes on a collection: each INSERT = 6 B-tree leaf writes minimum.

### $lookup Cost

$$\text{cost} = O(N_{\text{matched}} \times \log M_{\text{foreign}})$$

Where $N_\text{matched}$ = matched docs from first stage, $M_\text{foreign}$ = foreign collection size.

---

## 10. MERN Stack Dev Notes

### Mongoose Schema Design Patterns

```javascript
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Product catalog — flexible attributes
const productSchema = new Schema({
  sku:        { type: String, required: true, unique: true },
  name:       { type: String, required: true },
  category:   { type: String, required: true, index: true },
  price:      { type: Number, required: true, min: 0 },
  attributes: Schema.Types.Mixed, // Flexible: { color, size } for clothing; { RAM, CPU } for electronics
  tags:       [String],           // Multi-key index candidate
  createdAt:  { type: Date, default: Date.now, index: true }
});

// Compound index for common query: "show me electronics under $500 sorted by newest"
productSchema.index({ category: 1, price: 1, createdAt: -1 });

// Index tags array for "show me products tagged 'wireless'"
productSchema.index({ tags: 1 });

const Product = mongoose.model('Product', productSchema);

// Efficient query using compound index
const products = await Product.find({
  category: 'electronics',
  price: { $lte: 500 }
})
.sort({ createdAt: -1 })
.limit(20)
.select('sku name price tags')   // projection: fewer bytes returned
.lean();                          // lean(): skip Mongoose overhead → 40% faster reads
```

### Aggregation Pipeline Patterns

```javascript
// Analytics: sales per category in last 30 days
const results = await Order.aggregate([
  // Stage 1: Filter (uses index on createdAt)
  { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 86400 * 1000) } } },
  
  // Stage 2: Unwind items array (one doc per line item)
  { $unwind: '$items' },
  
  // Stage 3: Group by category
  { $group: {
      _id: '$items.category',
      totalRevenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
      orderCount:   { $sum: 1 }
  }},
  
  // Stage 4: Sort by revenue
  { $sort: { totalRevenue: -1 } },
  
  // Stage 5: Take top 10
  { $limit: 10 }
]);
// → Efficient pipeline: filter first (reduces dataset), then aggregate
```

### Common Pitfalls to Avoid

```javascript
// ❌ PITFALL 1: Missing index on query
await User.find({ email: 'alice@example.com' }); // Collection scan if no index!
// Fix: { email: { type: String, unique: true } } in schema → auto-indexes unique

// ❌ PITFALL 2: Fetching entire document when only need one field
const user = await User.findById(userId); // Fetches all fields including large bio
// Fix: 
const user = await User.findById(userId).select('name email avatar'); // projection

// ❌ PITFALL 3: Not using lean() for read-only operations
const posts = await Post.find({}).lean(); // Returns plain objects, not Mongoose docs
// 40% faster for read-heavy routes where you don't call .save()

// ❌ PITFALL 4: Growing unbounded arrays
// DON'T: { comments: [{ text, userId, ts }] }  // grows forever
// DO: Separate comments collection with { postId, text, userId, ts }
//     Or embed only last N comments as preview + store rest separately
```

---

## 11. Real-World Case Studies

### Facebook TAO — User Profiles (Document-Like)

```
Facebook built TAO (The Associations and Objects) — a custom document store

Object = node with properties (user profile, post, photo, page)
Each object: { id, type, data: { flexible key-value pairs } }
Sharded by object_id (consistent hashing)

User profile object:
  { id: "uid123", type: "user", data: {
      name: "Alice", birthday: "...", hometown: "NYC",
      work: [{ id: "fb", title: "Engineer" }]
  }}

Read optimization:
- Memcache layer in front → serve from RAM
- Replica per region → local reads
- Write-through on profile update

Scale: 500M+ objects read/sec during peak
      1B+ objects stored
```

### Spotify — Music Catalog

```
Problem: Each track/album/artist has different metadata structure
  Tracks: { title, duration, explicit, isrc, artists[], album }
  Albums: { title, release_date, label, tracks[], genres[] }
  Artists: { name, genres[], bio, top_tracks[], related_artists[] }
  
Why MongoDB:
  Flexible schema: podcasts added later (duration, episodes[], host) 
  → no migration, just new document structure
  
  Multi-key index on genres: 
    db.artists.createIndex({ genres: 1 })
    db.artists.find({ genres: "indie-pop" })
    → 1 index → matches all artists with "indie-pop" in genres array
  
  Nested indexing:
    db.tracks.createIndex({ "artists.id": 1 })
    → Find all tracks by artist even though artists is array of objects
    
Scale: 500M+ tracks, albums, artists in catalog
       Replicated across regions for low-latency reads
```

### Dropbox — File Metadata

```
Problem: Each file has different metadata depending on type
  Documents:  { name, size, mimeType, lastModified, wordCount, pages }
  Images:     { name, size, dimensions, exifData: { camera, location } }
  Videos:     { name, size, duration, resolution, codec }
  
Hierarchical path structure:
  { path: "/Work/Projects/Q4-Report.pdf", parentId: "folder_xyz", ... }
  
  db.files.createIndex({ "parent_id": 1, "name": 1 })
  → "List files in this folder" → compound index scan
  
  db.files.createIndex({ "owner_id": 1, "path": 1 })
  → "Find file by path for user" → efficient lookup
  
  db.files.createIndex({ "owner_id": 1, "modified_at": -1 })
  → "Recent files" tab → sorted range scan
```

---

## 12. Interview Cheat Sheet

**Q: What is a document store and how is it different from a relational DB?**
> Document stores persist semi-structured documents (JSON/BSON) as the unit of storage. Unlike relational DBs: (1) no fixed schema — each document can have different fields; (2) related data is embedded in one document instead of spread across tables; (3) no need for JOINs for self-contained queries; (4) horizontal scaling via sharding on document ID. Trade-off: no native multi-collection ACID transactions (MongoDB 4.0+ supports them with overhead).

**Q: When would you choose MongoDB over PostgreSQL?**
> When: schema is flexible and evolving (product attributes, user-generated content), data model is document-centric (post with embedded comments preview), you need horizontal scaling >10TB, access patterns rarely require cross-collection JOINs. Avoid MongoDB when you need complex multi-table ACID transactions, reporting queries with GROUP BY across many collections, or data has highly relational structure.

**Q: What is the embed vs reference decision in MongoDB schema design?**
> Embed (denormalize) when data is always read together, the sub-document is small, and it's a 1:1 or bounded 1:few relationship. Reference when data changes independently, the array could grow unbounded, or data is shared across many documents. For financial records: always snapshot prices at order time (not reference) — prices change but historical orders must preserve original values.

**Q: What is the 16MB document limit and how do you handle it?**
> MongoDB limits individual documents to 16MB (BSON). Solutions: (1) Don't embed entire comment threads — use a separate comments collection. (2) For binary data (files, images), use GridFS which splits files into 255KB chunks. (3) For growing arrays (activity feeds), cap at N items and archive older entries to a separate collection.

---

## 13. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Document** | Self-contained JSON/BSON record — the primary unit of storage |
| **BSON** | Binary JSON: typed, binary-encoded format with 4-byte length prefix |
| **Schema-Flexible** | Each document can have different fields without migration |
| **ObjectId** | MongoDB 12-byte unique ID (timestamp + machine + PID + counter) |
| **Dot Notation** | Path to nested field: `"address.city"` for `{ address: { city: "NYC" } }` |
| **Multi-key Index** | Index on array field — creates one entry per array element |
| **Aggregation Pipeline** | MongoDB query stages ($match, $group, $sort, $lookup) |
| **$lookup** | MongoDB JOIN equivalent — subquery per document; use sparingly |
| **lean()** | Mongoose option: return plain objects (not Mongoose docs) — 40% faster |
| **Working Set** | Portion of data actively accessed — should fit in RAM |
| **Projection** | Specify which fields to return, reducing data transfer |
| **WiredTiger** | MongoDB's default storage engine since 3.2; uses B-trees + MVCC |
| **MVCC** | Multi-Version Concurrency Control: readers don't block writers |
| **GridFS** | MongoDB spec for storing files >16MB as chunks in two collections |
| **Impedance Mismatch** | Friction between object-oriented code and relational tables |
