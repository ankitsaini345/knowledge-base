# Apache Kafka Interview Preparation

## Overview

Apache Kafka is a distributed event streaming platform used to reliably store, process, and distribute high-throughput streams of events between systems.

From an interview perspective, Kafka should be understood from three angles:

1. **Developer perspective**: producers, consumers, offsets, retries, idempotency, Node.js implementation.
2. **System design perspective**: event-driven architecture, Saga, Outbox Pattern, CDC, scalability, fault tolerance.
3. **Operational perspective**: partitions, replication, consumer lag, rebalancing, broker failure, retention, performance tuning.

Kafka is not just a message broker. It is best understood as a **distributed append-only log** that allows multiple systems to publish, consume, replay, and process events independently.

A strong senior-level definition:

> Kafka is a distributed event streaming platform used to reliably store, process, and distribute streams of events at high throughput with durability, scalability, and fault tolerance.

---

## Core Concepts

### Event

An event represents something that happened in the system.

Examples:

```json
{
  "eventType": "ORDER_CREATED",
  "orderId": "1001",
  "customerId": "123",
  "amount": 500
}
```

Common event examples:

- `ORDER_CREATED`
- `PAYMENT_COMPLETED`
- `INVENTORY_RESERVED`
- `SHIPMENT_FAILED`
- `CUSTOMER_CREATED`
- `TRANSACTION_POSTED`

---

### Producer

A producer is an application that publishes events to Kafka.

Example:

```js
await producer.send({
  topic: "orders",
  messages: [
    {
      key: "customer-123",
      value: JSON.stringify({
        orderId: "1001",
        customerId: "123",
        amount: 500,
      }),
    },
  ],
});
```

---

### Consumer

A consumer is an application that reads events from Kafka.

Example:

```js
await consumer.run({
  eachMessage: async ({ message }) => {
    const order = JSON.parse(message.value.toString());
    console.log(order);
  },
});
```

---

### Broker

A broker is a Kafka server.

A Kafka cluster consists of multiple brokers.

```text
Kafka Cluster

Broker-1
Broker-2
Broker-3
```

Broker responsibilities:

- Store topic partitions
- Handle producer requests
- Handle consumer requests
- Replicate data
- Participate in leader election

Interview answer:

> A broker is a Kafka server responsible for storing topic partitions and serving producer and consumer requests.

---

### Topic

A topic is a logical stream/category of events.

Examples:

```text
orders
payments
transactions
notifications
customer-created
account-updated
```

A topic is not exactly the same as a queue. A better answer is:

> A Kafka topic is a logical stream of events.

---

### Partition

A partition is a physical subdivision of a topic.

Example:

```text
Topic: orders

Partition-0
Partition-1
Partition-2
```

Partitions enable:

- Parallelism
- Scalability
- Higher throughput
- Ordering within a partition

Important rule:

> Kafka guarantees ordering only within a partition, not across partitions.

---

### Offset

An offset is the position of a message inside a partition.

Example:

```text
Partition-0

Offset 0 -> OrderCreated
Offset 1 -> PaymentCompleted
Offset 2 -> EmailSent
```

Consumers track offsets to know what they have processed.

---

### Consumer Group

A consumer group is a set of consumers working together to process topic partitions.

Example:

```text
Topic: orders

P0 -> Consumer-1
P1 -> Consumer-2
P2 -> Consumer-3
```

Important rule:

> One partition can be assigned to only one consumer within a consumer group.

But the same partition can be read by multiple consumers if they belong to different consumer groups.

Example:

```text
orders-topic / P0

PaymentGroup   -> Consumer-A
AnalyticsGroup -> Consumer-B
AuditGroup     -> Consumer-C
```

Each group gets the same events independently.

---

### Consumer Group ID

Every consumer group has a `groupId`.

Example:

```js
const consumer = kafka.consumer({
  groupId: "payment-group",
});
```

Kafka uses the group ID to:

- Track offsets
- Assign partitions
- Coordinate rebalancing
- Manage failures

Same group ID means work is shared.

Different group IDs mean each group receives the events independently.

---

## Detailed Explanation

## Why Kafka Exists

Consider an e-commerce system.

```text
Order Service
      |
      +---- Payment Service
      |
      +---- Inventory Service
      |
      +---- Notification Service
      |
      +---- Analytics Service
```

A basic synchronous implementation might look like:

```js
await paymentService.process(order);
await inventoryService.update(order);
await notificationService.send(order);
await analyticsService.track(order);
```

This creates several problems.

---

### Problem 1: Tight Coupling

The Order Service knows about all downstream services.

If the Notification Service is down, the order flow may fail even though payment and inventory succeeded.

---

### Problem 2: Slow Response Time

If each service takes time:

```text
Payment      = 200 ms
Inventory    = 150 ms
Notification = 400 ms
Analytics    = 250 ms
```

The user waits for all operations.

---

### Problem 3: Service Dependency Explosion

As more services are added, the Order Service becomes responsible for calling all of them.

```text
Order Service
     |
     +---- Payment
     +---- Inventory
     +---- Notification
     +---- Analytics
     +---- Loyalty
     +---- Fraud
```

Every new service requires code changes.

---

### Kafka Solution: Event-Driven Communication

Instead of calling every service directly, the Order Service publishes an event:

```json
{
  "eventType": "ORDER_CREATED",
  "orderId": "1001"
}
```

Kafka distributes this event to interested consumers.

```text
Order Service
      |
      v
ORDER_CREATED
      |
      v
Kafka
      |
      +---- Payment Service
      +---- Inventory Service
      +---- Notification Service
      +---- Analytics Service
```

The Order Service no longer needs to know who consumes the event.

This creates:

- Loose coupling
- Async processing
- Better scalability
- Better fault isolation
- Replay capability

---

## Kafka vs REST APIs

REST is synchronous.

Kafka is asynchronous and event-driven.

REST example:

```text
Order Service -> Payment API
Order Service -> Inventory API
Order Service -> Notification API
Order Service -> Analytics API
```

Kafka example:

```text
Order Service -> Kafka -> Multiple Consumers
```

For high event volume, Kafka reduces direct service-to-service calls.

Example:

If 10,000 orders/sec require 4 downstream services, REST may create 40,000 network calls/sec.

Kafka allows one publish and multiple independent consumers.

---

## Kafka vs Database Polling

A common alternative is:

