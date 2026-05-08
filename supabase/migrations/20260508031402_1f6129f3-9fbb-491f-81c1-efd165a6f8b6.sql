
CREATE TABLE public.user_learning_profile (
  user_id uuid PRIMARY KEY,
  preferred_language text,
  preferred_tone text,
  avg_user_msg_length numeric,
  prefers_short_replies boolean,
  engagement_pattern jsonb DEFAULT '{}'::jsonb,
  successful_styles jsonb DEFAULT '{}'::jsonb,
  recurring_topics jsonb DEFAULT '[]'::jsonb,
  emotion_history jsonb DEFAULT '{}'::jsonb,
  interaction_count integer DEFAULT 0,
  active_hours jsonb DEFAULT '{}'::jsonb,
  response_effectiveness numeric DEFAULT 0,
  last_style text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_learning_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own learning" ON public.user_learning_profile
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own learning" ON public.user_learning_profile
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own learning" ON public.user_learning_profile
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all learning" ON public.user_learning_profile
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
