-- ============================================================
-- 알림 미동작 원인 진단 스크립트
-- Supabase Dashboard > SQL Editor에서 복사해 실행 후 결과 확인
-- ============================================================

-- 1) posts.id 타입 확인 (bigint여야 함, uuid면 알림 로직이 동작 안 함)
SELECT 
  'posts.id 타입' AS check_item,
  data_type AS result
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'id';

-- 2) comments.post_id 타입 확인
SELECT 
  'comments.post_id 타입' AS check_item,
  data_type AS result
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'comments' AND column_name = 'post_id';

-- 3) create_comment_notification 함수 시그니처 (bigint vs text 확인)
SELECT 
  'RPC 함수 파라미터' AS check_item,
  pg_get_function_arguments(oid) AS result
FROM pg_proc 
WHERE proname = 'create_comment_notification';

-- 4) 트리거 존재 여부 (있으면 댓글 INSERT 시 자동 알림 생성)
SELECT 
  '트리거 존재' AS check_item,
  CASE WHEN COUNT(*) > 0 THEN '있음' ELSE '없음' END AS result
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'comments' AND t.tgname = 'trigger_create_comment_notifications';

-- 5) notifications 테이블 RLS 정책 (INSERT 정책이 없어야 RPC만 삽입 가능)
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'notifications';
