/*
=============================================================
  NODE.JS THEORY — INTERVIEW Q&A
  Basic → Intermediate → Advanced
  For 7+ years experience
=============================================================
*/

// ─────────────────────────────────────────────────────────
// ██ SECTION 1: BASIC
// ─────────────────────────────────────────────────────────

/*
Q1 [BASIC]: What is the Node.js event loop? Explain each phase.
────────────────────────────────────────────────────────────────
A: The event loop is a C loop (in libuv) that continuously checks the call stack
   and task queues. It has PHASES — each processes a specific type of callback.
   Order of phases per loop iteration:

   1. timers         → callbacks from setTimeout / setInterval whose delay has elapsed
   2. pending I/O    → I/O error callbacks deferred from previous iteration
   3. idle, prepare  → internal use only
   4. poll           → retrieve new I/O events; blocks here if nothing else to do
   5. check          → setImmediate() callbacks
   6. close callbacks→ e.g., socket.on('close', ...)

   Between EVERY phase: process.nextTick callbacks drain completely
   Between EVERY phase: Promise microtasks drain completely
   nextTick runs BEFORE Promises within the same "between phases" window.

// ELI5: The event loop is like a restaurant manager checking different stations in order: timers, then I/O events,
// then immediate callbacks. Between each station check, they handle all urgent notes (nextTick) and pending orders (Promises).
*/
// Demonstrates phase ordering:
setTimeout(() => console.log('1. setTimeout'), 0);

setImmediate(() => console.log('2. setImmediate'));

Promise.resolve().then(() => console.log('3. Promise microtask'));

process.nextTick(() => console.log('4. nextTick'));

console.log('5. sync');

// Output: 5 → 4 → 3 → 1 → 2
// Reason: sync first, then nextTick (before microtasks), then Promise, then timers phase, then check phase
// Note: setTimeout vs setImmediate order can vary if NOT inside an I/O callback.
// Inside I/O callback: setImmediate ALWAYS before setTimeout.

/*
Q2 [BASIC]: Why is Node.js "non-blocking" even though JavaScript is single-threaded?
─────────────────────────────────────────────────────────────────────────────────────
A: Non-blocking I/O is achieved via the OS (epoll on Linux, kqueue on macOS, IOCP on Windows)
   and libuv's thread pool.

   Network I/O (TCP, HTTP): handed to OS async syscalls. No threads needed.
   File I/O, DNS, Crypto, zlib: delegated to libuv's thread pool (default: 4 threads).
   The main JS thread is free to process other events while waiting.

   Analogy: A chef (JS thread) takes orders (requests), puts food in the oven (I/O),
   and doesn't stand there watching — they take more orders instead.
   A kitchen helper (libuv thread) monitors the oven and notifies the chef.

// ELI5: Node is like a chef with multiple arms who can start cooking one dish and move to the next without waiting for the first to finish.
// The oven (OS) handles the actual cooking in the background while the chef preps other dishes.
*/
const { readFile } = require('fs');

// This does NOT block — readFile hands off to libuv thread pool
readFile('/etc/hosts', 'utf8', (err, data) => {
  // This callback runs in the POLL phase when file reading is complete
  if (err) throw err;
  console.log(data.slice(0, 50));
});

// While file is being read, Node continues here:
console.log('This prints BEFORE the file content'); // ← runs immediately

/*
Q3 [BASIC]: What are Streams and why are they important in Node.js?
────────────────────────────────────────────────────────────────────
A: Streams process data in CHUNKS rather than loading everything into memory.
   Critical for: large file processing, HTTP responses, video streaming, CSV parsing.

   Types: Readable, Writable, Duplex (both), Transform (duplex + modify data)
   All streams inherit from EventEmitter.

// ELI5: Streams are like a water pipe - you don't fill up a bucket all at once, you let water flow through.
// Instead of loading a 1GB file into memory (bucket overflows), you process it in chunks (steady water flow).
*/
const { createReadStream, createWriteStream } = require('fs');
const { createGzip } = require('zlib');
const { pipeline } = require('stream/promises');  // ← promisified pipeline

