# AWS: S3 and CloudFront

## S3 — Simple Storage Service

**WHAT**: How do I store files in AWS at massive scale?
**THEORY**: S3 is object storage (not filesystem). Buckets store objects with flat keys. Pay per GB stored, per request.

S3 is an object store. You store files (objects) in containers (buckets).
Unlike a filesystem (folders and files), S3 has flat keys that look like paths.

```
s3://my-bucket/images/profile/alice.jpg
       ↑           ↑
    bucket name    key (the "path" is just part of the key string)
```

---

## Core S3 Concepts

| Concept | Explanation |
|---------|-------------|
| Bucket | Container for objects — globally unique name |
| Object | A file + metadata, up to 5TB per object |
| Key | The name/path of an object within a bucket |
| Prefix | Simulated folder — all keys starting with `images/` |
| Storage Class | Trade-off between cost and retrieval speed |
| Versioning | Keep previous versions of every object |
| ACL / Bucket Policy | Control who can access the bucket or objects |

---

## S3 Storage Classes

| Class | Access Pattern | Cost |
|-------|---------------|------|
| Standard | Frequent access | Highest |
| Intelligent-Tiering | Unknown/changing | Automatic tiering |
| Standard-IA | Infrequent access | Lower storage, retrieval fee |
| One Zone-IA | Infrequent, single AZ | Cheaper, less durable |
| Glacier Instant | Archive, instant retrieval | Very cheap |
| Glacier Flexible | Archive, hours to retrieve | Cheapest active archive |
| Glacier Deep Archive | Archive, 12h retrieval | Cheapest overall |

---

## Common S3 Operations

```javascript
// AWS SDK v3 (modular — only import what you need)
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} = require('@aws-sdk/client-s3');

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Initialise the client — credentials come from IAM Role in production
// (never hard-code keys; use environment or EC2/Lambda role)
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.S3_BUCKET;

// ── Upload a file ──────────────────────────────────────────────────────────
async function uploadFile(key, buffer, contentType) {
  // PutObject: upload the entire object at once (fine for files < 100MB)
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,                        // e.g., 'uploads/users/alice/photo.jpg'
    Body: buffer,                    // Buffer, ReadableStream, or string
    ContentType: contentType,        // e.g., 'image/jpeg'
    ServerSideEncryption: 'AES256',  // encrypt at rest using AWS-managed keys
    // StorageClass: 'INTELLIGENT_TIERING',  // uncomment to use cheaper class
    Metadata: {
      uploadedBy: 'api-server',      // custom metadata (stored with object)
    },
  });

  await s3.send(command);
  // Object is now available at: https://BUCKET.s3.REGION.amazonaws.com/KEY
}

// ── Download a file ────────────────────────────────────────────────────────
async function downloadFile(key) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await s3.send(command);

  // response.Body is a ReadableStream — convert to buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// ── Generate a presigned URL (temporary access to a private object) ────────
// Presigned URL: a time-limited URL that lets a browser directly access
// or upload to S3 without going through your server.
// Use case: let users upload profile photos directly to S3 (no server proxy).
async function getPresignedDownloadUrl(key, expiresIn = 3600) {
  // The URL is valid for 'expiresIn' seconds (default 1 hour).
  // Anyone with this URL can GET the object — treat it like a temporary password.
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
}

async function getPresignedUploadUrl(key, contentType, expiresIn = 300) {
  // Client receives this URL and uploads directly using a PUT request.
  // Limits: content-type and content-length are locked to prevent abuse.
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
  });
  return getSignedUrl(s3, command, { expiresIn });
}

// ── List objects (paginated) ────────────────────────────────────────────────
async function listFiles(prefix, maxKeys = 100) {
  const results = [];
  let continuationToken;

  // S3 returns max 1000 objects per call — paginate using ContinuationToken
  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,              // only list keys starting with this prefix
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
    });

    const response = await s3.send(command);
    results.push(...response.Contents);
    continuationToken = response.NextContinuationToken;  // null when done
  } while (continuationToken);

  return results;
}

// ── Delete an object ───────────────────────────────────────────────────────
async function deleteFile(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// ── Copy an object ─────────────────────────────────────────────────────────
async function copyFile(sourceKey, destKey) {
  // Server-side copy — no data transfer through your server
  await s3.send(new CopyObjectCommand({
    Bucket: BUCKET,
    CopySource: `${BUCKET}/${sourceKey}`,   // source: bucket/key
    Key: destKey,                           // destination key
  }));
}
```

---

## Bucket Policy — control access declaratively

```json
// Bucket policy: allow only a specific IAM role to write objects.
// Block all public access — objects are never publicly accessible.
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAPIServerRole",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/api-server-role"
      },
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::my-production-bucket/*"
    },
    {
      "Sid": "DenyPublicAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-production-bucket/*",
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalArn": "arn:aws:iam::123456789012:role/api-server-role"
        }
      }
    }
  ]
}
```

---

## S3 Lifecycle Rules — auto-move objects to cheaper storage

