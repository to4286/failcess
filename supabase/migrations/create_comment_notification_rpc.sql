-- 댓글 알림 생성 RPC (트리거 대체용 - 클라이언트에서 호출)
-- 트리거가 동작하지 않는 환경에서 알림 생성 보장

CREATE OR REPLACE FUNCTION create_comment_notification(
  p_post_id bigint,
  p_comment_content text,
  p_commenter_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id uuid;
  v_post_author_nickname text;
  v_commenter_nickname text;
  v_content text;
  v_preview text;
  v_rec record;
BEGIN
  -- 호출자가 댓글 작성자 본인인지 검증
  IF auth.uid() IS NULL OR auth.uid() != p_commenter_id THEN
    RAISE EXCEPTION 'Unauthorized: only the commenter can create notifications';
  END IF;

  -- 댓글 미리보기 (최대 50자)
  v_preview := LEFT(TRIM(p_comment_content), 50);
  IF LENGTH(TRIM(p_comment_content)) > 50 THEN
    v_preview := v_preview || '...';
  END IF;

  -- 게시물 작성자 정보
  SELECT p.author_id, COALESCE(pr.nickname, '익명')
  INTO v_post_author_id, v_post_author_nickname
  FROM posts p
  LEFT JOIN profiles pr ON pr.id = p.author_id
  WHERE p.id = p_post_id;

  -- 댓글 작성자 닉네임
  SELECT COALESCE(nickname, '익명') INTO v_commenter_nickname
  FROM profiles WHERE id = p_commenter_id;

  -- 1) 내 게시물 댓글: 게시물 작성자에게 알림
  IF v_post_author_id IS NOT NULL AND v_post_author_id != p_commenter_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM post_notification_settings
      WHERE user_id = v_post_author_id AND post_id = p_post_id AND is_subscribed = false
    ) THEN
      v_content := '내 게시물에 **' || v_commenter_nickname || '**님이 댓글을 남겼습니다: ' || v_preview;
      INSERT INTO notifications (user_id, sender_id, post_id, content)
      VALUES (v_post_author_id, p_commenter_id, p_post_id, v_content);
    END IF;
  END IF;

  -- 2) post_notification_settings 구독자에게 알림
  FOR v_rec IN
    SELECT pns.user_id
    FROM post_notification_settings pns
    WHERE pns.post_id = p_post_id
      AND pns.is_subscribed = true
      AND pns.user_id != p_commenter_id
      AND (v_post_author_id IS NULL OR pns.user_id != v_post_author_id)
  LOOP
    v_content := '**' || v_post_author_nickname || '**님의 게시물에 **' || v_commenter_nickname || '**님이 댓글을 남겼습니다: ' || v_preview;
    INSERT INTO notifications (user_id, sender_id, post_id, content)
    VALUES (v_rec.user_id, p_commenter_id, p_post_id, v_content);
  END LOOP;
END;
$$;

-- RPC 호출 시 호출자(p_commenter_id)가 auth.uid()와 일치해야 함
GRANT EXECUTE ON FUNCTION create_comment_notification(bigint, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_comment_notification(bigint, text, uuid) TO service_role;

COMMENT ON FUNCTION create_comment_notification(bigint, text, uuid) IS '댓글 작성 시 알림 생성 (클라이언트에서 호출)';
