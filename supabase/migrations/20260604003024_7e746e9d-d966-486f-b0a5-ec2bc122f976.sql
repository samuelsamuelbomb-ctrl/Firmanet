
CREATE TYPE public.member_status AS ENUM ('calm','warn','danger');

CREATE TABLE public.circle_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'Family',
  location text NOT NULL DEFAULT 'Ikeja, Lagos',
  status public.member_status NOT NULL DEFAULT 'calm',
  last_seen text NOT NULL DEFAULT 'just now',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_members TO authenticated;
GRANT ALL ON public.circle_members TO service_role;

ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY circle_select_own ON public.circle_members
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY circle_insert_own ON public.circle_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY circle_update_own ON public.circle_members
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY circle_delete_own ON public.circle_members
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER circle_members_touch
  BEFORE UPDATE ON public.circle_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
