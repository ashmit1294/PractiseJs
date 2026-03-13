/*
=============================================================
  NEXT.JS THEORY — INTERVIEW Q&A
  Basic → Intermediate → Advanced
  For 7+ years experience
=============================================================
*/
import type { NextRequest, NextFetchEvent } from 'next/server';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────
// ██ SECTION 1: BASIC
// ─────────────────────────────────────────────────────────

/*
Q1 [BASIC]: What is the difference between the Pages Router and App Router?
────────────────────────────────────────────────────────────────────────────
A: Pages Router (pages/): React 17 mental model. getServerSideProps / getStaticProps
   run on server, page component always runs on client.

   App Router (app/): React 18 + Server Components. ALL components are Server Components
   by default. 'use client' directive opts into client-side rendering.

   Key mental model shift:
   - Pages Router: "server functions + client component"
   - App Router:   "server tree (default) with client islands embedded"
*/

// Pages Router — getServerSideProps pattern:
// export async function getServerSideProps(context) {
//   const data = await fetch('https://api.example.com/data').then(r => r.json());
//   return { props: { data } };   // runs on server, props serialized and sent to client
// }
// export default function Page({ data }) {  // ← runs on CLIENT (hydration required)
//   return <div>{data.title}</div>;
// }

// App Router — Server Component (default):
// async function Page({ params }: { params: { id: string } }) {
//   // Runs ONLY on server — can directly query DB, no useEffect needed
//   const data = await db.posts.findById(params.id);  // ← direct DB access
//   return <div>{data.title}</div>;
// }
// NO props serialized to client — just HTML streamed. Zero JS bundle for this component.

/*
Q2 [BASIC]: What are the four caching layers in Next.js App Router?
────────────────────────────────────────────────────────────────────
A: Next.js App Router has 4 distinct caches that interact with each other:

   1. Request Memoization (in-memory, per-request)
      → Same fetch() URL called multiple times in one render tree → deduplicated.
      → Automatically cleared after each request.

   2. Data Cache (persistent, per-deployment)
      → fetch() results stored on the server. Default: infinite.
      → Controlled by { cache: 'force-cache' | 'no-store' } or { next: { revalidate: N } }

   3. Full Route Cache (persistent, per-deployment)
      → Static routes (no dynamic data) are rendered at build time and cached.
      → Similar to old getStaticProps.

   4. Router Cache (client-side, in browser memory)
      → Prefetched pages and navigated routes stored in browser memory
      → Cleared on page refresh or soft navigation expiry
*/

// Controlling Data Cache behavior:
async function examples() {
  // Cache forever (default for fetch in Server Components):
  const staticData = await fetch('https://api.example.com/config', {
    cache: 'force-cache',  // ← cached indefinitely until revalidation
  });

  // No cache — always fresh (equivalent to getServerSideProps):
  const freshData = await fetch('https://api.example.com/live-prices', {
    cache: 'no-store',     // ← always fetches from origin
  });

  // Time-based revalidation (ISR equivalent):
  const revalidatedData = await fetch('https://api.example.com/products', {
    next: { revalidate: 3600 },  // ← revalidate at most every 1 hour
  });

  // Tag-based revalidation (on-demand ISR):
  const taggedData = await fetch('https://api.example.com/posts', {
    next: { tags: ['posts'] },   // ← revalidate when revalidateTag('posts') is called
  });
}

/*
Q3 [BASIC]: What are Server Actions and how are they different from API Routes?
────────────────────────────────────────────────────────────────────────────────
A: Server Actions: async functions marked 'use server' that run on the server but
   can be called from client components as if they were regular function calls.
   Next.js handles the transport (POST to a unique endpoint) automatically.

   API Routes: explicit HTTP endpoints (/pages/api/* or /app/api/*/route.ts).
   You manage request/response manually. More flexible for webhooks, external clients.
*/

// Server Action — simple form mutation:
// 'use server'  ← file-level directive makes all exports Server Actions

async function createPost(formData: FormData) {
  'use server';  // ← can also be inline in async component

  const title   = formData.get('title') as string;
  const content = formData.get('content') as string;

  // Validation (ALWAYS validate on server — client can be bypassed)
  if (!title || title.length < 3) {
    return { error: 'Title must be at least 3 characters' };
  }

  // Direct DB access — no API round trip
  // await db.posts.create({ title, content, userId: session.user.id });

  // Revalidate cache after mutation:
  // revalidatePath('/posts');
  // revalidateTag('posts');
  return { success: true };
}

