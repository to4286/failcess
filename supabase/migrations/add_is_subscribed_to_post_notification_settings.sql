-- post_notification_settings에 is_subscribed 컬럼 추가
-- true: 알림 수신, false: 알림 미수신

ALTER TABLE post_notification_settings
  ADD COLUMN IF NOT EXISTS is_subscribed boolean NOT NULL DEFAULT true;

-- UPDATE 정책 추가 (본인 설정만 수정 가능)
DROP POLICY IF EXISTS "Users can update own post notification settings" ON post_notification_settings;
CREATE POLICY "Users can update own post notification settings" ON post_notification_settings
  FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON COLUMN post_notification_settings.is_subscribed IS '댓글 알림 수신 여부 (true: 수신, false: 미수신)';

-- 트리거 함수 업데이트: is_subscribed=true인 경우에만 알림 생성
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
  v_preview := LEFT(TRIM(NEW.content), 50);
  IF LENGTH(TRIM(NEW.content)) > 50 THEN
    v_preview := v_preview || '...';
  END IF;

  SELECT p.author_id, COALESCE(pr.nickname, '익명')
  INTO v_post_author_id, v_post_author_nickname
  FROM posts p
  LEFT JOIN profiles pr ON pr.id = p.author_id
  WHERE p.id = NEW.post_id;

  SELECT COALESCE(nickname, '익명') INTO v_commenter_nickname
  FROM profiles WHERE id = NEW.author_id;

  -- 1) 내 게시물 댓글: 게시물 작성자에게 알림 (is_subscribed가 false가 아닐 때만)
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

  -- 2) post_notification_settings 구독자 (is_subscribed=true)에게만 알림
  FOR v_rec IN
    SELECT pns.user_id
    FROM post_notification_settings pns
    WHERE pns.post_id = NEW.post_id
      AND pns.is_subscribed = true
      AND pns.user_id != NEW.author_id
      AND (v_post_author_id IS NULL OR pns.user_id != v_post_author_id)
  LOOP
    v_message := '**' || v_post_author_nickname || '**님의 게시물에 **' || v_commenter_nickname || '**님이 댓글을 남겼습니다: ' || v_preview;
    INSERT INTO notifications (user_id, sender_id, post_id, content)
    VALUES (v_rec.user_id, NEW.author_id, NEW.post_id, v_message);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
