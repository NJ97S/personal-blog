import 'server-only'
import { createClient } from '@/lib/supabase/server'

export async function getPostViewCounts(postIds: string[]): Promise<Map<string, number>> {
  const supabase = createClient()
  const ids = Array.from(new Set(postIds))
  const results = await Promise.all(
    Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) =>
      supabase.rpc('post_view_counts', { p_post_ids: ids.slice(index * 100, (index + 1) * 100) }),
    ),
  )
  const counts = new Map<string, number>()
  for (const { data, error } of results) {
    if (error) {
      console.warn('[post_view_counts]', error.message)
      continue
    }
    for (const row of data ?? []) counts.set(row.post_id, Number(row.view_count))
  }
  return counts
}
