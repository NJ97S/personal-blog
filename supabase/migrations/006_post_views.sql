-- supabase/migrations/006_post_views.sql
-- 블로그 페이지뷰 트래킹 테이블
--   * 자체 집계 (Vercel Analytics 미사용)
--   * 4시간 dedup은 애플리케이션 레벨 (app/actions/views.ts)에서 처리
--   * 실행 방법: Supabase Dashboard SQL Editor 에 붙여넣기 or `supabase db push`

CREATE TABLE IF NOT EXISTS post_views (
  id           bigserial PRIMARY KEY,
  post_id      uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  visitor_hash text NOT NULL,
  viewed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_views_viewed_at
  ON post_views(viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_views_post_id_viewed_at
  ON post_views(post_id, viewed_at DESC);

-- dedup 조회 (post_id + visitor_hash + 최근 N시간) 가속용
CREATE INDEX IF NOT EXISTS idx_post_views_dedup
  ON post_views(post_id, visitor_hash, viewed_at DESC);

ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;

-- 누구나 INSERT 가능 (anon 키로 트래킹). spam 방어는 4시간 dedup으로.
DROP POLICY IF EXISTS "Anyone can insert view" ON post_views;
CREATE POLICY "Anyone can insert view" ON post_views
  FOR INSERT WITH CHECK (true);

-- 관리자만 SELECT 가능 (cron 핸들러는 service role 또는 admin 컨텍스트로 호출)
DROP POLICY IF EXISTS "Admin read views" ON post_views;
CREATE POLICY "Admin read views" ON post_views
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
