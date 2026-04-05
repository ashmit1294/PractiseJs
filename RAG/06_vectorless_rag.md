# Vectorless RAG — RAG Without a Vector Database
> Resume Signal: BM25 retrieval, sparse retrieval, hybrid search, keyword RAG, LLM-native retrieval

---

## STAR Interview Answer

| | |
|---|---|
| **Situation** | A mid-size enterprise needed a document Q&A system over 200,000 internal policy documents. Budget constraints ruled out managed vector DB services (Pinecone, OpenSearch with k-NN), and the team had no existing ML infrastructure. The docs were already indexed in Elasticsearch (BM25). |
| **Task** | Build a production RAG pipeline that works without a dedicated vector database — leveraging existing keyword search infrastructure and LLM capabilities to achieve accurate, grounded answers. |
| **Action** | Implemented a three-path Vectorless RAG: (1) BM25-based retrieval via Elasticsearch for keyword-heavy queries; (2) LLM-native retrieval using GPT-4o's long context window to scan entire documents directly; (3) Reranking with a cross-encoder (ms-marco-MiniLM-L-6-v2) to re-order BM25 results by semantic relevance before generation. Combined all three with a query classifier that routes to the cheapest path first. |
| **Result** | Answer accuracy reached 84% (vs 91% with vector RAG on the same eval set — an acceptable trade-off). Infrastructure cost was ~70% lower. No vector DB to maintain. Existing Elasticsearch cluster handled retrieval. |

---

## ELI5

**Traditional RAG** finds relevant documents by comparing meaning-vectors (embeddings). **Vectorless RAG** finds documents using the methods we had before embeddings existed — keyword matching, TF-IDF scoring, BM25 ranking — and then uses an LLM to read and synthesise those results. It trades retrieval precision for infrastructure simplicity.

---

## Key Terms Defined

> Every term used in this file — no Googling needed.

