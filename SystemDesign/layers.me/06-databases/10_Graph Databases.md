# T10 — Graph Databases

---

## 1. ELI5

Imagine you want to know: "Who are my friends' friends who also like jazz and live within 50 miles of me?" In a regular spreadsheet, you'd have to: look up your friends list, look up each friend's friend list, cross-reference a music preferences list, cross-reference a locations list... it's exhausting.

In a graph database, everything is **nodes** (people, places, things) connected by **edges** (relationships). Finding "friends of friends who like jazz" is just following arrows — 2 hops along edges. The database is optimized for this exact kind of traversal.

---

## 2. Analogy

**Google Maps vs Spreadsheet of Roads**

To find the shortest route from NYC to LA, Google Maps doesn't scan a giant CSV of all possible road combinations. It uses a **graph** — intersections are nodes, roads are edges with distance and speed. It traverses connected nodes to find optimal paths.

Social networks, fraud detection, recommendation engines — all are essentially "find paths between connected things." Graph databases are Google Maps for your data relationships.

---

## 3. Core Concept

### The Property Graph Model

```
NODES = entities with properties
  (User { id: "alice", name: "Alice", age: 29, city: "NYC" })
  (Movie { id: "m1", title: "Inception", year: 2010 })
  
EDGES = directed relationships with properties
  (alice)-[WATCHED { at: "2024-01-15", rating: 5 }]->(m1)
  (alice)-[FRIENDS_WITH { since: "2020-03-01" }]->(bob)
  (bob)-[FRIENDS_WITH { since: "2020-03-01" }]->(alice)

Edges are FIRST-CLASS CITIZENS — not just foreign keys.
Edges have: type (WATCHED, FRIENDS_WITH), direction, properties
```

### Graph DB vs Relational DB — The Traversal Gap

```sql
-- SQL: Find friends of Alice's friends (2-hop)
SELECT DISTINCT u3.*
FROM users u1
JOIN friendships f1 ON u1.id = f1.user_id    -- Alice's friends
JOIN users u2 ON f1.friend_id = u2.id
JOIN friendships f2 ON u2.id = f2.user_id    -- Their friends
JOIN users u3 ON f2.friend_id = u3.id
WHERE u1.name = 'Alice' AND u3.id != u1.id;

-- With 1M users × 100 avg friends:
--   JOIN 1: 100 rows
--   JOIN 2: 100 × 100 = 10,000 rows to scan
--   Performance: 100ms → 1s

-- Neo4j Cypher: same query
MATCH (alice:User {name: 'Alice'})-[:FRIENDS_WITH*2]->(foaf:User)
WHERE foaf <> alice
RETURN DISTINCT foaf;

-- Graph traversal: follow pointers, not table scans
-- Performance: 10–50ms (index-free adjacency)
```

### Index-Free Adjacency — The Key Advantage

```
SQL approach — "who are Alice's friends?":
  1. LOOKUP friendship table: WHERE user_id = alice.id
  2. For each friend_id: LOOKUP users table: WHERE id = friend_id
  → O(log N) per lookup in a table of N users

Graph (Neo4j) approach:
  1. Find Alice node: O(1) (index on id)
  2. Follow Alice.friendEdges pointer list → directly at neighbor nodes
  → O(1) per hop! No table lookups. Just pointer traversal.

Performance at scale:
  1-hop:  SQL 10ms | Neo4j 1ms    → 10× faster
  2-hop:  SQL 100ms | Neo4j 2ms   → 50× faster
  3-hop:  SQL 10s   | Neo4j 5ms   → 2000× faster
  6-hop:  SQL (impossible) | Neo4j 100ms

This is why "6 degrees of separation" traversal is only practical in graph DBs.
```

---

## 4. ASCII Architecture

### Property Graph Structure

