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
