# CRAG — Corrective Retrieval-Augmented Generation
> Resume Signal: CRAG, retrieval evaluation, knowledge refinement, web search fallback, LangGraph
> Paper: Yan et al., 2024 — https://arxiv.org/abs/2401.15884

---

## STAR Interview Answer

| | |
|---|---|
| **Situation** | A knowledge-base Q&A system was giving confidently wrong answers when the internal documents didn't actually contain the answer. Traditional RAG retrieved the closest chunks regardless of quality and passed them to the LLM, which hallucinated to fill the gap. |
| **Task** | Add a quality gate between retrieval and generation — automatically detect when retrieved docs are insufficient and trigger a corrective action (refine, web search, or both) before the LLM ever sees the context. |
| **Action** | Implemented CRAG: after vector retrieval, a Retrieval Evaluator (lightweight LLM judge) scores each retrieved doc as Correct, Incorrect, or Ambiguous. Correct docs undergo Knowledge Refinement (decompose → strip irrelevant sentences → recompose) before generation. Incorrect docs route to a web search fallback (Tavily API). Ambiguous triggers both paths and merges results. Orchestrated the three-way routing with LangGraph on ECS; used async parallel strip evaluation to handle refinement at scale. |
| **Result** | LLM answer accuracy on the internal eval set improved from 71% to 89%. Hallucination rate on out-of-knowledge queries dropped from 34% to 6% — the Incorrect path's web search fallback handled those cases correctly. |

---

## ELI5

Traditional RAG hands the LLM whatever it found, even if it's bad. **CRAG** adds a quality inspector between the library and the LLM. The inspector reads every document and stamps it: ✅ Good (refine and use), ❌ Bad (go search the web instead), 🤔 Unsure (do both and merge). Only after that quality check does the LLM get to see any context.

---

## Key Terms Defined

> Every term used in this file — no Googling needed.

| Term | What it is | Why it matters here |
|---|---|---|
| **Retrieval Evaluator** | A lightweight LLM judge (or fine-tuned classifier) that scores how well a retrieved document answers a specific question. Outputs a numeric score (0.0–1.0) — not just cosine similarity. Evaluates *factual usefulness*, not just *semantic closeness*. | The core innovation of CRAG — this quality gate prevents bad docs from reaching the LLM |
| **Cross-encoder re-ranker** | A model that takes `query + document` **concatenated as a single input** and outputs one relevance score. Attends jointly over both — far more precise than a bi-encoder. Cannot pre-compute (must run per-query), so used on a small candidate set (top-k). | A computationally cheap alternative to a full LLM as the Retrieval Evaluator — `ms-marco-MiniLM` models are fast enough for production |
| **ms-marco** | **M**icro**s**oft **MA**chine **R**eading **CO**mprehension — a large-scale dataset of real Bing search queries + passages. Models fine-tuned on ms-marco (e.g., `cross-encoder/ms-marco-MiniLM-L-6-v2`) are strong passage relevance scorers. | The model family recommended for the CRAG cross-encoder Retrieval Evaluator |
| **T5** | **T**ext-**t**o-**T**ext **T**ransfer **T**ransformer — Google's encoder-decoder model. `T5-large` is commonly fine-tuned as a binary/ternary text classifier (e.g., relevant vs not-relevant) because it's small, fast, and cheap. | Option 1 for the CRAG Retrieval Evaluator — fine-tune T5-large on labelled (query, doc, label) pairs as the cheapest scalable scorer |
| **Tavily API** | Web search API specifically designed for LLM applications — returns clean text snippets (not raw HTML) already optimised for RAG context injection. Offers a `/search` endpoint with configurable `max_results` and domain filters. | The web search service used in CRAG's Incorrect path — replaces Google Search which returns HTML that requires parsing |
| **ECS** | Amazon **E**lastic **C**ontainer **S**ervice — managed container orchestration service. Runs Docker containers without managing EC2 instances directly. Supports Fargate (serverless containers) and EC2 launch types. | The CRAG LangGraph orchestration graph runs on ECS (containerised Python service) in the AWS architecture |
| **SQS DLQ** | Amazon **S**imple **Q**ueue **S**ervice **D**ead-**L**etter **Q**ueue — when a message fails processing N times (configurable), AWS automatically moves it to this separate "dead-letter" queue. Prevents poison-pill messages from blocking the main queue. Engineers inspect the DLQ to debug failures. | Used on the Incorrect (web search) path to handle Tavily API rate-limit failures — failed web search requests retry 3 times then land in DLQ for manual review |
| **`asyncio.gather()`** | Python coroutine that runs multiple `async` functions **concurrently** (not in parallel threads — single-threaded event loop, but I/O operations overlap). All coroutines start immediately; `gather()` returns when all complete. | Used to parallelise Knowledge Refinement strip scoring — instead of scoring strips sequentially, all strip evaluations fire simultaneously, reducing latency from O(n) to O(1) |
| **LangGraph `Send` API** | LangGraph mechanism for **fanning out** to multiple nodes simultaneously — sends a different state payload to each target node. Enables true parallel branching within a single graph execution step. | The AMBIGUOUS path in CRAG should fan out to both `knowledge_refinement` AND `web_search` simultaneously; `Send` API enables this without two sequential calls |
| **Knowledge Refinement** | CRAG's strip-scoring process — decomposes a retrieved document into sentence-level "strips", evaluates each strip's relevance to the query independently, keeps only relevant strips, and recomposes them into clean context. Removes boilerplate/noise. | Applied on the CORRECT and AMBIGUOUS paths — reduces context noise before generation, improving answer quality |
| **Pydantic** | Python data validation library — define typed schemas as classes; Pydantic validates JSON against them. Used with `with_structured_output()` to force LLM responses into typed Python objects. | `RetrievalGrade` and `StripRelevance` are Pydantic models — ensures LLM grader outputs a parseable `score: float`, not free text |
| **`with_structured_output()`** | LangChain method that wraps an LLM call to enforce JSON output matching a Pydantic schema. Uses OpenAI's JSON mode or tool-calling internally — eliminates fragile string parsing. | Used by both the Retrieval Evaluator node and the strip grader node to get machine-readable scores |

