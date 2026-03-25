# Vector Databases & RAG Pipelines
> Resume Signal: RAG pipeline using ChromaDB and Pinecone, semantic search, document Q&A

---

## STAR Interview Answer

| | |
|---|---|
| **Situation** | A document Q&A feature needed to answer natural-language questions over a 10,000+ document knowledge base. Keyword search (Elasticsearch) returned syntactically matching but semantically wrong documents — "car insurance" queries missed documents that said "vehicle coverage". |
| **Task** | Build a Retrieval-Augmented Generation (RAG) pipeline that retrieves semantically relevant documents and uses an LLM to synthesise a grounded answer — without hallucination from knowledge the LLM invented. |
| **Action** | Chunked documents into 512-token overlapping segments (overlap to preserve context at boundaries). Generated embeddings with `text-embedding-ada-002`, stored in Pinecone (production) and ChromaDB (local dev). At query time: embed the user query, cosine similarity search top-k=5 chunks, inject into GPT-4o context window as retrieved context, instruct the model to only answer from provided context. Added metadata filters (document type, date range) to scope retrieval. |
| **Result** | Semantic recall improved dramatically — relevant documents retrieved that keyword search missed. Answer accuracy (measured by human eval on a test set) improved from 54% (keyword) to 88% (RAG). Hallucination rate dropped to near-zero because the model was grounded in retrieved text. |

---

## ELI5

A **vector** is a list of numbers that represents the *meaning* of a piece of text. "Dog" and "puppy" end up with similar vectors because they're semantically close; "dog" and "accounting" end up with very different vectors. A **vector database** stores millions of these meaning-lists and can answer: "which of these is most similar to my query?" in milliseconds. **RAG** is: find the most relevant text chunks first, then give them to the LLM as context, so the LLM answers *from evidence* rather than from memory.

---

## Core Concepts

| Concept | What it is | Analogy |
|--|--|--|
| Embedding | Dense float vector (e.g., 1536 dims) representing semantic meaning | GPS coordinates for meaning-space |
| Vector DB | DB optimised for similarity search (cosine, dot product, L2) | Index for the meaning-space |
| HNSW | Approximate Nearest Neighbour algorithm (Hierarchical NSW) | Skiplist for vectors — O(log n) search |
| Cosine similarity | Angle between two vectors (1.0 = identical, 0 = unrelated, -1 = opposite) | How aligned are two arrows? |
| Chunking | Splitting documents into smaller pieces before embedding | Book chapters → pages → paragraphs |
| RAG | Retrieve relevant chunks, inject as context, generate grounded answer | Open-book exam vs closed-book |
| Hallucination | LLM inventing facts not in training data | Confident wrong answers |

---

## Vector Similarity Math

$$\text{cosine}(A, B) = \frac{A \cdot B}{\|A\| \cdot \|B\|}$$

- Score of **1.0** → identical meaning  
- Score of **0.7–0.9** → semantically similar  
- Score < **0.5** → likely unrelated  

Most vector DBs let you set a minimum score threshold to discard low-quality results.

---

## RAG Pipeline Architecture

```
                    ┌─────────────────────────────────────┐
INGESTION           │                                     │
                    │  Documents (PDF, MD, HTML, DB rows) │
                    │         ↓                           │
                    │     Chunker                         │
                    │  (512 tokens, 50-token overlap)     │
                    │         ↓                           │
                    │   Embedding Model                   │
                    │  (text-embedding-ada-002)           │
                    │         ↓                           │
                    │     Vector DB (Pinecone / Chroma)   │
                    │  + Metadata (doc_id, date, type)    │
                    └─────────────────────────────────────┘

                    ┌─────────────────────────────────────┐
QUERY               │                                     │
                    │  User question                      │
                    │         ↓                           │
                    │   Embed query                       │
                    │         ↓                           │
                    │   Similarity search (top-k=5)       │
                    │   + metadata filter                 │
                    │         ↓                           │
                    │   Retrieved chunks                  │
                    │         ↓                           │
                    │   Prompt assembly                   │
                    │   (system + context + question)     │
                    │         ↓                           │
                    │   LLM (GPT-4o)                      │
                    │         ↓                           │
                    │   Grounded answer                   │
                    └─────────────────────────────────────┘
```

---

## Implementation

### Document ingestion pipeline

