import { notFound } from 'next/navigation'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase/server'
import EditPostForm from './EditPostForm'

export const dynamic = 'force-dynamic'

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: post } = await supabase
    .from('posts')
    .select('id, title, slug, content, excerpt, tags, published, cover_image')
    .eq('id', params.id)
    .single()

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
        }}
      />
    </Layout>
  )
}
