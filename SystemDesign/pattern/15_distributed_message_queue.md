# Pattern 15 — Distributed Message Queue (like Kafka)

---

## ELI5 — What Is This?

> Imagine a factory with a conveyor belt between two rooms.
> Room A (producers) puts packages on the belt.
> Room B (workers) picks packages off the belt.
> If Room B workers are busy, packages stay on the belt — they do not fall off.
> If Room B shuts down and restarts, the belt remembers where it stopped.
> The belt can have multiple lanes (partitions),
> and multiple teams of workers (consumer groups) can each read the SAME belt
> without interfering with each other.
> That is a distributed message queue — a durable, ordered, replayable conveyor belt.

---

## Glossary

| Word | ELI5 Meaning |
|---|---|
| **Topic** | A named category of messages. Like a TV channel. Producers broadcast on channel "orders", consumers tune into channel "orders". |
| **Partition** | A topic is split into N partitions (lanes). Each partition is an ordered, immutable log. Parallelism is achieved by processing different partitions simultaneously. |
| **Broker** | A Kafka server that stores and serves messages. Multiple brokers form a Kafka cluster. Like multiple warehouses storing packages. |
| **Producer** | An application that writes messages to a Kafka topic. |
| **Consumer** | An application that reads messages from a Kafka topic. |
| **Consumer Group** | A logical group of consumers. Each partition in a topic is read by exactly ONE consumer within the group. Multiple groups can read the same topic independently and at different speeds. |
| **Offset** | The position of a message in a partition. Like a page number in a book. Consumers track which offset they have processed last. On restart, they resume from their last committed offset. |
| **Leader** | For each partition, one broker is the leader. All reads and writes for that partition go to the leader. Other brokers hold replicas for fault tolerance. |
| **Replica** | A copy of a partition stored on a different broker. If the leader fails, a replica is promoted to leader. |
| **ISR (In-Sync Replica)** | A replica that is fully caught up with the leader. Only ISR replicas can be promoted to leader on failover. |
| **At-Least-Once Delivery** | Kafka guarantees every message is delivered at least once. If a consumer crashes after processing but before committing its offset, it will re-process the same message on restart. Systems must handle duplicate processing with idempotency. |
| **Exactly-Once Semantics** | A stricter guarantee: each message is processed exactly once. Achieved using Kafka transactions. Has performance overhead — used only when duplicates are unacceptable (financial transactions). |
| **Compacted Topic** | A topic that only keeps the latest value for each key. Like a key-value store on top of a queue. Old values are garbage collected, latest values are retained forever. Used for maintaining current state (like a database changelog). |
| **Lag** | How far behind a consumer group is. If the latest offset is 10,000 and the consumer is at offset 9,000, lag = 1,000 messages. High lag means the consumer cannot keep up. |
| **Dead Letter Queue (DLQ)** | A special topic where messages are sent after failing processing too many times. Like a bin for broken packages the factory cannot process. Engineers inspect it to understand what went wrong. |
| **Retention Period** | How long Kafka stores messages. Default: 7 days. After that, messages are deleted regardless of whether they were consumed. You can replay messages from any point within the retention window. |

---

## Component Diagram

```mermaid
graph TB
    subgraph PRODUCERS["Producers — Services That Write Messages"]
        ORDER_SVC["Order Service — publishes to orders topic"]
        PAYMENT_SVC["Payment Service — publishes to payments topic"]
        USER_SVC["User Service — publishes to user-events topic"]
        CLICK_SVC["Clickstream Collector — publishes to clicks topic — high volume"]
    end

    subgraph KAFKA["Kafka Cluster — 3 Brokers"]
        B1["Broker 1 — hosts partition leaders for orders-0, clicks-0, clicks-2"]
        B2["Broker 2 — hosts partition leaders for orders-1, payments-0, user-events-0"]
        B3["Broker 3 — hosts partition leaders for orders-2, clicks-1, payments-1"]
        ZK["ZooKeeper — cluster metadata, leader election (legacy) OR KRaft mode (modern)"]
    end

    subgraph TOPICS["Topics"]
        ORDERS_T["orders — 3 partitions — replication factor 3 — retention 7 days"]
        PAYMENTS_T["payments — 2 partitions — replication factor 3 — transactions enabled"]
        CLICKS_T["clicks — 6 partitions — replication factor 2 — retention 3 days"]
    end

    subgraph CONSUMERS["Consumer Groups"]
        CG1["email-notifications-cg — 3 consumers — reads orders topic"]
        CG2["inventory-cg — 3 consumers — reads orders topic — SAME topic different group"]
        CG3["fraud-detection-cg — 2 consumers — reads payments topic"]
        CG4["analytics-cg — 6 consumers — reads clicks topic — one consumer per partition"]
    end

    ORDER_SVC & PAYMENT_SVC & USER_SVC & CLICK_SVC --> B1 & B2 & B3
    B1 & B2 & B3 --> ORDERS_T & PAYMENTS_T & CLICKS_T
    ORDERS_T --> CG1 & CG2
    PAYMENTS_T --> CG3
    CLICKS_T --> CG4
    ZK --> B1 & B2 & B3
```