```javascript
import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index    = pinecone.index('knowledge-base');

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,          // tokens (approx 400 words)
  chunkOverlap: 50,        // overlap preserves context at chunk boundaries
  separators: ['\n\n', '\n', '. ', ' ', ''],  // prefer paragraph → sentence splits
});

async function embedText(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return response.data[0].embedding;   // float[1536]
}

async function ingestDocument(doc) {
  const chunks = await splitter.splitText(doc.content);

  // Batch embed (OpenAI allows up to 2048 strings per request)
  const embeddings = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: chunks,
  });

  const vectors = chunks.map((chunk, i) => ({
    id:       `${doc.id}-chunk-${i}`,
    values:   embeddings.data[i].embedding,
    metadata: {
      docId:   doc.id,
      type:    doc.type,           // 'policy', 'faq', 'guide'
      date:    doc.date,
      text:    chunk,              // store text in metadata for retrieval
      chunkIndex: i,
    },
  }));

  // Upsert in batches of 100 (Pinecone limit per request)
  for (let i = 0; i < vectors.length; i += 100) {
    await index.upsert(vectors.slice(i, i + 100));
  }

  console.log(`Ingested ${chunks.length} chunks from doc ${doc.id}`);
}
```

### Query pipeline

```javascript
async function ragQuery(userQuestion, filters = {}) {
  // 1. Embed the query
  const queryEmbedding = await embedText(userQuestion);

  // 2. Similarity search with optional metadata filters
  const searchResult = await index.query({
    vector: queryEmbedding,
    topK:   5,
    includeMetadata: true,
    filter: {
      ...(filters.type && { type: { $eq: filters.type } }),
      ...(filters.dateAfter && { date: { $gte: filters.dateAfter } }),
    },
  });

  // 3. Filter by minimum relevance score
  const relevantChunks = searchResult.matches
    .filter(m => m.score > 0.75)
    .map(m => m.metadata.text);

  if (relevantChunks.length === 0) {
    return { answer: 'I could not find relevant information to answer this question.', sources: [] };
  }

  // 4. Build grounded prompt
  const context = relevantChunks
    .map((chunk, i) => `[${i + 1}] ${chunk}`)
    .join('\n\n');

  const messages = [
    {
      role: 'system',
      content: `You are a helpful assistant. Answer ONLY based on the provided context. 
If the answer is not in the context, say "I don't have enough information." 
Do not use any outside knowledge.`,
    },
    {
      role: 'user',
      content: `Context:\n${context}\n\nQuestion: ${userQuestion}`,
    },
  ];

  // 5. Generate answer
  const completion = await openai.chat.completions.create({
    model:       'gpt-4o',
    messages,
    temperature: 0,                  // deterministic — factual Q&A
    max_tokens:  500,
  });

  return {
    answer:  completion.choices[0].message.content,
    sources: searchResult.matches.map(m => ({ id: m.metadata.docId, score: m.score })),
  };
}
```

---

## ChromaDB (Local Dev / Self-Hosted)

```javascript
import { ChromaClient, OpenAIEmbeddingFunction } from 'chromadb';

const chroma = new ChromaClient({ path: 'http://localhost:8000' });

const embedder = new OpenAIEmbeddingFunction({
  openai_api_key: process.env.OPENAI_API_KEY,
  openai_model: 'text-embedding-ada-002',
});

// Create or get collection
const collection = await chroma.getOrCreateCollection({
  name: 'knowledge-base',
  embeddingFunction: embedder,
  metadata: { 'hnsw:space': 'cosine' },   // cosine similarity
});

// Add documents — ChromaDB auto-embeds if embeddingFunction is set
await collection.add({
  ids:       ['doc1-chunk0', 'doc1-chunk1'],
  documents: ['First chunk text...', 'Second chunk text...'],
  metadatas: [{ type: 'faq', date: '2024-01' }, { type: 'faq', date: '2024-01' }],
});

// Query
const results = await collection.query({
  queryTexts: ['What is the cancellation policy?'],
  nResults:   5,
  where:      { type: 'faq' },           // metadata filter
});

console.log(results.documents[0]);       // top 5 matching chunks
```

---

## Pinecone vs ChromaDB vs pgvector