```
     name:"Alice"          name:"Bob"           name:"Carol"
     city:"NYC"            city:"NYC"            city:"LA"
        │                     │                      │
   ┌────▼────┐           ┌────▼────┐           ┌─────▼────┐
   │  User   │           │  User   │           │   User   │
   │ :Alice  │──FRIENDS──►  :Bob   │──FOLLOWS──►  :Carol  │
   └────┬────┘           └────┬────┘           └──────────┘
        │                     │
    WATCHED              WATCHED
      │ rating:5             │ rating:4
      ▼                      ▼
   ┌─────────┐           ┌─────────┐
   │  Movie  │           │  Movie  │
   │:Inception│◄──────────│:Interstellar│
   └─────────┘   SIMILAR  └─────────┘
   
Nodes: User, Movie
Edges: FRIENDS, FOLLOWS, WATCHED, SIMILAR
Properties on edges: rating, since, similarity_score
```

### Neo4j Physical Storage

```
Node store:   Fixed-size records (9 bytes per node)
              { first_relationship_id, first_property_id }
              
Edge store:   Fixed-size records (33 bytes per edge)
              { start_node_id, end_node_id, type_id,
                prev_rel_of_start, next_rel_of_start,
                prev_rel_of_end, next_rel_of_end,
                first_property_id }
              
Property store: { type, key, value, next_property_id }

Traversal:
  1. Load node "Alice" → read node record → get first_relationship_id
  2. Follow relationship chain from Alice
  3. Each relationship: check type == "FRIENDS_WITH"
  4. If match → load other end node (start/end node pointer)
  
All lookups: pointer follows, no index needed
→ O(degree) per hop, NOT O(log N)
```

---

## 5. Cypher Query Language

```cypher
-- Create nodes and relationships
CREATE (alice:User {name: 'Alice', city: 'NYC'})
CREATE (bob:User   {name: 'Bob',   city: 'NYC'})
CREATE (carol:User {name: 'Carol', city: 'LA'})
CREATE (inception:Movie {title: 'Inception', genre: 'Sci-Fi'})

CREATE (alice)-[:FRIENDS_WITH {since: '2020'}]->(bob)
CREATE (alice)-[:WATCHED {rating: 5}]->(inception)
CREATE (bob)-[:WATCHED {rating: 4}]->(inception)

-- Find Alice's friends
MATCH (alice:User {name: 'Alice'})-[:FRIENDS_WITH]->(friend:User)
RETURN friend.name, friend.city;

-- Find movies watched by friends but not Alice (recommendations)
MATCH (alice:User {name: 'Alice'})-[:FRIENDS_WITH]->(friend)
      -[:WATCHED]->(movie:Movie)
WHERE NOT (alice)-[:WATCHED]->(movie)
RETURN movie.title, COUNT(friend) AS watchedByFriends
ORDER BY watchedByFriends DESC
LIMIT 10;

-- Variable-length path: friends up to 3 hops away
MATCH (alice:User {name: 'Alice'})-[:FRIENDS_WITH*1..3]->(person:User)
RETURN DISTINCT person.name, person.city;

-- Shortest path between two users
MATCH path = shortestPath(
  (alice:User {name: 'Alice'})-[:FRIENDS_WITH*]-(carol:User {name: 'Carol'})
)
RETURN path, length(path);
```

---

## 6. Traversal Explosion — Depth Limits

```
Why traversal depth matters mathematically:

Assume: average 100 friends per user

Depth 1: 100^1 = 100 neighbors (fast)
Depth 2: 100^2 = 10,000 neighbors
Depth 3: 100^3 = 1,000,000 neighbors
Depth 4: 100^4 = 100,000,000 neighbors → too slow even for graph DBs
Depth 6: 100^6 = 1,000,000,000,000 → impossible

Practical limits:
  Max useful depth: 3–4 hops in social networks
  LinkedIn: shows 1st, 2nd, 3rd degree connections (stops at 3rd)
  Fraud detection: 3–4 hops max per query
  
Mitigation:
  Pruning: don't explore nodes already visited (BFS with visited set)
  Pre-aggregation: compute "2nd degree connections" offline (Spark job)
  Bidirectional BFS: start from both ends, meet in middle → O(√N) paths each side
    → from 100^3 (1M) to 2 × 100^(3/2) (2000) explored nodes = 500× improvement
```

---

## 7. Graph Database Use Cases

### When to Use a Graph Database

