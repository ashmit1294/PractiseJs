# JavaScript (DSA + Patterns) — Interview Revision Summary

> **Target:** 7+ year Full Stack MERN Developer | **Files:** 26
> **Status:** ✅ All 26 files enriched with WHAT/THEORY format & Complexity Analysis

## Table of Contents

1. [01_flatten_array.js — QUESTION: Flatten a nested array without using .flat() or .flatMap()](#javascript-flatten-array) ✅ ENRICHED
2. [02_debounce.js — QUESTION: Implement debounce function from scratch](#javascript-debounce) ✅ ENRICHED
3. [03_throttle.js — QUESTION: Implement throttle function from scratch](#javascript-throttle) ✅ ENRICHED
4. [04_memoize.js — QUESTION: Implement memoization from scratch](#javascript-memoize) ✅ ENRICHED
5. [05_curry.js — QUESTION: Implement currying from scratch](#javascript-curry) ✅ ENRICHED
6. [06_deep_clone.js — QUESTION: Deep clone an object without JSON.parse/JSON.stringify](#javascript-deep-clone) ✅ ENRICHED
7. [07_promise_all_race.js — QUESTION: Implement Promise.all, Promise.race, Promise.allSettled,](#javascript-promise-all-race) ✅ ENRICHED
8. [08_custom_array_methods.js — QUESTION: Implement Array.prototype.map, filter, reduce, forEach,](#javascript-custom-array-methods) ✅ ENRICHED
9. [09_map_questions.js — QUESTION SET: Map — all common interview questions](#javascript-map-questions) ✅ ENRICHED
10. [10_set_questions.js — QUESTION SET: Set — all common interview questions](#javascript-set-questions) ✅ ENRICHED
11. [11_stack_queue.js — QUESTION SET: Stack and Queue](#javascript-stack-queue) ✅ ENRICHED
12. [12_linked_list.js — QUESTION SET: Linked List — all common interview questions](#javascript-linked-list) ✅ ENRICHED
13. [13_binary_tree_bst.js — QUESTION SET: Binary Tree & Binary Search Tree (BST)](#javascript-binary-tree-bst) ✅ ENRICHED
14. [14_call_apply_bind.js — QUESTION SET: call, apply, bind — Custom Implementations](#javascript-call-apply-bind) ✅ ENRICHED
15. [15_searching_algorithms.js — QUESTION SET: Searching Algorithms](#javascript-searching-algorithms) ✅ ENRICHED
16. [16_sorting_algorithms.js — QUESTION SET: Sorting Algorithms](#javascript-sorting-algorithms) ✅ ENRICHED
17. [17_recursion_backtracking.js — QUESTION SET: Recursion Patterns](#javascript-recursion-backtracking) ✅ ENRICHED
18. [18_dynamic_programming.js — QUESTION SET: Dynamic Programming (DP)](#javascript-dynamic-programming) ✅ ENRICHED
19. [19_graph_algorithms.js — QUESTION SET: Graph Algorithms](#javascript-graph-algorithms) ✅ ENRICHED
20. [20_sliding_window_two_pointer.js — QUESTION SET: Sliding Window & Two Pointer Patterns](#javascript-sliding-window-two-pointer) ✅ ENRICHED
21. [21_functional_programming.js — QUESTION SET: Functional Programming Patterns](#javascript-functional-programming) ✅ ENRICHED
22. [22_array_manipulation.js — QUESTION SET: Array Manipulation — Chunk, Unique, Intersection,](#javascript-array-manipulation) ✅ ENRICHED
23. [23_string_questions.js — QUESTION SET: String Manipulation](#javascript-string-questions) ✅ ENRICHED
24. [24_weakmap_weakset_symbol_proxy.js — QUESTION SET: WeakMap, WeakSet, Symbol, Proxy, Reflect](#javascript-weakmap-weakset-symbol-proxy) ✅ ENRICHED
25. [25_heap_priority_queue.js — QUESTION SET: Heap / Priority Queue](#javascript-heap-priority-queue) ✅ ENRICHED
26. [FILE: 26_theory_interview_qa.js](#javascript-theory-interview-qa) ✅ ENRICHED
   27. [27_groupby_aggregate.js — QUESTION SET: GroupBy, Aggregate, and Object Transformation](#javascript-groupby-aggregate)
   28. [28_array_advanced.js — QUESTION SET: Advanced Array Patterns](#javascript-array-advanced)
   29. [29_promise_patterns.js — QUESTION SET: Advanced Promise and Async Patterns](#javascript-promise-patterns)
   30. [30_design_patterns.js — QUESTION SET: Design Patterns in JavaScript](#javascript-design-patterns)
   - [Scenario-Based Questions](#javascript-scenarios)

---

<a id="javascript-flatten-array"></a>
## 01_flatten_array.js — QUESTION: Flatten a nested array without using .flat() or .flatMap()

```javascript
/**
 * QUESTION: Flatten a nested array without using .flat() or .flatMap()
 *
 * Examples:
 *   flatten([1, [2, 3], [4, [5, 6]]]) => [1, 2, 3, 4, 5, 6]
 *   flatten([1, [2, [3, [4, [5]]]]]) => [1, 2, 3, 4, 5]
 *   flattenToDepth([1, [2, [3, [4]]]], 2) => [1, 2, 3, [4]]
 */

// ─────────────────────────────────────────────
// APPROACH 1: Recursion
// Time: O(n)  Space: O(n)
// ─────────────────────────────────────────────
function flattenRecursive(arr) {
  let result = [];
  for (let i = 0; i < arr.length; i++) {
    if (Array.isArray(arr[i])) {
      result = result.concat(flattenRecursive(arr[i]));
    } else {
      result.push(arr[i]);
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// APPROACH 2: Using reduce + recursion (elegant)
// ─────────────────────────────────────────────
function flattenReduce(arr) {
  return arr.reduce((acc, val) => {
    return Array.isArray(val)
      ? acc.concat(flattenReduce(val))
      : acc.concat(val);
  }, []);
}

// ─────────────────────────────────────────────
// APPROACH 3: Iterative with a stack (no recursion)
// ─────────────────────────────────────────────
function flattenIterative(arr) {
  const stack = [...arr];
  const result = [];

  while (stack.length) {
    const item = stack.pop();
    if (Array.isArray(item)) {
      stack.push(...item); // push children back onto stack
    } else {
      result.unshift(item); // maintain order by prepending
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// APPROACH 4: Flatten up to a specific depth
// ─────────────────────────────────────────────
function flattenToDepth(arr, depth = 1) {
  if (depth === 0) return arr.slice();
  return arr.reduce((acc, val) => {
    if (Array.isArray(val) && depth > 0) {
      acc.push(...flattenToDepth(val, depth - 1));
    } else {
      acc.push(val);
    }
    return acc;
  }, []);
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const input1 = [1, [2, 3], [4, [5, 6]]];
const input2 = [1, [2, [3, [4, [5]]]]];

console.log("Recursive:  ", flattenRecursive(input1)); // [1,2,3,4,5,6]
console.log("Reduce:     ", flattenReduce(input2));    // [1,2,3,4,5]
console.log("Iterative:  ", flattenIterative(input1)); // [1,2,3,4,5,6]
console.log("Depth 2:    ", flattenToDepth([1, [2, [3, [4]]]], 2)); // [1,2,3,[4]]
console.log("Depth 1:    ", flattenToDepth([1, [2, [3]]], 1)); // [1,2,[3]]

---
```

<a id="javascript-debounce"></a>
## 02_debounce.js — QUESTION: Implement debounce function from scratch

```javascript
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
// leading: true  → fires immediately on FIRST call, then waits
// leading: false → fires after the wait period (default)
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

---
```

<a id="javascript-throttle"></a>
## 03_throttle.js — QUESTION: Implement throttle function from scratch

```javascript
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

---
```

<a id="javascript-memoize"></a>
## 04_memoize.js — QUESTION: Implement memoization from scratch

```javascript
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

---
```

<a id="javascript-curry"></a>
## 05_curry.js — QUESTION: Implement currying from scratch

```javascript
/**
 * QUESTION: Implement currying from scratch
 *
 * Currying transforms a function f(a, b, c) into f(a)(b)(c).
 * Each call takes one argument and returns a function that
 * accepts the next, until all arguments are received.
 *
 * curry(add)(1)(2)(3) === add(1, 2, 3)
 */

// ─────────────────────────────────────────────
// APPROACH 1: Basic curry (auto-detects arity via fn.length)
// ─────────────────────────────────────────────
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args); // enough args → call
    }
    return function (...moreArgs) {
      return curried.apply(this, args.concat(moreArgs)); // collect more
    };
  };
}

// ─────────────────────────────────────────────
// APPROACH 2: Partial application (like curry but flexible)
// ─────────────────────────────────────────────
function partial(fn, ...presetArgs) {
  return function (...laterArgs) {
    return fn(...presetArgs, ...laterArgs);
  };
}

// ─────────────────────────────────────────────
// APPROACH 3: Infinite curry — sum(1)(2)(3)()
// Call with no args to get the result
// ─────────────────────────────────────────────
function infiniteCurry(fn) {
  let allArgs = [];

  function curried(...args) {
    if (args.length === 0) {
      return fn(...allArgs); // flush and evaluate
    }
    allArgs = allArgs.concat(args);
    return curried;
  }

  return curried;
}

// ─────────────────────────────────────────────
// APPROACH 4: sum(1)(2)(3) — returns number when called with no args
// Classic interview question variant
// ─────────────────────────────────────────────
function sum(a) {
  return function (b) {
    if (b === undefined) return a;
    return sum(a + b);
  };
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const add = (a, b, c) => a + b + c;
const curriedAdd = curry(add);

console.log(curriedAdd(1)(2)(3));    // 6
console.log(curriedAdd(1, 2)(3));    // 6
console.log(curriedAdd(1)(2, 3));    // 6
console.log(curriedAdd(1, 2, 3));    // 6

const multiply = (a, b) => a * b;
const double = partial(multiply, 2);
const triple = partial(multiply, 3);
console.log(double(5));  // 10
console.log(triple(5));  // 15

// sum(1)(2)(3)() → 6
const addInfinite = infiniteCurry((args) => args.reduce((a, b) => a + b, 0));
// Note: infiniteCurry wraps reduce

// Classic sum pattern
console.log(sum(1)(2)(3)());  // 6
console.log(sum(5)(10)());    // 15

// Real-world usage: config → category → value
const getConfig = curry((env, key, defaultVal) => `${env}:${key}:${defaultVal}`);
const devConfig = getConfig("dev");
const devPort = devConfig("PORT");
console.log(devPort(3000));  // dev:PORT:3000

---
```

<a id="javascript-deep-clone"></a>
## 06_deep_clone.js — QUESTION: Deep clone an object without JSON.parse/JSON.stringify

```javascript
/**
 * QUESTION: Deep clone an object without JSON.parse/JSON.stringify
 *
 * JSON methods fail for:
 *   - undefined values
 *   - functions
 *   - Date objects (becomes string)
 *   - RegExp (becomes {})
 *   - Circular references (throws error)
 *   - Map, Set, Symbol
 *
 * Write a proper deep clone that handles all of these.
 */

// ─────────────────────────────────────────────
// APPROACH 1: Basic recursive deep clone
// Handles: arrays, objects, primitives
// ─────────────────────────────────────────────
function deepCloneBasic(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(deepCloneBasic);

  const cloned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepCloneBasic(obj[key]);
    }
  }
  return cloned;
}

// ─────────────────────────────────────────────
// APPROACH 2: Full deep clone
// Handles: Date, RegExp, Map, Set, circular refs, Symbol keys
// ─────────────────────────────────────────────
function deepClone(obj, visited = new WeakMap()) {
  // Primitives & null
  if (obj === null || typeof obj !== "object") return obj;

  // Handle special built-in types
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags);

  // Handle circular references
  if (visited.has(obj)) return visited.get(obj);

  // Handle Array
  if (Array.isArray(obj)) {
    const clonedArr = [];
    visited.set(obj, clonedArr);
    obj.forEach((item, i) => {
      clonedArr[i] = deepClone(item, visited);
    });
    return clonedArr;
  }

  // Handle Map
  if (obj instanceof Map) {
    const clonedMap = new Map();
    visited.set(obj, clonedMap);
    obj.forEach((val, key) => {
      clonedMap.set(deepClone(key, visited), deepClone(val, visited));
    });
    return clonedMap;
  }

  // Handle Set
  if (obj instanceof Set) {
    const clonedSet = new Set();
    visited.set(obj, clonedSet);
    obj.forEach((val) => {
      clonedSet.add(deepClone(val, visited));
    });
    return clonedSet;
  }

  // Handle plain object
  const cloned = Object.create(Object.getPrototypeOf(obj));
  visited.set(obj, cloned);

  // Copy own enumerable string keys
  for (const key of Object.keys(obj)) {
    cloned[key] = deepClone(obj[key], visited);
  }

  // Copy Symbol keys
  for (const sym of Object.getOwnPropertySymbols(obj)) {
    cloned[sym] = deepClone(obj[sym], visited);
  }

  return cloned;
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const original = {
  name: "Alice",
  age: 30,
  address: { city: "NYC", zip: "10001" },
  hobbies: ["coding", "reading"],
  dob: new Date("1994-01-01"),
  pattern: /hello/gi,
  scores: new Map([["math", 95], ["eng", 88]]),
  tags: new Set(["js", "ts"]),
  greet: function () { return `Hi, I'm ${this.name}`; },
};

// Circular reference test
original.self = original;

const clone = deepClone(original);

clone.address.city = "LA";
clone.hobbies.push("gaming");

console.log("Original city:", original.address.city); // NYC (not mutated)
console.log("Clone city:   ", clone.address.city);    // LA

console.log("Original hobbies:", original.hobbies);   // ['coding','reading']
console.log("Clone hobbies:   ", clone.hobbies);      // ['coding','reading','gaming']

console.log("Date cloned:   ", clone.dob instanceof Date);     // true
console.log("RegExp cloned: ", clone.pattern instanceof RegExp); // true
console.log("Map cloned:    ", clone.scores instanceof Map);   // true
console.log("Set cloned:    ", clone.tags instanceof Set);      // true
console.log("Circular ref:  ", clone.self === clone);           // true (circular preserved)

---
```

<a id="javascript-promise-all-race"></a>
## 07_promise_all_race.js — QUESTION: Implement Promise.all, Promise.race, Promise.allSettled,

```javascript
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

---
```

<a id="javascript-custom-array-methods"></a>
## 08_custom_array_methods.js — QUESTION: Implement Array.prototype.map, filter, reduce, forEach,

```javascript
/**
 * QUESTION: Implement Array.prototype.map, filter, reduce, forEach,
 *           find, findIndex, every, some, flat from scratch
 *
 * Core insight: understand the callback signature and return behavior
 * of each method.
 */

// ─────────────────────────────────────────────
// 1. myMap — transforms each element
// callback(currentValue, index, array)
// ─────────────────────────────────────────────
Array.prototype.myMap = function (callback, thisArg) {
  const result = [];
  for (let i = 0; i < this.length; i++) {
    if (i in this) { // handle sparse arrays
      result[i] = callback.call(thisArg, this[i], i, this);
    }
  }
  return result;
};

// ─────────────────────────────────────────────
// 2. myFilter — keeps elements where callback returns true
// ─────────────────────────────────────────────
Array.prototype.myFilter = function (callback, thisArg) {
  const result = [];
  for (let i = 0; i < this.length; i++) {
    if (i in this && callback.call(thisArg, this[i], i, this)) {
      result.push(this[i]);
    }
  }
  return result;
};

// ─────────────────────────────────────────────
// 3. myReduce — folds array into a single value
// callback(accumulator, currentValue, index, array)
// ─────────────────────────────────────────────
Array.prototype.myReduce = function (callback, initialValue) {
  let acc;
  let startIndex;

  if (arguments.length < 2) {
    if (this.length === 0) throw new TypeError("Reduce of empty array with no initial value");
    acc = this[0];
    startIndex = 1;
  } else {
    acc = initialValue;
    startIndex = 0;
  }

  for (let i = startIndex; i < this.length; i++) {
    if (i in this) {
      acc = callback(acc, this[i], i, this);
    }
  }
  return acc;
};

// ─────────────────────────────────────────────
// 4. myForEach — executes callback for each element (no return)
// ─────────────────────────────────────────────
Array.prototype.myForEach = function (callback, thisArg) {
  for (let i = 0; i < this.length; i++) {
    if (i in this) {
      callback.call(thisArg, this[i], i, this);
    }
  }
};

// ─────────────────────────────────────────────
// 5. myFind — returns first element where callback is true
// ─────────────────────────────────────────────
Array.prototype.myFind = function (callback, thisArg) {
  for (let i = 0; i < this.length; i++) {
    if (i in this && callback.call(thisArg, this[i], i, this)) {
      return this[i];
    }
  }
  return undefined;
};

// ─────────────────────────────────────────────
// 6. myFindIndex — returns index of first match
// ─────────────────────────────────────────────
Array.prototype.myFindIndex = function (callback, thisArg) {
  for (let i = 0; i < this.length; i++) {
    if (i in this && callback.call(thisArg, this[i], i, this)) {
      return i;
    }
  }
  return -1;
};

// ─────────────────────────────────────────────
// 7. myEvery — true if ALL elements pass the test
// ─────────────────────────────────────────────
Array.prototype.myEvery = function (callback, thisArg) {
  for (let i = 0; i < this.length; i++) {
    if (i in this && !callback.call(thisArg, this[i], i, this)) {
      return false;
    }
  }
  return true;
};

// ─────────────────────────────────────────────
// 8. mySome — true if ANY element passes the test
// ─────────────────────────────────────────────
Array.prototype.mySome = function (callback, thisArg) {
  for (let i = 0; i < this.length; i++) {
    if (i in this && callback.call(thisArg, this[i], i, this)) {
      return true;
    }
  }
  return false;
};

// ─────────────────────────────────────────────
// 9. myFlat — flatten without .flat()
// ─────────────────────────────────────────────
Array.prototype.myFlat = function (depth = 1) {
  return this.myReduce((acc, val) => {
    if (Array.isArray(val) && depth > 0) {
      acc.push(...val.myFlat(depth - 1));
    } else {
      acc.push(val);
    }
    return acc;
  }, []);
};

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const nums = [1, 2, 3, 4, 5];

console.log(nums.myMap((x) => x * 2));              // [2,4,6,8,10]
console.log(nums.myFilter((x) => x % 2 === 0));     // [2,4]
console.log(nums.myReduce((acc, x) => acc + x, 0)); // 15
console.log(nums.myFind((x) => x > 3));             // 4
console.log(nums.myFindIndex((x) => x > 3));        // 3
console.log(nums.myEvery((x) => x > 0));            // true
console.log(nums.mySome((x) => x > 4));             // true
console.log([1, [2, [3, [4]]]].myFlat(2));          // [1,2,3,[4]]

nums.myForEach((x) => process.stdout.write(x + " ")); // 1 2 3 4 5
console.log();

---
```

<a id="javascript-map-questions"></a>
## 09_map_questions.js — QUESTION SET: Map — all common interview questions

```javascript
/**
 * QUESTION SET: Map — all common interview questions
 *
 * Map stores key-value pairs where keys can be ANY type
 * (objects, functions, primitives) — unlike plain objects.
 *
 * Map maintains insertion order.
 * Map.size vs Object.keys(obj).length
 */

// ─────────────────────────────────────────────
// Q1. Implement a Map from scratch using an array/hash
// ─────────────────────────────────────────────
class MyMap {
  constructor() {
    this._keys = [];
    this._values = [];
    this.size = 0;
  }

  set(key, value) {
    const idx = this._keys.indexOf(key);
    if (idx !== -1) {
      this._values[idx] = value; // update existing
    } else {
      this._keys.push(key);
      this._values.push(value);
      this.size++;
    }
    return this; // chainable
  }

  get(key) {
    const idx = this._keys.indexOf(key);
    return idx !== -1 ? this._values[idx] : undefined;
  }

  has(key) {
    return this._keys.indexOf(key) !== -1;
  }

  delete(key) {
    const idx = this._keys.indexOf(key);
    if (idx === -1) return false;
    this._keys.splice(idx, 1);
    this._values.splice(idx, 1);
    this.size--;
    return true;
  }

  clear() {
    this._keys = [];
    this._values = [];
    this.size = 0;
  }

  forEach(callback) {
    for (let i = 0; i < this._keys.length; i++) {
      callback(this._values[i], this._keys[i], this);
    }
  }

  keys() { return this._keys[Symbol.iterator](); }
  values() { return this._values[Symbol.iterator](); }

  *entries() {
    for (let i = 0; i < this._keys.length; i++) {
      yield [this._keys[i], this._values[i]];
    }
  }

  [Symbol.iterator]() { return this.entries(); }
}

// ─────────────────────────────────────────────
// Q2. Count frequency of characters in a string using Map
// ─────────────────────────────────────────────
function charFrequency(str) {
  const map = new Map();
  for (const ch of str) {
    map.set(ch, (map.get(ch) || 0) + 1);
  }
  return map;
}

// Q2b. Most frequent character
function mostFreqChar(str) {
  const freq = charFrequency(str);
  let maxChar = "";
  let maxCount = 0;
  for (const [char, count] of freq) {
    if (count > maxCount) { maxCount = count; maxChar = char; }
  }
  return { char: maxChar, count: maxCount };
}

// ─────────────────────────────────────────────
// Q3. Two Sum using Map (O(n) solution)
// Return indices of two numbers that add up to target
// ─────────────────────────────────────────────
function twoSum(nums, target) {
  const seen = new Map(); // value → index
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) {
      return [seen.get(complement), i];
    }
    seen.set(nums[i], i);
  }
  return [];
}

// ─────────────────────────────────────────────
// Q4. Group anagrams together using Map
// Input: ["eat","tea","tan","ate","nat","bat"]
// Output: [["bat"],["nat","tan"],["ate","eat","tea"]]
// ─────────────────────────────────────────────
function groupAnagrams(words) {
  const map = new Map();
  for (const word of words) {
    const key = word.split("").sort().join(""); // sort letters as key
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(word);
  }
  return [...map.values()];
}

// ─────────────────────────────────────────────
// Q5. LRU Cache using Map (Map preserves insertion order)
// get: O(1)  set: O(1)
// ─────────────────────────────────────────────
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map(); // Map preserves insertion order → LRU is first entry
  }

  get(key) {
    if (!this.cache.has(key)) return -1;
    const val = this.cache.get(key);
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  put(key, value) {
    if (this.cache.has(key)) this.cache.delete(key); // refresh position
    this.cache.set(key, value);
    if (this.cache.size > this.capacity) {
      // Delete the FIRST (least recently used) entry
      this.cache.delete(this.cache.keys().next().value);
    }
  }
}

// ─────────────────────────────────────────────
// Q6. Convert Map to/from Object and Array
// ─────────────────────────────────────────────
function mapFromObject(obj) {
  return new Map(Object.entries(obj));
}

function objectFromMap(map) {
  return Object.fromEntries(map);
}

function mapFromArray(pairs) {
  return new Map(pairs); // pairs: [[key, val], ...]
}

// ─────────────────────────────────────────────
// Q7. Find first non-repeating character using Map
// ─────────────────────────────────────────────
function firstNonRepeating(str) {
  const freq = new Map();
  for (const ch of str) freq.set(ch, (freq.get(ch) || 0) + 1);
  for (const ch of str) {
    if (freq.get(ch) === 1) return ch;
  }
  return null;
}

// ─────────────────────────────────────────────
// Q8. Subarray sum equals K using Map (prefix sum)
// Count subarrays whose sum equals k
// ─────────────────────────────────────────────
function subarraySum(nums, k) {
  const prefixMap = new Map([[0, 1]]); // prefixSum → count
  let count = 0;
  let sum = 0;
  for (const num of nums) {
    sum += num;
    if (prefixMap.has(sum - k)) count += prefixMap.get(sum - k);
    prefixMap.set(sum, (prefixMap.get(sum) || 0) + 1);
  }
  return count;
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== Custom Map ===");
const m = new MyMap();
const objKey = { id: 1 };
m.set("name", "Alice").set(objKey, "object-value").set(42, "number-key");
console.log(m.get("name"));    // Alice
console.log(m.get(objKey));    // object-value
console.log(m.size);           // 3
m.delete("name");
console.log(m.size);           // 2

console.log("\n=== Char Frequency ===");
console.log([...charFrequency("hello")]); // [['h',1],['e',1],['l',2],['o',1]]
console.log(mostFreqChar("aabbccddddee")); // { char: 'd', count: 4 }

console.log("\n=== Two Sum ===");
console.log(twoSum([2, 7, 11, 15], 9)); // [0, 1]
console.log(twoSum([3, 2, 4], 6));      // [1, 2]

console.log("\n=== Group Anagrams ===");
console.log(groupAnagrams(["eat", "tea", "tan", "ate", "nat", "bat"]));

console.log("\n=== LRU Cache ===");
const lru = new LRUCache(3);
lru.put(1, "one");
lru.put(2, "two");
lru.put(3, "three");
lru.get(1);            // access 1 → it becomes most recent
lru.put(4, "four");    // evicts 2 (LRU)
console.log(lru.get(2)); // -1 (evicted)
console.log(lru.get(1)); // "one"

console.log("\n=== First Non-Repeating ===");
console.log(firstNonRepeating("aabbcdd")); // c
console.log(firstNonRepeating("aabb"));    // null

console.log("\n=== Subarray Sum ===");
console.log(subarraySum([1, 1, 1], 2)); // 2
console.log(subarraySum([1, 2, 3], 3)); // 2

---
```

<a id="javascript-set-questions"></a>
## 10_set_questions.js — QUESTION SET: Set — all common interview questions

```javascript
/**
 * QUESTION SET: Set — all common interview questions
 *
 * Set stores UNIQUE values of any type.
 * No duplicate keys, values, or entries.
 * Insertion order is maintained.
 * Lookup is O(1) average.
 */

// ─────────────────────────────────────────────
// Q1. Implement a Set from scratch
// ─────────────────────────────────────────────
class MySet {
  constructor(iterable = []) {
    this._data = [];
    this.size = 0;
    for (const val of iterable) this.add(val);
  }

  add(value) {
    if (!this.has(value)) {
      this._data.push(value);
      this.size++;
    }
    return this; // chainable
  }

  has(value) {
    return this._data.indexOf(value) !== -1;
  }

  delete(value) {
    const idx = this._data.indexOf(value);
    if (idx === -1) return false;
    this._data.splice(idx, 1);
    this.size--;
    return true;
  }

  clear() {
    this._data = [];
    this.size = 0;
  }

  forEach(callback) {
    for (const val of this._data) callback(val, val, this);
  }

  values() { return this._data[Symbol.iterator](); }
  keys() { return this.values(); } // Same as values() in Set spec

  *entries() {
    for (const val of this._data) yield [val, val];
  }

  [Symbol.iterator]() { return this.values(); }
}

// ─────────────────────────────────────────────
// Q2. Remove duplicates from an array
// ─────────────────────────────────────────────
function removeDuplicates(arr) {
  return [...new Set(arr)];
}

// Without Set:
function removeDuplicatesManual(arr) {
  return arr.filter((val, idx, self) => self.indexOf(val) === idx);
}

// ─────────────────────────────────────────────
// Q3. Find unique elements (elements appearing exactly once)
// ─────────────────────────────────────────────
function uniqueOnly(arr) {
  const seen = new Set();
  const duplicates = new Set();
  for (const val of arr) {
    if (seen.has(val)) duplicates.add(val);
    else seen.add(val);
  }
  return arr.filter((v) => !duplicates.has(v));
}

// ─────────────────────────────────────────────
// Q4. Set operations — Union, Intersection, Difference
// ─────────────────────────────────────────────

// Union: all elements from both sets
function union(setA, setB) {
  return new Set([...setA, ...setB]);
}

// Intersection: elements present in BOTH sets
function intersection(setA, setB) {
  return new Set([...setA].filter((x) => setB.has(x)));
}

// Difference: elements in A but NOT in B
function difference(setA, setB) {
  return new Set([...setA].filter((x) => !setB.has(x)));
}

// Symmetric difference: elements in either A or B but NOT both
function symmetricDifference(setA, setB) {
  const onlyA = difference(setA, setB);
  const onlyB = difference(setB, setA);
  return union(onlyA, onlyB);
}

// isSubset: check if A is a subset of B
function isSubset(setA, setB) {
  return [...setA].every((x) => setB.has(x));
}

// ─────────────────────────────────────────────
// Q5. Find duplicates in an array using Set
// ─────────────────────────────────────────────
function findDuplicates(arr) {
  const seen = new Set();
  const dupes = new Set();
  for (const val of arr) {
    if (seen.has(val)) dupes.add(val);
    else seen.add(val);
  }
  return [...dupes];
}

// ─────────────────────────────────────────────
// Q6. Check if two arrays have common element
// ─────────────────────────────────────────────
function hasCommon(arr1, arr2) {
  const set1 = new Set(arr1);
  return arr2.some((x) => set1.has(x));
}

// ─────────────────────────────────────────────
// Q7. Longest consecutive sequence (O(n) using Set)
// Input: [100,4,200,1,3,2] → Output: 4 (sequence: 1,2,3,4)
// ─────────────────────────────────────────────
function longestConsecutive(nums) {
  const numSet = new Set(nums);
  let longest = 0;

  for (const num of numSet) {
    // Only start counting from the beginning of a sequence
    if (!numSet.has(num - 1)) {
      let current = num;
      let length = 1;
      while (numSet.has(current + 1)) {
        current++;
        length++;
      }
      longest = Math.max(longest, length);
    }
  }
  return longest;
}

// ─────────────────────────────────────────────
// Q8. Contains duplicate (O(n) using Set)
// ─────────────────────────────────────────────
function containsDuplicate(nums) {
  const seen = new Set();
  for (const num of nums) {
    if (seen.has(num)) return true;
    seen.add(num);
  }
  return false;
}

// ─────────────────────────────────────────────
// Q9. Intersection of two arrays (no using Set ops)
// Return elements common to both arrays (no duplicates)
// ─────────────────────────────────────────────
function arrayIntersection(arr1, arr2) {
  const set1 = new Set(arr1);
  const result = new Set();
  for (const num of arr2) {
    if (set1.has(num)) result.add(num);
  }
  return [...result];
}

// ─────────────────────────────────────────────
// Q10. Convert Set to/from Array and Object
// ─────────────────────────────────────────────
const s = new Set([1, 2, 3, 2, 1]);

const arr = [...s];                    // [1, 2, 3]
const arr2 = Array.from(s);           // [1, 2, 3]
const backToSet = new Set(arr);       // Set {1, 2, 3}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== Custom Set ===");
const ms = new MySet([1, 2, 3, 2, 1]);
console.log(ms.size);       // 3
ms.add(4);
console.log(ms.has(4));     // true
ms.delete(2);
console.log(ms.size);       // 3
console.log([...ms]);       // [1, 3, 4]

console.log("\n=== Remove Duplicates ===");
console.log(removeDuplicates([1, 2, 2, 3, 3, 4]));          // [1,2,3,4]
console.log(removeDuplicatesManual([1, 2, 2, 3, 3, 4]));    // [1,2,3,4]

console.log("\n=== Unique Only ===");
console.log(uniqueOnly([1, 2, 2, 3, 4, 4, 5])); // [1, 3, 5]

console.log("\n=== Set Operations ===");
const A = new Set([1, 2, 3, 4]);
const B = new Set([3, 4, 5, 6]);
console.log([...union(A, B)]);              // [1,2,3,4,5,6]
console.log([...intersection(A, B)]);       // [3,4]
console.log([...difference(A, B)]);         // [1,2]
console.log([...symmetricDifference(A, B)]); // [1,2,5,6]
console.log(isSubset(new Set([3, 4]), A));  // true
console.log(isSubset(new Set([3, 5]), A));  // false

console.log("\n=== Find Duplicates ===");
console.log(findDuplicates([1, 2, 3, 2, 4, 3])); // [2, 3]

console.log("\n=== Longest Consecutive ===");
console.log(longestConsecutive([100, 4, 200, 1, 3, 2])); // 4
console.log(longestConsecutive([0, 3, 7, 2, 5, 8, 4, 6, 0, 1])); // 9

console.log("\n=== Contains Duplicate ===");
console.log(containsDuplicate([1, 2, 3, 1])); // true
console.log(containsDuplicate([1, 2, 3, 4])); // false

console.log("\n=== Array Intersection ===");
console.log(arrayIntersection([1, 2, 2, 1], [2, 2])); // [2]

---
```

<a id="javascript-stack-queue"></a>
## 11_stack_queue.js — QUESTION SET: Stack and Queue

```javascript
/**
 * QUESTION SET: Stack and Queue
 *
 * Stack: LIFO — Last In, First Out
 * Queue: FIFO — First In, First Out
 *
 * Common interview topics:
 * - Implement stack using array / linked list
 * - Implement queue using two stacks
 * - Valid parentheses using stack
 * - Sliding window maximum using deque
 */

// ─────────────────────────────────────────────
// Q1. Implement Stack from scratch
// ─────────────────────────────────────────────
class Stack {
  constructor() {
    this._data = [];
    this.size = 0;
  }

  push(val) {
    this._data.push(val);
    this.size++;
  }

  pop() {
    if (this.isEmpty()) throw new Error("Stack underflow");
    this.size--;
    return this._data.pop();
  }

  peek() {
    if (this.isEmpty()) throw new Error("Stack is empty");
    return this._data[this._data.length - 1];
  }

  isEmpty() { return this.size === 0; }
  toString() { return this._data.join(" → "); }
}

// ─────────────────────────────────────────────
// Q2. Implement Queue from scratch
// ─────────────────────────────────────────────
class Queue {
  constructor() {
    this._data = [];
    this.size = 0;
  }

  enqueue(val) {
    this._data.push(val);
    this.size++;
  }

  dequeue() {
    if (this.isEmpty()) throw new Error("Queue underflow");
    this.size--;
    return this._data.shift();
  }

  front() { return this._data[0]; }
  back() { return this._data[this._data.length - 1]; }
  isEmpty() { return this.size === 0; }
}

// ─────────────────────────────────────────────
// Q3. Implement Queue using Two Stacks
// enqueue: O(1)  dequeue: O(n) amortized
// ─────────────────────────────────────────────
class QueueUsingTwoStacks {
  constructor() {
    this.inbox = [];  // for enqueue
    this.outbox = []; // for dequeue
  }

  enqueue(val) {
    this.inbox.push(val);
  }

  dequeue() {
    if (this.outbox.length === 0) {
      while (this.inbox.length) {
        this.outbox.push(this.inbox.pop()); // transfer all
      }
    }
    if (this.outbox.length === 0) throw new Error("Queue is empty");
    return this.outbox.pop();
  }

  front() {
    if (this.outbox.length === 0) {
      while (this.inbox.length) this.outbox.push(this.inbox.pop());
    }
    return this.outbox[this.outbox.length - 1];
  }

  isEmpty() { return this.inbox.length === 0 && this.outbox.length === 0; }
}

// ─────────────────────────────────────────────
// Q4. Valid Parentheses — using Stack
// Given s = "({[]})", return true if balanced
// ─────────────────────────────────────────────
function isValidParentheses(s) {
  const stack = [];
  const pairs = { ")": "(", "}": "{", "]": "[" };

  for (const ch of s) {
    if ("([{".includes(ch)) {
      stack.push(ch);
    } else {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0;
}

// ─────────────────────────────────────────────
// Q5. Min Stack — get minimum element in O(1)
// ─────────────────────────────────────────────
class MinStack {
  constructor() {
    this.stack = [];
    this.minStack = []; // tracks current min at every state
  }

  push(val) {
    this.stack.push(val);
    const currentMin = this.minStack.length === 0
      ? val
      : Math.min(val, this.minStack[this.minStack.length - 1]);
    this.minStack.push(currentMin);
  }

  pop() {
    this.minStack.pop();
    return this.stack.pop();
  }

  top() { return this.stack[this.stack.length - 1]; }
  getMin() { return this.minStack[this.minStack.length - 1]; }
}

// ─────────────────────────────────────────────
// Q6. Decode String using Stack
// Input: "3[a2[c]]" → Output: "accaccacc"
// ─────────────────────────────────────────────
function decodeString(s) {
  const numStack = [];
  const strStack = [];
  let currentStr = "";
  let currentNum = 0;

  for (const ch of s) {
    if (!isNaN(ch)) {
      currentNum = currentNum * 10 + parseInt(ch); // handle multi-digit
    } else if (ch === "[") {
      numStack.push(currentNum);
      strStack.push(currentStr);
      currentStr = "";
      currentNum = 0;
    } else if (ch === "]") {
      const repeat = numStack.pop();
      currentStr = strStack.pop() + currentStr.repeat(repeat);
    } else {
      currentStr += ch;
    }
  }
  return currentStr;
}

// ─────────────────────────────────────────────
// Q7. Next Greater Element using Stack (monotonic stack)
// For each element, find the next greater element to its right.
// Input: [4, 5, 2, 10]  Output: [5, 10, 10, -1]
// ─────────────────────────────────────────────
function nextGreaterElement(nums) {
  const result = new Array(nums.length).fill(-1);
  const stack = []; // stores indices

  for (let i = 0; i < nums.length; i++) {
    while (stack.length && nums[i] > nums[stack[stack.length - 1]]) {
      result[stack.pop()] = nums[i];
    }
    stack.push(i);
  }
  return result;
}

// ─────────────────────────────────────────────
// Q8. Circular Queue (Ring Buffer)
// ─────────────────────────────────────────────
class CircularQueue {
  constructor(capacity) {
    this.capacity = capacity;
    this.queue = new Array(capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  enqueue(val) {
    if (this.isFull()) return false;
    this.queue[this.tail] = val;
    this.tail = (this.tail + 1) % this.capacity;
    this.size++;
    return true;
  }

  dequeue() {
    if (this.isEmpty()) return false;
    this.head = (this.head + 1) % this.capacity;
    this.size--;
    return true;
  }

  front() { return this.isEmpty() ? -1 : this.queue[this.head]; }
  rear() { return this.isEmpty() ? -1 : this.queue[(this.tail - 1 + this.capacity) % this.capacity]; }
  isEmpty() { return this.size === 0; }
  isFull() { return this.size === this.capacity; }
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== Stack ===");
const st = new Stack();
st.push(1); st.push(2); st.push(3);
console.log(st.peek()); // 3
console.log(st.pop());  // 3
console.log(st.size);   // 2

console.log("\n=== Queue Using Two Stacks ===");
const q2s = new QueueUsingTwoStacks();
q2s.enqueue(1); q2s.enqueue(2); q2s.enqueue(3);
console.log(q2s.dequeue()); // 1 (FIFO)
console.log(q2s.dequeue()); // 2
console.log(q2s.front());   // 3

console.log("\n=== Valid Parentheses ===");
console.log(isValidParentheses("({[]})"));  // true
console.log(isValidParentheses("({[})"));   // false
console.log(isValidParentheses("()[]{}"));  // true

console.log("\n=== Min Stack ===");
const ms = new MinStack();
ms.push(5); ms.push(3); ms.push(7); ms.push(1);
console.log(ms.getMin()); // 1
ms.pop();
console.log(ms.getMin()); // 3

console.log("\n=== Decode String ===");
console.log(decodeString("3[a]2[bc]"));  // aaabcbc
console.log(decodeString("3[a2[c]]"));   // accaccacc

console.log("\n=== Next Greater Element ===");
console.log(nextGreaterElement([4, 5, 2, 10])); // [5, 10, 10, -1]
console.log(nextGreaterElement([3, 1, 2]));      // [-1, 2, -1]

console.log("\n=== Circular Queue ===");
const cq = new CircularQueue(3);
cq.enqueue(1); cq.enqueue(2); cq.enqueue(3);
console.log(cq.isFull());   // true
cq.dequeue();
cq.enqueue(4);
console.log(cq.front());    // 2
console.log(cq.rear());     // 4

---
```

<a id="javascript-linked-list"></a>
## 12_linked_list.js — QUESTION SET: Linked List — all common interview questions

```javascript
/**
 * QUESTION SET: Linked List — all common interview questions
 *
 * A linked list is a linear data structure where each element (node)
 * points to the next. No random access — traversal is O(n).
 *
 * Singly Linked List: node → node → node → null
 * Doubly Linked List: null ← node ↔ node ↔ node → null
 */

// ─────────────────────────────────────────────
// Node & LinkedList implementation
// ─────────────────────────────────────────────
class ListNode {
  constructor(val, next = null) {
    this.val = val;
    this.next = next;
  }
}

class LinkedList {
  constructor() {
    this.head = null;
    this.size = 0;
  }

  append(val) {
    const node = new ListNode(val);
    if (!this.head) { this.head = node; }
    else {
      let curr = this.head;
      while (curr.next) curr = curr.next;
      curr.next = node;
    }
    this.size++;
  }

  prepend(val) {
    this.head = new ListNode(val, this.head);
    this.size++;
  }

  toArray() {
    const arr = [];
    let curr = this.head;
    while (curr) { arr.push(curr.val); curr = curr.next; }
    return arr;
  }

  // Build from array (helper)
  static fromArray(arr) {
    const list = new LinkedList();
    arr.forEach((v) => list.append(v));
    return list;
  }
}

// ─────────────────────────────────────────────
// Q1. Reverse a Linked List (iterative + recursive)
// ─────────────────────────────────────────────
function reverseList(head) {
  let prev = null;
  let curr = head;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev; // new head
}

function reverseListRecursive(head) {
  if (!head || !head.next) return head;
  const newHead = reverseListRecursive(head.next);
  head.next.next = head;
  head.next = null;
  return newHead;
}

// ─────────────────────────────────────────────
// Q2. Detect Cycle — Floyd's Tortoise & Hare
// Returns true if there's a cycle
// ─────────────────────────────────────────────
function hasCycle(head) {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}

// Find the node where the cycle begins
function detectCycleStart(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) {
      slow = head; // restart slow from head
      while (slow !== fast) { slow = slow.next; fast = fast.next; }
      return slow; // cycle start
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// Q3. Find Middle of Linked List
// ─────────────────────────────────────────────
function findMiddle(head) {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
  }
  return slow; // middle node
}

// ─────────────────────────────────────────────
// Q4. Merge Two Sorted Linked Lists
// ─────────────────────────────────────────────
function mergeSortedLists(l1, l2) {
  const dummy = new ListNode(0);
  let curr = dummy;

  while (l1 && l2) {
    if (l1.val <= l2.val) { curr.next = l1; l1 = l1.next; }
    else { curr.next = l2; l2 = l2.next; }
    curr = curr.next;
  }
  curr.next = l1 || l2; // attach remainder
  return dummy.next;
}

// ─────────────────────────────────────────────
// Q5. Remove Nth Node from End of List
// Use two-pointer technique: gap = n
// ─────────────────────────────────────────────
function removeNthFromEnd(head, n) {
  const dummy = new ListNode(0, head);
  let fast = dummy;
  let slow = dummy;

  for (let i = 0; i <= n; i++) fast = fast.next; // advance fast by n+1

  while (fast) {
    slow = slow.next;
    fast = fast.next;
  }
  slow.next = slow.next.next; // skip the nth node
  return dummy.next;
}

// ─────────────────────────────────────────────
// Q6. Check if Linked List is a Palindrome
// ─────────────────────────────────────────────
function isPalindrome(head) {
  let slow = head, fast = head;

  // Find middle
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
  }

  // Reverse second half
  let prev = null, curr = slow;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }

  // Compare both halves
  let left = head, right = prev;
  while (right) {
    if (left.val !== right.val) return false;
    left = left.next;
    right = right.next;
  }
  return true;
}

// ─────────────────────────────────────────────
// Q7. Intersection of Two Linked Lists
// Return node at which the two lists intersect, or null
// ─────────────────────────────────────────────
function getIntersectionNode(headA, headB) {
  if (!headA || !headB) return null;
  let a = headA, b = headB;

  // When a reaches end, redirect to headB and vice versa
  // They'll meet at intersection after same total steps
  while (a !== b) {
    a = a ? a.next : headB;
    b = b ? b.next : headA;
  }
  return a; // null if no intersection
}

// ─────────────────────────────────────────────
// Q8. Flatten a Multilevel Doubly Linked List
// ─────────────────────────────────────────────
class DoublyNode {
  constructor(val) {
    this.val = val;
    this.prev = null;
    this.next = null;
    this.child = null;
  }
}

function flattenDoublyList(head) {
  if (!head) return null;
  const stack = [];
  let curr = head;

  while (curr) {
    if (curr.child) {
      if (curr.next) stack.push(curr.next);
      curr.next = curr.child;
      curr.child.prev = curr;
      curr.child = null;
    }
    if (!curr.next && stack.length) {
      const next = stack.pop();
      curr.next = next;
      next.prev = curr;
    }
    curr = curr.next;
  }
  return head;
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
function listToArr(head) {
  const arr = [];
  while (head) { arr.push(head.val); head = head.next; }
  return arr;
}

function arrToList(arr) {
  return LinkedList.fromArray(arr).head;
}

console.log("=== Reverse List ===");
const l1 = arrToList([1, 2, 3, 4, 5]);
console.log(listToArr(reverseList(l1)));           // [5,4,3,2,1]
const l2 = arrToList([1, 2, 3, 4, 5]);
console.log(listToArr(reverseListRecursive(l2)));  // [5,4,3,2,1]

console.log("\n=== Detect Cycle ===");
const cycleList = arrToList([1, 2, 3, 4]);
cycleList.next.next.next.next = cycleList.next; // create cycle at node 2
console.log(hasCycle(cycleList)); // true
console.log(hasCycle(arrToList([1, 2, 3]))); // false

console.log("\n=== Find Middle ===");
console.log(findMiddle(arrToList([1, 2, 3, 4, 5])).val); // 3
console.log(findMiddle(arrToList([1, 2, 3, 4])).val);    // 3 (second middle)

console.log("\n=== Merge Sorted Lists ===");
const a = arrToList([1, 3, 5]);
const b = arrToList([2, 4, 6]);
console.log(listToArr(mergeSortedLists(a, b))); // [1,2,3,4,5,6]

console.log("\n=== Remove Nth from End ===");
console.log(listToArr(removeNthFromEnd(arrToList([1, 2, 3, 4, 5]), 2))); // [1,2,3,5]

console.log("\n=== Is Palindrome ===");
console.log(isPalindrome(arrToList([1, 2, 2, 1]))); // true
console.log(isPalindrome(arrToList([1, 2, 1])));    // true
console.log(isPalindrome(arrToList([1, 2, 3])));    // false

---
```

<a id="javascript-binary-tree-bst"></a>
## 13_binary_tree_bst.js — QUESTION SET: Binary Tree & Binary Search Tree (BST)

```javascript
/**
 * QUESTION SET: Binary Tree & Binary Search Tree (BST)
 *
 * Tree interview questions appear frequently.
 * Master traversals first — then everything else follows.
 */

// ─────────────────────────────────────────────
// TreeNode definition
// ─────────────────────────────────────────────
class TreeNode {
  constructor(val, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

// Helper: build tree from level-order array (null = missing node)
function buildTree(arr) {
  if (!arr.length || arr[0] == null) return null;
  const root = new TreeNode(arr[0]);
  const queue = [root];
  let i = 1;
  while (queue.length && i < arr.length) {
    const node = queue.shift();
    if (arr[i] != null) { node.left = new TreeNode(arr[i]); queue.push(node.left); }
    i++;
    if (i < arr.length && arr[i] != null) { node.right = new TreeNode(arr[i]); queue.push(node.right); }
    i++;
  }
  return root;
}

// ─────────────────────────────────────────────
// Q1. Tree Traversals (Inorder, Preorder, Postorder)
// ─────────────────────────────────────────────

// Recursive
function inorder(root) {
  if (!root) return [];
  return [...inorder(root.left), root.val, ...inorder(root.right)];
}

function preorder(root) {
  if (!root) return [];
  return [root.val, ...preorder(root.left), ...preorder(root.right)];
}

function postorder(root) {
  if (!root) return [];
  return [...postorder(root.left), ...postorder(root.right), root.val];
}

// Iterative Inorder (interview prefers this)
function inorderIterative(root) {
  const result = [], stack = [];
  let curr = root;
  while (curr || stack.length) {
    while (curr) { stack.push(curr); curr = curr.left; }
    curr = stack.pop();
    result.push(curr.val);
    curr = curr.right;
  }
  return result;
}

// ─────────────────────────────────────────────
// Q2. Level Order Traversal (BFS)
// Returns array of arrays — one per level
// ─────────────────────────────────────────────
function levelOrder(root) {
  if (!root) return [];
  const result = [];
  const queue = [root];

  while (queue.length) {
    const levelSize = queue.length;
    const level = [];
    for (let i = 0; i < levelSize; i++) {
      const node = queue.shift();
      level.push(node.val);
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    result.push(level);
  }
  return result;
}

// ─────────────────────────────────────────────
// Q3. Max Depth / Height of Binary Tree
// ─────────────────────────────────────────────
function maxDepth(root) {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}

// ─────────────────────────────────────────────
// Q4. Check if tree is balanced
// A tree is balanced if height difference of left/right ≤ 1
// ─────────────────────────────────────────────
function isBalanced(root) {
  function height(node) {
    if (!node) return 0;
    const left = height(node.left);
    if (left === -1) return -1;
    const right = height(node.right);
    if (right === -1) return -1;
    if (Math.abs(left - right) > 1) return -1;
    return 1 + Math.max(left, right);
  }
  return height(root) !== -1;
}

// ─────────────────────────────────────────────
// Q5. Diameter of Binary Tree
// Longest path between any two nodes
// ─────────────────────────────────────────────
function diameterOfBinaryTree(root) {
  let maxDiam = 0;

  function depth(node) {
    if (!node) return 0;
    const left = depth(node.left);
    const right = depth(node.right);
    maxDiam = Math.max(maxDiam, left + right);
    return 1 + Math.max(left, right);
  }

  depth(root);
  return maxDiam;
}

// ─────────────────────────────────────────────
// Q6. Lowest Common Ancestor (LCA)
// ─────────────────────────────────────────────
function lowestCommonAncestor(root, p, q) {
  if (!root || root === p || root === q) return root;
  const left = lowestCommonAncestor(root.left, p, q);
  const right = lowestCommonAncestor(root.right, p, q);
  if (left && right) return root; // p and q on opposite sides
  return left || right;
}

// ─────────────────────────────────────────────
// Q7. Binary Tree Right Side View
// ─────────────────────────────────────────────
function rightSideView(root) {
  if (!root) return [];
  const result = [];
  const queue = [root];
  while (queue.length) {
    const size = queue.length;
    for (let i = 0; i < size; i++) {
      const node = queue.shift();
      if (i === size - 1) result.push(node.val); // last node in level
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// Q8. Validate Binary Search Tree
// BST property: left < root < right (all subtrees)
// ─────────────────────────────────────────────
function isValidBST(root, min = -Infinity, max = Infinity) {
  if (!root) return true;
  if (root.val <= min || root.val >= max) return false;
  return isValidBST(root.left, min, root.val) &&
         isValidBST(root.right, root.val, max);
}

// ─────────────────────────────────────────────
// Q9. Path Sum — check if root-to-leaf path has given sum
// ─────────────────────────────────────────────
function hasPathSum(root, targetSum) {
  if (!root) return false;
  if (!root.left && !root.right) return root.val === targetSum;
  return hasPathSum(root.left, targetSum - root.val) ||
         hasPathSum(root.right, targetSum - root.val);
}

// Q9b. All root-to-leaf paths with given sum
function pathSumAll(root, target) {
  const results = [];

  function dfs(node, remaining, path) {
    if (!node) return;
    path.push(node.val);
    if (!node.left && !node.right && remaining === node.val) {
      results.push([...path]);
    }
    dfs(node.left, remaining - node.val, path);
    dfs(node.right, remaining - node.val, path);
    path.pop(); // backtrack
  }

  dfs(root, target, []);
  return results;
}

// ─────────────────────────────────────────────
// Q10. Serialize and Deserialize Binary Tree
// ─────────────────────────────────────────────
function serialize(root) {
  if (!root) return "null";
  return `${root.val},${serialize(root.left)},${serialize(root.right)}`;
}

function deserialize(data) {
  const nodes = data.split(",");
  let i = 0;

  function build() {
    if (nodes[i] === "null") { i++; return null; }
    const node = new TreeNode(parseInt(nodes[i++]));
    node.left = build();
    node.right = build();
    return node;
  }

  return build();
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
//        1
//       / \
//      2   3
//     / \   \
//    4   5   6
const root = buildTree([1, 2, 3, 4, 5, null, 6]);

console.log("Inorder:     ", inorder(root));           // [4,2,5,1,3,6]
console.log("Preorder:    ", preorder(root));          // [1,2,4,5,3,6]
console.log("Postorder:   ", postorder(root));         // [4,5,2,6,3,1]
console.log("Level order: ", levelOrder(root));        // [[1],[2,3],[4,5,6]]
console.log("Max depth:   ", maxDepth(root));          // 3
console.log("Is balanced: ", isBalanced(root));        // true
console.log("Diameter:    ", diameterOfBinaryTree(root)); // 4

const bst = buildTree([5, 3, 7, 2, 4, 6, 8]);
console.log("Valid BST:   ", isValidBST(bst));         // true

console.log("Right view:  ", rightSideView(root));     // [1,3,6]

console.log("Has path 8:  ", hasPathSum(root, 8));     // true (1→3→...no), let's check: 1+2+5=8 → true
console.log("Path sum all:", pathSumAll(root, 8));     // [[1,2,5]]

const serialized = serialize(root);
const deserialized = deserialize(serialized);
console.log("Serialized:  ", serialized);
console.log("Deserialized inorder:", inorder(deserialized)); // [4,2,5,1,3,6]

---
```

<a id="javascript-call-apply-bind"></a>
## 14_call_apply_bind.js — QUESTION SET: call, apply, bind — Custom Implementations

```javascript
/**
 * QUESTION SET: call, apply, bind — Custom Implementations
 *
 * These are prototype methods on Function.prototype.
 * Understanding them tests your knowledge of `this` binding
 * and how JavaScript executes functions.
 */

// ─────────────────────────────────────────────
// Q1. Implement Function.prototype.myCall
//
// call invokes fn immediately with given `this` context
// and arguments passed individually.
// fn.myCall(context, arg1, arg2, ...)
// ─────────────────────────────────────────────
Function.prototype.myCall = function (context = globalThis, ...args) {
  // Assign `this` (the function) as a method on context
  const sym = Symbol(); // unique key to avoid overwriting
  context[sym] = this;
  const result = context[sym](...args);
  delete context[sym]; // clean up
  return result;
};

// ─────────────────────────────────────────────
// Q2. Implement Function.prototype.myApply
//
// Same as call but arguments are passed as an array.
// fn.myApply(context, [arg1, arg2])
// ─────────────────────────────────────────────
Function.prototype.myApply = function (context = globalThis, args = []) {
  const sym = Symbol();
  context[sym] = this;
  const result = context[sym](...args);
  delete context[sym];
  return result;
};

// ─────────────────────────────────────────────
// Q3. Implement Function.prototype.myBind
//
// bind returns a NEW function with fixed `this` and
// optional preset arguments (partial application).
// fn.myBind(context, arg1, arg2)(moreArgs)
// ─────────────────────────────────────────────
Function.prototype.myBind = function (context, ...presetArgs) {
  const fn = this;

  function bound(...laterArgs) {
    // If used as constructor (new bound()), `this` should be the new object
    const ctx = this instanceof bound ? this : context;
    return fn.apply(ctx, [...presetArgs, ...laterArgs]);
  }

  // Preserve prototype chain for `new` usage
  bound.prototype = Object.create(fn.prototype);
  return bound;
};

// ─────────────────────────────────────────────
// Q4. Implement `new` keyword from scratch
//
// new Fn(args) does:
//   1. Create a new empty object
//   2. Set its __proto__ to Fn.prototype
//   3. Call Fn with `this` = new object
//   4. Return the object (unless Fn returns an object itself)
// ─────────────────────────────────────────────
function myNew(Constructor, ...args) {
  const obj = Object.create(Constructor.prototype); // step 1 & 2
  const result = Constructor.apply(obj, args);       // step 3
  // If constructor explicitly returns an object, use that; otherwise use obj
  return result instanceof Object ? result : obj;    // step 4
}

// ─────────────────────────────────────────────
// Q5. Implement Object.create from scratch
// ─────────────────────────────────────────────
function myObjectCreate(proto, propertiesObject) {
  if (typeof proto !== "object" && typeof proto !== "function") {
    throw new TypeError("Object prototype must be an Object or null");
  }
  function F() {} // empty constructor
  F.prototype = proto;
  const obj = new F();
  if (propertiesObject !== undefined) {
    Object.defineProperties(obj, propertiesObject);
  }
  return obj;
}

// ─────────────────────────────────────────────
// Q6. Implement Function.prototype.before
// Runs a given function BEFORE the original
// (AOP - Aspect Oriented Programming pattern)
// ─────────────────────────────────────────────
Function.prototype.before = function (beforeFn) {
  const originalFn = this;
  return function (...args) {
    beforeFn.apply(this, args);
    return originalFn.apply(this, args);
  };
};

// Q7. Implement Function.prototype.after
Function.prototype.after = function (afterFn) {
  const originalFn = this;
  return function (...args) {
    const result = originalFn.apply(this, args);
    afterFn.apply(this, args);
    return result;
  };
};

// ─────────────────────────────────────────────
// Q8. Implement once() — function that can only be called once
// ─────────────────────────────────────────────
function once(fn) {
  let called = false;
  let result;
  return function (...args) {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  };
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const person = { name: "Alice" };

function greet(greeting, punctuation) {
  return `${greeting}, ${this.name}${punctuation}`;
}

console.log("=== myCall ===");
console.log(greet.myCall(person, "Hello", "!"));   // Hello, Alice!
console.log(greet.myCall(person, "Hi", "."));      // Hi, Alice.

console.log("\n=== myApply ===");
console.log(greet.myApply(person, ["Hey", "?"]));  // Hey, Alice?

console.log("\n=== myBind ===");
const boundGreet = greet.myBind(person, "Howdy");
console.log(boundGreet("~"));  // Howdy, Alice~
console.log(boundGreet("!"));  // Howdy, Alice!

console.log("\n=== myNew ===");
function Car(make, model) {
  this.make = make;
  this.model = model;
}
Car.prototype.toString = function () { return `${this.make} ${this.model}`; };

const car = myNew(Car, "Toyota", "Corolla");
console.log(car.make);        // Toyota
console.log(car.toString());  // Toyota Corolla
console.log(car instanceof Car); // true

console.log("\n=== myObjectCreate ===");
const animal = { type: "Animal", describe() { return `I am a ${this.type}`; } };
const dog = myObjectCreate(animal);
dog.type = "Dog";
console.log(dog.describe()); // I am a Dog

console.log("\n=== once ===");
const initialize = once(() => { console.log("Init ran!"); return 42; });
console.log(initialize()); // Init ran! → 42
console.log(initialize()); // (no log) → 42 (cached)
console.log(initialize()); // (no log) → 42

console.log("\n=== Math.max with apply ===");
const numbers = [3, 1, 4, 1, 5, 9, 2, 6];
console.log(Math.max.apply(null, numbers)); // 9
console.log(Math.max.myApply(null, numbers)); // 9

---
```

<a id="javascript-searching-algorithms"></a>
## 15_searching_algorithms.js — QUESTION SET: Searching Algorithms

```javascript
/**
 * QUESTION SET: Searching Algorithms
 *
 * Linear Search  → O(n)
 * Binary Search  → O(log n) — requires sorted array
 * Jump Search    → O(√n)
 * Interpolation  → O(log log n) avg — for uniformly distributed data
 * Exponential    → O(log n) — useful for unbounded/infinite arrays
 */

// ─────────────────────────────────────────────
// Q1. Linear Search
// Find the index of target in array (unsorted allowed)
// Time: O(n)  Space: O(1)
// ─────────────────────────────────────────────
function linearSearch(arr, target) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === target) return i;
  }
  return -1;
}

// ─────────────────────────────────────────────
// Q2. Binary Search (Iterative)
// Array MUST be sorted.
// Time: O(log n)  Space: O(1)
// ─────────────────────────────────────────────
function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2); // avoids integer overflow
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}

// ─────────────────────────────────────────────
// Q3. Binary Search (Recursive)
// ─────────────────────────────────────────────
function binarySearchRecursive(arr, target, left = 0, right = arr.length - 1) {
  if (left > right) return -1;
  const mid = left + Math.floor((right - left) / 2);
  if (arr[mid] === target) return mid;
  if (arr[mid] < target) return binarySearchRecursive(arr, target, mid + 1, right);
  return binarySearchRecursive(arr, target, left, mid - 1);
}

// ─────────────────────────────────────────────
// Q4. Find First and Last Position of Target (Binary Search variant)
// Input: sorted array with duplicates, e.g. [5,7,7,8,8,10], target=8
// Output: [3, 4]
// ─────────────────────────────────────────────
function searchRange(arr, target) {
  function findBound(isFirst) {
    let left = 0, right = arr.length - 1, bound = -1;
    while (left <= right) {
      const mid = left + Math.floor((right - left) / 2);
      if (arr[mid] === target) {
        bound = mid;
        if (isFirst) right = mid - 1; // keep searching left
        else left = mid + 1;          // keep searching right
      } else if (arr[mid] < target) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    return bound;
  }
  return [findBound(true), findBound(false)];
}

// ─────────────────────────────────────────────
// Q5. Search in Rotated Sorted Array
// Array was sorted then rotated at some pivot.
// Input: [4,5,6,7,0,1,2], target=0 → Output: 4
// ─────────────────────────────────────────────
function searchRotated(arr, target) {
  let left = 0, right = arr.length - 1;

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    if (arr[mid] === target) return mid;

    // Left half is sorted
    if (arr[left] <= arr[mid]) {
      if (target >= arr[left] && target < arr[mid]) right = mid - 1;
      else left = mid + 1;
    } else {
      // Right half is sorted
      if (target > arr[mid] && target <= arr[right]) left = mid + 1;
      else right = mid - 1;
    }
  }
  return -1;
}

// ─────────────────────────────────────────────
// Q6. Find Minimum in Rotated Sorted Array
// ─────────────────────────────────────────────
function findMinRotated(arr) {
  let left = 0, right = arr.length - 1;
  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (arr[mid] > arr[right]) left = mid + 1; // min is in right half
    else right = mid;                           // min is in left half (including mid)
  }
  return arr[left];
}

// ─────────────────────────────────────────────
// Q7. Jump Search
// Best for sorted arrays on media where backtracking is costly.
// Time: O(√n)  Space: O(1)
// ─────────────────────────────────────────────
function jumpSearch(arr, target) {
  const n = arr.length;
  let step = Math.floor(Math.sqrt(n));
  let prev = 0;

  while (step < n && arr[step] < target) {
    prev = step;
    step += Math.floor(Math.sqrt(n));
    if (prev >= n) return -1;
  }

  for (let i = prev; i <= Math.min(step, n - 1); i++) {
    if (arr[i] === target) return i;
  }
  return -1;
}

// ─────────────────────────────────────────────
// Q8. Interpolation Search
// Like binary search but estimates position based on value.
// Best for uniformly distributed sorted arrays.
// Time: O(log log n) avg, O(n) worst
// ─────────────────────────────────────────────
function interpolationSearch(arr, target) {
  let low = 0;
  let high = arr.length - 1;

  while (low <= high && target >= arr[low] && target <= arr[high]) {
    if (low === high) return arr[low] === target ? low : -1;

    // Estimate position by interpolation formula
    const pos = low + Math.floor(
      ((target - arr[low]) / (arr[high] - arr[low])) * (high - low)
    );

    if (arr[pos] === target) return pos;
    if (arr[pos] < target) low = pos + 1;
    else high = pos - 1;
  }
  return -1;
}

// ─────────────────────────────────────────────
// Q9. Exponential Search
// Useful for unbounded/infinite sorted arrays.
// Find range first, then binary search within.
// Time: O(log n)  Space: O(log n) recursive
// ─────────────────────────────────────────────
function exponentialSearch(arr, target) {
  if (arr[0] === target) return 0;

  let i = 1;
  while (i < arr.length && arr[i] <= target) i *= 2; // double each time

  // Binary search in range [i/2, min(i, n-1)]
  return binarySearch(arr.slice(Math.floor(i / 2), Math.min(i + 1, arr.length)), target) + Math.floor(i / 2);
}

// ─────────────────────────────────────────────
// Q10. Find Peak Element (Binary Search variant)
// A peak is any element greater than its neighbors.
// Input: [1,2,3,1] → Output: 2 (index of element 3)
// ─────────────────────────────────────────────
function findPeakElement(nums) {
  let left = 0, right = nums.length - 1;
  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (nums[mid] > nums[mid + 1]) right = mid; // peak is on left side
    else left = mid + 1;                        // peak is on right side
  }
  return left; // index of peak
}

// ─────────────────────────────────────────────
// Q11. Count occurrences of target in sorted array
// ─────────────────────────────────────────────
function countOccurrences(arr, target) {
  const range = searchRange(arr, target);
  if (range[0] === -1) return 0;
  return range[1] - range[0] + 1;
}

// ─────────────────────────────────────────────
// Q12. Sqrt(x) — integer square root using binary search
// Input: 8 → Output: 2 (floor of √8 = 2.82...)
// ─────────────────────────────────────────────
function mySqrt(x) {
  if (x < 2) return x;
  let left = 1, right = Math.floor(x / 2);
  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    if (mid * mid === x) return mid;
    if (mid * mid < x) left = mid + 1;
    else right = mid - 1;
  }
  return right; // floor value
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const sorted = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

console.log("=== Linear Search ===");
console.log(linearSearch(sorted, 7));   // 3
console.log(linearSearch(sorted, 10));  // -1

console.log("\n=== Binary Search (Iterative) ===");
console.log(binarySearch(sorted, 7));   // 3
console.log(binarySearch(sorted, 19));  // 9
console.log(binarySearch(sorted, 10));  // -1

console.log("\n=== Binary Search (Recursive) ===");
console.log(binarySearchRecursive(sorted, 13)); // 6

console.log("\n=== Search Range (First & Last) ===");
console.log(searchRange([5, 7, 7, 8, 8, 10], 8));  // [3, 4]
console.log(searchRange([5, 7, 7, 8, 8, 10], 6));  // [-1, -1]

console.log("\n=== Search in Rotated Array ===");
console.log(searchRotated([4, 5, 6, 7, 0, 1, 2], 0)); // 4
console.log(searchRotated([4, 5, 6, 7, 0, 1, 2], 3)); // -1
console.log(searchRotated([1], 0));                    // -1

console.log("\n=== Find Min in Rotated Array ===");
console.log(findMinRotated([3, 4, 5, 1, 2])); // 1
console.log(findMinRotated([4, 5, 6, 7, 0, 1, 2])); // 0

console.log("\n=== Jump Search ===");
console.log(jumpSearch(sorted, 11)); // 5

console.log("\n=== Interpolation Search ===");
console.log(interpolationSearch(sorted, 7));  // 3
console.log(interpolationSearch(sorted, 10)); // -1

console.log("\n=== Find Peak Element ===");
console.log(findPeakElement([1, 2, 3, 1]));    // 2
console.log(findPeakElement([1, 2, 1, 3, 5, 6, 4])); // 5

console.log("\n=== Count Occurrences ===");
console.log(countOccurrences([1, 2, 2, 2, 3, 4], 2)); // 3

console.log("\n=== Integer Sqrt ===");
console.log(mySqrt(4));  // 2
console.log(mySqrt(8));  // 2
console.log(mySqrt(9));  // 3

---
```

<a id="javascript-sorting-algorithms"></a>
## 16_sorting_algorithms.js — QUESTION SET: Sorting Algorithms

```javascript
/**
 * QUESTION SET: Sorting Algorithms
 *
 * ┌──────────────────┬──────────┬──────────┬────────┬─────────┐
 * │ Algorithm        │ Best     │ Average  │ Worst  │ Space   │
 * ├──────────────────┼──────────┼──────────┼────────┼─────────┤
 * │ Bubble Sort      │ O(n)     │ O(n²)    │ O(n²)  │ O(1)    │
 * │ Selection Sort   │ O(n²)    │ O(n²)    │ O(n²)  │ O(1)    │
 * │ Insertion Sort   │ O(n)     │ O(n²)    │ O(n²)  │ O(1)    │
 * │ Merge Sort       │ O(nlogn) │ O(nlogn) │O(nlogn)│ O(n)    │
 * │ Quick Sort       │ O(nlogn) │ O(nlogn) │ O(n²)  │ O(logn) │
 * │ Heap Sort        │ O(nlogn) │ O(nlogn) │O(nlogn)│ O(1)    │
 * │ Counting Sort    │ O(n+k)   │ O(n+k)   │ O(n+k) │ O(k)    │
 * │ Radix Sort       │ O(nk)    │ O(nk)    │ O(nk)  │ O(n+k)  │
 * └──────────────────┴──────────┴──────────┴────────┴─────────┘
 */

// ─────────────────────────────────────────────
// Q1. Bubble Sort
// Repeatedly swap adjacent elements if in wrong order.
// Stable | In-place
// ─────────────────────────────────────────────
function bubbleSort(arr) {
  const a = [...arr]; // don't mutate original
  for (let i = 0; i < a.length; i++) {
    let swapped = false;
    for (let j = 0; j < a.length - i - 1; j++) {
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]]; // ES6 swap
        swapped = true;
      }
    }
    if (!swapped) break; // already sorted — O(n) best case
  }
  return a;
}

// ─────────────────────────────────────────────
// Q2. Selection Sort
// Find minimum in unsorted portion, swap to front.
// Not stable | In-place
// ─────────────────────────────────────────────
function selectionSort(arr) {
  const a = [...arr];
  for (let i = 0; i < a.length; i++) {
    let minIdx = i;
    for (let j = i + 1; j < a.length; j++) {
      if (a[j] < a[minIdx]) minIdx = j;
    }
    if (minIdx !== i) [a[i], a[minIdx]] = [a[minIdx], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────
// Q3. Insertion Sort
// Build sorted portion by inserting each element in place.
// Stable | In-place | Best for nearly sorted data
// ─────────────────────────────────────────────
function insertionSort(arr) {
  const a = [...arr];
  for (let i = 1; i < a.length; i++) {
    const key = a[i];
    let j = i - 1;
    while (j >= 0 && a[j] > key) {
      a[j + 1] = a[j]; // shift right
      j--;
    }
    a[j + 1] = key;
  }
  return a;
}

// ─────────────────────────────────────────────
// Q4. Merge Sort
// Divide and conquer — split, sort, merge.
// Stable | NOT in-place | O(n log n) guaranteed
// ─────────────────────────────────────────────
function mergeSort(arr) {
  if (arr.length <= 1) return arr;

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));

  return merge(left, right);
}

function merge(left, right) {
  const result = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) result.push(left[i++]);
    else result.push(right[j++]);
  }
  // Append remaining elements
  return result.concat(left.slice(i)).concat(right.slice(j));
}

// ─────────────────────────────────────────────
// Q5. Quick Sort
// Pick pivot, partition, recurse on subarrays.
// Not stable | In-place (here functional version)
// Average O(n log n) | Worst O(n²) with bad pivot
// ─────────────────────────────────────────────
function quickSort(arr) {
  if (arr.length <= 1) return arr;

  const pivot = arr[Math.floor(arr.length / 2)]; // middle element as pivot
  const left = arr.filter((x) => x < pivot);
  const middle = arr.filter((x) => x === pivot);
  const right = arr.filter((x) => x > pivot);

  return [...quickSort(left), ...middle, ...quickSort(right)];
}

// In-place Quick Sort (Lomuto partition scheme)
function quickSortInPlace(arr, low = 0, high = arr.length - 1) {
  if (low < high) {
    const pivotIdx = partition(arr, low, high);
    quickSortInPlace(arr, low, pivotIdx - 1);
    quickSortInPlace(arr, pivotIdx + 1, high);
  }
  return arr;
}

function partition(arr, low, high) {
  const pivot = arr[high]; // last element as pivot
  let i = low - 1;
  for (let j = low; j < high; j++) {
    if (arr[j] <= pivot) {
      i++;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
  return i + 1;
}

// ─────────────────────────────────────────────
// Q6. Heap Sort
// Build max-heap, extract maximum repeatedly.
// Not stable | In-place | O(n log n) guaranteed
// ─────────────────────────────────────────────
function heapSort(arr) {
  const a = [...arr];
  const n = a.length;

  // Build max-heap (heapify from bottom up)
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    heapify(a, n, i);
  }

  // Extract elements from heap one by one
  for (let i = n - 1; i > 0; i--) {
    [a[0], a[i]] = [a[i], a[0]]; // move current root (max) to end
    heapify(a, i, 0);             // restore heap for reduced size
  }
  return a;
}

function heapify(arr, n, root) {
  let largest = root;
  const left = 2 * root + 1;
  const right = 2 * root + 2;

  if (left < n && arr[left] > arr[largest]) largest = left;
  if (right < n && arr[right] > arr[largest]) largest = right;

  if (largest !== root) {
    [arr[root], arr[largest]] = [arr[largest], arr[root]];
    heapify(arr, n, largest);
  }
}

// ─────────────────────────────────────────────
// Q7. Counting Sort
// Only for non-negative integers within a known range.
// Time: O(n + k)  Space: O(k) where k = max value
// ─────────────────────────────────────────────
function countingSort(arr) {
  if (!arr.length) return [];
  const max = Math.max(...arr);
  const count = new Array(max + 1).fill(0);

  for (const num of arr) count[num]++;

  const result = [];
  for (let i = 0; i <= max; i++) {
    while (count[i]-- > 0) result.push(i);
  }
  return result;
}

// ─────────────────────────────────────────────
// Q8. Radix Sort (LSD — Least Significant Digit)
// Sort by each digit position, most performant for integers.
// Time: O(nk) where k = number of digits
// ─────────────────────────────────────────────
function radixSort(arr) {
  const max = Math.max(...arr);
  let exp = 1;

  const a = [...arr];
  while (Math.floor(max / exp) > 0) {
    countingSortByDigit(a, exp);
    exp *= 10;
  }
  return a;
}

function countingSortByDigit(arr, exp) {
  const output = new Array(arr.length).fill(0);
  const count = new Array(10).fill(0);

  for (const num of arr) count[Math.floor(num / exp) % 10]++;
  for (let i = 1; i < 10; i++) count[i] += count[i - 1]; // cumulative

  for (let i = arr.length - 1; i >= 0; i--) {
    const digit = Math.floor(arr[i] / exp) % 10;
    output[count[digit] - 1] = arr[i];
    count[digit]--;
  }
  for (let i = 0; i < arr.length; i++) arr[i] = output[i];
}

// ─────────────────────────────────────────────
// Q9. Sort 0s, 1s, 2s — Dutch National Flag Problem
// Sort array containing only 0, 1, 2 in O(n) one pass
// ─────────────────────────────────────────────
function sortColors(arr) {
  const a = [...arr];
  let low = 0, mid = 0, high = a.length - 1;

  while (mid <= high) {
    if (a[mid] === 0) {
      [a[low], a[mid]] = [a[mid], a[low]];
      low++; mid++;
    } else if (a[mid] === 1) {
      mid++;
    } else {
      [a[mid], a[high]] = [a[high], a[mid]];
      high--;
    }
  }
  return a;
}

// ─────────────────────────────────────────────
// Q10. Sort an array of objects by a key
// ─────────────────────────────────────────────
function sortByKey(arr, key, direction = "asc") {
  return [...arr].sort((a, b) => {
    if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
    if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const arr = [64, 25, 12, 22, 11, 90, 3, 45];
const expected = [3, 11, 12, 22, 25, 45, 64, 90];

console.log("Bubble Sort:    ", bubbleSort(arr));
console.log("Selection Sort: ", selectionSort(arr));
console.log("Insertion Sort: ", insertionSort(arr));
console.log("Merge Sort:     ", mergeSort(arr));
console.log("Quick Sort:     ", quickSort(arr));
console.log("Quick Sort IP:  ", quickSortInPlace([...arr]));
console.log("Heap Sort:      ", heapSort(arr));
console.log("Counting Sort:  ", countingSort(arr));
console.log("Radix Sort:     ", radixSort(arr));

console.log("\n=== Dutch National Flag ===");
console.log(sortColors([2, 0, 2, 1, 1, 0])); // [0, 0, 1, 1, 2, 2]

console.log("\n=== Sort Objects by Key ===");
const people = [
  { name: "Charlie", age: 30 },
  { name: "Alice", age: 25 },
  { name: "Bob", age: 35 },
];
console.log(sortByKey(people, "age").map((p) => p.name)); // Alice, Charlie, Bob
console.log(sortByKey(people, "name").map((p) => p.name)); // Alice, Bob, Charlie

// Verify all sorts give same result
const allSame = [bubbleSort, selectionSort, insertionSort, mergeSort, quickSort, heapSort]
  .map((fn) => JSON.stringify(fn(arr)))
  .every((result) => result === JSON.stringify(expected));
console.log("\nAll sorts produce correct result:", allSame); // true

---
```

<a id="javascript-recursion-backtracking"></a>
## 17_recursion_backtracking.js — QUESTION SET: Recursion Patterns

```javascript
/**
 * QUESTION SET: Recursion Patterns
 *
 * Recursion = a function that calls itself.
 * Every recursive solution needs:
 *   1. Base case  — stop condition
 *   2. Recursive case — problem reduced toward base case
 *
 * PATTERNS:
 *   - Linear recursion       (factorial, fibonacci)
 *   - Binary recursion       (merge sort, tree traversal)
 *   - Tail recursion         (optimized — TCO)
 *   - Mutual recursion       (isEven/isOdd)
 *   - Backtracking           (permutations, subsets, maze)
 *   - Divide & Conquer       (binary search, quick sort)
 *   - Tree recursion         (DFS, path sum)
 */

// ─────────────────────────────────────────────
// Q1. Factorial — n! = n * (n-1)!
// ─────────────────────────────────────────────
function factorial(n) {
  if (n <= 1) return 1;                          // base case
  return n * factorial(n - 1);                   // recursive case
}

// Tail-recursive version (can be optimised by JS engine)
function factorialTail(n, acc = 1) {
  if (n <= 1) return acc;
  return factorialTail(n - 1, n * acc);          // accumulator carries result
}

// ─────────────────────────────────────────────
// Q2. Fibonacci — fib(n) = fib(n-1) + fib(n-2)
// ─────────────────────────────────────────────

// Naive: O(2^n)
function fibNaive(n) {
  if (n <= 1) return n;
  return fibNaive(n - 1) + fibNaive(n - 2);
}

// With memoization: O(n)
function fibMemo(n, memo = {}) {
  if (n <= 1) return n;
  if (memo[n] !== undefined) return memo[n];
  memo[n] = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
  return memo[n];
}

// Bottom-up DP: O(n) time, O(1) space
function fibDP(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
  return b;
}

// ─────────────────────────────────────────────
// Q3. Power — x^n (fast exponentiation)
// Simple: O(n)  |  Fast power: O(log n)
// ─────────────────────────────────────────────
function power(x, n) {
  if (n === 0) return 1;
  if (n < 0) return 1 / power(x, -n);      // handle negatives
  if (n % 2 === 0) {
    const half = power(x, n / 2);
    return half * half;                      // x^n = (x^n/2)^2
  }
  return x * power(x, n - 1);
}

// ─────────────────────────────────────────────
// Q4. Sum of digits   1234 → 10
// ─────────────────────────────────────────────
function sumDigits(n) {
  n = Math.abs(n);
  if (n < 10) return n;
  return (n % 10) + sumDigits(Math.floor(n / 10));
}

// ─────────────────────────────────────────────
// Q5. Reverse a string recursively
// ─────────────────────────────────────────────
function reverseString(str) {
  if (str.length <= 1) return str;
  return reverseString(str.slice(1)) + str[0];
}

// ─────────────────────────────────────────────
// Q6. Check palindrome recursively
// ─────────────────────────────────────────────
function isPalindrome(str) {
  if (str.length <= 1) return true;
  if (str[0] !== str[str.length - 1]) return false;
  return isPalindrome(str.slice(1, -1));
}

// ─────────────────────────────────────────────
// Q7. Flatten nested array recursively (no .flat)
// ─────────────────────────────────────────────
function flatten(arr) {
  return arr.reduce((acc, val) =>
    Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val), []);
}

// ─────────────────────────────────────────────
// Q8. All Permutations of a string/array
// Input: "abc" → ["abc","acb","bac","bca","cab","cba"]
// ─────────────────────────────────────────────
function permutations(str) {
  if (str.length <= 1) return [str];
  const result = [];
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const remaining = str.slice(0, i) + str.slice(i + 1);
    for (const perm of permutations(remaining)) {
      result.push(char + perm);
    }
  }
  return result;
}

// Array permutations (backtracking)
function permuteArray(nums) {
  const result = [];

  function backtrack(start) {
    if (start === nums.length) { result.push([...nums]); return; }
    for (let i = start; i < nums.length; i++) {
      [nums[start], nums[i]] = [nums[i], nums[start]]; // swap
      backtrack(start + 1);
      [nums[start], nums[i]] = [nums[i], nums[start]]; // swap back
    }
  }

  backtrack(0);
  return result;
}

// ─────────────────────────────────────────────
// Q9. All Subsets (Power Set)
// Input: [1,2,3] → [[], [1], [2], [3], [1,2], [1,3], [2,3], [1,2,3]]
// 2^n subsets total
// ─────────────────────────────────────────────
function subsets(nums) {
  const result = [];

  function backtrack(start, current) {
    result.push([...current]);
    for (let i = start; i < nums.length; i++) {
      current.push(nums[i]);
      backtrack(i + 1, current);
      current.pop(); // backtrack
    }
  }

  backtrack(0, []);
  return result;
}

// ─────────────────────────────────────────────
// Q10. Generate All Valid Parentheses
// Input: n=2 → ["(())", "()()"]
// ─────────────────────────────────────────────
function generateParentheses(n) {
  const result = [];

  function backtrack(current, open, close) {
    if (current.length === 2 * n) { result.push(current); return; }
    if (open < n) backtrack(current + "(", open + 1, close);
    if (close < open) backtrack(current + ")", open, close + 1);
  }

  backtrack("", 0, 0);
  return result;
}

// ─────────────────────────────────────────────
// Q11. Tower of Hanoi
// Move n disks from source to target using auxiliary
// Time: O(2^n)
// ─────────────────────────────────────────────
function hanoi(n, from = "A", to = "C", aux = "B") {
  if (n === 0) return;
  hanoi(n - 1, from, aux, to); // move n-1 disks out of the way
  console.log(`Move disk ${n}: ${from} → ${to}`);
  hanoi(n - 1, aux, to, from); // move n-1 disks to target
}

// ─────────────────────────────────────────────
// Q12. Combination Sum
// Find all combinations that sum to target (can reuse elements)
// Input: candidates=[2,3,6,7], target=7 → [[2,2,3],[7]]
// ─────────────────────────────────────────────
function combinationSum(candidates, target) {
  const result = [];

  function backtrack(start, remaining, path) {
    if (remaining === 0) { result.push([...path]); return; }
    if (remaining < 0) return;

    for (let i = start; i < candidates.length; i++) {
      path.push(candidates[i]);
      backtrack(i, remaining - candidates[i], path); // allow reuse: pass i not i+1
      path.pop();
    }
  }

  backtrack(0, target, []);
  return result;
}

// ─────────────────────────────────────────────
// Q13. Word Search in Grid (recursive DFS + backtracking)
// ─────────────────────────────────────────────
function exist(board, word) {
  const rows = board.length;
  const cols = board[0].length;

  function dfs(r, c, idx) {
    if (idx === word.length) return true;
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    if (board[r][c] !== word[idx]) return false;

    const temp = board[r][c];
    board[r][c] = "#"; // mark as visited

    const found =
      dfs(r + 1, c, idx + 1) ||
      dfs(r - 1, c, idx + 1) ||
      dfs(r, c + 1, idx + 1) ||
      dfs(r, c - 1, idx + 1);

    board[r][c] = temp; // restore
    return found;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (dfs(r, c, 0)) return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────
// Q14. N-Queens Problem
// Place N queens on NxN board so no two attack each other
// ─────────────────────────────────────────────
function solveNQueens(n) {
  const result = [];
  const board = Array.from({ length: n }, () => ".".repeat(n).split(""));

  function isSafe(row, col) {
    for (let i = 0; i < row; i++) {
      if (board[i][col] === "Q") return false;
      if (col - (row - i) >= 0 && board[i][col - (row - i)] === "Q") return false;
      if (col + (row - i) < n && board[i][col + (row - i)] === "Q") return false;
    }
    return true;
  }

  function backtrack(row) {
    if (row === n) {
      result.push(board.map((r) => r.join("")));
      return;
    }
    for (let col = 0; col < n; col++) {
      if (isSafe(row, col)) {
        board[row][col] = "Q";
        backtrack(row + 1);
        board[row][col] = "."; // backtrack
      }
    }
  }

  backtrack(0);
  return result;
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== Factorial ===");
console.log(factorial(5));      // 120
console.log(factorialTail(5));  // 120

console.log("\n=== Fibonacci ===");
console.log(fibNaive(10));  // 55
console.log(fibMemo(50));   // 12586269025
console.log(fibDP(50));     // 12586269025

console.log("\n=== Power ===");
console.log(power(2, 10));   // 1024
console.log(power(2, -2));   // 0.25
console.log(power(3, 0));    // 1

console.log("\n=== Sum Digits ===");
console.log(sumDigits(1234)); // 10

console.log("\n=== Reverse String ===");
console.log(reverseString("hello")); // olleh

console.log("\n=== Is Palindrome ===");
console.log(isPalindrome("racecar")); // true
console.log(isPalindrome("hello"));   // false

console.log("\n=== Flatten ===");
console.log(flatten([1, [2, [3, [4]]]])); // [1,2,3,4]

console.log("\n=== Permutations ===");
console.log(permutations("abc")); // 6 permutations

console.log("\n=== Subsets ===");
console.log(subsets([1, 2, 3])); // 8 subsets

console.log("\n=== Generate Parentheses ===");
console.log(generateParentheses(3)); // ["((()))","(()())","(())()","()(())","()()()"]

console.log("\n=== Tower of Hanoi (n=3) ===");
hanoi(3); // 7 moves

console.log("\n=== Combination Sum ===");
console.log(combinationSum([2, 3, 6, 7], 7)); // [[2,2,3],[7]]

console.log("\n=== Word Search ===");
const grid = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]];
console.log(exist(grid, "ABCCED")); // true
console.log(exist(grid, "SEE"));    // true
console.log(exist(grid, "ABCB"));   // false

console.log("\n=== N-Queens (n=4) ===");
console.log(solveNQueens(4).length); // 2 solutions
solveNQueens(4).forEach((sol) => { console.log(sol); console.log("---"); });

---
```

<a id="javascript-dynamic-programming"></a>
## 18_dynamic_programming.js — QUESTION SET: Dynamic Programming (DP)

```javascript
/**
 * QUESTION SET: Dynamic Programming (DP)
 *
 * DP = Recursion + Memoization (top-down)
 *   OR Iteration + Tabulation (bottom-up)
 *
 * Apply DP when:
 *   1. Problem has overlapping subproblems
 *   2. Problem has optimal substructure
 *
 * PATTERNS:
 *   - 1D DP: fibonacci, climbing stairs, house robber
 *   - 2D DP: grid paths, edit distance, longest common subsequence
 *   - Knapsack variants: 0/1 knapsack, unbounded, coin change
 *   - String DP: palindrome, word break
 */

// ─────────────────────────────────────────────
// Q1. Climbing Stairs
// n steps, can climb 1 or 2 at a time. How many ways?
// Same pattern as Fibonacci.
// ─────────────────────────────────────────────
function climbStairs(n) {
  if (n <= 2) return n;
  let prev1 = 1, prev2 = 2;
  for (let i = 3; i <= n; i++) {
    [prev1, prev2] = [prev2, prev1 + prev2];
  }
  return prev2;
}

// ─────────────────────────────────────────────
// Q2. House Robber — max sum of non-adjacent elements
// Input: [1,2,3,1] → Output: 4 (rob house 0 and 2)
// ─────────────────────────────────────────────
function rob(nums) {
  let prev2 = 0, prev1 = 0;
  for (const num of nums) {
    const curr = Math.max(prev1, prev2 + num);
    prev2 = prev1;
    prev1 = curr;
  }
  return prev1;
}

// ─────────────────────────────────────────────
// Q3. Coin Change — fewest coins to make amount
// Input: coins=[1,5,10,25], amount=36 → Output: 3 (25+10+1)
// ─────────────────────────────────────────────
function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;

  for (let i = 1; i <= amount; i++) {
    for (const coin of coins) {
      if (coin <= i) {
        dp[i] = Math.min(dp[i], dp[i - coin] + 1);
      }
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}

// Q3b. Coin Change 2 — number of ways to make amount
function coinChangeWays(coins, amount) {
  const dp = new Array(amount + 1).fill(0);
  dp[0] = 1; // 1 way to make 0

  for (const coin of coins) {
    for (let i = coin; i <= amount; i++) {
      dp[i] += dp[i - coin];
    }
  }
  return dp[amount];
}

// ─────────────────────────────────────────────
// Q4. 0/1 Knapsack
// Given weights and values, max value within capacity
// Each item can only be used ONCE
// ─────────────────────────────────────────────
function knapsack01(weights, values, capacity) {
  const n = weights.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let w = 0; w <= capacity; w++) {
      if (weights[i - 1] <= w) {
        dp[i][w] = Math.max(
          dp[i - 1][w],                                    // skip item
          values[i - 1] + dp[i - 1][w - weights[i - 1]]   // take item
        );
      } else {
        dp[i][w] = dp[i - 1][w]; // can't take item
      }
    }
  }
  return dp[n][capacity];
}

// ─────────────────────────────────────────────
// Q5. Longest Common Subsequence (LCS)
// Input: "abcde", "ace" → Output: 3 ("ace")
// ─────────────────────────────────────────────
function lcs(s1, s2) {
  const m = s1.length, n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// ─────────────────────────────────────────────
// Q6. Longest Increasing Subsequence (LIS)
// Input: [10,9,2,5,3,7,101,18] → Output: 4 ([2,3,7,101])
// ─────────────────────────────────────────────
function lengthOfLIS(nums) {
  const dp = new Array(nums.length).fill(1);
  let max = 1;

  for (let i = 1; i < nums.length; i++) {
    for (let j = 0; j < i; j++) {
      if (nums[j] < nums[i]) {
        dp[i] = Math.max(dp[i], dp[j] + 1);
      }
    }
    max = Math.max(max, dp[i]);
  }
  return max;
}

// ─────────────────────────────────────────────
// Q7. Edit Distance (Levenshtein Distance)
// Min operations (insert, delete, replace) to convert s1 → s2
// Input: "horse", "ros" → Output: 3
// ─────────────────────────────────────────────
function editDistance(s1, s2) {
  const m = s1.length, n = s2.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // delete
          dp[i][j - 1],     // insert
          dp[i - 1][j - 1]  // replace
        );
      }
    }
  }
  return dp[m][n];
}

// ─────────────────────────────────────────────
// Q8. Unique Paths in Grid (m × n)
// Move only right or down, how many paths from top-left to bottom-right?
// ─────────────────────────────────────────────
function uniquePaths(m, n) {
  const dp = Array.from({ length: m }, () => new Array(n).fill(1));

  for (let i = 1; i < m; i++) {
    for (let j = 1; j < n; j++) {
      dp[i][j] = dp[i - 1][j] + dp[i][j - 1];
    }
  }
  return dp[m - 1][n - 1];
}

// ─────────────────────────────────────────────
// Q9. Longest Palindromic Substring
// Input: "babad" → Output: "bab" or "aba"
// ─────────────────────────────────────────────
function longestPalindrome(s) {
  let start = 0, maxLen = 1;

  function expand(left, right) {
    while (left >= 0 && right < s.length && s[left] === s[right]) {
      if (right - left + 1 > maxLen) {
        maxLen = right - left + 1;
        start = left;
      }
      left--;
      right++;
    }
  }

  for (let i = 0; i < s.length; i++) {
    expand(i, i);     // odd length
    expand(i, i + 1); // even length
  }
  return s.slice(start, start + maxLen);
}

// ─────────────────────────────────────────────
// Q10. Maximum Subarray — Kadane's Algorithm
// Find contiguous subarray with the maximum sum
// Input: [-2,1,-3,4,-1,2,1,-5,4] → Output: 6 ([4,-1,2,1])
// ─────────────────────────────────────────────
function maxSubArray(nums) {
  let maxSum = nums[0];
  let currentSum = nums[0];

  for (let i = 1; i < nums.length; i++) {
    currentSum = Math.max(nums[i], currentSum + nums[i]);
    maxSum = Math.max(maxSum, currentSum);
  }
  return maxSum;
}

// Q10b. Return the actual subarray with max sum
function maxSubArrayWithIndices(nums) {
  let maxSum = nums[0], currentSum = nums[0];
  let start = 0, end = 0, tempStart = 0;

  for (let i = 1; i < nums.length; i++) {
    if (nums[i] > currentSum + nums[i]) {
      currentSum = nums[i];
      tempStart = i;
    } else {
      currentSum += nums[i];
    }
    if (currentSum > maxSum) {
      maxSum = currentSum;
      start = tempStart;
      end = i;
    }
  }
  return { maxSum, subarray: nums.slice(start, end + 1) };
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== Climbing Stairs ===");
console.log(climbStairs(5));  // 8
console.log(climbStairs(10)); // 89

console.log("\n=== House Robber ===");
console.log(rob([1, 2, 3, 1]));     // 4
console.log(rob([2, 7, 9, 3, 1])); // 12

console.log("\n=== Coin Change ===");
console.log(coinChange([1, 5, 10, 25], 36)); // 3 (25+10+1)
console.log(coinChange([2], 3));             // -1 (impossible)
console.log(coinChangeWays([1, 2, 5], 5));  // 4 ways

console.log("\n=== 0/1 Knapsack ===");
console.log(knapsack01([2, 3, 4, 5], [3, 4, 5, 6], 5)); // 7

console.log("\n=== LCS ===");
console.log(lcs("abcde", "ace")); // 3
console.log(lcs("abc", "abc"));   // 3
console.log(lcs("abc", "def"));   // 0

console.log("\n=== LIS ===");
console.log(lengthOfLIS([10, 9, 2, 5, 3, 7, 101, 18])); // 4

console.log("\n=== Edit Distance ===");
console.log(editDistance("horse", "ros"));    // 3
console.log(editDistance("intention", "execution")); // 5

console.log("\n=== Unique Paths ===");
console.log(uniquePaths(3, 7)); // 28
console.log(uniquePaths(3, 2)); // 3

console.log("\n=== Longest Palindromic Substring ===");
console.log(longestPalindrome("babad")); // bab
console.log(longestPalindrome("cbbd")); // bb

console.log("\n=== Maximum Subarray ===");
console.log(maxSubArray([-2, 1, -3, 4, -1, 2, 1, -5, 4])); // 6
console.log(maxSubArrayWithIndices([-2, 1, -3, 4, -1, 2, 1, -5, 4]));
// { maxSum: 6, subarray: [4, -1, 2, 1] }

---
```

<a id="javascript-graph-algorithms"></a>
## 19_graph_algorithms.js — QUESTION SET: Graph Algorithms

```javascript
/**
 * QUESTION SET: Graph Algorithms
 *
 * Graph = Vertices (nodes) + Edges (connections)
 * Types: Directed / Undirected | Weighted / Unweighted | Cyclic / Acyclic
 *
 * Representations:
 *   - Adjacency List  → Map<node, [neighbors]>  — best for sparse graphs
 *   - Adjacency Matrix → matrix[i][j] = weight  — best for dense graphs
 *
 * Core algorithms:
 *   BFS → level-by-level (Queue) → shortest path in unweighted graph
 *   DFS → depth-first (Stack/Recursion) → cycle detection, topological sort
 */

// ─────────────────────────────────────────────
// Q1. Build Graph from Edge List
// ─────────────────────────────────────────────
function buildGraph(edges, directed = false) {
  const graph = new Map();

  for (const [u, v] of edges) {
    if (!graph.has(u)) graph.set(u, []);
    if (!graph.has(v)) graph.set(v, []);
    graph.get(u).push(v);
    if (!directed) graph.get(v).push(u); // undirected: both ways
  }
  return graph;
}

// ─────────────────────────────────────────────
// Q2. BFS — Breadth First Search
// Level-order traversal. Finds shortest path.
// ─────────────────────────────────────────────
function bfs(graph, start) {
  const visited = new Set([start]);
  const queue = [start];
  const order = [];

  while (queue.length) {
    const node = queue.shift();
    order.push(node);
    for (const neighbor of (graph.get(node) || [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return order;
}

// ─────────────────────────────────────────────
// Q3. DFS — Depth First Search (iterative + recursive)
// ─────────────────────────────────────────────
function dfsIterative(graph, start) {
  const visited = new Set();
  const stack = [start];
  const order = [];

  while (stack.length) {
    const node = stack.pop();
    if (visited.has(node)) continue;
    visited.add(node);
    order.push(node);
    for (const neighbor of (graph.get(node) || [])) {
      if (!visited.has(neighbor)) stack.push(neighbor);
    }
  }
  return order;
}

function dfsRecursive(graph, node, visited = new Set()) {
  visited.add(node);
  const order = [node];
  for (const neighbor of (graph.get(node) || [])) {
    if (!visited.has(neighbor)) {
      order.push(...dfsRecursive(graph, neighbor, visited));
    }
  }
  return order;
}

// ─────────────────────────────────────────────
// Q4. Shortest Path (BFS — unweighted graph)
// Returns distance map from source to all nodes
// ─────────────────────────────────────────────
function shortestPath(graph, start) {
  const dist = new Map([[start, 0]]);
  const queue = [start];

  while (queue.length) {
    const node = queue.shift();
    for (const neighbor of (graph.get(node) || [])) {
      if (!dist.has(neighbor)) {
        dist.set(neighbor, dist.get(node) + 1);
        queue.push(neighbor);
      }
    }
  }
  return dist;
}

// ─────────────────────────────────────────────
// Q5. Has Path — does path exist between source and dest?
// ─────────────────────────────────────────────
function hasPath(graph, src, dst, visited = new Set()) {
  if (src === dst) return true;
  if (visited.has(src)) return false;
  visited.add(src);
  for (const neighbor of (graph.get(src) || [])) {
    if (hasPath(graph, neighbor, dst, visited)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────
// Q6. Number of Connected Components
// ─────────────────────────────────────────────
function countComponents(n, edges) {
  // Union-Find approach
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(x) {
    if (parent[x] !== x) parent[x] = find(parent[x]); // path compression
    return parent[x];
  }

  function union(x, y) {
    const px = find(x), py = find(y);
    if (px === py) return false;
    parent[px] = py;
    return true;
  }

  let components = n;
  for (const [u, v] of edges) {
    if (union(u, v)) components--;
  }
  return components;
}

// ─────────────────────────────────────────────
// Q7. Detect Cycle in Directed Graph (DFS + coloring)
// 0 = unvisited, 1 = in stack (gray), 2 = done (black)
// ─────────────────────────────────────────────
function hasCycleDirected(graph) {
  const color = new Map();

  function dfs(node) {
    color.set(node, 1); // mark as in-progress
    for (const neighbor of (graph.get(node) || [])) {
      if (color.get(neighbor) === 1) return true;  // back edge → cycle
      if (!color.has(neighbor) && dfs(neighbor)) return true;
    }
    color.set(node, 2); // done
    return false;
  }

  for (const node of graph.keys()) {
    if (!color.has(node) && dfs(node)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────
// Q8. Topological Sort (Kahn's Algorithm — BFS)
// Only for Directed Acyclic Graphs (DAG)
// Use case: task scheduling, build systems, course prerequisites
// ─────────────────────────────────────────────
function topologicalSort(numCourses, prerequisites) {
  const inDegree = new Array(numCourses).fill(0);
  const graph = Array.from({ length: numCourses }, () => []);

  for (const [course, prereq] of prerequisites) {
    graph[prereq].push(course);
    inDegree[course]++;
  }

  const queue = [];
  for (let i = 0; i < numCourses; i++) {
    if (inDegree[i] === 0) queue.push(i);
  }

  const order = [];
  while (queue.length) {
    const course = queue.shift();
    order.push(course);
    for (const next of graph[course]) {
      inDegree[next]--;
      if (inDegree[next] === 0) queue.push(next);
    }
  }
  return order.length === numCourses ? order : []; // empty = cycle exists
}

// ─────────────────────────────────────────────
// Q9. Number of Islands (Grid BFS/DFS)
// Input: 2D grid of '1' (land) and '0' (water)
// Count connected components of land
// ─────────────────────────────────────────────
function numIslands(grid) {
  let count = 0;
  const rows = grid.length, cols = grid[0].length;

  function dfs(r, c) {
    if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] !== "1") return;
    grid[r][c] = "0"; // mark visited by sinking it
    dfs(r + 1, c); dfs(r - 1, c);
    dfs(r, c + 1); dfs(r, c - 1);
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === "1") {
        dfs(r, c);
        count++;
      }
    }
  }
  return count;
}

// ─────────────────────────────────────────────
// Q10. Clone Graph
// ─────────────────────────────────────────────
class GraphNode {
  constructor(val, neighbors = []) {
    this.val = val;
    this.neighbors = neighbors;
  }
}

function cloneGraph(node, visited = new Map()) {
  if (!node) return null;
  if (visited.has(node)) return visited.get(node);

  const clone = new GraphNode(node.val);
  visited.set(node, clone);
  clone.neighbors = node.neighbors.map((n) => cloneGraph(n, visited));
  return clone;
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
const edges = [[0,1],[0,2],[1,2],[2,3]];
const g = buildGraph(edges);

console.log("=== BFS ===");
console.log(bfs(g, 0)); // [0, 1, 2, 3]

console.log("\n=== DFS ===");
console.log(dfsIterative(g, 0));
console.log(dfsRecursive(g, 0));

console.log("\n=== Shortest Path ===");
console.log([...shortestPath(g, 0).entries()]); // [[0,0],[1,1],[2,1],[3,2]]

console.log("\n=== Has Path ===");
console.log(hasPath(g, 0, 3)); // true
console.log(hasPath(g, 3, 0)); // true (undirected)

console.log("\n=== Connected Components ===");
console.log(countComponents(5, [[0,1],[1,2],[3,4]])); // 2

console.log("\n=== Topological Sort ===");
console.log(topologicalSort(4, [[1,0],[2,0],[3,1],[3,2]])); // [0,1,2,3] or valid order

console.log("\n=== Number of Islands ===");
const grid = [
  ["1","1","0","0","0"],
  ["1","1","0","0","0"],
  ["0","0","1","0","0"],
  ["0","0","0","1","1"]
];
console.log(numIslands(grid)); // 3

console.log("\n=== Cycle Detection ===");
const directedCyclic = buildGraph([[0,1],[1,2],[2,0]], true);
console.log(hasCycleDirected(directedCyclic)); // true
const directedAcyclic = buildGraph([[0,1],[1,2],[2,3]], true);
console.log(hasCycleDirected(directedAcyclic)); // false

---
```

<a id="javascript-sliding-window-two-pointer"></a>
## 20_sliding_window_two_pointer.js — QUESTION SET: Sliding Window & Two Pointer Patterns

```javascript
/**
 * QUESTION SET: Sliding Window & Two Pointer Patterns
 *
 * These are the most commonly asked array/string patterns in interviews.
 *
 * SLIDING WINDOW:
 *   - Fixed size window: sum/avg of every k elements
 *   - Variable size window: longest/shortest subarray meeting condition
 *   Time: O(n) instead of O(n²) brute force
 *
 * TWO POINTERS:
 *   - Opposite ends: sorted array problems, two sum, palindrome
 *   - Same direction (fast/slow): remove duplicates, cycle detection
 */

// ─────────────────────────────────────────────
// SLIDING WINDOW
// ─────────────────────────────────────────────

// Q1. Maximum Sum Subarray of Size K (Fixed Window)
// Input: [2,1,5,1,3,2], k=3 → Output: 9 (5+1+3)
function maxSumSubarrayK(arr, k) {
  let windowSum = 0;
  let maxSum = 0;

  for (let i = 0; i < k; i++) windowSum += arr[i]; // initial window
  maxSum = windowSum;

  for (let i = k; i < arr.length; i++) {
    windowSum += arr[i] - arr[i - k]; // slide: add new, remove old
    maxSum = Math.max(maxSum, windowSum);
  }
  return maxSum;
}

// Q2. Average of all subarrays of size K
function avgSubarraysK(arr, k) {
  const result = [];
  let windowSum = 0;

  for (let i = 0; i < k; i++) windowSum += arr[i];
  result.push(windowSum / k);

  for (let i = k; i < arr.length; i++) {
    windowSum += arr[i] - arr[i - k];
    result.push(windowSum / k);
  }
  return result;
}

// Q3. Longest Substring Without Repeating Characters (Variable Window)
// Input: "abcabcbb" → Output: 3 ("abc")
function lengthOfLongestSubstring(s) {
  const seen = new Map(); // char → last seen index
  let maxLen = 0;
  let left = 0;

  for (let right = 0; right < s.length; right++) {
    if (seen.has(s[right]) && seen.get(s[right]) >= left) {
      left = seen.get(s[right]) + 1; // shrink window
    }
    seen.set(s[right], right);
    maxLen = Math.max(maxLen, right - left + 1);
  }
  return maxLen;
}

// Q4. Longest Substring with At Most K Distinct Characters
function lengthWithKDistinct(s, k) {
  const freq = new Map();
  let left = 0, maxLen = 0;

  for (let right = 0; right < s.length; right++) {
    freq.set(s[right], (freq.get(s[right]) || 0) + 1);

    while (freq.size > k) {
      const ch = s[left++];
      freq.set(ch, freq.get(ch) - 1);
      if (freq.get(ch) === 0) freq.delete(ch);
    }
    maxLen = Math.max(maxLen, right - left + 1);
  }
  return maxLen;
}

// Q5. Minimum Window Substring containing all chars of t
// Input: s="ADOBECODEBANC", t="ABC" → Output: "BANC"
function minWindow(s, t) {
  const need = new Map();
  for (const ch of t) need.set(ch, (need.get(ch) || 0) + 1);

  let left = 0, formed = 0, required = need.size;
  let minLen = Infinity, minStart = 0;
  const window = new Map();

  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    window.set(ch, (window.get(ch) || 0) + 1);

    if (need.has(ch) && window.get(ch) === need.get(ch)) formed++;

    while (formed === required) {
      if (right - left + 1 < minLen) {
        minLen = right - left + 1;
        minStart = left;
      }
      const leftCh = s[left++];
      window.set(leftCh, window.get(leftCh) - 1);
      if (need.has(leftCh) && window.get(leftCh) < need.get(leftCh)) formed--;
    }
  }
  return minLen === Infinity ? "" : s.slice(minStart, minStart + minLen);
}

// Q6. Permutation in String
// Check if any permutation of p exists as substring in s
function checkInclusion(s1, s2) {
  if (s1.length > s2.length) return false;
  const count = new Array(26).fill(0);
  const a = "a".charCodeAt(0);

  for (let i = 0; i < s1.length; i++) {
    count[s1.charCodeAt(i) - a]++;
    count[s2.charCodeAt(i) - a]--;
  }
  if (count.every((c) => c === 0)) return true;

  for (let i = s1.length; i < s2.length; i++) {
    count[s2.charCodeAt(i) - a]--;
    count[s2.charCodeAt(i - s1.length) - a]++;
    if (count.every((c) => c === 0)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────
// TWO POINTERS
// ─────────────────────────────────────────────

// Q7. Two Sum II — sorted array, return 1-indexed pair
function twoSumSorted(numbers, target) {
  let left = 0, right = numbers.length - 1;
  while (left < right) {
    const sum = numbers[left] + numbers[right];
    if (sum === target) return [left + 1, right + 1];
    if (sum < target) left++;
    else right--;
  }
  return [];
}

// Q8. Three Sum — all unique triplets that sum to 0
// Input: [-1,0,1,2,-1,-4] → [[-1,-1,2],[-1,0,1]]
function threeSum(nums) {
  nums.sort((a, b) => a - b);
  const result = [];

  for (let i = 0; i < nums.length - 2; i++) {
    if (i > 0 && nums[i] === nums[i - 1]) continue; // skip duplicates
    let left = i + 1, right = nums.length - 1;

    while (left < right) {
      const sum = nums[i] + nums[left] + nums[right];
      if (sum === 0) {
        result.push([nums[i], nums[left], nums[right]]);
        while (left < right && nums[left] === nums[left + 1]) left++;
        while (left < right && nums[right] === nums[right - 1]) right--;
        left++; right--;
      } else if (sum < 0) {
        left++;
      } else {
        right--;
      }
    }
  }
  return result;
}

// Q9. Container With Most Water
// Find two lines that form a container holding the most water
function maxWaterContainer(height) {
  let left = 0, right = height.length - 1;
  let maxArea = 0;

  while (left < right) {
    const area = Math.min(height[left], height[right]) * (right - left);
    maxArea = Math.max(maxArea, area);
    if (height[left] < height[right]) left++;
    else right--;
  }
  return maxArea;
}

// Q10. Trapping Rain Water
// Input: [0,1,0,2,1,0,1,3,2,1,2,1] → Output: 6
function trap(height) {
  let left = 0, right = height.length - 1;
  let leftMax = 0, rightMax = 0;
  let water = 0;

  while (left < right) {
    if (height[left] < height[right]) {
      if (height[left] >= leftMax) leftMax = height[left];
      else water += leftMax - height[left];
      left++;
    } else {
      if (height[right] >= rightMax) rightMax = height[right];
      else water += rightMax - height[right];
      right--;
    }
  }
  return water;
}

// Q11. Remove Duplicates from Sorted Array (in-place)
// Return length of array with unique elements
function removeDuplicatesSorted(nums) {
  if (!nums.length) return 0;
  let slow = 0;
  for (let fast = 1; fast < nums.length; fast++) {
    if (nums[fast] !== nums[slow]) {
      slow++;
      nums[slow] = nums[fast];
    }
  }
  return slow + 1;
}

// Q12. Move Zeros to End (in-place, maintain order)
function moveZeroes(nums) {
  let slow = 0;
  for (let fast = 0; fast < nums.length; fast++) {
    if (nums[fast] !== 0) {
      nums[slow++] = nums[fast];
    }
  }
  while (slow < nums.length) nums[slow++] = 0;
  return nums;
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== Max Sum Subarray K ===");
console.log(maxSumSubarrayK([2, 1, 5, 1, 3, 2], 3)); // 9

console.log("\n=== Longest Substring No Repeat ===");
console.log(lengthOfLongestSubstring("abcabcbb")); // 3
console.log(lengthOfLongestSubstring("pwwkew"));   // 3
console.log(lengthOfLongestSubstring("bbbbb"));    // 1

console.log("\n=== K Distinct Characters ===");
console.log(lengthWithKDistinct("araaci", 2)); // 4 ("araa")

console.log("\n=== Minimum Window Substring ===");
console.log(minWindow("ADOBECODEBANC", "ABC")); // BANC
console.log(minWindow("a", "a"));               // a

console.log("\n=== Permutation in String ===");
console.log(checkInclusion("ab", "eidbaooo")); // true
console.log(checkInclusion("ab", "eidboaoo")); // false

console.log("\n=== Two Sum Sorted ===");
console.log(twoSumSorted([2, 7, 11, 15], 9)); // [1, 2]

console.log("\n=== Three Sum ===");
console.log(threeSum([-1, 0, 1, 2, -1, -4])); // [[-1,-1,2],[-1,0,1]]

console.log("\n=== Container With Most Water ===");
console.log(maxWaterContainer([1, 8, 6, 2, 5, 4, 8, 3, 7])); // 49

console.log("\n=== Trapping Rain Water ===");
console.log(trap([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1])); // 6

console.log("\n=== Remove Duplicates (Sorted) ===");
const arr = [1, 1, 2, 3, 3, 4];
const len = removeDuplicatesSorted(arr);
console.log(arr.slice(0, len)); // [1, 2, 3, 4]

console.log("\n=== Move Zeros ===");
console.log(moveZeroes([0, 1, 0, 3, 12])); // [1, 3, 12, 0, 0]

---
```

<a id="javascript-functional-programming"></a>
## 21_functional_programming.js — QUESTION SET: Functional Programming Patterns

```javascript
/**
 * QUESTION SET: Functional Programming Patterns
 *
 * pipe, compose, groupBy, chunk, zip, flatten, intersection,
 * differenceBy, throttle-once, observable pattern, etc.
 */

// ─────────────────────────────────────────────
// Q1. pipe — left-to-right function composition
// pipe(f, g, h)(x) = h(g(f(x)))
// ─────────────────────────────────────────────
function pipe(...fns) {
  return function (value) {
    return fns.reduce((acc, fn) => fn(acc), value);
  };
}

// Q2. compose — right-to-left (mathematical convention)
// compose(f, g, h)(x) = f(g(h(x)))
function compose(...fns) {
  return function (value) {
    return fns.reduceRight((acc, fn) => fn(acc), value);
  };
}

// ─────────────────────────────────────────────
// Q3. groupBy — group array elements by a key function
// groupBy([6.1, 4.2, 6.3], Math.floor) → { 6: [6.1,6.3], 4: [4.2] }
// ─────────────────────────────────────────────
function groupBy(arr, fn) {
  return arr.reduce((acc, item) => {
    const key = typeof fn === "function" ? fn(item) : item[fn];
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

// ─────────────────────────────────────────────
// Q4. chunk — split array into chunks of size n
// chunk([1,2,3,4,5], 2) → [[1,2],[3,4],[5]]
// ─────────────────────────────────────────────
function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ─────────────────────────────────────────────
// Q5. zip — combine corresponding elements from multiple arrays
// zip([1,2,3], ['a','b','c']) → [[1,'a'],[2,'b'],[3,'c']]
// ─────────────────────────────────────────────
function zip(...arrays) {
  const minLen = Math.min(...arrays.map((a) => a.length));
  return Array.from({ length: minLen }, (_, i) => arrays.map((a) => a[i]));
}

// Q5b. unzip — inverse of zip
function unzip(arr) {
  if (!arr.length) return [];
  return arr[0].map((_, i) => arr.map((row) => row[i]));
}

// ─────────────────────────────────────────────
// Q6. flatten object (nested → flat with dot notation keys)
// { a: { b: { c: 1 } } } → { 'a.b.c': 1 }
// ─────────────────────────────────────────────
function flattenObject(obj, prefix = "") {
  return Object.keys(obj).reduce((acc, key) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(acc, flattenObject(obj[key], fullKey));
    } else {
      acc[fullKey] = obj[key];
    }
    return acc;
  }, {});
}

// Q6b. unflatten object (dot notation → nested)
function unflattenObject(obj) {
  return Object.keys(obj).reduce((acc, key) => {
    const parts = key.split(".");
    parts.reduce((nested, part, i) => {
      if (i === parts.length - 1) nested[part] = obj[key];
      else nested[part] = nested[part] || {};
      return nested[part];
    }, acc);
    return acc;
  }, {});
}

// ─────────────────────────────────────────────
// Q7. Deep Equal — compare two values structurally
// ─────────────────────────────────────────────
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => deepEqual(a[key], b[key]));
  }

  return false;
}

// ─────────────────────────────────────────────
// Q8. differenceBy — elements in arr1 not in arr2 by iteratee
// differenceBy([2.1,1.2], [2.3,3.4], Math.floor) → [1.2]
// ─────────────────────────────────────────────
function differenceBy(arr1, arr2, fn) {
  const set2 = new Set(arr2.map(fn));
  return arr1.filter((item) => !set2.has(fn(item)));
}

// ─────────────────────────────────────────────
// Q9. Custom Event Emitter (Observer pattern)
// ─────────────────────────────────────────────
class EventEmitter {
  constructor() {
    this._listeners = new Map(); // event → [callbacks]
  }

  on(event, callback) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(callback);
    return this; // chainable
  }

  off(event, callback) {
    if (!this._listeners.has(event)) return this;
    const cbs = this._listeners.get(event).filter((cb) => cb !== callback);
    this._listeners.set(event, cbs);
    return this;
  }

  once(event, callback) {
    const wrapper = (...args) => {
      callback(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  emit(event, ...args) {
    if (!this._listeners.has(event)) return false;
    this._listeners.get(event).forEach((cb) => cb(...args));
    return true;
  }

  removeAllListeners(event) {
    if (event) this._listeners.delete(event);
    else this._listeners.clear();
    return this;
  }

  listenerCount(event) {
    return (this._listeners.get(event) || []).length;
  }
}

// ─────────────────────────────────────────────
// Q10. Implement Observable (simplified RxJS-like)
// ─────────────────────────────────────────────
class Observable {
  constructor(subscribeFn) {
    this._subscribeFn = subscribeFn;
  }

  subscribe(observer) {
    if (typeof observer === "function") observer = { next: observer };
    const subscriber = {
      next: (val) => observer.next && observer.next(val),
      error: (err) => observer.error && observer.error(err),
      complete: () => observer.complete && observer.complete(),
    };
    return this._subscribeFn(subscriber);
  }

  // Operator: map
  map(fn) {
    return new Observable((subscriber) => {
      return this.subscribe({
        next: (val) => subscriber.next(fn(val)),
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });
    });
  }

  // Operator: filter
  filter(fn) {
    return new Observable((subscriber) => {
      return this.subscribe({
        next: (val) => fn(val) && subscriber.next(val),
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });
    });
  }
}

// ─────────────────────────────────────────────
// Q11. Implement a simple pub/sub system
// ─────────────────────────────────────────────
function createPubSub() {
  const subscribers = {};

  return {
    subscribe(topic, callback) {
      if (!subscribers[topic]) subscribers[topic] = [];
      subscribers[topic].push(callback);
      return () => {
        subscribers[topic] = subscribers[topic].filter((cb) => cb !== callback);
      };
    },
    publish(topic, data) {
      (subscribers[topic] || []).forEach((cb) => cb(data));
    },
  };
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== pipe & compose ===");
const double = (x) => x * 2;
const addTen = (x) => x + 10;
const square = (x) => x * x;

const transform = pipe(double, addTen, square); // ((5*2)+10)^2 = 400
console.log(transform(5)); // 400

const transform2 = compose(square, addTen, double);
console.log(transform2(5)); // 400 (same — right-to-left)

console.log("\n=== groupBy ===");
console.log(groupBy([6.1, 4.2, 6.3], Math.floor)); // { '6': [6.1, 6.3], '4': [4.2] }
console.log(groupBy(["one","two","three"], "length")); // { 3: ['one','two'], 5: ['three'] }

console.log("\n=== chunk ===");
console.log(chunk([1, 2, 3, 4, 5], 2)); // [[1,2],[3,4],[5]]

console.log("\n=== zip ===");
console.log(zip([1, 2, 3], ["a", "b", "c"])); // [[1,'a'],[2,'b'],[3,'c']]
console.log(unzip([[1,"a"],[2,"b"],[3,"c"]])); // [[1,2,3],['a','b','c']]

console.log("\n=== flattenObject ===");
console.log(flattenObject({ a: { b: { c: 1 }, d: 2 }, e: 3 }));
// { 'a.b.c': 1, 'a.d': 2, 'e': 3 }
console.log(unflattenObject({ "a.b.c": 1, "a.d": 2, e: 3 }));
// { a: { b: { c: 1 }, d: 2 }, e: 3 }

console.log("\n=== deepEqual ===");
console.log(deepEqual({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })); // true
console.log(deepEqual({ a: 1 }, { a: 2 }));                        // false

console.log("\n=== differenceBy ===");
console.log(differenceBy([2.1, 1.2], [2.3, 3.4], Math.floor)); // [1.2]

console.log("\n=== EventEmitter ===");
const emitter = new EventEmitter();
const handler = (data) => console.log("Event received:", data);
emitter.on("data", handler);
emitter.emit("data", { msg: "hello" }); // Event received: { msg: 'hello' }
emitter.off("data", handler);
console.log(emitter.emit("data", "test")); // false (no listeners)

emitter.once("click", (x) => console.log("Clicked:", x));
emitter.emit("click", "button1"); // Clicked: button1
emitter.emit("click", "button2"); // (no output — once removed after first call)

console.log("\n=== PubSub ===");
const ps = createPubSub();
const unsub = ps.subscribe("news", (article) => console.log("News:", article));
ps.publish("news", "Breaking news!");   // News: Breaking news!
unsub();                                 // unsubscribe
ps.publish("news", "More news!");       // (no output)

---
```

<a id="javascript-array-manipulation"></a>
## 22_array_manipulation.js — QUESTION SET: Array Manipulation — Chunk, Unique, Intersection,

```javascript
/**
 * QUESTION SET: Array Manipulation — Chunk, Unique, Intersection,
 * Rotate, Shuffle, Zip, Matrix operations, Kadane's, and more.
 */

// ─────────────────────────────────────────────
// Q1. Chunk Array into groups of size n
// chunk([1,2,3,4,5], 2) → [[1,2],[3,4],[5]]
// ─────────────────────────────────────────────
function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ─────────────────────────────────────────────
// Q2. Get unique values (deduplicate)
// ─────────────────────────────────────────────
function unique(arr) {
  return [...new Set(arr)];
}

// Unique by key (for objects)
function uniqueBy(arr, fn) {
  const seen = new Set();
  return arr.filter((item) => {
    const key = fn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────
// Q3. Intersection of multiple arrays
// intersection([1,2,3], [2,3,4], [2,5]) → [2]
// ─────────────────────────────────────────────
function intersection(...arrays) {
  return arrays.reduce((acc, arr) => {
    const set = new Set(arr);
    return acc.filter((item) => set.has(item));
  });
}

// ─────────────────────────────────────────────
// Q4. Rotate Array by k positions (in-place)
// Input: [1,2,3,4,5,6,7], k=3 → [5,6,7,1,2,3,4]
// ─────────────────────────────────────────────
function rotateArray(nums, k) {
  const n = nums.length;
  k = k % n; // handle k > n

  function reverse(arr, start, end) {
    while (start < end) {
      [arr[start], arr[end]] = [arr[end], arr[start]];
      start++; end--;
    }
  }

  reverse(nums, 0, n - 1);     // reverse all
  reverse(nums, 0, k - 1);     // reverse first k
  reverse(nums, k, n - 1);     // reverse rest
  return nums;
}

// ─────────────────────────────────────────────
// Q5. Shuffle Array — Fisher-Yates Algorithm
// Unbiased O(n) shuffle
// ─────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────
// Q6. Matrix — Spiral Order traversal
// Input: [[1,2,3],[4,5,6],[7,8,9]] → [1,2,3,6,9,8,7,4,5]
// ─────────────────────────────────────────────
function spiralOrder(matrix) {
  const result = [];
  let top = 0, bottom = matrix.length - 1;
  let left = 0, right = matrix[0].length - 1;

  while (top <= bottom && left <= right) {
    for (let i = left; i <= right; i++) result.push(matrix[top][i]);
    top++;
    for (let i = top; i <= bottom; i++) result.push(matrix[i][right]);
    right--;
    if (top <= bottom) {
      for (let i = right; i >= left; i--) result.push(matrix[bottom][i]);
      bottom--;
    }
    if (left <= right) {
      for (let i = bottom; i >= top; i--) result.push(matrix[i][left]);
      left++;
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// Q7. Rotate Matrix 90° clockwise (in-place)
// ─────────────────────────────────────────────
function rotateMatrix(matrix) {
  const n = matrix.length;

  // Step 1: Transpose (flip over main diagonal)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      [matrix[i][j], matrix[j][i]] = [matrix[j][i], matrix[i][j]];
    }
  }

  // Step 2: Reverse each row
  for (let i = 0; i < n; i++) {
    matrix[i].reverse();
  }
  return matrix;
}

// ─────────────────────────────────────────────
// Q8. Set Matrix Zeroes
// If element is 0, set its entire row and column to 0
// ─────────────────────────────────────────────
function setZeroes(matrix) {
  const m = matrix.length, n = matrix[0].length;
  const rows = new Set(), cols = new Set();

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (matrix[i][j] === 0) { rows.add(i); cols.add(j); }
    }
  }
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (rows.has(i) || cols.has(j)) matrix[i][j] = 0;
    }
  }
  return matrix;
}

// ─────────────────────────────────────────────
// Q9. Product of Array Except Self
// Input: [1,2,3,4] → [24,12,8,6]  (no division allowed)
// ─────────────────────────────────────────────
function productExceptSelf(nums) {
  const n = nums.length;
  const result = new Array(n).fill(1);

  // Left pass: result[i] = product of all elements to the LEFT of i
  let leftProduct = 1;
  for (let i = 0; i < n; i++) {
    result[i] = leftProduct;
    leftProduct *= nums[i];
  }

  // Right pass: multiply by product of all elements to the RIGHT of i
  let rightProduct = 1;
  for (let i = n - 1; i >= 0; i--) {
    result[i] *= rightProduct;
    rightProduct *= nums[i];
  }
  return result;
}

// ─────────────────────────────────────────────
// Q10. Find duplicate in array [1..n] using Floyd's Cycle
// Array contains n+1 integers from 1 to n — exactly one duplicate
// ─────────────────────────────────────────────
function findDuplicate(nums) {
  // Treat array as linked list: nums[i] = next node
  let slow = nums[0];
  let fast = nums[0];

  do {
    slow = nums[slow];
    fast = nums[nums[fast]];
  } while (slow !== fast);

  slow = nums[0];
  while (slow !== fast) {
    slow = nums[slow];
    fast = nums[fast];
  }
  return slow;
}

// ─────────────────────────────────────────────
// Q11. Sort Array by Parity (evens before odds)
// ─────────────────────────────────────────────
function sortArrayByParity(nums) {
  let left = 0, right = nums.length - 1;
  while (left < right) {
    if (nums[left] % 2 === 1 && nums[right] % 2 === 0) {
      [nums[left], nums[right]] = [nums[right], nums[left]];
    }
    if (nums[left] % 2 === 0) left++;
    if (nums[right] % 2 === 1) right--;
  }
  return nums;
}

// ─────────────────────────────────────────────
// Q12. Merge Intervals
// Input: [[1,3],[2,6],[8,10],[15,18]] → [[1,6],[8,10],[15,18]]
// ─────────────────────────────────────────────
function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [intervals[0]];

  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    if (intervals[i][0] <= last[1]) {
      last[1] = Math.max(last[1], intervals[i][1]); // extend
    } else {
      merged.push(intervals[i]);
    }
  }
  return merged;
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== chunk ===");
console.log(chunk([1, 2, 3, 4, 5], 2));      // [[1,2],[3,4],[5]]

console.log("\n=== unique ===");
console.log(unique([1, 2, 2, 3, 3, 4]));     // [1,2,3,4]
console.log(uniqueBy(
  [{ id: 1, v: "a" }, { id: 1, v: "b" }, { id: 2, v: "c" }],
  (x) => x.id
)); // [{id:1,v:'a'},{id:2,v:'c'}]

console.log("\n=== intersection ===");
console.log(intersection([1, 2, 3], [2, 3, 4], [2, 5])); // [2]

console.log("\n=== rotateArray ===");
console.log(rotateArray([1, 2, 3, 4, 5, 6, 7], 3)); // [5,6,7,1,2,3,4]

console.log("\n=== spiralOrder ===");
console.log(spiralOrder([[1,2,3],[4,5,6],[7,8,9]])); // [1,2,3,6,9,8,7,4,5]

console.log("\n=== rotateMatrix ===");
const m = [[1,2,3],[4,5,6],[7,8,9]];
console.log(rotateMatrix(m)); // [[7,4,1],[8,5,2],[9,6,3]]

console.log("\n=== productExceptSelf ===");
console.log(productExceptSelf([1, 2, 3, 4])); // [24, 12, 8, 6]

console.log("\n=== findDuplicate ===");
console.log(findDuplicate([1, 3, 4, 2, 2])); // 2
console.log(findDuplicate([3, 1, 3, 4, 2])); // 3

console.log("\n=== mergeIntervals ===");
console.log(mergeIntervals([[1,3],[2,6],[8,10],[15,18]])); // [[1,6],[8,10],[15,18]]
console.log(mergeIntervals([[1,4],[4,5]]));                 // [[1,5]]

console.log("\n=== sortByParity ===");
console.log(sortArrayByParity([3, 1, 2, 4])); // evens first: [2,4,1,3] or [4,2,3,1]

---
```

<a id="javascript-string-questions"></a>
## 23_string_questions.js — QUESTION SET: String Manipulation

```javascript
/**
 * QUESTION SET: String Manipulation
 *
 * Very frequent in interviews — be comfortable with:
 * - String reversal, palindromes, anagrams
 * - Parsing, pattern matching, encoding/decoding
 * - Sliding window on strings
 */

// ─────────────────────────────────────────────
// Q1. Reverse a string (4 ways)
// ─────────────────────────────────────────────
const reverseStr = (s) => s.split("").reverse().join("");
const reverseStr2 = (s) => [...s].reduceRight((acc, ch) => acc + ch, "");
function reverseStr3(s) {
  let result = "";
  for (let i = s.length - 1; i >= 0; i--) result += s[i];
  return result;
}

// ─────────────────────────────────────────────
// Q2. Check if anagram
// Input: "listen", "silent" → true
// ─────────────────────────────────────────────
function isAnagram(s, t) {
  if (s.length !== t.length) return false;
  const count = {};
  for (const ch of s) count[ch] = (count[ch] || 0) + 1;
  for (const ch of t) {
    if (!count[ch]) return false;
    count[ch]--;
  }
  return true;
}

// ─────────────────────────────────────────────
// Q3. Reverse words in a sentence
// Input: "  hello world  " → "world hello"
// ─────────────────────────────────────────────
function reverseWords(s) {
  return s.trim().split(/\s+/).reverse().join(" ");
}

// ─────────────────────────────────────────────
// Q4. Valid palindrome (ignore non-alphanumeric, case-insensitive)
// Input: "A man, a plan, a canal: Panama" → true
// ─────────────────────────────────────────────
function isPalindromeStr(s) {
  const cleaned = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  let left = 0, right = cleaned.length - 1;
  while (left < right) {
    if (cleaned[left++] !== cleaned[right--]) return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Q5. Count and Say sequence
// "1" → "11" → "21" → "1211" → "111221"
// ─────────────────────────────────────────────
function countAndSay(n) {
  let result = "1";
  for (let i = 1; i < n; i++) {
    let next = "";
    let count = 1;
    for (let j = 1; j <= result.length; j++) {
      if (result[j] === result[j - 1]) {
        count++;
      } else {
        next += count + result[j - 1];
        count = 1;
      }
    }
    result = next;
  }
  return result;
}

// ─────────────────────────────────────────────
// Q6. Longest Common Prefix
// Input: ["flower","flow","flight"] → "fl"
// ─────────────────────────────────────────────
function longestCommonPrefix(strs) {
  if (!strs.length) return "";
  let prefix = strs[0];
  for (let i = 1; i < strs.length; i++) {
    while (!strs[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1); // shrink
      if (!prefix) return "";
    }
  }
  return prefix;
}

// ─────────────────────────────────────────────
// Q7. String compression
// "aabcccdddd" → "a2b1c3d4"
// If compressed is not smaller, return original
// ─────────────────────────────────────────────
function compressString(s) {
  let result = "";
  let count = 1;
  for (let i = 1; i <= s.length; i++) {
    if (s[i] === s[i - 1]) {
      count++;
    } else {
      result += s[i - 1] + count;
      count = 1;
    }
  }
  return result.length < s.length ? result : s;
}

// ─────────────────────────────────────────────
// Q8. Run-Length Encoding / Decoding
// Encode: "aaabbbcc" → "3a3b2c"
// Decode: "3a3b2c" → "aaabbbcc"
// ─────────────────────────────────────────────
function encode(s) {
  return s.replace(/(.)\1*/g, (match, ch) => match.length + ch);
}

function decode(s) {
  return s.replace(/(\d+)(.)/g, (_, count, ch) => ch.repeat(Number(count)));
}

// ─────────────────────────────────────────────
// Q9. Roman to Integer
// ─────────────────────────────────────────────
function romanToInt(s) {
  const map = { I:1, V:5, X:10, L:50, C:100, D:500, M:1000 };
  let result = 0;
  for (let i = 0; i < s.length; i++) {
    const val = map[s[i]];
    const next = map[s[i + 1]];
    result += (next && val < next) ? -val : val;
  }
  return result;
}

// Q9b. Integer to Roman
function intToRoman(num) {
  const vals  = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms  = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];
  let result = "";
  for (let i = 0; i < vals.length; i++) {
    while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
  }
  return result;
}

// ─────────────────────────────────────────────
// Q10. Valid Parentheses (all bracket types)
// ─────────────────────────────────────────────
function isValidBrackets(s) {
  const stack = [];
  const map = { ")": "(", "}": "{", "]": "[" };
  for (const ch of s) {
    if ("({[".includes(ch)) stack.push(ch);
    else if (stack.pop() !== map[ch]) return false;
  }
  return stack.length === 0;
}

// ─────────────────────────────────────────────
// Q11. Zigzag string
// "PAYPALISHIRING" with numRows=3 →
//   P   A   H   N
//   A P L S I I G
//   Y   I   R
// → "PAHNAPLSIIGYIR"
// ─────────────────────────────────────────────
function zigzagConvert(s, numRows) {
  if (numRows === 1 || numRows >= s.length) return s;
  const rows = Array.from({ length: numRows }, () => "");
  let row = 0, goingDown = false;

  for (const ch of s) {
    rows[row] += ch;
    if (row === 0 || row === numRows - 1) goingDown = !goingDown;
    row += goingDown ? 1 : -1;
  }
  return rows.join("");
}

// ─────────────────────────────────────────────
// Q12. Word Break — can string be segmented using dictionary words?
// Input: "leetcode", ["leet","code"] → true
// ─────────────────────────────────────────────
function wordBreak(s, wordDict) {
  const wordSet = new Set(wordDict);
  const dp = new Array(s.length + 1).fill(false);
  dp[0] = true;

  for (let i = 1; i <= s.length; i++) {
    for (let j = 0; j < i; j++) {
      if (dp[j] && wordSet.has(s.slice(j, i))) {
        dp[i] = true;
        break;
      }
    }
  }
  return dp[s.length];
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== Reverse String ===");
console.log(reverseStr("hello"));    // olleh
console.log(reverseStr3("world"));   // dlrow

console.log("\n=== Anagram ===");
console.log(isAnagram("listen", "silent")); // true
console.log(isAnagram("rat", "car"));       // false

console.log("\n=== Reverse Words ===");
console.log(reverseWords("  hello world  ")); // "world hello"

console.log("\n=== Valid Palindrome ===");
console.log(isPalindromeStr("A man, a plan, a canal: Panama")); // true
console.log(isPalindromeStr("race a car")); // false

console.log("\n=== Count and Say ===");
console.log(countAndSay(5)); // "111221"

console.log("\n=== Longest Common Prefix ===");
console.log(longestCommonPrefix(["flower","flow","flight"])); // "fl"
console.log(longestCommonPrefix(["dog","racecar","car"]));    // ""

console.log("\n=== Compress String ===");
console.log(compressString("aabcccdddd")); // "a2b1c3d4"
console.log(compressString("abc"));        // "abc" (no compression benefit)

console.log("\n=== Run-Length Encoding ===");
console.log(encode("aaabbbcc")); // "3a3b2c"
console.log(decode("3a3b2c"));   // "aaabbbcc"

console.log("\n=== Roman Numerals ===");
console.log(romanToInt("MCMXCIV")); // 1994
console.log(intToRoman(1994));      // MCMXCIV

console.log("\n=== Zigzag ===");
console.log(zigzagConvert("PAYPALISHIRING", 3)); // PAHNAPLSIIGYIR

console.log("\n=== Word Break ===");
console.log(wordBreak("leetcode", ["leet", "code"])); // true
console.log(wordBreak("catsandog", ["cats","dog","sand","and","cat"])); // false

---
```

<a id="javascript-weakmap-weakset-symbol-proxy"></a>
## 24_weakmap_weakset_symbol_proxy.js — QUESTION SET: WeakMap, WeakSet, Symbol, Proxy, Reflect

```javascript
/**
 * QUESTION SET: WeakMap, WeakSet, Symbol, Proxy, Reflect
 *
 * These are advanced JS features that appear in senior interviews.
 */

// ─────────────────────────────────────────────
// WEAKMAP
// Keys MUST be objects. Not enumerable. GC-friendly.
// Use: private data per instance, DOM node metadata, caching
// ─────────────────────────────────────────────

// Q1. Private class fields using WeakMap
const _private = new WeakMap();

class BankAccount {
  constructor(owner, balance) {
    _private.set(this, { balance, owner }); // private per instance
  }

  deposit(amount) {
    _private.get(this).balance += amount;
    return this;
  }

  withdraw(amount) {
    const data = _private.get(this);
    if (amount > data.balance) throw new Error("Insufficient funds");
    data.balance -= amount;
    return this;
  }

  getBalance() {
    return _private.get(this).balance;
  }

  getOwner() {
    return _private.get(this).owner;
  }
}

// Q2. Memoization using WeakMap (object keys)
function memoizeObject(fn) {
  const cache = new WeakMap();
  return function (obj) {
    if (cache.has(obj)) return cache.get(obj);
    const result = fn(obj);
    cache.set(obj, result);
    return result;
  };
}

// ─────────────────────────────────────────────
// WEAKSET
// Stores objects only. No iteration. GC-friendly.
// Use: tracking visited nodes, marking processed objects
// ─────────────────────────────────────────────

// Q3. Detect circular references using WeakSet
function hasCircularReference(obj) {
  const seen = new WeakSet();

  function detect(value) {
    if (value !== null && typeof value === "object") {
      if (seen.has(value)) return true;
      seen.add(value);
      for (const key of Object.keys(value)) {
        if (detect(value[key])) return true;
      }
      seen.delete(value); // backtrack — only circular if exact cycle
    }
    return false;
  }
  return detect(obj);
}

// Q4. Track which objects have been processed
function processItems(items) {
  const processed = new WeakSet();

  return {
    process(item) {
      if (processed.has(item)) return "already processed";
      processed.add(item);
      return "processed: " + item.name;
    },
  };
}

// ─────────────────────────────────────────────
// SYMBOL
// Unique, immutable primitive. Used for unique keys,
// well-known symbols (Symbol.iterator, Symbol.toPrimitive, etc.)
// ─────────────────────────────────────────────

// Q5. Create unique property keys with Symbol
const ID = Symbol("id");
const ROLE = Symbol("role");

const user = {
  name: "Alice",
  [ID]: 12345,     // hidden from JSON.stringify and for..in
  [ROLE]: "admin",
};

// Symbol keys are NOT enumerable — they won't show in:
// Object.keys(), JSON.stringify(), for...in loops
// But appear in: Object.getOwnPropertySymbols()

// Q6. Implement Symbol.iterator — make object iterable
class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  [Symbol.iterator]() {
    let current = this.start;
    const end = this.end;
    return {
      next() {
        return current <= end
          ? { value: current++, done: false }
          : { value: undefined, done: true };
      },
    };
  }
}

// Q7. Custom Symbol.toPrimitive — control type coercion
class Temperature {
  constructor(celsius) {
    this.celsius = celsius;
  }

  [Symbol.toPrimitive](hint) {
    if (hint === "number") return this.celsius;
    if (hint === "string") return `${this.celsius}°C`;
    return this.celsius; // default
  }
}

// ─────────────────────────────────────────────
// PROXY
// Intercepts object operations: get, set, has, deleteProperty, apply
// Use: validation, logging, reactive systems (Vue 3's reactivity)
// ─────────────────────────────────────────────

// Q8. Validation Proxy
function createValidatedObject(target, validators) {
  return new Proxy(target, {
    set(obj, prop, value) {
      if (validators[prop] && !validators[prop](value)) {
        throw new TypeError(`Invalid value for ${prop}: ${value}`);
      }
      obj[prop] = value;
      return true;
    },
  });
}

// Q9. Read-only Proxy (freeze but recursive)
function readOnly(obj) {
  return new Proxy(obj, {
    set() { throw new TypeError("Object is read-only"); },
    deleteProperty() { throw new TypeError("Cannot delete from read-only object"); },
    get(target, prop) {
      const val = target[prop];
      return typeof val === "object" && val !== null ? readOnly(val) : val;
    },
  });
}

// Q10. Logging/Observing Proxy
function observable(target, onChange) {
  return new Proxy(target, {
    set(obj, prop, value) {
      const oldValue = obj[prop];
      obj[prop] = value;
      onChange(prop, oldValue, value);
      return true;
    },
  });
}

// Q11. Proxy with default value for missing keys
function withDefaults(target, defaultValue) {
  return new Proxy(target, {
    get(obj, prop) {
      return prop in obj ? obj[prop] : defaultValue;
    },
  });
}

// ─────────────────────────────────────────────
// REFLECT
// Mirror of Proxy traps — same operations, but as functions.
// Used inside Proxy handlers to perform the default behavior.
// ─────────────────────────────────────────────

// Q12. Proxy + Reflect (correct pattern)
function createLoggingProxy(target) {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      console.log(`GET: ${String(prop)}`);
      return Reflect.get(obj, prop, receiver); // delegate properly
    },
    set(obj, prop, value, receiver) {
      console.log(`SET: ${String(prop)} = ${value}`);
      return Reflect.set(obj, prop, value, receiver);
    },
  });
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== WeakMap — BankAccount ===");
const acc = new BankAccount("Alice", 1000);
acc.deposit(500).withdraw(200);
console.log(acc.getBalance()); // 1300
console.log(acc.getOwner());   // Alice

console.log("\n=== WeakSet — Circular Reference ===");
const safe = { a: 1, b: { c: 2 } };
const circular = { a: 1 };
circular.self = circular;
console.log(hasCircularReference(safe));     // false
console.log(hasCircularReference(circular)); // true

console.log("\n=== Symbol keys ===");
console.log(user.name);     // Alice
console.log(user[ID]);      // 12345
console.log(user[ROLE]);    // admin
console.log(Object.keys(user)); // ['name'] — symbols hidden

console.log("\n=== Symbol.iterator — Range ===");
const range = new Range(1, 5);
console.log([...range]);    // [1, 2, 3, 4, 5]
for (const n of range) process.stdout.write(n + " ");
console.log();

console.log("\n=== Symbol.toPrimitive ===");
const temp = new Temperature(100);
console.log(+temp);         // 100 (number hint)
console.log(`${temp}`);     // 100°C (string hint)
console.log(temp + 0);      // 100 (default hint)

console.log("\n=== Validation Proxy ===");
const person = createValidatedObject({}, {
  age: (v) => typeof v === "number" && v >= 0 && v <= 150,
  name: (v) => typeof v === "string" && v.length > 0,
});
person.name = "Bob";
person.age = 25;
console.log(person); // { name: 'Bob', age: 25 }
try {
  person.age = -5;
} catch (e) {
  console.log(e.message); // Invalid value for age: -5
}

console.log("\n=== Observable Proxy ===");
const state = observable({ count: 0 }, (prop, oldVal, newVal) => {
  console.log(`${prop}: ${oldVal} → ${newVal}`);
});
state.count = 1; // count: 0 → 1
state.count = 2; // count: 1 → 2

console.log("\n=== Default Values Proxy ===");
const obj = withDefaults({ a: 1 }, 0);
console.log(obj.a);    // 1
console.log(obj.z);    // 0 (default)

---
```

<a id="javascript-heap-priority-queue"></a>
## 25_heap_priority_queue.js — QUESTION SET: Heap / Priority Queue

```javascript
/**
 * QUESTION SET: Heap / Priority Queue
 *
 * A Heap is a complete binary tree satisfying:
 *   Min-Heap: parent ≤ children (root = minimum)
 *   Max-Heap: parent ≥ children (root = maximum)
 *
 * Stored as array: for node at index i:
 *   parent:       Math.floor((i - 1) / 2)
 *   left child:   2 * i + 1
 *   right child:  2 * i + 2
 *
 * Operations:
 *   insert:    O(log n)
 *   extractMin/Max: O(log n)
 *   peek:      O(1)
 *   heapify:   O(n)
 */

// ─────────────────────────────────────────────
// Q1. Min-Heap Implementation
// ─────────────────────────────────────────────
class MinHeap {
  constructor() {
    this.heap = [];
  }

  get size() { return this.heap.length; }
  peek() { return this.heap[0]; }

  // Insert — add to end, bubble up
  insert(val) {
    this.heap.push(val);
    this._bubbleUp(this.heap.length - 1);
  }

  // Extract minimum (root) — replace with last, sift down
  extractMin() {
    if (!this.size) return null;
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.size > 0) {
      this.heap[0] = last;
      this._siftDown(0);
    }
    return min;
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.heap[parent] <= this.heap[idx]) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }

  _siftDown(idx) {
    const n = this.size;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < n && this.heap[left] < this.heap[smallest]) smallest = left;
      if (right < n && this.heap[right] < this.heap[smallest]) smallest = right;
      if (smallest === idx) break;
      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
      idx = smallest;
    }
  }
}

// ─────────────────────────────────────────────
// Q2. Max-Heap Implementation
// ─────────────────────────────────────────────
class MaxHeap {
  constructor() { this.heap = []; }
  get size() { return this.heap.length; }
  peek() { return this.heap[0]; }

  insert(val) {
    this.heap.push(val);
    this._bubbleUp(this.heap.length - 1);
  }

  extractMax() {
    if (!this.size) return null;
    const max = this.heap[0];
    const last = this.heap.pop();
    if (this.size > 0) { this.heap[0] = last; this._siftDown(0); }
    return max;
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.heap[parent] >= this.heap[idx]) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }

  _siftDown(idx) {
    const n = this.size;
    while (true) {
      let largest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < n && this.heap[left] > this.heap[largest]) largest = left;
      if (right < n && this.heap[right] > this.heap[largest]) largest = right;
      if (largest === idx) break;
      [this.heap[idx], this.heap[largest]] = [this.heap[largest], this.heap[idx]];
      idx = largest;
    }
  }
}

// ─────────────────────────────────────────────
// Q3. Priority Queue (generic comparator)
// ─────────────────────────────────────────────
class PriorityQueue {
  constructor(comparator = (a, b) => a - b) {
    this.heap = [];
    this.comparator = comparator; // negative = a has higher priority
  }

  get size() { return this.heap.length; }
  peek() { return this.heap[0]; }

  enqueue(val) {
    this.heap.push(val);
    this._bubbleUp(this.heap.length - 1);
  }

  dequeue() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.size > 0) { this.heap[0] = last; this._siftDown(0); }
    return top;
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.comparator(this.heap[parent], this.heap[idx]) <= 0) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }

  _siftDown(idx) {
    const n = this.size;
    while (true) {
      let best = idx;
      const l = 2 * idx + 1, r = 2 * idx + 2;
      if (l < n && this.comparator(this.heap[l], this.heap[best]) < 0) best = l;
      if (r < n && this.comparator(this.heap[r], this.heap[best]) < 0) best = r;
      if (best === idx) break;
      [this.heap[idx], this.heap[best]] = [this.heap[best], this.heap[idx]];
      idx = best;
    }
  }
}

// ─────────────────────────────────────────────
// Q4. Kth Largest Element in Array
// Input: [3,2,1,5,6,4], k=2 → Output: 5
// Use Min-Heap of size k: O(n log k)
// ─────────────────────────────────────────────
function findKthLargest(nums, k) {
  const minHeap = new MinHeap();
  for (const num of nums) {
    minHeap.insert(num);
    if (minHeap.size > k) minHeap.extractMin(); // keep only k largest
  }
  return minHeap.peek(); // root is kth largest
}

// ─────────────────────────────────────────────
// Q5. Top K Frequent Elements
// Input: [1,1,1,2,2,3], k=2 → Output: [1,2]
// ─────────────────────────────────────────────
function topKFrequent(nums, k) {
  const freq = new Map();
  for (const n of nums) freq.set(n, (freq.get(n) || 0) + 1);

  // Min-heap by frequency
  const pq = new PriorityQueue((a, b) => a[1] - b[1]);
  for (const [num, count] of freq) {
    pq.enqueue([num, count]);
    if (pq.size > k) pq.dequeue(); // remove least frequent
  }

  const result = [];
  while (pq.size) result.push(pq.dequeue()[0]);
  return result.reverse(); // most frequent first
}

// ─────────────────────────────────────────────
// Q6. Merge K Sorted Arrays using Min-Heap
// ─────────────────────────────────────────────
function mergeKSortedArrays(arrays) {
  const pq = new PriorityQueue((a, b) => a[0] - b[0]); // [value, arrayIdx, elementIdx]
  const result = [];

  // Initialize with first element of each array
  for (let i = 0; i < arrays.length; i++) {
    if (arrays[i].length > 0) {
      pq.enqueue([arrays[i][0], i, 0]);
    }
  }

  while (pq.size) {
    const [val, arrIdx, elemIdx] = pq.dequeue();
    result.push(val);
    if (elemIdx + 1 < arrays[arrIdx].length) {
      pq.enqueue([arrays[arrIdx][elemIdx + 1], arrIdx, elemIdx + 1]);
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// Q7. Find Median from Data Stream
// Use two heaps: max-heap for lower half, min-heap for upper half
// ─────────────────────────────────────────────
class MedianFinder {
  constructor() {
    this.lower = new MaxHeap(); // lower half numbers
    this.upper = new MinHeap(); // upper half numbers
  }

  addNum(num) {
    this.lower.insert(num);

    // Balance: ensure all lower values ≤ all upper values
    if (this.upper.size > 0 && this.lower.peek() > this.upper.peek()) {
      this.upper.insert(this.lower.extractMax());
    }

    // Balance sizes: lower can be at most 1 more than upper
    if (this.lower.size > this.upper.size + 1) {
      this.upper.insert(this.lower.extractMax());
    } else if (this.upper.size > this.lower.size) {
      this.lower.insert(this.upper.extractMin());
    }
  }

  findMedian() {
    if (this.lower.size > this.upper.size) return this.lower.peek();
    return (this.lower.peek() + this.upper.peek()) / 2;
  }
}

// ─────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────
console.log("=== Min-Heap ===");
const minH = new MinHeap();
[5, 3, 8, 1, 4, 7].forEach((n) => minH.insert(n));
console.log(minH.peek());        // 1
console.log(minH.extractMin());  // 1
console.log(minH.extractMin());  // 3
console.log(minH.extractMin());  // 4

console.log("\n=== Max-Heap ===");
const maxH = new MaxHeap();
[5, 3, 8, 1, 4, 7].forEach((n) => maxH.insert(n));
console.log(maxH.peek());        // 8
console.log(maxH.extractMax());  // 8
console.log(maxH.extractMax());  // 7

console.log("\n=== Kth Largest ===");
console.log(findKthLargest([3, 2, 1, 5, 6, 4], 2)); // 5
console.log(findKthLargest([3, 2, 3, 1, 2, 4, 5, 5, 6], 4)); // 4

console.log("\n=== Top K Frequent ===");
console.log(topKFrequent([1, 1, 1, 2, 2, 3], 2)); // [1, 2]
console.log(topKFrequent([1], 1)); // [1]

console.log("\n=== Merge K Sorted Arrays ===");
console.log(mergeKSortedArrays([[1,4,7],[2,5,8],[3,6,9]])); // [1,2,3,4,5,6,7,8,9]

console.log("\n=== Median Finder ===");
const mf = new MedianFinder();
mf.addNum(1); mf.addNum(2);
console.log(mf.findMedian()); // 1.5
mf.addNum(3);
console.log(mf.findMedian()); // 2
mf.addNum(4);
console.log(mf.findMedian()); // 2.5

---
```

<a id="javascript-theory-interview-qa"></a>
## FILE: 26_theory_interview_qa.js

```javascript
/*
=============================================================
  JAVASCRIPT THEORY — INTERVIEW Q&A
  Basic → Intermediate → Advanced
  For 7+ years experience
=============================================================
*/

// ─────────────────────────────────────────────────────────
// ██ SECTION 1: BASIC
// ─────────────────────────────────────────────────────────

/*
Q1 [BASIC]: What is the difference between var, let, and const?
─────────────────────────────────────────────────────────────
A:
  var  → function-scoped, hoisted WITH initialization to undefined, re-declarable
  let  → block-scoped, hoisted WITHOUT initialization (TDZ), not re-declarable
  const→ block-scoped, must initialize, binding is immutable (but object contents are mutable)
*/
{
  console.log(x); // undefined  ← var hoisted, initialized to undefined
  var x = 5;

  // console.log(y); // ReferenceError: Cannot access 'y' before initialization
  let y = 10;       // ← TDZ from block start until this line

  const obj = { a: 1 };
  obj.a = 2;        // ✅ object contents CAN change
  // obj = {};      // ❌ TypeError: Assignment to constant variable
}

/*
Q2 [BASIC]: What is Hoisting?
─────────────────────────────
A: JavaScript moves (hoists) declarations to the top of their scope during compilation.
   - var: hoisted and initialized to undefined
   - function declarations: fully hoisted (can call before the definition)
   - let/const: hoisted but NOT initialized → TDZ until the line is reached
   - class: hoisted but NOT initialized → TDZ
*/
greet("Alice"); // ✅ works — function declaration is fully hoisted

function greet(name) {
  return `Hello, ${name}`;
}

// sayHi("Bob"); // ❌ TypeError: sayHi is not a function
var sayHi = function(name) { return `Hi, ${name}`; }; // function EXPRESSION — only var is hoisted

/*
Q3 [BASIC]: How does the Prototype Chain work?
───────────────────────────────────────────────
A: Every object has an internal [[Prototype]] link pointing to another object.
   Property lookup walks up the chain until found or null is reached.
*/
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function() {
  return `${this.name} makes a sound`;
};

const dog = new Animal("Rex");
// Lookup chain: dog → Animal.prototype → Object.prototype → null
console.log(dog.speak());                      // "Rex makes a sound" — found on Animal.prototype
console.log(Object.getPrototypeOf(dog) === Animal.prototype); // true

// Class syntax is syntactic sugar over prototype chain:
class Cat {
  constructor(name) { this.name = name; }
  speak() { return `${this.name} meows`; }
}
// Cat.prototype.speak exists — same mechanism under the hood

/*
Q4 [BASIC]: Explain Closures with a real-world example.
───────────────────────────────────────────────────────
A: A closure is a function that "remembers" the variables from the scope where it was DEFINED,
   even after that outer function has returned.
   The function closes over the variables — hence "closure".
*/
function makeCounter(start = 0) {
  let count = start;                    // ← this variable is "closed over"
  return {
    increment() { return ++count; },
    decrement() { return --count; },
    value()     { return count; },
  };
}

const c1 = makeCounter(0);
const c2 = makeCounter(100);
c1.increment(); c1.increment();
c2.decrement();
console.log(c1.value()); // 2    — c1 and c2 have their own independent `count`
console.log(c2.value()); // 99

// Classic closure bug in loops (pre-ES6):
const fns = [];
for (var i = 0; i < 3; i++) {
  fns.push(() => console.log(i)); // all share the SAME `i` variable
}
fns.forEach(f => f()); // prints 3, 3, 3 — NOT 0, 1, 2

// Fix 1: use let (creates a new binding per iteration)
const fns2 = [];
for (let j = 0; j < 3; j++) {
  fns2.push(() => console.log(j));
}
fns2.forEach(f => f()); // 0, 1, 2 ✅

// Fix 2: IIFE to capture value
const fns3 = [];
for (var k = 0; k < 3; k++) {
  fns3.push(((val) => () => console.log(val))(k));
}

/*
Q5 [BASIC]: What are the different values of `this`?
─────────────────────────────────────────────────────
A: `this` is determined by HOW a function is called (not where it's defined).
   - Global context: window (browser) | global (Node) | undefined (strict mode)
   - Method call: obj.method() → `this` = obj
   - Constructor: new Fn() → `this` = new object
   - Arrow function: lexically inherits `this` from surrounding scope (no own `this`)
   - Explicit: call/apply/bind override `this`
*/
const person = {
  name: "Alice",
  greet() { return `Hi I'm ${this.name}`; },           // this = person
  greetArrow: () => `Hi I'm ${this?.name}`,            // this = outer scope (undefined/window)
  greetLate() {
    setTimeout(function() {
      // this = window/undefined (regular function passed as callback loses context)
    }, 0);
    setTimeout(() => {
      // this = person (arrow captures person's `this`)
    }, 0);
  },
};

// ─────────────────────────────────────────────────────────
// ██ SECTION 2: INTERMEDIATE
// ─────────────────────────────────────────────────────────

/*
Q6 [INTERMEDIATE]: Microtask vs Macrotask queue — what is the exact execution order?
────────────────────────────────────────────────────────────────────────────────────
A: After each macrotask, ALL microtasks are drained before moving to the next macrotask.

   Macrotask queue: setTimeout, setInterval, setImmediate (Node), I/O callbacks
   Microtask queue: Promise.then/catch/finally, queueMicrotask, MutationObserver
   Node-specific: process.nextTick runs BEFORE all other microtasks
*/
console.log('1 - script start');       // sync

setTimeout(() => console.log('2 - setTimeout 0'), 0);   // macrotask

Promise.resolve()
  .then(() => console.log('3 - promise 1'))             // microtask
  .then(() => console.log('4 - promise 2'));             // microtask (chained)

queueMicrotask(() => console.log('5 - queueMicrotask')); // microtask

console.log('6 - script end');         // sync

// Output order: 1 → 6 → 3 → 5 → 4 → 2
// Why: sync runs first, then ALL microtasks (3, 5, then 4 from chained .then), finally macrotask (2)

/*
Q7 [INTERMEDIATE]: How do Generators work and when would you actually use them?
───────────────────────────────────────────────────────────────────────────────
A: Generators are pausable functions. `yield` suspends execution until `.next()` is called.
   Returns an iterator (has .next() returning { value, done }).
   Use cases: lazy infinite sequences, custom async control flow, implementing iterables.
*/
function* range(start, end, step = 1) {
  for (let i = start; i < end; i += step) {
    yield i;   // pause here and return i, resume on next .next() call
  }
}

console.log([...range(0, 10, 2)]); // [0, 2, 4, 6, 8]  — spread calls .next() repeatedly

// Generator for infinite sequence (lazy — only computes on demand)
function* fibonacci() {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}
const fib = fibonacci();
console.log([...Array(8)].map(() => fib.next().value)); // [0,1,1,2,3,5,8,13]

// Bidirectional communication via .next(value)
function* calculator() {
  const x = yield 'Enter x:';        // pause, return prompt; x receives next .next() arg
  const y = yield 'Enter y:';
  return x + y;
}
const calc = calculator();
calc.next();         // start, { value: 'Enter x:', done: false }
calc.next(5);        // send 5 → x=5, { value: 'Enter y:', done: false }
calc.next(3);        // send 3 → y=3, returns { value: 8, done: true }

/*
Q8 [INTERMEDIATE]: Explain the Proxy and Reflect API with a practical use case.
───────────────────────────────────────────────────────────────────────────────
A: Proxy wraps an object and intercepts fundamental operations (get, set, delete, etc.).
   Reflect provides the default implementations — always call Reflect.xxx inside traps
   to maintain correct behavior.
   Use cases: validation, logging, reactive state (Vue 3 reactivity uses Proxy), lazy-loading.
*/
function createValidator(target, schema) {
  return new Proxy(target, {
    set(obj, key, value, receiver) {
      if (schema[key] && !schema[key](value)) {
        throw new TypeError(`Invalid value "${value}" for property "${key}"`);
      }
      return Reflect.set(obj, key, value, receiver); // ← always use Reflect for default behavior
    },
    get(obj, key, receiver) {
      console.log(`Getting ${String(key)}`);
      return Reflect.get(obj, key, receiver);
    },
  });
}

const user = createValidator({}, {
  age: (v) => Number.isInteger(v) && v >= 0,
  name: (v) => typeof v === 'string' && v.length > 0,
});

user.name = "Alice"; // OK
user.age = 30;       // OK
// user.age = -5;    // TypeError: Invalid value "-5" for property "age"

/*
Q9 [INTERMEDIATE]: What is the Temporal Dead Zone (TDZ) and why was it introduced?
────────────────────────────────────────────────────────────────────────────────────
A: The TDZ is the period between entering the scope (block/function) and the actual
   declaration line. Accessing a let/const variable in TDZ throws ReferenceError.

   Why: `var` hoisting with `undefined` initialization is a source of subtle bugs.
   TDZ forces you to declare variables before using them — easier to reason about code flow.
*/
{
  // TDZ starts for `z` here
  // console.log(z); // ReferenceError: Cannot access 'z' before initialization
  typeof z;    // typeof does NOT throw for TDZ — special case (returns "undefined")
  let z = 5;   // TDZ ends here
}

// TDZ also applies in DEFAULT PARAMETER expressions:
function example(a = b, b = 1) {} // ReferenceError: `b` is in TDZ when `a` is evaluated

/*
Q10 [INTERMEDIATE]: How does WeakMap differ from Map, and when should you use it?
──────────────────────────────────────────────────────────────────────────────────
A: WeakMap: keys must be OBJECTS, holds WEAK references (key not prevented from GC),
            NOT iterable, no .size property.
   Map: any type as key, holds STRONG references (prevents GC), iterable, has .size.

   Use WeakMap when: you want to attach metadata to objects without preventing their
   garbage collection (e.g., caching DOM node data, per-object memoization caches,
   private class fields polyfill).
*/
const cache = new WeakMap();

function processNode(domNode) {
  if (cache.has(domNode)) return cache.get(domNode);
  const result = expensiveComputation(domNode);
  cache.set(domNode, result);  // when domNode is removed from DOM and GC'd, this entry disappears too
  return result;
}
// If you had used Map, the entry would stay forever → memory leak

function expensiveComputation(x) { return x; }

// ─────────────────────────────────────────────────────────
// ██ SECTION 3: ADVANCED
// ─────────────────────────────────────────────────────────

/*
Q11 [ADVANCED]: How does V8 optimize JavaScript? What are Hidden Classes and Inline Caching?
─────────────────────────────────────────────────────────────────────────────────────────────
A: V8 uses JIT (Just-In-Time) compilation. Key optimizations:

   HIDDEN CLASSES (Shapes):
   V8 creates an internal "shape" for each unique property layout of an object.
   Objects with the same shape can share compiled code and memory layout.
   → Add properties in the SAME ORDER always, and don't add/delete properties dynamically.

   INLINE CACHING (IC):
   At a call site like `obj.x`, V8 caches the shape + offset so the NEXT call
   is a direct memory read instead of a hash lookup.
   If the shape changes (polymorphic/megamorphic), the IC is invalidated → slow.
*/

// GOOD: V8 creates ONE shape for Point → highly optimized
class Point {
  constructor(x, y) {
    this.x = x;   // always add x first, then y
    this.y = y;
  }
}
const p1 = new Point(1, 2);
const p2 = new Point(3, 4);
// p1 and p2 share the same hidden class → IC hits → fast property access

// BAD: mixing shapes forces deoptimization
function makePoint(x, y, addZ = false) {
  const obj = { x, y };
  if (addZ) obj.z = 0;  // ← different shapes depending on addZ
  return obj;           // V8 sees polymorphic shapes → megamorphic → no IC → slow
}

// BAD: deleting properties
const obj2 = { a: 1, b: 2 };
delete obj2.a;   // shape transitions → slower
obj2.a = null;   // prefer null-out over delete (keeps shape)

/*
Q12 [ADVANCED]: What are common Memory Leak patterns in JavaScript and how do you detect them?
─────────────────────────────────────────────────────────────────────────────────────────────
A: Memory leaks = objects that are no longer needed but cannot be garbage-collected
   because something still holds a reference to them.

   Common patterns:
   1. Forgotten event listeners
   2. Closures holding large objects
   3. Global variable accretion
   4. Detached DOM nodes
   5. setInterval not cleared
*/

// LEAK 1: Forgotten event listeners
const button = { addEventListener: () => {} };
const handler = () => handleClick();
button.addEventListener('click', handler);
// If button is removed from DOM but handler references outer scope vars → leak
// Fix: removeEventListener when component unmounts

// LEAK 2: Accidental global via undeclared variable
function leaky() {
  // leakyGlobal = 'I live forever'; // ← no var/let/const → attaches to window
  // Fix: always declare; use 'use strict' which throws instead of creating global
}

// LEAK 3: setInterval holding reference
function startPolling() {
  const bigData = new Array(1_000_000).fill('data');
  const id = setInterval(() => {
    console.log(bigData.length); // closes over bigData → bigData never GC'd
  }, 1000);
  // Fix: clearInterval(id) when no longer needed
  return id;
}

// DETECTION:
// Chrome DevTools → Memory → Take Heap Snapshot, compare two snapshots
// Node.js: --inspect + clinic.js memwatch, or node --expose_gc + manual gc()
// Look for: growing "Detached HTMLElement" count, retained size, dominator tree

/*
Q13 [ADVANCED]: What is the difference between CommonJS (require) and ES Modules (import)?
──────────────────────────────────────────────────────────────────────────────────────────
A: Two completely different module systems that interact in complex ways.
*/

// CJS (CommonJS) — Node.js original:
// const path = require('path');     // synchronous, dynamic (can be in if block)
// module.exports = { foo };         // exports an object, live binding NOT preserved

// ESM (ES Modules) — standard:
// import { readFile } from 'fs/promises';   // static, analyzed at compile time
// export const foo = 1;                     // live binding — importers see updates
// export default function bar() {}

// Key differences:
// 1. CJS: synchronous require() — blocks thread; ESM: asynchronous (top-level await allowed)
// 2. CJS: `require()` can be in conditionals; ESM: imports are always top-level (static)
// 3. CJS: `exports` is a copy (not live); ESM: live bindings — if exporter changes the value, importer sees it
// 4. ESM: better tree-shaking because bundlers can statically analyze imports
// 5. CJS: `__dirname`, `__filename` built-ins; ESM: use import.meta.url instead

// Interop (requires careful handling):
// CJS importing ESM: only via dynamic import() → returns Promise
// ESM importing CJS: default import only (gets module.exports as default)

/*
Q14 [ADVANCED]: Explain tail call optimization (TCO) and why Node.js doesn't fully support it.
──────────────────────────────────────────────────────────────────────────────────────────────
A: TCO = if the LAST thing a function does is call another function (tail call),
   the current stack frame can be REUSED instead of stacking a new one.
   This makes recursion O(1) stack space instead of O(n).
*/

// Without TCO: stack grows with each call → stack overflow for large n
function factorialNaive(n) {
  if (n <= 1) return 1;
  return n * factorialNaive(n - 1); // ← NOT a tail call: must multiply AFTER recursive call returns
}

// Tail-call form: accumulator holds intermediate result
function factorialTCO(n, acc = 1) {
  if (n <= 1) return acc;
  return factorialTCO(n - 1, n * acc); // ← true tail call: nothing to do after the recursive call
}
// In theory V8 can optimize this — but it requires 'use strict' and is only implemented
// in Safari (JavaScriptCore). V8 removed TCO after initial implementation due to debuggability.
// Workaround in Node.js: explicit trampolining (loop instead of recursion)

function trampoline(fn) {
  return function(...args) {
    let result = fn(...args);
    while (typeof result === 'function') {
      result = result();   // call the thunk
    }
    return result;
  };
}

const factTrampolined = trampoline(function fact(n, acc = 1) {
  if (n <= 1) return acc;
  return () => fact(n - 1, n * acc);  // return thunk instead of recursive call
});

console.log(factTrampolined(100000)); // no stack overflow

/*
Q15 [ADVANCED]: What are Symbol, Symbol.iterator, and Symbol.toPrimitive used for?
────────────────────────────────────────────────────────────────────────────────────
A: Symbol is a unique, non-enumerable primitive.
   Well-known Symbols let you customize built-in behavior.
*/

// Custom iterable using Symbol.iterator
class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
  [Symbol.iterator]() {
    let current = this.start;
    const end = this.end;
    return {
      next() {
        if (current <= end) return { value: current++, done: false };
        return { value: undefined, done: true };
      },
    };
  }
}
console.log([...new Range(1, 5)]); // [1, 2, 3, 4, 5]

// Symbol.toPrimitive — controls how object converts to primitive
const price = {
  amount: 99,
  currency: 'USD',
  [Symbol.toPrimitive](hint) {
    if (hint === 'number') return this.amount;      // used in +price, Number(price)
    if (hint === 'string') return `${this.amount} ${this.currency}`; // used in template literals
    return this.amount; // 'default' hint (e.g., loose equality)
  },
};
console.log(+price);         // 99
console.log(`${price}`);     // "99 USD"
console.log(price + 10);     // 109

// Symbol as non-collision property keys for libraries:
const INTERNAL_ID = Symbol('internalId');
class Entity {
  constructor(id) {
    this[INTERNAL_ID] = id;    // won't appear in for..in, Object.keys, JSON.stringify
  }
  get id() { return this[INTERNAL_ID]; }
}

/*
Q16 [ADVANCED]: How does Promise.all, allSettled, any, and race actually differ
                in error handling and short-circuit behavior?
────────────────────────────────────────────────────────────────────────────────
A: All four accept an iterable of Promises and return a new Promise.
   The key difference is how they handle failures and when they settle.
*/
const p1Resolved = Promise.resolve(1);
const p2Rejected = Promise.reject(new Error('fail'));
const p3Resolved = Promise.resolve(3);

// Promise.all → resolves with array of all values; REJECTS IMMEDIATELY on first rejection
// Use: need ALL results, treat failure as critical
Promise.all([p1Resolved, p3Resolved]).then(([a, b]) => console.log(a, b)); // 1, 3
// Promise.all([p1, p2, p3]) → rejects with Error('fail'), p3 result is ignored

// Promise.allSettled → ALWAYS resolves; result is array of {status, value/reason}
// Use: need to see all outcomes even if some fail (bulk API calls, report all errors)
Promise.allSettled([p1Resolved, p2Rejected, p3Resolved]).then(results => {
  results.forEach(r => {
    if (r.status === 'fulfilled') console.log('✅', r.value);
    else console.log('❌', r.reason.message);
  });
});

// Promise.race → resolves/rejects with FIRST settled (fastest wins)
// Use: timeout pattern, take whichever cache/network response comes first
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), ms)
  );
  return Promise.race([promise, timeout]);
}

// Promise.any → resolves with FIRST fulfilled; only rejects if ALL reject (AggregateError)
// Use: try multiple sources (CDN mirrors), use first success
// Promise.any([fail1, fail2, success]) → resolves with success
// Promise.any([fail1, fail2]) → rejects with AggregateError containing all errors

/*
Q17 [ADVANCED]: Explain Structural Typing, duck typing, and object composition
                patterns used in large JS codebases.
────────────────────────────────────────────────────────────────────────────────
A: JS uses duck typing — if it walks like a duck and quacks like a duck, it is a duck.
   Large codebases prefer COMPOSITION over INHERITANCE to avoid the fragile base class problem.
*/

// Fragile base class problem with inheritance:
class Animal2 { eat() { return 'nom'; } }
class Dog2 extends Animal2 { bark() { return 'woof'; } }
class GoldenRetriever extends Dog2 { fetch() { return 'fetched!'; } }
// Changing Animal2 can silently break GoldenRetriever through all layers

// Composition with mixins (functional approach):
const canEat = (base) => ({
  ...base,
  eat: () => 'nom',
  hunger: 0,
});

const canBark = (base) => ({
  ...base,
  bark: () => 'woof',
});

const canFetch = (base) => ({
  ...base,
  fetch: () => 'fetched!',
});

// Compose behaviors:
const goldenRetriever = canFetch(canBark(canEat({ name: 'Buddy' })));
// Much more flexible — pick and mix behaviors without hierarchy

// Stampit / mixins pattern in real code:
function withLogger(obj) {
  return {
    ...obj,
    log(msg) { console.log(`[${obj.name || 'unknown'}] ${msg}`); },
  };
}

module.exports = {
  makeCounter,
  Range,
  Entity,
  factTrampolined,
  withTimeout,
  createValidator,
};

---
```

---


---

<a id="javascript-groupby-aggregate"></a>
## 27_groupby_aggregate.js — QUESTION SET: GroupBy, Aggregate, and Object Transformation

```javascript
// ─────────────────────────────────────────────────────────
// Q1. Group array items by a key and collect values into arrays
// ─────────────────────────────────────────────────────────
// Input:  [{ cat: 'a', val: 1 }, { cat: 'b', val: 2 }, { cat: 'a', val: 3 }]
// Output: { a: [1, 3], b: [2] }

function groupByKey(arr, keyFn, valueFn = x => x) {
  return arr.reduce((acc, item) => {
    const k = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
    const v = typeof valueFn === 'function' ? valueFn(item) : item[valueFn];
    if (!acc[k]) acc[k] = [];
    acc[k].push(v);
    return acc;
  }, {});
}

// Usage
const orders = [
  { category: 'fruit',  name: 'apple' },
  { category: 'veg',    name: 'carrot' },
  { category: 'fruit',  name: 'banana' },
  { category: 'veg',    name: 'broccoli' },
];
console.log(groupByKey(orders, 'category', 'name'));
// { fruit: ['apple', 'banana'], veg: ['carrot', 'broccoli'] }

// ─────────────────────────────────────────────────────────
// Q2. Merge objects with same key — combine duplicate keys into arrays
// ─────────────────────────────────────────────────────────
// Input:  [{ a: 1 }, { b: 2 }, { a: 3 }, { b: 4 }, { c: 5 }]
// Output: { a: [1, 3], b: [2, 4], c: [5] }

function mergeByKey(arr) {
  return arr.reduce((acc, obj) => {
    Object.entries(obj).forEach(([key, value]) => {
      if (!acc[key]) acc[key] = [];
      acc[key].push(value);
    });
    return acc;
  }, {});
}

console.log(mergeByKey([{ a: 1 }, { b: 2 }, { a: 3 }, { b: 4 }, { c: 5 }]));
// { a: [1, 3], b: [2, 4], c: [5] }

// ─────────────────────────────────────────────────────────
// Q3. Sum values for duplicate keys
// ─────────────────────────────────────────────────────────
// Input:  [{ key: 'a', val: 10 }, { key: 'b', val: 20 }, { key: 'a', val: 5 }]
// Output: { a: 15, b: 20 }

function sumByKey(arr, keyProp, valProp) {
  return arr.reduce((acc, item) => {
    const k = item[keyProp];
    acc[k] = (acc[k] || 0) + item[valProp];
    return acc;
  }, {});
}

// ─────────────────────────────────────────────────────────
// Q4. Count occurrences of each value in an array
// ─────────────────────────────────────────────────────────
// Input:  ['a', 'b', 'a', 'c', 'b', 'a']
// Output: { a: 3, b: 2, c: 1 }

const countOccurrences = arr =>
  arr.reduce((acc, val) => ({ ...acc, [val]: (acc[val] || 0) + 1 }), {});

// ─────────────────────────────────────────────────────────
// Q5. Invert an object — swap keys and values
// ─────────────────────────────────────────────────────────
// Input:  { a: 1, b: 2, c: 3 }
// Output: { 1: 'a', 2: 'b', 3: 'c' }

const invertObject = obj =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]));

// When values are not unique, collect keys into arrays:
function invertObjectMulti(obj) {
  return Object.entries(obj).reduce((acc, [k, v]) => {
    if (!acc[v]) acc[v] = [];
    acc[v].push(k);
    return acc;
  }, {});
}

// ─────────────────────────────────────────────────────────
// Q6. Flatten a nested object to dot-notation keys
// ─────────────────────────────────────────────────────────
// Input:  { a: { b: { c: 1 } }, d: 2 }
// Output: { 'a.b.c': 1, 'd': 2 }

function flattenObject(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [key, val]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(acc, flattenObject(val, fullKey));
    } else {
      acc[fullKey] = val;
    }
    return acc;
  }, {});
}

// ─────────────────────────────────────────────────────────
// Q7. Unflatten dot-notation keys back into a nested object
// ─────────────────────────────────────────────────────────
// Input:  { 'a.b.c': 1, 'd.e': 2, 'f': 3 }
// Output: { a: { b: { c: 1 } }, d: { e: 2 }, f: 3 }

function unflattenObject(flat) {
  return Object.entries(flat).reduce((acc, [key, val]) => {
    key.split('.').reduce((obj, part, i, arr) => {
      if (i === arr.length - 1) {
        obj[part] = val;
      } else {
        obj[part] = obj[part] || {};
      }
      return obj[part];
    }, acc);
    return acc;
  }, {});
}

// ─────────────────────────────────────────────────────────
// Q8. Deep merge two objects
// ─────────────────────────────────────────────────────────
// Nested objects are merged recursively; arrays are concatenated

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
      target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else if (Array.isArray(source[key]) && Array.isArray(target[key])) {
      result[key] = [...target[key], ...source[key]];
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────
// Q9. Pick / Omit specific keys from an object
// ─────────────────────────────────────────────────────────

const pick = (obj, keys) =>
  Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]));

const omit = (obj, keys) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

// ─────────────────────────────────────────────────────────
// Q10. Transform array of objects — re-shape keys (rename + filter)
// ─────────────────────────────────────────────────────────
// Input:  [{ userId: 1, firstName: 'Alice', age: 30, internal: 'x' }]
// Output: [{ id: 1, name: 'Alice' }]  (only id and name, renamed)

function transformArray(arr, mapping) {
  // mapping: { newKey: 'oldKey' }
  return arr.map(item =>
    Object.fromEntries(
      Object.entries(mapping).map(([newKey, oldKey]) => [newKey, item[oldKey]])
    )
  );
}

const users = [{ userId: 1, firstName: 'Alice', age: 30, internal: 'x' }];
console.log(transformArray(users, { id: 'userId', name: 'firstName' }));
// [{ id: 1, name: 'Alice' }]

// ─────────────────────────────────────────────────────────
// Q11. Find duplicates in an array of objects by a key
// ─────────────────────────────────────────────────────────
// Return only the objects where the key value appears more than once

function findDuplicatesByKey(arr, key) {
  const counts = arr.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
  return arr.filter(item => counts[item[key]] > 1);
}

// ─────────────────────────────────────────────────────────
// Q12. Zip two arrays into an array of key-value pair objects
// ─────────────────────────────────────────────────────────
// keys:   ['a', 'b', 'c']
// values: [1, 2, 3]
// Output: [{ key: 'a', value: 1 }, { key: 'b', value: 2 }, { key: 'c', value: 3 }]

const zipToObject = (keys, values) =>
  keys.reduce((acc, k, i) => ({ ...acc, [k]: values[i] }), {});

// ─────────────────────────────────────────────────────────
// Q13. Convert array of objects to a Map keyed by a property
// ─────────────────────────────────────────────────────────
// Useful for O(1) lookup: array → Map<id, object>

function arrayToMap(arr, key) {
  return new Map(arr.map(item => [item[key], item]));
}

const userMap = arrayToMap([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }], 'id');
console.log(userMap.get(1)); // { id: 1, name: 'Alice' }

// ─────────────────────────────────────────────────────────
// Q14. Object diff — find keys that changed between two objects
// ─────────────────────────────────────────────────────────
function objectDiff(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].reduce((diff, key) => {
    if (a[key] !== b[key]) {
      diff[key] = { from: a[key], to: b[key] };
    }
    return diff;
  }, {});
}

console.log(objectDiff(
  { name: 'Alice', age: 30, city: 'NY' },
  { name: 'Alice', age: 31, country: 'US' }
));
// { age: { from: 30, to: 31 }, city: { from: 'NY', to: undefined }, country: { from: undefined, to: 'US' } }
```

---

<a id="javascript-array-advanced"></a>
## 28_array_advanced.js — QUESTION SET: Advanced Array Patterns

```javascript
// ─────────────────────────────────────────────────────────
// Q1. Partition an array into two arrays based on a predicate
// ─────────────────────────────────────────────────────────
// Input:  [1, 2, 3, 4, 5, 6], isEven
// Output: [[2, 4, 6], [1, 3, 5]]

function partition(arr, predicate) {
  return arr.reduce(
    ([pass, fail], item) =>
      predicate(item) ? [[...pass, item], fail] : [pass, [...fail, item]],
    [[], []]
  );
}

const [evens, odds] = partition([1, 2, 3, 4, 5, 6], n => n % 2 === 0);

// ─────────────────────────────────────────────────────────
// Q2. Rotate an array left or right by k positions
// ─────────────────────────────────────────────────────────
function rotateRight(arr, k) {
  const n = arr.length;
  const offset = ((k % n) + n) % n; // handles negative k and k > n
  return [...arr.slice(n - offset), ...arr.slice(0, n - offset)];
}

console.log(rotateRight([1, 2, 3, 4, 5], 2)); // [4, 5, 1, 2, 3]
console.log(rotateRight([1, 2, 3, 4, 5], -1)); // [2, 3, 4, 5, 1]

// ─────────────────────────────────────────────────────────
// Q3. Zip multiple arrays together
// ─────────────────────────────────────────────────────────
// zip([1,2,3], ['a','b','c']) => [[1,'a'], [2,'b'], [3,'c']]

const zip = (...arrays) =>
  arrays[0].map((_, i) => arrays.map(arr => arr[i]));

// ─────────────────────────────────────────────────────────
// Q4. Generate all permutations of an array
// ─────────────────────────────────────────────────────────
function permutations(arr) {
  if (arr.length <= 1) return [arr];
  return arr.flatMap((item, i) =>
    permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map(p => [item, ...p])
  );
}

console.log(permutations([1, 2, 3]).length); // 6

// ─────────────────────────────────────────────────────────
// Q5. Generate all combinations (subsets) of size k
// ─────────────────────────────────────────────────────────
function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

// ─────────────────────────────────────────────────────────
// Q6. Transpose a 2D matrix
// ─────────────────────────────────────────────────────────
const transpose = matrix =>
  matrix[0].map((_, colIdx) => matrix.map(row => row[colIdx]));

console.log(transpose([[1,2,3],[4,5,6]])); // [[1,4],[2,5],[3,6]]

// ─────────────────────────────────────────────────────────
// Q7. Find the most frequent element
// ─────────────────────────────────────────────────────────
function mostFrequent(arr) {
  const freq = arr.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
  return Object.entries(freq).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

// ─────────────────────────────────────────────────────────
// Q8. Running total (prefix sum array)
// ─────────────────────────────────────────────────────────
const prefixSum = arr =>
  arr.reduce((acc, n) => [...acc, (acc.at(-1) ?? 0) + n], []);

console.log(prefixSum([1, 2, 3, 4])); // [1, 3, 6, 10]

// ─────────────────────────────────────────────────────────
// Q9. Find all pairs that sum to a target (Two Sum — return all pairs)
// ─────────────────────────────────────────────────────────
function allPairsWithSum(arr, target) {
  const seen = new Map();
  const pairs = [];
  for (const num of arr) {
    const complement = target - num;
    if (seen.has(complement)) {
      pairs.push([complement, num]);
    }
    seen.set(num, true);
  }
  return pairs;
}

console.log(allPairsWithSum([1, 2, 3, 4, 5, 6], 7)); // [[1,6],[2,5],[3,4]]

// ─────────────────────────────────────────────────────────
// Q10. Product of array excluding current index (no division)
// ─────────────────────────────────────────────────────────
// Input:  [1, 2, 3, 4]
// Output: [24, 12, 8, 6]   (each element is product of all others)

function productExceptSelf(arr) {
  const n = arr.length;
  const left  = Array(n).fill(1);
  const right = Array(n).fill(1);
  for (let i = 1; i < n; i++)     left[i]  = left[i - 1]  * arr[i - 1];
  for (let i = n - 2; i >= 0; i--) right[i] = right[i + 1] * arr[i + 1];
  return arr.map((_, i) => left[i] * right[i]);
}

// ─────────────────────────────────────────────────────────
// Q11. Chunk an array into pages and retrieve a specific page
// ─────────────────────────────────────────────────────────
function paginate(arr, pageSize, page) {
  const start = (page - 1) * pageSize;
  return arr.slice(start, start + pageSize);
}

// ─────────────────────────────────────────────────────────
// Q12. Deep flatten + dedupe + sort pipeline (compose pattern)
// ─────────────────────────────────────────────────────────
const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);

const processArray = pipe(
  arr => arr.flat(Infinity),
  arr => [...new Set(arr)],
  arr => arr.sort((a, b) => a - b)
);

console.log(processArray([[3, 1], [2, [1, 3]], 4])); // [1, 2, 3, 4]
```

---

<a id="javascript-promise-patterns"></a>
## 29_promise_patterns.js — QUESTION SET: Advanced Promise and Async Patterns

```javascript
// ─────────────────────────────────────────────────────────
// Q1. Sequential async processing (one at a time, ordered)
// ─────────────────────────────────────────────────────────
async function processSequentially(items, asyncFn) {
  const results = [];
  for (const item of items) {
    results.push(await asyncFn(item)); // awaits each before next
  }
  return results;
}

// ─────────────────────────────────────────────────────────
// Q2. Concurrent with a concurrency limit
// ─────────────────────────────────────────────────────────
// Process items in parallel but max N at a time (pool pattern)

async function pLimit(items, asyncFn, limit) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await asyncFn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Usage: fetch 100 URLs, max 5 at a time
// await pLimit(urls, fetchUrl, 5);

// ─────────────────────────────────────────────────────────
// Q3. Promise timeout — reject if not resolved within N ms
// ─────────────────────────────────────────────────────────
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// ─────────────────────────────────────────────────────────
// Q4. Retry with exponential back-off and jitter
// ─────────────────────────────────────────────────────────
async function retry(fn, { attempts = 3, delay = 300, factor = 2 } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      lastError = e;
      const wait = delay * Math.pow(factor, i) + Math.random() * 100;
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────────────
// Q5. Memoize an async function (cache by arguments)
// ─────────────────────────────────────────────────────────
function memoizeAsync(fn) {
  const cache = new Map();
  return async (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const promise = fn(...args);
    cache.set(key, promise); // cache the promise itself (handles concurrent calls)
    try {
      return await promise;
    } catch (e) {
      cache.delete(key); // don't cache failures
      throw e;
    }
  };
}

// ─────────────────────────────────────────────────────────
// Q6. Lazy Promise — only starts executing when first awaited
// ─────────────────────────────────────────────────────────
function lazy(fn) {
  let promise = null;
  return {
    then(...args) {
      if (!promise) promise = fn();
      return promise.then(...args);
    },
    catch(...args) {
      if (!promise) promise = fn();
      return promise.catch(...args);
    },
  };
}

// ─────────────────────────────────────────────────────────
// Q7. Async queue — process items one at a time with backpressure
// ─────────────────────────────────────────────────────────
class AsyncQueue {
  constructor() {
    this._queue = [];
    this._running = false;
  }
  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });
      if (!this._running) this._run();
    });
  }
  async _run() {
    this._running = true;
    while (this._queue.length) {
      const { fn, resolve, reject } = this._queue.shift();
      try { resolve(await fn()); } catch (e) { reject(e); }
    }
    this._running = false;
  }
}

// ─────────────────────────────────────────────────────────
// Q8. Observable-style event stream using async generators
// ─────────────────────────────────────────────────────────
async function* pollEndpoint(url, intervalMs) {
  while (true) {
    const res = await fetch(url);
    yield await res.json();
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

// Consume:
// for await (const data of pollEndpoint('/api/status', 5000)) {
//   console.log(data);
//   if (data.done) break;
// }

// ─────────────────────────────────────────────────────────
// Q9. Circuit Breaker pattern
// ─────────────────────────────────────────────────────────
class CircuitBreaker {
  constructor(fn, { threshold = 3, resetTimeout = 30_000 } = {}) {
    this.fn = fn;
    this.threshold = threshold;
    this.resetTimeout = resetTimeout;
    this.failures = 0;
    this.state = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
  }
  async call(...args) {
    if (this.state === 'OPEN') throw new Error('Circuit is OPEN');
    try {
      const result = await this.fn(...args);
      this._onSuccess();
      return result;
    } catch (e) {
      this._onFailure();
      throw e;
    }
  }
  _onSuccess() { this.failures = 0; this.state = 'CLOSED'; }
  _onFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      setTimeout(() => { this.state = 'HALF_OPEN'; this.failures = 0; }, this.resetTimeout);
    }
  }
}
```

---

<a id="javascript-design-patterns"></a>
## 30_design_patterns.js — QUESTION SET: Design Patterns in JavaScript

```javascript
// ─────────────────────────────────────────────────────────
// Q1. Singleton — ensure only one instance exists
// ─────────────────────────────────────────────────────────
class ConfigStore {
  static #instance = null;
  #config = {};

  static getInstance() {
    if (!ConfigStore.#instance) ConfigStore.#instance = new ConfigStore();
    return ConfigStore.#instance;
  }
  set(key, value) { this.#config[key] = value; }
  get(key) { return this.#config[key]; }
}

// Usage
const cfg1 = ConfigStore.getInstance();
const cfg2 = ConfigStore.getInstance();
console.log(cfg1 === cfg2); // true

// ─────────────────────────────────────────────────────────
// Q2. Observer / EventEmitter — pub-sub pattern
// ─────────────────────────────────────────────────────────
class EventEmitter {
  constructor() { this._events = {}; }

  on(event, listener) {
    (this._events[event] ??= []).push(listener);
    return () => this.off(event, listener); // returns unsubscribe
  }
  off(event, listener) {
    this._events[event] = (this._events[event] || []).filter(l => l !== listener);
  }
  emit(event, ...args) {
    (this._events[event] || []).forEach(l => l(...args));
  }
  once(event, listener) {
    const wrapper = (...args) => { listener(...args); this.off(event, wrapper); };
    this.on(event, wrapper);
  }
}

// ─────────────────────────────────────────────────────────
// Q3. Strategy — swap algorithms at runtime
// ─────────────────────────────────────────────────────────
class Sorter {
  constructor(strategy) { this.strategy = strategy; }
  sort(data) { return this.strategy(data); }
}

const bubbleSort  = arr => { /* ... */ return arr; };
const nativeSort  = arr => [...arr].sort((a, b) => a - b);

const sorter = new Sorter(nativeSort);
sorter.strategy = bubbleSort; // swap strategy at runtime

// ─────────────────────────────────────────────────────────
// Q4. Decorator pattern (without TS decorators) — wrap a function
// ─────────────────────────────────────────────────────────
function withLogging(fn) {
  return function(...args) {
    console.log(`Calling ${fn.name} with`, args);
    const result = fn.apply(this, args);
    console.log(`${fn.name} returned`, result);
    return result;
  };
}

function withTiming(fn) {
  return function(...args) {
    const t = performance.now();
    const result = fn.apply(this, args);
    console.log(`${fn.name} took ${(performance.now() - t).toFixed(2)}ms`);
    return result;
  };
}

// Compose: withLogging(withTiming(myFn))

// ─────────────────────────────────────────────────────────
// Q5. Proxy — intercept property access for validation
// ─────────────────────────────────────────────────────────
function createValidated(schema) {
  return new Proxy({}, {
    set(target, key, value) {
      const validate = schema[key];
      if (validate && !validate(value)) {
        throw new TypeError(`Invalid value for key "${key}": ${value}`);
      }
      target[key] = value;
      return true;
    }
  });
}

const user = createValidated({
  age:   v => Number.isInteger(v) && v >= 0,
  email: v => typeof v === 'string' && v.includes('@'),
});

user.age = 25;      // OK
user.age = -1;      // TypeError

// ─────────────────────────────────────────────────────────
// Q6. Command pattern — encapsulate actions for undo/redo
// ─────────────────────────────────────────────────────────
class CommandHistory {
  constructor() { this.done = []; this.undone = []; }

  execute(command) {
    command.execute();
    this.done.push(command);
    this.undone = []; // clear redo stack on new action
  }
  undo() {
    const cmd = this.done.pop();
    if (cmd) { cmd.undo(); this.undone.push(cmd); }
  }
  redo() {
    const cmd = this.undone.pop();
    if (cmd) { cmd.execute(); this.done.push(cmd); }
  }
}

// Each command is { execute(), undo() }
class AddItemCommand {
  constructor(list, item) { this.list = list; this.item = item; }
  execute() { this.list.push(this.item); }
  undo()    { this.list.pop(); }
}

// ─────────────────────────────────────────────────────────
// Q7. Middleware pipeline (like Express) — compose handlers
// ─────────────────────────────────────────────────────────
function createPipeline(...middlewares) {
  return async function(context) {
    let index = -1;
    async function dispatch(i) {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      const fn = middlewares[i];
      if (!fn) return;
      await fn(context, () => dispatch(i + 1));
    }
    await dispatch(0);
  };
}

// ─────────────────────────────────────────────────────────
// Q8. Builder pattern — construct complex objects step by step
// ─────────────────────────────────────────────────────────
class QueryBuilder {
  #table = '';
  #conditions = [];
  #limitVal = null;
  #fields = ['*'];

  from(table)           { this.#table = table; return this; }
  select(...fields)     { this.#fields = fields; return this; }
  where(condition)      { this.#conditions.push(condition); return this; }
  limit(n)              { this.#limitVal = n; return this; }

  build() {
    let q = `SELECT ${this.#fields.join(', ')} FROM ${this.#table}`;
    if (this.#conditions.length) q += ` WHERE ${this.#conditions.join(' AND ')}`;
    if (this.#limitVal !== null) q += ` LIMIT ${this.#limitVal}`;
    return q;
  }
}

const query = new QueryBuilder()
  .from('users')
  .select('id', 'name', 'email')
  .where('age > 18')
  .where('active = true')
  .limit(20)
  .build();
// SELECT id, name, email FROM users WHERE age > 18 AND active = true LIMIT 20
```

<a id="javascript-scenarios"></a>
## Scenario-Based Interview Questions

---

### Scenario 1: Main Thread Jank — Heavy Computation in the Browser

**Situation:** Your e-commerce SPA freezes for 300–500 ms every time a user opens the "Filters" panel. A profiler trace shows a `filterAndSort()` function running on the main thread over a 40 k-item product list.

**Question:** How do you fix this without breaking the UX?

**Answer:**
- Move the heavy work to a **Web Worker** so the main thread stays free.
- Pass the data array and filter params via `postMessage`; receive sorted results back.
- Show a skeleton/spinner while the Worker is running.
- Consider **pagination or virtualisation** (react-window) so only ~50 rows are ever in the DOM.
- Cache the last result with a memoization key (filters + sort key) so repeat clicks are instant.

```javascript
// worker.js
self.onmessage = ({ data: { items, filters } }) => {
  const result = items.filter(applyFilters(filters)).sort(byPrice);
  self.postMessage(result);
};

// main thread
const worker = new Worker('./worker.js');
worker.postMessage({ items: bigList, filters });
worker.onmessage = ({ data }) => setProducts(data);
```

---

### Scenario 2: Memory Leak — SPA Crashes After 2 Hours

**Situation:** Your dashboard app crashes with an "out of memory" tab after users leave it open. Heap snapshots show detached DOM nodes and closures piling up.

**Question:** How do you identify and fix the leak?

**Answer:**
- Take three Heap Snapshots (idle → after navigating several routes → idle again) and compare retained objects.
- Common culprits:
  - **Event listeners** added in `useEffect` without cleanup (`window.addEventListener` not removed).
  - **setInterval / setTimeout** never cleared.
  - **Closure capturing large data** in a callback stored in a global map.
  - **3rd-party chart libraries** not destroyed on unmount.
- Fix: always return cleanup functions from `useEffect`; call `clearInterval`/`removeEventListener` on teardown.
- Use **WeakMap/WeakRef** for caches keyed by DOM nodes or component instances.

```javascript
useEffect(() => {
  const id = setInterval(fetchMetrics, 5000);
  window.addEventListener('resize', handleResize);
  return () => {
    clearInterval(id);
    window.removeEventListener('resize', handleResize);
  };
}, []);
```

---

### Scenario 3: Debounce Breaking After React Re-render

**Situation:** You add a debounced search input. It works in isolation but in the real app the debounce resets on every keystroke because the component keeps re-rendering.

**Question:** What is the root cause and how do you fix it?

**Answer:**
- Every render creates a **new debounce instance**, discarding the pending timer.
- Fix: stabilise the debounced function with `useRef` or `useMemo`/`useCallback` with an empty dep array so the same closure persists.

```javascript
const debouncedSearch = useRef(
  debounce((query) => fetchResults(query), 400)
).current;

// On unmount flush/cancel
useEffect(() => () => debouncedSearch.cancel?.(), []);
```

---

### Scenario 4: Promise Chain vs Async/Await — Unhandled Rejection in Production

**Situation:** Your Node service logs "UnhandledPromiseRejectionWarning" sporadically. The process crashes overnight in older Node versions.

**Question:** How do you track down and prevent this?

**Answer:**
- Add a global safety net: `process.on('unhandledRejection', (reason) => logger.error(reason))`.
- Audit every `.then()` chain — each needs a `.catch()` or the chain must be `await`-ed inside a `try/catch`.
- Use ESLint rule `no-floating-promises` (with TypeScript) or `promise/catch-or-return`.
- In Express, wrap async route handlers: `const asyncHandler = fn => (req, res, next) => fn(req, res, next).catch(next);`

---

### Scenario 5: Recursive Stack Overflow on Deep JSON

**Situation:** A customer uploads a JSON config file nested 20+ levels deep. Your `deepClone` implementation throws "Maximum call stack size exceeded".

**Question:** How do you handle deeply nested structures safely?

**Answer:**
- Replace recursion with an **iterative approach using an explicit stack**.
- Track visited objects in a `Map` to handle circular references.
- Alternatively use `structuredClone()` (Node ≥ 17, modern browsers) which handles both depth and cycles natively.
- Set a max-depth guard if custom traversal is required.

```javascript
function safDeepClone(obj) {
  return structuredClone(obj); // handles cycles + depth
}
// Or iterative with stack for older envs — see deep_clone implementation
```

---

### Scenario 6: Race Condition in Auto-Save Feature

**Situation:** Users edit a document and it auto-saves every 2 seconds. Occasionally the older save response arrives AFTER a newer one, overwriting the latest content.

**Question:** How do you prevent stale responses from winning?

**Answer:**
- Use an **AbortController** to cancel the previous in-flight request before issuing a new one.
- Alternatively, attach a monotonically-increasing sequence number to each request and discard responses whose sequence is lower than the last received.

```javascript
let controller;
async function autoSave(content) {
  controller?.abort();
  controller = new AbortController();
  await fetch('/api/save', {
    method: 'POST',
    body: JSON.stringify({ content }),
    signal: controller.signal,
  });
}
```

---

### Scenario 7: Slow Sort on Large Dataset — Algorithm Choice

**Situation:** A report page sorts 200 k rows on the client. It takes 4 seconds. The product team says "just make it faster".

**Question:** What steps do you take?

**Answer:**
1. **Profile first** — confirm it is the sort, not render, that is slow.
2. Move sort to the **server** with an ORDER BY clause — databases sort in milliseconds.
3. If client-side is unavoidable (offline-first), move to a **Web Worker** and use the built-in `Array.sort` (TimSort — O(n log n)).
4. Add **memoization**: same data + same sort key → cached result (reference equality check).
5. Switch to **virtualised rendering** so only visible rows are in the DOM regardless.

---

### Scenario 8: Incorrect Closure Value Inside Loop

**Situation:** A junior dev reports that a loop logs the same value (the final `i`) ten times instead of 0–9.

**Question:** Explain the root cause and three ways to fix it.

**Answer:**
Root cause: `var` is function-scoped, so all closures share the same `i` binding.

```javascript
// Fix 1: use let (block-scoped — each iteration gets its own binding)
for (let i = 0; i < 10; i++) setTimeout(() => console.log(i), 0);

// Fix 2: IIFE captures current value
for (var i = 0; i < 10; i++) ((n) => setTimeout(() => console.log(n), 0))(i);

// Fix 3: bind
for (var i = 0; i < 10; i++) setTimeout(console.log.bind(null, i), 0);
```

---

### Scenario 9: Event Delegation vs Direct Listeners on Dynamic List

**Situation:** A todo list dynamically adds hundreds of items. Each item has a delete button. A junior dev attaches a click listener to each button inside a loop and the page slows down.

**Question:** What is the better pattern and why?

**Answer:**
- Use **event delegation**: attach ONE listener to the parent list; check `event.target` to identify the clicked button.
- Reduces listener count from N to 1, works automatically for dynamically added items, and frees memory when items are removed.

```javascript
list.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-delete-id]');
  if (btn) deleteItem(btn.dataset.deleteId);
});
```

---

### Scenario 10: Implementing Retry with Exponential Back-Off

**Situation:** Your app calls a third-party payment API that occasionally returns 503. You need automatic retries without hammering the service.

**Question:** Implement a `withRetry` utility.

**Answer:**

```javascript
async function withRetry(fn, { retries = 3, baseDelay = 300, factor = 2 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries) throw err;
      const delay = baseDelay * Math.pow(factor, attempt) + Math.random() * 100; // jitter
      await new Promise(res => setTimeout(res, delay));
      attempt++;
    }
  }
}

// Usage
const result = await withRetry(() => callPaymentAPI(payload), { retries: 4 });
```

---

### Scenario 11: Detecting and Breaking a Circular Reference

**Situation:** `JSON.stringify()` throws "Converting circular structure to JSON" in a logging utility. You don't control the objects being logged.

**Question:** How do you handle this gracefully?

**Answer:**

```javascript
function safeStringify(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  }, 2);
}
```

---

### Scenario 12: Prototype Pollution Attack via `_.merge`

**Situation:** A security audit flags that your API endpoint passes user-supplied JSON directly into `_.merge({}, userInput)`. Explain the risk and fix.

**Answer:**
- `_.merge` with input `{"__proto__": {"isAdmin": true}}` pollutes `Object.prototype`, making `({}).isAdmin` return `true` for ALL objects in the process.
- **Fix options:**
  1. Use `Object.assign` with a `null`-prototype object: `Object.assign(Object.create(null), userInput)`.
  2. Sanitise input: reject keys `__proto__`, `constructor`, `prototype`.
  3. Use `JSON.parse(JSON.stringify(input))` to strip prototype chain before merging.
  4. Upgrade lodash — versions ≥ 4.17.17 include a fix.