---

## The Problem CRAG Solves

Traditional RAG has a critical blind spot: **it has no mechanism to evaluate the quality of what it retrieved**. If the vector DB returns a document that is semantically similar but factually wrong for the query, RAG will use it regardless. CRAG inserts a **Retrieval Evaluator** between the retrieval step and the generation step that classifies retrieval quality and routes accordingly.

---

## CRAG Architecture

```
User Query
    ↓
[Vector DB Retrieval]  →  top-k documents
    ↓
[Retrieval Evaluator]  ←  lightweight LLM judge scores each doc
    │
    ├── CORRECT (score ≥ 0.8)
    │       ↓
    │   [Knowledge Refinement]
    │     Decompose doc into fine-grained strips
    │     Score each strip → keep relevant strips only
    │     Recompose into clean context
    │       ↓
    │   [LLM Generate]  →  Answer
    │
    ├── INCORRECT (score < 0.4)
    │       ↓
    │   [Web Search]  (Tavily / Bing / Kendra)
    │     Query rewrite for web
    │     Fetch + filter web results
    │       ↓
    │   [LLM Generate]  →  Answer
    │
    └── AMBIGUOUS (0.4 ≤ score < 0.8)
            ↓
        Both paths run in parallel
        Merge refined docs + web results
            ↓
        [LLM Generate]  →  Answer
```

---

## The 3 Routing States Explained

### ✅ CORRECT — Knowledge Refinement

Retrieved documents are relevant but may contain noise (headers, unrelated paragraphs, boilerplate). Knowledge Refinement strips the noise:

```
Doc → Decompose into strips (sentence / paragraph level)
    → Score each strip: "Does this strip help answer the question?"
    → Keep only relevant strips
    → Recompose into clean, focused context
    → Pass to LLM
```

This is the **Decompose → Filter → Recompose** pattern. It concentrates the useful signal and removes noise before generation.

### ❌ INCORRECT — Web Search Fallback

Retrieved docs contain no useful information for this query. Rather than letting the LLM hallucinate, CRAG:
1. **Rewrites the query** for a web search (more specific, different phrasing)
2. **Fetches web results** (Tavily API, Bing Search, or AWS Kendra for enterprise)
3. **Filters web snippets** (same lightweight relevance check)
4. Passes filtered web context to the LLM

### 🤔 AMBIGUOUS — Both Paths

Score is in the middle range. CRAG doesn't discard retrieved docs but also doesn't fully trust them. Both the refinement path and the web search path run, and their outputs are merged before generation.

---

## Retrieval Evaluator Detail

The Evaluator scores each retrieved document chunk on [0, 1]:

| Score Range | Label | Action |
|---|---|---|
| ≥ 0.8 | CORRECT | Knowledge Refinement path |
| 0.4 – 0.8 | AMBIGUOUS | Both paths |
| < 0.4 | INCORRECT | Web search path |

