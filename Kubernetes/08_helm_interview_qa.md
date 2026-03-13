# Kubernetes: Helm and Interview Q&A

## What is Helm?
Helm is the package manager for Kubernetes. It bundles all the YAML files needed
to deploy an application into a "Chart" — a reusable, parameterised template.

```
Helm Chart     = recipe (templates + default values)
Values file    = ingredients (your overrides)
Release        = a deployed instance of a chart into a cluster
```

---

## Helm Chart Structure

```
mychart/
├── Chart.yaml           ← chart metadata (name, version, description)
├── values.yaml          ← default configuration values
├── templates/           ← YAML templates with {{ .Values.xxx }} placeholders
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── hpa.yaml
│   ├── _helpers.tpl     ← reusable template snippets (not rendered as K8s objects)
│   └── NOTES.txt        ← printed to user after 'helm install'
├── charts/              ← chart dependencies (sub-charts)
└── .helmignore          ← files to exclude (like .gitignore)
```

---

## Chart.yaml

```yaml
# Describes the chart itself
apiVersion: v2                      # Helm 3 charts use v2
name: myapp
description: A production-ready Node.js API chart
type: application                   # 'application' or 'library'
version: 0.3.0                      # chart version (semver) — bump when chart changes
appVersion: "2.1.0"                 # version of the APPLICATION being deployed
keywords: [nodejs, api, microservice]
maintainers:
  - name: Alice
    email: alice@example.com
dependencies:
  # Sub-chart: pull in PostgreSQL chart from Bitnami
  - name: postgresql
    version: "13.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled   # toggle via values.yaml
```

---

## values.yaml — defaults

```yaml
# All template values are sourced from here (or overridden at deploy time)
replicaCount: 2

image:
  repository: ghcr.io/myorg/api
  pullPolicy: IfNotPresent
  tag: ""                   # when "", uses appVersion from Chart.yaml

service:
  type: ClusterIP
  port: 80
  targetPort: 3000

ingress:
  enabled: false
  className: nginx
  host: myapp.example.com
  tlsSecretName: myapp-tls

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

env:
  NODE_ENV: production
  LOG_LEVEL: info

postgresql:
  enabled: true             # enable the postgresql sub-chart dependency
  auth:
    username: myapp
    database: myapp
```

---

## templates/deployment.yaml

```yaml
# Templates use Go templating syntax.
# {{ .Values.xxx }}      reads from values.yaml
# {{ .Release.Name }}    the Helm release name (set at install time)
# {{ .Chart.Name }}      chart name from Chart.yaml
# {{ include "mychart.fullname" . }} calls a helper from _helpers.tpl

apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "mychart.fullname" . }}
  labels:
    {{- include "mychart.labels" . | nindent 4 }}    # nindent = indent + newline
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}               # only set if HPA is disabled
  {{- end }}
  selector:
    matchLabels:
      {{- include "mychart.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "mychart.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - containerPort: {{ .Values.service.targetPort }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}   # toYaml renders the map
          env:
            {{- range $key, $val := .Values.env }}
            - name: {{ $key }}
              value: {{ $val | quote }}
            {{- end }}
```

---

## templates/_helpers.tpl

```
{{/*
  _helpers.tpl defines reusable named templates.
  They are included with {{ include "mychart.xxx" . }}
  The file's name starts with _ so Helm doesn't render it as a K8s object.
*/}}

{{/* Generate the full name: release-name + chart-name, or override */}}
{{- define "mychart.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/* Common labels applied to all resources */}}
{{- define "mychart.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
```

---

## Helm CLI Commands

```bash
# ── INSTALL & UPGRADE ────────────────────────────────────────────────────────

# First-time install: release name = 'myapp-prod', chart = './mychart'
helm install myapp-prod ./mychart \
  --namespace production \
  --create-namespace \
  --values ./values.production.yaml   # override with environment-specific values

# Upgrade an existing release (applies changes)
helm upgrade myapp-prod ./mychart \
  --namespace production \
  --values ./values.production.yaml \
  --set image.tag=2.2.0               # override single value inline

# Install OR upgrade in one command (idempotent — safe to run in CI)
helm upgrade --install myapp-prod ./mychart \
  --namespace production \
  --values ./values.production.yaml \
  --atomic                            # rollback automatically if upgrade fails
  --timeout 5m                        # wait up to 5 min for rollout

# ── ROLLBACK ─────────────────────────────────────────────────────────────────

helm history myapp-prod -n production   # see revision history
# REVISION  STATUS     CHART            APP VERSION  DESCRIPTION
# 1         superseded myapp-0.1.0      2.0.0        Install complete
# 2         deployed   myapp-0.3.0      2.1.0        Upgrade complete

helm rollback myapp-prod 1 -n production   # roll back to revision 1

# ── INSPECT & DEBUG ──────────────────────────────────────────────────────────

helm list -n production                 # list all releases
helm status myapp-prod -n production    # current status
helm get values myapp-prod -n production   # see current values
helm get manifest myapp-prod -n production # see rendered YAML

# Dry-run: render templates without deploying (great for CI validation)
helm install myapp-prod ./mychart --dry-run --debug

# Lint: check chart for issues
helm lint ./mychart

# Template: render to stdout (pipe to kubectl diff for change preview)
helm template myapp-prod ./mychart --values values.production.yaml | kubectl diff -f -

# ── REPOSITORIES ─────────────────────────────────────────────────────────────

helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm search repo bitnami/postgresql
helm install my-db bitnami/postgresql --version 13.x.x
```

