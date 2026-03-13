# Kubernetes: Security — RBAC, ServiceAccounts, Pod Security

## Security Layers in Kubernetes

```
┌─────────────────────────────────────────────────┐
│  Who can call the API?    → Authentication       │
│  What can they do?        → RBAC Authorization   │
│  What can Pods do?        → Pod Security / PSA   │
│  What can Pods access?    → NetworkPolicy        │
│  External secrets         → Vault / ESO          │
└─────────────────────────────────────────────────┘
```

---

## RBAC — Role-Based Access Control

```
Role / ClusterRole       ← defines WHAT actions are allowed
        +
RoleBinding / ClusterRoleBinding  ← defines WHO gets those actions
```

| Resource | Scope |
|----------|-------|
| Role | One namespace |
| ClusterRole | All namespaces (or cluster-level resources like nodes) |
| RoleBinding | Binds Role OR ClusterRole to a subject in ONE namespace |
| ClusterRoleBinding | Binds ClusterRole to a subject cluster-wide |

---

## Role and RoleBinding (namespace-scoped)

```yaml
# Role: allow reading (get, list, watch) Pods and their logs in the 'staging' namespace.
# Nothing else is allowed — principle of least privilege.
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: staging
rules:
  - apiGroups: [""]                  # "" = core API group (Pods, Services, Secrets)
    resources: ["pods", "pods/log"]  # which resources
    verbs: ["get", "list", "watch"]  # which actions (no create/update/delete)

  - apiGroups: ["apps"]              # Deployment, ReplicaSet, StatefulSet
    resources: ["deployments"]
    verbs: ["get", "list"]

---
# RoleBinding: give the 'dev-team' group the 'pod-reader' role in 'staging'
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: dev-pod-reader
  namespace: staging
subjects:
  # Subject types: User, Group, ServiceAccount
  - kind: Group
    name: dev-team                    # group from your identity provider (OIDC/LDAP)
    apiGroup: rbac.authorization.k8s.io
  - kind: User
    name: alice@mycompany.com
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role                          # Role (namespace) or ClusterRole (cluster-wide)
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

---

## ClusterRole and ClusterRoleBinding (cluster-wide)

```yaml
# ClusterRole: allow reading all nodes and persistent volumes (cluster-level resources)
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cluster-reader
rules:
  - apiGroups: [""]
    resources: ["nodes", "persistentvolumes", "namespaces"]
    verbs: ["get", "list", "watch"]

---
# Bind a ClusterRole to a specific namespace's ServiceAccount
# (reuse ClusterRole definition but limit it to one namespace via RoleBinding)
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: monitoring-cluster-reader
subjects:
  - kind: ServiceAccount
    name: prometheus
    namespace: monitoring
roleRef:
  kind: ClusterRole
  name: cluster-reader
  apiGroup: rbac.authorization.k8s.io
```

---

## ServiceAccounts

```yaml
# Every Pod runs under a ServiceAccount (default: 'default' SA in its namespace).
# The 'default' SA has no special permissions — that is intentional.
# Create a dedicated SA for each workload with exactly the permissions it needs.

apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-sa
  namespace: production
  annotations:
    # AWS IRSA: link SA to an IAM Role so Pods get AWS permissions without stored keys
    eks.amazonaws.com/role-arn: "arn:aws:iam::123456789:role/api-role"
    # Azure Workload Identity: link SA to Azure Managed Identity
    azure.workload.identity/client-id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

---
# Associate the ServiceAccount with the Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  template:
    spec:
      serviceAccountName: api-sa    # Pods in this Deployment run as api-sa
      automountServiceAccountToken: true   # SA token mounted at /var/run/secrets/...
      containers:
        - name: api
          image: ghcr.io/myorg/api:1.0.0
```

---

## Pod Security Admission (PSA) — K8s 1.25+

```yaml
# PSA enforces security policies at the namespace level (replaced PodSecurityPolicy).
# Three built-in profiles:
#   privileged: no restrictions (control-plane, system namespaces)
#   baseline:   prevents most known privilege escalations
#   restricted: heavily restricted, follows current Pod hardening best practices

# Label a namespace to enforce the 'restricted' policy
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted   # reject violating Pods
    pod-security.kubernetes.io/audit: restricted     # log warnings
    pod-security.kubernetes.io/warn: restricted      # show warning to user

