# Node.js Microservices & Distributed Systems

## Source Topics

- **Topic 26** — Microservices Communication: REST, gRPC, Kafka & Events
- **Topic 27** — Distributed Systems Reliability: Timeouts, Retries, Backoff, Circuit Breaker, Bulkheads & Rate Limiting

> This file consolidates Topics 26–27 from the original Node.js preparation conversation. It is intentionally revision-oriented while retaining the Senior/SDE3/Architect interview framing, enterprise examples, reliability patterns, and practical Node.js code discussed in the source.

---

# 1. Microservices Communication

The central architectural question is:

> **Should the caller wait for an answer, or should the work/event be processed asynchronously?**

There are two fundamental styles.

```text
                 Microservices Communication
                           │
             ┌─────────────┴─────────────┐
             │                           │
        Synchronous                Asynchronous
             │                           │
        ┌────┴────┐                 ┌────┴────┐
        │         │                 │         │
      REST      gRPC              Kafka     Queue
        │         │                 │
        ▼         ▼                 ▼
   Need answer  Internal RPC     Event / async
                                  processing
```

### Synchronous

Service A waits for Service B.

```text
Service A
   │
   │ HTTP / gRPC
   ▼
Service B
   │
   ▼
Response
   │
   ▼
Service A continues
```

Examples:

- REST
- gRPC

### Asynchronous

Service A sends a message/event and does not need to wait for Service B to finish.

```text
Service A
   │
   │ Event
   ▼
 Kafka / Queue
   │
   ├────► Service B
   ├────► Service C
   └────► Service D
```

Examples:

- Kafka
- RabbitMQ
- SQS/SNS
- other queues/event brokers

---

# 2. REST Between Services

Typical:

```http
GET /customers/123
```

REST is useful for:

- External APIs
- Mobile/web → backend
- Simple service-to-service request/response
- CRUD operations
- APIs where human-readable HTTP/JSON contracts are useful

### Advantages

- Simple
- Universal
- Easy to debug
- Mature HTTP ecosystem
- Easy integration

### Disadvantages

- More payload/serialization overhead than binary protocols
- Creates runtime dependency between synchronous services
- Long chains can accumulate latency and failure propagation

Mental model:

```text
A → HTTP → B → response → A
```

If A needs B's answer immediately, REST is often a natural choice.

---

# 3. gRPC

gRPC typically uses:

```text
HTTP/2
+
Protocol Buffers
```

Conceptual contract:

```protobuf
service CustomerService {
  rpc GetCustomer(GetCustomerRequest)
      returns (Customer);
}
```

Architecture:

```text
Service A
   │
   │ gRPC
   ▼
Service B
```

Good for:

- Internal microservices
- High-throughput communication
- Low-latency communication
- Strongly typed contracts
- Polyglot environments

### Advantages

- Efficient binary serialization
- Strongly typed contracts
- HTTP/2 features
- Streaming support
- Code generation

### Disadvantages

- More complex than REST
- Less browser-friendly
- Debugging is less straightforward than JSON REST
- Requires disciplined contract management

### Interview shortcut

> **REST = simple/general-purpose HTTP API. gRPC = efficient, strongly typed internal RPC.**

---

# 4. Kafka / Event-Driven Communication

Instead of:

```text
Order Service → Payment Service
```

use:

```text
Order Service
      │
      │ OrderCreated
      ▼
    Kafka
      │
      ├────► Payment Service
      ├────► Notification Service
      └────► Analytics Service
```

The producer doesn't need to know every consumer.

This provides **looser coupling** and allows multiple independent consumers.

---

# 5. Command vs Event

Important distinction.

## Command

> **“Please do this.”**

Example:

```text
CreatePayment
```

A command represents an intended/requested action and is directed toward a consumer.

## Event

> **“This already happened.”**

Example:

```text
PaymentCreated
```

An event represents a fact that occurred and can potentially be consumed by multiple services.

Mental model:

```text
Command → intention

Event → fact
```

---

# 6. Synchronous vs Asynchronous Trade-off

Suppose:

```text
CRM
 ↓
Customer Service
 ↓
Credit Service
 ↓
Risk Service
```

Synchronous:

```text
CRM
 ↓
Customer
 ↓
Credit
 ↓
Risk
```

If Risk takes 3 seconds:

```text
Total latency increases
```

If Risk is unavailable:

```text
Entire request may fail
```

This creates **temporal coupling**.

With asynchronous processing:

```text
CRM
 ↓
Kafka
 ↓
Risk Service
```

CRM doesn't necessarily wait.

But asynchronous communication introduces its own complexity:

- Eventual consistency
- Message retries
- Duplicate delivery
- Ordering concerns
- Consumer lag
- DLQ handling
- More complicated debugging

Therefore:

> **Asynchronous is not automatically better.**

Choose based on business semantics.

---

# 7. Choosing REST vs gRPC vs Kafka

| Requirement | Prefer |
|---|---|
| Mobile/Web → Backend | REST/HTTP |
| External API | REST |
| Simple internal request/response | REST |
| High-performance internal RPC | gRPC |
| Strong typed internal contract | gRPC |
| Event notification | Kafka |
| Multiple independent consumers | Kafka |
| Long-running processing | Kafka/queue |
| Loose coupling | Kafka |
| Immediate response required | REST/gRPC |
| Eventual consistency acceptable | Kafka |

### Strong interview answer

> **“I'd use REST when I need a straightforward request-response API, especially for external or client-facing APIs. For internal service-to-service RPC where low latency, efficient serialization and strongly typed contracts are important, I'd consider gRPC. I'd use Kafka when the communication represents an event, when multiple consumers need the information, or when I want to decouple processing and allow eventual consistency. I wouldn't use asynchronous messaging just for the sake of it; if the caller needs an immediate response, synchronous communication is usually more appropriate.”**

---

# 8. Don't Use Kafka for Everything

Architect-level mistake:

```text
GET /customer/123
      ↓
Kafka
      ↓
Customer Service
      ↓
Kafka response
      ↓
API
```

This is unnecessary complexity when the caller simply needs an immediate answer.

Prefer:

```text
GET /customer/123
      ↓
Customer Service
      ↓
Response
```

Use synchronous communication when the caller genuinely needs an immediate response.

---

# 9. Avoid Long Synchronous Chains

This is also dangerous:

```text
A → B → C → D → E
```

One request now depends on five services.

Problems:

```text
Latency accumulation
Failure propagation
Timeout complexity
Retry storms
Debugging difficulty
```

Prefer reducing synchronous dependencies or using asynchronous workflows where the business semantics allow it.

---

# 10. Kafka Consumer Failure

Suppose:

```text
Producer
   ↓
Kafka
   ↓
Consumer
```

Consumer crashes.

Kafka retains the message according to topic retention.

When the consumer comes back:

```text
Consumer
   ↓
Resume from committed offset
```

This is one reason Kafka is useful for resilient event processing.

---

# 11. At-Least-Once Processing

A common Kafka architecture gives:

> **At-least-once processing semantics.**

A message can potentially be processed more than once.

Example:

```text
1. Consumer receives event
2. Updates DB
3. Consumer crashes before committing offset
4. Consumer restarts
5. Same event is read again
```

Therefore:

> **Kafka consumers should generally be designed to be idempotent.**

Be careful with claims such as:

> “Kafka gives exactly once.”

Kafka supports exactly-once processing/semantics in specific configurations and workflows, but it does not automatically make arbitrary business/database side effects exactly once.

---

# 12. Event-Driven Idempotency

Example event:

```text
PaymentCreated
eventId = abc123
```

Consumer maintains something like:

```text
processed_events

eventId
-------
abc123
```

Processing:

```text
Already processed?
      │
   ┌──┴──┐
  YES    NO
   │      │
 Ignore  Process
          │
          ↓
       Record ID
```

For important operations, the business update and processed-event record should be designed carefully, often using a transaction when both belong to the same database.

---

# 13. Outbox Pattern

Problem:

```text
DB update
   +
Kafka publish
```

What if:

```text
DB succeeds
Kafka publish fails
```