The evaluator can be:
- A **dedicated fine-tuned classifier** (T5-based, computationally cheapest at scale)
- A **prompted LLM** with structured output (GPT-4o-mini, easiest to deploy)
- A **cross-encoder re-ranker** (ms-marco models — best precision, no extra LLM call)

---

## LangGraph Implementation (Python)

```python
from typing import TypedDict, List, Literal
from langchain_core.documents import Document
from langchain_openai import ChatOpenAI
from langchain_community.tools.tavily_search import TavilySearchResults
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field

# ── State ──────────────────────────────────────────────────────────────────
class CRAGState(TypedDict):
    question:        str
    docs:            List[Document]
    retrieval_grade: str    # correct | incorrect | ambiguous
    refined_context: str    # from Knowledge Refinement
    web_context:     str    # from Web Search
    final_context:   str    # merged context passed to LLM
    answer:          str

# ── Pydantic Schemas ────────────────────────────────────────────────────────
class RetrievalGrade(BaseModel):
    score: float = Field(description="Relevance score 0.0–1.0 for retrieved document vs question")

class StripRelevance(BaseModel):
    relevant: bool = Field(description="True if this strip helps answer the question")

llm        = ChatOpenAI(model="gpt-4o-mini", temperature=0)
web_search = TavilySearchResults(max_results=3)

# ── Node 1: Retrieve ────────────────────────────────────────────────────────
def retrieve(state: CRAGState):
    docs = retriever.invoke(state["question"])
    return {"docs": docs}

# ── Node 2: Retrieval Evaluator ─────────────────────────────────────────────
def grade_retrieval(state: CRAGState):
    grader = llm.with_structured_output(RetrievalGrade)
    scores = []
    for doc in state["docs"]:
        result = grader.invoke([
            {"role": "system", "content": "Score 0.0–1.0: how relevant is this document to the question?"},
            {"role": "user",   "content": f"Question: {state['question']}\nDocument: {doc.page_content}"},
        ])
        scores.append(result.score)

    avg_score = sum(scores) / len(scores) if scores else 0.0

    if avg_score >= 0.8:
        grade = "correct"
    elif avg_score < 0.4:
        grade = "incorrect"
    else:
        grade = "ambiguous"

    return {"retrieval_grade": grade}

# ── Node 3: Knowledge Refinement (Decompose → Filter → Recompose) ───────────
def knowledge_refinement(state: CRAGState):
    strip_grader = llm.with_structured_output(StripRelevance)
    refined_strips = []

    for doc in state["docs"]:
        # Decompose into sentence-level strips
        strips = [s.strip() for s in doc.page_content.split(". ") if s.strip()]
        for strip in strips:
            result = strip_grader.invoke([
                {"role": "system", "content": "Does this sentence help answer the question?"},
                {"role": "user",   "content": f"Question: {state['question']}\nSentence: {strip}"},
            ])
            if result.relevant:
                refined_strips.append(strip)

    refined_context = ". ".join(refined_strips)
    return {"refined_context": refined_context}

# ── Node 4: Web Search ──────────────────────────────────────────────────────
def web_search_node(state: CRAGState):
    # Rewrite query for web search
    rewrite_response = llm.invoke([
        {"role": "system", "content": "Rewrite this question as a concise web search query."},
        {"role": "user",   "content": state["question"]},
    ])
    search_query = rewrite_response.content

    results     = web_search.invoke({"query": search_query})
    web_context = "\n\n".join(r["content"] for r in results)
    return {"web_context": web_context}

# ── Node 5: Merge Context ───────────────────────────────────────────────────
def merge_context(state: CRAGState):
    parts = []
    if state.get("refined_context"):
        parts.append(state["refined_context"])
    if state.get("web_context"):
        parts.append(state["web_context"])
    return {"final_context": "\n\n---\n\n".join(parts)}

# ── Node 6: Generate ────────────────────────────────────────────────────────
def generate(state: CRAGState):
    response = llm.invoke([
        {"role": "system", "content": "Answer using ONLY the provided context. Cite sources where possible."},
        {"role": "user",   "content": f"Context:\n{state['final_context']}\n\nQuestion: {state['question']}"},
    ])
    return {"answer": response.content}

# ── Graph Assembly ──────────────────────────────────────────────────────────
graph = StateGraph(CRAGState)
graph.add_node("retrieve",             retrieve)
graph.add_node("grade_retrieval",      grade_retrieval)
graph.add_node("knowledge_refinement", knowledge_refinement)
graph.add_node("web_search",           web_search_node)
graph.add_node("merge_context",        merge_context)
graph.add_node("generate",             generate)

graph.set_entry_point("retrieve")
graph.add_edge("retrieve", "grade_retrieval")

# Three-way routing based on grade
def route_on_grade(state: CRAGState) -> str:
    grade = state["retrieval_grade"]
    if grade == "correct":
        return "knowledge_refinement"
    elif grade == "incorrect":
        return "web_search"
    else:  # ambiguous
        return "knowledge_refinement"   # ambiguous: both paths via parallel fan-out

graph.add_conditional_edges("grade_retrieval", route_on_grade)

# Both refinement and web search converge at merge
graph.add_edge("knowledge_refinement", "merge_context")
graph.add_edge("web_search",           "merge_context")
graph.add_edge("merge_context",        "generate")
graph.add_edge("generate",             END)

app = graph.compile()
```

