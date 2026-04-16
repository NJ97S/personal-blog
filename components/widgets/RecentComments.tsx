import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

type RelatedPost = { slug: string; title: string; published: boolean }
type CommentRow = {
  id: string
  author_name: string
  content: string
  created_at: string
  post: RelatedPost | RelatedPost[] | null
}

function firstPost(p: CommentRow['post']): RelatedPost | null {
  if (!p) return null
  return Array.isArray(p) ? (p[0] ?? null) : p
}

export default async function RecentComments() {
  const supabase = createClient()
  const { data } = await supabase
    .from('comments')
    .select(
      'id, author_name, content, created_at, post:posts!inner(slug, title, published)',
    )
    .eq('post.published', true)
    .order('created_at', { ascending: false })
    .limit(10)

  const rows: CommentRow[] = (data ?? []) as unknown as CommentRow[]
  const visible = rows
    .map((c) => ({ ...c, post: firstPost(c.post) }))
    .filter((c): c is CommentRow & { post: RelatedPost } => !!c.post?.published)
    .slice(0, 5)

  return (
    <section className="craft-card p-4">
      <h3 className="font-serif font-bold text-sm mb-3 flex items-center gap-1.5">
        <span aria-hidden>💬</span>
        <span>최근 댓글</span>
      </h3>
      {visible.length === 0 ? (
        <p className="text-xs text-ink-400">아직 댓글이 없습니다.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {visible.map((c) => (
            <li key={c.id}>
              <p className="text-ink-600 dark:text-craft-100 line-clamp-2">
                {truncate(c.content, 80)}
              </p>
              <p className="mt-1 text-xs text-ink-400">
                <span className="font-mono">{c.author_name}</span>
                {' · '}
                <Link
                  href={`/posts/${c.post.slug}`}
                  className="hover:text-ink-900 dark:hover:text-craft-50"
                >
                  {truncate(c.post.title, 24)}
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
