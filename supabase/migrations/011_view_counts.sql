-- 공개 집계만 노출하고 방문자 식별자는 RLS 뒤에 유지합니다.
DROP POLICY IF EXISTS "Anyone can insert view" ON public.post_views;

-- 기존 기록을 그대로 사용한 게시글별 조회수. 요청당 최대 100개.
CREATE FUNCTION public.post_view_counts(p_post_ids uuid[])
RETURNS TABLE (post_id uuid, view_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, count(v.id)
  FROM public.posts p
  LEFT JOIN public.post_views v ON v.post_id = p.id
  WHERE p.id = ANY(p_post_ids[1:100]) AND p.visibility = 'public'
  GROUP BY p.id;
$$;
REVOKE ALL ON FUNCTION public.post_view_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_view_counts(uuid[]) TO anon, authenticated;

-- 경쟁 요청도 동일 방문을 중복 삽입하지 않도록 잠급니다.
CREATE OR REPLACE FUNCTION public.track_post_view(
  p_post_id uuid, p_visitor_hash text, p_window_hours int DEFAULT 4
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_visitor_hash IS NULL OR p_visitor_hash !~ '^[0-9a-f]{16}$' THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM posts WHERE id = p_post_id AND visibility = 'public') THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_post_id::text || p_visitor_hash, 0));
  IF EXISTS (
    SELECT 1 FROM post_views WHERE post_id = p_post_id AND visitor_hash = p_visitor_hash
      AND viewed_at >= now() - interval '4 hours'
  ) THEN RETURN; END IF;
  INSERT INTO post_views (post_id, visitor_hash) VALUES (p_post_id, p_visitor_hash);
END;
$$;
REVOKE ALL ON FUNCTION public.track_post_view(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_post_view(uuid, text, int) TO anon, authenticated;

CREATE TABLE public.blog_views (
  id bigserial PRIMARY KEY,
  page_path text NOT NULL,
  visitor_hash text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blog_views_dedup ON public.blog_views(page_path, visitor_hash, viewed_at DESC);
CREATE INDEX blog_views_date ON public.blog_views(viewed_at DESC);
ALTER TABLE public.blog_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read blog views" ON public.blog_views FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

CREATE FUNCTION public.track_blog_view(p_page_path text, p_visitor_hash text)
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
    count(*) FROM blog_views;
END;
$$;
REVOKE ALL ON FUNCTION public.track_blog_view(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_blog_view(text, text) TO anon, authenticated;
