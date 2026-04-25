import Link from 'next/link'
import Image from 'next/image'

export type PostCardProps = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  tags: string[]
  created_at: string
  coverImage?: string | null
  category?: { name: string; path: string[] } | null
  commentCount?: number
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

export default function PostCard({
  title,
  slug,
  excerpt,
  tags,
  created_at,
  coverImage,
  category,
  commentCount,
}: PostCardProps) {
  const categoryHref = category
    ? `/categories/${category.path.map(encodeURIComponent).join('/')}`
    : null

  return (
    <article className="craft-card overflow-hidden transition-shadow hover:shadow-sm">
      <div className="flex gap-0 sm:gap-4">
        <Link
          href={`/posts/${slug}`}
          aria-hidden
          tabIndex={-1}
          className="hidden sm:block shrink-0 w-[140px] aspect-square relative bg-craft-100 dark:bg-ink-800/60 overflow-hidden"
        >
          {coverImage ? (
            <Image
              src={coverImage}
              alt=""
              fill
              sizes="140px"
              className="object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center font-serif text-2xl text-ink-400 dark:text-craft-200">
              {title.charAt(0) || '記'}
            </div>
          )}
        </Link>

        <div className="flex-1 min-w-0 p-4 sm:py-4 sm:pr-4 sm:pl-0">
          {categoryHref && category && (
            <div className="mb-1 flex items-center gap-2 text-xs">
              <Link
                href={categoryHref}
                className="font-mono text-craft-400 hover:text-ink-900 dark:hover:text-craft-50"
              >
                {category.name}
              </Link>
            </div>
          )}

          <Link href={`/posts/${slug}`} className="block">
            <h2 className="text-lg sm:text-xl font-bold font-serif line-clamp-2 mb-1 hover:text-craft-400">
              {title}
            </h2>
            {excerpt && (
              <p className="text-sm text-ink-600 dark:text-craft-100 line-clamp-2 mb-2">
                {excerpt}
              </p>
            )}
          </Link>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
            <span className="font-mono">{formatDate(created_at)}</span>
            {typeof commentCount === 'number' && commentCount > 0 && (
              <span className="font-mono">💬 {commentCount}</span>
            )}
            {tags.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {tags.slice(0, 4).map((tag) => (
                  <li key={tag}>
                    <Link
                      href={`/tags/${encodeURIComponent(tag)}`}
                      className="font-mono hover:text-ink-900 dark:hover:text-craft-50"
                    >
                      #{tag}
                    </Link>
                  </li>
                ))}
                {tags.length > 4 && (
                  <li className="font-mono text-ink-400" aria-label={`${tags.length - 4}개 태그 더`}>
                    +{tags.length - 4}
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
