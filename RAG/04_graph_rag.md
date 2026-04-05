# Graph RAG — Graph-Based Retrieval-Augmented Generation
> Resume Signal: Graph RAG, knowledge graphs, entity extraction, community summaries, Microsoft GraphRAG
> Paper: Edge et al., Microsoft 2024 — https://arxiv.org/abs/2404.16130

---

## STAR Interview Answer

| | |
|---|---|
| **Situation** | A legal research assistant needed to answer cross-document questions like "How are Company A's subsidiaries connected to the regulatory issues mentioned across these 500 filings?" Traditional RAG retrieved isolated chunks — each chunk answered a local question but couldn't surface relationships that span multiple documents. |
| **Task** | Build a retrieval system that captures **relationships between entities across documents**, not just semantically similar text passages, enabling multi-hop and global-context queries. |
| **Action** | Implemented Graph RAG: used an LLM to extract entities (companies, people, laws, dates) and their relationships from every document chunk. Stored the resulting knowledge graph in Neo4j (nodes = entities, edges = relationships + source citations). At query time, combined vector search (to find the most relevant entity neighbourhood) with graph traversal (to pull related entities 2–3 hops away). Used Microsoft's GraphRAG community summarisation approach — entities clustered into communities, each with a pre-generated LLM summary. Global queries use community summaries; local queries use graph traversal. |
| **Result** | Cross-document relationship queries that returned zero useful results with Traditional RAG now returned precise, source-cited answers. The knowledge graph also served as an audit trail — every answer could be traced back to specific document+entity+relationship triples. |

---

## ELI5

Traditional RAG is like reading individual sticky notes — each note has some information, but they don't reference each other. **Graph RAG** first reads all the sticky notes and draws a **map** of how everything connects — "Note A mentions Company X", "Note B says Company X acquired Company Y", "Note C mentions Company Y's lawsuit". When you ask a question about Company X, Graph RAG doesn't just find sticky notes that mention it — it traverses the map to pull in everything connected to it, across all documents.

---

## Why Traditional RAG Fails for Relational Queries

Traditional RAG retrieves by **text similarity**. It cannot answer:
- *"What are all the companies connected to Person X across these documents?"*
- *"What is the overall theme of this entire document corpus?"*
- *"How did Event A cause Event B across multiple sources?"*

These require **traversing relationships**, not finding similar text. Graph RAG solves this by building a **knowledge graph** during ingestion and traversing it at query time.

---

## Two Query Modes — Local vs Global

Microsoft GraphRAG defines two distinct query modes:

| Query Type | Description | Example | Method |
|---|---|---|---|
| **Local search** | Specific entity-level questions | "What did John Doe say about merger X?" | Graph traversal from matched entity node |
| **Global search** | Whole-corpus thematic questions | "What are the key themes across all these reports?" | Community summaries (pre-generated LLM summaries of entity clusters) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  INGESTION PIPELINE (offline / batch)                             │
│                                                                    │
│  Documents → Chunk → LLM Entity Extraction                        │
│               ↓                                                    │
│    Entities:  [Company A], [Person B], [Law C], [Date D]          │
│    Relations: Company A --ACQUIRED--> Company B                   │
│               Person B --TESTIFIED_IN--> Case C                   │
│               ↓                                                    │
│    Knowledge Graph DB  (Neo4j / Amazon Neptune / Azure Cosmos DB) │
│               ↓                                                    │
│    Community Detection  (Leiden algorithm on graph)               │
│               ↓                                                    │
│    Community Summaries  (LLM-generated per community)             │
│               ↓                                                    │
│    Vector DB  (embeddings of entities + summaries)                │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  QUERY PIPELINE (real-time)                                        │
│                                                                    │
│  User Query                                                        │
│       ↓                                                            │
│  Query type classifier: Local or Global?                          │
│       │                                                            │
│       ├── LOCAL SEARCH                                             │
│       │     ↓                                                      │
│       │   Entity matching (vector search → find relevant nodes)   │
│       │     ↓                                                      │
│       │   Graph traversal (BFS/DFS 1–3 hops)                      │
│       │     ↓                                                      │
│       │   Pull entity + relationship subgraph                     │
│       │     ↓                                                      │
│       │   Construct context from subgraph                         │
│       │     ↓                                                      │
│       │   LLM Generate with graph context                         │
│       │                                                            │
│       └── GLOBAL SEARCH                                            │
│             ↓                                                      │
│           Retrieve relevant community summaries                   │
│             ↓                                                      │
│           Map: LLM generates partial answer per community         │
│             ↓                                                      │
│           Reduce: LLM aggregates partial answers → final answer   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Ingestion Step 1 — Entity & Relationship Extraction

