-- profiles에 email 컬럼 추가 및 auth.users 동기화
-- auth.users 접근 제한 시 profiles.email 사용으로 RPC 안정화

-- 1. profiles에 email 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email text;

-- 2. 기존 profiles에 auth.users 이메일 백필
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id AND (p.email IS NULL OR p.email != au.email);

-- 3. auth.users → profiles 이메일 동기화 트리거 (신규 가입/이메일 변경)
CREATE OR REPLACE FUNCTION public.sync_auth_user_email_to_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_sync_email ON auth.users;
CREATE TRIGGER on_auth_user_created_sync_email
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_auth_user_email_to_profiles();

DROP TRIGGER IF EXISTS on_auth_user_updated_sync_email ON auth.users;
CREATE TRIGGER on_auth_user_updated_sync_email
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_auth_user_email_to_profiles();

-- 4. RPC 수정: auth.users 기준 LEFT JOIN profiles (닉네임/아바타/이메일 모두 확보)
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
