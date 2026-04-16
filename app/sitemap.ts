import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const supabase = createClient()
  const { data: posts } = await supabase
    .from('posts')
    .select('slug, updated_at')
    .eq('published', true)

  const postEntries: MetadataRoute.Sitemap = (posts ?? []).map((p) => ({
    url: `${base}/posts/${p.slug}`,
    lastModified: new Date(p.updated_at),
  }))

  return [
    { url: base, lastModified: new Date() },
    ...postEntries,
  ]
}
