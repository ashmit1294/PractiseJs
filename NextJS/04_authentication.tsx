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
