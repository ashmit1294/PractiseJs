# Kubernetes: ConfigMaps and Secrets

## Why configuration management matters
Hard-coding config values in container images is an anti-pattern:
- An image built with `NODE_ENV=staging` cannot be promoted to production
- Database passwords in images are a security failure
- Changing any config requires a full image rebuild

ConfigMaps and Secrets let you separate configuration from the container image.
The same image runs in dev, staging, and production — only the config changes.

---

## ConfigMap — non-sensitive configuration

```yaml
# ConfigMap stores arbitrary key-value pairs or entire config files.
# Use for: environment names, feature flags, app config files, URLs.
# DO NOT use for passwords, tokens, or certificates.
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
  namespace: production
data:
  # Simple key-value pairs → injected as environment variables
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "3000"
  REDIS_HOST: "redis.production.svc.cluster.local"
  MAX_CONNECTIONS: "100"

  # Multi-line value → mount as a file
  app.json: |
    {
      "featureFlags": {
        "newCheckout": true,
        "darkMode": false
      },
      "rateLimits": {
        "api": 1000,
        "auth": 10
      }
    }

  # nginx.conf example — mount into nginx container as a file
  nginx.conf: |
    server {
      listen 80;
      location / {
        proxy_pass http://api:3000;
      }
    }
```

---

## Secret — sensitive configuration

```yaml
# Secrets are like ConfigMaps but for sensitive data.
# Values MUST be base64 encoded (this is encoding, NOT encryption).
# In production: use sealed-secrets, External Secrets Operator, or Vault.
apiVersion: v1
kind: Secret
metadata:
  name: api-secret
  namespace: production
type: Opaque                       # generic secret; other types: kubernetes.io/tls, kubernetes.io/dockerconfigjson

data:
  # echo -n 'mypassword' | base64  → bXlwYXNzd29yZA==
  DATABASE_PASSWORD: bXlwYXNzd29yZA==
  JWT_SECRET: c3VwZXJzZWNyZXRrZXk=
  API_KEY: YWJjMTIzZGVmNDU2

stringData:                        # alternative: plain text (K8s base64-encodes it for you)
  DATABASE_URL: "postgresql://admin:mypassword@postgres:5432/myapp"
  # stringData is WRITE-only — kubectl get secret still shows base64
```

---

## Injecting ConfigMap as environment variables

```yaml
# Method 1: envFrom — inject ALL keys as env vars at once
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  template:
    spec:
      containers:
        - name: api
          image: ghcr.io/myorg/api:1.0.0
          envFrom:
            - configMapRef:
                name: api-config       # injects NODE_ENV, LOG_LEVEL, PORT, ... 
            - secretRef:
                name: api-secret       # injects DATABASE_PASSWORD, JWT_SECRET, ...
          # All keys become environment variables in the container.
```

```yaml
# Method 2: Individual env vars — explicit, safer (avoids accidentally injecting extras)
          env:
            - name: NODE_ENV           # env var name inside the container
              valueFrom:
                configMapKeyRef:
                  name: api-config     # ConfigMap name
                  key: NODE_ENV        # specific key to use

            - name: DB_PASSWORD        # env var name can differ from secret key
              valueFrom:
                secretKeyRef:
                  name: api-secret
                  key: DATABASE_PASSWORD
                  optional: false      # fail hard if Secret/key doesn't exist
```

---

## Mounting ConfigMap as files inside a container

```yaml
# Useful for config files (nginx.conf, app.json, .env).
# The container reads them from the filesystem, not environment variables.
spec:
  containers:
    - name: api
      image: ghcr.io/myorg/api:1.0.0
      volumeMounts:
        - name: config-vol
          mountPath: /app/config        # config files appear here
          readOnly: true               # config should be read-only

  volumes:
    - name: config-vol
      configMap:
        name: api-config
        # Optional: only mount specific keys (not all of them)
        items:
          - key: app.json              # take this key from ConfigMap
            path: app.json             # create this filename in mountPath
          - key: nginx.conf
            path: nginx.conf
```

---

## Mounting Secrets as files

```yaml
# TLS certificates are best mounted as files, not env vars
spec:
  containers:
    - name: api
      volumeMounts:
        - name: tls-cert
          mountPath: /etc/ssl/certs
          readOnly: true

  volumes:
    - name: tls-cert
      secret:
        secretName: api-tls-secret     # Secret containing tls.crt and tls.key
        defaultMode: 0400              # owner read-only (chmod 400)
```

---

## TLS Secret

```bash
# Create TLS secret from certificate files
kubectl create secret tls api-tls-secret \
  --cert=server.crt \
  --key=server.key \
  --namespace=production

# The Secret contains two keys: tls.crt and tls.key
```

