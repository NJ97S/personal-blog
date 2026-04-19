'use client'

import { useState } from 'react'
import { Link2, Check } from 'lucide-react'

export default function ShareButton() {
  const [copied, setCopied] = useState(false)

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // noop
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="링크 복사"
      className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-900 dark:hover:text-craft-50"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" aria-hidden /> 복사됨
        </>
      ) : (
        <>
          <Link2 className="h-4 w-4" aria-hidden /> 공유
        </>
      )}
    </button>
  )
}
