# Self-hosting Logto + the data layer for Buddies Worldwide

This replaces hosted Supabase Auth (GoTrue) with a self-hosted **Logto**
instance as the identity provider, while keeping the same
Postgres+RLS+Storage *shape* of backend Buddies Worldwide already expects —
self-hosted instead of on supabase.com.

**None of this has been run for you.** This sandbox has no ability to stand
up persistent infrastructure — everything below is a set of files and
instructions for you to run wherever you host this. Two things in
particular could not be verified from this sandbox (network egress to
docs.logto.io / supabase.com / hub.docker.com was blocked) and are called
out explicitly further down: exact Storage-API JWT env var names, and
current image tags.

## 1. Bring up Logto

```sh
cd infra/logto
docker compose up -d
```

Open `http://localhost:3002` (or wherever you exposed the admin console) —
first run shows the out-of-box admin registration screen. Create your admin
account.

In the Logto Admin Console:

1. **Create an application** — type **Single Page App** — for the frontend.
   - Redirect URI: `https://<your-app-domain>/callback` (and
     `http://localhost:5173/callback` etc. for local dev).
   - Post sign-out redirect URI: your app's origin.
   - Note the **App ID** → `VITE_LOGTO_APP_ID`.
2. **Create an API Resource** — Console → API Resources → Create. This is
   what makes Logto issue an *access token* (not just an ID token) that
   PostgREST/Storage-API can verify, with the right `aud` claim.
   - Resource indicator, e.g. `https://api.buddies.local` → this exact
     string is `VITE_SUPABASE_RESOURCE` (frontend), `PGRST_JWT_AUD` and
     `SUPABASE_RESOURCE`/`LOGTO_ENDPOINT` (infra), and what api-server's
     `authMiddleware` checks as the token audience.
   - Grant the SPA application access to this resource.
3. **Email connector** (optional but recommended) — Console → Connectors →
   Email — configure SMTP or a provider so Logto can send its own
   verification/password-reset emails. This replaces the Cloudflare
   `send-email.ts` function that was wired to Supabase's GoTrue email
   hooks (removed — GoTrue-specific, doesn't apply to Logto).
4. **Branding** (optional) — Console → Sign-in Experience — to theme
   Logto's hosted sign-in page to match Buddies Worldwide.

You do **not** need to configure any custom JWT claims (e.g. a `role`
claim) — the RLS policies in `supabase_logto_migration.sql` were
deliberately written to not depend on PostgREST/Storage-API's Postgres
role mapping, only on the token's `sub` claim, so there's nothing Logto
needs to add beyond the standard OIDC claims it already issues.

## 2. Bring up the data layer (Postgres + PostgREST + Storage-API + Kong)

```sh
cd infra/supabase
cp .env.example .env   # fill in POSTGRES_PASSWORD, ANON_KEY, SERVICE_ROLE_KEY, LOGTO_ENDPOINT, SUPABASE_RESOURCE
# edit volumes/api/kong.yml: replace REPLACE_WITH_ANON_KEY / REPLACE_WITH_SERVICE_ROLE_KEY
# with the same ANON_KEY / SERVICE_ROLE_KEY values from .env
docker compose up -d
```

`ANON_KEY` / `SERVICE_ROLE_KEY` here are **not** JWTs the way Supabase's
hosted anon/service_role keys are — they're just the shared secret Kong's
`key-auth` plugin checks against the `apikey` header supabase-js always
sends. Any random 32+ byte string works for each. Real request
*authentication* (who the user is) comes entirely from the Logto access
token in the `Authorization` header, verified independently by
PostgREST/Storage-API via JWKS — the `apikey` header is just Kong's gate,
not an identity.

Then run the schema against `db`:

```sh
psql "postgres://postgres:$POSTGRES_PASSWORD@localhost:5432/postgres" \
  -f ../../artifacts/buddies-worldwide/supabase_complete_setup.sql \
  -f ../../artifacts/buddies-worldwide/supabase_logto_migration.sql
```

(If you're migrating an existing hosted-Supabase database instead of
starting fresh, only run `supabase_logto_migration.sql` — it's additive
on top of a database that already has `supabase_complete_setup.sql`
applied, and see step 4 below before doing this against real user data.)

## 3. Point the apps at it

`artifacts/buddies-worldwide/.env`:
```
VITE_SUPABASE_URL=http://localhost:8000          # Kong's address
VITE_SUPABASE_ANON_KEY=<the ANON_KEY from step 2>
VITE_LOGTO_ENDPOINT=http://localhost:3001         # Logto core, not :3002 (admin console)
VITE_LOGTO_APP_ID=<App ID from step 1>
VITE_SUPABASE_RESOURCE=https://api.buddies.local  # the API Resource indicator from step 1
```

`artifacts/api-server/.env`:
```
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=<the ANON_KEY from step 2>
SUPABASE_SERVICE_ROLE_KEY=<the SERVICE_ROLE_KEY from step 2>
LOGTO_ENDPOINT=http://localhost:3001
VITE_SUPABASE_RESOURCE=https://api.buddies.local
```

## 4. If you're migrating real users off hosted Supabase

`supabase_logto_migration.sql` does not migrate existing rows — it changes
column types and policies. Existing `profiles.user_id` values (currently
GoTrue UUIDs) will simply not match any Logto `sub` a real user signs in
with, since Logto mints its own ids. Existing users effectively become new
users on first Logto sign-in (`ensure_own_profile()` creates a fresh
profile). If you need old data attached to the *same* person, you'll need
a one-off mapping step (e.g. ask users to link accounts by email, or bulk
`UPDATE` rows once you've exported each user's Logto `sub` after they sign
up) — not something this migration can do generically since it doesn't
know the old-GoTrue-id → new-Logto-id mapping ahead of time.

## Things I could not verify from this sandbox

- **`storage-api`'s JWKS env var name.** `docker-compose.yml` sets
  `JWT_JWKS_URL` on the `storage` service as a best guess — check it
  against whatever version of `supabase/storage-api` you actually pull
  (its config lives in the `storage` repo under `supabase/storage`). If it
  only supports a shared `JWT_SECRET` (not JWKS) in the version you use,
  you have two options: front it with a small verifying proxy (reuse
  api-server's `authMiddleware` as a template), or check whether a newer
  storage-api release added JWKS support and upgrade to it.
- **Image tags.** `postgrest/postgrest:v12.2.3`, `supabase/storage-api:v1.11.13`,
  `supabase/postgres:15.1.1.61`, `kong:3.6` were current knowledge at the
  time this was written, not confirmed against the registries live. Check
  for newer releases before deploying.
- **Kong declarative-config env-var interpolation.** `kong.yml` requires
  the two keys pasted in directly (not sourced from `docker-compose.yml`'s
  env) — Kong's DB-less mode env-var templating support varies by version,
  so this avoids depending on it.