```sql
SELECT * FROM orders
WHERE processed = false;
```

Problems:

- Polling is wasteful
- Database load increases
- Services discover changes late
- Scaling becomes difficult
- Real-time eventing is weak

Kafka is event-first. Services react when events happen.

---

## Kafka vs RabbitMQ

| Kafka                                        | RabbitMQ                                   |
| -------------------------------------------- | ------------------------------------------ |
| Event streaming platform                     | Message broker / queue                     |
| Distributed append-only log                  | Queue-based messaging                      |
| Stores events for retention period           | Usually removes messages after consumption |
| Supports replay                              | Replay is limited                          |
| High throughput                              | Usually lower throughput                   |
| Good for analytics/event streams             | Good for task queues                       |
| Multiple consumer groups can read same event | Competing consumers usually share messages |

RabbitMQ can have multiple consumers. In a typical queue, messages are distributed among consumers:

```text
Queue
  |
  +---- Consumer-1
  +---- Consumer-2
  +---- Consumer-3
```

Usually one message is processed by one consumer.

Kafka allows multiple consumer groups to independently process the same event.

RabbitMQ can persist queues and messages to disk, but Kafka was designed from the beginning as a persistent distributed log.

---

## Why Kafka Has High Throughput

Kafka is fast because of several design choices.

### 1. Sequential Disk Writes

Kafka writes messages by appending to logs.

```text
Append
Append
Append
Append
```

Sequential writes are much faster than random writes.

---

### 2. OS Page Cache

Kafka relies heavily on the operating system page cache.

When Kafka writes data, the OS keeps recently used disk pages in RAM.

```text
Producer
   |
Kafka Broker
   |
OS Page Cache
   |
Disk
```

Consumers often read from memory instead of disk.

Example:

If Kafka writes:

```text
Offset 0 -> Order1
Offset 1 -> Order2
Offset 2 -> Order3
```

and a consumer reads soon after, the data may already be in the OS page cache.

Interview answer:

> Kafka is fast because it uses sequential writes, batching, OS page cache, zero-copy transfer, and partition-based parallelism.

---

### 3. Zero-Copy Transfer

Normally, sending data from disk to network involves multiple copies:

```text
Disk
 ↓
Kernel Buffer
 ↓
Application Buffer
 ↓
Kernel Socket Buffer
 ↓
Network
```

Kafka uses the operating system's `sendfile()` mechanism to reduce copying.

Simplified flow:

```text
Disk
 ↓
Kernel
 ↓
Network
```

The Kafka broker does not need to load all data into JVM application memory before sending it to consumers.

Benefits:

- Lower CPU usage
- Lower memory overhead
- Higher throughput

---

### 4. Batching

Kafka sends messages in batches.

Instead of:

```text
1 network call -> 1 message
```

Kafka can do:

```text
1 network call -> many messages
```

This greatly improves throughput.

---

### 5. Partition-Based Parallelism

Multiple partitions allow parallel reads and writes.

```text
orders-topic

P0 -> Consumer-1
P1 -> Consumer-2
P2 -> Consumer-3
```

---

## Partition Selection

When a producer sends a message, Kafka decides which partition receives it.

There are three common approaches:

1. Round-robin partitioning
2. Key-based partitioning
3. Custom partitioning

---

### Round-Robin Partitioning

If no key is provided, Kafka may distribute messages across partitions.

```js
await producer.send({
  topic: "orders",
  messages: [
    {
      value: JSON.stringify(order),
    },
  ],
});
```

Example:

```text
Message1 -> P0
Message2 -> P1
Message3 -> P2
Message4 -> P0
```

Benefit:

- Good load distribution

Problem:

- Ordering for related messages may break

---

### Key-Based Partitioning

If a key is provided, Kafka uses the key to select a partition.

```js
await producer.send({
  topic: "orders",
  messages: [
    {
      key: "customer-123",
      value: JSON.stringify(order),
    },
  ],
});
```

Kafka computes conceptually:

```text
hash(key) % numberOfPartitions
```

Example:

```text
hash("customer-123") % 3 = 2
```

So all events for `customer-123` go to partition `P2`.

This preserves ordering for that customer.

---

### Good Partition Keys

The partition key should represent the entity whose ordering matters.

Examples:

| Domain       | Good Key                                   |
| ------------ | ------------------------------------------ |
| E-commerce   | `customerId`, `orderId`                    |
| Banking      | `accountId`, `transactionId`, `customerId` |
| Ride-hailing | `rideId`, `driverId`                       |
| Payments     | `paymentId`, `merchantId`                  |

---

### Bad Partition Key

Using the same key for every message is bad.

```js
key = "orders";
```

Result:

```text
All messages -> Same partition
```

This creates a hot partition and removes parallelism.

---

## What Happens When New Partitions Are Added?

Suppose the topic has 3 partitions.

```text
P0
P1
P2
```

For customer `123`:

```text
hash("123") % 3 = 2
```

So messages go to `P2`.

Later, partitions increase to 6.

```text
P0
P1
P2
P3
P4
P5
```

Now:

```text
hash("123") % 6 = 4
```

Future messages may go to `P4`.

Existing messages remain in `P2`.

This means the customer's history may be split:

```text
Old events -> P2
New events -> P4
```

Ordering within each partition remains valid, but key affinity across old and new events can be affected.

Best practice:

> Plan partition count carefully upfront because increasing partitions later can change key-to-partition mapping.

---

## Partition and Consumer Relationship

Important rule:

> Within one consumer group, one partition can be assigned to only one consumer at a time.

Example with one partition and three consumers in the same group:

```text
Topic: orders

P0 -> Consumer-1

Consumer-2 idle
Consumer-3 idle
```

Example with three partitions and three consumers:

```text
P0 -> Consumer-1
P1 -> Consumer-2
P2 -> Consumer-3
```

Example with six partitions and three consumers:

```text
Consumer-1 -> P0, P1
Consumer-2 -> P2, P3
Consumer-3 -> P4, P5
```

Maximum parallelism in a consumer group is limited by the number of partitions.

If a topic has 5 partitions and 100 consumers in the same group, only 5 consumers can actively process messages.

---

## Consumer Groups and Rebalancing

### Why Consumer Groups Exist

If one consumer cannot keep up, Kafka allows more consumers in the same group.

```text
orders-topic

P0 -> C1
P1 -> C2
P2 -> C3
```

