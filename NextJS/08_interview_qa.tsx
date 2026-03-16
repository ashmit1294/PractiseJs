/**
 * QUESTION SET: Next.js Interview Q&A — Comprehensive
 *
 * 50+ questions covering:
 * - App Router vs Pages Router
 * - Server / Client Components
 * - Data fetching strategies
 * - Rendering models (SSG, SSR, ISR, PPR, CSR)
 * - Caching layers
 * - Performance & optimization
 * - Common gotchas
 */

// ─────────────────────────────────────────────
// SECTION 1: Fundamentals
// ─────────────────────────────────────────────

/*
Q1: What is the difference between App Router and Pages Router?

Pages Router (before Next.js 13):
  - All pages live in /pages directory
  - Client components by default
  - Data fetching via getStaticProps / getServerSideProps / getInitialProps
  - Layouts: custom _app.tsx pattern
  - API routes in /pages/api/

App Router (Next.js 13+):
  - Pages live in /app directory
  - Server Components (RSC) by default — zero JS sent to browser
  - Data fetching: async/await directly in components
  - Nested, shared layouts with layout.tsx
  - Route Handlers replace API routes
  - Supports Server Actions (mutations without separate API routes)
  - Streaming with React Suspense
  - Full support for React 18 concurrent features

When to choose: Pages Router for existing projects. App Router for new projects — it is now stable and the recommended approach.
*/

/*
Q2: What are React Server Components (RSC)?

RSC are components that run exclusively on the server.
They can:
  - Read files, query databases, access secrets
  - Import heavy server-only libraries without shipping to the browser
  - Pass data (props) down to Client Components

They CANNOT:
  - Use useState, useEffect, or any hooks
  - Use browser-only APIs (window, document)
  - Add event listeners directly

Example:
  async function UserProfile({ id }: { id: string }) {
    const user = await db.user.findUnique({ where: { id } }); // runs on server only
    return <div>{user.name}</div>;
  }
*/

/*
Q3: What is the 'use client' directive?

Marks a file as a Client Component. All components rendered in that
component tree become client components. The bundle is sent to the
browser for interactivity.

Use 'use client' when you need:
  - React hooks (useState, useEffect, useRef…)
  - Browser APIs
  - Event listeners
  - 3rd-party client-only libraries

The boundary is the file that has 'use client'. Child imports within
that file are also treated as client components.

PATTERN: Push 'use client' as deep in the tree as possible to minimise JS payload.
*/

/*
Q4: How does Next.js handle hydration?

1. Server renders HTML (Server Component tree + Client placeholders)
2. HTML is streamed to the browser — user sees content immediately
3. JS bundles for Client Components are downloaded
4. React "hydrates": attaches event listeners, reconciles with existing DOM
   without re-rendering (diff with server output)

Mismatch errors: occur when server HTML ≠ client render (e.g., Date.now()).
Fix: suppress with suppressHydrationWarning or use useEffect for browser-only state.
*/

// ─────────────────────────────────────────────
// SECTION 2: Data Fetching
// ─────────────────────────────────────────────

/*
Q5: What are the four rendering strategies?

1. SSG (Static Site Generation) — HTML built at build time
   - next/cache: 'force-cache' or no cache option (default in App Router)
   - Pages Router: getStaticProps
   - Best for: marketing pages, blogs, docs

2. ISR (Incremental Static Regeneration) — Static + periodic revalidation
   - export const revalidate = 60; (revalidate every 60s)
   - Pages Router: getStaticProps + revalidate
   - Best for: content that changes infrequently

3. SSR (Server-Side Rendering) — HTML generated per request
   - fetch('url', { cache: 'no-store' }) or export const dynamic = 'force-dynamic'
   - Pages Router: getServerSideProps
   - Best for: personalised pages, real-time data

4. CSR (Client-Side Rendering) — JS renders content in the browser
   - hook-based fetching (SWR, React Query, useEffect)
   - Best for: dashboards behind auth, highly interactive UIs

PPR (Partial Pre-Rendering) — experimental Next.js 14+
   - Static shell rendered at build, dynamic parts streamed per request
   - Wrap dynamic parts in <Suspense>; only those slots are dynamic
*/

