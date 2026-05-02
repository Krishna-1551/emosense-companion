-- Action tracking columns on messages (admin-managed)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS follow_up_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid;

-- Allow admins to update messages (only the action-tracking columns matter in practice)
DROP POLICY IF EXISTS "Admins update messages" ON public.messages;
CREATE POLICY "Admins update messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Mark a case as follow_up or resolved
CREATE OR REPLACE FUNCTION public.admin_mark_case(_message_id uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _action = 'follow_up' THEN
    UPDATE public.messages SET follow_up_sent_at = now() WHERE id = _message_id;
  ELSIF _action = 'resolved' THEN
    UPDATE public.messages SET resolved_at = now(), resolved_by = auth.uid() WHERE id = _message_id;
  ELSIF _action = 'reopen' THEN
    UPDATE public.messages SET resolved_at = NULL, resolved_by = NULL WHERE id = _message_id;
  ELSE
    RAISE EXCEPTION 'invalid action';
  END IF;
END;
$$;

-- Update high_risk_cases function to include action tracking columns
DROP FUNCTION IF EXISTS public.admin_high_risk_cases(integer);
CREATE OR REPLACE FUNCTION public.admin_high_risk_cases(limit_n integer DEFAULT 50)
RETURNS TABLE(
  message_id uuid, user_id uuid, display_name text,
  age integer, gender text, profession text,
  risk_level text, emotion text, sentiment_score numeric,
  flagged_excerpt text, created_at timestamptz,
  pending_request_id uuid, active_request_id uuid,
  follow_up_sent_at timestamptz, resolved_at timestamptz,
  user_last_message_at timestamptz, user_message_count_24h bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    m.id,
    m.user_id,
    p.display_name,
    p.age, p.gender, p.profession,
    m.risk_level, m.emotion,
    (SELECT ml.sentiment_score FROM public.mood_logs ml
       WHERE ml.user_id = m.user_id AND ml.created_at <= m.created_at
       ORDER BY ml.created_at DESC LIMIT 1),
    left(m.content, 240),
    m.created_at,
    (SELECT cr.id FROM public.connect_requests cr
       WHERE cr.flagged_message_id = m.id AND cr.admin_id = auth.uid() AND cr.status = 'pending' LIMIT 1),
    (SELECT cr.id FROM public.connect_requests cr
       WHERE cr.flagged_message_id = m.id AND cr.admin_id = auth.uid() AND cr.status = 'accepted' LIMIT 1),
    m.follow_up_sent_at,
    m.resolved_at,
    (SELECT max(created_at) FROM public.messages WHERE user_id = m.user_id AND role = 'user'),
    (SELECT count(*) FROM public.messages WHERE user_id = m.user_id AND role = 'user' AND created_at > now() - interval '24 hours')
  FROM public.messages m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.risk_level = 'high'
    AND m.role = 'user'
    AND public.has_role(auth.uid(), 'admin')
  ORDER BY m.created_at DESC
  LIMIT limit_n;
$$;

-- Emotion insights (this week vs previous week)
CREATE OR REPLACE FUNCTION public.admin_emotion_insights()
RETURNS TABLE(emotion text, this_week bigint, last_week bigint, pct_change numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH t AS (
    SELECT emotion,
      count(*) FILTER (WHERE created_at > now() - interval '7 days')::bigint AS this_week,
      count(*) FILTER (WHERE created_at <= now() - interval '7 days' AND created_at > now() - interval '14 days')::bigint AS last_week
    FROM public.mood_logs
    WHERE created_at > now() - interval '14 days'
      AND public.has_role(auth.uid(), 'admin')
    GROUP BY emotion
  )
  SELECT emotion, this_week, last_week,
    CASE WHEN last_week = 0 THEN
      CASE WHEN this_week = 0 THEN 0 ELSE 100 END
    ELSE round(((this_week - last_week)::numeric / last_week::numeric) * 100, 1)
    END
  FROM t
  ORDER BY this_week DESC;
$$;

-- Behavior flags per user
CREATE OR REPLACE FUNCTION public.admin_behavior_flags()
RETURNS TABLE(user_id uuid, display_name text, flag text, detail text, last_active timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH user_stats AS (
    SELECT
      p.id,
      p.display_name,
      (SELECT max(created_at) FROM public.messages WHERE user_id = p.id) AS last_active,
      (SELECT count(*) FROM public.messages WHERE user_id = p.id AND created_at > now() - interval '7 days') AS msgs_7d,
      (SELECT count(*) FROM public.messages WHERE user_id = p.id AND created_at > now() - interval '14 days' AND created_at <= now() - interval '7 days') AS msgs_prev_7d,
      (SELECT max(created_at) FROM public.messages
        WHERE user_id = p.id AND role = 'user' AND risk_level IN ('high','moderate')) AS last_stress_at,
      (SELECT count(*) FROM public.messages
        WHERE user_id = p.id AND role = 'user'
          AND created_at > COALESCE(
            (SELECT max(created_at) FROM public.messages
              WHERE user_id = p.id AND role = 'user' AND risk_level IN ('high','moderate')),
            'epoch'::timestamptz)) AS msgs_after_stress
    FROM public.profiles p
    WHERE public.has_role(auth.uid(), 'admin')
  )
  SELECT id, display_name, flag, detail, last_active FROM (
    SELECT id, display_name, last_active,
      'drop_off_after_stress'::text AS flag,
      'No messages since stress signal'::text AS detail
    FROM user_stats
    WHERE last_stress_at IS NOT NULL
      AND last_stress_at < now() - interval '24 hours'
      AND msgs_after_stress = 0
    UNION ALL
    SELECT id, display_name, last_active,
      'sudden_drop',
      ('Activity dropped ' || (msgs_prev_7d - msgs_7d) || ' msgs vs prev week')
    FROM user_stats
    WHERE msgs_prev_7d >= 5 AND msgs_7d <= msgs_prev_7d / 2
    UNION ALL
    SELECT id, display_name, last_active,
      'low_activity',
      ('Only ' || msgs_7d || ' message(s) in 7 days')
    FROM user_stats
    WHERE msgs_7d > 0 AND msgs_7d <= 2 AND last_active > now() - interval '14 days'
    UNION ALL
    SELECT id, display_name, last_active,
      'irregular',
      'Inactive for over 14 days'
    FROM user_stats
    WHERE last_active IS NOT NULL AND last_active < now() - interval '14 days'
  ) f
  ORDER BY flag;
$$;