For every document chunk, an LLM extracts structured triples:

```python
from pydantic import BaseModel, Field
from typing import List
from langchain_openai import ChatOpenAI

class Entity(BaseModel):
    name: str         = Field(description="Entity name (person, company, law, event, place)")
    type: str         = Field(description="Type: PERSON | COMPANY | LAW | EVENT | PLACE | CONCEPT")
    description: str  = Field(description="Brief description of this entity")

class Relationship(BaseModel):
    source:      str  = Field(description="Source entity name")
    target:      str  = Field(description="Target entity name")
    relation:    str  = Field(description="Relationship verb (ACQUIRED, TESTIFIED_IN, FOUNDED, etc.)")
    description: str  = Field(description="One-sentence description of this relationship")
    source_doc:  str  = Field(description="Document ID where this relationship was found")

class ExtractionResult(BaseModel):
    entities:      List[Entity]
    relationships: List[Relationship]

llm = ChatOpenAI(model="gpt-4o", temperature=0)

def extract_graph_elements(chunk_text: str, doc_id: str) -> ExtractionResult:
    extractor = llm.with_structured_output(ExtractionResult)
    return extractor.invoke([
        {
            "role": "system",
            "content": (
                "Extract all entities and relationships from the text. "
                "Entities: people, companies, laws, events, places, concepts. "
                "Relationships: directed triples (source → relation → target)."
            ),
        },
        {"role": "user", "content": f"Document ID: {doc_id}\n\n{chunk_text}"},
    ])
```

---

## Ingestion Step 2 — Graph Storage (Neo4j)

```python
from neo4j import GraphDatabase

driver = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j", "password"))

def upsert_graph_elements(extraction: ExtractionResult, doc_id: str):
    with driver.session() as session:
        # Upsert entities as nodes
        for entity in extraction.entities:
            session.run(
                """
                MERGE (e:Entity {name: $name})
                SET e.type = $type, e.description = $description
                """,
                name=entity.name, type=entity.type, description=entity.description,
            )

        # Upsert relationships as edges
        for rel in extraction.relationships:
            session.run(
                """
                MERGE (s:Entity {name: $source})
                MERGE (t:Entity {name: $target})
                MERGE (s)-[r:RELATES {relation: $relation}]->(t)
                SET r.description = $description, r.source_doc = $source_doc
                """,
                source=rel.source, target=rel.target,
                relation=rel.relation, description=rel.description,
                source_doc=rel.source_doc,
            )
```

---

## Ingestion Step 3 — Community Detection & Summarisation

After all documents are processed, run community detection (Leiden algorithm) on the graph to cluster tightly connected entities into communities. Then generate a summary per community:

```python
# Community detection (via graspologic or networkx)
# Each community = a cluster of related entities

def summarise_community(community_entities: list[dict], community_id: str) -> str:
    entity_text = "\n".join(
        f"- {e['name']} ({e['type']}): {e['description']}" for e in community_entities
    )
    response = llm.invoke([
        {"role": "system", "content": "Write a concise summary of this group of related entities and their connections."},
        {"role": "user",   "content": entity_text},
    ])
    return response.content

# Store community summaries — both in graph DB and vector DB
# Community summaries are the basis for Global search
```

---

## Query Pipeline — Local Search

