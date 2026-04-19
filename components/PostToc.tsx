'use client'

import { useEffect, useState } from 'react'

type Heading = { id: string; text: string; level: number }

export default function PostToc() {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    const article = document.querySelector('article')
    if (!article) return

    const collected: Heading[] = Array.from(
      article.querySelectorAll<HTMLElement>('h1, h2, h3'),
    )
      .filter((h) => !!h.id)
      .map((h) => ({
        id: h.id,
        text: h.textContent?.trim() ?? '',
        level: Number(h.tagName[1]),
      }))

    setHeadings(collected)

    if (collected.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-20% 0% -60% 0%' },
    )

    collected.forEach((h) => {
      const el = document.getElementById(h.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  if (headings.length === 0) return null

  return (
    <nav aria-label="목차" className="sticky top-24 text-sm">
      <p className="font-serif font-bold mb-2 text-ink-900 dark:text-craft-50">목차</p>
      <ul className="space-y-1 border-l border-craft-200 dark:border-ink-600">
        {headings.map((h) => {
          const active = h.id === activeId
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                style={{ paddingLeft: 12 + (h.level - 1) * 12 }}
                className={`block py-1 pr-2 -ml-px border-l hover:text-ink-900 dark:hover:text-craft-50 ${
                  active
                    ? 'border-ink-900 dark:border-craft-50 text-ink-900 dark:text-craft-50 font-bold'
                    : 'border-transparent text-ink-400'
                }`}
              >
                {h.text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
