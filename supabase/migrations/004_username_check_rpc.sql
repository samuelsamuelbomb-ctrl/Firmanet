-- ============================================================================
-- 1. Add a case-insensitive unique index on username (so "Sam" and "sam" can't coexist)
-- ============================================================================
DROP INDEX IF EXISTS idx_profiles_username_lower;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (lower(username));

-- ============================================================================
-- 2. RPC: Check if a username is already taken (case-insensitive, exact match)
--    Returns true if the username exists (excluding a given user ID for edits)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_username_taken(
  p_username text,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(p_username)
      AND (p_exclude_user_id IS NULL OR id <> p_exclude_user_id)
  )
$$;

GRANT EXECUTE ON FUNCTION public.check_username_taken(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_username_taken(text, uuid) TO anon;