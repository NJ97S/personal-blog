import { notFound } from 'next/navigation'
import Layout from '@/components/Layout'
import CategoryPicker from '@/components/CategoryPicker'
import { createClient } from '@/lib/supabase/server'
import { fetchCategoryTree } from '@/lib/categories'
import EditPostForm from './EditPostForm'

export const dynamic = 'force-dynamic'

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [{ data: post }, tree] = await Promise.all([
    supabase
      .from('posts')
      .select(
        'id, title, slug, content, excerpt, tags, published, cover_image, category_id',
      )
      .eq('id', params.id)
      .single(),
    fetchCategoryTree(),
  ])

  if (!post) notFound()

  return (
    <Layout>
      <h1 className="text-2xl font-serif font-bold mb-6">글 편집</h1>
      <EditPostForm
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          content: post.content,
          excerpt: post.excerpt ?? '',
          tags: post.tags ?? [],
          published: post.published,
          coverImage: post.cover_image ?? '',
          categoryId: post.category_id ?? null,
        }}
        categoryPicker={
          <CategoryPicker categories={tree} defaultValue={post.category_id ?? null} />
        }
      />
    </Layout>
  )
}
