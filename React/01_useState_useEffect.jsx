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
// WHAT: Why does setState fail inside setTimeout callbacks?
// THEORY: setState(count+1) captures 'count' at callback creation (stale closure).
//         Fix: Use setState(prev => prev+1) to always get current state from React.
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
// WHAT: How do you safely update object state without losing other fields?
// THEORY: useState setState REPLACES object (doesn't merge like class setState).
//         Must use spread: setState(prev => ({...prev, field: value}))
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
// WHAT: When should you pass a function vs a value to useState?
// THEORY: useState(value) evaluated every render (wasteful if expensive).
//         useState(() => value) runs ONCE at mount (use for localStorage, calculations).
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
// WHAT: How do you prevent "Cannot set state on unmounted component" errors?
// THEORY: User navigates away while fetch in-flight. Use cleanup flag to skip setState after unmount.
//         Check flag before setState inside async callbacks.
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
// WHAT: How do you prevent memory leaks from event listeners?
// THEORY: addEventListener persists until removeEventListener is called. Cleanup MUST remove listener.
//         Empty deps [] = listener added once, cleanup runs once on unmount.
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
// WHAT: How do you safely use setInterval in useEffect?
// THEORY: setInterval keeps running after unmount (memory leak). Store ID and clearInterval in cleanup.
//         Use functional setState: setState(prev => prev+1) for correct incrementing.
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
// WHAT: How many re-renders when you call setState multiple times?
// THEORY: React 18: ALL updates auto-batch (sync, setTimeout, Promise, etc.) = 1 re-render.
//         React 17: only batched in event handlers. Use flushSync() to force immediate update (rare).
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
// WHAT: In what order do effects and cleanup run in nested components?
// THEORY: Mount: parent render → child render → child effect → parent effect.
//         Cleanup: reverse order (child cleanup → parent cleanup). Prevents dependency issues.
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
