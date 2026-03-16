/**
 * QUESTION SET: Graph Algorithms
 *
 * Graph = Vertices (nodes) + Edges (connections)
 * Types: Directed / Undirected | Weighted / Unweighted | Cyclic / Acyclic
 *
 * Representations:
 *   - Adjacency List  → Map<node, [neighbors]>  — best for sparse graphs
 *   - Adjacency Matrix → matrix[i][j] = weight  — best for dense graphs
 *
 * Core algorithms:
 *   BFS → level-by-level (Queue) → shortest path in unweighted graph
 *   DFS → depth-first (Stack/Recursion) → cycle detection, topological sort
 */

// ─────────────────────────────────────────────
// Q1. Build Graph from Edge List
// WHAT: How to construct adjacency list from array of edges?
// THEORY: Map each node → list of neighbors. For undirected, add edges both ways.
// Time: O(e) edges  Space: O(v + e)
// ─────────────────────────────────────────────
function buildGraph(edges, directed = false) {
  const graph = new Map();

  for (const [u, v] of edges) {
    if (!graph.has(u)) graph.set(u, []);
    if (!graph.has(v)) graph.set(v, []);
    graph.get(u).push(v);
    if (!directed) graph.get(v).push(u); // undirected: both ways
  }
  return graph;
}

