# Pattern 11 — File Storage System (like S3 / Dropbox)

---

## ELI5 — What Is This?

> Imagine a library that never loses books, even if one shelf collapses.
> You can store any file — photo, video, PDF, code —
> and retrieve it instantly, from anywhere in the world.
> The file is secretly split into chunks and stored in multiple physical locations,
> so losing any single location means nothing.
> That is a distributed file storage system.

---

## Glossary

| Word | ELI5 Meaning |
|---|---|
| **Blob Storage** | Binary Large Object storage. A system specifically designed to hold raw file bytes cheaply. Does not understand what is inside the file (unlike a database). Amazon S3 is blob storage. |
| **Metadata** | Data about data. For a file: its name, size, owner, creation time, which chunks it consists of, and where those chunks live. Stored in a fast database — NOT alongside the file bytes. |
| **Chunking** | Splitting a file into equal-sized pieces (e.g. 4 MB each). Each chunk is uploaded and tracked independently. Enables resumable uploads and parallel transfers. |
| **Presigned URL** | A temporary URL that lets a browser upload or download directly to blob storage (like S3) without routing through your application servers. The URL contains a cryptographic signature and expires after a short time. |
| **Multipart Upload** | Uploading a large file as multiple smaller parts simultaneously. Like sending a document as 5 faxes in parallel — all arrive at the same time, then are reassembled. |
| **Deduplication** | Detecting that two users uploaded the exact same file and storing it only once. Saves massive amounts of storage. |
| **Content Hash** | A fingerprint of a file's content (using SHA-256). If two files have the same hash, they have identical content. This is how deduplication works. |
| **Replication Factor** | How many copies of a file exist in different physical locations. AWS S3 uses replication factor 3 (or more). If one data center burns down, two others still have your file. |
| **CDN (Content Delivery Network)** | A network of servers spread around the world. When you download a file, you get it from the nearest CDN server, not from the main storage in a far-away data center. |
| **Erasure Coding** | Instead of storing 3 full copies, split the file into N pieces and add M parity pieces. You can reconstruct the file from any N pieces. Uses 1.5x storage instead of 3x. |
| **Object Key** | The unique name of a file in blob storage. Like a file path: `users/U1/photos/cat.jpg`. |
| **Garbage Collection** | A background process that finds file chunks no longer referenced by any metadata record and deletes them from blob storage to free space. |

---

## Component Diagram

```mermaid
graph TB
    subgraph CLIENT["Client Applications"]
        WEB["Web Browser"]
        MOB["Mobile App"]
        CLI["CLI / SDK"]
    end

    subgraph API["API Layer"]
        LB["Load Balancer"]
        FILE_API["File API — auth, file operations, presigned URL generation"]
        META_DB["PostgreSQL — files table and chunks table"]
    end

    subgraph UPLOAD["Upload Path"]
        S3["Blob Storage — AWS S3 compatible — raw file bytes only"]
        UP_WORKER["Upload Processor — validates chunks, assembles manifest, deduplicates"]
    end

    subgraph DOWNLOAD["Download and Delivery"]
        CDN["CloudFront CDN — caches hot files at edge globally"]
    end

    subgraph STORAGE_OPS["Background Operations"]
        DEDUP["Deduplication Service — compares SHA-256 hashes before storing new chunks"]
        GC["Garbage Collector — removes orphaned chunks with no metadata reference"]
        REPLICATE["Replication Monitor — ensures each chunk has 3 copies across AZs"]
    end

    subgraph SEARCH["File Search"]
        ELASTIC["Elasticsearch — indexes file names, tags, owners for search"]
    end

    WEB & MOB & CLI --> LB --> FILE_API
    FILE_API --> META_DB
    FILE_API --> S3
    FILE_API --> CDN
    UP_WORKER --> DEDUP --> S3
    UP_WORKER --> META_DB
    GC --> S3 & META_DB
    REPLICATE --> S3
    FILE_API --> ELASTIC
```

