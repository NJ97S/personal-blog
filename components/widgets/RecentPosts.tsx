import Link from 'next/link'
import { Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export default async function RecentPosts() {
  const supabase = createClient()
  // PopularPosts와 겹치지 않도록 상위 5건 이후를 보여준다 (view_count 도입 전 임시)
  const { data } = await supabase
    .from('posts')
    .select('id, title, slug, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .range(5, 9)

  const posts = data ?? []

  return (
    <section className="craft-card p-4">
      <h3 className="font-serif font-bold text-sm mb-3 flex items-center gap-1.5">
        <Clock aria-hidden className="h-4 w-4 text-ink-500 dark:text-craft-200" />
        <span>최근 글</span>
      </h3>
      {posts.length === 0 ? (
        <p className="text-xs text-ink-400">아직 글이 없습니다.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {posts.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-2">
              <Link
                href={`/posts/${p.slug}`}
                className="line-clamp-2 hover:text-ink-900 dark:hover:text-craft-50 text-ink-600 dark:text-craft-100"
              >
                {p.title}
              </Link>
              <span className="shrink-0 text-xs font-mono text-ink-400">
                {formatDate(p.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
