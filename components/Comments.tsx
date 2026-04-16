import { createClient } from '@/lib/supabase/server'
import CommentForm from './CommentForm'

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ko-KR')
  } catch {
    return iso
  }
}

type Comment = {
  id: string
  author_name: string
  content: string
  created_at: string
}

export default async function Comments({
  postId,
  postSlug,
}: {
  postId: string
  postSlug: string
}) {
  const supabase = createClient()
  const { data: comments } = await supabase
    .from('comments')
    .select('id, author_name, content, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  const items: Comment[] = comments ?? []

  return (
    <section className="mt-16 pt-8 border-t border-craft-200 dark:border-ink-600">
      <h2 className="text-xl font-serif font-bold mb-4">댓글 {items.length}</h2>

      <ul className="space-y-4 mb-8">
        {items.length === 0 && (
          <li className="text-sm text-ink-400">아직 댓글이 없습니다.</li>
        )}
        {items.map((c) => (
          <li key={c.id} className="craft-card p-4">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <strong className="text-sm font-serif">{c.author_name}</strong>
              <span className="text-xs text-ink-400">{formatDate(c.created_at)}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
          </li>
        ))}
      </ul>

      <CommentForm postId={postId} postSlug={postSlug} />
    </section>
  )
}
