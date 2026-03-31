# Busy Frontend

## ELI5
Your browser's main thread is like a single-lane road. Everything runs on it: rendering, animations, running JavaScript, responding to taps/clicks. If JavaScript from one app monopolizes that lane — parsing a huge bundle, running a heavy loop — everything else backs up. Users see frozen UI, laggy scrolls, and missed taps.

## Analogy
A restaurant where the head chef (main thread) personally plates every dish, greets every guest, and cleans every table — instead of delegating. The restaurant grinds to a halt even though other staff (Web Workers, the GPU) are idle.

---

## Core Concept
**Busy Frontend** occurs when JavaScript execution monopolizes the browser's main thread, causing UI blocking, janky animations, and degraded Core Web Vitals.

### Core Web Vitals (Google's User-Centric Metrics)
```
Metric   Full Name                    Target    Description
──────── ──────────────────────────── ───────── ─────────────────────────────
LCP      Largest Contentful Paint     < 2.5s    When main content is visible
INP      Interaction to Next Paint    < 200ms   How fast UI responds to input
CLS      Cumulative Layout Shift      < 0.1     Unexpected layout movement
FCP      First Contentful Paint       < 1.8s    When any content appears
TTI      Time to Interactive          < 3.8s    When page is fully usable
TBT      Total Blocking Time          < 200ms   Total time main thread blocked
```

### The Bundle Size Problem
```
500KB gzipped JS bundle:
  Download on 3G:    ~2 seconds
  Parse + compile:   ~1-2 seconds on mid-range mobile
  Execute:           variable
  Total before interactive: 3-4 seconds

Impact:
  Every 100ms extra TTI → 1% fewer users converting (Google research)
  Target initial bundle: < 200KB gzipped
```

---

## Key Solutions

### 1. Code Splitting
```javascript
// BEFORE: One giant bundle
import { HeavyAnalyticsDashboard } from './analytics'; // always loaded

// AFTER: Load only when needed
const HeavyAnalyticsDashboard = React.lazy(() =>
  import('./analytics') // loads as separate chunk on demand
);

// Route-level splitting (Next.js does this automatically)
const AdminPanel = dynamic(() => import('./admin/AdminPanel'), {
  loading: () => <Skeleton />
});
```

### 2. Lazy Loading Images & Components
```html
<!-- Native browser lazy loading (no JS needed) -->
<img src="hero.jpg" loading="lazy" alt="Hero" />

<!-- JavaScript equivalent: Intersection Observer -->
```
```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;    // load image only when visible
      observer.unobserve(img);
    }
  });
});
document.querySelectorAll('[data-src]').forEach(img => observer.observe(img));
```

### 3. Deferred Script Loading
```html
<!-- WRONG: Blocks HTML parsing -->
<script src="analytics.js"></script>

<!-- async: Downloads in parallel, executes when ready (non-DOM scripts) -->
<script async src="analytics.js"></script>

<!-- defer: Downloads in parallel, executes after HTML parsed (DOM-dependent) -->
<script defer src="main.js"></script>

<!-- Idle: Run when browser has nothing else to do -->
<script>
  requestIdleCallback(() => { initNonCriticalFeature(); });
</script>
```

### 4. Rendering Strategy Decision Tree
```
Is content purely static (blog, docs, marketing)?
  YES → SSG (Next.js/Gatsby) — build-time HTML, fastest TTFB
  NO  → Does it need SEO and fresh data?
          YES → SSR (Next.js server components) — server-renders per request
          NO  → Is it a highly interactive app?
                  YES → CSR (React SPA) — JS handles all rendering
                  NO  → Edge Rendering (Cloudflare Workers) — global SSR
```

---

## ASCII: Main Thread Blocking vs Offloaded

```
BEFORE (Busy Frontend)
──────────────────────────────────────────────────────
Main Thread: [Parse 300KB JS][Execute][Render][BLOCKED][User tap → no response]
                                                  ↑
                               Long task >50ms blocks everything

AFTER (Optimized)
──────────────────────────────────────────────────────
Main Thread: [Parse 60KB][Render][User tap → instant response]
Web Worker:  [Heavy computation running in background]
Browser:     [GPU handles animations via CSS transforms]
```

---

## Modern Rendering Variants

