# 37 — Serverless Architecture

> **Module**: M11 — Cloud Design Patterns  
> **Section**: Additional Topics  
> **Source**: https://layrs.me/course/hld/11-cloud-design-patterns/serverless-architecture  
> **Difficulty**: Intermediate | 26 min read

---

## 1. ELI5 — Explain Like I'm 5

Think of it like a light switch. When you flip it on, the light turns on immediately. When you flip it off, it turns off — and you don't pay for electricity when the light is off.

Serverless is the same for computing: your code only runs when it's needed, you only pay for the time it actually runs, and someone else handles keeping the power on and making sure the light works.

---

## 2. The Analogy

**Serverless = Uber instead of owning a car.**

With a **traditional server** (car ownership): you pay for it 24/7 whether you're driving or not, handle maintenance, and worry about parking.

With **serverless** (Uber): you only pay when you actually need a ride, someone else handles the vehicle maintenance, and you don't think about where the car sits when you're not using it.

**Trade-off**: you can't customize the car as much, and there's a slight delay waiting for pickup (cold start). For occasional trips, Uber is cheaper; for daily commutes with specific needs, owning might make more sense.

---

## 3. Core Concept

**Serverless** is a cloud execution model where the provider dynamically allocates compute resources for your code, scales automatically, and charges only for actual execution time (typically billed in 100ms increments).

Despite the name, servers still exist — you just don't see or manage them. The provider handles: OS patching, capacity planning, high availability, and auto-scaling.

### Two Pillars:
1. **FaaS (Functions-as-a-Service)** — AWS Lambda, Google Cloud Functions, Azure Functions. Individual functions execute on-demand in response to events.
2. **BaaS (Backend-as-a-Service)** — Managed databases (DynamoDB, Firestore), auth (Auth0, Cognito), storage (S3), APIs (AppSync). No servers, usage-based pricing.

### Key Properties:
- **Event-driven**: functions execute only when triggered (HTTP req, file upload, queue message, timer)
- **Stateless execution**: each invocation is isolated; no in-memory state across invocations
- **Pay-per-use**: billed per invocation and duration; zero cost when idle
- **Bounded execution**: Lambda max 15 min, 10GB memory, 1000 concurrent by default

---

## 4. ASCII Architecture

### Serverless Execution Flow

```
Event Source: API Gateway / S3 / SQS / EventBridge
       │
       ▼ trigger
[Lambda Service] ─── check for warm container ───┐
       │                                          │
   Cold Start                               Warm Start
  (100ms–3s)                               (1–10ms)
  Allocate container                       Reuse container
  Download code package
  Init runtime (Node.js/Python)
  Run global init code
       │                                          │
       └──────────────────┬───────────────────────┘
                          │
                   [Function Code]
                          │ call external services
                    [DynamoDB / S3 / APIs]
                          │
                   Return response
                          │
              Keep container warm 5–15 min
              Billed for execution time only
```

### Stateless Architecture Pattern

```
Request 1 (Login)                 Request 2 (Get Profile)
─────────────────                 ──────────────────────
Lambda (empty memory)             Lambda (empty memory)
    │ fetch user                      │ fetch session
  [DynamoDB]                        [ElastiCache]
    │ store session                    │ fetch profile
  [ElastiCache]                     [DynamoDB]
    │                                  │
  Respond                           Respond

No shared state between invocations.
All persistence via external services.
```

---

## 5. How It Works

**Step 1: Event Trigger**
- An event occurs: HTTP request hits API Gateway, file uploads to S3, message arrives in SQS, scheduled timer fires
- Unlike traditional servers that run continuously polling, functions are dormant until triggered

**Step 2: Cold Start or Warm Invocation**
- **Cold start**: provider allocates container, downloads code, initializes runtime, runs global init (100ms–3s). Happens when function hasn't run recently.
- **Warm start**: existing container reused, skips initialization (1–10ms). Happens with steady traffic.
- Cold starts are rare at moderate traffic but hit 100% at very low traffic (< 1 req / 10 min)

