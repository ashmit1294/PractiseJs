# T16 — Vector Databases

---

## 1. ELI5

A regular database answers: "Find me users WHERE age = 25 AND city = 'NYC'". It matches EXACT values.

But how do you answer: "Find me songs SIMILAR to this one" or "Find me products that LOOK LIKE this photo" or "Find me documents with the SAME MEANING as this sentence"?

There's no exact match for "similar" — you can't filter by vibes.

**Vector databases** solve this by converting everything (text, images, songs) to lists of numbers (vectors/embeddings) that capture meaning/similarity. Things that are similar end up with similar numbers. The database then finds the nearest numbers to your query — "similarity search."

Think of it like plotting every song on a huge map. Similar-vibe songs cluster together. When you ask "find me songs like this", you're just asking "find everything within 5 miles of THIS spot on the map."

---

## 2. Analogy

**A map of flavors in an ice cream shop:**

Imagine every ice cream flavor is placed on a 2D map based on taste:
- Chocolate and dark chocolate are close together
- Vanilla and French vanilla are close together  
- Mint chip is far from chocolate but near vanilla
- Sorbet is in its own corner (no dairy)

When you say "I want something LIKE chocolate but not TOO similar", you're doing vector search — find flavors within radius R of chocolate's position, excluding exact neighbors.

