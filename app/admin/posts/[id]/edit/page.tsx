import { notFound } from 'next/navigation'
import CategoryPicker from '@/components/CategoryPicker'
import { createClient } from '@/lib/supabase/server'
import { fetchCategoryTree } from '@/lib/categories'
import type { PostVisibility } from '@/app/actions/posts'
import EditPostForm from './EditPostForm'

export const dynamic = 'force-dynamic'

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [{ data: post }, tree] = await Promise.all([
    supabase
      .from('posts')
      .select(
        'id, title, slug, content, excerpt, tags, visibility, cover_image, category_id',
      )
      .eq('id', params.id)
      .single(),
    fetchCategoryTree(),
  ])

  if (!post) notFound()

  return (
    <EditPostForm
      post={{
        id: post.id,
        title: post.title,
        slug: post.slug,
        content: post.content,
        excerpt: post.excerpt ?? '',
        tags: post.tags ?? [],
        visibility: (post.visibility ?? 'draft') as PostVisibility,
        coverImage: post.cover_image ?? '',
        categoryId: post.category_id ?? null,
      }}
      categoryPicker={
        <CategoryPicker categories={tree} defaultValue={post.category_id ?? null} />
      }
    />
  )
}