| | Pinecone | ChromaDB | pgvector (Postgres) |
|--|--|--|--|
| Hosting | Managed cloud | Self-host or cloud | Your Postgres instance |
| Scale | Billions of vectors | Millions (single node) | Tens of millions |
| Setup complexity | API key, instant | Docker or local | Add extension to PG |
| Cost | Pay per index/query | Free self-hosted | Storage only |
| Metadata filtering | Yes | Yes | Full SQL WHERE clauses |
| Best for | Production, large scale | Dev, prototyping, privacy | Already using Postgres |

---

## Chunking Strategies

| Strategy | Chunk boundary | Pros | Cons |
|--|--|--|--|
| Fixed size | Every N tokens | Predictable, simple | May cut sentences mid-thought |
| Sentence | Sentence endings | Preserves meaning units | Variable size |
| Recursive character | `\n\n` → `\n` → `. ` → ` ` | Respects document structure | Slightly more complex |
| Semantic chunking | Embedding drift threshold | Best coherence | Expensive (embed each sentence) |
| Document sections | Headers / `<h2>` / `## ` | Preserves document intent | Requires parseable structure |

**Rule of thumb:** Recursive character splitter with 512-token chunks and 50-token overlap is a solid default for most document types.

---

## Key Interview Q&A

**Q: Why RAG instead of fine-tuning the LLM on your corpus?**
> RAG retrieves current data at inference time — fine-tuned models have a knowledge cutoff at training time and are expensive to retrain when data changes. RAG also provides source attribution (which chunks were retrieved), making it auditable. Fine-tuning is better for changing the model's *behaviour or style*, not for adding up-to-date factual knowledge.

**Q: How did you measure that RAG improved accuracy to 88%?**
> Created a test set of 100 questions with gold-standard answers (written by domain experts). Ran the pipeline against the test set, scored whether each answer was fully correct, partially correct, or wrong. Compared to keyword search baseline at 54%. Iteration: tuned chunk size, overlap, and top-k on a validation set before measuring on the held-out test set.

**Q: What happens if the relevant information spans multiple chunks?**
> Overlap helps at chunk boundaries. For long answers, increasing top-k retrieves more chunks. For documents with dependency on each other, a parent-child retrieval strategy works: embed small chunks for precision, but retrieve the full parent section as context when a small chunk matches.

**Q: How do you handle documents that change over time?**
> Re-embed and upsert with the same IDs (Pinecone upsert is idempotent — same ID overwrites). For deleted documents, delete all chunk vectors with that docId prefix. For large-scale re-indexing, use a shadow index: build new index offline, swap atomically.

---

## ELI5: Actions Explained

> Every action taken in the STAR story above, explained like you're 5 years old.

| Action | ELI5 Explanation |
|--------|-----------------|
| **Chunked documents into 512-token overlapping segments** | Cut each long document into bite-sized pieces (like cutting a chapter into 2-page sections). Added overlap between pieces — the last sentence of chunk 1 is also the first sentence of chunk 2. That overlap makes sure no important idea falls silently into the gap between two chunks and gets lost. |
| **Generated embeddings with `text-embedding-ada-002` and stored in Pinecone / ChromaDB** | Converted every 2-page chunk into a set of GPS coordinates (1,536 numbers) that represent its *meaning* in idea-space. "How do I cancel my order?" becomes a specific location on the meaning-map. All 10,000 document chunks now have their coordinates filed in a special map-database (Pinecone) optimised for finding nearby locations in milliseconds. |
| **At query time: embed the user query, cosine similarity search top-k=5** | When a user asks a question, convert the question to its own GPS coordinates. Then find the 5 stored document chunks whose coordinates are closest on the meaning-map. These 5 chunks are most likely to contain the answer — even if they use completely different words to describe the same thing. |
| **Injected retrieved chunks into GPT-4o context as grounding evidence** | Gave the AI an open-book exam instead of a closed-book one. "Here are the 5 most relevant pages from the knowledge base — answer the question using ONLY what's written on these pages." The AI can't make anything up because it's working from evidence you provided, not from its own memory. |
| **Added metadata filters (document type, date range) to scope retrieval** | Added shelf labels to the library before the search even starts. "Only look in the Finance shelf, published after 2024." Instead of checking all 10,000 documents' coordinates, the search is scoped to only the relevant subset — faster and more accurate. |

---

## ELI5 Complex Keywords Glossary

