-- Buddies Worldwide: migrate identity from Supabase Auth (GoTrue) to a
-- self-hosted Logto instance.
--
-- Run this ONCE, after supabase_complete_setup.sql, against the self-hosted
-- Postgres instance (the same "supabase" Postgres the app's RLS policies
-- already live in — this migration does not touch Logto's own database).
--
-- Why this is more than "swap the JWT issuer":
--
-- 1. auth.uid()/auth.jwt() are plain SQL functions shipped by the
--    supabase/postgres image that read `request.jwt.claims` — they are NOT
--    GoTrue-specific, so RLS as a *mechanism* keeps working once PostgREST
--    and Storage-API are configured to verify Logto-issued JWTs via JWKS
--    (see infra/README.md). But two GoTrue-specific assumptions baked into
--    the original schema do NOT survive the swap, and this migration fixes
--    both:
--
--      a) Every user-id column in this schema is `UUID`, because GoTrue
--         always issues UUID subject ids. Logto's `sub` claim is its own
--         id format (NOT a UUID) — every one of those columns must become
--         `TEXT`, and every RLS policy that implicitly relied on the
--         `uuid = uuid` comparison must be rebuilt around a text compare.
--
--      b) `auth.role() = 'authenticated'` (used in the storage policies)
--         reads GoTrue's `role` claim, which GoTrue always sets. Logto
--         tokens don't carry that claim, so those checks would silently
--         evaluate to false for every real user. Replaced with
--         "current_user_id() IS NOT NULL".
--
-- 2. `public.profiles.user_id` FK'd to `auth.users(id)`, and a trigger on
--    `auth.users` auto-created the profile row on signup. Logto users are
--    never written into this Postgres's `auth.users` table, so both the FK
--    and the trigger are dropped. In their place: a SECURITY DEFINER RPC,
--    `ensure_own_profile()`, that the frontend calls once right after a
--    user's first successful Logto sign-in (see AuthContext.tsx). It can
--    only ever create/return the CALLING user's own row (derived from
--    their own verified JWT), so it's safe to grant to every authenticated
--    caller despite bypassing RLS internally.
--
-- Every existing policy's *authorization logic* (who can see/write what)
-- is unchanged — only the identity-extraction expression and column types
-- change, to stop assuming a UUID GoTrue subject.

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Identity helper. Centralizing this means every policy below reads
--    the same way regardless of exactly how Logto's claims end up shaped;
--    if that ever needs to change, it changes in one place.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULLIF((auth.jwt() ->> 'sub'), '');
$$;

-- ---------------------------------------------------------------------
-- 1. Drop the GoTrue-era provisioning trigger. auth.users will no longer
--    receive rows once Logto is the issuer.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. Drop every policy that references a column we're about to retype
--    (uuid -> text). Doing this before the ALTER COLUMN avoids Postgres
--    trying to typecheck a uuid-vs-text comparison mid-migration.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Active listings are viewable by everyone" ON public.listings;
DROP POLICY IF EXISTS "Authenticated users can create listings" ON public.listings;
DROP POLICY IF EXISTS "Sellers can update own listings" ON public.listings;
DROP POLICY IF EXISTS "Sellers can insert listing images" ON public.listing_images;
DROP POLICY IF EXISTS "Sellers can delete own listing images" ON public.listing_images;
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Buyers can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Conversation participants can view messages" ON public.messages;
DROP POLICY IF EXISTS "Conversation participants can send messages" ON public.messages;
DROP POLICY IF EXISTS "Order participants can view orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can create own orders" ON public.orders;
DROP POLICY IF EXISTS "Order participants can update orders" ON public.orders;
DROP POLICY IF EXISTS "Order participants can create reviews" ON public.reviews;
DROP POLICY IF EXISTS "Order participants can view disputes" ON public.disputes;
DROP POLICY IF EXISTS "Order participants can create disputes" ON public.disputes;
DROP POLICY IF EXISTS "Users can view own requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Users can create own requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Admins can update verification requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can upload listing images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own listing images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own listing images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own verification docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own verification docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own verification docs" ON storage.objects;

-- ---------------------------------------------------------------------
-- 3. Drop every FK constraint touching a column we're retyping (both
--    the referencing and referenced side must change together).
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey; -- -> auth.users
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_seller_id_fkey;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_buyer_id_fkey;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_seller_id_fkey;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_moderator_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_seller_id_fkey;
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_reviewer_id_fkey;
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_reviewed_user_id_fkey;
ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_raised_by_fkey;
ALTER TABLE public.verification_requests DROP CONSTRAINT IF EXISTS verification_requests_user_id_fkey;
ALTER TABLE public.verification_requests DROP CONSTRAINT IF EXISTS verification_requests_reviewer_id_fkey;
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey;

