-- supabase/migrations/003_posts_slug_allow_korean.sql
-- posts.slug CHECK 를 완화하여 한글/영문 slug 를 허용
-- 실행: Supabase SQL Editor 또는 `supabase db push`

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_slug_check;
ALTER TABLE posts ADD CONSTRAINT posts_slug_check
  CHECK (slug ~ '^[a-zA-Z0-9가-힣]+(-[a-zA-Z0-9가-힣]+)*$');
