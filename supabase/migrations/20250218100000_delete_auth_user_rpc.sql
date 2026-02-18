-- auth.users 직접 삭제 RPC (deleteUser API FK 이슈 회피)
-- service_role만 호출 가능. Edge Function에서 public 데이터 삭제 후 호출

CREATE OR REPLACE FUNCTION public.delete_auth_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.delete_auth_user(uuid) IS 'auth.users 직접 삭제 (service_role 전용)';
REVOKE ALL ON FUNCTION public.delete_auth_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_auth_user(uuid) TO service_role;
