# Azure: Storage, Blob, and CDN

## Azure Blob Storage — Object Storage

```
Azure Blob Storage stores unstructured data: images, videos, documents, logs, backups.

Like AWS S3:
  Storage Account → top-level account (billing, redundancy, access)
  Container       → like an S3 bucket, groups blobs
  Blob            → the actual file

Blob types:
  Block Blob  → most common: images, documents, videos, app files (up to 190.7 TB)
  Append Blob → append-only: log files, audit trails
  Page Blob   → random read/write: Azure VM OS/data disks (VHD files)

Access tiers per blob:
  Hot     → frequently accessed, higher per-GB cost, no retrieval fee
  Cool    → infrequently accessed, lower per-GB cost, per-GB retrieval fee
  Cold    → accessed even less (stored 90+ days), lower cost
  Archive → offline, cheapest storage, retrieval takes hours, high retrieval fee
```

---

## Blob Storage — Node.js SDK Operations

```javascript
const {
  BlobServiceClient, ContainerClient,
  StorageSharedKeyCredential, generateBlobSASQueryParameters,
  BlobSASPermissions
} = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');

// Use DefaultAzureCredential in production (Managed Identity)
// No storage keys to manage or rotate
const accountUrl = `https://${process.env.STORAGE_ACCOUNT}.blob.core.windows.net`;
const blobServiceClient = new BlobServiceClient(accountUrl, new DefaultAzureCredential());

// ── Upload a file ─────────────────────────────────────────────────────────
async function uploadFile(containerName, blobName, fileBuffer, mimeType) {
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(fileBuffer, {
    blobHTTPHeaders: {
      blobContentType: mimeType,         // e.g., 'image/jpeg' — sets Content-Type header
      blobCacheControl: 'public, max-age=31536000',   // cache for 1 year (for static assets)
    },
    metadata: {
      uploadedBy: 'api-server',
      originalName: blobName,
    },
  });

  return blockBlobClient.url;            // public URL to the blob
}

// ── Download a blob ───────────────────────────────────────────────────────
async function downloadFile(containerName, blobName) {
  const blockBlobClient = blobServiceClient
    .getContainerClient(containerName)
    .getBlockBlobClient(blobName);

  const downloadResponse = await blockBlobClient.download(0);  // 0 = start from byte 0
  // Collect all chunks into a single Buffer
  const chunks = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// ── Generate a SAS (Shared Access Signature) URL ─────────────────────────
// SAS = temporary URL granting time-limited access to a private blob
// Similar to AWS S3 presigned URL
async function generateSasUrl(containerName, blobName, expiryMinutes = 60) {
  // For SAS generation, we need the storage account key
  // In production, use a User Delegation SAS (via Managed Identity — no key needed)
  const delegationKey = await blobServiceClient.getUserDelegationKey(
    new Date(),                                                // start now
    new Date(Date.now() + expiryMinutes * 60 * 1000)         // expire after N minutes
  );

  const sasToken = generateBlobSASQueryParameters({
    containerName,
    blobName,
    permissions: BlobSASPermissions.parse('r'),               // 'r' = read only
    startsOn: new Date(),
    expiresOn: new Date(Date.now() + expiryMinutes * 60 * 1000),
  }, delegationKey, process.env.STORAGE_ACCOUNT).toString();

  return `${accountUrl}/${containerName}/${blobName}?${sasToken}`;
  // Result: a URL that is valid for 60 minutes, then expires automatically
}

// ── List blobs in a container ─────────────────────────────────────────────
async function listBlobs(containerName, prefix = '') {
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobs = [];

  // listBlobsFlat returns an async iterator — loop through pages
  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    blobs.push({
      name: blob.name,
      size: blob.properties.contentLength,
      lastModified: blob.properties.lastModified,
      contentType: blob.properties.contentType,
    });
  }
  return blobs;
}

// ── Delete a blob ─────────────────────────────────────────────────────────
async function deleteBlob(containerName, blobName) {
  await blobServiceClient
    .getContainerClient(containerName)
    .deleteBlob(blobName, {
      deleteSnapshots: 'include',   // also delete any snapshots of this blob
    });
}
```

---

## Storage Account Lifecycle Management

```json
// Lifecycle policy: automatically transition or delete blobs based on age
// Apply in Azure Portal → Storage Account → Data management → Lifecycle management
{
  "rules": [
    {
      "name": "TransitionToArchive",
      "type": "Lifecycle",
      "definition": {
        "filters": {
          "blobTypes": ["blockBlob"],
          "prefixMatch": ["logs/"]    // only apply to blobs starting with "logs/"
        },
        "actions": {
          "baseBlob": {
            "tierToCool": { "daysAfterModificationGreaterThan": 30 },
            "tierToArchive": { "daysAfterModificationGreaterThan": 90 },
            "delete": { "daysAfterModificationGreaterThan": 365 }
          },
          "snapshot": {
            "delete": { "daysAfterCreationGreaterThan": 30 }
          }
        }
      }
    }
  ]
}
```

---

## Azure Blob Trigger for Functions

```javascript
// Automatically process files when uploaded to a container
// e.g., resize image when uploaded to "uploads" container

