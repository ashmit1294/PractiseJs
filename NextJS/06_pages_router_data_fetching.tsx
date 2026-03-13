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
