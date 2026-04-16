-- 002_profiles_and_comments_rls.sql
-- 1) auth.users 가입 시 profiles 행 자동 생성 (is_admin=false)
-- 2) comments INSERT 정책을 published 글에만 허용

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, is_admin) VALUES (NEW.id, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- comments 정책 강화: published 글에만 댓글 작성 허용
DROP POLICY IF EXISTS "Public insert" ON comments;
CREATE POLICY "Public insert on published" ON comments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM posts WHERE id = comments.post_id AND published = true)
  );