| Term | What it is | Why it matters here |
|---|---|---|
| **BM25** (Best Match 25) | Probabilistic information retrieval algorithm. Scores documents by: term frequency (how often the query word appears in the doc) + IDF (how rare the word is corpus-wide) + document length normalisation. Version "25" is the 25th iteration of the BM family of models. Key constants: `k1=1.5` (term frequency saturation), `b=0.75` (length normalisation strength). | The core retrieval algorithm for Vectorless RAG — runs on any Elasticsearch/OpenSearch instance with no additional setup |
| **IDF** (Inverse Document Frequency) | `IDF(t) = log(N / df(t))` where N = total number of documents, df(t) = number of documents containing term t. High IDF = rare word = more diagnostic. Low IDF = common word like "the" = less useful for retrieval. | BM25 multiplies term frequency by IDF to downweight common words — prevents "is", "the", "a" from dominating the score |
| **avgdl** | Average document length (in words) across the entire corpus. Used in BM25's length normalisation denominator to prevent longer documents from getting higher scores simply because they have more term occurrences. | The `b=0.75` parameter controls how heavily `avgdl` normalises — `b=0` turns off length normalisation entirely |
| **TF-IDF** (Term Frequency – Inverse Document Frequency) | A sparse vector representation of text. Each dimension of the vector corresponds to one vocabulary term. Value = `tf(t,d) × idf(t)`. A document with 10,000 vocab terms has a 10,000-dim sparse vector with mostly zeros. | Method 2 in Vectorless RAG — cosine similarity between TF-IDF vectors gives relevance score without neural embeddings |
| **Sparse vector** | A vector where most values are 0. TF-IDF vectors are sparse because most vocabulary terms are absent from any given document. Stored efficiently as `{index: value}` dicts. Contrast with **dense vectors** (embeddings) where all dimensions have non-zero values. | Vectorless RAG methods produce sparse vectors; SPLADE is a hybrid that produces "learned sparse" vectors |
| **n-gram** | A contiguous sequence of n words. A unigram (1-gram) is a single word; a bigram (2-gram) is two consecutive words. `ngram_range=(1,2)` in TF-IDF captures both `"heart"` and `"heart disease"` as separate features. | Used in the TF-IDF vectoriser config — bigrams capture multi-word medical terms, legal phrases, and product names that unigrams miss |
| **FTS (Full-Text Search)** | Database-native keyword search capability available in PostgreSQL (`tsvector/tsquery`), MySQL, SQLite (`FTS5`), etc. Uses inverted indexes for fast term lookup. No ML required. | The "existng infrastructure" in the Why Vectorless table — enterprises already have FTS deployed and can route RAG queries through it |
| **Cross-encoder re-ranker** | A neural model that takes `[CLS] query [SEP] document [SEP]` as a single input and outputs one relevance score. Attends jointly over both sequences — much higher precision than bi-encoder cosine similarity. Cannot pre-compute; runs per query-doc pair on the top-k candidate set only. | Method 3 — reranks BM25's top-50 by cross-encoder score to get top-5 with much better precision. The quality bridge between BM25 recall and vector RAG precision. |
| **`[CLS]` token** | Special classification token prepended to every BERT/transformer input: `[CLS] text [SEP]`. The hidden state at this token position after all self-attention layers represents the **whole sequence** semantics. Cross-encoders use the `[CLS]` embedding to produce a single relevance score. | The mechanism by which cross-encoders convert a variable-length input into a single scalar relevance score |
| **`[SEP]` token** | Separator token inserted between two sequences in BERT-style models: `[CLS] query [SEP] document [SEP]`. Tells the model where one sequence ends and another begins — enables joint attention across both. | Enables the cross-encoder to "see" both query and document simultaneously — unlike bi-encoders which encode them separately |
| **Bi-encoder** | A model that encodes query and document **independently** into dense vectors, then uses cosine similarity. Fast because document vectors are pre-computed at ingestion. Used in traditional vector RAG. Contrast with cross-encoder. | Why dense RAG needs a separate embedding step — bi-encoders require pre-computed document embeddings stored in a vector DB |
| **SPLADE** (SParse Lexical AnD Expansion) | A BERT-based model that outputs **sparse vectors over the full vocabulary (~30,000 terms)**. For each text, it predicts which vocabulary tokens are "activated" and with what weight — using the masked language model head. Combines neural understanding (semantics) with sparse storage (inverted index). Term **expansion**: SPLADE activates related terms not in the original text (e.g., the word "car" might activate "vehicle", "automobile"). | Method 5 — the best Vectorless option: better semantic understanding than BM25, no dense vector DB needed, stores in standard Elasticsearch/OpenSearch as sparse activation vectors |
| **Masked Language Model (MLM)** | BERT's pre-training objective — randomly mask 15% of input tokens and train the model to predict them. The model learns rich contextual token representations. SPLADE repurposes the MLM head to score all vocabulary tokens for a given input. | The mechanism inside SPLADE — `output.logits` is the vocabulary-wide prediction distribution, which SPLADE transforms into a sparse activation vector |
| **`log(1 + ReLU(x))`** | SPLADE's activation function applied to each vocabulary logit: ReLU zeroes out negative values (prunes the vector); log(1+x) compresses large values (prevents a few terms dominating). Result: a sparse non-negative vector. | The mathematical operation that converts BERT's raw vocabulary logits into a usable sparse retrieval weight per term |
| **Long-context RAG** | RAG method where instead of retrieving top-k chunks, you BM25-filter to top-20 documents and stuff ALL of them directly into the LLM's context window. No vector DB, no embedding model — just LLM's attention over many documents. | Method 4 — viable when corpus is small (< 500 docs) and using Claude 3.5 Sonnet (200K ctx) or Gemini 1.5 Pro (1M ctx) |
| **"Lost in the middle" problem** | Finding by Liu et al. (2023 paper) — LLMs have highest accuracy on information at the **very start** and **very end** of a long context window. Accuracy degrades significantly for content in the middle. If 100 documents are stuffed sequentially, documents 40–60 may be effectively "invisible" to the model. | Key weakness of long-context RAG — mitigate by putting the most relevant documents first and last, or use BM25 pre-filtering to reduce to top-5–10 before stuffing |
| **Amazon Kendra** | AWS fully managed ML-enhanced keyword search service. Reads from S3, SharePoint, Confluence, OneDrive, RDS, Salesforce. Provides reading-comprehension-based answer extraction (not vector search). HIPAA-eligible, FedRAMP-authorised. | The AWS Vectorless RAG managed service — choose over OpenSearch when you need compliance certifications and enterprise SaaS connectors |
| **FedRAMP** | Federal Risk and Authorization Management Program — US government compliance framework for cloud services used by federal agencies. FedRAMP "Authorized" services have passed a rigorous security audit and are approved for federal government data. | Why regulated US government customers choose Kendra (Vectorless) over sending data to OpenAI embedding APIs |
| **HIPAA** | Health Insurance Portability and Accountability Act — US law requiring protection of PHI (Protected Health Information). HIPAA-eligible services are architected to handle healthcare data with required safeguards (encryption, audit logging, BAA agreements). | Why healthcare customers use Kendra (HIPAA-eligible) rather than external embedding APIs for patient-related document Q&A |
| **Azure AI Search semantic ranking** | Azure AI Search feature that adds a Cohere-based cross-encoder reranker on top of BM25 results with a single API parameter (`"queryType": "semantic"`). No separate model deployment. Reranks the BM25 top-50 to surface semantically best answers first. | The Azure managed Vectorless RAG path — hybrid BM25 + semantic reranking with zero ML infrastructure |
| **RRF in hybrid search** | Reciprocal Rank Fusion applied to combine BM25 results + vector results: `score(d) = 1/(k + rank_bm25) + 1/(k + rank_vector)`. Both Azure AI Search and Amazon OpenSearch support this natively. | The production best practice for combining Vectorless (BM25) and vector retrieval into a single ranked list |