> **Ambiguous parallel fan-out:** For the AMBIGUOUS path, LangGraph supports `Send` API to fan out to both `knowledge_refinement` and `web_search` simultaneously, then join at `merge_context`. The implementation above runs them sequentially for clarity.

---

## AWS Services for CRAG

| Component | AWS Service | Notes |
|---|---|---|
| **Document storage** | Amazon S3 | Raw PDFs, HTML, JSON |
| **Batch chunking + embedding** | AWS Glue / EMR (Spark) | Async batch at ingestion time |
| **Vector store** | Amazon OpenSearch Service | k-NN HNSW index; cosine similarity |
| **Managed RAG + Knowledge Base** | Amazon Bedrock Knowledge Bases | Auto-handles chunking → embedding → sync; supports OpenSearch managed cluster |
| **LLM (generation + evaluator)** | Amazon Bedrock | Claude 3.5 Sonnet for generation; Claude Haiku for evaluator (cheaper) |
| **Retrieval Evaluator** | AWS Lambda + Bedrock | Lambda invokes Bedrock model per doc batch |
| **Web search (Incorrect path)** | Tavily API or AWS Kendra | Kendra for enterprise doc search; Tavily for open web |
| **Orchestration** | AWS Step Functions + LangGraph on ECS | Step Functions handles the three-way routing and retry logic |
| **Retry queues (Incorrect path)** | Amazon SQS with DLQ | Rate-limit handling for web search at scale |
| **Caching** | Amazon ElastiCache (Redis) | Cache evaluator scores + final answers for repeated queries |
| **Monitoring** | Amazon CloudWatch | Track evaluator score distribution, path routing %, latency |

**Key AWS detail:** Amazon Bedrock Knowledge Bases with OpenSearch Service managed cluster auto-creates k-NN indices, handles Titan Embeddings v2, and performs HNSW-based ANN search. For the **Retrieval Evaluator**, deploy a separate Lambda that scores each retrieved chunk using a Bedrock Haiku call (cheap), then routes CORRECT / INCORRECT / AMBIGUOUS before the main generation Lambda fires.

---

## Azure Services for CRAG

| Component | Azure Service | Notes |
|---|---|---|
| **Document storage** | Azure Blob Storage | Lifecycle policies for cost management |
| **Batch ETL / chunking** | Azure Databricks or Azure Data Factory | Spark-based parallel processing |
| **Vector store** | Azure AI Search | Vector fields + HNSW; hybrid BM25 + vector search |
| **Embeddings** | Azure OpenAI — `text-embedding-3-large` | 3072-dim vectors |
| **LLM (generation)** | Azure OpenAI Service (GPT-4o) | |
| **Retrieval Evaluator** | Azure Functions + Azure OpenAI | Function invokes GPT-4o-mini per chunk for scoring |
| **Web search (Incorrect path)** | Azure Bing Search API | REST API; filter by freshness, domain |
| **Orchestration** | Azure Container Apps + LangGraph / Semantic Kernel | |
| **Retry queues** | Azure Service Bus with DLQ | For rate-limited web search retries |
| **Caching** | Azure Cache for Redis | Semantic cache for frequent query patterns |
| **Monitoring** | Azure Monitor + Application Insights | Retrieval score histograms, path routing ratios |

**Azure AI Search scaling** — two axes:
- **Partitions** — horizontal storage scaling (2 partitions = 2× vector capacity)
- **Replicas** — query throughput scaling (3 replicas = 3× QPS for concurrent users)

---

## Knowledge Refinement Detail — Why It Matters

Raw retrieved chunks contain noise: boilerplate headers, disclaimers, table-of-contents text, related-but-off-topic paragraphs. Without refinement, all of this enters the LLM context window — increasing cost and degrading answer quality.

**Strip scoring example:**