/*
Q6: Explain the fetch() caching model in App Router

Next.js extends (patches) the native fetch to add caching.

fetch(url, { cache: 'force-cache' })       — cache forever (SSG default)
fetch(url, { cache: 'no-store' })          — never cache (SSR)
fetch(url, { next: { revalidate: 60 } })   — TTL-based ISR (60 seconds)
fetch(url, { next: { tags: ['posts'] } })  — tag-based revalidation

On-demand revalidation (Route Handler / Server Action):
  import { revalidateTag } from 'next/cache';
  revalidateTag('posts');  // invalidates all fetches tagged 'posts'

  import { revalidatePath } from 'next/cache';
  revalidatePath('/blog');  // invalidates /blog page cache
*/

/*
Q7: How do Server Actions work?

Server Actions are async functions marked with "use server" that run
exclusively on the server. They can be called from Client Components
as if they were functions, but they execute as RPCs (POST requests).

Features:
  - Direct database mutations without API routes
  - Integrated with HTML <form action={serverAction}>
  - Works without JS (progressive enhancement)
  - Can call revalidateTag / revalidatePath after mutations
  - Automatically encode multipart/form-data for file uploads

Security model:
  - Always validates input server-side (never trust client)
  - Authenticated by verifying session inside the action
  - Next.js auto-generates encrypted action IDs (CSRF protection since v14)

Example:
  'use server';
  export async function createPost(formData: FormData) {
    const title = formData.get('title') as string;
    await db.post.create({ data: { title } });
    revalidatePath('/blog');
  }
*/

/*
Q8: What is the difference between revalidatePath and revalidateTag?

revalidatePath('/blog')        — purges cached data for a specific URL
revalidatePath('/blog', 'layout') — purges down from that layout

revalidateTag('posts')         — purges all fetch() calls tagged 'posts'
                                  (may span multiple pages)

Use revalidateTag for content changes that affect many pages,
revalidatePath for changes specific to one route.
*/

/*
Q9: How does streaming with Suspense work in Next.js?

Next.js streams HTML progressively instead of waiting for all data.

Pattern:
  export default function Dashboard() {
    return (
      <>
        <StaticHeader />                        ← sent immediately
        <Suspense fallback={<Spinner />}>
          <SlowDashboardStats />                ← async, streamed later
        </Suspense>
        <Suspense fallback={<Spinner />}>
          <RecentActivity />                    ← async, streamed later
        </Suspense>
      </>
    );
  }

  async function SlowDashboardStats() {
    const stats = await fetchStats();            ← awaits data on server
    return <StatsChart data={stats} />;
  }

Benefits:
  - TTFB (time to first byte) is immediate
  - Each Suspense boundary resolves independently
  - Loader fallbacks visible while specific sections load
  - Bot/crawlers still receive full HTML (SEO safe — crawlers wait for all chunks)
*/

// ─────────────────────────────────────────────
// SECTION 3: Routing
// ─────────────────────────────────────────────

/*
Q10: What are parallel routes and when do you use them?

Parallel routes allow rendering multiple pages in the same layout
simultaneously, each with their own loading/error states.

File system:
  app/dashboard/
    layout.tsx           ← receives @analytics and @team as props
    @analytics/page.tsx
    @team/page.tsx
    page.tsx

  export default function DashboardLayout({
    children, analytics, team
  }: { children, analytics, team }) {
    return (
      <main>
        {children}
        <aside>{analytics}</aside>
        <aside>{team}</aside>
      </main>
    );
  }

Use cases: dashboards with independent sections, modals with parallel loading.
*/

