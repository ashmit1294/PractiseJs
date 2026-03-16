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
// WHAT: How do you memoize the result of an expensive computation to avoid recalculation on every render?
// THEORY: useMemo runs the compute function only when dependencies change; equality checked via deps array; prevents unnecessary filtering/sorting/calculations on parent re-render
// Time: O(n) on first run and when deps change; O(1) cached  Space: O(n) for memoized result
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
// WHAT: When should you avoid using useMemo?
// THEORY: useMemo has overhead (comparison + storage); only worth it for expensive computations (sorting large arrays, complex calculations); trivial operations like a+b should skip memoization
// Time: O(1)  Space: O(n)
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
// WHAT: How do you avoid stale closures in useCallback dependencies?
// THEORY: Include all external values used in callback in deps array; use functional updates (setValue(v=>v+1)) to avoid closure; useRef can bypass deps if fresh value needed
// Time: O(1)  Space: O(1)
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
// WHAT: How do you prevent a component from re-rendering when its props haven't changed?
// THEORY: Wrap component with React.memo to skip re-render if props unchanged; uses shallow Object.is comparison; optional 2nd arg is custom comparator function for deep comparison
// Time: O(k) for shallow comparison where k=number of props  Space: O(1)
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
// WHAT: How do you prevent inline-created objects/arrays from causing unnecessary child re-renders?
// THEORY: Objects/arrays created inline get new reference every render; wrap in useMemo with empty/appropriate deps to create stable reference; pass to React.memo children to skip their re-render
// Time: O(n)  Space: O(n)
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
// WHAT: How do you combine useCallback, useMemo, and React.memo for optimal data table performance?
// THEORY: Memoize delete callback with useCallback for stable reference; memoize filtered/sorted rows with useMemo; wrap TableRow with React.memo to skip re-renders when props haven't changed
// Time: O(n log n) for sort  Space: O(n)
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
