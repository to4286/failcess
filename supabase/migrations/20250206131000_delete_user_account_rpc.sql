-- 회원 탈퇴 RPC: 본인 데이터 전체 삭제 후 profiles 삭제
-- auth.users는 클라이언트에서 삭제 불가하므로, profiles 및 관련 데이터만 삭제

CREATE OR REPLACE FUNCTION delete_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: only the account owner can delete';
  END IF;

  -- 1. saves (user_id)
  DELETE FROM saves WHERE user_id = p_user_id;

  -- 2. likes (user_id)
  DELETE FROM likes WHERE user_id = p_user_id;

  -- 3. comments (author_id)
  DELETE FROM comments WHERE author_id = p_user_id;

  -- 4. post_notification_settings (user_id)
  DELETE FROM post_notification_settings WHERE user_id = p_user_id;

  -- 5. notifications (user_id: 받은 알림만 삭제, sender_id 컬럼 없는 스키마 대응)
  DELETE FROM notifications WHERE user_id = p_user_id;

  -- 6. posts (author_id) - CASCADE로 saves, likes, comments on those posts도 정리됨
  DELETE FROM posts WHERE author_id = p_user_id;

  -- 7. folders (user_id)
  DELETE FROM folders WHERE user_id = p_user_id;

  -- 8. follows (follower_id 또는 following_id)
  DELETE FROM follows WHERE follower_id = p_user_id OR following_id = p_user_id;

  -- 9. coffee_chat_requests (sender_id 또는 receiver_id)
  DELETE FROM coffee_chat_requests WHERE sender_id = p_user_id OR receiver_id = p_user_id;

  -- 10. profiles
  DELETE FROM profiles WHERE id = p_user_id;
END;
$$;

COMMENT ON FUNCTION delete_user_account(uuid) IS '회원 탈퇴: 본인 활동 데이터 전체 삭제 후 profiles 삭제';
GRANT EXECUTE ON FUNCTION delete_user_account(uuid) TO authenticated;