```json
// Example: move objects older than 30 days to Standard-IA,
// then to Glacier after 90 days, then delete after 365 days.
// This dramatically reduces storage cost for log files, backups, etc.
{
  "Rules": [
    {
      "ID": "log-lifecycle",
      "Status": "Enabled",
      "Filter": { "Prefix": "logs/" },
      "Transitions": [
        { "Days": 30,  "StorageClass": "STANDARD_IA" },
        { "Days": 90,  "StorageClass": "GLACIER" }
      ],
      "Expiration": { "Days": 365 }
    }
  ]
}
```

---

## S3 Event Notifications

```javascript
// S3 can trigger Lambda when objects are created/deleted.
// Great for: image resizing, virus scanning, indexing, ETL pipelines.
// Configure in the S3 bucket Notification settings or via Terraform.

// Lambda handler: triggered on s3:ObjectCreated:* events
exports.handler = async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const size = record.s3.object.size;

    console.log(`New object: s3://${bucket}/${key} (${size} bytes)`);

    // Process the new object: resize an image, parse a CSV, scan for viruses...
    await processObject(bucket, key);
  }
};
```

---

## CloudFront — Content Delivery Network (CDN)

```
CloudFront = global CDN with 400+ edge locations.
Instead of every user hitting your S3 bucket or server directly,
CloudFront caches content at the edge location closest to the user.

Flow:
User in London → CloudFront edge (London) → cache hit? serve immediately
                                           → cache miss? fetch from S3 / origin server
```

```javascript
// CDN URL pattern:
// Instead of: https://my-bucket.s3.us-east-1.amazonaws.com/images/logo.png
// Use:         https://d1abc2xyz.cloudfront.net/images/logo.png
//              ↑ much faster for global users — served from nearest edge
```

---

## CloudFront Distribution (Terraform)

```hcl
resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  default_root_object = "index.html"   # for SPA: serve index.html at root

  # Origin: where CloudFront fetches content from
  origin {
    domain_name = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id   = "S3-assets"

    # Use Origin Access Control so S3 only accepts requests from CloudFront
    # (S3 bucket stays private — no public access)
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  # Default cache behaviour: cache everything at edge
  default_cache_behavior {
    target_origin_id       = "S3-assets"
    viewer_protocol_policy = "redirect-to-https"   # HTTP → HTTPS redirect

    allowed_methods = ["GET", "HEAD"]
    cached_methods  = ["GET", "HEAD"]

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"  # CachingOptimized

    compress = true    # automatically gzip/brotli compress responses
  }

  # Cache API calls at edge (optional — be careful with dynamic content)
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "API"
    viewer_protocol_policy = "https-only"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"  # CachingDisabled
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  # TLS certificate (from ACM — must be in us-east-1 for CloudFront)
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.cert.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # Custom error pages: show React SPA for 404/403 (S3 key not found)
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"  # SPA routing: let React handle the 404
  }

  tags = { Environment = "production" }
}
```

---

## Cache Invalidation

```bash
# When you deploy new assets, tell CloudFront to purge old cached versions
aws cloudfront create-invalidation \
  --distribution-id E1ABCDEF12345 \
  --paths "/*"              # invalidate everything

# Or just specific paths:
aws cloudfront create-invalidation \
  --distribution-id E1ABCDEF12345 \
  --paths "/index.html" "/static/js/main.chunk.js"
```

---

## Interview Questions

**Q: What is S3 and how is it different from a traditional filesystem?**
> S3 is a flat key-value object store — there are no real "folders". What looks like a path (`images/profile/alice.jpg`) is actually the entire key string. Objects are accessed via HTTP PUT/GET, not filesystem calls. S3 is infinitely scalable, globally distributed, 99.999999999% (11 nines) durable, and priced per GB stored + per request.

**Q: What is a presigned URL and when would you use it?**
> A presigned URL is a time-limited signed link that grants temporary access to a private S3 object. Use for: letting users directly upload profile photos to S3 (PUT presigned URL) or download private documents (GET presigned URL) without routing the file data through your server. This reduces backend load and transfer costs.

**Q: How do you make an S3 bucket serve a static website?**
> Enable static website hosting on the bucket, set the index document to `index.html`. Put the bucket behind CloudFront for HTTPS, a custom domain (Route 53 CNAME), and global caching. Deployments: run `aws s3 sync ./dist s3://mybucket --delete`, then invalidate the CloudFront cache.

**Q: What is CloudFront and why use it?**
> CloudFront is AWS's CDN — it caches content at 400+ global edge locations. Benefits: reduced latency (content served from nearest city), reduced origin load (cache hits don't reach S3/server), DDoS protection (AWS Shield Standard included), TLS termination at edge, Gzip/Brotli compression.

**Q: What is Origin Access Control (OAC) in CloudFront?**
> OAC ensures that your S3 bucket only accepts requests coming FROM your CloudFront distribution. The bucket remains private (no public access). CloudFront signs requests with a special identity; the S3 bucket policy only trusts that identity. This prevents users from bypassing CloudFront and accessing S3 directly.
