
-- 1. Connect requests table
CREATE TABLE public.connect_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  user_id uuid NOT NULL,
  flagged_message_id uuid,
  flagged_message_excerpt text,
  flagged_at timestamptz,
  risk_level text,
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | declined | ended
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
CREATE INDEX idx_connect_requests_user ON public.connect_requests(user_id, status);
CREATE INDEX idx_connect_requests_admin ON public.connect_requests(admin_id, status);

ALTER TABLE public.connect_requests ENABLE ROW LEVEL SECURITY;

-- Admins can see and create requests they own
CREATE POLICY "Admins view own requests" ON public.connect_requests
  FOR SELECT USING (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());
CREATE POLICY "Admins create requests" ON public.connect_requests
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());
CREATE POLICY "Admins end own requests" ON public.connect_requests
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());

-- Users see and respond to requests addressed to them
CREATE POLICY "Users view own requests" ON public.connect_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users respond to own pending" ON public.connect_requests
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- 2. Support messages table
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.connect_requests(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('admin','user')),
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_messages_req ON public.support_messages(request_id, created_at);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- View: only the admin or user of an ACCEPTED request
CREATE POLICY "Participants view support msgs" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.connect_requests cr
      WHERE cr.id = support_messages.request_id
        AND cr.status = 'accepted'
        AND (cr.admin_id = auth.uid() OR cr.user_id = auth.uid())
    )
  );

-- Insert: sender must match their role and be a participant of an accepted request
CREATE POLICY "Participants send support msgs" ON public.support_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.connect_requests cr
      WHERE cr.id = support_messages.request_id
        AND cr.status = 'accepted'
        AND (
          (sender_role = 'admin' AND cr.admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'))
          OR (sender_role = 'user'  AND cr.user_id  = auth.uid())
        )
    )
  );

-- 3. Privacy-safe high-risk feed (no full chat)
CREATE OR REPLACE FUNCTION public.admin_high_risk_cases(limit_n integer DEFAULT 50)
RETURNS TABLE(
  message_id uuid,
  user_id uuid,
  display_name text,
  age integer,
  gender text,
  profession text,
  risk_level text,
  emotion text,
  flagged_excerpt text,
  created_at timestamptz,
  pending_request_id uuid,
  active_request_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    m.id,
    m.user_id,
    p.display_name,
    p.age,
    p.gender,
    p.profession,
    m.risk_level,
    m.emotion,
    -- Only a short, redacted excerpt — not the full message history
    left(m.content, 240) AS flagged_excerpt,
    m.created_at,
    (SELECT cr.id FROM public.connect_requests cr
       WHERE cr.flagged_message_id = m.id AND cr.admin_id = auth.uid() AND cr.status = 'pending'
       LIMIT 1),
    (SELECT cr.id FROM public.connect_requests cr
       WHERE cr.flagged_message_id = m.id AND cr.admin_id = auth.uid() AND cr.status = 'accepted'
       LIMIT 1)
  FROM public.messages m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.risk_level = 'high'
    AND m.role = 'user'
    AND public.has_role(auth.uid(), 'admin')
  ORDER BY m.created_at DESC
  LIMIT limit_n;
$$;

-- 4. Helper to safely create a connect request from a flagged message
CREATE OR REPLACE FUNCTION public.admin_request_connect(_message_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _msg record;
  _req_id uuid;
  _existing uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT id, user_id, content, risk_level, created_at
  INTO _msg FROM public.messages WHERE id = _message_id;

  IF _msg.id IS NULL THEN
    RAISE EXCEPTION 'message not found';
  END IF;

  -- Reuse an existing pending or accepted request from this admin for this message
  SELECT id INTO _existing FROM public.connect_requests
  WHERE flagged_message_id = _message_id
    AND admin_id = auth.uid()
    AND status IN ('pending','accepted')
  LIMIT 1;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  INSERT INTO public.connect_requests
    (admin_id, user_id, flagged_message_id, flagged_message_excerpt, flagged_at, risk_level, status)
  VALUES
    (auth.uid(), _msg.user_id, _msg.id, left(_msg.content, 240), _msg.created_at, _msg.risk_level, 'pending')
  RETURNING id INTO _req_id;

  RETURN _req_id;
END;
$$;

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.connect_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
