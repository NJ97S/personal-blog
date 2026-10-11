'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

export default function MobileSearch() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    const desktop = window.matchMedia('(min-width: 1280px)')
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOutside)
    desktop.addEventListener('change', closeOnDesktop)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOutside)
      desktop.removeEventListener('change', closeOnDesktop)
    }
  }, [open])

  return (
    <div ref={containerRef} className="xl:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? '검색 닫기' : '검색 열기'}
        aria-expanded={open}
        aria-controls="mobile-search-panel"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink-600 hover:bg-craft-100 dark:text-craft-100 dark:hover:bg-ink-800"
      >
        {open ? <X className="h-5 w-5" aria-hidden /> : <Search className="h-5 w-5" aria-hidden />}
      </button>
      {open && (
        <div
          id="mobile-search-panel"
          className="absolute inset-x-0 top-full border-b border-craft-200 bg-craft-50 p-4 shadow-sm dark:border-ink-600 dark:bg-ink-900"
        >
          <form
            action="/search"
            method="get"
            role="search"
            aria-label="블로그 검색"
            onSubmit={(event) => {
              event.preventDefault()
              const query = String(new FormData(event.currentTarget).get('q') ?? '')
              setOpen(false)
              router.push(`/search?q=${encodeURIComponent(query)}`)
            }}
            className="mx-auto flex max-w-2xl items-center gap-2"
          >
            <label htmlFor="mobile-search-q" className="sr-only">검색어</label>
            <input
              ref={inputRef}
              id="mobile-search-q"
              name="q"
              type="search"
              placeholder="검색… (#태그 가능)"
              maxLength={100}
              required
              className="min-w-0 flex-1 rounded-lg border border-craft-200 bg-craft-100 px-3 py-2.5 text-base text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-craft-400 dark:border-ink-600 dark:bg-ink-800 dark:text-craft-50"
            />
            <button type="submit" className="craft-card min-h-11 px-4 py-2 hover:bg-craft-100 dark:hover:bg-ink-800">검색</button>
          </form>
        </div>
      )}
    </div>
  )
}
