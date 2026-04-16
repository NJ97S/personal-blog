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
      onClick={toggle}
      aria-label="테마 전환"
      className="rounded-sm border border-craft-200 dark:border-ink-600 px-3 py-1.5 text-sm hover:bg-craft-100 dark:hover:bg-ink-800 transition-colors"
    >
      {isDark ? '☀ 라이트' : '☾ 다크'}
    </button>
  )
}
