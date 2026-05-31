---
title: "Kafka Interview Preparation for Node.js Developers Revision"
category: "Interview-Prep"
domain: "Backend"
difficulty: "Advanced"
status: "active"
created: "2026-05-31"
last_updated: "2026-05-31"
last_reviewed: "2026-05-31"
tags:
  - kafka
  - nodejs
  - interview-revision
  - backend
  - microservices
  - system-design
source:
  - "ChatGPT conversation"
---

# Kafka Interview Preparation for Node.js Developers Revision

## 1. One-Line Definition

Kafka is a distributed event streaming platform used as a durable, scalable, fault-tolerant event backbone between systems.

---

## 2. Core Mental Model

Kafka is not just a queue.

Kafka is a:

```text
Distributed append-only event log
```

Messages are not deleted after consumption. They remain until retention or compaction removes them.

---

## 3. Why Kafka Exists

Kafka solves:

- Tight coupling between services
- Slow synchronous APIs
- Database polling
- High-throughput event distribution
- Replay of past events
- Multiple independent consumers

Example:

```text
Order Service
   ↓
Kafka
   ↓
Payment / Inventory / Notification / Analytics
```

---

## 4. Kafka vs REST

| REST                           | Kafka                                          |
| ------------------------------ | ---------------------------------------------- |
| Synchronous                    | Asynchronous                                   |
| Direct service dependency      | Decoupled                                      |
| Caller waits                   | Event published and processed later            |
| Harder to scale many consumers | Many consumer groups can process independently |

Use Kafka when services need to react to events independently and asynchronously.

---

## 5. Kafka vs RabbitMQ

| Kafka                              | RabbitMQ                  |
| ---------------------------------- | ------------------------- |
| Event streaming                    | Message queue             |
| Stores events for retention period | Usually removes after ack |
| Replay support                     | Limited replay            |
| High throughput                    | Usually lower throughput  |
| Great for event pipelines          | Great for task queues     |

RabbitMQ can have multiple consumers and can persist messages, but Kafka is designed around durable event logs.

---

## 6. Key Concepts

### Broker

Kafka server.

### Topic

Logical stream of events.

### Partition

Physical split of topic. Provides parallelism and ordering boundary.

### Offset

Position of a message inside a partition.

### Producer

Publishes events.

### Consumer

Reads events.

### Consumer Group

Set of consumers sharing topic partitions.

### ISR

In-sync replicas eligible for leader election.

---

## 7. Partition Rules

Most important rule:

```text
One partition can be assigned to only one consumer within the same consumer group.
```

But the same partition can be read by different consumer groups.

Example:

```text
orders P0

payment-group      -> Consumer A
analytics-group    -> Consumer B
audit-group        -> Consumer C
```

Allowed.

Inside same group:

```text
payment-group:
Consumer A and Consumer B both reading P0
```

Not allowed.

---

## 8. Ordering Guarantee

Kafka guarantees order only inside a partition.

```text
P0:
Offset 0
Offset 1
Offset 2
```

No global ordering across partitions.

To preserve ordering for a customer:

```js
key = customerId;
```

Same key goes to same partition.

---

## 9. Partition Selection

Kafka uses:

```text
hash(key) % numberOfPartitions
```

If key is provided.

If no key is provided, Kafka distributes messages for load balancing.

### Important

If partitions are increased later:

```text
hash(key) % 3
```

may become:

```text
hash(key) % 6
```

Same customer may start going to a different partition.

Plan partition count carefully.

---

## 10. Consumer Groups

Same group = work shared.

Different groups = each group gets all messages independently.

```text
orders-topic
   |
   +--> payment-group
   +--> notification-group
   +--> analytics-group
```

Each group has its own offsets.

---

## 11. Rebalancing

Rebalancing means Kafka redistributes partitions among consumers.

Triggers:

- Consumer joins
- Consumer leaves
- Consumer crashes
- Session timeout
- Partition count changes

During rebalance, processing may pause or partially pause depending on rebalance strategy.

---

## 12. Heartbeats and Crash Detection

Kafka does not receive a “crashed” signal from a failed consumer.

Consumers send heartbeats.

If heartbeats stop beyond `session.timeout.ms`, Kafka assumes the consumer is dead and rebalances.

Kafka cannot distinguish:

- Crash
- Freeze
- Network issue
- Long pause

It only detects missing heartbeats.

---

## 13. Kubernetes Rolling Deployment

During rolling deployment:

1. New pod starts.
2. New consumer joins.
3. Rebalance happens.
4. Old pod terminates.
5. Old consumer leaves.
6. Another rebalance happens.

Best practices:

- Handle `SIGTERM`
- Call `consumer.disconnect()`
- Use cooperative rebalancing
- Avoid frequent rebalance storms

Node.js:

```js
process.on("SIGTERM", async () => {
  await consumer.disconnect();
  process.exit(0);
});
```

---

## 14. Consumer Lag

Formula:

```text
Lag = LatestOffset - ConsumerOffset
```

Increasing lag means consumers are falling behind.

Common causes:

- Slow consumer
- Slow DB/API dependency
- Too few partitions
- Too few consumers
- Rebalances
- Crashes
- Poison messages

Fixes:

- Add consumers if partitions allow
- Increase partitions
- Optimize processing
- Batch writes
- Use DLQ
- Scale downstream systems

---

## 15. Offset Management

Consumer offsets are stored in:

```text
__consumer_offsets
```

Offsets are tracked per:

```text
consumer group + topic + partition
```

Producer does not track offsets.

---

## 16. Auto Commit vs Manual Commit

### Auto Commit

Kafka commits periodically.

Risk:

```text
Offset committed before processing finishes
Consumer crashes
Message skipped
```

Possible message loss.

---

### Manual Commit

Preferred for critical workflows.

Flow:

```text
Process message
Commit offset
```

Risk:

```text
Processed but crash before commit
Message replayed
```

Duplicate possible, but no loss.

---

## 17. Delivery Guarantees

### At Most Once

```text
Commit first
Process later
```

No duplicates, possible loss.

---

### At Least Once

```text
Process first
Commit later
```

No loss, duplicates possible.

Most common in production.

---

### Exactly Once

Kafka EOS = idempotent producer + Kafka transactions.

Mainly guarantees Kafka-to-Kafka workflows.

Does not automatically solve Kafka-to-database exactly-once.

---

## 18. Idempotency

Idempotent consumer means duplicate messages do not create duplicate business impact.

Use:

- `eventId`
- `transactionId`
- unique constraints
- processed events table

Example:

```sql
UNIQUE(transaction_id)
```

If duplicate event arrives, ignore it.

---

## 19. DLQ

Dead Letter Queue stores messages that cannot be processed.

Flow:

```text
Message fails
Retry 1
Retry 2
Retry 3
Send to DLQ
Commit offset
```

Commit after DLQ so the poison message does not block the partition forever.

---

## 20. Replication

Replication factor = number of copies.

Example:

```text
RF = 3
```

Means:

```text
1 leader
2 followers
```

Leader handles reads/writes.

Followers replicate.

---

## 21. ISR

ISR = In-Sync Replicas.

Only replicas caught up with the leader are in ISR.

Kafka elects new leaders from ISR to avoid data loss.

---

## 22. Acknowledgements

### `acks=0`

Producer does not wait. Fastest, least safe.

### `acks=1`

Waits for leader write. Balanced, possible data loss if leader crashes before replication.

### `acks=all`

Waits for ISR acknowledgement. Safest, slower.

---

## 23. min.insync.replicas

Common production config:

```properties
replication.factor=3
min.insync.replicas=2
acks=all
```

If one broker dies, writes continue.

If two brokers die, writes are rejected.

Tradeoff:

```text
Durability over availability
```

---

## 24. Kafka Storage

Kafka stores partitions as append-only logs.

Uses:

- Log files
- Index files
- Log segments

Messages are appended, not updated.

This is one reason Kafka is fast.

---

## 25. Retention

Kafka deletes data based on retention, not consumption.

Examples:

```properties
retention.ms=604800000
retention.bytes=100GB
```

Replay is possible only while data still exists.

---

## 26. Log Compaction

Compaction keeps latest value per key.

Before:

```text
Customer123 = Bronze
Customer123 = Silver
Customer123 = Gold
```

After:

```text
Customer123 = Gold
```

Tombstone:

```json
{
  "key": "Customer123",
  "value": null
}
```

Used to delete compacted keys eventually.

---

## 27. Why Kafka Is Fast

Kafka is fast because of:

- Sequential writes
- Append-only logs
- Batching
- OS page cache
- Zero-copy transfer
- Partition parallelism

---

## 28. OS Page Cache

Kafka relies on OS memory cache.

Recent writes can be served from RAM instead of disk.

This improves read performance.

---

## 29. Zero-Copy Transfer

Traditional:

```text
Disk -> Kernel Buffer -> App Buffer -> Socket Buffer -> Network
```

Kafka optimized:

```text
Disk/Page Cache -> Kernel -> Network
```

Less copying, less CPU, higher throughput.

---

## 30. Outbox Pattern

Problem:

```js
await saveToDB();
await publishToKafka();
```

DB succeeds but Kafka fails.

Solution:

Save business data and event in same DB transaction.

