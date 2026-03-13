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