# Restricted policy requires:
# - runAsNonRoot: true
# - allowPrivilegeEscalation: false
# - seccompProfile: RuntimeDefault or Localhost
# - capabilities: drop ALL
```

```yaml
# A Pod that passes the 'restricted' security profile
spec:
  containers:
    - name: api
      securityContext:
        runAsNonRoot: true              # must not run as root
        runAsUser: 1001                 # specific non-root UID
        runAsGroup: 1001
        allowPrivilegeEscalation: false # cannot gain more privileges than parent
        readOnlyRootFilesystem: true    # container filesystem is read-only
        capabilities:
          drop: ["ALL"]                 # drop ALL Linux capabilities
          # Only add back what you need:
          # add: ["NET_BIND_SERVICE"]
        seccompProfile:
          type: RuntimeDefault          # apply default seccomp filter
```

---

## NetworkPolicy for security (namespace isolation)

```yaml
# Default-deny: deny all ingress and egress in 'production' namespace.
# Then explicitly allow only what's needed.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}                  # {} = applies to ALL pods in namespace
  policyTypes:
    - Ingress
    - Egress
  # No ingress/egress rules = deny everything

---
# Allow api to receive from ingress-nginx, send to postgres, send DNS
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes: [Ingress, Egress]

  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
      ports:
        - port: 3000

  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - port: 5432
    - to:
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - port: 6379
    - ports:                       # DNS must always be allowed
        - port: 53
          protocol: UDP
```

---

## RBAC Audit — test permissions

```bash
# Can 'alice' create Pods in 'production'?
kubectl auth can-i create pods --namespace=production --as=alice

# Can the 'api-sa' ServiceAccount get Secrets?
kubectl auth can-i get secrets \
  --namespace=production \
  --as=system:serviceaccount:production:api-sa

# List all permissions for the current user
kubectl auth can-i --list --namespace=production

# View RBAC for a Service Account
kubectl describe rolebinding -n production | grep -A3 "api-sa"
```

---

## Audit Logging (detect suspicious activity)

```yaml
# Enable API server audit log (set in kube-apiserver flags)
# --audit-log-path=/var/log/k8s-audit.log
# --audit-policy-file=/etc/kubernetes/audit-policy.yaml

apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  # Log all access to Secrets at Metadata level (who accessed, not the values)
  - level: Metadata
    resources:
      - group: ""
        resources: ["secrets"]

  # Log create/delete of Pods at Request level (includes full request body)
  - level: Request
    verbs: ["create", "delete"]
    resources:
      - group: ""
        resources: ["pods"]

  # Skip noisy health checks
  - level: None
    users: ["system:kube-proxy"]
    verbs: ["watch"]
    resources:
      - group: ""
        resources: ["endpoints", "services"]
```

---

## Interview Questions

**Q: What is the difference between Role and ClusterRole?**
> Role is namespace-scoped — its permissions apply only within the namespace it is created in. ClusterRole is cluster-wide — it can grant permissions on cluster-level resources (nodes, PVs) or be reused across namespaces via RoleBindings. You can bind a ClusterRole via a RoleBinding to limit it to one namespace.

**Q: What is a ServiceAccount and why should you create one per workload?**
> A ServiceAccount is an identity for Pods — it provides a token that the Pod uses to authenticate to the Kubernetes API. The 'default' SA has no permissions beyond listing basic info. Creating a dedicated SA per workload follows least privilege: you grant the api SA only what the api Pod needs (e.g., read ConfigMaps), not cluster-wide permissions.

**Q: What is IRSA on AWS EKS?**
> IAM Roles for Service Accounts. You annotate a K8s ServiceAccount with an IAM Role ARN. Pods running under that SA automatically get AWS credentials (via OIDC token exchange) without storing any access keys. The Pod can call S3, SES, Secrets Manager, etc. using the IAM Role's permissions.

**Q: What replaced PodSecurityPolicy (PSP)?**
> Pod Security Admission (PSA), introduced in K8s 1.25. Instead of a separate resource per-namespace, PSA uses namespace labels to enforce built-in profiles: `privileged`, `baseline`, or `restricted`. Much simpler than PSP. For more complex policies, OPA/Gatekeeper or Kyverno are used.

**Q: What is the principle of least privilege in Kubernetes RBAC?**
> Grant only the minimum permissions needed. Examples: a read-only dashboard SA gets only `get/list/watch` on Pods, not `create/delete`. An operator that deploys apps needs `update deployments` but not `delete namespaces`. Use `kubectl auth can-i` to verify permissions. Audit regularly with tools like `rbac-police` or `rakkess`.
