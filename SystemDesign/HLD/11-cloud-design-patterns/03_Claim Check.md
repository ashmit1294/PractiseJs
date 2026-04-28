# T03 — Claim Check Pattern: Large Message Handling

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/claim-check

---

## ELI5 (Explain Like I'm 5)

Imagine you go to a coat check at a restaurant. You give them your big heavy coat (the large payload), and they give you a small numbered ticket (the claim check / reference token). You carry just the ticket all evening — no bulky coat. When you leave, you hand over the ticket and get your coat back.

Messaging systems do the same: instead of stuffing a 50MB video file into a queue message, you upload it to S3 and put just a tiny ticket (reference URL) in the message. The consumer uses the ticket to retrieve the file.

---

## Analogy

**Airline baggage claim**: You check your heavy luggage at the counter (payload → S3). You get a lightweight baggage tag (claim check / reference token). You walk through the airport unencumbered. At your destination, you use the tag to retrieve your bags. The airline handles the heavy lifting through their storage/routing system — the claim ticket is all you need to carry.

---

## Core Concept

The Claim Check pattern **separates large message payloads from message metadata** by:
1. Storing the large payload in **external object storage** (S3, Azure Blob, GCS)
2. Passing only a **lightweight reference token** (storage URL or UUID) through the message broker
3. The consumer retrieves the payload from storage using the token

This prevents message size limit violations (Kafka: 1MB default, SQS: 256KB, RabbitMQ: <128KB recommended), reduces broker memory pressure, and lowers messaging costs.

### Why Not Just Increase Broker Limits?
Larger messages cause cascading problems:
- More broker memory → fewer concurrent messages the broker can handle
- Network bandwidth spikes affecting **all** messages on the same broker
- Consumers must allocate larger buffers
- LinkedIn found that allowing 10MB Kafka messages reduced overall throughput by **60%**

---

## ASCII Diagrams

### Core Claim Check Flow

```
PRODUCER                  OBJECT STORAGE          MESSAGE BROKER          CONSUMER
    │                          │                        │                      │
    │── 1. Upload payload ─────►│ (50MB video)          │                      │
    │◄── 2. Return reference ───│ (s3://bucket/v.mp4)   │                      │
    │                          │                        │                      │
    │── 3. Publish claim ───────────────────────────────►│                      │
    │      { claim_check: "s3://…", type: "video/mp4",  │                      │
    │        size: 52MB, uploaded_at: "…" }     (~500B) │                      │
    │                          │                        │                      │
    │                          │                        │── 4. Deliver ────────►│
    │                          │                        │      (500B message)   │
    │                          │◄──────────────────────────── 5. Fetch payload ─│
    │                          │──────────────────────────────► 6. Stream 50MB ─►│
    │                          │                        │                      │── 7. Process
    │                          │◄──── 8. Delete (optional, if single-use) ──────│
```

### Reference Token Formats

```
DIRECT URL (simple, exposes topology):
  s3://my-bucket/videos/2024/abc123.mp4

PRE-SIGNED URL (secure, time-limited — Netflix approach):
  https://bucket.s3.amazonaws.com/video.mp4?AWSAccessKeyId=...&Expires=1705320000&Signature=...
  (expires in 1 hour — prevents unauthorized access)

UUID + REGISTRY (max security, adds lookup step):
  claim_check: "550e8400-e29b-41d4-a716-446655440000"
  → Redis/DynamoDB lookup → returns actual S3 path

COMPOSITE KEY (structured, multi-region):
  { "storage": "s3", "region": "us-east-1", "bucket": "payloads", "key": "abc123" }
```

### Size-Based Hybrid Routing

```
Producer has message
        │
        ├── size < 256KB? ──► Direct messaging (embed payload in message) [90% of cases]
        │
        └── size ≥ 256KB? ──► Claim Check pattern (store in S3, send reference) [10% of cases]
```

### Cost Comparison (1M × 1MB messages/month)

```
DIRECT SQS MESSAGING:
  SQS requests:    $0.40
  Data transfer:  $400.00  (1TB at $0.09/GB)
  ─────────────────────
  TOTAL:          $400.40

CLAIM CHECK (SQS + S3):
  SQS requests:    $0.40  (reference tokens only)
  S3 storage:     $23.00  (1TB at $0.023/GB/month)
  S3 PUTs:         $5.00  (1M requests)
  S3 GETs:         $0.90  (1M requests)
  ─────────────────────
  TOTAL:           $29.30

  SAVINGS: 93% ($400 → $29)
  TRADE-OFF: +50-200ms latency per message (storage round-trip)
```

