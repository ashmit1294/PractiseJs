# Pattern 08 — Web Crawler (like Googlebot)

---

## ELI5 — What Is This?

> Imagine a robot in a giant library. It starts at one book, reads it,
> writes down what it found, then follows every "see also" reference to another book.
> It goes to that book, reads it, writes it down, follows its references.
> It keeps going forever across billions of books.
> That robot is a web crawler — it reads the entire internet by following links.

---

## Glossary

| Word | ELI5 Meaning |
|---|---|
| **URL Frontier** | The list of URLs waiting to be visited. Like a to-do list that keeps growing as you discover new links. |
| **Bloom Filter** | A memory-efficient way to answer "have I seen this URL before?" It uses bits (tiny on/off flags) instead of storing full URLs. Can occasionally say "yes" when the answer is "no" (false positive) but never says "no" when the answer is "yes". |
| **False Positive** | The Bloom Filter says "yes, already visited" but it is actually a new URL. This means the URL is skipped incorrectly — about 1% of the time. Acceptable to save 80x memory. |
| **Politeness** | Crawlers must not hammer a website too fast. robots.txt is a file websites publish telling crawlers what they are allowed to crawl and how fast. |
| **robots.txt** | A plain-text file at the root of every website (e.g. example.com/robots.txt) that says "you may crawl /blog but not /admin, and wait 1 second between requests". |
| **URL Normalisation** | Converting a URL to a standard form. `HTTPS://Example.COM/page?ref=abc` becomes `https://example.com/page` — tracking parameters stripped, case lowercased. |
| **Spider trap** | An infinite sequence of auto-generated URLs like /calendar/2024/01/01/2024/01/02/... that lures crawlers into looping forever. |
| **SimHash** | A technique that produces a fingerprint of a text document. Two nearly-identical documents have very similar fingerprints, making near-duplicate detection fast. |
| **Idempotent** | Doing the same thing twice gives the same result as doing it once. A crawl that processes the same URL twice produces the same stored content — safe to replay. |
| **Hinted Handoff** | When a Cassandra node is down and a write comes in, the other nodes hold the write as a "hint" and deliver it when the dead node recovers. Nothing is lost. |

---

## Component Diagram

```mermaid
graph TB
    subgraph SEED["Starting Point"]
        SEEDS["Seed URLs — known important sites to start from"]
    end

    subgraph FRONTIER["URL Frontier — the crawl to-do list"]
        PRIORITY["Priority Queue — ranks URLs by importance and freshness"]
        DEDUP["URL Dedup Filter — Bloom Filter, have we crawled this URL?"]
        POLITENESS["Politeness Manager — enforces per-domain rate limits and robots.txt"]
    end

    subgraph FETCH["Fetcher Pool — thousands of async workers"]
        DNS["DNS Cache — resolves domain names, cached per domain"]
        HTTP["HTTP Workers — download the page"]
        ROBOTS_CACHE["robots.txt Cache — TTL 24 hours per domain"]
    end

    subgraph PARSE["Parser"]
        HTML_PARSER["HTML Parser — extracts text, title, metadata"]
        LINK_EXTRACTOR["Link Extractor — finds all href links"]
        NORM["URL Normaliser — removes tracking params, lowercases"]
    end

    subgraph STORAGE["Storage"]
        KAFKA["Kafka — receives crawl result events"]
        S3["S3 — stores raw HTML for each page"]
        CASS["Cassandra — URL visit history, last crawled, next scheduled crawl"]
        ES["Elasticsearch — indexed content for search"]
    end

    subgraph RESCHEDULE["Re-crawl Scheduler"]
        FRESH["Freshness Analyser — news sites re-crawled hourly, wikis weekly, static pages monthly"]
    end

    SEEDS --> PRIORITY --> DEDUP
    DEDUP -- not seen --> POLITENESS --> DNS --> HTTP
    HTTP --> ROBOTS_CACHE
    ROBOTS_CACHE -- allowed --> HTML_PARSER
    HTML_PARSER --> LINK_EXTRACTOR --> NORM --> DEDUP
    HTML_PARSER --> KAFKA
    KAFKA --> S3 & CASS & ES
    ES --> FRESH --> PRIORITY
```

---

## Request Flow — One URL Crawled

```mermaid
sequenceDiagram
    participant FQ as URL Frontier Queue
    participant BLOOM as Bloom Filter
    participant POL as Politeness Manager
    participant HTTP as HTTP Fetcher
    participant PARSER as HTML Parser
    participant KAFKA as Kafka

    FQ->>BLOOM: is https://example.com/blog seen?
    BLOOM-->>FQ: NO — not in bloom filter

    FQ->>POL: queue URL for domain example.com
    Note over POL: last request to example.com was 0.8 seconds ago, min interval is 1s, wait 0.2s

    POL->>HTTP: fetch https://example.com/blog
    HTTP->>HTTP: DNS resolve example.com from local cache
    HTTP->>HTTP: GET /blog HTTP/1.1
    HTTP-->>PARSER: 200 OK HTML body

    PARSER->>BLOOM: mark URL as visited
    PARSER->>PARSER: extract title, description, text content
    PARSER->>PARSER: extract links: /blog/post1, /blog/post2, https://other.com/
    PARSER->>FQ: add new links to frontier
    PARSER->>KAFKA: publish crawl event with URL, content, links, statusCode
```

