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
  - backend
  - microservices
  - event-driven-architecture
  - system-design
  - interview-revision
source:
  - "ChatGPT conversation"
---

# Kafka Interview Preparation for Node.js Developers Revision

## 1. Kafka in One Line

Kafka is a distributed event streaming platform used as a durable, scalable, fault-tolerant event backbone between systems.

---

## 2. Mental Model

Kafka is not just a queue.

Kafka is a:

```text
Distributed append-only event log
```

````

Events are written to Kafka and retained for a configured duration or size. Consumers read events independently without deleting them.

---

## 3. Why Kafka Exists

Kafka solves these problems:

- Tight coupling between services
- Slow synchronous REST chains
- Service dependency explosion
- Database polling
- High-throughput event distribution
- Event replay
- Multiple independent consumers

Example:

```text
Order Service
   ↓
Kafka
   ↓
Payment / Inventory / Notification / Analytics
```

Order Service only publishes:

```text
ORDER_CREATED
```

It does not need to know who consumes it.

---

## 4. Kafka vs REST

| REST                        | Kafka                                     |
| --------------------------- | ----------------------------------------- |
| Synchronous                 | Asynchronous                              |
| Caller waits                | Publisher does not wait for all consumers |
| Direct dependency           | Decoupled services                        |
| Harder to add new consumers | New consumers can subscribe independently |
| Good for request-response   | Good for event-driven workflows           |

Use Kafka when many systems need to react to the same event independently.

---

## 5. Kafka vs RabbitMQ

| Kafka                              | RabbitMQ                           |
| ---------------------------------- | ---------------------------------- |
| Event streaming platform           | Message broker                     |
| Stores events for retention period | Usually removes messages after ack |
| Replay supported                   | Replay limited                     |
| High throughput                    | Usually lower throughput           |
| Great for event pipelines          | Great for task queues              |
| Topic + partitions                 | Exchange + queues                  |

RabbitMQ can have multiple consumers and can persist messages to disk, but Kafka is designed as a durable event log from the ground up.

---

## 6. Core Concepts

### Broker

Kafka server.

### Topic

Logical stream/category of events.

Example:

```text
orders
payments
transactions
notifications
```

### Partition

Physical split of a topic.

Purpose:

- Parallelism
- Scalability
- Ordering boundary

### Offset

Position of a message inside a partition.

```text
Partition-0

Offset 0 -> Order1
Offset 1 -> Order2
Offset 2 -> Order3
```

### Producer

Publishes messages to Kafka.

### Consumer

Reads messages from Kafka.

### Consumer Group

Set of consumers sharing work for a topic.

### ISR

In-Sync Replicas. Replicas that are fully caught up with leader.

---

## 7. Most Important Partition Rule

```text
One partition can be assigned to only one consumer within the same consumer group.
```

Example:

```text
Topic: orders
Partitions: P0

Consumer Group: payment-group

C1 -> P0
C2 -> idle
C3 -> idle
```

But different consumer groups can read the same partition independently.

```text
orders P0

payment-group   -> Consumer A
analytics-group -> Consumer B
audit-group     -> Consumer C
```

---

## 8. Ordering Guarantee

Kafka guarantees ordering only inside a partition.

```text
P0:
Offset 0
Offset 1
Offset 2
```

Kafka does not guarantee global ordering across partitions.

To preserve ordering for one customer:

```js
key = customerId;
```

Same key goes to the same partition.

---

## 9. Partition Selection

With key:

```text
hash(key) % numberOfPartitions
```

Example:

```text
hash(customerId) % 3 = P2
```

All messages for that customer go to P2.

### Important

If partition count changes later:

```text
hash(customerId) % 6
```

The same customer may now go to a different partition.

Old events stay in the old partition. New events may go to the new partition.

This can affect ordering assumptions.

---

## 10. Good Kafka Keys

Choose the key based on the entity whose ordering matters.

| Domain       | Good Key                 |
| ------------ | ------------------------ |
| E-commerce   | customerId, orderId      |
| Banking      | accountId, transactionId |
| Ride-hailing | rideId, driverId         |
| Inventory    | productId, warehouseId   |

Do not use the same key for every message. That sends everything to one partition and kills parallelism.

---

## 11. Consumer Groups

Same group means work is shared.

Different groups means each group receives all events independently.

```text
orders-topic
   |
   +--> payment-group
   +--> notification-group
   +--> analytics-group
```

Each consumer group has its own offsets.

---

## 12. Rebalancing

Rebalancing means Kafka redistributes partitions among consumers.

Triggers:

- New consumer joins
- Consumer leaves
- Consumer crashes
- Session timeout
- Partition count changes

Example:

```text
Before:
C1 -> P0
C2 -> P1
C3 -> P2

C2 crashes

After rebalance:
C1 -> P0, P1
C3 -> P2
```

---

