# MongoDB: Core Concepts & BSON

## What is MongoDB?

MongoDB is a **document-oriented NoSQL database** that stores data in **BSON** (Binary JSON) format.
Unlike relational databases with rigid schemas, MongoDB offers flexible document structures.

```javascript
// Document: Core unit in MongoDB (analogous to a row in SQL)
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  name: "John Doe",
  email: "john@example.com",
  addresses: [
    { type: "home", city: "SF", zip: "94105" },
    { type: "work", city: "NYC", zip: "10001" }
  ],
  createdAt: new Date("2024-01-01"),
  active: true,
  permissions: ["read", "write"],
  metadata: null
}
```

---

## BSON: Binary JSON

**WHAT**: How does MongoDB store and transmit data internally?

**THEORY**:
- BSON is a **binary serialization format** that supports more data types than JSON
- Every MongoDB document is encoded as BSON before storage and transmission
- BSON is more efficient than JSON: smaller file size, native type support, faster parsing
- Supports types JSON doesn't: `Date`, `ObjectId`, `Binary`, `Code`, `Timestamp`, `Regex`, `Decimal128`, `MinKey`, `MaxKey`

```javascript
// JSON only supports these types
{ name: "John", age: 30, active: true, score: 98.5, tags: ["dev"], meta: null }

// BSON adds strong typing
{
  name: String("John"),
  age: Int32(30),
  rating: Double(98.5),
  createdAt: Date("2024-01-01"),
  _id: ObjectId("507f1f77bcf86cd799439011"),
  profile: BinData(0, "...binary..."),
  code: Code("function() { return 1; }"),
  timestamp: Timestamp(1000, 2),
  pattern: RegExp("/^test/", "i"),
  decimal: Decimal128("123.45"),
  minVal: MinKey(),
  maxVal: MaxKey()
}
```

| BSON Type | JS Representation | Size | Use Case |
|-----------|-------------------|------|----------|
| String | `"text"` | Variable | Text data |
| Int32 | `42` | 4 bytes | Counters, IDs |
| Int64 | `NumberLong("9223372036854775807")` | 8 bytes | Large numbers |
| Double | `3.14` | 8 bytes | Floating point |
| Boolean | `true/false` | 1 byte | Flags |
| Date | `new Date()` | 8 bytes | Timestamps |
| Null | `null` | 0 bytes | Missing values |
| ObjectId | `ObjectId(...)` | 12 bytes | Unique document ID |
| Array | `[1, 2, 3]` | Variable | Lists |
| Object/Embedded | `{...}` | Variable | Nested documents |
| Binary | `BinData(...)` | Variable | Files, images |
| Code | `Code("func")` | Variable | JavaScript code |
| Regex | `RegExp(...)`| Variable | Pattern matching |

---

## Collections & Databases

```javascript
// Collections: analogous to tables in SQL
db.users              // collection for users
db.orders             // collection for orders
db.products           // collection for products

// Databases: groups of collections
use shop_database     // switch to shop database
show dbs              // list all databases
show collections      // list collections in current db
```

**Key Differences from SQL**:

| SQL | MongoDB |
|-----|---------|
| Database | Database |
| Table | Collection |
| Row | Document |
| Column | Field |
| Schema | Schema validation (optional) |
| Constraints | Validation rules (optional) |
| Foreign Key | Reference (ObjectId) |

---

## ObjectId: MongoDB's Default Primary Key

**WHAT**: How does MongoDB generate unique IDs for documents?

**THEORY**:
- `ObjectId` is a **12-byte BSON type** that combines timestamp, machine ID, process ID, and counter
- Designed for **distributed systems** where auto-incrementing integers don't work
- **Sortable**: newer ObjectIds sort after older ones (timestamp-based)
- **Unique**: collision probability is extremely low even across distributed nodes
- **Timezone-aware**: contains UTC timestamp information

```
ObjectId Structure (12 bytes):
┌─────────────────────────────────────────────┐
│ Timestamp │ Machine │ PID │ Counter │
│ 4 bytes   │ 3 bytes │ 2   │ 3 bytes │
│           │         │ bytes │       │
└─────────────────────────────────────────────┘

Example: 507f1f77bcf86cd799439011
- 507f1f77     = Unix timestamp (Jan 1, 2009, 16:28:39 UTC)
- bcf86c       = Machine identifier
- d799         = Process ID
- 439011       = Random increment counter
```

```javascript
// Extract information from ObjectId
const id = ObjectId("507f1f77bcf86cd799439011");

id.getTimestamp();       // Date("2009-01-01T16:28:39.000Z")
id.toString();           // "507f1f77bcf86cd799439011"
id instanceof ObjectId;  // true

// Create ObjectId from specific timestamp
new ObjectId(Math.floor(Date.now() / 1000));

// Query documents created after a specific date
db.users.find({
  _id: { $gt: ObjectId(Math.floor(new Date("2024-01-01") / 1000)) }
});
```

---

## Flexible Schema: The MongoDB Advantage

**WHAT**: What does "flexible schema" mean, and how does it differ from SQL?

