# RAG at Production Scale — Millions of Documents
> Resume Signal: production RAG, scalable ingestion, vector DB scaling, multi-tenant RAG, async pipelines

---

## The Two-Layered Challenge

Handling millions of documents in production RAG is a two-layered problem:
1. **Architecture** — which RAG variant (Traditional, CRAG, Self-RAG, Graph RAG) and its specific scaling pressures
2. **Infrastructure** — the ingestion pipeline, vector DB partitioning, caching, and orchestration that lets any RAG variant run at scale

This file covers both layers, with concrete AWS and Azure service mappings.

---

## Key Terms Defined

> Every term used in this file — no Googling needed.

| Term | What it is | Why it matters here |
|---|---|---|
| **Parquet** | Binary columnar file format (Apache project). Unlike CSV (row-by-row), Parquet stores data column-by-column — makes it extremely compressible and fast to read specific columns. Splittable across distributed workers. | Used as an intermediate checkpoint in the ingestion pipeline — write embeddings to Parquet on S3/Blob before bulk-inserting into the vector DB. Different failure modes from the DB write. |
| **Inverted index** | A data structure mapping each unique term → list of documents that contain it. Core of how Elasticsearch, OpenSearch, and Lucene do keyword search. `"apple" → [doc3, doc17, doc204]`. O(1) lookup per term. | OpenSearch uses an inverted index for BM25 keyword queries AND a separate HNSW graph for vector k-NN — both live in the same Lucene index |
| **Lucene** | Open-source Java search library that powers both Elasticsearch and OpenSearch. Provides the inverted index, BM25 scoring engine, and segment-based (immutable file bundle) storage format. Each OpenSearch shard IS a Lucene index. | Understanding Lucene explains why OpenSearch shards work the way they do — and why `refresh_interval` affects write throughput |
| **HNSW** (Hierarchical Navigable Small World) | Multi-layer graph structure for ANN search. Two key build-time parameters: `ef_construction` (size of the candidate list during graph build — higher = better recall, slower build) and `m` (number of bidirectional links each node has — higher = better recall, more memory). | Configured in the OpenSearch k-NN index settings JSON — tuning these parameters directly affects recall and storage size |
| **`ef_construction`** | HNSW build-time parameter. At index build, when inserting a new node, a candidate list of size `ef_construction` is maintained to find the best `m` neighbours. **Larger = better accuracy, slower build, same query-time performance.** Typical values: 256–512. | Setting too low (e.g., 64) produces a poor-quality graph with lower recall. Setting very high (e.g., 1024) slows ingestion with diminishing returns. |
| **`m`** (HNSW) | Number of **bidirectional links** per node in the HNSW graph. Each node links to `m` neighbours at each layer. **Larger m = higher recall + higher memory usage.** Typical: 8–32. Rule of thumb: `m=16` for 1536-dim vectors. | Doubling `m` roughly doubles the ANN index memory footprint. Balance recall vs RAM cost when sizing OpenSearch nodes. |
| **OCU** | **O**penSearch **C**ompute **U**nit — the capacity unit in **OpenSearch Serverless** (not standard OpenSearch Service). Search OCUs handle queries; Indexing OCUs handle writes. Auto-scales independently. You pay per OCU-hour. | Cited in the OpenSearch Serverless note — "auto-scales without manual shard management; pay-per-use OCU" — understanding OCUs helps estimate cost |
| **Sharding** | Splitting a large index into N independent shards, each stored on a different node. Increases total storage capacity (each node holds 1/N of the data). Queries are sent to all shards in parallel then aggregated. | OpenSearch config shows `"number_of_shards": 8` — rule of thumb: each shard ≤ 50 GB, target 1 shard per 2 CPU cores of the node |
| **Replicas** | Copies of each shard held on different nodes. Primary shard handles writes; replicas handle reads. `number_of_replicas: 2` = 3 total copies (1 primary + 2 replicas). Replicas increase read throughput and provide HA. | Azure AI Search uses the same concept: 3 replicas = 3× query-per-second (QPS) capacity |
| **HPA** (Horizontal Pod Autoscaler) | Kubernetes resource that automatically scales the number of pod **replicas** based on observed metrics (CPU utilisation, custom metrics). `minReplicas: 3, maxReplicas: 50` — scales between those bounds as load changes. | Used for the RAG query service pod on EKS/AKS — automatically handles traffic spikes without manual scaling |
| **DLQ** (Dead-Letter Queue) | A secondary queue where messages that fail processing after the configured maximum retries are automatically moved. Prevents a single bad message from blocking the main queue indefinitely. Engineers inspect the DLQ to understand and fix failures. | Every async ingestion pipeline should have a DLQ — document parsing failures, embedding API errors, and vector DB write failures all land here for investigation |
| **SQS visibility timeout** | After a consumer picks up an SQS message, the message becomes **invisible** to other consumers for the visibility timeout period (default: 30 seconds). If the consumer successfully processes the message, it deletes it. If it crashes, the message becomes visible again after the timeout and another consumer retries it. | Prevents duplicate processing — timeout must be longer than the maximum expected processing time per document chunk |
| **RRF** (Reciprocal Rank Fusion) | `score(d) = 1/(k + rank_bm25(d)) + 1/(k + rank_vector(d))`. Merges two ranked lists by rank position rather than raw scores (which may have different scales). k=60 is standard. Documents appearing high in both lists score highest. | Referenced in the multi-tenant section and best practices — used for hybrid BM25 + vector retrieval |
| **Semantic caching** | Caching RAG answers by embedding similarity instead of exact string match. A new query with embedding cosine similarity ≥ threshold (e.g., 0.92) against a cached query → return cached answer. Avoids retrieval + LLM call entirely. | High-ROI optimisation for production RAG — frequently asked questions are served in microseconds from Redis |
| **cosine similarity threshold** | The minimum cosine similarity score (0–1) between a new query embedding and a cached query embedding before returning the cached answer. Too low (0.7) = wrong answers served from cache. Too high (0.99) = almost no cache hits. 0.92 is a production-proven default. | Configurable constant (`CACHE_THRESH = 0.92`) in the semantic caching implementation |
| **Parquet bulk upsert** | Inserting thousands of embedding vectors to a vector DB in a single batch API call (e.g., OpenSearch `_bulk` API, Pinecone `index.upsert(vectors=[...])`) rather than one-by-one. Dramatically reduces insert time — 1000 row-by-row inserts can take 30s; a single batch takes 0.5s. | The ingestion pipeline writes embeddings to Parquet, then performs a single bulk upsert per batch of 1000–5000 vectors |