---

## Upload Flow — Large File (Multipart)

```mermaid
sequenceDiagram
    participant C as Client
    participant API as File API
    participant META as Metadata DB
    participant S3 as Blob Storage
    participant WORKER as Upload Processor

    C->>API: POST /files/initiate  filename=video.mp4  size=500MB  hash=SHA256
    API->>META: INSERT file row  status=PENDING  ownerId=U1  fileId=F100
    API-->>C: fileId=F100, presigned URLs for 125 chunks (4MB each)

    Note over C: Client splits video.mp4 into 125 chunks
    C->>S3: PUT /tmp/F100/chunk-001  4MB bytes (direct to S3, bypasses app server)
    C->>S3: PUT /tmp/F100/chunk-002  4MB bytes
    Note over C: All 125 chunks upload in parallel

    C->>API: POST /files/F100/complete  checksums=[chk1,chk2...chk125]
    API->>WORKER: trigger assembly job for F100
    WORKER->>S3: verify all 125 chunk objects exist and checksums match
    WORKER->>WORKER: compute overall SHA-256 hash
    WORKER->>META: check — does a file with this hash already exist?
    Note over WORKER: Deduplication check
    META-->>WORKER: No existing file with this hash

    WORKER->>S3: server-side copy chunks to permanent path files/U1/F100/
    WORKER->>META: UPDATE file row  status=READY  storageKey=files/U1/F100/  size=495MB
    WORKER->>S3: delete tmp/F100/ chunks
    API-->>C: Upload complete  downloadUrl=cdn.example.com/files/F100
```

---

## Download Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as File API
    participant META as Metadata DB
    participant CDN as CloudFront CDN
    participant S3 as Blob Storage

    C->>API: GET /files/F100/download  authToken
    API->>API: Verify user has read permission for F100
    API->>META: fetch file record for F100
    META-->>API: storageKey, size, mimeType
    API->>API: Generate presigned CDN URL  expires in 1 hour
    API-->>C: redirect to cdn.example.com/files/F100?token=xyz

    C->>CDN: GET /files/F100?token=xyz
    CDN->>CDN: Check local cache — file NOT cached at this edge
    CDN->>S3: Fetch file from origin
    S3-->>CDN: 495MB file stream
    CDN-->>C: stream bytes to browser
    Note over CDN: CDN caches file at edge for next request
