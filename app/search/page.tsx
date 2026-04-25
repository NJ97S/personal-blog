import Layout from '@/components/Layout'
import PostCard from '@/components/PostCard'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type SearchParams = { q?: string }

function sanitize(q: string): string {
  // allow-list: 영문/숫자/한글/공백/하이픈/언더스코어만 유지.
  // PostgREST filter grammar 문자(`.`, `,`, `(`, `)`, `%`, `:`, `!`, `*`, `"`, `'`) 차단.
  return q
    .replace(/[^a-zA-Z0-9\uAC00-\uD7A3\u3131-\u318E\s\-_]/g, '')
    .slice(0, 100)
    .trim()
}

export function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const q = sanitize(searchParams.q ?? '')
  return {
    title: q ? `검색: ${q}` : '검색',
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const raw = searchParams.q ?? ''
  const q = sanitize(raw)

  let posts: Array<{
    id: string
    title: string
    slug: string
    excerpt: string | null
    tags: string[] | null
    created_at: string
    cover_image: string | null
  }> = []

  if (q) {
    const supabase = createClient()
    const { data } = await supabase
      .from('posts')
      .select('id, title, slug, excerpt, tags, created_at, cover_image')
      .eq('visibility', 'public')
      .or(`title.ilike.%${q}%,excerpt.ilike.%${q}%,content.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(50)
    posts = data ?? []
  }

  return (
    <Layout>
      <section className="mb-8">
        <h1 className="text-2xl font-serif font-bold mb-2">검색</h1>
        <p className="text-ink-400 text-sm">
          {q ? (
            <>
              <span className="font-mono">“{q}”</span> · {posts.length}건
            </>
          ) : (
            '검색어를 입력하세요.'
          )}
        </p>
      </section>

      <div className="space-y-4">
        {posts.map((p) => (
          <PostCard
            key={p.id}
            id={p.id}
            title={p.title}
            slug={p.slug}
            excerpt={p.excerpt}
            tags={p.tags ?? []}
            created_at={p.created_at}
            coverImage={p.cover_image}
          />
        ))}
        {q && posts.length === 0 && (
          <p className="craft-card p-4 text-sm text-ink-400">검색 결과가 없습니다.</p>
        )}
      </div>
    </Layout>
  )
}
