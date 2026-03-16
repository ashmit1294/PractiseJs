# AWS: SQS, SNS, and EventBridge — Event-Driven Architecture

## Why Event-Driven?

```
Instead of Service A calling Service B directly (synchronous coupling):

  [A] ──HTTP──> [B]     Problem: if B is slow/down, A is blocked too

Event-driven: A publishes an event; B processes it when ready (decoupled)

  [A] ──event──> [Queue/Topic] ──event──> [B]
           ↑                         ↑
     A doesn't know/care about B    B processes at its own pace
```

---

## SQS — Simple Queue Service

**WHAT**: How do I decouple services by queueing messages?
**THEORY**: SQS is a message queue. Producers send, consumers polled/pushed. Guarantees delivery, handles retries.

```
SQS is a fully managed message queue.
Producers send messages → SQS holds them → Consumers poll and process.

Standard Queue:
  - Nearly unlimited throughput
  - At-least-once delivery (same message might be received twice → design idempotent consumers)
  - Best-effort ordering

FIFO Queue:
  - Exactly-once processing
  - Strict first-in-first-out order (within a message group)
  - Up to 3,000 messages/sec (or 300 per API call)
```

---

## SQS — Node.js SDK Operations

```javascript
const { SQSClient, SendMessageCommand, ReceiveMessageCommand,
        DeleteMessageCommand, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');

const sqs = new SQSClient({ region: process.env.AWS_REGION });
const QUEUE_URL = process.env.SQS_QUEUE_URL;

// ── Send a message to the queue ───────────────────────────────────────────
async function sendOrderEvent(order) {
  const response = await sqs.send(new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify({       // always serialize to string
      type: 'ORDER_PLACED',
      orderId: order.id,
      userId: order.userId,
      total: order.total,
      timestamp: new Date().toISOString(),
    }),
    // MessageGroupId is required for FIFO queues — messages with the same group
    // are delivered in order and are not processed in parallel
    // MessageGroupId: `order-${order.userId}`,

    // MessageDeduplicationId prevents duplicates in FIFO queues (within 5 min window)
    // MessageDeduplicationId: order.id,
  }));
  console.log('Message queued:', response.MessageId);
  return response.MessageId;
}

// ── Receive and process messages from the queue ───────────────────────────
async function processMesages() {
  while (true) {
    const response = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 10,         // process up to 10 at once (SQS max)
      WaitTimeSeconds: 20,             // long polling — wait up to 20s for messages
      // Long polling reduces empty responses and saves API call costs compared to
      // short polling (which returns immediately whether or not there are messages)
      VisibilityTimeout: 60,           // message hidden from other consumers for 60s while processing
      // If processing takes > 60s and we don't delete the message, it becomes visible again
      // → another consumer picks it up → duplicate processing risk (design idempotently!)
    }));

    if (!response.Messages?.length) continue;  // no messages, loop again

    await Promise.all(response.Messages.map(processOneMessage));
  }
}

async function processOneMessage(message) {
  try {
    const body = JSON.parse(message.Body);
    console.log('Processing:', body.type, body.orderId);

    // ── IDEMPOTENCY CHECK ──────────────────────────────────────────────
    // SQS delivers "at-least-once" — same message can arrive twice on retries.
    // Before processing, check if we've already handled this event.
    const alreadyProcessed = await db.query(
      'SELECT 1 FROM processed_events WHERE message_id = $1', [message.MessageId]
    );
    if (alreadyProcessed.rowCount > 0) {
      console.log('Duplicate message, skipping:', message.MessageId);
      await deleteMessage(message.ReceiptHandle);   // still delete so it's not re-delivered
      return;
    }

    // Process the actual business logic
    await fulfillOrder(body.orderId);

    // Record that we processed this message
    await db.query(
      'INSERT INTO processed_events(message_id, processed_at) VALUES($1, NOW())',
      [message.MessageId]
    );

    // ── DELETE the message from queue after successful processing ──────
    // If we don't delete, the VisibilityTimeout expires and it re-appears
    await deleteMessage(message.ReceiptHandle);
  } catch (err) {
    // Don't delete the message — SQS will make it visible again after VisibilityTimeout
    // After maxReceiveCount retries, SQS moves it to the Dead Letter Queue (DLQ)
    console.error('Failed to process message, will be retried:', err);
  }
}

async function deleteMessage(receiptHandle) {
  await sqs.send(new DeleteMessageCommand({
    QueueUrl: QUEUE_URL,
    ReceiptHandle: receiptHandle,       // unique handle from ReceiveMessage call
  }));
}
```

---

## Dead Letter Queue (DLQ)

```
A DLQ is a separate SQS queue that receives messages that could NOT be
processed after maxReceiveCount retries.

[Main Queue] ──(after 3 failures)──> [DLQ]
                                          ↑
                              CloudWatch alarm triggers alert
                              Messages inspected to find bugs

Setup (Terraform):
```

```hcl
resource "aws_sqs_queue" "orders_dlq" {
  name                        = "orders-dlq"
  message_retention_seconds   = 1209600  # 14 days to investigate failed messages
}

resource "aws_sqs_queue" "orders" {
  name                        = "orders"
  visibility_timeout_seconds  = 60
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.orders_dlq.arn
    maxReceiveCount     = 3           # after 3 failed attempts, move to DLQ
  })
}
```

---

## SNS — Simple Notification Service

```
SNS is a pub/sub messaging service.
Publisher sends ONE message to a Topic.
Topic fans out to ALL subscribers simultaneously.

Fan-out pattern:
  Publisher ──> [SNS Topic]
                     ├──> SQS Queue A (processes orders for fulfillment)
                     ├──> SQS Queue B (sends email notification)
                     ├──> Lambda     (logs analytics)
                     └──> HTTP       (webhook to 3rd party)

Each subscriber independently receives the same event.
```