// BAD: loads entire 10GB file into memory
// const data = fs.readFileSync('bigfile.csv'); // 💀 heap OOM

// GOOD: streams — constant memory usage regardless of file size
async function gzipFile(input, output) {
  await pipeline(
    createReadStream(input),        // read in 64KB chunks
    createGzip(),                   // compress each chunk
    createWriteStream(output),      // write each compressed chunk
  );
  // Maximum memory used: ~3x chunk size (read + compress buffer + write)
  // NOT the entire file size
}

// ─────────────────────────────────────────────────────────
// ██ SECTION 2: INTERMEDIATE
// ─────────────────────────────────────────────────────────

/*
Q4 [INTERMEDIATE]: What is AsyncLocalStorage and how does it replace req.locals?
──────────────────────────────────────────────────────────────────────────────────
A: AsyncLocalStorage provides a context that propagates automatically through
   async operations (Promises, callbacks, timers, streams) within a single async call tree.
   Like thread-local storage but for async operations.
   Use: request-scoped context (requestId, userId, logger) without passing it everywhere.

// ELI5: AsyncLocalStorage is like a backpack that follows you through your entire adventure.
// Any function you call down the line can open the backpack and check what's inside without you having to pass it to every function.
*/
const { AsyncLocalStorage } = require('async_hooks');

const requestContext = new AsyncLocalStorage();

// Middleware: set context at the start of each request
function requestMiddleware(req, res, next) {
  const context = {
    requestId: req.headers['x-request-id'] || crypto.randomUUID(),
    userId: req.user?.id,
    startTime: Date.now(),
  };
  // All async operations triggered within this callback inherit the context
  requestContext.run(context, () => next());
}

// Anywhere in the call tree — no need to pass context explicitly
async function databaseQuery(sql) {
  const context = requestContext.getStore();          // ← automatically available
  console.log(`[${context?.requestId}] Executing: ${sql}`);
  // Use for logging, tracing, audit trails
}

// Logger that auto-includes request context:
const logger = {
  info(msg) {
    const ctx = requestContext.getStore();
    console.log(JSON.stringify({ level: 'info', msg, ...ctx }));
  },
};

/*
Q5 [INTERMEDIATE]: How does Node.js clustering work, and what are the downsides?
──────────────────────────────────────────────────────────────────────────────────
A: Node.js is single-threaded, so it can only use ONE CPU core by default.
   cluster module forks N worker processes (one per CPU), each running the same server code.
   The master process distributes incoming connections across workers.
   Workers share the same port via OS-level load balancing.

   Downsides:
   1. Workers do NOT share memory (separate process = separate heap)
      → Cannot use in-memory cache across workers
      → Session data must be stored in Redis/DB, not process memory
   2. Harder to debug (multiple processes)
   3. Each worker runs full server startup → more memory usage
// ELI5: Clustering is like opening multiple checkout lanes in a store instead of one. Each lane is a separate worker.
// The main manager directs customers to each lane, but each lane can't share its clipboard with other lanes.*/
const cluster = require('cluster');
const os = require('os');
const http = require('http');

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(`Primary ${process.pid} is running. Forking ${numCPUs} workers.`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();   // ← auto-restart failed workers (resilience pattern)
  });
} else {
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end(`Worker ${process.pid} handled request`);
  }).listen(3000);
}

/*
Q6 [INTERMEDIATE]: Explain backpressure in Node.js streams and how to handle it.
───────────────────────────────────────────────────────────────────────────────────
A: Backpressure occurs when the PRODUCER (Readable) generates data faster than the
   CONSUMER (Writable) can process it. Without handling, data piles up in memory.

   Node's stream API communicates backpressure via boolean returns and 'drain' events.
   pipeline() / pipe() handle backpressure automatically — always prefer them.

// ELI5: Backpressure is like a traffic jam - a slow lane (writable) causes a backup in the fast lane (readable).
// You tell the fast lane to slow down until the jam clears.
*/
const { Readable, Writable } = require('stream');