// ─────────────────────────────────────────────
// Q2. BFS — Breadth First Search
// WHAT: How to visit all nodes level by level in a graph?
// THEORY: Use Queue (FIFO). Start from source. Process each node, enqueue unvisited neighbors.
// Level-order traversal. Finds shortest path.
// Time: O(v + e)  Space: O(v)
// ─────────────────────────────────────────────
function bfs(graph, start) {
  const visited = new Set([start]);
  const queue = [start];
  const order = [];

  while (queue.length) {
    const node = queue.shift();
    order.push(node);
    for (const neighbor of (graph.get(node) || [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return order;
}

// ─────────────────────────────────────────────
// Q3. DFS — Depth First Search (iterative + recursive)
// ─────────────────────────────────────────────
function dfsIterative(graph, start) {
  const visited = new Set();
  const stack = [start];
  const order = [];

  while (stack.length) {
    const node = stack.pop();
    if (visited.has(node)) continue;
    visited.add(node);
    order.push(node);
    for (const neighbor of (graph.get(node) || [])) {
      if (!visited.has(neighbor)) stack.push(neighbor);
    }
  }
  return order;
}

function dfsRecursive(graph, node, visited = new Set()) {
  visited.add(node);
  const order = [node];
  for (const neighbor of (graph.get(node) || [])) {
    if (!visited.has(neighbor)) {
      order.push(...dfsRecursive(graph, neighbor, visited));
    }
  }
  return order;
}

// ─────────────────────────────────────────────
// Q4. Shortest Path (BFS — unweighted graph)
// Returns distance map from source to all nodes
// ─────────────────────────────────────────────
function shortestPath(graph, start) {
  const dist = new Map([[start, 0]]);
  const queue = [start];

  while (queue.length) {
    const node = queue.shift();
    for (const neighbor of (graph.get(node) || [])) {
      if (!dist.has(neighbor)) {
        dist.set(neighbor, dist.get(node) + 1);
        queue.push(neighbor);
      }
    }
  }
  return dist;
}

// ─────────────────────────────────────────────
// Q5. Has Path — does path exist between source and dest?
// ─────────────────────────────────────────────
function hasPath(graph, src, dst, visited = new Set()) {
  if (src === dst) return true;
  if (visited.has(src)) return false;
  visited.add(src);
  for (const neighbor of (graph.get(src) || [])) {
    if (hasPath(graph, neighbor, dst, visited)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────
// Q6. Number of Connected Components
// ─────────────────────────────────────────────
function countComponents(n, edges) {
  // Union-Find approach
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(x) {
    if (parent[x] !== x) parent[x] = find(parent[x]); // path compression
    return parent[x];
  }

  function union(x, y) {
    const px = find(x), py = find(y);
    if (px === py) return false;
    parent[px] = py;
    return true;
  }

  let components = n;
  for (const [u, v] of edges) {
    if (union(u, v)) components--;
  }
  return components;
}

// ─────────────────────────────────────────────
// Q7. Detect Cycle in Directed Graph (DFS + coloring)
// 0 = unvisited, 1 = in stack (gray), 2 = done (black)
// ─────────────────────────────────────────────
function hasCycleDirected(graph) {
  const color = new Map();

  function dfs(node) {
    color.set(node, 1); // mark as in-progress
    for (const neighbor of (graph.get(node) || [])) {
      if (color.get(neighbor) === 1) return true;  // back edge → cycle
      if (!color.has(neighbor) && dfs(neighbor)) return true;
    }
    color.set(node, 2); // done
    return false;
  }

  for (const node of graph.keys()) {
    if (!color.has(node) && dfs(node)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────
// Q8. Topological Sort (Kahn's Algorithm — BFS)
// Only for Directed Acyclic Graphs (DAG)
// Use case: task scheduling, build systems, course prerequisites
// ─────────────────────────────────────────────
function topologicalSort(numCourses, prerequisites) {
  const inDegree = new Array(numCourses).fill(0);
  const graph = Array.from({ length: numCourses }, () => []);

  for (const [course, prereq] of prerequisites) {
    graph[prereq].push(course);
    inDegree[course]++;
  }

  const queue = [];
  for (let i = 0; i < numCourses; i++) {
    if (inDegree[i] === 0) queue.push(i);
  }

  const order = [];
  while (queue.length) {
    const course = queue.shift();
    order.push(course);
    for (const next of graph[course]) {
      inDegree[next]--;
      if (inDegree[next] === 0) queue.push(next);
    }
  }
  return order.length === numCourses ? order : []; // empty = cycle exists
}

// ─────────────────────────────────────────────
// Q9. Number of Islands (Grid BFS/DFS)
// Input: 2D grid of '1' (land) and '0' (water)
// Count connected components of land
// ─────────────────────────────────────────────
function numIslands(grid) {
  let count = 0;
  const rows = grid.length, cols = grid[0].length;

  function dfs(r, c) {
    if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] !== "1") return;
    grid[r][c] = "0"; // mark visited by sinking it
    dfs(r + 1, c); dfs(r - 1, c);
    dfs(r, c + 1); dfs(r, c - 1);
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === "1") {
        dfs(r, c);
        count++;
      }
    }
  }
  return count;
}

// ─────────────────────────────────────────────
// Q10. Clone Graph
// ─────────────────────────────────────────────
class GraphNode {
  constructor(val, neighbors = []) {
    this.val = val;
    this.neighbors = neighbors;
  }
}

function cloneGraph(node, visited = new Map()) {
  if (!node) return null;
  if (visited.has(node)) return visited.get(node);

  const clone = new GraphNode(node.val);
  visited.set(node, clone);
  clone.neighbors = node.neighbors.map((n) => cloneGraph(n, visited));
  return clone;
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const edges = [[0,1],[0,2],[1,2],[2,3]];
const g = buildGraph(edges);

console.log("=== BFS ===");
console.log(bfs(g, 0)); // [0, 1, 2, 3]

console.log("\n=== DFS ===");
console.log(dfsIterative(g, 0));
console.log(dfsRecursive(g, 0));

console.log("\n=== Shortest Path ===");
console.log([...shortestPath(g, 0).entries()]); // [[0,0],[1,1],[2,1],[3,2]]

console.log("\n=== Has Path ===");
console.log(hasPath(g, 0, 3)); // true
console.log(hasPath(g, 3, 0)); // true (undirected)

console.log("\n=== Connected Components ===");
console.log(countComponents(5, [[0,1],[1,2],[3,4]])); // 2

console.log("\n=== Topological Sort ===");
console.log(topologicalSort(4, [[1,0],[2,0],[3,1],[3,2]])); // [0,1,2,3] or valid order

console.log("\n=== Number of Islands ===");
const grid = [
  ["1","1","0","0","0"],
  ["1","1","0","0","0"],
  ["0","0","1","0","0"],
  ["0","0","0","1","1"]
];
console.log(numIslands(grid)); // 3

console.log("\n=== Cycle Detection ===");
const directedCyclic = buildGraph([[0,1],[1,2],[2,0]], true);
console.log(hasCycleDirected(directedCyclic)); // true
const directedAcyclic = buildGraph([[0,1],[1,2],[2,3]], true);
console.log(hasCycleDirected(directedAcyclic)); // false