---

## Message Write Flow (Producer)

```mermaid
sequenceDiagram
    participant PROD as Order Service
    participant KAFKA as Kafka Broker (Leader for orders-1)
    participant REP as Kafka Broker (Replica for orders-1)
    participant CON as Inventory Consumer

    PROD->>KAFKA: ProduceRequest  topic=orders  partition=1  key=orderId  value=JSON
    Note over KAFKA: key=orderId ensures all messages for same order go to same partition
    KAFKA->>KAFKA: append message to partition-1 log  offset=50023
    KAFKA->>REP: replicate message to ISR (in-sync replica)
    REP-->>KAFKA: acknowledgement
    KAFKA-->>PROD: ResponseOK  offset=50023  partition=1
    Note over PROD: At acks=all: wait for all ISR to confirm. At acks=1: only leader confirm.

    CON->>KAFKA: FetchRequest  topic=orders  partition=1  offset=50023
    KAFKA-->>CON: message  offset=50023  orderId=ORD-9  amount=49.99
    CON->>CON: Process order — reserve inventory
    CON->>KAFKA: CommitOffset  group=inventory-cg  partition=1  offset=50024
    Note over CON: Offset committed AFTER processing. If crash before commit — reprocess same message.
```

---

## Consumer Group Partition Assignment

```mermaid
flowchart TD
    T["orders topic — 3 partitions: P0 P1 P2"]
    CG["Consumer Group: inventory-cg — currently 3 consumers: C1 C2 C3"]

    T --> C1["C1 reads P0 exclusively"]
    T --> C2["C2 reads P1 exclusively"]
    T --> C3["C3 reads P2 exclusively"]

    SCALE_UP["Scale consumer group to 4 consumers — add C4"]
    SCALE_UP --> REBAL["Rebalance triggered — brief pause in consumption ~1-2 seconds"]
    REBAL --> C1B["C1 reads P0"]
    REBAL --> C2B["C2 reads P1"]
    REBAL --> C3B["C3 reads P2"]
    REBAL --> C4B["C4 idle — no partition left to assign (partitions = 3, consumers = 4)"]

    NOTE["Rule: max useful consumers = number of partitions. Extra consumers sit idle."]
```

---

## Bottlenecks — Every Point Explained

| # | Bottleneck | Why It Hurts | Fix |
|---|---|---|---|
| 1 | **Partition count is fixed after topic creation (mostly)** | You set 3 partitions at creation. Later you want 6 to add parallelism. Adding partitions redistributes messages, breaking ordering guarantees for key-based partitioning. | Plan partition count ahead of time. Rule of thumb: throughput MB/s divided by consumer throughput MB/s. Over-provision (12 partitions is fine even if you only need 3 now). |
| 2 | **Consumer lag accumulates during traffic spikes** | Marketing blast triggers 1M order events in 5 minutes. Consumer processes 100 messages/second. The lag grows 10x faster than it shrinks. | Scale out consumer group: add more consumers (up to the partition count). Set up auto-scaling triggered by consumer group lag metric from Kafka. |
| 3 | **Hot partitions when all messages use the same key** | If every order has key="FLASH_SALE_2026", all messages route to partition 0. Partition 0 gets 100% of the load; partitions 1 and 2 sit idle. | Distribute keys: use orderId as key (naturally random). For truly keyless messages: use round-robin partitioner. |
| 4 | **Rebalance pauses consumer processing** | Every time a consumer joins or leaves a consumer group, Kafka pauses ALL consumers in the group for 1-2 seconds to reassign partitions. Frequent restarts = frequent pauses = increased lag. | Use static group membership (group.instance.id). Kafka waits longer before triggering rebalance when a known consumer goes offline temporarily, avoiding rebalances for brief pod restarts. |
| 5 | **Disk fills up if consumers fall behind** | If consumers stop processing, Kafka keeps accumulating messages on disk. With 100 MB/s of writes and 7-day retention, this is 60 TB of disk needed per broker (worst case). | Set size-based retention (log.retention.bytes) as a safety cap. Alert when consumer lag exceeds a threshold. Scale consumers to clear the backlog. |

---

## What Happens When Each Part Fails?

