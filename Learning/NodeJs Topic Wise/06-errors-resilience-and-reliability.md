# Node.js Error Handling, Async Error Propagation & Process Reliability

> Senior Backend / SDE3 / Architect interview revision  
> Source Topic: **Topic 17 — Error Handling & Async Error Propagation**

---

## Overview

Error handling in Node.js is much more than `try/catch`.

For production backend systems, think in terms of:

```text
Propagation
    ↓
Classification
    ↓
Recovery
    ↓
Observability
    ↓
Safe process lifecycle
```

This file covers:

- Synchronous errors
- Promise/`async` errors
- Callback-style errors
- `try/catch` boundaries
- Promise error propagation
- `throw` vs `reject`
- Unhandled Promise rejections
- Express error middleware
- Safe error responses
- Operational vs programming errors
- Microservice error handling
- `uncaughtException`
- Graceful shutdown
- Kubernetes/OpenShift shutdown flow
- Senior/SDE3 interview scenarios

---

# 1. Types of Errors

Node.js applications encounter errors through several execution models.

## 1.1 Synchronous errors

A synchronous exception can be caught by a surrounding `try/catch`.

```js
try {
  JSON.parse("invalid");
} catch (err) {
  console.error(err);
}
```

Execution is:

```text
try block
   ↓
operation throws
   ↓
catch
```

---

## 1.2 Promise / async errors

Errors from awaited Promise operations can be caught by `try/catch`.

```js
async function getData() {
  try {
    const result = await db.query();
    return result;
  } catch (err) {
    console.error(err);
  }
}
```

Conceptually:

```text
async operation
      ↓
Promise rejects
      ↓
await
      ↓
catch
```

---

## 1.3 Callback-style errors

Traditional Node APIs often use the error-first callback convention.

```js
fs.readFile("file.txt", (err, data) => {
  if (err) {
    // handle error
    return;
  }

  console.log(data);
});
```

The error is delivered through the callback:

```text
Async operation
      ↓
callback(err, data)
      ↓
inspect err
```

---

# 2. `try/catch` and Async/Await

This works:

```js
async function getData() {
  try {
    const result = await db.query();
    return result;
  } catch (err) {
    throw err;
  }
}
```

The important point is that the `await` keeps the Promise rejection connected to the `try/catch`.

---

# 3. Why `try/catch` Does Not Catch a Later Timer Error

This does **not** catch the error:

```js
try {
  setTimeout(() => {
    throw new Error("Boom");
  }, 1000);
} catch (err) {
  // ❌ won't catch it
}
```

Why?

Because the callback executes later:

```text
Current call stack
     ↓
try block finishes
     ↓
try/catch scope is finished
     ↓
later...
     ↓
timer callback executes
     ↓
throw Error
```

The `try/catch` protects the synchronous execution occurring inside its scope. It does not remain active for arbitrary future callbacks.

---

# 4. Correct Mental Model for Async Errors

Think about **where the error is actually thrown/rejected**.

### Synchronous

```text
try
 ↓
throw
 ↓
catch
```

### Promise

```text
try
 ↓
await Promise
 ↓
reject
 ↓
catch
```

### Timer callback

```text
try
 ↓
schedule callback
 ↓
try finishes
 ↓
later callback executes
 ↓
throw
```

The third case is outside the original `try/catch` execution.

---

# 5. Promise Error Propagation

This is extremely common in backend applications.

```js
async function service() {
  return await repository();
}

async function controller() {
  try {
    const result = await service();
    return result;
  } catch (err) {
    // catches rejection from repository()
  }
}
```

The conceptual propagation is:

```text
Repository
    │
    │ throw / reject
    ↓
Service
    │
    │ Promise rejection
    ↓
Controller
    │
    │ catch
    ↓
Error Handler
```

The important senior-level idea:

> **A rejected Promise can propagate through the Promise chain until some layer handles it.**

---

# 6. `throw` vs `Promise.reject()` Inside `async`

Inside an `async` function:

