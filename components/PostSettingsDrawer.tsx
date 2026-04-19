'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export default function PostSettingsDrawer({
  open,
  onClose,
  title = '설정',
  children,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside
        aria-hidden={!open}
        aria-label={title}
        className={`fixed inset-y-0 right-0 z-50 w-96 max-w-full overflow-y-auto border-l border-craft-200 dark:border-ink-600 bg-craft-50 dark:bg-ink-900 shadow-xl transition-transform ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-craft-200 dark:border-ink-600 px-4 py-3">
          <h2 className="font-serif font-bold text-sm">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-7 w-7 items-center justify-center rounded-sm text-ink-600 dark:text-craft-100 hover:bg-craft-100 dark:hover:bg-ink-800"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="p-4 space-y-4">{children}</div>
      </aside>
    </>
  )
}
