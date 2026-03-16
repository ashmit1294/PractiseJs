# Aggregation Pipeline: Express Analytics at Scale

## What is Aggregation Pipeline?

**WHAT**: How do I transform and analyze documents at database level?

**THEORY**:
- **Aggregation pipeline** processes documents through a series of stages
- Each stage transforms, filters, or reshapes data
- **Executed server-side** (efficient, reduces network traffic)
- **Better than client-side processing** for large datasets (1M+ documents)
- Stages: `$match`, `$group`, `$sort`, `$project`, `$lookup`, `$unwind`, `$sample`, etc.

```javascript
// Pipeline = multiple stages chained together
db.orders.aggregate([
  { $match: { status: "pending" } },       // Stage 1: Filter
  { $group: { _id: "$customerId", total: { $sum: "$amount" } } },  // Stage 2: Aggregate
  { $sort: { total: -1 } },                // Stage 3: Sort
  { $limit: 10 }                           // Stage 4: Top 10
]);

// Execution order: MATCH → GROUP → SORT → LIMIT
// Each stage operates on output of previous stage
```

---

## Core Aggregation Stages

### $match: Filter Documents

```javascript
// Equivalent to db.find()
db.orders.aggregate([
  { $match: {
      status: "completed",
      createdAt: { $gt: new Date("2024-01-01") }
    }
  }
]);

// Best practice: $match early in pipeline (reduces documents)
// $match uses indexes!
```

### $group: Aggregation

```javascript
// Group by field, calculate aggregates
db.orders.aggregate([
  { $group: {
      _id: "$customerId",           // Group by customerId
      totalSpent: { $sum: "$amount" },
      averageOrderValue: { $avg: "$amount" },
      orderCount: { $sum: 1 },
      lastOrder: { $max: "$createdAt" },
      firstOrder: { $min: "$createdAt" }
    }
  }
]);

// Result:
// { _id: customerId1, totalSpent: 5000, averageOrderValue: 1000, ... }
// { _id: customerId2, totalSpent: 15000, averageOrderValue: 3000, ... }

// Group by null = aggregate entire collection
db.orders.aggregate([
  { $group: {
      _id: null,
      totalRevenue: { $sum: "$amount" },
      orderCount: { $sum: 1 },
      avgOrderValue: { $avg: "$amount" }
    }
  }
]);
// Single result: total revenue across ALL orders
```

### $project: Select/Rename/Compute Fields

```javascript
db.users.aggregate([
  { $project: {
      name: 1,                          // include name
      email: 1,                         // include email
      _id: 0,                           // exclude _id
      fullName: { $concat: ["$firstName", " ", "$lastName"] },
      isAdult: { $gte: ["$age", 18] },
      ageGroup: {
        $cond: [
          { $lt: ["$age", 18] }, "minor",
          { $cond: [{ $lt: ["$age", 65] }, "adult", "senior"] }
        ]
      }
    }
  }
]);
```

### $unwind: Expand Arrays

```javascript
// Document with array field
db.orders.insertOne({
  _id: 1,
  orderNumber: "ORD-001",
  items: [
    { productId: "A", quantity: 2, price: 100 },
    { productId: "B", quantity: 1, price: 50 }
  ]
});

// Without $unwind: can't directly work with array elements
// With $unwind: explode array into multiple documents

db.orders.aggregate([
  { $unwind: "$items" }
]);

// Result (2 documents):
// { _id: 1, orderNumber: "ORD-001", items: { productId: "A", quantity: 2, price: 100 } }
// { _id: 1, orderNumber: "ORD-001", items: { productId: "B", quantity: 1, price: 50 } }

// Use case: calculate total revenue by product
db.orders.aggregate([
  { $unwind: "$items" },
  { $group: {
      _id: "$items.productId",
      totalQuantity: { $sum: "$items.quantity" },
      totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
    }
  }
]);
```

### $lookup: Join Collections

