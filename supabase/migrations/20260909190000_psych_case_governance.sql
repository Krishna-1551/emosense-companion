-- Require traceable human review before a psychological case can influence replies.
ALTER TABLE public.psych_cases
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS evidence_url text,
  ADD COLUMN IF NOT EXISTS review_notes text;

-- Preserve already-reviewed, sourced cases while making future review dates explicit.
UPDATE public.psych_cases
SET reviewed_at = coalesce(reviewed_at, updated_at, now())
WHERE reviewed = true AND nullif(trim(source), '') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.match_psych_cases(_query text, _limit integer DEFAULT 4)
RETURNS TABLE(
  case_code text, category text, subcategory text, user_situation text,
  detected_signals text[], possible_patterns text[], severity_level integer,
  response_strategy text, follow_up_questions text[], avoid_saying text[],
  next_steps text[], escalation_criteria text, source text, confidence numeric,
  rank real
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.case_code, c.category, c.subcategory, c.user_situation,
         c.detected_signals, c.possible_patterns, c.severity_level,
         c.response_strategy, c.follow_up_questions, c.avoid_saying,
         c.next_steps, c.escalation_criteria, c.source, c.confidence,
         ts_rank(to_tsvector('english', coalesce(c.search_text, '')), websearch_to_tsquery('english', _query)) AS rank
  FROM public.psych_cases c
  WHERE c.enabled AND c.reviewed AND c.reviewed_at IS NOT NULL
    AND nullif(trim(c.source), '') IS NOT NULL
    AND c.confidence >= 0.65
    AND websearch_to_tsquery('english', _query) IS NOT NULL
    AND to_tsvector('english', coalesce(c.search_text, '')) @@ websearch_to_tsquery('english', _query)
  ORDER BY rank DESC, c.confidence DESC, c.severity_level DESC
  LIMIT greatest(1, least(coalesce(_limit, 4), 10));
$$;
