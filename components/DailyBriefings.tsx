import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { CategoryNode } from '@/lib/category-tree'

export type BriefingPost = {
  id: string
  title: string
  slug: string
  created_at: string
}

type BriefingColumn = {
  label: string
  category?: CategoryNode
  posts: BriefingPost[]
  error: boolean
}

export default function DailyBriefings({ columns }: { columns: BriefingColumn[] }) {
  return (
    <section aria-labelledby="daily-briefings-heading" className="mb-10">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="daily-briefings-heading" className="font-serif text-xl font-bold">
          데일리 브리핑
        </h2>
        <p className="text-xs text-ink-400">매일 모아보는 기술 소식</p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
        {columns.map(({ label, category, posts, error }) => (
          <div
            key={label}
            className="craft-card min-w-0 p-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 dark:sm:bg-transparent"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 sm:border-b sm:border-ink-600/50 dark:sm:border-craft-200/50">
              <h3 className="font-mono text-sm font-bold">{label}</h3>
              {category && (
                <Link
                  href={`/categories/${category.path.map(encodeURIComponent).join('/')}`}
                  aria-label={`${label} 데일리 브리핑 전체 보기`}
                  className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-craft-400"
                >
                  전체 보기 <ArrowUpRight size={12} aria-hidden="true" />
                </Link>
              )}
            </div>
            {error ? (
              <p className="py-4 text-sm text-ink-400">브리핑을 불러오지 못했습니다.</p>
            ) : posts.length === 0 ? (
              <p className="py-4 text-sm text-ink-400">아직 발행된 브리핑이 없습니다.</p>
            ) : (
              <ul className="sm:divide-y sm:divide-craft-200/70 dark:sm:divide-ink-600/60">
                {posts.map((post) => (
                  <li key={post.id}>
                    <Link
                      href={`/posts/${post.slug}`}
                      className="group flex min-h-[64px] flex-col justify-center gap-1 py-3 transition-colors hover:bg-craft-100/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-craft-400 dark:hover:bg-ink-800/40 sm:h-[76px]"
                    >
                      <p className="line-clamp-2 font-serif text-sm leading-relaxed group-hover:text-craft-400">
                        {post.title}
                      </p>
                      <time dateTime={post.created_at} className="font-mono text-[11px] text-ink-400">
                        {new Date(post.created_at).toLocaleDateString('ko-KR', {
                          timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
                        })}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
