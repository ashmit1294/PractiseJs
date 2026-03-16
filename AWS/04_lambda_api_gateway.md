# AWS: Lambda and API Gateway

## Lambda — Serverless Functions

**WHAT**: How do I run code without managing servers?
**THEORY**: Lambda runs functions on-demand. Pay per invocation and compute time. Scales automatically.

```
Traditional server: runs 24/7, you pay even when idle
Lambda: runs ONLY when triggered, you pay only for execution time (per 100ms)

Maximum: 15 minutes execution time, 10GB RAM, 10GB ephemeral storage (/tmp)
```

---

## Lambda Triggers (Event Sources)

| Trigger | Description |
|---------|-------------|
| API Gateway / HTTP URL | HTTP request → Lambda response |
| S3 Event | Object created / deleted in S3 |
| SQS / SNS / EventBridge | Message queue, notification, event bus |
| DynamoDB Streams | React to DB changes |
| CloudWatch Events | Scheduled (cron), CloudWatch alarms |
| Kinesis | Streaming data processing |
| Cognito | Custom authentication triggers |

---

## Basic Lambda Function (Node.js)

```javascript
// Every Lambda function has a handler function.
// AWS calls it with: (event, context)
//   event   = the trigger data (HTTP request, S3 event, SQS message, etc.)
//   context = metadata about this invocation (requestId, remaining time, etc.)

exports.handler = async (event, context) => {
  // Log the incoming event for debugging (visible in CloudWatch Logs)
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Remaining time:', context.getRemainingTimeInMillis(), 'ms');

  try {
    const result = await doWork(event);

    // For API Gateway / HTTP URL integrations, return an HTTP response object
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',   // CORS header
      },
      body: JSON.stringify({ success: true, data: result }),
    };
  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
```

---

## Environment Variables and Secrets in Lambda

```javascript
// Environment variables are set in Lambda configuration, NOT hard-coded.
// In production: use Parameter Store or Secrets Manager (not plain env vars for secrets).

// Read plain config from environment
const REGION = process.env.AWS_REGION;
const TABLE_NAME = process.env.DYNAMODB_TABLE;
const BUCKET = process.env.S3_BUCKET;

// For secrets: fetch from AWS SSM Parameter Store at cold start
// (cache it — don't fetch on every invocation)
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const ssm = new SSMClient({ region: REGION });

let cachedSecret = null;

async function getSecret() {
  if (cachedSecret) return cachedSecret;  // reuse across warm invocations

  const command = new GetParameterCommand({
    Name: '/production/api/jwt-secret',
    WithDecryption: true,   // Parameter Store SecureString uses KMS encryption
  });

  const response = await ssm.send(command);
  cachedSecret = response.Parameter.Value;
  return cachedSecret;
}
```

---

## Lambda Layers — share code across functions

```bash
# A Layer is a zip file containing shared dependencies (node_modules, utilities).
# Multiple Lambda functions can reference the same Layer — avoids code duplication.

# 1. Build the layer zip
mkdir -p nodejs/node_modules
cd nodejs && npm install axios lodash && cd ..
zip -r layer.zip nodejs/

# 2. Publish the layer
aws lambda publish-layer-version \
  --layer-name shared-utils \
  --description "Shared utilities: axios, lodash" \
  --compatible-runtimes nodejs20.x \
  --zip-file fileb://layer.zip

# 3. Attach the layer to a function
aws lambda update-function-configuration \
  --function-name myFunction \
  --layers arn:aws:lambda:us-east-1:123456789:layer:shared-utils:1
```

---

## Lambda Concurrency

```bash
# Lambda scales automatically: each request gets its own execution environment.
# Cold Start: when a new environment is created (~100ms-1s for Node.js).
# Warm Start: reuses an existing environment (<5ms overhead).

# Reserved Concurrency: LIMIT a function to N simultaneous executions.
# Useful to protect a downstream DB from being overwhelmed.
aws lambda put-function-concurrency \
  --function-name myFunction \
  --reserved-concurrent-executions 50   # max 50 simultaneous Lambda executions

# Provisioned Concurrency: PRE-WARM N environments.
# Eliminates cold starts for latency-sensitive APIs (costs more).
aws lambda put-provisioned-concurrency-config \
  --function-name myFunction \
  --qualifier production \    # must be an alias or version
  --provisioned-concurrent-executions 10
```

---

## Serverless Framework (deploy Lambda easily)

