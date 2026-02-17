-- notifications 테이블: INSERT는 RPC(create_comment_notification)를 통해서만 수행
-- 클라이언트 직접 INSERT 정책 제거 (보안 유지)
DROP POLICY IF EXISTS "Users can insert notifications where they are sender" ON notifications;