/*
Q11: What are intercepting routes?

Allow a route to "intercept" and render inside the current layout
(e.g., show a photo in a modal) while the full page still exists at /photos/123.

Convention:
  (.)  — intercept same level
  (..) — intercept one level up
  (..)(..) — intercept two levels up
  (...) — intercept from root

Example: clicking /photos/123 in a feed shows a modal overlay (intercepted).
  Directly visiting /photos/123 shows full photo page.
*/

/*
Q12: How does Next.js Middleware work?

Runs before a request is completed — on every matching request, at the Edge.

Can: read/write request/response headers, redirect, rewrite, set cookies.
Cannot: access Node.js APIs (runs in V8 sandbox), return a body directly (must use next()).

Use cases:
  - Auth check (redirect unauthenticated users)
  - A/B testing (rewrite to different variants)
  - Geo-based redirects
  - Bot detection
  - Rate limiting (via edge KV store)

matcher config:
  export const config = {
    matcher: [
      '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
  };
*/

// ─────────────────────────────────────────────
// SECTION 4: Caching Architecture
// ─────────────────────────────────────────────

/*
Q13: What are the four caching layers in Next.js 14?

1. Request Memoization (per request, RAM)
   - Deduplicates identical fetch() / React cache() calls within a single render
   - Automatically cleared after request completes
   - Only applies to GET requests

2. Data Cache (persistent, disk/CDN)
   - fetch() results stored with 'force-cache' or next.revalidate
   - Persists across deployments (until manually invalidated)
   - Scoped per Data Source URL + options

3. Full Route Cache (build-time, disk/CDN)
   - Cached HTML + RSC Payload for static routes at build time
   - Served from CDN edge without hitting server
   - Invalidated on deploy or revalidation

4. Router Cache (client-side, memory)
   - In-browser cache of visited route segments (RSC Payload)
   - Prevents unnecessary re-fetches when navigating back
   - Lives for the session; configurable duration

Opt-out of all caching for a route:
  export const dynamic = 'force-dynamic';
  export const revalidate = 0;
*/

/*
Q14: What is the RSC Payload?

A compact binary representation of the rendered React Server Component tree.
Includes:
  - Rendered output of Server Components
  - Placeholders for Client Components (not their JS code)
  - Props passed from Server → Client Components

Used by:
  - Full Route Cache (stored on server)
  - Router Cache (stored in browser during navigation)
  - Hydration (React reconciles server payload with hydrated tree)
*/

// ─────────────────────────────────────────────
// SECTION 5: Performance
// ─────────────────────────────────────────────

/*
Q15: How does next/image optimise performance?

  - Lazy loading by default (loading="lazy")
  - Prevents Cumulative Layout Shift (CLS) via width/height reservation
  - Automatic WebP/AVIF format conversion based on browser support
  - Responsive srcset via 'sizes' prop
  - Built-in image resizing via Next.js server (or cloud providers like Cloudinary)

Critical images: add priority={true} to disable lazy loading → improves LCP.

Remote images must be declared in next.config.js:
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.example.com' }]
  }
*/

/*
Q16: What is dynamic() and when do you use it?

import dynamic from 'next/dynamic';
const Map = dynamic(() => import('./Map'), { ssr: false });

Use cases:
  - Libraries that use window/document at import time (ssr: false)
  - Large components only needed in specific user flows (code splitting)
  - Show a loading skeleton while the component's bundle loads

Without ssr: false the component still renders on server but its JS is split.
*/

/*
Q17: What are Core Web Vitals and how does Next.js target them?

LCP (Largest Contentful Paint — loading):
  - next/image with priority={true} on hero images
  - Streaming HTML for fast TTFB
  - ISR/SSG to serve from CDN edge

FID / INP (Interactivity):
  - Minimise client JS (Server Components default)
  - Code splitting with next/dynamic
  - Move heavy work to server with Server Actions

CLS (Visual Stability):
  - next/image width/height prevents layout shift
  - next/font eliminates FOUT (font flash)
  - Skeleton loaders with Suspense
*/