```
✅ Relationship queries are the PRIMARY use case:
  - Social networks: "Who knows whom?"
  - Fraud detection: "Has this device/account been associated with known fraudsters?"
  - Recommendations: "What do people similar to you like?"
  - Knowledge graphs: "What concepts are related to X?"
  - Network topology: "What systems are impacted if server A fails?"
  - Access control: "Does user X have permission to resource Y via role chain?"

❌ Don't use graph DB for:
  - Simple CRUD with mostly isolated records
  - Time-series data (use Cassandra)
  - Heavy analytics/aggregations (use Snowflake)
  - When most queries are single-entity lookups with no relationship traversal
```

---

## 8. Scaling Challenges

```
Graph DBs are HARD to shard:

The challenge:
  Node A in shard 1 → edge to Node B in shard 2
  Following that edge requires cross-shard network call
  Deep traversal = many cross-shard hops = high latency

LinkedIn's approach:
  - Geographic sharding: users from same region on same shard
  - Most connections are local (regional social graphs)
  - Cross-region edges: tolerate higher latency for foreign hops

Uber's Neo4j for fraud:
  - Data fits in RAM (single large instance: 500GB RAM)
  - Scale UP, not scale OUT for fraud subgraph
  - Fraud graph is much smaller than production graph

Alternative: Cassandra-backed graph (DataStax Graph / Neptune)
  - Adjacency list in Cassandra: { node_id → list of neighbor_ids }
  - Trades traversal speed for horizontal scalability
  - 10–100× slower per hop, but scales to 10B+ nodes

Pre-compute at scale:
  - Run Spark GraphX jobs on hourly snapshots
  - Pre-compute 2nd-degree connections, top recommendations
  - Store results in Redis/Cassandra
  - Neo4j for real-time small subgraph queries only
```

---

## 9. Math & Formulas

### Graph Traversal Complexity

$$\text{nodes explored at depth } d = (\text{avg degree})^d$$

$$\text{with pruning (BFS visited set):} \approx \min\left((\text{avg degree})^d, N\right)$$

### Index-Free Adjacency Performance

$$\text{SQL (indexed JOIN): } O(\log N) \text{ per hop}$$

$$\text{Graph (pointer follow): } O(\text{degree}) \text{ per hop}$$

For 3-hop on 1M nodes (avg degree 100):
- SQL: $O(\log(10^6)^3) = O(20^3) = O(8000)$ operations but with huge cardinalities
- Graph: $O(100^3) = O(10^6)$ nodes scanned but via direct pointers in RAM

In practice: graph DB 10–1000× faster for 3+ hop queries on large graphs.

### Bidirectional BFS

$$\text{standard BFS depth } d: O(b^d)$$

$$\text{bidirectional BFS: } O(b^{d/2} + b^{d/2}) = O(2 \cdot b^{d/2})$$

For $b=100, d=6$: standard $= 10^{12}$; bidirectional $= 2 \times 10^3 = 2000$ — 500M× improvement.

---

## 10. MERN Stack Dev Notes

### Node.js + Neo4j (neo4j-driver)

```javascript
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  { maxConnectionPoolSize: 50 }
);

// Create relationship (when user follows another)
async function followUser(fromUserId, toUserId) {
  const session = driver.session({ database: 'neo4j' });
  try {
    await session.run(`
      MATCH (from:User {id: $fromId}), (to:User {id: $toId})
      MERGE (from)-[r:FOLLOWS]->(to)
      ON CREATE SET r.since = datetime()
      RETURN r
    `, { fromId: fromUserId, toId: toUserId });
  } finally {
    await session.close();
  }
}

// Get recommendations: movies friends watched that current user hasn't
async function getRecommendations(userId) {
  const session = driver.session({ database: 'neo4j' });
  try {
    const result = await session.run(`
      MATCH (me:User {id: $userId})-[:FOLLOWS]->(friend:User)
            -[:WATCHED]->(movie:Movie)
      WHERE NOT (me)-[:WATCHED]->(movie)
        AND me <> friend
      RETURN movie.id AS movieId, movie.title AS title,
             COUNT(friend) AS friendCount
      ORDER BY friendCount DESC
      LIMIT 10
    `, { userId });
    return result.records.map(r => ({
      movieId: r.get('movieId'),
      title: r.get('title'),
      friendCount: r.get('friendCount').toNumber()
    }));
  } finally {
    await session.close();
  }
}

// Fraud detection: check if device connected to known fraud accounts
async function checkFraudRisk(deviceId) {
  const session = driver.session({ database: 'neo4j' });
  try {
    const result = await session.run(`
      MATCH path = (d:Device {id: $deviceId})-[*1..4]-(fraud:Account {flagged: true})
      RETURN COUNT(DISTINCT fraud) AS fraudConnections,
             MIN(length(path)) AS closestFraudDistance
      LIMIT 1
    `, { deviceId });
    const record = result.records[0];
    return {
      riskScore: record.get('fraudConnections').toNumber(),
      closestDistance: record.get('closestFraudDistance')
    };
  } finally {
    await session.close();
  }
}
```

