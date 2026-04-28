# T14 — Search Systems

---

## 1. ELI5

Imagine you have 10 billion books and someone asks: "Find me all books that mention the word 'dragon' and 'magic' but NOT 'vampire'."

**Option 1 — Regular database (B-tree index):** Open every book, scan every page, check all words. Takes weeks.

**Option 2 — Inverted index:** Before anyone asks, you build a massive dictionary:
- "dragon" → [book_4, book_17, book_892, book_3001, ...]
- "magic" → [book_4, book_23, book_892, ...]
- "vampire" → [book_17, book_23, book_500, ...]

Query: books with dragon AND magic AND NOT vampire = intersect lists 1 and 2, then remove list 3. Done in milliseconds.

That dictionary of "word → list of document IDs" is called an **inverted index** and it's the heart of every search engine.

---

## 2. Analogy

**Index page at the back of a textbook:**

```
Algorithms .............. 34, 67, 89, 204
Binary search ................... 89, 91
Sorting ............. 34, 89, 156, 204
```

The textbook index maps **term → page numbers** (document IDs where the term appears). That's exactly an inverted index. To find pages about "algorithms AND sorting" you just intersect the two lists: {34, 89, 204} ∩ {34, 89, 156, 204} = {34, 89, 204}.

Elasticsearch/Solr/Lucene build exactly this, except at petabyte scale with ranking, typo tolerance, and millisecond query times.

---

## 3. Core Concept

### Inverted Index Structure

```
Term        │ Posting List (docID  term_freq  positions)
────────────┼──────────────────────────────────────────────────────────
"dragon"    │ [(doc4, tf=3, [12,45,89]), (doc17, tf=1, [5]), (doc892, tf=7, [...])]
"magic"     │ [(doc4, tf=2, [3,67]), (doc23, tf=1, [100]), (doc892, tf=4, [...])]
"vampire"   │ [(doc17, tf=5, [...]), (doc23, tf=2, [...])]

Posting list = sorted list of doc IDs (sorted enables binary search + merge)

Forward index (also stored): docID → {term, freq, length} for BM25 scoring
Doc values (columnar):        docID → field value (for sorting, aggregations)
Stored fields:                docID → original document (for returning _source)
```

### Indexing Pipeline

```
Raw document → Analysis Chain → Inverted index

  Input: "The Quick BROWN fox jumps over the lazy dog!"
  
  Step 1: Tokenizer
    → ["The", "Quick", "BROWN", "fox", "jumps", "over", "the", "lazy", "dog!"]
    
  Step 2: Lowercase filter
    → ["the", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog!"]
    
  Step 3: Stop word removal (common words — low signal)
    → ["quick", "brown", "fox", "jumps", "lazy", "dog!"]
    
  Step 4: Stemming / Lemmatization
    "jumps" → "jump"  (Porter stemmer: removes suffix)
    "dogs"  → "dog"   (lemmatizer: maps to root)
    → ["quick", "brown", "fox", "jump", "lazy", "dog"]
    
  Step 5: Synonym expansion (optional, index-time or query-time)
    "quick" → also index "fast", "swift"
    
  Final terms indexed: ["quick", "brown", "fox", "jump", "lazy", "dog"]
  
Same pipeline applied at QUERY time (so "Jumping" → "jump" → matches "jumps")
```

---

## 4. Ranking Math

### TF-IDF (Classic, Conceptual Foundation)

$$\text{TF}(t, d) = \frac{\text{count of term } t \text{ in document } d}{\text{total terms in } d}$$

$$\text{IDF}(t) = \log\left(\frac{\text{total documents}}{\text{documents containing } t}\right)$$

$$\text{TF-IDF}(t, d) = \text{TF}(t, d) \times \text{IDF}(t)$$

```
Intuition:
  TF (term frequency): doc mentions "dragon" 10 times → likely relevant
  IDF (inverse document frequency): 
    "the" appears in ALL docs → IDF ≈ 0 → worthless for ranking
    "archaeopteryx" appears in 2 of 10M docs → IDF very high → very specific
    
Problem with TF-IDF:
  Long document has more words → naturally higher TF → unfair advantage
  Solution: BM25
```

### BM25 (Modern Standard — Elasticsearch default)

