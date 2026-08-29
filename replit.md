# Buddies Worldwide

A safe local marketplace app for South African community trading, with escrow payments, ID verification, and moderated dispute resolution.

## Run & Operate

- `pnpm --filter @workspace/buddies-worldwide run dev` — run the frontend (port assigned by Replit)
- `pnpm run typecheck` — full typecheck across all packages
- Required env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + React Router v7
- Backend: Supabase (Postgres + Auth + Storage + RLS)
- UI: Tailwind CSS v4, shadcn/ui, Lucide icons
- State: TanStack Query (React Query)

## Where things live

- `artifacts/buddies-worldwide/src/` — main React app
- `artifacts/buddies-worldwide/src/integrations/supabase/` — Supabase client + TypeScript types
- `artifacts/buddies-worldwide/src/pages/` — all page components
- `artifacts/buddies-worldwide/src/hooks/` — useListings, useConversations, useOrders
- `artifacts/buddies-worldwide/src/contexts/AuthContext.tsx` — auth state
- `artifacts/buddies-worldwide/supabase_migration.sql` — **run this in Supabase SQL Editor** to apply new schema
- `artifacts/buddies-worldwide/supabase/email-templates/` — Supabase Auth email templates to paste into the dashboard

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