// In a Client Component:
// export default function PostForm() {
//   return (
//     <form action={createPost}>   {/* Server Action passed to native form */}
//       <input name="title" />
//       <button type="submit">Create</button>
//     </form>
//   );
// }

// ─────────────────────────────────────────────────────────
// ██ SECTION 2: INTERMEDIATE
// ─────────────────────────────────────────────────────────

/*
Q4 [INTERMEDIATE]: How does streaming SSR work in Next.js?
───────────────────────────────────────────────────────────
A: Traditional SSR: server must render the ENTIRE page before sending any HTML.
   Streaming SSR: server sends HTML in chunks as parts of the tree resolve.
   Uses HTTP chunked transfer encoding + React's renderToPipeableStream.

   Next.js streaming via:
   1. Suspense boundaries: content inside <Suspense> streams when ready
   2. loading.tsx: shown immediately, replaced when segment finishes
   3. error.tsx: error boundaries per segment
*/

// app/posts/page.tsx — streaming with Suspense:
// import { Suspense } from 'react';
//
// export default function PostsPage() {
//   return (
//     <div>
//       <h1>Posts</h1>                      {/* sent immediately */}
//       <Suspense fallback={<Spinner />}>
//         <PostList />                       {/* streamed when async data resolves */}
//       </Suspense>
//       <Suspense fallback={<Skeleton />}>
//         <Recommendations />                {/* streams independently */}
//       </Suspense>
//     </div>
//   );
// }
//
// async function PostList() {               // ← async Server Component
//   const posts = await db.posts.findAll(); // ← blocks only THIS component's stream
//   return posts.map(p => <PostCard key={p.id} post={p} />);
// }

// HTML sent to client in order:
// Chunk 1: <h1>Posts</h1><div data-fallback>Spinner</div><div data-fallback>Skeleton</div>
// Chunk 2: <script>replace Spinner with PostList HTML</script>
// Chunk 3: <script>replace Skeleton with Recommendations HTML</script>

/*
Q5 [INTERMEDIATE]: How does Middleware work in Next.js?
────────────────────────────────────────────────────────
A: Middleware runs BEFORE the cache and BEFORE routing — at the Edge, on EVERY request
   matching the config.matcher pattern. It can rewrite, redirect, modify headers, or
   short-circuit the request.
   Runs in Edge Runtime (V8 isolates) — cannot use Node.js APIs.
*/

