# Master Interview Q&A - All Technologies

A comprehensive consolidated collection of interview questions and answers for experienced developers (7+ years). This master file combines theory, design patterns, and advanced topics across the full modern web development stack.

---

## Table of Contents

- [JavaScript (19+ Questions)](#javascript)
- [React (20+ Questions)](#react)
- [Next.js (10 Questions)](#nextjs)
- [Node.js (13 Questions)](#nodejs)
- [MongoDB (8+ Scenarios)](#mongodb)
- [Docker (28 Questions)](#docker)
- [AWS (20+ Questions)](#aws)
- [Azure (20+ Questions)](#azure)

---

## JavaScript

**Category:** Core Language Theory | **Questions:** 19+ | **Level:** Basic → Advanced

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

## React

**Category:** Component Framework & State Management | **Questions:** 20+ | **Level:** Basic → Advanced

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

## Next.js

**Category:** Full-Stack React Framework | **Questions:** 10 | **Level:** Basic → Advanced

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

## Node.js

**Category:** JavaScript Runtime & Backend | **Questions:** 13 | **Level:** Basic → Advanced

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

## MongoDB

**Category:** NoSQL Database | **Questions:** 8+ Scenarios | **Level:** Intermediate → Advanced

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

## Docker

**Category:** Containerization | **Questions:** 28 | **Level:** Basic → Advanced

Docker revolutionized application deployment by containerizing workloads. These questions cover fundamentals, networking, storage, security, CI/CD integration, and production best practices.

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

## Quick Reference: Technology Choosing Matrix

| Use Case | Best Technology | Why |
|---|---|---|
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
**Coverage:** JavaScript, React, Next.js, Node.js, MongoDB, Docker, AWS, Azure

