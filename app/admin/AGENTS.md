<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-10 | Updated: 2026-07-10 -->

# admin

## Purpose
The single-admin authoring area (`/admin/*`): login, post management (list/create/edit/delete/publish), and hierarchical category management. A velog-style editor drives post writing. Access is protected in two layers — middleware session gating on the way in, and `requireAdmin()` re-checks inside every Server Action.

## Auth Model
- **Layer 1 (middleware)**: `middleware.ts` matches `/admin/:path*` → `lib/supabase/middleware.ts:updateSession` redirects unauthenticated users to `/admin/login`, non-admins to `/`, and bounces logged-in admins away from `/admin/login`.
- **Layer 2 (actions)**: every mutation calls `requireAdmin()` (in `app/actions/posts.ts`).
- `layout.tsx` itself does **no** auth — it is a pass-through and relies on Layer 1.

## Key Files
| File | Description |
|------|-------------|
| `layout.tsx` | Pass-through Server layout (`<>{children}</>`); protection comes from middleware |
| `loading.tsx` | Suspense fallback → `LoadingSpinner` |
| `login/page.tsx` | Client login form; browser `supabase.auth.signInWithPassword`, then `router.replace('/admin/posts')` |
| `posts/page.tsx` | Server; `force-dynamic`; post list with `?status=` filter (all/public/private/draft), logout form |
| `posts/new/page.tsx` | Server; fetches category tree, renders `NewPostForm` with a server-rendered `CategoryPicker` prop |
| `posts/new/NewPostForm.tsx` | Client; `action={createPost}`; slugify-on-blur, Cmd/Ctrl+S draft save, dirty-exit guard, `PublishModal`, sessionStorage toast |
| `posts/[id]/edit/page.tsx` | Server; loads post by id + tree, `notFound()` if missing, renders `EditPostForm` |
| `posts/[id]/edit/EditPostForm.tsx` | Client; `action={updatePost}`, `deletePost` danger zone, prefilled `PublishModal`, dirty guard |
| `categories/page.tsx` | Server; renders `CategoryAdmin` inside `Layout` |
| `categories/CategoryAdmin.tsx` | Client; recursive tree editor (≤3 levels) calling category actions in `useTransition`; parent-select excludes descendants (cycle guard); delete confirms cascade impact |

## For AI Agents

### Working In This Directory
- Do not rely on `layout.tsx` for auth — it intentionally does nothing. New protected server logic must still gate via actions/`requireAdmin()`.
- Editor forms are Client Components that call Server Actions through the `action` prop; keep server-rendered pickers (`CategoryPicker`) passed **as props** into client forms rather than importing server code client-side.
- All admin pages are `force-dynamic` (never cache authenticated views).
- Preserve UX guards: dirty-exit confirmation, Cmd/Ctrl+S save, cross-navigation toast via `sessionStorage`.

### Testing Requirements
- `npm run build`; log in and exercise create/edit/publish/unpublish/delete and category CRUD/reorder in a browser.

### Common Patterns
- Server page fetches data → passes to a Client form → form calls a Server Action → `router.replace`/`router.refresh`.
- Category cycle prevention lives both in the UI (option filtering) and the action (server check).

## Dependencies
### Internal
- `@/app/actions/*` (posts, categories), `@/lib/supabase/*`, `@/lib/categories`, editor components (`MarkdownEditor`, `TitleInput`, `TagInput`, `PostEditorShell`, `PublishModal`, `CategoryPicker` — see `components/AGENTS.md`).

### External
- `@supabase/ssr`, `next/navigation`.

<!-- MANUAL: -->
