# Node.js Senior Backend / SDE3 Preparation Roadmap

## Phase 1 — Node.js Fundamentals & Internals

1. **Node.js Architecture & Runtime**
   - Node.js architecture
   - V8
   - libuv
   - JavaScript engine vs Node.js runtime
   - Single-threaded model

2. **Event Loop Internals**
   - Event loop
   - Call stack
   - Callback queues
   - libuv
   - Non-blocking I/O

3. **Event Loop Phases**
   - Timers
   - Pending callbacks
   - Poll
   - Check
   - Close callbacks
   - `setTimeout` vs `setImmediate`

4. **Microtasks & Macrotasks**
   - Promise callbacks
   - `queueMicrotask`
   - `process.nextTick`
   - Execution ordering

5. **Timers & Scheduling**
   - `setTimeout`
   - `setInterval`
   - `setImmediate`
   - Timer accuracy
   - Event-loop impact

6. **Asynchronous Programming**
   - Callbacks
   - Promises
   - `async/await`
   - Error handling
   - Promise concurrency

7. **`process.nextTick()`**
   - nextTick queue
   - Microtask interaction
   - Starvation
   - Appropriate use cases

8. **V8 Engine**
   - Execution context
   - JIT compilation
   - Hidden classes
   - Inline caching
   - Optimization/deoptimization

9. **Node.js Modules**
   - CommonJS
   - ES Modules
   - `require`
   - `import`
   - Module caching
   - Module resolution

10. **NPM & Package Management**
    - `package.json`
    - `package-lock.json`
    - Dependencies vs devDependencies
    - Semantic versioning
    - npm scripts
    - Dependency security

---

# Phase 2 — Node.js Core APIs

11. **File System**
    - `fs`
    - Sync vs async APIs
    - File descriptors
    - Large-file handling

12. **Buffers**
    - `Buffer`
    - Binary data
    - Encoding
    - Buffer memory

13. **Streams**
    - Readable
    - Writable
    - Duplex
    - Transform
    - Streaming large files

14. **Backpressure**
    - `highWaterMark`
    - `write()` return value
    - `drain`
    - `pipe()`
    - Preventing memory growth

15. **HTTP Module**
    - HTTP server
    - Request/response lifecycle
    - Headers
    - Keep-alive
    - Connection handling

16. **Streams — Practical Implementation**
    - Read → transform → write
    - Handling `drain`
    - `pipeline()`
    - Error propagation

17. **Networking**
    - TCP
    - Sockets
    - DNS
    - HTTP/HTTPS
    - Connection lifecycle

18. **Error Handling**
    - Operational vs programmer errors
    - `try/catch`
    - Promise rejection
    - Global handlers
    - Error propagation
    - Custom errors

19. **Connection Management**
    - Connection pooling
    - API connection pools
    - DB connection pools
    - Connection timeout
    - Request timeout
    - Keep-alive
    - Pool sizing

20. **AbortController & Request Cancellation**
    - Cancelling HTTP requests
    - Timeouts
    - Abort signals
    - Preventing wasted resources

---

# Phase 3 — API & Backend Architecture

21. **Node.js API Architecture**
    - Controllers
    - Services
    - Repositories
    - Middleware
    - Dependency injection
    - Separation of concerns

22. **Authentication Architecture**
    - JWT
    - Sessions
    - Access tokens
    - Refresh tokens
    - ID tokens
    - Token validation
    - JWKS

23. **OAuth 2.0 & PKCE**
    - Authorization Code
    - PKCE
    - Client Credentials
    - Refresh token
    - OAuth vs OIDC
    - OAuth vs JWT

24. **API Authorization**
    - RBAC
    - ABAC
    - Roles
    - Permissions
    - Scopes
    - Resource-level authorization
    - Business authorization

25. **REST API Design**
    - Resource-oriented APIs
    - HTTP methods
    - Status codes
    - Idempotency
    - Idempotency keys
    - Pagination
    - Filtering
    - Sorting
    - Versioning
    - Error standards

26. **Microservices Communication**
    - REST
    - gRPC
    - Kafka
    - Events
    - Commands
    - Synchronous vs asynchronous communication
    - Outbox pattern
    - Saga

27. **Distributed Systems Reliability**
    - Timeouts
    - Retries
    - Exponential backoff
    - Jitter
    - Circuit breaker
    - Bulkhead
    - Rate limiting
    - Throttling
    - Load shedding
    - Retry storms
    - Timeout budgets

---

# Phase 4 — Production Node.js

28. **Observability & Production Debugging**
    - Structured logging
    - Log levels
    - Metrics
    - Distributed tracing
    - Correlation IDs
    - APM
    - Grafana
    - AppDynamics
    - Production debugging

29. **Node.js Performance Optimization**
    - Latency
    - Throughput
    - CPU bottlenecks
    - Event-loop lag
    - I/O bottlenecks
    - Profiling

30. **Memory Management & Garbage Collection**
    - V8 heap
    - Stack vs heap
    - Garbage collection
    - Memory leaks
    - Heap snapshots
    - Out-of-memory errors

31. **Node.js Clustering & Horizontal Scaling**
    - Cluster module
    - Worker processes
    - Multi-core utilization
    - PM2
    - Horizontal scaling
    - Stateless services

32. **Worker Threads**
    - CPU-intensive workloads
    - Worker threads
    - Worker pools
    - Main thread vs worker thread
    - When to use workers

33. **Child Processes**
    - `spawn`
    - `exec`
    - `execFile`
    - `fork`
    - Process isolation
    - Use cases

34. **Node.js Security**
    - OWASP
    - Injection
    - Prototype pollution
    - Dependency vulnerabilities
    - Secrets
    - Security headers
    - Input validation

