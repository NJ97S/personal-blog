import { createClient } from '@/lib/supabase/server'
import CommentList, { type CommentRow } from './CommentList'

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

  const initial: CommentRow[] = comments ?? []

  return <CommentList postId={postId} postSlug={postSlug} initial={initial} />
}