```python
def local_search(question: str, hops: int = 2):
    # 1. Find seed entities via vector similarity on entity embeddings
    seed_entities = vector_store.similarity_search(question, k=3)

    # 2. Traverse graph from seed entities (BFS, 'hops' depth)
    subgraph_context = []
    with driver.session() as session:
        for entity in seed_entities:
            result = session.run(
                """
                MATCH (e:Entity {name: $name})-[r:RELATES*1..$hops]-(related)
                RETURN e, r, related
                LIMIT 50
                """,
                name=entity.metadata["name"], hops=hops,
            )
            for record in result:
                rel_desc = record["r"][0]["description"] if record["r"] else ""
                subgraph_context.append(
                    f"{record['e']['name']} --[{rel_desc}]--> {record['related']['name']}"
                )

    context = "\n".join(subgraph_context)

    # 3. Generate answer from subgraph context
    response = llm.invoke([
        {"role": "system", "content": "Answer the question using the provided knowledge graph context."},
        {"role": "user",   "content": f"Graph Context:\n{context}\n\nQuestion: {question}"},
    ])
    return response.content
```

---

## Query Pipeline — Global Search (Map-Reduce)

Global search uses a **map-reduce** pattern over community summaries:

```python
def global_search(question: str):
    # 1. Retrieve relevant community summaries
    communities = vector_store.similarity_search(question, k=10, filter={"type": "community_summary"})

    # 2. MAP: generate partial answer per community (parallelisable)
    partial_answers = []
    for community in communities:
        partial = llm.invoke([
            {"role": "system", "content": "Answer the question using ONLY this community context. Be concise."},
            {"role": "user",   "content": f"Community: {community.page_content}\n\nQuestion: {question}"},
        ])
        partial_answers.append(partial.content)

    # 3. REDUCE: aggregate partial answers into final answer
    combined = "\n\n---\n\n".join(partial_answers)
    final = llm.invoke([
        {"role": "system", "content": "Synthesise these partial answers into one comprehensive final answer."},
        {"role": "user",   "content": f"Partial Answers:\n{combined}\n\nOriginal Question: {question}"},
    ])
    return final.content
```

---

## AWS Services for Graph RAG

| Component | AWS Service | Notes |
|---|---|---|
| **Document storage** | Amazon S3 | Raw documents; trigger ingestion on upload |
| **Batch entity extraction** | AWS Glue / EMR (Spark) + Bedrock | Parallelise LLM extraction across millions of chunks |
| **Knowledge graph DB** | Amazon Neptune | Managed property graph (Gremlin / SPARQL); ACID transactions |
| **Vector store** | Amazon OpenSearch Service | Entity + community summary embeddings; ANN search |
| **LLM (extraction + generation)** | Amazon Bedrock (Claude 3.5) | Claude excels at structured entity extraction |
| **Community detection** | EMR (Spark + GraphX) | Leiden algorithm at scale on the extracted graph |
| **Community summarisation** | Lambda + Bedrock | One Lambda per community; parallelisable |
| **Orchestration** | AWS Step Functions + LangGraph on ECS | |
| **Caching** | Amazon ElastiCache (Redis) | Cache subgraph traversal results per entity+depth |
| **Monitoring** | Amazon CloudWatch | Graph query latency, entity extraction throughput |

---

## Azure Services for Graph RAG

| Component | Azure Service | Notes |
|---|---|---|
| **Document storage** | Azure Blob Storage | |
| **Batch entity extraction** | Azure Databricks + Azure OpenAI | Spark parallelism for LLM extraction at scale |
| **Knowledge graph DB** | Azure Cosmos DB for Apache Gremlin | Managed graph DB with Gremlin query language |
| **Vector store** | Azure AI Search | Entity + community summary embeddings |
| **LLM (extraction + generation)** | Azure OpenAI Service (GPT-4o) | |
| **Community detection** | Azure Databricks (GraphFrames) | Leiden / Louvain algorithm on Spark |
| **Community summarisation** | Azure Functions + Azure OpenAI | |
| **Orchestration** | Azure Durable Functions / ACA | |
| **Caching** | Azure Cache for Redis | |
| **Monitoring** | Azure Monitor + Application Insights | |

