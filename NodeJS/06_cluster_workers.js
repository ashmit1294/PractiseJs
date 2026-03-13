/**
 * QUESTION SET: Node.js Cluster, Worker Threads & child_process
 *
 * 1. cluster module — multi-core HTTP server
 * 2. worker_threads — CPU-bound work off the main thread
 * 3. Shared memory with SharedArrayBuffer + Atomics
 * 4. child_process — spawn / exec / fork
 * 5. Process communication patterns
 */

const os = require("os");
const cluster = require("cluster");
const { Worker, isMainThread, parentPort, workerData, MessageChannel } = require("worker_threads");
const { spawn, exec, fork } = require("child_process");

// ─────────────────────────────────────────────
// Q1. cluster module
// Each worker is a separate OS process (separate V8 heap, event loop)
// Primary process distributes incoming TCP connections via round-robin
// ─────────────────────────────────────────────

function startClusteredServer() {
  if (cluster.isPrimary) {
    const numCPUs = os.cpus().length;
    console.log(`Primary PID ${process.pid} — forking ${numCPUs} workers`);

    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
      console.warn(`Worker ${worker.process.pid} died (${signal || code}). Respawning…`);
      cluster.fork(); // auto-restart
    });

    // Graceful shutdown — drain workers, then kill them
    process.on("SIGTERM", () => {
      for (const id in cluster.workers) {
        cluster.workers[id].send("shutdown");
      }
    });
  } else {
    // Each worker runs an independent Express instance
    const express = require("express");
    const app = express();
    app.get("/", (req, res) => res.send(`Worker ${process.pid}`));
    app.listen(3000, () => console.log(`Worker ${process.pid} listening`));

    // Graceful shutdown message from primary
    process.on("message", (msg) => {
      if (msg === "shutdown") {
        // Stop accepting new connections
        app.close(() => process.exit(0));
      }
    });
  }
}

// ─────────────────────────────────────────────
// Q2. worker_threads — CPU-bound tasks
// Threads share the same memory — lower overhead than child processes
// V8 isolate per thread, but SharedArrayBuffer enables shared memory
// ─────────────────────────────────────────────

// Main thread
function runCpuTask(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: data, // Serialised (structured clone) and passed to worker
    });
    worker.on("message", resolve);
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

// Worker thread code (same file — guarded by isMainThread)
if (!isMainThread) {
  const { data } = workerData;
  const result = cpuIntensiveTask(data); // blocks this thread, not event loop
  parentPort.postMessage(result);
}

function cpuIntensiveTask(data) {
  // Example: compute prime numbers
  let count = 0;
  for (let n = 2; n <= data.limit; n++) {
    let prime = true;
    for (let i = 2; i <= Math.sqrt(n); i++) {
      if (n % i === 0) { prime = false; break; }
    }
    if (prime) count++;
  }
  return count;
}

// ─────────────────────────────────────────────
// Q3. Worker Thread Pool (reuse workers)
// Creating a worker per-request is expensive.
// Maintain a pool and queue tasks.
// ─────────────────────────────────────────────

class WorkerPool {
  #workers = [];
  #queue = [];
  #size;

  constructor(workerScript, size = os.cpus().length) {
    this.#size = size;
    for (let i = 0; i < size; i++) {
      this.#createWorker(workerScript);
    }
  }

  #createWorker(script) {
    const worker = new Worker(script);
    const entry = { worker, busy: false };
    worker.on("message", ({ id, result, error }) => {
      entry.busy = false;
      const pending = this.#queue.find((t) => t.id === id);
      if (pending) {
        this.#queue = this.#queue.filter((t) => t.id !== id);
        error ? pending.reject(new Error(error)) : pending.resolve(result);
      }
      this.#drain(); // pick next task from queue
    });
    this.#workers.push(entry);
  }

  run(data) {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(2);
      this.#queue.push({ id, data, resolve, reject });
      this.#drain();
    });
  }

  #drain() {
    const idle = this.#workers.find((w) => !w.busy);
    const next = this.#queue.find((t) => !t.inFlight);
    if (idle && next) {
      idle.busy = true;
      next.inFlight = true;
      idle.worker.postMessage({ id: next.id, data: next.data });
    }
  }

  destroy() {
    this.#workers.forEach(({ worker }) => worker.terminate());
  }
}

