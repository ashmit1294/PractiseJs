# Next.js — Interview Revision Summary

> **Target:** 7+ year Full Stack MERN Developer | **Files:** 9

## Table of Contents

1. [01_app_router_fundamentals.tsx — QUESTION SET: Next.js App Router — Fundamentals](#nextjs-app-router-fundamentals)
2. [02_data_fetching_server_actions.tsx — QUESTION SET: Next.js Data Fetching](#nextjs-data-fetching-server-actions)
3. [03_routing_middleware.tsx — QUESTION SET: Next.js Routing — Dynamic, Parallel, Intercepting, Middleware](#nextjs-routing-middleware)
4. [04_authentication.tsx — QUESTION SET: Next.js Authentication Patterns](#nextjs-authentication)
5. [05_performance_optimization.tsx — QUESTION SET: Next.js Performance Optimization](#nextjs-performance-optimization)
6. [06_pages_router_data_fetching.tsx — QUESTION SET: Next.js Pages Router — Data Fetching](#nextjs-pages-router-data-fetching)
7. [07_seo_metadata_i18n.tsx — QUESTION SET: Next.js SEO, Metadata & Internationalization](#nextjs-seo-metadata-i18n)
8. [08_interview_qa.tsx — QUESTION SET: Next.js Interview Q&A — Comprehensive](#nextjs-interview-qa)
9. [FILE: 09_theory_interview_qa.tsx](#nextjs-theory-interview-qa)
   - [Scenario-Based Questions](#nextjs-scenarios)

---

<a id="nextjs-app-router-fundamentals"></a>
## 01_app_router_fundamentals.tsx — QUESTION SET: Next.js App Router — Fundamentals

```tsx
/**
 * QUESTION SET: Next.js App Router — Fundamentals
 *
 * Next.js 13+ App Router uses the `app/` directory.
 * Core concepts:
 * - Server Components (default) — render on server, zero JS to client
 * - Client Components ('use client') — interactive, run in browser
 * - Layouts — persist across route changes
 * - Loading/Error/Not-found UI — co-located with routes
 * - Metadata API — SEO and Open Graph tags
 */

// ─────────────────────────────────────────────
// File structure: app/ directory
// ─────────────────────────────────────────────
//
// app/
//   layout.tsx          ← Root layout (wraps all pages, never unmounts)
//   page.tsx            ← Home page (/)
//   loading.tsx         ← Streaming loading UI for (/)
//   error.tsx           ← Error boundary for (/)
//   not-found.tsx       ← 404 page
//   globals.css
//
//   dashboard/
//     layout.tsx        ← Nested layout (wraps all dashboard pages)
//     page.tsx          ← /dashboard
//     loading.tsx
//
//   blog/
//     page.tsx          ← /blog
//     [slug]/
//       page.tsx        ← /blog/my-post
//
//   (marketing)/        ← Route group (no URL segment)
//     about/page.tsx    ← /about
//     contact/page.tsx  ← /contact
//
//   @modal/             ← Parallel route (renders simultaneously)
//     page.tsx
//
//   api/
//     users/
//       route.ts        ← /api/users (Route Handler)

// ─────────────────────────────────────────────
// Q1. Root Layout
// app/layout.tsx — required, wraps every page
// ─────────────────────────────────────────────

// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] }); // font auto-optimized

export const metadata: Metadata = {
  title: {
    default: "My App",
    template: "%s | My App", // page title prepended, e.g. "Blog | My App"
  },
  description: "My awesome Next.js application",
  openGraph: {
    type: "website",
    url: "https://myapp.com",
    title: "My App",
    description: "…",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header>Global Nav</header>
        {children}
        <footer>Global Footer</footer>
      </body>
    </html>
  );
}

// ─────────────────────────────────────────────
// Q2. Server Component (default)
// No 'use client' — async function, can await directly
// Runs ONLY on server — no access to browser APIs or hooks
// ─────────────────────────────────────────────

// app/blog/page.tsx
export default async function BlogPage() {
  // Direct DB call or fetch — no useEffect needed!
  const posts = await fetch("https://api.example.com/posts", {
    next: { revalidate: 3600 }, // ISR: revalidate every 1 hour
  }).then((r) => r.json());

  return (
    <main>
      <h1>Blog</h1>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <a href={`/blog/${post.slug}`}>{post.title}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}

// ─────────────────────────────────────────────
// Q3. Client Component — interactive
// Must add 'use client' directive at top
// Cannot use async/await at component level
// ─────────────────────────────────────────────

// app/components/LikeButton.tsx
"use client";

import { useState, useTransition } from "react";

export default function LikeButton({ postId, initialLikes }: { postId: string; initialLikes: number }) {
  const [likes, setLikes] = useState(initialLikes);
  const [isPending, startTransition] = useTransition();

  const handleLike = () => {
    startTransition(async () => {
      // Call Server Action (defined separately)
      await likePostAction(postId);
      setLikes((l) => l + 1);
    });
  };

  return (
    <button onClick={handleLike} disabled={isPending}>
      ❤️ {likes}
    </button>
  );
}

// ─────────────────────────────────────────────
// Q4. Nested Layout — dashboard section
// Shares dashboard sidebar, nav, etc.
// ─────────────────────────────────────────────

// app/dashboard/layout.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "./auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/login"); // server-side redirect

  return (
    <div className="dashboard">
      <nav className="sidebar">
        <a href="/dashboard">Overview</a>
        <a href="/dashboard/settings">Settings</a>
        <a href="/dashboard/analytics">Analytics</a>
      </nav>
      <main className="dashboard-content">{children}</main>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q5. Dynamic Segments — [slug] and generateStaticParams
// ─────────────────────────────────────────────

// app/blog/[slug]/page.tsx
import { notFound } from "next/navigation";

// Pre-generate static paths at build time (like getStaticPaths)
export async function generateStaticParams() {
  const posts = await fetch("https://api.example.com/posts").then((r) => r.json());
  return posts.map((post) => ({ slug: post.slug }));
}

// Generate metadata per dynamic page
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { images: [post.coverImage] },
  };
}

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) notFound(); // renders not-found.tsx

  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.htmlContent }} />
    </article>
  );
}

async function getPost(slug: string) {
  const res = await fetch(`https://api.example.com/posts/${slug}`, {
    next: { tags: [`post-${slug}`] }, // for on-demand revalidation
  });
  if (!res.ok) return null;
  return res.json();
}

// ─────────────────────────────────────────────
// Q6. loading.tsx — Streaming with Suspense
// Shown immediately while the page component awaits data
// ─────────────────────────────────────────────

// app/blog/loading.tsx
export default function BlogLoading() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton-card" />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Q7. error.tsx — Error Boundary (must be Client Component)
// ─────────────────────────────────────────────

// app/dashboard/error.tsx
"use client";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // logErrorToService(error);
  }, [error]);

  return (
    <div>
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q8. Route Groups — organize without affecting URL
// (marketing)/ → URL is /about, not /marketing/about
// ─────────────────────────────────────────────

// app/(marketing)/about/page.tsx → URL: /about
// app/(marketing)/layout.tsx     → layout ONLY for marketing pages
// app/(app)/dashboard/page.tsx   → URL: /dashboard

// Use case: different layouts for different sections
// app/(public)/layout.tsx  → unauthenticated layout
// app/(private)/layout.tsx → authenticated layout (with auth check)

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the App Router vs Pages Router?
  A: Pages Router (Next.js ≤12): pages/ directory, file = route, uses
     getStaticProps/getServerSideProps for data.
     App Router (Next.js 13+): app/ directory, defaults to Server Components,
     layouts, streaming, Server Actions, much more composable.

  Q: What is the difference between Server and Client Components?
  A: Server Components: run only on server, can async/await directly,
     no hooks/browser APIs, zero JS bundle added, great for data fetching.
     Client Components: 'use client', full React features (hooks, events),
     run in browser (also SSR'd once), interactive.

  Q: Can Server Components contain Client Components?
  A: Yes. Server renders the tree; Client Components are "islands" of
     interactivity. But Client Components CANNOT import Server Components.

  Q: When does layout.tsx re-render?
  A: Layouts DO NOT re-render on navigation between routes that share the layout.
     They persist — this is unlike the Pages Router where every navigation
     re-renders the whole page.

  Q: What is the purpose of loading.tsx?
  A: It renders immediately as a Suspense fallback while the page component
     streams its data. Users see the loading UI instantly instead of a blank page.
*/

export {};

---
```

<a id="nextjs-data-fetching-server-actions"></a>
## 02_data_fetching_server_actions.tsx — QUESTION SET: Next.js Data Fetching

```tsx
/**
 * QUESTION SET: Next.js Data Fetching
 *
 * App Router data fetching strategies:
 * 1. Static  → build time, cached until revalidated (like SSG)
 * 2. Dynamic → per request, uncached (like SSR)
 * 3. ISR     → static + time-based or on-demand revalidation
 * 4. Client  → useEffect / SWR / React Query (browser only)
 *
 * Extended `fetch()` with `next` options replaces
 * getStaticProps / getServerSideProps from Pages Router
 */

// ─────────────────────────────────────────────
// Q1. fetch() caching options in App Router
// ─────────────────────────────────────────────
async function fetchExamples() {
  // STATIC — cached forever, like getStaticProps
  const staticData = await fetch("https://api.example.com/config", {
    cache: "force-cache",          // default behavior
  });

  // DYNAMIC — no cache, fresh every request, like getServerSideProps
  const dynamicData = await fetch("https://api.example.com/live-prices", {
    cache: "no-store",
  });

  // ISR — revalidate every 60 seconds
  const isrData = await fetch("https://api.example.com/posts", {
    next: { revalidate: 60 },
  });

  // Tagged — revalidate on demand by tag
  const taggedData = await fetch("https://api.example.com/products", {
    next: { tags: ["products"] },
  });
}

// ─────────────────────────────────────────────
// Q2. On-demand revalidation — revalidateTag, revalidatePath
// Triggered from Server Actions or Route Handlers (webhooks)
// ─────────────────────────────────────────────

// app/api/revalidate/route.ts
import { revalidateTag, revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");

  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const body = await request.json();

  if (body.type === "product") {
    revalidateTag("products");           // invalidates all fetches tagged "products"
    revalidatePath("/products");         // also invalidate the static page
    revalidatePath("/products/[slug]", "page"); // all dynamic product pages
  }

  return NextResponse.json({ revalidated: true, now: Date.now() });
}

// ─────────────────────────────────────────────
// Q3. Server Component with parallel data fetching
// Multiple fetches run concurrently — not waterfall
// ─────────────────────────────────────────────

// app/dashboard/page.tsx
export default async function DashboardPage() {
  // Parallel fetching — both start at the same time
  const [user, analytics, notifications] = await Promise.all([
    getUser(),
    getAnalytics(),
    getNotifications(),
  ]);

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <Analytics data={analytics} />
      <Notifications items={notifications} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Q4. Sequential fetching with Suspense streaming
// Each Suspense boundary streams independently
// ─────────────────────────────────────────────

import { Suspense } from "react";

// app/profile/page.tsx
export default function ProfilePage({ params }) {
  return (
    <div>
      {/* Fast — renders first */}
      <Suspense fallback={<UserSkeleton />}>
        <UserInfo userId={params.id} />
      </Suspense>

      {/* Slower — streams in after */}
      <Suspense fallback={<PostsSkeleton />}>
        <UserPosts userId={params.id} />
      </Suspense>

      {/* Slowest — streams last */}
      <Suspense fallback={<ActivitySkeleton />}>
        <UserActivity userId={params.id} />
      </Suspense>
    </div>
  );
}

async function UserInfo({ userId }: { userId: string }) {
  const user = await getUser(userId); // fast DB query
  return <div>{user.name}</div>;
}

async function UserPosts({ userId }: { userId: string }) {
  const posts = await getPosts(userId); // slower
  return <ul>{posts.map((p) => <li key={p.id}>{p.title}</li>)}</ul>;
}

// ─────────────────────────────────────────────
// Q5. Server Actions — mutations from Server or Client Components
// Functions that run on the server, called from client events
// ─────────────────────────────────────────────

// app/actions/posts.ts
"use server"; // all exports in this file become Server Actions

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const createPostSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10),
  tags: z.array(z.string()).optional(),
});

export async function createPostAction(formData: FormData) {
  // Validate with Zod
  const raw = {
    title: formData.get("title"),
    content: formData.get("content"),
  };

  const result = createPostSchema.safeParse(raw);
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  // Get authenticated user
  const session = await getServerSession();
  if (!session) redirect("/login");

  // Create post
  const post = await db.posts.create({
    ...result.data,
    authorId: session.userId,
  });

  // Revalidate the posts list page
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);

  // Redirect to new post
  redirect(`/blog/${post.slug}`);
}

export async function deletePostAction(postId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");

  const post = await db.posts.findById(postId);
  if (post.authorId !== session.userId) throw new Error("Forbidden");

  await db.posts.delete(postId);
  revalidatePath("/blog");
}

// ─────────────────────────────────────────────
// Q6. Using Server Actions in forms (progressive enhancement)
// Works even without JavaScript (native form POST)
// ─────────────────────────────────────────────

// app/blog/new/page.tsx — Server Component
import { createPostAction } from "../actions/posts";

export default function NewPostPage() {
  return (
    // action prop accepts a Server Action
    <form action={createPostAction}>
      <input name="title" placeholder="Post title" required />
      <textarea name="content" placeholder="Content" required />
      <button type="submit">Publish</button>
    </form>
  );
}

// ─────────────────────────────────────────────
// Q7. useFormState + useFormStatus — enhanced form UX
// 'use client' component that calls a Server Action
// ─────────────────────────────────────────────

"use client";
import { useFormState, useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus(); // reads parent <form> submission state
  return (
    <button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Publishing…" : "Publish Post"}
    </button>
  );
}

const initialState = { errors: null, message: null };

export function CreatePostForm() {
  const [state, formAction] = useFormState(createPostAction, initialState);

  return (
    <form action={formAction}>
      <input name="title" />
      {state.errors?.title && <p className="error">{state.errors.title[0]}</p>}
      <textarea name="content" />
      {state.errors?.content && <p className="error">{state.errors.content[0]}</p>}
      <SubmitButton />
    </form>
  );
}

// ─────────────────────────────────────────────
// Q8. Route Handlers — API endpoints (replaces API Routes)
// app/api/users/route.ts
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const users = await db.users.findAll({ skip: (page - 1) * limit, take: limit });
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // validate body…
  const user = await db.users.create(body);
  return NextResponse.json(user, { status: 201 });
}

// Dynamic Route Handler: app/api/users/[id]/route.ts
export async function GET_BY_ID(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await db.users.findById(params.id);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: How do you make a page entirely dynamic (SSR) in App Router?
  A: Use cache: "no-store" on every fetch, OR export:
     export const dynamic = 'force-dynamic'
     Other options: 'auto' (default), 'force-static', 'error' (fail if dynamic)

  Q: What replaced getStaticProps and getServerSideProps?
  A: App Router uses the extended fetch() API with next.revalidate and
     next.tags options. The caching behavior maps to the same concepts:
     - cache: 'force-cache'     → getStaticProps (static)
     - cache: 'no-store'        → getServerSideProps (dynamic/SSR)
     - next: { revalidate: N }  → getStaticProps + revalidate (ISR)

  Q: What is a Server Action?
  A: An async function with "use server" that runs on the server but
     can be called like a regular function from Client Components or forms.
     React serializes arguments, calls the server, returns the result.
     Replaces custom API route handlers for mutations.

  Q: What does revalidateTag do?
  A: Invalidates all cached fetch() calls that were tagged with that tag.
     On the next request for a page using that data, fetch() re-runs
     and the new data is cached and served.

  Q: What is the request waterfall problem?
  A: When data fetches are sequential (each awaits the previous):
     const user = await getUser();        // 100ms
     const posts = await getPosts(user.id); // 200ms (waits for user!)
     Total: 300ms. Fix with Promise.all() if there's no dependency.
*/

export {};

---
```

<a id="nextjs-routing-middleware"></a>
## 03_routing_middleware.tsx — QUESTION SET: Next.js Routing — Dynamic, Parallel, Intercepting, Middleware

```tsx
/**
 * QUESTION SET: Next.js Routing — Dynamic, Parallel, Intercepting, Middleware
 *
 * Routing features in App Router:
 * 1. Dynamic routes — [slug], [...slug], [[...slug]]
 * 2. Route groups — (group)
 * 3. Parallel routes — @slot
 * 4. Intercepting routes — (.)route, (..)route
 * 5. Middleware — runs before request reaches a route
 */

import { NextResponse, NextRequest } from "next/server";
import { notFound, redirect, permanentRedirect } from "next/navigation";

// ─────────────────────────────────────────────
// Q1. Dynamic route segments
// ─────────────────────────────────────────────
//
// [slug]        → /blog/my-post         (single segment)
// [...slug]     → /docs/a/b/c           (catch-all, required)
// [[...slug]]   → /docs OR /docs/a/b/c  (optional catch-all)
//
// app/blog/[slug]/page.tsx
export default async function BlogPost({ params }: { params: { slug: string } }) {
  return <h1>Post: {params.slug}</h1>;
}

// app/docs/[...path]/page.tsx - catch-all → params.path = ['a', 'b', 'c']
export default async function DocsPage({ params }: { params: { path: string[] } }) {
  const breadcrumb = params.path.join(" / ");
  return <h1>Docs: {breadcrumb}</h1>;
}

// app/shop/[[...category]]/page.tsx
// Matches /shop AND /shop/clothes AND /shop/clothes/shirts
export default async function ShopPage({
  params,
}: {
  params: { category?: string[] };
}) {
  if (!params.category) return <h1>All Products</h1>;
  return <h1>Category: {params.category.join(" > ")}</h1>;
}

// ─────────────────────────────────────────────
// Q2. Parallel Routes — @slot convention
// Render multiple pages simultaneously in the same layout
// Use case: modals, split views, conditional slots
// ─────────────────────────────────────────────
//
// app/dashboard/
//   layout.tsx
//   page.tsx
//   @analytics/
//     page.tsx          ← rendered as `analytics` slot
//   @team/
//     page.tsx          ← rendered as `team` slot

// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
  analytics,
  team,
}: {
  children: React.ReactNode;
  analytics: React.ReactNode; // @analytics slot
  team: React.ReactNode;      // @team slot
}) {
  return (
    <div>
      <div>{children}</div>
      <aside>
        {analytics}
        {team}
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q3. Intercepting Routes — open in modal, direct URL shows full page
// (.) same level, (..) one level up, (...) root level
// ─────────────────────────────────────────────
//
// app/
//   feed/
//     page.tsx              ← /feed
//   photo/
//     [id]/
//       page.tsx            ← /photo/123 (direct URL = full page)
//   (.)photo/               ← intercepts /photo/123 from /feed
//     [id]/
//       page.tsx            ← renders as modal when navigating from /feed

// app/(.)photo/[id]/page.tsx — intercepted route shows modal
export default function PhotoModal({ params }: { params: { id: string } }) {
  return (
    <dialog open>
      <img src={`/photos/${params.id}.jpg`} alt="Photo" />
    </dialog>
  );
}

// ─────────────────────────────────────────────
// Q4. Middleware — runs AT THE EDGE before request processing
// Matches every request unless configured with a matcher
// ─────────────────────────────────────────────

// middleware.ts (root level, next to app/)
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Authentication check for protected routes
  if (pathname.startsWith("/dashboard")) {
    const token = request.cookies.get("token")?.value;
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Optionally verify token without DB (JWT decode only — fast at edge)
    try {
      const { jwtVerify } = require("jose");
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      // await jwtVerify(token, secret); // verify signature
    } catch {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // A/B Testing — assign experiment variant
  const variant = request.cookies.get("ab-variant")?.value;
  if (!variant && pathname === "/") {
    const response = NextResponse.next();
    const newVariant = Math.random() > 0.5 ? "A" : "B";
    response.cookies.set("ab-variant", newVariant, { maxAge: 86400 });
    return response;
  }

  // Geo-based redirect
  const country = request.geo?.country;
  if (country === "GB" && pathname === "/") {
    return NextResponse.redirect(new URL("/uk", request.url));
  }

  // Add custom header to response
  const response = NextResponse.next();
  response.headers.set("X-Request-ID", crypto.randomUUID());
  return response;
}

// Configure which paths trigger middleware
export const config = {
  matcher: [
    // Match all except static files and api routes
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
    // Or more explicitly:
    "/dashboard/:path*",
    "/profile/:path*",
  ],
};

// ─────────────────────────────────────────────
// Q5. Programmatic navigation
// ─────────────────────────────────────────────

// Server Component — use redirect(), permanentRedirect(), notFound()
async function ServerPage({ params }: { params: { id: string } }) {
  const post = await db.posts.findById(params.id);
  if (!post) notFound();                           // renders not-found.tsx
  if (post.status === "moved") redirect(`/new/${params.id}`);     // 307
  if (post.slug !== params.id) permanentRedirect(`/blog/${post.slug}`); // 308
  return <div>{post.title}</div>;
}

// Client Component — useRouter, Link
"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

function NavComponent() {
  const router = useRouter();
  const pathname = usePathname();        // /dashboard/settings
  const searchParams = useSearchParams(); // URLSearchParams

  const handleNav = () => {
    router.push("/dashboard");           // navigate
    router.replace("/login");           // replace (no back button entry)
    router.back();                       // browser back
    router.prefetch("/heavy-page");     // prefetch in background
  };

  return (
    <nav>
      {/* Link prefetches on viewport entry (production) */}
      <Link href="/blog" prefetch={true}>Blog</Link>

      {/* Link with dynamic query params */}
      <Link href={{ pathname: "/search", query: { q: "next.js" } }}>Search</Link>

      <p>Current path: {pathname}</p>
    </nav>
  );
}

// ─────────────────────────────────────────────
// Q6. Route Handler — webhook endpoint with signature verification
// ─────────────────────────────────────────────

// app/api/webhooks/stripe/route.ts
import Stripe from "stripe";
import { headers } from "next/headers";

export async function POST(request: NextRequest) {
  const body = await request.text();   // must be raw text for signature verification
  const signature = headers().get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionCanceled(event.data.object);
      break;
  }

  return NextResponse.json({ received: true });
}

// ─────────────────────────────────────────────
// Q7. Next.js Link — prefetching behavior
// ─────────────────────────────────────────────

// When a <Link> component enters the viewport:
// - In PRODUCTION: Next.js prefetches the linked page in the background
// - In DEVELOPMENT: no prefetching
//
// prefetch={true}  → always prefetch (default for static pages)
// prefetch={false} → never prefetch (use for expensive/dynamic pages)
// prefetch={null}  → auto (default, prefetch static, not dynamic)

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the difference between redirect() and useRouter().push()?
  A: redirect() is used in Server Components, Server Actions, and Route Handlers.
     Causes a 307 redirect response (308 for permanentRedirect).
     useRouter().push() is Client-side navigation — no HTTP redirect,
     uses the browser history API, faster (no full network round-trip).

  Q: What is middleware in Next.js?
  A: A function that runs at the Edge (CDN) before every matched request.
     Can rewrite, redirect, modify headers, or short-circuit the request.
     Runs before routing, caching, and rendering.

  Q: What is the difference between rewrite and redirect in middleware?
  A: redirect: changes the URL in the browser (client sees new URL)
     rewrite: internally routes to a different path, but URL STAYS the same in browser
     Useful for A/B testing, dark launch, multi-tenant routing.

  Q: What is an intercepting route?
  A: A route that intercepts navigation to another route and renders it in-context
     (e.g., as a modal) while still allowing direct URL access to the full page.
     Uses naming conventions: (.) same level, (..) parent level, (...) root.

  Q: What is a parallel route used for?
  A: Rendering multiple pages simultaneously in the same layout.
     Each @slot is a separate part of the page that can load independently,
     have its own loading/error states, and stream separately.
*/

export {};

---
```

<a id="nextjs-authentication"></a>
## 04_authentication.tsx — QUESTION SET: Next.js Authentication Patterns

```tsx
/**
 * QUESTION SET: Next.js Authentication Patterns
 *
 * Common approaches:
 * 1. NextAuth.js / Auth.js — OAuth, credentials, magic links
 * 2. JWT in HTTP-only cookies
 * 3. Session-based auth
 * 4. Middleware-based route protection
 * 5. Server Action auth checks
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// ─────────────────────────────────────────────
// Q1. NextAuth.js (Auth.js) setup
// Industry standard — handles OAuth, JWT, sessions, CSRF
// ─────────────────────────────────────────────

// app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),     // persist sessions/users to DB

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user?.password) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],

  session: { strategy: "jwt" },        // use JWT stored in cookie (no DB query per request)
  // session: { strategy: 'database' } // use DB sessions (more secure but slower)

  callbacks: {
    // Add custom fields to the JWT
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    // Expose JWT fields on the session object (available on client)
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    // Control sign-in (return false to reject)
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        return user.email?.endsWith("@mycompany.com") ?? false;
      }
      return true;
    },
  },

  pages: {
    signIn: "/login",        // custom sign-in page
    error: "/auth/error",   // error page
    verifyRequest: "/auth/verify",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

// ─────────────────────────────────────────────
// Q2. Getting session — server vs client
// ─────────────────────────────────────────────

// SERVER COMPONENT — getServerSession (no round-trip)
import { getServerSession } from "next-auth";

export default async function ProtectedPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return <h1>Hello, {session.user.name}</h1>;
}

// CLIENT COMPONENT — useSession hook
"use client";
import { useSession, SessionProvider } from "next-auth/react";

function ProfileButton() {
  const { data: session, status } = useSession();
  if (status === "loading") return <span>Loading…</span>;
  if (!session) return <a href="/login">Sign in</a>;
  return <span>{session.user.name}</span>;
}

// Wrap app in SessionProvider (usually in a client layout component)
function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

// ─────────────────────────────────────────────
// Q3. Manual JWT auth with HTTP-only cookies
// ─────────────────────────────────────────────

// app/api/auth/login/route.ts
import jwt from "jsonwebtoken";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  const user = await db.users.findOne({ where: { email } });
  if (!user || !await bcrypt.compare(password, user.password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
  );
  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: "7d" }
  );

  const response = NextResponse.json({ user: { id: user.id, name: user.name } });

  // HTTP-only: not accessible via JS (prevents XSS theft)
  // Secure: only sent over HTTPS
  // SameSite=Strict: not sent on cross-site requests (prevents CSRF)
  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 3600,
    path: "/",
  });

  response.cookies.set("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 604800,
    path: "/api/auth/refresh",
  });

  return response;
}

// ─────────────────────────────────────────────
// Q4. Reading session in Server Components (custom JWT)
// ─────────────────────────────────────────────

// lib/auth.ts
async function getSession() {
  const cookieStore = cookies();    // import from 'next/headers'
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      role: string;
    };
    return decoded;
  } catch {
    return null; // expired or invalid
  }
}

// Helper: assert authenticated (use in Server Components / Actions)
async function requireAuth() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

// ─────────────────────────────────────────────
// Q5. Middleware-level auth (fastest — runs at edge)
// ─────────────────────────────────────────────

// middleware.ts
import { jwtVerify } from "jose"; // jose works at edge (no Node.js crypto)

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login?callbackUrl=" + request.nextUrl.pathname, request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    // Token invalid/expired — clear cookie and redirect
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("token");
    return response;
  }
}

// ─────────────────────────────────────────────
// Q6. RBAC — Role-Based Access Control in Server Actions
// ─────────────────────────────────────────────

"use server";

async function requireRole(role: "ADMIN" | "EDITOR" | "VIEWER") {
  const session = await getSession();
  if (!session) redirect("/login");

  const roles = ["VIEWER", "EDITOR", "ADMIN"];
  if (roles.indexOf(session.role) < roles.indexOf(role)) {
    throw new Error("Insufficient permissions");
  }

  return session;
}

export async function deleteUserAction(userId: string) {
  const session = await requireRole("ADMIN");

  await db.users.delete(userId);
  revalidatePath("/admin/users");
}

export async function publishPostAction(postId: string) {
  const session = await requireRole("EDITOR");

  const post = await db.posts.findById(postId);
  if (post.authorId !== session.userId && session.role !== "ADMIN") {
    throw new Error("Can only publish your own posts");
  }

  await db.posts.update(postId, { status: "PUBLISHED" });
  revalidatePath(`/blog/${post.slug}`);
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: Why use HTTP-only cookies instead of localStorage for tokens?
  A: HTTP-only cookies: cannot be read by JavaScript (prevents XSS token theft).
     They are automatically sent with every request.
     localStorage: accessible by JS — any XSS vulnerability can steal tokens.
     Always store auth tokens in HTTP-only cookies.

  Q: How does Next.js middleware protect routes?
  A: Middleware runs before request processing, at the Edge.
     It can verify a JWT in the cookie without a DB round-trip (fast).
     If invalid, redirect to /login. If valid, allow request to proceed.

  Q: What is the difference between session and JWT strategy in NextAuth?
  A: Session strategy: stores session in DB, sends session ID in cookie.
     Allows instant revocation (delete from DB), but requires DB query per request.
     JWT strategy: signs user data into cookie. No DB query per request.
     Revocation requires a token denylist (extra complexity).

  Q: How do you protect Server Actions from unauthorized access?
  A: Server Actions are public HTTP endpoints. Always validate auth inside them.
     Cannot rely on UI hiding — users can call the action URL directly.
     Check session/role at the start of every action that modifies data.

  Q: What is CSRF and how does Next.js protect against it?
  A: CSRF: Cross-Site Request Forgery — malicious site triggers requests to your app.
     Next.js Route Handlers and Server Actions include built-in CSRF protection
     via Origin header checking. HTTP-only cookies with SameSite=Strict also help.
*/

export {};

---
```

<a id="nextjs-performance-optimization"></a>
## 05_performance_optimization.tsx — QUESTION SET: Next.js Performance Optimization

```tsx
/**
 * QUESTION SET: Next.js Performance Optimization
 *
 * 1. Image optimization (next/image)
 * 2. Font optimization (next/font)
 * 3. Script optimization (next/script)
 * 4. Bundle analysis and code splitting
 * 5. Caching strategies
 * 6. Core Web Vitals optimization
 */

import Image from "next/image";
import { Inter, Roboto_Mono } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";

// ─────────────────────────────────────────────
// Q1. next/image — automatic image optimization
// - Lazy loading (by default)
// - WebP/AVIF conversion
// - Responsive sizes
// - Prevents CLS (Cumulative Layout Shift)
// ─────────────────────────────────────────────

function ProductImages() {
  return (
    <div>
      {/* Fixed size image */}
      <Image
        src="/hero.jpg"
        alt="Hero image"
        width={1200}
        height={600}
        priority           // LCP image: loads eagerly, no lazy loading
        quality={85}       // default 75 — balance quality vs size
        placeholder="blur" // shows blur while loading
        blurDataURL="data:image/jpeg;base64,..."
      />

      {/* Responsive image — fills container */}
      <div style={{ position: "relative", height: "400px" }}>
        <Image
          src="/background.jpg"
          alt="Background"
          fill              // fills parent (no width/height needed)
          style={{ objectFit: "cover" }}
          sizes="(max-width: 768px) 100vw, 50vw" // help browser choose correct srcset
        />
      </div>

      {/* Remote image */}
      <Image
        src="https://images.unsplash.com/photo-123"
        alt="Remote"
        width={400}
        height={300}
        // Requires next.config.js: images.remotePatterns
      />
    </div>
  );
}

// next.config.js — allow remote image domains
// module.exports = {
//   images: {
//     remotePatterns: [
//       { protocol: 'https', hostname: 'images.unsplash.com' },
//       { protocol: 'https', hostname: '**.amazonaws.com' },
//     ],
//     formats: ['image/avif', 'image/webp'],  // AVIF preferred (better compression)
//     deviceSizes: [640, 750, 828, 1080, 1200], // srcset breakpoints
//   },
// };

// ─────────────────────────────────────────────
// Q2. next/font — zero layout shift, no external network request
// Fonts downloaded at BUILD TIME and self-hosted optimally
// ─────────────────────────────────────────────

// Auto-optimized Google fonts
const inter = Inter({
  subsets: ["latin"],
  display: "swap",          // font-display: swap (show fallback while loading)
  variable: "--font-inter", // CSS variable: use with Tailwind
  preload: true,
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  weight: ["400", "700"],  // only download needed weights
});

// Local fonts (self-hosted, no Google)
const geist = localFont({
  src: [
    { path: "./fonts/GeistRegular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/GeistBold.woff2",    weight: "700", style: "normal" },
  ],
  variable: "--font-geist",
  display: "swap",
});

// Apply to body in root layout
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}

// ─────────────────────────────────────────────
// Q3. next/script — load order control
// ─────────────────────────────────────────────
export default function PageWithScripts() {
  return (
    <>
      {/* beforeInteractive: load before page becomes interactive
          Only allowed in app/layout.tsx
          Use for scripts needed before hydration (critical) */}
      <Script
        src="https://cdn.example.com/critical.js"
        strategy="beforeInteractive"
      />

      {/* afterInteractive (default): loads after page hydrates
          Safe for analytics, chat widgets */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"
        strategy="afterInteractive"
      />

      {/* lazyOnload: lowest priority, loads during idle time
          Use for non-essential scripts (feedback widgets) */}
      <Script
        src="https://widget.example.com/chat.js"
        strategy="lazyOnload"
        onLoad={() => console.log("Chat loaded")}
        onError={(e) => console.error("Script failed:", e)}
      />

      {/* Inline script with id */}
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-XXXX');
        `}
      </Script>
    </>
  );
}

// ─────────────────────────────────────────────
// Q4. Core Web Vitals and Next.js optimizations
// LCP (Largest Contentful Paint) → priority image, fast server
// CLS (Cumulative Layout Shift) → width/height on images, fonts
// FID/INP (Interaction to Next Paint) → code splitting, reduce JS
// ─────────────────────────────────────────────

// Measuring Web Vitals
export function reportWebVitals(metric) {
  // In pages/_app.tsx OR app/layout.tsx via next/web-vitals
  if (metric.label === "web-vital") {
    analytics.track("Web Vital", {
      name: metric.name,
      value: Math.round(metric.value),
      rating: metric.rating, // "good" | "needs-improvement" | "poor"
    });
  }
}

// ─────────────────────────────────────────────
// Q5. Dynamic imports with loading states
// Code-split heavy components, load on demand
// ─────────────────────────────────────────────
import dynamic from "next/dynamic";

// Client-side only (SSR disabled) — e.g. charts, WebGL, libraries using window
const HeavyChart = dynamic(() => import("./components/HeavyChart"), {
  loading: () => <p>Loading chart…</p>,
  ssr: false,                          // skip SSR — renders only in browser
});

// Lazy load with named export
const MapComponent = dynamic(
  () => import("./components/Map").then((mod) => mod.MapComponent),
  { ssr: false }
);

// ─────────────────────────────────────────────
// Q6. Route Segment Config — opt-in/out of caching at page level
// ─────────────────────────────────────────────

// Make the entire page dynamic (SSR)
export const dynamic = "force-dynamic";

// Revalidate every 60 seconds (ISR)
export const revalidate = 60;

// Max request duration (for edge/serverless functions)
export const maxDuration = 30; // seconds

// Specify runtime
export const runtime = "edge"; // or 'nodejs' (default)

// ─────────────────────────────────────────────
// Q7. Partial Pre-Rendering (PPR) — Next.js 14 experimental
// Combines static shell with dynamic holes using Suspense
// ─────────────────────────────────────────────

// next.config.js:
// experimental: { ppr: true }

// app/product/[id]/page.tsx
import { Suspense } from "react";

// The outer shell is static (fast)
// Only <DynamicRecommendations /> is deferred
export default async function ProductPage({ params }) {
  const product = await getProduct(params.id); // cached/static

  return (
    <div>
      {/* Static: product info — included in initial HTML */}
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <p>${product.price}</p>

      {/* Dynamic: loads after static shell — Suspense boundary */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <DynamicRecommendations productId={params.id} />
      </Suspense>
    </div>
  );
}

// This component is dynamic — fetches personalized data
async function DynamicRecommendations({ productId }) {
  const { cookies } = await import("next/headers");
  const userId = cookies().get("userId")?.value;
  const recs = await getPersonalizedRecs(productId, userId);
  return <RecommendationsList items={recs} />;
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: How does next/image prevent CLS?
  A: By requiring width and height (or fill), Next.js knows the aspect ratio
     ahead of time and reserves the correct amount of space in HTML.
     The image loads into the pre-reserved space — no layout shift.

  Q: What is the difference between priority and loading="eager"?
  A: priority={true} on next/image:
     - Adds <link rel="preload"> in <head>
     - Disables lazy loading
     - Use for above-the-fold images (hero, LCP element)
     loading="eager" on <img>: just removes lazy attribute, no preload.

  Q: What is Partial Pre-Rendering (PPR)?
  A: A rendering model that generates a static HTML shell at build time,
     then streams in the dynamic holes at request time via Suspense.
     Static parts are edge-cached and served instantly.
     Dynamic parts execute on the server per-request and stream in.
     Best of both static and dynamic worlds.

  Q: What does 'ssr: false' do in next/dynamic?
  A: Disables server-side rendering for that component.
     The component renders only in the browser (client-side).
     Use for libraries that use window/document, WebGL, canvas, leaflet maps.
     Be careful: can cause hydration mismatch if not wrapped in Suspense/check.

  Q: How do you optimize a Next.js app's bundle size?
  A: 1. Use dynamic imports for heavy components not needed on first render
     2. Only download needed font weights/subsets via next/font
     3. Check bundle with @next/bundle-analyzer
     4. Avoid importing entire libraries (use tree-shakeable imports)
     5. Use next/image (automatic WebP/AVIF, lazy load)
     6. Split routes (automatic in Next.js App Router)
*/

export {};

---
```

<a id="nextjs-pages-router-data-fetching"></a>
## 06_pages_router_data_fetching.tsx — QUESTION SET: Next.js Pages Router — Data Fetching

```tsx
/**
 * QUESTION SET: Next.js Pages Router — Data Fetching
 * (Legacy but still widely used and heavily interviewed)
 *
 * Pages Router uses pages/ directory.
 * Data fetching functions:
 * - getStaticProps  → build time, cached (SSG)
 * - getStaticPaths  → define which dynamic paths to pre-render
 * - getServerSideProps → per request, no cache (SSR)
 * - getInitialProps  → runs on server and client (avoid — use above instead)
 * - SWR / React Query → client-side fetching
 */

import { GetStaticProps, GetStaticPaths, GetServerSideProps } from "next";
import type { NextPage } from "next";
import useSWR from "swr";

// ─────────────────────────────────────────────
// Q1. getStaticProps — Static Site Generation (SSG)
// Runs at BUILD TIME on the server only
// Result is cached in CDN until next revalidation
// ─────────────────────────────────────────────

// pages/blog.tsx
type Post = { id: number; title: string; slug: string };

interface BlogProps {
  posts: Post[];
  lastUpdated: string;
}

// Page component receives props from getStaticProps
const BlogPage: NextPage<BlogProps> = ({ posts, lastUpdated }) => (
  <div>
    <h1>Blog (last updated: {lastUpdated})</h1>
    <ul>
      {posts.map((post) => (
        <li key={post.id}><a href={`/blog/${post.slug}`}>{post.title}</a></li>
      ))}
    </ul>
  </div>
);

export const getStaticProps: GetStaticProps<BlogProps> = async (context) => {
  const { locale, locales, defaultLocale, preview } = context;

  // Runs on server only — can use Node.js APIs, DB, env vars, etc.
  const res = await fetch("https://api.example.com/posts");

  if (!res.ok) {
    // Return 404 if data unavailable
    return { notFound: true };
  }

  const posts: Post[] = await res.json();

  return {
    props: {
      posts,
      lastUpdated: new Date().toISOString(),
    },
    // ISR: regenerate the page at most every 60 seconds when a request comes in
    revalidate: 60,
    // Or: return { redirect: { destination: '/new-blog', permanent: false } }
  };
};

export default BlogPage;

// ─────────────────────────────────────────────
// Q2. getStaticPaths + getStaticProps — Dynamic SSG
// Pre-render pages for specific dynamic routes at build time
// ─────────────────────────────────────────────

// pages/blog/[slug].tsx
interface PostProps {
  post: Post & { content: string };
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await fetch("https://api.example.com/posts").then((r) => r.json());

  return {
    // Pre-build pages for these paths
    paths: posts.map((p) => ({ params: { slug: p.slug } })),

    // fallback:
    // false    → 404 for any path not in `paths`
    // true     → show fallback UI while page generates on-demand
    // 'blocking' → block (SSR once) then cache, no fallback UI
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps<PostProps, { slug: string }> = async ({ params }) => {
  const res = await fetch(`https://api.example.com/posts/${params!.slug}`);
  if (!res.ok) return { notFound: true };

  const post = await res.json();
  return { props: { post }, revalidate: 300 };
};

const PostPage: NextPage<PostProps> = ({ post }) => (
  <article>
    <h1>{post.title}</h1>
    <div dangerouslySetInnerHTML={{ __html: post.content }} />
  </article>
);

export default PostPage;

// ─────────────────────────────────────────────
// Q3. getServerSideProps — Server-Side Rendering (SSR)
// Runs on EVERY REQUEST — no caching by default
// Has access to: cookies, headers, query params, request object
// ─────────────────────────────────────────────

// pages/dashboard.tsx
interface DashboardProps {
  user: { id: string; name: string; role: string };
  analytics: { views: number; clicks: number };
}

export const getServerSideProps: GetServerSideProps<DashboardProps> = async (ctx) => {
  const { req, res, query, params, locale } = ctx;

  // Read cookies
  const token = req.cookies["token"];
  if (!token) {
    return {
      redirect: {
        destination: "/login?callbackUrl=/dashboard",
        permanent: false,
      },
    };
  }

  // Set cache headers (SSR responses can be cached at CDN with care)
  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");

  try {
    const [user, analytics] = await Promise.all([
      verifyToken(token),
      getAnalytics(),
    ]);

    return { props: { user, analytics } };
  } catch {
    return { redirect: { destination: "/login", permanent: false } };
  }
};

// ─────────────────────────────────────────────
// Q4. Client-side data fetching with SWR
// Stale-While-Revalidate: return stale data, revalidate in background
// ─────────────────────────────────────────────
const fetcher = (url: string) => fetch(url).then((r) => r.json());

function UserProfile() {
  const { data, error, isLoading, mutate } = useSWR("/api/me", fetcher, {
    revalidateOnFocus: true,        // re-fetch when window regains focus
    revalidateOnReconnect: true,    // re-fetch on network reconnect
    refreshInterval: 30000,         // poll every 30s
    dedupingInterval: 2000,         // dedupe requests within 2s
    errorRetryCount: 3,
    onSuccess: (data) => console.log("User loaded:", data),
    onError: (err) => console.error("Fetch error:", err),
  });

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h1>{data.name}</h1>
      <button onClick={() => mutate()}>Refresh</button>
      {/* Optimistic update */}
      <button onClick={() => mutate({ ...data, name: "New Name" }, { revalidate: false })}>
        Update Name (optimistic)
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Q5. Custom _app.tsx and _document.tsx
// ─────────────────────────────────────────────

// pages/_app.tsx — wraps every page, persists across navigations
import type { AppProps } from "next/app";
import { SWRConfig } from "swr";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SWRConfig value={{ fetcher }}>
      {/* getLayout pattern — per-page layouts */}
      {(Component as any).getLayout
        ? (Component as any).getLayout(<Component {...pageProps} />)
        : <Component {...pageProps} />}
    </SWRConfig>
  );
}

// Per-page layout in Pages Router
const BlogPostPage: NextPage = () => <div>Post content</div>;
BlogPostPage.getLayout = (page) => (
  <BlogLayout>
    <Sidebar />
    {page}
  </BlogLayout>
);

// pages/_document.tsx — HTML structure, runs only on server
import { Html, Head, Main, NextScript } from "next/document";
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.ico" />
        {/* Custom fonts, preconnect */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

// ─────────────────────────────────────────────
// Q6. API Routes — pages/api/ (Pages Router)
// ─────────────────────────────────────────────

// pages/api/users.ts
import type { NextApiRequest, NextApiResponse } from "next";

type ApiResponse<T> = { data?: T; error?: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
) {
  try {
    switch (req.method) {
      case "GET": {
        const users = await db.users.findAll();
        return res.status(200).json({ data: users });
      }
      case "POST": {
        const user = await db.users.create(req.body);
        return res.status(201).json({ data: user });
      }
      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: When to use getStaticProps vs getServerSideProps?
  A: getStaticProps: data doesn't change per-user, can be stale briefly,
                     content-heavy sites (blogs, docs, marketing).
     getServerSideProps: data must be fresh per request, user-specific data,
                         requires cookies/headers from the request.
     getStaticProps + ISR is almost always preferred for performance.

  Q: What is ISR (Incremental Static Regeneration)?
  A: Allows serving static pages while revalidating them in the background.
     Set revalidate: N seconds in getStaticProps.
     First request after N seconds triggers regeneration — current user sees
     stale data, next user gets fresh page.

  Q: What is the difference between fallback: true and 'blocking'?
  A: true: page renders immediately with empty props, component handles
           loading state with router.isFallback check.
     'blocking': SSR the page on first request (blocks), then cache as static.
     false: any path not in paths returns 404.

  Q: How does SWR (stale-while-revalidate) work?
  A: Returns cached (stale) data immediately for fast render, then
     fetches fresh data in the background. When fresh data arrives,
     it updates the UI. Pattern: fast first paint + eventual consistency.

  Q: Can you use getServerSideProps and getStaticProps in the same page?
  A: No. A page can only export one data fetching function.
     getServerSideProps takes precedence over getStaticProps conceptually —
     they're mutually exclusive.
*/

export {};

---
```

<a id="nextjs-seo-metadata-i18n"></a>
## 07_seo_metadata_i18n.tsx — QUESTION SET: Next.js SEO, Metadata & Internationalization

```tsx
/**
 * QUESTION SET: Next.js SEO, Metadata & Internationalization
 *
 * 1. Metadata API (App Router)
 * 2. generateMetadata for dynamic pages
 * 3. Structured data (JSON-LD)
 * 4. Open Graph / Twitter Cards
 * 5. Internationalization (i18n)
 * 6. next-intl integration
 */

import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

// ─────────────────────────────────────────────
// Q1. Static metadata export — App Router
// ─────────────────────────────────────────────

// app/about/page.tsx
export const metadata: Metadata = {
  title: "About Us",            // becomes "About Us | My App" with template
  description: "Learn about our team and mission.",

  // Open Graph — social sharing
  openGraph: {
    title: "About Us — My App",
    description: "Learn about our team and mission.",
    url: "https://myapp.com/about",
    siteName: "My App",
    images: [
      {
        url: "https://myapp.com/og/about.png",
        width: 1200,
        height: 630,
        alt: "My App — About Us",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  // Twitter Card
  twitter: {
    card: "summary_large_image",
    site: "@myapp",
    creator: "@myappteam",
    title: "About Us — My App",
    description: "Learn about our team and mission.",
    images: ["https://myapp.com/og/about.png"],
  },

  // Canonical URL — prevent duplicate content penalties
  alternates: {
    canonical: "https://myapp.com/about",
    languages: {
      "en-US": "https://myapp.com/en-US/about",
      "fr-FR": "https://myapp.com/fr-FR/about",
    },
  },

  // Robots directives
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Favicons and icons
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },

  // Web app manifest
  manifest: "/site.webmanifest",

  // Theme color (browser UI color on mobile)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// ─────────────────────────────────────────────
// Q2. generateMetadata — dynamic metadata
// Called per request if the function is async
// ─────────────────────────────────────────────

// app/blog/[slug]/page.tsx
type BlogPostParams = { params: { slug: string }; searchParams: {} };

export async function generateMetadata({ params }: BlogPostParams): Promise<Metadata> {
  const post = await getPost(params.slug);

  if (!post) {
    return { title: "Post Not Found" };
  }

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.createdAt,
      modifiedTime: post.updatedAt,
      authors: [post.author.name],
      tags: post.tags,
      images: post.coverImage
        ? [{ url: post.coverImage, width: 1200, height: 630 }]
        : [],
    },
    alternates: {
      canonical: `https://myapp.com/blog/${params.slug}`,
    },
  };
}

// ─────────────────────────────────────────────
// Q3. JSON-LD Structured Data — Schema.org
// Helps Google understand content (rich results in search)
// ─────────────────────────────────────────────

function BlogPostJsonLd({ post }: { post: any }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage,
    author: {
      "@type": "Person",
      name: post.author.name,
      url: `https://myapp.com/authors/${post.author.slug}`,
    },
    publisher: {
      "@type": "Organization",
      name: "My App",
      logo: {
        "@type": "ImageObject",
        url: "https://myapp.com/logo.png",
      },
    },
    datePublished: post.createdAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://myapp.com/blog/${post.slug}`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// Organization JSON-LD (in root layout)
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "My App",
  url: "https://myapp.com",
  logo: "https://myapp.com/logo.png",
  sameAs: [
    "https://twitter.com/myapp",
    "https://github.com/myapp",
    "https://linkedin.com/company/myapp",
  ],
};

// ─────────────────────────────────────────────
// Q4. next.config.js — i18n for Pages Router
// ─────────────────────────────────────────────

// next.config.js (Pages Router only)
// module.exports = {
//   i18n: {
//     locales: ['en', 'fr', 'de', 'es'],
//     defaultLocale: 'en',
//     localeDetection: true,   // detect from Accept-Language header
//   },
// };

// pages/about.tsx — access locale in getServerSideProps / useRouter
// import { useRouter } from 'next/router';
// const { locale, locales, defaultLocale } = useRouter();

// ─────────────────────────────────────────────
// Q5. App Router i18n with next-intl
// ─────────────────────────────────────────────

// Folder structure:
// app/
//   [locale]/
//     layout.tsx    ← sets lang attribute, loads locale messages
//     page.tsx
//     blog/
//       page.tsx
// messages/
//   en.json
//   fr.json

// middleware.ts — detect and redirect to locale prefix
import createMiddleware from "next-intl/middleware";

export default createMiddleware({
  locales: ["en", "fr", "de"],
  defaultLocale: "en",
  localePrefix: "always",  // /en/about, /fr/about
});

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};

// app/[locale]/layout.tsx
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

export async function generateStaticParams() {
  return [{ locale: "en" }, { locale: "fr" }, { locale: "de" }];
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages(); // loads messages/[locale].json

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

// app/[locale]/blog/page.tsx — Server Component translation
import { useTranslations } from "next-intl";

export default function BlogPageI18n() {
  const t = useTranslations("Blog");
  return <h1>{t("title")}</h1>; // messages/en.json: { "Blog": { "title": "Blog" } }
}

// Client Component translation
"use client";
import { useTranslations } from "next-intl";

function LikeButtonI18n() {
  const t = useTranslations("Common");
  return <button>{t("like")}</button>;
}

// ─────────────────────────────────────────────
// Q6. sitemap.ts — generate XML sitemap
// app/sitemap.ts (App Router)
// ─────────────────────────────────────────────
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await fetch("https://api.example.com/posts").then((r) => r.json());

  const postUrls = posts.map((post) => ({
    url: `https://myapp.com/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: "https://myapp.com",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: "https://myapp.com/about",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...postUrls,
  ];
}

// robots.ts — generate robots.txt
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/", "/_next/"] },
      { userAgent: "Googlebot", allow: "/" },
    ],
    sitemap: "https://myapp.com/sitemap.xml",
    host: "https://myapp.com",
  };
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: How does the metadata template work?
  A: In the root layout: title: { template: '%s | My App', default: 'My App' }
     Child pages set: export const metadata = { title: 'Blog' }
     Result: <title>Blog | My App</title>
     Nested layouts can override the template.

  Q: How does generateMetadata differ from static metadata?
  A: Static metadata: exported constant — evaluated at build time.
     generateMetadata: async function — called per request (or re-used with cache).
     Use generateMetadata when title/description depends on fetched data (dynamic routes).

  Q: What is JSON-LD and why is it important?
  A: JSON-LD (Linked Data) is a format for structured data that helps
     search engines understand page content. It powers rich snippets in
     Google results (star ratings, recipe info, breadcrumbs, events, FAQs).

  Q: What is the canonical URL and why does it matter?
  A: The canonical URL tells search engines which version of a page is
     the "official" one when duplicate content exists (e.g., /blog?page=1
     and /blog pointing to same content). Prevents SEO penalties.

  Q: How do you generate a sitemap in Next.js App Router?
  A: Create app/sitemap.ts that exports a default async function returning
     MetadataRoute.Sitemap array. Next.js automatically serves it at /sitemap.xml.
     For large sites, use generateSitemaps() to split into multiple sitemaps.
*/

export {};

---
```

<a id="nextjs-interview-qa"></a>
## 08_interview_qa.tsx — QUESTION SET: Next.js Interview Q&A — Comprehensive

```tsx
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

export {};

---
```

<a id="nextjs-theory-interview-qa"></a>
## FILE: 09_theory_interview_qa.tsx

```tsx
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

---
```

---

<a id="nextjs-scenarios"></a>
## Scenario-Based Interview Questions

---

### Scenario 1: Lighthouse Score Drops to 45 After Adding a Third-Party Widget

**Situation:** You integrate a live chat widget. Lighthouse LCP jumps from 1.2s to 4.8s and the score drops from 92 to 45.

**Question:** How do you recover performance while keeping the widget?

**Answer:**
- The widget is likely adding a large synchronous script to the `<head>` that blocks rendering.
- **Delay loading**: use `next/script` with `strategy="lazyOnload"` or `strategy="afterInteractive"`:

```jsx
import Script from 'next/script';
<Script src="https://chat-widget.js" strategy="lazyOnload" />
```

- Use `strategy="afterInteractive"` for scripts needed once the user interacts.
- **Façade pattern**: show a static placeholder/image of the widget; only load the real script when the user clicks it.
- Audit with WebPageTest to confirm which resource is the LCP bottleneck.

---

### Scenario 2: Hydration Mismatch Error in Production

**Situation:** Users with certain browser extensions report a React hydration error. The console shows "Text content did not match. Server: 'X' Client: 'Y'".

**Question:** What causes hydration mismatches and how do you fix them?

**Answer:**
- The HTML rendered on the server differs from what React renders on the client.
- **Common causes**:
  - Using `window`, `navigator`, `Date.now()` during render (not available on server).
  - Browser extensions injecting elements into the DOM.
  - Rendering based on a cookie or localStorage value that the server doesn't have.
- **Fixes**:
  - Guard browser-only code: `const isClient = typeof window !== 'undefined'`.
  - Use `useEffect` for client-only data — it only runs after hydration.
  - Wrap browser-dependent components in a `<ClientOnly>` wrapper that renders `null` on the server.
  - Use `suppressHydrationWarning` sparingly only for known browser-injected elements like timestamps.

---

### Scenario 3: Server Component Fetching Same Data Multiple Times

**Situation:** Three different Server Components on the same page route each independently `fetch` the same `/api/user` endpoint. You see three identical network calls in the server trace.

**Question:** How does Next.js handle this and how do you optimise it?

**Answer:**
- Next.js 14+ **automatically deduplicates** `fetch()` calls with the same URL in the same request lifecycle (memoised per render pass).
- If you are using a custom ORM/DB call that is NOT `fetch()` (e.g., a Prisma query), wrap it in React's `cache()`:

```typescript
import { cache } from 'react';
export const getUser = cache(async (id: string) => {
  return db.user.findUnique({ where: { id } });
});
// Now calling getUser(id) three times in one render = one DB query
```

---

### Scenario 4: Large Page Bundle — Users on Mobile 3G Time Out

**Situation:** Your product page bundle is 1.8 MB. Next.js bundle analyser shows a date-formatting library (moment.js) accounting for 500 kB.

**Question:** How do you reduce it?

**Answer:**
- Replace `moment` with **`date-fns`** (tree-shaken, import only the functions you use) or the native `Intl.DateTimeFormat` API.
- Move heavy computation to **Server Components** — server components don't ship JS to the client at all.
- Use dynamic imports for components only needed after interaction:

```jsx
const DatePicker = dynamic(() => import('./DatePicker'), { ssr: false });
```

- Check `@next/bundle-analyzer` output weekly; set a CI budget check with `next-bundle-analyzer` or Bundlewatch.

---

### Scenario 5: Stale Data After a Form Submission (Server Action)

**Situation:** A user submits a Server Action to update their profile. The page still shows the old data after the action completes.

**Question:** How do you ensure the UI reflects the updated state?

**Answer:**
- After a Server Action mutates data, call `revalidatePath()` or `revalidateTag()` to purge the cached page/data:

```typescript
'use server';
import { revalidatePath } from 'next/cache';

async function updateProfile(formData: FormData) {
  await db.user.update({ where: { id: session.userId }, data: { ... } });
  revalidatePath('/profile');   // clears the cached render of /profile
}
```

- `revalidateTag('user-data')` is more granular — tag all fetches that depend on user data and invalidate together.
- For immediate client-side optimistic updates combine with `useOptimistic()`.

---

### Scenario 6: Middleware Running on Every Request — Performance Impact

**Situation:** Your authentication middleware runs on every request including static assets, increasing Edge latency globally.

**Question:** How do you restrict middleware to specific paths?

**Answer:**
- Use the `matcher` config in `middleware.ts` to limit which paths the middleware runs on:

```typescript
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/:path*',
    // Exclude static assets and _next internals
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

- This ensures the middleware is bypassed for static files, dramatically reducing unnecessary Edge invocations.

---

### Scenario 7: ISR (Incremental Static Regeneration) Showing Stale Content

**Situation:** You use ISR with `revalidate: 60` for a product page. A price update is reflected in the DB but users still see the old price for up to an hour.

**Question:** How do you ensure near-instant propagation of critical updates?

**Answer:**
- Use **On-demand ISR**: call `res.revalidate('/product/123')` from a webhook handler that the CMS triggers on publish.
- Or use `revalidateTag('product-123')` in a Server Action or API route.

```typescript
// /api/revalidate route
import { revalidateTag } from 'next/cache';
export async function POST(req: Request) {
  const { secret, tag } = await req.json();
  if (secret !== process.env.REVALIDATE_SECRET) return new Response('Unauthorized', { status: 401 });
  revalidateTag(tag);
  return Response.json({ revalidated: true });
}
```

- The CMS webhook calls this endpoint on publish → the specific page is regenerated immediately.

---

### Scenario 8: Authentication — Protecting Routes in App Router

**Situation:** Some pages are protected (require login). Without protection, navigating directly to `/dashboard` returns the server-rendered HTML even for unauthenticated users.

**Question:** How do you protect routes in Next.js App Router?

**Answer:**
- Option 1 — **Middleware** (recommended for large-scale): check session/JWT in `middleware.ts`, redirect to `/login` early at the Edge before any rendering:

```typescript
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.redirect(new URL('/login', req.url));
}
export const config = { matcher: ['/dashboard/:path*'] };
```

- Option 2 — **Server Component check**: call `auth()` at the top of the layout/page server component and redirect:

```typescript
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }) {
  const session = await auth();
  if (!session) redirect('/login');
  return <>{children}</>;
}
```

---

### Scenario 9: Parallel Routes for a Complex Dashboard Layout

**Situation:** Your dashboard needs to show a main content area AND a side panel that loads independently, each with its own loading/error states.

**Question:** How do you implement this in App Router?

**Answer:**
- Use **Parallel Routes** with named slots (`@main`, `@panel`):

```
app/dashboard/
  layout.tsx          // receives @main and @panel props
  @main/
    page.tsx
    loading.tsx
  @panel/
    page.tsx
    loading.tsx
    error.tsx
```

```tsx
// layout.tsx
export default function DashboardLayout({ main, panel }) {
  return (
    <div className="dashboard">
      <main>{main}</main>
      <aside>{panel}</aside>
    </div>
  );
}
```

Each slot has its own streaming, loading UI, and error boundary — they render and update independently.