---

## Why Vectorless RAG?

| Reason | Detail |
|---|---|
| **No vector DB infrastructure** | Existing Elasticsearch / OpenSearch (keyword mode) / SQL FTS already deployed |
| **Cost** | Embedding generation + vector DB storage + ANN query = significant cost; BM25 is free |
| **Latency** | BM25 keyword search is sub-millisecond; vector ANN search adds 20–80ms |
| **Simple exact-match needs** | Queries with specific codes, IDs, dates, or proper nouns — BM25 outperforms vectors on these |
| **LLM context windows grew** | GPT-4o (128K tokens), Claude 3.5 (200K tokens) — large enough to scan entire short documents without retrieval at all |
| **Compliance / air-gapped environments** | Embedding APIs require sending data externally; BM25 is fully local |

---

## The 4 Vectorless RAG Methods

### Method 1 — BM25 / Keyword Retrieval

The classic information retrieval algorithm. Scores documents by term frequency relative to document length and corpus-wide rarity.

$$\text{BM25}(q, d) = \sum_{t \in q} \text{IDF}(t) \cdot \frac{f(t,d) \cdot (k_1 + 1)}{f(t,d) + k_1 \cdot \left(1 - b + b \cdot \frac{|d|}{\text{avgdl}}\right)}$$

Where:
- $f(t, d)$ = term frequency in document $d$
- $\text{IDF}(t)$ = inverse document frequency (penalises common words)
- $k_1 = 1.5$, $b = 0.75$ (tunable parameters)
- $\text{avgdl}$ = average document length in corpus

**Strengths:** Exact-match precision; extremely fast; no GPU/embedding cost  
**Weaknesses:** Vocabulary mismatch ("vehicle" vs "car"); no semantic understanding

```python
# BM25 retrieval with rank_bm25
from rank_bm25 import BM25Okapi

corpus_tokens = [doc.split() for doc in documents]
bm25 = BM25Okapi(corpus_tokens)

def bm25_retrieve(query: str, k: int = 5) -> list[str]:
    query_tokens = query.split()
    scores  = bm25.get_scores(query_tokens)
    top_idx = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]
    return [documents[i] for i in top_idx]
```

---

### Method 2 — TF-IDF + Cosine Similarity (Sparse Vectors)

TF-IDF converts documents into sparse high-dimensional vectors (one dimension per vocabulary term). Cosine similarity between the query TF-IDF vector and document TF-IDF vectors gives a relevance score — no neural embeddings needed.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

vectorizer = TfidfVectorizer(max_features=50000, ngram_range=(1, 2))
tfidf_matrix = vectorizer.fit_transform(documents)   # sparse matrix

def tfidf_retrieve(query: str, k: int = 5) -> list[str]:
    query_vec = vectorizer.transform([query])
    scores    = cosine_similarity(query_vec, tfidf_matrix).flatten()
    top_idx   = np.argsort(scores)[::-1][:k]
    return [documents[i] for i in top_idx]
