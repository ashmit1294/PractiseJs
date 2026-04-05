# Traditional RAG — Retrieval-Augmented Generation
> Resume Signal: RAG pipeline, vector search, semantic retrieval, grounded LLM generation

---

## STAR Interview Answer

| | |
|---|---|
| **Situation** | A document Q&A system was needed to answer natural-language questions over a 50,000+ page knowledge base. Pure LLM calls hallucinated facts; keyword search returned syntactically matching but semantically wrong documents. |
| **Task** | Build a reliable RAG pipeline that grounds every LLM answer in retrieved evidence, eliminates hallucination, and scales to production document volumes. |
| **Action** | Chunked all documents (900-char chunks, 200-char overlap) with `RecursiveCharacterTextSplitter`. Generated embeddings using `text-embedding-3-large`, bulk-inserted into a vector store (Pinecone in prod, ChromaDB in dev). At query time: embed the user question, cosine similarity search top-k=5 chunks, assemble a prompt with retrieved context, and instruct the LLM to answer only from the provided context. Added metadata filters (doc type, date, tenant ID) for scoped retrieval. |
| **Result** | Answer accuracy rose from 54% (keyword search) to 91% (RAG). Hallucination rate dropped to near-zero. Retrieval latency was <80ms at p99 against 2M chunks using HNSW indexing. |

---

## ELI5

**Traditional RAG** is an open-book exam. Instead of asking the LLM to remember everything (closed-book, high hallucination risk), you first find the most relevant pages from a textbook (retrieval), then hand those pages to the LLM and ask it to answer from them only. The LLM's job shifts from "remember" to "read and summarise."

---

## Core Concepts

| Concept | What it is |
|---|---|
| **Chunking** | Splitting large documents into smaller passages (500–1500 chars) so each chunk has focused meaning |
| **Embedding** | Converting text into a dense float vector (1536–3072 dims) that encodes semantic meaning |
| **Vector DB** | Database optimised for ANN (Approximate Nearest Neighbour) similarity search over millions of vectors |
| **HNSW** | Hierarchical Navigable Small World — the graph algorithm behind fast ANN search (O(log n)) |
| **Cosine similarity** | Primary similarity metric; measures the angle between two vectors (1.0 = identical meaning) |
| **Top-k retrieval** | Return the k most similar chunks; typically k=3–10 depending on context window budget |
| **Grounding** | Instructing the LLM to answer *only* from retrieved context, preventing hallucination |

---

## Similarity Math

$$\text{cosine}(A, B) = \frac{A \cdot B}{\|A\| \cdot \|B\|}$$

| Score | Interpretation |
|---|---|
| 0.90 – 1.00 | Near-identical meaning |
| 0.75 – 0.90 | Highly relevant |
| 0.50 – 0.75 | Possibly relevant |
| < 0.50 | Likely unrelated — discard |

