/**
 * QUESTION: Implement memoization from scratch
 *
 * Memoize caches the result of a function call so that
 * subsequent calls with the same arguments return the cached result
 * instead of recomputing.
 *
 * Key concept: trade memory for speed (space-time tradeoff)
 */

// ─────────────────────────────────────────────
// APPROACH 1: Basic memoize (single argument)
// ─────────────────────────────────────────────
function memoize(fn) {
  const cache = new Map();

  return function (arg) {
    if (cache.has(arg)) {
      console.log(`Cache hit for: ${arg}`);
      return cache.get(arg);
    }
    const result = fn.call(this, arg);
    cache.set(arg, result);
    return result;
  };
}

// ─────────────────────────────────────────────
// APPROACH 2: Memoize with multiple arguments
// Serialize args as a cache key
// ─────────────────────────────────────────────
function memoizeMultiArg(fn) {
  const cache = new Map();

  return function (...args) {
    const key = JSON.stringify(args); // works for primitives & plain objects
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

// ─────────────────────────────────────────────
// APPROACH 3: Memoize with custom resolver (like lodash)
// ─────────────────────────────────────────────
function memoizeWithResolver(fn, resolver) {
  const cache = new Map();

  function memoized(...args) {
    const key = resolver ? resolver(...args) : args[0];
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  }

  memoized.cache = cache; // expose cache for clearing
  return memoized;
}

// ─────────────────────────────────────────────
// CLASSIC EXAMPLE: Memoized Fibonacci
// Without memo: O(2^n)  With memo: O(n)
// ─────────────────────────────────────────────
function makeFibMemoized() {
  const cache = {};

  function fib(n) {
    if (n <= 1) return n;
    if (cache[n] !== undefined) return cache[n];
    cache[n] = fib(n - 1) + fib(n - 2);
    return cache[n];
  }

  return fib;
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const slowSquare = (n) => {
  // simulate expensive computation
  return n * n;
};

const fastSquare = memoize(slowSquare);
console.log(fastSquare(5));  // computed: 25
console.log(fastSquare(5));  // Cache hit: 25
console.log(fastSquare(10)); // computed: 100

const add = memoizeMultiArg((a, b) => a + b);
console.log(add(2, 3)); // 5
console.log(add(2, 3)); // cached: 5
console.log(add(1, 4)); // 5 (new computation)

const fib = makeFibMemoized();
console.log(fib(10)); // 55
console.log(fib(50)); // 12586269025 (fast with memo)