// ─────────────────────────────────────────────
// Q4. SharedArrayBuffer + Atomics
// Multiple threads reading/writing same memory — needs synchronisation
// ─────────────────────────────────────────────

function sharedMemoryExample() {
  const sharedBuffer = new SharedArrayBuffer(4 * Int32Array.BYTES_PER_ELEMENT);
  const shared = new Int32Array(sharedBuffer);

  // Atomic increment (thread-safe counter)
  // Atomics.add reads, adds and writes atomically — no race condition
  Atomics.add(shared, 0, 1);

  // Lock pattern using Atomics.compareExchange (simple spinlock)
  function lock(index) {
    while (Atomics.compareExchange(shared, index, 0, 1) !== 0) {
      Atomics.wait(shared, index, 1); // park thread until value changes
    }
  }

  function unlock(index) {
    Atomics.store(shared, index, 0);
    Atomics.notify(shared, index, 1); // wake one waiting thread
  }

  return { sharedBuffer, shared };
}

// ─────────────────────────────────────────────
// Q5. child_process.spawn — stream large outputs
// ─────────────────────────────────────────────

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Command failed (${code}): ${Buffer.concat(stderr).toString()}`));
      }
      resolve(Buffer.concat(stdout).toString());
    });

    child.on("error", reject);
  });
}

// child_process.exec — buffer output (small outputs only, default maxBuffer 1MB)
function execCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
  });
}

// ─────────────────────────────────────────────
// Q6. child_process.fork — separate Node process with IPC
// ─────────────────────────────────────────────

// main.js
function runForkedWorker() {
  const child = fork("./worker-process.js", [], {
    env: { ...process.env, WORKER_ID: "1" },
  });

  child.send({ type: "COMPUTE", data: { limit: 1_000_000 } });

  child.on("message", (msg) => {
    if (msg.type === "RESULT") {
      console.log("Prime count:", msg.result);
      child.kill();
    }
  });

  child.on("exit", (code) => {
    console.log("Worker exited with code", code);
  });
}

// worker-process.js (separate file)
/*
process.on('message', (msg) => {
  if (msg.type === 'COMPUTE') {
    const result = countPrimes(msg.data.limit);
    process.send({ type: 'RESULT', result });
    process.exit(0);
  }
});
*/

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the difference between cluster and worker_threads?

  Cluster:
    - Separate OS processes — separate V8 heaps, event loops
    - Full isolation — a crash in one worker doesn't affect others
    - Higher memory overhead (each process loads Node.js runtime)
    - Shares TCP server (kernel distributes connections)
    - Use for: scaling I/O-bound HTTP servers across cores

  worker_threads:
    - OS threads within the same process
    - Shared memory via SharedArrayBuffer
    - Lower overhead than processes
    - A crash in a worker can still crash the process in some scenarios
    - Use for: CPU-intensive tasks (image processing, parsing, crypto)

  Q: Why can't you share closures between worker threads?
  A: Each Worker thread runs in its own V8 isolate — separate heap.
     You communicate via postMessage (structured clone algorithm) or SharedArrayBuffer.
     Structured clone copies data — it's not a shared reference.
     Functions cannot be transferred (only data).

  Q: What is the structured clone algorithm?
  A: The serialisation mechanism used by postMessage and worker_threads.
     Supports: primitives, Arrays, Objects, Date, RegExp, Map, Set, ArrayBuffer, TypedArrays, Blob.
     Does NOT support: functions, DOM nodes, class instances with prototypes.
     Circular references are handled correctly.

  Q: When would you use child_process.fork over worker_threads?
  A: fork() for:
     - Running an entirely separate Node.js script (different codebase)
     - When you need full process isolation (crash isolation)
     - When the worker needs its own memory, env, and event listeners
  worker_threads for:
     - Sharing memory (SharedArrayBuffer)
     - Lower overhead when spawning many threads
     - Keeping the thread pool within one process

  Q: How do you prevent zombie processes?
  A: Always handle the 'exit' and 'error' events of child processes.
     Call child.kill() when done, or use detached + unref() for truly
     independent background processes.
     In cluster: listen for 'exit' on the primary and respawn workers.
*/

module.exports = { WorkerPool, runCommand, execCommand };
