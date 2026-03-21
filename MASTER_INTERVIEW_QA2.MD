# Master Interview Q&A — Vol 2
> Deep-dive answers with ELI5, flowcharts, step-by-step code, and complexity analysis.

---

## REACT — Core Hooks

---

### Q1. What is the difference between `useState` and `useReducer`? When would you choose one over the other?

---

#### ELI5 (Explain Like I'm 5)

> **`useState`** is like a light switch — you flip it ON or OFF. Simple. One thing changes at a time.
>
> **`useReducer`** is like a TV remote — you press a *named button* (action), and the TV (state) changes in a predictable way based on what button you pressed. You have a rulebook (reducer) that says "if you press VOLUME_UP, do this; if you press MUTE, do that."

---

#### Flowchart — How Each Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                        useState Flow                                │
│                                                                     │
│   Component                                                         │
│      │                                                              │
│      ▼                                                              │
│  [useState(initialValue)]                                           │
│      │                                                              │
│      ├── returns: [value, setValue]                                 │
│      │                                                              │
│      ▼                                                              │
│  User event → setValue(newValue)                                    │
│      │                                                              │
│      ▼                                                              │
│  React schedules re-render with new value                           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       useReducer Flow                               │
│                                                                     │
│   Component                                                         │
│      │                                                              │
│      ▼                                                              │
│  [useReducer(reducerFn, initialState)]                              │
│      │                                                              │
│      ├── returns: [state, dispatch]                                 │
│      │                                                              │
│      ▼                                                              │
│  User event → dispatch({ type: 'ACTION', payload })                 │
│      │                                                              │
│      ▼                                                              │
│  reducerFn(currentState, action) → newState                         │
│      │                                                              │
│      ▼                                                              │
│  React re-renders with newState                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### When to Use Which

```
Decision Tree:
                     ┌──────────────────────┐
                     │  How complex is your  │
                     │       state?          │
                     └──────────┬───────────┘
                                │
              ┌─────────────────┼──────────────────┐
              ▼                 ▼                  ▼
     1-2 simple values   Multiple fields     Multiple fields
     (toggle, count,     tightly coupled    + complex logic
      input string)       (form with 5+     + multiple actions
                          fields)           + transitions between
                                             states
              │                 │                  │
              ▼                 ▼                  ▼
         useState          useState or         useReducer
                            useReducer         (strongly prefer)
```

---

#### Code — `useState` Example (simple counter)

```jsx
import { useState } from 'react';

function Counter() {
  // WHY useState: we have ONE piece of state — the count. Simple.
  const [count, setCount] = useState(0);
  //    └─ current value    └─ updater fn    └─ initial value

  return (
    <div>
      <p>{count}</p>
      {/* WHY direct call: no derived logic, just "set to count + 1" */}
      <button onClick={() => setCount(count + 1)}>+</button>
      <button onClick={() => setCount(count - 1)}>-</button>
    </div>
  );
}
```

**Step-by-step:**
1. `useState(0)` — React creates a state cell in memory holding `0`
2. Each render, React reads that same cell and gives you the current value
3. `setCount(count + 1)` — schedules a re-render with value `count + 1`
4. React re-executes the component function, `count` is now `1`

---

#### Code — `useReducer` Example (shopping cart with multiple actions)

```jsx
import { useReducer } from 'react';

// WHY a separate reducer: all state transitions are co-located.
// If state logic lives inside the component, it becomes a mess.
// Reducer = pure function: (currentState, action) → newState
// "Pure" means: no side effects, same input always gives same output.

const cartReducer = (state, action) => {
  switch (action.type) {
    
    case 'ADD_ITEM':
      // WHY spread (...state): we never mutate state directly in React.
      // React uses reference equality to detect changes.
      // If we mutate the existing object, React may not notice the change.
      return {
        ...state,
        items: [...state.items, action.payload],  // new array, new reference
        total: state.total + action.payload.price,
      };

    case 'REMOVE_ITEM':
      // WHY filter: creates a new array (new reference = React detects change)
      const removed = state.items.find(i => i.id === action.payload);
      return {
        ...state,
        items: state.items.filter(i => i.id !== action.payload),
        total: state.total - (removed?.price ?? 0),
      };

    case 'CLEAR_CART':
      // WHY return full object: reducer always returns the FULL state shape
      return { items: [], total: 0 };

    default:
      // WHY return state: unknown actions should be no-ops, not crashes
      return state;
  }
};

// WHY outside component: if defined inside, it gets re-created every render
// and useReducer would see a "new" reducer function reference each time
const initialState = { items: [], total: 0 };

function ShoppingCart() {
  // WHY useReducer: we have 3 different actions that each modify state
  // differently. With useState we'd need 3 setters and duplicate logic.
  const [cart, dispatch] = useReducer(cartReducer, initialState);
  //    └─ state object    └─ dispatch fn   └─ reducer  └─ initial

  const addItem = (item) => {
    // WHY dispatch with type + payload:
    // type = WHAT happened (action name)
    // payload = the data needed to perform the action
    dispatch({ type: 'ADD_ITEM', payload: item });
  };

  return (
    <div>
      <p>Items: {cart.items.length} | Total: ${cart.total}</p>
      <button onClick={() => addItem({ id: 1, name: 'Book', price: 12 })}>
        Add Book
      </button>
      <button onClick={() => dispatch({ type: 'CLEAR_CART' })}>
        Clear
      </button>
    </div>
  );
}
```

**Step-by-step:**
1. `useReducer(cartReducer, initialState)` — React stores `{ items: [], total: 0 }` in memory
2. `dispatch({ type: 'ADD_ITEM', payload: item })` — React calls `cartReducer(currentState, action)`
3. The reducer computes and returns the next state (new object reference)
4. React sees the new reference → schedules re-render → component re-executes with new `cart`

---

#### Key Differences at a Glance

| Feature | `useState` | `useReducer` |
|---|---|---|
| Best for | 1–2 independent values | Complex / related state |
| How you update | Call setter directly | Dispatch a named action |
| Logic lives | Inline in component | In pure reducer function |
| Testability | Component-level | Reducer is pure — easily unit-tested without React |
| Predictability | Fine for simple cases | Better for multi-step transitions |
| State shape | Single value / object | Any shape, usually object |

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|---|---|---|
| `useState` read | O(1) | Direct cell lookup in React's fiber |
| `setState` call | O(1) | Enqueues update, no heavy computation |
| `useReducer` dispatch | O(1) amortized | Calls reducer synchronously, then schedules re-render |
| Reducer function | Depends on your code | If you `.filter()` N items → O(N); `.find()` → O(N) |
| Memory per state | O(size of state) | React holds current + pending state in fiber node |

---

### Q2. What happens if you don't pass a dependency array to `useEffect`?

---

#### ELI5

> `useEffect` is like a helper who watches for changes and does a job.
>
> - **No array** → the helper re-does the job *after every single render*, no matter what changed. He's very eager.
> - **Empty array `[]`** → the helper does the job *once* when you first walk in the room, then sits down forever.
> - **Array with values `[a, b]`** → the helper only re-does the job when `a` or `b` specifically changes. Smart and efficient.

---

#### Flowchart — All 3 Variants

```
┌─────────────────────────────────────────────────────────────────────┐
│              useEffect Dependency Array Behavior                    │
│                                                                     │
│  useEffect(() => { ... })          ← No array                       │
│      │                                                              │
│      └── Runs after EVERY render (mount, update, anything)          │
│                                                                     │
│  useEffect(() => { ... }, [])      ← Empty array                    │
│      │                                                              │
│      └── Runs ONCE after initial mount only                         │
│                                                                     │
│  useEffect(() => { ... }, [a, b])  ← With dependencies              │
│      │                                                              │
│      └── Runs after mount + whenever a or b changes                 │
│          (React uses Object.is() to compare prev vs next value)     │
└─────────────────────────────────────────────────────────────────────┘

Timeline for useEffect(() => { ... }) — NO ARRAY:

  Mount       Update(1)   Update(2)   Update(3)
    │             │           │           │
    ▼             ▼           ▼           ▼
  Effect ✅    Effect ✅   Effect ✅   Effect ✅
  runs here   runs here   runs here   runs here
  
  ⚠ Cleanup from previous run fires BEFORE next effect runs
```

---

#### Code — Demonstrating All 3 Cases

```jsx
import { useState, useEffect } from 'react';

function Demo() {
  const [count, setCount] = useState(0);
  const [name, setName]   = useState('Alice');

  // ─── CASE 1: No dependency array ───────────────────────────────
  // WHY you'd accidentally write this: you forget the second arg.
  // WHAT happens: runs after EVERY render — even if count didn't change.
  // DANGER: if this effect calls setCount, it causes an INFINITE LOOP.
  //         effect runs → state changes → re-render → effect runs → ∞
  useEffect(() => {
    console.log('Runs after every render');
    // ❌ NEVER do: setCount(c => c + 1)  ← infinite loop!
  });

  // ─── CASE 2: Empty array ────────────────────────────────────────
  // WHY use []: you want one-time setup (fetch initial data, set up socket).
  // WHAT happens: runs once after the component first mounts.
  // Think of it as: componentDidMount in class components.
  useEffect(() => {
    console.log('Runs only once — on mount');
    // Good for: fetch initial data, subscribe to external store, set up timers
    return () => {
      // WHY cleanup: runs when component unmounts.
      // Without cleanup: subscriptions/timers persist after component is gone → memory leak
      console.log('Cleanup on unmount');
    };
  }, []); // ← empty array = "I depend on nothing, never re-run"

  // ─── CASE 3: Specific dependencies ─────────────────────────────
  // WHY list deps explicitly: React only re-runs if `count` actually changed.
  // The ESLint rule `exhaustive-deps` will warn if you miss any dep.
  useEffect(() => {
    console.log(`count changed to: ${count}`);
    // React compares previous count vs current count using Object.is()
    // Object.is(1, 1) = true → skip   |   Object.is(1, 2) = false → run
  }, [count]); // ← only re-run when count changes; name changes are ignored

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <button onClick={() => setName('Bob')}>Change Name</button>
    </div>
  );
}
```

**Step-by-step (Case 3 `[count]`):**
1. Component mounts → effect runs once (initial run always happens)
2. `setCount` fires → React re-renders → React compares `prevCount` vs `newCount`
3. `Object.is(0, 1)` = `false` → count changed → React runs the effect again
4. `setName('Bob')` fires → React compares `prevCount` vs `newCount` = same → **skips** effect

---

#### Common Mistakes

```
Mistake 1: Object/Array in deps creates infinite loop
─────────────────────────────────────────────────────
  const options = { limit: 10 };           // ← new object reference every render
  useEffect(() => { fetch(options) }, [options]);
  // Object.is({limit:10}, {limit:10}) = false (different references!)
  // → runs on every render → INFINITE LOOP
  
  FIX: useMemo or move `options` outside the component or use primitives

Mistake 2: Missing dependency (stale closure — see Q6)
─────────────────────────────────────────────────────
  useEffect(() => {
    console.log(count);  // reads count
  }, []);                // but count NOT listed → reads stale value from mount
```

---

#### Time & Space Complexity

| Scenario | Complexity | Why |
|---|---|---|
| React comparing deps | O(N) where N = number of deps | Loops through each dep, `Object.is()` per item |
| Without array | O(renders) total | Runs effect on every render |
| With `[]` | O(1) | Runs exactly once |
| With `[a, b, c]` | O(changes to a/b/c) | Runs only when one of those changes |

---

### Q3. How do you handle race conditions in `useEffect` when fetching data?

---

#### ELI5

> Imagine you order 2 pizzas at different times. Pizza #2 gets delivered FIRST by accident (faster driver). Then pizza #1 arrives and you display it — but you actually wanted pizza #2 (the latest order)!
>
> A race condition is when an **older async request resolves AFTER a newer one**, and you accidentally display stale data. The fix is: **when a newer request starts, cancel or ignore all previous ones.**

---

#### Flowchart — The Problem vs The Fix

```
THE PROBLEM (no cleanup):
─────────────────────────
  User types "re"               User types "react"
       │                               │
       ▼                               ▼
  fetch("/search?q=re")        fetch("/search?q=react")
       │                               │
       │                      responds in 100ms ✅
       │                               │
       │                        setResults("react results")
       │                               │
  responds in 500ms ❌            [correct data shown]
       │
  setResults("re results")   ← OVERWRITES correct data! 💥
       │
  [stale/wrong data shown]

THE FIX (cleanup with ignore flag):
────────────────────────────────────
  User types "react"
       │
       ▼
  useEffect runs
       │
       ├── let ignore = false        ← flag starts as "don't ignore"
       │
       ▼
  fetch("/search?q=react")
       │
  [user types "reactjs" → new effect runs]
       │
       └── cleanup of previous effect: ignore = true  ← flag flipped!
       │
  [previous fetch resolves]
       │
  if (!ignore) setResults(...)   ← ignored! flag is true
       │
  ✅ Only latest fetch's result is used
```

---

#### Code — Race Condition Problem

```jsx
// ❌ BAD: race condition possible
function SearchBad() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    // WHY this is dangerous:
    // If query changes quickly (user typing fast), multiple fetches can be
    // in-flight simultaneously. The LAST to RESOLVE wins, not last to START.
    fetch(`/api/search?q=${query}`)
      .then(res => res.json())
      .then(data => setResults(data)); // ← could be an OLD response!
  }, [query]);
}
```

---

#### Code — Fix 1: Ignore Flag (Simplest, Recommended)

```jsx
// ✅ GOOD: ignore flag pattern
function SearchGood() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // WHY this variable: it's a "flag" scoped to THIS specific effect run.
    // Each time the effect re-runs (query changes), a fresh `ignore = false` is created.
    let ignore = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res  = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        // WHY encodeURIComponent: prevents injection of special chars into URL
        const data = await res.json();

        // WHY this check: if `ignore` was flipped to true (cleanup ran),
        // this effect is "stale" — a newer effect already started.
        // We skip setting state to avoid overwriting fresher data.
        if (!ignore) {
          setResults(data);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          // WHY same guard here: error handling for stale effects should also be ignored
          console.error(err);
          setLoading(false);
        }
      }
    };

    if (query) fetchData();

    // WHY return a cleanup function:
    // React calls this cleanup when:
    //   1. `query` changes (before re-running the effect)
    //   2. Component unmounts
    // Flipping `ignore = true` tells any pending async work to stand down.
    return () => {
      ignore = true;
    };
  }, [query]); // ← re-run only when query changes

  return (
    <ul>{results.map(r => <li key={r.id}>{r.name}</li>)}</ul>
  );
}
```

**Step-by-step:**
1. User types `"re"` → effect runs, `ignore = false`, fetch starts
2. User types `"react"` → React calls cleanup of previous effect → `ignore = true` for `"re"` fetch
3. New effect runs for `"react"`, its own `ignore = false`, its own fetch starts
4. `"re"` fetch eventually resolves → checks `if (!ignore)` → `ignore` is `true` → **state NOT set**
5. `"react"` fetch resolves → checks `if (!ignore)` → `ignore` is `false` → **state IS set** ✅

---

#### Code — Fix 2: AbortController (Cancels the Network Request Itself)

```jsx
// ✅ BETTER for large responses: actually cancels the HTTP request
function SearchAbort() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    // WHY AbortController: instead of just ignoring the response,
    // we cancel the actual in-flight HTTP request — saves bandwidth!
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,  // ← link fetch to this controller
        });
        const data = await res.json();
        setResults(data);
      } catch (err) {
        // WHY check AbortError: when we abort, fetch throws an error.
        // We only want to log REAL errors, not intentional aborts.
        if (err.name !== 'AbortError') {
          console.error('Fetch failed:', err);
        }
      }
    };

    if (query) fetchData();

    return () => {
      // WHY abort in cleanup: when query changes, this runs BEFORE the
      // next effect. It cancels the in-flight request immediately.
      controller.abort();
    };
  }, [query]);

  return <ul>{results.map(r => <li key={r.id}>{r.name}</li>)}</ul>;
}
```

---

#### Comparison: Ignore Flag vs AbortController

```
                  ignore flag          AbortController
                  ──────────────       ────────────────
Network request   Still completes      Cancelled (saves bandwidth)
Complexity        Simple               Slightly more (catch AbortError)
Browser support   Universal            All modern browsers
Best for          Small payloads       Large payloads, file downloads
```

---

#### Time & Space Complexity

| Aspect | Complexity | Why |
|---|---|---|
| Ignore flag check | O(1) | Boolean check per async resolution |
| Cleanup execution | O(1) | Just flips a boolean / calls abort() |
| In-flight requests | O(N) calls simultaneously | N = how fast user triggers re-renders before any resolve |
| Memory per effect | O(1) | Just 1 boolean or 1 AbortController ref per effect run |

---

### Q4. What is the difference between `useRef` for DOM access vs storing mutable values?

---

#### ELI5

> `useRef` gives you a **special box** (`{ current: ... }`) that React never loses between renders.
>
> - **DOM access:** You hand the box to a `<div ref={myRef}>` and React fills it in with the real HTML element — so you can call `.focus()`, `.scrollIntoView()`, measure size, etc.
>
> - **Mutable value storage:** You use it like a notebook that survives between renders but writing in it does **NOT** cause a re-render. Unlike state, React doesn't watch this notebook. Great for timers, interval IDs, previous values, and flags.

---

#### Flowchart — Two Use Cases

```
┌──────────────────────────────────────────────────────────────────────┐
│                   useRef: Two Distinct Jobs                          │
│                                                                      │
│  ┌─────────────────────────┐    ┌──────────────────────────────────┐ │
│  │  USE CASE 1: DOM Access  │    │  USE CASE 2: Mutable Storage     │ │
│  │                          │    │                                  │ │
│  │  const ref = useRef(null)│    │  const timerRef = useRef(null)   │ │
│  │  <input ref={ref} />     │    │                                  │ │
│  │                          │    │  timerRef.current = setInterval()│ │
│  │  After mount:            │    │                                  │ │
│  │  ref.current = <input>   │    │  clearInterval(timerRef.current) │ │
│  │  (the real DOM node)     │    │                                  │ │
│  │                          │    │  ✅ Persists across renders       │ │
│  │  ref.current.focus() ✅ │    │  ✅ Change does NOT re-render    │ │
│  │  ref.current.value   ✅ │    │  ✅ Not tracked by React         │ │
│  └─────────────────────────┘    └──────────────────────────────────┘ │
│                                                                      │
│  Both share: { current: ... } object that React preserves forever   │
│  Both differ from state: updating .current never triggers re-render  │
└──────────────────────────────────────────────────────────────────────┘

Comparison:
                    useState        useRef
                    ─────────       ──────────
  Re-renders on     YES ✅          NO ❌
  change?
  Persists across   YES ✅          YES ✅
  renders?
  Accessible via    value           ref.current
  Typical use       UI state        DOM / timers / flags / prev-values
```

---

#### Code — Use Case 1: DOM Access

```jsx
import { useRef, useEffect } from 'react';

function AutoFocusInput() {
  // WHY useRef(null): null is the safe initial value because
  // the DOM element doesn't exist yet when this line first runs.
  // React will fill `.current` once the DOM is mounted.
  const inputRef = useRef(null);

  useEffect(() => {
    // WHY inside useEffect: DOM is only available AFTER mount.
    // If we tried ref.current.focus() during render, `.current` is still null.
    inputRef.current.focus();
    //               └── .focus() is a native DOM method, not React
  }, []); // ← [] = run once on mount, exactly when DOM is ready

  return <input ref={inputRef} placeholder="I auto-focus!" />;
}

// ─── Real Use: Uncontrolled Input (read value without re-rendering) ─────
function UncontrolledForm() {
  // WHY uncontrolled: we don't need React to re-render on every keystroke.
  // We only need the value at submit time. useRef is perfect for this.
  const usernameRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    // WHY .value: inputRef.current is the DOM <input> element,
    // and .value is the native property holding the current text.
    console.log('Submitted:', usernameRef.current.value);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input ref={usernameRef} type="text" />
      <button type="submit">Submit</button>
    </form>
  );
}
```

**Step-by-step (AutoFocusInput):**
1. `useRef(null)` → React creates `{ current: null }` and stores it in fiber
2. React renders `<input>` to the DOM
3. React sees `ref={inputRef}` → sets `inputRef.current = <the real input DOM node>`
4. `useEffect` fires → `inputRef.current` is now the real `<input>` → `.focus()` works ✅
5. On next re-renders: `inputRef.current` always points to that same DOM node (stable reference)

---

#### Code — Use Case 2: Storing Mutable Values (Interval Timer)

```jsx
import { useState, useRef, useEffect } from 'react';

function StopWatch() {
  const [seconds, setSeconds]  = useState(0);
  const [running, setRunning]  = useState(false);

  // WHY useRef for intervalId (not useState):
  // We don't NEED React to re-render when the interval ID changes.
  // The interval ID is implementation detail — it's just a number we
  // need to pass to clearInterval() later. Storing in state would
  // cause a useless re-render every time we start/stop.
  const intervalRef = useRef(null);

  const start = () => {
    if (running) return; // guard: don't create 2 intervals
    setRunning(true);

    // WHY store return value of setInterval in .current:
    // setInterval returns a numeric ID we MUST keep to cancel it later.
    // ref.current is the perfect place: persistent, mutable, no re-render.
    intervalRef.current = setInterval(() => {
      setSeconds(s => s + 1); // ← functional update: safe even inside setInterval
      // WHY functional form `s => s + 1` instead of `seconds + 1`:
      // setInterval captures `seconds` at creation time (stale closure).
      // Functional form always receives the LATEST state value from React.
    }, 1000);
  };

  const stop = () => {
    setRunning(false);
    // WHY clearInterval here: we MUST cancel the interval or it keeps
    // firing forever even after component unmounts → memory leak!
    clearInterval(intervalRef.current);
    intervalRef.current = null; // ← clean up, prevents double-clear bugs
  };

  // WHY this cleanup useEffect: if the component unmounts while running,
  // we still need to clear the interval to avoid memory leaks.
  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div>
      <p>{seconds}s</p>
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
    </div>
  );
}
```

---

#### Code — Use Case 2b: Tracking Previous Value

```jsx
import { useEffect, useRef } from 'react';

// WHY this pattern: sometimes you need to compare current vs previous value
// (e.g., animate only when value increases, not on first render).
function usePreviousValue(value) {
  // WHY useRef(undefined): starts as undefined, only updates AFTER current render
  const prevRef = useRef();

  useEffect(() => {
    // WHY inside useEffect: this runs AFTER render.
    // So during THIS render, prevRef.current still holds the PREVIOUS value.
    // Perfect for comparison inside the component body.
    prevRef.current = value;
  });
  // WHY no dep array: runs after every render — always tracks the last value

  return prevRef.current; // returns value from the PREVIOUS render
}

function PriceTracker({ price }) {
  const prevPrice = usePreviousValue(price);
  // During render: prevPrice = previous render's price, price = current price
  const direction = price > prevPrice ? '↑' : price < prevPrice ? '↓' : '–';
  return <p>{price} {direction}</p>;
}
```

---

#### Key Gotchas

```
Gotcha 1: Reading ref.current during render is unsafe
──────────────────────────────────────────────────────
  During rendering, ref.current may not yet be set (or may be stale).
  Always read ref.current inside useEffect or event handlers, not render body.

Gotcha 2: Changing ref.current does NOT trigger re-render
──────────────────────────────────────────────────────────
  This is by design. If you need the UI to update, use useState instead.
  Ref = "invisible to React's update system".

Gotcha 3: Don't use refs as a workaround for missing dependencies
──────────────────────────────────────────────────────────────────
  const countRef = useRef(count);
  useEffect(() => { ... countRef.current ... }, []); // ← anti-pattern
  This hides a stale-closure bug. Better to list the dep correctly.
```

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|---|---|---|
| `useRef()` creation | O(1) | Allocates a tiny `{ current }` object once |
| Reading `ref.current` | O(1) | Direct property access |
| Writing `ref.current` | O(1) | Direct property mutation, no React overhead |
| DOM operations via ref | Depends on DOM operation | `.focus()` = O(1), layout reads = browser cost |

---

### Q5. Why does `useContext` cause performance issues and how do you fix it?

---

#### ELI5

> Imagine a school announcement system. A teacher makes **one** announcement to the whole school — and **every single student** stops what they are doing and listens, even if the message was only meant for Grade 5.
>
> `useContext` works the same way. When the context value changes, **every component that calls `useContext(MyContext)`** re-renders — even if the specific data it cares about didn't change. This is the performance problem.

---

#### Flowchart — The Problem

```
Context value: { user: { name }, theme }
                        │
           ┌────────────┴──────────────┐
           │                           │
    ThemeButton                   UserProfile
    useContext(AppCtx)            useContext(AppCtx)
    reads: theme                  reads: user.name
           │                           │
           │  user.name changes        │
           │  (theme unchanged)        │
           ▼                           ▼
    RE-RENDERS ❌                 RE-RENDERS ✅
    (doesn't care about           (actually needed)
     user.name but re-renders
     anyway!)

WHY: Context compares values with Object.is().
     If the provider re-renders with a new object reference,
     ALL consumers re-render regardless of which field changed.
```

---

#### Code — The Problem in Action

```jsx
import { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);

function AppProvider({ children }) {
  const [user, setUser]   = useState({ name: 'Alice' });
  const [theme, setTheme] = useState('dark');

  // ❌ WHY this causes over-rendering:
  // Every render of AppProvider creates a NEW object `{ user, theme, setUser, setTheme }`.
  // Object.is(newObj, oldObj) = false (different references) → ALL consumers re-render.
  return (
    <AppContext.Provider value={{ user, theme, setUser, setTheme }}>
      {children}
    </AppContext.Provider>
  );
}

// This component only cares about `theme`, but will ALSO re-render when `user` changes!
function ThemeButton() {
  const { theme } = useContext(AppContext); // ← reads ALL of AppContext
  console.log('ThemeButton rendered'); // fires even when user.name changes
  return <button style={{ background: theme === 'dark' ? '#333' : '#fff' }}>Click</button>;
}
```

---

#### Fix 1: Split Contexts (Best Solution)

```jsx
// WHY split: each context only notifies its own consumers.
// theme change → only ThemeButton re-renders.
// user change  → only UserProfile re-renders.

const UserContext  = createContext(null);
const ThemeContext = createContext(null);

function AppProvider({ children }) {
  const [user, setUser]   = useState({ name: 'Alice' });
  const [theme, setTheme] = useState('dark');

  return (
    // WHY nest providers: each provides its own isolated value.
    // React evaluates them independently.
    <UserContext.Provider value={{ user, setUser }}>
      <ThemeContext.Provider value={{ theme, setTheme }}>
        {children}
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}

// ✅ Now ThemeButton ONLY re-renders when theme changes
function ThemeButton() {
  const { theme } = useContext(ThemeContext); // ← scoped to theme only
  return <button>Theme: {theme}</button>;
}

// ✅ UserProfile ONLY re-renders when user changes
function UserProfile() {
  const { user } = useContext(UserContext);   // ← scoped to user only
  return <p>{user.name}</p>;
}
```

---

#### Fix 2: `useMemo` on Context Value (When You Can't Split)

```jsx
import { createContext, useContext, useState, useMemo } from 'react';

const AppContext = createContext(null);

function AppProvider({ children }) {
  const [user, setUser]   = useState({ name: 'Alice' });
  const [theme, setTheme] = useState('dark');

  // WHY useMemo here: memoize the context value object.
  // The object reference only changes when user OR theme actually changes.
  // If AppProvider re-renders for some OTHER reason, consumers won't re-render.
  // WARNING: this does NOT prevent re-renders when user or theme changes —
  //           it only prevents re-renders caused by unrelated parent re-renders.
  const value = useMemo(
    () => ({ user, theme, setUser, setTheme }),
    [user, theme]  // ← only create new object when these change
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
```

---

#### Fix 3: `React.memo` on Consumer Components

```jsx
import { memo, useContext } from 'react';

// WHY memo: even if context re-renders the parent tree,
// memo prevents re-render if the component's OWN props haven't changed.
// But note: useContext bypass memo — if the context value changes, memo can't stop it.
// Memo + split context together is the gold standard.
const ThemeButton = memo(function ThemeButton() {
  const { theme } = useContext(ThemeContext);
  return <button>Theme: {theme}</button>;
});
```

---

#### Fix 4: Use a State Management Library (Zustand / Jotai)

```jsx
// WHY Zustand: its subscriptions are selector-based.
// Components only re-render when the SPECIFIC slice they subscribed to changes.
import { create } from 'zustand';

const useStore = create((set) => ({
  user:     { name: 'Alice' },
  theme:    'dark',
  setTheme: (t) => set({ theme: t }),
}));

// ✅ Only re-renders when `theme` changes — user changes are ignored
function ThemeButton() {
  const theme = useStore(state => state.theme); // ← selector = precise subscription
  return <button>Theme: {theme}</button>;
}
```

---

#### Decision Flowchart — Which Fix to Use?

```
Context causing perf issues?
         │
         ▼
Is the context mixing unrelated data?   ──YES──►  Split into separate contexts
         │
        NO
         │
         ▼
Is the parent re-rendering unnecessarily? ──YES──► useMemo on context value
         │
        NO
         │
         ▼
Is the state complex with many slices? ──YES──► Migrate to Zustand / Jotai
         │
        NO
         │
         ▼
Wrap consumers in React.memo as a targeted fix
```

---

#### Time & Space Complexity

| Scenario | Complexity | Why |
|---|---|---|
| Context value comparison | O(1) | `Object.is()` — reference equality check |
| Notifying consumers on change | O(N) | N = number of components subscribed to that context |
| `useMemo` on context value | O(D) | D = number of deps compared (usually 1-2) |
| Split context approach | O(N/K) per context | N consumers split across K contexts |
| Zustand selector subscription | O(1) per component | Uses pub/sub with per-selector equality checks |

---

### Q6. What is stale closure in React hooks? Give a real example.

---

#### ELI5

> Imagine you take a **photograph** of a whiteboard that says "score = 0". You put the photo in your pocket.
>
> Later, someone updates the whiteboard to say "score = 5". But when you look at your **photo**, it still says "score = 0". Your photo is **stale** — it captured the value at a specific moment and never updated.
>
> A stale closure is a function that **captured** a variable from an outer scope at creation time, and now that variable has changed — but the function is still using the **old** captured value, not the new one.

---

#### Flowchart — How Stale Closures form

```
Render 1:
─────────
  count = 0
  const handleClick = () => console.log(count); // ← closes over count=0
  setTimeout(handleClick, 3000); // ← schedules the RENDER-1 version

Render 2 (count changes to 5):
───────────────────────────────
  count = 5                            ← React re-renders, new count=5
  const handleClick = () => console.log(count); // ← NEW closure, count=5
  // but the OLD setTimeout still has the RENDER-1 handleClick!

3 seconds later:
─────────────────
  Render-1's handleClick fires → logs 0 ← STALE! Not 5!

WHY: The old setTimeout callback holds a reference to the OLD closure.
     JavaScript doesn't update captured variables retroactively.
```

---

#### Code — Classic Stale Closure Bug

