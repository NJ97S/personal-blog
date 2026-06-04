'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

type Heading = { id: string; text: string; level: number }

export default function PostToc() {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const navRef = useRef<HTMLElement>(null)
  // 동일 라우트 패턴(/posts/[slug]) 사이 SPA 전환 시 컴포넌트가 재사용되며
  // 빈 deps 효과는 다시 실행되지 않습니다. pathname을 deps에 넣어 다른 글로
  // 이동했을 때도 목차를 새로 수집합니다.
  const pathname = usePathname()

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
    setActiveId('')

    if (collected.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-80px 0px -70% 0px' },
    )

    collected.forEach((h) => {
      const el = document.getElementById(h.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [pathname])

  useEffect(() => {
    const nav = navRef.current
    if (!nav || !activeId) return
    const link = nav.querySelector<HTMLElement>(`a[href="#${CSS.escape(activeId)}"]`)
    if (!link) return
    const navRect = nav.getBoundingClientRect()
    const linkRect = link.getBoundingClientRect()
    const margin = 8
    let delta = 0
    if (linkRect.top < navRect.top + margin) {
      delta = linkRect.top - navRect.top - margin
    } else if (linkRect.bottom > navRect.bottom - margin) {
      delta = linkRect.bottom - navRect.bottom + margin
    }
    if (delta !== 0) {
      nav.scrollTo({ top: nav.scrollTop + delta, behavior: 'smooth' })
    }
  }, [activeId])

  if (headings.length === 0) return null

  return (
    <nav
      ref={navRef}
      aria-label="목차"
      className="sticky top-24 text-sm max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-hidden"
    >
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