```

**Strengths:** No external API; sklearn is standard; dimensions = vocabulary (interpretable)  
**Weaknesses:** High dimensionality; sparse = poor on paraphrases; no semantic meaning

---

### Method 3 — Cross-Encoder Reranking (BM25 + Reranker)

BM25 retrieves a candidate set (top-50), then a **cross-encoder** model re-ranks it by semantic relevance — all without generating dense embeddings for the document corpus.

```
Query + Document → Cross-Encoder → Relevance Score (0–1)
```

Unlike bi-encoders (which pre-compute document embeddings), cross-encoders process query+document **together** — giving much higher precision. The trade-off: cannot pre-compute; must run at query time over the top-k candidates only.

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def bm25_rerank_retrieve(query: str, k_bm25: int = 50, k_final: int = 5) -> list[str]:
    # Step 1: BM25 broad retrieval
    candidates = bm25_retrieve(query, k=k_bm25)

    # Step 2: Cross-encoder reranks candidates
    pairs  = [(query, doc) for doc in candidates]
    scores = reranker.predict(pairs)

    # Step 3: Return top-k by reranker score
    ranked = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)
    return [doc for doc, _ in ranked[:k_final]]
```

**This is the highest-quality vectorless method** — BM25 recall + cross-encoder precision — and requires no vector DB at all.

---

### Method 4 — LLM-Native / Long-Context RAG

For small-to-medium corpora (hundreds of documents), use the LLM's own long context window directly:

```python
# Stuff all relevant docs into the context window
def long_context_rag(question: str, all_docs: list[str]) -> str:
    # Optional: BM25 pre-filter to reduce to top-20 before stuffing
    candidate_docs = bm25_retrieve(question, k=20)

    full_context = "\n\n---\n\n".join(candidate_docs)

    response = llm.invoke([
        {
            "role": "system",
            "content": "Read the provided documents and answer the question. Answer ONLY from the documents.",
        },
        {
            "role": "user",
            "content": f"Documents:\n{full_context}\n\nQuestion: {question}",
        },
    ])
    return response.content
```

**Context limits (as of 2025):**
| Model | Context Window | ~Words |
|---|---|---|
| GPT-4o | 128K tokens | ~96,000 words |
| Claude 3.5 Sonnet | 200K tokens | ~150,000 words |
| Gemini 1.5 Pro | 1M tokens | ~750,000 words |
| Llama 3.1 405B | 128K tokens | ~96,000 words |

**Strengths:** Zero infrastructure; extremely simple; works perfectly for sub-100 document corpora  
**Weaknesses:** Cost scales with context size; slower as context grows; attention degradation on very long contexts ("lost in the middle" problem)

---

### Method 5 — SPLADE / Learned Sparse Retrieval

A middle ground: SPLADE (SParse Lexical AnD Expansion) uses a BERT model to produce **sparse** vectors with expanded vocabulary — better than BM25 semantics, no dense vector DB needed.

```python
from transformers import AutoModelForMaskedLM, AutoTokenizer
import torch

tokenizer = AutoTokenizer.from_pretrained("naver/splade-cocondenser-ensembledistil")
model     = AutoModelForMaskedLM.from_pretrained("naver/splade-cocondenser-ensembledistil")

def splade_encode(text: str) -> dict:
    tokens = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        output = model(**tokens)
    # Sparse activation: max-pool over sequence, apply log(1 + ReLU)
    sparse_vec = torch.log(1 + torch.relu(output.logits)).max(dim=1).values.squeeze()
    # Return as {vocab_id: weight} dict (only non-zero entries)
    indices = sparse_vec.nonzero().squeeze()
    return {int(i): float(sparse_vec[i]) for i in indices}
```

Sparse vectors can be stored in standard inverted indexes (Elasticsearch, OpenSearch) — no dedicated vector DB.

---

## Full Vectorless RAG Pipeline with LangGraph

```python
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder

# ── Setup ───────────────────────────────────────────────────────────────────
llm       = ChatOpenAI(model="gpt-4o", temperature=0)
reranker  = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

class VectorlessRAGState(TypedDict):
    question:     str
    candidates:   List[str]
    reranked:     List[str]
    answer:       str

# ── Nodes ───────────────────────────────────────────────────────────────────
def bm25_retrieve_node(state: VectorlessRAGState):
    tokens    = [doc.split() for doc in corpus]
    bm25      = BM25Okapi(tokens)
    scores    = bm25.get_scores(state["question"].split())
    top_idx   = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:50]
    return {"candidates": [corpus[i] for i in top_idx]}

def rerank_node(state: VectorlessRAGState):
    pairs  = [(state["question"], doc) for doc in state["candidates"]]
    scores = reranker.predict(pairs)
    ranked = sorted(zip(state["candidates"], scores), key=lambda x: x[1], reverse=True)
    return {"reranked": [doc for doc, _ in ranked[:5]]}

def generate_node(state: VectorlessRAGState):
    context  = "\n\n---\n\n".join(state["reranked"])
    response = llm.invoke([
        {"role": "system", "content": "Answer ONLY using the provided context."},
        {"role": "user",   "content": f"Context:\n{context}\n\nQuestion: {state['question']}"},
    ])
    return {"answer": response.content}

# ── Graph ───────────────────────────────────────────────────────────────────
graph = StateGraph(VectorlessRAGState)
graph.add_node("retrieve", bm25_retrieve_node)
graph.add_node("rerank",   rerank_node)
graph.add_node("generate", generate_node)

graph.set_entry_point("retrieve")
graph.add_edge("retrieve", "rerank")
graph.add_edge("rerank",   "generate")
graph.add_edge("generate",  END)

app = graph.compile()
```

