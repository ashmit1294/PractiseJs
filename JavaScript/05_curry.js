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
