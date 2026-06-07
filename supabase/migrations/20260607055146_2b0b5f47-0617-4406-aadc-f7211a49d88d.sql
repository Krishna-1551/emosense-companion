
CREATE TABLE public.reply_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid,
  message_id uuid,
  emotion text,
  solution_mode boolean NOT NULL DEFAULT false,
  question_count integer NOT NULL DEFAULT 0,
  repetition_score numeric(4,3) NOT NULL DEFAULT 0,
  language text,
  reply_length integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reply_analytics TO authenticated;
GRANT ALL ON public.reply_analytics TO service_role;

ALTER TABLE public.reply_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reply analytics"
  ON public.reply_analytics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_reply_analytics_user_created ON public.reply_analytics(user_id, created_at DESC);
CREATE INDEX idx_reply_analytics_conv ON public.reply_analytics(conversation_id, created_at DESC);
