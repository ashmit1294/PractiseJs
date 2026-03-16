/**
 * QUESTION: Implement debounce function from scratch
 *
 * Debounce delays the execution of a function until after
 * `wait` milliseconds have elapsed since the last invocation.
 * Useful for: search inputs, resize handlers, button clicks.
 *
 * debounce(fn, 300) — fn fires only 300ms after the LAST call
 */

// ─────────────────────────────────────────────
// APPROACH 1: Basic debounce
// WHAT: How to delay function execution until wait time elapses?
// THEORY: Store timer reference. Each call → clear old timer + set new one. Only last call executes.
//         Essential for search inputs, resize handlers (prevent rapid successive calls).
// ─────────────────────────────────────────────
function debounce(fn, wait) {
  let timer = null;

  return function (...args) {
    clearTimeout(timer); // cancel any pending execution
    timer = setTimeout(() => {
      fn.apply(this, args); // execute with correct context
    }, wait);
  };
}

// ─────────────────────────────────────────────
// APPROACH 2: Debounce with leading edge option
// WHAT: How to execute function immediately on first call, then debounce subsequent calls?
// THEORY: Check if leading=true AND no timer running → execute immediately. Always set new timer.
//         Trailing edge (default) fires after wait. Leading edge fires before wait.
// ─────────────────────────────────────────────
function debounceAdvanced(fn, wait, { leading = false } = {}) {
  let timer = null;

  return function (...args) {
    const callNow = leading && !timer;

    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!leading) fn.apply(this, args);
    }, wait);

    if (callNow) fn.apply(this, args);
  };
}

// ─────────────────────────────────────────────
// APPROACH 3: Debounce with cancel and flush
// WHAT: How to provide control to manually cancel or force-execute pending function?
// THEORY: Attach .cancel() to clear timer. Attach .flush() to execute immediately.
//         Useful when debounced function must be called before unmounting or form submission.
// ─────────────────────────────────────────────
function debounceWithControl(fn, wait) {
  let timer = null;
  let lastArgs = null;

  function debounced(...args) {
    lastArgs = args;
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, lastArgs);
      timer = null;
    }, wait);
  }

  debounced.cancel = function () {
    clearTimeout(timer);
    timer = null;
  };

  debounced.flush = function () {
    if (timer) {
      clearTimeout(timer);
      fn.apply(this, lastArgs);
      timer = null;
    }
  };

  return debounced;
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const log = (msg) => console.log(`[${Date.now()}] ${msg}`);

const debouncedLog = debounce(log, 300);

// Only the LAST call fires (after 300ms idle)
debouncedLog("call 1");
debouncedLog("call 2");
debouncedLog("call 3"); // ← this one fires

// After 400ms: "[timestamp] call 3"

const controlled = debounceWithControl((x) => console.log("Value:", x), 500);
controlled("typing...");
controlled("still typing...");
controlled.cancel(); // prevent execution entirely

console.log("Debounce functions defined. Run in browser to see async output.");