// Manually handling backpressure:
const readable = createReadStream('bigfile.json');
const writable = createWriteStream('output.json');

readable.on('data', (chunk) => {
  const canContinue = writable.write(chunk);  // write returns false when buffer is full
  if (!canContinue) {
    readable.pause();    // ← tell source to stop producing (backpressure applied!)
    writable.once('drain', () => {
      readable.resume(); // ← drain fires when write buffer is flushed — safe to produce again
    });
  }
});

readable.on('end', () => writable.end());

// BETTER: pipeline handles all this automatically + proper error propagation:
// pipeline(readable, writable).catch(err => console.error(err));

/*
Q7 [INTERMEDIATE]: How does the Node.js module caching system work?
────────────────────────────────────────────────────────────────────
A: require() caches modules by their RESOLVED FILENAME.
   Second require() of the same file returns the CACHED MODULE OBJECT — no re-execution.
   This means:
   - Singleton pattern is automatic with CJS modules
   - Mutation of exports is shared across all requirers
   - Circular dependencies are possible but return incomplete exports

// ELI5: When you require a module, Node caches it like a photocopy machine remembering paper size settings.
// Every time you ask for the same paper size again, it uses the old setting instead of reconfiguring.
*/
// db.js:
// let connection = null;
// module.exports = {
//   connect() { connection = new DB(); return connection; },
//   query(sql) { return connection.query(sql); }
// };
// Any number of files require('./db') → they all get the SAME exported object
// → connection state is shared → natural singleton

// Clear cache (useful in tests):
// delete require.cache[require.resolve('./myModule')];  // force fresh require

// ─────────────────────────────────────────────────────────
// ██ SECTION 3: ADVANCED
// ─────────────────────────────────────────────────────────

/*
Q8 [ADVANCED]: How do you diagnose and fix memory leaks in a production Node.js app?
──────────────────────────────────────────────────────────────────────────────────────
A: Symptoms: heap growing over time, eventual OOM / process restart.
   Process:
   1. Monitor heap metrics (process.memoryUsage().heapUsed over time)
   2. Generate heap snapshots at different times
   3. Compare snapshots to find retained objects
   4. Find what is holding references (retention path)

// ELI5: Memory leaks are like leaving your fridge on at a storage locker and forgetting about it.
// You check photos of when it was packed vs now to see what's still in there that shouldn't be.
*/
const v8 = require('v8');
const { writeFileSync } = require('fs');

// Method 1: V8 heap snapshot (analyze in Chrome DevTools → Memory tab)
function captureHeapSnapshot(filename) {
  const snapshotData = v8.writeHeapSnapshot();  // writes .heapsnapshot file
  console.log(`Snapshot written to: ${snapshotData}`);
}

