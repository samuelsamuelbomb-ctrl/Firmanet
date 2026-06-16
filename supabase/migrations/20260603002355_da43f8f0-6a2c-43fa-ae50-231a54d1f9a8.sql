
-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  location text DEFAULT 'Ikeja, Lagos',
  trust_score int NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- SIGNALS
CREATE TYPE public.signal_type AS ENUM ('observation','update','incident','verified');
CREATE TABLE public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type public.signal_type NOT NULL DEFAULT 'observation',
  title text NOT NULL,
  description text,
  location text NOT NULL DEFAULT 'Ikeja, Lagos',
  distance_km numeric NOT NULL DEFAULT 0.5,
  trust int NOT NULL DEFAULT 40,
  reports int NOT NULL DEFAULT 1,
  media int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.signals TO authenticated;
GRANT SELECT ON public.signals TO anon;
GRANT ALL ON public.signals TO service_role;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signals_public_read" ON public.signals FOR SELECT USING (true);
CREATE POLICY "signals_insert_authed" ON public.signals FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

-- REPORTS (verifications)
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id uuid NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (signal_id, user_id)
);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_public_read" ON public.reports FOR SELECT USING (true);
CREATE POLICY "reports_insert_own" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- TRUST verification trigger: each new report bumps trust + reports count
CREATE OR REPLACE FUNCTION public.bump_signal_trust()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.signals
     SET reports = reports + 1,
         trust   = LEAST(99, trust + GREATEST(2, NEW.vote * 4))
   WHERE id = NEW.signal_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_bump_signal_trust
AFTER INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.bump_signal_trust();

-- SOS SESSIONS
CREATE TYPE public.sos_status AS ENUM ('active','resolved','cancelled');
CREATE TABLE public.sos_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.sos_status NOT NULL DEFAULT 'active',
  location text,
  acknowledged_count int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.sos_sessions TO authenticated;
GRANT ALL ON public.sos_sessions TO service_role;
ALTER TABLE public.sos_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sos_select_own" ON public.sos_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sos_insert_own" ON public.sos_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sos_update_own" ON public.sos_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_insert_own" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