$$\text{BM25}(t, d) = \text{IDF}(t) \cdot \frac{tf(t,d) \cdot (k_1 + 1)}{tf(t,d) + k_1 \cdot \left(1 - b + b \cdot \frac{|d|}{\text{avgdl}}\right)}$$

Where:
- $k_1 = 1.2$ to $2.0$ — term frequency saturation (diminishing returns after N mentions)
- $b = 0.75$ — length normalization factor
- $|d|$ = document length; $\text{avgdl}$ = average document length in corpus

```
Key improvements over TF-IDF:
  1. Frequency saturation: tf saturation term means 100 mentions not 10× better than 10
     → prevents "repeat dragon 1000 times" attack
  2. Length normalization: long doc penalized relative to avg doc length
     → 200-word article mentioning "dragon" once = more relevant than
        2000-word article also mentioning it once

k1 tuning: k1=1.2 (web search), k1=2.0 (longer technical docs)
b tuning:  b=1.0 (full length norm), b=0.0 (no length norm — for short titles)
```

---

## 5. Query Processing Pipeline

```
User query: "fast dragon slayer"

1. Parse & Analyze:
   "fast dragon slayer" → tokens: ["fast", "dragon", "slayer"]
   Apply synonyms: "fast" → also check "quick", "swift"
   
2. Retrieve posting lists (parallel, per shard):
   "fast":  [(doc1, tf=2), (doc4, tf=1), (doc892, tf=3)]
   "dragon": [(doc4, tf=5), (doc17, tf=1), (doc892, tf=7)]
   "slayer": [(doc4, tf=2), (doc892, tf=1)]
   
3. Boolean intersection/union (query type):
   AND query: intersect all lists → only docs in ALL lists
   OR query:  union all lists → docs in ANY list
   
   Intersection algorithm: merge-sort (posting lists are sorted by docID)
   Process smallest list first (fewer iterations):
     "slayer" (2 docs) INTERSECT "dragon" (3 docs) INTERSECT "fast" (3 docs)
     → {doc4, doc892}
     
4. Score each candidate with BM25:
   score(doc4)   = BM25("fast", doc4)  + BM25("dragon", doc4)  + BM25("slayer", doc4)
   score(doc892) = BM25("fast", doc892) + BM25("dragon", doc892) + BM25("slayer", doc892)
   
5. Top-K heap (min-heap, size K):
   Maintain K candidates; swap in better scores
   Result: top 10 results in O(N log K)
   
6. Return to client: hit list + scores + source documents
```

---

## 6. Distributed Search Architecture

```
                    ┌──────────────────────┐
   Query ──────────►│  Query Coordinator   │
                    │  (Elasticsearch node)│
                    └──────────┬───────────┘
                               │ fan-out parallel
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
   ┌───────────┐         ┌───────────┐         ┌───────────┐
   │  Shard 0  │         │  Shard 1  │         │  Shard 2  │
   │ docs 0-3M │         │ docs 3-6M │         │ docs 6-9M │
   └───────────┘         └───────────┘         └───────────┘
         │ top-100 local         │ top-100 local        │ top-100 local
         └─────────────────────►◄─────────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Global merge-sort   │
                    │  top-10 from 300     │
                    └──────────────────────┘

Why top-100 per shard, not top-10?
  If each shard sends top-10 and global top-10 happen to all be on one shard,
  the other shards' 10 would miss those. Over-fetch locally, merge globally.
  (The "scatter-gather" problem in distributed search)
  
Sharding strategies:
  Hash-based: docID % num_shards → even distribution, no routing
  Time-based: one index per month → efficient date-range queries; easy ttl (delete old index)
  Category-based: separate index per language/tenant → isolated, but complex routing
```

---

## 7. Real-Time vs Bulk Index

```
Two-tier indexing for freshness + efficiency:

In-memory (real-time) index:
  ├── New documents buffered in TieredMergePolicy memory segments
  ├── Available for search within 1 second (near-real-time NRT)
  ├── Small segments, not compressed
  └── Refresh = flush in-memory buffer → new segment visible to search

On-disk (persistent) index:
  ├── Compacted, compressed Lucene segments
  ├── Background merge process combines small segments → fewer, larger
  ├── Optimized for fast reads (compressed, cached in OS page cache)
  └── fsync for durability

Query merges both:
  results = search(in_memory_segments) + search(on_disk_segments)
  → deduplicate → merge-sort by score

Index size rule:
  Raw text:    10GB
  Inverted index: 20-40% of source = 2-4GB
  + doc values (aggregations): +15% = 1.5GB
  + stored fields (_source): +80% ≈ 8GB (compressed copy of original)
  Total Elasticsearch index: 50-80% of raw source size
```

