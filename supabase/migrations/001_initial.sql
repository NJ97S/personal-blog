-- supabase/migrations/001_initial.sql
-- 실행 방법: Supabase 대시보드 SQL Editor 에 붙여넣기 or `supabase db push`

-- posts 테이블
CREATE TABLE posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  slug        text UNIQUE NOT NULL
              CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  content     text NOT NULL,
  excerpt     text,
  tags        text[] DEFAULT '{}',
  published   boolean DEFAULT false,
  cover_image text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_posts_tags ON posts USING GIN (tags);

-- comments 테이블
CREATE TABLE comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_name text NOT NULL CHECK (char_length(author_name) <= 50),
  content     text NOT NULL CHECK (char_length(content) <= 500),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_comments_post_id ON comments(post_id);

-- profiles 테이블 (관리자 플래그)
CREATE TABLE profiles (
  id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean DEFAULT false
);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================
-- RLS 정책
-- =====================
ALTER TABLE posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- posts
CREATE POLICY "Public read published" ON posts
  FOR SELECT USING (published = true);

CREATE POLICY "Admin full access" ON posts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- comments
CREATE POLICY "Public read" ON comments FOR SELECT USING (true);
CREATE POLICY "Public insert" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin delete" ON comments FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- profiles
CREATE POLICY "Own read" ON profiles FOR SELECT USING (auth.uid() = id);
