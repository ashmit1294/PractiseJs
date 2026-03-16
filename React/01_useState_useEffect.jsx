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
// WHAT: How do you avoid capturing stale state values in async setState calls?
// THEORY: Functional setState ((prev) => newState) receives the latest state value instead of closure, preventing stale values; state updates are asynchronous and batched
// Time: O(1)  Space: O(1)
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
// WHAT: Why does setState not preserve other properties when updating object state?
// THEORY: setState replaces the entire state object (not partial merge); use spread operator (...prev) to preserve properties, then override only the changed field
// Time: O(1)  Space: O(n) where n=object properties
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
// WHAT: When and how should you compute expensive initial state in useState?
// THEORY: Pass an initializer function to useState not a value; function executes ONLY on mount, not on every render; enables loading from localStorage, complex calculations
// Time: O(n)  Space: O(n)
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
// WHAT: How do you prevent memory leaks when fetching data in a component that may unmount?
// THEORY: Use a cleanup flag that's set in the cleanup function returned by useEffect; check flag before setState; dependency array includes variables that trigger re-fetch
// Time: O(n)  Space: O(1)
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
// WHAT: How do you properly clean up event listeners or subscriptions in useEffect?
// THEORY: Return a cleanup function from useEffect that removes listeners/subscriptions; runs before re-render if deps change or on unmount; prevents duplicate listeners and memory leaks
// Time: O(1)  Space: O(1)
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
// WHAT: How do you implement a timer with setInterval in a React component without memory leaks?
// THEORY: setInterval inside useEffect with cleanup function that calls clearInterval; use functional setState to avoid stale closures; empty deps = mount/unmount only
// Time: O(1)  Space: O(1)
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