## 13. Heartbeats and Crash Detection

Kafka does not receive a direct crash signal.

Consumers send heartbeats to Kafka’s group coordinator.

If heartbeats stop beyond:

```text
session.timeout.ms
```

Kafka assumes the consumer is dead and triggers rebalance.

Kafka cannot distinguish between:

- Process crash
- Process freeze
- Network issue
- Long pause
- Kubernetes pod killed unexpectedly

It only detects missing heartbeats.

---

## 14. Kafka in Kubernetes Rolling Deployment

During rolling deployment:

```text
New pod starts
   ↓
New consumer joins
   ↓
Rebalance
   ↓
Old pod terminates
   ↓
Old consumer leaves
   ↓
Another rebalance
```

Best practices:

- Handle `SIGTERM`
- Call `consumer.disconnect()`
- Use cooperative rebalancing
- Avoid rebalance storms

Node.js example:

```js
process.on("SIGTERM", async () => {
  await consumer.disconnect();
  process.exit(0);
});
```

---

## 15. Consumer Lag

Formula:

```text
Lag = LatestOffset - ConsumerOffset
```

Increasing lag means consumers are falling behind.

Common causes:

- Slow consumer
- Slow database/API
- Too few consumers
- Too few partitions
- Rebalance storms
- Poison messages
- Network issues

Fixes:

- Add consumers if partitions allow
- Increase partitions
- Optimize processing
- Batch writes
- Use DLQ
- Scale downstream systems

---

## 16. Offset Management

Consumer offsets are stored in:

```text
__consumer_offsets
```

Offsets are tracked per:

```text
consumer group + topic + partition
```

Producer does not track consumer offsets.

---

## 17. Auto Commit vs Manual Commit

### Auto Commit

Kafka commits offsets automatically.

Risk:

```text
Offset committed
Processing not completed
Consumer crashes
Message skipped
```

Possible message loss.

### Manual Commit

You control when offset is committed.

Preferred flow:

```text
Process message
Commit offset
```

Risk:

```text
Processing completed
Consumer crashes before commit
Message replayed
```

Duplicate possible, but no loss.

---

## 18. Delivery Guarantees

### At Most Once

```text
Commit first
Process later
```

No duplicates, but message loss possible.

### At Least Once

```text
Process first
Commit later
```

No loss, but duplicates possible.

Most production systems use:

```text
At least once + idempotent consumers
```

### Exactly Once Semantics

Kafka EOS means:

```text
Idempotent Producer + Kafka Transactions
```

It mainly works for Kafka-to-Kafka workflows.

Example:

```text
Input Topic
   ↓
Process
   ↓
Output Topic
```

Kafka can make read-process-write atomic inside Kafka.

But Kafka EOS does not automatically make external DB operations exactly once.

For:

```text
Kafka -> Consumer -> PostgreSQL
```

you still need idempotency or Outbox Pattern.

---

## 19. Idempotent Consumer

Idempotency means duplicate messages do not create duplicate business effects.

Use:

- eventId
- transactionId
- unique DB constraint
- processed_events table

Example:

```sql
CREATE UNIQUE INDEX idx_transaction_id
ON processed_transactions(transaction_id);
```

If duplicate event arrives, ignore it.

---

## 20. DLQ

DLQ means Dead Letter Queue.

Used for messages that repeatedly fail processing.

Flow:

```text
Message consumed
   ↓
Retry 1
Retry 2
Retry 3
   ↓
Send to DLQ
   ↓
Commit offset
```

Commit after sending to DLQ so the poison message does not block the partition forever.

---

## 21. Replication

Replication Factor means number of copies.

```text
RF = 3
```

Means:

```text
1 leader
2 followers
```

Leader handles reads and writes.

Followers replicate from leader.

---

## 22. ISR

ISR means In-Sync Replicas.

Only replicas caught up with the leader are in ISR.

Kafka elects new leaders from ISR to avoid data loss.

Example:

```text
Leader    -> Offset 1000
Follower1 -> Offset 1000
Follower2 -> Offset 850
```

Follower2 is not safe to become leader.

---

## 23. Producer Acknowledgements

### acks=0

Producer does not wait.

Fastest, least safe.

### acks=1

Producer waits for leader write.

Balanced, but data loss possible if leader crashes before followers replicate.

### acks=all

Producer waits for ISR acknowledgement.

Safest, slower.

---

## 24. min.insync.replicas

Common production config:

```properties
replication.factor=3
min.insync.replicas=2
acks=all
```

If one broker dies:

```text
ISR size = 2
Writes continue
```

If two brokers die:

```text
ISR size = 1
Writes rejected
```

This favors durability over availability.

---

## 25. Kafka Storage

Kafka stores partitions as append-only logs.

```text
orders-topic / partition-0

Offset 0 -> Order1
Offset 1 -> Order2
Offset 2 -> Order3
```

