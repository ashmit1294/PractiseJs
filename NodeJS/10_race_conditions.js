/**
 * RACE CONDITIONS IN NODE.JS — WHAT THEY ARE AND HOW TO AVOID THEM
 *
 * A race condition happens when the outcome of your code depends on
 * the ORDER in which asynchronous operations complete — and that order
 * is unpredictable. They are silent bugs: the code looks correct but
 * misbehaves under concurrent load.
 *
 * Topics covered:
 * 1. Classic async race (stale data overwrite)
 * 2. Database race conditions (check-then-act)
 * 3. File system races
 * 4. Mutex (Mutual Exclusion Lock)
 * 5. Atomic DB operations
 * 6. Redis distributed lock
 * 7. Queue-based serialisation
 * 8. Promise.all vs sequential (deliberate vs accidental concurrency)
 * 9. Event Emitter race
 * 10. Interview Questions
 */

'use strict';

const fs = require('fs/promises');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

// ─────────────────────────────────────────────────────────────────────────────
// Q1. CLASSIC ASYNC RACE — STALE DATA OVERWRITE
// WHAT: How can race conditions occur when two concurrent requests read-modify-write shared state?
// THEORY: Request A reads value, B reads same value before A writes. Both write independently, one overwrites. Happens with async DB/file ops. Mutex locks prevent interleaving
// Time: O(1) per op  Space: O(1)
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: Two simultaneous requests both read the counter, both increment,
//         both write back. One write silently overwrites the other.
//
// Timeline (2 concurrent callers):
//   Caller A reads count = 5
//   Caller B reads count = 5  ← reads BEFORE A has written
//   Caller A writes count = 6
//   Caller B writes count = 6  ← should be 7, but overwrites A's result!
//
// Result: counter is 6 instead of 7. One increment is lost.

let counter = 0; // in-memory shared state

async function incrementCounterBAD() {
  const current = counter;                    // read
  await new Promise(r => setTimeout(r, 10)); // simulate async work (e.g. DB read)
  counter = current + 1;                     // write — RACE: current is now stale!
}

// ─────────────────────────────────────────────────────────────────────────────
// Q2. FIX — MUTEX (Mutual Exclusion Lock)
// WHAT: How does a Mutex lock prevent concurrent access to critical sections?
// THEORY: _locked flag + _queue of waiting callers. acquire() returns Promise when lock available. _release() marks unlocked, resolves next waiter. FIFO queue ordering prevents races
// Time: O(1) acquire  Space: O(w) waiters in queue
// ─────────────────────────────────────────────────────────────────────────────

// A mutex ensures only ONE piece of code runs a critical section at a time.
// Others wait in a queue until the lock is released.

class Mutex {
  constructor() {
    // _queue holds resolve functions of waiting callers.
    // When the lock is released, the next waiter's Promise resolves.
    this._queue = [];
    this._locked = false;
  }

  /**
   * Acquire the lock. Returns a Promise that resolves with a release function.
   * Always call release() in a finally block to avoid deadlocks.
   */
  acquire() {
    return new Promise(resolve => {
      if (!this._locked) {
        // No one holds the lock — take it immediately
        this._locked = true;
        resolve(() => this._release()); // give caller a release function
      } else {
        // Lock is held — queue this caller
        this._queue.push(resolve);
      }
    });
  }

  _release() {
    if (this._queue.length > 0) {
      // Hand the lock to the next waiter in the queue (FIFO order)
      const next = this._queue.shift();
      next(() => this._release());
    } else {
      // No one waiting — unlock
      this._locked = false;
    }
  }
}

const mutex = new Mutex();

async function incrementCounterSafe() {
  const release = await mutex.acquire(); // blocks until previous caller finishes
  try {
    const current = counter;
    await new Promise(r => setTimeout(r, 10)); // simulate async work
    counter = current + 1;                     // safe: no other caller can interfere
  } finally {
    release(); // ALWAYS release in finally so the lock is freed even on error
  }
}

