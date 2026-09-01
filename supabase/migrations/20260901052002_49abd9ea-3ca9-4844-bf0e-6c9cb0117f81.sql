-- ============ Care Bridge: trusted support contacts ============
CREATE TABLE public.care_trusted_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text,
  phone text,
  email text,
  preferred_method text NOT NULL DEFAULT 'call',
  consent_urgent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_trusted_contacts TO authenticated;
GRANT ALL ON public.care_trusted_contacts TO service_role;

ALTER TABLE public.care_trusted_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own trusted contacts select" ON public.care_trusted_contacts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own trusted contacts insert" ON public.care_trusted_contacts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own trusted contacts update" ON public.care_trusted_contacts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own trusted contacts delete" ON public.care_trusted_contacts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER care_trusted_contacts_updated_at
  BEFORE UPDATE ON public.care_trusted_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX care_trusted_contacts_user_idx ON public.care_trusted_contacts(user_id);

-- ============ Care Bridge: personal safety / support plan ============
CREATE TABLE public.care_safety_plans (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  warning_signs text,
  calming_activities text,
  safer_places text,
  people_to_contact text,
  professional_resources text,
  reason_to_pause text,
  follow_up_preference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_safety_plans TO authenticated;
GRANT ALL ON public.care_safety_plans TO service_role;

ALTER TABLE public.care_safety_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own safety plan select" ON public.care_safety_plans
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own safety plan insert" ON public.care_safety_plans
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own safety plan update" ON public.care_safety_plans
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own safety plan delete" ON public.care_safety_plans
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER care_safety_plans_updated_at
  BEFORE UPDATE ON public.care_safety_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Care Bridge: minimal event log ============
CREATE TABLE public.care_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  support_level smallint,
  risk_band text,
  human_support_requested boolean NOT NULL DEFAULT false,
  confirmed_safe boolean,
  follow_up_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_events_name_check CHECK (event_name IN (
    'support_plan_offered','safety_check_displayed','user_confirmed_safe','user_unsure',
    'urgent_support_requested','trusted_contact_action_selected','helpline_action_selected',
    'follow_up_requested','false_alarm_reported'
  )),
  CONSTRAINT care_events_level_check CHECK (support_level IS NULL OR support_level BETWEEN 1 AND 3)
);

GRANT SELECT, INSERT ON public.care_events TO authenticated;
GRANT ALL ON public.care_events TO service_role;

ALTER TABLE public.care_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own care events insert" ON public.care_events
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own care events select" ON public.care_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX care_events_user_created_idx ON public.care_events(user_id, created_at DESC);
CREATE INDEX care_events_created_idx ON public.care_events(created_at DESC);

-- ============ Care Bridge: follow-up check-ins ============
CREATE TABLE public.care_follow_ups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  due_at timestamptz NOT NULL,
  choice_label text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  outcome text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_follow_ups TO authenticated;
GRANT ALL ON public.care_follow_ups TO service_role;

ALTER TABLE public.care_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own follow ups select" ON public.care_follow_ups
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own follow ups insert" ON public.care_follow_ups
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own follow ups update" ON public.care_follow_ups
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own follow ups delete" ON public.care_follow_ups
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER care_follow_ups_updated_at
  BEFORE UPDATE ON public.care_follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX care_follow_ups_user_due_idx ON public.care_follow_ups(user_id, due_at);

-- ============ Admin: strictly limited Care Bridge event feed ============
CREATE OR REPLACE FUNCTION public.admin_care_bridge_events(limit_n integer DEFAULT 100)
RETURNS TABLE(
  event_id uuid,
  masked_user text,
  event_name text,
  support_level smallint,
  risk_band text,
  human_support_requested boolean,
  confirmed_safe boolean,
  follow_up_status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    e.id,
    'USR-' || upper(substr(replace(e.user_id::text, '-', ''), 1, 6)),
    e.event_name,
    e.support_level,
    e.risk_band,
    e.human_support_requested,
    e.confirmed_safe,
    e.follow_up_status,
    e.created_at
  FROM public.care_events e
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY e.created_at DESC
  LIMIT greatest(1, least(coalesce(limit_n, 100), 500));
$$;

CREATE OR REPLACE FUNCTION public.admin_care_bridge_summary()
RETURNS TABLE(
  events_24h bigint,
  safety_checks_24h bigint,
  urgent_requests_24h bigint,
  confirmed_safe_24h bigint,
  false_alarms_24h bigint,
  follow_ups_pending bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    count(*) FILTER (WHERE e.created_at > now() - interval '24 hours')::bigint,
    count(*) FILTER (WHERE e.event_name = 'safety_check_displayed' AND e.created_at > now() - interval '24 hours')::bigint,
    count(*) FILTER (WHERE e.event_name = 'urgent_support_requested' AND e.created_at > now() - interval '24 hours')::bigint,
    count(*) FILTER (WHERE e.event_name = 'user_confirmed_safe' AND e.created_at > now() - interval '24 hours')::bigint,
    count(*) FILTER (WHERE e.event_name = 'false_alarm_reported' AND e.created_at > now() - interval '24 hours')::bigint,
    (SELECT count(*) FROM public.care_follow_ups WHERE status = 'pending')::bigint
  FROM public.care_events e
  WHERE public.has_role(auth.uid(), 'admin');
$$;