---

## Step 0 — Ingestion Pipeline at Scale

Before any RAG query runs, all documents must be ingested. At millions of documents, **the bottleneck shifts from the LLM to the ingestion pipeline**. The naive approach (synchronous chunk-embed-insert in a single process) fails at scale.

### Scalable Ingestion Flow

```
Raw documents  (PDFs, HTML, JSON, DOCX)
       ↓
Object Storage  (S3 / Azure Blob)
       ↓
Async Batch ETL  (Spark on EMR / Azure Databricks)
  - Document parsing  (Unstructured, LlamaParse, PyMuPDF)
  - Text extraction + cleaning
  - Chunking  (RecursiveCharacterTextSplitter, 900 chars, 200-char overlap)
       ↓
DECOUPLE embedding from vector DB write:
  - Generate embeddings in batch
  - Write intermediate Parquet files to S3 / Azure Blob first
  - Then bulk-insert from Parquet into vector DB
       ↓
Vector DB  (OpenSearch / Azure AI Search / Pinecone)
  - Bulk upsert (not row-by-row insert)
  - Use writeback batches of 1000–5000 vectors per API call
```

**Why decouple embedding from vector DB write?**  
- Embedding API calls and vector DB writes have different failure modes and rate limits
- Writing to Parquet first creates a checkpoint — if the vector DB upsert fails, you don't re-embed
- Parquet files are reusable for re-indexing (e.g., switching vector DB providers)

### AWS Ingestion Stack

| Stage | AWS Service | Notes |
|---|---|---|
| **Raw storage** | Amazon S3 | Lifecycle rules: Intelligent-Tiering for cost |
| **Trigger** | S3 Event → SQS → Lambda | Fan-out to processing workers on new doc upload |
| **Parsing + chunking** | AWS Glue (Spark) or EMR | Parallelise across millions of documents |
| **Embedding generation** | Amazon Bedrock Batch Inference | `amazon.titan-embed-text-v2`; batch API at scale |
| **Intermediate storage** | S3 (Parquet) | Embeddings written here before vector DB upsert |
| **Vector DB upsert** | Amazon OpenSearch Service | Bulk upsert via `_bulk` API; HNSW k-NN index |
| **Dead-letter queue** | SQS DLQ | Failed documents retry without blocking the pipeline |
| **Monitoring** | CloudWatch + AWS Glue job metrics | Track throughput, failed records, embedding latency |

