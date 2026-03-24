# ConfigMaps, Secrets & Environment Management — Deep Theory
> **Focus:** Update propagation, immutability, encryption at rest, mounted secrets, edge cases.

---

## ELI5 — Explain Like I'm 5

Imagine your app is a vending machine.

- **ConfigMap** = The publicly visible price list on the front of the machine. You can read it without any special access. When prices change, someone updates the list.
- **Secret** = The locked cash drawer inside the machine. Only the machine (pod) has the key. The manager (Kubernetes) manages who can see inside that drawer.
- **Environment variable injection** = The prices are *printed on a sticker* inside the machine during manufacturing. Once the machine is built (pod started), **you can't change that sticker without rebuilding the machine**. A configuration change requires restarting the pod.
- **Volume mount** = A live digital display that shows the current prices. When the manager updates prices, the display changes automatically (eventually). No need to rebuild the machine.

---

## ConfigMap

Stores non-sensitive configuration data as key-value pairs. Not encrypted. Anyone with namespace read access can see it.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  # Simple key-value
  LOG_LEVEL: "info"
  MAX_CONNECTIONS: "100"
  
  # Multi-line value (file content)
  application.properties: |
    spring.datasource.url=jdbc:postgresql://db:5432/mydb
    server.port=8080
    
  nginx.conf: |
    server {
      listen 80;
      location / { proxy_pass http://app:8080; }
    }
```

---

## Secret

Stores sensitive data. Base64-encoded (NOT encrypted by default — base64 is encoding, not encryption).

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
data:
  DB_PASSWORD: cGFzc3dvcmQxMjM=   # base64("password123")
  API_KEY: c2VjcmV0a2V5           # base64("secretkey")
```

```bash
echo -n "password123" | base64          # encode
echo -n "cGFzc3dvcmQxMjM=" | base64 -d # decode
```

### Secret Types:
| Type | Use |
|---|---|
| `Opaque` | Generic key-value (default) |
| `kubernetes.io/tls` | TLS certificates (`tls.crt`, `tls.key`) |
| `kubernetes.io/dockerconfigjson` | Registry pull credentials |
| `kubernetes.io/basic-auth` | Username + password |
| `kubernetes.io/service-account-token` | SA tokens (auto-created) |
| `bootstrap.kubernetes.io/token` | Node bootstrap token |

---

## Injection Methods & Update Behaviour

### Method 1: Environment Variables

```yaml
spec:
  containers:
    - name: app
      env:
        # Direct value
        - name: LOG_LEVEL
          value: "info"
        
        # From ConfigMap key
        - name: MAX_CONNECTIONS
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: MAX_CONNECTIONS
        
        # From Secret key
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
        
      # Inject ALL keys from ConfigMap as env vars
      envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
```

**Update behaviour (env vars):**
```
ConfigMap updated in etcd
    ↓
NOTHING happens automatically

The pod keeps using the OLD value

To pick up the new value:
  → Must restart the pod (kubectl rollout restart deployment myapp)
  → Or recreate the pod
```

> **Critical interview point:** Environment variables are snapshotted at pod start time. Updating a ConfigMap does NOT update running pod env vars.

---

### Method 2: Volume Mounts

```yaml
spec:
  volumes:
    - name: config-volume
      configMap:
        name: app-config
        defaultMode: 0644
        # Optional: mount specific keys as filenames
        items:
          - key: nginx.conf
            path: nginx.conf
    
    - name: secret-volume
      secret:
        secretName: app-secrets
        defaultMode: 0400   # read-only for owner (security: secrets should be 0400)

  containers:
    - name: app
      volumeMounts:
        - name: config-volume
          mountPath: /etc/config
        - name: secret-volume
          mountPath: /etc/secrets
          readOnly: true
```

**Update behaviour (volume mounts):**
```
ConfigMap updated in etcd
    ↓
kubelet detects change (polls every syncPeriod, default 60s + some jitter)
    ↓
Kubelet updates the files in the pod's volume mount
    ↓
Files atomically replaced (via symlink swap)
    ↓
App must watch files for changes OR be restarted to pick them up
```

**The atomic update mechanism (important):**
```
/etc/config/
  ..2024_03_25_12_00_00.1234567890/   ← real directory (new data)
    nginx.conf
  ..data → ..2024_03_25_...           ← symlink to current
  nginx.conf → ..data/nginx.conf      ← symlink to file in ..data
```

When ConfigMap updates, kubelet creates a new timestamped directory and atomically swaps the `..data` symlink. This ensures no partial reads.

**Propagation delay:**
- Default: up to `kubelet syncPeriod (60s) + cache TTL` ≈ 1-2 minutes in practice
- Controlled by `--sync-frequency` on kubelet
- Use projected volumes or external secret operators for near-real-time updates

---

## Immutable ConfigMaps & Secrets

Once set immutable, the data cannot be changed — only deleted and recreated.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-v2
immutable: true   # new in K8s 1.21+
data:
  version: "2.0"
```

**Why use immutable:**
- Prevents accidental changes to configs referenced by running pods
- Kubernetes stops watching immutable objects → reduces API server load at scale (thousands of ConfigMaps)
- Forces explicit version management (create new ConfigMap, update Deployment to use it)

---

## Encryption at Rest (Secrets)

By default, Secrets are stored in etcd as **base64-encoded plaintext**. Anyone with etcd access can read them.

**Enable encryption:**
```yaml
# /etc/kubernetes/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
    providers:
      - aescbc:                    # AES-CBC encryption
          keys:
            - name: key1
              secret: <base64-encoded-32-byte-key>
      - identity: {}               # fallback (unencrypted) for existing secrets
```

```bash
# Enable in API server:
# --encryption-provider-config=/etc/kubernetes/encryption-config.yaml

# Rotate all existing secrets (force re-encryption):
kubectl get secrets --all-namespaces -o json | kubectl replace -f -
```

**Provider options:**
| Provider | Strength | Notes |
|---|---|---|
| `identity` | None | Plaintext (default) |
| `aescbc` | Strong | Static key at rest |
| `aesgcm` | Strong | Better than aescbc, no padding |
| `kms` | Strongest | Uses external KMS (AWS KMS, GCP KMS, Vault) |
| `secretbox` | Strong | XSalsa20+Poly1305 |

---

## External Secrets Management

For production, don't store secrets in Kubernetes Secrets. Use external secret managers:

### External Secrets Operator (ESO)
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-secret
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: db-credentials        # creates/updates this K8s Secret
  data:
    - secretKey: password
      remoteRef:
        key: prod/db/credentials
        property: password
```

Syncs secrets from AWS Secrets Manager / GCP Secret Manager / HashiCorp Vault → Kubernetes Secrets.

### Vault Agent Injector
```yaml
# Annotations on pod to inject Vault secrets as files:
annotations:
  vault.hashicorp.com/agent-inject: "true"
  vault.hashicorp.com/agent-inject-secret-config: "database/creds/my-role"
  vault.hashicorp.com/role: "my-app"
```

Vault injects a sidecar that writes secrets to `/vault/secrets/` and keeps them rotated.

---

## Edge Cases

### Edge Case 1: ConfigMap key doesn't exist
```yaml
- name: MISSING_KEY
  valueFrom:
    configMapKeyRef:
      name: app-config
      key: NONEXISTENT_KEY
      optional: false    # pod fails to start (default)
      # optional: true   # env var simply not set
```

### Edge Case 2: ConfigMap too large
```
ConfigMap stores entire DB seed file (10MB)
→ Hits etcd 1MB value limit → "Request entity too large" error
Solution: Use volumes / init containers that fetch large files from S3
```

### Edge Case 3: Secret in wrong namespace
```
Secret in namespace "production"
Pod in namespace "staging"
→ Pod cannot reference cross-namespace secrets
Solution: Copy secret using External Secrets Operator, or restructure namespaces
```

### Edge Case 4: Projected volumes (combine multiple sources)
```yaml
volumes:
  - name: all-in-one
    projected:
      sources:
        - configMap:
            name: app-config
        - secret:
            name: app-secrets
        - serviceAccountToken:
            path: token
            expirationSeconds: 3600
```

---

## Interview Questions

**Q: You updated a ConfigMap. Why didn't the pod pick up the new value?**
A: Depends on how the ConfigMap is consumed. If via environment variables → pods never pick up updates; must restart. If via volume mounts → updates propagate automatically after kubelet sync period (~60s), but the app must watch the file for changes.

**Q: Is base64 in Secrets secure?**
A: No. Base64 is encoding, not encryption. Anyone with `kubectl get secret` RBAC access or direct etcd access can decode it. For real security, enable encryption at rest (`--encryption-provider-config`) or use an external KMS like AWS KMS, GCP KMS, or HashiCorp Vault.

**Q: What is the advantage of immutable ConfigMaps?**
A: Prevents accidental modification of configs used by running pods. Also significantly reduces Kubernetes API server and kubelet load — the kubelet stops watching immutable objects for changes. And immutability forces explicit versioning: you create `app-config-v2` instead of updating `app-config`.

**Q: How do you rotate a secret without downtime?**
A: 1) Create new secret version (or update in external manager). 2) If external Secrets Operator: it auto-syncs the K8s Secret. 3) Mounted volume secrets update automatically (after kubelet propagation delay). 4) For env var secrets: rolling restart (`kubectl rollout restart deployment`) with enough replicas that old pods serve traffic while new ones start with the new secret.

**Q: A pod fails to start with "secret not found." What are the possible causes?**
A: 1) Secret doesn't exist in the same namespace. 2) Secret name is misspelled. 3) `optional: false` (default) and the key within the secret doesn't exist. 4) RBAC: the pod's service account doesn't have access (less common — kubelet uses node credentials, not pod SA, to mount secrets).
