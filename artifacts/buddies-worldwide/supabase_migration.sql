-- =============================================
-- BUDDIES WORLDWIDE — MIGRATION (run in Supabase SQL Editor)
-- Adds: verification_status on profiles,
--       verification_requests table,
--       moderator_id on conversations,
--       listing_images table,
--       verification-docs storage bucket + RLS
-- =============================================

-- 1. Add verification_status to profiles (if not exists)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified'
  CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));

-- 2. Create verification_requests table
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL CHECK (doc_type IN ('sa_id', 'passport', 'drivers_license')),
  doc_front_url   TEXT,
  doc_back_url    TEXT,
  selfie_url      TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  notes           TEXT,
  reviewer_id     UUID REFERENCES auth.users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests"
  ON public.verification_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own requests"
  ON public.verification_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_verification_requests_updated_at
  BEFORE UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sync verification_status on profiles when request is approved/rejected
CREATE OR REPLACE FUNCTION public.sync_verification_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    UPDATE public.profiles
      SET verification_status = 'verified',
          id_verified = true,
          seller_level = CASE
            WHEN seller_level = 'basic' THEN 'verified'
            ELSE seller_level
          END
      WHERE user_id = NEW.user_id;
  ELSIF NEW.status = 'rejected' THEN
    UPDATE public.profiles
      SET verification_status = 'rejected'
      WHERE user_id = NEW.user_id;
  ELSIF NEW.status = 'pending' THEN
    UPDATE public.profiles
      SET verification_status = 'pending'
      WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_verification_request_change
  AFTER INSERT OR UPDATE OF status ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_verification_status();

-- 3. Add moderator_id to conversations (if not exists)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS moderator_id UUID REFERENCES auth.users(id);

-- Update conversation RLS to allow moderator access
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations"
  ON public.conversations FOR SELECT
  USING (
    auth.uid() = buyer_id
    OR auth.uid() = seller_id
    OR auth.uid() = moderator_id
  );

-- Update message RLS to allow moderator to read/write
DROP POLICY IF EXISTS "Conversation participants can view messages" ON public.messages;
CREATE POLICY "Conversation participants can view messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (
          c.buyer_id = auth.uid()
          OR c.seller_id = auth.uid()
          OR c.moderator_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Conversation participants can send messages" ON public.messages;
CREATE POLICY "Conversation participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (
          c.buyer_id = auth.uid()
          OR c.seller_id = auth.uid()
          OR c.moderator_id = auth.uid()
        )
    )
  );

-- 4. Create listing_images table for multi-image support
CREATE TABLE IF NOT EXISTS public.listing_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listing images are viewable by everyone"
  ON public.listing_images FOR SELECT USING (true);

CREATE POLICY "Sellers can insert listing images"
  ON public.listing_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can delete own listing images"
  ON public.listing_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.seller_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON public.listing_images(listing_id, position);

-- 5. Storage bucket for verification documents
INSERT INTO storage.buckets (id, name, public)
  VALUES ('verification-docs', 'verification-docs', false)
  ON CONFLICT (id) DO NOTHING;

-- Only the owner and moderators can view their own docs
CREATE POLICY "Users can upload own verification docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'verification-docs'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own verification docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'verification-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own verification docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'verification-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- =============================================
-- 6. Push subscriptions table (Web Push notifications)
-- =============================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users manage their own subscriptions
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Server (anon key) can read all subscriptions to deliver pushes
CREATE POLICY "Anon can read push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (true);
