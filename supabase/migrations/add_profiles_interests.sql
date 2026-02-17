-- profiles 테이블에 관심사(interests) 컬럼 추가 (JSONB 배열)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS interests jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN profiles.interests IS '관심사 태그 배열 (최대 5개, INTEREST_TAGS 내 값)';
