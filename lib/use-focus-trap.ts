'use client'

import { useEffect, useRef } from 'react'

// 다이얼로그/드로어 같은 모달 패턴에서 키보드 포커스를 컨테이너 내부로 가두고,
// 닫힐 때 트리거 요소로 포커스를 복원합니다.
// 외부 라이브러리 의존을 피하기 위한 최소 구현 — 다음을 처리합니다:
//  1. open=true 진입 시 첫 포커스 가능 요소로 자동 포커스
//  2. Tab/Shift+Tab 순환 (마지막 → 첫, 첫 → 마지막)
//  3. close 시 이전 active element 로 포커스 복원
//
// 한계: 비동기 렌더로 자식이 늦게 추가되는 케이스는 매 Tab 마다 다시 쿼리해 흡수합니다.
// 비활성(open=false) 동안에는 어떤 부수효과도 발생시키지 않습니다.

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T | null>(null)

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const getFocusables = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null,
      )

    // 마이크로태스크로 미뤄 모달 콘텐츠가 렌더된 직후 포커스를 잡습니다.
    queueMicrotask(() => {
      const items = getFocusables()
      items[0]?.focus()
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = getFocusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      const activeEl = document.activeElement as HTMLElement | null
      const outside = !container.contains(activeEl)

      if (e.shiftKey && (outside || activeEl === firstEl)) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && (outside || activeEl === lastEl)) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    container.addEventListener('keydown', onKey)
    return () => {
      container.removeEventListener('keydown', onKey)
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [active])

  return containerRef
}
