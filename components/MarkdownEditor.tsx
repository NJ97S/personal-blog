'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), {
  ssr: false,
  loading: () => (
    <div className="craft-card p-4 text-sm text-ink-400">에디터 로딩 중…</div>
  ),
})

export default function MarkdownEditor({
  name,
  defaultValue = '',
}: {
  name: string
  defaultValue?: string
}) {
  const [value, setValue] = useState<string>(defaultValue)
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setColorMode(root.classList.contains('dark') ? 'dark' : 'light')
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <div data-color-mode={colorMode}>
      <input type="hidden" name={name} value={value} readOnly />
      <MDEditor
        value={value}
        onChange={(val) => setValue(val ?? '')}
        height={500}
        preview="live"
      />
    </div>
  )
}
