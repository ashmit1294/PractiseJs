# NetworkX Python Syntax — Graph Operations for RAG & Data Pipelines
> Resume Signal: NetworkX, graph algorithms, DiGraph, BFS, topological sort, shortest path, Graph RAG

---

## Why NetworkX in a RAG / AI Context?

NetworkX is the standard Python library for creating, analysing, and traversing graphs. It appears in:
- **Graph RAG** — building and traversing knowledge graphs extracted from documents
- **Dependency pipelines** — topological sort for ordering tasks with dependencies (DAGs)
- **Community detection prep** — building graphs before passing to Leiden/Louvain algorithms
- **Entity relationship graphs** — modelling entity connections extracted by an LLM

---

## The 5 Essential Commands

---

### 1. `DiGraph` — Create a Directed Graph

```python
import networkx as nx

# ─────────────────────────────────────────────
# DiGraph = Directed Graph: edges have direction.
# A → B ≠ B → A (unlike Graph where edges are bidirectional by default)
# Use DiGraph when: relationships have direction (OWNS, REPORTS_TO, CAUSES, ACQUIRED)
# Use Graph when: relationships are symmetric (CONNECTED_TO, SIMILAR_TO)
# ─────────────────────────────────────────────

# --- Create an empty directed graph ---
G = nx.DiGraph()

# --- Or use Graph (undirected) ---
G_undirected = nx.Graph()

# --- Add nodes with optional attributes ---
G.add_node("Apple Inc",   type="company", sector="tech")
G.add_node("Tim Cook",    type="person",  role="CEO")
G.add_node("iPhone",      type="product")
G.add_node("App Store",   type="product")

# --- Check type ---
print(type(G))          # <class 'networkx.classes.digraph.DiGraph'>
print(G.is_directed())  # True

# --- Node count + edge count ---
print(G.number_of_nodes())  # 4
print(G.number_of_edges())  # 0 so far

# --- Inspect nodes with their attributes ---
for node, attrs in G.nodes(data=True):
    print(node, attrs)
# Apple Inc  {'type': 'company', 'sector': 'tech'}
# Tim Cook   {'type': 'person', 'role': 'CEO'}
```

---

### 2. `add_edges_from` — Add Multiple Edges at Once

```python
# ─────────────────────────────────────────────
# add_edges_from: batch add edges from a list.
# Each edge is a (source, target) tuple OR
# (source, target, attr_dict) for edges with attributes.
# Much faster than calling add_edge() one at a time.
# ─────────────────────────────────────────────

# --- Batch add edges (no attributes) ---
G.add_edges_from([
    ("Tim Cook",   "Apple Inc"),    # Tim Cook → WORKS_AT → Apple Inc
    ("Apple Inc",  "iPhone"),       # Apple Inc → MAKES → iPhone
    ("Apple Inc",  "App Store"),    # Apple Inc → OPERATES → App Store
    ("iPhone",     "App Store"),    # iPhone → INTEGRATES_WITH → App Store
])

print(G.number_of_edges())  # 4

# --- Add edges WITH attributes (relationship type) ---
G.add_edges_from([
    ("Tim Cook",  "Apple Inc",  {"relation": "CEO_OF",      "since": 2011}),
    ("Apple Inc", "iPhone",     {"relation": "MANUFACTURES", "year": 2007}),
    ("Apple Inc", "App Store",  {"relation": "OPERATES",     "year": 2008}),
])
# Note: edges already exist → attributes are UPDATED (not duplicated)

# --- Inspect an edge's attributes ---
print(G["Apple Inc"]["iPhone"])      # {'relation': 'MANUFACTURES', 'year': 2007}
print(G.edges(data=True))           # EdgeDataView with all (u, v, attr_dict)

# --- Directed: in-edges vs out-edges ---
print(list(G.successors("Apple Inc")))    # ['iPhone', 'App Store']  (nodes Apple → points to)
print(list(G.predecessors("Apple Inc"))) # ['Tim Cook']              (nodes that → point to Apple)

# --- Graph RAG ingestion pattern: batch-add LLM-extracted relationships ---
def build_graph_from_llm_output(extracted_triples: list[dict]) -> nx.DiGraph:
    """
    extracted_triples: [{"subject": "Apple", "relation": "ACQUIRED", "object": "Intel Modems"}]
    """
    G = nx.DiGraph()
    edges_with_attrs = [
        (t["subject"], t["object"], {"relation": t["relation"]})
        for t in extracted_triples
    ]
    G.add_edges_from(edges_with_attrs)
    return G
```

