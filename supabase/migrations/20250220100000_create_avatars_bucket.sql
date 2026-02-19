-- 프로필 사진용 avatars 버킷 생성 (public)
-- 404 NOT_FOUND 방지: 버킷이 없거나 private이면 getPublicUrl로 접근 시 404 발생
-- Supabase Dashboard > Storage에서 수동 생성 시: 버킷 이름 'avatars', Public 체크 필수

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 업로드 정책: 로그인한 사용자가 자신의 폴더(user_id)에만 업로드 가능
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 공개 읽기: public 버킷이므로 모든 사용자가 읽기 가능
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
