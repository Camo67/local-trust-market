# Buddies Worldwide

A safe local marketplace app for South African community trading, with escrow payments, ID verification, and moderated dispute resolution.

## Run & Operate

- `pnpm --filter @workspace/buddies-worldwide run dev` — run the frontend (port assigned by Replit)
- `pnpm run typecheck` — full typecheck across all packages
- Required env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_LOGTO_ENDPOINT`, `VITE_LOGTO_APP_ID`, `VITE_SUPABASE_RESOURCE` — see `infra/README.md`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + React Router v7
- Backend: self-hosted Postgres + PostgREST + Storage-API (the open-source
  components hosted Supabase runs), RLS enforced at the DB — see `infra/`
- Identity: self-hosted Logto (OIDC), not Supabase Auth/GoTrue — see `infra/README.md`
- UI: Tailwind CSS v4, shadcn/ui, Lucide icons
- State: TanStack Query (React Query)

## Where things live

- `artifacts/buddies-worldwide/src/` — main React app
- `artifacts/buddies-worldwide/src/integrations/supabase/` — PostgREST client + TypeScript types (still named "supabase" — same open-source component, just self-hosted)
- `artifacts/buddies-worldwide/src/pages/` — all page components
- `artifacts/buddies-worldwide/src/hooks/` — useListings, useConversations, useOrders
- `artifacts/buddies-worldwide/src/contexts/AuthContext.tsx` — auth state (Logto-backed)
- `artifacts/buddies-worldwide/supabase_complete_setup.sql` then `supabase_logto_migration.sql` — **run both, in order,** against the self-hosted Postgres to set up the schema (see `infra/README.md`)
- `infra/` — docker-compose for self-hosted Logto + the Postgres/PostgREST/Storage-API/Kong data layer, and setup instructions

## Architecture decisions

- All DB access via Supabase client (RLS enforced at DB level)
- Three-way chat: `conversations.moderator_id` joins a moderator into a buyer-seller chat
- Multi-image: `listing_images` table stores additional images; `listings.image_url` stays as cover/fallback
- Verification: `verification_requests` table + `profiles.verification_status` column, synced via DB trigger
- Verification docs stored in private `verification-docs` Supabase Storage bucket (not public)

## Product

- Browse and search local listings with multi-image carousel
- Sell items with up to 5 photos uploaded to Supabase Storage
- Escrow-secured orders with status timeline
- In-app messaging with fraud pattern detection (blocks phone numbers, bank names, off-platform payment prompts)
- Three-way moderated chat for dispute resolution (moderator joins via `moderator_id` on conversation)
- ID verification flow: upload SA ID/passport/driver's licence + selfie → admin reviews → profile upgraded to Verified

## Gotchas

- **Run `supabase_migration.sql` in Supabase SQL Editor before using new features** (verification, multi-image, three-way chat)
- The `listing_images` table must exist before SellPage can insert multi-image rows
- The `verification-docs` storage bucket must exist (created by migration) before VerifyPage uploads work
- `conversations_moderator_id_fkey` FK join only works once `moderator_id` column is added by migration
