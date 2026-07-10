<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-10 | Updated: 2026-07-10 -->

# migrations

## Purpose
Ordered SQL migrations defining the entire database. Apply in numeric order in the Supabase SQL Editor. Later migrations progressively harden the model — notably replacing the `published` boolean with a `visibility` enum, and moving anonymous writes behind SECURITY DEFINER RPCs while locking base tables to admins.

## Migrations
| File | What it does |
|------|--------------|
| `001_initial.sql` | Creates `posts` (published bool + lowercase-slug CHECK, GIN index on `tags`, `updated_at` trigger), `comments`, `profiles` (FK `auth.users`, `is_admin`); enables RLS: public-read published posts, admin-full-access, public read/insert comments + admin delete |
| `002_categories.sql` | Hierarchical `categories` (self-FK `parent_id`, unique `(parent_id,slug)` via COALESCE sentinel), `posts.category_id` FK, `category_post_counts` view, RLS (public read / admin write), seeds Develop/Web/Algorithm/Tools tree |
| `002_profiles_and_comments_rls.sql` | `handle_new_user()` SECURITY DEFINER trigger on `auth.users` insert → auto-creates `profiles` row (`is_admin=false`); tightens comment INSERT to published posts. *(Shares the `002` prefix — separate concern)* |
| `003_posts_slug_allow_korean.sql` | Relaxes `posts_slug_check` to allow Korean (가–힣) + alphanumeric slugs |
| `004_post_covers_bucket.sql` | Public `post-covers` Storage bucket; RLS: public SELECT, admin-only write on `storage.objects` |
| `005_post_visibility.sql` | Replaces `posts.published` with a `visibility` text CHECK (`public`/`private`/`draft`), migrates data, reindexes, updates posts SELECT + comment INSERT policies + `category_post_counts` view, drops `published` |
| `006_post_views.sql` | `post_views` (id, `post_id` FK, `visitor_hash`, `viewed_at`) with dedup/time indexes; RLS: anyone INSERT, admin-only SELECT |
| `007_post_views_rpc.sql` | SECURITY DEFINER `track_post_view(post_id, visitor_hash, window_hours=4)` — checks post public, dedups in window, inserts; granted to anon/authenticated |
| `008_comment_auth.sql` | Tokenless comment auth: `password_hash` (pgcrypto bcrypt), `edit_token`, `deleted_at`; locks base-table RLS to admin; adds `public_comments` view + RPCs `insert/update/delete_comment` for anon/authenticated |
| `009_comment_auth_search_path.sql` | Fixes 008 RPCs — adds `extensions` to `search_path`, schema-qualifies `extensions.crypt()`/`gen_salt()` so pgcrypto resolves |
| `010_popular_posts_rpc.sql` | SECURITY DEFINER `popular_posts(window_days=30, limit=5)` — public posts ranked by PV count (tie-break `created_at`); granted to anon/authenticated |

## Schema Overview
- **`posts`** — title, unique Korean-allowing slug, content, excerpt, `tags[]`, `visibility` (public/private/draft), `cover_image`, `category_id` FK, timestamps (+ `updated_at` trigger)
- **`categories`** — self-referential tree (`parent_id`, `sort_order`)
- **`comments`** — post FK, `author_name`, content, + auth columns `password_hash`/`edit_token`/`deleted_at`
- **`profiles`** — 1:1 with `auth.users`, `is_admin`
- **`post_views`** — append-only PV log
- Views: `category_post_counts`, `public_comments`

## For AI Agents

### Working In This Directory
- **Append-only**: add a new `NNN_*.sql`; never edit an applied migration. Next number is `011_`.
- **RLS + SECURITY DEFINER RPC pattern**: where anon must act on an admin-locked table (view tracking, comment CRUD, popular posts), keep base tables admin-only and grant a narrow RPC to `anon`/`authenticated`. Public comment reads go through the `public_comments` view (safe columns, soft-delete filtered) — do not query the `comments` base table from public code.
- **Admin gate idiom**: `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)`. Reuse it verbatim.
- **Public reads are visibility-gated**: anon SELECT on `posts` only where `visibility='public'`.
- Comment ownership = localStorage `edit_token` **or** bcrypt password, verified **inside** the RPCs.
- For any pgcrypto use, set `search_path` to include `extensions` and schema-qualify functions (lesson of `009`).

### Testing Requirements
- Apply the full sequence to a scratch project; verify public reads, comment create/edit/delete, view tracking, popular posts, and admin gating.

## Dependencies
- `auth.users`, `storage.objects`, `pgcrypto` (in `extensions` schema).

<!-- MANUAL: -->
