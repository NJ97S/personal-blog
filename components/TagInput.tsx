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
  const tagsRef = useRef(tags)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const composingRef = useRef(false)

  const addTags = (raw: string) => {
    const next = [...tagsRef.current]
    for (const part of raw.split(',')) {
      const tag = part.trim()
      if (!tag || next.length >= MAX_TAGS) continue
      if (next.some((existing) => existing.toLowerCase() === tag.toLowerCase())) continue
      next.push(tag)
    }
    if (next.length === tagsRef.current.length) return
    tagsRef.current = next
    setTags(next)
    onDirty?.()
  }

  const updateDraft = (value: string) => {
    // Mobile keyboards can insert commas without a usable keydown event.
    const lastComma = value.lastIndexOf(',')
    if (lastComma === -1) {
      setDraft(value)
      return
    }
    addTags(value.slice(0, lastComma))
    setDraft(value.slice(lastComma + 1))
  }

  const commitDraft = (value: string) => {
    addTags(value)
    setDraft('')
  }

  const removeAt = (idx: number) => {
    const next = tagsRef.current.filter((_, i) => i !== idx)
    tagsRef.current = next
    setTags(next)
    onDirty?.()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (composingRef.current || e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      e.preventDefault()
      commitDraft(e.currentTarget.value)
      return
    }
    if (e.keyCode === 229) return
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
          className="inline-flex min-h-10 items-center gap-1 rounded-full bg-craft-100 px-2.5 py-1 text-xs text-ink-800 dark:bg-ink-800 dark:text-craft-100 sm:min-h-0"
        >
          <span>{tag}</span>
          <button
            type="button"
            onClick={() => removeAt(idx)}
            aria-label={`태그 ${tag} 제거`}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-craft-200 dark:hover:bg-ink-600 sm:h-4 sm:w-4"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => {
          if (composingRef.current || (e.nativeEvent as InputEvent).isComposing) {
            setDraft(e.target.value)
          } else {
            updateDraft(e.target.value)
          }
        }}
        onCompositionStart={() => { composingRef.current = true }}
        onCompositionEnd={(e) => {
          composingRef.current = false
          updateDraft(e.currentTarget.value)
        }}
        onBlur={(e) => {
          composingRef.current = false
          commitDraft(e.currentTarget.value)
        }}
        onKeyDown={onKeyDown}
        enterKeyHint="done"
        placeholder={tags.length === 0 ? placeholder : ''}
        aria-label="태그 입력"
        className="flex-1 min-w-[180px] bg-transparent py-1 text-sm outline-none placeholder:text-ink-400"
      />
      <button
        type="button"
        onClick={() => {
          commitDraft(inputRef.current?.value ?? draft)
          inputRef.current?.focus()
        }}
        className="min-h-10 rounded-md border border-craft-200 px-3 text-sm text-ink-700 hover:bg-craft-100 dark:border-ink-600 dark:text-craft-100 dark:hover:bg-ink-800"
        aria-label="태그 추가"
      >
        추가
      </button>
    </div>
  )
}