---

### 3. `bfs_tree` — Breadth-First Search Tree

```python
# ─────────────────────────────────────────────
# bfs_tree(G, source, depth_limit=N):
#   Returns a NEW DiGraph containing only the nodes and edges
#   reachable from `source` within `depth_limit` hops,
#   in BFS traversal order (closest nodes first).
#
# BFS = explores ALL neighbours at depth 1 before depth 2.
# Contrast: DFS = goes as deep as possible before backtracking.
#
# Use case in Graph RAG:
#   Seed entity found by vector search → BFS expand 2-3 hops
#   → collect all related entities → pass as context to LLM
# ─────────────────────────────────────────────

# --- Build a larger knowledge graph for this example ---
KG = nx.DiGraph()
KG.add_edges_from([
    ("Apple Inc",   "Tim Cook"),
    ("Apple Inc",   "iPhone"),
    ("Apple Inc",   "Intel"),        # Apple acquired Intel modems
    ("iPhone",      "iOS"),
    ("iPhone",      "App Store"),
    ("iOS",         "Swift"),
    ("App Store",   "App Store Connect"),
    ("Tim Cook",    "Auburn University"),
    ("Intel",       "x86 Architecture"),
])

# --- BFS tree from "Apple Inc" up to depth 2 ---
bfs_subgraph = nx.bfs_tree(KG, source="Apple Inc", depth_limit=2)

print(list(bfs_subgraph.nodes()))
# ['Apple Inc', 'Tim Cook', 'iPhone', 'Intel',    ← depth 1
#  'iOS', 'App Store', 'Auburn University',         ← depth 2
#  'x86 Architecture']                              ← depth 2 (from Intel)

print(list(bfs_subgraph.nodes()))                  # depth 3 nodes (Swift, App Store Connect) excluded

# --- BFS for local entity neighbourhood in Graph RAG ---
def get_entity_context(KG: nx.DiGraph, seed_entity: str, hops: int = 2) -> list[str]:
    """
    Given a seed entity from vector search, BFS-expand to collect
    all related entities within `hops` hops. Returns list of nodes
    for LLM context assembly.
    """
    if seed_entity not in KG:
        return [seed_entity]
    subgraph = nx.bfs_tree(KG, source=seed_entity, depth_limit=hops)
    return list(subgraph.nodes())

context_nodes = get_entity_context(KG, "Apple Inc", hops=2)
# Collect all node attributes for these entities → pass to LLM as context

# --- BFS order (with levels) using pure nx.bfs_layers ---
layers = dict(enumerate(nx.bfs_layers(KG, sources=["Apple Inc"])))
# {0: ['Apple Inc'], 1: ['Tim Cook', 'iPhone', 'Intel'], 2: ['iOS', 'App Store', ...]}
```

---

### 4. `topological_sort` — Order a DAG by Dependencies