Kafka uses:

- Log files
- Index files
- Log segments

---

## 26. Retention

Kafka deletes data based on retention, not consumption.

Examples:

```properties
retention.ms=604800000
retention.bytes=100GB
```

Replay is possible only while data still exists.

---

## 27. Log Compaction

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

Tombstone record:

```json
{
  "key": "Customer123",
  "value": null
}
```

Used to eventually delete compacted keys.

---

## 28. Why Kafka Is Fast

Kafka is fast because of:

- Sequential disk writes
- Append-only logs
- Batching
- OS page cache
- Zero-copy transfer
- Partition-based parallelism

---

## 29. OS Page Cache

Kafka relies on OS memory cache.

Recently written data can be served from RAM instead of disk.

This improves read performance.

---

## 30. Zero-Copy Transfer

Traditional transfer:

```text
Disk -> Kernel Buffer -> App Buffer -> Socket Buffer -> Network
```

Kafka optimized transfer:

```text
Disk/Page Cache -> Kernel -> Network
```

Less copying, less CPU, higher throughput.

---

## 31. Event-Driven Architecture

Services communicate through events rather than direct synchronous calls.

Example:

```text
Order Service
   ↓ ORDER_CREATED
Kafka
   ↓
Payment / Inventory / Notification / Analytics
```

Benefits:

- Loose coupling
- Independent scaling
- Replay
- Better resilience
- Multiple consumers

Tradeoff:

- Eventual consistency
- Harder debugging
- Requires idempotency and monitoring

---

## 32. Outbox Pattern

Problem:

```js
await saveOrderToDB();
await publishToKafka();
```

DB succeeds but Kafka publish fails.

Solution:

Save business data and event in same DB transaction.

```sql
BEGIN;

INSERT INTO orders;
INSERT INTO outbox;

COMMIT;
```

Separate worker or CDC publishes outbox events to Kafka.

---

## 33. CDC and Debezium

CDC means Change Data Capture.

Debezium reads database logs and publishes changes to Kafka.

Examples:

- PostgreSQL WAL
- MySQL binlog
- MongoDB oplog

Architecture:

```text
Database -> Debezium -> Kafka
```

---

## 34. Saga Pattern

Saga manages distributed transactions using local transactions and compensating actions.

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

## 35. Choreography vs Orchestration Saga

### Choreography

No central coordinator.

Services react to events.

Pros:

- Loosely coupled
- Natural with Kafka

Cons:

- Event spaghetti
- Harder debugging

### Orchestration

Central orchestrator controls workflow.

Pros:

- Clear flow
- Easier debugging

Cons:

- Central brain
- More coupling

---

## 36. Eventual Consistency

Saga gives eventual consistency, not immediate consistency.

Temporary states are normal.

Example:

```text
Payment completed
Inventory reserved
Shipment pending
```

Eventually the system either completes or compensates.

---

## 37. KafkaJS Quick Example

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

## 38. Most Common Interview Answers

### Why Kafka?

To decouple services, handle high-throughput event streams, enable replay, and allow multiple independent consumers.

### Kafka vs RabbitMQ?

RabbitMQ is queue/task oriented. Kafka is durable event-stream oriented and supports replay.

### Can Kafka lose data?

Yes. It depends on replication, acknowledgements, ISR health, and leader election settings.

### How to guarantee ordering for a customer?

Use `customerId` as message key so all customer events go to the same partition.

### How to handle duplicate messages?

Use idempotent consumers with unique event IDs or transaction IDs.

### What happens if consumer crashes after processing but before offset commit?

Kafka replays the message. Duplicate processing is possible.

### What is the best practical production delivery model?

At-least-once delivery with idempotent consumers.

### What is DLQ?

A separate topic for messages that repeatedly fail processing.

### What is Outbox Pattern?

Store business data and event data in the same DB transaction, then publish the event asynchronously.

### What is Saga Pattern?

A distributed transaction pattern using local transactions and compensating actions.

---

## 39. Final Memory Hooks

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

---

## 40. Last-Day Interview Checklist

Revise these before interview:

- Kafka definition
- Topic, partition, offset
- Broker
- Producer and consumer
- Consumer group
- Partition assignment
- Ordering guarantee
- Message key strategy
- Rebalancing
- Heartbeats and session timeout
- Kubernetes rolling deployment behavior
- Consumer lag
- Auto commit vs manual commit
- At-most-once, at-least-once, exactly-once
- Idempotent consumer
- DLQ
- Replication factor
- Leader and follower
- ISR
- `acks`
- `min.insync.replicas`
- Log segments
- Retention
- Log compaction
- OS page cache
- Zero-copy transfer
- Event-driven architecture
- Outbox Pattern
- CDC / Debezium
- Saga Pattern
- Choreography vs orchestration
- KafkaJS producer and consumer examples

```
````
