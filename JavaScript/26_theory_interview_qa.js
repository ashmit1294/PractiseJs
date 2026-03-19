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

ELI5: Imagine var as a sticky note that follows you everywhere in a room (function), let as a sticky
nte that only sticks in one corner (block), and const as a locked box. You can change what's inside the
box, but you can't swap the box for a different one.
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

ELI5: Imagine JavaScript reads your file twice: first, it collects all declarations and
pulls them to the top (hoisting), then it runs the code. Functions get pulled up fully ready
to use, but variables get pulled up as empty boxes waiting to be filled.
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

ELI5: Think of it like a family tree. When you ask a child 'who is this person?', if they don't know,
they ask their parent. If the parent doesn't know, they ask the grandparent. JavaScript objects do this
too - if they don't have a property, they ask their "parent" object up the chain.
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

ELI5: Imagine a function as a bubble that captures the air (variables) inside it. When the function
returns, the bubble floats away but the air stays trapped inside. Any inner functions can still breathe
that captured air, even after the outer function is done.
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

ELI5: `this` is like a name tag that changes depending on where the function is called. If you call
it as a method on an object, the name tag says that object. If you call it alone, it says global.
Arrow functions are special - they steal their name tag from the surrounding context and never change it.
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

ELI5: A generator is like a video with pause buttons. Each `yield` is a pause point. When you call
.next(), the video plays until the next pause, gives you the value, then stops. Perfect for processing
data step-by-step without doing everything at once (like reading a huge file line by line).
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

ELI5: A Proxy is like a security guard in front of an office. Every time someone tries to enter
or take something (read/write a property), the guard intercepts them, checks if they should, and
allows or denies access. You're adding gates and checks around your object.
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
/*
Q9 [INTERMEDIATE]: What is the Temporal Dead Zone (TDZ) and why was it introduced?
────────────────────────────────────────────────────────────────────────────────────
A: The TDZ is the period between entering the scope (block/function) and the actual
   declaration line. Accessing a let/const variable in TDZ throws ReferenceError.

   Why: `var` hoisting with `undefined` initialization is a source of subtle bugs.
   TDZ forces you to declare variables before using them — easier to reason about code flow.

ELI5: The Temporal Dead Zone is like a haunted zone in your code - the variable exists on a ghost
level, but if you try to touch it before the declaration line, it yells at you. It's a safety feature
to keep you from accidentally using variables before they're ready.
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

ELI5: Map is like a storage locker that keeps items safe forever - they'll never be thrown away.
WeakMap is like a storage locker that throws items away as soon as nobody cares about them anymore.
Use WeakMap when you want to remember things about objects but don't want to prevent them from
being cleaned up by garbage collection.
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

ELI5: V8 is like a super-smart librarian. Instead of looking up a book every time, it learns where
books are stored (hidden classes). If you always put them in the same place, it can grab them in a
flash. But if you keep moving books around, the librarian gets confused and things slow down.
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

ELI5: Memory leaks are like things you keep in your backpack that you've forgotten about. The
backpack gets heavier and heavier. JavaScript's garbage collector wants to throw away things you
don't use anymore, but if you're still holding a reference to them, they stay. Eventually your app
runs out of memory (the backpack is too heavy to carry).
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

ELI5: CommonJS (require) is the old way Node.js let you import code - like asking someone "hey,
give me this code NOW". ES Modules (import) is the modern standard - like reserving a table before
you arrive. Imports are analyzed first, requires happen as the code runs.
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

ELI5: Tail call optimization is like a relay race in reverse. Instead of each runner handing off
to the next and waiting (stacking up), each runner completely finishes their job and the next one
reuses their running position. It saves memory for deep recursion. Node.js doesn't use it much
because it makes debugging harder (losing the stack trace).
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

ELI5: Symbols are like special secret keys that nobody else has. You can use them to mark special
behaviors on objects (like how to iterate, how to convert to text) without anyone else accidentally
finding them. They're invisible in normal loops, so they're perfect for hidden internal stuff.
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
ELI5: Promise.all is like saying "I need ALL my tasks done or I give up". Promise.race is "whoever
finishes first wins". Promise.allSettled is "I want to know how EVERYONE did, pass or fail". Promise.any
is "I just need ONE person to succeed".*/
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
ELI5: Duck typing is like saying "if something acts like a duck (quacks, swims, looks like a duck),
then treat it as a duck" - you don't care about what it actually is. Composition is building things by
gluing smaller pieces together instead of creating long family trees of inheritance.*/

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

