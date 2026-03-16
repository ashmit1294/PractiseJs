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
// WHAT: How to cache function results to avoid recomputation?
// THEORY: Use Map to store arg → result. First call computes + stores. Next calls return cached.
// Time: O(1) lookup  Space: O(n) for cache
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
// WHAT: How to memoize functions with multiple arguments?
// THEORY: JSON.stringify(args) creates cache key. Each unique args has own cached result.
// Time: O(1) lookup, O(k) stringify  Space: O(n*m) for cache
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
// WHAT: How to use custom logic to generate cache keys?
// THEORY: resolver function generates key. Flexible key generation. Expose cache property for clearing.
// Time: O(1) to O(custom)  Space: O(n) for cache
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
// WHAT: Why is memoization powerful for recursive problems?
// THEORY: Without memo: O(2^n) recomputes. With memo: O(n) each n computed once.
// Time: O(n) with memo vs O(2^n) naive  Space: O(n) for memo cache
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