// ─────────────────────────────────────────────
// SECTION 6: Configuration
// ─────────────────────────────────────────────

/*
Q18: Describe key next.config.js options

module.exports = {
  // Redirects (301/302)
  async redirects() {
    return [{ source: '/old', destination: '/new', permanent: true }];
  },

  // Rewrites — proxy requests, URL masking
  async rewrites() {
    return [{ source: '/api/legacy/:path*', destination: 'https://old.api.com/:path*' }];
  },

  // Custom response headers
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }];
  },

  // Output mode for Docker deployment
  output: 'standalone',   // copies only required node_modules

  // Image domains
  images: { remotePatterns: [{ hostname: 'cdn.example.com' }] },

  // Experimental features
  experimental: { ppr: true, serverActions: true },

  // Transpile external node_modules
  transpilePackages: ['some-esm-package'],
};
*/

/*
Q19: How do environment variables work in Next.js?

Files (loaded in priority order):
  .env.local        — local overrides, NOT committed to git
  .env.[environment] — .env.production, .env.development
  .env              — default values, can be committed

NEXT_PUBLIC_ prefix:
  - Variables prefixed with NEXT_PUBLIC_ are inlined into the client bundle
  - Exposed to browser — never put secrets here
  - NEXT_PUBLIC_API_URL=https://api.example.com

Server-only variables (no prefix):
  - Only available on the server (Server Components, API Routes, Server Actions)
  - DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY

Access: process.env.VARIABLE_NAME (string | undefined)

For TypeScript safety, augment ProcessEnv in env.d.ts:
  declare namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string;
      NEXT_PUBLIC_API_URL: string;
    }
  }
*/

// ─────────────────────────────────────────────
// SECTION 7: Deployment
// ─────────────────────────────────────────────

/*
Q20: How do you deploy Next.js with Docker?

# Multi-stage Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]

Required in next.config.js: output: 'standalone'
This copies only the required subset of node_modules.
*/

/*
Q21: Vercel vs Self-hosted deployment differences

Vercel (optimised for Next.js):
  - Automatic Edge Network (CDN for static assets + ISR)
  - Serverless Functions per route (auto-scaling)
  - Edge Functions for Middleware
  - Built-in image optimisation CDN
  - Preview deployments per PR
  - Zero config for Next.js

Self-hosted (Node.js server):
  - Single long-running `next start` process
  - No automatic CDN — use Nginx or a CDN like Cloudflare
  - Image optimisation runs in-process (more memory)
  - ISR works but no edge replication
  - Use standalone output + Docker for consistent builds

Other options: AWS Amplify, Netlify, Railway, Fly.io, render.com
*/

// ─────────────────────────────────────────────
// SECTION 8: Common Patterns & Gotchas
// ─────────────────────────────────────────────

/*
Q22: How do you share data between Server Components without prop drilling?

Option 1: React cache() (per-request singleton)
  import { cache } from 'react';
  export const getUser = cache(async (id: string) => {
    return db.user.findUnique({ where: { id } });
  });
  // Calling getUser in multiple components only hits DB once per request.

Option 2: Pass data via layouts
  Layouts are Server Components — fetch once and pass through children.
  Limitation: can only pass to direct children.

Option 3: Context (Client Components only)
  Wrap in a Provider Client Component at the top of a subtree.

Server Components CANNOT consume React Context directly — that is for Client Components only.
*/

/*
Q23: Can you import a Client Component into a Server Component?

Yes. A Server Component can render a Client Component via import.
The Client Component boundary begins at that component.

Cannot do:
  import ServerComp from './ServerComp'; // Server Component
  // inside a client component:
  'use client';
  export default function Client() {
    return <ServerComp />;  // ERROR – cannot import server-only module into client
  }

Pattern — pass Server → Client as children (composition):
  // Server Component
  export default function Page() {
    return <ClientWrapper><ServerSideData /></ClientWrapper>;
  }

  // ClientWrapper.tsx
  'use client';
  export default function ClientWrapper({ children }) {
    const [open, setOpen] = useState(false);
    return <div onClick={() => setOpen(!open)}>{children}</div>;
  }
  // ServerSideData is rendered as Server Component — the client wrapper
  // receives it as already-rendered RSC payload.
*/