**THEORY**:
- MongoDB documents in the **same collection can have different structures**
- Allows **schema evolution without downtime** migrations
- Perfect for **polyglot data** (variation in document shape)
- Downside: requires **stronger application-level validation**
- Best practice: use **schema validation rules** to prevent chaos

```javascript
// Same collection, different document structures—all valid
db.users.insertMany([
  // User with address
  {
    _id: 1,
    name: "Alice",
    email: "alice@example.com",
    address: { city: "SF", country: "USA" }
  },
  // User without address
  {
    _id: 2,
    name: "Bob",
    email: "bob@example.com"
  },
  // User with extra fields
  {
    _id: 3,
    name: "Charlie",
    email: "charlie@example.com",
    phone: "+1-555-0123",
    preferences: { theme: "dark", notifications: true }
  }
]);

// SQL would require schema modification for each change
// MongoDB handles it automatically
```

---

## Schema Validation (Optional but Recommended)

**WHAT**: How do I enforce structure in MongoDB despite flexible schemas?

**THEORY**:
- **Schema validation** uses JSON Schema to define acceptable document structure
- Applied at **collection level** when documents are written
- Validation can be **updated without downtime**
- Supports **conditional validation** (validate only if field exists)
- Can have **different validation levels** (strict, moderate)

```javascript
// Create collection with schema validation
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "name"],
      properties: {
        _id: { bsonType: "objectId" },
        name: {
          bsonType: "string",
          minLength: 1,
          maxLength: 100
        },
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
        },
        age: {
          bsonType: "int",
          minimum: 0,
          maximum: 150
        },
        address: {
          bsonType: "object",
          properties: {
            street: { bsonType: "string" },
            city: { bsonType: "string" },
            country: { bsonType: "string" }
          },
          additionalProperties: false
        },
        tags: {
          bsonType: "array",
          items: { bsonType: "string" }
        }
      },
      additionalProperties: false
    }
  },
  validationAction: "error",  // error or warn
  validationLevel: "strict"   // strict or moderate (moderate ignores pre-existing invalid docs)
});

// This insert will FAIL validation
db.users.insertOne({
  email: "john@example.com",
  // missing required "name" field
  age: "not a number"  // should be int
});
// Error: Document failed validation

// This insert will SUCCEED
db.users.insertOne({
  name: "John Doe",
  email: "john@example.com",
  age: 30,
  address: {
    street: "123 Main St",
    city: "SF",
    country: "USA"
  },
  tags: ["developer", "aws"]
});
```

---

## Embedded vs Reference: Document Design Philosophy

**WHAT**: When should I embed documents vs reference other documents?

**THEORY**:
- **Embedding**: nesting related data within a document (denormalization) → fewer queries, larger documents
- **Reference**: storing ObjectId pointing to another document (normalization) → smaller documents, more queries
- Trade-off: **query simplicity vs storage efficiency and update consistency**
- Typical guideline: **embed if relationship is 1:1 or 1:few, reference if 1:many or many:many**

```javascript
// EMBEDDING approach: order contains full customer and item details
db.orders.insertOne({
  _id: ObjectId(),
  orderNumber: "ORD-001",
  customer: {
    _id: ObjectId("507f1f77bcf86cd799439011"),
    name: "John Doe",
    email: "john@example.com"
  },
  items: [
    { productId: "PROD-100", name: "Laptop", quantity: 1, price: 999.99 },
    { productId: "PROD-101", name: "Mouse", quantity: 2, price: 25.00 }
  ],
  total: 1049.99,
  createdAt: new Date()
});

// REFERENCE approach: order references customer and items
db.orders.insertOne({
  _id: ObjectId(),
  orderNumber: "ORD-001",
  customerId: ObjectId("507f1f77bcf86cd799439011"),
  itemIds: [ ObjectId("..."), ObjectId("...") ],
  total: 1049.99,
  createdAt: new Date()
});
// Must do lookups to get customer/item details

// HYBRID approach: embed what's queried together, reference the rest
db.orders.insertOne({
  _id: ObjectId(),
  orderNumber: "ORD-001",
  customer: { name: "John Doe", email: "john@example.com" },
  customerId: ObjectId("507f1f77bcf86cd799439011"),
  items: [
    { productId: ObjectId("..."), quantity: 1, price: 999.99 }
  ],
  createdAt: new Date()
});
```

**Embedding Guidelines (for experienced engineers)**:
- Embed if 1:1 or data is always queried together
- Embed if array size is small/bounded (< 1000 items, < 16 MB document)
- Reference if 1:many, many:many, or data is queried separately
- Reference if document would exceed 16 MB limit
- Consider **eventual consistency** if using references

---

## Time Complexity for CRUD Operations

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Insert | O(1) | Append-only to collection |
| Find (no index) | O(n) | Collection scan (COLLSCAN) |
| Find (indexed) | O(log n) | B-tree index lookup |
| Update | O(n) if no index, O(log n) if indexed | Depends on query |
| Delete | O(n) if no index, O(log n) if indexed | Depends on query |
| Aggregate | O(n) per stage | Pipeline execution |