---

## How It Works (Step by Step)

1. **Producer uploads payload**: Write 50MB video to S3 key `videos/2024/abc123.mp4`. S3 returns the reference.
2. **Producer publishes claim check**: Small message (200-500 bytes): `{ "claim_check": "s3://…/abc123.mp4", "content_type": "video/mp4", "size_bytes": 52428800 }`. Flows through broker with normal delivery semantics.
3. **Consumer receives claim check**: Validates token format, checks metadata (content type, size) before fetching.
4. **Consumer retrieves payload**: S3 `GetObject` call. **Stream** directly into processing pipeline — don't load entire 50MB into RAM at once.
5. **Consumer cleans up**: Delete if single-use. If multiple consumers need the same payload, use S3 lifecycle policy to auto-delete after 7 days, or coordinate via consumer count tracking.

---

## Variants

| Variant | Description | Use When |
|---------|-------------|---------|
| **Inline Small Messages** | Size threshold check — small messages flow directly; large ones use claim check | 90% small, 10% large (most common) |
| **Metadata Enrichment** | Claim check includes derived metadata (page count, file hash, language) so consumers can route without fetching | Need routing decisions without full fetch |
| **Streaming** | Large payloads (10GB+ ML datasets) streamed with multipart upload; consumer starts processing before upload completes | Minimize end-to-end latency for huge files |

---

## Trade-offs

| Dimension | Claim Check | Direct Messaging |
|-----------|------------|-----------------|
| **Latency** | +50-200ms (storage round-trip) | Lower (single network hop) |
| **Throughput** | Higher (broker handles tiny refs) | Lower for large messages |
| **Cost** | 93% cheaper for large payloads | Expensive for 1MB+ messages |
| **Consistency** | Eventual (payload may not be replicated yet) | Immediate |
| **Complexity** | Higher (storage lifecycle, access control, cleanup) | Lower |
| **Use when** | Payloads >1MB, high volume | Payloads <100KB, low volume |

---

## When to Use (and When Not To)

**Use Claim Check when:**
- Message payloads regularly exceed broker limits (>256KB for SQS, >1MB for Kafka)
- You're hitting broker memory or throughput limits
- Storage costs are significantly lower than broker data transfer costs (true for >1MB payloads)
- Multiple consumers need the same payload (fan-out with S3 as shared storage)

**Avoid Claim Check when:**
- Most messages are small (<100KB) — added complexity not worth it
- You need strict transactional consistency between message delivery and payload availability
- Latency is critical (real-time trading, live video streaming)
- You can't handle "payload not found" errors gracefully (eventual consistency issue)

