-- supabase/migrations/008_comment_auth.sql
-- 댓글 본인 인증 (회원가입 없는 토큰 + 비밀번호 혼합)
--   * password_hash : pgcrypto bcrypt
--   * edit_token    : 32-byte hex 랜덤 토큰 (서버가 발급, 클라가 localStorage 보관)
--   * deleted_at    : soft delete (view 에서 필터링)
--
-- 모든 작성/수정/삭제는 SECURITY DEFINER RPC 로만 처리해 base 테이블 직접 노출을 차단한다.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS edit_token    text,
  ADD COLUMN IF NOT EXISTS deleted_at    timestamptz;

CREATE INDEX IF NOT EXISTS idx_comments_edit_token ON comments(edit_token);
CREATE INDEX IF NOT EXISTS idx_comments_post_active
  ON comments(post_id, created_at) WHERE deleted_at IS NULL;

-- ============
-- RLS 재설계
-- ============
-- 기존 정책 정리
DROP POLICY IF EXISTS "Public read"           ON comments;
DROP POLICY IF EXISTS "Public insert"         ON comments;
DROP POLICY IF EXISTS "Public insert on published" ON comments;
DROP POLICY IF EXISTS "Public insert on public"    ON comments;
DROP POLICY IF EXISTS "Admin read comments"   ON comments;
DROP POLICY IF EXISTS "Admin delete"          ON comments;

-- base 테이블 SELECT/INSERT/UPDATE/DELETE: admin 전용
-- (anon/authenticated 는 RPC 와 view 만 사용)
CREATE POLICY "Admin read comments" ON comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admin delete comments" ON comments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admin update comments" ON comments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============
-- public view (안전 컬럼만 + soft delete 필터)
-- ============
CREATE OR REPLACE VIEW public_comments AS
SELECT id, post_id, author_name, content, created_at
FROM comments
WHERE deleted_at IS NULL;

GRANT SELECT ON public_comments TO anon, authenticated;

-- ============
-- INSERT RPC (비밀번호 해시 + 토큰 검증을 DB에서 처리)
-- ============
CREATE OR REPLACE FUNCTION insert_comment(
  p_post_id uuid,
  p_author_name text,
  p_content text,
  p_password text,
  p_edit_token text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM posts WHERE id = p_post_id AND visibility = 'public') THEN
    RAISE EXCEPTION 'post not public';
  END IF;
  IF p_password IS NULL OR char_length(p_password) < 4 OR char_length(p_password) > 20 THEN
    RAISE EXCEPTION 'invalid password length';
  END IF;
  IF p_edit_token IS NULL OR char_length(p_edit_token) < 32 THEN
    RAISE EXCEPTION 'invalid edit token';
  END IF;
  INSERT INTO comments (post_id, author_name, content, password_hash, edit_token)
  VALUES (
    p_post_id,
    p_author_name,
    p_content,
    crypt(p_password, gen_salt('bf', 10)),
    p_edit_token
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION insert_comment(uuid, text, text, text, text) TO anon, authenticated;

-- ============
-- UPDATE RPC
-- ============
CREATE OR REPLACE FUNCTION update_comment(
  p_comment_id uuid,
  p_new_content text,
  p_edit_token text DEFAULT NULL,
  p_password text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match boolean := false;
BEGIN
  IF p_new_content IS NULL OR char_length(p_new_content) = 0 OR char_length(p_new_content) > 500 THEN
    RAISE EXCEPTION 'invalid content length';
  END IF;

  IF p_edit_token IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM comments
      WHERE id = p_comment_id
        AND deleted_at IS NULL
        AND edit_token IS NOT NULL
        AND edit_token = p_edit_token
    ) INTO v_match;
  END IF;

  IF NOT v_match AND p_password IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM comments
      WHERE id = p_comment_id
        AND deleted_at IS NULL
        AND password_hash IS NOT NULL
        AND password_hash = crypt(p_password, password_hash)
    ) INTO v_match;
  END IF;

  IF NOT v_match THEN RETURN false; END IF;

  UPDATE comments SET content = p_new_content WHERE id = p_comment_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION update_comment(uuid, text, text, text) TO anon, authenticated;

-- ============
-- DELETE RPC (soft delete)
-- ============
CREATE OR REPLACE FUNCTION delete_comment(
  p_comment_id uuid,
  p_edit_token text DEFAULT NULL,
  p_password text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match boolean := false;
BEGIN
  IF p_edit_token IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM comments
      WHERE id = p_comment_id
        AND deleted_at IS NULL
        AND edit_token IS NOT NULL
        AND edit_token = p_edit_token
    ) INTO v_match;
  END IF;

  IF NOT v_match AND p_password IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM comments
      WHERE id = p_comment_id
        AND deleted_at IS NULL
        AND password_hash IS NOT NULL
        AND password_hash = crypt(p_password, password_hash)
    ) INTO v_match;
  END IF;

  IF NOT v_match THEN RETURN false; END IF;

  -- soft delete: 컬럼만 마킹, 행은 보존
  UPDATE comments SET deleted_at = now() WHERE id = p_comment_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_comment(uuid, text, text) TO anon, authenticated;
