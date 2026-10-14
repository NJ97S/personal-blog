'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { trackBlogView } from '@/app/actions/views'

type ViewStats = { today: number; total: number }
const BlogViewsContext = createContext<ViewStats | null>(null)

// 표시 위치가 여러 곳이어도 페이지 방문당 집계 요청은 한 번만 보냅니다.
export function BlogViewsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [result, setResult] = useState<{ pathname: string; stats: ViewStats | null } | null>(null)

  useEffect(() => {
    let active = true
    void trackBlogView(pathname).then((stats) => {
      if (active) setResult({ pathname, stats })
    }).catch(() => {})
    return () => { active = false }
  }, [pathname])

  const stats = result?.pathname === pathname ? result.stats : null
  return <BlogViewsContext.Provider value={stats}>{children}</BlogViewsContext.Provider>
}

export default function BlogViewStats({ variant = 'compact' }: { variant?: 'compact' | 'panel' }) {
  const stats = useContext(BlogViewsContext)
  const today = stats?.today.toLocaleString('ko-KR') ?? '—'
  const total = stats?.total.toLocaleString('ko-KR') ?? '—'
  const title = '한국 시간 기준 · 같은 페이지는 4시간 내 중복 제외'

  if (variant === 'panel') {
    return (
      <dl aria-label="블로그 조회수" title={title} className="grid grid-cols-2 divide-x divide-craft-200 dark:divide-ink-600">
        <div className="min-w-0 pr-4">
          <dt className="text-xs text-ink-400">오늘 조회수</dt>
          <dd className="mt-1 break-all font-mono text-xl font-semibold tabular-nums text-ink-900 dark:text-craft-50">{today}</dd>
        </div>
        <div className="min-w-0 pl-4">
          <dt className="text-xs text-ink-400">총 조회수</dt>
          <dd className="mt-1 break-all font-mono text-xl font-semibold tabular-nums text-ink-900 dark:text-craft-50">{total}</dd>
        </div>
      </dl>
    )
  }

  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono" title={title}>
      <span>오늘 조회수 <strong className="text-ink-600 dark:text-craft-100">{today}</strong></span>
      <span>총 조회수 <strong className="text-ink-600 dark:text-craft-100">{total}</strong></span>
    </p>
  )
}
