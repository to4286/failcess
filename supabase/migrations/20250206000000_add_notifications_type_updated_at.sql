-- notifications 테이블에 type, updated_at 컬럼 추가 (응원해요 알림용)
-- type: 'comment' | 'like', updated_at: 중복 알림 시 최신 시간 표시
-- 마이그레이션 적용 후 NotificationsSection.tsx의 select에 updated_at, type 추가

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'comment';

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 기존 행에 updated_at 채우기
UPDATE notifications SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE notifications
  ALTER COLUMN updated_at SET DEFAULT now();