**Step 3: Function Execution**
- Code runs in isolated container with allocated memory (128MB–10GB)
- CPU is proportional to memory allocation
- Execution is stateless — in-memory data disappears after function completes
- Persistent data must use external services: DynamoDB, S3, ElastiCache

**Step 4: Automatic Scaling**
- Multiple events → multiple parallel execution environments spawned automatically
- Lambda: zero to thousands of concurrent executions in seconds
- No shared state between concurrent executions
- Default concurrency limit: 1000 per region (shared across all functions in account)

**Step 5: Billing and Cleanup**
- After function returns, container kept warm 5–15 minutes (provider-dependent)
- If no new events, container destroyed
- Billed: actual execution time (100ms increments) + memory allocated

---

## 6. Variants / Types

### FaaS (Functions-as-a-Service)
- **AWS Lambda**: market leader, Node.js/Python/Java/Go/.NET/custom runtimes, max 15 min, 10GB, 1000 concurrent
- **Google Cloud Functions**: similar, integrates with GCP ecosystem
- **Azure Functions**: similar, integrates with Azure ecosystem
- **Use for**: API backends, data pipelines, automation, event processing

### BaaS (Backend-as-a-Service)
- **Databases**: DynamoDB On-Demand, Aurora Serverless, Firestore — auto-scale, per-request pricing
- **Auth**: Auth0, Cognito — managed authentication
- **Storage**: S3 — pay per GB, no servers
- **Use for**: eliminate undifferentiated heavy lifting

### Serverless Containers
- **AWS Fargate, Google Cloud Run, Azure Container Instances**
- Run Docker containers without managing cluster
- Bridges gap: longer execution (Cloud Run: 60 min), custom runtimes, no Lambda constraints
- **Use for**: existing containerized apps, longer-running jobs, keep container flexibility

### Serverless Databases
- DynamoDB On-Demand, Aurora Serverless, Firestore — capacity adjusts automatically
- Higher per-request cost vs. provisioned at sustained volume
- **Use for**: unpredictable workloads, development environments

### Edge Functions
- **Cloudflare Workers, Lambda@Edge, Vercel Edge Functions**
- Execute at CDN edge locations globally (100s of locations)
- Sub-20ms latency from anywhere; executes close to user
- Stricter constraints: 1–5MB code, 50ms–30s execution
- **Use for**: request routing, A/B testing, auth checks, response manipulation
- Shopify: edge functions for nearest-cluster routing → 30% faster page loads

---

## 7. Trade-offs

### Cold Start Latency vs. Cost Efficiency

| | Provisioned Concurrency | Accept Cold Starts |
|--|---|---|
| Latency | <10ms always | 100ms–3s on cold |
| Cost | Higher (idle capacity charged) | Lower |
| Use for | Latency-sensitive user-facing APIs | Background jobs, batch, async |
| Example | Stripe payment API | Webhook delivery |

**Cold start times by runtime**:
- Node.js / Python / Go: 100–300ms
- Java / .NET (JVM): 2–5 seconds (JVM initialization)

### Serverless vs. Traditional Servers (Cost Break-Even)

```
Lambda (512MB, 200ms avg):
  Cost/request = (0.5GB × 0.2s × $0.0000166667) + ($0.20 / 1M) = $0.0000018667

Break-even at: $30/month EC2 / $0.0000018667 per req
             = 16.07M req/month ≈ 6.2 req/sec sustained

Below 16M req/month → Lambda cheaper
Above 16M req/month → EC2 cheaper
```

### Vendor Lock-In vs. Managed Simplicity

| | Embrace Provider Ecosystem | Use Abstraction Layers |
|--|---|---|
| Development speed | Fast (use SDK directly) | Slower (abstraction overhead) |
| Portability | Low (AWS SDK calls) | Higher (Serverless Framework) |
| Feature access | Full | Reduced |
| Best for | Startups, fast time-to-market | Enterprises with multi-cloud strategy |