/*
Q24: Why shouldn't you fetch in loops or sequentially when you can parallelise?

Bad – sequential (waterfall):
  const user = await getUser(id);        // waits 100ms
  const posts = await getUserPosts(id);  // then waits 200ms = 300ms total

Good – parallel:
  const [user, posts] = await Promise.all([getUser(id), getUserPosts(id)]);
  // 200ms total (longest wins)

Next.js also provides Request Memoization: calling the same
fetch(url) in two separate Server Components in the same render
only makes ONE network request.
*/

/*
Q25: What is Turbopack and is it production-ready?

Turbopack is the Rust-based bundler replacing Webpack in Next.js.
  - next dev --turbo  — use Turbopack in development
  - Claimed to be 700× faster cold starts, 10× faster HMR

As of Next.js 14: Turbopack for dev is stable.
Production builds (next build) still use Webpack by default.
Turbopack production support is in progress.
*/

/*
Q26: How does Next.js handle error boundaries in App Router?

Special files:
  error.tsx     — catches errors in its route segment and descendants
                  Must be a Client Component ('use client')
                  Receives error and reset props

  global-error.tsx — catches errors in root layout (replaces the layout entirely)

  not-found.tsx — rendered when notFound() is called

  Example:
    'use client';
    export default function Error({ error, reset }: {
      error: Error & { digest?: string };
      reset: () => void;
    }) {
      return (
        <div>
          <h2>Something went wrong!</h2>
          <button onClick={reset}>Try again</button>
        </div>
      );
    }

  reset() triggers a re-render of the segment, re-fetching data.
  error.digest is a hash for correlating server logs with client errors.
*/

/*
Q27: What are common Next.js interview gotchas?

1. Server Components cannot use hooks — wrap interactive parts in 'use client'
2. Cookies/headers in Server Components: use next/headers (cannot be in middleware)
3. Dynamic imports (next/dynamic) ssr:false still SSRs unless you explicitly disable
4. fetch() in Server Components is cached — add no-store for truly dynamic data
5. export const dynamic = 'force-dynamic' on a route disables ALL static rendering
6. Images without width/height or fill prop cause build errors
7. NEXT_PUBLIC_ variables are build-time inlined — changing them requires rebuild
8. Parallel routes need a default.tsx file for routes that don't match any slot
9. useSearchParams() in Client Components causes dynamic rendering of whole segment
   — wrap in Suspense to prevent the entire page becoming dynamic
10. Server Actions are POST requests — don't use them for data fetching (use async components)
*/

/*
Q28: What changed from Next.js 12 → 13 → 14?

Next.js 12:
  - Pages Router
  - Middleware (v1)
  - React 18 concurrent features preparation

Next.js 13:
  - App Router (beta → stable)
  - React Server Components
  - Turbopack (alpha)
  - next/image v2 (simpler API)
  - next/font (self-hosted fonts)

Next.js 14:
  - Server Actions stable
  - Partial Pre-Rendering (PPR) experimental
  - Turbopack dev stable
  - next/cache API (revalidateTag, revalidatePath)
  - Improved TypeScript performance
  - Metadata API stable
*/