/*
Q17 [ADVANCED]: What are common JavaScript design patterns (Singleton, Factory, Observer, Pub-Sub)?
──────────────────────────────────────────────────────────────────────────────────────────────────
A: Design patterns are reusable solutions to common software design problems.
   Key patterns for JavaScript:

1. SINGLETON: Ensures only ONE instance of a class exists; controls global access point.
*/

class Database {
  static instance = null;
  #connection = null;

  static getInstance() {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  connect() {
    if (!this.#connection) {
      this.#connection = { /* connected */ };
    }
    return this.#connection;
  }
}

const db1 = Database.getInstance();
const db2 = Database.getInstance();
console.log(db1 === db2); // true — same instance

/*
2. FACTORY: Creates objects without specifying exact classes; encapsulates object creation logic.
*/

class Circle {
  constructor(radius) { this.radius = radius; }
  getArea() { return Math.PI * this.radius ** 2; }
}

class Rectangle {
  constructor(width, height) { this.width = width; this.height = height; }
  getArea() { return this.width * this.height; }
}

class ShapeFactory {
  static createShape(type, ...args) {
    if (type === 'circle') return new Circle(...args);
    if (type === 'rectangle') return new Rectangle(...args);
    throw new Error('Unknown shape');
  }
}

const shape = ShapeFactory.createShape('circle', 5);
console.log(shape.getArea()); // 78.54

/*
3. OBSERVER / PUB-SUB: Defines one-to-many dependency; when subject changes, all observers notified.
*/

class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(listener);
  }

  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(data));
    }
  }

  off(event, listenerToRemove) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(listener => listener !== listenerToRemove);
    }
  }
}

const emitter = new EventEmitter();
const onUserLogin = (user) => console.log(`User ${user} logged in`);
emitter.on('login', onUserLogin);
emitter.emit('login', 'Alice');   // "User Alice logged in"

/*
4. ADAPTER: Converts interface of one class into another clients expect;
           allows incompatible objects to collaborate.
*/

class OldAPI {
  getUser() { return { fullName: 'John Doe' }; }
}

class NewAPI {
  getUser() { return { firstName: 'John', lastName: 'Doe' }; }
}

class UserAdapter {
  constructor(api) { this.api = api; }
  getUser() {
    const user = this.api.getUser();
    if (user.fullName) {
      const [firstName, lastName] = user.fullName.split(' ');
      return { firstName, lastName };
    }
    return user;
  }
}

const adapter = new UserAdapter(new OldAPI());
console.log(adapter.getUser()); // { firstName: 'John', lastName: 'Doe' }

/*
5. DECORATOR: Attaches additional responsibilities to object dynamically;
            alternative to subclassing for extending functionality.
*/

function withLogging(fn, name = fn.name) {
  return function(...args) {
    console.log(`Calling ${name} with args:`, args);
    const result = fn(...args);
    console.log(`${name} returned:`, result);
    return result;
  };
}

function add(a, b) { return a + b; }
const loggedAdd = withLogging(add);
loggedAdd(2, 3); // logs: Calling add with args: [2, 3], add returned: 5

/*
Q18 [ADVANCED]: What are bundling techniques and differ ences between Webpack, Rollup, Esbuild, and Vite?
─────────────────────────────────────────────────────────────────────────────────────────────────────────
A: Bundlers combine modules into optimised output files for browsers/Node.
   Key considerations: bundle size, build speed, dev server, tree-shaking, code splitting, HMR.
*/

