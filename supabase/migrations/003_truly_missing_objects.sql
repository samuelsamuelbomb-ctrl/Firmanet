-- ============================================================================
-- TRULY MISSING database objects for Firmanet
-- Based on existing migrations + code references
-- Run this in Supabase SQL Editor after the existing migrations are applied
-- ============================================================================

-- ============================================================================
-- 1. profiles: Add username column (code queries for it)
-- ============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- ============================================================================
-- 2. signals: Add category and state columns (code references them but
--    the original migration only has type/title/description/location)
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.signal_category AS ENUM ('crime','fire','flood','accident','sos','missing','other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.signal_state AS ENUM ('unverified','emerging','high_confidence','verified');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS category public.signal_category NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS state public.signal_state NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS lat double precision NOT NULL DEFAULT 6.6018,
  ADD COLUMN IF NOT EXISTS lng double precision NOT NULL DEFAULT 3.3515;

-- ============================================================================
-- 3. circle_members: Add member_user_id FK column (code needs it for
--    relationship tracking & accept_circle_request function)
-- ============================================================================
ALTER TABLE public.circle_members
  ADD COLUMN IF NOT EXISTS member_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 4. circle_requests table (completely missing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.circle_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_requests TO authenticated;
GRANT ALL ON public.circle_requests TO service_role;

ALTER TABLE public.circle_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS circle_requests_select ON public.circle_requests;
CREATE POLICY circle_requests_select ON public.circle_requests
  FOR SELECT TO authenticated USING (auth.uid() = to_user OR auth.uid() = from_user);

DROP POLICY IF EXISTS circle_requests_insert ON public.circle_requests;
CREATE POLICY circle_requests_insert ON public.circle_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user);

DROP POLICY IF EXISTS circle_requests_update ON public.circle_requests;
CREATE POLICY circle_requests_update ON public.circle_requests
  FOR UPDATE TO authenticated USING (auth.uid() = to_user);

DROP POLICY IF EXISTS circle_requests_delete ON public.circle_requests;
CREATE POLICY circle_requests_delete ON public.circle_requests
  FOR DELETE TO authenticated USING (auth.uid() = from_user OR auth.uid() = to_user);

-- ============================================================================
-- 5. device_tokens table (completely missing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_tokens_select ON public.device_tokens;
CREATE POLICY device_tokens_select ON public.device_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS device_tokens_insert ON public.device_tokens;
CREATE POLICY device_tokens_insert ON public.device_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS device_tokens_update ON public.device_tokens;
CREATE POLICY device_tokens_update ON public.device_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- 6. notifications: Add data jsonb column (code references it)
-- ============================================================================
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}'::jsonb;

-- ============================================================================
-- 7. Function: search_users (used by circle AddMemberModal)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_users(q text)
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.username, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE
    p.username IS NOT NULL
    AND (
      p.username ILIKE '%' || q || '%'
      OR p.display_name ILIKE '%' || q || '%'
    )
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_users TO authenticated;

-- ============================================================================
-- 8. Function: accept_circle_request (creates mutual memberships)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.accept_circle_request(_req_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_from uuid;
  v_to uuid;
  v_from_name text;
  v_to_name text;
BEGIN
  SELECT r.from_user, r.to_user INTO v_from, v_to
  FROM public.circle_requests r
  WHERE r.id = _req_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  SELECT COALESCE(p.display_name, p.username, 'Unknown') INTO v_from_name
  FROM public.profiles p WHERE p.id = v_from;

  SELECT COALESCE(p.display_name, p.username, 'Unknown') INTO v_to_name
  FROM public.profiles p WHERE p.id = v_to;

  -- Insert mutual circle memberships
  INSERT INTO public.circle_members (owner_id, name, role, member_user_id)
  VALUES
    (v_to,   v_from_name, 'Trusted Contact', v_from),
    (v_from, v_to_name,   'Trusted Contact', v_to)
  ON CONFLICT DO NOTHING;

  -- Delete the processed request
  DELETE FROM public.circle_requests WHERE id = _req_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_circle_request TO authenticated;

-- ============================================================================
-- 9. Function: decline_circle_request
-- ============================================================================
CREATE OR REPLACE FUNCTION public.decline_circle_request(_req_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.circle_requests WHERE id = _req_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_circle_request TO authenticated;

-- ============================================================================
-- 10. Update existing handle_new_user trigger to also set username
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    );
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 11. Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_signals_category ON public.signals(category);
CREATE INDEX IF NOT EXISTS idx_signals_state ON public.signals(state);
CREATE INDEX IF NOT EXISTS idx_circle_requests_from_user ON public.circle_requests(from_user);
CREATE INDEX IF NOT EXISTS idx_circle_requests_to_user ON public.circle_requests(to_user, status);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles(lower(username));
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);

-- ============================================================================
-- 12. Enable realtime for circle tables (needed for postgres_changes subs)
-- ============================================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_requests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
