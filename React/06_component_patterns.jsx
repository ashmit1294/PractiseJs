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
// WHAT: How do you add behavior or state to existing components without modifying them?
// THEORY: HOC is a function that takes component and returns enhanced component; enables prop manipulation, state wrapping, rendering control; can stack HOCs but creates wrapper hell; use custom hooks instead
// Time: O(1)  Space: O(1)
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
// WHAT: How do you reuse stateful component logic with a consumer component controlling the render?
// THEORY: Render prop is a function passed to component that determines what to render; component calls the function with data; enables flexible composition; alternative to HOC, but creates callback hell; custom hooks better
// Time: O(n)  Space: O(n)
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
// WHAT: How do you create flexible component groups that communicate through implicit context?
// THEORY: Parent component provides context; children components consume context for shared state; use Children.map and cloneElement to pass props; enables dot notation (Tabs.List, Tabs.Tab); more flexible than props API
// Time: O(n)  Space: O(n)
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
// WHAT: When should you use controlled vs uncontrolled components?
// THEORY: Controlled: React state + value + onChange for validation/real-time feedback; Uncontrolled: useRef + defaultValue for simple forms, file inputs, integration with non-React code
// Time: O(1)  Space: O(1)
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
// WHAT: How should you separate concerns between logic and rendering?
// THEORY: Container (smart) component handles data/state/effects; Presentational (dumb) component is pure function rendering props; enables reuse, testing, reasoning about code; modern hooks are preferred over this pattern
// Time: O(n)  Space: O(n)
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
// WHAT: How do you pass automatically derived props to children without explicit prop drilling?
// THEORY: Use Children.map with cloneElement to inject props into each child; eliminates need for children to accept all props explicitly; enables compact compound component APIs; common in form groups, radio groups
// Time: O(n)  Space: O(n)
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
