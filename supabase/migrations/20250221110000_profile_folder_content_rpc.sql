-- 타 유저 프로필: 해당 유저가 저장한 게시물 조회 (RLS 우회)
CREATE OR REPLACE FUNCTION get_profile_user_saved_posts(p_user_id uuid)
RETURNS TABLE (
  post_id bigint,
  folder_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.post_id, s.folder_id, s.created_at
  FROM saves s
  WHERE s.user_id = p_user_id
    AND s.folder_id IS NOT NULL
  ORDER BY s.created_at DESC;
$$;

COMMENT ON FUNCTION get_profile_user_saved_posts(uuid) IS
'타 유저 프로필: 해당 유저가 폴더에 저장한 게시물 목록 (folder_id 포함)';

GRANT EXECUTE ON FUNCTION get_profile_user_saved_posts(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_profile_user_saved_posts(uuid) TO authenticated;

-- 타 유저 프로필: 폴더별 전체 개수 (작성글 + 저장글)
CREATE OR REPLACE FUNCTION get_profile_folder_total_counts(p_user_id uuid)
RETURNS TABLE(folder_id uuid, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH post_counts AS (
    SELECT folder_id, count(*)::bigint AS cnt
    FROM posts
    WHERE author_id = p_user_id
      AND folder_id IS NOT NULL
    GROUP BY folder_id
  ),
  save_counts AS (
    SELECT folder_id, count(*)::bigint AS cnt
    FROM saves
    WHERE user_id = p_user_id
      AND folder_id IS NOT NULL
    GROUP BY folder_id
  )
  SELECT COALESCE(p.folder_id, s.folder_id) AS folder_id,
         COALESCE(p.cnt, 0) + COALESCE(s.cnt, 0) AS total_count
  FROM post_counts p
  FULL OUTER JOIN save_counts s ON p.folder_id = s.folder_id;
$$;

COMMENT ON FUNCTION get_profile_folder_total_counts(uuid) IS
'타 유저 프로필: 폴더별 전체 개수 (작성글 + 저장글)';

GRANT EXECUTE ON FUNCTION get_profile_folder_total_counts(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_profile_folder_total_counts(uuid) TO authenticated;