Now the database says the business operation happened, but the event was not published.

### Outbox

```text
Application
    │
    ├──────────────┐
    ▼              ▼
Business DB     Outbox Table
                  │
                  │ CDC / Publisher
                  ▼
                Kafka
```

Within one DB transaction:

```text
UPDATE deal
INSERT DealApproved event into outbox
COMMIT
```

Then a publisher/CDC process sends outbox events to Kafka.

Key result:

> **The business state and intent to publish the event are committed atomically.**

---

# 14. Saga Pattern

Suppose one business transaction spans:

```text
Order
Payment
Inventory
Shipping
```

A single database transaction normally cannot cover all independently owned services.

A Saga coordinates the distributed workflow using local transactions and compensating actions.

Example:

```text
Create Order
    ↓
Reserve Inventory
    ↓
Charge Payment
    ↓
Create Shipment
```

If payment fails:

```text
Compensating action
       ↓
Release Inventory
       ↓
Cancel Order
```

## Choreography

Services react to events:

```text
A → event → B
B → event → C
C → event → D
```

## Orchestration

A coordinator controls the workflow:

```text
        Saga Orchestrator
        /      |       \
       ↓       ↓        ↓
    Order   Payment  Inventory
```

---

# 15. Request-Reply vs Event

### Request-Reply

```text
A → B
A ← response
```

Use when:

> **A needs an answer.**

### Event

```text
A → Kafka → B
```

Use when:

> **A is notifying others that something happened.**

---

# 16. Node.js Perspective

Typical REST call:

```js
const response = await fetch(
  "http://customer-service/customers/123"
);
```

Conceptual event publishing:

```js
await kafkaProducer.send({
  topic: "deal-events",
  messages: [
    {
      key: dealId,
      value: JSON.stringify(event)
    }
  ]
});
```

Production thinking should include:

```text
timeouts
retries
idempotency
circuit breakers
correlation IDs
observability
message ordering
DLQ
backpressure
graceful shutdown
```

---

# 17. Distributed Systems Reliability

Once services communicate, failures are normal.

```text
Service A
   ↓
Service B
   ↓
Database
```

Questions to ask:

- What if B is slow?
- What if B is down?
- What if the network fails?
- What if requests retry simultaneously?
- What if thousands of messages accumulate?

The major reliability patterns covered were:

> **Timeout → Retry → Backoff → Circuit Breaker → Bulkhead → Rate Limiting**

---

# 18. Timeout

Never allow a downstream request to wait indefinitely.

```text
Service A
   │
   │ request
   ▼
Service B
   │
   │ hangs...
   X
 timeout
```

Example using `fetch` and `AbortController`:

```js
const controller = new AbortController();

const timeout = setTimeout(() => {
  controller.abort();
}, 3000);

try {
  await fetch(url, {
    signal: controller.signal
  });
} finally {
  clearTimeout(timeout);
}
```

Without a timeout:

```text
B hangs
 ↓
A waits
 ↓
connections remain occupied
 ↓
more requests arrive
 ↓
pool exhausted
 ↓
A becomes unhealthy
```

This can cause **cascading failure**.

---

# 19. Connection Timeout vs Request Timeout

These are different.

### Connection timeout

Time allowed to establish a connection:

```text
DNS
 ↓
TCP
 ↓
TLS
```

### Request/response timeout

Time allowed for the operation/response:

```text
Connection established
        ↓
Send request
        ↓
Wait for response
        ↓
Timeout
```

Depending on the HTTP client, there can be more granular timeouts:

```text
DNS timeout
TCP connect timeout
TLS handshake timeout
Request/header timeout
Response timeout
Idle socket timeout
```

### Keep-alive

Keep-alive answers:

> **Can I reuse this connection?**

It does **not** mean the request can wait forever.

---

# 20. Retry

If a transient failure occurs:

```text
Service A
   ↓
Service B
   X
```

A may retry:

```text
Attempt 1 → failure
Attempt 2 → success
```

Potentially retryable failures include:

```text
503 Service Unavailable
502 Bad Gateway
504 Gateway Timeout
connection reset
temporary network failure
```

