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
