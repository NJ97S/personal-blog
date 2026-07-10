<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-10 | Updated: 2026-07-10 -->

# supabase (clients)

## Purpose
Four Supabase client factories, one per execution context. Choosing the right one is a security decision: three use the public **anon key** and respect RLS; one uses the **service-role key** and bypasses RLS entirely.

## Key Files
| File | Key | Context | Export |
|------|-----|---------|--------|
| `client.ts` | anon | Browser | `createClient()` — `createBrowserClient`; use in Client Components (login, uploads) |
| `server.ts` | anon | RSC / Server Actions | `createClient()` — `createServerClient` bound to `next/headers` cookies (`setAll` try/catch no-ops inside RSC). This is what `lib/categories.ts` uses |
| `middleware.ts` | anon | Edge middleware | `updateSession(request)` — **the only place the session is refreshed**; calls `auth.getUser()` (never `getSession()`), then gates `/admin/*` (unauth → `/admin/login`, non-admin → `/`, logged-in admin off `/admin/login` → `/admin/posts`) via `profiles.is_admin` |
| `admin.ts` | **service-role** | Trusted server only | `createAdminClient()` — plain `supabase-js` with `SUPABASE_SERVICE_ROLE_KEY`, `persistSession:false`, `autoRefreshToken:false`; **bypasses RLS**; throws if key missing |

## For AI Agents

### Working In This Directory
- **`admin.ts` bypasses RLS** — only call `createAdminClient()` from trusted, authenticated server paths (currently just the cron digest). Never expose it to user-controlled requests without an auth gate, and never import it into client code.
- Auth session refresh belongs in `middleware.ts` (`getUser()`), reached via the root `middleware.ts` matcher `/admin/:path*`. Do not add ad-hoc session logic elsewhere.
- Use `server.ts` in RSC/actions, `client.ts` in the browser. Don't mix.
- `getUser()` (validates against Supabase) is used deliberately instead of `getSession()` — keep it.

### Testing Requirements
- `npm run build`; verify `/admin` redirects (logged out, non-admin, admin) in a browser.

### Common Patterns
- One factory per context; anon everywhere except the RLS-bypassing service-role admin client.

## Dependencies
### External
- `@supabase/ssr` (`createBrowserClient`, `createServerClient`), `@supabase/supabase-js` (`createClient`), `next/headers`, `next/server`.

<!-- MANUAL: -->
