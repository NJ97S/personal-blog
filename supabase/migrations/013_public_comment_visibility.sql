BEGIN;

CREATE OR REPLACE VIEW public.public_comments AS
SELECT c.id, c.post_id, c.author_name, c.content, c.created_at,
       p.slug AS post_slug, p.title AS post_title
FROM public.comments AS c
JOIN public.posts AS p ON p.id = c.post_id
WHERE c.deleted_at IS NULL
  AND p.visibility = 'public';

REVOKE ALL ON TABLE public.public_comments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_comments TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
