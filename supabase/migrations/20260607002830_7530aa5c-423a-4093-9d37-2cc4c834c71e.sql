
-- 1. Profiles: username
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;
UPDATE public.profiles SET username = COALESCE(username,
  lower(regexp_replace(COALESCE(display_name, 'user'), '[^a-zA-Z0-9_]', '', 'g')) || substr(replace(id::text,'-',''),1,4))
  WHERE username IS NULL;

-- Update handle_new_user to populate username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE base text; uname text; n int := 0;
BEGIN
  base := lower(regexp_replace(
    COALESCE(NEW.raw_user_meta_data->>'username',
             NEW.raw_user_meta_data->>'name',
             NEW.raw_user_meta_data->>'full_name',
             split_part(NEW.email,'@',1)),
    '[^a-zA-Z0-9_]', '', 'g'));
  IF base IS NULL OR base = '' THEN base := 'user'; END IF;
  uname := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = uname) LOOP
    n := n + 1; uname := base || n::text;
  END LOOP;
  INSERT INTO public.profiles (id, display_name, avatar_url, username)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
          NEW.raw_user_meta_data->>'avatar_url',
          uname)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Signals: category + state
ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'unverified';

CREATE OR REPLACE FUNCTION public.compute_signal_state(_reports int, _trust int)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _reports >= 20 OR _trust >= 90 THEN 'verified'
    WHEN _trust >= 75 THEN 'high_confidence'
    WHEN _reports >= 3 THEN 'emerging'
    ELSE 'unverified'
  END
$$;

CREATE OR REPLACE FUNCTION public.signals_set_state()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.state := public.compute_signal_state(NEW.reports, NEW.trust);
  IF NEW.state = 'verified' THEN NEW.type := 'verified'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_signals_set_state ON public.signals;
CREATE TRIGGER trg_signals_set_state BEFORE INSERT OR UPDATE OF reports, trust
  ON public.signals FOR EACH ROW EXECUTE FUNCTION public.signals_set_state();

-- 3. Circle members: link to firmanet user
ALTER TABLE public.circle_members ADD COLUMN IF NOT EXISTS member_user_id uuid;
CREATE INDEX IF NOT EXISTS idx_circle_members_member_user ON public.circle_members(member_user_id);

-- 4. Circle requests
CREATE TABLE IF NOT EXISTS public.circle_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL,
  to_user uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending/accepted/declined
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_user, to_user)
);
GRANT SELECT, INSERT, UPDATE ON public.circle_requests TO authenticated;
GRANT ALL ON public.circle_requests TO service_role;
ALTER TABLE public.circle_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS req_select_party ON public.circle_requests;
CREATE POLICY req_select_party ON public.circle_requests FOR SELECT TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);
DROP POLICY IF EXISTS req_insert_from ON public.circle_requests;
CREATE POLICY req_insert_from ON public.circle_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user AND from_user <> to_user);
DROP POLICY IF EXISTS req_update_to ON public.circle_requests;
CREATE POLICY req_update_to ON public.circle_requests FOR UPDATE TO authenticated
  USING (auth.uid() = to_user);

CREATE TRIGGER trg_circle_req_touch BEFORE UPDATE ON public.circle_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Search users RPC
CREATE OR REPLACE FUNCTION public.search_users(q text)
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, username, display_name, avatar_url FROM public.profiles
  WHERE id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    AND (username ILIKE q || '%' OR display_name ILIKE q || '%')
  ORDER BY username NULLS LAST LIMIT 20
$$;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;

