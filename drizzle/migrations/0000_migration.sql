CREATE TABLE public.allowed_users (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.allowed_users TO authenticated;
GRANT ALL ON public.allowed_users TO service_role;
ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own allowlist row" ON public.allowed_users FOR SELECT TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));
INSERT INTO public.allowed_users (email) VALUES ('zaidameen116@gmail.com');

CREATE OR REPLACE FUNCTION public.is_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT exists (SELECT 1 FROM public.allowed_users WHERE lower(email) = lower(auth.jwt() ->> 'email'))
$$;
GRANT EXECUTE ON FUNCTION public.is_allowed() TO authenticated;