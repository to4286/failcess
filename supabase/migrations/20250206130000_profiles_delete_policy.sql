-- 회원 탈퇴: 본인 profiles row 삭제 허용
-- CASCADE는 posts, comments, likes, saves 등 FK에서 이미 설정되어 있다고 가정

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
CREATE POLICY "Users can delete own profile" ON profiles
  FOR DELETE
  USING (auth.uid() = id);
