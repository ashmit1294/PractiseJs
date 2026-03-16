# React — Interview Revision Summary

> **Target:** 7+ year Full Stack MERN Developer | **Status:** ✅ All hooks patterns enriched with WHAT/THEORY | **Files:** 10

## Update Notes

🔄 **Latest Enhancement (March 2026):**
- File 01_useState_useEffect.jsx: All 8 React hooks questions enriched with WHAT/THEORY format
- Each question includes core problem and 2-3 theory bullet points
- Examples: Stale closures, state merging, cleanup patterns, batching

## Table of Contents

1. [01_useState_useEffect.jsx — QUESTION SET: useState & useEffect — most asked React hooks](#react-usestate-useeffect)
2. [02_custom_hooks.jsx — QUESTION SET: Custom Hooks](#react-custom-hooks)
3. [03_useReducer_useContext.jsx — QUESTION SET: useReducer & useContext](#react-usereducer-usecontext)
4. [04_useMemo_useCallback.jsx — QUESTION SET: useMemo & useCallback — React Performance Hooks](#react-usememo-usecallback)
5. [05_useRef_forwardRef.jsx — QUESTION SET: useRef, forwardRef & useImperativeHandle](#react-useref-forwardref)
6. [06_component_patterns.jsx — QUESTION SET: Component Patterns](#react-component-patterns)
7. [07_lazy_suspense_errorboundary.jsx — QUESTION SET: React.lazy, Suspense, Error Boundaries & Code Splitting](#react-lazy-suspense-errorboundary)
8. [08_advanced_patterns.jsx — QUESTION SET: Advanced React Patterns](#react-advanced-patterns)
9. [09_solid_principles.jsx — SOLID PRINCIPLES IN REACT](#react-solid-principles)
10. [FILE: 10_theory_interview_qa.jsx](#react-theory-interview-qa)
   - [Scenario-Based Questions](#react-scenarios)

---

<a id="react-usestate-useeffect"></a>
## 01_useState_useEffect.jsx — QUESTION SET: useState & useEffect — most asked React hooks

```jsx
/**
 * QUESTION SET: useState & useEffect — most asked React hooks
 *
 * useState  → local component state
 * useEffect → side effects (fetch, subscriptions, DOM manipulations)
 *
 * Key rules:
 *   - Hook rules: only call at top level, only in function components
 *   - useEffect cleanup: return a function to clean up subscriptions/timers
 *   - Dependency array: [] = mount only, [val] = on val change, omit = every render
 */

import React, { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────
// Q1. Counter with useState
// What is the issue with stale closures in setState?
// ─────────────────────────────────────────────
function Counter() {
  const [count, setCount] = useState(0);

  // BUG: stale closure — always increments from snapshot value
  function handleBuggy() {
    setTimeout(() => setCount(count + 1), 1000); // `count` captured at call time
  }

  // CORRECT: functional update — always uses latest state
  function handleCorrect() {
    setTimeout(() => setCount((prev) => prev + 1), 1000);
  }

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
      <button onClick={handleCorrect}>Delayed Increment (correct)</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q2. Object state — merging pitfall
// setState REPLACES, not merges, object state
// ─────────────────────────────────────────────
function UserForm() {
  const [user, setUser] = useState({ name: "", email: "", age: 0 });

  function handleChange(field, value) {
    // WRONG: setUser({ name: value }) — loses email and age!
    setUser((prev) => ({ ...prev, [field]: value })); // CORRECT: spread first
  }

  return (
    <input
      value={user.name}
      onChange={(e) => handleChange("name", e.target.value)}
      placeholder="Name"
    />
  );
}

// ─────────────────────────────────────────────
// Q3. Lazy initialization of useState
// Pass a function when initial state is expensive to compute
// ─────────────────────────────────────────────
function ExpensiveInit() {
  // WRONG: computeHeavy() runs on EVERY render
  // const [data, setData] = useState(computeHeavy());

  // CORRECT: function runs ONCE on mount
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem("data");
    return saved ? JSON.parse(saved) : [];
  });

  return <div>{data.length} items</div>;
}

// ─────────────────────────────────────────────
// Q4. useEffect — data fetching with cleanup
// Prevent setting state on unmounted component (race condition)
// ─────────────────────────────────────────────
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false; // cleanup flag

    async function fetchUser() {
      try {
        setLoading(true);
        const res = await fetch(`/api/users/${userId}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        if (!cancelled) setUser(data); // only update if still mounted
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchUser();

    return () => { cancelled = true; }; // cleanup on unmount or userId change
  }, [userId]); // re-run whenever userId changes

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;
  return <div>{user?.name}</div>;
}

// ─────────────────────────────────────────────
// Q5. useEffect — subscription cleanup
// Always clean up subscriptions to avoid memory leaks
// ─────────────────────────────────────────────
function WindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    function handleResize() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize); // CLEANUP
  }, []); // empty deps = mount/unmount only

  return <p>{size.width} x {size.height}</p>;
}

// ─────────────────────────────────────────────
// Q6. useEffect — interval with cleanup
// ─────────────────────────────────────────────
function Timer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => s + 1); // functional update avoids stale closure
    }, 1000);

    return () => clearInterval(interval); // clear on unmount
  }, []); // no deps needed — functional update

  return <p>Elapsed: {seconds}s</p>;
}

// ─────────────────────────────────────────────
// Q7. Batch state updates
// React 18: ALL state updates are batched (even in async/setTimeout)
// React 17: only batched in event handlers
// ─────────────────────────────────────────────
function BatchingDemo() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);

  function handleClick() {
    // React 18: BOTH updates are batched → single re-render
    setA((x) => x + 1);
    setB((x) => x + 1);
    // Before React 18 (in setTimeout), each line caused a re-render
  }

  // Force synchronous update (rarely needed):
  // import { flushSync } from 'react-dom';
  // flushSync(() => setA(1)); // causes immediate re-render

  return <button onClick={handleClick}>A:{a} B:{b}</button>;
}

// ─────────────────────────────────────────────
// Q8. useEffect ordering & cleanup execution order
// Parent mounts → Child mounts → Child effect runs → Parent effect runs
// Child unmounts → Child cleanup → Child effect (if re-run)
// ─────────────────────────────────────────────

/*
  INTERVIEW QUESTIONS — THEORY

  Q: When does useEffect run?
  A: After every render (including mount), after the browser has painted.

  Q: What happens if you omit the dependency array?
  A: Effect runs after EVERY render.

  Q: Difference between useEffect and useLayoutEffect?
  A: useLayoutEffect runs SYNCHRONOUSLY after DOM mutations but BEFORE paint.
     Use for measuring DOM, avoiding flicker. useEffect runs after paint.

  Q: What is the StrictMode double-invoke behavior?
  A: In React 18 StrictMode (dev only), effects are mounted → unmounted →
     remounted to help detect missing cleanup. Your cleanup must be correct.

  Q: Can you have async useEffect?
  A: Not directly — you can't pass async function directly (returns Promise,
     not cleanup function). Wrap async logic inside the effect.
     useEffect(() => { async function f() { await ... } f(); }, []);
*/

export { Counter, UserProfile, WindowSize, Timer, BatchingDemo };

---
```

<a id="react-custom-hooks"></a>
## 02_custom_hooks.jsx — QUESTION SET: Custom Hooks

```jsx
/**
 * QUESTION SET: Custom Hooks
 *
 * Custom hooks let you extract component logic into reusable functions.
 * Rules: must start with "use", can call other hooks inside.
 *
 * Pattern: extract anything involving hooks from a component → custom hook
 */

import { useState, useEffect, useCallback, useRef, useReducer } from "react";

// ─────────────────────────────────────────────
// Q1. useFetch — generic data fetching hook
// ─────────────────────────────────────────────
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => { if (!cancelled) setData(json); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [url]);

  return { data, loading, error };
}

// Usage:
// const { data, loading, error } = useFetch("/api/users");

// ─────────────────────────────────────────────
// Q2. useLocalStorage — persist state in localStorage
// ─────────────────────────────────────────────
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.error("useLocalStorage set error:", error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}

// ─────────────────────────────────────────────
// Q3. useDebounce — debounce a value
// Different from debouncing a function — debounces the VALUE itself
// ─────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Usage: search only fires API call 300ms after user stops typing
// const debouncedSearch = useDebounce(searchTerm, 300);
// useEffect(() => { fetchResults(debouncedSearch); }, [debouncedSearch]);

// ─────────────────────────────────────────────
// Q4. usePrevious — track previous value of state/prop
// ─────────────────────────────────────────────
function usePrevious(value) {
  const ref = useRef(undefined);
  useEffect(() => {
    ref.current = value; // updates AFTER render
  });
  return ref.current; // returns value from PREVIOUS render
}

// ─────────────────────────────────────────────
// Q5. useToggle — boolean toggle
// ─────────────────────────────────────────────
function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);
  const toggle = useCallback(() => setValue((v) => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);
  return [value, toggle, setTrue, setFalse];
}

// ─────────────────────────────────────────────
// Q6. useEventListener — attach/cleanup event listeners
// ─────────────────────────────────────────────
function useEventListener(eventName, handler, element = window) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler; // always up-to-date handler ref
  }, [handler]);

  useEffect(() => {
    if (!element?.addEventListener) return;
    const listener = (event) => savedHandler.current(event);
    element.addEventListener(eventName, listener);
    return () => element.removeEventListener(eventName, listener);
  }, [eventName, element]);
}

