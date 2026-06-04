import Layout from '@/components/Layout'
import PostCard from '@/components/PostCard'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type SearchParams = { q?: string }

const MIN_QUERY_LENGTH = 2
const MAX_TERMS = 5

function sanitize(q: string): string {
  // allow-list: 영문/숫자/한글/공백/하이픈/언더스코어만 유지.
  // PostgREST filter grammar 문자(`.`, `,`, `(`, `)`, `%`, `:`, `!`, `*`, `"`, `'`) 차단.
  return q
    .replace(/[^a-zA-Z0-9가-힣ㄱ-ㆎ\s\-_]/g, '')
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
  const raw = (searchParams.q ?? '').trim()

  // '#tag' 로 시작하면 태그 페이지로 위임 (단일 source of truth)
  const hashtagMatch = raw.match(/^#(\S+)/)
  if (hashtagMatch) {
    const tag = sanitize(hashtagMatch[1])
    if (tag) {
      redirect(`/tags/${encodeURIComponent(tag)}`)
    }
  }

  const q = sanitize(raw)
  const tooShort = q.length > 0 && q.length < MIN_QUERY_LENGTH
  const terms = q.split(/\s+/).filter((t) => t.length > 0).slice(0, MAX_TERMS)

  let posts: Array<{
    id: string
    title: string
    slug: string
    excerpt: string | null
    tags: string[] | null
    created_at: string
    cover_image: string | null
  }> = []

  if (q && !tooShort && terms.length > 0) {
    const supabase = createClient()
    let builder = supabase
      .from('posts')
      .select('id, title, slug, excerpt, tags, created_at, cover_image')
      .eq('visibility', 'public')

    // 다중 토큰 AND 매칭: 각 토큰이 (title OR excerpt) 중 하나에 매치되어야 함.
    // PostgreSQL LIKE 메타문자(%, _, \)는 이스케이프하여 패턴 인젝션을 차단합니다.
    // (sanitize()는 PostgREST 필터 문법 문자를 제거하지만 LIKE 메타문자는 보존되므로
    //  여기서 한 번 더 방어합니다.)
    const escapeLike = (s: string) => s.replace(/[%_\\]/g, '\\$&')
    for (const t of terms) {
      const e = escapeLike(t)
      builder = builder.or(`title.ilike.%${e}%,excerpt.ilike.%${e}%`)
    }

    const { data } = await builder
      .order('created_at', { ascending: false })
      .limit(50)
    posts = data ?? []
  }

  return (
    <Layout>
      <section className="mb-8">
        <h1 className="text-2xl font-serif font-bold mb-2">검색</h1>
        <p className="text-ink-400 text-sm">
          {tooShort ? (
            <>두 글자 이상 입력해주세요.</>
          ) : q ? (
            <>
              <span className="font-mono">“{q}”</span> · {posts.length}건
            </>
          ) : (
            '검색어를 입력하세요. (#태그도 가능합니다)'
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
        {q && !tooShort && posts.length === 0 && (
          <p className="craft-card p-4 text-sm text-ink-400">검색 결과가 없습니다.</p>
        )}
      </div>
    </Layout>
  )
}