```python
# ─────────────────────────────────────────────
# topological_sort(G):
#   Returns nodes in topological order — a linear ordering where
#   for every edge u → v, u appears BEFORE v in the ordering.
#
# ONLY works on DAGs (Directed Acyclic Graphs — no cycles).
# Will raise NetworkXUnfeasible if the graph has a cycle.
#
# Use cases:
#   - Build/task dependency ordering (which task must run first?)
#   - LLM pipeline step ordering (retrieve before generate, generate before evaluate)
#   - Kubernetes pod startup order (which service depends on which)
#   - Makefile-style dependency graphs
# ─────────────────────────────────────────────

# --- RAG pipeline as a dependency DAG ---
pipeline = nx.DiGraph()
pipeline.add_edges_from([
    ("load_documents",    "chunk_documents"),
    ("chunk_documents",   "generate_embeddings"),
    ("generate_embeddings","insert_vector_db"),
    ("load_documents",    "extract_entities"),      # parallel branch
    ("extract_entities",  "build_knowledge_graph"),
    ("insert_vector_db",  "run_rag_query"),
    ("build_knowledge_graph", "run_rag_query"),     # both must finish before querying
])

# --- Get execution order ---
order = list(nx.topological_sort(pipeline))
print(order)
# ['load_documents',
#  'chunk_documents', 'extract_entities',
#  'generate_embeddings', 'build_knowledge_graph',
#  'insert_vector_db',
#  'run_rag_query']
# load_documents appears first (nothing depends ON it that runs before it)
# run_rag_query appears last (depends on all others)

# --- Check if graph is a valid DAG before sorting ---
print(nx.is_directed_acyclic_graph(pipeline))  # True — safe to topological_sort

# --- Detect cycles (topological_sort would fail on these) ---
cyclic = nx.DiGraph([("A", "B"), ("B", "C"), ("C", "A")])  # cycle: A→B→C→A
print(nx.is_directed_acyclic_graph(cyclic))  # False
try:
    list(nx.topological_sort(cyclic))
except nx.NetworkXUnfeasible as e:
    print(f"Cycle detected: {e}")

# --- Find ALL valid topological orderings (for parallel execution planning) ---
# nx.all_topological_sorts(pipeline) — returns generator of all valid orderings
# (use for determining which steps CAN run in parallel: same topological level = parallelisable)

# --- Generation (topological generations): group steps by level ---
for generation in nx.topological_generations(pipeline):
    print("Can run in parallel:", generation)
# Can run in parallel: {'load_documents'}
# Can run in parallel: {'chunk_documents', 'extract_entities'}
# Can run in parallel: {'generate_embeddings', 'build_knowledge_graph'}
# Can run in parallel: {'insert_vector_db'}
# Can run in parallel: {'run_rag_query'}
```

---

### 5. `shortest_path` — Find the Shortest Route Between Nodes

```python
# ─────────────────────────────────────────────
# nx.shortest_path(G, source, target, weight=None):
#   Returns the shortest path (list of nodes) from source to target.
#   Default: unweighted (fewest hops). Set weight="distance" for weighted.
#
# nx.shortest_path_length(G, source, target):
#   Returns just the length (number of hops) — faster than full path.
#
# Use cases in RAG:
#   - Find how two entities are connected in a knowledge graph
#   - Multi-hop reasoning: "What is the indirect relationship between A and Z?"
#   - Graph traversal for answering "how is X related to Y?" queries
# ─────────────────────────────────────────────

# --- Knowledge graph for this example ---
world = nx.DiGraph()
world.add_edges_from([
    ("Elon Musk",    "Tesla"),
    ("Tesla",        "Electric Vehicles"),
    ("Elon Musk",    "SpaceX"),
    ("SpaceX",       "Mars Mission"),
    ("SpaceX",       "Starlink"),
    ("Starlink",     "Internet Access"),
    ("Tesla",        "Solar City"),
    ("Solar City",   "Renewable Energy"),
    ("Renewable Energy", "Climate Change"),
])

# --- Shortest path (unweighted = fewest hops) ---
path = nx.shortest_path(world, source="Elon Musk", target="Climate Change")
print(path)
# ['Elon Musk', 'Tesla', 'Solar City', 'Renewable Energy', 'Climate Change']

# --- Shortest path length (hop count only) ---
length = nx.shortest_path_length(world, source="Elon Musk", target="Climate Change")
print(length)  # 4

# --- All shortest paths (if multiple equally short paths exist) ---
all_paths = list(nx.all_shortest_paths(world, source="Elon Musk", target="Internet Access"))
print(all_paths)
# [['Elon Musk', 'SpaceX', 'Starlink', 'Internet Access']]

# --- Weighted shortest path (e.g., relationship strength or distance) ---
weighted = nx.DiGraph()
weighted.add_edge("A", "B", weight=1.0)
weighted.add_edge("B", "C", weight=0.5)
weighted.add_edge("A", "C", weight=3.0)  # direct but expensive

cheapest_path = nx.shortest_path(weighted, "A", "C", weight="weight")
print(cheapest_path)  # ["A", "B", "C"]  (cost 1.5 < direct cost 3.0)

# --- Handle: no path exists ---
try:
    nx.shortest_path(world, "Internet Access", "Elon Musk")  # reverse direction — no path
except nx.NetworkXNoPath:
    print("No directed path exists")

# --- Graph RAG: answer "How is Entity A related to Entity B?" ---
def explain_relationship(KG: nx.DiGraph, entity_a: str, entity_b: str) -> str:
    """
    Find the shortest relationship chain between two entities in the knowledge graph.
    Returns a human-readable explanation of the connection.
    """
    try:
        path = nx.shortest_path(KG, source=entity_a, target=entity_b)
        # Build explanation: collect edge attributes along the path
        hops = []
        for i in range(len(path) - 1):
            u, v = path[i], path[i+1]
            rel = KG[u][v].get("relation", "connected_to")
            hops.append(f"{u} --[{rel}]--> {v}")
        return " → ".join(hops)
    except nx.NetworkXNoPath:
        return f"No direct relationship found between {entity_a} and {entity_b}"
    except nx.NodeNotFound as e:
        return f"Entity not in knowledge graph: {e}"

result = explain_relationship(world, "Elon Musk", "Climate Change")
# "Elon Musk --[connected_to]--> Tesla → Tesla --[connected_to]--> Solar City → ..."
```

