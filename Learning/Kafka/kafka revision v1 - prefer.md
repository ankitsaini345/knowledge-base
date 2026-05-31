# Kafka Revision Notes for Interview

## 1. One-Line Definition

Kafka is a **distributed append-only event log** used for high-throughput, durable, scalable event streaming between systems.

Senior answer:

> Kafka is a distributed event streaming platform that stores, processes, and distributes streams of events with durability, scalability, fault tolerance, and replay capability.

---

## 2. Why Kafka?

Kafka solves:

- Tight coupling between services
- Slow synchronous REST chains
- High-volume event distribution
- Asynchronous processing
- Event replay
- Audit/logging pipelines
- Real-time analytics
- Fault isolation between services

Example:

```text
Order Service -> ORDER_CREATED -> Kafka
                                  |
                                  +-> Payment Service
                                  +-> Inventory Service
                                  +-> Notification Service
                                  +-> Analytics Service
```

---

## 3. Kafka vs REST

REST is synchronous.

Kafka is asynchronous.

REST:

```text
Order Service -> Payment
Order Service -> Inventory
Order Service -> Notification
```

Kafka:

```text
Order Service -> Kafka -> Many consumers
```

Use Kafka when many systems need the same event independently.

---

## 4. Kafka vs RabbitMQ

| Kafka                                    | RabbitMQ                           |
| ---------------------------------------- | ---------------------------------- |
| Event streaming                          | Message queue                      |
| Stores events for retention              | Usually removes after consume      |
| Supports replay                          | Limited replay                     |
| High throughput                          | Lower throughput                   |
| Multiple consumer groups read same event | Competing consumers share messages |
| Best for event streams/analytics         | Best for task queues               |

RabbitMQ can persist messages, but Kafka is designed as a persistent distributed log.

---

## 5. Core Concepts

### Broker

Kafka server.

```text
Kafka Cluster = Broker-1 + Broker-2 + Broker-3
```

### Topic

Logical stream/category of events.

```text
orders
payments
transactions
notifications
```

### Partition

Physical split of a topic.

```text
orders-topic
P0
P1
P2
```

Partitions give:

- Parallelism
- Scalability
- Ordering within partition

### Offset

Position of message inside partition.

```text
P0:
Offset 0 -> Order1
Offset 1 -> Order2
Offset 2 -> Order3
```

---

## 6. Ordering Rule

Kafka guarantees ordering:

```text
Only inside a partition
```

Not across partitions.

To keep ordering for a customer/account/order:

```text
Use customerId/accountId/orderId as message key
```

Example:

```js
key: customerId;
```

Then all events for that key go to the same partition.

---

## 7. Partition Key

Kafka partition selection:

```text
hash(key) % numberOfPartitions
```

Good keys:

- `customerId`
- `accountId`
- `orderId`
- `paymentId`
- `rideId`

Bad key:

```text
key = "orders"
```

This sends all messages to one partition and creates a hot partition.

---

## 8. Adding New Partitions

If partitions increase later:

```text
hash(customerId) % 3
```

becomes:

```text
hash(customerId) % 6
```

Same key may go to a different partition.

Result:

```text
Old events -> P2
New events -> P4
```

Ordering within each partition remains, but key affinity may break.

Best practice:

> Plan partition count carefully upfront.

---

## 9. Consumer Group

A consumer group is a set of consumers working together.

```text
orders-topic

P0 -> C1
P1 -> C2
P2 -> C3
```

Rule:

```text
One partition can be assigned to only one consumer within a consumer group.
```

But different groups can read the same partition independently.

```text
orders-topic / P0

PaymentGroup   -> Consumer A
AnalyticsGroup -> Consumer B
AuditGroup     -> Consumer C
```

---

## 10. Consumer Parallelism

Maximum active consumers in one group:

```text
Number of partitions
```

Example:

```text
3 partitions + 10 consumers
= only 3 active consumers
= 7 idle consumers
```

To increase parallelism:

```text
Increase partitions + add consumers
```

---

## 11. Consumer Group ID

Same group ID:

```text
Consumers share work
```

Different group ID:

```text
Each group gets all events independently
```

Example:

```js
const consumer = kafka.consumer({
  groupId: "payment-group",
});
```

---

## 12. Rebalancing

Rebalancing means Kafka redistributes partitions among consumers.

Triggers:

- Consumer joins
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

