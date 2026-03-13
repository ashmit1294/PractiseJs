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