Always set a **minimum score threshold** (e.g., 0.7) to avoid injecting irrelevant context into the prompt.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  INGESTION PIPELINE (offline / batch)                    │
│                                                          │
│  Raw docs (PDF, HTML, JSON, MD)                          │
│      ↓                                                   │
│  Document Parser  (Unstructured, LlamaParse, PyMuPDF)    │
│      ↓                                                   │
│  Chunker  (RecursiveCharacterTextSplitter, 900 chars,    │
│            200-char overlap)                             │
│      ↓                                                   │
│  Embedding Model  (text-embedding-3-large / Titan)       │
│      ↓                                                   │
│  Vector DB  (Pinecone / OpenSearch / Azure AI Search)    │
│  + Metadata store  (doc_id, title, date, tenant)         │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  QUERY PIPELINE (real-time)                              │
│                                                          │
│  User question                                           │
│      ↓                                                   │
│  Embed query  (same model as ingestion)                  │
│      ↓                                                   │
│  ANN search  → top-k chunks  (+ metadata filter)         │
│      ↓                                                   │
│  Score threshold filter  (discard < 0.70)                │
│      ↓                                                   │
│  Prompt assembly:                                        │
│    system: "Answer only from the provided context"       │
│    context: <retrieved chunks 1..k>                      │
│    question: <user query>                                │
│      ↓                                                   │
│  LLM (GPT-4o / Claude / Bedrock Titan)                   │
│      ↓                                                   │
│  Grounded answer + source citations                      │
└──────────────────────────────────────────────────────────┘
```

---

## AWS Services for Traditional RAG

| Component | AWS Service | Notes |
|---|---|---|
| **Document storage** | Amazon S3 | Raw PDFs, HTML, JSON at rest |
| **Document parsing** | AWS Glue / Lambda | Trigger on S3 event; extract text |
| **Chunking + embedding** | AWS Lambda + Bedrock Embeddings | `amazon.titan-embed-text-v2` |
| **Vector store** | Amazon OpenSearch Service | k-NN index with HNSW; cosine similarity |
| **Managed RAG** | Amazon Bedrock Knowledge Bases | Auto-handles chunking → embedding → sync to vector store |
| **LLM generation** | Amazon Bedrock | Claude 3.5, Titan, Llama 3 |
| **Orchestration** | AWS Lambda + Step Functions | Chain ingestion and query steps |
| **Caching** | Amazon ElastiCache (Redis) | Cache embedded queries + answers for repeated questions |
| **Monitoring** | Amazon CloudWatch | Latency, retrieval scores, token usage |

**Key AWS detail:** `Amazon Bedrock Knowledge Bases` is the fully-managed Traditional RAG service — point it at an S3 bucket, select a vector store (OpenSearch, Pinecone, pgvector on Aurora), choose an embedding model, and it handles the rest. Under the hood it uses Titan Embeddings v2 and HNSW-based ANN search.

---

## Azure Services for Traditional RAG

| Component | Azure Service | Notes |
|---|---|---|
| **Document storage** | Azure Blob Storage | Raw documents; lifecycle rules for cost |
| **Document parsing** | Azure AI Document Intelligence | Extracts structured text from PDFs/images |
| **Chunking + embedding** | Azure Functions + Azure OpenAI | `text-embedding-3-large` (3072 dims) |
| **Vector store** | Azure AI Search | Vector fields + HNSW; hybrid = BM25 + vector |
| **Managed RAG** | Azure AI Foundry (formerly AI Studio) | End-to-end RAG pipeline builder |
| **LLM generation** | Azure OpenAI Service (GPT-4o) | |
| **Orchestration** | Azure Durable Functions / ACA | |
| **Caching** | Azure Cache for Redis | Semantic query cache |
| **Monitoring** | Azure Monitor + App Insights | Track retrieval latency + LLM cost |

**Key Azure detail:** `Azure AI Search` supports **hybrid retrieval** — combine BM25 keyword scoring with vector similarity using RRF (Reciprocal Rank Fusion). This outperforms pure vector search on queries with specific entity names or codes.

---

## Chunking Methods

| Method | How it works | Best for |
|---|---|---|
| **Fixed-size** | Split every N characters | Simple; fast; ignores structure |
| **RecursiveCharacterTextSplitter** | Split on `\n\n`, then `\n`, then ` `, respecting natural boundaries | General purpose documents |
| **Sentence splitter** | Split on sentence boundaries (`.`, `?`, `!`) | Prose-heavy content |
| **Semantic chunking** | Embed sentences; split where cosine similarity drops | Highest quality; computationally expensive |
| **Document structure splitter** | Split on headers / sections (Markdown, HTML) | Structured docs (wikis, docs sites) |

```javascript
// LangChain.js — RecursiveCharacterTextSplitter
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 900,       // characters, not tokens
  chunkOverlap: 200,    // overlap preserves context at chunk boundaries
  separators: ['\n\n', '\n', '. ', ' ', ''],
});

const chunks = await splitter.splitText(rawDocumentText);
// Each chunk is a string; add metadata before embedding
const docs = chunks.map((chunk, i) => ({
  id: `${docId}_chunk_${i}`,
  text: chunk,
  metadata: { docId, title, source, chunkIndex: i, date: new Date().toISOString() },
}));
```

---

## Embedding + Ingestion

```javascript
// Batch embedding + upsert to Pinecone
import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

const openai  = new OpenAI();
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index   = pinecone.index('knowledge-base');

