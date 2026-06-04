'use client'

import { useEffect, useRef, useState } from 'react'
import { Link2, Check } from 'lucide-react'

export default function ShareButton() {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      // 빠른 연속 클릭 시 이전 타이머가 살아있으면 정리합니다.
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setCopied(false)
        timerRef.current = null
      }, 1500)
    } catch {
      // 클립보드 권한 거부 등 — 사용자에게 알리지 않는 정책 유지.
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
