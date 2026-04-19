import { notFound } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import Layout from '@/components/Layout'
import Comments from '@/components/Comments'
import { createClient } from '@/lib/supabase/server'
import { fetchCategoryTree, walkTree } from '@/lib/categories'

export const dynamicParams = true
export const revalidate = false

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code || []),
      ['className', /^language-[a-z0-9-]+$/, /^hljs(-[a-z0-9-]+)?$/],
    ],
    span: [
      ...(defaultSchema.attributes?.span || []),
      ['className', /^hljs(-[a-z0-9-]+)?$/],
    ],
    pre: [
      ...(defaultSchema.attributes?.pre || []),
      ['className', /^hljs(-[a-z0-9-]+)?$/],
    ],
  },
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const { data: post } = await supabase
    .from('posts')
    .select('title, excerpt')
    .eq('slug', params.slug)
    .eq('published', true)
    .single()

  if (!post) return { title: '글을 찾을 수 없습니다' }
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
  }
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const supabase = createClient()

  const [{ data: post }, tree] = await Promise.all([
    supabase
      .from('posts')
      .select('id, title, slug, content, tags, published, created_at, category_id')
      .eq('slug', params.slug)
      .eq('published', true)
      .single(),
    fetchCategoryTree(),
  ])

  if (!post) notFound()

  const flatNodes = walkTree(tree)
  const categoryNode = post.category_id
    ? flatNodes.find((n) => n.id === post.category_id) ?? null
    : null
  const ancestors = categoryNode
    ? categoryNode.path.map((slug, i) => {
        const path = categoryNode.path.slice(0, i + 1)
        const node = flatNodes.find((n) => n.path.join('/') === path.join('/'))
        return { slug, name: node?.name ?? slug, path }
      })
    : []

  return (
    <Layout>
      <article className="max-w-3xl mx-auto">
        <header className="mb-8 pb-6 border-b border-craft-200 dark:border-ink-600">
          {ancestors.length > 0 && (
            <nav
              aria-label="breadcrumb"
              className="mb-3 text-xs font-mono text-ink-400 flex flex-wrap items-center gap-1"
            >
              <Link href="/" className="hover:text-ink-900 dark:hover:text-craft-50">
                Home
              </Link>
              {ancestors.map((a) => (
                <span key={a.path.join('/')} className="flex items-center gap-1">
                  <span aria-hidden>›</span>
                  <Link
                    href={`/categories/${a.path.map(encodeURIComponent).join('/')}`}
                    className="hover:text-ink-900 dark:hover:text-craft-50"
                  >
                    {a.name}
                  </Link>
                </span>
              ))}
            </nav>
          )}
          <h1 className="text-3xl md:text-4xl font-serif font-bold mb-3">{post.title}</h1>
          <p className="text-sm text-ink-400">{formatDate(post.created_at)}</p>
          {post.tags?.length > 0 && (
            <ul className="flex flex-wrap gap-2 mt-3">
              {post.tags.map((tag: string) => (
                <li key={tag}>
                  <Link
                    href={`/tags/${encodeURIComponent(tag)}`}
                    className="text-xs font-mono text-ink-400 hover:text-ink-900 dark:hover:text-craft-50"
                  >
                    #{tag}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </header>

        <div className="craft-prose prose-neutral dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkBreaks]}
            rehypePlugins={[rehypeHighlight, [rehypeSanitize, sanitizeSchema]]}
          >
            {post.content}
          </ReactMarkdown>
        </div>

        <Comments postId={post.id} postSlug={post.slug} />
      </article>
    </Layout>
  )
}