```jsx
import { useState, useEffect } from 'react';

function BuggyCounter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // WHY this is buggy: this effect runs ONCE (empty []).
    // The closure captures `count = 0` at mount time.
    // Even as count increases, this interval always sees count=0.
    const intervalId = setInterval(() => {
      console.log('Current count:', count); // ← ALWAYS logs 0! Stale closure!
      // If we tried: setCount(count + 1), it would ALWAYS set to 0+1=1
      // because `count` is forever 0 in this closure.
    }, 1000);

    return () => clearInterval(intervalId);
  }, []); // ← empty dep array = closure captures initial values only

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
}
```

---

#### Code — Fix 1: Add the Dependency (Correct Deps Array)

```jsx
function FixedByDeps() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      // WHY this now works: each time count changes, the OLD effect cleans up,
      // a NEW effect runs, and the new closure captures the LATEST count.
      console.log('Current count:', count); // ← always fresh!
    }, 1000);

    return () => clearInterval(intervalId); // ← cleans up old interval
  }, [count]); // ← NOW count is in deps; effect re-runs when count changes

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
  // Trade-off: interval restarts on every count change.
  // For an interval that must NEVER restart, use the ref approach below.
}
```

---

#### Code — Fix 2: Functional Updater (For setState)

```jsx
// WHY functional updater: React passes the LATEST state value as argument.
// This bypasses the closure entirely — you don't NEED to read `count`.
function FixedByFunctionalUpdate() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      // ✅ `c` is ALWAYS the latest count — React provides it fresh every call
      // We never "capture" count; we let React hand it to us at call time.
      setCount(c => c + 1); // ← works correctly even with [] deps!
    }, 1000);

    return () => clearInterval(intervalId);
  }, []); // ← safe with empty deps because we don't READ count

  return <p>{count}</p>;
}
```

---

#### Code — Fix 3: useRef to Hold Latest Value (General Pattern)

```jsx
import { useState, useEffect, useRef } from 'react';

// WHY this pattern: when you need to READ a value inside a long-lived
// callback (setTimeout, socket listener, etc.) AND keep the callback stable.
function FixedByRef() {
  const [count, setCount] = useState(0);

  // WHY useRef: ref.current is NOT captured at closure time.
  // It's a mutable object; reading ref.current always gives the current value.
  const countRef = useRef(count);

  // WHY this effect: keeps the ref in sync with state on every render.
  // This runs after every render, so countRef.current is always fresh.
  useEffect(() => {
    countRef.current = count;
  });

  useEffect(() => {
    const intervalId = setInterval(() => {
      // ✅ Reading .current = always the LATEST value, no stale closure!
      // The ref object reference is stable; only .current changes.
      console.log('Current count:', countRef.current);
    }, 1000);

    return () => clearInterval(intervalId);
  }, []); // ← safe: we read countRef.current, not count

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
}
```

**Step-by-step (Fix 3):**
1. Mount: `countRef.current = 0`, interval created, closure captures `countRef` object (stable reference)
2. User clicks: `count → 1`, component re-renders
3. Sync effect fires: `countRef.current = 1` (ref updated to latest)
4. Interval fires: reads `countRef.current` → gets `1` ✅ — no stale value!

---

#### Real Production Example — Event Listener + Stale Closure

```jsx
// Real stale closure bug: "why does my modal close at the wrong count?"
function Modal({ onClose }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // BUG: count is captured from the render when this effect ran.
        // If count changes, this handler still sees the OLD count.
        console.log('Closing at count:', count); // might be stale!
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // ← only runs once; count is stale after first render!
  
  // FIX: add count to deps, OR use a ref, OR use useCallback with deps
}
```

---

#### Time & Space Complexity

| Aspect | Complexity | Why |
|---|---|---|
| Closure creation | O(1) | JS engine captures variable references at function creation |
| Ref-based stale fix | O(1) per read | Direct `.current` property access |
| Dep-array fix | O(D) per re-run check | D = number of deps compared by React |
| Memory per stale closure | O(variables captured) | Each closure in memory retains refs to all captured vars |

---

### Q7. How does React 18 batch state updates differently from React 17?

---

#### ELI5

> **Batching** = React waits until you finish all your "set state" calls at once, then does a SINGLE re-render instead of many.
>
> **React 17:** The waiter only groups your orders if you're sitting at the restaurant table (inside React event handlers). If you phone in, walk up to the counter, or send a carrier pigeon (setTimeout, Promises, native events), he processes each order one at a time.
>
> **React 18:** The waiter **always** batches every order together, no matter HOW it arrives — table, phone, carrier pigeon, all of it. This is called **Automatic Batching**.

---

#### Flowchart — React 17 vs React 18

```
REACT 17 — Manual Batching:
─────────────────────────────────────────────────────────┐
  Inside React event handler (onClick, onChange...):      │
    setA(1)   ─┐                                          │
    setB(2)   ─┤── batched ✅  → 1 re-render              │
    setC(3)   ─┘                                          │
                                                          │
  Inside setTimeout / Promise / native event:             │
    setA(1) → re-render #1 ❌                             │
    setB(2) → re-render #2 ❌   3 separate re-renders!    │
    setC(3) → re-render #3 ❌                             │
────────────────────────────────────────────────────────--┘

REACT 18 — Automatic Batching:
──────────────────────────────────────────────────────────┐
  Inside React event handler:                             │
    setA(1)   ─┐                                          │
    setB(2)   ─┤── batched ✅  → 1 re-render              │
    setC(3)   ─┘                                          │
                                                          │
  Inside setTimeout / Promise / native event:             │
    setA(1)   ─┐                                          │
    setB(2)   ─┤── ALSO batched ✅  → 1 re-render 🎉       │
    setC(3)   ─┘                                          │
──────────────────────────────────────────────────────────┘
```

---

#### Code — React 17 Behavior (3 re-renders in async)

```jsx
// React 17 — async context triggers 3 separate re-renders
function React17Problem() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [c, setC] = useState(0);

  const handleClick = () => {
    // ✅ INSIDE onClick — React 17 batches these: 1 re-render
    setA(1);
    setB(2);
    setC(3);
  };

  const handleAsyncClick = () => {
    fetch('/api/data').then(() => {
      // ❌ INSIDE Promise.then — React 17 does NOT batch: 3 re-renders
      // WHY: React 17's batching only works by wrapping in ReactDOM.unstable_batchedUpdates()
      //      for async contexts. Promises take execution outside React's event loop wrapper.
      setA(1); // re-render 1
      setB(2); // re-render 2
      setC(3); // re-render 3
    });
  };
}
```

---

#### Code — React 18 Behavior (Always 1 re-render)

```jsx
// React 18 — automatic batching works EVERYWHERE
// Requires: ReactDOM.createRoot() in your index.js (not ReactDOM.render())

// index.js — MUST use createRoot for React 18 features
import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
// WHY createRoot: it opts your app into React 18's concurrent features,
// including automatic batching outside React event handlers.
root.render(<App />);

// ─── In any component ────────────────────────────────────────────────────

function React18Component() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [c, setC] = useState(0);

  const handleAsyncClick = async () => {
    const data = await fetch('/api/data');
    // ✅ React 18: ALL THREE are batched → only 1 re-render! 🎉
    setA(1);
    setB(2);
    setC(3);
    // WHY: React 18 uses a scheduler that accumulates all synchronous
    // state updates within the same "microtask" and flushes them together.
  };

  const handleTimeout = () => {
    setTimeout(() => {
      // ✅ React 18: also batched → 1 re-render!
      setA(1);
      setB(2);
      setC(3);
    }, 1000);
  };

  const handleNativeEvent = () => {
    // Subscribe to a native DOM event (not a React synthetic event)
    document.addEventListener('click', () => {
      // ✅ React 18: also batched!
      setA(1);
      setB(2);
    }, { once: true });
  };
}
```

---

#### Code — Opt Out of Batching (`flushSync`)

```jsx
import { flushSync } from 'react-dom';

// WHY you'd want to opt out:
// If you need a DOM measurement AFTER a specific state update
// but BEFORE other state updates apply — you force an immediate flush.
function Example() {
  const [count, setCount] = useState(0);
  const [flag, setFlag]   = useState(false);

  const handleClick = () => {
    // WHY flushSync: forces React to flush this update IMMEDIATELY
    // and synchronously re-render before continuing.
    flushSync(() => {
      setCount(c => c + 1); // ← React re-renders RIGHT NOW
    });
    // DOM is updated here — you can measure layout:
    const el = document.getElementById('counter');
    console.log(el.getBoundingClientRect()); // ← reads updated DOM

    // This runs in the NEXT batch (after the flushSync completes)
    setFlag(true);
  };
}
```

---

#### Key Differences Summary

```
Feature                  React 17            React 18
───────────────────────  ─────────────────   ──────────────────────
Batching in onClick      ✅ yes              ✅ yes
Batching in setTimeout   ❌ no               ✅ yes (automatic)
Batching in Promises     ❌ no               ✅ yes (automatic)
Batching in native events❌ no               ✅ yes (automatic)
Opt out                  N/A                 flushSync()
Requires                 ReactDOM.render()   ReactDOM.createRoot()
```

---

#### Time & Space Complexity

| Scenario | React 17 | React 18 |
|---|---|---|
| 3 setState in async | 3 renders → O(3×renderCost) | 1 render → O(1×renderCost) |
| Diffing work | O(tree size × renders) | O(tree size × 1) |
| Memory (state queue) | O(N updates) | O(N updates, batched flush) |
| `flushSync` overhead | N/A | O(1 forced flush) |

---

### Q8. What is `useTransition` and when would you use it over `useState`?

---

#### ELI5

> Imagine you're at a post office. There are two lines:
> - **Urgent line** (passport renewal, time-sensitive)
> - **Non-urgent line** (change of address, can wait)
>
> `useTransition` lets you tell React: *"These state updates are non-urgent — put them in the slow lane. Keep the UI responsive for urgent things first."*
>
> Regular `useState` treats ALL updates equally — every update blocks the screen until it's done. `useTransition` lets React **pause and resume** non-urgent renders if something more important comes in.

---

#### Flowchart — Without vs With `useTransition`

```
WITHOUT useTransition (React 17 / plain useState):
─────────────────────────────────────────────────
  User types "react"
       │
       ▼
  setQuery("react")                  ← BLOCKS until done
       │
  Expensive render of 10,000 items   ← UI FREEZES here
  (takes 500ms)
       │                             ← User can't type during this!
       ▼
  UI updates finally

WITH useTransition:
───────────────────
  User types "react"
       │
       ▼
  setQuery("react")                  ← Immediate, urgent ✅
       │                               (input stays responsive)
       ▼
  startTransition(() => {
    setFilteredList(newItems)        ← Non-urgent, deferred
  })
       │
       ├── User types next char?
       │    └── React INTERRUPTS the transition render → re-starts with new input
       │
       ▼
  Transition renders when no urgent work is pending → UI updates ✅
```

---

#### Code — Problem Without `useTransition`

```jsx
import { useState } from 'react';

// Simulating an expensive list (e.g., rendering 10,000 items)
const ALL_ITEMS = Array.from({ length: 10_000 }, (_, i) => `Item ${i + 1}`);

function SearchListBad() {
  const [query, setQuery]   = useState('');
  const [results, setResults] = useState(ALL_ITEMS);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val); // updates input display

    // ❌ WHY this causes jank: this filter runs synchronously during the event.
    // React won't paint the input's new value UNTIL the filter is done.
    // With 10,000 items this takes ~200-500ms → input feels laggy!
    const filtered = ALL_ITEMS.filter(item =>
      item.toLowerCase().includes(val.toLowerCase())
    );
    setResults(filtered);
  };

  return (
    <>
      <input value={query} onChange={handleChange} placeholder="Search..." />
      <ul>{results.map(r => <li key={r}>{r}</li>)}</ul>
    </>
  );
}
```

---

#### Code — Fixed With `useTransition`

```jsx
import { useState, useTransition } from 'react';

const ALL_ITEMS = Array.from({ length: 10_000 }, (_, i) => `Item ${i + 1}`);

function SearchListGood() {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState(ALL_ITEMS);

  // WHY useTransition:
  // `isPending` = true while the transition render is still in progress
  // `startTransition` = the wrapper that marks updates as "non-urgent"
  const [isPending, startTransition] = useTransition();

  const handleChange = (e) => {
    const val = e.target.value;

    // WHY setQuery OUTSIDE startTransition:
    // Updating the input value is URGENT — user needs to see what they typed immediately.
    // This gets the highest rendering priority.
    setQuery(val);

    // WHY startTransition here:
    // Filtering 10,000 items is EXPENSIVE but not urgent.
    // React can pause this render mid-way if the user types another character.
    // "Interruptible rendering" = React 18's Concurrent Mode.
    startTransition(() => {
      const filtered = ALL_ITEMS.filter(item =>
        item.toLowerCase().includes(val.toLowerCase())
      );
      setResults(filtered); // ← deferred, won't block input
    });
  };

  return (
    <>
      <input value={query} onChange={handleChange} placeholder="Search..." />

      {/* WHY show isPending: gives visual feedback that results are loading */}
      {isPending && <p>Updating list...</p>}

      {/* WHY opacity trick: visually indicates stale results while new ones load */}
      <ul style={{ opacity: isPending ? 0.5 : 1 }}>
        {results.map(r => <li key={r}>{r}</li>)}
      </ul>
    </>
  );
}
```

**Step-by-step:**
1. User types `"r"` → `setQuery("r")` runs at highest priority → input updates immediately
2. `startTransition` enqueues `setResults(...)` at low priority
3. React starts rendering the filtered list...
4. User types `"re"` → React **interrupts** the low-priority render (throws it away)
5. `setQuery("re")` runs at high priority → input updates immediately again
6. New transition enqueued with `"re"` filter — React renders it when idle ✅

---

#### Code — `useTransition` for Page Navigation (Next.js / Router)

```jsx
import { useTransition } from 'react';
import { useRouter }     from 'next/router';

function NavButton({ href, children }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    startTransition(() => {
      // WHY inside transition: page navigation can be slow.
      // Marking it as non-urgent keeps the current page responsive
      // while the new page's data/components are loading.
      router.push(href);
    });
  };

  return (
    <button onClick={handleClick} disabled={isPending}>
      {isPending ? 'Loading...' : children}
    </button>
  );
}
```

---

#### `useTransition` vs `useState` — Decision Guide

```
                  useState                  useTransition
                  ────────                  ─────────────
Priority          All updates equal         Marks updates as LOW priority
Blocking?         Yes — blocks paint        No — interruptible by urgent updates
isPending         No built-in flag          ✅ isPending flag included
Best for          Urgent UI updates         Expensive, non-urgent state changes
                  (input, toggle, modal)    (large list filter, route change,
                                            tab switch with heavy content)
Requirement       Any React version         React 18+ with createRoot
```

---

#### Time & Space Complexity

| Scenario | Complexity | Why |
|---|---|---|
| `startTransition` dispatch | O(1) | Enqueues update with low-priority lane |
| Interrupted render (user types) | O(work done so far, discarded) | React stops and discards partial render trees |
| Full transition render | O(component tree × filter work) | Same as normal render after all — just interruptible |
| `isPending` check | O(1) | Boolean derived from React's scheduler state |

---

### Q9. What is `useDeferredValue` and how does it differ from debouncing?

---

#### ELI5

> Imagine you're watching a painter paint a live portrait of you while you move around.
>
> - **Debouncing** = the painter **refuses to start** until you stand still for 300ms. If you keep moving, he waits. He starts fresh once you stop.
>
> - **`useDeferredValue`** = the painter **always shows you the last completed portrait** while constantly working on the latest one in the background. He never stops; he just shows you finished work until the new one is ready.

---

#### Flowchart — Debounce vs `useDeferredValue`

```
DEBOUNCING:
──────────────────────────────────────────────────────────
  User types: r → re → rea → reac → react
                ↑    ↑    ↑
        timer resets each time (300ms delay)

  Only fires ONCE after 300ms of silence:
  r   (ignore)
  re  (ignore)
  rea (ignore)
  reac(ignore)
  react → FIRES filter after 300ms ✅

  Problem: 300ms built-in lag even on a fast device.
  Arbitrary constant — too short = perf issue, too long = feels slow.

useDeferredValue:
──────────────────────────────────────────────────────────
  User types: r → re → react
                  ↑
  React renders IMMEDIATELY, but at LOW priority

  Render 1 (urgent):   input shows "react"
  Render 2 (deferred): list re-filters with "react"

  React decides when to do the deferred render based on device speed.
  Fast device  → deferred render starts almost immediately
  Slow device  → deferred render waits longer, but never blocks input
  
  No arbitrary timer. React adapts to the device automatically. 🎉
```

---

#### Code — Debounce Approach (for comparison)

```jsx
import { useState, useEffect } from 'react';

function SearchWithDebounce() {
  const [input,         setInput]         = useState('');
  const [debouncedVal,  setDebouncedVal]  = useState('');

  useEffect(() => {
    // WHY setTimeout: delays the expensive update by 300ms.
    // If input changes before 300ms, the old timer is cleared and a new one starts.
    const timer = setTimeout(() => {
      setDebouncedVal(input); // ← only fires after 300ms of no new input
    }, 300);

    return () => clearTimeout(timer); // ← cleanup: cancel pending timer on each new input
  }, [input]);

  // debouncedVal is used to drive the expensive render
  const filtered = ALL_ITEMS.filter(i =>
    i.toLowerCase().includes(debouncedVal.toLowerCase())
  );

  return (
    <>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <ul>{filtered.map(r => <li key={r}>{r}</li>)}</ul>
    </>
  );
}
```

---

#### Code — `useDeferredValue` Approach

```jsx
import { useState, useDeferredValue, memo } from 'react';

const ALL_ITEMS = Array.from({ length: 10_000 }, (_, i) => `Item ${i + 1}`);

// WHY memo here: MemoizedList only re-renders when `query` prop actually changes.
// Combined with useDeferredValue, React renders the list with the PREVIOUS deferred
// value first (stale but fast), then queues a low-priority render with the new value.
const MemoizedList = memo(function ItemList({ query }) {
  // WHY memo: prevents re-renders when the parent renders for urgent reasons
  // (like updating the input), but query (deferred value) hasn't changed yet.
  const filtered = ALL_ITEMS.filter(i =>
    i.toLowerCase().includes(query.toLowerCase())
  );
  return <ul>{filtered.map(r => <li key={r}>{r}</li>)}</ul>;
});

function SearchWithDeferredValue() {
  const [query, setQuery] = useState('');

  // WHY useDeferredValue:
  // `deferredQuery` lags behind `query` when the UI is busy.
  // It always holds either the current value (if React has time) or
  // the last "committed" stable value (if React is still working on a render).
  const deferredQuery = useDeferredValue(query);

  // WHY compare query vs deferredQuery:
  // When they differ, it means we're mid-transition — results are stale.
  // Visually indicate this so the user knows fresh results are coming.
  const isStale = query !== deferredQuery;

  return (
    <>
      {/* WHY setQuery directly (not deferred): input MUST update immediately */}
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search..."
      />

      {/* WHY wrap in div with opacity: visual feedback of staleness */}
      <div style={{ opacity: isStale ? 0.5 : 1, transition: 'opacity 0.2s' }}>
        {/* WHY pass deferredQuery (not query): the expensive component
            only re-renders with the DEFERRED (possibly lagging) value */}
        <MemoizedList query={deferredQuery} />
      </div>
    </>
  );
}
```

**Step-by-step:**
1. User types `"r"` → `query = "r"` → urgent render → input shows `"r"` immediately
2. `deferredQuery` might still be `""` (React hasn't had time to update it yet)
3. `MemoizedList` renders with `deferredQuery = ""` (old list, stale) — shows with 50% opacity
4. React finds idle time → defers priority render → `deferredQuery = "r"` → list re-filters ✅
5. `query === deferredQuery` → opacity goes back to 100%

---

#### Side-by-side Comparison

```
                  debounce              useDeferredValue
                  ────────────────      ─────────────────────
Mechanism         timer-based           React scheduler-based
Delay type        Fixed (e.g. 300ms)    Adaptive (depends on device load)
Shows old value   Only after delay      Immediately (stale-while-revalidate)
Interrupts input? Yes (during delay)    No (input always urgent)
Required React    Any                   React 18+ (Concurrent Mode)
Extra dep?        Custom hook / lib     Built-in hook
Best for          API calls (save network bandwidth)    Expensive in-mem renders
Cancel on change  Yes (clearTimeout)    Yes (React discards deferred render)
```

---

#### When to Use Which

```
Has network call? (API search)
       │
      YES → Use DEBOUNCE  (save API calls — don't fire on every keystroke)
       │
      NO
       │
       ▼
Expensive in-memory computation? (filter large array, complex chart)
       │
      YES → Use useDeferredValue (keep input responsive, adapt to device speed)
       │
      NO → Plain useState is fine
```

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|---|---|---|
| `useDeferredValue` read | O(1) | Just returns one of two state values |
| Deferred render trigger | O(component subtree) | Re-renders only the deferred subtree |
| Debounce timer setup | O(1) | `setTimeout` + `clearTimeout` |
| Combined with `memo` | O(1) per skipped render | Memo prevents render when deferred val unchanged |
| Staleness check `q !== dq` | O(1) | String equality comparison |

---

### Q10. How do you implement `useDebounce` as a custom hook?

---

#### ELI5

> Imagine you shout at your smart home speaker. Every time you say a word it starts to respond, but you're still talking — so it waits. Only when you **pause for a moment** does it actually respond.
>
> `useDebounce` is that "wait for a pause" logic extracted into a reusable hook. Give it a value and a delay — it only updates after you stop changing the value for that many milliseconds.

---

#### Flowchart — How useDebounce Works Internally

```
value changes rapidly: "r" → "re" → "rea" → "reac" → "react"
                          │     │     │       │
                    timer │     │     │       │ reset each time
                    reset │◄────│◄────│◄──────│
                          │
                         300ms of silence...
                          │
                          ▼
                  debouncedValue = "react"  ✅  (only fires once)

Internal state machine:
  ┌──────────────────────────────────────────────────────────┐
  │  value = "react", delay = 300                            │
  │                                                          │
  │  useEffect(() => {                                        │
  │    const timer = setTimeout(() => {                       │
  │      setDebouncedValue(value)  ← fires after 300ms       │
  │    }, delay)                                             │
  │                                                          │
  │    return () => clearTimeout(timer) ← canceled if        │
  │                                       value changes      │
  │  }, [value, delay])                                      │
  └──────────────────────────────────────────────────────────┘
```

---

#### Code — Simple `useDebounce` Implementation

```jsx
import { useState, useEffect } from 'react';

/**
 * useDebounce — delays updating a value until changes stop for `delay` ms
 *
 * @param {T}      value  — the value to debounce (string, number, object, etc.)
 * @param {number} delay  — milliseconds to wait after last change before updating
 * @returns {T}           — the debounced (lagging) value
 */
function useDebounce(value, delay = 300) {
  // WHY separate state: we need TWO values simultaneously:
  // 1. `value` — always mirrors what parent passes (fresh, changes fast)
  // 2. `debouncedValue` — only updates after `delay` ms of no new `value`
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // WHY setTimeout: delay applying the new value.
    // Each time `value` changes, this effect re-runs (due to [value, delay] deps).
    // Before re-running, React calls the cleanup (return below) which CANCELS
    // the previous pending timer. So if value changes before delay expires,
    // the previous setDebouncedValue never fires!
    const timer = setTimeout(() => {
      // WHY functional form not needed here: `value` is a closure capture,
      // but this is fine — it's the WHOLE POINT. We WANT the captured value
      // from this specific render. It's not a stale-closure bug here.
      setDebouncedValue(value);
    }, delay);

    // WHY return cleanup: React calls this before the next effect run
    // AND when the component unmounts. Clearing prevents:
    // 1. Stale debounced updates firing after unmount (memory leak)
    // 2. Old timer overwriting a newer one when value changes rapidly
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]); // ← re-run when value OR delay changes

  return debouncedValue;
}

export default useDebounce;
```

---

#### Code — Usage in a Component

```jsx
import { useState } from 'react';
import useDebounce from './useDebounce';

function SearchInput() {
  const [query,   setQuery]   = useState('');
  // WHY 400ms: balances responsiveness vs performance.
  // 200ms = too few skipped renders, doesn't help much
  // 500ms+ = feels sluggish
  const debouncedQuery = useDebounce(query, 400);

  // WHY useEffect with debouncedQuery:
  // Only triggers the API call AFTER the user pauses typing.
  // Without debounce, every keystroke = 1 API call → expensive!
  useEffect(() => {
    if (!debouncedQuery) return;
    // WHY guard: skip empty query — no point fetching nothing

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(res => res.json())
      .then(data => console.log(data));
  }, [debouncedQuery]); // ← only fires after user stops typing

  return (
    <input
      value={query}
      onChange={e => setQuery(e.target.value)}
      placeholder="Search..."
    />
    // query = always in sync with input (immediate)
    // debouncedQuery = only updates after 400ms of silence
  );
}
```

---

#### Code — Enhanced Version: `useDebounce` with Callback (Not Just Value)

```jsx
import { useRef, useCallback } from 'react';

/**
 * useDebouncedCallback — debounces a FUNCTION instead of a value.
 * Use this when you want to debounce a callback, not a state value.
 *
 * @param {Function} fn    — the function to debounce
 * @param {number}   delay — milliseconds delay
 * @returns {Function}     — debounced version of fn
 */
function useDebouncedCallback(fn, delay = 300) {
  // WHY useRef for timerRef: we need to persist the timer ID across renders
  // without causing re-renders when the timer ID changes.
  const timerRef = useRef(null);

  // WHY useCallback: stabilize the returned function reference.
  // Without it, every render returns a NEW debounced function, which could
  // break child components relying on reference equality (memo, useEffect deps).
  const debouncedFn = useCallback((...args) => {
    // WHY clearTimeout first: cancel any pending invocation before scheduling new one
    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      // WHY fn(...args): forward ALL original arguments to the real function
      fn(...args);
    }, delay);
  }, [fn, delay]); // ← re-creates only if fn or delay changes

  return debouncedFn;
}

// Usage:
function SearchWithCallback() {
  const [results, setResults] = useState([]);

  // WHY this pattern: when you want the handler itself to be debounced,
  // not a state value. Useful for form handlers, resize handlers, etc.
  const handleSearch = useDebouncedCallback(async (val) => {
    const data = await fetch(`/api/search?q=${val}`).then(r => r.json());
    setResults(data);
  }, 400);

  return (
    <input
      onChange={e => handleSearch(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

---

#### Gotchas and Edge Cases

```
Gotcha 1: Changing `delay` at runtime resets the debounce timer
────────────────────────────────────────────────────────────────
  const debouncedVal = useDebounce(query, isDev ? 100 : 400);
  // Fine — `delay` is a dep, so changing it re-runs the effect correctly.

Gotcha 2: Object/Array `value` always triggers (new reference)
────────────────────────────────────────────────────────────────
  const debouncedFilter = useDebounce({ min: 0, max: 100 }, 300);
  // ❌ Creates new object every render → effect re-runs every render!
  // FIX: pass primitives, or use JSON.stringify() as the dep, or useMemo.

Gotcha 3: Async-safety — stale debounced call can overwrite newer state
─────────────────────────────────────────────────────────────────────────
  // Combine with ignore flag (Q3) when the debounced fn makes HTTP requests.
  // debounce prevents multiple calls, but you still need ignore/AbortController
  // in case network responds out of order.
```

---

#### Full Production-Ready `useDebounce` with Abort

```jsx
function useDebounceWithAbort(query, delay = 300) {
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const debouncedQuery = useDebounce(query, delay); // ← uses our hook from above

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    let ignore = false;
    const controller = new AbortController();

    setLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, {
      signal: controller.signal,
    })
      .then(res => res.json())
      .then(data => { if (!ignore) setResults(data); })
      .catch(err => { if (err.name !== 'AbortError') console.error(err); })
      .finally(() => { if (!ignore) setLoading(false); });

    return () => {
      ignore = true;
      controller.abort(); // ← cancel request if debouncedQuery changes
    };
  }, [debouncedQuery]);

  return { results, loading };
}
```

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|---|---|---|
| Timer creation (`setTimeout`) | O(1) | Browser-native, constant time |
| Timer cancellation (`clearTimeout`) | O(1) | Direct timer ID lookup |
| State update when timer fires | O(1) | Single `setState` call |
| Memory per hook instance | O(1) | 1 state value + 1 timer ID ref |
| Network debouncing savings | O(K/N) calls | K = calls that fire, N = total keystrokes |

---

## End of Section: REACT — Core Hooks (Q1–Q10)

---

## REACT — Performance

---

### Q11. When does `React.memo` NOT prevent a re-render even when props look the same?

---

#### ELI5 (Explain Like I'm 5)

> Imagine you're a bouncer at a club. Your rule is: "Only let in new guests." You check by comparing **ID cards**.
>
> `React.memo` is that bouncer — it compares old and new props. If they look the **same**, it blocks the re-render.
>
> BUT — if the ID card is a **photocopy** (a new object/function created fresh every render), even though the *content* is the same, the bouncer sees it as a **different card** and lets the re-render through.
>
> The bouncer uses **reference equality** (`===`), not deep equality.

---

#### Flowchart — When React.memo Fails

```
Parent re-renders
       │
       ▼
┌──────────────────────────────────────────┐
│  React.memo checks: prevProps === nextProps │
└──────────────────────────────────────────┘
       │
       ├── SAME reference? ──────────────────→ ✅ SKIP re-render
       │
       └── DIFFERENT reference? ────────────→ ❌ RE-RENDER happens
                    │
         Even if the VALUES look identical!
         
CASES WHERE REFERENCE CHANGES EVERY RENDER:
┌────────────────────────────────────────────────────────┐
│  1. Inline objects     → <Comp style={{ color: 'red' }} />  │
│     • New {} created every render = new reference      │
│                                                        │
│  2. Inline functions   → <Comp onClick={() => {}} />   │
│     • New function created every render = new ref      │
│                                                        │
│  3. Inline arrays      → <Comp items={[1, 2, 3]} />    │
│     • New [] created every render = new reference      │
│                                                        │
│  4. Context changes    → if component reads context,   │
│     context update BYPASSES memo entirely              │
│                                                        │
│  5. Custom comparator wrong → if you pass a bad        │
│     areEqual() function, it may always return false    │
└────────────────────────────────────────────────────────┘
```

---

#### Code Example — 5 Ways React.memo Fails + Fixes

```jsx
import React, { useState, useCallback, useMemo } from 'react';

// ── The memoized child ──────────────────────────────────────────────
const Child = React.memo(({ onClick, style, items, data }) => {
  console.log('Child rendered!');
  return <div style={style} onClick={onClick}>{items.length} items</div>;
});

// ── CASE 1: Inline function — BREAKS memo ───────────────────────────
function ParentBroken() {
  const [count, setCount] = useState(0);

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      {/* ❌ New function created every render → Child always re-renders */}
      <Child onClick={() => console.log('clicked')} />
    </>
  );
}

// ── FIX 1: useCallback stabilises the function reference ────────────
function ParentFixed1() {
  const [count, setCount] = useState(0);

  // ✅ Same reference between renders (no dependencies change)
  const handleClick = useCallback(() => {
    console.log('clicked');
  }, []); // empty dep array = created once, reference never changes

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <Child onClick={handleClick} /> {/* ✅ memo works */}
    </>
  );
}