```mermaid
flowchart TD
    F1["Broker Crashes — Leader for 3 Partitions Goes Down"]
    F2["Consumer Crashes Mid-Processing — Offset Not Committed"]
    F3["Producer Gets Network Timeout — Does Not Know If Message Was Written"]
    F4["Poison Pill Message — Consumer Crashes Every Time It Processes Offset 50023"]
    F5["ZooKeeper Cluster Loses Quorum — Cluster Metadata Unavailable"]

    F1 --> R1["Partition leader election happens automatically.
    Replication factor 3 means each partition has 2 replicas on other brokers.
    Kafka controller (another broker) detects leader is offline within 10-30 seconds.
    It promotes one of the In-Sync Replicas (ISR) to the new leader.
    Producers and consumers transparently reconnect to the new leader.
    No messages are lost IF acks=all was used — all ISR replicas confirmed the write.
    Downtime during failover: 10-30 seconds of reduced/unavailable writes to those partitions.
    If acks=1 was used: messages acknowledged only by the (now dead) leader may be lost."]

    F2 --> R2["At-least-once semantics means the consumer reprocesses the unacknowledged message.
    Example: consumer read offset 50023, started processing, then crashed.
    On restart, the consumer sees its last committed offset is 50022.
    It re-fetches and reprocesses offset 50023.
    The downstream system (e.g. inventory DB) must handle this duplicate.
    Solution: idempotency — before decrementing inventory, check if orderId was already processed.
    If already processed: skip the operation, acknowledge the Kafka message, move on.
    Exactly-once semantics (Kafka Transactions) eliminates this but adds ~20% latency overhead."]

    F3 --> R3["Producer sent ProduceRequest but got no response (network timeout).
    Producer does not know if the message was written or not.
    Producer retries with the same message.
    If the original message WAS written: Kafka now has a duplicate.
    Solution: enable producer idempotency (enable.idempotency=true).
    Each producer gets a unique ProducerId. Each message gets a sequence number.
    If Kafka sees a duplicate ProducerId + seqNum combination, it silently drops the duplicate.
    This guarantees exactly-once write semantics at the producer level with zero extra configuration."]

    F4 --> R4["A message with malformed JSON or an unexpected field causes the consumer to throw an exception.
    Consumer crashes, restarts, reads the same offset, crashes again. Infinite loop.
    This is called a 'poison pill' message.
    Solution: Dead Letter Queue.
    Configure consumer: after 3 failed attempts at processing an offset, publish the message
    to a separate topic 'orders-dlq' with metadata (original offset, error message, timestamp).
    Then commit the offset and continue processing the next message.
    Operations team monitors the DLQ topic.
    Engineers inspect the bad message, fix the consumer code, and replay the DLQ messages."]

    F5 --> R5["ZooKeeper stores Kafka cluster metadata: which broker is controller, partition leaders, ISR lists.
    If ZooKeeper loses quorum (majority of its nodes fail), Kafka cannot elect new leaders.
    Existing partition leaders CONTINUE to work — read and write to established partitions still function.
    Only leader elections and partition rebalancing are blocked until ZooKeeper recovers.
    Modern fix: KRaft mode (Kafka Raft Metadata mode) introduced in Kafka 2.8+.
    KRaft embeds the metadata consensus protocol directly in Kafka brokers — NO ZooKeeper needed.
    Kafka cluster manages its own leader election using a Raft log.
    KRaft reduces operational complexity and eliminates ZooKeeper as a dependency."]
```

---

## How It All Works Together

Think of Kafka as a giant post office with multiple sorting conveyor belts (partitions).

When the **Order Service** places a new order, it drops a note (message) onto the "orders" conveyor belt. The note is labelled with the order ID (partition key), which determines which lane of the belt it goes on. Lane 1 for all orders by user A, lane 2 for user B, etc.

The **Inventory Service** and **Notification Service** are two completely separate mail rooms. Both are subscribed to the "orders" belt but in separate consumer groups. Each mail room picks up the same notes independently, at its own pace, without interfering with the other. The belt does not remove a note just because one mail room read it — the note stays until the retention period (7 days).

If the **Inventory mail room** gets overwhelmed, it falls behind (lag increases). Simply adding more workers (consumers) to that mail room speeds it up, as long as you have enough belt lanes (partitions) to divide the work.

If a worker crashes mid-process, the belt remembers exactly where that worker stopped (offset). On restart, the worker picks up from the same spot — no messages fall through the gaps.

---

## ELI5 — Explain to a 5-Year-Old

> **Topic** = A TV channel. Producers are the broadcasting station. Consumers are the TVs watching that channel.
>
> **Partition** = The same channel available on multiple remotes. Channel 1 on TV-A, Channel 1 on TV-B, same show but in separate rooms.
>
> **Offset** = Your page number in a book. Even if you close the book and open it later, you start from where you left off.
>
> **Consumer Group** = A class of students. Each student reads a different chapter of the same textbook. Together the class covers the whole book faster than one student could.
>
> **Replication** = Photocopying important homework so your locker, your house, and your backpack each have a copy. If one burns, the others survive.
>
> **Lag** = Your homework inbox getting full. You have 100 assignments piling up. You need to work faster to catch up.
>
> **Dead Letter Queue** = The "too hard" pile. Assignments you could not solve after 3 tries go into a special folder so the teacher can review them separately.