### Granular Functions vs. Monolithic Services

| | Many Small Functions | Coarser Functions |
|--|---|---|
| Cold starts | More (each function can cold start) | Fewer |
| Deployment | Independent | Less granular |
| Scaling | Per-function granularity | Per-service |
| Complexity | Higher (more to monitor) | Lower |
| Recommendation | Don't prematurely optimize; start coarser |  |

---

## 8. When to Use / When to Avoid

### ✅ Use Serverless When:
- **Variable / unpredictable traffic** — scales to zero, no idle costs
- **Event-driven workloads** — webhooks, file processing, queue consumers
- **Small team without DevOps** — no cluster to manage
- **Rapid prototyping** — deploy code in minutes
- **Cost optimization at low utilization** — < 30% utilization consistently

### ❌ Avoid When:
- **Sustained high-volume traffic** (> 16M req/month for Lambda vs. EC2 t3.medium) — traditional servers cheaper
- **Strict latency SLAs** (< 50ms p99 user-facing) — cold starts violate SLA, and provisioned concurrency raises cost
- **Long-running jobs** (> 15 min) — Lambda execution limit; use Fargate/ECS instead
- **Complex stateful workflows** — external state management adds latency and complexity
- **Team running stateful services in Lambda** — resist; use managed DBs

---

## 9. MERN Dev Notes (AWS Lambda / Node.js)

### Lambda Function Structure with Graceful Patterns

```javascript
// handler.js — Serverless Function
const mongoose = require('mongoose');

// Global state: initialized ONCE per container, reused across warm invocations
let dbConnection = null;

async function initDB() {
  if (dbConnection && mongoose.connection.readyState === 1) {
    return; // Reuse existing connection (warm container)
  }
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 5 // Keep small — Lambda functions are short-lived
  });
  dbConnection = mongoose.connection;
}

// Main handler — called on every invocation
exports.handler = async (event, context) => {
  // Prevent Lambda from waiting for event loop to drain
  context.callbackWaitsForEmptyEventLoop = false;
  
  try {
    await initDB(); // Fast on warm container, slow on cold
    
    const { httpMethod, path, body } = event;
    
    if (httpMethod === 'POST' && path === '/orders') {
      const order = JSON.parse(body);
      // Input validation
      if (!order.userId || !order.items) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
      }
      
      const result = await OrderModel.create(order);
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: result._id })
      };
    }
    
    return { statusCode: 404, body: 'Not found' };
    
  } catch (err) {
    console.error(JSON.stringify({ // Structured logging
      level: 'error',
      message: err.message,
      requestId: context.awsRequestId,
      path: event.path
    }));
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
```

### Idempotent Event Handler (SQS Consumer)

```javascript
// sqsHandler.js
const processedEvents = new Set(); // Only valid within same container (warm)

exports.handler = async (event) => {
  const results = [];
  
  for (const record of event.Records) {
    const { messageId, body } = record;
    const payload = JSON.parse(body);
    
    // Idempotency check: use a persistent store in production
    const dedupeKey = `${payload.orderId}-${payload.eventType}`;
    const alreadyProcessed = await ProcessedEvents.exists({ dedupeKey });
    
    if (alreadyProcessed) {
      console.log(`Skipping duplicate event: ${dedupeKey}`);
      continue;
    }
    
    try {
      await processOrderEvent(payload);
      await ProcessedEvents.create({ dedupeKey, processedAt: new Date() });
      results.push({ messageId, status: 'processed' });
    } catch (err) {
      // Don't catch — let Lambda retry (will be re-queued)
      throw err;
    }
  }
  
  return { results };
};
```

### Avoiding Distributed Monolith Anti-Pattern

