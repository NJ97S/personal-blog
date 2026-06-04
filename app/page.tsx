import Layout from '@/components/Layout'
import InfinitePostList from '@/components/InfinitePostList'
import JsonLd from '@/components/JsonLd'
import { createClient } from '@/lib/supabase/server'
import { fetchCategoryTree, walkTree } from '@/lib/categories'
import { site } from '@/lib/site'
import { FEED_PAGE_SIZE, type FeedItem } from '@/lib/feed'

// 홈 피드는 1분 간격 ISR. 발행/수정 시 revalidatePath('/')가 즉시 무효화하므로
// 신규 글 지연이 사실상 0이며, 매 요청 Supabase 왕복을 제거해 TTFB가 줄어듭니다.
export const revalidate = 60

export default async function Home() {
  const supabase = createClient()

  const query = supabase
    .from('posts')
    .select(
      'id, title, slug, excerpt, tags, created_at, cover_image, category_id',
    )
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(FEED_PAGE_SIZE + 1)

  const [{ data: rows, error }, tree] = await Promise.all([query, fetchCategoryTree()])

  const posts = rows ?? []
  const hasMore = posts.length > FEED_PAGE_SIZE
  const visible = hasMore ? posts.slice(0, FEED_PAGE_SIZE) : posts
  const categoryById = new Map(walkTree(tree).map((n) => [n.id, n] as const))

  const initialItems: FeedItem[] = visible.map((row) => {
    const cat = row.category_id ? categoryById.get(row.category_id) : undefined
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      tags: row.tags,
      created_at: row.created_at,
      cover_image: row.cover_image,
      category: cat ? { name: cat.name, path: cat.path } : null,
    }
  })

  const initialCursor = hasMore
    ? initialItems[initialItems.length - 1]?.created_at ?? null
    : null

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    description: site.description,
    url: site.url,
    inLanguage: 'ko',
    publisher: {
      '@type': 'Person',
      name: site.author.name,
      url: site.author.url,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${site.url}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <Layout>
      <JsonLd data={websiteSchema} />
      <section className="mb-8">
        <h1 className="text-3xl font-serif font-bold mb-2">ShyLog</h1>
        <p className="text-ink-400">종이 위에 남기는 작은 기술 노트들</p>
      </section>

      {error && (
        <p className="craft-card p-4 text-sm text-ink-400">
          글을 불러오지 못했습니다. Supabase 환경변수를 확인해주세요.
        </p>
      )}

      {!error && initialItems.length === 0 && (
        <p className="craft-card p-4 text-sm text-ink-400">아직 발행된 글이 없습니다.</p>
      )}

      {initialItems.length > 0 && (
        <InfinitePostList
          initialItems={initialItems}
          initialCursor={initialCursor}
        />
      )}
    </Layout>
  )
}
