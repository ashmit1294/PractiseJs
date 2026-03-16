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
// WHAT: When and how should you use useReducer instead of useState?
// THEORY: useReducer manages state with a pure function reducer that takes state and action; useDispatch(action) triggers state changes; enables complex logic, testing, state transitions, undo/redo
// Time: O(1)  Space: O(1)
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
// WHAT: How do you manage complex related state updates in a shopping cart?
// THEORY: useReducer handles multiple actions (ADD_ITEM, REMOVE_ITEM, UPDATE_QTY, CLEAR); accumulator pattern updates immutable state; enables undo/redo via action history
// Time: O(n) for ADD_ITEM/UPDATE_QTY where n=items; O(1) for REMOVE_ITEM/CLEAR  Space: O(n)
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
// WHAT: How do you avoid prop-drilling and share data across deeply nested components?
// THEORY: createContext creates context object; use <Provider value={}> to wrap components; useContext(Context) reads value in any nested component; memoize value to prevent unnecessary re-renders
// Time: O(n) where n=depth  Space: O(1)
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
// WHAT: How do you create a global state management system using Context and useReducer?
// THEORY: Combine createContext + useReducer for global state; separate state/dispatch contexts so dispatch-only components don't re-render on state change; memoize to optimize performance
// Time: O(1)  Space: O(n) for global state
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
// WHAT: How do you prevent unnecessary re-renders when using Context?
// THEORY: Split context by update frequency (UserContext, CartContext, ThemeContext); memoize value with useMemo to prevent new object; separate state/dispatch contexts; use React.memo on consumers
// Time: O(1)  Space: O(n)
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
// WHAT: How do you create an imperative API (like calling a function) for components using Context?
// THEORY: Store state in Context with open/close functions; consumers call useModal().open(content) to trigger; useRef can hold imperative handles for more control; useCallback memoizes handlers
// Time: O(1)  Space: O(1)
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