After:
C1 -> P0, P1
C3 -> P2
```

---

## 13. How Kafka Detects Consumer Crash

Kafka does not receive `"I crashed"`.

Consumer sends heartbeats:

```text
"I'm alive"
"I'm alive"
"I'm alive"
```

If heartbeats stop beyond:

```text
session.timeout.ms
```

Kafka assumes consumer is dead and triggers rebalance.

Kafka cannot distinguish:

- Crash
- Network issue
- Frozen process
- Long GC pause
- Stuck event loop

It only detects missing heartbeats.

---

## 14. Kubernetes Rolling Deployment

During rolling deployment:

```text
New pod joins -> Rebalance
Old pod leaves -> Rebalance
```

This can create multiple rebalances.

Best practices:

- Handle `SIGTERM`
- Disconnect consumer gracefully
- Use cooperative rebalancing
- Set proper termination grace period
- Avoid frequent restarts

Node.js:

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

Lag means how far consumer is behind.

Reasons for high lag:

- Slow consumer
- Too few partitions
- Too few consumers
- Slow database/API
- Rebalance storms
- Hot partition
- Consumer errors
- Network issues

---

## 16. Offset Management

Offsets are stored in Kafka internal topic:

```text
__consumer_offsets
```

Producer does not track offsets.

Consumer group tracks offsets.

Committed offset means:

```text
All messages before this offset are considered processed.
```

---

## 17. Auto Commit vs Manual Commit

### Auto Commit

Kafka periodically commits offsets automatically.

Risk:

```text
Offset committed before processing completes
Consumer crashes
Message lost
```

### Manual Commit

Application commits offset after successful processing.

Pattern:

```text
Process message
Commit offset
```

Risk:

```text
Processing succeeds
Crash before commit
Message replayed
Duplicate possible
```

Preferred in production because duplicates are better than data loss.

---

## 18. Delivery Guarantees

### At Most Once

```text
Commit first
Process later
```

Result:

```text
No duplicates
Possible message loss
```

### At Least Once

```text
Process first
Commit later
```

Result:

```text
No message loss
Duplicates possible
```

Most production systems use:

```text
At least once + idempotent consumer
```

### Exactly Once

Kafka EOS uses:

```text
Idempotent producer + Kafka transactions
```

Works mainly for:

```text
Kafka -> Kafka
```

Does not automatically solve:

```text
Kafka -> PostgreSQL
Kafka -> MongoDB
Kafka -> external API
```

For external systems, use idempotency.

---

## 19. Idempotency

Idempotency means repeated processing does not corrupt data.

Bad:

```sql
balance = balance + 100
```

If repeated, balance changes twice.

Better:

```text
Use transactionId/eventId with unique constraint
```

Example:

```sql
INSERT INTO processed_events(event_id)
VALUES ('evt-123');
```

If duplicate event comes, ignore it.

Use:

- `eventId`
- `transactionId`
- `paymentId`
- `orderId`
- `requestId`

---

## 20. DLQ

Dead Letter Queue stores messages that repeatedly fail.

Flow:

```text
orders-topic
   ↓
Consumer
   ↓
Retry 3 times
   ↓
orders-dlq
   ↓
Commit original offset
```

Why commit after DLQ?

Because otherwise the same bad message keeps replaying forever and blocks the partition.

---

## 21. Replication

Replication protects against broker failure.

```text
Replication Factor = 3

P0 leader   -> Broker-1
P0 follower -> Broker-2
P0 follower -> Broker-3
```

RF=3 means:

```text
1 leader + 2 followers = 3 copies
```

Replication factor cannot exceed broker count.

---

## 22. Leader and Followers

Each partition has:

```text
1 leader
N followers
```

Leader handles:

- Producer writes
- Consumer reads

Followers only replicate from leader.

Producer does not write directly to followers.

---

## 23. ISR

ISR = In-Sync Replicas.

Replicas caught up with leader.

```text
Leader -> Offset 1000
F1     -> Offset 1000
F2     -> Offset 1000

ISR = {Leader, F1, F2}
```

If follower lags:

```text
Leader -> 1000
F1     -> 1000
F2     -> 850

