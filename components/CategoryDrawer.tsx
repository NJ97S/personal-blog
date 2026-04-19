'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CategoryNode } from '@/lib/category-tree'
import CategoryTree from './CategoryTree'

type Props = {
  tree: CategoryNode[]
}

export default function CategoryDrawer({ tree }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  const drawer = (
    <div
      role="dialog"
      aria-modal={open}
      aria-label="카테고리"
      aria-hidden={!open}
      className={`fixed inset-0 z-50 md:hidden ${
        open ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`absolute inset-0 bg-ink-900/50 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <aside
        className={`relative h-full w-72 max-w-[85vw] bg-craft-50 dark:bg-ink-900 border-r border-craft-200 dark:border-ink-600 p-4 overflow-y-auto shadow-lg transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
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
  )

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
      {mounted ? createPortal(drawer, document.body) : null}
    </>
  )
}
