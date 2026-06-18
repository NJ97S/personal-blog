'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { useRouter } from 'next/navigation'

// 연속 클릭 사이 최대 허용 간격(ms). 이 시간이 지나면 카운트가 초기화됩니다.
const CLICK_WINDOW = 600
// 이스터에그 발동에 필요한 연속 클릭 횟수.
const TRIGGER_COUNT = 5

export default function Logo() {
  const router = useRouter()
  const countRef = useRef(0)
  const lastClickRef = useRef(0)

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const now = Date.now()
    // 직전 클릭과의 간격이 짧으면 연속 클릭으로 누적, 아니면 1부터 다시 셉니다.
    countRef.current =
      now - lastClickRef.current <= CLICK_WINDOW ? countRef.current + 1 : 1
    lastClickRef.current = now

    if (countRef.current >= TRIGGER_COUNT) {
      countRef.current = 0
      e.preventDefault()
      // 미들웨어가 인증 상태에 따라 로그인 또는 관리자 페이지로 안내합니다.
      router.push('/admin/login')
    }
  }

  return (
    <Link
      href="/"
      onClick={onClick}
      className="text-xl font-serif font-bold tracking-tight"
    >
      ShyLog
    </Link>
  )
}