```js
async function test() {
  throw new Error("Failed");
}
```

results in a rejected Promise.

Conceptually equivalent to:

```js
async function test() {
  return Promise.reject(new Error("Failed"));
}
```

So this works:

```js
try {
  await test();
} catch (err) {
  console.error(err);
}
```

Mental model:

```text
async function
      ↓
throw
      ↓
rejected Promise
```

---

# 7. Error Propagation Through Application Layers

A typical backend:

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
Database
```

Suppose the database operation fails:

```text
Database error
      ↓
Repository
      ↓
Service
      ↓
Controller
      ↓
Central error handler
      ↓
HTTP response
```

A good architecture avoids duplicating generic error handling at every layer.

Each layer should add context or translate errors when appropriate.

---

# 8. Don't Swallow Errors

A dangerous pattern is:

```js
try {
  await paymentService.charge();
} catch (err) {
  console.log(err);
}
```

and then continuing as though payment succeeded.

This can create inconsistent business state.

Instead, decide explicitly:

```text
Error
 ↓
Can I recover?
 ├── Yes → recover/fallback
 └── No  → propagate
```

For a critical operation such as a financial transaction, silently swallowing an error can be especially dangerous.

---

# 9. Unhandled Promise Rejection

Consider:

```js
someAsyncFunction();
```

If the Promise rejects and nobody handles it:

```text
Promise rejection
       ↓
No appropriate rejection handler
       ↓
Unhandled rejection
```

Node provides:

```js
process.on("unhandledRejection", (reason) => {
  console.error(reason);
});
```

But:

> **Do not treat `unhandledRejection` as your normal application error-handling mechanism.**

Expected application errors should be handled through the normal Promise/application flow.

The process-level handler is primarily useful as a last-resort safety/observability mechanism.

---

# 10. `unhandledRejection` Mental Model

Good:

```text
Service rejects
    ↓
Controller catches
    ↓
Translate/log/respond
```

Bad:

```text
Service rejects
    ↓
Nobody handles it
    ↓
process-level handler
```

The second situation usually indicates an application bug or missing error-handling boundary.

---

# 11. Express Error Handling

A typical Express application can have centralized error middleware:

```js
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    message: "Internal Server Error"
  });
});
```

Architecture:

```text
Request
   ↓
Controller
   ↓
Service
   ↓
Repository
   ↓
Error
   ↓
Express Error Middleware
   ↓
HTTP Response
```

This allows application layers to propagate errors instead of every controller manually constructing generic error responses.

### Express version consideration

Modern Express versions can propagate rejected Promises from route handlers to error middleware. Older Express patterns often required explicit wrappers or `next(err)` for async handlers.

---

# 12. Error Middleware Responsibilities

A centralized error handler can:

```text
1. Log the detailed internal error
2. Determine appropriate HTTP status
3. Map known application errors
4. Hide internal implementation details
5. Return a consistent error structure
6. Include correlation/request ID
```

For example:

```json
{
  "code": "INTERNAL_ERROR",
  "message": "Something went wrong",
  "correlationId": "abc-123"
}
```

---

# 13. Don't Expose Internal Errors

Bad:

```js
res.status(500).json({
  error: err.stack
});
```

This can expose:

- Database details
- Internal file paths
- Implementation information
- Sensitive information

Better:

```json
{
  "code": "INTERNAL_ERROR",
  "message": "Something went wrong",
  "correlationId": "abc-123"
}
```

Detailed diagnostic information should remain in controlled internal logs.

---

# 14. Error Response vs Internal Error

Think of two representations:

```text
Internal
──────────────
Database timeout
ORA error
stack trace
service details
host information

        ↓ translate

External
──────────────
HTTP 500
INTERNAL_ERROR
safe message
correlationId
```

This prevents implementation details from becoming part of the public API contract.

---

# 15. Operational vs Programming Errors

This is an important **Senior/SDE3-level distinction**.

## Operational error

An expected failure during normal operation.

Examples:

```text
Database temporarily unavailable
Network timeout
Invalid user input
External API unavailable
File not found
```

These may be recoverable.

Potential handling:

```text
handle
 ↓