> AWS tested 25M records against OpenSearch Service k-NN and RDS pgvector, measuring optimal ingestion rates at ~10K vectors/second with OpenSearch in ideal batch conditions.

### Azure Ingestion Stack

| Stage | Azure Service | Notes |
|---|---|---|
| **Raw storage** | Azure Blob Storage | |
| **Trigger** | Blob event → Event Grid → Azure Functions | |
| **Parsing + chunking** | Azure Databricks (Spark) | Notebook-based parallel ETL pipeline |
| **Embedding generation** | Azure OpenAI `text-embedding-3-large` via AML batch | |
| **Intermediate storage** | Azure Blob (Parquet) | |
| **Vector DB upsert** | Azure AI Search bulk index API | |
| **Dead-letter queue** | Azure Service Bus with DLQ | |
| **Monitoring** | Azure Monitor + Databricks job metrics | |

---

## Vector DB Scaling

### Amazon OpenSearch Service

- **HNSW k-NN index** for ANN search; configure `ef_construction` and `m` parameters
- **Sharding**: partition index across multiple shards (each shard = one Lucene index)
- **Replicas**: read replicas for query throughput (3 replicas = ~3× QPS)
- **OpenSearch Serverless**: auto-scales without manual shard management; pay-per-use OCU

```json
// OpenSearch k-NN index settings
{
  "settings": {
    "index": {
      "knn": true,
      "number_of_shards": 8,
      "number_of_replicas": 2
    }
  },
  "mappings": {
    "properties": {
      "embedding": {
        "type": "knn_vector",
        "dimension": 1536,
        "method": {
          "name": "hnsw",
          "engine": "nmslib",
          "parameters": { "ef_construction": 512, "m": 16 }
        }
      },
      "text":     { "type": "text" },
      "tenantId": { "type": "keyword" },
      "docId":    { "type": "keyword" }
    }
  }
}
```

### Azure AI Search Scaling

Two independent scaling axes:
- **Partitions** — horizontal storage scaling. Each partition holds a shard of the index. 2 partitions = 2× vector capacity and 2× indexing throughput.
- **Replicas** — query throughput scaling. 3 replicas = 3× concurrent query capacity.

| Configuration | Capacity |
|---|---|
| 1 partition, 1 replica | Baseline (~1M vectors) |
| 2 partitions, 1 replica | 2× storage |
| 2 partitions, 3 replicas | 2× storage + 3× QPS |

---

## Multi-Tenant RAG

Running RAG for multiple customers (tenants) from a single infrastructure requires strong data isolation.

### Recommended: Metadata Filter per Tenant (Single Index)

Use a `tenantId` metadata field on every vector. At query time, always filter:

```python
# Pinecone
results = index.query(
    vector=query_embedding,
    top_k=5,
    filter={"tenantId": {"$eq": current_tenant_id}},
)

# OpenSearch
{
  "query": {
    "bool": {
      "filter": [{ "term": { "tenantId": "tenant_abc" } }],
      "must":   [{ "knn": { "embedding": { "vector": [...], "k": 5 } } }]
    }
  }
}
```

**Pros:** Single index, lower cost, simpler ops.  
**Cons:** One tenant's large data can affect index performance for others.

### Alternative: Separate Index per Tenant

Required when tenants have strict data residency or compliance requirements (HIPAA, GDPR).  
**Cons:** Operational overhead scales with tenant count; not cost-efficient at thousands of tenants.

### Amazon Bedrock Multi-Tenant Pattern