This allows parallel processing.

---

### Rebalancing

Rebalancing is the process where Kafka redistributes partitions among consumers when group membership changes.

Triggers:

- New consumer joins
- Consumer leaves
- Consumer crashes
- Session timeout
- Topic partition count changes

Example before:

```text
C1 -> P0
C2 -> P1
C3 -> P2
```

If `C2` crashes:

```text
C1 -> P0, P1
C3 -> P2
```

---

### How Kafka Detects Consumer Failure

Kafka does not directly detect a crash. It detects missing heartbeats.

Each consumer periodically sends heartbeats to the group coordinator.

```text
Consumer -> "I'm alive"
Consumer -> "I'm alive"
Consumer -> "I'm alive"
```

If heartbeats stop for longer than `session.timeout.ms`, Kafka assumes the consumer is dead and triggers a rebalance.

Kafka cannot distinguish between:

- Process crash
- Frozen process
- Long GC pause
- Network issue
- Stuck event loop
- Pod killed

It only knows that heartbeats stopped.

---

### Group Coordinator

Kafka elects a broker as the group coordinator for a consumer group.

Responsibilities:

- Manage group membership
- Receive heartbeats
- Track offsets
- Trigger rebalances
- Coordinate partition assignment

---

## Kubernetes Rolling Deployment and Kafka Rebalancing

In Kubernetes, a rolling deployment may create a new pod before terminating the old one.

Initial state:

```text
orders-topic

P0 -> C1
P1 -> C2
P2 -> C3
```

Deployment starts.

New pod starts:

```text
C4 joins
```

Kafka sees group membership change and triggers rebalance.

Then old pod terminates:

```text
C1 leaves
```

Kafka triggers another rebalance.

So one rolling update can cause:

```text
Consumer joins -> Rebalance
Consumer leaves -> Rebalance
```

---

### Graceful Shutdown in Node.js

Kafka consumers should handle `SIGTERM` properly.

```js
process.on("SIGTERM", async () => {
  try {
    await consumer.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown", error);
    process.exit(1);
  }
});
```

This allows the consumer to leave the group cleanly instead of waiting for session timeout.

---

### Eager vs Cooperative Rebalancing

Older Kafka clients used eager rebalancing:

```text
Stop all consumers
Revoke all partitions
Reassign partitions
Resume
```

This can cause pauses.

Modern Kafka clients support cooperative rebalancing:

```text
Move only necessary partitions
Keep unaffected consumers running
```

This reduces disruption during deployments and scaling.

---

## Consumer Lag

Consumer lag measures how far a consumer group is behind the latest produced messages.

Formula:

```text
Lag = LatestOffset - ConsumerOffset
```

Example:

```text
Latest offset   = 1,000,000
Consumer offset =   999,990

Lag = 10
```

Healthy.

Example:

```text
Latest offset   = 1,000,000
Consumer offset =   100,000

Lag = 900,000
```

Problem.

Common reasons for lag:

- Consumer processing is slow
- Too few partitions
- Too few consumers
- Database/downstream service is slow
- Consumer crashes repeatedly
- Rebalance storms
- Network issues
- Hot partitions

---

## Offset Management

Kafka uses offsets to track consumer progress.

Example:

```text
Partition-0

Offset 0 -> Order1
Offset 1 -> Order2
Offset 2 -> Order3
```

If a consumer has processed offset 1, it commits offset 2, meaning:

> Everything before offset 2 has been processed.

Offsets are stored in Kafka's internal topic:

```text
__consumer_offsets
```

The producer does not track consumer offsets.

---

### Auto Commit

With auto commit, Kafka periodically commits offsets automatically.

Example:

```js
await consumer.run({
  autoCommit: true,
  eachMessage: async ({ message }) => {
    await processMessage(message);
  },
});
```

Risk:

If offset is committed before business logic completes, a crash can cause message loss.

---

### Manual Commit

With manual commit, the application controls when offsets are committed.

```js
await consumer.run({
  autoCommit: false,
  eachMessage: async ({ topic, partition, message }) => {
    const order = JSON.parse(message.value.toString());

    await processOrder(order);

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

This follows:

```text
Process first
Commit later
```

Risk:

If processing succeeds but the consumer crashes before committing, the message will be replayed.

This creates duplicates, but avoids message loss.

Most production systems prefer duplicates over data loss.

---

## Delivery Guarantees

### At Most Once

Flow:

```text
Commit offset
Process message
```

Guarantee:

```text
No duplicates
Possible message loss
```

If the consumer crashes after committing but before processing, the message is lost.

---

### At Least Once

Flow:

```text
Process message
Commit offset
```

Guarantee:

```text
No message loss
Possible duplicates
```

If the consumer crashes after processing but before committing, the message is replayed.

This is the most common production approach.

---

### Exactly Once Semantics

Kafka Exactly Once Semantics, or EOS, combines:

- Idempotent producers
- Kafka transactions

EOS is mainly useful for Kafka-to-Kafka workflows.

Example:

```text
Input Topic
   ↓
Consumer/Processor
   ↓
Output Topic
```

Kafka can make the following atomic:

```text
Read message
Produce output message
Commit offset
```

Important interview trap:

> Kafka EOS does not automatically guarantee exactly-once behavior when external systems like PostgreSQL, MongoDB, Redis, or external APIs are involved.

Example:

```text
Kafka -> Consumer -> PostgreSQL
```

If the DB update succeeds but the consumer crashes before committing offset, Kafka may replay the message and the DB update may happen again.

For external systems, use idempotency.

Strong interview answer:

> Kafka EOS ensures exactly-once processing mainly within Kafka transactional boundaries. For external systems, idempotent consumers and business-level deduplication are still required.

---

## Idempotency

Idempotency means an operation can be safely repeated without changing the final result incorrectly.

Bad example:

```sql
UPDATE accounts
SET balance = balance + 100
WHERE account_id = 'A1';
```

If run twice, balance increases by 200.

Better approach:

```sql
INSERT INTO processed_transactions(transaction_id)
VALUES ('TX123');
```

with a unique constraint.

If `TX123` is processed again, the system detects it and ignores the duplicate.

Common idempotency keys:

- `eventId`
- `transactionId`
- `orderId`
- `paymentId`
- `requestId`

---

## Dead Letter Queue

A Dead Letter Queue, or DLQ, is a separate topic for messages that cannot be processed successfully.

Example:

```text
orders-topic
     ↓
