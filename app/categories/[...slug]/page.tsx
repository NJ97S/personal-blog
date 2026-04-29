import { notFound } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/Layout'
import InfinitePostList from '@/components/InfinitePostList'
import JsonLd from '@/components/JsonLd'
import { createClient } from '@/lib/supabase/server'
import {
  findCategoryByPath,
  collectDescendantIds,
  fetchCategoryTree,
  walkTree,
} from '@/lib/categories'
import { site } from '@/lib/site'
import { FEED_PAGE_SIZE, type FeedItem } from '@/lib/feed'

export const revalidate = 60

type Params = { slug: string[] }

export async function generateMetadata({ params }: { params: Params }) {
  const slugs = params.slug.map((s) => decodeURIComponent(s))
  const node = await findCategoryByPath(slugs)
  if (!node) return { title: '카테고리' }
  const canonicalPath = `/categories/${slugs.map(encodeURIComponent).join('/')}`
  const title = `${node.name} 카테고리`
  const description = `${node.name} 카테고리의 글 모음 · ${site.name}`
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

export default async function CategoryPage({ params }: { params: Params }) {
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

  const { data: rows } = await supabase
    .from('posts')
    .select(
      'id, title, slug, excerpt, tags, created_at, cover_image, category_id',
    )
    .eq('visibility', 'public')
    .in('category_id', ids)
    .order('created_at', { ascending: false })
    .limit(FEED_PAGE_SIZE + 1)

  const posts = rows ?? []
  const hasMore = posts.length > FEED_PAGE_SIZE
  const visible = hasMore ? posts.slice(0, FEED_PAGE_SIZE) : posts

  const categoryById = new Map(all.map((n) => [n.id, n] as const))
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

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: site.url },
      ...breadcrumbNodes.map((bn, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: bn?.name ?? slugs[i],
        item: bn
          ? `${site.url}/categories/${bn.path.map(encodeURIComponent).join('/')}`
          : `${site.url}/categories/${slugs.slice(0, i + 1).map(encodeURIComponent).join('/')}`,
      })),
    ],
  }

  return (
    <Layout>
      <JsonLd data={breadcrumbSchema} />
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

      {initialItems.length === 0 ? (
        <p className="craft-card p-4 text-sm text-ink-400">
          이 카테고리에는 아직 글이 없습니다.
        </p>
      ) : (
        <InfinitePostList
          initialItems={initialItems}
          initialCursor={initialCursor}
          categoryIds={ids}
        />
      )}
    </Layout>
  )
}