35. **API Security**
    - JWT security
    - OAuth security
    - CORS
    - CSRF
    - Rate limiting
    - API gateway security
    - Token security

---

# Phase 5 — Databases & Caching

36. **Caching Architecture**
    - Redis
    - Cache-aside
    - Write-through
    - Write-behind
    - TTL
    - Cache invalidation
    - Distributed caching

37. **Database Integration**
    - Connection pools
    - Transactions
    - Query optimization
    - Indexes
    - N+1 problems
    - Database timeouts

38. **MongoDB for Node.js**
    - Documents
    - Indexes
    - Replica sets
    - Transactions
    - Read/write concerns
    - Connection configuration

39. **SQL/PostgreSQL for Node.js**
    - Transactions
    - ACID
    - Isolation levels
    - Locks
    - Indexes
    - Connection pooling

40. **ORM & Data Access Layer**
    - TypeORM
    - Prisma
    - Repository pattern
    - Transactions
    - N+1
    - Query optimization

---

# Phase 6 — Messaging & Event-Driven Architecture

41. **Kafka with Node.js**
    - Producer
    - Consumer
    - Consumer groups
    - Partitions
    - Offsets
    - Rebalancing
    - Retries
    - DLQ

42. **Event-Driven Architecture**
    - Events
    - Pub/Sub
    - Event contracts
    - Eventual consistency
    - Event ordering
    - Event versioning

43. **Distributed Transactions**
    - Saga
    - Choreography
    - Orchestration
    - Outbox pattern
    - Idempotency
    - Exactly-once misconceptions

---

# Phase 7 — Microservices & Enterprise Architecture

44. **Node.js Microservices Architecture**
    - Service boundaries
    - Database per service
    - API gateway
    - Service communication
    - Service discovery
    - Configuration

45. **Configuration & Secrets Management**
    - Environment variables
    - Config management
    - Kubernetes Secrets
    - Vault
    - Secret rotation
    - Configuration hierarchy

46. **Graceful Shutdown & Lifecycle**
    - `SIGTERM`
    - `SIGINT`
    - Stop accepting traffic
    - Finish existing requests
    - Close DB connections
    - Close Kafka consumers
    - Kubernetes termination

47. **Health Checks & Readiness**
    - Liveness
    - Readiness
    - Startup probes
    - Dependency checks
    - Kubernetes probes

---

# Phase 8 — Testing

48. **Testing Node.js Applications**
    - Unit testing
    - Integration testing
    - Contract testing
    - Jest
    - Mocking
    - Test isolation

49. **API Testing**
    - Supertest
    - Integration tests
    - API test strategies
    - Test databases
    - Authentication testing

---

# Phase 9 — Deployment & Infrastructure

50. **Production Deployment**
    - Docker
    - Containerization
    - CI/CD
    - Rolling deployments
    - Blue/green deployments
    - Canary deployments

51. **Node.js + Kubernetes**
    - Pods
    - Deployments
    - Services
    - Resource requests/limits
    - Probes
    - HPA
    - Autoscaling
    - Graceful termination

---

# Phase 10 — Architecture & Design Patterns

52. **Backend Architecture Patterns**
    - Layered architecture
    - Clean architecture
    - Hexagonal architecture
    - CQRS
    - Modular architecture

53. **Design Patterns in Node.js**
    - Factory
    - Strategy
    - Adapter
    - Observer
    - Singleton
    - Dependency Injection
    - Repository

54. **Advanced TypeScript for Backend**
    - Generics
    - Utility types
    - Conditional types
    - Mapped types
    - Type guards
    - Dependency injection
    - Runtime validation

---

# Phase 11 — Advanced Node.js

55. **Advanced Async Patterns**
    - Promise concurrency
    - `Promise.all`
    - `Promise.allSettled`
    - Concurrency limits
    - Queues
    - Cancellation
    - `AbortController`

56. **Advanced Streams**
    - Custom streams
    - Transform streams
    - `pipeline`
    - Backpressure
    - Error handling
    - Streaming architecture

57. **WebSockets & Real-Time Systems**
    - WebSocket lifecycle
    - Connection management
    - Scaling
    - Redis Pub/Sub
    - Socket.IO
    - Real-time architecture

58. **gRPC — Advanced**
    - Protobuf
    - Unary calls
    - Streaming
    - Deadlines
    - Interceptors
    - Error handling

59. **GraphQL — Backend Perspective**
    - Schema
    - Resolvers
    - N+1
    - DataLoader
    - Caching
    - Authorization

---

# Phase 12 — Real-World Architecture

60. **Node.js Architecture Case Studies**
    - Payment system
    - Banking transfer system
    - Notification system
    - File-processing system
    - Order system
    - High-volume API
    - Async job processing

---

# Phase 13 — Senior/SDE3 Interview Revision

61. **Node.js Rapid-Fire Questions**

62. **Node.js Debugging Scenarios**

63. **Node.js Performance Troubleshooting**

64. **Microservices Failure Scenarios**

65. **Node.js System Design Questions**

66. **Banking & FinTech Backend Scenarios**

67. **Senior/SDE3 Architecture Questions**

68. **Node.js Mock Interview**

---

## Recommended sequence

For your preparation, I'd treat it like this:

```text
1–10     → Node.js Internals
11–20    → Node.js Core
21–27    → Backend + Distributed Systems
28–35    → Production Engineering
36–43    → DB + Kafka + Distributed Data
44–51    → Microservices + Kubernetes
52–59    → Architecture + Advanced Node.js
60       → Real-world Case Studies
61–68    → Interview Mode
```
