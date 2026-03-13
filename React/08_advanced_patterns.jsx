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
