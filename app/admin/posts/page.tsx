import Link from 'next/link'
import Layout from '@/components/Layout'
import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/actions/posts'

export const dynamic = 'force-dynamic'

type SearchParams = { status?: 'all' | 'published' | 'draft' }

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const status = searchParams.status ?? 'all'
  const supabase = createClient()

  let query = supabase
    .from('posts')
    .select('id, title, slug, published, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (status === 'published') query = query.eq('published', true)
  if (status === 'draft') query = query.eq('published', false)

  const { data: posts } = await query

  return (
    <Layout>
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold">글 관리</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/categories"
            className="craft-card px-4 py-2 text-sm hover:bg-craft-100 dark:hover:bg-ink-800"
          >
            카테고리 관리
          </Link>
          <Link
            href="/admin/posts/new"
            className="craft-card px-4 py-2 text-sm bg-craft-100 dark:bg-ink-800 hover:bg-craft-200 dark:hover:bg-ink-600"
          >
            + 새 글
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="craft-card px-4 py-2 text-sm hover:bg-craft-100 dark:hover:bg-ink-800"
            >
              로그아웃
            </button>
          </form>
        </div>
      </header>

      <nav className="flex gap-3 text-sm mb-6">
        <Link
          href="/admin/posts?status=all"
          className={`${status === 'all' ? 'underline underline-offset-4' : 'text-ink-400'}`}
        >
          전체
        </Link>
        <Link
          href="/admin/posts?status=published"
          className={`${status === 'published' ? 'underline underline-offset-4' : 'text-ink-400'}`}
        >
          발행됨
        </Link>
        <Link
          href="/admin/posts?status=draft"
          className={`${status === 'draft' ? 'underline underline-offset-4' : 'text-ink-400'}`}
        >
          초안
        </Link>
      </nav>

      <ul className="space-y-3">
        {(posts ?? []).map((post) => (
          <li key={post.id} className="craft-card p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <Link
                  href={`/admin/posts/${post.id}/edit`}
                  className="font-serif font-bold truncate hover:underline"
                >
                  {post.title}
                </Link>
                {!post.published && (
                  <span className="text-xs text-ink-400 border border-craft-200 dark:border-ink-600 px-2 py-0.5 rounded-sm">
                    draft
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-400 font-mono truncate">/{post.slug}</p>
            </div>
            <Link
              href={`/admin/posts/${post.id}/edit`}
              className="text-sm text-ink-400 hover:text-ink-900 dark:hover:text-craft-50"
            >
              편집
            </Link>
          </li>
        ))}
        {(!posts || posts.length === 0) && (
          <li className="craft-card p-4 text-sm text-ink-400">작성된 글이 없습니다.</li>
        )}
      </ul>
    </Layout>
  )
}
