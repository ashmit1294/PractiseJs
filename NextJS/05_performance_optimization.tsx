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
