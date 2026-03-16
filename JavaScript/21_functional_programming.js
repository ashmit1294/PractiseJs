/**
 * QUESTION SET: Functional Programming Patterns
 *
 * pipe, compose, groupBy, chunk, zip, flatten, intersection,
 * differenceBy, throttle-once, observable pattern, etc.
 */

// ─────────────────────────────────────────────
// Q1. pipe — left-to-right function composition
// WHAT: Compose functions executing left-to-right? THEORY: Pass value through function sequence. Each output = next input. pipe(f,g,h)(x) = h(g(f(x))).
// pipe(f, g, h)(x) = h(g(f(x)))
// ─────────────────────────────────────────────
function pipe(...fns) {
  return function (value) {
    return fns.reduce((acc, fn) => fn(acc), value);
  };
}

// Q2. compose — right-to-left (mathematical convention)
// WHAT: Compose functions executing right-to-left? THEORY: compose(f,g,h)(x) = f(g(h(x))). Mathematical notation. Opposite of pipe.
// compose(f, g, h)(x) = f(g(h(x)))
function compose(...fns) {
  return function (value) {
    return fns.reduceRight((acc, fn) => fn(acc), value);
  };
}

// ─────────────────────────────────────────────
// Q3. groupBy — group array elements by a key function
// WHAT: Group array elements by result of key function? THEORY: Reduce array, compute key for each, append to bucket. O(n) time.
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
// WHAT: Split array into subarrays of size n? THEORY: Iterate step n, slice from i to i+n. Last chunk may be smaller. O(n).
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
// WHAT: Transpose multiple arrays (zip/unzip)? THEORY: zip: take i-th elem from each array. min length determines result size. O(n*m).
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
// WHAT: Flatten nested object to dot-notation keys? THEORY: Recursive traversal. For objects, recurse with prefixed keys. For values, assign. O(n).
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

// WHAT: Deep structural comparison vs shallow equality? THEORY: Recursive comparison handling arrays/objects. Check types, keys, values recursively. O(n).
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

// WHAT: Difference by transformed value? THEORY: Apply iteratee to arr2, put results in Set. Filter arr1 on iteratee not in set. O(n).
// ─────────────────────────────────────────────
// Q8. differenceBy — elements in arr1 not in arr2 by iteratee
// differenceBy([2.1,1.2], [2.3,3.4], Math.floor) → [1.2]
// ─────────────────────────────────────────────
function differenceBy(arr1, arr2, fn) {
  const set2 = new Set(arr2.map(fn));
  return arr1.filter((item) => !set2.has(fn(item)));
}

// WHAT: Publish-subscribe event system? THEORY: Map event names to callbacks. on/off/emit methods. once(r) wraps listener to self-remove. O(1) emit.
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
WHAT: Reactive pattern with subscribers and operators? THEORY: Lazy subscription. Subscriber object with next/error/complete. Chainable operators (map, filter). Async handling.
// 
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