// ─────────────────────────────────────────────
// Q7. useOnClickOutside — close dropdown/modal on outside click
// ─────────────────────────────────────────────
function useOnClickOutside(ref, handler) {
  useEffect(() => {
    function listener(event) {
      if (!ref.current || ref.current.contains(event.target)) return;
      handler(event);
    }
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

// ─────────────────────────────────────────────
// Q8. useIntersectionObserver — infinite scroll / lazy images
// ─────────────────────────────────────────────
function useIntersectionObserver(ref, options = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      options
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, options.threshold, options.root, options.rootMargin]);

  return isIntersecting;
}

// ─────────────────────────────────────────────
// Q9. useMediaQuery — responsive design in JS
// ─────────────────────────────────────────────
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);

    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query, matches]);

  return matches;
}

// Usage: const isMobile = useMediaQuery("(max-width: 768px)");

// ─────────────────────────────────────────────
// Q10. useAsync — track async operation state (loading/error/data)
// ─────────────────────────────────────────────
function useAsync(asyncFn, immediate = true) {
  const [status, setStatus] = useState("idle");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const execute = useCallback(
    (...args) => {
      setStatus("loading");
      setData(null);
      setError(null);

      return asyncFn(...args)
        .then((result) => { setData(result); setStatus("success"); return result; })
        .catch((err) => { setError(err); setStatus("error"); throw err; });
    },
    [asyncFn]
  );

  useEffect(() => {
    if (immediate) execute();
  }, [execute, immediate]);

  return { execute, status, data, error,
    isIdle: status === "idle",
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError: status === "error",
  };
}

// ─────────────────────────────────────────────
// Q11. useWhyDidYouUpdate — debugging re-renders
// Logs which props/state caused the component to re-render
// ─────────────────────────────────────────────
function useWhyDidYouUpdate(name, props) {
  const previousProps = useRef({});

  useEffect(() => {
    const allKeys = Object.keys({ ...previousProps.current, ...props });
    const changed = {};

    allKeys.forEach((key) => {
      if (previousProps.current[key] !== props[key]) {
        changed[key] = {
          from: previousProps.current[key],
          to: props[key],
        };
      }
    });

    if (Object.keys(changed).length) {
      console.log(`[${name}] re-rendered due to:`, changed);
    }
    previousProps.current = props;
  });
}

// ─────────────────────────────────────────────
// Q12. useUndoRedo — undo/redo state management
// ─────────────────────────────────────────────
function useUndoRedo(initialState) {
  const [history, setHistory] = useState([initialState]);
  const [index, setIndex] = useState(0);

  const state = history[index];

  const setState = useCallback((newState) => {
    const newHistory = history.slice(0, index + 1); // discard future
    setHistory([...newHistory, newState]);
    setIndex(newHistory.length);
  }, [history, index]);

  const undo = useCallback(() => {
    if (index > 0) setIndex(index - 1);
  }, [index]);

  const redo = useCallback(() => {
    if (index < history.length - 1) setIndex(index + 1);
  }, [index, history.length]);

  return {
    state, setState,
    undo, redo,
    canUndo: index > 0,
    canRedo: index < history.length - 1,
  };
}

export {
  useFetch, useLocalStorage, useDebounce, usePrevious,
  useToggle, useEventListener, useOnClickOutside,
  useIntersectionObserver, useMediaQuery, useAsync,
  useWhyDidYouUpdate, useUndoRedo,
};

---
```

<a id="react-usereducer-usecontext"></a>
## 03_useReducer_useContext.jsx — QUESTION SET: useReducer & useContext

```jsx
/**
 * QUESTION SET: useReducer & useContext
 *
 * useReducer → complex state logic with actions (like Redux, but local)
 * useContext → share data across component tree without prop-drilling
 *
 * Pattern: useContext + useReducer = lightweight global state manager
 */

import React, {
  useReducer, useContext, createContext,
  useCallback, useMemo, useRef,
} from "react";

// ─────────────────────────────────────────────
// Q1. Basic useReducer — Counter
// useReducer(reducer, initialState) → [state, dispatch]
// ─────────────────────────────────────────────
const counterReducer = (state, action) => {
  switch (action.type) {
    case "INCREMENT":  return { count: state.count + (action.payload ?? 1) };
    case "DECREMENT":  return { count: state.count - (action.payload ?? 1) };
    case "RESET":      return { count: 0 };
    case "SET":        return { count: action.payload };
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
};

function CounterWithReducer() {
  const [state, dispatch] = useReducer(counterReducer, { count: 0 });

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => dispatch({ type: "INCREMENT" })}>+1</button>
      <button onClick={() => dispatch({ type: "INCREMENT", payload: 5 })}>+5</button>
      <button onClick={() => dispatch({ type: "DECREMENT" })}>-1</button>
      <button onClick={() => dispatch({ type: "RESET" })}>Reset</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q2. Shopping Cart with useReducer
// Real-world example: add, remove, update quantity, clear
// ─────────────────────────────────────────────
const cartReducer = (state, action) => {
  switch (action.type) {
    case "ADD_ITEM": {
      const existing = state.items.find((i) => i.id === action.payload.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === action.payload.id ? { ...i, qty: i.qty + 1 } : i
          ),
        };
      }
      return { ...state, items: [...state.items, { ...action.payload, qty: 1 }] };
    }
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((i) => i.id !== action.payload) };
    case "UPDATE_QTY":
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.payload.id ? { ...i, qty: action.payload.qty } : i
        ).filter((i) => i.qty > 0),
      };
    case "CLEAR":
      return { items: [] };
    default:
      return state;
  }
};

// ─────────────────────────────────────────────
// Q3. useContext — basic usage
// Avoids prop-drilling: pass data to deeply nested components
// ─────────────────────────────────────────────
const ThemeContext = createContext("light");

function ThemeProvider({ children }) {
  const [theme, setTheme] = React.useState("light");
  const toggle = useCallback(() =>
    setTheme((t) => (t === "light" ? "dark" : "light")), []);

  // Memoize value to prevent unnecessary re-renders
  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Custom hook to use the context — throws if used outside provider
function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

function ThemedButton() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      style={{ background: theme === "dark" ? "#333" : "#fff" }}
    >
      Toggle Theme (currently: {theme})
    </button>
  );
}

// ─────────────────────────────────────────────
// Q4. Global State with Context + useReducer
// Mini Redux implementation using built-in React APIs
// ─────────────────────────────────────────────
const initialAppState = {
  user: null,
  notifications: [],
  isLoading: false,
};

