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
