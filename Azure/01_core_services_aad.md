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
