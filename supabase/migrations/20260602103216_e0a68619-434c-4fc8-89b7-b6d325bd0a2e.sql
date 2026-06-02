-- Conversations table
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own conversations" ON public.conversations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own conversations" ON public.conversations
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all conversations" ON public.conversations
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_conversations_user_updated ON public.conversations(user_id, updated_at DESC);

-- Add conversation_id to messages
ALTER TABLE public.messages ADD COLUMN conversation_id uuid;
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);

-- Backfill: create one "Earlier conversations" per user that has messages, attach all existing
INSERT INTO public.conversations (id, user_id, title, created_at, updated_at)
SELECT gen_random_uuid(), m.user_id, 'Earlier conversations', MIN(m.created_at), MAX(m.created_at)
FROM public.messages m
WHERE m.conversation_id IS NULL
GROUP BY m.user_id;

UPDATE public.messages m
SET conversation_id = c.id
FROM public.conversations c
WHERE m.conversation_id IS NULL
  AND c.user_id = m.user_id
  AND c.title = 'Earlier conversations';

-- Allow deleting conversation to cascade messages cleanup via app, but also add FK with CASCADE
ALTER TABLE public.messages
  ADD CONSTRAINT messages_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

-- Trigger to bump conversation.updated_at when messages inserted
CREATE OR REPLACE FUNCTION public.bump_conversation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.conversation_id IS NOT NULL THEN
    UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_bump_conversation_updated_at
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_updated_at();