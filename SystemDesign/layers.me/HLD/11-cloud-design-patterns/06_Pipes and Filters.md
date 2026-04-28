# T06 — Pipes and Filters Pattern: Data Processing Pipelines

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/pipes-and-filters

---

## ELI5 (Explain Like I'm 5)

Think about a water treatment plant. Dirty river water goes in. It passes through filter 1 (removes big debris) → filter 2 (removes chemicals) → filter 3 (removes bacteria) → clean drinking water comes out. Each filter does one specific job. The water "flows" (pipe) from one filter to the next.

Data processing works the same way: raw data flows through a series of independent filters (each does one transformation), and processed data comes out the other end.

---

## Analogy

**Unix command-line pipes**: `cat access.log | grep ERROR | awk '{print $1}' | sort | uniq -c`

Each command is a "filter" doing one thing well. The `|` operator is the "pipe" connecting them. You can rearrange, add, or remove commands without touching their internals. The same principle applies at system scale.

---

## Core Concept

The Pipes and Filters pattern **decomposes complex data processing into a chain of independent, reusable filters connected by pipes**. Each filter:
- Has a standard interface: `process(input) → output`
- Performs **one transformation** only
- Knows nothing about its neighbors (loose coupling)
- Can be independently developed, deployed, and scaled

**Pipes** are the conduits (in-memory queues, channels, or message brokers like Kafka/RabbitMQ) that move data between filters, handling buffering and potentially format conversion.

**Why this matters**: Netflix's encoding pipeline had a monolithic transcoder that couldn't adapt to new codecs or scale components independently. Refactoring to pipes and filters let them scale just the encoding filter 10x without touching the decoding filter.

---

## ASCII Diagrams

### Basic Pipeline

```
[Input Source] → [Filter 1: Parse] → [Pipe/Queue] → [Filter 2: Transform] → [Pipe/Queue] → [Filter 3: Aggregate] → [Output Sink]

Each filter: knows only its input/output contract. No knowledge of other filters.
```

### Log Processing Pipeline with Backpressure

```
Raw Logs (5000/sec)
    │
    ▼
[ParseFilter] (5000/sec capacity)
    │
    ▼ Queue (max 10K msgs)
    │◄── BACKPRESSURE: if queue fills, ParseFilter blocks ──┐
    ▼                                                        │
[EnrichFilter] (3000/sec) ← BOTTLENECK                      │
    │                                                        │
    ▼ Queue (max 10K msgs)                                   │
    ▼                                                        │
[FilterByLevel] (2000/sec — only keeps ERROR/WARN)          │
    │                                                        │
    ▼ Queue (max 5K msgs)                                    │
    ▼                                                        │
[AggregateFilter] (1000/sec)                               ─┘
    │
    ▼ Dead Letter Queue (failed enrichments after 3 retries)
    ▼
[Metrics Store]
```

### Pipeline Variants

```
LINEAR PIPELINE:
  Input → [A] → [B] → [C] → Output

TEE PIPELINE (parallel consumers):
  Input → [Parse] → ┬──► [Consumer 1: Real-time alerts]
                    ├──► [Consumer 2: Storage]
                    └──► [Consumer 3: Analytics]

CONDITIONAL PIPELINE (content-based routing):
  Input → [Validate] → valid? → ┬──► YES → [Process] → Output
                                 └──► NO  → [Error Handler] → DLQ

FEEDBACK LOOP (iterative refinement):
  Input → [Filter] → [Model] → ┬──► Output
                                └──► [Feedback] ──► [Filter] (improve)
```

### Netflix Video Encoding Pipeline

```
Video Upload (S3)
    │
    ▼
[Validate] — check integrity, format
    │
    ▼
[Decode] (C++ — performance) — extract raw frames
    │
    ├──► TEE to [Quality Metrics] (Python/ML) — parallel quality pipeline
    │
    ▼
[Analyze] (Python/ML) — scene detection, HDR analysis
    │
    ├──► [Encode H.264 1080p]  ┐
    ├──► [Encode H.265 4K]     ├── All parallel
    └──► [Encode AV1 4K]       ┘
              │
              ▼
         [Package] — HLS/DASH manifests
              │
              ▼
         [Upload to CDN]
```