// BlobTrigger/function.json
// {
//   "bindings": [{
//     "type": "blobTrigger",
//     "direction": "in",
//     "name": "myBlob",
//     "path": "uploads/{filename}",        ← {filename} is a binding expression
//     "connection": "STORAGE_CONN_STRING"   ← app setting name with connection string
//   }]
// }

module.exports = async function (context, myBlob) {
  const filename = context.bindingData.filename;   // extracted from the path template
  context.log(`Processing uploaded file: ${filename}, size: ${myBlob.length} bytes`);

  // Process the blob (e.g., resize image, extract metadata, virus scan)
  const resized = await resizeImage(myBlob);

  // Write to output binding (another container)
  context.bindings.outputBlob = resized;   // output binding defined in function.json
};
```

---

## Azure CDN and Azure Front Door

```
Azure CDN: caches static content at edge points-of-presence (PoP) worldwide.
           Users get content from a nearby edge node, not your origin server.
           Reduces latency, reduces origin load.

Azure Front Door: global load balancer + CDN + WAF (Web Application Firewall).
           Routes requests to the fastest healthy backend based on latency.
           Includes DDoS protection and OWASP rule sets.
           More powerful than Azure CDN for dynamic content + multi-region apps.
```

```bash
# Create an Azure Front Door profile (Standard tier)
az afd profile create \
  --resource-group rg-my-app-prod \
  --profile-name afd-my-app \
  --sku Standard_AzureFrontDoor

# Create an origin group (defines backend servers)
az afd origin-group create \
  --resource-group rg-my-app-prod \
  --profile-name afd-my-app \
  --origin-group-name og-my-app \
  --probe-request-type GET \
  --probe-protocol Https \
  --probe-path /health \          # Azure Front Door probes this path to check health
  --probe-interval-in-seconds 30

# Add an origin (backend App Service or static storage)
az afd origin create \
  --resource-group rg-my-app-prod \
  --profile-name afd-my-app \
  --origin-group-name og-my-app \
  --origin-name origin-app-service \
  --host-name myapp-prod.azurewebsites.net \
  --https-port 443 \
  --http-port 80 \
  --priority 1 \                  # lower priority number = higher priority
  --weight 1000

# Create a route (connect domain to origin group)
az afd route create \
  --resource-group rg-my-app-prod \
  --profile-name afd-my-app \
  --endpoint-name ep-my-app \
  --origin-group og-my-app \
  --route-name route-all \
  --https-redirect Enabled \      # auto-redirect HTTP to HTTPS
  --forwarding-protocol HttpsOnly \
  --link-to-default-domain Enabled
```

---

## Static Website Hosting on Blob Storage

```bash
# Enable static website hosting on a storage account
# Useful for React/Angular/Vue SPA apps
az storage blob service-properties update \
  --account-name mystorageaccount \
  --static-website \
  --index-document index.html \
  --404-document index.html    # redirect 404s to index.html for SPA routing

# Upload SPA build output
az storage blob upload-batch \
  --account-name mystorageaccount \
  --source ./dist \              # local build directory
  --destination '$web' \         # special container for static website
  --pattern "**" \
  --overwrite true

# URL: https://mystorageaccount.z13.web.core.windows.net
# For a custom domain + CDN, add an Azure Front Door in front
```

---

## Interview Questions

**Q: What is an SAS token in Azure Blob Storage?**
> Shared Access Signature — a token appended to a blob URL that grants time-limited, fine-grained access (read/write/delete) to a storage resource without sharing the storage account key. User Delegation SAS is signed using Managed Identity credentials (preferred — no key required). Account SAS uses the storage key directly (avoid in production). Always set short expiry for SAS tokens.

**Q: What is the difference between Hot, Cool, and Archive tiers?**
> Hot: data accessed frequently. Higher storage cost, no retrieval fee. Good for active data.
> Cool: data accessed once a month or less. Lower storage cost, per-GB retrieval fee. Min storage duration 30 days.
> Archive: data rarely accessed. Very cheap storage, but retrieval takes hours and is expensive. Cannot read directly — must "rehydrate" to Hot/Cool first. Good for compliance archives.

**Q: When would you use Azure Front Door vs Azure CDN?**
> Azure CDN: cache static content (images, JS/CSS) at edge nodes. Simple, cost-effective.
> Azure Front Door: global load balancing between multiple regions + CDN + WAF. Routes requests to the fastest healthy backend. Handles SSL termination, DDoS protection, OWASP firewall rules. Choose Front Door for multi-region apps needing global routing and security.

**Q: How does a Blob Trigger Azure Function differ from a Timer Trigger?**
> Blob Trigger: reacts to events (new blob uploaded). Runs when something happens. Good for processing user uploads, ETL pipelines.
> Timer Trigger: runs on a fixed cron schedule regardless of events. Good for daily reports, cleanup jobs, scheduled notifications.

**Q: How do you secure a storage account from public internet access?**
> Disable public blob access (no anonymous reads). Use Private Endpoints to expose the storage account only within your VNet (no public IP). Require Azure AD authentication (Managed Identity) instead of access keys. Enable Defender for Storage for threat detection. Restrict allowed IP ranges in the storage account network firewall to known corporate IPs only.
