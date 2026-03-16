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
// WHAT: How do you split a large component into a separate chunk and load it on demand?
// THEORY: React.lazy wraps dynamic import(() => ...) to code-split; component must have default export; must wrap with Suspense to show fallback UI while loading; enables route-based splitting for faster initial load
// Time: O(1)  Space: O(1)
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
// WHAT: How do you code-split a component that uses a named export?
// THEORY: Wrap import().then((module) => ({ default: module.NamedExport })) to convert named to default; transform named export inside dynamic import; workaround limitation of React.lazy for named exports
// Time: O(1)  Space: O(1)
// ─────────────────────────────────────────────
const NamedComponent = lazy(() =>
  import("./components").then((module) => ({ default: module.NamedExport }))
);

// ─────────────────────────────────────────────
// Q3. Route-based code splitting with React.lazy
// Each route's component is in its own chunk
// WHAT: How do you apply code splitting to route pages for faster initial load?
// THEORY: Lazy load each route component separately; Suspense at router level shows fallback during chunk load; each route gets own bundle; improves first contentful paint and time to interactive
// Time: O(1)  Space: O(1)
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
// WHAT: How do you catch React render errors and display a fallback UI?
// THEORY: Error boundary is class component with getDerivedStateFromError and componentDidCatch; catches errors during render/mounting; doesn't catch async errors or event handlers; must be class component (no hook alternative)
// Time: O(1)  Space: O(1)
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
// WHAT: How do you handle both loading and error states for lazy-loaded components?
// THEORY: Wrap lazy component in ErrorBoundary, then Suspense; fallback for loading state, error boundary for load failures; order matters: ErrorBoundary outside catches fetch errors, Suspense inside shows loading UI
// Time: O(1)  Space: O(1)
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
// WHAT: How do you test an error boundary?
// THEORY: Create component that conditionally throws error based on prop; wrap with error boundary; trigger error by rendering with shouldExplode=true; verify error boundary catches and displays fallback
// Time: O(1)  Space: O(1)
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
