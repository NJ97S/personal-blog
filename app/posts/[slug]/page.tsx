import { notFound } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import Layout from '@/components/Layout'
import Comments from '@/components/Comments'
import PostToc from '@/components/PostToc'
import SeriesBox from '@/components/SeriesBox'
import ShareButton from '@/components/ShareButton'
import JsonLd from '@/components/JsonLd'
import { createClient } from '@/lib/supabase/server'
import { fetchCategoryTree, walkTree } from '@/lib/categories'
import { site } from '@/lib/site'

export const dynamic = 'force-dynamic'
export const dynamicParams = true

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'id'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'id'],
    h5: [...(defaultSchema.attributes?.h5 ?? []), 'id'],
    h6: [...(defaultSchema.attributes?.h6 ?? []), 'id'],
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

function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const slug = decodeSlug(params.slug)
  const { data: post } = await supabase
    .from('posts')
    .select('title, excerpt, tags, cover_image, created_at, updated_at')
    .eq('slug', slug)
    .eq('visibility', 'public')
    .maybeSingle()

  if (!post) return { title: '글을 찾을 수 없습니다' }

  const canonicalPath = `/posts/${encodeURI(slug)}`
  const description = post.excerpt ?? site.description
  const images = post.cover_image ? [{ url: post.cover_image }] : undefined

  return {
    title: post.title,
    description,
    authors: [{ name: site.author.name, url: site.author.url }],
    keywords: post.tags ?? undefined,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'article',
      url: canonicalPath,
      title: post.title,
      description,
      siteName: site.name,
      locale: site.locale,
      publishedTime: post.created_at ?? undefined,
      modifiedTime: post.updated_at ?? undefined,
      authors: [site.author.name],
      tags: post.tags ?? undefined,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: post.cover_image ? [post.cover_image] : undefined,
    },
  }
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const slug = decodeSlug(params.slug)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()
    isAdmin = !!profile?.is_admin
  }

  let postQuery = supabase
    .from('posts')
    .select(
      'id, title, slug, content, excerpt, tags, visibility, cover_image, created_at, updated_at, category_id',
    )
    .eq('slug', slug)
  if (!isAdmin) postQuery = postQuery.eq('visibility', 'public')

  const [{ data: post }, tree] = await Promise.all([
    postQuery.maybeSingle(),
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

  let seriesPosts: { id: string; slug: string; title: string }[] = []
  if (post.category_id) {
    const { data } = await supabase
      .from('posts')
      .select('id, slug, title, created_at')
      .eq('category_id', post.category_id)
      .eq('visibility', 'public')
      .order('created_at', { ascending: true })
    seriesPosts = (data ?? []).map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
    }))
  }

  const currentIdx = seriesPosts.findIndex((p) => p.id === post.id)
  const prevPost = currentIdx > 0 ? seriesPosts[currentIdx - 1] : null
  const nextPost =
    currentIdx >= 0 && currentIdx < seriesPosts.length - 1
      ? seriesPosts[currentIdx + 1]
      : null

  const postUrl = `${site.url}/posts/${encodeURI(slug)}`

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt ?? site.description,
    datePublished: post.created_at,
    dateModified: post.updated_at ?? post.created_at,
    author: {
      '@type': 'Person',
      name: site.author.name,
      url: site.author.url,
    },
    publisher: {
      '@type': 'Person',
      name: site.author.name,
      url: site.author.url,
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
    ...(post.cover_image ? { image: [post.cover_image] } : {}),
    ...(post.tags?.length ? { keywords: post.tags.join(', ') } : {}),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: site.url,
      },
      ...ancestors.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: a.name,
        item: `${site.url}/categories/${a.path.map(encodeURIComponent).join('/')}`,
      })),
      {
        '@type': 'ListItem',
        position: ancestors.length + 2,
        name: post.title,
        item: postUrl,
      },
    ],
  }

  return (
    <Layout rightAside={<PostToc />}>
      <JsonLd data={articleSchema} />
      <JsonLd data={breadcrumbSchema} />
      <article className="max-w-3xl mx-auto">
        <header className="mb-8">
          {ancestors.length > 0 && (
            <nav
              aria-label="breadcrumb"
              className="mb-4 text-xs font-mono text-ink-400 flex flex-wrap items-center gap-1"
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

          <h1 className="text-4xl md:text-5xl font-serif font-bold leading-tight tracking-tight mb-5">
            {post.title}
          </h1>

          <div className="flex items-center justify-between text-sm text-ink-400 mb-4">
            <p>
              <span className="text-ink-900 dark:text-craft-50 font-bold">Soshy</span>
              <span className="mx-1.5">·</span>
              <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
              {post.visibility !== 'public' && (
                <span className="ml-2 inline-block text-xs border border-craft-200 dark:border-ink-600 px-2 py-0.5 rounded-sm">
                  {post.visibility === 'private' ? '비공개 · 관리자만 표시' : '초안 · 관리자만 표시'}
                </span>
              )}
            </p>
            <ShareButton />
          </div>

          {post.tags?.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {post.tags.map((tag: string) => (
                <li key={tag}>
                  <Link
                    href={`/tags/${encodeURIComponent(tag)}`}
                    className="inline-flex rounded-full bg-craft-100 dark:bg-ink-800 px-3 py-1 text-xs text-ink-600 dark:text-craft-100 hover:bg-craft-200 dark:hover:bg-ink-600"
                  >
                    {tag}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </header>

        {categoryNode && seriesPosts.length > 0 && (
          <SeriesBox
            categoryName={categoryNode.name}
            posts={seriesPosts}
            currentId={post.id}
          />
        )}

        <div className="craft-prose prose-neutral dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            rehypePlugins={[
              rehypeSlug,
              rehypeHighlight,
              [rehypeSanitize, sanitizeSchema],
            ]}
          >
            {post.content}
          </ReactMarkdown>
        </div>

        {(prevPost || nextPost) && (
          <nav
            aria-label="이전/다음 포스트"
            className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {prevPost ? (
              <Link
                href={`/posts/${prevPost.slug}`}
                className="craft-card p-4 flex items-center gap-3 hover:bg-craft-100 dark:hover:bg-ink-800"
              >
                <ArrowLeft className="h-5 w-5 shrink-0 text-ink-500 dark:text-craft-200" aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs text-ink-400">이전 포스트</p>
                  <p className="font-bold truncate">{prevPost.title}</p>
                </div>
              </Link>
            ) : (
              <div className="hidden md:block" />
            )}
            {nextPost ? (
              <Link
                href={`/posts/${nextPost.slug}`}
                className="craft-card p-4 flex items-center justify-end gap-3 text-right hover:bg-craft-100 dark:hover:bg-ink-800"
              >
                <div className="min-w-0">
                  <p className="text-xs text-ink-400">다음 포스트</p>
                  <p className="font-bold truncate">{nextPost.title}</p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-ink-500 dark:text-craft-200" aria-hidden />
              </Link>
            ) : (
              <div className="hidden md:block" />
            )}
          </nav>
        )}

        <Comments postId={post.id} postSlug={post.slug} />
      </article>
    </Layout>
  )
}
