'use client'

import dynamic from 'next/dynamic'
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
  const rootRef = useRef<HTMLDivElement>(null)

  useMarkdownScrollSync(rootRef, value)

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setColorMode(root.classList.contains('dark') ? 'dark' : 'light')
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <div data-color-mode={colorMode} ref={rootRef}>
      <input type="hidden" name={name} value={value} readOnly />
      <MDEditor
        value={value}
        onChange={(val) => setValue(val ?? '')}
        height={height}
        preview="live"
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
