/*
=============================================================
  REACT THEORY — INTERVIEW Q&A
  Basic → Intermediate → Advanced
  For 7+ years experience
=============================================================
*/
import React, {
  useState, useEffect, useRef, useMemo, useCallback,
  useTransition, useDeferredValue, useId, useSyncExternalStore,
  createContext, useContext, memo, forwardRef, createRef,
  Suspense, startTransition
} from 'react';

// ─────────────────────────────────────────────────────────
// ██ SECTION 1: BASIC
// ─────────────────────────────────────────────────────────

/*
Q1 [BASIC]: What is the Virtual DOM and how does React use it?
──────────────────────────────────────────────────────────────
A: The Virtual DOM is a lightweight JavaScript object tree mirroring the real DOM.
   React never touches the real DOM directly. On every state change:
   1. React produces a NEW vDOM tree
   2. Diffing algorithm (Reconciler) compares old vs new tree (O(n) heuristic)
   3. Only the minimal set of real DOM mutations are applied (commit phase)

   Why? Direct DOM manipulation is slow because DOM operations trigger layout/paint.
   Batching changes via vDOM minimizes reflows.

   Important nuance (React 18+): React uses Fiber architecture — not a single "vDOM tree"
   but a linked list of Fiber nodes that allows pausing, aborting, and replaying work.
*/

/*
Q2 [BASIC]: Rules of Hooks — why do they exist?
────────────────────────────────────────────────
A: Two rules:
   1. Only call Hooks at the TOP LEVEL (not inside loops, conditions, nested functions)
   2. Only call Hooks from React functions (components or custom hooks)

   WHY: React identifies hooks by their CALL ORDER, not by name.
   Hooks are stored in a simple array (internally a linked list).
   If you conditionally call a hook, the call order changes between renders
   → React reads the wrong hook's state → bugs.
*/
// BAD:
function BadComponent({ isLoggedIn }) {
  if (isLoggedIn) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [user, setUser] = useState(null); // ❌ conditional hook
  }
}

// GOOD: condition goes INSIDE the hook's logic
function GoodComponent({ isLoggedIn }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    if (!isLoggedIn) return;   // ✅ condition inside effect
    fetchUser().then(setUser);
  }, [isLoggedIn]);
  return <div>{user?.name}</div>;
}

async function fetchUser() { return { name: 'Alice' }; }

/*
Q3 [BASIC]: What is the difference between controlled and uncontrolled components?
──────────────────────────────────────────────────────────────────────────────────
A: Controlled: React state is the single source of truth. Every input change updates
   state, and the input value is driven by state. React controls the value.

   Uncontrolled: DOM is the source of truth. You read the value via a ref when needed.
   Simpler for simple forms; harder to validate/transform on every keystroke.
*/
function ControlledForm() {
  const [email, setEmail] = useState('');
  return (
    <input
      value={email}                    // ← driven by React state (controlled)
      onChange={e => setEmail(e.target.value)}
    />
  );
}

