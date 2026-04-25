-- supabase/migrations/009_comment_auth_search_path.sql
-- 008 의 SECURITY DEFINER 함수들이 SET search_path = public 으로만 한정되어
-- pgcrypto 의 crypt(), gen_salt() (extensions 스키마)를 못 찾던 문제 수정.
-- search_path 에 extensions 추가 + 명시적 schema-qualify 로 이중 안전장치.

CREATE OR REPLACE FUNCTION insert_comment(
  p_post_id uuid,
  p_author_name text,
  p_content text,
  p_password text,
  p_edit_token text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    p_edit_token
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_comment(
  p_comment_id uuid,
  p_new_content text,
  p_edit_token text DEFAULT NULL,
  p_password text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
        AND password_hash = extensions.crypt(p_password, password_hash)
    ) INTO v_match;
  END IF;

  IF NOT v_match THEN RETURN false; END IF;

  UPDATE comments SET content = p_new_content WHERE id = p_comment_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION delete_comment(
  p_comment_id uuid,
  p_edit_token text DEFAULT NULL,
  p_password text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
        AND password_hash = extensions.crypt(p_password, password_hash)
    ) INTO v_match;
  END IF;

  IF NOT v_match THEN RETURN false; END IF;

  UPDATE comments SET deleted_at = now() WHERE id = p_comment_id;
  RETURN true;
END;
$$;
