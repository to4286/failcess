-- 회원 탈퇴 RPC 적용
-- Supabase 대시보드 SQL Editor에서 실행

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

  DELETE FROM saves WHERE user_id = p_user_id;
  DELETE FROM likes WHERE user_id = p_user_id;
  DELETE FROM comments WHERE author_id = p_user_id;
  DELETE FROM post_notification_settings WHERE user_id = p_user_id;
  DELETE FROM notifications WHERE user_id = p_user_id;
  DELETE FROM posts WHERE author_id = p_user_id;
  DELETE FROM folders WHERE user_id = p_user_id;
  DELETE FROM follows WHERE follower_id = p_user_id OR following_id = p_user_id;
  DELETE FROM coffee_chat_requests WHERE sender_id = p_user_id OR receiver_id = p_user_id;
  DELETE FROM profiles WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_account(uuid) TO authenticated;
