export const FEED_PAGE_SIZE = 10

export type FeedItem = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  tags: string[] | null
  created_at: string
  cover_image: string | null
  category: { name: string; path: string[] } | null
}

export type FeedResult = {
  items: FeedItem[]
  nextCursor: string | null
}
