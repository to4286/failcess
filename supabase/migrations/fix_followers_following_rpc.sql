-- 기존 함수 삭제
DROP FUNCTION IF EXISTS get_followers_with_status;
DROP FUNCTION IF EXISTS get_following_with_status;

-- 팔로워 목록 조회 함수 (더미 데이터 포함)
CREATE OR REPLACE FUNCTION get_followers_with_status(
  target_user_id UUID,
  current_viewer_id UUID
)
RETURNS TABLE (
  id UUID,
  nickname TEXT,
  avatar_url TEXT,
  bio TEXT,
  job_title TEXT,
  job TEXT,
  is_following BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  follower_count INTEGER;
BEGIN
  -- 실제 팔로워 수 확인
  SELECT COUNT(*) INTO follower_count
  FROM follows
  WHERE following_id = target_user_id;

  -- 팔로워가 3명 미만이면 더미 데이터 생성
  IF follower_count < 3 THEN
    -- 더미 데이터 3개 반환
    RETURN QUERY
    SELECT
      gen_random_uuid() as id,
      '더미 사용자 ' || generate_series(1, 3)::TEXT as nickname,
      '' as avatar_url,
      '더미 사용자입니다.' as bio,
      CASE generate_series(1, 3)
        WHEN 1 THEN 'Product Manager'
        WHEN 2 THEN 'Software Engineer'
        WHEN 3 THEN 'Designer'
      END as job_title,
      CASE generate_series(1, 3)
        WHEN 1 THEN 'Product Manager'
        WHEN 2 THEN 'Software Engineer'
        WHEN 3 THEN 'Designer'
      END as job,
      CASE generate_series(1, 3)
        WHEN 1 THEN true
        WHEN 2 THEN false
        WHEN 3 THEN true
      END as is_following;
  ELSE
    -- 실제 팔로워 데이터 반환
    RETURN QUERY
    SELECT
      p.id,
      COALESCE(p.nickname, 'Unknown') as nickname,
      COALESCE(p.avatar_url, '') as avatar_url,
      COALESCE(p.bio, '') as bio,
      COALESCE(p.job_title, '') as job_title,
      COALESCE(p.job_title, '') as job,
      EXISTS(
        SELECT 1
        FROM follows f
        WHERE f.follower_id = current_viewer_id
        AND f.following_id = p.id
      ) as is_following
    FROM follows f
    INNER JOIN profiles p ON p.id = f.follower_id
    WHERE f.following_id = target_user_id
    ORDER BY f.created_at DESC
    LIMIT 50;
  END IF;
END;
$$;

-- 팔로잉 목록 조회 함수 (더미 데이터 포함)
CREATE OR REPLACE FUNCTION get_following_with_status(
  target_user_id UUID,
  current_viewer_id UUID
)
RETURNS TABLE (
  id UUID,
  nickname TEXT,
  avatar_url TEXT,
  bio TEXT,
  job_title TEXT,
  job TEXT,
  is_following BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  following_count INTEGER;
BEGIN
  -- 실제 팔로잉 수 확인
  SELECT COUNT(*) INTO following_count
  FROM follows
  WHERE follower_id = target_user_id;

  -- 팔로잉이 3명 미만이면 더미 데이터 생성
  IF following_count < 3 THEN
    -- 더미 데이터 3개 반환
    RETURN QUERY
    SELECT
      gen_random_uuid() as id,
      '더미 사용자 ' || generate_series(1, 3)::TEXT as nickname,
      '' as avatar_url,
      '더미 사용자입니다.' as bio,
      CASE generate_series(1, 3)
        WHEN 1 THEN 'Product Manager'
        WHEN 2 THEN 'Software Engineer'
        WHEN 3 THEN 'Designer'
      END as job_title,
      CASE generate_series(1, 3)
        WHEN 1 THEN 'Product Manager'
        WHEN 2 THEN 'Software Engineer'
        WHEN 3 THEN 'Designer'
      END as job,
      true as is_following; -- 팔로잉 목록이므로 항상 true
  ELSE
    -- 실제 팔로잉 데이터 반환
    RETURN QUERY
    SELECT
      p.id,
      COALESCE(p.nickname, 'Unknown') as nickname,
      COALESCE(p.avatar_url, '') as avatar_url,
      COALESCE(p.bio, '') as bio,
      COALESCE(p.job_title, '') as job_title,
      COALESCE(p.job_title, '') as job,
      true as is_following -- 팔로잉 목록이므로 항상 true
    FROM follows f
    INNER JOIN profiles p ON p.id = f.following_id
    WHERE f.follower_id = target_user_id
    ORDER BY f.created_at DESC
    LIMIT 50;
  END IF;
END;
$$;
