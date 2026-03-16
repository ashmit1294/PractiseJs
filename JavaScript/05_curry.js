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
// WHAT: How to transform f(a,b,c) into f(a)(b)(c)?
// THEORY: Check if received args >= fn.length (arity). If yes → call. Else → return function to collect more.
//         fn.length = function's parameter count. Recursive accumulation.
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
// WHAT: How to preset some arguments and return a function for remaining?
// THEORY: Capture preset args in closure. New function receives remaining args + combines both.
//         Similar to curry but doesn't check arity. Can partially apply any number of arguments.
// ─────────────────────────────────────────────
function partial(fn, ...presetArgs) {
  return function (...laterArgs) {
    return fn(...presetArgs, ...laterArgs);
  };
}

// ─────────────────────────────────────────────
// APPROACH 3: Infinite curry — sum(1)(2)(3)()
// WHAT: How to support curry with no defined arity, terminating with empty call?
// THEORY: Accumulate args in closure. If empty call → flush and evaluate. Else → append + return curried.
//         Useful for sum(a)(b)(c)() pattern. Flexible argument count.
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
// WHAT: How to support sum(1)(2)(3) that returns a number (not a function)?
// THEORY: Return value or function based on input. If b === undefined → return accumulated sum. Else → recurse with b.
//         Classic interview pattern. Relies on value vs function behavior.
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
