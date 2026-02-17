-- 게시물 삭제 409 에러 해결: posts 참조 FK에 ON DELETE CASCADE 적용
-- Supabase 대시보드 SQL Editor에서 실행하거나, supabase db push로 마이그레이션 적용

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
