-- supabase/migrations/002_categories.sql
-- 계층형 카테고리 + posts.category_id FK
-- 실행: Supabase SQL Editor 또는 `supabase db push`

-- =====================
-- categories 테이블
-- =====================
CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL
              CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name        text NOT NULL,
  parent_id   uuid REFERENCES categories(id) ON DELETE CASCADE,
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
-- NULL 을 sentinel uuid 로 치환하여 루트/비루트 모두 (parent, slug) 중복 차단
CREATE UNIQUE INDEX idx_categories_parent_slug
  ON categories (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

-- =====================
-- posts.category_id
-- =====================
ALTER TABLE posts
  ADD COLUMN category_id uuid REFERENCES categories(id) ON DELETE SET NULL;
CREATE INDEX idx_posts_category ON posts(category_id);

-- =====================
-- 집계 뷰 (자기 카테고리에 직접 매핑된 발행 글 수)
-- =====================
CREATE OR REPLACE VIEW category_post_counts AS
SELECT c.id AS category_id, COUNT(p.id)::int AS post_count
FROM categories c
LEFT JOIN posts p ON p.category_id = c.id AND p.published = true
GROUP BY c.id;

-- =====================
-- RLS
-- =====================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read categories" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Admin write categories" ON categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- =====================
-- 시드 (Inpa 구조 참고)
-- =====================
-- 루트: Develop, Web, Algorithm, Tools
WITH ins_develop AS (
  INSERT INTO categories (slug, name, sort_order) VALUES ('develop', 'Develop', 0)
  RETURNING id
), ins_language AS (
  INSERT INTO categories (slug, name, parent_id, sort_order)
  SELECT 'language', 'Language', id, 0 FROM ins_develop
  RETURNING id
), ins_framework AS (
  INSERT INTO categories (slug, name, parent_id, sort_order)
  SELECT 'framework', 'Framework', id, 1 FROM ins_develop
  RETURNING id
)
INSERT INTO categories (slug, name, parent_id, sort_order)
  SELECT v.slug, v.name, l.id, v.ord
  FROM ins_language l, (VALUES
    ('javascript','JavaScript', 0),
    ('typescript','TypeScript', 1),
    ('python','Python', 2)
  ) AS v(slug, name, ord)
UNION ALL
  SELECT v.slug, v.name, f.id, v.ord
  FROM ins_framework f, (VALUES
    ('nextjs','Next.js', 0),
    ('react','React', 1)
  ) AS v(slug, name, ord);

INSERT INTO categories (slug, name, sort_order) VALUES
  ('web', 'Web', 1),
  ('algorithm', 'Algorithm', 2),
  ('tools', 'Tools', 3);

-- Web/Frontend, Web/Backend
WITH web AS (SELECT id FROM categories WHERE slug = 'web' AND parent_id IS NULL)
INSERT INTO categories (slug, name, parent_id, sort_order)
SELECT v.slug, v.name, web.id, v.ord
FROM web, (VALUES
  ('frontend','Frontend', 0),
  ('backend','Backend', 1)
) AS v(slug, name, ord);
