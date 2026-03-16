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
// WHAT: How do you create a reusable custom hook for data fetching that handles loading, error, and memory leaks?
// THEORY: Extract useState and useEffect logic into a function starting with 'use'; manage loading, error, data states; use cleanup flag to prevent setState on unmounted component
// Time: O(n)  Space: O(n)
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
// WHAT: How do you create a hook that syncs React state with browser localStorage?
// THEORY: Initialize state from localStorage with try-catch; sync updates to localStorage on setValue call; useCallback handles both function and direct value updates
// Time: O(1)  Space: O(n) for localStorage
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
// WHAT: How do you delay state updates until a value stops changing for a specified duration?
// THEORY: useDebounce wraps useState and useEffect; on every value change, clears previous timeout and sets a new one; returns previous value until timeout expires
// Time: O(1)  Space: O(1)
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
// WHAT: How do you access the previous render's value of a state or prop?
// THEORY: useRef persists value across renders without triggering re-render; useEffect runs after render so ref.current always holds previous value; return ref.current before effect updates it
// Time: O(1)  Space: O(1)
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
