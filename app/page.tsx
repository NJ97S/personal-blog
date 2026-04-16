import Link from 'next/link'
import Layout from '@/components/Layout'
import PostCard from '@/components/PostCard'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 10

type SearchParams = { cursor?: string }

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = createClient()

  let query = supabase
    .from('posts')
    .select('id, title, slug, excerpt, tags, published, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1)

  if (searchParams.cursor) {
    query = query.lt('created_at', searchParams.cursor)
  }

  const { data: rows, error } = await query

  const posts = rows ?? []
  const hasMore = posts.length > PAGE_SIZE
  const visible = hasMore ? posts.slice(0, PAGE_SIZE) : posts
  const nextCursor = hasMore ? visible[visible.length - 1]?.created_at : null

  return (
    <Layout>
      <section className="mb-8">
        <h1 className="text-3xl font-serif font-bold mb-2">기록</h1>
        <p className="text-ink-400">종이 위에 남기는 작은 기술 노트들</p>
      </section>

      {error && (
        <p className="craft-card p-4 text-sm text-ink-400">
          글을 불러오지 못했습니다. Supabase 환경변수를 확인해주세요.
        </p>
      )}

      {!error && visible.length === 0 && (
        <p className="craft-card p-4 text-sm text-ink-400">아직 발행된 글이 없습니다.</p>
      )}

      <div className="space-y-4">
        {visible.map((post) => (
          <PostCard
            key={post.id}
            id={post.id}
            title={post.title}
            slug={post.slug}
            excerpt={post.excerpt}
            tags={post.tags ?? []}
            published={post.published}
            created_at={post.created_at}
          />
        ))}
      </div>

      {nextCursor && (
        <nav className="mt-8 flex justify-center">
          <Link
            href={`/?cursor=${encodeURIComponent(nextCursor)}`}
            className="craft-card px-4 py-2 text-sm hover:bg-craft-100 dark:hover:bg-ink-800"
          >
            다음 페이지
          </Link>
        </nav>
      )}
    </Layout>
  )
}