**Anti-patterns:**
- Using claim check as a workaround for poor message design (if messages are large because you're embedding DB records — send IDs instead)
- Forgetting to implement storage cleanup (orphaned payloads accumulate costs)
- Not encrypting sensitive data stored externally (S3 has different access control than the broker)

---

## MERN Developer Notes

```javascript
// Claim Check Producer (Node.js + AWS SDK)
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

async function publishWithClaimCheck(payloadBuffer, metadata) {
  const s3 = new S3Client({ region: 'us-east-1' });
  const sqs = new SQSClient({ region: 'us-east-1' });

  const key = `payloads/${Date.now()}-${uuid()}`;
  const THRESHOLD_BYTES = 256 * 1024; // 256KB

  if (payloadBuffer.length < THRESHOLD_BYTES) {
    // Small message → direct embedding
    await sqs.send(new SendMessageCommand({
      QueueUrl: process.env.QUEUE_URL,
      MessageBody: JSON.stringify({ ...metadata, payload: payloadBuffer.toString('base64') })
    }));
    return;
  }

  // Large payload → claim check
  await s3.send(new PutObjectCommand({
    Bucket: process.env.PAYLOAD_BUCKET,
    Key: key,
    Body: payloadBuffer,
    ServerSideEncryption: 'AES256'  // encrypt at rest
  }));

  // Generate pre-signed URL (expires in 1 hour — Netflix approach)
  const url = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: process.env.PAYLOAD_BUCKET, Key: key
  }), { expiresIn: 3600 });

  await sqs.send(new SendMessageCommand({
    QueueUrl: process.env.QUEUE_URL,
    MessageBody: JSON.stringify({ ...metadata, claim_check: url, payload_key: key })
  }));
}
```

**Key considerations:**
- Always stream large payloads (don't load into memory): use `s3.getObject().Body.pipe(processingStream)`
- Set S3 lifecycle policies to auto-delete after N days (prevent orphaned payload cost accumulation)
- Use SSE (server-side encryption) for sensitive payloads
- Monitor: storage retrieval latency (p99 <200ms), "payload not found" errors, orphaned payload count

---

## Real-World Examples

| Company | Implementation | Key Detail |
|---------|---------------|-----------|
| **LinkedIn** | Kafka + HDFS | Keep Kafka messages <1MB; payloads in HDFS. Claim check includes HDFS path + checksum. Result: 70% less Kafka memory, 200K msg/s (up from 50K). Uses 24-hour TTL — consumers must fetch within 24h. |
| **Netflix** | SQS + S3 | 10GB+ 4K video files in S3; S3 pre-signed URLs (1-hour expiry) in SQS claim checks. Encoding workers in multiple regions fetch from regional S3 replicas. |
| **Stripe** | RabbitMQ + PostgreSQL | Large webhook payloads (invoice line items, customer history) stored in PostgreSQL; claim check in RabbitMQ. Includes `payload_version` field for schema evolution. Keeps RabbitMQ messages <10KB. |

---

## Interview Cheat Sheet

### Q: Why not just increase the message broker's size limit?
**A:** Larger messages reduce broker throughput, increase memory usage, and **affect all messages** sharing the broker — not just the large ones. Claim check isolates the impact by keeping broker messages tiny.

### Q: How do you prevent orphaned payloads when consumers crash?
**A:** Three strategies: (1) S3 lifecycle policies — auto-delete after N days regardless. (2) Dead letter queue processing — consumer on DLQ cleans up payload. (3) Registry-based tracking — track payload access, alert/cleanup if unfetched after TTL.

### Q: What happens if the storage system is unavailable when consumer tries to fetch?
**A:** Consumer retry with exponential backoff. Implement circuit breaker for storage access — if S3 is degraded, pause consumption to avoid queue pile-up. Fall back to DLQ after N retries.

### Q: How do you handle schema evolution for stored payloads?
**A:** Include a `payload_version` or `schema_version` field in the claim check message. Store payloads with version-specific keys. Use self-describing formats (Avro with schema registry). Old workers can still process messages by reading the version field and using the appropriate deserializer.

### Q: Who is responsible for deleting payloads?
**A:** Depends on topology: (1) Single consumer → consumer deletes after processing. (2) Fan-out (multiple consumers same payload) → producer sets lifecycle TTL. (3) Complex fan-out → use a "reference count" tracker; last consumer deletes.

### Red Flags to Avoid
- Not discussing storage cleanup (orphaned payloads waste money — common prod issue)
- Ignoring security (storage URLs in messages can leak if broker is compromised)
- Claiming S3 is always available (99.99% = 52 minutes downtime/year; need retry logic)
- Saying "claim check is always better" without calculating cost thresholds
- Forgetting monitoring (retrieval failures, latency p99, orphaned payload count)

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Claim Check** | Reference token (storage URL or UUID) included in a message in place of the actual large payload |
| **Payload** | The actual data/content of a message — often a large file, document, or dataset |
| **Reference Token** | Lightweight identifier pointing to where a payload is stored externally |
| **Pre-signed URL** | Time-limited URL that grants temporary, secure access to an S3 object without exposing credentials |
| **Object Storage** | Cloud storage for blobs (S3, Azure Blob, GCS). Optimized for large files, not message ordering. |
| **S3 Lifecycle Policy** | Amazon S3 rule that automatically transitions or deletes objects after a configured time |
| **Orphaned Payload** | Stored payload that was never fetched by a consumer; accumulates cost over time |
| **Multipart Upload** | S3 feature for uploading large files in parallel chunks; required for files >5GB |
| **Fan-out** | Pattern where one message is delivered to multiple consumers [→ Full detail: T08 Publisher-Subscriber] |
| **Server-Side Encryption (SSE)** | Encryption of data at rest in S3, managed by AWS |
| **DLQ** (Dead Letter Queue) | Queue receiving messages that failed processing after N retries [→ Full detail: T01 Messaging Patterns Overview] |
| **Throughput** | Number of messages a system can process per unit time |
| **Idempotency** | Processing an operation multiple times produces the same result as once — critical for at-least-once delivery systems |