ISR = {Leader, F1}
```

Kafka elects new leader from ISR to avoid data loss.

---

## 24. Producer Acknowledgements

### acks=0

Producer does not wait.

```text
Fastest
Least safe
```

### acks=1

Producer waits for leader write.

```text
Balanced
Possible loss if leader crashes before replication
```

### acks=all

Producer waits for ISR acknowledgement.

```text
Safest
Slower
```

Production config:

```properties
acks=all
replication.factor=3
min.insync.replicas=2
```

---

## 25. min.insync.replicas

Example:

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

This prevents unsafe writes.

---

## 26. Can Kafka Lose Data?

Yes, depending on:

- `acks`
- replication factor
- ISR status
- `min.insync.replicas`
- unclean leader election
- producer retries
- broker failure timing

Good interview answer:

> Kafka can lose data if configured incorrectly or if producers acknowledge messages before enough replicas have persisted them.

---

## 27. Kafka Storage

Kafka is an append-only log.

```text
Offset 0 -> Message1
Offset 1 -> Message2
Offset 2 -> Message3
```

New messages are appended at the end.

Kafka stores partitions as log segments:

```text
orders-0/
  00000000000000000000.log
  00000000000000000000.index
  00000000000000000000.timeindex
```

---

## 28. Why Kafka Is Fast

Kafka is fast because of:

- Sequential disk writes
- Append-only log
- OS page cache
- Zero-copy transfer
- Batching
- Partition parallelism

---

## 29. OS Page Cache

Kafka relies on OS memory cache.

Recently written/read data stays in RAM.

Consumer may read from memory instead of disk.

This improves performance significantly.

---

## 30. Zero-Copy Transfer

Traditional data path:

```text
Disk -> Kernel Buffer -> App Buffer -> Socket Buffer -> Network
```

Kafka optimized path:

```text
Disk/Page Cache -> Kernel -> Network
```

Kafka avoids unnecessary copying into application memory.

Benefits:

- Lower CPU usage
- Lower memory usage
- Higher throughput

---

## 31. Retention

Kafka does not delete data after consumption.

Kafka deletes data based on:

```text
Time
Size
```

Example:

```properties
retention.ms=604800000
```

Means 7 days.

Important:

```text
Retention is independent of consumption.
```

---

## 32. Replay

Kafka can replay events because messages remain stored until retention expires.

Replay possible if:

```text
Data still exists in Kafka
```

Replay not possible if:

```text
Retention deleted old segments
```

Basic KafkaJS:

```js
await consumer.subscribe({
  topic: "orders",
  fromBeginning: true,
});
```

For existing groups, reset offsets using Kafka admin tools.

---

## 33. Log Compaction

Compaction keeps latest value per key.

Before:

```text
Customer123 -> Bronze
Customer123 -> Silver
Customer123 -> Gold
```

After:

```text
Customer123 -> Gold
```

Use for:

- Customer profile
- Inventory state
- Account state
- Config state

Retention vs compaction:

```text
Retention = delete by age/size
Compaction = keep latest value per key
```

---

## 34. Tombstone

In compacted topic:

```json
{
  "key": "Customer123",
  "value": null
}
```

This means delete this key eventually.

---

## 35. Outbox Pattern

Problem:

```js
await saveToDB();
await publishToKafka();
```

DB may succeed, Kafka may fail.

Solution:

```text
Save business data + outbox event in same DB transaction
```

Example:

```sql
BEGIN;

INSERT INTO orders (...);
INSERT INTO outbox(event_type, payload, status)
VALUES ('ORDER_CREATED', '{...}', 'PENDING');

COMMIT;
```

Separate worker publishes outbox events to Kafka.

Outbox solves DB + Kafka dual-write inconsistency.

---

## 36. CDC and Debezium

CDC = Change Data Capture.

It reads database transaction logs and streams changes to Kafka.

Debezium reads:

- PostgreSQL WAL
- MySQL Binlog
- MongoDB Oplog

Architecture:

```text
PostgreSQL -> Debezium -> Kafka
```

Use cases:

- Outbox publishing
- Audit events
- DB change streaming
- Legacy integration

---

## 37. Saga Pattern

Saga manages distributed transactions using:

```text
Local transactions + compensation events
```

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
ORDER_CREATED
   ↓
PAYMENT_COMPLETED
   ↓
INVENTORY_RESERVED
   ↓
SHIPMENT_FAILED
   ↓
INVENTORY_RELEASED
   ↓
PAYMENT_REFUNDED
   ↓
ORDER_CANCELLED
```

Saga gives eventual consistency, not immediate consistency.

---

## 38. Compensation Transaction

A compensation transaction logically undoes a previous action.

| Action         | Compensation   |
| -------------- | -------------- |
| Charge card    | Refund card    |
| Reserve stock  | Release stock  |
| Create booking | Cancel booking |
| Debit account  | Credit back    |

---

## 39. Choreography vs Orchestration Saga

### Choreography

Services react to events.

```text
No central coordinator
```

Pros:

- Loose coupling
- Kafka-native

Cons:

- Event spaghetti
- Hard debugging

### Orchestration

Central orchestrator controls flow.