Real embeddings work like this but in 768+ dimensions (capturing countless aspects of meaning, including things we can't name or visualize) rather than 2D.

---

## 3. What Are Embeddings?

```
Text → Embedding model (e.g. text-embedding-3-small) → Vector of floats

"The cat sat on the mat"  → [0.23, -0.87, 0.14, 0.55, ..., -0.31]  (1536 floats)
"A feline rested on a rug" → [0.22, -0.85, 0.15, 0.52, ..., -0.29]  (1536 floats)
"The stock market crashed"  → [-0.45, 0.63, -0.77, 0.12, ..., 0.88]  (very different!)

Observation:
  Sentences with similar meaning → vectors close together in 1536-dimensional space
  Sentences with different meaning → vectors far apart
  
Cosine similarity: measures angle between vectors (0 = identical, 1 = opposite)
  similarity("cat sat on mat", "feline rested on rug") ≈ 0.92  ← very similar
  similarity("cat sat on mat", "stock market crashed") ≈ 0.11  ← very different

Common embedding dimensions:
  text-embedding-3-small (OpenAI):  1536 dims
  all-MiniLM-L6-v2 (sentence-transformers): 384 dims
  CLIP (images + text):  512 dims
  
Storage: 1536 floats × 4 bytes = 6KB per embedding
         1M vectors = 6GB RAM
         100M vectors = 600GB RAM (→ compression critical)
```

---

## 4. Exact vs Approximate Nearest Neighbor

### Exact Nearest Neighbor — Brute Force

```
Query vector: q = [0.23, -0.87, ..., -0.31]
Database: N vectors

Algorithm:
  FOR each vector v in database:
    score = cosine_similarity(q, v)
  RETURN top-K by score

Complexity: O(N × D)  where D = dimensions
  N = 10M vectors, D = 1536: 10M × 1536 ops = 15.4 billion ops/query
  At 10ns/op → 154 seconds per query
  
Useless for production. Need ANN (Approximate Nearest Neighbor).
ANN: trade 1-5% accuracy for 100-1000× speedup
```

### ANN — HNSW (Hierarchical Navigable Small World)

The dominant algorithm in production vector databases (Pinecone, Weaviate, Qdrant):

```
Structure: multi-layer graph

Layer 2 (coarsest): ● ─────────── ● ─────── ●          (few nodes, long edges)
                    │             │
Layer 1:     ●─●─● ●─●─●─●─●─●─● ●─●─●─●─●─●          (more nodes, medium edges)
             │
Layer 0 (densest): ●─●─●─●─●─●─●─●─●─●─●─●─●─●─●─●    (all nodes, short edges)

Search algorithm:
  1. Enter graph at top layer (few nodes)
  2. Greedy walk: move to nearest neighbor that's closer to query
  3. Descend to next layer at that node
  4. Repeat → descend through layers
  5. At layer 0: exhaustive search of close neighborhood → exact results in small region

Why fast:
  Upper layers: few nodes → fast traversal → navigates to correct region
  Lower layers: local exhaustive search → accurate within that region
  Like zooming from world map → country → city → street
  
Complexity: O(log N) per query (vs O(N) brute force)
Recall: 95-99% (> 95% of exact top-K results included)
Build time: O(N × log N) — indexes must be built before queries

Memory: 2-3× raw vector size (graph links stored alongside vectors)
  10M vectors × 6KB × 2.5 = 150GB RAM
```

### ANN — IVF (Inverted File Index)

```
Two-phase approach: cluster first, search select clusters

Phase 1 (offline — build time):
  Run k-means: partition all N vectors into K clusters (K = √N typical)
  Assign each vector to nearest centroid
  Build K buckets: one inverted file per cluster
  
        centroid_1 → [vec_a, vec_c, vec_g, vec_k, ...]
        centroid_2 → [vec_b, vec_d, vec_h, vec_l, ...]
        ...
        centroid_K → [vec_z, vec_aa, ...]

Phase 2 (query time):
  1. Find nearest nprobe centroids to query (nprobe = 1-100, tunable)
  2. Search ONLY those nprobe clusters (brute force within clusters)
  3. Return top-K from candidates
  
Parameters:
  nprobe = 1:   fast but low recall (~70%)
  nprobe = 10:  balanced (85-90% recall, ~10× faster than full scan)
  nprobe = K:   = full scan (100% recall, no speedup)
  
Memory: similar to raw vector size (no graph overhead)
Trade-off vs HNSW:
  HNSW: faster queries, better recall, 2-3× more memory, slower build
  IVF: lower memory, faster build, slightly lower recall
```

### Product Quantization (PQ) — Compression for Billion Scale

```
Problem: 100M vectors × 1536 dims × 4 bytes = 614GB → won't fit in RAM

Product Quantization compresses vectors 8-64×:

Step 1: Split 1536-dim vector into 96 subvectors of 16 dims each
Step 2: Cluster each subspace into 256 centroids (one byte per subspace)
Step 3: Replace each subvector with its cluster ID (1 byte)
  Original: 1536 × 4 bytes = 6,144 bytes per vector
  PQ-compressed: 96 × 1 byte = 96 bytes per vector (64× compression!)

Distance computation: precomputed lookup tables for each subspace
  Approximate: slight accuracy loss, but enables billion-scale in practice
  
IVFPQ (most scalable): IVF clustering + PQ compression per bucket
  Used in: Facebook FAISS, for billion-scale ANN
```

---

## 5. Distance Metrics

```
Cosine Similarity (dot product of normalized vectors):
  = (A · B) / (|A| × |B|)
  Range: -1 to 1 (1 = identical direction, 0 = orthogonal, -1 = opposite)
  Use: text embeddings (semantic similarity)
       Works well when vector magnitude doesn't matter (only direction)

L2 (Euclidean) Distance:
  = √(Σ(Aᵢ - Bᵢ)²)
  Smaller = more similar (0 = identical)
  Use: image embeddings, spatial data, when magnitude matters
  
Dot Product (inner product, unnormalized):
  = Σ(Aᵢ × Bᵢ)
  Faster to compute than cosine (no normalization step)
  Use: recommendation systems (magnitude encodes popularity signal)
  
┌─────────────────────┬────────────────────────┬───────────────────────┐
│ Metric              │ Best For               │ Example               │
├─────────────────────┼────────────────────────┼───────────────────────┤
│ Cosine similarity   │ Text, NLP              │ Semantic search, RAG  │
│ L2 (Euclidean)      │ Images, geometry       │ Image similarity      │
│ Dot product         │ Recommendations        │ Netflix, Spotify      │
└─────────────────────┴────────────────────────┴───────────────────────┘
```

---

## 6. Hybrid Architecture (Reality)

```
Pure vector databases only store vectors + IDs → you need metadata filtering too

Query: "Find 10 documents similar to X WHERE author = 'Alice' AND date > 2024"

Option A — vector DB only:
  1. ANN search → fetch top-1000 candidates (over-fetch)
  2. Filter by author + date → keep matching subset
  3. Return top-10
  Problem: if only 5 result women match filter, need to fetch many more vectors

Better: Hybrid architecture:

  ┌─────────────────────────────────────────────────────────────────┐
  │               Application                                       │
  └──────────────┬─────────────────────────┬────────────────────────┘
                 │                         │
         ┌───────▼───────┐         ┌───────▼──────────┐
         │ Vector DB     │         │ PostgreSQL/MongoDB│
         │ (Pinecone,    │         │ (metadata, full  │
         │  Qdrant)      │         │  document text)  │
         └───────┬───────┘         └───────┬──────────┘
                 │                         │
         ANN query (semantic)       SQL filter (exact)
         returns: [(id, score), ...]  →  fetch full docs by id
                 │                         │
                 └────────────merge────────┘
                               ↓
                         Final ranked results

Flow: vector DB finds semantically similar IDs → SQL DB fetches full records + metadata
      Vector DB stores: vector + document ID + minimal metadata for pre-filter
      SQL DB stores: full document + all metadata + relational data
```

---

## 7. Performance Numbers

```
Vectors: 10M at 768 dims (all-MiniLM-L6-v2 output)
Database: Pinecone/Qdrant, HNSW index, 32 CPU cores

Query latency:
  p50:  8ms
  p99:  22ms
  p999: 45ms

Build time (index creation):
  HNSW on 10M vectors (768 dims): ~2-4 hours
  IVF on 10M vectors:             ~30 minutes

Memory:
  Raw: 10M × 768 × 4 bytes = 30GB
  HNSW index overhead (2.5×): ~75GB total
  With PQ (96 bytes per vector): ~1GB (30× compression, small recall loss)

Throughput:
  Single node (32 CPU):  ~2,000-5,000 QPS
  With replica cluster:  horizontally scales linearly
```

---

## 8. Retrieval-Augmented Generation (RAG)

```
The #1 use case for vector databases in 2024-2026:

RAG Architecture:
  ┌──────────────────────────────────────────────────────────────────┐
  │                                                                  │
  │  Step 1 — Ingestion (offline):                                  │
  │    Documents → chunk (512 tokens each) → embed → store in VDB   │
  │                                                                  │
  │  Step 2 — Query (online):                                        │
  │    User question → embed → ANN search → retrieve top-K chunks   │
  │    Chunks + user question → LLM → grounded answer               │
  │                                                                  │
  │  Why RAG?                                                        │
  │    LLMs have fixed knowledge cutoff and limited context window   │
  │    RAG: inject relevant dynamic documents into LLM context       │
  │    Result: up-to-date, grounded answers; no hallucination on facts│
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘

Flow:
  User: "What's our refund policy for SaaS products?"
  
  1. Embed query: "refund policy SaaS" → [0.12, -0.45, ...]
  2. Vector DB ANN: top-5 nearest chunks from policy docs
     → chunk_42: "SaaS subscriptions are non-refundable after 30 days..."
     → chunk_17: "Annual plans may receive pro-rated refund if..."
  3. LLM prompt:
     "Context: [chunk_42 + chunk_17]
      Question: What's our refund policy for SaaS products?
      Answer based on context only."
  4. LLM answers based on retrieved context → accurate, grounded
```

---

## 9. MERN Dev Notes

### Building a Simple RAG with Node.js + Pinecone

```javascript
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const index = pinecone.index('knowledge-base');

// Step 1: Embed and store documents at ingestion time
async function ingestDocument(doc) {
  const { data: [{ embedding }] } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: doc.content.slice(0, 8192)  // token limit
  });
  
  await index.upsert([{
    id: doc._id.toString(),
    values: embedding,              // the 1536-dim vector
    metadata: {                     // filterable metadata
      docType: doc.type,
      createdAt: doc.createdAt.toISOString(),
      title: doc.title
    }
  }]);
}

// Step 2: Semantic search at query time
async function semanticSearch(userQuery, filters = {}, topK = 5) {
  const { data: [{ embedding: queryVector }] } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: userQuery
  });
  
  const results = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    filter: filters   // e.g. { docType: { $eq: 'policy' } }
  });
  
  return results.matches.map(m => ({
    id: m.id,
    score: m.score,   // cosine similarity: higher = more similar
    metadata: m.metadata
  }));
}

// Step 3: RAG API endpoint
app.post('/api/ask', async (req, res) => {
  const { question } = req.body;
  
  // Find relevant documents (semantic similarity)
  const relevantChunks = await semanticSearch(question, {}, 5);
  const chunkIds = relevantChunks.map(c => c.id);
  
  // Fetch full content from MongoDB
  const docs = await Document.find({ _id: { $in: chunkIds } }).select('content title');
  const context = docs.map(d => `--- ${d.title} ---\n${d.content}`).join('\n\n');
  
  // Generate grounded answer
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Answer based only on the provided context. If not in context, say "I don\'t know".' },
      { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` }
    ]
  });
  
  res.json({
    answer: completion.choices[0].message.content,
    sources: docs.map(d => d.title)
  });
});
```

---

## 10. Real-World Case Studies

### Spotify — IVF + HNSW for Music Recommendations

```
Scale: 100M+ tracks, 600M+ users, real-time recommendations

