ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS response_delay_seconds integer;