// ── CASE 2: Inline object — BREAKS memo ─────────────────────────────
function ParentBroken2() {
  const [count, setCount] = useState(0);

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      {/* ❌ New {} on every render */}
      <Child style={{ color: 'red', fontWeight: 'bold' }} items={[1, 2]} />
    </>
  );
}

// ── FIX 2: useMemo stabilises object/array references ───────────────
function ParentFixed2() {
  const [count, setCount] = useState(0);

  // ✅ Same object reference unless dependencies change
  const style  = useMemo(() => ({ color: 'red', fontWeight: 'bold' }), []);
  const items  = useMemo(() => [1, 2], []);

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <Child style={style} items={items} /> {/* ✅ memo works */}
    </>
  );
}

// ── CASE 3: Context — BYPASSES memo entirely ─────────────────────────
const ThemeContext = React.createContext('light');

const ChildWithContext = React.memo(() => {
  const theme = React.useContext(ThemeContext); // ← reads context
  console.log('ChildWithContext rendered!');
  return <div>{theme}</div>;
  // ❌ Even with React.memo — ANY context update re-renders this
  // React.memo only blocks prop changes, NOT context changes
});

// ── CASE 4: Custom areEqual returning wrong result ───────────────────
const ChildCustom = React.memo(
  ({ data }) => <div>{data.value}</div>,
  (prevProps, nextProps) => {
    // This function should return TRUE if props are EQUAL (skip re-render)
    // ❌ Common mistake: returning false always = always re-renders
    return false; // BAD: "props are never equal" → always re-renders
    // ✅ Correct: return prevProps.data.value === nextProps.data.value
  }
);
```

---

#### Step-by-Step Explanation

| Step | Code | Why |
|------|------|-----|
| 1 | `React.memo(Child)` | Wraps Child; React will shallowly compare props before re-rendering |
| 2 | `onClick={() => {}}` inline | JavaScript creates a **new function object** each render — `() => {} !== () => {}` is always `true` |
| 3 | `useCallback(fn, [])` | Memoizes the function; same reference returned on every render as long as deps don't change |
| 4 | `useMemo(() => obj, [])` | Memoizes an object/array; same reference until deps change |
| 5 | `useContext(ctx)` | Context bypasses `React.memo`— context changes propagate to ALL consumers regardless |
| 6 | `areEqual(prev, next)` | Custom comparator: return `true` = equal = skip render; `false` = different = render |

---

#### The Shallow Comparison Rule

```
React.memo uses Object.is() for each prop:

  Object.is(42, 42)            → true  ✅
  Object.is('hello', 'hello')  → true  ✅
  Object.is({}, {})            → false ❌  (different references)
  Object.is([], [])            → false ❌  (different references)
  Object.is(fn, fn)            → false ❌  (if recreated each render)
```

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|-----------|-----------|-----|
| Prop comparison (shallow) | O(P) | P = number of props — each checked with `Object.is` |
| Re-render skipped | O(1) | No work done if comparison returns equal |
| `useCallback` memoization | O(1) | Stores one function reference, returns it on reuse |
| `useMemo` memoization | O(1) | Stores one value reference |
| Context propagation | O(C) | C = all consumers — cannot be stopped by memo |

---

### Q12. What is the difference between `useMemo` and `useCallback`? Can you implement one using the other?

---

#### ELI5 (Explain Like I'm 5)

> Imagine you have a magic notebook that remembers answers so you don't have to calculate them again.
>
> **`useMemo`** memorizes a **result** — "the answer to 100 × 99 is 9900, I'll remember that."
>
> **`useCallback`** memorizes a **recipe (function)** — "the recipe for chocolate cake is X, I'll remember that recipe."
>
> The key insight: a function IS a value in JavaScript. So `useCallback(fn, deps)` is literally just `useMemo(() => fn, deps)`. One memoizes values, the other memoizes functions — but functions are values, so one is a special case of the other.

---

#### Flowchart — useMemo vs useCallback

```
┌─────────────────────────────────────────────────────────────────┐
│                          useMemo                                │
│                                                                 │
│  Deps change?                                                   │
│      YES → re-run factory fn → store & return NEW VALUE        │
│      NO  → return CACHED VALUE (skip factory fn entirely)      │
│                                                                 │
│  Usage: memoize expensive calculations, derived data, objects  │
│  Returns: the VALUE the factory function produces              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        useCallback                              │
│                                                                 │
│  Deps change?                                                   │
│      YES → create NEW function reference                       │
│      NO  → return SAME function reference as before            │
│                                                                 │
│  Usage: stabilize event handlers passed to memoized components │
│  Returns: the FUNCTION ITSELF (not its return value)           │
└─────────────────────────────────────────────────────────────────┘

Key difference visualised:
─────────────────────────────────────────
  useMemo(() => computeValue(), [dep])
           ^^^^^^^^^^^^^^^^^           ← factory is called, RESULT stored
  
  useCallback(() => doSomething(), [dep])
              ^^^^^^^^^^^^^^^^^^        ← factory NOT called, FUNCTION stored
─────────────────────────────────────────
  useCallback(fn, deps)
  ≡
  useMemo(() => fn, deps)  ← 100% equivalent!
```

---

#### Code Example — Both Hooks + Implementing Each via the Other

```jsx
import React, { useState, useMemo, useCallback } from 'react';

// ─── Sample data ─────────────────────────────────────────────────
const products = Array.from({ length: 10_000 }, (_, i) => ({
  id: i,
  name: `Product ${i}`,
  price: Math.random() * 100,
  category: i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C',
}));

// ─── useMemo: memoize an EXPENSIVE CALCULATION ───────────────────
function ProductList({ category, discount }) {
  // ❌ Without useMemo: re-filters 10,000 items on EVERY render
  // const filtered = products.filter(p => p.category === category);

  // ✅ With useMemo: only re-filters when `category` changes
  const filtered = useMemo(
    () => products.filter(p => p.category === category),
    [category]                // dep array — re-run only if category changes
    // Step 1: React checks — did `category` change since last render?
    // Step 2: If NO  → return cached `filtered` array (same reference!)
    // Step 3: If YES → run the .filter(), cache the new result, return it
  );

  // ✅ useMemo for derived data (avoids new object on every render)
  const stats = useMemo(() => ({
    count: filtered.length,
    avgPrice: filtered.reduce((s, p) => s + p.price, 0) / filtered.length,
  }), [filtered]); // depends on filtered → naturally cascades

  return (
    <div>
      <p>{stats.count} products, avg ${stats.avgPrice.toFixed(2)}</p>
      {filtered.map(p => <div key={p.id}>{p.name}</div>)}
    </div>
  );
}

// ─── useCallback: memoize a FUNCTION REFERENCE ───────────────────
const Row = React.memo(({ product, onDelete }) => {
  console.log(`Row ${product.id} rendered`);
  return (
    <div>
      {product.name}
      <button onClick={() => onDelete(product.id)}>Delete</button>
    </div>
  );
});

function ProductTable() {
  const [items, setItems] = useState(products.slice(0, 20));
  const [count, setCount] = useState(0); // unrelated state

  // ❌ Without useCallback: new function every render
  //    → onDelete reference changes → ALL Row components re-render
  // const onDelete = (id) => setItems(prev => prev.filter(p => p.id !== id));

  // ✅ With useCallback: stable function reference
  //    → React.memo on Row can actually work
  const onDelete = useCallback(
    (id) => setItems(prev => prev.filter(p => p.id !== id)),
    [] // setItems from useState is stable — no deps needed
    // Step 1: React checks deps [] — nothing in deps that changes
    // Step 2: Returns the SAME function reference every render
    // Step 3: Row's React.memo sees same `onDelete` → skips re-render
  );

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>
        Unrelated: {count}  {/* clicking this won't re-render Rows */}
      </button>
      {items.map(p => <Row key={p.id} product={p} onDelete={onDelete} />)}
    </>
  );
}

// ─── IMPLEMENTING useCallback USING useMemo ───────────────────────
// This is how React actually implements useCallback internally!
function myUseCallback(fn, deps) {
  // useMemo stores the factory's return value
  // the factory just returns fn itself (the function, not its result)
  return useMemo(() => fn, deps);
  //             ^^^^^^ factory returns the function
  //                    useMemo stores that function as the "value"
}

// Proof it works:
function Demo() {
  const [x, setX] = useState(0);

  // These two are 100% equivalent:
  const cb1 = useCallback(() => console.log(x), [x]);
  const cb2 = useMemo(() => () => console.log(x), [x]);
  //                  ^^^ outer fn is factory, inner fn is the callback

  return <button onClick={cb1}>Go</button>;
}

// ─── WHEN TO USE WHICH ────────────────────────────────────────────
// useMemo  → when you want to memoize a COMPUTED VALUE
//            e.g., filtered list, total price, sorted array
//
// useCallback → when you want to memoize a FUNCTION REFERENCE
//               e.g., event handlers passed to memoized children
//
// Rule of thumb:
//   useMemo(() => fn, deps)      = memoize function as a value
//   useMemo(() => fn(), deps)    = memoize function's RETURN value
//   useCallback(fn, deps)        = shorthand for first case
```

---

#### Step-by-Step Explanation

| Step | Code | Why |
|------|------|-----|
| 1 | `useMemo(() => products.filter(...), [category])` | Factory runs expensive filter, result cached. Re-runs only if `category` changes |
| 2 | Dep array `[category]` | React uses `Object.is` to compare old vs new `category` |
| 3 | `useCallback((id) => setItems(...), [])` | Stores the function itself. Empty deps = function reference never recreated |
| 4 | `React.memo` on `Row` | Now that `onDelete` ref is stable, memo's shallow comparison works |
| 5 | `useMemo(() => fn, deps)` | Implementing useCallback: factory returns **the function itself**, not its return value |
| 6 | `useMemo(() => () => console.log(x), [x])` | Double arrow: outer `() =>` is the factory, inner `() =>` is the memoized callback |

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|-----------|-----------|-----|
| `useMemo` dep check | O(D) | D = number of dependencies, each compared with `Object.is` |
| `useMemo` factory (skipped) | O(1) | Just a reference return from cache |
| `useMemo` factory (run) | O(N) | N = cost of your computation (e.g., filter of N items) |
| `useCallback` dep check | O(D) | Same dep comparison |
| Memory per `useMemo`/`useCallback` | O(1) | Stores one cached value/reference + dep array |

---

### Q13. How does React's reconciliation algorithm work? What role does the `key` prop play?

---

#### ELI5 (Explain Like I'm 5)

> Imagine you have a LEGO house and you want to change it. You have two choices:
> 1. **Demolish everything and rebuild** — slow, wasteful.
> 2. **Find what changed and only swap those pieces** — fast!
>
> React uses option 2. It makes a "before" picture of your UI (the old Virtual DOM) and an "after" picture (the new Virtual DOM), then **diffs them** to find what actually changed, and only updates those real DOM nodes.
>
> The `key` prop is like a **name tag** on each LEGO piece. Without name tags, React has to guess which piece moved. With name tags, it knows exactly which piece is which — even if you rearrange them.

---

#### Flowchart — Full Reconciliation Pipeline

```
State/Props change
       │
       ▼
┌──────────────────────────────────────┐
│  React calls render() / function     │
│  component → produces new            │
│  React Element tree (Virtual DOM)    │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│         DIFFING (Reconciliation)     │
│                                      │
│  Compare old tree vs new tree        │
│  using 3 heuristic rules:            │
│                                      │
│  Rule 1: Different element TYPE?     │
│  │   YES → destroy old subtree,      │
│  │         mount new subtree         │
│  │   NO  → keep DOM node, diff attrs │
│  │                                   │
│  Rule 2: Same type, same level?      │
│  │   → update only changed props     │
│  │                                   │
│  Rule 3: Lists — use KEY prop        │
│      KEY exists → map by key         │
│      No KEY     → map by position    │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  Commit Phase                        │
│  Apply minimal DOM mutations to      │
│  the real DOM                        │
└──────────────────────────────────────┘

KEY PROP IN LISTS (the critical detail):
─────────────────────────────────────────────────────────
Without keys (position-based):
OldList: [A, B, C]         → keys by position: 0, 1, 2
NewList: [X, A, B, C]      → keys by position: 0, 1, 2, 3
Result:  Pos0=A→X (update), Pos1=B→A (update), Pos2=C→B (update), +insert C
         → 3 updates + 1 insert  ❌ wasteful!

With keys (identity-based):
OldList: [A(key=a), B(key=b), C(key=c)]
NewList: [X(key=x), A(key=a), B(key=b), C(key=c)]
Result:  key=x → insert X at position 0
         key=a, b, c → just MOVE them, no re-render!  ✅
```

---

#### Code Example — Reconciliation in Practice

```jsx
import React, { useState } from 'react';

// ─── RULE 1: Changing element type destroys the subtree ──────────
function TypeChangeDemo() {
  const [isDiv, setIsDiv] = useState(true);

  // When you toggle, React sees: div → span (different type)
  // → It UNMOUNTS the entire div subtree (loses all state inside!)
  // → It MOUNTS a fresh span subtree
  return (
    <>
      <button onClick={() => setIsDiv(b => !b)}>Toggle</button>
      {isDiv
        ? <div><input defaultValue="type here" /></div>   // ← loses value on toggle!
        : <span><input defaultValue="type here" /></span> // ← fresh mount
      }
    </>
  );
}

// ─── RULE 3: The KEY prop in lists ───────────────────────────────
function ListWithoutKeys() {
  const [items, setItems] = useState(['Alice', 'Bob', 'Charlie']);

  const addToFront = () => setItems(prev => ['Zara', ...prev]);

  return (
    <>
      <button onClick={addToFront}>Add Zara to front</button>
      <ul>
        {items.map(name => (
          // ❌ No key — React uses index
          // When Zara is added at front:
          // index 0 was "Alice" → now "Zara" → React updates text
          // index 1 was "Bob"   → now "Alice" → React updates text
          // All 3 existing items re-render unnecessarily!
          <li key={name}> {/* ✅ use stable identity as key */}
            <input placeholder={name} />
            {/* With index key: input value would shift/misalign! */}
          </li>
        ))}
      </ul>
    </>
  );
}

// ─── KEY as a RESET mechanism ─────────────────────────────────────
// KEY's superpower: changing the key forces a full remount
// Use this deliberately to reset component state!

function UserProfile({ userId }) {
  const [note, setNote] = useState('');

  // Problem: switching between users keeps the old `note` state
  // because React reuses the same UserProfile instance (same type, same position)
  return (
    <div>
      <p>User: {userId}</p>
      <textarea value={note} onChange={e => setNote(e.target.value)} />
    </div>
  );
}

function App() {
  const [userId, setUserId] = useState(1);

  return (
    <>
      <button onClick={() => setUserId(2)}>Switch to User 2</button>

      {/* ❌ Without key: note state persists when switching users */}
      {/* <UserProfile userId={userId} /> */}

      {/* ✅ With key=userId: React sees key changed → unmount + remount
           → fresh state for each user automatically! */}
      <UserProfile key={userId} userId={userId} />
    </>
  );
}

// ─── BAD KEY: using array index ───────────────────────────────────
function BadKeyExample() {
  const [items, setItems] = useState([
    { id: 1, text: 'First' },
    { id: 2, text: 'Second' },
  ]);

  const removeFirst = () => setItems(prev => prev.slice(1));

  return (
    <ul>
      {items.map((item, index) => (
        // ❌ key=index: when first item removed, index 0 now points
        //    to "Second" — React THINKS it updated item, but actually
        //    the item component still has stale internal state!
        <li key={index}>{item.text} <input /></li>
      ))}

      {/* ✅ key=item.id: React correctly identifies which item
           was removed, unmounts only that one */}
      {/* <li key={item.id}>{item.text} <input /></li> */}
    </ul>
  );
}
```

---

#### Step-by-Step Explanation

| Step | Code | Why |
|------|------|-----|
| 1 | Virtual DOM diff starts | React compares element type first — cheapest check |
| 2 | `div → span` | Different type → full unmount + remount of subtree — state is lost |
| 3 | `key={name}` on list | React uses key as identity for each element in the list |
| 4 | Adding to front without keys | React maps by position: pos 0 now has different text → updates each DOM text node |
| 5 | Adding to front with stable keys | React sees key="Zara" is new → insert; key="Alice" etc unchanged → skip |
| 6 | `key={userId}` on `UserProfile` | Deliberately changing key forces remount → cleans up stale state |
| 7 | `key={index}` (bad) | If list reorders/removes, index-based key causes React to reuse wrong component instance |

---

#### The 3 Diffing Rules Summary

```
React's O(n) diffing uses 3 assumptions (heuristics):

1. Elements of different types produce different trees
   → If type changes, tear down and rebuild

2. Keys hint at stable identity across renders
   → If key is the same, React REUSES the component instance

3. Sibling comparisons only (no cross-level diffing)
   → React never compares across different depth levels
   → This is what makes diffing O(n) instead of O(n³)
```

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|-----------|-----------|-----|
| React's diffing algorithm | O(n) | n = nodes in tree. Heuristics avoid full O(n³) tree comparison |
| List diff without keys | O(n) updates | May update every node even if only one changed |
| List diff with stable keys | O(k) | k = actual changes (inserts/removes/moves) |
| DOM mutations | O(m) | m = number of actual DOM operations React schedules |
| Virtual DOM memory | O(n) | Keeps two trees in memory: current + work-in-progress |

---

### Q14. What is virtualization? When would you use `@tanstack/react-virtual`?

---

#### ELI5 (Explain Like I'm 5)

> Imagine a library with 100,000 books. Instead of putting ALL books on the shelves at once, the librarian only puts out the **30 books you can see right now**. As you walk (scroll), she swaps books out — removing the ones behind you, adding the ones ahead.
>
> That's **virtualization**: only rendering the items **currently visible** on screen. A list of 100,000 rows becomes a list of ~20 DOM nodes.
>
> `@tanstack/react-virtual` is that super-efficient librarian.

---

#### Flowchart — How Virtualization Works

```
Full DOM (no virtualization):
─────────────────────────────
  <ul>
    <li>Item 0</li>      ← all in DOM
    <li>Item 1</li>
    <li>Item 2</li>
    ...
    <li>Item 9999</li>   ← 10,000 real DOM nodes!
  </ul>
  → Page scroll: SLOW (layout, paint for all 10k nodes)
  → Memory: bloated


Virtualized list:
─────────────────────────────
  Scroll container (height = 10,000 * rowHeight = fixed)
         │
         ├── Inner container (height = total scroll height)
         │       Acts as a "spacer" to create correct scrollbar
         │
         └── Only VISIBLE items rendered:
                 <li>Item 15</li>   ← user scrolled to ~item 15
                 <li>Item 16</li>
                 <li>Item 17</li>
                 ...
                 <li>Item 35</li>   ← ~20 items visible at once
                 (positioned absolutely using top: offset)


Scroll event flow:
  User scrolls → onScroll fires
       │
       ▼
  Calculate: scrollTop / rowHeight = first visible index
       │
       ▼
  Calculate: first + overscan = range to render
       │
       ▼
  React renders ONLY that slice → rest are unmounted
       │
       ▼
  Items positioned with: transform: translateY(offset)
```

---

#### Code Example — `@tanstack/react-virtual` in Action

```jsx
import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

// ─── Sample data: 50,000 rows ──────────────────────────────────
const allItems = Array.from({ length: 50_000 }, (_, i) => ({
  id: i,
  name: `User #${i}`,
  email: `user${i}@example.com`,
}));

// ─── Basic virtualised list ────────────────────────────────────
function VirtualList() {
  // Step 1: ref on the SCROLL CONTAINER (the element that scrolls)
  const parentRef = useRef(null);

  // Step 2: set up the virtualizer
  const virtualizer = useVirtualizer({
    count: allItems.length,           // total number of items
    getScrollElement: () => parentRef.current, // tell it which element scrolls
    estimateSize: () => 50,           // estimated row height in px
    overscan: 5,                      // render 5 extra rows above/below viewport
    // overscan prevents blank flash on fast scroll
  });

  return (
    // Step 3: scroll container has a FIXED height
    <div
      ref={parentRef}
      style={{
        height: '600px',   // viewport height
        overflow: 'auto',  // enables scrolling
      }}
    >
      {/* Step 4: inner div height = TOTAL virtual height
           This is what creates the correct scrollbar length */}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          // e.g., 50,000 * 50px = 2,500,000px tall
          // Only ~14 screenfulls actually exist, but scroll FEELS like 50k rows
          position: 'relative',
        }}
      >
        {/* Step 5: render only VIRTUAL ITEMS (the visible slice) */}
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}     // needed for dynamic sizing
            ref={virtualizer.measureElement}   // measure actual size (for variable heights)
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              // Step 6: position each item using transform (GPU-accelerated)
              transform: `translateY(${virtualItem.start}px)`,
              // virtualItem.start = this item's pixel offset from top
            }}
          >
            {/* Step 7: render actual content for this index only */}
            <div style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
              <strong>{allItems[virtualItem.index].name}</strong>
              <span>{allItems[virtualItem.index].email}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Variable height rows ──────────────────────────────────────
// When rows have different heights, use measureElement + dynamic sizing
function VariableHeightList() {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: allItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,     // initial estimate; corrected after first render
    overscan: 3,
  });

  return (
    <div ref={parentRef} style={{ height: '500px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(vItem => (
          <div
            key={vItem.key}
            ref={virtualizer.measureElement}  // ← actual DOM measurement
            data-index={vItem.index}
            style={{
              position: 'absolute',
              top: 0,
              width: '100%',
              transform: `translateY(${vItem.start}px)`,
            }}
          >
            {/* rows with different heights */}
            <p style={{ margin: 0, padding: 8 }}>
              {allItems[vItem.index].name}
              {vItem.index % 5 === 0 && <br />} {/* some rows taller */}
              {vItem.index % 5 === 0 && 'Extra line here'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── When to use ───────────────────────────────────────────────
// ✅ Use virtualization when:
//   - List has > 200 items (noticeable perf benefit)
//   - Items are repeated UI (tables, feeds, logs)
//   - Mobile devices (low memory)
//
// ❌ Don't virtualize when:
//   - List has < 100 items
//   - Each item is unique/complex layout (hard to measure height)
//   - You need Cmd+F text search to work (virtualized items aren't in DOM)
//   - You need accurate printing
```

---

#### Step-by-Step Explanation

| Step | Code | Why |
|------|------|-----|
| 1 | `useRef(null)` on scroll container | Virtualizer needs to listen to this element's scroll events |
| 2 | `count: allItems.length` | Total items — used to calculate total scrollable height |
| 3 | `estimateSize: () => 50` | Approximate row height for initial total height estimation |
| 4 | `overscan: 5` | Renders 5 rows above/below viewport — prevents blank rows during fast scroll |
| 5 | `getTotalSize()` on inner div | Makes scrollbar behave as if all 50k rows exist |
| 6 | `getVirtualItems()` | Returns only the ~20 rows currently visible + overscan |
| 7 | `translateY(start)` | Absolutely positions each row at its scroll offset — GPU-accelerated |
| 8 | `measureElement` ref | For variable heights: measures actual rendered DOM size and updates offsets |

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|-----------|-----------|-----|
| DOM nodes rendered | O(V) | V = visible rows (~20-30), not total count N |
| Scroll recalculation | O(log N) | Binary search to find first visible index from scroll offset |
| Total height calculation | O(N) | Sum all estimated/measured heights once, then cached |
| Memory usage | O(V) | Only V DOM nodes + offset cache for measured items |
| Without virtualization | O(N) | N DOM nodes always in memory — O(50,000) for 50k list |

---

### Q15. How does code splitting with `React.lazy()` and `Suspense` work under the hood?

---

#### ELI5 (Explain Like I'm 5)

> Imagine ordering a pizza. Instead of ordering 10 pizzas when you arrive (slow, expensive), you order only the **one pizza you want right now**. If you decide you want dessert later, you order that then.
>
> Without code splitting: the browser downloads ALL your JavaScript at once — even pages the user might never visit.
>
> With code splitting: only the code for the **current page** is downloaded. When the user navigates to a new page, that page's code downloads **on demand**.
>
> `React.lazy()` is the waiter who fetches the right pizza. `Suspense` is the "Please wait..." message shown while the pizza is being prepared.

---

#### Flowchart — Code Splitting Under the Hood

```
BUILD TIME (webpack/vite):
───────────────────────────────────────────────────────────
  import('./pages/Dashboard')
         │
         ▼
  Bundler creates SEPARATE chunk:
    main.js          ← loads immediately
    dashboard.js     ← loads ON DEMAND (code split here)
    profile.js       ← loads ON DEMAND
    settings.js      ← loads ON DEMAND


RUNTIME (user navigates to Dashboard):
───────────────────────────────────────────────────────────
  React.lazy(() => import('./pages/Dashboard'))
         │
         │  First render of <Dashboard />
         ▼
  React: "This is lazy — I need to LOAD IT first"
         │
         ▼
  React throws a PROMISE (Suspense protocol)
         │
         ▼
  Nearest <Suspense> boundary catches the promise
         │
         ├── Renders fallback UI (spinner/skeleton)
         │
         ▼
  Promise resolves → module loaded
         │
         ▼
  React re-renders → replaces fallback with real component
         │
         ▼
  Component is now in a MODULE CACHE
  → subsequent renders: instant (no network call)


The "Throwing a Promise" protocol (how Suspense works):
───────────────────────────────────────────────────────────
  Component renders
       │
       ├── Data ready? → Render normally
       │
       └── Data NOT ready? → throw promise
                 │
                 ▼
         Suspense catches the throw
         Shows fallback
         Waits for promise to settle
         Re-renders component
```

---

#### Code Example — Full Code Splitting Setup

```jsx
import React, { Suspense, lazy, useState } from 'react';

// ─── Step 1: Use lazy() to declare code-split components ─────────
// lazy() takes a function that returns a dynamic import()
// The function is NOT called immediately — only when component is first needed

const Dashboard  = lazy(() => import('./pages/Dashboard'));
//                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                           Webpack/Vite sees this dynamic import
//                           and splits it into a separate JS chunk

const Profile    = lazy(() => import('./pages/Profile'));
const Settings   = lazy(() => import('./pages/Settings'));
// Each of these creates its OWN bundle chunk
// None of them download until the user actually navigates there

// ─── Step 2: Wrap lazy components in Suspense ─────────────────────
function App() {
  const [page, setPage] = useState('dashboard');

  return (
    <div>
      <nav>
        <button onClick={() => setPage('dashboard')}>Dashboard</button>
        <button onClick={() => setPage('profile')}>Profile</button>
        <button onClick={() => setPage('settings')}>Settings</button>
      </nav>

      {/* Step 3: Suspense provides a fallback while chunk loads */}
      <Suspense fallback={<LoadingSpinner />}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'profile'   && <Profile />}
        {page === 'settings'  && <Settings />}
        {/* First time each is rendered: network request fires
            Subsequent renders: instant from cache */}
      </Suspense>
    </div>
  );
}

// ─── With React Router ───────────────────────────────────────────
import { Routes, Route } from 'react-router-dom';

// Lazy-load route components — very common pattern
const Home    = lazy(() => import('./routes/Home'));
const About   = lazy(() => import('./routes/About'));
const Contact = lazy(() => import('./routes/Contact'));

function AppRouter() {
  return (
    // Single Suspense wraps all routes
    // Shows fallback whenever a route chunk is loading
    <Suspense fallback={<div>Loading page...</div>}>
      <Routes>
        <Route path="/"        element={<Home />} />
        <Route path="/about"   element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </Suspense>
  );
}

// ─── Nested Suspense boundaries ──────────────────────────────────
// You can have multiple Suspense boundaries for granular control
const HeavyChart   = lazy(() => import('./components/HeavyChart'));
const DataTable    = lazy(() => import('./components/DataTable'));

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* Each section has its own fallback — they load independently */}
      <Suspense fallback={<div>Loading chart...</div>}>
        <HeavyChart /> {/* chart.js chunk loads independently */}
      </Suspense>

      <Suspense fallback={<div>Loading table...</div>}>
        <DataTable />  {/* table chunk loads independently */}
      </Suspense>
    </div>
  );
}

// ─── Preloading chunks (advanced) ────────────────────────────────
// Problem: user clicks button → waits for download → slow feel
// Solution: preload the chunk on HOVER (anticipate user intent)

const AdminPanel = lazy(() => import('./AdminPanel'));

// Trigger the import() on hover — chunk starts downloading
// before user actually clicks → instant when they do click
const preloadAdminPanel = () => import('./AdminPanel');

function NavBar() {
  return (
    <button
      onMouseEnter={preloadAdminPanel} // preload on hover
      onClick={() => navigate('/admin')}
    >
      Admin
    </button>
  );
}

// ─── What lazy() wraps must export a DEFAULT export ──────────────
// pages/Dashboard.jsx:
export default function Dashboard() { // ← must be DEFAULT export
  return <h1>Dashboard Page</h1>;
}
// If the module uses named exports only, wrap it:
const NamedComp = lazy(() =>
  import('./NamedExport').then(module => ({ default: module.NamedExport }))
  //                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                     Force it to look like a default export
);
```

---

#### Step-by-Step Explanation

| Step | Code | Why |
|------|------|-----|
| 1 | `lazy(() => import('./Page'))` | Factory function defers the `import()` call until component is needed |
| 2 | `import('./Page')` | Dynamic import — signals bundler to create a separate JS chunk at build time |
| 3 | Component renders for first time | React detects it's lazy → calls the factory → `import()` fires → network request |
| 4 | Promise thrown | React.lazy throws the pending Promise up to the nearest Suspense boundary |
| 5 | `Suspense` catches the throw | Shows `fallback` while awaiting the Promise |
| 6 | Module downloads + resolves | Suspense re-triggers render — now the component exists → renders it |
| 7 | Subsequent renders | Module is cached → `import()` resolves instantly from module cache |
| 8 | `export default` requirement | `React.lazy` reads `module.default` — named exports need manual mapping |

---

#### Bundle Size Impact

```
WITHOUT code splitting:
  main.js  →  2.4MB  (entire app in one file)
  
  User visits homepage:
  → Downloads 2.4MB even if they only use 10% of the app

WITH code splitting:
  main.js      →  350KB  (core + current route)
  dashboard.js →  280KB  (lazy)
  profile.js   →  95KB   (lazy)
  settings.js  →  120KB  (lazy)
  
  User visits homepage:
  → Downloads only 350KB immediately ✅
  → dashboard.js downloads only when /dashboard is visited
