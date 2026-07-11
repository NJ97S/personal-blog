'use client'

import dynamic from 'next/dynamic'
import { Eye, PencilLine } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import MarkdownView from './MarkdownView'
import { useMarkdownScrollSync } from './useMarkdownScrollSync'
import '@uiw/react-md-editor/markdown-editor.css'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), {
  ssr: false,
  loading: () => (
    <div className="craft-card p-4 text-sm text-ink-400">에디터 로딩 중…</div>
  ),
})

type Props = {
  name: string
  defaultValue?: string
  height?: number | string
}

export default function MarkdownEditor({
  name,
  defaultValue = '',
  height = 500,
}: Props) {
  const [value, setValue] = useState<string>(defaultValue)
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light')
  const [isMobile, setIsMobile] = useState(false)
  const [mobileMode, setMobileMode] = useState<'edit' | 'preview'>('edit')
  const rootRef = useRef<HTMLDivElement>(null)
  const previewMode = isMobile ? mobileMode : 'live'

  useMarkdownScrollSync(rootRef, value, previewMode === 'live')

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setColorMode(root.classList.contains('dark') ? 'dark' : 'light')
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobile(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!isMobile) setMobileMode('edit')
  }, [isMobile])

  return (
    <div
      className="markdown-editor-widget"
      data-color-mode={colorMode}
      data-mobile-mode={isMobile ? mobileMode : undefined}
      ref={rootRef}
    >
      <input type="hidden" name={name} value={value} readOnly />
      {isMobile ? (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setMobileMode((mode) => (mode === 'edit' ? 'preview' : 'edit'))}
            className="inline-flex items-center gap-1.5 rounded-md border border-craft-300 bg-craft-100 px-3 py-1.5 text-sm text-ink-700 shadow-sm transition hover:bg-craft-200 dark:border-ink-600 dark:bg-ink-800 dark:text-craft-100 dark:hover:bg-ink-700"
            aria-pressed={mobileMode === 'preview'}
          >
            {mobileMode === 'edit' ? (
              <>
                <Eye className="h-4 w-4" aria-hidden="true" />
                미리보기
              </>
            ) : (
              <>
                <PencilLine className="h-4 w-4" aria-hidden="true" />
                작성
              </>
            )}
          </button>
        </div>
      ) : null}
      <MDEditor
        value={value}
        onChange={(val) => setValue(val ?? '')}
        height={height}
        preview={previewMode}
        enableScroll={false}
        components={{
          preview: (source) => (
            <MarkdownView content={source} compact annotateLines />
          ),
        }}
      />
    </div>
  )
}
