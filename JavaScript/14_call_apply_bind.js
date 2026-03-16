/**
 * QUESTION SET: call, apply, bind — Custom Implementations
 *
 * These are prototype methods on Function.prototype.
 * Understanding them tests your knowledge of `this` binding
 * and how JavaScript executes functions.
 */

// ─────────────────────────────────────────────
// Q1. Implement Function.prototype.myCall
// WHAT: Implement call() method binding this context? THEORY: Create temporary property on context, invoke function, delete property. O(1) operation.
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
// WHAT: Implement apply() with array arguments? THEORY: Same as call but spread array as arguments. Internally similar: create temp property, invoke, clean up.
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
// WHAT: Implement bind() returning preset function? THEORY: Return new function with fixed context and preset args. Support constructor with 'new'. Preserve prototype chain.xt, ...presetArgs) {
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
// WHAT: Implement new operator creating instances? THEORY: Create empty object. Link to constructor.prototype. Call constructor with new object as this. Return object if non-primitive result.& 2
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
  iWHAT: Implement Object.create() for prototypal inheritance? THEORY: Create empty constructor. Set prototype to argument. Return new instance with optional property descriptors.
// f (propertiesObject !== undefined) {
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
  cWHAT: Chain function execution—run before hook? THEORY: AOP pattern. Wrap original function. Call before hook first, then original. Return original result.
    beforeFn.apply(this, args);
    return originalFn.apply(this, args);
  };
};

// ─────────────────────────────────────────────
// Q7. Implement Function.prototype.after
// WHAT: Chain function execution—run after hook? THEORY: Similar to before. Call original first, capture result. Call after hook. Return result.
// ─────────────────────────────────────────────
Function.prototype.after = function (afterFn) {
  const originalFn = this;
  return function (...args) {
    const result = originalFn.apply(this, args);
    afterFn.apply(this, args);
    return result;
  };
};
WHAT: Ensure function executes only once? THEORY: Closure tracks called state. First call invokes function, caches result. Subsequent calls return cached result without re-execution.
// 
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