```

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|-----------|-----------|-----|
| Chunk load (first render) | O(1) network | One HTTP request per chunk; browser caches it |
| Chunk load (subsequent) | O(1) | Module registry cache — no network; instant |
| `lazy()` factory call | O(1) | Just creates a wrapper object |
| Suspense boundary check | O(1) | React checks up the tree for nearest Suspense |
| Initial bundle size savings | O(N → K) | N = full app size; K = only what's needed for current route |

---

### Q16. What causes unnecessary re-renders and how do you diagnose them using React DevTools?

---

#### ELI5 (Explain Like I'm 5)

> Imagine your whole office stands up every time ANYONE gets an email. That's a terrible office.
>
> Good offices: only the **person who got the email** stands up.
>
> Unnecessary re-renders are your whole office standing up. React DevTools' Profiler is the camera that shows you **who stood up, why, and how often**.

---

#### Flowchart — Root Causes of Unnecessary Re-renders

```
TOP CAUSES:
──────────────────────────────────────────────────────────────────
  1. UNSTABLE REFERENCES
     Parent re-renders
          │
          └── Creates new {} or [] or () => {} inline
                    │
                    └── Child gets "new" prop every time
                              │
                              └── React.memo can't help
                                  → Child always re-renders

  2. CONTEXT OVER-SHARING
     Single large context value changes
          │
          └── ALL consumers re-render
              even if they only use one tiny slice

  3. STATE TOO HIGH
     State lives in a parent/grandparent
          │
          └── Every state change re-renders the entire subtree
              not just the component that "owns" the data

  4. MISSING MEMOIZATION
     Expensive derived data re-computed every render
          │
          └── Component does heavy work unnecessarily

  5. WRONG useEffect DEPS
     useEffect with wrong/missing deps
          │
          └── Effect re-runs → triggers setState → triggers re-render
              causing render loops or excessive renders

  6. THIRD-PARTY SUBSCRIPTION TRIGGERS
     Redux / Zustand selector re-renders component
          │
          └── Selector returns new object {} each time
              even if the DATA inside is the same
```

---

#### Code Example — Causes + Fixes

```jsx
import React, { useState, useCallback, useMemo, createContext, useContext, memo } from 'react';

// ─── CAUSE 1: Inline functions and objects ────────────────────────
const Item = memo(({ onClick, style }) => {
  console.log('Item rendered');
  return <div style={style} onClick={onClick}>Click me</div>;
});

function BadParent() {
  const [count, setCount] = useState(0);
  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>

      {/* ❌ New function + new object on EVERY render */}
      <Item
        onClick={() => console.log('clicked')}  // new fn every render
        style={{ color: 'blue' }}               // new obj every render
      />
    </>
  );
}

function GoodParent() {
  const [count, setCount] = useState(0);

  // ✅ Stable references
  const handleClick = useCallback(() => console.log('clicked'), []);
  const itemStyle   = useMemo(() => ({ color: 'blue' }), []);

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <Item onClick={handleClick} style={itemStyle} /> {/* ✅ memo works */}
    </>
  );
}

// ─── CAUSE 2: Context over-sharing ───────────────────────────────
// ❌ BAD: everything in one context — any change re-renders ALL consumers
const AppContext = createContext(null);

function BadApp() {
  const [user, setUser]     = useState({ name: 'Alice' });
  const [theme, setTheme]   = useState('light');
  const [cart, setCart]     = useState([]);

  return (
    // One big context — cart update → UserDisplay re-renders (unnecessarily)
    <AppContext.Provider value={{ user, setUser, theme, setTheme, cart, setCart }}>
      <UserDisplay />
      <ThemeToggle />
      <CartIcon />
    </AppContext.Provider>
  );
}

// ✅ GOOD: split contexts — each consumer only re-renders for its own data
const UserContext  = createContext(null);
const ThemeContext = createContext(null);
const CartContext  = createContext(null);

function GoodApp() {
  const [user, setUser]   = useState({ name: 'Alice' });
  const [theme, setTheme] = useState('light');
  const [cart, setCart]   = useState([]);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <ThemeContext.Provider value={{ theme, setTheme }}>
        <CartContext.Provider value={{ cart, setCart }}>
          {/* Now UserDisplay only re-renders on user changes */}
          <UserDisplay />
          <ThemeToggle />
          <CartIcon />
        </CartContext.Provider>
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}

// ─── CAUSE 3: State too high — lift down or colocate ─────────────
// ❌ BAD: modal open state in App → whole tree re-renders on open/close
function BadApp2() {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <div>
      <HeavyDashboard /> {/* ← re-renders whenever modalOpen changes */}
      <button onClick={() => setModalOpen(true)}>Open</button>
      {modalOpen && <Modal onClose={() => setModalOpen(false)} />}
    </div>
  );
}

// ✅ GOOD: colocate state with the component that owns it
function GoodApp2() {
  return (
    <div>
      <HeavyDashboard /> {/* never re-renders due to modal */}
      <ModalController /> {/* state lives HERE, only this subtree re-renders */}
    </div>
  );
}

function ModalController() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && <Modal onClose={() => setOpen(false)} />}
    </>
  );
}

// ─── DIAGNOSIS: Using React DevTools Profiler ─────────────────────
// No code to write — but here's the SEQUENCE:
// 
// 1. Open React DevTools → "Profiler" tab
// 2. Click "Record" (circle icon)
// 3. Interact with your app (click buttons, type, etc.)
// 4. Click "Stop"
// 5. See the FLAME GRAPH:
//    - Grey bars = didn't re-render
//    - Coloured bars = DID re-render (darker = slower)
// 6. Click any coloured bar → see WHY it re-rendered:
//    "Why did this render?" panel shows:
//    → "Props changed: onClick"
//    → "State changed"
//    → "Context changed"
// 7. Look for components that re-render on EVERY interaction
//    when they shouldn't → those are your targets

// ─── DIAGNOSIS: "Why did you render" library ─────────────────────
// npm install @welldone-software/why-did-you-render
// Add to entry file (development only):
import './wdyr'; // wdyr.js:

// wdyr.js:
import React from 'react';
import whyDidYouRender from '@welldone-software/why-did-you-render';
if (process.env.NODE_ENV === 'development') {
  whyDidYouRender(React, {
    trackAllPureComponents: true,
    // Logs to console: "Re-rendered because props.onClick changed"
    // Shows old vs new value for each changed prop
  });
}

// ─── DIAGNOSIS: console.count trick ──────────────────────────────
function MyComponent({ data }) {
  console.count('MyComponent render'); // quick way to count renders
  return <div>{data.value}</div>;
}
```

---

#### Step-by-Step Diagnosis Flow

```
PROFILER WORKFLOW:
─────────────────────────────────────────────────────────
Step 1: Record  →  interact with feature  →  Stop

Step 2: Flame graph — find dark/wide bars (= slow + many renders)
         ↓
Step 3: Click the component bar
         ↓
Step 4: Check "Why did this render?"
         ↓
Step 5: Match cause to fix:

  "Props changed: onClick"     → useCallback for that handler
  "Props changed: style"       → useMemo for that object
  "Context changed"            → split context or memoize value
  "State changed: parentState" → colocate that state lower
  "Hook 2 changed"             → check useEffect deps causing loop
```

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|-----------|-----------|-----|
| Unnecessary re-render | O(subtree) | React renders the whole subtree below the re-rendering component |
| Profiler recording | O(n renders) | Collects timing for each render during recording |
| `React.memo` comparison | O(P) | P = number of props — prevents the O(subtree) cost |
| Context split (K contexts) | O(K) | Each context update only propagates to its consumers |
| `useCallback`/`useMemo` dep check | O(D) | D = dependencies — cheap prevention of expensive re-renders |

---

### Q17. What is the difference between `React.memo` and `PureComponent`?

---

#### ELI5 (Explain Like I'm 5)

> Both are bouncers at a party who check: "Did anything actually change? If not, don't let a re-render in."
>
> **`PureComponent`** is the old-school bouncer — only works for **class components**. He checks: "Did any props or state change?" (shallow compare both).
>
> **`React.memo`** is the modern bouncer — only works for **function components**. She checks: "Did any props change?" (shallow compare props only).
>
> Both use shallow equality. Neither does deep comparison.

---

#### Flowchart — Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│                       PureComponent                             │
│                                                                 │
│  Type: Class component                                          │
│  Compares: props AND state (both shallow)                       │
│  How: implements shouldComponentUpdate automatically            │
│                                                                 │
│  Re-render if:                                                  │
│    prevProps !== nextProps (shallow)  OR                        │
│    prevState !== nextState (shallow)                            │
│                                                                 │
│  Skip re-render if:                                             │
│    prevProps === nextProps (shallow) AND                        │
│    prevState === nextState (shallow)                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        React.memo                               │
│                                                                 │
│  Type: Function component wrapper (HOC)                         │
│  Compares: props ONLY (doesn't know about internal state)       │
│  How: wraps the component, runs comparison before render        │
│                                                                 │
│  Re-render if:                                                  │
│    prevProps !== nextProps (shallow)                            │
│    OR parent triggers with same props (always re-renders        │
│    if no memo)                                                  │
│    OR internal state/context changes (always re-render)         │
│                                                                 │
│  Skip re-render if:                                             │
│    prevProps === nextProps (shallow)                            │
│    (internal state/context changes still cause re-render)       │
└─────────────────────────────────────────────────────────────────┘

Side-by-side:
────────────────────────────────────────────────────────────────
  Feature                 PureComponent       React.memo
  ─────────────────────   ─────────────────   ──────────────────
  Component type          Class               Function
  Compares props          ✅ (shallow)        ✅ (shallow)
  Compares state          ✅ (shallow)        ❌ (state is internal)
  Custom comparison       shouldComponentUpdate  areEqual() param
  Context changes bypass  ✅ bypasses both    ✅ bypasses both
  React 18 compatible     ✅ (but discouraged) ✅ (preferred)
  Can use hooks           ❌                  ✅
```

---

#### Code Example — Both in Action

```jsx
import React, { Component, PureComponent, memo, useState } from 'react';

// ── CLASS: Regular Component vs PureComponent ─────────────────────

class RegularComponent extends Component {
  render() {
    console.log('RegularComponent rendered');
    // ❌ Re-renders EVERY TIME parent re-renders
    // Even if props.name hasn't changed
    return <div>{this.props.name}</div>;
  }
}

class PureComp extends PureComponent {
  render() {
    console.log('PureComp rendered');
    // ✅ Skips re-render if props.name AND state haven't changed
    // PureComponent auto-implements shouldComponentUpdate with shallow compare
    return <div>{this.props.name}</div>;
  }
}

// Equivalent of PureComponent using shouldComponentUpdate manually:
class ManualOptimized extends Component {
  shouldComponentUpdate(nextProps, nextState) {
    // PureComponent does exactly this — shallow compare of all keys
    return (
      nextProps.name !== this.props.name ||
      nextState.count !== this.state.count
    );
    // return true  = DO re-render
    // return false = SKIP re-render
  }
  render() {
    return <div>{this.props.name}</div>;
  }
}

// ── FUNCTION: React.memo ──────────────────────────────────────────

// Basic usage
const MemoizedFn = memo(function UserCard({ name, age }) {
  console.log('UserCard rendered');
  return <div>{name} — {age}</div>;
});
// Re-renders if name or age reference changes (shallow compare)
// Skips re-render if name and age are same primitive values

// With custom comparison (like shouldComponentUpdate for function components)
const SmartMemoized = memo(
  function ComplexCard({ user, metadata }) {
    return <div>{user.name}</div>;
  },
  (prevProps, nextProps) => {
    // Return TRUE  → props are EQUAL → SKIP re-render
    // Return FALSE → props DIFFER   → DO re-render
    // Only re-render if user.id or user.name changed
    // (ignore metadata changes entirely)
    return (
      prevProps.user.id   === nextProps.user.id &&
      prevProps.user.name === nextProps.user.name
    );
    // ⚠️ Custom comparator is powerful but risky:
    // If you miss a prop that SHOULD cause re-render, you get stale UI
  }
);

// ── Demonstrating the difference in state comparison ─────────────
class PureWithState extends PureComponent {
  state = { count: 0 };
  render() {
    return (
      <div>
        <p>Count: {this.state.count}</p>
        <p>Prop: {this.props.label}</p>
        {/* PureComponent also shallow-compares STATE
            → this.setState({ count: 0 }) when count is already 0
            → PureComponent skips re-render! */}
        <button onClick={() => this.setState({ count: this.state.count + 1 })}>
          Increment
        </button>
      </div>
    );
  }
}

function MemoWithState({ label }) {
  // React.memo does NOT compare internal state
  // Internal state change → ALWAYS triggers re-render
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <p>Prop: {label}</p>
      {/* setCount(0) when count is already 0?
          → React.memo cannot help — state is internal
          → React 18 actually optimises this: bails out of re-render
            if new state === old state (for primitive values) */}
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
    </div>
  );
}

// ── Why PureComponent is DISCOURAGED in modern React ─────────────
// 1. Class components can't use hooks (useState, useEffect, etc.)
// 2. Class components have more boilerplate
// 3. React team recommends function components for all new code
// 4. React.memo + useCallback/useMemo achieves the same and more

// Rule: Use React.memo for function components (modern)
//       PureComponent only if maintaining legacy class component code
```

---

#### Step-by-Step Explanation

| Step | Code | Why |
|------|------|-----|
| 1 | `extends PureComponent` | React auto-implements `shouldComponentUpdate` with shallow prop + state compare |
| 2 | `shouldComponentUpdate(nextProps, nextState)` | Manual version of PureComponent; `return false` to skip render |
| 3 | `memo(Component)` | Wraps function component; adds prop comparison before each render |
| 4 | `memo(Comp, areEqual)` | Custom comparator: `true` = equal = skip render; `false` = render |
| 5 | Internal state changes | `React.memo` never blocks internal state/context changes — both still re-render |
| 6 | Shallow comparison | Only top-level keys are compared with `Object.is` — nested objects by reference |

---

#### The Shallow Compare Visualized

```
props = { user: { name: 'Alice' }, count: 5 }

Shallow compare checks:
  props.user  → same reference? (Object.is)
  props.count → same value? (Object.is)

  Object.is({ name: 'Alice' }, { name: 'Alice' }) → FALSE ❌
  (different objects, even if content is identical)

  Object.is(5, 5) → TRUE ✅

So: if parent does <Comp user={{ name: 'Alice' }} count={5} />
    on every render (inline object), PureComponent / memo BOTH fail.
```

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|-----------|-----------|-----|
| Shallow comparison (P props) | O(P) | Each prop key checked with `Object.is` |
| Re-render skipped | O(1) | No work done if comparison says equal |
| `shouldComponentUpdate` | O(P + S) | P props + S state keys — also compares state |
| `React.memo` areEqual | O(custom) | Depends on your comparator logic |
| Memory overhead | O(P) | Previous props stored for next comparison |

---

## End of Section: REACT — Performance (Q11–Q17)

---

## REACT — Patterns

---

### Q18. Explain the Container/Presentational pattern. Is it still relevant with hooks?

---

#### ELI5 (Explain Like I'm 5)

> Imagine a restaurant. The **waiter** (Presentational) just takes your order and brings your food — they don't cook anything. The **kitchen** (Container) does all the cooking and logic.
>
> Container/Presentational splits React components the same way:
> - **Presentational** = "dumb" UI components — just receive props, know nothing about data fetching or business logic.
> - **Container** = "smart" data components — handle API calls, state, and pass data down.
>
> With hooks, you can pull the "kitchen logic" into a custom hook instead of a container component — so the pattern is less mandatory, but the *principle* (separate concerns) is still very relevant.

---

#### Flowchart

```
WITHOUT hooks (classic pattern):
─────────────────────────────────────────────────────────────
  <UserListContainer>               ← Container: fetches data,
       │                               manages loading/error state
       │  passes: { users, loading, error }
       ▼
  <UserList users={...} />          ← Presentational: pure UI
       │
       ├── <UserCard user={...} />  ← Also Presentational
       └── <Spinner />              ← Also Presentational


WITH hooks (modern evolution):
─────────────────────────────────────────────────────────────
  useUserList()                     ← Custom hook replaces Container
       │  returns: { users, loading, error }
       │
  <UserList />                      ← Component uses hook directly
       │                               OR receives data via props
       ├── <UserCard user={...} />
       └── <Spinner />

  The principle (logic vs UI separation) remains.
  The "Container component" is replaced by a custom hook.
```

---

#### Code Example

```jsx
// ════════════════════════════════════════════════════════════════
// CLASSIC PATTERN — Container + Presentational
// ════════════════════════════════════════════════════════════════

// ── Presentational: knows ONLY about UI ──────────────────────────
// Props are its entire world. No API calls, no state (or minimal UI state).
function UserList({ users, loading, error, onSelect }) {
  // Step 1: Handle loading state with a prop — doesn't know HOW data loads
  if (loading) return <div className="spinner">Loading...</div>;

  // Step 2: Handle error state with a prop — doesn't know WHY it errored
  if (error) return <div className="error">Error: {error.message}</div>;

  // Step 3: Render the data it was given — pure mapping prop → UI
  return (
    <ul>
      {users.map(user => (
        <UserCard key={user.id} user={user} onSelect={onSelect} />
      ))}
    </ul>
  );
}

// Also presentational — no logic, just display
function UserCard({ user, onSelect }) {
  return (
    <li onClick={() => onSelect(user.id)}>
      <img src={user.avatar} alt={user.name} />
      <span>{user.name}</span>
    </li>
  );
}

// ── Container: knows ONLY about data/logic ────────────────────────
// Its render method is almost always just delegating to Presentational
class UserListContainer extends React.Component {
  state = { users: [], loading: true, error: null };

  async componentDidMount() {
    try {
      // Step 4: Container handles ALL data fetching
      const res  = await fetch('/api/users');
      const data = await res.json();
      this.setState({ users: data, loading: false });
    } catch (err) {
      this.setState({ error: err, loading: false });
    }
  }

  handleSelect = (userId) => {
    // Container handles business logic
    console.log('Selected:', userId);
  };

  render() {
    const { users, loading, error } = this.state;
    // Step 5: Container just passes data to Presentational
    return (
      <UserList
        users={users}
        loading={loading}
        error={error}
        onSelect={this.handleSelect}
      />
    );
  }
}

// ════════════════════════════════════════════════════════════════
// MODERN PATTERN — Custom Hook replaces Container component
// ════════════════════════════════════════════════════════════════

// Step 6: Extract container logic into a custom hook
// The hook IS the "container" — just not a component anymore
function useUserList() {
  const [users,   setUsers]   = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error,   setError]   = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;

    fetch('/api/users')
      .then(r => r.json())
      .then(data => { if (!cancelled) { setUsers(data); setLoading(false); }})
      .catch(err => { if (!cancelled) { setError(err);  setLoading(false); }});

    return () => { cancelled = true; }; // cleanup on unmount
  }, []);

  const handleSelect = React.useCallback((userId) => {
    console.log('Selected:', userId);
  }, []);

  return { users, loading, error, onSelect: handleSelect };
}

// Step 7: Presentational component is UNCHANGED —
// it still just renders props. Now it can get them from a hook OR a parent.
function ModernUserList() {
  // Option A: component uses hook directly (self-contained)
  const { users, loading, error, onSelect } = useUserList();

  return <UserList users={users} loading={loading} error={error} onSelect={onSelect} />;
}

// Option B: keep UserList pure (props only) for easier testing
// and have a wrapper use the hook — same separation, cleaner
function UserListPage() {
  const data = useUserList(); // all logic in hook
  return <UserList {...data} />; // UserList stays "dumb" and testable
}

// ─── Why this is still relevant ──────────────────────────────────
// ✅ Testability: Presentational components are pure functions → easy unit tests
// ✅ Reusability: Same UserList can be fed by REST, GraphQL, or mock data
// ✅ Separation: UI designers can work on Presentational without touching logic
// ✅ Storybook: Presentational components are trivial to document/preview
```

---

#### Step-by-Step Explanation

| Step | Code | Why |
|------|------|-----|
| 1–3 | `UserList` receives props only | Pure function of props — deterministic, trivially testable |
| 4 | `componentDidMount` fetches | Container owns all side effects — Presentational is unaware |
| 5 | Container renders `<UserList {...state}>` | Container's render is just a pass-through — thin glue layer |
| 6 | `useUserList()` hook | Replicates all Container logic without a wrapper component in the tree |
| 7 | `<UserList {...data} />` | Presentational component unchanged — still pure — now consumes hook via parent |

---

#### Is It Still Relevant?

```
Classic Container component  →  largely REPLACED by custom hooks
Presentational component     →  still 100% relevant and recommended

The PRINCIPLE lives on:
  "Separate data/logic concerns from UI rendering concerns"
  → Just express it with custom hooks instead of wrapper components
```

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|-----------|-----------|-----|
| Presentational render | O(N) | N = number of items to render |
| Hook data fetch | O(1) | Single async operation, cached after first load |
| Component tree depth | O(1) extra | Modern hook removes the Container wrapper component from the tree |

---

### Q19. What is a Higher Order Component? Give a real production use case.

---

#### ELI5 (Explain Like I'm 5)

> A Higher Order Component (HOC) is like a **phone case factory**. You put any phone in (any component), and it comes out with extra features — like a waterproof case or a battery pack.
>
> The factory doesn't care what phone model you put in. It just wraps it and adds features. Your phone still works exactly the same — it just has new abilities.
>
> HOC: a function that **takes a component** and **returns a new, enhanced component**.

---

#### Flowchart

```
HOC Definition:
─────────────────────────────────────────────────────────
  withFeature(WrappedComponent)
       │
       └── returns EnhancedComponent
                  │
                  ├── Adds: extra props, lifecycle, logic
                  ├── Renders: <WrappedComponent {...props} {...extras} />
                  └── Original component is untouched

Flow:
  <EnhancedComponent userId="123" />
         │
         ▼  HOC intercepts render
  HOC logic runs (fetch, auth check, logging...)
         │
         ▼
  <WrappedComponent userId="123" extraProp="from HOC" />
         │
         ▼
  Original component renders normally

HOC Composition:
  const Enhanced = withAuth(withLogging(withTheme(Button)));
  → Applied right-to-left: Theme → Logging → Auth → Button
  → Each HOC wraps the previous result
```

---

#### Code Example — Real Production Use Cases

```jsx
import React, { useEffect, useState, useRef } from 'react';

// ════════════════════════════════════════════════════════════════
// USE CASE 1: Authentication Guard (most common production HOC)
// ════════════════════════════════════════════════════════════════

// Step 1: HOC is a function that takes a component
function withAuth(WrappedComponent) {
  // Step 2: Returns a NEW component (never mutate WrappedComponent!)
  function AuthGuard(props) {
    const { currentUser, isLoading } = useAuthContext(); // from your auth context

    // Step 3: HOC adds logic BEFORE deciding to render WrappedComponent
    if (isLoading) return <FullPageSpinner />;

    if (!currentUser) {
      // Redirect to login — WrappedComponent never renders
      return <Navigate to="/login" state={{ from: props.location }} replace />;
    }

    // Step 4: Pass through ALL original props unchanged
    // The wrapped component has NO idea it was guarded
    return <WrappedComponent {...props} />;
  }

  // Step 5: Set a display name for React DevTools readability
  AuthGuard.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name})`;

  return AuthGuard;
}

// Usage: wrap any route-level component
const ProtectedDashboard = withAuth(Dashboard);
const ProtectedProfile   = withAuth(Profile);
// Now <ProtectedDashboard /> will redirect to /login if not authenticated


// ════════════════════════════════════════════════════════════════
// USE CASE 2: Feature Flag Gate
// ════════════════════════════════════════════════════════════════

function withFeatureFlag(WrappedComponent, flagName, Fallback = null) {
  function FeatureFlaggedComponent(props) {
    const flags  = useFeatureFlags(); // custom hook that reads from LaunchDarkly/etc.
    const isOn   = flags[flagName];

    // If flag is OFF, show fallback (or nothing)
    if (!isOn) return Fallback ? <Fallback {...props} /> : null;

    return <WrappedComponent {...props} />;
  }

  FeatureFlaggedComponent.displayName = `withFeatureFlag(${flagName})`;
  return FeatureFlaggedComponent;
}

// Usage: whole component gated by a feature flag
const NewCheckout = withFeatureFlag(CheckoutV2, 'new-checkout-flow', CheckoutV1);
// LaunchDarkly says flag is OFF → CheckoutV1 renders
// LaunchDarkly says flag is ON  → CheckoutV2 renders


// ════════════════════════════════════════════════════════════════
// USE CASE 3: Analytics / Impression Tracking
// ════════════════════════════════════════════════════════════════

function withImpressionTracking(WrappedComponent, trackingId) {
  function TrackedComponent(props) {
    const ref = useRef(null);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;

      // IntersectionObserver fires when element enters viewport
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            // Fire analytics event — WrappedComponent has no idea this is happening
            analytics.track('impression', {
              component: trackingId,
              timestamp:  Date.now(),
            });
            observer.disconnect(); // fire once only
          }
        },
        { threshold: 0.5 } // 50% visible counts as an impression
      );

      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    // Inject a ref — WrappedComponent must accept a forwarded ref
    // OR wrap in a div (simpler but adds a DOM node)
    return (
      <div ref={ref}>
        <WrappedComponent {...props} />
      </div>
    );
  }

  TrackedComponent.displayName = `withImpressionTracking(${trackingId})`;
  return TrackedComponent;
}

// Usage: any promotional component gets auto-tracked
const TrackedBanner      = withImpressionTracking(PromoBanner,    'promo-banner');
const TrackedProductCard = withImpressionTracking(ProductCard,    'product-card');


// ════════════════════════════════════════════════════════════════
// COMPOSING MULTIPLE HOCs
// ════════════════════════════════════════════════════════════════

// Manual composition — reads right to left (confusing)
const Enhanced = withAuth(withFeatureFlag(withImpressionTracking(Dashboard, 'dash'), 'v2-dash'));

// Use a compose utility (lodash, redux, or roll your own)
const compose = (...fns) => x => fns.reduceRight((acc, fn) => fn(acc), x);

const EnhancedDashboard = compose(
  withAuth,
  comp => withFeatureFlag(comp, 'v2-dashboard'),
  comp => withImpressionTracking(comp, 'dashboard'),
)(Dashboard);
// Reads top-to-bottom: Auth → FeatureFlag → ImpressionTracking → Dashboard


// ════════════════════════════════════════════════════════════════
// HOC RULES (to avoid bugs)
// ════════════════════════════════════════════════════════════════

// ❌ DON'T: create HOC inside a component — new component type every render!
function BadParent() {
  const WrappedList = withAuth(List); // ← NEW type every render → unmounts/remounts
  return <WrappedList />;
}

// ✅ DO: define HOCs at MODULE level, outside components
const WrappedList = withAuth(List); // defined once, stable type
function GoodParent() {
  return <WrappedList />;
}
```

---

#### Step-by-Step Explanation

| Step | Code | Why |
|------|------|-----|
| 1 | `function withAuth(WrappedComponent)` | Function that accepts a component — this is the HOC signature |
| 2 | `function AuthGuard(props)` | Returns a new component — the enhanced version |
| 3 | Logic before render | HOC runs checks (auth, flags) before deciding to render original |
| 4 | `<WrappedComponent {...props} />` | Pass all original props through — original component is transparent to HOC |
| 5 | `displayName` | Makes React DevTools show `withAuth(Dashboard)` instead of `AuthGuard` |
| 6 | `compose(...)` | Applies multiple HOCs cleanly — avoids deeply nested `withA(withB(withC(...)))` |
| 7 | HOC at module level | Creating HOC inside component == new component type every render == remount bug |

---

#### HOC vs Custom Hook — When to Use Which

```
Use HOC when:
  ✅ Need to conditionally render or redirect (auth guard)
  ✅ Need to inject JSX wrapper around component (impression tracking div)
  ✅ Working with class components (hooks don't work there)
  ✅ Need composable component-level cross-cutting concerns

Use Custom Hook when:
  ✅ Just need to share logic/state (no JSX wrapping needed)
  ✅ Working exclusively with function components
  ✅ Simpler to debug (hook call chain vs component tree)
  ✅ TypeScript inference is better
```

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|-----------|-----------|-----|
| HOC wrapping at module level | O(1) | Creates one new component type once |
| HOC render overhead | O(1) | Just a thin wrapper render, then delegates |
| Composed HOCs (K layers) | O(K) renders | Each HOC in the chain runs its render logic |
| `IntersectionObserver` setup | O(1) | Single observer per element |

---

### Q20. How do Compound Components share state without prop drilling?

---

#### ELI5 (Explain Like I'm 5)

> Think of a `<select>` and `<option>` in HTML. You never pass `selectedValue` down to each `<option>`. The browser handles that internally. Yet `<option>` knows when it's selected.
>
> Compound Components copy this idea in React. A parent component holds state in a **shared Context**, and all child sub-components read from that context directly — no prop drilling needed.
>
> It's like a walkie-talkie channel: parent sets the channel, all children tune in automatically.

---

#### Flowchart

```
WITHOUT compound components (prop drilling):
────────────────────────────────────────────────────────
  <Tabs activeTab={activeTab} onChange={setActiveTab}>
    <TabList activeTab={activeTab} onChange={setActiveTab}>  ← drilling
      <Tab id="a" activeTab={activeTab} onChange={setActiveTab} />  ← drilling
      <Tab id="b" activeTab={activeTab} onChange={setActiveTab} />
    </TabList>
    <TabPanels activeTab={activeTab}>  ← drilling
      <TabPanel id="a" activeTab={activeTab} />  ← drilling
    </TabPanels>
  </Tabs>

WITH compound components (implicit state sharing via Context):
────────────────────────────────────────────────────────
  <Tabs defaultTab="a">           ← holds state internally
    <TabList>                     ← reads from context (no props needed)
      <Tab id="a">Tab A</Tab>     ← reads activeTab from context
      <Tab id="b">Tab B</Tab>
    </TabList>
    <TabPanels>
      <TabPanel id="a">Content A</TabPanel>
      <TabPanel id="b">Content B</TabPanel>
    </TabPanels>
  </Tabs>
  ← Each child automatically gets what it needs
```

---

#### Code Example — Full Tabs Compound Component

```jsx
import React, {
  createContext, useContext, useState, useId
} from 'react';

// ── Step 1: Create a Context for the shared state ─────────────────
// This is the "walkie-talkie channel"
const TabsContext = createContext(null);

// Helper hook — child components use this to read shared state
// Also throws a clear error if child is used outside <Tabs>
function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error('Tab sub-components must be used inside <Tabs>');
  }
  return ctx;
}

// ── Step 2: Parent component — holds ALL shared state ─────────────
function Tabs({ children, defaultTab }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Step 3: Provide state + setter through context
  // All child sub-components read from here — NO prop drilling
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">
        {children}
      </div>
    </TabsContext.Provider>
  );
}

// ── Step 4: Sub-components read from context, not props ───────────
function TabList({ children }) {
  // TabList doesn't need activeTab or setActiveTab as props
  // It just passes through children — they'll read context themselves
  return (
    <div role="tablist" className="tab-list">
      {children}
    </div>
  );
}

function Tab({ id, children }) {
  // Step 5: Tab reads activeTab directly from context
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === id;

  return (
    <button
      role="tab"
      aria-selected={isActive}       // accessibility
      tabIndex={isActive ? 0 : -1}   // keyboard nav
      className={isActive ? 'tab tab--active' : 'tab'}
      onClick={() => setActiveTab(id)} // updates shared state via context
    >
      {children}
    </button>
  );
}

function TabPanels({ children }) {
  // Passes children through unchanged — children read context themselves
  return <div className="tab-panels">{children}</div>;
}

function TabPanel({ id, children }) {
  // Step 6: TabPanel reads activeTab to know if it should show
  const { activeTab } = useTabsContext();

  if (activeTab !== id) return null; // hide when not active

  return (
    <div role="tabpanel" className="tab-panel">
      {children}
    </div>
  );
}

// ── Step 7: Attach sub-components as static properties ────────────
// This is idiomatic for compound components — groups them under one namespace
Tabs.TabList   = TabList;
Tabs.Tab       = Tab;
Tabs.TabPanels = TabPanels;
Tabs.TabPanel  = TabPanel;