---

## 8. Fuzzy Search & Autocomplete

```
Fuzzy search (typo tolerance):
  Query "draogn" → match "dragon"
  
  Levenshtein distance: min edit operations (insert, delete, substitute, transpose)
  distance("draogn", "dragon") = 2 (transpose a↔o + transpose o↔n)
  
  BK-tree: index of all terms with distance-based routing
  Or: Elasticsearch fuzziness parameter:
    GET /books/_search
    { "query": { "match": { "title": { "query": "draogn", "fuzziness": "AUTO" }}}}
  "AUTO": distance 0 for ≤2 chars, 1 for 3-5 chars, 2 for >5 chars
  
Autocomplete (prefix search):
  "dra" → suggest "dragon", "drama", "draw"
  
  Edge n-gram tokenizer at INDEX time:
    "dragon" → ["d", "dr", "dra", "drag", "drago", "dragon"]
  Normal term lookup at QUERY time:
    "dra" → exactly matches indexed token "dra" → return docs containing it
  
  Completion suggester (separate in-memory FST):
    Finite State Transducer: prefix → completions in O(prefix_length) 
    Fastest for autocomplete, but limited to exact prefix (no fuzzy)
```

---

## 9. MERN Dev Notes

### Elasticsearch with Node.js

```javascript
const { Client } = require('@elastic/elasticsearch');
const client = new Client({ node: 'http://localhost:9200' });

// Index a document
async function indexProduct(product) {
  await client.index({
    index: 'products',
    id: product._id.toString(),
    document: {
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      tags: product.tags
    }
  });
}

// Full-text search with filters + pagination
async function searchProducts(query, filters = {}, page = 1, size = 20) {
  const { category, minPrice, maxPrice } = filters;
  
  const body = {
    from: (page - 1) * size,
    size,
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query,
              fields: ['name^3', 'description', 'tags^2'], // ^N = boost
              fuzziness: 'AUTO'  // typo tolerance
            }
          }
        ],
        filter: [
          category && { term: { category } },
          (minPrice || maxPrice) && {
            range: { price: { gte: minPrice, lte: maxPrice } }
          }
        ].filter(Boolean)  // remove null filters
      }
    },
    highlight: {
      fields: { description: {} }  // return matching snippets
    }
  };
  
  const result = await client.search({ index: 'products', body });
  
  return {
    hits: result.hits.hits.map(h => ({ ...h._source, score: h._score })),
    total: result.hits.total.value
  };
}

// Keep ES in sync with MongoDB (dual-write pattern)
// On every MongoDB save, also update ES:
userSchema.post('save', async function(doc) {
  await indexProduct(doc).catch(err => 
    logger.error('ES index failed', { err, docId: doc._id })
    // Non-blocking: don't fail the MongoDB save if ES is down
    // Use retry queue (Bull) for eventual sync
  );
});
```

---

## 10. Real-World Case Studies

### Twitter Earlybird — Sub-10 Second Indexing

```
Challenge: tweet posted → searchable within 10 seconds (not minutes)
Scale: 500M tweets/day; 500K+ QPS during events (elections, World Cup)

Architecture:
  Earlybird: custom in-memory Lucene-based search engine
  
  Temporal sharding (key insight):
    "realtime" index: last 7 days (hot, in RAM, fast writes)
    "archive" index: older tweets (disk-based, infrequent writes, heavy reads)
    
  Why? Tweets searchable immediately → in-memory segment visible in 1s
       Archive queries rare → disk-based fine
       
  Ingestion pipeline:
    Tweet created → Kafka topic → Earlybird indexer → in-memory segment
    Total pipeline: < 10 seconds (mostly Kafka lag + indexer batch)
    
  Scale trick: shard by tweet_id (time-ordered) 
    Recent shard: smaller → caches entirely in RAM → fast
    Query coordinator fans out to all shards, merge result
    
  Peak load (2020 US Election):
    12M tweets (election-related) indexed in <10s each
    Query load: 500K+ QPS search for "election"
    p50 latency: 8ms; p99: 45ms
```

