# RAG — Interview Revision Summary

> **Target:** 7+ year Full Stack MERN / AI Developer | **Files:** 6

## Table of Contents

1. [01 — Traditional RAG](#rag-traditional)
2. [02 — Self-RAG](#rag-self)
3. [03 — CRAG](#rag-crag)
4. [04 — Graph RAG](#rag-graph)
5. [05 — Production at Scale](#rag-production)
6. [06 — Vectorless RAG](#rag-vectorless)

---

<a id="rag-traditional"></a>
## 01 — Traditional RAG

**STAR:** Keyword search returned semantically wrong docs → RAG pipeline: chunk (900 chars, 200 overlap) → embed (`text-embedding-3-large`) → Pinecone/ChromaDB → cosine ANN search top-k=5 → inject into GPT-4o with grounding prompt → accuracy 54% → 91%, hallucination near-zero, <80ms p99 retrieval.

### Core Concepts

| Concept | What it is |
|---|---|
| **Chunking** | Split docs into 500–1500 char segments; each chunk = focused meaning unit |
| **Embedding** | Dense float vector (1536–3072 dims) encoding semantic meaning |
| **HNSW** | Hierarchical NSW — approximate nearest neighbour algorithm, O(log n) |
| **Cosine similarity** | $\frac{A \cdot B}{\|A\|\|B\|}$ — anglebetween vectors; 1.0 = identical meaning |
| **Top-k retrieval** | Return k most similar chunks (k=3–10) |
| **Grounding** | System prompt: "Answer ONLY from provided context" |

### Cosine Score Interpretation

| Score | Interpretation |
|---|---|
| 0.90–1.00 | Near-identical |
| 0.75–0.90 | Highly relevant |
| 0.50–0.75 | Possibly relevant |
| < 0.50 | Discard |

Always set a **minimum score threshold** (0.70) to avoid injecting irrelevant context.

### Chunking Methods

| Method | Best for |
|---|---|
| **Fixed-size** | Simple, fast |
| **RecursiveCharacterTextSplitter** | General purpose (splits on `\n\n` → `\n` → `. ` → ` `) |
| **Sentence splitter** | Prose-heavy content |
| **Semantic chunking** | Highest quality; splits where cosine similarity drops |
| **Structure splitter** | Markdown/HTML headers |

### Retrieval Quality Improvements

- **HyDE** — generate a hypothetical answer, embed *that* (semantically closer to actual docs than the raw question)
- **Multi-query** — generate 3–5 paraphrases, retrieve for each, deduplicate; improves recall on ambiguous queries
- **Hybrid retrieval** — combine BM25 keyword + vector via RRF: `α × vector_score + (1−α) × bm25_score`
- **Re-ranking** — cross-encoder on top-50 candidates narrows to top-5 with higher precision

### AWS Services

| Component | Service |
|---|---|
| Storage | S3 |
| Parsing + chunking | AWS Glue / Lambda |
| Embeddings | Bedrock Titan Embeddings v2 |
| Vector store | OpenSearch Service (HNSW k-NN) |
| Managed RAG | **Bedrock Knowledge Bases** (auto chunk → embed → sync) |
| LLM | Bedrock (Claude, Titan, Llama) |
| Cache | ElastiCache Redis |

### Azure Services

| Component | Service |
|---|---|
| Storage | Azure Blob Storage |
| Parsing | Azure AI Document Intelligence |
| Embeddings | Azure OpenAI `text-embedding-3-large` |
| Vector store | **Azure AI Search** (HNSW + hybrid BM25+vector) |
| Managed RAG | Azure AI Foundry |
| LLM | Azure OpenAI GPT-4o |

### Common Failures

| Failure | Fix |
|---|---|
| Irrelevant chunks | HyDE; multi-query; smaller chunks |
| Answer ignores context | Stronger grounding prompt; temperature=0 |
| Context window overflow | Smaller k; cross-encoder rerank |
| Multi-tenant data leak | Always filter by `tenantId` in every query |

---

<a id="rag-self"></a>
## 02 — Self-RAG

**STAR:** 500K queries/day running retrieval on every query including trivial ones → Self-RAG with fine-tuned Llama-3-8B emitting reflection tokens → retrieval triggered on only 40% of queries → latency 1.4s → 0.6s, ASQA benchmark +11 points.

### The 3 Problems Self-RAG Fixes

| # | Problem | Description |
|---|---|---|
| 1 | **Indiscriminate Retrieval** | RAG retrieves even when LLM parametric knowledge is sufficient — adds noise |
| 2 | **Blind Trust in Docs** | RAG passes all retrieved docs to LLM without checking if they're relevant |
| 3 | **No Self-Verification** | No post-generation check — hallucinated answers go straight to users |

### 4 Reflection Tokens

| Token | Values | Purpose |
|---|---|---|
| `[Retrieve]` | Yes / No / Continue | Should I fetch evidence? |
| `[IsRel]` | Relevant / Irrelevant | Is this passage relevant? |
| `[IsSup]` | Fully supported / Partially / No support | Does my answer match the passage? |
| `[IsUse]` | 1–5 | Is my response useful? |

### 7-Node LangGraph Architecture (Practical — no fine-tuning)

```
User Query
    ↓
[1: Decide Retrieval]  →  NO  →  [Direct Generate]  →  END
    ↓ YES
[2: Retrieve]  →  [3: Is Relevant?]  →  No relevant docs  →  END
    ↓ relevant docs found
[4: Generate from Context]
    ↓
[5: Is Supported?]  →  not fully  →  [6: Revise Answer]  ←── loop (max_retries)
    ↓ fully supported
[7: Is Useful?]  →  YES → END  |  NO → "No Answer Found" → END
```

### State Schema

| Field | Type | Purpose |
|---|---|---|
| `need_retrieval` | bool | Output of Node 1 |
| `docs` | list | All retrieved docs |
| `relevant_docs` | list | Filtered (Node 3) |
| `context` | str | Merged relevant docs text |
| `answer` | str | Current answer (may be revised) |
| `is_support` | str | `fully_supported` / `partially_supported` / `not_supported` |
| `is_use` | str | `useful` / `not_useful` |
| `retries` | int | Retry counter — prevents infinite loops |

### Two Self-Reflection Loops

```
Loop 1 — Hallucination:   Node 5 → Node 6 → Node 5  (break: fully_supported OR retries ≥ MAX)
Loop 2 — Usefulness:   Node 7 → Rewrite → Node 2 → ... → Node 7  (break: useful OR retries ≥ MAX)
```

Both loops **must have hard retry caps** (MAX_RETRIES=5).

### Key Implementation Detail

All reflection checks use **Pydantic + `with_structured_output()`** — deterministic JSON. Node 3 loops over each doc individually (not bulk). Node 5 receives `question + answer + context` together.

### Self-RAG vs Traditional RAG

| Dimension | Traditional RAG | Self-RAG |
|---|---|---|
| Retrieval trigger | Always | Conditional (≈ 40–60% of queries) |
| Hallucination control | Grounding prompt | `[IsSup]` self-verification |
| Fine-tuning | Not needed | Required for token approach |
| LLM calls/query | 1–2 | 1–2 (lower average) |
| Best for | Plug-and-play | High-volume, latency-sensitive |

### AWS / Azure

- **AWS:** SageMaker endpoint (fine-tuned model), OpenSearch Serverless, Step Functions + LangGraph on ECS
- **Azure:** AML managed endpoint, Azure AI Search, Azure Durable Functions, AKS + HPA

---

<a id="rag-crag"></a>
## 03 — CRAG

**STAR:** RAG giving confidently wrong answers when internal docs didn't contain the answer → CRAG: Retrieval Evaluator scores each chunk → 3-way routing → Correct → Knowledge Refinement → Incorrect → Web Search → Ambiguous → both → accuracy 71% → 89%, hallucination on out-of-scope queries 34% → 6%.

### Architecture — 3 Routing States

```
Query → Retrieve → [Retrieval Evaluator: score 0–1]
    ├── CORRECT (≥ 0.8)   → Knowledge Refinement  →  Generate
    ├── INCORRECT (< 0.4) → Web Search            →  Generate
    └── AMBIGUOUS (0.4–0.8) → Both paths parallel →  Merge → Generate
```

### Knowledge Refinement — Decompose → Filter → Recompose

```
Doc → Strips (sentence-level) → Score each strip (relevant?: Y/N) → Keep only relevant → Recompose
```
Removes noise (headers, disclaimers, off-topic paragraphs) before LLM sees the context.

### Retrieval Evaluator Options

| Option | Cost | Quality |
|---|---|---|
| Cross-encoder re-ranker (ms-marco) | Low (no LLM call) | High |
| Fine-tuned T5 classifier | Very low | Good |
| Prompted LLM (GPT-4o-mini) | Medium | Highest flexibility |

### CRAG vs Self-RAG

| Dimension | CRAG | Self-RAG |
|---|---|---|
| Retrieval trigger | Always (evaluates after) | Conditional (before) |
| LLM calls/query | 3–5 | 1–2 |
| Fine-tuning | No | Yes (for token approach) |
| Web search fallback | Built-in (Incorrect path) | Not native |
| Best for | Incomplete/inconsistent KB | High-volume, latency-sensitive |

### AWS / Azure

- **AWS:** Bedrock (eval + generation), OpenSearch, Lambda evaluator, Tavily/Kendra for web search, SQS for retry queues
- **Azure:** Azure AI Search, Azure Functions, Bing Search API, Service Bus for retry

---

<a id="rag-graph"></a>
## 04 — Graph RAG

**STAR:** Legal research needed cross-doc queries ("How are Company A's subsidiaries connected to regulatory issues across 500 filings?") — Traditional RAG returned isolated chunks → Graph RAG: extract entities + relationships → Neo4j → graph traversal at query time → cross-document relationship queries now precise and source-cited.

### Why Graph RAG

Traditional RAG can't answer: *"What are all entities connected to X across documents?"* or *"What are the key themes across the entire corpus?"* — these require **traversing relationships**, not finding similar text.

### Two Query Modes

| Mode | Question type | Method |
|---|---|---|
| **Local search** | Entity-specific: "What did X say about Y?" | Graph traversal BFS/DFS 1–3 hops from seed entity |
| **Global search** | Thematic: "What are the key themes?" | Community summaries via Map-Reduce |

### Ingestion Pipeline

```
Chunks → LLM Entity Extraction → (entities + relationships) → Graph DB (Neo4j / Neptune / Cosmos Gremlin)
    ↓
Community Detection  (Leiden algorithm)
    ↓
Community Summaries  (LLM-generated per cluster)
    ↓
Vector DB  (entity embeddings + summary embeddings)
```

### Global Search — Map-Reduce

```
Query → Retrieve relevant community summaries (k=10)
    ↓ MAP: LLM generates partial answer per community (parallelisable)
    ↓ REDUCE: LLM aggregates partial answers → final answer
```

### Key Challenges

| Challenge | Solution |
|---|---|
| Entity deduplication | Fuzzy match + canonical name resolution before upsert |
| Graph query latency | Index entity names; cap traversal at 2–3 hops; cache hot subgraphs in Redis |
| Extraction cost | Use Claude Haiku/GPT-4o-mini for extraction |
| Community re-generation | Weekly scheduled job as graph grows |

### Graph RAG vs Traditional RAG

| Dimension | Traditional RAG | Graph RAG |
|---|---|---|
| Cross-document linking | No | Yes (graph edges) |
| Multi-hop reasoning | No | Yes (traversal) |
| Thematic/global queries | Poor | Excellent (community summaries) |
| Ingestion cost | Low | High (LLM extraction + community detection) |
| Infrastructure | Vector DB | Vector DB + Graph DB + summaries |

### AWS / Azure

- **AWS:** S3, EMR/Glue (extraction), **Amazon Neptune** (graph DB), OpenSearch (vectors), Bedrock
- **Azure:** Blob, Databricks (extraction), **Azure Cosmos DB Gremlin** (graph DB), AI Search, Azure OpenAI
- **Microsoft GraphRAG toolkit**: open-source library that runs full pipeline → Azure OpenAI + AI Search natively

---

<a id="rag-production"></a>
## 05 — Production at Scale

### Ingestion Pipeline at Scale

```
S3/Blob (raw docs)
    ↓  Spark (EMR / Databricks) — parse, chunk, clean
    ↓  Embed (batch API)  →  write Parquet to S3/Blob FIRST
    ↓  Bulk upsert from Parquet into vector DB (1000–5000 vectors/call)
```

**Key principle: decouple embedding from vector DB write** — different failure modes; Parquet = checkpoint for re-indexing.

### Vector DB Scaling

**OpenSearch:** `number_of_shards` (write throughput + storage), `number_of_replicas` (read QPS)  
**Azure AI Search:** **Partitions** = storage scaling, **Replicas** = QPS scaling (orthogonal)

### Multi-Tenant RAG

✅ **Preferred**: Single index + `tenantId` metadata filter on every query  
❌ **Avoid unless compliance-required**: Separate index per tenant (operational overhead)

### Semantic Caching

Cache `(query_embedding, answer)` in Redis. On new query, compute cosine similarity to cached embeddings — if > 0.92 threshold, return cached answer directly (skip retrieval + LLM).

### Shared Best Practices

| Practice | Why |
|---|---|
| Decouple embed ↔ vector DB write | Different failure modes; enables re-indexing |
| Always filter by `tenantId` | Prevent cross-tenant vector search leaks |
| Semantic cache (Redis, cosine ≥ 0.92) | Skip retrieval + LLM for repeated queries |
| DLQ-backed async ingestion | Never silently lose a failed document |
| Version embedding models | Switching models requires full re-ingestion of all vectors |
| Cross-encoder re-ranking | BM25/vector top-50 → reranker → top-5; biggest quality boost |
| K8s HPA on CPU + queue depth | Scale inference pods with both metrics |

### Monitoring Metrics

| Metric | Why |
|---|---|
| Retrieval relevance score distribution | Detect degrading retrieval quality |
| Evaluator routing ratio (CRAG) | Spikes in Incorrect% = knowledge gap |
| Retrieval trigger rate (Self-RAG) | Rising = model degradation |
| p50/p95/p99 latency | Tail latency issues |
| Token usage per query | Cost + prompt injection detection |
| Cache hit rate | Tuning threshold |

### Full Variant Comparison

| Dimension | Traditional | Self-RAG | CRAG | Graph RAG |
|---|---|---|---|---|
| Retrieval trigger | Always | Conditional | Always | Always |
| LLM calls/query | 1–2 | 1–2 (avg lower) | 3–5 | 3–6+ |
| Fine-tuning | No | Yes | No | No |
| Cross-doc reasoning | No | No | No | Yes |
| Infrastructure | Vector DB | Vector DB + model | VDB + web search | VDB + Graph DB |
| Best for | General Q&A | High-volume | Incomplete KB | Relationship queries |

---

<a id="rag-vectorless"></a>
## 06 — Vectorless RAG

**STAR:** 200K policy docs already in Elasticsearch, budget ruled out vector DB → Vectorless RAG: BM25 retrieval + cross-encoder reranker (ms-marco) + GPT-4o generation → 84% accuracy (vs 91% with vectors), 70% lower infrastructure cost.

### Why Vectorless?

- Existing Elasticsearch/OpenSearch already deployed
- Queries are keyword-heavy (product codes, legal citations, exact names)
- Regulated industry (HIPAA/GDPR) — can't send docs to external embedding APIs
- Small corpora → long-context stuffing is cheaper and simpler

### The 5 Methods

| Method | Mechanism | Best for |
|---|---|---|
| **BM25** | Term frequency + IDF statistics | Exact-match; codes; IDs; proper nouns |
| **TF-IDF + cosine** | Sparse vectors, sklearn | No external dependencies; interpretable |
| **Cross-encoder reranking** | BM25 top-50 → cross-encoder re-scores → top-5 | **Best quality without vector DB** |
| **Long-context LLM** | Stuff top-20 BM25 docs into 128K–200K context window | Corpora < 500 docs; simplest approach |
| **SPLADE** | Learned sparse vectors via BERT → stored in inverted index | Semantic BM25 without dense vector DB |

### BM25 Formula

$$\text{BM25}(q, d) = \sum_{t \in q} \text{IDF}(t) \cdot \frac{f(t,d) \cdot (k_1+1)}{f(t,d)+k_1(1-b+b\frac{|d|}{\text{avgdl}})}$$

$k_1=1.5$, $b=0.75$ (tunable). Penalises common words (IDF), rewards term frequency, normalises for doc length.

### Cross-Encoder vs Bi-Encoder

| | Bi-encoder (vector RAG) | Cross-encoder (vectorless) |
|---|---|---|
| Input | Query alone + Doc alone → separate embeddings | `[CLS] Query [SEP] Doc [SEP]` → one score |
| Pre-compute docs | Yes | No |
| Precision | Good | Higher (joint attention) |
| Scale | Millions of docs | Top-50 candidates only |

### "Lost in the Middle" Problem

LLMs perform best on content at the **beginning and end** of a long context. Information in the middle of a 128K-token stuffed context is effectively invisible. Fix: put most relevant docs first/last, or use retrieval to reduce to top-5–10.

### AWS / Azure

- **AWS:** OpenSearch (BM25 mode), **Amazon Kendra** (ML-enhanced keyword search; HIPAA-eligible; reads S3/SharePoint/Confluence natively), Lambda + SageMaker (cross-encoder), Bedrock (generation)
- **Azure:** Azure AI Search (BM25 mode), **Azure AI Search semantic ranking** (built-in cross-encoder reranker with `queryType: "semantic"` — no separate model deployment), Azure OpenAI

### Vectorless vs Vector RAG

| Dimension | Vectorless | Vector RAG |
|---|---|---|
| Embedding required | No | Yes |
| Exact match (codes/IDs) | Excellent | Good |
| Semantic / paraphrase | Weaker | Excellent |
| Cost | Low | Higher |
| Latency | Lower (BM25 sub-ms) | Higher |
| Compliance / air-gapped | Fully local | Requires embedding API (external) |
| Best for | Existing Elasticsearch, regulated industries | General semantic Q&A |

### Hybrid RRF (Best of Both)

```python
# Reciprocal Rank Fusion: merge BM25 + vector ranked lists
score(d) = 1/(60 + rank_bm25(d)) + 1/(60 + rank_vector(d))
```

Both Azure AI Search and OpenSearch support hybrid BM25 + vector with RRF natively.

---

## RAG Quick Reference

| Variant | Trigger | Problem solved | Needs fine-tuning | Cloud shortcut |
|---|---|---|---|---|
| **Traditional** | Always | Basic semantic Q&A over docs | No | Bedrock KB / Azure AI Foundry |
| **Self-RAG** | Conditional | Indiscriminate retrieval, no self-check | Yes (or LangGraph simulation) | SageMaker / AML endpoint |
| **CRAG** | Always + evaluate | Incomplete KB, retrieval quality varies | No | Bedrock + Step Functions |
| **Graph RAG** | Always | Cross-doc relationships, thematic queries | No | Neptune / Cosmos Gremlin + Bedrock |
| **Vectorless** | Always (BM25) | No vector infra, regulated env, exact match | No | Kendra / Azure AI Search semantic rank |
