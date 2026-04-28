# T20 — Valet Key Pattern: Secure Direct Client Access

> **Module 11 — Cloud Design Patterns**  
> Source: https://layrs.me/course/hld/11-cloud-design-patterns/valet-key

---

## ELI5 (Explain Like I'm 5)

Imagine a hotel where every guest wants to drive their car to the garage. Instead of asking the hotel manager to drive every guest's car (the manager would be overwhelmed), the hotel gives each guest a special parking key. This valet key only opens the garage door — not the mini bar, not your room. The guest drives themselves; the manager is free to do other things.

The Valet Key pattern gives clients a temporary, limited key to access cloud storage directly — without routing data through your application server.

---

## Analogy

**A hotel valet key**: The valet key starts the car and opens the driver's door — nothing else. You give it to the valet to park your car, but they can't open the trunk or glove compartment. Similarly, a valet key token grants access to one specific file with one specific operation for a limited time. The cloud service (S3) is the garage; your app server is the hotel manager.

---

## Core Concept

The Valet Key pattern issues **time-limited, cryptographically signed tokens** that clients use to interact **directly with cloud resources** — bypassing your application servers for the actual data transfer.

**Problem it solves**: In traditional architectures, when a user uploads a 500MB file, it travels through your API server (consuming CPU, bandwidth, memory) before reaching S3. Your servers become bottlenecks and bandwidth costs scale linearly.

**Valet Key solution**: Your API server authenticates the user, generates a pre-signed URL (200 bytes), returns it. Client uploads 500MB directly to S3. Your API server never touches the data. Zero bandwidth cost on the API server. Infinite S3 scale handles the actual upload.

**Token perimeter**: Enforce 3 pillars: (1) **Least privilege** — one token, one object, one operation (PUT only). (2) **Time-bound** — expires in 15 minutes. (3) **Cryptographic integrity** — HMAC-SHA256 signature, cloud service validates without calling back to your server.

---

## ASCII Diagrams

### Traditional vs Valet Key Upload Architecture

```
TRADITIONAL (data through API server):
  Client → PUT 500MB → API Server → Forward 500MB → S3
  ❌ API Server CPU processing 500MB
  ❌ API Server bandwidth: 500MB in + 500MB out = 1GB/upload
  ❌ API server is serial bottleneck
  ❌ At 1000 concurrent uploads: 1TB of data through your API tier

VALET KEY (direct upload):
  Step 1: Client → POST /upload/request (auth + metadata) → API Server
  Step 2: API Server → generates S3 pre-signed URL (15-min expiry) → returns to Client
  Step 3: Client → PUT 500MB → directly to S3 (bypasses API server entirely)
  Step 4: Client → POST /upload/confirm (uploadId + metadata) → API Server
  Step 5: API Server → creates DB record, triggers async processing
  
  ✅ API server never touches 500MB of file data
  ✅ Zero API bandwidth cost for data transfer
  ✅ S3 handles unlimited concurrent uploads
  ✅ Instagram: 100M photos/day using this pattern
```

### Token Generation and Validation

```
Client                     API Server                     AWS S3
  │                             │                              │
  │─ Authenticate + metadata ──►│                              │
  │                             │                              │
  │                     Check authorization                    │
  │                     (user owns resource?)                  │
  │                             │                              │
  │                     HMAC-SHA256 sign with AWS credentials  │
  │                     Parameters encoded in URL:             │
  │                     • S3 bucket + object key               │
  │                     • Allowed method (PUT only)            │
  │                     • Expiry timestamp                     │
  │                     • Content-Type restriction             │
  │                     • AWS credentials via query params     │
  │                             │                              │
  │◄── Pre-signed URL (200 bytes) ──────────────────────────── │
  │                                                            │
  │─────────── PUT /object?AWSAccessKeyId=...&Expires=...&Signature=... ──►
  │                                              Validates sig ✅
  │                                              Checks expiry ✅
  │                                              Allows operation ✅
  │                                              Stores file
  │◄────────────────────────── 200 OK ─────────────────────────
  │                             │
  │─ Confirm upload complete ──►│
                         Creates DB record
                         Triggers async jobs (thumbnails, virus scan)
```

### Token Expiry for Large File Uploads — Multipart Approach