---

## Quick Reference — Command Summary

| Command | What It Does | Common Parameters |
|---|---|---|
| `nx.DiGraph()` | Create a directed graph (edges have direction) | — |
| `nx.Graph()` | Create an undirected graph (edges are bidirectional) | — |
| `G.add_edges_from(list)` | Add multiple edges from a list of `(u, v)` or `(u, v, attr_dict)` tuples | `ebunch_to_add` |
| `nx.bfs_tree(G, source)` | Return a DiGraph of the BFS tree rooted at source | `depth_limit=N` |
| `nx.topological_sort(G)` | Return nodes in topological order (DAGs only) | — |
| `nx.shortest_path(G, s, t)` | Return list of nodes on shortest path s → t | `weight="attr_name"` |
| `nx.shortest_path_length(G, s, t)` | Return hop count of shortest path | `weight="attr_name"` |
| `nx.is_directed_acyclic_graph(G)` | Check if graph is a DAG (required before topological_sort) | — |
| `G.successors(n)` | Nodes that n points TO (out-neighbours in DiGraph) | — |
| `G.predecessors(n)` | Nodes that point TO n (in-neighbours in DiGraph) | — |
| `G.nodes(data=True)` | Iterator of `(node, attr_dict)` for all nodes | — |
| `G.edges(data=True)` | Iterator of `(u, v, attr_dict)` for all edges | — |
| `nx.bfs_layers(G, sources)` | BFS by level — returns generator of sets by hop distance | — |
| `nx.topological_generations(G)` | Groups of nodes that can run in parallel | — |

---

## NetworkX in Graph RAG — End-to-End Pattern

```python
import networkx as nx
from typing import NamedTuple

class Triple(NamedTuple):
    subject: str
    relation: str
    obj: str

# STEP 1: Build knowledge graph from LLM-extracted triples
triples = [
    Triple("Apple Inc", "ACQUIRED",       "Intel Modem Business"),
    Triple("Apple Inc", "MANUFACTURES",   "iPhone"),
    Triple("iPhone",    "RUNS",           "iOS"),
    Triple("iOS",       "SUPPORTS",       "Swift"),
    Triple("Tim Cook",  "CEO_OF",         "Apple Inc"),
]

KG = nx.DiGraph()
KG.add_edges_from(
    [(t.subject, t.obj, {"relation": t.relation}) for t in triples]
)

# STEP 2: At query time — find seed entity via vector search, then BFS expand
seed = "iPhone"                                        # found by embedding similarity
local_nodes = nx.bfs_tree(KG, seed, depth_limit=2).nodes()

# STEP 3: Assemble context from local neighbourhood
context_triples = [
    f"{u} --[{KG[u][v]['relation']}]--> {v}"
    for u, v in KG.edges()
    if u in local_nodes or v in local_nodes
]

# STEP 4: Pass to LLM
prompt = f"""
Answer using only the following relationships:
{chr(10).join(context_triples)}

Question: What does Apple manufacture and what OS does it run?
"""
```