// Method 2: Track memory usage over time
function monitorMemory(intervalMs = 10000) {
  setInterval(() => {
    const used = process.memoryUsage();
    console.log({
      heapUsed:  `${Math.round(used.heapUsed  / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
      rss:       `${Math.round(used.rss       / 1024 / 1024)} MB`,  // Resident Set Size (total process memory)
      external:  `${Math.round(used.external  / 1024 / 1024)} MB`,  // C++ objects tied to V8
    });
  }, intervalMs);
}

// Common production leak pattern: EventEmitter listener accumulation
const EventEmitter = require('events');
const emitter = new EventEmitter();

// BAD: each request adds a new listener but never removes it
// app.get('/subscribe', (req, res) => {
//   emitter.on('data', (d) => res.json(d)); // ← leaked! response gone but listener remains
// });

// GOOD: remove listener when request ends
// app.get('/subscribe', (req, res) => {
//   const handler = (d) => res.json(d);
//   emitter.on('data', handler);
//   req.on('close', () => emitter.off('data', handler)); // cleanup on disconnect
// });

/*
Q9 [ADVANCED]: How does Node.js handle uncaught exceptions and unhandled promise rejections?
────────────────────────────────────────────────────────────────────────────────────────────
A: Unhandled errors crash the process — but you WANT that in production (predictable state).
   The goal is to: log the error, flush any pending I/O, then exit gracefully.
   Never swallow errors silently.

// ELI5: Uncaught exceptions are like a fire alarm - you can't ignore it. Log it, run out of the building (exit cleanly), and don't come back.
// Continuing after an uncaught exception is like staying in a burning building hoping it's okay.
*/

// PROCESS-LEVEL error handling (last resort — not a substitute for proper error handling)
process.on('uncaughtException', (err, origin) => {
  // DO: log the error
  console.error('UNCAUGHT EXCEPTION:', err.message, err.stack);
  // DO: exit immediately — process state is indeterminate after uncaught exception
  // NOT safe to continue (memory could be corrupt, db connections could be broken)
  process.exit(1);
  // DON'T continue running — that's dangerous
});

process.on('unhandledRejection', (reason, promise) => {
  // In Node 15+: unhandledRejection also terminates the process (as it should)
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});

// CORRECT pattern: proper try/catch in async functions
async function safeOperation() {
  try {
    const result = await riskyOperation();
    return result;
  } catch (err) {
    // Handle or re-throw — NEVER ignore
    logger.error({ err, operation: 'safeOperation' });
    throw err;   // re-throw for caller to handle or for Express error middleware
  }
}

const logger = { error: console.error };
async function riskyOperation() { return 'ok'; }

/*
Q10 [ADVANCED]: What is the difference between child_process.fork(), spawn(), and exec()?
──────────────────────────────────────────────────────────────────────────────────────────
A: All three create child processes, but differ in use case and how they handle I/O.
*/
const { fork, spawn, exec, execFile } = require('child_process');

// spawn() → stream-based I/O. Use for long-running processes with large output.
//           Does not create a shell (safer — no shell injection risk).
const ls = spawn('ls', ['-la', '/tmp']);    // streams stdout/stderr
ls.stdout.on('data', (data) => console.log(data.toString()));
ls.on('close', (code) => console.log(`Exit code: ${code}`));

// exec() → buffers ALL output in memory. Use for small output, needs shell features.
//          Creates a shell → SHELL INJECTION RISK if user input is in command string.
exec('ls -la /tmp', (err, stdout, stderr) => {
  // stdout is the full output as a string
  // BAD: exec(`ls ${userInput}`) → command injection if userInput = '; rm -rf /'
  // GOOD: execFile or spawn with arguments array (no shell)
});

// execFile() → like exec but no shell (safer than exec when running a specific file)
execFile('/usr/bin/ls', ['-la'], (err, stdout) => console.log(stdout));

// fork() → special spawn for Node.js scripts with built-in IPC channel
//          Shares V8 context overhead but has message passing
const worker = fork('./worker.js');         // creates new Node.js process
worker.send({ task: 'compute', data: 42 }); // send message to child
worker.on('message', (result) => {
  console.log('Worker result:', result);
  worker.kill();
});

/*
Q11 [ADVANCED]: How does Node.js handle long-running CPU-intensive tasks without blocking?
───────────────────────────────────────────────────────────────────────────────────────────
A: Options from simplest to most powerful:
   1. Offload to external service (microservice, Lambda, job queue)
   2. setImmediate chunking (cooperative multitasking)
   3. worker_threads (true parallel V8 execution within same process)
   4. child_process.fork() (separate process entirely)

// ELI5: setImmediate chunking is like a juggler taking a breath between catching balls.
// Worker threads are like hiring a real assistant to do work in parallel. Child process is hiring a completely separate person.
*/
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// setImmediate chunking: break up CPU work to yield I/O callbacks between chunks
async function processArray(items) {
  const CHUNK_SIZE = 100;
  const results = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    chunk.forEach(item => results.push(item * 2));
    // Yield to the event loop after each chunk
    await new Promise(resolve => setImmediate(resolve));
    // → I/O callbacks, timers, incoming requests can run between chunks
  }
  return results;
}

// Worker Threads: true parallelism for CPU-bound tasks
function runInWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require('worker_threads');
      // CPU-intensive computation (does NOT block main thread)
      let result = 0;
      for (let i = 0; i < workerData.n; i++) result += i;
      parentPort.postMessage(result);
    `, { eval: true, workerData: data });

    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

/*
Q12 [ADVANCED]: Explain HTTP keep-alive, connection pooling, and their impact at scale.
──────────────────────────────────────────────────────────────────────────────────────
A: HTTP/1.1 keep-alive: reuse TCP connections for multiple requests (avoid 3-way handshake cost).
   Without keep-alive: each request does TCP connect (3-way handshake ~50-200ms) + TLS (~2 RTT).
   With keep-alive: connection stays open, subsequent requests pay ~0 connection overhead.

   Node's http.globalAgent manages a connection pool per host:port.
   Default maxSockets: Infinity (can overwhelm target server).
   Always configure agent for outbound connections.

// ELI5: HTTP keep-alive is like having a standing appointment with a restaurant instead of calling ahead each time.
// Connection pooling is like managing multiple standing appointments so you don't overwhelm the restaurant.
*/
const http = require('http');
const https = require('https');

// Properly configure agent for production use
const httpsAgent = new https.Agent({
  keepAlive: true,           // reuse connections
  keepAliveMsecs: 30_000,   // send keep-alive probes every 30s
  maxSockets: 50,            // max connections per host (tune to your target server's capacity)
  maxFreeSockets: 10,        // keep N idle connections in pool
  timeout: 5000,             // socket timeout
});

// Reuse the SAME agent across all requests (create once, use everywhere):
async function callAPI(path) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      { hostname: 'api.example.com', path, agent: httpsAgent },  // ← uses pooled connections
      (res) => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => resolve(JSON.parse(data)));
      }
    );
    req.on('error', reject);
  });
}

