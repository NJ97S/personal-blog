-- supabase/migrations/004_post_covers_bucket.sql
-- 썸네일 이미지 업로드용 Storage 버킷 + RLS
-- 실행: Supabase SQL Editor (Storage 스키마는 Dashboard에서 자동으로 생성됨)

-- 1. 공개 읽기 가능한 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-covers', 'post-covers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. 기존 정책 제거 (재실행 안전)
DROP POLICY IF EXISTS "Public read post-covers" ON storage.objects;
DROP POLICY IF EXISTS "Admin insert post-covers" ON storage.objects;
DROP POLICY IF EXISTS "Admin update post-covers" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete post-covers" ON storage.objects;

-- 3. 공개 SELECT
CREATE POLICY "Public read post-covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-covers');

-- 4. admin INSERT/UPDATE/DELETE
CREATE POLICY "Admin insert post-covers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'post-covers'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admin update post-covers"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'post-covers'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admin delete post-covers"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'post-covers'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  );
