-- 알림 시스템: notifications, post_notification_settings 테이블

-- 1. post_notification_settings: 유저가 특정 게시물의 댓글 알림을 받기로 한 설정
-- post_id: posts.id 타입에 맞춤 (bigint, Supabase 기본)
CREATE TABLE IF NOT EXISTS post_notification_settings (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  is_subscribed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_post_notification_settings_user_id ON post_notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_post_notification_settings_post_id ON post_notification_settings(post_id);

ALTER TABLE post_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own post notification settings" ON post_notification_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own post notification settings" ON post_notification_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own post notification settings" ON post_notification_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own post notification settings" ON post_notification_settings
  FOR DELETE USING (auth.uid() = user_id);

-- 2. notifications: 알림 레코드
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications (is_read)" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- INSERT는 RPC(create_comment_notification)를 통해서만 수행 (SECURITY DEFINER로 RLS 우회)
-- 클라이언트 직접 INSERT 정책 없음 (보안 유지)

-- 서비스 역할로 알림 생성 (트리거/RPC에서 사용)
-- RLS 정책: INSERT는 트리거/서비스에서 수행하므로, authenticated 사용자가 본인 알림만 조회/업데이트

-- 3. 댓글 INSERT 시 알림 생성 트리거 함수
CREATE OR REPLACE FUNCTION create_comment_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_post_author_id uuid;
  v_post_author_nickname text;
  v_commenter_nickname text;
  v_message text;
  v_preview text;
  v_rec record;
BEGIN
  -- 댓글 미리보기 (길면 ... 처리, 최대 50자)
  v_preview := LEFT(TRIM(NEW.content), 50);
  IF LENGTH(TRIM(NEW.content)) > 50 THEN
    v_preview := v_preview || '...';
  END IF;

  -- 게시물 작성자 정보
  SELECT p.author_id, COALESCE(pr.nickname, '익명')
  INTO v_post_author_id, v_post_author_nickname
  FROM posts p
  LEFT JOIN profiles pr ON pr.id = p.author_id
  WHERE p.id = NEW.post_id;

  -- 댓글 작성자 닉네임
  SELECT COALESCE(nickname, '익명') INTO v_commenter_nickname
  FROM profiles WHERE id = NEW.author_id;

  -- 1) 내 게시물 댓글: 게시물 작성자에게 알림 (댓글 작성자가 본인이 아닐 때, is_subscribed가 false가 아닐 때)
  IF v_post_author_id IS NOT NULL AND v_post_author_id != NEW.author_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM post_notification_settings
      WHERE user_id = v_post_author_id AND post_id = NEW.post_id AND is_subscribed = false
    ) THEN
      v_message := '내 게시물에 **' || v_commenter_nickname || '**님이 댓글을 남겼습니다: ' || v_preview;
    INSERT INTO notifications (user_id, sender_id, post_id, content)
    VALUES (v_post_author_id, NEW.author_id, NEW.post_id, v_message);
    END IF;
  END IF;

  -- 2) post_notification_settings 구독자에게 알림 (is_subscribed=true, 댓글 작성자 제외)
  FOR v_rec IN
    SELECT pns.user_id
    FROM post_notification_settings pns
    WHERE pns.post_id = NEW.post_id
      AND pns.is_subscribed = true
      AND pns.user_id != NEW.author_id
      AND (v_post_author_id IS NULL OR pns.user_id != v_post_author_id)  -- 게시물 작성자는 위에서 이미 처리
  LOOP
    v_message := '**' || v_post_author_nickname || '**님의 게시물에 **' || v_commenter_nickname || '**님이 댓글을 남겼습니다: ' || v_preview;
    INSERT INTO notifications (user_id, sender_id, post_id, content)
    VALUES (v_rec.user_id, NEW.author_id, NEW.post_id, v_message);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거: comments INSERT 후
DROP TRIGGER IF EXISTS trigger_create_comment_notifications ON comments;
CREATE TRIGGER trigger_create_comment_notifications
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_notifications();

-- notifications INSERT 시 RLS 우회 (트리거에서 INSERT)
-- SECURITY DEFINER 함수가 INSERT하므로, 함수 내부에서는 RLS가 적용되지 않음 (함수 소유자가 bypass)

-- Realtime 구독을 위해 notifications 테이블을 publication에 추가
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

COMMENT ON TABLE notifications IS '알림 (수신자, 발신자, 게시물, content=알림내용, 읽음 여부)';
COMMENT ON TABLE post_notification_settings IS '게시물별 댓글 알림 수신 설정';