retry/fallback/respond
```

---

## Programming error

A defect in the application.

Examples:

```text
Undefined variable
Incorrect assumptions
Invalid application state
Logic bug
Unexpected invariant violation
```

Typical strategy:

```text
detect
 ↓
log/alert
 ↓
fail/restart safely when appropriate
```

The key principle:

> **Don't blindly catch every error and continue.**

---

# 16. Why Error Classification Matters

Consider:

```text
Database temporarily unavailable
```

A retry may make sense.

But:

```text
TypeError caused by a programming bug
```

Retrying the same code may simply repeat the failure.

Therefore:

```text
Error
 ↓
Classify
 ↓
Operational?
 ├── recover/retry/fallback where appropriate
 │
Programming/fatal?
 └── fail safely and investigate
```

---

# 17. Microservice Error Handling

Consider:

```text
API
 ↓
Order Service
 ↓
Payment Service
 ↓
External Bank API
```

Suppose the payment service times out.

A production design needs to consider:

- Timeout
- Retry
- Exponential backoff
- Idempotency
- Circuit breaker
- Fallback
- Correlation ID
- Logging/tracing
- Appropriate HTTP status

Simply doing:

```js
catch (err) {
  return res.status(500).send("failed");
}
```

is not enough for an enterprise distributed system.

---

# 18. Error Propagation Across Services

A failure can travel across service boundaries:

```text
Client
  ↓
API
  ↓
Order Service
  ↓
Payment Service
  ↓
Bank API
       X
    timeout
```

The failure must be handled without allowing the entire system to wait indefinitely.

This is where resilience mechanisms become important:

```text
Timeout
   ↓
Retry if safe
   ↓
Backoff
   ↓
Circuit breaker
   ↓
Fallback/fail
```

For payment operations, idempotency is particularly important before retrying.

---

# 19. Correlation IDs

When a request crosses multiple services:

```text
Client
  ↓ requestId = abc-123
Service A
  ↓ requestId = abc-123
Service B
  ↓ requestId = abc-123
Payment Service
```

the same correlation/request identifier lets engineers connect logs and traces belonging to the same logical request.

Example structured log:

```text
requestId=abc-123
operation=TRANSFER
service=payment-service
status=FAILED
```

This is especially useful during distributed production debugging.

---

# 20. `uncaughtException`

Node provides:

```js
process.on("uncaughtException", (err) => {
  console.error(err);
});
```

This represents an exception that escaped normal application error handling.

For serious cases, the process may be in an unsafe or unknown state.

Do not assume:

```text
catch it
   ↓
continue normally
```

is always safe.

A typical production strategy is:

```text
uncaughtException
       ↓
log / alert
       ↓
controlled cleanup
       ↓
graceful shutdown
       ↓
restart by Kubernetes/process manager
```

---

# 21. Why Continuing After a Fatal Error Can Be Dangerous

Suppose an unexpected programming error occurred while modifying state:

```text
Operation starts
     ↓
partial state mutation
     ↓
unexpected exception
     ↓
process continues
```

The process may now contain state that is difficult to reason about.

For serious uncaught exceptions:

> **Fail safely rather than pretending the process is definitely healthy.**

The exact shutdown strategy should consider whether cleanup is safe and how quickly the process should terminate.

---

# 22. `uncaughtException` vs `unhandledRejection`

### `uncaughtException`

An exception escaped normal synchronous/application handling and reached the process level.

```text
throw
 ↓
no normal handler
 ↓
uncaughtException
```

### `unhandledRejection`

A Promise rejection has no appropriate rejection handler.

```text
Promise rejects
 ↓
no handler
 ↓
unhandledRejection
```

Mental model:

```text
Synchronous exception
        ↓
uncaughtException

Promise rejection
        ↓
