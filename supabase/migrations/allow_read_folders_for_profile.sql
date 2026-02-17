-- 타인 프로필 페이지에서 해당 유저의 폴더 목록을 보여주기 위해
-- 폴더 테이블 SELECT를 모든 사용자 허용 (폴더 이름/목록은 공개)
DROP POLICY IF EXISTS "Users can view their own folders" ON folders;
CREATE POLICY "Anyone can view folders (for profile)" ON folders
  FOR SELECT
  USING (true);