function UncontrolledForm() {
  const inputRef = useRef(null);
  const handleSubmit = () => {
    console.log(inputRef.current.value);  // ← read from DOM directly (uncontrolled)
  };
  return (
    <>
      <input ref={inputRef} defaultValue="initial" />  {/* ← defaultValue, not value */}
      <button onClick={handleSubmit}>Submit</button>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// ██ SECTION 2: INTERMEDIATE
// ─────────────────────────────────────────────────────────

/*
Q4 [INTERMEDIATE]: When does React re-render, and how do you prevent unnecessary re-renders?
─────────────────────────────────────────────────────────────────────────────────────────────
A: React re-renders a component when:
   1. Its own state changes (setState)
   2. Its parent re-renders (even if props didn't change — by default!)
   3. A context it subscribes to changes
   4. Its ref is attached to a different element

   Prevention tools:
   - React.memo → skips re-render if props are shallowly equal
   - useMemo → memoize expensive computed values
   - useCallback → memoize callback references (avoids breaking React.memo on child)
   - useSyncExternalStore → subscribe to external stores efficiently
*/
const ExpensiveChild = memo(function ExpensiveChild({ value, onUpdate }) {
  console.log('ExpensiveChild rendered');
  return <div onClick={() => onUpdate(value + 1)}>{value}</div>;
});

function Parent() {
  const [count, setCount] = useState(0);
  const [other, setOther] = useState(0);

  // BAD: new function reference every render → ExpensiveChild re-renders even when count didn't change
  // const handleUpdate = (val) => setCount(val); // new ref every time

  // GOOD: stable reference
  const handleUpdate = useCallback((val) => setCount(val), []); // ← same ref between renders

  // BAD: new object every render → will still re-render even with memo
  // const config = { theme: 'dark' };

  // GOOD: memoized object
  const config = useMemo(() => ({ theme: 'dark' }), []);

  return (
    <>
      <button onClick={() => setOther(o => o + 1)}>Other: {other}</button>
      <ExpensiveChild value={count} onUpdate={handleUpdate} />
    </>
  );
}

/*
Q5 [INTERMEDIATE]: How does useEffect cleanup work and what are common mistakes?
─────────────────────────────────────────────────────────────────────────────────
A: The cleanup function runs:
   1. Before the NEXT effect execution (if deps changed)
   2. On component UNMOUNT

   React 18 StrictMode double-invokes effects (mount → cleanup → mount) in dev
   to catch missing cleanups.
*/
function WebSocketComponent({ roomId }) {
  useEffect(() => {
    const ws = new WebSocket(`wss://api.example.com/rooms/${roomId}`);

    ws.onmessage = (event) => {
      // handle message
    };

    // Cleanup: close socket when roomId changes OR component unmounts
    return () => {
      ws.close();             // ← without this: old socket stays open after roomId changes → leak
    };
  }, [roomId]);   // ← roomId is a dependency: re-subscribe when it changes

  return <div>Connected to room {roomId}</div>;
}

// Common mistakes:
function MistakesDemo() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;                  // ← flag to prevent state update after unmount

    fetch('/api/data')
      .then(r => r.json())
      .then(json => {
        if (!cancelled) setData(json);     // ← check before updating state
      });

    return () => { cancelled = true; };   // ← set flag on cleanup (component unmounts mid-fetch)
    // Better approach: AbortController
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      // poll data
    }, 1000);
    return () => clearInterval(id);        // ← always clear timers!
  }, []);
}

/*
Q6 [INTERMEDIATE]: Context API — when should you NOT use it for state?
──────────────────────────────────────────────────────────────────────
A: Context causes ALL consumers to re-render when the context VALUE changes,
   even if the consuming component doesn't use the changed part.
   Context is optimized for INFREQUENTLY changing data.

   Good for: theme, locale, auth user, feature flags
   Bad for: frequently changing state (e.g., mouse position, scroll position, form fields)
*/
const ThemeContext = createContext({ theme: 'light' });

// PROBLEM: every consumer re-renders when ANY part of the value changes
function BadProvider() {
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState(null);
  // ❌ Every time user changes, components only needing theme also re-render
  return (
    <ThemeContext.Provider value={{ theme, user, setTheme, setUser }}>
      {/* children */}
    </ThemeContext.Provider>
  );
}

// SOLUTION: Split contexts, or use useMemo on value
function GoodProvider() {
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState(null);

  const themeValue = useMemo(() => ({ theme, setTheme }), [theme]);
  const userValue  = useMemo(() => ({ user, setUser }),   [user]);
  // Split into separate contexts so each consumer only re-renders for what it actually uses

  return (
    <ThemeContext.Provider value={themeValue}>
      {/* <UserContext.Provider value={userValue}> */}
      {/* </UserContext.Provider> */}
    </ThemeContext.Provider>
  );
}

// For high-frequency updates: useZustand / Jotai / external stores via useSyncExternalStore