---

## AWS Services for Vectorless RAG

| Component | AWS Service | Notes |
|---|---|---|
| **Document storage** | Amazon S3 | |
| **Keyword retrieval** | Amazon OpenSearch Service (BM25 mode) | Disable k-NN; use standard Lucene BM25 full-text index |
| **Reranking** | AWS Lambda + SageMaker endpoint | Deploy ms-marco cross-encoder on SageMaker; invoke from Lambda |
| **Enterprise keyword search** | Amazon Kendra | ML-enhanced keyword search; no vector index needed; reads from S3, SharePoint, Confluence |
| **LLM generation** | Amazon Bedrock (Claude 3.5 / Titan) | |
| **Long-context path** | Amazon Bedrock + Claude 3.5 (200K ctx) | For small corpora — stuff all docs into context |
| **Orchestration** | AWS Lambda + Step Functions | BM25 → rerank → generate pipeline |
| **Caching** | Amazon ElastiCache (Redis) | Cache BM25 + reranked results per query |

**Amazon Kendra** is the fully managed Vectorless RAG service on AWS — it provides ML-enhanced keyword search (not vector search) from S3, SharePoint, OneDrive, Confluence, and databases. It extracts answers with reading comprehension models and is HIPAA/FedRAMP eligible — often used in regulated industries where sending data to embedding APIs is restricted.

---

## Azure Services for Vectorless RAG

| Component | Azure Service | Notes |
|---|---|---|
| **Document storage** | Azure Blob Storage | |
| **Keyword retrieval** | Azure AI Search (BM25 mode) | Disable vector fields; use standard BM25 full-text index only |
| **Enterprise keyword search** | Azure Cognitive Search (semantic ranker) | Built-in semantic re-ranking (cross-encoder) without separate infrastructure |
| **Reranking** | Azure AI Search semantic ranking | Cohere-based cross-encoder reranker built into AI Search — no separate model deployment |
| **LLM generation** | Azure OpenAI Service (GPT-4o) | |
| **Long-context path** | Azure OpenAI GPT-4o (128K) | |
| **Orchestration** | Azure Functions + Durable Functions | |
| **Caching** | Azure Cache for Redis | |

**Azure AI Search semantic ranking** is noteworthy — it adds a cross-encoder based re-ranker on top of BM25 results with a single API parameter (`queryType: "semantic"`). No vector DB, no embedding model deployment — the best Vectorless RAG path on Azure.

---

## Vectorless RAG vs Vector RAG

| Dimension | Vectorless RAG | Vector RAG |
|---|---|---|
| **Retrieval mechanism** | BM25, TF-IDF, cross-encoder, keyword | Dense embedding cosine similarity (ANN) |
| **Infrastructure needed** | Elasticsearch / OpenSearch (keyword) | Vector DB (Pinecone, OpenSearch k-NN, AI Search) |
| **Embedding generation** | Not required | Required at ingestion + query time |
| **Exact-match queries** | Excellent (BM25 excels at specific codes/IDs) | Good (can miss exact tokens in embeddings) |
| **Semantic / paraphrase queries** | Weaker (vocabulary mismatch) | Excellent |
| **Cross-encoder reranking** | Yes (the quality bridge) | Optional (further improves vector results) |
| **Cost** | Low (no embedding API, no vector DB) | Higher (embedding API + vector storage + ANN index) |
| **Latency** | Lower (BM25 sub-ms; cross-encoder ~50ms on CPU) | Higher (embedding call + ANN search) |
| **Compliance / air-gapped** | Fully local — no external API calls needed | Requires embedding API calls (external data transfer) |
| **Best for** | Code search, regulated industries, existing Elasticsearch infra | General Q&A, semantic similarity, multi-lingual |