### When to Use Neo4j vs Just Storing Graph in MongoDB

```javascript
// MongoDB approach for simple graphs (low hop depth):
// Store adjacency list in MongoDB
const userSchema = new Schema({
  userId: String,
  following: [String],    // array of user_ids this user follows
  followers: [String],    // array of user_ids following this user
});

// Get 1-hop: O(1) - just read the array
const user = await User.findOne({ userId }, 'following');

// Get 2-hop: O(N) - need $lookup
const twoHop = await User.aggregate([
  { $match: { userId } },
  { $lookup: { from: 'users', localField: 'following', foreignField: 'userId', as: 'friendDocs' } },
  { $unwind: '$friendDocs' },
  { $project: { followingOfFollowing: '$friendDocs.following' } }
]);
// ❌ Gets messy at 3+ hops and large arrays (unbounded following arrays)

// Use Neo4j when:
// - Need 3+ hop traversals frequently
// - Complex path queries (shortest path, all paths, pattern matching)
// - Graph algorithms (PageRank, community detection, centrality)
// Use MongoDB when:
// - Simple 1-2 hop lookups, small follow counts
// - Graph is secondary to other data needs
```

---

## 11. Real-World Case Studies

### LinkedIn — 800M+ Node Graph

```
Problem: "Who knows whom?" for recruiting, "People You May Know" feature

Scale: 800M+ members, avg 500 connections each
      = 800M nodes, 400B edges

Architecture:
  - Custom distributed graph store (not Neo4j — too large to fit single machine)
  - Geographic sharding: users partition by country/region
  - Primary storage: Espresso (distributed document store) for member data
  - Graph layer: Venice (custom feature store) for pre-computed connections
  
3rd-degree precomputation:
  - Spark job on member graph hourly
  - For each member: compute all 2nd/3rd degree connections
  - Cache in Venice key-value store
  
At query time (e.g., "People You May Know"):
  - Read precomputed 2nd-degree from Venice: 5ms
  - NOT real-time Cypher traversal (graph too large)
  
Real-time queries:
  - "Do Alice and Bob have a direct connection?" → 1-hop: single row lookup
  - "Mutual connections?" → pre-cached 2nd-degree intersection
```

### Uber — Fraud Detection Graph

```
Problem: Fraudsters share devices, phone numbers, credit cards across fake accounts

Graph model:
  Nodes: Rider, Driver, Device, PhoneNumber, Email, CreditCard, Location
  Edges: USED_DEVICE, HAS_PHONE, REGISTERED_EMAIL, PAID_WITH, LIVES_AT

Fraud pattern detection:
  MATCH (fraudAccount:Account {status: 'fraud'})
        <-[:USED_DEVICE|PAID_WITH|HAS_PHONE*1..3]-(suspect:Account)
  WHERE suspect.status = 'normal'
  RETURN suspect, COUNT(DISTINCT fraudAccount) AS fraudConnections

Why graph (not SQL):
  SQL: 3-way self-join on multiple relationship tables → 10+ seconds
  Neo4j: pointer traversal → <100ms even on 100M node fraud subgraph
  
Architecture:
  - Dedicated fraud Neo4j cluster (isolated from production)
  - ~500GB RAM for hot fraud subgraph
  - Writes: stream from Kafka → Neo4j asynchronously
  - Reads: real-time fraud scoring API → Neo4j query
  - If risk score > threshold → hold transaction for manual review
```

