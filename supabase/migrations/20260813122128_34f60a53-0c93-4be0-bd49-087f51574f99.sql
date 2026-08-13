ALTER TABLE public.psych_assessments
  ADD COLUMN IF NOT EXISTS signal_state jsonb,
  ADD COLUMN IF NOT EXISTS next_probe text;