// ── Usage — clean, no prop drilling ──────────────────────────────
function App() {
  return (
    <Tabs defaultTab="overview">
      <Tabs.TabList>
        <Tabs.Tab id="overview">Overview</Tabs.Tab>
        <Tabs.Tab id="reviews">Reviews</Tabs.Tab>
        <Tabs.Tab id="specs">Specs</Tabs.Tab>
      </Tabs.TabList>

      <Tabs.TabPanels>
        <Tabs.TabPanel id="overview">
          <p>Product overview content here</p>
        </Tabs.TabPanel>
        <Tabs.TabPanel id="reviews">
          <p>Customer reviews here</p>
        </Tabs.TabPanel>
        <Tabs.TabPanel id="specs">
          <p>Technical specifications here</p>
        </Tabs.TabPanel>
      </Tabs.TabPanels>
    </Tabs>
  );
}

// ── Controlled variant (parent controls active tab) ───────────────
// Compound Components can also be "controlled" (like controlled inputs)
function ControlledTabs({ activeTab, onTabChange, children }) {
  return (
    // If activeTab + onTabChange are provided externally → controlled
    // If not → fall back to internal state (see defaultTab above)
    <TabsContext.Provider value={{ activeTab, setActiveTab: onTabChange }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

// Usage of controlled variant:
function Page() {
  const [tab, setTab] = useState('overview');

  // Parent now controls which tab is active — for URL sync, etc.
  return (
    <ControlledTabs activeTab={tab} onTabChange={setTab}>
      <Tabs.TabList>
        <Tabs.Tab id="overview">Overview</Tabs.Tab>
        <Tabs.Tab id="reviews">Reviews</Tabs.Tab>
      </Tabs.TabList>
      {/* ... */}
    </ControlledTabs>
  );
}
```

---

#### Step-by-Step Explanation

| Step | Code | Why |
|------|------|-----|
| 1 | `createContext(null)` | Creates the shared channel all sub-components will tune into |
| 2 | `useTabsContext()` | Centralizes context access + throws clear error if used outside parent |
| 3 | `TabsContext.Provider value={...}` | Parent injects `activeTab` + `setActiveTab` into context |
| 4 | `TabList` passes children through | No props needed — children find context themselves |
| 5 | `const { activeTab } = useTabsContext()` | Tab reads active state directly — no prop drilling |
| 6 | `if (activeTab !== id) return null` | TabPanel renders only when it's the active tab |
| 7 | `Tabs.TabList = TabList` | Namespacing — `<Tabs.Tab>` signals it belongs inside `<Tabs>` |

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|-----------|-----------|-----|
| Context read per sub-component | O(1) | Direct context lookup |
| State update (`setActiveTab`) | O(1) | Single state update triggers re-render |
| Re-renders on tab change | O(N) | N = all consumers of TabsContext — can be optimised by splitting context |
| Component tree depth | O(1) | No extra wrapper components needed — children access state directly |

---

### Q21. What is the Render Props pattern? When would you still use it over hooks?

---

#### ELI5 (Explain Like I'm 5)

> Imagine a vending machine that knows how to track what you bought — but doesn't care what it looks like on screen. Instead of having its own display, it hands you a **blank receipt and says "you draw whatever you want."**
>
> Render Props: a component does all the complex logic and **passes the results to a function that YOU provide** to decide how to render. You're in full control of the UI.
>
> With hooks you usually just call the logic in your own component instead of needing someone to hand it to you — but Render Props still shine in a few specific situations.

---

#### Flowchart

```
Render Props pattern:
──────────────────────────────────────────────────────────
  <DataProvider render={(data, loading) => (
    <MyUI data={data} loading={loading} />
  )} />

  DataProvider:
    - owns the logic (fetch, mouse position, resize, etc.)
    - does NOT own the UI
    - calls props.render(state) inside its render method


FLOW:
  <MouseTracker render={({ x, y }) => <Cursor x={x} y={y} />} />
         │
         ▼  MouseTracker tracks mouse internally
  state = { x: 240, y: 150 }
         │
         ▼  calls: props.render({ x: 240, y: 150 })
  Your render function executes
         │
         ▼
  <Cursor x={240} y={150} /> renders on screen

Alternative syntax — "children as function":
  <MouseTracker>
    {({ x, y }) => <Cursor x={x} y={y} />}
  </MouseTracker>
  // props.children is the function — called the same way
```

---

#### Code Example

```jsx
import React, { useState, useEffect, useRef } from 'react';

// ════════════════════════════════════════════════════════════════
// CLASSIC RENDER PROPS — Mouse Position tracker
// ════════════════════════════════════════════════════════════════

class MouseTracker extends React.Component {
  state = { x: 0, y: 0 };

  handleMouseMove = (e) => {
    // Step 1: Component owns logic — tracks mouse internally
    this.setState({ x: e.clientX, y: e.clientY });
  };

  render() {
    // Step 2: Instead of rendering its own UI, calls the render prop
    // with current state — the CALLER decides what to show
    return (
      <div onMouseMove={this.handleMouseMove} style={{ height: '100vh' }}>
        {/* Step 3: Call the function prop, pass logic results */}
        {this.props.render(this.state)}
      </div>
    );
  }
}

// Usage: MouseTracker renders whatever you tell it to
function App() {
  return (
    <MouseTracker
      render={({ x, y }) => (
        // Could be ANYTHING — cursor, tooltip, heatmap, etc.
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none' }}>
          🔵
        </div>
      )}
    />
  );
}

// "Children as function" variant — same pattern, different syntax
function AppChildren() {
  return (
    <MouseTracker>
      {({ x, y }) => <p>Mouse is at ({x}, {y})</p>}
    </MouseTracker>
  );
}

// ════════════════════════════════════════════════════════════════
// MODERN EQUIVALENT — Custom Hook (replaces most render props)
// ════════════════════════════════════════════════════════════════

function useMousePosition() {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handle = (e) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handle);
    return () => window.removeEventListener('mousemove', handle);
  }, []);

  return pos;
}

// Hook usage — cleaner, no nesting, same result
function AppWithHook() {
  const { x, y } = useMousePosition();
  return <p>Mouse is at ({x}, {y})</p>;
}

// ════════════════════════════════════════════════════════════════
// WHEN TO STILL USE RENDER PROPS (over hooks)
// ════════════════════════════════════════════════════════════════

// CASE 1: Animated / transition libraries that need a renderer
// Libraries like Framer Motion, React Spring use this pattern
// because they own the animation state + need to inject props
// into whatever element YOU want to animate

import { Transition } from '@headlessui/react'; // example that uses render props

function DropdownMenu({ open }) {
  return (
    <Transition
      show={open}
      enter="transition-opacity duration-150"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-150"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      {/* Render prop as children — Transition injects transition className */}
      <div>Menu items here</div>
    </Transition>
  );
}

// CASE 2: Inversion of control — when the logic component needs to
// wrap its output in a specific DOM structure (e.g., a scroll container)

class InfiniteScroll extends React.Component {
  state = { items: [], page: 1, loading: false };

  componentDidMount() { this.loadMore(); }

  loadMore = async () => {
    // Logic component owns: scroll detection, page tracking, loading state
    this.setState({ loading: true });
    const newItems = await fetchPage(this.state.page);
    this.setState(s => ({
      items: [...s.items, ...newItems],
      page: s.page + 1,
      loading: false,
    }));
  };

  render() {
    const { items, loading } = this.state;
    return (
      // Logic component owns the scroll container
      <div onScroll={this.handleScroll} style={{ overflow: 'auto', height: 400 }}>
        {/* Caller controls how each item renders */}
        {this.props.children({ items, loading })}
        {loading && <Spinner />}
      </div>
    );
  }
}

// Usage — you decide how items look:
<InfiniteScroll>
  {({ items, loading }) =>
    items.map(item => <ProductCard key={item.id} product={item} />)
  }
</InfiniteScroll>

// CASE 3: Class components (before hooks existed, and legacy codebases)
// HOCs and render props are the only options for class components.
// If you maintain older React code → render props still valid.
```

---

#### Step-by-Step Explanation

| Step | Code | Why |
|------|------|-----|
| 1 | `this.setState({ x, y })` | Logic component tracks mouse internally — UI doesn't know about this |
| 2 | `{this.props.render(this.state)}` | Calls the function prop with current state — inversion of control |
| 3 | `render={({ x, y }) => <div>}` | Caller receives state and decides what to render — full UI flexibility |
| 4 | `children as function` | Same pattern, but uses `props.children` instead of `props.render` |
| 5 | Custom hook replaces it | For function components, hooks achieve the same without nesting |
| 6 | Render props still valid | When logic component must own the DOM wrapper (scroll, transition, etc.) |

---

#### Render Props vs Hooks Decision

```
Use Render Props when:                    Use Custom Hook when:
─────────────────────────────────         ─────────────────────────────────
✅ Logic component must own DOM           ✅ Just sharing logic/state
✅ Transition/animation libraries         ✅ Function components only
✅ Maintaining class component code       ✅ No DOM wrapper needed
✅ Inversion of control over rendering   ✅ Simpler to test and debug
```

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|-----------|-----------|-----|
| Render prop call | O(1) | One function call per render cycle |
| Nesting depth (N render props) | O(N) renders | Each render prop adds one layer of component tree |
| Custom hook equivalent | O(1) | Same logic cost, no extra tree depth |
| Event listener (mousemove) | O(1) setup | Added once, fires at browser rate (~60fps) |

---

### Q22. How does the Provider pattern work? What are its performance pitfalls?

---

#### ELI5 (Explain Like I'm 5)

> Imagine a school loudspeaker. The principal (Provider) broadcasts announcements (state) to everyone in the school (all Consumer components). **Every student hears every announcement** — even math class hears the lunch menu.
>
> The problem: every announcement makes ALL classrooms "react," even if that class doesn't care. That's the performance problem — context updates wake up ALL consumers, even irrelevant ones.

---

#### Flowchart

```
Provider Pattern:
──────────────────────────────────────────────────────────
  <AppProvider>                   ← injects value into context
       │
       ├── <ComponentA />         ← reads context → re-renders on any change
       ├── <ComponentB />         ← reads context → re-renders on any change
       └── <ComponentC />         ← reads context → re-renders on any change
                                     Even if only one value in context changed!

Performance problem — one big context:
──────────────────────────────────────────────────────────

  context value = { user, theme, cart, notifications }
                          │
             user changes (login/logout)
                          │
                          ▼
       ALL consumers re-render — including:
       ThemeToggle (only reads theme — didn't change!) ❌
       CartIcon    (only reads cart  — didn't change!) ❌
       UserAvatar  (reads user — ✅ correct re-render)

Fix — split contexts:
──────────────────────────────────────────────────────────
  <UserProvider>
    <ThemeProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </ThemeProvider>
  </UserProvider>

  User changes → only UserContext consumers re-render ✅
  Theme changes → only ThemeContext consumers re-render ✅
```

---

#### Code Example — Provider Pattern + All Pitfalls + Fixes

```jsx
import React, {
  createContext, useContext, useState, useMemo, useCallback, memo
} from 'react';

// ════════════════════════════════════════════════════════════════
// PITFALL 1: Unstable context value causes all consumers to re-render
// ════════════════════════════════════════════════════════════════

const CartContext = createContext(null);

// ❌ BAD: new object created on EVERY render of CartProvider
function BadCartProvider({ children }) {
  const [items, setItems] = useState([]);

  return (
    // { items, setItems } is a NEW object every render
    // → every CartContext consumer ALWAYS re-renders
    <CartContext.Provider value={{ items, setItems }}>
      {children}
    </CartContext.Provider>
  );
}

// ✅ FIX: memoize the context value
function GoodCartProvider({ children }) {
  const [items, setItems] = useState([]);

  // Step 1: Stabilise the value with useMemo
  // Only creates a new object when `items` actually changes
  const value = useMemo(() => ({ items, setItems }), [items]);
  // setItems from useState is already stable — no dep needed for it

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

// ════════════════════════════════════════════════════════════════
// PITFALL 2: One big context re-renders unrelated components
// ════════════════════════════════════════════════════════════════

// ❌ BAD: all state in one context
const AppContext = createContext(null);

function BadAppProvider({ children }) {
  const [user,          setUser]          = useState(null);
  const [theme,         setTheme]         = useState('light');
  const [notifications, setNotifications] = useState([]);

  // Any change to ANY of these → ALL consumers re-render
  return (
    <AppContext.Provider value={{ user, setUser, theme, setTheme, notifications, setNotifications }}>
      {children}
    </AppContext.Provider>
  );
}

// ✅ FIX: split contexts by concern
const UserContext          = createContext(null);
const ThemeContext         = createContext(null);
const NotificationsContext = createContext(null);

function GoodAppProvider({ children }) {
  const [user,          setUser]          = useState(null);
  const [theme,         setTheme]         = useState('light');
  const [notifications, setNotifications] = useState([]);

  const userValue  = useMemo(() => ({ user, setUser }),                     [user]);
  const themeValue = useMemo(() => ({ theme, setTheme }),                   [theme]);
  const notifValue = useMemo(() => ({ notifications, setNotifications }),   [notifications]);

  // Step 2: Nest providers — each only broadcasts to its own consumers
  return (
    <UserContext.Provider value={userValue}>
      <ThemeContext.Provider value={themeValue}>
        <NotificationsContext.Provider value={notifValue}>
          {children}
        </NotificationsContext.Provider>
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}

// Consumer hooks — clean API
export const useUser          = () => useContext(UserContext);
export const useTheme         = () => useContext(ThemeContext);
export const useNotifications = () => useContext(NotificationsContext);

// ════════════════════════════════════════════════════════════════
// PITFALL 3: Context bypasses React.memo
// ════════════════════════════════════════════════════════════════

// Even if a component is wrapped in React.memo,
// if it reads from context → it re-renders on any context change
const UserAvatar = memo(function UserAvatar() {
  const { user } = useUser(); // ← reads context
  // React.memo only checks PROPS
  // Context changes always bypass memo → UserAvatar re-renders on user change
  return <img src={user?.avatar} alt={user?.name} />;
});

// ════════════════════════════════════════════════════════════════
// PITFALL 4: Reading only part of context still re-renders on all changes
// ════════════════════════════════════════════════════════════════

// If you're stuck with one big context (e.g., Redux-style global store),
// use a selector to avoid re-renders when irrelevant state changes

// With Zustand (handles selectors natively):
const useCartCount = () => useStore(state => state.cart.length);
// Component only re-renders when cart.length changes, not all state

// With Context: implement a "context selector" manually using useRef + subscription
// (this is complex — better to just split contexts)

// ════════════════════════════════════════════════════════════════
// FULL PROVIDER SETUP — production pattern
// ════════════════════════════════════════════════════════════════

// Compose multiple providers cleanly
function AppProviders({ children }) {
  return (
    <GoodAppProvider>
      <GoodCartProvider>
        {children}
      </GoodCartProvider>
    </GoodAppProvider>
  );
}

// In index.jsx / main.jsx:
// <AppProviders><App /></AppProviders>

// ─── Custom hook with error guard ────────────────────────────────
function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
```

---

#### Step-by-Step Explanation

| Step | Code | Why |
|------|------|-----|
| 1 | `value={{ items, setItems }}` inline | New object reference every render → every consumer re-renders even if items unchanged |
| 2 | `useMemo(() => ({ items, setItems }), [items])` | Stable object — consumers only re-render when `items` actually changes |
| 3 | Single big context | One state change cascades to ALL consumers of that context |
| 4 | Split into `UserContext`, `ThemeContext`, etc. | Each context update isolated to only its consumers |
| 5 | `memo` + context read | `React.memo` cannot block context updates — consumer always re-renders |
| 6 | Selector (Zustand) | Subscribe to only the slice you need → no re-render for unrelated state |

---

#### Performance Pitfalls Summary

```
┌────────────────────────┬──────────────────────────────┬──────────────────────────────┐
│ Pitfall                │ Symptom                      │ Fix                          │
├────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ Inline value object    │ All consumers re-render      │ useMemo on context value     │
│ One large context      │ Unrelated components render  │ Split contexts by concern    │
│ memo + context read    │ memo doesn't help            │ Split context or use Zustand │
│ Functions in context   │ New fn ref every render      │ useCallback for functions    │
└────────────────────────┴──────────────────────────────┴──────────────────────────────┘
```

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|-----------|-----------|-----|
| Context read | O(1) | Direct lookup via React internals |
| Context update propagation | O(C) | C = number of consumers — all notified |
| `useMemo` on context value | O(D) check | Dep array comparison to decide if new object needed |
| Split contexts (K contexts) | O(C_k) per update | Only C_k consumers of the changed context re-render |

---

### Q23. What makes a good custom hook? How do you decide when to extract one?

---

#### ELI5 (Explain Like I'm 5)

> A custom hook is like a **power tool you build yourself**. A good power tool has one clear job (drills holes, cuts wood), is safe to use repeatedly, and doesn't break if you move it.
>
> A bad power tool does 10 different things, has side effects you don't expect, and only works in one specific workshop.
>
> Good custom hooks: one clear purpose, easy to test in isolation, predictable inputs/outputs, and usable in any component.

---

#### Flowchart — When to Extract a Custom Hook

```
Decision Tree:
──────────────────────────────────────────────────────────────
  Is the same logic copy-pasted in 2+ components?
       YES → Extract to custom hook ✅

  Does the logic mix concerns (fetch + timer + DOM)?
       YES → Split into multiple focused hooks ✅

  Is the hook body longer than ~30 lines?
       YES → Consider splitting ✅

  Does the component have > 3 useEffect / useState calls?
       YES → likely extractable to hooks ✅

  Is this logic ONLY used once in one place and < 10 lines?
       YES → Keep it inline, don't over-abstract ❌

Rules for GOOD custom hooks:
──────────────────────────────────────────────────────────────
  ✅ Name starts with "use" (React enforces this for lint rules)
  ✅ Single responsibility — one thing done well
  ✅ Returns a stable, predictable interface
  ✅ All side effects cleaned up (return cleanup from useEffect)
  ✅ Works correctly when called multiple times (no global side effects)
  ✅ Dependencies managed correctly (no stale closures)
  ✅ Fully testable with renderHook() from @testing-library/react
```

---

#### Code Example — Bad vs Good Custom Hooks

```jsx
import { useState, useEffect, useCallback, useRef } from 'react';

// ════════════════════════════════════════════════════════════════
// ❌ BAD HOOK — does too many things, leaks, unstable interface
// ════════════════════════════════════════════════════════════════

function useBadDataFetcher(url) {
  // Problem 1: no cleanup — if component unmounts mid-fetch, sets state
  //            on unmounted component → React warning + potential memory leak
  useEffect(() => {
    fetch(url).then(r => r.json()).then(data => setData(data));
    // ← no controller.abort(), no cancellation, no cleanup return
  }, [url]);

  // Problem 2: mixed concerns — timers AND fetching in one hook
  useEffect(() => {
    const id = setInterval(() => fetch(url), 5000); // auto-refresh
    // ← timer never cleared! Continues after component unmounts
  }, []);

  // Problem 3: unstable return — object recreated every call
  return { data, loading, error, retry: () => fetch(url) };
  //                                    ^^^ new fn every render
}

// ════════════════════════════════════════════════════════════════
// ✅ GOOD HOOK 1 — useFetch: focused, cleaned up, stable interface
// ════════════════════════════════════════════════════════════════

function useFetch(url) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    // Step 1: Create AbortController for cancellation
    const controller = new AbortController();
    let   cancelled  = false;

    setLoading(true);

    fetch(url, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        // Step 2: Guard against setting state after unmount
        if (!cancelled) { setData(data); setLoading(false); }
      })
      .catch(err => {
        if (!cancelled && err.name !== 'AbortError') {
          setError(err);
          setLoading(false);
        }
      });

    // Step 3: Return cleanup — cancel in-flight request on unmount or url change
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url]); // Step 4: url as dep — re-fetch when url changes

  return { data, loading, error }; // stable return shape
}

// ════════════════════════════════════════════════════════════════
// ✅ GOOD HOOK 2 — useLocalStorage: generalised, reusable
// ════════════════════════════════════════════════════════════════

function useLocalStorage(key, initialValue) {
  // Step 1: Initialise from localStorage with safe fallback
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue; // if JSON.parse fails or localStorage unavailable
    }
  });

  // Step 2: Setter that syncs state AND localStorage in one call
  const setValue = useCallback((value) => {
    try {
      // Allow functional updates: setValue(prev => prev + 1)
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('useLocalStorage write failed:', error);
    }
  }, [key, storedValue]); // useCallback makes setValue reference stable

  return [storedValue, setValue]; // mirrors useState API — easy to swap in
}

// Usage — drop-in replacement for useState, with persistence:
function ThemeToggle() {
  const [theme, setTheme] = useLocalStorage('theme', 'light'); // persisted!
  return <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
    {theme}
  </button>;
}

// ════════════════════════════════════════════════════════════════
// ✅ GOOD HOOK 3 — useDebounce: clear name, single purpose, composable
// ════════════════════════════════════════════════════════════════

function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    // Cleanup: clear timer if value/delay changes before timer fires
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Used in composition with useFetch — hooks compose cleanly
function SearchResults({ query }) {
  const debouncedQuery = useDebounce(query, 400); // debounce first
  const { data, loading } = useFetch(`/api/search?q=${debouncedQuery}`); // then fetch
  // Two small hooks composed — each doing one thing
  return loading ? <Spinner /> : <ResultList items={data} />;
}

// ════════════════════════════════════════════════════════════════
// ✅ GOOD HOOK 4 — usePrevious: utility, pure, no side effects
// ════════════════════════════════════════════════════════════════

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value; // update AFTER render — ref holds previous value during render
  });
  return ref.current; // returns the value from the PREVIOUS render
}
```

---

#### Checklist: When to Extract a Custom Hook

```
EXTRACT when:
  □ Same useEffect/useState pattern used in 2+ components
  □ Logic has a clear name you can describe in 3 words
  □ Logic can be tested independently with renderHook()
  □ Component becomes cleaner after extraction
  □ Logic involves side effects that need careful cleanup

DON'T extract when:
  □ Used only once AND is < 10 lines
  □ Would require too many parameters (hook entanglement)
  □ Breaking it out makes it harder to understand in context
  □ The "hook" is just a renamed copy of another hook
```

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|-----------|-----------|-----|
| `useFetch` per call | O(1) | One fetch, one state update cycle |
| `useLocalStorage` read | O(1) | `localStorage.getItem` is O(1) |
| `useDebounce` timer | O(1) | One `setTimeout` + cleanup per value change |
| Multiple hook calls in component | O(K) | K = number of hooks — sequential, constant per hook |

---

### Q24. How would you implement a fully accessible modal using Compound Components?

---

#### ELI5 (Explain Like I'm 5)

> An accessible modal is like a room with proper doors for **everyone** — sighted users, screen reader users, keyboard users. The doors that matter:
> - Screen readers know it's a "dialog" (ARIA role)
> - Focus gets trapped inside while modal is open (you can't accidentally tab to background content)
> - Pressing Escape closes it
> - When it closes, focus returns to the button that opened it
>
> Building this as Compound Components means: `<Modal>`, `<Modal.Trigger>`, `<Modal.Content>`, `<Modal.Title>`, `<Modal.CloseButton>` — all wired up automatically. Users of the component don't need to worry about ARIA or focus management.

---

#### Flowchart — Accessibility Requirements

```
WCAG + ARIA requirements for a dialog modal:
────────────────────────────────────────────────────────────────
  1. role="dialog" on the modal container
  2. aria-modal="true" — tells AT it's a modal (background inert)
  3. aria-labelledby → points to the modal's <h2> title
  4. aria-describedby → optionally points to description text
  5. Focus trap — Tab/Shift+Tab cycles ONLY within modal
  6. Escape key → closes modal
  7. On open  → focus moves to first focusable element OR close button
  8. On close → focus returns to the TRIGGER element that opened it
  9. Rendered in a Portal → modal not clipped by parent overflow:hidden

FOCUS TRAP logic:
  Modal opens
       │
       ▼
  Find all focusable elements inside modal
  [buttons, inputs, links, [tabindex="0"]]
       │
       ▼
  Focus first element
       │
  Tab pressed at LAST element  → wrap to FIRST
  Shift+Tab at FIRST element   → wrap to LAST
  All other Tab presses        → normal within modal
```

---

#### Code Example — Fully Accessible Compound Modal

```jsx
import React, {
  createContext, useContext, useState, useEffect, useRef,
  useCallback, useId
} from 'react';
import { createPortal } from 'react-dom';

// ── Step 1: Shared context for modal state ────────────────────────
const ModalContext = createContext(null);

function useModalContext() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('Modal sub-components must be inside <Modal>');
  return ctx;
}

// ── Step 2: Parent Modal component — holds open state ─────────────
function Modal({ children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const triggerRef = useRef(null); // remembers the trigger for focus return
  const titleId    = useId();      // unique ID for aria-labelledby

  const open  = useCallback(() => setIsOpen(true),  []);
  const close = useCallback(() => {
    setIsOpen(false);
    // Step 3: Return focus to trigger after close
    // Without this, screen reader and keyboard user loses their place
    triggerRef.current?.focus();
  }, []);

  const value = { isOpen, open, close, triggerRef, titleId };

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
}

// ── Step 4: Trigger button — records itself as the triggering element
function ModalTrigger({ children, asChild = false }) {
  const { open, triggerRef } = useModalContext();

  // Common pattern: asChild lets you use any element as trigger
  return (
    <button
      ref={triggerRef}   // save ref so we can return focus here on close
      onClick={open}
      type="button"
    >
      {children}
    </button>
  );
}

// ── Step 5: Overlay backdrop ──────────────────────────────────────
function ModalOverlay({ onClick }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
      }}
      onClick={onClick}          // click outside → close
      aria-hidden="true"         // backdrop is decorative — hide from AT
    />
  );
}

// ── Step 6: Modal content wrapper — the actual dialog ─────────────
function ModalContent({ children }) {
  const { isOpen, close, titleId } = useModalContext();
  const contentRef = useRef(null);

  // ── Focus trap implementation ──────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const el = contentRef.current;
    if (!el) return;

    // Step 7: Find all focusable elements inside the modal
    const focusable = el.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    // Step 8: Focus the first focusable element when modal opens
    first?.focus();

    // Step 9: Trap focus with keydown handler
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // Escape → close modal (WCAG requirement)
        close();
        return;
      }
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift+Tab at first element → wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        // Tab at last element → wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  if (!isOpen) return null;

  // Step 10: Use createPortal — render outside component tree
  // Prevents clipping by parent overflow:hidden / z-index stacking contexts
  return createPortal(
    <>
      <ModalOverlay onClick={close} />
      <div
        ref={contentRef}
        role="dialog"              // ARIA: identifies this as a dialog
        aria-modal="true"          // ARIA: tells AT background is inert
        aria-labelledby={titleId}  // ARIA: links to ModalTitle for AT announcement
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#fff',
          borderRadius: 8, padding: 24,
          zIndex: 1001,
          minWidth: 320,
          outline: 'none',         // visual focus is handled by inner elements
        }}
      >
        {children}
      </div>
    </>,
    document.body                  // portal target
  );
}

// ── Step 11: Modal title — referenced by aria-labelledby ──────────
function ModalTitle({ children }) {
  const { titleId } = useModalContext();
  // id={titleId} connects this to aria-labelledby on the dialog
  // Screen reader announces this when modal opens
  return <h2 id={titleId} style={{ marginTop: 0 }}>{children}</h2>;
}

// ── Step 12: Close button ─────────────────────────────────────────
function ModalCloseButton({ children = 'Close' }) {
  const { close } = useModalContext();
  return (
    <button
      onClick={close}
      type="button"
      aria-label="Close dialog"    // explicit label for screen readers
      style={{ position: 'absolute', top: 12, right: 12 }}
    >
      {children}
    </button>
  );
}

// ── Attach sub-components ─────────────────────────────────────────
Modal.Trigger     = ModalTrigger;
Modal.Content     = ModalContent;
Modal.Title       = ModalTitle;
Modal.CloseButton = ModalCloseButton;

// ════════════════════════════════════════════════════════════════
// USAGE — clean API, all a11y handled automatically
// ════════════════════════════════════════════════════════════════
function DeleteConfirmDialog({ onConfirm }) {
  return (
    <Modal>
      {/* Trigger: focus is saved here for return on close */}
      <Modal.Trigger>Delete Account</Modal.Trigger>

      <Modal.Content>
        {/* Title: read by screen reader when dialog opens */}
        <Modal.Title>Confirm Deletion</Modal.Title>
        <Modal.CloseButton>✕</Modal.CloseButton>

        <p id="delete-desc">This action cannot be undone. Are you sure?</p>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onConfirm} style={{ background: 'red', color: '#fff' }}>
            Yes, Delete
          </button>
          {/* Both buttons inside modal — Tab cycles between them */}
          <Modal.CloseButton>Cancel</Modal.CloseButton>
        </div>
      </Modal.Content>
    </Modal>
  );
}
```

---

#### Step-by-Step Explanation

| Step | Code | Why |
|------|------|-----|
| 1 | `ModalContext` | Shared channel for `isOpen`, `open`, `close`, `titleId` — no prop drilling |
| 2 | `triggerRef` | Saved reference to trigger element — enables focus return on close |
| 3 | `triggerRef.current?.focus()` on close | WCAG 2.1 SC 3.2.2 — focus must return to triggering element |
| 4 | `ref={triggerRef}` on trigger | Captures the DOM node of the opener before modal is shown |
| 5 | `focusable` selector | Finds all keyboard-reachable elements inside the modal |
| 6 | `first?.focus()` on mount | ARIA pattern — focus must move into dialog when it opens |
| 7 | `keydown` → Escape | ARIA dialog pattern requirement — Escape closes the dialog |
| 8 | Tab wrapping (first/last) | Focus trap — prevents tabbing into background content |
| 9 | `createPortal(…, document.body)` | Avoids CSS stacking context issues — modal always on top |
| 10 | `role="dialog"` + `aria-modal="true"` | Screen readers announce it as a dialog; `aria-modal` hides background |
| 11 | `aria-labelledby={titleId}` | Screen reader reads title immediately when dialog opens |
| 12 | `useId()` for `titleId` | React 18 — generates stable unique ID safe for SSR |

---

#### ARIA Attributes Summary

```
  role="dialog"          → "This is a dialog" to screen readers
  aria-modal="true"      → "Background content is inert"
  aria-labelledby="id"   → "Title of this dialog is element with this ID"
  aria-describedby="id"  → "Description of this dialog" (optional)
  aria-label="Close"     → Explicit label for icon-only buttons