Embedding: each track → 100-dim vector (ALS model on play history)
           each user → 100-dim vector (from listening patterns)
           
Recommendation: find K tracks (vectors) nearest to user vector
                = "tracks similar to this user's taste profile"

Architecture:
  Coarse layer: IVF with 1000 clusters → narrow to nearest few clusters
  Fine layer:   HNSW within each cluster → accurate local search
  Result:       Two-stage ANN = speed + accuracy
  
Use case segmentation:
  "Workout" user vector → embedding space far from "Study" listening
  Separate HNSW indexes per playlist context (workout, focus, commute)
  → Faster search, better recall within context
  
Scale handling:
  100M tracks × 100 dims × 4 bytes = 40GB
  HNSW 2.5× = 100GB per service replica
  3 replicas per data center × 2 DCs = ~600GB total vectors in RAM
  Response time: p99 < 15ms
```

### Airbnb — Listing Similarity Search

```
Use case: "Similar listings you might like" on listing detail page

Embedding: each listing → 256-dim vector
  Features encoded: location, price_tier, amenities, style, reviews sentiment
  Model: fine-tuned on user behavior data (clicked similar listings = should be close)
  Improvement: 30% higher CTR vs rule-based similar listings
  
Infrastructure:
  256-dim × 4 bytes × 7M listings = ~7GB raw
  HNSW index: ~17GB in RAM
  
