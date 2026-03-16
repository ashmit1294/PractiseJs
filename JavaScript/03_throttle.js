/**
 * QUESTION: Implement throttle function from scratch
 *
 * Throttle limits a function to fire at most once every `wait` ms,
 * no matter how many times it's called.
 * Useful for: scroll handlers, window resize, mouse move.
 *
 * Difference from debounce:
 *   debounce  → fires AFTER silence period
 *   throttle  → fires at REGULAR intervals during activity
 */

// ─────────────────────────────────────────────
// APPROACH 1: Throttle using timestamps (leading edge)
// WHAT: How to limit function execution to once per wait interval using timestamps?
// THEORY: Track lastTime. If now - lastTime >= wait → execute. Leading edge fires immediately.
// Time: O(1) per call  Space: O(1)
// ─────────────────────────────────────────────
function throttle(fn, wait) {
  let lastTime = 0;

  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= wait) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

// ─────────────────────────────────────────────
// APPROACH 2: Throttle using setTimeout (trailing edge)
// WHAT: How to throttle with a trailing call after wait period?
// THEORY: If no pending timer → set timer for wait. Trailing edge only. Next call won't execute if timer pending.
// Time: O(1) per call  Space: O(1)
// ─────────────────────────────────────────────
function throttleTrailing(fn, wait) {
  let timer = null;

  return function (...args) {
    if (!timer) {
      timer = setTimeout(() => {
        fn.apply(this, args);
        timer = null;
      }, wait);
    }
  };
}

// ─────────────────────────────────────────────
// APPROACH 3: Throttle with both leading AND trailing call
// ─────────────────────────────────────────────
function throttleAdvanced(fn, wait, { leading = true, trailing = true } = {}) {
  let timer = null;
  let lastTime = 0;
  let lastArgs = null;

  return function (...args) {
    const now = Date.now();
    lastArgs = args;

    if (!lastTime && !leading) lastTime = now;

    const remaining = wait - (now - lastTime);

    if (remaining <= 0 || remaining > wait) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastTime = now;
      fn.apply(this, lastArgs);
    } else if (!timer && trailing) {
      timer = setTimeout(() => {
        lastTime = leading ? Date.now() : 0;
        timer = null;
        fn.apply(this, lastArgs);
      }, remaining);
    }
  };
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const throttled = throttle((x) => console.log("Throttled:", x, "at", Date.now()), 1000);

// Simulating rapid calls — only fires once per second
throttled("a"); // fires immediately
throttled("b"); // ignored (< 1 sec later)
throttled("c"); // ignored

// Real usage:
// window.addEventListener('scroll', throttle(handleScroll, 200));

console.log("Throttle functions defined. Run in browser to see async output.");