/*
Q29: What ORM or database client libraries work best with Next.js?

Best options depend on your data source (SQL vs NoSQL):

SQL Databases:
  1. Prisma (recommended for most projects)
     - TypeScript-first ORM with great DX
     - Prisma Client auto-generates; introspect DB or declarative schema
     - Data migration built-in
     - Works with PostgreSQL, MySQL, SQLite, SQL Server, MongoDB
     - Can be used in Server Components, Server Actions, and API Routes
     
     app/api/users/route.ts
     import { PrismaClient } from '@prisma/client';
     const prisma = new PrismaClient();
     export async function GET() {
       const users = await prisma.user.findMany();
       return Response.json(users);
     }

  2. Drizzle ORM (lightweight, type-safe)
     - Lightweight alternative to Prisma
     - Lower overhead, good performance
     - Great TypeScript support
     
  3. TypeORM
     - Full-featured, decorator-based
     - Support for complex relationships
     - Repository pattern

NoSQL (MongoDB):
  1. Mongoose (schema validation on top of MongoDB)
  2. Prisma (now supports MongoDB natively)
  3. MongoDB driver (low-level, full control)

Key patterns for Next.js:
  - Import ORM client at module level (connections are reused across requests)
  - Use Server Components for auto-fetch via Prisma
  - Singleton pattern for database connections to avoid exhaustion
  
  lib/db.ts (Prisma singleton):
  import { PrismaClient } from '@prisma/client';
  const globalForPrisma = global as unknown as { prisma: PrismaClient };
  export const prisma =
    globalForPrisma.prisma || new PrismaClient();
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
*/

/*
Q30: I'm building a Next.js page where data updates very frequently (every few seconds).
     What rendering strategy and techniques should I use to make it efficient?

Answer depends on use case:

SCENARIO 1: Live updates needed (Dashboard, Stock prices, Chat)
  Best: Hybrid approach — SSR initial load + Client-side real-time updates
  
  Strategy:
    1. Use SSR (getServerSideProps or dynamic = 'force-dynamic') for initial state
    2. Hydrate with latest data on client
    3. Use WebSocket or polling for live updates
    4. Consider Vercel Postgres Realtime or other pub/sub service
  
  'use client';
  import { useEffect, useState } from 'react';
  
  export default function Dashboard({ initialData }) {
    const [data, setData] = useState(initialData);
  
    useEffect(() => {
      const ws = new WebSocket('wss://api.example.com/stock-updates');
      ws.onmessage = (event) => {
        setData(JSON.parse(event.data));
      };
      return () => ws.close();
    }, []);
  
    return <div>{data.price}</div>;
  }

SCENARIO 2: User-specific or time-sensitive data
  Best: CSR (Client-Side Rendering) with polling/WebSocket
  
  Why: SSR won't help if data becomes stale immediately after rendering.
  Serve static shell, fetch dynamic data on browser.
  
  export const dynamic = 'force-dynamic'; // prevents caching
  
  'use client';
  export default function LiveData() {
    const [data, setData] = useState(null);
    useEffect(() => {
      const interval = setInterval(async () => {
        const res = await fetch('/api/live-data');
        setData(await res.json());
      }, 1000); // fetch every second
      return () => clearInterval(interval);
    }, []);
    return <div>{data}</div>;
  }

SCENARIO 3: Regular updates but not real-time (~1-10s intervals)
  Best: ISR + polling fallback
  
  export const revalidate = 3; // revalidate every 3 seconds
  
  Combines:
    - SSG/ISR for initial fast page load (cached HTML)
    - Background revalidation to keep data fresh
    - Client-side refetch as backup
  
  Pros: Fast initial load, fresh data, less server load than SSR every request

SCENARIO 4: Updates tied to user actions (Real-time multiplayer, Collaborative editing)
  Best: Server Actions + optimistic updates
  
  'use client';
  import { updateScoreAction } from '@/app/actions';
  
  export default function Game() {
    const [score, setScore] = useState(0);
    
    const handleScore = async () => {
      // Optimistic update (show immediately)
      setScore(s => s + 10);
      // Send to server
      const result = await updateScoreAction();
      // Sync with server
      setScore(result.score);
    };
    
    return <button onClick={handleScore}>{score}</button>;
  }

PERFORMANCE TECHNIQUES:
  1. useTransition() — non-blocking updates (doesn't block UI)
  2. Suspense boundaries — show loading for specific sections
  3. Request memoization — avoid duplicate fetches in same request
  4. Incremental Static Regeneration (ISR) — background revalidation
  5. Pagination — load data in chunks, not all at once
  6. WebSocket + Server-Sent Events (SSE) — push instead of pull (more efficient)

RECOMMENDATION:
  For 7+ years experience → Use SSR + WebSocket for real-time updates.
  Fallback to ISR + polling for simplicity if WebSocket not available.
  Always consider cost vs freshness tradeoff.
*/

