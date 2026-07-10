<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-10 | Updated: 2026-07-10 -->

# lib

## Purpose
Shared utilities and infrastructure: Supabase client factories, category-tree logic, site config, and small React hooks. A key discipline here is the **server-only vs client-safe split** — some modules read secrets or `next/headers` (server-only), others are pure or browser-only. Importing a server-only module into a Client Component will break the build.

## Key Files
| File | Surface | Description |
|------|---------|-------------|
| `categories.ts` | **Server-only** | Fetches `categories` + `category_post_counts` view and builds the tree. Exports React-cached `fetchCategoryTree()`, `findCategoryByPath(slugs)`; re-exports `CategoryRow`/`CategoryNode` + `collectDescendantIds`/`walkTree` |
| `category-tree.ts` | Isomorphic (client-safe) | Pure tree logic, no I/O. Exports `buildTree(rows,counts)`, `collectDescendantIds(node)`, `walkTree(nodes)`, and the `CategoryRow`/`CategoryNode` types |
| `comment-tokens.ts` | Client-only | Per-comment edit tokens in `localStorage` (`comment-tokens` key). Exports `saveToken`/`getToken`/`removeToken` |
| `feed.ts` | Isomorphic | Feed contract only. Exports `FEED_PAGE_SIZE = 10` and types `FeedItem`, `FeedResult` |
| `site.ts` | Isomorphic | Site metadata `site` (name/title/description/`url` from `NEXT_PUBLIC_SITE_URL`/locale/author). Client-safe (public env only) |
| `telegram.ts` | **Server-only** | `sendTelegram(text)` (HTML mode, 5s timeout) + `escapeHtml(s)`; reads `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` |
| `use-focus-trap.ts` | Client hook | `useFocusTrap<T>(active)` → `containerRef`; traps + restores focus for modals/drawers |
| `use-hydrated.ts` | Client hook | `useHydrated()` → boolean; disables Server-Action submit buttons pre-hydration |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `supabase/` | Supabase client factories — browser, server(cookie), middleware(session), admin(service-role) (see `supabase/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- **Do not import `categories.ts` or `telegram.ts` (or anything under `supabase/server.ts`/`admin.ts`/`middleware.ts`) into a Client Component.** For client-safe tree logic use `category-tree.ts`; `categories.ts` re-exports the same types so shared shapes stay consistent.
- `fetchCategoryTree()` is `React.cache`d — call it freely within a request; it dedups.
- Keep browser-only guards (`typeof window`) in `comment-tokens.ts`.
- Pure logic belongs in `category-tree.ts` (testable, isomorphic); anything touching Supabase or `next/headers` stays in `categories.ts`.

### Testing Requirements
- `npm run build` catches accidental server-only imports crossing into client bundles.

### Common Patterns
- Server-only modules read secrets / `next/headers`; isomorphic modules export only constants, types, and pure functions.

## Dependencies
### Internal
- `categories.ts` → `supabase/server.ts` + `category-tree.ts`.

### External
- `@supabase/ssr`, `@supabase/supabase-js`, `react` (`cache`), Next `next/headers`.

<!-- MANUAL: -->
