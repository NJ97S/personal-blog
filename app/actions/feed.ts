'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchCategoryTree, walkTree } from '@/lib/categories'
import { FEED_PAGE_SIZE, type FeedItem, type FeedResult } from '@/lib/feed'

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/

function isValidCursor(cursor: string): boolean {
  if (!ISO_RE.test(cursor)) return false
  const t = Date.parse(cursor)
  return Number.isFinite(t)
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function loadMorePosts(opts: {
  cursor: string
  categoryIds?: string[] | null
}): Promise<FeedResult> {
  if (!opts || typeof opts.cursor !== 'string' || !isValidCursor(opts.cursor)) {
    return { items: [], nextCursor: null }
  }

  const categoryIds = Array.isArray(opts.categoryIds)
    ? opts.categoryIds.filter((id) => typeof id === 'string' && UUID_RE.test(id))
    : null

  const supabase = createClient()

  let query = supabase
    .from('posts')
    .select(
      'id, title, slug, excerpt, tags, created_at, cover_image, category_id',
    )
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(FEED_PAGE_SIZE + 1)
    .lt('created_at', opts.cursor)

  if (categoryIds && categoryIds.length > 0) {
    query = query.in('category_id', categoryIds)
  }

  const [{ data: rows, error }, tree] = await Promise.all([
    query,
    fetchCategoryTree(),
  ])

  if (error || !rows) {
    return { items: [], nextCursor: null }
  }

  const categoryById = new Map(walkTree(tree).map((n) => [n.id, n] as const))
  const hasMore = rows.length > FEED_PAGE_SIZE
  const visible = hasMore ? rows.slice(0, FEED_PAGE_SIZE) : rows

  const items: FeedItem[] = visible.map((row) => {
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

  const nextCursor = hasMore ? items[items.length - 1]?.created_at ?? null : null

  return { items, nextCursor }
}
