# Node.js Event Loop & Asynchronous Execution

> **Source Topics:** Topics 2–8  
> **Track:** Node.js Interview Preparation  
> **Level:** Senior Backend / SDE3 / Architect  
> **Purpose:** GitHub/Obsidian revision note

---

## 1. Overview

The Node.js event loop is the mechanism that allows a Node.js process to keep processing JavaScript callbacks while asynchronous I/O is in progress.

The key mental model is:

```text
                Node.js Process
                      │
                 JavaScript
                      │
                 Event Loop
                      │
       ┌──────────────┼──────────────┐
       ↓              ↓              ↓
    Timers          Poll           Check
       │              │              │
 setTimeout       I/O work      setImmediate
 setInterval
       │              │              │
       └──────────────┼──────────────┘
                      ↓
                 Repeat cycle

    nextTick + microtasks are drained
    around JavaScript callback execution
    rather than being libuv phases.
```

### What this file covers

- Event-loop lifecycle and phases
- Timers
- Poll phase and I/O callback execution
- `setImmediate()`
- Microtasks
- `process.nextTick()`
- Execution ordering and nested scheduling
- Event-loop starvation
- Practical interview scenarios

---

# 2. Event Loop Lifecycle & Phases

The event loop repeatedly moves through phases and executes callbacks associated with those phases.

A simplified model is:

```text
Timers
  ↓
Pending Callbacks
  ↓
Idle / Prepare
  ↓
Poll
  ↓
Check
  ↓
Close Callbacks
  ↓
repeat
```

## 2.1 Timers

Associated with:

```js
setTimeout()
setInterval()
```

A timer does **not** guarantee that its callback executes exactly at the requested time.

For example:

```js
setTimeout(() => {
  console.log("timer");
}, 1000);
```

means approximately:

> The callback becomes eligible after the minimum delay; it executes when the event loop can process it.

If JavaScript is busy, the callback can run much later.

---

## 2.2 Pending Callbacks

This phase handles certain callbacks that have been deferred from a previous iteration.

You generally do not schedule application callbacks directly into this phase.

For interviews:

> Know that the phase exists and understand its role at a high level; application code normally interacts with it indirectly.

---

## 2.3 Idle / Prepare

These are internal libuv phases.

They matter when understanding Node/libuv internals, but they are rarely the focus of application-level Node.js development.

---

## 2.4 Poll — ⭐ Important

The Poll phase is central to understanding Node.js I/O.

Conceptually it has two responsibilities:

```text
Poll
 │
 ├── process available I/O-related work
 │
 └── when appropriate, wait for more I/O
```

Example:

```js
fs.readFile("data.txt", (err, data) => {
  console.log("read complete");
});
```

Conceptually:

```text
JavaScript
    ↓
Node fs API
    ↓
libuv / underlying mechanism
    ↓
filesystem operation
    ↓
completion
    ↓
callback becomes ready
    ↓
event-loop processing
    ↓
JavaScript callback
```

### Important precision

Do **not** memorize:

> "Every HTTP request callback executes directly in Poll."

That is an oversimplification.

A better model is:

```text
Network packet
      ↓
OS networking stack
      ↓
libuv/socket handling
      ↓
Node HTTP layer
      ↓
application JavaScript handler
      ↓
V8 / main JS thread
```

Poll deals with underlying I/O readiness/events, while Node's higher-level APIs process those events and eventually invoke your JavaScript.

---

## 2.5 Check

The Check phase is where:

```js
setImmediate(...)
```

callbacks execute.

```js
setImmediate(() => {
  console.log("immediate");
});
```

Mental model:

```text
Poll
  ↓
Check
  ↓
setImmediate callback
```

This is why `setImmediate()` is particularly useful for follow-up work after I/O/poll processing.

---

## 2.6 Close Callbacks

Close-related callbacks are handled here.

Example:

```js
socket.on("close", () => {
  console.log("socket closed");
});
```

---

# 3. Microtasks Are NOT an Event-Loop Phase

This distinction is critical.

Do not think of the event loop as:

```text
Timers
  ↓
Microtasks
  ↓
Poll
  ↓
Check
```

as though microtasks were another libuv phase.

Instead, think:

```text
Event-loop callback
      ↓
JavaScript executes
      ↓
nextTick / microtask queues are processed
      ↓
event loop continues
```

Common microtask mechanisms include:

```js
Promise.resolve().then(...)
queueMicrotask(...)
```

Node also has the separate:

```js
process.nextTick(...)
```

queue.

A useful interview-level model is:

```text
Current synchronous JavaScript
            ↓
     process.nextTick()
            ↓
       Microtasks
       ├── Promise callbacks
       └── queueMicrotask()
            ↓
     Event-loop processing
```

This is a mental model, not a complete implementation algorithm.

---

# 4. When Does Node Exit?

Node continues running while active resources/handles keep the process alive.

For example:

```js
setInterval(() => {
  console.log("running");
}, 1000);
```

The active interval keeps the process alive.

Whereas:

```js
console.log("hello");
```

can finish and allow Node to exit if nothing else is keeping the process alive.

This matters in production for:

- timers
- sockets
- servers
- database connections
- other active handles

---

# 5. Timers: `setTimeout()` and `setInterval()`

## 5.1 `setTimeout()`

```js
setTimeout(() => {
  console.log("Hello");
}, 1000);
```

The `1000` is a **minimum delay threshold**, not a precise execution guarantee.

Consider:

```js
setTimeout(() => {
  console.log("timer");
}, 100);

doHeavySynchronousWork(); // 2 seconds
```

The timer can become eligible around 100 ms, but the JavaScript thread is busy.

Therefore:

```text
0ms              100ms                    2000ms
│------------------│-------------------------│
                   timer eligible            JS free
                                              ↓
                                          callback
```

### Interview answer

> `setTimeout(fn, 1000)` does not guarantee execution exactly one second later. It guarantees that the callback will not be scheduled before the relevant timer threshold, but actual execution depends on event-loop availability.

---

## 5.2 `setTimeout(fn, 0)`

This does **not** mean "run immediately."

```js
setTimeout(() => {
  console.log("timer");
}, 0);

console.log("sync");
```

Output:

```text
sync
timer
```

The current synchronous JavaScript must finish first.

Think:

```text
setTimeout(0)
      ↓
timer becomes eligible
      ↓
event loop reaches timer processing
      ↓
callback executes
```

---

## 5.3 `setInterval()`

```js
setInterval(() => {
  console.log("tick");
}, 1000);
```

It does not guarantee one perfectly spaced execution every 1000 ms.

Event-loop delays can shift execution.

### Important production problem

Consider:

```js
setInterval(async () => {
  await processSomething();
}, 1000);
```

If `processSomething()` takes 5 seconds:

```text
0s   process #1 starts
1s   process #2 starts
2s   process #3 starts
3s   process #4 starts
...
5s   process #1 finishes
```

The async operations can overlap.

For serialized jobs, a recursive timer can be safer:

```js
async function run() {
  await processSomething();

  setTimeout(run, 1000);
}

run();
```

Now the next run is scheduled after the previous run finishes.

---

## 5.4 Timer Handles

Timers return handles that can be cancelled.

```js
const timer = setTimeout(() => {
  console.log("hello");
}, 5000);

clearTimeout(timer);
```

Likewise:

```js
const interval = setInterval(doSomething, 1000);

clearInterval(interval);
```

This matters for long-running services because unnecessary timers can retain resources and keep processes alive.

---

## 5.5 `unref()`

A timer normally contributes to keeping a Node process alive.

```js
const timer = setTimeout(() => {
  console.log("hello");
}, 100000);

timer.unref();
```

`unref()` means the timer will not, by itself, keep the process alive.

Useful conceptually for:

- optional cache refreshes
- background cleanup
- non-critical maintenance
- metrics flushing

Use it only when the task is genuinely optional; otherwise a graceful shutdown can accidentally skip required work.

---

# 6. `setImmediate()`

## 6.1 Core Idea

```js
setImmediate(() => {
  console.log("immediate");
});
```