---

## How It Works (Step by Step)

1. **Define filter interfaces**: Each filter implements `process(input) → output`. For a video pipeline: `ValidateFilter`, `DecodeFilter`, `AnalyzeFilter`, `EncodeFilter`, `PackageFilter`.

2. **Connect with pipes**: In-process: queues/channels. Distributed: Kafka or RabbitMQ topics between filter services. Filters don't know what transport is used.

3. **Handle backpressure**: When slow filter can't keep up (EnrichFilter: 3K/sec, ParseFilter: 5K/sec), bounded queues fill up and block the producer. Kafka consumer lag metrics detect bottlenecks.

4. **Handle errors gracefully**: Transient errors (API timeout, network blip) → retry with exponential backoff (3x). Permanent errors (corrupt file, invalid JSON) → Dead Letter Queue immediately; pipeline continues with next record.

5. **Enable reconfiguration**: Facebook's image pipeline lets teams register custom filter services; pipeline reads from config to route through them. Adding a filter = update config, no code changes to existing filters.

---

## Variants

| Variant | Description | Example |
|---------|-------------|---------|
| **Linear** | Strict sequence: A → B → C | ETL pipelines, log processing |
| **Tee (Parallel)** | Output splits to multiple consumers | Twitter firehose: one stream → search, timeline, analytics |
| **Conditional** | Route based on content | Stripe: low-risk payment → fast-track; high-risk → extra verification |
| **Feedback Loop** | Late-stage output feeds back to earlier stage | ML training: predictions improve the model |

---

## Trade-offs

| Dimension | Pipes & Filters | Monolithic |
|-----------|----------------|------------|
| **Performance** | 20-50% overhead from serialization | Faster (no marshaling) |
| **Modularity** | Each filter independent — deploy/scale alone | All coupled |
| **Reusability** | Filters reusable across pipelines | Logic buried, not reusable |
| **Testing** | Validate each filter in isolation | Must test entire monolith |
| **Team ownership** | Different teams own different filters | Single team must own it all |
| **Debugging** | Requires distributed tracing | Single process — easy |

**Decision**: Use pipes and filters when flexibility and maintainability outweigh the 20-50% serialization overhead. For ultra-low-latency paths (<1ms), monolithic processing may be better.

---

## When to Use (and When Not To)

**Use when:**
- Processing has **clear sequential stages** with different resource requirements (decode: CPU; encode: GPU; upload: network)
- Different teams own different processing stages
- Need to A/B test processing logic (route 10% to new filter version)
- Batch and stream processing share the same filter logic