async function embedAndUpsert(chunks) {
  // Batch embed (max 2048 inputs per call for text-embedding-3-large)
  const BATCH = 100;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: batch.map(c => c.text),
    });

    const vectors = embeddingResponse.data.map((e, j) => ({
      id:       batch[j].id,
      values:   e.embedding,
      metadata: batch[j].metadata,
    }));

    await index.upsert(vectors);
  }
}
```

---

## Query + Generation

```javascript
async function ragQuery(userQuestion, tenantId) {
  // 1. Embed the question
  const qEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: userQuestion,
  });
  const queryVector = qEmbedding.data[0].embedding;

  // 2. ANN search with metadata filter
  const searchResult = await index.query({
    vector:          queryVector,
    topK:            5,
    includeMetadata: true,
    filter:          { tenantId: { $eq: tenantId } },   // multi-tenant isolation
  });

  // 3. Score threshold filter
  const relevantChunks = searchResult.matches
    .filter(m => m.score >= 0.70)
    .map(m => m.metadata.text);

  if (relevantChunks.length === 0) {
    return { answer: "I don't have enough information to answer this.", sources: [] };
  }

  // 4. Assemble prompt + generate
  const context = relevantChunks.join('\n\n---\n\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0,    // deterministic for factual Q&A
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant. Answer ONLY using the provided context below.
If the context does not contain enough information, say "I don't know based on available documents."
Do not use prior knowledge.`,
      },
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${userQuestion}`,
      },
    ],
  });

  return {
    answer:  completion.choices[0].message.content,
    sources: searchResult.matches.filter(m => m.score >= 0.70).map(m => m.metadata.source),
  };
}
```

---

## Retrieval Quality Improvements

### Hybrid Retrieval (BM25 + Vector)

Combine keyword and semantic search — use RRF (Reciprocal Rank Fusion) to merge ranked lists:

```
Hybrid score = α × vector_score + (1-α) × bm25_score
```

Best when queries contain specific entity names, product codes, or dates that embedding models may underweight.

### HyDE — Hypothetical Document Embeddings

Instead of embedding the raw question, ask the LLM to generate a *hypothetical answer*, then embed that. The hypothetical answer is semantically closer to actual retrieved documents than a short question is.

```javascript
async function hydeQuery(question) {
  // Generate hypothetical answer
  const hypo = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: `Write a short paragraph that would answer: ${question}` }],
  });
  const hypotheticalDoc = hypo.choices[0].message.content;

  // Embed the hypothetical answer (not the question)
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: hypotheticalDoc,
  });
  return embedding.data[0].embedding;
}
```

### Multi-Query Retrieval

Generate 3–5 paraphrases of the original question, retrieve for each, deduplicate results. Improves recall for ambiguous or short queries.

---

## Common Failure Modes

| Failure | Cause | Fix |
|---|---|---|
| **Irrelevant chunks retrieved** | Chunk too large / question too short | Smaller chunks; HyDE; multi-query |
| **Answer ignores context** | System prompt not strong enough | Explicit grounding instruction; temperature=0 |
| **Context window overflow** | Too many large chunks | Reduce k; increase chunking overlap; re-rank |
| **Cold start latency** | Embedding model call in critical path | Pre-warm Lambda; embed at ingestion time |
| **Stale answers** | Vector DB not re-indexed after doc update | Incremental ingestion trigger on S3/Blob events |
| **Multi-tenant data leak** | No metadata filter on vector search | Always filter by `tenantId` in every query |

---

## Interview Questions

**Q: Why do you overlap chunks?**  
A: Context at the boundary of a chunk is split. Without overlap, a sentence about the key concept might get split across two chunks and neither chunk has the full context. 200-char overlap ensures the surrounding sentence is present in both adjacent chunks.

**Q: Why not just embed the entire document?**  
A: The embedding of a 10-page document averages the meaning of all 10 pages. A specific question about page 7 would have a low similarity score with that averaged vector, even though the answer exists. Chunking isolates meaning so the vector closely represents a specific topic.

**Q: Why use cosine similarity vs L2 distance?**  
A: Cosine similarity is invariant to vector magnitude — it measures direction only. Two texts of different length (short question, long passage) can still have high cosine similarity if they're about the same topic. L2 distance is sensitive to length differences.

**Q: What is the context window bottleneck in RAG?**  
A: If k=10 and each chunk is 1500 chars (~375 tokens), you inject 3750 tokens of context. GPT-4o's 128K window handles this comfortably, but at k=50 or very large chunks, you approach limits — and longer contexts cost more and may dilute attention on the most relevant chunk. Re-ranking (cross-encoder) helps reduce k before injection.
