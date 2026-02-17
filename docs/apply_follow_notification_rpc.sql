  -- 팔로우 알림 RPC 수동 적용 스크립트
  -- Supabase Dashboard > SQL Editor에서 실행하세요.

  CREATE OR REPLACE FUNCTION create_follow_notification(
    p_receiver_id uuid,
    p_sender_id uuid
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
      RAISE EXCEPTION 'Unauthorized: only the follower can create this notification';
    END IF;

    SELECT COALESCE(nickname, '익명') INTO v_sender_nickname
    FROM profiles WHERE id = p_sender_id;

    v_content := '**' || v_sender_nickname || '**님이 회원님을 팔로우했습니다.';

    INSERT INTO notifications (user_id, sender_id, post_id, content, type)
    VALUES (p_receiver_id, p_sender_id, NULL, v_content, 'follow');
  END;
  $$;

  GRANT EXECUTE ON FUNCTION create_follow_notification(uuid, uuid) TO authenticated;
  GRANT EXECUTE ON FUNCTION create_follow_notification(uuid, uuid) TO service_role;
