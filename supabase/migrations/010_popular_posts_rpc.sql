-- supabase/migrations/010_popular_posts_rpc.sql
-- 인기 글 위젯용 RPC. post_views 의 SELECT 정책이 admin 전용이라
-- anon 컨텍스트에서는 직접 집계가 불가능하므로 SECURITY DEFINER 로 우회한다.
--   * 윈도우(p_window_days) 내 PV 카운트 기준 내림차순
--   * PV 가 동률(또는 0)인 경우 created_at 으로 폴백
--   * public 글만 노출

CREATE OR REPLACE FUNCTION popular_posts(
  p_window_days int DEFAULT 30,
  p_limit int DEFAULT 5
) RETURNS TABLE (
  id uuid,
  title text,
  slug text,
  created_at timestamptz,
  view_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.title,
    p.slug,
    p.created_at,
    COUNT(pv.id) AS view_count
  FROM posts p
  LEFT JOIN post_views pv
    ON pv.post_id = p.id
   AND pv.viewed_at >= now() - (p_window_days || ' days')::interval
  WHERE p.visibility = 'public'
  GROUP BY p.id
  ORDER BY view_count DESC, p.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION popular_posts(int, int) TO anon, authenticated;
