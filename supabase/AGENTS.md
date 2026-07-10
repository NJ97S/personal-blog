<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-10 | Updated: 2026-07-10 -->

# supabase

## Purpose
The database definition for the blog: sequential SQL migrations run in the Supabase SQL Editor (there is no Supabase CLI/local stack wired up). They define the schema, RLS policies, Storage bucket, and the SECURITY DEFINER RPCs that let anonymous visitors act on otherwise admin-locked tables.

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `migrations/` | Numbered `.sql` migrations, applied in order (see `migrations/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- Migrations are **append-only and ordered** — add a new higher-numbered file; never edit an already-applied one.
- Run them **in numeric order** in the Supabase SQL Editor; the app assumes the full stack is applied.
- The security model relies on RLS + SECURITY DEFINER RPCs — read `migrations/AGENTS.md` before changing any policy or function.

### Testing Requirements
- Apply against a scratch Supabase project and confirm the app's reads/writes and `/admin` gating still work.

## Dependencies
- Supabase (PostgreSQL, `auth.users`, `storage.objects`, `pgcrypto` in the `extensions` schema).

<!-- MANUAL: -->