```
PROBLEM: 2GB file + 15-min token + slow connection = expired token mid-upload

SOLUTION: Multipart upload with per-chunk tokens + refresh loop

  Client                              API Server
    │                                      │
    │─ Request upload token ──────────────►│
    │◄── S3 multipart upload ID + token ───│
    │                                      │
    │─ Upload chunk 1 (5MB) ─────────►S3   │
    │─ Upload chunk 2 (5MB) ─────────►S3   │
    │  ... (80% of token lifetime used)    │
    │─ REFRESH: request new token ────────►│
    │◄── New token (15 min) ───────────────│
    │─ Upload chunk 3 (5MB) ─────────►S3   │
    │  ... (all chunks with fresh tokens)  │
    │─ Complete multipart upload ─────►S3  │
    │─ Confirm completion ────────────────►│
```

---

## How It Works (Step by Step)

1. **Client sends upload/download request**: With authentication token + file metadata (size, type, name).

2. **API server validates authorization**: Authenticate user identity. Check business rules: does this user own this resource? Sufficient quota? Active account? Rate limits?

3. **Generate valet key**: Create pre-signed URL or SAS token encoding: specific S3 key, allowed operation (PUT or GET), expiry timestamp, content-type restriction, cryptographic HMAC-SHA256 signature.

4. **Return token to client** (200 bytes, not filedata): Client receives the time-limited URL.

5. **Client uses token directly with cloud service**: PUT/GET directly to S3 using the signed URL. Cloud service validates signature + expiry independently (no callback to your API server).

6. **Token expires automatically**: After 15 minutes (or configured lifetime), token becomes invalid. No explicit revocation needed — it simply dies.

7. **Client confirms completion**: After upload succeeds, client POSTs to your API with upload confirmation. API records metadata in DB, triggers async jobs (thumbnail generation, virus scan, CDN propagation).

---

## Variants

| Variant | Cloud | Use When |
|---------|-------|---------|
| **S3 Pre-Signed URLs** | AWS | Browser uploads/downloads, mobile apps — works with any HTTP client |
| **Azure SAS Tokens** | Azure | Fine-grained multi-resource access; supports account/service/resource levels; IP restrictions |
| **GCS Signed URLs v4** | Google Cloud | Resumable uploads for large files; video content (YouTube creator uploads) |
| **AWS STS Temporary Credentials** | AWS | Multi-service access needed; client needs AWS SDK (not just HTTP); Airbnb data science teams |
| **Queue SAS / SQS Temp Credentials** | Azure/AWS | IoT devices or clients publishing directly to queues (Uber driver location updates) |
| **CloudFront Signed Cookies** | AWS | Grant 1-hour access to ALL feed photos with one cookie (Instagram approach) — avoids per-image token generation |

---

## Trade-offs

| Dimension | Valet Key (Direct) | Traditional (Proxied) |
|-----------|-------------------|----------------------|
| **Bandwidth cost** | Zero for data transfer | Scales with data volume |
| **Server load** | Auth + token gen only | Full data processing |
| **Scalability** | Infinite (cloud service scales) | Bottlenecked by server count |
| **Control over data in-flight** | None (can't modify bytes) | Full (transform, scan, redact) |
| **Audit logging** | Two-layer: app logs + cloud service logs | Single app layer |
| **Compliance** | Complex (data bypasses your servers) | Simpler (all data flows through audit point) |
| **Token revocation** | Difficult (stateless tokens) | Immediate (just reject requests) |

**Cost example**: 10TB/month uploads through API servers: ~$1,400/month. Same with Valet Key: ~$150/month ($100 token generation + $50 minimal server compute). Saves $1,250/month = $15,000/year.

---

## When to Use (and When Not To)

**Use when:**
- Large file uploads/downloads (>10MB) — bottleneck and bandwidth cost reduction is realized
- High-throughput file operations (photos, videos, documents) at scale
- Clients can handle token expiry and refresh logic
- Cloud service logs are sufficient for audit (S3 access logs, CloudTrail)

**Avoid when:**
- Data must be transformed in transit (real-time image resize, video transcoding)
- Real-time content scanning required before storage (virus check, content moderation must block before storage)
- Compliance requires all bytes through audited systems
- Files are tiny (<100KB) — token generation HTTP round trip adds more overhead than it saves
- Clients are unreliable and can't properly handle token expiry or confirm completion

---

## MERN Developer Notes

```javascript
// AWS S3 pre-signed URL generation (Node.js + AWS SDK v3)
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const s3 = new S3Client({ region: 'us-east-1' });
const BUCKET = 'my-app-uploads';

// Rate limiting on token generation endpoint
const tokenRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 tokens per user per hour
  keyGenerator: (req) => req.user.id
});

// Generate upload token (valet key)
async function generateUploadToken(req, res) {
  const { userId } = req.user; // from auth middleware
  const { fileName, fileType, fileSize } = req.body;
  
  // 1. Validate business rules (BEFORE generating token)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (fileSize > 500 * 1024 * 1024) return res.status(400).json({ error: 'File too large (max 500MB)' });
  if (!['image/jpeg', 'image/png', 'video/mp4'].includes(fileType)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  
  // 2. Create unique, scoped S3 key (user ID + UUID prevents collisions)
  const objectKey = `users/${userId}/uploads/${uuidv4()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  
  // 3. Generate pre-signed URL with least-privilege constraints
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
    ContentType: fileType,        // restrict to specific content type
    ContentLength: fileSize,       // prevent oversized uploads
  });
  
  // 4. Sign URL — 15 minutes for reasonable user experience
  const signedUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 900 seconds
  
  // 5. Record token generation in DB for audit trail
  await db.query(
    'INSERT INTO upload_tokens (user_id, object_key, expires_at, file_type) VALUES ($1, $2, NOW() + INTERVAL \'15 minutes\', $3)',
    [userId, objectKey, fileType]
  );
  
  return res.json({
    uploadUrl: signedUrl,
    objectKey,
    expiresAt: new Date(Date.now() + 900 * 1000).toISOString()
  });
}

