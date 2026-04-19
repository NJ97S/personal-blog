import Layout from '@/components/Layout'
import PostCard from '@/components/PostCard'
import { createClient } from '@/lib/supabase/server'
import { fetchCategoryTree, walkTree } from '@/lib/categories'
import { site } from '@/lib/site'

export const revalidate = 60

export async function generateMetadata({ params }: { params: { tag: string } }) {
  const tag = decodeURIComponent(params.tag)
  const canonicalPath = `/tags/${encodeURIComponent(tag)}`
  const title = `#${tag}`
  const description = `#${tag} 태그의 글 모음 · ${site.name}`
  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'website',
      url: canonicalPath,
      title,
      description,
      siteName: site.name,
      locale: site.locale,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function TagPage({ params }: { params: { tag: string } }) {
  const tag = decodeURIComponent(params.tag)
  const supabase = createClient()

  const [{ data: posts }, tree] = await Promise.all([
    supabase
      .from('posts')
      .select(
        'id, title, slug, excerpt, tags, published, created_at, cover_image, category_id',
      )
      .eq('published', true)
      .contains('tags', [tag])
      .order('created_at', { ascending: false }),
    fetchCategoryTree(),
  ])

  const categoryById = new Map(walkTree(tree).map((n) => [n.id, n] as const))

  return (
    <Layout>
      <section className="mb-8">
        <h1 className="text-2xl font-serif font-bold mb-2">
          <span className="font-mono text-ink-400">#</span>
          {tag}
        </h1>
        <p className="text-ink-400 text-sm">태그별 모아보기</p>
      </section>

      <div className="space-y-4">
        {(posts ?? []).map((post) => {
          const cat = post.category_id ? categoryById.get(post.category_id) : undefined
          return (
            <PostCard
              key={post.id}
              id={post.id}
              title={post.title}
              slug={post.slug}
              excerpt={post.excerpt}
              tags={post.tags ?? []}
              published={post.published}
              created_at={post.created_at}
              coverImage={post.cover_image}
              category={cat ? { name: cat.name, path: cat.path } : null}
            />
          )
        })}
        {(!posts || posts.length === 0) && (
          <p className="craft-card p-4 text-sm text-ink-400">이 태그의 글이 없습니다.</p>
        )}
      </div>
    </Layout>
  )
}