```javascript
// SCENARIO: Join orders with customers collection

db.orders.aggregate([
  { $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer"
    }
  },
  { $unwind: "$customer" },  // expand customer array
  { $project: {
      orderNumber: 1,
      amount: 1,
      customerName: "$customer.name",
      customerEmail: "$customer.email"
    }
  }
]);

// Result: orders with customer details embedded
// Performance: slower than embedded documents (separate collection lookup)
// Use for: reference-based schemas, large arrays that don't belong in main doc
```

### $sort, $skip, $limit: Pagination

```javascript
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $sort: { createdAt: -1 } },
  { $skip: 20 },        // skip first 20
  { $limit: 10 }        // return next 10
]);

// Efficient pagination for large result sets
// Combined with index on createdAt
```

---

## Advanced: Real-World Aggregation Examples

### Example 1: Revenue Analysis by Month

```javascript
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $group: {
      _id: {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" }
      },
      totalRevenue: { $sum: "$amount" },
      orderCount: { $sum: 1 },
      avgOrderValue: { $avg: "$amount" }
    }
  },
  { $sort: { "_id.year": 1, "_id.month": 1 } },
  { $project: {
      _id: 0,
      month: "$_id.month",
      year: "$_id.year",
      totalRevenue: 1,
      orderCount: 1,
      avgOrderValue: { $round: ["$avgOrderValue", 2] }
    }
  }
]);
```

### Example 2: Top Customers (RFM Analysis)

```javascript
// RFM: Recency, Frequency, Monetary value
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $group: {
      _id: "$customerId",
      frequency: { $sum: 1 },                    // order count
      monetaryValue: { $sum: "$amount" },        // total spent
      lastOrderDate: { $max: "$createdAt" }      // most recent
    }
  },
  { $addFields: {
      recency: {
        $divide: [
          { $subtract: [new Date(), "$lastOrderDate"] },
          86400000  // milliseconds per day
        ]
      }
    }
  },
  { $sort: { monetaryValue: -1, frequency: -1, recency: 1 } },
  { $limit: 100 }
]);
```

### Example 3: Inventory Analysis with Categorization

```javascript
db.products.aggregate([
  { $group: {
      _id: "$category",
      totalUnits: { $sum: "$stock" },
      totalValue: { $sum: { $multiply: ["$price", "$stock"] } },
      productCount: { $sum: 1 },
      avgPrice: { $avg: "$price" }
    }
  },
  { $addFields: {
      stockHealth: {
        $cond: [
          { $gt: ["$totalUnits", 1000] }, "high",
          { $cond: [{ $gt: ["$totalUnits", 100] }, "medium", "low"] }
        ]
      }
    }
  },
  { $sort: { totalValue: -1 } }
]);
```

---

## Aggregation Performance Optimization

**WHAT**: How do I write fast aggregation queries?

**THEORY**:
- **$match early**: Reduce documents before expensive stages
- **Index awareness**: First $match stage uses indexes
- **$project before $group**: Reduce fields early
- **$limit before $sort**: If possible, limit before sorting
- **Explain aggregation**: Use `.explain()` to check stages

```javascript
// ❌ INEFFICIENT: Group 1M documents, then limit
db.orders.aggregate([
  { $group: { _id: "$customerId", total: { $sum: "$amount" } } },
  { $limit: 10 }
]);
// Groups ALL customers first (slow), then limits

// ✅ EFFICIENT: Filter first (uses index), then group
db.orders.aggregate([
  { $match: { createdAt: { $gt: new Date("2024-01-01") } } },  // 100K docs only
  { $group: { _id: "$customerId", total: { $sum: "$amount" } } },
  { $limit: 10 }
]);

// Explain execution stages
db.orders.aggregate([...]).explain("executionStats");

// Check allPlansExecution to see index usage
```

---

## Time Complexity: Aggregation Pipeline

| Stage | Complexity | Notes |
|-------|-----------|-------|
| $match (indexed) | O(log n + k) | k = matched docs |
| $match (no index) | O(n) | Full scan |
| $group | O(n) | Linear pass |
| $sort | O(m log m) | m = grouped results |
| $unwind | O(n * s) | s = avg array size |
| $lookup | O(k * m) | k = local docs, m = foreign collection |
| $project | O(n) | Linear transformation |
| $limit, $skip | O(1) | Constant |