// Demo function
async function demoMutex() {
  counter = 0;
  // Fire 5 increments concurrently — with mutex, all 5 are serialised
  await Promise.all([
    incrementCounterSafe(),
    incrementCounterSafe(),
    incrementCounterSafe(),
    incrementCounterSafe(),
    incrementCounterSafe(),
  ]);
  console.log('Count with mutex:', counter); // always 5 ✅
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DATABASE RACE — CHECK-THEN-ACT (TOCTOU)
// "Time of Check vs Time of Use"
// Two requests check a condition at the same time, then both act on it.
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: Two users simultaneously try to register the same username.
//         Both SELECT and find 0 rows, both INSERT — duplicate user created!

async function registerUserBAD(db, username, email) {
  // Step 1: Check if username is free
  const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);

  // ← HERE: another request sneaks in and passes the same check before we INSERT

  if (existing.rows.length > 0) {
    throw new Error('Username already taken');
  }

  // Step 2: Insert — but another caller may have just inserted the same username!
  await db.query('INSERT INTO users (username, email) VALUES ($1, $2)', [username, email]);
}

// ✅ FIX 1: Database-level unique constraint (always do this as a baseline)
// CREATE UNIQUE INDEX CONCURRENTLY on users(username);
// The DB will reject the second INSERT with a constraint error — catch and handle it:

async function registerUserWithUniqueConstraint(db, username, email) {
  try {
    await db.query(
      'INSERT INTO users (username, email) VALUES ($1, $2)',
      [username, email],
    );
  } catch (err) {
    // PostgreSQL error code 23505 = unique_violation
    if (err.code === '23505') throw new Error('Username already taken');
    throw err;
  }
}

