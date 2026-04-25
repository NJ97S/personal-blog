'use client'

import { useEffect, useState } from 'react'

// 페이지 하이드레이션 완료 여부.
// React Server Action 폼에서 하이드레이션 전 submit 시 브라우저 native POST 가 발생하면서
// 페이지 풀 네비게이션이 일어나는 문제를 막기 위해 submit 버튼을 hydration 완료까지 비활성화한다.
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated
}
