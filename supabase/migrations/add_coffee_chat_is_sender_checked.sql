-- 커피챗 요청: 발신자가 수락 알림 확인 여부
ALTER TABLE coffee_chat_requests
ADD COLUMN IF NOT EXISTS is_sender_checked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN coffee_chat_requests.is_sender_checked IS '발신자가 수락 결과를 확인했는지 여부';

-- RLS: 발신자(sender_id)가 자신이 보낸 요청의 is_sender_checked를 업데이트할 수 있도록 정책 추가
CREATE POLICY "Requester can update is_sender_checked" ON coffee_chat_requests
  FOR UPDATE USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);