```

---

#### Time & Space Complexity

| Operation | Complexity | Why |
|-----------|-----------|-----|
| `querySelectorAll` for focusable | O(N) | N = DOM nodes inside modal — typically very small |
| `keydown` listener | O(1) per event | Just checks `activeElement` === first/last |
| `createPortal` | O(1) | Inserts one child into `document.body` |
| Focus trap setup/teardown | O(1) | One `addEventListener` / `removeEventListener` |

---

## End of Section: REACT — Patterns (Q18–Q24)

---

# REACT — Advanced (Q25–Q31)

---

## Q25: What is Isomorphic / Universal React? How does hydration work?

### 🧒 ELI5
Imagine a chef (server) prepares a beautiful cake and takes a photo of it (HTML). That photo is what you see instantly. Then the actual cake (JavaScript) arrives and you can now touch and eat it. **Hydration** is the moment the real cake arrives and matches the photo — everything becomes interactive.

### 📊 Diagram

```
  ┌──────────────────────────────────────────────────────┐
  │                    SERVER                            │
  │  React renders components → produces HTML string     │
  │  renderToString(<App />) → "<div class='app'>..."    │
  └────────────────────┬─────────────────────────────────┘
                       │  HTML sent over network (fast first paint)
                       ▼
  ┌──────────────────────────────────────────────────────┐
  │                    BROWSER                           │
  │  1. Receives HTML → paints immediately (no blank)    │
  │  2. Downloads JS bundle                              │
  │  3. React calls hydrateRoot(<App />)                 │
  │     ├─ Walks existing DOM (doesn't re-create it)     │
  │     ├─ Attaches event listeners to each node         │
  │     └─ React takes control → app is now interactive  │
  └──────────────────────────────────────────────────────┘

  KEY DIFFERENCE vs CSR:
  CSR: <div id="root"></div>  → JS runs → creates all DOM
  SSR: Full HTML from server  → JS runs → attaches to DOM (hydration)
```

### 💻 Code Example

```javascript
// ── server.js (Node/Express) ────────────────────────────────────────
import { renderToString } from 'react-dom/server';
import App from './App';

app.get('*', (req, res) => {
  // Step 1: render React tree to static HTML string on the server
  const html = renderToString(<App />);

  res.send(`
    <!DOCTYPE html>
    <html>
      <body>
        <!-- Step 2: inject server-rendered HTML into the root div -->
        <div id="root">${html}</div>

        <!-- Step 3: ship the JS bundle to the browser -->
        <script src="/bundle.js"></script>
      </body>
    </html>
  `);
});

// ── client.js (runs in browser) ─────────────────────────────────────
import { hydrateRoot } from 'react-dom/client';
import App from './App';

// Step 4: React walks the existing DOM and attaches event listeners
// It does NOT tear down and rebuild — it reuses every node
hydrateRoot(document.getElementById('root'), <App />);
```

### 🔍 Step-by-Step Explanation

1. **`renderToString`** — React runs your component tree on the server (no browser APIs available); outputs a plain HTML string with `data-reactroot` markers.
2. **HTML shipped to browser** — User sees real content immediately (good FCP/LCP score) before any JS runs.
3. **JS bundle downloads** — This is the same `<App />` component code, now running in the browser.
4. **`hydrateRoot`** — React walks the server-rendered DOM and compares it to what the virtual DOM would produce. If they match, it simply attaches event handlers. No re-painting.
5. **Interactive** — After hydration, the app behaves like a normal CSR React app.

### ⏱️ Complexity

| Metric | Value | Reason |
|--------|-------|--------|
| Time to First Byte (TTFB) | Depends on server | Server must render before sending |
| First Contentful Paint (FCP) | Fast | HTML arrives before JS |
| Time to Interactive (TTI) | Slower than pure CSR | Must wait for JS + hydration pass |
| Hydration pass | O(N) | N = number of DOM nodes |

---

## Q26: What causes a hydration mismatch and how do you fix it?

### 🧒 ELI5
If the cook's photo (server HTML) shows a chocolate cake but the actual cake (client render) is vanilla, there's a mismatch. React panics: "These don't match! I'll throw away the server work and rebuild from scratch." — That wastes all the SSR benefit.

### 📊 Diagram

```
  COMMON MISMATCH SOURCES
  ────────────────────────────────────────────────────────
  1. Date/Time:
     Server:  "Rendered at 10:00:00"
     Client:  "Rendered at 10:00:01"   ← different!

  2. window / localStorage access:
     Server:  window is undefined → crashes or empty value
     Client:  actual window object

  3. Random values:
     Server:  Math.random() === 0.42
     Client:  Math.random() === 0.87

  4. User locale / timezone:
     Server:  running in UTC
     Client:  user in UTC+5:30

  ────────────────────────────────────────────────────────
  REACT 18 BEHAVIOUR:
  └─ In dev: throws hydration error with diff
  └─ In prod: silently re-renders from client (defeats SSR)
```

### 💻 Code Example

```javascript
// ❌ BAD — causes mismatch
function Timestamp() {
  return <p>Loaded at: {new Date().toLocaleTimeString()}</p>;
  // Server renders "10:00:00", client renders "10:00:01"
}

// ✅ FIX 1: useEffect — run only on client after hydration
function Timestamp() {
  const [time, setTime] = useState('');   // Step 1: empty string on both server and client first render

  useEffect(() => {
    // Step 2: runs ONLY in browser, after hydration — no mismatch
    setTime(new Date().toLocaleTimeString());
  }, []);

  return <p>Loaded at: {time}</p>;        // Step 3: consistent initial render
}

// ✅ FIX 2: suppressHydrationWarning (for intentional differences)
function ServerTime({ serverTime }) {
  return (
    // Step 1: suppress React's warning for this single element
    <time suppressHydrationWarning>
      {serverTime}
    </time>
  );
  // Use sparingly — only when you KNOW the content will differ
}

// ✅ FIX 3: Next.js dynamic import with ssr:false (client-only component)
import dynamic from 'next/dynamic';

// Step 1: Next won't render this on server at all — no mismatch possible
const ClientOnlyChart = dynamic(() => import('./Chart'), { ssr: false });

// ✅ FIX 4: Explicit client-only guard
function ThemeToggle() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Step 1: return null on server (no HTML for this) AND on first client paint
  if (!mounted) return null;

  // Step 2: only renders after hydration — reads localStorage safely
  return <button>{localStorage.getItem('theme') === 'dark' ? '🌙' : '☀️'}</button>;
}
```

### 🔍 Step-by-Step Explanation

1. **Root cause** — Server and client execute the same render function but in different environments; any environment-specific value produces different output.
2. **`useEffect` guard** — `useEffect` never runs on the server, so initialising state to a neutral value and setting it in `useEffect` guarantees server = client on first render.
3. **`suppressHydrationWarning`** — Tells React "I know this element will differ, ignore it." Only applies to that element, not its children.
4. **`ssr: false`** — Next.js skips SSR entirely for that component; it only mounts on the client. Safest for components that heavily depend on browser APIs.

### ⏱️ Complexity

| Scenario | Cost | Impact |
|----------|------|--------|
| Mismatch in dev | Warning + re-render | Developer overhead |
| Mismatch in prod | Full client re-render | Loses all SSR benefit (O(N) wasted) |
| `suppressHydrationWarning` | O(1) | Skips diff for one node |
| `ssr: false` | No server render | Component not in initial HTML |

---

## Q27: What are React Server Components? How do they differ from SSR?

### 🧒 ELI5
SSR is like a restaurant that cooks your meal in the kitchen (server) but then ships the entire kitchen to your table so you can reheat later. RSC is like a restaurant that cooks the parts that never change in the kitchen — and only ships the interactive parts to your table. Much lighter delivery!

### 📊 Diagram

```
  TRADITIONAL SSR
  ─────────────────────────────────────────────────────
  Server: renders HTML of ENTIRE app
  Ships:  HTML + FULL JS bundle (every component)
  Client: hydrates everything — even static content

  REACT SERVER COMPONENTS (RSC)
  ─────────────────────────────────────────────────────
  Server Components (*.server.jsx / no "use client")
  ├─ Run ONLY on server
  ├─ Can be async — await fetch(), await db.query()
  ├─ Zero JS sent to client
  └─ Cannot use: useState, useEffect, event handlers

  Client Components ("use client" directive)
  ├─ Can use hooks, events, browser APIs
  ├─ Hydrated on client
  └─ JS IS sent to browser

  COMPOSITION:
  <Page>                      ← Server Component (0 KB to client)
    <Sidebar />               ← Server Component (0 KB to client)
    <ArticleBody />           ← Server Component (0 KB to client)
    <LikeButton />            ← Client Component (JS shipped)
    <CommentThread />         ← Server Component with async data
  </Page>

  RESULT: Only <LikeButton/> JS reaches the browser
```

### 💻 Code Example

```javascript
// ── app/page.tsx (Server Component — no "use client") ───────────────

// Step 1: This function can be async — no useEffect needed
export default async function BlogPost({ params }) {
  // Step 2: Direct DB/API access on server — no fetch boilerplate in client
  const post = await db.posts.findById(params.id);
  const author = await db.users.findById(post.authorId);

  // Step 3: Render — this HTML is sent to client; component code is NOT
  return (
    <article>
      <h1>{post.title}</h1>
      <p>By {author.name}</p>
      <div dangerouslySetInnerHTML={{ __html: post.renderedMarkdown }} />

      {/* Step 4: Client Component for interactivity — JS IS sent */}
      <LikeButton postId={post.id} initialLikes={post.likes} />
    </article>
  );
}

// ── components/LikeButton.tsx (Client Component) ────────────────────
'use client'; // Step 5: Marks this as a Client Component

import { useState } from 'react';

export default function LikeButton({ postId, initialLikes }) {
  // Step 6: useState works here — runs on client
  const [likes, setLikes] = useState(initialLikes);

  async function handleLike() {
    setLikes(l => l + 1);          // Step 7: optimistic update
    await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
  }

  return <button onClick={handleLike}>❤️ {likes}</button>;
}
```

### 🔍 Step-by-Step Explanation

1. **No `useEffect` data fetching** — RSC can be `async`; `await` directly in the component body. No loading states needed for initial data.
2. **Zero bundle cost** — `BlogPost` component code never reaches the browser. The only JS shipped is `LikeButton`.
3. **`"use client"` boundary** — Everything below this boundary in the component tree is a Client Component and will be hydrated.
4. **Server Components can pass serialisable props to Client Components** — You cannot pass functions or class instances across the boundary.
5. **RSC vs SSR** — SSR produces HTML on server but still hydrates full app JS. RSC additionally eliminates component code from the bundle entirely.

### ⏱️ Complexity

| Metric | SSR | RSC |
|--------|-----|-----|
| JS bundle size | Full app | Only client components |
| Data fetching | `getServerSideProps` + client fetch | `async` component directly |
| Interactivity | Hydrate everything | Hydrate only `"use client"` subtrees |
| Component code to client | All components | Only client-marked components |

---

## Q28: What is an Error Boundary? Why must it be a class component?

### 🧒 ELI5
Imagine each section of a newspaper in a separate fireproof box. If one section catches fire, the box contains it — the rest of the newspaper is fine. An Error Boundary is React's fireproof box: it catches render errors inside it and shows a fallback instead of crashing the whole app.

### 📊 Diagram

```
  WITHOUT ERROR BOUNDARY             WITH ERROR BOUNDARY
  ──────────────────────             ──────────────────
  <App>                              <App>
    <Header />      ✅                <Header />        ✅
    <Dashboard>                       <ErrorBoundary>
      <Chart />     💥 throws           <Dashboard>
        ↓                                 <Chart />     💥 throws
    ENTIRE APP                              ↓
    white screen                        ErrorBoundary catches it
                                        Shows <FallbackUI />
                                       </Dashboard>
                                       </ErrorBoundary>
                                    <Footer />        ✅
                                   </App>
                                   Rest of app still works!

  WHAT IT CATCHES:              WHAT IT DOES NOT CATCH:
  ─────────────────             ───────────────────────
  • Render errors               • Event handlers (use try/catch)
  • Constructor errors          • Async code (setTimeout, fetch)
  • Lifecycle method errors     • Errors in the boundary itself
  • Errors in child tree        • SSR errors
```

### 💻 Code Example

```javascript
import React from 'react';

// Step 1: Must be a CLASS component — no functional equivalent exists
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    // Step 2: state tracks whether an error has been caught
    this.state = { hasError: false, error: null };
  }

  // Step 3: static lifecycle — called during render phase when child throws
  // Returns new state to trigger fallback render
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // Step 4: called after render — use for logging/reporting
  componentDidCatch(error, info) {
    // info.componentStack shows which component threw
    console.error('ErrorBoundary caught:', error, info.componentStack);
    // Report to Sentry, Datadog, etc.
    logErrorToService(error, info);
  }

  render() {
    if (this.state.hasError) {
      // Step 5: render fallback UI — can use this.props.fallback for custom UI
      return this.props.fallback ?? (
        <div role="alert">
          <h2>Something went wrong.</h2>
          {/* Step 6: allow user to reset the boundary and retry */}
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }

    // Step 7: no error — render children normally
    return this.props.children;
  }
}

// Usage
function App() {
  return (
    <ErrorBoundary fallback={<p>Chart failed to load</p>}>
      <Chart data={data} />   {/* if this throws, boundary catches it */}
    </ErrorBoundary>
  );
}
```

### 🔍 Step-by-Step Explanation

1. **Why class?** — Two lifecycle methods required: `getDerivedStateFromError` (sync, during render) and `componentDidCatch` (after render, for side effects). React's hooks model runs synchronously during render and cannot replicate this two-phase behaviour. As of React 19, a `use` hook-based boundary is being explored but hasn't shipped.
2. **`getDerivedStateFromError`** — Static (no `this`), pure function; React uses its return value to update state and trigger a re-render with the fallback.
3. **`componentDidCatch`** — Has access to `this`; used for side effects (logging). Called in the "commit" phase.
4. **Granularity** — Wrap individual widgets, not the entire app; lets healthy parts stay functional.
5. **Libraries** — `react-error-boundary` package provides a functional-looking API that wraps the class internally.

### ⏱️ Complexity

| Operation | Complexity | Reason |
|-----------|-----------|--------|
| `getDerivedStateFromError` | O(1) | Sets state flag |
| `componentDidCatch` | O(1) | Logs once per error |
| Re-render fallback | O(1) | Replaces subtree with fallback |
| Stack trace parsing | O(D) | D = component tree depth |

---

## Q29: What are React Portals? When would you use them?

### 🧒 ELI5
Your bedroom (React component tree) is inside a house. When you yell, your voice travels through the house's walls — that's React event bubbling. But a Portal is like a teleporter: it places your content directly in the garden (DOM body), while your voice still travels back through the house. Content is elsewhere in the DOM, events still flow through React.

### 📊 Diagram

```
  WITHOUT PORTAL:
  <App>                        DOM:
    <Modal>                    <div id="root">
      <div class="modal">        <div class="app">
        Stuck inside               <div class="modal">   ← z-index issues
        overflow:hidden            </div>               ← clipped by parent
      </div>                     </div>
    </Modal>                   </div>
  </App>

  WITH PORTAL:
  <App>                        DOM:
    <Modal>                    <div id="root">
      createPortal(              <div class="app">
        <div class="modal">,       ...no modal here...
        document.body             </div>
      )                        </div>
    </Modal>                   <div class="modal">  ← sits at body level
  </App>                         free from overflow/z-index constraints
                               </div>

  EVENT BUBBLING:
  Click inside modal
    → bubbles up through REACT tree (App → Modal → ...)  ✅
    → NOT through DOM tree (body → ...)                  ✅
```

### 💻 Code Example

```javascript
import { createPortal } from 'react-dom';
import { useEffect, useRef } from 'react';

// Step 1: Modal component — lives in React tree but renders outside DOM root
function Modal({ isOpen, onClose, children }) {
  const overlayRef = useRef(null);

  // Step 2: handle click-outside to close
  function handleOverlayClick(e) {
    // Only close if clicking the backdrop, not the inner content
    if (e.target === overlayRef.current) onClose();
  }

  // Step 3: close on Escape key
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Step 4: createPortal renders JSX into a DIFFERENT DOM node
  return createPortal(
    <div
      ref={overlayRef}
      className="modal-overlay"
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0,          // Step 5: covers full viewport
        background: 'rgba(0,0,0,0.5)',
        display: 'grid', placeItems: 'center',
        zIndex: 1000,
      }}
    >
      <div className="modal-content" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>,
    document.body   // Step 6: target DOM node — outside #root
  );
}

// Usage
function App() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ overflow: 'hidden' }}>  {/* this would clip non-portal modals */}
      <button onClick={() => setOpen(true)}>Open Modal</button>

      {/* Portal escapes the overflow:hidden parent */}
      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <h2>Hello from Portal!</h2>
      </Modal>
    </div>
  );
}
```

### 🔍 Step-by-Step Explanation

1. **`createPortal(children, container)`** — First arg is JSX; second is any DOM node. React renders the JSX there instead of in the normal component location.
2. **Event bubbling** — React events still bubble through the React component tree (not the DOM tree). An `onClick` on the portal content will bubble up through `<App>` as expected.
3. **Use cases** — Modals, tooltips, dropdown menus, toast notifications — anything that needs to escape `overflow: hidden`, `transform`, or `z-index` stacking contexts of ancestors.
4. **Context** — Portals remain inside the React tree; `useContext`, Redux store, etc. still work normally.

### ⏱️ Complexity

| Operation | Complexity | Reason |
|-----------|-----------|--------|
| `createPortal` | O(1) | Single DOM `appendChild` |
| Event capture | O(D) | D = React tree depth (bubbling) |
| Modal render | O(C) | C = children in modal |

---

## Q30: What is the difference between SSR, SSG, and ISR in Next.js?

### 🧒 ELI5
**SSG** = Print a newspaper once at 6am; everyone gets the same copy.
**SSR** = Print a custom newspaper for each reader when they ask.
**ISR** = Print a newspaper at 6am, but reprint individual articles when they go stale — without reprinting the whole paper.

### 📊 Diagram

```
  SSG (Static Site Generation)
  ─────────────────────────────────────────────────────
  Build time:  React renders → saves as .html files
  Request:     Serve static file from CDN (fastest!)
  Revalidate:  Only on next `next build`
  API:         getStaticProps / page.tsx with no dynamic

  SSR (Server-Side Rendering)
  ─────────────────────────────────────────────────────
  Build time:  Nothing pre-rendered
  Request:     Node server runs getServerSideProps → renders HTML
  Revalidate:  Every single request (always fresh)
  API:         getServerSideProps / route with dynamic = 'force-dynamic'

  ISR (Incremental Static Regeneration)
  ─────────────────────────────────────────────────────
  Build time:  Pre-renders known pages (like SSG)
  Request:     Serves stale HTML; triggers background rebuild
  Revalidate:  After `revalidate` seconds (stale-while-revalidate)
  API:         getStaticProps + revalidate: N  /  next: { revalidate: N }

  ┌─────────┬──────────┬────────────┬──────────────────────┐
  │         │ Freshness│  Speed     │ Use Case             │
  ├─────────┼──────────┼────────────┼──────────────────────┤
  │ SSG     │ Stale    │ Fastest    │ Docs, blogs, marketing│
  │ SSR     │ Always   │ Slowest    │ User dashboards, auth │
  │ ISR     │ Near-    │ Fast + CDN │ E-commerce, news      │
  │         │ fresh    │            │                       │
  └─────────┴──────────┴────────────┴──────────────────────┘
```

### 💻 Code Example

```javascript
// ── SSG: getStaticProps (Pages Router) ──────────────────────────────
// Step 1: runs at BUILD TIME only; output is a static .html file
export async function getStaticProps() {
  const posts = await fetchAllBlogPosts();
  return { props: { posts } };
}

// ── SSR: getServerSideProps (Pages Router) ──────────────────────────
// Step 1: runs on EVERY REQUEST on the server
export async function getServerSideProps(context) {
  const user = await getUser(context.req.cookies.token); // Step 2: can read request
  const data = await fetchPersonalisedDashboard(user.id);
  return { props: { data } };
}

// ── ISR: getStaticProps + revalidate (Pages Router) ─────────────────
export async function getStaticProps({ params }) {
  const product = await fetchProduct(params.id);
  return {
    props: { product },
    // Step 1: after 60 seconds, next request triggers background rebuild
    // Visitor gets stale page; rebuilt page served to next visitor
    revalidate: 60,
  };
}

// ── App Router equivalents (Next.js 13+) ────────────────────────────

// SSG: default behaviour — fetch is cached at build time
async function Page() {
  const data = await fetch('https://api.example.com/posts');  // cached
  // ...
}

// SSR: opt out of caching
async function Page() {
  const data = await fetch('https://api.example.com/posts', {
    cache: 'no-store',    // Step 1: fetch on every request
  });
}

// ISR: revalidate after N seconds
async function Page() {
  const data = await fetch('https://api.example.com/posts', {
    next: { revalidate: 60 },   // Step 1: stale-while-revalidate
  });
}
```

### 🔍 Step-by-Step Explanation

1. **SSG** — Pages are HTML files in the `.next/static` folder after build. CDN caches them forever (until next deploy). Best performance, but data can be stale.
2. **SSR** — Every request hits your Node server. Fresh data, but adds server latency. Don't cache on CDN (content is per-request).
3. **ISR** — Uses stale-while-revalidate: serve the cached HTML immediately, then rebuild in the background if the revalidation window has passed. Best of both worlds for content that changes occasionally.
4. **On-demand ISR** — `revalidatePath('/blog/[slug]')` or `revalidateTag('posts')` lets you purge the cache programmatically (e.g., on a CMS webhook).

### ⏱️ Complexity

| Strategy | TTFB | Server Load | Data Freshness |
|----------|------|-------------|----------------|
| SSG | < 10ms (CDN) | O(1) per request | Stale until rebuild |
| SSR | 100–500ms | O(1) per request (but always runs) | Always fresh |
| ISR | < 10ms (CDN hit) | O(1) background only | Stale by ≤ revalidate seconds |

---

## Q31: How does `Suspense` work for data fetching vs code splitting?

### 🧒 ELI5
`Suspense` is a "loading screen" instruction. For **code splitting** it says "wait until the code file downloads." For **data fetching** it says "wait until the data promise resolves." In both cases, the parent shows a spinner (fallback) and the child appears when ready.

### 📊 Diagram

```
  CODE SPLITTING
  ──────────────────────────────────────────────────────
  React.lazy(() => import('./HeavyChart'))
       │
       ▼
  <Suspense fallback={<Spinner />}>    ← shows while JS downloads
    <HeavyChart />
  </Suspense>
       │
  JS bundle chunk requested → downloaded → component mounts

  DATA FETCHING (React 18 use() hook)
  ──────────────────────────────────────────────────────
  const promise = fetchUser(id);       ← starts outside render

  function UserCard() {
    const user = use(promise);         ← throws promise if pending
  }                                    ← React catches the throw

  <Suspense fallback={<Skeleton />}>   ← shows while data resolves
    <UserCard />
  </Suspense>
       │
  Promise resolves → React re-renders UserCard → shows data

  NESTED SUSPENSE (waterfall avoidance)
  ──────────────────────────────────────────────────────
  <Suspense fallback={<PageSkeleton />}>      ← outer
    <Header />
    <Suspense fallback={<ArticleSkeleton />}> ← inner
      <Article />                              
    </Suspense>
    <Suspense fallback={<SidebarSkeleton />}> ← inner
      <Sidebar />                              ← loads in parallel
    </Suspense>
  </Suspense>
```

### 💻 Code Example

```javascript
import { Suspense, lazy, use } from 'react';

// ── Code Splitting with React.lazy ───────────────────────────────────

// Step 1: lazy() wraps a dynamic import — chunk is only loaded when needed
const HeavyDashboard = lazy(() => import('./HeavyDashboard'));

function App() {
  const [show, setShow] = useState(false);

  return (
    <>
      <button onClick={() => setShow(true)}>Load Dashboard</button>

      {/* Step 2: fallback shown while JS chunk downloads */}
      <Suspense fallback={<div>Loading dashboard...</div>}>
        {show && <HeavyDashboard />}
      </Suspense>
    </>
  );
}

// ── Data Fetching with React 18 use() hook ───────────────────────────

// Step 1: create promise OUTSIDE the component (not inside useEffect)
// This avoids creating a new promise on every render
function fetchUser(id) {
  return fetch(`/api/users/${id}`).then(r => r.json());
}

// Step 2: cache promises to avoid re-fetch on re-render
const userCache = new Map();
function getUserPromise(id) {
  if (!userCache.has(id)) {
    userCache.set(id, fetchUser(id));
  }
  return userCache.get(id);
}

// Step 3: Component uses use() — suspends until promise resolves
function UserCard({ id }) {
  // use() throws the promise if pending; React catches it with nearest Suspense
  const user = use(getUserPromise(id));
  return <div>{user.name}</div>;
}

// Step 4: Wrap in Suspense — handles both loading and error states
function App() {
  return (
    <ErrorBoundary fallback={<p>Failed to load user</p>}>
      <Suspense fallback={<p>Loading user...</p>}>
        <UserCard id={42} />
      </Suspense>
    </ErrorBoundary>
  );
}

// ── Server Components + Suspense (Next.js App Router) ────────────────
// Step 5: async server components integrate naturally with Suspense
async function SlowData() {
  const data = await fetch('https://slow-api.example.com/data');
  const json = await data.json();
  return <pre>{JSON.stringify(json, null, 2)}</pre>;
}

export default function Page() {
  return (
    <Suspense fallback={<p>Fetching slow data...</p>}>
      <SlowData />   {/* Next.js automatically suspends async components */}
    </Suspense>
  );
}
```

### 🔍 Step-by-Step Explanation

1. **Mechanism** — Suspense works because React catches thrown Promises in the render phase. When a component throws a Promise, React renders the nearest `<Suspense>` fallback and subscribes to the Promise. When it resolves, React re-renders the suspended subtree.
2. **Code splitting** — `React.lazy` wraps a dynamic `import()` which returns a Promise. The first render throws this Promise; Suspense shows the fallback; when the chunk downloads, React re-renders.
3. **`use()` hook (React 18)** — `use(promise)` is the first hook that can be called conditionally. It reads the resolved value or throws the Promise if still pending.
4. **Parallel loading** — Nested `<Suspense>` boundaries let siblings load in parallel. Each boundary independently handles its loading state.
5. **Error handling** — Always pair `<Suspense>` with an `<ErrorBoundary>` above it; rejected promises propagate to the Error Boundary.
6. **Old pattern (render-as-you-fetch)** — Libraries like SWR/React Query use their own Suspense mode (`suspense: true`). Under the hood they throw cached Promises.

### ⏱️ Complexity

| Scenario | Load Sequence | Complexity |
|----------|--------------|-----------|
| Sequential (no Suspense) | A then B then C | O(A+B+C) time |
| Parallel Suspense boundaries | A, B, C in parallel | O(max(A,B,C)) time |
| Code split chunk | O(bundle size / bandwidth) | Network bound |
| `use()` re-render on resolve | O(subtree size) | Minimal |

---

## End of Section: REACT — Advanced (Q25–Q31)

---

# REACT — Ecosystem (Q32–Q38)

---

## Q32: What is the difference between `queryKey`, `staleTime`, and `cacheTime` in React Query?

### 🧒 ELI5
**`queryKey`** is the name tag on a jar in the fridge — it identifies what's inside so you can find it again. **`staleTime`** is "how long until the food is considered old" — while fresh, nobody goes back to the shop. **`cacheTime`** is "how long the empty jar stays on the shelf before being thrown away" — even after you stop using it, the data lingers for a while in case you need it again soon.

### 📊 Diagram

```
  queryKey: ['todos', { status: 'open', page: 1 }]
  ───────────────────────────────────────────────
  • Unique cache key — every distinct key = independent cache entry
  • Array form allows granular invalidation:
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      → invalidates ALL queries whose key starts with ['todos']

  staleTime (default: 0)
  ───────────────────────────────────────────────
  0ms ──▶ fresh ──▶ [staleTime ms] ──▶ stale
  • While FRESH: component re-mount does NOT trigger a new network request
  • Once STALE: next mount / window refocus / network reconnect → refetch
  • staleTime: Infinity → never refetch automatically (static data, e.g. config)

  cacheTime (TanStack v5: gcTime, default: 5 minutes)
  ───────────────────────────────────────────────────
  Query becomes inactive (no subscribers)
       │
       ▼ cacheTime timer starts
  [cacheTime ms passes]
       │
       ▼ garbage collected from cache
  
  INTERACTION:
  ┌──────────┬────────────┬────────────────────────────────────┐
  │staleTime │ cacheTime  │ Behaviour                          │
  ├──────────┼────────────┼────────────────────────────────────┤
  │ 0        │ 5 min      │ Always refetch on mount, but cached│
  │          │            │ data shown instantly (background)  │
  ├──────────┼────────────┼────────────────────────────────────┤
  │ 30s      │ 5 min      │ No refetch if mounted < 30s ago    │
  ├──────────┼────────────┼────────────────────────────────────┤
  │ Infinity │ Infinity   │ Fetch once, never refetch/GC       │
  └──────────┴────────────┴────────────────────────────────────┘
```

### 💻 Code Example

```javascript
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Step 1: queryKey as array — supports partial matching for invalidation
const { data: todos } = useQuery({
  queryKey: ['todos', { status: 'open', page: currentPage }],
  queryFn: () => fetchTodos({ status: 'open', page: currentPage }),

  // Step 2: staleTime — consider data fresh for 30 seconds
  // Re-mounting this component within 30s won't trigger a network request
  staleTime: 30_000,

  // Step 3: gcTime (v5) / cacheTime (v4) — keep inactive cache for 10 minutes
  // If no component subscribes for 10 min, the entry is garbage collected
  gcTime: 10 * 60 * 1000,
});

// Step 4: targeted invalidation using partial key matching
const queryClient = useQueryClient();

function invalidateAllTodos() {
  // Invalidates ['todos', { status: 'open' }] AND ['todos', { status: 'done' }]
  // because they all start with ['todos']
  queryClient.invalidateQueries({ queryKey: ['todos'] });
}

function prefetchNextPage() {
  // Step 5: prefetch into cache before user navigates
  queryClient.prefetchQuery({
    queryKey: ['todos', { status: 'open', page: currentPage + 1 }],
    queryFn: () => fetchTodos({ status: 'open', page: currentPage + 1 }),
    staleTime: 30_000,
  });
}

// Step 6: global defaults — set once in QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,   // 1 min default freshness
      gcTime: 5 * 60_000,  // 5 min default GC
      retry: 2,            // retry failed requests twice
    },
  },
});
```

### 🔍 Step-by-Step Explanation

1. **`queryKey`** — Serialised to a stable string internally. Two queries with identical keys share the same cache slot. Array format lets you group related queries by prefix for bulk invalidation.
2. **`staleTime`** — Controls "do I need fresh data?" A high `staleTime` reduces network requests; good for reference data that rarely changes (country list, config).
3. **`gcTime` / `cacheTime`** — Controls "how long to keep the data in memory after nobody is using it." Keeps the cache warm for quick navigation back to a page.
4. **v5 rename** — TanStack Query v5 renamed `cacheTime` → `gcTime` to reduce confusion (because `staleTime` and `cacheTime` were commonly mixed up).

### ⏱️ Complexity

| Operation | Complexity | Reason |
|-----------|-----------|--------|
| Cache lookup by key | O(1) | Hash map internally |
| Partial key invalidation | O(K) | K = number of cached queries |
| GC sweep | O(K) | Iterates all inactive entries |

---

## Q33: How do you implement optimistic updates in React Query?

### 🧒 ELI5
You send a text message and your chat app shows it immediately (grey tick) before the server confirms. If the server fails, the message disappears with an error. That's an **optimistic update** — assume success, show the result instantly, roll back on failure.

### 📊 Diagram

```
  USER ACTION: "Like this post"
  ─────────────────────────────────────────────────────
  1. onMutate:
     ├─ Cancel in-flight fetches (avoid overwrite)
     ├─ Snapshot current cache value
     └─ Immediately update cache → UI shows liked ❤️

  2. Network request fires in background

  3a. onSuccess:
     └─ Invalidate query → refetch real server value
        (keeps cache in sync with truth)

  3b. onError:
     └─ Restore snapshot → UI reverts to not-liked 🤍
        Show error toast

  TIMELINE:
  t=0  ── onMutate (instant UI update)
  t=50 ── network request in flight
  t=200 ── onSuccess → invalidate → background refetch
         OR
  t=200 ── onError → rollback to snapshot
