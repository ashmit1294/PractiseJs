/**
 * QUESTION SET: Node.js Event Loop
 *
 * The event loop is what allows Node.js to perform non-blocking I/O operations
 * despite JavaScript being single-threaded.
 *
 * Phases (in order):
 * 1. timers       → setTimeout, setInterval callbacks
 * 2. pending      → I/O callbacks deferred to next iteration
 * 3. idle/prepare → internal use
 * 4. poll         → retrieve new I/O events (MOST time spent here)
 * 5. check        → setImmediate callbacks
 * 6. close        → close event callbacks (socket.on('close'))
 *
 * Microtasks (between every phase):
 *   process.nextTick > Promise.then > queueMicrotask
 */

// ─────────────────────────────────────────────
// Q1. Event loop order — predict the output
// WHAT: In what order do setTimeout, Promise, nextTick, setImmediate run?
// THEORY: Sync code first → nextTick (microtask, highest) → Promises (microtask) →
//         timers phase (setTimeout) → check phase (setImmediate).
// ─────────────────────────────────────────────
console.log("1 — synchronous");

setTimeout(() => console.log("2 — setTimeout 0"), 0);

Promise.resolve().then(() => console.log("3 — Promise.then"));

process.nextTick(() => console.log("4 — nextTick"));

setImmediate(() => console.log("5 — setImmediate"));

console.log("6 — synchronous");

// Output order: 1, 6, 4, 3, 2, 5
// Why:
//   1 & 6 → synchronous, run first
//   4 → nextTick queue (highest priority microtask)
//   3 → Promise microtask queue
//   2 → timers phase (setTimeout 0ms → next iteration)
//   5 → check phase (setImmediate → after poll phase)

// ─────────────────────────────────────────────
// Q2. Nested microtasks — nextTick in a loop
// WHAT: What happens if you recursively call process.nextTick?
// THEORY: nextTick has highest priority, queue keeps growing → event loop NEVER reaches poll/timers.
//         File I/O, network blocked. Called "event loop starvation". Fix: Use setImmediate instead.
// ─────────────────────────────────────────────
// DANGEROUS — starves I/O:
// process.nextTick(function tick() {
//   process.nextTick(tick); // infinite nextTick loop blocks everything
// });

// Safe — use setImmediate for recursive async:
function safeRecursion() {
  setImmediate(function tick() {
    // do work
    setImmediate(tick); // yields to event loop between iterations
  });
}

// ─────────────────────────────────────────────
// Q3. setTimeout vs setImmediate — which runs first?
// WHAT: Does setImmediate run before or after setTimeout(0)?
// THEORY: Outside I/O callback = random order (both same iteration). Inside I/O callback = setImmediate 
//         always first (check phase after poll). Don't rely on order; use Promises for guaranteed sequence.
// ─────────────────────────────────────────────

// Outside I/O callback — order is non-deterministic
setTimeout(() => console.log("timeout"), 0);
setImmediate(() => console.log("immediate"));
// Output: either order (depends on OS scheduling)

// INSIDE I/O callback — setImmediate always first
const fs = require("fs");
fs.readFile(__filename, () => {
  setTimeout(() => console.log("timeout inside I/O"), 0);
  setImmediate(() => console.log("immediate inside I/O — ALWAYS FIRST"));
});

// ─────────────────────────────────────────────
// Q4. process.nextTick use case
// WHAT: Why defer event emission from EventEmitter constructor?
// THEORY: Emit in constructor = listener not attached yet = event lost. nextTick defers until 
//         AFTER constructor + listener attachment. Standard Node.js pattern (many libraries use it).
// ─────────────────────────────────────────────

// Use case: emit event after constructor returns
const EventEmitter = require("events");

class MyEmitter extends EventEmitter {
  constructor() {
    super();
    // BUG: emitting 'ready' here — event listener hasn't been attached yet
    // this.emit('ready');

    // FIX: defer until after constructor returns
    process.nextTick(() => this.emit("ready"));
  }
}

const em = new MyEmitter();
em.on("ready", () => console.log("Emitter is ready!"));

