-- 회원 탈퇴: profiles DELETE 정책 적용
-- Supabase 대시보드 SQL Editor에서 실행

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
CREATE POLICY "Users can delete own profile" ON profiles
  FOR DELETE
  USING (auth.uid() = id);
