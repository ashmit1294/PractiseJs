# Master Interview Q&A - All Technologies

A comprehensive consolidated collection of interview questions and answers for experienced developers (7+ years). This master file combines theory, design patterns, and advanced topics across the full modern web development stack.

---

## Table of Contents

- [JavaScript (24+ Questions)](#javascript)
- [React (30+ Questions)](#react)
- [Next.js (11 Questions)](#nextjs)
- [Node.js (25+ Questions)](#nodejs)
- [MongoDB (11+ Scenarios)](#mongodb)
- [Docker (28 Questions)](#docker)
- [AWS (20+ Questions)](#aws)
- [Azure (20+ Questions)](#azure)
- [System Design & Architecture (2 Questions)](#system-design--architecture)

---

## JavaScript

**Category:** Core Language Theory | **Questions:** 24+ | **Level:** Basic → Advanced

JavaScript is the foundation of all modern web development. These questions cover scoping, hoisting, closures, prototypes, async patterns, optimization, and design patterns essential for 7+ years of experience.

### Q1 [BASIC]: What is the difference between var, let, and const?

**A:** 
- `var` → function-scoped, hoisted WITH initialization to undefined, re-declarable
- `let` → block-scoped, hoisted WITHOUT initialization (TDZ), not re-declarable  
- `const` → block-scoped, must initialize, binding is immutable (but object contents are mutable)

**ELI5:** Imagine var as a sticky note that follows you everywhere in a room (function), let as a sticky note that only sticks in one corner (block), and const as a locked box. You can change what's inside the box, but you can't swap the box for a different one.

```javascript
{
  console.log(x); // undefined  ← var hoisted, initialized to undefined
  var x = 5;

  // console.log(y); // ReferenceError: Cannot access 'y' before initialization
  let y = 10;       // ← TDZ from block start until this line

  const obj = { a: 1 };
  obj.a = 2;        // ✅ object contents CAN change
  // obj = {};      // ❌ TypeError: Assignment to constant variable
}
```

---

### Q2 [BASIC]: What is Hoisting?

**A:** JavaScript moves (hoists) declarations to the top of their scope during compilation.
- `var`: hoisted and initialized to undefined
- function declarations: fully hoisted (can call before the definition)
- `let`/`const`: hoisted but NOT initialized → TDZ until the line is reached
- `class`: hoisted but NOT initialized → TDZ

**ELI5:** Imagine JavaScript reads your file twice: first, it collects all declarations and pulls them to the top (hoisting), then it runs the code. Functions get pulled up fully ready to use, but variables get pulled up as empty boxes waiting to be filled.

---

### Q3 [BASIC]: How does the Prototype Chain work?

**A:** Every object has an internal [[Prototype]] link pointing to another object. Property lookup walks up the chain until found or null is reached.

**ELI5:** Think of it like a family tree. When you ask a child 'who is this person?', if they don't know, they ask their parent. If the parent doesn't know, they ask the grandparent. JavaScript objects do this too - if they don't have a property, they ask their "parent" object up the chain.

```javascript
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function() {
  return `${this.name} makes a sound`;
};

const dog = new Animal("Rex");
console.log(dog.speak());                      // "Rex makes a sound"
console.log(Object.getPrototypeOf(dog) === Animal.prototype); // true
```

---

### Q4 [BASIC]: Explain Closures with a real-world example.

**A:** A closure is a function that "remembers" the variables from the scope where it was DEFINED, even after that outer function has returned. The function closes over the variables — hence "closure".

**ELI5:** Imagine a function as a bubble that captures the air (variables) inside it. When the function returns, the bubble floats away but the air stays trapped inside. Any inner functions can still breathe that captured air, even after the outer function is done.

```javascript
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
```

---

### Q5 [BASIC]: What are the different values of `this`?

**A:** `this` is determined by HOW a function is called (not where it's defined).
- Global context: `window` (browser) | `global` (Node) | `undefined` (strict mode)
- Method call: `obj.method()` → `this` = obj
- Constructor: `new Fn()` → `this` = new object
- Arrow function: lexically inherits `this` from surrounding scope (no own `this`)
- Explicit: `call`/`apply`/`bind` override `this`

**ELI5:** `this` is like a name tag that changes depending on where the function is called. If you call it as a method on an object, the name tag says that object. If you call it alone, it says global. Arrow functions are special - they steal their name tag from the surrounding context and never change it.

---

### Q6 [INTERMEDIATE]: Microtask vs Macrotask queue — what is the exact execution order?

**A:** After each macrotask, ALL microtasks are drained before moving to the next macrotask.

- **Macrotask queue:** setTimeout, setInterval, setImmediate (Node), I/O callbacks
- **Microtask queue:** Promise.then/catch/finally, queueMicrotask, MutationObserver
- **Node-specific:** process.nextTick runs BEFORE all other microtasks

```javascript
console.log('1 - script start');       // sync
setTimeout(() => console.log('2 - setTimeout 0'), 0);   // macrotask
Promise.resolve()
  .then(() => console.log('3 - promise 1'))             // microtask
  .then(() => console.log('4 - promise 2'));             // microtask (chained)
queueMicrotask(() => console.log('5 - queueMicrotask')); // microtask
console.log('6 - script end');         // sync

// Output order: 1 → 6 → 3 → 5 → 4 → 2
```

---

### Q7 [INTERMEDIATE]: How do Generators work and when would you actually use them?

**A:** Generators are pausable functions. `yield` suspends execution until `.next()` is called. Returns an iterator (has .next() returning { value, done }).

Use cases: lazy infinite sequences, custom async control flow, implementing iterables.

**ELI5:** A generator is like a video with pause buttons. Each `yield` is a pause point. When you call .next(), the video plays until the next pause, gives you the value, then stops. Perfect for processing data step-by-step without doing everything at once.

```javascript
function* range(start, end, step = 1) {
  for (let i = start; i < end; i += step) {
    yield i;   // pause here and return i, resume on next .next() call
  }
}
console.log([...range(0, 10, 2)]); // [0, 2, 4, 6, 8]
```

---

### Q8 [INTERMEDIATE]: Explain the Proxy and Reflect API with a practical use case.

**A:** Proxy wraps an object and intercepts fundamental operations (get, set, delete, etc.). Reflect provides the default implementations — always call Reflect.xxx inside traps to maintain correct behavior.

Use cases: validation, logging, reactive state (Vue 3 reactivity), lazy-loading.

**ELI5:** A Proxy is like a security guard in front of an office. Every time someone tries to enter or take something (read/write a property), the guard intercepts them, checks if they should, and allows or denies access.

---

### Q9 [INTERMEDIATE]: What is the Temporal Dead Zone (TDZ) and why was it introduced?

**A:** The TDZ is the period between entering the scope (block/function) and the actual declaration line. Accessing a let/const variable in TDZ throws ReferenceError.

Why: `var` hoisting with `undefined` initialization is a source of subtle bugs. TDZ forces you to declare variables before using them — easier to reason about code flow.

**ELI5:** The Temporal Dead Zone is like a haunted zone in your code - the variable exists on a ghost level, but if you try to touch it before the declaration line, it yells at you.

---

### Q10 [INTERMEDIATE]: How does WeakMap differ from Map, and when should you use it?

**A:**
- **WeakMap:** keys must be OBJECTS, holds WEAK references (key not prevented from GC), NOT iterable, no .size
- **Map:** any type as key, holds STRONG references (prevents GC), iterable, has .size

Use WeakMap when: attaching metadata to objects without preventing GC (DOM node caching, private fields).

**ELI5:** Map is like a storage locker that keeps items safe forever. WeakMap is like a storage locker that throws items away as soon as nobody cares about them anymore.

---

### Q11 [ADVANCED]: How does V8 optimize JavaScript? What are Hidden Classes and Inline Caching?

**A:** V8 uses JIT (Just-In-Time) compilation with key optimizations:

**HIDDEN CLASSES (Shapes):** V8 creates an internal "shape" for each unique property layout. Objects sharing the same shape can share compiled code.

**INLINE CACHING (IC):** At call site like `obj.x`, V8 caches the shape + offset so the NEXT call is a direct memory read instead of hash lookup.

**ELI5:** V8 is like a super-smart librarian. Instead of looking up a book every time, it learns where books are stored (hidden classes). If you always put them in the same place, it can grab them in a flash. But if you keep moving books around, the librarian gets confused.

---

### Q12 [ADVANCED]: What are common Memory Leak patterns in JavaScript and how do you detect them?

**A:** Memory leaks = objects no longer needed but cannot be garbage-collected because something still references them.

**Common patterns:**
1. Forgotten event listeners
2. Closures holding large objects
3. Global variable accretion
4. Detached DOM nodes
5. setInterval not cleared

**Detection:** Chrome DevTools → Memory → Take Heap Snapshot, compare two snapshots. Look for growing "Detached HTMLElement" count.

---

### Q13 [ADVANCED]: What is the difference between CommonJS (require) and ES Modules (import)?

**A:** Two completely different module systems.

**ELI5:** CommonJS (require) is the old way Node.js let you import code - like asking someone "give me this code NOW". ES Modules (import) is the modern standard - like reserving a table before you arrive.

**Key differences:**
1. CJS: synchronous require() — blocks thread; ESM: asynchronous
2. CJS: `require()` can be in conditionals; ESM: imports always top-level (static)
3. CJS: exports is a copy; ESM: live bindings
4. ESM: better tree-shaking
5. CJS: `__dirname`, `__filename`; ESM: use `import.meta.url`

---

### Q14 [ADVANCED]: Explain tail call optimization (TCO) and why Node.js doesn't fully support it.

**A:** TCO = if the LAST thing a function does is call another function, the current stack frame can be REUSED instead of stacking a new one. Makes recursion O(1) stack space instead of O(n).

**ELI5:** TCO is like a relay race in reverse. Instead of each runner handing off to the next and waiting, each runner finishes and the next one reuses their running position. Node.js doesn't use it much because it makes debugging harder (losing the stack trace).

---

### Q15 [ADVANCED]: What are Symbol, Symbol.iterator, and Symbol.toPrimitive used for?

**A:** Symbol is a unique, non-enumerable primitive. Well-known Symbols let you customize built-in behavior.

**ELI5:** Symbols are like special secret keys that nobody else has. You use them to mark special behaviors on objects without anyone else accidentally finding them. They're invisible in normal loops, so they're perfect for hidden internal stuff.

---

### Q16 [ADVANCED]: How does Promise.all, allSettled, any, and race differ in error handling?

**A:**
- **Promise.all:** resolves with array of all values; REJECTS IMMEDIATELY on first rejection
- **Promise.allSettled:** ALWAYS resolves; result is array of {status, value/reason}
- **Promise.race:** resolves/rejects with FIRST settled (fastest wins)
- **Promise.any:** resolves with FIRST fulfilled; only rejects if ALL reject

**ELI5:** Promise.all is "I need ALL tasks done or I give up". Promise.race is "whoever finishes first wins". Promise.allSettled is "I want to know how EVERYONE did". Promise.any is "I just need ONE person to succeed".

---

### Q17 [ADVANCED]: Explain Structural Typing, duck typing, and object composition patterns.

**A:** JS uses duck typing — if it walks like a duck and quacks like a duck, it is a duck. Large codebases prefer COMPOSITION over INHERITANCE to avoid the fragile base class problem.

**ELI5:** Duck typing is "if something acts like a duck, treat it as a duck - you don't care what it actually is". Composition is building things by gluing smaller pieces together instead of creating long family trees.

---

### Q18 [ADVANCED]: Common JavaScript design patterns (Singleton, Factory, Observer, Adapter, Decorator)

**A:** Design patterns are reusable solutions to common software design problems.

**Key patterns:**
1. **SINGLETON:** Ensures only ONE instance exists
2. **FACTORY:** Creates objects without specifying exact classes
3. **OBSERVER/PUB-SUB:** One-to-many dependency; when subject changes, all observers notified
4. **ADAPTER:** Converts interface of one class into another
5. **DECORATOR:** Attaches additional responsibilities dynamically

---

### Q19 [ADVANCED]: Web Bundling - Webpack, Rollup, Esbuild, and Vite

**A:** Bundlers combine modules into optimised output files for browsers/Node.

**Comparison:**
- **Webpack:** Most popular, all-in-one, powerful but complex config
- **Rollup:** ES modules focused, excellent tree-shaking, ideal for libraries
- **Esbuild:** Rust-based, 10-100x faster, simple config, modern JS only
- **Vite:** Next-gen dev experience, uses Esbuild for dev, Rollup for prod

**Key concepts:**
- **Tree-shaking:** Remove unused exports (only works with ES modules)
- **Code splitting:** Split bundle into chunks (lazy-load routes)
- **Dead code elimination:** Remove unreachable code
- **Minification:** Remove comments, shorten names, compress

---

### Q20 [BASIC]: What is IIFE (Immediately Invoked Function Expression)?

**A:** A function that is defined and called immediately. Syntax: `(function() { ... })()` or `(() => { ... })()`

**Use cases:**
1. Avoid polluting global scope — variables are local to the IIFE
2. Module pattern — create private variables and public API
3. Execute async code before others
4. Isolate code to prevent conflicts

---

### Q21 [INTERMEDIATE]: You have two objects — one with movie IDs and names, another with movie names and ratings. How do you display movie ID, name and rating together?

**A:** Classic "join two data collections on a shared key" problem. In MongoDB you'd use `$lookup`; in JavaScript you use a Map for O(1) lookups instead of a nested loop (O(n²)).

**ELI5:** Imagine you have two lists pinned on a wall. List A says "ID 1 = Inception, ID 2 = Interstellar". List B says "Inception = 9.3, Interstellar = 8.6". You scan List A left-to-right and look each film name up on List B in one fast step using a Map (like an index card box), not by reading List B from top to bottom every time.

```javascript
// Data — could also come from two API calls
const moviesById = [
  { id: 1, name: "Inception" },
  { id: 2, name: "Interstellar" },
  { id: 3, name: "Tenet" },
];

const movieRatings = [
  { name: "Inception",     rating: 9.3 },
  { name: "Interstellar",  rating: 8.6 },
  { name: "Tenet",         rating: 7.4 },
];

// Step 1: Build a Map from movieRatings for O(1) name → rating lookup
const ratingMap = new Map(movieRatings.map(({ name, rating }) => [name, rating]));
// Map { "Inception" → 9.3, "Interstellar" → 8.6, "Tenet" → 7.4 }

// Step 2: Merge — one linear pass
const result = moviesById.map(({ id, name }) => ({
  id,
  name,
  rating: ratingMap.get(name) ?? "N/A",   // graceful fallback
}));

console.log(result);
// [
//   { id: 1, name: "Inception",    rating: 9.3 },
//   { id: 2, name: "Interstellar", rating: 8.6 },
//   { id: 3, name: "Tenet",        rating: 7.4 },
// ]
```

**Why Map instead of `find()`?**
- `Array.find()` inside `Array.map()` = O(n²) — slow for 10 000+ movies
- `Map.get()` = O(1) — fast regardless of dataset size
- Always pre-index the lookup side into a Map when joining

**Interviewer follow-up — what if names don't match exactly (casing)?**
```javascript
// Normalise both sides to lowercase before building the map
const ratingMap = new Map(
  movieRatings.map(({ name, rating }) => [name.toLowerCase(), rating])
);
const result = moviesById.map(({ id, name }) => ({
  id,
  name,
  rating: ratingMap.get(name.toLowerCase()) ?? "N/A",
}));
```

---

### Q22 [ADVANCED]: Deep-merge two objects of different types — explain thoroughly.

**A:** A shallow merge (`Object.assign` / spread `{...a, ...b}`) only copies top-level keys. If both objects have the same nested key, the second one fully overwrites the first. Deep merge **recursively** merges nested objects while preserving keys unique to each side.

**ELI5:** Shallow merge is like packing two suitcases — the second suitcase replaces the first. Deep merge is like packing each drawer inside the suitcase individually — you merge what's inside each drawer instead of throwing the whole drawer away.

**Edge cases to handle:**
| Case | Rule |
|---|---|
| Both values are plain objects | Recurse |
| Both values are arrays | Depends on strategy: concat / overwrite / merge by index |
| One is object, other is primitive | Second wins (overwrite) |
| null / undefined | Treat null as "no value" — fallback to other side |
| Dates, RegExp, class instances | Copy by reference (don't try to merge internals) |
| Circular references | Guard with a WeakSet |

```javascript
/**
 * Deep merge — second object wins for primitives,
 * both objects merged recursively.
 * Arrays: concatenated (change strategy as needed).
 */
function isPlainObject(val) {
  return val !== null && typeof val === "object" && !Array.isArray(val)
    && Object.getPrototypeOf(val) === Object.prototype;
}

function deepMerge(target, source, seen = new WeakSet()) {
  // Guard against circular refs
  if (seen.has(source)) return target;
  if (isPlainObject(source)) seen.add(source);

  // Both plain objects → recurse
  if (isPlainObject(target) && isPlainObject(source)) {
    const output = { ...target };
    for (const key of Object.keys(source)) {
      output[key] = deepMerge(target[key], source[key], seen);
    }
    return output;
  }

  // Both arrays → concatenate (alter to overwrite if preferred)
  if (Array.isArray(target) && Array.isArray(source)) {
    return [...target, ...source];
  }

  // Primitives / mixed types → source wins
  return source !== undefined ? source : target;
}

// ── Example ──────────────────────────────────────────────
const movieMeta = {
  id: 101,
  title: "Inception",
  credits: { director: "Christopher Nolan", starring: ["DiCaprio"] },
  tags: ["sci-fi"],
};

const movieStats = {
  rating: 9.3,
  views: 5_000_000,
  credits: { producer: "Emma Thomas", starring: ["Cillian Murphy"] }, // overlapping key
  tags: ["thriller"],
};

const merged = deepMerge(movieMeta, movieStats);
console.log(merged);
/*
{
  id: 101,
  title: "Inception",
  rating: 9.3,
  views: 5000000,
  credits: {
    director: "Christopher Nolan",
    producer: "Emma Thomas",                // from movieStats
    starring: ["DiCaprio", "Cillian Murphy"] // arrays concatenated
  },
  tags: ["sci-fi", "thriller"]
}
*/
```

**Production alternative:** Use [lodash `_.merge`](https://lodash.com/docs/#merge) which handles these edge cases and is battle-tested.

---

### Q23 [INTERMEDIATE]: Write a React component demonstrating both debouncing AND throttling — where each applies.

**A:** Use the **same search input** to illustrate both:
- **Debounce** the API call (fire only after the user *stops* typing 500ms)
- **Throttle** the "save draft" call (fire at most once every 1 second *while* typing)

**ELI5:**
- **Debounce** = a lazy secretary who only files paperwork when you stop handing them more for 30 seconds.
- **Throttle** = a bouncer letting one person in every 10 seconds no matter how many are in the queue.

```jsx
import { useState, useEffect, useRef, useCallback } from "react";

// ── Debounce hook ────────────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);   // cleanup: reset timer on new keystroke
  }, [value, delay]);
  return debouncedValue;
}

// ── Throttle hook ────────────────────────────────────────────────────────────
function useThrottle(fn, limit) {
  const lastCall = useRef(0);
  return useCallback((...args) => {
    const now = Date.now();
    if (now - lastCall.current >= limit) {
      lastCall.current = now;
      fn(...args);
    }
  }, [fn, limit]);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function SearchWithDraft() {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState([]);
  const [draftLog, setDraftLog] = useState([]);

  // 1️⃣  Debounce: search API fires only after 500ms of inactivity
  const debouncedQuery = useDebounce(query, 500);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return; }
    // Simulate API call
    console.log("🔍 Searching for:", debouncedQuery);
    setResults([`Result for "${debouncedQuery}" …`]);
  }, [debouncedQuery]);

  // 2️⃣  Throttle: draft saved at most once per second while typing
  const saveDraft = useCallback((text) => {
    const time = new Date().toLocaleTimeString();
    console.log("💾 Draft saved at", time);
    setDraftLog(prev => [...prev.slice(-4), `Saved at ${time}`]);
  }, []);

  const throttledSaveDraft = useThrottle(saveDraft, 1000);

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    throttledSaveDraft(val);   // throttle: fires at most 1×/sec
  }

  return (
    <div style={{ padding: 20 }}>
      <input
        value={query}
        onChange={handleChange}
        placeholder="Type to search…"
        style={{ width: 300, padding: 8 }}
      />

      <section>
        <h4>Search Results (debounced 500ms)</h4>
        {results.map((r, i) => <p key={i}>{r}</p>)}
      </section>

      <section>
        <h4>Draft Saves (throttled 1s)</h4>
        {draftLog.map((log, i) => <p key={i}>{log}</p>)}
      </section>
    </div>
  );
}
```

**When to use which:**
| Scenario | Pattern | Reason |
|---|---|---|
| Search-as-you-type API | **Debounce** | Don't call until user pauses |
| Window resize / scroll handler | **Throttle** | Keep UI responsive, limit rate |
| Button click (prevent double submit) | **Debounce** | Wait for final intent |
| Game / animation loop input | **Throttle** | Cap rate to frame budget |
| Autosave draft | **Throttle** | Periodic saves, not every keystroke |
| Form validation on blur | **Debounce** | Validate after typing stops |

---

### Q24 [ADVANCED]: What is CAP Theorem? Which database is better when — explain in detail.

**A:** CAP Theorem states that in a **distributed system**, when a network partition (P) occurs, you can provide at most **two** of three guarantees: **Consistency (C)**, **Availability (A)**, or **Partition Tolerance (P)**.

Since network partitions are **unavoidable** in distributed systems, the real choice is **CP vs AP** (P is always required).

**ELI5:** Imagine 3 bank branches connected by phone lines. If the phone line between any two branches cuts (network partition), you must choose:
- **CP (be consistent):** "Lock all branches until line is restored — no transactions until we're sure all branches agree." (Safe but unavailable)
- **AP (stay available):** "Let each branch keep operating and accepting transactions — reconcile differences when line is restored." (Available but may have conflicts)

**The three guarantees:**

| Guarantee | Meaning |
|---|---|
| **C — Consistency** | Every read sees the most recent write (strong consistency — all nodes agree) |
| **A — Availability** | Every request receives a response (not necessarily the latest data) |
| **P — Partition Tolerance** | System continues operating even when network partitions occur |

**CP vs AP — Real Database Examples:**

```
CP Databases (Consistency + Partition Tolerance):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MongoDB (w: "majority")  → strong consistency, may reject writes during partition
  PostgreSQL (with replication)
  HBase, Zookeeper, etcd
  Redis (in cluster mode with strong settings)

  ✅ Use when: financial data, inventory, user auth, anything where stale data = wrong
  ❌ Trade-off: becomes unavailable during partition

AP Databases (Availability + Partition Tolerance):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Cassandra, CouchDB, DynamoDB (default)
  MongoDB (w: 1 — eventual consistency)
  Amazon S3

  ✅ Use when: social feeds, product catalogs, analytics, DNS, shopping carts
  ❌ Trade-off: may serve stale data after a partition

CA (no partition tolerance) — only in single node / non-distributed:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Single-node MySQL, PostgreSQL (no replication)
  Not realistic in production distributed systems
```

**Choosing the right database — decision matrix:**

| Use Case | Recommended DB | CAP Type | Why |
|---|---|---|---|
| Banking / payments | PostgreSQL, MongoDB (majority write) | CP | Stale data = financial loss |
| Real-time inventory (IRCTC ticket slots) | Redis + PostgreSQL | CP | Overselling is a hard error |
| User auth / sessions | Redis, PostgreSQL | CP | Stale auth = security issue |
| Social media feeds / likes | Cassandra, DynamoDB | AP | Slightly stale count is OK |
| Product catalog / search | Elasticsearch, DynamoDB | AP | Slightly stale content is fine |
| Analytics / event logs | Cassandra, ClickHouse | AP | Availability > perfect counts |
| Shopping cart (can merge later) | DynamoDB, CouchDB | AP | Users keep adding without blocks |
| Real-time chat messages | MongoDB, Cassandra | AP | High write throughput needed |
| Config / coordination (k8s, etc.) | etcd, Zookeeper | CP | Distributed coordinate must agree |

**PACELC extension (more realistic model):**

CAP only discusses partition scenarios. PACELC extends it:
- Even without partitions, there is a trade-off between **Latency (L)** and **Consistency (C)**
- Strong consistency requires synchronous replication → higher latency
- Eventual consistency allows async replication → lower latency

```
MongoDB → PA/EC: AP during partition, Eventual Consistency during normal ops
DynamoDB → PA/EL: AP during partition, lower latency (eventual) during normal ops
PostgreSQL (sync replication) → PC/EC: CP during partition, consistent during normal ops
```

**Interview summary answer:**
> "CAP says distributed systems can't have both consistency and availability during a partition. Since partitions happen in real networks, I choose between CP (consistent but might become unavailable — banking, inventory) and AP (always available but may serve stale — social feeds, analytics). The right choice depends entirely on whether stale data causes a business-critical error."

---

## React

**Category:** Component Framework & State Management | **Questions:** 27+ | **Level:** Basic → Advanced

React revolutionized front-end development with components and hooks. These questions cover core concepts, performance optimization, advanced patterns, and architectural decisions.

### Q1 [BASIC]: What is the Virtual DOM and how does React use it?

**A:** The Virtual DOM is a lightweight JavaScript object tree mirroring the real DOM. React never touches the real DOM directly. On every state change:
1. React produces a NEW vDOM tree
2. Diffing algorithm (Reconciler) compares old vs new tree (O(n) heuristic)
3. Only the minimal set of real DOM mutations are applied (commit phase)

**Why?** Direct DOM manipulation is slow because DOM operations trigger layout/paint. Batching changes via vDOM minimizes reflows.

**Important nuance (React 18+):** React uses Fiber architecture — not a single "vDOM tree" but a linked list of Fiber nodes that allows pausing, aborting, and replaying work.

**ELI5:** You keep a quick sketch in your head, compare it to the real drawing, and only update what actually changed. This makes updates super fast.

---

### Q2 [BASIC]: Rules of Hooks — why do they exist?

**A:** Two rules:
1. Only call Hooks at the TOP LEVEL (not inside loops, conditions, nested functions)
2. Only call Hooks from React functions (components or custom hooks)

**WHY:** React identifies hooks by their CALL ORDER, not by name. Hooks are stored in a simple array. If you conditionally call a hook, the call order changes between renders → React reads the wrong hook's state → bugs.

**ELI5:** Imagine you have a filing cabinet with drawers. React remembers which drawer is which by counting from the top. If you skip a drawer sometimes, React gets confused and grabs the wrong file.

---

### Q3 [BASIC]: What is the difference between controlled and uncontrolled components?

**A:**
- **Controlled:** React state is the single source of truth. Every input change updates state. React controls the value.
- **Uncontrolled:** DOM is the source of truth. You read the value via a ref when needed. Simpler for simple forms; harder to validate.

**ELI5:** Controlled is like having a puppet master who pulls strings to control every move. Uncontrolled is like a puppet that moves on its own and you just watch.

---

### Q4 [INTERMEDIATE]: When does React re-render, and how do you prevent unnecessary re-renders?

**A:** React re-renders a component when:
1. Its own state changes (setState)
2. Its parent re-renders (even if props didn't change — by default!)
3. A context it subscribes to changes
4. Its ref is attached to a different element

**Prevention tools:**
- `React.memo` → skips re-render if props are shallowly equal
- `useMemo` → memoize expensive computed values
- `useCallback` → memoize callback references
- `useSyncExternalStore` → subscribe to external stores efficiently

**ELI5:** Re-rendering is like refreshing a web page. We avoid unnecessary refreshes using memo (skip if props same), useMemo (remember expensive math), and useCallback (remember function reference).

---

### Q5 [INTERMEDIATE]: How does useEffect cleanup work and what are common mistakes?

**A:** The cleanup function runs:
1. Before the NEXT effect execution (if deps changed)
2. On component UNMOUNT

React 18 StrictMode double-invokes effects (mount → cleanup → mount) in dev to catch missing cleanups.

**ELI5:** Cleanup is like unplugging a lamp when you leave a room so it doesn't keep burning. If you set up a WebSocket, you need to close it when the component is done. Otherwise, the old connection keeps running → leak.

---

### Q6 [INTERMEDIATE]: Context API — when should you NOT use it for state?

**A:** Context causes ALL consumers to re-render when the context VALUE changes, even if the consuming component doesn't use the changed part. Context is optimized for INFREQUENTLY changing data.

**Good for:** theme, locale, auth user, feature flags
**Bad for:** frequently changing state (mouse position, scroll, form fields)

**ELI5:** Context is like a town bulletin board - when the notice changes, everyone who watches it looks at it. If you change the notice 1000 times a second, everyone wastes time checking constantly.

---

### Q7 [ADVANCED]: Explain React Fiber Architecture and Concurrent Mode.

**A:** 
**Before Fiber (React <16):** reconciliation was synchronous and RECURSIVE. Once started, it couldn't be interrupted → long renders blocked the main thread → janky UI.

**Fiber (React 16+):** reconciliation is an ITERATIVE linked-list traversal. Each unit of work (fiber) is processed incrementally. Enables:
- Pausing work when higher priority work arrives (e.g., user input)
- Resuming, aborting, and replaying units of work
- Concurrent rendering: multiple "in-progress" trees simultaneously

**Concurrent Mode (React 18 opt-in):** Enables concurrent features: useTransition, useDeferredValue, Suspense for data.

**ELI5:** Imagine reading a book but your friend keeps interrupting. Use Fiber to pause where you are, handle your friend, then come back to the same page instead of always restarting from chapter 1.

---

### Q8 [ADVANCED]: How does React's Reconciliation (diffing) algorithm work?

**A:** React's diffing is O(n) using two heuristics:
1. Different element types → tear down old tree, mount new one entirely
2. Same element type → update props in place
3. Same type + key → same instance (moved if position changed)

The `key` prop is critical: it tells React that an element's identity is stable even if it moves in the list.

**ELI5:** Diffing is like comparing two photos. React marks what's different, updates only those parts, and ignores what's the same. Without keys, React doesn't know if a list item moved or is new, so it guesses wrong.

---

### Q9 [ADVANCED]: useSyncExternalStore — the correct pattern for subscribing to external stores.

**A:** React 18 introduced useSyncExternalStore to safely subscribe to external mutable stores (Redux, Zustand, browser APIs). Prevents "tearing" — where concurrent mode could render different UI with different store values.

**ELI5:** useSyncExternalStore is like Redux for the outside world. It makes sure external data stays in sync without React's batching causing weird situations.

---

### Q10 [ADVANCED]: Server Components vs Client Components — deep dive into the execution model.

**A:**
**Server Components:**
- Execute ONLY on the server (never sent to browser, zero bundle cost)
- Can async/await directly (no useEffect, no state)
- Can access server resources directly (DB, file system, ORM)
- Props must be serializable

**Client Components:**
- Execute both on server (for SSR) AND in the browser
- Can use hooks, event handlers, browser APIs
- Add to JS bundle (to be hydrated)

**Composition rule:**
- SC can import and render CC
- CC CANNOT import SC (would try to ship SC logic to browser)
- But CC CAN receive SC as `children`

**ELI5:** Server Components are like a restaurant's back kitchen (hidden from customers). Client Components are the dining room. The kitchen can send plates to the dining room, but you can't install a kitchen in the dining room.

---

### Q11 [ADVANCED]: How does React handle batching in React 18 vs React 17?

**A:**
- **React 17:** batching only inside React event handlers. Multiple setState in setTimeout, fetch, native events → each caused a separate render.
- **React 18 (createRoot):** AUTOMATIC BATCHING everywhere. All setState calls batched regardless of where they are.

**ELI5:** Batching is like collecting all your dishes and washing them together instead of washing each plate as soon as you dirty it. React 18 does this automatically everywhere.

---

### Q12 [INTERMEDIATE]: React.memo, useMemo, and useCallback — when to use each?

**A:** All three memoize different things. Misuse creates unnecessary overhead.

- **React.memo:** wraps a COMPONENT to skip re-render if props are shallowly equal
- **useMemo:** caches a COMPUTED VALUE across renders
- **useCallback:** caches a FUNCTION REFERENCE across renders

**Key rule:** Use memoization ONLY when profiling shows a real performance problem.

**ELI5:** React.memo is like a photo so you don't look again if nothing changed. useMemo is like remembering you already ate so you don't cook again. useCallback is like remembering where you put your keys.

---

### Q13 [INTERMEDIATE]: Design patterns in React — HOC, Render Props, Custom Hooks, Compound Components

**A:** Multiple patterns for composing and sharing logic:

1. **HOC:** function that takes component, returns enhanced component
2. **Render Props:** component accepts function prop that returns JSX
3. **Custom Hooks:** extract logic into a hook (modern, preferred)
4. **Compound Components:** related components work together via shared Context

**ELI5:** These are different ways to package and reuse logic across components. Custom Hooks are the modern preferred approach.

---

### Q14 [INTERMEDIATE]: Axios vs Fetch on top of React Query — layered mental model

**A:** Mental model layers:
- **Bottom:** Fetch/Axios (HTTP request layer)
- **Middle:** React Query (cache + sync layer)
- **Top:** React components (consume data)

**Fetch:** browser API, no built-in retry/cache; verbose
**Axios:** third-party, better DX (interceptors, auto JSON); slightly heavier
**React Query:** sits ABOVE both; handles caching, bg refetch, stale-while-revalidate, deduplication

---

### Q15 [ADVANCED]: How to design a front-end application like Jira for performance and accessibility

**A:** Large-scale apps need architectural decisions.

**Performance:**
1. Virtualization for long lists (react-window) — render only visible items
2. Suspense + lazy loading — split code by route
3. Debounce search input — reduce API calls
4. Memoization wisely — profile first

**Accessibility:**
1. Keyboard navigation with roving tabindex
2. ARIA labels, semantic HTML
3. Focus management in modals
4. Color contrast, readable fonts

---

### Q16 [INTERMEDIATE]: Webpack basics for React — bundling, tree-shaking, code splitting

**A:** Webpack is a static module bundler. React needs a bundler because:
1. Browsers cannot understand JSX or TypeScript natively — must be transpiled
2. node_modules imports don't work in browsers
3. Code splitting — only load JS the current page needs
4. Asset optimisation — minify JS, tree-shake dead code, fingerprint filenames

---

### Q17 [ADVANCED]: Webpack Tree Shaking and Code Splitting — static vs dynamic

**A:** 
- **Tree shaking:** eliminates DEAD CODE — exports imported nowhere
- **Code splitting:** breaks bundle into chunks loaded on demand

`React.lazy()` + dynamic `import()` enables route-level code splitting.

---

### Q18 [ADVANCED]: Webpack Module Federation and micro-frontends

**A:** Module Federation (webpack 5) lets SEPARATE webpack builds share modules at RUNTIME. Each app exposes and consumes modules from other deployed apps without rebuilding.

**Host:** consumes remotes
**Remote:** independently deployed app that exposes modules
**Shared:** modules shared to avoid loading React twice (singleton requirement)

---

### Q19 [BASIC]: Why does React need a bundler? What are loaders and plugins?

**A:** Bundlers transform source files into browser-compatible bundles.

**Loaders:** transform non-JS files (babel-loader for JSX, css-loader for CSS)
**Plugins:** broader transformations (HtmlWebpackPlugin, MiniCssExtractPlugin)

---

### Q20 [ADVANCED]: How to extend/inherit styles using CSS preprocessors (@extend, @mixin)

**A:** CSS preprocessors enable class inheritance and style composition:

- **@extend:** inherit all styles from another class (single inheritance)
- **@mixin:** reusable style blocks with optional parameters

---

### Q21 [BASIC]: What are Lambda Functions (arrow functions) in React — usage, pitfalls, and performance?

**A:** In React, "lambda function" refers to using an **arrow function directly inline in JSX** as an event handler (or callback). While extremely common and readable, they have specific performance implications worth understanding.

**ELI5:** An arrow function in JSX is like writing a new sticky note every time you render the component. Every render creates a fresh sticky note even if the instructions are identical. React's reconciler sees a new function reference every time and treats it as a change — which can waste work in child components that rely on stable references.

**Basic usage:**
```jsx
// Lambda / arrow function used inline in JSX
function Button() {
  return (
    <button onClick={() => console.log("clicked")}>
      Click me
    </button>
  );
}
```

**Three ways to define event handlers — comparison:**
```jsx
import { useCallback, useState } from "react";

function ParentComponent() {
  const [count, setCount] = useState(0);

  // ❌ Method 1: Inline lambda — new function reference every render
  // Fine for simple cases, but breaks memoization on children
  const handleInline = () => setCount(c => c + 1);

  // ✅ Method 2: Defined outside JSX (still new ref per render, but cleaner)
  function handleNamed() {
    setCount(c => c + 1);
  }

  // ✅ Method 3: useCallback — stable reference across renders
  const handleMemoized = useCallback(() => {
    setCount(c => c + 1);
  }, []); // empty deps → same function reference forever

  return (
    <div>
      {/* Inline lambda — creates new fn every render */}
      <ChildA onClick={() => setCount(c => c + 1)} />     {/* ❌ re-renders ChildA every time */}

      {/* Stable via useCallback */}
      <ChildA onClick={handleMemoized} />                  {/* ✅ ChildA only re-renders when fn changes */}
    </div>
  );
}

// Child only re-renders when its props actually change
const ChildA = React.memo(({ onClick }) => {
  console.log("ChildA rendered");
  return <button onClick={onClick}>Up</button>;
});
```

**When does it actually matter?**
```
Inline lambda is fine when:
  ✅ The child is NOT wrapped in React.memo
  ✅ The component renders infrequently
  ✅ Simple UI elements (plain <button>, <input>)
  ✅ It closes over loop variables in a list:
     items.map(item => <li key={item.id} onClick={() => select(item.id)}>{item.name}</li>)
     (passing item.id without useCallback is correct here)

Use useCallback when:
  ✅ The child IS wrapped in React.memo (otherwise memo is useless)
  ✅ The function is a useEffect dependency
  ✅ The function is passed to a context consumer used by many children
  ✅ The function is passed to a child that renders a long list/virtualized list
```

**Lambda in class components (older pattern):**
```jsx
// Class component — same pitfall
class MyList extends React.Component {
  // ❌ Inline lambda in render — creates new fn every render
  render() {
    return this.props.items.map(item =>
      <Item key={item.id} onClick={() => this.handleClick(item.id)} />
    );
  }

  // ✅ Arrow class field — bound once on construction
  handleClick = (id) => {
    console.log("clicked", id);
  };

  // But you still face a new lambda per item in the map above.
  // Solution: pass the id as a data attribute and read from event.currentTarget.dataset
  renderOptimised() {
    return this.props.items.map(item =>
      <Item key={item.id} data-id={item.id} onClick={this.handleClick} />
    );
  }
}
```

**Common interview pitfalls:**
| Scenario | Issue | Fix |
|---|---|---|
| `onClick={() => doSomething()}` on a `React.memo` child | Creates new ref → memo skipped | `useCallback` |
| `useEffect([handler])` with inline lambda as dep | Effect fires every render | `useCallback` for the handler |
| `<form onSubmit={e => { e.preventDefault(); ... }}>` | Fine — form itself doesn't memo | Keep inline |
| `items.map(x => <Row onClick={() => del(x.id)} />)` | Each item gets new fn per render | Acceptable if Row isn't memo'd; use `useCallback` + `data-id` pattern if perf-critical |

**Interview summary:**
> "Lambda / arrow functions in JSX are convenient but create a new function reference on every render. This is fine for most cases, but when paired with `React.memo` or as `useEffect` deps, you need `useCallback` to stabilise the reference. The golden rule: memoize the callback **only if the child is memoised** — otherwise it's premature optimisation."

---

### Q23 [ADVANCED]: How does Hot Module Replacement (HMR) work in React?

**A:** HMR lets the browser receive updated modules **without a full page reload**, preserving application state.

**ELI5:** Imagine editing a LEGO model. HMR is like swapping out one brick without knocking down the whole model. A full reload is like destroying the model and rebuilding from scratch.

**How it works step by step:**

```
1. You save a file (e.g. Button.jsx)
   │
2. Webpack / Vite detects the change via a filesystem watcher
   │
3. The bundler recompiles ONLY the changed module + its dependents
   │
4. The dev server pushes the new module code over a WebSocket
   connection to the browser
   │
5. The HMR runtime in the browser receives the update
   │
6. React Fast Refresh (Facebook's HMR integration) re-evaluates
   the module and patches the running component tree:
   ┌──────────────────────────────────────────────────┐
   │ If only render logic changed → re-render in place │
   │ (state PRESERVED)                                 │
   │ If hooks changed (count/order) → full remount     │
   │ (state RESET for that component)                  │
   └──────────────────────────────────────────────────┘
   │
7. Browser shows update — no page reload, no state lost
```

**React Fast Refresh vs old react-hot-loader:**
| | react-hot-loader (old) | React Fast Refresh (current) |
|---|---|---|
| Built into React | No (third-party) | Yes (official, React 16.9+) |
| Hook support | Partial | Full |
| Reliability | Buggy on complex apps | Robust |
| Used by | Legacy Webpack setups | Vite, CRA, Next.js |

**Key files involved (Vite + React example):**
- `@vitejs/plugin-react` injects Fast Refresh transform into every component module
- Every component must export **only** React components from that file for HMR to work — mixing non-component exports forces a full reload

**When HMR falls back to full reload:**
1. Changes to global CSS (can't hot-patch, must recalculate)
2. Changes to non-React modules (config files, plain JS utilities used in many places)
3. Component file exports both a component and arbitrary JS — Fast Refresh gives up

---

### Q24 [ADVANCED]: How does diffing (Reconciliation) work in React — deep dive?

**A:** React's diffing produces the minimum set of DOM mutations needed to go from the old UI to the new one.

**ELI5:** Think of two versions of a Word document. Instead of reprinting the whole document, a smart diff tool finds only the changed lines and patches them. React does this for the DOM.

**The three heuristics (O(n) algorithm):**

```
Heuristic 1 — Element type changed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Old: <div>…</div>
New: <span>…</span>
→ Tear down entire old subtree (unmount, cleanup, destroy DOM)
→ Mount new subtree from scratch
→ All child component state is DESTROYED

Why: React assumes different types = entirely different UI.

──────────────────────────────────────────────────────────────

Heuristic 2 — Same element type, different props
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Old: <input type="text" className="old" />
New: <input type="text" className="new" />
→ Keep the same DOM node, update only changed attributes
→ Component state is PRESERVED

──────────────────────────────────────────────────────────────

Heuristic 3 — Lists: key prop drives identity
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Without key (bad):
  Old: [A, B, C]
  New: [X, A, B, C]   ← X prepended
  → React compares position 0→0, 1→1… mutates A→X, B→A, C→B, mounts C
  → 3 mutations + 1 mount = expensive + state lost

With key (correct):
  Old: [{key:A}, {key:B}, {key:C}]
  New: [{key:X}, {key:A}, {key:B}, {key:C}]
  → React sees A, B, C are the SAME nodes by key, just repositioned
  → Only X is created; A/B/C are moved in DOM
  → 1 mount, 3 moves = efficient + state PRESERVED
```

**Fiber reconciler internals (React 16+):**

```
Single render produces a Fiber tree (doubly-linked list):
  Each Fiber node = one component / DOM element
  Contains: type, key, props, stateNode, child, sibling, return

Work loop processes one Fiber at a time (interruptible):
  beginWork  → diff props, schedule child fibers
  completeWork → collect DOM mutations into "effect list"
  commitWork → flush all mutations in a single synchronous pass
```

**Why keys must NOT be array indexes for dynamic lists:**
```jsx
// ❌ WRONG — using index as key
items.map((item, i) => <Item key={i} name={item.name} />)
// If item 0 is deleted, everything shifts → React re-renders EVERY item

// ✅ CORRECT — stable unique ID
items.map(item => <Item key={item.id} name={item.name} />)
// Only the deleted item unmounts; siblings are untouched
```

**React 18 Concurrent Mode adds:**
- **Priority lanes:** High-priority updates (user input) can interrupt low-priority renders (data fetching)
- **useTransition:** marks a state update as "non-urgent" — diffing starts but can be paused
- **useDeferredValue:** like debouncing at the React tree level

---

### Q25 [ADVANCED]: What security parameters should you implement in a React / Next.js app?

**A:** Frontend security is often overlooked but critical. Think in layers: **what you render, how you fetch, what you store, how you authenticate**.

**ELI5:** Securing a React app is like building a house with locks on every door, not just the front. XSS is someone injecting poisonous graffiti on your walls. CSRF is someone forging your signature on a document. You stop both with the right locks and checks.

**1. Prevent XSS (Cross-Site Scripting)**
```jsx
// ❌ Never use dangerouslySetInnerHTML with user input
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ React escapes text by default — use plain JSX
<div>{userInput}</div>

// ✅ If you MUST render HTML (rich text editor output), sanitise first
import DOMPurify from "dompurify";
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(richTextHTML) }} />
```

**2. Content Security Policy (CSP)**
```
// In Next.js: set via next.config.js headers or middleware
// Prevents inline scripts, restricts where scripts can load FROM
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none';
```

**3. Protect Auth tokens — where to store them**
| Storage | XSS Risk | CSRF Risk | Recommendation |
|---|---|---|---|
| localStorage | HIGH (accessible from JS) | Low | ❌ Never store tokens here |
| sessionStorage | HIGH | Low | ❌ Same problem |
| Memory (React state) | Low | Low | ✅ Short-lived, cleared on refresh |
| HttpOnly Cookie | None (JS can't read) | Med (need SameSite) | ✅ Best for auth tokens |

```
// Ideal cookie settings for auth token
Set-Cookie: token=…; HttpOnly; Secure; SameSite=Strict; Path=/
```

**4. CSRF Protection (for cookie-based auth)**
```
// Use SameSite=Strict on cookies — blocks cross-site requests
// For APIs using cookies: validate CSRF token in header (double submit cookie)
// Next.js Server Actions: use CSRF token from getServerSideProps or middleware
```

**5. Environment variables — never expose secrets in client bundle**
```
// ❌ WRONG — exposed to browser bundle
NEXT_PUBLIC_DB_PASSWORD=secret

// ✅ CORRECT — server only (no NEXT_PUBLIC_ prefix)
DB_PASSWORD=secret  → accessible only in Server Components / API Routes

// ✅ Client-safe (only public keys)
NEXT_PUBLIC_STRIPE_KEY=pk_live_...
```

**6. Dependency security**
```bash
npm audit          # check for known vulnerabilities
npm audit fix      # auto-fix compatible versions
# Use Dependabot or Snyk for continuous monitoring in CI/CD
```

**7. Secure API calls**
```jsx
// Always validate responses — don't trust shape of data from APIs
// Use Zod / Yup to validate API responses before using
const data = UserSchema.parse(await res.json());

// Never use eval() or Function() on server responses
```

**8. Next.js specific**
- Server Actions: always re-validate auth inside the action (never trust client)
- Middleware: apply auth checks before page render
- `next.config.js`: enable `headers()` for security headers (X-Frame-Options, X-Content-Type-Options, HSTS)

```javascript
// next.config.js — security headers
const securityHeaders = [
  { key: "X-Frame-Options",          value: "DENY" },
  { key: "X-Content-Type-Options",   value: "nosniff" },
  { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(), microphone=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];
```

**Quick security checklist:**
- [ ] No `dangerouslySetInnerHTML` without DOMPurify
- [ ] CSP header set
- [ ] Auth tokens in HttpOnly cookies, not localStorage
- [ ] SameSite=Strict on cookies
- [ ] No secrets in NEXT_PUBLIC_ env vars
- [ ] `npm audit` in CI pipeline
- [ ] Security headers in next.config.js
- [ ] Server Actions validate auth internally

---

### Q26 [INTERMEDIATE]: What are WCAG standards (A, AA, AAA) — what must a frontend developer keep in mind?

**A:** WCAG (Web Content Accessibility Guidelines) defines how to make web content accessible to people with disabilities. Published by W3C. Current version: **WCAG 2.2**.

**ELI5:** Imagine your app must work for someone who is blind (using a screen reader), someone who can't use a mouse (only keyboard), someone with colour blindness, and someone with slow cognitive processing. WCAG gives you specific checkboxes to make sure none of these users are locked out.

**The three conformance levels:**

| Level | Meaning | Who needs it | Examples |
|---|---|---|---|
| **A** (minimum) | Removes the biggest blockers | All public websites | Alt text, keyboard access, no seizure-inducing flashes |
| **AA** (standard) | Industry-standard accessibility | Government sites, enterprise, most apps | 4.5:1 contrast ratio, captions for video, reflow on 320px |
| **AAA** (enhanced) | Maximum accessibility | Specialised accessibility-first sites | 7:1 contrast, sign language, no time limits anywhere |

**Most important rules to remember for interviews (POUR principles):**

```
PERCEIVABLE — Users can perceive the content
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Alt text on all meaningful images (A)
   <img src="chart.png" alt="Sales grew 30% in Q3" />
   
✅ Captions/audio descriptions for video (A for prerecorded, AA for live)
✅ Colour contrast: 4.5:1 for normal text, 3:1 for large text (AA)
   Use tool: webaim.org/resources/contrastchecker
✅ Don't use colour alone to convey meaning — add icon or text (A)
✅ Text can be resized 200% without losing content (AA)

OPERABLE — Users can operate the UI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All functionality via keyboard (no mouse required) (A)
   Tab to every interactive element, Enter/Space to activate
✅ Visible focus indicator (AA) — never remove :focus outline
✅ Skip navigation link (bypass block) (A)
✅ No keyboard traps (A)
✅ No flashing content > 3 times/second (A) — can trigger seizures
✅ Enough time to interact (no 2-second auto timeouts) (A)

UNDERSTANDABLE — Users can understand the content
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Set <html lang="en"> (A) — screen readers need this for pronunciation
✅ Error messages must identify the field and suggest a fix (AA)
✅ Consistent navigation across pages (AA)
✅ Labels associated with all form inputs (A)
   <label htmlFor="email">Email</label> <input id="email" />
   OR use aria-label / aria-labelledby

ROBUST — Content works with assistive technology
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Valid HTML (no broken tags, correct nesting) (A)
✅ ARIA roles only where semantic HTML can't do the job (A)
✅ Name, Role, Value for all UI components (A)
```

**Practical ARIA patterns for React:**
```jsx
// Modal — must trap focus and announce role
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">Confirm deletion</h2>
  …
</div>

// Loading state
<button aria-busy={isLoading} aria-label={isLoading ? "Saving…" : "Save"}>
  {isLoading ? <Spinner /> : "Save"}
</button>

// Icon-only button — must have label
<button aria-label="Close dialog">
  <XIcon aria-hidden="true" />
</button>

// Live region — for dynamic content like search results count
<p aria-live="polite" aria-atomic="true">
  {resultCount} results found
</p>
```

**Testing tools:**
- **axe DevTools** (browser extension) — automated A/AA audit
- **Lighthouse** (Chrome DevTools → Accessibility score)
- **Screen reader test:** NVDA (Windows), VoiceOver (Mac/iOS), TalkBack (Android)
- **Keyboard test:** unplug the mouse and try to use the app completely

**Interview summary:**
> "A is the minimum — if you fail these, large groups of users can't use your app at all. AA is the industry standard — required by law in many countries (ADA, EU EAA). AAA is aspirational. I always aim for AA: semantic HTML first, ARIA only when needed, keyboard-navigable, 4.5:1 colour contrast, accessible form labels and error messages."

---

### Q27 [ADVANCED]: How do you identify that your frontend app is slow / non-performant, and what do you do?

**A:** Performance diagnosis has two phases: **measuring** (find what's slow) then **fixing** (targeted improvements). Never optimise without measuring first.

**ELI5:** Before fixing a car that won't go fast, you put it on a diagnostic machine to see which part is broken. You don't replace the engine if the tyres are flat. Same logic for frontend performance.

**Phase 1 — Measure: Tools and Metrics**

```
Core Web Vitals (Google's user-centric metrics):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LCP (Largest Contentful Paint)   → loading    → aim for < 2.5s
  FID / INP (Interaction to Next Paint) → interactivity → aim for < 200ms
  CLS (Cumulative Layout Shift)    → visual stability → aim for < 0.1

Other important metrics:
  TTFB (Time to First Byte)        → server response speed  < 800ms
  FCP (First Contentful Paint)     → first pixel shown       < 1.8s
  TBT (Total Blocking Time)        → JS blocking main thread < 200ms
```

**Where to check:**
1. **Lighthouse (Chrome DevTools → Lighthouse tab):** Runs full audit, gives score 0-100 for Performance, Accessibility, SEO, Best Practices. Run in Incognito to avoid extension noise.
2. **Chrome DevTools → Performance tab:** Record a session, see flame chart — identify long tasks (>50ms = blocking), layout thrash, paint storms
3. **Chrome DevTools → Network tab:** Waterfall chart — identify render-blocking resources, large bundles, slow API calls
4. **Web Vitals extension / `web-vitals` npm package:** measure real user metrics in production
5. **Google PageSpeed Insights / Search Console:** field data from real users (CrUX dataset)

**Phase 2 — Fix: Targeted improvements**

```
PROBLEM: Large JavaScript bundle (high TBT / slow TTI)
FIX:
  ✅ Code splitting: React.lazy + dynamic import() per route
  ✅ Tree shaking: use ES modules, avoid barrel imports (index.ts nightmare)
  ✅ Bundle analysis: webpack-bundle-analyzer / Vite rollup-plugin-visualizer
  ✅ Move big libraries to server (e.g., marked, moment → only needed server-side)

PROBLEM: Slow LCP (hero image or heading takes too long)
FIX:
  ✅ Preload LCP image: <link rel="preload" as="image" href="hero.webp" />
  ✅ Use modern image formats: WebP / AVIF (30-50% smaller than JPEG)
  ✅ Next.js <Image> component: lazy, WebP, responsive srcset auto-generated
  ✅ CDN for static assets (CloudFront / Vercel Edge)

PROBLEM: High CLS (layout jumps)
FIX:
  ✅ Reserve space for images and ads: width + height attributes / aspect-ratio CSS
  ✅ Don't inject content above existing content dynamically
  ✅ Use font-display: swap + preload fonts to avoid FOIT

PROBLEM: Many render-blocking resources
FIX:
  ✅ Defer non-critical CSS (critical CSS inline, rest async)
  ✅ async / defer on <script> tags
  ✅ Remove unused CSS (PurgeCSS for Tailwind, CSS Modules scope by default)

PROBLEM: Slow API / data-fetching waterfall
FIX:
  ✅ Parallel fetches: Promise.all instead of sequential awaits
  ✅ Prefetch on hover/focus (React Query prefetchQuery)
  ✅ Stale-while-revalidate caching
  ✅ Move data fetching to Server Components (Next.js) — zero client JS overhead

PROBLEM: Expensive renders / slow interactions (high INP)
FIX:
  ✅ Profile with React DevTools Profiler — find which component re-renders excessively
  ✅ React.memo + useCallback + useMemo (profile first, memoize second)
  ✅ Virtualize long lists: react-window / react-virtual
  ✅ Avoid anonymous functions in render — they break memoization
  ✅ useTransition for non-urgent state updates
```

**Lighthouse score improvement checklist:**
- [ ] Compress images (WebP/AVIF, correct sizing)
- [ ] Enable gzip/Brotli compression on server
- [ ] Code-split at route level
- [ ] Remove render-blocking scripts
- [ ] Set cache headers on static assets (`Cache-Control: max-age=31536000, immutable`)
- [ ] Preconnect to CDN / font origins
- [ ] Remove unused JavaScript and CSS
- [ ] Reserve layout space for dynamic content

---

### Q28 [ADVANCED]: What is Isomorphic React (Universal Rendering)?

**A:** Isomorphic React means the **same React component code** runs on BOTH the server AND the browser — the server renders HTML first, the browser hydrates it into an interactive app.

**ELI5:** Imagine a restaurant where the kitchen (server) pre-cooks a meal for you. You receive a fully plated dish (HTML) instantly. Then your table's mini-kitchen (browser) "finishes" it — adding sauces, warming it up — making it fully interactive. Same recipe (components), two kitchens.

**The flow:**
```
1. Request → Node.js server calls ReactDOMServer.renderToString(<App />)
2. Server sends complete HTML → browser shows content immediately (FCP ↑)
3. Browser downloads React bundle
4. React "hydrates" — attaches event listeners to existing DOM (no re-render)
5. App is now fully interactive
```

**Why it matters:**
| Benefit | Detail |
|---|---|
| SEO | Search crawlers see full HTML, not a blank `<div id="root">` |
| FCP / LCP | User sees content before JS loads |
| Performance on slow devices | Less work in the browser |
| Accessible | Content visible even with JS disabled |

**React APIs for SSR:**
```javascript
// Server (Node.js)
import { renderToString } from 'react-dom/server';
const html = renderToString(<App />);
res.send(`<html><body><div id="root">${html}</div></body></html>`);

// Client (hydration)
import { hydrateRoot } from 'react-dom/client';
hidrateRoot(document.getElementById('root'), <App />);
```

**Modern equivalent — Next.js handles this automatically:**
- `export default function Page()` in App Router = Server Component = server-rendered
- `'use client'` = hydrated on the client
- No manual `renderToString` needed

**SPA vs Isomorphic:**
| | SPA (client-only) | Isomorphic |
|---|---|---|
| Initial HTML | Empty `<div>` | Full rendered HTML |
| SEO | Poor | Excellent |
| FCP | Slow (wait for JS) | Fast |
| Complexity | Low | Medium |

---

### Q29 [ADVANCED]: How do you apply Clean Architecture and SOLID principles in React components?

**A:**

**ELI5:** Clean Architecture is like a well-organised building. Business rules (domain logic) live in the core. Use cases surround them. The UI and APIs are the outer shell. The core NEVER depends on the outside layers — only outside depends on core.

**SOLID in React:**
| Principle | React Application |
|---|---|
| **S** — Single Responsibility | Each component does ONE thing. `UserCard` renders, `useUserData` fetches. Don't mix fetch + render + validation in one component |
| **O** — Open/Closed | Extend behaviour with props/composition without modifying the component. Add variants via props, not code changes |
| **L** — Liskov Substitution | A `<PrimaryButton>` can substitute wherever `<Button>` is expected — same contract |
| **I** — Interface Segregation | Split large prop interfaces. A `<Table>` shouldn't require sorting props it doesn't use. Create `<SortableTable>` separately |
| **D** — Dependency Inversion | Components depend on abstractions (hooks/interfaces), not concrete implementations. Pass `onFetch` as prop, not `axios.get()` hardcoded |

**Clean Architecture layers in React:**
```
UI Layer          (React components — render only)
  ↓ calls
Application Layer (custom hooks: useCreateOrder, useAuth)
  ↓ calls
Domain Layer      (pure business logic: validateOrder, calculateDiscount — no React)
  ↓ calls
Infrastructure    (API clients, localStorage, analytics)
```

**Practical example:**
```jsx
// ❌ BAD — mixed responsibilities
function OrderPage() {
  const [order, setOrder] = useState(null);
  useEffect(() => {
    fetch('/api/order/1').then(r => r.json()).then(setOrder);
  }, []);
  return <div>{order?.total > 100 ? 'FREE SHIPPING' : 'PAY SHIPPING'}</div>;
}

// ✅ GOOD — each layer separate
// Domain: pure logic (no React)
const isFreeShipping = (total) => total > 100;

// Infrastructure: API
const fetchOrder = (id) => fetch(`/api/order/${id}`).then(r => r.json());

// Application: custom hook
function useOrder(id) {
  const [order, setOrder] = useState(null);
  useEffect(() => { fetchOrder(id).then(setOrder); }, [id]);
  return order;
}

// UI: just renders
function OrderPage({ id }) {
  const order = useOrder(id);
  if (!order) return null;
  return <div>{isFreeShipping(order.total) ? 'FREE SHIPPING' : 'PAY SHIPPING'}</div>;
}
```

**Key takeaways:**
- Data fetching → custom hooks (application layer)
- Business logic → plain JS functions with no React imports (domain layer, easily unit-tested)
- UI components only receive data and render
- Test each layer independently: pure functions need no mocking

---

### Q30 [ADVANCED]: How do you optimize data fetching in React using GraphQL to ensure minimal performance overhead?

**A:**

**ELI5:** Without GraphQL, you call 5 APIs and get 100 fields each time you only need 10. With GraphQL, you write exactly what you want and the server sends exactly that — one trip, right amount of data.

**Problems GraphQL solves:**
| Problem | REST | GraphQL |
|---|---|---|
| Over-fetching | Full user object always returned | Request only `name, email` |
| Under-fetching | 3 round-trips for user+orders+items | One nested query |
| N+1 API calls | Multiple requests for list items | `DataLoader` batches DB calls |
| Type safety | OpenAPI optional | Schema is the source of truth |

**React optimization techniques:**

**1. Precise queries — request only needed fields**
```graphql
# BAD — over-fetching
query { user { id name email address orders { ... } } }

# GOOD
query GetUserCard($id: ID!) {
  user(id: $id) { id name avatar }
}
```

**2. Apollo Client — cache normalisation + fetch policies**
```jsx
import { useQuery, gql } from '@apollo/client';

const GET_POSTS = gql`
  query GetPosts($limit: Int!) {
    posts(limit: $limit) { id title author { name } }
  }
`;

function PostList() {
  const { data, loading } = useQuery(GET_POSTS, {
    variables: { limit: 20 },
    fetchPolicy: 'cache-first',  // serve from cache if fresh
  });
  if (loading) return <Skeleton />;
  return data.posts.map(p => <PostCard key={p.id} post={p} />);
}
```

**3. Fragments for co-located data needs**
```graphql
fragment PostCardFields on Post { id title author { name } }
fragment PostDetailFields on Post { ...PostCardFields body createdAt }
```

**4. Lazy queries for on-demand data**
```jsx
const [loadUser, { data }] = useLazyQuery(GET_USER);
<button onClick={() => loadUser({ variables: { id } })}>Load Profile</button>
```

**5. Cursor-based pagination (preferred over offset)**
```graphql
query GetFeed($cursor: String, $limit: Int) {
  feed(after: $cursor, first: $limit) {
    edges { node { id title } }
    pageInfo { hasNextPage endCursor }
  }
}
```

**Performance checklist:**
- ✅ `cache-first` for rarely-changing data (product catalog)
- ✅ `network-only` for critical accuracy (cart, checkout)
- ✅ `@defer` directive for non-critical query parts
- ✅ Persisted queries (hash → query string) to reduce payload size
- ✅ `DataLoader` on the server to batch N+1 DB calls
- ✅ Depth/complexity limits on server (prevent malicious deep queries)

---

## Next.js

**Category:** Full-Stack React Framework | **Questions:** 11 | **Level:** Basic → Advanced

Next.js combines React with server-side rendering, routing, and data fetching. These questions cover the App Router, caching layers, Server Components, and production patterns.

### Q1 [BASIC]: What is the difference between the Pages Router and App Router?

**A:**
- **Pages Router (pages/):** React 17 mental model. getServerSideProps / getStaticProps run on server, page component always runs on client.
- **App Router (app/):** React 18 + Server Components. ALL components are Server Components by default. 'use client' directive opts into client-side rendering.

**Key mental model shift:**
- Pages Router: "server functions + client component"
- App Router: "server tree (default) with client islands embedded"

**ELI5:** Pages Router is like sending a movie script to an actor who performs it. App Router is like the server is the stage and actors are already performing.

---

### Q2 [BASIC]: What are the four caching layers in Next.js App Router?

**A:**
1. **Request Memoization (in-memory, per-request):** Same fetch() URL called multiple times → deduplicated. Auto-cleared after request.
2. **Data Cache (persistent, per-deployment):** fetch() results stored. Default: infinite. Controlled by cache option or revalidate.
3. **Full Route Cache (persistent, per-deployment):** Static routes rendered at build time and cached.
4. **Router Cache (client-side, in browser memory):** Prefetched pages and navigated routes stored.

**ELI5:** Next.js has a 4-layer cake of caching. Request memoization skips duplicates in one request. Data cache preserves leftovers in the fridge. Full route is the pre-made frozen meal. Router cache is the memory of what you visited.

---

### Q3 [BASIC]: What are Server Actions and how are they different from API Routes?

**A:**
- **Server Actions:** async functions marked 'use server' that run on the server but can be called from client components as if they were regular functions. Next.js handles the transport automatically.
- **API Routes:** explicit HTTP endpoints (/pages/api/* or /app/api/*/route.ts). You manage request/response manually. More flexible for webhooks, external clients.

**ELI5:** Server Actions are like "send this data to the server and get a result back" - invisible magic. API Routes are like building your own REST API endpoints - visible, documented, external-friendly.

---

### Q4 [INTERMEDIATE]: How does streaming SSR work in Next.js?

**A:** Traditional SSR: server must render the ENTIRE page before sending any HTML. Streaming SSR: server sends HTML in chunks as parts of the tree resolve.

Uses HTTP chunked transfer encoding + React's renderToPipeableStream.

Next.js streaming via:
1. Suspense boundaries: content inside <Suspense> streams when ready
2. loading.tsx: shown immediately, replaced when segment finishes
3. error.tsx: error boundaries per segment

**ELI5:** Streaming is like ordering food - the kitchen sends out appetizers first (header), then main course (content), then dessert (footer). Instead of waiting for everything, the customer starts eating immediately.

---

### Q5 [INTERMEDIATE]: How does Middleware work in Next.js?

**A:** Middleware runs BEFORE the cache and BEFORE routing — at the Edge, on EVERY request matching the config.matcher pattern. It can rewrite, redirect, modify headers, or short-circuit the request.

Runs in Edge Runtime (V8 isolates) — cannot use Node.js APIs.

**ELI5:** Middleware is like a security guard at the door who checks every request before it enters the building. It can let people in, redirect them, or add a stamp to their hand (headers).

---

### Q6 [INTERMEDIATE]: How do you implement on-demand Incremental Static Regeneration (ISR)?

**A:** ISR = pre-render static pages at build time, then re-generate them in the background after a revalidation period.

On-demand ISR: purge the cache IMMEDIATELY when data changes (CMS webhook, etc.) without waiting for time-based interval.

**ELI5:** ISR is like having a newspaper that's mostly pre-printed but you update important sections when news breaks. On-demand ISR means you reprint that section immediately when something big happens.

---

### Q7 [ADVANCED]: What is the RSC Payload and how does navigation work in App Router?

**A:**
- **RSC Payload:** special binary format (React's wire format) representing Server Component tree. Contains rendered output of Server Components + placeholders for Client Components.

During NAVIGATION (soft nav — not full page reload):
1. Next.js fetches the RSC payload for the new route from the server
2. React reconciles the payload against the current component tree
3. Client Components that are already mounted ARE PRESERVED (state not lost!)
4. Only changed Server Component output is updated in the DOM

**ELI5:** RSC Payload is like a recipe that the browser follows to build the UI. Server Components are invisible (recipe only), Client Components are visible (recipe goes to the browser).

---

### Q8 [ADVANCED]: What are Parallel Routes and Intercepting Routes?

**A:**
- **Parallel Routes:** render multiple pages simultaneously in the same layout. Named slots (@folder convention). Used for: dashboard with independent data, side panels, split views.
- **Intercepting Routes:** render a route in a "modal" context while keeping the background layout. Used for: photo/post modals (Instagram-style), quick look.

**ELI5:** Parallel routes are like having multiple screens at once. Intercepting routes are like popping up a modal on top.

---

### Q9 [ADVANCED]: How do you safely implement authentication with Server Actions?

**A:** Server Actions are publicly exposed HTTP endpoints (even if not written as API routes). Next.js generates a unique ID for each action.

**CRITICAL:** Always validate auth inside the action — never trust client-sent data for authorization.

**Pattern:**
1. Auth check — inside the action, not outside
2. Input validation (Zod) — never trust FormData types
3. Authorization checks — verify user has permission
4. Database operation — only if authorized

---

### Q10 [ADVANCED]: Complete Next.js App Router architecture — caching, streaming, Components, and deployment

**A:** Full-stack architecture combining:
1. Server Components (RSC) for data fetching, zero JS
2. Client Components ('use client') for interactivity
3. Streaming SSR via Suspense
4. Incremental Static Regeneration for performance
5. Middleware for cross-cutting concerns
6. Server Actions for mutations
7. Deployment via Vercel or self-hosted with output: 'standalone'

---

### Q11 [ADVANCED]: How do you measure and optimise Core Web Vitals in a Next.js app?

**A:** Next.js has built-in tooling for every Core Web Vital. The strategy is: **measure first** (in production with real user data), then apply **targeted Next.js optimisations** per metric.

**ELI5:** Core Web Vitals are like a car's MOT test — three specific checks Google uses to judge if a page feels good to users. LCP is how fast the main content loads, INP is how snappy the page feels when you click, CLS is whether the page jumps around unexpectedly. Next.js gives you dedicated components for each problem.

---

**Step 1 — Measure Core Web Vitals in Next.js**

```javascript
// app/layout.tsx (App Router) — or pages/_app.tsx (Pages Router)
// Built-in: export reportWebVitals to receive real browser measurements

// Pages Router:
export function reportWebVitals(metric) {
  // metric.name: 'LCP' | 'FID' | 'CLS' | 'INP' | 'FCP' | 'TTFB'
  // metric.value: number (ms for time-based, score for CLS)
  console.log(metric);

  // Send to analytics (e.g. Google Analytics, Datadog, custom endpoint)
  if (metric.name === "LCP" && metric.value > 2500) {
    // Alert: LCP is poor (> 2.5s threshold)
    sendToAnalytics({ event: "poor_lcp", value: metric.value });
  }
}

// App Router — use the web-vitals package directly in a Client Component:
"use client";
import { useReportWebVitals } from "next/web-vitals";

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    console.log(metric.name, metric.value);
    // Send metric.name + metric.value to your monitoring service
  });
  return null;
}
// Place <WebVitalsReporter /> in your root layout
```

**Thresholds (Google's "good" targets):**
| Metric | Good | Needs Improvement | Poor |
|---|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5s | 2.5–4s | > 4s |
| INP (Interaction to Next Paint) | < 200ms | 200–500ms | > 500ms |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1–0.25 | > 0.25 |
| TTFB (Time to First Byte) | < 800ms | 800ms–1.8s | > 1.8s |
| FCP (First Contentful Paint) | < 1.8s | 1.8–3s | > 3s |

**Where to view in production:**
- **Vercel Analytics** (automatic CWV per route, free tier) — zero config on Vercel
- **Google Search Console → Core Web Vitals report** — field data from Chrome users
- **Google PageSpeed Insights** (URL-level) — lab + field data combined
- **Chrome DevTools → Lighthouse** — lab measurement (Incognito mode)

---

**Step 2 — Fix LCP: `next/image`**

LCP is almost always caused by a large hero image loading slowly. `next/image` handles this automatically.

```jsx
import Image from "next/image";

// ✅ Hero image — add priority to preload immediately (no lazy-load)
<Image
  src="/hero.jpg"
  alt="Hero banner"
  width={1200}
  height={600}
  priority                    // ← disables lazy-load, adds <link rel="preload">
  sizes="(max-width: 768px) 100vw, 1200px"   // responsive srcset
  placeholder="blur"          // ← shows blurred placeholder while loading (no CLS)
  blurDataURL="data:image/jpeg;base64,..."    // ← tiny base64 of the image
/>

// ✅ Below-fold images — lazy load (default)
<Image
  src="/product.jpg"
  alt="Product"
  width={400}
  height={400}
  // No priority — lazy loaded automatically
/>
```

**What `next/image` does automatically:**
- Serves modern formats: **WebP / AVIF** (30–50% smaller)
- Generates **responsive `srcset`** for the correct resolution per device
- **Lazy-loads** below-fold images (Intersection Observer)
- **Prevents CLS** — reserves exact space before image loads
- Routes images through `/_next/image` optimiser (runtime resizing)
- Caches optimised images on CDN edge

---

**Step 3 — Fix CLS: `next/font`**

Font loading causes CLS (layout shift when fonts swap) and FOIT (flash of invisible text). `next/font` eliminates both.

```javascript
// app/layout.tsx
import { Inter, Roboto_Mono } from "next/font/google";
// OR: import localFont from "next/font/local";  ← for self-hosted fonts

const inter = Inter({
  subsets: ["latin"],
  display: "swap",          // font-display: swap — show fallback immediately
  variable: "--font-inter", // expose as CSS variable
  preload: true,            // default: preload subset
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

**What `next/font` does:**
- Downloads Google Fonts **at build time** — no runtime request to `fonts.googleapis.com` (eliminates render-blocking network round-trip)
- Self-hosts the font files → served from your CDN, not Google's servers
- Injects optimal `font-display` and `size-adjust` to **eliminate CLS on font swap**
- Zero layout shift: uses CSS `size-adjust` to make the fallback font the same width as the web font

---

**Step 4 — Fix render-blocking scripts: `next/script`**

Third-party scripts (analytics, chat widgets, A/B testing) block rendering and hurt TBT/LCP.

```jsx
import Script from "next/script";

// strategy options:
// "beforeInteractive"  → blocks hydration (use only for critical polyfills)
// "afterInteractive"   → loads after page hydration (default — good for analytics)
// "lazyOnload"         → loads during browser idle time (lowest priority)
// "worker"             → offload to Web Worker via Partytown (experimental)

// ✅ Analytics — load after page is interactive
<Script
  src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXX"
  strategy="afterInteractive"
/>

// ✅ Chat widget — load during idle (doesn't affect LCP/INP)
<Script
  src="https://cdn.chatservice.com/widget.js"
  strategy="lazyOnload"
  onLoad={() => console.log("Chat loaded")}
/>

// ✅ Critical polyfill — must load before hydration
<Script
  src="/polyfills.js"
  strategy="beforeInteractive"
/>

// ✅ Inline script with strategy
<Script id="google-analytics" strategy="afterInteractive">
  {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-XXXXXX');
  `}
</Script>
```

---

**Step 5 — Fix TTFB: rendering strategy choices**

TTFB is directly controlled by how Next.js generates the page:

```
Static (SSG / ISR) — best TTFB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Pre-built at deploy time → served from CDN edge
  TTFB: ~10–50ms (CDN cache hit)
  Use: marketing pages, blogs, product pages (anything not user-specific)

  // App Router: no fetch options = static by default
  const data = await fetch("https://api/products");  // cached forever
  // OR with revalidation:
  const data = await fetch("https://api/products", { next: { revalidate: 3600 } });

Dynamic (SSR) — worst TTFB
━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Rendered on every request — server round-trip adds latency
  TTFB: 100–800ms+
  Use: personalised pages (dashboard, account), real-time data

  // App Router: force dynamic
  export const dynamic = "force-dynamic";
  // or: use cookies() / headers() — auto-marks route as dynamic

Partial Prerendering (PPR — Next.js 14+)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Static shell from CDN instantly → dynamic parts streamed in via Suspense
  Best of both worlds: fast initial paint + fresh personalised content
  
  export const experimental_ppr = true;  // in layout or page
  
  // Static shell (from CDN):
  <ProductLayout>
    <Suspense fallback={<RecommendationsSkeleton />}>
      <PersonalisedRecommendations userId={userId} /> {/* Dynamic, streamed */}
    </Suspense>
  </ProductLayout>
```

---

**Complete Next.js performance optimisation checklist:**

```
Images:
  ✅ Use next/image for ALL images
  ✅ Add priority to above-fold / LCP image
  ✅ Set correct sizes prop for responsive images
  ✅ Use placeholder="blur" for LCP images

Fonts:
  ✅ Use next/font/google (never <link href="fonts.googleapis.com">)
  ✅ Set display: "swap"
  ✅ Subset to used characters only (subsets: ["latin"])

Scripts:
  ✅ Use next/script for ALL third-party scripts
  ✅ Use "afterInteractive" for analytics
  ✅ Use "lazyOnload" for chat/social widgets
  ✅ Never put analytics scripts in <head> manually

Rendering:
  ✅ Static/ISR for content pages (best TTFB)
  ✅ Dynamic only when strictly necessary
  ✅ PPR for pages mixing static shell + personalised sections
  ✅ Stream dynamic sections via Suspense

JavaScript bundle:
  ✅ Server Components for data-heavy components (zero client JS)
  ✅ dynamic() import for heavy client-only components
  ✅ Avoid importing large libs in Client Components
  ✅ Run: ANALYZE=true next build (with @next/bundle-analyzer)

Caching:
  ✅ Set revalidate on fetch() calls (not every route = force-dynamic)
  ✅ Use unstable_cache for non-fetch data sources (DB queries)
  ✅ Understand the 4 cache layers (Request Memo → Data → Full Route → Router)

Monitoring:
  ✅ reportWebVitals / useReportWebVitals → send to analytics
  ✅ Vercel Analytics for per-route CWV (on Vercel)
  ✅ Google Search Console for real-user field data
  ✅ Lighthouse in CI (lighthouse-ci npm package)
```

---

## Node.js

**Category:** JavaScript Runtime & Backend | **Questions:** 23+ | **Level:** Basic → Advanced

Node.js enables JavaScript on the server side. These questions cover the event loop, streams, clustering, security, and production best practices.

### Q1 [BASIC]: What is the Node.js event loop? Explain each phase.

**A:** The event loop is a C loop (in libuv) that continuously checks the call stack and task queues. It has PHASES — each processes a specific type of callback.

**Order of phases per loop iteration:**
1. timers → callbacks from setTimeout / setInterval
2. pending I/O → I/O error callbacks deferred
3. idle, prepare → internal use only
4. poll → retrieve new I/O events
5. check → setImmediate() callbacks
6. close callbacks → socket.on('close', ...)

Between EVERY phase: process.nextTick callbacks drain completely. Between EVERY phase: Promise microtasks drain completely.

**ELI5:** The event loop manages a to-do list in a specific order. It checks different stations in order, handles all urgent notes (nextTick) between stations, then moves to the next station.

---

### Q2 [BASIC]: Why is Node.js "non-blocking" even though JavaScript is single-threaded?

**A:** Non-blocking I/O is achieved via the OS (epoll on Linux, kqueue on macOS, IOCP on Windows) and libuv's thread pool.

- Network I/O (TCP, HTTP): handed to OS async syscalls. No threads needed.
- File I/O, DNS, Crypto, zlib: delegated to libuv's thread pool (default: 4 threads).
- The main JS thread is free to process other events while waiting.

**ELI5:** Node is like a chef with multiple arms who can start cooking one dish and move to the next without waiting for the first to finish. The oven (OS) handles the cooking in the background.

---

### Q3 [BASIC]: What are Streams and why are they important in Node.js?

**A:** Streams process data in CHUNKS rather than loading everything into memory. Critical for: large file processing, HTTP responses, video streaming, CSV parsing.

**Types:** Readable, Writable, Duplex (both), Transform (duplex + modify data)

**ELI5:** Streams are like a water pipe - you don't fill up a bucket all at once, you let water flow through. Instead of loading a 1GB file into memory, you process it in chunks.

---

### Q4 [INTERMEDIATE]: What is AsyncLocalStorage and how does it replace req.locals?

**A:** AsyncLocalStorage provides a context that propagates automatically through async operations within a single async call tree. Like thread-local storage but for async operations.

**Use:** request-scoped context (requestId, userId, logger) without passing it everywhere.

**ELI5:** AsyncLocalStorage is like a backpack that follows you through your entire adventure. Any function you call down the line can open the backpack without you having to pass it to every function.

---

### Q5 [INTERMEDIATE]: How does Node.js clustering work, and what are the downsides?

**A:** Node.js is single-threaded, so it can only use ONE CPU core by default. 'cluster' module forks N worker processes (one per CPU), each running the same server code. The master process distributes incoming connections across workers.

**Downsides:**
1. Workers do NOT share memory (separate process = separate heap). Cannot use in-memory cache across workers. Session data must be in Redis/DB.
2. Harder to debug
3. Each worker runs full server startup → more memory usage

**ELI5:** Clustering is like opening multiple checkout lanes instead of one. Each lane is a separate worker. But each lane can't share its clipboard with other lanes.

---

### Q6 [INTERMEDIATE]: Explain backpressure in Node.js streams and how to handle it.

**A:** Backpressure occurs when the PRODUCER (Readable) generates data faster than the CONSUMER (Writable) can process it. Without handling, data piles up in memory.

Node's API communicates backpressure via boolean returns and 'drain' events. `pipeline()` / `pipe()` handle backpressure automatically — always prefer them.

**ELI5:** Backpressure is like a traffic jam - a slow lane causes a backup in the fast lane. You tell the fast lane to slow down until the jam clears.

---

### Q7 [INTERMEDIATE]: How does the Node.js module caching system work?

**A:** `require()` caches modules by their RESOLVED FILENAME. Second require() of the same file returns the CACHED MODULE OBJECT — no re-execution.

This means:
- Singleton pattern is automatic with CJS modules
- Mutation of exports is shared across all requirers
- Circular dependencies are possible but return incomplete exports

**ELI5:** When you require a module, Node caches it like a photocopier remembering paper size settings. Every time you ask for the same paper size again, it uses the old setting instead of reconfiguring.

---

### Q8 [ADVANCED]: How do you diagnose and fix memory leaks in a production Node.js app?

**A:** 
**Symptoms:** heap growing over time, eventual OOM / process restart.

**Process:**
1. Monitor heap metrics (process.memoryUsage().heapUsed over time)
2. Generate heap snapshots at different times
3. Compare snapshots to find retained objects
4. Find what is holding references (retention path)

**Common production leak pattern:** EventEmitter listener accumulation. Each request adds a new listener but never removes it.

---

### Q9 [ADVANCED]: How does Node.js handle uncaught exceptions and unhandled promise rejections?

**A:** Unhandled errors crash the process — but you WANT that in production (predictable state). The goal is to: log the error, flush pending I/O, then exit gracefully.

**CORRECT pattern:** proper try/catch in async functions. NEVER ignore errors silently.

```javascript
process.on('uncaughtException', (err, origin) => {
  console.error('UNCAUGHT EXCEPTION:', err.message);
  process.exit(1);  // exit immediately
});
```

**ELI5:** Uncaught exceptions are like a fire alarm - you can't ignore it. Log it, run out of the building (exit cleanly), don't come back.

---

### Q10 [ADVANCED]: What is the difference between child_process.fork(), spawn(), and exec()?

**A:** All three create child processes, but differ in use case and I/O handling.

- **spawn():** stream-based I/O. Use for long-running processes with large output.
- **exec():** buffers ALL output in memory. Use for small output, needs shell features. SHELL INJECTION RISK.
- **execFile():** like exec but no shell (safer).
- **fork():** special spawn for Node.js scripts with built-in IPC channel.

---

### Q11 [ADVANCED]: How does Node.js handle long-running CPU-intensive tasks without blocking?

**A:** Options from simplest to most powerful:
1. Offload to external service (microservice, Lambda, job queue)
2. setImmediate chunking (cooperative multitasking)
3. worker_threads (true parallel V8 execution within same process)
4. child_process.fork() (separate process entirely)

**ELI5:** setImmediate chunking is like a juggler taking a breath between catching balls. Worker threads are like hiring an assistant to work in parallel.

---

### Q12 [ADVANCED]: Explain HTTP keep-alive, connection pooling, and their impact at scale.

**A:** 
- **HTTP/1.1 keep-alive:** reuse TCP connections for multiple requests (avoid 3-way handshake cost).
- Without keep-alive: each request does TCP connect (~50-200ms) + TLS (~2 RTT).
- With keep-alive: connection stays open, subsequent requests pay ~0 connection overhead.

**Node's http.globalAgent:** manages a connection pool per host:port. Default maxSockets: Infinity. Always configure agent.

**ELI5:** HTTP keep-alive is like having a standing appointment instead of calling ahead each time.

---

### Q13 [INTERMEDIATE]: Buffers and Streams in Node.js — types, .pipe(), backpressure

**A:**
- **BUFFER:** fixed-size chunk of binary memory. Key for binary data (images, video, zlib, encryption).
- **STREAM:** continuous data flow processed incrementally. Critical for large files.

`stream.pipe()` automatically handles backpressure — always prefer over manual event listeners.

---

### Q14 [ADVANCED]: How are Web Workers (browser) and Worker Threads (Node.js) different?

**A:** Both let you run JavaScript in parallel to the main thread, but they live in completely different environments and have different trade-offs.

**ELI5:** Both are "hiring an assistant" for heavy work. But Web Workers are assistants for your browser store (they can look at the shop window/DOM), while Worker Threads are assistants for your Node.js server factory (they share tools but are in a separate room). The key difference: they work in different buildings entirely.

| | **Web Workers (Browser)** | **Worker Threads (Node.js)** |
|---|---|---|
| **Environment** | Browser | Node.js |
| **DOM access** | ❌ No DOM access | ❌ N/A (no DOM) |
| **Memory model** | Isolated (separate heap, must message-pass) | Shared memory capable (`SharedArrayBuffer`) |
| **Communication** | `postMessage()` / `onmessage` | `postMessage()` OR shared memory |
| **SharedArrayBuffer** | ✅ (requires COOP/COEP headers) | ✅ First-class support |
| **Parallelism** | True parallel OS threads | True parallel V8 isolates |
| **Use case** | CPU-heavy client-side: image processing, canvas rendering, compression | CPU-heavy server-side: crypto, ML inference, image resize |
| **Termination** | `worker.terminate()` | `worker.terminate()` |
| **Available since** | 2009 (HTML5) | Node.js 10.5 (stable 12) |

**Web Worker example (browser):**
```javascript
// main.js
const worker = new Worker("heavy-task.js");
worker.postMessage({ numbers: [1, 2, 3, 4, 5] });
worker.onmessage = (e) => console.log("Result:", e.data.sum);

// heavy-task.js (runs in separate thread — no window, no DOM)
self.onmessage = function (e) {
  const sum = e.data.numbers.reduce((a, b) => a + b, 0);
  self.postMessage({ sum });
};
```

**Worker Thread example (Node.js):**
```javascript
// main.js
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");

if (isMainThread) {
  const worker = new Worker(__filename, { workerData: { n: 40 } });
  worker.on("message", (result) => console.log("Fibonacci:", result));
} else {
  // This block runs in the worker thread
  function fib(n) { return n <= 1 ? n : fib(n - 1) + fib(n - 2); }
  parentPort.postMessage(fib(workerData.n));
}
```

**SharedArrayBuffer in Node.js (zero-copy communication):**
```javascript
// Useful for high-throughput scenarios — avoid serialisation overhead
const sharedBuffer = new SharedArrayBuffer(4);
const shared = new Int32Array(sharedBuffer);
Atomics.store(shared, 0, 42);  // atomic write — thread-safe
```

**When to use which:**
- **Web Worker:** parallelise a CPU-heavy calculation in the browser without freezing the UI (video encoding, PDF generation, large sort/filter)
- **Worker Thread:** handle CPU-intensive work in Node without blocking the event loop (image resize, bcrypt hashing, large JSON parsing)
- **Don't use either:** for I/O-bound work — Node's async I/O and libuv thread pool already handle that efficiently

---

### Q15 [ADVANCED]: How are race conditions handled / avoided in Node.js?

**A:** Race conditions happen when two operations depend on shared state and their interleaved execution produces wrong results. Node's single-threaded event loop **prevents most** race conditions — but async operations that hit **shared external state** (database, Redis, file) can still race.

**ELI5:** Two waiters each check "is table 5 free?" and both see "yes" at the same moment — then seat two parties at the same table. Node's single thread means only one JS operation runs at a time, but the database is shared — both waiters (requests) can check before either has committed the booking.

**Classic race condition in Node.js:**
```javascript
// ❌ RACE CONDITION — two concurrent requests can both pass the "if enough stock" check
async function purchaseItem(userId, itemId) {
  const item = await db.findOne({ _id: itemId });
  if (item.stock > 0) {             // ← both requests can see stock=1 here
    await db.updateOne(
      { _id: itemId },
      { $inc: { stock: -1 } }       // ← both decrement: stock goes -1
    );
    await createOrder(userId, itemId);
  }
}
```

**Solution 1 — Atomic database operations (best for most cases):**
```javascript
// ✅ MongoDB findOneAndUpdate with condition — atomic, server-side check
const result = await db.collection("items").findOneAndUpdate(
  { _id: itemId, stock: { $gt: 0 } },  // only update if stock > 0
  { $inc: { stock: -1 } },
  { returnDocument: "after" }
);

if (!result.value) throw new Error("Out of stock");
await createOrder(userId, itemId);
// Only ONE request can win the atomic update — guaranteed by MongoDB
```

**Solution 2 — Redis distributed lock (for cross-service / multi-instance scenarios):**
```javascript
// ✅ Acquire lock before critical section
const lockKey = `lock:item:${itemId}`;
const lockAcquired = await redis.set(lockKey, "1", "NX", "PX", 3000); // NX=only if not exists, 3s TTL

if (!lockAcquired) throw new Error("Item is being processed — try again");

try {
  // critical section — only ONE process is here at a time
  const item = await db.findOne({ _id: itemId });
  if (item.stock <= 0) throw new Error("Out of stock");
  await db.updateOne({ _id: itemId }, { $inc: { stock: -1 } });
  await createOrder(userId, itemId);
} finally {
  await redis.del(lockKey);  // always release
}
```

**Solution 3 — Database transactions (PostgreSQL / MongoDB multi-document):**
```javascript
// ✅ MongoDB multi-document transaction
const session = await mongoose.startSession();
session.startTransaction();
try {
  const item = await Item.findOneAndUpdate(
    { _id: itemId, stock: { $gt: 0 } },
    { $inc: { stock: -1 } },
    { session, new: true }
  );
  if (!item) throw new Error("Out of stock");
  await Order.create([{ userId, itemId }], { session });
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}
```

**Solution 4 — Event queue / job queue (async serialisation):**
```javascript
// ✅ Use Bull/BullMQ — purchases go into a queue, processed one at a time
purchaseQueue.process(async (job) => {
  const { userId, itemId } = job.data;
  // now sequential — no concurrency within this processor
  const item = await Item.findOne({ _id: itemId });
  if (item.stock <= 0) throw new Error("Out of stock");
  await Item.updateOne({ _id: itemId }, { $inc: { stock: -1 } });
  await Order.create({ userId, itemId });
});
```

**Summary — which technique for which scenario:**
| Scenario | Solution |
|---|---|
| Single DB operation | Atomic DB operator (`$inc`, UPDATE WHERE stock > 0) |
| Multi-step critical section (single service) | Redis distributed lock |
| Multi-document DB integrity | DB transaction |
| Cross-service orchestration | Message queue / event bus |
| High throughput, serialise purchase | Job queue (BullMQ) |

---

### Q16 [ADVANCED]: 1000 passengers booking a single IRCTC ticket — system design and preventing double-booking.

**A:** This is a classic **high-concurrency resource contention** problem. The core challenge: 1 seat, N buyers, need exactly 1 winner — and the system must handle massive concurrent load without crashing.

**ELI5:** Think of 1000 people all trying to grab the last cookie at the same millisecond. You need one person to get it, 999 to get a polite "sorry, it's gone". The trick is making the "grab" action atomic — only one hand can physically take the cookie.

**Full architecture:**

```
┌─────────────────────────────────────────────────────────┐
│  1000 Concurrent Users via Browser / App                │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS requests
┌──────────────────────▼──────────────────────────────────┐
│  CDN / Load Balancer (AWS ALB / Azure Front Door)        │
│  Rate limiting: max 50 req/s per IP (nginx rate_limit)  │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  API Layer (Node.js / Express — multiple instances)      │
│  Stateless: auth checked via JWT in every request        │
└───────────┬──────────────────────┬──────────────────────┘
            │                      │
┌───────────▼──────┐    ┌──────────▼────────────────────┐
│  Redis Cache     │    │  Message Queue (BullMQ/SQS)    │
│  - Seat lock     │    │  - booking-requests queue      │
│  - Seat status   │    │  - processed sequentially      │
└──────────────────┘    └──────────┬────────────────────┘
                                   │
                        ┌──────────▼────────────────────┐
                        │  Worker Process (single consumer│
                        │  per seat — or DB atomic op)   │
                        └──────────┬────────────────────┘
                                   │
                        ┌──────────▼────────────────────┐
                        │  PostgreSQL / MongoDB           │
                        │  - seat table with status=HELD/│
                        │    BOOKED (row-level lock)      │
                        └───────────────────────────────┘
```

**Step-by-step flow:**

```
1. User initiates booking
   → API checks seat status in Redis (L1 cache, < 1ms)
   → If already BOOKED in cache → instant 409 (fast reject — no DB hit)
   → If AVAILABLE → proceed

2. "Soft lock" the seat in Redis (pessimistic locking)
   redis.SET lock:seat:A12 userId NX PX 300000   // 5 min TTL, only if not exists
   → If lock acquired → user is in "selection phase"
   → If lock NOT acquired → return "seat is being held by another user"

3. Payment initiation (within 5 min lock window)
   → Show payment page to the lock holder

4. Payment complete → confirm booking
   → Publish "confirm-booking" event to queue (BullMQ/SQS)
   → Queue processes ONE booking at a time

5. Worker processes booking atomically
   → BEGIN TRANSACTION
   → SELECT FOR UPDATE on seat row (database-level row lock)
   → Verify status = AVAILABLE (double-check)
   → UPDATE seat SET status = 'BOOKED', user_id = userId
   → INSERT INTO bookings (...)
   → COMMIT
   → Release Redis lock
   
6. 999 others
   → Hit Redis check → see BOOKED → get "no seats available" immediately
   → No DB load for them
```

**The atomic database operation (most critical part):**
```sql
-- PostgreSQL — row-level lock + atomic update in one statement
UPDATE seats
SET status = 'BOOKED', booked_by = $1, booked_at = NOW()
WHERE seat_id = $2
  AND status = 'AVAILABLE'           -- only update if still free
RETURNING *;                          -- returns null if already booked

-- If 0 rows returned → seat was taken → return 409
```

```javascript
// MongoDB equivalent — findOneAndUpdate is atomic
const result = await Seat.findOneAndUpdate(
  { seatId: "A12", status: "AVAILABLE" },
  { $set: { status: "BOOKED", bookedBy: userId, bookedAt: new Date() } },
  { new: true }
);
if (!result) throw new AppError(409, "Seat no longer available");
```

**Handling the 1000 concurrent requests — layers of protection:**

| Layer | Technique | Effect |
|---|---|---|
| Rate limiting | nginx / ALB throttle 50 req/IP/sec | Rejects bots, scraping |
| Queue / waiting room | Virtual queue (positions users) | Drains traffic to manageable rate |
| Redis cache check | Check seat status in cache before DB | 999 rejections in < 1ms, no DB hit |
| Redis lock (NX) | Atomic set-if-not-exists | Only 1 user enters select flow |
| DB atomic update | UPDATE WHERE status='AVAILABLE' | DB-level last resort guarantee |
| Idempotency key | Unique key per booking attempt | Prevents double-click duplicate charges |

**Waiting room pattern (IRCTC-style virtual queue):**
```
User → Waiting Room queue (Redis LPUSH) → given a position number
Background worker pops 10 users/second → forwards them to actual booking flow
Users see: "You are #347 in queue. Estimated wait: 34 seconds."
```

**What happens to payment if seat is taken after payment starts:**
- Keep payment window shorter than seat lock TTL (5 min)
- If payment fails or times out → auto-release Redis lock (TTL expires)
- If payment succeeds but DB update fails → trigger refund (saga pattern)

---

### Q17 [INTERMEDIATE]: What are the types of polling in Socket.io? Which is better and for whom? What is the easiest way to implement?

**A:** Socket.io is a library that abstracts real-time communication. It starts with a transport and upgrades as the environment supports.

**ELI5:** Think of two people communicating across a river. Polling is "I'll shout every 5 seconds to see if you replied". Long-polling is "I'll keep my mouth open waiting, and you shout as soon as you have something". WebSocket is "we build a bridge and talk continuously without shouting".

**The 3 transports in Socket.io (in upgrade order):**

```
1. HTTP Short Polling (deprecated, legacy)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Client: "Any new data?" → Server: "No" → Close connection
  Client: (500ms later) "Any new data?" → Server: "Yes! Here it is" → Close
  
  Problem: High latency, wastes HTTP overhead on every request
  Socket.io no longer uses this as default

2. HTTP Long Polling (Socket.io fallback)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Client: "Any new data?" → Connection STAYS OPEN
  Server: Holds response until data is ready (or timeout ~30s)
  Server sends data → Client immediately makes new long-poll request
  
  Pros: Works everywhere (proxies, firewalls, IE8+)
  Cons: Higher latency than WS, 2 TCP connections, HTTP overhead per message

3. WebSocket (Socket.io preferred transport)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Client ↔ Server: Single persistent TCP connection, full-duplex
  Either side can push at any time
  Minimal overhead (2 bytes header vs HTTP headers)
  
  Pros: Lowest latency, lowest overhead, true real-time
  Cons: Some old proxies/firewalls block WS upgrades (Socket.io falls back to long-poll)
```

**How Socket.io selects transport (upgrade mechanism):**
```
Connection start: always begins with HTTP Long Polling (universally supported)
     ↓
If server + client both support WebSocket AND environment allows upgrade:
Socket.io upgrade handshake
     ↓
Switch to WebSocket
Long-poll connection closed
Full-duplex WS connection active
```

**Which is better for whom:**

| Use Case | Best Transport | Why |
|---|---|---|
| Chat apps / notifications | WebSocket | Low latency, persistent connection |
| Dashboard with live updates | WebSocket | Frequent server-push |
| Behind strict corporate proxy | Long Polling | WS often blocked |
| IoT / embedded/old browsers | Long Polling | WS support may be missing |
| Gaming / real-time sync | WebSocket | Sub-50ms latency required |
| Serverless deployments (Lambda) | Long Polling | WS not supported in Lambda |

**Easiest Socket.io implementation:**

```bash
npm install socket.io socket.io-client
```

```javascript
// ── server.js (Node.js + Express) ────────────────────────────────────────────
const express  = require("express");
const http     = require("http");
const { Server } = require("socket.io");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: "http://localhost:3000" },
  // Force specific transport (optional):
  // transports: ["websocket"]          // skip long-poll entirely
  // transports: ["polling"]            // long-poll only (serverless)
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Listen for events from client
  socket.on("chat-message", (data) => {
    // Broadcast to ALL clients (including sender)
    io.emit("chat-message", { user: data.user, text: data.text });
    // OR broadcast to ALL except sender:
    // socket.broadcast.emit("chat-message", data);
  });

  socket.on("join-room", (room) => {
    socket.join(room);
    io.to(room).emit("notification", `${socket.id} joined ${room}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(4000, () => console.log("Server on :4000"));
```

```jsx
// ── ChatComponent.jsx (React client) ─────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io("http://localhost:4000");

    socketRef.current.on("chat-message", (data) => {
      setMessages(prev => [...prev, data]);
    });

    return () => socketRef.current.disconnect();   // cleanup on unmount
  }, []);

  function sendMessage() {
    socketRef.current.emit("chat-message", { user: "Alice", text: input });
    setInput("");
  }

  return (
    <div>
      {messages.map((m, i) => <p key={i}><b>{m.user}:</b> {m.text}</p>)}
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
```

---

### Q18 [ADVANCED]: What is Redis Locking (Distributed Lock)?

**A:** A distributed lock is a mechanism to ensure that across multiple processes/servers, only ONE process executes a critical section at a time. Redis is commonly used because its single-threaded command processing guarantees atomicity.

**ELI5:** Imagine 10 cashiers sharing one physical cash drawer. Without a lock, two cashiers could open it at the same time and both try to give change from the same money. A lock is like a physical key: only the cashier holding the key can open the drawer. When done, they put the key back.

**The problem without locking:**
```javascript
// ❌ Two Node.js instances can BOTH execute this simultaneously
async function deductCredits(userId, amount) {
  const user = await db.findOne({ _id: userId });
  if (user.credits >= amount) {
    await db.updateOne({ _id: userId }, { $inc: { credits: -amount } });
    // But if 2 instances ran simultaneously, user might go negative
  }
}
```

**Redis lock implementation (SET NX PX — atomic):**
```javascript
const redis = require("redis").createClient();

async function acquireLock(lockKey, ttlMs = 5000) {
  // SET lock_key "1" NX PX 5000
  // NX = only set if NOT EXISTS (atomic check + set)
  // PX = expire in milliseconds (prevents deadlock if process crashes)
  const result = await redis.set(lockKey, "1", { NX: true, PX: ttlMs });
  return result === "OK";   // "OK" = lock acquired, null = already locked
}

async function releaseLock(lockKey) {
  await redis.del(lockKey);
}

// Usage
async function processPayment(orderId) {
  const lockKey = `lock:order:${orderId}`;
  const acquired = await acquireLock(lockKey, 10_000);   // 10s TTL

  if (!acquired) {
    throw new Error("Order is already being processed");
  }

  try {
    // ── CRITICAL SECTION ──────────────────────────
    const order = await db.findOne({ _id: orderId });
    if (order.status !== "pending") throw new Error("Already processed");
    await chargeCard(order);
    await db.updateOne({ _id: orderId }, { $set: { status: "paid" } });
    // ── END CRITICAL SECTION ──────────────────────
  } finally {
    await releaseLock(lockKey);   // always release, even on error
  }
}
```

**Problem with simple SET NX: race on release**

If Process A's lock expires (slow execution) and Process B acquired it, Process A might delete Process B's lock when it finally calls `redis.del`. 

**Safe release with Lua script (atomic check-and-delete):**
```javascript
const UNLOCK_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end
`;

async function acquireLock(lockKey, ttlMs = 5000) {
  const lockValue = crypto.randomUUID();  // unique per lock holder
  const result = await redis.set(lockKey, lockValue, { NX: true, PX: ttlMs });
  return result === "OK" ? lockValue : null;
}

async function releaseLock(lockKey, lockValue) {
  // Atomic: only delete if WE still own the lock
  await redis.eval(UNLOCK_SCRIPT, { keys: [lockKey], arguments: [lockValue] });
}
```

**Redlock algorithm (multi-node Redis — production grade):**
- Acquire lock on N/2+1 Redis nodes (majority)
- Only if a majority succeeded, the lock is valid
- Prevents split-brain when a single Redis node crashes
- Use the `redlock` npm package for this

```javascript
const Redlock = require("redlock");
const redlock = new Redlock([redis1, redis2, redis3], { retryCount: 3 });

async function withLock(resource, ttl, fn) {
  const lock = await redlock.acquire([resource], ttl);
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}

await withLock("lock:ticket:A12", 10_000, async () => {
  // Only ONE process across all instances enters here
  await bookTicket("A12", userId);
});
```

**Redis vs DB-level locking — when to use which:**
| | Redis Distributed Lock | DB Row Lock (SELECT FOR UPDATE) |
|---|---|---|
| **Speed** | Sub-millisecond | Slower (DB transaction overhead) |
| **Cross-service** | ✅ Works across microservices | ❌ Only within DB clients |
| **TTL auto-expiry** | ✅ Built-in | ❌ Manual timeout needed |
| **Availability** | Redis must be up | DB must be up |
| **Use when** | Microservices, rate limiting, job dedup | Single-service inventory, financial operations |

---

### Q19 [INTERMEDIATE]: What parameters do you check when your backend is slow?

**A:** Backend slowness has three root causes: **slow I/O** (DB, external API), **CPU saturation** (compute-heavy code), or **resource contention** (locks, memory pressure, connection limits). Diagnose systematically.

**ELI5:** When a car is slow, you check: is it no fuel (resources exhausted)?, bad engine (CPU), flat tyres (slow I/O), or a traffic jam (contention)? Same for backend — check each system in order.

**Step-by-step diagnosis:**

```
STEP 1: Observe metrics (before touching code)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CPU usage        → high? → CPU-bound work (loops, crypto, JSON.parse on large data)
  Memory usage     → growing? → memory leak, swapping
  Heap usage       → near limit? → GC pressure (frequent GC pauses)
  Event loop lag   → > 100ms? → something is blocking the loop
  
  Tools: PM2 (pm2 monit), Node.js --inspect, clinic.js flame chart

STEP 2: Request-level tracing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Add request duration logging:
  const start = Date.now();
  // ... handler logic
  console.log(`[${req.method} ${req.path}] ${Date.now() - start}ms`);
  
  OR use: morgan middleware / OpenTelemetry / Datadog APM / New Relic

STEP 3: Database query analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MongoDB: db.setProfilingLevel(1, { slowms: 100 }) → check system.profile
  MongoDB: .explain("executionStats") on slow queries → look for COLLSCAN
  PostgreSQL: EXPLAIN ANALYZE SELECT …
  Check: missing indexes, N+1 queries, large full collection scans
  
  N+1 pattern (very common):
  ❌ for (const order of orders) {
       const user = await db.findOne({ _id: order.userId });  // 1 query per order
     }
  ✅ const userIds = orders.map(o => o.userId);
     const users = await db.find({ _id: { $in: userIds } }); // 1 query total

STEP 4: External API calls
━━━━━━━━━━━━━━━━━━━━━━━━━━
  Log time for each external call (payment gateway, email service, 3rd party API)
  ❌ Sequential API calls:
     const a = await fetchServiceA();  // 200ms
     const b = await fetchServiceB();  // 200ms  — total: 400ms
  ✅ Parallel:
     const [a, b] = await Promise.all([fetchServiceA(), fetchServiceB()]); // total: 200ms

STEP 5: Connection pool exhaustion
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DB connections: check pool size vs concurrent requests
  mongoose.connection.pool.size  →  default 5 — may be too small at scale
  Redis: check connected_clients, blocked_clients
  HTTP keep-alive: check if agent is reusing connections

STEP 6: Memory / GC pressure
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  process.memoryUsage().heapUsed  → track over time
  High GC pauses → --expose-gc + gc() timing / clinic.js heapprofile
  Look for: large objects in closures, growing caches without TTL

STEP 7: Event loop blocking
━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { monitorEventLoopDelay } = require("perf_hooks");
  const h = monitorEventLoopDelay({ resolution: 20 });
  h.enable();
  setInterval(() => console.log("EL lag:", h.mean / 1e6, "ms"), 1000);
  
  If lag > 50ms: find synchronous blocking code (JSON.parse on 10MB, crypto, image processing)
  Fix: offload to Worker Thread or setImmediate chunking
```

**Quick checklist:**
- [ ] CPU / memory metrics (PM2 / CloudWatch / DataDog)
- [ ] Slow query logs in DB (MongoDB profiler / PG slow query log)
- [ ] Check for N+1 queries
- [ ] Check for sequential awaits that could be Promise.all
- [ ] DB connection pool size
- [ ] External API call latency (log each one)
- [ ] Event loop lag monitoring
- [ ] Memory growth over time (heap snapshots)
- [ ] Check Redis slow log: `SLOWLOG GET 10`
- [ ] Use APM: Datadog / New Relic / OpenTelemetry tracing

---

### Q20 [INTERMEDIATE]: A script runs locally but fails in production — what are the possible issues?

**A:** This is a classic debugging scenario. The answer is always: "the environments are different — find what's different."

**ELI5:** Your recipe works at home but fails at the restaurant. Possible reasons: different oven temperature (environment config), missing ingredient (dependency not installed), different pan size (resource limits), recipe not shared properly (missing env vars), or the restaurant doesn't allow that cooking technique (permissions/firewall).

**Systematic checklist of differences:**

```
1. ENVIRONMENT VARIABLES
━━━━━━━━━━━━━━━━━━━━━━━━
  ❌ Missing .env file in production (never commit .env)
  ❌ Variable exists locally but not in prod (CI/CD secrets not set)
  ❌ NODE_ENV=development local vs NODE_ENV=production — different code paths
  ✅ Check: console.log(process.env) at startup / compare .env.example to prod secrets

2. NODE.JS / RUNTIME VERSION MISMATCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ❌ Local: Node 20, Production: Node 16 — API differences (fetch native, etc.)
  ✅ Fix: specify engines in package.json, use .nvmrc, pin Docker base image
  { "engines": { "node": ">=20.0.0" } }

3. DEPENDENCIES / package-lock.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ❌ npm install installs latest minor: 1.2.3 local vs 1.2.5 prod (subtle breaking change)
  ❌ Local has devDependencies, prod runs npm install --omit=dev (missing dep)
  ✅ Fix: always npm ci (uses lock file exactly) in CI/CD
  ✅ Check: is the failing module in devDependencies vs dependencies?

4. FILE PATHS (Windows vs Linux)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ❌ Local: Windows (backslash path.join), Prod: Linux (forward slash)
  ❌ Case sensitivity: "MyFile.js" works on Windows (case-insensitive), 
     fails on Linux (case-sensitive): require("myfile.js") ≠ "MyFile.js"
  ✅ Fix: use path.join() or path.resolve() instead of string concatenation
  ✅ Fix: keep filenames and imports consistently cased

5. PERMISSIONS
━━━━━━━━━━━━━━
  ❌ Script tries to write to /logs directory (no permission in prod container)
  ❌ Port 80/443 requires root (use 3000+ and reverse proxy instead)
  ✅ Check: ls -la, check Docker USER, check directory write permissions

6. MEMORY / RESOURCE LIMITS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ❌ Local: 16GB RAM, Prod: 512MB container limit → OOM kill
  ❌ Local processes 100 items, prod processes 100,000 → timeout
  ✅ Check: container memory limits, execution time limits (Lambda: 15min, etc.)

7. NETWORK / EXTERNAL SERVICES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ❌ VPN / localhost dependencies (script calls localhost:5432 — works locally, fails in prod)
  ❌ Firewall blocking outbound from prod to 3rd party API
  ❌ SSL certificate issues (self-signed cert works locally, not trusted in prod)
  ✅ Check: try curl/wget the external service from the prod server

8. BUILD ARTIFACTS
━━━━━━━━━━━━━━━━━━
  ❌ Local runs TypeScript directly (ts-node), prod runs compiled JS → compile error
  ❌ next build missing, running next start without building first
  ✅ Check: is the build step (tsc, next build) happening in CI?

9. TIMING / ASYNC ISSUES
━━━━━━━━━━━━━━━━━━━━━━━━
  ❌ DB not yet ready when app starts (race condition on startup)
  ❌ Local DB already has seed data, prod DB is empty
  ✅ Fix: health-check before starting, retry logic on startup, seed scripts in CI

10. LOGS AND OBSERVABILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ First thing: read production logs fully (not just the last line)
  ✅ Check: structured logs (JSON), stack trace, inner error message
  ✅ Reproduce in staging with production env vars before touching prod
```

**Debugging workflow:**
```
1. Read prod logs end-to-end (full stack trace, not just "500 Internal Error")
2. Reproduce in staging with prod env vars
3. Compare: node --version, npm ls [failing package]
4. Check env vars completeness (CI/CD secrets panel)
5. Check network connectivity from prod (curl, ping)
6. Add verbose logging temporarily to narrow down the failure point
7. Check if build step ran correctly (compiled artifacts present)
```

---

### Q21 [ADVANCED]: Design a CI/CD Pipeline — AWS and Azure, what do you do at each step?

**A:** CI/CD automates the path from code commit to production. The goal: fast, reliable, safe deployments with automated testing and rollback capability.

**ELI5:** CI/CD is like a car factory assembly line. CI is the quality control inspector who checks every part before it goes to the next station. CD is the automated conveyor that takes the approved car from factory to dealership without a human driver. You catch defects early and deploy reliably every time.

**Common pipeline stages (both AWS and Azure):**

```
Developer → git push → [Pipeline Triggers] → Build → Test → Security Scan
  → Package → Deploy Staging → Integration Tests → Approval Gate → Deploy Prod
```

**AWS Pipeline (CodePipeline + CodeBuild + ECS):**

```yaml
# buildspec.yml — runs in AWS CodeBuild
version: 0.2

phases:
  install:
    runtime-versions:
      nodejs: 20
    commands:
      - npm ci                          # exact lock file install

  pre_build:
    commands:
      - npm run lint                    # ESLint
      - npm run test:unit               # Jest unit tests
      - npm audit --audit-level=high    # dependency security check
      - aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY

  build:
    commands:
      - docker build -t $IMAGE_REPO_NAME:$CODEBUILD_BUILD_NUMBER .
      - docker tag $IMAGE_REPO_NAME:$CODEBUILD_BUILD_NUMBER $ECR_REGISTRY/$IMAGE_REPO_NAME:$CODEBUILD_BUILD_NUMBER
      - docker tag $IMAGE_REPO_NAME:$CODEBUILD_BUILD_NUMBER $ECR_REGISTRY/$IMAGE_REPO_NAME:latest

  post_build:
    commands:
      - docker push $ECR_REGISTRY/$IMAGE_REPO_NAME:$CODEBUILD_BUILD_NUMBER
      - docker push $ECR_REGISTRY/$IMAGE_REPO_NAME:latest
      # Write image definition for CodeDeploy ECS action
      - printf '[{"name":"app","imageUri":"%s"}]' $ECR_REGISTRY/$IMAGE_REPO_NAME:$CODEBUILD_BUILD_NUMBER > imagedefinitions.json

artifacts:
  files:
    - imagedefinitions.json
    - appspec.yml
```

```
AWS CodePipeline stages:
━━━━━━━━━━━━━━━━━━━━━━━━
  Stage 1: Source
    → GitHub / CodeCommit webhook → trigger on push to main
    
  Stage 2: Build (CodeBuild)
    → npm ci → lint → tests → docker build → push to ECR
    
  Stage 3: Deploy to Staging
    → CodeDeploy → ECS blue/green → update staging service with new image
    → Run smoke tests / health check
    
  Stage 4: Manual Approval (SNS notification to Slack/email)
    → Human reviews staging
    → Approves or rejects
    
  Stage 5: Deploy to Production
    → CodeDeploy ECS → blue/green deployment
    → 10% traffic → 50% → 100% (canary/linear)
    → Rollback if health check fails
    
  Stage 6: Notification
    → SNS → Slack: "Deploy #123 to prod succeeded in 4m 32s"
```

**Azure Pipeline (azure-pipelines.yml + App Service):**

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include: [main]

variables:
  dockerImage: "myapp"
  acrRegistry: "mycompany.azurecr.io"
  tag: "$(Build.BuildNumber)"

stages:
  # ── STAGE 1: Build + Test ──────────────────────────────────────────────────
  - stage: BuildAndTest
    jobs:
      - job: BuildJob
        pool:
          vmImage: "ubuntu-latest"
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: "20.x"

          - script: npm ci
            displayName: "Install dependencies"

          - script: npm run lint
            displayName: "Lint"

          - script: npm run test:unit -- --coverage
            displayName: "Unit tests"

          - task: PublishTestResults@2
            inputs:
              testResultsFormat: "JUnit"
              testResultsFiles: "**/test-results.xml"

          - task: Docker@2
            displayName: "Build and push Docker image"
            inputs:
              command: buildAndPush
              containerRegistry: "ACRServiceConnection"
              repository: $(dockerImage)
              tags: |
                $(tag)
                latest

  # ── STAGE 2: Deploy Staging ────────────────────────────────────────────────
  - stage: DeployStaging
    dependsOn: BuildAndTest
    condition: succeeded()
    jobs:
      - deployment: StagingDeploy
        environment: "staging"
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureWebAppContainer@1
                  inputs:
                    azureSubscription: "AzureServiceConnection"
                    appName: "myapp-staging"
                    imageName: "$(acrRegistry)/$(dockerImage):$(tag)"

                - script: npm run test:integration
                  displayName: "Integration tests against staging"

  # ── STAGE 3: Deploy Production (with approval gate) ───────────────────────
  - stage: DeployProduction
    dependsOn: DeployStaging
    condition: succeeded()
    jobs:
      - deployment: ProdDeploy
        environment: "production"   # environment has approval check in Azure DevOps UI
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureWebAppContainer@1
                  inputs:
                    azureSubscription: "AzureServiceConnection"
                    appName: "myapp-production"
                    imageName: "$(acrRegistry)/$(dockerImage):$(tag)"
                    deployToSlotOrASE: true
                    slotName: "staging"   # deploy to staging SLOT

                - task: AzureAppServiceManage@0
                  displayName: "Swap to production"
                  inputs:
                    azureSubscription: "AzureServiceConnection"
                    appName: "myapp-production"
                    sourceSlot: "staging"   # swap staging slot → production (zero downtime)
```

**Security steps every pipeline should have:**
```
✅ npm audit --audit-level=high   (dep vulnerability check)
✅ Container image scanning (Trivy / AWS ECR scan / Azure Defender)
✅ SAST (static analysis): SonarQube / CodeQL
✅ Secret detection: git-secrets / Gitleaks (prevent API keys committed)
✅ DAST (dynamic): ZAP scan against staging URL
✅ Sign artifacts (AWS: ECR image signing; Azure: artifact integrity)
```

**Zero-downtime deployment strategies:**
| Strategy | How | Downtime | Rollback |
|---|---|---|---|
| Blue/Green | New version on fresh infra, swap traffic | Zero | Instant (swap back) |
| Canary | 5% → 25% → 100% traffic shift | Zero | Reduce canary % |
| Rolling | Replace instances one by one | Near-zero | Redeploy previous image |
| Feature flags | Deploy code with flag off, toggle flag | Zero | Toggle flag off |

---

### Q22 [INTERMEDIATE]: What is GitHub Actions — triggers, syntax and what happens when?

**A:** GitHub Actions is GitHub's built-in CI/CD automation platform. You define workflows in YAML files inside `.github/workflows/`. Workflows run on GitHub-hosted or self-hosted runners (VMs) in response to events.

**ELI5:** GitHub Actions is like setting up automatic security cameras with auto-responses. "If someone opens the front door (push to main), sound the alarm (run tests). If the alarm is silent (tests pass), open the delivery chute (deploy)."

**Anatomy of a workflow:**
```yaml
# .github/workflows/ci.yml
name: CI / CD Pipeline

# ── TRIGGERS (on: section) ───────────────────────────────────────────────────
on:
  push:
    branches: [main, develop]       # runs on push to these branches
  pull_request:
    branches: [main]                # runs when PR targets main
  schedule:
    - cron: "0 2 * * *"             # runs daily at 2am UTC
  workflow_dispatch:                # can be triggered manually from UI
  release:
    types: [published]              # runs when a GitHub Release is published

# ── GLOBALS ──────────────────────────────────────────────────────────────────
env:
  NODE_VERSION: "20"
  IMAGE_NAME: "myapp"

# ── JOBS ─────────────────────────────────────────────────────────────────────
jobs:

  # Job 1: test (runs first)
  test:
    runs-on: ubuntu-latest          # GitHub-hosted runner (Windows / macOS also available)
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4    # action (reusable unit) that clones the repo

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"              # cache node_modules between runs

      - name: Install dependencies
        run: npm ci                 # run shell command

      - name: Run tests
        run: npm test
        env:
          CI: true
          DB_URL: ${{ secrets.TEST_DB_URL }}   # from repository/org secrets

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  # Job 2: build docker image (depends on test passing)
  build:
    needs: test                     # only runs if test job succeeded
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}   # pass data between jobs

    steps:
      - uses: actions/checkout@v4

      - name: Docker meta
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=sha                # sha-abc1234
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}    # automatic, no setup needed

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}

  # Job 3: deploy to production (only on main branch, manual approval via environment)
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production         # requires environment protection rules (approval, reviewers)
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: task-def.json
          service: my-ecs-service
          cluster: my-cluster
          wait-for-service-stability: true
```

**What happens at each trigger:**

| Event | When fire | Common use |
|---|---|---|
| `push` to main | Every commit merged | Deploy to staging/prod |
| `pull_request` | PR opened/updated | Run tests, lint, preview deploy |
| `schedule` | Cron expression | Nightly builds, security scans |
| `workflow_dispatch` | Manual from UI | Emergency prod deploy, manual release |
| `release: published` | GitHub Release | Build and publish packages (npm publish) |
| `repository_dispatch` | API call | Triggered by other systems |

**Key concepts:**
- **Secrets:** environment secrets (repo settings → Secrets) — never log them
- **GITHUB_TOKEN:** auto-generated per-run token — safe for repo actions
- **Environment:** named deployment target with optional protection rules (required reviewers, wait timer)
- **Matrix strategy:** run same job with multiple configs (multiple Node versions, multiple OS)
- **Reusable workflows:** call a workflow from another workflow (DRY principle)

```yaml
# Matrix example — test on Node 18 and 20, on ubuntu and windows
strategy:
  matrix:
    node: [18, 20]
    os: [ubuntu-latest, windows-latest]
runs-on: ${{ matrix.os }}
steps:
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node }}
```

---

### Q23 [ADVANCED]: What security parameters should you implement in a Node.js / Express app?

**A:** Express is unopinionated — security is entirely your responsibility. Apply defense in depth: secure each layer.

**ELI5:** A Node.js Express app is like opening a restaurant with no locks, no ID checks, and an open kitchen. Security is bolting those locks on yourself. Helmet is the alarm system. Rate limiting is the bouncer. Input validation is checking if the "food order" is actually a food order and not a bomb.

**1. HTTP Security Headers — use Helmet.js**
```javascript
const helmet = require("helmet");
app.use(helmet());
// Sets: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, HSTS,
// Content-Security-Policy, Referrer-Policy, Permissions-Policy
```

**2. Rate Limiting — prevent brute force & DDoS**
```javascript
const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,    // 15 minutes
  max: 10,                       // 10 login attempts per 15 min
  message: "Too many login attempts. Try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/auth/login", authLimiter, loginHandler);
```

**3. Input Validation — never trust user input**
```javascript
const { z } = require("zod");

const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z\s]+$/),
});

app.post("/users", (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.issues });
  // proceed with result.data (typed, validated)
});
```

**4. SQL/NoSQL Injection Prevention**
```javascript
// ❌ NEVER interpolate user input into queries
const user = await db.find({ name: req.query.name });   // MongoDB injection risk
// Attacker sends: ?name[$gt]=  → returns ALL users

// ✅ Validate shape with Zod before using in query
// ✅ Use MongoDB query operators only from validated structure
// ✅ For SQL: use parameterized queries always
pool.query("SELECT * FROM users WHERE id = $1", [req.params.id]);  // ✅
pool.query(`SELECT * FROM users WHERE id = ${req.params.id}`);     // ❌ SQL injection
```

**5. Authentication & JWT security**
```javascript
// ✅ Short JWT expiry + refresh token pattern
const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "15m" });
const refreshToken = jwt.sign({ userId }, process.env.REFRESH_SECRET, { expiresIn: "7d" });

// ✅ Store refresh token in HttpOnly cookie (not localStorage)
res.cookie("refreshToken", refreshToken, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

// ✅ Always verify JWT algorithm explicitly (prevent alg:none attack)
jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
```

**6. CORS — restrict origins**
```javascript
const cors = require("cors");
app.use(cors({
  origin: ["https://yourdomain.com", "https://admin.yourdomain.com"],
  credentials: true,  // allow cookies
}));
// ❌ Never: origin: "*" with credentials: true
```

**7. Password hashing — bcrypt with correct cost factor**
```javascript
const bcrypt = require("bcrypt");
const SALT_ROUNDS = 12;  // balance: 10-14 is typical; higher = slower brute force

const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
const match = await bcrypt.compare(plainPassword, storedHash);
```

**8. Environment & secrets management**
```javascript
// ✅ Use environment variables, never hard-code secrets
// ✅ Validate env vars at startup
const { DB_URL, JWT_SECRET, REDIS_URL } = process.env;
if (!DB_URL || !JWT_SECRET) {
  console.error("Missing required env vars"); process.exit(1);
}
// ✅ Use AWS Secrets Manager / Azure Key Vault in production
```

**9. Dependency security**
```bash
npm audit                         # check for CVEs
npm audit fix                     # auto-fix where possible
# Add to CI: npm audit --audit-level=high → fail build if high/critical CVEs
```

**10. Error handling — don't leak internals**
```javascript
// ❌ Never send stack traces or DB errors to client
res.status(500).json({ error: err.stack });

// ✅ Log internally, send generic message to client
console.error("Internal error:", err);
res.status(500).json({ error: "Internal server error" });

// ✅ Distinguish operational (4xx) vs programmer (5xx) errors
```

**Security checklist:**
- [ ] Helmet.js for HTTP headers
- [ ] express-rate-limit on all auth routes
- [ ] Zod/Joi input validation on all routes
- [ ] Parameterized queries (no string interpolation in DB queries)
- [ ] JWT: short expiry, explicit algorithm, HttpOnly cookie refresh
- [ ] CORS: whitelist origins only
- [ ] bcrypt with ≥ 10 rounds
- [ ] No secrets in code or NEXT_PUBLIC_ / client bundle
- [ ] `npm audit` in CI/CD
- [ ] Error handler that doesn't expose stack traces

---

### Q24 [ADVANCED]: Explain the structure of GraphQL for a complex application and how you would integrate it with a Node.js backend?

**A:**

**ELI5:** GraphQL is like a restaurant menu. The menu (schema) lists everything available. You write exactly what you want to eat (query). The chef (resolver) goes to the right kitchen (database/microservice) and returns exactly that. One waiter trip, perfect order.

**Core GraphQL structure:**
```
Schema (SDL)          Resolvers               Data Sources
─────────────         ─────────────────       ─────────────────
type Query {     →    Query: {           →    MongoDB / PostgreSQL
  user(id:ID!):User     user: async(_,       REST microservices
}                         {id}, ctx) =>      Redis cache
type User {               ctx.db             gRPC services
  id: ID!                 .findById(id)
  orders:[Order]      }
}
```

**Complete Node.js + Apollo Server 4 setup:**
```javascript
// schema.js
import { gql } from 'graphql-tag';
export const typeDefs = gql`
  type Query {
    user(id: ID!): User
    products(category: String, limit: Int): [Product!]!
  }
  type Mutation {
    createOrder(input: OrderInput!): Order!
  }
  type User {
    id: ID!
    name: String!
    orders: [Order!]!
  }
  type Order  { id: ID!  total: Float! status: String! }
  type Product { id: ID! name: String! price: Float! }
  input OrderInput { productIds: [ID!]! }
`;

// resolvers.js
export const resolvers = {
  Query: {
    user: async (_, { id }, { dataSources }) =>
      dataSources.usersDB.findById(id),
    products: async (_, { category, limit }, { dataSources }) =>
      dataSources.productsDB.find({ category, limit }),
  },
  Mutation: {
    createOrder: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      return dataSources.ordersDB.create({ ...input, userId: user.id });
    },
  },
  User: {
    orders: async (parent, _, { dataSources }) =>
      dataSources.ordersLoader.load(parent.id),  // DataLoader solves N+1
  },
};

// server.js
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import DataLoader from 'dataloader';

const server = new ApolloServer({ typeDefs, resolvers });
await server.start();

app.use('/graphql', expressMiddleware(server, {
  context: async ({ req }) => ({
    user: verifyJWT(req.headers.authorization),
    dataSources: {
      usersDB: new UsersDataSource(db),
      ordersLoader: new DataLoader(batchLoadOrders),  // solves N+1
    },
  }),
}));
```

**Key integration patterns:**
| Topic | Pattern |
|---|---|
| Authentication | JWT verified in `context`, throw `GraphQLError` in resolvers |
| Authorization | Check `ctx.user.role` in resolver (or `@auth` schema directive) |
| N+1 prevention | DataLoader batches DB calls per request lifecycle |
| Caching | Apollo response cache + Redis for field-level caching |
| Error handling | `GraphQLError` with `extensions: { code }` for typed errors |
| Schema federation | Apollo Federation — multiple microservices, one unified graph |
| Subscriptions | `graphql-ws` + WebSocket transport for real-time events |

**When to choose GraphQL over REST:**
- Multiple clients (web, mobile, TV) with different data needs
- Complex related data (user → orders → items → products)
- Rapid UI iteration without backend contract changes
- Microservices that need a unified API layer (BFF pattern)

---

### Q25 [ADVANCED]: Explain your authentication mechanism — how did you implement Azure AD based auth with RBAC?

**A:**

**ELI5:** Azure AD is like an enterprise security guard. When you arrive at the office (app), the guard calls corporate HR (Azure AD) to verify who you are. Once verified, the guard checks your employee badge (token with roles) to see which doors (features) you're allowed to enter — that's RBAC (Role-Based Access Control).

**Flow:**
```
User → App → Azure AD login → ID/Access token returned
           → Backend validates JWT → extracts roles claim
           → Allow/Deny based on role
```

**Frontend — MSAL React:**
```javascript
import { useMsal, MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';

const msalInstance = new PublicClientApplication({
  auth: {
    clientId: process.env.REACT_APP_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.REACT_APP_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
});

function LoginButton() {
  const { instance } = useMsal();
  return (
    <button onClick={() => instance.loginPopup({
      scopes: ['api://your-api-id/access_as_user']
    })}>
      Sign in with Microsoft
    </button>
  );
}

// Attach bearer token to API calls
function useApiCall() {
  const { instance, accounts } = useMsal();
  return async (url) => {
    const result = await instance.acquireTokenSilent({
      scopes: ['api://your-api-id/access_as_user'],
      account: accounts[0],
    });
    return fetch(url, { headers: { Authorization: `Bearer ${result.accessToken}` } });
  };
}
```

**Backend — JWT validation + RBAC (Node.js/Express):**
```javascript
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

const jwksClient = jwksRsa({
  jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`
});

function getKey(header, callback) {
  jwksClient.getSigningKey(header.kid, (err, key) =>
    callback(err, key?.getPublicKey())
  );
}

function verifyAzureToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  jwt.verify(token, getKey, {
    audience: 'api://your-api-id',
    issuer: `https://sts.windows.net/${TENANT_ID}/`,
    algorithms: ['RS256'],
  }, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.user = decoded;   // { oid, name, email, roles: ['Admin','Editor'] }
    next();
  });
}

// RBAC middleware — reads App Roles claim from token
function requireRole(...roles) {
  return (req, res, next) => {
    const userRoles = req.user.roles || [];
    const hasRole = roles.some(r => userRoles.includes(r));
    if (!hasRole) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

// Usage
app.get('/api/reports', verifyAzureToken, requireRole('Admin', 'Analyst'), getReports);
app.delete('/api/users/:id', verifyAzureToken, requireRole('Admin'), deleteUser);
```

**Azure AD App Registration setup:**
1. Register app → Azure portal → App Registrations
2. Define App Roles in manifest: `{ "allowedMemberTypes": ["User"], "value": "Admin" }`
3. Assign roles to users/groups → Enterprise Applications → App Roles
4. Expose an API (set Application ID URI: `api://your-api-id`)
5. Add API permission in frontend app registration

**Security best practices:**
- ✅ Validate JWT signature via JWKS endpoint (public key rotation handled automatically)
- ✅ Check `aud` (audience) matches your API's client ID
- ✅ Check `iss` (issuer) matches your tenant
- ✅ Extract roles from `roles` claim — set in Azure AD App Roles, not user profile
- ✅ Use `acquireTokenSilent` with fallback to interactive for refresh
- ✅ Store access tokens in memory (not localStorage) to prevent XSS theft

---

## MongoDB

**Category:** NoSQL Database | **Questions:** 10+ Scenarios | **Level:** Intermediate → Advanced

MongoDB is a document-oriented NoSQL database designed for scalability and flexibility. These scenarios cover schema design, transactions, sharding, and real-world challenges.

### Scenario 1: Design E-Commerce Order System

**CONTEXT:** Build MongoDB schema for e-commerce platform handling 100K orders/day. Need real-time inventory management and historical order tracking.

**QUESTIONS:**
1. How do you model orders with items? Embed or reference?
2. How do you prevent overselling inventory?
3. How do you optimize historical order queries?
4. What indexing strategy would you use?

**SOLUTION:** (See MongoDB/09_interview_qa_scenarios.md for full schema design, transactions, and indexing strategies)

**KEY INSIGHTS:**
- ✅ Embed items in order (always queried together)
- ✅ Separate inventory collection (high update frequency)
- ✅ Use transaction to prevent race condition (overselling)
- ✅ Strategic indexes for common queries
- ✅ Aggregation for analytics

---

### Scenario 2: Real-Time Dashboard with High Data Volume

**CONTEXT:** Build real-time analytics dashboard processing 50K events/second. Users query dashboards on-demand. Response time < 500ms.

**CHALLENGE:** Raw event data (50K/sec × 86400 sec = 4.3 billion events/day) too much to query directly.

**SOLUTION:** Time-Series Bucketing
- Instead of 4B events, store 1.2M hourly summaries
- Aggregate during insertion
- Query buckets instead of raw events

**Result:** 24 documents for last 24 hours vs 4B raw events. Query time < 10ms vs minutes.

---

### Scenario 3: Handling Hot Shard Problem

**CONTEXT:** User IDs sequential (1, 2, 3...). When shard key is userId, all new users go to last shard (hot spot). Active users always on same shard = bottleneck.

**SOLUTIONS:**
1. **Hash shard key:** random distribution
2. **Compound shard key:** region + hashed userId
3. **Monitor and rebalance:** MongoDB auto-balances

---

### Scenario 4: Eventual Consistency with Denormalization

**CONTEXT:** User profiles denormalized in posts collection. When user updates profile, posts must reflect changes (but delays acceptable).

**CHALLENGE:** Keep denormalized data fresh without real-time consistency requirements.

**SOLUTION:** Change Streams + Background Jobs OR Scheduled batch jobs OR Event-driven webhooks

---

### Common MongoDB Interview Questions

**Q1:** Design a MongoDB schema for a multi-tenant SaaS application.
- A: Embed tenant data, use tenant ID as shard key, isolate collections by tenant

**Q2:** How do you scale write-heavy workloads?
- A: Sharding by most selective field, increase write concern safety, use bulk operations

**Q3:** What's the tradeoff between embedding and referencing?
- A: Embed for joins/performance, reference for consistency/update flexibility

**Q4:** How do you prevent data loss during network partition?
- A: Use write concern {w: "majority"}, enable journaling, replica set with 3+ nodes

**Q5:** Design an event sourcing system with MongoDB.
- A: Immutable event log collection, snapshot collection (periodic cache), replay for state

**Q6:** How to handle time-series data at massive scale?
- A: Pre-aggregate during writes (hourly/daily), TTL indexes for retention, time-series buckets

**Q7:** You have a query running 10 seconds. How do you optimize?
- A: Check explain() for COLLSCAN, add index, use projection, consider denormalization

**Q8:** Design a payment system ensuring no duplicate charges.
- A: Idempotency key, transaction + charge logging, periodic reconciliation

---

### Q9 [INTERMEDIATE]: What are Aggregation Pipelines and what is $facet?

**A:** An aggregation pipeline is a sequence of **stages** that transform documents step-by-step. Each stage receives the output of the previous stage, like an assembly line.

**ELI5:** Think of a car assembly line. Raw metal enters. Stage 1 cuts the body. Stage 2 paints it. Stage 3 adds wheels. The output of one station becomes the input for the next. MongoDB aggregation is the same — each stage transforms the data before passing it along.

**Core stages:**
```javascript
db.orders.aggregate([
  // Stage 1: Filter — like SQL WHERE
  { $match: { status: "completed", createdAt: { $gte: new Date("2024-01-01") } } },

  // Stage 2: Join — like SQL LEFT JOIN
  { $lookup: {
    from: "customers",
    localField: "customerId",
    foreignField: "_id",
    as: "customer"
  }},
  { $unwind: "$customer" },  // flatten the joined array

  // Stage 3: Compute new fields
  { $addFields: {
    totalWithTax: { $multiply: ["$total", 1.18] },
    customerName: "$customer.name"
  }},

  // Stage 4: Group — like SQL GROUP BY
  { $group: {
    _id: "$customer.country",
    totalRevenue: { $sum: "$totalWithTax" },
    orderCount:   { $sum: 1 },
    avgOrderValue: { $avg: "$totalWithTax" }
  }},

  // Stage 5: Sort results
  { $sort: { totalRevenue: -1 } },

  // Stage 6: Limit output
  { $limit: 10 },

  // Stage 7: Reshape output — like SQL SELECT column aliasing
  { $project: {
    country: "$_id",
    totalRevenue: { $round: ["$totalRevenue", 2] },
    orderCount: 1,
    avgOrderValue: { $round: ["$avgOrderValue", 2] },
    _id: 0
  }}
])
```

**What is `$facet`?**

`$facet` runs **multiple independent aggregation pipelines in a single pass** over the collection. This is perfect for search result pages that need: total count + pagination + category filters + price range buckets — all at once.

**ELI5:** Imagine you're counting a box of LEGO pieces. Normally you'd count them once for colour, then again for size, then again for type. With `$facet` you count everything in one pass and get all three answers simultaneously.

```javascript
// Example: E-commerce product search with facets
db.products.aggregate([
  // First: filter the dataset (common pre-filter for all facets)
  { $match: { category: "electronics", inStock: true } },

  // $facet: run all these sub-pipelines on the same filtered dataset
  { $facet: {

    // Facet 1: Paginated results
    paginatedResults: [
      { $sort: { rating: -1 } },
      { $skip: 0 },
      { $limit: 20 },
      { $project: { name: 1, price: 1, rating: 1, image: 1 } }
    ],

    // Facet 2: Total count (for pagination UI)
    totalCount: [
      { $count: "total" }
    ],

    // Facet 3: Price range buckets (price histogram)
    priceRanges: [
      { $bucket: {
        groupBy: "$price",
        boundaries: [0, 100, 500, 1000, 5000],
        default: "5000+",
        output: { count: { $sum: 1 } }
      }}
    ],

    // Facet 4: Brand distribution
    brands: [
      { $group: { _id: "$brand", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ],

    // Facet 5: Average rating per sub-category
    avgRatingBySubcategory: [
      { $group: {
        _id: "$subCategory",
        avgRating: { $avg: "$rating" },
        productCount: { $sum: 1 }
      }}
    ]
  }}
])

// Result shape:
// {
//   paginatedResults: [ { name, price, … }, … ],
//   totalCount: [{ total: 1243 }],
//   priceRanges: [{ _id: 0, count: 45 }, { _id: 100, count: 320 }, …],
//   brands: [{ _id: "Samsung", count: 89 }, …],
//   avgRatingBySubcategory: [{ _id: "Laptops", avgRating: 4.2, … }, …]
// }
```

**Key pipeline operators quick reference:**

| Stage | SQL equivalent | Use |
|---|---|---|
| `$match` | WHERE | Filter documents early (uses indexes!) |
| `$project` | SELECT | Include/exclude/compute fields |
| `$group` | GROUP BY | Aggregate into groups |
| `$sort` | ORDER BY | Sort pipeline output |
| `$lookup` | LEFT JOIN | Join another collection |
| `$unwind` | FLATTEN | Deconstruct array field into separate docs |
| `$limit`/`$skip` | LIMIT/OFFSET | Pagination |
| `$facet` | — | Multiple parallel sub-pipelines in one pass |
| `$bucket` | — | Range-based grouping (histograms) |
| `$addFields` | AS (computed col) | Add computed fields without removing others |
| `$out`/`$merge` | INSERT INTO | Save pipeline output to a collection |

**Performance tips for aggregation:**
1. `$match` and `$limit` as early as possible — reduces documents flowing down
2. `$match` on indexed fields — uses the index just like a `find()` query
3. `$facet` is better than N separate queries — one collection scan for all facets
4. For analytics on large collections, use `$out` to store pre-computed results

---

### Q10 [INTERMEDIATE]: Advantages and disadvantages of indexing in MongoDB — when to use what?

**A:** An index is a separate data structure (B-tree by default) that maps field values to document locations. It dramatically speeds up reads at the cost of write overhead and storage.

**ELI5:** A book index is a sorted list at the back that says "page 243 for 'recursion'". Without it, you'd read every page. With it, you jump straight to page 243. MongoDB indexes work the same way — sorted list of values pointing to documents. The trade-off: maintaining the index during every insert/update costs time.

**Without index (COLLSCAN) vs with index (IXSCAN):**
```javascript
// Check query plan
db.movies.find({ title: "Inception" }).explain("executionStats")
// COLLSCAN: reads ALL docs — O(n)
// IXSCAN:   reads index — O(log n)
```

**Types of indexes:**

```javascript
// 1. Single Field Index — most common
db.movies.createIndex({ title: 1 })             // ascending
db.movies.createIndex({ year: -1 })             // descending

// 2. Compound Index — covers multi-field queries
// Rule: Equality → Sort → Range (ESR rule)
db.orders.createIndex({ customerId: 1, status: 1, createdAt: -1 })
// ✅ Covers: find({ customerId, status }).sort({ createdAt })
// ❌ Doesn't help: find({ status }).sort({ createdAt }) — skips first field

// 3. Multikey Index — for array fields (auto-created when field is array)
db.posts.createIndex({ tags: 1 })
// find({ tags: "mongodb" }) → uses index even though tags is an array

// 4. Text Index — full-text search
db.articles.createIndex({ title: "text", body: "text" }, { weights: { title: 10 } })
db.articles.find({ $text: { $search: "mongodb performance" } })

// 5. Geospatial Index — location-based queries
db.restaurants.createIndex({ location: "2dsphere" })
db.restaurants.find({ location: { $near: { $geometry: { type: "Point", coordinates: [72.8, 18.9] } }, $maxDistance: 1000 } })

// 6. Hashed Index — for sharding (even distribution)
db.users.createIndex({ userId: "hashed" })   // shard key must be hashed for even distribution

// 7. TTL Index — auto-delete documents after a time
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 })  // delete after 1 hour

// 8. Partial Index — only index documents matching a filter (saves space)
db.orders.createIndex({ customerId: 1 }, { partialFilterExpression: { status: "active" } })
// Only indexes active orders — inactive orders don't occupy index space

// 9. Sparse Index — only index documents where field EXISTS
db.users.createIndex({ phone: 1 }, { sparse: true })
// Documents without 'phone' field are excluded from the index

// 10. Unique Index
db.users.createIndex({ email: 1 }, { unique: true })  // enforce uniqueness
```

**Advantages of indexing:**

| Advantage | Detail |
|---|---|
| Fast reads | O(log n) tree traversal vs O(n) collection scan |
| Covered queries | If all fields are in the index, MongoDB NEVER reads the document itself |
| Sorted output | Index already sorted — free sort for ORDER BY |
| Unique constraint | Unique index enforces data integrity |
| TTL auto-cleanup | TTL indexes delete expired documents automatically |
| Range queries | B-tree efficient for >, <, between operations |

**Disadvantages of indexing:**

| Disadvantage | Detail |
|---|---|
| Write overhead | Every `insert`, `update`, `delete` must also update the index |
| Storage cost | Index = extra disk/RAM space (often 10-30% of collection size) |
| RAM usage | Working set (hot indexes) must fit in RAM for best performance |
| Index build time | Building index on large collection = expensive operation |
| Over-indexing | Too many indexes slow down writes significantly |
| Wrong compound order | Index may be unused if query doesn't match prefix (ESR rule) |

**When to use what — decision guide:**

```
Query pattern                          → Index type
──────────────────────────────────────────────────────────────
Exact match on one field              → Single-field
Multi-field queries with sort         → Compound (ESR order)
Array field search                    → Multikey (auto)
Full-text search                      → Text index
Location-based queries                → 2dsphere
Auto-expire documents (sessions/OTP)  → TTL
Shard key distribution                → Hashed
Large collection, only index active   → Partial
Optional fields (nullable)            → Sparse
Enforce no duplicates                 → Unique
```

**The ESR (Equality → Sort → Range) compound index rule:**
```javascript
// Query: find active orders for a customer, sorted by date, created this month
db.orders.find({ 
  customerId: "C1",        // EQUALITY
  createdAt: { $gte: ... } // RANGE
}).sort({ status: 1 })     // SORT

// CORRECT compound index — Equality first, then Sort, then Range
db.orders.createIndex({ customerId: 1, status: 1, createdAt: 1 })
//                         EQUALITY    SORT        RANGE
```

**Detecting slow queries (always do this before adding indexes):**
```javascript
db.setProfilingLevel(1, { slowms: 100 })   // log queries > 100ms
db.system.profile.find().sort({ ts: -1 }).limit(5)   // view slow queries
db.collection.find(query).explain("executionStats")   // see COLLSCAN vs IXSCAN
```

---

### Q11 [ADVANCED]: Why are relational databases better than NoSQL? What are the advantages of MongoDB/NoSQL over RDBMS? What are the disadvantages of both?

**A:**

**ELI5:** A relational database (RDBMS) is like an Excel spreadsheet — every row fits the same columns, and you link sheets with IDs (JOINs). MongoDB is like a folder of documents — each document can have different fields, and you evolve the shape over time. Both are excellent tools. Which to use depends on your data shape and access patterns.

**RDBMS advantages:**
| Advantage | Why it matters |
|---|---|
| ACID transactions | Bank transfers: debit one account, credit another — atomically |
| Strict schema | Data integrity guaranteed at DB level — no half-written records |
| Complex JOINs | Reporting dashboards with multi-table queries |
| SQL standard | Universal, decades of tooling, every developer knows it |
| Normalisation | DRY data — no duplication, referential integrity via foreign keys |
| Mature ecosystem | PostgreSQL, MySQL: battle-tested, extensive tooling |

**MongoDB / NoSQL advantages:**
| Advantage | Why it matters |
|---|---|
| Flexible schema | Evolve document shape without migrations |
| Document model | Store nested/related data in one document — no JOIN at read time |
| Horizontal scaling | Sharding distributes data across nodes — scales to petabytes |
| High write throughput | Optimised for large-scale inserts (events, logs, IoT) |
| Geo-distributed | Multi-region active-active replication (Atlas Global Clusters) |
| Speed at scale | No JOIN = predictable O(1) read by `_id` |

**Disadvantages of RDBMS:**
| Disadvantage | Detail |
|---|---|
| Vertical scaling limit | Scaling UP (more CPU/RAM) not OUT — expensive ceiling |
| Schema rigidity | `ALTER TABLE` on 1 billion rows is painful |
| ORM impedance mismatch | Object graphs don't map cleanly to tables |
| Poor for unstructured data | Storing JSON blobs loses all relational benefits |

**Disadvantages of MongoDB / NoSQL:**
| Disadvantage | Detail |
|---|---|
| Multi-document transactions | ACID across multiple collections requires distributed transactions — slower |
| Data duplication | Denormalisation means same data in multiple places — inconsistency risk |
| No native JOIN | Application-level joins or `$lookup` — complex for reporting queries |
| Schema flexibility = footgun | No enforcement means inconsistent documents creep in over time |
| Query complexity | Aggregation pipeline is powerful but verbose compared to SQL |

**Decision matrix:**
```
RDBMS (PostgreSQL, MySQL)          MongoDB (NoSQL)
─────────────────────────          ───────────────────────
✅ Financial systems                ✅ Product catalogs (varied attributes)
✅ ERP / CRM                        ✅ Real-time analytics / time-series
✅ Complex reporting (multi-JOIN)    ✅ Content management (variable structure)
✅ Strong consistency required       ✅ Event logging / audit trails
✅ Regulatory compliance (ACID)      ✅ User-generated content
✅ Well-defined, stable schema       ✅ Rapidly evolving data shapes
```

**Hybrid approach (common in production):**
```
PostgreSQL → core business data (orders, payments, users)
MongoDB    → product catalog, sessions, activity logs
Redis      → caching, rate-limiting, real-time pub/sub
S3         → files, media, exports
```

---


### Q1 [FUNDAMENTALS]: What is Docker and how does it differ from a virtual machine?

**A:** Docker containers share the host OS kernel; each VM has its own full OS kernel. Containers start in milliseconds and use far less memory (MBs vs GBs).

| | Container | VM |
|---|---|---|
| Boot time | ~100ms | 1–60s |
| Size | MBs | GBs |
| OS | Shares host kernel | Own OS |
| Isolation | Namespaces / cgroups | Hypervisor |
| Portability | High | Medium |

---

### Q2 [FUNDAMENTALS]: What are Docker layers and how do they work?

**A:** Every `RUN`, `COPY`, and `ADD` instruction creates an immutable layer cached by content hash. Layers are stacked using a union filesystem (OverlayFS). When building, Docker reuses cached layers until a cache-invalidating change is detected. Images are the sum of all layers; containers add a thin writable layer on top (Copy-on-Write).

---

### Q3-Q28: [Complete Docker Interview Q&A]

(Full content preserved from Docker/08_interview_qa.md - 28 comprehensive questions covering fundamentals, networking, storage, security, operations, and GitHub Actions CI/CD integration)

**Summary of Docker Topics Covered:**
- Layers and build context
- CMD vs ENTRYPOINT, multi-stage builds
- Network drivers (bridge, host, none, overlay, macvlan)
- EXPOSE vs -p, service networking in compose
- Volume types: named, bind mount, tmpfs
- Security: capabilities, secrets, container escape risks
- Restart policies, rolling updates
- Image optimization and size reduction
- Docker stop vs kill, OOM prevention
- Debugging containers, build cache, container compose
- .dockerignore, buildx, ARG vs ENV
- GitHub Actions CI/CD pipeline integration
- ECR/ECS deployment end-to-end
- Docker Compose for development with dependency management

---

## AWS

**Category:** Cloud Computing Platform | **Questions:** 20+ | **Level:** Intermediate → Advanced

Amazon Web Services is the leading cloud platform. These questions cover CI/CD, containerization, security, networking, databases, Lambda, and production resilience patterns.

### CI/CD Concepts

```
CI — Continuous Integration:
  Every code commit triggers automated pipeline:
    1. Install dependencies
    2. Run tests (unit, integration, lint)
    3. Build application (Docker image, binary)
    4. Publish build artifacts

CD — Continuous Delivery/Deployment:
  After CI succeeds, automatically deploy to environments:
    - Staging: automatic
    - Production: after CI + manual approval (Continuous Delivery)
               OR fully automatic (Continuous Deployment)
```

---

### AWS CodeBuild — Build Server

CodeBuild runs your build commands inside a managed container. Defined by buildspec.yml.

**Phases:**
1. install: Configure runtime and dependencies
2. pre_build: Run tests before building
3. build: Build Docker image or compile code
4. post_build: Push artifacts (Docker image to ECR)

**Output:** Artifacts passed between pipeline stages

---

### AWS CodePipeline — Multi-Stage Pipeline

CodePipeline orchestrates: Source → Build → Test → Deploy-Staging → Approve → Deploy-Prod

- **Source:** watches GitHub/CodeCommit/S3
- **Build:** runs CodeBuild
- **Deploy:** deploys to ECS service using new image
- **Approve:** manual approval action

---

### GitHub Actions Pipeline (Alternative to CodePipeline)

GitHub Actions is GitHub's built-in CI/CD platform. Workflow runs triggered by events (push, pull request, schedule, manual).

**Key Concepts:**
- **Workflow:** YAML file defining entire automation
- **Job:** independent execution unit
- **Step:** individual command or action
- **Action:** reusable code unit
- **Runner:** machine where jobs execute
- **Secret:** encrypted environment variable

---

### Comprehensive AWS Interview Q&A

**(From AWS/08_cicd_interview_qa.md)**

**Topics Covered:**
- IAM & Security (least privilege, roles vs users, STS)
- Networking & VPC (subnets, security groups, NACL, NAT Gateway)
- Compute & Scaling (ASG, vertical vs horizontal scaling)
- Storage (S3 storage classes, CloudFront, lifecycle policies)
- Database (Aurora vs RDS, DynamoDB optimization)
- Lambda & Serverless (cold starts, concurrency, Provisioned Concurrency)
- CI/CD & DevOps (CodeBuild, CodePipeline, CodeDeploy, GitHub Actions)
- Resilience & Disaster Recovery (HA, multi-region, backup strategies)
- Monitoring & Logging (CloudWatch, X-Ray, centralized logging)
- Cost Optimization (Reserved Instances, Spot, Advisor, pricing calculator)

---

### Q: What strategies do you employ to improve system resilience on AWS?

**A:**

**ELI5:** Resilience means your system keeps working even when things break. AWS gives you building blocks — redundancy (multiple copies in multiple places), circuit breakers (stop cascading failures), graceful degradation (do less but keep running), and observability (know when something breaks before your users do).

**Core resilience strategies:**

**1. Multi-AZ / Multi-Region — eliminate single points of failure**
- Deploy across ≥2 Availability Zones for all compute + databases
- ALB routes traffic across healthy instances automatically
- RDS Multi-AZ: automatic failover in ~60 seconds
- DynamoDB Global Tables: active-active multi-region
- Route53 health checks with failover routing policy

**2. Auto-scaling**
- EC2 Auto Scaling Groups: scale out on CPU/request metrics
- ECS Service Auto Scaling: scale tasks based on ALB request count
- DynamoDB On-Demand: auto-scales read/write capacity

**3. Circuit breaker + graceful degradation**
- API Gateway: throttling limits prevent overload
- ALB deregistration delay: drains connections from unhealthy targets
- Lambda reserved concurrency: prevents resource exhaustion cascade
- CloudFront fallback: serve cached/static response when origin fails

**4. Async resilience with queues**
- SQS Dead Letter Queue: capture failed messages for later replay
- SNS + SQS fan-out: decouple producers from consumers
- EventBridge retry policies on failed event delivery

**5. Observability — know before users do**
- CloudWatch metrics + alarms on error rate, latency, saturation
- X-Ray distributed tracing → spot slow downstream services
- CloudWatch Logs Insights: query logs at scale
- SNS alerting on alarm state changes → PagerDuty/Slack

**Disaster Recovery tiers:**
| Strategy | RTO | RPO | Cost |
|---|---|---|---|
| Backup & Restore | Hours | Hours | $ |
| Pilot Light (minimal standby) | Minutes | Minutes | $$ |
| Warm Standby | Seconds | Seconds | $$$ |
| Active-Active Multi-Region | <1s | ~0 | $$$$ |

**Practical resilience checklist:**
- ✅ Multi-AZ for every stateful component (RDS, ElastiCache, ECS)
- ✅ S3 versioning + lifecycle policies for data durability
- ✅ Retry with exponential backoff + jitter on all service calls
- ✅ Idempotent APIs — safe to retry on network failures
- ✅ Chaos engineering — AWS Fault Injection Simulator GameDays
- ✅ Health check endpoint `/health` for every service
- ✅ Blue-green or canary deploys — roll back in seconds

---

## Azure

**Category:** Cloud Computing Platform | **Questions:** 20+ | **Level:** Intermediate → Advanced

Microsoft Azure is the enterprise cloud leader. These questions cover fundamentals, identity & security, compute, databases, DevOps pipelines, and operational best practices.

### Azure Fundamentals

**Q: What is Azure and how is it organized?**

Azure hierarchy: Management Groups → Subscriptions → Resource Groups → Resources

- **Subscription:** billing and access control boundary
- **Resource Group:** logical grouping within subscription
- **Resource:** VMs, storage accounts, databases, etc.

**ELI5:** Azure is like a warehouse. Subscriptions are shopping carts, Resource Groups are boxes, Resources are items.

---

### Identity and Security (Microsoft Entra ID)

**Q: What is Microsoft Entra ID (Azure Active Directory)?**

- Cloud-based identity management service
- Provides: user authentication, MFA, SSO, app registration, conditional access, Privileged Identity Management (PIM)

**Q: What is Conditional Access?**

Policy engine controlling access based on conditions: user's location, device compliance, risk level, etc.

**Q: What is Privileged Identity Management (PIM)?**

Just-in-time (JIT) privileged access. Admins request elevated access for limited time instead of permanent role assignment. All activations audited.

---

### Compute

**Q: What is the difference between Azure VMs and Azure App Service?**

- **Azure VM (IaaS):** full control of OS. You manage patches, software, scaling. More work, more control.
- **App Service (PaaS):** managed web hosting. Deploy code, Azure manages OS, runtime, patching, TLS. Auto-scale built-in.

**ELI5:** VM is owning a house (total responsibility). App Service is renting an apartment (less work).

---

### Azure Pipelines and DevOps

**Q: Walk me through a complete Azure DevOps CI/CD pipeline for a Node.js app.**

1. Developer pushes code to `main`
2. **Build stage:** Install Node, run tests, build Docker image, push to ACR
3. **Deploy Staging:** Deploy to App Service staging slot
4. **Approval Gate:** Pipeline pauses, designated approvers review and approve
5. **Deploy Production:** Swap App Service staging slot with production (zero-downtime)

**Q: What is blue-green deployment in Azure Pipelines with App Service?**

Use deployment slots: deploy new to staging slot (blue=prod, green=staging). Run tests. After approval, swap slots instantly. If issues, swap back (instant rollback).

---

### Comprehensive Azure Interview Q&A

**(From Azure/08_interview_qa.md)**

**Topics Covered:**
- Fundamentals (organization, subscriptions, resource groups)
- Identity & Security (Entra ID, Conditional Access, PIM, Key Vault)
- Authentication with Function App middleware and RBAC
- Compute (VMs, App Service, Scale Sets)
- Databases (Azure SQL, PostgreSQL, Cosmos DB, PITR)
- Azure Pipelines (CI/CD, Variable Groups, deployments, blue-green)
- Monitoring (Azure Monitor, Application Insights, Log Analytics)
- Cost Optimization (Reserved Instances, Spot VMs, Advisor, lifecycle policies)

---

## System Design & Architecture

**Category:** System Design | **Questions:** 2 | **Level:** Advanced

---

### Q1 [ADVANCED]: How would you design a distributed system to serve millions of users simultaneously — including cache, DB, APIs, load balancing, Redis, and flash sale concurrency (1 item, 1000 concurrent buyers)?

**A:**

**ELI5:** Imagine a concert ticket sale. One last ticket. 1000 people click "Buy" at exactly the same second. Without a smart system, 1000 people might all "successfully" buy the same ticket (overselling). Your job is to design a system where exactly 1 person wins, others get a fast "sold out" message, and the whole thing handles millions of people browsing at the same time.

**High-Level Architecture:**
```
Users (millions)
    │
    ↓
CDN (CloudFront) ← Static assets, cached product pages
    │
    ↓
Load Balancer (ALB) ← Distributes traffic, health checks
    ├── API Server 1 (Node.js)
    ├── API Server 2 (Node.js)
    └── API Server N (Node.js)  ← Stateless, horizontal scale
    │
    ↓
Redis Cluster ← Rate limiting, sessions, inventory cache, distributed locks
    │
    ↓
Message Queue (SQS / RabbitMQ) ← Decouple order processing
    │
    ↓
Order Worker ← Processes orders from queue
    │
    ↓
Primary DB (PostgreSQL / Aurora) ← Source of truth
    └── Read Replicas ← Handle read-heavy product browsing
```

**1. CDN layer — absorb 80% of traffic**
- Cache product listing pages at the edge
- Cache images, CSS, JS bundles
- Only dynamic requests (add to cart, checkout) hit origin servers

**2. Load balancer — distribute + health check**
- ALB Layer 7: routes `/api/*` to API servers
- Stateless APIs (sessions in Redis, not server memory)
- Health check `/health` every 15s, removes unhealthy targets

**3. API Servers — rate limiting per user**
```javascript
const rateLimit = require('express-rate-limit');
app.use('/api/flash-sale', rateLimit({
  windowMs: 60_000, max: 10,  // 10 requests/min per IP
  store: new RedisStore({ client: redis }),  // distributed counter
}));
```

**4. Flash Sale Concurrency — the critical part**

**Problem:** 1000 requests arrive at T=0. Without protection, stock goes negative.

**Solution A: Redis atomic DECR (fastest — for single-item sale)**
```javascript
async function purchaseItem(userId, itemId) {
  // DECR is atomic in Redis — no two requests can decrement simultaneously
  const remaining = await redis.decr(`stock:${itemId}`);

  if (remaining < 0) {
    await redis.incr(`stock:${itemId}`);  // rollback
    return { success: false, message: 'Sold out' };
  }

  // Push to queue — don't write to DB synchronously under load
  await sqs.sendMessage({
    QueueUrl: ORDER_QUEUE_URL,
    MessageBody: JSON.stringify({ userId, itemId, ts: Date.now() }),
  });
  return { success: true, message: 'Order processing' };
}
```

**Solution B: Redis Distributed Lock (for multi-step operations)**
```javascript
async function purchaseWithLock(userId, itemId) {
  const lockKey = `lock:item:${itemId}`;
  const lockToken = crypto.randomUUID();

  const acquired = await redis.set(lockKey, lockToken, 'NX', 'PX', 3000);
  if (!acquired) return { success: false, message: 'Try again' };

  try {
    const stock = parseInt(await redis.get(`stock:${itemId}`));
    if (stock <= 0) return { success: false, message: 'Sold out' };
    await redis.decr(`stock:${itemId}`);
    await db.orders.insert({ userId, itemId });
    return { success: true };
  } finally {
    // Release only if we own the lock (Lua script = atomic check-and-delete)
    await redis.eval(
      `if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end`,
      1, lockKey, lockToken
    );
  }
}
```

**Solution C: DB atomic update (most reliable source of truth)**
```sql
-- PostgreSQL — prevents negative stock at db level
UPDATE items SET stock = stock - 1
WHERE id = $1 AND stock > 0
RETURNING id, stock;
-- 0 rows updated = sold out
```

**5. Queue-based order processing — protect the DB**
```
Buy request → Redis DECR (fast, <1ms) → Enqueue order → Return 200 immediately
                                         ↓
                        Worker processes from queue → Write to PostgreSQL
```
Benefits: API responds instantly, DB protected from write storms, failed orders retried automatically.

**6. Read scalability**
- Read replicas for product browsing (millions of reads)
- Redis cache for product details (`TTL 5min`)
- Only write operations hit the primary DB

**Failure scenarios + handling:**
| Scenario | Handling |
|---|---|
| API server dies | ALB detects health check failure → routes to remaining servers |
| Redis crashes | Redis Cluster/Sentinel auto-failover; DB as fallback |
| Queue backup | SQS DLQ captures failed orders; alert on DLQ depth |
| DB overload | Read replicas + write queue + circuit breaker |

---

### Q2 [ADVANCED]: What architectural decision did you make that impacted both frontend and backend layers?

**A:**

This is a **behavioural** question. Use STAR format (Situation, Task, Action, Result).

**Example strong answer:**

**Situation:** We had a React SPA with a REST backend. The frontend was making 8–12 separate API calls on every page load — each component fetching its own data independently.

**Task:** P95 page load was 4.2 seconds. Target was under 1.5 seconds without rewriting everything.

**Action — the architectural decision:** Shifted from REST + client-side orchestration to **GraphQL with a BFF (Backend-for-Frontend) layer**:

1. **Frontend:** Each component had `useEffect + fetch` → replaced with co-located GraphQL fragments. Root query fetched everything in one network round-trip.

2. **Backend:** Introduced Apollo Server as a BFF layer between React and 6 microservices. Implemented DataLoader to batch N+1 calls across user, order, and product services.

3. **Caching:** Added Redis caching in GraphQL resolvers for user sessions and product catalog (TTL 2 min).

4. **Auth:** JWT validation moved to Apollo Server `context` — executed once per request, not in each microservice.

**Result:**
- API calls per page load: 12 → 1
- P95 page load: 4.2s → 1.1s
- DB calls reduced ~60% (DataLoader deduplication)
- Frontend teams could iterate UI without backend deploys

**Impact on both layers:**
| Layer | Change | Impact |
|---|---|---|
| Frontend | GraphQL fragments co-located with components | No over-fetching; type safety end-to-end |
| Backend | BFF aggregation + DataLoader | DB calls reduced 60%; single auth check |
| Infrastructure | Redis resolver caching | CDN-like performance for repeated data |

**Alternative examples:**
- Feature flag system (LaunchDarkly → custom) — impacted FE (conditional renders) and BE (API kill switches)
- Migrated REST → event-driven (Kafka) — FE uses WebSocket for real-time; BE services decoupled
- Micro-frontends via Module Federation — FE teams deploy independently; shared auth/analytics BE contract

---

| Interactive web UI | React | Component-based, large ecosystem, performance |
| Full-stack web app | Next.js | Server Components, built-in routing, caching, SSR |
| Backend API | Node.js | Event-driven, non-blocking I/O, JavaScript everywhere |
| Fast database | MongoDB | Document model, flexible schema, horizontal scaling |
| Container orchestration | Docker | Standardized format, Dev-to-prod parity |
| CI/CD automation | GitHub Actions or AWS CodePipeline | Tight GitHub integration or AWS ecosystem |
| Cloud infrastructure | AWS or Azure | AWS: larger ecosystem; Azure: enterprise Microsoft stack |
| Microservices | Docker + Kubernetes (AWS EKS, Azure AKS) | Container orchestration at scale |

---

## Preparing for Success (7+ Years Experience)

**Study Tips:**
1. **Deep dive:** Don't just memorize answers. Understand the WHY behind each concept.
2. **Build projects:** Create a real app using these techs to cement understanding.
3. **Read source code:** Understanding how frameworks work internally deepens knowledge.
4. **Follow best practices:** SOLID principles, clean code, testing strategies.
5. **Stay current:** Follow Changelog, news.ycombinator.com, GitHub trends.
6. **System design:** Practice designing large-scale systems before interviews.

**Common Interview Patterns:**
- Start with basics, then progressively ask harder questions
- Follow-ups based on your answers (show depth by asking "why?")
- Real-world scenario design questions (Jira clone, real-time trading, etc.)
- Code tracing (predict output of complex code)
- Tradeoff analysis (when would you choose X over Y?)

---

**Last Updated:** March 2026
**Coverage:** JavaScript, React, Next.js, Node.js, MongoDB, Docker, AWS, Azure, System Design

> **New questions added (March 2026):** JS: Object join with Map, Deep merge, Debounce+Throttle React component, CAP Theorem | React: HMR, Diffing deep dive, Security checklist, WCAG A/AA/AAA, Lighthouse performance | Node.js: Web Workers vs Worker Threads, Race condition prevention, IRCTC 1000-user system design | Node.js cross-cutting: Socket.io polling types, Redis distributed lock, Backend performance checklist, Script local-vs-prod debugging, CI/CD pipeline (AWS + Azure), GitHub Actions syntax, Node.js/Express security checklist | MongoDB: Aggregation pipelines + $facet, Indexing advantages/disadvantages

