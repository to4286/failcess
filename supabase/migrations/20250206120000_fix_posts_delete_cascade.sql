-- 게시물 삭제 시 409 Conflict 해결: saves, likes, comments의 post_id FK에 ON DELETE CASCADE 적용
-- 원인: posts를 참조하는 saves/likes/comments에 CASCADE가 없으면, 해당 레코드가 있을 때 posts 삭제가 FK 위반(23503)으로 409 반환

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'posts'
      AND ccu.column_name = 'id'
      AND tc.table_name IN ('saves', 'likes', 'comments')
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE',
      r.table_name, r.table_name || '_post_id_fkey'
    );
  END LOOP;
END $$;
