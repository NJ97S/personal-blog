'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { List, X } from 'lucide-react'
import { useFocusTrap } from '@/lib/use-focus-trap'

type Heading = { id: string; text: string; level: number }

export default function MobilePostToc({
  headings,
  activeId,
  pathname,
}: {
  headings: Heading[]
  activeId: string
  pathname: string
}) {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const dialogRef = useFocusTrap<HTMLDivElement>(open)

  useEffect(() => setMounted(true), [])
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    // 댓글 작성/수정과 검색 등 텍스트 입력 중에는 플로팅 버튼을 숨깁니다.
    const syncEditing = () => {
      const element = document.activeElement
      setEditing(element instanceof HTMLElement && (
        element.matches('input, textarea, select') || element.isContentEditable
      ))
    }
    let frame = 0
    const onBlur = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(syncEditing)
    }
    syncEditing()
    document.addEventListener('focusin', syncEditing)
    document.addEventListener('focusout', onBlur)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('focusin', syncEditing)
      document.removeEventListener('focusout', onBlur)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const desktop = window.matchMedia('(min-width: 1280px)')
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false)
    }
    document.addEventListener('keydown', onEscape)
    desktop.addEventListener('change', closeOnDesktop)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onEscape)
      desktop.removeEventListener('change', closeOnDesktop)
    }
  }, [open])

  if (!mounted || headings.length === 0) return null

  // PostToc은 데스크톱 aside 안에 있으므로 모바일 UI는 body로 포털합니다.
  return createPortal(
    <>
      {!editing && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="목차 열기"
          aria-expanded={open}
          aria-controls="mobile-post-toc"
          className="fixed right-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-30 inline-flex min-h-11 items-center gap-2 rounded-full border border-craft-200 bg-craft-50 px-4 py-2.5 text-sm text-ink-600 shadow-sm hover:bg-craft-100 dark:border-ink-600 dark:bg-ink-900 dark:text-craft-100 dark:hover:bg-ink-800 xl:hidden"
        >
          <List className="h-4 w-4" aria-hidden />
          목차
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setOpen(false)} aria-hidden />
          <div
            ref={dialogRef}
            id="mobile-post-toc"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-post-toc-title"
            className="mobile-toc-sheet absolute inset-x-0 bottom-0 flex max-h-[50dvh] flex-col rounded-t-2xl border-t border-craft-200 bg-craft-50 px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lg dark:border-ink-600 dark:bg-ink-900"
          >
            <div className="mx-auto mb-2 h-1 w-8 shrink-0 rounded-full bg-craft-200 dark:bg-ink-600" aria-hidden />
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <h2 id="mobile-post-toc-title" className="font-serif text-xl font-bold">목차</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="목차 닫기" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-craft-100 dark:hover:bg-ink-800">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <nav aria-label="글 목차" className="min-h-0 overflow-y-auto overscroll-contain">
              <ul className="border-l border-craft-200 dark:border-ink-600">
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <Link
                      href={`#${encodeURIComponent(heading.id)}`}
                      replace
                      onClick={() => setOpen(false)}
                      aria-current={heading.id === activeId ? 'location' : undefined}
                      style={{ paddingLeft: 12 + (heading.level - 1) * 12 }}
                      className={`-ml-px flex min-h-11 items-center border-l py-3 pr-3 text-sm break-words hover:bg-craft-100 dark:hover:bg-ink-800 ${heading.id === activeId ? 'border-ink-900 bg-craft-100 font-bold text-ink-900 dark:border-craft-50 dark:bg-ink-800 dark:text-craft-50' : 'border-transparent text-ink-400 dark:text-craft-200'}`}
                    >
                      {heading.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </>,
    document.body,
  )
}
