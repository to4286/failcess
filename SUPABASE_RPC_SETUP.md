# Supabase RPC 함수 설정 가이드

## 검색 랭킹 함수 배포

이 프로젝트는 정확도 기반 검색 랭킹 시스템을 사용합니다. Supabase 대시보드에서 다음 SQL 함수를 실행하세요.

### 1. `search_posts_ranked` 함수 생성

Supabase 대시보드 → SQL Editor에서 다음 SQL을 실행하세요:

```sql
CREATE OR REPLACE FUNCTION search_posts_ranked(keyword text)
RETURNS SETOF posts AS $$
  SELECT *
  FROM posts
  WHERE
    title ILIKE '%' || keyword || '%' OR
    category ILIKE '%' || keyword || '%' OR
    content ILIKE '%' || keyword || '%'
  ORDER BY
    (
      CASE WHEN title ILIKE '%' || keyword || '%' THEN 100 ELSE 0 END +
      CASE WHEN category ILIKE '%' || keyword || '%' THEN 50 ELSE 0 END +
      CASE WHEN content ILIKE '%' || keyword || '%' THEN 10 ELSE 0 END
    ) DESC,
    view_count DESC,
    RANDOM();
$$ LANGUAGE sql STABLE;
```

### 2. 랭킹 알고리즘 설명

#### 가중치 스코어링
- **제목 (Title)**: 검색어가 제목에 포함되면 **+100점**
- **카테고리 (Category)**: 검색어가 카테고리에 포함되면 **+50점**
- **본문 (Content)**: 검색어가 본문에 포함되면 **+10점**

#### 동점자 처리 (Tie-Breakers)
1. 점수가 같으면 **조회수(`view_count`) 내림차순**으로 정렬
2. 조회수까지 같으면 **랜덤(`RANDOM()`)으로 정렬**

### 3. 함수 사용법

프론트엔드에서 다음과 같이 호출합니다:

```typescript
const { data, error } = await supabase
  .rpc('search_posts_ranked', { keyword: '검색어' });
```

### 4. 주의사항

- 함수는 `STABLE`로 선언되어 있어 쿼리 최적화에 유리합니다.
- `ILIKE` 연산자를 사용하여 대소문자 구분 없이 검색합니다.
- 검색어가 빈 문자열이면 모든 게시물이 반환될 수 있으므로, 프론트엔드에서 검증하세요.

### 5. 성능 최적화 팁

대량의 데이터가 있는 경우, 다음 인덱스를 추가하는 것을 권장합니다:

```sql
-- 제목 검색 최적화
CREATE INDEX IF NOT EXISTS idx_posts_title_gin ON posts USING gin(title gin_trgm_ops);

-- 카테고리 검색 최적화
CREATE INDEX IF NOT EXISTS idx_posts_category_gin ON posts USING gin(category gin_trgm_ops);

-- 본문 검색 최적화 (선택사항, 용량이 클 수 있음)
CREATE INDEX IF NOT EXISTS idx_posts_content_gin ON posts USING gin(content gin_trgm_ops);
```

> **참고**: `pg_trgm` 확장이 활성화되어 있어야 합니다. Supabase에서는 기본적으로 활성화되어 있습니다.
