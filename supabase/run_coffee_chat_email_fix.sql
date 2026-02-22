-- Supabase SQL Editor에서 실행
-- 커피챗 상대방 이메일 미표시 문제 해결

-- 1. profiles에 email 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email text;

-- 2. 기존 profiles에 auth.users 이메일 백필
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id AND (p.email IS NULL OR p.email != au.email);

-- 3. RPC 수정: auth.users 기준 LEFT JOIN profiles (닉네임/아바타/이메일 모두 확보)
CREATE OR REPLACE FUNCTION get_coffee_chat_partner_profile(p_partner_id uuid)
RETURNS TABLE (nickname text, avatar_url text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.coffee_chat_requests
    WHERE status = 'accepted'
      AND ((sender_id = auth.uid() AND receiver_id = p_partner_id)
           OR (sender_id = p_partner_id AND receiver_id = auth.uid()))
  ) THEN
    RETURN;
  END IF;

  -- auth.users 기준으로 profiles LEFT JOIN (유저는 auth에 있음)
  RETURN QUERY
  SELECT
    COALESCE(p.nickname, '익명')::text,
    p.avatar_url,
    COALESCE(p.email, au.email)
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE au.id = p_partner_id;
END;
$$;
