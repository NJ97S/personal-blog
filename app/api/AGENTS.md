<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-10 | Updated: 2026-07-10 -->

# api

## Purpose
Route Handlers for non-page HTTP endpoints. Currently one: the daily digest cron that summarizes the last 24h of activity and pushes it to Telegram.

## Key Files
| File | Description |
|------|-------------|
| `cron/digest/route.ts` | `GET` daily digest. `dynamic='force-dynamic'`, `runtime='nodejs'`, `maxDuration=30`. Auth via `Authorization: Bearer ${CRON_SECRET}` compared with `timingSafeEqual` (constant-time). Uses service-role `createAdminClient()`; queries last-24h `comments` + `post_views` (capped 1k/10k), computes PV total, top-5 posts, comment previews, sends a KST-labeled Telegram digest |

## For AI Agents

### Working In This Directory
- The cron **schedule lives in `vercel.json`** (`0 23 * * *` → `/api/cron/digest`), not in this file.
- Cron auth must stay constant-time (`timingSafeEqual`) — never a plain `===` on the secret.
- This handler is one of the only places allowed to use `createAdminClient()` (service-role, RLS-bypassing); keep it server-only and gated by the bearer check.
- Cap query result sizes (as done) so a burst of traffic can't blow `maxDuration`/memory.

### Testing Requirements
- `npm run build`; locally invoke with `Authorization: Bearer <CRON_SECRET>` and confirm a Telegram message (or dry-run the query counts).

### Common Patterns
- Bearer-secret + `timingSafeEqual` gate, service-role client, capped queries, fire-and-forget Telegram.

## Dependencies
### Internal
- `@/lib/supabase/admin` (`createAdminClient`), `@/lib/telegram` (`sendTelegram`).

### External
- `node:crypto` (`timingSafeEqual`), Next Route Handler runtime.

<!-- MANUAL: -->
