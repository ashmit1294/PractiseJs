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
