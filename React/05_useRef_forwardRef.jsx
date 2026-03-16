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
// WHAT: How do you directly access or manipulate a DOM element in a React component?
// THEORY: useRef returns a mutable container (.current) that persists across renders without triggering re-render; pass ref to JSX element to attach; don't read/write during rendering
// Time: O(1)  Space: O(1)
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
// WHAT: How do you store a mutable value (like a timer ID) that persists between renders but doesn't cause re-renders?
// THEORY: useRef stores mutable data without triggering renders; useful for timer IDs, previous values, DOM nodes; unlike state, changing ref.current doesn't schedule a re-render
// Time: O(1)  Space: O(1)
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
// WHAT: How do you access the previous render's value of a state variable?
// THEORY: useRef persists value across renders; useEffect updates ref.current AFTER render so reading ref.current before effect runs gives previous value; custom usePrevious hook encapsulates pattern
// Time: O(1)  Space: O(1)
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
// WHAT: How do you measure a DOM element's dimensions or run code when a ref is attached to the DOM?
// THEORY: Pass a callback function as ref prop; called with DOM node when attached and null when detached; enables measuring, calculating positions; must memoize callback with useCallback for stability
// Time: O(1)  Space: O(1)
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
// WHAT: How do you allow a parent component to access the underlying DOM node of a child functional component?
// THEORY: Function component can't receive ref prop by default; wrap with forwardRef to forward ref to internal element; parent can then call methods or access properties on the child's DOM element
// Time: O(1)  Space: O(1)
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
// WHAT: How do you limit what methods/properties a parent can access on a child component's ref?
// THEORY: useImperativeHandle customizes what's exposed via ref; returns object with only desired methods; prevents parent from accessing all DOM properties; combined with forwardRef and useRef
// Time: O(1)  Space: O(1)
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
// WHAT: How do you scroll a container to the bottom when new items are added?
// THEORY: Create invisible sentinel element at bottom with useRef; use useEffect to call scrollIntoView on sentinel when dependencies change; deps array includes messages array for auto-scroll on new messages
// Time: O(1)  Space: O(1)
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
// WHAT: When should you use useRef instead of useState, and vice versa?
// THEORY: useState triggers re-render when updated; useRef doesn't; use setState for values that affect rendering, useRef for internal state (animations, timers, form inputs, counters not displayed)
// Time: O(1)  Space: O(1)
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