Schedules the callback for the **Check phase**.

Think:

```text
Poll
  ↓
Check
  ↓
setImmediate()
```

Its main practical use is:

> Defer follow-up work until after current I/O/poll processing.

---

## 6.2 Strong Use Case: Inside I/O

```js
const fs = require("fs");

fs.readFile("data.txt", () => {
  console.log("I/O callback");

  setImmediate(() => {
    console.log("follow-up work");
  });
});
```

Conceptually:

```text
I/O callback
      ↓
setImmediate scheduled
      ↓
Check phase
      ↓
follow-up callback
```

Another example:

```js
db.query("SELECT ...", (err, result) => {
  res.json(result);

  setImmediate(() => {
    updateMetrics();
  });
});
```

This communicates:

> "Finish the current I/O callback, then perform this follow-up work."

---

## 6.3 `setImmediate()` Does NOT Create a Thread

This is a common misconception.

```js
setImmediate(() => {
  expensiveCalculation();
});
```

does not make the calculation parallel.

It still runs on the JavaScript thread:

```text
Main JS thread

I/O callback
     ↓
setImmediate callback
     ↓
expensiveCalculation()
     ↓
JS thread blocked
```

For CPU-heavy work, consider:

- Worker Threads
- worker pools
- separate processes
- external job workers

---

# 7. `setImmediate()` vs `setTimeout(0)`

Consider:

```js
setTimeout(() => {
  console.log("timeout");
}, 0);

setImmediate(() => {
  console.log("immediate");
});
```

At top-level, do **not** depend on a universal ordering.

Either may execute first depending on timing/runtime context.

### Inside I/O

```js
fs.readFile("data.txt", () => {
  setTimeout(() => {
    console.log("timeout");
  }, 0);

  setImmediate(() => {
    console.log("immediate");
  });
});
```

Here `setImmediate()` is generally expected to execute before the zero-delay timer because the code is already in an I/O/poll context.

Mental model:

```text
I/O callback
    ↓
Check
    ↓
setImmediate
    ↓
Timers
    ↓
setTimeout(0)
```

### Interview answer

> `setImmediate()` is associated with the Check phase, while `setTimeout(0)` goes through timer processing. Their ordering is not universally fixed at top-level, but inside an I/O callback `setImmediate()` generally runs first.

---

# 8. Microtasks

Microtasks are deferred JavaScript work that runs after the current JavaScript execution and before normal event-loop progression continues.

Common examples:

```js
Promise.resolve().then(() => {
  console.log("promise");
});

queueMicrotask(() => {
  console.log("microtask");
});
```

---

## 8.1 Promise Callbacks

```js
console.log("A");

Promise.resolve().then(() => {
  console.log("B");
});

console.log("C");
```

Output:

```text
A
C
B
```

Reason:

```text
sync A
sync C
   ↓
microtask queue
   ↓
B
```

---

## 8.2 `queueMicrotask()`

```js
console.log("A");

queueMicrotask(() => {
  console.log("B");
});

console.log("C");
```

Output:

```text
A
C
B
```

`queueMicrotask()` directly expresses:

> "Schedule this as a JavaScript microtask."

It is standard JavaScript rather than a Node-specific API.

---

## 8.3 Promise and `queueMicrotask()` Ordering

They use the regular microtask mechanism.

```js
Promise.resolve().then(() => console.log("A"));

queueMicrotask(() => console.log("B"));

Promise.resolve().then(() => console.log("C"));
```

Output:

```text
A
B
C
```

They are queued in scheduling order.

---

## 8.4 Microtasks vs Event-Loop Phases

Suppose:

```js
setTimeout(() => {
  console.log("timer");

  Promise.resolve().then(() => {
    console.log("promise");
  });
}, 0);
```

Conceptually:

```text
Timers phase
    ↓
timer callback
    ↓
Promise scheduled
    ↓
microtask drained
    ↓
promise
    ↓
continue event-loop processing
```

The Promise callback does not wait for the entire event-loop cycle to finish.

---

# 9. `process.nextTick()`

`process.nextTick()` is Node-specific.