Consumer
     ↓
Failure after retries
     ↓
orders-dlq
```

Use DLQ for:

- Poison messages
- Invalid payloads
- Repeated processing failures
- Events requiring manual investigation

After moving a message to DLQ, commit the original offset.

Otherwise, the consumer will keep retrying the same bad message forever and block the partition.

---

## Replication and Fault Tolerance

Replication protects data from broker failure.

Example:

```text
Replication Factor = 3

P0 leader   -> Broker-1
P0 follower -> Broker-2
P0 follower -> Broker-3
```

Replication factor means total number of copies.

With RF=3:

```text
1 leader
2 followers
```

The replication factor cannot exceed the number of brokers.

---

### Leader and Followers

Each partition has one leader and zero or more followers.

The leader handles:

- Producer writes
- Consumer reads

Followers replicate data from the leader.

Producers do not write directly to followers.

---

### ISR: In-Sync Replicas

ISR means replicas that are caught up with the leader.

Example:

```text
Leader -> Offset 500
F1     -> Offset 500
F2     -> Offset 500

ISR = {Leader, F1, F2}
```

If one follower falls behind:

```text
Leader -> Offset 1000
F1     -> Offset 1000
F2     -> Offset 850

ISR = {Leader, F1}
```

Kafka removes lagging replicas from ISR.

---

### Leader Election

If the leader broker crashes, Kafka elects a new leader from ISR.

Why only ISR?

Because promoting a stale replica can cause data loss.

Example:

```text
Leader -> Offset 1000
F1     -> Offset 1000
F2     -> Offset 850
```

If F2 becomes leader, offsets 851-1000 may be lost.

---

## Producer Acknowledgements

Kafka producer can use different acknowledgement settings.

### acks=0

Producer sends the message and does not wait for acknowledgement.

Fastest but least safe.

Risk:

- Message may be lost if broker fails.

---

### acks=1

Producer waits for the leader to write the message.

Balanced but still risky.

Risk:

- Leader writes successfully.
- Followers have not replicated yet.
- Leader crashes.
- Message may be lost.

---

### acks=all

Producer waits for all in-sync replicas to acknowledge.

Safest but slower.

Production recommendation:

```properties
acks=all
replication.factor=3
min.insync.replicas=2
```

---

### min.insync.replicas

This defines the minimum number of in-sync replicas required for writes.

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
Writes are rejected
```

This trades availability for durability.

---

## Kafka Storage Internals

Kafka is a distributed append-only log.

A topic partition is stored as log files on disk.

Conceptually:

```text
orders-0/
  00000000000000000000.log
  00000000000000000000.index
  00000000000000000000.timeindex
```

---

### Log File

Contains actual messages.

```text
Offset 0 -> Order1
Offset 1 -> Order2
Offset 2 -> Order3
```

---

### Index File

Contains pointers to quickly locate offsets in the log.

Think of it as a table of contents.

---

### Log Segments

Kafka does not store one giant log file.

It splits partition logs into segments.

Example:

```text
Segment-1: Offset 0      - 99,999
Segment-2: Offset 100000 - 199,999
Segment-3: Offset 200000 - 299,999
```

Benefits:

- Easier retention cleanup
- Easier indexing
- Easier file management
- Better operational efficiency

---

### Active Segment

Only one segment is active for writes at a time.

When it reaches configured size or time, Kafka rolls to a new segment.

---

## Retention

Kafka does not delete messages immediately after consumption.

Data is deleted based on retention policies.

Examples:

```properties
retention.ms=604800000
```

Seven days.

```properties
retention.bytes=107374182400
```

100 GB.

Important:

> Retention is independent of consumption.

This is why Kafka supports replay.

---

### Replay

Consumers can reread old events by resetting offsets, as long as data still exists.

Basic KafkaJS example:

```js
await consumer.subscribe({
  topic: "orders",
  fromBeginning: true,
});
```

This causes the consumer group to read from the beginning if no committed offset exists.

For existing groups, offsets can be reset using Kafka admin tooling.

---

### If Retention Expired

If Kafka deleted old offsets due to retention, replay is impossible.

Example:

```text
Offsets 0-50000 deleted
Consumer resets to offset 0
Kafka cannot serve deleted data
```

---

## Log Compaction

Log compaction keeps the latest value for each key.

Before compaction:

```text
Offset 0 -> Customer123 = Bronze
Offset 1 -> Customer123 = Silver
Offset 2 -> Customer123 = Gold
```

After compaction:

```text
Offset 2 -> Customer123 = Gold
```

Useful for:

- Customer profiles
- Account state
- Inventory state
- Configuration data
- Latest status per entity

---

### Retention vs Compaction

| Retention                      | Compaction                 |
| ------------------------------ | -------------------------- |
| Deletes data based on age/size | Keeps latest value per key |
| Useful for event history       | Useful for latest state    |
| Time/size based                | Key based                  |

---

### Tombstone Records

A tombstone record has a key and a null value.

Example:

```json
{
  "key": "Customer123",
  "value": null
}
```

In compacted topics, tombstones indicate deletion. Kafka eventually removes the key.

---

## Kafka Design Patterns

## Event-Driven Architecture

Services communicate through events instead of direct synchronous calls.

Example:

```text
Order Service
      |
      v
ORDER_CREATED
      |
      v
Kafka
      |
      +---- Payment Service
      +---- Inventory Service
      +---- Notification Service
      +---- Analytics Service
```

Benefits:

- Loose coupling
- Independent scaling
- Fault isolation
- Async processing
- Replayable events
- Easier integration of new consumers

---

## Outbox Pattern

The Outbox Pattern solves the dual-write problem.

Problem:

```js
await saveOrderToDB();
await publishToKafka();
```

If DB save succeeds but Kafka publish fails, the system becomes inconsistent.

Solution:

Store business data and event data in the same database transaction.

```sql
BEGIN;

INSERT INTO orders (...);

INSERT INTO outbox (
  event_type,
  payload,
  status
) VALUES (
  'ORDER_CREATED',
  '{...}',
  'PENDING'
);

COMMIT;
```

Then a separate worker publishes pending outbox events to Kafka.

Node.js example:

```js
await db.transaction(async (trx) => {
  await trx("orders").insert({
    order_id: order.id,
    customer_id: order.customerId,
    amount: order.amount,
  });

  await trx("outbox").insert({
    event_type: "ORDER_CREATED",
    payload: JSON.stringify(order),
    status: "PENDING",
  });
});
```

Outbox publisher:

```js
const pendingEvents = await db("outbox")
  .where({ status: "PENDING" })
  .limit(100);

for (const event of pendingEvents) {
  await producer.send({
    topic: "orders",
    messages: [
      {
        key: event.aggregate_id,
        value: event.payload,
      },
    ],
  });

  await db("outbox").where({ id: event.id }).update({ status: "PUBLISHED" });
}
```

Best practice:

- Use idempotency in publisher
- Mark events as published only after Kafka success
- Add retry count
- Add DLQ/manual review status
- Use CDC if polling becomes inefficient

---

## CDC: Change Data Capture

CDC captures database changes from the database transaction log and streams them to Kafka.

Examples:

- PostgreSQL WAL
- MySQL Binlog
- MongoDB Oplog

Architecture:

```text
Database
   |
   v
CDC Tool
   |
   v
Kafka
```

---

### Debezium

Debezium is a popular open-source CDC platform.

It captures database changes and publishes them to Kafka.

Architecture:

```text
PostgreSQL
    |
    v
Debezium
    |
    v
Kafka
```

Common use cases:

- Outbox Pattern with CDC
- Database replication
- Audit event generation
- Legacy system integration

Interview answer:

> Debezium is an open-source CDC platform that reads database transaction logs and streams changes into Kafka.

---

## Saga Pattern

Saga Pattern manages distributed transactions across microservices using local transactions and compensating actions.

Problem:

In a monolith, one transaction can cover all operations.

```sql
BEGIN;

Create Order;
Take Payment;
Reserve Inventory;
Create Shipment;

COMMIT;
```

In microservices, each service owns its own database.

```text
Order DB
Payment DB
Inventory DB
Shipping DB
```

A single ACID transaction across all services is difficult and usually avoided.

---

### Saga Solution

Break the business flow into local transactions.

If a later step fails, publish compensation events to undo previous successful steps.

---

### E-commerce Saga Example

Success path:

```text
ORDER_CREATED
      ↓
PAYMENT_COMPLETED
      ↓
INVENTORY_RESERVED
      ↓
SHIPMENT_CREATED
```

Failure path:

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

---

### Compensating Transactions

| Original Action   | Compensation        |
| ----------------- | ------------------- |
| Charge card       | Refund card         |
| Reserve inventory | Release inventory   |
| Create booking    | Cancel booking      |
| Allocate seat     | Free seat           |
| Debit account     | Credit back account |

A compensating transaction logically reverses a previous successful step.

---

### Choreography Saga

No central coordinator. Services react to events.

Example:

```text
Order Service publishes ORDER_CREATED
Payment Service consumes and publishes PAYMENT_COMPLETED
Inventory Service consumes and publishes INVENTORY_RESERVED
Shipping Service consumes and publishes SHIPMENT_CREATED
```

Advantages:

- Loosely coupled
- Natural fit with Kafka
- No central controller

Disadvantages:

- Hard to understand full workflow as system grows
- Can lead to event spaghetti
- Debugging becomes harder

---

### Orchestration Saga

A central orchestrator controls the workflow.

```text
Saga Orchestrator
      |
      +---- Order Service
      +---- Payment Service
      +---- Inventory Service
      +---- Shipping Service
```

Advantages:

- Easier to understand
- Easier to debug
- Centralized business flow

Disadvantages:

- Orchestrator becomes central brain
- More coupling to workflow
- Potential bottleneck

---

### Saga and Eventual Consistency

Saga does not give immediate consistency.

It gives eventual consistency.

Temporary states are possible:

```text
Payment completed
Inventory reserved
Shipping pending
```

The system becomes consistent after all events and compensations finish.

---

### Saga in Banking

Money transfer example:

```text
TRANSFER_REQUESTED
      ↓
DEBIT_COMPLETED
      ↓
CREDIT_FAILED
      ↓
DEBIT_REVERSED
      ↓
TRANSFER_FAILED
```

For financial systems, Saga should be combined with:

- Idempotency keys
- Audit logs
- Outbox Pattern
- Reconciliation jobs
- Strict monitoring
- Manual recovery workflows

---

## Event Sourcing

Event Sourcing stores events as the source of truth instead of storing only current state.

Traditional state:

```text
Balance = 1000
```

Event-sourced state:

```text
AccountCreated
Deposit 500
Deposit 700
Withdraw 200
```

Current state is derived by replaying events.

Benefits:

- Complete audit trail
- Replayability
- Time travel/debugging
- Strong history tracking

Challenges:

- Increased complexity
- Schema evolution
- Snapshotting needed for performance
- Harder querying

---

## CQRS

CQRS means Command Query Responsibility Segregation.

It separates write models and read models.

```text
Write Model
    |
    v
Kafka Events
    |
    v
Read Model
```

Benefits:

- Independent read/write scaling
- Optimized read models
- Useful with event-driven systems
- Works well with event sourcing

Example:

```text
Order Service writes order
Kafka publishes ORDER_CREATED
Order Summary Service updates read database
```

---

## Practical Node.js Kafka

### Install KafkaJS

```bash
npm install kafkajs
```

---

### Kafka Client

```js
const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "order-service",
  brokers: ["localhost:9092"],
});
```

---

### Producer

```js
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
          createdAt: new Date().toISOString(),
        }),
      },
    ],
  });
}
```

---

### Consumer

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

### Idempotent Consumer Example

```js
async function processPayment(event) {
  const alreadyProcessed = await db("processed_events")
    .where({ event_id: event.eventId })
    .first();

  if (alreadyProcessed) {
    return;
  }

  await db.transaction(async (trx) => {
    await chargePayment(event);

    await trx("processed_events").insert({
      event_id: event.eventId,
      processed_at: new Date(),
    });
  });
}
```

---

### DLQ Example

```js
async function sendToDLQ({ producer, message, error }) {
  await producer.send({
    topic: "orders-dlq",
    messages: [
      {
        key: message.key?.toString(),
        value: message.value.toString(),
        headers: {
          errorMessage: error.message,
          failedAt: new Date().toISOString(),
        },
      },
    ],
  });
}
```

---

## Examples

## Example 1: Order Created Flow