Usually don't retry:

```text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
validation errors
business-rule failures
```

There can be exceptions, so retry policy must be based on the specific operation and dependency.

---

# 21. Retry + Idempotency

Critical combination.

Suppose:

```http
POST /payment
```

Node sends the payment:

```text
Payment Service
      ↓
Payment succeeds
      ↓
Network response lost
```

Node sees:

```text
timeout
```

If it blindly retries:

```text
Payment
Payment
```

Potentially:

> **Duplicate payment**

Therefore:

```text
Retryable operation
        +
Idempotency
        ↓
Safe retry
```

For critical financial operations, use an idempotency key:

```text
Idempotency-Key
       ↓
Payment Service
       ↓
same key = same logical operation
```

---

# 22. Exponential Backoff

Don't do:

```text
retry immediately
retry immediately
retry immediately
```

Instead:

```text
Attempt 1 → failure
     ↓
wait 100ms

Attempt 2 → failure
     ↓
wait 200ms

Attempt 3 → failure
     ↓
wait 400ms

Attempt 4 → success
```

Conceptually:

```text
delay = base × 2^attempt
```

Production strategy generally adds:

```text
maximum retry limit
+
maximum delay
+
jitter
```

---

# 23. Jitter

Imagine 10,000 clients experience the same failure.

Without jitter:

```text
10,000 requests
      ↓
retry at exactly 1 second
      ↓
10,000 requests again
```

This produces a **thundering herd**.

With jitter:

```text
retry between
800ms – 1200ms
```

Requests spread out.

Therefore:

> **Exponential backoff + jitter + bounded retry count** is a common production retry strategy.

---

# 24. Retry Storm

Suppose Service B is down.

```text
1000 original requests
       ↓
3000 retries
       ↓
B becomes even more overloaded
       ↓
more failures
       ↓
more retries
```

This is a **retry storm**.

Prevent it with:

- exponential backoff
- jitter
- retry limits
- circuit breakers
- rate limits
- bulkheads
- appropriate timeouts

---

# 25. Circuit Breaker

A circuit breaker protects your service from repeatedly calling an unhealthy dependency.

Conceptual states:

```text
CLOSED
  │
  │ repeated failures
  ↓
OPEN
  │
  │ wait/reset timeout
  ↓
HALF-OPEN
  │
  ├── success → CLOSED
  └── failure → OPEN
```

### Closed

Requests flow normally.

```text
A → B
```

Failures are tracked.

### Open

Calls fail fast.

```text
A
 ↓
Circuit OPEN
 ↓
Don't call B
```

This gives B time to recover and prevents A from continuously consuming resources calling an unhealthy dependency.

### Half-open

After the reset period, a limited test request can determine whether the dependency has recovered.

---

# 26. Node.js Circuit Breaker Example

A simplified conceptual implementation:

```js
class CircuitBreaker {
  constructor(operation, options = {}) {
    this.operation = operation;

    this.failureCount = 0;
    this.state = "CLOSED";

    this.failureThreshold =
      options.failureThreshold ?? 3;

    this.resetTimeout =
      options.resetTimeout ?? 5000;

    this.nextAttempt = 0;
  }

  async execute() {
    if (
      this.state === "OPEN" &&
      Date.now() < this.nextAttempt
    ) {
      throw new Error("Circuit breaker is OPEN");
    }

    if (
      this.state === "OPEN" &&
      Date.now() >= this.nextAttempt
    ) {
      this.state = "HALF_OPEN";
    }

    try {
      const result = await this.operation();

      this.failureCount = 0;
      this.state = "CLOSED";

      return result;

    } catch (error) {
      this.failureCount++;

      if (
        this.failureCount >= this.failureThreshold
      ) {
        this.state = "OPEN";

        this.nextAttempt =
          Date.now() + this.resetTimeout;

        console.log("Circuit breaker OPEN");
      }

      throw error;
    }
  }
}
```

Usage:

```js
const paymentBreaker = new CircuitBreaker(
  () => paymentService.charge(payment),
  {
    failureThreshold: 3,
    resetTimeout: 5000
  }
);

try {
  const result = await paymentBreaker.execute();

  console.log(result);
} catch (error) {
  console.log(error.message);
}
```

> This is a learning implementation. Production systems need more careful state handling, concurrency behavior, failure classification, metrics and configuration.

---

# 27. Bulkhead

Bulkhead means:

> **Prevent one dependency/workload from consuming all available resources.**

Example:

```text
Node API
 │
 ├── Customer Service → max 50 concurrent calls
 ├── Payment Service  → max 20 concurrent calls
 └── Reporting        → max 10 concurrent calls
```

If reporting becomes slow:

```text
Reporting
   ↓
uses its 10 slots
```

it should not consume all capacity needed by payments.

This is analogous to compartments in a ship:

```text
Compartment A
Compartment B
Compartment C
```

A failure in one compartment should not sink everything.

---

# 28. Rate Limiting

Rate limiting controls how much traffic a client can send.

Example:

```text
100 requests/minute/user
```

Exceeded:

```http
429 Too Many Requests
```

Common algorithms:

### Fixed Window

```text
00:00–01:00 → 100 requests
01:00–02:00 → 100 requests
```

Simple, but can have boundary spikes.

### Sliding Window

Tracks requests over a moving time range.

More accurate than a basic fixed window.

### Token Bucket

Tokens accumulate up to a maximum.

```text
Bucket = 100 tokens

Request → consumes token
No token → reject/throttle
```

This allows controlled bursts.

---

# 29. Node.js Rate Limiter Example

The source conversation used a simple in-memory example:

```js
class RateLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  allow(key) {
    const now = Date.now();

    let entry = this.requests.get(key);

    if (!entry || now - entry.start >= this.windowMs) {
      entry = {
        start: now,
        count: 0
      };

      this.requests.set(key, entry);
    }

    if (entry.count >= this.limit) {
      return false;
    }

    entry.count++;
    return true;
  }
}

const limiter = new RateLimiter(5, 60_000);

app.get("/api/orders", (req, res) => {
  const clientId = req.user.id;

  if (!limiter.allow(clientId)) {
    return res.status(429).json({
      error: "Too many requests"
    });
  }

  res.json({ orders: [] });
});
```

### Production limitation

An in-memory `Map` is local to one Node process.

With multiple instances:

```text
             Load Balancer
              /    |    \
             /     |     \
        Node #1  Node #2  Node #3
             \      |      /
              \     |     /
                Redis
```

A distributed rate limiter can use shared state such as Redis so all instances enforce the same limit.

Typical response:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
```

---

# 30. Rate Limiting vs Throttling

They are related but not identical.

### Rate limiting

> Restrict how much traffic is allowed.

Example:

```text
429 Too Many Requests
```

### Throttling

> Slow down or control traffic rather than necessarily rejecting it.

Example:

```text
queue / delay requests
```

---

# 31. Load Shedding

When the system is overloaded:

```text
10,000 requests
       ↓
System overloaded
       ↓
Everything becomes slow
       ↓
Everything eventually fails
```

Instead, intentionally reject lower-priority work:

```text
Critical requests
      ↓
Process

Low-priority requests
      ↓
Reject
```

This is **load shedding**.

Goal:

> **Keep the system alive rather than allowing total collapse.**

---

# 32. Backpressure in Distributed Systems

Suppose:

```text
Producer
  ↓
1000 msg/sec

Consumer
  ↓
100 msg/sec
```

The queue grows:

```text
100
1000
10000
100000
...
```

Eventually memory/storage becomes a problem.

Backpressure means:

> **The producer/flow must respect the consumer's processing capacity.**

This connects directly to Node.js streams:

```text
Readable
   ↓
Transform
   ↓
Writable
```

When the writable stream returns:

```js
false
```

the producer should slow down and wait for:

```js
"drain"
```

See **File 03 — Streams, Buffers & Backpressure**.

---

# 33. Reliability Pattern Together

A production call can conceptually look like:

```text
                Request
                   │
                   ▼
               Rate Limit
                   │
                   ▼
               Bulkhead
                   │
                   ▼
             Circuit Breaker
                   │
                   ▼
                Timeout
                   │
                   ▼
                 Retry
              /    |    \
             1     2     3
             │     │     │
          Backoff + Jitter
                   │
                   ▼
               Service B
