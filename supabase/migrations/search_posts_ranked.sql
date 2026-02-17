-- 검색 결과를 정확도 기반으로 랭킹하는 RPC 함수
-- keyword는 클라이언트에서 ILIKE 이스케이프 처리됨 (%, _, \ 리터럴 매칭)
-- 조건: 제목 OR 본문 OR 카테고리 중 검색어 포함 시만 노출
-- 가중치: Title (+100), Content (+10), Category (+10). 동점: view_count DESC, RANDOM()

CREATE OR REPLACE FUNCTION search_posts_ranked(keyword text)
RETURNS SETOF posts AS $$
  SELECT *
  FROM posts
  WHERE
    title ILIKE '%' || keyword || '%' OR
    content ILIKE '%' || keyword || '%' OR
    (
      categories IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM unnest(COALESCE(categories, ARRAY[]::text[])) AS c
        WHERE c ILIKE '%' || keyword || '%'
      )
    )
  ORDER BY
    (
      CASE WHEN title ILIKE '%' || keyword || '%' THEN 100 ELSE 0 END +
      CASE WHEN content ILIKE '%' || keyword || '%' THEN 10 ELSE 0 END +
      CASE WHEN (
        categories IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM unnest(COALESCE(categories, ARRAY[]::text[])) AS c
          WHERE c ILIKE '%' || keyword || '%'
        )
      ) THEN 10 ELSE 0 END
    ) DESC,
    view_count DESC,
    RANDOM();
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION search_posts_ranked(text) IS
'검색어를 입력받아 게시물을 정확도 기반으로 랭킹. 제목/본문/카테고리 포함 시만 노출. 가중치: 제목(100), 본문(10), 카테고리(10).'; 