/*
Q31: How is data fetching different in React vs Next.js?
───────────────────────────────────────────────────────────

REACT (Client-only):
  All data fetching happens in browser (useEffect, React Query, SWR)
  
  // React
  import { useEffect, useState } from 'react';
  
  export default function UsersList() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    useEffect(() => {
      fetch('/api/users')
        .then(r => r.json())
        .then(data => {
          setUsers(data);
          setLoading(false);
        })
        .catch(err => {
          setError(err);
          setLoading(false);
        });
    }, []); // runs AFTER component renders
    
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error.message}</div>;
    return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
  }

ISSUES with React approach:
  - Waterfall: render component → download JS → useEffect runs → fetch data
  - TTFB: user sees blank screen until fetch completes
  - No SEO: crawlers don't wait for JS to fetch data
  - N+1 requests: each client makes separate API calls
  - API exposed: endpoints visible in browser network tab

NEXT.JS (Server-First):
  Data fetching happens on SERVER (Server Components, Server Actions, API Routes)
  
  // Next.js App Router — Server Component (default)
  export default async function UsersList() {
    const res = await fetch('https://api.example.com/users', {
      next: { revalidate: 60 }, // ISR: revalidate every 60s
    });
    const users = await res.json();
    
    // No state, no useEffect, no loading UI needed
    return (
      <ul>
        {users.map(u => <li key={u.id}>{u.name}</li>)}
      </ul>
    );
  }

ADVANTAGES:
  1. No waterfall: data fetched BEFORE HTML sent to browser
  2. TTFB: HTML includes data, fast first paint
  3. SEO: crawlers receive fully rendered HTML with data
  4. Secrets safe: API keys never exposed to browser
  5. Deduplication: multiple fetches of same URL in single render = 1 network request
  6. Streaming: use Suspense to show parts while others load
  
      export default function Page() {
        return (
          <>
            <h1>Dashboard</h1>
            <Suspense fallback={<p>Loading stats...</p>}>
              <Stats /> {* this part can fetch independently *}
            </Suspense>
          </>
        );
      }

COMPARISON TABLE:
                    React       | Next.js
  Data fetch timing | Client-side | Server-side (default)
  Waterfall         | Yes        | No
  TTFB              | Slow       | Fast
  SEO               | No         | Yes
  State needed      | Yes        | No (Server Components)
  Loading UI        | Manual     | Built-in (Suspense)
  Request dedup     | Manual     | Automatic
  Secrets safe      | No         | Yes
  Caching           | Manual SWR | Declarative + automatic

WHEN TO USE CLIENT-SIDE FETCHING IN NEXT.JS:
  - Real-time data (stocks, chat messages) → use 'use client' + useEffect + polling/WebSocket
  - Behind authentication → fetch on client to use session
  - User preferences → CSR with localStorage
  - Highly interactive (filters, search) → CSR with React Query / SWR
*/