```

Important:

> **Not every request needs every mechanism.**

The mechanisms solve different problems.

---

# 34. Timeout Budget

Architect-level concept.

Suppose the user-facing API has:

```text
Total request budget = 2 seconds
```

Do not simply configure:

```text
A → B timeout = 2 sec
A → C timeout = 2 sec
A → D timeout = 2 sec
```

because the total request can exceed the desired SLA.

Think in terms of a budget:

```text
Total budget = 2 sec

B = 700ms
C = 500ms
D = 400ms
Network/processing = remaining
```

For parallel calls:

```text
A
├── B ── 700ms
├── C ── 500ms
└── D ── 400ms
```

The total latency isn't necessarily their sum.

For sequential calls:

```text
A → B → C → D
```

the individual budgets accumulate.

---

# 35. Node.js-Specific Distributed-System Concern

Node does not need a blocked OS thread for a slow dependency to hurt the service.

Example:

```text
Downstream service slow
        ↓
many awaited requests
        ↓
connections/pending promises accumulate
        ↓
memory + pool pressure
        ↓
system degradation
```

Therefore control:

```text
timeouts
+
concurrency
+
connection pools
+
queue sizes
```

This connects directly to **File 04 — HTTP, Networking & Connections** and **File 05 — Performance, Memory & Profiling**.

---

# 36. Enterprise CRM / Banking Example

Imagine:

```text
CRM API
   ↓
Customer Service
   ↓
Finacle / External API
```

A production setup might conceptually be:

```text
CRM API
   ↓
HTTP connection pool
   ↓
Customer Service
   ↓
timeout = X
   ↓
retry = limited
   ↓
circuit breaker
   ↓
fallback / error
```

You do not want one slow downstream dependency to consume all API capacity.

For a payment/transfer-like operation:

```text
Client
   ↓
API
   ↓
Authentication
   ↓
Authorization
   ↓
Idempotency-Key
   ↓
Timeout
   ↓
Retry only if safe
   ↓
Backoff + Jitter
   ↓
Circuit Breaker
   ↓
Payment Service
```

---

# 37. Senior Interview Scenario

### Interviewer

> **“Your Node.js API calls a payment service. The payment service becomes slow. What do you do?”**

Don't simply answer:

> “I'll add retries.”

Strong answer:

> **“First I'd set a strict timeout based on the API's latency budget. I would only retry failures that are genuinely transient and only when the operation is idempotent, using exponential backoff with jitter and a retry limit. I'd use a circuit breaker to stop hammering a consistently unhealthy payment service, and bulkhead/concurrency limits to prevent it from consuming all resources. For payment operations I'd also use an idempotency key so a retry can't create duplicate transactions. I'd monitor latency, error rate, timeout rate and circuit state.”**

That's a strong Senior/SDE3 answer.

---

# 38. Rapid Fire

### Why timeout?

> Prevent indefinitely waiting for unhealthy dependencies.

### Why retry?

> Recover from transient failures.

### Why exponential backoff?

> Prevent immediate repeated load.

### Why jitter?

> Prevent synchronized retries / thundering herd.

### Why circuit breaker?

> Stop calling an unhealthy dependency and fail fast.

### Why bulkhead?

> Prevent one dependency from consuming all resources.

### Why rate limit?

> Protect the system from excessive traffic.

### What is retry storm?

> Retries amplify load during an outage.

### What is backpressure?

> Slow/control producers when consumers cannot keep up.

### What is load shedding?

> Intentionally reject lower-priority work to preserve system health.

### Why idempotent consumers?

> Messages can be processed more than once.

### What is Outbox?

> Persist the business change and event intent atomically, then publish asynchronously.

### What is Saga?

> Distributed transaction/workflow using local transactions plus compensating actions.

### Command vs Event?

> Command = requested action. Event = fact that happened.

### Can one architecture use REST + Kafka?

> Absolutely. This is extremely common.

---

# 39. Architect Mental Model

```text
                    Distributed System
                           │
          ┌────────────────┼────────────────┐
          ↓                ↓                ↓
       Protect           Recover          Isolate
          │                │                │
     Rate Limit          Retry           Bulkhead
     Load Shed           Backoff         Circuit
                         Jitter          Breaker
                           │
                           ↓
                        Timeout
                           │
                           ↓
                       Dependency
