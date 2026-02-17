-- 유저 검색: 닉네임 또는 직업에 검색어가 **리터럴로** 포함된 경우만 반환
-- PostgREST .or() 필터는 * 등을 와일드카드로 해석할 수 있으므로, 검색은 DB RPC에서만 수행

CREATE OR REPLACE FUNCTION search_profiles_by_keyword(keyword text)
RETURNS SETOF profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  escaped text;
BEGIN
  -- ILIKE 와일드카드 이스케이프: %, _, \ 를 리터럴로 매칭
  escaped := keyword;
  escaped := replace(escaped, E'\\', E'\\\\');
  escaped := replace(escaped, '%', E'\\%');
  escaped := replace(escaped, '_', E'\\_');

  RETURN QUERY
  SELECT *
  FROM profiles
  WHERE nickname ILIKE '%' || escaped || '%' ESCAPE E'\\'
     OR job_title ILIKE '%' || escaped || '%' ESCAPE E'\\';
END;
$$;

COMMENT ON FUNCTION search_profiles_by_keyword(text) IS
'검색어가 닉네임 또는 직업에 리터럴로 포함된 프로필만 반환. *, % 등 특수문자도 문자 그대로 매칭.';

GRANT EXECUTE ON FUNCTION search_profiles_by_keyword(text) TO anon;
GRANT EXECUTE ON FUNCTION search_profiles_by_keyword(text) TO authenticated;
