/**
 * QUESTION SET: call, apply, bind — Custom Implementations
 *
 * These are prototype methods on Function.prototype.
 * Understanding them tests your knowledge of `this` binding
 * and how JavaScript executes functions.
 */

// ─────────────────────────────────────────────
// Q1. Implement Function.prototype.myCall
// WHAT: How to invoke function with custom `this` context and individual arguments?
// THEORY: Temporarily assign function as property. Call with spread args. Delete after. Restores original context.
// Time: O(1) assignment/deletion  Space: O(1)
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
// WHAT: How to invoke function with custom `this` context and array of arguments?
// THEORY: Identical to myCall but accepts array. Spread array before calling.
// Time: O(1) assignment/deletion  Space: O(1)
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
