-- ============ Psychological Intelligence Engine ============

CREATE TABLE public.psych_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_code text NOT NULL UNIQUE,
  category text NOT NULL,
  subcategory text,
  user_situation text NOT NULL,
  example_statements text[] NOT NULL DEFAULT '{}',
  detected_signals text[] NOT NULL DEFAULT '{}',
  context_notes text,
  possible_patterns text[] NOT NULL DEFAULT '{}',
  severity_level integer NOT NULL DEFAULT 1,
  response_strategy text NOT NULL,
  follow_up_questions text[] NOT NULL DEFAULT '{}',
  avoid_saying text[] NOT NULL DEFAULT '{}',
  next_steps text[] NOT NULL DEFAULT '{}',
  escalation_criteria text,
  source text,
  source_license text,
  confidence numeric NOT NULL DEFAULT 0.7,
  reviewed boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  search_text text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT psych_cases_severity_chk CHECK (severity_level BETWEEN 1 AND 4),
  CONSTRAINT psych_cases_confidence_chk CHECK (confidence >= 0 AND confidence <= 1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.psych_cases TO authenticated;
GRANT ALL ON public.psych_cases TO service_role;
ALTER TABLE public.psych_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read cases" ON public.psych_cases
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert cases" ON public.psych_cases
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update cases" ON public.psych_cases
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete cases" ON public.psych_cases
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_psych_cases_updated
  BEFORE UPDATE ON public.psych_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Searchable text index (immutable expression, safe for indexes)
CREATE OR REPLACE FUNCTION public.psych_cases_refresh_search()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_text :=
    coalesce(NEW.category,'') || ' ' || coalesce(NEW.subcategory,'') || ' ' ||
    coalesce(NEW.user_situation,'') || ' ' || coalesce(NEW.context_notes,'') || ' ' ||
    array_to_string(coalesce(NEW.example_statements, '{}'), ' ') || ' ' ||
    array_to_string(coalesce(NEW.detected_signals, '{}'), ' ') || ' ' ||
    array_to_string(coalesce(NEW.possible_patterns, '{}'), ' ');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_psych_cases_search
  BEFORE INSERT OR UPDATE ON public.psych_cases
  FOR EACH ROW EXECUTE FUNCTION public.psych_cases_refresh_search();

CREATE INDEX psych_cases_search_idx ON public.psych_cases
  USING gin (to_tsvector('english', coalesce(search_text, '')));

CREATE INDEX psych_cases_category_idx ON public.psych_cases (category, severity_level);

-- Retrieval function used by the AI engine
CREATE OR REPLACE FUNCTION public.match_psych_cases(_query text, _limit integer DEFAULT 4)
RETURNS TABLE(
  case_code text, category text, subcategory text, user_situation text,
  detected_signals text[], possible_patterns text[], severity_level integer,
  response_strategy text, follow_up_questions text[], avoid_saying text[],
  next_steps text[], escalation_criteria text, source text, confidence numeric,
  rank real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.case_code, c.category, c.subcategory, c.user_situation,
         c.detected_signals, c.possible_patterns, c.severity_level,
         c.response_strategy, c.follow_up_questions, c.avoid_saying,
         c.next_steps, c.escalation_criteria, c.source, c.confidence,
         ts_rank(
           to_tsvector('english', coalesce(c.search_text, '')),
           websearch_to_tsquery('english', _query)
         ) AS rank
  FROM public.psych_cases c
  WHERE c.enabled
    AND websearch_to_tsquery('english', _query) IS NOT NULL
    AND to_tsvector('english', coalesce(c.search_text, '')) @@ websearch_to_tsquery('english', _query)
  ORDER BY rank DESC, c.severity_level DESC
  LIMIT greatest(1, least(coalesce(_limit, 4), 10));
$$;

GRANT EXECUTE ON FUNCTION public.match_psych_cases(text, integer) TO authenticated, service_role;

-- ============ Assessments / emotional timeline ============

CREATE TABLE public.psych_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id uuid,
  emotion text,
  intensity integer,
  severity_level integer NOT NULL DEFAULT 1,
  patterns text[] NOT NULL DEFAULT '{}',
  matched_case_codes text[] NOT NULL DEFAULT '{}',
  context_summary text,
  strategy text,
  uncertainty numeric,
  escalation_triggered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT psych_assessments_severity_chk CHECK (severity_level BETWEEN 1 AND 4)
);

GRANT SELECT, INSERT ON public.psych_assessments TO authenticated;
GRANT ALL ON public.psych_assessments TO service_role;
ALTER TABLE public.psych_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own assessments" ON public.psych_assessments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users read own assessments" ON public.psych_assessments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all assessments" ON public.psych_assessments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX psych_assessments_user_idx ON public.psych_assessments (user_id, created_at DESC);
CREATE INDEX psych_assessments_conv_idx ON public.psych_assessments (conversation_id, created_at);

-- ============ Case simulations (admin sandbox) ============

CREATE TABLE public.psych_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  category text NOT NULL,
  severity_level integer NOT NULL DEFAULT 1,
  persona text,
  emotional_intensity integer NOT NULL DEFAULT 5,
  turns integer NOT NULL DEFAULT 3,
  scenario text,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  overall_score numeric,
  verdict text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT psych_simulations_severity_chk CHECK (severity_level BETWEEN 1 AND 4)
);

GRANT SELECT, INSERT ON public.psych_simulations TO authenticated;
GRANT ALL ON public.psych_simulations TO service_role;
ALTER TABLE public.psych_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read simulations" ON public.psych_simulations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert simulations" ON public.psych_simulations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());
