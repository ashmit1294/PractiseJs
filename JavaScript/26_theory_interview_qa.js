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
Q1 [BASIC]: What is the difference between var, let, and const?// WHAT: Differences between var/let/const (scope, hoisting, reassignment)? THEORY: var=function-scoped+hoisted+undefined; let=block-scoped+TDZ; const=immutable binding.─────────────────────────────────────────────────────────────
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
// WHAT: What is hoisting? (Variables/functions moved before execution?) THEORY: var/functions completely hoisted; let/const hoisted but in TDZ until declaration line.
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
// WHAT: How does prototype chain resolve properties? THEORY: [[Prototype]] link walks object→proto→proto.proto until found or null. Every object has proto.
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
// WHAT: What are closures? (Function remembers outer scope?) THEORY: Function "closes over" variables from definition scope. Each closure gets own binding. Classic loop bug.
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
// WHAT: What determines `this` value? THEORY: By call context: method=obj, constructor=new, arrow=lexical scope, global=window/undefined. call/apply/bind override.
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
// WHAT: Microtask/Macrotask execution order? THEORY: All microtasks drain between macrotasks. Queue: setTimeout(macro), Promise(micro), process.nextTick(micro first in Node).
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
// WHAT: What are generators? (Pausable functions?) THEORY: yield pauses, .next() resumes returning {value, done}. Lazy evaluation, infinite sequences, custom iterables.
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
// WHAT: Proxy/Reflect API for intercepting operations? THEORY: Proxy traps intercept ops (get, set, delete). Always use Reflect.xxx for delegation. Validation/logging/reactivity.
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

// WHAT: TDZ concept and purpose? THEORY: Period between scope entry and let/const declaration. Throws ReferenceError to force explicit declaration. Better than var hoisting bugs.
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

// WHAT: WeakMap vs Map? THEORY: WeakMap: object keys, weak refs (GC-friendly), not enumerable. Use: private data, metadata without preventing GC. Map: strong refs, enumerable.
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

// WHAT: V8 JIT optimizations (Hidden Classes/Inline Caching)? THEORY: Hidden Classes=shapes for property layouts, IC caches shape+offset for fast lookup. Don't add/delete props dynamically.
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
// WHAT: Common memory leaks? THEORY: Forgotten listeners, closures holding large objects, globals, detached DOM, setInterval. Detect: Chrome Heap Snapshot, Node clinic.js.

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
// WHAT: CommonJS vs ESM differences? THEORY: CJS=sync, dynamic, copy exports. ESM=async, static, live bindings. ESM better tree-shaking. Interop: CJS→ESM via dynamic import().

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
// WHAT: TCO and Node.js limitation? THEORY: TCO=reuse stack frame for tail calls, O(1) stack. V8 removed it for debuggability. Workaround: trampolining pattern.
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

// WHAT: Promise combinator differences (all/allSettled/any/race)? THEORY: all=reject on first error. allSettled=always resolves. race=first settled. any=first success or AggregateError.
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

// WHAT: Duck typing vs composition patterns? THEORY: Duck typing=behavior-based. Prefer composition over inheritance to avoid fragile base class problem. Mixins/functional approach.
/*
Q17 [ADVANCED]: Explain Structural Typing, duck typing, and object composition
// WHAT: Duck typing vs composition patterns? THEORY: Duck typing=behavior-based. Prefer composition over inheritance to avoid fragile base class problem. Mixins/functional approach.
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
