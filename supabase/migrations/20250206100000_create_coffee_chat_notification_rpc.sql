-- 커피챗 알림 생성 RPC
-- coffee_request: 요청 수신자에게 알림
-- coffee_accept: 요청 발신자에게 알림

-- post_id nullable 허용 (커피챗 알림은 게시물과 무관)
ALTER TABLE notifications
  ALTER COLUMN post_id DROP NOT NULL;

-- 기존 FK 제약이 있으면, NULL 허용만으로 충분 (REFERENCES는 유지)

CREATE OR REPLACE FUNCTION create_coffee_chat_notification(
  p_receiver_id uuid,
  p_sender_id uuid,
  p_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content text;
  v_sender_nickname text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_sender_id THEN
    RAISE EXCEPTION 'Unauthorized: only the sender can create this notification';
  END IF;

  IF p_type NOT IN ('coffee_request', 'coffee_accept') THEN
    RAISE EXCEPTION 'Invalid type: %', p_type;
  END IF;

  SELECT COALESCE(nickname, '익명') INTO v_sender_nickname
  FROM profiles WHERE id = p_sender_id;

  IF p_type = 'coffee_request' THEN
    v_content := '**' || v_sender_nickname || '**님이 커피챗을 요청했습니다.';
  ELSIF p_type = 'coffee_accept' THEN
    v_content := '**' || v_sender_nickname || '**님이 커피챗 요청을 수락했습니다.';
  END IF;

  INSERT INTO notifications (user_id, sender_id, post_id, content, type)
  VALUES (p_receiver_id, p_sender_id, NULL, v_content, p_type);
END;
$$;

GRANT EXECUTE ON FUNCTION create_coffee_chat_notification(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_coffee_chat_notification(uuid, uuid, text) TO service_role;