```javascript
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const sns = new SNSClient({ region: process.env.AWS_REGION });

// ── Publish an event to an SNS Topic ─────────────────────────────────────
async function publishOrderPlaced(order) {
  const response = await sns.send(new PublishCommand({
    TopicArn: process.env.SNS_ORDERS_TOPIC_ARN,
    Message: JSON.stringify({
      type: 'ORDER_PLACED',
      orderId: order.id,
      userId: order.userId,
      total: order.total,
    }),
    Subject: 'New Order Placed',           // used by email subscriptions as email subject
    MessageAttributes: {
      // Filter policies on SQS subscriptions can filter by these attributes
      // e.g., only route "ORDER_PLACED" events to the fulfillment queue
      eventType: {
        DataType: 'String',
        StringValue: 'ORDER_PLACED',
      },
    },
  }));
  return response.MessageId;
}
```

---

## EventBridge — Event Bus & Scheduler

```
EventBridge is a serverless event router.
Events from AWS services (EC2 state change, S3 put, CodePipeline state)
and your own applications flow into an event bus.
Rules match events by pattern and route to targets (Lambda, SQS, Step Functions).

Key choice: SQS vs SNS vs EventBridge:
  SQS  → queue for background work; consumers pull; one-to-one (or competing consumers)
  SNS  → push notification; fan-out (one-to-many); real-time subscribers
  EventBridge → rich routing rules; AWS service events; event replay; cross-account/region
```

```javascript
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

const eb = new EventBridgeClient({ region: process.env.AWS_REGION });

// ── Publish a custom event to your event bus ──────────────────────────────
async function publishEvent(detailType, detail) {
  await eb.send(new PutEventsCommand({
    Entries: [{
      EventBusName: process.env.EVENT_BUS_NAME,   // custom event bus name
      Source: 'com.myapp.orders',                  // identifies the publishing application
      DetailType: detailType,                       // used in event rules (e.g., 'OrderPlaced')
      Detail: JSON.stringify(detail),               // event payload (must be a JSON string)
      Time: new Date(),
    }],
  }));
}

// Usage:
// await publishEvent('OrderPlaced', { orderId: '123', total: 99.99 });
```

```json
// EventBridge Rule (Terraform or console):
// Routes "OrderPlaced" events from "com.myapp.orders" to a Lambda function

{
  "source": ["com.myapp.orders"],
  "detail-type": ["OrderPlaced"],
  "detail": {
    "total": [{ "numeric": [">=", 100] }]
  }
}
// The rule above routes only orders with total >= $100 to "high-value-order-handler" Lambda
```

---

## SQS Lambda Trigger (Event Source Mapping)

```javascript
// When you add SQS as a Lambda trigger, Lambda polls the queue automatically —
// no need to write polling code. Lambda receives a batch of messages as an event.

// Lambda handler for SQS trigger
exports.handler = async (event) => {
  const batchItemFailures = [];  // track which messages failed

  for (const record of event.Records) {
    // Each record is one SQS message
    const body = JSON.parse(record.body);
    try {
      await processOrder(body);
      // Successfully processed — Lambda will delete this message from queue
    } catch (err) {
      console.error('Failed:', record.messageId, err);
      // Report this message as failed — don't delete from queue
      // Only this message goes back to queue / DLQ — others still succeed
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  // Returning batchItemFailures enables "partial batch response"
  // Without this, a single failure would reprocess ALL messages in the batch
  return { batchItemFailures };
};
```

---

## Interview Questions

**Q: What is the difference between SQS, SNS, and EventBridge?**
> SQS: queue — messages wait for a consumer to pull and process them. One message goes to one consumer. Good for background jobs, work queues, rate limiting.
> SNS: topic — publisher sends once, all subscribers receive simultaneously (fan-out). Good for notifications that go to multiple systems at once.
> EventBridge: event router — routes events using rich pattern matching rules. Receives events from AWS services, your app, and SaaS apps. Best for event-driven microservice orchestration.

**Q: What is a Dead Letter Queue and why do you need one?**
> A DLQ receives messages that repeatedly failed processing (after maxReceiveCount retries). Without a DLQ, failed messages loop forever wasting compute and preventing other messages from being processed. DLQ holds them safely for investigation. You set up a CloudWatch alarm on DLQ message count to alert the team when processing failures occur.

**Q: What is SQS long polling?**
> WaitTimeSeconds between 1-20 tells SQS to wait up to 20 seconds for a message before returning an empty response. Without long polling (short polling), if there are no messages SQS responds immediately with nothing — your code keeps polling in a tight loop, wasting money on API calls. Long polling reduces costs by up to 95% for low-traffic queues.

**Q: How do you ensure idempotency in an SQS consumer?**
> SQS guarantees at-least-once delivery — the same message can arrive more than once (during retries or network issues). To handle duplicates: use the SQS MessageId as a deduplication key in a database table. Before processing, check if that MessageId was already processed. If yes, skip business logic but still delete the message. This makes processing idempotent — processing the same message twice has the same result as once.

**Q: When would you use SNS → SQS fan-out vs just SNS?**
> SNS directly invokes subscribers synchronously with retries for short duration. If you need durability (messages persist even if Lambda is down), rate control (process at your own pace), or competing consumers (multiple workers processing the same messages), add SQS between SNS and the consumer. SNS → SQS fan-out = best of both: easy fan-out + durable queued processing.
