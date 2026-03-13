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