---

## Helm in CI/CD (Azure DevOps Pipeline)

```yaml
# azure-pipelines.yml — build, push image, deploy with Helm to AKS

trigger:
  branches:
    include:
      - main

variables:
  imageRepository: myapp
  containerRegistry: myregistry.azurecr.io
  helmChartPath: ./helm/mychart
  aksCluster: my-aks-cluster
  aksResourceGroup: my-resource-group
  namespace: production

stages:
  # ── Stage 1: Build & Push Docker Image ──────────────────────────────────
  - stage: BuildAndPush
    displayName: "Build & Push Image"
    jobs:
      - job: Build
        pool:
          vmImage: ubuntu-latest
        steps:
          - task: Docker@2
            displayName: "Build and push to ACR"
            inputs:
              containerRegistry: my-acr-service-connection   # set up in Azure DevOps
              repository: $(imageRepository)
              command: buildAndPush
              Dockerfile: Dockerfile
              tags: |
                $(Build.BuildId)
                latest

  # ── Stage 2: Run Tests ───────────────────────────────────────────────────
  - stage: Test
    displayName: "Run Tests"
    dependsOn: BuildAndPush
    jobs:
      - job: UnitTests
        pool:
          vmImage: ubuntu-latest
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: "20.x"
          - script: npm ci
            displayName: "Install dependencies"
          - script: npm test -- --reporter=junit --output=test-results.xml
            displayName: "Run unit tests"
          - task: PublishTestResults@2
            inputs:
              testResultsFormat: JUnit
              testResultsFiles: test-results.xml

  # ── Stage 3: Deploy to Staging ──────────────────────────────────────────
  - stage: DeployStaging
    displayName: "Deploy to Staging"
    dependsOn: Test
    environment: staging                  # creates an Environment in Azure DevOps
    jobs:
      - deployment: HelmDeploy
        pool:
          vmImage: ubuntu-latest
        strategy:
          runOnce:
            deploy:
              steps:
                - task: KubernetesManifest@1
                  displayName: "Set image tag"
                  inputs:
                    action: bake           # just renders the chart, not deploy yet
                    renderType: helm
                    releaseName: myapp-staging
                    helmChart: $(helmChartPath)
                    overrideFiles: helm/values.staging.yaml
                    overrides: "image.tag:$(Build.BuildId)"

                - task: HelmDeploy@0
                  displayName: "Helm upgrade --install (staging)"
                  inputs:
                    connectionType: Azure Resource Manager
                    azureSubscription: my-azure-subscription
                    azureResourceGroup: $(aksResourceGroup)
                    kubernetesCluster: $(aksCluster)
                    namespace: staging
                    command: upgrade
                    chartType: FilePath
                    chartPath: $(helmChartPath)
                    releaseName: myapp-staging
                    overrideFiles: helm/values.staging.yaml
                    arguments: >
                      --set image.tag=$(Build.BuildId)
                      --atomic
                      --timeout 5m0s

  # ── Stage 4: Manual Approval → Deploy to Production ─────────────────────
  - stage: DeployProduction
    displayName: "Deploy to Production"
    dependsOn: DeployStaging
    condition: succeeded()
    jobs:
      - deployment: HelmDeployProd
        pool:
          vmImage: ubuntu-latest
        environment: production           # 'production' environment requires manual approval
                                          # Configure approvals in: Azure DevOps → Environments → production → Approvals
        strategy:
          runOnce:
            deploy:
              steps:
                - task: HelmDeploy@0
                  displayName: "Helm upgrade --install (production)"
                  inputs:
                    connectionType: Azure Resource Manager
                    azureSubscription: my-azure-subscription
                    azureResourceGroup: $(aksResourceGroup)
                    kubernetesCluster: $(aksCluster)
                    namespace: production
                    command: upgrade
                    chartType: FilePath
                    chartPath: $(helmChartPath)
                    releaseName: myapp-prod
                    overrideFiles: helm/values.production.yaml
                    arguments: >
                      --set image.tag=$(Build.BuildId)
                      --atomic
                      --timeout 5m0s
```