unhandledRejection
```

Both should be treated as signals that normal error-handling boundaries were bypassed.

---

# 23. Graceful Shutdown

A production Node.js service should be able to shut down without abruptly abandoning work.

Example:

```js
process.on("SIGTERM", async () => {
  server.close();

  await db.close();
  await kafka.disconnect();

  process.exit(0);
});
```

The conceptual flow is:

```text
SIGTERM
  ↓
Stop accepting new requests
  ↓
Finish in-flight requests
  ↓
Close DB connections
  ↓
Close Kafka consumers
  ↓
Close Redis/other resources
  ↓
Exit
```

---

# 24. Why Graceful Shutdown Matters in Kubernetes/OpenShift

Containers are routinely terminated during:

- Deployments
- Scaling
- Node maintenance
- Rescheduling

A service should therefore respond to termination signals correctly.

Conceptually:

```text
Kubernetes/OpenShift
       ↓
SIGTERM
       ↓
Node application
       ↓
Drain / finish work
       ↓
Close resources
       ↓
Exit
```

This reduces:

```text
Dropped requests
Incomplete work
Connection leaks
Duplicate processing risks
```

---

# 25. Shutdown Sequence

A more complete mental model:

```text
SIGTERM
   │
   ▼
Mark instance as shutting down
   │
   ▼
Stop accepting new traffic
   │
   ▼
Allow in-flight work to complete
   │
   ├── DB
   ├── Redis
   ├── Kafka
   └── other dependencies
   │
   ▼
Close resources
   │
   ▼
Exit
```

The exact implementation depends on the application and infrastructure.

---

# 26. Graceful Shutdown Example

A more structured approach:

```js
const server = app.listen(PORT);

