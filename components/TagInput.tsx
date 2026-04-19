'use client'

import { useState, useRef } from 'react'
import { X } from 'lucide-react'

const MAX_TAGS = 10

type Props = {
  name?: string
  defaultTags?: string[]
  placeholder?: string
  onDirty?: () => void
}

export default function TagInput({
  name = 'tags',
  defaultTags = [],
  placeholder = '태그를 입력하세요 (Enter/쉼표로 추가)',
  onDirty,
}: Props) {
  const [tags, setTags] = useState<string[]>(defaultTags)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/,/g, '')
    if (!t) return
    if (tags.length >= MAX_TAGS) return
    if (tags.some((existing) => existing.toLowerCase() === t.toLowerCase())) return
    setTags((prev) => [...prev, t])
    onDirty?.()
  }

  const removeAt = (idx: number) => {
    setTags((prev) => prev.filter((_, i) => i !== idx))
    onDirty?.()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(draft)
      setDraft('')
      return
    }
    if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      e.preventDefault()
      removeAt(tags.length - 1)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name={name} value={tags.join(',')} />
      {tags.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className="inline-flex items-center gap-1 rounded-full bg-craft-100 dark:bg-ink-800 px-2.5 py-1 text-xs text-ink-800 dark:text-craft-100"
        >
          <span>{tag}</span>
          <button
            type="button"
            onClick={() => removeAt(idx)}
            aria-label={`태그 ${tag} 제거`}
            className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-craft-200 dark:hover:bg-ink-600"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
        aria-label="태그 입력"
        className="flex-1 min-w-[180px] bg-transparent py-1 text-sm outline-none placeholder:text-ink-400"
      />
    </div>
  )
}