| Term | ELI5 Explanation |
|------|-----------------|
| **Vector / Embedding** | A list of numbers (like GPS coordinates) that captures the *meaning* of text. Words with similar meanings end up with similar coordinates. "Cat" and "kitten" are close together in this number-space; "cat" and "spreadsheet" are far apart. |
| **Embedding Model** | A special AI model that converts text into vectors. You feed in "How do I cancel my order?" and get back a list of 1,536 numbers that represent the meaning of that sentence. |
| **Vector Database** | A database designed to store millions of these meaning-coordinates and answer "which stored item is closest in meaning to this query?" in milliseconds. Like Google Maps' "find nearest coffee shop" but for ideas. |
| **Semantic Search** | Search based on meaning, not exact words. "Vehicle coverage" matches "car insurance" because they mean the same thing, even though no word overlaps. Classic keyword search would miss this. |
| **Cosine Similarity** | A measure of how similar two vectors are. Score of 1.0 = same meaning, score of 0 = totally unrelated. Think of it as measuring the angle between two arrows — pointing the same direction = similar meaning. |
| **Top-K Search** | Retrieve the K most similar items from the vector database. `topK=5` means "give me the 5 chunks most relevant to my query." More K = more context but more noise. |
| **RAG (Retrieval-Augmented Generation)** | A technique: search your knowledge base for relevant chunks first, then give those chunks to the LLM as context so it answers from evidence, not from memory. Like an open-book exam instead of asking someone to remember everything. |
| **Hallucination** | When an AI confidently states something that isn't true — it's making things up from its training patterns. RAG drastically reduces hallucination by grounding the model in retrieved, real documents. |
| **Chunking** | Breaking a long document into smaller pieces before embedding. A 50-page PDF is split into 100+ smaller chunks so each piece has a focused, embeddable meaning. |
| **Chunk Overlap** | When splitting text into chunks, you deliberately include the last N tokens of the previous chunk at the start of the next. This prevents losing context when a key sentence falls at a boundary. |
| **Context Window** | The maximum amount of text an LLM can read at once. GPT-4o's context window is ~128,000 tokens. RAG fits retrieved chunks into this window so the model can read and reason over them. |
| **Grounded Answer** | An LLM answer based only on provided documents, not invented knowledge. The model is instructed: "only answer from the context below." Dramatically reduces hallucination. |
| **HNSW (Hierarchical Navigable Small World)** | The algorithm most vector databases use under the hood to find nearest neighbours fast. Instead of comparing every vector to every other vector (slow), it builds a multi-layer graph of shortcuts — like a highway network instead of local roads. |
| **ANN (Approximate Nearest Neighbour)** | Finding vectors that are "close enough" to the query without guaranteeing the mathematically exact nearest match. The trade-off: much faster than exact search (O(log n) vs O(n)), with accuracy above 99% in practice. |
| **Pinecone** | A managed cloud vector database. You just call an API — no infrastructure to manage. Good for production with billions of vectors. You pay per index and query. |
| **ChromaDB** | An open-source vector database you can run locally (in a Docker container or in-memory). Perfect for development and prototyping. Free, but single-node — not designed for massive scale. |
| **pgvector** | A Postgres extension that adds vector storage and similarity search to a regular Postgres database. Great if you're already using Postgres and your dataset fits (tens of millions of vectors). No new infrastructure needed. |
| **Metadata Filter** | Narrowing your vector search with regular attribute conditions. "Find similar chunks BUT only from documents of type 'policy' published after 2024." Like filtering Google Maps results to only show open restaurants. |
| **Upsert** | Insert if doesn't exist, update if it does (by ID). When a document changes, you upsert its chunks with the same IDs — the new embeddings overwrite the old ones cleanly. |
| **Shadow Index** | A technique for re-indexing without downtime. Build the new index in the background while the old one serves traffic. Once the new one is ready, atomically swap them — users never see a gap. |
| **Recursive Character Text Splitter** | A chunking strategy that tries to split text by paragraph breaks first (`\n\n`), then line breaks, then sentences, then words. Tries to keep semantically meaningful units together. |
| **Source Attribution** | Returning which documents/chunks were used to generate the answer. Lets users click "where did this come from?" — crucial for trust and auditability in enterprise RAG systems. |
| **Temperature (LLM)** | A dial controlling how creative/random the LLM's output is. Temperature=0 means deterministic, most likely answer. Temperature=1 means more creative, varied responses. For factual Q&A, use 0. |