// Generate download token
async function generateDownloadToken(req, res) {
  const { userId } = req.user;
  const { objectKey } = req.params;
  
  // Authorize: does this user own this object?
  const fileRecord = await db.query(
    'SELECT * FROM files WHERE object_key = $1 AND owner_user_id = $2',
    [objectKey, userId]
  );
  if (!fileRecord.rows.length) return res.status(403).json({ error: 'Access denied' });
  
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: objectKey });
  const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour download
  
  return res.json({ downloadUrl: signedUrl });
}

// Confirm upload completed
async function confirmUpload(req, res) {
  const { userId } = req.user;
  const { objectKey, uploadId } = req.body;
  
  // Verify upload actually succeeded in S3
  const headResult = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: objectKey }));
  if (!headResult) return res.status(400).json({ error: 'Upload not found in S3' });
  
  // Create permanent DB record
  await db.query(
    'INSERT INTO files (user_id, object_key, size_bytes, content_type, created_at) VALUES ($1, $2, $3, $4, NOW())',
    [userId, objectKey, headResult.ContentLength, headResult.ContentType]
  );
  
  // Trigger async jobs (thumbnails, virus scan, etc.)
  await sqs.send(new SendMessageCommand({
    QueueUrl: THUMBNAIL_QUEUE_URL,
    MessageBody: JSON.stringify({ objectKey, userId })
  }));
  
  return res.json({ success: true, objectKey });
}

