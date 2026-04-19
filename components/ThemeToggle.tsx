'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggle = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="다크 모드 전환"
      onClick={toggle}
      className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-craft-200 dark:border-ink-600 bg-craft-100 dark:bg-ink-800 transition-colors"
    >
      <span aria-hidden className="absolute left-1.5 text-[10px] leading-none text-ink-400">
        ☀
      </span>
      <span aria-hidden className="absolute right-1.5 text-[10px] leading-none text-ink-400">
        ☾
      </span>
      <span
        aria-hidden
        className={`relative z-10 inline-block h-5 w-5 rounded-full bg-white dark:bg-craft-50 shadow transition-transform ${
          isDark ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