```text
Order Service
   |
   v
orders topic
   |
   +---- payment-group
   |
   +---- inventory-group
   |
   +---- notification-group
```

Producer event:

```json
{
  "eventId": "evt-1001",
  "eventType": "ORDER_CREATED",
  "orderId": "ORD-1001",
  "customerId": "CUST-123",
  "amount": 500
}
```

Partition key:

```text
customerId
```

Reason:

```text
Same customer -> Same partition -> Ordering preserved
```

---

## Example 2: Payment Consumer Failure

Flow:

```text
Consumer reads ORDER_CREATED
Payment is charged
Consumer crashes before offset commit
Kafka replays ORDER_CREATED
```

Risk:

```text
Double charge
```

Solution:

Use idempotency with `eventId` or `paymentId`.

---

## Example 3: Bad Message and DLQ

Message contains invalid payload.

Consumer retries:

```text
Attempt 1 -> fail
Attempt 2 -> fail
Attempt 3 -> fail
```

Then:

```text
Send to orders-dlq
Commit original offset
Continue processing next messages
```

---

## Example 4: Broker Failure

Configuration:

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

## Example 5: Replay Events

Analytics service had a bug for one day.

Kafka retained events for 7 days.

After fixing analytics:

```text
Reset analytics-group offset to older offset
Replay events
Rebuild analytics
```

Replay is possible only if the data still exists according to retention.

---

## Best Practices

### Topic and Partition Design

- Choose partition keys based on ordering requirements.
- Avoid using the same key for all events.
- Plan partition count upfront.
- Avoid increasing partitions casually because key mapping may change.
- Keep messages reasonably small.
- Use meaningful topic names.

---

### Producer Best Practices

- Use keys when ordering matters.
- Use `acks=all` for critical systems.
- Enable idempotent producers where supported.
- Use compression for high-throughput workloads.
- Tune batching with `batch.size` and `linger.ms`.
- Handle retries carefully.
- Avoid fire-and-forget for critical data.

---

### Consumer Best Practices

- Prefer manual commit for important workflows.
- Process first, commit later.
- Make consumers idempotent.
- Use DLQ for poison messages.
- Monitor consumer lag.
- Handle graceful shutdown.
- Avoid long blocking operations in message handlers.
- Keep processing time predictable.
- Use retries with limits.

---

### Reliability Best Practices

- Use replication factor 3 for production.
- Use `min.insync.replicas=2`.
- Use `acks=all` for critical topics.
- Monitor ISR shrinkage.
- Monitor broker health.
- Avoid unclean leader election unless data loss is acceptable.
- Use multiple brokers across availability zones when possible.

---

### Kubernetes Best Practices

- Handle `SIGTERM` in consumers.
- Allow enough termination grace period.
- Use cooperative rebalancing where possible.
- Avoid frequent unnecessary restarts.
- Monitor rebalance frequency.
- Scale consumers according to partition count.
- Use readiness probes carefully.

---

### Event Design Best Practices

- Include `eventId`.
- Include `eventType`.
- Include timestamp.
- Include schema version.
- Use stable business keys.
- Avoid leaking internal DB models directly as events.
- Prefer immutable events.
- Design for backward compatibility.

Example:

```json
{
  "eventId": "evt-1001",
  "eventType": "ORDER_CREATED",
  "schemaVersion": 1,
  "occurredAt": "2026-05-31T10:00:00Z",
  "payload": {
    "orderId": "ORD-1001",
    "customerId": "CUST-123",
    "amount": 500
  }
}
```

---

### Distributed System Best Practices

- Use Outbox Pattern for DB + Kafka consistency.
- Use idempotent consumers.
- Use Saga for distributed workflows.
- Use compensation events for failures.
- Use audit logs for critical domains.
- Add reconciliation jobs for financial workflows.
- Use DLQs and manual recovery tools.

---

## Common Mistakes

### Mistake 1: Thinking Kafka Is Just a Queue

Kafka is a distributed append-only event log, not just a queue.

---

### Mistake 2: Saying Kafka Guarantees Global Ordering

Kafka guarantees order only within a partition.

---

### Mistake 3: Adding More Consumers Without More Partitions

If a topic has 3 partitions, only 3 consumers in the same group can actively process messages.

Adding 20 consumers will not improve throughput unless partitions increase.

---

### Mistake 4: Using One Static Key for All Messages

This sends all events to one partition and creates a bottleneck.

---

### Mistake 5: Ignoring Partition Growth Impact

Increasing partitions can change key-to-partition mapping.

---

### Mistake 6: Using Auto Commit Blindly

Auto commit can cause message loss if offsets are committed before processing finishes.

---

### Mistake 7: Not Making Consumers Idempotent

Kafka commonly gives at-least-once delivery, so duplicate processing must be expected.

---

### Mistake 8: Assuming Kafka EOS Covers External Databases

Kafka EOS mainly applies within Kafka transactional workflows. External systems still need idempotency.

---

### Mistake 9: Not Handling Poison Messages

Without DLQ, one bad message can block a partition indefinitely.

---

### Mistake 10: Publishing to Kafka Directly After DB Commit Without Outbox

This creates a dual-write inconsistency risk.

---

### Mistake 11: Confusing Retention with Consumption

Kafka does not delete a message just because it was consumed.

---

### Mistake 12: Thinking RabbitMQ Cannot Persist Messages

RabbitMQ can persist messages, but Kafka's storage model is fundamentally log-based and built for replay.

---

### Mistake 13: Ignoring Consumer Lag

Consumer lag is one of the most important production signals.

---

### Mistake 14: Not Handling Kubernetes Shutdown Gracefully

If consumers do not disconnect cleanly, Kafka waits for session timeout and rebalancing is slower.

---

## Interview Questions

## Basic Kafka Questions

### What is Kafka?

Kafka is a distributed event streaming platform used to store, process, and distribute streams of events with high throughput, durability, scalability, and fault tolerance.

---

### Why use Kafka?

Use Kafka to decouple services, process events asynchronously, support high-throughput event streams, enable replay, and build scalable event-driven systems.

---

### What problem does Kafka solve?

Kafka solves service coupling, high-volume event distribution, asynchronous processing, durable event storage, and replay.

---

### What is a topic?

A topic is a logical stream/category of events.

---

### What is a partition?

A partition is a physical subdivision of a topic that enables parallelism and ordering within that partition.

---

### What is an offset?

