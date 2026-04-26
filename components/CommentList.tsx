'use client'

import { useState, useCallback } from 'react'
import CommentForm from './CommentForm'
import CommentItem from './CommentItem'

export type CommentRow = {
  id: string
  author_name: string
  content: string
  created_at: string
}

export default function CommentList({
  postId,
  postSlug,
  initial,
}: {
  postId: string
  postSlug: string
  initial: CommentRow[]
}) {
  const [comments, setComments] = useState<CommentRow[]>(initial)

  const handleCreated = useCallback((c: CommentRow) => {
    setComments((prev) => [...prev, c])
  }, [])

  const handleUpdated = useCallback((id: string, newContent: string) => {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, content: newContent } : c)))
  }, [])

  const handleDeleted = useCallback((id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return (
    <section className="mt-8 pt-8 border-t border-craft-200 dark:border-ink-600">
      <h2 className="text-xl font-serif font-bold mb-4">댓글 {comments.length}</h2>

      <ul className="space-y-4 mb-8">
        {comments.length === 0 && (
          <li className="text-sm text-ink-400">아직 댓글이 없습니다.</li>
        )}
        {comments.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            postSlug={postSlug}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        ))}
      </ul>

      <CommentForm postId={postId} postSlug={postSlug} onCreated={handleCreated} />
    </section>
  )
}