---

## External Secrets Operator (production best practice)

```yaml
# Problem: storing plain base64 Secrets in Git is insecure.
# External Secrets Operator syncs secrets FROM a secret store (AWS SSM,
# Azure Key Vault, HashiCorp Vault, GCP Secret Manager) INTO K8s Secrets.
# Your Git repo never contains actual secret values.

# 1. Define where secrets come from
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: production
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:                          # use IRSA (IAM Role for Service Account)
          serviceAccountRef:
            name: external-secrets-sa

---
# 2. Define which secrets to fetch and how to map them to K8s Secret keys
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: api-external-secret
  namespace: production
spec:
  refreshInterval: 1h               # re-sync from source every 1 hour
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore

  target:
    name: api-secret                # creates/updates this K8s Secret
    creationPolicy: Owner

  data:
    - secretKey: DATABASE_PASSWORD   # key name in K8s Secret
      remoteRef:
        key: production/api          # path in AWS Secrets Manager
        property: db_password        # JSON key inside the secret value

    - secretKey: JWT_SECRET
      remoteRef:
        key: production/api
        property: jwt_secret
```

---

## Azure Key Vault integration (Azure-specific)

```yaml
# Use Azure Key Vault Provider for Secrets Store CSI Driver
# OR External Secrets Operator with Azure provider
# Secret values are fetched directly from Azure Key Vault and mounted as K8s Secrets

# Using External Secrets Operator with Azure Key Vault:
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: azure-key-vault
  namespace: production
spec:
  provider:
    azurekv:
      tenantId: "your-tenant-id"
      vaultUrl: "https://my-vault.vault.azure.net"
      authType: WorkloadIdentity     # recommended: no credentials stored in cluster
      serviceAccountRef:
        name: workload-identity-sa

---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: api-secret
  namespace: production
spec:
  refreshInterval: 30m
  secretStoreRef:
    name: azure-key-vault
    kind: SecretStore
  target:
    name: api-secret
  data:
    - secretKey: DATABASE_PASSWORD
      remoteRef:
        key: api-db-password         # secret name in Azure Key Vault
    - secretKey: JWT_SECRET
      remoteRef:
        key: api-jwt-secret
```

---

## kubectl Commands

```bash
# ConfigMaps
kubectl create configmap api-config --from-literal=NODE_ENV=production
kubectl create configmap api-config --from-file=app.json=./config/app.json
kubectl get configmap api-config -o yaml
kubectl edit configmap api-config      # live edit (not recommended for production)

# Secrets
kubectl create secret generic api-secret \
  --from-literal=JWT_SECRET=mysupersecretkey \
  --from-literal=DATABASE_PASSWORD=mypassword

kubectl get secret api-secret -o jsonpath='{.data.JWT_SECRET}' | base64 --decode

# View all secrets in namespace (shows names, not values)
kubectl get secrets -n production

# Delete and recreate (for rotations)
kubectl delete secret api-secret
kubectl apply -f secret.yaml
```

---

## Interview Questions

**Q: What is the difference between ConfigMap and Secret?**
> Both store key-value config for Pods. Secrets are intended for sensitive data: they are stored separately in etcd and can be encrypted at rest (with proper cluster config). The key difference is intent and access control — you can RBAC-restrict access to Secrets separately. In practice: ConfigMap for non-sensitive config, Secret for passwords/tokens/certs.

**Q: Are Kubernetes Secrets secure by default?**
> By default: no. Values are base64-encoded (not encrypted), stored in etcd in plain text, and visible to anyone who can `kubectl get secret`. For real security: enable etcd encryption at rest, use RBAC to restrict Secret access, and ideally use External Secrets Operator to store actual values in AWS Secrets Manager / Azure Key Vault and never commit secrets to Git.

**Q: What is the difference between envFrom and individual env.valueFrom?**
> `envFrom.configMapRef` injects ALL keys from a ConfigMap as environment variables in one line. `env.valueFrom.configMapKeyRef` lets you inject specific keys and rename them. Use `envFrom` for convenience, individual `env` for precision — especially to avoid accidentally exposing unrelated keys.

**Q: What is External Secrets Operator and why use it?**
> It's a Kubernetes operator that syncs secrets from external vaults (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault) into K8s Secrets automatically. Benefits: no secret values in Git, automatic rotation (re-syncs on interval), centralised secret management across clusters, full audit trail in the provider.

**Q: How do you handle secret rotation in Kubernetes?**
> With External Secrets: the operator re-fetches the secret on each `refreshInterval` and updates the K8s Secret. Then Pods need to either restart (to pick up new env vars) or read the file from a mounted volume (volume mounts reflect updates automatically within ~1 minute without a restart).
