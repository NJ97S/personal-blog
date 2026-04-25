import { createClient } from '@/lib/supabase/server'
import CommentForm from './CommentForm'
import CommentItem from './CommentItem'

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
    .from('public_comments')
    .select('id, author_name, content, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(200)

  const items: Comment[] = comments ?? []

  return (
    <section className="mt-16 pt-8 border-t border-craft-200 dark:border-ink-600">
      <h2 className="text-xl font-serif font-bold mb-4">댓글 {items.length}</h2>

      <ul className="space-y-4 mb-8">
        {items.length === 0 && (
          <li className="text-sm text-ink-400">아직 댓글이 없습니다.</li>
        )}
        {items.map((c) => (
          <CommentItem key={c.id} comment={c} postSlug={postSlug} />
        ))}
      </ul>

      <CommentForm postId={postId} postSlug={postSlug} />
    </section>
  )
}
