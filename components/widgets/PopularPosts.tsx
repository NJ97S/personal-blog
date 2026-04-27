import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

type PopularPostRow = {
  id: string
  title: string
  slug: string
  created_at: string
  view_count: number
}

export default async function PopularPosts() {
  const supabase = createClient()
  const { data } = await supabase.rpc('popular_posts', {
    p_window_days: 30,
    p_limit: 5,
  })

  const posts = (data ?? []) as PopularPostRow[]

  return (
    <section className="craft-card p-4">
      <h3 className="font-serif font-bold text-sm mb-3 flex items-center gap-1.5">
        <TrendingUp aria-hidden className="h-4 w-4 text-ink-500 dark:text-craft-200" />
        <span>인기 글</span>
      </h3>
      {posts.length === 0 ? (
        <p className="text-xs text-ink-400">아직 글이 없습니다.</p>
      ) : (
        <ol className="space-y-2 text-sm">
          {posts.map((p, i) => (
            <li key={p.id} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-0.5 h-5 w-5 shrink-0 flex items-center justify-center rounded-sm bg-craft-200 dark:bg-ink-600 text-[10px] font-mono font-bold"
              >
                {i + 1}
              </span>
              <Link
                href={`/posts/${p.slug}`}
                className="line-clamp-2 hover:text-ink-900 dark:hover:text-craft-50 text-ink-600 dark:text-craft-100"
              >
                {p.title}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