// middleware.ts (must be at root next to app/):
export function middleware(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;

  // Example 1: Authentication gate
  const token = request.cookies.get('session')?.value;
  if (pathname.startsWith('/dashboard') && !token) {
    // Redirect unauthenticated users to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Example 2: A/B testing — rewrite to variant without URL change
  const variant = Math.random() > 0.5 ? 'a' : 'b';
  if (pathname === '/landing') {
    return NextResponse.rewrite(new URL(`/landing/${variant}`, request.url));
  }

  // Example 3: Add security headers to every response
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

// Limit middleware to specific paths (performance — don't run on every static asset):
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/:path*',
    // Exclude static files and _next internals:
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

/*
Q6 [INTERMEDIATE]: How do you implement on-demand Incremental Static Regeneration (ISR)?
──────────────────────────────────────────────────────────────────────────────────────────
A: ISR = pre-render static pages at build time, then re-generate them in the background
   after a revalidation period (stale-while-revalidate pattern).

   On-demand ISR: purge the cache IMMEDIATELY when data changes (CMS webhook, etc.)
   without waiting for the time-based interval.
*/

// app/api/revalidate/route.ts — webhook from CMS:
// import { revalidatePath, revalidateTag } from 'next/cache';
// import { NextRequest } from 'next/server';

// export async function POST(request: NextRequest): Promise<Response> {
//   // Verify webhook secret to prevent unauthorized cache invalidation
//   const secret = request.headers.get('x-webhook-secret');
//   if (secret !== process.env.REVALIDATION_SECRET) {
//     return new Response('Unauthorized', { status: 401 });
//   }
//
//   const body = await request.json();
//
//   // Revalidate specific path (purge full route cache for /blog/my-post):
//   if (body.type === 'post.updated') {
//     revalidatePath(`/blog/${body.slug}`);
//   }
//
//   // Revalidate by tag (purges all fetch() calls tagged with 'posts'):
//   if (body.type === 'post.published') {
//     revalidateTag('posts');
//     revalidatePath('/blog');
//   }
//
//   return Response.json({ revalidated: true, timestamp: Date.now() });
// }

// ─────────────────────────────────────────────────────────
// ██ SECTION 3: ADVANCED
// ─────────────────────────────────────────────────────────

/*
Q7 [ADVANCED]: What is the RSC Payload and how does navigation work in App Router?
────────────────────────────────────────────────────────────────────────────────────
A: RSC Payload: a special binary format (React's wire format) that represents the
   Server Component tree. It contains:
   - Rendered output of Server Components (serialized React element tree)
   - Placeholders for Client Components (with their JS bundle references)
   - Props passed to Client Components (must be serializable)

   During NAVIGATION (soft nav — not full page reload):
   1. Next.js fetches the RSC payload for the new route from the server
   2. React reconciles the payload against the current component tree
   3. Client Components that are already mounted ARE PRESERVED (state not lost!)
   4. Only changed Server Component output is updated in the DOM

   This means: navigating between pages does NOT unmount Client Component state
   as long as they appear in both routes.
*/

// Illustrates the "donut pattern" — passing Server Components through Client Components:
// ❌ WRONG: Can't import a Server Component inside a Client Component
// 'use client';
// import ServerComp from './server-only';  // ← module system makes this a client comp

// ✓ CORRECT: Pass Server Component as children prop
// Server Component (parent):
// async function Layout({ children }) {
//   const data = await fetchSlowData();             // ← server-only
//   return (
//     <InteractiveShell data={data}>
//       {children}                                  // ← children can be Server Components
//     </InteractiveShell>
//   );
// }
// // InteractiveShell is 'use client' but children are still server-rendered

/*
Q8 [ADVANCED]: What are Parallel Routes and Intercepting Routes?
──────────────────────────────────────────────────────────────────
A: Parallel Routes: render multiple pages simultaneously in the same layout.
   Named slots (@folder convention). Used for: dashboard with independent data,
   side panels, split views.

   Intercepting Routes: render a route in a "modal" context while keeping the
   background layout. Used for: photo/post modals (Instagram-style), quick look.
*/

// app/dashboard/layout.tsx — Parallel Routes:
// export default function DashboardLayout({
//   children,
//   analytics,   // ← @analytics/page.tsx
//   team,        // ← @team/page.tsx
// }: {
//   children:  React.ReactNode;
//   analytics: React.ReactNode;
//   team:      React.ReactNode;
// }) {
//   return (
//     <div>
//       <main>{children}</main>
//       <aside>{analytics}</aside>    {/* loads independently, can have own loading.tsx */}
//       <aside>{team}</aside>
//     </div>
//   );
// }

// Intercepting Routes example (app/photos/(..)photos/[id]/page.tsx):
// When navigating from /timeline → photo click:
//   - Intercept: render photo in modal ON TOP of timeline (URL changes to /photos/1)
//   - Direct access to /photos/1: render full photo page
// The (..)(.) notation refers to parent route segment conventions

/*
Q9 [ADVANCED]: How do you safely implement authentication with Server Actions?
───────────────────────────────────────────────────────────────────────────────
A: Server Actions are publicly exposed HTTP endpoints (even if not written as API routes).
   Next.js generates a unique ID for each action, which is an HTTP POST endpoint.
   CRITICAL: always validate auth inside the action — never trust client-sent data for authorization.
*/

// lib/auth.ts — reusable server-side session getter:
// import { cookies } from 'next/headers';
// import { verifyToken } from './jwt';
//
// export async function getSession() {
//   const cookieStore = cookies();                     // ← request-scoped
//   const token = cookieStore.get('session')?.value;
//   if (!token) return null;
//   return verifyToken(token);                         // ← throws if tampered
// }

// SECURE Server Action pattern:
// 'use server'
// import { getSession } from '@/lib/auth';
// import { z } from 'zod';
//
// const UpdatePostSchema = z.object({
//   postId: z.string().uuid(),
//   title: z.string().min(3).max(100),
// });
//
// export async function updatePost(formData: FormData) {
//   // 1. Auth check — inside the action, not outside
//   const session = await getSession();
//   if (!session) throw new Error('Unauthenticated');
//
//   // 2. Input validation (Zod) — never trust FormData types
//   const result = UpdatePostSchema.safeParse({
//     postId: formData.get('postId'),
//     title:  formData.get('title'),
//   });
//   if (!result.success) return { error: result.error.flatten() };
//
//   // 3. Ownership check — ensure user owns the resource
//   const post = await db.posts.findById(result.data.postId);
//   if (post.authorId !== session.userId) throw new Error('Forbidden');
//
//   // 4. Perform the mutation
//   await db.posts.update(result.data.postId, { title: result.data.title });
//   revalidatePath(`/posts/${result.data.postId}`);
//   return { success: true };
// }

/*
Q10 [ADVANCED]: How does Next.js Image Optimization work under the hood?
─────────────────────────────────────────────────────────────────────────
A: next/image is NOT just an <img> wrapper. It:
   1. Serves images from /_next/image?url=...&w=...&q=... endpoint (Next.js image server)
   2. Automatically converts to WebP/AVIF based on browser Accept header
   3. Resizes to the exact rendered size (no 2MB image for a 100px thumbnail)
   4. Lazy loads by default (Intersection Observer / native loading="lazy")
   5. Prevents layout shift via aspect ratio reservation (width + height props)
   6. Caches resized images on server disk (or CDN with cache headers)
*/

// Configuration in next.config.js for external image sources:
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/photo-**',        // ← restrict path patterns for security (SSRF prevention)
      },
    ],
    formats: ['image/avif', 'image/webp'],  // ← priority order for format selection
    minimumCacheTTL: 3600,                  // ← cache optimized images 1 hour minimum
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],  // ← breakpoints for srcset
  },
};

