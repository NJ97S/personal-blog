'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import PostCard from './PostCard'
import { loadMorePosts } from '@/app/actions/feed'
import type { FeedItem } from '@/lib/feed'

type Props = {
  initialItems: FeedItem[]
  initialCursor: string | null
  categoryIds?: string[] | null
}

export default function InfinitePostList({
  initialItems,
  initialCursor,
  categoryIds,
}: Props) {
  const [items, setItems] = useState<FeedItem[]>(initialItems)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingRef = useRef(false)
  const seenIdsRef = useRef<Set<string>>(
    new Set(initialItems.map((item) => item.id)),
  )

  const fetchMore = useCallback(async () => {
    if (loadingRef.current) return
    if (!cursor) return
    loadingRef.current = true
    setLoading(true)
    setError(null)
    try {
      const res = await loadMorePosts({ cursor, categoryIds })
      const fresh = res.items.filter((item) => {
        if (seenIdsRef.current.has(item.id)) return false
        seenIdsRef.current.add(item.id)
        return true
      })
      if (fresh.length > 0) {
        setItems((prev) => [...prev, ...fresh])
      }
      setCursor(res.nextCursor)
    } catch {
      setError('글을 더 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [cursor, categoryIds])

  useEffect(() => {
    if (!cursor) return
    const el = sentinelRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          fetchMore()
        }
      },
      { rootMargin: '400px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [cursor, fetchMore])

  return (
    <>
      <div className="space-y-4">
        {items.map((item) => (
          <PostCard
            key={item.id}
            id={item.id}
            title={item.title}
            slug={item.slug}
            excerpt={item.excerpt}
            tags={item.tags ?? []}
            created_at={item.created_at}
            coverImage={item.cover_image}
            category={item.category}
          />
        ))}
      </div>

      {error && (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 text-center text-sm text-red-500"
        >
          {error}
        </p>
      )}

      {cursor && (
        <div
          ref={sentinelRef}
          className="mt-8 flex flex-col items-center gap-3"
        >
          {loading ? (
            <p className="text-sm text-ink-400" aria-live="polite">
              불러오는 중…
            </p>
          ) : (
            <button
              type="button"
              onClick={fetchMore}
              className="craft-card px-4 py-2 text-sm hover:bg-craft-100 dark:hover:bg-ink-800"
            >
              더 보기
            </button>
          )}
        </div>
      )}

      {!cursor && items.length > 0 && (
        <p className="mt-8 text-center text-xs font-mono text-ink-400">
          — 마지막 글입니다 —
        </p>
      )}
    </>
  )
}
