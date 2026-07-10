<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-10 | Updated: 2026-07-10 -->

# actions

## Purpose
All server-side mutations for the blog, as Next.js **Server Actions** (`'use server'`). This is the only write path — Client Components submit forms/calls here rather than touching Supabase directly. Admin actions gate on `requireAdmin()`; public actions (comments, views, feed) run unauthenticated but defend with rate limiting, RPCs, and validation.

## Key Files
| File | Description |
|------|-------------|
| `posts.ts` | Post lifecycle + the shared `requireAdmin()` gate. Exports `createPost`, `updatePost`, `deletePost`, `publishPost`→`public`, `unpublishPost`→`draft`, `logoutAction`. Validates slug/visibility/https-cover/UUID; `revalidateAll()` hits `/`, `/posts/[slug]`, per-slug, `/admin/posts` |
| `categories.ts` | Admin category CRUD: `createCategory`, `updateCategory`, `deleteCategory`, `reorderCategory('up'\|'down')`. Prevents cyclic parent moves, computes `sort_order`, maps unique-violation `23505`; revalidates `/`, categories, posts, `/sitemap.xml` |
| `comments.ts` | Public comment actions: `createComment`, `updateComment`, `deleteComment`. Upstash sliding-window rate limit (5/10m by IP), control-char stripping, public-post check, Supabase RPCs (`insert/update/delete_comment`) with edit-token or password, fire-and-forget Telegram notify |
| `feed.ts` | `loadMorePosts({ cursor, categoryIds? })` — infinite-scroll pagination; validates ISO cursor + UUIDs, returns `{ items, nextCursor }`; no auth, no mutation |
| `views.ts` | `trackView(postId)` — hashes IP+UA+daily-salt (sha256/16ch), calls RPC `track_post_view` (4h dedup); swallows all errors |

## For AI Agents

### Working In This Directory
- **`requireAdmin()` lives in `posts.ts`** and is imported by the other admin action files — reuse it, don't re-implement the auth check. It returns `{ supabase, error }`; bail on `error`.
- Every admin mutation must call `requireAdmin()` first, then `revalidateAll()` (or a scoped `revalidatePath`) for the routes it affects. Middleware gating is not sufficient on its own.
- Public actions (`comments`, `views`, `feed`) must never trust input: keep the UUID/ISO/slug regex validation and rate limiting.
- Comment ownership uses `edit_token` (localStorage) or bcrypt password verified **inside the Postgres RPCs** — do not move that check into JS.
- Return serializable results; forms consume `{ error }` / `{ redirectTo }` / optimistic `comment` objects.

### Testing Requirements
- `npm run build`; exercise create/edit/publish/delete and comment flows in a browser against a real Supabase instance.

### Common Patterns
- `revalidateAll()` fan-out per action file; `redirect()` after create/delete.
- RPC-over-table for anon writes (see `supabase/migrations/AGENTS.md` — base tables are admin-locked).

## Dependencies
### Internal
- `@/lib/supabase/server` (cookie client), `@/lib/telegram` (notify), `@/lib/feed` (page size/types).

### External
- `next/cache` (`revalidatePath`), `next/navigation` (`redirect`), `@upstash/ratelimit` + `@upstash/redis`.

<!-- MANUAL: -->