```js
process.nextTick(() => {
  console.log("next tick");
});
```

It places work into Node's **nextTick queue**.

Useful mental model:

```text
Current synchronous JS
        ↓
nextTick queue
        ↓
regular microtask queue
        ↓
event-loop processing
```

---

## 9.1 Why `nextTick()` Exists

One legitimate use is normalizing an API so that a callback does not sometimes run synchronously and sometimes asynchronously.

For example:

```js
function getUser(callback) {
  if (!user) {
    process.nextTick(() => {
      callback(new Error("User not found"));
    });

    return;
  }

  callback(null, user);
}
```

Without careful design, callers can end up with inconsistent callback timing.

`nextTick()` lets the current synchronous operation finish first.

---

## 9.2 Another Example

```js
function createConnection(callback) {
  const connection = setupConnection();

  process.nextTick(() => {
    callback(connection);
  });
}
```

This allows setup to finish before the callback is invoked.

---

## 9.3 `nextTick()` vs `queueMicrotask()`

They are not identical.

```text
process.nextTick()
      ↓
Node-specific nextTick queue

queueMicrotask()
Promise.then()
      ↓
regular microtask queue
```

For the interview mental model, `nextTick()` is processed with higher priority than the regular microtask queue at the relevant scheduling boundary.

---

## 9.4 Dangerous Recursive `nextTick()`

```js
function recursive() {
  process.nextTick(recursive);
}

recursive();
```

This can starve the event loop:

```text
nextTick
   ↓
nextTick
   ↓
nextTick
   ↓
...
```

Timers and I/O may not get normal opportunities to execute.

### Production rule

Do not use recursive `nextTick()` as a loop/yield mechanism.

If your intention is to yield back to the event loop, use an appropriate event-loop scheduling mechanism such as `setImmediate()`, or redesign the work.

---

# 10. Microtask Starvation

The same general problem exists with recursive microtasks:

```js
function loop() {
  queueMicrotask(loop);
}

loop();
```

Conceptually:

```text
Microtask
   ↓
Microtask
   ↓
Microtask
   ↓
...
```

If new microtasks keep being scheduled while the queue is drained, normal event-loop work can be delayed.

This can cause:

```text
too much microtask work
        ↓
event loop delayed
        ↓
I/O latency increases
        ↓
API latency increases
```

The same principle applies to excessive Promise chains.

---

# 11. Execution Ordering

This topic combines everything above.

## 11.1 Basic Example

```js
console.log("A");

process.nextTick(() => console.log("B"));

Promise.resolve().then(() => console.log("C"));

queueMicrotask(() => console.log("D"));

setTimeout(() => console.log("E"), 0);

setImmediate(() => console.log("F"));

console.log("G");
```

Typical high-level ordering:

```text
A
G
B
C
D
E/F
```

The last two can vary at top-level.

The important conceptual ordering is:

```text
Synchronous JavaScript
        ↓
nextTick
        ↓
microtasks
        ↓
event-loop phases
```

Do not turn this into an absolute rule for every nested scenario.

---

## 11.2 Promise vs `queueMicrotask()`

```js
Promise.resolve().then(() => console.log("A"));

queueMicrotask(() => console.log("B"));

Promise.resolve().then(() => console.log("C"));
```

Output:

```text
A
B
C
```

because they are queued in that order.

---

## 11.3 `nextTick()` Scheduled Inside a Microtask

Consider:

```js
Promise.resolve().then(() => {
  console.log("A");

  process.nextTick(() => {
    console.log("B");
  });
});

Promise.resolve().then(() => {
  console.log("C");
});
```

Do not use the simplistic rule:

> "nextTick always immediately interrupts every microtask."

A `nextTick()` scheduled while processing the microtask queue does not magically preempt the currently executing microtask or all already-queued microtasks.

The correct interview-level statement is:

> `process.nextTick()` has higher priority than the regular microtask queue when Node reaches the relevant queue-processing boundary, but scheduling it from inside a microtask does not mean it instantly interrupts the current microtask or all previously queued microtasks.

---