```javascript
// ❌ BAD: Synchronous Lambda-to-Lambda chain (deep coupling)
// Lambda A → Lambda B → Lambda C → Lambda D
// Cold starts multiply, cascading failures, hard to debug

// ✅ GOOD: Async via SQS (decoupled)
const AWS = require('aws-sdk');
const sqs = new AWS.SQS();

exports.handler = async (event) => {
  // 1. Validate and save (sync — user waits)
  const order = await OrderModel.create(JSON.parse(event.body));
  
  // 2. Queue async work (decouple from user response)
  await sqs.sendMessage({
    QueueUrl: process.env.ORDER_QUEUE_URL,
    MessageBody: JSON.stringify({ orderId: order._id, type: 'SEND_CONFIRMATION' })
  }).promise();
  
  // 3. Return immediately — don't wait for email to send
  return { statusCode: 201, body: JSON.stringify({ orderId: order._id }) };
};
```

### Cold Start Monitoring (CloudWatch)

```javascript
// Minimal package to reduce cold start time
// package.json: use only required AWS SDK v3 modules
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
// NOT: const AWS = require('aws-sdk') — loads entire SDK

// Minimize package size: multi-stage build, only production deps
// node_modules should be <50MB; use Lambda layers for shared deps

// Log correlation ID for tracing across functions
exports.handler = async (event, context) => {
  const correlationId = event.headers?.['x-correlation-id'] || context.awsRequestId;
  
  const log = (level, message, extra = {}) => {
    console.log(JSON.stringify({
      level,
      message,
      correlationId,
      functionName: context.functionName,
      requestId: context.awsRequestId,
      timestamp: new Date().toISOString(),
      ...extra
    }));
  };
  
  log('info', 'Function invoked', { path: event.path });
  // ... function logic
};
```

---

## 10. Real-World Examples

### Netflix — Video Encoding Pipeline
- New video upload to S3 → Lambda triggers to analyze and create encoding plan
- Spawns hundreds of parallel Lambdas, each encoding a specific format (1080p H.264, 720p VP9, 4K HDR)
- **Problem**: Lambda 15-min limit → split videos into segments, process in parallel, stitch together
- **Forced optimization**: segmentation actually improved throughput (accidental benefit of constraint)
- Saves millions annually — pay only for actual encoding time vs. idle encoding clusters

### Coca-Cola — Vending Machine IoT Backend
- Hundreds of thousands of smart vending machines worldwide send telemetry to AWS IoT Core
- IoT → Lambda: validate/enrich data → update DynamoDB inventory → create restocking work order → aggregate for analytics
- Traffic: massive spikes during lunch hours, near-zero at night
- **Result**: 75% cheaper than previous server-based system (pay only during peak hours)
- Used Lambda@Edge to route machine connections to nearest regional backend

### Nordstrom — Retail Inventory System
- Lambda: check real-time inventory across all stores and warehouses, query pricing rules → return in < 100ms
- Normal traffic (10K req/min): ~$500/day
- Black Friday (500K req/min = 50× spike): ~$2,000/day — auto-scaled, no pre-provisioning, no outages
- Uses **provisioned concurrency** for critical functions during peak hours (eliminate cold starts, accept higher cost)
- **Circuit breaker**: if DynamoDB latency > 50ms, return cached inventory (accuracy-for-availability trade-off)

---

## 11. Interview Cheat Sheet

### One-Liner
> "Serverless is event-driven compute where you write functions, the provider handles all infrastructure, and you pay only for actual execution time — best for variable workloads, worst for sustained high-volume traffic."

### When Interviewers Bring This Up:
- "Design a cost-optimized architecture for variable traffic"
- "How would you process file uploads / webhook events at scale?"
- "When would you use Lambda vs. EC2 vs. Kubernetes?"

### Key Points to Hit:
1. **Event-driven execution** — functions triggered by events, not running continuously
2. **Cold start trade-off** — 100ms–3s on first invocation; mitigate with provisioned concurrency or faster runtimes
3. **Stateless** — all persistent state must live in external services
4. **Economics break-even** — ~16M req/month for Lambda vs. EC2 t3.medium
5. **Limits**: 15-min execution, 10GB memory, 1000 concurrent (default)
6. **Avoid distributed monoliths** — don't chain Lambda→Lambda synchronously; use SQS/EventBridge