async function shutdown(signal) {
  console.log(`${signal} received`);

  server.close(async () => {
    try {
      await db.close();
      await kafka.disconnect();
      await redis.quit();

      process.exit(0);
    } catch (err) {
      console.error("Shutdown failed", err);
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

The important design idea is not the exact code.

It is:

```text
stop traffic
 ↓
finish work
 ↓
cleanup
 ↓
exit
```

---

# 27. Error Handling in Banking / Enterprise APIs

Consider:

```text
CRM API
   ↓
Customer Service
   ↓
Payment Service
   ↓
Banking/Core API
```

Suppose the banking dependency times out.

A weak implementation:

```js
try {
  await bankApi.transfer();
} catch (err) {
  return { success: false };
}
```

A stronger design asks:

```text
Did the bank process the transaction?
       ↓
Was the response lost?
       ↓
Is retry safe?
       ↓
Is there an idempotency key?
       ↓
Should the dependency be temporarily isolated?
       ↓
What status should the caller receive?
       ↓
Can support trace the request?
```

This is where error handling becomes distributed-systems engineering.

---

# 28. Payment Timeout Example

Suppose:

```text
Request
   ↓
Payment Service
   ↓
Bank API
```

The bank processes the payment but the response is lost.

Then:

```text
Bank → payment processed
Bank → response lost
       ↓
Payment Service → timeout
       ↓
Client → thinks operation failed
```

Blindly retrying could produce:

```text
Retry
 ↓
Second payment
 ↓
Duplicate transaction ❌
```

Therefore:

```text
Timeout
   ↓
Determine operation status / idempotency
   ↓
Retry only when safe
```

For financial operations:

> **Idempotency is part of error-handling design, not merely an API feature.**

---

# 29. What Not to Do

## Don't expose stack traces

```js
res.json({
  error: err.stack
});
```

---

## Don't silently swallow errors

```js
try {
  await operation();
} catch (err) {
  console.log(err);
}
```

without deciding what should happen next.

---

## Don't retry everything

Avoid automatically retrying:

```text
400
401
403
404
business validation errors
non-idempotent operations without protection
```

Retry decisions should be based on the failure type and operation semantics.

---

## Don't assume every fatal process error is recoverable

For serious `uncaughtException` cases:

```text
log
 ↓
cleanup
 ↓
restart safely
```

may be safer than continuing.

---

# 30. Error Handling Architecture

A useful enterprise model:

```text
                  Incoming Request
                         │
                         ▼
                  Authentication
                         │
                         ▼
                    Controller
                         │
                         ▼
                      Service
                         │
              ┌──────────┴──────────┐
              │                     │
           Success                 Error
              │                     │
              ▼                     ▼
           Response          Classify / Propagate
                                    │
                                    ▼
                           Central Error Handler
                                    │
                       ┌────────────┴────────────┐
                       ▼                         ▼
                 Internal logs             Safe response
                       │                         │
                 Correlation ID             Error code
```

---

# 31. Error Handling Mental Model

For expected errors:

```text
Expected error
     ↓
Classify
     ↓
Handle
     ↓
Recover / fallback / respond
```

For unexpected serious errors:

```text
Unexpected fatal error
     ↓
Log + alert
     ↓
Controlled cleanup
     ↓
Graceful shutdown
     ↓
Restart safely
```

---

# 32. Senior Interview Scenario

### Interviewer

> "Your Node.js API calls a payment service. The payment service becomes slow. What do you do?"

### Strong answer

> **"First I'd enforce a strict timeout based on the API's latency budget. I would only retry failures that are genuinely transient and only when the operation is safe to retry, using bounded exponential backoff. For financial operations I'd use idempotency so a retry cannot create duplicate transactions. I'd also consider a circuit breaker to stop repeatedly calling an unhealthy payment service and bulkhead/concurrency limits so the dependency doesn't consume all available resources. Finally, I'd monitor latency, error rate, timeout rate and circuit state and propagate a clear, traceable error to the caller."**

This is much stronger than:

> "I'll add retries."

---

# 33. Senior/SDE3 Rapid Fire

### Q: Does `try/catch` catch errors inside `setTimeout`?

> No. The callback executes asynchronously after the original `try` block has completed.

### Q: What happens when an `async` function throws?

> It results in a rejected Promise.

### Q: What is an unhandled rejection?

> A rejected Promise for which no appropriate rejection handler has been attached.

### Q: `uncaughtException` vs `unhandledRejection`?

> `uncaughtException` concerns an exception that escaped normal handling; `unhandledRejection` concerns a Promise rejection without an appropriate rejection handler.

### Q: Should you always continue after `uncaughtException`?

> No. For serious uncaught exceptions, the process may be unsafe. A controlled shutdown and restart can be safer.

### Q: How do you handle errors in microservices?

> Use appropriate timeouts, bounded retries with backoff where safe, idempotency, circuit breakers/fallbacks, structured errors, correlation IDs, observability and graceful failure.

### Q: Why shouldn't internal stack traces be returned to clients?

> They can expose implementation details, database information, internal paths or other sensitive information.

### Q: Why is graceful shutdown important?

> It lets the service stop accepting new work, finish in-flight requests and close resources cleanly during deployments, scaling or process termination.

### Q: Is retry an error-handling strategy for every error?

> No. Retry is appropriate only for failures that are likely transient and operations where retrying is safe or protected by idempotency.

---

# 34. Architect-Level Interview Answer

If asked:

> **"How would you design error handling for a Node.js microservice?"**

A strong answer:

> **"I'd separate application errors from unexpected programming failures. Expected operational errors would be classified and handled through well-defined application error types and a centralized error boundary. For downstream calls I'd use deadlines/timeouts and bounded retries with exponential backoff only for retryable, safe operations, with idempotency for critical writes. I'd use circuit breakers or bulkheads where dependency failures could exhaust resources. Internally I'd use structured logs, correlation IDs and tracing, while returning sanitized and consistent error responses. For uncaught fatal errors I'd log and alert, perform controlled cleanup and allow the process to restart safely. I'd also implement graceful SIGTERM handling so Kubernetes/OpenShift termination drains traffic and closes resources cleanly."**

---

# 35. Quick Revision

## Error types

```text
Sync
Promise/async
Callback
```

## Async `try/catch`

```text
await Promise
   ↓
reject
   ↓
catch
```

But:

```text
setTimeout callback
   ↓
executes later
   ↓
outside original try/catch
```

## Async function

```text
throw
 ↓
rejected Promise
```

## Promise propagation

```text
Repository
 ↓
Service
 ↓
Controller
 ↓
Error handler
```

## Expected vs unexpected

```text
Operational
 → handle/retry/fallback/respond

Programming/fatal
 → log/alert/fail safely/restart when appropriate
```

## Process-level failures

```text
uncaughtException
unhandledRejection
```

These are not substitutes for normal application error handling.

## Microservice failures

```text
Timeout
 ↓
Retry if safe
 ↓
Backoff
 ↓
Circuit breaker
 ↓
Fallback/fail
```

## Shutdown

```text
SIGTERM
 ↓
Stop new traffic
 ↓
Finish in-flight requests
 ↓
Close dependencies
 ↓
Exit
```

---

# 36. One-Minute Interview Cheat Sheet

If the interviewer asks **"How do you handle errors in Node.js?"**, think:

```text
1. Catch expected errors at the correct boundary
2. Let Promise errors propagate intentionally
3. Don't expect try/catch to catch unrelated future callbacks
4. Centralize HTTP error mapping
5. Don't expose internal details
6. Classify operational vs programming errors
7. Use timeout/retry/backoff only where appropriate
8. Protect critical writes with idempotency
9. Use correlation IDs and structured logs
10. Treat uncaught fatal errors seriously
11. Gracefully shut down on SIGTERM
12. Restart unhealthy processes safely
```

---

# 37. Final Mental Model

```text
                    Node.js Error Handling
                              │
          ┌───────────────────┼───────────────────┐
          ↓                   ↓                   ↓
      Propagate            Classify            Recover
          │                   │                   │
      Promise chain      Operational?        Retry/Fallback
      async/await        Programming?        Respond
          │                   │
          └────────────┬──────┘
                       ↓
                Central Boundary
                       │
             ┌─────────┴─────────┐
             ↓                   ↓
        Safe Response       Observability
             │                   │
         Error Code        Logs/Tracing
         Correlation ID    Correlation ID
                                 │
                                 ↓
                       Fatal Process Error
                                 │
                                 ↓
                       Graceful Shutdown
                                 │
                                 ↓
                            Safe Restart
```

### ⭐ The sentence to remember

> **"Error handling isn't just `try/catch`; it's propagation, classification, recovery, observability and safe process lifecycle."**

---

# 38. Connections to Other Files

- **File 02 — Event Loop & Async:** asynchronous execution explains why `try/catch` does not cover unrelated future callbacks.
- **File 04 — HTTP Networking & Connections:** timeout and connection behavior affect downstream error handling.
- **File 07 — Processes, Workers & Scaling:** process lifecycle, Kubernetes/OpenShift and graceful shutdown.
- **File 08 — API Design, Auth & Security:** safe HTTP error responses and security-sensitive error handling.
- **File 09 — Microservices & Distributed Systems:** retries, idempotency, circuit breakers and distributed failure propagation.
- **File 10 — Production Node.js:** observability, operational readiness and production lifecycle.

---

# 39. Source Coverage

This file accounts for **Topic 17** from the original Node.js preparation conversation.

Covered source material:

- Synchronous errors
- Promise/async errors
- Callback errors
- `try/catch` with async/await
- Timer callback error boundary
- Promise error propagation
- `throw` vs `Promise.reject`
- Unhandled Promise rejection
- Express error middleware
- Safe error responses
- Operational vs programming errors
- Microservice error handling
- `uncaughtException`
- Graceful shutdown
- Kubernetes/OpenShift termination flow
- Correlation IDs
- Payment-service failure scenario
- Retry/idempotency considerations
- Senior/SDE3 rapid-fire questions
- Senior/Architect interview answer
- Rate limiting/backoff/circuit-breaker concepts referenced only as part of Topic 17's microservice error-handling context

**Topic 27 — Distributed Systems Reliability is intentionally not included as source coverage here; it belongs to File 09.**