# 12. Nested Scheduling: The Rule That Matters

When predicting execution order, always ask:

1. What is executing **right now**?
2. Which queue/phase does the newly scheduled callback enter?
3. Is the current queue still being drained?
4. Does the new callback get processed at the current scheduling boundary or a later one?
5. Is the code running at top-level, inside I/O, inside a timer, or inside another microtask?

This is much safer than memorizing:

```text
Promise > timer
```

or:

```text
nextTick always first
```

without considering context.

---

# 13. Production Impact of Scheduling

Execution ordering matters in real services.

If an application continuously creates high-priority work:

```text
nextTick / microtasks
        ↓
too much JavaScript
        ↓
event loop cannot progress normally
        ↓
I/O callbacks delayed
        ↓
request latency increases
```

When debugging unexpectedly high Node.js latency, investigate more than databases and downstream services.

Also investigate:

- synchronous CPU work
- large JSON parsing/stringification
- excessive Promise chains
- recursive microtasks
- recursive `process.nextTick()`
- event-loop delay
- long-running callbacks

---

# 14. Common Interview Traps

### Trap 1: "Node.js event loop is just one queue."

Incorrect.

It is better understood as a loop through multiple phases with different responsibilities.

---

### Trap 2: "Promise is an event-loop phase."

Incorrect.

Promise callbacks are microtasks.

---

### Trap 3: "`setTimeout(0)` runs immediately."

Incorrect.

It establishes a minimum delay/eligibility condition.

---

### Trap 4: "`setImmediate()` always beats `setTimeout(0)`."

Incorrect.

At top-level, ordering is not universally fixed.

Inside I/O, `setImmediate()` generally executes first.

---

### Trap 5: "`setImmediate()` creates another thread."

Incorrect.

It only changes scheduling. The callback still runs on the JavaScript thread.

---

### Trap 6: "Every asynchronous operation uses the libuv thread pool."

Incorrect.

Network I/O generally uses OS asynchronous networking mechanisms. Certain filesystem, crypto and DNS operations use the libuv thread pool.

---

### Trap 7: "`process.nextTick()` means the next event-loop iteration."

Incorrect.

It is a Node-specific high-priority deferral mechanism and is processed before normal event-loop progression at its relevant boundary.

---

### Trap 8: "Async means parallel JavaScript."

Incorrect.

Asynchronous I/O does not mean JavaScript callbacks execute concurrently on multiple threads.

---

# 15. Practical Scenarios: Which API Should I Use?

| API | Think | Typical use |
|---|---|---|
| `process.nextTick()` | "ASAP after current operation" | Node API/library callback normalization |
| `queueMicrotask()` | "Schedule JS microtask" | Deferring JavaScript work |
| `Promise.then()` | "Promise microtask" | Continuation after Promise settlement |
| `setImmediate()` | "Check phase / after I/O" | Follow-up work after I/O |
| `setTimeout()` | "After minimum delay" | Delayed work |
| `setInterval()` | "Repeat on a timer" | Periodic work, with care around overlap |

### Simple memory trick

```text
process.nextTick → ASAP after current operation
queueMicrotask   → JS microtask
setImmediate     → Check phase / after I/O
setTimeout       → minimum timer delay
setInterval      → repeated timer scheduling
```

---

# 16. SDE3 / Architect Interview Answers

## Q: Is Node.js single-threaded?

> JavaScript execution in a Node.js process normally occurs on a single main thread, but the Node.js runtime itself is not limited to one thread. libuv can use a worker pool for certain operations, and Node also supports Worker Threads and multiple processes.

---

## Q: Explain the event loop.

> Node's event loop repeatedly processes different phases such as timers, pending callbacks, poll, check and close callbacks. JavaScript callbacks execute on the main JS thread. Asynchronous I/O can progress outside that JavaScript execution path, and when work is ready Node schedules the relevant callback. `process.nextTick()` and regular microtasks are handled separately from the libuv phases.

---

## Q: Why doesn't `setTimeout(fn, 1000)` guarantee one second?

