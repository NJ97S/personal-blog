<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-10 | Updated: 2026-07-10 -->

# widgets

## Purpose
The four sidebar widgets composed by `SideWidgets.tsx` into the sticky right rail. All are async Server Components that read directly from Supabase (except `SearchBox`, a JS-free GET form).

## Key Files
| File | Description |
|------|-------------|
| `PopularPosts.tsx` | Top-5 popular posts via Supabase RPC `popular_posts` (30-day window) |
| `RecentPosts.tsx` | 5 most recent public posts, short date formatting |
| `RecentComments.tsx` | 5 latest comments joined to public posts (`visibility='public'`, non-deleted) |
| `SearchBox.tsx` | Native `<form action="/search">` GET input; supports `#tag` syntax; no client JS |

## For AI Agents

### Working In This Directory
- Keep these as Server Components — they render once and rely on their parent route's caching. No `'use client'`.
- Scope every query to public/non-deleted content (these widgets are public-facing).
- `PopularPosts` depends on the `popular_posts` RPC and `RecentComments` on the `public_comments` view — see `supabase/migrations/AGENTS.md` before changing their queries.

### Testing Requirements
- `npm run build`; confirm widgets render with real data in a browser.

## Dependencies
### Internal
- `@/lib/supabase/server`.

### External
- `next/link`, `lucide-react`.

<!-- MANUAL: -->
