-- 게시물 이미지용 post-images 버킷 생성 (public)
-- 글쓰기 화면에서 이미지 업로드 시 "new row violates row-level security policy" 에러 방지
-- Supabase Dashboard > Storage에서 수동 생성 시: 버킷 이름 'post-images', Public 체크 필수

INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 업로드 정책: 로그인한 사용자가 post-images 버킷에 업로드 가능
DROP POLICY IF EXISTS "Authenticated users can upload post images" ON storage.objects;
CREATE POLICY "Authenticated users can upload post images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post-images');

-- 공개 읽기: public 버킷이므로 모든 사용자가 읽기 가능
DROP POLICY IF EXISTS "Post images are publicly accessible" ON storage.objects;
CREATE POLICY "Post images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post-images');