```yaml
# serverless.yml — defines functions, events, and AWS resources
service: my-api

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  stage: ${opt:stage, 'dev'}         # from CLI: --stage production
  environment:
    DYNAMODB_TABLE: ${self:service}-${self:provider.stage}-users
    NODE_ENV: ${self:provider.stage}
  iam:
    role:
      statements:
        # Grant this Lambda permission to read/write DynamoDB
        - Effect: Allow
          Action:
            - dynamodb:GetItem
            - dynamodb:PutItem
            - dynamodb:UpdateItem
            - dynamodb:DeleteItem
            - dynamodb:Query
          Resource:
            - !GetAtt UsersTable.Arn

functions:
  # HTTP endpoint: GET /users/:id
  getUser:
    handler: src/handlers/users.getUser    # exports.handler in src/handlers/users.js
    events:
      - httpApi:
          path: /users/{id}
          method: GET

  # HTTP endpoint: POST /users
  createUser:
    handler: src/handlers/users.createUser
    events:
      - httpApi:
          path: /users
          method: POST

  # Scheduled function: run every day at midnight
  dailyCleanup:
    handler: src/handlers/cleanup.run
    events:
      - schedule: cron(0 0 * * ? *)

  # S3 trigger: process images on upload
  processImage:
    handler: src/handlers/images.process
    events:
      - s3:
          bucket: my-image-bucket
          event: s3:ObjectCreated:*
          rules:
            - prefix: uploads/         # only trigger for keys starting with 'uploads/'
            - suffix: .jpg

resources:
  Resources:
    UsersTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ${self:provider.environment.DYNAMODB_TABLE}
        BillingMode: PAY_PER_REQUEST   # on-demand pricing — no capacity planning
        AttributeDefinitions:
          - AttributeName: pk
            AttributeType: S
        KeySchema:
          - AttributeName: pk
            KeyType: HASH
```

```bash
# Deploy to AWS
npx serverless deploy --stage production

# Deploy a single function (faster for quick updates)
npx serverless deploy function --function getUser --stage production

# View function logs (streams CloudWatch Logs)
npx serverless logs --function getUser --stage production --tail

# Remove all deployed resources
npx serverless remove --stage production
```

---

## API Gateway

```
API Gateway is a fully managed HTTP API frontend.
It handles: routing, authentication, rate limiting, CORS, and caching.

Types:
  REST API  = full-featured, more config, higher cost
  HTTP API  = lightweight, faster, cheaper (~70% less than REST)
  WebSocket = real-time bidirectional communication
```

```yaml
# HTTP API in Serverless Framework (see functions above — httpApi trigger)
# More explicit API Gateway config example:

functions:
  api:
    handler: src/app.handler    # Express app wrapped with serverless-http
    events:
      - httpApi:
          path: /{proxy+}       # catch-all proxy: route all paths to Express
          method: ANY
```

```javascript
// Wrap an existing Express app for Lambda — no rewrite needed!
const serverless = require('serverless-http');
const express = require('express');
const app = express();

app.use(express.json());

app.get('/users/:id', async (req, res) => {
  const user = await getUser(req.params.id);
  res.json(user);
});

// serverless-http translates API Gateway events ↔ Express req/res
module.exports.handler = serverless(app);
```

---

## Lambda Best Practices

```javascript
// 1. Initialise clients OUTSIDE the handler (reused across warm invocations)
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

// Client created ONCE at module load — reused for thousands of invocations
const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION }),
);

exports.handler = async (event) => {
  // dynamo is reused here — no new client on every call
  const result = await dynamo.send(/* ... */);
  return result;
};

// 2. Keep deployment packages small — smaller zip = faster cold start
// Use Lambda Layers for large dependencies (AWS SDK is pre-installed)

// 3. Set timeouts conservatively — default is 3s, max is 15 min
// A timeout that's too high wastes money on stuck invocations

// 4. Use structured logging — easier to query in CloudWatch Insights
const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ level, msg, ...extra, ts: new Date().toISOString() }));

log('info', 'Processing request', { userId: '123', action: 'getUser' });
```

---

## Interview Questions

**Q: What is a Lambda cold start and how do you minimise it?**
> On first invocation (or after inactivity), AWS creates a new execution environment: downloads code, initialises the runtime, runs module-level code. This can take 100ms–1s. Minimise by: using smaller zip files, keeping node_modules lean (use Rollup/esbuild to bundle), using Provisioned Concurrency for latency-critical APIs, preferring Node.js/Python (faster than Java/.NET for cold starts), and initialising SDK clients outside the handler.

**Q: What is the difference between reserved and provisioned concurrency?**
> Reserved Concurrency: caps the MAXIMUM number of simultaneous Lambda invocations. Protects downstream services (e.g., a DB) from being flooded. If the limit is hit, new requests are throttled.
> Provisioned Concurrency: pre-warms N execution environments. These are always ready — no cold start. Increases cost but eliminates latency spikes for user-facing APIs.

**Q: Why initialise SDK clients outside the Lambda handler?**
> Lambda execution environments are reused across invocations (warm starts). Code outside the handler runs once per cold start, then is cached. Creating SDK clients (HTTP connection pools) inside the handler means recreating them thousands of times per second. Initialise once outside the handler — all warm invocations reuse the same client and its connection pool.

**Q: What is the difference between REST API and HTTP API in API Gateway?**
> HTTP API is the newer, simpler, cheaper option (~70% cheaper). Supports JWT authoriser, CORS, Lambda integration, and HTTP routing. REST API adds: request/response transformations, API keys, usage plans, request validation, WAF integration, caching. Use HTTP API unless you need the advanced REST API features.

**Q: How does Lambda scale?**
> Lambda scales horizontally and automatically. Each concurrent request gets its own execution environment. With default settings, AWS can scale to thousands of concurrent executions within minutes. There is an account-level concurrency limit (default 1000 per region — increase via quota request). No capacity planning needed unlike EC2.
