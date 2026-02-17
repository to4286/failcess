-- 커피챗 알림 RPC 수동 적용 스크립트
-- Supabase Dashboard > SQL Editor에서 이 스크립트를 실행하세요.
-- 404 에러가 발생한다면 이 RPC가 DB에 없으므로 아래를 실행해주세요.

-- 1. post_id nullable 허용 (커피챗 알림은 게시물과 무관)
ALTER TABLE notifications
  ALTER COLUMN post_id DROP NOT NULL;

-- 2. RPC 함수 생성
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
