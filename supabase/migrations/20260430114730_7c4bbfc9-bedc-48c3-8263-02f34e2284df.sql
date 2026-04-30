-- Roles enum + user_roles table (separate from profiles to prevent privilege escalation)
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer to safely check role from RLS without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: users can see their own role rows; admins can see all
CREATE POLICY "Users view own role"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin read-access policies on existing data tables (users keep their own access)
CREATE POLICY "Admins view all messages"
ON public.messages FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all mood"
ON public.mood_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all panic"
ON public.panic_events FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Aggregate views for the admin dashboard (security definer functions to safely aggregate)
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS TABLE (
  total_users bigint,
  total_messages bigint,
  total_panic bigint,
  high_risk_today bigint,
  active_today bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.profiles),
    (SELECT count(*) FROM public.messages),
    (SELECT count(*) FROM public.panic_events),
    (SELECT count(*) FROM public.mood_logs WHERE risk_level = 'high' AND created_at > now() - interval '24 hours'),
    (SELECT count(DISTINCT user_id) FROM public.messages WHERE created_at > now() - interval '24 hours')
  WHERE public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.admin_emotion_distribution(days int DEFAULT 7)
RETURNS TABLE (emotion text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT emotion, count(*)::bigint
  FROM public.mood_logs
  WHERE created_at > now() - (days || ' days')::interval
    AND public.has_role(auth.uid(), 'admin')
  GROUP BY emotion
  ORDER BY count(*) DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_risk_trend(days int DEFAULT 14)
RETURNS TABLE (day date, low bigint, moderate bigint, high bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    date_trunc('day', created_at)::date AS day,
    count(*) FILTER (WHERE risk_level = 'low')::bigint,
    count(*) FILTER (WHERE risk_level = 'moderate')::bigint,
    count(*) FILTER (WHERE risk_level = 'high')::bigint
  FROM public.mood_logs
  WHERE created_at > now() - (days || ' days')::interval
    AND public.has_role(auth.uid(), 'admin')
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.admin_high_risk_feed(limit_n int DEFAULT 25)
RETURNS TABLE (user_id uuid, display_name text, emotion text, sentiment_score numeric, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id, p.display_name, m.emotion, m.sentiment_score, m.created_at
  FROM public.mood_logs m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.risk_level = 'high'
    AND public.has_role(auth.uid(), 'admin')
  ORDER BY m.created_at DESC
  LIMIT limit_n;
$$;

CREATE OR REPLACE FUNCTION public.admin_user_list()
RETURNS TABLE (user_id uuid, display_name text, message_count bigint, last_active timestamptz, recent_high_risk bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id AS user_id,
    p.display_name,
    coalesce((SELECT count(*) FROM public.messages WHERE user_id = p.id), 0)::bigint,
    (SELECT max(created_at) FROM public.messages WHERE user_id = p.id),
    coalesce((SELECT count(*) FROM public.mood_logs WHERE user_id = p.id AND risk_level = 'high' AND created_at > now() - interval '7 days'), 0)::bigint
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY 4 DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.admin_user_timeline(target uuid, days int DEFAULT 30)
RETURNS TABLE (created_at timestamptz, emotion text, sentiment_score numeric, risk_level text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT created_at, emotion, sentiment_score, risk_level
  FROM public.mood_logs
  WHERE user_id = target
    AND created_at > now() - (days || ' days')::interval
    AND public.has_role(auth.uid(), 'admin')
  ORDER BY created_at;
$$;