```text
Saga Orchestrator -> Services
```

Pros:

- Easier to debug
- Central business flow

Cons:

- Orchestrator can become central brain/bottleneck

---

## 40. Event Sourcing

Store events as source of truth.

Instead of:

```text
Balance = 1000
```

Store:

```text
AccountCreated
Deposit 500
Deposit 700
Withdraw 200
```

Current state is rebuilt by replaying events.

Benefits:

- Audit trail
- Replay
- Time travel
- Historical debugging

---

## 41. CQRS

CQRS separates write and read models.

```text
Write DB -> Kafka Events -> Read DB
```

Benefits:

- Independent scaling
- Optimized read model
- Works well with event sourcing

---

## 42. Practical Node.js Producer

```js
const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "order-service",
  brokers: ["localhost:9092"],
});

const producer = kafka.producer();

async function publishOrderCreated(order) {
  await producer.connect();

  await producer.send({
    topic: "orders",
    messages: [
      {
        key: order.customerId,
        value: JSON.stringify({
          eventId: order.eventId,
          eventType: "ORDER_CREATED",
          orderId: order.orderId,
          customerId: order.customerId,
          amount: order.amount,
        }),
      },
    ],
  });
}
```

---

## 43. Practical Node.js Consumer

```js
const consumer = kafka.consumer({
  groupId: "payment-group",
});

async function startConsumer() {
  await consumer.connect();

  await consumer.subscribe({
    topic: "orders",
    fromBeginning: false,
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
}
```

---

## 44. Production Consumer Flow

```text
Read message
Check idempotency
Process business logic
Commit offset
```

On failure:

```text
Retry limited times
Send to DLQ
Commit offset
Continue
```

---

# Quick Interview Answers

## What is Kafka?

Kafka is a distributed event streaming platform based on an append-only log, used for durable, high-throughput, scalable event processing.

## Why Kafka?

To decouple services, process events asynchronously, support replay, and handle high-throughput event streams.

## Topic vs Partition?

Topic is logical stream. Partition is physical split of the topic for parallelism and ordering.

## Does Kafka guarantee ordering?

Only within a partition.

## How to maintain ordering for one customer?

Use `customerId` as message key.

## Can multiple consumers read one partition?

Same group: no. Different groups: yes.

## Where are offsets stored?

In Kafka internal topic `__consumer_offsets`.

## Auto commit vs manual commit?

Auto commit is automatic but may lose messages. Manual commit gives control and supports safer at-least-once processing.

## What is at-least-once?

Message is processed one or more times. No loss, duplicates possible.

## How to avoid duplicate impact?

Make consumers idempotent using event IDs or business keys.

## What is DLQ?

A topic for messages that fail repeatedly and need later investigation.

## What is ISR?

In-sync replicas that are caught up with leader.

## What is safest producer config?

```properties
acks=all
replication.factor=3
min.insync.replicas=2
```

## Why is Kafka fast?

Sequential writes, page cache, zero-copy, batching, partition parallelism.

## What is Outbox Pattern?

Save DB changes and event record in same transaction, then publish event later.

## What is Saga?

Distributed transaction pattern using local transactions and compensation events.

## What is Kafka EOS?

Exactly-once semantics using idempotent producers and transactions, mainly for Kafka-to-Kafka workflows.

---

# Final 5-Minute Revision

Remember these lines:

```text
Kafka = distributed append-only event log.
```

```text
Topic = logical stream.
Partition = physical parallelism unit.
Offset = message position.
```

```text
Ordering is guaranteed only within a partition.
```

```text
Same key goes to same partition, but adding partitions can change mapping.
```

```text
One partition = one active consumer per consumer group.
```

```text
Different consumer groups get the same events independently.
```

```text
Kafka detects consumer failure through missing heartbeats.
```

```text
Rebalancing happens when consumers join, leave, crash, or partitions change.
```

```text
Process first, commit offset later = at-least-once.
```

```text
At-least-once requires idempotent consumers.
```

```text
DLQ prevents poison messages from blocking partitions.
```

```text
RF=3 means one leader and two followers.
```

```text
ISR replicas are eligible for leader election.
```

```text
acks=all + min.insync.replicas=2 + RF=3 is common production setup.
```

```text
Kafka deletes data by retention, not by consumption.
```

```text
Replay works only if data still exists.
```

```text
Outbox solves DB + Kafka dual-write problem.
```

```text
Saga = local transactions + compensation + eventual consistency.
```

```text
Kafka EOS is mainly Kafka-to-Kafka; external DBs still need idempotency.
```