// ─────────────────────────────────────────────
// Q5. Promise chaining and microtask queue
// WHAT: What's the execution order of sync code, await Promise, and setTimeout?
// THEORY: await queues in microtask queue (very fast). setTimeout queues in timers phase (waits full iteration).
//         Sync runs first → microtasks → phases. await Promise.resolve() much faster than await setTimeout(0).
// ─────────────────────────────────────────────
async function asyncVsSync() {
  console.log("A");

  await Promise.resolve();
  console.log("B"); // runs after current synchronous block

  setTimeout(() => console.log("C — setTimeout"), 0);

  await new Promise((resolve) => setTimeout(resolve, 0));
  console.log("D"); // runs after C (awaiting a setTimeout)

  console.log("E");
}

asyncVsSync();
console.log("F"); // runs before B — F is synchronous, B needs microtask queue

// Output: A, F, B, C, D, E

// ─────────────────────────────────────────────
// Q6. Call Stack visualization
// WHAT: How does the call stack track function execution?
// THEORY: Each function call PUSHED onto stack, then POPPED when returning. Sync calls block event loop.
//         Deep recursion + sync = stack overflow. Async callbacks don't block (queued in event loop).
// ─────────────────────────────────────────────
function multiply(a, b) { return a * b; }
function square(n) { return multiply(n, n); }
function printSquare(n) { console.log(square(n)); }

// Call stack:
// printSquare(5)
//   square(5)
//     multiply(5, 5)
//     ← multiply returns 25
//   ← square returns 25
// ← printSquare logs 25, returns

printSquare(5);

// ─────────────────────────────────────────────
// Q7. Non-blocking I/O with callbacks
// WHAT: How can Node.js handle thousands of concurrent I/O operations?
// THEORY: I/O delegated to libuv thread pool (file, DNS) or OS async (network). Main JS thread continues.
//         When I/O completes, callback queued in poll phase. Main thread never blocks on I/O.
// ─────────────────────────────────────────────
const path = require("path");

function readFileAsync(filePath, callback) {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) return callback(err);
    callback(null, data);
  });
}

// Node.js can handle thousands of concurrent I/O ops because:
// 1. fs/net operations are delegated to libuv thread pool
// 2. Meanwhile, event loop processes other callbacks
// 3. When I/O completes, callback is queued in poll phase

// ─────────────────────────────────────────────
// Q8. Worker Threads for CPU-intensive tasks
// WHAT: When should you use Worker Threads?
// THEORY: Use for CPU-intensive sync work that would block event loop (image processing, crypto).
//         NOT for I/O — Node's async handles that efficiently. Default: 1 main thread + 4 worker threads.
// ─────────────────────────────────────────────
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");

if (isMainThread) {
  // Main thread: spawn worker
  function fibonacci(n) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { n } });
      worker.on("message", resolve);
      worker.on("error", reject);
    });
  }

  fibonacci(40).then((result) => console.log("Fibonacci(40):", result));
} else {
  // Worker thread: compute and send result
  function fib(n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
  }
  parentPort.postMessage(fib(workerData.n));
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the event loop?
  A: A C loop (in libuv) that processes async callbacks after the
     call stack is empty. It has phases: timers, I/O, idle/prepare,
     poll, check, close. Microtasks (nextTick, Promises) run between
     each phase transition.

  Q: What is the difference between process.nextTick and setImmediate?
  A: nextTick runs BEFORE the next event loop iteration (after current op).
     setImmediate runs in the CHECK phase of the NEXT iteration.
     nextTick has higher priority. Avoid recursive nextTick.

  Q: Why is Node.js single-threaded but non-blocking?
  A: I/O operations (disk, network) are delegated to OS/libuv thread pool.
     The main JS thread registers a callback and continues.
     When I/O completes, the callback is added to the event queue.

  Q: How many threads does Node.js actually use?
  A: By default: 1 main JS thread + 4 libuv worker threads (UV_THREADPOOL_SIZE).
     libuv threads handle: file I/O, DNS, zlib, crypto.
     Network I/O uses OS async syscalls (epoll/kqueue), no threads needed.

  Q: When should you use Worker Threads?
  A: For CPU-intensive synchronous work that would block the event loop
     (image processing, cryptography, complex data transforms).
     Do NOT use for I/O — Node's async model handles that efficiently.
*/

module.exports = { readFileAsync };