function appReducer(state, action) {
  switch (action.type) {
    case "LOGIN":
      return { ...state, user: action.payload };
    case "LOGOUT":
      return { ...state, user: null };
    case "ADD_NOTIFICATION":
      return { ...state, notifications: [...state.notifications, action.payload] };
    case "REMOVE_NOTIFICATION":
      return { ...state, notifications: state.notifications.filter((n) => n.id !== action.payload) };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

const AppStateContext = createContext(null);
const AppDispatchContext = createContext(null);

function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  return (
    // Separate contexts for state and dispatch: components that only dispatch
    // don't re-render when state changes
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

const useAppState = () => useContext(AppStateContext);
const useAppDispatch = () => useContext(AppDispatchContext);

// ─────────────────────────────────────────────
// Q5. Context performance optimization
// Problem: ALL consumers re-render when context value changes
// Solution: split context, memoize value, use selectors
// ─────────────────────────────────────────────

// BAD: single large context — every consumer re-renders on ANY change
// const AppContext = createContext({ user, cart, theme, notifications });

// GOOD: split by update frequency
// const UserContext = createContext(user);         // rarely changes
// const CartContext = createContext(cart);         // changes often
// const ThemeContext = createContext(theme);       // user-triggered

// GOOD: memoize complex value objects
function OptimizedProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);

  // Memoize actions to prevent new object every render
  const actions = useMemo(() => ({
    login: (user) => dispatch({ type: "LOGIN", payload: user }),
    logout: () => dispatch({ type: "LOGOUT" }),
    setLoading: (v) => dispatch({ type: "SET_LOADING", payload: v }),
  }), []); // dispatch is stable — no deps needed

  const value = useMemo(() => ({ ...state, ...actions }), [state, actions]);

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Q6. Context with useRef for imperative API
// (Modal, Toast, Drawer — call programmatically)
// ─────────────────────────────────────────────
const ModalContext = createContext(null);

function ModalProvider({ children }) {
  const [modal, setModal] = React.useState(null);

  const open = useCallback((content) => setModal(content), []);
  const close = useCallback(() => setModal(null), []);

  return (
    <ModalContext.Provider value={{ open, close }}>
      {children}
      {modal && (
        <div className="modal-overlay" onClick={close}>
          <div onClick={(e) => e.stopPropagation()}>{modal}</div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

const useModal = () => useContext(ModalContext);

/*
  INTERVIEW QUESTIONS — THEORY

  Q: When to use useState vs useReducer?
  A: useState for simple, independent state.
     useReducer for complex state with multiple sub-values, or when next
     state depends on previous state with multiple possible transitions.
     useReducer is also easier to test (pure function).

  Q: What is context propagation?
  A: When a context value changes, all consuming components re-render,
     even if the specific part of the value they use hasn't changed.

  Q: How to prevent context re-renders?
  A: 1. Split context by update frequency
     2. useMemo on the value object
     3. Use React.memo on child components
     4. Use selector pattern with useMemo in consumer

  Q: Is Context a replacement for Redux?
  A: For small-medium apps, yes. For large apps with complex update logic,
     time-travel debugging, or middleware needs, Redux/Zustand is better.
     Context also doesn't have built-in performance optimization for selectors.
*/

export {
  CounterWithReducer, cartReducer, ThemeProvider, useTheme,
  AppProvider, useAppState, useAppDispatch, ModalProvider, useModal,
};

---
```

<a id="react-usememo-usecallback"></a>
## 04_useMemo_useCallback.jsx — QUESTION SET: useMemo & useCallback — React Performance Hooks

```jsx
/**
 * QUESTION SET: useMemo & useCallback — React Performance Hooks
 *
 * useMemo    → memoizes a COMPUTED VALUE, recalculates only when deps change
 * useCallback → memoizes a FUNCTION REFERENCE, recreates only when deps change
 *
 * Both prevent unnecessary work. Over-memoization is also a problem.
 */

import React, {
  useMemo, useCallback, useReducer,
  useState, memo, useEffect, useRef,
} from "react";

// ─────────────────────────────────────────────
// Q1. useMemo — expensive computation
// Without useMemo, this re-runs on EVERY parent render
// ─────────────────────────────────────────────
function ExpensiveList({ items, filter }) {
  // Only recomputes when `items` or `filter` changes
  const filtered = useMemo(() => {
    console.log("Filtering…");
    return items.filter((item) =>
      item.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [items, filter]);

  return (
    <ul>
      {filtered.map((item) => <li key={item.id}>{item.name}</li>)}
    </ul>
  );
}

// ─────────────────────────────────────────────
// Q2. When NOT to use useMemo
// Adding useMemo to cheap operations HURTS performance due to overhead
// ─────────────────────────────────────────────

// BAD — trivial computation, useMemo costs more than it saves
function BadMemo({ a, b }) {
  const sum = useMemo(() => a + b, [a, b]); // ← unnecessary, just do: a + b
  return <p>{sum}</p>;
}

// GOOD — useMemo appropriate for sorting large arrays
function GoodMemo({ largeArray }) {
  const sorted = useMemo(() =>
    [...largeArray].sort((a, b) => a.score - b.score), [largeArray]);
  return <pre>{JSON.stringify(sorted)}</pre>;
}

// ─────────────────────────────────────────────
// Q3. useCallback — stable function reference for child components
// Without it, a new function is created on every render,
// breaking React.memo on child components
// ─────────────────────────────────────────────

// Child wrapped in React.memo: skips re-render if props unchanged
const ChildButton = memo(function ChildButton({ onClick, label }) {
  console.log("ChildButton render:", label);
  return <button onClick={onClick}>{label}</button>;
});

function Parent() {
  const [count, setCount] = useState(0);
  const [other, setOther] = useState(0);

  // WITHOUT useCallback: new function every render → ChildButton always re-renders
  // const handleClick = () => setCount(c => c + 1);

  // WITH useCallback: same reference until deps change → ChildButton skips re-render
  const handleClick = useCallback(() => setCount((c) => c + 1), []);

  return (
    <div>
      <p>Count: {count} | Other: {other}</p>
      <button onClick={() => setOther((o) => o + 1)}>Update other</button>
      <ChildButton onClick={handleClick} label="Increment" />
    </div>
  );
}

// ─────────────────────────────────────────────
// Q4. useCallback pitfall — stale closures
// Always include all values used inside the callback in deps
// ─────────────────────────────────────────────
function StaleClosureFix() {
  const [value, setValue] = useState(0);

  // BUG: value is stale inside callback (captured at first render)
  const staleCb = useCallback(() => {
    console.log("Stale value:", value); // always 0
  }, []); // ← missing dep!

  // FIX 1: add value to deps
  const fixedCb1 = useCallback(() => {
    console.log("Current value:", value);
  }, [value]);

  // FIX 2: functional update (doesn't need value in closure)
  const fixedCb2 = useCallback(() => {
    setValue((v) => v + 1); // ← no closure over `value`
  }, []);

  // FIX 3: useRef "fresh ref" pattern — zero deps, always current
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; });
  const freshCb = useCallback(() => {
    console.log("Fresh via ref:", valueRef.current);
  }, []); // stable reference, always reads latest

  return <button onClick={fixedCb1}>{value}</button>;
}

// ─────────────────────────────────────────────
// Q5. React.memo — skip re-render when props unchanged
// Uses shallow equality (Object.is) to compare props
// ─────────────────────────────────────────────

// Simple memo
const PureDisplay = memo(({ value }) => {
  console.log("PureDisplay render");
  return <p>Value: {value}</p>;
});

// With custom comparison function
const DeepMemo = memo(
  function DeepMemo({ data }) {
    return <p>{JSON.stringify(data)}</p>;
  },
  (prev, next) => JSON.stringify(prev.data) === JSON.stringify(next.data)
);

// ─────────────────────────────────────────────
// Q6. useMemo to stabilize object/array references
// Objects created inline always have new reference → break memo
// ─────────────────────────────────────────────
function ParentWithObject() {
  const [count, setCount] = useState(0);

  // BAD: new object every render → PureDisplay always re-renders
  // const config = { theme: "dark", size: "large" };

  // GOOD: memoized object — stable reference
  const config = useMemo(() => ({ theme: "dark", size: "large" }), []);

  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>
      <PureDisplay value={config} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Q7. Full performance pattern: useCallback + useMemo + memo
// Data table with sorting and filtering
// ─────────────────────────────────────────────
const TableRow = memo(function TableRow({ row, onDelete }) {
  return (
    <tr>
      <td>{row.name}</td>
      <td>{row.age}</td>
      <td><button onClick={() => onDelete(row.id)}>Delete</button></td>
    </tr>
  );
});

function DataTable({ rows: initialRows }) {
  const [rows, setRows] = useState(initialRows);
  const [sortBy, setSortBy] = useState("name");
  const [filter, setFilter] = useState("");

  const handleDelete = useCallback((id) => {
    setRows((r) => r.filter((row) => row.id !== id));
  }, []);

  const handleSort = useCallback((col) => setSortBy(col), []);

  const displayRows = useMemo(() => {
    return rows
      .filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => a[sortBy] > b[sortBy] ? 1 : -1);
  }, [rows, filter, sortBy]);

  return (
    <div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      <button onClick={() => handleSort("name")}>Sort by Name</button>
      <button onClick={() => handleSort("age")}>Sort by Age</button>
      <table>
        <tbody>
          {displayRows.map((row) => (
            <TableRow key={row.id} row={row} onDelete={handleDelete} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the difference between useMemo and useCallback?
  A: useMemo   → memoizes the RETURN VALUE of a function
     useCallback → memoizes the FUNCTION ITSELF
     useCallback(fn, deps) === useMemo(() => fn, deps)

  Q: Should you always use useMemo/useCallback for performance?
  A: No. Memoization has overhead (comparison + memory storage). 
     Only use when:
     1. The computation is measurably expensive (profile first!)
     2. You're passing callbacks to memoized children (React.memo)
     3. A reference is in a useEffect deps array to avoid loops

  Q: Why does React.memo use shallow comparison?
  A: Deep comparison is O(n). For most components, shallow is sufficient.
     Provide a custom comparator as 2nd arg if you need deep comparison.

  Q: What triggers a React.memo component to re-render?
  A: 1. Props change (shallow comparison fails)
     2. Context it consumes changes
     3. Internal state changes

  Q: Is useCallback the same as wrapping in useRef?
  A: Similar, but not identical. useCallback participates in React's
     dependency tracking system; a ref does not trigger re-renders.
*/

export { ExpensiveList, Parent, DataTable, StaleClosureFix };

---
```

<a id="react-useref-forwardref"></a>
## 05_useRef_forwardRef.jsx — QUESTION SET: useRef, forwardRef & useImperativeHandle

```jsx
/**
 * QUESTION SET: useRef, forwardRef & useImperativeHandle
 *
 * useRef    → mutable container that persists across renders WITHOUT triggering re-render
 * forwardRef → pass refs through component boundaries
 * useImperativeHandle → customize what the parent can do via a forwarded ref
 *
 * Use cases:
 * 1. Access/manipulate DOM elements
 * 2. Store mutable instance variables (timers, previous values)
 * 3. Imperative child component API (focus, scroll, animate)
 */

import React, {
  useRef, useEffect, useState, forwardRef,
  useImperativeHandle, useCallback,
} from "react";

// ─────────────────────────────────────────────
// Q1. useRef — DOM access
// ─────────────────────────────────────────────
function AutoFocusInput() {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus(); // focus on mount
  }, []);

  const handleReset = () => {
    inputRef.current.value = "";
    inputRef.current.focus();
  };

  return (
    <div>
      <input ref={inputRef} type="text" placeholder="Auto-focused" />
      <button onClick={handleReset}>Reset</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q2. useRef as instance variable — interval timer
// Changing ref.current does NOT trigger a re-render
// ─────────────────────────────────────────────
function StopwatchWithRef() {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);

  const start = () => {
    if (intervalRef.current) return; // already running
    intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  const reset = () => {
    stop();
    setElapsed(0);
  };

  useEffect(() => () => clearInterval(intervalRef.current), []); // cleanup

  return (
    <div>
      <p>Elapsed: {elapsed}s</p>
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q3. useRef — store previous value
// ─────────────────────────────────────────────
function usePrevious(value) {
  const prevRef = useRef(undefined);
  useEffect(() => {
    prevRef.current = value; // runs AFTER render, so current holds previous
  });
  return prevRef.current; // read BEFORE the effect runs = previous render's value
}

function Counter() {
  const [count, setCount] = useState(0);
  const prev = usePrevious(count);
  return (
    <div>
      <p>Current: {count} | Previous: {prev ?? "—"}</p>
      <button onClick={() => setCount((c) => c + 1)}>+</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q4. Callback ref — called when ref is attached/detached
// Useful for measuring DOM elements
// ─────────────────────────────────────────────
function MeasureBox() {
  const [height, setHeight] = useState(null);

  const measuredRef = useCallback((node) => {
    if (node !== null) {
      setHeight(node.getBoundingClientRect().height);
    }
  }, []); // stable reference essential here

  return (
    <div>
      <div ref={measuredRef} style={{ padding: 20, background: "#eee" }}>
        Measure my height
      </div>
      <p>Box height: {height !== null ? `${height}px` : "not measured"}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q5. forwardRef — expose DOM ref to parent
// ─────────────────────────────────────────────
const FancyInput = forwardRef(function FancyInput({ label, ...props }, ref) {
  return (
    <label>
      {label}
      <input ref={ref} className="fancy-input" {...props} />
    </label>
  );
});

function ParentWithForwardRef() {
  const inputRef = useRef(null);

  const focusInput = () => inputRef.current?.focus();
  const clearInput = () => { inputRef.current.value = ""; };

  return (
    <div>
      <FancyInput ref={inputRef} label="Email:" type="email" />
      <button onClick={focusInput}>Focus</button>
      <button onClick={clearInput}>Clear</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q6. useImperativeHandle — custom imperative API
// Expose only specific methods to parent, not the full DOM node
// ─────────────────────────────────────────────
const VideoPlayer = forwardRef(function VideoPlayer({ src }, ref) {
  const videoRef = useRef(null);

  useImperativeHandle(ref, () => ({
    play() { videoRef.current?.play(); },
    pause() { videoRef.current?.pause(); },
    seek(time) { videoRef.current.currentTime = time; },
    getTime() { return videoRef.current?.currentTime; },
    // Parent CANNOT access other DOM methods — intentionally limited
  }), []); // deps: [] means API is stable

  return <video ref={videoRef} src={src} />;
});

function VideoControls() {
  const playerRef = useRef(null);
  return (
    <div>
      <VideoPlayer ref={playerRef} src="/movie.mp4" />
      <button onClick={() => playerRef.current?.play()}>Play</button>
      <button onClick={() => playerRef.current?.pause()}>Pause</button>
      <button onClick={() => playerRef.current?.seek(30)}>Jump to 30s</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q7. Scroll to bottom of a chat list
// Common pattern: useRef for DOM, scroll after each new message
// ─────────────────────────────────────────────
function ChatWindow({ messages }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]); // scroll every time messages array changes

  return (
    <div style={{ height: 300, overflowY: "auto" }}>
      {messages.map((msg, i) => <div key={i}>{msg}</div>)}
      <div ref={bottomRef} /> {/* invisible sentinel at the bottom */}
    </div>
  );
}

// ─────────────────────────────────────────────
// Q8. useRef vs useState — when to use which
// ─────────────────────────────────────────────
function TrackClickCount() {
  const [renderCountState, setRenderCountState] = useState(0); // triggers render
  const renderCountRef = useRef(0); // does NOT trigger render
  const clickCountRef = useRef(0);  // track clicks without rendering

  const handleClick = () => {
    clickCountRef.current += 1;
    // Only update display every 5 clicks
    if (clickCountRef.current % 5 === 0) {
      setRenderCountState(clickCountRef.current);
    }
  };

  return (
    <div>
      <button onClick={handleClick}>Click me</button>
      <p>Displayed count: {renderCountState}</p>
    </div>
  );
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: Why shouldn't you read/write refs during rendering?
  A: Refs are an escape hatch outside React's rendering model.
     Reading during render can cause inconsistency in Concurrent Mode.
     Read/write refs only in effects and event handlers.

  Q: What is the difference between useRef and createRef?
  A: createRef creates a new ref object on every render.
     useRef returns the same ref object on every render (persists).
     createRef is for class components; useRef is for function components.

  Q: When to use forwardRef?
  A: When a parent component needs to directly control a child's DOM node
     (focus, scroll, animate) or when building a library component that
     wraps a native element (Input, Select, TextArea).

  Q: When to use useImperativeHandle?
  A: When you want to:
     1. Expose a curated API instead of the raw DOM node
     2. Expose methods of a child's internal logic to the parent
     3. Build modal/dialog/tooltip components with .open()/.close() API

  Q: Can you use useRef as a cache to break out of useEffect?
  A: Yes. The "fresh ref" pattern lets you always read the latest
     value inside an effect without adding it to deps:
     const ref = useRef(value); useEffect(() => { ref.current = value; });
*/

export {
  AutoFocusInput, StopwatchWithRef, usePrevious, MeasureBox,
  FancyInput, ParentWithForwardRef, VideoPlayer, VideoControls, ChatWindow,
};

---
```

<a id="react-component-patterns"></a>
## 06_component_patterns.jsx — QUESTION SET: Component Patterns

```jsx
/**
 * QUESTION SET: Component Patterns
 *
 * 1. Higher Order Components (HOC)
 * 2. Render Props
 * 3. Compound Components
 * 4. Controlled vs Uncontrolled Components
 * 5. Container / Presentational pattern
 * 6. State lifting
 */

import React, { useState, useContext, createContext, useRef, Children, cloneElement } from "react";

// ─────────────────────────────────────────────
// Q1. Higher Order Component (HOC)
// A function that takes a component and returns a new (enhanced) component
// Use case: cross-cutting concerns — logging, auth, theming, loading
// ─────────────────────────────────────────────

// withLoading HOC — adds loading spinner logic
function withLoading(WrappedComponent) {
  function WithLoading({ isLoading, ...rest }) {
    if (isLoading) return <div>Loading…</div>;
    return <WrappedComponent {...rest} />;
  }
  // Set display name for DevTools
  WithLoading.displayName = `WithLoading(${WrappedComponent.displayName ?? WrappedComponent.name})`;
  return WithLoading;
}

// withAuth HOC — redirect if not authenticated
function withAuth(WrappedComponent) {
  return function WithAuth(props) {
    const isAuthenticated = Boolean(localStorage.getItem("token"));
    if (!isAuthenticated) {
      return <div>Please log in to view this page.</div>;
    }
    return <WrappedComponent {...props} />;
  };
}

// withLogger HOC — logs every render
function withLogger(WrappedComponent) {
  return function WithLogger(props) {
    console.log(`[${WrappedComponent.name}] render`, props);
    return <WrappedComponent {...props} />;
  };
}

// Usage: compose HOCs
const UserProfile = ({ name }) => <h2>Welcome, {name}</h2>;
const ProtectedProfile = withAuth(withLoading(UserProfile));

// ─────────────────────────────────────────────
// Q2. Render Props
// Share logic by passing a function as a prop (the function renders UI)
// Use case: mouse position, data fetching, form state
// ─────────────────────────────────────────────

// MouseTracker with render prop
function MouseTracker({ render }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <div
      onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      style={{ height: 300, border: "1px solid #ccc" }}
    >
      {render(pos)}
    </div>
  );
}

// Usage:
// <MouseTracker render={({x, y}) => <p>Mouse: {x}, {y}</p>} />

// DataFetcher with render prop
function DataFetcher({ url, render }) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  React.useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch((error) => { if (!cancelled) setState({ data: null, loading: false, error }); });
    return () => { cancelled = true; };
  }, [url]);

  return render(state);
}

// ─────────────────────────────────────────────
// Q3. Compound Components
// Components that share implicit state through context
// Use case: Tab/TabPanel, Select/Option, Accordion
// ─────────────────────────────────────────────

const TabContext = createContext(null);

function Tabs({ children, defaultTab = 0 }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <TabContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabContext.Provider>
  );
}

function TabList({ children }) {
  return <div role="tablist" className="tab-list">{children}</div>;
}

function Tab({ children, index }) {
  const { activeTab, setActiveTab } = useContext(TabContext);
  return (
    <button
      role="tab"
      aria-selected={activeTab === index}
      onClick={() => setActiveTab(index)}
    >
      {children}
    </button>
  );
}

function TabPanels({ children }) {
  const { activeTab } = useContext(TabContext);
  return <div className="tab-panels">{Children.toArray(children)[activeTab]}</div>;
}

function TabPanel({ children }) {
  return <div role="tabpanel">{children}</div>;
}

// Attach sub-components to main component for dot notation access
Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panels = TabPanels;
Tabs.Panel = TabPanel;

// Usage:
// <Tabs defaultTab={0}>
//   <Tabs.List>
//     <Tabs.Tab index={0}>Home</Tabs.Tab>
//     <Tabs.Tab index={1}>About</Tabs.Tab>
//   </Tabs.List>
//   <Tabs.Panels>
//     <Tabs.Panel>Home Content</Tabs.Panel>
//     <Tabs.Panel>About Content</Tabs.Panel>
//   </Tabs.Panels>
// </Tabs>

// ─────────────────────────────────────────────
// Q4. Controlled vs Uncontrolled Components
// Controlled: React manages the form state (value + onChange)
// Uncontrolled: DOM manages the state (useRef + defaultValue)
// ─────────────────────────────────────────────

// Controlled input — value from state
function ControlledInput() {
  const [value, setValue] = useState("");
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Controlled"
    />
  );
}

// Uncontrolled input — read via ref on submit
function UncontrolledForm() {
  const nameRef = useRef(null);
  const emailRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log({
      name: nameRef.current.value,
      email: emailRef.current.value,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input ref={nameRef} defaultValue="" placeholder="Name" />
      <input ref={emailRef} defaultValue="" placeholder="Email" />
      <button type="submit">Submit</button>
    </form>
  );
}

// ─────────────────────────────────────────────
// Q5. Container / Presentational
// Container: data-fetching, business logic (no JSX or minimal)
// Presentational: pure rendering from props
// ─────────────────────────────────────────────

// Presentational — only renders props, no side effects
function UserList({ users, onDelete }) {
  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>
          {u.name} <button onClick={() => onDelete(u.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}

// Container — handles data fetching and actions
function UserListContainer() {
  const [users, setUsers] = useState([]);
  React.useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then(setUsers);
  }, []);
  const handleDelete = (id) => setUsers((u) => u.filter((u) => u.id !== id));
  return <UserList users={users} onDelete={handleDelete} />;
}

// ─────────────────────────────────────────────
// Q6. Flexible compound component with cloneElement
// Pass extra props to children implicitly
// ─────────────────────────────────────────────
function RadioGroup({ name, children }) {
  const [selected, setSelected] = useState(null);
  return (
    <div role="radiogroup">
      {Children.map(children, (child) =>
        cloneElement(child, {
          name,
          checked: selected === child.props.value,
          onChange: setSelected,
        })
      )}
    </div>
  );
}

function RadioButton({ name, value, checked, onChange, children }) {
  return (
    <label>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
      />
      {children}
    </label>
  );
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: HOC vs Render Props vs Custom Hooks — which to prefer?
  A: Custom hooks are the modern preferred approach (no wrapper hell).
     HOCs: good for adding props/behavior without changing component.
     Render props: good when the consumer controls rendering.
     Custom hooks: simplest, composable, testable.

  Q: What is wrapper hell in HOC?
  A: When many HOCs are stacked:
     connect(withAuth(withLoading(withTheme(Component))))
     The component tree becomes deeply nested and hard to debug.
     React DevTools shows all these wrapping components.

  Q: What is a controlled component?
  A: A form element whose value is controlled by React state via
     the `value` prop. The component is the "single source of truth".
     onChange must update state otherwise the input is read-only.

  Q: When to use uncontrolled components?
  A: File inputs (always uncontrolled), simple forms that don't need
     real-time validation, integrating with non-React DOM libraries.

  Q: How do compound components differ from regular props-based API?
  A: Regular: <Select options={[{label, value}]} onChange={fn} />
     Compound: <Select> <Option value="a">A</Option> </Select>
     Compound is more flexible — consumers can insert arbitrary elements
     between options, style differently, etc.
*/

export {
  withLoading, withAuth, withLogger,
  MouseTracker, DataFetcher,
  Tabs, RadioGroup, RadioButton,
  ControlledInput, UncontrolledForm,
  UserList, UserListContainer,
};

---
```

<a id="react-lazy-suspense-errorboundary"></a>
## 07_lazy_suspense_errorboundary.jsx — QUESTION SET: React.lazy, Suspense, Error Boundaries & Code Splitting

```jsx
/**
 * QUESTION SET: React.lazy, Suspense, Error Boundaries & Code Splitting
 *
 * React.lazy  → lazily imports a component (must be a default export)
 * Suspense     → shows fallback while lazy component loads
 * ErrorBoundary → catches JS errors below in the component tree
 *                 Must be a class component (no hook alternative yet)
 */

import React, { lazy, Suspense, Component, useState, useEffect } from "react";

// ─────────────────────────────────────────────
// Q1. React.lazy — dynamic import with Suspense
// ─────────────────────────────────────────────
// The imported module MUST have a default export
const HeavyChart = lazy(() => import("./HeavyChart")); // deferred bundle

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<div>Loading chart…</div>}>
        <HeavyChart />
      </Suspense>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q2. Named export with lazy (workaround)
// React.lazy only supports default exports
// ─────────────────────────────────────────────
const NamedComponent = lazy(() =>
  import("./components").then((module) => ({ default: module.NamedExport }))
);

// ─────────────────────────────────────────────
// Q3. Route-based code splitting with React.lazy
// Each route's component is in its own chunk
// ─────────────────────────────────────────────
const HomePage = lazy(() => import("./pages/Home"));
const AboutPage = lazy(() => import("./pages/About"));
const ProfilePage = lazy(() => import("./pages/Profile"));

function Router() {
  const [page, setPage] = useState("home");

  const renderPage = () => {
    switch (page) {
      case "home":    return <HomePage />;
      case "about":   return <AboutPage />;
      case "profile": return <ProfilePage />;
      default:        return <div>404</div>;
    }
  };

  return (
    <div>
      <nav>
        <button onClick={() => setPage("home")}>Home</button>
        <button onClick={() => setPage("about")}>About</button>
        <button onClick={() => setPage("profile")}>Profile</button>
      </nav>
      <Suspense fallback={<div className="page-loader">Loading page…</div>}>
        {renderPage()}
      </Suspense>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q4. Error Boundary — class component required
// Catches render errors, lifecycle errors, constructor errors
// Does NOT catch: async errors, event handler errors, SSR errors
// ─────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  // Called on render error — update state to show fallback UI
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // Called with error details — use for logging
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log to external service
    console.error("ErrorBoundary caught:", error, errorInfo.componentStack);
    // logErrorToService(error, errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }
      return (
        <div style={{ padding: 16, border: "1px solid red" }}>
          <h2>Something went wrong</h2>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.toString()}</pre>
            <pre>{this.state.errorInfo?.componentStack}</pre>
          </details>
          <button onClick={this.handleReset}>Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────
// Q5. Combining Error Boundary + Suspense
// Common pattern: wrap lazy components in both
// ─────────────────────────────────────────────
const LazySettings = lazy(() => import("./pages/Settings"));

function SettingsPage() {
  return (
    <ErrorBoundary fallback={(error, reset) => (
      <div>
        <p>Failed to load settings: {error.message}</p>
        <button onClick={reset}>Retry</button>
      </div>
    )}>
      <Suspense fallback={<div>Loading settings…</div>}>
        <LazySettings />
      </Suspense>
    </ErrorBoundary>
  );
}

// ─────────────────────────────────────────────
// Q6. Component that throws — for testing error boundary
// ─────────────────────────────────────────────
function Bomb({ shouldExplode }) {
  if (shouldExplode) {
    throw new Error("💣 Component exploded!");
  }
  return <div>All good!</div>;
}

function SafeBomb() {
  const [explode, setExplode] = useState(false);
  return (
    <div>
      <button onClick={() => setExplode(true)}>Trigger Error</button>
      <ErrorBoundary>
        <Bomb shouldExplode={explode} />
      </ErrorBoundary>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q7. Multiple Suspense boundaries — fine-grained loading states
// ─────────────────────────────────────────────
const Sidebar = lazy(() => import("./components/Sidebar"));
const MainContent = lazy(() => import("./components/MainContent"));
const Comments = lazy(() => import("./components/Comments"));

function PageLayout() {
  return (
    <div style={{ display: "flex" }}>
      {/* Each section can load independently */}
      <Suspense fallback={<div style={{ width: 200 }}>Loading sidebar…</div>}>
        <Sidebar />
      </Suspense>

      <main>
        <Suspense fallback={<div>Loading content…</div>}>
          <MainContent />
        </Suspense>

        <Suspense fallback={<div>Loading comments…</div>}>
          <Comments />
        </Suspense>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q8. useSuspense pattern via data fetching (Experimental)
// throw a Promise inside render — Suspense catches it
// This is the pattern that React Server Components uses
// ─────────────────────────────────────────────
function createResource(fetchFn) {
  let status = "pending";
  let result;
  const promise = fetchFn().then(
    (data) => { status = "success"; result = data; },
    (error) => { status = "error"; result = error; }
  );

  return {
    read() {
      if (status === "pending") throw promise;   // suspend
      if (status === "error") throw result;       // boundary catches
      return result;                              // success
    },
  };
}

// Usage with this pattern:
// const resource = createResource(() => fetch('/api/user').then(r => r.json()));
// function UserInfo() { const user = resource.read(); return <p>{user.name}</p>; }

/*
  INTERVIEW QUESTIONS — THEORY

  Q: Why must Error Boundaries be class components?
  A: Error Boundaries require getDerivedStateFromError and componentDidCatch
     lifecycle methods. These lifecycle methods have no hook equivalents.
     The React team may add useErrorBoundary in the future.

  Q: What errors does Error Boundary NOT catch?
  A: 1. Errors in async code (setTimeout, fetch .catch())
     2. Errors in event handlers (use try/catch instead)
     3. Server-side rendering errors
     4. Errors in the boundary itself

  Q: What is the difference between one and multiple Suspense boundaries?
  A: One boundary: entire subtree shows single fallback until ALL
     lazy components load.
     Multiple: each section shows its own fallback independently,
     allowing progressive loading which feels faster to users.

  Q: When does lazy() start loading the component?
  A: When Suspense first renders the lazy component — not when lazy() is called.
     So lazy(() => import('./HeavyChart')) sets up the promise,
     but the import starts only when the component enters the render tree.

  Q: How do you pre-fetch a lazy component?
  A: Manually trigger the import before it's needed:
     const HeavyChartPromise = import('./HeavyChart'); // kick off early
     const HeavyChart = lazy(() => HeavyChartPromise);
*/

export { Dashboard, Router, ErrorBoundary, SafeBomb, PageLayout };

---
```

<a id="react-advanced-patterns"></a>
## 08_advanced_patterns.jsx — QUESTION SET: Advanced React Patterns

```jsx
/**
 * QUESTION SET: Advanced React Patterns
 *
 * 1. Portals — render outside the parent DOM hierarchy
 * 2. Reconciliation & keys — how React diffs the virtual DOM
 * 3. useTransition & useDeferredValue — Concurrent React
 * 4. Context performance patterns
 * 5. State machines in React
 * 6. Optimistic UI updates
 */

import React, {
  createPortal, useState, useTransition, useDeferredValue,
  useEffect, useRef, useCallback, useMemo,
} from "react";

// ─────────────────────────────────────────────
// Q1. Portals
// Render a component outside its parent DOM node
// Use case: modals, tooltips, dropdowns (to escape overflow:hidden)
// ─────────────────────────────────────────────
function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.5)", zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", padding: 24, borderRadius: 8 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body  // ← render into <body>, NOT into parent
  );
}

function PortalDemo() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div style={{ overflow: "hidden", height: 100 }}> {/* would hide normal child */}
      <button onClick={() => setIsOpen(true)}>Open Modal</button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <h2>I'm a modal rendered in document.body!</h2>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q2. Keys & Reconciliation
// React uses keys to identify which list items changed
// ─────────────────────────────────────────────

// BAD: using index as key — causes issues when list is sorted/filtered
// {items.map((item, index) => <Item key={index} {...item} />)}

// GOOD: use stable, unique id
// {items.map(item => <Item key={item.id} {...item} />)}

// Advanced: force component reset with key change
function ResetableForm({ userId }) {
  // Changing key UNMOUNTS and REMOUNTS the component — resets all state
  return <UserForm key={userId} userId={userId} />;
}

function UserForm({ userId }) {
  const [name, setName] = useState("");
  useEffect(() => {
    fetch(`/api/user/${userId}`).then(r => r.json()).then(u => setName(u.name));
  }, []); // empty deps + key change = correct behavior
  return <input value={name} onChange={(e) => setName(e.target.value)} />;
}

// ─────────────────────────────────────────────
// Q3. useTransition — defer non-urgent state updates
// Mark an update as "non-urgent" so React can keep UI responsive
// ─────────────────────────────────────────────
function SearchWithTransition({ allItems }) {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState(allItems);

  const handleSearch = (e) => {
    const value = e.target.value;
    setQuery(value); // urgent: update input immediately

    startTransition(() => {
      // Non-urgent: filtering large list can be deferred
      setResults(allItems.filter((item) =>
        item.name.toLowerCase().includes(value.toLowerCase())
      ));
    });
  };

  return (
    <div>
      <input value={query} onChange={handleSearch} placeholder="Search…" />
      {isPending && <span>Updating…</span>}
      <ul>
        {results.map((item) => <li key={item.id}>{item.name}</li>)}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q4. useDeferredValue — defer an expensive child re-render
// Like "debouncing" for rendering — keeps old value while new one loads
// ─────────────────────────────────────────────
function SearchWithDeferred({ allItems }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query); // lags behind query

  // Only re-renders HeavyList when deferredQuery changes
  const isStale = query !== deferredQuery;

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ opacity: isStale ? 0.5 : 1 }}>
        <HeavyList filter={deferredQuery} items={allItems} />
      </div>
    </div>
  );
}

function HeavyList({ filter, items }) {
  // Wrap in React.memo to actually benefit from useDeferredValue
  const filtered = useMemo(
    () => items.filter((i) => i.name.includes(filter)),
    [items, filter]
  );
  return <ul>{filtered.map((i) => <li key={i.id}>{i.name}</li>)}</ul>;
}

// ─────────────────────────────────────────────
// Q5. State Machine in React
// Explicit states prevent impossible states bugs
// ─────────────────────────────────────────────
// States: IDLE → LOADING → SUCCESS | ERROR
const STATE = {
  IDLE: "idle",
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
};

function useMachine(url) {
  const [state, setState] = useState(STATE.IDLE);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(async () => {
    setState(STATE.LOADING);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setState(STATE.SUCCESS);
    } catch (e) {
      setError(e);
      setState(STATE.ERROR);
    }
  }, [url]);

  return { state, data, error, fetch: fetch_ };
}

function FetchButton({ url }) {
  const { state, data, error, fetch } = useMachine(url);
  return (
    <div>
      <button onClick={fetch} disabled={state === STATE.LOADING}>
        {state === STATE.LOADING ? "Loading…" : "Fetch Data"}
      </button>
      {state === STATE.SUCCESS && <pre>{JSON.stringify(data, null, 2)}</pre>}
      {state === STATE.ERROR && <p>Error: {error.message}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Q6. Optimistic UI update
// Update UI immediately, rollback if server rejects
// ─────────────────────────────────────────────
function OptimisticTodoList({ initialTodos }) {
  const [todos, setTodos] = useState(initialTodos);

  const toggleTodo = async (id) => {
    // 1. Optimistically update UI
    const previous = todos;
    setTodos((list) =>
      list.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );

    try {
      // 2. Send to server
      await fetch(`/api/todos/${id}/toggle`, { method: "PATCH" });
    } catch {
      // 3. Rollback on failure
      setTodos(previous);
      alert("Failed to update todo. Changes reverted.");
    }
  };

  return (
    <ul>
      {todos.map((t) => (
        <li key={t.id} onClick={() => toggleTodo(t.id)}
          style={{ textDecoration: t.done ? "line-through" : "none", cursor: "pointer" }}>
          {t.title}
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────
// Q7. Custom useReducer + Immer-style immutability
// Manually writing immutable updates for nested state
// ─────────────────────────────────────────────
function deepUpdate(state, path, updater) {
  const keys = path.split(".");
  const newState = { ...state };
  let current = newState;
  for (let i = 0; i < keys.length - 1; i++) {
    current[keys[i]] = { ...current[keys[i]] };
    current = current[keys[i]];
  }
  const last = keys[keys.length - 1];
  current[last] = updater(current[last]);
  return newState;
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: How does React reconciliation work?
  A: React builds a virtual DOM tree. On state change, it builds a new tree
     and diffs it against the previous one (diffing algorithm).
     - Different component types → unmount old, mount new
     - Same type → update props (shallow)
     - Lists use `key` to match items across renders

  Q: What is the purpose of key in lists?
  A: Keys help React identify which items have changed, been added, or removed.
     Using index as key breaks when items are reordered/filtered/inserted.
     Use stable, unique IDs from your data.

  Q: When to use useTransition vs useDeferredValue?
  A: useTransition: when YOUcontrol the state setter (e.g., search input)
     useDeferredValue: when you DON'T control the state setter (prop from parent)
     Both mark updates as non-urgent and keep the UI responsive.

  Q: What is an optimistic update and when should you use it?
  A: An update applied to the UI before the server confirms it.
     Use when: server is likely to succeed, latency would hurt UX.
     Must always rollback on failure.

  Q: How does createPortal work with event bubbling?
  A: Even though the portal renders outside the parent DOM,
     React events bubble up through the React component tree,
     NOT the DOM tree. So event handlers on parent components
     still receive the event.
*/

export { Modal, PortalDemo, SearchWithTransition, SearchWithDeferred, FetchButton, OptimisticTodoList };

---
```

<a id="react-solid-principles"></a>
## 09_solid_principles.jsx — SOLID PRINCIPLES IN REACT

```jsx
/**
 * SOLID PRINCIPLES IN REACT
 *
 * SOLID is an acronym for 5 object-oriented design principles.
 * In React, we apply these to components, hooks, and module structure.
 *
 * S - Single Responsibility Principle
 * O - Open/Closed Principle
 * L - Liskov Substitution Principle
 * I - Interface Segregation Principle
 * D - Dependency Inversion Principle
 */

import React, { useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// S — SINGLE RESPONSIBILITY PRINCIPLE (SRP)
// "A component/function should have only ONE reason to change."
// Every component should do ONE thing only.
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: This component does too many things:
//   - fetches data from API
//   - formats the date
//   - renders the UI
//   If any of these change, you must edit this one big component.
function UserProfileBAD({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(setUser);
  }, [userId]);

  if (!user) return <p>Loading...</p>;

  const formatted = new Date(user.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      <small>Joined: {formatted}</small>
    </div>
  );
}

// ✅ GOOD: Each piece has one job
// 1. Custom hook handles data fetching — only changes if API changes
function useUser(userId) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => { setUser(data); setLoading(false); });
  }, [userId]);

  return { user, loading };
}

// 2. Utility handles formatting — only changes if date format changes
const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

// 3. Component handles rendering — only changes if UI design changes
function UserProfile({ userId }) {
  const { user, loading } = useUser(userId);
  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      {/* formatDate is separate so it can be tested and reused independently */}
      <small>Joined: {formatDate(user.createdAt)}</small>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// O — OPEN/CLOSED PRINCIPLE (OCP)
// "Open for extension, closed for modification."
// You should be able to ADD new behaviour without editing existing code.
// In React: use composition, props, and render patterns.
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: To add a new button type, you MUST edit this component (adding else-if)
function ButtonBAD({ type, label, onClick }) {
  if (type === 'primary') {
    return <button style={{ background: 'blue', color: '#fff' }} onClick={onClick}>{label}</button>;
  } else if (type === 'danger') {
    return <button style={{ background: 'red', color: '#fff' }} onClick={onClick}>{label}</button>;
  }
  // Every new type requires editing THIS file ← violates OCP
  return <button onClick={onClick}>{label}</button>;
}

// ✅ GOOD: A base Button accepts any className/style.
// New variants are EXTENSIONS (new components), not modifications.
function Button({ className = '', children, ...rest }) {
  // Base button is closed for modification
  return (
    <button className={`btn ${className}`} {...rest}>
      {children}
    </button>
  );
}

// Each variant is an EXTENSION — zero changes to Button needed
const PrimaryButton = (props) => <Button className="btn-primary" {...props} />;
const DangerButton  = (props) => <Button className="btn-danger"  {...props} />;
const GhostButton   = (props) => <Button className="btn-ghost"   {...props} />;
// To add "SuccessButton" tomorrow: just create a new extension. Button unchanged.

// ─────────────────────────────────────────────────────────────────────────────
// O — OCP with render props / component composition
// ─────────────────────────────────────────────────────────────────────────────

// A list that is open for extension via a render prop.
// The List itself never changes when you need a new item layout.
function List({ items, renderItem }) {
  // List handles iteration. HOW each item looks is "extended" via renderItem.
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}

// Usage: extend without touching List
// <List items={users} renderItem={(u) => <UserCard user={u} />} />
// <List items={products} renderItem={(p) => <ProductCard product={p} />} />

// ─────────────────────────────────────────────────────────────────────────────
// L — LISKOV SUBSTITUTION PRINCIPLE (LSP)
// "A child component should be substitutable for its parent
//  without breaking the application."
// In React: a specialised component must honour the same prop contract
//           as the base component it replaces.
// ─────────────────────────────────────────────────────────────────────────────

// Base Input — works as expected when you pass value + onChange
function Input({ value, onChange, placeholder, ...rest }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      {...rest}                      // pass-through allows any HTML input attribute
    />
  );
}

// ✅ GOOD: PasswordInput substitutes Input without breaking callers.
// It adds behaviour (toggle visibility) but KEEPS the same prop contract.
function PasswordInput({ value, onChange, placeholder, ...rest }) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      {/* Delegates to <input> directly — same HTML contract preserved */}
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder || 'Password'}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

// ❌ BAD LSP violation: SearchInput ignores onChange — callers break
function SearchInputBAD({ placeholder }) {
  // Accepts placeholder but drops the onChange prop entirely
  // Any caller expecting controlled input behaviour gets broken
  return <input placeholder={placeholder} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// I — INTERFACE SEGREGATION PRINCIPLE (ISP)
// "Don't force a component to depend on props it doesn't use."
// In React: keep prop interfaces small and focused.
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: UserCard receives a huge user object but only uses name + avatar.
// Every time ANY field on the user object changes shape, UserCard must be updated.
function UserCardBAD({ user }) {
  // user has: id, name, email, avatar, phone, address, createdAt, role, ...
  // But we only use name and avatar — the rest is wasted coupling!
  return (
    <div>
      <img src={user.avatar} alt={user.name} />
      <p>{user.name}</p>
    </div>
  );
}

// ✅ GOOD: Only accept the exact props this component needs.
// The caller decides what to pass. UserCard is decoupled from the User type.
function UserCard({ name, avatar }) {
  return (
    <div>
      <img src={avatar} alt={name} />
      <p>{name}</p>
    </div>
  );
}

// Caller example:
// <UserCard name={user.name} avatar={user.avatar} />
//
// Benefits:
// - Component is reusable for ANY data that has name + avatar (not just User)
// - Unit testing is trivial: just pass { name: 'Alice', avatar: '/alice.png' }
// - Renaming user.email won't cause a re-render / test failure in UserCard

// ─────────────────────────────────────────────────────────────────────────────
// I — ISP with custom hooks
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: One massive hook that every component imports but only uses part of
function useAuthEverythingBAD() {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [sessionExpiry, setSessionExpiry] = useState(null);
  // login, logout, refresh, checkPermission, updateProfile...
  return { user, permissions, sessionExpiry /*, ... */ };
}

// ✅ GOOD: Small focused hooks. Components import only what they need.
function useCurrentUser() {
  const [user, setUser] = useState(null);
  // fetch & return current user only
  return user;
}

function usePermissions() {
  const [permissions, setPermissions] = useState([]);
  // fetch & return permissions only
  return permissions;
}

function useSessionExpiry() {
  const [expiry, setExpiry] = useState(null);
  return expiry;
}

// ─────────────────────────────────────────────────────────────────────────────
// D — DEPENDENCY INVERSION PRINCIPLE (DIP)
// "High-level components should not depend on low-level details.
//  Both should depend on abstractions."
// In React: inject dependencies (services, fetchers) as props or context
//           instead of hard-coding them inside components.
// ─────────────────────────────────────────────────────────────────────────────

// ❌ BAD: Component directly calls fetch (hard-coded dependency on browser fetch API)
// You cannot unit-test this without mocking global fetch.
// You cannot swap to GraphQL or a mock API without editing the component.
function UserListBAD() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch('/api/users')                   // ← tightly coupled to REST fetch
      .then(r => r.json())
      .then(setUsers);
  }, []);

  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}

// ✅ GOOD: The component depends on the ABSTRACTION (a function that returns users),
// not on the concrete implementation (fetch, axios, GraphQL).
function UserList({ fetchUsers }) {
  // fetchUsers is an INJECTED dependency — could be fetch, axios, mock, anything
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchUsers().then(setUsers);
  }, [fetchUsers]);

  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}

// Production wiring — the concrete implementation lives at the call site
const realFetchUsers = () =>
  fetch('/api/users').then(r => r.json());

// Test wiring — trivially swap without touching UserList
const mockFetchUsers = () =>
  Promise.resolve([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);

// Usage:
// <UserList fetchUsers={realFetchUsers} />   ← production
// <UserList fetchUsers={mockFetchUsers} />   ← unit test / Storybook

// ─────────────────────────────────────────────────────────────────────────────
// D — DIP with React Context as an abstraction layer
// ─────────────────────────────────────────────────────────────────────────────

// Define the "abstraction" shape (what callers depend on)
const ApiContext = React.createContext(null);

// Provider: swap the implementation by changing ONE value here
function ApiProvider({ children, api }) {
  // api could be: { getUsers: fetchUsers } or { getUsers: mockApi.getUsers }
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

// Consumer: depends on the abstraction (context), not on fetch/axios
function UserListDIP() {
  const api = React.useContext(ApiContext);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.getUsers().then(setUsers);         // depends on abstraction
  }, [api]);

  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE EXAMPLE: All 5 principles applied together
// ─────────────────────────────────────────────────────────────────────────────

// Each hook has a single responsibility (S)
function useProducts(fetchProducts) {                // DIP: injected dependency
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchProducts()
      .then(data => { setProducts(data); setLoading(false); })
      .catch(err  => { setError(err.message); setLoading(false); });
  }, [fetchProducts]);

  return { products, loading, error };
}

// Small, focused props (I)
function ProductCard({ name, price, imageUrl }) {
  return (
    <div className="product-card">
      <img src={imageUrl} alt={name} />
      <h3>{name}</h3>
      <p>${price.toFixed(2)}</p>
    </div>
  );
}

// Open for extension via renderProduct render prop (O)
function ProductList({ fetchProducts, renderProduct }) {
  const { products, loading, error } = useProducts(fetchProducts); // DIP

  if (loading) return <p>Loading products…</p>;
  if (error)   return <p>Error: {error}</p>;

  return (
    <div className="product-grid">
      {products.map(p => (
        <React.Fragment key={p.id}>
          {renderProduct(p)}             {/* O: caller decides how to render */}
        </React.Fragment>
      ))}
    </div>
  );
}

// SaleProductCard SUBSTITUTES ProductCard — same props, extra badge (L)
function SaleProductCard({ name, price, imageUrl, discount }) {
  return (
    <div className="product-card sale">
      <span className="badge">-{discount}%</span>
      <img src={imageUrl} alt={name} />
      <h3>{name}</h3>
      {/* Shows discounted price, original contract (name/price/imageUrl) intact */}
      <p>
        <s>${price.toFixed(2)}</s>
        <strong> ${(price * (1 - discount / 100)).toFixed(2)}</strong>
      </p>
    </div>
  );
}

// App: wires everything together
function App() {
  const fetchProducts = useCallback(
    () => fetch('/api/products').then(r => r.json()),
    []
  );

  return (
    <ProductList
      fetchProducts={fetchProducts}
      renderProduct={(p) =>
        p.discount
          ? <SaleProductCard {...p} />    // Liskov: substitutable for ProductCard
          : <ProductCard {...p} />
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERVIEW QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

/*
Q: What does SOLID stand for?
A:
  S - Single Responsibility: one component, one job
  O - Open/Closed: extend via new code; never edit working code
  L - Liskov Substitution: child can replace parent without breaking things
  I - Interface Segregation: don't force unused props on a component
  D - Dependency Inversion: depend on abstractions, inject concrete things

Q: How does SRP apply to React specifically?
A: Split data-fetching into custom hooks, business logic into utility functions,
   and keep components focused on rendering. If a component has more than one
   reason to change, extract the unrelated concern.

Q: What is the OCP in React components?
A: A button component should not need editing every time you add a new type.
   Instead, extend it: create new wrapper components (PrimaryButton, DangerButton)
   that pass the necessary className/style. The original Button is never touched.

Q: How does render props / component composition support OCP?
A: By accepting a renderItem or renderProduct prop, a List component never needs
   to change when new item layouts are added. Callers provide new layouts by
   passing new render functions — zero modifications to List.

Q: Give a real-world React example of LSP violation.
A: A SearchInput that accepts value + onChange props but ignores onChange. Any
   parent that uses it in a controlled-input pattern will silently break. LSP
   means all components fulfil the prop contract the parent expects.

Q: How does ISP prevent prop drilling / over-coupling?
A: Instead of passing an entire user object to a UserCard (which only needs
   name + avatar), pass just those two props. The card is decoupled from the
   User type and is now reusable for any data that provides name + avatar.

Q: What is the practical difference between DIP in React vs DI in OOP?
A: In OOP you inject class instances into constructors. In React you inject
   functions/services as props or via Context. The goal is the same: the
   component never imports or calls a concrete implementation directly, it
   calls whatever was provided to it.

Q: Does following SOLID make components harder to read?
A: No — usually the opposite. Components become shorter and more focused.
   The "overhead" is naming and structuring files well. Each file/hook/component
   is simpler because it has one job.

Q: When should you NOT strictly follow SOLID?
A: Early prototyping / one-off scripts where future extension is unlikely.
   Aggressively splitting a 20-line component into 5 files would be over-engineering.
   Apply SOLID when a component is growing, being reused, or is hard to test.
*/

export {
  UserProfile, Button, PrimaryButton, DangerButton, GhostButton,
  List, Input, PasswordInput, UserCard, UserList, ProductList,
  ProductCard, SaleProductCard,
};

---
```

<a id="react-theory-interview-qa"></a>
## FILE: 10_theory_interview_qa.jsx

```jsx
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

---
```

---

<a id="react-scenarios"></a>
## Scenario-Based Interview Questions

---

### Scenario 1: Context Re-rendering the Entire App

**Situation:** You put your user auth state and your notification count into one `AppContext`. Every time a notification comes in, the entire tree re-renders including expensive components that only need the auth state.

**Question:** How do you fix this?

**Answer:**
- **Split contexts by domain**: `AuthContext` (changes rarely) and `NotificationContext` (changes often) should be separate.
- Use `React.memo` on components that don't need notification data.
- For high-frequency updates, consider **Zustand** or **Jotai** which allow components to subscribe to slices without a wrapping Provider.
- Use `useMemo` on the context value object to prevent reference churn when values haven't changed:

```jsx
const value = useMemo(() => ({ user, login, logout }), [user]);
return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
```

---

### Scenario 2: List of 10 000 Items is Laggy

**Situation:** A data-grid renders 10 k rows. Scrolling is at 10 fps. Users are complaining on low-end devices.

**Question:** What is your fix plan?

**Answer:**
1. **Virtualise the list** with `react-window` or `react-virtual` — only ~20 visible rows are mounted at any time.
2. **Memoize row components** with `React.memo` + stable row data (avoid creating new objects per render).
3. Move **filtering/sorting** out of render into `useMemo` or a Web Worker.
4. Use `useTransition` to mark the filter input as non-urgent so typing stays responsive.
5. If data is from an API, add **server-side pagination** — sending 10 k rows to the browser is the real problem.

---

### Scenario 3: Stale Closure in a setInterval

**Situation:** You have a clock component that uses `setInterval` inside `useEffect`. The displayed seconds never update — they stay at 0.

**Question:** What is wrong and how do you fix it?

**Answer:**
- The closure inside `setInterval` captures the initial `count` value (0) and never sees updates.
- **Fix 1**: Use the functional updater form: `setCount(c => c + 1)`.
- **Fix 2**: Add `count` to the dependency array and clear/re-create the interval on each render (less efficient).
- **Fix 3**: Use a `useRef` to hold the latest callback, and re-assign it on every render without re-creating the interval.

```jsx
const callbackRef = useRef(tick);
useEffect(() => { callbackRef.current = tick; }); // always up to date
useEffect(() => {
  const id = setInterval(() => callbackRef.current(), 1000);
  return () => clearInterval(id);
}, []); // interval created once
```

---

### Scenario 4: Preventing Unnecessary Child Re-renders in a Form

**Situation:** A form component has 20 fields. Changing one field re-renders all 20 — noticeable lag on a mobile device.

**Question:** What is your approach?

**Answer:**
- Wrap each field component in `React.memo`.
- Pass `onChange` handlers via `useCallback` so their reference is stable.
- Keep form state **co-located**: each field manages its own local state and reports upward on submit (uncontrolled form pattern).
- Or use **React Hook Form** — it uses uncontrolled inputs under the hood, so only the changed field re-renders.

---

### Scenario 5: Error Boundary Not Catching an Async Error

**Situation:** Your Error Boundary is in place but an async `fetch` failure inside a `useEffect` bypasses it and the app shows a blank screen.

**Question:** Why does this happen and how do you handle async errors in React?

**Answer:**
- Error Boundaries only catch **render-time** and **lifecycle** errors — NOT errors thrown asynchronously inside event handlers or `useEffect`.
- To bridge the gap, use a trick: call `setState` with the error inside the async catch, using a state updater that re-throws:

```jsx
const [, throwError] = useState();
useEffect(() => {
  fetchData().catch(err => throwError(() => { throw err; }));
}, []);
```

- Or use a custom hook like `useAsyncError` that does this pattern.
- Libraries like React Query / SWR handle this automatically via their `<ErrorBoundary>` integration.

---

### Scenario 6: useEffect Fires Twice in Development

**Situation:** A junior developer reports that their `useEffect` is making two API calls on mount. They don't see it in production.

**Question:** Why does this happen and what is the correct response?

**Answer:**
- React 18 Strict Mode **intentionally double-invokes effects** in development to expose side effects that lack cleanup.
- The effect fires → cleanup → fires again to simulate fast tab switching.
- The **correct response** is NOT to remove Strict Mode — it is to write a proper cleanup:

```jsx
useEffect(() => {
  let cancelled = false;
  fetchUser(id).then(data => { if (!cancelled) setUser(data); });
  return () => { cancelled = true; };
}, [id]);
```

- In production (no Strict Mode), this runs exactly once.

---

### Scenario 7: Using useRef to Avoid Re-render for a Mutable Value

**Situation:** You need to track whether a component is mounted to avoid `setState` on an unmounted component. Using `useState` for this flag would cause an extra render.

**Question:** What is the right tool?

**Answer:**

```jsx
const isMounted = useRef(true);
useEffect(() => {
  return () => { isMounted.current = false; };
}, []);

async function load() {
  const data = await fetchData();
  if (isMounted.current) setData(data);
}
```

- `useRef` stores **mutable values that don't trigger re-renders** — perfect for flags, previous values, and DOM node references.

---

### Scenario 8: Compound Component Pattern for a Flexible Dropdown

**Situation:** Product design keeps changing the internals of a `<Dropdown>` component. Each change requires updating the component's public API. The team is frustrated.

**Question:** How do you redesign it for flexibility?

**Answer:**
- Use the **Compound Component pattern** with implicit state sharing via Context:

```jsx
const DropdownContext = React.createContext();

function Dropdown({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div className="dropdown">{children}</div>
    </DropdownContext.Provider>
  );
}
Dropdown.Toggle  = function Toggle({ children }) {
  const { setOpen } = useContext(DropdownContext);
  return <button onClick={() => setOpen(o => !o)}>{children}</button>;
};
Dropdown.Menu = function Menu({ children }) {
  const { open } = useContext(DropdownContext);
  return open ? <ul>{children}</ul> : null;
};
Dropdown.Item = function Item({ children, onClick }) {
  return <li onClick={onClick}>{children}</li>;
};
```

Now design changes are made at the usage site without touching the base component.

---

### Scenario 9: Performance — Expensive Derived State

**Situation:** A reporting page calculates totals, averages, and groupings from a 5 000-row dataset on every render — including renders caused by unrelated state changes.

**Question:** How do you optimise?

**Answer:**

```jsx
// useMemo ensures recalculation ONLY when rawData changes
const report = useMemo(() => computeReport(rawData), [rawData]);
```

- Ensure `computeReport` is a pure function — no side effects.
- If computation takes > 16 ms even with `useMemo`, move it to a Web Worker and cache results in a `useRef`.
- Split the component so the expensive calculation only re-runs when its direct dependencies change, not when sibling state updates.

---

### Scenario 10: Code Splitting a Large Dashboard

**Situation:** Your app's initial bundle is 2.4 MB. Lighthouse shows Time to Interactive of 8 s on mobile 3G. Most of the bundle is the heavy analytics dashboard that 80% of users never open.

**Question:** How do you reduce the initial load?

**Answer:**

```jsx
const Dashboard = React.lazy(() => import('./Dashboard'));

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/dashboard"
        element={
          <Suspense fallback={<PageSpinner />}>
            <Dashboard />
          </Suspense>
        }
      />
    </Routes>
  );
}
```

- Result: Dashboard code is only downloaded when the route is visited.
- Go further: use **dynamic `import()`** inside the component for heavy sub-sections (charts, data tables).
- Monitor bundle composition with `webpack-bundle-analyzer` or Vite's rollup-plugin-visualizer.