Query:
  Input listing ID → fetch its 256-dim embedding
  ANN query: top-20 nearest vectors
  Filter: same city, similar price range (metadata filter in Pinecone)
  Return: 10 visually similar, price-appropriate listings
  
Latency: p50 = 6ms, p99 = 18ms (runs in parallel with page load)
Fine-tuning detail: embeddings retrained monthly on new click-through data
  → Model learns what "similar enough to click" means vs "too similar"
```

---

## 11. Interview Cheat Sheet

**Q: What is a vector database and when do you use one?**
> A vector database stores high-dimensional float vectors (embeddings) and answers "find the K vectors most similar to this query vector" efficiently using Approximate Nearest Neighbor algorithms. Use when: semantic similarity search (text, images, audio), recommendation systems (find similar items/users), RAG (retrieve relevant context for LLMs), anomaly detection (find items far from cluster). Don't use for: exact-match lookups, relational joins, transactional operations — use a traditional DB for those.

**Q: What is HNSW and why is it the dominant ANN algorithm?**
> Hierarchical Navigable Small World — a multi-layer graph where upper layers have few nodes with long-range links (for coarse navigation) and lower layers have all nodes with short links (for precise local search). Query starts at the top, greedy-walks to the closest node, descends. Achieves O(log N) query time with 95-99% recall. Downsides: 2-3× memory overhead vs raw vectors (graph links), slow index build time O(N log N). Dominant because it offers best recall/latency trade-off and supports incremental inserts.

**Q: What is the difference between cosine similarity and L2 distance?**
> Cosine similarity measures the angle between two vectors (0 to 1); L2 measures the geometric distance. Cosine is better for text embeddings because magnitude doesn't matter — "dog" mentioned once vs 10 times should still be semantically similar (same direction). L2 is better for image features or spatial data where magnitude carries information. Many vector DBs normalize embeddings first (unit vectors), making cosine = dot product = L2 equivalent.

**Q: How would you build a RAG system?**
> (1) Ingest: chunk documents into ~512 token pieces → embed each chunk → store embedding + chunk ID + metadata in vector DB, store full content + metadata in a relational/document DB. (2) Query: embed user question → ANN search in vector DB → retrieve top-K chunk IDs → fetch full text from relational DB → include as context in LLM prompt → LLM generates answer grounded in retrieved context. Key design choices: chunk size (512 = good starting point), embedding model (OpenAI text-embedding-3-small), number of retrieved chunks (5-10), metadata filtering for precision.

---

## 12. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Embedding** | Dense float vector encoding semantic meaning; output of ML model |
| **Vector Database** | Optimized storage + ANN search for high-dimensional vectors |
| **ANN** | Approximate Nearest Neighbor — fast similarity search with small accuracy trade-off |
| **HNSW** | Hierarchical Navigable Small World — dominant ANN algorithm; multi-layer graph |
| **IVF** | Inverted File Index — cluster-based ANN; lower memory than HNSW |
| **Product Quantization** | Compress vectors 8-64× by encoding subspaces into byte codes |
| **IVFPQ** | IVF + Product Quantization — for billion-scale ANN |
| **Cosine Similarity** | Angle between vectors; best for text; range -1 to 1 |
| **L2 Distance** | Euclidean distance; best for images/geometry; lower = more similar |
| **Dot Product** | Fast inner product; used in recommendations with magnitude-aware vectors |
| **k-means** | Clustering algorithm used in IVF to partition embedding space |
| **nprobe** | IVF parameter: how many clusters to search (recall/speed trade-off) |
| **RAG** | Retrieval-Augmented Generation — inject retrieved docs into LLM context |
| **Semantic Search** | Find conceptually similar content (not just keyword match) |
| **Recall@K** | % of exact top-K results included in ANN top-K results |
| **Pinecone** | Managed vector DB (serverless); popular for production RAG |
| **Qdrant** | Open-source vector DB; supports payload filtering; self-hostable |
| **Weaviate** | Open-source vector DB with hybrid BM25 + vector search |
| **FAISS** | Meta's open-source ANN library; gold standard for offline batch |
| **Chunking** | Splitting documents into smaller pieces (~512 tokens) before embedding |