// Proper Image component usage:
// import Image from 'next/image';
//
// // Hero image (above-fold — disable lazy loading):
// <Image src="/hero.jpg" alt="Hero" width={1200} height={600} priority />
//
// // Below-fold (lazy by default):
// <Image src={post.coverImage} alt={post.title} fill sizes="(max-width: 768px) 100vw, 50vw" />
// ^ fill layout: fills parent container. sizes tells browser how wide at each breakpoint.

export {};

// ─────────────────────────────────────────────────────────
// ██ SECTION 5: WEBPACK & TURBOPACK (Next.js Build Tooling)
// ─────────────────────────────────────────────────────────

/*
Q11 [BASIC]: How does webpack work in Next.js and when do you customise it?
────────────────────────────────────────────────────────────────────────────
A: Next.js uses webpack internally for all builds (Pages Router always; App Router by default).
   It pre-configures everything: babel/SWC transpilation, CSS Modules, image optimisation,
   fast refresh, code splitting per-page.

   You customise webpack via next.config.js when you need to:
   - Add loaders for non-standard file types (SVG, WASM, MDX)
   - Add custom webpack plugins
   - Modify resolve aliases
*/
/*
// next.config.js — customise webpack:
module.exports = {
  webpack(config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) {
    // Add SVG as React component import:
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    // Add custom alias:
    config.resolve.alias['@components'] = path.resolve(__dirname, 'components');

    // Bundle analyser in production:
    if (!dev && !isServer) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(new BundleAnalyzerPlugin({ analyzerMode: 'static' }));
    }

    return config;  // must return the modified config
  },
};
*/

/*
Q12 [BASIC]: What is Turbopack and how does it compare to webpack?
───────────────────────────────────────────────────────────────────
A: Turbopack is a Rust-based incremental bundler built by Vercel, designed to replace
   webpack for Next.js. Announced at Next.js Conf 2022, stable in Next.js 15 (dev mode).

   Core differences:
   webpack: JavaScript, single-threaded bundling, evaluates all modules on change
   Turbopack: Rust, parallel compilation, computes ONLY what changed (function-level caching)

   Benchmark claims (next.js.org):
   - 700x faster updates than webpack in large apps
   - 4x faster cold starts (no cold-compilation phase)
   - startup time scales O(routes visited) not O(total app size) — lazy compilation

   Status (2026):
   - `next dev --turbo` → stable for development server
   - `next build` with Turbopack → available (Next.js 15+)
*/