### When NOT to use Serverless (important!):
- Sustained high-volume (> 30–40% server utilization)
- Strict p99 latency (< 50ms)
- Long-running jobs > 15 minutes (use Fargate)
- Complex stateful workflows

### Cold Start by Runtime:
```
Node.js / Python / Go:  100–300ms
Java / .NET:            2–5 seconds
```

### Cost Calculation:
```
Per request (512MB, 200ms): $0.0000018667
Break-even vs EC2 t3.medium: 16M req/month
1M req/month:   $1.87 Lambda vs $30 EC2   → Lambda wins
100M req/month: $186 Lambda vs $30 EC2    → EC2 wins
```

### Concurrency Formula:
```
Required concurrent executions = requests_per_sec × avg_duration_in_sec
= 1000 req/s × 0.5s = 500 concurrent
(check against account limit of 1000)
```

---

## 12. Red Flags + Keywords

### Red Flags to Avoid

❌ **"Serverless means no servers, so there's no infrastructure to manage"**
→ Servers exist; you still manage networking (VPC), security (IAM), cost, and observability

❌ **"Serverless is always cheaper than traditional servers"**
→ Wrong at high utilization (> 30–40%); always calculate the break-even for your workload

❌ **"Cold starts aren't a problem anymore"**
→ They're inherent to the model. Java functions still cold-start in 2–5s. Provisioned concurrency helps but costs more

❌ **"You can't run long-running jobs in serverless"**
→ Partially wrong: break into segments (Lambda), or use serverless containers (Fargate, Cloud Run) for longer execution

❌ **"Serverless doesn't scale well"**
→ Lambda scales aggressively to thousands of concurrent executions. The challenge is concurrency limits and downstream dependencies

### Keywords / Glossary

| Term | Meaning |
|------|---------|
| **Serverless** | Execution model where provider handles all infrastructure; pay per invocation |
| **FaaS** | Functions-as-a-Service — function execution on-demand (Lambda, Cloud Functions, Azure Functions) |
| **BaaS** | Backend-as-a-Service — managed databases, auth, storage with no server management |
| **AWS Lambda** | AWS FaaS platform; max 15 min, 10GB memory, 1000 concurrent default |
| **Cold Start** | Container initialization latency when function hasn't run recently (100ms–3s) |
| **Warm Start** | Reusing existing container; near-zero additional latency (1–10ms) |
| **Provisioned Concurrency** | Pre-warmed containers; eliminates cold starts but charges for idle capacity |
| **Stateless Execution** | No in-memory state persists across invocations |
| **Event Source** | Service that triggers Lambda: API Gateway, S3, SQS, EventBridge, etc. |
| **Concurrent Executions** | Number of Lambda invocations running simultaneously |
| **ConcurrentExecutions limit** | Default 1000/region, shared across all functions in account |
| **Execution Timeout** | Max 15 minutes for Lambda (shorter for most trigger types) |
| **Distributed Monolith** | Anti-pattern: many tightly-coupled Lambda functions chained synchronously |
| **Edge Functions** | Serverless running at CDN edge (Cloudflare Workers, Lambda@Edge) |
| **Serverless Containers** | Fargate / Cloud Run — container flexibility without cluster management |
| **Dead Letter Queue (DLQ)** | Queue where failed Lambda events land after max retries |
| **Idempotent Handler** | Same event processed multiple times → same result (critical for at-least-once delivery) |
| **VPC Lambda** | Lambda configured in VPC to access private resources; adds cold start overhead |
| **Lambda Layers** | Shared library packages across functions; reduce deployment package size |
| **Step Functions** | AWS orchestration service for complex Lambda workflows (replaces LambdaLambda chains) |
