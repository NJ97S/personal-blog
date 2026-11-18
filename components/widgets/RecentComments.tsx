import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

export default async function RecentComments() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('public_comments')
    .select('id, author_name, content, post_slug, post_title')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(5)
  const comments = data ?? []

  return (
    <section className="craft-card p-4">
      <h3 className="font-serif font-bold text-sm mb-3 flex items-center gap-1.5">
        <MessageSquare aria-hidden className="h-4 w-4 text-ink-500 dark:text-craft-200" />
        <span>최근 댓글</span>
      </h3>
      {error ? (
        <p className="text-xs text-ink-400">최근 댓글을 불러오지 못했습니다.</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-ink-400">아직 댓글이 없습니다.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {comments.map((c) => (
            <li key={c.id}>
              <p className="text-ink-600 dark:text-craft-100 line-clamp-2">
                {truncate(c.content, 80)}
              </p>
              <p className="mt-1 text-xs text-ink-400">
                <span className="font-mono">{c.author_name}</span>
                {' · '}
                <Link
                  href={`/posts/${encodeURIComponent(c.post_slug)}`}
                  className="hover:text-ink-900 dark:hover:text-craft-50"
                >
                  {truncate(c.post_title, 24)}
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
