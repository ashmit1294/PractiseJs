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
