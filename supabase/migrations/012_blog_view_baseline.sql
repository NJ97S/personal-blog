-- 기존 게시글 기록은 새 블로그 집계 시작 전까지만 총 조회수에 반영합니다.
-- 시작 시점 이후의 post_views는 blog_views와 중복될 수 있으므로 합산하지 않습니다.
-- 기준값을 한 번만 저장해 재실행하거나 과거 게시글을 삭제해도 총계가 변하지 않게 합니다.
BEGIN;

LOCK TABLE public.blog_views, public.post_views IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS public.blog_view_baseline (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  cutover_at timestamptz NOT NULL,
  view_count bigint NOT NULL CHECK (view_count >= 0)
);
ALTER TABLE public.blog_view_baseline ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.blog_view_baseline FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.blog_view_baseline TO authenticated;
DROP POLICY IF EXISTS "Admin read view baseline" ON public.blog_view_baseline;
CREATE POLICY "Admin read view baseline" ON public.blog_view_baseline FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

WITH cutover AS (
  SELECT coalesce(min(viewed_at), now()) AS at FROM public.blog_views
)
INSERT INTO public.blog_view_baseline (id, cutover_at, view_count)
SELECT true, cutover.at, (SELECT count(*) FROM public.post_views WHERE viewed_at < cutover.at)
FROM cutover
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.track_blog_view(p_page_path text, p_visitor_hash text)
RETURNS TABLE (today_views bigint, total_views bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_page_path IS NULL OR length(p_page_path) > 1024
    OR p_page_path !~ '^(/|/search|/(posts|categories|tags)/[^[:cntrl:]?#]+)$'
    OR p_visitor_hash IS NULL OR p_visitor_hash !~ '^[0-9a-f]{16}$' THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_page_path || p_visitor_hash, 1));
    IF NOT EXISTS (
      SELECT 1 FROM blog_views WHERE page_path = p_page_path AND visitor_hash = p_visitor_hash
        AND viewed_at >= now() - interval '4 hours'
    ) THEN
      INSERT INTO blog_views (page_path, visitor_hash) VALUES (p_page_path, p_visitor_hash);
    END IF;
  END IF;
  RETURN QUERY SELECT
    count(*) FILTER (WHERE viewed_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul')),
    count(*) + coalesce((SELECT view_count FROM public.blog_view_baseline WHERE id = true), 0)
  FROM blog_views;
END;
$$;
REVOKE ALL ON FUNCTION public.track_blog_view(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_blog_view(text, text) TO anon, authenticated;

COMMIT;