---

## When to Choose Vectorless RAG

✅ **Use Vectorless RAG when:**
- You already have Elasticsearch / OpenSearch / Azure Cognitive Search deployed
- Queries are primarily keyword-heavy (product codes, legal citations, exact names)
- You're in a regulated industry (HIPAA, FedRAMP, GDPR) and can't send documents to external embedding APIs
- Budget prohibits vector embedding + storage costs
- Low latency is critical (BM25 is sub-millisecond)
- Corpus is small enough for long-context stuffing (< 500 documents)

❌ **Don't use Vectorless RAG when:**
- Queries are conversational / semantic (user says "vehicle" but docs say "car")
- Multi-lingual corpus (BM25 doesn't handle cross-lingual semantic matching)
- You need cross-document relationship queries (use Graph RAG instead)
- Corpus is very large (> 10M documents) and precision matters more than recall

---

## Hybrid: Best of Both (BM25 + Vector)

The production best practice is to combine both — BM25 for recall, vectors for precision — using **Reciprocal Rank Fusion (RRF)**:

```python
def reciprocal_rank_fusion(bm25_results: list, vector_results: list, k: int = 60) -> list:
    """
    Merge BM25 and vector ranked lists using RRF.
    score(d) = 1/(k + rank_bm25(d)) + 1/(k + rank_vector(d))
    """
    scores = {}
    for rank, doc in enumerate(bm25_results):
        scores[doc] = scores.get(doc, 0) + 1 / (k + rank + 1)
    for rank, doc in enumerate(vector_results):
        scores[doc] = scores.get(doc, 0) + 1 / (k + rank + 1)

    return sorted(scores.keys(), key=lambda d: scores[d], reverse=True)
```

Both Azure AI Search and Amazon OpenSearch Service support hybrid BM25 + vector search with RRF natively.

---

## Interview Questions

**Q: What is BM25 and why does it work without embeddings?**  
A: BM25 (Best Match 25) is a probabilistic information retrieval algorithm that scores documents by term frequency (how often the query word appears in the doc), inverse document frequency (how rare the query word is across the corpus), and document length normalisation. It doesn't need embeddings because relevance is computed purely over token overlap statistics. It's fast (inverted index lookup), runs on standard Elasticsearch/OpenSearch, and excels at queries with specific entity names, codes, or dates.

**Q: What is a cross-encoder reranker and how does it differ from a bi-encoder?**  
A: A bi-encoder (used in vector RAG) encodes the query and document separately into embeddings, then computes cosine similarity — fast because document embeddings are pre-computed. A cross-encoder takes the query and document concatenated as a single input (`[CLS] query [SEP] document [SEP]`) and outputs a single relevance score — much higher precision because it attends jointly over both. Cross-encoders can't pre-compute (must run per query-doc pair), so they're used to rerank a small candidate set (top-50) not to search a corpus of millions.

**Q: What is the "lost in the middle" problem in long-context RAG?**  
A: Research (Liu et al., 2023) found that LLMs perform best on information at the very beginning and very end of a long context window, and struggle to retrieve information in the middle. If you stuff 100 documents into a 128K token context, the answer buried in document 50 may be effectively invisible to the model. Mitigation: put the most relevant documents first and last, or use retrieval to reduce the context to the top 5–10 documents before generation.

**Q: When would you use Amazon Kendra over OpenSearch for RAG?**  
A: Kendra is ML-enhanced keyword search built for enterprise content (SharePoint, Confluence, OneDrive, S3, RDS) in regulated industries. It's HIPAA-eligible, FedRAMP-authorised, and provides reading comprehension-based answer extraction without a vector pipeline. Choose Kendra when: your content is spread across enterprise SaaS systems, you need compliance certifications, or your team lacks ML infrastructure experience. Choose OpenSearch when: you need full control, hybrid search (BM25 + vector), or lower per-query cost at scale.

**Q: Can you do semantic search without a vector database?**  
A: Yes — using a cross-encoder reranker on top of BM25 results. BM25 handles keyword recall (find candidate documents). The cross-encoder then re-scores each candidate using joint query+document attention — achieving near-vector-level semantic precision without ever generating or storing dense document embeddings. SPLADE is another option: it generates sparse vectors using a language model, storable in standard inverted indexes like Elasticsearch, giving semantic understanding without a dedicated vector DB.