An offset is the position of a message inside a partition.

---

### What is a broker?

A broker is a Kafka server that stores partitions and handles producer/consumer requests.

---

## Partition and Ordering Questions

### Does Kafka guarantee ordering?

Kafka guarantees ordering only within a partition, not across partitions.

---

### How do you guarantee ordering for one customer?

Use `customerId` as the message key so all events for that customer go to the same partition.

---

### Can multiple consumers read the same partition?

Within the same consumer group, no. A partition can be assigned to only one consumer.

Across different consumer groups, yes. Multiple groups can independently consume the same partition.

---

### What happens if there are more consumers than partitions?

Extra consumers remain idle.

---

### What happens if partitions are increased later?

Key-to-partition mapping can change because partition selection uses the partition count. Existing records remain in old partitions, but future records for the same key may go to different partitions.

---

## Consumer Group Questions

### What is a consumer group?

A consumer group is a set of consumers that work together to process topic partitions.

---

### Why do we need consumer groups?

Consumer groups allow parallel processing and scalability.

---

### What is rebalancing?

Rebalancing is the process of redistributing partitions among consumers when group membership changes.

---

### What triggers a rebalance?

- Consumer joins
- Consumer leaves
- Consumer crashes
- Session timeout
- Partition count changes

---

### How does Kafka detect consumer crash?

Kafka does not directly detect a crash. It detects missing heartbeats. If heartbeats stop beyond `session.timeout.ms`, the consumer is considered dead.

---

### What happens during Kubernetes rolling deployment?

A new consumer pod may join first, triggering a rebalance. Then the old pod leaves, triggering another rebalance. Graceful shutdown and cooperative rebalancing reduce disruption.

---

## Offset Questions

### Where are consumer offsets stored?

Offsets are stored in Kafka's internal `__consumer_offsets` topic.

---

### Does the producer track consumer offsets?

No. Producers only publish messages. Consumer groups track offsets.

---

### What is auto commit?

Auto commit periodically commits offsets automatically.

---

### What is manual commit?

Manual commit allows the application to commit offsets after successful processing.

---

### What happens if a consumer crashes after processing but before committing offset?

Kafka replays the message, causing possible duplicate processing.

---

## Delivery Guarantee Questions

### What is at-most-once delivery?

A message is processed zero or one time. No duplicates, but message loss is possible.

---

### What is at-least-once delivery?

A message is processed one or more times. No loss, but duplicates are possible.

---

### What is exactly-once semantics?

Kafka EOS uses idempotent producers and transactions to ensure Kafka-to-Kafka processing can be atomic and duplicate-free within Kafka transactional boundaries.

---

### Does Kafka EOS guarantee exactly once with PostgreSQL?

No. External systems still need idempotency or transactional patterns.

---

### How do you handle duplicate Kafka messages?

Use idempotent consumers with unique business keys such as `eventId`, `transactionId`, or `paymentId`.

---

## Replication Questions

### What is replication factor?

Replication factor is the total number of copies of a partition.

---

### What is leader and follower?

The leader handles reads and writes. Followers replicate from the leader.

---

### What is ISR?

ISR stands for In-Sync Replicas. These replicas are caught up with the leader.

---

### Why does Kafka elect leaders only from ISR?

To avoid promoting stale replicas that may cause data loss.

---

### What is `acks=all`?

The producer waits for all in-sync replicas to acknowledge the write.

---

### Can Kafka lose data?

Yes, depending on replication configuration, acknowledgements, ISR status, and leader election settings.

---

### Recommended production reliability config?

```properties
replication.factor=3
min.insync.replicas=2
acks=all
```

---

## Storage Questions

### How does Kafka store data?

Kafka stores data as append-only logs split into segments.

---

### Why is Kafka fast?

Kafka is fast because of sequential disk writes, batching, OS page cache, zero-copy transfer, and partition parallelism.

---

### What is OS page cache?

OS page cache is memory managed by the operating system to cache recently used disk data. Kafka benefits because consumers often read recently written data directly from memory.

---

### What is zero-copy transfer?

Zero-copy transfer allows Kafka to send data from disk/page cache to network without copying it through application memory, reducing CPU and memory overhead.

---

### What is retention?

Retention defines how long or how much data Kafka keeps before deleting old segments.

---

### Does Kafka delete messages after consumption?

No. Kafka deletes data based on retention policy, not consumption.

---

### What is log compaction?

Log compaction keeps the latest value for each key.

---

### What is a tombstone?

A tombstone is a record with a key and null value used to delete a key in compacted topics.

---

## Design Pattern Questions

### What is Event-Driven Architecture?

An architecture where services communicate through events rather than direct synchronous calls.

---

### What is the Outbox Pattern?

A pattern where business data and event data are saved in the same database transaction, and a separate process publishes events to Kafka.

---

### Why not directly publish to Kafka after DB commit?

Because DB commit may succeed and Kafka publish may fail, causing inconsistent state.

---

### What is CDC?

Change Data Capture captures database changes from transaction logs and streams them to Kafka.

---

### What is Debezium?

Debezium is an open-source CDC platform that streams database changes to Kafka.

---

### What is Saga Pattern?

Saga is a distributed transaction pattern using multiple local transactions and compensating actions.

---

### Choreography vs Orchestration Saga?

Choreography uses events and no central coordinator.

Orchestration uses a central coordinator to control the workflow.

---

### What is eventual consistency?

Eventual consistency means the system may be temporarily inconsistent but becomes consistent after all events and compensations complete.

---

## Scenario-Based Interview Questions

### Payment service consumes Kafka events. How do you prevent double charging?

Use at-least-once delivery with idempotent consumers. Store a unique payment ID or event ID and ignore duplicates.

---

### Consumer lag is increasing. What do you check?

Check:

- Consumer processing time
- Number of partitions
- Number of active consumers
- Downstream DB/API latency
- Rebalance frequency
- Hot partitions
- Network issues
- Consumer errors

---

### A message keeps failing and blocks processing. What do you do?

Use retries with a limit, then send the message to a DLQ and commit the offset.

---

### A broker dies with RF=3, min.insync.replicas=2, acks=all. Can producers still write?

Yes, if two replicas remain in ISR.

---

### Two brokers die with RF=3, min.insync.replicas=2, acks=all. Can producers still write?

No. ISR size is below the minimum required replicas, so Kafka rejects writes.

---