---

## Helm in CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Login to Azure Container Registry
      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      # Set up kubectl context pointing to AKS
      - uses: azure/aks-set-context@v3
        with:
          resource-group: my-resource-group
          cluster-name: my-aks-cluster

      # Run helm upgrade --install
      - name: Helm deploy
        run: |
          helm upgrade --install myapp-prod ./helm/mychart \
            --namespace production \
            --create-namespace \
            --values ./helm/values.production.yaml \
            --set image.tag=${{ github.sha }} \
            --atomic \
            --timeout 5m
```

---

## Comprehensive Interview Q&A

**Q: What is the difference between kubectl apply and helm upgrade?**
> `kubectl apply` is imperative at the resource level — you manage each YAML file separately. `helm upgrade` manages ALL the resources of a release as a unit: it tracks what was deployed, diffs against the new chart, and updates/creates/deletes resources accordingly. Helm also provides rollback history, versioning, and parameterisation across environments.

**Q: What does --atomic do in helm upgrade?**
> If the upgrade fails (e.g., a Pod's readinessProbe never passes within the timeout), `--atomic` automatically rolls back the release to the previous good revision. Without it, a failed upgrade leaves the cluster in a degraded half-updated state that you must manually fix.

**Q: How do you separate environment-specific config in Helm?**
> Create separate values files per environment: `values.yaml` (defaults), `values.staging.yaml` (staging overrides), `values.production.yaml` (prod overrides). Pass with `--values` at install time. Example: `values.yaml` has `replicaCount: 1`; `values.production.yaml` overrides with `replicaCount: 5`.

**Q: What is the difference between Helm v2 and Helm v3?**
> Helm v2 required a server-side component called "Tiller" running in the cluster — a security risk (full cluster admin). Helm v3 removed Tiller entirely. All state is stored in Kubernetes Secrets in the release namespace. Authentication uses the same kubeconfig as kubectl — no separate RBAC concerns.

**Q: What are Helm hooks?**
> Hooks allow running Jobs at specific lifecycle points of a release:
> - `pre-install`: run before any resources are created (e.g., create DB user)
> - `post-install`: run after all resources are ready (e.g., seed data)
> - `pre-upgrade` / `post-upgrade`: run DB migrations before/after upgrade
> - `pre-delete`: clean up external resources before uninstall
> Defined by adding annotation: `"helm.sh/hook": pre-upgrade`

**Q: What happens to PVCs when you helm uninstall?**
> By default, PVCs are NOT deleted by `helm uninstall` — they are left behind to prevent data loss. To delete them, you must explicitly `kubectl delete pvc` or add `"helm.sh/resource-policy": keep` and manage deletion separately. This is intentional behaviour for databases.

**Q: How do you manage secrets securely with Helm?**
> Never put real secrets in `values.yaml` or commit them to Git. Options:
> 1. Use `helm-secrets` plugin (encrypts values files with SOPS/Age)
> 2. Reference K8s Secrets that are managed outside Helm (by External Secrets Operator)
> 3. Use `--set` with values from CI/CD secret variables (e.g., Azure DevOps secret variables or GitHub Actions secrets) — they are never written to disk

**Q: What is a Helm dependency / sub-chart?**
> A chart can depend on other charts (e.g., your app chart depends on the Bitnami PostgreSQL chart). Listed in `Chart.yaml` under `dependencies`. Run `helm dependency update` to download them into the `charts/` folder. Enable/disable sub-charts with a `condition` key tied to a values flag.

**Q: Explain the Kubernetes control loop pattern.**
> Kubernetes is a reconciliation engine. Every controller runs a loop:
> 1. Observe: read current state (what's deployed)
> 2. Diff: compare to desired state (what's declared in YAML)
> 3. Act: create/update/delete resources to make current = desired
> 4. Repeat forever
> This is why `kubectl apply` is idempotent — if the state is already correct, nothing changes.

**Q: What is kubectl diff and why is it useful in CI?**
> `kubectl diff -f manifest.yaml` shows what would change if you `kubectl apply` the manifest — like `git diff` but for live cluster state. In CI, combine with `helm template | kubectl diff -f -` to show reviewers exactly what K8s resources will change before merging a PR.

**Q: What is the difference between Deployment and DaemonSet?**
> Deployment: runs N replicas, scheduler picks which nodes. DaemonSet: runs exactly one Pod per node (including new nodes added later). Deployments are for application workloads. DaemonSets are for node-level infrastructure: log collectors, monitoring agents, network plugins.
