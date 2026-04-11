# Pattern 03 — Video Streaming (like YouTube / Netflix)

---

## ELI5 — What Is This?

> Instead of downloading the whole movie first (which takes ages), the server sends it in tiny
> pieces — chunk 1, chunk 2, chunk 3 — while you watch chunk 1, chunk 2 is already on its way.
> If your internet slows down, it automatically sends smaller, blurrier pieces so it never stops.
> That is video streaming — just-in-time delivery of bite-sized video chunks.

---

## Glossary

| Word | ELI5 Meaning |
|---|---|
| **Transcoding** | Converting one video format into many others at different sizes. Like printing the same document in large print, normal print, and tiny print so everyone can read it. |
| **HLS (HTTP Live Streaming)** | Apple's system for cutting video into small chunks and making a playlist file (.m3u8) that tells the player where each chunk is. Like a table of contents for video pieces. |
| **Segment** | One small piece of video — usually 4-6 seconds long. |
| **Adaptive Bitrate (ABR)** | The player automatically picks the quality level (1080p, 720p, 360p) that matches your internet speed. Like a tap that adjusts flow based on water pressure. |
| **CDN (Content Delivery Network)** | A network of servers placed near users worldwide. Video chunks are stored there so you download from 20km away instead of 5000km. |
| **FFmpeg** | The most popular open-source program for converting and processing video. Like a Swiss Army knife for video files. |
| **Kafka** | A conveyor belt that moves messages between services reliably without losing any. |
| **Manifest file (.m3u8)** | A text file that is like a menu listing every chunk of a video and its quality options. The player reads this first. |
| **Origin storage** | The master copy of all video chunks, typically S3. CDN edge nodes copy from here. |
| **GPU worker** | A server with a Graphics Processing Unit — GPUs can transcode video many times faster than regular CPUs because they are built for parallel math. |

---

## Component Diagram

```mermaid
graph TB
    subgraph UPLOAD["Upload Pipeline — runs when creator uploads a video"]
        CREATOR["Content Creator"]
        RAW["Raw Video — stored in S3 immediately on upload"]
        KAFKA_UP["Kafka — upload event triggers transcoding pipeline"]
        WORKERS["GPU Transcoding Workers — convert to 360p 480p 720p 1080p in parallel"]
        MANIFEST["Manifest Generator — creates .m3u8 playlist files"]
    end

    subgraph STORAGE["Storage Layer"]
        S3["S3 Origin — master copy of all video chunks at all qualities"]
        CDN["CDN Edge Nodes worldwide — cache chunks close to viewers"]
        META_DB["Cassandra — video metadata: title, duration, tags, status"]
        SEARCH_DB["Elasticsearch — enables search by title and tags"]
    end

    subgraph STREAMING["Streaming Layer — runs when viewer watches"]
        PLAYER["Video Player — HLS.js or native browser player"]
        ABR["ABR Algorithm — inside the player, picks quality based on speed"]
    end

    subgraph API["API Services"]
        LB["Load Balancer"]
        VIDEO_SVC["Video Service — metadata lookups and recommendations"]
        ANALYTICS["Analytics Service — view count, watch time, buffering events"]
    end

    CREATOR --> RAW --> KAFKA_UP --> WORKERS --> MANIFEST --> S3 --> CDN
    PLAYER --> ABR --> CDN
    PLAYER --> LB --> VIDEO_SVC --> META_DB
    PLAYER --> ANALYTICS
```

---

## Upload and Transcoding Flow

```mermaid
sequenceDiagram
    actor Creator
    participant S3 as S3 Raw Storage
    participant Kafka as Kafka
    participant Worker as GPU Transcoding Worker
    participant Manifest as Manifest Generator
    participant CDN as CDN Origin

    Creator->>S3: upload raw 4K video file
    S3-->>Creator: upload complete
    S3->>Kafka: publish upload event with videoId and S3 path
    Kafka->>Worker: hand off job to transcoding worker
    Note over Worker: Split video into 4-second segments then transcode each quality in parallel
    Worker->>Worker: produce 360p segments
    Worker->>Worker: produce 720p segments
    Worker->>Worker: produce 1080p segments
    Worker->>Manifest: all qualities done, create playlist files
    Manifest->>CDN: push .m3u8 manifest and all segments
    CDN-->>Creator: video status updated to READY
```

---

## Adaptive Bitrate Playback Flow

