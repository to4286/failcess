-- 댓글 알림 트리거: 기획 로직 최적화
-- - 알림 대상: 게시물 작성자, 알림 구독자 (댓글 작성자 제외)
-- - DB에서 내용 자르지 않음: 댓글 전문 저장, UI에서 line-clamp로 2줄 제한
-- - SECURITY DEFINER, SET search_path = public

CREATE OR REPLACE FUNCTION create_comment_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id uuid;
  v_post_author_nickname text;
  v_commenter_nickname text;
  v_message text;
  v_comment_content text;
  v_rec record;
BEGIN
  -- 댓글 전문 저장 (DB에서 자르지 않음, UI에서 line-clamp로 처리)
  v_comment_content := TRIM(NEW.content);

  SELECT p.author_id, COALESCE(pr.nickname, '익명')
  INTO v_post_author_id, v_post_author_nickname
  FROM posts p
  LEFT JOIN profiles pr ON pr.id = p.author_id
  WHERE p.id = NEW.post_id;

  SELECT COALESCE(nickname, '익명') INTO v_commenter_nickname
  FROM profiles WHERE id = NEW.author_id;

  -- 1) 게시물 작성자: 본인 글에 타인이 댓글 시 알림 (본인 댓글 제외, is_subscribed=false가 아닐 때)
  IF v_post_author_id IS NOT NULL AND v_post_author_id != NEW.author_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM post_notification_settings
      WHERE user_id = v_post_author_id AND post_id = NEW.post_id AND is_subscribed = false
    ) THEN
      v_message := '내 게시물에 **' || v_commenter_nickname || '**님이 댓글을 남겼습니다: ' || v_comment_content;
      INSERT INTO notifications (user_id, sender_id, post_id, content, type)
      VALUES (v_post_author_id, NEW.author_id, NEW.post_id, v_message, 'comment');
    END IF;
  END IF;

  -- 2) 알림 구독자: is_subscribed=true인 유저 (댓글 작성자 제외, 게시물 작성자 중복 제외)
  FOR v_rec IN
    SELECT pns.user_id
    FROM post_notification_settings pns
    WHERE pns.post_id = NEW.post_id
      AND pns.is_subscribed = true
      AND pns.user_id != NEW.author_id
      AND (v_post_author_id IS NULL OR pns.user_id != v_post_author_id)
  LOOP
    v_message := '**' || v_post_author_nickname || '**님의 게시물에 **' || v_commenter_nickname || '**님이 댓글을 남겼습니다: ' || v_comment_content;
    INSERT INTO notifications (user_id, sender_id, post_id, content, type)
    VALUES (v_rec.user_id, NEW.author_id, NEW.post_id, v_message, 'comment');
  END LOOP;

  RETURN NEW;
END;
$$;

-- 트리거 재생성 (비활성화된 경우 대비)
DROP TRIGGER IF EXISTS trigger_create_comment_notifications ON comments;
CREATE TRIGGER trigger_create_comment_notifications
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_notifications();
