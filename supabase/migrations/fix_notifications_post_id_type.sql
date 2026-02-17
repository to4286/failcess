-- post_id를 uuid에서 bigint로 변경 (posts.id가 bigint인 경우 대응)
-- 에러: invalid input syntax for type uuid: "61"

-- 기존 데이터 정리 (post_id 타입 불일치로 인해 유효하지 않은 데이터일 수 있음)
TRUNCATE notifications CASCADE;
TRUNCATE post_notification_settings CASCADE;

-- 1. post_notification_settings (post_id가 PK 일부)
ALTER TABLE post_notification_settings
  DROP CONSTRAINT IF EXISTS post_notification_settings_post_id_fkey;

ALTER TABLE post_notification_settings
  DROP CONSTRAINT IF EXISTS post_notification_settings_pkey;

ALTER TABLE post_notification_settings
  DROP COLUMN post_id;

ALTER TABLE post_notification_settings
  ADD COLUMN post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE;

ALTER TABLE post_notification_settings
  ADD CONSTRAINT post_notification_settings_pkey PRIMARY KEY (user_id, post_id);

-- 2. notifications
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_post_id_fkey;

ALTER TABLE notifications
  DROP COLUMN post_id;

ALTER TABLE notifications
  ADD COLUMN post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE;
