# Local Dev & UAT Credentials

Seeded staff accounts for the navigator dashboard. Provisioned by Supabase
migrations under `supabase/migrations/` — run `supabase db reset --local` (or
apply migrations to your local DB) and these accounts are immediately usable.

**Never used in real environments.** Seed only.

## Staff dashboard logins

| Email | Password | Role | Lands on | Source migration |
|-------|----------|------|----------|------------------|
| `navigator@civica.test` | `civica` | `navigator` | `/packets` (full operational access) | `20260562_seed_navigator_user.sql` |
| `county@civica.test` | `civica` | `county_director` | `/county` (audience-restricted) | provisioned out-of-band via `civica_set_role()` |
| `cdss@civica.test` | `civica` | `state_deputy` | `/cdss` (audience-restricted) | provisioned out-of-band via `civica_set_role()` |
| `cbo@civica.test` | `civica` | `cbo_preview` | `/cbo-preview` (audience-restricted) | provisioned out-of-band via `civica_set_role()` |

Role allowlist and home-route mapping live in
[`apps/dashboard/lib/roleRouting.ts`](../../apps/dashboard/lib/roleRouting.ts) —
`STAFF_ROLES` and `ROLE_HOMES`.

## How role assignment works

The dashboard middleware reads `app_metadata.role` from the Supabase JWT (set
on the `auth.users.raw_app_meta_data` row). Two ways to stamp it:

1. **Seeded in a migration** (preferred for shared dev accounts) — direct
   insert into `auth.users` with `raw_app_meta_data = '{"role":"<role>"}'`.
   See `supabase/migrations/20260562_seed_navigator_user.sql` for the template.

2. **Helper on an existing auth user** — `select civica_set_role('<email>',
   '<role>');` from `supabase/migrations/20260548_uat_roles.sql`. Service-role
   only. Useful when the user was created via the Supabase Auth dashboard or
   the Admin API.

Valid roles (per `civica_set_role`): `admin`, `navigator`, `county_director`,
`state_deputy`, `cbo_preview`, `applicant`.
