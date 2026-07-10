<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-10 | Updated: 2026-07-10 -->

# app

## Purpose
The Next.js 14 **App Router** tree: public reader routes, the auth-gated `/admin` area, Server Actions for all mutations, the digest cron handler, and code-generated SEO endpoints. Server Components are the default; `'use client'` is used only where interactivity requires it.

## Key Files (app root)
| File | Description |
|------|-------------|
| `layout.tsx` | Root layout (`lang="ko"`); loads Kkukkukk + JetBrains Mono fonts, full `metadata` object, no-flash dark-theme inline script, sonner `Toaster` |
| `page.tsx` | Home `/` — ISR `revalidate=60`; newest public posts (cursor-paginated) + category tree, WebSite JSON-LD, `InfinitePostList` |
| `error.tsx` | Client segment error boundary; dependency-free markup, logs error, `reset()` + home link |
| `loading.tsx` | Root Suspense fallback → `LoadingSpinner` |
| `not-found.tsx` | 404 page; `robots: noindex,nofollow`; rendered inside `Layout` |
| `globals.css` | Tailwind entry + hljs github-dark; defines `.craft-card`, `.craft-prose`, callout/code-block styling |
| `manifest.ts` | PWA manifest generator |
| `robots.ts` | Allows `/`, disallows `/admin`, links sitemap |
| `sitemap.ts` | Async sitemap — home + per-post + per-category URLs from Supabase |
| `opengraph-image.tsx` | Static brand OG image, `runtime='edge'`, 1200×630 |

## Dynamic Routes
| Route | File | Notes |
|-------|------|-------|
| `/posts/:slug` | `posts/[slug]/page.tsx` | `force-dynamic`; `React.cache` dedups auth+post fetch across `generateMetadata`; admins see non-public; fire-and-forget `trackView`; series prev/next, breadcrumbs, Article JSON-LD |
| `/posts/:slug` OG | `posts/[slug]/opengraph-image.tsx` | Per-post edge OG image from title+date |
| `/categories/*` | `categories/[...slug]/page.tsx` | Catch-all, `revalidate=60`; resolves path via `findCategoryByPath`, collects descendant IDs, scoped `InfinitePostList` |
| `/tags/:tag` | `tags/[tag]/page.tsx` | `revalidate=60`; posts `contains('tags',[tag])` |
| `/search` | `search/page.tsx` | `force-dynamic`, `noindex`; multi-token AND `ilike` search with metachar escaping; `#tag` → redirect to `/tags` |
| `/rss.xml` | `rss.xml/route.ts` | Route Handler, `revalidate=600`; RSS 2.0 for 20 newest posts |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `actions/` | Server Actions — all writes (posts, categories, comments, views, feed) (see `actions/AGENTS.md`) |
| `admin/` | Auth-gated authoring UI (posts, categories, login) (see `admin/AGENTS.md`) |
| `api/` | Route handlers — the daily digest cron (see `api/AGENTS.md`) |
| `fonts/` | Memoment Kkukkukk font files (local font, loaded in `layout.tsx`) |
| `posts/`, `categories/`, `tags/`, `search/`, `rss.xml/` | Route segments described above |

## For AI Agents

### Working In This Directory
- Never fetch Supabase or mutate from a Client Component — read in Server Components, write via `actions/`.
- Match each route's rendering strategy: public feed/category/tag → ISR `revalidate=60`; RSS → `revalidate=600`; post detail, search, admin → `force-dynamic`.
- Use `@/lib/supabase/server` `createClient()` in RSC; `@/lib/supabase/admin` service-role only in cron.
- When adding a route that changes public content, wire matching `revalidatePath` calls in the relevant action's `revalidateAll()`.
- Korean/encoded slugs: decode before querying (`posts/[slug]` and its OG route decode the param).

### Testing Requirements
- `npm run build` (catches RSC/`use client` boundary and metadata errors) and `npm run lint`. Verify dynamic routes in a real browser.

### Common Patterns
- `generateMetadata` per dynamic route; JSON-LD via `@/components/JsonLd`.
- Feed pagination is cursor-based (`created_at` descending, `FEED_PAGE_SIZE+1` fetch to detect next page).

## Dependencies
### Internal
- `@/lib/supabase/*` (clients), `@/lib/categories` + `@/lib/category-tree` (nav), `@/lib/feed` (pagination contract), `@/lib/site` (metadata), `@/components/*` (rendering).

### External
- `next` (App Router APIs: `MetadataRoute`, `ImageResponse`, route handlers), `@supabase/ssr`.

<!-- MANUAL: -->
