-- RPC: Check if an email is already registered (for signup duplicate check).
-- Uses auth.users; must be SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.check_email_exists(check_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = check_email);
$$;