```mermaid
sequenceDiagram
    participant Player as Video Player
    participant CDN as CDN Edge
    participant ABR as ABR Algorithm inside Player

    Player->>CDN: GET /video/abc/master.m3u8  — the main menu file
    CDN-->>Player: list of quality URLs: 360p, 720p, 1080p

    Player->>ABR: start session, estimate bandwidth
    ABR-->>Player: start at 480p

    Player->>CDN: GET /video/abc/480p/segment_001.ts
    CDN-->>Player: chunk delivered in 80ms — fast!

    ABR->>ABR: bandwidth = 15Mbps, upgrade!
    Player->>CDN: GET /video/abc/1080p/segment_002.ts
    CDN-->>Player: chunk delivered

    Note over ABR: internet suddenly drops to 0.5Mbps
    ABR->>ABR: buffer falling, downgrade immediately!
    Player->>CDN: GET /video/abc/360p/segment_003.ts
    CDN-->>Player: tiny chunk, delivered fast, playback never stops
```

---

## Bottlenecks — Every Point Explained

| # | Bottleneck | Why It Hurts | Fix |
|---|---|---|---|
| 1 | **Transcoding is slow** | A 1-hour 4K video can take 2+ hours to fully transcode on one machine. Creator waiting 2 hours before video is live is unacceptable. | Split video into 4-second segments first, then transcode all segments in parallel across 100 GPU workers. Total time drops to minutes. |
| 2 | **CDN cold start for new videos** | The first viewer of a just-uploaded video causes CDN edge nodes to fetch chunks from S3. This fetch is slow — 200-500ms vs 5ms when cached. | The system pre-warms popular or scheduled videos to edge nodes before they go public. |
| 3 | **Manifest file storm** | 10 million people start watching the same video at the same time (viral event). Every player requests the small .m3u8 manifest file first. 10M manifest requests hit the server. | Cache the manifest at the CDN edge with a TTL equal to the segment length (4 seconds). 10M requests → CDN handles them all. |
| 4 | **Storage cost (5 quality tiers)** | Storing 5 quality versions of every video costs 5x more than storing one. At YouTube's scale this is enormous. | Move videos watched less than once a month to cold storage (S3 Glacier — very cheap, slow to access). Keep only 720p of cold videos. |
| 5 | **View counter write storm** | A viral video gets 1 million views per minute. Writing 1M rows per minute to a database would crush it. | Buffer view counts in Redis (fast, in memory). Every 30 seconds, flush the accumulated count to the database in one write. |
| 6 | **Recommendation compute** | Personalised recommendations require ML models. Running ML in real-time per request would be too slow. | Pre-compute recommendations offline using Spark (batch processing). Store results in Redis. Serve instantly at request time. |

---

## What Happens When Each Part Fails?

```mermaid
flowchart TD
    F1["GPU Transcoding Worker Crashes Mid-Job"]
    F2["CDN Edge Node Goes Down"]
    F3["S3 Origin is Unreachable"]
    F4["Metadata Database Overloaded"]
    F5["Player Cannot Fetch the Next Segment"]

    F1 --> R1["The job was published to Kafka and not yet marked complete.
    Kafka retains the message.
    A new worker picks it up and restarts from the last completed segment.
    Transcoding is idempotent — re-processing a segment produces the same output.
    The video might be delayed by a few minutes but no data is lost."]

    F2 --> R2["DNS Anycast routing detects the edge node is down.
    Traffic automatically reroutes to the nearest healthy edge node.
    Viewers experience an extra 50-100ms of latency for that session.
    No buffering unless all nearby edge nodes are also down.
    ELI5 Anycast: like a postal system that always routes your letter to the nearest available post office."]

    F3 --> R3["CDN edge nodes already have segments cached from previous viewers.
    Ongoing streams of popular videos continue uninterrupted from edge cache.
    New viewers trying to start a video get an error — cannot fetch uncached segments.
    Fix: S3 is replicated across 3 availability zones. If one zone fails,
    S3 automatically serves from another zone with no action needed."]

    F4 --> R4["Redis cache absorbs most metadata reads — 95% of requests never touch the DB.
    The 5% that miss cache fall through to the DB.
    If the DB is over capacity, add read replicas — copies of the DB that handle reads only.
    Circuit breaker opens after N failures — serves stale cached metadata rather than crashing."]

    F5 --> R5["ABR algorithm detects the failed segment fetch.
    It drops to a lower quality and retries.
    Typical player retry logic: wait 1 second, try same segment at lower quality.
    If all quality levels fail for 10 seconds: player pauses and shows spinner.
    If failure persists: player shows error and stops.
    This never corrupts data — video file on S3 is untouched."]
```

---

## Key Numbers

| Metric | Value |
|---|---|
| Segment size | 4-6 seconds |
| Quality tiers | 360p, 480p, 720p, 1080p, 4K |
| CDN cache hit target | 98%+ |
| Startup latency target | Under 200ms |
| Storage per hour of video (5 qualities) | ~15 GB |
| Transcoding speedup with 100 parallel workers | ~100x faster than single worker |