/*
Q32: What are API Routes in Next.js and how do you build RESTful APIs with them?

API Routes (called Route Handlers in App Router) replace the /pages/api/ pattern.
They allow you to build backend functions without a separate server.

APP ROUTER - Route Handlers (Next.js 13+, recommended):
  File: app/api/users/route.ts
  URL: /api/users
  
  import { NextRequest, NextResponse } from 'next/server';
  
  export async function GET(request: NextRequest) {
    // GET request handler
    const users = await db.user.findMany();
    return NextResponse.json(users);
  }
  
  export async function POST(request: NextRequest) {
    // POST request handler
    const body = await request.json();
    const newUser = await db.user.create({ data: body });
    return NextResponse.json(newUser, { status: 201 });
  }
  
  export async function PUT(request: NextRequest) {
    // PUT request handler
    const body = await request.json();
    const updated = await db.user.update({ data: body });
    return NextResponse.json(updated);
  }
  
  export async function DELETE(request: NextRequest) {
    // DELETE request handler
    await db.user.delete();
    return new NextResponse(null, { status: 204 });
  }

KEY FEATURES:
  1. Type-safe request/response
     - request: NextRequest (extends Web API Request)
     - response: NextResponse (extends Web API Response) 
  
  2. Access path parameters via URL
     File: app/api/users/[id]/route.ts
     Function signature: export async function GET(req, { params: { id } })
  
  3. Query parameters
     Accessed via new URL(request.url).searchParams
     
     app/api/search/route.ts
     export async function GET(request) {
       const { searchParams } = new URL(request.url);
       const query = searchParams.get('q');
       const results = await search(query);
       return NextResponse.json(results);
     }
  
  4. Error handling
     import { NextRequest, NextResponse } from 'next/server';
     
     export async function GET(req: NextRequest) {
       try {
         const data = await fetchData();
         return NextResponse.json(data);
       } catch (err) {
         return NextResponse.json(
           { error: err.message },
           { status: 500 }
         );
       }
     }
  
  5. Middleware support
     Can chain with Middleware for auth, logging, rate-limiting
     
     export const middleware = (request: NextRequest) => {
       const token = request.headers.get('authorization');
       if (!token) {
         return new NextResponse('Unauthorized', { status: 401 });
       }
       return NextResponse.next();
     };
  
  6. Streaming responses
     export async function GET(request) {
       const stream = new ReadableStream({
         async start(controller) {
           const data = await db.user.findMany();
           for (const user of data) {
             controller.enqueue(JSON.stringify(user) + '\n');
           }
           controller.close();
         },
       });
       return new NextResponse(stream);
     }
  
  7. Webhooks / External service calls
     export async function POST(request) {
       const event = await request.json();
       if (event.type === 'user.created') {
         await sendWelcomeEmail(event.user.email);
       }
       return NextResponse.json({ ok: true });
     }

PAGES ROUTER - API Routes (Legacy, still supported):
  File: pages/api/users.ts
  URL: /api/users
  
  export default function handler(req, res) {
    if (req.method === 'GET') {
      const users = await db.user.findMany();
      res.status(200).json(users);
    } else if (req.method === 'POST') {
      const newUser = await db.user.create({ data: req.body });
      res.status(201).json(newUser);
    } else {
      res.status(405).end(); // Method Not Allowed
    }
  }

BEST PRACTICES:
  1. Keep logic in external functions/services (separate from route handler)
  2. Use environment variables for secrets (NEVER hardcode)
  3. Always validate + sanitize input (input validation)
  4. Return appropriate HTTP status codes (200, 201, 400, 401, 500)
  5. Use proper error handling (try/catch)
  6. Add rate limiting for public endpoints
  7. Document API (OpenAPI/Swagger or similar)
  8. Use TypeScript for type safety
  9. Version your API if planning major changes (/api/v1/users)
  10. Consider using Server Actions for form submissions instead of Route Handlers

WHEN TO USE ROUTE HANDLERS vs SERVER ACTIONS:
  Route Handlers:
    - RESTful API design
    - External clients (mobile apps, third-party services)
    - Webhooks / incoming requests
    - Complex querystring/header processing
  
  Server Actions:
    - Form submissions from your own pages
    - Simple data mutations
    - Simpler mental model (no HTTP)
*/

export {};