```sql
BEGIN;

INSERT INTO orders;
INSERT INTO outbox;

COMMIT;
```

Separate worker publishes outbox events to Kafka.

---

## 31. CDC and Debezium

CDC captures database changes from DB logs.

Debezium can read:

- PostgreSQL WAL
- MySQL binlog
- MongoDB oplog

Architecture:

```text
Database -> Debezium -> Kafka
```

---

## 32. Saga Pattern

Saga manages distributed transactions using local transactions and compensation.

Success flow:

```text
ORDER_CREATED
  ↓
PAYMENT_COMPLETED
  ↓
INVENTORY_RESERVED
  ↓
SHIPMENT_CREATED
```

Failure flow:

```text
SHIPMENT_FAILED
  ↓
INVENTORY_RELEASED
  ↓
PAYMENT_REFUNDED
  ↓
ORDER_CANCELLED
```

---

## 33. Choreography vs Orchestration

### Choreography

No central coordinator. Services react to events.

Pros:

- Loosely coupled
- Natural with Kafka

Cons:

- Event spaghetti
- Harder debugging

---

### Orchestration

Central orchestrator controls the workflow.

Pros:

- Easier debugging
- Clear workflow

Cons:

- Central brain
- More coupling

---

## 34. Eventual Consistency

Saga gives eventual consistency, not immediate consistency.

Temporary inconsistent states are expected.

Example:

```text
Payment completed
Inventory reserved
Shipment pending
```

Eventually it completes or compensates.

---

## 35. Node.js KafkaJS Basics

Producer:

```js
const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "order-service",
  brokers: ["localhost:9092"],
});

const producer = kafka.producer();
await producer.connect();

await producer.send({
  topic: "orders",
  messages: [
    {
      key: order.customerId,
      value: JSON.stringify(order),
    },
  ],
});
```

Consumer:

```js
const consumer = kafka.consumer({
  groupId: "payment-group",
});

await consumer.connect();

await consumer.subscribe({
  topic: "orders",
});

await consumer.run({
  autoCommit: false,
  eachMessage: async ({ topic, partition, message }) => {
    const event = JSON.parse(message.value.toString());

    await processPayment(event);

    await consumer.commitOffsets([
      {
        topic,
        partition,
        offset: (Number(message.offset) + 1).toString(),
      },
    ]);
  },
});
```

---

## 36. Most Important Interview Answers

### Why Kafka?

To decouple services, handle high-throughput event streams, support replay, and allow multiple independent consumers.

---

### Kafka vs RabbitMQ?

RabbitMQ is queue/task oriented. Kafka is durable event-stream oriented and supports replay.

---

### Can Kafka lose data?

Yes, depending on replication, acknowledgements, ISR, and leader election configuration.

---

### How to guarantee ordering for a customer?

Use customerId as key so all events for that customer go to the same partition.

---

### How to handle duplicate messages?

Use idempotent consumers with unique event IDs or transaction IDs.

---

### What happens if consumer crashes after processing but before offset commit?

Kafka replays the message. Duplicate processing is possible.

---

### What is best production delivery model?

At-least-once delivery plus idempotent consumers.

---

### What is DLQ?

A separate topic for messages that repeatedly fail processing.

---

### What is Outbox Pattern?

Store event and business data in the same DB transaction, then publish event asynchronously.

---

### What is Saga Pattern?

A distributed transaction pattern using local transactions and compensating actions.

---

## 37. Quick Checklist

Before an interview, revise:

- Topic, partition, offset
- Consumer group
- Partition assignment
- Ordering guarantee
- Key-based partitioning
- Rebalancing
- Heartbeats
- Kubernetes rolling deployment behavior
- Consumer lag
- Auto vs manual commit
- At-most-once, at-least-once, exactly-once
- Idempotent consumer
- DLQ
- Replication factor
- Leader/follower
- ISR
- `acks`
- `min.insync.replicas`
- Log segments
- Retention
- Log compaction
- Outbox Pattern
- CDC / Debezium
- Saga Pattern
- Choreography vs Orchestration
- KafkaJS producer and consumer examples

---

## 38. Final Memory Hooks

```text
Partition = parallelism + ordering boundary
```

```text
Consumer group = shared work
```

```text
Different consumer groups = independent processing
```

```text
Offset = consumer progress
```

```text
At least once = duplicate possible
```

```text
Idempotency = duplicate safe
```

```text
DLQ = poison message escape route
```

```text
ISR = safe replicas
```

```text
acks=all + min.insync.replicas = durability
```

```text
Retention != consumption
```

```text
Outbox = DB + Kafka consistency
```

```text
Saga = distributed transaction with compensation
```