/*
Q13 [INTERMEDIATE]: How does Turbopack's incremental computation work?
───────────────────────────────────────────────────────────────────────
A: Turbopack uses a demand-driven incremental computation engine called "Turbo engine".
   Built on top of the principle from Salsa (Rust incremental computation framework).

   Key idea: each transformation is a PURE FUNCTION.
   Results are cached by input hash. When a file changes:
   1. Only that file's transformation is re-run
   2. The changed output propagates upward through the dependency graph
   3. Only modules that ACTUALLY depend on the changed output are recomputed
   4. Everything else is served from cache

   Compare to webpack HMR:
   - webpack: re-processes the entire module graph from the changed file upward
   - Turbopack: tracks fine-grained dependencies — if you change a CSS file,
     only CSS processing re-runs; JS bundles unaffected
*/
// next.config.ts — enabling Turbopack features:
/*
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Next.js 15: turbopack config namespace
  turbopack: {
    // Custom loaders (equivalent to webpack module.rules):
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
      '*.mdx': {
        loaders: ['@next/mdx'],
        as: '*.js',
      },
    },
    // Resolve aliases:
    resolveAlias: {
      '@components': './src/components',
      '@lib': './src/lib',
    },
  },
};
export default config;
*/

/*
Q14 [INTERMEDIATE]: What is SWC and why did Next.js switch from Babel to SWC?
───────────────────────────────────────────────────────────────────────────────
A: SWC (Speedy Web Compiler) is a Rust-based TypeScript/JavaScript compiler.
   Next.js replaced Babel with SWC in Next.js 12 (2021).

   Why SWC over Babel:
   1. 17x faster single-threaded compilation (Rust vs JavaScript)
   2. 5x faster with parallelism
   3. Built-in Next.js transforms: styled-components, emotion, Jest transforms
   4. No Babel config needed for standard Next.js projects
   5. Source maps are more accurate

   SWC handles: TypeScript stripping, JSX transform, modern JS downleveling.
   Turbopack uses SWC as its compiler (they are separate: Turbopack = bundler, SWC = compiler).
*/
// .swcrc (only needed for advanced customisation — usually not required in Next.js):
/*
{
  "jsc": {
    "parser": { "syntax": "typescript", "tsx": true },
    "transform": {
      "react": {
        "runtime": "automatic",           // React 17+ automatic JSX transform (no import React)
        "development": true,              // adds __self, __source in dev mode
        "refresh": true                   // Fast Refresh support
      }
    },
    "target": "es2017"
  }
}
*/

/*
Q15 [ADVANCED]: How do you analyse and optimise Next.js bundle size?
──────────────────────────────────────────────────────────────────────
A: Techniques for reducing JS bundle size in production:
*/
// Step 1: Analyse the bundle
// npm install @next/bundle-analyzer
/*
// next.config.js:
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
module.exports = withBundleAnalyzer({});

// Run: ANALYZE=true next build
// Opens treemap in browser showing: each chunk, what's in it, size
*/

// Step 2: Common fixes
// A) Replace heavy libraries with lighter alternatives
//    moment (330KB) → date-fns (tree-shakeable, 20KB per function)
//    lodash (70KB)  → lodash-es + tree-shaking, or native JS
//    axios (12KB)   → native fetch (0KB)

// B) Dynamic import heavy components
/*
const HeavyEditor = dynamic(() => import('./RichTextEditor'), {
  ssr: false,                // don't render on server (often unnecessary for editors)
  loading: () => <Spinner />,
});
*/

// C) next/dynamic with ssr:false for client-only libraries:
/*
const Chart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
// recharts is large (150KB) but only shown in dashboard → loaded on demand
*/

// D) Barrel file problem (common in large projects):
// BAD: index.ts re-exports everything — webpack/turbopack bundles ALL of it
//   import { Button } from '@/components';  // pulls in ALL components if not tree-shaken

// GOOD: direct import
//   import { Button } from '@/components/Button';

// E) Check Next.js build output for large first-load JS:
// next build → shows First Load JS per route
// Target: < 100KB for critical routes