-- ---------------------------------------------------------------------
-- 4. Retype every user-id column uuid -> text.
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.listings ALTER COLUMN seller_id TYPE text USING seller_id::text;
ALTER TABLE public.conversations ALTER COLUMN buyer_id TYPE text USING buyer_id::text;
ALTER TABLE public.conversations ALTER COLUMN seller_id TYPE text USING seller_id::text;
ALTER TABLE public.conversations ALTER COLUMN moderator_id TYPE text USING moderator_id::text;
ALTER TABLE public.messages ALTER COLUMN sender_id TYPE text USING sender_id::text;
ALTER TABLE public.orders ALTER COLUMN buyer_id TYPE text USING buyer_id::text;
ALTER TABLE public.orders ALTER COLUMN seller_id TYPE text USING seller_id::text;
ALTER TABLE public.reviews ALTER COLUMN reviewer_id TYPE text USING reviewer_id::text;
ALTER TABLE public.reviews ALTER COLUMN reviewed_user_id TYPE text USING reviewed_user_id::text;
ALTER TABLE public.disputes ALTER COLUMN raised_by TYPE text USING raised_by::text;
ALTER TABLE public.verification_requests ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.verification_requests ALTER COLUMN reviewer_id TYPE text USING reviewer_id::text;
ALTER TABLE public.push_subscriptions ALTER COLUMN user_id TYPE text USING user_id::text;

-- ---------------------------------------------------------------------
-- 5. Re-add the FKs to public.profiles(user_id) now that both sides are
--    text. profiles.user_id itself no longer FKs to anything — Logto,
--    not this Postgres, is the source of truth for whether a user exists.
-- ---------------------------------------------------------------------
ALTER TABLE public.listings
  ADD CONSTRAINT listings_seller_id_fkey FOREIGN KEY (seller_id)
  REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_buyer_id_fkey FOREIGN KEY (buyer_id)
  REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_seller_id_fkey FOREIGN KEY (seller_id)
  REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_moderator_id_fkey FOREIGN KEY (moderator_id)
  REFERENCES public.profiles(user_id) ON DELETE SET NULL;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id)
  REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id)
  REFERENCES public.profiles(user_id) ON DELETE RESTRICT;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_seller_id_fkey FOREIGN KEY (seller_id)
  REFERENCES public.profiles(user_id) ON DELETE RESTRICT;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id)
  REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_reviewed_user_id_fkey FOREIGN KEY (reviewed_user_id)
  REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.disputes
  ADD CONSTRAINT disputes_raised_by_fkey FOREIGN KEY (raised_by)
  REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.verification_requests
  ADD CONSTRAINT verification_requests_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.verification_requests
  ADD CONSTRAINT verification_requests_reviewer_id_fkey FOREIGN KEY (reviewer_id)
  REFERENCES public.profiles(user_id);
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------
-- 6. Recreate the dropped policies using current_user_id(). Every
--    "who can do what" decision is identical to supabase_complete_setup.sql
--    — only the identity expression changed (auth.uid() -> current_user_id()).
--    None of these specify `TO authenticated`/`TO anon` on purpose: an
--    unauthenticated request has current_user_id() = NULL, which never
--    equals a real row's id, so the same effect is achieved without
--    depending on Logto's tokens mapping to a particular Postgres role.
-- ---------------------------------------------------------------------
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (current_user_id() = user_id)
  WITH CHECK (current_user_id() = user_id);

CREATE POLICY "Active listings are viewable by everyone"
  ON public.listings FOR SELECT
  USING (status = 'active' OR current_user_id() = seller_id);

CREATE POLICY "Authenticated users can create listings"
  ON public.listings FOR INSERT
  WITH CHECK (current_user_id() = seller_id);

CREATE POLICY "Sellers can update own listings"
  ON public.listings FOR UPDATE
  USING (current_user_id() = seller_id)
  WITH CHECK (current_user_id() = seller_id);

CREATE POLICY "Sellers can insert listing images"
  ON public.listing_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.seller_id = current_user_id()
    )
  );

CREATE POLICY "Sellers can delete own listing images"
  ON public.listing_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.seller_id = current_user_id()
    )
  );

