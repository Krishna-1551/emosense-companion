
DROP POLICY IF EXISTS "Users respond to own pending" ON public.connect_requests;

CREATE POLICY "Users respond to own pending"
ON public.connect_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status IN ('accepted','declined','ended'));
