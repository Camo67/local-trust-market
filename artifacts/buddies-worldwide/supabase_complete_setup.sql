-- Buddies Worldwide complete Supabase setup
-- Run this once in Supabase Dashboard > SQL Editor for project nvqlsxkicqgaiwuhqwjc.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- If a previous broken auth trigger exists, remove it before creating the
-- tables it depends on. A broken trigger can make signups fail with 500.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'New Buddy',
  avatar_url TEXT,
  location TEXT,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  id_verified BOOLEAN NOT NULL DEFAULT false,
  seller_level TEXT NOT NULL DEFAULT 'basic'
    CHECK (seller_level IN ('basic', 'verified', 'trusted', 'premium')),
  rating NUMERIC(2, 1) NOT NULL DEFAULT 0
    CHECK (rating >= 0 AND rating <= 5),
  completed_sales INTEGER NOT NULL DEFAULT 0
    CHECK (completed_sales >= 0),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''), split_part(NEW.email, '@', 1), 'New Buddy')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL CONSTRAINT listings_seller_id_fkey
    REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL CHECK (price >= 0),
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  image_url TEXT,
  video_url TEXT,
  video_thumbnail TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'sold', 'paused', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL CONSTRAINT conversations_buyer_id_fkey
    REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  seller_id UUID NOT NULL CONSTRAINT conversations_seller_id_fkey
    REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  moderator_id UUID CONSTRAINT conversations_moderator_id_fkey
    REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id, buyer_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL CONSTRAINT orders_buyer_id_fkey
    REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL CONSTRAINT orders_seller_id_fkey
    REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed')),
  payment_reference TEXT,
  delivery_deadline TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reviewed_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  raised_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  evidence_url TEXT,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL CONSTRAINT verification_requests_user_id_fkey
    REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('sa_id', 'passport', 'drivers_license')),
  doc_front_url TEXT,
  doc_back_url TEXT,
  selfie_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  reviewer_id UUID REFERENCES public.profiles(user_id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_listings_status_created ON public.listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON public.listing_images(listing_id, position);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations(buyer_id, seller_id, moderator_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON public.orders(seller_id, created_at DESC);

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_listings_updated_at ON public.listings;
CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_disputes_updated_at ON public.disputes;
CREATE TRIGGER update_disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_verification_requests_updated_at ON public.verification_requests;
CREATE TRIGGER update_verification_requests_updated_at
  BEFORE UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.touch_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_message_touch_conversation ON public.messages;
CREATE TRIGGER on_message_touch_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_on_message();

CREATE OR REPLACE FUNCTION public.sync_verification_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    UPDATE public.profiles
      SET verification_status = 'verified',
          id_verified = true,
          seller_level = CASE WHEN seller_level = 'basic' THEN 'verified' ELSE seller_level END
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

DROP TRIGGER IF EXISTS on_verification_request_change ON public.verification_requests;
CREATE TRIGGER on_verification_request_change
  AFTER INSERT OR UPDATE OF status ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_verification_status();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Active listings are viewable by everyone" ON public.listings;
CREATE POLICY "Active listings are viewable by everyone"
  ON public.listings FOR SELECT
  USING (status = 'active' OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Authenticated users can create listings" ON public.listings;
CREATE POLICY "Authenticated users can create listings"
  ON public.listings FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can update own listings" ON public.listings;
CREATE POLICY "Sellers can update own listings"
  ON public.listings FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Listing images are viewable by everyone" ON public.listing_images;
CREATE POLICY "Listing images are viewable by everyone"
  ON public.listing_images FOR SELECT USING (true);

DROP POLICY IF EXISTS "Sellers can insert listing images" ON public.listing_images;
CREATE POLICY "Sellers can insert listing images"
  ON public.listing_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers can delete own listing images" ON public.listing_images;
CREATE POLICY "Sellers can delete own listing images"
  ON public.listing_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR auth.uid() = moderator_id);

DROP POLICY IF EXISTS "Buyers can create conversations" ON public.conversations;
CREATE POLICY "Buyers can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = buyer_id AND auth.uid() <> seller_id);

DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;
CREATE POLICY "Participants can update conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR auth.uid() = moderator_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id OR auth.uid() = moderator_id);

DROP POLICY IF EXISTS "Conversation participants can view messages" ON public.messages;
CREATE POLICY "Conversation participants can view messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid() OR c.moderator_id = auth.uid())
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
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid() OR c.moderator_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Order participants can view orders" ON public.orders;
CREATE POLICY "Order participants can view orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Buyers can create own orders" ON public.orders;
CREATE POLICY "Buyers can create own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = buyer_id AND auth.uid() <> seller_id);

DROP POLICY IF EXISTS "Order participants can update orders" ON public.orders;
CREATE POLICY "Order participants can update orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews are viewable by everyone"
  ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Order participants can create reviews" ON public.reviews;
CREATE POLICY "Order participants can create reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Order participants can view disputes" ON public.disputes;
CREATE POLICY "Order participants can view disputes"
  ON public.disputes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Order participants can create disputes" ON public.disputes;
CREATE POLICY "Order participants can create disputes"
  ON public.disputes FOR INSERT
  WITH CHECK (
    auth.uid() = raised_by
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view own requests" ON public.verification_requests;
CREATE POLICY "Users can view own requests"
  ON public.verification_requests FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "Users can create own requests" ON public.verification_requests;
CREATE POLICY "Users can create own requests"
  ON public.verification_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update verification requests" ON public.verification_requests;
CREATE POLICY "Admins can update verification requests"
  ON public.verification_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true));

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own push subscriptions"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Anon can read push subscriptions" ON public.push_subscriptions;

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('listing-images', 'listing-images', true),
  ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Listing images are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Listing images are publicly accessible" ON storage.objects;

DROP POLICY IF EXISTS "Users can upload listing images" ON storage.objects;
CREATE POLICY "Users can upload listing images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'listing-images'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own listing images" ON storage.objects;
CREATE POLICY "Users can update own listing images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'listing-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own listing images" ON storage.objects;
CREATE POLICY "Users can delete own listing images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'listing-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can upload own verification docs" ON storage.objects;
CREATE POLICY "Users can upload own verification docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'verification-docs'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view own verification docs" ON storage.objects;
CREATE POLICY "Users can view own verification docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'verification-docs'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true)
    )
  );

DROP POLICY IF EXISTS "Users can delete own verification docs" ON storage.objects;
CREATE POLICY "Users can delete own verification docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'verification-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Promote the moderator account after it has signed up in Supabase Auth.
INSERT INTO public.profiles (user_id, display_name, is_admin, seller_level, verification_status, id_verified)
SELECT id, 'Buddies Moderator', true, 'trusted', 'verified', true
FROM auth.users
WHERE lower(email) = lower('moderator@buddiesworldwide.online')
ON CONFLICT (user_id) DO UPDATE
SET is_admin = true,
    display_name = COALESCE(NULLIF(public.profiles.display_name, 'New Buddy'), 'Buddies Moderator'),
    seller_level = CASE WHEN public.profiles.seller_level = 'basic' THEN 'trusted' ELSE public.profiles.seller_level END,
    verification_status = 'verified',
    id_verified = true,
    updated_at = now();
