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

**Q: What is Azure AD (Entra ID) based authentication with Function App middleware and RBAC?**
> Azure AD (rebranded Microsoft Entra ID) is the identity/access management service. Integration with Azure Functions uses OAuth 2.0 and OpenID Connect (OIDC). Requests include a Bearer JWT token from Entra ID in the Authorization header. Function middleware validates the token signature using Entra ID's public key endpoint.
> 
> **Authentication flow:**
> 1. Client/app obtains JWT token from Entra ID (`https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`)
> 2. Client sends HTTP request to Function: `Authorization: Bearer eyJhbGc...` (JWT token)
> 3. Function middleware intercepts, validates token signature and expiration against Entra ID's certificate
> 4. On success, claims extracted from JWT (user ID, roles, groups) populated in `HttpContext.User`
> 5. Function code checks `User.IsInRole("Admin")` or `User.HasClaim("roles", "Admin")` for authorization
> 
> **Configuration:**
> - Register the app in Entra ID → get Application ID and Credentials
> - Configure Function App authentication: Azure Portal → Authentication → Entra ID provider
> - Middleware automatically enforces token validation on every incoming request
> - Invalid/missing tokens → 401 Unauthorized; unauthorized roles → 403 Forbidden
> 
> **RBAC pattern (Role-Based Access Control):**
> - Define App Roles in Entra ID app manifest: `["Admin", "Editor", "Viewer"]`
> - Assign users/groups/service principals to roles via Entra ID
> - Function receives role claims in the JWT token (no extra API call needed)
> - Authorize via `[Authorize(Roles = "Admin")]` attribute or `User.IsInRole("Admin")` check
> 
> **Code example (C# Azure Function with Entra ID):**
> ```csharp
> [FunctionName("GetSecretData")]
> [Authorize(Roles = "Admin")]  // ← Blocks non-admin automatically
> public static IActionResult Run(
>     [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = null)] HttpRequest req,
>     ILogger log,
>     ClaimsPrincipal principal)
> {
>     // Middleware already validated JWT token
>     var userId = principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
>     var roles = principal?.FindAll("roles").Select(c => c.Value);
>
>     if (!principal?.IsInRole("Admin") ?? false)
>         return new UnauthorizedResult();  // 403 Forbidden
>
>     // Admin-only logic here
>     return new OkObjectResult(new { message = "Admin access granted" });
> }
> ```
> 
> **Best practices:**
> - Use Managed Identity (Azure-native service account) for Function → Key Vault → avoid storing credentials in code
> - Token validation done once by middleware → no repeated checks
> - Log authentication failures; audit Entra ID sign-in logs for suspicious patterns
> - Implement token refresh for long-running functions using MSAL libraries

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