> The timer value is a minimum delay threshold. Once the timer becomes eligible, the callback still has to wait for the JavaScript thread and event-loop scheduling to allow it to execute.

---

## Q: `setImmediate()` vs `setTimeout(0)`?

> `setImmediate()` schedules work for the Check phase, while `setTimeout(0)` schedules timer work. At top-level their ordering is not guaranteed; inside an I/O callback, `setImmediate()` generally runs first.

---

## Q: What is a microtask?

> A microtask is deferred JavaScript work that is processed after the current JavaScript execution and before normal event-loop progression continues. Promise callbacks and `queueMicrotask()` use the regular microtask mechanism. Node also has a separate `process.nextTick()` queue.

---

## Q: Why can `process.nextTick()` be dangerous?

> Because it has very high scheduling priority. Recursive or excessive nextTick work can prevent the event loop from progressing to timers and I/O, increasing latency and potentially starving the application.

---

## Q: Why can a Node server have thousands of concurrent connections with one JS thread?

> Most connections spend significant time waiting for network I/O. Node can let the OS/libuv handle that waiting and only execute JavaScript when work is ready. The limitation is not simply the number of connections; it is how much work the main JS thread must perform for them.

---

# 17. Final Mental Model

```text
                         Node.js
                            │
                     Main JS Thread
                            │
                     ┌──────┴──────┐
                     │             │
                Sync JS       Event Loop
                                   │
             ┌─────────────────────┼─────────────────────┐
             ↓                     ↓                     ↓
          Timers                  Poll                 Check
      setTimeout/Interval       I/O work           setImmediate
             │                     │                     │
             └─────────────────────┼─────────────────────┘
                                   ↓
                          JS callback executes
                                   │
                     ┌─────────────┴─────────────┐
                     ↓                           ↓
               nextTick queue             microtask queue
                                           Promise / queueMicrotask
                     │                           │
                     └─────────────┬─────────────┘
                                   ↓
                            continue loop
```

### The most important principle

> **Node.js is efficient at I/O because the JavaScript thread does not sit blocked waiting for most asynchronous I/O. But once JavaScript itself starts doing expensive synchronous work—or excessive high-priority deferred work—the event loop can still become the bottleneck.**

---

# 18. Quick Revision — 60 Seconds

```text
Event loop
→ multiple phases, not one queue

Timers
→ setTimeout/setInterval
→ minimum delay, not exact execution time

Poll
→ important I/O phase
→ can process available I/O and wait when appropriate

Check
→ setImmediate()

Microtasks
→ Promise callbacks + queueMicrotask()
→ not a libuv event-loop phase

nextTick
→ Node-specific queue
→ very high priority
→ can starve event loop

setImmediate
→ Check phase
→ useful after I/O
→ does NOT create a thread

setTimeout(0)
→ not immediate
→ top-level ordering vs setImmediate is context-dependent

setInterval(async ...)
→ async executions can overlap

unref()
→ timer doesn't by itself keep process alive

Main production risk
→ long synchronous JS / excessive nextTick or microtask work
→ event-loop delay
→ higher API latency
```

---

# 19. Connections to Other Files

This file intentionally stops at **Topic 8**.

Next related areas:

- **`03-streams-buffers-backpressure.md`** → streams, buffers, backpressure and `drain`
- **`04-http-networking-and-connections.md`** → HTTP lifecycle, sockets, keep-alive, connection/request timeouts and pooling
- **`05-performance-memory-and-profiling.md`** → event-loop delay, CPU profiling and memory behavior
- **`07-processes-workers-and-scaling.md`** → Worker Threads, cluster and process-level parallelism

Topic 9 (Async I/O Internals) begins the next section because it connects the event loop to filesystem/network I/O and the libuv thread pool.

---

## Source Coverage Note

This file consolidates the original **Topics 2–8** from the uploaded Node.js preparation conversation into one revision document, preserving the original concepts, examples, interview framing and production takeaways while removing repeated explanations across the individual topics.

The source explicitly emphasized that phase ordering should not be treated as an overly rigid universal rule, especially for timer/poll interactions and nested scheduling. fileciteturn5file0L11-L11
