'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bookmark, ChevronDown, ChevronUp } from 'lucide-react'

type SeriesPost = {
  id: string
  slug: string
  title: string
}

type Props = {
  categoryName: string
  posts: SeriesPost[]
  currentId: string
}

const PREVIEW_POST_COUNT = 5

export default function SeriesBox({ categoryName, posts, currentId }: Props) {
  const [open, setOpen] = useState(false)
  const currentIndex = posts.findIndex((p) => p.id === currentId)
  const canToggle = posts.length > PREVIEW_POST_COUNT
  const visiblePosts =
    open || !canToggle ? posts : posts.slice(0, PREVIEW_POST_COUNT)

  return (
    <aside className="not-prose my-10 rounded-lg border border-craft-200 dark:border-ink-600 bg-craft-100/60 dark:bg-ink-800/40 relative overflow-hidden">
      <Bookmark
        aria-hidden
        className="absolute top-0 right-6 h-10 w-6 text-ink-800 dark:text-craft-50"
        fill="currentColor"
      />
      <div className="p-5 pr-20">
        <h2 className="font-serif font-bold text-lg">{categoryName}</h2>
        <ol className="mt-3 space-y-1.5 text-sm list-decimal list-inside">
          {visiblePosts.map((p) => {
            const active = p.id === currentId
            return (
              <li
                key={p.id}
                className={
                  active
                    ? 'text-ink-900 dark:text-craft-50 font-bold'
                    : 'text-ink-600 dark:text-craft-100'
                }
              >
                {active ? (
                  <span>{p.title}</span>
                ) : (
                  <Link
                    href={`/posts/${p.slug}`}
                    className="hover:text-ink-900 dark:hover:text-craft-50 hover:underline underline-offset-4"
                  >
                    {p.title}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </div>
      <div className="flex items-center justify-between border-t border-craft-200 dark:border-ink-600 px-5 py-2 text-xs text-ink-500 dark:text-craft-200">
        {canToggle && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 hover:text-ink-900 dark:hover:text-craft-50"
          >
            {open ? (
              <>
                <ChevronUp className="h-3 w-3" aria-hidden /> 숨기기
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" aria-hidden /> 펼치기
              </>
            )}
          </button>
        )}
        {currentIndex >= 0 && (
          <span className="ml-auto font-mono">
            {currentIndex + 1}/{posts.length}
          </span>
        )}
      </div>
    </aside>
  )
}