```

### 💻 Code Example

```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';

function useLikePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId) => fetch(`/api/posts/${postId}/like`, { method: 'POST' }),

    // Step 1: runs BEFORE the network request — optimistic update happens here
    onMutate: async (postId) => {
      // Step 2: cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['posts'] });

      // Step 3: snapshot the current value so we can roll back on error
      const previousPosts = queryClient.getQueryData(['posts']);

      // Step 4: optimistically update the cache immediately
      queryClient.setQueryData(['posts'], (old) =>
        old.map((post) =>
          post.id === postId
            ? { ...post, likes: post.likes + 1, liked: true }
            : post
        )
      );

      // Step 5: return snapshot as context — onError will receive it
      return { previousPosts };
    },

    // Step 6: if mutation fails, roll back to the snapshot
    onError: (err, postId, context) => {
      queryClient.setQueryData(['posts'], context.previousPosts);
      toast.error('Failed to like post. Please try again.');
    },

    // Step 7: after success OR error, sync cache with server truth
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

// Usage in component
function PostCard({ post }) {
  const { mutate: likePost, isPending } = useLikePost();

  return (
    <button
      onClick={() => likePost(post.id)}
      disabled={isPending}  // prevent double-click
    >
      {post.liked ? '❤️' : '🤍'} {post.likes}
    </button>
  );
}
```

### 🔍 Step-by-Step Explanation

1. **`cancelQueries`** — Prevents a concurrent background refetch from stomping over our optimistic update with stale server data.
2. **`getQueryData` snapshot** — We save what the cache looked like before our change so `onError` can restore it exactly.
3. **`setQueryData`** — Directly writes to the cache synchronously — no network round-trip. React re-renders immediately with the new value.
4. **`context`** — Whatever `onMutate` returns is passed as the third argument to `onError` and `onSettled`. This is the rollback mechanism.
5. **`onSettled`** — Always fires (success or error). Invalidating here ensures eventual consistency by fetching the real server state.

### ⏱️ Complexity

| Step | Complexity | Reason |
|------|-----------|--------|
| `cancelQueries` | O(K) | K = matching active queries |
| `setQueryData` | O(N) | N = items in the list |
| Rollback | O(1) | Replace with snapshot reference |
| Refetch on settle | O(N) | Server returns full list |

---

## Q34: How does React Query handle background refetching?

### 🧒 ELI5
Imagine a weather app that shows yesterday's forecast while quietly checking for today's update behind the scenes. When the new data arrives, the display updates — you never saw a loading spinner. That's background refetching.

### 📊 Diagram

```
  TRIGGERS FOR BACKGROUND REFETCH:
  ─────────────────────────────────────────────────────
  1. refetchOnWindowFocus  (default: true)
     User switches tab, comes back → stale queries refetch

  2. refetchOnMount  (default: true)
     Component mounts and data is stale → refetch in background

  3. refetchOnReconnect  (default: true)
     Internet comes back → refetch stale queries

  4. refetchInterval  (polling)
     refetchInterval: 5000 → refetch every 5 seconds

  BEHAVIOUR DURING BACKGROUND REFETCH:
  ─────────────────────────────────────────────────────
  Cache has stale data
       │
       ├─ isLoading: false  ← NOT shown (data already exists)
       ├─ isFetching: true  ← background fetch in progress
       └─ data: <stale>     ← previous data shown immediately

  Refetch completes
       │
       └─ data: <fresh>  ← UI updates silently

  DEDUPLICATION:
  Multiple components subscribe to same queryKey
  → Only ONE network request fires
  → All subscribers receive the same data simultaneously
```

### 💻 Code Example

```javascript
import { useQuery } from '@tanstack/react-query';

function LiveStockPrice({ ticker }) {
  const { data, isFetching, isLoading } = useQuery({
    queryKey: ['stock', ticker],
    queryFn: () => fetchStockPrice(ticker),

    // Step 1: poll every 10 seconds for live prices
    refetchInterval: 10_000,

    // Step 2: stop polling when tab is in background (save resources)
    refetchIntervalInBackground: false,

    // Step 3: refetch on window focus — user comes back to tab
    refetchOnWindowFocus: true,

    // Step 4: treat data as stale after 5 seconds
    staleTime: 5_000,
  });

  return (
    <div>
      <span>${data?.price}</span>

      {/* Step 5: isFetching is true during background refetch */}
      {/* isLoading is only true when there's NO cached data AND fetching */}
      {isFetching && !isLoading && (
        <span style={{ fontSize: '0.8em', color: 'grey' }}>↻ updating</span>
      )}
    </div>
  );
}

// Step 6: manually trigger a background refetch
function RefreshButton({ ticker }) {
  const queryClient = useQueryClient();

  return (
    <button onClick={() => queryClient.invalidateQueries({ queryKey: ['stock', ticker] })}>
      Force Refresh
    </button>
  );
}

// Step 7: disable background behaviour for static data
useQuery({
  queryKey: ['countries'],
  queryFn: fetchCountries,
  staleTime: Infinity,         // never go stale
  refetchOnWindowFocus: false, // never background refetch
  refetchOnMount: false,       // only fetch once
});
```

### 🔍 Step-by-Step Explanation

1. **`isFetching` vs `isLoading`** — `isLoading` is `true` only the very first time (no cached data). `isFetching` is `true` on every network request including background ones. Show a subtle indicator during `isFetching && !isLoading`.
2. **Request deduplication** — If 10 components mount simultaneously with the same `queryKey`, React Query fires exactly one `queryFn` and distributes the result to all 10.
3. **`refetchInterval`** — Polling. React Query manages the `setInterval` internally and clears it when the component unmounts or the query becomes inactive.
4. **`refetchIntervalInBackground: false`** — Pauses polling when the document is hidden (browser tab in background), resuming when the tab becomes visible again.

### ⏱️ Complexity

| Feature | Cost | Reason |
|---------|------|--------|
| Request deduplication | O(1) extra | One request regardless of subscriber count |
| `refetchInterval` | O(1) timer | Single interval per query |
| Window focus listener | O(1) | One global event listener |
| Subscriber notification | O(S) | S = number of subscribed components |

---

## Q35: What is the difference between `useForm` controlled vs uncontrolled in React Hook Form?

### 🧒 ELI5
**Controlled** is like a puppeteer pulling every string — React knows every keystroke. **Uncontrolled** (React Hook Form's default) is like giving the actor a script but letting them perform freely — the form manages its own values using native DOM, React only checks in when needed (submit, validate). RHF's approach means zero re-renders per keystroke.

### 📊 Diagram

```
  CONTROLLED (standard React)
  ────────────────────────────────────────────────────
  User types "A" → onChange fires → setState("A")
  → React re-renders → input shows "A"
  User types "B" → onChange fires → setState("AB")
  → React re-renders → input shows "AB"
  ...every keystroke = 1 re-render

  UNCONTROLLED (React Hook Form default)
  ────────────────────────────────────────────────────
  User types "AB" → native DOM holds value
  → NO React re-renders during typing
  User submits → RHF reads DOM values via ref
  → validates → returns errors / data

  register() returns:
  { name, ref, onChange, onBlur }
  └─ onChange: only triggers internal RHF validation
  └─ ref: RHF reads value directly from DOM node

  RE-RENDER COMPARISON:
  ─────────────────────
  Form with 10 fields, user types 50 chars:
  Controlled:   ~500 re-renders
  RHF default:  ~1-5 re-renders (only on error state change)
```

### 💻 Code Example

```javascript
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Step 1: define validation schema with Zod
const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  age: z.coerce.number().min(18, 'Must be 18+'),
});

function LoginForm() {
  const {
    register,       // Step 2: uncontrolled — attaches ref + onChange to native input
    control,        // Step 3: for controlled third-party components
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),   // Step 4: RHF calls Zod on validate
    defaultValues: { email: '', password: '', age: '' },
    mode: 'onBlur',   // Step 5: validate on blur (not on every keystroke)
  });

  // Step 6: handleSubmit only fires if schema validation passes
  const onSubmit = async (data) => {
    await loginUser(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>

      {/* Step 7: register() — UNCONTROLLED: no useState, no value prop */}
      <input
        {...register('email')}  // spreads: name, ref, onChange, onBlur
        placeholder="Email"
      />
      {errors.email && <p>{errors.email.message}</p>}

      <input
        {...register('password')}
        type="password"
        placeholder="Password"
      />
      {errors.password && <p>{errors.password.message}</p>}

      {/* Step 8: Controller — CONTROLLED: for custom/third-party inputs */}
      {/* Use when the component needs a value prop (e.g. Select, DatePicker) */}
      <Controller
        name="age"
        control={control}
        render={({ field }) => (
          // field = { value, onChange, onBlur, ref }
          <CustomAgeSelect {...field} />
        )}
      />
      {errors.age && <p>{errors.age.message}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

### 🔍 Step-by-Step Explanation

1. **`register()`** — Returns `{ name, ref, onChange, onBlur }`. Spreaded onto a native `<input>`, RHF tracks the value via the `ref` (DOM reference), not React state. Zero re-renders while typing.
2. **`Controller`** — Wraps components that require a `value` prop (controlled). RHF internally manages state for that field. Use it for custom UI libraries (MUI, Radix, etc.).
3. **`mode`** — Controls when validation runs: `'onSubmit'` (default), `'onBlur'`, `'onChange'` (expensive), `'onTouched'`, `'all'`.
4. **`zodResolver`** — `@hookform/resolvers/zod` bridges RHF and Zod. On submit/validate, RHF passes values to Zod's `parse`, errors are mapped back to field names.
5. **`watch()`** — When you need to observe a field value reactively (e.g. conditional fields), `watch('fieldName')` returns the current value but does trigger a re-render for that field.

### ⏱️ Complexity

| Scenario | Re-renders | Reason |
|----------|------------|--------|
| Typing in `register()` field | 0 | DOM ref, no state update |
| Typing in `Controller` field | 1 per keystroke | Controlled, RHF state update |
| Blur validation (error appears) | 1 | `formState.errors` changes |
| `handleSubmit` call | 1 | Updates `isSubmitting` state |

---

## Q36: How do you share Zod schemas between frontend validation and API validation?

### 🧒 ELI5
You write the rules for a board game once and put them in the box. Both players (frontend and backend) read from the same rulebook. If you change a rule, everyone plays by the new rule automatically — you don't have to hand-write two separate copies.

### 📊 Diagram

```
  WITHOUT SHARED SCHEMA:
  ─────────────────────────────────────────────────────
  Frontend:  Yup schema { email: required, min 5 }
  Backend:   Joi schema { email: required, min 3 }   ← diverged!
  Result:    Frontend says valid, backend rejects → user confused

  WITH SHARED ZOD SCHEMA (monorepo / shared package):
  ─────────────────────────────────────────────────────
  packages/shared/src/schemas/user.ts
         │
         ├─ Frontend imports → useForm + zodResolver
         │   Client-side validation: instant feedback
         │
         └─ Backend imports → zod.parse() in API route
             Server-side validation: authoritative check
             TypeScript types inferred from same schema
  
  FLOW:
  User fills form → Zod validates (frontend) → submit
       → API receives data → Zod validates (backend)
       → if server rejects → error response to client
  
  INFERRED TYPES:
  type UserInput = z.infer<typeof userSchema>
  → same type used in React component props AND Express handler
```

### 💻 Code Example

```javascript
// ── packages/shared/src/schemas/user.ts ─────────────────────────────
import { z } from 'zod';

// Step 1: define schema ONCE in a shared location
export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain a number'),
  age: z.coerce.number().int().min(18, 'Must be 18 or older'),
});

// Step 2: infer TypeScript type from schema — used in both FE and BE
export type CreateUserInput = z.infer<typeof createUserSchema>;

// ── Frontend: React + React Hook Form ───────────────────────────────
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserSchema, type CreateUserInput } from '@myapp/shared';

function RegisterForm() {
  // Step 3: resolver automatically validates against shared schema
  const { register, handleSubmit, formState: { errors } } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
  });

  const onSubmit = async (data: CreateUserInput) => {
    // Step 4: data is fully typed — CreateUserInput from shared schema
    await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}
      {/* ...other fields */}
    </form>
  );
}

// ── Backend: Express API route ───────────────────────────────────────
import { createUserSchema } from '@myapp/shared';

app.post('/api/users', async (req, res) => {
  // Step 5: parse on server — rejects malformed/malicious payloads
  const result = createUserSchema.safeParse(req.body);

  if (!result.success) {
    // Step 6: ZodError maps to structured field errors
    return res.status(400).json({
      errors: result.error.flatten().fieldErrors,
    });
  }

  // Step 7: result.data is fully typed as CreateUserInput
  const user = await db.users.create(result.data);
  res.status(201).json(user);
});
```

### 🔍 Step-by-Step Explanation

1. **Single source of truth** — Schema lives in a shared package (`@myapp/shared`). Both sides import it. Any change to validation rules propagates to both environments automatically.
2. **`z.infer<typeof schema>`** — Extracts the TypeScript type from the schema. No need to write a separate interface — the type is always in sync with validation constraints.
3. **`safeParse` vs `parse`** — `parse` throws on failure; `safeParse` returns `{ success, data, error }` — better for API routes where you want to return 400, not crash.
4. **`error.flatten()`** — Converts nested Zod errors into `{ fieldErrors: { email: ['Invalid email'] }, formErrors: [] }` — easy to map back to form fields.
5. **Next.js Server Actions** — With RSC, you can call `createUserSchema.parse(formData)` directly inside a server action, sharing the same schema with the `<form>` component in the same file.

### ⏱️ Complexity

| Operation | Complexity | Reason |
|-----------|-----------|--------|
| `z.parse()` | O(F) | F = number of fields |
| `z.infer` type extraction | O(0) | Compile-time only, no runtime cost |
| `error.flatten()` | O(E) | E = number of validation errors |

---

## Q37: When would you choose Zustand over Redux Toolkit?

### 🧒 ELI5
**Redux Toolkit** is a city's traffic control centre — powerful, centralised, great for complex intersections, but you need a whole team to run it. **Zustand** is traffic lights on a quiet road — simple, gets the job done, no bureaucracy. Both move traffic; you pick based on how complex your roads are.

### 📊 Diagram

```
  ZUSTAND
  ────────────────────────────────────────────
  • ~1KB bundle
  • No providers, no boilerplate
  • Single store or multiple stores
  • Direct mutation via immer (optional)
  • React hooks only — no connect(), no mapStateToProps
  • No actions/reducers — just functions in the store

  const useStore = create((set) => ({
    count: 0,
    increment: () => set(state => ({ count: state.count + 1 })),
  }));

  REDUX TOOLKIT (RTK)
  ────────────────────────────────────────────
  • Larger bundle, but battle-tested
  • DevTools with time-travel debugging
  • RTK Query = built-in data fetching + caching
  • Standardised: slices, actions, reducers, selectors
  • Better for large teams needing conventions
  • Middleware ecosystem (redux-thunk, redux-saga)

  DECISION MATRIX:
  ┌────────────────────────────┬─────────┬─────────┐
  │ Scenario                   │ Zustand │  RTK    │
  ├────────────────────────────┼─────────┼─────────┤
  │ Small/medium app UI state  │   ✅    │ overkill│
  │ Time-travel debugging      │   ❌    │   ✅    │
  │ Large team, many devs      │   ⚠️   │   ✅    │
  │ Server state (API data)    │  RQ*    │ RTK Q   │
  │ Minimal boilerplate        │   ✅    │   ❌    │
  │ Complex async workflows    │   ⚠️   │   ✅    │
  │ Bundle size matters        │   ✅    │   ⚠️   │
  └────────────────────────────┴─────────┴─────────┘
  * Use React Query for server state with either option
```

### 💻 Code Example

```javascript
// ── ZUSTAND ──────────────────────────────────────────────────────────
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

// Step 1: define store with state + actions in one object
const useCartStore = create(
  persist(                    // Step 2: persist to localStorage automatically
    immer((set, get) => ({    // Step 3: immer enables direct mutation syntax
      items: [],
      total: 0,

      addItem: (product) => set((state) => {
        // Step 4: immer draft — looks like mutation, produces immutable update
        const existing = state.items.find(i => i.id === product.id);
        if (existing) {
          existing.quantity += 1;
        } else {
          state.items.push({ ...product, quantity: 1 });
        }
        state.total = state.items.reduce((s, i) => s + i.price * i.quantity, 0);
      }),

      removeItem: (id) => set((state) => {
        state.items = state.items.filter(i => i.id !== id);
        state.total = state.items.reduce((s, i) => s + i.price * i.quantity, 0);
      }),

      clearCart: () => set({ items: [], total: 0 }),
    })),
    { name: 'cart-storage' }  // localStorage key
  )
);

// Step 5: subscribe to only what you need — component only re-renders
// when items.length changes, not on any state change
function CartIcon() {
  const itemCount = useCartStore(state => state.items.length);
  return <span>🛒 {itemCount}</span>;
}

// ── REDUX TOOLKIT (for comparison) ───────────────────────────────────
import { createSlice, configureStore } from '@reduxjs/toolkit';

// Step 6: RTK slice — much more structured, better for teams
const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [], total: 0 },
  reducers: {
    addItem: (state, action) => {  // immer built-in to RTK
      const existing = state.items.find(i => i.id === action.payload.id);
      if (existing) existing.quantity += 1;
      else state.items.push({ ...action.payload, quantity: 1 });
    },
  },
});

// Step 7: explicit action creators — easy to trace in DevTools / tests
export const { addItem } = cartSlice.actions;
```

### 🔍 Step-by-Step Explanation

1. **Choose Zustand when** — you want minimal boilerplate for UI state (modals, themes, wizard steps, shopping cart). Small-medium apps, or when you're already using React Query for server state.
2. **Choose Redux Toolkit when** — you need time-travel debugging, have a large team that benefits from enforced conventions, you're maintaining a legacy Redux codebase, or need RTK Query's advanced caching features.
3. **Don't use either for server state** — React Query / SWR handle async data fetching better than either. Global state should only hold client-side state (auth token, UI preferences, shopping cart).
4. **Zustand selector granularity** — Pass a selector function to `useStore(selector)` to prevent re-renders when unrelated state changes.

### ⏱️ Complexity

| Operation | Zustand | Redux Toolkit |
|-----------|---------|---------------|
| Bundle size | ~1KB | ~10–40KB |
| Boilerplate lines for a slice | ~10 | ~30–50 |
| Selector re-render | O(1) per selector | O(1) per selector |
| Middleware pipeline | Optional | Built-in (thunk) |

---

## Q38: How do you handle global error state in React Query?

### 🧒 ELI5
Instead of putting a fire alarm in every room of your house, you have one central alarm panel. In React Query, instead of writing `if (isError) toast(error)` in every component, you register one global error handler that fires for any failed query or mutation.

### 📊 Diagram

```
  COMPONENT-LEVEL ERROR HANDLING:
  ─────────────────────────────────────────────
  <UserProfile>   → if (isError) showToast()   ← repeated in every component
  <PostList>      → if (isError) showToast()
  <Comments>      → if (isError) showToast()

  GLOBAL ERROR HANDLING:
  ─────────────────────────────────────────────
  QueryClient (onError callback)
       │
       ├─ Any query fails → global handler fires
       ├─ Any mutation fails → global handler fires
       └─ Logs, toasts, redirects (e.g. 401 → login)

  GRANULARITY OPTIONS:
  ─────────────────────────────────────────────
  1. QueryClient defaultOptions.queries.onError   ← all queries
  2. QueryCache / MutationCache callbacks          ← recommended in v5
  3. useQuery({ onError })                         ← per-query override
  4. ErrorBoundary above <QueryClientProvider>     ← uncaught render errors
```

### 💻 Code Example

```javascript
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query';
import toast from 'react-hot-toast';

// Step 1: attach global error handlers at QueryCache / MutationCache level
// This is the recommended approach in TanStack Query v4/v5
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // Step 2: fires whenever ANY query errors — receives error + query metadata
    onError: (error, query) => {
      // Step 3: only show toast for non-silent errors
      // use query.meta to pass contextual flags from useQuery
      if (query.meta?.silent) return;

      if (error.status === 401) {
        // Step 4: redirect to login on unauthorised
        window.location.href = '/login';
        return;
      }

      // Step 5: show user-friendly toast for other errors
      const message = error.message ?? 'Something went wrong';
      toast.error(message);
    },
  }),

  mutationCache: new MutationCache({
    // Step 6: fires whenever ANY mutation errors
    onError: (error, variables, context, mutation) => {
      if (mutation.meta?.silent) return;

      toast.error(error.message ?? 'Action failed. Please try again.');
    },
  }),

  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Step 7: don't retry 4xx errors — they won't fix themselves
        if (error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 60_000,
    },
  },
});

// Step 8: wrap app with provider
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}

// Step 9: per-query opt-out — mark as silent so global handler skips it
function useOptionalUser(id) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => fetchUser(id),
    meta: { silent: true },       // global onError will skip this
    onError: (err) => {
      // handle locally instead
      setUserError(err);
    },
  });
}

// Step 10: combine with ErrorBoundary for render-phase errors
function Root() {
  return (
    <ErrorBoundary fallback={<GlobalErrorPage />}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
```

### 🔍 Step-by-Step Explanation

1. **`QueryCache` / `MutationCache`** — The correct place for global error handling in v4/v5. The `onError` at `defaultOptions` level was deprecated in v5 because it ran per-observer (once per `useQuery` call), not per query — leading to duplicate toasts.
2. **`query.meta`** — A freeform object you can attach to any query via `meta: { ... }`. Useful for flagging queries as silent, or tagging with a category for analytics.
3. **HTTP status-based routing** — `401 → login redirect`, `403 → permission denied page`, `500 → generic error toast`. Centralise this logic instead of duplicating it.
4. **`retry` function** — Don't retry client errors (4xx). Retry server errors (5xx) up to N times with exponential backoff (built-in to React Query).
5. **Double coverage** — React Query's error handling catches async errors. Wrap with `<ErrorBoundary>` to catch synchronous render errors that slip through.

### ⏱️ Complexity

| Scenario | Cost | Reason |
|----------|------|--------|
| Global `onError` fires | O(1) | Single callback per failed request |
| Duplicate toast prevention | O(1) | `meta.silent` flag check |
| Retry logic | O(R) | R = number of retry attempts |
| Error boundary catch | O(1) | Single error per boundary |

---

## End of Section: REACT — Ecosystem (Q32–Q38)

---

# NODE.JS — Core (Q39–Q47)

---

## Q39: Explain the Node.js event loop. What is the order of execution between `setTimeout`, `Promise.then`, and `process.nextTick`?

### 🧒 ELI5
Imagine a chef with several incoming orders labeled by urgency. `process.nextTick` orders go to the top of the pile right now, before the chef finishes the current dish. `Promise.then` orders go to a "hot queue" checked after each dish. `setTimeout` orders sit in a separate tray checked once per trip to the pass. The chef (event loop) clears the hot queue completely before going to the next tray.

### 📊 Diagram

```
  NODE.JS EVENT LOOP — one tick
  ──────────────────────────────────────────────────────────
  START
    │
    ▼
  ┌───────────────┐  nextTick queue drained first (recursive = stack overflow risk!)
  │ nextTick Queue│  ← process.nextTick() callbacks
  └───────┬───────┘
          │ empty
          ▼
  ┌───────────────┐  microtask queue (Promises)
  │ Microtask Q   │  ← Promise.then / .catch / .finally / await
  └───────┬───────┘
          │ empty
          ▼
  ┌─────────────────────────────────────────────────────┐
  │ PHASES (macro tasks)                                │
  │                                                     │
  │  timers      → setTimeout / setInterval callbacks  │
  │  pending I/O → deferred I/O callbacks               │
  │  idle/prep   → internal                             │
  │  poll        → wait for I/O events (blocks here     │
  │                if nothing else pending)             │
  │  check       → setImmediate callbacks               │
  │  close       → socket.on('close') etc.              │
  └─────────────────────────────────────────────────────┘
          │
          └─ after EACH phase: drain nextTick + microtask queues

  PRIORITY ORDER:
  process.nextTick  >  Promise.then  >  setImmediate  >  setTimeout(0)
```

### 💻 Code Example

```javascript
// Step 1: synchronous code runs first — always
console.log('1 sync');

// Step 2: nextTick queued — runs before any I/O or timer
process.nextTick(() => console.log('2 nextTick'));

// Step 3: Promise microtask — runs after nextTick queue is empty
Promise.resolve().then(() => console.log('3 Promise.then'));

// Step 4: setTimeout scheduled in timers phase — runs AFTER microtasks
setTimeout(() => console.log('4 setTimeout'), 0);

// Step 5: setImmediate fires in check phase — after poll phase
setImmediate(() => console.log('5 setImmediate'));

// Step 6: more sync — still part of current call stack
console.log('6 sync');

// OUTPUT ORDER:
// 1 sync
// 6 sync
// 2 nextTick       ← nextTick queue drained before microtasks
// 3 Promise.then   ← microtask queue
// 4 setTimeout     ← timers phase (may swap with setImmediate outside I/O)
// 5 setImmediate   ← check phase

// ── DANGER: recursive nextTick starves the event loop ────────────────
function starveLoop() {
  process.nextTick(starveLoop);  // ❌ NEVER DO THIS — infinite nextTick
}                                //    I/O, timers, Promises never run

// ── ASYNC/AWAIT = Promise.then under the hood ─────────────────────────
async function example() {
  console.log('A sync inside async');
  await Promise.resolve();
  console.log('B after await');  // runs in microtask queue
}
example();
console.log('C sync after call');
// Output: A → C → B
```

### 🔍 Step-by-Step Explanation

1. **Synchronous code** — Runs to completion on the call stack before the event loop checks any queue.
2. **`process.nextTick`** — Queued in the "nextTick queue", drained completely after the current operation AND after each individual phase transition. Higher priority than Promises.
3. **Promise microtasks** — Drained after the nextTick queue is empty, before any macro-task phase.
4. **Timers phase** — `setTimeout(fn, 0)` fires here, but "0" means "at least 0ms" — the actual minimum is ~1ms. Phase runs its queued callbacks then moves on.
5. **Check phase** — `setImmediate` fires here, always after poll. Inside an I/O callback, `setImmediate` reliably fires before `setTimeout(0)`.

### ⏱️ Complexity

| Queue | Priority | Draining |
|-------|----------|----------|
| `process.nextTick` | Highest | Fully drained before microtasks |
| Promise microtasks | High | Fully drained before macro phases |
| `setImmediate` | Medium | One per check phase |
| `setTimeout(0)` | Medium | One per timers phase |
| I/O callbacks | Low | Poll phase |

---

## Q40: What is the difference between `setImmediate` and `setTimeout(() => {}, 0)`?

### 🧒 ELI5
Both say "do this soon, but not right now." `setImmediate` says "do this after you finish checking your inbox (I/O)." `setTimeout(0)` says "do this after at least 0 milliseconds — check the clock first." When you're already inside an I/O callback, `setImmediate` always wins. Outside I/O, the order is unpredictable.

### 📊 Diagram

```
  EVENT LOOP PHASES (simplified):
  ─────────────────────────────────────────────────────
  timers → I/O → poll → CHECK → close
     ↑                    │
     │                    └── setImmediate fires here
     └── setTimeout(0) fires here

  INSIDE I/O CALLBACK:
  ─────────────────────────────────────────────────────
  fs.readFile() callback fires (poll phase)
       │
       ├─ setTimeout(0) → back to timers phase (NEXT loop)
       └─ setImmediate  → check phase (THIS loop, comes NEXT)
  
  → setImmediate ALWAYS fires before setTimeout(0) inside I/O

  OUTSIDE I/O (top level):
  ─────────────────────────────────────────────────────
  setTimeout(0) and setImmediate race:
  → Order is NON-DETERMINISTIC (depends on OS timer resolution)
  → May see either order in practice
```

### 💻 Code Example

```javascript
const fs = require('fs');

// ── OUTSIDE I/O — order is non-deterministic ─────────────────────────
setTimeout(() => console.log('setTimeout'), 0);
setImmediate(() => console.log('setImmediate'));
// Could print either order — don't rely on this!

// ── INSIDE I/O — setImmediate always wins ────────────────────────────
fs.readFile(__filename, () => {
  // Step 1: we are now inside the poll phase (I/O callback)
  setTimeout(() => console.log('timeout inside I/O'), 0);
  setImmediate(() => console.log('immediate inside I/O'));
  // Always prints: "immediate inside I/O" then "timeout inside I/O"
  // because check phase comes before timers in the SAME loop iteration
});

// ── PRACTICAL RULE ───────────────────────────────────────────────────
// Use setImmediate when you want to:
// - Schedule work after the current I/O events are processed
// - Break up CPU-heavy work without blocking I/O
// - Ensure code runs in the check phase (predictable in I/O context)

// Use setTimeout(0) when you need:
// - Compatibility with browser environments (setImmediate is Node-only)
// - A minimum delay (even if effectively 0)

// ── Breaking up CPU work with setImmediate ────────────────────────────
function processLargeArray(items, callback) {
  let index = 0;

  function processNext() {
    // Step 2: process a batch of 100 items
    const end = Math.min(index + 100, items.length);
    for (; index < end; index++) {
      heavyComputation(items[index]);
    }

    if (index < items.length) {
      // Step 3: yield to event loop via setImmediate — allows I/O between batches
      setImmediate(processNext);
    } else {
      callback();
    }
  }

  processNext();
}
```

### 🔍 Step-by-Step Explanation

1. **Phase positions** — `setTimeout` fires in the **timers** phase (first), `setImmediate` fires in the **check** phase (after poll). But the loop starts at timers — so outside I/O, which fires first depends on when the loop starts relative to timer registration.
2. **Inside I/O** — The current loop is already past the timers phase when the I/O callback runs. The next opportunity for timers is the *next iteration*, but check phase is *this iteration* → `setImmediate` always wins.
3. **CPU work chunking** — Using `setImmediate` between batches of heavy work lets the event loop process pending I/O between batches, keeping the server responsive.

### ⏱️ Complexity

| Scenario | When fires | Deterministic? |
|----------|-----------|---------------|
| Top-level `setImmediate` | Check phase | vs setTimeout: no |
| Top-level `setTimeout(0)` | Timers phase | vs setImmediate: no |
| `setImmediate` inside I/O | Check phase (same iteration) | Yes — before setTimeout |
| `setTimeout(0)` inside I/O | Timers phase (next iteration) | Yes — after setImmediate |

---

## Q41: What are Streams in Node.js? Explain all 4 types.

### 🧒 ELI5
Imagine water flowing through pipes. You don't fill a giant tank first — you let water flow continuously from source to destination. Node.js Streams are the same: process data in chunks as it arrives, not all at once. This saves memory when handling large files, network responses, or database results.

### 📊 Diagram

```
  4 STREAM TYPES:
  ──────────────────────────────────────────────────────────

  1. READABLE  — produces data (you consume it)
     Source ──▶ [chunk][chunk][chunk] ──▶ your code
     Examples: fs.createReadStream, http.IncomingMessage, process.stdin

  2. WRITABLE  — consumes data (you write into it)
     Your code ──▶ [chunk][chunk][chunk] ──▶ Destination
     Examples: fs.createWriteStream, http.ServerResponse, process.stdout

  3. DUPLEX    — both readable AND writable (independent channels)
     Data ──▶ [  DUPLEX  ] ──▶ Data
              [          ]
     Examples: net.Socket (TCP socket), WebSocket connection

  4. TRANSFORM — duplex where output is derived from input
     Input ──▶ [TRANSFORM] ──▶ Modified Output
     Examples: zlib.createGzip (compress), crypto.createCipher (encrypt),
               csv-parser, through2

  PIPELINE:
  ReadStream ──▶ Transform (gunzip) ──▶ Transform (parse) ──▶ WriteStream
  file.gz   ──▶ decompress          ──▶ uppercase         ──▶ file.txt
```

### 💻 Code Example

```javascript
const fs = require('fs');
const zlib = require('zlib');
const { Transform, pipeline } = require('stream');
const { promisify } = require('util');

const pipelineAsync = promisify(pipeline);

// ── 1. READABLE: custom readable stream ──────────────────────────────
const { Readable } = require('stream');

// Step 1: create a readable that emits numbers 1–10
const numberStream = new Readable({
  objectMode: true,  // allows non-Buffer chunks
  read() {}          // no-op; we push manually
});

for (let i = 1; i <= 10; i++) {
  numberStream.push(i);
}
numberStream.push(null);  // Step 2: null signals end of stream

// ── 2. WRITABLE: custom writable stream ──────────────────────────────
const { Writable } = require('stream');

const logWriter = new Writable({
  objectMode: true,
  // Step 3: _write called for each chunk
  write(chunk, encoding, callback) {
    console.log('Received:', chunk);
    callback();  // Step 4: MUST call callback to signal "ready for next chunk"
  },
});

// ── 3. TRANSFORM: uppercase transformer ──────────────────────────────
const { Transform } = require('stream');

const upperCase = new Transform({
  // Step 5: receives input chunk, pushes transformed output
  transform(chunk, encoding, callback) {
    this.push(chunk.toString().toUpperCase());
    callback();
  },
});

// ── 4. Full pipeline: read file → gzip → write ───────────────────────
async function compressFile(input, output) {
  // Step 6: pipeline handles backpressure AND cleans up on error
  await pipelineAsync(
    fs.createReadStream(input),    // Readable
    zlib.createGzip(),             // Transform (compress)
    fs.createWriteStream(output),  // Writable
  );
  console.log('Compression complete');
}

compressFile('large.log', 'large.log.gz');

// ── 5. Consuming a readable stream ───────────────────────────────────
async function readLines(filePath) {
  const rl = require('readline').createInterface({
    input: fs.createReadStream(filePath),  // Step 7: stream, not readFileSync
    crlfDelay: Infinity,
  });

  for await (const line of rl) {  // Step 8: async iteration over stream
    console.log(line);
  }
}
```

### 🔍 Step-by-Step Explanation

1. **Readable internal modes** — Flowing mode (data events push chunks automatically) and paused mode (you call `.read()` manually). `pipe()` and `for await` use flowing mode.
2. **`callback()`** — In `_write` and `_transform`, calling `callback()` signals "I'm done processing this chunk, send the next one." Not calling it = stream stalls (backpressure mechanism).
3. **`objectMode: true`** — By default streams operate on Buffers/strings. Object mode allows any JS value as a chunk — useful for streaming database rows.
4. **`pipeline` vs `pipe`** — `pipeline` (Node 10+) automatically destroys all streams and handles errors. Raw `pipe` leaks streams on error. Always prefer `pipeline`.
5. **Memory efficiency** — Reading a 10GB file with `createReadStream` uses ~64KB at a time. `readFileSync` loads all 10GB into RAM.

### ⏱️ Complexity

| Operation | Time | Space |
|-----------|------|-------|
| Stream 1GB file | O(N) | O(chunk) ≈ O(1) |
| `readFileSync` 1GB | O(N) | O(N) — whole file in RAM |
| Transform per chunk | O(C) | O(C) — C = chunk size |
| Pipeline setup | O(1) | O(1) |

---

## Q42: What is backpressure in streams and how does `.pipe()` handle it?

### 🧒 ELI5
Imagine filling bottles on a conveyor belt. If bottles arrive faster than you can cap them, they pile up and eventually fall off. Backpressure is the signal: "slow down, I'm full!" `.pipe()` is a smart conveyor controller that automatically pauses the source when the destination is overwhelmed and resumes when it catches up.

### 📊 Diagram

```
  WITHOUT BACKPRESSURE HANDLING:
  ─────────────────────────────────────────────────────
  ReadStream (fast) ──▶ WriteStream (slow)
  Reads 100MB/s         Writes 10MB/s
       │
       └─ internal buffer fills up → memory bloat → OOM crash

  WITH BACKPRESSURE (.pipe() / pipeline):
  ─────────────────────────────────────────────────────
  ReadStream ──▶ .pipe() ──▶ WriteStream
      │              │
      │   writable.write() returns false (buffer full)
      │              │
      │   .pipe() calls readable.pause() automatically
      │              │
      │   writable emits 'drain' (buffer flushed)
      │              │
      └── .pipe() calls readable.resume() automatically

  MANUAL write() return value:
  ─────────────────────────────────────────────────────
  const ok = writable.write(chunk);
  if (!ok) {
    readable.pause();                    // stop reading
    writable.once('drain', () => {
      readable.resume();                 // safe to continue
    });
  }
```

### 💻 Code Example

```javascript
const fs = require('fs');
const { pipeline, Transform } = require('stream');
const { promisify } = require('util');

// ── .pipe() — handles backpressure automatically ──────────────────────
// Step 1: .pipe() wires up 'drain' and 'pause' internally
fs.createReadStream('huge-file.txt')
  .pipe(new Transform({
    transform(chunk, enc, cb) {
      // simulate slow processing
      setTimeout(() => { this.push(chunk); cb(); }, 10);
    }
  }))
  .pipe(fs.createWriteStream('output.txt'));

// ── pipeline() — preferred: handles errors AND backpressure ───────────
const pipelineAsync = promisify(pipeline);

async function processFile() {
  await pipelineAsync(
    fs.createReadStream('huge-file.txt'),
    new Transform({
      transform(chunk, enc, cb) {
        this.push(chunk.toString().toUpperCase());
        cb();
      },
    }),
    fs.createWriteStream('output.txt'),
  );
  // Step 2: all streams destroyed on completion or error — no leaks
}

// ── MANUAL backpressure (for custom streams) ──────────────────────────
function safeCopy(readable, writable) {
  readable.on('data', (chunk) => {
    // Step 3: write returns false when internal buffer is full
    const ok = writable.write(chunk);

    if (!ok) {
      // Step 4: pause the source — stop producing data
      readable.pause();

      // Step 5: once writable drains its buffer, resume reading
      writable.once('drain', () => {
        readable.resume();
      });
    }
  });

  readable.on('end', () => writable.end());
  readable.on('error', (err) => writable.destroy(err));
}

// ── highWaterMark — controls buffer size ─────────────────────────────
// Step 6: increase buffer for high-throughput scenarios (default: 16KB)
const readStream = fs.createReadStream('file.txt', {
  highWaterMark: 64 * 1024,  // 64KB chunks
});
```

### 🔍 Step-by-Step Explanation

1. **`highWaterMark`** — Each stream has an internal buffer. When it exceeds `highWaterMark`, `write()` returns `false` — the backpressure signal.
2. **`.pipe()` magic** — Listens for `writable.write()` returning `false`, calls `readable.pause()`. Listens for `drain`, calls `readable.resume()`. This keeps memory bounded.
3. **`.pipe()` error problem** — If a stream in the middle of a chain errors, `.pipe()` doesn't automatically destroy the other streams — you get leaks. `pipeline()` fixes this.
4. **`pipeline`** — Node 10+ utility that wires up error handling AND backpressure for all streams in the chain. Always use `pipeline` over `.pipe()` for production code.

### ⏱️ Complexity

| Scenario | Memory | Reason |
|----------|--------|--------|
| No backpressure handling | O(N) | Buffer grows unbounded |
| `.pipe()` / `pipeline` | O(highWaterMark) | Bounded buffer |
| `highWaterMark: 64KB` | ~64KB peak | Fixed ceiling |

---

## Q43: What is the difference between Buffers and Streams? When would you use each?

### 🧒 ELI5
A **Buffer** is a bucket — you fill the whole bucket, carry it, and pour it out. A **Stream** is a hose — water flows continuously from tap to destination without filling a giant bucket first. Use a bucket for small amounts; use a hose for large volumes.

### 📊 Diagram

```
  BUFFER
  ─────────────────────────────────────────────────────
  fs.readFile('movie.mp4', (err, data) => {
    // 'data' is a Buffer — entire 4GB file in RAM!
    process(data);
  });

  Memory: [====4GB====]  ← entire file loaded

  STREAM
  ─────────────────────────────────────────────────────
  fs.createReadStream('movie.mp4').pipe(res);
  // 64KB at a time flows from disk → network
  
  Memory: [=64KB=]  ← only current chunk in RAM

  BUFFER USE CASES:           STREAM USE CASES:
  ───────────────             ──────────────────
  • Small files (<10MB)       • Large files (video, logs)
  • Binary data manipulation  • Real-time data (audio, video)
  • Crypto (hash, HMAC)       • HTTP responses (piped to client)
  • Network protocol parsing  • Database result sets
  • Image thumbnails          • File transformations
  • JSON payloads             • Compression / encryption pipeline
```

### 💻 Code Example

```javascript
// ── BUFFER: binary data manipulation ────────────────────────────────
const crypto = require('crypto');

// Step 1: Buffer.from — create from string, array, or ArrayBuffer
const buf = Buffer.from('Hello, World!', 'utf8');
console.log(buf);           // <Buffer 48 65 6c 6c 6f ...>
console.log(buf.length);    // 13 bytes
console.log(buf.toString()); // 'Hello, World!'

// Step 2: Buffer.alloc — fixed-size zeroed buffer (safe, use over allocUnsafe)
const safeBuf = Buffer.alloc(16);  // 16 bytes, all zeros

// Step 3: Buffer for crypto — HMAC needs binary data
function signPayload(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(Buffer.from(JSON.stringify(payload)))
    .digest('hex');
}

// Step 4: Buffer for image processing
const sharp = require('sharp');
app.post('/thumbnail', async (req, res) => {
  // Buffer OK here — thumbnail is small enough to hold in memory
  const thumbnail = await sharp(req.body)
    .resize(200, 200)
    .toBuffer();      // Step 5: returns Buffer with processed image
  res.send(thumbnail);
});

// ── STREAM: large file serving ───────────────────────────────────────
const fs = require('fs');

// Step 6: stream file directly to HTTP response — never loads into RAM
app.get('/video/:id', (req, res) => {
  const { range } = req.headers;
  const videoPath = `./videos/${req.params.id}.mp4`;
  const stat = fs.statSync(videoPath);

  if (range) {
    // Step 7: range request for video seeking
    const [start, end] = range.replace('bytes=', '').split('-').map(Number);
    const chunkSize = (end || stat.size - 1) - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end || stat.size - 1}/${stat.size}`,
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    });

    fs.createReadStream(videoPath, { start, end: end || stat.size - 1 }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': 'video/mp4' });
    fs.createReadStream(videoPath).pipe(res);  // Step 8: stream, don't buffer
  }
});
```

### 🔍 Step-by-Step Explanation

1. **`Buffer.alloc` vs `Buffer.allocUnsafe`** — `alloc` zeroes memory (safe, slight perf cost). `allocUnsafe` skips zeroing — old memory contents may be readable. Never use `allocUnsafe` for user-facing data.
2. **Buffers in crypto** — Hash/HMAC functions operate on raw bytes. `Buffer.from(string)` converts to UTF-8 bytes which is what crypto expects.
3. **Streams for HTTP responses** — `res.pipe()` lets Node write chunks as they're read from disk. Client starts receiving data immediately. No RAM penalty regardless of file size.
4. **When buffers are fine** — Anything under a few MB that needs random access (indexing into bytes) or must be passed to an API requiring a complete buffer (most crypto, image APIs).

### ⏱️ Complexity

| Operation | Buffer | Stream |
|-----------|--------|--------|
| Memory for 1GB file | O(N) = 1GB RAM | O(chunk) ≈ 64KB |
| First byte to client | After full read | Immediate |
| Random byte access | O(1) | Not supported |
| Transformation | Copy needed | In-place per chunk |

---

## Q44: How does the Node.js Cluster module work? How does it differ from Worker Threads?

### 🧒 ELI5
**Cluster** is like opening multiple identical restaurants on the same street — each is a full independent restaurant (process), and a manager (master) sends customers to whichever restaurant is free. **Worker Threads** is like one restaurant with multiple chefs at different stations — they share the same kitchen (memory) but work in parallel on different dishes.

### 📊 Diagram

```
  CLUSTER MODULE
  ─────────────────────────────────────────────────────
  Master Process (PID 1000)
  ├─ Listens on port 3000
  ├─ Distributes connections round-robin
  │
  ├─ Worker 1 (PID 1001) — full Node.js process
  ├─ Worker 2 (PID 1002) — full Node.js process
  ├─ Worker 3 (PID 1003) — full Node.js process
  └─ Worker 4 (PID 1004) — full Node.js process (= CPU cores)

  Communication: IPC (inter-process communication) — slow for big data
  Memory: SEPARATE — each worker has its own heap
  Crash: One worker crash doesn't affect others

  WORKER THREADS
  ─────────────────────────────────────────────────────
  Main Thread
  ├─ SharedArrayBuffer ──┐ shared memory (fast!)
  │                      │
  ├─ Worker Thread 1 ────┤
  ├─ Worker Thread 2 ────┤
  └─ Worker Thread 3 ────┘

  Communication: postMessage (structured clone) or SharedArrayBuffer
  Memory: CAN SHARE via SharedArrayBuffer/Atomics
  Use: CPU-bound tasks (image processing, crypto, ML)
  
  CHOOSING:
  ┌──────────────────┬─────────────────┬──────────────────┐
  │                  │ Cluster         │ Worker Threads   │
  ├──────────────────┼─────────────────┼──────────────────┤
  │ Best for         │ I/O-bound HTTP  │ CPU-bound tasks  │
  │ Memory           │ Isolated        │ Shareable        │
  │ Crash isolation  │ ✅              │ ❌ (crashes main)│
  │ Setup complexity │ Simple          │ More complex     │
  └──────────────────┴─────────────────┴──────────────────┘
