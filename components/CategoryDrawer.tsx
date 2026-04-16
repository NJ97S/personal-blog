'use client'

import { useEffect, useState } from 'react'
import type { CategoryNode } from '@/lib/categories'
import CategoryTree from './CategoryTree'

type Props = {
  tree: CategoryNode[]
}

export default function CategoryDrawer({ tree }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="카테고리 열기"
        className="md:hidden rounded-sm border border-craft-200 dark:border-ink-600 px-2 py-1.5 text-sm hover:bg-craft-100 dark:hover:bg-ink-800"
      >
        ☰
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="카테고리"
          className="fixed inset-0 z-50 md:hidden"
        >
          <div
            className="absolute inset-0 bg-ink-900/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="relative h-full w-72 max-w-[85vw] bg-craft-50 dark:bg-ink-900 border-r border-craft-200 dark:border-ink-600 p-4 overflow-y-auto shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif font-bold">카테고리</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="rounded-sm border border-craft-200 dark:border-ink-600 px-2 py-1 text-sm hover:bg-craft-100 dark:hover:bg-ink-800"
              >
                ✕
              </button>
            </div>
            <CategoryTree nodes={tree} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
