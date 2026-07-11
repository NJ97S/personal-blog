'use client'

import { useLayoutEffect, useRef } from 'react'

type Props = {
  name?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void
  placeholder?: string
}

export default function TitleInput({
  name = 'title',
  value,
  onChange,
  required,
  onBlur,
  placeholder = '제목을 입력하세요',
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = '0px'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [value])

  const normalizeTitle = (nextValue: string) => {
    return nextValue.replace(/\s*[\r\n]+\s*/g, ' ')
  }

  return (
    <textarea
      ref={textareaRef}
      name={name}
      value={value}
      onChange={(e) => onChange(normalizeTitle(e.target.value))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault()
      }}
      required={required}
      onBlur={onBlur}
      placeholder={placeholder}
      aria-label="제목"
      rows={1}
      className="block min-h-[3.25rem] w-full resize-none overflow-hidden break-words border-0 border-b border-craft-200 bg-transparent py-2 font-serif text-2xl font-bold leading-tight outline-none transition-colors placeholder:text-craft-300 focus:border-ink-900 dark:border-ink-600 dark:placeholder:text-ink-600 dark:focus:border-craft-50 sm:min-h-[4.5rem] sm:py-3 sm:text-4xl"
    />
  )
}
