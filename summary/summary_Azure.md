# Azure Cloud Services — Interview Revision Summary

> **Target:** 7+ year Full Stack MERN Developer | **Files:** 8

## Table of Contents

1. [01_core_services_aad.md — What is Azure?](#azure-core-services-aad)
2. [02_app_service_functions.md — Azure App Service — Managed Web Hosting](#azure-app-service-functions)
3. [03_storage_cdn.md — Azure Blob Storage — Object Storage](#azure-storage-cdn)
4. [04_databases.md — Azure Database for PostgreSQL — Flexible Server](#azure-databases)
5. [05_networking.md — Virtual Network (VNet)](#azure-networking)
6. [06_aks_acr.md — Azure Container Registry (ACR)](#azure-aks-acr)
7. [07_pipelines_devops.md — Why Azure Pipelines?](#azure-pipelines-devops)
8. [08_interview_qa.md — Azure Fundamentals](#azure-interview-qa)
   - [Scenario-Based Questions](#azure-scenarios)

---

<a id="azure-core-services-aad"></a>
## 01_core_services_aad.md — What is Azure?

# Azure: Core Services and Azure Active Directory (Entra ID)

## What is Azure?

```
Microsoft Azure is a cloud computing platform with 200+ services.
Used for: hosting applications, storing data, running AI workloads,
          CI/CD, identity management, and infrastructure automation.

Key concepts:
  Subscription  → billing and access control boundary (like an AWS Account)
  Resource Group → logical container for related Azure resources
                   e.g., all resources for "my-app-prod" in one group
                   Deleting the group deletes all resources in it
  Region         → geographic location (East US, West Europe, Southeast Asia)
  Availability Zone → separate physical datacenters within a region
                      Use AZs for high availability (zone-redundant resources)
```

---

## Resource Group — Organization Unit

```bash
# Create a resource group (all resources go here)
az group create \
  --name rg-my-app-prod \
  --location eastus
# Convention: rg-<app>-<env>  (rg = resource group)

# List all resource groups
az group list --output table

# Delete a resource group AND all resources inside it (DESTRUCTIVE — ask before running in prod)
az group delete --name rg-my-app-prod --yes --no-wait
```

---

## Azure Active Directory (Microsoft Entra ID)

```
Azure AD (now called Microsoft Entra ID) is Azure's identity and access management service.

Key concepts:
  Tenant     → a dedicated Azure AD instance for your organization
               Each Azure subscription belongs to one tenant.
  User       → a person who can sign in (corporate account or external guest)
  Service Principal → a non-human identity for applications/services
                       Like an IAM User in AWS, but for apps
  Managed Identity   → Azure-managed service principal that auto-rotates credentials
                       Like AWS IAM Role for EC2/Lambda — NO secrets to manage
  App Registration   → registers an app to use Azure AD for authentication (OAuth 2.0/OIDC)
```

---

## Managed Identity — Credential-Free Auth

```javascript
// Without Managed Identity — BAD: hardcoded secret that expires and leaks
const { BlobServiceClient } = require('@azure/storage-blob');
const client = new BlobServiceClient(
  `https://myaccount.blob.core.windows.net`,
  // BAD: storing shared access key in code
  new StorageSharedKeyCredential('account', process.env.STORAGE_KEY)
);

// With Managed Identity — GOOD: no secrets, auto-rotated credentials
const { DefaultAzureCredential } = require('@azure/identity');
// DefaultAzureCredential automatically uses:
//   1. Managed Identity (when running on Azure: VM, App Service, Functions, AKS pod)
//   2. VS Code credentials (local development)
//   3. Azure CLI credentials (local dev fallback)
//   4. Environment variables (AZURE_CLIENT_ID, etc.) — CI/CD pipelines
const credential = new DefaultAzureCredential();
const storageClient = new BlobServiceClient(
  `https://myaccount.blob.core.windows.net`,
  credential   // Azure fetches a short-lived token automatically
);
```

---

## Role-Based Access Control (RBAC)

```
Azure RBAC controls who can do what on which resource.

  Principal → WHO:  User, Group, Service Principal, Managed Identity
  Role      → WHAT: collection of allowed actions
  Scope     → WHERE: Management Group, Subscription, Resource Group, or Resource

Built-in roles:
  Owner               → full control including assigning roles
  Contributor         → create/manage resources but can't assign roles
  Reader              → read-only
  Storage Blob Data Contributor → read/write to Blob storage (not manage storage account)
  AcrPull             → pull images from Azure Container Registry
```

```bash
# Assign a role to a managed identity (allow a VM to read from Key Vault)
az role assignment create \
  --assignee <managed-identity-object-id> \
  --role "Key Vault Secrets User" \
  --scope /subscriptions/<sub-id>/resourceGroups/rg-my-app/providers/Microsoft.KeyVault/vaults/my-keyvault

# View role assignments in a resource group
az role assignment list \
  --resource-group rg-my-app-prod \
  --output table
```

---

## Azure CLI Essentials

```bash
# Install (Windows)
winget install Microsoft.AzureCLI

# Authenticate
az login                          # opens browser for interactive login
az account show                   # see current subscription
az account list --output table    # list all accessible subscriptions
az account set --subscription "My Prod Subscription"  # switch subscription

# Common resource commands
az resource list --resource-group rg-my-app --output table
az resource delete --ids <resource-id> --verbose

# Show help for any command
az webapp --help
az storage account create --help
```

---

## Azure Pricing Model

```
On-demand (Pay-as-you-go):
  Pay per second/hour. No commitment. Highest rate. Good for dev/test.

Reserved Instances (1yr or 3yr):
  Commit to a resource for 1 or 3 years. Up to 72% cheaper than PAYG.
  Best for stable production workloads.

Azure Hybrid Benefit:
  Use existing Windows Server/SQL Server licenses to reduce Azure VM cost.

Free Tier:
  12 months of popular services free (limited capacity).
  Always-free tier: 25+ services (e.g., Azure Functions first 1M executions/month free).

Cost Management:
  Use Azure Cost Management + Billing to track spend.
  Set budgets and alerts to avoid bill surprises.
  Use the Azure Pricing Calculator for estimates.
```

---

## Interview Questions

**Q: What is a Resource Group in Azure?**
> A logical container for related Azure resources. Every Azure resource must belong to exactly one resource group. You can apply policies, access control (RBAC), and tags at the resource group level — affecting all resources inside. Deleting a resource group deletes all resources in it. Typical pattern: one resource group per application per environment (rg-orders-api-prod).

**Q: What is a Managed Identity and why is it better than storing a secret?**
> Managed Identity is an automatically managed service principal. Azure handles credential creation and rotation — you never see or store credentials. Applications running on Azure (App Service, Functions, AKS pods with AAD Workload Identity) can use Managed Identity to authenticate to other Azure services (Key Vault, Storage, SQL) without any secrets in code or config. If a server is compromised, there are no long-lived credentials to steal.

**Q: What is the difference between a Service Principal and a Managed Identity?**
> Service Principal: manually created app identity with a client ID + secret or certificate. You manage the secret rotation yourself. Used when the app is NOT running on Azure (e.g., local dev, external CI/CD system).
> Managed Identity: automatically managed, Azure-native. No secrets to rotate. Only for workloads running ON Azure. Two types: System-assigned (tied to one resource, deleted when resource is deleted) and User-assigned (independent, can be reused across multiple resources).

**Q: How does Azure RBAC differ from Azure AD roles?**
> Azure RBAC: controls access to Azure resources (create VMs, read storage, deploy to App Service). Assignments are at a scope (subscription/resource group/resource).
> Azure AD roles: control Azure AD operations (create users, manage apps, configure policies). Examples: Global Administrator, Application Administrator. Independent from Azure RBAC.

**Q: What are Azure Availability Zones?**
> Physically separate datacenters within an Azure region, each with independent power, cooling, and networking. Deploying across AZs provides high availability — if one datacenter fails, resources in other zones continue serving traffic. Zone-redundant services (e.g., zone-redundant storage, zone-redundant App Service Plan) automatically span all zones.

---

<a id="azure-app-service-functions"></a>
## 02_app_service_functions.md — Azure App Service — Managed Web Hosting

# Azure: App Service and Azure Functions

## Azure App Service — Managed Web Hosting

```
App Service is a fully managed PaaS (Platform as a Service) for hosting:
  - Web apps (Node.js, Python, .NET, Java, PHP)
  - REST APIs
  - Mobile backends
  - Docker containers (single or multi-container)

You don't manage the OS, patches, or web server — Azure handles all that.
You pay for the App Service Plan (the compute tier), not per request.

App Service Plan determines:
  - Region (East US, West Europe)
  - Instance count and size (CPU, memory)
  - Features (custom domains, TLS, deployment slots, auto-scale)
```

---

## Deploying a Node.js App to App Service

```bash
# Step 1: Create an App Service Plan (the compute tier)
az appservice plan create \
  --name plan-my-app-prod \
  --resource-group rg-my-app-prod \
  --sku P1v3 \           # P1v3 = 2 vCPU, 8 GB RAM (Premium v3 tier)
  --is-linux             # Linux host (required for Node.js / Docker)

# SKU options:
#   F1 (Free)   → shared, no SLA, no custom domains
#   B1 (Basic)  → dedicated, no auto-scale
#   P1v3 (Premium v3) → auto-scale, deployment slots, custom domains, TLS

# Step 2: Create the Web App
az webapp create \
  --resource-group rg-my-app-prod \
  --plan plan-my-app-prod \
  --name myapp-prod \                  # must be globally unique → myapp-prod.azurewebsites.net
  --runtime "NODE:20-lts" \            # Node.js 20 LTS runtime
  --assign-identity '[system]'         # enable system-assigned Managed Identity

# Step 3: Configure environment variables (App Settings)
az webapp config appsettings set \
  --resource-group rg-my-app-prod \
  --name myapp-prod \
  --settings \
    NODE_ENV=production \
    PORT=8080 \
    DB_HOST=mydb.postgres.database.azure.com

# Step 4: Configure startup command (for custom npm scripts)
az webapp config set \
  --resource-group rg-my-app-prod \
  --name myapp-prod \
  --startup-file "node dist/server.js"

# Step 5: Deploy from local Git / ZIP
az webapp deployment source config-zip \
  --resource-group rg-my-app-prod \
  --name myapp-prod \
  --src ./build.zip
```

---

## Deployment Slots — Zero-Downtime Deployments

```
Deployment slots are separate live environments within one App Service app.
The Standard/Premium tier includes slots.

Common pattern:
  Production slot  → live traffic (cool URL: myapp.azurewebsites.net)
  Staging slot     → new version (staging URL: myapp-staging.azurewebsites.net)

Workflow:
  1. Deploy new version to staging slot
  2. Test staging slot (integration tests, smoke tests, manual QA)
  3. SWAP: Azure atomically swaps routing — staging becomes production
            production route: now points to new version
            old production: still running at staging URL for quick rollback
  4. If something is wrong after swap: swap back (instant rollback)
```

```bash
# Create a staging slot
az webapp deployment slot create \
  --resource-group rg-my-app-prod \
  --name myapp-prod \
  --slot staging \
  --configuration-source myapp-prod    # copy app settings from production slot

# Deploy to staging slot (not production)
az webapp deployment source config-zip \
  --resource-group rg-my-app-prod \
  --name myapp-prod \
  --slot staging \
  --src ./new-build.zip

# Test staging slot
curl https://myapp-prod-staging.azurewebsites.net/health

# Swap staging → production (zero downtime, atomic)
az webapp deployment slot swap \
  --resource-group rg-my-app-prod \
  --name myapp-prod \
  --slot staging \
  --target-slot production
# After swap: production has new version, staging has old version (easy rollback)

# Rollback: just swap back
az webapp deployment slot swap \
  --resource-group rg-my-app-prod \
  --name myapp-prod \
  --slot staging \
  --target-slot production
```

---

## Auto-scaling App Service

```bash
# Auto-scale rule: add instance when average CPU > 70%,
#                  remove instance when average CPU < 30%
az monitor autoscale create \
  --resource-group rg-my-app-prod \
  --resource /subscriptions/.../serverfarms/plan-my-app-prod \
  --resource-type Microsoft.Web/serverfarms \
  --name autoscale-my-app \
  --min-count 2 \
  --max-count 10 \
  --count 2

az monitor autoscale rule create \
  --resource-group rg-my-app-prod \
  --autoscale-name autoscale-my-app \
  --condition "Percentage CPU > 70 avg 5m" \
  --scale out 2              # add 2 instances when CPU > 70% for 5 minutes

az monitor autoscale rule create \
  --resource-group rg-my-app-prod \
  --autoscale-name autoscale-my-app \
  --condition "Percentage CPU < 30 avg 10m" \
  --scale in 1               # remove 1 instance when CPU < 30% for 10 minutes
```

---

## Azure Functions — Serverless Compute

```
Azure Functions lets you run small pieces of code (functions) triggered by events.
No servers to manage. Scale to zero when not in use. Pay per execution.

Triggers:
  HTTP         → API endpoint (like API Gateway + Lambda)
  Timer        → scheduled cron job (e.g., "every day at 2 AM")
  Queue        → Azure Storage Queue or Service Bus message
  Blob         → new file uploaded to Azure Blob Storage
  Cosmos DB    → listen to change feed from Cosmos DB
  Event Grid   → CloudEvents from Azure services
  Service Bus  → enterprise messaging
```

---

## Azure Functions — Node.js Example

```javascript
// func init my-app --javascript   ← create Functions project
// func new --name HttpTrigger --template "HTTP trigger"
// func start  ← run locally with Azure Functions Core Tools

// HttpTrigger/index.js
module.exports = async function (context, req) {
  // context.log → structured logging to Application Insights
  context.log('HTTP trigger received:', req.method, req.url);

  // req.query  → query string params
  // req.body   → parsed JSON body
  const name = req.query.name || (req.body && req.body.name) || 'World';

  // Validate input at the function boundary (user-supplied data)
  if (typeof name !== 'string' || name.length > 100) {
    context.res = { status: 400, body: 'Invalid name parameter' };
    return;
  }

  context.res = {
    status: 200,
    body: { message: `Hello, ${name}!` },
    headers: { 'Content-Type': 'application/json' },
  };
};
```

```json
// HttpTrigger/function.json — defines trigger type and bindings
{
  "bindings": [
    {
      "authLevel": "function",   // requires function key in request header/query
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get", "post"]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

---

## Timer Trigger (Cron Function)

```javascript
// TimerTrigger/index.js — runs on a schedule
module.exports = async function (context, myTimer) {
  // myTimer.isPastDue is true if previous execution was delayed
  if (myTimer.isPastDue) {
    context.log('Timer is past due — running late');
  }

  context.log('Daily cleanup job started at:', new Date().toISOString());
  await cleanupExpiredSessions();
  await sendDailyDigest();
  context.log('Daily cleanup finished');
};

// TimerTrigger/function.json
// {
//   "bindings": [{
//     "type": "timerTrigger",
//     "direction": "in",
//     "name": "myTimer",
//     "schedule": "0 0 2 * * *"   ← CRON: run at 2:00 AM every day
//   }]
// }
```

---

## Azure Durable Functions

```
Durable Functions extend Azure Functions with state and orchestration.
Useful for long-running workflows that don't fit in a single 10-min timeout.

Activity Functions → individual steps (call API, process file, send email)
Orchestrator Function → coordinates activities with fan-out/fan-in, retries, timers
```

```javascript
// Orchestrator: orchestrates a multi-step order processing workflow
const df = require('durable-functions');

module.exports = df.orchestrator(function* (context) {
  const orderId = context.df.getInput();

  // Step 1 — validate order (Activity Function, can take any time, retried on failure)
  const validatedOrder = yield context.df.callActivity('ValidateOrder', orderId);

  // Fan-out: run 3 activities in parallel
  const [inventory, payment, fraud] = yield context.df.Task.all([
    context.df.callActivity('CheckInventory', validatedOrder),
    context.df.callActivity('ProcessPayment', validatedOrder),
    context.df.callActivity('FraudCheck', validatedOrder),
  ]);
  // Wait until ALL three complete before continuing

  if (!payment.approved) {
    yield context.df.callActivity('RefundPayment', orderId);
    return { status: 'DECLINED', reason: payment.reason };
  }

  yield context.df.callActivity('FulfillOrder', { orderId, inventory });
  return { status: 'FULFILLED' };
});
```

---

## Interview Questions

**Q: What is a deployment slot and why use it?**
> A slot is a live staging environment within the same App Service app. Deploy to staging, test thoroughly, then swap with a single atomic operation — traffic switches instantly with no downtime. If the new version has issues, swap back. The previous version stays warm in the staging slot until you're confident.

**Q: What is the difference between Azure Functions Consumption Plan and Premium Plan?**
> Consumption Plan: scale to zero when idle, pay only for executions. Cheapest for intermittent workloads. Cold starts can take a few seconds. Maximum execution timeout: 10 minutes.
> Premium Plan: pre-warmed instances eliminate cold starts. VNet integration possible. Higher minimum cost (always at least one warm instance). Use for production APIs needing consistent latency.

**Q: When would you use Durable Functions?**
> When you have workflows that span multiple steps, need to wait for external events, run fan-out/fan-in patterns, or run longer than 10 minutes. Durable Functions checkpoints state to Azure Storage after each activity step — if Azure restarts the orchestrator, it replays from the last checkpoint without data loss.

**Q: How do you pass secrets to an Azure Function without hardcoding?**
> Use Application Settings (env vars) backed by Azure Key Vault references. Reference syntax: `@Microsoft.KeyVault(SecretUri=https://vault.vault.azure.net/secrets/db-password/)`. The Function App's Managed Identity must have Key Vault Secrets User role. Azure injects the secret value at runtime, never exposing it in config files.

**Q: What is the difference between App Service and Azure Functions?**
> App Service: always-on web server for long-running applications. Pay for compute 24/7 (unless scaled to zero on Basic+). Good for web apps, APIs, WebSockets.
> Azure Functions: event-triggered, serverless. Pay per execution. Scales to zero. Maximum timeout (10 min on Consumption). Good for background jobs, event processing, scheduled tasks.

---

<a id="azure-storage-cdn"></a>
## 03_storage_cdn.md — Azure Blob Storage — Object Storage

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

---

<a id="azure-databases"></a>
## 04_databases.md — Azure Database for PostgreSQL — Flexible Server

# Azure: Databases

## Azure Database for PostgreSQL — Flexible Server

```
Managed Postgres on Azure.
Azure handles: patching, backups, HA failover, monitoring.
You handle: schema, queries, connection pooling.

Flexible Server features:
  High Availability: Zone-redundant (standby in different AZ) — same endpoint
  Read Replicas: up to 5 replicas for read scaling
  PITR: Point-in-Time Restore — restore DB to any point in the last 35 days
  Backup: automatic daily backups, geo-redundant option
  Connection pool: built-in PgBouncer connection pooler
```

```bash
# Create a Flexible Server
az postgres flexible-server create \
  --resource-group rg-my-app-prod \
  --name mydb-postgres-prod \
  --location eastus \
  --admin-user pgadmin \
  --admin-password "$(openssl rand -base64 32)" \  # generate strong random password
  --tier GeneralPurpose \
  --sku-name Standard_D4s_v3 \         # 4 vCPU, 16 GB RAM
  --version 16 \                        # PostgreSQL 16
  --storage-size 128 \                  # 128 GB SSD
  --high-availability ZoneRedundant \   # automatic failover to standby AZ
  --vnet my-vnet \
  --subnet db-subnet                    # put DB in private subnet — no public access

# Store admin password in Key Vault (never leave it in shell history)
az keyvault secret set \
  --vault-name my-keyvault \
  --name postgres-admin-password \
  --value "$(az postgres flexible-server show-connection-string ...)"

# Allow only the App Service's VNet to connect (Private Endpoint)
az postgres flexible-server create \
  --private-dns-zone mydb-postgres-prod.private.postgres.database.azure.com
# ↑ App code connects using the private DNS name — traffic stays inside VNet
```

---

## Cosmos DB — Multi-Model Globally Distributed Database

```
Azure Cosmos DB is a fully managed NoSQL database.
Key capabilities:
  - Single-digit millisecond reads and writes at global scale
  - Automatic horizontal sharding (partition key = shard key)
  - 5 consistency levels (from strong to eventual) — trade consistency for latency
  - Multi-region writes (active-active) — write to any region, data replicated globally
  - Multiple APIs: NoSQL (JSON), MongoDB, Cassandra, Gremlin (graph), Table

Think of it as: Microsoft's version of AWS DynamoDB with more API choices.
```

---

```javascript
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

// Connect using Managed Identity (no connection string with secrets)
const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,          // https://my-cosmos.documents.azure.com:443/
  aadCredentials: new DefaultAzureCredential(),    // uses Managed Identity or Azure CLI
});

const { database } = await cosmosClient.databases.createIfNotExists({ id: 'my-db' });
const { container } = await database.containers.createIfNotExists({
  id: 'users',
  partitionKey: { paths: ['/countryCode'] },   // choose a high-cardinality partition key
  // BAD partition key: /status (only 3-4 values → hot partitions)
  // GOOD partition key: /userId, /countryCode, /tenantId (many unique values)
});

// ── Create an item ────────────────────────────────────────────────────────
async function createUser(user) {
  const { resource } = await container.items.create({
    id: user.id,                     // MUST provide unique id within the partition
    countryCode: user.countryCode,   // the partition key value
    name: user.name,
    email: user.email,
    createdAt: new Date().toISOString(),
    // Cosmos DB automatically stores system fields like _ts (timestamp), _rid, _etag
  });
  return resource;
}

// ── Read an item by id and partition key ──────────────────────────────────
// Reading by id + partition key = cheapest & fastest — single lookup
async function getUser(userId, countryCode) {
  const { resource } = await container.item(userId, countryCode).read();
  return resource;
}

// ── Query with SQL-like syntax ────────────────────────────────────────────
async function getUsersByCountry(countryCode) {
  const { resources } = await container.items.query({
    query: 'SELECT * FROM c WHERE c.countryCode = @countryCode ORDER BY c.createdAt DESC',
    parameters: [{ name: '@countryCode', value: countryCode }],  // parameterized — prevents injection
  }).fetchAll();
  return resources;
}

// ── Upsert (insert or replace) ────────────────────────────────────────────
async function upsertUser(user) {
  const { resource } = await container.items.upsert(user);
  return resource;
}
```

---

## Cosmos DB Consistency Levels

```
Cosmos DB offers 5 consistency levels (choose per-operation or at account level):

  Strong          → reads always see the latest write (like a relational DB)
                    Highest consistency, highest latency, 2x RU cost
                    Use: financial transactions, inventory counts

  Bounded Staleness → reads may lag writes by at most K versions or T seconds
                    Good: apps that need predictable staleness (e.g., news feed)

  Session (default) → consistency within a single session/client
                    Reads see writes made in the same session
                    Good: most web apps — user sees their own changes immediately

  Consistent Prefix → reads never see out-of-order writes (no "reply before question")
                    Good: social feeds, comment threads

  Eventual        → weakest — reads may see stale data, eventually consistent
                    Lowest latency, cheapest RU cost
                    Good: "likes" counts, analytics, cache invalidation
```

---

## Azure SQL — Managed SQL Server

```
Azure SQL is a fully managed SQL Server database.
Best if your app already uses SQL Server or T-SQL.
Azure handles: backups, patching, HA, failover, security.

Tiers:
  DTU-based    → simple combined measure of CPU+IO+memory
  vCore-based  → choose CPUs separately (Serverless auto-pause when idle = cost savings)
  Hyperscale   → up to 100 TB, near-instant snapshots, up to 30 replicas
```

---

## Azure Cache for Redis

```
Managed Redis on Azure.
Use cases: session storage, query caching, pub/sub, rate limiting.
Tiers: Basic (dev/test, no SLA), Standard (HA replica pair), Premium (clustering, persistence)
```

```javascript
const { createClient } = require('redis');

// Connect to Azure Cache for Redis with TLS (always required)
const redisClient = createClient({
  url: `rediss://${process.env.REDIS_HOST}:6380`,  // rediss:// = TLS, port 6380
  password: process.env.REDIS_KEY,                  // primary access key from Azure portal
  socket: {
    tls: true,
    rejectUnauthorized: true,
  },
});

await redisClient.connect();

// ── Session cache pattern ─────────────────────────────────────────────────
async function setSession(sessionId, userId, ttlSeconds = 3600) {
  // EX sets expiry in seconds — session expires after 1 hour of inactivity
  await redisClient.setEx(`session:${sessionId}`, ttlSeconds, String(userId));
}

async function getSession(sessionId) {
  const userId = await redisClient.get(`session:${sessionId}`);
  if (!userId) return null;               // session expired or doesn't exist

  // Refresh TTL on each access ("sliding expiry" pattern)
  await redisClient.expire(`session:${sessionId}`, 3600);
  return userId;
}

// ── Cache-aside query result ───────────────────────────────────────────────
async function getProductCached(productId) {
  const cacheKey = `product:${productId}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const product = await db.findProduct(productId);
  if (product) {
    await redisClient.setEx(cacheKey, 300, JSON.stringify(product));  // cache 5 min
  }
  return product;
}
```

---

## Interview Questions

**Q: What is the Cosmos DB partition key and how do you choose a good one?**
> The partition key determines how Azure distributes items across physical partitions. A good partition key: high cardinality (many unique values — userId, tenantId), evenly distributed (no "hot" partitions with most traffic), included in most query filters (so queries hit one partition, not all). Bad choices: createdAt (time-clustering → hot partition), status (only 3 values → 3 partitions max → bottleneck).

**Q: What are the Cosmos DB consistency levels and which do you use by default?**
> Session consistency is the default and covers most web apps — a user always reads what they wrote in the same session. Strong consistency ensures every read sees the latest write but has higher latency and cost. Eventual is cheapest/fastest but data may be stale. Choose based on business requirements — financial systems need Strong, social feeds are fine with Eventual.

**Q: What is Azure SQL Serverless compute tier?**
> A tier that auto-pauses the database after a configurable idle period (saving costs to near-zero) and auto-resumes on the first connection (with a few seconds of cold start). Ideal for dev/test databases or apps with unpredictable, intermittent usage. Not suitable for latency-sensitive production workloads where that startup delay is unacceptable.

**Q: Why does Cosmos DB charge "RUs" instead of traditional DB pricing?**
> RU (Request Unit) is a normalized measure of CPU, memory, and I/O consumed by an operation. A 1KB document read = 1 RU. A write = ~5 RU. A complex query = hundreds of RU. You provision or auto-scale RU/s on a container. This abstraction lets Cosmos DB scale horizontally and bill consistently regardless of which physical server runs your query.

**Q: When would you choose Cosmos DB over Azure Database for PostgreSQL?**
> Cosmos DB: global distribution, single-digit ms latency at any scale, schema-less documents, IoT data, user profiles, session data, gaming leaderboards. No complex joins — all access patterns via partition key + id lookups.
> PostgreSQL: complex relational queries with joins, strong ACID transactions, reporting, evolving data model. Easier to start with; schema migrations are straightforward with standard SQL tools.

---

<a id="azure-networking"></a>
## 05_networking.md — Virtual Network (VNet)

# Azure: Networking

## Virtual Network (VNet)

```
A VNet is your private isolated network in Azure, similar to a physical on-premises network.
Resources inside a VNet can communicate privately.
Resources in different VNets are isolated by default.

VNet properties:
  Address space   → CIDR block you assign, e.g., 10.0.0.0/16 (65,536 IPs)
  Subnets         → subdivide the VNet (e.g., 10.0.1.0/24, 10.0.2.0/24)
  Region          → VNets are region-scoped
```

```bash
# Create a VNet with two subnets (public-facing and private app tier)
az network vnet create \
  --resource-group rg-my-app-prod \
  --name vnet-my-app-prod \
  --address-prefix 10.0.0.0/16 \
  --subnet-name subnet-public \
  --subnet-prefix 10.0.1.0/24

# Add private subnet (for App Service / DB / AKS)
az network vnet subnet create \
  --resource-group rg-my-app-prod \
  --vnet-name vnet-my-app-prod \
  --name subnet-private \
  --address-prefix 10.0.2.0/24

# Add database subnet
az network vnet subnet create \
  --resource-group rg-my-app-prod \
  --vnet-name vnet-my-app-prod \
  --name subnet-db \
  --address-prefix 10.0.3.0/24 \
  --delegations Microsoft.DBforPostgreSQL/flexibleServers
  # ↑ Delegate this subnet to a specific Azure service (required for Flexible Server VNet integration)
```

---

## Network Security Groups (NSG)

```
NSG is a stateful firewall applied to a subnet or NIC (network interface).
Like an AWS Security Group but uses ALLOW AND DENY rules.

Rules have: priority (100–4096, lower = evaluated first), direction (Inbound/Outbound),
            protocol (TCP/UDP/Any), source/destination (IP, CIDR, service tag), action (Allow/Deny)

Service Tags: pre-defined groups of IPs maintained by Azure:
  Internet          → all public internet traffic
  AzureLoadBalancer → Azure health probe traffic
  VirtualNetwork    → all traffic within the VNet
  AppService        → IP ranges of App Service
```

```bash
# Create an NSG
az network nsg create \
  --resource-group rg-my-app-prod \
  --name nsg-app-subnet

# Allow HTTPS inbound from internet
az network nsg rule create \
  --resource-group rg-my-app-prod \
  --nsg-name nsg-app-subnet \
  --name Allow-HTTPS-Inbound \
  --priority 100 \
  --direction Inbound \
  --protocol Tcp \
  --source-address-prefixes Internet \
  --destination-port-ranges 443 \
  --access Allow

# DENY all other inbound traffic (explicit deny at lower priority)
az network nsg rule create \
  --resource-group rg-my-app-prod \
  --nsg-name nsg-app-subnet \
  --name Deny-All-Other \
  --priority 4096 \
  --direction Inbound \
  --protocol '*' \
  --source-address-prefixes '*' \
  --destination-port-ranges '*' \
  --access Deny

# Associate NSG with a subnet
az network vnet subnet update \
  --resource-group rg-my-app-prod \
  --vnet-name vnet-my-app-prod \
  --name subnet-app \
  --network-security-group nsg-app-subnet
```

---

## Azure Load Balancer vs Application Gateway

```
Azure Load Balancer (Layer 4):
  - Operates at TCP/UDP (transport) layer
  - Routes based on IP address and port
  - Ultra-fast, very high throughput, very low latency
  - No SSL termination, no URL routing
  - Use for: non-HTTP traffic (SQL, Redis, TCP), very high-performance HTTP

Application Gateway (Layer 7):
  - Operates at HTTP/HTTPS application layer
  - URL-based routing: /api → backend pool A, /images → backend pool B
  - SSL termination (decrypt HTTPS, forward plain HTTP to backends)
  - Web Application Firewall (WAF): OWASP rules, DDoS protection
  - Cookie-based session affinity, custom health probes
  - Use for: web apps, microservices APIs, any HTTPS endpoint
```

```bash
# Create an Application Gateway with WAF
az network application-gateway create \
  --resource-group rg-my-app-prod \
  --name agw-my-app \
  --location eastus \
  --vnet-name vnet-my-app-prod \
  --subnet subnet-agw \              # needs a DEDICATED subnet for App Gateway
  --sku WAF_v2 \
  --capacity 2 \                     # 2 instances for HA
  --http-settings-protocol Https \
  --http-settings-port 443 \
  --frontend-port 443 \
  --routing-rule-type Basic

# Enable WAF prevention mode (block rather than detect threats)
az network application-gateway waf-config set \
  --resource-group rg-my-app-prod \
  --gateway-name agw-my-app \
  --enabled true \
  --firewall-mode Prevention \       # Prevention blocks; Detection only logs
  --rule-set-version 3.2             # OWASP 3.2 rule set
```

---

## Private Endpoints

```
A Private Endpoint maps an Azure service (Storage, Cosmos DB, Azure SQL, Key Vault)
to a private IP address inside your VNet.
All traffic to that service stays within the Azure backbone — never traverses public internet.

Without Private Endpoint:
  App (10.0.2.5) → [public internet] → storage.blob.core.windows.net (public IP)

With Private Endpoint:
  App (10.0.2.5) → storage.blob.core.windows.net → resolves to 10.0.4.6 (private IP in VNet)
                → [Azure backbone, never leaves your network]
```

```bash
# Create a Private Endpoint for a storage account
az network private-endpoint create \
  --resource-group rg-my-app-prod \
  --name pe-storage \
  --vnet-name vnet-my-app-prod \
  --subnet subnet-private \
  --private-connection-resource-id $(az storage account show --name mystorageacct --query id -o tsv) \
  --group-id blob \                  # 'blob' = Blob storage endpoint; 'file' for Azure Files
  --connection-name pe-storage-conn

# Create private DNS zone to resolve storage FQDN to the private IP
az network private-dns zone create \
  --resource-group rg-my-app-prod \
  --name privatelink.blob.core.windows.net  # always this name for Blob storage

az network private-dns link vnet create \
  --resource-group rg-my-app-prod \
  --zone-name privatelink.blob.core.windows.net \
  --name link-to-vnet \
  --virtual-network vnet-my-app-prod \
  --registration-enabled false
# Now: mystorageacct.blob.core.windows.net → resolves to 10.0.4.6 inside VNet
```

---

## VNet Peering

```
VNet Peering connects two VNets for private communication.
After peering, VMs in VNet-A can talk to VMs in VNet-B using private IPs.
Traffic goes through Azure backbone — low latency, no public internet.

Use case: Hub-and-Spoke topology
  Hub VNet    → shared services (DNS, Key Vault, Monitoring, VPN Gateway)
  Spoke VNets → individual app VNets (peered to hub)
```

```bash
# Peer VNet-A to VNet-B (must create peer in BOTH directions)
az network vnet peering create \
  --resource-group rg-hub \
  --name peer-hub-to-spoke \
  --vnet-name vnet-hub \
  --remote-vnet /subscriptions/.../vnet-spoke \
  --allow-vnet-access \
  --allow-forwarded-traffic

az network vnet peering create \
  --resource-group rg-spoke \
  --name peer-spoke-to-hub \
  --vnet-name vnet-spoke \
  --remote-vnet /subscriptions/.../vnet-hub \
  --allow-vnet-access \
  --allow-forwarded-traffic
```

---

## Azure DNS

```bash
# Create a custom DNS zone (for your domain)
az network dns zone create \
  --resource-group rg-my-app-prod \
  --name mycompany.com

# Create an A record (point www.mycompany.com to a public IP)
az network dns record-set a add-record \
  --resource-group rg-my-app-prod \
  --zone-name mycompany.com \
  --record-set-name www \
  --ipv4-address 40.120.30.50 \
  --ttl 300

# Create a CNAME record (alias API to App Service)
az network dns record-set cname set-record \
  --resource-group rg-my-app-prod \
  --zone-name mycompany.com \
  --record-set-name api \
  --cname myapp-prod.azurewebsites.net
```

---

## Interview Questions

**Q: What is the difference between an NSG and an Application Gateway WAF?**
> NSG: stateful Layer 4 firewall at subnet/NIC level. Controls which IP addresses and ports can communicate. Fast and simple. Cannot inspect HTTP content.
> Application Gateway WAF: Layer 7 HTTP-aware security. Inspects URL paths, HTTP headers, request bodies. Blocks SQL injection, XSS, CSRF. Understands HTTP protocol — NSG only sees TCP/IP. Use both: NSG for broad network isolation, WAF for HTTP-specific attack protection.

**Q: What is a Private Endpoint and why is it important for security?**
> A Private Endpoint gives an Azure service (Storage, SQL, Key Vault) a private IP inside your VNet. Traffic from your apps to that service never traverses the public internet — it stays within the Azure backbone. Without a Private Endpoint, your apps connect to public service endpoints, which could be accessed from anywhere. Combined with NSG rules, it creates a defence-in-depth posture.

**Q: What is VNet Peering vs VPN Gateway?**
> VNet Peering: connects two Azure VNets directly via Azure backbone. Low latency, high bandwidth. Nontransitive by default (A↔B and B↔C doesn't mean A↔C without A↔C peering). Ideal for Azure-to-Azure connectivity.
> VPN Gateway: connects Azure VNet to on-premises network or another Azure VNet through IPsec/IKE tunnel. Used when you need to connect to corporate headquarters or non-Azure networks. Higher latency than peering but works across different cloud providers or networks.

**Q: What is the difference between Azure Load Balancer and Application Gateway?**
> Azure Load Balancer: Layer 4 (TCP/UDP). No visibility into HTTP content. Routes based on IP/port with hash-based load distribution. Very fast and cheap. Cannot route based on URL, does not terminate SSL.
> Application Gateway: Layer 7 (HTTP/HTTPS). URL path-based routing, host-based routing, SSL termination, WAF. Understands HTTP — can make routing decisions based on request headers and cookies. Higher cost but required for any HTTP-level intelligence.

**Q: What are Service Tags in NSG rules?**
> Service Tags are named groups of IP ranges managed by Microsoft. Instead of manually maintaining lists of Azure service IP addresses, you use tags like `AzureLoadBalancer`, `AzureMonitor`, `AppService`, `Storage`. Azure updates the IP ranges behind these tags automatically when services expand. This prevents situations where a new Azure datacenter IP breaks your NSG rules because you forgot to update the IP list.

---

<a id="azure-aks-acr"></a>
## 06_aks_acr.md — Azure Container Registry (ACR)

# Azure: AKS and ACR — Kubernetes on Azure

## Azure Container Registry (ACR)

```
ACR is Azure's private Docker image registry.
Like Docker Hub but: private, inside your Azure subscription,
integrates natively with AKS (no credentials needed via Managed Identity).

Tiers:
  Basic    → dev/test, limited throughput
  Standard → most production workloads
  Premium  → geo-replication, private endpoints, higher throughput, content trust
```

```bash
# ── Create an ACR ─────────────────────────────────────────────────────────
az acr create \
  --resource-group rg-my-app-prod \
  --name myacr \                       # registry name must be globally unique
  --sku Premium \
  --location eastus \
  --admin-enabled false                # keep admin disabled — use Managed Identity instead

# ── Build an image directly in ACR (no local Docker needed) ──────────────
# ACR Tasks: build the image in the cloud, push to registry automatically
az acr build \
  --registry myacr \
  --image my-app:v1.2.3 \             # image name and tag in the registry
  --file Dockerfile \                  # Dockerfile path (default: ./Dockerfile)
  .                                    # build context (current directory)

# ── Pull/push using standard Docker CLI ──────────────────────────────────
az acr login --name myacr              # authenticate docker CLI to ACR
docker pull myacr.azurecr.io/my-app:v1.2.3
docker push myacr.azurecr.io/my-app:latest

# ── Set a lifecycle retention policy ─────────────────────────────────────
# Delete untagged images older than 7 days (prevent unlimited image buildup)
az acr config soft-delete enable \
  --registry myacr \
  --status enabled \
  --days 7
```

---

## AKS — Azure Kubernetes Service

```
AKS is managed Kubernetes on Azure.
Azure handles: Kubernetes control plane (API server, etcd, scheduler, controllers).
You handle: node pools, workload deployments, monitoring.

Control plane: FREE on AKS (unlike EKS which charges $0.10/hr).
Worker nodes: pay for the underlying VM sizes.
```

```bash
# ── Create an AKS cluster ─────────────────────────────────────────────────
az aks create \
  --resource-group rg-my-app-prod \
  --name aks-my-app-prod \
  --location eastus \
  --kubernetes-version 1.29 \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \     # 4 vCPU, 16 GB (adjust to workload)
  --min-count 2 \                       # cluster autoscaler minimum
  --max-count 10 \                      # cluster autoscaler maximum
  --enable-cluster-autoscaler \         # auto-add/remove nodes based on pending pods
  --load-balancer-sku standard \        # required for availability zones
  --zones 1 2 3 \                       # spread nodes across AZs 1, 2, 3
  --network-plugin azure \              # Azure CNI: pods get VNet IPs (required for some features)
  --vnet-subnet-id /subscriptions/.../subnet-aks \   # deploy AKS inside your VNet
  --attach-acr myacr \                  # grant AKS pull rights from ACR (AcrPull role)
  --enable-oidc-issuer \               # enable OIDC for Azure AD Workload Identity
  --enable-workload-identity \          # enables AAD workload identity for pods
  --workspace-resource-id /subscriptions/.../log-analytics-workspace   # Container Insights

# ── Get credentials (configure kubectl) ──────────────────────────────────
az aks get-credentials \
  --resource-group rg-my-app-prod \
  --name aks-my-app-prod \
  --overwrite-existing
# Writes kubeconfig to ~/.kube/config — kubectl now talks to this cluster

# ── Verify connection ─────────────────────────────────────────────────────
kubectl get nodes
kubectl get pods -A
```

---

## Azure AD Workload Identity (AKS IRSA Equivalent)

```
Problem: pods need to access Azure services (Key Vault, Storage, Cosmos DB) securely.
Bad practice: mount Azure credentials as Kubernetes Secrets.
Solution: Azure AD Workload Identity — bind an Azure Managed Identity to a
          Kubernetes ServiceAccount. Pods get temporary tokens automatically.
```

```bash
# Step 1: Create a User-Assigned Managed Identity
az identity create \
  --resource-group rg-my-app-prod \
  --name id-my-app-workload

IDENTITY_CLIENT_ID=$(az identity show \
  --name id-my-app-workload \
  --resource-group rg-my-app-prod \
  --query clientId -o tsv)

# Step 2: Grant the Managed Identity access to Key Vault
az role assignment create \
  --assignee-object-id $(az identity show --name id-my-app-workload \
                          --resource-group rg-my-app-prod --query principalId -o tsv) \
  --role "Key Vault Secrets User" \
  --scope /subscriptions/.../resourceGroups/rg-my-app-prod/providers/Microsoft.KeyVault/vaults/my-kv

# Step 3: Create a Kubernetes ServiceAccount annotated with the identity
OIDC_ISSUER=$(az aks show --name aks-my-app-prod --resource-group rg-my-app-prod \
              --query oidcIssuerProfile.issuerUrl -o tsv)

# Create the federated credential (binds K8s SA to Azure Managed Identity)
az identity federated-credential create \
  --name federated-my-app \
  --identity-name id-my-app-workload \
  --resource-group rg-my-app-prod \
  --issuer $OIDC_ISSUER \
  --subject system:serviceaccount:my-namespace:my-app-sa   # namespace:serviceaccount-name
```

```yaml
# Kubernetes ServiceAccount annotated with Managed Identity client ID
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  namespace: my-namespace
  annotations:
    azure.workload.identity/client-id: "<IDENTITY_CLIENT_ID>"   # from az identity show

---
# Deployment using the annotated ServiceAccount
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-namespace
spec:
  template:
    metadata:
      labels:
        azure.workload.identity/use: "true"   # enable workload identity for this pod
    spec:
      serviceAccountName: my-app-sa           # use the annotated SA
      containers:
        - name: my-app
          image: myacr.azurecr.io/my-app:v1.2.3
          # No AZURE_CLIENT_ID or AZURE_CLIENT_SECRET needed!
          # SDK auto-discovers identity from the projected OIDC token
```

---

## Azure Monitor Container Insights

```bash
# Enable Container Insights on an existing cluster
az aks enable-addons \
  --resource-group rg-my-app-prod \
  --name aks-my-app-prod \
  --addons monitoring \
  --workspace-resource-id /subscriptions/.../workspaces/my-log-analytics

# Container Insights collects:
#   - Node CPU/memory utilization
#   - Pod CPU/memory utilization
#   - Container logs (stdout/stderr) → Log Analytics workspace
#   - Kubernetes events (OOMKilled, CrashLoopBackOff)
# Query logs with KQL (Kusto Query Language):
```

```kusto
// KQL query: find all pods that crashed in the last 24 hours
KubePodInventory
| where TimeGenerated > ago(24h)
| where ContainerStatusReason in ("OOMKilled", "Error", "CrashLoopBackOff")
| summarize count() by bin(TimeGenerated, 1h), PodName, ContainerStatusReason
| order by TimeGenerated desc
```

---

## AKS Node Pools

```bash
# Add a spot node pool for cost savings on batch workloads
# Spot nodes are 2-90% cheaper but can be evicted with 30s notice
az aks nodepool add \
  --resource-group rg-my-app-prod \
  --cluster-name aks-my-app-prod \
  --name spotpool \
  --node-count 0 \
  --min-count 0 \
  --max-count 20 \
  --enable-cluster-autoscaler \
  --priority Spot \
  --eviction-policy Delete \
  --spot-max-price -1 \        # -1 = pay market price (up to on-demand price)
  --node-vm-size Standard_D4s_v3 \
  --node-taints "kubernetes.azure.com/scalesetpriority=spot:NoSchedule"
  # ↑ Taint prevents regular workloads from landing on spot nodes

# Only batch jobs that tolerate the taint and have node affinity for spot run here
```

---

## Interview Questions

**Q: How does AKS differ from self-managed Kubernetes?**
> AKS: Azure manages the Kubernetes control plane (API server, etcd, scheduler) for free. You only manage worker nodes (VM sizes, counts). Automatic upgrades, HA control plane, native Azure integrations (Azure AD, Monitor, Key Vault). Self-managed: you provision, patch, and HA your own control plane — much more operational burden for unlikely extra customization.

**Q: How do pods in AKS access Azure services like Key Vault securely?**
> Azure AD Workload Identity: annotate a Kubernetes ServiceAccount with a Managed Identity client ID, create a federated credential linking the SA to the identity via OIDC. Pods using that ServiceAccount receive a projected OIDC token that they exchange for short-lived Azure access tokens. No secrets stored in the cluster. Credentials auto-rotate and are pod-specific.

**Q: What is the AKS Cluster Autoscaler?**
> The Cluster Autoscaler monitors pending pods (pods that can't schedule due to insufficient node resources). When pending pods exist, it adds nodes to the node pool up to max-count. When nodes are underutilized, it removes them down to min-count. Works alongside HPA (HPA adds/removes pods; Cluster Autoscaler adds/removes nodes for those pods).

**Q: What is ACR Geo-replication and when is it useful?**
> Premium ACR supports replicating the registry to multiple Azure regions. AKS clusters pull images from the nearest replica — reducing latency and protecting against regional outages. Image is pushed once (to the primary) and automatically replicated to all configured regions. Important for multi-region deployments where each region has its own AKS cluster.

**Q: What is the difference between system node pool and user node pool in AKS?**
> System node pool: reserved for critical Kubernetes system components (CoreDNS, metrics-server, konnectivity). Must always have at least one system node pool. Tainted to prevent user workloads from running there.
> User node pools: for your application workloads. Multiple user pools allow different VM sizes (e.g., GPU pool for ML, High-memory pool for analytics, Spot pool for batch jobs). You can add, scale, or delete user pools without affecting the cluster.

---

<a id="azure-pipelines-devops"></a>
## 07_pipelines_devops.md — Why Azure Pipelines?

# Azure DevOps Pipelines — Build, Test, and Deploy

## Why Azure Pipelines?

```
Azure Pipelines is a CI/CD service in Azure DevOps.
It automates: building code, running tests, building Docker images,
              deploying to App Service, AKS, Azure Functions, and more.

Key advantages:
  - Tight integration with Azure services (no extra auth setup like GitHub Actions needs)
  - Built-in manual approval gates and environments
  - Reusable YAML templates across projects
  - Both cloud (Microsoft-hosted agents) and on-premises (self-hosted agents) supported
  - Free-tier: 1 Microsoft-hosted parallel job included
```

---

## Pipeline Anatomy

```yaml
# azure-pipelines.yml — lives in the root of your repository
# Every push to the repo can trigger this file

trigger:                           # when to automatically trigger this pipeline
  branches:
    include:
      - main                       # run on every push to 'main'
      - 'release/*'                # run on any release/* branch
  paths:
    exclude:
      - 'docs/**'                  # skip pipeline if only docs changed
      - '*.md'

pr:                                # also run on pull requests (for validation)
  branches:
    include:
      - main

variables:                         # pipeline-wide variables
  imageRepository: 'my-app'
  containerRegistry: 'myacr.azurecr.io'
  dockerfilePath: '$(Build.SourcesDirectory)/Dockerfile'
  tag: '$(Build.BuildId)'          # unique ID for each pipeline run — never use :latest in production
  vmImageName: 'ubuntu-latest'

stages:                            # top-level grouping (Build / Test / Deploy Staging / Deploy Prod)
  - stage: Build
    # ...
  - stage: Deploy
    dependsOn: Build               # Deploy only starts if Build stage succeeded
    # ...
```

---

## Stage 1 — Build and Push Docker Image

```yaml
stages:
  - stage: Build
    displayName: 'Build and Push Docker Image'
    jobs:
      - job: BuildJob
        displayName: 'Build, Test, Push'
        pool:
          vmImage: 'ubuntu-latest'    # Microsoft-hosted Ubuntu agent
          # 'windows-latest' or 'macos-latest' also available

        steps:
          # Step 1: Check out repository code
          - checkout: self
            fetchDepth: 0             # full history needed for semantic versioning tools

          # Step 2: Install Node.js (use cache to speed up install)
          - task: NodeTool@0
            displayName: 'Install Node.js 20'
            inputs:
              versionSpec: '20.x'

          # Step 3: Cache node_modules — skips install if package-lock.json hasn't changed
          - task: Cache@2
            displayName: 'Cache npm packages'
            inputs:
              key: 'npm | "$(Agent.OS)" | package-lock.json'
              restoreKeys: |
                npm | "$(Agent.OS)"
              path: '$(System.DefaultWorkingDirectory)/node_modules'

          # Step 4: Install dependencies
          - script: npm ci              # ci = faster, uses package-lock.json exactly
            displayName: 'Install dependencies'

          # Step 5: Lint code (fail early on code quality issues)
          - script: npm run lint
            displayName: 'Run ESLint'

          # Step 6: Run unit tests and publish results
          - script: npm test -- --reporter=junit --output-file=test-results.xml
            displayName: 'Run unit tests'

          # Step 7: Publish test results (visible in Azure DevOps test tab)
          - task: PublishTestResults@2
            displayName: 'Publish test results'
            condition: always()         # publish even if tests fail (so we see which tests failed)
            inputs:
              testResultsFormat: 'JUnit'
              testResultsFiles: 'test-results.xml'
              failTaskOnFailedTests: true

          # Step 8: Publish code coverage report
          - task: PublishCodeCoverageResults@1
            displayName: 'Publish coverage'
            inputs:
              codeCoverageTool: 'Cobertura'
              summaryFileLocation: '$(System.DefaultWorkingDirectory)/coverage/cobertura-coverage.xml'

          # Step 9: Log in to Azure Container Registry
          - task: Docker@2
            displayName: 'Login to ACR'
            inputs:
              command: login
              containerRegistry: 'my-acr-service-connection'
              # 'my-acr-service-connection' is created in Project Settings → Service connections
              # Azure DevOps uses the service principal behind this connection — no password in YAML

          # Step 10: Build Docker image (pass build args if needed)
          - task: Docker@2
            displayName: 'Build Docker image'
            inputs:
              command: build
              repository: $(imageRepository)
              dockerfile: $(dockerfilePath)
              containerRegistry: 'my-acr-service-connection'
              tags: |
                $(tag)
                latest
              arguments: '--build-arg NODE_ENV=production --build-arg BUILD_ID=$(Build.BuildId)'

          # Step 11: Push Docker image to ACR
          - task: Docker@2
            displayName: 'Push Docker image to ACR'
            inputs:
              command: push
              repository: $(imageRepository)
              containerRegistry: 'my-acr-service-connection'
              tags: |
                $(tag)
                latest

          # Step 12: Save image tag as a pipeline artifact (used by deploy stages)
          - script: echo "$(containerRegistry)/$(imageRepository):$(tag)" > $(Build.ArtifactStagingDirectory)/imageUri.txt
            displayName: 'Save image URI to artifact'

          - task: PublishBuildArtifacts@1
            displayName: 'Publish artifact'
            inputs:
              PathtoPublish: '$(Build.ArtifactStagingDirectory)'
              ArtifactName: 'build-output'
```

---

## Stage 2 — Deploy to Staging (App Service)

```yaml
  - stage: DeployStaging
    displayName: 'Deploy to Staging'
    dependsOn: Build
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    # ↑ only deploy from main branch, not from PR builds

    jobs:
      - deployment: DeployToStaging           # 'deployment' job type tracks deployment history
        displayName: 'Deploy to staging slot'
        environment: 'staging'                # Azure DevOps Environment (tracks history, can add checks)
        pool:
          vmImage: 'ubuntu-latest'

        strategy:
          runOnce:
            deploy:
              steps:
                # Download the artifact published in Build stage
                - download: current
                  artifact: 'build-output'

                # Deploy to App Service staging SLOT (not production slot directly)
                - task: AzureWebApp@1
                  displayName: 'Deploy to App Service staging slot'
                  inputs:
                    azureSubscription: 'my-azure-service-connection'
                    # ↑ ARM service connection created in Project Settings → Service Connections
                    appType: 'webAppLinux'
                    appName: 'myapp-prod'
                    deployToSlotOrASE: true
                    resourceGroupName: 'rg-my-app-prod'
                    slotName: 'staging'           # deploy to staging slot, NOT production
                    runtimeStack: 'NODE|20-lts'
                    startUpCommand: 'node dist/server.js'

                # Run smoke tests against staging slot
                - script: |
                    STAGING_URL="https://myapp-prod-staging.azurewebsites.net"
                    echo "Running smoke tests against $STAGING_URL"
                    curl -f "$STAGING_URL/health" || exit 1
                    curl -f "$STAGING_URL/api/version" || exit 1
                    echo "Smoke tests passed!"
                  displayName: 'Smoke tests on staging'
```

---

## Stage 3 — Manual Approval Gate + Production Deploy

```yaml
  - stage: DeployProduction
    displayName: 'Deploy to Production'
    dependsOn: DeployStaging
    condition: succeeded()

    jobs:
      # The 'environment' directive triggers the approval gate defined in Azure DevOps UI
      # Go to: Pipelines → Environments → production → Approvals and checks → + Add → Approvals
      # Add team members as required approvers.
      # Pipeline PAUSES here until someone approves or rejects.
      - deployment: DeployToProduction
        displayName: 'Swap staging → production'
        environment: 'production'       # <-- this triggers the approval gate
        pool:
          vmImage: 'ubuntu-latest'

        strategy:
          runOnce:
            deploy:
              steps:
                - download: current
                  artifact: 'build-output'

                # SWAP staging slot with production slot (zero-downtime)
                # The new version (currently in staging) becomes production.
                # The old production version moves to staging for easy rollback.
                - task: AzureAppServiceManage@0
                  displayName: 'Swap staging → production slot'
                  inputs:
                    azureSubscription: 'my-azure-service-connection'
                    Action: 'Swap Slots'
                    WebAppName: 'myapp-prod'
                    ResourceGroupName: 'rg-my-app-prod'
                    SourceSlot: 'staging'
                    SwapWithProduction: true        # swap staging WITH production

                # Verify production after swap
                - script: |
                    echo "Verifying production deployment..."
                    curl -f "https://myapp-prod.azurewebsites.net/health" || exit 1
                    echo "Production is healthy!"
                  displayName: 'Post-deployment health check'
```

---

## AKS Deployment via Helm in Azure Pipelines

```yaml
  - stage: DeployAKS
    displayName: 'Deploy to AKS via Helm'
    dependsOn: Build
    jobs:
      - deployment: HelmDeploy
        environment: 'aks-staging'
        pool:
          vmImage: 'ubuntu-latest'

        strategy:
          runOnce:
            deploy:
              steps:
                # Get AKS kubeconfig (kubectl access)
                - task: AzureCLI@2
                  displayName: 'Get AKS credentials'
                  inputs:
                    azureSubscription: 'my-azure-service-connection'
                    scriptType: 'bash'
                    scriptLocation: 'inlineScript'
                    inlineScript: |
                      az aks get-credentials \
                        --resource-group rg-my-app-prod \
                        --name aks-my-app-prod \
                        --overwrite-existing

                # Deploy via Helm (Helm chart in repo at ./helm/my-app)
                - task: HelmDeploy@0
                  displayName: 'Helm upgrade --install'
                  inputs:
                    connectionType: 'Azure Resource Manager'
                    azureSubscription: 'my-azure-service-connection'
                    azureResourceGroup: 'rg-my-app-prod'
                    kubernetesCluster: 'aks-my-app-prod'
                    namespace: 'my-app'
                    command: 'upgrade'
                    chartType: 'FilePath'
                    chartPath: './helm/my-app'          # Helm chart directory in repo
                    releaseName: 'my-app'
                    install: true                        # install if not exists
                    waitForExecution: true               # wait for Helm to complete rollout
                    arguments: |
                      --set image.repository=$(containerRegistry)/$(imageRepository)
                      --set image.tag=$(tag)
                      --set replicaCount=3
                      --timeout 10m
```

---

## Reusable Pipeline Templates

```yaml
# templates/steps-build.yml — reusable build steps template
# Other pipelines can include this with: - template: templates/steps-build.yml

parameters:
  - name: nodeVersion
    type: string
    default: '20.x'
  - name: testResultsFile
    type: string
    default: 'test-results.xml'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '${{ parameters.nodeVersion }}'

  - script: npm ci
    displayName: 'Install dependencies'

  - script: npm run lint
    displayName: 'Lint'

  - script: npm test -- --reporter=junit --output-file=${{ parameters.testResultsFile }}
    displayName: 'Test'

  - task: PublishTestResults@2
    inputs:
      testResultsFiles: '${{ parameters.testResultsFile }}'
      failTaskOnFailedTests: true

# To use in another pipeline:
# steps:
#   - template: templates/steps-build.yml
#     parameters:
#       nodeVersion: '18.x'
```

---

## Variable Groups and Key Vault Integration

```yaml
# Link an Azure Key Vault to a Variable Group in Azure DevOps.
# Secrets from Key Vault are available in pipelines as variables.
# They are masked in logs and never stored in Azure DevOps itself.

# Setup (once, in Azure DevOps UI):
# Pipelines → Library → Variable groups → + Variable group
# Toggle: "Link secrets from Azure Key Vault"
# Select subscription, Key Vault, choose secrets

# In pipeline YAML:
variables:
  - group: 'production-secrets'     # variable group name (contains KV-linked secrets)
  - name: imageRepository
    value: 'my-app'

steps:
  - script: |
      # DB_PASSWORD, API_KEY etc. from Key Vault are available as $(DB_PASSWORD)
      echo "Deploying with secrets from Key Vault..."
      # Actual values are MASKED in logs (shown as ***)
    env:
      DB_PASSWORD: $(DB_PASSWORD)   # inject KV secret as env var — never print to log
      API_KEY: $(API_KEY)
```

---

## Self-Hosted vs Microsoft-Hosted Agents

```
Microsoft-Hosted Agents:
  + No setup required
  + Always up-to-date OS/tools
  + Auto-scale
  - Start from scratch each run (slower due to full image pull)
  - Cannot access private network resources behind corporate firewall
  - Limited free minutes per month

Self-Hosted Agents:
  + Persistent — cache npm/Docker layers between runs (faster builds)
  + Can access private VNet resources (ACR via Private Endpoint, private DB)
  + Higher performance (keep pre-loaded tools)
  - You manage the VM: OS patches, agent updates, scaling
  - Run in your own Azure VNet (usually a dedicated VM or VMSS)
```

```bash
# Register a self-hosted agent (on your own Linux VM)
# Download and configure the Azure Pipelines agent
mkdir myagent && cd myagent
curl -LO https://vstsagentpackage.azureedge.net/agent/3.x.x/vsts-agent-linux-x64-3.x.x.tar.gz
tar xzf vsts-agent-linux-x64-3.x.x.tar.gz
./config.sh \
  --url https://dev.azure.com/my-org \
  --auth pat \
  --token $(PAT_TOKEN) \          # Personal Access Token from Azure DevOps
  --pool 'my-self-hosted-pool' \
  --agent $(hostname) \
  --work _work
./svc.sh install
./svc.sh start
```

---

## Interview Questions

**Q: What is the difference between a stage, job, and step in Azure Pipelines?**
> Stage: top-level grouping (Build, Test, Deploy-Staging, Deploy-Prod). Stages run sequentially by default. Can have approval gates between stages.
> Job: runs on ONE agent. Multiple jobs in a stage can run in parallel (on separate agents). A job is either a regular `job:` or a `deployment:` job (which tracks to an Environment for history/approvals).
> Step: individual unit of work within a job. Either a `script:` (shell command) or a `task:` (pre-built action like Docker@2, AzureWebApp@1). Steps in a job run sequentially on the same agent.

**Q: What is a Service Connection in Azure DevOps?**
> A Service Connection stores credentials that pipelines use to connect to external services. An ARM (Azure Resource Manager) service connection stores a Service Principal with permissions to deploy to your Azure subscription — without embedding credentials in YAML. A Docker Registry service connection stores ACR credentials. Pipelines reference service connections by name, not by credentials directly.

**Q: What is an Environment in Azure Pipelines?**
> An Environment is a logical target (e.g., "staging", "production") combined with deployment history tracking and pre-deployment checks. You can add approval gates, business hours restrictions, or required branch checks to an Environment. When a `deployment:` job targets an Environment with an approval gate, the pipeline pauses and waits for authorized approvers before continuing.

**Q: How do you roll back a failed deployment in Azure Pipelines?**
> With App Service deployment slots: run another pipeline that swaps slots in reverse (swap production back to staging). With AKS/Helm: run `helm rollback my-app <previous-revision>`. With CodeDeploy-style: re-trigger the pipeline for the last known-good commit. Best practice: keep the last N releases deployable without any code changes — just re-run the pipeline for that commit.

**Q: What is the difference between `condition: succeededOrFailed()` and `condition: always()` on a step?**
> `always()`: the step runs no matter what — even if the pipeline was cancelled. Use for cleanup steps (deleting temp resources).
> `succeededOrFailed()`: runs if the job succeeded or if some steps failed, but NOT if cancelled. Use for test result publishing — you want to publish even when tests fail so you can see which tests failed.
> `succeeded()` (default): only runs if all previous steps succeeded.

---

<a id="azure-interview-qa"></a>
## 08_interview_qa.md — Azure Fundamentals

# Azure: Comprehensive Interview Q&A

## Azure Fundamentals

**Q: What is Azure and how is it organized?**
> Azure is Microsoft's cloud platform with 200+ services for compute, storage, databases, AI, networking, DevOps, and more. Organisation hierarchy: Management Groups (for governance across multiple subscriptions) → Subscriptions (billing boundary) → Resource Groups (logical containers for related resources) → Resources (VMs, storage accounts, databases). Every resource lives in exactly one resource group and one region.

**Q: What is the difference between a Subscription and a Resource Group?**
> Subscription: billing and access control boundary. You receive one Azure bill per subscription. RBAC applied at subscription level affects all resource groups inside it. Organizations typically have subscriptions per environment (prod/staging/dev) or per business unit.
> Resource Group: logical grouping within a subscription. Used to group resources that share the same lifecycle (deploy together, delete together, share the same RBAC policy). No billing impact — it's purely organizational.

**Q: What are the main types of cloud service models (IaaS, PaaS, SaaS)?**
> IaaS (Infrastructure as a Service): you manage OS, runtime, app (e.g., Azure VMs). You rent hardware; you configure everything above it.
> PaaS (Platform as a Service): you manage only your app and data (e.g., App Service, Azure SQL, Azure Functions). Azure manages OS, runtime, patching.
> SaaS (Software as a Service): you use the software, manage nothing (e.g., Microsoft 365, Dynamics). Azure manages everything.
> Benefits of moving to PaaS vs IaaS: no OS patching, automatic scaling, less operational overhead.

---

## Identity and Security

**Q: What is Microsoft Entra ID (Azure Active Directory)?**
> Azure's cloud-based identity management service. Provides: user authentication (login), multi-factor authentication, single sign-on (SSO) across apps, app registration for OAuth 2.0/OIDC, conditional access policies, privileged identity management (JIT admin access). Every Azure subscription is backed by an Entra ID tenant.

**Q: What is Conditional Access?**
> A policy engine in Entra ID that controls access to resources based on conditions. Example conditions: user's location (block logins from outside the UK), device compliance (require Intune-compliant device), risk level (high-risk sign-in → block or require MFA). Policies are: User/Group → Condition → Grant/Block. More granular than simple MFA requirements.

**Q: What is Azure Key Vault and how do you access it from code?**
> Key Vault securely stores secrets (API keys, passwords, connection strings), certificates (TLS certs), and encryption keys. Backed by HSM (Hardware Security Module). Access is controlled via Azure RBAC (Key Vault Secrets User role to read secrets). From code: use the Azure SDK with `DefaultAzureCredential`. In production, the Managed Identity of the App Service/Function/AKS pod must have the `Key Vault Secrets User` role assigned on the vault.

```javascript
const { SecretClient } = require('@azure/keyvault-secrets');
const { DefaultAzureCredential } = require('@azure/identity');

const vaultUrl = `https://my-keyvault.vault.azure.net`;
const secretClient = new SecretClient(vaultUrl, new DefaultAzureCredential());

// Fetch a secret by name
const dbPasswordSecret = await secretClient.getSecret('db-password');
const dbPassword = dbPasswordSecret.value;
// SDK automatically uses Managed Identity when running on Azure
```

**Q: What is the difference between authentication and authorization in Azure?**
> Authentication (AuthN): verifying WHO you are. Azure AD issues tokens after verifying credentials (password, MFA, certificate).
> Authorization (AuthZ): verifying WHAT you're allowed to do. Azure RBAC checks if the authenticated identity has the required role assignment to perform the operation. Both are required: you can be authenticated but not authorized to access a specific resource.

**Q: What is Privileged Identity Management (PIM)?**
> PIM provides just-in-time (JIT) privileged access. Instead of permanently assigning the Owner or Contributor role to admins (who might forget to clean up, or whose account might be compromised), admins request elevated access for a limited time (e.g., 1 hour), provide a justification, and optionally need approval. Access expires automatically. All activations are audited.

---

## Compute

**Q: What is the difference between Azure VMs and Azure App Service?**
> Azure VM (IaaS): full control of the OS. You install software, manage patches, configure networking, scale manually. More work, more control. Use when you need a specific OS configuration, or to run software that App Service doesn't support (game servers, legacy apps).
> App Service (PaaS): managed web hosting. Deploy your code (Node.js, Python, .NET) or container. Azure manages the OS, runtime, patching, and TLS certificates. Auto-scale built-in. Use for web apps and APIs — simpler operations.

**Q: What are Azure VM Scale Sets?**
> Automatically managed groups of identical VMs. Like AWS Auto Scaling Groups. Define a VM template → Scale Set maintains N instances. Auto-scaling rules add/remove VMs based on CPU, memory, or custom metrics. Used when App Service is not appropriate (e.g., custom software, GPU workloads, high-performance batch processing).

---

## Databases

**Q: What is the difference between Azure SQL, Azure Database for PostgreSQL, and Cosmos DB?**
> Azure SQL: managed SQL Server. Use when your app already uses SQL Server, T-SQL features, or .NET Entity Framework with SQL Server provider.
> Azure Database for PostgreSQL: managed PostgreSQL. Use for open-source, cross-cloud portability, PostGIS (geographic data), and familiar PostgreSQL tooling.
> Cosmos DB: globally distributed NoSQL. Single-digit ms latency at any scale. Use for worldwide apps needing global writes (IoT, gaming, real-time profiles). Partition key design is critical.

**Q: What is point-in-time restore (PITR) in Azure databases?**
> Azure SQL and PostgreSQL Flexible Server automatically take continuous backups. PITR lets you restore the database to any specific point in time within the retention period (7–35 days). Useful for recovering from accidental data deletion or application bugs that corrupted data. You restore to a NEW database instance — the original continues running.

---

## Azure Pipelines and DevOps

**Q: Walk me through a complete Azure DevOps CI/CD pipeline for a Node.js app.**
> 1. Developer pushes code to `main` branch.
> 2. **Build stage**: Agent installs Node 20, runs `npm ci`, runs `npm test` (JUnit results published), builds Docker image tagged with Build ID, pushes to ACR, saves image URI as artifact.
> 3. **Deploy Staging stage**: Downloads artifact, deploys Docker image to App Service staging slot using `AzureWebApp@1` task. Runs smoke tests against staging URL.
> 4. **Approval Gate**: Pipeline pauses at the `production` Environment. Designated approvers receive a notification, review staging, and approve/reject in Azure DevOps.
> 5. **Deploy Production stage**: Swaps App Service staging slot with production slot (`AzureAppServiceManage@0`). Zero-downtime deployment. Old production goes to staging for quick rollback.

**Q: What is a Variable Group in Azure Pipelines?**
> A shared collection of variables (and optionally Key Vault-linked secrets) that can be referenced by multiple pipelines. Keeps sensitive values out of YAML files. Managed in Pipelines → Library. Key Vault-linked variable groups fetch secrets from Azure Key Vault at pipeline runtime — secrets never stored in Azure DevOps. Variables are masked (shown as `***`) in pipeline logs.

**Q: What is the difference between a `job` and a `deployment` in Azure Pipelines?**
> `job:` runs steps on an agent. No deployment tracking or approval gates.
> `deployment:` runs steps on an agent AND tracks deployment history in an Environment. Triggers any approval/check configured on the target Environment. Required for implementing manual approval gates. Shows a deployment history timeline in the Azure DevOps UI.

**Q: How do you implement blue-green deployment in Azure Pipelines with App Service?**
> Use App Service deployment slots: deploy new version to the staging slot (blue=prod, green=staging). Run smoke tests and integration tests against the staging slot URL. Add a manual approval gate (Environment check). After approval, use `AzureAppServiceManage@0` task with `Swap Slots` action to exchange staging and production. If issues are found post-swap, immediately swap back (instant rollback since old version is still in staging slot). No redeployment needed for rollback.

**Q: How do you speed up Azure Pipelines builds?**
> 1. Cache task caches `node_modules` based on `package-lock.json` hash — `npm ci` skips install when cache hits.
> 2. Multi-stage builds in Dockerfile reduce image size and cached layers.
> 3. Parallel jobs: split unit tests and integration tests into separate jobs that run simultaneously.
> 4. Self-hosted agents with pre-loaded tools and Docker layer cache.
> 5. Path filters on triggers skip the pipeline entirely if only docs/markdown changed.

---

## Monitoring and Operations

**Q: What is Azure Monitor and Application Insights?**
> Azure Monitor: platform for collecting metrics, logs, and traces from Azure resources (VMs, databases, App Service). Centralises all telemetry. Supports alerting on any metric.
> Application Insights: subset of Azure Monitor for application-level observability. Auto-instruments Node.js, .NET, Python apps for: request/response tracking, dependency calls (SQL, HTTP), exceptions, custom events, distributed tracing (spans across microservices). Provides Application Map showing service dependencies.

**Q: What is a Log Analytics Workspace?**
> Central store for all log data in Azure Monitor. Resources and services send logs here. You query logs using KQL (Kusto Query Language). AKS Container Insights, App Service diagnostics, NSG flow logs all write to Log Analytics. Create dashboards and alerts based on KQL queries.

**Q: How do you set up an alert for high CPU on an App Service Plan?**

```bash
# Create an alert rule: fire when average CPU > 80% for 5 minutes
az monitor metrics alert create \
  --resource-group rg-my-app-prod \
  --name alert-high-cpu \
  --scopes /subscriptions/.../serverfarms/plan-my-app-prod \
  --condition "avg Percentage CPU > 80" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action /subscriptions/.../actionGroups/email-devs \
  --description "App Service CPU exceeded 80% for 5 minutes"
```

---

## Cost Optimization

**Q: What strategies reduce Azure costs?**
> Reserved Instances: commit 1 or 3 years for up to 72% savings on VMs and databases. Use for predictable, stable production workloads.
> Spot VMs / AKS Spot Node Pools: 60-90% cheaper than on-demand for interruptible workloads (batch jobs, CI/CD agents).
> Auto-scaling: scale down during off-peak hours. App Service can scale to 1 instance at night.
> Dev/Test pricing: Microsoft offers reduced VM/SQL rates for non-production subscriptions.
> Azure Advisor: free service that analyzes your resources and recommends cost-saving actions (right-size VMs, delete unused resources).
> Lifecycle policies on storage: auto-tier blobs to Cool/Archive based on last access time.

**Q: What is the Azure Pricing Calculator?**
> A free web tool at azure.microsoft.com/pricing/calculator/ where you configure which services you plan to use (region, tier, quantity, hours/month) and get a cost estimate. Use it to compare service tiers, estimate migration costs, or budget a new project before committing any resources.

---


---

<a id="azure-scenarios"></a>
## Scenario-Based Interview Questions

---

### Scenario 1: Azure Function Cold Starts Causing SLA Violations

**Situation:** Your consumption-plan Azure Function processes payment webhooks. It occasionally takes 8 seconds to respond (cold start), violating a 3-second SLA.

**Question:** How do you fix this?

**Answer:**
- Switch to **Premium Plan** (EP1) — it supports **Pre-warmed instances** that are always running. No cold starts.
- Enable **WEBSITE_RUN_FROM_PACKAGE=1** to reduce startup time by running from a zip package.
- For .NET/Java heavy runtimes, use **Always On** if on App Service Plan.
- Implement a **warming ping** (Timer Trigger firing every 5 minutes) as a cheap workaround on consumption plan.
- Keep your function bundle small — minimise dependencies so initial load is fast.
- For Node.js Functions: use **tree-shaking** to reduce the cold-start footprint.

---

### Scenario 2: App Service Deployment Causes 60 Seconds of Downtime

**Situation:** Every deployment of your Azure App Service causes ~60 seconds where users get errors. The CI deploys directly to the production slot.

**Question:** How do you achieve zero-downtime deployments?

**Answer:**
- Use **Deployment Slots** (staging and production):
  1. Deploy to the `staging` slot.
  2. Run smoke tests against the staging URL.
  3. **Swap** staging ↔ production — Azure routes traffic instantly with no downtime.
  4. If the swap causes issues, swap back immediately.
- Enable **Auto Swap** for fully automated zero-downtime CD.
- Swap warms up the new version before routing production traffic to it.

---

### Scenario 3: Blob Storage — Sensitive Data Accessible Publicly

**Situation:** A security audit finds that a blob container used for user-uploaded documents has public access enabled. Some PDFs contain PII.

**Question:** What is your immediate response and long-term fix?

**Answer:**
- **Immediate**: Disable public access on the container (`az storage container set-permission --public-access off`).
- Rotate the Storage Account access key if it was exposed.
- Audit access logs in Azure Monitor to identify any unauthorised access.
- **Long-term architecture**:
  - Keep the container private.
  - Generate **SAS (Shared Access Signature) tokens** with short TTL (15–60 min) when users need to download.
  - Or proxy downloads through your API which verifies authorisation before issuing a redirect.
  - Enable **Azure Defender for Storage** to detect anomalous access patterns.

---

### Scenario 4: AKS Pods Cannot Pull from ACR After Cluster Upgrade

**Situation:** After upgrading your AKS cluster, all pods show `ImagePullBackOff`. The images are in Azure Container Registry.

**Question:** How do you diagnose and fix?

**Answer:**
1. `kubectl describe pod <pod>` — confirm the error is `unauthorized: authentication required`.
2. Check the AKS-ACR integration: `az aks check-acr --resource-group $RG --name $CLUSTER --acr $ACR`.
3. Common cause after upgrade: the managed identity's role assignment on ACR was not preserved.
4. Fix: re-attach the ACR to the AKS cluster: `az aks update --attach-acr <acr-name> -g $RG -n $CLUSTER`.
5. Or manually assign `AcrPull` role: `az role assignment create --assignee <kubelet-managed-identity-client-id> --role AcrPull --scope <acr-id>`.

---

### Scenario 5: Cosmos DB — Request Units Exhausted Under Peak Load

**Situation:** Your Cosmos DB account hits 100% RU/s during a product launch. Writes start returning 429 errors.

**Question:** How do you handle this immediately and architect to prevent it?

**Answer:**
- **Immediate**: Enable **Autoscale** provisioned throughput (scales 0–Nmax RU/s automatically).
- Implement **retry with exponential back-off** in your SDK — the Cosmos SDK has this built in.
- Check your queries — cross-partition queries consume significantly more RUs; ensure `partitionKey` is in the WHERE clause.
- Enable **server-side caching** (Cosmos integrated cache or Redis) for read-heavy patterns.
- **Architectural fix**: use **Autoscale** as the default; set the max RU/s based on peak load testing + 20% buffer.
- Monitor RU consumption per query in Azure Portal → Insights.

---

### Scenario 6: Azure AD Token Validation Failing After Clock Drift

**Situation:** Your API validates Azure AD JWT tokens. Occasionally tokens are rejected as expired even though users just logged in. This happens on one specific server.

**Question:** What is causing this and how do you fix it?

**Answer:**
- JWT `exp` and `nbf` claims are unix timestamps. If the server's clock is behind, a freshly-issued token may appear expired.
- **Diagnosis**: compare `date` on the server vs NTP time.
- **Fix**: sync the server clock with NTP (`timedatectl` on Linux; Windows Time Service on Windows).
- **Mitigation**: add a clock skew tolerance in your token validation library (MSAL allows configuring `clockSkewInSeconds`, typically 5 minutes).
- In AKS: ensure node VMs have NTP configured correctly — Azure VMs sync with the Azure host by default but this can be disrupted.

---

### Scenario 7: Azure DevOps Pipeline — Secrets Leaking in Logs

**Situation:** A developer accidentally prints an environment variable in a pipeline script. The value appears in the build logs visible to all project members.

**Question:** How do you prevent this?

**Answer:**
- Store secrets in **Azure Key Vault** not in pipeline variables.
- In Azure DevOps, mark pipeline variables as **Secret** — they are masked in logs automatically.
- Use the **Key Vault task** to fetch secrets at runtime and expose them as masked pipeline variables.
- Add a `[no-log]` decorator or use PowerShell's `Write-Host` with `##vso[task.setvariable variable=X;isSecret=true]` to prevent a variable from ever appearing.
- For the exposed secret: rotate it immediately, audit who had pipeline log access, check downstream systems.

---

### Scenario 8: Cost Explosion — Azure Bill 3x Normal

**Situation:** Your Azure bill triples month-over-month. The finance team escalates. You have no existing budget alerts.

**Question:** How do you investigate and prevent this?

**Answer:**
- **Azure Cost Management + Billing** → Cost Analysis → break down by Resource, Service, and Resource Group.
- Common culprits: forgotten dev VMs running 24/7, oversized App Service Plans, Egress data transfer charges, Blob storage redundancy tier.
- **Immediate**: stop/delete the over-provisioned resources.
- **Prevention**:
  - Set **Budgets** with email/callback alerts at 80% and 100% of expected spend.
  - Enable **Azure Advisor** cost recommendations.
  - Tag all resources with `Environment`, `Owner`, `Project` for cost attribution.
  - Use **Dev/Test subscription pricing** for non-production workloads.
  - Schedule auto-shutdown of dev VMs outside business hours.