// ─────────────────────────────────────────────────────────
// ██ SECTION 3: ADVANCED
// ─────────────────────────────────────────────────────────

/*
Q7 [ADVANCED]: Explain React Fiber Architecture and Concurrent Mode.
─────────────────────────────────────────────────────────────────────
A: Before Fiber (React <16): reconciliation was synchronous and RECURSIVE.
   Once started, it couldn't be interrupted → long renders blocked the main thread
   → janky UI, no way to prioritize urgent updates.

   Fiber (React 16+): reconciliation is an ITERATIVE linked-list traversal.
   Each unit of work (fiber) is processed incrementally using the browser's
   requestIdleCallback concept (scheduler package).
   This enables:
   - Pausing work when higher priority work arrives (e.g., user input)
   - Resuming, aborting, and replaying units of work
   - Concurrent rendering: multiple "in-progress" trees simultaneously

   Concurrent Mode (React 18 opt-in via createRoot):
   Enables concurrent features: useTransition, useDeferredValue, Suspense for data.
*/
function SearchResults() {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  // useTransition marks state updates as non-urgent (interruptible)
  // React will start the transition update but can interrupt it if the user keeps typing

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);                      // urgent: update input immediately (not deferred)
    startTransition(() => {
      // setFilteredResults(filter(value)); // non-urgent: can be interrupted/aborted
    });
  };

  return (
    <div>
      <input value={query} onChange={handleChange} />
      {isPending && <div>Loading results...</div>}
    </div>
  );
}