-- 6. Accept request RPC — links both sides
CREATE OR REPLACE FUNCTION public.accept_circle_request(_req_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.circle_requests%ROWTYPE;
        a_name text; b_name text;
BEGIN
  SELECT * INTO r FROM public.circle_requests WHERE id = _req_id;
  IF r.id IS NULL OR r.to_user <> auth.uid() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE public.circle_requests SET status='accepted', updated_at=now() WHERE id=_req_id;
  SELECT COALESCE(display_name, username, 'Friend') INTO a_name FROM public.profiles WHERE id=r.from_user;
  SELECT COALESCE(display_name, username, 'Friend') INTO b_name FROM public.profiles WHERE id=r.to_user;
  INSERT INTO public.circle_members (owner_id, member_user_id, name, role, location)
    VALUES (r.to_user, r.from_user, a_name, 'Friend', 'Firmanet')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.circle_members (owner_id, member_user_id, name, role, location)
    VALUES (r.from_user, r.to_user, b_name, 'Friend', 'Firmanet')
    ON CONFLICT DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION public.accept_circle_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_circle_request(_req_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.circle_requests SET status='declined', updated_at=now()
   WHERE id=_req_id AND to_user = auth.uid();
END $$;
GRANT EXECUTE ON FUNCTION public.decline_circle_request(uuid) TO authenticated;

-- 7. Notifications: data column
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}'::jsonb;

-- Allow triggers to insert notifications for other users
DROP POLICY IF EXISTS notif_service_insert ON public.notifications;
CREATE POLICY notif_service_insert ON public.notifications FOR INSERT TO service_role WITH CHECK (true);

-- 8. Notify on circle request
CREATE OR REPLACE FUNCTION public.notify_circle_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sender text;
BEGIN
  SELECT COALESCE('@'||username, display_name, 'Someone') INTO sender FROM public.profiles WHERE id = NEW.from_user;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, data)
      VALUES (NEW.to_user, 'circle_request', sender || ' wants to join your Circle',
              'Tap to accept or decline.', jsonb_build_object('request_id', NEW.id, 'from_user', NEW.from_user));
  ELSIF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    SELECT COALESCE('@'||username, display_name, 'Friend') INTO sender FROM public.profiles WHERE id = NEW.to_user;
    INSERT INTO public.notifications (user_id, kind, title, body, data)
      VALUES (NEW.from_user, 'circle_accepted', sender || ' accepted your Circle request', null,
              jsonb_build_object('request_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_circle_request ON public.circle_requests;
CREATE TRIGGER trg_notify_circle_request AFTER INSERT OR UPDATE ON public.circle_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_circle_request();

-- 9. Notify circle members on SOS
CREATE OR REPLACE FUNCTION public.notify_sos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sender text;
BEGIN
  SELECT COALESCE(display_name, '@'||username, 'A friend') INTO sender FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, kind, title, body, data)
    SELECT cm.owner_id, 'sos', sender || ' triggered an SOS',
           COALESCE(NEW.location, 'Tap to view live location.'),
           jsonb_build_object('sos_id', NEW.id, 'from_user', NEW.user_id)
      FROM public.circle_members cm
     WHERE cm.member_user_id = NEW.user_id AND cm.owner_id <> NEW.user_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_sos ON public.sos_sessions;
CREATE TRIGGER trg_notify_sos AFTER INSERT ON public.sos_sessions
  FOR EACH ROW EXECUTE FUNCTION public.notify_sos();

-- 10. Notify circle owners about new signal from author / state transitions
CREATE OR REPLACE FUNCTION public.notify_signal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE author_name text; kind_v text; title_v text;
BEGIN
  IF NEW.author_id IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, '@'||username, 'A friend') INTO author_name FROM public.profiles WHERE id = NEW.author_id;
  IF TG_OP = 'INSERT' THEN
    kind_v := 'alert';
    title_v := author_name || ' reported ' || NEW.category || ' at ' || NEW.location;
  ELSIF NEW.state = 'verified' AND OLD.state <> 'verified' THEN
    kind_v := 'verified';
    title_v := 'Verified: ' || NEW.title;
  ELSE
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, kind, title, body, data)
    SELECT DISTINCT cm.owner_id, kind_v, title_v, NEW.title,
           jsonb_build_object('signal_id', NEW.id)
      FROM public.circle_members cm
     WHERE cm.member_user_id = NEW.author_id AND cm.owner_id <> NEW.author_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_signal ON public.signals;
CREATE TRIGGER trg_notify_signal AFTER INSERT OR UPDATE OF state ON public.signals
  FOR EACH ROW EXECUTE FUNCTION public.notify_signal();

-- 11. Realtime publication
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='signals';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.signals; END IF;
END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; END IF;
END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='circle_members';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_members; END IF;
END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='circle_requests';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_requests; END IF;
END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='sos_sessions';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_sessions; END IF;
END $$;

ALTER TABLE public.signals REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.circle_requests REPLICA IDENTITY FULL;
ALTER TABLE public.circle_members REPLICA IDENTITY FULL;