// Express routes
app.post('/api/uploads/token', tokenRateLimit, authenticate, generateUploadToken);
app.get('/api/files/:objectKey/download-url', authenticate, generateDownloadToken);
app.post('/api/uploads/confirm', authenticate, confirmUpload);
```

---

## Real-World Examples

| Company | Implementation | Key Detail |
|---------|---------------|-----------|
| **Netflix** | Partner video uploads to S3 | Pre-signed URL per chunk (5GB HDR masters). Each chunk has 4-hour token. Chunks generated on-demand when client is ready to upload each one. Saved **~$2M/year** by eliminating data transit through API servers. |
| **Dropbox** | File sync direct to block storage (S3 + GCS) | Two-phase commit: client uploads file → API confirms sync + runs integrity check before file visible to user. For deduplication: API checks content hash first; if duplicate block exists, skips upload entirely. Handles **1 billion file operations/day**. |
| **Instagram** | Photo uploads: S3 pre-signed URL per photo. Downloads: CloudFront signed cookies | **Signed cookies** grant 1-hour access to ALL feed photos for a user — reduces token generation from millions/sec to thousands/sec. API server load reduced **40%**; feed load time improved **200ms**. |
| **Uber** | Driver location updates to SQS via temporary queue credentials | Driver apps publish GPS coordinates directly to SQS queues using temporary credentials. Backend services consume from queues for real-time positioning + ETA. Eliminates location update bottleneck through API servers. |

---

## Interview Cheat Sheet

### Q: Why generate the token server-side rather than embedding S3 credentials in the client app?
**A:** Signing credentials (AWS secret key, Azure storage account key) must NEVER be distributed to clients. If embedded in a mobile app or web frontend, any user can extract them and issue unlimited tokens with any permissions. Token generation must happen server-side where credentials are secured, and authorization can be enforced before issuing each token. The only exception: clients with AWS STS temporary credentials — but even those must be issued server-side initially.

### Q: How do you handle token expiry for a 2GB file upload on a slow connection?
**A:** Use S3 multipart upload with per-chunk tokens. Break file into 5MB chunks. Each chunk gets its own pre-signed URL. Client monitors token expiration time and requests a new token when 80% of TTL has elapsed. The multipart upload session persists in S3; chunks uploaded with expired tokens can be resumed with new tokens. Set token TTL based on 95th percentile upload speed, not average (to handle slow connections). For a 2GB file at 95th percentile 2Mbps upload speed: ~90-minute token.

### Q: How do you handle authorization — the cloud service doesn't know your business rules?
**A:** Authorization happens in YOUR application BEFORE you generate the token. The cloud service only validates the cryptographic signature and expiration — it enforces "is this token valid?" not "should this user have access to this resource?" You implement business logic: does this user own this file? Is their quota sufficient? Is their account active? Only after all checks pass do you generate and return the token. The cloud service then acts as the gatekeeper for the token itself.

### Q: How do you revoke a valet key token in an emergency?
**A:** Valet keys are stateless — no built-in revocation. Two mitigations: (1) Keep token lifetime short (15 min) as primary defense — even compromised tokens expire quickly. (2) For emergencies (account compromised, lost device): maintain a small, time-limited revocation list in Redis/DB storing token IDs issued in the last [TTL period]. On the rare case where early revocation is needed, add the token ID to the list. The list stays small (only tokens issued in the last hour) and fast to check. Pair with forcing re-authentication on the account.

---

## Red Flags to Avoid

- "Tokens are less secure than permanent credentials because they're temporary" — backwards. Temporary = auto-expiry = limited blast radius = more secure
- Generating tokens with bucket-level or wildcard permissions instead of scoped to specific object + operation
- Suggesting long token lifetimes (days) without discussing security implications
- "I'd just embed AWS credentials in the client app" — massive security vulnerability
- Saying you can't revoke tokens + concluding pattern is unsuitable for sensitive data — short TTL IS the security mechanism; revocation list is emergency override

---

## Keywords / Glossary

| Term | Definition |
|------|-----------|
| **Valet Key Pattern** | Issue time-limited, scoped tokens for direct client-to-cloud-resource access; bypass app server for data |
| **Pre-Signed URL** | S3/GCS URL with auth embedded in query params; time-limited; works with any HTTP client |
| **SAS Token** | Azure Shared Access Signature; grants scoped access to blob storage, queues, tables |
| **HMAC-SHA256** | Cryptographic algorithm used to sign tokens; cloud service verifies signature without calling your server |
| **Least Privilege** | Token grants minimum permissions for specific operation (PUT one file, not entire bucket) |
| **Time-Bound Credentials** | Tokens automatically expire after configured lifetime (minutes to hours) |
| **Multipart Upload** | S3 feature: upload large file in chunks; each chunk can have separate token; supports pause + resume |
| **Origin Access Identity (OAI)** | CloudFront credential allowing it to read private S3; prevents direct bucket access |
| **Signed Cookie** | CloudFront variant: one cookie grants access to multiple objects for a time window |
| **STS (Security Token Service)** | AWS service issuing short-lived credentials (access key + secret + session token) |
| **Two-Phase Commit** | Upload data → confirm completion; prevents partial uploads appearing in user's file system |
| **Crypto-Shredding** | Encrypt data with per-user key, delete key on GDPR deletion; data unreachable without key |
| **Rate Limiting on Token Generation** | Prevent attackers from generating thousands of tokens; typically 100/user/hour |
| **Presigned URL Sanitization** | Remove query params (containing credentials) from logs; log only resource path |
| **Control Plane vs Data Plane** | App server = control plane (auth, tokens, metadata); cloud service = data plane (bytes) |
