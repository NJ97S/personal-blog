<!-- Generated: 2026-07-10 | Updated: 2026-07-10 -->

# ShyLog (personal-blog)

## Purpose
A personal tech blog with a craft-paper notebook aesthetic, hosted at https://www.shylog.com. Built on **Next.js 14 App Router (RSC)** + **Supabase (PostgreSQL + Auth + RLS)**. Public readers browse posts by hierarchical category, tag, and full-text search, and leave login-free comments; a single admin authors posts through a velog-style Markdown editor at `/admin`. Deployed on Vercel in the Seoul region (`icn1`) co-located with Supabase for sub-10ms DB round-trips.

## Key Files
| File | Description |
|------|-------------|
| `package.json` | Deps & scripts (`dev`, `build`, `start`, `lint`). Next 14.2, React 18, Supabase, Upstash ratelimit, uiw md-editor |
| `middleware.ts` | Runs `updateSession` on `/admin/:path*` to refresh the Supabase auth cookie |
| `next.config.mjs` | Security headers (CSP, HSTS, nosniff), `images.remotePatterns` locked to `*.supabase.co` (SSRF guard) |
| `tailwind.config.ts` | `darkMode: 'class'`, craft/ink color palette, `serif`=Kkukkukk / `mono`=JetBrains Mono, typography plugin |
| `vercel.json` | Pins Seoul region `icn1`; cron `0 23 * * *` → `/api/cron/digest` |
| `tsconfig.json` | Path alias `@/*` → repo root; strict TS |
| `.eslintrc.json` | `next/core-web-vitals` |
| `postcss.config.mjs` | Tailwind + autoprefixer |
| `README.md` | Full feature/setup/schema reference (Korean) — richer than this file for onboarding |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js App Router — routes, layouts, Server Actions, API/cron, SEO endpoints (see `app/AGENTS.md`) |
| `components/` | React components: layout, category nav, comments, admin editor stack (see `components/AGENTS.md`) |
| `lib/` | Shared utilities and Supabase client factories (see `lib/AGENTS.md`) |
| `supabase/` | Sequential SQL migrations defining schema + RLS (see `supabase/AGENTS.md`) |
| `public/` | Static assets served at site root |
| `docs/` | Project docs — code reviews, security notes, dev-journey series (not application code) |
| `.claude/` | `lead-issue` workflow skills (PM/Developer/reviewer agents) |
| `.workflow/` | Agent-spawning scripts for the lead-issue workflow |

## For AI Agents

### Working In This Directory
- **Server-first**: default to React Server Components. Add `'use client'` only for interactivity (state, effects, event handlers, browser APIs).
- **Path alias**: import with `@/…` (e.g. `@/lib/site`), never long relative chains.
- **Mutations** go through Server Actions in `app/actions/`, never client-side Supabase writes. Actions call `revalidatePath` on the narrowest affected route.
- **Two Supabase surfaces**: cookie-bound server client for RSC/actions, anon browser client for reads, service-role admin client only in trusted server code and cron. See `lib/AGENTS.md`.
- **Design tokens**: use `craft-*` / `ink-*` colors and `font-serif` / `font-mono`; reuse `.craft-card` / `.craft-prose` utilities from `app/globals.css`.
- Dark mode is class-based (`.dark` on `<html>`), initialized by an inline script in `app/layout.tsx` to avoid FOUC.

### Testing Requirements
- No automated test suite exists. Verify with `npm run build` and `npm run lint`.
- Dynamic UI (scroll spy, drawers, infinite scroll, theme toggle) must be verified in a real browser with reflow, not just by reading code.

### Common Patterns
- ISR: `revalidate = 60` on public content routes.
- SEO endpoints are code-generated (`sitemap.ts`, `robots.ts`, `manifest.ts`, `opengraph-image.tsx`, `rss.xml/route.ts`).
- Korean slugs are permitted (relaxed DB CHECK) — handle URL encoding carefully in routing.

## Dependencies

### External
- **Next.js 14.2** (App Router, RSC) — framework
- **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`) — DB, Auth, RLS, Storage
- **Tailwind CSS 3** + `@tailwindcss/typography` — styling
- **react-markdown** stack (`remark-gfm`, `remark-breaks`, `rehype-highlight`, `rehype-slug`, `rehype-sanitize`, `rehype-raw`) — rendering
- **@uiw/react-md-editor** — admin editor
- **@upstash/ratelimit** + `@upstash/redis` — rate limiting
- **lucide-react** — icons; **sonner** — toasts

### Environment
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (required)
- `SUPABASE_SERVICE_ROLE_KEY` (admin/cron writes)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (rate limit)
- `NEXT_PUBLIC_NAVER_VERIFICATION` (optional SEO), cron auth secret, Telegram digest token

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