| Variant | How | When to Use | Trade-off |
|---|---|---|---|
| **Progressive Hydration** | React Server Components — server renders shell, client hydrates interactive islands | Most production apps | Requires React 18+ / Next.js |
| **Streaming SSR** | React 18 Suspense — stream HTML progressively | Apps with slow data fetches | Needs server infrastructure |
| **Edge Rendering** | Cloudflare Workers / Vercel Edge — run SSR at CDN edge globally | Global audience, low latency priority | No Node.js APIs |
| **Service Worker Cache** | Pre-cache assets at install time, serve from cache | PWA / offline support | Cache invalidation complexity |

---

## MERN Developer Notes

```javascript
// React memoization to prevent unnecessary re-renders
const ProductCard = React.memo(({ product }) => (
  <div>{product.name} - ${product.price}</div>
));

// useMemo for expensive calculations
const sortedProducts = useMemo(
  () => products.sort((a, b) => a.price - b.price),
  [products] // only recompute when products changes
);

// useCallback to stabilize function references
const handleAddToCart = useCallback((productId) => {
  dispatch({ type: 'ADD_ITEM', productId });
}, [dispatch]);

// Virtual scrolling for large lists (react-virtual / react-window)
// Renders only visible rows instead of 10,000 DOM nodes
import { FixedSizeList } from 'react-window';
const VirtualList = ({ items }) => (
  <FixedSizeList height={600} itemCount={items.length} itemSize={50}>
    {({ index, style }) => <div style={style}>{items[index].name}</div>}
  </FixedSizeList>
);
```

---

## Real-World Examples

| Company | Problem | Fix | Result |
|---|---|---|---|
| LinkedIn | 1.2MB JS bundle | Code split → 400KB initial bundle | TTI 10s→3.2s; bounce rate 40%→28% |
| Twitter | Massive DOM (all tweets in DOM) | Virtual scrolling | 60% less main thread blocking time |
| Shopify | 150KB JS budget enforced per PR | Bundle size CI gates | TTI 6.5s→2.8s; 10-15% conversion increase |

---

## Interview Cheat Sheet

**Q: A React app has 8-second TTI on mobile. Where do you start?**

> A: Measure first: run Lighthouse (lab data) and look at Web Vitals (field data via RUM). Check TBT — if it's high, the main thread is blocked by long tasks. Check the bundle analyzer (`webpack-bundle-analyzer`) to find what's in the initial chunk. Most likely causes: (1) large initial bundle parsing, (2) all routes loaded upfront (missing code splitting), (3) synchronous data fetching before render.

**Q: What's the difference between `async` and `defer` script attributes?**

> A: Both download the script in parallel without blocking HTML parsing. The difference is *when* they execute: `async` executes as soon as the download finishes (blocks HTML parsing if it finishes mid-parse). `defer` waits until HTML parsing is complete, then executes in order. Use `async` for independent scripts (analytics). Use `defer` for scripts that access the DOM.

**Q: When would you choose SSR over SSG?**

> A: SSG (static generation) when content doesn't change per-user or per-request (marketing pages, docs, blogs) — fastest TTFB since HTML is pre-built. SSR when content is dynamic or user-specific (social feed, dashboard, e-commerce with real-time pricing) — HTML is built per request but can be cached at CDN. CSR when you need rich interactivity and SEO doesn't matter much (admin panels, editing tools).

**Q: Explain Core Web Vitals and which one is hardest to fix?**

> A: LCP (<2.5s) = when main content loads, fixed with server optimization and CDN. INP (<200ms) = interaction responsiveness, fixed with code splitting and reducing long tasks. CLS (<0.1) = layout stability, fixed with image dimensions and avoiding DOM insertions above fold. INP is hardest because it requires finding every long task across the entire JS execution path.

---

## Keywords & Glossary

| Term | Definition |
|---|---|
| **Main thread** | The single browser thread that handles JS execution, layout, rendering, and user input |
| **Long task** | Any main thread task >50ms — blocks input for that duration |
| **Core Web Vitals** | Google's user-centric metrics: LCP, INP, CLS |
| **Code splitting** | Breaking JS bundle into chunks loaded on demand |
| **Lazy loading** | Deferring load of resources (images, components) until needed |
| **Virtual scrolling** | Rendering only visible list items — handles lists of millions of items |
| **SSG** | Static Site Generation — HTML built at compile time |
| **SSR** | Server-Side Rendering — HTML built per request on the server |
| **CSR** | Client-Side Rendering — SPA where browser builds all HTML |
| **React.memo** | HOC that skips re-renders when props haven't changed |
| **Intersection Observer** | Browser API for detecting when elements enter the viewport |
| **requestIdleCallback** | Run non-critical work when browser is idle |
