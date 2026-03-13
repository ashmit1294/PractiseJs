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