```

### 💻 Code Example

```javascript
// ── CLUSTER: HTTP server across all CPU cores ─────────────────────────
const cluster = require('cluster');
const os = require('os');
const http = require('http');

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;  // Step 1: one worker per CPU core
  console.log(`Primary PID ${process.pid} — forking ${numCPUs} workers`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();  // Step 2: spawn worker processes
  }

  // Step 3: respawn crashed workers
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died — restarting`);
    cluster.fork();
  });

} else {
  // Step 4: each worker runs the same HTTP server code
  // Cluster OS distributes incoming connections across workers
  http.createServer((req, res) => {
    res.end(`Handled by worker PID ${process.pid}`);
  }).listen(3000);

  console.log(`Worker ${process.pid} started`);
}

// ── WORKER THREADS: CPU-bound task ────────────────────────────────────
// worker.js
const { workerData, parentPort } = require('worker_threads');

// Step 5: CPU-intensive task runs in separate thread (doesn't block event loop)
function computeHash(data) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}

parentPort.postMessage(computeHash(workerData));  // Step 6: send result back

// main.js
const { Worker } = require('worker_threads');

function hashInWorker(data) {
  return new Promise((resolve, reject) => {
    // Step 7: spawn worker for CPU work — main event loop stays free
    const worker = new Worker('./worker.js', { workerData: data });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

// Step 8: main thread stays responsive during hashing
app.post('/hash', async (req, res) => {
  const hash = await hashInWorker(req.body.data);
  res.json({ hash });
});
```

### 🔍 Step-by-Step Explanation

1. **Cluster for I/O-bound** — HTTP servers spend most time waiting for I/O. Multiple processes each with their own event loop = linear throughput scaling across cores.
2. **Worker Threads for CPU-bound** — Image resizing, video encoding, ML inference, or heavy cryptography blocks the event loop. Offload to a thread pool via Worker Threads.
3. **Memory isolation** — Cluster workers are separate processes with separate heaps. A memory leak in one worker won't affect others. Worker Threads share the V8 heap — a bug can corrupt shared state.
4. **`SharedArrayBuffer`** — Worker Threads can share a raw memory buffer. Use `Atomics` for synchronisation to avoid race conditions.
5. **PM2** — In production, PM2's cluster mode wraps Node's `cluster` module with monitoring, log aggregation, and graceful reloads.

### ⏱️ Complexity

| Operation | Cluster | Worker Threads |
|-----------|---------|----------------|
| Spawn time | ~50–200ms (fork process) | ~5–20ms (thread) |
| IPC message | O(M) copy | O(M) structured clone or O(1) shared buffer |
| Memory per unit | Full heap (~50MB) | Shared heap + stack |
| Max parallelism | CPU count | CPU count |

---

## Q45: What is `process.nextTick`? Why is it higher priority than Promises?

### 🧒 ELI5
`process.nextTick` is like tapping a coworker on the shoulder right now — before they can start their next task. Promise callbacks are like passing a note to be read after the current task finishes. The tap always gets attention faster than the note.

### 📊 Diagram

```
  CURRENT OPERATION (call stack)
         │
         │  completes
         ▼
  ┌─────────────────────────┐
  │  nextTick queue         │  ← ALL nextTick callbacks drained first
  └─────────────────────────┘
         │  empty
         ▼
  ┌─────────────────────────┐
  │  Promise microtask queue│  ← then all Promise.then callbacks
  └─────────────────────────┘
         │  empty
         ▼
  next event loop phase (timers → I/O → poll → check → close)

  WHY nextTick > Promises:
  ─────────────────────────────────────────────────────
  Historical: nextTick existed before Promises in Node.js
  Design: nextTick is a "same-phase epilogue" — runs before phase transition
  Promises are ECMAScript microtasks — added later as a separate queue
  Node chose to keep nextTick higher-priority for backward compatibility
```

### 💻 Code Example

```javascript
// Step 1: demonstrate priority ordering
Promise.resolve().then(() => console.log('Promise 1'));
process.nextTick(() => console.log('nextTick 1'));
Promise.resolve().then(() => console.log('Promise 2'));
process.nextTick(() => console.log('nextTick 2'));

// Output:
// nextTick 1
// nextTick 2
// Promise 1
// Promise 2

// ── VALID USE CASE: emit event after constructor returns ──────────────
const { EventEmitter } = require('events');

class MyEmitter extends EventEmitter {
  constructor() {
    super();
    // Step 2: if we emitted 'ready' synchronously here, callers who register
    // listeners AFTER construction would miss it
    // nextTick defers emission until after construction completes
    process.nextTick(() => this.emit('ready'));
  }
}

const emitter = new MyEmitter();
// Step 3: listener registered AFTER constructor — still catches 'ready'
emitter.on('ready', () => console.log('emitter is ready'));

// ── VALID USE CASE: ensure async callback consistency ─────────────────
function readData(id, callback) {
  if (cache.has(id)) {
    // Step 4: without nextTick, this is synchronous — inconsistent behaviour
    // callers might experience both sync and async code paths
    process.nextTick(() => callback(null, cache.get(id)));  // always async
    return;
  }
  db.find(id, callback);
}

// ── DANGER: accidental recursion ─────────────────────────────────────
// Step 5: recursive nextTick starves the event loop
// NEVER do this:
function badRecurse() {
  process.nextTick(badRecurse);  // ❌ I/O never runs
}

// Use setImmediate for recursive deferral instead:
function goodRecurse(items, index) {
  if (index >= items.length) return;
  process(items[index]);
  setImmediate(() => goodRecurse(items, index + 1));  // ✅ yields to I/O
}
```

### 🔍 Step-by-Step Explanation

1. **Two queues** — Node.js maintains two microtask-like queues: the nextTick queue (internal V8/libuv) and the Promise queue (ECMAScript spec). The nextTick queue is drained first.
2. **Consistency pattern** — Use `process.nextTick` to make a callback always asynchronous when it may sometimes be synchronous (cached value). This prevents "Zalgo" — the bug where a function is sometimes sync, sometimes async.
3. **EventEmitter pattern** — Deferring `emit` to nextTick ensures all listeners can register before the event fires.
4. **Avoid deep nextTick recursion** — Each nextTick callback is processed before any I/O. Recursive nextTick = starvation. Use `setImmediate` for iteration that should yield to I/O.

### ⏱️ Complexity

| Queue | Drains | Notes |
|-------|--------|-------|
| nextTick | Before microtasks | Can starve if recursive |
| Promise microtask | After nextTick | Also drains fully each phase |
| Combined queues | Before each macro phase | Both checked after each I/O event too |

---

## Q46: How do you handle `uncaughtException` and `unhandledRejection` in production?

### 🧒 ELI5
`uncaughtException` is your app's last-chance smoke alarm — it fires when something exploded and nobody caught it. `unhandledRejection` is when a Promise fails and nobody listened to the failure. Both need a proper response: log the disaster, alert someone, and exit safely — don't silently ignore them or your app will be in an unknown, corrupted state.

### 📊 Diagram

```
  uncaughtException
  ─────────────────────────────────────────────────────
  throw new Error('oops')   → no try/catch around it
         │
         ▼
  process.on('uncaughtException', handler)
         │
  handler runs  →  log  →  notify  →  process.exit(1)
  ⚠️  App state is CORRUPT — exit is mandatory after complex errors

  unhandledRejection
  ─────────────────────────────────────────────────────
  fetchData()   // returns Promise
  // no .catch() and no await in try/catch
         │
         Promise rejects
         │
         ▼
  process.on('unhandledRejection', handler)
         │
  In Node 15+: process exits with code 1 automatically
  In Node 14-: just a warning (dangerous — silent failures)

  BEST PRACTICE:
  ─────────────────────────────────────────────────────
  uncaughtException → log → graceful shutdown → exit(1)
  unhandledRejection → log → optionally exit(1)
  Both → alert on-call (PagerDuty, Datadog, Sentry)
```

### 💻 Code Example

```javascript
const Sentry = require('@sentry/node');

Sentry.init({ dsn: process.env.SENTRY_DSN });

// ── uncaughtException ─────────────────────────────────────────────────
process.on('uncaughtException', (error, origin) => {
  // Step 1: log with full context — error might reveal compromised state
  console.error('UNCAUGHT EXCEPTION:', { error: error.message, origin, stack: error.stack });

  // Step 2: report to error tracking before we exit
  Sentry.captureException(error);

  // Step 3: attempt graceful shutdown — close DB connections, HTTP server
  // Wrap in timeout in case the shutdown itself hangs
  gracefulShutdown().finally(() => {
    // Step 4: MUST exit — process state is unknown after uncaught exception
    // Do NOT continue running — this is the dangerous anti-pattern
    process.exit(1);
  });
});

// ── unhandledRejection ────────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  // Step 5: reason is the rejection value; promise is the rejected Promise
  console.error('UNHANDLED REJECTION:', { reason, promise });
  Sentry.captureException(reason);

  // Step 6: in Node 15+ this exits automatically; be explicit for clarity
  process.exit(1);
});

// ── Graceful shutdown helper ──────────────────────────────────────────
async function gracefulShutdown() {
  // Step 7: stop accepting new connections
  await new Promise((resolve) => server.close(resolve));

  // Step 8: drain in-flight requests (timeout after 5s)
  await Promise.race([
    drainConnections(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Shutdown timeout')), 5000)),
  ]);

  // Step 9: close database pool
  await db.end();
}

// ── PREVENTION: avoid unhandledRejection in the first place ──────────
// Always await with try/catch or attach .catch():

// ❌ BAD — fire and forget (unhandled rejection if this fails)
sendEmail(user);

// ✅ GOOD
sendEmail(user).catch((err) => {
  logger.warn('Email send failed, queuing for retry', err);
  emailQueue.add(user);
});

// ✅ GOOD — Express async error handling
app.get('/user/:id', async (req, res, next) => {
  try {
    const user = await db.findUser(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);  // Step 10: pass to Express error middleware
  }
});
```

### 🔍 Step-by-Step Explanation

1. **Do NOT recover from `uncaughtException`** — The process state is unknown. Memory may be corrupted. Attempting to continue is a security and reliability risk. Log, notify, and exit.
2. **`unhandledRejection` is a code bug** — Every Promise in production code must have error handling. Node 15+ was changed to exit on unhandled rejections to force developers to handle them.
3. **Graceful shutdown** — Before exiting, stop accepting new connections, finish in-flight requests, and close DB pools. This prevents data corruption.
4. **Restart with a process manager** — PM2, systemd, or Kubernetes will restart the process after `exit(1)`. This is the correct recovery mechanism — not catching and ignoring.
5. **`origin` in `uncaughtException`** — The second argument (`'uncaughtException'` or `'unhandledRejection'`) helps distinguish the source.

### ⏱️ Complexity

| Operation | Cost | Notes |
|-----------|------|-------|
| `process.on` handler | O(1) | Single event listener |
| Sentry capture | O(1) async | Non-blocking HTTP report |
| Graceful shutdown | O(C) | C = in-flight connections |
| `process.exit(1)` | O(1) | Immediate OS-level termination |

---

## Q47: What causes a memory leak in Node.js? How do you detect and fix it?

### 🧒 ELI5
Memory leaks are like never throwing away old mail. Over time, your desk (RAM) fills up. In Node.js, old mail = objects that are no longer needed but still have a reference somewhere, so the garbage collector can't throw them away. The garbage truck (GC) can't take what's still "claimed."

### 📊 Diagram

```
  COMMON LEAK SOURCES:
  ─────────────────────────────────────────────────────
  1. Global variables / growing caches
     global.cache = {};
     setInterval(() => cache[Date.now()] = heavyObject, 1);
     → cache grows forever, never cleared

  2. Event listeners not removed
     emitter.on('data', handler);   // added on every request
     // handler holds closure over large object
     // never emitter.off() → handler count grows

  3. Closures over large objects
     function createLeak() {
       const bigArray = new Array(1000000).fill(0);
       return () => bigArray[0]; // closure retains bigArray
     }

  4. Timers not cleared
     setInterval(fn, 1000);  // created per request, never clearInterval'd

  5. Circular references (less common — GC handles most)

  DETECTION TOOLS:
  ─────────────────────────────────────────────────────
  • node --inspect → Chrome DevTools heap snapshot
  • clinic.js doctor (npm i -g clinic)
  • heapdump package
  • process.memoryUsage() monitoring
  • Datadog / New Relic APM
```

### 💻 Code Example

```javascript
// ── LEAK 1: unbounded cache ───────────────────────────────────────────
// ❌ BAD — cache grows forever
const cache = {};
app.get('/data/:id', async (req, res) => {
  if (!cache[req.params.id]) {
    cache[req.params.id] = await fetchExpensiveData(req.params.id);
  }
  res.json(cache[req.params.id]);
});

// ✅ FIX — use LRU cache with size limit
const LRU = require('lru-cache');
const cache = new LRU({ max: 500, ttl: 1000 * 60 * 5 }); // 500 items, 5min TTL

// ── LEAK 2: event listeners ───────────────────────────────────────────
// ❌ BAD — new listener added every time, never removed
class DataProcessor extends EventEmitter {
  start() {
    externalEmitter.on('data', this.processData.bind(this)); // grows per call!
  }
}
// Step 1: save reference to bound handler so it can be removed
class DataProcessor extends EventEmitter {
  constructor() {
    super();
    this._handler = this.processData.bind(this); // Step 2: stable reference
  }
  start()  { externalEmitter.on('data', this._handler); }
  stop()   { externalEmitter.off('data', this._handler); } // ✅ remove on stop
}

// ── LEAK 3: timer not cleared ─────────────────────────────────────────
// ❌ BAD — interval created per WebSocket connection, never cleared
wss.on('connection', (socket) => {
  setInterval(() => socket.send(JSON.stringify(getMetrics())), 1000);
  // socket closes but interval keeps firing, holding reference
});

// ✅ FIX
wss.on('connection', (socket) => {
  const id = setInterval(() => socket.send(JSON.stringify(getMetrics())), 1000);
  socket.on('close', () => clearInterval(id)); // Step 3: clean up on disconnect
});

// ── DETECTION: memory usage monitoring ───────────────────────────────
setInterval(() => {
  const { heapUsed, heapTotal, rss } = process.memoryUsage();
  console.log({
    heapUsed: `${Math.round(heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(rss / 1024 / 1024)}MB`,
  });
  // Step 4: alert if heapUsed grows steadily over time
}, 30_000);

// ── DETECTION: heap snapshot via --inspect ────────────────────────────
// Step 5: run with: node --inspect server.js
// Open chrome://inspect → take heap snapshot → load test → take another
// Compare: look for growing object counts (especially Strings, Arrays, closures)

// ── WeakMap for safe caching of objects ──────────────────────────────
// Step 6: WeakMap doesn't prevent GC — entry disappears when key is GC'd
const nodeMetadata = new WeakMap();

function annotateNode(node, data) {
  nodeMetadata.set(node, data);  // when 'node' is GC'd, entry auto-removed
}
```

### 🔍 Step-by-Step Explanation

1. **GC can't collect reachable objects** — JavaScript's GC uses reachability: if any reference path from a root (global, stack) leads to an object, it stays alive. Leaks = unintended roots.
2. **LRU cache** — An unbounded `{}` as a cache is the most common Node.js production leak. `lru-cache` evicts least-recently-used entries and supports TTL.
3. **Event listener limit** — Node emits a MaxListenersExceededWarning at 10 listeners by default. Always `off()` listeners when the component/connection/server is torn down.
4. **`process.memoryUsage()`** — `heapUsed` steadily increasing over hours/days (with constant load) is the signature of a leak. A single heap snapshot shows the count and size of retained objects.
5. **`WeakMap` / `WeakRef`** — For caches keyed on objects, use `WeakMap`. Keys are held weakly — GC can collect them even if the WeakMap entry exists. No leak risk.
6. **Heap snapshot workflow** — Take snapshot at baseline → run load test for 30 min → take another snapshot → compare retained objects. Look for unexpected counts of DOM-like objects, closures, or your own classes.

### ⏱️ Complexity

| Fix | Cost | Benefit |
|-----|------|---------|
| LRU cache | O(1) eviction | Bounded memory |
| `off()` listener | O(1) | Removes reference |
| `clearInterval` | O(1) | Releases timer + closure |
| WeakMap key | O(1) | Auto-GC of entries |
| Heap snapshot diff | O(H) | H = heap object count |

---

## End of Section: NODE.JS — Core (Q39–Q47)

---
