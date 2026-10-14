'use client'

import { useEffect, useState } from 'react'
import { trackView } from '@/app/actions/views'

export default function PostViewCount({ postId }: { postId: string }) {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    let active = true
    setCount(null)
    void trackView(postId).then((result) => {
      if (active) setCount(result)
    }).catch(() => {})
    return () => { active = false }
  }, [postId])
  return <span className="inline-block" title="같은 게시글은 4시간 내 중복 제외">조회수 {count?.toLocaleString('ko-KR') ?? '—'}</span>
}