### Google — Fresh Index + Main Index

```
Two separate search pipelines:

Main index:
  Updated: every few weeks via full batch crawl
  Size: ~100 billion pages
  Quality: high-quality signals (PageRank, anchor text, full analysis)
  Latency: 200ms p50 (massive serving infrastructure)
  
Fresh index (Caffeine):
  Updated: minutes to hours after page changes
  Size: billions of pages (important/popular pages only)
  Quality: fast but fewer signals (less PageRank computation)
  Goal: news, stock prices, trending events searchable in near-real-time
  
Query merging:
  Google blends results: fresh index for recent content
                         main index for authority/quality
  QPS: 99,000 queries/second (global average 2024)

Infrastructure:
  Colossus distributed file system stores inverted indexes
  Sharded across thousands of servers per data center
  3 data centers handle queries round-robin (US, EU, APAC)
  Result: 99.9%+ availability; <200ms median globally
```

---

## 11. Interview Cheat Sheet

**Q: What is an inverted index and why is it used for search?**
> An inverted index maps each unique term to the sorted list of document IDs (and metadata like term frequency, positions) where that term appears. It makes full-text search O(1) per term lookup + O(K) merge for K results, vs O(N) for full table scan. It's "inverted" because it goes term→documents instead of document→terms.

**Q: What is BM25 and how is it better than TF-IDF?**
> Both rank documents by term relevance. TF-IDF: score = term_frequency × inverse_document_frequency. Flaw: a 10,000-word doc gets unfairly high score just from raw term counts. BM25 adds: (1) term frequency saturation — after K mentions, additional mentions have diminishing impact (controlled by k1=1.2-2.0); (2) length normalization — penalizes long documents relative to corpus average (b=0.75). BM25 is the default in Elasticsearch, Lucene, and Solr.

**Q: How does distributed search work (scatter-gather)?**
> Index is sharded across N nodes. On query: coordinator broadcasts to all shards in parallel (scatter), each shard computes local top-K results (over-fetch, typically top-100), coordinator collects all and merge-sorts to final top-K (gather). Over-fetching per shard is necessary because the global top-10 might all be on one shard — if each shard only sends 10, results could miss the best globally.

**Q: How would you keep Elasticsearch in sync with a MongoDB primary database?**
> Dual-write: on every successful MongoDB write, fire an async ES index call (non-blocking; use a retry queue like Bull/BullMQ for failures). For durability: also process the MongoDB change stream (oplog tail) to catch writes that bypassed the dual-write (direct DB updates, migrations). The change stream provides exactly-once ordered delivery and is the source of truth for sync.

---

## 12. Keywords & Glossary

| Term | Definition |
|------|-----------|
| **Inverted Index** | Core search data structure: term → [docID, tf, positions] |
| **Posting List** | Sorted list of document IDs for a given term |
| **TF** | Term Frequency — how often a term appears in a document |
| **IDF** | Inverse Document Frequency — rarity of a term across corpus |
| **BM25** | Modern ranking algorithm; adds TF saturation + length norm |
| **Analyzer** | Tokenizer + filters (lowercase, stemmer, stopwords, synonyms) |
| **Stemming** | Reducing words to root form: "running" → "run" |
| **Lemmatization** | Linguistic root form: "better" → "good" (smarter than stemming) |
| **Stop Words** | Common words removed from index: "the", "is", "at" |
| **Scatter-Gather** | Fan out query to all shards, merge results |
| **Segment** | Immutable Lucene index unit; new docs create new segments |
| **Merge** | Background process combining small segments → fewer, larger |
| **NRT** | Near-Real-Time — documents searchable within ~1 second |
| **Refresh** | Flush in-memory buffer to new disk segment (ES default: 1s) |
| **Shard** | Horizontal partition of an index (Elasticsearch unit) |
| **Replica Shard** | Copy of shard for HA and read scaling |
| **Fuzziness** | Levenshtein distance tolerance for typo matching |
| **Edge N-gram** | Prefix tokens ("dra", "drag", ...) for autocomplete |
| **FST** | Finite State Transducer — compact prefix data structure for suggest |
| **Highlight** | Return matching context snippets around search terms |
