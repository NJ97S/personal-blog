import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { fetchCategoryTree, walkTree } from '@/lib/categories'
import { site } from '@/lib/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url
  const supabase = createClient()
  const { data: posts } = await supabase
    .from('posts')
    .select('slug, updated_at, category_id')
    .eq('published', true)

  const allPosts = posts ?? []

  const latestByCategory = new Map<string, string>()
  for (const p of allPosts) {
    if (p.category_id && p.updated_at) {
      const prev = latestByCategory.get(p.category_id)
      if (!prev || p.updated_at > prev) {
        latestByCategory.set(p.category_id, p.updated_at)
      }
    }
  }

  const latestOverall = allPosts.reduce<string | null>((max, p) => {
    if (!p.updated_at) return max
    if (!max || p.updated_at > max) return p.updated_at
    return max
  }, null)

  const postEntries: MetadataRoute.Sitemap = allPosts.map((p) => ({
    url: `${base}/posts/${encodeURI(p.slug)}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  const tree = await fetchCategoryTree()
  const categoryEntries: MetadataRoute.Sitemap = walkTree(tree).map((n) => {
    const latest = latestByCategory.get(n.id)
    return {
      url: `${base}/categories/${n.path.map(encodeURIComponent).join('/')}`,
      lastModified: latest ? new Date(latest) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    }
  })

  return [
    {
      url: base,
      lastModified: latestOverall ? new Date(latestOverall) : new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...postEntries,
    ...categoryEntries,
  ]
}