### Design an order placement flow using Kafka.

Use:

- `ORDER_CREATED`
- Payment consumer
- Inventory consumer
- Notification consumer
- Saga Pattern for workflow
- Outbox Pattern for DB + Kafka consistency
- Idempotent consumers
- DLQ for failed events
- Manual offset commit

---

## Related Topics

### Kafka Connect

Kafka Connect is a framework for moving data into and out of Kafka without writing custom producer/consumer code.

Source connector:

```text
Database -> Kafka
```

Sink connector:

```text
Kafka -> Elasticsearch / S3 / Database
```

Common questions:

- What is Kafka Connect?
- Source vs Sink connector?
- Why use Kafka Connect instead of custom code?

---

### Schema Registry

Schema Registry manages schemas for Kafka events.

Common formats:

- Avro
- Protobuf
- JSON Schema

Why needed:

- Prevent breaking consumers
- Support schema evolution
- Enforce compatibility

Important concepts:

- Backward compatibility
- Forward compatibility
- Full compatibility

---

### Kafka Streams

Kafka Streams is a library for stream processing.

Use cases:

- Filtering
- Aggregation
- Joins
- Windowing
- Enrichment

Example:

```text
orders-topic
    |
    v
Kafka Streams
    |
    v
aggregated-orders-topic
```

---

### KRaft vs ZooKeeper

Older Kafka clusters used ZooKeeper for metadata management.

Modern Kafka uses KRaft mode, removing the ZooKeeper dependency.

Topics to study:

- Kafka controller
- Metadata quorum
- Broker registration
- Why ZooKeeper was removed

---

### Performance Tuning

Producer settings:

```properties
batch.size
linger.ms
compression.type
acks
retries
enable.idempotence
```

Consumer settings:

```properties
max.poll.records
fetch.min.bytes
fetch.max.wait.ms
session.timeout.ms
heartbeat.interval.ms
```

Broker/topic settings:

```properties
num.partitions
replication.factor
retention.ms
segment.bytes
min.insync.replicas
```

---

### Operational Kafka

Important production topics:

- Consumer lag monitoring
- Rebalance storms
- Hot partitions
- Large messages
- Broker disk usage
- ISR shrinkage
- Under-replicated partitions
- Retention tuning
- Multi-AZ deployment
- Rack awareness
- MirrorMaker for cross-region replication

---

### System Design Practice

Kafka is commonly used in:

- E-commerce order processing
- Payment processing
- Banking transaction flows
- Notification platforms
- Fraud detection
- Ride booking systems
- Analytics pipelines
- Audit logging
- Event-driven microservices
- CDC pipelines

---

## Revision Notes

### One-Line Kafka Definition

Kafka is a distributed append-only event log used for high-throughput, durable, scalable event streaming.

---

### Core Mental Model

```text
Producer -> Topic -> Partition -> Offset -> Consumer Group
```

---

### Ordering Rule

```text
Ordering is guaranteed only within a partition.
```

---

### Parallelism Rule

```text
Maximum active consumers in one group = number of partitions.
```

---

### Consumer Group Rule

```text
Same group ID = work sharing.
Different group ID = independent consumption.
```

---

### Offset Rule

```text
Committed offset means all earlier messages are considered processed.
```

---

### Safe Commit Rule

```text
Process first, commit later.
```

This gives at-least-once delivery.

---

### Duplicate Handling Rule

```text
At-least-once delivery requires idempotent consumers.
```

---

### Partition Key Rule

```text
Use the entity ID whose ordering matters.
```

Examples:

```text
customerId
accountId
orderId
paymentId
rideId
```

---

### Partition Increase Rule

```text
Increasing partitions can change key-to-partition mapping.
```

Plan partition count carefully.

---

### Replay Rule

```text
Kafka can replay only if the data still exists according to retention.
```

---

### Retention Rule

```text
Kafka deletes data based on time/size retention, not based on consumption.
```

---

### Replication Rule

```text
RF=3 means 3 total copies: 1 leader and 2 followers.
```

---

### ISR Rule

```text
New leaders should be elected from ISR to avoid data loss.
```

---

### Safe Producer Config

```properties
acks=all
replication.factor=3
min.insync.replicas=2
```

---

### Kafka Performance Checklist

Kafka is fast because of:

- Sequential disk writes
- Append-only log
- OS page cache
- Zero-copy transfer
- Batching
- Partition parallelism

---

### EOS Memory Trick

```text
At Most Once
= No duplicates, possible loss

At Least Once
= No loss, possible duplicates

Exactly Once
= No loss, no duplicates within Kafka transactional boundaries
```

---

### Outbox Pattern Memory Trick

```text
Do not do:
Save DB -> Publish Kafka

Do:
Save DB + Save Outbox in same transaction
Then publish outbox to Kafka
```

---

### Saga Memory Trick

```text
Saga = local transactions + compensation events + eventual consistency
```

---

### Choreography vs Orchestration

```text
Choreography = services react to events
Orchestration = central coordinator controls flow
```

---

### DLQ Rule

```text
Retry limited times -> Send to DLQ -> Commit offset -> Continue
```

---

### Kubernetes Rule

```text
Handle SIGTERM -> Commit/stop safely -> Disconnect consumer -> Leave group gracefully
```

---

### Senior Interview Must-Know List

Must be able to explain:

- Kafka vs RabbitMQ
- Kafka vs REST
- Kafka vs DB polling
- Topic, partition, offset
- Consumer group and rebalancing
- Heartbeats and session timeout
- Offset commit
- At-most-once, at-least-once, exactly-once
- Idempotency
- DLQ
- Replication factor
- Leader/follower
- ISR
- `acks`
- `min.insync.replicas`
- Retention
- Log compaction
- OS page cache
- Zero-copy transfer
- Outbox Pattern
- CDC and Debezium
- Saga Pattern
- Consumer lag
- Hot partitions
- Kafka with Kubernetes

---

### Recommended Remaining Learning Path

1. Kafka Connect
2. Schema Registry
3. Avro and Protobuf
4. Kafka Streams
5. KRaft vs ZooKeeper
6. Performance tuning
7. Consumer lag debugging
8. Hot partition handling
9. Rebalance storm handling
10. Kafka system design scenarios
11. Node.js production Kafka project
12. Outbox Pattern implementation
13. Debezium-based CDC pipeline
14. Payment/banking event-driven design practice