/*
Q8 [ADVANCED]: How does React's Reconciliation (diffing) algorithm work?
───────────────────────────────────────────────────────────────────────────
A: React's diffing is O(n) using two heuristics:
   1. Different element types → tear down old tree, mount new one entirely
   2. Same element type → update props in place
   3. Same type + key → same instance (moved if position changed)

   The `key` prop is critical: it tells React that an element's identity is stable
   even if it moves in the list.
*/
function ListExample({ items }) {
  return (
    <ul>
      {items.map(item => (
        // BAD: key={index} → if list reorders, React re-uses wrong component instances
        // When item[0] is deleted, all items shift index → all re-mount/re-render
        // <li key={index}>{item.name}</li>

        // GOOD: stable unique ID from the data
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}

// Why index as key is actually OK: only for static lists that NEVER reorder/filter
// Why it's BAD: uncontrolled inputs retain state incorrectly after reorder

/*
Q9 [ADVANCED]: useSyncExternalStore — the correct pattern for subscribing to external stores.
──────────────────────────────────────────────────────────────────────────────────────────────
A: React 18 introduced useSyncExternalStore to safely subscribe to external mutable stores
   (Redux, Zustand, browser APIs like window.matchMedia, route).
   Prevents "tearing" — where concurrent mode could render different UI with different store values.
*/
// Simple store implementation subscribable with useSyncExternalStore:
function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  return {
    getState: () => state,
    setState: (update) => {
      state = update(state);
      listeners.forEach(fn => fn());       // notify all subscribers
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);   // return unsubscribe function
    },
  };
}

const counterStore = createStore({ count: 0 });

function CounterDisplay() {
  // React re-renders ONLY when getState() returns a different value
  const count = useSyncExternalStore(
    counterStore.subscribe,
    () => counterStore.getState().count,                // client snapshot
    () => 0,                                             // server snapshot (SSR)
  );
  return <div>Count: {count}</div>;
}

/*
Q10 [ADVANCED]: Server Components vs Client Components — deep dive into the execution model.
────────────────────────────────────────────────────────────────────────────────────────────
A: React Server Components (Next.js App Router, React 19) fundamentally change the execution model.

   Server Components:
   - Execute ONLY on the server (never sent to browser, zero bundle cost)
   - Can async/await directly (no useEffect, no state)
   - Can access server resources directly (DB, file system, ORM)
   - Props must be serializable (no functions, no class instances, no JSX callbacks)
   - Rendered to RSC Payload (not HTML strings — a JSON-like wire format)

   Client Components ('use client' directive):
   - Execute both on server (for SSR) AND in the browser
   - Can use hooks, event handlers, browser APIs
   - Add to JS bundle (to be hydrated)

   Composition rule:
   - SC can import and render CC
   - CC CANNOT import SC (would try to ship SC logic to browser)
   - But CC CAN receive SC as `children` (prop passing, not import)
*/
// async Server Component — fetches data directly, no useEffect, no loading state needed
// (This would be in a .tsx / .jsx Next.js file with no 'use client'):
async function ProductList() {
  // const products = await db.query('SELECT * FROM products'); // ← direct DB access
  const products = [{ id: 1, name: 'Test' }];
  return (
    <ul>
      {products.map(p => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}

// CC wrapping SC as children (the "donut" pattern):
// 'use client'
function InteractiveWrapper({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}>Toggle</button>
      {open && children}   {/* ← children is the SC (rendered on server), not executed in browser */}
    </div>
  );
}

/*
Q11 [ADVANCED]: How does React handle batching in React 18 vs React 17?
────────────────────────────────────────────────────────────────────────
A: React 17: batching only inside React event handlers (onClick, onChange, etc.)
   Multiple setState calls in setTimeout, fetch, native event listeners → each caused a separate render.

   React 18 (createRoot): AUTOMATIC BATCHING everywhere.
   All setState calls, regardless of where they are (async, native events, setTimeout) → batched.
*/
function BatchingDemo() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);

  async function handleClick() {
    // React 18: BOTH updates batched → ONE re-render
    // React 17: would have been TWO renders (inside async callback)
    const data = await fetch('/api').then(r => r.json());
    setA(data.a);
    setB(data.b);
  }

  // Opt out of batching when you NEED synchronous re-render:
  // import { flushSync } from 'react-dom';
  // flushSync(() => setA(1)); // immediate re-render — but expensive
  return <button onClick={handleClick}>A:{a} B:{b}</button>;
}

export { GoodComponent, ControlledForm, UncontrolledForm, Parent, SearchResults, CounterDisplay };

// ─────────────────────────────────────────────────────────
// ██ SECTION 4: WEBPACK (React Build Tooling)
// ─────────────────────────────────────────────────────────

/*
Q12 [BASIC]: What is Webpack and why does React need a bundler?
────────────────────────────────────────────────────────────────
A: Webpack is a static module bundler. It takes your source files (JSX, CSS, images)
   and their dependencies, and outputs optimised bundles the browser can load.

   React needs a bundler because:
   1. Browsers cannot understand JSX or TypeScript natively — must be transpiled
   2. node_modules imports don't work in browsers (no filesystem)
   3. Code splitting — only load JS the current page actually needs
   4. Asset optimisation — minify JS, tree-shake dead code, fingerprint filenames for CDN caching

   Core webpack concepts:
   Entry   → the starting module (default: src/index.js)
   Output  → where bundles are written (default: dist/)
   Loaders → transform non-JS files: babel-loader for JSX, css-loader for CSS
   Plugins → broader transformations: HtmlWebpackPlugin, MiniCssExtractPlugin
   Mode    → 'development' (fast, source maps) | 'production' (minify, tree-shake)
*/

// Minimal webpack.config.js for a React project:
/*
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';
  return {
    entry: './src/index.jsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProd ? '[name].[contenthash:8].js' : '[name].js', // contenthash busts CDN cache
      clean: true,
    },
    resolve: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: { presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'] },
          },
        },
        {
          test: /\.css$/,
          use: [
            isProd ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            'postcss-loader',
          ],
        },
        { test: /\.(png|jpg|svg)$/, type: 'asset/resource' },  // webpack 5 built-in asset modules
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({ template: './public/index.html' }),
      isProd && new MiniCssExtractPlugin({ filename: '[name].[contenthash:8].css' }),
    ].filter(Boolean),
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /node_modules/,
            name: 'vendors',
            chunks: 'all',   // vendors bundle cached separately — faster re-deploys
          },
        },
      },
    },
    devServer: {
      hot: true,               // HMR: update modules without full page reload
      historyApiFallback: true, // serve index.html for all routes (SPA routing)
    },
  };
};
*/

/*
Q13 [INTERMEDIATE]: How does webpack Tree Shaking work?
───────────────────────────────────────────────────────
A: Tree shaking eliminates DEAD CODE — exports that are imported nowhere.
   Requires: ES Modules (static imports), "sideEffects" hint in package.json, production mode.

   Why ESM only: CommonJS require() is dynamic (can be inside if/loops), so webpack
   cannot statically determine what's used. ESM import/export is statically analysable.

   package.json:
     "sideEffects": false          → all modules are pure, safe to remove unused exports
     "sideEffects": ["*.css"]      → CSS files run code on import so must be kept

   // GOOD: named import — 'throttle', 'cloneDeep' etc. are tree-shaken
   import { debounce } from 'lodash-es';

   // BAD: default import from CJS — entire 70KB lodash bundled
   import _ from 'lodash';
*/

/*
Q14 [INTERMEDIATE]: Explain webpack Code Splitting — static vs dynamic.
─────────────────────────────────────────────────────────────────────────
A: Code splitting breaks the bundle into chunks loaded on demand.
   Reduces initial JS parse/execute time dramatically for React SPAs.

   Types:
   1. SplitChunksPlugin (automatic): extract shared/vendor code into a separate chunk
   2. Dynamic import() (on-demand): load a module only when the user needs it
   3. React.lazy: React wrapper around dynamic import for component-level splitting
*/
import { lazy, Suspense } from 'react';

// React.lazy + dynamic import → route-level code splitting
// Each page becomes a SEPARATE webpack chunk — loaded only when the route is visited
const Dashboard  = lazy(() => import('./pages/Dashboard'));   // dashboard.[hash].js
const Settings   = lazy(() => import('./pages/Settings'));    // settings.[hash].js

// Prefetch hint — download chunk during browser idle time (for likely next navigation):
// const NextPage = lazy(() => import(/* webpackPrefetch: true */ './NextPage'));
// webpack emits: <link rel="prefetch" href="/next-page.chunk.js"> in the HTML

// Preload hint — download in parallel with current chunk (higher priority):
// import(/* webpackPreload: true */ './CriticalChunk');

/*
Q15 [ADVANCED]: What is webpack Module Federation and how does it enable micro-frontends?
──────────────────────────────────────────────────────────────────────────────────────────
A: Module Federation (webpack 5) lets SEPARATE webpack builds share modules at RUNTIME.
   Each app exposes and consumes modules from other deployed apps without rebuilding.
   Foundation of micro-frontend architecture.

   Host   → the shell app that consumes remotes
   Remote → an independently deployed app that exposes modules
   Shared → modules shared to avoid loading React twice (singleton requirement)
*/
/*
// webpack.config.js for a REMOTE app (Products micro-frontend):
new ModuleFederationPlugin({
  name: 'productsApp',
  filename: 'remoteEntry.js',                       // manifest loaded by host at runtime
  exposes: {
    './ProductList': './src/components/ProductList', // what this remote shares
  },
  shared: {
    react:       { singleton: true, requiredVersion: '^18.0.0' }, // ONE copy across all MFEs
    'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
  },
});

// webpack.config.js for the HOST (shell):
new ModuleFederationPlugin({
  name: 'shell',
  remotes: {
    productsApp: 'productsApp@https://products.mysite.com/remoteEntry.js',
    // at runtime, loads remoteEntry.js from the deployed Products app
  },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
});

// Consuming the remote in host — lazy-loaded at runtime:
const ProductList = lazy(() => import('productsApp/ProductList'));
// Products app can be deployed independently — host picks up the new version automatically
*/
