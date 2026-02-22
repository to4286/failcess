-- 커피챗 수락(Accepted) 시 상대방 이메일 조회 RPC
-- auth.users에서 이메일 조회 (profiles RLS 우회, SECURITY DEFINER)
-- 요청자·수락자 양방향 모두 상대방 이메일 조회 가능

CREATE OR REPLACE FUNCTION get_coffee_chat_partner_profile(p_partner_id uuid)
RETURNS TABLE (nickname text, avatar_url text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 호출자와 p_partner_id가 Accepted 커피챗 관계인지 확인
  IF NOT EXISTS (
    SELECT 1 FROM coffee_chat_requests
    WHERE status = 'accepted'
      AND ((sender_id = auth.uid() AND receiver_id = p_partner_id)
           OR (sender_id = p_partner_id AND receiver_id = auth.uid()))
  ) THEN
    RETURN;
  END IF;

  -- profiles: nickname, avatar_url / auth.users: email
  RETURN QUERY
  SELECT
    COALESCE(p.nickname, '익명')::text,
    p.avatar_url,
    (SELECT au.email FROM auth.users au WHERE au.id = p_partner_id LIMIT 1)
  FROM profiles p
  WHERE p.id = p_partner_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_coffee_chat_partner_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_coffee_chat_partner_profile(uuid) TO service_role;

COMMENT ON FUNCTION get_coffee_chat_partner_profile(uuid) IS
'커피챗 수락(Accepted) 관계의 상대방 프로필(nickname, avatar_url, email) 조회. auth.users에서 이메일 반환.';
