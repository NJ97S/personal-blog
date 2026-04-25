-- supabase/migrations/005_post_visibility.sql
-- 'published' boolean 을 'visibility' enum 으로 대체
--   public  : 전체 공개
--   private : 출간되었지만 admin 에게만 노출
--   draft   : 임시저장 (출간 전)
--
-- 부분 적용 후 재실행해도 안전하도록 idempotent 하게 작성

-- 1) visibility 컬럼 추가
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'draft'
    CHECK (visibility IN ('public', 'private', 'draft'));

-- 2) 기존 published 데이터 -> visibility 로 마이그레이션 (published 컬럼이 아직 남아있는 경우에만)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'published'
  ) THEN
    UPDATE posts SET visibility = CASE WHEN published THEN 'public' ELSE 'draft' END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility);

-- 3) posts SELECT 정책: visibility 기반으로 변경
DROP POLICY IF EXISTS "Public read published" ON posts;
DROP POLICY IF EXISTS "Public read public" ON posts;
CREATE POLICY "Public read public" ON posts
  FOR SELECT USING (visibility = 'public');

-- 4) comments INSERT 정책 갱신 (published -> visibility='public')
DROP POLICY IF EXISTS "Public insert on published" ON comments;
DROP POLICY IF EXISTS "Public insert on public" ON comments;
CREATE POLICY "Public insert on public" ON comments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM posts WHERE id = comments.post_id AND visibility = 'public')
  );

-- 5) 카테고리 집계 뷰 갱신 (published -> visibility='public')
CREATE OR REPLACE VIEW category_post_counts AS
SELECT c.id AS category_id, COUNT(p.id)::int AS post_count
FROM categories c
LEFT JOIN posts p ON p.category_id = c.id AND p.visibility = 'public'
GROUP BY c.id;

-- 6) legacy published 컬럼 제거
ALTER TABLE posts DROP COLUMN IF EXISTS published;
