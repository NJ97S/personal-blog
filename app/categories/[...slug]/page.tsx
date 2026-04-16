import { notFound } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/Layout'
import PostCard from '@/components/PostCard'
import { createClient } from '@/lib/supabase/server'
import {
  findCategoryByPath,
  collectDescendantIds,
  fetchCategoryTree,
  walkTree,
} from '@/lib/categories'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

type Params = { slug: string[] }
type SearchParams = { cursor?: string }

export async function generateMetadata({ params }: { params: Params }) {
  const slugs = params.slug.map((s) => decodeURIComponent(s))
  const node = await findCategoryByPath(slugs)
  if (!node) return { title: '카테고리' }
  return { title: `${node.name} 카테고리` }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const slugs = params.slug.map((s) => decodeURIComponent(s))
  const node = await findCategoryByPath(slugs)
  if (!node) notFound()

  const tree = await fetchCategoryTree()
  const all = walkTree(tree)
  const nameBySlugPath = new Map(all.map((n) => [n.path.join('/'), n] as const))
  const breadcrumbNodes = slugs.map((_, i) =>
    nameBySlugPath.get(slugs.slice(0, i + 1).join('/')),
  )

  const ids = collectDescendantIds(node)
  const supabase = createClient()

  let query = supabase
    .from('posts')
    .select(
      'id, title, slug, excerpt, tags, published, created_at, cover_image, category_id',
    )
    .eq('published', true)
    .in('category_id', ids)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1)

  if (searchParams.cursor) {
    query = query.lt('created_at', searchParams.cursor)
  }

  const { data: rows } = await query
  const posts = rows ?? []
  const hasMore = posts.length > PAGE_SIZE
  const visible = hasMore ? posts.slice(0, PAGE_SIZE) : posts
  const nextCursor = hasMore ? visible[visible.length - 1]?.created_at : null

  const categoryById = new Map(all.map((n) => [n.id, n] as const))

  return (
    <Layout>
      <section className="mb-6">
        <nav
          aria-label="breadcrumb"
          className="mb-2 text-xs font-mono text-ink-400 flex flex-wrap items-center gap-1"
        >
          <Link href="/" className="hover:text-ink-900 dark:hover:text-craft-50">
            Home
          </Link>
          {breadcrumbNodes.map((bn, i) => (
            <span key={i} className="flex items-center gap-1">
              <span aria-hidden>›</span>
              {bn ? (
                <Link
                  href={`/categories/${bn.path.map(encodeURIComponent).join('/')}`}
                  className="hover:text-ink-900 dark:hover:text-craft-50"
                >
                  {bn.name}
                </Link>
              ) : (
                <span>{slugs[i]}</span>
              )}
            </span>
          ))}
        </nav>
        <h1 className="text-2xl font-serif font-bold mb-1">{node.name}</h1>
        <p className="text-sm text-ink-400">
          총 {node.postCount}개의 글
          {node.children.length > 0 && ` · 하위 카테고리 ${node.children.length}개`}
        </p>
      </section>

      <div className="space-y-4">
        {visible.map((p) => {
          const cat = p.category_id ? categoryById.get(p.category_id) : undefined
          return (
            <PostCard
              key={p.id}
              id={p.id}
              title={p.title}
              slug={p.slug}
              excerpt={p.excerpt}
              tags={p.tags ?? []}
              published={p.published}
              created_at={p.created_at}
              coverImage={p.cover_image}
              category={cat ? { name: cat.name, path: cat.path } : null}
            />
          )
        })}
        {visible.length === 0 && (
          <p className="craft-card p-4 text-sm text-ink-400">
            이 카테고리에는 아직 글이 없습니다.
          </p>
        )}
      </div>

      {nextCursor && (
        <nav className="mt-8 flex justify-center">
          <Link
            href={`/categories/${slugs
              .map(encodeURIComponent)
              .join('/')}?cursor=${encodeURIComponent(nextCursor)}`}
            className="craft-card px-4 py-2 text-sm hover:bg-craft-100 dark:hover:bg-ink-800"
          >
            다음 페이지
          </Link>
        </nav>
      )}
    </Layout>
  )
}
