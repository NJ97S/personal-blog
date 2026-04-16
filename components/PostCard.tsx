import Link from 'next/link'

export type PostCardProps = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  tags: string[]
  published: boolean
  created_at: string
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

export default function PostCard({ title, slug, excerpt, tags, published, created_at }: PostCardProps) {
  return (
    <article className="craft-card p-5 transition-shadow hover:shadow-sm">
      <Link href={`/posts/${slug}`} className="block">
        <header className="flex items-baseline justify-between gap-3 mb-2">
          <h2 className="text-xl font-bold font-serif">{title}</h2>
          {!published && (
            <span className="text-xs text-ink-400 border border-craft-200 dark:border-ink-600 px-2 py-0.5 rounded-sm">
              draft
            </span>
          )}
        </header>
        <p className="text-sm text-ink-400 mb-3">{formatDate(created_at)}</p>
        {excerpt && (
          <p className="text-sm text-ink-600 dark:text-craft-100 line-clamp-3 mb-3">{excerpt}</p>
        )}
      </Link>
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
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
    </article>
  )
}