Amazon Bedrock Knowledge Bases supports multi-tenant RAG via metadata filters — associate documents with a `tenantId` at ingestion time and filter at query time. See: [AWS multi-tenant RAG blog](https://aws.amazon.com/blogs/machine-learning/multi-tenant-rag-with-amazon-bedrock-knowledge-bases/).

---

## Semantic Caching

For repeated or semantically similar queries, avoid retrieval + LLM generation entirely.

```python
import redis
import numpy as np

r = redis.Redis(host="localhost", port=6379)
CACHE_TTL    = 3600   # 1 hour
CACHE_THRESH = 0.92   # cosine similarity threshold for cache hit

def semantic_cache_get(query_embedding: list[float]) -> str | None:
    # Scan cached queries (use Redis vector search in production: RediSearch)
    for key in r.scan_iter("cache:query:*"):
        cached_embedding = np.frombuffer(r.hget(key, "embedding"), dtype=np.float32)
        similarity = np.dot(query_embedding, cached_embedding) / (
            np.linalg.norm(query_embedding) * np.linalg.norm(cached_embedding)
        )
        if similarity >= CACHE_THRESH:
            return r.hget(key, "answer").decode()
    return None

def semantic_cache_set(query_embedding: list[float], answer: str, query_id: str):
    key = f"cache:query:{query_id}"
    r.hset(key, mapping={
        "embedding": np.array(query_embedding, dtype=np.float32).tobytes(),
        "answer":    answer,
    })
    r.expire(key, CACHE_TTL)
```

**In production:** Use **Redis Stack with RediSearch** (AWS ElastiCache / Azure Cache for Redis) which supports native vector similarity search over cached embeddings — much faster than a Python scan loop.

---

## CRAG at Scale

| Scaling Pressure | Solution |
|---|---|
| **Retrieval Evaluator is a bottleneck** | Batch evaluate chunks; use a cross-encoder re-ranker (no extra LLM call) or a fine-tuned T5-classifier instead of GPT-4o-mini |
| **Knowledge Refinement (strip scoring) multiplies LLM calls** | Run strip scoring async in parallel (`asyncio.gather`); cache strip scores for frequently retrieved doc+query pairs |
| **Web search rate limits (Incorrect path)** | Retry queues via SQS / Service Bus; exponential backoff; deduplicate web search queries |
| **Evaluator score caching** | Cache `(doc_id, query_cluster_id) → grade` in Redis so similar queries don't re-evaluate the same doc |

---

## Self-RAG at Scale

| Scaling Pressure | Solution |
|---|---|
| **Fine-tuned model hosting** | SageMaker real-time endpoint (AWS) or AML managed endpoint (Azure); 4-bit quantised 8B model (bitsandbytes / GPTQ) |
| **IsRelevant / IsSupported nodes = per-doc LLM calls** | Async batch per-doc grader calls; use GPT-4o-mini for IsRelevant, reserve full model for IsSupported only |
| **Reflection loops** | Hard cap: `MAX_RETRIES = 5`; implement circuit-breaker — if 5 retries still not `fully_supported`, return `partially_supported` answer with disclaimer |
| **Vector store** | OpenSearch Serverless (AWS) — auto-scales; no shard management |

---

## Graph RAG at Scale

| Scaling Pressure | Solution |
|---|---|
| **LLM entity extraction** | Parallelise extraction across EMR / Databricks workers; use cheaper model for extraction (Claude Haiku) |
| **Entity deduplication** | Weekly deduplication job with fuzzy matching + canonical name resolution before graph upsert |
| **Graph DB query latency** | Index entity name fields; cap traversal at 2–3 hops; cache hot subgraph results in Redis |
| **Community detection** | Run Leiden on Spark (GraphX / GraphFrames); re-run weekly as graph grows |
| **Map-Reduce global search cost** | k=10 community answer calls per global query; cache community summaries as pre-computed vectors |

---

## Async Ingestion with Dead-Letter Queues

```
Document upload to S3
       ↓
S3 Event → SQS (main queue)
       ↓
Lambda worker: parse → chunk → embed → upsert
       │
       ├── SUCCESS → delete from SQS
       └── FAILURE → SQS visibility timeout → retry (max 3)
                          ↓ after 3 retries
                     SQS DLQ (Dead-Letter Queue)
                          ↓
                     CloudWatch alarm → alert on-call
                     Manual review / re-process
```

Azure equivalent: **Azure Service Bus** with `maxDeliveryCount=3` and a dead-letter subqueue.

---

## Kubernetes Autoscaling for Inference

Both the RAG query service and LLM inference pods need to scale with traffic:

```yaml
# HPA for RAG query service on EKS / AKS
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: rag-query-service
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: rag-query-service
  minReplicas: 3
  maxReplicas: 50
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
    - type: Pods
      pods:
        metric:
          name: rag_queue_depth    # custom metric from CloudWatch / Azure Monitor
        target:
          type: AverageValue
          averageValue: "10"
```

---

## Monitoring — What to Track

| Metric | Why it matters | Tool |
|---|---|---|
| **Retrieval relevance score distribution** | Detect degrading retrieval quality over time | CloudWatch / Azure Monitor |
| **Evaluator routing ratio** (CRAG) | % Correct / Incorrect / Ambiguous — spikes in Incorrect = knowledge gap | Custom metric → dashboard |
| **Retrieval trigger rate** (Self-RAG) | % of queries that triggered retrieval — rising rate = model degradation | SageMaker Model Monitor |
| **Hallucination rate** | Measure with LLM-as-judge on sample outputs | Periodically sampled + logged |
| **End-to-end p50/p95/p99 latency** | User-facing quality; p99 shows tail latency issue | X-Ray / Application Insights |
| **Token usage per query** | Cost visibility; detect prompt injection attempts inflating context | Bedrock / OpenAI usage API |
| **Vector DB query latency** | ANN search degradation as index grows | OpenSearch Dashboards / AI Search metrics |
| **Ingestion pipeline throughput** | Docs/hour; detect ETL bottlenecks | Glue job metrics / Databricks logs |
| **Cache hit rate** | Low hit rate = caching thresholds need tuning | Redis INFO stats |

---

## Shared Best Practices (All RAG Variants)

| Practice | Why |
|---|---|
| **Decouple embedding compute from vector DB writes** | Write Parquet to S3/Blob first; bulk-insert from Parquet — different failure modes, enables re-indexing |
| **Always filter by `tenantId` in every query** | Prevent cross-tenant data leaks from vector search |
| **Semantic caching** | Cache (query_embedding, answer) in Redis with cosine threshold (0.92+) to skip retrieval + LLM for frequent questions |
| **Async DLQ-backed ingestion** | SQS / Service Bus DLQ; never lose a document silently |
| **Version your embedding models** | If you switch from `text-embedding-ada-002` to `text-embedding-3-large`, all embeddings are incompatible — re-ingest everything. Track model version in vector metadata |
| **Re-rank retrieved chunks** | Use a cross-encoder re-ranker (ms-marco, Cohere Rerank) to reduce k before injecting into LLM — dramatically improves quality |
| **Kubernetes HPA for inference pods** | Scale on both CPU and custom queue depth metrics |
| **Prompt injection monitoring** | Track unusually long context injections; validate retrieved content doesn't contain adversarial instructions |
| **Chunk metadata is as important as the chunk text** | Store `doc_id`, `source`, `date`, `tenantId`, `chunk_index` — enables filtering, debugging, and citation |

---

## RAG Variant Comparison at Scale

| Dimension | Traditional RAG | Self-RAG | CRAG | Graph RAG |
|---|---|---|---|---|
| **Retrieval trigger** | Always | Conditional | Always | Always |
| **LLM calls per query** | 1–2 | 1–2 (lower on avg) | 3–5 | 3–6 (local) / N×map + reduce (global) |
| **Fine-tuning required** | No | Yes | No | No |
| **Infrastructure** | Vector DB | Vector DB + fine-tuned model | Vector DB + web search | Vector DB + Graph DB + community summaries |
| **Cross-document reasoning** | No | No | No | Yes |
| **Hallucination control** | Grounding prompt | `[IsSup]` token | Evaluator + web fallback | Graph-grounded context |
| **Ingestion cost** | Low | Low | Low | High (LLM extraction + community detection) |
| **Query latency** | Low | Variable (lower average) | Higher (evaluator + refinement) | Highest (graph traversal) |
| **Best for** | General Q&A | High-volume, latency-sensitive | Incomplete/inconsistent knowledge bases | Cross-document relationship queries |
| **AWS managed service** | Bedrock Knowledge Bases | SageMaker endpoint | Bedrock + Step Functions | Neptune + OpenSearch + Bedrock |
| **Azure managed service** | Azure AI Foundry | AML endpoint | Azure Container Apps | Cosmos DB Gremlin + AI Search |