/*
1. WEBPACK (Most popular, all-in-one):
   - Entry point → dependency graph → chunking → optimization
   - Plugins & loaders for everything (CSS, images, fonts, etc.)
   - Pros: Powerful, versatile, huge ecosystem
   - Cons: Complex config, slower build times, learning curve
   - Use case: Large SPAs with complex requirements

2. ROLLUP (ES modules focused, slim):
   - Designed for libraries (ESM, CJS, UMD outputs)
   - Excellent tree-shaking (removes unused code)
   - Simpler config than Webpack
   - Pros: Small bundle size, clean code structure, excellent for libraries
   - Cons: Less out-of-the-box, steeper learning for advanced features
   - Use case: Publishing libraries, frameworks (React, Vue use Rollup)

3. ESBUILD (Rust-based, extremely fast, newer):
   - Written in Go (now Rust in newer versions) → 10-100x faster than Webpack
   - Very simple config, zero-config mode
   - Modern JS only (targets ES2020+)
   - Pros: Speed, simplicity, modern
   - Cons: Less mature, fewer plugins, less flexible
   - Use case: Quick builds, prototyping, libraries targeting modern browsers

4. VITE (Next-gen dev experience, uses Esbuild):
   - Dev server: ES modules natively (file-on-request), instant HMR
   - Prod build: Rollup under the hood
   - Zero-config, framework templates (React, Vue, Svelte, etc.)
   - Pros: Blazing fast dev experience, simple config, modern defaults
   - Cons: Requires modern browser support in dev, newer ecosystem
   - Use case: Modern SPAs, React/Vue/Svelte projects (recommended for new projects)

COMPARISON TABLE:
  Webpack     | Mature, powerful, lots of plugins, complex, slow dev rebuilds
  Rollup      | Libraries, tree-shaking, clean, not all-in-one
  Esbuild     | Blazing fast, simple, newer, less plugins
  Vite        | Modern dev experience, recommended for new projects, Rollup for prod

KEY CONCEPTS:
- Tree-shaking: Remove unused export codes (only works with ES modules)
- Code splitting: Split bundle into chunks (lazy-load routes, vendor chunks)
- Dead code elimination: Remove unreachable code
- Minification: Remove comments, shorten variable names, compress
*/

/*
Q19 [BASIC]: What is IIFE (Immediately Invoked Function Expression)?
───────────────────────────────────────────────────────────────────
A: A function that is defined and called immediately. Syntax: (function() { ... })() or (() => { ... })()\n   Use cases:\n   1. Avoid polluting global scope — variables are local to the IIFE\n   2. Module pattern — create private variables and public API\n   3. Execute async code before others (pre-ES6 async/await era)\n   4. Isolate code to prevent conflicts in global namespace (especially in scripts)\n*/\n\n// Immediately invoked - common in legacy code and UMD modules\n(function() {\n  const privateVar = 'secret';\n  console.log('IIFE executed immediately');\n})();\n\n// Arrow function version (ES6+)\n(() => {\n  const x = 42;\n  console.log('arrow IIFE executed');\n})();\n\n// Module pattern: revealing private and public API\nconst counterModule = (() => {\n  let count = 0;  // private\n  return {\n    increment() { return ++count; },\n    decrement() { return --count; },\n    getCount()  { return count; },\n  };\n})();\n\ncounterModule.increment();\ncounterModule.increment();\n// counterModule.count;  // ❌ undefined — count is private\n// counterModule.getCount();  // ✅ 2\n\n// Pre-ES6: pass arguments to IIFE to isolate dependencies\n(function(window, document, $) {\n  // $ is guaranteed jQuery here, not overridden by other scripts\n  // common in legacy jQuery code\n})(window, document, jQuery);\n\nmodule.exports = {\n  makeCounter,\n  Range,\n  Entity,\n  factTrampolined,\n  withTimeout,\n  createValidator,\n};