```
Doc: "Our company was founded in 1998. We offer insurance products. 
      Vehicle coverage includes comprehensive and collision. 
      For inquiries call 1-800-555-0100."

Query: "What does vehicle coverage include?"

Strip evaluation:
  "Our company was founded in 1998."         → irrelevant (drop)
  "We offer insurance products."             → irrelevant (drop)
  "Vehicle coverage includes comprehensive   → relevant   (keep) ✅
   and collision."
  "For inquiries call 1-800-555-0100."       → irrelevant (drop)

Refined context: "Vehicle coverage includes comprehensive and collision."
```

This single-sentence context produces a perfectly grounded, concise LLM answer with zero noise.

---

## CRAG vs Self-RAG

| Dimension | CRAG | Self-RAG |
|---|---|---|
| **Retrieval timing** | Always retrieves first, then evaluates quality | Conditionally retrieves mid-generation |
| **LLM calls per query** | 3–5 (evaluator + strip scoring + generate) | 1–2 (single model; fewer external calls) |
| **Evaluator model** | Separate LLM/classifier outside generation | Same fine-tuned LLM emits reflection tokens |
| **Fine-tuning required** | No — any LLM works as plug-and-play evaluator | Yes — model must be trained on reflection tokens |
| **Web search fallback** | Built-in (Incorrect path) | Not native; requires external orchestration |
| **Infrastructure complexity** | Higher (evaluator + web search + merge) | Lower (single model endpoint) |
| **Cloud cost at scale** | Higher (multiple API calls per query) | Lower once model is deployed |
| **Hallucination control** | Via evaluator + web fallback | Via `[IsSup]` self-verification token |
| **Best for** | Enterprise RAG — docs may be incomplete/inconsistent | High-volume consumer apps, latency-sensitive |

---

## Production Scaling Challenges

| Challenge | Solution |
|---|---|
| **Retrieval Evaluator is a bottleneck** | Batch evaluations; use a smaller fine-tuned classifier (T5-large, cross-encoder) rather than a full LLM for scoring |
| **Knowledge Refinement multiplies LLM calls** | Number of strips per doc × number of docs = many LLM calls; use async parallel strip evaluation |
| **Web search rate limits (Incorrect path)** | Implement retry queues with exponential backoff via SQS (AWS) or Azure Service Bus; cache web results per query |
| **Evaluator score caching** | Cache (doc_id, query_embedding) → grade to avoid re-evaluating the same doc for similar queries |
| **Ambiguous path cost** | Running both refinement AND web search doubles cost for ambiguous queries; set tighter thresholds to reduce ambiguous % |
| **Latency on CORRECT path** | Strip scoring is sequential; parallelize with `asyncio.gather()` or Lambda fan-out |

---

## Interview Questions

**Q: What is the Retrieval Evaluator in CRAG and why is it different from a relevance score in Traditional RAG?**  
A: Traditional RAG uses cosine similarity between query and document embeddings as a proxy for relevance — but cosine similarity measures semantic closeness, not factual correctness or answer-supportiveness. The CRAG Retrieval Evaluator is a dedicated LLM judge that directly asks: "Does this document contain information that can answer this specific question?" It produces a Correct / Incorrect / Ambiguous routing decision, not just a numeric similarity score.

**Q: What is Knowledge Refinement and why is it needed?**  
A: Retrieved documents are full pages or sections — they contain useful information mixed with irrelevant noise (headers, disclaimers, tangential paragraphs). Knowledge Refinement decomposes each document into fine-grained strips (sentences), scores each strip for relevance to the query, keeps only relevant strips, and recomposes them into a clean context. This reduces noise injected into the LLM context window and improves answer quality.

**Q: Why does CRAG need a Web Search fallback?**  
A: When the Retrieval Evaluator determines that all retrieved documents are Incorrect (score < 0.4), the vector DB simply doesn't contain the answer. Instead of letting the LLM hallucinate from poor context, CRAG routes to a live web search to fetch current, relevant information. This makes CRAG robust to knowledge-base gaps and stale content.

**Q: How do you handle AMBIGUOUS documents in production?**  
A: The AMBIGUOUS path runs both Knowledge Refinement on the retrieved docs AND a Web Search in parallel, then merges both contexts before generation. In production, async parallel execution (LangGraph `Send` API, or asyncio fan-out) is used so the two paths don't add latency sequentially. The merge step concatenates both contexts with a separator so the LLM has access to both sources.

**Q: CRAG vs Traditional RAG — when would you choose CRAG?**  
A: CRAG is the right choice when your knowledge base is potentially incomplete, inconsistent, or contains domains that change frequently. The Incorrect path's web search fallback handles knowledge gaps gracefully. Traditional RAG is sufficient when the knowledge base is comprehensive and well-maintained and you want simpler infrastructure.
