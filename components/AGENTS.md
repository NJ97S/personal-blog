<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-10 | Updated: 2026-07-10 -->

# components

## Purpose
All React components: the page shell, category navigation, comment system, the reader-facing content pieces, and the admin Markdown-editor stack. Server Components fetch from Supabase directly and render statically; Client Components (`'use client'`) own interactivity (scroll spy, drawers, infinite scroll, editor). UI copy and comments are in Korean; styling uses the `craft-*` / `ink-*` tokens with dark-mode variants.

## Layout Composition
`Layout.tsx` is the page shell — a responsive grid of: sticky `Header` (holds `Logo`, `ThemeToggle`, mobile `CategoryDrawer`), desktop-only left `CategorySidebar` (`lg:`), the `main` children, an xl-only right aside defaulting to `SideWidgets` (overridable via the `rightAside` prop), and `Footer`. `Header` and `CategorySidebar` each independently call `fetchCategoryTree`.

## Admin Editor Stack
`PostEditorShell` (frame + fixed bottom action bar) wraps `TitleInput` + `TagInput` + `MarkdownEditor` (paired with `MarkdownView` + `useMarkdownScrollSync`), with `PublishModal` (embedding `CategoryPicker`) as the publish step. The editor **page** in `app/admin/posts/*` owns form state and wires these together.

## Key Files
| File | Kind | Description |
|------|------|-------------|
| `Layout.tsx` | Server | Responsive grid shell (header/sidebar/main/aside/footer) |
| `Header.tsx` | Server (async) | Sticky header; fetches tree for mobile drawer |
| `Footer.tsx` | Server | Static footer, dynamic year |
| `Logo.tsx` | Client | Home link; 5-rapid-click easter egg → `/admin/login` |
| `ThemeToggle.tsx` | Client | Toggles `<html>.dark`, persists `theme` to localStorage |
| `CategorySidebar.tsx` | Server (async) | Sticky desktop sidebar (profile + `CategoryTree`) |
| `CategoryTree.tsx` | Client | Recursive tree, active-path highlight from `usePathname`, auto-expand |
| `CategoryDrawer.tsx` | Client | Mobile portal drawer; focus trap, Esc, scroll lock |
| `CategoryPicker.tsx` | Server | Native `<select name="categoryId">` flattened via `walkTree` |
| `InfinitePostList.tsx` | Client | IntersectionObserver infinite scroll via `loadMorePosts`, cursor + dedup Set |
| `PostCard.tsx` | Server | Post list card (cover, category, title/excerpt, date, tags) |
| `PostToc.tsx` | Client | Scroll-spy TOC (IntersectionObserver over h1–h3) |
| `SeriesBox.tsx` | Client | Collapsible sibling-post series box |
| `ShareButton.tsx` | Client | Copies `location.href`, transient "복사됨" state |
| `MarkdownView.tsx` | Server | `react-markdown` (GFM/breaks, curated hljs, `rehypeSanitize` allowlist, optional `data-line` stamping) |
| `MarkdownEditor.tsx` | Client | `@uiw/react-md-editor` via `dynamic(ssr:false)`; hidden-input mirror, MutationObserver dark sync, scroll sync |
| `useMarkdownScrollSync.ts` | Client hook | Wrap-aware source-line scroll sync (off-screen mirror + ResizeObserver) |
| `TitleInput.tsx` | Client | Controlled large-title input |
| `TagInput.tsx` | Client | Chip input → hidden comma field; Enter/comma add, IME-guarded, max 10, dedup |
| `PostEditorShell.tsx` | Server | Editor frame with fixed bottom action bar (`actions` slot) |
| `PublishModal.tsx` | Client | Publish dialog; focus trap, cover upload to Supabase Storage w/ validation, slug/visibility/excerpt |
| `PasswordInput.tsx` | Client | Password field with show/hide toggle |
| `Comments.tsx` | Server (async) | Fetches initial `public_comments`, hands to `CommentList` |
| `CommentList.tsx` | Client | Local-state comment list, optimistic create/update/delete |
| `CommentForm.tsx` | Client | `useFormState` create form; saves edit token, `useHydrated` submit guard |
| `CommentItem.tsx` | Client | View/edit/delete modes; edit-token or password auth |
| `JsonLd.tsx` | Server | JSON-LD injection with `<`→`<` escaping |
| `LoadingSpinner.tsx` | Server | Accessible spinner (`role="status"`) |
| `SideWidgets.tsx` | Server | Sticky right rail composing the four widgets |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `widgets/` | Sidebar widgets (popular/recent posts, recent comments, search) (see `widgets/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- Decide Server vs Client deliberately: fetch in Server Components (`@/lib/supabase/server`); add `'use client'` only for state/effects/browser APIs. `PublishModal` uses the browser client (`@/lib/supabase/client`) for uploads.
- Reuse `useFocusTrap` (`@/lib/use-focus-trap`) for any modal/drawer; Escape-to-close is hand-rolled per surface — follow the existing pattern.
- Comments use Server Actions + `useFormState`/`useFormStatus` and update local state optimistically (no refetch) — preserve this when editing the comment stack.
- Category types (`CategoryNode`/`CategoryRow`) are a single shape: `lib/categories.ts` re-exports them from `lib/category-tree.ts`. Import from either safely.
- Keep IME/composition guarding in `TagInput` (and any Korean text input) and `data-line` anchoring intact for editor scroll sync.

### Testing Requirements
- `npm run build` + `npm run lint`. Verify scroll spy, drawer, infinite scroll, theme toggle, and editor scroll-sync in a real browser (reflow matters).

### Common Patterns
- IntersectionObserver for both infinite scroll and scroll-spy; localStorage for theme and comment edit tokens (`@/lib/comment-tokens`).

## Dependencies
### Internal
- `@/lib/supabase/*`, `@/lib/categories` + `@/lib/category-tree`, `@/lib/comment-tokens`, `@/lib/use-focus-trap`, `@/lib/use-hydrated`, `@/app/actions/*` (comments, feed).

### External
- `@uiw/react-md-editor`, `react-markdown` + rehype/remark plugins, `lucide-react`, `sonner`, `next/navigation`, `react-dom` (`createPortal`).

<!-- MANUAL: -->