**Microsoft GraphRAG toolkit:** Microsoft publishes the official [GraphRAG open-source library](https://github.com/microsoft/graphrag) that runs the full pipeline (extraction → community detection → summarisation → local/global search) and maps directly to Azure OpenAI + Azure AI Search.

---

## Graph RAG vs Traditional RAG

| Dimension | Traditional RAG | Graph RAG |
|---|---|---|
| **Retrieval unit** | Text chunk (fixed window) | Entity + relationship subgraph |
| **Cross-document linking** | None — chunks are independent | Native — edges link entities across docs |
| **Multi-hop reasoning** | Not supported without complex re-ranking | Native — graph traversal supports N-hop queries |
| **Global/thematic queries** | Poor — no corpus-wide summary | Excellent — community summaries cover entire corpus |
| **Ingestion cost** | Low — embedding only | High — LLM extraction per chunk + community detection |
| **Query latency** | Low (vector search only) | Higher (vector search + graph traversal) |
| **Infrastructure** | Vector DB only | Vector DB + Graph DB + Community summaries |
| **Best for** | Localised Q&A, factual lookup | Cross-document analysis, relationship queries, investigative research |

---

## Production Scaling Challenges

| Challenge | Solution |
|---|---|
| **LLM entity extraction is expensive** | Batch chunks into parallel Lambda/Glue jobs; use cheaper model (Claude Haiku, GPT-4o-mini) for extraction |
| **Graph DB query latency** | Index entity name fields; cap traversal depth at 2–3 hops; cache hot subgraph results in Redis |
| **Entity deduplication** | Same entity appears with different names ("Apple Inc." vs "Apple"); use fuzzy matching + canonical name resolution before upsert |
| **Community detection at scale** | Run Leiden on full graph using GraphX (Spark) or graspologic; regenerate communities on a weekly schedule |
| **Map-Reduce global search cost** | k=10 community partial answers = 10 LLM calls per global query; cache community summaries; reduce k at higher traffic |
| **Graph DB storage at millions of docs** | Use Amazon Neptune or Azure Cosmos for distributed graph storage; partition by entity type |
| **Stale graph on document updates** | On document change, re-extract entities for that doc, upsert diff to graph, mark affected communities for re-summarisation |

---

## Interview Questions

**Q: What is the fundamental difference between Traditional RAG and Graph RAG retrieval?**  
A: Traditional RAG retrieves by text similarity — it finds chunks whose embeddings are close to the query embedding. Graph RAG retrieves by graph structure — it finds the entities mentioned in or related to the query, then traverses the knowledge graph to pull connected entities and relationships across all documents. Traditional RAG can't answer "how are these two entities connected?" because each chunk is independent. Graph RAG can, because edges in the knowledge graph explicitly capture those connections.

**Q: What are community summaries in Microsoft GraphRAG and why are they important?**  
A: Community summaries are LLM-generated summaries of clusters of tightly connected entities in the knowledge graph. The Leiden algorithm groups entities into communities (e.g., all entities related to a specific merger case). Each community gets a pre-generated summary. For global queries like "what are the major themes across this entire corpus?", Graph RAG uses these community summaries in a map-reduce pattern instead of traversing the entire graph, making global queries tractable in production.

**Q: What is the Local vs Global search distinction in Graph RAG?**  
A: Local search handles entity-specific questions — it finds seed entities from the query, traverses the graph 1–3 hops, and uses the subgraph as context. Global search handles corpus-level thematic questions — it retrieves relevant community summaries and runs a map-reduce (generate partial answer per community, then aggregate). The query type classifier routes between the two modes at query time.

**Q: What are the main trade-offs of Graph RAG over Traditional RAG in production?**  
A: Graph RAG has significantly higher ingestion cost (LLM entity extraction per chunk + community detection) and infrastructure complexity (graph DB + community summaries in addition to vector DB). Query latency is also higher due to graph traversal. The trade-off is worth it for cross-document relationship queries and thematic analysis. For simple factual Q&A over a well-chunked knowledge base, Traditional RAG is simpler and cheaper.

**Q: How do you handle entity deduplication in a Graph RAG pipeline?**  
A: Different documents may refer to the same entity with different names ("Apple Inc.", "Apple", "AAPL", "Apple Computer"). Without deduplication, the graph creates multiple disconnected nodes for the same entity. Solutions: (1) canonical name resolution using a fuzzy matching step before graph upsert, (2) embedding-based entity resolution (cluster entity names by embedding similarity), (3) a dedicated entity linking model (e.g., SpaCy + Wikidata linking). In production, a combination of exact-match MERGE (Neo4j) plus a weekly entity deduplication job is common.