---

## Bloom Filter — How It Works

```mermaid
flowchart TD
    A["New URL arrives"] --> B["Normalise URL — strip tracking params, lowercase"]
    B --> C["Run 3 hash functions: h1 h2 h3 on the URL"]
    C --> D{"Are all 3 bit positions set to 1 in filter?"}
    D -- Yes all set --> E["Probably already crawled — skip this URL. 1% chance it is wrong — false positive."]
    D -- At least one is 0 --> F["Definitely new — add to frontier queue"]
    F --> G["Set all 3 bit positions to 1 in the filter"]
```

> **Why not just a hash set?**
> 10 billion URLs × 100 bytes each = 1 TB of RAM.
> Bloom Filter for 10 billion URLs at 1% false positive rate = only 12 GB.
> You accept crawling 1% of URLs twice to save 980 GB of RAM.

---

## Bottlenecks — Every Point Explained

| # | Bottleneck | Why It Hurts | Fix |
|---|---|---|---|
| 1 | **URL Frontier too large for memory** | Billions of discovered URLs cannot fit in an in-memory queue. | Back the priority queue with Kafka — disk-persistent, distributed, survives restarts. |
| 2 | **DNS resolution latency** | Each new domain needs a DNS lookup — 50ms per lookup × billions of pages = enormous overhead. | Cache DNS results per domain with a TTL of 5 minutes. Most pages are on domains already resolved recently. |
| 3 | **Spider trap** | Auto-generated infinite URLs like /year/month/day/... trap crawler in an infinite loop eating all resources. | Maximum depth limit of 10 levels. Detect repeating URL path patterns and blacklist them. |
| 4 | **Duplicate content** | Same article at /page?lang=en and /page?lang=en-US. Wastes crawl budget. | URL normalisation removes redundant parameters. SimHash fingerprint detects near-duplicate content. |
| 5 | **robots.txt fetched too often** | Fetching robots.txt for every page on a domain wastes requests. | Cache robots.txt per domain for 24 hours. |
| 6 | **Malformed HTML crashes parser** | About 30% of web pages have broken HTML. An uncaught exception kills the worker. | Use lenient HTML parsers (Cheerio, html5lib). Sandbox each parse with a 5-second timeout. |

---

## What Happens When Each Part Fails?

```mermaid
flowchart TD
    F1["HTTP Worker Crashes Mid-Fetch"]
    F2["Kafka Consumer Falls Behind — Large Lag"]
    F3["Bloom Filter Data Corrupted or Lost"]
    F4["Target Website Returns 429 Too Many Requests"]
    F5["Cassandra URL Database Is Down"]
    F6["Crawler Follows Infinite Redirect Loop"]

    F1 --> R1["The URL was published to Kafka but its offset was not committed.
    Worker restarts and replays the same URL from Kafka.
    The crawl is idempotent — re-crawling the same URL just overwrites the same S3 file.
    No data is lost. The URL might be crawled twice at most.
    This is intentional: correctness is more important than crawling a URL exactly once."]

    F2 --> R2["Kafka durably stores all crawl events for 7 days.
    Consumer workers are behind but not losing data — just delaying indexing.
    Scale up consumer workers horizontally.
    Ensure number of consumer threads equals number of Kafka topic partitions.
    Alert on consumer lag exceeding 10,000 messages.
    Back-pressure signal: slow down fetchers until consumers catch up."]

    F3 --> R3["Without the Bloom Filter, every URL looks new.
    Crawler will revisit already-crawled URLs.
    Cassandra has the real visit history — it is the durable source of truth.
    Rebuild the Bloom Filter by scanning all visited URLs from Cassandra.
    This takes hours for 10 billion entries but restores correctness.
    Mitigation: persist Bloom Filter snapshot to S3 every hour."]

    F4 --> R4["Domain blocks the crawler with a 429 response.
    Politeness Manager records the block with exponential backoff:
    retry after 1 hour, then 2 hours, then 4 hours.
    After 3 consecutive 429 responses the domain is deprioritised for 48 hours.
    No data loss — URL stays in priority queue at lower priority.
    This protects the target site and protects the crawler's IP reputation."]

    F5 --> R5["Cannot record that a URL has been crawled.
    Raw HTML is still saved to S3 independently — that path is separate.
    Crawler continues fetching but with no persistence of crawl history.
    On recovery, replay Kafka events to rebuild the Cassandra URL history.
    Cassandra with RF=3 and quorum writes survives one node failure with zero impact."]

    F6 --> R6["HTTP client follows /a -> /b -> /a -> /b -> ... endlessly.
    Redirect loop detector in the HTTP client checks if any URL in the redirect
    chain already appeared earlier in that same chain.
    If a loop is detected, the fetch aborts immediately.
    Maximum redirect hops hard limit is 10 regardless of loop detection."]
```

---

## Key Numbers

| Metric | Value |
|---|---|
| Google indexed pages | ~130 trillion |
| Bloom Filter for 10B URLs at 1% FP | ~12 GB |
| DNS cache TTL | 5 minutes |
| robots.txt cache TTL | 24 hours |
| Max crawl depth | 10 levels |
| 429 retry backoff | 1h, 2h, 4h, 8h |
