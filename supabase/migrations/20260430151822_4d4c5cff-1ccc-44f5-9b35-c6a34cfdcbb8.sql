
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS profession TEXT,
  ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_age_check CHECK (age IS NULL OR (age >= 1 AND age <= 120)),
  ADD CONSTRAINT profiles_gender_check CHECK (gender IS NULL OR gender IN ('Male','Female','Prefer not to say','Other')),
  ADD CONSTRAINT profiles_profession_check CHECK (profession IS NULL OR profession IN ('Student','Working Professional','Homemaker','Freelancer','Unemployed','Retired','Other'));

CREATE OR REPLACE FUNCTION public.admin_demographics()
RETURNS TABLE(user_id uuid, display_name text, age integer, gender text, profession text, profile_completed_at timestamp with time zone, created_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.display_name, p.age, p.gender, p.profession, p.profile_completed_at, p.created_at
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY p.profile_completed_at DESC NULLS LAST;
$$;