CREATE POLICY "Participants can view conversations"
  ON public.conversations FOR SELECT
  USING (current_user_id() = buyer_id OR current_user_id() = seller_id OR current_user_id() = moderator_id);

CREATE POLICY "Buyers can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (current_user_id() = buyer_id AND current_user_id() <> seller_id);

CREATE POLICY "Participants can update conversations"
  ON public.conversations FOR UPDATE
  USING (current_user_id() = buyer_id OR current_user_id() = seller_id OR current_user_id() = moderator_id)
  WITH CHECK (current_user_id() = buyer_id OR current_user_id() = seller_id OR current_user_id() = moderator_id);

CREATE POLICY "Conversation participants can view messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.buyer_id = current_user_id() OR c.seller_id = current_user_id() OR c.moderator_id = current_user_id())
    )
  );

CREATE POLICY "Conversation participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    current_user_id() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.buyer_id = current_user_id() OR c.seller_id = current_user_id() OR c.moderator_id = current_user_id())
    )
  );

CREATE POLICY "Order participants can view orders"
  ON public.orders FOR SELECT
  USING (current_user_id() = buyer_id OR current_user_id() = seller_id);

CREATE POLICY "Buyers can create own orders"
  ON public.orders FOR INSERT
  WITH CHECK (current_user_id() = buyer_id AND current_user_id() <> seller_id);

CREATE POLICY "Order participants can update orders"
  ON public.orders FOR UPDATE
  USING (current_user_id() = buyer_id OR current_user_id() = seller_id)
  WITH CHECK (current_user_id() = buyer_id OR current_user_id() = seller_id);

CREATE POLICY "Order participants can create reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (
    current_user_id() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = current_user_id() OR o.seller_id = current_user_id())
    )
  );

CREATE POLICY "Order participants can view disputes"
  ON public.disputes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = current_user_id() OR o.seller_id = current_user_id())
    )
  );

CREATE POLICY "Order participants can create disputes"
  ON public.disputes FOR INSERT
  WITH CHECK (
    current_user_id() = raised_by
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = current_user_id() OR o.seller_id = current_user_id())
    )
  );

CREATE POLICY "Users can view own requests"
  ON public.verification_requests FOR SELECT
  USING (
    current_user_id() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = current_user_id() AND p.is_admin = true)
  );

CREATE POLICY "Users can create own requests"
  ON public.verification_requests FOR INSERT
  WITH CHECK (current_user_id() = user_id);

CREATE POLICY "Admins can update verification requests"
  ON public.verification_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = current_user_id() AND p.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = current_user_id() AND p.is_admin = true));

CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING ((SELECT current_user_id()) = user_id);

CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK ((SELECT current_user_id()) = user_id);

CREATE POLICY "Users can update own push subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING ((SELECT current_user_id()) = user_id)
  WITH CHECK ((SELECT current_user_id()) = user_id);

CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING ((SELECT current_user_id()) = user_id);

-- Storage: same "who" logic, current_user_id() instead of auth.uid()::text,
-- and "AND current_user_id() IS NOT NULL" instead of "AND auth.role() =
-- 'authenticated'" (Logto tokens don't carry GoTrue's `role` claim).
CREATE POLICY "Users can upload listing images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'listing-images'
    AND current_user_id() IS NOT NULL
    AND current_user_id() = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own listing images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'listing-images'
    AND current_user_id() = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own listing images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'listing-images'
    AND current_user_id() = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload own verification docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'verification-docs'
    AND current_user_id() IS NOT NULL
    AND current_user_id() = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own verification docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'verification-docs'
    AND (
      current_user_id() = (storage.foldername(name))[1]
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = current_user_id() AND p.is_admin = true)
    )
  );

CREATE POLICY "Users can delete own verification docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'verification-docs'
    AND current_user_id() = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------
-- 7. Profile provisioning, replacing the old auth.users trigger. Called
--    once by the frontend right after a user's first authenticated
--    request finds no matching profile row (see AuthContext.tsx). Scoped
--    to the caller's own id (taken from their own verified JWT), so it's
--    safe to grant broadly despite running as SECURITY DEFINER.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_own_profile(p_display_name text DEFAULT NULL)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id text := public.current_user_id();
  v_profile public.profiles;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (v_user_id, COALESCE(NULLIF(p_display_name, ''), 'New Buddy'))
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id;
  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_own_profile(text) TO PUBLIC;

COMMIT;