### Netflix — Movie Recommendation Graph

```
Problem: "What should I watch next?" — collaborative filtering

Graph:
  Nodes: User, Movie, Genre, Actor, Director
  Edges: WATCHED {rating, timestamp},
         ACTED_IN, DIRECTED, BELONGS_TO_GENRE

Similarity query:
  "Find movies similar to Inception for user Alice"
  MATCH (alice:User {id: 'alice'})-[w:WATCHED]->(watched:Movie)
  WHERE w.rating >= 4
  MATCH (watched)-[:SAME_GENRE|:SAME_DIRECTOR*1..2]->(similar:Movie)
  WHERE NOT (alice)-[:WATCHED]->(similar)
  RETURN similar.title, COUNT(*) AS score
  ORDER BY score DESC LIMIT 10;

Scale issue: Netflix uses Spark ML for offline computation
  → Runs collaborative filtering on full graph weekly
  → Stores top-100 recommendations per user in Cassandra
  → Neo4j used for real-time "more like this" on subgraph only
  
Architecture: Cassandra-backed graph via Gremlin (Apache TinkerPop)
  → Trades traversal speed for horizontal scalability to 10M+ writes/sec
```

---

## 12. Interview Cheat Sheet

**Q: What is index-free adjacency and why is it a graph DB advantage?**
> In a graph DB, each node stores direct pointers to its adjacent nodes. Traversing a relationship = following a pointer in O(1). In SQL, finding neighbors requires a JOIN on a friendships table — O(log N) per lookup. For multi-hop queries, this compounds: SQL performance degrades exponentially with depth while graph DB stays roughly linear in the number of nodes actually visited.

**Q: When would you choose a graph database over a relational database?**
> When relationship traversal is the primary query pattern: social networks (friends of friends), fraud detection (chains of connected fraudulent entities), recommendation engines (similar users/items), knowledge graphs, and network analysis. Use SQL when relationships are secondary, most queries are single-entity lookups, or you need ACID multi-table transactions.

**Q: Why is graph database sharding difficult?**
> Because edges connect nodes that might be on different shards. Following an edge from shard A to shard B requires a network round trip — each hop potentially crosses a shard boundary. For deep traversals (5+ hops), this becomes N cross-shard calls, each adding 5–50ms latency. Solutions: geographic sharding (related users are co-located), pre-compute offline, or scale up (large single-machine instance) rather than scale out.

**Q: What's the difference between Neo4j and an adjacency list in MongoDB?**
> Neo4j: optimized pointer-following, O(1) per hop, supports Cypher graph queries, algorithms (shortest path, PageRank), scales via scale-up. MongoDB adjacency list: works for 1-2 hop lookup, but arrays grow unbounded, multi-hop queries need complex $lookup chaining, no native graph algorithms. Use MongoDB for simple graphs; Neo4j for complex traversal patterns.

---

## 13. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Node** | Entity in a graph with properties (User, Movie, Product) |
| **Edge** | Directed relationship between nodes with properties (WATCHED, FOLLOWS) |
| **Property Graph** | Nodes and edges both have properties; the dominant graph model |
| **Index-Free Adjacency** | Nodes store pointers to neighbors; O(1) traversal per hop |
| **Cypher** | Neo4j's declarative graph query language |
| **Gremlin** | Apache TinkerPop traversal language used by Amazon Neptune, etc. |
| **Hop** | One edge traversal; "2-hop" = follow 2 edges from starting node |
| **Traversal Explosion** | Exponential growth in nodes to visit with depth |
| **Bidirectional BFS** | Traverse from both ends; reduces O(bᵈ) to O(bᵈ/²) |
| **Shortest Path** | Minimum hops between two nodes; native graph algorithm |
| **PageRank** | Algorithm measuring node importance by incoming edge quality |
| **Community Detection** | Clustering densely connected node groups |
| **Subgraph** | Portion of total graph relevant to a query |
| **Adjacency List** | Per-node list of neighbors; simpler alternative to full graph DB |
| **Knowledge Graph** | Graph of entities and their semantic relationships (Google Knowledge Graph) |
