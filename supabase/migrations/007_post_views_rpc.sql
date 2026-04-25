-- supabase/migrations/007_post_views_rpc.sql
-- post_views 의 SELECT 정책이 admin 전용이라, anon 사용자는 dedup 용 SELECT 가 빈 결과를 반환한다.
-- → 클라이언트가 직접 SELECT/INSERT 하지 않고, SECURITY DEFINER 함수로 dedup+insert 를 atomic 하게 처리한다.

CREATE OR REPLACE FUNCTION track_post_view(
  p_post_id uuid,
  p_visitor_hash text,
  p_window_hours int DEFAULT 4
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- public 글에만 카운트
  IF NOT EXISTS (SELECT 1 FROM posts WHERE id = p_post_id AND visibility = 'public') THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM post_views
    WHERE post_id = p_post_id
      AND visitor_hash = p_visitor_hash
      AND viewed_at >= now() - (p_window_hours || ' hours')::interval
  ) THEN
    RETURN;
  END IF;

  INSERT INTO post_views (post_id, visitor_hash)
  VALUES (p_post_id, p_visitor_hash);
END;
$$;

GRANT EXECUTE ON FUNCTION track_post_view(uuid, text, int) TO anon, authenticated;