---

## Tradeoffs

| Decision | Option A | Option B | When to Pick A | When to Pick B |
|---|---|---|---|---|
| **acks setting** | acks=all — wait for all ISR to confirm (no data loss, slower) | acks=1 — only leader confirms (faster, risk of loss on leader fail) | Financial events, orders — correctness critical | High-volume analytics, clickstream — losing a click is acceptable |
| **Retention** | Long retention (7-30 days) — replay historical data | Short retention (1 day) — save disk space | Event sourcing, debugging, reprocessing | High-volume telemetry where storage cost dominates |
| **Partition count** | Many partitions (12-100) — high parallelism | Few partitions (1-3) — simple, strict ordering | High-throughput pipelines | Workloads requiring strict global ordering across all messages |
| **Exactly-once (Kafka transactions)** | Enabled — no duplicate processing | Disabled (at-least-once) — idempotent consumers handle duplicates | Payment processing, inventory decrement | Email notifications, analytics — duplicates are harmless |
| **Sync vs async consumer commit** | Manual commit after processing (at-least-once) | Auto-commit on receive (at-most-once) | All cases where data correctness matters | Telemetry where losing some events is acceptable |
| **ZooKeeper vs KRaft** | KRaft mode (Kafka 2.8+) — no external dependency | ZooKeeper (legacy) — proven, widely understood | New deployments — simpler ops | Existing clusters — migration has risk |

---

## Cross Questions

**Q1: Why not just use a database (Postgres) as a message queue?**
> A database can work for low volume (<1000 msgs/sec) via SELECT + DELETE patterns, but it breaks down at scale. Every select is a table scan unless perfectly indexed, concurrent writers block each other, and you cannot have multiple consumer groups reading the same message independently without complex duplication. Kafka is purpose-built for this: sequential disk writes (fast), immutable log (replay), and consumer group tracking. The append-only log means Kafka writes at disk I/O speed — orders of magnitude faster than random-access database writes.

**Q2: How do you ensure message ordering across the entire topic, not just per partition?**
> Kafka only guarantees ordering within a single partition. To order across the entire topic, use exactly 1 partition — but then you have 1 consumer and no parallelism. Usually, the design choice is to rethink the requirement: do you need ALL orders globally ordered, or do you need all orders for a specific user ordered? Ordering per user is achievable: partition key = userId ensures all messages for user A are in partition 1, always in order.

**Q3: What happens if you have 6 consumers but only 3 partitions?**
> 3 consumers are assigned one partition each and actively process messages. The remaining 3 consumers sit idle as "hot standbys". They consume zero extra resources from the Kafka side but the consuming application instances are running doing nothing. This is not inherently bad — it gives instant failover capacity. When a partition's consumer crashes, the idle consumer is immediately reassigned that partition.

**Q4: How would you handle a "thundering herd" restart where all consumers start at once?**
> When all consumers restart simultaneously (e.g., rolling deploy finishes), they all try to join the consumer group at the same time. Kafka triggers multiple rebalances in succession, each one pausing processing. Use static membership (`group.instance.id`) per consumer: Kafka waits the full session timeout before triggering rebalance for a consumer whose ID it already knows, avoiding rebalances for brief restarts. Stagger pod restarts in Kubernetes with `maxUnavailable: 25%` in rolling update config.

**Q5: When would you use Kafka vs SQS vs RabbitMQ?**
> **Kafka**: High throughput (millions msgs/sec), message replay, multiple independent consumer groups, log-based event sourcing. **SQS**: Simple point-to-point, managed by AWS, no operational overhead, best for AWS-native workloads, no replay needed. **RabbitMQ**: Complex routing (fanout, topic exchange, priority queues), low-latency delivery, workloads under ~50k msgs/sec. Rule of thumb: Kafka when you need replay or multiple readers; SQS for simple decoupling in AWS; RabbitMQ for complex routing logic.

---

## Key Numbers

| Metric | Value |
|---|---|
| Kafka throughput per broker | Up to 1 GB/s (write) with fast disks |
| Default message retention | 7 days |
| Replication factor recommended | 3 (min 2) |
| Min ISR for write availability | 2 (with RF=3) |
| Partition leader failover time | 10-30 seconds |
| Consumer group rebalance pause | 1-3 seconds |
| Exactly-once overhead vs at-least-once | ~20% latency increase |
| max.poll.records default | 500 records per fetch |