module.exports = { gzipFile, processArray, callAPI };

/*
Q13 [INTERMEDIATE]: Buffers and Streams in Node.js — types, .pipe(), backpressure detailed\n───────────────────────────────────────────────────────────────────────────────────────────\nA: BUFFER: fixed-size chunk of binary memory. Key for binary data (images, video, zlib, encryption).\n   STREAM: continuous data flow processed incrementally. Critical for large files without OOM.\n\n   stream.pipe() automatically handles backpressure — always prefer over manual event listeners.\n*/\n\n// BUFFER usage:\nconst buf1 = Buffer.alloc(10);                 // allocate 10 zero-filled bytes\nconst buf2 = Buffer.from([1, 2, 3]);\nconst buf3 = Buffer.from('hello', 'utf-8');\n\nbuf3.toString('utf-8');                       // 'hello'\nbuf3.toString('hex');                         // '68656c6c6f' (hex encoding)\nBuffer.concat([buf1, buf2, buf3]);             // concatenate\n\n// TRANSFORM STREAM: modify data as it passes through (.pipe() chain)\nconst { Transform } = require('stream');\n\nconst uppercase = new Transform({\n  transform(chunk, encoding, callback) {\n    this.push(chunk.toString().toUpperCase());\n    callback();  // signal this chunk is done\n  },\n});\n\nconst { createReadStream, createWriteStream } = require('fs');\ncreateReadStream('input.txt')\n  .pipe(uppercase)\n  .pipe(createWriteStream('output.txt'));\n\n// BACKPRESSURE explained:\n// If writable can't keep up with readable, writable's buffer fills\n// write() returns false → readable should pause\n// When writable drains, it emits 'drain' → resume reading\n\nconst readable2 = createReadStream('large.bin');\nconst writable2 = createWriteStream('copy.bin');\n\nth.readable.on('data', (chunk) => {\n  const shouldContinue = writable2.write(chunk);  // write returns false if buffer full\n  if (!shouldContinue) {\n    readable2.pause();  // apply backpressure\n  }\n});\n\nwritable2.on('drain', () => {\n  readable2.resume();  // buffer cleared, resume reading\n});\n\n// .pipe() handles this automatically + proper error propagation\ncreateReadStream('large.bin').pipe(createWriteStream('copy.bin'));
