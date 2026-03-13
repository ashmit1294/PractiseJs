/**
 * QUESTION: Implement Promise.all, Promise.race, Promise.allSettled,
 *           and Promise.any from scratch
 *
 * These are extremely common interview questions testing your
 * understanding of how Promises work internally.
 */

// ─────────────────────────────────────────────
// 1. Promise.all
// Resolves when ALL promises resolve.
// Rejects immediately if ANY promise rejects.
// ─────────────────────────────────────────────
function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    if (!promises.length) return resolve([]);

    const results = new Array(promises.length);
    let resolved = 0;

    promises.forEach((p, i) => {
      Promise.resolve(p).then((val) => {
        results[i] = val;
        resolved++;
        if (resolved === promises.length) resolve(results);
      }).catch(reject); // any rejection short-circuits
    });
  });
}

// ─────────────────────────────────────────────
// 2. Promise.race
// Resolves/rejects with the FIRST settled promise.
// ─────────────────────────────────────────────
function promiseRace(promises) {
  return new Promise((resolve, reject) => {
    promises.forEach((p) => {
      Promise.resolve(p).then(resolve).catch(reject);
    });
  });
}

// ─────────────────────────────────────────────
// 3. Promise.allSettled
// Waits for ALL promises to settle (resolve or reject).
// Never rejects. Returns array of {status, value/reason}.
// ─────────────────────────────────────────────
function promiseAllSettled(promises) {
  return new Promise((resolve) => {
    if (!promises.length) return resolve([]);

    const results = new Array(promises.length);
    let settled = 0;

    promises.forEach((p, i) => {
      Promise.resolve(p)
        .then((value) => {
          results[i] = { status: "fulfilled", value };
        })
        .catch((reason) => {
          results[i] = { status: "rejected", reason };
        })
        .finally(() => {
          settled++;
          if (settled === promises.length) resolve(results);
        });
    });
  });
}

// ─────────────────────────────────────────────
// 4. Promise.any
// Resolves with the FIRST fulfilled promise.
// Rejects only if ALL promises reject (AggregateError).
// ─────────────────────────────────────────────
function promiseAny(promises) {
  return new Promise((resolve, reject) => {
    if (!promises.length) return reject(new AggregateError([], "All promises were rejected"));

    const errors = new Array(promises.length);
    let rejectedCount = 0;

    promises.forEach((p, i) => {
      Promise.resolve(p)
        .then(resolve) // first fulfillment wins
        .catch((err) => {
          errors[i] = err;
          rejectedCount++;
          if (rejectedCount === promises.length) {
            reject(new AggregateError(errors, "All promises were rejected"));
          }
        });
    });
  });
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const p1 = Promise.resolve(1);
const p2 = Promise.resolve(2);
const p3 = Promise.resolve(3);
const pFail = Promise.reject("OOPS");

// Promise.all — all resolve
promiseAll([p1, p2, p3]).then(console.log); // [1, 2, 3]

// Promise.all — one rejects
promiseAll([p1, pFail, p3]).catch(console.log); // "OOPS"

// Promise.race — first to settle wins
const slow = new Promise((res) => setTimeout(() => res("slow"), 500));
const fast = new Promise((res) => setTimeout(() => res("fast"), 100));
promiseRace([slow, fast]).then(console.log); // "fast"

// Promise.allSettled — mixed
promiseAllSettled([p1, pFail, p3]).then(console.log);
// [{status:'fulfilled',value:1}, {status:'rejected',reason:'OOPS'}, {status:'fulfilled',value:3}]

// Promise.any — first success
const fail1 = Promise.reject("err1");
const fail2 = Promise.reject("err2");
const ok = Promise.resolve("success");
promiseAny([fail1, fail2, ok]).then(console.log);   // "success"
promiseAny([fail1, fail2]).catch((e) => console.log(e.message)); // All promises were rejected
