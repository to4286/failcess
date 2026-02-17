-- 커피챗 요청 테이블 (CoffeeChatModal 연동)
-- 컬럼명: sender_id(보낸 사람), receiver_id(받는 사람) — Supabase 스키마 캐시와 일치
CREATE TABLE IF NOT EXISTS coffee_chat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coffee_chat_requests_receiver_id ON coffee_chat_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_coffee_chat_requests_sender_id ON coffee_chat_requests(sender_id);

ALTER TABLE coffee_chat_requests ENABLE ROW LEVEL SECURITY;

-- 본인이 보낸 요청 또는 받은 요청만 조회 가능
CREATE POLICY "Users can view own coffee chat requests" ON coffee_chat_requests
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 로그인 유저만 요청 생성
CREATE POLICY "Authenticated users can insert coffee chat requests" ON coffee_chat_requests
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 수신자만 status 업데이트 (수락/거절)
CREATE POLICY "Receiver can update status" ON coffee_chat_requests
  FOR UPDATE USING (auth.uid() = receiver_id);

COMMENT ON TABLE coffee_chat_requests IS '커피챗 요청 (보낸 사람, 받는 사람, 메시지, 상태)';
