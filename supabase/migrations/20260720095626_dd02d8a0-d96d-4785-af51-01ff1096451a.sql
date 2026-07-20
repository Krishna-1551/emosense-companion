
-- Evolution Recommendations
CREATE TABLE public.evolution_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  problem text,
  proposed_solution text,
  benefits text,
  category text NOT NULL DEFAULT 'general',
  area text NOT NULL DEFAULT 'reply_quality',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('small','medium','large')),
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  time_estimate text,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  implementation_plan text,
  metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'detector' CHECK (source IN ('detector','research','advisor','manual')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','archived','implemented')),
  decision_notes text,
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_evo_rec_status ON public.evolution_recommendations(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evolution_recommendations TO authenticated;
GRANT ALL ON public.evolution_recommendations TO service_role;
ALTER TABLE public.evolution_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read recs" ON public.evolution_recommendations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins insert recs" ON public.evolution_recommendations
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update recs" ON public.evolution_recommendations
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete recs" ON public.evolution_recommendations
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_evo_rec_updated BEFORE UPDATE ON public.evolution_recommendations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Decision audit log (append-only)
CREATE TABLE public.evolution_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES public.evolution_recommendations(id) ON DELETE CASCADE,
  prior_status text NOT NULL,
  new_status text NOT NULL,
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_evo_dec_rec ON public.evolution_decisions(recommendation_id, created_at DESC);

GRANT SELECT, INSERT ON public.evolution_decisions TO authenticated;
GRANT ALL ON public.evolution_decisions TO service_role;
ALTER TABLE public.evolution_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read decisions" ON public.evolution_decisions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins insert decisions" ON public.evolution_decisions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Hourly observation rollups
CREATE TABLE public.evolution_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_start timestamptz NOT NULL,
  active_users int NOT NULL DEFAULT 0,
  message_count int NOT NULL DEFAULT 0,
  ai_reply_count int NOT NULL DEFAULT 0,
  avg_repetition numeric(6,4) NOT NULL DEFAULT 0,
  avg_questions numeric(6,3) NOT NULL DEFAULT 0,
  solution_mode_pct numeric(6,2) NOT NULL DEFAULT 0,
  high_risk_count int NOT NULL DEFAULT 0,
  emotion_distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  language_distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  extras jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_start)
);
CREATE INDEX idx_evo_obs_time ON public.evolution_observations(bucket_start DESC);

GRANT SELECT ON public.evolution_observations TO authenticated;
GRANT ALL ON public.evolution_observations TO service_role;
ALTER TABLE public.evolution_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read obs" ON public.evolution_observations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Daily health snapshots
CREATE TABLE public.evolution_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL UNIQUE,
  health_score int NOT NULL DEFAULT 0,
  evolution_score int NOT NULL DEFAULT 0,
  kpis jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.evolution_health_snapshots TO authenticated;
GRANT ALL ON public.evolution_health_snapshots TO service_role;
ALTER TABLE public.evolution_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read health" ON public.evolution_health_snapshots
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