**Avoid when:**
- Processing requires tight coupling between stages (step 2 needs step 1's intermediate state)
- Ultra-low-latency requirements (<5ms) — serialization overhead matters
- Processing is trivial (3 lines of code don't need 5 filters)
- All stages must succeed atomically (use a transaction, not a pipeline)

**Anti-patterns:**
- Filters too granular (one filter per code line) — overhead without benefit
- Filters too coarse (one "processing" filter doing 10 things) — defeats the purpose
- Sharing mutable state between filters via global variables
- Ignoring backpressure until system crashes under load

---

## MERN Developer Notes

```javascript
// In-process pipeline using Node.js streams (fastest — no serialization)
const { Transform } = require('stream');

class ParseFilter extends Transform {
  _transform(chunk, encoding, callback) {
    try {
      const parsed = JSON.parse(chunk.toString());
      this.push(JSON.stringify(parsed));
      callback();
    } catch (err) {
      // Permanent error — skip this record, don't crash pipeline
      console.error('Parse failed, skipping:', err.message);
      callback(); // no push = record dropped (or push to DLQ)
    }
  }
}

class EnrichFilter extends Transform {
  async _transform(chunk, encoding, callback) {
    const data = JSON.parse(chunk.toString());
    try {
      data.geo = await geoLookup(data.ip); // transient errors handled by retry wrapper
      this.push(JSON.stringify(data));
      callback();
    } catch (err) {
      callback(err); // signal error — pipeline can decide to retry or DLQ
    }
  }
}

// Connect filters with pipes
rawLogStream
  .pipe(new ParseFilter())
  .pipe(new EnrichFilter())
  .pipe(new FilterByLevel(['ERROR', 'WARN']))
  .pipe(new AggregateFilter())
  .pipe(metricsWriteStream);
```

**Distributed pipeline (Kafka-based):**
- Each filter is a separate microservice
- Each filter consumes from input Kafka topic, processes, publishes to output topic
- Independent scaling: `kubectl scale deployment encode-filter --replicas=10`
- Monitoring: Kafka consumer lag per filter = identify bottleneck filter

---

## Real-World Examples

| Company | Pipeline | Key Detail |
|---------|----------|-----------|
| **Netflix** | Video Encoding | Decode (C++), Analyze (Python/ML), Encode multi-format — each separate service. Added AV1 codec by modifying only the encode filter. Tee pattern: analyze filter feeds both encode pipeline AND quality metrics pipeline in parallel. |
| **Facebook** | Image Processing | Upload → validate → virus scan → EXIF strip → resize → face detection → content moderation → storage. GPU instances for face detection; CPU for resize. Conditional routing: flagged images → human review filter (reduces review cost by 90%). |
| **Twitter** | Firehose Processing | Incoming tweets → tee to (search indexing, timeline fanout, analytics, spam detection). Each consumer is an independent filter pipeline. |

---

## Interview Cheat Sheet

### Q: When would you choose pipes and filters over a monolithic function?
**A:** When different stages have different resource requirements (CPU vs. GPU vs. I/O), different teams own different stages, or you need independent scaling. Monolith is fine for trivial processing or ultra-low-latency where serialization matters.

### Q: How do you handle a filter that fails mid-processing?
**A:** Transient failures (network, API timeout) → retry with exponential backoff (3x). Permanent failures (corrupt data, invalid format) → route to Dead Letter Queue, record the reason, alert ops, and **continue processing other records**. The key insight: never let one bad record block the entire pipeline.

### Q: What is backpressure in a pipeline context?
**A:** When a slow filter (3K/sec) can't keep up with a fast upstream filter (5K/sec), the pipe/queue between them fills up. Backpressure is the mechanism that signals upstream to slow down — either by blocking the producer (bounded queue), rate limiting, or dynamically scaling the slow filter.

### Q: How do you debug when a record produces wrong output?
**A:** Distributed tracing with a correlation ID propagated through all filters. Structured logging at each filter boundary (input data, output data, processing time). Query trace by record ID to see which filter transformed the data incorrectly.

### Red Flags to Avoid
- Sharing state between filters through global variables (creates hidden coupling)
- Ignoring backpressure (ask "what happens when filter 3 is slow?")
- Filters too granular or too coarse without justification
- Not considering error handling/monitoring
- Can't explain when NOT to use this pattern

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Filter** | Self-contained processing component with `process(input) → output` interface; performs one transformation |
| **Pipe** | Conduit between filters — can be in-memory queue, channel, or distributed message broker |
| **Pipeline** | Sequence of filters connected by pipes |
| **Backpressure** | Mechanism that slows/blocks upstream filters when downstream filters are overwhelmed |
| **Tee Pattern** | Pipeline variant where one filter's output splits to multiple parallel consumers |
| **Conditional Pipeline** | Pipeline variant that routes data to different filter paths based on content |
| **Dead Letter Queue (DLQ)** | Queue receiving records that failed processing after N retries — for investigation |
| **ETL** (Extract, Transform, Load) | Data integration pattern: extract from source, transform, load to destination — classic pipes-and-filters use case |
| **Consumer Lag** | Kafka metric measuring how far behind a consumer is from the latest messages; key indicator of pipeline bottleneck |
| **Serialization** | Converting in-memory data to bytes for network transmission (e.g., object → JSON); overhead cost of distributed pipelines |
| **Head-of-line Blocking** | When a single slow/failed record prevents all subsequent records from being processed |
| **Idempotency** | Processing the same record multiple times produces the same result — critical for retry safety |
