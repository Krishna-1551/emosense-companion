CREATE TABLE public.response_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id uuid,
  situation_summary text,
  response_opening text,
  approach text,
  key_phrases text[] NOT NULL DEFAULT '{}',
  language text,
  style text,
  reply_length integer,
  feedback text,
  feedback_reason text,
  outcome_signal text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.response_memory TO authenticated;
GRANT ALL ON public.response_memory TO service_role;

ALTER TABLE public.response_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own response memory" ON public.response_memory
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own response memory" ON public.response_memory
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own response memory" ON public.response_memory
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own response memory" ON public.response_memory
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_response_memory_user_created ON public.response_memory (user_id, created_at DESC);
CREATE INDEX idx_response_memory_message ON public.response_memory (message_id);

CREATE TRIGGER response_memory_updated_at BEFORE UPDATE ON public.response_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();