```

And for communication:

```text
                 Microservices
                      │
          ┌───────────┴───────────┐
          │                       │
      Synchronous             Asynchronous
          │                       │
      REST / gRPC             Kafka / Queue
          │                       │
      Need answer          Decoupling / events
          │                       │
          │                Eventual consistency
          │                       │
          └───────────┬───────────┘
                      ↓
              Idempotency
              Outbox / Saga
                      ↓
              Reliability patterns
```

---

# 40. Final Interview Answer

> **“I choose communication style based on business semantics. If the caller needs an immediate answer, I'd use REST or gRPC. If I need decoupling, durable event processing, fan-out or eventual consistency, I'd use Kafka or a queue. Once services communicate, I explicitly design for failure using timeouts, bounded retries, exponential backoff with jitter, circuit breakers and bulkheads. For side-effecting operations, especially financial operations, idempotency is essential. For database-plus-event consistency I'd consider the Outbox pattern, and for distributed workflows I'd consider a Saga.”**

---

# 41. Quick Revision

## Communication

```text
REST
→ general request/response

gRPC
→ efficient strongly typed internal RPC

Kafka
→ events / asynchronous processing / decoupling
```

## Messaging

```text
Command → intention
Event   → fact
```

## Kafka

```text
Consumer crash
   ↓
Message retained
   ↓
Resume from committed offset
```

```text
At-least-once
   ↓
Duplicate processing possible
   ↓
Idempotent consumer
```

```text
DB + Event
   ↓
Outbox
```

```text
Distributed workflow
   ↓
Saga
```

## Reliability

```text
Timeout
→ limit waiting

Retry
→ recover from transient failure

Backoff
→ spread retry attempts over time

Jitter
→ prevent synchronized retries

Circuit Breaker
→ fail fast when dependency is unhealthy

Bulkhead
→ isolate resources

Rate Limit
→ control incoming traffic

Load Shedding
→ reject lower-priority work under overload
```

## Critical rule

```text
Retry
  +
Idempotency
  ↓
Safe side-effect retry
```

## Critical Node.js rule

```text
Slow dependency
+
too much concurrency
+
large connection pools
+
unbounded queues
        ↓
Resource pressure
        ↓
System degradation
```

---

# 42. Connections to Other Files

- **File 03 — Streams, Buffers & Backpressure:** backpressure and bounded data flow.
- **File 04 — HTTP, Networking & Connections:** HTTP communication, keep-alive, connection pools and timeout types.
- **File 05 — Performance, Memory & Profiling:** pending requests, memory pressure, latency and bottleneck diagnosis.
- **File 06 — Errors, Resilience & Reliability:** error propagation, graceful failure and service-level resilience.
- **File 07 — Processes, Workers & Scaling:** process isolation, Kubernetes/OpenShift replicas and worker architecture.
- **File 08 — API Design, Authentication & Security:** API contracts, authentication, authorization, idempotency and rate limiting.
- **File 10 — Production Node.js:** observability, deployment and production operating model.

---

# Source Coverage

This file intentionally covers **Topics 26–27 only**.

- **Topic 26** → REST, gRPC, Kafka, synchronous/asynchronous communication, commands/events, consumer failure, at-least-once processing, idempotent consumers, Outbox, Saga, communication selection.
- **Topic 27** → timeouts, retries, retry classification, idempotency, exponential backoff, jitter, retry storms, circuit breakers, bulkheads, rate limiting, throttling, load shedding, backpressure, timeout budgets, Node.js resource pressure, enterprise reliability scenario.

No Topic 28+ material is treated as source coverage in this file.
