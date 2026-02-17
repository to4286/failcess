-- 타인 프로필에서 해당 유저의 폴더 목록을 보여주기 위한 RPC
-- RLS를 바꾸지 않고, SECURITY DEFINER로 해당 user_id의 폴더만 반환
CREATE OR REPLACE FUNCTION get_folders_by_user(p_user_id uuid)
RETURNS SETOF folders
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM folders WHERE user_id = p_user_id ORDER BY name;
$$;

COMMENT ON FUNCTION get_folders_by_user(uuid) IS
'프로필 페이지에서 해당 유저의 폴더 목록을 조회할 때 사용. RLS 우회 없이 해당 유저 폴더만 반환.';

-- anon/authenticated 역할이 API로 이 함수를 호출할 수 있도록 권한 부여
GRANT EXECUTE ON FUNCTION get_folders_by_user(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_folders_by_user(uuid) TO authenticated;