// ✅ FIX 2: INSERT ... ON CONFLICT (upsert / atomic check-and-insert)
// A single atomic statement: insert only if username doesn't exist
async function registerUserAtomic(db, username, email) {
  const result = await db.query(
    `INSERT INTO users (username, email) VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING
     RETURNING id`,
    [username, email],
  );

  // If INSERT was blocked by conflict, RETURNING returns 0 rows
  if (result.rowCount === 0) throw new Error('Username already taken');
  return result.rows[0].id;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. INVENTORY / BALANCE CHECK RACE (SELECT FOR UPDATE)
// Classic e-commerce race: two orders placed simultaneously for the last item.
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: Both orders read stock = 1, both pass the check, both decrement
async function placeOrderBAD(db, productId, qty) {
  const { rows } = await db.query('SELECT stock FROM products WHERE id = $1', [productId]);
  const stock = rows[0].stock;

  // Another request reads stock=1 HERE before we UPDATE below
  if (stock < qty) throw new Error('Out of stock');

  await db.query('UPDATE products SET stock = stock - $2 WHERE id = $1', [productId, qty]);
}

// ✅ GOOD: SELECT FOR UPDATE locks the row in a transaction.
// The second caller WAITS at the SELECT until the first transaction commits/rollbacks.
async function placeOrderSafe(db, productId, qty) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // FOR UPDATE acquires a row-level lock — no other transaction can touch this row
    const { rows } = await client.query(
      'SELECT stock FROM products WHERE id = $1 FOR UPDATE',
      [productId],
    );

    const stock = rows[0].stock;

    if (stock < qty) {
      await client.query('ROLLBACK');
      throw new Error('Out of stock');
    }

    await client.query(
      'UPDATE products SET stock = stock - $2 WHERE id = $1',
      [productId, qty],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // always release connection back to pool
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. REDIS DISTRIBUTED LOCK (cross-process / cross-server)
// In-process Mutex only works within one Node.js process.
// For multiple servers (horizontal scaling), use a distributed lock in Redis.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Acquires a Redis-based distributed lock using SET NX EX (atomic).
 *
 * NX = Set only if Not eXists (prevents two callers from acquiring simultaneously)
 * EX = Expiry in seconds (prevents deadlock if the holder crashes)
 *
 * Uses a random token so only the lock owner can release it
 * (prevents accidentally releasing a lock acquired by another process after expiry).
 */
async function withRedisLock(redis, key, ttlSeconds, fn) {
  const token = Math.random().toString(36).substring(2); // unique owner token
  const lockKey = `lock:${key}`;

  // SET lock:key <token> NX EX <ttl>  — atomic: succeeds only if key doesn't exist
  const acquired = await redis.set(lockKey, token, 'NX', 'EX', ttlSeconds);

  if (!acquired) {
    throw new Error(`Could not acquire lock for ${key} — resource is busy`);
  }

  try {
    return await fn(); // run the critical section
  } finally {
    // Lua script: check token AND delete in one atomic operation
    // Without this, another process could acquire the lock between our GET and DEL
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await redis.eval(luaScript, 1, lockKey, token);
  }
}

// Usage example:
// await withRedisLock(redis, `product:${productId}`, 5, async () => {
//   await placeOrderBAD(db, productId, qty); // now safe across all servers
// });

// ─────────────────────────────────────────────────────────────────────────────
// 6. FILE SYSTEM RACE — CHECK THEN CREATE
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: check if file exists, then create — another process can create it
//         in the gap between the check and the create.
async function createFileBAD(filePath, content) {
  try {
    await fs.access(filePath); // check if file exists
    throw new Error('File already exists');
  } catch (accessErr) {
    if (accessErr.code !== 'ENOENT') throw accessErr; // re-throw non-"not found" errors
    await fs.writeFile(filePath, content);             // RACE: another process may create here
  }
}

// ✅ GOOD: Use the 'wx' flag — open for writing only if file doesn't exist.
// This is an ATOMIC operation at the OS level — no race possible.
async function createFileSafe(filePath, content) {
  try {
    // 'wx' = write + exclusive (fail if file exists)
    await fs.writeFile(filePath, content, { flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') throw new Error('File already exists');
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. PROMISE.ALL RACE — WHEN CONCURRENT IS WRONG
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: Promise.all runs both operations in parallel.
//         debitAccount runs at the same time as creditAccount.
//         If debit succeeds but credit fails: money is lost with no compensation.
async function transferMoneyBAD(db, fromId, toId, amount) {
  await Promise.all([
    db.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]),
    db.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]),
  ]);
}

// ✅ GOOD: Sequential inside a transaction.
//          If credit fails, the entire transaction rolls back — atomic transfer.
async function transferMoneySafe(db, fromId, toId, amount) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Debit first, credit second — sequentially within a transaction
    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [amount, fromId],
    );
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [amount, toId],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK'); // debit is reversed if credit fails
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. SERIAL QUEUE — SERIALISE ASYNC OPERATIONS WITHOUT A MUTEX
// Useful when you have a stream of independent tasks but want them
// processed one-at-a-time (e.g. writing to a file, sending to a serial port).
// ─────────────────────────────────────────────────────────────────────────────

class SerialQueue {
  constructor() {
    // _promise tracks the "last task in line".
    // Each new task chains onto the end of the previous one.
    this._promise = Promise.resolve();
  }

  /**
   * Enqueues a task. The task is an async function that returns a Promise.
   * Returns a Promise that resolves with the task's result.
   */
  enqueue(task) {
    // Chain onto the running queue.
    // Even if a task throws, the queue continues (catch swallows internal errors).
    const result = this._promise.then(() => task());
    // Update the tail to be a version that never rejects (so the queue keeps going)
    this._promise = result.catch(() => {});
    return result; // returned Promise CAN reject — the caller handles their own error
  }
}

// Usage: safe sequential file writes without mutex boilerplate
const queue = new SerialQueue();

async function safeFileWrite(filePath, data) {
  return queue.enqueue(() => fs.writeFile(filePath, data, { flag: 'a' }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. RACE IN EVENT EMITTER — LISTENER ADDED TOO LATE
// ─────────────────────────────────────────────────────────────────────────────
const { EventEmitter } = require('events');

// ❌ BAD: 'data' event emitted synchronously in constructor BEFORE the caller
//         has a chance to attach a listener.
class DataFetcherBAD extends EventEmitter {
  constructor(url) {
    super();
    // This runs synchronously — any 'data' listener attached after
    // new DataFetcherBAD() will miss this event entirely.
    this.emit('data', { url, payload: [] });
  }
}

// const f = new DataFetcherBAD('/api');
// f.on('data', console.log); // ← MISSED — event was emitted in constructor

// ✅ GOOD: Defer the emit with setImmediate / process.nextTick so the caller
//          can attach listeners in the same synchronous execution frame.
class DataFetcherGood extends EventEmitter {
  constructor(url) {
    super();
    // setImmediate defers to the next iteration of the event loop,
    // giving the caller time to attach listeners after the constructor returns.
    setImmediate(() => {
      this.emit('data', { url, payload: [] });
    });
  }
}

// const f = new DataFetcherGood('/api');
// f.on('data', console.log); // ✅ attached before setImmediate fires

// ─────────────────────────────────────────────────────────────────────────────
// 10. USEEFFECT CLEANUP — RACE IN (FRONTEND / SSR CONTEXT)
// When using Node.js with React SSR, the same pattern causes stale responses.
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: A user types fast. Three fetches fire. The first one might respond
//         LAST due to network delays, overwriting the correct third result.
//
// In Node.js SSR or streaming: you cancel the earlier request.
// Use AbortController:

async function fetchUserSafe(userId) {
  const controller = new AbortController();
  const { signal } = controller;

  // Caller can call controller.abort() to cancel this request
  // (e.g., when a newer request fires)
  const res = await fetch(`https://api.example.com/users/${userId}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();

  // How to cancel from outside:
  // const controller = new AbortController();
  // const promise = fetchUserSafe('123');
  // controller.abort(); // cancels the in-flight request
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. SUMMARY: WHICH TOOL FOR WHICH RACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Problem                               | Solution
 * --------------------------------------|------------------------------------
 * In-memory shared state (1 process)    | Mutex class
 * DB: duplicate insert                  | UNIQUE constraint + ON CONFLICT
 * DB: stale read-then-write             | SELECT FOR UPDATE inside transaction
 * Money / account transfers             | DB transaction (BEGIN/COMMIT)
 * Multi-server shared resource          | Redis distributed lock (SET NX EX)
 * File system check-then-create         | 'wx' flag (atomic exclusive create)
 * Sequential task queue                 | SerialQueue / p-queue library
 * Event emitter emits before listener   | defer with setImmediate / nextTick
 * HTTP requests (stale response)        | AbortController + cancel on new request
 * Concurrent promises need ordering     | Sequential await, not Promise.all
 */

// ─────────────────────────────────────────────────────────────────────────────
// INTERVIEW QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

/*
Q: What is a race condition?
A: When two or more operations run concurrently, and the final outcome depends on
   which finishes first. The code looks fine in isolation but behaves incorrectly
   when two requests hit it at the same time.

Q: Is Node.js single-threaded? Can it have race conditions?
A: Node.js has one JavaScript thread — there is no true parallelism in JS code.
   BUT race conditions still happen because async operations (DB queries, file reads,
   HTTP calls) are non-blocking. Two requests are interleaved in the event loop:
   A reads → B reads → A writes → B writes (B's write clobbers A's).

Q: What is a mutex and when do you need one?
A: Mutex (Mutual Exclusion Lock) ensures only one async caller can run a critical
   section at a time. Needed when you have shared in-memory state that must be
   read-then-modified atomically. Example: an in-memory cache that is read and
   written by concurrent request handlers.

Q: What is SELECT FOR UPDATE in PostgreSQL?
A: It acquires a row-level exclusive lock when reading a row, so no other transaction
   can read (with FOR UPDATE) or modify that row until the lock is released. Use it
   when you need to read a value and then update it based on that value — prevents
   the check-then-act race.

Q: What is the difference between ON CONFLICT DO NOTHING and ON CONFLICT DO UPDATE?
A: ON CONFLICT DO NOTHING: if the insert violates a unique constraint, silently skip it.
   ON CONFLICT DO UPDATE (upsert): if conflict, update the existing row instead.
   Both are atomic — no gap between check and insert.

Q: Why can't you use an in-process Mutex across multiple servers?
A: A Mutex lives in one process's memory. On two different servers, each has its own
   Mutex that knows nothing of the other. Both can acquire "their" mutex simultaneously.
   For multi-server scenarios, use a Redis distributed lock (SET NX EX).

Q: What is the 'wx' file flag and why is it safer than checking then writing?
A: 'wx' opens for writing exclusively — if the file already exists, it throws EEXIST.
   This is atomic at the OS level. The check-and-create is ONE system call, not two.
   There is no gap for another process to create the file between your check and write.

Q: When should operations be sequential (await A; await B) vs parallel (Promise.all)?
A: Use sequential when:
   - Operation B depends on the result of A
   - Both modify shared state and ordering matters (e.g., debit then credit)
   - You want atomic behaviour wrapped in a DB transaction
   Use Promise.all when:
   - Operations are truly independent (load user + load products simultaneously)
   - Neither operation modifies state that the other reads/writes
   - Parallel execution genuinely speeds things up

Q: What is the TOCTOU vulnerability?
A: Time Of Check To Time Of Use. Between checking a condition (file exists? user taken?)
   and acting on it (create the file? insert user?), another process changes the state.
   Fix: collapse check-and-act into a single atomic operation (UNIQUE constraint,
   wx flag, SELECT FOR UPDATE).

Q: How does AbortController help with race conditions in fetch calls?
A: When a new fetch fires (e.g., user types again), you call controller.abort() on the
   previous request. The old fetch throws an AbortError — you ignore it. Only the
   latest response is processed, preventing stale/out-of-order responses.
*/

module.exports = {
  Mutex,
  SerialQueue,
  withRedisLock,
  createFileSafe,
  registerUserAtomic,
  placeOrderSafe,
  transferMoneySafe,
};