```

---

## Bottlenecks — Every Point Explained

| # | Bottleneck | Why It Hurts | Fix |
|---|---|---|---|
| 1 | **Large file upload through application server** | A 500 MB video routed through your API server wastes compute, saturates network interfaces, and delays other users. 10 simultaneous uploads would consume 5 GB of bandwidth at the API layer. | Presigned URLs: API issues a temporary signed URL, client uploads directly to S3. App server only processes the small metadata request. |
| 2 | **Metadata database fanout on directory listing** | User opens a folder with 50,000 files. `SELECT * FROM files WHERE parent_id = 'folder'` returns 50,000 rows. Slow and expensive. | Pagination: return 100 results at a time with cursor-based navigation. Index on `(owner_id, parent_folder_id, created_at)` to make queries fast. |
| 3 | **Storage cost of multiple large file copies** | Replication factor 3 means storing a 1 PB dataset costs 3 PB of raw storage. 3x cost multiplier. | Erasure coding: store `k` data shards + `m` parity shards. Common config: 4+2 (store 6 shards, any 4 can reconstruct the original). Uses 1.5x storage instead of 3x. Accept slightly higher reconstruction latency. |
| 4 | **Cold CDN on first access** | A file never downloaded before has zero CDN cache. First 10 users worldwide all get served from S3 origin. High latency globally. | Pre-warm CDN for popular content. When a file goes viral (download spike detected), proactively push to CDN edge nodes in all regions. |
| 5 | **Content hash computation on large files** | SHA-256 of a 10 GB file takes 2-3 seconds on a modern CPU. This blocks the upload completion endpoint. | Compute hash client-side before upload begins. Client sends the hash in the initiate request. Server verifies by spot-checking chunk checksums rather than recomputing the entire hash. |

---

## What Happens When Each Part Fails?

```mermaid
flowchart TD
    F1["Upload Interrupted Mid-Chunks — Network Drop at Chunk 60 of 125"]
    F2["S3 Storage Node Fails — One AZ Goes Down"]
    F3["Metadata DB Crashes — File Records Inaccessible"]
    F4["CDN Edge Node Unreachable — Downloads Fail in One Region"]
    F5["Deduplication Service Falls Behind — Duplicate Files Store"]

    F1 --> R1["This is the most common failure scenario.
    Multipart uploads are designed for exactly this.
    Client stores chunk upload progress locally (localStorage or app state).
    On resume, client calls GET /files/F100/chunks to see which chunks already exist.
    S3 returns the list of successfully uploaded chunk ETags.
    Client only re-uploads the missing chunks (60 through 125 in this example).
    No bytes are wasted. The file is never 'partially stored' — the assembly
    step only runs after ALL chunks are confirmed present."]

    F2 --> R2["AWS S3 automatically replicates data across multiple Availability Zones.
    An Availability Zone is one physical data center within a region.
    If one AZ goes down, S3 reroutes all read and write requests to the surviving AZs.
    This happens transparently — clients receive data without any change in behavior.
    S3 SLA guarantees 99.99% availability because of this multi-AZ replication.
    For extra durability, enable Cross-Region Replication to a second AWS region.
    Even if the entire us-east-1 region goes down, eu-west-1 has a full copy."]

    F3 --> R3["Metadata DB holds file ownership records, permissions, and storage keys.
    Without it, you cannot look up where a file is stored.
    Recovery strategy: Run MySQL with Multi-AZ RDS (automated failover).
    Standby replica in a second AZ gets promoted to primary within 60 seconds.
    Connections are automatically rerouted to the new primary via DNS.
    During the 60-second failover window: read requests can be served by a replica
    if the application uses read replicas for non-critical reads.
    Write requests fail — uploads queue at the API and retry with backoff.
    The actual file bytes in S3 are completely unaffected — just inaccessible."]

    F4 --> R4["CloudFront has hundreds of edge locations globally.
    If one edge location becomes unreachable (hardware failure, network issue):
    CloudFront's DNS-based routing automatically directs users to the next nearest edge.
    Users in a city affected by the outage may see slightly higher latency (50-100ms more)
    as they are served from a more distant edge.
    This failover is automatic and transparent — no manual action needed.
    For catastrophic region failure: CloudFront can failover to secondary origin
    if the primary S3 bucket is inaccessible, using Origin Failover configuration."]

    F5 --> R5["Deduplication is an optional optimisation — NOT a correctness requirement.
    If the dedup service is down or behind, files are stored WITHOUT deduplication.
    The upload succeeds, metadata is written, the file is accessible.
    Users experience no degradation.
    Effect: some disk space is wasted storing duplicate copies.
    Recovery: deduplication service runs a catchup job when it recovers.
    It scans files created during its downtime, identifies duplicates by hash,
    replaces duplicate chunks with references to the original, then deletes the extra copies.
    All metadata pointers are updated atomically before deletion."]
```

---

## Key Numbers

| Metric | Value |
|---|---|
| S3 object durability | 99.999999999% (11 nines) |
| S3 availability SLA | 99.99% |
| Max single PUT upload | 5 GB |
| Recommended multipart chunk size | 4 MB to 100 MB |
| Presigned URL expiry (upload) | 15 minutes to 1 hour |
| Presigned URL expiry (download) | 1 hour (configurable) |
| CDN cache-hit ratio target | 95%+ |
| Erasure coding storage overhead | 1.5x (vs 3x for replication) |
